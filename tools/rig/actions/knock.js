// knock — "cộc cộc": bé đứng sát mép phải canvas, nắm tay phải gõ vào bức tường vô hình (mặt trước nắm đấm chạm x≈315).
// Vẽ hướng PHẢI (+x). start 3x(100-110), loop 6 khung (2 nhịp gõ + nghỉ), end 3x(110-130). Mood normal.
// Tay phải IK theo toạ độ THẾ GIỚI (bù nghiêng ngực) nên nắm đấm chạm tường đúng chỗ ở các khung "gõ".
// --- tiện ích hình học (chép từ hold_note: ma trận 2D + IK hai khớp cho tay trong KHUNG NGỰC) ---
const r2 = (v) => Math.round(v * 100) / 100;
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const Rm = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const Sm = (x, y) => [x, 0, 0, y, 0, 0];
function boneM(P, b) { b = b || {};
  return mul(mul(mul(T(P[0] + (b.x || 0), P[1] + (b.y || 0)), Rm(b.r || 0)), Sm(b.sx == null ? 1 : b.sx, b.sy == null ? 1 : b.sy)), T(-P[0], -P[1])); }
const inv = (m) => { const det = m[0]*m[3]-m[1]*m[2]; const a = m[3]/det, b = -m[1]/det, c = -m[2]/det, d = m[0]/det;
  return [a, b, c, d, -(a*m[4]+c*m[5]), -(b*m[4]+d*m[5])]; };
