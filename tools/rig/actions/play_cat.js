// play_cat — start 4×140, loop 6×(160|130), end 3×150. Moods: normal, happy.
// Bé ôm mèo bông (props/cat_plush.svg, thu nhỏ 0.8) bằng hai tay (hand_*.grip), nâng lên hạ xuống, lắc lư, tim.
// Tay đặt bằng IK 2 khớp (tính trong tư thế gốc); mochi gắn xương chest nên đi cùng tay rigid.
const r1 = (v) => Math.round(v * 100) / 100;
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const Rm = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const bm = (P, r) => mul(mul(T(P[0], P[1]), Rm(r)), T(-P[0], -P[1]));
const ap = (m, p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
const SH = [236, 244], EL = [244, 278], WR = [248, 306], D = 14;       // tay phải (xương r); trái đối xứng
const handAt = (ua, fa) => ap(mul(bm(SH, ua), bm(EL, fa)), [WR[0], WR[1] + D]);
const elbowAt = (ua) => ap(bm(SH, ua), EL);
const ikCache = {};
function ik(tx, ty) {          // trả {ua, fa, p}
  const key = tx + ',' + ty; if (ikCache[key]) return ikCache[key];
  let best = null;
  for (let ua = -120; ua <= 60; ua += 1) for (let fa = 60; fa <= 175; fa += 1) {
    const p = handAt(ua, fa), e = elbowAt(ua);
    const sc = Math.hypot(p[0]-tx, p[1]-ty) * 3 + (e[1] < ty + 4 ? 30 : 0) + Math.abs(ua + 50) * 0.04;
    if (!best || sc < best.sc) best = { sc, ua, fa, p };
  }
  return (ikCache[key] = best);
}
const DX = 40;                 // bàn tay cách tâm mèo 40 px (mép mèo ~38)
const CAT = [200, 300];        // tâm mèo trong props/cat_plush.svg
function hold(cy) {
  const b = ik(200 + DX, cy);
  return { ua: b.ua, fa: b.fa, h: Math.max(-70, Math.min(70, 90 - (b.ua + b.fa))), py: b.p[1] };
}
const IDLE = { ua: 14, fa: 24, h: 0 };
const lerp = (a, b, t) => a + (b - a) * t;
const IDLEB = {
  hips: { x: 0, y: 0 }, chest: { sy: 1, sx: 1, r: 0 }, head: { r: 0, x: 0, y: 0 },
  hair_back: { r: 0 }, sidelock_l: { r: 0 }, sidelock_r: { r: 0 }, ahoge: { r: 0 }, ribbon: { r: 0 },
  upper_arm_r: { r: 14 }, forearm_r: { r: 24 }, hand_r: { r: 0 }, upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, hand_l: { r: 0 },
};
try { const idle = require('./idle.js'); Object.assign(IDLEB, idle.moods.normal.loop[0].bones); } catch (e) { /* mặc định */ }

// o: {ms, face, cy (tâm mèo), s (tỉ lệ mèo), mix, head, hipsX/Y, chestR/Sy, lag, ahoge, fx, hideFx, noCat}
function frame(o) {
  const lag = o.lag || 0, s = o.s || 0.8;
  const hd = hold(o.handCy != null ? o.handCy : o.cy);
  let A = { ua: hd.ua, fa: hd.fa, h: hd.h };
  if (o.mix != null) A = { ua: lerp(IDLE.ua, A.ua, o.mix), fa: lerp(IDLE.fa, A.fa, o.mix), h: lerp(IDLE.h, A.h, o.mix) };
  const sw = o.handSwap || 'grip';
  const bones = {
    hips: { x: r1(o.hipsX || 0), y: r1(o.hipsY || 0) },
    chest: { sy: r1(o.chestSy || 1), sx: r1(o.chestSx || 1), r: r1(o.chestR || 0) },
    head: { r: r1((o.head && o.head.r) || 0), x: r1((o.head && o.head.x) || 0), y: r1((o.head && o.head.y) || 0) },
    hair_back: { r: r1(-1.6 * lag) }, sidelock_l: { r: r1(2.4 * lag) }, sidelock_r: { r: r1(-2.4 * lag) },
    ahoge: { r: r1((o.ahoge || 0) + 5 * lag) }, ribbon: { r: r1(-3 * lag) },
    upper_arm_r: { r: r1(A.ua) }, forearm_r: { r: r1(A.fa) }, hand_r: { r: r1(A.h) },
    upper_arm_l: { r: r1(-A.ua) }, forearm_l: { r: r1(-A.fa) }, hand_l: { r: r1(-A.h) },
  };
  const f = { ms: o.ms, face: o.face, bones, swap: { hand_l: sw, hand_r: sw }, z: { hand_l: 205, hand_r: 205 }, show: [], hide: [] };
  if (o.noCat) f.hide.push('pc_cat');
  else f.show.push({ id: 'pc_cat', file: 'props/cat_plush.svg', bone: 'chest', z: 200, x: r1(CAT[0] * (1 - s)), y: r1(o.cy - CAT[1] * s), s });
  for (const fx of (o.fx || [])) f.show.push(fx);
  for (const h of (o.hideFx || [])) f.hide.push(h);
  return f;
}
const HEARTS = { id: 'fx_hearts', file: 'fx/hearts.svg', bone: 'head', z: 211 };
const BLUSH = { id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 };
const SPARK = (n) => ({ id: 'fx_sparkle', file: n ? 'fx/sparkle2.svg' : 'fx/sparkle.svg', bone: 'head', z: 210 });
const ALLFX = ['fx_hearts', 'fx_blush', 'fx_sparkle'];

function mood(c) {
  const N = 6;
  const loop = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    const lift = (1 - Math.cos(a)) / 2;          // 0..1, đỉnh ở khung 4
    const lag = Math.sin(a - 0.9);
    const showHeart = c.heartIdx.includes(i);
    loop.push(frame({
      ms: c.ms, face: c.faces[i], cy: r1(279 - c.lift * lift),
      hipsX: r1(c.sway * Math.sin(a)), hipsY: r1(-0.6 - 0.9 * lift), chestR: r1(c.sway * 1.3 * Math.sin(a)),
      chestSy: r1(1 + 0.012 * (lift - 0.5)),
      head: { r: r1(-c.sway * 1.6 * Math.sin(a) + 1.5), x: r1(0.6 * Math.sin(a)), y: r1(0.8 * (1 - lift)) },
      lag, ahoge: r1(3 * Math.sin(a - 1.3)),
      fx: showHeart ? [HEARTS].concat(c.blush ? [BLUSH] : []) : [], hideFx: showHeart ? [] : ['fx_hearts', 'fx_blush'],
    }));
  }
  const start = [
    frame({ ms: 140, face: 'surprised', cy: 336, s: 0.7, handCy: 322, mix: 0.45, head: { r: 0, y: -1 }, chestSy: 1.01, lag: 0.5, ahoge: 5, fx: [SPARK(0)] }),
    frame({ ms: 140, face: 'excited', cy: 322, s: 0.78, handCy: 322, mix: 0.9, head: { r: 2, y: 0.5 }, chestSy: 1.0, hipsY: -0.4, lag: -0.4, ahoge: -4, fx: [SPARK(1)] }),
    frame({ ms: 140, face: 'happy', cy: 296, head: { r: 0, y: 0.5 }, hipsY: -1, chestSy: 1.01, lag: -0.9, ahoge: -3, hideFx: ['fx_sparkle'] }),
  ];
  start.push(Object.assign({}, loop[0], { ms: 140 }));
  const end = [
    frame({ ms: 150, face: c.endFace, cy: 296, head: { r: 1.5, y: 0.5 }, hipsY: -0.8, chestSy: 1.005, lag: 0.4, hideFx: ['fx_hearts', 'fx_blush'] }),
    frame({ ms: 150, face: 'happy', cy: 330, s: 0.74, handCy: 322, mix: 0.8, head: { r: 0, y: 0 }, chestSy: 1, lag: -0.3, hideFx: ALLFX }),
    { ms: 150, face: 'happy', bones: IDLEB, swap: { hand_l: 'hold', hand_r: 'hold' }, hide: ALLFX.concat(['pc_cat']) },
  ];
  return { start, loop, end };
}

module.exports = {
  action: 'play_cat',
  moods: {
    normal: mood({ ms: 160, lift: 9, sway: 1.3, faces: ['love', 'love', 'closed_happy', 'closed_happy', 'love', 'love'], heartIdx: [2, 3], blush: false, endFace: 'closed_happy' }),
    happy: mood({ ms: 130, lift: 13, sway: 2.2, faces: ['love', 'closed_happy', 'love', 'closed_happy', 'love', 'closed_happy'], heartIdx: [1, 2, 3, 4], blush: true, endFace: 'laugh' }),
  },
};
