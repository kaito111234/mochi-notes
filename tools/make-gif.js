#!/usr/bin/env node
'use strict';
// Dựng GIF động từ một thư mục khung PNG (tên NNNN_ms.png, ms = thời lượng khung), không cần ffmpeg hay thư viện ngoài.
// Dùng để làm ảnh cho README:
//   node tools/make-gif.js assets/pet/mochi/walk_side/normal/loop docs/images/mochi-walk.gif --size 200
//   Khung hình chữ nhật đầy đủ (demo): node tools/make-gif.js <thư-mục-khung> <ra.gif> --scene --size 640 [--every 1] [--dither 10]
//   node tools/make-gif.js <thư-mục-khung> <ra.gif> [--size 200] [--bg ffffff|transparent] [--no-crop]
// Gồm: giải mã PNG (RGBA 8-bit, không xen kẽ) bằng zlib, thu nhỏ trung bình diện tích, cắt vừa nhân vật,
// lượng tử hoá median-cut 256 màu, mã hoá LZW; rồi tự đọc lại GIF (giải mã LZW) để kiểm header/khung/số điểm ảnh.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ------------------------------------------------------------------ PNG
function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('không phải PNG');
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0, plte = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bd !== 8 || il !== 0 || ![2, 3, 6].includes(ct)) throw new Error('chỉ hỗ trợ PNG 8-bit không xen kẽ (RGB/RGBA/palette)');
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ct === 6) { out.copy(rgba, i * 4, i * 4, i * 4 + 4); }
    else if (ct === 2) { rgba[i * 4] = out[i * 3]; rgba[i * 4 + 1] = out[i * 3 + 1]; rgba[i * 4 + 2] = out[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    else { const k = out[i]; rgba[i * 4] = plte[k * 3]; rgba[i * 4 + 1] = plte[k * 3 + 1]; rgba[i * 4 + 2] = plte[k * 3 + 2]; rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { w, h, rgba };
}

// ------------------------------------------------------------------ ảnh
function bbox(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.rgba[(y * img.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// Cắt vùng (cx,cy,cs vuông) rồi thu nhỏ về size x size bằng trung bình diện tích (nhân alpha trước), ghép lên nền (bg = [r,g,b]).
// Trả { rgb: Buffer(size*size*3), alpha: Uint8Array(size*size) } — alpha là độ phủ của nhân vật.
function render(img, cx, cy, cs, size, bg) {
  const rgb = Buffer.alloc(size * size * 3), alpha = new Uint8Array(size * size);
  const k = cs / size;
  for (let oy = 0; oy < size; oy++) for (let ox = 0; ox < size; ox++) {
    const sx0 = cx + ox * k, sx1 = sx0 + k, sy0 = cy + oy * k, sy1 = sy0 + k;
    let r = 0, g = 0, b = 0, a = 0, wsum = 0;
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
      const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
      for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
        const wt = wy * (Math.min(x + 1, sx1) - Math.max(x, sx0));
        wsum += wt;
        if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
        const i = (y * img.w + x) * 4, al = img.rgba[i + 3] / 255 * wt;
        r += img.rgba[i] * al; g += img.rgba[i + 1] * al; b += img.rgba[i + 2] * al; a += al;
      }
    }
    const cov = wsum ? a / wsum : 0, o = oy * size + ox;
    alpha[o] = Math.round(cov * 255);
    const pr = a ? r / a : 0, pg = a ? g / a : 0, pb = a ? b / a : 0;
    rgb[o * 3] = Math.round(pr * cov + bg[0] * (1 - cov));
    rgb[o * 3 + 1] = Math.round(pg * cov + bg[1] * (1 - cov));
    rgb[o * 3 + 2] = Math.round(pb * cov + bg[2] * (1 - cov));
  }
  return { rgb, alpha };
}

// ------------------------------------------------------------------ lượng tử hoá (median cut)
function buildPalette(frames, maxColors) {
  const hist = new Map();
  for (const f of frames) for (let i = 0; i < f.rgb.length; i += 3) {
    const key = (f.rgb[i] >> 3 << 10) | (f.rgb[i + 1] >> 3 << 5) | (f.rgb[i + 2] >> 3);   // 5 bit/kênh
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  let boxes = [{ items: [...hist.entries()].map(([k, n]) => ({ r: (k >> 10) << 3 | 4, g: ((k >> 5) & 31) << 3 | 4, b: (k & 31) << 3 | 4, n })) }];
  const range = bx => {
    let mn = [255, 255, 255], mx = [0, 0, 0];
    for (const c of bx.items) { const v = [c.r, c.g, c.b]; for (let j = 0; j < 3; j++) { if (v[j] < mn[j]) mn[j] = v[j]; if (v[j] > mx[j]) mx[j] = v[j]; } }
    const d = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ch = d[0] >= d[1] && d[0] >= d[2] ? 'r' : d[1] >= d[2] ? 'g' : 'b';
    return { ch, span: Math.max(d[0], d[1], d[2]) };
  };
  while (boxes.length < maxColors) {
    let best = -1, bs = 0;
    boxes.forEach((bx, i) => { if (bx.items.length < 2) return; const s = range(bx).span * Math.log2(2 + bx.items.reduce((a, c) => a + c.n, 0)); if (s > bs) { bs = s; best = i; } });
    if (best < 0 || bs === 0) break;
    const bx = boxes[best], ch = range(bx).ch;
    bx.items.sort((p, q) => p[ch] - q[ch]);
    const total = bx.items.reduce((a, c) => a + c.n, 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < bx.items.length - 1; i++) { acc += bx.items[i].n; cut = i + 1; if (acc >= total / 2) break; }
    boxes.splice(best, 1, { items: bx.items.slice(0, cut) }, { items: bx.items.slice(cut) });
  }
  return boxes.map(bx => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const c of bx.items) { r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; n += c.n; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function mapIndices(frame, palette, transparentIdx) {
  const cache = new Map(), out = new Uint8Array(frame.alpha.length);
  for (let o = 0; o < out.length; o++) {
    if (transparentIdx >= 0 && frame.alpha[o] < 128) { out[o] = transparentIdx; continue; }
    const r = frame.rgb[o * 3], g = frame.rgb[o * 3 + 1], b = frame.rgb[o * 3 + 2], key = (r << 16) | (g << 8) | b;
    let idx = cache.get(key);
    if (idx === undefined) {
      let bd = Infinity; idx = 0;
      for (let i = 0; i < palette.length; i++) {
        const dr = palette[i][0] - r, dg = palette[i][1] - g, db = palette[i][2] - b, d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) { bd = d; idx = i; }
      }
      cache.set(key, idx);
    }
    out[o] = idx;
  }
  return out;
}

// ------------------------------------------------------------------ GIF (LZW)
function lzwEncode(indices, minBits) {
  const clear = 1 << minBits, eoi = clear + 1, bytes = [];
  let cur = 0, nbits = 0, size = minBits + 1, next = eoi + 1, dict = new Map();
  const put = code => {
    cur |= code << nbits; nbits += size;
    while (nbits >= 8) { bytes.push(cur & 255); cur >>>= 8; nbits -= 8; }
  };
  put(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 4096 + k, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    put(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << size) && size < 12) size++;
    } else { put(clear); dict = new Map(); size = minBits + 1; next = eoi + 1; }
    prefix = k;
  }
  put(prefix); put(eoi);
  if (nbits > 0) bytes.push(cur & 255);
  return Buffer.from(bytes);
}

function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); parts.push(Buffer.from([n]), data.subarray(i, i + n)); }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function encodeGif(size, palette, frames, transparentIdx) {
  let bits = 1; while ((1 << bits) < palette.length + (transparentIdx >= 0 && transparentIdx >= palette.length ? 1 : 0)) bits++;
  bits = Math.max(2, bits);
  const gct = Buffer.alloc(3 << bits);
  palette.forEach((c, i) => { gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2]; });
  const head = Buffer.alloc(13);
  head.write('GIF89a', 0, 'latin1'); head.writeUInt16LE(size, 6); head.writeUInt16LE(size, 8);
  head[10] = 0x80 | ((bits - 1) << 4) | (bits - 1); head[11] = 0; head[12] = 0;
  const parts = [head, gct, Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0', 'latin1'), Buffer.from([3, 1, 0, 0, 0])];
  for (const f of frames) {
    const gce = Buffer.alloc(8);
    gce[0] = 0x21; gce[1] = 0xf9; gce[2] = 4;
    gce[3] = (transparentIdx >= 0 ? 0x09 : 0x04);            // dispose: 2 (xoá về nền) nếu trong suốt, 1 nếu không; cờ trong suốt
    gce.writeUInt16LE(Math.max(2, Math.round(f.ms / 10)), 4);
    gce[6] = transparentIdx >= 0 ? transparentIdx : 0; gce[7] = 0;
    if (transparentIdx >= 0) gce[3] = (2 << 2) | 1;
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c; desc.writeUInt16LE(size, 5); desc.writeUInt16LE(size, 7);
    parts.push(gce, desc, Buffer.from([bits]), subBlocks(lzwEncode(f.idx, bits)));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

// ------------------------------------------------------------------ đọc lại để tự kiểm
function lzwDecode(data, minBits, count) {
  const clear = 1 << minBits, eoi = clear + 1, out = new Uint8Array(count);
  let size = minBits + 1, next = eoi + 1, prev = -1, o = 0, bitPos = 0;
  let table = [];
  const reset = () => { table = []; for (let i = 0; i < clear; i++) table[i] = [i]; size = minBits + 1; next = eoi + 1; prev = -1; };
  reset();
  while (o < count) {
    let code = 0;
    for (let i = 0; i < size; i++) { const byte = data[(bitPos + i) >> 3]; if (byte === undefined) throw new Error('LZW hết dữ liệu'); code |= ((byte >> ((bitPos + i) & 7)) & 1) << i; }
    bitPos += size;
    if (code === clear) { reset(); continue; }
    if (code === eoi) break;
    let entry;
    if (code < next && table[code]) entry = table[code];
    else if (code === next && prev >= 0) entry = table[prev].concat(table[prev][0]);
    else throw new Error('mã LZW sai');
    for (const v of entry) { if (o < count) out[o++] = v; }
    if (prev >= 0 && next < 4096) { table[next++] = table[prev].concat(entry[0]); if (next === (1 << size) && size < 12) size++; }
    prev = code;
  }
  return out;
}

function verifyGif(buf, size, expected) {
  if (buf.toString('latin1', 0, 6) !== 'GIF89a') throw new Error('sai chữ ký GIF');
  if (buf.readUInt16LE(6) !== size || buf.readUInt16LE(8) !== size) throw new Error('sai kích thước');
  let pos = 13; const flags = buf[10];
  if (flags & 0x80) pos += 3 << ((flags & 7) + 1);
  let n = 0;
  while (pos < buf.length) {
    const b = buf[pos];
    if (b === 0x3b) { pos++; break; }
    if (b === 0x21) { pos += 2; while (buf[pos]) pos += buf[pos] + 1; pos++; continue; }
    if (b !== 0x2c) throw new Error('khối lạ 0x' + b.toString(16) + ' @' + pos);
    const w = buf.readUInt16LE(pos + 5), h = buf.readUInt16LE(pos + 7), lflags = buf[pos + 9];
    pos += 10; if (lflags & 0x80) pos += 3 << ((lflags & 7) + 1);
    const minBits = buf[pos++], chunks = [];
    while (buf[pos]) { chunks.push(buf.subarray(pos + 1, pos + 1 + buf[pos])); pos += buf[pos] + 1; }
    pos++;
    const px = lzwDecode(Buffer.concat(chunks), minBits, w * h);
    const exp = expected[n];
    for (let i = 0; i < px.length; i++) if (px[i] !== exp[i]) throw new Error('khung ' + n + ' lệch điểm ảnh ' + i);
    n++;
  }
  if (n !== expected.length) throw new Error('số khung ' + n + ' != ' + expected.length);
  if (pos !== buf.length) throw new Error('còn dữ liệu sau dấu kết GIF');
  return n;
}


// ------------------------------------------------------------------ chế độ --scene: khung hình chữ nhật đầy đủ (demo màn hình)
// Thu nhỏ theo chiều rộng, một bảng màu chung 255 màu + dither Bayer 4x4 nhẹ (cùng điểm ảnh -> cùng chỉ số, nên tối ưu khung trùng hiệu quả),
// mỗi khung chỉ mã hoá hình chữ nhật thay đổi so với khung trước (chỉ số trong suốt = giữ nguyên), kiểm lại bằng cách giải mã & dựng lại từng khung.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function scaleRgb(img, W, H) {
  const rgb = Buffer.alloc(W * H * 3), kx = img.w / W, ky = img.h / H;
  for (let oy = 0; oy < H; oy++) for (let ox = 0; ox < W; ox++) {
    const x0 = ox * kx, x1 = x0 + kx, y0 = oy * ky, y1 = y0 + ky;
    let r = 0, g = 0, b = 0, ws = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const wy = Math.min(y + 1, y1) - Math.max(y, y0);
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0)), i = (Math.min(y, img.h - 1) * img.w + Math.min(x, img.w - 1)) * 4;
        r += img.rgba[i] * w; g += img.rgba[i + 1] * w; b += img.rgba[i + 2] * w; ws += w;
      }
    }
    const o = (oy * W + ox) * 3; rgb[o] = Math.round(r / ws); rgb[o + 1] = Math.round(g / ws); rgb[o + 2] = Math.round(b / ws);
  }
  return rgb;
}
function ditherIdx(rgb, W, H, palette, amp) {
  const out = new Uint8Array(W * H), cache = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * W + x, t = (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) / 16 * amp;
    const c = [0, 1, 2].map(k => Math.max(0, Math.min(255, Math.round(rgb[o * 3 + k] + t))));
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    let idx = cache.get(key);
    if (idx === undefined) {
      let bd = Infinity; idx = 0;
      for (let i = 0; i < palette.length; i++) {
        const dr = palette[i][0] - c[0], dg = palette[i][1] - c[1], db = palette[i][2] - c[2], d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) { bd = d; idx = i; }
      }
      cache.set(key, idx);
    }
    out[o] = idx;
  }
  return out;
}
function encodeScene(W, H, palette, idxFrames, delays) {
  const T = palette.length;                       // chỉ số trong suốt
  const bits = 8, gct = Buffer.alloc(3 << bits);
  palette.forEach((c, i) => { gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2]; });
  const head = Buffer.alloc(13);
  head.write('GIF89a', 0, 'latin1'); head.writeUInt16LE(W, 6); head.writeUInt16LE(H, 8); head[10] = 0x80 | 0x70 | 7; head[11] = 0; head[12] = 0;
  const parts = [head, gct, Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0', 'latin1'), Buffer.from([3, 1, 0, 0, 0])];
  idxFrames.forEach((f, n) => {
    let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
    if (n > 0) {
      const p = idxFrames[n - 1]; x0 = W; y0 = H; x1 = -1; y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f[y * W + x] !== p[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = f[(y0 + y) * W + x0 + x];
      sub[y * w + x] = n > 0 && v === idxFrames[n - 1][(y0 + y) * W + x0 + x] ? T : v;
    }
    const gce = Buffer.alloc(8);
    gce[0] = 0x21; gce[1] = 0xf9; gce[2] = 4; gce[3] = (1 << 2) | 1;           // giữ nguyên + có trong suốt
    gce.writeUInt16LE(Math.max(2, Math.round(delays[n] / 10)), 4); gce[6] = T; gce[7] = 0;
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c; desc.writeUInt16LE(x0, 1); desc.writeUInt16LE(y0, 3); desc.writeUInt16LE(w, 5); desc.writeUInt16LE(h, 7);
    parts.push(gce, desc, Buffer.from([bits]), subBlocks(lzwEncode(sub, bits)));
  });
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
function verifyScene(buf, W, H, idxFrames, T) {
  let pos = 13; const flags = buf[10]; if (flags & 0x80) pos += 3 << ((flags & 7) + 1);
  let n = 0; const canvas = new Uint8Array(W * H);
  while (pos < buf.length) {
    const b = buf[pos];
    if (b === 0x3b) { pos++; break; }
    if (b === 0x21) { pos += 2; while (buf[pos]) pos += buf[pos] + 1; pos++; continue; }
    const x0 = buf.readUInt16LE(pos + 1), y0 = buf.readUInt16LE(pos + 3), w = buf.readUInt16LE(pos + 5), h = buf.readUInt16LE(pos + 7), lf = buf[pos + 9];
    pos += 10; if (lf & 0x80) pos += 3 << ((lf & 7) + 1);
    const minBits = buf[pos++], chunks = [];
    while (buf[pos]) { chunks.push(buf.subarray(pos + 1, pos + 1 + buf[pos])); pos += buf[pos] + 1; }
    pos++;
    const px = lzwDecode(Buffer.concat(chunks), minBits, w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = px[y * w + x]; if (v !== T) canvas[(y0 + y) * W + x0 + x] = v; }
    for (let i = 0; i < canvas.length; i++) if (canvas[i] !== idxFrames[n][i]) throw new Error('khung ' + n + ' lệch điểm ảnh ' + i);
    n++;
  }
  if (n !== idxFrames.length || pos !== buf.length) throw new Error('số khung/độ dài không khớp');
  return n;
}
function sceneMain(dir, outFile, opt) {
  const names = fs.readdirSync(dir).filter(n => /^\d{4}_\d+\.png$/.test(n)).sort();
  if (!names.length) throw new Error('không có khung NNNN_ms.png trong ' + dir);
  const step = Math.max(1, opt.every || 1);
  const sel = names.filter((_, i) => i % step === 0);
  const first = decodePng(fs.readFileSync(path.join(dir, sel[0])));
  const W = opt.size, H = Math.round(first.h * W / first.w);
  const rgbs = sel.map(n => scaleRgb(decodePng(fs.readFileSync(path.join(dir, n))), W, H));
  const delays = sel.map(n => +/_(\d+)\.png$/.exec(n)[1] * step);
  const palette = buildPalette(rgbs.map(rgb => ({ rgb })), 255);
  const idx = rgbs.map(rgb => ditherIdx(rgb, W, H, palette, opt.dither == null ? 10 : opt.dither));
  const buf = encodeScene(W, H, palette, idx, delays);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  const n = verifyScene(buf, W, H, idx, palette.length);
  console.log(`OK ${path.basename(outFile)}: ${W}x${H}, ${n} khung, ${palette.length} màu, ${(buf.length / 1024).toFixed(0)} KB (đã giải mã lại và so khớp từng điểm ảnh)`);
}

// ------------------------------------------------------------------ main
function main() {
  const args = process.argv.slice(2), pos = [], opt = { size: 200, bg: 'ffffff', crop: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--size') opt.size = +args[++i];
    else if (args[i] === '--bg') opt.bg = args[++i].replace('#', '').toLowerCase();
    else if (args[i] === '--no-crop') opt.crop = false;
    else if (args[i] === '--scene') opt.scene = true;
    else if (args[i] === '--every') opt.every = +args[++i];
    else if (args[i] === '--dither') opt.dither = +args[++i];
    else pos.push(args[i]);
  }
  if (pos.length < 2) { console.error('Dùng: node tools/make-gif.js <thư-mục-khung> <ra.gif> [--size 200] [--bg ffffff|transparent] [--no-crop]'); process.exit(2); }
  const dir = path.resolve(pos[0]), outFile = path.resolve(pos[1]);
  if (opt.scene) return sceneMain(dir, outFile, opt);
  const names = fs.readdirSync(dir).filter(n => /^\d{4}_\d+\.png$/.test(n)).sort();
  if (!names.length) throw new Error('không có khung NNNN_ms.png trong ' + dir);
  const imgs = names.map(n => decodePng(fs.readFileSync(path.join(dir, n))));
  const ms = names.map(n => +/_(\d+)\.png$/.exec(n)[1]);
  const transparent = opt.bg === 'transparent';
  const bg = transparent ? [255, 255, 255] : [parseInt(opt.bg.slice(0, 2), 16), parseInt(opt.bg.slice(2, 4), 16), parseInt(opt.bg.slice(4, 6), 16)];
  // vùng cắt: hợp các hộp bao của mọi khung, vuông, thêm lề 4%
  let cx = 0, cy = 0, cs = Math.max(imgs[0].w, imgs[0].h);
  if (opt.crop) {
    let u = null;
    for (const im of imgs) { const b = bbox(im); if (b) u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b; }
    if (u) {
      const side = Math.max(u.x1 - u.x0 + 1, u.y1 - u.y0 + 1), pad = Math.round(side * 0.04);
      cs = side + pad * 2; cx = Math.round((u.x0 + u.x1) / 2 - cs / 2); cy = Math.round((u.y0 + u.y1) / 2 - cs / 2);
    }
  }
  const rendered = imgs.map(im => render(im, cx, cy, cs, opt.size, bg));
  const palette = buildPalette(rendered, transparent ? 255 : 256);
  const tIdx = transparent ? palette.length : -1;
  const frames = rendered.map((r, i) => ({ idx: mapIndices(r, palette, tIdx), ms: ms[i] }));
  const buf = encodeGif(opt.size, palette, frames, tIdx);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  const n = verifyGif(buf, opt.size, frames.map(f => f.idx));
  console.log(`OK ${path.basename(outFile)}: ${opt.size}x${opt.size}, ${n} khung, ${palette.length} màu${transparent ? ' + trong suốt' : ''}, ${(buf.length / 1024).toFixed(0)} KB (đã đọc lại và so khớp từng điểm ảnh)`);
}

if (require.main === module) main();
module.exports = { decodePng, encodeGif, lzwEncode, lzwDecode, verifyGif };
