// pat_head — start 3x100, loop 4x120, end 3x140. Moods: normal (ngại), happy (nảy hơn, hearts).
const r1 = (v) => Math.round(v * 100) / 100;

// tay chạm ngực / nắm vạt áo trước bụng (đối xứng; l dương, r âm so với idle ua/fa)
const ARMS = (k = 1) => ({
  upper_arm_l: { r: r1(-22 * k) }, forearm_l: { r: r1(-62 * k) }, hand_l: { r: r1(10 * k) },
  upper_arm_r: { r: r1(22 * k) },  forearm_r: { r: r1(62 * k) },  hand_r: { r: r1(-10 * k) },
});
const SWAP = { hand_l: 'fist', hand_r: 'fist' };

function cfgMood(c) {
  // pha loop: nhịp xoa 4 khung, đầu ngả theo hướng xoa, nhún theo nhịp
  const dir = [-1, 0, 1, 0];          // hướng xoa trái-phải
  const dip = [2, 4, 2, 3.5];          // đầu nhún xuống
  const loop = [0, 1, 2, 3].map((i) => {
    const lag = dir[(i + 3) % 4];      // tóc trễ một nhịp
    return {
      ms: 120,
      face: c.loopFace[i],
      bones: {
        hips: { y: r1(c.bounce * (i % 2 ? 1 : 0)) },
        chest: { sy: r1(0.985 + 0.01 * (i % 2)), sx: 1.0, r: r1(dir[i] * 0.8) },
        head: { r: r1(dir[i] * (c.headR) ), y: r1(dip[i] * c.dipK), x: r1(dir[i] * 0.8) },
        hair_back: { r: r1(-2.2 * dir[i] + 1.2 * lag) },
        sidelock_l: { r: r1(3 * lag) }, sidelock_r: { r: r1(-3 * lag) },
        ahoge: { r: r1(c.ahoge + dir[i] * 18) },
        ribbon: { r: r1(-3 * dir[i]) },
        ...ARMS(1 + 0.04 * (i % 2)),
      },
      swap: SWAP,
      show: [i % 2 === 0
        ? { id: 'fx_sparkle', file: 'fx/sparkle.svg', bone: 'head', z: 210, x: 0, y: 0, opacity: 1 }
        : { id: 'fx_sparkle2', file: 'fx/sparkle2.svg', bone: 'head', z: 210, x: 0, y: 0, opacity: 1 }]
        .concat(c.hearts && i % 2 === 1 ? [{ id: 'fx_hearts', file: 'fx/hearts.svg', bone: 'head', z: 211, x: 0, y: 0 }] : [])
        .concat(c.blush ? [{ id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 }] : []),
    };
  });
  const L0 = loop[0].bones;
  const start = [
    { ms: 100, face: 'surprised',
      bones: { chest: { sy: 0.97, sx: 1.01 }, head: { y: -1, r: 0 }, ahoge: { r: -10 }, hair_back: { r: 2 },
        upper_arm_l: { r: -10 }, forearm_l: { r: -30 }, upper_arm_r: { r: 10 }, forearm_r: { r: 30 } },
      swap: SWAP, show: [{ id: 'fx_surprise', file: 'fx/surprise.svg', bone: 'head', z: 210 }] },
    { ms: 100, face: 'blink',
      bones: { chest: { sy: 0.97, sx: 1.01 }, head: { y: 1, r: 1 }, ahoge: { r: 6 }, hair_back: { r: -1 },
        upper_arm_l: { r: -16 }, forearm_l: { r: -46 }, upper_arm_r: { r: 16 }, forearm_r: { r: 46 } },
      swap: SWAP, hide: ['fx_surprise'] },
    { ms: 100, face: c.loopFace[0],
      bones: { ...L0, chest: { sy: 0.985, sx: 1.0, r: 0 }, head: { y: 2, r: -1.5, x: 0 } }, swap: SWAP, show: loop[0].show },
  ];
  const endB = loop[3].bones;
  const end = [
    { ms: 140, face: c.loopFace[3], bones: { ...endB, head: { y: 2, r: 0 }, ahoge: { r: 4 } }, swap: SWAP, hide: ['fx_sparkle', 'fx_sparkle2', 'fx_hearts', 'fx_blush'] },
    { ms: 140, face: 'shy',
      bones: { chest: { sy: 1.0 }, head: { y: -1, r: 1 }, ahoge: { r: 2 },
        upper_arm_l: { r: -10 }, forearm_l: { r: -36 }, upper_arm_r: { r: 10 }, forearm_r: { r: 36 } }, swap: SWAP,
      show: c.blush ? [{ id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 }] : [] },
    { ms: 140, face: 'normal', hide: ['fx_blush'],
      bones: { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 } }, swap: { hand_l: 'hold', hand_r: 'hold' } },
  ];
  return { start, loop, end };
}

module.exports = {
  action: 'pat_head',
  moods: {
    normal: cfgMood({ loopFace: ['closed_happy', 'closed_happy', 'closed_happy', 'closed_happy'], bounce: 0, headR: 5.5, dipK: 1, ahoge: 0, blush: true, hearts: false }),
    happy: cfgMood({ loopFace: ['closed_happy', 'laugh', 'closed_happy', 'laugh'], bounce: -1.5, headR: 5.5, dipK: 1.3, ahoge: -4, blush: false, hearts: true }),
  },
};
