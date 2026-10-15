// point — start 3x100, loop 4x130, end 3x120. Mood normal.
// Tay phải duỗi chỉ sang PHẢI màn hình (+x) bằng hand_r.point; loop nhấp nhẹ đầu ngón. Chỉ vẽ hướng phải (engine lật khi cần).
const r1 = (v) => Math.round(v * 100) / 100;
const swapPt = { hand_l: 'hold', hand_r: 'point' };
const L = { upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, hand_l: { r: 0 } };
const PT = { ua: -86, fa: 0 };

function body(o) {
  return {
    hips: { x: 0, y: 0 },
    chest: { sy: o.sy || 1, r: o.cr || 0 },
    head: { r: o.hr || 0, x: o.hx || 0, y: o.hy || 0 },
    hair_back: { r: r1(-1.6 * (o.lag || 0)) }, sidelock_l: { r: r1(2 * (o.lag || 0)) }, sidelock_r: { r: r1(-2 * (o.lag || 0)) },
    ahoge: { r: r1(o.ah || 0) }, ribbon: { r: r1(-3 * (o.lag || 0)) },
    ...L,
  };
}
const arm = (ua, fa, hr, ux) => ({ upper_arm_r: { r: ua, x: ux || 0 }, forearm_r: { r: fa }, hand_r: { r: hr } });

// loop: nhấp ngón (forearm/hand lên xuống), thân nghiêng nhẹ theo hướng chỉ
const dip = [0, -1, 0, 1];
const loop = [0, 1, 2, 3].map((i) => ({
  ms: 130, face: i === 2 ? 'blink' : 'normal',
  bones: { ...body({ cr: 1.2, hr: 2, hx: 1.5, hy: 0.5 + 0.5 * (i % 2), sy: 1 + 0.006 * (i % 2), lag: dip[(i + 3) % 4], ah: 3 * dip[(i + 3) % 4] }),
    ...arm(PT.ua + 1.5 * dip[i], PT.fa + 2 * dip[i], 1.5 * dip[i]) },
  swap: swapPt,
}));
const start = [
  { ms: 100, face: 'normal', bones: { ...body({ cr: 0.4, hr: 1, lag: 0.5 }), ...arm(-30, -20, 0) }, swap: { hand_l: 'hold', hand_r: 'fist' } },
  { ms: 100, face: 'normal', bones: { ...body({ cr: 0.9, hr: 1.5, hx: 1, lag: 1, ah: 4 }), ...arm(-64, -8, 0) }, swap: swapPt },
  { ms: 100, face: 'normal', bones: { ...loop[0].bones }, swap: swapPt },
];
const end = [
  { ms: 120, face: 'normal', bones: { ...body({ cr: 0.9, hr: 1.5, hx: 1, lag: -0.5 }), ...arm(-56, -10, 0) }, swap: swapPt },
  { ms: 120, face: 'normal', bones: { ...body({ cr: 0.4, hr: 0.5, lag: -1, ah: -3 }), ...arm(-20, 14, 0) }, swap: { hand_l: 'hold', hand_r: 'hold' } },
  // tư thế đứng gốc idle normal khung đầu
  { ms: 120, face: 'normal', bones: { ...body({}), ...arm(14, 24, -1.92) }, swap: { hand_l: 'hold', hand_r: 'hold' } },
];
module.exports = { action: 'point', moods: { normal: { start, loop, end } } };
