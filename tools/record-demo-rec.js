// Thu khung mượt từ app dev: beginFrameSubscription trên từng cửa sổ + nhật ký bounds ~250Hz. Dùng cùng tools/record-demo.js.
// Chạy app dev với dữ liệu riêng và cổng inspector (ví dụ: MOCHI_DATA_DIR=<thư-mục-riêng> electron --inspect=9334 .),
// rồi nạp tệp này vào tiến trình chính qua inspector (Runtime.evaluate, awaitPromise) với biến:
//   const DEMO_OUT = '<thư-mục-gốc-khung>';   // mỗi cảnh ghi vào DEMO_OUT/<tên>/ (*.bgra + meta.json); nền ghi vào DEMO_OUT/bg.png
//   const DEMO_BG_HTML = '<đường-dẫn>/tools/record-demo-bg.html';
//   const SCENE = 'bg' | 'hero' | 'remind' | 'command' | 'tea' | 'read' | 'bedtime';
// Sân khấu 960x540 là góc dưới-phải màn hình chính; ghép offline bằng `node tools/record-demo.js build ...`.
// Cảnh 'đời sống' = ba lần thu tea/read/bedtime, nối bằng `record-demo.js merge`. Dùng ghi chú trung tính, không dữ liệu thật.
// Lưu ý: bigAlert giữ nguyên cài đặt alertMotion mặc định; chỉ đổi màn hình giả cho cửa sổ nhắc to.
if (!globalThis.REC2) {
(function () {
  const { BrowserWindow, screen } = require('electron');
  const fs = require('fs');
  const path = require('path');
  const pd = screen.getPrimaryDisplay().bounds;
  const R = { rect: { x: pd.x + pd.width - 960, y: pd.y + pd.height - 540, w: 960, h: 540 }, running: false, marks: {} };
  const now = () => performance.now();
  const kindOf = w => {
    const u = w.webContents.getURL();
    if (/pet\.html/.test(u)) return 'pet';
    if (/note\.html/.test(u)) return 'note';
    if (/alert\.html/.test(u)) return 'alert';
    if (/onboarding/.test(u)) return 'skip';
    if (/bin/.test(u)) return 'bin';
    if (/toolbar|cmd/.test(u)) return 'toolbar';
    return 'other:' + u.split('/').slice(-2).join('/');
  };
  R.kindOf = kindOf;
  R.sl = ms => new Promise(r => setTimeout(r, ms));
  R.mark = k => { R.marks[k] = Math.round(now() - R.t0); };
  R.start = function (dir) {
    fs.mkdirSync(dir, { recursive: true });
    R.dir = dir; R.running = true; R.t0 = now(); R.marks = {};
    R.frames = []; R.samples = []; R.seq = 0; R.pend = 0; R.last = new Map(); R.subs = new Map(); R.vis = new Map(); R.cb = {};
    const sample = (w, kind, t) => {
      let b; try { b = w.getBounds(); } catch (e) { return; }
      const vis = w.isVisible(), op = w.getOpacity();
      const key = w.id + ':' + b.x + ',' + b.y + ',' + b.width + ',' + b.height + ',' + vis + ',' + op;
      if (R.last.get(w.id) === key) return;
      const pv = R.vis.get(w.id); R.vis.set(w.id, vis); if (vis && pv === false) { try { w.webContents.invalidate(); } catch (e) { /* bỏ qua */ } }
      R.last.set(w.id, key);
      R.samples.push({ t: Math.round(t * 100) / 100, id: w.id, k: kind, x: b.x, y: b.y, w: b.width, h: b.height, v: vis ? 1 : 0, op });
    };
    const attach = w => {
      if (R.subs.has(w.id)) return;
      const k = kindOf(w);
      if (k === 'skip') { R.subs.set(w.id, null); return; }
      R.subs.set(w.id, k);
      const id = w.id;
      try {
        w.webContents.beginFrameSubscription(false, img => {
          if (!R.running) return;
          const t = now() - R.t0;
          const s = img.getSize();
          if (!s.width || !s.height) return;
          sample(w, k, t);
          const seq = R.seq++, f = id + '_' + seq + '.bgra';
          R.cb[id] = (R.cb[id] || 0) + 1;
          R.pend++;
          fs.promises.writeFile(path.join(dir, f), img.getBitmap()).finally(() => { R.pend--; });
          R.frames.push({ t: Math.round(t * 100) / 100, id, k, f, w: s.width, h: s.height });
        });
        w.webContents.invalidate();
      } catch (e) { R.subs.set(w.id, 'err:' + e.message); }
    };
    R.timer = setInterval(() => {
      const t = now() - R.t0;
      const alive = new Set();
      for (const w of BrowserWindow.getAllWindows()) {
        alive.add(w.id);
        if (w.isDestroyed()) continue;
        attach(w);
        const k = R.subs.get(w.id);
        if (k && !String(k).startsWith('err')) sample(w, k, t);
      }
      for (const [id, key] of R.last) {
        if (!alive.has(id) && !String(key).startsWith('gone')) { R.last.set(id, 'gone' + id); R.samples.push({ t: Math.round(t * 100) / 100, id, k: R.subs.get(id), x: 0, y: 0, w: 0, h: 0, v: 0, op: 0 }); }
      }
    }, 4);
    return 'rec2 started';
  };
  R.stop = async function () {
    R.running = false; clearInterval(R.timer);
    for (const w of BrowserWindow.getAllWindows()) { try { if (!w.isDestroyed()) w.webContents.endFrameSubscription(); } catch (e) { /* bỏ qua */ } }
    await R.sl(300);
    while (R.pend > 0) await R.sl(50);
    const dur = now() - R.t0;
    fs.writeFileSync(path.join(R.dir, 'meta.json'), JSON.stringify({ rect: R.rect, dur, frames: R.frames, samples: R.samples, marks: R.marks }));
    return { dur: Math.round(dur), frames: R.frames.length, samples: R.samples.length, perWin: R.cb, fps: Object.fromEntries(Object.entries(R.cb).map(([k, v]) => [k, +(v / (dur / 1000)).toFixed(1)])) };
  };
  // Màn hình giả cho cửa sổ nhắc to: sân khấu 960x540
  R.patchBig = function () {
    const ctx = globalThis.mochiCtx;
    if (!globalThis.__origBig) globalThis.__origBig = ctx.pet.bigAlert;
    ctx.pet.bigAlert = opts => {
      const Rr = globalThis.REC2, r = Rr.rect, o = screen.getDisplayNearestPoint;
      const fake = Object.assign({}, screen.getPrimaryDisplay(), { bounds: { x: r.x, y: r.y, width: r.w, height: r.h }, workArea: { x: r.x, y: r.y, width: r.w, height: r.h - 48 }, size: { width: r.w, height: r.h } });
      screen.getDisplayNearestPoint = () => fake;
      try { Rr.mark('alert_' + ((opts && opts.level) || 1)); return globalThis.__origBig(opts); } finally { screen.getDisplayNearestPoint = o; }
    };
  };
  R.reset = function () { const N = globalThis.mochiCtx.notes; for (const n of globalThis.mochiCtx.store.data.notes.slice()) { try { N.deleteNotePermanently(n.id); } catch (e) { /* bỏ qua */ } } };
  R.mkNote = async function (o) {
    const ctx = globalThis.mochiCtx, rc = R.rect;
    const n = ctx.notes.makeNote({ html: o.html, color: o.color || 'yellow', autoReminder: o.autoReminder !== false ? !!o.autoReminder : false, bounds: { x: rc.x + o.x, y: rc.y + o.y, width: o.w || 300, height: o.h || 200 } });
    ctx.store.data.notes.push(n); ctx.store.save();
    const win = ctx.notes.openNote(n.id, { focus: false });
    ctx.notes.notifyList();
    await R.sl(1200); try { await win.webContents.insertCSS('#insightRow{display:none!important}'); } catch (e) { /* bỏ qua */ }
    if (o.paper) { await win.webContents.executeJavaScript('window.mochi.paper.set(' + JSON.stringify(n.id) + ',{paper:' + JSON.stringify(o.paper) + '})'); await R.sl(500); }
    return n.id;
  };
  for (const w of BrowserWindow.getAllWindows()) { try { if (/onboarding/.test(w.webContents.getURL())) w.close(); } catch (e) { /* bỏ qua */ } }
  globalThis.REC2 = R;
})();
}
const R = globalThis.REC2, sl = R.sl, N = ctx.notes, A = ctx.pet.actor, B = ctx.pet.body;
const { BrowserWindow } = require('electron');
const OUT = name => DEMO_OUT + '/' + name;
if (SCENE === 'bg') {
  const w = new BrowserWindow({ show: false, width: 960, height: 540, useContentSize: true, frame: false });
  await w.loadFile(DEMO_BG_HTML); await sl(500);
  require('fs').writeFileSync(DEMO_OUT + '/bg.png', (await w.webContents.capturePage()).toPNG()); w.destroy();
  return 'bg ok';
}
try { ctx.settings().sound = false; } catch (e) { /* bỏ qua */ }
try { if (ctx.pet.core.brain.isSleeping()) { ctx.pet.core.brain.wake(); await sl(2500); } } catch (e) { /* bỏ qua */ }
const pre = async (x) => { let ok = false; for (let k = 0; k < 20 && !ok; k++) { ok = await ctx.antics.perform('pre', async () => { await ctx.antics.api.step(B.walk({ toX: R.rect.x + x, speedMul: 2.8 })); B.setFace('left'); }, { wake: true }); if (!ok) await sl(800); } };
const todo = () => R.mkNote({ html: '<div>Việc cần làm</div><div>Họp team</div><div>Mua sữa</div>', paper: 'real-sticky', x: 620, y: 70 });
if (SCENE === 'hero') {
  R.reset(); await sl(600);
  const id = await R.mkNote({ html: '<div>Việc cần làm</div><div>Họp team 9h</div><div>Mua sữa</div>', paper: 'real-sticky', x: 330, y: 270 });
  const pb = N.paperBounds(ctx.windows.notes.get(id));
  let ok = false;
  for (let k = 0; k < 20 && !ok; k++) {
    ok = await ctx.antics.perform('hero', async () => {
      const { step } = ctx.antics.api;
      await step(B.walk({ toX: R.rect.x + 880, speedMul: 2.8 })); B.setFace('left'); await sl(900);
      R.start(OUT('hero')); await sl(700); R.mark('go');
      await step(B.walk({ toX: pb.x + pb.width + 150, speedMul: 2.6 })); B.setFace('left');
      await step(A.move('squash')); await step(B.leap(pb.x + pb.width * 0.55, pb.y)); R.mark('land'); await sl(500);
      A.say('Chào cậu!', { ttlMs: 2200 }); A.fx('hearts'); A.play('happy'); await step(A.move('hop', 2)); await sl(300);
      await step(A.move('nod', 2)); await sl(300);
      A.say('Cùng làm việc nào~', { ttlMs: 2200 }); A.fx('notes'); await step(A.move('dance', 4)); await sl(300);
      await step(A.move('spin')); A.fx('sparkle'); await sl(1200); R.mark('end'); await sl(800);
    }, { wake: true });
    if (!ok) { try { await R.stop(); } catch (e) { /* bỏ qua */ } await sl(1000); }
  }
  return { r: await R.stop(), marks: R.marks };
}
if (SCENE === 'remind') {
  R.patchBig(); ctx.pet.setSettings({ smartAlert: false, bigAlert: true, quietHours: { on: false, from: '22:00', to: '07:00' }, alertVolume: 0 });
  R.reset(); await sl(600);
  await R.mkNote({ html: '<div>Họp team tuần</div><div>Chuẩn bị slide</div><div>09:00 · phòng họp 2</div>', paper: 'real-kraft', x: 150, y: 230, autoReminder: false });
  await pre(700); await sl(1500);
  R.start(OUT('remind')); await sl(1500); R.mark('call');
  const h = ctx.pet.bigAlert({ kicker: 'Tới giờ rồi!', title: 'Họp team tuần', time: '09:00', level: 3, ms: 9000, body: 'Chuẩn bị slide · phòng họp 2', actions: ['done', 'snooze5', 'snooze10', 'open'] });
  await sl(6200); R.mark('click');
  const aw = BrowserWindow.getAllWindows().find(w => /alert\.html/.test(w.webContents.getURL()));
  if (aw) await aw.webContents.executeJavaScript("document.querySelector('[data-act=done]').click()");
  await Promise.race([h.done, sl(8000)]); R.mark('closed'); await sl(2200);
  return { r: await R.stop(), marks: R.marks };
}
if (SCENE === 'command') {
  { const bx = ctx.antics.box; bx.bin.always = false; bx.bin.x = null; bx.bin.y = null; try { ctx.antics.bin.dismiss(0); } catch (e) { /* bỏ qua */ } }
  R.reset(); await sl(1500);
  const d1 = await R.mkNote({ html: '<div>Gửi báo cáo</div><div>Xong rồi ✓</div>', paper: 'cute-mochi', color: 'pink', x: 110, y: 260, w: 250, h: 180 });
  N.setNoteReminder(d1, { due: Date.now() + 3600000, lead: 0 }); N.completeNote(d1);
  const cw = ctx.windows.notes.get(await R.mkNote({ html: '', paper: 'real-sticky', x: 620, y: 70 }));
  await pre(560); await sl(800);
  R.start(OUT('command')); await sl(1200); R.mark('type');
  await cw.webContents.executeJavaScript("document.getElementById('editor').focus()");
  for (const ch of 'bé ơi, dọn dẹp') { await cw.webContents.executeJavaScript('document.execCommand("insertText",false,' + JSON.stringify(ch) + ')'); await sl(75); }
  R.mark('typed'); await sl(17000); R.mark('end');
  return { r: await R.stop(), marks: R.marks };
}
// đời sống: tea | read | bedtime
R.reset(); await sl(500); await todo(); await pre(560); await sl(800);
R.start(OUT('life_' + SCENE)); await sl(500); R.mark('go');
if (SCENE === 'bedtime') {
  A.say('Khuya rồi, tớ đi ngủ đây. Chúc cậu ngủ ngon!', { ttlMs: 3500 }); A.fx('stars'); await sl(1200);
  for (let k = 0; k < 30 && !ctx.pet.core.brain.isSleeping(); k++) { if (!B.busy()) ctx.pet.core.brain.sleep(); await sl(300); }
  await sl(7000);
} else { let res = false; for (let k = 0; k < 10 && !res; k++) { res = await ctx.antics.trick(SCENE, { wake: true }); if (!res) await sl(500); } await sl(1200); }
R.mark('end');
return { r: await R.stop(), marks: R.marks };
