'use strict';
// Tiện ích ngày/tuần theo giờ địa phương (thuần, nhận epoch ms).

const p2 = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// 'YYYY-MM-DD' -> Date 12:00 địa phương (tránh lệch do giờ mùa hè)
function parseDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
}

function dayKey(ms) { return fmt(new Date(ms)); }

// Thứ Hai của tuần chứa ms
function weekKey(ms) {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0);
  const back = (d.getDay() + 6) % 7; // T2=0 ... CN=6
  d.setDate(d.getDate() - back);
  return fmt(d);
}

function addDays(day, n) {
  const d = parseDay(day);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return fmt(d);
}

function isYesterday(prevDay, day) {
  if (!parseDay(prevDay) || !parseDay(day)) return false;
  return addDays(prevDay, 1) === day;
}

module.exports = { dayKey, weekKey, addDays, isYesterday, parseDay };
