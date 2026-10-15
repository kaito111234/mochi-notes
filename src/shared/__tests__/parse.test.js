// Test parse.js bằng node thuần: node src/shared/__tests__/parse.test.js  (chạy được với mọi TZ)
const assert = require('assert');
const P = require('../parse.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error('HỎNG: ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
const pad = n => String(n).padStart(2, '0');
// now cố định: thứ Năm 15/10/2026 10:00 (giờ địa phương)
const NOW = new Date(2026, 9, 15, 10, 0);
const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
/** -> 'YYYY-MM-DD HH:MM' + (timed ? '' : ' (ngày)') hoặc null */
const W = (text, now = NOW) => { const r = P.parseWhen(text, now); return r ? fmt(r.date) + (r.timed ? '' : ' (ngày)') : null; };
const eq = (text, exp, now) => t('"' + text + '" -> ' + exp, () => assert.strictEqual(W(text, now), exp));
const nul = (text) => t('"' + text + '" -> null', () => assert.strictEqual(W(text), null));
const span = (text, exp) => t('whenSpans "' + text + '" -> ' + JSON.stringify(exp), () =>
  assert.deepStrictEqual(P.whenSpans(text).map(([a, b]) => text.slice(a, b)), exp));
const inent = (text, k) => t('intent "' + text + '" -> ' + k, () => assert.strictEqual(P.intentOf(text).k, k));
const N = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

/* ---- fold ---- */
t('fold: bỏ dấu, đ->d, lowercase', () => assert.strictEqual(P.fold('Họp ĐỘI Sáng  Mai'), 'hop doi sang mai'));
t('fold: gộp khoảng trắng + trim', () => assert.strictEqual(P.fold('  a \t\n b  '), 'a b'));
t('fold: chuỗi rỗng/null', () => { assert.strictEqual(P.fold(''), ''); assert.strictEqual(P.fold(null), ''); });
t('fold: NFD đầu vào', () => assert.strictEqual(P.fold('Cû́'), 'cu'));

/* ---- Có dấu (hồi quy hành vi cũ) ---- */
eq('họp 9h sáng mai', '2026-10-16 09:00');
eq('gọi khách 14h30 hôm nay', '2026-10-15 14:30');
eq('họp 9 giờ sáng ngày mai', '2026-10-16 09:00');
eq('nộp báo cáo thứ 6', '2026-10-16 09:00 (ngày)');
eq('thứ sáu 15h', '2026-10-16 15:00');
eq('thứ năm 8h tối', '2026-10-15 20:00');
eq('thứ năm 8h sáng', '2026-10-22 08:00');
eq('chủ nhật 10h', '2026-10-18 10:00');
eq('thứ hai tuần sau 9h', '2026-10-19 09:00');
eq('thứ 4 tuần sau', '2026-10-21 09:00 (ngày)');
eq('tuần sau', '2026-10-19 09:00 (ngày)');
eq('tuần tới họp', '2026-10-19 09:00 (ngày)');
eq('cuối tuần đi chơi', '2026-10-17 09:00 (ngày)');
eq('cuối tháng nộp tiền nhà', '2026-10-31 09:00 (ngày)');
eq('ngày mốt 7h', '2026-10-17 07:00');
eq('ngày kia', '2026-10-17 09:00 (ngày)');
eq('mốt 16h', '2026-10-17 16:00');
eq('5/11 họp', '2026-11-05 09:00 (ngày)');
eq('3/10 họp', '2027-10-03 09:00 (ngày)');
eq('20/10/2026 8h', '2026-10-20 08:00');
eq('ngày 5 tháng 12', '2026-12-05 09:00 (ngày)');
eq('trưa nay', '2026-10-15 12:00');
eq('chiều nay', '2026-10-15 15:00');
eq('tối nay', '2026-10-15 20:00');
eq('sáng mai', '2026-10-16 08:00');
eq('chiều mai 4h', '2026-10-16 16:00');
eq('tối mai 7 giờ', '2026-10-16 19:00');
eq('5 phút nữa', '2026-10-15 10:05');
eq('2 tiếng nữa', '2026-10-15 12:00');
eq('30 giây sau', '2026-10-15 10:00');
eq('3 ngày nữa', '2026-10-18 10:00 (ngày)');
eq('1 tuần tới', '2026-10-22 10:00 (ngày)');
eq('9h', '2026-10-15 21:00');
eq('8h', '2026-10-15 20:00');
eq('15h', '2026-10-15 15:00');
eq('9h', '2026-10-16 09:00', N(2026, 10, 15, 21, 0));
eq('7h30', '2026-10-15 19:30');
eq('họp', null);
eq('', null);
eq(null, null);
t('timed: có giờ = true, chỉ ngày = false', () => {
  assert.strictEqual(P.parseWhen('họp 9h mai', NOW).timed, true);
  assert.strictEqual(P.parseWhen('họp mai', NOW).timed, false);
  assert.strictEqual(P.parseWhen('chiều nay', NOW).timed, true);
});

/* ---- Không dấu ---- */
eq('hop 9h sang mai', '2026-10-16 09:00');
eq('goi khach 14h', '2026-10-15 14:00');
eq('thu 6', '2026-10-16 09:00 (ngày)');
eq('thu 6 8h sang', '2026-10-16 08:00');
eq('chu nhat', '2026-10-18 09:00 (ngày)');
eq('chu nhat 10h', '2026-10-18 10:00');
eq('ngay mai', '2026-10-16 09:00 (ngày)');
eq('toi nay 8h', '2026-10-15 20:00');
eq('8h toi', '2026-10-15 20:00');
eq('toi mai 7h', '2026-10-16 19:00');
eq('buoi toi 9h', '2026-10-15 21:00');
eq('sang mai 8h', '2026-10-16 08:00');
eq('sang nay 11h', '2026-10-15 11:00');
eq('9h sang', '2026-10-16 09:00');
eq('trua nay', '2026-10-15 12:00');
eq('chieu mai', '2026-10-16 15:00');
eq('thu hai 9h', '2026-10-19 09:00');
eq('thu ba', '2026-10-20 09:00 (ngày)');
eq('thu bay 8h', '2026-10-17 08:00');
eq('thu nam 20h', '2026-10-15 20:00');
eq('thu tu 14h', '2026-10-21 14:00');
eq('cuoi tuan', '2026-10-17 09:00 (ngày)');
eq('tuan sau', '2026-10-19 09:00 (ngày)');
eq('ngay mot 10h', '2026-10-17 10:00');
eq('5 phut nua', '2026-10-15 10:05');
eq('2 tieng nua', '2026-10-15 12:00');
eq('sau 10 phut', '2026-10-15 10:10');
eq('hop thu 6 15h', '2026-10-16 15:00');
eq('8 gio kem 15', '2026-10-15 19:45');

/* ---- Viết tắt ---- */
eq('ng mai 8h', '2026-10-16 08:00');
eq('ngmai 8h', '2026-10-16 08:00');
eq('mai 8h', '2026-10-16 08:00');
eq('mốt', '2026-10-17 09:00 (ngày)');
eq('t2 9h', '2026-10-19 09:00');
eq('t6', '2026-10-16 09:00 (ngày)');
eq('t7 10h', '2026-10-17 10:00');
eq('cn 9h', '2026-10-18 09:00');
eq('9g', '2026-10-15 21:00');
eq('9g30', '2026-10-15 21:30');
eq('9h30', '2026-10-15 21:30');
eq('9:30', '2026-10-15 21:30');
eq('21h', '2026-10-15 21:00');
eq('21:15', '2026-10-15 21:15');
eq('8h tối', '2026-10-15 20:00');
eq('sáng mai 8h', '2026-10-16 08:00');
eq('chiều t6', '2026-10-16 15:00');
eq('tối cn', '2026-10-18 20:00');
eq('trưa nay', '2026-10-15 12:00');
eq('14h gọi khách', '2026-10-15 14:00');
eq('lúc 7 giờ 15', '2026-10-15 19:15');
eq('lúc 7 giờ 15 tối', '2026-10-15 19:15');
eq('7 rưỡi tối', '2026-10-15 19:30');
eq('7 ruoi toi', '2026-10-15 19:30');
eq('8 giờ kém 15', '2026-10-15 19:45');
eq('8h kém 15 sáng mai', '2026-10-16 07:45');
eq('9 sáng mai', '2026-10-16 09:00');
eq('3 chiều nay', '2026-10-15 15:00');
eq('1h30 chiều', '2026-10-15 13:30');
eq('1 tiếng 30 phút nữa', '2026-10-15 11:30');
eq('2 tiếng rưỡi nữa', '2026-10-15 12:30');

/* ---- Qua nửa đêm / năm mới ---- */
eq('12h đêm', '2026-10-16 00:00');
eq('đêm nay 12h', '2026-10-16 00:00');
eq('khuya nay 1h', '2026-10-16 01:00');
eq('mai 12h đêm', '2026-10-17 00:00');
eq('11h đêm', '2026-10-15 23:00');
eq('10h30 tối', '2026-10-15 22:30');
eq('1h đêm', '2026-10-16 01:00');
eq('1h đêm', '2026-10-15 01:00', N(2026, 10, 15, 0, 30));
eq('30 phút nữa', '2026-10-16 00:10', N(2026, 10, 15, 23, 40));
eq('8h sáng', '2026-10-16 08:00', N(2026, 10, 15, 23, 59));
eq('5/1 họp', '2027-01-05 09:00 (ngày)', N(2026, 12, 31, 23, 0));
eq('mai 9h', '2027-01-01 09:00', N(2026, 12, 31, 23, 0));
eq('t6 9h', '2026-10-23 09:00', N(2026, 10, 16, 10, 0));
eq('cuối tháng', '2026-12-31 09:00 (ngày)', N(2026, 12, 5, 10, 0));
eq('24h', '2026-10-16 00:00');

/* ---- Không được nhận nhầm ---- */
nul('mua 500k');
nul('trả 1tr2 tiền nhà');
nul('gọi 0901234567');
nul('số 090 123 4567');
nul('phòng 302');
nul('mua 2 cái');
nul('xem #1');
nul('cân nặng 500g');
nul('chạy 3.5g');
nul('mạng 5G');
nul('tối ưu code');
nul('chiều dài 3m');
nul('tôi đi sang nhà bạn');
nul('toi di sang nha ban');
nul('toi di cho');
nul('mái nhà dột');
nul('gửi thư cho Nam');
nul('sáng tạo');
nul('thứ tự ưu tiên');
nul('30h');
nul('giá 2.000.000đ');
nul('hộp 5 cái');
eq('5/11', '2026-11-05 09:00 (ngày)');
eq('0901234567 họp 9h mai', '2026-10-16 09:00');
eq('mua 500k họp 9h mai', '2026-10-16 09:00');
eq('phòng 302 họp 9h mai', '2026-10-16 09:00');
eq('gặp chị Mai 9h30 t6', '2026-10-16 09:30');
eq('gặp cô Mai', null);
eq('hoa mai nở', null);
eq('gọi anh Nam thứ 5 9h', '2026-10-22 09:00');
eq('thu Nam 9h', '2026-10-15 21:00');
eq('nộp thu 6 nay', '2026-10-16 09:00 (ngày)');
eq('tuần này 9h', '2026-10-15 21:00');
t('"toi" chỉ là buổi tối khi kèm giờ/ngày', () => {
  assert.strictEqual(W('toi 8h'), '2026-10-15 20:00');
  assert.strictEqual(W('toi nay'), '2026-10-15 20:00');
  assert.strictEqual(W('toi goi khach'), null);
});
t('"sang" chỉ là buổi sáng khi kèm giờ/ngày', () => {
  assert.strictEqual(W('sang 9h'), '2026-10-16 09:00');
  assert.strictEqual(W('sang nay'), '2026-10-15 08:00');
  assert.strictEqual(W('sang nha 9h'), '2026-10-15 21:00');
});

/* ---- intentOf ---- */
inent('họp 9h', 'meet');
inent('hop 9h sang mai', 'meet');
inent('goi khach 14h', 'call');
inent('14h gọi khách', 'call');
inent('uong thuoc 8h', 'pill');
inent('nộp báo cáo', 'due');
inent('mua sữa', 'buy');
inent('chuyen khoan tien nha', 'pay');
inent('hôm nay trời đẹp', 'task');
inent('đón con 5h', 'go');
inent('việc gấp', 'task');
t('intentOf: câu có dấu "gấp" không thành "gặp"', () => assert.notStrictEqual(P.intentOf('làm gấp').k, 'meet'));
t('analyze: vẫn đúng với câu có dấu', () => {
  const a = P.analyze('họp 9h sáng mai', NOW.getTime());
  assert.strictEqual(a.intent, 'meet');
  assert.strictEqual(a.due, new Date(2026, 9, 16, 9, 0).getTime());
  assert.strictEqual(a.timed, true);
  assert.strictEqual(a.lead, 10 * 6e4);
});
t('analyze: không dấu', () => {
  const a = P.analyze('goi khach 14h', NOW.getTime());
  assert.strictEqual(a.intent, 'call');
  assert.strictEqual(a.due, new Date(2026, 9, 15, 14, 0).getTime());
});
t('analyze: không có giờ -> due null', () => assert.strictEqual(P.analyze('mua sữa', NOW.getTime()).due, null));
t('hm / dur / leadLabel còn nguyên', () => {
  assert.strictEqual(P.hm(new Date(2026, 9, 15, 7, 5).getTime()), '07:05');
  assert.strictEqual(P.dur(5 * 6e4), '5 phút');
  assert.strictEqual(P.leadLabel(0), 'báo đúng giờ');
  assert.strictEqual(P.intentLabel('call'), 'Gọi điện');
});

/* ---- whenSpans ---- */
span('họp 9h sáng mai', ['9h sáng mai']);
span('hop 9h sang mai', ['9h sang mai']);
span('họp lúc 9h sáng mai', ['lúc 9h sáng mai']);
span('họp vào lúc 9h', ['vào lúc 9h']);
span('họp vào 9h30', ['vào 9h30']);
span('14h gọi khách', ['14h']);
span('gọi khách lúc 14h', ['lúc 14h']);
span('nhắc 5 phút nữa uống nước', ['5 phút nữa']);
span('sau 10 phút gọi lại', ['sau 10 phút']);
span('nộp 5/11 nhé', ['5/11']);
span('họp ngày 5/11 lúc 9h', ['ngày 5/11 lúc 9h']);
span('đi chơi thứ 6 tuần sau', ['thứ 6 tuần sau']);
span('tối nay 8h ăn cơm', ['tối nay 8h']);
span('chiều t6 họp', ['chiều t6']);
span('họp mai', ['mai']);
span('họp ng mai', ['ng mai']);
span('họp 9h-10h', ['9h-10h']);
span('mua 500k gạo', []);
span('gọi 0901234567', []);
span('tôi đi sang nhà bạn', []);
span('họp 9h; gọi khách 14h', ['9h', '14h']);
span('7 giờ kém 15 tối', ['7 giờ kém 15 tối']);
span('buổi sáng mai 8h họp', ['buổi sáng mai 8h']);
t('whenSpans: chỉ số theo chuỗi gốc (NFD)', () => {
  const s = 'họp 9h sáng mai'.normalize('NFD');
  const r = P.whenSpans(s);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(s.slice(r[0][0], r[0][1]), '9h sáng mai');
});
t('whenSpans: chỉ số theo chuỗi gốc (viết hoa, emoji)', () => {
  const s = '🎉 HỌP 9H SÁNG MAI';
  const r = P.whenSpans(s);
  assert.strictEqual(s.slice(r[0][0], r[0][1]), '9H SÁNG MAI');
});
t('whenSpans: bỏ khỏi tiêu đề', () => {
  const s = 'họp 9h sáng mai';
  const [a, b] = P.whenSpans(s)[0];
  assert.strictEqual((s.slice(0, a) + s.slice(b)).trim(), 'họp');
});
t('API xuất đủ', () => { for (const k of ['fold', 'whenSpans', 'parseWhen', 'analyze', 'intentOf', 'intentLabel', 'leadFor', 'whenLabel', 'dur', 'leadLabel', 'hm', 'MIN', 'HOUR', 'DAY']) assert.ok(P[k] !== undefined, k); });

console.log('parse.test: ' + pass + ' đạt, ' + fail + ' hỏng (' + (pass + fail) + ' ca)');
process.exit(fail ? 1 : 0);
