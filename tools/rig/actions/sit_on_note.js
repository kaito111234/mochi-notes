// sit_on_note — ngồi trên mép trên cửa sổ note, hai chân thả đung đưa. start 4x110, loop 6x120, end 3x120. Mood: normal, happy.
// Mặt ngồi seatY = 338 (gấu váy hips.y=16 -> y~340, mép trên note đặt ở y~338); bốt chạm y~392 khi chân thả thẳng.
const r1 = (v) => Math.round(v * 100) / 100;
const HIPS = 16, TS = 0.6;           // thigh sy: đùi co ngắn (phối cảnh), shin bù 1/TS
const SW = { hair_back: 'sit' };

const legs = (ts, lA, lB, kA = 0, kB = 0) => ({
  thigh_l: { sy: ts, r: r1(lA) }, shin_l: { sy: r1(1 / ts), r: r1(kA) },
  thigh_r: { sy: ts, r: r1(-lB) }, shin_r: { sy: r1(1 / ts), r: r1(-kB) },
});

// đung đưa luân phiên trước/sau: chân ra trước = cẳng co ngắn + bốt to; chân về sau = dài; xoay ngang chỉ +-4 độ
function swing(pl, pr, k) {
  const one = (p, sgn) => ({ sy: r1((1 - 0.125 * (1 + p * k)) / TS), sx: r1(1.1 + 0.05 * p * k), r: r1(sgn * 4 * p * k) });
  return { thigh_l: { sy: TS }, thigh_r: { sy: TS }, shin_l: one(pl, 1), shin_r: one(pr, -1) };
}

function mood(c) {
  const N = 6, loop = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    const pl = Math.sin(a), pr = Math.sin(a + Math.PI);     // hai chân lệch pha
    const lag = Math.sin(a - 1.0);
    const b = (1 - Math.cos(a)) / 2;
    loop.push({
      ms: 120,
      face: i === 3 ? c.blinkFace : (c.faceAlt && c.faceAlt[i]) || c.face,
      bones: {
        hips: { y: HIPS + r1(c.bob * Math.sin(2 * a)), x: r1(c.sway * Math.sin(a)) },
        chest: { sy: r1(1 + 0.012 * (b - 0.5)), r: r1(c.sway * 0.9 * Math.sin(a)) },
        head: { r: r1(c.headR - c.sway * 0.9 * Math.sin(a) + 1.2 * Math.sin(a - 0.5)), y: r1(0.6 * (b - 0.5)) },
        hair_back: { r: r1(-1.6 * lag * c.hair) },
        sidelock_l: { r: r1(2.4 * lag * c.hair) }, sidelock_r: { r: r1(-2.4 * lag * c.hair) },
        ahoge: { r: r1(c.ahoge + 6 * Math.sin(a - 1.3) * c.hair) },
        ribbon: { r: r1(3 * Math.sin(a - 1.6) * c.hair) },
        // đùi nhích nhẹ, cẳng chân đung đưa mạnh hơn (gối là khớp)
        ...swing(pl, pr, c.leg),
        // hai tay bám mép note
        upper_arm_l: { r: 7 }, forearm_l: { r: -3 }, hand_l: { r: 0 },
        upper_arm_r: { r: -7 }, forearm_r: { r: 3 }, hand_r: { r: 0 },
      },
      swap: { ...SW, hand_l: 'hold', hand_r: 'hold' },
    });
  }
  const P = loop[0];
  const idleArms = { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 } };
  const hs = { hand_l: 'hold', hand_r: 'hold' };
  const start = [
    { ms: 110, face: 'normal', bones: { hips: { y: -2 }, chest: { sy: 1, r: -2 }, head: { y: -1 }, ahoge: { r: 6 }, hair_back: { r: -1 }, ...idleArms }, swap: hs },
    { ms: 110, face: 'blink', bones: { hips: { y: 8 }, chest: { sy: 0.99, r: 2 }, head: { y: 1 }, ahoge: { r: -6 }, hair_back: { r: 2 }, ...legs(0.85, 0, 0, -6, 6),
        upper_arm_l: { r: -4 }, forearm_l: { r: -10 }, upper_arm_r: { r: 4 }, forearm_r: { r: 10 } }, swap: { ...SW, ...hs } },
    { ms: 110, face: 'o', bones: { hips: { y: HIPS + 3 }, chest: { sy: 0.975, sx: 1.01 }, head: { y: 2 }, ahoge: { r: 8 }, hair_back: { r: 2 }, ...legs(0.7, 0, 0, 0, 0),
        upper_arm_l: { r: 6 }, forearm_l: { r: -3 }, upper_arm_r: { r: -6 }, forearm_r: { r: 3 } }, swap: { ...SW, ...hs } },
    { ms: 110, face: c.face, bones: { ...P.bones, hips: { y: HIPS }, chest: { sy: 0.99 }, head: { y: 1, r: c.headR }, ...legs(TS, 0, 0, 0, 0), ahoge: { r: 4 } }, swap: P.swap },
  ];
  const L = loop[N - 1];
  const end = [
    { ms: 120, face: c.face, bones: { ...L.bones, ...legs(TS, 0, 0, 0, 0), hips: { y: HIPS - 2 }, chest: { sy: 1.0 } }, swap: L.swap },
    { ms: 120, face: 'normal', bones: { hips: { y: 8 }, chest: { sy: 1, r: 1 }, head: { y: 0.5 }, hair_back: { r: 2 }, ahoge: { r: -4 }, ...legs(0.85, 0, 0, 0, 0),
        upper_arm_l: { r: -8 }, forearm_l: { r: -14 }, upper_arm_r: { r: 8 }, forearm_r: { r: 14 } }, swap: { ...SW, ...hs } },
    { ms: 120, face: 'normal', bones: { hips: { y: 0 }, chest: { sy: 1 }, head: { y: 0.3 }, hair_back: { r: 0.5 }, ahoge: { r: 2 }, ...idleArms }, swap: hs },
  ];
  return { start, loop, end };
}

const base = { face: 'normal', blinkFace: 'blink', bob: 0, sway: 0, headR: 0, hair: 1, ahoge: 0, leg: 1 };
module.exports = {
  action: 'sit_on_note',
  moods: {
    normal: mood({ ...base, leg: 0.9 }),
    happy: mood({ ...base, face: 'happy', blinkFace: 'closed_happy', faceAlt: { 1: 'closed_happy' }, sway: 1.4, bob: 0.6, leg: 1.35, hair: 1.3, ahoge: -4, headR: 1 }),
  },
};
