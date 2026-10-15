// eat — start 4×150, loop 6×(400|300), end 3×170. Moods: normal, happy.
// Bé cầm bánh mochi (props/eat_*.svg) bằng hai tay (hand_*.grip), cắn, nhai má phồng, nuốt, ngắm.
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
const DX = 29;                 // hai bàn tay cách tâm 29 px
const MID = 256;               // tâm mochi ở tư thế gốc (props/eat_*.svg)
// tư thế giữ mochi: cy = độ cao tâm mong muốn
function hold(cy) {
  const b = ik(200 + DX, cy + 3);
  const ua = b.ua, fa = b.fa;
  const h = Math.max(-70, Math.min(70, 90 - (ua + fa)));
  return { ua, fa, h, py: b.p[1] - 3 };
}

const IDLE = { ua: 14, fa: 24, h: 0 };
const lerp = (a, b, t) => a + (b - a) * t;

// o: {ms, face, cy|arms, prop, propS, head:{r,x,y,sx,sy}, hips, chest, lag, ...}
function frame(o) {
  const lag = o.lag || 0;
  let A;
  if (o.cy != null) { const hd = hold(o.cy); A = { ua: hd.ua, fa: hd.fa, h: hd.h, py: hd.py }; }
  else A = o.arm;
  if (o.mix != null) A = { ua: lerp(IDLE.ua, A.ua, o.mix), fa: lerp(IDLE.fa, A.fa, o.mix), h: lerp(IDLE.h, A.h, o.mix), py: A.py };
  const swapName = o.handSwap || 'grip';
  const bones = {
    hips: { x: r1(o.hipsX || 0), y: r1(o.hipsY || 0) },
    chest: { sy: r1(o.chestSy || 1), sx: r1(o.chestSx || 1), r: r1(o.chestR || 0) },
    head: { r: r1((o.head && o.head.r) || 0), x: r1((o.head && o.head.x) || 0), y: r1((o.head && o.head.y) || 0),
      sx: (o.head && o.head.sx) || 1, sy: (o.head && o.head.sy) || 1 },
    hair_back: { r: r1(-1.6 * lag + (o.hairR || 0)) }, sidelock_l: { r: r1(2.4 * lag) }, sidelock_r: { r: r1(-2.4 * lag) },
    ahoge: { r: r1((o.ahoge || 0) + 5 * lag) }, ribbon: { r: r1(-3 * lag + (o.ribbon || 0)) },
    upper_arm_r: { r: r1(A.ua) }, forearm_r: { r: r1(A.fa) }, hand_r: { r: r1(A.h) },
    upper_arm_l: { r: r1(-A.ua) }, forearm_l: { r: r1(-A.fa) }, hand_l: { r: r1(-A.h) },
  };
  if (o.rArm) { bones.upper_arm_r.r = r1(o.rArm.ua); bones.forearm_r.r = r1(o.rArm.fa); bones.hand_r.r = r1(o.rArm.h); }
  const f = { ms: o.ms, face: o.face, bones, swap: { hand_l: swapName, hand_r: swapName }, show: [], hide: [] };
  if (o.rArmUp) f.z = { hand_r: 215, hand_l: 205 }; else f.z = { hand_l: 205, hand_r: 205 };
  // mochi
  const dy = r1(A.py - MID + 1);
  const ids = ['eat_prop'];
  if (o.prop) f.show.push({ id: 'eat_prop', file: 'props/' + o.prop + '.svg', bone: 'chest', z: 200, x: r1(200 * (1 - (o.propS || 1))), y: r1(dy + (o.propDy || 0) + (251 + dy) * (1 - (o.propS || 1))), s: o.propS || 1 });
  else f.hide.push('eat_prop');
  for (const fx of (o.fx || [])) f.show.push(fx);
  for (const h of (o.hideFx || [])) f.hide.push(h);
  return f;
}
const CRUMBS = (n) => ({ id: 'fx_crumbs', file: n % 2 ? 'fx/eat_crumbs.svg' : 'fx/eat_crumbs2.svg', bone: 'chest', z: 206 });
const NOTE = { id: 'fx_note', file: 'fx/notes_music.svg', bone: 'none', z: 210 };
const HEARTS = { id: 'fx_hearts', file: 'fx/hearts.svg', bone: 'head', z: 211 };
const BLUSH = { id: 'fx_blush', file: 'fx/blush_lines.svg', bone: 'head', z: 212 };
const PUFF = { id: 'fx_puff', file: 'fx/eat_puff.svg', bone: 'head', z: 150 };
const ALLFX = ['fx_crumbs', 'fx_note', 'fx_hearts', 'fx_blush', 'fx_puff'];

