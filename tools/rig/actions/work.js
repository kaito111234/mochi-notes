// work — ngồi sau laptop gõ phím. normal: start 4x150, loop 6x500, end 4x150. tired: loop 6 chậm, tay chống má.
// Laptop (mặt sau hướng người xem, bone "none", z 112 > tay 111 < đầu 120) che nửa dưới thân; tay gõ ẩn sau laptop.
const idle = require('./idle.js');
const r1 = (v) => Math.round(v * 100) / 100;
const IDLE = idle.moods.normal.loop[0];
const SIT = 43;
const LAP = (file, op) => ({ id: 'work_laptop', file: 'props/' + file, bone: 'none', z: 112, opacity: op === undefined ? 1 : op });
const SWEAT = { id: 'sweat', file: 'fx/sweat.svg', bone: 'head', z: 215 };

const legs = (k) => ({
  thigh_l: { r: r1(50 * k), sy: r1(1 - 0.5 * k) }, shin_l: { r: r1(-5 * k), sy: r1(1 + 0.4 * k) },
  thigh_r: { r: r1(-50 * k), sy: r1(1 - 0.5 * k) }, shin_r: { r: r1(5 * k), sy: r1(1 + 0.4 * k) },
});

// o: k (độ ngồi 0..1), sy,sx, headR/X/Y, hb,sl,ah,rb (tóc), uaL,faL,uaR,faR (tay trái/phải theo "độ mở")
function pose(o) {
  const k = o.k === undefined ? 1 : o.k;
  const o2 = o.hair || 0;
  return {
    hips: { y: r1(SIT * k + (o.hipsDy || 0)) },
    chest: { sy: o.sy || 1, sx: o.sx || 1, r: o.chestR || 0 },
    head: { r: r1(o.headR || 0), y: r1((o.headY || 0) + 8 * k), x: r1(o.headX || 0) },
    hair_back: { r: r1(-1.6 * o2), y: r1(-16 * k) }, sidelock_l: { r: r1(2.2 * o2), y: r1(-12 * k) }, sidelock_r: { r: r1(-2.2 * o2), y: r1(-12 * k) },
    ahoge: { r: r1((o.ah || 0) + 5 * o2) }, ribbon: { r: r1(3 * o2) },
    ...legs(k),
    upper_arm_l: { r: r1(o.uaL) }, forearm_l: { r: r1(o.faL) }, hand_l: { r: r1(o.hL || 0) },
    upper_arm_r: { r: r1(o.uaR) }, forearm_r: { r: r1(o.faR) }, hand_r: { r: r1(o.hR || 0) },
  };
}
const SW = { hand_l: 'hold', hand_r: 'hold', hair_back: 'sit' };
const SWF = { hand_l: 'fist', hand_r: 'fist', hair_back: 'sit' };

// ---------- loop normal: gõ luân phiên, gật gù, chớp, ngước nhìn ở khung 4-5
const FACE = ['normal', 'normal', 'blink', 'normal', 'normal', 'normal'];
function typingLoop(slow) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (2 * Math.PI * i) / 6;
    const lag = Math.sin(a - 0.9);
    const tap = i % 2 === 0 ? 1 : -1;               // tay luân phiên
    const up = i === 3 || i === 4;                   // ngước nhìn
    out.push({
      ms: 500, face: FACE[i],
      bones: pose({
        sy: r1(1 + 0.012 * Math.sin(a - 0.5)), sx: r1(1 - 0.006 * Math.sin(a - 0.5)),
        headR: r1(up ? -3 + 1.5 * Math.sin(a) : 1.5 * Math.sin(a - 0.4)),
        headY: r1(up ? -2 : 1.2 * Math.max(0, Math.sin(a + 0.6))),
        headX: r1(up ? 0.6 : 0),
        hair: lag, ah: r1(4 * Math.sin(a - 1.3)),
        uaL: -18 + tap * 2.5, faL: -42 + tap * 7, hL: tap * 4,
        uaR: 18 - tap * 2.5, faR: 42 - tap * 7, hR: -tap * 4,
      }),
      swap: SWF,
      show: [LAP('work_laptop.svg')],
    });
  }
  return out;
}
const LOOP = typingLoop();
const L0 = LOOP[0];

