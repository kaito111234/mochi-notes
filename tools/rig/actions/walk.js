// walk — loop 8 khung (110ms; tired 150ms). Nhìn chính diện, tạo cảm giác đi sang PHẢI.
const r1 = (v) => Math.round(v * 100) / 100;
const D = Math.PI / 180;
// Chân: đùi 42, ống 44. Tính y đế giày để hạ hông giữ chân trụ chạm y=392.
function footY(a, s) { return 42 * Math.cos(a * D) + 44 * Math.cos((a + s) * D); }
const REST = 86;

function mood(cfg) {
  const frames = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const ph = (2 * Math.PI * i) / N;
    const t = i / 8;
    const lift = (u) => { const x = ((u % 1) + 1) % 1; return x < 0.5 ? Math.sin(Math.PI * x / 0.5) : 0; };
    const lAL = lift(t);        // trái nhấc đỉnh ở khung 3
    const lAR = lift(t - 0.5);  // phải nhấc đỉnh ở khung 7
    // chân nhấc gần thẳng đứng: đùi xoay nhỏ, ống dịch lên (shin.y) để bàn chân nhấc tại đúng cột x của nó
    const bob = Math.cos(2 * ph);                // 1 ở khung đặt chân, -1 ở khung nhấc
    const hy = cfg.bob * (1 + bob) / 2;          // hạ 0..bob khi đặt chân
    const sy_l = -(hy + cfg.lift * lAL), sy_r = -(hy + cfg.lift * lAR);
    const aL = cfg.legA * lAL, aR = -cfg.legA * lAR;
    const sL = -aL * 0.5, sR = -aR * 0.5;
    const sway = Math.sin(ph * 2);               // lắc theo bước
    const armL = Math.sin(ph - Math.PI / 4);     // tay đối nghịch chân
    const lag = Math.sin(ph * 2 - 1.0);
    const bones = {
      hips: { y: r1(hy), x: r1(cfg.hipX * Math.sin(ph)), r: r1(cfg.hipR * Math.sin(ph)) },
      chest: { r: r1(cfg.lean + 1.2 * Math.sin(ph)), sy: r1(1 + 0.012 * bob), sx: r1(1 - 0.006 * bob) },
      head: { r: r1(cfg.headR - 2 * Math.sin(ph)), y: r1(cfg.headY), x: r1(cfg.headX) },
      thigh_l: { r: r1(aL) }, shin_l: { r: r1(sL), y: r1(sy_l) },
      thigh_r: { r: r1(aR) }, shin_r: { r: r1(sR), y: r1(sy_r) },
      hair_back: { r: r1(-2.2 * cfg.hair - 2.0 * cfg.hair * lag) },
      sidelock_l: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      sidelock_r: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      ahoge: { r: r1(-4 * cfg.hair + cfg.ahoge + 3 * Math.sin(ph * 2 - 1.5) * cfg.hair) },
      ribbon: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      upper_arm_l: { r: r1(-cfg.ua - cfg.armSwing * armL) },
      forearm_l: { r: r1(-cfg.fa - 3 * armL) },
      upper_arm_r: { r: r1(cfg.ua - cfg.armSwing * armL) },
      forearm_r: { r: r1(cfg.fa - 3 * armL) },
    };
    frames.push({ ms: cfg.ms, face: i === 4 && cfg.blink ? cfg.blink : cfg.face, bones, swap: { hand_l: cfg.handV, hand_r: cfg.handV } });
  }
  return { loop: frames };
}

const base = { ms: 110, face: 'normal', legA: 3, lift: 9, bob: 4, hipX: 1.5, hipR: 1.2, lean: 3.5, headR: 1.5, headY: 0, headX: 0,
  hair: 1, ahoge: 0, ua: 12, fa: 20, armSwing: 12, handV: 'hold' };

module.exports = {
  action: 'walk',
  moods: {
    normal: mood({ ...base }),
    tired: mood({ ...base, ms: 150, face: 'tired', blink: 'sleepy', legA: 2, lift: 7, bob: 3, lean: 5, headR: 5, headY: 3, ua: 6, fa: 12, armSwing: 8, hair: 0.7, ahoge: 6, handV: 'open' }),
  },
};
