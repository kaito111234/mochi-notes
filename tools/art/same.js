#!/usr/bin/env node
'use strict';
// Ảnh so "cùng một bé": mỗi hàng = idle 0001 + walk 0001 (dáng thẳng) + walk_side khung chỉ định, 1:1, đường đất 392.
//   node tools/art/same.js [ra.png] [tỉ lệ=1] [khung walk_side=1,4,7] [khung run_side=1,3]
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const PET = path.resolve(__dirname, '..', '..', 'assets', 'pet', 'mochi');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(process.env.MOCHI_ART_OUT || path.join(ROOT, 'out', 'art'), 'same.png');
const SC = parseFloat(process.argv[3] || '1');
const idx = (process.argv[4] || '1,4,7').split(',').map(Number);
const ridx = (process.argv[5] || '1,3').split(',').filter(Boolean).map(Number);
const TMP = path.join(os.tmpdir(), 'mochi-side-art'); fs.mkdirSync(TMP, { recursive: true });
const ls = (d) => fs.readdirSync(path.join(PET, d)).filter((f) => /\.png$/.test(f)).sort().map((f) => d + '/' + f);
const du = (r) => 'data:image/png;base64,' + fs.readFileSync(path.join(PET, r)).toString('base64');
const w = ls('walk_side/normal/loop');
const row = [ls('idle/normal/loop')[0], ls('walk/normal/loop')[0], ...idx.map((i) => w[i - 1]), ...ridx.map((i) => ls('run_side/normal/loop')[i - 1])].map(du);
const html = `<!doctype html><pre id=o></pre><script id=j type="application/json">${JSON.stringify({ row, SC })}</script><script>
const J=JSON.parse(document.getElementById('j').textContent);const W=400*J.SC;
const c=document.createElement('canvas');c.width=W*J.row.length;c.height=W;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
const L=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});
(async()=>{for(let k=0;k<J.row.length;k++){x.drawImage(await L(J.row[k]),k*W,0,W,W);}
x.strokeStyle='#e33';x.beginPath();x.moveTo(0,392*J.SC);x.lineTo(c.width,392*J.SC);x.stroke();
x.strokeStyle='#9c9';x.beginPath();for(const y of [88,235,340]){x.moveTo(0,y*J.SC);x.lineTo(c.width,y*J.SC);}x.stroke();
document.getElementById('o').textContent=c.toDataURL('image/png');})();</script>`;
const f = path.join(TMP, 'same.html'); fs.writeFileSync(f, html);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const r = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(TMP, 'profile')}`, '--virtual-time-budget=60000', '--dump-dom', 'file:///' + f.split(path.sep).join('/')], { maxBuffer: 1 << 30, encoding: 'utf8' });
const m = /<pre id="o">(data:image\/png;base64,[^<]+)<\/pre>/.exec(r.stdout || '');
if (!m) { console.error('lỗi'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(m[1].split(',')[1], 'base64')); console.log('đã ghi', OUT);
