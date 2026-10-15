'use strict';
// Khung E2E dùng chung (phòng qa): mở app Mochi Notes thật bằng playwright-core `_electron`.
// Chạy dưới xvfb (xem test/e2e/run.sh). Mỗi lần launch dùng XDG_CONFIG_HOME riêng (dữ liệu cô lập).
//
//   const { launch } = require('./lib/app');
//   const app = await launch();                 // thư mục dữ liệu tạm mới
//   const note = await app.noteWindow();        // Page của cửa sổ note đầu tiên
//   const data = await app.main(c => c.store.data.notes.length);   // chạy trong main, c = ctx
//   await app.shot('ten-anh');                  // chụp toàn màn hình xvfb -> test/e2e/out/ten-anh.png
//   await app.close();                          // thoát như người dùng (app.quit -> flush dữ liệu)
//   const app2 = await launch({ configHome: app.configHome });  // mở lại cùng dữ liệu
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let electronPw;
try { ({ _electron: electronPw } = require('playwright-core')); }
catch (e) {
  throw new Error('Thiếu playwright-core. Cài tạm: npm i --no-save playwright-core@1.48.2');
}

// MOCHI_E2E_ROOT: chạy bộ test với mã nguồn ở thư mục khác (worktree nhánh phòng khác, bản đóng gói giải nén).
const ROOT = process.env.MOCHI_E2E_ROOT ? path.resolve(process.env.MOCHI_E2E_ROOT) : path.join(__dirname, '..', '..', '..');
const OUT = path.join(__dirname, '..', 'out');
fs.mkdirSync(OUT, { recursive: true });
const ELECTRON = require(path.join(ROOT, 'node_modules', 'electron'));   // đường dẫn binary

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, { timeout = 10000, interval = 100, msg = 'điều kiện' } = {}) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(interval);
  }
  throw new Error('Hết giờ chờ ' + msg + (last instanceof Error ? ': ' + last.message : ''));
}

/**
 * Mở app.
 * opts.configHome  thư mục XDG_CONFIG_HOME (mặc định tạo mới trong os.tmpdir())
 * opts.seed        object dữ liệu ghi sẵn vào mochi-data.json trước khi mở (hoặc chuỗi thô)
 * opts.env         biến môi trường thêm (MOCHI_DEV_*, TZ…)
 * opts.waitNotes   chờ ít nhất N cửa sổ note (mặc định 0)
 */
