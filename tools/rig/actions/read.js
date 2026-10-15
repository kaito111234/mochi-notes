// read — đứng cầm sách mở bằng hai tay trước ngực, đọc, lật trang. start 3x130, loop 6x450, end 3x130. Mood normal.
// Sách (bone chest, z 105: trên tay áo, dưới bàn tay) nên đi theo nhịp thở; tay dùng tư thế giữ của hold_note.
const idle = require('./idle.js');
const r1 = (v) => Math.round(v * 100) / 100;
const IDLE = idle.moods.normal.loop[0];
const HOLD = { ua: 96, fa: 136, hand: 10 };
const BOOK = (y, op) => ({ id: 'work_book', file: 'props/work_book.svg', bone: 'chest', z: 105, x: 0, y: y || 0, opacity: op === undefined ? 1 : op });
const FLIP = { id: 'work_book_flip', file: 'props/work_book_flip.svg', bone: 'chest', z: 106 };

function bones(o) {
  const k = o.k === undefined ? 1 : o.k;            // 0 = buông, 1 = giơ sách
  const lag = o.hair || 0;
  return {
    hips: { y: r1(o.hipsY || 0) },
    chest: { sy: o.sy || 1, sx: o.sx || 1, r: o.chestR || 0 },
    head: { r: r1(o.headR || 0), x: r1(o.headX || 0), y: r1(o.headY || 0) },
    hair_back: { r: r1(-1.6 * lag) }, sidelock_l: { r: r1(2.2 * lag) }, sidelock_r: { r: r1(-2.2 * lag) },
    ahoge: { r: r1(o.ah || 0) }, ribbon: { r: r1(3 * lag) },
    upper_arm_r: { r: r1(-HOLD.ua * k) }, forearm_r: { r: r1(HOLD.fa * k) }, hand_r: { r: r1(HOLD.hand * k) },
    upper_arm_l: { r: r1(HOLD.ua * k) }, forearm_l: { r: r1(-HOLD.fa * k) }, hand_l: { r: r1(-HOLD.hand * k) },
  };
}
const SW = { hand_l: 'hold', hand_r: 'hold' };

// loop: mắt quét sách bằng cách xoay/nghiêng đầu trái-phải, gật nhẹ, chớp, khung 5 lật trang
const FACE = ['normal', 'normal', 'blink', 'normal', 'o', 'normal'];
const HR = [-3, 2, 3, -2, 0.5, -2.5], HX = [-1.2, 0.8, 1.2, -0.8, 0, -1];
const LOOP = [];
for (let i = 0; i < 6; i++) {
  const a = (2 * Math.PI * i) / 6, b = 0.5 - 0.5 * Math.cos(a);
  LOOP.push({
    ms: 450, face: FACE[i], swap: SW,
    bones: bones({ sy: r1(1.01 - 0.02 * b), sx: r1(0.995 + 0.01 * b), chestR: r1(0.5 * Math.sin(a)),
      headR: HR[i], headX: HX[i], headY: r1(1.6 + (i === 2 || i === 5 ? 0.8 : 0) - 0.5 * b), hair: Math.sin(a - 0.9), ah: r1(4 * Math.sin(a - 1.3)) }),
    show: [BOOK(r1(-0.5 * b))].concat(i === 4 ? [FLIP] : []),
  });
}
const L0 = LOOP[0];
const lerp = (A, B, t) => { const o = {}; for (const n of Object.keys(B)) { const a = A[n] || {}, b = B[n]; o[n] = {}; for (const k of ['r', 'x', 'y', 'sx', 'sy']) { const d = k === 'sx' || k === 'sy' ? 1 : 0; const va = a[k] == null ? d : a[k], vb = b[k] == null ? d : b[k]; if (va !== d || vb !== d || k === 'r') o[n][k] = r1(va + (vb - va) * t); } } return o; };

const start = [
  { ms: 130, face: 'normal', swap: { hand_l: 'open', hand_r: 'open' }, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.45), { hips: { y: -0.5 }, ahoge: { r: 4 }, hair_back: { r: 2.5 } }), show: [BOOK(14, 0.5)] },
  { ms: 130, face: 'normal', swap: SW, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.9), { hips: { y: -1.5 }, ahoge: { r: -5 }, hair_back: { r: -2 }, chest: { sy: 1.02 } }), show: [BOOK(4, 0.9)] },
  { ms: 130, face: 'normal', swap: SW, bones: L0.bones, show: L0.show },
];
const end = [
  { ms: 130, face: 'happy', swap: SW, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.6), { hips: { y: -1 }, ahoge: { r: 5 }, chest: { sy: 1.01 } }), show: [BOOK(8, 0.7)] },
  { ms: 130, face: 'happy', swap: { hand_l: 'open', hand_r: 'open' }, bones: Object.assign(lerp(IDLE.bones, L0.bones, 0.2), { hips: { y: 0 }, ahoge: { r: -4 } }), show: [BOOK(16, 0.25)] },
  { ms: 130, face: 'normal', bones: IDLE.bones, swap: IDLE.swap, hide: ['work_book', 'work_book_flip'] },
];
module.exports = { action: 'read', moods: { normal: { start, loop: LOOP, end } } };
