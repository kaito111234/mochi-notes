'use strict';
// Xem nhanh một tư thế → PNG.
//   node tools/rig/pose.js --out x.png [--face happy] [--pose '{"bones":{"forearm_r":{"r":90}}}'] [--scale 2]
//        [--bg white|checker|none] [--parts dir] [--rig ...] [--from idle/normal/loop/3] [--actions dir]
// --pose nhận JSON của một khung: {face, bones, global, swap, show, hide, z, opacity}. Không có --pose = tư thế gốc.
// --from action[/mood/phase/số] lấy khung có sẵn của action (số bắt đầu từ 1; mặc định normal/loop/1).
const path = require('path');
const { loadRig } = require('./lib/rig');
const { loadActions } = require('./lib/action');
const { parseArgs, resolveFromRoot, renderJobs } = require('./lib/util');

const a = parseArgs(process.argv.slice(2));
if (!a.out || a.out === true) { console.error('Cần --out x.png'); process.exit(1); }
const R = loadRig(resolveFromRoot(a.rig || 'art/rig/mochi/rig.json'), a.parts);
let frame = {};
if (a.from) {
  const [act, mood = 'normal', phase = 'loop', n = '1'] = String(a.from).split('/');
  const found = loadActions(resolveFromRoot(a.actions || 'tools/rig/actions'), [act])[0];
  const fr = found && found.moods[mood] && found.moods[mood][phase] && found.moods[mood][phase][(+n || 1) - 1];
  if (!fr) { console.error('Không thấy khung ' + a.from); process.exit(1); }
  frame = fr;
}
if (a.pose) frame = Object.assign({}, frame, JSON.parse(a.pose));
if (a.face && a.face !== true) frame.face = a.face;
const scale = a.scale ? +a.scale : 1;
const bg = a.bg || 'white';
const [W, H] = R.rig.canvas;
const svg = R.frameSvg(frame, { scale, bg });
renderJobs([{ svg, out: path.resolve(a.out), w: Math.round(W * scale), h: Math.round(H * scale) }], { quiet: true });
console.log('pose → ' + path.resolve(a.out));
