// peek_left / peek_right — nấp sau mép màn hình, ló đầu + nửa người, tay bám mép.
// peek_left: mép là x=0 (thân dịch sang trái, tay trái bám mép, đầu nghiêng ra phía phải).
// peek_right: đối xứng qua x=200 (mép x=400, tay phải bám mép). Một bộ sinh khung dùng chung: make('left'|'right').
// start 3×130 (tay bám mép trước, trượt vào, ló đầu) · loop 4 khung (1000 ms: nhìn, chớp, nghiêng đầu, gõ ngón) · end 3×130 (rụt lại sau mép).
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
const rot = (v, d) => { const a = d * Math.PI / 180; return [v[0]*Math.cos(a)-v[1]*Math.sin(a), v[0]*Math.sin(a)+v[1]*Math.cos(a)]; };

// IK 2 đoạn (vai S, khuỷu E0, cổ tay W0 ở tư thế gốc) tới đích T trong hệ xương chest; trả {a (xương trên), b (cẳng)}.
function ik(S, E0, W0, Tg) {
  const u0 = [E0[0]-S[0], E0[1]-S[1]], f0 = [W0[0]-E0[0], W0[1]-E0[1]];
  const u = Math.hypot(u0[0], u0[1]), f = Math.hypot(f0[0], f0[1]);
  let v = [Tg[0]-S[0], Tg[1]-S[1]];
  let d = Math.hypot(v[0], v[1]);
  d = Math.min(Math.max(d, Math.abs(u - f) + 1), u + f - 0.5);
  const base = ang(v);
  const A = Math.acos((u*u + d*d - f*f) / (2*u*d)) * 180 / Math.PI;
  let best = null;
  for (const sg of [-1, 1]) {
    const phi = base + sg * A;
    const E = [S[0] + u*Math.cos(phi*Math.PI/180), S[1] + u*Math.sin(phi*Math.PI/180)];
    if (!best || E[1] > best.E[1]) best = { phi, E };   // khuỷu chúc xuống (tự nhiên)
  }
  const a = best.phi - ang(u0);
  const psi = ang([Tg[0]-best.E[0], Tg[1]-best.E[1]]);
  const b = psi - ang(f0) - a;
  const wrap = (x) => { while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
  return { a: wrap(a), b: wrap(b) };
}

const ARM = {
  l: { S: [164,244], E: [156,278], W: [152,306] },
  r: { S: [236,244], E: [244,278], W: [248,306] },
};

function make(side) {
  const L = side === 'left';
  const sg = L ? 1 : -1;                    // +1: nghiêng/đầu quay theo chiều kim đồng hồ khi ở mép trái
  const grip = L ? 'l' : 'r', free = L ? 'r' : 'l';
  const EDGE = L ? 1 : 399;                 // x tâm cổ tay bám mép
  // o: {ms, face, gx (dịch ngang cả người), lean, headR, headX, headY, gy (y bám), tap (xoay bàn tay), t (0..1 nhịp, cho tóc/ahoge), w (đủ lớp bám 0..1)}
  function frame(o) {
    const hips = { x: r2(o.hipsX || 0), y: r2(o.hipsY || 0) };
    const chest = { r: r2(sg * o.lean), sy: r2(o.chestSy || 1) };
    const Mc = mul(boneM([200, 306], hips), boneM([200, 300], chest));
    const worldT = [EDGE, o.gy];
    const loc = ap(inv(Mc), [worldT[0] - o.gx, worldT[1]]);
    const A = ARM[grip];
    const k = ik(A.S, A.E, A.W, loc);
    const lag = o.lag || 0;
    const bones = {
      hips, chest,
      head: { r: r2(sg * o.headR), x: r2(sg * o.headX || 0), y: r2(o.headY || 0) },
      hair_back: { r: r2(-sg * 1.6 * lag - sg * o.headR * 0.25) },
      sidelock_l: { r: r2(2.2 * lag) }, sidelock_r: { r: r2(-2.2 * lag) },
      ahoge: { r: r2(o.ahoge || 0) }, ribbon: { r: r2(sg * 3 * lag) },
      ['upper_arm_' + grip]: { r: r2(k.a) },
      ['forearm_' + grip]: { r: r2(k.b) },
      ['hand_' + grip]: { r: r2(o.tap || 0) },
      // tay còn lại: áp lên ngực, ngại ngùng
      ['upper_arm_' + free]: { r: r2(sg * 22) }, ['forearm_' + free]: { r: r2(sg * 62) }, ['hand_' + free]: { r: r2(-sg * 10) },
    };
    return { ms: o.ms, face: o.face, global: { x: r2(o.gx), y: r2(o.gy0 || 0) }, bones,
      swap: { hand_l: 'fist', hand_r: 'fist' } };
  }
  const G = L ? -158 : 146;                  // dịch ngang trong loop
  const base = { gx: G, lean: 6, headR: 9, headX: 2, headY: 0, gy: 232, tap: 0, lag: 0, ahoge: 0 };

  // loop: nhìn tò mò / chớp / nghiêng đầu thêm + gõ ngón / về
  const loopSpec = [
    { ms: 420, face: 'normal', headR: 8, headX: 3, tap: 0, lag: 0.3, ahoge: -4 },
    { ms: 90,  face: 'blink',  headR: 9, headX: 3.5, tap: 6, lag: 0.9, ahoge: 1 },
    { ms: 400, face: 'normal', headR: 11, headX: 5, lean: 6, tap: 0, lag: 0.5, ahoge: 6 },
    { ms: 90,  face: 'o',      headR: 9, headX: 3.5, tap: -6, lag: -0.5, ahoge: 3 },
  ];
  const loop = loopSpec.map((s) => frame({ ...base, ...s, hipsY: 0 }));
  // start: tay bám mép trước → trượt vào → ló đầu (khung cuối = khung 1 loop)
  const sx = L ? -1 : 1;
  const start = [
    frame({ ...base, ms: 130, face: 'o', gx: G + sx * -1 * -92, lean: 12, headR: 3, headX: -4, tap: 0, lag: -1, ahoge: 8, gy: 244 }),
    frame({ ...base, ms: 130, face: 'o', gx: G + sx * -1 * -42, lean: 9, headR: 6, headX: 0, tap: -4, lag: 1.2, ahoge: -6, gy: 240 }),
    frame({ ...base, ...loopSpec[0], ms: 130, hipsY: 0 }),
  ];
  const end = [
    frame({ ...base, ms: 130, face: 'shy', gx: G + sx * -1 * -30, lean: 8, headR: 6, headX: 2, tap: 0, lag: 1, ahoge: -5, gy: 238 }),
    frame({ ...base, ms: 130, face: 'shy', gx: G + sx * -1 * -78, lean: 11, headR: 3, headX: -3, tap: 0, lag: -1, ahoge: 6, gy: 242 }),
    frame({ ...base, ms: 130, face: 'shy', gx: G + sx * -1 * -128, lean: 14, headR: 0, headX: -6, tap: 0, lag: 0.6, ahoge: -3, gy: 246 }),
  ];
  return { action: L ? 'peek_left' : 'peek_right', moods: { normal: { start, loop, end } } };
}

const out = make('left');
Object.defineProperty(out, 'make', { value: make, enumerable: false });
module.exports = out;
