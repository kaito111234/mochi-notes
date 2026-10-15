'use strict';
const test = require('node:test');
const assert = require('node:assert');
const stats = require('../logic/stats.js');

const T0 = new Date(2026, 9, 15, 10, 0).getTime();
const H = 3600 * 1000;
function mkBox(o) {
  return Object.assign({
    settings: { enabled: true },
    stats: { energy: 80, mood: 70, affection: 0, candy: 100, exp: 0, streak: { count: 0, lastDay: '' } },
    inventory: { items: {}, shards: 0, worn: {}, outfits: [], foodLog: [] },
    counters: { pats: 0, feeds: 0 },
    today: { day: '', noteCoins: 0, alarmBonus: 0, pats: 0 }
  }, o || {});
}
const FOOD = { id: 'food_mochi', mood: 8, energy: 6 };

test('tick: thức hao 0,15/phút, đáy 5', () => {
  const b = mkBox();
  stats.tick(b, { minutes: 100, asleep: false, now: T0 });
  assert.strictEqual(b.stats.energy, 65);
  stats.tick(b, { minutes: 100000, asleep: false, now: T0 });
  assert.strictEqual(b.stats.energy, 5);
});

test('tick: ngủ hồi 1/phút, trần 100', () => {
  const b = mkBox();
  b.stats.energy = 10;
  stats.tick(b, { minutes: 30, asleep: true, now: T0 });
  assert.strictEqual(b.stats.energy, 40);
  stats.tick(b, { minutes: 500, asleep: true, now: T0 });
  assert.strictEqual(b.stats.energy, 100);
});

test('tick: không bao giờ < 0 và không kéo năng lượng thấp hơn đáy xuống nữa', () => {
  const b = mkBox();
  b.stats.energy = 2;
  stats.tick(b, { minutes: 60, asleep: false, now: T0 });
  assert.ok(b.stats.energy >= 0);
  assert.strictEqual(b.stats.energy, 2);
  b.stats.energy = 0; b.stats.mood = 0;
  stats.tick(b, { minutes: 600, asleep: false, now: T0 });
  assert.ok(b.stats.energy >= 0 && b.stats.mood >= 0);
});

test('tick: tâm trạng trôi về 50, 2/giờ, không vượt 50', () => {
  const b = mkBox();
  stats.tick(b, { minutes: 60, asleep: false, now: T0 });
  assert.strictEqual(b.stats.mood, 68);
  stats.tick(b, { minutes: 60 * 100, asleep: false, now: T0 });
  assert.strictEqual(b.stats.mood, 50);
  b.stats.mood = 25;
  stats.tick(b, { minutes: 120, asleep: false, now: T0 });
  assert.strictEqual(b.stats.mood, 29);
});

test('bump kẹp 0..100', () => {
  const b = mkBox();
  stats.bump(b, { mood: 500, energy: -500 });
  assert.strictEqual(b.stats.mood, 100);
  assert.strictEqual(b.stats.energy, 0);
});

test('mode: 4 trường hợp', () => {
  assert.strictEqual(stats.mode({ energy: 19, mood: 100 }), 'tired');
  assert.strictEqual(stats.mode({ energy: 50, mood: 29 }), 'sad');
  assert.strictEqual(stats.mode({ energy: 40, mood: 70 }), 'happy');
  assert.strictEqual(stats.mode({ energy: 39, mood: 80 }), 'normal');
  assert.strictEqual(stats.mode({ energy: 60, mood: 50 }), 'normal');
  assert.ok(stats.MODES);
});

test('feed: giảm hiệu quả khi ăn lặp và hồi lại sau 6 giờ', () => {
  const b = mkBox();
  b.stats.mood = 0; b.stats.energy = 0;
  const fs = [];
  for (let i = 0; i < 6; i++) fs.push(stats.feed(b, FOOD, T0 + i * 1000).factor);
  assert.deepStrictEqual(fs, [1, 0.6, 0.35, 0.2, 0.1, 0.1]);
  assert.strictEqual(b.counters.feeds, 6);
  assert.strictEqual(b.stats.affection, 6);
  // món khác không bị ảnh hưởng
  assert.strictEqual(stats.foodFactor(b, 'food_other', T0 + 10000), 1);
  // sau 6 giờ hồi lại
  assert.strictEqual(stats.foodFactor(b, FOOD.id, T0 + 6 * H + 6000), 1);
  const r = stats.feed(b, FOOD, T0 + 7 * H);
  assert.strictEqual(r.factor, 1);
  assert.strictEqual(r.mood, 8);
});

test('feed: làm tròn 1 chữ số, foodLog tối đa 20', () => {
  const b = mkBox();
  stats.feed(b, FOOD, T0); // 1
  const r = stats.feed(b, FOOD, T0 + 1); // 0.6
  assert.strictEqual(r.mood, 4.8);
  assert.strictEqual(r.energy, 3.6);
  for (let i = 0; i < 30; i++) stats.feed(b, FOOD, T0 + 100 + i);
  assert.strictEqual(b.inventory.foodLog.length, 20);
});

test('xoa đầu: +4, trần 15 lần/ngày, reset qua ngày', () => {
  const b = mkBox();
  b.stats.mood = 20;
  for (let i = 0; i < 15; i++) assert.strictEqual(stats.onInteract(b, 'pat-head', T0 + i), true);
  assert.strictEqual(b.stats.mood, 80);
  assert.strictEqual(stats.onInteract(b, 'pat-head', T0 + 99), false);
  assert.strictEqual(b.stats.mood, 80);
  assert.strictEqual(b.counters.pats, 15);
  // sang ngày
  assert.strictEqual(stats.onInteract(b, 'pat-head', T0 + 24 * H), true);
  assert.strictEqual(b.counters.pats, 16);
  assert.strictEqual(b.today.pats, 1);
});

test('xoa đầu: tự reset khi box.today.day khác ngày', () => {
  const b = mkBox();
  b.today = { day: '2026-10-14', noteCoins: 0, alarmBonus: 0, pats: 15 };
  assert.strictEqual(stats.onInteract(b, 'pat-head', T0), true);
  assert.strictEqual(b.today.pats, 1);
});

test('pat-body +2, click +1, loại lạ không đổi', () => {
  const b = mkBox();
  b.stats.mood = 50;
  stats.onInteract(b, 'pat-body', T0);
  stats.onInteract(b, 'click', T0);
  assert.strictEqual(b.stats.mood, 53);
  assert.strictEqual(b.counters.pats, 0);
  assert.strictEqual(stats.onInteract(b, 'zzz', T0), false);
});

test('tắt game hóa: không đổi gì', () => {
  const b = mkBox();
  b.settings.enabled = false;
  const snap = JSON.stringify(b);
  stats.tick(b, { minutes: 100, asleep: false, now: T0 });
  assert.strictEqual(stats.onInteract(b, 'pat-head', T0), false);
  assert.deepStrictEqual(stats.feed(b, FOOD, T0), { ok: false, reason: 'Game hóa đang tắt' });
  assert.strictEqual(JSON.stringify(b), snap);
});
