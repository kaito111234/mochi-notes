'use strict';
// Gacha: tỉ lệ, bảo hiểm, trùng -> mảnh, đổi mảnh (thuần, không electron).
const { byRarity, itemById } = require('../catalog');

const RATES = { common: 0.70, rare: 0.24, epic: 0.05, legend: 0.01 };
const PITY = 30;
const COST = { one: 50, ten: 500 };
const SHARD_FOR_DUP = { common: 1, rare: 3, epic: 10, legend: 30 };
const SHARD_PRICE = { common: 5, rare: 15, epic: 50, legend: 150 };
const ORDER = ['common', 'rare', 'epic', 'legend'];

// pity = số lượt liên tiếp chưa ra >= epic TRƯỚC lượt này.
function rollRarity(rng, pity) {
  const r = rng();
  if (pity >= PITY - 1) return r < 5 / 6 ? 'epic' : 'legend';
  let acc = 0;
  for (const k of ORDER) { acc += RATES[k]; if (r < acc) return k; }
  return 'common';
}

// Độ hiếm không có món -> hạ xuống kề (rồi mới tăng lên).
function resolveRarity(rarity, groups) {
  const i = ORDER.indexOf(rarity);
  for (let d = i; d >= 0; d--) if (groups[ORDER[d]].length) return ORDER[d];
  for (let d = i + 1; d < ORDER.length; d++) if (groups[ORDER[d]].length) return ORDER[d];
  return null;
}

function pull(box, catalog, count, rng, now) {
  const n = count === 10 ? 11 : 1;
  const groups = byRarity(catalog);
  const g = box.gacha;
  const inv = box.inventory;
  const results = [];
  for (let k = 0; k < n; k++) {
    const want = rollRarity(rng, g.pity);
    const rarity = resolveRarity(want, groups);
    if (!rarity) break;
    const list = groups[rarity];
    const item = list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    const dup = !!(inv.items[item.id] && inv.items[item.id].count > 0);
    let shards = 0;
    if (dup) { inv.items[item.id].count += 1; shards = SHARD_FOR_DUP[rarity]; inv.shards += shards; }
    else inv.items[item.id] = { count: 1, firstAt: now };
    g.pity = ORDER.indexOf(rarity) >= 2 ? 0 : g.pity + 1;
    g.total += 1;
    g.history.push({ itemId: item.id, rarity, dup, at: now });
    if (g.history.length > 50) g.history.splice(0, g.history.length - 50);
    if (box.counters) box.counters.pulls = (box.counters.pulls || 0) + 1;
    results.push({ itemId: item.id, rarity, dup, shards });
  }
  return results;
}

function exchange(box, catalog, itemId) {
  const item = itemById(catalog, itemId);
  if (!item) return { ok: false, reason: 'Không có món này' };
  const inv = box.inventory;
  if (inv.items[itemId] && inv.items[itemId].count > 0) return { ok: false, reason: 'Cậu có món này rồi' };
  const price = SHARD_PRICE[item.rarity];
  if (inv.shards < price) return { ok: false, reason: 'Chưa đủ mảnh' };
  inv.shards -= price;
  inv.items[itemId] = { count: 1, firstAt: Date.now() };
  return { ok: true };
}

// Phân phối dừng của chuỗi Markov theo pity 0..PITY-1.
function effectiveRates() {
  const q = RATES.epic + RATES.legend;
  const w = [];
  let sum = 0;
  for (let p = 0; p < PITY; p++) { const v = Math.pow(1 - q, p); w.push(v); sum += v; }
  const out = { common: 0, rare: 0, epic: 0, legend: 0 };
  for (let p = 0; p < PITY; p++) {
    const pi = w[p] / sum;
    if (p >= PITY - 1) { out.epic += pi * 5 / 6; out.legend += pi / 6; }
    else for (const k of ORDER) out[k] += pi * RATES[k];
  }
  return out;
}

const pityLeft = (box) => PITY - box.gacha.pity;

module.exports = { RATES, PITY, COST, SHARD_FOR_DUP, SHARD_PRICE, rollRarity, pull, exchange, effectiveRates, pityLeft };
