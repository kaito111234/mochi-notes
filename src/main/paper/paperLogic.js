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
  return { defaultPaper: null, defaultFont: null, hideDeco: false, tilt: false };
}

// id mẫu/phông: chuỗi [a-z0-9-] dài 1..40, ngược lại null
function cleanId(v) {
  return typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
}
function okNoteId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !BAD.has(id);
}

// Áp một khoá vào meta; trả về true nếu hợp lệ. value null => xoá.
function setMetaKey(meta, k, v) {
  if (v === null) { delete meta[k]; return true; }
  if (k === 'paper' || k === 'font' || k === 'pin' || k === 'pinColor') { const s = cleanId(v); if (!s) return false; meta[k] = s; return true; }
  if (k === 'shape') { if (SHAPES.indexOf(v) < 0) return false; meta[k] = v; return true; }
  if (k === 'tilt' || k === 'deco') { if (typeof v !== 'boolean') return false; meta[k] = v; return true; }
  return false; // khoá lạ
}

function normalizeMeta(m) {
  const out = {};
  if (!isObj(m)) return out;
  for (const k of ['paper', 'font', 'shape', 'tilt', 'deco', 'pin', 'pinColor']) {
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
  BAD, SHAPES, defaults, defaultSettings, cleanId, okNoteId, normalizeMeta, normalizeSettings,
  normalize, applyPatch, applySettings, defaultFor, cleanIndex, clampBounds
};
