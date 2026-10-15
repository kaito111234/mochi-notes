'use strict';
// Ảnh so sánh cho phòng duyệt, ghi vào art/review/ (ghép bằng Electron: SVG nhúng PNG data-URI + nhãn chữ; không cần Python).
//   node tools/rig/sheet.js --contact <action> [--pack assets/pet/mochi] [--cols 8] [--cell 200]
//   node tools/rig/sheet.js --faces [--pack assets/pet/mochi]
//   node tools/rig/sheet.js --compare [--parts dir] [--rig ...]
const fs = require('fs');
const path = require('path');
const { loadRig } = require('./lib/rig');
const png = require('../anim/png');
const { ROOT, parseArgs, resolveFromRoot, xmlEsc, renderJobs } = require('./lib/util');

const a = parseArgs(process.argv.slice(2), ['faces', 'compare']);
const pack = path.resolve(a.pack || path.join(ROOT, 'assets/pet/mochi'));
const reviewDir = path.join(ROOT, 'art', 'review');
const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const FONT = 'font-family="DejaVu Sans, Noto Sans, Arial, sans-serif"';
const text = (x, y, s, size = 11, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${FONT} fill="#222" text-anchor="middle" ${extra}>${xmlEsc(s)}</text>`;

function grid(items, { cols, cell, imgSize, title, anchorY }) {
  const lab = 18, pad = 8, top = title ? 28 : 0;
  const rows = Math.ceil(items.length / cols);
  const cw = cell + pad, ch = cell + lab + pad;
  const W = cols * cw + pad, H = rows * ch + pad + top;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if (title) s += `<text x="${pad}" y="20" font-size="15" font-weight="bold" ${FONT} fill="#000">${xmlEsc(title)}</text>`;
  items.forEach((it, i) => {
    const x = pad + (i % cols) * cw, y = top + pad + Math.floor(i / cols) * ch;
    s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="#ddd"/>`;
    s += `<image x="${x}" y="${y}" width="${cell}" height="${cell}" href="${uri(it.file)}"/>`;
    if (anchorY != null) s += `<line x1="${x}" x2="${x + cell}" y1="${y + anchorY * cell / imgSize}" y2="${y + anchorY * cell / imgSize}" stroke="#e22" stroke-width="0.6"/>`;
    s += text(x + cell / 2, y + cell + 13, it.label, 10);
  });
  return { svg: s + '</svg>', W, H };
}
function emit(g, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  renderJobs([{ svg: g.svg, out, w: g.W, h: g.H }], { quiet: true });
  console.log('sheet → ' + out + ` (${g.W}x${g.H})`);
}

if (a.contact && a.contact !== true) {
  const act = a.contact, base = path.join(pack, act);
  if (!fs.existsSync(base)) { console.error('Không có ' + base); process.exit(1); }
  const items = [];
  for (const mood of fs.readdirSync(base).sort()) for (const phase of ['single', 'start', 'loop', 'end']) {
    const d = path.join(base, mood, phase);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.png')).sort()) {
      const m = f.match(/^(\d+)(?:_(\d+))?\.png$/);
      items.push({ file: path.join(d, f), label: `${mood}/${phase} #${m ? +m[1] : f} ${m && m[2] ? m[2] : 100}ms` });
    }
  }
  const sz = png.readSize(items[0].file);
  const cell = +(a.cell || 200);
  emit(grid(items, { cols: +(a.cols || 8), cell, imgSize: sz.h, title: `${act} — ${items.length} khung`, anchorY: 392 }), path.join(reviewDir, `contact_${act}.png`));
} else if (a.faces) {
  const dir = path.join(pack, 'faces');
  const items = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().map(f => ({ file: path.join(dir, f), label: f.replace('.png', '') })) : [];
  if (!items.length) { console.error('Chưa có ảnh mặt trong ' + dir + ' (chạy faces.js trước)'); process.exit(1); }
  emit(grid(items, { cols: 6, cell: 160, imgSize: 256, title: `Mặt — ${items.length} bộ` }), path.join(reviewDir, 'faces.png'));
} else if (a.compare) {
  const R = loadRig(resolveFromRoot(a.rig || 'art/rig/mochi/rig.json'), a.parts);
  const sheet = path.join(ROOT, 'art', 'source', 'character-sheet.png');
  const sz = png.readSize(sheet);
  const crops = [{ name: 'Đồ thường (gốc)', r: [10, 540, 105, 750] }, { name: 'Trước (gốc)', r: [745, 555, 822, 750] }];
  const Hh = 420, pad = 16, top = 30;
  let x = pad, s = '';
  const sheetUri = uri(sheet);
  for (const c of crops) {
    const [x0, y0, x1, y1] = c.r, cw = x1 - x0, chh = y1 - y0, k = Hh / chh, w = cw * k;
    s += `<svg x="${x}" y="${top}" width="${w}" height="${Hh}" viewBox="${x0} ${y0} ${cw} ${chh}"><image x="0" y="0" width="${sz.w}" height="${sz.h}" href="${sheetUri}"/></svg>`;
    s += text(x + w / 2, top + Hh + 16, c.name, 12);
    x += w + pad;
  }
  const rv = R.frameSvg({}, { bg: 'white', scale: 1 });
  const rw = 400 * Hh / 400;
  s += `<line x1="${x - pad / 2}" x2="${x - pad / 2}" y1="${top}" y2="${top + Hh}" stroke="#999"/>`;
  s += `<image x="${x}" y="${top}" width="${rw}" height="${Hh}" href="data:image/svg+xml;base64,${Buffer.from(rv).toString('base64')}"/>`;
  s += text(x + rw / 2, top + Hh + 16, 'Dựng ra (tư thế gốc)', 12);
  const W = Math.ceil(x + rw + pad), H = top + Hh + 30;
  emit({ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${s}</svg>`, W, H }, path.join(reviewDir, 'compare_full.png'));
} else {
  console.error('Dùng: --contact <action> | --faces | --compare (xem README)');
  process.exit(1);
}
