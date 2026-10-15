// shy — start 3×100, loop 4×400, end 3×130. Mood normal.
// Ngại: tay phải che má, tay trái đỡ trước ngực, lắc lư, liếc trộm, cọ chân. Tay đặt bằng IK.
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
const REF = { r: [232, 278], l: [172, 278] };
function ik(side, T, out) {
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
    }).sort((p, q) => len(p.E, REF[side]) - len(q.E, REF[side]))[0];   // khuỷu gần vị trí tham chiếu     // khuỷu thấp hơn
    best = c; u = [Math.cos(c.t2 * RAD), Math.sin(c.t2 * RAD)];
  }
  const upper = best.t1 - f1, fore = best.t2 - f2 - upper;
  const wrap = (x) => ((x + 540) % 360) - 180;
  return { upper: r2(wrap(upper)), fore: r2(wrap(fore)) };
}
function arms(Tl, Tr, hl = 0, hr = 0, outR = false) {
  const l = ik('l', Tl), r = ik('r', Tr, outR);
  return { upper_arm_l: { r: l.upper }, forearm_l: { r: l.fore }, hand_l: { r: hl },
    upper_arm_r: { r: r.upper }, forearm_r: { r: r.fore }, hand_r: { r: hr } };
}

const SWAP = { hand_l: 'fist', hand_r: 'fist' };
const Z_UP = { forearm_r: 164, hand_r: 165 };
const CHEEK = [236, 214], CHEST_L = [204, 262];
const STEAM = (i) => ({ id: 'fx_steam', file: i % 2 ? 'fx/shy_steam2.svg' : 'fx/shy_steam.svg', bone: 'head', z: 210 });
const BLUSH = { id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 158 };

// loop 4×400: lắc lư chậm, liếc trộm (đầu lệch), cọ chân
const S = [1, 0.2, -1, -0.2];
const FACES = ['shy', 'shy', 'flustered', 'shy'];
const loop = [0, 1, 2, 3].map((i) => {
  const s = S[i], lag = S[(i + 3) % 4];
  const rub = i === 1 || i === 3 ? 1 : 0;
  const bones = {
    hips: { x: r2(1.2 * s) },
    chest: { sy: r2(0.985 + 0.008 * (i % 2)), sx: 1.006, r: r2(1.6 * s) },
    head: { r: r2(5 + 2.5 * s), x: r2(-2.5 + 1.5 * s), y: r2(3 + 0.6 * (i % 2)) },
    hair_back: { r: r2(-1.8 * lag) }, sidelock_l: { r: r2(2.6 * lag) }, sidelock_r: { r: r2(-2.6 * lag) },
    ahoge: { r: r2(-8 * lag + 3) }, ribbon: { r: r2(4 * lag) },
    thigh_r: { r: r2(2.2 * rub) }, shin_r: { r: r2(-1.4 * rub) },
    thigh_l: { r: r2(-1.0 * rub) },
    ...arms([CHEST_L[0] + 1.5 * s, CHEST_L[1] + 0.8 * (i % 2)], [CHEEK[0] + 1.5 * s, CHEEK[1] + 1.2 * (i % 2)], 14, 20, true),
  };
  return { ms: 400, face: FACES[i], bones, swap: SWAP, z: Z_UP, show: [BLUSH, STEAM(i)],
  };
});
const L0 = loop[0].bones;
const start = [
  { ms: 100, face: 'surprised',
    bones: { chest: { sy: 0.985, sx: 1.005, r: -1.5 }, head: { r: -3, x: 2, y: 1 }, ahoge: { r: -8 }, hair_back: { r: 2 },
      ...arms([186, 276], [214, 276], 6, -6) }, swap: SWAP },
  { ms: 100, face: 'flustered',
    bones: { chest: { sy: 0.985, sx: 1.005, r: 0.5 }, head: { r: 2, x: -1, y: 2 }, ahoge: { r: 5 }, hair_back: { r: -1 },
      ...arms([196, 268], [224, 240], 10, 10, true) }, swap: SWAP, z: Z_UP, show: [BLUSH] },
  { ms: 100, face: FACES[0], bones: { ...L0, hips: { x: 0 }, thigh_r: { r: 0 }, shin_r: { r: 0 }, thigh_l: { r: 0 } },
    swap: SWAP, z: Z_UP, show: [BLUSH, STEAM(0)] },
];
const endB = loop[3].bones;
const end = [
  { ms: 130, face: 'shy', bones: { ...endB, thigh_r: { r: 0 }, shin_r: { r: 0 }, thigh_l: { r: 0 }, head: { r: 3, x: -1, y: 2.5 },
      ...arms([200, 268], [222, 246], 12, 14, true) }, swap: SWAP, z: Z_UP, hide: ['fx_steam'], show: [BLUSH] },
  { ms: 130, face: 'flustered',
    bones: { hips: { x: 0 }, chest: { sy: 1, sx: 1, r: 0 }, head: { r: 1, x: 0, y: 1.5 }, ahoge: { r: 2 },
      upper_arm_l: { r: -20 }, forearm_l: { r: -40 }, hand_l: { r: 6 }, upper_arm_r: { r: 18 }, forearm_r: { r: 36 }, hand_r: { r: -6 },
      thigh_r: { r: 0 }, shin_r: { r: 0 }, thigh_l: { r: 0 } },
    swap: { hand_l: 'hold', hand_r: 'hold' }, z: { forearm_r: 101, hand_r: 111 }, show: [BLUSH] },
  { ms: 130, face: 'normal', hide: ['fx_blush'], bones: { ...IDLE.bones }, swap: { hand_l: 'hold', hand_r: 'hold' }, z: { forearm_r: 101, hand_r: 111 } },
];
module.exports = { action: 'shy', moods: { normal: { start, loop, end } } };
