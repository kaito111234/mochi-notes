// peek_note — thò đầu lên từ sau mép TRÊN một tờ note. start 4×110 · loop 6 khung (~1000 ms) · end 3×110. Mood normal.
// Đường mép note: y = 232 (EDGE_Y). Loop: chỉ đầu + tóc (đã nén ngắn, chấm đáy ≈ y 230) + hai bàn tay bám mép ở y≈232 (x≈122 và x≈278).
// Các lớp thân/chân/cổ/tay đều `hide` → trong loop KHÔNG còn gì dưới y=232 ngoài cổ tay áo (vài px). Start/end: đầu trồi/hạ qua mép
// nên core cần che/cắt phần dưới y=232 (vẽ tờ note đè lên pet, hoặc clip) — chỉ ở start/end.
const r2 = (v) => Math.round(v * 100) / 100;
const EDGE_Y = 232;
const HIDE = ['torso', 'skirt', 'neck', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'upper_arm_l', 'upper_arm_r', 'forearm_l', 'forearm_r'];
const HX = { l: 124, r: 276 };

function frame(o) {
  const lag = o.lag || 0;
  const hy = o.rise || 0;                    // đầu hạ xuống dưới mép (px) khi start/end
  const handDy = o.handDy || 0;
  const bones = {
    head: { r: r2(o.headR || 0), x: r2(o.headX || 0), y: r2(hy + (o.headY || 0)) },
    hair_back: { r: r2(-2.4 * lag), sy: 0.5 }, sidelock_l: { r: r2(2.6 * lag), sy: 0.42 }, sidelock_r: { r: r2(-2.6 * lag), sy: 0.42 },
    ahoge: { r: r2(o.ahoge || 0) }, ribbon: { r: r2(-4 * lag) },
    // bàn tay: xoay 180° (ngón hướng lên), cổ tay đặt tại (HX, EDGE_Y+3); arm ẩn nên tịnh tiến thẳng xương bàn tay
    hand_l: { r: r2(180 + (o.tapL || 0)), x: r2(HX.l - 152 + (o.hxL || 0)), y: r2(EDGE_Y + 3 - 306 + handDy + (o.dyL || 0)) },
    hand_r: { r: r2(-180 + (o.tapR || 0)), x: r2(HX.r - 248 + (o.hxR || 0)), y: r2(EDGE_Y + 3 - 306 + handDy + (o.dyR || 0)) },
  };
  return { ms: o.ms, face: o.face, bones, hide: HIDE, swap: { hand_l: 'fist', hand_r: 'fist' },
    z: { hand_l: 166, hand_r: 167 } };
}

// loop: nhìn trái/phải tò mò, chớp, ngón gõ luân phiên
const loop = [
  frame({ ms: 220, face: 'normal', headR: -3, headX: -3, lag: 0.4, ahoge: -5, tapL: 0, tapR: 0 }),
  frame({ ms: 160, face: 'o',      headR: -5, headX: -5, lag: 1.0, ahoge: 6,  tapL: -8, dyL: -2 }),
  frame({ ms: 180, face: 'normal', headR: 0,  headX: 0,  lag: 0.3, ahoge: 3,  tapL: 0 }),
  frame({ ms: 200, face: 'normal', headR: 4,  headX: 4,  lag: -0.6, ahoge: -4, tapR: 0 }),
  frame({ ms: 90,  face: 'blink',  headR: 5,  headX: 4,  lag: -1.0, ahoge: -6, tapR: 8, dyR: -2 }),
  frame({ ms: 150, face: 'normal', headR: 1,  headX: 1,  lag: -0.2, ahoge: 2, tapR: 0 }),
];
const L0 = loop[0];
// start: tay bám trước, đầu trồi dần lên (rise 74 → 40 → 14 → 0)
const start = [
  frame({ ms: 110, face: 'normal', rise: 74, handDy: 18, headR: 0, lag: -1, ahoge: 8 }),
  frame({ ms: 110, face: 'o', rise: 40, handDy: 6, headR: -3, headX: -3, lag: 1, ahoge: -7 }),
  frame({ ms: 110, face: 'o', rise: 14, handDy: 0, headR: -4, headX: -4, lag: -0.8, ahoge: 6 }),
  { ...L0, ms: 110 },
];
const end = [
  frame({ ms: 110, face: 'normal', rise: 12, headR: 0, headX: 0, lag: 0.8, ahoge: -5 }),
  frame({ ms: 110, face: 'shy', rise: 44, handDy: 6, lag: -1, ahoge: 7 }),
  frame({ ms: 110, face: 'shy', rise: 80, handDy: 20, lag: 0.5, ahoge: -4 }),
];
module.exports = { action: 'peek_note', moods: { normal: { start, loop, end } } };
