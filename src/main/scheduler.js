'use strict';
// Logic thuần (không import electron) cho reminder.
const P = require('../shared/parse.js');

const MIN = 6e4;
const NAG_AFTER = 10 * MIN;   // quá hạn > 10 phút mới nhắc dai
const NAG_EVERY = 15 * MIN;

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Dòng đầu tiên không rỗng, tối đa 80 ký tự. */
function noteTitle(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const l of lines) {
    const t = l.trim();
    if (t) return t.length > 80 ? t.slice(0, 80) : t;
  }
  return '';
}

function mkReminder(due, lead, intent, auto, now) {
  return {
    due, lead, intent, auto,
    preFired: lead > 0 && now >= due - lead,
    fired: false,
    done: false
  };
}

/** Tính lại reminder khi nội dung đổi. prev có thể null. Trả về reminder mới (hoặc prev nếu giữ nguyên). */
function computeReminder(prev, text, now = Date.now()) {
  if (prev && !prev.auto) return prev;           // người dùng đã đặt tay: không đụng
  const a = P.analyze(text, now);
  if (a.due && a.due > now) {
    if (prev && prev.auto && prev.due === a.due) return prev;
    return mkReminder(a.due, a.lead, a.intent, true, now);
  }
  // Giờ trong chữ đã qua nhưng trùng reminder cũ (đang quá hạn) -> giữ để còn nhắc dai.
  if (prev && prev.auto && a.due && prev.due === a.due) return prev;
  return null;
}

/** Cập nhật note.reminder theo text mới. */
function applyText(note, now = Date.now()) {
  note.reminder = computeReminder(note.reminder, note.text, now);
  return note.reminder;
}

/** r = {due, lead} | null. */
function setReminder(note, r, now = Date.now()) {
  if (!r || !Number.isFinite(r.due)) { note.reminder = null; return null; }
  const lead = Number.isFinite(r.lead) && r.lead > 0 ? r.lead : 0;
  note.reminder = mkReminder(r.due, lead, P.intentOf(note.text).k, false, now);
  return note.reminder;
}

function snooze(note, minutes, now = Date.now()) {
  const r = note.reminder;
  if (!r) return false;
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
  r.due = now + m * MIN;
  r.fired = false;
  r.preFired = true;
  r.done = false;
  r.auto = false; // để lần sửa chữ sau không ghi đè giờ đã hoãn
  return true;
}

function markDone(note) {
  if (!note.reminder) return false;
  note.reminder.done = true;
  return true;
}

function overdueNotes(notes, now) {
  return notes.filter(n => n.reminder && !n.reminder.done && n.reminder.fired && now - n.reminder.due > NAG_AFTER)
    .sort((a, b) => a.reminder.due - b.reminder.due);
}

/**
 * Mỗi giây. state = {lastNag:number, busy:boolean}.
 * Trả {events:[{type,noteId,overdueCount?}], changed:boolean, changedIds:string[]}.
 */
function tick(notes, now, state) {
  const events = [];
  const changedIds = [];
  for (const n of notes) {
    const r = n.reminder;
    if (!r || r.done) continue;
    let ch = false;
    if (!r.preFired && r.lead > 0 && now >= r.due - r.lead && now < r.due) {
      r.preFired = true; ch = true;
      events.push({ type: 'pre', noteId: n.id });
    }
    if (!r.fired && now >= r.due) {
      r.preFired = true; r.fired = true; ch = true;
      events.push({ type: 'due', noteId: n.id });
    }
    if (ch) changedIds.push(n.id);
  }
  if (state && !state.busy) {
    const od = overdueNotes(notes, now);
    if (od.length && now - (state.lastNag || 0) >= NAG_EVERY) {
      state.lastNag = now;
      events.push({ type: 'nag', noteId: od[0].id, overdueCount: od.length });
    }
  }
  return { events, changed: changedIds.length > 0, changedIds };
}

module.exports = { htmlToText, noteTitle, computeReminder, applyText, setReminder, snooze, markDone, overdueNotes, tick, NAG_AFTER, NAG_EVERY };
