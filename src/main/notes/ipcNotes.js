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
  // ---- Đợt 2: nhắc theo từng mục (notes2:*). Kiểm tham số, không ném lỗi ra IPC.
  const okId = v => typeof v === 'string' && v.length > 0 && v.length <= 100;
  const okRid = v => v == null || (typeof v === 'string' && v.length <= 100);
  const guard = (ch, fn) => ipcMain.handle(ch, (_e, ...a) => { try { return fn(...a); } catch (e) { console.error('[notes] ' + ch, e); return null; } });
  guard('notes2:setReminderItem', (id, rid, r) => {
    if (!okId(id) || !okRid(rid) || !r || typeof r !== 'object' || !Number.isFinite(Number(r.due))) return null;
    return N.setReminderItem(id, rid || null, r);
  });
  guard('notes2:removeReminderItem', (id, rid) => (okId(id) && okId(rid)) ? N.removeReminderItem(id, rid) : null);
  guard('notes2:doneItem', (id, rid) => (okId(id) && okRid(rid)) ? N.completeNote(id, rid || undefined) : null);
  guard('notes2:snoozeItem', (id, rid, minutes) => {
    const m = Number(minutes);
    if (!okId(id) || !okRid(rid) || !Number.isFinite(m)) return null;
    return N.snoozeNote(id, Math.min(Math.max(Math.round(m), 1), 7 * 24 * 60), rid || undefined);
  });
  ipcMain.handle('win:close', e => {
    for (const [id, w] of noteWins) if (alive(w) && w.webContents === e.sender) { N.hideNote(id); return true; }
    const lw = ctx.windows.list;
    if (alive(lw) && lw.webContents === e.sender) { lw.close(); return true; }
    return false;
  });

  // Đợt 2: hiểu note / gợi ý / ghi nhanh (main.js không nạp riêng nên nạp ở đây)
  require('./insightService.js').init(ctx);
}

module.exports = { init };