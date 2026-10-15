'use strict';
// Dựng gói hình động từ rig + action.
//   node tools/rig/build.js [--rig art/rig/mochi/rig.json] [--parts dir] [--actions tools/rig/actions]
//        [--out assets/pet/mochi] [--only idle,walk] [--frames-only] [--faces] [--keep-svg] [--no-quantize]
const fs = require('fs');
const path = require('path');
const { loadRig } = require('./lib/rig');
const { loadActions } = require('./lib/action');
const { faceJobs } = require('./faces');
const { ROOT, parseArgs, resolveFromRoot, renderJobs } = require('./lib/util');

const a = parseArgs(process.argv.slice(2), ['frames-only', 'faces', 'keep-svg', 'quantize', 'no-quantize']);
const t0 = Date.now();
const R = loadRig(resolveFromRoot(a.rig || 'art/rig/mochi/rig.json'), a.parts);
const actionsDir = resolveFromRoot(a.actions || 'tools/rig/actions');
const out = path.resolve(a.out || path.join(ROOT, 'assets/pet/mochi'));
const only = typeof a.only === 'string' ? a.only.split(',').map(s => s.trim()).filter(Boolean) : null;
const W = R.rig.canvas[0], H = R.rig.canvas[1];

const actions = loadActions(actionsDir, only);
if (!actions.length) { console.error('Không có action nào để dựng trong ' + actionsDir); process.exit(1); }

const jobs = [];
const svgDir = path.join(ROOT, 'art', 'build', 'svg');
for (const act of actions) {
  fs.rmSync(path.join(out, act.action), { recursive: true, force: true });
  for (const [mood, phases] of Object.entries(act.moods)) for (const [phase, frames] of Object.entries(phases)) {
    frames.forEach((fr, i) => {
      const name = `${String(i + 1).padStart(4, '0')}_${fr.ms}`;
      const svg = R.frameSvg(fr);
      jobs.push({ svg, out: path.join(out, act.action, mood, phase, name + '.png'), w: W, h: H });
      if (a['keep-svg']) {
        const f = path.join(svgDir, act.action, mood, phase, name + '.svg');
        fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, svg);
      }
    });
  }
}
const nFrames = jobs.length;
if (a.faces) jobs.push(...faceJobs(R, out));
renderJobs(jobs);
if (!a['no-quantize']) { // nén PNG bảng màu (mặc định bật)
  const { quantizeFile } = require('./lib/quant');
  let b = 0, af = 0;
  for (const j of jobs) { const r = quantizeFile(j.out); b += r.before; af += r.after; }
  console.log(`quantize: ${(b / 1048576).toFixed(2)} MB → ${(af / 1048576).toFixed(2)} MB`);
}

if (!a['frames-only']) {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'pack.base.json'), 'utf8'));
  const faces = {};
  for (const k of R.rig.faces.slice(0, 18)) if (fs.existsSync(path.join(out, 'faces', k + '.png'))) faces[k] = `faces/${k}.png`;
  if (Object.keys(faces).length) base.faces = faces;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify(base, null, 2) + '\n');
}
console.log(`build: ${actions.map(x => x.action).join(',')} — ${nFrames} khung${a.faces ? ' + mặt' : ''} → ${out} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
