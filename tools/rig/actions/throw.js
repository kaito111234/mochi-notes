// throw — single 8 khung (70-120ms): ném cục giấy (props/clean_ball.svg) vòng cung sang PHẢI (+x), ném tay phải kiểu "ném qua vai".
// Khung 1 = tư thế cuối của crumple (hai tay nâng cục giấy trước ngực). Khung 5 = cục giấy RỜI TAY, khung 6-7 cục giấy bay
// (vẽ trên canvas, toạ độ cố định, bone:'canvas'), khung 8 không còn cục giấy. Core vẽ cục giấy bay tiếp từ vị trí khung 6/7.
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
const Z = { upper_arm_l: 190, upper_arm_r: 190, forearm_l: 191, forearm_r: 191, hand_l: 192, hand_r: 192 };
const BALL = 'props/clean_ball.svg';
const lerp = (a, b, t) => a + (b - a) * t;
const LH = { ua: 96, fa: -136, ha: -10 }, LI = { ua: IDLE.bones.upper_arm_l.r, fa: IDLE.bones.forearm_l.r, ha: IDLE.bones.hand_l.r };
const leftBlend = (t) => ({ ua: lerp(LH.ua, LI.ua, t), fa: lerp(LH.fa, LI.fa, t), ha: lerp(LH.ha, LI.ha, t) });

let prevLean = 0;
function kf(o) {
  const lean = o.lean || 0;
  const chest = { r: r2(lean), sy: o.sy || 1, sx: o.sx || 1 };
  const bones = {
    hips: {}, chest,
    head: { r: r2(o.headR || 0), y: r2(o.headY || 0), x: r2(o.headX || 0) },
  };
  const lag = prevLean - lean; prevLean = lean;
  Object.assign(bones, {
    hair_back: { r: r2(-1.2 * lean + 1.5 * lag) }, sidelock_l: { r: r2(2 * lag) }, sidelock_r: { r: r2(-0.8 * lean - 2 * lag) },
    ahoge: { r: r2(-3 * lean + 3 * lag + (o.ahoge || 0)) }, ribbon: { r: r2(-2.5 * lag) },
  });
  let ball = null;
  let rarm;
  const Mc = mul(boneM([200, 306], {}), boneM([200, 300], chest));
  if (o.hold) {
    rarm = { u: -96, f: 136, h: 10 };
    const [ur, fr] = ik('r', [200 + 22, 261], -96, 136, 10), [ul, fl] = ik('l', [200 - 22, 261], 96, -136, -10);
    Object.assign(bones, { upper_arm_r: { r: ur }, forearm_r: { r: fr }, hand_r: { r: 10 }, upper_arm_l: { r: ul }, forearm_l: { r: fl }, hand_l: { r: -10 } });
    ball = { id: 'prop_ball', file: BALL, bone: 'chest', z: 109, x: 200, y: 262, s: 1.0, r: 40 };
  } else {
    const t = ap(inv(Mc), o.hand);
    const ha = o.ha || 0;
    const [ur, fr] = ik('r', t, o.ua0 || -80, o.fa0 || 20, ha);
    rarm = { u: ur, f: fr, h: ha };
    const L = o.left;
    Object.assign(bones, { upper_arm_r: { r: ur }, forearm_r: { r: fr }, hand_r: { r: ha },
      upper_arm_l: { r: r2(L.ua) }, forearm_l: { r: r2(L.fa) }, hand_l: { r: r2(L.ha) } });
    if (o.ballInHand) ball = { id: 'prop_ball', file: BALL, bone: 'hand_r', z: o.openR ? 205 : 191.5, x: 250, y: o.openR ? 338 : 326, s: 1.0, r: o.ballR || 0 };
  }
  // vị trí thế giới của tâm cục giấy trong tay (để báo cáo / bay tiếp)
  const mU = boneM(SH.r, { r: rarm.u }), mF = mul(mU, boneM(EL.r, { r: rarm.f })), mH = mul(mF, boneM(WR.r, { r: rarm.h }));
  const wb = ap(mul(Mc, mH), [250, 326]);
  const swapR = o.hold ? 'hold' : (o.openR ? 'open' : 'fist');
  const swapL = o.hold ? 'hold' : (o.leftSwap || 'hold');
  const show = o.fly ? [{ id: 'prop_ball', file: BALL, bone: 'canvas', z: 205, x: o.fly[0], y: o.fly[1], s: o.fly[2] || 1, r: o.fly[3] || 0, opacity: o.fly[4] == null ? 1 : o.fly[4] }] : (ball ? [ball] : []);
  const fr = { ms: o.ms, face: o.face || 'normal', bones, swap: { hand_l: swapL, hand_r: swapR }, z: Z, show };
  fr._ball = wb.map(r2);
  return fr;
}
prevLean = 0;
const f = [];
f.push(kf({ ms: 90, face: 'excited', hold: true, sy: 1.012, headY: -0.3, headR: 2 }));
f.push(kf({ ms: 90, face: 'excited', hand: [262, 214], ballInHand: true, ballR: 20, lean: -3, left: leftBlend(0.55), leftSwap: 'hold', headR: -2, headY: 0.5, sy: 1.01, ahoge: 5, ua0: -120, fa0: 80 }));
f.push(kf({ ms: 80, face: 'protest', hand: [254, 168], ballInHand: true, ballR: 30, lean: -7, left: { ua: 52, fa: -14, ha: -6 }, leftSwap: 'fist', headR: -4, headY: 1.2, sy: 0.99, ahoge: 8, ua0: -150, fa0: 100 }));
f.push(kf({ ms: 70, face: 'excited', hand: [286, 178], ballInHand: true, ballR: 10, lean: 1.5, left: { ua: 30, fa: -30, ha: -6 }, leftSwap: 'fist', headR: 1, ahoge: -6, ua0: -135, fa0: 20 }));
const REL = f.length;
f.push(kf({ ms: 70, face: 'laugh', hand: [297, 184], ballInHand: true, ballR: -10, openR: true, lean: 7, left: { ua: 16, fa: -40, ha: -2 }, leftSwap: 'fist', headR: 3, headY: 0.8, sy: 0.99, ahoge: -10, ua0: -120, fa0: 10 }));
const P5 = f[REL]._ball;
f.push(kf({ ms: 80, face: 'laugh', hand: [292, 226], openR: true, lean: 6, left: { ua: 6, fa: -45, ha: 0 }, headR: 3, ahoge: -7, ua0: -100, fa0: 5,
  fly: [P5[0] + 34, P5[1] - 24, 1.0, 120] }));
f.push(kf({ ms: 80, face: 'happy', hand: [272, 268], lean: 3.5, left: { ua: LI.ua, fa: LI.fa, ha: LI.ha }, headR: 1.5, ahoge: 3, ua0: -60, fa0: -20,
  fly: [P5[0] + 34 + 28, P5[1] - 24 - 6, 0.95, 220, 0.55] }));
// khung cuối: về đúng tư thế đứng gốc (mặt happy)
f.push({ ms: 120, face: 'happy', bones: IDLE.bones, swap: IDLE.swap });
const single = f.map((x) => { delete x._ball; return x; });
if (process.env.THROW_DEBUG) console.log('release ball (khung ' + (REL + 1) + '):', P5);

module.exports = { action: 'throw', moods: { normal: { single } } };
