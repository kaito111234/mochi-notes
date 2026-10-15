#!/usr/bin/env node
'use strict';
// Ảnh ghép xem trước: hàng 1 walk_side normal, 2 walk gốc, 3 turn start/end + idle, 4 tired, 5 mặt nạ walk_side.
//   node tools/art/contact.js [đường-dẫn-ra.png (mặc định: out/art hoặc $MOCHI_ART_OUT)] [tỉ lệ=0.5] [chỉ-số-khung-bắt-đầu=0]
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const PET = path.resolve(__dirname, '..', '..', 'assets', 'pet', 'mochi');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(process.env.MOCHI_ART_OUT || path.join(ROOT, 'out', 'art'), 'side-contact.png');
const SC = parseFloat(process.argv[3] || '0.5');
const TMP = path.join(os.tmpdir(), 'mochi-side-art'); fs.mkdirSync(TMP, { recursive: true });
const ls = (d) => { try { return fs.readdirSync(path.join(PET, d)).filter((f) => /\.png$/.test(f)).sort().map((f) => d + '/' + f); } catch (e) { return []; } };
const du = (r) => 'data:image/png;base64,' + fs.readFileSync(path.join(PET, r)).toString('base64');
const only = process.argv[4];     // "0" chỉ hàng 1; mặc định tất cả
let rows = [
  ls('walk_side/normal/loop'), ls('run_side/normal/loop'), ls('walk/normal/loop'),
  [...ls('turn_side/normal/start'), ...ls('turn_side/normal/end'), ...ls('idle/normal/loop').slice(0, 1)],
  ls('walk_side/tired/loop'), ls('masks/walk_side/normal/loop'),
].filter((r) => r.length);

const START = process.argv[5] !== undefined ? +process.argv[5] : -1;
const REF = process.argv[6] || process.env.MOCHI_REF_IMG || '';          // ảnh tham chiếu ngoài (tuỳ chọn), không nằm trong repo
if (REF && fs.existsSync(REF)) {
  const w = ls('walk_side/normal/loop');
  rows.push(['@ref:data:image/png;base64,' + fs.readFileSync(REF).toString('base64'), w[0], w[3], w[6], w[9], w[1]].map((r) => (r.startsWith('@ref:') ? r : du(r))));
}
if (only !== undefined) rows = [only === 'ref' ? rows[rows.length - 1] : rows[+only]];
if (START >= 0) rows = rows.map((r) => r.slice(START, START + 4));
rows = rows.map((r) => r.map((x) => (x.startsWith('@ref:') ? x : (x.startsWith('data:') ? x : du(x)))));
const html = `<!doctype html><pre id=o></pre><script id=j type="application/json">${JSON.stringify({ rows, SC })}</script><script>
const J=JSON.parse(document.getElementById('j').textContent);const W=400*J.SC;
const c=document.createElement('canvas');c.width=W*Math.max(...J.rows.map(r=>r.length),1);c.height=W*J.rows.length;const x=c.getContext('2d');
x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
const L=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});
(async()=>{for(let r=0;r<J.rows.length;r++){for(let k=0;k<J.rows[r].length;k++){let u=J.rows[r][k];if(u.startsWith('@ref:')){const i=await L(u.slice(5));x.drawImage(i,110,215,250,430,k*W+W*0.12,r*W,W*0.76,W);continue;}const i=await L(u);x.drawImage(i,k*W,r*W,W,W);}
 x.strokeStyle='#e33';x.lineWidth=1;x.beginPath();x.moveTo(0,r*W+392*J.SC);x.lineTo(c.width,r*W+392*J.SC);x.stroke();
 x.strokeStyle='#bbb';x.beginPath();for(let k=0;k<12;k++){x.moveTo(k*W+200*J.SC,r*W);x.lineTo(k*W+200*J.SC,r*W+W);}x.stroke();}
 document.getElementById('o').textContent=c.toDataURL('image/png');})();</script>`;
const f = path.join(TMP, 'contact.html'); fs.writeFileSync(f, html);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const r = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(TMP, 'profile')}`, '--virtual-time-budget=60000', '--dump-dom', 'file:///' + f.split(path.sep).join('/')], { maxBuffer: 1 << 30, encoding: 'utf8' });
const m = /<pre id="o">(data:image\/png;base64,[^<]+)<\/pre>/.exec(r.stdout || '');
if (!m) { console.error('lỗi dựng ảnh ghép'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(m[1].split(',')[1], 'base64')); console.log('đã ghi', OUT);
