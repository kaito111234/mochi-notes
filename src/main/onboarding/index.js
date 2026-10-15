'use strict';
// Hướng dẫn lần đầu: cửa sổ nhỏ không viền cạnh bé Mochi, 6 bước. Chỉ tự hiện với người mới (settings.onboarded chưa có
// và dữ liệu chưa có note). Người cũ -> đặt onboarded=true luôn. Mở lại bằng ctx.onboarding.open().
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const W = 440, H = 450, START_DELAY = 2500;

function init(ctx) {
  let win = null, finished = false, timer = null;

  const markDone = () => {
    try { ctx.settings().onboarded = true; if (ctx.store && ctx.store.save) ctx.store.save(); } catch (_) { /* bỏ qua */ }
  };
  const bubble = text => {
    try { const a = ctx.pet && ctx.pet.actor; if (a && typeof a.say === 'function') a.say(text, { ttlMs: 6000 }); } catch (_) { /* bỏ qua */ }
  };

  function shouldShow() {
    const s = ctx.settings() || {};
    if (s.onboarded) return false;
    const st = ctx.store || {};
    const notes = (st.data && st.data.notes) || [];
    if (!st.isFirstRun && notes.length > 0) { markDone(); return false; }   // người dùng cũ: không làm phiền
    return true;
  }

  function place() {
    const prim = screen.getPrimaryDisplay().workArea;
    let wa = prim, x, y;
    try {
      const body = ctx.pet.body, p = body.pos(), sz = body.size();
      wa = screen.getDisplayNearestPoint({ x: Math.round(p.x), y: Math.round(p.y - sz.h / 2) }).workArea;
      const right = p.x + sz.w / 2 + 14, left = p.x - sz.w / 2 - 14 - W;
      if (right + W <= wa.x + wa.width - 4) x = right;
      else if (left >= wa.x + 4) x = left;
      y = Math.round(p.y - sz.h / 2 - H / 2);
    } catch (_) { x = undefined; }
    if (x === undefined) { x = Math.round(wa.x + (wa.width - W) / 2); y = Math.round(wa.y + (wa.height - H) / 2); }
    const width = Math.min(W, wa.width - 8), height = Math.min(H, wa.height - 8);
    x = Math.max(wa.x + 4, Math.min(wa.x + wa.width - width - 4, Math.round(x)));
    y = Math.max(wa.y + 4, Math.min(wa.y + wa.height - height - 4, Math.round(y)));
    return { x, y, width, height };
  }

  function close() {
    const w = win; win = null;
    if (w && ctx.alive(w)) { try { w.destroy(); } catch (_) { /* bỏ qua */ } }
  }

  function open() {
    try {
      if (ctx.alive(win)) { win.show(); win.focus(); return true; }
      finished = false;
      const pos = place();
      const prefs = Object.assign(ctx.webPrefs(), { preload: path.join(__dirname, 'preload.js') });
      win = new BrowserWindow(Object.assign({}, pos, {
        show: false, frame: false, transparent: true, resizable: false, minimizable: false, maximizable: false,
        fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, focusable: true,
        backgroundColor: '#00000000', title: 'Hướng dẫn Mochi Notes', webPreferences: prefs
      }));
      const w = win;
      ctx.hardenWebContents(w);
      w.setAlwaysOnTop(true, 'screen-saver');
      w.on('closed', () => { if (win === w) win = null; if (!finished && !ctx.quitting) markDone(); });
      w.webContents.once('did-finish-load', () => { if (win === w && ctx.alive(w)) { w.show(); w.focus(); } });
      w.webContents.on('did-fail-load', () => { if (win === w) close(); });
      w.loadFile(path.join(ctx.paths.src, 'onboarding/onboarding.html')).catch(e => { console.error('[onboarding]', e && e.message); if (win === w) close(); });
      return true;
    } catch (e) {
      console.error('[onboarding] không mở được', e && e.message);
      close();
      return false;
    }
  }

  // Quyết định có tự hiện không (gọi lúc khởi động). opts.delay: ms chờ bé lên sân khấu.
  function check(opts) {
    if (timer) { clearTimeout(timer); timer = null; }
    let show = false;
    try { show = shouldShow(); } catch (_) { show = false; }
    if (!show) return false;
    const d = opts && typeof opts.delay === 'number' ? opts.delay : START_DELAY;
    if (d <= 0) open(); else timer = setTimeout(() => { timer = null; open(); }, d);
    return true;
  }

  const mine = e => ctx.alive(win) && e.sender === win.webContents;
  ipcMain.on('onboarding:finish', (e, how) => {
    if (!mine(e)) return;
    finished = true;
    markDone();
    close();
    bubble(how === 'skip' ? 'Ok, cần gì cậu cứ gọi tớ nha~' : 'Yay, mình bắt đầu thôi! Có gì cứ ra lệnh cho tớ nha~');
  });
  ipcMain.on('onboarding:close', e => { if (mine(e)) { finished = true; markDone(); close(); } });

  ctx.onboarding = { open, close, check, isOpen: () => ctx.alive(win) };
  if (ctx.bus && typeof ctx.bus.on === 'function') ctx.bus.on('app:startup', () => check());
}

module.exports = { init };