function mood(c) {
  const N = 6, ms = c.ms;
  // nhịp: 0 nhai trái, 1 nhai phải, 2 nhai trái, 3 nuốt, 4 ngắm, 5 đưa lên miệng
  const spec = [
    { cy: 245, head: { r: -2.2, y: 3, x: -1, sx: 1.04, sy: 0.985 }, face: c.chew, fx: [PUFF, CRUMBS(1)], puff: 1, chestSy: 0.99 },
    { cy: 247, head: { r: 2.2, y: 3.5, x: 1, sx: 1.04, sy: 0.985 }, face: c.chew, fx: [PUFF], hideFx: ['fx_crumbs'], chestSy: 0.985 },
    { cy: 245, head: { r: -2.2, y: 3, x: -1, sx: 1.04, sy: 0.985 }, face: c.chew, fx: [PUFF, CRUMBS(2)].concat(c.hearts ? [HEARTS] : []), chestSy: 0.99 },
    { cy: 250, head: { r: 0, y: -1.5, x: 0, sx: 1, sy: 1.005 }, face: c.swallow, fx: [NOTE].concat(c.blush ? [BLUSH] : []), hideFx: ['fx_puff', 'fx_crumbs', 'fx_hearts'], chestSy: 1.012 },
    { cy: 256, head: { r: 2.5, y: 0.5, x: 0 }, face: c.look, fx: [], hideFx: ['fx_note', 'fx_blush'], chestSy: 1.01 },
    { cy: 246, head: { r: 0.5, y: 3, x: 0 }, face: 'talk', fx: [], chestSy: 0.995 },
  ];
  const loop = spec.map((s, i) => {
    const a = (2 * Math.PI * i) / N;
    const lag = Math.sin(a - 0.9);
    return frame({
      ms: Math.round(ms * (i === 3 ? 1.15 : 1)), face: s.face, cy: s.cy, prop: 'eat_bite1',
      head: s.head, hipsY: r1(-0.5 + 0.9 * (i % 2 === 0 ? 1 : 0) * (i < 3 ? 1 : 0)), chestSy: s.chestSy, chestR: r1(0.6 * Math.sin(a)),
      lag, ahoge: r1(2 * Math.sin(a - 1.3)), fx: s.fx, hideFx: s.hideFx,
    });
  });
  const L0 = spec[0];
  const start = [
    frame({ ms: 150, face: c.start1, mix: 0.6, cy: 262, prop: 'eat_mochi', propS: 0.6, head: { r: 0, y: -1, x: 0 }, chestSy: 1.012, lag: 0.5, ahoge: 5, fx: [], hideFx: ALLFX }),
    frame({ ms: 150, face: c.start1, cy: 255, prop: 'eat_mochi', head: { r: 2, y: 1, x: 0 }, chestSy: 0.99, lag: -0.5, ahoge: -5, hairR: 2,
      fx: [{ id: 'fx_sparkle', file: 'fx/sparkle.svg', bone: 'head', z: 210 }] }),
    frame({ ms: 150, face: 'happy', cy: 250, prop: 'eat_mochi', head: { r: -1.5, y: 2, x: 0 }, chestSy: 1.0, lag: -0.9, ahoge: -3,
      fx: [{ id: 'fx_sparkle', file: 'fx/sparkle2.svg', bone: 'head', z: 210 }] }),
    frame({ ms: 150, face: 'talk', cy: 245, prop: 'eat_mochi', head: { r: 0, y: 3.5, x: 0 }, chestSy: 0.99, lag: 0.2, ahoge: 2,
      fx: [], hideFx: ['fx_sparkle'] }),
  ];
  // khung 4 của start = khung cắn miếng đầu, cùng tư thế loop 1
  start[3] = Object.assign({}, loop[0], { ms: 150 });
  const LL = spec[5];
  const rise = hold(236);
  const end = [
    frame({ ms: 170, face: c.chew, cy: 246, prop: 'eat_bite3', head: { r: -2, y: 3, x: 0, sx: 1.04, sy: 0.985 }, chestSy: 0.99, lag: 0.4, fx: [PUFF, CRUMBS(1)], hideFx: ['fx_note', 'fx_blush'] }),
    // chùi miệng: tay phải lên mép, tay trái hạ
    frame({ ms: 170, face: c.swallow, arm: { ua: 14, fa: 24, h: 0, py: 262 }, rArm: Object.assign({}, ik(226, 222), { h: 20 }), rArmUp: true, handSwap: 'fist', prop: null,
      head: { r: 2, y: 0, x: 0, sx: 1.02 }, chestSy: 1.005, lag: -0.3, fx: [CRUMBS(2)].concat(c.hearts ? [HEARTS] : []), hideFx: ['fx_puff'] }),
    { ms: 170, face: c.endFace, bones: IDLEB, swap: { hand_l: 'hold', hand_r: 'hold' }, hide: ALLFX.concat(['eat_prop']) },
  ];
  return { start, loop, end };
}
// tư thế idle normal khung 1 (arm = ua14, fa24)
const IDLEB = {
  hips: { x: 0, y: 0 }, chest: { sy: 1, sx: 1, r: 0 }, head: { r: 0, x: 0, y: 0, sx: 1, sy: 1 },
  hair_back: { r: 0 }, sidelock_l: { r: 0 }, sidelock_r: { r: 0 }, ahoge: { r: 0 }, ribbon: { r: 0 },
  upper_arm_r: { r: 14 }, forearm_r: { r: 24 }, hand_r: { r: 0 }, upper_arm_l: { r: -14 }, forearm_l: { r: -24 }, hand_l: { r: 0 },
};
try { const idle = require('./idle.js'); Object.assign(IDLEB, idle.moods.normal.loop[0].bones); } catch (e) { /* giữ mặc định */ }

module.exports = {
  action: 'eat',
  moods: {
    normal: mood({ ms: 400, chew: 'blink', swallow: 'closed_happy', look: 'happy', start1: 'excited', endFace: 'happy', hearts: false, blush: false }),
    happy: mood({ ms: 300, chew: 'closed_happy', swallow: 'closed_happy', look: 'laugh', start1: 'excited', endFace: 'closed_happy', hearts: true, blush: true }),
  },
};
