// ring — start 2×150, loop 4×100, end 3×130. Mood normal.
// Chuông cầm tay phải (bám xương hand_r), tay trái nắm giơ cổ vũ. Loop rung xen bell <-> bell_shake.
const idle = require('./idle.js');
const r2 = (v) => Math.round(v * 100) / 100;
const IDLE = idle.moods.normal.loop[0];

// --- ma trận 2D [a,b,c,d,e,f] (cùng quy ước tools/rig/lib/rig.js) ---
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const Rm = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const boneM = (P, b) => { b = b || {};
  return mul(mul(mul(T(P[0] + (b.x || 0), P[1] + (b.y || 0)), Rm(b.r || 0)), [b.sx == null ? 1 : b.sx, 0, 0, b.sy == null ? 1 : b.sy, 0, 0]), T(-P[0], -P[1])); };
const inv = (m) => { const det = m[0]*m[3]-m[1]*m[2]; const a = m[3]/det, b = -m[1]/det, c = -m[2]/det, d = m[0]/det;
  return [a, b, c, d, -(a*m[4]+c*m[5]), -(b*m[4]+d*m[5])]; };
const ap = (m, p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
const g = (bones, n) => bones[n] || {};

// Chuông bám xương hand_r, luôn thẳng đứng, tâm chuông cách cổ tay (dx,dy) px trong hệ canvas.
// Trả về show-entry {x,y,r} (xoay quanh gốc toạ độ nên bù lại) và tâm chuông trên canvas.
const BELL_C = [248, 300], HAND_P = [248, 306];
function bellShow(bones, file, dx, dy) {
  const Mb = mul(mul(mul(mul(boneM([200, 306], g(bones, 'hips')), boneM([200, 300], g(bones, 'chest'))),
    boneM([236, 244], g(bones, 'upper_arm_r'))), boneM([244, 278], g(bones, 'forearm_r'))), boneM([248, 306], g(bones, 'hand_r')));
  const th = Math.atan2(Mb[1], Mb[0]) * 180 / Math.PI;          // góc tổng của xương
  const hw = ap(Mb, HAND_P);
  const W = [hw[0] + dx, hw[1] + dy];
  const rc = ap(Rm(-th), BELL_C);                               // tâm chuông sau khi xoay -th quanh gốc
  const loc = ap(inv(Mb), W);                                   // vị trí đích trong hệ xương
  return { id: 'bell', file, bone: 'hand_r', x: r2(loc[0] - rc[0]), y: r2(loc[1] - rc[1]), r: r2(-th), _c: W };
}
const BELL_W = { dx: 41, dy: -44 };

function lerpBones(A, B, t) {
  const out = {};
  for (const n of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[n] || {}, b = B[n] || {}, o = {};
    for (const k of ['r', 'x', 'y', 'sx', 'sy']) {
      const d = k === 'sx' || k === 'sy' ? 1 : 0;
      const va = a[k] == null ? d : a[k], vb = b[k] == null ? d : b[k];
      if (va !== d || vb !== d || k === 'r') o[k] = r2(va + (vb - va) * t);
    }
    out[n] = o;
  }
  return out;
}

// khung loop i (0..3): rung ±10° xen kẽ
function loopFrame(i) {
  const a = (2 * Math.PI * i) / 4;
  const s = i % 2 === 0 ? 1 : -1;                 // dấu rung
  const lag = Math.sin(a - 0.9);
  const sh = i % 2 === 1;                         // khung chuông "shake"
  const bones = {
    hips: { y: r2(i % 2 === 0 ? -1 : 0) },
    chest: { sy: r2(1 + 0.02 * s), sx: r2(1 - 0.012 * s), r: r2(-1.2 * s) },
    head: { r: r2(-2 * s), y: r2(-0.5 * s) },
    hair_back: { r: r2(5 * s) }, sidelock_l: { r: r2(-6 * s) }, sidelock_r: { r: r2(-5 * s) },
    ahoge: { r: r2(10 * s) }, ribbon: { r: r2(-7 * s) },
    upper_arm_r: { r: r2(-52 + 3 * s) }, forearm_r: { r: r2(-100 + 10 * s) }, hand_r: { r: r2(-10 * s) },
    upper_arm_l: { r: r2(62 - 4 * s) }, forearm_l: { r: r2(88 - 6 * s) }, hand_l: { r: r2(5 * s) },
  };
  const bs = bellShow(bones, sh ? 'props/bell_shake.svg' : 'props/bell.svg', BELL_W.dx, BELL_W.dy);
  const bx = bs._c[0], by = bs._c[1]; delete bs._c; if (process.env.RDBG) console.error("bell", i, bx.toFixed(1), by.toFixed(1));
  return {
    ms: 100, face: 'shout', bones, swap: { hand_r: 'fist', hand_l: 'fist' },
    z: { hand_r: 205 },
    show: [
      bs,
      { id: 'ring_fx', file: sh ? 'fx/ring_lines2.svg' : 'fx/ring_lines.svg', bone: 'none', x: bx - 262, y: by - 230, z: 118 },
    ],
  };
}
const LOOP = [0, 1, 2, 3].map(loopFrame);
const L0 = LOOP[0];

const mkF = (ms, face, bones, swap, file, dx, dy) => {
  const bs = bellShow(bones, file || 'props/bell.svg', dx, dy); delete bs._c;
  return { ms, face, bones, swap, z: { hand_r: 205 }, show: [bs] };
};
const SW = { hand_r: 'fist', hand_l: 'fist' };

// start: lôi chuông ra từ sát người, mắt mở to
const b0 = lerpBones(IDLE.bones, L0.bones, 0.5);
b0.hips = { y: -1 }; b0.head = { r: 3, y: 0 }; b0.hair_back = { r: 4 }; b0.ahoge = { r: -6 };
const startFrames = [
  mkF(150, 'surprised', b0, { hand_r: 'fist', hand_l: 'fist' }, null, 4, -36),
  Object.assign({}, L0, { ms: 150, face: 'surprised', show: [L0.show[0]] }),
];

// end: hạ chuông, thở ra, về đứng gốc (chuông biến mất ở khung cuối)
const LL = LOOP[3];
const e1 = lerpBones(IDLE.bones, LL.bones, 0.5); e1.hips = { y: -0.5 }; e1.chest = { sy: 1.012, sx: 0.992 };
e1.hair_back = { r: -2 }; e1.ahoge = { r: 5 };
const e2 = lerpBones(IDLE.bones, LL.bones, 0.14); e2.hair_back = { r: 1.5 }; e2.ahoge = { r: -4 };
const endFrames = [
  mkF(130, 'talk', e1, { hand_r: 'fist', hand_l: 'fist' }, null, 4, -34),
  mkF(130, 'talk', e2, { hand_r: 'hold', hand_l: 'hold' }, null, 0, -30),
  { ms: 130, face: 'normal', bones: IDLE.bones, swap: IDLE.swap },
];

module.exports = { action: 'ring', moods: { normal: { start: startFrames, loop: LOOP, end: endFrames } } };
