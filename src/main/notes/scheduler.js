'use strict';
// Logic thuần (không import electron) cho reminder.
const P = require('../../shared/parse.js');

// recur.js do nhân viên khác viết; nạp lười + an toàn để note 0.1 vẫn chạy nếu thiếu.
let _recur;
function recur() {
  if (_recur === undefined) { try { _recur = require('../../shared/recur.js'); } catch (_) { _recur = null; } }
  return _recur;
}
const pad2 = n => String(n).padStart(2, '0');
const hmOf = t => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const isRepeat = r => !!r && typeof r === 'object' && typeof r.freq === 'string';

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

function mkReminder(due, lead, intent, auto, now, repeat) {
  const r = {
    due, lead, intent, auto,
    preFired: lead > 0 && now >= due - lead,
    fired: false,
    done: false
  };
  if (repeat) r.repeat = repeat;
  return r;
}

/** Giờ 'HH:MM' của lịch lặp: lấy từ anchor (bền qua hoãn/khởi động lại), không có thì từ due. */
function timeOfReminder(r) {
  return hmOf(r.repeat && Number.isFinite(r.repeat.anchor) ? r.repeat.anchor : r.due);
}
function sameRule(a, b) {
  if (!a || !b) return false;
  const f = x => JSON.stringify([x.freq, x.interval || 1, x.byDay || null, x.byMonthDay || null]);
  return f(a) === f(b);
}
/** Gắn anchor nếu thiếu (hourly: now; còn lại: lần đầu) để giữ được giờ & mốc interval. */
function withAnchor(repeat, anchor) {
  const o = Object.assign({}, repeat);
  if (!Number.isFinite(o.anchor)) o.anchor = anchor;
  return o;
}

/** Lần kế tiếp của lịch lặp sau afterMs, hoặc null. */
function nextOf(repeat, time, afterMs) {
  const R = recur();
  if (!R || !isRepeat(repeat)) return null;
  try { const t = R.nextOccurrence({ repeat, time }, afterMs); return Number.isFinite(t) ? t : null; } catch (_) { return null; }
}

/** Tính lần lặp kế tiếp > max(now, due); reset fired/preFired/done. Trả true nếu cuộn được. */
function rollRepeat(note, now = Date.now()) {
  const r = note && note.reminder;
  if (!r || !isRepeat(r.repeat)) return false;
  const next = nextOf(r.repeat, timeOfReminder(r), Math.max(now, r.due));
  if (next == null) return false;
  r.due = next;
  r.fired = false;
  r.done = false;
  r.preFired = r.lead > 0 && now >= next - r.lead;
  return true;
}

/** Nhắc lặp từ chữ: {repeat, time} hoặc null. */
function repeatFromText(text, now) {
  const R = recur();
  if (!R) return null;
  let p = null;
  try { p = R.parseRecur(text); } catch (_) { p = null; }
  if (!p || !isRepeat(p.repeat)) return null;
  const rule = withAnchor(p.repeat, p.repeat.freq === 'hourly' ? now : undefined);
  let time = p.time;
  if (!time) { const a = P.analyze(text, now); time = a.timed && a.due ? hmOf(a.due) : '08:00'; }
  const due = nextOf(rule, time, now);
  if (due == null) return null;
  return { repeat: withAnchor(rule, due), due };
}

/** Tính lại reminder khi nội dung đổi. prev có thể null. Trả về reminder mới (hoặc prev nếu giữ nguyên). */
function computeReminder(prev, text, now = Date.now()) {
  if (prev && !prev.auto) return prev;           // người dùng đã đặt tay: không đụng
  const rp = repeatFromText(text, now);
  if (rp) {
    // Giữ nguyên nếu đang là đúng lịch lặp này (mỗi lần gõ chữ không được reset fired/done).
    if (prev && prev.auto && sameRule(prev.repeat, rp.repeat) &&
        nextOf(prev.repeat, timeOfReminder(prev), prev.due - 1) === prev.due) return prev;
    const it = P.intentOf(text);
    return mkReminder(rp.due, P.leadFor(it, rp.due, true, now), it.k, true, now, rp.repeat);
  }
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
  // r.repeat: undefined = giữ lịch lặp hiện có; null = bỏ; object = đặt mới.
  const repeat = r.repeat === undefined ? (note.reminder && note.reminder.repeat) : r.repeat;
  note.reminder = mkReminder(r.due, lead, P.intentOf(note.text).k, false, now,
    isRepeat(repeat) ? withAnchor(repeat, r.due) : null);
  if (!note.reminder.repeat) delete note.reminder.repeat;
  return note.reminder;
}

/** Đặt/huỷ lặp cho note (repeat null = huỷ). Trả true nếu có thay đổi hợp lệ. */
function setRepeat(note, repeat, now = Date.now()) {
  const r = note.reminder;
  if (!repeat) {
    if (!r || !r.repeat) return false;
    delete r.repeat; r.auto = false;
    return true;
  }
  if (!isRepeat(repeat)) return false;
  if (!r) {
    const rule = withAnchor(repeat, now);
    const due = nextOf(rule, '08:00', now);
    if (due == null) return false;
    const it = P.intentOf(note.text);
    note.reminder = mkReminder(due, P.leadFor(it, due, true, now), it.k, false, now,
      repeat.freq === 'hourly' ? rule : withAnchor(repeat, due));
    return true;
  }
  r.repeat = withAnchor(repeat, r.due);
  r.auto = false;
  if (r.done) { if (!rollRepeat(note, now)) delete r.repeat; }
  return true;
}

function snooze(note, minutes, now = Date.now()) {
  const r = note.reminder;
  if (!r) return false;
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
  const prevDue = r.due;
  r.due = now + m * MIN;
  r.fired = false;
  r.preFired = true;
  r.done = false;
  r.auto = false; // để lần sửa chữ sau không ghi đè giờ đã hoãn
  // note lặp: giữ r.repeat (giờ gốc nằm ở repeat.anchor nên lần sau vẫn đúng giờ)
  if (r.repeat && !Number.isFinite(r.repeat.anchor)) r.repeat.anchor = prevDue;
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
    // Nhắc lặp đã báo mà chưa xong: tới lần kế tiếp thì bỏ lần cũ, không nhắc dai chồng chất.
    if (r.repeat && r.fired) {
      const tm = timeOfReminder(r);
      let nx = nextOf(r.repeat, tm, r.due);
      if (nx != null && now >= nx) {
        // nhảy tới mốc MỚI NHẤT <= now (mốc đó chưa được báo nên sẽ phát 'due' đúng 1 lần ngay sau đây)
        for (let i = 0; i < 400; i++) {
          const nn = nextOf(r.repeat, tm, nx);
          if (nn == null || nn > now) break;
          nx = nn;
        }
        r.due = nx; r.fired = false; r.done = false; r.preFired = true; ch = true;
      }
    }
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

module.exports = { htmlToText, noteTitle, computeReminder, applyText, setReminder, snooze, markDone, overdueNotes, tick, rollRepeat, setRepeat, NAG_AFTER, NAG_EVERY };
