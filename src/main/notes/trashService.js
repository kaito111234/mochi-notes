'use strict';
// Thùng rác note (xoá mềm) + note hết hạn. Nạp từ cuối init của ipcNotes.js.
// Phần thuần: trashLogic.js, expiry.js. Hợp đồng: docs/rooms/notes/API2.md (Đợt 2B).
const { ipcMain } = require('electron');
const S = require('./scheduler.js');
const T = require('./trashLogic.js');
const X = require('./expiry.js');
const { getBox } = require('../alarms/box.js');

const PURGE_EVERY = 6 * 3600000;
const EXPIRE_EVERY = 5 * 60000;
const EXPIRE_FIRST = 60000;
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function understandText(text, now) {
  try { return require('../../shared/understand/index.js').understand(String(text || ''), now); }
  catch (e) { if (!(e && e.code === 'MODULE_NOT_FOUND')) console.error('[notes] understand', e && e.message); return null; }
}

function init(ctx) {
  const N = ctx.notes;
  const { bus, alive } = ctx;
  const noteWins = ctx.windows.notes;
  const box = () => getBox(ctx);
  const trash = ctx.store.section('trash', () => ({ items: [] }), T.normalize);
  const newId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ens = n => { if (n && typeof S.ensureReminders === 'function') S.ensureReminders(n); return n; };

  const isTrashed = id => trash.items.some(it => it.note.id === id);
  const trashList = () => T.listView(trash.items, S.noteTitle);
  function changed() {
    ctx.store.save();
    ctx.send(ctx.windows.list, 'notes2:trashChanged', trashList());
  }
  function dropMeta(id) {
    const b = box();
    if (typeof id === 'string' && !BAD.has(id) && b.noteMeta && own(b.noteMeta, id)) delete b.noteMeta[id];
  }

  // ---- vào thùng
  function trashNote(id) {
    const notes = ctx.store.data.notes;
    const i = notes.findIndex(n => n.id === id);
    if (i < 0) return false;
    const n = notes[i];
    const w = noteWins.get(id);
    if (alive(w) && !w.isMinimized()) { try { n.bounds = w.getBounds(); } catch (_) { /* bỏ qua */ } }
    N.closeNoteWin(id);
    notes.splice(i, 1);
    trash.items = trash.items.filter(it => it.note.id !== id);
    trash.items.push({ note: n, trashedAt: Date.now() });
    if (trash.items.length > T.MAX_ITEMS) trash.items = T.normalize(trash).items;
    ctx.store.save();
    N.notifyList();
    bus.emit('note:deleted', { id });      // module khác dọn trạng thái (meta được giữ vì isTrashed)
    bus.emit('note:trashed', { noteId: id });
    changed();
    return true;
  }

  function restoreNote(id) {
    const i = trash.items.findIndex(it => it.note.id === id);
    if (i < 0) return null;
    const [item] = trash.items.splice(i, 1);
    const note = item.note;
    const taken = new Set(ctx.store.data.notes.map(n => n.id));
    const oldId = note.id;
    note.id = T.restoreId(oldId, taken, newId);
    if (note.id !== oldId && own(box().noteMeta, oldId)) {
      // meta thuộc về id cũ: chép sang id mới (id cũ đang là của note khác nên không xoá)
      box().noteMeta[note.id] = Object.assign({}, box().noteMeta[oldId]);
    }
    ens(note);
    if (typeof note.visible !== 'boolean') note.visible = true;
    ctx.store.data.notes.push(note);
    ctx.store.save();
    if (note.visible && !ctx.settings().allHidden) N.openNote(note.id, { focus: true });
    N.notifyList();
    bus.emit('note:created', { note });
    bus.emit('note:restored', { noteId: note.id });
    changed();
    return note;
  }

  function purge(id) {
    const before = trash.items.length;
    trash.items = trash.items.filter(it => it.note.id !== id);
    if (trash.items.length === before) return false;
    if (!ctx.findNote(id)) dropMeta(id);
    changed();
    return true;
  }
  function emptyTrash() {
    const ids = trash.items.map(it => it.note.id);
    trash.items = [];
    for (const id of ids) if (!ctx.findNote(id)) dropMeta(id);
    changed();
    return ids.length;
  }
  function purgeExpired(now = Date.now()) {
    const dead = trash.items.filter(it => T.isExpired(it, now));
    if (!dead.length) return 0;
    trash.items = T.keepLive(trash.items, now);
    for (const it of dead) if (!ctx.findNote(it.note.id)) dropMeta(it.note.id);
    changed();
    return dead.length;
  }

  // ---- hết hạn
  function expiredCandidates(now = Date.now()) {
    const out = [];
    for (const n of ctx.store.data.notes) {
      let reason = null;
      try {
        reason = X.expiredReason(n, now, null);
        if (!reason && n.visible && /\S/.test(n.text || '')) reason = X.expiredReason(n, now, understandText(n.text, now));
      } catch (e) { console.error('[notes] expired', e && e.message); }
      if (reason) out.push({ noteId: n.id, reason, title: S.noteTitle(n.text) });
    }
    return out;
  }
  function expireTick() {
    const now = Date.now(), day = X.dayKey(now);
    let dirty = false;
    for (const c of expiredCandidates(now)) {
      if (BAD.has(c.noteId)) continue;
      const nm = box().noteMeta;
      const m = own(nm, c.noteId) && nm[c.noteId] ? nm[c.noteId] : null;
      if (m && m.expiredDay === day) continue;
      if (m) m.expiredDay = day; else nm[c.noteId] = { expiredDay: day };
      dirty = true;
      bus.emit('note:expired', { noteId: c.noteId, reason: c.reason });
    }
    if (dirty) ctx.store.save();
  }

  // ---- gắn vào ctx.notes
  Object.assign(N, {
    trash: trashNote, restore: restoreNote, purge, emptyTrash, trashList, isTrashed, expiredCandidates
  });
  // xoá hẳn (đường cũ), dùng nội bộ khi cần
  const hardDelete = N.deleteNote;
  N.deleteNotePermanently = id => { const ok = hardDelete(id); if (ok) dropMeta(id); return ok; };
  N.deleteNote = id => trashNote(id);

  // ---- IPC
  const okId = v => typeof v === 'string' && v.length > 0 && v.length <= 100;
  const guard = (ch, fn) => ipcMain.handle(ch, (_e, ...a) => { try { return fn(...a); } catch (e) { console.error('[notes] ' + ch, e); return null; } });
  guard('notes2:trashList', () => trashList());
  guard('notes2:trashRestore', id => (okId(id) ? restoreNote(id) : null));
  guard('notes2:trashPurge', id => (okId(id) ? purge(id) : false));
  guard('notes2:trashEmpty', () => emptyTrash());
  guard('notes2:expired', () => expiredCandidates());

  // ---- lịch chạy
  const unref = t => { if (t && t.unref) t.unref(); return t; };
  bus.once('app:startup', () => {
    setTimeout(() => { try { purgeExpired(); } catch (e) { console.error('[notes] purge', e); } }, 0);
    unref(setInterval(() => { try { purgeExpired(); } catch (e) { console.error('[notes] purge', e); } }, PURGE_EVERY));
    unref(setTimeout(() => { try { expireTick(); } catch (e) { console.error('[notes] expire', e); } }, EXPIRE_FIRST));
    unref(setInterval(() => { try { expireTick(); } catch (e) { console.error('[notes] expire', e); } }, EXPIRE_EVERY));
    if (process.env.MOCHI_DEV_TRASH) {
      unref(setTimeout(() => {
        const n = ctx.store.data.notes[0];
        console.log('[notes] dev trash', n ? n.id : '(không có note)', n ? trashNote(n.id) : false, 'thùng:', trash.items.length);
      }, 5000));
    }
  });
}

module.exports = { init };
