// angry — start 3×100, loop 4×300, end 3×130. Mood normal. Dỗi bướng dễ thương: phồng má, tay nắm chống hông,
// dậm chân nhẹ, dấu gân đỏ (emo_anger), khói phì nhỏ. Không hung dữ. End về tư thế idle.
const r1 = (v) => Math.round(v * 100) / 100;

// tay chống hông: ua ngoài (l dương, r âm), fa gập vào
const AK = (k = 1) => ({
  upper_arm_l: { r: r1(32 * k) }, forearm_l: { r: r1(-86 * k) }, hand_l: { r: r1(-10 * k) },
  upper_arm_r: { r: r1(-32 * k) }, forearm_r: { r: r1(86 * k) }, hand_r: { r: r1(10 * k) },
});
const SW = { hand_l: 'fist', hand_r: 'fist' };
const vein = (big) => ({ id: 'fx_anger', file: big ? 'fx/emo_anger2.svg' : 'fx/emo_anger.svg', bone: 'head', z: 216 });
const puff = (big) => ({ id: 'fx_puff', file: big ? 'fx/emo_puff2.svg' : 'fx/emo_puff.svg', bone: 'head', z: 215 });

// loop: dậm chân phải (khung 1) – chân trái (khung 3), lắc đầu "hừ"
const FACE = ['angry', 'protest', 'angry', 'protest'];
const HR = [-4.5, 1.5, 4.5, -1.5];             // lắc đầu
const FOOT = [{ r: 0, l: 0 }, { r: 0, l: 0 }, { r: 0, l: 0 }, { r: 0, l: 0 }];
const loop = [0, 1, 2, 3].map((i) => {
  const lag = HR[(i + 3) % 4] / 4.5;
  const up = i === 0 ? 'r' : i === 2 ? 'l' : null;   // chân nhấc
  const bones = {
    chest: { sy: r1(0.992 + (i % 2) * 0.012), sx: 1, r: r1(-HR[i] * 0.25) },
    head: { r: r1(HR[i]), y: r1(i % 2 ? 0 : 2.5), x: r1(HR[i] * 0.25), sx: 1.025, sy: 0.985 },
    hair_back: { r: r1(-2.5 * lag) }, sidelock_l: { r: r1(3.5 * lag) }, sidelock_r: { r: r1(-3.5 * lag) },
    ahoge: { r: r1(-12 * lag - 4) }, ribbon: { r: r1(4 * lag) },
    ...AK(1 + 0.04 * (i % 2)),
  };
  if (up) { bones['thigh_' + up] = { r: up === 'r' ? 5 : -5 }; bones['shin_' + up] = { r: up === 'r' ? -9 : 9, y: -4 }; }
  return {
    ms: 300, face: FACE[i], bones, swap: SW,
    show: i % 2 ? [vein(i === 3), puff(i === 3)] : [],
    hide: i % 2 ? [] : ['fx_anger', 'fx_puff'],
  };
});

const L0 = loop[0];
const start = [
  { ms: 100, face: 'surprised',
    bones: { chest: { sy: 0.99, r: -2 }, head: { r: -7, y: 1 }, ahoge: { r: -14 }, hair_back: { r: 3 },
      upper_arm_l: { r: 8 }, forearm_l: { r: -30 }, upper_arm_r: { r: -8 }, forearm_r: { r: 30 } },
    swap: { hand_l: 'fist', hand_r: 'fist' } },
  { ms: 100, face: 'protest',
    bones: { chest: { sy: 0.992, r: 1 }, head: { r: 5, y: 2, sx: 1.015, sy: 0.99 }, ahoge: { r: -8 }, hair_back: { r: -3 },
      sidelock_l: { r: 4 }, sidelock_r: { r: -4 }, ...AK(0.6) }, swap: SW, show: [vein(0)] },
  { ms: 100, face: 'angry', bones: { ...L0.bones, head: { ...L0.bones.head, r: -3 } }, swap: SW, hide: ['fx_anger'] },
];
const end = [
  { ms: 130, face: 'protest', bones: { ...loop[3].bones, head: { r: -3, y: 2, sx: 1.025, sy: 0.985 } }, swap: SW, show: [puff(1)] },
  // thở dài, buông tay, quay đi
  { ms: 130, face: 'blink',
    bones: { chest: { sy: 1.008, r: -1 }, head: { r: 4, y: 1, x: 2 }, ahoge: { r: 6 }, hair_back: { r: -2 },
      sidelock_l: { r: 2 }, sidelock_r: { r: -2 }, ...AK(0.45) },
    swap: SW, hide: ['fx_anger', 'fx_puff'] },
  { ms: 130, face: 'normal',
    bones: { chest: { sy: 1 }, head: { r: 0, y: 0, x: 0, sx: 1, sy: 1 }, ahoge: { r: 0 }, hair_back: { r: 0 }, sidelock_l: { r: 0 }, sidelock_r: { r: 0 },
      upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 }, hand_l: { r: 0 }, hand_r: { r: 0 } },
    swap: { hand_l: 'hold', hand_r: 'hold' } },
];
module.exports = { action: 'angry', moods: { normal: { start, loop, end } } };
