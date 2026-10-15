'use strict';
// PNG thuần Node (zlib) + vài hàm vẽ/biến đổi cơ bản cho công cụ hình động.
// Ảnh = { w, h, data: Uint8ClampedArray(w*h*4) } — RGBA, alpha THẲNG (không nhân trước).
const fs = require('fs');
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------- CRC32 ----------
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// ---------- Đọc IHDR (không giải mã ảnh) ----------
function readSize(fileOrBuf) {
  let b = fileOrBuf;
  if (typeof b === 'string') {
    const fd = fs.openSync(b, 'r');
    try { b = Buffer.alloc(33); const n = fs.readSync(fd, b, 0, 33, 0); b = b.subarray(0, n); } finally { fs.closeSync(fd); }
  }
  if (b.length < 33 || !b.subarray(0, 8).equals(SIG) || b.toString('latin1', 12, 16) !== 'IHDR') throw new Error('Không phải PNG hợp lệ');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25], interlace: b[28], hasAlpha: b[25] === 6 || b[25] === 4 ? true : b[25] === 3 ? null : false }; // null = bảng màu (cần đọc tRNS)
}

// ---------- Giải mã ----------
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }

function decode(fileOrBuf) {
  const buf = typeof fileOrBuf === 'string' ? fs.readFileSync(fileOrBuf) : fileOrBuf;
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('Không phải PNG (sai chữ ký)');
  let pos = 8, hdr = null, plte = null, trns = null; const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw new Error('PNG bị cắt cụt');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const crc = buf.readUInt32BE(pos + 8 + len);
    if (crc !== crc32(buf.subarray(pos + 4, pos + 8 + len))) throw new Error(`CRC sai ở chunk ${type}`);
    if (type === 'IHDR') hdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data; else if (type === 'tRNS') trns = data; else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!hdr) throw new Error('Thiếu IHDR');
  if (hdr.depth !== 8) throw new Error('Chỉ hỗ trợ PNG 8 bit/kênh');
  if (hdr.interlace) throw new Error('Không hỗ trợ PNG interlace');
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[hdr.ct];
  if (!chans) throw new Error('Kiểu màu PNG không hỗ trợ: ' + hdr.ct);
  if (hdr.ct === 3 && !plte) throw new Error('Thiếu PLTE');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = hdr, stride = w * chans;
  if (raw.length < (stride + 1) * h) throw new Error('Dữ liệu ảnh thiếu');
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], so = y * (stride + 1) + 1, o = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[so + i], a = i >= chans ? px[o + i - chans] : 0, b = y ? px[o - stride + i] : 0, c = y && i >= chans ? px[o - stride + i - chans] : 0;
      let v;
      switch (f) {
        case 0: v = x; break; case 1: v = x + a; break; case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break; case 4: v = x + paeth(a, b, c); break;
        default: throw new Error('Bộ lọc PNG lạ: ' + f);
      }
      px[o + i] = v & 255;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4, s = i * chans;
    switch (hdr.ct) {
      case 6: out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = px[s + 3]; break;
      case 2: out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = 255; break;
      case 0: out[o] = out[o + 1] = out[o + 2] = px[s]; out[o + 3] = 255; break;
      case 4: out[o] = out[o + 1] = out[o + 2] = px[s]; out[o + 3] = px[s + 1]; break;
      case 3: { const k = px[s]; out[o] = plte[k * 3]; out[o + 1] = plte[k * 3 + 1]; out[o + 2] = plte[k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255; break; }
    }
  }
  return { w, h, data: out, hasAlpha: hdr.ct === 6 || hdr.ct === 4 || hdr.ct === 3 && !!trns };
}

