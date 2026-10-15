'use strict';
// Kiểm bản ĐÓNG GÓI: mở app từ app.asar (hoặc thư mục app đã giải nén) và bắt file bị thiếu.
//   MOCHI_PACKAGED_APP=/duong/dan/resources/app.asar  bash test/e2e/run.sh test/e2e/packaged.test.js
// Không đặt biến -> tự bỏ qua. Binary Electron: MOCHI_PACKAGED_ELECTRON (mặc định electron của repo, Linux).
// Cách có bản đóng gói (không để trong repo):
//   npx electron-builder --win zip --x64 --config.directories.output=/home/claude/qa-dist
//   MOCHI_PACKAGED_APP=/home/claude/qa-dist/win-unpacked/resources/app.asar
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP = process.env.MOCHI_PACKAGED_APP ? path.resolve(process.env.MOCHI_PACKAGED_APP) : '';
const SKIP = !APP || !fs.existsSync(APP) ? 'đặt MOCHI_PACKAGED_APP=<app.asar | thư mục app> để chạy' : false;
const HOOK = path.join(__dirname, 'lib', 'hook.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, { timeout = 30000, interval = 150, msg = 'điều kiện' } = {}) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < timeout) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(interval);
  }
  throw new Error('Hết giờ chờ ' + msg + (last instanceof Error ? ': ' + last.message : ''));
}

let eApp = null, configHome = '';
const problems = [];          // lỗi tải tài nguyên: requestfailed / HTTP>=400 / console "Failed to load"
const logs = [];
const seen = new WeakSet();

function watch(page) {
  if (seen.has(page)) return; seen.add(page);
  const tag = () => { try { return path.basename(new URL(page.url()).pathname); } catch (_) { return '?'; } };
  page.on('requestfailed', r => /ERR_ABORTED/.test((r.failure() || {}).errorText || '') || problems.push(`[${tag()}] requestfailed ${r.url()} ${(r.failure() || {}).errorText || ''}`));
  page.on('response', r => { if (r.status() >= 400) problems.push(`[${tag()}] HTTP ${r.status()} ${r.url()}`); });
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && /Failed to load resource|ERR_FILE_NOT_FOUND|net::ERR/.test(t)) problems.push(`[${tag()}] console ${t}`);
    if (m.type() === 'error') logs.push(`[${tag()}] ${t}`);
  });
  page.on('pageerror', e => logs.push(`[${tag()}] pageerror ${e.message}`));
}
const pages = part => eApp.windows().filter(p => { try { return p.url().includes(part); } catch (_) { return false; } });
const main = (fn, arg) => eApp.evaluate((electron, [src, a]) => {
  const ctx = globalThis.__mochiCtx();
  // eslint-disable-next-line no-new-func
  return new Function('return (' + src + ')')()(ctx, electron, a, globalThis.__mochiRequire);
}, [fn.toString(), arg]);

test.before(async () => {
  if (SKIP) return;
  const { _electron } = require('playwright-core');
  const electronBin = process.env.MOCHI_PACKAGED_ELECTRON || require(path.join(__dirname, '..', '..', 'node_modules', 'electron'));
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-pkg-'));
  eApp = await _electron.launch({
    executablePath: electronBin,
    args: ['-r', HOOK, APP, '--no-sandbox', '--disable-gpu'],
    env: Object.assign({}, process.env, { XDG_CONFIG_HOME: configHome, TZ: 'Asia/Ho_Chi_Minh', MOCHI_E2E_ROOT: APP, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }),
    timeout: 60000
  });
  eApp.on('window', watch);
  eApp.windows().forEach(watch);
  await waitFor(() => pages('note.html').length >= 2, { timeout: 60000, msg: '2 note mẫu' });
  // nạp lại để bắt cả request lúc tải đầu (trước khi gắn listener)
  for (const p of eApp.windows()) { try { await p.reload({ timeout: 20000 }); } catch (_) { /* cửa sổ đặc biệt */ } }
});

test.after(async () => {
  if (!eApp) return;
  try { await Promise.race([main((c, e) => { setTimeout(() => e.app.quit(), 10); return true; }).catch(() => {}), sleep(8000)]); } catch (_) { /* */ }
  try { await eApp.process().kill('SIGKILL'); } catch (_) { /* */ }
  if (logs.length) console.log('# log lỗi trang (tham khảo):\n# ' + logs.slice(0, 15).join('\n# '));
  try { fs.rmSync(configHome, { recursive: true, force: true }); } catch (_) { /* */ }
});

