// stretch — single 9 khung. Mood normal. Hít sâu, hai tay vươn chữ V qua đầu (z tay trên tóc), nhón chân, ngáp rồi thả lỏng, cười.
// Kín đáo: không ưỡn ngực (chest chỉ giãn dọc nhẹ). Khung cuối = idle/normal/loop[0].
const idle = require('./idle.js');
const REST = idle.moods.normal.loop[0];
const r1 = (v) => Math.round(v * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;
// k: 0 = đứng, 1 = tay giơ hết cỡ. Hai tay đối xứng.
function pose(k, o) {
  const ua = lerp(-14.75, 150, k), fa = lerp(-24.6, -8, k), sy = lerp(1, 1.1, k);
  const S = k > 0.5 ? { sy: r1(sy) } : {};
  const b = {
    upper_arm_l: { r: r1(ua + (o.dl || 0)), ...S }, forearm_l: { r: r1(fa), ...S },
    upper_arm_r: { r: r1(-ua - (o.dr || 0)), ...S }, forearm_r: { r: r1(-fa), ...S },
    hand_l: { r: r1(lerp(1.9, 0, k)) }, hand_r: { r: r1(lerp(-1.9, 0, k)) },
    chest: { sy: r1(1 + 0.04 * k + (o.ch || 0)), sx: r1(1 - 0.012 * k) },
    head: { y: r1(o.hy || 0), r: r1(o.hr || 0) },
    hair_back: { r: r1(o.hb || 0) }, sidelock_l: { r: r1(o.sl || 0) }, sidelock_r: { r: r1(-(o.sl || 0)) },
    ahoge: { r: r1(o.ah || 0) }, ribbon: { r: r1(o.rb || 0) },
    hips: { y: r1(-3 * (o.toe || 0)) },
    thigh_l: { sy: r1(1 + 0.07 * (o.toe || 0)) }, thigh_r: { sy: r1(1 + 0.07 * (o.toe || 0)) },
  };
  return b;
}
const Z = { upper_arm_l: 200, upper_arm_r: 200, forearm_l: 201, forearm_r: 201, hand_l: 202, hand_r: 202 };
const SPK = [{ id: 'fx_sparkle', file: 'fx/sparkle.svg', bone: 'head', z: 216 }];
const SPK2 = [{ id: 'fx_sparkle', file: 'fx/sparkle2.svg', bone: 'head', z: 216 }];

const frames = [
  { ms: 100, face: 'normal', bones: pose(0.15, { ch: 0.01, hy: -0.5, ah: 3, hb: 1 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z },
  { ms: 100, face: 'blink', bones: pose(0.5, { ch: 0.015, hy: -1, hr: -1.5, ah: 6, hb: 2, rb: 4 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z },
  { ms: 120, face: 'yawn', bones: pose(0.9, { toe: 0.6, hy: -2, hr: -3, ah: 9, hb: 3, sl: 3, rb: 6 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z },
  { ms: 160, face: 'yawn', bones: pose(1, { toe: 1, hy: -3, hr: -3.5, ah: 11, hb: 3.5, sl: 3.5, rb: 7, dl: 3, dr: -3 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z, show: SPK },
  { ms: 160, face: 'closed_happy', bones: pose(1, { toe: 1, hy: -3, hr: 3.5, ah: -9, hb: -3, sl: -3, rb: -6, dl: -3, dr: 3 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z, show: SPK2 },
  { ms: 120, face: 'happy', bones: pose(0.65, { toe: 0.3, ch: -0.015, hy: 1, hr: 1, ah: -5, hb: -1.5, sl: -2, rb: -4 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z },
  { ms: 110, face: 'happy', bones: pose(0.3, { ch: -0.015, hy: 1.5, hr: 0.5, ah: -2, hb: -1 }), swap: { hand_l: 'open', hand_r: 'open' }, z: Z },
  { ms: 110, face: 'closed_happy', bones: pose(0.1, { ch: -0.012, hy: 1, ah: 3, hb: 1, rb: 2 }), swap: { hand_l: 'hold', hand_r: 'hold' } },
  { ms: 130, face: REST.face, bones: REST.bones, swap: REST.swap },
];

module.exports = {
  action: 'stretch',
  moods: { normal: { single: frames.map((f) => ({ ...f, bones: { ...REST.bones, ...f.bones } })) } },
};
