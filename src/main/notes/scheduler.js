'use strict';
// Logic thuần (không import electron) cho nhắc lịch. Một note có nhiều nhắc: Note.reminders (nguồn sự thật),
// Note.reminder = primary (cùng tham chiếu object). Xem docs/rooms/notes/API2.md mục 3.
const P = require('../../shared/parse.js');
const RM = require('./reminders.js');

// recur.js do nhân viên khác viết; nạp lười + an toàn để note 0.1 vẫn chạy nếu thiếu.
let _recur;
function recur() {
  if (_recur === undefined) { try { _recur = require('../../shared/recur.js'); } catch (_) { _recur = null; } }
  return _recur;
}
// understand/ cũng do nhân viên khác viết; nạp lười, thiếu/lỗi -> hành vi 0.1 (một nhắc từ computeReminder).
let _und;
function understandFn() {
  if (_und === undefined) {
    try { const m = require('../../shared/understand/index.js'); _und = m && typeof m.understand === 'function' ? m.understand : null; } catch (_) { _und = null; }
  }
  return _und;
}
/** Chỉ dùng cho test: tiêm hàm understand giả; truyền undefined để về nạp lười. */
function _setUnderstand(fn) { _und = fn === undefined ? undefined : (typeof fn === 'function' ? fn : null); }

const pad2 = n => String(n).padStart(2, '0');
const hmOf = t => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const isRepeat = r => !!r && typeof r === 'object' && typeof r.freq === 'string';
const isNum = v => typeof v === 'number' && Number.isFinite(v);

const MIN = 6e4;
const NAG_AFTER = 10 * MIN;   // quá hạn > 10 phút mới nhắc dai
const NAG_EVERY = 15 * MIN;
const MUTE_MAX = 50;

/** Bỏ thẻ <...> bằng một lượt quét (tương đương /<[^>]*>/g nhưng tuyến tính). */
function stripTags(s) {
  let out = '', i = 0;
  for (;;) {
    const a = s.indexOf('<', i);
    if (a < 0) return out + s.slice(i);
    const b = s.indexOf('>', a + 1);
    if (b < 0) return out + s.slice(i);   // không còn '>' thì không còn thẻ nào
    out += s.slice(i, a);
    i = b + 1;
  }
}

function htmlToText(html) {
  return stripTags(String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|ul|ol)>/gi, '\n'))
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