// ---------- Mã hoá RGBA 8 bit ----------
function encode(img) {
  const { w, h, data } = img, stride = w * 4;
  const rows = Buffer.alloc((stride + 1) * h);
  const cand = [0, 1, 2, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    let best = 0, bestSum = Infinity;
    for (let fi = 0; fi < 4; fi++) {
      const f = [0, 1, 2, 4][fi], buf = cand[fi]; let sum = 0;
      for (let i = 0; i < stride; i++) {
        const x = data[y * stride + i], a = i >= 4 ? data[y * stride + i - 4] : 0, b = y ? data[(y - 1) * stride + i] : 0, c = y && i >= 4 ? data[(y - 1) * stride + i - 4] : 0;
        const v = (f === 0 ? x : f === 1 ? x - a : f === 2 ? x - b : x - paeth(a, b, c)) & 255;
        buf[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = fi; }
    }
    rows[y * (stride + 1)] = [0, 1, 2, 4][best];
    cand[best].copy(rows, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function save(file, img) { fs.writeFileSync(file, encode(img)); }


// ---------- Mã hoá PNG có bảng màu (PLTE + tRNS) — nhỏ hơn nhiều cho hình tạm ----------
// Lượng tử hoá bằng median-cut trên biểu đồ màu 5-5-5-4 bit; không dither (tất định, nén tốt).
function encodeIndexed(img, maxColors = 256) {
  const { w, h, data } = img, n = w * h;
  const key = (i) => { const a = data[i + 3]; return a === 0 ? 0 : ((data[i] >> 3) << 11) | ((data[i + 1] >> 3) << 6) | ((data[i + 2] >> 3) << 1) | ((a >> 4) << 16) | 1 << 21; };
  const hist = new Map();
  for (let p = 0; p < n; p++) { const k = key(p * 4); hist.set(k, (hist.get(k) || 0) + 1); }
  const unq = Array.from(hist, ([k, c]) => {
    if (k === 0) return { k, c, v: [0, 0, 0, 0] };
    return { k, c, v: [((k >> 11) & 31) << 3 | 4, ((k >> 6) & 31) << 3 | 4, ((k >> 1) & 31) << 3 | 4, Math.min(255, ((k >> 16) & 15) * 17)] };
  });
  unq.sort((a, b) => a.k - b.k);
  let boxes = [unq];
  while (boxes.length < maxColors) {
    let bi = -1, best = 0, bch = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let ch = 0; ch < 4; ch++) {
        let lo = 255, hi = 0; for (const u of bx) { if (u.v[ch] < lo) lo = u.v[ch]; if (u.v[ch] > hi) hi = u.v[ch]; }
        const score = (hi - lo) * (ch === 3 ? 1.2 : 1) * Math.sqrt(bx.reduce((s, u) => s + u.c, 0));
        if (score > best) { best = score; bi = i; bch = ch; }
      }
    });
    if (bi < 0) break;
    const bx = boxes[bi].slice().sort((a, b) => a.v[bch] - b.v[bch] || a.k - b.k);
    const tot = bx.reduce((s, u) => s + u.c, 0); let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].c; cut = i + 1; if (acc >= tot / 2) break; }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  const pal = [], map = new Map();
  boxes.forEach((bx, bi) => {
    let s = [0, 0, 0, 0], t = 0; for (const u of bx) { for (let c = 0; c < 4; c++) s[c] += u.v[c] * u.c; t += u.c; }
    pal.push(s.map((x) => Math.round(x / t))); for (const u of bx) map.set(u.k, bi);
  });
  const idx = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) idx[y * (w + 1) + 1 + x] = map.get(key((y * w + x) * 4));
  // bộ lọc Sub hoặc Up chọn theo hàng
  const out = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w + 1); let sa = 0, sb = 0;
    for (let x = 0; x < w; x++) { const v = idx[o + 1 + x]; const a = (v - (x ? idx[o + x] : 0)) & 255, b = (v - (y ? idx[o - (w + 1) + 1 + x] : 0)) & 255; sa += a < 128 ? a : 256 - a; sb += b < 128 ? b : 256 - b; }
    const f = sa === 0 || sa < sb ? 1 : 2; out[o] = f;
    for (let x = 0; x < w; x++) { const v = idx[o + 1 + x]; out[o + 1 + x] = f === 1 ? (v - (x ? idx[o + x] : 0)) & 255 : (v - (y ? idx[o - (w + 1) + 1 + x] : 0)) & 255; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(pal.length * 3); pal.forEach((p, i) => { plte[i * 3] = p[0]; plte[i * 3 + 1] = p[1]; plte[i * 3 + 2] = p[2]; });
  const trns = Buffer.from(pal.map((p) => p[3]));
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', zlib.deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function saveIndexed(file, img, maxColors) { fs.writeFileSync(file, encodeIndexed(img, maxColors)); }

// ---------- Canvas & hợp alpha ----------
function create(w, h) { return { w, h, data: new Uint8ClampedArray(w * h * 4) }; }
function clone(img) { return { w: img.w, h: img.h, data: new Uint8ClampedArray(img.data) }; }
function hex(c) {
  if (Array.isArray(c)) return [c[0], c[1], c[2], c.length > 3 ? c[3] : 255];
  const s = c.replace('#', ''); const n = parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
// source-over một điểm ảnh (alpha thẳng); a = 0..1 hệ số phủ thêm
function blendPx(dst, i, r, g, b, a) {
  if (a <= 0) return;
  const d = dst.data, da = d[i + 3] / 255, oa = a + da * (1 - a);
  if (oa <= 0) return;
  d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
}

// drawImage(dst, src, {x,y, ox,oy, sx,sy, rot, flipX, flipY, alpha})
// Điểm (ox,oy) của src (mặc định tâm) được đặt tại (x,y) của dst, sau khi lật → co giãn → xoay (độ, chiều kim đồng hồ).
function drawImage(dst, src, o = {}) {
  const ox = o.ox === undefined ? src.w / 2 : o.ox, oy = o.oy === undefined ? src.h / 2 : o.oy;
  const x = o.x === undefined ? ox : o.x, y = o.y === undefined ? oy : o.y;
  const sx = (o.sx === undefined ? 1 : o.sx) * (o.flipX ? -1 : 1), sy = (o.sy === undefined ? 1 : o.sy) * (o.flipY ? -1 : 1);
  const rad = (o.rot || 0) * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), alpha = o.alpha === undefined ? 1 : o.alpha;
  if (!sx || !sy) return dst;
  // thuận: d = P + R*S*(p-O)
  const corners = [[0, 0], [src.w, 0], [0, src.h], [src.w, src.h]].map(([px, py]) => {
    const u = (px - ox) * sx, v = (py - oy) * sy; return [x + cs * u - sn * v, y + sn * u + cs * v];
  });
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) - 1)), x1 = Math.min(dst.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0])) + 1));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) - 1)), y1 = Math.min(dst.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1])) + 1));
  const sd = src.data;
  for (let dy = y0; dy <= y1; dy++) {
    for (let dx = x0; dx <= x1; dx++) {
      const ux = dx + 0.5 - x, uy = dy + 0.5 - y;
      const px = (cs * ux + sn * uy) / sx + ox - 0.5, py = (-sn * ux + cs * uy) / sy + oy - 0.5; // tâm điểm ảnh nguồn tại số nguyên
      const ix = Math.floor(px), iy = Math.floor(py);
      if (ix < -1 || iy < -1 || ix >= src.w || iy >= src.h) continue;
      const fx = px - ix, fy = py - iy;
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 4; k++) {
        const qx = ix + (k & 1), qy = iy + (k >> 1);
        if (qx < 0 || qy < 0 || qx >= src.w || qy >= src.h) continue;
        const wgt = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), i = (qy * src.w + qx) * 4, wa = wgt * sd[i + 3] / 255;
        r += sd[i] * wa; g += sd[i + 1] * wa; b += sd[i + 2] * wa; a += wa;
      }
      if (a <= 0.002) continue;
      blendPx(dst, (dy * dst.w + dx) * 4, r / a, g / a, b / a, a * alpha);
    }
  }
  return dst;
}

