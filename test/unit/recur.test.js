'use strict';
// recur.js: DST (America/New_York), cuối tháng, năm nhuận, weekdays qua cuối tuần, parseRecur, catchUp.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../../src/shared/recur.js');

const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
const p2 = n => String(n).padStart(2, '0');
const fmt = ms => { if (ms == null) return null; const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const nx = (rule, after) => fmt(R.nextOccurrence(rule, after));
const NY = process.env.TZ === 'America/New_York';
const ny = NY ? test : (n, f) => test(n, { skip: 'chỉ chạy với TZ=America/New_York' }, f);

/* ---- DST ---- */
ny('DST kết thúc 1/11/2026: daily 08:00 vẫn là 08:00 giờ máy', () => {
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 10, 31, 9)), '2026-11-01 08:00');
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 11, 1, 9)), '2026-11-02 08:00');
});
ny('DST bắt đầu 8/3/2026: daily 08:00 vẫn 08:00 (khoảng cách 23 tiếng)', () => {
  const a = R.nextOccurrence({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 3, 7, 9));
  assert.strictEqual(fmt(a), '2026-03-08 08:00');
  assert.strictEqual(a - L(2026, 3, 7, 8), 23 * 36e5);
});
ny('giờ không tồn tại 02:30 ngày 8/3/2026: không bỏ mất ngày đó, kết quả > after', () => {
  const after = L(2026, 3, 7, 3);
  const a = R.nextOccurrence({ repeat: { freq: 'daily' }, time: '02:30' }, after);
  assert.ok(a > after);
  assert.strictEqual(R.dayKey(a), '2026-03-08');
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '02:30' }, a), '2026-03-09 02:30');
});
ny('giờ lặp 01:30 ngày 1/11/2026: không kêu hai lần, lần kế là 2/11', () => {
  const first = Date.UTC(2026, 10, 1, 5, 30);                     // 01:30 EDT lần đầu
  assert.strictEqual(fmt(first), '2026-11-01 01:30');
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '01:30' }, first), '2026-11-02 01:30');
  const n2 = nx({ repeat: { freq: 'daily' }, time: '01:30' }, first - 36e5);
  assert.strictEqual(n2.slice(0, 10), '2026-11-01');
});
ny('weekly thứ 2 09:00 qua DST: luôn 09:00 giờ máy', () => {
  let t = L(2026, 10, 20, 12);
  const got = [];
  for (let i = 0; i < 4; i++) { t = R.nextOccurrence({ repeat: { freq: 'weekly', byDay: [1] }, time: '09:00' }, t); got.push(fmt(t)); }
  assert.deepStrictEqual(got, ['2026-10-26 09:00', '2026-11-02 09:00', '2026-11-09 09:00', '2026-11-16 09:00']);
});
ny('daily interval 3 qua DST: mỗi 3 ngày lịch, giờ không trôi', () => {
  const rep = { freq: 'daily', interval: 3, anchor: L(2026, 10, 30, 8) };
  assert.strictEqual(nx({ repeat: rep, time: '08:00' }, L(2026, 10, 30, 9)), '2026-11-02 08:00');
  assert.strictEqual(nx({ repeat: rep, time: '08:00' }, L(2026, 11, 2, 9)), '2026-11-05 08:00');
});
ny('hourly qua DST là bước tuyệt đối đúng 1 giờ', () => {
  const anchor = Date.UTC(2026, 10, 1, 3, 0);
  const a = R.nextOccurrence({ repeat: { freq: 'hourly', anchor }, time: null }, Date.UTC(2026, 10, 1, 5, 10));
  assert.strictEqual(a, Date.UTC(2026, 10, 1, 6, 0));
});
test('một lần có date, giờ đúng giờ máy (mọi múi giờ)', () => {
  assert.strictEqual(nx({ repeat: null, time: '23:59', date: '2026-11-01' }, L(2026, 10, 15)), '2026-11-01 23:59');
});

