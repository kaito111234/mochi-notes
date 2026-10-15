'use strict';
// Nhiệm vụ ngày/tuần và thành tích. Thuần: không require electron, nhận `now`.
// Không cộng xu ở đây — trả reward để index.js cộng qua economy.grant.

let timeLib = null;
try { timeLib = require('./time.js'); } catch (e) { timeLib = null; }

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

function dayKey(ms) {
  if (timeLib && typeof timeLib.dayKey === 'function') return timeLib.dayKey(ms);
  return ymd(new Date(ms));
}
// Tuần bắt đầu thứ Hai: khoá = ngày thứ Hai của tuần đó
function weekKey(ms) {
  if (timeLib && typeof timeLib.weekKey === 'function') return timeLib.weekKey(ms);
  const d = new Date(ms);
  const back = (d.getDay() + 6) % 7;
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back));
}

const DAILY = Object.freeze([
  { id: 'daily.done3', kind: 'done', name: 'Xong 3 note', goal: 3, reward: { candy: 30, exp: 20 } },
  { id: 'daily.tidy1', kind: 'tidy', name: 'Dọn 1 note hết hạn', goal: 1, reward: { candy: 30, exp: 20 } },
  { id: 'daily.pat1', kind: 'pat', name: 'Xoa đầu Mochi', goal: 1, reward: { candy: 30, exp: 20 } }
]);
const R = { candy: 150, exp: 80 };
// Tuần: 2 nhiệm vụ cố định + 1 xoay vòng (chọn tất định theo khoá tuần, chốt lúc đổi tuần)
const WEEKLY_FIXED = Object.freeze([
  { id: 'weekly.done15', kind: 'done', name: 'Xong 15 note', goal: 15, reward: { ...R } },
  { id: 'weekly.tidy3', kind: 'tidy', name: 'Dọn 3 note hết hạn', goal: 3, reward: { ...R } }
]);
const WEEKLY_POOL = Object.freeze([
  { id: 'weekly.check10', kind: 'check', name: 'Tick 10 mục checklist', goal: 10, reward: { ...R } },
  { id: 'weekly.feed5', kind: 'feed', name: 'Cho Mochi ăn 5 lần', goal: 5, reward: { ...R } },
  { id: 'weekly.pat10', kind: 'pat', name: 'Xoa đầu Mochi 10 lần', goal: 10, reward: { ...R } },
  { id: 'weekly.ontime8', kind: 'ontime', name: 'Xong đúng hạn 8 việc', goal: 8, reward: { ...R } },
  { id: 'weekly.capture3', kind: 'capture', name: 'Ghi nhanh qua bé 3 lần', goal: 3, reward: { ...R }, needsSeen: true }
]);
const WEEKLY = Object.freeze(WEEKLY_FIXED.concat(WEEKLY_POOL));   // mọi định nghĩa tuần (tra theo id)

