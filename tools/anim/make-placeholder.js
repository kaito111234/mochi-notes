'use strict';
// Sinh gói hình TẠM "mochi" từ 18 ảnh bán thân trong assets/mascot (chỉ đọc).
// Dùng: node tools/anim/make-placeholder.js [outDir]   (mặc định assets/pet/mochi)
// Tất định (không random). Chạy lại sẽ xoá sạch thư mục con cũ + pack.json trong outDir.
const fs = require('fs');
const path = require('path');
const png = require('./png');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'assets', 'mascot');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'assets', 'pet', 'mochi'));

// ---------- Hằng số bố cục (toạ độ trên canvas) ----------
const W = 288, H = 344, CX = 144;
const BUST_Y = 22, BUST_PIV = [119, 222]; // ảnh bán thân 238x228 đặt giữa canvas; trục xoay = giữa đáy
const TORSO0 = 222, HIP0 = 300, FOOT_Y = 325, FLOOR = 338;
const SHO = (side, torsoTop) => [CX + side * 38, torsoTop + 26];
// tư thế tay: khuỷu & bàn tay tương đối vai (side = +1 phải, -1 trái; x được nhân side)
const ARM = {
  down: { e: [8, 22], h: [10, 46] },
  up: { e: [26, -6], h: [34, -48] },
  cheer: { e: [16, -12], h: [20, -40] },
  chest: { e: [12, 16], h: [-4, 4] },
  mouth: { e: [24, 2], h: [4, -34] },
  akimbo: { e: [20, 10], h: [8, 28] },
  type: { e: [14, 16], h: [4, 30] },
};
const HAND = [CX + 38 + ARM.up.h[0], TORSO0 + 26 + ARM.up.h[1]];
const SKIN = '#f7dccb', SKIN_O = '#c99f8c', SLEEVE = '#fbfbfd', SLEEVE_O = '#b9bccf';

const names = fs.readdirSync(SRC).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
if (names.length < 18) throw new Error('Thiếu ảnh trong assets/mascot');
const bust = {}; for (const n of names) bust[n] = png.decode(path.join(SRC, n + '.png'));

// ---------- Vẽ nhân vật lên một lớp ----------
function armDraw(L, side, torsoTop, a, off) {
  const s = SHO(side, torsoTop), ex = s[0] + side * a.e[0], ey = s[1] + a.e[1];
  const hx = s[0] + side * a.h[0] + (off ? off[0] : 0), hy = s[1] + a.h[1] + (off ? off[1] : 0);
  png.drawLine(L, s[0], s[1], ex, ey, 15, SLEEVE_O); png.drawLine(L, ex, ey, hx, hy, 14, SLEEVE_O);
  png.drawLine(L, s[0], s[1], ex, ey, 12, SLEEVE); png.drawLine(L, ex, ey, hx, hy, 11, SLEEVE);
  png.fillEllipse(L, hx, hy, 7, 7, SKIN, SKIN_O, 1.5);
}

