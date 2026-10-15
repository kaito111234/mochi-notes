// carry_note — loop 8 khung (110ms): đi bộ sang PHẢI (nhịp/chân như walk.js) trong khi hai tay ôm tờ note to trước ngực.
// Tờ note (props/clean_note.svg, 84x80, s=1.08) gắn vào xương ngực nên đi cùng thân; hai tay giữ nguyên tư thế "hold_note"
// (ua ±96, fa ±136) trong khung ngực => bàn tay luôn kẹp mép note. Nhún theo bước, note hơi nghiêng lắc.
const r1 = (v) => Math.round(v * 100) / 100;
const D = Math.PI / 180;
const IDLE_Z = { upper_arm_l: 190, upper_arm_r: 190, forearm_l: 191, forearm_r: 191 };
const cfg = { ms: 110, legA: 3, lift: 9, bob: 4, hipX: 1.5, hipR: 1.2, lean: -1.5, headR: 1, headY: 0, hair: 1, ahoge: 0 };

function mood() {
  const frames = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const ph = (2 * Math.PI * i) / N;
    const t = i / 8;
    const lift = (u) => { const x = ((u % 1) + 1) % 1; return x < 0.5 ? Math.sin(Math.PI * x / 0.5) : 0; };
    const lAL = lift(t), lAR = lift(t - 0.5);
    const bob = Math.cos(2 * ph);
    const hy = cfg.bob * (1 + bob) / 2;
    const sy_l = -(hy + cfg.lift * lAL), sy_r = -(hy + cfg.lift * lAR);
    const aL = cfg.legA * lAL, aR = -cfg.legA * lAR;
    const sL = -aL * 0.5, sR = -aR * 0.5;
    const lag = Math.sin(ph * 2 - 1.0);
    const faceK = i === 4 ? 'blink' : (i === 1 || i === 5 ? 'protest' : 'normal');
    const bones = {
      hips: { y: r1(hy), x: r1(cfg.hipX * Math.sin(ph)), r: r1(cfg.hipR * Math.sin(ph)) },
      chest: { r: r1(cfg.lean + 1.0 * Math.sin(ph)), sy: r1(1 + 0.012 * bob), sx: r1(1 - 0.006 * bob) },
      head: { r: r1(cfg.headR - 1.6 * Math.sin(ph)), y: r1(cfg.headY + 0.8 * (1 - bob) / 2), x: 0 },
      thigh_l: { r: r1(aL) }, shin_l: { r: r1(sL), y: r1(sy_l) },
      thigh_r: { r: r1(aR) }, shin_r: { r: r1(sR), y: r1(sy_r) },
      hair_back: { r: r1(-2.2 * cfg.hair - 2.0 * cfg.hair * lag) },
      sidelock_l: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      sidelock_r: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      ahoge: { r: r1(-4 * cfg.hair + cfg.ahoge + 3 * Math.sin(ph * 2 - 1.5) * cfg.hair) },
      ribbon: { r: r1(-3 * cfg.hair - 2 * lag * cfg.hair) },
      upper_arm_r: { r: -96 }, forearm_r: { r: 136 }, hand_r: { r: 10 },
      upper_arm_l: { r: 96 }, forearm_l: { r: -136 }, hand_l: { r: -10 },
    };
    frames.push({
      ms: cfg.ms, face: faceK, bones, swap: { hand_l: 'hold', hand_r: 'hold' }, z: IDLE_Z,
      show: [{ id: 'prop_note', file: 'props/clean_note.svg', bone: 'chest', z: 109, x: 200, y: 264, s: 1.08, r: r1(1.2 * Math.sin(ph)) }],
    });
  }
  return { loop: frames };
}

module.exports = { action: 'carry_note', moods: { normal: mood() } };
