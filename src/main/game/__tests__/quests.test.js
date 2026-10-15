'use strict';
const test = require('node:test');
const assert = require('node:assert');
const quests = require('../logic/quests.js');

// Thứ Năm 15/10/2026; thứ Hai kế là 19/10
const THU = new Date(2026, 9, 15, 10, 0).getTime();
const THU_LATE = new Date(2026, 9, 15, 23, 59).getTime();
const FRI = new Date(2026, 9, 16, 0, 1).getTime();
const SUN_LATE = new Date(2026, 9, 18, 23, 59).getTime();
const MON = new Date(2026, 9, 19, 0, 1).getTime();

function mkBox() {
  return {
    stats: { streak: { count: 0, lastDay: '' } },
    inventory: { items: {}, worn: {} },
    gacha: { total: 0 },
    quests: { day: '', daily: [], week: '', weekly: [] },
    achievements: {},
    counters: { done: 0, onTime: 0, pats: 0, feeds: 0, pulls: 0, trashed: 0 }
  };
}
const find = (b, id) => b.quests.daily.concat(b.quests.weekly).find(x => x.id === id);

test('roll: tạo lần đầu, giữ nguyên cùng kỳ', () => {
  const b = mkBox();
  quests.roll(b, THU);
  assert.strictEqual(b.quests.daily.length, 3);
  assert.strictEqual(b.quests.weekly.length, 1);
  quests.progress(b, 'done', 2, THU);
  quests.roll(b, THU_LATE);
  assert.strictEqual(find(b, 'daily.done3').progress, 2);
});

test('roll: qua nửa đêm đổi ngày nhưng giữ tuần', () => {
  const b = mkBox();
  quests.progress(b, 'done', 3, THU_LATE);
  quests.roll(b, FRI);
  assert.strictEqual(find(b, 'daily.done3').progress, 0);
  assert.strictEqual(find(b, 'weekly.done15').progress, 3);
});

test('roll: tuần mới bắt đầu thứ Hai', () => {
  const b = mkBox();
  quests.progress(b, 'done', 5, SUN_LATE);
  quests.roll(b, MON);
  assert.strictEqual(find(b, 'weekly.done15').progress, 0);
  assert.strictEqual(find(b, 'daily.done3').progress, 0);
});

test('progress: trả nhiệm vụ vừa chạm goal, chỉ một lần', () => {
  const b = mkBox();
  assert.deepStrictEqual(quests.progress(b, 'done', 2, THU), []);
  const hit = quests.progress(b, 'done', 1, THU);
  assert.deepStrictEqual(hit.map(h => h.id), ['daily.done3']);
  assert.deepStrictEqual(quests.progress(b, 'done', 1, THU), []);
  assert.strictEqual(find(b, 'daily.done3').progress, 3);
  assert.strictEqual(find(b, 'weekly.done15').progress, 4);
});

test('progress: tidy và pat', () => {
  const b = mkBox();
  assert.deepStrictEqual(quests.progress(b, 'tidy', 1, THU).map(h => h.id), ['daily.tidy1']);
  assert.deepStrictEqual(quests.progress(b, 'pat', 1, THU).map(h => h.id), ['daily.pat1']);
});

test('claim: chưa đủ không nhận, đủ nhận một lần', () => {
  const b = mkBox();
  assert.strictEqual(quests.claim(b, 'daily.pat1', THU).ok, false);
  quests.progress(b, 'pat', 1, THU);
  const r = quests.claim(b, 'daily.pat1', THU);
  assert.deepStrictEqual(r, { ok: true, reward: { candy: 30, exp: 20 } });
  assert.strictEqual(quests.claim(b, 'daily.pat1', THU).ok, false);
  assert.strictEqual(quests.claim(b, 'nope', THU).ok, false);
});

test('claim tuần: 150 xu / 80 exp', () => {
  const b = mkBox();
  quests.progress(b, 'done', 15, THU);
  assert.deepStrictEqual(quests.claim(b, 'weekly.done15', THU).reward, { candy: 150, exp: 80 });
});

test('thành tích: ≥ 12, đủ trường', () => {
  assert.ok(quests.ACHIEVEMENTS.length >= 12);
  for (const a of quests.ACHIEVEMENTS) {
    assert.ok(a.id && a.name && a.desc && a.icon && a.reward > 0 && typeof a.test === 'function');
  }
});

test('thành tích: mở đúng một lần', () => {
  const b = mkBox();
  assert.deepStrictEqual(quests.checkAchievements(b, THU), []);
  b.counters.done = 10;
  const r = quests.checkAchievements(b, THU);
  assert.deepStrictEqual(r.map(x => x.id).sort(), ['done_10', 'first_done']);
  assert.strictEqual(b.achievements.first_done, THU);
  assert.deepStrictEqual(quests.checkAchievements(b, THU + 1), []);
});

test('thành tích: Huyền thoại cần catalog, 5 khe, 20 món, chuỗi', () => {
  const b = mkBox();
  const cat = { items: [{ id: 'hat_x', rarity: 'legend' }, { id: 'hat_y', rarity: 'common' }] };
  b.inventory.items.hat_y = { count: 1 };
  assert.ok(!quests.checkAchievements(b, THU, cat).some(x => x.id === 'legend'));
  b.inventory.items.hat_x = { count: 1 };
  assert.ok(quests.checkAchievements(b, THU, cat).some(x => x.id === 'legend'));
  assert.ok(!quests.checkAchievements(mkBox(), THU).some(x => x.id === 'legend'));

  const c = mkBox();
  c.inventory.worn = { hat: 'a', glasses: 'b', neck: 'c', body: 'd' };
  assert.ok(!quests.checkAchievements(c, THU).some(x => x.id === 'worn_5'));
  c.inventory.worn.back = 'e';
  c.stats.streak.count = 7;
  for (let i = 0; i < 20; i++) c.inventory.items['it' + i] = { count: 1 };
  const ids = quests.checkAchievements(c, THU).map(x => x.id);
  for (const id of ['worn_5', 'streak_3', 'streak_7', 'collect_20']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('streak_30'));
});

test('listView: dạng hiển thị', () => {
  const b = mkBox();
  quests.progress(b, 'pat', 1, THU);
  quests.checkAchievements(b, THU);
  const v = quests.listView(b, THU);
  assert.strictEqual(v.daily.length, 3);
  assert.deepStrictEqual(v.daily[2], { id: 'daily.pat1', name: 'Xoa đầu bé', progress: 1, goal: 1, claimed: false, reward: { candy: 30, exp: 20 } });
  assert.strictEqual(v.weekly[0].goal, 15);
  assert.strictEqual(v.achievements.length, quests.ACHIEVEMENTS.length);
  assert.ok(Object.keys(v.achievements[0]).sort().join() === 'at,desc,icon,id,name,reward,unlocked');
});
