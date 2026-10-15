// shutdown — single 8 khung (140,140,180,180,150,150,150,150). Mood normal.
// 1-2 vẫy tay · 3 ngáp (tay phải che miệng, tay trái ôm mèo bông) · 4 dụi mắt · 5 cúi chào · 6 ngẩng lên cười · 7-8 nhỏ dần vào vầng sáng (khung cuối gần trong suốt).
const idle = require('./idle.js');
const REST = idle.moods.normal.loop[0];
const r1 = (v) => Math.round(v * 100) / 100;
const arm = (s, ua, fa, h) => ({ ['upper_arm_' + s]: { r: r1(ua) }, ['forearm_' + s]: { r: r1(fa) }, ['hand_' + s]: { r: r1(h) } });
const armL = (ua, fa, h) => arm('l', ua, fa, h);
const armR = (ua, fa, h) => arm('r', -ua, -fa, -h);        // nhập theo quy ước tay trái
const LAYERS = ['hair_back', 'thigh_l', 'shin_l', 'thigh_r', 'shin_r', 'skirt', 'torso', 'neck', 'upper_arm_l', 'upper_arm_r',
  'forearm_l', 'forearm_r', 'hand_l', 'hand_r', 'head', 'face', 'hair_front', 'face_over', 'sidelock_l', 'sidelock_r', 'hairclip', 'ribbon', 'ahoge'];
const OP = (v) => Object.fromEntries(LAYERS.map((id) => [id, v]));
const ZW = { upper_arm_l: 200, upper_arm_r: 200, forearm_l: 201, forearm_r: 201, hand_l: 202, hand_r: 202 };   // vẫy: tay trên tóc
const ZM = { upper_arm_r: 154, forearm_r: 155, hand_r: 156 };                                                // che miệng/dụi mắt
const ZH = { forearm_l: 106, forearm_r: 106 };                                                              // ôm: cẳng tay đè lên mèo
// mèo bông: tâm gốc (200,304); đặt tâm tại (cx,cy), tỉ lệ s
const plush = (cx, cy, s, op, rot) => ({ id: 'plush', file: 'props/cat_plush.svg', bone: 'none', z: 105, x: r1(cx - 200 * s), y: r1(cy - 304 * s), s, ...(op != null ? { opacity: op } : {}) });
const ring = (op) => ({ id: 'fx_ring', file: 'fx/start_ring.svg', bone: 'canvas', z: 5, opacity: op });
const stars = (op) => ({ id: 'fx_stars', file: 'fx/start_stars.svg', bone: 'canvas', z: 215, opacity: op });
const sparkle = (k) => ({ id: 'fx_sparkle', file: k ? 'fx/sparkle2.svg' : 'fx/sparkle.svg', bone: 'head', z: 216 });
const HUGL = armL(30, -92, 6), HUGR = armR(30, -92, 6);

const frames = [
  { ms: 140, face: 'happy', bones: { chest: { sy: 1.0 }, head: { y: 0, r: -2 }, ahoge: { r: 7 }, hair_back: { r: 2 }, ribbon: { r: 5 },
      ...armL(-14.75, -24.6, 1.9), ...armR(118, 20, 6) }, swap: { hand_l: 'hold', hand_r: 'open' }, z: ZW, show: [sparkle(0)] },
  { ms: 140, face: 'happy', bones: { chest: { sy: 1.0 }, head: { y: -1, r: 2 }, ahoge: { r: -7 }, hair_back: { r: -2 }, ribbon: { r: -5 },
      ...armL(-14.75, -24.6, 1.9), ...armR(122, -12, -6) }, swap: { hand_l: 'hold', hand_r: 'open' }, z: ZW, show: [sparkle(1)] },
  { ms: 180, face: 'yawn', bones: { chest: { sy: 1.03, sx: 0.99 }, head: { y: -2, r: -3.5 }, ahoge: { r: 9 }, hair_back: { r: 2.5 }, ribbon: { r: 6 }, sidelock_l: { r: 3 }, sidelock_r: { r: -3 },
      ...armL(42, -86, 6), ...armR(-88, -106, -2) }, swap: { hand_l: 'fist', hand_r: 'open' }, z: { ...ZM, forearm_l: 163, hand_l: 164 },
    show: [{ ...plush(148, 300, 0.52), z: 162 }, { id: 'fx_tear', file: 'fx/start_tear.svg', bone: 'head', z: 216 }] },
  { ms: 180, face: 'sleepy', bones: { chest: { sy: 0.985 }, head: { y: 3, r: 2.5 }, ahoge: { r: -6 }, hair_back: { r: -2 }, ribbon: { r: -4 },
      ...armL(42, -86, 6), ...armR(-118, -92, -8) }, swap: { hand_l: 'fist', hand_r: 'fist' }, z: { ...ZM, forearm_l: 163, hand_l: 164 }, show: [{ ...plush(148, 300, 0.52), z: 162 }] },
  // 5: cúi chào, ôm mèo bông trước ngực
  { ms: 150, face: 'closed_happy', bones: { chest: { sy: 0.95, sx: 1.01 }, head: { y: 8, r: 0 }, ahoge: { r: -10 }, hair_back: { r: -2.5 }, sidelock_l: { r: 3 }, sidelock_r: { r: -3 }, ribbon: { r: -7 },
      ...HUGL, ...HUGR }, swap: { hand_l: 'fist', hand_r: 'fist' }, z: ZH, show: [plush(200, 292, 0.64), sparkle(0)] },
  // 6: ngẩng lên, cười, nhún nhẹ
  { ms: 150, face: 'happy', bones: { chest: { sy: 1.01, sx: 0.995 }, head: { y: -1, r: 2 }, ahoge: { r: 8 }, hair_back: { r: 2 }, ribbon: { r: 5 },
      ...HUGL, ...HUGR }, swap: { hand_l: 'fist', hand_r: 'fist' }, z: ZH, show: [plush(200, 290, 0.64)] },
  // 7: nhỏ dần, mờ dần trong vầng sáng
  { ms: 150, face: 'closed_happy', global: { px: 200, py: 392, sx: 0.62, sy: 0.62 }, opacity: OP(0.55),
    bones: { chest: { sy: 1.0 }, head: { y: 1, r: 1.5 }, ahoge: { r: 12 }, hair_back: { r: 3 }, ribbon: { r: 8 }, ...HUGL, ...HUGR },
    swap: { hand_l: 'fist', hand_r: 'fist' }, z: ZH, show: [plush(200, 290, 0.64, 0.55), ring(0.85), stars(0.85)] },
  // 8: gần như trong suốt
  { ms: 150, face: 'closed_happy', global: { px: 200, py: 392, sx: 0.3, sy: 0.3 }, opacity: OP(0.1),
    bones: { head: { y: 2, r: 1 }, ahoge: { r: 14 }, ribbon: { r: 9 }, ...HUGL, ...HUGR },
    swap: { hand_l: 'fist', hand_r: 'fist' }, z: ZH, show: [plush(200, 290, 0.64, 0.1), ring(0.45), stars(0.3)] },
];

module.exports = {
  action: 'shutdown',
  moods: { normal: { single: frames.map((f) => ({ ...f, bones: { ...REST.bones, ...f.bones } })) } },
};
