#!/usr/bin/env node
'use strict';
// Kiểm tra gói hình thú ảo (cho phòng art tự kiểm trước khi bàn giao).
//   node tools/check-pack.js [thư-mục-gói]        mặc định: assets/pet/mochi
// Kiểm: số khung mỗi action/mood/phase, kích thước PNG (đọc header, không giải mã), tên file NNNN_ms.png,
// mặt nạ đồ mặc tương ứng (masks/<đường dẫn khung>), head.json / head_side.json, và bộ dáng nghiêng (walk_side...).
// Thoát mã 1 nếu có LỖI; cảnh báo/thiếu tuỳ chọn không làm hỏng. Node thuần, không cần cài gì.
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'assets', 'pet', 'mochi'));
const MOODS = ['happy', 'normal', 'tired', 'sad'];
const PHASES = ['single', 'start', 'loop', 'end'];
const SIDE_ACTIONS = ['walk_side', 'turn_side', 'run_side'];
const NAME_RE = /^(\d{4})_(\d+)\.png$/;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const errors = [], warns = [], notes = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

function ls(p) { try { return fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return []; } }
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch (e) { return null; }
}

// Đọc IHDR: {w, h, colorType} hoặc null nếu không phải PNG
function pngInfo(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(26);
    const n = fs.readSync(fd, b, 0, 26, 0);
    if (n < 26 || !b.subarray(0, 8).equals(PNG_SIG) || b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
  } catch (e) { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* bỏ qua */ } }
}

if (!fs.existsSync(path.join(dir, 'pack.json'))) { console.error('Không thấy pack.json trong ' + dir); process.exit(2); }
const pack = readJson(path.join(dir, 'pack.json'));
if (!pack) { console.error('pack.json không đọc được (sai JSON?)'); process.exit(2); }
const size = Array.isArray(pack.size) && pack.size.length === 2 ? pack.size : [400, 400];
console.log('Gói: ' + (pack.id || path.basename(dir)) + '   thư mục: ' + dir);
console.log('Cỡ khung theo pack.json: ' + size[0] + 'x' + size[1] + '   anchor: ' + JSON.stringify(pack.anchor) + '\n');

// ---- quét action/mood/phase
const table = [];            // {action, mood, phase, n, ms}
const headJson = readJson(path.join(dir, 'masks', 'head.json')) || {};
const headSide = readJson(path.join(dir, 'masks', 'head_side.json'));
let totalFrames = 0;
const byAction = {};

for (const a of ls(dir)) {
  if (!a.isDirectory() || a.name === 'faces' || a.name === 'masks' || a.name.startsWith('.')) continue;
  const action = a.name;
  for (const m of ls(path.join(dir, action))) {
    if (!m.isDirectory()) { continue; }
    if (!MOODS.includes(m.name)) { err(`${action}/${m.name}: mood lạ (chỉ ${MOODS.join(', ')})`); continue; }
    for (const p of ls(path.join(dir, action, m.name))) {
      if (!p.isDirectory()) continue;
      if (!PHASES.includes(p.name)) { err(`${action}/${m.name}/${p.name}: phase lạ (chỉ ${PHASES.join(', ')})`); continue; }
      const rel = `${action}/${m.name}/${p.name}`;
      const files = ls(path.join(dir, rel)).filter((e) => e.isFile());
      const nums = [];
      let ms = 0, n = 0;
      for (const f of files) {
        if (!/\.png$/i.test(f.name)) { warn(`${rel}/${f.name}: không phải .png`); continue; }
        const mm = NAME_RE.exec(f.name);
        if (!mm) { err(`${rel}/${f.name}: tên sai mẫu NNNN_ms.png (vd 0001_110.png — 4 chữ số, gạch dưới, số ms)`); continue; }
        const num = parseInt(mm[1], 10), dur = parseInt(mm[2], 10);
        if (dur < 16 || dur > 2000) warn(`${rel}/${f.name}: thời lượng ${dur}ms bất thường (nên 40..400)`);
        nums.push(num); ms += dur; n++;
        const info = pngInfo(path.join(dir, rel, f.name));
        if (!info) { err(`${rel}/${f.name}: không phải PNG hợp lệ`); continue; }
        if (info.w !== size[0] || info.h !== size[1]) err(`${rel}/${f.name}: cỡ ${info.w}x${info.h}, cần ${size[0]}x${size[1]}`);
        if (info.colorType !== 6) warn(`${rel}/${f.name}: không phải RGBA (colorType=${info.colorType}) — cần nền trong suốt`);
        totalFrames++;
        // mặt nạ tương ứng
        const maskFile = path.join(dir, 'masks', rel, f.name);
        const hasMask = fs.existsSync(maskFile);
        if (hasMask) {
          const mi = pngInfo(maskFile);
          if (!mi) err(`masks/${rel}/${f.name}: mặt nạ không phải PNG`);
          else if (mi.w !== info.w || mi.h !== info.h) err(`masks/${rel}/${f.name}: cỡ mặt nạ ${mi.w}x${mi.h} khác khung ${info.w}x${info.h}`);
        }
        (byAction[action] = byAction[action] || { frames: 0, masks: 0, heads: 0 });
        byAction[action].frames++;
        if (hasMask) byAction[action].masks++;
        const key = `${rel}/${f.name}`;
        if (headJson[key] || (headSide && headSide[key])) byAction[action].heads++;
      }
      if (!n) { warn(`${rel}: thư mục rỗng`); continue; }
      nums.sort((x, y) => x - y);
      for (let i = 0; i < nums.length; i++) if (nums[i] !== i + 1) { err(`${rel}: số thứ tự khung phải liên tục từ 0001 (có ${nums.join(',')})`); break; }
      table.push({ action, mood: m.name, phase: p.name, n, ms });
    }
  }
}

