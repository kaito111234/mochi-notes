'use strict';
// Kênh IPC cũ của bé (0.1) giữ lại để không gãy: mascot:action, mascot:ignore, mascot:ready, mascot:summon.
// Cửa sổ bé mới dùng kênh 'pet:*' do petcore đăng ký (không đăng ký ở đây).
const { ipcMain } = require('electron');

function init(ctx) {
  ipcMain.on('mascot:ignore', () => { /* no-op: cửa sổ cũ không còn mở */ });
  ipcMain.on('mascot:ready', () => { /* no-op */ });
  ipcMain.handle('mascot:summon', () => { ctx.pet.enqueueHello(); return true; });
  ipcMain.handle('mascot:action', (_e, action, noteId) => {
    switch (action) {
      case 'done': return noteId ? ctx.notes.completeNote(noteId) : null;
      case 'snooze': return noteId ? ctx.notes.snoozeNote(noteId, 10) : null;
      case 'open': return noteId && ctx.findNote(noteId) ? ctx.notes.showNote(noteId) : null;
      case 'dismiss': case 'poke': return true;
      default: return false;
    }
  });
}

module.exports = { init };
