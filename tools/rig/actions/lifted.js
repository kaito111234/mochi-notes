// lifted: bị xách ở sau cổ/đỉnh đầu, lắc như con lắc. Loop 4 khung x 200ms.
const N = 4, A = 7;
const ph = (k, lag = 0) => (2 * Math.PI * (k - lag)) / N;
const r1 = (v) => Math.round(v * 10) / 10;
const frames = [];
for (let k = 0; k < N; k++) {
  const s = Math.sin(ph(k));          // lắc thân: 0, 1, 0, -1
  const sl = Math.sin(ph(k, 1));      // trễ một nhịp
  const c = Math.cos(ph(k));
  const kick = Math.sin(ph(k, 0.5));
  frames.push({
    ms: 200,
    face: k === 1 || k === 3 ? 'surprised' : 'o',
    global: { px: 200, py: 96, r: r1(A * s), y: r1(-8 - 2 * Math.abs(s)) },
    bones: {
      hips: { sy: r1(1.02 - 0.02 * Math.abs(s)), sx: r1(0.99 + 0.02 * Math.abs(s)) },
      chest: { r: r1(-2 * s), sy: 1.06 },
      head: { r: r1(-3 * s) },
      hair_back: { r: r1(-6 * sl), sy: 1.02 },
      sidelock_l: { r: r1(-7 * sl + 3) },
      sidelock_r: { r: r1(-7 * sl - 3) },
      ahoge: { r: r1(-12 * sl) },
      ribbon: { r: r1(-6 * sl) },
      upper_arm_l: { r: r1(28 + 6 * sl) },
      upper_arm_r: { r: r1(-28 - 6 * sl) },
      forearm_l: { r: r1(8 - 5 * sl) },
      forearm_r: { r: r1(-8 - 5 * sl) },
      thigh_l: { r: r1(-3 + 12 * kick) },
      thigh_r: { r: r1(3 - 12 * kick) },
      shin_l: { r: r1(4 + 9 * Math.sin(ph(k, 1.5))) },
      shin_r: { r: r1(-4 - 9 * Math.sin(ph(k, 1.5))) },
    },
    swap: { hand_l: 'open', hand_r: 'open', hair_back: 'up', sidelock_l: 'up', sidelock_r: 'up' },
    ...(k === 2 ? { show: [{ id: 'lifted-sweat', file: 'fx/sweat.svg', bone: 'head', z: 210 }] } : {}),
  });
}
module.exports = { action: 'lifted', moods: { normal: { loop: frames } } };
