#!/usr/bin/env node
'use strict';
// Dựng bộ khung dáng NGHIÊNG của Mochi (quay sang PHẢI) từ thiết kế đã duyệt trong tools/art/side-key.js.
//   node tools/art/side-walk.js            sinh walk_side/normal (12 khung x 75ms), walk_side/tired (12 x 110ms), turn_side start/end (3+3 x 70ms),
//                                          masks tương ứng và masks/head_side.json ([dx, dy, tỉ lệ đầu]).
// Chỉ ghi vào: assets/pet/mochi/{walk_side,turn_side,masks/walk_side,masks/turn_side,masks/head_side.json}.
// Chân: IK 2 đốt, bàn chân đứng luôn chạm đất; hông nhún 3px, thấp nhất ở khung tiếp đất (khung 1 = khung chuẩn).
// Mặt nạ: dựng cùng SVG nhưng đổi màu: cardigan đỏ, sơ mi/cổ/cổ tay xanh lá, cà vạt xanh dương, còn lại đen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PET = path.join(ROOT, 'assets', 'pet', 'mochi');
const TMP = path.join(os.tmpdir(), 'mochi-side-art');
const KEEP = process.argv.includes('--keep');

const C = {
  line: '#1f2a44', hair: '#9eb9e6', hairHi: '#c4d7f5', hairSh: '#758baf',
  skin: '#ffe6da', skinSh: '#f3cdbf', blush: '#f2a9a9',
  jacket: '#23262e', jacketHi: '#434a5e', sleeve: '#3a425b', sleeveFar: '#242836', shirt: '#f4f6fb', tie: '#274a96',
  skirt: '#20232c', skirtLine: '#c9d0de', sock: '#1c1e25', boot: '#1c1e24', lace: '#6a7290',
  bow: '#101114', bowHi: '#3b4056', gold: '#f2c94c',
  iris: '#62c48e', irisDk: '#2e7d5d', pupil: '#1b3a36',
};
const ROLE = { jacket: '#ff0000', shirt: '#00ff00', tie: '#0000ff' };
const GROUND = 391;
const f2 = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

let MASK = false;                                   // đang dựng mặt nạ?
const R = (role, normal) => (MASK && role ? ROLE[role] : normal);
const SH = (s) => (MASK ? '' : s);                  // lớp bóng/chi tiết: bỏ khỏi mặt nạ
let UID = 0;
const DEFS = '<defs><filter id="b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter><filter id="b3" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter><filter id="b4" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4.5"/></filter>' +
  '<linearGradient id="irg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e7d5d"/><stop offset="0.5" stop-color="#52b887"/><stop offset="1" stop-color="#a9e8c4"/></linearGradient></defs>';
// lớp bóng mềm (mép mờ) cắt theo hình clipD
const soft = (clipD, shape, fill, op, blur = 3) => { if (MASK) return ''; const id = 'sc' + (UID++); return `<clipPath id="${id}"><path d="${clipD}"/></clipPath><g clip-path="url(#${id})"><g filter="url(#b${blur})" opacity="${op}">${shape.replace(/FILL/g, fill)}</g></g>`; };
const SK = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const P = (d, fill, extra = '', role) => `<path d="${d}" fill="${R(role, fill)}" ${extra.includes('stroke-width') ? SK.replace(/stroke-width="3"/, '') : SK} ${extra}/>`;

// ---------- bezier ----------
function spline(pts) {
  const n = pts.length;
  let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f2(p1[0] + (p2[0] - p0[0]) / 6)},${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)},${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])},${f2(p2[1])}`;
  }
  return d + ' Z';
}
function limb(A, K, B, widths, ta = 0, tb = 1, cap = 0.8) {
  const Q = [2 * K[0] - (A[0] + B[0]) / 2, 2 * K[1] - (A[1] + B[1]) / 2];
  const at = (t) => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * Q[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * Q[1] + t * t * B[1]];
  const tg = (t) => { const x = 2 * (1 - t) * (Q[0] - A[0]) + 2 * t * (B[0] - Q[0]), y = 2 * (1 - t) * (Q[1] - A[1]) + 2 * t * (B[1] - Q[1]); const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const w = (u) => { for (let i = 0; i < widths.length - 1; i++) { const a = widths[i], b = widths[i + 1]; if (u <= b[0] || i === widths.length - 2) return lerp(a[1], b[1], sm(clamp01((u - a[0]) / (b[0] - a[0])))); } return widths[0][1]; };
  const n = 12, L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(ta, tb, i / n), p = at(t), d = tg(t), nx = -d[1], ny = d[0], h = w(t) / 2;
    L.push([p[0] + nx * h, p[1] + ny * h]); Rr.push([p[0] - nx * h, p[1] - ny * h]);
  }
  const e0 = at(ta), d0 = tg(ta), e1 = at(tb), d1 = tg(tb), h0 = w(ta) / 2 * cap, h1 = w(tb) / 2 * cap;
  const pts = [[e0[0] - d0[0] * h0, e0[1] - d0[1] * h0], ...L, [e1[0] + d1[0] * h1, e1[1] + d1[1] * h1], ...Rr.reverse()];
  return { d: spline(pts), at, tg };
}
function ik(H, A, l1, l2) {
  let dx = A[0] - H[0], dy = A[1] - H[1], d = Math.hypot(dx, dy);
  const dm = (l1 + l2) * 0.998;
  if (d > dm) { dx *= dm / d; dy *= dm / d; d = dm; A = [H[0] + dx, H[1] + dy]; }
  const a = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const k1 = [H[0] + l1 * Math.cos(a - al), H[1] + l1 * Math.sin(a - al)], k2 = [H[0] + l1 * Math.cos(a + al), H[1] + l1 * Math.sin(a + al)];
  return { K: k1[0] >= k2[0] ? k1 : k2, A };
}
// biến dạng mọi cặp "x,y" trong chuỗi path (tóc/vạt lắc trễ pha)
function warp(str, fx) { return str.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => { const q = fx(+x, +y); return f2(q[0]) + ',' + f2(q[1]); }); }

// ---------- chân ----------
const SHOE = 'M-6,-12 L6,-12 C7,-7 8,-4 12,-3 C20,-1 25,3 24,8 C23,12 19,12 15,12 L-5,12 C-10,12 -10,5 -8,0 Z';
const SHOE_PTS = [[-5, 12], [15, 12], [20.5, 11.5], [23.5, 9], [-9, 8]];
const soleMax = (a) => Math.max(...SHOE_PTS.map(([x, y]) => x * Math.sin(a * D2R) + y * Math.cos(a * D2R)));
function footAt(ph, S, lift, flat) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {                       // chân đứng: gót chạm (mũi hếch) -> trụ -> đẩy, nhấc gót
    const u = ph / 0.5;
    let ang = 0;
    if (!flat) ang = u < 0.2 ? -14 * (1 - u / 0.2) : u > 0.7 ? 38 * sm((u - 0.7) / 0.3) : 0;
    return { dx: S * (1 - 2 * u), lift: 0, ang };
  }
  const u = (ph - 0.5) / 0.5;           // chân vung: nhấc, đưa tới (sin mượt)
  return { dx: -S + 2 * S * sm(u), lift: lift * Math.sin(Math.PI * u), ang: flat ? 0 : 38 - 52 * sm(u) };
}
function shoe(A, ang, far) {
  return `<g transform="translate(${f2(A[0])} ${f2(A[1])}) rotate(${f2(ang)})">` +
    P(SHOE, far ? '#14161b' : C.boot) +
    SH(`<path d="M-8,8.6 L20,8.8" stroke="${far ? '#3a3f4d' : '#8d96b3'}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<path d="M-6,-6 C-2,-4 3,-4 7,-6" stroke="${C.lace}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<path d="M-3,-1 L4,2 M4,-1 L-3,2" stroke="${C.lace}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`) + `</g>`;
}
function leg(H, A, ang, far) {
  const { K, A: A2 } = ik(H, A, 41, 41);
  const wd = [[0, 21], [0.5, 15], [0.72, 15.5], [1, 10.5]];
  const skin = limb(H, K, A2, wd), sock = limb(H, K, A2, wd.map(([u, w]) => [u, w + 1.4]), 0.5, 0.99, 0.55), band = limb(H, K, A2, wd.map(([u, w]) => [u, w + 1.9]), 0.5, 0.6, 0.2);
  return P(skin.d, far ? '#e9cbbd' : C.skin) + soft(skin.d, `<ellipse cx="${f2(H[0])}" cy="${f2(H[1] + 20)}" rx="18" ry="14" fill="FILL"/>`, '#c98f7f', 0.6, 3) + P(sock.d, far ? '#14161b' : C.sock) + P(band.d, far ? '#aab0bd' : '#eef0f6', 'stroke-width="2.2"') + shoe(A2, ang, far);
}

