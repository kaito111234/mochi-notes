// Test recur.js bằng node thuần: node src/shared/__tests__/recur.test.js  (chạy được với mọi TZ)
const assert = require('assert');
const R = require('../recur.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error('HỎNG: ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
// Giờ địa phương: tháng 1-12.
const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
const fmt = ms => ms == null ? null : R.dayKey(ms) + ' ' + String(new Date(ms).getHours()).padStart(2, '0') + ':' + String(new Date(ms).getMinutes()).padStart(2, '0');
const next = (rule, after) => fmt(R.nextOccurrence(rule, after));

/* ---- Một lần ---- */
t('một lần: date+time tương lai', () => assert.strictEqual(next({ repeat: null, time: '09:00', date: '2026-10-20' }, L(2026, 10, 15, 8)), '2026-10-20 09:00'));
t('một lần: date đã qua -> null', () => assert.strictEqual(R.nextOccurrence({ repeat: null, time: '09:00', date: '2026-10-10' }, L(2026, 10, 15, 8)), null));
t('một lần: không date, hôm nay', () => assert.strictEqual(next({ repeat: null, time: '09:00' }, L(2026, 10, 15, 8)), '2026-10-15 09:00'));
t('một lần: không date, giờ đã qua -> mai', () => assert.strictEqual(next({ repeat: null, time: '09:00' }, L(2026, 10, 15, 10)), '2026-10-16 09:00'));
t('một lần: đúng bằng afterMs -> mai (phải > after)', () => assert.strictEqual(next({ repeat: null, time: '09:00' }, L(2026, 10, 15, 9)), '2026-10-16 09:00'));
t('rule hỏng -> null', () => {
  assert.strictEqual(R.nextOccurrence(null, 0), null);
  assert.strictEqual(R.nextOccurrence({ repeat: null, time: 'abc' }, 0), null);
  assert.strictEqual(R.nextOccurrence({ repeat: { freq: 'yearly' }, time: '09:00' }, 0), null);
});

/* ---- Hằng ngày / qua nửa đêm / năm mới ---- */
t('daily: 23:59 -> 00:00 hôm sau', () => assert.strictEqual(next({ repeat: { freq: 'daily' }, time: '00:00' }, L(2026, 10, 15, 23, 59)), '2026-10-16 00:00'));
t('daily: trước giờ trong ngày', () => assert.strictEqual(next({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 10, 15, 7, 59)), '2026-10-15 08:00'));
t('daily: đúng giờ -> ngày mai', () => assert.strictEqual(next({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 10, 15, 8, 0)), '2026-10-16 08:00'));
t('daily: 31/12 sang năm mới', () => assert.strictEqual(next({ repeat: { freq: 'daily' }, time: '08:00' }, L(2026, 12, 31, 9)), '2027-01-01 08:00'));
t('daily interval 2 từ anchor', () => {
  const rep = { freq: 'daily', interval: 2, anchor: L(2026, 10, 1, 8) };
  assert.strictEqual(next({ repeat: rep, time: '08:00' }, L(2026, 10, 1, 9)), '2026-10-03 08:00');
  assert.strictEqual(next({ repeat: rep, time: '08:00' }, L(2026, 10, 2, 9)), '2026-10-03 08:00');
});
t('daily: kết quả luôn > afterMs (quét 200 mốc)', () => {
  for (let i = 0; i < 200; i++) {
    const after = L(2026, 1, 1, 0, 0) + i * 7 * 36e5 + i * 61000;
    const r = R.nextOccurrence({ repeat: { freq: 'daily' }, time: '13:37' }, after);
    assert.ok(r > after && r - after <= 25 * 36e5);
  }
});

/* ---- Ngày thường ---- */
t('weekdays: thứ 6 tối -> thứ 2', () => assert.strictEqual(next({ repeat: { freq: 'weekdays' }, time: '09:00' }, L(2026, 10, 16, 18)), '2026-10-19 09:00')); // 16/10/2026 là thứ 6
t('weekdays: thứ 7 -> thứ 2', () => assert.strictEqual(next({ repeat: { freq: 'weekdays' }, time: '09:00' }, L(2026, 10, 17, 10)), '2026-10-19 09:00'));
t('weekdays: thứ 2 sáng sớm -> chính hôm đó', () => assert.strictEqual(next({ repeat: { freq: 'weekdays' }, time: '09:00' }, L(2026, 10, 19, 6)), '2026-10-19 09:00'));

/* ---- Hằng tuần ---- */
t('weekly nhiều thứ: T2,T4,T6', () => {
  const rule = { repeat: { freq: 'weekly', byDay: [1, 3, 5] }, time: '09:00' };
  assert.strictEqual(next(rule, L(2026, 10, 19, 10)), '2026-10-21 09:00'); // T2 -> T4
  assert.strictEqual(next(rule, L(2026, 10, 21, 10)), '2026-10-23 09:00'); // T4 -> T6
  assert.strictEqual(next(rule, L(2026, 10, 23, 10)), '2026-10-26 09:00'); // T6 -> T2
});
t('weekly chủ nhật', () => assert.strictEqual(next({ repeat: { freq: 'weekly', byDay: [0] }, time: '20:00' }, L(2026, 10, 15, 12)), '2026-10-18 20:00'));
t('weekly không byDay -> thứ của anchor', () => {
  const anchor = L(2026, 10, 14, 9); // thứ 4
  assert.strictEqual(next({ repeat: { freq: 'weekly', anchor }, time: '09:00' }, L(2026, 10, 14, 10)), '2026-10-21 09:00');
});
t('weekly interval 2 tuần (T3)', () => {
  const rep = { freq: 'weekly', byDay: [2], interval: 2, anchor: L(2026, 10, 6, 9) };
  const rule = { repeat: rep, time: '09:00' };
  assert.strictEqual(next(rule, L(2026, 10, 7, 0)), '2026-10-20 09:00');
  assert.strictEqual(next(rule, L(2026, 10, 20, 10)), '2026-11-03 09:00');
  assert.strictEqual(next(rule, L(2026, 10, 5, 0)), '2026-10-06 09:00');
});
t('weekly interval 2 nhiều thứ (T2,T5) qua cuối tuần', () => {
  const rep = { freq: 'weekly', byDay: [1, 4], interval: 2, anchor: L(2026, 10, 5, 8) }; // anchor T2 5/10
  const rule = { repeat: rep, time: '08:00' };
  assert.strictEqual(next(rule, L(2026, 10, 5, 9)), '2026-10-08 08:00');
  assert.strictEqual(next(rule, L(2026, 10, 8, 9)), '2026-10-19 08:00');
});

/* ---- Hằng tháng ---- */
t('monthly 31: 31/1 -> 28/2/2027 (không nhuận)', () => assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2027, 1, 31, 10)), '2027-02-28 09:00'));
t('monthly 31: 31/1 -> 29/2/2028 (nhuận)', () => assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2028, 1, 31, 10)), '2028-02-29 09:00'));
t('monthly 29: 2027 -> 28/2, 2028 -> 29/2', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 29 }, time: '09:00' };
  assert.strictEqual(next(rule, L(2027, 2, 1, 0)), '2027-02-28 09:00');
  assert.strictEqual(next(rule, L(2028, 2, 1, 0)), '2028-02-29 09:00');
});
t('monthly 31: 28/2 -> 31/3', () => assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2027, 2, 28, 10)), '2027-03-31 09:00'));
t('monthly 31: tháng 30 ngày -> 30', () => assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '09:00' }, L(2026, 3, 31, 10)), '2026-04-30 09:00'));
t('monthly 5: sang tháng sau và sang năm', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 5 }, time: '09:00' };
  assert.strictEqual(next(rule, L(2026, 10, 15, 0)), '2026-11-05 09:00');
  assert.strictEqual(next(rule, L(2026, 12, 15, 0)), '2027-01-05 09:00');
  assert.strictEqual(next(rule, L(2026, 10, 5, 8)), '2026-10-05 09:00');
});
t('monthly interval 2', () => {
  const rule = { repeat: { freq: 'monthly', byMonthDay: 10, interval: 2, anchor: L(2026, 1, 10, 9) }, time: '09:00' };
  assert.strictEqual(next(rule, L(2026, 1, 10, 10)), '2026-03-10 09:00');
});
t('31/12 monthly 31 -> 31/1 năm sau', () => assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 31 }, time: '23:30' }, L(2026, 12, 31, 23, 45)), '2027-01-31 23:30'));

