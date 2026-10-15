// sit — ngồi bệt chính diện, gối co, hai tay đặt trên gối (dáng ngoan). start 3x130, loop 4x140, end 3x130. Mood: normal, tired.
// Mặt ngồi: hips.y = 58 -> gấu váy ~y382, đế bốt y394 (chạm đất); anchor mông ~y392.
const r1 = (v) => Math.round(v * 100) / 100;
const SIT_Z = { thigh_l: 75, shin_l: 74, thigh_r: 75, shin_r: 74 };
const SIT_SWAP = { hair_back: 'sit', thigh_l: 'sit', shin_l: 'sit', thigh_r: 'sit', shin_r: 'sit' };
const HIPS = 58;

// tay đặt trên gối
const ARMS = (k = 1, extra = 0) => ({
  upper_arm_l: { r: r1(9 * k - extra) }, forearm_l: { r: r1(-42 * k) }, hand_l: { r: 6 },
  upper_arm_r: { r: r1(-9 * k + extra) },  forearm_r: { r: r1(42 * k) },  hand_r: { r: -6 },
});
const HSW = { hand_l: 'hold', hand_r: 'hold' };

function mood(c) {
  const N = 4;
  const loop = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    const b = (1 - Math.cos(a)) / 2;            // nhịp thở
    const lag = Math.sin(a - 0.9);
    const nod = c.nod * Math.sin(a - 0.4);
    loop.push({
      ms: c.ms,
      face: i === c.blinkAt ? c.blinkFace : c.face,
      bones: {
        hips: { y: HIPS },
        chest: { sy: r1(1 + 0.03 * (b - 0.5) * 1.8), sx: r1(1 - 0.012 * (b - 0.5)), r: c.chestR },
        head: { r: r1(c.headR + nod), y: r1(c.headY + 0.8 * (b - 0.5) + (c.nodY || 0) * Math.sin(a - 0.4)), x: c.headX },
        hair_back: { sy: c.hairSy, r: r1(-1.4 * lag * c.hair) },
        sidelock_l: { r: r1(2.2 * lag * c.hair) }, sidelock_r: { r: r1(-2.2 * lag * c.hair) },
        ahoge: { r: r1(c.ahoge + 5 * Math.sin(a - 1.3) * c.hair) },
        ribbon: { r: r1(3 * Math.sin(a - 1.6) * c.hair) },
        thigh_l: { y: -7 }, shin_l: { y: 7 }, thigh_r: { y: -7 }, shin_r: { y: 7 },
        ...ARMS(1 + 0.04 * (b - 0.5), c.armExtra),
      },
      swap: { ...SIT_SWAP, ...HSW }, z: SIT_Z,
    });
  }
  const L0 = loop[0];
  const standArms = { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 } };
  const start = [
    { ms: 130, face: 'normal', bones: { hips: { y: 18 }, chest: { sy: 0.99, r: 3 }, head: { y: 1 }, hair_back: { r: 1 }, ahoge: { r: -6 },
        upper_arm_l: { r: -24 }, forearm_l: { r: -30 }, upper_arm_r: { r: 24 }, forearm_r: { r: 30 } }, swap: HSW },
    { ms: 130, face: 'blink', bones: { hips: { y: 42 }, chest: { sy: 0.98, r: 4 }, head: { y: 2 }, hair_back: { sy: 0.97, r: -2 }, ahoge: { r: 8 },
        upper_arm_l: { r: -26 }, forearm_l: { r: -22 }, upper_arm_r: { r: 26 }, forearm_r: { r: 22 } }, swap: { ...SIT_SWAP, ...HSW }, z: SIT_Z },
    { ms: 130, face: c.face, bones: { ...L0.bones, hips: { y: HIPS + 3 }, chest: { sy: 0.97, sx: 1.01, r: c.chestR }, head: { y: c.headY + 2, r: c.headR, x: c.headX },
        hair_back: { sy: 0.93, r: 2 }, ahoge: { r: 6 } }, swap: L0.swap, z: SIT_Z },
  ];
  const end = [
    { ms: 130, face: c.face, bones: { ...loop[3].bones, hips: { y: 44 }, chest: { sy: 0.99, r: 3 }, head: { y: 1, r: 0 }, hair_back: { sy: 0.96, r: -1 } }, swap: loop[3].swap, z: SIT_Z },
    { ms: 130, face: 'normal', bones: { hips: { y: 12 }, chest: { sy: 0.99, r: 2 }, head: { y: 1 }, hair_back: { r: 2 }, ahoge: { r: -5 },
        upper_arm_l: { r: -10 }, forearm_l: { r: -50 }, upper_arm_r: { r: 14 }, forearm_r: { r: 35 } }, swap: HSW },
    // phủi váy: tay phải quét nhẹ, về tư thế đứng gốc của idle
    { ms: 130, face: 'normal', bones: { hips: { y: 0 }, chest: { sy: 1 }, head: { y: 0.3 }, hair_back: { r: 0.5 }, ahoge: { r: 2 }, ...standArms }, swap: { hand_l: 'hold', hand_r: 'hold' } },
  ];
  return { start, loop, end };
}

const base = { ms: 140, face: 'normal', blinkFace: 'blink', blinkAt: 2, nod: 0, nodY: 0, chestR: 0, headR: 0, headY: 0, headX: 0, hair: 1, ahoge: 0, hairSy: 0.93, armExtra: 0 };

module.exports = {
  action: 'sit',
  moods: {
    normal: mood({ ...base }),
    tired: mood({ ...base, ms: 170, face: 'tired', blinkFace: 'sleepy', blinkAt: 2, nod: 3.5, nodY: 2.2, chestR: 3, headR: 4, headY: 5, hair: 0.7, ahoge: 8, hairSy: 0.92, armExtra: 2 }),
  },
};
