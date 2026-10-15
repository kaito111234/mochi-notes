// pat_body — start 2×100, loop 4×125, end 2×150. Mood normal.
// Bị chọc/xoa thân: giật mình, nhột, hai tay ôm bụng, lắc người, cười khúc khích, rồi ngại.
// Tay đặt bằng IK 2 xương (tâm bàn tay đích trên canvas).
const idle = require('./idle.js');
const r2 = (v) => Math.round(v * 100) / 100;
const IDLE = idle.moods.normal.loop[0];

const RAD = Math.PI / 180;
const ARM = {
  r: { S: [236, 244], E: [244, 278], W: [248, 306], sgn: 1 },
  l: { S: [164, 244], E: [156, 278], W: [152, 306], sgn: -1 },
};
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
// trả {upper, fore} (độ) để tâm bàn tay (cách cổ tay HAND px dọc cẳng tay) tới T
const HAND = 13;
function ik(side, T) {
  const A = ARM[side], L1 = len(A.S, A.E), L2 = len(A.E, A.W);
  const f1 = ang(A.S, A.E), f2 = ang(A.E, A.W);
  let u = [0, 1], best = null;
  for (let it = 0; it < 4; it++) {
    const Wt = [T[0] - HAND * u[0], T[1] - HAND * u[1]];
    const d = Math.min(Math.max(len(A.S, Wt), Math.abs(L1 - L2) + 0.5), L1 + L2 - 0.5);
    const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) / RAD;
    const b = ang(A.S, Wt);
    const c = [b + a, b - a].map((t1) => {
      const E = [A.S[0] + L1 * Math.cos(t1 * RAD), A.S[1] + L1 * Math.sin(t1 * RAD)];
      return { t1, E, t2: ang(E, Wt) };
    }).sort((p, q) => q.E[1] - p.E[1])[0];     // khuỷu thấp hơn
    best = c; u = [Math.cos(c.t2 * RAD), Math.sin(c.t2 * RAD)];
  }
  const upper = best.t1 - f1, fore = best.t2 - f2 - upper;
  const wrap = (x) => ((x + 540) % 360) - 180;
  return { upper: r2(wrap(upper)), fore: r2(wrap(fore)) };
}
function arms(Tl, Tr, hl = 0, hr = 0) {
  const l = ik('l', Tl), r = ik('r', Tr);
  return { upper_arm_l: { r: l.upper }, forearm_l: { r: l.fore }, hand_l: { r: hl },
    upper_arm_r: { r: r.upper }, forearm_r: { r: r.fore }, hand_r: { r: hr } };
}
const SWAP = { hand_l: 'fist', hand_r: 'fist' };

// loop: nhột — lắc trái/phải, nảy
const SH = [1, 0, -1, 0];
const LOOP_FACE = ['flustered', 'closed_happy', 'uncomfortable', 'closed_happy'];
const loop = [0, 1, 2, 3].map((i) => {
  const s = [1, -0.3, -1, 0.3][i];           // lắc người
  const lag = [0.3, 1, -0.3, -1][i];
  const dy = i % 2 ? -0.8 : 0.4;
  const bones = {
    hips: { x: r2(1.4 * s), y: r2(i % 2 ? -1.2 : 0) },
    chest: { sy: r2(0.975 + 0.012 * (i % 2)), sx: 1.012, r: r2(3 * s) },
    head: { r: r2(-3.2 * s), x: r2(-0.6 * s), y: r2(2 + dy) },
    hair_back: { r: r2(-2.6 * lag) }, sidelock_l: { r: r2(3.4 * lag) }, sidelock_r: { r: r2(-3.4 * lag) },
    ahoge: { r: r2(-10 * lag + 4) }, ribbon: { r: r2(5 * lag) },
    ...arms([192 + 2 * s, 283 + dy], [208 + 2 * s, 283 + dy], 12, -12),
  };
  const show = [{ id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 }];
  if (i === 0 || i === 2) show.push({ id: 'fx_sweat', file: 'fx/shy_drop.svg', bone: 'head', z: 211, opacity: 1 });
  return { ms: 125, face: LOOP_FACE[i], bones, swap: SWAP, show, ...(i === 0 || i === 2 ? {} : { hide: ['fx_sweat'] }) };
});

const L0 = loop[0].bones;
const start = [
  { ms: 100, face: 'surprised',
    bones: { hips: { y: 0 }, chest: { sy: 0.96, sx: 1.02, r: -2 }, head: { y: 3, r: 2, x: -1 }, ahoge: { r: -14 }, hair_back: { r: 3 },
      sidelock_l: { r: -4 }, sidelock_r: { r: 4 }, ribbon: { r: -4 },
      ...arms([178, 270], [222, 270], 6, -6) },
    swap: SWAP, show: [{ id: 'fx_surprise', file: 'fx/surprise.svg', bone: 'head', z: 210 }] },
  { ms: 100, face: LOOP_FACE[0], hide: ['fx_surprise'],
    bones: { ...L0, chest: { sy: 0.97, sx: 1.015, r: 1.5 }, head: { y: 2.5, r: -1.5 }, ahoge: { r: 6 } },
    swap: SWAP, show: loop[0].show },
];
const endB = loop[3].bones;
const end = [
  { ms: 150, face: 'flustered',
    bones: { ...endB, hips: { x: 0, y: 0 }, chest: { sy: 1.0, sx: 1.0, r: 0 }, head: { y: 2, r: 1.5, x: 0 }, ahoge: { r: 3 },
      ...arms([194, 280], [206, 280], 8, -8) },
    swap: SWAP, hide: ['fx_sweat'], show: [{ id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 }] },
  { ms: 150, face: 'shy', hide: ['fx_blush', 'fx_sweat'],
    bones: { ...IDLE.bones, head: { y: 1, r: 1.5 }, ahoge: { r: 2 } }, swap: { hand_l: 'hold', hand_r: 'hold' }, tween: 1 },
];

module.exports = { action: 'pat_body', moods: { normal: { start, loop, end } } };