// ---------- tay áo cardigan rộng loe ----------
function arm(S, a1, a2, near) {
  const L1 = 36, L2 = 31;
  const E = [S[0] + L1 * Math.sin(a1 * D2R), S[1] + L1 * Math.cos(a1 * D2R)];
  const W = [E[0] + L2 * Math.sin(a2 * D2R), E[1] + L2 * Math.cos(a2 * D2R)];
  const sl = limb(S, E, W, [[0, 24], [0.45, 23], [0.7, 27], [1, 34]], 0, 1, 0.55);
  const dir = [Math.sin(a2 * D2R), Math.cos(a2 * D2R)], nx = -dir[1], ny = dir[0];
  const tip = [W[0] + dir[0] * 9, W[1] + dir[1] * 9];
  let s = `<ellipse cx="${f2(tip[0])}" cy="${f2(tip[1])}" rx="8" ry="7.5" fill="${near ? C.skin : '#e8cdc0'}" ${SK}/>`;
  s += P(sl.d, near ? C.sleeve : C.sleeveFar, '', 'jacket');
  s += `<path d="M${f2(W[0] + nx * 15 + dir[0] * 4)},${f2(W[1] + ny * 15 + dir[1] * 4)} Q${f2(W[0] + dir[0] * 11)},${f2(W[1] + dir[1] * 11)} ${f2(W[0] - nx * 15 + dir[0] * 4)},${f2(W[1] - ny * 15 + dir[1] * 4)}" fill="none" stroke="${R('shirt', near ? C.shirt : '#c8cbd4')}" stroke-width="3.2" stroke-linecap="round"/>`;
  if (near) {
    const d1 = [Math.sin(a1 * D2R), Math.cos(a1 * D2R)];
    s += SH(`<path d="M${f2(S[0] + 7 * -d1[1] + d1[0] * 6)},${f2(S[1] + 7 * d1[0] + d1[1] * 6)} Q${f2(E[0] + 8 * -d1[1])},${f2(E[1] + 8 * d1[0])} ${f2(W[0] + 11 * -dir[1])},${f2(W[1] + 11 * dir[0] - 2)}" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`);
  }
  return s;
}

