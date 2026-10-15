'use strict';
// Logic thuần của phòng paper (không phụ thuộc electron) — để kiểm thử bằng node.
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const SHAPES = ['free', 'square', 'tall', 'mini'];
const MIN_W = 220, MIN_H = 160, MAX_W = 1200, MAX_H = 1200;
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

function defaults() {
  return { v: 1, settings: defaultSettings(), noteMeta: {} };
}
function defaultSettings() {
  return { defaultPaper: null, defaultFont: null, hideDeco: false, tilt: false, hiddenPapers: [], randomPaper: false };
}

// id mẫu/phông: chuỗi [a-z0-9-] dài 1..40, ngược lại null
function cleanId(v) {
  return typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
}
// danh sách id mẫu ẩn: chỉ chuỗi [a-z0-9-]{1,64}, bỏ trùng, tối đa 200
function cleanHidden(a) {
  const out = [];
  if (!Array.isArray(a)) return out;
  const seen = new Set();
  for (const v of a) {
    if (typeof v !== 'string' || !/^[a-z0-9-]{1,64}$/.test(v) || seen.has(v)) continue;
    seen.add(v); out.push(v);
    if (out.length >= 200) break;
  }
  return out;
}
function okNoteId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !BAD.has(id);
}

// Áp một khoá vào meta; trả về true nếu hợp lệ. value null => xoá.
function setMetaKey(meta, k, v) {
  if (v === null) { delete meta[k]; return true; }
  if (k === 'paper' || k === 'font') { const s = cleanId(v); if (!s) return false; meta[k] = s; return true; }
  if (k === 'shape') { if (SHAPES.indexOf(v) < 0) return false; meta[k] = v; return true; }
  if (k === 'tilt' || k === 'deco') { if (typeof v !== 'boolean') return false; meta[k] = v; return true; }
  return false; // khoá lạ
}

function normalizeMeta(m) {
  const out = {};
  if (!isObj(m)) return out;
  for (const k of ['paper', 'font', 'shape', 'tilt', 'deco']) {
    if (own(m, k) && m[k] !== null) setMetaKey(out, k, m[k]);
  }
  return out;
}

function normalizeSettings(s) {
  const out = defaultSettings();
  if (!isObj(s)) return out;
  if (own(s, 'defaultPaper')) out.defaultPaper = cleanId(s.defaultPaper);
  if (own(s, 'defaultFont')) out.defaultFont = cleanId(s.defaultFont);
  if (typeof s.hideDeco === 'boolean') out.hideDeco = s.hideDeco;
  if (typeof s.tilt === 'boolean') out.tilt = s.tilt;
  out.hiddenPapers = cleanHidden(s.hiddenPapers);
  if (typeof s.randomPaper === 'boolean') out.randomPaper = s.randomPaper;
  return out;
}

// Ném lỗi nếu hỏng hẳn (store sẽ dùng defaults()).
function normalize(stored) {
  if (!isObj(stored)) throw new Error('paper: bad root');
  const out = { v: 1, settings: normalizeSettings(stored.settings), noteMeta: {} };
  const nm = stored.noteMeta;
  if (isObj(nm)) {
    for (const id of Object.keys(nm)) {
      if (!okNoteId(id)) continue;
      const m = normalizeMeta(nm[id]);
      if (Object.keys(m).length) out.noteMeta[id] = m;
    }
  }
  return out;
}

// Trả meta mới (không sửa meta cũ). Khoá không hợp lệ bị bỏ qua.
function applyPatch(meta, patch) {
  const out = normalizeMeta(meta);
  if (!isObj(patch)) return out;
  for (const k of Object.keys(patch)) {
    if (BAD.has(k)) continue;
    setMetaKey(out, k, patch[k]);
  }
  return out;
}

