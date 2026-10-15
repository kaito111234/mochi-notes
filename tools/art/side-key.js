#!/usr/bin/env node
'use strict';
// MỘT khung chuẩn dáng nghiêng (tư thế tiếp đất) vẽ tay bằng path bezier mềm — để duyệt trước khi làm chuyển động.
//   node tools/art/side-key.js            ghi ảnh so key.png, key-2x.png, key-frame.png vào out/art (hoặc $MOCHI_ART_OUT); ảnh tham chiếu phong cách: tham số 1 (tuỳ chọn)
// KHÔNG ghi đè assets. Ảnh tham chiếu ngoài (nếu có) chỉ để so bố cục, không nằm trong repo.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const PET = path.join(ROOT, 'assets', 'pet', 'mochi');
const OUTDIR = process.env.MOCHI_ART_OUT || path.join(ROOT, 'out', 'art');
const TMP = path.join(os.tmpdir(), 'mochi-side-art');
const REF = process.argv[2] || process.env.MOCHI_REF_IMG || '';          // ảnh tham chiếu ngoài (tuỳ chọn)

const C = {
  line: '#1f2a44', hair: '#9eb9e6', hairHi: '#c4d7f5', hairSh: '#758baf', hairBack: '#8fa9d8',
  skin: '#ffe6da', skinSh: '#f3cdbf', blush: '#f2a9a9',
  jacket: '#23262e', jacketHi: '#434a5e', sleeve: '#2c3242', sleeveFar: '#1d2029', shirt: '#f4f6fb', tie: '#274a96',
  skirt: '#20232c', skirtLine: '#c9d0de', sock: '#1c1e25', boot: '#1c1e24', lace: '#6a7290',
  bow: '#101114', bowHi: '#3b4056', gold: '#f2c94c',
  iris: '#62c48e', irisDk: '#2e7d5d', pupil: '#1b3a36',
};
const GROUND = 391;
const f2 = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (u) => u * u * (3 - 2 * u);
const D2R = Math.PI / 180;
const SK = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra.includes('stroke-width') ? SK.replace(/stroke-width="3"/, '') : SK} ${extra}/>`;
const N = (d, fill) => `<path d="${d}" fill="${fill}"/>`;                    // không viền

// ---------- tiện ích bezier ----------
function spline(pts) {                 // Catmull-Rom kín -> Bezier
  const n = pts.length;
  let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f2(p1[0] + (p2[0] - p0[0]) / 6)},${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)},${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])},${f2(p2[1])}`;
  }
  return d + ' Z';
}
// chi (tay/chân) dạng khối thon: đường tâm bezier bậc 2 đi qua khớp giữa, bề rộng đổi mượt theo u
function limb(A, K, B, widths, ta = 0, tb = 1, cap = 0.8) {
  const Q = [2 * K[0] - (A[0] + B[0]) / 2, 2 * K[1] - (A[1] + B[1]) / 2];
  const at = (t) => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * Q[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * Q[1] + t * t * B[1]];
  const tg = (t) => { const x = 2 * (1 - t) * (Q[0] - A[0]) + 2 * t * (B[0] - Q[0]), y = 2 * (1 - t) * (Q[1] - A[1]) + 2 * t * (B[1] - Q[1]); const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const w = (u) => { for (let i = 0; i < widths.length - 1; i++) { const a = widths[i], b = widths[i + 1]; if (u <= b[0] || i === widths.length - 2) return lerp(a[1], b[1], sm(Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0]))))); } return widths[0][1]; };
  const n = 12, L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(ta, tb, i / n), p = at(t), d = tg(t), nx = -d[1], ny = d[0], h = w(t) / 2;
    L.push([p[0] + nx * h, p[1] + ny * h]); R.push([p[0] - nx * h, p[1] - ny * h]);
  }
  const e0 = at(ta), d0 = tg(ta), e1 = at(tb), d1 = tg(tb), h0 = w(ta) / 2 * cap, h1 = w(tb) / 2 * cap;
  const pts = [[e0[0] - d0[0] * h0, e0[1] - d0[1] * h0], ...L, [e1[0] + d1[0] * h1, e1[1] + d1[1] * h1], ...R.reverse()];
  return { d: spline(pts), at, tg };
}
function ik(H, A, l1, l2) {
  let dx = A[0] - H[0], dy = A[1] - H[1], d = Math.hypot(dx, dy);
  const dm = (l1 + l2) * 0.998;
  if (d > dm) { dx *= dm / d; dy *= dm / d; d = dm; A = [H[0] + dx, H[1] + dy]; }
  const a = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const k1 = [H[0] + l1 * Math.cos(a - al), H[1] + l1 * Math.sin(a - al)], k2 = [H[0] + l1 * Math.cos(a + al), H[1] + l1 * Math.sin(a + al)];
  return { K: k1[0] >= k2[0] ? k1 : k2, A };
}

