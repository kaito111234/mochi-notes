'use strict';
// Lõi rối giấy: đọc rig.json, tính ma trận xương, ghép SVG một khung.
// Ma trận affine dạng SVG [a,b,c,d,e,f]: x' = a*x + c*y + e ; y' = b*x + d*y + f. Góc dương = quay THUẬN chiều kim đồng hồ trên màn hình.
const fs = require('fs');
const path = require('path');

const I = [1, 0, 0, 1, 0, 0];
function mul(A, B) {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = (deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const S = (sx, sy) => [sx, 0, 0, sy, 0, 0];
// M = T(P + (x,y)) · R(r) · S(sx,sy) · T(-P)
function aroundPivot(P, p) {
  const x = p.x || 0, y = p.y || 0, sx = p.sx == null ? 1 : p.sx, sy = p.sy == null ? 1 : p.sy;
  return mul(mul(mul(T(P[0] + x, P[1] + y), R(p.r || 0)), S(sx, sy)), T(-P[0], -P[1]));
}
const fmt = (m) => 'matrix(' + m.map(v => +v.toFixed(5)).join(' ') + ')';

function loadRig(rigPath, partsDirOverride) {
  const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8').replace(/^﻿/, ''));
  const partsDir = partsDirOverride ? path.resolve(partsDirOverride) : path.resolve(path.dirname(rigPath), rig.partsDir || 'parts');
  const warned = new Set();
  const cache = new Map();
  const warn = (msg) => { if (!warned.has(msg)) { warned.add(msg); console.warn('[rig] ' + msg); } };

  function readPart(rel) { // trả nội dung bên trong <svg>, hoặc null nếu không có file
    if (cache.has(rel)) return cache.get(rel);
    const f = path.join(partsDir, rel);
    let inner = null;
    if (fs.existsSync(f)) {
      const s = fs.readFileSync(f, 'utf8');
      const m = s.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/);
      inner = m ? m[1] : s.replace(/<\?xml[^>]*\?>/, '');
    }
    cache.set(rel, inner);
    return inner;
  }

  function boneMatrices(bones) {
    const memo = {};
    const get = (name) => {
      if (memo[name]) return memo[name];
      const b = rig.bones[name];
      if (!b) throw new Error('Xương không tồn tại: ' + name);
      const par = b.parent ? get(b.parent) : I;
      return (memo[name] = mul(par, aroundPivot(b.pivot, (bones && bones[name]) || {})));
    };
    for (const k of Object.keys(bones || {})) if (!rig.bones[k]) throw new Error('Khung dùng xương không có trong rig.json: ' + k);
    for (const k of Object.keys(rig.bones)) get(k);
    return memo;
  }

  function globalMatrix(g) {
    if (!g) return I;
    const px = g.px == null ? rig.anchor[0] : g.px, py = g.py == null ? rig.anchor[1] : g.py;
    return aroundPivot([px, py], g);
  }

  // Trả danh sách lớp đã sắp z: [{id, z, svg}]
  function layersOf(frame) {
    frame = frame || {};
    const mats = boneMatrices(frame.bones);
    const G = globalMatrix(frame.global);
    const hide = new Set(frame.hide || []);
    const swap = frame.swap || {};
    const zov = frame.z || {};
    const opac = frame.opacity || {};
    const face = frame.face || 'normal';
    const items = [];
    rig.layers.forEach((L, idx) => {
      if (hide.has(L.id)) return;
      let rel = L.file;
      if (rel.includes('{face}')) {
        rel = L.file.replace('{face}', face);
        if (readPart(rel) == null && face !== 'normal') {
          if (!L.optional) warn('thiếu ' + rel + ' → dùng mặt normal');
          rel = L.file.replace('{face}', 'normal');
        }
      }
      if (swap[L.id]) {
        const v = rel.replace(/\.svg$/, '.' + swap[L.id] + '.svg');
        if (readPart(v) != null) rel = v; else warn('thiếu biến thể ' + v + ' → dùng ' + rel);
      }
      const inner = readPart(rel);
      if (inner == null) { if (!L.optional) warn('thiếu file bộ phận: ' + rel); return; }
      items.push({ id: L.id, z: zov[L.id] != null ? zov[L.id] : L.z, idx, inner, m: mats[L.bone], op: opac[L.id] != null ? opac[L.id] : L.opacity });
    });
    (frame.show || []).forEach((s, k) => {
      const inner = readPart(s.file);
      if (inner == null) { warn('thiếu file show: ' + s.file); return; }
      const id = s.id || s.file;
      let base;
      if (s.bone === 'canvas') base = I; // cố định trên canvas, KHÔNG chịu global
      else if (!s.bone || s.bone === 'none') base = G; // toạ độ canvas, chịu global
      else { if (!mats[s.bone]) throw new Error('show: xương không tồn tại ' + s.bone); base = mul(G, mats[s.bone]); }
      const local = mul(mul(T(s.x || 0, s.y || 0), R(s.r || 0)), S(s.s == null ? 1 : s.s, s.s == null ? 1 : s.s));
      items.push({ id, z: zov[id] != null ? zov[id] : (s.z == null ? 200 : s.z), idx: 1000 + k, inner, m: null, abs: mul(base, local), op: s.opacity });
    });
    items.sort((a, b) => a.z - b.z || a.idx - b.idx);
    return items.map(it => {
      const m = it.abs || mul(G, it.m);
      const op = it.op != null && it.op !== 1 ? ` opacity="${it.op}"` : '';
      return { id: it.id, z: it.z, svg: `<g transform="${fmt(m)}"${op}>${it.inner}</g>` };
    });
  }

  // SVG đầy đủ của một khung. opts: {scale, bg:'none'|'white'|'checker', viewBox:[x,y,w,h], size:[w,h]}
  function frameSvg(frame, opts = {}) {
    const vb = opts.viewBox || [0, 0, rig.canvas[0], rig.canvas[1]];
    const sc = opts.scale || 1;
    const w = opts.size ? opts.size[0] : Math.round(vb[2] * sc), h = opts.size ? opts.size[1] : Math.round(vb[3] * sc);
    let bg = '';
    if (opts.bg === 'white') bg = `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#fff"/>`;
    else if (opts.bg === 'checker') bg = `<defs><pattern id="rigchk" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f2f2f2"/><rect width="10" height="10" fill="#d9d9d9"/><rect x="10" y="10" width="10" height="10" fill="#d9d9d9"/></pattern></defs><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#rigchk)"/>`;
    const body = layersOf(frame).map(l => l.svg).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.join(' ')}" width="${w}" height="${h}">${bg}\n${body}\n</svg>`;
  }

  return { rig, partsDir, readPart, boneMatrices, globalMatrix, layersOf, frameSvg, warn };
}

module.exports = { loadRig, mul, T, R, S, aroundPivot, I, fmt };