function applySettings(settings, patch) {
  const out = normalizeSettings(settings);
  if (!isObj(patch)) return out;
  if (own(patch, 'defaultPaper')) { if (patch.defaultPaper === null) out.defaultPaper = null; else { const s = cleanId(patch.defaultPaper); if (s) out.defaultPaper = s; } }
  if (own(patch, 'defaultFont')) { if (patch.defaultFont === null) out.defaultFont = null; else { const s = cleanId(patch.defaultFont); if (s) out.defaultFont = s; } }
  if (typeof patch.hideDeco === 'boolean') out.hideDeco = patch.hideDeco;
  if (typeof patch.tilt === 'boolean') out.tilt = patch.tilt;
  if (typeof patch.randomPaper === 'boolean') out.randomPaper = patch.randomPaper;
  if (own(patch, 'hiddenPapers') && Array.isArray(patch.hiddenPapers)) out.hiddenPapers = cleanHidden(patch.hiddenPapers);
  return out;
}

// Meta mặc định cho note mới (hoặc null nếu chưa chọn mẫu mặc định)
function defaultFor(settings) {
  const s = normalizeSettings(settings);
  if (!s.defaultPaper) return null;
  const m = { paper: s.defaultPaper };
  if (s.defaultFont) m.font = s.defaultFont;
  return m;
}

// Chọn ngẫu nhiên một mẫu thiết kế (trang trí thuần, không liên quan nhắc lịch).
// ids: danh sách id mẫu thiết kế (không gồm nhóm plain); loại hidden; tránh `last` nếu còn mẫu khác.
// rng: () => [0,1) để kiểm thử tất định. Trả id hoặc null nếu không còn mẫu nào.
function pickRandomPaper(ids, hidden, last, rng) {
  const hid = new Set(Array.isArray(hidden) ? hidden : []);
  let pool = (Array.isArray(ids) ? ids : []).filter(id => cleanId(id) && !hid.has(id));
  if (!pool.length) return null;
  if (pool.length > 1 && last) { const p2 = pool.filter(id => id !== last); if (p2.length) pool = p2; }
  const f = typeof rng === 'function' ? rng : Math.random;
  let r = Number(f());
  if (!Number.isFinite(r) || r < 0) r = 0;
  return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
}
// Meta cho note mới: random (nếu bật và còn mẫu) rồi mới tới mẫu mặc định. Font mặc định vẫn áp.
function metaForNewNote(settings, ids, last, rng) {
  const s = normalizeSettings(settings);
  if (s.randomPaper) {
    const id = pickRandomPaper(ids, s.hiddenPapers, last, rng);
    if (id) { const m = { paper: id }; if (s.defaultFont) m.font = s.defaultFont; return m; }
  }
  return defaultFor(s);
}

function cleanIndex(i) {
  const n = Number(i);
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
}

// Kẹp kích thước yêu cầu vào [min,max] và vào vùng làm việc; giữ góc trái trên nếu vừa, ngược lại dịch vào.
// cur = {x,y,width,height}, wa = {x,y,width,height} | null. Trả {x,y,width,height} hoặc null nếu size hỏng.
function clampBounds(size, cur, wa) {
  if (!isObj(size)) return null;
  let w = Number(size.width), h = Number(size.height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  w = Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));
  h = Math.round(Math.min(MAX_H, Math.max(MIN_H, h)));
  let x = cur && Number.isFinite(cur.x) ? cur.x : 0, y = cur && Number.isFinite(cur.y) ? cur.y : 0;
  if (wa && Number.isFinite(wa.width) && Number.isFinite(wa.height)) {
    w = Math.min(w, Math.max(MIN_W, wa.width));
    h = Math.min(h, Math.max(MIN_H, wa.height));
    if (x + w > wa.x + wa.width) x = wa.x + wa.width - w;
    if (y + h > wa.y + wa.height) y = wa.y + wa.height - h;
    if (x < wa.x) x = wa.x;
    if (y < wa.y) y = wa.y;
  }
  return { x: Math.round(x), y: Math.round(y), width: w, height: h };
}

module.exports = {
  BAD, SHAPES, defaults, defaultSettings, cleanId, cleanHidden, okNoteId, normalizeMeta, normalizeSettings,
  normalize, applyPatch, applySettings, defaultFor, pickRandomPaper, metaForNewNote, cleanIndex, clampBounds
};
