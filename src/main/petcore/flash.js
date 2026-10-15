'use strict';
// Viền nháy hồng quanh cửa sổ note khi bé chỉ vào. Xem docs/rooms/core/ARCH.md mục M.
const path = require('path');
const { BrowserWindow } = require('electron');

const PAD = 6;

function createFlash(core) {
  const ctx = core.ctx;
  let win = null, loaded = false;
  let noteId = null, until = 0, timer = null;

  function ensure() {
    if (win && !win.isDestroyed()) return win;
    loaded = false;
    win = new BrowserWindow({
      show: false, frame: false, transparent: true, hasShadow: false,
      resizable: false, movable: false, minimizable: false, maximizable: false,
      focusable: false, skipTaskbar: true, fullscreenable: false,
      width: 100, height: 100,
      webPreferences: ctx.webPrefs()
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setIgnoreMouseEvents(true);
    ctx.hardenWebContents(win);
    win.on('closed', () => { win = null; stopTimer(); });
    win.webContents.once('did-finish-load', () => { loaded = true; });
    win.loadFile(path.join(ctx.paths.src, 'pet/flash.html'));
    return win;
  }

  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function noteWin() {
    const w = noteId != null ? ctx.windows.notes.get(noteId) : null;
    return ctx.alive(w) && w.isVisible() && !w.isMinimized() ? w : null;
  }

  function follow() {
    const w = noteWin();
    if (!w || Date.now() >= until || !win || win.isDestroyed()) { stop(); return; }
    const b = w.getBounds();
    const want = { x: b.x - PAD, y: b.y - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 };
    const cur = win.getBounds();
    if (cur.x !== want.x || cur.y !== want.y || cur.width !== want.width || cur.height !== want.height) win.setBounds(want);
  }

  function flash(id, ms = 4000) {
    const w = ctx.windows.notes.get(id);
    if (!ctx.alive(w) || !w.isVisible() || w.isMinimized()) return false;
    const dur = ms > 0 ? ms : 4000;
    noteId = id;
    until = Date.now() + dur;
    const f = ensure();
    follow();
    if (!f.isDestroyed() && !f.isVisible()) f.showInactive();
    if (!f.isDestroyed()) f.setAlwaysOnTop(true, 'floating');
    if (!timer) timer = setInterval(follow, 250);
    return true;
  }

  function stop() {
    stopTimer();
    noteId = null;
    until = 0;
    if (win && !win.isDestroyed() && win.isVisible()) win.hide();
  }

  return { flash, stop };
}

module.exports = { createFlash };
