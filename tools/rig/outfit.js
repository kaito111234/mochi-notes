'use strict';
// Dựng gói hình cho một tổ hợp đồ: thân (slot body) × áo khoác (slot outer).
//   node tools/rig/outfit.js --body body_default --outer outer_black_white --out <dir> [--only a,b] [--faces] [--keep-svg] [--frames-only]
//        [--outer none] [--wardrobe assets/wardrobe] [--rig <rig.json>] [--parts <parts gốc>] [--actions dir] [--keep-tmp]
// Cách làm: thư mục parts tạm = parts gốc (đã bỏ outer_*) + chồng file của body + chồng file của outer,
// rồi gọi build.js (tiến trình con) với --parts <tạm> --rig <rig tạm>. Xem art/rig/mochi/WARDROBE.md.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, parseArgs, resolveFromRoot } = require('./lib/util');

const a = parseArgs(process.argv.slice(2), ['faces', 'keep-svg', 'frames-only', 'keep-tmp']);
const t0 = Date.now();
const rigPath = resolveFromRoot(a.rig || 'art/rig/mochi/rig.json');
const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8').replace(/^﻿/, ''));
const partsSrc = a.parts ? path.resolve(a.parts) : path.resolve(path.dirname(rigPath), rig.partsDir || 'parts');
const wardrobe = resolveFromRoot(a.wardrobe || 'assets/wardrobe');
const def = rig.defaultOutfit || {};
const bodyId = a.body && a.body !== true ? a.body : def.body;
const outerId = a.outer && a.outer !== true ? a.outer : (a.outer === undefined ? def.outer : 'none');
if (!a.out || a.out === true) { console.error('Thiếu --out <thư mục>'); process.exit(1); }
const out = path.resolve(a.out);

const die = (m) => { console.error('outfit: ' + m); process.exit(1); };
const isOuterFile = (f) => /^outer_/.test(path.basename(f));

function loadItem(id, slot) {
  const dir = path.join(wardrobe, id);
  const jf = path.join(dir, 'item.json');
  if (!fs.existsSync(jf)) die('không thấy ' + jf);
  const item = JSON.parse(fs.readFileSync(jf, 'utf8').replace(/^﻿/, ''));
  if (item.slot !== slot) die(`${id}: slot "${item.slot}" ≠ "${slot}"`);
  const files = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/');
      else if (/\.svg$/.test(e.name)) files.push(rel + e.name);
    }
  })(dir, '');
  for (const r of item.replaces || []) if (!files.includes(r)) die(`${id}: replaces "${r}" nhưng thiếu file`);
  for (const f of files) {
    if (slot === 'outer' && !isOuterFile(f)) die(`${id}: áo khoác chỉ được có file outer_*.svg (gặp ${f})`);
    if (slot === 'body' && isOuterFile(f)) die(`${id}: body không được có file outer_*.svg (gặp ${f})`);
  }
  return { item, dir, files };
}

const body = bodyId ? loadItem(bodyId, 'body') : null;
const outer = outerId && outerId !== 'none' ? loadItem(outerId, 'outer') : null;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-'));
const parts = path.join(tmp, 'parts');
fs.cpSync(partsSrc, parts, { recursive: true });

// 1) bỏ mọi outer_* trong parts gốc (kể cả biến thể): outer = none hoặc tự cung cấp bộ riêng
for (const f of fs.readdirSync(parts)) if (isOuterFile(f)) fs.rmSync(path.join(parts, f));
// 2) chồng body
const copyItem = (it) => { for (const f of it.files) { const d = path.join(parts, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(it.dir, f), d); } };
const EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"></svg>\n';
if (body) {
  copyItem(body);
  // hides: lớp bị ẩn hẳn khi mặc món này (ghi SVG rỗng đè bản gốc và mọi biến thể .xxx.svg)
  for (const id of body.item.hides || []) {
    const L = rig.layers.find(l => l.id === id);
    if (!L) die(`${bodyId}: hides lớp không tồn tại: ${id}`);
    const base = L.file.replace(/\.svg$/, '');
    const dir = path.join(parts, path.dirname(base)), stem = path.basename(base);
    for (const f of fs.readdirSync(dir)) if (f === stem + '.svg' || (f.startsWith(stem + '.') && f.endsWith('.svg'))) fs.writeFileSync(path.join(dir, f), EMPTY);
    if (!fs.existsSync(path.join(dir, stem + '.svg'))) fs.writeFileSync(path.join(dir, stem + '.svg'), EMPTY);
  }
}
// 3) chồng outer
if (outer) copyItem(outer);
// 4) rig tạm: áo khoác không che hẳn tay áo → item.json "keeps": ["forearm_l", ...] (bỏ khỏi covers); ghi đè partsDir
const tr = JSON.parse(JSON.stringify(rig));
tr.partsDir = parts;
const keeps = new Set(outer ? outer.item.keeps || [] : []);
for (const L of tr.layers) if (L.covers) L.covers = L.covers.filter(c => !keeps.has(c));
const rigTmp = path.join(tmp, 'rig.json');
fs.writeFileSync(rigTmp, JSON.stringify(tr));

const args = [path.join(__dirname, 'build.js'), '--rig', rigTmp, '--parts', parts, '--out', out];
if (a.only && a.only !== true) args.push('--only', a.only);
if (a.actions && a.actions !== true) args.push('--actions', resolveFromRoot(a.actions));
for (const f of ['faces', 'keep-svg', 'frames-only']) if (a[f]) args.push('--' + f);
console.log(`outfit: body=${bodyId || '(gốc)'} outer=${outer ? outerId : 'none'} → ${out}`);
const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
if (!a['keep-tmp']) fs.rmSync(tmp, { recursive: true, force: true }); else console.log('giữ thư mục tạm: ' + tmp);
if (r.status !== 0) process.exit(r.status || 1);
console.log(`outfit: xong sau ${((Date.now() - t0) / 1000).toFixed(1)}s`);