const ap = (m, p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
const SH = { r: [236, 244], l: [164, 244] }, EL = { r: [244, 278], l: [156, 278] }, WR = { r: [248, 306], l: [152, 306] };
const HC = { r: [248, 320], l: [152, 320] };                 // tâm bàn tay (nắm/hold) trong tư thế gốc
function handAt(side, ua, fa, ha) {                           // tâm bàn tay trong khung ngực
  const mU = boneM(SH[side], { r: ua }), mF = mul(mU, boneM(EL[side], { r: fa })), mH = mul(mF, boneM(WR[side], { r: ha || 0 }));
  return ap(mH, HC[side]);
}
// IK: tìm (ua, fa) để tâm bàn tay chạm target (khung ngực); chọn nghiệm gần (ua0, fa0).
function ik(side, tg, ua0, fa0, ha) {
  let best = null;
  const tryRange = (u0, u1, f0, f1, st) => {
    for (let u = u0; u <= u1; u += st) for (let f = f0; f <= f1; f += st) {
      const p = handAt(side, u, f, ha); const dx = p[0] - tg[0], dy = p[1] - tg[1];
      const c = dx * dx + dy * dy + 0.0004 * ((u - ua0) * (u - ua0) + (f - fa0) * (f - fa0));
      if (!best || c < best.c) best = { c, u, f };
    }
  };
  tryRange(-180, 180, -175, 175, 3);
  const b = best; tryRange(b.u - 3, b.u + 3, b.f - 3, b.f + 3, 0.25);
  return [r2(best.u), r2(best.f)];
}
// tư thế thế giới -> khung ngực (để chỉ định bàn tay bằng toạ độ thế giới khi hông/ngực di chuyển)
function chestInv(hips, chest) { return inv(mul(boneM([200, 306], hips || {}), boneM([200, 300], chest || {}))); }

const IDLE = require('./idle.js').moods.normal.loop[0];
const ARM_Z = { upper_arm_r: 190, forearm_r: 191, hand_r: 192 };
const IMPACT = [323, 246];                                   // điểm va chạm (tâm hiệu ứng)
const fxA = (dx, dy) => ({ id: 'fx_knock', file: 'fx/knock_a.svg', bone: 'canvas', z: 215, x: IMPACT[0] + (dx || 0), y: IMPACT[1] + (dy || 0) });
const fxB = (dx, dy) => ({ id: 'fx_knock', file: 'fx/knock_b.svg', bone: 'canvas', z: 215, x: IMPACT[0] + (dx || 0), y: IMPACT[1] + (dy || 0) });
const txt = (x, y, r) => ({ id: 'fx_knock_text', file: 'fx/knock_text.svg', bone: 'canvas', z: 216, x, y, r: r || 0 });

let prevLean = 0;
function kf(o) {
  const lean = o.lean || 0;
  const chest = { r: r2(lean), sy: o.sy || 1, sx: o.sx || 1 };
  const Mi = chestInv({}, chest);
  const t = ap(Mi, o.fist);
  const ha = o.ha || 0;
  const [ua, fa] = ik('r', t, -78, -18, ha);
  const lag = prevLean - lean; prevLean = lean;
  const bones = {
    hips: { x: 0, y: 0 }, chest,
    head: { r: r2(lean * 0.5 + (o.headR || 0)), y: r2(o.headY || 0), x: r2(lean * 0.4) },
    hair_back: { r: r2(-1.6 * lean * 0.5 + 1.4 * lag) }, sidelock_l: { r: r2(2 * lag) }, sidelock_r: { r: r2(-1.2 * lean * 0.5 - 2 * lag) },
    ahoge: { r: r2(-3 * lean + 2.5 * lag + (o.ahoge || 0)) }, ribbon: { r: r2(-2 * lag) },
    upper_arm_l: IDLE.bones.upper_arm_l, forearm_l: IDLE.bones.forearm_l, hand_l: IDLE.bones.hand_l,
    upper_arm_r: { r: ua }, forearm_r: { r: fa }, hand_r: { r: ha },
  };
  return { ms: o.ms, face: o.face || 'normal', bones, swap: { hand_l: 'hold', hand_r: 'fist' }, z: ARM_Z, show: o.show || [] };
}
const HIT = [302, 247];     // tâm nắm đấm khi gõ (mép trước nắm đấm ~ x 316)

const loop = [
  kf({ ms: 110, face: 'protest', lean: 3, fist: [277, 236], ha: 8, headR: -1, ahoge: -4 }),                                       // lấy đà (tay co lên)
  kf({ ms: 70, face: 'protest', lean: 6, sy: 0.99, fist: HIT, ha: 0, headY: 1, ahoge: 8, show: [fxA()] }),     // CỘC 1
  kf({ ms: 100, face: 'normal', lean: 3.5, fist: [286, 241], ha: 6, ahoge: -2 }),                                                 // nảy lại
  kf({ ms: 70, face: 'protest', lean: 6.5, sy: 0.99, fist: [HIT[0] + 1, HIT[1] + 1], ha: 0, headY: 1, ahoge: 9, show: [fxB()] }), // CỘC 2
  kf({ ms: 110, face: 'normal', lean: 3, fist: [278, 247], ha: 8, headR: 1 }),                                                    // thu tay
  kf({ ms: 210, face: 'normal', lean: 2.4, sy: 1.006, fist: [274, 252], ha: 8, headR: 1.5, headY: 0.4, ahoge: 3 }),               // nghỉ chờ
];
prevLean = 2.4;
// start: từ đứng gốc -> giơ tay -> khung đầu loop
const start = [
  Object.assign(kf({ ms: 110, face: 'normal', lean: 1.2, fist: [262, 276], ha: 14, ahoge: 4 }), {}),
  kf({ ms: 100, face: 'protest', lean: 2.2, fist: [275, 252], ha: 10, headY: 0.5, ahoge: -3 }),
  Object.assign({}, loop[0], { ms: 100 }),
];
// end: hạ tay, về đứng gốc
prevLean = 2.4;
const end = [
  kf({ ms: 110, face: 'normal', lean: 1.6, fist: [272, 262], ha: 12, headR: 0.6 }),
  Object.assign(kf({ ms: 110, face: 'normal', lean: 0.6, fist: [258, 290], ha: 14, ahoge: -3 }), { swap: { hand_l: 'hold', hand_r: 'hold' } }),
  { ms: 130, face: 'normal', bones: IDLE.bones, swap: IDLE.swap },
];

module.exports = { action: 'knock', moods: { normal: { start, loop, end } } };