/* ---- Hourly ---- */
t('hourly mỗi 2 tiếng từ anchor', () => {
  const rule = { repeat: { freq: 'hourly', interval: 2, anchor: L(2026, 10, 15, 8) }, time: '08:00' };
  assert.strictEqual(next(rule, L(2026, 10, 15, 8, 0)), '2026-10-15 10:00');
  assert.strictEqual(next(rule, L(2026, 10, 15, 9, 30)), '2026-10-15 10:00');
  assert.strictEqual(next(rule, L(2026, 10, 15, 23, 30)), '2026-10-16 00:00');
});
t('hourly anchor ở tương lai -> chính anchor', () => assert.strictEqual(next({ repeat: { freq: 'hourly', interval: 3, anchor: L(2026, 10, 16, 8) }, time: '08:00' }, L(2026, 10, 15, 8)), '2026-10-16 08:00'));
t('hourly thiếu anchor -> mốc time hôm nay', () => {
  const rule = { repeat: { freq: 'hourly', interval: 2 }, time: '08:00' };
  assert.strictEqual(next(rule, L(2026, 10, 15, 9)), '2026-10-15 10:00');
});

/* ---- Đổi giờ DST (chỉ có nghĩa với TZ=America/New_York; ở TZ khác vẫn phải đúng) ---- */
t('DST mùa xuân (8/3/2026): 8:00 hằng ngày vẫn đúng 08:00 địa phương', () => {
  const rule = { repeat: { freq: 'daily' }, time: '08:00' };
  let after = L(2026, 3, 7, 8, 0);
  for (const exp of ['2026-03-08 08:00', '2026-03-09 08:00', '2026-03-10 08:00']) {
    const r = R.nextOccurrence(rule, after);
    assert.strictEqual(fmt(r), exp);
    assert.strictEqual(new Date(r).getHours(), 8);
    after = r;
  }
});
t('DST mùa thu (1/11/2026): 8:00 hằng ngày vẫn đúng 08:00', () => {
  const rule = { repeat: { freq: 'daily' }, time: '08:00' };
  assert.strictEqual(next(rule, L(2026, 10, 31, 8, 0)), '2026-11-01 08:00');
  assert.strictEqual(next(rule, L(2026, 11, 1, 8, 0)), '2026-11-02 08:00');
});
t('DST: weekly T2 và monthly qua đổi giờ', () => {
  assert.strictEqual(next({ repeat: { freq: 'weekly', byDay: [1] }, time: '08:00' }, L(2026, 3, 2, 9)), '2026-03-09 08:00');
  assert.strictEqual(next({ repeat: { freq: 'monthly', byMonthDay: 8 }, time: '08:00' }, L(2026, 2, 8, 9)), '2026-03-08 08:00');
});

