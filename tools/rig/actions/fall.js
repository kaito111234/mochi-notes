// fall: rơi thẳng, tay giơ cao, tóc bay ngược lên. Loop 3 khung x 70ms.
const w = [0, 1, -1];      // biến thiên gió nhỏ giữa 3 khung
const frames = w.map((s, k) => ({
  ms: 70,
  face: k === 1 ? 'scared' : 'wince',
  global: { y: [0, -2, 2][k] },
  bones: {
    hips: { sy: [1.03, 1.01, 1.04][k], sx: [0.98, 0.99, 0.97][k] },
    chest: { sy: 1.02 },
    head: { r: 2 * s, y: -2 },
    hair_back: { r: 3 * s, sy: [0.8, 0.72, 0.86][k], y: [-10, -14, -8][k] },
    sidelock_l: { r: -32 + 8 * s, y: -18 },
    sidelock_r: { r: 32 - 8 * s, y: -18 },
    ahoge: { r: 10 * s, sy: 0.95 },
    ribbon: { r: [-18, -26, -12][k], y: -10 },
    upper_arm_l: { r: 120 - 8 * s },
    upper_arm_r: { r: -120 + 8 * s },
    forearm_l: { r: 30 + 8 * s },
    forearm_r: { r: -30 + 8 * s },
    thigh_l: { r: -3 + 2 * s },
    thigh_r: { r: 3 - 2 * s },
    shin_l: { r: -2 * s },
    shin_r: { r: 2 * s },
  },
  swap: { hand_l: 'open', hand_r: 'open' },
  show: [{ id: 'fall-speed', file: 'fx/speed_lines.svg', bone: 'none', y: [0, 6, -6][k], z: 5 }],
}));
module.exports = { action: 'fall', moods: { normal: { loop: frames } } };