// ---------- đầu ----------
const FACE = 'M252,108 C262,122 264,142 262,158 C261,168 260,174 261,180 C262,184 266,186 266,190 C267,193 271,197 272,206 C273,216 268,226 258,231 C250,235 240,235 232,232 C224,229 214,224 208,218 L206,170 L204,108 Z';
function eye(ex, ey, id, o = {}) {
  const lid = o.lid || 0, sc = o.sc || 1;
  const rx = 12.5 * sc, ry = 16.5 * (1 - 0.3 * lid) * (sc > 0.9 ? 1 : 0.95);
  ey += lid * 2;
  let s = `<clipPath id="${id}"><ellipse cx="${f2(ex)}" cy="${f2(ey)}" rx="${f2(rx)}" ry="${f2(ry)}"/></clipPath>`;
  s += `<ellipse cx="${f2(ex)}" cy="${f2(ey)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="${C.iris}" ${SK}/>`;
  // mống mắt chuyển sắc (đậm trên -> sáng dưới), con ngươi, 2 đốm sáng, viền sáng dưới như dáng thẳng
  s += SH(`<g clip-path="url(#${id})"><rect x="${f2(ex - rx)}" y="${f2(ey - ry)}" width="${f2(rx * 2)}" height="${f2(ry * 2)}" fill="url(#irg)"/>` +
    (lid ? `<rect x="${f2(ex - rx)}" y="${f2(ey - ry)}" width="${f2(rx * 2)}" height="${f2(ry * lid * 1.1)}" fill="${C.irisDk}"/>` : '') +
    `<ellipse cx="${f2(ex + 1.5 * sc)}" cy="${f2(ey + 2.5)}" rx="${f2(6.2 * sc)}" ry="9.5" fill="${C.pupil}"/>` +
    `<path d="M${f2(ex - rx * 0.6)},${f2(ey + ry * 0.72)} Q${f2(ex)},${f2(ey + ry * 1.0)} ${f2(ex + rx * 0.7)},${f2(ey + ry * 0.7)}" fill="none" stroke="#d6f6e2" stroke-width="2.2" opacity="0.8" stroke-linecap="round"/>` +
    `<ellipse cx="${f2(ex - 3.5 * sc)}" cy="${f2(ey - 5.5)}" rx="${f2(5 * sc)}" ry="5.6" fill="#fff"/><circle cx="${f2(ex + 4.5 * sc)}" cy="${f2(ey + 8)}" r="${f2(2.4 * Math.max(0.8, sc))}" fill="#fff"/></g>`);
  s += `<path d="M${f2(ex - rx - 2)},${f2(ey - 3)} C${f2(ex - rx)},${f2(ey - ry - 5 + lid * 4)} ${f2(ex + 3)},${f2(ey - ry - 5 + lid * 4)} ${f2(ex + rx + 1)},${f2(ey - 6)}" fill="none" stroke="${C.line}" stroke-width="5.5" stroke-linecap="round"/>`;
  if (sc > 0.9) s += `<path d="M${f2(ex - rx - 1)},${f2(ey - 4)} L${f2(ex - rx - 9)},${f2(ey - 11 + lid * 3)}" fill="none" stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"/>`;
  return s;
}
// tóc sau: liền từ đỉnh đầu theo gáy tròn rồi rủ SÁT lưng, đuôi 3-4 mũi nhọn mềm
const HAIR_BACK = 'M266,124 C258,100 232,86 204,86 C160,86 127,112 125,160 C124,196 132,222 139,242 C143,264 142,292 137,318 ' +
  'C135,328 134,336 138,340 C144,342 148,334 150,325 C152,335 156,342 161,340 C166,337 169,330 171,322 C173,333 177,340 181,337 C185,333 186,325 186,314 ' +
  'C188,296 191,262 196,236 C198,228 200,222 200,215 Z';
// 3/4: đầu rộng hơn, tóc xoã cả hai bên (bên xa lộ sau vai)
const HAIR_BACK34 = 'M283,160 C284,114 258,86 224,86 C186,86 158,112 158,160 C157,196 152,226 147,248 C143,272 142,296 138,318 ' +
  'C135,328 134,336 138,340 C144,342 148,334 150,325 C152,335 156,342 161,340 C166,337 169,330 171,322 C173,333 177,340 181,337 C185,333 186,325 186,314 ' +
  'C188,296 192,276 196,262 L252,262 C256,280 258,298 262,314 C262,326 266,336 272,336 C278,335 280,326 279,316 C280,288 282,254 283,222 C284,200 284,180 283,160 Z';
