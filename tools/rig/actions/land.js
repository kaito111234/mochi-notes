// land — single 5 khung (60,80,90,100,160). Ngồi xổm chibi rồi đứng dậy về tư thế idle khung 1.
const r1 = (v) => Math.round(v * 100) / 100;
const D = Math.PI / 180;
const footY = (a, s) => 42 * Math.cos(a * D) + 44 * Math.cos((a + s) * D);
// chân: đùi a, ống s (trái +a/ s ; phải đối xứng); hông hạ để đế giữ y=392
function legs(a, s) {
  return {
    hipsY: 86 - footY(a, s),
    thigh_l: { r: a }, shin_l: { r: s },
    thigh_r: { r: -a }, shin_r: { r: -s },
  };
}
const IDLE_ARMS = { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, upper_arm_r: { r: 14 }, forearm_r: { r: 24 } };
const hold = { hand_l: 'hold', hand_r: 'hold' };

function frame(ms, face, a, s, o) {
  const L = legs(a, s);
  const bones = {
    hips: { y: r1(L.hipsY) },
    thigh_l: L.thigh_l, shin_l: L.shin_l, thigh_r: L.thigh_r, shin_r: L.shin_r,
    chest: { sy: o.chestSy || 1, sx: o.chestSx || 1, r: o.chestR || 0 },
    head: { r: o.headR || 0, y: o.headY || 0 },
    hair_back: { r: o.hbR || 0, sy: o.hbSy || 1, sx: o.hbSx || 1 },
    sidelock_l: { r: o.slR || 0 }, sidelock_r: { r: -(o.slR || 0) },
    ahoge: { r: o.ahR || 0 }, ribbon: { r: o.rbR || 0 },
    ...(o.arms || IDLE_ARMS),
  };
  const f = { ms, face, bones, swap: o.swap || hold };
  if (o.show) f.show = o.show;
  return f;
}
const dust = (id) => ({ id, file: 'fx/' + id + '.svg', bone: 'canvas', z: 210 });

module.exports = {
  action: 'land',
  moods: {
    normal: {
      single: [
        frame(60, 'wince', 25, -55, { chestSy: 0.97, headY: 1, hbSy: 1.03, hbR: 3, slR: -4, ahR: -8, rbR: -5,
          arms: { upper_arm_l: { r: -22 }, forearm_l: { r: -20 }, upper_arm_r: { r: 22 }, forearm_r: { r: 20 } } }),
        frame(80, 'wince', 50, -95, { chestSy: 0.92, chestSx: 1.03, headY: 2, hbSy: 1.05, hbSx: 1.04, hbR: 5, slR: -6, ahR: -12, rbR: -8,
          arms: { upper_arm_l: { r: 25 }, forearm_l: { r: 5 }, upper_arm_r: { r: -25 }, forearm_r: { r: -5 } },
          show: [dust('dust')] }),
        frame(90, 'surprised', 18, -40, { chestSy: 0.99, chestR: -2, hbSy: 1.02, hbR: -3, slR: 3, ahR: 8, rbR: 4,
          arms: { upper_arm_l: { r: 50 }, forearm_l: { r: 10 }, upper_arm_r: { r: -50 }, forearm_r: { r: -10 } },
          swap: { hand_l: 'open', hand_r: 'open' }, show: [dust('dust2')] }),
        frame(100, 'normal', 5, -10, { chestR: 1, headR: -6, hbR: 2, slR: -2, ahR: -4,
          arms: { upper_arm_l: { r: -18 }, forearm_l: { r: -28 }, upper_arm_r: { r: 18 }, forearm_r: { r: 28 } } }),
        frame(160, 'normal', 0, 0, { chestSy: 0.9865, chestSx: 1.004, headY: -0.3 }),
      ],
    },
  },
};
