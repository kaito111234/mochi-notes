'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const eco = require('../logic/economy');
const { defaults } = require('../logic/box');
const { dayKey, weekKey, isYesterday, addDays } = require('../logic/time');

const T = (d, h = 12, m = 0) => new Date(2026, 0, d, h, m, 0).getTime(); // giờ địa phương
const HOUR = 3600000;
const oldNote = now => ({ createdAt: now - 3 * 60000, reminder: { due: 1 } });

test('time: dayKey, weekKey, addDays, isYesterday', () => {
  assert.equal(dayKey(T(5, 23, 59)), '2026-01-05');
  assert.equal(weekKey(T(7)), '2026-01-05'); // 07/01/2026 là thứ Tư -> thứ Hai 05
  assert.equal(weekKey(T(11)), '2026-01-05'); // Chủ nhật
  assert.equal(weekKey(T(12)), '2026-01-12');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.ok(isYesterday('2025-12-31', '2026-01-01'));
  assert.ok(!isYesterday('2026-01-01', '2026-01-01'));
  assert.ok(!isYesterday('', '2026-01-01'));
});

test('xong note: 10 + 5 đúng hạn, tính xu và exp', () => {
  const now = T(5);
  const box2 = defaults();
  const r2 = eco.onDone(box2, { noteId: 'a', onTime: true, note: oldNote(now), now });
  assert.equal(r2.candy, 15); assert.equal(r2.exp, 15); assert.equal(r2.reason, 'done');
  assert.equal(box2.stats.candy, 115);
  assert.equal(box2.stats.mood, 73); assert.equal(box2.stats.affection, 1);
  assert.equal(box2.counters.done, 1); assert.equal(box2.counters.onTime, 1);
  assert.deepEqual(box2.log, [{ day: '2026-01-05', done: 1, coins: 15 }]);
});

test('onTime undefined tính là đúng hạn; false thì chỉ +10', () => {
  const now = T(5);
  assert.equal(eco.onDone(defaults(), { noteId: 'a', note: oldNote(now), now }).candy, 15);
  assert.equal(eco.onDone(defaults(), { noteId: 'a', onTime: false, note: oldNote(now), now }).candy, 10);
});

test('việc dài hạn (>= 24 giờ): +20', () => {
  const now = T(5), box = defaults();
  const r = eco.onDone(box, { noteId: 'a', onTime: true, note: { createdAt: now - 25 * HOUR }, now });
  assert.equal(r.candy, 10 + 5 + 20); assert.equal(r.exp, 35);
  assert.equal(box.counters.longTerm, 1);
});

test('note < 2 phút: không thưởng, không đếm done, null', () => {
  const now = T(5), box = defaults();
  assert.equal(eco.onDone(box, { noteId: 'a', note: { createdAt: now - 119000 }, now }), null);
  assert.equal(box.counters.done, 0); assert.equal(box.stats.candy, 100);
  assert.equal(box.stats.streak.count, 0);
  // đủ 2 phút thì được (khoá chưa bị đốt)
  assert.ok(eco.onDone(box, { noteId: 'a', note: { createdAt: now - 120000 }, now }));
});

test('note thiếu createdAt: coi như đủ tuổi', () => {
  const box = defaults();
  assert.equal(eco.onDone(box, { noteId: 'a', note: {}, now: T(5) }).candy, 15);
  assert.equal(eco.onDone(box, { noteId: 'b', now: T(5) }).candy, 15);
});

test('thưởng một lần mỗi khoá; due khác thì khoá khác', () => {
  const box = defaults(), now = T(5);
  const note = { createdAt: 0, reminder: { due: 100 } };
  assert.ok(eco.onDone(box, { noteId: 'a', note, now }));
  assert.equal(eco.onDone(box, { noteId: 'a', note, now: now + 1000 }), null);
  assert.ok(eco.onDone(box, { noteId: 'a', note: { createdAt: 0, reminder: { due: 200 } }, now: now + 2000 }));
  assert.equal(box.counters.done, 2);
});

test('trần 300 xu/ngày, quá trần 0 xu nhưng vẫn exp/done; ngày mới reset', () => {
  const box = defaults(), now = T(5);
  let total = 0, last;
  for (let i = 0; i < 25; i++) {
    last = eco.onDone(box, { noteId: 'n' + i, onTime: true, note: { createdAt: now - 25 * HOUR }, now });
    total += last.candy;
  }
  // mỗi note 35 xu; 8 note = 280, note thứ 9 chỉ còn 20
  assert.equal(box.today.noteCoins, 300);
  assert.equal(total, 300);
  assert.equal(last.candy, 0); assert.equal(last.exp, 35);
  assert.equal(box.counters.done, 25);
  assert.equal(box.log[0].done, 25);
  assert.equal(eco.onCheckItem(box, { noteId: 'z', index: 0, done: true, note: {}, now }).candy, 0);
  // ngày mới
  const r = eco.onDone(box, { noteId: 'next', onTime: true, note: { createdAt: 0 }, now: T(6) });
  assert.equal(box.today.noteCoins, r.candy);
  assert.ok(r.candy >= 35);
  assert.equal(box.log.length, 2);
});

test('checklist +2 một lần mỗi mục, chỉ khi done=true', () => {
  const box = defaults(), now = T(5);
  const n = oldNote(now);
  assert.equal(eco.onCheckItem(box, { noteId: 'a', index: 0, done: false, note: n, now }), null);
  const r = eco.onCheckItem(box, { noteId: 'a', index: 0, done: true, note: n, now });
  assert.equal(r.candy, 2); assert.equal(r.exp, 2); assert.equal(r.reason, 'checklist');
  assert.equal(eco.onCheckItem(box, { noteId: 'a', index: 0, done: true, note: n, now }), null);
  assert.equal(eco.onCheckItem(box, { noteId: 'a', index: 1, done: true, note: n, now }).candy, 2);
  assert.equal(box.counters.checkItems, 2);
  assert.equal(eco.onCheckItem(box, { noteId: 'a', index: 2, done: true, note: { createdAt: now - 1000 }, now }), null);
});