const STRANDS_D = ['M150,112 C138,160 138,230 146,300', 'M140,124 C132,170 138,222 144,290', 'M160,112 C150,165 152,240 156,318', 'M181,110 C170,180 170,250 174,330', 'M171,118 C162,175 162,240 166,306'];
const STRANDS_L = ['M146,130 C136,176 140,228 150,296', 'M156,118 C146,170 148,240 153,310', 'M168,112 C160,170 160,240 162,320', 'M176,124 C168,190 168,250 170,326', 'M136,176 C134,210 138,246 144,272'];
function hairBack(w, three) {
  const fx = (x, y) => { const s = clamp01((y - 200) / 140), d = clamp01((y - 250) / 90); return [x + w.sh * Math.pow(s, 1.4), y + w.drop * d]; };
  const back = warp(three ? HAIR_BACK34 : HAIR_BACK, fx);
  let s = P(back, C.hair);
  s += SH(`<clipPath id="bk"><path d="${back}"/></clipPath><g clip-path="url(#bk)">` +
    // mảng sáng nền + bóng mềm gáy / đuôi tóc
    `<path d="${warp('M126,200 C132,240 142,300 140,345 L170,345 C160,300 156,240 160,200 Z', fx)}" fill="#b0c8f0" opacity="0.55"/>` +
    `<path d="${warp('M126,168 C126,200 134,226 141,246 C143,226 138,200 144,186 C146,180 146,174 144,170 Z', fx)}" fill="${C.hairSh}" opacity="0.4"/>` +
    STRANDS_D.map((q) => `<path d="${warp(q, fx)}" fill="none" stroke="#6888c8" stroke-width="2.1" stroke-linecap="round" opacity="0.8"/>`).join('') +
    STRANDS_L.map((q, i) => `<path d="${warp(q, fx)}" fill="none" stroke="#d6e4fa" stroke-width="${1.6 + (i % 2) * 0.9}" stroke-linecap="round" opacity="0.9"/>`).join('') +
    `<g filter="url(#b4)" opacity="0.55"><ellipse cx="${three ? 196 : 186}" cy="226" rx="20" ry="46" fill="#586fa2"/></g>` +
    `<g filter="url(#b3)" opacity="0.5"><path d="${warp('M120,318 L196,318 L196,350 L120,350 Z', fx)}" fill="#7d96c8"/></g></g>`);
  s += `<path d="${back}" fill="none" ${SK}/>`;
  return s;
}
function face(o) {
  let s = P(FACE, C.skin);
  s += soft(FACE, '<path d="M200,134 L268,134 L266,172 L200,176 Z" fill="FILL"/>', '#e0a090', 0.6, 3);            // bóng dưới mái
  s += soft(FACE, '<ellipse cx="216" cy="206" rx="9" ry="22" fill="FILL"/>', '#e8b3a3', 0.65, 3);                 // bóng má sau gần tóc mái bên
  s += soft(FACE, '<ellipse cx="236" cy="236" rx="30" ry="7" fill="FILL"/>', '#e6ad9d', 0.55, 3);                  // dưới cằm
  s += SH(`<g filter="url(#b2)"><ellipse cx="246" cy="207" rx="12" ry="7" fill="${C.blush}" opacity="0.7"/></g>`);
  if (o.farEye) s += eye(252.5, 178, 'eyf', { sc: 0.62, lid: o.lid });
  s += eye(240, 177, 'eyc', { lid: o.lid });
  s += o.tired ? `<path d="M250,220 Q255,216 260,220" fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<path d="M250,217 Q255,221 260,216" fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"/>`;
  return s;
}
// mặt 3/4 thật: thấy hai mắt, mắt xa nhỏ và bị sống mũi che một phần
const FACE34 = 'M224,106 C258,106 274,138 273,170 C272,198 262,224 240,234 C230,238 218,238 208,233 C186,224 174,200 173,170 C174,138 192,106 224,106 Z';
function face34(o) {
  let s = P(FACE34, C.skin);
  s += soft(FACE34, '<path d="M170,138 L276,138 L276,170 L170,170 Z" fill="FILL"/>', '#e0a090', 0.55, 3);
  s += soft(FACE34, '<ellipse cx="228" cy="238" rx="34" ry="8" fill="FILL"/>', '#e6ad9d', 0.55, 3);
  s += soft(FACE34, '<ellipse cx="270" cy="190" rx="9" ry="34" fill="FILL"/>', '#e8b3a3', 0.6, 3);
  s += SH(`<g filter="url(#b2)"><ellipse cx="190" cy="208" rx="12" ry="7" fill="${C.blush}" opacity="0.7"/><ellipse cx="258" cy="208" rx="9" ry="6.5" fill="${C.blush}" opacity="0.7"/></g>`);
  s += eye(250, 180, 'eyf', { sc: 0.76, lid: o.lid });                                                              // mắt xa
  s += `<path d="M237,166 C243,178 246,190 242,198 L232,198 C233,186 235,176 237,166 Z" fill="${C.skin}"/>`;       // sống mũi che một phần mắt xa
  s += `<path d="M244,176 C247,185 248,193 244,198 C241,200 237,199 235,196" fill="none" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"/>`;
  s += eye(206, 180, 'eyc', { lid: o.lid });
  s += `<path d="M226,217 Q233,222 241,216" fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"/>`;
  return s;
}
function hairFront(o) {
  let s = '';
  const bangs = 'M204,98 C224,86 256,98 266,124 C270,140 265,152 259,161 C256,154 253,149 249,148 C249,155 247,160 243,164 C240,156 236,151 233,149 C232,155 229,160 225,164 C223,154 219,147 213,142 C209,138 206,131 204,122 Z';
  s += P(bangs, C.hair);
  s += soft(bangs, '<path d="M206,120 L268,120 L268,134 L206,134 Z" fill="FILL"/>', '#7d96c8', 0.5, 3);
  s += P('M247,148 C251,155 252,163 250,169 C246,163 245,155 247,148 Z', C.hair, 'stroke-width="2.2"');
  s += P('M230,150 C233,158 233,165 231,171 C227,165 226,157 230,150 Z', C.hair, 'stroke-width="2.2"');
  s += P('M203,114 C214,124 224,146 225,170 C225,190 221,206 215,217 C209,203 203,184 202,160 Z', C.hair);
  s += SH(`<path d="M211,134 C217,152 219,176 216,200" fill="none" stroke="#6888c8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M232,114 C246,114 256,122 260,134" fill="none" stroke="#6888c8" stroke-width="2" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="M222,150 C226,168 225,184 220,200" fill="none" stroke="#d6e4fa" stroke-width="2" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="M150,126 C166,106 206,98 250,112" fill="none" stroke="#b9cff3" stroke-width="10" stroke-linecap="round" opacity="0.9"/>` +
    ['M160,122 C182,104 214,100 246,110', 'M168,130 C190,112 220,108 252,120', 'M178,116 C198,104 224,102 244,106', 'M152,138 C166,118 190,108 214,104'].map((q, i) => `<path d="${q}" fill="none" stroke="#e1ecfc" stroke-width="${1.4 + (i % 2)}" stroke-linecap="round" opacity="0.95"/>`).join('') +
    `<path d="M236,112 C250,118 258,130 261,148" fill="none" stroke="#e1ecfc" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>`);
  s += ahogeBowClip(o, 214, 214, 118, 166, 124);
  return s;
}
// 3/4: mái chia lọn, hai lọn bên mặt
function hairFront34(o) {
  let s = '';
  const bangs = 'M172,150 C170,112 196,92 226,92 C256,92 278,116 274,152 C272,158 270,162 266,164 C264,158 262,154 258,150 C257,155 254,159 250,160 C247,156 244,153 240,152 C238,157 235,161 231,163 C228,157 224,154 219,153 C217,158 213,161 208,162 C205,157 200,154 194,152 C192,157 188,162 182,164 C178,160 175,156 172,150 Z';
  s += P(bangs, C.hair);
  s += soft(bangs, '<path d="M170,128 L276,128 L276,142 L170,142 Z" fill="FILL"/>', '#7d96c8', 0.5, 3);
  s += P('M174,130 C170,160 172,196 182,224 C188,206 192,180 192,150 C186,140 180,134 174,130 Z', C.hair);
  s += P('M272,130 C278,160 276,196 266,222 C260,204 256,180 258,152 C262,142 266,134 272,130 Z', C.hair);
  s += SH(`<path d="M180,146 C178,170 180,196 184,214" fill="none" stroke="#6888c8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M266,146 C268,170 266,196 264,210" fill="none" stroke="#6888c8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M186,150 C186,172 186,192 186,208" fill="none" stroke="#d6e4fa" stroke-width="2" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="M170,128 C188,108 232,100 268,120" fill="none" stroke="#b9cff3" stroke-width="10" stroke-linecap="round" opacity="0.9"/>` +
    ['M178,124 C198,106 230,102 262,116', 'M186,132 C206,114 236,110 266,126', 'M196,118 C214,106 238,104 256,110'].map((q, i) => `<path d="${q}" fill="none" stroke="#e1ecfc" stroke-width="${1.4 + (i % 2)}" stroke-linecap="round" opacity="0.95"/>`).join(''));
  s += ahogeBowClip(o, 226, 238, 116, 176, 122);
  return s;
}
function ahogeBowClip(o, ax, kx, ky, bx, by) {
  let s = `<g transform="rotate(${f2(o.ahoge || 0)} ${ax} 96)">` + P(`M${ax - 7},96 C${ax - 14},80 ${ax - 2},64 ${ax + 12},66 C${ax + 24},69 ${ax + 16},84 ${ax + 7},82 C${ax + 12},78 ${ax + 10},74 ${ax + 6},74 C${ax - 2},74 ${ax + 3},90 ${ax + 6},96 Z`, C.hair) + `</g>`;
  s += `<g transform="translate(${kx + 14} ${ky}) rotate(-20)">` + P('M-11,-3.5 h22 a3.5,3.5 0 0 1 0,7 h-22 a3.5,3.5 0 0 1 0,-7 Z', '#fbfcff', 'stroke-width="2.2"') +
    `<g transform="rotate(90)">` + P('M-11,-3.5 h22 a3.5,3.5 0 0 1 0,7 h-22 a3.5,3.5 0 0 1 0,-7 Z', '#fbfcff', 'stroke-width="2.2"') + `</g><circle r="3.4" fill="${C.gold}" stroke="${C.line}" stroke-width="1.6"/></g>`;
  const tail = (dx, len, w, tilt) => `M${dx - w / 2},4 C${dx - w / 2 + tilt * 0.3},${len * 0.4} ${dx - w / 2 + tilt * 0.7},${len * 0.8} ${dx + tilt - w / 2},${len} L${dx + tilt},${len - 5} L${dx + tilt + w / 2},${len + 2} C${dx + w / 2 + tilt * 0.7},${len * 0.8} ${dx + w / 2 + tilt * 0.3},${len * 0.4} ${dx + w / 2},4 Z`;
  const bs = o.bowSway || 0;
  s += `<g transform="translate(${bx} ${by}) rotate(-24) scale(0.82 0.9)">` + P(tail(-3, 62, 9, -3 + bs), C.bow, 'stroke-width="2.5"') + P(tail(7, 46, 8, 1 + bs), C.bow, 'stroke-width="2.5"') +
    P('M0,0 C-8,-17 -30,-14 -30,0 C-30,13 -10,16 0,0 Z', C.bow, 'stroke-width="2.5"') + P('M0,0 C8,-17 30,-14 30,0 C30,13 10,16 0,0 Z', C.bow, 'stroke-width="2.5"') +
    SH(`<path d="M-24,-5 Q-16,-11 -8,-5 M24,-5 Q16,-11 8,-5" stroke="${C.bowHi}" stroke-width="2" fill="none" stroke-linecap="round"/>`) + `<circle r="5.5" fill="${C.gold}" stroke="${C.line}" stroke-width="2.2"/></g>`;
  return s;
}

