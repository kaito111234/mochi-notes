// hold_note — start 3×130, loop 4×400, end 3×130. Mood normal.
// Hai tay kẹp hai mép tờ note (app tự vẽ note ~80×80 tâm [200,262]).
// Đo bằng dựng thật (không phải FK thuần): tâm bàn tay trái/phải ≈ (156.5,267)/(242.5,267). Tay được bù trừ theo chuyển động hips/chest
// để vị trí bàn tay đứng yên TUYỆT ĐỐI trong loop.
const idle = require('./idle.js');
const r2 = (v) => Math.round(v * 100) / 100;

// --- ma trận 2D [a,b,c,d,e,f] ---
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const Rm = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const Sm = (x, y) => [x, 0, 0, y, 0, 0];
function boneM(P, b) {
  b = b || {};
  return mul(mul(mul(T(P[0] + (b.x || 0), P[1] + (b.y || 0)), Rm(b.r || 0)), Sm(b.sx == null ? 1 : b.sx, b.sy == null ? 1 : b.sy)), T(-P[0], -P[1]));
}
const inv = (m) => { const det = m[0]*m[3]-m[1]*m[2]; const a = m[3]/det, b = -m[1]/det, c = -m[2]/det, d = m[0]/det;
  return [a, b, c, d, -(a*m[4]+c*m[5]), -(b*m[4]+d*m[5])]; };
const ap = (m, p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];

// tư thế tay giơ giữ note (tâm bàn tay ~ (240,268) / (160,268))
const HOLD = { ua: 96, fa: 136, hand: 10 };
const TARGET = { l: [156.5, 267], r: [242.5, 267] };

function frame(o) {
  // o: {ms, face, hipsY, chestSy, chestSx, chestR, headR, headX, headY, hair, ahoge, ribbon, arm (0..1), swapHold}
  const hips = { y: o.hipsY || 0, x: o.hipsX || 0 };
  const chest = { sy: o.chestSy || 1, sx: o.chestSx || 1, r: o.chestR || 0 };
  const Mc = mul(boneM([200, 306], hips), boneM([200, 300], chest));
  const Mi = inv(Mc);
  const k = o.arm;
  const bones = {
    hips, chest,
    head: { r: r2(o.headR || 0), x: r2(o.headX || 0), y: r2(o.headY || 0) },
    hair_back: { r: r2(o.hair * -1.6) }, sidelock_l: { r: r2(o.hair * 2.2) }, sidelock_r: { r: r2(o.hair * -2.2) },
    ahoge: { r: r2(o.ahoge || 0) }, ribbon: { r: r2(o.ribbon || 0) },
    upper_arm_r: { r: r2(o.uaR), }, forearm_r: { r: r2(o.faR) },
    upper_arm_l: { r: r2(-o.uaR) }, forearm_l: { r: r2(-o.faR) },
    hand_r: { r: r2(o.handR || 0) }, hand_l: { r: r2(-(o.handR || 0)) },
  };
  if (o.comp) { // bù để bàn tay đứng yên trong thế giới
    for (const s of ['l', 'r']) {
      const q = TARGET[s];
      const w = ap(Mi, q);
      bones['upper_arm_' + s].x = r2(w[0] - q[0]);
      bones['upper_arm_' + s].y = r2(w[1] - q[1]);
    }
  }
  return { ms: o.ms, face: o.face, bones, swap: { hand_l: 'hold', hand_r: 'hold' } };
}

// khung loop
const FACES = ['talk', 'normal', 'blink', 'normal'];
const LOOP = [];
for (let i = 0; i < 4; i++) {
  const a = (2 * Math.PI * i) / 4;
  const lag = Math.sin(a - 0.9);
  const breath = 0.5 - 0.5 * Math.cos(a);          // 0..1, đỉnh ở khung 3
  LOOP.push(frame({
    ms: 400, face: FACES[i], comp: true,
    uaR: -HOLD.ua, faR: HOLD.fa, handR: HOLD.hand,
    hipsY: r2(-1 + 0.8 * Math.cos(a) * -0 - 0.5 * (i % 2)),   // nhón nhẹ: -1 / -1.5
    chestSy: r2(1.012 - 0.024 * breath), chestSx: r2(0.994 + 0.012 * breath), chestR: r2(0.7 * Math.sin(a)),
    headR: r2(1.4 * Math.sin(a - 0.4)), headY: r2(0.6 * breath), headX: r2(0.6 * Math.sin(a)),
    hair: lag, ahoge: r2(5 * Math.sin(a - 1.3)), ribbon: r2(3 * Math.sin(a - 1.6)),
  }));
}
const L0 = LOOP[0];

// tư thế đứng gốc (lấy từ idle normal khung 1)
const IDLE = idle.moods.normal.loop[0];

// nội suy xương giữa hai khung
function lerpBones(A, B, t) {
  const out = {};
  const names = new Set([...Object.keys(A), ...Object.keys(B)]);
  const dflt = { sx: 1, sy: 1 };
  for (const n of names) {
    const a = A[n] || {}, b = B[n] || {}, o = {};
    for (const key of ['r', 'x', 'y', 'sx', 'sy']) {
      const va = a[key] == null ? (dflt[key] == null ? 0 : dflt[key]) : a[key];
      const vb = b[key] == null ? (dflt[key] == null ? 0 : dflt[key]) : b[key];
      if (va !== 0 || vb !== 0 || key === 'r') o[key] = r2(va + (vb - va) * t);
    }
    out[n] = o;
  }
  return out;
}
const mk = (ms, face, A, B, t, extra) => {
  const bones = lerpBones(A.bones, B.bones, t);
  if (extra) for (const n in extra) bones[n] = Object.assign({}, bones[n], extra[n]);
  return { ms, face, bones, swap: { hand_l: 'hold', hand_r: 'hold' } };
};

// start: thả xuống -> giơ lên (nhón), tới tư thế khung 1 loop
const start = [
  mk(130, 'normal', IDLE, L0, 0.42, { hips: { y: -0.5 }, hair_back: { r: 2.5 }, sidelock_l: { r: -3 }, sidelock_r: { r: 3 }, ahoge: { r: 4 } }),
  mk(130, 'talk', IDLE, L0, 0.85, { hips: { y: -2 }, hair_back: { r: -2.2 }, sidelock_l: { r: 3 }, sidelock_r: { r: -3 }, ahoge: { r: -5 }, chest: { sy: 1.025, sx: 0.985 } }),
  Object.assign({}, L0, { ms: 130, face: 'talk' }),
];
// end: hạ tay, mặt happy, về đứng gốc
const LL = LOOP[3];
const end = [
  mk(130, 'happy', IDLE, LL, 0.5, { hips: { y: -1 }, chest: { sy: 1.01 }, hair_back: { r: 2 }, sidelock_l: { r: -2.5 }, sidelock_r: { r: 2.5 }, ahoge: { r: 5 } }),
  mk(130, 'happy', IDLE, LL, 0.14, { hips: { y: 0 }, hair_back: { r: -1.5 }, sidelock_l: { r: 2 }, sidelock_r: { r: -2 }, ahoge: { r: -4 } }),
  { ms: 130, face: 'normal', bones: IDLE.bones, swap: IDLE.swap },
];

module.exports = { action: 'hold_note', moods: { normal: { start, loop: LOOP, end } } };
