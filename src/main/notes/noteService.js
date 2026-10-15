'use strict';
// Nghiệp vụ note: create/update/delete/show/hide/hideAll/showAll/seed; áp reminder qua scheduler.js.
const { screen } = require('electron');
const S = require('./scheduler.js');
const { COLORS: COLOR_LIST } = require('../store.js');

function init(ctx) {
  const { bus, alive } = ctx;
  const noteWins = ctx.windows.notes;
  const store = () => ctx.store;
  const settings = () => ctx.settings();
  const newId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---- thông báo thay đổi dữ liệu
  let listTimer = null;
  function notifyList() {
    if (listTimer) return;
    listTimer = setTimeout(() => {
      listTimer = null;
      ctx.send(ctx.windows.list, 'notes:changed', store().data.notes);
    }, 60);
  }
  /** skipWC: webContents không cần nhận lại (người vừa gõ). */
  function noteChanged(n, skipWC) {
    const w = noteWins.get(n.id);
    if (alive(w) && w.webContents !== skipWC) ctx.send(w, 'note:updated', n);
    notifyList();
    bus.emit('note:updated', { note: n });
  }
  function broadcastSettings() {
    const s = Object.assign({}, settings());
    const { BrowserWindow } = require('electron');
    for (const w of BrowserWindow.getAllWindows()) ctx.send(w, 'settings:changed', s);
    bus.emit('settings:changed', { settings: s });
  }

  // ---- nghiệp vụ
  function makeNote(o) {
    const now = Date.now();
    const html = o.html || '';
    const text = o.text != null ? o.text : S.htmlToText(html);
    const n = {
      id: newId(), html, text,
      color: COLOR_LIST.includes(o.color) ? o.color : 'yellow',
      bounds: o.bounds || ctx.notes.newNoteBounds(o.nearId),
      visible: true, alwaysOnTop: false, reminder: null,
      createdAt: now, updatedAt: now
    };
    if (o.autoReminder !== false) S.applyText(n, now);
    return n;
  }
  function createNote(opts = {}) {
    const n = makeNote(opts);
    store().data.notes.push(n);
    store().save();
    if (settings().allHidden) {
      settings().allHidden = false; store().save(); broadcastSettings(); ctx.tray.rebuild(); ctx.notes.openAllVisible(true);
    }
    ctx.notes.openNote(n.id, { focus: true });
    notifyList();
    bus.emit('note:created', { note: n });
    return n;
  }
  /** patch: {html?, text?, color?}. e: sự kiện IPC (để không gửi lại cho người đang gõ). */
  function updateNote(id, patch, senderWC) {
    const n = ctx.findNote(id);
    if (!n || !patch || typeof patch !== 'object') return n;
    const now = Date.now();
    let textChanged = false;
    if (typeof patch.html === 'string') {
      n.html = patch.html;
      if (typeof patch.text !== 'string') { n.text = S.htmlToText(patch.html); textChanged = true; }
    }
    if (typeof patch.text === 'string') { n.text = patch.text; textChanged = true; }
    let colorChanged = false;
    if (COLOR_LIST.includes(patch.color) && patch.color !== n.color) {
      n.color = patch.color; colorChanged = true;
      const w = noteWins.get(id);
      if (alive(w) && !ctx.useGlass()) { try { w.setBackgroundColor(ctx.COLOR_BG[n.color]); } catch (_) { /* bỏ qua */ } }
    }
    if (textChanged) S.applyText(n, now);
    n.updatedAt = now;
    store().save();
    // Người đang gõ không cần nhận lại chính nội dung của mình (tránh nhảy con trỏ).
    noteChanged(n, textChanged && !colorChanged ? senderWC : null);
    return n;
  }
  function showNote(id) {
    const n = ctx.findNote(id);
    if (!n) return null;
    n.visible = true;
    store().save();
    ctx.notes.openNote(id, { focus: true });
    noteChanged(n);
    return n;
  }
  function hideNote(id) {
    const n = ctx.findNote(id);
    if (!n) return null;
    const w = noteWins.get(id);
    if (alive(w) && !w.isMinimized()) n.bounds = w.getBounds();
    n.visible = false;
    ctx.notes.closeNoteWin(id);
    store().save();
    noteChanged(n);
    return n;
  }
  function deleteNote(id) {
    const i = store().data.notes.findIndex(n => n.id === id);
    if (i < 0) return false;
    ctx.notes.closeNoteWin(id);
    store().data.notes.splice(i, 1);
    store().save();
    notifyList();
    bus.emit('note:deleted', { id });
    return true;
  }
  function hideAll() {
    settings().allHidden = true;
    for (const id of Array.from(noteWins.keys())) {
      const w = noteWins.get(id), n = ctx.findNote(id);
      if (alive(w) && n && !w.isMinimized()) n.bounds = w.getBounds();
      ctx.notes.closeNoteWin(id);
    }
    store().save(); broadcastSettings(); ctx.tray.rebuild();
  }
  function showAll() {
    settings().allHidden = false;
    // Nếu chẳng note nào đang dán thì "Hiện tất cả" thật sự hiện tất cả.
    if (!store().data.notes.some(n => n.visible)) for (const n of store().data.notes) n.visible = true;
    store().save(); broadcastSettings(); ctx.tray.rebuild();
    ctx.notes.openAllVisible(false);
    notifyList();
  }
  function toggleAll() {
    if (settings().allHidden || noteWins.size === 0) showAll(); else hideAll();
  }

  // ---- reminder
  function setNoteReminder(id, r) {
    const n = ctx.findNote(id);
    if (!n) return null;
    S.setReminder(n, r && typeof r === 'object' ? { due: Number(r.due), lead: Number(r.lead), repeat: r.repeat } : null, Date.now());
    n.updatedAt = Date.now();
    store().save(); noteChanged(n);
    return n;
  }
  function completeNote(id) {
    const n = ctx.findNote(id);
    if (!n) return n;
    const now = Date.now(), r = n.reminder;
    const wasDone = !!(r && r.done);
    // đúng hạn = chưa quá hạn tới mức bị nhắc dai
    const onTime = !!r && !(r.fired && now - r.due > S.NAG_AFTER);
    if (S.markDone(n)) {
      if (r.repeat && !wasDone) {
        // note lặp: báo xong lần này rồi chuyển sang lần kế (không ở trạng thái done vĩnh viễn)
        bus.emit('reminder:done', { noteId: id, onTime });
        S.rollRepeat(n, now);
        n.updatedAt = now; store().save(); noteChanged(n);
        return n;
      }
      n.updatedAt = now; store().save(); noteChanged(n);
      if (!wasDone) bus.emit('reminder:done', { noteId: id, onTime });
    }
    return n;
  }
  function snoozeNote(id, minutes) {
    const n = ctx.findNote(id);
    const m = Number(minutes) || 10;
    if (n && S.snooze(n, m)) {
      n.updatedAt = Date.now(); store().save(); noteChanged(n);
      bus.emit('reminder:snoozed', { noteId: id, minutes: m });
    }
    return n;
  }

  function seed() {
    const a = screen.getPrimaryDisplay().workArea;
    const fit = ctx.notes.fitBounds;
    const guide =
      '<div><b>Chào bạn, mình là Mochi Notes!</b></div><div><br></div>' +
      '<div>Phím tắt dùng được mọi lúc:</div>' +
      '<ul><li>Ctrl+Alt+N: tạo note mới</li><li>Ctrl+Alt+H: ẩn/hiện tất cả note</li>' +
      '<li>Ctrl+Alt+L: mở danh sách note</li><li>Ctrl+Alt+M: gọi bé Mochi ra</li></ul>' +
      '<div><br></div><div>Cứ gõ giờ tự nhiên như "họp 3h chiều nay", bé Mochi sẽ tự hiện ra nhắc bạn.</div>';
    const n1 = makeNote({ html: guide, color: 'yellow', autoReminder: false, bounds: fit({ x: a.x + a.width - 340, y: a.y + 60, width: 300, height: 340 }) });
    const n2 = makeNote({ html: '<div>Uống nước nè, 1 phút nữa</div>', color: 'pink', bounds: fit({ x: a.x + a.width - 660, y: a.y + 60, width: 300, height: 200 }) });
    store().data.notes.push(n1, n2);
    store().save();
  }

  Object.assign(ctx.notes, {
    notifyList, noteChanged, broadcastSettings, makeNote,
    createNote, updateNote, showNote, hideNote, deleteNote, hideAll, showAll, toggleAll,
    setNoteReminder, completeNote, snoozeNote, seed
  });
}

module.exports = { init };
