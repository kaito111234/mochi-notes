'use strict';
// Kênh IPC của bé: mascot:action, mascot:ignore, mascot:ready, mascot:summon.
const { ipcMain } = require('electron');

function init(ctx) {
  const P = ctx.pet;
  ipcMain.on('mascot:ignore', (e, v) => P._setIgnore(e.sender, v));
  ipcMain.on('mascot:ready', e => P._onReady(e.sender));
  ipcMain.handle('mascot:summon', () => { P.enqueueHello(); return true; });
  ipcMain.handle('mascot:action', (_e, action, noteId) => {
    switch (action) {
      case 'done': return noteId ? ctx.notes.completeNote(noteId) : null;
      case 'snooze': return noteId ? ctx.notes.snoozeNote(noteId, 10) : null;
      case 'open': return noteId && ctx.findNote(noteId) ? ctx.notes.showNote(noteId) : null;
      case 'dismiss': P._dismiss(); return true;
      case 'poke': P._poke(); return true;
      default: return false;
    }
  });
}

module.exports = { init };