function hash32(str) {   // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
// Nhiệm vụ xoay vòng của tuần: tất định theo khoá tuần; capture3 chỉ vào vòng khi flags.captureSeen
function weeklyRotating(box, week) {
  const seen = !!(box && box.flags && box.flags.captureSeen);
  const pool = WEEKLY_POOL.filter(d => !d.needsSeen || seen);
  return pool[hash32('week:' + week) % pool.length];
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function fresh(defs) { return defs.map(d => ({ id: d.id, progress: 0, goal: d.goal, claimed: false })); }
const allDefs = () => DAILY.concat(WEEKLY);
const defOf = id => allDefs().find(d => d.id === id);

function ensureQuests(box) {
  if (!box.quests || typeof box.quests !== 'object') box.quests = { day: '', daily: [], week: '', weekly: [] };
  if (!Array.isArray(box.quests.daily)) box.quests.daily = [];
  if (!Array.isArray(box.quests.weekly)) box.quests.weekly = [];
  return box.quests;
}

// Tạo lại khi đổi ngày/tuần; cùng kỳ thì giữ nguyên. Danh sách tuần cũ thiếu mục (dữ liệu Đợt 2: chỉ done15)
// được bù thêm, giữ tiến độ/đã nhận của mục đang có.
function roll(box, now) {
  const q = ensureQuests(box);
  const day = dayKey(now), week = weekKey(now);
  if (q.day !== day || q.daily.length !== DAILY.length) { q.day = day; q.daily = fresh(DAILY); }
  if (q.week !== week) {
    q.week = week;
    q.weekly = fresh(WEEKLY_FIXED.concat([weeklyRotating(box, week)]));
  } else if (q.weekly.length !== 3 || !q.weekly.every(x => x && defOf(x.id) && String(x.id).startsWith('weekly.'))) {
    const old = q.weekly.filter(x => x && defOf(x.id));
    const keptRot = old.find(x => WEEKLY_POOL.some(d => d.id === x.id));
    const rot = keptRot ? defOf(keptRot.id) : weeklyRotating(box, week);
    q.weekly = WEEKLY_FIXED.concat([rot]).map(d => old.find(x => x.id === d.id) || { id: d.id, progress: 0, goal: d.goal, claimed: false });
  }
  return q;
}

// Tăng tiến độ; trả các nhiệm vụ vừa chạm goal ở lần gọi này
// kind: 'done'|'tidy'|'pat'|'check'|'feed'|'ontime'|'capture'
function progress(box, kind, n, now) {
  const q = roll(box, now);
  const add = n === undefined ? 1 : Math.floor(num(n, 0));
  const hit = [];
  if (add <= 0) return hit;
  for (const list of [q.daily, q.weekly]) {
    for (const it of list) {
      const def = it && defOf(it.id);
      if (!def || def.kind !== kind) continue;
      const was = it.progress >= it.goal;
      it.progress = Math.min(it.goal, num(it.progress, 0) + add);
      if (!was && it.progress >= it.goal) hit.push({ id: def.id, name: def.name, reward: { ...def.reward } });
    }
  }
  return hit;
}

// Nhận thưởng: chỉ khi đủ goal và chưa nhận
function claim(box, questId, now) {
  const q = roll(box, now);
  const def = defOf(questId);
  if (!def) return { ok: false, reason: 'Không có nhiệm vụ này' };
  const it = q.daily.concat(q.weekly).find(x => x && x.id === questId);
  if (!it) return { ok: false, reason: 'Không có nhiệm vụ này' };
  if (it.claimed) return { ok: false, reason: 'Đã nhận rồi' };
  if (it.progress < it.goal) return { ok: false, reason: 'Chưa hoàn thành' };
  it.claimed = true;
  return { ok: true, reward: { ...def.reward } };
}

// ---- Thành tích ----
function c(box, k) { return num(box && box.counters && box.counters[k], 0); }
function streak(box) { return num(box && box.stats && box.stats.streak && box.stats.streak.count, 0); }
function distinctItems(box) {
  const it = box && box.inventory && box.inventory.items;
  if (!it || typeof it !== 'object') return 0;
  return Object.keys(it).filter(k => num(it[k] && it[k].count, 0) > 0).length;
}
function hasLegend(box, catalog) {
  const it = box && box.inventory && box.inventory.items;
  if (!it || !catalog || !Array.isArray(catalog.items)) return false;
  return catalog.items.some(x => x && x.rarity === 'legend' && num(it[x.id] && it[x.id].count, 0) > 0);
}
function wornSlots(box) {
  const w = box && box.inventory && box.inventory.worn;
  if (!w || typeof w !== 'object') return 0;
  return Object.keys(w).filter(k => w[k]).length;
}
function claimedSets(box) { return Object.keys((box && box.album && box.album.claimed) || {}).length; }
function allSetsClaimed(box, catalog) {
  const sets = catalog && Array.isArray(catalog.sets) ? catalog.sets : [];
  const cl = (box && box.album && box.album.claimed) || {};
  return sets.length > 0 && sets.every(s => cl[s.id]);
}
function pulls(box) { return Math.max(c(box, 'pulls'), num(box && box.gacha && box.gacha.total, 0)); }

const ACHIEVEMENTS = [
  { id: 'first_done', name: 'Bước đầu tiên', desc: 'Xong note đầu tiên', icon: 'check', reward: 20, test: b => c(b, 'done') >= 1 },
  { id: 'done_10', name: 'Chăm chỉ nhỏ', desc: 'Xong 10 note', icon: 'star', reward: 50, test: b => c(b, 'done') >= 10 },
  { id: 'done_100', name: 'Siêu chăm chỉ', desc: 'Xong 100 note', icon: 'crown', reward: 300, test: b => c(b, 'done') >= 100 },
  { id: 'streak_3', name: 'Ba ngày liền', desc: 'Giữ chuỗi 3 ngày', icon: 'fire', reward: 30, test: b => streak(b) >= 3 },
  { id: 'streak_7', name: 'Một tuần rực lửa', desc: 'Giữ chuỗi 7 ngày', icon: 'calendar', reward: 80, test: b => streak(b) >= 7 },
  { id: 'streak_30', name: 'Tháng bền bỉ', desc: 'Giữ chuỗi 30 ngày', icon: 'fire', reward: 400, test: b => streak(b) >= 30 },
  { id: 'pull_10', name: 'Thích quay quà', desc: 'Quay gacha 10 lượt', icon: 'gift', reward: 40, test: b => pulls(b) >= 10 },
  { id: 'legend', name: 'Ánh sao huyền thoại', desc: 'Sở hữu một món Huyền thoại', icon: 'sparkle', reward: 200, test: (b, cat) => hasLegend(b, cat) },
  { id: 'feed_10', name: 'Mochi no bụng', desc: 'Cho Mochi ăn 10 lần', icon: 'cake', reward: 40, test: b => c(b, 'feeds') >= 10 },
  { id: 'pat_50', name: 'Bàn tay ấm', desc: 'Xoa đầu Mochi 50 lần', icon: 'heart', reward: 60, test: b => c(b, 'pats') >= 50 },
  { id: 'worn_5', name: 'Thời trang đủ bộ', desc: 'Mặc đủ 5 khe cùng lúc', icon: 'shirt', reward: 60, test: b => wornSlots(b) >= 5 },
  { id: 'collect_20', name: 'Tủ đồ đầy ắp', desc: 'Gom 20 món đồ', icon: 'paw', reward: 100, test: b => distinctItems(b) >= 20 },
  { id: 'tidy_10', name: 'Mèo dọn dẹp', desc: 'Dọn 10 note', icon: 'cat', reward: 40, test: b => c(b, 'trashed') >= 10 },
  { id: 'set_first', name: 'Nhà sưu tầm nhí', desc: 'Nhận thưởng trọn bộ đầu tiên', icon: 'shirt', reward: 50, test: b => claimedSets(b) >= 1 },
  { id: 'set_all', name: 'Tủ đồ trọn bộ', desc: 'Nhận thưởng mọi bộ sưu tập', icon: 'crown', reward: 300, test: (b, cat) => allSetsClaimed(b, cat) },
  { id: 'ontime_20', name: 'Đúng hẹn', desc: 'Xong 20 việc đúng hạn', icon: 'check', reward: 80, test: b => c(b, 'onTime') >= 20 }
];

function safeTest(a, box, catalog) {
  try { return !!a.test(box, catalog); } catch (e) { return false; }
}

// Trả các thành tích mới mở (ghi box.achievements[id] = now)
function checkAchievements(box, now, catalog) {
  if (!box.achievements || typeof box.achievements !== 'object') box.achievements = {};
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (box.achievements[a.id]) continue;
    if (safeTest(a, box, catalog)) {
      box.achievements[a.id] = now;
      out.push({ id: a.id, name: a.name, reward: a.reward });
    }
  }
  return out;
}

// Dạng hiển thị cho View.quests / View.achievements
function listView(box, now, catalog) {
  const q = roll(box, now);
  const map = (defs, list) => defs.map(d => {
    const it = list.find(x => x && x.id === d.id) || { progress: 0, goal: d.goal, claimed: false };
    return { id: d.id, name: d.name, progress: it.progress, goal: it.goal, claimed: !!it.claimed, reward: { ...d.reward } };
  });
  const ach = box.achievements && typeof box.achievements === 'object' ? box.achievements : {};
  return {
    daily: map(DAILY, q.daily),
    weekly: q.weekly.filter(x => x && defOf(x.id)).map(x => {
      const d = defOf(x.id);
      return { id: d.id, name: d.name, progress: x.progress, goal: x.goal, claimed: !!x.claimed, reward: { ...d.reward } };
    }),
    achievements: ACHIEVEMENTS.map(a => ({
      id: a.id, name: a.name, desc: a.desc, icon: a.icon,
      unlocked: !!ach[a.id], at: ach[a.id] || 0, reward: a.reward
    }))
  };
}

module.exports = { DAILY, WEEKLY, WEEKLY_FIXED, WEEKLY_POOL, weeklyRotating, ACHIEVEMENTS, roll, progress, claim, checkAchievements, listView };
