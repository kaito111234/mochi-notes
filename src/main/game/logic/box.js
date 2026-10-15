'use strict';
// Ngăn 'game': giá trị mặc định + chuẩn hoá (migrate) dữ liệu lưu.

const VERSION = 1;
const MAX_OUTFITS = 6, MAX_FOODLOG = 20, MAX_HISTORY = 50, MAX_LOG = 120, MAX_QUESTS = 20;
const COUNTERS = ['done', 'onTime', 'longTerm', 'checkItems', 'pats', 'feeds', 'pulls', 'trashed', 'alarms', 'outfits', 'tidy', 'captures'];
const MAX_FOOD = 99;

function defaults() {
  return {
    version: VERSION,
    settings: { enabled: true },
    stats: { energy: 80, mood: 70, affection: 0, candy: 100, exp: 0, streak: { count: 0, lastDay: '' } },
    inventory: { items: {}, shards: 0, worn: {}, outfits: [], foodLog: [], food: {} },
    gacha: { pity: 0, total: 0, history: [] },
    quests: { day: '', daily: [], week: '', weekly: [] },
    album: { claimed: {} },
    checkin: { cycleDay: 0, lastDay: '', total: 0 },
    flags: { captureSeen: false },
    achievements: {},
    counters: Object.fromEntries(COUNTERS.map(k => [k, 0])),
    firstUse: {},
    rewarded: {},
    today: { day: '', noteCoins: 0, alarmBonus: 0, pats: 0, patsDay: '' },
    log: []
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
function num(v, d, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return d;
  return Math.min(max === undefined ? Infinity : max, Math.max(min === undefined ? -Infinity : min, v));
}
const int = (v, d, min, max) => Math.floor(num(v, d, min, max));
// map { key: số ms } -> chỉ giữ giá trị số hợp lệ
function numMap(v) {
  const o = {};
  if (isObj(v)) for (const k of Object.keys(v)) if (typeof v[k] === 'number' && Number.isFinite(v[k])) o[k] = v[k];
  return o;
}
function strMap(v) {
  const o = {};
  if (isObj(v)) for (const k of Object.keys(v)) if (typeof v[k] === 'string') o[k] = v[k];
  return o;
}
const arr = v => (Array.isArray(v) ? v : []);
const keepLast = (a, n) => (a.length > n ? a.slice(a.length - n) : a);

function normQuests(list) {
  return keepLast(arr(list).filter(q => isObj(q) && typeof q.id === 'string').map(q => ({
    id: q.id, progress: int(q.progress, 0, 0), goal: int(q.goal, 1, 1), claimed: q.claimed === true
  })), MAX_QUESTS);
}

function normalize(stored) {
  if (!isObj(stored)) throw new Error('Ngăn game không phải object');
  const d = defaults();
  const s = isObj(stored.stats) ? stored.stats : {};
  const st = isObj(s.streak) ? s.streak : {};
  const inv = isObj(stored.inventory) ? stored.inventory : {};
  const g = isObj(stored.gacha) ? stored.gacha : {};
  const q = isObj(stored.quests) ? stored.quests : {};
  const c = isObj(stored.counters) ? stored.counters : {};
  const t = isObj(stored.today) ? stored.today : {};
  const ck = isObj(stored.checkin) ? stored.checkin : {};
  const al = isObj(stored.album) ? stored.album : {};
  const fl = isObj(stored.flags) ? stored.flags : {};

  const items = {};
  if (isObj(inv.items)) {
    for (const id of Object.keys(inv.items)) {
      const it = inv.items[id];
      if (!isObj(it)) continue;
      items[id] = { count: int(it.count, 1, 1), firstAt: num(it.firstAt, 0, 0) };
    }
  }
  const outfits = arr(inv.outfits).filter(o => isObj(o) && typeof o.id === 'string').slice(0, MAX_OUTFITS)
    .map(o => ({ id: o.id, name: str(o.name, o.id), worn: strMap(o.worn) }));
  const foodLog = keepLast(arr(inv.foodLog).filter(f => isObj(f) && typeof f.foodId === 'string')
    .map(f => ({ foodId: f.foodId, at: num(f.at, 0, 0) })), MAX_FOODLOG);
  const history = keepLast(arr(g.history).filter(h => isObj(h) && typeof h.itemId === 'string')
    .map(h => ({ itemId: h.itemId, rarity: str(h.rarity), dup: h.dup === true, at: num(h.at, 0, 0) })), MAX_HISTORY);
  const log = keepLast(arr(stored.log).filter(l => isObj(l) && /^\d{4}-\d{2}-\d{2}$/.test(l.day))
    .map(l => ({ day: l.day, done: int(l.done, 0, 0), coins: int(l.coins, 0, 0) })), MAX_LOG);

  const food = {};
  if (isObj(inv.food)) {
    for (const id of Object.keys(inv.food)) {
      const n = int(inv.food[id], 0, 0, MAX_FOOD);
      if (n > 0) food[id] = n;
    }
  }

  const counters = {};
  for (const k of COUNTERS) counters[k] = int(c[k], 0, 0);

  return {
    version: VERSION,
    settings: { enabled: isObj(stored.settings) ? stored.settings.enabled !== false : true },
    stats: {
      energy: num(s.energy, d.stats.energy, 0, 100),
      mood: num(s.mood, d.stats.mood, 0, 100),
      affection: num(s.affection, 0, 0),
      candy: int(s.candy, d.stats.candy, 0),
      exp: num(s.exp, 0, 0),
      streak: { count: int(st.count, 0, 0), lastDay: str(st.lastDay) }
    },
    inventory: {
      items, shards: int(inv.shards, 0, 0), worn: strMap(inv.worn), outfits, foodLog, food
    },
    gacha: { pity: int(g.pity, 0, 0), total: int(g.total, 0, 0), history },
    quests: { day: str(q.day), daily: normQuests(q.daily), week: str(q.week), weekly: normQuests(q.weekly) },
    album: { claimed: numMap(al.claimed) },
    checkin: { cycleDay: int(ck.cycleDay, 0, 0, 6), lastDay: str(ck.lastDay), total: int(ck.total, 0, 0) },
    flags: { captureSeen: fl.captureSeen === true },
    achievements: numMap(stored.achievements),
    counters,
    firstUse: numMap(stored.firstUse),
    rewarded: numMap(stored.rewarded),
    today: { day: str(t.day), noteCoins: int(t.noteCoins, 0, 0), alarmBonus: int(t.alarmBonus, 0, 0), pats: int(t.pats, 0, 0), patsDay: str(t.patsDay) },
    log
  };
}

module.exports = { VERSION, MAX_FOOD, defaults, normalize };