// ---------- giày búp bê / bốt cổ thấp nhỏ gọn ----------
const SHOE = 'M-6,-12 L6,-12 C7,-7 8,-4 12,-3 C20,-1 25,3 24,8 C23,12 19,12 15,12 L-5,12 C-10,12 -10,5 -8,0 Z';
const SHOE_PTS = [[-5, 12], [15, 12], [20.5, 11.5], [23.5, 9], [-9, 8]];
const soleMax = (a) => Math.max(...SHOE_PTS.map(([x, y]) => x * Math.sin(a * D2R) + y * Math.cos(a * D2R)));
function shoe(A, ang, far) {
  const fill = far ? '#14161b' : C.boot;
  return `<g transform="translate(${f2(A[0])} ${f2(A[1])}) rotate(${f2(ang)})">` +
    P(SHOE, fill) +
    `<path d="M-8,8.6 L20,8.8" stroke="${far ? '#3a3f4d' : '#8d96b3'}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M-6,-6 C-2,-4 3,-4 7,-6" stroke="${C.lace}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M-3,-1 L4,2 M4,-1 L-3,2" stroke="${C.lace}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
}
function leg(H, A, ang, far) {
  const { K, A: A2 } = ik(H, A, 44, 44);
  const wd = [[0, 21], [0.5, 15], [0.72, 15.5], [1, 10.5]];
  const skin = limb(H, K, A2, wd), sock = limb(H, K, A2, wd.map(([u, w]) => [u, w + 1.4]), 0.5, 0.99, 0.55), band = limb(H, K, A2, wd.map(([u, w]) => [u, w + 1.9]), 0.5, 0.6, 0.2);
  return P(skin.d, far ? '#e9cbbd' : C.skin) + P(sock.d, far ? '#14161b' : C.sock) + P(band.d, far ? '#aab0bd' : '#eef0f6', 'stroke-width="2.2"') + shoe(A2, ang, far);
}

// ---------- tay áo cardigan rộng loe, phủ gần hết bàn tay ----------
function arm(S, a1, a2, near) {
  const L1 = 36, L2 = 31;
  const E = [S[0] + L1 * Math.sin(a1 * D2R), S[1] + L1 * Math.cos(a1 * D2R)];
  const W = [E[0] + L2 * Math.sin(a2 * D2R), E[1] + L2 * Math.cos(a2 * D2R)];
  const wd = [[0, 24], [0.45, 23], [0.7, 27], [1, 34]];
  const sl = limb(S, E, W, wd, 0, 1, 0.55);
  const col = near ? C.sleeve : C.sleeveFar;
  const dir = [Math.sin(a2 * D2R), Math.cos(a2 * D2R)];
  const tip = [W[0] + dir[0] * 9, W[1] + dir[1] * 9];
  let s = '';
  // đầu ngón tay tròn lộ nhẹ ngoài cổ tay áo
  s += `<ellipse cx="${f2(tip[0])}" cy="${f2(tip[1])}" rx="8" ry="7.5" fill="${near ? C.skin : '#e8cdc0'}" ${SK}/>`;
  s += P(sl.d, col);
  // miệng ống tay (cổ tay áo sơ mi trắng mỏng)
  const nx = -dir[1], ny = dir[0];
  s += `<path d="M${f2(W[0] + nx * 15 + dir[0] * 4)},${f2(W[1] + ny * 15 + dir[1] * 4)} Q${f2(W[0] + dir[0] * 11)},${f2(W[1] + dir[1] * 11)} ${f2(W[0] - nx * 15 + dir[0] * 4)},${f2(W[1] - ny * 15 + dir[1] * 4)}" fill="none" stroke="${near ? C.shirt : '#c8cbd4'}" stroke-width="3.2" stroke-linecap="round"/>`;
  if (near) {
    const d1 = [Math.sin(a1 * D2R), Math.cos(a1 * D2R)];
    s += `<path d="M${f2(S[0] + 7 * -d1[1] + d1[0] * 6)},${f2(S[1] + 7 * d1[0] + d1[1] * 6)} Q${f2(E[0] + 8 * -d1[1])},${f2(E[1] + 8 * d1[0])} ${f2(W[0] + 11 * -dir[1])},${f2(W[1] + 11 * dir[0] - 2)}" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;
  }
  return s;
}

