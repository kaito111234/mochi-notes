'use strict';
// Chạy: TZ=Asia/Ho_Chi_Minh node src/main/notes/__tests__/scheduler.test.js
const assert = require('assert');
const S = require('../scheduler.js');

const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const hm = t => { const d = new Date(t); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
const day = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const mk = (text, now) => { const n = { id: 'n1', text, reminder: null }; S.applyText(n, now); return n; };
let passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { console.error('FAIL:', name); throw e; } }

const NOW = at(2026, 10, 14, 7, 0); // Thứ 4 14/10/2026 07:00

t('uống thuốc 8h sáng mỗi ngày -> reminder lặp hôm nay 8h', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  assert.ok(n.reminder, 'có reminder'); assert.ok(n.reminder.repeat); assert.strictEqual(n.reminder.repeat.freq, 'daily');
  assert.strictEqual(n.reminder.due, at(2026, 10, 14, 8, 0)); assert.strictEqual(n.reminder.auto, true);
  assert.strictEqual(n.reminder.fired, false); assert.strictEqual(n.reminder.done, false);
});
t('gõ thêm chữ không reset reminder lặp', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const r = n.reminder; r.fired = true;
  S.applyText(Object.assign(n, { text: 'uống thuốc 8h sáng mỗi ngày nhé' }), NOW + 1000);
  assert.strictEqual(n.reminder, r);
});
t('bấm xong (roll) -> mai 8h, không done vĩnh viễn', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const now = at(2026, 10, 14, 8, 5); n.reminder.fired = true; S.markDone(n);
  assert.ok(S.rollRepeat(n, now));
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 8, 0));
  assert.strictEqual(n.reminder.done, false); assert.strictEqual(n.reminder.fired, false);
});
t('xong sớm trước giờ -> vẫn sang ngày mai', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  S.rollRepeat(n, at(2026, 10, 14, 7, 50));
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 8, 0));
});
t('bỏ lỡ nhiều ngày -> roll tới lần kế > now', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const now = at(2026, 10, 20, 9, 0);
  S.rollRepeat(n, now);
  assert.strictEqual(n.reminder.due, at(2026, 10, 21, 8, 0));
});
t('lead & preFired sau roll', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  n.reminder.lead = 10 * 60000;
  S.rollRepeat(n, at(2026, 10, 14, 8, 1));
  assert.strictEqual(n.reminder.preFired, false);
  S.rollRepeat(n, at(2026, 10, 15, 7, 55)); // trong vùng lead của 8h ngày 16? due đã = 15/10 8h
  assert.strictEqual(n.reminder.due, at(2026, 10, 16, 8, 0));
});
t('weekly: thứ 2 hàng tuần 9h', () => {
  const n = mk('họp nhóm thứ 2 hàng tuần 9h', NOW);
  assert.ok(n.reminder && n.reminder.repeat, 'có lặp');
  assert.strictEqual(new Date(n.reminder.due).getDay(), 1); assert.strictEqual(hm(n.reminder.due), '9:00');
  assert.strictEqual(n.reminder.due, at(2026, 10, 19, 9, 0));
  S.rollRepeat(n, at(2026, 10, 19, 9, 30));
  assert.strictEqual(n.reminder.due, at(2026, 10, 26, 9, 0));
});
t('monthly 31 -> cuối tháng ngắn', () => {
  const n = mk('đóng tiền ngày 31 hàng tháng 9h', at(2026, 1, 15, 7, 0));
  assert.strictEqual(n.reminder.due, at(2026, 1, 31, 9, 0));
  S.rollRepeat(n, at(2026, 1, 31, 9, 1));
  assert.strictEqual(n.reminder.due, at(2026, 2, 28, 9, 0));
  S.rollRepeat(n, at(2026, 2, 28, 9, 1));
  assert.strictEqual(n.reminder.due, at(2026, 3, 31, 9, 0));
});
t('weekdays: thứ 6 -> thứ 2', () => {
  const n = mk('chấm công các ngày trong tuần 9h', at(2026, 10, 16, 7, 0));
  assert.strictEqual(n.reminder.due, at(2026, 10, 16, 9, 0));
  S.rollRepeat(n, at(2026, 10, 16, 9, 1));
  assert.strictEqual(n.reminder.due, at(2026, 10, 19, 9, 0));
});
t('mỗi sáng (không giờ) -> 08:00', () => {
  const n = mk('tập thể dục mỗi sáng', NOW);
  assert.ok(n.reminder && n.reminder.repeat);
  assert.strictEqual(hm(n.reminder.due), '8:00');
});
t('note thường 0.1 "họp 3h chiều nay" không lặp', () => {
  const n = mk('họp 3h chiều nay', NOW);
  assert.ok(n.reminder); assert.ok(!n.reminder.repeat);
  assert.strictEqual(n.reminder.due, at(2026, 10, 14, 15, 0));
  assert.strictEqual(S.rollRepeat(n, NOW), false);
});
t('note không giờ -> reminder null', () => { assert.strictEqual(mk('mua sữa', NOW).reminder, null); });
t('đặt tay (auto=false) không bị ghi đè bởi chữ lặp', () => {
  const n = { id: 'x', text: 'abc', reminder: null };
  S.setReminder(n, { due: at(2026, 10, 14, 12, 0), lead: 0 }, NOW);
  n.text = 'uống thuốc 8h sáng mỗi ngày'; const r = n.reminder; S.applyText(n, NOW);
  assert.strictEqual(n.reminder, r);
});
t('tick: không phát due hai lần cho cùng mốc', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const st = { lastNag: 0, busy: true }; const now = at(2026, 10, 14, 8, 0, 1);
  const a = S.tick([n], now, st), b = S.tick([n], now + 1000, st);
  assert.strictEqual(a.events.filter(e => e.type === 'due').length, 1);
  assert.strictEqual(b.events.filter(e => e.type === 'due').length, 0);
});
t('tick: bỏ lần cũ khi tới lần kế, không nhắc dai chồng', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const st = { lastNag: 0, busy: true };
  S.tick([n], at(2026, 10, 14, 8, 0, 1), st);                    // due hôm nay
  const r = S.tick([n], at(2026, 10, 15, 8, 0, 1), st);          // sang mai không bấm xong
  assert.strictEqual(r.events.filter(e => e.type === 'due').length, 1, 'lần mới phát đúng 1 due');
  assert.strictEqual(n.reminder.fired, true);
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 8, 0));
  const r2 = S.tick([n], at(2026, 10, 15, 8, 0, 2), st);
  assert.strictEqual(r2.events.filter(e => e.type === 'due').length, 0);
});
t('tick: bỏ lỡ nhiều ngày -> nhảy tới mốc mới nhất, phát due đúng 1 lần', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  n.reminder.fired = true; n.reminder.preFired = true;
  const r = S.tick([n], at(2026, 10, 20, 9, 0), { lastNag: Date.now(), busy: true });
  assert.deepStrictEqual(r.events.map(e => e.type), ['due']); assert.strictEqual(n.reminder.due, at(2026, 10, 20, 8, 0)); assert.ok(r.changed);
  assert.strictEqual(S.tick([n], at(2026, 10, 20, 9, 1), { lastNag: Date.now(), busy: true }).events.length, 0);
});
t('snooze note lặp giữ repeat; roll sau hoãn vẫn đúng giờ', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  const now = at(2026, 10, 14, 8, 0, 5); n.reminder.fired = true;
  assert.ok(S.snooze(n, 10, now));
  assert.ok(n.reminder.repeat); assert.strictEqual(n.reminder.due, now + 10 * 60000); assert.strictEqual(n.reminder.fired, false);
  S.markDone(n); S.rollRepeat(n, now + 11 * 60000);
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 8, 0));
});
t('setReminder giữ chữ ký 0.1; repeat:null bỏ lặp; undefined giữ lặp', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  S.setReminder(n, { due: at(2026, 10, 14, 9, 0), lead: 0 }, NOW);
  assert.ok(n.reminder.repeat && n.reminder.auto === false);
  S.setReminder(n, { due: at(2026, 10, 14, 9, 0), lead: 0, repeat: null }, NOW);
  assert.ok(!n.reminder.repeat);
});
t('setRepeat: note chưa có reminder -> 08:00 lần kế; huỷ lặp', () => {
  const n = { id: 'y', text: 'tưới cây', reminder: null };
  assert.ok(S.setRepeat(n, { freq: 'daily' }, NOW));
  assert.strictEqual(n.reminder.due, at(2026, 10, 14, 8, 0)); assert.strictEqual(n.reminder.repeat.freq, 'daily');
  assert.ok(S.setRepeat(n, null, NOW)); assert.ok(!n.reminder.repeat);
  assert.strictEqual(S.setRepeat(n, null, NOW), false);
});
t('setRepeat dùng giờ reminder hiện có; đã done thì roll', () => {
  const n = { id: 'z', text: 'x', reminder: null };
  S.setReminder(n, { due: at(2026, 10, 14, 15, 30), lead: 0 }, NOW);
  S.setRepeat(n, { freq: 'daily' }, NOW);
  assert.strictEqual(n.reminder.due, at(2026, 10, 14, 15, 30));
  n.reminder.done = true; S.setRepeat(n, { freq: 'weekdays' }, at(2026, 10, 14, 16, 0));
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 15, 30)); assert.strictEqual(n.reminder.done, false);
});
t('hourly: mỗi 2 tiếng', () => {
  const n = { id: 'h', text: 'uống nước', reminder: null };
  S.setRepeat(n, { freq: 'hourly', interval: 2 }, NOW);
  assert.strictEqual(n.reminder.due, NOW + 2 * 3600000);
  S.rollRepeat(n, NOW + 2 * 3600000 + 1);
  assert.strictEqual(n.reminder.due, NOW + 4 * 3600000);
});
t('đã bấm done lẻ (không repeat) vẫn done như 0.1', () => {
  const n = mk('họp 3h chiều nay', NOW); assert.ok(S.markDone(n)); assert.strictEqual(n.reminder.done, true);
});