// ---------- thân: lưng thẳng, ngực hơi ưỡn; cardigan rộng vừa phải phủ hông ----------
function torso(w) {
  const fx = (x, y) => [x + w.card * clamp01((y - 250) / 62), y];
  let s = P('M212,226 L232,234 C238,258 241,288 240,306 L218,306 Z', C.shirt, 'stroke-width="2.5"', 'shirt');
  s += P('M229,236 L238,238 L239,274 L234,283 L229,274 Z', C.tie, 'stroke-width="2.2"', 'tie');
  const cardD = warp('M178,236 C175,252 173,272 174,292 C174,300 172,306 170,311 C184,317 206,317 237,311 C240,294 239,270 233,252 C230,242 226,236 220,230 C206,222 190,226 178,236 Z', fx);
  s += P(cardD, C.jacket, '', 'jacket');
  s += SH(`<path d="${warp('M172,304 C184,310 208,310 236,304', fx)}" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>` +
    `<path d="${warp('M179,244 C177,262 176,282 176,298', fx)}" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="${warp('M222,306 C219,296 224,284 221,270 C220,262 222,256 222,250', fx)}" fill="none" stroke="${C.jacketHi}" stroke-width="2.6" stroke-linecap="round" opacity="0.75"/>`);
  // bóng mềm: nếp vạt trước, nếp ngang eo, dưới vai, chân cổ
  s += soft(cardD, `<path d="${warp('M226,310 C224,298 228,288 226,270', fx)}" fill="none" stroke="FILL" stroke-width="7"/>` +
    `<path d="${warp('M180,284 C196,292 214,292 232,284', fx)}" fill="none" stroke="FILL" stroke-width="6"/>` +
    `<ellipse cx="190" cy="300" rx="14" ry="26" fill="FILL"/>`, '#0b0d12', 0.55, 3);
  s += soft(cardD, `<path d="${warp('M186,238 C204,232 220,238 230,252', fx)}" fill="none" stroke="FILL" stroke-width="6"/>`, '#6a7390', 0.4, 3);
  s += P('M206,222 C213,230 222,235 233,238 L231,229 C222,226 213,221 207,214 Z', C.shirt, 'stroke-width="2.2"', 'shirt');
  s += soft(cardD, '<ellipse cx="222" cy="244" rx="22" ry="8" fill="FILL"/>', '#07080b', 0.5, 3);       // bóng cằm lên áo
  return s;
}
function skirtSvg(w) {
  const fx = (x, y) => [x + w.skirt * clamp01((y - 296) / 28), y];
  const d = warp('M174,296 L236,296 L252,313 C240,320 226,316 213,321 C199,325 184,318 170,321 C163,322 158,320 155,316 Z', fx);
  let s = P(d, C.skirt);
  s += SH(`<path d="${warp('M158,313 C172,319 186,316 198,320 C212,315 226,319 249,310', fx)}" fill="none" stroke="${C.skirtLine}" stroke-width="2.2" stroke-linecap="round"/>` +
    [182, 204, 226].map((x, i) => `<path d="${warp(`M${x},299 L${x + 4 + i * 2},315`, fx)}" stroke="#3a3e4c" stroke-width="2" fill="none" stroke-linecap="round"/>`).join(''));
  s += soft(d, '<ellipse cx="205" cy="300" rx="50" ry="9" fill="FILL"/>', '#06070a', 0.65, 3);              // trong váy, dưới gấu cardigan
  return s;
}