/* ---- alarmNextAt / catchUp ---- */
t('alarmNextAt: tắt -> null', () => assert.strictEqual(R.alarmNextAt({ enabled: false, time: '08:00', repeat: { freq: 'daily' } }, L(2026, 10, 15, 0)), null));
t('alarmNextAt: lặp + một lần + date', () => {
  const now = L(2026, 10, 15, 9);
  assert.strictEqual(fmt(R.alarmNextAt({ enabled: true, time: '08:00', repeat: { freq: 'daily' } }, now)), '2026-10-16 08:00');
  assert.strictEqual(fmt(R.alarmNextAt({ enabled: true, time: '08:00', repeat: null, date: '2026-10-20' }, now)), '2026-10-20 08:00');
  assert.strictEqual(R.alarmNextAt({ enabled: true, time: '08:00', repeat: null, date: '2026-10-01' }, now), null);
});
t('alarmNextAt: interval>1 thiếu anchor dùng createdAt', () => {
  const a = { enabled: true, time: '08:00', repeat: { freq: 'daily', interval: 3 }, createdAt: L(2026, 10, 1, 7) };
  assert.strictEqual(fmt(R.alarmNextAt(a, L(2026, 10, 2, 0))), '2026-10-04 08:00');
});
t('catchUp wait/ring/missed', () => {
  const now = 1e12, g = 5 * 6e4;
  assert.strictEqual(R.catchUp(now + 1, now, g), 'wait');
  assert.strictEqual(R.catchUp(now, now, g), 'ring');
  assert.strictEqual(R.catchUp(now - g, now, g), 'ring');
  assert.strictEqual(R.catchUp(now - g - 1, now, g), 'missed');
});

