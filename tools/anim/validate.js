'use strict';
// Kiểm gói hình động: node tools/anim/validate.js <packDir> [--json]
// Thoát mã 1 nếu có LỖI, 0 nếu chỉ cảnh báo/không có gì.
const fs = require('fs');
const path = require('path');
const { loadPack, MOODS, PHASES } = require('../../src/main/petcore/pack');
const png = require('./png');

const REQUIRED_ERR = ['idle'];
const OPTIONAL_WARN = ['climb', 'point', 'write', 'knock', 'carry_note', 'crumple', 'throw', 'peek_note', 'sit_on_note', 'yawn', 'stretch', 'read', 'cheer', 'play_cat']; // Đợt 2: thiếu chỉ nhắc nhẹ (engine mượn từ gói dự phòng)
const REQUIRED_WARN = ['walk', 'sit', 'sleep', 'pat_head', 'pat_body', 'lifted', 'fall', 'land', 'peek_left', 'peek_right', 'hold_note', 'ring', 'happy', 'sad', 'shy', 'angry', 'eat', 'work', 'wave', 'startup', 'shutdown', 'say'];

function validate(dir) {
  const errors = [], warnings = [], table = [];
  let pack;
  try { pack = loadPack(dir); } catch (e) { return { ok: false, errors: [e.message], warnings, table, frames: 0 }; }
  warnings.push(...pack.warnings);
  const raw = JSON.parse(fs.readFileSync(path.join(pack.dir, 'pack.json'), 'utf8').replace(/^﻿/, ''));
  const isArr = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && isFinite(x));
  for (const k of ['id', 'name', 'author', 'license']) if (typeof raw[k] !== 'string' || !raw[k]) errors.push(`pack.json thiếu/sai "${k}" (chuỗi)`);
  if (!isArr(raw.size, 2) || raw.size[0] <= 0 || raw.size[1] <= 0) errors.push('pack.json "size" phải là [w,h] dương');
  if (typeof raw.scale !== 'number' || raw.scale <= 0) errors.push('pack.json "scale" phải là số dương');
  if (!isArr(raw.anchor, 2)) errors.push('pack.json "anchor" phải là [x,y]');
  if (!isArr(raw.hand, 2)) errors.push('pack.json "hand" phải là [x,y]');
  if (!raw.hitbox || !isArr(raw.hitbox.head, 4) || !isArr(raw.hitbox.body, 4)) errors.push('pack.json "hitbox" phải có head/body dạng [x,y,w,h]');
  if (raw.faces !== undefined && (typeof raw.faces !== 'object' || Array.isArray(raw.faces))) errors.push('pack.json "faces" phải là đối tượng');
  if (raw.actions !== undefined && (typeof raw.actions !== 'object' || Array.isArray(raw.actions))) errors.push('pack.json "actions" phải là đối tượng');
  const [W, H] = pack.size;
  const inCanvas = (x, y) => x >= 0 && y >= 0 && x <= W && y <= H;
  if (isArr(raw.anchor, 2) && !inCanvas(...raw.anchor)) errors.push(`anchor ${JSON.stringify(raw.anchor)} nằm ngoài canvas ${W}x${H}`);
  if (isArr(raw.hand, 2) && !inCanvas(...raw.hand)) errors.push(`hand ${JSON.stringify(raw.hand)} nằm ngoài canvas`);
  for (const k of ['head', 'body']) {
    const b = raw.hitbox && raw.hitbox[k];
    if (isArr(b, 4) && (b[2] <= 0 || b[3] <= 0 || b[0] < 0 || b[1] < 0 || b[0] + b[2] > W || b[1] + b[3] > H)) errors.push(`hitbox.${k} ${JSON.stringify(b)} vượt canvas`);
  }
  for (const [k, rel] of Object.entries(pack.faces)) {
    const f = path.join(pack.dir, rel);
    if (!fs.existsSync(f)) { errors.push(`faces.${k}: thiếu file ${rel}`); continue; }
    try { png.readSize(f); } catch (e) { errors.push(`faces.${k}: ${rel} không phải PNG hợp lệ`); }
  }
  // action bắt buộc
  for (const a of REQUIRED_ERR) if (!pack.anims[a]) errors.push(`Thiếu action bắt buộc "${a}"`);
  for (const a of REQUIRED_WARN) if (!pack.anims[a]) warnings.push(`Thiếu action "${a}" (engine sẽ rơi về idle)`);
  for (const a of OPTIONAL_WARN) if (!pack.anims[a]) warnings.push(`Thiếu action tuỳ chọn "${a}" (sẽ mượn từ gói dự phòng "placeholder")`);
  if (pack.anims.idle && !pack.anims.idle.normal) warnings.push('idle thiếu mood normal');
  for (const a of Object.keys(pack.params)) if (!pack.anims[a]) warnings.push(`pack.json.actions.${a} không có hình tương ứng`);
  // khung
  let frames = 0;
  for (const [a, moods] of Object.entries(pack.anims)) for (const [m, phases] of Object.entries(moods)) for (const p of PHASES) {
    const list = phases[p]; if (!list) continue;
    let ms = 0, bad = 0;
    for (const fr of list) {
      frames++; ms += fr.ms;
      const f = path.join(pack.dir, fr.src);
      try {
        const sz = png.readSize(f);
        if (sz.w !== W || sz.h !== H) { errors.push(`${fr.src}: kích thước ${sz.w}x${sz.h} ≠ ${W}x${H}`); bad++; continue; }
        if (sz.bitDepth !== 8) warnings.push(`${fr.src}: ${sz.bitDepth} bit/kênh (khuyên 8)`);
        if (sz.interlace) warnings.push(`${fr.src}: PNG interlace`);
        // alpha: kênh alpha, hoặc bảng màu có tRNS (kiểm bằng giải mã)
        let alpha = sz.hasAlpha;
        let img = null;
        if (alpha === null || alpha === true) { img = png.decode(f); alpha = img.hasAlpha; }
        if (!alpha) { errors.push(`${fr.src}: PNG không có kênh alpha`); bad++; continue; }
        img = img || png.decode(f);
        if (!png.alphaBounds(img, 0)) warnings.push(`${fr.src}: khung hoàn toàn trong suốt`);
        else if (img.data[3] > 0 && img.data[(W * H - 1) * 4 + 3] > 0 && img.data[(W - 1) * 4 + 3] > 0 && img.data[(W * (H - 1)) * 4 + 3] > 0) warnings.push(`${fr.src}: nền có vẻ không trong suốt (4 góc đặc)`);
      } catch (e) { errors.push(`${fr.src}: PNG hỏng — ${e.message}`); bad++; }
    }
    table.push({ action: a, mood: m, phase: p, frames: list.length, ms, bad });
  }
  return { ok: errors.length === 0, id: pack.id, size: pack.size, scale: pack.scale, anchor: pack.anchor, hand: pack.hand, errors, warnings, table, frames };
}

