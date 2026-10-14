'use strict';
// Kênh IPC: note:*, notes:*, list:open, settings:get/set, win:close.
const { app, ipcMain } = require('electron');
const { DEFAULT_SETTINGS } = require('../store.js');

function init(ctx) {
  const noteWins = ctx.windows.notes;
  const { alive } = ctx;
  const settings = () => ctx.settings();

  function applySettings(patch) {
    const prev = Object.assign({}, settings());
    const s = settings();
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof patch[k] === 'boolean') s[k] = patch[k];
    ctx.store.save();
    if (s.startup !== prev.startup) {
      try { app.setLoginItemSettings({ openAtLogin: !!s.startup }); } catch (_) { /* bỏ qua */ }
    }
    if (s.glass !== prev.glass) {
      const ids = Array.from(noteWins.keys());
      for (const id of ids) ctx.notes.closeNoteWin(id);
      for (const id of ids) ctx.notes.openNote(id, { focus: false });
      const lw = ctx.windows.list;
      if (alive(lw) && typeof lw.setBackgroundMaterial === 'function' && process.platform === 'win32') {
        try { lw.setBackgroundMaterial(s.glass ? 'acrylic' : 'none'); } catch (_) { /* bỏ qua */ }
      }
    }
    ctx.notes.broadcastSettings();
    ctx.tray.rebuild();
    if (s.mascotIdle !== prev.mascotIdle || s.mascotEnabled !== prev.mascotEnabled) ctx.pet.syncIdle();
    return Object.assign({}, s);
  }
  ctx.notes.applySettings = applySettings;

  const N = ctx.notes;
  ipcMain.handle('note:get', (_e, id) => ctx.findNote(id));
  ipcMain.handle('note:list', () => ctx.store.data.notes);
  ipcMain.handle('note:create', (_e, opts) => N.createNote(opts && typeof opts === 'object' ? opts : {}));
  ipcMain.handle('note:update', (e, id, patch) => N.updateNote(id, patch, e.sender));
  ipcMain.handle('note:delete', (_e, id) => N.deleteNote(id));
  ipcMain.handle('note:show', (_e, id) => N.showNote(id));
  ipcMain.handle('note:hide', (_e, id) => N.hideNote(id));
  ipcMain.handle('note:top', (_e, id, v) => {
    const n = ctx.findNote(id);
    if (!n) return null;
    n.alwaysOnTop = !!v;
    const w = noteWins.get(id);
    if (alive(w)) w.setAlwaysOnTop(!!v);
    ctx.store.save(); N.noteChanged(n);
    return n;
  });
  ipcMain.handle('note:reminder', (_e, id, r) => N.setNoteReminder(id, r));
  ipcMain.handle('note:done', (_e, id) => N.completeNote(id));
  ipcMain.handle('note:snooze', (_e, id, minutes) => N.snoozeNote(id, minutes));
  ipcMain.handle('notes:hideAll', () => { N.hideAll(); return true; });
  ipcMain.handle('notes:showAll', () => { N.showAll(); return true; });
  ipcMain.handle('list:open', () => { ctx.list.open(); return true; });
  ipcMain.handle('settings:get', () => Object.assign({}, settings()));
  ipcMain.handle('settings:set', (_e, patch) => applySettings(patch && typeof patch === 'object' ? patch : {}));
  ipcMain.handle('win:close', e => {
    for (const [id, w] of noteWins) if (alive(w) && w.webContents === e.sender) { N.hideNote(id); return true; }
    const lw = ctx.windows.list;
    if (alive(lw) && lw.webContents === e.sender) { lw.close(); return true; }
    return false;
  });
}

module.exports = { init };
