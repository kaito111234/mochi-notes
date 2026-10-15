// sleep — ngồi bệt ôm mèo bông ngủ. start 4x250, loop 4 (800,800,800,600), end 3x260. Mood: normal.
const r1 = (v) => Math.round(v * 100) / 100;
const PLUSH = (x, y, op) => ({ id: 'plush', file: 'props/cat_plush.svg', bone: 'none', z: 105, x, y, opacity: op === undefined ? 1 : op });
const Z = (id, x, y) => ({ id, file: 'fx/' + id + '.svg', bone: 'head', z: 215, x, y });

// chân ngồi "vịt": đùi xoay ra ngoài + rút ngắn, ống gập để giày ló ra hai bên đáy
const legs = (k) => ({
  thigh_l: { r: r1(50 * k), sy: r1(1 - 0.5 * k) }, shin_l: { r: r1(-5 * k), sy: r1(1 + 0.4 * k) },
  thigh_r: { r: r1(-50 * k), sy: r1(1 - 0.5 * k) }, shin_r: { r: r1(5 * k), sy: r1(1 + 0.4 * k) },
});
// hai tay ôm vòng qua mèo (cẳng tay + bàn tay nằm trên mèo)
const hug = (k = 1) => ({
  upper_arm_l: { r: r1(-20 * k) }, forearm_l: { r: r1(-18 * k) }, hand_l: { r: r1(8 * k) },
  upper_arm_r: { r: r1(20 * k) },  forearm_r: { r: r1(18 * k) },  hand_r: { r: r1(-8 * k) },
});
const HUGZ = {};
const SIT = 44;

function sitBones(o = {}) {
  return {
    hips: { y: SIT + (o.hipsDy || 0) },
    chest: { sy: o.sy || 1, sx: o.sx || 1, r: o.chestR || 0 },
    head: { r: o.headR === undefined ? 5 : o.headR, y: o.headY === undefined ? 8 : o.headY, x: o.headX === undefined ? 0 : o.headX },
    hair_back: { r: o.hb || 0 }, sidelock_l: { r: o.sl || 0 }, sidelock_r: { r: -(o.sl || 0) },
    ahoge: { r: o.ah === undefined ? 10 : o.ah }, ribbon: { r: o.rb || 0 },
    ...legs(1), ...hug(1),
  };
}

const standArms = { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 } };

// ---- loop: thở chậm, zzz / bong bóng xen kẽ
const BR = [1.0, 1.02, 1.02, 1.01];
const MSL = [800, 800, 800, 600];
const FX = [
  [Z('zzz', 0, 0), { id: 'bubble', file: 'fx/bubble.svg', bone: 'head', z: 215, x: 0, y: 0 }],
  [Z('zzz2', 0, 0), { id: 'bubble_big', file: 'fx/bubble_big.svg', bone: 'head', z: 215, x: 1, y: -1 }],
  [Z('zzz', 0, -2), { id: 'bubble_big', file: 'fx/bubble_big.svg', bone: 'head', z: 215, x: 2, y: -2 }],
  [Z('zzz2', 0, -3), { id: 'bubble', file: 'fx/bubble.svg', bone: 'head', z: 215, x: 0, y: 0 }],
];
const loop = [0, 1, 2, 3].map((i) => {
  const b = BR[i];
  const lag = [0, 1, 1.4, 0.6][i];
  return {
    ms: MSL[i], face: 'sleep', z: HUGZ,
    bones: sitBones({ sy: b, sx: r1(1 - (b - 1) * 0.5), headY: 8 + (b - 1) * -60 * 0.5 + 0, hb: r1(1.2 * lag), sl: r1(-1.6 * lag), ah: r1(10 + 2 * lag), rb: r1(1.5 * lag) }),
    swap: { hand_l: 'hold', hand_r: 'hold' },
    show: [PLUSH(0, r1(30 - (b - 1) * 40))].concat(FX[i]),
  };
});
const L0 = loop[0];

// ---- start: ngáp -> buồn ngủ -> ngồi xuống -> ôm mèo gục
const start = [
  { ms: 250, face: 'yawn',
    bones: { head: { r: -3, y: -2 }, chest: { sy: 1.02 }, ahoge: { r: 6 }, hair_back: { r: 1 },
      upper_arm_l: { r: -22 }, forearm_l: { r: -70 }, upper_arm_r: { r: 22 }, forearm_r: { r: 70 } },
    swap: { hand_l: 'open', hand_r: 'open' } },
  { ms: 250, face: 'sleepy',
    bones: { hips: { y: 20 }, chest: { sy: 0.98, r: 1 }, head: { r: 4, y: 4 }, ahoge: { r: 8 }, hair_back: { r: -1.5 }, sidelock_l: { r: 2 }, sidelock_r: { r: -2 },
      ...legs(0.5), upper_arm_l: { r: -8 }, forearm_l: { r: -26 }, upper_arm_r: { r: 8 }, forearm_r: { r: 26 } },
    swap: { hand_l: 'hold', hand_r: 'hold' }, show: [PLUSH(0, 24, 0.0)] },
  { ms: 250, face: 'sleepy', z: HUGZ,
    bones: { ...sitBones({ headR: 3, headY: 4, hb: -2, sl: 2.5, ah: 8, hipsDy: 0 }) },
    swap: { hand_l: 'hold', hand_r: 'hold' }, show: [PLUSH(0, 30)] },
  { ms: 250, face: 'sleep', z: HUGZ, bones: L0.bones, swap: L0.swap, show: [PLUSH(0, 30)] },
];

// ---- end: giật mình -> mơ màng -> đứng dậy, mèo biến mất ở khung cuối
const end = [
  { ms: 260, face: 'surprised', z: HUGZ,
    bones: sitBones({ headR: -2, headY: 0, sy: 1.02, hb: 2, sl: -3, ah: -10 }),
    swap: { hand_l: 'hold', hand_r: 'hold' },
    show: [PLUSH(0, 30), { id: 'fx_surprise', file: 'fx/surprise.svg', bone: 'head', z: 215 }] },
  { ms: 260, face: 'sleepy', z: HUGZ,
    bones: { hips: { y: 18 }, chest: { sy: 0.99 }, head: { r: 3, y: 3 }, ahoge: { r: 8 }, hair_back: { r: -1 }, sidelock_l: { r: 1.5 }, sidelock_r: { r: -1.5 },
      ...legs(0.45), upper_arm_l: { r: -10 }, forearm_l: { r: -36 }, upper_arm_r: { r: 10 }, forearm_r: { r: 36 } },
    swap: { hand_l: 'hold', hand_r: 'hold' }, show: [PLUSH(0, 16, 0.6)] },
  { ms: 260, face: 'normal', hide: ['plush'],
    bones: { hips: { y: 0 }, chest: { sy: 1 }, head: { r: 0, y: 0 },
      ...standArms },
    swap: { hand_l: 'hold', hand_r: 'hold' }, z: { forearm_l: 100, forearm_r: 101, hand_l: 110, hand_r: 111 } },
];

module.exports = { action: 'sleep', moods: { normal: { start, loop, end } } };