if (require.main === module) {
  const args = process.argv.slice(2), json = args.includes('--json'), dir = args.find((a) => !a.startsWith('--'));
  if (!dir) { console.error('Dùng: node tools/anim/validate.js <packDir> [--json]'); process.exit(2); }
  const r = validate(dir);
  if (json) console.log(JSON.stringify(r, null, 2));
  else {
    if (r.table.length) {
      console.log(`Gói "${r.id}"  canvas ${r.size.join('x')}  scale ${r.scale}  anchor [${r.anchor}]  hand [${r.hand}]`);
      const wa = Math.max(6, ...r.table.map((t) => t.action.length));
      console.log(`${'action'.padEnd(wa)}  mood    phase   khung   tổng ms`);
      for (const t of r.table) console.log(`${t.action.padEnd(wa)}  ${t.mood.padEnd(6)}  ${t.phase.padEnd(6)}  ${String(t.frames).padStart(5)}  ${String(t.ms).padStart(8)}${t.bad ? '  (lỗi ' + t.bad + ')' : ''}`);
    }
    console.log(`\nTổng ${r.frames} khung.`);
    for (const w of r.warnings) console.log('CẢNH BÁO: ' + w);
    for (const e of r.errors) console.log('LỖI: ' + e);
    console.log(r.ok ? `OK (${r.warnings.length} cảnh báo)` : `HỎNG (${r.errors.length} lỗi, ${r.warnings.length} cảnh báo)`);
  }
  process.exit(r.ok ? 0 : 1);
}
module.exports = { validate };