test('báo thức: +3/+2, tối đa 3 lần/ngày', () => {
  const box = defaults(), now = T(5);
  for (let i = 0; i < 3; i++) {
    const r = eco.onAlarmStopped(box, { now });
    assert.equal(r.candy, 3); assert.equal(r.exp, 2); assert.equal(r.reason, 'alarm');
  }
  assert.equal(eco.onAlarmStopped(box, { now }), null);
  assert.equal(box.counters.alarms, 3);
  assert.ok(eco.onAlarmStopped(box, { now: T(6) }));
});

test('lần đầu dùng tính năng: một lần, tên lạ bị bỏ', () => {
  const box = defaults(), now = T(5);
  const r = eco.firstUse(box, 'gacha', now);
  assert.equal(r.candy, 20); assert.equal(r.exp, 10); assert.equal(r.reason, 'first:gacha');
  assert.equal(eco.firstUse(box, 'gacha', now), null);
  assert.equal(eco.firstUse(box, 'bay-len-troi', now), null);
  assert.ok(eco.firstUse(box, 'pat', now));
});

test('chuỗi ngày qua nửa đêm, đứt chuỗi, mốc 3/7/30 đúng một lần', () => {
  const box = defaults();
  const done = (id, now) => eco.onDone(box, { noteId: id, onTime: false, note: {}, now });
  let r = done('a', T(1, 23, 59));
  assert.equal(box.stats.streak.count, 1); assert.equal(r.streak, null);
  done('a2', T(1, 23, 59) + 60000 * 0 + 1000);
  assert.equal(box.stats.streak.count, 1); // cùng ngày giữ nguyên
  r = done('b', T(2, 0, 1));
  assert.equal(box.stats.streak.count, 2);
  r = done('c', T(3));
  assert.equal(box.stats.streak.count, 3);
  assert.equal(r.streak, 3); assert.equal(r.streakBonus, 30); assert.equal(r.candy, 10 + 30);
  assert.equal(r.reason, 'done');
  r = done('c2', T(3, 15)); // cùng ngày, không thưởng lại
  assert.equal(r.streak, null); assert.equal(r.candy, 10);
  for (let d = 4; d <= 6; d++) assert.equal(done('d' + d, T(d)).streak, null);
  r = done('d7', T(7));
  assert.equal(r.streak, 7); assert.equal(r.streakBonus, 70);
  // bỏ 1 ngày -> về 1
  r = done('e', T(9));
  assert.equal(box.stats.streak.count, 1); assert.equal(r.streak, null);
  // chuỗi 30
  for (let d = 10; d <= 38; d++) r = done('f' + d, new Date(2026, 0, d).getTime());
  assert.equal(box.stats.streak.count, 30);
  assert.equal(r.streak, 30); assert.equal(r.streakBonus, 300);
});

test('level: công thức, levelUp trong Reward, nextLevelExp', () => {
  assert.equal(eco.level(0), 1); assert.equal(eco.level(99), 1);
  assert.equal(eco.level(100), 2); assert.equal(eco.level(399), 2); assert.equal(eco.level(400), 3);
  assert.equal(eco.nextLevelExp(1), 100); assert.equal(eco.nextLevelExp(2), 400);
  const box = defaults(); box.stats.exp = 95;
  const r = eco.firstUse(box, 'note', T(5)); // +10 exp -> 105
  assert.equal(r.levelUp, 2);
  assert.equal(eco.firstUse(box, 'pat', T(5)).levelUp, null);
});

test('grant và spend', () => {
  const box = defaults();
  const r = eco.grant(box, { candy: 30, exp: 20, reason: 'quest:q1' }, T(5));
  assert.equal(r.candy, 30); assert.equal(r.reason, 'quest:q1'); assert.equal(box.stats.candy, 130);
  assert.equal(eco.spend(box, 200), false); assert.equal(box.stats.candy, 130);
  assert.equal(eco.spend(box, 130), true); assert.equal(box.stats.candy, 0);
});

test('tắt game: mọi hàm trả null và không đổi gì', () => {
  const box = defaults(); box.settings.enabled = false;
  const snap = JSON.stringify(box), now = T(5);
  assert.equal(eco.onDone(box, { noteId: 'a', note: {}, now }), null);
  assert.equal(eco.onCheckItem(box, { noteId: 'a', index: 0, done: true, note: {}, now }), null);
  assert.equal(eco.onAlarmStopped(box, { now }), null);
  assert.equal(eco.firstUse(box, 'note', now), null);
  assert.equal(eco.grant(box, { candy: 5 }, now), null);
  assert.equal(eco.spend(box, 1), false);
  assert.equal(JSON.stringify(box), snap);
});

test('pruneRewarded xoá khoá > 60 ngày', () => {
  const box = defaults(), now = T(5);
  box.rewarded = { old: now - 61 * 86400000, fresh: now - 59 * 86400000 };
  assert.equal(eco.pruneRewarded(box, now), 1);
  assert.deepEqual(Object.keys(box.rewarded), ['fresh']);
});

test('rollDay: log tối đa 120 ngày, today reset', () => {
  const box = defaults();
  for (let i = 0; i < 130; i++) eco.rollDay(box, new Date(2026, 0, 1 + i, 12).getTime());
  assert.equal(box.log.length, 120);
  assert.equal(box.today.noteCoins, 0);
});
