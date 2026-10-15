// wave — single 6 khung (100,110,110,110,110,140). Moods: normal (vẫy nhỏ, cười mím), happy (vẫy to, cười tươi, nảy nhẹ).
// Tay phải (bên phải người xem) giơ lên cạnh đầu, cẳng tay lắc; tay trái buông như idle.
// Tay giơ cao được đẩy lên lớp trên tóc mai/nơ (z 183-185) để không bị tóc che.
const r1 = (v) => Math.round(v * 100) / 100;
const ZUP = { upper_arm_r: 183, forearm_r: 184, hand_r: 185 };
const ZDEF = { upper_arm_r: 91, forearm_r: 101, hand_r: 111 };

function mood(c) {
  const MS = [100, 110, 110, 110, 110, 140];
  // nhịp lắc cẳng tay: khung 1..4 = A,B,A,B ; hand trễ hơn forearm
  const sw = [0, -1, 1, -1, 1, 0];           // -1 = ngả về đầu (fa âm hơn), +1 = ra ngoài
  const frames = [];
  for (let i = 0; i < 6; i++) {
    const s = sw[i];
    const prev = sw[(i + 5) % 6];
    const lag = i === 0 ? 0 : prev;          // tóc/nơ trễ một nhịp
    let ua, uax, fa, hr, up = true;
    if (i === 0) { ua = -82; uax = 3; fa = -28; hr = 0; }
    else if (i === 5) { ua = -38; uax = 1; fa = -8; hr = -4; }
    else { ua = -112 + c.lift; uax = 8; fa = r1(-60 + s * c.amp); hr = r1(-8 + s * c.amp * 0.5); }
    const bones = {
      hips: { x: 0, y: 0 },
      chest: { sy: r1(1 + (c.bounce ? 0.012 * (i % 2 ? 1 : -1) : 0)), r: r1(c.chestR * s) },
      head: { r: r1(c.tilt + (i >= 1 && i <= 4 ? -s * 0.6 : 0)), y: r1(c.bounce && i % 2 === 1 ? -1.2 : 0.4 * (i === 0 || i === 5 ? 1 : 0)), x: -1 },
      hair_back: { r: r1(-1.8 * lag * c.hair) },
      sidelock_l: { r: r1(2.4 * lag * c.hair) }, sidelock_r: { r: r1(-2.4 * lag * c.hair) },
      ahoge: { r: r1(c.ahoge + 7 * lag * c.hair) }, ribbon: { r: r1(-4 * lag * c.hair) },
      upper_arm_r: { r: ua, x: uax }, forearm_r: { r: fa },
      hand_r: { r: hr, sx: i === 0 || i === 5 ? 1.1 : 1.22, sy: i === 0 || i === 5 ? 1.1 : 1.22 },
      upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, hand_l: { r: 0 },
    };
    const z = (i >= 1 && i <= 4) || i === 0 ? ZUP : ZDEF;
    frames.push({
      ms: MS[i], face: c.faces[i], bones,
      swap: { hand_l: 'hold', hand_r: i === 5 ? 'hold' : 'open' },
      z: i === 5 ? { ...ZDEF, upper_arm_r: 91 } : z,
    });
  }
  return { single: frames };
}

module.exports = {
  action: 'wave',
  moods: {
    normal: mood({ amp: 16, lift: 0, bounce: false, chestR: 0.5, tilt: -2.5, hair: 1, ahoge: 0,
      faces: ['normal', 'happy', 'happy', 'happy', 'happy', 'normal'] }),
    happy: mood({ amp: 24, lift: -6, bounce: true, chestR: 1.0, tilt: -3.5, hair: 1.4, ahoge: -4,
      faces: ['happy', 'laugh', 'closed_happy', 'laugh', 'closed_happy', 'happy'] }),
  },
};
