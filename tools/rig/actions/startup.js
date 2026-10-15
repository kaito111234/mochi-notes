// startup — single 8 khung (200,200,180,180,120,120,150,150). Mood normal.
// 1-2 hiện ra từ vầng sáng (scale+opacity) · 3 ngáp+vươn · 4 dụi mắt · 5-6 vẫy chào · 7 hạ tay, cười · 8 = idle/normal/loop[0].
const idle = require('./idle.js');
const REST = idle.moods.normal.loop[0];
const r1 = (v) => Math.round(v * 100) / 100;
// tay: tham số theo quy ước tay trái; tay phải đối xứng (đổi dấu). armsLR(l, r) cho phép hai bên khác nhau.
const arm = (s, ua, fa, h, sy) => ({
  ['upper_arm_' + s]: { r: r1(ua), ...(sy ? { sy } : {}) },
  ['forearm_' + s]: { r: r1(fa), ...(sy ? { sy } : {}) },
  ['hand_' + s]: { r: r1(h) },
});
const armL = (ua, fa, h, sy) => arm('l', ua, fa, h, sy);
const armR = (ua, fa, h, sy) => arm('r', -ua, -fa, -h, sy);   // nhập theo quy ước trái
const SW = (v) => ({ hand_l: v, hand_r: v });
const LAYERS = ['hair_back', 'thigh_l', 'shin_l', 'thigh_r', 'shin_r', 'skirt', 'torso', 'neck', 'upper_arm_l', 'upper_arm_r',
  'forearm_l', 'forearm_r', 'hand_l', 'hand_r', 'head', 'face', 'hair_front', 'face_over', 'sidelock_l', 'sidelock_r', 'hairclip', 'ribbon', 'ahoge'];
const OP = (v) => Object.fromEntries(LAYERS.map((id) => [id, v]));
const ARMZ = { upper_arm_l: 200, upper_arm_r: 200, forearm_l: 201, forearm_r: 201, hand_l: 202, hand_r: 202 };
const ring = (op) => ({ id: 'fx_ring', file: 'fx/start_ring.svg', bone: 'canvas', z: 5, opacity: op });
const stars = (op, f) => ({ id: 'fx_stars', file: f || 'fx/start_stars.svg', bone: 'canvas', z: 215, opacity: op });
const sparkle = (k) => ({ id: 'fx_sparkle', file: k ? 'fx/sparkle2.svg' : 'fx/sparkle.svg', bone: 'head', z: 216 });
const dust = (f) => ({ id: 'fx_dust', file: f, bone: 'canvas', z: 210, opacity: 0.8 });

const frames = [
  // 1: nhỏ, mờ, mắt nhắm, trong vầng sáng
  { ms: 200, face: 'blink', global: { px: 200, py: 392, sx: 0.55, sy: 0.55 }, opacity: OP(0.35),
    bones: { head: { y: 3, r: 0 }, ahoge: { r: 14 }, hair_back: { r: 3 }, ribbon: { r: 8 }, chest: { sy: 0.97 } },
    swap: SW('hold'), show: [ring(0.9), stars(0.9)] },
  // 2: bật lên, hơi ngố (squash), vẫn mơ màng
  { ms: 200, face: 'blink', global: { px: 200, py: 392, sx: 1.04, sy: 0.93 }, opacity: OP(0.85),
    bones: { head: { y: 2, r: 2 }, ahoge: { r: -12 }, hair_back: { r: -2.5 }, sidelock_l: { r: -3 }, sidelock_r: { r: 3 }, ribbon: { r: -7 }, chest: { sy: 0.98 } },
    swap: SW('hold'), show: [ring(0.8), stars(0.7), dust('fx/dust.svg')] },
  // 3: ngáp + vươn vai (hai tay giơ chữ V), đầu ngả sau
  { ms: 180, face: 'yawn', global: { px: 200, py: 392, sx: 0.99, sy: 1.02 },
    bones: { chest: { sy: 1.035, sx: 0.99 }, head: { y: -2, r: -3 }, ahoge: { r: 8 }, hair_back: { r: 2.5 }, sidelock_l: { r: 3 }, sidelock_r: { r: -3 }, ribbon: { r: 6 },
      hips: { y: -2 }, thigh_l: { sy: 1.05 }, thigh_r: { sy: 1.05 },
      ...armL(145, -8, 0, 1.08), ...armR(145, -8, 0, 1.08) },
    swap: SW('open'), z: ARMZ, show: [ring(0.45), stars(0.4)] },
  // 4: dụi mắt (hai nắm tay lên mắt), mắt lim dim, rơi giọt lệ
  { ms: 180, face: 'sleepy', global: { px: 200, py: 392 },
    bones: { chest: { sy: 0.985 }, head: { y: 3, r: 2.5 }, ahoge: { r: -6 }, hair_back: { r: -2 }, sidelock_l: { r: 2 }, sidelock_r: { r: -2 }, ribbon: { r: -4 },
      ...armL(-118, -92, 8), ...armR(-118, -92, 8) },
    swap: SW('fist'), z: { upper_arm_l: 155, upper_arm_r: 155, forearm_l: 156, forearm_r: 156, hand_l: 157, hand_r: 157 }, show: [ring(0.2)] },
  // 5: nhìn lên, cười, giơ tay phải vẫy (nghiêng ra ngoài)
  { ms: 120, face: 'happy',
    bones: { chest: { sy: 1.0 }, head: { y: 0, r: -2 }, ahoge: { r: 7 }, hair_back: { r: 2 }, ribbon: { r: 5 },
      ...armL(-14.75, -24.6, 1.9), ...armR(118, 20, 6) },
    swap: { hand_l: 'hold', hand_r: 'open' }, z: ARMZ, show: [sparkle(0)] },
  // 6: vẫy sang bên kia
  { ms: 120, face: 'happy',
    bones: { chest: { sy: 1.0 }, head: { y: -1, r: 2 }, ahoge: { r: -7 }, hair_back: { r: -2 }, ribbon: { r: -5 },
      ...armL(-14.75, -24.6, 1.9), ...armR(122, -12, -6) },
    swap: { hand_l: 'hold', hand_r: 'open' }, z: ARMZ, show: [sparkle(1)] },
  // 7: hạ tay, cười tít
  { ms: 150, face: 'closed_happy',
    bones: { chest: { sy: 0.99, sx: 1.003 }, head: { y: 0.5, r: 1 }, ahoge: { r: -3 }, hair_back: { r: 1.5 }, sidelock_l: { r: -1.5 }, sidelock_r: { r: 1.5 }, ribbon: { r: -3 },
      ...armL(-14.75, -24.6, 1.9), ...armR(-40, -40, 0) },
    swap: { hand_l: 'hold', hand_r: 'hold' } },
  // 8: = khung 1 loop của idle/normal
  { ms: 150, face: REST.face, bones: REST.bones, swap: REST.swap },
];

module.exports = {
  action: 'startup',
  moods: { normal: { single: frames.map((f) => ({ ...f, bones: { ...REST.bones, ...f.bones } })) } },
};
