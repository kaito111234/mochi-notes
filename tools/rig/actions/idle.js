// idle — loop 6 khung (160,160,180,80 chớp,160,160). 4 mood: normal, happy, tired, sad.
const MS = [160, 160, 180, 80, 160, 160];
const N = 6;
const r1 = (v) => Math.round(v * 100) / 100;

function mood(cfg) {
  const frames = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    const b = (1 - Math.cos(a)) / 2;            // nhịp thở 0..1 (đỉnh ở khung 4)
    const lag = Math.sin(a - 0.9);               // tóc trễ một nhịp
    const sway = cfg.sway * Math.sin(a);         // đung đưa người (happy)
    const nod = cfg.nod ? cfg.nod * Math.sin(a - 0.5) : 0;
    const blink = i === 3;
    const bones = {
      hips: { x: r1(sway), y: r1(cfg.hipsY || 0) },
      chest: { sy: r1(1 + cfg.breath * (b - 0.5) * 0.9), sx: r1(1 - cfg.breath * (b - 0.5) * 0.3), r: r1(cfg.chestR + sway * 0.8) },
      head: { r: r1(cfg.headR + nod - sway * 0.8), y: r1((cfg.headY || 0) + cfg.breath * 40 * (b - 0.5) * 0.0 + 0.6 * (b - 0.5)), x: r1(cfg.headX || 0) },
      hair_back: { r: r1(-1.6 * lag * cfg.hair) },
      sidelock_l: { r: r1(2.2 * lag * cfg.hair) },
      sidelock_r: { r: r1(-2.2 * lag * cfg.hair) },
      ahoge: { r: r1(cfg.ahoge + 5 * Math.sin(a - 1.3) * cfg.hair) },
      ribbon: { r: r1(3 * Math.sin(a - 1.6) * cfg.hair) },
      upper_arm_l: { r: r1(-cfg.ua + cfg.armBreath * (b - 0.5)) },
      forearm_l: { r: r1(-cfg.fa + cfg.armBreath * 0.8 * (b - 0.5)) },
      upper_arm_r: { r: r1(cfg.ua - cfg.armBreath * (b - 0.5)) },
      forearm_r: { r: r1(cfg.fa - cfg.armBreath * 0.8 * (b - 0.5)) },
    };
    // ngón cuộn: bàn tay xoay nhẹ ngược nhau
    const fid = Math.sin(a + 0.5);
    bones.hand_l = { r: r1(cfg.hand + 4 * fid) };
    bones.hand_r = { r: r1(-cfg.hand - 4 * fid) };
    let face = cfg.face;
    if (blink) face = cfg.blinkFace;
    else if (cfg.faceAlt && cfg.faceAlt[i]) face = cfg.faceAlt[i];
    const fr = { ms: Math.round(MS[i] * cfg.slow), face, bones, swap: { hand_l: cfg.handV, hand_r: cfg.handV } };
    if (cfg.swapNone) fr.swap = {};
    frames.push(fr);
  }
  return { loop: frames };
}

const base = { sway: 0, nod: 0, breath: 0.03, chestR: 0, headR: 0, hair: 1, ahoge: 0, ua: 14, fa: 24, armBreath: 1.5,
  hand: 0, handV: 'hold', face: 'normal', blinkFace: 'blink', slow: 1 };

module.exports = {
  action: 'idle',
  moods: {
    normal: mood({ ...base }),
    happy: mood({ ...base, sway: 1.3, breath: 0.035, face: 'happy', faceAlt: { 2: 'closed_happy', 5: 'closed_happy' }, blinkFace: 'closed_happy', ahoge: -4, hair: 1.3, hipsY: 0 }),
    tired: mood({ ...base, face: 'tired', blinkFace: 'sleepy', slow: 1.3, breath: 0.04, nod: 2.2, headR: 2, headY: 2, chestR: 1.5, ua: 8, fa: 14, hair: 0.7, ahoge: 6, handV: 'open' }),
    sad: mood({ ...base, face: 'sad', blinkFace: 'blink', headR: 4, headY: 3, headX: 0, chestR: 2, ua: 5, fa: 10, hair: 0.7, ahoge: 8, handV: 'hold' }),
  },
};