/* ---- cuối tháng ---- */
test('monthly 31: không trôi giờ/ngày qua các tháng 30/28 ngày', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' };
  let t = L(2026, 1, 1);
  const got = [];
  for (let i = 0; i < 6; i++) { t = R.nextOccurrence(rule, t); got.push(fmt(t)); }
  assert.deepStrictEqual(got, ['2026-01-31 09:00', '2026-02-28 09:00', '2026-03-31 09:00', '2026-04-30 09:00', '2026-05-31 09:00', '2026-06-30 09:00']);
});
test('monthly 31 sau ngày 31 -> tháng sau (không kẹt cùng ngày)', () => {
  assert.strictEqual(nx({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2026, 3, 31, 9)), '2026-04-30 09:00');
  assert.strictEqual(nx({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2026, 12, 31, 9)), '2027-01-31 09:00');
});
test('monthly 30 vào tháng 2: 28 (thường) / 29 (nhuận)', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 30 }, time: '08:00' };
  assert.strictEqual(nx(rule, L(2027, 1, 30, 9)), '2027-02-28 08:00');
  assert.strictEqual(nx(rule, L(2028, 1, 30, 9)), '2028-02-29 08:00');
});
test('monthly 29 vào tháng 2 năm không nhuận: 28; năm 2100 không nhuận', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 29 }, time: '08:00' };
  assert.strictEqual(nx(rule, L(2026, 1, 29, 9)), '2026-02-28 08:00');
  assert.strictEqual(nx(rule, L(2100, 1, 29, 9)), '2100-02-28 08:00');
});
test('monthly interval 2 neo 31/1: 31/3, 31/5, ... bỏ qua tháng 2/4 đúng chu kỳ', () => {
  const rep = { freq: 'monthly', byMonthDay: 31, interval: 2, anchor: L(2026, 1, 31, 12) };
  const got = []; let t = L(2026, 1, 31, 10);
  for (let i = 0; i < 5; i++) { t = R.nextOccurrence({ repeat: rep, time: '09:00' }, t); got.push(fmt(t)); }
  assert.deepStrictEqual(got, ['2026-03-31 09:00', '2026-05-31 09:00', '2026-07-31 09:00', '2026-09-30 09:00', '2026-11-30 09:00']);
});
test('alarmNextAt monthly thiếu byMonthDay: lấy ngày từ date (31/1 -> 28/2 -> 31/3)', () => {
  const al = { enabled: true, time: '09:00', date: '2026-01-31', repeat: { freq: 'monthly' }, createdAt: L(2026, 1, 1) };
  const a = R.alarmNextAt(al, L(2026, 1, 31, 10));
  assert.strictEqual(fmt(a), '2026-02-28 09:00');
  assert.strictEqual(fmt(R.alarmNextAt(al, a)), '2026-03-31 09:00');
});
test('parseRecur: "cuối tháng hằng tháng" -> ngày 31', () => {
  const r = R.parseRecur('trả tiền nhà cuối tháng hằng tháng 9h');
  assert.deepStrictEqual(r.repeat, { freq: 'monthly', byMonthDay: 31 });
  assert.strictEqual(r.time, '09:00');
});

/* ---- năm nhuận ---- */
test('daily: 28/2/2028 -> 29/2 ; 28/2/2027 -> 1/3', () => {
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '08:00' }, L(2028, 2, 28, 9)), '2028-02-29 08:00');
  assert.strictEqual(nx({ repeat: { freq: 'daily' }, time: '08:00' }, L(2027, 2, 28, 9)), '2027-03-01 08:00');
});
test('một lần ngày 29/2: năm nhuận hợp lệ, năm thường là null', () => {
  assert.strictEqual(nx({ repeat: null, time: '10:00', date: '2028-02-29' }, L(2028, 1, 1)), '2028-02-29 10:00');
  assert.strictEqual(R.nextOccurrence({ repeat: null, time: '10:00', date: '2027-02-29' }, L(2027, 1, 1)), null);
  assert.strictEqual(R.nextOccurrence({ repeat: null, time: '10:00', date: '2100-02-29' }, L(2100, 1, 1)), null);
});
test('daily interval 7 qua 29/2 vẫn cách đúng 7 ngày lịch', () => {
  const rep = { freq: 'daily', interval: 7, anchor: L(2028, 2, 22, 8) };
  assert.strictEqual(nx({ repeat: rep, time: '08:00' }, L(2028, 2, 22, 9)), '2028-02-29 08:00');
  assert.strictEqual(nx({ repeat: rep, time: '08:00' }, L(2028, 2, 29, 9)), '2028-03-07 08:00');
});
test('weekly thứ 4 qua 29/2/2028 (thứ 3) -> 1/3 thứ 4', () => {
  assert.strictEqual(nx({ repeat: { freq: 'weekly', byDay: [3] }, time: '08:00' }, L(2028, 2, 28, 9)), '2028-03-01 08:00');
});
test('daysInMonth', () => {
  assert.strictEqual(R.daysInMonth(2028, 1), 29);
  assert.strictEqual(R.daysInMonth(2026, 1), 28);
  assert.strictEqual(R.daysInMonth(2100, 1), 28);
  assert.strictEqual(R.daysInMonth(2000, 1), 29);
});

