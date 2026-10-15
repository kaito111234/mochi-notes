'use strict';
// Nén tại chỗ các PNG RGBA thành PNG bảng màu (≤256 màu). Dùng: node tools/rig/quantize.js <thư mục|file>... [--max 128] [--keep 16]
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/util');
const { quantizeFile, walk } = require('./lib/quant');
const a = parseArgs(process.argv.slice(2));
if (!a._.length) { console.error('Dùng: node tools/rig/quantize.js <thư mục|file.png>... [--max 128] [--keep 16]'); process.exit(1); }
const files = a._.flatMap(p => fs.statSync(p).isDirectory() ? walk(p) : [p]);
const t0 = Date.now(); let b = 0, af = 0, skipped = 0, exact = 0;
for (const f of files) {
  try {
    const r = quantizeFile(f, { maxColors: +a.max || 128, keepExact: a.keep === undefined ? 16 : +a.keep });
    b += r.before; af += r.after; if (r.skipped) skipped++; if (r.exact) exact++;
  } catch (e) { console.error(`${f}: ${e.message}`); process.exitCode = 1; }
}
const mb = (x) => (x / 1048576).toFixed(2) + ' MB';
console.log(`quantize: ${files.length} PNG, ${mb(b)} → ${mb(af)} (${(b / Math.max(1, af)).toFixed(1)}×), giữ nguyên chính xác ${exact}, bỏ qua (không nhỏ hơn) ${skipped}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
