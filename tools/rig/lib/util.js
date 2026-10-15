'use strict';
// Tiện ích chung cho tools/rig: tham số dòng lệnh, đường dẫn, chạy Electron kết xuất.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// --khoa giá_trị | --co (cờ) ; phần còn lại vào _
function parseArgs(argv, flags = []) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (flags.includes(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) o[k] = true;
      else o[k] = argv[++i];
    } else o._.push(a);
  }
  return o;
}

function resolveFromRoot(p) { return path.isAbsolute(p) ? p : (fs.existsSync(path.resolve(p)) ? path.resolve(p) : path.resolve(ROOT, p)); }

function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Chạy Electron svg2png một lần cho nhiều job: [{svg, out, w, h}]
function renderJobs(jobs, opts = {}) {
  if (!jobs.length) return;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rigjobs-'));
  const jf = path.join(tmp, 'jobs.json');
  fs.writeFileSync(jf, JSON.stringify(jobs));
  const electron = path.join(ROOT, 'node_modules', '.bin', 'electron');
  const eargs = [path.join(ROOT, 'tools', 'rig', 'svg2png.js'), '--no-sandbox', '--disable-gpu', '--', jf];
  let cmd = electron, args = eargs;
  if (!process.env.DISPLAY) { cmd = 'xvfb-run'; args = ['-a', '-s', '-screen 0 1440x900x24', electron, ...eargs]; }
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: ROOT });
  fs.rmSync(tmp, { recursive: true, force: true });
  const noise = /bus\.cc|dbus|gpu|libva|fontconfig|vaapi|viz_main|angle|egl|gl_surface|sandbox|^\s*$/i;
  const lines = ((r.stdout || '') + '\n' + (r.stderr || '')).split('\n').filter(l => !noise.test(l));
  if (r.status !== 0) {
    throw new Error('Kết xuất Electron lỗi (mã ' + r.status + '): ' + (r.error ? r.error.message : '') + '\n' + lines.join('\n'));
  }
  if (!opts.quiet) lines.forEach(l => console.log(l));
  for (const j of jobs) if (!fs.existsSync(j.out)) throw new Error('Không thấy ảnh đầu ra: ' + j.out);
}

module.exports = { ROOT, parseArgs, resolveFromRoot, xmlEsc, renderJobs };
