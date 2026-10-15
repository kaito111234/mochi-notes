'use strict';
// Chạy mọi test/unit/*.test.js lần lượt với TZ=Asia/Ho_Chi_Minh rồi America/New_York. Thoát 1 nếu có lỗi.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(__dirname, f));
let bad = 0;
for (const tz of ['Asia/Ho_Chi_Minh', 'America/New_York']) {
  console.log('\n=== TZ=' + tz + ' ===');
  const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: tz }) });
  if (r.status !== 0) bad++;
}
process.exit(bad ? 1 : 0);
