'use strict';
// Nén PNG RGBA -> PNG bảng màu (PLTE + tRNS), chỉ dùng Node built-in. Tất định, không dither.
// Thuật toán: màu phẳng thường gặp giữ NGUYÊN (top-K theo số điểm ảnh), phần còn lại (viền khử răng cưa)
// gom bằng median-cut có trọng số + alpha; mọi điểm ảnh ánh xạ về màu gần nhất. alpha=0 -> một chỉ số trong suốt.
const fs = require('fs');
const zlib = require('zlib');
const png = require('../../anim/png');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(png.crc32(td));
  return Buffer.concat([len, td, crc]);
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

// khoảng cách cảm nhận: màu tính theo alpha chung nhỏ nhất, cộng chênh alpha
function dist(p, q) {
  const dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2], da = p[3] - q[3];
  const w = Math.min(p[3], q[3]) / 255;
  return (2 * dr * dr + 4 * dg * dg + 3 * db * db) * w + da * da * 6;
}

function buildPalette(uniq, maxColors, keepExact) {
  // uniq: [{v:[r,g,b,a], c}] không gồm alpha=0
  const sorted = uniq.slice().sort((x, y) => y.c - x.c);
  const K = Math.min(keepExact, sorted.length, maxColors);
  const pal = sorted.slice(0, K).map(u => u.v);
  const rest = sorted.slice(K);
  const want = maxColors - pal.length;
  if (!rest.length || want <= 0) return pal;
  let boxes = [rest];
  const stat = (bx) => {
    let tot = 0; const mean = [0, 0, 0, 0];
    for (const u of bx) { tot += u.c; for (let k = 0; k < 4; k++) mean[k] += u.v[k] * u.c; }
    for (let k = 0; k < 4; k++) mean[k] /= tot;
    const varc = [0, 0, 0, 0];
    for (const u of bx) for (let k = 0; k < 4; k++) { const d = u.v[k] - mean[k]; varc[k] += d * d * u.c; }
    return { tot, varc };
  };
  const wgt = [2, 4, 3, 6];
  while (boxes.length < want) {
    let bi = -1, bk = 0, best = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      const { varc } = stat(bx);
      for (let k = 0; k < 4; k++) { const s = varc[k] * wgt[k]; if (s > best) { best = s; bi = i; bk = k; } }
    });
    if (bi < 0) break;
    const bx = boxes[bi].slice().sort((x, y) => x.v[bk] - y.v[bk] || y.c - x.c);
    const tot = bx.reduce((s, u) => s + u.c, 0); let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].c; cut = i + 1; if (acc >= tot / 2) break; }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  for (const bx of boxes) {
    // dùng màu trung bình theo alpha-premult để viền không lệch màu
    let t = 0, a = 0; const s = [0, 0, 0];
    for (const u of bx) { const wa = u.c * (u.v[3] || 1); t += wa; a += u.v[3] * u.c; for (let k = 0; k < 3; k++) s[k] += u.v[k] * wa; }
    const n = bx.reduce((q, u) => q + u.c, 0);
    pal.push([Math.round(s[0] / t), Math.round(s[1] / t), Math.round(s[2] / t), Math.max(1, Math.round(a / n))]);
  }
  return pal;
}

