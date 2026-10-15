// happy — single 8 khung: lấy đà, bật lên giơ tay nắm, chạm đất, bật nhỏ, đứng ôm má.
// Khung cuối nhả tay về gần tư thế idle/happy.
const ARM_Z = { upper_arm_l: 190, upper_arm_r: 190, forearm_l: 191, forearm_r: 191, hand_l: 192, hand_r: 192 };
const G = (sy, y, sx) => ({ px: 200, py: 392, sy, sx: sx || 1, y: y || 0 });

// cánh tay: [ua, fa] cho tay phải; tay trái đối xứng (dấu ngược)
function arms(ur, fr, ul, fl) {
  return {
    upper_arm_r: { r: -ur }, forearm_r: { r: -fr },
    upper_arm_l: { r: ul === undefined ? ur : ul }, forearm_l: { r: fl === undefined ? fr : fl },
  };
}
const hairBack = (k) => ({ hair_back: { r: -2 * k }, sidelock_l: { r: 3 * k }, sidelock_r: { r: -3 * k }, ahoge: { r: -5 * k }, ribbon: { r: 4 * k } });

const f = (o) => o;

const frames = [
  // 1 lấy đà
  f({ ms: 100, face: 'happy', global: G(0.96, 0, 1.02),
      bones: { chest: { sy: 0.98, r: 2 }, head: { r: 0, y: 2 }, ...arms(-12, 8, -12, 8), ...hairBack(-0.5), hand_l: {}, hand_r: {} },
      swap: { hand_l: 'open', hand_r: 'open' }, z: ARM_Z,
      show: [] }),
  // 2 nén sâu, tay vung ra sau
  f({ ms: 100, face: 'happy', global: G(0.93, 0, 1.03),
      bones: { chest: { sy: 0.97, r: 3 }, head: { r: 0, y: 3 }, ...arms(-22, 8, -22, 8), ...hairBack(-1) },
      swap: { hand_l: 'fist', hand_r: 'fist' }, z: ARM_Z }),
  // 3 bật lên, kéo giãn, tay giơ nắm
  f({ ms: 100, face: 'excited', global: G(1.03, -20, 0.98),
      bones: { chest: { sy: 1.02, r: -1 }, head: { r: 0, y: -1 }, ...arms(132, 12), ...hairBack(1.2) },
      swap: { hand_l: 'fist', hand_r: 'fist' }, z: ARM_Z,
      show: [{ id: 'fx_notes', file: 'fx/notes_music.svg', bone: 'canvas', z: 210 },
             { id: 'fx_sp1', file: 'fx/sparkle.svg', bone: 'canvas', z: 211 }] }),
  // 4 đỉnh
  f({ ms: 100, face: 'laugh', global: G(1.01, -26, 0.995),
      bones: { chest: { sy: 1.0, r: 1 }, head: { r: 0, y: 0 }, ...arms(138, 10), ...hairBack(0.2) },
      swap: { hand_l: 'fist', hand_r: 'fist' }, z: ARM_Z,
      show: [{ id: 'fx_notes', file: 'fx/notes_music.svg', bone: 'canvas', z: 210, y: -4 },
             { id: 'fx_sp2', file: 'fx/sparkle2.svg', bone: 'canvas', z: 211 }] }),
  // 5 chạm đất
  f({ ms: 80, face: 'excited', global: G(0.94, 0, 1.03),
      bones: { chest: { sy: 0.97, r: 0 }, head: { r: 0, y: 3 }, ...arms(28, 10), ...hairBack(-1.4) },
      swap: { hand_l: 'fist', hand_r: 'fist' }, z: ARM_Z,
      show: [{ id: 'fx_sp1', file: 'fx/sparkle.svg', bone: 'canvas', z: 211 }] }),
  // 6 bật nhỏ, tay co lên gần vai
  f({ ms: 100, face: 'laugh', global: G(1.02, -11, 0.99),
      bones: { chest: { sy: 1.02, r: 0 }, head: { r: 0, y: -1 }, ...arms(100, 40), ...hairBack(1) },
      swap: { hand_l: 'fist', hand_r: 'fist' }, z: ARM_Z,
      show: [{ id: 'fx_notes', file: 'fx/notes_music.svg', bone: 'canvas', z: 210, y: 4 },
             { id: 'fx_sp2', file: 'fx/sparkle2.svg', bone: 'canvas', z: 211 }] }),
  // 7 đứng ôm má
  f({ ms: 160, face: 'happy', global: G(0.98, 0, 1.01),
      bones: { chest: { sy: 0.99, r: 0 }, head: { r: 3, y: 1 }, ...arms(40, 140), ...hairBack(-0.4) },
      swap: { hand_l: 'open', hand_r: 'open' }, z: ARM_Z,
      show: [{ id: 'fx_sp1', file: 'fx/sparkle.svg', bone: 'canvas', z: 211 }] }),
  // 8 hạ tay về tư thế idle
  f({ ms: 160, face: 'closed_happy', global: G(1, 0, 1),
      bones: { chest: { sy: 1, r: 0 }, head: { r: 0, y: 0 }, ...arms(14, 24), ...hairBack(0.3) },
      swap: { hand_l: 'hold', hand_r: 'hold' }, z: { upper_arm_l: 90, upper_arm_r: 91, forearm_l: 100, forearm_r: 101, hand_l: 110, hand_r: 111 },
      hide: [] }),
];
// tay trái idle đối xứng đã gồm trong arms() (dấu tay phải âm, tay trái dương); chỉnh riêng cho idle: tay phải +, tay trái −
frames[7].bones.upper_arm_r = { r: 14 }; frames[7].bones.forearm_r = { r: 24 };
frames[7].bones.upper_arm_l = { r: -14 }; frames[7].bones.forearm_l = { r: -24 };

module.exports = { action: 'happy', moods: { normal: { single: frames } } };
