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

// ===== Nhiều nhắc trong một note (API2.md mục 3) =====
const fs = require('fs'), os = require('os'), path = require('path');
const MINMS = 60000;
// understand giả: mỗi dòng "9h30 tiêu đề" (hôm nay theo `now`); "mỗi ngày" trong tiêu đề -> lặp daily.
function fakeU(text, now) {
  const items = [];
  String(text).split('\n').forEach((l, i) => {
    const m = /^(\d{1,2})h(\d\d)? (.+)$/.exec(l.trim());
    if (!m) return;
    const b = new Date(now);
    let due = new Date(b.getFullYear(), b.getMonth(), b.getDate(), +m[1], +(m[2] || 0)).getTime();
    const rep = /mỗi ngày/.test(m[3]) ? { freq: 'daily' } : null;
    if (rep && due <= now) due += 86400000;
    items.push({ key: 'k:' + m[3].toLowerCase(), line: i, raw: l, title: m[3], due, timed: true,
      time: m[1].padStart(2, '0') + ':' + (m[2] || '00'), repeat: rep, intent: 'task', lead: 0 });
  });
  return { items };
}
S._setUnderstand(fakeU);
const mkN = (text, now = NOW) => { const n = { id: 'n' + Math.random().toString(36).slice(2, 6), text, reminder: null }; S.applyText(n, now); return n; };
const THREE = '9h họp nhóm\n12h ăn trưa\n15h gọi khách';
const types = r => r.events.map(e => e.type);
const BUSY = () => ({ lastNag: 0, busy: true });