// ---------- Tô hình (khử răng cưa bằng lấy mẫu con 4x4) ----------
const SS = 4;
function fillShape(cv, bbox, inside, color) {
  const [r, g, b, ca] = hex(color);
  const x0 = Math.max(0, Math.floor(bbox[0])), y0 = Math.max(0, Math.floor(bbox[1])), x1 = Math.min(cv.w - 1, Math.ceil(bbox[2])), y1 = Math.min(cv.h - 1, Math.ceil(bbox[3]));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let n = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if (inside(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) n++;
    if (n) blendPx(cv, (y * cv.w + x) * 4, r, g, b, n / (SS * SS) * ca / 255);
  }
}
// fillEllipse(cv, cx, cy, rx, ry, fill, stroke?, strokeW?, rot?)
function fillEllipse(cv, cx, cy, rx, ry, fill, stroke, sw = 2, rotDeg = 0) {
  const rad = rotDeg * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), R = Math.max(rx, ry) + 1;
  const mk = (ax, ay) => (px, py) => { const u = px - cx, v = py - cy; const a = cs * u + sn * v, b = -sn * u + cs * v; return (a * a) / (ax * ax) + (b * b) / (ay * ay) <= 1; };
  if (stroke) fillShape(cv, [cx - R, cy - R, cx + R, cy + R], mk(rx, ry), stroke);
  if (fill) fillShape(cv, [cx - R, cy - R, cx + R, cy + R], mk(rx - (stroke ? sw : 0), ry - (stroke ? sw : 0)), fill);
}
// fillRoundRect(cv, x, y, w, h, r, fill, stroke?, strokeW?)
function fillRoundRect(cv, x, y, w, h, r, fill, stroke, sw = 2) {
  const mk = (X, Y, W, H, rr) => (px, py) => {
    if (px < X || py < Y || px > X + W || py > Y + H) return false;
    const qx = Math.max(X + rr - px, 0, px - (X + W - rr)), qy = Math.max(Y + rr - py, 0, py - (Y + H - rr));
    return qx * qx + qy * qy <= rr * rr;
  };
  const bb = [x - 1, y - 1, x + w + 1, y + h + 1];
  r = Math.min(r, w / 2, h / 2);
  if (stroke) fillShape(cv, bb, mk(x, y, w, h, r), stroke);
  if (fill) fillShape(cv, bb, stroke ? mk(x + sw, y + sw, w - 2 * sw, h - 2 * sw, Math.max(0, r - sw)) : mk(x, y, w, h, r), fill);
}
// Đoạn thẳng dày, đầu tròn
function drawLine(cv, x1, y1, x2, y2, width, color) {
  const hw = width / 2, dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  fillShape(cv, [Math.min(x1, x2) - hw - 1, Math.min(y1, y2) - hw - 1, Math.max(x1, x2) + hw + 1, Math.max(y1, y2) + hw + 1], (px, py) => {
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px - (x1 + t * dx), ey = py - (y1 + t * dy); return ex * ex + ey * ey <= hw * hw;
  }, color);
}
// Đa giác (quy tắc chẵn-lẻ) + viền tuỳ chọn
function fillPoly(cv, pts, fill, stroke, sw = 2) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  fillShape(cv, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], (px, py) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }, fill);
  if (stroke) for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; drawLine(cv, a[0], a[1], b[0], b[1], sw, stroke); }
}

