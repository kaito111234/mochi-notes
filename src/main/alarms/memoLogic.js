'use strict';
// Logic thuần của "Dặn dò" (không đụng Electron) — test trong __tests__/memo.test.js.
// Mọi thời gian là giờ địa phương. Khung giờ: morning [06:00,11:00), noon [11:00,14:00), evening [17:00,22:00).
// Bù: memo của khung ĐÃ BẮT ĐẦU hôm nay mà chưa hiện thì hiện ở lần đầu người dùng có mặt, đến hết ngày
// (morning từ 06:00, noon từ 11:00, evening từ 17:00); nhiều khung bị lỡ thì gộp hiện cùng lúc.

const SLOTS = [
  { when: 'morning', from: 6 * 60, to: 11 * 60 },
  { when: 'noon', from: 11 * 60, to: 14 * 60 },
  { when: 'evening', from: 17 * 60, to: 22 * 60 }
];

const pad = n => String(n).padStart(2, '0');
function dayKey(d) { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Khung giờ hiện tại: 'morning' | 'noon' | 'evening' | null (14–17h và 22–06h không có khung). */
function slotOf(now) {
  const d = now instanceof Date ? now : new Date(now);
  const m = d.getHours() * 60 + d.getMinutes();
  const s = SLOTS.find(x => m >= x.from && m < x.to);
  return s ? s.when : null;
}

/** Memo có được phép hiện hôm nay không (bật, đúng thứ, chưa hiện hôm nay). */
function eligibleToday(memo, now) {
  if (!memo || memo.enabled === false) return false;
  const d = now instanceof Date ? now : new Date(now);
  if (Array.isArray(memo.days) && memo.days.length && !memo.days.includes(d.getDay())) return false;
  if (memo.lastShownDay === dayKey(d)) return false;
  return true;
}

/**
 * Các memo đến hạn.
 *  kind: 'startup' | 'tick' (kiểm định kỳ/resume) | 'before-shutdown'
 *  opts.idle: máy đang rảnh -> 'tick' không hiện gì (chờ app:resume).
 */
function dueMemos(memos, now, kind, opts) {
  const o = opts || {};
  let when;
  if (kind === 'startup') when = 'startup';
  else if (kind === 'before-shutdown') when = 'before-shutdown';
  else if (kind === 'tick') {
    if (o.idle) return [];
    const d = now instanceof Date ? now : new Date(now);
    const mins = d.getHours() * 60 + d.getMinutes();
    const started = SLOTS.filter(s => mins >= s.from).map(s => s.when);
    if (!started.length) return [];
    return (memos || []).filter(m => started.includes(m.when) && eligibleToday(m, now));
  }
  else return [];
  return (memos || []).filter(m => m.when === when && eligibleToday(m, now));
}

/** Đánh dấu đã hiện: lastShownDay = hôm nay; once -> tắt. Trả về true nếu có thay đổi. */
function markShown(memo, now) {
  const k = dayKey(now);
  let changed = false;
  if (memo.lastShownDay !== k) { memo.lastShownDay = k; changed = true; }
  if (memo.once && memo.enabled !== false) { memo.enabled = false; changed = true; }
  return changed;
}

const TITLES = {
  startup: 'Tớ dặn cậu nè',
  morning: 'Sáng nay nhớ nhé',
  noon: 'Trưa rồi, cậu nhớ nha',
  evening: 'Tối nay nhớ nhé',
  'before-shutdown': 'Trước khi tắt máy…'
};
/** Tiêu đề popup theo danh sách mục; nhiều loại khác nhau thì dùng câu chung. */
function titleFor(items, quitting) {
  if (quitting) return TITLES['before-shutdown'];
  const set = [...new Set((items || []).map(i => i.when))];
  return set.length === 1 && TITLES[set[0]] ? TITLES[set[0]] : TITLES.startup;
}

module.exports = { SLOTS, slotOf, dayKey, eligibleToday, dueMemos, markShown, titleFor, TITLES };