function drawChar(P) {
  const L = png.create(W, H), b = P.bob || 0, torsoTop = TORSO0 + b, hip = P.hip === undefined ? HIP0 + b : P.hip;
  // chân
  const legs = P.legs || standLegs(0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const lg = legs[i], hx = CX + (i ? 14 : -14), hy = hip - 6;
    const knee = lg.knee;
    const pts = knee ? [[hx, hy], knee, lg.foot] : [[hx, hy], lg.foot];
    for (let k = 0; k + 1 < pts.length; k++) png.drawLine(L, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 11, SKIN_O);
    for (let k = 0; k + 1 < pts.length; k++) png.drawLine(L, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 8.5, SKIN);
    png.fillEllipse(L, lg.foot[0] + 3, lg.foot[1] + 7, 14, 7, '#34344a', '#1c1c2a', 1.5);
  }
  // thân (áo gile đen, cổ áo trắng, cà vạt xanh lá)
  png.fillRoundRect(L, CX - 36, torsoTop, 72, Math.max(30, hip - torsoTop - 6), 14, '#2a2a33', '#15151c', 2.5);
  png.fillPoly(L, [[CX - 13, torsoTop + 2], [CX, torsoTop + 24], [CX + 13, torsoTop + 2]], '#fcfcfe', '#c9cbd8', 1.5);
  png.fillPoly(L, [[CX - 5, torsoTop + 16], [CX + 5, torsoTop + 16], [CX + 6, torsoTop + 32], [CX, torsoTop + 38], [CX - 6, torsoTop + 32]], '#4fb88c', '#2f7d5e', 1.5);
  // váy xếp ly
  const sk = hip - 32, sb = hip + (P.skirtDrop === undefined ? 6 : P.skirtDrop);
  png.fillPoly(L, [[CX - 32, sk], [CX + 32, sk], [CX + 46, sb], [CX - 46, sb]], '#7186c0', '#36427a', 2.5);
  for (const k of [-24, -8, 8, 24]) png.drawLine(L, CX + k * 0.8, sk + 4, CX + k * 1.4, sb - 3, 1.5, '#5568a3');
  // bán thân (trục xoay giữa đáy; co giãn y để "thở")
  png.drawImage(L, bust[P.face || 'normal'], {
    ox: BUST_PIV[0], oy: BUST_PIV[1], x: CX + (P.bustDx || 0), y: BUST_Y + BUST_PIV[1] + b + (P.bustDy || 0),
    sx: P.bustSx || 1, sy: P.bustSy || 1, rot: P.bustRot || 0,
  });
  // tay (vẽ đè lên)
  const arms = P.arms || ['down', 'down'];
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, a = arms[i], preset = typeof a === 'string' ? ARM[a] : a;
    armDraw(L, side, torsoTop, preset, P.armOff && P.armOff[i]);
  }
  return L;
}

// ---------- Dáng chân ----------
function standLegs(fxL, liftL, fxR, liftR) {
  return [{ foot: [CX - 14 + (fxL || 0), FOOT_Y - (liftL || 0)] }, { foot: [CX + 14 + (fxR || 0), FOOT_Y - (liftR || 0)] }];
}
function sitLegs() {
  return [{ knee: [CX + 22, 298 + 8], foot: [CX + 38, FOOT_Y - 2] }, { knee: [CX + 30, 298 + 8], foot: [CX + 46, FOOT_Y - 2] }];
}
function dangleLegs(sw) { return [{ foot: [CX - 12 + sw, 300 + 30 - 6] }, { foot: [CX + 12 - sw * 0.7, 300 + 34 - 6] }]; }

// ---------- Dựng một khung ----------
// P: tư thế nhân vật; G: biến đổi toàn thân quanh bàn chân {dx,dy,rot,sx,sy,alpha}; post(cv): vẽ thêm (chữ z…)
function render(P, G, post) {
  G = G || {};
  const L = drawChar(P), cv = png.create(W, H);
  png.drawImage(cv, L, { ox: CX, oy: FLOOR, x: CX + (G.dx || 0), y: FLOOR + (G.dy || 0), sx: G.sx || 1, sy: G.sy || 1, rot: G.rot || 0, alpha: G.alpha === undefined ? 1 : G.alpha });
  if (post) post(cv);
  return cv;
}
function drawZ(cv, x, y, s, a) {
  const c = png.hex('#6f7cc4'); c[3] = Math.round(255 * a);
  png.drawLine(cv, x, y, x + s, y, 3, c); png.drawLine(cv, x + s, y, x, y + s, 3, c); png.drawLine(cv, x, y + s, x + s, y + s, 3, c);
}

// ---------- Gói khung ----------
const actions = {}; // actions[action][mood][phase] = [{ms, cv}]
function put(action, mood, phase, list) {
  (((actions[action] = actions[action] || {})[mood] = actions[action][mood] || {})[phase] = list.map(([ms, cv]) => ({ ms, cv })));
}
const S = Math.sin, C = Math.cos, TAU = Math.PI * 2;
const breath = (i, n) => 1 + 0.01 * (1 - C(TAU * i / n)); // 1.00 .. 1.02
const MOODS = ['normal', 'happy', 'tired', 'sad'];
const MOOD_FACE = { normal: 'normal', happy: 'happy', tired: 'tired', sad: 'sad' };
const rng = (n) => Array.from({ length: n }, (_, i) => i);

