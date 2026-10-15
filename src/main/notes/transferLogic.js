'use strict';
// Logic thuần (không electron) cho nhập/xuất và khôi phục note. Xem docs/rooms/notes/API.md.
const { htmlToText, noteTitle } = require('./scheduler.js');

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const MAX_FILE = 20 * 1024 * 1024;
const BACKUP_RE = /^mochi-data-[\w-]+\.json$/;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const pad = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------- HTML
const ALLOW = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'br', 'div', 'p', 'span', 'mark', 'img']);
const DROP_BLOCK = /<(script|style|head|title|iframe|object|noscript|template|svg|canvas|video|audio|form|textarea|select|button)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%\/]+\)|hsla?\([\d\s.,%\/a-z]+\)|[a-z]+)$/i;

function escText(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/** Tách html thành các mảnh {text} / {tag, close, name, attrs} (đã bỏ khối nguy hiểm và chú thích). */
function tokenize(html) {
  let s = String(html == null ? '' : html).replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(DROP_BLOCK, '');
  const out = [];
  let last = 0, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ close: !!m[1], name: m[2].toLowerCase(), attrs: m[3] || '' });
    last = TAG_RE.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
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
  let out = '';
  const nl = () => { if (out && !out.endsWith('\n')) out += '\n'; };
  for (const t of tokenize(html)) {
    if (t.text != null) { out += decodeEntities(t.text.replace(/[\r\n]+/g, ' ')); continue; }
    const n = t.name;
    if (n === 'b' || n === 'strong') out += '**';
    else if (n === 'i' || n === 'em') out += '*';
    else if (n === 's' || n === 'strike' || n === 'del') out += '~~';
    else if (n === 'u') out += t.close ? '</u>' : '<u>';
    else if (n === 'br') { if (!t.close) out += '\n'; }
    else if (n === 'img') { if (!t.close) out += '[ảnh]'; }
    else if (n === 'ul' || n === 'ol') {
      if (t.close) { lists.pop(); nl(); } else { nl(); lists.push({ ordered: n === 'ol', n: 0 }); }
    } else if (n === 'li') {
      if (t.close) nl();
      else {
        nl();
        const L = lists[lists.length - 1] || { ordered: false, n: 0 };
        L.n++;
        out += '  '.repeat(Math.max(0, lists.length - 1)) + (L.ordered ? L.n + '. ' : '- ');
      }
    } else if (n === 'div' || n === 'p') nl();
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- văn bản / markdown -> HTML
function inlineMd(s) {
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
  return sanitizeHtml(html.replace(/(<div><br><\/div>)+$/, ''));
}

function textToHtml(txt) {
  const lines = String(txt == null ? '' : txt).replace(/^\uFEFF/, '').replace(/\s+$/, '').split(/\r\n|\r|\n/);
  return lines.map(l => l.trim() ? '<div>' + escText(l).replace(/&(?!(?:amp|lt|gt|nbsp|quot|#\d+);)/g, '&amp;') + '</div>' : '<div><br></div>').join('');
}

// ---------------------------------------------------------------- chuẩn hoá note
function sanitizeReminder(r, now) {
  if (!r || typeof r !== 'object' || !isNum(r.due)) return null;
  const o = {
    due: r.due, lead: isNum(r.lead) && r.lead > 0 ? r.lead : 0,
    intent: typeof r.intent === 'string' ? r.intent.slice(0, 40) : 'task',
    auto: r.auto !== false, preFired: !!r.preFired, fired: !!r.fired, done: !!r.done
  };
  if (isNum(now) && o.due < now && !o.done) { o.fired = true; o.preFired = true; } // không réo lại hạn cũ ngay khi nhập
  return o;
}

/** Tương đương normalizeNote của store + lọc HTML. Trả null nếu không phải note. opts: {now, forcePast}. */
function sanitizeNote(n, opts = {}) {
  if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !n.id || n.id.length > 100) return null;
  const now = Date.now();
  const b = n.bounds && typeof n.bounds === 'object' ? n.bounds : {};
  const html = sanitizeHtml(typeof n.html === 'string' ? n.html : (typeof n.text === 'string' ? textToHtml(n.text) : ''));
  return {
    id: n.id, html, text: htmlToText(html),
    color: COLORS.includes(n.color) ? n.color : 'yellow',
    bounds: {
      x: isNum(b.x) ? b.x : 80, y: isNum(b.y) ? b.y : 80,
      width: isNum(b.width) && b.width > 0 ? b.width : 300,
      height: isNum(b.height) && b.height > 0 ? b.height : 320
    },
    visible: n.visible !== false, alwaysOnTop: !!n.alwaysOnTop,
    reminder: sanitizeReminder(n.reminder, opts.now),
    createdAt: isNum(n.createdAt) ? n.createdAt : now,
    updatedAt: isNum(n.updatedAt) ? n.updatedAt : now
  };
}

function sameContent(a, b) {
  if (!a || !b) return false;
  const ra = a.reminder, rb = b.reminder;
  const remSame = (!ra && !rb) || (!!ra && !!rb && ra.due === rb.due);
  return a.html === b.html && a.color === b.color && remSame;
}

/**
 * Gộp note nhập vào danh sách hiện có. incoming: mảng note thô. newId: () => id mới.
 * Trả {added: Note[], skipped: number, invalid: number}. Không sửa existing.
 */
function mergeImported(existing, incoming, newId, opts = {}) {
  const byId = new Map((existing || []).map(n => [n.id, n]));
  const added = [];
  let skipped = 0, invalid = 0;
  for (const raw of (Array.isArray(incoming) ? incoming : [])) {
    const n = sanitizeNote(raw, opts);
    if (!n) { invalid++; continue; }
    const cur = byId.get(n.id);
    if (cur) {
      if (sameContent(cur, n)) { skipped++; continue; }
      let id; do { id = newId(); } while (byId.has(id));
      n.id = id;
    }
    byId.set(n.id, n);
    added.push(n);
  }
  return { added, skipped, invalid };
}

/** Đọc cấu trúc JSON nhập: file export Mochi, mochi-data.json, backup, hoặc mảng note. */
function parseImportJson(text) {
  const j = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  if (Array.isArray(j)) return { notes: j, alarms: [], memos: [] };
  if (!j || typeof j !== 'object' || !Array.isArray(j.notes)) throw new Error('Không thấy danh sách note trong file');
  const box = j.alarms && typeof j.alarms === 'object' ? j.alarms : {};
  return {
    notes: j.notes,
    alarms: Array.isArray(box.list) ? box.list : [],
    memos: Array.isArray(box.memos) ? box.memos : []
  };
}

/** Thêm báo thức/dặn dò chưa có id vào box. norm* lấy từ box.js. Trả {alarms, memos} đã thêm. */
function mergeAlarmBox(box, incoming, helpers, now) {
  const { normAlarm, normMemo, computeNext } = helpers;
  const ids = new Set([...box.list.map(a => a.id), ...box.memos.map(m => m.id)]);
  const res = { alarms: [], memos: [] };
  for (const raw of incoming.alarms || []) {
    const a = normAlarm(raw);
    if (!a || ids.has(a.id)) continue;
    ids.add(a.id);
    delete a.snoozedUntil; delete a.lastFiredAt;
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
  if (n.reminder && isNum(n.reminder.due)) {
    rem = md ? '\n\n> Nhắc lúc ' + dueStr(n.reminder.due) + (n.reminder.done ? ' (đã xong)' : '')
      : '\n[Nhắc lúc ' + dueStr(n.reminder.due) + (n.reminder.done ? ' - đã xong' : '') + ']';
  }
  return head + body + rem;
}

function notesToText(notes, fmt) {
  const sep = fmt === 'md' ? '\n\n---\n\n' : '\n\n-----\n\n';
  return notes.map(n => noteToText(n, fmt)).join(sep) + '\n';
}

function buildExportJson(notes, alarmBox, now) {
  const b = alarmBox || {};
  return {
    app: 'mochi-notes', kind: 'export', version: 2,
    exportedAt: new Date(isNum(now) ? now : Date.now()).toISOString(),
    notes, alarms: { list: b.list || [], memos: b.memos || [] }
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

/** Kế hoạch khôi phục: ids null = tất cả. Trả {add: Note[], overwrite: [{id, patch}]}. */
function planRestore(backupNotes, currentNotes, ids) {
  const want = Array.isArray(ids) ? new Set(ids) : null;
  const cur = new Map((currentNotes || []).map(n => [n.id, n]));
  const plan = { add: [], overwrite: [] };
  for (const raw of Array.isArray(backupNotes) ? backupNotes : []) {
    const n = sanitizeNote(raw);
    if (!n || (want && !want.has(n.id))) continue;
    const c = cur.get(n.id);
    if (!c) plan.add.push(n);
    else if (!sameContent(c, n)) plan.overwrite.push({ id: n.id, patch: { html: n.html, text: n.text, color: n.color, reminder: n.reminder } });
  }
  return plan;
}

module.exports = {
  COLORS, MAX_FILE, sanitizeHtml, htmlToMarkdown, markdownToHtml, textToHtml,
  sanitizeNote, sameContent, mergeImported, parseImportJson, mergeAlarmBox,
  noteToText, notesToText, buildExportJson, isBackupName, backupDay, summarizeBackup, planRestore,
  dayStr, stampStr, dueStr
};