// ---------- Biến đổi ảnh ----------
function crop(img, x, y, w, h) {
  const out = create(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = x + i, sy = y + j; if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
    const s = (sy * img.w + sx) * 4, d = (j * w + i) * 4; for (let k = 0; k < 4; k++) out.data[d + k] = img.data[s + k];
  }
  return out;
}
// Xoá (làm trong suốt) hình chữ nhật
function clearRect(img, x, y, w, h) {
  for (let j = Math.max(0, y); j < Math.min(img.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(img.w, x + w); i++) img.data[(j * img.w + i) * 4 + 3] = 0, img.data[(j * img.w + i) * 4] = img.data[(j * img.w + i) * 4 + 1] = img.data[(j * img.w + i) * 4 + 2] = 0;
}
function flipH(img) {
  const out = create(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const s = (y * img.w + x) * 4, d = (y * img.w + (img.w - 1 - x)) * 4; for (let k = 0; k < 4; k++) out.data[d + k] = img.data[s + k]; }
  return out;
}
// Hộp bao của vùng alpha > t
function alphaBounds(img, t = 8) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > t) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

module.exports = { readSize, decode, encode, save, encodeIndexed, saveIndexed, create, clone, hex, drawImage, fillShape, fillEllipse, fillRoundRect, fillPoly, drawLine, crop, clearRect, flipH, alphaBounds, crc32 };