// idle: thở
for (const m of MOODS) {
  const n = m === 'normal' ? 6 : 4, ms = { normal: 150, happy: 140, tired: 220, sad: 200 }[m];
  put('idle', m, 'loop', rng(n).map((i) => [ms, render({
    face: MOOD_FACE[m], bustSy: breath(i, n), bob: m === 'happy' ? -Math.round(1 - C(TAU * i / n)) : 0,
    bustDy: m === 'sad' ? 3 : 0, bustRot: m === 'sad' ? -2 : m === 'tired' ? 2 : 0,
  })]));
}
// walk: nhún + nghiêng + chân so le (nhìn sang phải)
for (const m of MOODS) {
  const n = 6, ms = { normal: 90, happy: 85, tired: 130, sad: 120 }[m], amp = m === 'happy' ? 4 : m === 'normal' ? 3 : 2;
  put('walk', m, 'loop', rng(n).map((i) => {
    const t = TAU * i / n, s = S(t), c = C(t);
    return [ms, render({
      face: MOOD_FACE[m], bob: -Math.round(amp * Math.abs(s)) , bustSy: 1,
      legs: standLegs(12 * s, Math.max(0, c) * 8, -12 * s, Math.max(0, -c) * 8),
      arms: [{ e: [-8, 22], h: [-10 - 8 * s, 46] }, { e: [8, 22], h: [10 + 8 * s, 46] }].map((a, k) => ({ e: [Math.abs(a.e[0]), a.e[1]], h: [(k ? 1 : 1) * (8 + (k ? 8 : -8) * s), 46] })),
    }, { rot: 4 * s * (m === 'tired' || m === 'sad' ? 0.6 : 1) })];
  }));
}
// sit
for (const m of MOODS) {
  const n = 4, ms = m === 'happy' ? 180 : 240;
  put('sit', m, 'loop', rng(n).map((i) => [ms, render({
    face: MOOD_FACE[m], bob: 26, hip: 322, skirtDrop: 4, legs: sitLegs(), bustSy: breath(i, n),
    bustDy: m === 'sad' ? 3 : 0, bustRot: m === 'sad' ? -2 : 0, arms: ['down', 'down'],
  })]));
}
// sleep: normal có start/loop/end; mood khác chỉ loop
const sitP = (o) => Object.assign({ bob: 26, hip: 322, skirtDrop: 4, legs: sitLegs(), arms: ['down', 'down'] }, o);
const zPost = (i) => (cv) => {
  drawZ(cv, 206, 56 - (i % 4) * 6, 14, 0.9 - (i % 4) * 0.1);
  drawZ(cv, 226, 36 - (i % 4) * 5, 9, 0.6 - (i % 4) * 0.08);
};
for (const m of MOODS) {
  const face = m === 'sad' ? 'sad' : m === 'tired' ? 'tired' : 'sleepy';
  put('sleep', m, 'loop', rng(4).map((i) => [400, render(sitP({ face, bustRot: 7, bustSy: breath(i, 4) * 1.0, bob: 28, bustDy: 2 }), null, zPost(i))]));
}
put('sleep', 'normal', 'start', [
  [220, render(sitP({ face: 'tired', bustRot: 2, bob: 26 }))],
  [260, render(sitP({ face: 'sleepy', bustRot: 5, bob: 27 }))],
]);
put('sleep', 'normal', 'end', [
  [160, render(sitP({ face: 'surprised', bustRot: 0, bob: 24, bustSy: 1.02 }))],
  [180, render(sitP({ face: 'normal', bustRot: 0, bob: 26 }))],
]);
// pat_head: xoa đầu (đứng)
put('pat_head', 'normal', 'start', [
  [90, render({ face: 'shy', bustRot: -2, bustSy: 0.99 })],
  [90, render({ face: 'love', bustRot: 2, bustSy: 0.985 })],
]);
put('pat_head', 'normal', 'loop', rng(4).map((i) => [140, render({
  face: i % 2 ? 'shy' : 'love', bustRot: [-3, 0, 3, 0][i], bustDx: [-2, 0, 2, 0][i], bustSy: i % 2 ? 0.985 : 0.995,
})]));
put('pat_head', 'normal', 'end', [
  [110, render({ face: 'shy', bustRot: 1 })],
  [130, render({ face: 'normal' })],
]);
// pat_body: ngượng
put('pat_body', 'normal', 'loop', rng(4).map((i) => [110, render({
  face: 'flustered', bustRot: [-2, 2, -2, 2][i], arms: ['chest', 'chest'], bustSy: i % 2 ? 0.99 : 1.0,
}, { dx: [-2, 2, -1, 1][i], rot: [-1.5, 1.5, -1, 1][i] })]));
// lifted: bị nhấc, chân thõng
const liftP = (i, face, lift) => render({
  face, bob: 0, legs: dangleLegs(5 * S(TAU * i / 4)), skirtDrop: 8, bustRot: 3 * S(TAU * i / 4 + 1),
  arms: [{ e: [10, -8], h: [14 + 3 * S(i * 1.7), -30] }, { e: [10, -8], h: [14 - 3 * S(i * 1.7), -30] }],
}, { dy: lift, rot: 3 * S(TAU * i / 4) });
put('lifted', 'normal', 'start', [[80, liftP(0, 'surprised', -5)], [90, liftP(1, 'surprised', -10)]]);
put('lifted', 'normal', 'loop', rng(4).map((i) => [130, liftP(i, i % 2 ? 'scared' : 'surprised', -12 + (i % 2) * 2)]));
put('lifted', 'normal', 'end', [[90, liftP(2, 'surprised', -8)], [100, liftP(3, 'uncomfortable', -3)]]);
// fall: rơi
put('fall', 'normal', 'loop', rng(3).map((i) => [80, render({
  face: 'surprised', legs: [{ foot: [CX - 20 + 4 * i, 330] }, { foot: [CX + 20 - 4 * i, 328] }], skirtDrop: 10,
  arms: [{ e: [14, -10], h: [22 + 3 * i, -34] }, { e: [14, -10], h: [22 + 3 * (2 - i), -34] }],
}, { rot: [-9, 3, 10][i], dy: -4 })]));
// land: dẹt rồi bật lại
put('land', 'normal', 'single', [
  [80, render({ face: 'uncomfortable', bustSy: 1 }, { sx: 1.12, sy: 0.8 })],
  [80, render({ face: 'surprised' }, { sx: 0.96, sy: 1.05 })],
  [110, render({ face: 'normal' })],
]);
// peek: chỉ giữ nửa người phía màn hình; peek_left = nấp mép trái (giữ nửa phải canvas), peek_right = lật
const peekL = (i) => {
  const cv = render({ face: [ 'shy', 'normal', 'shy'][i], bustRot: 3, arms: ['down', 'down'] }, { rot: [5, 7, 5][i] });
  png.clearRect(cv, 0, 0, CX, H); return cv;
};
put('peek_left', 'normal', 'loop', rng(3).map((i) => [220, peekL(i)]));
put('peek_right', 'normal', 'loop', rng(3).map((i) => [220, png.flipH(peekL(i))]));
// hold_note: giơ tay (tờ note do renderer vẽ tại pack.hand)
for (const m of MOODS) {
  put('hold_note', m, 'loop', rng(4).map((i) => [160, render({
    face: MOOD_FACE[m], bustSy: breath(i, 4), arms: ['down', { e: ARM.up.e, h: [ARM.up.h[0] + (i % 2 ? 0 : 0), ARM.up.h[1]] }],
  })]));
}
// ring: rung mạnh ±6px
put('ring', 'normal', 'loop', rng(4).map((i) => [60, render({
  face: i % 2 ? 'scared' : 'surprised', arms: ['cheer', 'cheer'],
}, { dx: [6, -6, 6, -6][i], rot: [2, -2, 2, -2][i] })]));
// các cử chỉ
put('happy', 'normal', 'loop', rng(4).map((i) => [120, render({
  face: i % 2 ? 'laugh' : 'happy', arms: ['cheer', 'cheer'], bustRot: [-2, 0, 2, 0][i],
}, { dy: [0, -10, -4, 0][i] })]));
put('sad', 'normal', 'loop', rng(4).map((i) => [250, render({
  face: i % 2 ? 'cry' : 'sad', bustDy: 4, bustRot: -3, bustSy: breath(i, 4), arms: ['down', 'down'],
})]));
put('shy', 'normal', 'loop', rng(4).map((i) => [200, render({
  face: 'shy', bustRot: [-3, 0, 3, 0][i], arms: ['chest', 'chest'],
}, { rot: [-2, 0, 2, 0][i] })]));
put('angry', 'normal', 'loop', rng(4).map((i) => [90, render({
  face: i % 2 ? 'protest' : 'angry', arms: ['akimbo', 'akimbo'], bustSy: 1.01,
}, { dx: [-2, 2, -2, 2][i] })]));
put('eat', 'normal', 'loop', rng(4).map((i) => [140, render({
  face: i % 2 ? 'normal' : 'happy', arms: ['down', 'mouth'], bustSy: i % 2 ? 0.975 : 1.0, bustDy: i % 2 ? 2 : 0,
})]));
put('work', 'normal', 'loop', rng(4).map((i) => [180, render({
  face: i === 2 ? 'bored' : 'normal', arms: [{ e: ARM.type.e, h: [ARM.type.h[0], ARM.type.h[1] + (i % 2 ? 4 : -2)] }, { e: ARM.type.e, h: [ARM.type.h[0], ARM.type.h[1] + (i % 2 ? -2 : 4)] }],
  bustDy: [0, 2, 3, 2][i], bustRot: [0, 2, 3, 2][i] * 0.5,
})]));
put('wave', 'normal', 'loop', rng(4).map((i) => [130, render({
  face: 'happy', arms: ['down', { e: [26, -8], h: [[24, 40, 24, 40][i], -44] }], bustRot: [0, 1, 0, -1][i],
})]));
put('startup', 'normal', 'single', rng(6).map((i) => {
  const sc = [0.35, 0.7, 1.1, 0.96, 1.03, 1.0][i];
  return [80, render({ face: 'excited', arms: i >= 2 ? ['cheer', 'cheer'] : ['down', 'down'] }, { sx: sc, sy: sc, alpha: [0.35, 0.75, 1, 1, 1, 1][i], dy: i === 2 ? -6 : 0 })];
}));
put('shutdown', 'normal', 'single', rng(6).map((i) => {
  const sc = [1, 1, 0.95, 0.85, 0.7, 0.55][i];
  return [110, render({ face: ['normal', 'tired', 'sleepy', 'sleepy', 'sleepy', 'sleepy'][i], bustRot: [0, 2, 5, 6, 6, 6][i] }, { sx: sc, sy: sc, alpha: [1, 1, 1, 0.8, 0.5, 0.2][i] })];
}));
put('say', 'normal', 'loop', rng(4).map((i) => [140, render({
  face: i % 2 ? 'happy' : 'normal', bustSy: breath(i, 4), arms: ['down', { e: [18, 8], h: [[22, 28, 22, 16][i], -8] }],
}, { dy: i === 1 ? -1 : 0 })]));