/* ---- weekdays ---- */
test('weekdays: thứ 6 sau giờ -> thứ 2; thứ 7, chủ nhật -> thứ 2; thứ 6 trước giờ -> cùng ngày', () => {
  const rule = { repeat: { freq: 'weekdays' }, time: '09:00' };
  // 16/10/2026 = thứ 6
  assert.strictEqual(nx(rule, L(2026, 10, 16, 17)), '2026-10-19 09:00');
  assert.strictEqual(nx(rule, L(2026, 10, 17, 10)), '2026-10-19 09:00');
  assert.strictEqual(nx(rule, L(2026, 10, 18, 23, 59)), '2026-10-19 09:00');
  assert.strictEqual(nx(rule, L(2026, 10, 16, 8)), '2026-10-16 09:00');
  assert.strictEqual(nx(rule, L(2026, 10, 19, 9)), '2026-10-20 09:00');
});
test('weekdays qua cuối tháng / cuối năm / chủ nhật 00:00', () => {
  const rule = { repeat: { freq: 'weekdays' }, time: '07:30' };
  assert.strictEqual(nx(rule, L(2026, 10, 30, 8)), '2026-11-02 07:30');   // thứ 6 30/10 -> thứ 2 2/11
  assert.strictEqual(nx(rule, L(2027, 12, 31, 9)), '2028-01-03 07:30');   // thứ 6 31/12/2027 -> thứ 2 3/1/2028
  assert.strictEqual(nx({ repeat: { freq: 'weekdays' }, time: '00:00' }, L(2026, 10, 16, 0, 1)), '2026-10-19 00:00');
});
test('weekdays 7 ngày liên tiếp không bao giờ rơi vào T7/CN', () => {
  let t = L(2026, 10, 12);
  for (let i = 0; i < 20; i++) {
    t = R.nextOccurrence({ repeat: { freq: 'weekdays' }, time: '09:00' }, t);
    const d = new Date(t).getDay();
    assert.ok(d >= 1 && d <= 5, fmt(t));
  }
});
test('weekly [6,0] (cuối tuần) và thứ 2-4-6', () => {
  assert.strictEqual(nx({ repeat: { freq: 'weekly', byDay: [0, 6] }, time: '10:00' }, L(2026, 10, 16, 12)), '2026-10-17 10:00');
  assert.strictEqual(nx({ repeat: { freq: 'weekly', byDay: [0, 6] }, time: '10:00' }, L(2026, 10, 17, 12)), '2026-10-18 10:00');
  assert.strictEqual(nx({ repeat: { freq: 'weekly', byDay: [0, 6] }, time: '10:00' }, L(2026, 10, 18, 12)), '2026-10-24 10:00');
  assert.strictEqual(nx({ repeat: { freq: 'weekly', byDay: [1, 3, 5] }, time: '10:00' }, L(2026, 10, 16, 12)), '2026-10-19 10:00');
});
test('weekly interval 2 thứ 2: cách đúng 2 tuần, qua chủ nhật', () => {
  const rep = { freq: 'weekly', byDay: [1], interval: 2, anchor: L(2026, 10, 12, 9) };
  assert.strictEqual(nx({ repeat: rep, time: '09:00' }, L(2026, 10, 12, 10)), '2026-10-26 09:00');
  assert.strictEqual(nx({ repeat: rep, time: '09:00' }, L(2026, 10, 18, 10)), '2026-10-26 09:00');
});