/* ---- describeRepeat / dayKey / WEEKDAY_SHORT ---- */
t('describeRepeat', () => {
  assert.strictEqual(R.describeRepeat(null), 'Một lần');
  assert.strictEqual(R.describeRepeat({ freq: 'daily' }), 'Hằng ngày');
  assert.strictEqual(R.describeRepeat({ freq: 'weekdays' }), 'Ngày thường (T2–T6)');
  assert.strictEqual(R.describeRepeat({ freq: 'weekly', byDay: [1, 3, 5] }), 'Thứ 2, 4, 6');
  assert.strictEqual(R.describeRepeat({ freq: 'weekly', byDay: [0, 6] }), 'Thứ 7, CN');
  assert.strictEqual(R.describeRepeat({ freq: 'weekly', byDay: [2] }), 'Thứ 3 hằng tuần');
  assert.strictEqual(R.describeRepeat({ freq: 'weekly', byDay: [2], interval: 2 }), 'Mỗi 2 tuần, thứ 3');
  assert.strictEqual(R.describeRepeat({ freq: 'monthly', byMonthDay: 5 }), 'Ngày 5 hằng tháng');
  assert.strictEqual(R.describeRepeat({ freq: 'hourly', interval: 2 }), 'Mỗi 2 tiếng');
  assert.strictEqual(R.describeRepeat({ freq: 'daily', interval: 2 }), 'Mỗi 2 ngày');
});
t('dayKey + WEEKDAY_SHORT', () => {
  assert.strictEqual(R.dayKey(L(2026, 3, 8, 0, 5)), '2026-03-08');
  assert.strictEqual(R.dayKey(L(2026, 12, 31, 23, 59)), '2026-12-31');
  assert.deepStrictEqual(R.WEEKDAY_SHORT, ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
});

/* ---- parseRecur ---- */
const P = (s, repeat, time) => t('parse: ' + s, () => assert.deepStrictEqual(R.parseRecur(s), { repeat, time }));
P('mỗi sáng 8h', { freq: 'daily' }, '08:00');
P('8h sáng hằng ngày', { freq: 'daily' }, '08:00');
P('nhắc tôi 8h sáng hàng ngày', { freq: 'daily' }, '08:00');
P('mỗi ngày', { freq: 'daily' }, null);
P('7h30 tối mỗi ngày', { freq: 'daily' }, '19:30');
P('moi ngay 6:45', { freq: 'daily' }, '06:45');
P('thứ 2 hàng tuần', { freq: 'weekly', byDay: [1] }, null);
P('thứ 2, 4, 6 lúc 9h', { freq: 'weekly', byDay: [1, 3, 5] }, '09:00');
P('t2 t4 9h', { freq: 'weekly', byDay: [1, 3] }, '09:00');
P('chủ nhật hằng tuần', { freq: 'weekly', byDay: [0] }, null);
P('các ngày trong tuần 9h', { freq: 'weekdays' }, '09:00');
P('ngày thường 9h', { freq: 'weekdays' }, '09:00');
P('thứ 2 đến thứ 6 lúc 8 giờ', { freq: 'weekdays' }, '08:00');
P('ngày 5 hàng tháng', { freq: 'monthly', byMonthDay: 5 }, null);
P('mùng 5 hằng tháng 8h sáng', { freq: 'monthly', byMonthDay: 5 }, '08:00');
P('mỗi 2 tiếng', { freq: 'hourly', interval: 2 }, null);
P('2 tuần một lần thứ 3', { freq: 'weekly', byDay: [2], interval: 2 }, null);
P('thu 7 hang tuan 9h30', { freq: 'weekly', byDay: [6] }, '09:30');
P('12h trưa mỗi ngày', { freq: 'daily' }, '12:00');
P('12h đêm mỗi ngày', { freq: 'daily' }, '00:00');
P('mỗi tối', { freq: 'daily' }, '20:00');
P('8:30 moi sang', { freq: 'daily' }, '08:30');
P('cuối tháng hằng tháng 9h', { freq: 'monthly', byMonthDay: 31 }, '09:00');
P('7 giờ rưỡi tối mỗi ngày', { freq: 'daily' }, '19:30');
t('parse: câu không lặp -> null', () => {
  for (const s of ['họp 3h chiều nay', 'mua sữa', 'mai 8h đi chợ', 'thứ 2 tuần sau 9h', 'họp thứ 3 lúc 10h', '', 'mỗi 30 phút', 'mỗi 15 phút uống nước', 'nhắc tôi tối nay']) {
    assert.strictEqual(R.parseRecur(s), null, s);
  }
  assert.strictEqual(R.parseRecur(null), null);
});
t('parse -> nextOccurrence khớp ngày thường', () => {
  const p = R.parseRecur('thứ 2 đến thứ 6 lúc 9h');
  assert.strictEqual(next({ repeat: p.repeat, time: p.time }, L(2026, 10, 16, 18)), '2026-10-19 09:00');
});

console.log('Đạt ' + pass + '/' + (pass + fail) + ' ca (TZ=' + (process.env.TZ || 'mặc định') + ')');
process.exit(fail ? 1 : 0);
