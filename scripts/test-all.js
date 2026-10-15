'use strict';
// Chạy toàn bộ kiểm thử; thoát 1 nếu có lỗi.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const env = Object.assign({}, process.env, { TZ: 'Asia/Ho_Chi_Minh' });
const ls = (dir, re) => { try { return fs.readdirSync(path.join(root, dir)).filter(f => re.test(f)).sort().map(f => dir + '/' + f); } catch (_) { return []; } };
// Bộ test chạy thẳng bằng node (tự assert, thoát khác 0 nếu lỗi): shared, understand, notes, alarms.
const plain = [].concat(
  ls('src/shared/__tests__', /\.test\.js$/),
  ls('src/shared/understand/__tests__', /\.test\.js$/),
  ls('src/main/notes/__tests__', /\.test\.js$/),
  ls('src/main/alarms/__tests__', /\.test\.js$/)
);
const jobs = [
  ...plain.map(f => [f, [f]]),
  ['paper', ['src/main/paper/__tests__/paper.test.js']],
  // Node 22 không nhận thư mục cho --test: phải liệt kê file.
  ['game (node --test)', ['--test', ...ls('src/main/game/__tests__', /\.test\.js$/)]],
  ['persona (node --test)', ['--test', ...ls('src/main/persona/test', /\.test\.js$/)]],
  ['anim validate', ['tools/anim/validate.js', 'assets/pet/mochi']]
];
let bad = 0;
for (const [name, args] of jobs) {
  console.log('\n=== ' + name);
  const r = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (r.status !== 0) { bad++; console.log('FAIL: ' + name); }
}
console.log(bad ? '\n' + bad + ' bộ test lỗi' : '\nTất cả test đạt');
process.exit(bad ? 1 : 0);
