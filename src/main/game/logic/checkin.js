'use strict';
// Điểm danh 7 ngày. Thuần: nhận `now`. KHÔNG phạt: bỏ ngày không reset vòng.
// Chỉ đổi box.checkin + túi đồ ăn; xu do index.js cộng qua economy.grant (không tính trần note).
const { dayKey } = require('./time');

const MAX_FOOD = 99;
const REWARDS = Object.freeze([
  { day: 1, candy: 20 },
  { day: 2, candy: 25 },
  { day: 3, candy: 30, food: { id: 'food_mochi', n: 1 } },
  { day: 4, candy: 35 },
  { day: 5, candy: 40, food: { id: 'food_boba', n: 1 } },
  { day: 6, candy: 50 },
  { day: 7, candy: 100, food: { id: 'food_strawberry_cake', n: 1 } }
]);

const clone = r => ({ day: r.day, candy: r.candy, ...(r.food ? { food: { ...r.food } } : {}) });
const rewards = () => REWARDS.map(clone);

function ensure(box) {
  if (!box.checkin || typeof box.checkin !== 'object') box.checkin = { cycleDay: 0, lastDay: '', total: 0 };
  const c = box.checkin;
  if (!Number.isInteger(c.cycleDay) || c.cycleDay < 0 || c.cycleDay > 6) c.cycleDay = 0;
  if (typeof c.lastDay !== 'string') c.lastDay = '';
  if (!Number.isInteger(c.total) || c.total < 0) c.total = 0;
  if (!box.inventory.food || typeof box.inventory.food !== 'object') box.inventory.food = {};
  return c;
}

function todayDone(box, now) { return ensure(box).lastDay === dayKey(now); }

// -> { ok:true, reward:{candy, food?} } | { ok:false, reason:'off'|'done' }
function claim(box, now) {
  if (!box || !box.settings || box.settings.enabled === false) return { ok: false, reason: 'off' };
  const c = ensure(box);
  const day = dayKey(now);
  if (c.lastDay === day) return { ok: false, reason: 'done' };
  const r = REWARDS[c.cycleDay];
  c.lastDay = day;
  c.total++;
  c.cycleDay = c.cycleDay + 1 >= REWARDS.length ? 0 : c.cycleDay + 1;
  if (r.food) {
    const cur = box.inventory.food[r.food.id] || 0;
    box.inventory.food[r.food.id] = Math.min(MAX_FOOD, cur + r.food.n);
  }
  return { ok: true, reward: { candy: r.candy, ...(r.food ? { food: { ...r.food } } : {}) } };
}

function view(box, now) {
  const c = ensure(box);
  return { cycleDay: c.cycleDay, todayDone: c.lastDay === dayKey(now), total: c.total, rewards: rewards() };
}

module.exports = { REWARDS, MAX_FOOD, rewards, todayDone, claim, view };