// ---------- đầu ----------
const FACE = 'M252,108 C262,122 264,142 262,158 C261,168 260,174 261,180 C262,184 266,186 266,190 C267,193 271,197 272,206 C273,216 268,226 258,231 C250,235 240,235 232,232 C224,229 214,224 208,218 L206,170 L204,108 Z';
function eye(ex, ey) {
  const rx = 12.5, ry = 16.5;
  let s = `<clipPath id="eyc"><ellipse cx="${ex}" cy="${ey}" rx="${rx}" ry="${ry}"/></clipPath>`;
  s += `<ellipse cx="${ex}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${C.iris}" ${SK}/>`;
  s += `<g clip-path="url(#eyc)"><rect x="${ex - rx}" y="${ey - ry}" width="${rx * 2}" height="${ry * 0.95}" fill="${C.irisDk}"/>` +
    `<ellipse cx="${ex + 1.5}" cy="${ey + 2.5}" rx="6.2" ry="9.5" fill="${C.pupil}"/>` +
    `<ellipse cx="${ex - 3.5}" cy="${ey - 5.5}" rx="5" ry="5.6" fill="#fff"/><circle cx="${ex + 4.5}" cy="${ey + 8}" r="2.4" fill="#fff"/></g>`;
  // mi trên dày đậm, đuôi mi hất ra sau
  s += `<path d="M${ex - rx - 2},${ey - 3} C${ex - rx},${ey - ry - 5} ${ex + 3},${ey - ry - 5} ${ex + rx + 1},${ey - 6}" fill="none" stroke="${C.line}" stroke-width="5.5" stroke-linecap="round"/>`;
  s += `<path d="M${ex - rx - 1},${ey - 4} L${ex - rx - 9},${ey - 11}" fill="none" stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"/>`;
  return s;
}
function head() {
  let s = '';
  // 1) tóc sau liền một mảng: đỉnh đầu -> gáy phồng -> xuống lưng, loe nhẹ, đuôi 4 mũi nhọn mềm
  const back = 'M266,124 C258,100 232,86 204,86 C160,86 127,112 125,160 C123,198 124,236 117,272 C112,296 104,316 106,334 ' +
    'C107,343 111,348 115,345 C121,341 124,332 126,322 C128,335 133,344 138,342 C144,339 148,330 151,321 C154,331 159,339 164,337 C170,333 174,325 177,316 ' +
    'C184,310 188,296 190,276 C193,252 197,232 200,215 Z';
  s += P(back, C.hair);
  s += `<clipPath id="bk"><path d="${back}"/></clipPath><g clip-path="url(#bk)">` +
    `<path d="M126,168 C128,210 126,252 120,298 C130,258 134,214 144,186 C146,180 146,174 144,170 Z" fill="${C.hairSh}" opacity="0.4"/>` +
    [['M150,112 C136,160 134,232 132,312'],['M140,124 C129,170 127,232 125,300'], ['M160,112 C148,165 146,240 145,326'], ['M181,110 C170,180 167,250 166,334'], ['M118,228 C121,268 122,300 124,324'], ['M171,118 C160,175 156,240 156,300']]
      .map((q) => `<path d="${q[0]}" fill="none" stroke="${C.hairSh}" stroke-width="2.1" stroke-linecap="round" opacity="0.8"/>`).join('') + `</g>`;
  s += `<path d="${back}" fill="none" ${SK}/>`;
  return s;
}
function face() {
  let s = P(FACE, C.skin);
  s += `<clipPath id="fc"><path d="${FACE}"/></clipPath>`;
  s += `<g clip-path="url(#fc)"><path d="M204,108 L252,108 C262,122 264,142 262,150 C240,138 222,136 204,140 Z" fill="${C.skinSh}" opacity="0.8"/></g>`;
  s += `<ellipse cx="246" cy="207" rx="12" ry="7" fill="${C.blush}" opacity="0.65"/>`;
  s += eye(240, 177);
  s += `<path d="M250,217 Q255,221 260,216" fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"/>`;
  return s;
}
function hairFront() {
  let s = '';
  // mái: vài lọn cong mềm đầu nhọn mềm phủ trán xuống gần ngang mắt
  const bangs = 'M204,98 C224,86 256,98 266,124 C270,140 265,152 259,161 C256,154 253,149 249,148 C249,155 247,160 243,164 C240,156 236,151 233,149 C232,155 229,160 225,164 C223,154 219,147 213,142 C209,138 206,131 204,122 Z';
  s += P(bangs, C.hair);
  // lọn tóc trước tai, đầu lọn nhọn mềm chạm gò má
  const side = 'M203,114 C214,124 224,146 225,170 C225,190 221,206 215,217 C209,203 203,184 202,160 Z';
  s += P(side, C.hair);
  s += `<path d="M211,134 C217,152 219,176 216,200" fill="none" stroke="${C.hairSh}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`;
  s += `<path d="M232,114 C246,114 256,122 260,134" fill="none" stroke="${C.hairSh}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>`;
  // dải sáng ngang đỉnh đầu
  s += `<path d="M150,126 C166,106 206,98 250,112" fill="none" stroke="${C.hairHi}" stroke-width="10" stroke-linecap="round" opacity="0.9"/>`;
  // ahoge
  const ax = 214;
  s += P(`M${ax - 7},96 C${ax - 14},80 ${ax - 2},64 ${ax + 12},66 C${ax + 24},69 ${ax + 16},84 ${ax + 7},82 C${ax + 12},78 ${ax + 10},74 ${ax + 6},74 C${ax - 2},74 ${ax + 3},90 ${ax + 6},96 Z`, C.hair);
  // kẹp chữ thập
  s += `<g transform="translate(228 118) rotate(-20)">` + P('M-11,-3.5 h22 a3.5,3.5 0 0 1 0,7 h-22 a3.5,3.5 0 0 1 0,-7 Z', '#fbfcff', 'stroke-width="2.2"') +
    `<g transform="rotate(90)">` + P('M-11,-3.5 h22 a3.5,3.5 0 0 1 0,7 h-22 a3.5,3.5 0 0 1 0,-7 Z', '#fbfcff', 'stroke-width="2.2"') + `</g><circle r="3.4" fill="${C.gold}" stroke="${C.line}" stroke-width="1.6"/></g>`;
  // nơ đen ở sau đỉnh đầu, 2 đuôi nơ thả theo tóc
  const tail = (dx, len, w, tilt) => `M${dx - w / 2},4 C${dx - w / 2 + tilt * 0.3},${len * 0.4} ${dx - w / 2 + tilt * 0.7},${len * 0.8} ${dx + tilt - w / 2},${len} L${dx + tilt},${len - 5} L${dx + tilt + w / 2},${len + 2} C${dx + w / 2 + tilt * 0.7},${len * 0.8} ${dx + w / 2 + tilt * 0.3},${len * 0.4} ${dx + w / 2},4 Z`;
  s += `<g transform="translate(166 124) rotate(-24) scale(0.82 0.9)">` + P(tail(-3, 62, 9, -3), C.bow, 'stroke-width="2.5"') + P(tail(7, 46, 8, 1), C.bow, 'stroke-width="2.5"') +
    P('M0,0 C-8,-17 -30,-14 -30,0 C-30,13 -10,16 0,0 Z', C.bow, 'stroke-width="2.5"') + P('M0,0 C8,-17 30,-14 30,0 C30,13 10,16 0,0 Z', C.bow, 'stroke-width="2.5"') +
    `<path d="M-24,-5 Q-16,-11 -8,-5 M24,-5 Q16,-11 8,-5" stroke="${C.bowHi}" stroke-width="2" fill="none" stroke-linecap="round"/><circle r="5.5" fill="${C.gold}" stroke="${C.line}" stroke-width="2.2"/></g>`;
  return s;
}