/* ---- parseRecur ---- */
test('parseRecur: các câu thường gặp', () => {
  const pr = t => { const r = R.parseRecur(t); return r && r.repeat; };
  assert.deepStrictEqual(pr('mỗi ngày 8h uống thuốc'), { freq: 'daily' });
  assert.deepStrictEqual(pr('hằng ngày 8h'), { freq: 'daily' });
  assert.deepStrictEqual(pr('ngày thường 8h30 điểm danh'), { freq: 'weekdays' });
  assert.deepStrictEqual(pr('thứ 2, 4, 6 lúc 9h tập gym'), { freq: 'weekly', byDay: [1, 3, 5] });
  assert.deepStrictEqual(pr('mỗi thứ 2 họp'), { freq: 'weekly', byDay: [1] });
  assert.deepStrictEqual(pr('mỗi 2 tiếng uống nước'), { freq: 'hourly', interval: 2 });
  assert.deepStrictEqual(pr('mỗi 2 tuần'), { freq: 'weekly', interval: 2 });
  assert.deepStrictEqual(pr('ngày 5 hằng tháng đóng tiền'), { freq: 'monthly', byMonthDay: 5 });
  assert.deepStrictEqual(pr('moi ngay 8h'), { freq: 'daily' });
});
test('parseRecur: câu không lặp -> null', () => {
  for (const t of ['họp thứ 6 3h chiều', 'thứ 6 tuần sau', 'mai 9h', 'mua sữa', '', '   ', 'họp 3h chiều nay', 'mỗi 5 phút']) {
    assert.strictEqual(R.parseRecur(t), null, t);
  }
  assert.strictEqual(R.parseRecur(null), null);
  assert.strictEqual(R.parseRecur(42), null);
});
test('parseRecur: giờ theo buổi (chiều/tối/đêm)', () => {
  assert.strictEqual(R.parseRecur('mỗi ngày 3h chiều').time, '15:00');
  assert.strictEqual(R.parseRecur('mỗi ngày 8h tối').time, '20:00');
  assert.strictEqual(R.parseRecur('mỗi ngày 12h trưa').time, '12:00');
  assert.strictEqual(R.parseRecur('mỗi ngày 12h đêm').time, '00:00');
});

/* ---- catchUp / mô tả / đầu vào xấu ---- */
test('catchUp', () => {
  assert.strictEqual(R.catchUp(2000, 1000, 500), 'wait');
  assert.strictEqual(R.catchUp(1000, 1400, 500), 'ring');
  assert.strictEqual(R.catchUp(1000, 1500, 500), 'ring');
  assert.strictEqual(R.catchUp(1000, 1501, 500), 'missed');
  assert.strictEqual(R.catchUp(null, 1501, 500), 'wait');
});
test('alarmNextAt: tắt -> null; null -> null', () => {
  assert.strictEqual(R.alarmNextAt({ enabled: false, time: '09:00' }, 0), null);
  assert.strictEqual(R.alarmNextAt(null, 0), null);
});
test('nextOccurrence luôn > afterMs với mọi rule hợp lệ', () => {
  const rules = [
    { repeat: { freq: 'daily' }, time: '00:00' }, { repeat: { freq: 'weekdays' }, time: '23:59' },
    { repeat: { freq: 'weekly', byDay: [0] }, time: '12:00' }, { repeat: { freq: 'monthly', byMonthDay: 31 }, time: '00:00' },
    { repeat: null, time: '12:00' }
  ];
  for (const r of rules) for (let i = 0; i < 400; i++) {
    const after = L(2026, 1, 1) + i * 37 * 36e5 + (i % 7) * 60000;
    const a = R.nextOccurrence(r, after);
    assert.ok(a > after, JSON.stringify(r) + ' ' + fmt(after) + ' -> ' + fmt(a));
  }
});
test('describeRepeat', () => {
  assert.strictEqual(R.describeRepeat(null), 'Một lần');
  assert.strictEqual(R.describeRepeat({ freq: 'daily' }), 'Hằng ngày');
  assert.strictEqual(R.describeRepeat({ freq: 'weekly', byDay: [1, 3, 5] }), 'Thứ 2, 4, 6');
});
