'use strict';
// Dựng ảnh bán thân 256x256 cho 18 khoá mặt đầu của rig.json → <out>/faces/<key>.png
// Chạy: node tools/rig/faces.js [--rig ...] [--parts dir] [--out assets/pet/mochi]
const fs = require('fs');
const path = require('path');
const { loadRig } = require('./lib/rig');
const { ROOT, parseArgs, resolveFromRoot, renderJobs } = require('./lib/util');

const CROP = [92, 60, 216, 216]; // từ chóp ahoge tới ngực, mặt ~70% chiều cao

function faceJobs(R, outDir) {
  const jobs = [], missing = [];
  for (const key of R.rig.faces.slice(0, 18)) {
    if (R.readPart(`face/${key}.svg`) == null) { missing.push(key); continue; }
    jobs.push({ svg: R.frameSvg({ face: key }, { viewBox: CROP, size: [256, 256] }), out: path.join(outDir, 'faces', key + '.png'), w: 256, h: 256 });
  }
  if (missing.length) console.warn(`[rig] chưa có mặt (bỏ qua ${missing.length}): ${missing.join(', ')}`);
  return jobs;
}

if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  const R = loadRig(resolveFromRoot(a.rig || 'art/rig/mochi/rig.json'), a.parts);
  const out = path.resolve(a.out || path.join(ROOT, 'assets/pet/mochi'));
  const jobs = faceJobs(R, out);
  renderJobs(jobs);
  console.log(`faces: ${jobs.length} ảnh → ${out}/faces`);
}
module.exports = { faceJobs };
