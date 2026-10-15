// crumple — single 9 khung (90-150ms). Hai tay vo tờ note (clean_note -> clean_crumple1 -> clean_ball) thành cục giấy tròn.
// Bắt đầu = tư thế ôm note của carry_note/hold_note (khung 1), kết thúc = hai tay nâng cục giấy trước ngực
// (đúng tư thế khung 1 của throw). Đạo cụ gắn xương ngực; tay IK trong khung ngực nên luôn ép đúng vào giấy.
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

const Z = { upper_arm_l: 190, upper_arm_r: 190, forearm_l: 191, forearm_r: 191 };
const NOTE = 'props/clean_note.svg', CR = 'props/clean_crumple1.svg', BALL = 'props/clean_ball.svg';
let prevShake = 0;
// d: nửa khoảng cách giữa hai tâm bàn tay; yl/yr: độ cao tâm bàn tay trái/phải (khung ngực)
function kf(o) {
  const chest = { r: r2(o.sh || 0), sy: o.sy || 1, sx: o.sx || 1 };
  const bones = {
    hips: {}, chest,
    head: { r: r2(o.headR || 0), y: r2(o.headY || 0), x: r2(o.headX || 0) },
    hair_back: { r: r2(-1.5 * (o.sh || 0) + (o.lag || 0)) }, sidelock_l: { r: r2(2 * (o.lag || 0)) }, sidelock_r: { r: r2(-2 * (o.lag || 0)) },
    ahoge: { r: r2((o.ahoge || 0) - 2 * (o.sh || 0)) }, ribbon: { r: r2(-2 * (o.lag || 0)) },
  };
  if (o.hold) {
    Object.assign(bones, { upper_arm_r: { r: -96 }, forearm_r: { r: 136 }, hand_r: { r: 10 }, upper_arm_l: { r: 96 }, forearm_l: { r: -136 }, hand_l: { r: -10 } });
  } else {
    const ha = o.ha == null ? 10 : o.ha;
    const [ur, fr] = ik('r', [200 + o.d, o.yr], -96, 136, ha);
    const [ul, fl] = ik('l', [200 - o.d, o.yl], 96, -136, -ha);
    Object.assign(bones, { upper_arm_r: { r: ur }, forearm_r: { r: fr }, hand_r: { r: ha }, upper_arm_l: { r: ul }, forearm_l: { r: fl }, hand_l: { r: -ha } });
  }
  const sw = o.hold ? 'hold' : 'fist';
  return { ms: o.ms, face: o.face || 'normal', bones, swap: { hand_l: sw, hand_r: sw }, z: Z,
    show: [{ id: 'prop_clean', file: o.file, bone: 'chest', z: 109, x: o.px == null ? 200 : o.px, y: o.py == null ? 264 : o.py, s: o.s, r: o.pr || 0 }] };
}
const single = [
  kf({ ms: 120, face: 'normal', hold: true, file: NOTE, s: 1.08, pr: 0, lag: 0 }),
  kf({ ms: 90, face: 'protest', d: 38, yl: 266, yr: 266, file: NOTE, s: 1.0, pr: -3, sy: 0.99, headY: 1, lag: 1 }),
  kf({ ms: 90, face: 'protest', d: 30, yl: 261, yr: 270, file: NOTE, s: 0.88, pr: -12, sh: -1.5, sy: 0.99, headY: 1.5, headR: -1.5, lag: 2, ahoge: 4 }),
  kf({ ms: 90, face: 'protest', d: 29, yl: 270, yr: 260, file: CR, s: 1.05, pr: 14, sh: 1.5, sy: 0.985, headY: 2, headR: 1.5, lag: -2, ahoge: -4 }),
  kf({ ms: 90, face: 'protest', d: 26, yl: 262, yr: 270, file: CR, s: 0.82, pr: -10, sh: -1.8, sy: 0.985, headY: 2, headR: -1.5, lag: 2, ahoge: 4 }),
  kf({ ms: 90, face: 'protest', d: 25, yl: 268, yr: 262, file: BALL, s: 1.4, pr: 20, sh: 1.5, sy: 0.99, headY: 1.5, headR: 1, lag: -2, ahoge: -4 }),
  kf({ ms: 100, face: 'excited', d: 23, yl: 263, yr: 263, file: BALL, s: 1.15, pr: 40, sh: 0, sy: 1.005, headY: 0.5, lag: 0.5 }),
  kf({ ms: 110, face: 'happy', d: 22, yl: 261, yr: 261, file: BALL, s: 1.0, pr: 40, sy: 1.012, headY: -0.5, headR: 1.5, lag: 1.5, ahoge: 4 }),
  kf({ ms: 150, face: 'laugh', d: 22, yl: 261, yr: 261, file: BALL, s: 1.0, pr: 40, py: 262, sy: 1.012, headY: -0.3, headR: 2, lag: 0.5, ahoge: 2 }),
];

module.exports = { action: 'crumple', moods: { normal: { single } } };
