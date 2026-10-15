'use strict';
// Chỉ số của bé Mochi: năng lượng, tâm trạng, thân thiết; mode; đồ ăn giảm hiệu quả.
// Thuần: không require electron, không đọc đồng hồ thật (nhận `now`).

const MODES = Object.freeze({ TIRED: 'tired', SAD: 'sad', HAPPY: 'happy', NORMAL: 'normal' });

const ENERGY_DRAIN_PER_MIN = 0.15; // thức
const ENERGY_FLOOR = 5;            // đáy do hao dần
const ENERGY_REGEN_PER_MIN = 1;    // ngủ / máy rảnh
const MOOD_DRIFT_PER_HOUR = 2;     // trôi về 50
const MOOD_CENTER = 50;
const MOOD_DRIFT_FLOOR = 20;
const PAT_HEAD_LIMIT = 15;
const FOOD_WINDOW_MS = 6 * 3600 * 1000;
const FOOD_FACTORS = [1, 0.6, 0.35, 0.2, 0.1];
const FOOD_LOG_MAX = 20;
const INTERACT_MOOD = { 'pat-head': 4, 'pat-body': 2, click: 1 };

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function r1(v) { return Math.round(v * 10) / 10; }
function r2(v) { return Math.round(v * 100) / 100; }
function pad(n) { return n < 10 ? '0' + n : '' + n; }

// Khoá ngày địa phương 'YYYY-MM-DD' (tự viết, khỏi phụ thuộc time.js)
function dayKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function enabled(box) { return !(box && box.settings && box.settings.enabled === false); }

function ensureStats(box) {
  if (!box.stats || typeof box.stats !== 'object') box.stats = {};
  const s = box.stats;
  s.energy = num(s.energy, 80);
  s.mood = num(s.mood, 70);
  s.affection = num(s.affection, 0);
  return s;
}

// Trôi theo thời gian. minutes có thể lẻ.
function tick(box, opts) {
  if (!box || !enabled(box)) return false;
  const o = opts || {};
  const minutes = Math.max(0, num(o.minutes, 0));
  if (minutes === 0) return false;
  const s = ensureStats(box);
  const e0 = s.energy, m0 = s.mood;

  if (o.asleep) {
    s.energy = Math.min(100, s.energy + ENERGY_REGEN_PER_MIN * minutes);
  } else if (s.energy > ENERGY_FLOOR) {
    s.energy = Math.max(ENERGY_FLOOR, s.energy - ENERGY_DRAIN_PER_MIN * minutes);
  }
  s.energy = clamp(s.energy, 0, 100);

  // Tâm trạng trôi dần về 50, không vượt qua 50; không bị trôi xuống dưới 20
  const step = MOOD_DRIFT_PER_HOUR * minutes / 60;
  if (s.mood > MOOD_CENTER) s.mood = Math.max(MOOD_CENTER, s.mood - step);
  else if (s.mood < MOOD_CENTER) s.mood = Math.min(MOOD_CENTER, s.mood + step);
  if (m0 >= MOOD_DRIFT_FLOOR && s.mood < MOOD_DRIFT_FLOOR) s.mood = MOOD_DRIFT_FLOOR;
  s.mood = clamp(s.mood, 0, 100);

  s.energy = r2(s.energy);
  s.mood = r2(s.mood);
  return s.energy !== e0 || s.mood !== m0;
}

// Cộng/trừ trực tiếp, kẹp 0..100
function bump(box, d) {
  if (!box || !enabled(box)) return false;
  const s = ensureStats(box);
  const o = d || {};
  const before = [s.mood, s.energy, s.affection];
  if (typeof o.mood === 'number') s.mood = clamp(s.mood + o.mood, 0, 100);
  if (typeof o.energy === 'number') s.energy = clamp(s.energy + o.energy, 0, 100);
  if (typeof o.affection === 'number') s.affection = Math.max(0, s.affection + o.affection);
  s.mood = r2(s.mood); s.energy = r2(s.energy); s.affection = r2(s.affection);
  return before[0] !== s.mood || before[1] !== s.energy || before[2] !== s.affection;
}