// img: {w,h,data RGBA}. Trả {w,h,pal:[[r,g,b,a]], idx:Uint8Array, exact:boolean}
function quantize(img, maxColors = 128, keepExact = 16) {
  const { w, h, data } = img, n = w * h;
  const hist = new Map();
  for (let p = 0; p < n; p++) {
    const i = p * 4, a = data[i + 3];
    const k = a === 0 ? 0 : ((data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | a) >>> 0) + 1;
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const uniq = [];
  let hasT = false;
  for (const [k, c] of hist) {
    if (k === 0) { hasT = true; continue; }
    const v = k - 1; uniq.push({ k, c, v: [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255] });
  }
  const budget = maxColors - (hasT ? 1 : 0);
  const exact = uniq.length <= budget;
  const pal = hasT ? [[0, 0, 0, 0]] : [];
  let body;
  if (exact) body = uniq.map(u => u.v); else body = buildPalette(uniq, budget, keepExact);
  const off = pal.length; pal.push(...body);
  const map = new Map(); if (hasT) map.set(0, 0);
  for (const u of uniq) {
    let bi = 0, bd = Infinity;
    for (let j = off; j < pal.length; j++) { const d = dist(u.v, pal[j]); if (d < bd) { bd = d; bi = j; if (d === 0) break; } }
    map.set(u.k, bi);
  }
  const idx = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4, a = data[i + 3];
    idx[p] = map.get(a === 0 ? 0 : ((data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | a) >>> 0) + 1);
  }
  return { w, h, pal, idx, exact };
}

function encodeIndexed(q) {
  const { w, h, pal, idx } = q, stride = w;
  // thử: không lọc, và lọc thích nghi theo dòng; lấy bản nhỏ hơn
  const none = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) none[y * (stride + 1) + 1 + x] = idx[y * w + x]; }
  const adapt = Buffer.alloc((stride + 1) * h), tmp = [0, 1, 2, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    let best = 0, bs = Infinity;
    for (let fi = 0; fi < 4; fi++) {
      const f = [0, 1, 2, 4][fi]; let s = 0;
      for (let x = 0; x < w; x++) {
        const v = idx[y * w + x], a = x ? idx[y * w + x - 1] : 0, b = y ? idx[(y - 1) * w + x] : 0, c = x && y ? idx[(y - 1) * w + x - 1] : 0;
        const r = (f === 0 ? v : f === 1 ? v - a : f === 2 ? v - b : v - paeth(a, b, c)) & 255;
        tmp[fi][x] = r; s += r === 0 ? 0 : 1 + (r < 128 ? r : 256 - r) / 64;
      }
      if (s < bs) { bs = s; best = fi; }
    }
    adapt[y * (stride + 1)] = [0, 1, 2, 4][best]; tmp[best].copy(adapt, y * (stride + 1) + 1);
  }
  const opt = { level: 9, memLevel: 9 };
  const z1 = zlib.deflateSync(none, opt), z2 = zlib.deflateSync(adapt, opt), z = z2.length < z1.length ? z2 : z1;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(pal.length * 3), trns = Buffer.alloc(pal.length);
  pal.forEach((p, i) => { plte[i * 3] = p[0]; plte[i * 3 + 1] = p[1]; plte[i * 3 + 2] = p[2]; trns[i] = p[3]; });
  let last = pal.length; while (last > 0 && trns[last - 1] === 255) last--;
  const parts = [SIG, chunk('IHDR', ihdr), chunk('PLTE', plte)];
  if (last > 0) parts.push(chunk('tRNS', trns.subarray(0, last)));
  parts.push(chunk('IDAT', z), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// Buffer PNG bất kỳ (8 bit) -> Buffer PNG bảng màu. Trả {buf, exact, colors}
function quantizePng(buf, opts = {}) {
  const img = png.decode(buf);
  const q = quantize(img, opts.maxColors || 128, opts.keepExact === undefined ? 16 : opts.keepExact);
  return { buf: encodeIndexed(q), exact: q.exact, colors: q.pal.length };
}
function quantizeFile(file, opts) {
  const before = fs.statSync(file).size;
  const src = fs.readFileSync(file);
  const r = quantizePng(src, opts);
  if (r.buf.length < before) { fs.writeFileSync(file + '.tmp', r.buf); fs.renameSync(file + '.tmp', file); return { before, after: r.buf.length, ...r, skipped: false }; }
  return { before, after: before, ...r, skipped: true };
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = require('path').join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.png')) out.push(p);
  }
  return out;
}
module.exports = { quantize, encodeIndexed, quantizePng, quantizeFile, walk };