// ---------- start: đứng -> ngồi xuống -> mở laptop
const ARMZ = { upper_arm_l: 162, upper_arm_r: 162, forearm_l: 163, forearm_r: 163, hand_l: 164, hand_r: 164 };
const STD = { uaL: -14, faL: -24, uaR: 14, faR: 24 };
const start = [
  { ms: 150, face: 'normal', bones: pose({ k: 0.45, sy: 0.985, headR: 2, headY: -1, hair: 1.2, ah: 5, uaL: -22, faL: -50, uaR: 22, faR: 50, hipsDy: -2 }),
    swap: { hand_l: 'open', hand_r: 'open', hair_back: 'sit' }, show: [LAP('work_laptop_closed.svg', 0.55)] },
  { ms: 150, face: 'normal', bones: pose({ k: 0.9, sy: 1.0, headR: 1, headY: 1, hair: -1.4, ah: -5, uaL: -20, faL: -46, uaR: 20, faR: 46 }),
    swap: SW, show: [LAP('work_laptop_closed.svg')] },
  { ms: 150, face: 'normal', bones: pose({ k: 1, sy: 1.01, headR: 0, headY: 0, hair: 1.4, ah: 4, uaL: -19, faL: -44, uaR: 19, faR: 44 }),
    swap: SWF, show: [LAP('work_laptop_half.svg')] },
  { ms: 150, face: 'normal', bones: L0.bones, swap: SWF, show: [LAP('work_laptop.svg')] },
];

// ---------- end: gập laptop -> vươn vai -> đứng dậy
const end = [
  { ms: 150, face: 'normal', bones: pose({ k: 1, sy: 1.01, hair: 1, ah: 4, uaL: -19, faL: -44, uaR: 19, faR: 44 }), swap: SWF, show: [LAP('work_laptop_half.svg')] },
  { ms: 150, face: 'happy', bones: pose({ k: 1, sy: 1.025, sx: 0.985, headR: -4, headY: -3, hair: -1.5, ah: -6,
      uaL: 140, faL: 15, uaR: -140, faR: -15, hL: 0, hR: 0 }), z: ARMZ,
    swap: { hand_l: 'open', hand_r: 'open', hair_back: 'sit' }, show: [LAP('work_laptop_closed.svg')] },
  { ms: 150, face: 'happy', bones: pose({ k: 0.5, sy: 1.015, headR: -2, headY: -1, hair: 1.5, ah: 5, uaL: 100, faL: 30, uaR: -100, faR: -30, hipsDy: -3 }), z: ARMZ,
    swap: { hand_l: 'open', hand_r: 'open', hair_back: 'sit' }, show: [LAP('work_laptop_closed.svg', 0.4)] },
  { ms: 150, face: 'normal', bones: IDLE.bones, swap: IDLE.swap, hide: ['work_laptop'] },
];

// ---------- tired: tay phải chống má, tay trái gõ chậm, gật gù, ngáp
const TF = ['tired', 'tired', 'sleepy', 'yawn', 'tired', 'sleepy'];
const tired = [];
for (let i = 0; i < 6; i++) {
  const a = (2 * Math.PI * i) / 6;
  const lag = Math.sin(a - 0.9);
  const nod = [0, 1, 2.5, 1.5, 0.5, 2][i];           // gục dần rồi giật lên
  tired.push({
    ms: 700, face: TF[i],
    bones: pose({
      sy: r1(1 - 0.01 * Math.sin(a)), headR: r1(7 + nod * 1.2), headY: r1(nod * 1.2), headX: r1(4 + nod * 0.4),
      chestR: 1.5, hair: lag * 0.8, ah: r1(7 + 2 * lag),
      uaL: -18 + (i % 2 ? 2 : -1), faL: -42 + (i % 2 ? 6 : -2), hL: i % 2 ? 4 : 0,
      uaR: -40, faR: -150, hR: -10,
    }),
    swap: { hand_l: 'fist', hand_r: 'fist', hair_back: 'sit' }, z: { forearm_r: 124, hand_r: 135 },
    show: [LAP('work_laptop.svg')].concat(i === 1 || i === 4 ? [SWEAT] : []),
  });
}
const startT = start.map((f, i) => i === 3 ? Object.assign({}, f, { face: 'tired', bones: tired[0].bones, swap: tired[0].swap }) : Object.assign({}, f, { face: i === 0 ? 'tired' : 'sleepy' }));
const endT = end.map((f, i) => i === 0 ? Object.assign({}, f, { bones: tired[5].bones, face: 'yawn' }) : (i === 3 ? f : Object.assign({}, f, { face: i === 1 ? 'yawn' : 'tired' })));

module.exports = { action: 'work', moods: { normal: { start, loop: LOOP, end }, tired: { start: startT, loop: tired, end: endT } } };
