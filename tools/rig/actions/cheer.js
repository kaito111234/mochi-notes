// cheer — single 9 khung: nhún lấy đà, bật nhẹ giơ hai nắm tay reo "yay!", hoa giấy rơi, đáp, nhún hai tay xen kẽ, hạ tay về đứng.
// Khác `happy`: bật thấp hơn, tay chữ V rồi "nhún" từng tay, có hoa giấy (fx/cheer_confetti_a|b|c). Chân luôn về y=392 ở khung đầu/đáp/cuối.
const IDLE = require('./idle.js').moods.normal.loop[0];
const ARM_Z = { upper_arm_l: 190, upper_arm_r: 190, forearm_l: 191, forearm_r: 191, hand_l: 192, hand_r: 192 };
const G = (sy, y, sx) => ({ px: 200, py: 392, sy, sx: sx || 1, y: y || 0 });
const r1 = (v) => Math.round(v * 10) / 10;
// ur/fr: tay phải nâng ur độ (dương = giơ ra ngoài/lên) gập khuỷu fr; tay trái đối xứng; ul/fl ghi đè.
function arms(ur, fr, ul, fl) {
  return { upper_arm_r: { r: -ur }, forearm_r: { r: -fr }, upper_arm_l: { r: ul === undefined ? ur : ul }, forearm_l: { r: fl === undefined ? fr : fl } };
}
const hair = (k) => ({ hair_back: { r: r1(-2.4 * k) }, sidelock_l: { r: r1(3.2 * k) }, sidelock_r: { r: r1(-3.2 * k) }, ahoge: { r: r1(-7 * k) }, ribbon: { r: r1(4 * k) } });
const tuck = (k) => ({ shin_l: { r: r1(8 * k), y: r1(-5 * k) }, shin_r: { r: r1(-8 * k), y: r1(-5 * k) } });
const conf = (k, dy) => ({ id: 'fx_confetti', file: 'fx/cheer_confetti_' + k + '.svg', bone: 'canvas', z: 212, y: dy || 0 });
const burst = (dy) => ({ id: 'fx_burst', file: 'fx/cheer_burst.svg', bone: 'none', z: 213, y: dy || 0 });
const FIST = { hand_l: 'fist', hand_r: 'fist' };

const frames = [
  // 1 nhún lấy đà, hai nắm tay kéo xuống sau
  { ms: 90, face: 'excited', global: G(0.955, 0, 1.03), bones: { chest: { sy: 0.985, r: 1 }, head: { y: 2.5 }, ...arms(-16, 10), ...hair(-0.6) }, swap: FIST, z: ARM_Z },
  // 2 bật lên, tay vung lên
  { ms: 70, face: 'laugh', global: G(1.02, -9, 0.99), bones: { chest: { sy: 1.015 }, head: { y: -1 }, ...arms(92, 28), ...tuck(0.5), ...hair(0.6) }, swap: FIST, z: ARM_Z,
    show: [burst(0)] },
  // 3 đỉnh: tay chữ V, hoa giấy tung
  { ms: 100, face: 'laugh', global: G(1.025, -21, 0.985), bones: { chest: { sy: 1.02, r: -1 }, head: { y: -1.5, r: 1 }, ...arms(146, 10), ...tuck(1), ...hair(1.3) }, swap: FIST, z: ARM_Z,
    show: [conf('a', 0), burst(-21)] },
  // 4 lơ lửng, hoa giấy rơi, lắc nhẹ
  { ms: 100, face: 'excited', global: G(1.01, -19, 0.995), bones: { chest: { sy: 1.0, r: 1.5 }, head: { y: -0.5, r: -1 }, ...arms(152, 6), ...tuck(0.8), ...hair(0.3) }, swap: FIST, z: ARM_Z,
    show: [conf('b', 0), burst(-19)] },
  // 5 rơi xuống
  { ms: 70, face: 'laugh', global: G(1.0, -7, 1), bones: { chest: { sy: 1.0 }, head: { y: 0.5 }, ...arms(138, 14), ...tuck(0.3), ...hair(-0.8) }, swap: FIST, z: ARM_Z,
    show: [conf('c', 0)] },
  // 6 đáp, nhún chân, tay vẫn giơ
  { ms: 90, face: 'excited', global: G(0.95, 0, 1.03), bones: { chest: { sy: 0.985 }, head: { y: 2.5 }, ...arms(122, 18), ...hair(-1.6) }, swap: FIST, z: ARM_Z,
    show: [conf('c', 22)] },
  // 7 nhún phải: tay phải reo cao, tay trái gập thấp, nghiêng người
  { ms: 110, face: 'laugh', global: G(1.0, -3, 1), bones: { chest: { sy: 1.0, r: 3.5 }, head: { y: 0, r: 3 }, ...arms(150, 8, 88, 40), ...hair(0.8) }, swap: FIST, z: ARM_Z,
    show: [burst(-3)] },
  // 8 nhún trái
  { ms: 110, face: 'closed_happy', global: G(1.0, -3, 1), bones: { chest: { sy: 1.0, r: -3.5 }, head: { y: 0, r: -3 }, ...arms(88, 40, 150, 8), ...hair(-0.8) }, swap: FIST, z: ARM_Z,
    show: [burst(-3)] },
  // 9 hạ tay, mặt vui, gần tư thế đứng gốc (tay buông dần)
  { ms: 130, face: 'happy', global: G(1.0, 0, 1), bones: { chest: { sy: 0.995, r: 0 }, head: { y: 0.5, r: 0 }, ...arms(46, 62), ...hair(0.3) }, swap: { hand_l: 'hold', hand_r: 'hold' }, z: ARM_Z },
];
frames[8].bones.upper_arm_r = { r: 14 }; frames[8].bones.forearm_r = { r: 24 };
frames[8].bones.upper_arm_l = { r: -14 }; frames[8].bones.forearm_l = { r: -24 };
frames[8].z = { upper_arm_l: 90, upper_arm_r: 91, forearm_l: 100, forearm_r: 101, hand_l: 110, hand_r: 111 };
frames[8].bones.hips = IDLE.bones.hips;

module.exports = { action: 'cheer', moods: { normal: { single: frames } } };
