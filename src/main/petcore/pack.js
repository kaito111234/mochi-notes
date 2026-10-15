'use strict';
// Đọc gói hình động của bé (xem docs/spec/03-animation.md, docs/rooms/core/ARCH.md mục 1).
// Node thuần — không require electron ở top-level.
const fs = require('fs');
const path = require('path');

const MOODS = ['happy', 'normal', 'tired', 'sad'];
const PHASES = ['single', 'start', 'loop', 'end'];
const FRAME_RE = /^(\d+)(?:_(\d+))?\.png$/i;
const DEFAULT_MS = 100;

function isNum(v) { return typeof v === 'number' && isFinite(v); }
function numArr(v, n) { return Array.isArray(v) && v.length === n && v.every(isNum); }

function readDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return []; }
}

// Đọc các khung trong <dir>/<action>/<mood>/<phase>/
function readFrames(dir, rel, warnings) {
  const items = [];
  for (const ent of readDirs(path.join(dir, rel))) {
    if (!ent.isFile()) continue;
    const m = FRAME_RE.exec(ent.name);
    if (!m) {
      if (!/\.png$/i.test(ent.name)) continue; // không phải png: bỏ qua im lặng
      warnings.push(`Tên khung không đúng mẫu <số>_<ms>.png: ${rel}/${ent.name}`);
      continue;
    }
    const ms = m[2] ? parseInt(m[2], 10) : DEFAULT_MS;
    items.push({ n: parseInt(m[1], 10), name: ent.name, ms: ms > 0 ? ms : DEFAULT_MS });
  }
  items.sort((a, b) => a.n - b.n || (a.name < b.name ? -1 : 1));
  return items.map((it) => ({ src: `${rel}/${it.name}`, ms: it.ms }));
}

function loadPack(dir) {
  dir = path.resolve(dir);
  const file = path.join(dir, 'pack.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (e) { throw new Error(`Không đọc được ${file}: ${e.message}`); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${file}: nội dung không phải đối tượng JSON`);

  const warnings = [];
  const id = typeof raw.id === 'string' && raw.id ? raw.id : path.basename(dir);
  if (!raw.id) warnings.push('pack.json thiếu "id" — dùng tên thư mục');

  let size = raw.size;
  if (!numArr(size, 2) || size[0] <= 0 || size[1] <= 0) { warnings.push('pack.json "size" sai/thiếu — dùng [256,256]'); size = [256, 256]; }
  let scale = raw.scale;
  if (!isNum(scale) || scale <= 0) { if (scale !== undefined) warnings.push('"scale" sai — dùng 1'); scale = 1; }
  let anchor = raw.anchor;
  if (!numArr(anchor, 2)) { warnings.push('"anchor" sai/thiếu — dùng giữa đáy canvas'); anchor = [Math.round(size[0] / 2), size[1] - 4]; }
  let hand = raw.hand;
  if (!numArr(hand, 2)) { warnings.push('"hand" sai/thiếu — dùng giữa thân'); hand = [Math.round(size[0] / 2), Math.round(size[1] / 2)]; }
  const hb = raw.hitbox && typeof raw.hitbox === 'object' ? raw.hitbox : {};
  const hitbox = {};
  for (const k of ['head', 'body']) {
    if (numArr(hb[k], 4)) hitbox[k] = hb[k].slice();
    else {
      warnings.push(`"hitbox.${k}" sai/thiếu — dùng mặc định`);
      hitbox[k] = k === 'head' ? [0, 0, size[0], Math.round(size[1] / 2)] : [0, Math.round(size[1] / 2), size[0], Math.round(size[1] / 2)];
    }
  }

  const faces = {};
  if (raw.faces && typeof raw.faces === 'object') {
    for (const [k, v] of Object.entries(raw.faces)) {
      if (typeof v !== 'string') { warnings.push(`faces.${k} không phải chuỗi`); continue; }
      const rel = v.replace(/\\/g, '/');
      if (rel.startsWith('/') || rel.split('/').includes('..')) { warnings.push(`faces.${k} đường dẫn không an toàn: ${v}`); continue; }
      if (!fs.existsSync(path.join(dir, rel))) warnings.push(`faces.${k} không tồn tại: ${rel}`);
      faces[k] = rel;
    }
  }
  const params = raw.actions && typeof raw.actions === 'object' && !Array.isArray(raw.actions) ? raw.actions : {};

  const anims = {};
  for (const a of readDirs(dir)) {
    if (!a.isDirectory() || a.name === 'faces' || a.name.startsWith('.')) continue;
    const action = a.name;
    for (const m of readDirs(path.join(dir, action))) {
      if (!m.isDirectory()) continue;
      if (!MOODS.includes(m.name)) { warnings.push(`Mood lạ "${m.name}" trong ${action}/ — bỏ qua`); continue; }
      for (const p of readDirs(path.join(dir, action, m.name))) {
        if (!p.isDirectory()) continue;
        if (!PHASES.includes(p.name)) { warnings.push(`Phase lạ "${p.name}" trong ${action}/${m.name}/ — bỏ qua`); continue; }
        const frames = readFrames(dir, `${action}/${m.name}/${p.name}`, warnings);
        if (!frames.length) { warnings.push(`Thư mục rỗng: ${action}/${m.name}/${p.name}`); continue; }
        ((anims[action] = anims[action] || {})[m.name] = anims[action][m.name] || {})[p.name] = frames;
      }
    }
  }
  if (!Object.keys(anims).length) warnings.push('Gói không có khung hình nào');

  return {
    id, name: typeof raw.name === 'string' ? raw.name : id,
    author: typeof raw.author === 'string' ? raw.author : '',
    license: typeof raw.license === 'string' ? raw.license : '',
    dir, size: size.slice(), scale, anchor: anchor.slice(), hand: hand.slice(), hitbox, faces, params, anims, warnings,
  };
}

// Thư mục chứa các gói: [assets/pet, userData/pets]
function packDirs(ctx) {
  const dirs = [path.join(__dirname, '..', '..', '..', 'assets', 'pet')];
  let ud = ctx && (ctx.userData || ctx.userDataDir);
  if (!ud && ctx) {
    try { ud = require('electron').app.getPath('userData'); } catch (e) { ud = null; }
  }
  if (ud) dirs.push(path.join(ud, 'pets'));
  return dirs;
}

// Tìm thư mục gói theo id (thư mục cùng tên hoặc pack.json có id khớp); thư mục sau thắng thư mục trước.
function findPack(id, dirs) {
  let found = null;
  for (const d of dirs || []) {
    for (const ent of readDirs(d)) {
      if (!ent.isDirectory()) continue;
      const p = path.join(d, ent.name);
      if (!fs.existsSync(path.join(p, 'pack.json'))) continue;
      let ok = ent.name === id;
      if (!ok) {
        try { ok = JSON.parse(fs.readFileSync(path.join(p, 'pack.json'), 'utf8').replace(/^﻿/, '')).id === id; } catch (e) { ok = false; }
      }
      if (ok) found = p;
    }
  }
  return found;
}

module.exports = { loadPack, packDirs, findPack, MOODS, PHASES };
