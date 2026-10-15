'use strict';
// Logic thuần (không electron) cho nhập/xuất và khôi phục note. Xem docs/rooms/notes/API.md.
const { htmlToText, noteTitle } = require('./scheduler.js');
const { normRepeat } = require('../alarms/box.js');

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const MAX_FILE = 20 * 1024 * 1024;
const BACKUP_RE = /^mochi-data-[\w-]+\.json$/;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const pad = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------- HTML
const ALLOW = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'br', 'div', 'p', 'span', 'mark', 'img']);
const DROP_NAMES = new Set(['script', 'style', 'head', 'title', 'iframe', 'object', 'noscript', 'template', 'svg', 'canvas', 'video', 'audio', 'form', 'textarea', 'select', 'button']);
const MAX_HTML = 2 * 1024 * 1024;   // html tối đa mỗi note
const MAX_NOTES = 5000;             // số note tối đa mỗi file nhập
const BAD_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%\/]+\)|hsla?\([\d\s.,%\/a-z]+\)|[a-z]+)$/i;

function escText(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const isAlnumCode = c => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isWordCode = c => isAlnumCode(c) || c === 95;
const WS_RE = /\s/;

/** Vị trí ngay sau thẻ đóng </name\s*> đầu tiên từ `from` (hoặc hết chuỗi). Tuyến tính. */
function findCloseEnd(s, from, name) {
  const n = s.length;
  let p = from;
  for (;;) {
    const k = s.indexOf('</', p);
    if (k < 0) return n;
    let j = k + 2, ok = true;
    for (let t = 0; t < name.length; t++, j++) {
      if (j >= n || (s.charCodeAt(j) | 32) !== name.charCodeAt(t)) { ok = false; break; }
    }
    if (ok) {
      while (j < n && WS_RE.test(s[j])) j++;
      if (s.charCodeAt(j) === 62) return j + 1;
    }
    p = k + 2;
  }
}

/**
 * Tách html thành các mảnh {text} / {close, name, attrs} (đã bỏ khối nguy hiểm và chú thích).
 * Quét MỘT lượt, thời gian tuyến tính (không regex lồng nhau nên không bị "catastrophic backtracking"):
 * thẻ không đóng / ngoặc kép không đóng chỉ coi '<' là chữ thường. Mảng `bad` nhớ các vị trí đã biết
 * quét tới hết chuỗi mà không gặp '>' để các '<' sau đó không quét lại.
 */
function tokenize(html) {
  const s = String(html == null ? '' : html);
  const n = s.length, out = [];
  const bad = new Uint8Array(n + 1);
  const lastDq = s.lastIndexOf('"'), lastSq = s.lastIndexOf("'");
  let gt = -2;
  const nextGt = p => { if (gt === -1) return -1; if (gt >= p) return gt; gt = s.indexOf('>', p); return gt; };
  let textStart = 0, i = 0;
  const flush = end => { if (end > textStart) out.push({ text: s.slice(textStart, end) }); };
  for (;;) {
    i = s.indexOf('<', i);
    if (i < 0) break;
    if (s.startsWith('<!--', i)) {                       // chú thích: bỏ tới '-->' (hoặc hết chuỗi)
      const e = s.indexOf('-->', i + 4);
      flush(i); i = textStart = e < 0 ? n : e + 3; continue;
    }
    let j = i + 1;
    const close = s.charCodeAt(j) === 47;
    if (close) j++;
    const c0 = s.charCodeAt(j);
    if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) { i++; continue; }
    let k = j + 1;
    while (k < n && isAlnumCode(s.charCodeAt(k))) k++;
    const name = s.slice(j, k).toLowerCase();
    if (!close && DROP_NAMES.has(name) && !isWordCode(s.charCodeAt(k))) {
      const g = nextGt(k);
      if (g >= 0) { const end = findCloseEnd(s, g + 1, name); flush(i); i = textStart = end; continue; }
    }
    let p = k, ok = false;
    for (;;) {
      if (p >= n || bad[p]) break;
      bad[p] = 1;
      const c = s.charCodeAt(p);
      if (c === 62) { ok = true; break; }
      if (c === 34 || c === 39) {
        if ((c === 34 ? lastDq : lastSq) <= p) break;
        p = s.indexOf(c === 34 ? '"' : "'", p + 1) + 1;
        continue;
      }
      p++;
    }
    if (!ok) { i++; continue; }
    flush(i);
    out.push({ close, name, attrs: s.slice(k, p) });
    i = textStart = p + 1;
  }
  flush(n);
  return out;
}

