'use strict';
// Kinh tế game: xu/exp, chống cày, chuỗi ngày, level. Thuần, nhận `now`.
const { dayKey, isYesterday } = require('./time');

const RULES = {
  done: { candy: 10, exp: 10 },
  onTime: { candy: 5, exp: 5 },
  longTerm: { candy: 20, exp: 20 },
  checkItem: { candy: 2, exp: 2 },
  alarm: { candy: 3, exp: 2, perDay: 3 },
  firstUse: { candy: 20, exp: 10 },
  features: ['note', 'alarm', 'checklist', 'gacha', 'feed', 'outfit', 'pat'],
  streak: { 3: 30, 7: 70, 30: 300 },
  noteCoinsCap: 300,
  minNoteAgeMs: 2 * 60 * 1000,
  longTermAgeMs: 24 * 60 * 60 * 1000,
  rewardedKeepDays: 60,
  logMax: 120,
  doneMood: 3,
  doneAffection: 1
};

const level = exp => Math.floor(Math.sqrt(Math.max(0, Number(exp) || 0)) / 10) + 1;
// Exp tối thiểu để đạt level kế tiếp
const nextLevelExp = lv => Math.pow(lv * 10, 2);

const off = box => !box || !box.settings || box.settings.enabled === false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Đổi ngày: reset today, thêm dòng log
function rollDay(box, now) {
  const day = dayKey(now);
  if (!box.today || box.today.day !== day) {
    box.today = { day, noteCoins: 0, alarmBonus: 0, pats: 0 };
  }
  if (!Array.isArray(box.log)) box.log = [];
  if (!box.log.some(l => l.day === day)) {
    box.log.push({ day, done: 0, coins: 0 });
    box.log.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    if (box.log.length > RULES.logMax) box.log.splice(0, box.log.length - RULES.logMax);
  }
  return day;
}

function logEntry(box, day) { return box.log.find(l => l.day === day); }

// Cộng thưởng vào box, trả Reward
function apply(box, { candy = 0, exp = 0, affection = 0, reason }, now) {
  const st = box.stats;
  const day = dayKey(now);
  const before = level(st.exp);
  st.candy = Math.max(0, st.candy + candy);
  st.exp = Math.max(0, st.exp + exp);
  st.affection = Math.max(0, st.affection + affection);
  const after = level(st.exp);
  if (candy > 0) logEntry(box, day).coins += candy;
  return { candy, exp, affection, reason, levelUp: after > before ? after : null, streak: null };
}

// Cập nhật chuỗi khi có việc xong; trả { count, bonus } (bonus > 0 nếu chạm mốc)
function touchStreak(box, day) {
  const s = box.stats.streak;
  let bonus = 0, hit = null;
  if (s.lastDay === day) return { bonus, hit };
  s.count = isYesterday(s.lastDay, day) ? s.count + 1 : 1;
  s.lastDay = day;
  if (RULES.streak[s.count]) { bonus = RULES.streak[s.count]; hit = s.count; }
  return { bonus, hit };
}

function noteOldEnough(note, now) {
  const c = note && typeof note.createdAt === 'number' ? note.createdAt : null;
  return c === null || now - c >= RULES.minNoteAgeMs; // thiếu createdAt: coi như đủ tuổi
}

// Phần xu bị trần ngày giới hạn
function capCoins(box, want) {
  const room = Math.max(0, RULES.noteCoinsCap - box.today.noteCoins);
  const got = Math.min(want, room);
  box.today.noteCoins += got;
  return got;
}

function onDone(box, { noteId, reminderId, onTime, note, now } = {}) {
  if (off(box)) return null;
  const day = rollDay(box, now);
  if (!noteOldEnough(note, now)) return null;
  const rid = typeof reminderId === 'string' && reminderId.length > 0 && reminderId.length <= 40 ? reminderId : null;
  let rem = note && note.reminder;
  if (rid && note && Array.isArray(note.reminders)) {
    const f = note.reminders.find(r => r && r.id === rid);
    if (f) rem = f;
  }
  const due = rem && rem.due != null ? rem.due : '';
  const key = rid ? `done:${noteId}:${rid}:${due}` : `done:${noteId}:${due}`;
  if (box.rewarded[key]) return null;
  box.rewarded[key] = now;

  let candy = RULES.done.candy, exp = RULES.done.exp;
  if (onTime !== false) { candy += RULES.onTime.candy; exp += RULES.onTime.exp; box.counters.onTime++; }
  const created = note && typeof note.createdAt === 'number' ? note.createdAt : null;
  if (created !== null && now - created >= RULES.longTermAgeMs) {
    candy += RULES.longTerm.candy; exp += RULES.longTerm.exp; box.counters.longTerm++;
  }
  candy = capCoins(box, candy);
  box.counters.done++;
  logEntry(box, day).done++;
  const { bonus, hit } = touchStreak(box, day);
  box.stats.mood = clamp(box.stats.mood + RULES.doneMood, 0, 100);
  const r = apply(box, { candy: candy + bonus, exp, affection: RULES.doneAffection, reason: 'done' }, now);
  if (hit) { r.streak = hit; r.streakBonus = bonus; }
  return r;
}

function onCheckItem(box, { noteId, index, done, note, now } = {}) {
  if (off(box) || done !== true) return null;
  const day = rollDay(box, now);
  if (!noteOldEnough(note, now)) return null;
  const key = `chk:${noteId}:${index}`;
  if (box.rewarded[key]) return null;
  box.rewarded[key] = now;
  const candy = capCoins(box, RULES.checkItem.candy);
  box.counters.checkItems++;
  void day;
  return apply(box, { candy, exp: RULES.checkItem.exp, reason: 'checklist' }, now);
}

function onAlarmStopped(box, { now } = {}) {
  if (off(box)) return null;
  rollDay(box, now);
  if (box.today.alarmBonus >= RULES.alarm.perDay) return null;
  box.today.alarmBonus++;
  box.counters.alarms++;
  return apply(box, { candy: RULES.alarm.candy, exp: RULES.alarm.exp, reason: 'alarm' }, now);
}

function firstUse(box, feature, now) {
  if (off(box) || !RULES.features.includes(feature)) return null;
  rollDay(box, now);
  if (box.firstUse[feature]) return null;
  box.firstUse[feature] = now;
  return apply(box, { candy: RULES.firstUse.candy, exp: RULES.firstUse.exp, reason: `first:${feature}` }, now);
}

// Cộng thẳng (nhiệm vụ, thành tích)
function grant(box, { candy = 0, exp = 0, affection = 0, reason = 'grant' } = {}, now) {
  if (off(box)) return null;
  rollDay(box, now);
  return apply(box, { candy, exp, affection, reason }, now);
}

function spend(box, amount) {
  if (off(box) || !Number.isFinite(amount) || amount < 0) return false;
  if (box.stats.candy < amount) return false;
  box.stats.candy -= amount;
  return true;
}

// Xoá khoá thưởng cũ hơn 60 ngày; trả số khoá đã xoá
function pruneRewarded(box, now) {
  const cut = now - RULES.rewardedKeepDays * 86400000;
  let n = 0;
  for (const k of Object.keys(box.rewarded || {})) {
    if (box.rewarded[k] < cut) { delete box.rewarded[k]; n++; }
  }
  return n;
}

module.exports = {
  RULES, onDone, onCheckItem, onAlarmStopped, firstUse, grant, spend,
  level, nextLevelExp, rollDay, pruneRewarded
};
