// say — loop 4 khung (140,120,130,140). Moods: normal, happy, tired, sad.
// Đứng như idle, miệng talk xen khép, đầu gật nhẹ, tay phải nhấc ngang ngực diễn tả, tay trái thả (hold như idle).
const r1 = (v) => Math.round(v * 100) / 100;
const MS = [140, 120, 130, 140];

function mood(c) {
  const open = [1, 0, 0.6, 0];                 // độ mở miệng -> gật đầu
  const gest = [0, 1, 0.3, -0.6];              // nhịp tay
  const loop = [0, 1, 2, 3].map((i) => {
    const lag = [gest[3], gest[0], gest[1], gest[2]][i];
    const a = (2 * Math.PI * i) / 4;
    const bones = {
      hips: { x: 0, y: 0 },
      chest: { sy: r1(1 + 0.008 * Math.sin(a)), r: r1(c.chestR) },
      head: { r: r1(c.headR - 0.8 * open[i]), y: r1(c.headY + 1.4 * open[i] * c.nod), x: 0 },
      hair_back: { r: r1(-1.4 * lag * c.hair) },
      sidelock_l: { r: r1(2 * lag * c.hair) }, sidelock_r: { r: r1(-2 * lag * c.hair) },
      ahoge: { r: r1(c.ahoge + 4 * lag * c.hair) }, ribbon: { r: r1(-2.5 * lag * c.hair) },
      upper_arm_l: { r: -c.uaL }, forearm_l: { r: -c.faL }, hand_l: { r: 0 },
      upper_arm_r: { r: r1(c.ua + 4 * gest[i] * c.g) },
      forearm_r: { r: r1(c.fa + 12 * gest[i] * c.g) },
      hand_r: { r: r1(-6 + 8 * gest[i] * c.g) },
    };
    return { ms: Math.round(MS[i] * c.slow), face: c.faces[i], bones, swap: { hand_l: 'hold', hand_r: c.hand } };
  });
  return { loop };
}

module.exports = {
  action: 'say',
  moods: {
    normal: mood({ faces: ['talk', 'normal', 'talk', 'normal'], ua: 26, fa: 74, g: 1, nod: 1, headR: 0, headY: 0, chestR: 0, hair: 1, ahoge: 0, uaL: 14, faL: 24, slow: 1, hand: 'open' }),
    happy: mood({ faces: ['laugh', 'happy', 'talk', 'happy'], ua: 30, fa: 80, g: 1.3, nod: 1.3, headR: 1, headY: 0, chestR: 0.5, hair: 1.3, ahoge: -4, uaL: 14, faL: 24, slow: 1, hand: 'open' }),
    tired: mood({ faces: ['tired', 'talk', 'tired', 'tired'], ua: 18, fa: 46, g: 0.5, nod: 1.8, headR: 2, headY: 2, chestR: 1.5, hair: 0.7, ahoge: 6, uaL: 8, faL: 14, slow: 1.25, hand: 'open' }),
    sad: mood({ faces: ['sad', 'talk', 'sad', 'sad'], ua: 12, fa: 40, g: 0.4, nod: 0.6, headR: 4, headY: 3, chestR: 2, hair: 0.7, ahoge: 8, uaL: 5, faL: 10, slow: 1.2, hand: 'hold' }),
  },
};