// ---------- thân: cardigan rộng thùng thình + váy xoè ----------
function torso() {
  let s = '';
  // sơ mi lộ ở mép trước
  s += P('M212,226 L232,234 C238,258 240,288 240,306 L218,306 Z', C.shirt, 'stroke-width="2.5"');
  s += P('M229,236 L238,238 L238,274 L233,283 L229,274 Z', C.tie, 'stroke-width="2.2"');
  // cardigan dài phủ hông, rộng dần xuống gấu
  const card = 'M177,236 C167,262 156,290 152,308 C168,316 202,316 237,310 C239,292 233,264 228,246 C226,240 224,236 220,230 C206,222 190,226 177,236 Z';
  s += P(card, C.jacket);
  s += `<path d="M156,301 C176,309 206,309 236,303" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>` +
    `<path d="M178,242 C170,262 164,282 161,298" fill="none" stroke="${C.jacketHi}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M214,246 C218,264 218,284 215,298" fill="none" stroke="${C.jacketHi}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>`;
  // cổ áo sơ mi
  s += P('M206,222 C213,230 222,235 233,238 L231,229 C222,226 213,221 207,214 Z', C.shirt, 'stroke-width="2.2"');
  return s;
}
function skirtSvg() {
  let s = P('M172,296 L236,296 L252,313 C240,320 226,316 213,321 C199,325 184,318 168,321 C160,322 154,319 150,315 Z', C.skirt);
  s += `<path d="M153,313 C170,319 184,316 198,320 C212,315 226,319 249,310" fill="none" stroke="${C.skirtLine}" stroke-width="2.2" stroke-linecap="round"/>`;
  s += [182, 204, 226].map((x, i) => `<path d="M${x},299 L${x + 4 + i * 2},315" stroke="#3a3e4c" stroke-width="2" fill="none" stroke-linecap="round"/>`).join('');
  return s;
}