function ensureToday(box) {
  if (!box.today || typeof box.today !== 'object') box.today = { day: '', noteCoins: 0, alarmBonus: 0, pats: 0 };
  return box.today;
}

// Số lần xoa đầu hôm nay; tự reset khi sang ngày (không đụng các trường khác của today)
function patsToday(box, now) {
  const t = ensureToday(box);
  const day = dayKey(now);
  if (t.day !== day && t.patsDay !== day) { t.pats = 0; }
  t.patsDay = day;
  t.pats = num(t.pats, 0);
  return t;
}

// Tương tác với bé; trả true nếu có đổi chỉ số
function onInteract(box, kind, now) {
  if (!box || !enabled(box)) return false;
  const gain = INTERACT_MOOD[kind];
  if (gain === undefined) return false;
  const s = ensureStats(box);
  if (kind === 'pat-head') {
    const t = patsToday(box, now);
    if (!box.counters || typeof box.counters !== 'object') box.counters = {};
    if (t.pats >= PAT_HEAD_LIMIT) return false;
    t.pats += 1;
    box.counters.pats = num(box.counters.pats, 0) + 1;
  }
  const before = s.mood;
  s.mood = r2(clamp(s.mood + gain, 0, 100));
  return s.mood !== before || kind === 'pat-head';
}

function recentCount(box, foodId, now) {
  const log = box && box.inventory && Array.isArray(box.inventory.foodLog) ? box.inventory.foodLog : [];
  let n = 0;
  for (const e of log) {
    if (e && e.foodId === foodId && typeof e.at === 'number' && now - e.at < FOOD_WINDOW_MS && now - e.at >= 0) n++;
  }
  return n;
}

// Hệ số hiệu quả hiện tại của món (để UI hiện)
function foodFactor(box, foodId, now) {
  return FOOD_FACTORS[Math.min(recentCount(box, foodId, now), FOOD_FACTORS.length - 1)];
}

// Cho ăn (xu đã trừ ở index). food = { id, mood, energy }
function feed(box, food, now) {
  if (!box || !enabled(box)) return { ok: false, reason: 'Game hóa đang tắt' };
  if (!food || !food.id) return { ok: false, reason: 'Không có món này' };
  const s = ensureStats(box);
  const factor = foodFactor(box, food.id, now);
  const mood = r1(num(food.mood, 0) * factor);
  const energy = r1(num(food.energy, 0) * factor);
  s.mood = r2(clamp(s.mood + mood, 0, 100));
  s.energy = r2(clamp(s.energy + energy, 0, 100));
  s.affection = num(s.affection, 0) + 1;
  if (!box.inventory || typeof box.inventory !== 'object') box.inventory = {};
  if (!Array.isArray(box.inventory.foodLog)) box.inventory.foodLog = [];
  box.inventory.foodLog.push({ foodId: food.id, at: now });
  if (box.inventory.foodLog.length > FOOD_LOG_MAX) {
    box.inventory.foodLog = box.inventory.foodLog.slice(-FOOD_LOG_MAX);
  }
  if (!box.counters || typeof box.counters !== 'object') box.counters = {};
  box.counters.feeds = num(box.counters.feeds, 0) + 1;
  return { ok: true, mood, energy, factor };
}

// Mode tổng hợp từ stats
function mode(s) {
  const energy = num(s && s.energy, 80), mood = num(s && s.mood, 70);
  if (energy < 20) return MODES.TIRED;
  if (mood < 30) return MODES.SAD;
  if (mood >= 70 && energy >= 40) return MODES.HAPPY;
  return MODES.NORMAL;
}

module.exports = { MODES, PAT_HEAD_LIMIT, FOOD_FACTORS, tick, bump, onInteract, feed, foodFactor, mode };
