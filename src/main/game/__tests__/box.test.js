'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERSION, defaults, normalize } = require('../logic/box');

test('VERSION = 1 và defaults đúng hợp đồng', () => {
  assert.equal(VERSION, 1);
  const d = defaults();
  assert.equal(d.version, 1);
  assert.equal(d.settings.enabled, true);
  assert.deepEqual(d.stats, { energy: 80, mood: 70, affection: 0, candy: 100, exp: 0, streak: { count: 0, lastDay: '' } });
  assert.equal(Object.keys(d.counters).length, 10);
  assert.notEqual(defaults().stats, d.stats); // mỗi lần một bản mới
});

test('normalize(defaults()) giữ nguyên', () => {
  assert.deepEqual(normalize(defaults()), defaults());
});

test('không phải object thì ném lỗi', () => {
  for (const bad of [null, undefined, 5, 'x', [], true]) assert.throws(() => normalize(bad));
});

test('object rỗng / thiếu: điền mặc định', () => {
  assert.deepEqual(normalize({}), defaults());
  const n = normalize({ stats: { candy: 7 } });
  assert.equal(n.stats.candy, 7); assert.equal(n.stats.energy, 80);
});

test('kẹp số và sửa sai kiểu', () => {
  const n = normalize({
    stats: { energy: 500, mood: -9, candy: -5, exp: 'abc', affection: NaN, streak: { count: -3, lastDay: 7 } },
    settings: { enabled: false },
    counters: { done: 'x', onTime: -1, pats: 4.9 },
    today: 'hỏng', inventory: 'hỏng', gacha: [], quests: 3
  });
  assert.equal(n.stats.energy, 100); assert.equal(n.stats.mood, 0); assert.equal(n.stats.candy, 0);
  assert.equal(n.stats.exp, 0); assert.equal(n.stats.affection, 0);
  assert.deepEqual(n.stats.streak, { count: 0, lastDay: '' });
  assert.equal(n.settings.enabled, false);
  assert.equal(n.counters.done, 0); assert.equal(n.counters.onTime, 0); assert.equal(n.counters.pats, 4);
  assert.deepEqual(n.today, defaults().today);
  assert.deepEqual(n.inventory, defaults().inventory);
  assert.deepEqual(n.gacha, defaults().gacha);
  assert.deepEqual(n.quests, defaults().quests);
});

test('cắt mảng dài: outfits 6, foodLog 20, history 50, log 120', () => {
  const n = normalize({
    inventory: {
      outfits: Array.from({ length: 9 }, (_, i) => ({ id: 'o' + i, name: 'B' + i, worn: { hat: 'h' } })),
      foodLog: Array.from({ length: 30 }, (_, i) => ({ foodId: 'f', at: i }))
    },
    gacha: { history: Array.from({ length: 80 }, (_, i) => ({ itemId: 'i' + i, rarity: 'R', dup: false, at: i })) },
    log: Array.from({ length: 150 }, (_, i) => ({ day: `2026-01-${String(i % 28 + 1).padStart(2, '0')}`, done: 1, coins: 2 }))
  });
  assert.equal(n.inventory.outfits.length, 6);
  assert.equal(n.inventory.foodLog.length, 20); assert.equal(n.inventory.foodLog[19].at, 29);
  assert.equal(n.gacha.history.length, 50); assert.equal(n.gacha.history[49].itemId, 'i79');
  assert.equal(n.log.length, 120);
});

test('loại phần tử hỏng trong mảng/map', () => {
  const n = normalize({
    inventory: { items: { a: { count: 2, firstAt: 5 }, b: null, c: 'x' }, worn: { hat: 'h', bad: 3 }, outfits: [null, 5, { id: 'o1' }] },
    achievements: { x: 10, y: 'no' },
    rewarded: { k: 1, z: {} },
    log: [{ day: 'sai', done: 1 }, { day: '2026-02-01', done: 2, coins: 3 }],
    quests: { daily: [{ id: 'q', progress: 2, goal: 5, claimed: 1 }, { progress: 1 }] }
  });
  assert.deepEqual(Object.keys(n.inventory.items), ['a']);
  assert.deepEqual(n.inventory.worn, { hat: 'h' });
  assert.equal(n.inventory.outfits.length, 1); assert.equal(n.inventory.outfits[0].name, 'o1');
  assert.deepEqual(n.achievements, { x: 10 });
  assert.deepEqual(n.rewarded, { k: 1 });
  assert.deepEqual(n.log, [{ day: '2026-02-01', done: 2, coins: 3 }]);
  assert.deepEqual(n.quests.daily, [{ id: 'q', progress: 2, goal: 5, claimed: false }]);
});

test('dữ liệu cũ thiếu version/ngăn: migrate lên version 1', () => {
  const n = normalize({ version: 0, stats: { candy: 40, exp: 250 } });
  assert.equal(n.version, 1); assert.equal(n.stats.exp, 250); assert.equal(n.gacha.pity, 0);
});
