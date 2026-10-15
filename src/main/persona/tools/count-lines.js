#!/usr/bin/env node
'use strict';
// In thống kê kho thoại: số câu theo event (và intent cho pre/due), tổng, kết quả validate. Exit 1 nếu có lỗi.
const fs = require('fs');
const path = require('path');
const D = require('../../../shared/dialogue.js');

const file = process.argv[2] || path.join(__dirname, '../../../../assets/dialogue/vi.json');
let lines;
try { lines = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('Không đọc được ' + file + ': ' + e.message); process.exit(1); }
if (!Array.isArray(lines)) { console.error('Kho thoại không phải mảng'); process.exit(1); }

const count = {};
for (const l of lines) count[l.event] = (count[l.event] || 0) + 1;
const events = D.EVENTS.concat(Object.keys(count).filter(k => !D.EVENTS.includes(k)));
console.log('event'.padEnd(16) + 'số câu');
for (const ev of events) console.log(ev.padEnd(16) + (count[ev] || 0));
for (const ev of ['pre', 'due']) {
  const by = {};
  for (const l of lines) if (l.event === ev) for (const i of (l.cond && l.cond.intent) || ['(chung)']) by[i] = (by[i] || 0) + 1;
  console.log('\n' + ev + ' theo intent: ' + (Object.keys(by).sort().map(k => k + '=' + by[k]).join(', ') || '(trống)'));
}
console.log('\nTổng: ' + lines.length);
const errs = D.validate(lines);
console.log(errs.length ? 'Lỗi (' + errs.length + '):\n  ' + errs.join('\n  ') : 'validate: OK');
process.exit(errs.length ? 1 : 0);
