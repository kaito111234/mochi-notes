'use strict';
// Trích chữ dòng checklist theo ĐÚNG cách paper/note đánh chỉ số (src/note/checklist.js):
// dòng checklist = phần tử <div data-ck="0|1"> là CON TRỰC TIẾP của vùng soạn thảo (note.html),
// chỉ số = vị trí trong danh sách các dòng đó theo thứ tự tài liệu (cả đã tick lẫn chưa tick).
// Thuần: không DOM, không electron.

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'wbr', 'area', 'base', 'col', 'embed', 'source', 'track']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const MAX_LEN = 200;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : ' '; } catch (_) { return ' '; }
    }
    return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
  });
}

// Chuẩn hoá chữ dòng: bỏ thẻ HTML, giải mã thực thể, gộp khoảng trắng, chữ thường, cắt 200 ký tự
function normalizeText(html) {
  let s = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '');
  s = decode(s).replace(/[\s ]+/g, ' ').trim().normalize('NFC').toLowerCase();
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) : s;
}

// Danh sách HTML bên trong từng dòng checklist (con trực tiếp, thẻ div, có thuộc tính data-ck)
function lines(html) {
  const src = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  let depth = 0, start = -1, isLine = false;
  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(src))) {
    const closing = m[1] === '/', name = m[2].toLowerCase(), attrs = m[3] || '';
    if (closing) {
      if (depth > 0) depth--;
      if (depth === 0 && isLine) { out.push(src.slice(start, m.index)); isLine = false; }
      continue;
    }
    const selfClose = VOID.has(name) || /\/\s*$/.test(attrs);
    if (selfClose) continue;
    if (depth === 0) {
      isLine = name === 'div' && /(^|\s)data-ck(?![\w-])/i.test(attrs);
      start = m.index + m[0].length;
    }
    depth++;
  }
  if (isLine && depth > 0) out.push(src.slice(start));   // div cuối chưa đóng
  return out;
}

// Chữ (đã chuẩn hoá) của dòng checklist thứ `index`; null nếu không lấy được hoặc dòng trống
function lineText(html, index) {
  if (typeof html !== 'string' || !Number.isInteger(index) || index < 0) return null;
  const l = lines(html);
  if (index >= l.length) return null;
  const t = normalizeText(l[index]);
  return t ? t : null;
}

// FNV-1a 32-bit -> hex
function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Khoá chống thưởng lặp: 'chk:<noteId>:t:<hash>' hoặc khoá cũ 'chk:<noteId>:<index>'
function rewardKey(noteId, index, note) {
  let t = null;
  try { t = note && typeof note === 'object' ? lineText(note.html, index) : null; } catch (_) { t = null; }
  return t ? `chk:${noteId}:t:${fnv1a(t)}` : `chk:${noteId}:${index}`;
}

module.exports = { normalizeText, lines, lineText, fnv1a, rewardKey };