function build() {
  const nearFoot = { ang: 38 }, farFoot = { ang: -14 };
  const hN = [196, 306], hF = [214, 306];
  const aN = [154, GROUND - soleMax(nearFoot.ang) - 0.5];
  const aF = [249, GROUND - soleMax(farFoot.ang) - 0.5];
  let body = '';
  // chân (sau thượng thân)
  body += leg(hF, aF, farFoot.ang, true);
  body += leg(hN, aN, nearFoot.ang, false);
  const S = [199, 247];
  let up = '';
  up += head();                                   // tóc sau (dưới cùng của thượng thân)
  up += arm(S, -26, -18, false);                  // tay xa ra sau (ló sau lưng)
  up += skirtSvg();
  up += `<path d="M211,214 L227,214 C228,224 228,232 229,240 L209,240 C210,232 210,224 211,214 Z" fill="${C.skinSh}" ${SK}/>`;     // cổ
  up += torso();
  up += face() + hairFront();
  up += arm(S, 33, 58, true);                     // tay gần vung ra trước, mềm
  body += `<g transform="rotate(4 205 304)">${up}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${body}</svg>`;
}

// ---------- dựng bằng Chrome ----------
const du = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
function run(job) {
  fs.mkdirSync(TMP, { recursive: true });
  const html = `<!doctype html><pre id="o"></pre><script id="job" type="application/json">${JSON.stringify(job).replace(/</g, '\\u003c')}</script><script>
const J=JSON.parse(document.getElementById('job').textContent);
const L=s=>new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s;});
(async()=>{
 const svg=await L('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(J.svg));
 const cv=document.createElement('canvas');cv.width=400;cv.height=400;const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(svg,0,0,400,400);
 const d=c.getImageData(0,0,400,400).data;let mx=-1,mn=400;for(let y=0;y<400;y++)for(let x=0;x<400;x++)if(d[(y*400+x)*4+3]>20){if(y>mx)mx=y;if(y<mn)mn=y;}
 const out={bottom:mx,top:mn,frame:cv.toDataURL('image/png')};
 if(J.compose){const W=400,cc=document.createElement('canvas');cc.width=W*3;cc.height=W;const x=cc.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W*3,W);
  if(J.ref){const ref=await L(J.ref);x.drawImage(ref,110,215,250,430,W*0.12,0,W*0.76,W);}
  x.drawImage(await L(J.idle),W,0);x.drawImage(svg,2*W,0);
  x.strokeStyle='#e33';x.beginPath();x.moveTo(0,392);x.lineTo(W*3,392);x.stroke();
  x.strokeStyle='#9c9';x.beginPath();for(const y of [88,312]){x.moveTo(0,y);x.lineTo(W*3,y);}x.stroke();
  out.cmp=cc.toDataURL('image/png');
  const c2=document.createElement('canvas');c2.width=800;c2.height=800;const x2=c2.getContext('2d');x2.fillStyle='#fff';x2.fillRect(0,0,800,800);x2.drawImage(svg,0,0,800,800);out.big=c2.toDataURL('image/png');}
 document.getElementById('o').textContent=JSON.stringify(out);
})().catch(e=>{document.getElementById('o').textContent='ERR '+e;});</script>`;
  const f = path.join(TMP, 'key.html'); fs.writeFileSync(f, html);
  const r = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(TMP, 'profile')}`, '--virtual-time-budget=60000', '--dump-dom', 'file:///' + f.split(path.sep).join('/')], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const m = /<pre id="o">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  if (!m) throw new Error('Chrome không trả kết quả');
  const t = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (t.startsWith('ERR')) throw new Error(t);
  return JSON.parse(t);
}
const save = (name, url) => { fs.mkdirSync(OUTDIR, { recursive: true }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(url.split(',')[1], 'base64')); };
let svg = build();
let o = run({ svg });
const dy = 392 - o.bottom;
if (dy) svg = svg.replace(/(<svg[^>]*>)/, `$1<g transform="translate(0 ${dy})">`).replace('</svg>', '</g></svg>');
o = run({ svg, compose: true, ref: REF && fs.existsSync(REF) ? du(REF) : '', idle: du(path.join(PET, 'idle', 'normal', 'loop', '0001_160.png')) });
save('key.png', o.cmp); save('key-2x.png', o.big); save('key-frame.png', o.frame);
console.log('đáy', o.bottom, 'đỉnh', o.top, '(dy', dy + ')', '-> key.png, key-2x.png, key-frame.png');
