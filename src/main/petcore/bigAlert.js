'use strict';
// "Nhắc to": bé nhảy ra giữa màn hình đang dùng, phóng to và đập bẹp bẹp lên "kính" vài giây.
// Cách làm: cửa sổ overlay RIÊNG (src/alert/*), tạo khi cần và huỷ ngay khi xong (không giữ ảnh phóng to trong RAM).
// Nạp lại đúng gói hình + đồ đang mặc + hướng của bé thật, giải mã khung ở cỡ gốc rồi vẽ phóng to (smoothing 'high').
// API: createBigAlert(core).bigAlert({ title, time, kicker?, ms?, level?, say?, late?, volume? (0..1) }) -> { done: Promise<{reason}>, abort(reason?) }
//   level 1..5 = mức giận (1 ngạc nhiên, 2 hờn, 3 giận đập nhanh, 4 đập hai tay, 5 khóc dỗi); mặc định 1.
//   reason: 'timeout' | 'click' | 'esc' | 'fail' | 'abort' | 'closed'. Promise luôn resolve, không bao giờ reject.
const path = require('path');
const { pathToFileURL } = require('url');
const { BrowserWindow, ipcMain, screen } = require('electron');

const ALLOWED = new Set(['ready', 'loaded', 'end', 'ignore']);
const LOAD_TIMEOUT = 3500;
const levelOf = o => Math.min(5, Math.max(1, Math.round(Number(o && o.level)) || 1));
const msOf = o => Math.max(1500, Number(o && o.ms) || (5500 + 250 * (levelOf(o) - 1)));      // giận hơn thì đập lâu hơn chút
const txt = (v, n) => String(v == null ? '' : v).slice(0, n);      // quá hạn mà renderer chưa nạp xong khung -> bỏ, luồng cũ tiếp tục