// ---------- Ghi ra đĩa ----------
function rmClean(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) fs.rmSync(path.join(dir, ent.name), { recursive: true, force: true });
    else if (ent.name === 'pack.json') fs.rmSync(path.join(dir, ent.name));
  }
}
rmClean(OUT);
let nFrames = 0;
for (const [a, moods] of Object.entries(actions)) for (const [m, phases] of Object.entries(moods)) for (const [p, list] of Object.entries(phases)) {
  const d = path.join(OUT, a, m, p); fs.mkdirSync(d, { recursive: true });
  list.forEach((f, i) => { png.saveIndexed(path.join(d, String(i + 1).padStart(4, '0') + '_' + f.ms + '.png'), f.cv); nFrames++; });
}
fs.mkdirSync(path.join(OUT, 'faces'), { recursive: true });
const faces = {};
for (const n of names) { fs.copyFileSync(path.join(SRC, n + '.png'), path.join(OUT, 'faces', n + '.png')); faces[n] = `faces/${n}.png`; }

const pack = {
  id: 'mochi', name: 'Mochi', author: 'Joiha (hình tạm sinh tự động từ art/source)', license: 'Nội bộ Joiha',
  size: [W, H], scale: 0.6, anchor: [CX, FLOOR],
  hitbox: { head: [60, 26, 168, 172], body: [96, 206, 96, 132] },
  hand: HAND,
  faces, actions: { walk: { speed: 2.2 } },
};
fs.writeFileSync(path.join(OUT, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
console.log(`Đã sinh ${nFrames} khung + ${names.length} faces vào ${OUT}`);