t('tick: lặp chưa fired, máy tắt nhiều ngày -> đúng 1 due, nhảy mốc mới nhất', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  n.reminder.due = at(2026, 10, 10, 8, 0);
  const now = at(2026, 10, 13, 9, 0);
  const st = { lastNag: now, busy: true };
  const a = S.tick([n], now, st);
  assert.deepStrictEqual(a.events.map(e => e.type), ['due']);
  assert.strictEqual(n.reminder.due, at(2026, 10, 13, 8, 0));
  assert.strictEqual(S.tick([n], now + 1000, st).events.length, 0);
});
t('tick: hourly tắt máy lâu -> tính trực tiếp, 1 due', () => {
  const n = { id: 'h', text: 'uống nước', reminder: null };
  S.setRepeat(n, { freq: 'hourly', interval: 2 }, NOW);
  const now = NOW + 1000 * 3600000 + 5 * 60000;
  const t0 = Date.now();
  const a = S.tick([n], now, { busy: true });
  assert.ok(Date.now() - t0 < 200);
  assert.deepStrictEqual(a.events.map(e => e.type), ['due']);
  assert.strictEqual(n.reminder.due, NOW + 1000 * 3600000);
});
t('tick: nhảy mốc -> preFired đúng theo lead', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  n.reminder.lead = 10 * 60000; n.reminder.due = at(2026, 10, 10, 8, 0); n.reminder.preFired = false;
  const a = S.tick([n], at(2026, 10, 13, 9, 0), { busy: true });
  assert.deepStrictEqual(a.events.map(e => e.type), ['due']);
  assert.strictEqual(n.reminder.preFired, true);
  // roll sang mốc tương lai rồi tới vùng lead -> có 'pre'
  S.rollRepeat(n, at(2026, 10, 13, 9, 0));
  assert.strictEqual(n.reminder.preFired, false);
  assert.deepStrictEqual(S.tick([n], at(2026, 10, 14, 7, 55), { busy: true }).events.map(e => e.type), ['pre']);
});
t('setReminder giữ repeat cũ nhưng đổi giờ -> anchor theo giờ mới', () => {
  const n = mk('uống thuốc 8h sáng mỗi ngày', NOW);
  S.setReminder(n, { due: at(2026, 10, 14, 9, 30), lead: 0 }, NOW);
  assert.strictEqual(n.reminder.repeat.anchor, at(2026, 10, 14, 9, 30));
  S.rollRepeat(n, at(2026, 10, 14, 10, 0));
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 9, 30));
});
t('chữ lặp không có giờ -> không tự tạo nhắc lặp', () => {
  for (const x of ['danh sách việc hàng ngày', 'mỗi ngày', 'nộp báo cáo mỗi tuần']) {
    const n = mk(x, NOW);
    assert.ok(!n.reminder || !n.reminder.repeat, x);
  }
});
t('htmlToText tuyến tính với "<" lặp & đúng với HTML thường', () => {
  const t0 = Date.now();
  S.htmlToText('<'.repeat(1e5));
  assert.ok(Date.now() - t0 < 500);
  assert.strictEqual(S.htmlToText('<div>a &amp; b<br>c</div><p>x<b>y</b></p>'), 'a & b\nc\nxy');
  assert.strictEqual(S.htmlToText('1 < 2 <b>x</b> > 3'), '1 < 2 x > 3'.replace('1 < 2 x', '1 x'));
});
console.log('OK ' + passed + ' ca');