/** BUG-025: lead không được lớn hơn thời gian còn lại (hạn còn 2 phút thì không "báo trước 5 phút"): bỏ báo trước. */
function clampLead(lead, due, now) {
  return isNum(lead) && lead > 0 && isNum(due) && isNum(now) && due - now > lead ? lead : 0;
}
/** BUG-012: giờ trong chữ đã qua nhưng vẫn trong HÔM NAY (vd gõ "3h chiều nay" lúc 20h) và không lặp. */
function isPastToday(due, now) {
  if (!isNum(due) || due > now) return false;
  const a = new Date(due), b = new Date(now);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Đánh dấu "đã qua": có trong danh sách (chip hiện đã qua) nhưng KHÔNG kêu chuông, không nhắc dai. */
function markPast(r) { r.lead = 0; r.preFired = true; r.fired = true; r.done = false; r.past = true; return r; }

function mkReminder(due, lead, intent, auto, now, repeat) {
  lead = clampLead(lead, due, now);
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

// ---------------------------------------------------------------------------
// Danh sách nhắc của note
// ---------------------------------------------------------------------------

/** note.reminder = primary của note.reminders (sắp theo due trước). */
function syncPrimary(note) {
  if (!note || typeof note !== 'object') return null;
  if (!Array.isArray(note.reminders)) note.reminders = [];
  RM.sortList(note.reminders);
  note.reminder = RM.pickPrimary(note.reminders);
  return note.reminder;
}

/** Migrate trong bộ nhớ (note 0.1 chưa có mảng) + syncPrimary. Idempotent, nhẹ. */
function ensureReminders(note) {
  if (!note || typeof note !== 'object') return note;
  const cur = note.reminder && typeof note.reminder === 'object' && isNum(note.reminder.due) ? note.reminder : null;
  let list = note.reminders;
  if (!Array.isArray(list)) {
    list = note.reminders = [];
    if (cur) list.push(cur);
  } else {
    for (let i = list.length - 1; i >= 0; i--) if (!list[i] || typeof list[i] !== 'object' || !isNum(list[i].due)) list.splice(i, 1);
    if (cur && !list.includes(cur)) {
      // Code cũ gán thẳng note.reminder: thay phần tử cùng id, hoặc thêm vào.
      const idx = cur.id ? list.findIndex(r => r.id === cur.id) : -1;
      if (idx >= 0) list[idx] = cur; else if (list.length < RM.MAX) list.push(cur);
    }
  }
  for (const r of list) {
    if (!isNum(r.lead)) r.lead = 0;
    if (typeof r.auto !== 'boolean') r.auto = true;
    if (typeof r.preFired !== 'boolean') r.preFired = !!r.preFired;
    if (typeof r.fired !== 'boolean') r.fired = !!r.fired;
    if (typeof r.done !== 'boolean') r.done = !!r.done;
    if (typeof r.intent !== 'string') r.intent = 'task';
  }
  RM.ensureIds(list);
  if (!Array.isArray(note.remindMuted)) note.remindMuted = [];
  syncPrimary(note);
  return note;
}

function findR(note, reminderId) {
  ensureReminders(note);
  if (reminderId === undefined || reminderId === null) return note.reminder || null;
  return note.reminders.find(r => r.id === reminderId) || null;
}

function muteKey(note, key) {
  if (typeof key !== 'string' || !key) return;
  if (!Array.isArray(note.remindMuted)) note.remindMuted = [];
  const i = note.remindMuted.indexOf(key);
  if (i >= 0) note.remindMuted.splice(i, 1);
  note.remindMuted.push(key);
  while (note.remindMuted.length > MUTE_MAX) note.remindMuted.shift();
}
function unmuteKey(note, key) {
  if (!Array.isArray(note.remindMuted) || !key) return;
  const i = note.remindMuted.indexOf(key);
  if (i >= 0) note.remindMuted.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Lặp
// ---------------------------------------------------------------------------

/** Cuộn một reminder tới lần lặp kế tiếp > max(now, due). */
function rollR(r, now) {
  if (!r || !isRepeat(r.repeat)) return false;
  const next = nextOf(r.repeat, timeOfReminder(r), Math.max(now, r.due));
  if (next == null) return false;
  r.due = next;
  r.fired = false;
  r.done = false;
  r.preFired = r.lead > 0 && now >= next - r.lead;
  return true;
}

/** Tính lần lặp kế tiếp > max(now, due); reset fired/preFired/done. Trả true nếu cuộn được. */
function rollRepeat(note, now = Date.now(), reminderId) {
  const r = findR(note, reminderId);
  if (!r) return false;
  const ok = rollR(r, now);
  if (ok) syncPrimary(note);
  return ok;
}

/** Nhắc lặp từ chữ: {repeat, due} hoặc null. */
function repeatFromText(text, now) {
  const R = recur();
  if (!R) return null;
  let p = null;
  try { p = R.parseRecur(text); } catch (_) { p = null; }
  if (!p || !isRepeat(p.repeat)) return null;
  const rule = withAnchor(p.repeat, p.repeat.freq === 'hourly' ? now : undefined);
  let time = p.time;
  if (!time && rule.freq !== 'hourly') {
    // Chỉ tự tạo nhắc lặp khi chữ có GIỜ tường minh; không thì hành vi như 0.1.
    const a = P.analyze(text, now);
    if (!(a.timed && a.due)) return null;
    time = hmOf(a.due);
  }
  const due = nextOf(rule, time, now);
  if (due == null) return null;
  return { repeat: withAnchor(rule, due), due };
}

/** Tính lại reminder khi nội dung đổi (một nhắc, hành vi 0.1). prev có thể null. */
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

// ---------------------------------------------------------------------------
// applyText: sinh lại nhắc AUTO từ chữ
// ---------------------------------------------------------------------------

/** Ý có giờ từ understand(): [{key,title,line,due,lead,intent,repeat}] hoặc null nếu không dùng được. */
function understandItems(text, now) {
  const fn = understandFn();
  if (!fn) return null;
  let items;
  try { const res = fn(String(text || ''), now); items = res && res.items; } catch (_) { return null; }
  if (!Array.isArray(items)) return null;
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    let due = isNum(it.due) ? it.due : null;
    let repeat = null;
    if (isRepeat(it.repeat)) {
      repeat = withAnchor(it.repeat, it.repeat.freq === 'hourly' ? now : due);
      if (due == null) {
        const t = it.time || (isNum(repeat.anchor) ? hmOf(repeat.anchor) : '08:00');
        due = nextOf(repeat, t, now);
      }
      if (due == null) repeat = null;
      else if (!isNum(repeat.anchor)) repeat.anchor = due;
    }
    if (due == null) continue;
    out.push({
      key: typeof it.key === 'string' && it.key ? it.key : undefined,
      title: typeof it.title === 'string' && it.title ? it.title : undefined,
      line: Number.isInteger(it.line) && it.line >= 0 ? it.line : undefined,
      due, repeat,
      lead: isNum(it.lead) && it.lead > 0 ? it.lead : 0,
      intent: typeof it.intent === 'string' ? it.intent : 'task'
    });
  }
  return out;
}

/** Hành vi 0.1: tối đa một ý (không key). */
function legacyItems(text, now) {
  const r = computeReminder(null, text, now);
  if (r) return [{ due: r.due, lead: r.lead, intent: r.intent, repeat: r.repeat || null }];
  const a = P.analyze(text, now);   // giờ đã qua: vẫn là "ý" để còn khớp nhắc auto quá hạn (nhắc dai)
  if (a && a.due) return [{ due: a.due, lead: a.lead || 0, intent: a.intent || 'task', repeat: null }];
  return [];
}

/** Cùng "ô thời gian" (cùng due, hoặc cùng lịch lặp + cùng giờ)? */
function sameSlot(r, it) {
  if (it.repeat) return !!r.repeat && sameRule(r.repeat, it.repeat) && timeOfReminder(r) === timeOfReminder(it);
  return !r.repeat && r.due === it.due;
}

function applyItem(r, it, now) {
  const keep = it.repeat
    ? sameRule(r.repeat, it.repeat) && nextOf(r.repeat, timeOfReminder(r), r.due - 1) === r.due
    : !r.repeat && r.due === it.due;
  if (!keep) {
    r.due = it.due; r.lead = clampLead(it.lead, it.due, now); r.intent = it.intent;
    if (it.repeat) r.repeat = it.repeat; else delete r.repeat;
    r.preFired = r.lead > 0 && now >= r.due - r.lead;
    r.fired = false; r.done = false; delete r.past;
    if (!it.repeat && isPastToday(it.due, now)) markPast(r);
  }
  if (it.key !== undefined) r.key = it.key;
  if (it.title !== undefined) r.title = it.title;
  if (it.line !== undefined) r.line = it.line;
}

/** Sinh lại nhắc auto theo chữ. Giữ nguyên object (và id/trạng thái) nhắc auto còn khớp. Trả note.reminder (primary). */
function applyText(note, now = Date.now()) {
  ensureReminders(note);
  const list = note.reminders;
  let items = understandItems(note.text, now);
  if (!items) items = legacyItems(note.text, now);
  const muted = new Set(note.remindMuted);
  const autos = list.filter(r => r.auto);
  const manual = list.filter(r => !r.auto);

  // Chỉ lấy ý còn tương lai/lặp, hoặc ý quá giờ nhưng vẫn khớp một nhắc auto đang có (giữ để nhắc dai).
  // BUG-012: nếu TẤT CẢ ý đều là giờ đã qua trong hôm nay thì vẫn lưu (đánh dấu past) để không im lặng;
  // note còn ý tương lai thì ý đã qua bị bỏ như trước (đỡ rác).
  const allowPast = !items.some(it => it.due > now || it.repeat);
  items = items.filter(it => !(it.key && muted.has(it.key)) &&
    (it.due > now || it.repeat || (allowPast && isPastToday(it.due, now)) || autos.some(a => a.due === it.due && (!a.key || a.key === it.key))));
  // Nhắc tay chiếm chỗ: cùng key -> bỏ ý; nhắc tay không key + chỉ một ý -> như 0.1 (không sinh thêm).
  // (Chỉ chặn TẠO MỚI; nhắc auto đã có vẫn được đối chiếu/cập nhật bình thường.)
  const manualKeys = new Set(manual.filter(m => m.key).map(m => m.key));
  const blockFresh = manual.some(m => !m.key) && items.length <= 1;
  items = items.filter(it => !(it.key && manualKeys.has(it.key)));

  const used = new Set();
  const pairs = [];
  let rest = [];
  for (const it of items) {                                     // 1) cùng key
    const a = it.key ? autos.find(x => !used.has(x) && x.key === it.key) : null;
    if (a) { used.add(a); pairs.push([a, it]); } else rest.push(it);
  }
  items = rest; rest = [];
  for (const it of items) {                                     // 2) khác key (sửa tiêu đề) nhưng cùng ô thời gian
    const a = autos.find(x => !used.has(x) && sameSlot(x, it));
    if (a) { used.add(a); pairs.push([a, it]); } else rest.push(it);
  }
  if (rest.length === 1) {                                      // 3) nhắc auto 0.1 chưa có key, chỉ một ý
    const free = autos.filter(x => !used.has(x) && !x.key);
    if (free.length === 1) { used.add(free[0]); pairs.push([free[0], rest[0]]); rest = []; }
  }
  for (const [a, it] of pairs) applyItem(a, it, now);

  const kept = list.filter(r => !r.auto || used.has(r));         // nhắc auto không còn ý nào -> bỏ
  list.length = 0;
  for (const r of kept) list.push(r);
  for (const it of rest) {
    if (blockFresh || list.length >= RM.MAX) break;
    const r = mkReminder(it.due, it.lead, it.intent, true, now, it.repeat);
    if (!it.repeat && isPastToday(it.due, now)) markPast(r);
    if (it.key !== undefined) r.key = it.key;
    if (it.title !== undefined) r.title = it.title;
    if (it.line !== undefined) r.line = it.line;
    list.push(r);
  }
  RM.ensureIds(list);
  return syncPrimary(note);
}

// ---------------------------------------------------------------------------
// Sửa nhắc
// ---------------------------------------------------------------------------

/** Ghi r = {due, lead?, repeat?, title?, key?, auto?} vào prev (tại chỗ) hoặc tạo mới. Không sync. */
function putReminder(note, prev, r, now, forceManual) {
  const lead = Number.isFinite(r.lead) && r.lead > 0 ? r.lead : 0;
  // r.repeat: undefined = giữ lịch lặp hiện có; null = bỏ; object = đặt mới.
  let repeat = r.repeat === undefined ? (prev && prev.repeat) : r.repeat;
  if (r.repeat === undefined && isRepeat(repeat) && repeat.freq !== 'hourly' &&
      !(repeat.freq === 'weekly' && repeat.byDay) && !(repeat.freq === 'monthly' && repeat.byMonthDay)) {
    repeat = Object.assign({}, repeat, { anchor: r.due });   // đổi giờ -> lần sau theo giờ mới
  }
  const title = r.title !== undefined ? (typeof r.title === 'string' && r.title ? r.title : undefined) : (prev && prev.title);
  const key = r.key !== undefined ? (typeof r.key === 'string' && r.key ? r.key : undefined) : (prev && prev.key);
  const line = r.line !== undefined ? r.line : (prev && prev.line);
  const intent = typeof r.intent === 'string' ? r.intent : P.intentOf(title || note.text).k;
  const fresh = mkReminder(r.due, lead, intent, forceManual ? false : r.auto === true, now,
    isRepeat(repeat) ? withAnchor(repeat, r.due) : null);
  if (title !== undefined) fresh.title = title;
  if (key !== undefined) fresh.key = key;
  if (Number.isInteger(line) && line >= 0) fresh.line = line;
  if (prev) {
    const id = prev.id;
    for (const k of Object.keys(prev)) delete prev[k];
    Object.assign(prev, fresh);
    if (id) prev.id = id;
    return prev;
  }
  note.reminders.push(fresh);
  RM.ensureIds(note.reminders);
  return fresh;
}

/** r = {due, lead} | null. null = xoá primary (auto có key -> mute). Sửa primary tại chỗ (auto=false) hoặc tạo nếu chưa có. */
function setReminder(note, r, now = Date.now()) {
  ensureReminders(note);
  if (!r || !Number.isFinite(r.due)) {
    const p = note.reminder;
    if (p) removeReminder(note, p.id);
    return null;
  }
  const p = note.reminder;
  if (!p && note.reminders.length >= RM.MAX) return null;
  const out = putReminder(note, p, r, now, true);
  if (out.key) unmuteKey(note, out.key);
  syncPrimary(note);
  return out;
}

/** Thêm (id null) hoặc sửa nhắc. r = {due, lead?, repeat?, title?, key?, auto?}. Trả Reminder hoặc null. */
function upsertReminder(note, reminderId, r, now = Date.now()) {
  ensureReminders(note);
  if (!r || !Number.isFinite(r.due)) return null;
  let prev = null;
  if (reminderId !== null && reminderId !== undefined) {
    prev = note.reminders.find(x => x.id === reminderId) || null;
    if (!prev) return null;
  } else if (typeof r.key === 'string' && r.key) {
    prev = note.reminders.find(x => x.key === r.key) || null;   // cùng key: sửa, không nhân đôi
  }
  if (!prev && note.reminders.length >= RM.MAX) return null;
  const out = putReminder(note, prev, r, now, false);
  if (out.key) unmuteKey(note, out.key);
  syncPrimary(note);
  return out;
}

/** Xoá một nhắc. Có key -> thêm vào remindMuted để applyText không tạo lại. Trả boolean. */
function removeReminder(note, reminderId) {
  ensureReminders(note);
  const i = note.reminders.findIndex(r => r.id === reminderId);
  if (i < 0) return false;
  const [r] = note.reminders.splice(i, 1);
  if (r.key) muteKey(note, r.key);
  syncPrimary(note);
  return true;
}

/** Đặt/huỷ lặp (repeat null = huỷ). Trả true nếu có thay đổi hợp lệ. */
function setRepeat(note, repeat, now = Date.now(), reminderId) {
  const r = findR(note, reminderId);
  if (reminderId !== undefined && reminderId !== null && !r) return false;
  if (!repeat) {
    if (!r || !r.repeat) return false;
    delete r.repeat; r.auto = false;
    return true;
  }
  if (!isRepeat(repeat)) return false;
  if (!r) {
    if (note.reminders.length >= RM.MAX) return false;
    const rule = withAnchor(repeat, now);
    const due = nextOf(rule, '08:00', now);
    if (due == null) return false;
    const it = P.intentOf(note.text);
    note.reminders.push(mkReminder(due, P.leadFor(it, due, true, now), it.k, false, now,
      repeat.freq === 'hourly' ? rule : withAnchor(repeat, due)));
    RM.ensureIds(note.reminders);
    syncPrimary(note);
    return true;
  }
  r.repeat = withAnchor(repeat, r.due);
  r.auto = false;
  if (r.done) { if (!rollR(r, now)) delete r.repeat; }
  syncPrimary(note);
  return true;
}

function snooze(note, minutes, now = Date.now(), reminderId) {
  const r = findR(note, reminderId);
  if (!r) return false;
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
  const prevDue = r.due;
  r.due = now + m * MIN;
  r.fired = false;
  r.preFired = true;
  r.done = false;
  delete r.past;
  r.auto = false; // để lần sửa chữ sau không ghi đè giờ đã hoãn
  // note lặp: giữ r.repeat (giờ gốc nằm ở repeat.anchor nên lần sau vẫn đúng giờ)
  if (r.repeat && !Number.isFinite(r.repeat.anchor)) r.repeat.anchor = prevDue;
  syncPrimary(note);
  return true;
}

function markDone(note, reminderId) {
  const r = findR(note, reminderId);
  if (!r) return false;
  r.done = true;
  syncPrimary(note);
  return true;
}

/** Due sớm nhất trong các nhắc đã kêu, chưa xong, quá hạn > NAG_AFTER của note; null nếu không có. */
function overdueDue(n, now) {
  ensureReminders(n);
  let best = null;
  for (const r of n.reminders) {
    if (!r.done && r.fired && !r.past && now - r.due > NAG_AFTER && (best === null || r.due < best)) best = r.due;
  }
  return best;
}

function overdueNotes(notes, now) {
  const out = [];
  for (const n of notes) { const d = overdueDue(n, now); if (d !== null) out.push([n, d]); }
  return out.sort((a, b) => a[1] - b[1]).map(x => x[0]);
}

/**
 * Mỗi giây. state = {lastNag:number, busy:boolean}.
 * Trả {events:[{type,noteId,reminderId?,title?,overdueCount?}], changed:boolean, changedIds:string[]}.
 */
function tick(notes, now, state) {
  const evs = [];
  const changedIds = [];
  for (const n of notes) {
    ensureReminders(n);
    const title = noteTitle(n.text);
    let ch = false;
    for (const r of n.reminders.slice()) {
      if (r.done) continue;
      // Nhắc lặp: nếu đã tới lần kế sau r.due (dù đã báo hay chưa, vd máy tắt qua nhiều chu kỳ)
      // thì nhảy tới mốc MỚI NHẤT <= now và chỉ phát đúng 1 'due' cho mốc đó.
      if (r.repeat) {
        const tm = timeOfReminder(r);
        let nx = nextOf(r.repeat, tm, r.due);
        if (nx != null && now >= nx) {
          const rp = r.repeat;
          if (rp.freq === 'hourly' && Number.isFinite(rp.anchor) && rp.interval !== 0) {
            const step = (rp.interval > 0 ? rp.interval : 1) * 3600000;
            const cand = rp.anchor + Math.floor((now - rp.anchor) / step) * step;
            if (cand >= nx && cand <= now) nx = cand;
          } else {
            for (let i = 0; i < 5000; i++) {
              const nn = nextOf(rp, tm, nx);
              if (nn == null || nn > now) break;
              nx = nn;
            }
          }
          r.due = nx; r.fired = false; r.done = false;
          r.preFired = !(r.lead > 0 && now < nx - r.lead);
          ch = true;
        }
      }
      const base = { noteId: n.id, reminderId: r.id, title: r.title || title };
      if (!r.preFired && r.lead > 0 && now >= r.due - r.lead && now < r.due) {
        r.preFired = true; ch = true;
        evs.push([r.due, Object.assign({ type: 'pre' }, base)]);
      }
      if (!r.fired && now >= r.due) {
        r.preFired = true; r.fired = true; ch = true;
        evs.push([r.due, Object.assign({ type: 'due' }, base)]);
      }
    }
    if (ch) { syncPrimary(n); changedIds.push(n.id); }
  }
  evs.sort((a, b) => a[0] - b[0]);          // ổn định: đúng thứ tự giờ khi nhiều nhắc cùng chín
  const events = evs.map(x => x[1]);
  if (state && !state.busy) {
    const od = overdueNotes(notes, now);
    if (od.length && now - (state.lastNag || 0) >= NAG_EVERY) {
      state.lastNag = now;
      events.push({ type: 'nag', noteId: od[0].id, overdueCount: od.length });
    }
  }
  return { events, changed: changedIds.length > 0, changedIds };
}

/**
 * Mốc (ms epoch) sớm nhất mà tick() có việc phải làm sau `now`; Infinity nếu không có. Dùng để ngủ tới mốc kế thay vì
 * hỏi mỗi giây (BUG-024). Phải khớp điều kiện trong tick(): trả về mốc thật, không trễ.
 */
function nextWake(notes, now, state) {
  let best = Infinity;
  const upd = t => { if (isNum(t) && t < best) best = t; };
  let firstOverdue = Infinity;
  for (const n of notes) {
    ensureReminders(n);
    for (const r of n.reminders) {
      if (r.done) continue;
      if (r.repeat) {
        const nx = nextOf(r.repeat, timeOfReminder(r), r.due);
        if (nx != null) upd(nx);
      }
      if (!r.fired) {
        if (!r.preFired && r.lead > 0) upd(r.due - r.lead);
        upd(r.due);
      } else if (!r.past) {
        if (r.due + NAG_AFTER + 1 < firstOverdue) firstOverdue = r.due + NAG_AFTER + 1;
      }
    }
  }
  if (firstOverdue !== Infinity) upd(Math.max(firstOverdue, ((state && state.lastNag) || 0) + NAG_EVERY));
  return best;
}

module.exports = {
  nextWake, htmlToText, noteTitle, computeReminder, applyText, setReminder, snooze, markDone, overdueNotes, tick, rollRepeat, setRepeat,
  ensureReminders, syncPrimary, clampLead, isPastToday, upsertReminder, removeReminder, _setUnderstand,
  NAG_AFTER, NAG_EVERY
};