function attr(attrs, name) {
  const re = new RegExp('(?:^|[\\s"\'/])' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
  const m = re.exec(attrs);
  return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null;
}

/** Chỉ giữ thẻ định dạng cơ bản + ảnh data:image; bỏ mọi thuộc tính (trừ src ảnh và nền của span/mark). */
function sanitizeHtml(html) {
  let out = '';
  for (const t of tokenize(html)) {
    if (t.text != null) { out += escText(t.text); continue; }
    if (!ALLOW.has(t.name)) continue;
    if (t.close) { if (t.name !== 'br' && t.name !== 'img') out += '</' + t.name + '>'; continue; }
    if (t.name === 'img') {
      const src = (attr(t.attrs, 'src') || '').replace(/&amp;/g, '&').trim();
      if (/^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/i.test(src)) out += '<img src="' + src + '">';
      continue;
    }
    if (t.name === 'span' || t.name === 'mark') {
      const st = attr(t.attrs, 'style') || '';
      const bm = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(st);
      const bg = bm && COLOR_RE.test(bm[1].trim()) ? bm[1].trim() : '';
      out += '<' + t.name + (bg ? ' style="background-color: ' + bg + '"' : '') + '>';
      continue;
    }
    if (t.name === 'div' || t.name === 'li') {   // ô tick checklist của paper: chỉ giữ data-ck="0|1"
      const ck = (attr(t.attrs, 'data-ck') || '').trim();
      out += '<' + t.name + (ck === '0' || ck === '1' ? ' data-ck="' + ck + '"' : '') + '>';
      continue;
    }
    out += t.name === 'br' ? '<br>' : '<' + t.name + '>';
  }
  return out;
}

function decodeEntities(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** HTML của note -> markdown đơn giản. */
function htmlToMarkdown(html) {
  const lists = [];          // ngăn xếp {ordered, n}
  let out = '', endsNl = false;   // endsNl: tránh out.endsWith() làm phẳng chuỗi mỗi lần (bậc hai)
  const add = x => { if (x) { out += x; endsNl = x.charCodeAt(x.length - 1) === 10; } };
  const nl = () => { if (out && !endsNl) add('\n'); };
  for (const t of tokenize(html)) {
    if (t.text != null) { add(decodeEntities(t.text.replace(/[\r\n]+/g, ' '))); continue; }
    const n = t.name;
    if (n === 'b' || n === 'strong') add('**');
    else if (n === 'i' || n === 'em') add('*');
    else if (n === 's' || n === 'strike' || n === 'del') add('~~');
    else if (n === 'u') add(t.close ? '</u>' : '<u>');
    else if (n === 'br') { if (!t.close) add('\n'); }
    else if (n === 'img') { if (!t.close) add('[ảnh]'); }
    else if (n === 'ul' || n === 'ol') {
      if (t.close) { lists.pop(); nl(); } else { nl(); lists.push({ ordered: n === 'ol', n: 0 }); }
    } else if (n === 'li') {
      if (t.close) nl();
      else {
        nl();
        const L = lists[lists.length - 1] || { ordered: false, n: 0 };
        L.n++;
        add('  '.repeat(Math.max(0, lists.length - 1)) + (L.ordered ? L.n + '. ' : '- '));
      }
    } else if (n === 'div' || n === 'p') nl();
  }
  // bỏ khoảng trắng cuối dòng bằng vòng lặp (regex /[ \t]+\n/ bậc hai với chuỗi toàn khoảng trắng)
  const lines = out.split('\n');
  for (let q = 0; q < lines.length; q++) {
    let e = lines[q].length;
    while (e > 0 && (lines[q][e - 1] === ' ' || lines[q][e - 1] === '\t')) e--;
    if (e < lines[q].length) lines[q] = lines[q].slice(0, e);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- văn bản / markdown -> HTML
function inlineMd(s) {
  if (s.length > 4000) return escText(s).replace(/&(?!(?:amp|lt|gt|nbsp|quot|#\d+);)/g, '&amp;'); // dòng quá dài: không định dạng (tránh regex bậc hai)
  s = escText(s).replace(/&(?!(?:amp|lt|gt|nbsp|quot|#\d+);)/g, '&amp;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>');
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '[ảnh]');
  s = s.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, '<u>$1</u>');
  return s;
}

function markdownToHtml(md) {
  const lines = String(md == null ? '' : md).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  let html = '', list = null;
  const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
  for (const raw of lines) {
    let m;
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(raw))) {
      if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; }
      html += '<li>' + inlineMd(m[1]) + '</li>';
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(raw))) {
      if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; }
      html += '<li>' + inlineMd(m[1]) + '</li>';
    } else {
      close();
      if (!raw.trim()) html += '<div><br></div>';
      else if ((m = /^\s{0,3}#{1,6}\s+(.*)$/.exec(raw))) html += '<div><b>' + inlineMd(m[1]) + '</b></div>';
      else html += '<div>' + inlineMd(raw) + '</div>';
    }
  }
  close();
  const BR = '<div><br></div>';
  while (html.endsWith(BR)) html = html.slice(0, -BR.length);
  return sanitizeHtml(html);
}

function textToHtml(txt) {
  const lines = String(txt == null ? '' : txt).replace(/^\uFEFF/, '').trimEnd().split(/\r\n|\r|\n/);
  return lines.map(l => l.trim() ? '<div>' + escText(l).replace(/&(?!(?:amp|lt|gt|nbsp|quot|#\d+);)/g, '&amp;') + '</div>' : '<div><br></div>').join('');
}

// ---------------------------------------------------------------- chuẩn hoá note
function sanitizeReminder(r, now, pastDone) {
  if (!r || typeof r !== 'object' || !isNum(r.due)) return null;
  const o = {
    due: r.due, lead: isNum(r.lead) && r.lead > 0 ? r.lead : 0,
    intent: typeof r.intent === 'string' ? r.intent.slice(0, 40) : 'task',
    auto: r.auto !== false, preFired: !!r.preFired, fired: !!r.fired, done: !!r.done
  };
  const rep = normRepeat(r.repeat);
  if (rep) o.repeat = rep;
  if (typeof r.id === 'string' && r.id && r.id.length <= 40 && !BAD_IDS.has(r.id)) o.id = r.id;
  if (typeof r.title === 'string' && r.title) o.title = r.title.slice(0, 200);
  if (typeof r.key === 'string' && r.key) o.key = r.key.slice(0, 100);
  if (isNum(r.line) && r.line >= 0) o.line = Math.floor(r.line);
  if (isNum(now) && o.due < now && !o.done) {
    // Quyết định: nhập note có hạn nhắc đã quá mà chưa xong -> đánh dấu xong (không để bé nhắc dai đồ cũ).
    // Note nhắc lặp thì giữ chưa xong (scheduler sẽ lăn sang lần kế). Khôi phục (pastDone=false) chỉ đặt fired.
    o.fired = true; o.preFired = true;
    if (pastDone && !rep) o.done = true;
  }
  return o;
}

const MAX_REMINDERS = 20, MAX_MUTED = 50;

/** primary: đã kêu chưa xong sớm nhất -> chưa xong sớm nhất -> due lớn nhất -> null. (Bản thuần cho nhập/khôi phục.) */
function pickPrimary(list) {
  if (!list.length) return null;
  const byDue = (a, b) => a.due - b.due;
  const fired = list.filter(r => r.fired && !r.done).sort(byDue);
  if (fired.length) return fired[0];
  const open = list.filter(r => !r.done).sort(byDue);
  if (open.length) return open[0];
  return list.slice().sort((a, b) => b.due - a.due)[0];
}

/** Dựng reminders[] (nguồn sự thật) + reminder (= primary, cùng tham chiếu) từ note thô; note 0.1 chỉ có reminder vẫn nhập được. */
function sanitizeReminderList(n, now, pastDone) {
  let src = Array.isArray(n.reminders) ? n.reminders.slice(0, MAX_REMINDERS * 2) : null;
  if (!src || !src.length) src = n.reminder && typeof n.reminder === 'object' ? [n.reminder] : [];
  const list = [], ids = new Set();
  for (const raw of src) {
    const r = sanitizeReminder(raw, now, pastDone);
    if (!r) continue;
    if (!r.id || ids.has(r.id)) { let k = list.length + 1, id; do { id = 'r' + (k++); } while (ids.has(id)); r.id = id; }
    ids.add(r.id);
    list.push(r);
    if (list.length >= MAX_REMINDERS) break;
  }
  list.sort((a, b) => a.due - b.due);
  return { reminders: list, reminder: pickPrimary(list) };
}
const sanitizeMuted = m => Array.isArray(m) ? m.filter(x => typeof x === 'string' && x).map(x => x.slice(0, 100)).slice(0, MAX_MUTED) : [];

/** Danh sách nhắc của một note đã có (0.1 hoặc Đợt 2). */
const remindersOf = n => (n && Array.isArray(n.reminders) && n.reminders.length) ? n.reminders : (n && n.reminder ? [n.reminder] : []);

/** Tương đương normalizeNote của store + lọc HTML. Trả null nếu không phải note. opts: {now, forcePast}. */
function sanitizeNote(n, opts = {}) {
  if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !n.id || n.id.length > 100 || BAD_IDS.has(n.id)) return null;
  const now = Date.now();
  const b = n.bounds && typeof n.bounds === 'object' ? n.bounds : {};
  let html = sanitizeHtml(typeof n.html === 'string' ? n.html : (typeof n.text === 'string' ? textToHtml(n.text) : ''));
  if (html.length > MAX_HTML) {                       // quá 2MB: cắt ảnh; còn quá thì bỏ note
    html = html.replace(/<img src="[^"]*">/g, '');
    if (html.length > MAX_HTML) return null;
  }
  const rl = sanitizeReminderList(n, opts.now, opts.pastDone);
  return {
    id: n.id, html, text: htmlToText(html),
    color: COLORS.includes(n.color) ? n.color : 'yellow',
    bounds: {
      x: isNum(b.x) ? b.x : 80, y: isNum(b.y) ? b.y : 80,
      width: isNum(b.width) && b.width > 0 ? b.width : 300,
      height: isNum(b.height) && b.height > 0 ? b.height : 320
    },
    visible: n.visible !== false, alwaysOnTop: !!n.alwaysOnTop,
    reminder: rl.reminder, reminders: rl.reminders, remindMuted: sanitizeMuted(n.remindMuted),
    createdAt: isNum(n.createdAt) ? n.createdAt : now,
    updatedAt: isNum(n.updatedAt) ? n.updatedAt : now
  };
}

function sameContent(a, b) {
  if (!a || !b) return false;
  const dues = n => remindersOf(n).map(r => r && r.due).filter(isNum).sort((x, y) => x - y).join(',');
  const remSame = dues(a) === dues(b);
  return a.html === b.html && a.color === b.color && remSame;
}

/**
 * Gộp note nhập vào danh sách hiện có. incoming: mảng note thô. newId: () => id mới.
 * Trả {added: Note[], skipped: number, invalid: number, idMap: Map(idCũ -> idMới của note đã thêm)}. Không sửa existing.
 */
function mergeImported(existing, incoming, newId, opts = {}) {
  const byId = new Map((existing || []).map(n => [n.id, n]));
  const added = [], idMap = new Map();
  let skipped = 0, invalid = 0;
  for (let raw of (Array.isArray(incoming) ? incoming : [])) {
    // id nguy hiểm (__proto__...) -> cấp id mới thay vì bỏ note
    if (raw && typeof raw === 'object' && BAD_IDS.has(raw.id)) raw = Object.assign({}, raw, { id: newId() });
    const n = sanitizeNote(raw, opts);
    if (!n) { invalid++; continue; }
    const oldId = n.id;
    const cur = byId.get(n.id);
    if (cur) {
      if (sameContent(cur, n)) { skipped++; continue; }
      let id; do { id = newId(); } while (byId.has(id));
      n.id = id;
    }
    byId.set(n.id, n);
    added.push(n);
    idMap.set(oldId, n.id);
  }
  return { added, skipped, invalid, idMap };
}

/** Đọc cấu trúc JSON nhập: file export Mochi, mochi-data.json, backup, hoặc mảng note. */
function parseImportJson(text) {
  const j = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  const tooMany = k => new Error('File có ' + k + ' note, nhiều hơn mức tối đa ' + MAX_NOTES + ' note mỗi file');
  if (Array.isArray(j)) { if (j.length > MAX_NOTES) throw tooMany(j.length); return { notes: j, alarms: [], memos: [], noteMeta: {} }; }
  if (!j || typeof j !== 'object' || !Array.isArray(j.notes)) throw new Error('Không thấy danh sách note trong file');
  if (j.notes.length > MAX_NOTES) throw tooMany(j.notes.length);
  const box = j.alarms && typeof j.alarms === 'object' ? j.alarms : {};
  const nm = [j.noteMeta, box.noteMeta].find(x => x && typeof x === 'object' && !Array.isArray(x));
  return {
    notes: j.notes,
    alarms: Array.isArray(box.list) ? box.list : [],
    memos: Array.isArray(box.memos) ? box.memos : [],
    noteMeta: nm || {}
  };
}

/** Thêm báo thức/dặn dò chưa có id vào box. norm* lấy từ box.js. Trả {alarms, memos} đã thêm. */
function mergeAlarmBox(box, incoming, helpers, now, idMap) {
  const { normAlarm, normMemo, computeNext } = helpers;
  const ids = new Set([...box.list.map(a => a.id), ...box.memos.map(m => m.id)]);
  const res = { alarms: [], memos: [] };
  for (const raw of incoming.alarms || []) {
    const a = normAlarm(raw);
    if (!a || ids.has(a.id)) continue;
    ids.add(a.id);
    delete a.snoozedUntil; delete a.lastFiredAt;
    if (a.noteId && idMap && idMap.has(a.noteId)) a.noteId = idMap.get(a.noteId);   // note nhập có thể đã đổi id
    a.nextAt = null;
    if (a.enabled) {
      a.nextAt = computeNext ? computeNext(a, now) : null;
      if (a.nextAt == null && !a.repeat) a.enabled = false; // báo thức một lần đã qua
    }
    box.list.push(a); res.alarms.push(a);
  }
  for (const raw of incoming.memos || []) {
    const m = normMemo(raw);
    if (!m || ids.has(m.id)) continue;
    ids.add(m.id);
    box.memos.push(m); res.memos.push(m);
  }
  return res;
}

/**
 * Áp noteMeta (zoom/locked/repeat) của file nhập vào box.noteMeta theo ánh xạ idCũ -> idMới.
 * Chỉ áp cho note vừa thêm (idMap); nếu note có reminder mà chưa có repeat thì lấy repeat từ meta.
 */
function applyNoteMeta(boxMeta, metaIn, idMap, addedNotes) {
  if (!metaIn || typeof metaIn !== 'object' || !idMap) return 0;
  const byId = new Map((addedNotes || []).map(n => [n.id, n]));
  let cnt = 0;
  for (const [oldId, newIdv] of idMap) {
    if (BAD_IDS.has(newIdv) || !Object.prototype.hasOwnProperty.call(metaIn, oldId)) continue;
    const m = metaIn[oldId];
    if (!m || typeof m !== 'object') continue;
    const o = {};
    const r = normRepeat(m.repeat); if (r) o.repeat = r;
    if (isNum(m.zoom) && m.zoom >= 0.5 && m.zoom <= 3) o.zoom = m.zoom;
    if (m.locked) o.locked = true;
    const n = byId.get(newIdv);
    if (o.repeat) {
      // chỉ khôi phục khi chưa nhắc nào của note có repeat (không đè repeat của nhắc khác)
      if (n && n.reminder && !remindersOf(n).some(r => r && r.repeat)) n.reminder.repeat = Object.assign({}, o.repeat);
      if (!n || !n.reminder) delete o.repeat;      // repeat không có reminder thì vô nghĩa
    }
    if (!Object.keys(o).length) continue;
    boxMeta[newIdv] = Object.assign(Object.prototype.hasOwnProperty.call(boxMeta, newIdv) ? boxMeta[newIdv] : {}, o);
    cnt++;
  }
  return cnt;
}

// ---------------------------------------------------------------- xuất
const dayStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const stampStr = d => dayStr(d) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
function dueStr(ms) {
  const d = new Date(ms);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function noteToText(n, fmt) {
  const md = fmt === 'md';
  let body, head = '';
  if (md) {
    body = htmlToMarkdown(n.html || '') || (n.text || '');
    const title = noteTitle(n.text || htmlToText(n.html)) || '(trống)';
    head = '## ' + title.replace(/^[#\s]+/, '') + '\n\n';
  } else body = htmlToText(n.html || '') || (n.text || '');
  let rem = '';
  const rs = remindersOf(n).filter(r => r && isNum(r.due)).sort((x, y) => x.due - y.due);
  for (const r of rs) {
    const what = r.title && rs.length > 1 ? ' ' + r.title : '';
    rem += md ? '\n\n> Nhắc lúc ' + dueStr(r.due) + what + (r.done ? ' (đã xong)' : '')
      : '\n[Nhắc lúc ' + dueStr(r.due) + what + (r.done ? ' - đã xong' : '') + ']';
  }
  return head + body + rem;
}

function notesToText(notes, fmt) {
  const sep = fmt === 'md' ? '\n\n---\n\n' : '\n\n-----\n\n';
  return notes.map(n => noteToText(n, fmt)).join(sep) + '\n';
}

function buildExportJson(notes, alarmBox, now) {
  const b = alarmBox || {};
  notes = (notes || []).map(n => (n && !Array.isArray(n.reminders) && n.reminder) ? Object.assign({}, n, { reminders: [n.reminder] }) : n);
  return {
    app: 'mochi-notes', kind: 'export', version: 2,
    exportedAt: new Date(isNum(now) ? now : Date.now()).toISOString(),
    notes, alarms: { list: b.list || [], memos: b.memos || [] },
    noteMeta: b.noteMeta && typeof b.noteMeta === 'object' ? b.noteMeta : {}
  };
}

// ---------------------------------------------------------------- sao lưu
const isBackupName = f => typeof f === 'string' && f.length < 120 && BACKUP_RE.test(f);
function backupDay(file, mtimeMs) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(file);
  return m ? m[1] : dayStr(new Date(mtimeMs || Date.now()));
}

/** Tóm tắt note trong bản sao lưu so với hiện tại. */
function summarizeBackup(backupNotes, currentNotes) {
  const cur = new Map((currentNotes || []).map(n => [n.id, n]));
  const out = [];
  for (const raw of Array.isArray(backupNotes) ? backupNotes : []) {
    const n = sanitizeNote(raw);
    if (!n) continue;
    const c = cur.get(n.id);
    out.push({ id: n.id, title: noteTitle(n.text) || '(trống)', updatedAt: n.updatedAt, exists: !!c, same: !!c && sameContent(c, n) });
  }
  return out;
}

/**
 * Kế hoạch khôi phục: ids null = tất cả. Trả {add: Note[], overwrite: [{id, patch}]}.
 * now: reminder quá hạn trong bản sao lưu được đặt fired/preFired (không réo ngay).
 * Ghi đè: bản sao lưu không có repeat (store không ghi repeat) thì giữ repeat của note hiện tại.
 */
function planRestore(backupNotes, currentNotes, ids, now) {
  const want = Array.isArray(ids) ? new Set(ids) : null;
  const cur = new Map((currentNotes || []).map(n => [n.id, n]));
  const plan = { add: [], overwrite: [] };
  for (const raw of Array.isArray(backupNotes) ? backupNotes : []) {
    const n = sanitizeNote(raw, { now });
    if (!n || (want && !want.has(n.id))) continue;
    const c = cur.get(n.id);
    if (!c) plan.add.push(n);
    else if (!sameContent(c, n)) {
      // bản sao lưu cũ có thể thiếu repeat: giữ repeat của nhắc hiện tại cùng id (hoặc primary)
      const curList = remindersOf(c);
      for (const r of n.reminders) {
        if (r.repeat) continue;
        const m = curList.find(x => x && x.id && x.id === r.id) || (r === n.reminder && c.reminder && curList.length === 1 ? c.reminder : null);
        if (m && m.repeat) r.repeat = Object.assign({}, m.repeat);
      }
      plan.overwrite.push({ id: n.id, patch: { html: n.html, text: n.text, color: n.color, reminder: n.reminder, reminders: n.reminders, remindMuted: n.remindMuted } });
    }
  }
  return plan;
}

module.exports = {
  COLORS, MAX_FILE, sanitizeHtml, htmlToMarkdown, markdownToHtml, textToHtml,
  sanitizeNote, sanitizeReminderList, sameContent, mergeImported, parseImportJson, mergeAlarmBox, applyNoteMeta, MAX_HTML, MAX_NOTES,
  noteToText, notesToText, buildExportJson, isBackupName, backupDay, summarizeBackup, planRestore,
  dayStr, stampStr, dueStr
};
