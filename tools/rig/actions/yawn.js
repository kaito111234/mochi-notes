// yawn — single 8 khung. Moods: normal, tired. Ngáp: hít vào, há miệng, tay phải che miệng, tay trái vươn nhẹ, rơi giọt lệ, rồi thả lỏng.
// Khung cuối = idle/<mood>/loop[0] (tư thế đứng gốc).
const idle = require('./idle.js');
const r1 = (v) => Math.round(v * 100) / 100;
const arm = (s, ua, fa, h) => ({ ['upper_arm_' + s]: { r: r1(ua) }, ['forearm_' + s]: { r: r1(fa) }, ['hand_' + s]: { r: r1(h) } });
const armL = (ua, fa, h) => arm('l', ua, fa, h);
const armR = (ua, fa, h) => arm('r', -ua, -fa, -h);       // nhập theo quy ước tay trái
const HZ = { upper_arm_r: 154, forearm_r: 155, hand_r: 156 };  // tay phải che miệng: nằm trên mặt, dưới tóc mai
const tear = { id: 'fx_tear', file: 'fx/start_tear.svg', bone: 'head', z: 216 };

function mood(restMood, c) {
  const REST = idle.moods[restMood].loop[0];
  const RA = [REST.bones.upper_arm_l.r, REST.bones.forearm_l.r, REST.bones.hand_l.r];
  const rest = (o) => ({ ...armL(...RA), ...armR(...RA.map((v, i) => (i === 2 ? v : v))), ...o });
  const hold = { hand_l: REST.swap.hand_l, hand_r: REST.swap.hand_r };
  const F = [
    // 1: hít vào, ngả đầu nhẹ, miệng chưa mở
    { ms: 110, face: c.f0, bones: { chest: { sy: 1.02, sx: 0.995 }, head: { y: -1, r: -2 }, ahoge: { r: 5 }, hair_back: { r: 1.5 },
        ...armL(...RA), ...armR(-30, -45, 0) }, swap: { hand_l: hold.hand_l, hand_r: 'open' }, z: HZ },
    // 2: há miệng, tay phải nhấc lên, tay trái bắt đầu vươn
    { ms: 110, face: 'yawn', bones: { chest: { sy: 1.03, sx: 0.99 }, head: { y: -2, r: -3.5 }, ahoge: { r: 8 }, hair_back: { r: 2.5 }, ribbon: { r: 5 },
        ...armL(-4, -24, 0), ...armR(-62, -84, 0) }, swap: { hand_l: 'open', hand_r: 'open' }, z: HZ },
    // 3: tay phải che miệng, tay trái vươn ra bên
    { ms: 140, face: 'yawn', bones: { chest: { sy: 1.04, sx: 0.985 }, head: { y: -2.5, r: -4 }, ahoge: { r: 10 }, hair_back: { r: 3 }, ribbon: { r: 6 }, sidelock_l: { r: 3 }, sidelock_r: { r: -3 },
        ...armL(32, -10, 4), ...armR(-88, -106, -2) }, swap: { hand_l: 'open', hand_r: 'open' }, z: HZ, show: [tear] },
    // 4: đỉnh ngáp, giữ
    { ms: 160, face: 'yawn', bones: { chest: { sy: 1.045, sx: 0.983 }, head: { y: -3, r: -4.5 }, ahoge: { r: 12 }, hair_back: { r: 3.5 }, ribbon: { r: 7 }, sidelock_l: { r: 3.5 }, sidelock_r: { r: -3.5 },
        ...armL(38, -8, 5), ...armR(-90, -108, -2) }, swap: { hand_l: 'open', hand_r: 'open' }, z: HZ, show: [tear] },
    // 5: vẫn che miệng, nhắm mắt lim dim
    { ms: 130, face: 'yawn', bones: { chest: { sy: 1.03, sx: 0.99 }, head: { y: -1.5, r: -3 }, ahoge: { r: 6 }, hair_back: { r: 2 }, ribbon: { r: 3 },
        ...armL(28, -14, 3), ...armR(-88, -106, -2) }, swap: { hand_l: 'open', hand_r: 'open' }, z: HZ, show: [tear] },
    // 6: thở ra, hạ tay phải, đầu gật xuống
    { ms: 130, face: c.f1, bones: { chest: { sy: 0.985, sx: 1.005 }, head: { y: 2, r: 2.5 }, ahoge: { r: -6 }, hair_back: { r: -2 }, ribbon: { r: -4 },
        ...armL(8, -24, 2), ...armR(-50, -70, 0) }, swap: { hand_l: 'hold', hand_r: 'open' }, z: HZ, hide: ['fx_tear'] },
    // 7: tay về, mắt lim dim
    { ms: 120, face: c.f2, bones: { chest: { sy: 0.99, sx: 1.003 }, head: { y: 1, r: 1 }, ahoge: { r: -3 }, hair_back: { r: -1 }, ribbon: { r: -2 },
        ...armL(-10, -26, 2), ...armR(-12, -26, -2) }, swap: hold },
    // 8: tư thế đứng gốc
    { ms: 120, face: REST.face, bones: REST.bones, swap: REST.swap },
  ];
  return { single: F.map((f) => ({ ...f, bones: { ...REST.bones, ...f.bones } })) };
}

module.exports = {
  action: 'yawn',
  moods: {
    normal: mood('normal', { f0: 'normal', f1: 'blink', f2: 'normal' }),
    tired: mood('tired', { f0: 'tired', f1: 'sleepy', f2: 'tired' }),
  },
};
