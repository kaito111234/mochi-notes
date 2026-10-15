'use strict';
// Chạy toàn bộ kiểm thử; thoát 1 nếu có lỗi.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const env = Object.assign({}, process.env, { TZ: 'Asia/Ho_Chi_Minh' });
const jobs = [
  ...['src/shared/__tests__/recur.test.js', 'src/main/alarms/__tests__/alarm.test.js', 'src/main/alarms/__tests__/memo.test.js',
    'src/main/notes/__tests__/scheduler.test.js', 'src/main/notes/__tests__/transfer.test.js'].map(f => [f, [f]]),
  ['persona (node --test)', ['--test', ...fs.readdirSync(path.join(root, 'src/main/persona/test')).filter(f => f.endsWith('.test.js')).map(f => 'src/main/persona/test/' + f)]],
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
