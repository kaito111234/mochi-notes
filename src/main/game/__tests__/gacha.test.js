'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../logic/gacha');
const C = require('../catalog');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RAR = ['common', 'rare', 'epic', 'legend'];
function fakeCatalog(per = 5) {
  const items = [];
  for (const r of RAR) for (let i = 0; i < per; i++) items.push({ id: `hat_${r}_${i}`, slot: 'hat', rarity: r, name: 'x', icon: 'i.svg' });
  return { slots: [{ id: 'hat', name: 'Mũ' }], rarities: RAR.map((id) => ({ id, name: id })), items, foods: [] };
}
function newBox() {
  return { inventory: { items: {}, shards: 0, worn: {} }, gacha: { pity: 0, total: 0, history: [] }, counters: { pulls: 0 } };
}

test('rollRarity pity=0 khớp RATES', () => {
  const rng = mulberry32(1), N = 100000, c = { common: 0, rare: 0, epic: 0, legend: 0 };
  for (let i = 0; i < N; i++) c[G.rollRarity(rng, 0)]++;
  for (const k of RAR) assert.ok(Math.abs(c[k] / N - G.RATES[k]) < 0.01, k);
});

test('pull thật khớp effectiveRates', () => {
  const eff = G.effectiveRates();
  console.log('effectiveRates', eff);
  assert.ok(Math.abs(RAR.reduce((s, k) => s + eff[k], 0) - 1) < 1e-9);
  const cat = fakeCatalog(), box = newBox(), rng = mulberry32(7), N = 100000, c = { common: 0, rare: 0, epic: 0, legend: 0 };
  for (let i = 0; i < N; i++) c[G.pull(box, cat, 1, rng, 0)[0].rarity]++;
  for (const k of RAR) assert.ok(Math.abs(c[k] / N - eff[k]) < 0.01, k);
});

test('bảo hiểm: rng 0.5 -> lượt 30 ra >= epic, không chuỗi 30 trượt', () => {
  const cat = fakeCatalog(), box = newBox(), rng = () => 0.5;
  let run = 0;
  for (let i = 1; i <= 3000; i++) {
    const r = G.pull(box, cat, 1, rng, 0)[0].rarity;
    if (r === 'epic' || r === 'legend') { assert.strictEqual(i % 30, 0); run = 0; } else run++;
    assert.ok(run < 30);
  }
});

test('10+1 ra 11 món, đếm pulls/total', () => {
  const box = newBox(), r = G.pull(box, fakeCatalog(), 10, mulberry32(3), 5);
  assert.strictEqual(r.length, 11);
  assert.strictEqual(box.gacha.total, 11);
  assert.strictEqual(box.counters.pulls, 11);
  assert.strictEqual(G.pull(box, fakeCatalog(), 1, mulberry32(4), 5).length, 1);
});

test('trùng -> mảnh đúng, count tăng, history <= 50', () => {
  const cat = { slots: [{ id: 'hat' }], items: [{ id: 'hat_a', slot: 'hat', rarity: 'common' }] };
  const box = newBox();
  const a = G.pull(box, cat, 1, () => 0.1, 1)[0];
  assert.strictEqual(a.dup, false);
  const b = G.pull(box, cat, 1, () => 0.1, 2)[0];
  assert.strictEqual(b.dup, true);
  assert.strictEqual(box.inventory.shards, G.SHARD_FOR_DUP.common);
  assert.strictEqual(box.inventory.items.hat_a.count, 2);
  for (let i = 0; i < 80; i++) G.pull(box, cat, 1, () => 0.1, 3);
  assert.strictEqual(box.gacha.history.length, 50);
});

test('độ hiếm không có món -> hạ xuống kề', () => {
  const cat = { slots: [{ id: 'hat' }], items: [{ id: 'hat_a', slot: 'hat', rarity: 'rare' }] };
  const r = G.pull(newBox(), cat, 1, () => 0.999, 0)[0];
  assert.strictEqual(r.rarity, 'rare');
});

test('exchange đủ/thiếu mảnh/đã có/không có', () => {
  const cat = fakeCatalog(), box = newBox();
  assert.strictEqual(G.exchange(box, cat, 'zzz').reason, 'Không có món này');
  box.inventory.shards = 4;
  assert.strictEqual(G.exchange(box, cat, 'hat_common_0').reason, 'Chưa đủ mảnh');
  box.inventory.shards = 7;
  assert.deepStrictEqual(G.exchange(box, cat, 'hat_common_0'), { ok: true });
  assert.strictEqual(box.inventory.shards, 2);
  assert.strictEqual(box.inventory.items.hat_common_0.count, 1);
  box.inventory.shards = 100;
  assert.strictEqual(G.exchange(box, cat, 'hat_common_0').reason, 'Cậu có món này rồi');
  assert.strictEqual(box.inventory.shards, 100);
});

test('pityLeft', () => {
  const box = newBox(); box.gacha.pity = 12;
  assert.strictEqual(G.pityLeft(box), 18);
});

test('validate loại món sai', () => {
  const c = C.validate({
    slots: [{ id: 'hat', name: 'Mũ' }],
    items: [
      { id: 'hat_ok', slot: 'hat', rarity: 'common' },
      { id: 'hat_ok', slot: 'hat', rarity: 'common' },
      { id: 'Hat Bad', slot: 'hat', rarity: 'common' },
      { id: 'x_slot', slot: 'nope', rarity: 'common' },
      { id: 'x_rar', slot: 'hat', rarity: 'mythic' },
    ],
    foods: [{ id: 'food_a' }, { id: 'BAD' }],
  });
  assert.deepStrictEqual(c.items.map((i) => i.id), ['hat_ok']);
  assert.strictEqual(c.foods.length, 1);
  assert.strictEqual(C.itemById(c, 'hat_ok').id, 'hat_ok');
  assert.strictEqual(C.foodById(c, 'food_a').id, 'food_a');
  assert.strictEqual(C.byRarity(c).common.length, 1);
});

test('catalog thật', (t) => {
  if (!fs.existsSync(C.DEFAULT_PATH)) return t.skip('chưa có assets/game/catalog.json');
  const cat = C.loadCatalog();
  assert.ok(cat.items.length >= 40);
  for (const s of cat.slots) assert.ok(cat.items.filter((i) => i.slot === s.id).length >= 4, s.id);
  const br = C.byRarity(cat);
  for (const r of RAR) assert.ok(br[r].length > 0, r);
  assert.ok(cat.foods.length >= 8);
  const base = path.dirname(C.DEFAULT_PATH);
  for (const x of [...cat.items, ...cat.foods]) assert.ok(fs.existsSync(path.join(base, x.icon)), x.icon);
});