// ---- in bảng
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
console.log(pad('action', 12) + pad('mood', 8) + pad('phase', 8) + pad('khung', 7) + pad('tổng ms', 9) + 'mặt nạ');
for (const r of table) {
  const rel = `${r.action}/${r.mood}/${r.phase}`;
  let withMask = 0;
  for (const f of ls(path.join(dir, rel))) if (NAME_RE.test(f.name) && fs.existsSync(path.join(dir, 'masks', rel, f.name))) withMask++;
  const mk = withMask === r.n ? 'đủ' : withMask === 0 ? '-' : `${withMask}/${r.n}`;
  console.log(pad(r.action, 12) + pad(r.mood, 8) + pad(r.phase, 8) + pad(r.n, 7) + pad(r.ms, 9) + mk);
}
console.log(`\nTổng ${totalFrames} khung, ${table.length} bộ.`);

// ---- bộ dáng nghiêng
console.log('\n== Dáng nghiêng (walk_side / turn_side / run_side) ==');
const has = (action, mood, phase) => table.some((r) => r.action === action && (!mood || r.mood === mood) && (!phase || r.phase === phase));
const cnt = (action, mood, phase) => { const r = table.find((x) => x.action === action && x.mood === mood && x.phase === phase); return r ? r.n : 0; };
if (!SIDE_ACTIONS.some((a) => has(a))) {
  console.log('Chưa có walk_side — chưa có dáng nghiêng (bình thường; bé vẫn đi bằng dáng nhìn thẳng xoay nghiêng).');
} else {
  if (!has('walk_side', 'normal', 'loop')) err('walk_side: BẮT BUỘC có walk_side/normal/loop/ (mood normal)');
  else {
    const n = cnt('walk_side', 'normal', 'loop');
    if (n < 6) warn(`walk_side/normal/loop chỉ ${n} khung (khuyến nghị 8)`);
    console.log(`walk_side/normal/loop: ${n} khung`);
  }
  if (!has('turn_side')) notes.push('turn_side: chưa có (tuỳ chọn) — bé sẽ chuyển thẳng sang dáng nghiêng không có khung quay.');
  else {
    if (!has('turn_side', null, 'start')) warn('turn_side thiếu phase start (nhìn thẳng -> nghiêng)');
    if (!has('turn_side', null, 'end')) notes.push('turn_side chưa có phase end (nghiêng -> thẳng) — chỉ dùng được lúc bắt đầu đi.');
  }
  if (!has('run_side')) notes.push('run_side: chưa có (tuỳ chọn) — chạy nhanh sẽ dùng walk_side.');
  else if (!has('run_side', null, 'loop')) err('run_side cần phase loop');
  for (const a of SIDE_ACTIONS) {
    const st = byAction[a];
    if (!st) continue;
    if (st.masks === 0) notes.push(`${a}: chưa có mặt nạ masks/${a}/... — áo sẽ KHÔNG đổi màu theo đồ mặc khi đi nghiêng.`);
    else if (st.masks < st.frames) warn(`${a}: mặt nạ thiếu ${st.frames - st.masks}/${st.frames} khung`);
  }
  if (!headSide) notes.push('masks/head_side.json: chưa có — khi đi nghiêng sẽ ẨN đồ đội đầu/kính/kẹp/đồ cầm tay.');
  else {
    let miss = 0, bad = 0;
    for (const r of table) {
      if (!SIDE_ACTIONS.includes(r.action)) continue;
      for (const f of ls(path.join(dir, `${r.action}/${r.mood}/${r.phase}`))) {
        if (!NAME_RE.test(f.name)) continue;
        const v = headSide[`${r.action}/${r.mood}/${r.phase}/${f.name}`];
        if (v === undefined) miss++;
        else if (!Array.isArray(v) || (v.length !== 2 && v.length !== 3) || !v.every((x) => typeof x === 'number' && isFinite(x))) bad++;
      }
    }
    if (bad) err(`head_side.json: ${bad} mục sai định dạng (cần [dx, dy] hoặc [dx, dy, tỉ lệ đầu] là số)`);
    if (miss) warn(`head_side.json: thiếu ${miss} khung (khung nào thiếu sẽ ẩn đồ đội đầu/cầm tay)`);
    if (!bad && !miss) console.log('head_side.json: đủ mọi khung nghiêng');
  }
  if (pack.side !== undefined) {
    const s = pack.side;
    if (!s || typeof s !== 'object') err('pack.json "side" phải là đối tượng { anchor, hand, head }');
    else {
      const ok = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number');
      if (s.anchor !== undefined && !ok(s.anchor, 2)) err('side.anchor phải là [x,y]');
      if (s.hand !== undefined && !ok(s.hand, 2)) err('side.hand phải là [x,y]');
      if (s.head !== undefined && !ok(s.head, 4)) err('side.head phải là [x,y,w,h]');
    }
  }
}
// head.json: khoá trỏ tới khung không tồn tại
for (const [label, hj] of [['head.json', headJson], ['head_side.json', headSide]]) {
  if (!hj) continue;
  let dead = 0;
  for (const k of Object.keys(hj)) if (!fs.existsSync(path.join(dir, k))) dead++;
  if (dead) warn(`${label}: ${dead} khoá trỏ tới khung không tồn tại`);
}

console.log('');
for (const m of notes) console.log('GHI CHÚ : ' + m);
for (const m of warns) console.log('CẢNH BÁO: ' + m);
for (const m of errors) console.log('LỖI     : ' + m);
console.log(`\nKết quả: ${errors.length} lỗi, ${warns.length} cảnh báo, ${notes.length} ghi chú.`);
process.exit(errors.length ? 1 : 0);