function createBigAlert(core) {
  const { ctx } = core;
  let cur = null;               // lượt đang chạy

  function start(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (cur) cur.abort('replaced');
    let resolveDone;
    const done = new Promise(r => { resolveDone = r; });
    const run = { win: null, finished: false, timers: new Set(), fadedPet: false, started: false };
    const after = (ms, fn) => { const t = setTimeout(() => { run.timers.delete(t); fn(); }, ms); run.timers.add(t); };

    function restorePet() {
      if (!run.fadedPet) return;
      run.fadedPet = false;
      try { core.window.cmd({ op: 'fade', to: 1, ms: 220 }); } catch (_) { /* bỏ qua */ }
    }
    function finish(reason) {
      if (run.finished) return;
      run.finished = true;
      for (const t of run.timers) clearTimeout(t);
      run.timers.clear();
      const w = run.win; run.win = null;
      if (cur === run) cur = null;
      if (w && !w.isDestroyed()) { try { w.destroy(); } catch (_) { /* bỏ qua */ } }
      restorePet();
      resolveDone({ reason: reason || 'timeout' });
    }
    run.abort = reason => finish(reason || 'abort');
    cur = run;

    let win;
    try {
      const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const b = disp.bounds;
      win = new BrowserWindow({
        x: b.x, y: b.y, width: b.width, height: b.height, show: false,
        transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
        skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Mochi nhắc to',
        webPreferences: ctx.webPrefs()
      });
      run.win = win; run.bounds = b;
      ctx.hardenWebContents(win);
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setIgnoreMouseEvents(true, { forward: true });
      win.setBounds(b);
      win.on('closed', () => finish('closed'));
      win.webContents.on('render-process-gone', () => finish('fail'));
      win.loadFile(path.join(ctx.paths.src, 'alert/alert.html')).catch(() => finish('fail'));
    } catch (e) {
      console.error('[bigAlert] không tạo được cửa sổ', e && e.message);
      finish('fail');
      return { done, abort() {} };
    }
    run.sender = win.webContents;
    after(LOAD_TIMEOUT, () => { if (!run.started) finish('fail'); });

    run.onMsg = (type, data) => {
      if (run.finished || !run.win) return;
      if (type === 'ready') {
        run.win.webContents.send('alert:cmd', buildInit(run, opts));
      } else if (type === 'loaded') {
        if (run.started) return;
        run.started = true;
        try { run.win.showInactive(); } catch (_) { /* bỏ qua */ }
        try { run.win.setAlwaysOnTop(true, 'screen-saver'); } catch (_) { /* bỏ qua */ }
        // bé thật mờ đi khi bé to nhảy ra (chỉ khi đang hiện)
        try {
          if (core.shown && core.window.win() && core.window.win().isVisible()) { core.window.cmd({ op: 'fade', to: 0, ms: 120 }); run.fadedPet = true; }
        } catch (_) { /* bỏ qua */ }
        run.win.webContents.send('alert:cmd', { op: 'go' });
        const total = msOf(opts);
        after(total + 3500, () => finish('timeout'));      // chốt chặn nếu renderer treo
      } else if (type === 'ignore') {
        try { run.win.setIgnoreMouseEvents(!!(data && data.v), { forward: true }); } catch (_) { /* bỏ qua */ }
      } else if (type === 'end') {
        const r = data && typeof data.reason === 'string' ? data.reason : 'timeout';
        finish(['timeout', 'click', 'esc'].includes(r) ? r : 'timeout');
      }
    };
    return { done, abort: reason => run.abort(reason) };
  }

  function buildInit(run, opts) {
    const pack = core.pack || {};
    const size = Array.isArray(pack.size) ? pack.size : [400, 400];
    const mood = core.curMode || 'normal';
    const idleAnims = pack.anims && pack.anims.idle ? { idle: pack.anims.idle } : {};
    let baseUrl = '';
    try { baseUrl = pathToFileURL(pack.dir).href + '/'; } catch (_) { baseUrl = ''; }
    const b = run.bounds;
    // điểm chân của bé thật (DIP màn hình) -> toạ độ trong cửa sổ; ở màn hình khác thì để renderer tự chọn
    let origin = null, petH = 0;
    try {
      const pos = core.shown ? core.body.pos() : null;
      if (pos && pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) origin = { x: pos.x - b.x, y: pos.y - b.y };
      petH = core.layout ? core.layout.charH : 0;
    } catch (_) { origin = null; }
    let outfit = { items: [], wear: null };
    try { if (typeof core.outfitPayload === 'function') outfit = core.outfitPayload(); } catch (_) { /* bỏ qua */ }
    let sound = true;
    try { sound = ctx.settings().sound !== false; } catch (_) { /* bỏ qua */ }
    // âm lượng 0..1: stage truyền opts.volume (đã tính giờ yên lặng), không thì lấy alertVolume (mặc định 70)
    let volume = 0.7;
    try {
      const av = core.box && core.box.settings ? core.box.settings.alertVolume : undefined;
      if (typeof av === 'number' && isFinite(av)) volume = Math.min(100, Math.max(0, av)) / 100;
    } catch (_) { /* bỏ qua */ }
    if (typeof opts.volume === 'number' && isFinite(opts.volume)) volume = Math.min(1, Math.max(0, opts.volume));
    if (volume <= 0) sound = false;
    return {
      op: 'init',
      pack: { id: pack.id, size, scale: 1, anchor: pack.anchor, faces: {}, anims: idleAnims },
      faces: pack.faces && typeof pack.faces === 'object' ? pack.faces : {},      // ảnh mặt (đường dẫn trong gói), renderer tự đặt đè lên đầu bé
      baseUrl, mood, dir: core.body && core.body.face() === 'left' ? 'left' : 'right',
      outfit: outfit.items, wear: outfit.wear,
      title: txt(opts.title, 120), time: txt(opts.time, 40), kicker: txt(opts.kicker || 'Tới giờ rồi!', 60),
      level: levelOf(opts), say: txt(opts.say, 120), late: txt(opts.late, 60),
      ms: msOf(opts), sound, volume, origin, petH,
      screen: { w: b.width, h: b.height }
    };
  }

  ipcMain.on('alert:msg', (e, type, data) => {
    const run = cur;
    if (!run || run.finished || !run.sender || e.sender !== run.sender) return;
    type = String(type);
    if (!ALLOWED.has(type)) return;
    try { run.onMsg(type, data && typeof data === 'object' ? data : {}); } catch (err) { console.error('[bigAlert]', err && err.message); }
  });

  return { bigAlert: start, abort: reason => { if (cur) cur.abort(reason || 'abort'); }, active: () => !!cur };
}

module.exports = { createBigAlert };
