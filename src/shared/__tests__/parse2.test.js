// Test bổ sung parse.js (Đợt 2b): số bằng chữ, 9.30, khoảng thời gian, nửa đêm, mai mốt, "ngày 20", phân số/ngày vô lý.
// node src/shared/__tests__/parse2.test.js  (đúng với mọi TZ)
const assert = require('assert');
const P = require('../parse.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error('HỎNG: ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
const pad = n => String(n).padStart(2, '0');
const NOW = new Date(2026, 9, 15, 10, 0); // Thứ Năm 15/10/2026 10:00
const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
const W = (text, now = NOW) => { const r = P.parseWhen(text, now); return r ? fmt(r.date) + (r.timed ? '' : ' (ngày)') : null; };
const eq = (text, exp, now) => t('"' + text + '" -> ' + exp, () => assert.strictEqual(W(text, now), exp));
const nul = text => t('"' + text + '" -> null', () => assert.strictEqual(W(text), null));
const span = (text, exp) => t('whenSpans "' + text + '" -> ' + JSON.stringify(exp), () =>
  assert.deepStrictEqual(P.whenSpans(text).map(([a, b]) => text.slice(a, b)), exp));
const N = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

/* số bằng chữ */
eq('họp mười giờ rưỡi', '2026-10-15 10:30');
eq('hai giờ chiều', '2026-10-15 14:00');
eq('chín giờ sáng mai', '2026-10-16 09:00');
eq('mười một giờ đêm', '2026-10-15 23:00');
eq('mười hai giờ trưa', '2026-10-15 12:00');
eq('một giờ chiều nay', '2026-10-15 13:00');
eq('ba giờ mười lăm chiều', '2026-10-15 15:15');
eq('hai mươi mốt giờ', '2026-10-15 21:00');
eq('năm phút nữa', '2026-10-15 10:05');
eq('hai tiếng nữa', '2026-10-15 12:00');
eq('ba ngày nữa', '2026-10-18 10:00 (ngày)');
eq('bảy giờ tối', '2026-10-15 19:00');
eq('sáu giờ sáng mai', '2026-10-16 06:00');
nul('sau giờ làm');
nul('bây giờ');
nul('năm nay');
nul('hai người bạn');
nul('học hai tiếng');
t('normNum cùng độ dài, giữ phần còn lại', () => {
  for (const s of ['hai giờ chiều gọi khách', 'Đi chơi ba ngày', 'ba giờ mười lăm họp', 'mười giờ rưỡi']) assert.strictEqual(P.normNum(s).length, s.length, s);
  assert.strictEqual(P.normNum('Đi chơi ba ngày'), 'Đi chơi ba ngày');
  assert.strictEqual(P.normNum('hai giờ chiều gọi khách').replace(/\s+/g, ' '), '2 giờ chiều gọi khách');
});
span('hai giờ chiều gọi khách', ['hai giờ chiều']);
span('ba giờ mười lăm họp', ['ba giờ mười lăm']);

/* 9.30 */
eq('9.30 sáng', '2026-10-16 09:30');
eq('họp 14.30 chiều', '2026-10-15 14:30');
eq('mai 9.30', '2026-10-16 09:30');
eq('họp lúc 9.30', '2026-10-15 21:30');
eq('9.30', '2026-10-15 21:30');
for (const s of ['mua 1.5kg thịt', '2.000.000', 'giá 9.30', 'Version 3.10', 'mua 1.25 kg', 'tăng 7.50%', 'hàng 1.50 lần', 'lương 12.500.000']) nul(s);
span('họp 9.30 sáng', ['9.30 sáng']);

/* khoảng thời gian */
eq('trong 5 phút', '2026-10-15 10:05');
eq('5 phút sau', '2026-10-15 10:05');
eq('trong 30 giây nữa', '2026-10-15 10:00');
eq('nửa tiếng nữa', '2026-10-15 10:30');
eq('nửa giờ nữa', '2026-10-15 10:30');
eq('nua tieng nua', '2026-10-15 10:30');
eq('1h30 nữa họp', '2026-10-15 11:30');
eq('1 giờ 30 nữa', '2026-10-15 11:30');
eq('2h15 nữa', '2026-10-15 12:15');
eq('1 tiếng rưỡi nữa', '2026-10-15 11:30');
eq('trong 10 phút nữa', '2026-10-15 10:10');
nul('họp trong tuần');
span('gọi khách trong 5 phút', ['trong 5 phút']);

/* nửa đêm / giờ đêm */
eq('nửa đêm', '2026-10-16 00:00');
eq('nửa đêm nay', '2026-10-16 00:00');
eq('nua dem', '2026-10-16 00:00');
eq('12h đêm', '2026-10-16 00:00');
eq('2h đêm', '2026-10-16 02:00');
eq('0h', '2026-10-16 00:00');
span('nửa đêm gọi mẹ', ['nửa đêm']);

/* mai mốt: hạn mềm, không có giờ */
nul('mai mốt đi khám');
nul('mai mot di kham');
nul('mai mốt 9h đi chơi');
eq('ngày mốt 7h', '2026-10-17 07:00');
eq('mốt 16h', '2026-10-17 16:00');
span('mai mốt đi chơi', ['mai mốt']);

/* "ngày 20" đứng một mình */
eq('ngày 20', '2026-10-20 09:00 (ngày)');
eq('ngày 20 nộp tiền nhà', '2026-10-20 09:00 (ngày)');
eq('ngày 15 họp', '2026-10-15 09:00 (ngày)');
eq('ngày 5 đi khám', '2026-11-05 09:00 (ngày)');
eq('ngày 14 họp 9h', '2026-11-14 09:00'); // đã qua -> tháng sau
eq('ngày 20 lúc 14h', '2026-10-20 14:00');
eq('ngày 31', '2026-10-31 09:00 (ngày)');
eq('ngày 31', '2026-12-31 09:00 (ngày)', N(2026, 11, 5, 8));            // tháng 11 không có ngày 31 -> tháng 12
eq('ngày 3', '2027-01-03 09:00 (ngày)', N(2026, 12, 20, 8));            // vắt năm
eq('ngày 30', '2026-03-30 09:00 (ngày)', N(2026, 2, 10, 8));            // tháng 2 không có ngày 30 -> tháng 3
eq('ngày 20-10', '2026-10-20 09:00 (ngày)');
for (const s of ['mỗi ngày 2 lần', 'uống thuốc ngày 3 lần', 'đi 3 ngày 2 lần', 'hàng ngày 5 việc', 'ngày 20 tháng 13']) nul(s);

/* ngày d-m, phân số, ngày vô lý */
eq('20-10 9h', '2026-10-20 09:00');
eq('20-10 lúc 9h', '2026-10-20 09:00');
eq('3/10 họp', '2027-10-03 09:00 (ngày)');
eq('5/11 họp', '2026-11-05 09:00 (ngày)');
eq('3/4 họp 9h', '2026-10-15 21:00');
for (const s of ['đọc 3/4 cuốn sách', 'chia 1/2 cái bánh', 'ăn 2/3 phần', 'giá 50-60k', 'tập 2-3 lần mỗi tuần nè', '32/1 họp', '30/2 họp 9h', '13/13 9h', '31/4 9h', '29/2/2027 9h']) nul(s);
eq('29/2/2028 9h', '2028-02-29 09:00');

/* thứ N tuần sau (BUG-003), giờ đêm (BUG-004), không dấu (BUG-010), từ thường (BUG-011) */
eq('thứ 6 tuần sau 10h30 họp', '2026-10-23 10:30');
eq('thứ 2 tuần sau 8h', '2026-10-19 08:00');
eq('hop 3h chieu nay', '2026-10-15 15:00');
eq('goi khach 2 phut nua', '2026-10-15 10:02');
eq('thu 6 10h30', '2026-10-16 10:30');
for (const s of ['tối ưu website', 'chiều dài bàn', 'kế hoạch năm nay', 'tỷ lệ 16:9', 'mua 500g thịt', 'mua 3 hộp sữa', 'phòng 302', 'iPhone 15 Pro Max 256GB']) nul(s);

/* "đêm" đứng một mình không phải giờ */
for (const s of ['đi 3 ngày 2 đêm', 'thức đêm', 'ca đêm', 'đêm qua', 'đi Đà Lạt 3 ngày 2 đêm']) nul(s);
eq('đêm nay', '2026-10-15 22:00');
eq('đêm mai', '2026-10-16 22:00');
eq('tối nay', '2026-10-15 20:00');
eq('tối mai', '2026-10-16 20:00');
eq('11h đêm', '2026-10-15 23:00');
eq('2h đêm', '2026-10-16 02:00');
eq('0h', '2026-10-16 00:00');
span('thức đêm', []);

/* leadFor: không báo trước dài hơn thời gian còn lại (BUG-025) */
t('leadFor: hạn còn 2 phút -> báo đúng giờ', () => {
  const a = P.analyze('gọi khách 2 phút nữa', NOW.getTime());
  assert.strictEqual(a.lead, 0);
  assert.strictEqual(P.analyze('gọi khách 30 phút nữa', NOW.getTime()).lead, 5 * 6e4);
  assert.strictEqual(P.analyze('họp 9h30 mai', NOW.getTime()).lead, 10 * 6e4);
  assert.ok(P.analyze('nộp báo cáo 10h30 nay', NOW.getTime()).lead >= 0);
});
t('analyze: tất định (cùng đầu vào, cùng kết quả)', () => {
  const x = P.analyze('1h30 nữa họp', NOW.getTime()), y = P.analyze('1h30 nữa họp', NOW.getTime());
  assert.deepStrictEqual(x, y);
  assert.strictEqual(x.due, NOW.getTime() + 90 * 6e4);
  assert.strictEqual(x.intent, 'meet');
});

console.log('parse2.test: ' + pass + ' đạt, ' + fail + ' hỏng (' + (pass + fail) + ' ca)');
process.exit(fail ? 1 : 0);
