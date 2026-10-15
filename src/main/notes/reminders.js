'use strict';
// Logic thuần cho danh sách nhắc của một note (Note.reminders). Xem docs/rooms/notes/API2.md mục 3.
let normRepeat = null;
try { normRepeat = require('../alarms/box.js').normRepeat; } catch (_) { /* thiếu module alarms: bỏ qua lặp */ }

const MAX = 20;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const UNSAFE = ['__proto__', 'constructor', 'prototype'];

/** Sao các trường lạ (của phòng khác/bản mới hơn) sang out để không mất khi nạp-ghi (BUG-031). */
function keepUnknown(src, out) {
  for (const k of Object.keys(src)) {
    if (UNSAFE.includes(k) || Object.prototype.hasOwnProperty.call(out, k)) continue;
    out[k] = src[k];
  }
  return out;
}

/** Chuẩn hoá một nhắc (từ JSON/bên ngoài). Trả object mới hoặc null nếu hỏng. id có thể thiếu (ensureIds cấp sau). */
function normItem(r) {
  if (!r || typeof r !== 'object' || !isNum(r.due)) return null;
  const out = {};
  const KNOWN = ['id', 'due', 'lead', 'intent', 'auto', 'preFired', 'fired', 'done', 'repeat', 'title', 'key', 'line'];
  if (typeof r.id === 'string' && r.id && r.id.length <= 40) out.id = r.id;
  out.due = r.due;
  out.lead = isNum(r.lead) && r.lead > 0 ? r.lead : 0;
  out.intent = typeof r.intent === 'string' ? r.intent : 'task';
  out.auto = r.auto !== false;
  out.preFired = !!r.preFired;
  out.fired = !!r.fired;
  out.done = !!r.done;
  let rep = null;
  if (normRepeat) { try { rep = normRepeat(r.repeat); } catch (_) { rep = null; } }
  if (rep) out.repeat = rep;
  if (typeof r.title === 'string' && r.title.trim()) out.title = r.title.trim().slice(0, 120);
  if (typeof r.key === 'string' && r.key) out.key = r.key.slice(0, 80);
  if (Number.isInteger(r.line) && r.line >= 0) out.line = r.line;
  const extra = {};
  for (const k of Object.keys(r)) if (!KNOWN.includes(k)) extra[k] = r[k];
  return keepUnknown(extra, out);
}

/** Id mới, duy nhất trong list: danh sách rỗng -> 'r1', còn lại 'r' + 5 ký tự base36 ngẫu nhiên. */
function newId(list) {
  const used = new Set((list || []).filter(Boolean).map(r => r.id));
  if (!used.has('r1') && (!list || list.length === 0)) return 'r1';
  for (let i = 0; i < 1000; i++) {
    const id = 'r' + Math.random().toString(36).slice(2, 7).padEnd(5, '0');
    if (!used.has(id)) return id;
  }
  let n = used.size + 1;
  while (used.has('r' + n.toString(36))) n++;
  return 'r' + n.toString(36);
}

/** Cấp id cho phần tử thiếu/trùng (sửa tại chỗ). Phần tử duy nhất thiếu id -> 'r1'. Trả list. */
function ensureIds(list) {
  if (!Array.isArray(list)) return list;
  const seen = new Set();
  const need = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.id === 'string' && r.id && !seen.has(r.id)) seen.add(r.id);
    else need.push(r);
  }
  for (const r of need) {
    let id;
    if (list.length === 1) id = 'r1';
    else { do { id = newId(Array.from(seen, i => ({ id: i })).concat([{ id: 'r1' }])); } while (seen.has(id)); }
    r.id = id; seen.add(id);
  }
  return list;
}

/** Nhắc "chính": đã kêu chưa xong sớm nhất -> chưa xong sớm nhất -> due lớn nhất -> null. */
function pickPrimary(list) {
  let fired = null, open = null, last = null;
  for (const r of list || []) {
    if (!r || !isNum(r.due)) continue;
    if (!r.done) {
      if (r.fired && (!fired || r.due < fired.due)) fired = r;
      if (!open || r.due < open.due) open = r;
    }
    if (!last || r.due > last.due) last = r;
  }
  return fired || open || last || null;
}

/** Sắp theo due tăng dần (ổn định, tại chỗ). Trả list. */
function sortList(list) {
  if (!Array.isArray(list)) return list;
  const tagged = list.map((r, i) => [r, i]);
  tagged.sort((a, b) => (a[0].due - b[0].due) || (a[1] - b[1]));
  for (let i = 0; i < tagged.length; i++) list[i] = tagged[i][0];
  return list;
}

module.exports = { keepUnknown, normItem, ensureIds, pickPrimary, sortList, newId, MAX };
