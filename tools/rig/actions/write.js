// write — đứng, tay trái cầm tờ giấy note vàng trước ngực, tay phải cầm bút chì to viết; nét chữ hiện dần.
// start 3x130, loop 6x400 (nét 1..4 hiện dần, 2 khung cuối nhấc bút nhìn lại), end 3x130. Mood normal.
// Giấy + nét (bone chest) đi theo nhịp thở; bút (bone hand_r) đi theo bàn tay phải.
const idle = require('./idle.js');
const r1 = (v) => Math.round(v * 100) / 100;
const IDLE = idle.moods.normal.loop[0];
const L = { ua: 96, fa: 136, hand: 10 };                 // tay trái giữ mép giấy (như hold_note)
const R = { ua: 88, fa: 118, hand: 14 };                 // tay phải hạ thấp hơn, cầm bút chạm giấy
const PAPER = (y, op) => ({ id: 'work_paper', file: 'props/work_paper.svg', bone: 'chest', z: 105, y: y || 0, opacity: op === undefined ? 1 : op });
const INK = (n, op) => ({ id: 'work_ink' + n, file: 'props/work_ink' + n + '.svg', bone: 'chest', z: 106, opacity: op === undefined ? 1 : op });
const PEN = (x, y) => ({ id: 'work_pencil', file: 'props/work_pencil.svg', bone: 'hand_r', z: 200, x: x || 0, y: y || 0 });

function bones(o) {
  const k = o.k === undefined ? 1 : o.k, lag = o.hair || 0, w = o.wr || 0;   // w: lắc cổ tay khi viết
  return {
    hips: { y: r1(o.hipsY || 0) },
    chest: { sy: o.sy || 1, sx: o.sx || 1, r: o.chestR || 0 },
    head: { r: r1(o.headR || 0), x: r1(o.headX || 0), y: r1(o.headY || 0) },
    hair_back: { r: r1(-1.6 * lag) }, sidelock_l: { r: r1(2.2 * lag) }, sidelock_r: { r: r1(-2.2 * lag) },
    ahoge: { r: r1(o.ah || 0) }, ribbon: { r: r1(3 * lag) },
    upper_arm_r: { r: r1(-R.ua * k + (o.uaR || 0)) }, forearm_r: { r: r1(R.fa * k + (o.faR || 0)) }, hand_r: { r: r1(R.hand * k + w) },
    upper_arm_l: { r: r1(L.ua * k) }, forearm_l: { r: r1(-L.fa * k) }, hand_l: { r: r1(-L.hand * k) },
  };
}
const SW = { hand_l: 'hold', hand_r: 'fist' };

// Loop: khung i (0..5): số nét đang hiện = [1,2,2,3,4,4]; viết = khung 0..3, nhấc bút/ngước nhìn = 4,5
const INKS = [1, 2, 2, 3, 4, 4];
const FACE = ['normal', 'o', 'normal', 'o', 'normal', 'blink'];
const LOOP = [];
for (let i = 0; i < 6; i++) {
  const a = (2 * Math.PI * i) / 6, b = 0.5 - 0.5 * Math.cos(a), writing = i < 4;
  const look = i === 4;
  LOOP.push({
    ms: 400, face: FACE[i], swap: SW,
    bones: bones({
      sy: r1(1.01 - 0.02 * b), sx: r1(0.995 + 0.01 * b), chestR: r1(0.5 * Math.sin(a)),
      headR: look ? -2.5 : r1(2.5 + 1.2 * Math.sin(a)), headX: look ? 0.8 : r1(-0.8 + 0.6 * Math.sin(a)), headY: look ? 0 : 1.6,
      hair: Math.sin(a - 0.9), ah: r1(4 * Math.sin(a - 1.3)),
      wr: writing ? (i % 2 ? 6 : -4) : 4, faR: writing ? (i % 2 ? 3 : -3) : (look ? -12 : -5), uaR: look ? 4 : 0,
    }),
    show: [PAPER(r1(-0.5 * b))].concat(Array.from({ length: INKS[i] }, (_, j) => INK(j + 1, i === 5 ? 0.4 : (i < 4 && j === INKS[i] - 1 && i % 2 === 0 ? 0.65 : 1)))).concat([PEN(0, look ? -3 : 0)]),
  });
}
const L0 = LOOP[0];
const lerp = (A, B, t) => { const o = {}; for (const n of Object.keys(B)) { const a = A[n] || {}, b = B[n]; o[n] = {}; for (const k of ['r', 'x', 'y', 'sx', 'sy']) { const d = k === 'sx' || k === 'sy' ? 1 : 0; const va = a[k] == null ? d : a[k], vb = b[k] == null ? d : b[k]; if (va !== d || vb !== d || k === 'r') o[n][k] = r1(va + (vb - va) * t); } } return o; };

const start = [
  { ms: 130, face: 'normal', swap: { hand_l: 'open', hand_r: 'open' }, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.45), { hips: { y: -0.5 }, ahoge: { r: 4 }, hair_back: { r: 2.5 } }), show: [PAPER(14, 0.5)] },
  { ms: 130, face: 'normal', swap: SW, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.9), { hips: { y: -1.5 }, ahoge: { r: -5 }, hair_back: { r: -2 }, chest: { sy: 1.02 } }), show: [PAPER(4, 0.9), PEN(0, 0)] },
  { ms: 130, face: 'o', swap: SW, bones: L0.bones, show: [PAPER(0), INK(1, 0.5), PEN(0, 0)] },
];
const end = [
  { ms: 130, face: 'happy', swap: SW, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.6), { hips: { y: -1 }, ahoge: { r: 5 }, chest: { sy: 1.01 } }), show: [PAPER(6, 0.8), INK(1), INK(2), INK(3), INK(4), PEN(0, 0)] },
  { ms: 130, face: 'happy', swap: { hand_l: 'open', hand_r: 'open' }, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.2), { hips: { y: 0 }, ahoge: { r: -4 } }), show: [PAPER(16, 0.25), INK(1, 0.25), INK(2, 0.25), INK(3, 0.25), INK(4, 0.25)] },
  { ms: 130, face: 'normal', bones: IDLE.bones, swap: IDLE.swap, hide: ['work_paper', 'work_pencil', 'work_ink1', 'work_ink2', 'work_ink3', 'work_ink4'] },
];
module.exports = { action: 'write', moods: { normal: { start, loop: LOOP, end } } };
