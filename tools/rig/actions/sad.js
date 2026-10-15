// sad — start 3×130, loop 4×400, end 3×130. Mood normal. Buồn dễ thương: cúi đầu, vai chùng, tay ôm vạt áo,
// một giọt lệ lấp lánh, mây buồn nhỏ. Kết thúc về tư thế idle normal (ua 14, fa 24, hand hold).
const r1 = (v) => Math.round(v * 100) / 100;
const HIDE = ['fx_gloom', 'fx_hatch', 'fx_tear'];

// tay ôm vạt áo trước bụng (nắm), k = mức khép
const ARMS = (k = 1) => ({
  upper_arm_l: { r: r1(-20 * k) }, forearm_l: { r: r1(-60 * k) }, hand_l: { r: r1(8 * k) },
  upper_arm_r: { r: r1(20 * k) },  forearm_r: { r: r1(60 * k) },  hand_r: { r: r1(-8 * k) },
});
const SW = { hand_l: 'fist', hand_r: 'fist' };
const fxGloom = (v) => ({ id: 'fx_gloom', file: v ? 'fx/emo_gloom2.svg' : 'fx/emo_gloom.svg', bone: 'head', z: 215 });
const fxTear = (v) => ({ id: 'fx_tear', file: v ? 'fx/emo_tear2.svg' : 'fx/emo_tear.svg', bone: 'head', z: 216 });
const fxHatch = { id: 'fx_hatch', file: 'fx/emo_hatch.svg', bone: 'head', z: 214 };

// loop 4 khung: thở dài. [hít, nhún xuống, thở ra, hồi]
const BR = [0, 1, 0.6, 0.2];     // mức nhún (0..1)
const LAG = [0.2, -0.1, -0.6, -0.3];
const LOOPFACE = ['sad', 'sad', 'blink', 'sad'];
const loop = [0, 1, 2, 3].map((i) => {
  const b = BR[i], lag = LAG[i];
  return {
    ms: 400, face: LOOPFACE[i],
    bones: {
      hips: { y: 0 },
      chest: { sy: r1(0.985 - 0.012 * b), sx: r1(1.004 + 0.004 * b), r: r1(2.2 + 0.6 * b) },
      head: { r: r1(5 + 1.5 * b), y: r1(5.5 + 1.6 * b), x: r1(-0.5) },
      hair_back: { r: r1(-3 * lag + 1.5) }, sidelock_l: { r: r1(4 * lag + 2) }, sidelock_r: { r: r1(-4 * lag - 2) },
      ahoge: { r: r1(10 + 6 * lag) }, ribbon: { r: r1(-3 * lag) },
      ...ARMS(1 + 0.06 * b),
    },
    swap: SW,
    show: [fxGloom(i % 2), ...(i < 2 ? [fxTear(i === 1)] : []), ...(i === 1 || i === 2 ? [fxHatch] : [])],
    hide: [...(i >= 2 ? ['fx_tear'] : []), ...(i === 0 || i === 3 ? ['fx_hatch'] : [])],
  };
});
const L0 = loop[0];

const start = [
  { ms: 130, face: 'sad',
    bones: { chest: { sy: 0.992, r: 0.8 }, head: { r: 1.5, y: 2 }, ahoge: { r: 4 }, hair_back: { r: 1 },
      upper_arm_l: { r: -16 }, forearm_l: { r: -36 }, upper_arm_r: { r: 16 }, forearm_r: { r: 36 } },
    swap: { hand_l: 'hold', hand_r: 'hold' }, show: [] },
  { ms: 130, face: 'sad',
    bones: { chest: { sy: 0.988, r: 1.6 }, head: { r: 3.5, y: 4 }, ahoge: { r: 8 }, hair_back: { r: 2 },
      sidelock_l: { r: 3 }, sidelock_r: { r: -3 },
      ...ARMS(0.8) },
    swap: SW, show: [fxGloom(0)] },
  { ms: 130, face: L0.face, bones: { ...L0.bones, head: { r: 4.5, y: 5, x: -0.4 } }, swap: SW,
    show: [fxGloom(1), fxTear(0)] },
];

const end = [
  // ngẩng lên, lắc đầu
  { ms: 130, face: 'blink', bones: { ...loop[3].bones, head: { r: -3, y: 1 }, chest: { sy: 0.995, r: 0.6 }, ahoge: { r: -3 },
      hair_back: { r: 2 }, sidelock_l: { r: -3 }, sidelock_r: { r: 3 } }, swap: SW,
    hide: HIDE },
  { ms: 130, face: 'sad',
    bones: { chest: { sy: 1.012, sx: 0.996, r: 0 }, head: { r: 3, y: -1 }, ahoge: { r: 4 }, hair_back: { r: -2 },
      sidelock_l: { r: 2 }, sidelock_r: { r: -2 }, hips: { y: 0 },
      upper_arm_l: { r: -16 }, forearm_l: { r: -38 }, upper_arm_r: { r: 16 }, forearm_r: { r: 38 }, hand_l: { r: 4 }, hand_r: { r: -4 } },
    swap: { hand_l: 'hold', hand_r: 'hold' }, },
  { ms: 130, face: 'normal',
    bones: { chest: { sy: 1 }, head: { r: 0, y: 0 }, ahoge: { r: 0 }, hair_back: { r: 0 }, sidelock_l: { r: 0 }, sidelock_r: { r: 0 },
      upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 }, hand_l: { r: 0 }, hand_r: { r: 0 } },
    swap: { hand_l: 'hold', hand_r: 'hold' } },
];

module.exports = { action: 'sad', moods: { normal: { start, loop, end } } };
