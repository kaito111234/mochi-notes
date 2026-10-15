'use strict';
// BUG-012 (giờ đã qua), BUG-025 (kẹp lead), BUG-024 (nextWake), BUG-031 (giữ trường lạ), BUG-028 (xưng hô).
// Chạy: TZ=Asia/Ho_Chi_Minh node src/main/notes/__tests__/fixes.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('../scheduler.js');
const L = require('../insightLogic.js');

const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const mk = (text, now) => { const n = { id: 'n1', text, reminder: null }; S.applyText(n, now); return n; };
let passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { console.error('FAIL:', name); throw e; } }

const EVE = at(2026, 10, 15, 20, 0);

t('BUG-012: "họp 3h chiều nay" lúc 20h -> có nhắc đánh dấu past, không kêu, không nhắc dai', () => {
  const n = mk('họp 3h chiều nay', EVE);
  assert.ok(n.reminder, 'không im lặng: có reminder');
  assert.strictEqual(n.reminder.past, true);
  assert.strictEqual(n.reminder.due, at(2026, 10, 15, 15, 0));
  assert.strictEqual(n.reminder.fired, true);
  assert.strictEqual(n.reminder.done, false);
  for (const dt of [0, 1000, 60000, 3600000, 5 * 3600000]) {
    const r = S.tick([n], EVE + dt, { lastNag: 0, busy: false });
    assert.deepStrictEqual(r.events, [], 'không bắn chuông/nag +' + dt);
  }
});
t('BUG-012: gõ thêm chữ không tạo lại/đổi id; Xong được', () => {
  const n = mk('họp 3h chiều nay', EVE);
  const r = n.reminder;
  S.applyText(Object.assign(n, { text: 'họp 3h chiều nay nhé' }), EVE + 5000);
  assert.strictEqual(n.reminders.length, 1);
  assert.strictEqual(n.reminder.id, r.id);
  assert.strictEqual(n.reminder.past, true);
  assert.ok(S.markDone(n));
});
t('BUG-012: isPastToday chỉ đúng với giờ đã qua TRONG HÔM NAY', () => {
  assert.strictEqual(S.isPastToday(at(2026, 10, 15, 15, 0), EVE), true);
  assert.strictEqual(S.isPastToday(at(2026, 10, 14, 15, 0), EVE), false);
  assert.strictEqual(S.isPastToday(at(2026, 10, 15, 21, 0), EVE), false);
});
t('BUG-012: sửa nhắc tương lai thành giờ đã qua -> past, không kêu ngay', () => {
  const n = mk('họp 22h', EVE);
  assert.ok(!n.reminder.past && n.reminder.due > EVE);
  S.applyText(Object.assign(n, { text: 'họp 3h chiều nay' }), EVE + 1000);
  assert.strictEqual(n.reminders.length, 1);
  assert.strictEqual(n.reminder.past, true);
  assert.deepStrictEqual(S.tick([n], EVE + 2000, { lastNag: 0, busy: false }).events, []);
});
t('BUG-012: hoãn xoá dấu past', () => {
  const n = mk('họp 3h chiều nay', EVE);
  assert.ok(S.snooze(n, 10, EVE));
  assert.ok(!n.reminder.past && n.reminder.due === EVE + 600000 && !n.reminder.fired);
});
t('BUG-012: buildPastReply nêu giờ đã qua', () => {
  const s = L.buildPastReply('Họp', [{ title: 'Họp', due: at(2026, 10, 15, 15, 0) }], EVE);
  assert.ok(/15:00/.test(s) && /đã qua/.test(s) && s.length <= 120, s);
});

t('BUG-025: "gọi khách 2 phút nữa" -> không báo trước 5 phút', () => {
  const now = at(2026, 10, 15, 9, 0);
  const n = mk('gọi khách 2 phút nữa', now);
  assert.ok(n.reminder);
  assert.strictEqual(n.reminder.lead, 0);
  const evs = S.tick([n], n.reminder.due - 60000, { lastNag: 0, busy: false }).events;
  assert.deepStrictEqual(evs, []);
  assert.strictEqual(S.tick([n], n.reminder.due, { lastNag: 0, busy: false }).events[0].type, 'due');
});
t('BUG-025: còn đủ thời gian thì giữ lead; clampLead', () => {
  assert.strictEqual(S.clampLead(300000, 1e9 + 600000, 1e9), 300000);
  assert.strictEqual(S.clampLead(300000, 1e9 + 300000, 1e9), 0);
  assert.strictEqual(S.clampLead(300000, 1e9 + 1000, 1e9), 0);
  assert.strictEqual(S.clampLead(-5, 1e9 + 1000, 1e9), 0);
});

