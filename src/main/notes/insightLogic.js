'use strict';
// Logic thuần (không electron) cho "hiểu note": lọc gợi ý, câu đọc lại, biến đổi checklist/tách note.
// Xem docs/rooms/notes/API2.md mục 2 và 4.
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const pad = n => String(n).padStart(2, '0');

const escapeHtml = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Văn bản nhiều dòng -> html mỗi dòng một <div> (dòng trống = <div><br></div>). */
function textToHtml(text) {
  return String(text == null ? '' : text).split(/\r?\n/)
    .map(l => l.trim() === '' ? '<div><br></div>' : '<div>' + escapeHtml(l) + '</div>').join('');
}

/** Chuỗi số điện thoại -> chỉ chữ số, +84/84 đầu -> 0. Trả '' nếu không ra số hợp lý (9-11 chữ số). */
function phoneDigits(s) {
  let d = String(s == null ? '' : s).replace(/[^\d+]/g, '');
  if (d.startsWith('+84')) d = '0' + d.slice(3);
  else if (d.startsWith('0084')) d = '0' + d.slice(4);
  d = d.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('84')) d = '0' + d.slice(2);
  return d.length >= 8 && d.length <= 12 ? d : '';
}

/** Địa chỉ web an toàn: chỉ http/https; "www.x" hoặc "x.vn/abc" -> thêm https://. Không hợp lệ -> null. */
function safeUrl(u) {
  let s = String(u == null ? '' : u).trim();
  if (!s || /[\s<>"]/.test(s) || s.length > 2000) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!/^https?:\/\/[^/\s]+/i.test(s)) return null;
    return s;
  }
  if (/^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(s) || /^www\./i.test(s)) return 'https://' + s;
  return null;
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const safeEmail = e => { const s = String(e == null ? '' : e).trim(); return EMAIL_RE.test(s) && s.length <= 254 ? s : null; };

/** Phần sau tiền tố trong id gợi ý: 'call:0901' -> '0901'. */
const idTail = id => { const s = String(id); const i = s.indexOf(':'); return i < 0 ? '' : s.slice(i + 1); };

// ---------------------------------------------------------------- lọc gợi ý
/** reminder đã "phủ" item này chưa (cùng key, hoặc cùng giờ và chưa xong). */
function covers(r, item) {
  if (!r || !item) return false;
  if (r.key && item.key && r.key === item.key) return true;
  return !r.done && isNum(r.due) && isNum(item.due) && r.due === item.due && !r.key;
}
const hasReminderFor = (reminders, item) => (reminders || []).some(r => covers(r, item));

/** Tìm item theo key. */
const itemByKey = (insight, key) => ((insight && insight.items) || []).find(i => i.key === key) || null;

/** Item còn thiếu nhắc và còn ở tương lai. */
function missingItems(insight, reminders, now) {
  return ((insight && insight.items) || []).filter(i => isNum(i.due) && i.due > now && !hasReminderFor(reminders, i));
}

/**
 * Gợi ý đã lọc theo các nhắc hiện có:
 * bỏ remind:<key> khi đã có nhắc cùng key; bỏ remind-all khi mọi item đã có nhắc.
 */
function filterSuggestions(insight, reminders, now) {
  const sugs = (insight && Array.isArray(insight.suggestions)) ? insight.suggestions : [];
  const t = isNum(now) ? now : Date.now();
  const missing = missingItems(insight, reminders, t);
  const out = [];
  for (const s of sugs) {
    if (!s || typeof s.id !== 'string') continue;
    if (s.kind === 'remind') {
      const it = itemByKey(insight, s.itemKey || idTail(s.id));
      if (it && hasReminderFor(reminders, it)) continue;
    } else if (s.kind === 'remind-all') {
      if (!missing.length) continue;
    }
    out.push(s);
  }
  return out;
}

/** InsightView = Insight + {noteId?, reminders, suggestions đã lọc}. */
function buildView(insight, note, now) {
  if (!insight || typeof insight !== 'object') return null;
  const reminders = note && Array.isArray(note.reminders) ? note.reminders : (note && note.reminder ? [note.reminder] : []);
  const v = Object.assign({}, insight);
  if (note && note.id) v.noteId = note.id;
  v.reminders = reminders;
  v.suggestions = filterSuggestions(insight, reminders, now);
  return v;
}

// ---------------------------------------------------------------- câu đọc lại
const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

/** "15:00" nếu hôm nay, "15:00 mai" nếu ngày mai, còn lại "15:00 25/12". */
function whenText(due, now) {
  const t = hm(due);
  const d0 = dayKey(due), n0 = dayKey(now);
  if (d0 === n0) return t;
  const tm = new Date(now); tm.setDate(tm.getDate() + 1);
  if (d0 === dayKey(tm.getTime())) return t + ' mai';
  const d = new Date(due);
  return t + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
}

const lowerFirst = s => { s = String(s || '').trim(); return s ? s[0].toLowerCase() + s.slice(1) : s; };
const clip = (s, n) => s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';

/**
 * Câu đọc lại (≤ 120 ký tự). entries: [{title, due}] các nhắc sắp tới (đã sắp theo due); title: tiêu đề note.
 * 0 -> "Tớ ghi rồi nha: <tiêu đề>"; 1 -> "Tớ ghi rồi nha. 15:00 tớ nhắc cậu <title thường>";
 * nhiều -> "Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách…".
 */
function buildReply(title, entries, now) {
  const list = (entries || []).filter(e => e && isNum(e.due));
  const t = String(title || '').trim();
  if (!list.length) return clip('Tớ ghi rồi nha' + (t ? ': ' + t : ''), 120);
  if (list.length === 1) {
    const e = list[0];
    return clip('Tớ ghi rồi nha. ' + whenText(e.due, now) + ' tớ nhắc cậu ' + lowerFirst(e.title || t), 120);
  }
  const head = 'Tớ ghi rồi nha, ' + list.length + ' việc: ';
  let body = '';
  for (let i = 0; i < list.length; i++) {
    const piece = whenText(list[i].due, now) + ' ' + lowerFirst(list[i].title || t);
    const next = body ? body + ', ' + piece : piece;
    if (head.length + next.length > 119 && body) { body += '…'; break; }
    body = next;
  }
  return clip(head + body, 120);
}

// ---------------------------------------------------------------- checklist / tách note
const BULLET_RE = /^\s*(?:[-*•+]|\d+[.)]|\[[ xX]\]|[☐☑✓✔])\s*/;
const CHECK_RE = /^\s*(?:[-*•+]\s*)?\[[ xX]\]\s*/;

/** Bỏ ký hiệu đầu dòng (bullet / số thứ tự / ô tích). */
function stripMarker(line) {
  let s = String(line);
  for (let i = 0; i < 2; i++) { const t = s.replace(BULLET_RE, ''); if (t === s) break; s = t; }
  return s.trim();
}
const isCheckLine = l => CHECK_RE.test(l);

/**
 * Đổi text thành checklist "- [ ] ...". Dòng đã là ô tích giữ nguyên. Dòng đầu được giữ làm tiêu đề khi nó kết thúc
 * bằng ':' hoặc khi có ≥ 3 dòng và các dòng còn lại đều có ký hiệu đầu dòng. Dòng trống giữ nguyên.
 * Trả {text, changed, count}.
 */
function checklistText(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const idx = []; lines.forEach((l, i) => { if (l.trim()) idx.push(i); });
  let skipFirst = false;
  if (idx.length >= 2) {
    const first = lines[idx[0]];
    const rest = idx.slice(1).map(i => lines[i]);
    if (/[:：]\s*$/.test(first.trim()) && !BULLET_RE.test(first)) skipFirst = true;
    else if (idx.length >= 3 && !BULLET_RE.test(first) && rest.every(l => BULLET_RE.test(l))) skipFirst = true;
  }
  let count = 0, changed = false;
  const out = lines.map((l, i) => {
    if (!l.trim()) return l;
    if (skipFirst && i === idx[0]) return l;
    count++;
    if (isCheckLine(l)) {
      const m = /^\s*(?:[-*•+]\s*)?\[([ xX])\]\s*(.*)$/.exec(l);
      const norm = '- [' + (m[1] === ' ' ? ' ' : 'x') + '] ' + m[2].trim();
      if (norm !== l) changed = true;
      return norm;
    }
    changed = true;
    return '- [ ] ' + stripMarker(l);
  });
  return { text: out.join('\n'), changed, count };
}
const checklistHtml = text => { const r = checklistText(text); return { html: textToHtml(r.text), text: r.text, changed: r.changed, count: r.count }; };

/**
 * Kế hoạch tách note: giữ item đầu (theo dòng) ở note gốc; mỗi dòng chứa item khác thành một note mới.
 * Trả {keepText, parts: [{text, title, key}]} hoặc null nếu không có gì để tách.
 */
function splitPlan(text, insight) {
  const items = ((insight && insight.items) || []).filter(i => isNum(i.line)).slice().sort((a, b) => a.line - b.line);
  if (items.length < 2) return null;
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const firstLine = items[0].line;
  const moved = new Map();           // line -> {text, title, key}
  for (const it of items) {
    if (it.line === firstLine || moved.has(it.line)) continue;
    if (it.line < 0 || it.line >= lines.length) continue;
    const body = stripMarker(lines[it.line]);
    if (!body) continue;
    moved.set(it.line, { text: body, title: it.title || body, key: it.key });
  }
  if (!moved.size) return null;
  const keep = lines.filter((_l, i) => !moved.has(i));
  // gọn dòng trống thừa ở cuối
  while (keep.length > 1 && !keep[keep.length - 1].trim()) keep.pop();
  return { keepText: keep.join('\n'), parts: Array.from(moved.values()) };
}

// ---------------------------------------------------------------- tham số lệnh
/** Tham số tạo báo thức từ item: {label, time, date | repeat, noteId}. null nếu thiếu giờ. */
function alarmParams(item, noteId, now) {
  if (!item) return null;
  const time = item.time || (isNum(item.due) ? hm(item.due) : null);
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const o = { label: String(item.title || 'Báo thức').slice(0, 200), time, enabled: true };
  if (item.repeat) o.repeat = item.repeat;
  else {
    let due = isNum(item.due) ? item.due : null;
    if (due == null || due <= now) {
      const [h, m] = time.split(':').map(Number);
      const d = new Date(now); d.setHours(h, m, 0, 0);
      if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      due = d.getTime();
    }
    o.date = dayKey(due);
  }
  if (noteId) o.noteId = noteId;
  return o;
}

/** Tham số nhắc cho S.upsertReminder từ item. */
function reminderParams(item) {
  if (!item || !isNum(item.due)) return null;
  const r = { due: item.due, lead: isNum(item.lead) && item.lead > 0 ? item.lead : 0, auto: true, key: item.key, title: item.title };
  if (item.repeat) r.repeat = item.repeat;
  if (item.intent) r.intent = item.intent;
  if (isNum(item.line)) r.line = item.line;
  return r;
}

module.exports = {
  escapeHtml, textToHtml, phoneDigits, safeUrl, safeEmail, idTail,
  hasReminderFor, itemByKey, missingItems, filterSuggestions, buildView,
  hm, whenText, lowerFirst, buildReply,
  stripMarker, checklistText, checklistHtml, splitPlan, alarmParams, reminderParams
};