// ---------- ráp một khung ----------
const HIP_Y = 306, HIP_X = 205;
// chạy: tiếp đất ngắn, có pha bay (hai chân rời đất)
function runFoot(ph, p) {
  ph = ((ph % 1) + 1) % 1;
  const SF = 0.34;
  if (ph < SF) {
    const u = ph / SF;
    const ang = u < 0.2 ? -14 * (1 - u / 0.2) : u > 0.7 ? 38 * sm((u - 0.7) / 0.3) : 0;
    return { dx: p.S0 - (p.S0 + p.S1) * u, lift: 0, ang };
  }
  const u = (ph - SF) / (1 - SF);
  return { dx: -p.S1 + (p.S0 + p.S1) * sm(u), lift: p.lift * Math.sin(Math.PI * u), ang: 38 - 52 * sm(u) };
}
function buildFrame(p, mask) {
  MASK = mask; UID = 0;
  const nearH = [HIP_X - 9, 0], farH = [HIP_X + 9, 0];
  const hipY = p.run
    ? HIP_Y + 3 - 11 * (1 - Math.cos(TAU * 2 * (p.ph - 0.17))) / 2
    : HIP_Y - (p.bob || 0) * (1 - Math.cos(TAU * 2 * p.ph)) / 2 + (p.slump || 0);
  nearH[1] = farH[1] = hipY;
  const fN = p.run ? runFoot(p.ph + 0.5, p) : footAt(p.ph + 0.5, p.S, p.lift, p.flat);
  const fF = p.run ? runFoot(p.ph, p) : footAt(p.ph, p.S, p.lift, p.flat);
  const A = (f, h, off) => [h[0] + f.dx + off, GROUND - 0.5 - soleMax(f.ang) - f.lift];
  const aN = A(fN, nearH, -2 + (p.flat ? -4 : 0)), aF = A(fF, farH, 2 + (p.flat ? 6 : 0));
  const snap = fN.lift < 0.5 || fF.lift < 0.5;                 // có chân chạm đất -> căn đáy về 392
  let legs = '';
  legs += leg(farH, aF, fF.ang, true);
  legs += leg(nearH, aN, fN.ang, false);
  const dy = hipY - HIP_Y, shY = 247 + (p.tired ? 4 : 0), S = [199, shY];
  const hw = { sh: p.hairSh || 0, drop: p.hairDrop || 0 };
  const cw = { card: p.cardSway || 0, skirt: p.skirtSway || 0 };
  const headT = `translate(0 ${f2(p.nod || 0)}) rotate(${f2(p.tilt || 0)} 205 232)`;
  const th = !!p.three;
  const neck = th ? 'M219,214 L235,214 C236,224 236,232 237,240 L217,240 C218,232 218,224 219,214 Z' : 'M211,214 L227,214 C228,224 228,232 229,240 L209,240 C210,232 210,224 211,214 Z';
  const k = p.sx || 1;
  let torsoPart = '';
  torsoPart += legs;
  torsoPart += `<g transform="translate(0 ${f2(dy)}) rotate(${f2(p.lean)} ${HIP_X} ${HIP_Y})">` +
    arm([199, shY], p.armF[0], p.armF[1], false) + skirtSvg(cw) + `<path d="${neck}" fill="${R(null, C.skinSh)}" ${SK}/>` + torso(cw) + arm([199, shY], p.armN[0], p.armN[1], true) + `</g>`;
  if (k !== 1) torsoPart = `<g transform="translate(${HIP_X} 0) scale(${k} 1) translate(${-HIP_X} 0)">${torsoPart}</g>`;
  // đầu (không bị nén): tóc sau nằm dưới thân, mặt + mái nằm trên; tay gần vẽ sau cùng nên tách riêng
  const headBack = `<g transform="translate(0 ${f2(dy)}) rotate(${f2(p.lean)} ${HIP_X} ${HIP_Y})"><g transform="${headT}">${hairBack(hw, th)}</g></g>`;
  const headFront = `<g transform="translate(0 ${f2(dy)}) rotate(${f2(p.lean)} ${HIP_X} ${HIP_Y})"><g transform="${headT}">${th ? face34(p) + hairFront34(p) : face(p) + hairFront(p)}</g></g>`;
  const body = headBack + torsoPart + headFront;
  const bg = mask ? '<rect width="400" height="400" fill="#000"/>' : '';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"${mask ? ' shape-rendering="crispEdges"' : ''}>${mask ? '' : DEFS}${bg}${body}</svg>`;
  if (mask) svg = svg.replace(/#[0-9a-fA-F]{6}\b/g, (c) => (/^#(ff0000|00ff00|0000ff)$/i.test(c) ? c : '#000000'));
  // điểm chuẩn đầu: đỉnh tóc qua cùng các phép biến đổi
  const rot = (x, y, a, ox, oy) => { const c = Math.cos(a * D2R), s2 = Math.sin(a * D2R); return [ox + (x - ox) * c - (y - oy) * s2, oy + (x - ox) * s2 + (y - oy) * c]; };
  let hp = rot(th ? 222 : 204, 88, p.tilt || 0, 205, 232);
  hp = [hp[0], hp[1] + (p.nod || 0)];
  hp = rot(hp[0], hp[1], p.lean, HIP_X, HIP_Y);
  hp = [hp[0], hp[1] + dy];
  MASK = false;
  return { svg, head: hp, hipY, snap };
}

// ---------- bộ khung ----------
const NF = 12;
function walkParams(i, tired) {
  const ph = i / NF, lag = (n) => n / NF;
  const c = (x) => Math.cos(x), s = (x) => Math.sin(x);
  if (!tired) {
    const a1 = 4 + 28 * c(TAU * ph);                         // tay gần: ra trước ở khung tiếp đất (ngược pha chân gần)
    return {
      ph, S: 39, lift: 17, bob: 3, flat: false, tired: false,
      lean: 0.4 + 1 * s(TAU * ph - 0.3),                     // gần như đứng thẳng, dao động +-1 độ
      tilt: -3 + 0.8 * s(TAU * 2 * (ph - lag(1))), nod: 1.1 * c(TAU * 2 * (ph - lag(1))),
      armN: [a1, a1 + 14 + 11 * Math.max(0, c(TAU * ph))],
      armF: [4 - 25 * c(TAU * (ph - lag(0.5))), 4 - 25 * c(TAU * (ph - lag(0.5))) + 14 + 11 * Math.max(0, -c(TAU * (ph - lag(0.5))))],
      hairSh: -(4 + 4 * c(TAU * 2 * (ph - lag(2)))) - 2, hairDrop: 2.5 * c(TAU * 2 * (ph - lag(2))),
      cardSway: -3.5 * c(TAU * (ph - lag(1.5))), skirtSway: -6 * c(TAU * (ph - lag(1.5))),
      ahoge: 6 * c(TAU * 2 * (ph - lag(1.5))), bowSway: 3 * c(TAU * 2 * (ph - lag(2))),
    };
  }
  const a1 = 5 + 8 * c(TAU * (ph - lag(1)));
  return {
    ph, S: 20, lift: 6, bob: 4, flat: false, tired: true, lid: 0.45, slump: 2,
    lean: 6 + 1.2 * s(TAU * ph - 0.3),
    tilt: 9 + 1 * s(TAU * 2 * (ph - lag(1))), nod: 3 + 1.5 * c(TAU * 2 * (ph - lag(1))),
    armN: [a1, a1 + 9], armF: [5 - 8 * c(TAU * (ph - lag(1))), 5 - 8 * c(TAU * (ph - lag(1))) + 9],
    hairSh: -(2 + 2 * c(TAU * 2 * (ph - lag(2)))) - 1, hairDrop: 1.2 * c(TAU * 2 * (ph - lag(2))),
    cardSway: -2 * c(TAU * (ph - lag(1.5))), skirtSway: -3 * c(TAU * (ph - lag(1.5))),
    ahoge: 3 * c(TAU * 2 * (ph - lag(1.5))), bowSway: 1.5 * c(TAU * 2 * (ph - lag(2))),
  };
}
// chạy nghiêng: 8 khung, có pha bay, người đổ trước ~8 độ, tay gập khuỷu vung mạnh, tóc bay ngang ra sau
function runParams(i) {
  const NR = 8, ph = i / NR, lag = (n) => n / NR;
  const c = (x) => Math.cos(x), s = (x) => Math.sin(x);
  const a1 = 6 + 42 * c(TAU * ph), b1 = 6 - 42 * c(TAU * ph);
  const bendN = 62 + 22 * Math.max(0, c(TAU * ph)), bendF = 62 + 22 * Math.max(0, -c(TAU * ph));
  return {
    ph, run: true, S0: 33, S1: 42, lift: 36, flat: false, tired: false,
    lean: 8 + 1 * s(TAU * 2 * ph), tilt: -5 + 1.2 * s(TAU * 2 * (ph - lag(1))), nod: 1.5 * c(TAU * 2 * (ph - lag(0.7))),
    armN: [a1, a1 + bendN], armF: [b1, b1 + bendF],
    hairSh: -46 + 6 * c(TAU * 2 * (ph - lag(1.5))), hairDrop: -20 + 5 * c(TAU * 2 * (ph - lag(1.5))),
    cardSway: -6 + 1.5 * c(TAU * 2 * (ph - lag(1))), skirtSway: -14 + 3 * c(TAU * 2 * (ph - lag(1))),
    ahoge: -16 + 4 * c(TAU * 2 * (ph - lag(1))), bowSway: -6,
  };
}
// khung quay: 'profile' = nghiêng đứng thẳng; 'three' = 3/4 thật (thân nén 0.88, đầu vẽ riêng)
function turnParams(kind) {
  const base = { ph: 0, S: 0, lift: 0, bob: 0, flat: true, tired: false, ahoge: 0, bowSway: 0, cardSway: 0, skirtSway: 0, nod: 0, hairDrop: 0 };
  if (kind === 'three') return Object.assign(base, { three: true, sx: 0.88, lean: 0.2, tilt: -1.5, armN: [4, 14], armF: [-3, 6], hairSh: -2 });
  return Object.assign(base, { lean: 0.4, tilt: -3, armN: [6, 18], armF: [-4, 6], hairSh: -4 });
}
function genAll() {
  const sets = [];
  sets.push({ rel: 'walk_side/normal/loop', ms: 75, frames: [...Array(NF)].map((_, i) => walkParams(i, false)) });
  sets.push({ rel: 'walk_side/tired/loop', ms: 110, frames: [...Array(NF)].map((_, i) => walkParams(i, true)) });
  sets.push({ rel: 'run_side/normal/loop', ms: 60, frames: [...Array(8)].map((_, i) => runParams(i)) });
  // quay: gần thẳng (chính là khung idle) -> 3/4 -> nghiêng
  const IDLE = { copyIdle: true };
  sets.push({ rel: 'turn_side/normal/start', ms: 70, frames: [IDLE, turnParams('three'), turnParams('profile')] });
  sets.push({ rel: 'turn_side/normal/end', ms: 70, frames: [turnParams('profile'), turnParams('three'), IDLE] });
  return sets;
}

// ---------- Chrome ----------
function findChrome() {
  const c = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'];
  for (const x of c) if (fs.existsSync(x)) return x;
  throw new Error('Không thấy Chrome/Edge');
}
const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const PAGE = `<!doctype html><meta charset="utf-8"><body><pre id="o"></pre><script>
const J = JSON.parse(document.getElementById('job').textContent);
const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400;
const cx = cv.getContext('2d', { willReadFrequently: true });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function render(svg, mask) {
  const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  cx.clearRect(0, 0, 400, 400); cx.drawImage(img, 0, 0, 400, 400);
  const id = cx.getImageData(0, 0, 400, 400), d = id.data;
  let minx = 400, maxx = -1, miny = 400, maxy = -1;
  if (mask) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]; const m = Math.max(r, g, b);
      let R = 0, G = 0, B = 0;
      if (m >= 110) { if (r === m) R = 255; else if (g === m) G = 255; else B = 255; }
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
  } else {
    for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 20) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  return { url: cv.toDataURL('image/png'), bbox: [minx, miny, maxx, maxy] };
}
(async () => {
  const out = { frames: {}, masks: {}, ref: null };
  // đỉnh mái idle (bỏ ahoge): hàng đầu tiên có >= 40 điểm đục liên tục
  const idle = await loadImg(J.idle); cx.clearRect(0, 0, 400, 400); cx.drawImage(idle, 0, 0);
  const d = cx.getImageData(0, 0, 400, 400).data;
  for (let y = 0; y < 400 && !out.ref; y++) { let run = 0, st = 0; for (let x = 0; x < 400; x++) { if (d[(y * 400 + x) * 4 + 3] > 20) { if (!run) st = x; run++; if (run >= 40) { let e = x; while (e < 399 && d[(y * 400 + e + 1) * 4 + 3] > 20) e++; out.ref = [(st + e) / 2, y]; break; } } else run = 0; } }
  for (const k of Object.keys(J.svgs)) {
    const r = await render(J.svgs[k].img, false); out.frames[k] = r;
    const m = await render(J.svgs[k].mask, true); out.masks[k] = m.url;
  }
  document.getElementById('o').textContent = JSON.stringify(out);
  document.title = 'done';
})().catch((e) => { document.getElementById('o').textContent = 'ERR ' + e + ' ' + (e && e.stack); });
</script>`;

function sheetPage(items) { return items; }

function main() {
  const sets = genAll();
  fs.mkdirSync(TMP, { recursive: true });
  const svgs = {}, meta = [];
  // xoá khung cũ (khác số khung/thời lượng) để không lẫn
  for (const s of sets) for (const base of [s.rel, path.join('masks', s.rel)]) {
    const dir = path.join(PET, base);
    if (fs.existsSync(dir)) for (const fn of fs.readdirSync(dir)) if (/.png$/.test(fn)) fs.unlinkSync(path.join(dir, fn));
  }
  for (const s of sets) {
    s.frames.forEach((p, i) => {
      const name = `${String(i + 1).padStart(4, '0')}_${s.ms}.png`;
      const key = `${s.rel}/${name}`;
      if (p.copyIdle) { meta.push({ key, copyIdle: true }); return; }
      const a = buildFrame(p, false), b = buildFrame(p, true);
      svgs[key] = { img: a.svg, mask: b.svg };
      meta.push({ key, head: a.head, hipY: a.hipY, snap: a.snap });
      if (KEEP) { fs.writeFileSync(path.join(TMP, key.replace(/\//g, '__') + '.svg'), a.svg); }
    });
  }
  const renderAll = () => {
  const idleFile = path.join(PET, 'idle', 'normal', 'loop', '0001_160.png');
  const job = { svgs, idle: dataUrl(idleFile) };
  const html = PAGE.replace('<script>', `<script id="job" type="application/json">${JSON.stringify(job).replace(/</g, '\\u003c')}</script><script>`);
  const htmlFile = path.join(TMP, 'render.html');
  fs.writeFileSync(htmlFile, html);
  const r = cp.spawnSync(findChrome(), ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--user-data-dir=${path.join(TMP, 'profile')}`,
    '--virtual-time-budget=120000', '--dump-dom', 'file:///' + htmlFile.replace(/\\/g, '/')], { maxBuffer: 1 << 30, encoding: 'utf8', timeout: 240000 });
  const m = /<pre id="o">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  if (!m) { console.error('Chrome không trả kết quả', (r.stderr || '').slice(0, 500)); process.exit(1); }
  const txt = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (txt.startsWith('ERR')) { console.error(txt); process.exit(1); }
  return JSON.parse(txt);
  };
  let out = renderAll();
  // chỉnh đáy về đúng hàng 392: dịch cả khung theo số nguyên rồi dựng lại (lần 2)
  const shift = {};
  for (const mt of meta) { if (mt.copyIdle || !mt.snap) continue; const dy = 392 - out.frames[mt.key].bbox[3]; if (dy) { shift[mt.key] = dy; const v = svgs[mt.key];
    v.img = v.img.replace(/(<svg[^>]*>)/, `$1<g transform="translate(0 ${dy})">`).replace('</svg>', '</g></svg>');
    v.mask = v.mask.replace('<rect width="400" height="400" fill="#000"/>', `<rect width="400" height="400" fill="#000"/><g transform="translate(0 ${dy})">`).replace('</svg>', '</g></svg>');
    mt.head[1] += dy; mt.hipY += dy; } }
  if (Object.keys(shift).length) out = renderAll();
  const ref = out.ref;
  const head = {};
  const save = (file, url) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
  let bad = 0;
  const idleHead = JSON.parse(fs.readFileSync(path.join(PET, 'masks', 'head.json'), 'utf8'))['idle/normal/loop/0001_160.png'] || [0, 0];
  for (const mt of meta) {
    if (mt.copyIdle) {
      fs.copyFileSync(path.join(PET, 'idle/normal/loop/0001_160.png'), path.join(PET, mt.key));
      fs.mkdirSync(path.dirname(path.join(PET, 'masks', mt.key)), { recursive: true });
      fs.copyFileSync(path.join(PET, 'masks/idle/normal/loop/0001_160.png'), path.join(PET, 'masks', mt.key));
      head[mt.key] = [idleHead[0], idleHead[1], 1];
      console.log(mt.key.padEnd(40), '(= idle 0001)');
      continue;
    }
    save(path.join(PET, mt.key), out.frames[mt.key].url);
    save(path.join(PET, 'masks', mt.key), out.masks[mt.key]);
    head[mt.key] = [Math.round((mt.head[0] - ref[0]) * 10) / 10, Math.round((mt.head[1] - ref[1]) * 10) / 10, 1];
    const bb = out.frames[mt.key].bbox;
    console.log(mt.key.padEnd(40), 'bbox', bb.join(','), 'hipY', f2(mt.hipY), 'head', head[mt.key].join(','));
    if (bb[3] !== 392 && mt.snap) bad++;
    if (bb[0] < 2 || bb[2] > 397) bad++;
  }
  // head_side.json (giữ nguyên các mục khác nếu có, chỉ ghi đè khoá dáng nghiêng)
  const hf = path.join(PET, 'masks', 'head_side.json');
  fs.writeFileSync(hf, JSON.stringify(head));
  console.log('idle ref', ref, 'khung lệch chuẩn:', bad);
  // ảnh ghép xem trước đã được dựng ở bước riêng (xem tools/art/contact.js nếu có)
  fs.writeFileSync(path.join(TMP, 'last-result.json'), JSON.stringify({ ref, meta }));
  if (!KEEP) { /* giữ TMP để soi nhanh, không xoá */ }
}
main();