t('BUG-024: nextWake khớp mốc: tick đúng mốc thì có sự kiện, trước mốc thì không', () => {
  const now = at(2026, 10, 15, 9, 0);
  const n = { id: 'a', text: 'x', reminder: null, reminders: [
    { id: 'r1', due: now + 3600000, lead: 600000, intent: 'meet', auto: false, preFired: false, fired: false, done: false },
    { id: 'r2', due: now + 7200000, lead: 0, intent: 'task', auto: false, preFired: false, fired: false, done: false }] };
  const w = S.nextWake([n], now, { lastNag: now });
  assert.strictEqual(w, now + 3600000 - 600000);
  assert.deepStrictEqual(S.tick([n], w - 1, { lastNag: now, busy: false }).events, []);
  assert.strictEqual(S.tick([n], w, { lastNag: now, busy: false }).events[0].type, 'pre');
  assert.strictEqual(S.nextWake([n], w, { lastNag: now }), now + 3600000);
});
t('BUG-024: không có nhắc / chỉ nhắc đã xong -> Infinity; nhắc past không tính nag', () => {
  assert.strictEqual(S.nextWake([], 1, {}), Infinity);
  assert.strictEqual(S.nextWake([{ id: 'a', reminders: [{ due: 5, done: true, fired: true }] }], 10, {}), Infinity);
  assert.strictEqual(S.nextWake([mk('họp 3h chiều nay', EVE)], EVE, { lastNag: EVE }), Infinity);
});
t('BUG-024: nhắc quá hạn chưa xong -> mốc nag đúng', () => {
  const n = { id: 'a', reminders: [{ id: 'r1', due: 1000, lead: 0, intent: 'task', auto: false, preFired: true, fired: true, done: false }] };
  assert.strictEqual(S.nextWake([n], 2000, { lastNag: 2000 }), Math.max(1000 + S.NAG_AFTER + 1, 2000 + S.NAG_EVERY));
});
t('BUG-024: nhắc lặp đã kêu -> mốc là lần lặp kế', () => {
  const now = at(2026, 10, 15, 9, 0);
  const n = mk('uống thuốc 8h sáng mỗi ngày', at(2026, 10, 15, 7, 0));
  S.tick([n], now, { lastNag: now, busy: false });
  const w = S.nextWake([n], now, { lastNag: now });
  assert.ok(w <= at(2026, 10, 16, 8, 0) && w > now, new Date(w).toString());
});

t('BUG-031: store giữ trường lạ trên note và reminder (cả reminders[])', () => {
  const { createStore } = require('../../store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-fx-'));
  const rem = { due: 1, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false, snoozedUntil: 99 };
  fs.writeFileSync(path.join(dir, 'mochi-data.json'), JSON.stringify({ notes: [{ id: 'n_1', pinned: true, zoom: 1.5, __proto__x: 1, reminder: rem, reminders: [Object.assign({ id: 'r1', past: true }, rem)] }] }));
  const s = createStore(dir);
  s.save(); s.flushSync();
  const n = JSON.parse(fs.readFileSync(path.join(dir, 'mochi-data.json'), 'utf8')).notes[0];
  assert.strictEqual(n.pinned, true); assert.strictEqual(n.zoom, 1.5);
  assert.strictEqual(n.reminder.snoozedUntil, 99); assert.strictEqual(n.reminders[0].past, true);
  assert.strictEqual(({}).pinned, undefined);
});

t('BUG-028: note mẫu xưng tớ/cậu', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'noteService.js'), 'utf8');
  const guide = src.slice(src.indexOf('const guide'), src.indexOf('const n1'));
  assert.ok(/tớ/.test(guide) && /cậu/.test(guide));
  assert.ok(!/mình|bạn/.test(guide));
});

console.log('fixes.test.js: ' + passed + ' ca xanh');