t('migrate trong bộ nhớ: reminder đơn -> reminders [r1], cùng tham chiếu', () => {
  const r = { due: at(2026, 10, 14, 9), lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false };
  const n = { id: 'a', text: 'x', reminder: r };
  S.ensureReminders(n);
  assert.strictEqual(n.reminders.length, 1); assert.strictEqual(n.reminders[0], r); assert.strictEqual(n.reminder, r);
  assert.strictEqual(r.id, 'r1'); assert.deepStrictEqual(n.remindMuted, []);
});
t('ensureReminders idempotent', () => {
  const n = mkN(THREE); const ids = n.reminders.map(r => r.id), arr = n.reminders;
  S.ensureReminders(n); S.ensureReminders(n);
  assert.strictEqual(n.reminders, arr); assert.deepStrictEqual(n.reminders.map(r => r.id), ids);
});
t('ensureReminders: note không có gì -> mảng rỗng, reminder null', () => {
  const n = { id: 'e', text: '' }; S.ensureReminders(n);
  assert.deepStrictEqual(n.reminders, []); assert.strictEqual(n.reminder, null);
});
t('ensureReminders: reminders có nhưng reminder null -> đặt primary', () => {
  const n = mkN(THREE); n.reminder = null; S.ensureReminders(n);
  assert.strictEqual(n.reminder, n.reminders[0]);
});
t('ensureReminders: id trùng/thiếu được cấp mới', () => {
  const mkr = (h, id) => Object.assign({ due: at(2026, 10, 14, h), lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false }, id ? { id } : {});
  const n = { id: 'd', text: '', reminders: [mkr(9, 'a'), mkr(10, 'a'), mkr(11)], reminder: null };
  S.ensureReminders(n);
  assert.strictEqual(new Set(n.reminders.map(r => r.id)).size, 3);
});
t('primary: ưu tiên đã kêu chưa xong sớm nhất', () => {
  const n = mkN(THREE); n.reminders[1].fired = true; n.reminders[2].fired = true; S.syncPrimary(n);
  assert.strictEqual(n.reminder, n.reminders[1]);
});
t('primary: không fired -> chưa xong sớm nhất; xong hết -> due lớn nhất', () => {
  const n = mkN(THREE); S.syncPrimary(n); assert.strictEqual(n.reminder, n.reminders[0]);
  n.reminders.forEach(r => { r.done = true; }); S.syncPrimary(n);
  assert.strictEqual(n.reminder, n.reminders[2]);
});
t('3 việc trong ngày -> 3 nhắc auto sắp theo due, có key/title/line, id duy nhất', () => {
  const n = mkN(THREE);
  assert.strictEqual(n.reminders.length, 3);
  assert.deepStrictEqual(n.reminders.map(r => r.title), ['họp nhóm', 'ăn trưa', 'gọi khách']);
  assert.deepStrictEqual(n.reminders.map(r => r.line), [0, 1, 2]);
  assert.ok(n.reminders.every(r => r.auto && r.key)); assert.strictEqual(new Set(n.reminders.map(r => r.id)).size, 3);
  assert.strictEqual(n.reminder, n.reminders[0]);
});
t('tick: 3 việc kêu đúng thứ tự, mỗi việc 1 lần, có reminderId + title', () => {
  const n = mkN(THREE), st = BUSY();
  const a = S.tick([n], at(2026, 10, 14, 9, 0, 1), st);
  assert.deepStrictEqual(a.events.map(e => e.title), ['họp nhóm']); assert.strictEqual(a.events[0].reminderId, n.reminders[0].id);
  assert.strictEqual(n.reminder, n.reminders[0]);   // đã kêu chưa xong -> vẫn là primary
  const b = S.tick([n], at(2026, 10, 14, 15, 30), st);
  assert.deepStrictEqual(b.events.map(e => e.title), ['ăn trưa', 'gọi khách']);
  assert.strictEqual(S.tick([n], at(2026, 10, 14, 15, 31), st).events.length, 0);
});
t('tick: nhiều note, sự kiện sắp theo giờ', () => {
  const a = mkN('15h gọi khách'), b = mkN('9h họp nhóm');
  const r = S.tick([a, b], at(2026, 10, 14, 16, 0), BUSY());
  assert.deepStrictEqual(r.events.map(e => e.title), ['họp nhóm', 'gọi khách']);
  assert.deepStrictEqual(r.changedIds.sort(), [a.id, b.id].sort());
});
t('tick: nhắc tay không title -> title = tiêu đề note; có title -> dùng title', () => {
  const n = { id: 'm', text: 'Việc chung\nchi tiết', reminder: null };
  S.setReminder(n, { due: at(2026, 10, 14, 9), lead: 0 }, NOW);
  S.upsertReminder(n, null, { due: at(2026, 10, 14, 10), title: 'Mục riêng' }, NOW);
  const r = S.tick([n], at(2026, 10, 14, 11), BUSY());
  assert.deepStrictEqual(r.events.map(e => e.title), ['Việc chung', 'Mục riêng']);
});
t('tick: pre theo từng nhắc', () => {
  const n = mkN(THREE); n.reminders[1].lead = 10 * MINMS; n.reminders[1].preFired = false; n.reminders[0].done = true;
  const r = S.tick([n], at(2026, 10, 14, 11, 55), BUSY());
  assert.deepStrictEqual(types(r), ['pre']); assert.strictEqual(r.events[0].reminderId, n.reminders[1].id);
});
t('markDone theo id không ảnh hưởng mục khác', () => {
  const n = mkN(THREE); const [a, b, c] = n.reminders;
  assert.ok(S.markDone(n, b.id));
  assert.strictEqual(a.done, false); assert.strictEqual(b.done, true); assert.strictEqual(c.done, false);
});
t('markDone mặc định primary rồi primary chuyển sang mục kế', () => {
  const n = mkN(THREE); const [a, b] = n.reminders;
  S.markDone(n); assert.strictEqual(a.done, true); assert.strictEqual(n.reminder, b);
  assert.strictEqual(S.markDone(n, 'khong-co'), false);
});
t('tick bỏ qua nhắc đã done, vẫn kêu các nhắc còn lại', () => {
  const n = mkN(THREE); S.markDone(n, n.reminders[0].id);
  assert.deepStrictEqual(S.tick([n], at(2026, 10, 14, 9, 30), BUSY()).events.length, 0);
  assert.strictEqual(S.tick([n], at(2026, 10, 14, 12, 0, 1), BUSY()).events.length, 1);
});
t('snooze theo id: chỉ mục đó dời, auto=false, mục khác nguyên vẹn', () => {
  const n = mkN(THREE); const [a, b] = n.reminders; const now = at(2026, 10, 14, 9, 1);
  S.tick([n], now, BUSY());
  assert.ok(S.snooze(n, 15, now, a.id));
  assert.strictEqual(a.due, now + 15 * MINMS); assert.strictEqual(a.auto, false); assert.strictEqual(a.fired, false);
  assert.strictEqual(b.due, at(2026, 10, 14, 12)); assert.strictEqual(b.auto, true);
  assert.strictEqual(S.snooze(n, 5, now, 'zzz'), false);
});
t('snooze rồi tick: kêu lại đúng mục và thứ tự theo due mới', () => {
  const n = mkN(THREE); const a = n.reminders[0]; const now = at(2026, 10, 14, 9, 1);
  S.tick([n], now, BUSY()); S.snooze(n, 5, now, a.id);
  const r = S.tick([n], now + 5 * MINMS, BUSY());
  assert.deepStrictEqual(r.events.map(e => e.reminderId), [a.id]);
});
t('applyText giữ trạng thái khi gõ thêm chữ (cùng object, cùng id)', () => {
  const n = mkN(THREE); const objs = n.reminders.slice(), ids = objs.map(r => r.id);
  S.tick([n], at(2026, 10, 14, 9, 0, 1), BUSY());
  n.text += '\nghi chú thêm'; S.applyText(n, at(2026, 10, 14, 9, 0, 5));
  assert.deepStrictEqual(n.reminders.map(r => r.id), ids);
  n.reminders.forEach((r, i) => assert.strictEqual(r, objs[i]));
  assert.strictEqual(objs[0].fired, true); assert.strictEqual(objs[1].fired, false);
});
t('applyText gõ từng ký tự 60 lần: id không đổi', () => {
  const n = mkN(THREE); const ids = n.reminders.map(r => r.id);
  for (let i = 0; i < 60; i++) { n.text += '\nx'; S.applyText(n, NOW + i * 1000); }
  assert.deepStrictEqual(n.reminders.map(r => r.id), ids);
});
t('applyText: đổi giờ một ý -> chỉ ý đó reset', () => {
  const n = mkN(THREE); n.reminders.forEach(r => { r.fired = true; r.done = true; });
  const objs = n.reminders.slice();
  n.text = '9h họp nhóm\n13h ăn trưa\n15h gọi khách'; S.applyText(n, NOW);
  const lunch = n.reminders.find(r => r.key === 'k:ăn trưa');
  assert.strictEqual(lunch, objs[1]); assert.strictEqual(lunch.due, at(2026, 10, 14, 13));
  assert.strictEqual(lunch.fired, false); assert.strictEqual(lunch.done, false);
  assert.strictEqual(objs[0].done, true); assert.strictEqual(objs[2].done, true);
});
t('applyText: xoá một dòng -> bỏ nhắc auto đó, giữ còn lại', () => {
  const n = mkN(THREE); const keep = n.reminders[0];
  n.text = '9h họp nhóm\n15h gọi khách'; S.applyText(n, NOW);
  assert.deepStrictEqual(n.reminders.map(r => r.title), ['họp nhóm', 'gọi khách']); assert.strictEqual(n.reminders[0], keep);
});
t('applyText: xoá hết giờ trong chữ -> hết nhắc auto, primary null', () => {
  const n = mkN(THREE); n.text = 'mua sữa'; S.applyText(n, NOW);
  assert.strictEqual(n.reminders.length, 0); assert.strictEqual(n.reminder, null);
});
t('applyText: nhắc quá giờ đã kêu mà chữ vẫn còn -> giữ để nhắc dai', () => {
  const n = mkN(THREE); const lunch = n.reminders[1];
  const now = at(2026, 10, 14, 13, 0); S.tick([n], now, BUSY());
  n.text += '\n '; S.applyText(n, now + 1000);
  assert.ok(n.reminders.includes(lunch)); assert.strictEqual(lunch.fired, true);
  assert.strictEqual(S.overdueNotes([n], at(2026, 10, 14, 13, 0) + 20 * MINMS).length, 1);
});
t('applyText: nhắc đã kêu nhưng dòng bị xoá -> bỏ (không còn ý cùng due)', () => {
  const n = mkN(THREE); const now = at(2026, 10, 14, 13, 0); S.tick([n], now, BUSY());
  n.text = '15h gọi khách'; S.applyText(n, now + 1000);
  assert.deepStrictEqual(n.reminders.map(r => r.title), ['gọi khách']);
});
t('applyText: ý quá giờ chưa từng có nhắc -> không tạo', () => {
  const n = mkN('6h dậy sớm\n9h họp', NOW);
  assert.deepStrictEqual(n.reminders.map(r => r.title), ['họp']);
});
t('applyText: sửa tiêu đề cùng giờ -> giữ id/trạng thái, cập nhật key/title', () => {
  const n = mkN(THREE); const a = n.reminders[0]; a.fired = true; const id = a.id;
  n.text = '9h họp nhóm dự án\n12h ăn trưa\n15h gọi khách'; S.applyText(n, NOW + 1000);
  assert.strictEqual(n.reminders[0], a); assert.strictEqual(a.id, id); assert.strictEqual(a.fired, true);
  assert.strictEqual(a.title, 'họp nhóm dự án'); assert.strictEqual(a.key, 'k:họp nhóm dự án');
});
t('mute: xoá nhắc auto -> không tạo lại khi gõ chữ', () => {
  const n = mkN(THREE); const lunch = n.reminders[1];
  assert.ok(S.removeReminder(n, lunch.id)); assert.deepStrictEqual(n.remindMuted, ['k:ăn trưa']);
  n.text += '\n!'; S.applyText(n, NOW); S.applyText(n, NOW + 1);
  assert.deepStrictEqual(n.reminders.map(r => r.title), ['họp nhóm', 'gọi khách']);
});
t('mute: upsert cùng key (thêm lại) bỏ mute', () => {
  const n = mkN(THREE); S.removeReminder(n, n.reminders[1].id);
  const r = S.upsertReminder(n, null, { due: at(2026, 10, 14, 12), key: 'k:ăn trưa', title: 'ăn trưa', auto: true }, NOW);
  assert.ok(r); assert.deepStrictEqual(n.remindMuted, []);
  n.text += '\n.'; S.applyText(n, NOW);
  assert.strictEqual(n.reminders.filter(x => x.key === 'k:ăn trưa').length, 1);
  assert.strictEqual(n.reminders.find(x => x.key === 'k:ăn trưa'), r);
});
t('mute giới hạn 50, bỏ cái cũ nhất', () => {
  const n = { id: 'mm', text: '', reminder: null };
  for (let i = 0; i < 55; i++) {
    const r = S.upsertReminder(n, null, { due: NOW + 1000 * (i + 1), key: 'k' + i, auto: true }, NOW);
    S.removeReminder(n, r.id);
  }
  assert.strictEqual(n.remindMuted.length, 50); assert.strictEqual(n.remindMuted[0], 'k5');
});
t('nhắc tay không bị applyText đụng; nhắc tay cùng key chặn sinh auto', () => {
  const n = mkN('9h họp nhóm\n15h gọi khách'); const first = n.reminders[0];
  S.snooze(n, 30, NOW, first.id);        // thành tay, giữ key
  const due = first.due; n.text += '\n'; S.applyText(n, NOW + 1000);
  assert.strictEqual(first.due, due); assert.strictEqual(n.reminders.length, 2);
  const man = S.upsertReminder(n, null, { due: at(2026, 10, 14, 20), title: 'Tay' }, NOW);
  S.applyText(n, NOW + 2000); assert.ok(n.reminders.includes(man)); assert.strictEqual(n.reminders.length, 3);
});
t('nhắc tay không key + chỉ một ý trong chữ -> như 0.1 (không sinh thêm)', () => {
  const n = { id: 'x', text: 'abc', reminder: null };
  S.setReminder(n, { due: at(2026, 10, 14, 20), lead: 0 }, NOW);
  n.text = '9h họp'; S.applyText(n, NOW); assert.strictEqual(n.reminders.length, 1);
});
t('lặp + thường lẫn lộn: 2 nhắc, một có repeat', () => {
  const n = mkN('8h uống thuốc mỗi ngày\n15h họp');
  assert.strictEqual(n.reminders.length, 2);
  assert.strictEqual(n.reminders[0].repeat.freq, 'daily'); assert.ok(!n.reminders[1].repeat);
  assert.strictEqual(n.reminders[0].due, at(2026, 10, 14, 8));
});
t('lặp: gõ thêm không reset nhắc lặp đã kêu', () => {
  const n = mkN('8h uống thuốc mỗi ngày\n15h họp'); const r = n.reminders[0];
  S.tick([n], at(2026, 10, 14, 8, 0, 1), BUSY()); assert.strictEqual(r.fired, true);
  n.text += '\nnhé'; S.applyText(n, at(2026, 10, 14, 8, 1));
  assert.ok(n.reminders.includes(r)); assert.strictEqual(r.fired, true);
});
t('tắt máy qua nhiều chu kỳ: mỗi nhắc báo đúng 1 lần', () => {
  const n = mkN('8h uống thuốc mỗi ngày\n15h họp'); const st = BUSY();
  const a = S.tick([n], at(2026, 10, 19, 16, 0), st);
  assert.deepStrictEqual(a.events.map(e => e.title).sort(), ['họp', 'uống thuốc mỗi ngày']);
  assert.strictEqual(n.reminders.find(r => r.repeat).due, at(2026, 10, 19, 8));
  assert.strictEqual(S.tick([n], at(2026, 10, 19, 16, 0, 1), st).events.length, 0);
  const b = S.tick([n], at(2026, 10, 20, 16, 0), st);
  assert.deepStrictEqual(b.events.map(e => e.title), ['uống thuốc mỗi ngày']);
});
t('done một nhắc lặp rồi roll theo id: mục thường không đổi', () => {
  const n = mkN('8h uống thuốc mỗi ngày\n15h họp'); const [d, h] = n.reminders; const now = at(2026, 10, 14, 8, 5);
  S.tick([n], now, BUSY()); S.markDone(n, d.id);
  assert.ok(S.rollRepeat(n, now, d.id)); assert.strictEqual(d.due, at(2026, 10, 15, 8)); assert.strictEqual(d.done, false);
  assert.strictEqual(h.due, at(2026, 10, 14, 15)); assert.strictEqual(S.rollRepeat(n, now, h.id), false);
});
t('setRepeat theo id: chỉ mục đó; id lạ -> false; huỷ lặp theo id', () => {
  const n = mkN(THREE); const [a, b] = n.reminders;
  assert.ok(S.setRepeat(n, { freq: 'daily' }, NOW, b.id)); assert.ok(b.repeat && !a.repeat && b.auto === false);
  assert.strictEqual(S.setRepeat(n, { freq: 'daily' }, NOW, 'zzz'), false);
  assert.ok(S.setRepeat(n, null, NOW, b.id)); assert.ok(!b.repeat);
});
t('setRepeat không id, note trống: tạo nhắc mới vào mảng', () => {
  const n = { id: 'q', text: 'tưới cây' }; assert.ok(S.setRepeat(n, { freq: 'daily' }, NOW));
  assert.strictEqual(n.reminders.length, 1); assert.strictEqual(n.reminder, n.reminders[0]);
});
t('overdueNotes: bất kỳ nhắc fired&&!done quá NAG_AFTER; sắp theo due sớm nhất', () => {
  const a = mkN('9h họp'), b = mkN('8h dậy\n15h gọi'), c = mkN('20h x');
  const now = at(2026, 10, 14, 16, 0); S.tick([a, b, c], now, BUSY());
  assert.deepStrictEqual(S.overdueNotes([a, b, c], now).map(n => n.id), [b.id, a.id]);
  S.markDone(a, a.reminders[0].id); assert.deepStrictEqual(S.overdueNotes([a, b, c], now).map(n => n.id), [b.id]);
});
t('nag gom theo note: 1 sự kiện, overdueCount = số note', () => {
  const a = mkN('9h họp\n10h gọi'), b = mkN('9h khác'); const now = at(2026, 10, 14, 12, 0);
  const st = { lastNag: 0, busy: false };
  const r = S.tick([a, b], now, st);
  const nag = r.events.filter(e => e.type === 'nag');
  assert.strictEqual(nag.length, 1); assert.strictEqual(nag[0].overdueCount, 2);
});
t('setReminder(null) xoá primary; auto có key -> mute; primary chuyển sang mục kế', () => {
  const n = mkN(THREE); const [a, b] = n.reminders;
  assert.strictEqual(S.setReminder(n, null, NOW), null);
  assert.strictEqual(n.reminders.length, 2); assert.strictEqual(n.reminder, b); assert.ok(n.remindMuted.includes(a.key));
});
t('setReminder(null) nhắc tay không key: không mute', () => {
  const n = { id: 'k', text: 'x' }; S.setReminder(n, { due: NOW + 5e5 }, NOW);
  S.setReminder(n, null, NOW); assert.strictEqual(n.reminder, null); assert.deepStrictEqual(n.remindMuted, []);
});
t('setReminder sửa primary tại chỗ (giữ id & tham chiếu), auto=false', () => {
  const n = mkN(THREE); const a = n.reminders[0], id = a.id;
  const out = S.setReminder(n, { due: at(2026, 10, 14, 9, 30), lead: 0 }, NOW);
  assert.strictEqual(out, a); assert.strictEqual(a.id, id); assert.strictEqual(a.auto, false); assert.strictEqual(a.title, 'họp nhóm');
});
t('upsertReminder: sửa theo id giữ tham chiếu; id lạ -> null; sắp lại theo due', () => {
  const n = mkN(THREE); const a = n.reminders[0];
  const r = S.upsertReminder(n, a.id, { due: at(2026, 10, 14, 18) }, NOW);
  assert.strictEqual(r, a); assert.strictEqual(n.reminders[2], a); assert.strictEqual(n.reminder, n.reminders[0]);
  assert.strictEqual(S.upsertReminder(n, 'nope', { due: NOW }, NOW), null);
  assert.strictEqual(S.upsertReminder(n, null, {}, NOW), null);
});
t('upsertReminder: cùng key không nhân đôi; tối đa 20', () => {
  const n = { id: 'u', text: '' };
  S.upsertReminder(n, null, { due: NOW + 1e6, key: 'k:a' }, NOW); S.upsertReminder(n, null, { due: NOW + 2e6, key: 'k:a' }, NOW);
  assert.strictEqual(n.reminders.length, 1);
  for (let i = 0; i < 30; i++) S.upsertReminder(n, null, { due: NOW + 1e6 + i * 1000, key: 'k' + i }, NOW);
  assert.strictEqual(n.reminders.length, 20);
});
t('removeReminder: id lạ -> false; nhắc tay không key không mute', () => {
  const n = { id: 'r', text: '' }; const r = S.upsertReminder(n, null, { due: NOW + 1e6 }, NOW);
  assert.strictEqual(S.removeReminder(n, 'zz'), false); assert.ok(S.removeReminder(n, r.id));
  assert.deepStrictEqual(n.remindMuted, []); assert.strictEqual(n.reminder, null);
});
t('hành vi 0.1 khi không có understand (null) và khi understand ném lỗi', () => {
  for (const fn of [null, () => { throw new Error('x'); }, () => ({ items: 'bad' })]) {
    S._setUnderstand(fn);
    const n = mkN('họp 3h chiều nay');
    assert.strictEqual(n.reminders.length, 1); assert.strictEqual(n.reminder.due, at(2026, 10, 14, 15)); assert.ok(!n.reminder.key);
    const r = n.reminder; n.text += ' nhé'; S.applyText(n, NOW + 1000); assert.strictEqual(n.reminder, r);
    const m = mkN('uống thuốc 8h sáng mỗi ngày'); assert.strictEqual(m.reminder.repeat.freq, 'daily');
  }
  S._setUnderstand(fakeU);
});
t('0.1 không understand: nhắc auto quá hạn vẫn giữ để nhắc dai', () => {
  S._setUnderstand(null);
  const n = mkN('họp 3h chiều nay'); const r = n.reminder; S.tick([n], at(2026, 10, 14, 15, 0, 1), BUSY());
  S.applyText(n, at(2026, 10, 14, 15, 30)); assert.strictEqual(n.reminder, r); assert.strictEqual(r.fired, true);
  S._setUnderstand(fakeU);
});
t('migrate nhắc auto 0.1 chưa có key sang understand: nhận key, giữ object', () => {
  const n = { id: 'old', text: '9h họp', reminder: { due: at(2026, 10, 14, 9), lead: 0, intent: 'task', auto: true, preFired: false, fired: true, done: false } };
  const r = n.reminder; S.applyText(n, NOW);
  assert.strictEqual(n.reminder, r); assert.strictEqual(r.key, 'k:họp'); assert.strictEqual(r.fired, true); assert.strictEqual(r.id, 'r1');
});
t('giới hạn 20 nhắc từ chữ', () => {
  const lines = []; for (let i = 0; i < 30; i++) lines.push('9h việc ' + i);
  assert.strictEqual(mkN(lines.join('\n')).reminders.length, 20);
});

