'use strict';
// Bé dọn note hết hạn: mang tờ giấy, vo, ném vào thùng rác dễ thương. Xem docs/rooms/core/ARCH.md mục T (Đợt 2B).
// Không bao giờ xoá hẳn: chỉ ctx.notes.trash (khôi phục được trong thùng rác).
// Gỡ lỗi: MOCHI_TIDY_DEMO=<ms> -> sau ms gọi carryAway với note đang hiện đầu tiên.
const path = require('path');
const { BrowserWindow, screen } = require('electron');

const BIN_W = 96, BIN_H = 110, PAPER = 120;
const ASK_GAP = 10 * 60000, QUEUE_MAX = 3, FRAME = 33;

function createTidy(core) {
  const ctx = core.ctx;
  const timers = new Set();
  const wins = new Set();
  let busy = false, stopped = false;
  let lastAsk = 0, queue = [], drain = null;

  const settings = () => { try { return (core.box && core.box.settings) || {}; } catch (_) { return {}; } };
  const enabled = () => settings().tidyEnabled !== false;
  const autoTidy = () => settings().autoTidy === true;
  const fn = (o, k) => !!o && typeof o[k] === 'function';

  function sleep(ms) {
    return new Promise(res => { const t = setTimeout(() => { timers.delete(t); res(); }, ms); timers.add(t); });
  }
  /** Chạy fn(t 0..1) ~30fps trong ms rồi resolve; chỉ sống trong lúc mang/ném. */
  function anim(ms, step) {
    return new Promise(res => {
      const t0 = Date.now();
      const id = setInterval(() => {
        const t = Math.min(1, (Date.now() - t0) / ms);
        try { step(t); } catch (_) { /* bỏ qua */ }
        if (t >= 1 || stopped) { clearInterval(id); timers.delete(id); res(); }
      }, FRAME);
      timers.add(id);
    });
  }
  const withTimeout = (p, ms, dflt) => Promise.race([Promise.resolve(p).catch(() => dflt), sleep(ms).then(() => dflt)]);

  function mkWin(file, w, h, x, y) {
    const win = new BrowserWindow({
      show: false, frame: false, transparent: true, hasShadow: false,
      resizable: false, movable: false, minimizable: false, maximizable: false,
      focusable: false, skipTaskbar: true, fullscreenable: false,
      x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h),
      webPreferences: ctx.webPrefs()
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setIgnoreMouseEvents(true);
    ctx.hardenWebContents(win);
    wins.add(win);
    win.on('closed', () => wins.delete(win));
    const loaded = new Promise(res => win.webContents.once('did-finish-load', () => res(true)));
    win.loadFile(path.join(ctx.paths.src, 'pet', file)).catch(() => {});
    return { win, ready: withTimeout(loaded, 3000, false) };
  }
  const alive = w => !!w && !w.isDestroyed() && !w.webContents.isDestroyed();
  const js = (w, code) => (alive(w) ? withTimeout(w.webContents.executeJavaScript(code, false), 1500, null) : Promise.resolve(null));
  function closeWin(w) { try { if (w && !w.isDestroyed()) w.destroy(); } catch (_) { /* bỏ qua */ } wins.delete(w); }
  function place(w, x, y, wd, ht) { if (alive(w)) { try { w.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(wd), height: Math.round(ht) }); } catch (_) { /* bỏ qua */ } } }

  // ----- thùng rác
  let lastBin = null;
  function workAreaNearPet() {
    let p = null;
    try { p = fn(core.body, 'pos') ? core.body.pos() : null; } catch (_) { p = null; }
    const d = p ? screen.getDisplayNearestPoint({ x: Math.round(p.x), y: Math.round(p.y - 2) }) : screen.getPrimaryDisplay();
    return { wa: d.workArea, p };
  }
  function planBin(noteB) {
    const { wa, p } = workAreaNearPet();
    const mid = wa.x + wa.width / 2;
    // phía GẦN bé hơn (bé đi chậm, ~60px/s: đi xuyên màn hình mất cả chục giây); chừa lề ~170px để né chuông góc dưới phải
    const petLeft = p ? p.x < mid : true;
    let x = petLeft ? wa.x + 40 : wa.x + wa.width - BIN_W - 170;
    if (noteB && x < noteB.x + noteB.width && x + BIN_W > noteB.x && noteB.y + noteB.height > wa.y + wa.height - BIN_H) {
      x = petLeft ? wa.x + wa.width - BIN_W - 170 : wa.x + 40;   // đè lên note thì đổi bên
    }
    x = Math.max(wa.x, Math.min(wa.x + wa.width - BIN_W, x));
    lastBin = { x: Math.round(x), y: Math.round(wa.y + wa.height - BIN_H), width: BIN_W, height: BIN_H };
    return lastBin;
  }
  function binRect() { return lastBin ? Object.assign({}, lastBin) : planBin(null); }

  function handPoint() {
    let h = null;
    try { h = fn(core.body, 'handScreen') ? core.body.handScreen() : null; } catch (_) { h = null; }
    if (h && isFinite(h.x) && isFinite(h.y)) return h;
    try {
      const p = fn(core.body, 'pos') ? core.body.pos() : null;
      if (p) return { x: p.x + 20, y: p.y - 70 };
    } catch (_) { /* bỏ qua */ }
    return null;
  }

  /** Dọn note vào thùng rác bằng màn diễn. Trả true nếu note đã vào thùng rác. */
  async function carryAway(noteId) {
    if (busy || stopped || typeof noteId !== 'string') return false;
    const nw = ctx.windows.notes.get(noteId);
    if (!fn(ctx.notes, 'trash')) return false;
    busy = true;
    let paper = null, bin = null, trashed = false;
    const actor = ctx.pet && ctx.pet.actor;
    const play = (a, o) => { try { return fn(actor, 'play') ? withTimeout(actor.play(a, o), 5000, null) : Promise.resolve(null); } catch (_) { return Promise.resolve(null); } };
    try {
      // không có cửa sổ note: chỉ cần chuyển vào thùng rác, không diễn
      if (!ctx.alive(nw) || !nw.isVisible() || nw.isMinimized()) {
        trashed = !!ctx.notes.trash(noteId);
        return trashed;
      }
      const nb = nw.getBounds();
      // (1) chụp note
      let url = null;
      try {
        const img = await withTimeout(nw.webContents.capturePage(), 2500, null);
        if (img && !img.isEmpty()) {
          const s = img.getSize();
          const k = Math.min(1, 360 / Math.max(s.width, s.height, 1));
          url = (k < 1 ? img.resize({ width: Math.max(1, Math.round(s.width * k)), height: Math.max(1, Math.round(s.height * k)), quality: 'good' }) : img).toDataURL();
        }
      } catch (_) { url = null; }
      // (2) cửa sổ giấy đè đúng note
      try {
        const pw = mkWin('crumple.html', nb.width, nb.height, nb.x, nb.y);
        paper = pw.win;
        if (await pw.ready && url) await js(paper, 'window.setPaper(' + JSON.stringify(url) + ')');
        if (alive(paper) && url) paper.showInactive();   // không có ảnh thì thôi không diễn giấy
        else { closeWin(paper); paper = null; }
      } catch (e) { closeWin(paper); paper = null; }
      // (3) vào thùng rác (không bao giờ xoá hẳn)
      trashed = !!ctx.notes.trash(noteId);
      if (!trashed) { closeWin(paper); paper = null; return false; }
      if (!paper || stopped) return true;
      // (4) thùng rác
      const br = planBin(nb);
      try {
        const bw = mkWin('bin.html', BIN_W, BIN_H, br.x, br.y);
        bin = bw.win;
        await bw.ready;
        if (alive(bin)) bin.showInactive();
      } catch (_) { closeWin(bin); bin = null; }
      // (5) giấy co nhỏ về tay, bé mang tới thùng
      const h0 = handPoint() || { x: nb.x + nb.width / 2, y: nb.y + nb.height / 2 };
      const c0 = { x: nb.x + nb.width / 2, y: nb.y + nb.height / 2, w: nb.width, h: nb.height };
      await anim(350, t => {
        const e = t * t * (3 - 2 * t), hp = handPoint() || h0;
        const w = c0.w + (PAPER - c0.w) * e, h = c0.h + (PAPER - c0.h) * e;
        place(paper, c0.x + (hp.x - c0.x) * e - w / 2, c0.y + (hp.y - c0.y) * e - h / 2, w, h);
      });
      js(paper, 'window.carry()');
      play('carry_note', { loop: true });
      let walking = true;
      const follow = setInterval(() => {
        const hp = walking ? handPoint() : null;
        if (hp) place(paper, hp.x - PAPER / 2, hp.y - PAPER / 2, PAPER, PAPER);
      }, FRAME);
      timers.add(follow);
      try {
        const px = (core.body && fn(core.body, 'pos') && core.body.pos()) || null;
        const prefer = px && px.x > br.x + BIN_W / 2 ? 'right' : 'left';
        if (fn(core.body, 'goToRect')) await withTimeout(core.body.goToRect(br, { prefer }), 22000, null);
      } catch (_) { /* vẫn ném */ }
      walking = false;
      clearInterval(follow); timers.delete(follow);
      // (6) vo giấy
      js(paper, 'window.crumple()');
      await play('crumple');
      await anim(250, () => { const hp = handPoint(); if (hp) place(paper, hp.x - PAPER / 2, hp.y - PAPER / 2, PAPER, PAPER); });
      // (7) ném vào miệng thùng
      js(paper, 'window.fly()');
      play('throw');
      const s = handPoint() || h0, mouth = { x: br.x + BIN_W / 2, y: br.y + 18 };
      await anim(650, t => {
        const x = s.x + (mouth.x - s.x) * t, y = s.y + (mouth.y - s.y) * t - 90 * Math.sin(Math.PI * t);
        place(paper, x - PAPER / 2, y - PAPER / 2, PAPER, PAPER);
      });
      if (alive(paper)) paper.hide();
      js(bin, 'window.bump()');
      // (8) dọn sạch
      await sleep(1200);
    } catch (e) {
      console.error('[tidy]', e && e.message);
    } finally {
      closeWin(paper); closeWin(bin);
      for (const t of timers) { clearTimeout(t); clearInterval(t); }   // không để anim dở dang sau khi xong
      timers.clear();
      lastBin = null;
      busy = false;
      try { if (fn(actor, 'play') && !stopped) actor.play('idle', { loop: true }); } catch (_) { /* bỏ qua */ }
    }
    return trashed;
  }

  // ----- nghe note:expired
  function visibleNote(id) {
    const w = ctx.windows.notes.get(id);
    return ctx.alive(w) && w.isVisible() && !w.isMinimized();
  }
  function request(it) {
    const stage = ctx.pet && ctx.pet.stage;
    if (!fn(stage, 'request') || !visibleNote(it.noteId)) return false;
    const auto = autoTidy() && it.reason === 'done';
    try {
      stage.request({ kind: 'tidy', priority: 35, payload: { noteId: it.noteId, reason: it.reason, title: it.title || '', auto }, ttlMs: 30 * 60000 });
      return true;
    } catch (e) { console.error('[tidy] request', e && e.message); return false; }
  }
  function pump() {
    if (drain || stopped) return;
    if (!queue.length) return;
    const wait = Math.max(1000, lastAsk + ASK_GAP - Date.now());
    drain = setTimeout(() => {
      drain = null;
      if (stopped) return;
      while (queue.length) {
        const it = queue.shift();
        if (enabled() && request(it)) { lastAsk = Date.now(); break; }
      }
      pump();
    }, wait);
    if (drain.unref) drain.unref();
  }
  function onExpired(e) {
    if (stopped || !e || typeof e.noteId !== 'string' || !enabled() || !visibleNote(e.noteId)) return;
    let title = '';
    try {
      const n = ctx.findNote(e.noteId);
      const line = String((n && n.text) || '').split(/\r?\n/).find(l => /\S/.test(l)) || '';
      title = line.replace(/^\s*(?:[-*•☐☑✓✔]|\[[ xX]\])\s*/, '').trim().slice(0, 80);
    } catch (_) { /* bỏ qua */ }
    const it = { noteId: e.noteId, reason: e.reason, title };
    if (queue.some(q => q.noteId === it.noteId)) return;
    if (Date.now() - lastAsk >= ASK_GAP && !queue.length) {
      if (request(it)) lastAsk = Date.now();
    } else if (queue.length < QUEUE_MAX) {
      queue.push(it);
      pump();
    }
  }
  ctx.bus.on('note:expired', onExpired);

  function stop() {
    stopped = true;
    ctx.bus.off('note:expired', onExpired);
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers.clear();
    if (drain) { clearTimeout(drain); drain = null; }
    queue = [];
    for (const w of Array.from(wins)) closeWin(w);
  }

  const demo = Number(process.env.MOCHI_TIDY_DEMO);
  if (demo > 0) {
    const t = setTimeout(() => {
      const id = ctx.windows.notes.keys().next().value;
      console.log('[tidy] demo carryAway', id);
      if (id) carryAway(id).then(ok => console.log('[tidy] demo xong', ok));
    }, demo);
    timers.add(t);
  }

  return { carryAway, binRect, stop };
}

module.exports = { createTidy };