test('đóng gói: không lọt test/docs/art/tools/scripts, có src + assets', { skip: SKIP, timeout: 60000 }, async () => {
  const r = await main((c, e, root, req) => {
    const fs = req('fs'), path = req('path');
    const ex = p => fs.existsSync(path.join(root, p));
    return {
      must: ['package.json', 'src/main/main.js', 'src/main/preload.js', 'src/note/note.html', 'src/list/list.html', 'src/game/room.html',
        'assets/dialogue/vi.json', 'assets/fonts/fonts.css', 'assets/paper/catalog.js', 'assets/pet/mochi/pack.json', 'assets/game/catalog.json', 'assets/icon.png']
        .filter(p => !ex(p)),
      leaked: ['test', 'docs', 'art', 'tools', 'scripts', 'node_modules', 'src/game/test', 'src/note/tools', 'src/main/persona/test', 'src/main/persona/tools',
        'src/main/notes/__tests__', 'src/main/alarms/__tests__', 'src/main/game/__tests__', 'src/main/paper/__tests__', 'CLAUDE.md', 'SPEC.md']
        .filter(ex)
    };
  }, APP);
  assert.deepStrictEqual(r.must, [], 'thiếu trong gói: ' + r.must.join(', '));
  assert.deepStrictEqual(r.leaked, [], 'lọt vào gói: ' + r.leaked.join(', '));
});

test('đóng gói: note mẫu hiện và có chữ', { skip: SKIP, timeout: 60000 }, async () => {
  const ps = pages('note.html');
  assert.ok(ps.length >= 2, 'số cửa sổ note = ' + ps.length);
  await waitFor(() => ps[0].evaluate(() => document.body.innerText.trim().length > 0), { msg: 'chữ trong note' });
  assert.ok(await main(c => c.store.data.notes.length) >= 2);
});

test('đóng gói: mọi tài nguyên mẫu giấy/phông/deco/icon game/khung bé có trong gói', { skip: SKIP, timeout: 120000 }, async () => {
  const miss = await main((c, e, root, req) => {
    const fs = req('fs'), path = req('path');
    const out = [];
    const chk = (p, why) => { if (!fs.existsSync(p)) out.push(why + ': ' + path.relative(root, p)); };
    // phông: mọi url() trong fonts.css
    const fdir = path.join(root, 'assets/fonts');
    const css = fs.readFileSync(path.join(fdir, 'fonts.css'), 'utf8');
    for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) chk(path.join(fdir, m[1]), 'phông');
    // mẫu giấy: deco img trong catalog.js
    const cat = fs.readFileSync(path.join(root, 'assets/paper/catalog.js'), 'utf8');
    const C = new Function('window', cat + '; return window.MochiPaperCatalog;')({});
    for (const p of C.papers) for (const d of (p.deco || [])) if (d.src) chk(path.join(root, 'assets/paper', d.src), 'deco ' + p.id);
    // game: icon trong catalog.json
    const G = JSON.parse(fs.readFileSync(path.join(root, 'assets/game/catalog.json'), 'utf8'));
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof o.icon === 'string') chk(path.join(root, 'assets/game', o.icon), 'icon game'); Object.values(o).forEach(walk); } };
    walk(G);
    // bé: mọi khung hình + mặt của gói mochi
    const pack = req(path.join(root, 'src/main/petcore/pack.js'));
    const dir = path.join(root, 'assets/pet/mochi');
    const P = pack.loadPack(dir);
    let frames = 0;
    for (const a of Object.values(P.anims)) for (const m of Object.values(a)) for (const ph of Object.values(m)) for (const f of ph) { frames++; chk(path.join(dir, f.src), 'khung bé'); }
    for (const f of Object.values(P.faces)) chk(path.join(dir, f), 'mặt bé');
    const bad = P.warnings.filter(w => /không tồn tại|rỗng|thiếu/.test(w));
    return { out, frames, papers: C.papers.length, warnings: bad };
  }, APP);
  assert.ok(miss.papers > 10 && miss.frames > 50, `quá ít dữ liệu: ${miss.papers} mẫu, ${miss.frames} khung`);
  assert.deepStrictEqual(miss.out, [], 'thiếu file:\n' + miss.out.join('\n'));
  assert.deepStrictEqual(miss.warnings, [], 'gói bé cảnh báo: ' + miss.warnings.join('; '));
});

