'use strict';
// Cửa sổ cài đặt bé Mochi (một bản duy nhất). Xem docs/rooms/core/ARCH.md mục M.
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

const BOOLS = ['alwaysVisible', 'walkEnabled', 'climbEnabled', 'followCursor', 'tidyEnabled', 'autoTidy', 'knockEnabled'];

function createSettingsWindow(core) {
  const ctx = core.ctx;
  let win = null;

  const fromMine = e => !!win && !win.isDestroyed() && e.sender === win.webContents;
  const snapshot = () => Object.assign({}, core.box.settings);

  ipcMain.handle('pet:getSettings', e => (fromMine(e) ? snapshot() : null));
  ipcMain.handle('pet:setSettings', (e, patch) => {
    if (!fromMine(e)) return null;
    const clean = {};
    if (patch && typeof patch === 'object') {
      for (const k of BOOLS) if (typeof patch[k] === 'boolean') clean[k] = patch[k];
      if (typeof patch.scale === 'number' && isFinite(patch.scale)) clean.scale = Math.min(2, Math.max(0.5, patch.scale));
    }
    try { ctx.pet.setSettings(clean); } catch (err) { console.error('[petcore] setSettings:', err && err.message); }
    try { if (ctx.tray && ctx.tray.rebuild) ctx.tray.rebuild(); } catch (_) { /* bỏ qua */ }
    return snapshot();
  });

  function open() {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return;
    }
    win = new BrowserWindow({
      width: 360, height: 660, useContentSize: true,
      resizable: false, maximizable: false, minimizable: true, fullscreenable: false,
      autoHideMenuBar: true, title: 'Cài đặt bé Mochi',
      backgroundColor: '#fff6ee',
      webPreferences: ctx.webPrefs()
    });
    win.setMenuBarVisibility(false);
    try { win.removeMenu(); } catch (_) { /* bỏ qua */ }
    ctx.hardenWebContents(win);
    win.on('closed', () => { win = null; });
    win.loadFile(path.join(ctx.paths.src, 'pet/settings.html'));
  }

  return { open };
}

module.exports = { createSettingsWindow };