async function launch(opts = {}) {
  const configHome = opts.configHome || fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-e2e-'));
  const userData = path.join(configHome, 'Mochi Notes');
  if (opts.seed !== undefined) {
    fs.mkdirSync(userData, { recursive: true });
    const raw = typeof opts.seed === 'string' ? opts.seed : JSON.stringify(opts.seed);
    fs.writeFileSync(path.join(userData, 'mochi-data.json'), raw);
  }
  const env = Object.assign({}, process.env, {
    XDG_CONFIG_HOME: configHome,
    TZ: process.env.TZ || 'Asia/Ho_Chi_Minh',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
  }, opts.env || {});
  const t0 = Date.now();
  const eApp = await electronPw.launch({
    executablePath: ELECTRON,
    args: ['-r', path.join(__dirname, 'hook.js'), ROOT, '--no-sandbox', '--disable-gpu'],
    env,
    cwd: ROOT,
    timeout: 30000
  });
  const logs = [];
  const proc = eApp.process();
  proc.stdout && proc.stdout.on('data', d => logs.push(String(d)));
  proc.stderr && proc.stderr.on('data', d => logs.push(String(d)));

  const app = {
    eApp, configHome, userData, logs, launchedAt: t0,
    dataFile: path.join(userData, 'mochi-data.json'),

    /** Chạy fn(ctx, electron) trong tiến trình main. fn phải tự chứa (được tuần tự hoá). */
    async main(fn, arg) {
      return eApp.evaluate((electron, [src, a]) => {
        const ctx = globalThis.__mochiCtx();
        // eslint-disable-next-line no-new-func
        const f = new Function('return (' + src + ')')();
        return f(ctx, electron, a);
      }, [fn.toString(), arg]);
    },

    /** Gọi phím tắt toàn cục đã đăng ký, vd 'Ctrl+Alt+N'. */
    shortcut(acc) {
      return eApp.evaluate((_e, a) => { const f = globalThis.__mochiShortcuts[a]; if (!f) throw new Error('Chưa đăng ký phím ' + a); f(); return true; }, acc);
    },
    /** Bấm mục menu khay theo nhãn (vd 'Ẩn tất cả note'). Trả về false nếu không có mục. */
    trayClick(label) {
      return eApp.evaluate((_e, l) => {
        const m = globalThis.__mochiTrayMenu; if (!m) throw new Error('Chưa có menu khay');
        const it = m.items.find(i => i.label === l); if (!it) return false;
        if (it.type === 'checkbox') it.checked = !it.checked;
        it.click(it); return true;
      }, label);
    },
    trayLabels() { return eApp.evaluate(() => (globalThis.__mochiTrayMenu ? globalThis.__mochiTrayMenu.items.map(i => i.label) : [])); },

    /** Mọi Page (cửa sổ) đang mở. */
    windows() { return eApp.windows(); },

    /** Chờ Page có URL chứa `part` (note.html, list.html, pet.html, ring.html, memo.html…). */
    async page(part, { timeout = 15000, index = 0 } = {}) {
      return waitFor(() => {
        const ws = eApp.windows().filter(p => { try { return p.url().includes(part); } catch (_) { return false; } });
        return ws[index] || null;
      }, { timeout, msg: 'cửa sổ ' + part });
    },
    pages(part) { return eApp.windows().filter(p => { try { return p.url().includes(part); } catch (_) { return false; } }); },

    /** Page của cửa sổ note theo id (hoặc note đầu tiên). */
    async noteWindow(id, opt) {
      if (!id) return app.page('note.html', opt);
      return app.page('note.html?id=' + id, opt);
    },

    /** Mở cửa sổ danh sách (qua ctx.list.open) và trả Page. */
    async openList(tab) {
      await app.main((c, e, t) => c.list.open(t), tab || undefined);
      return app.page('list.html');
    },

    notes() { return app.main(c => JSON.parse(JSON.stringify(c.store.data.notes))); },
    readData() { return JSON.parse(fs.readFileSync(app.dataFile, 'utf8')); },
    flush() { return app.main(c => { c.store.flushSync(); return true; }); },

    /** Ảnh toàn màn hình xvfb (thấy cả cửa sổ trong suốt của bé). */
    async shot(name) {
      const file = path.join(OUT, name.replace(/[^\w.-]+/g, '_') + '.png');
      try { execFileSync('import', ['-window', 'root', file], { env: process.env, timeout: 15000 }); }
      catch (e) { return null; }
      return file;
    },

    /** Thoát như người dùng (khay -> Thoát = app.quit) để dữ liệu được flush. */
    async close() {
      try {
        await Promise.race([
          (async () => { await app.main((c, e) => { setTimeout(() => e.app.quit(), 10); return true; }).catch(() => {});
            await eApp.close().catch(() => {}); })(),
          sleep(10000)
        ]);
      } finally { try { proc.kill('SIGKILL'); } catch (_) { /* đã thoát */ } }
    },
    /** Giết tiến trình (giả lập mất điện / crash). */
    kill() { try { proc.kill('SIGKILL'); } catch (_) { /* */ } return sleep(300); }
  };
  if (opts.waitNotes) await waitFor(() => app.pages('note.html').length >= opts.waitNotes, { timeout: 20000, msg: opts.waitNotes + ' cửa sổ note' });
  return app;
}

/** Bọc test: lỗi -> chụp ảnh `<ten>-LOI.png` rồi ném lại. Luôn đóng app. */
async function withApp(name, opts, body) {
  if (typeof opts === 'function') { body = opts; opts = {}; }
  const app = await launch(opts);
  try { return await body(app); }
  catch (e) {
    const f = await app.shot(name + '-LOI');
    if (f) e.message += '\n  ảnh: ' + path.relative(ROOT, f);
    const tail = app.logs.join('').split('\n').slice(-30).join('\n');
    if (tail.trim()) e.message += '\n  log app (cuối):\n' + tail;
    throw e;
  } finally { await app.close(); }
}

module.exports = { launch, withApp, waitFor, sleep, ROOT, OUT };