test('đóng gói: đổi qua mọi mẫu giấy + nạp phông không 404', { skip: SKIP, timeout: 180000 }, async () => {
  const note = pages('note.html')[0];
  const id = await main(c => c.store.data.notes[0].id);
  const ids = await note.evaluate(() => (window.MochiPaperCatalog ? window.MochiPaperCatalog.papers.map(p => p.id) : []));
  assert.ok(ids.length > 10, 'catalog mẫu giấy trong note rỗng');
  const before = problems.length;
  for (const pid of ids) {
    await note.evaluate((a) => window.mochi.paper.set(a.id, { paper: a.pid }), { id, pid });
    await sleep(120);
  }
  const fams = await note.evaluate(async () => {
    const names = [...new Set([...document.fonts].map(f => f.family.replace(/['"]/g, '')))];
    const res = {};
    for (const n of names) { try { const l = await document.fonts.load('16px "' + n + '"', 'Việt Nam'); res[n] = l.length; } catch (e) { res[n] = -1; } }
    return res;
  });
  const names = Object.keys(fams);
  assert.ok(names.length >= 3, 'ít phông khai báo: ' + names.join(','));
  const noLoad = names.filter(n => fams[n] <= 0);
  assert.deepStrictEqual(noLoad, [], 'phông không nạp được: ' + noLoad.join(', '));
  await sleep(500);
  assert.deepStrictEqual(problems.slice(before), [], 'tài nguyên lỗi khi đổi mẫu giấy');
});

test('đóng gói: bé nạp gói hình, Phòng của Mochi mở được', { skip: SKIP, timeout: 90000 }, async () => {
  const pet = await waitFor(() => pages('pet.html')[0], { msg: 'cửa sổ bé pet.html' }).catch(() => null);
  if (pet) {
    await waitFor(() => pet.evaluate(() => [...document.images].some(i => i.complete && i.naturalWidth > 0) || [...document.querySelectorAll('canvas')].length > 0), { msg: 'hình bé' });
  } else {
    const has = await main(c => !!c.windows.pet);
    assert.ok(has, 'không có cửa sổ bé');
  }
  await main(c => { c.game.open(); return true; });
  const room = await waitFor(() => pages('room.html')[0], { msg: 'room.html' });
  watch(room);
  await room.reload();
  await waitFor(() => room.evaluate(() => document.querySelectorAll('#tablist > *').length >= 3), { msg: 'các tab Phòng của Mochi' });
  await waitFor(() => room.evaluate(() => document.body.innerText.trim().length > 20), { msg: 'nội dung phòng' });
});

test('đóng gói: assets/wardrobe có item.json hợp lệ + SVG không rỗng (37 action/tủ đồ)', { skip: SKIP, timeout: 60000 }, async () => {
  const r = await main((c, e, root, req) => {
    const fs = req('fs'), path = req('path');
    const dir = path.join(root, 'assets/wardrobe');
    const out = []; let items = 0, svgs = 0;
    for (const d of fs.readdirSync(dir)) {
      const sub = path.join(dir, d);
      if (!fs.statSync(sub).isDirectory()) continue;
      items++;
      try { const j = JSON.parse(fs.readFileSync(path.join(sub, 'item.json'), 'utf8')); if (j.id !== d) out.push('id lệch: ' + d + ' vs ' + j.id); if (!j.slot) out.push('thiếu slot: ' + d); }
      catch (err) { out.push('item.json lỗi ' + d + ': ' + err.message); }
      for (const f of fs.readdirSync(sub)) if (/\.svg$/.test(f)) { svgs++; const t = fs.readFileSync(path.join(sub, f), 'utf8'); if (!/<svg[\s>]/.test(t) || t.length < 80) out.push('svg rỗng/hỏng: ' + d + '/' + f); }
    }
    return { out, items, svgs };
  }, APP);
  assert.ok(r.items >= 10 && r.svgs > 50, `ít dữ liệu: ${r.items} món, ${r.svgs} svg`);
  assert.deepStrictEqual(r.out, [], r.out.join('\n'));
});

test('đóng gói: lần lượt mở đủ 6 tab Phòng của Mochi (kể cả Album), không tab-error/404', { skip: SKIP, timeout: 120000 }, async () => {
  await main(c => { c.game.open(); return true; });
  const room = await waitFor(() => pages('room.html')[0], { msg: 'room.html' });
  watch(room);
  await waitFor(() => room.evaluate(() => document.querySelectorAll('#tablist > *').length >= 6), { msg: '>=6 tab' });
  const before = problems.length;
  const ids = await room.evaluate(() => [...document.querySelectorAll('#tablist > *')].map(b => b.dataset.tab));
  assert.ok(ids.includes('album'), 'thiếu tab album: ' + ids.join(','));
  for (const id of ids) {
    await room.evaluate(i => document.querySelector('#tablist [data-tab="' + i + '"]').click(), id);
    await sleep(500);
    const st = await room.evaluate(i => { const p = document.getElementById('tab-' + i); return { shown: p && !p.hidden, err: !!(p && p.querySelector('.tab-error')), len: p ? p.innerText.trim().length : 0 }; }, id);
    assert.ok(st.shown && !st.err && st.len > 5, `tab ${id}: ${JSON.stringify(st)}`);
  }
  await sleep(500);
  assert.deepStrictEqual(problems.slice(before), [], 'tài nguyên lỗi khi mở tab');
});

test('đóng gói: kho thoại nạp được và chọn được câu', { skip: SKIP, timeout: 30000 }, async () => {
  const r = await main(c => ({ n: c.persona && c.persona.lines ? c.persona.lines.length : -1, line: c.persona && c.persona.pick ? c.persona.pick('click', {}) : null }));
  assert.ok(r.n > 50, 'kho thoại có ' + r.n + ' câu');
  assert.ok(r.line, 'pick không trả câu nào');
});

test('đóng gói: không có tài nguyên lỗi trong toàn phiên', { skip: SKIP, timeout: 30000 }, async () => {
  assert.deepStrictEqual(problems, [], 'tài nguyên lỗi:\n' + problems.join('\n'));
});
