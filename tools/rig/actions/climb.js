// climb — leo mép PHẢI màn hình. Loop 6 khung × 110 ms, mood normal.
// Mép/điểm bám: đường thẳng đứng x = GRIP_X (=272) trên canvas 400; tay phải bám cao (y 150–205), tay trái bám thấp (y 235–285), luân phiên.
// Thân nghiêng sang phải (hướng mép), chân luân phiên gác lên mép (đầu gối nâng ra phía phải). Không đứng đất: core tự di chuyển cửa sổ theo y.
const r2 = (v) => Math.round(v * 100) / 100;
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const Rm = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const boneM = (P, b) => mul(mul(T(P[0] + (b.x || 0), P[1] + (b.y || 0)), Rm(b.r || 0)), T(-P[0], -P[1]));
const inv = (m) => { const det = m[0]*m[3]-m[1]*m[2]; const a = m[3]/det, b = -m[1]/det, c = -m[2]/det, d = m[0]/det;
  return [a, b, c, d, -(a*m[4]+c*m[5]), -(b*m[4]+d*m[5])]; };
const ap = (m, p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
const ang = (v) => Math.atan2(v[1], v[0]) * 180 / Math.PI;
const wrap = (x) => { while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
function ik(S, E0, W0, Tg, elbowUp) {
  const u0 = [E0[0]-S[0], E0[1]-S[1]], f0 = [W0[0]-E0[0], W0[1]-E0[1]];
  const u = Math.hypot(...u0), f = Math.hypot(...f0);
  const v = [Tg[0]-S[0], Tg[1]-S[1]];
  const d = Math.min(Math.max(Math.hypot(...v), Math.abs(u-f)+1), u+f-0.5);
  const A = Math.acos((u*u + d*d - f*f) / (2*u*d)) * 180 / Math.PI;
  let best = null;
  for (const sg of [-1, 1]) {
    const phi = ang(v) + sg * A;
    const E = [S[0] + u*Math.cos(phi*Math.PI/180), S[1] + u*Math.sin(phi*Math.PI/180)];
    const score = elbowUp ? -E[1] : E[1];
    if (!best || score > best.score) best = { phi, E, score };
  }
  const a = best.phi - ang(u0);
  return { a: wrap(a), b: wrap(ang([Tg[0]-best.E[0], Tg[1]-best.E[1]]) - ang(f0) - a) };
}
const GRIP_X = 300;
const N = 6, MS = 110;
const loop = [];
for (let i = 0; i < N; i++) {
  const a = (2 * Math.PI * i) / N;
  const s = Math.sin(a), c = Math.cos(a);
  const lag = Math.sin(a - 0.9);
  const gx = r2(-6 - 2 * c), gy = r2(-6 * Math.abs(s));
  const hips = { x: r2(8 + 2 * c), y: r2(-2.2 * Math.abs(s) + 1) };
  const chest = { r: r2(13 + 2 * s), sx: r2(0.92), sy: r2(1.0) };
  const Mc = mul(boneM([200, 306], hips), boneM([200, 300], chest));
  // tay phải (cao) và tay trái (thấp) luân phiên: một tay kéo lên, tay kia đang chuyển
  const yr = 214 - 26 * s;                 // 156..208
  const yl = 266 + 20 * s;                 // 282..234 (ngược pha)
  const kR = ik([236,244], [244,278], [248,306], ap(inv(Mc), [GRIP_X - gx, yr - gy]), false);
  const kL = ik([164,244], [156,278], [152,306], ap(inv(Mc), [GRIP_X - 46 - gx, yl - gy]), false);
  // chân luân phiên gác lên mép: chân phải nâng khi s>0, chân trái khi s<0
  const liftR = Math.max(0, s), liftL = Math.max(0, -s);
  const bones = {
    hips, chest,
    head: { r: r2(5 - 2 * s), x: r2(3), y: r2(0.6 * c) },
    hair_back: { r: r2(-3 * lag) }, sidelock_l: { r: r2(3 * lag) }, sidelock_r: { r: r2(-3.5 * lag) },
    ahoge: { r: r2(-7 * lag) }, ribbon: { r: r2(-4 * lag) },
    upper_arm_r: { r: r2(kR.a) }, forearm_r: { r: r2(kR.b) }, hand_r: { r: r2(-8 + 4 * s) },
    upper_arm_l: { r: r2(kL.a) }, forearm_l: { r: r2(kL.b) }, hand_l: { r: r2(10 - 4 * s) },
    thigh_r: { r: r2(-38 * liftR) }, shin_r: { r: r2(62 * liftR) },
    thigh_l: { r: r2(-14 * (1 - liftL)) , }, shin_l: { r: r2(26 * liftL) },
  };
  bones.thigh_l = { r: r2(-8 - 30 * liftL) };
  bones.shin_l = { r: r2(52 * liftL) };
  bones.thigh_r = { r: r2(-8 - 30 * liftR) };
  bones.shin_r = { r: r2(52 * liftR) };
  loop.push({ ms: MS, face: i === 3 ? 'blink' : 'normal', bones, swap: { hand_l: 'fist', hand_r: 'fist' },
    global: { x: gx, y: gy }, z: { upper_arm_r: 186, forearm_r: 187, hand_r: 188 } });
}
module.exports = { action: 'climb', moods: { normal: { loop } } };