// ----- store: normalizeNote qua createStore (JSON round-trip) -----
const { createStore } = require('../../store.js');
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-rem-'));
const writeData = (dir, notes) => fs.writeFileSync(path.join(dir, 'mochi-data.json'), JSON.stringify({ version: 2, notes, settings: {} }));
t('store: file 0.1 có reminder đơn -> reminders [r1], reminder cùng tham chiếu', () => {
  const d = tmpDir();
  writeData(d, [{ id: 'a', text: 'x', reminder: { due: NOW, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false } }]);
  const n = createStore(d).notes[0];
  assert.strictEqual(n.reminders.length, 1); assert.strictEqual(n.reminders[0].id, 'r1'); assert.strictEqual(n.reminder, n.reminders[0]);
  assert.deepStrictEqual(n.remindMuted, []);
});
t('store: round-trip nhiều nhắc giữ primary cùng tham chiếu, kể cả sau tick', () => {
  const d = tmpDir(); const st = createStore(d);
  const n = mkN(THREE); n.id = 'tri'; n.html = ''; st.notes.push(Object.assign({ color: 'yellow' }, n));
  const note = st.notes[0]; S.tick([note], at(2026, 10, 14, 12, 0, 1), BUSY()); S.removeReminder(note, note.reminders[2].id);
  st.save(); st.flushSync();
  const n2 = createStore(d).notes[0];
  assert.strictEqual(n2.reminders.length, 2); assert.strictEqual(n2.reminder, n2.reminders.find(r => r === n2.reminder));
  assert.deepStrictEqual(n2.reminders.map(r => [r.id, r.title, r.fired]), note.reminders.map(r => [r.id, r.title, r.fired]));
  assert.deepStrictEqual(n2.remindMuted, note.remindMuted);
  S.markDone(n2, n2.reminders[0].id); assert.strictEqual(n2.reminder, n2.reminders[1]);
});
t('store: bỏ phần tử hỏng, id trùng/thiếu cấp mới, sắp theo due, muted lọc', () => {
  const d = tmpDir(); const mk = (h, extra) => Object.assign({ due: at(2026, 10, 14, h), lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false }, extra);
  writeData(d, [{ id: 'b', text: '', reminders: [mk(15, { id: 'x' }), null, { due: 'abc' }, mk(9, { id: 'x' }), mk(12), 5], remindMuted: ['k:a', 7, 'k:a', '', 'k:b'] }]);
  const n = createStore(d).notes[0];
  assert.strictEqual(n.reminders.length, 3); assert.strictEqual(new Set(n.reminders.map(r => r.id)).size, 3);
  assert.deepStrictEqual(n.reminders.map(r => r.due), [at(2026, 10, 14, 9), at(2026, 10, 14, 12), at(2026, 10, 14, 15)]);
  assert.deepStrictEqual(n.remindMuted, ['k:a', 'k:b']); assert.strictEqual(n.reminder, n.reminders[0]);
});
t('store: cắt 20 nhắc, 50 muted; reminders rỗng + reminder đơn -> migrate', () => {
  const d = tmpDir(); const many = []; for (let i = 0; i < 30; i++) many.push({ due: NOW + i * 1000 });
  writeData(d, [
    { id: 'c', text: '', reminders: many, remindMuted: Array.from({ length: 60 }, (_, i) => 'k' + i) },
    { id: 'd', text: '', reminders: [], reminder: { due: NOW + 5 } }
  ]);
  const [c, e] = createStore(d).notes;
  assert.strictEqual(c.reminders.length, 20); assert.strictEqual(c.remindMuted.length, 50);
  assert.strictEqual(e.reminders.length, 1); assert.strictEqual(e.reminders[0].id, 'r1');
});
t('store: lặp + title/key/line được giữ qua round-trip', () => {
  const d = tmpDir();
  writeData(d, [{ id: 'g', text: '', reminders: [{ id: 'z1', due: NOW, auto: true, title: 'Uống thuốc', key: 'k:uống thuốc', line: 2, repeat: { freq: 'daily', anchor: NOW } }] }]);
  const r = createStore(d).notes[0].reminders[0];
  assert.deepStrictEqual([r.id, r.title, r.key, r.line, r.repeat.freq], ['z1', 'Uống thuốc', 'k:uống thuốc', 2, 'daily']);
});
S._setUnderstand(undefined);

console.log('OK ' + passed + ' ca');
