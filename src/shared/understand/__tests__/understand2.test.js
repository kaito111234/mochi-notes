// Test bổ sung understand (Đợt 2b): số bằng chữ, 9.30, khoảng thời gian, nửa đêm, mai mốt, phân số, thứ N tuần sau.
// node src/shared/understand/__tests__/understand2.test.js  (đúng với mọi TZ)
const assert = require('assert');
const U = require('../index.js');
const E = require('../entities.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error('HỎNG: ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
const pad = n => String(n).padStart(2, '0');
const NOW = new Date(2026, 9, 15, 10, 0).getTime(); // Thứ Năm 15/10/2026 10:00
const fmt = ms => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const got = text => U.understand(text, NOW).items.map(i => [i.title, fmt(i.due)]);
const eq = (text, exp) => t('"' + text + '" -> ' + JSON.stringify(exp), () => assert.deepStrictEqual(got(text), exp));

eq('họp mười giờ rưỡi', [['Họp', '15/10 10:30']]);
eq('hai giờ chiều gọi khách', [['Gọi khách', '15/10 14:00']]);
eq('ba giờ mười lăm chiều họp', [['Họp', '15/10 15:15']]);
eq('chín giờ sáng mai nộp bài', [['Nộp bài', '16/10 09:00']]);
eq('họp 9.30 sáng', [['Họp', '16/10 09:30']]);
eq('họp lúc 9.30 mai', [['Họp', '16/10 09:30']]);
eq('gọi khách trong 5 phút', [['Gọi khách', '15/10 10:05']]);
eq('gọi 5 phút sau', [['Gọi', '15/10 10:05']]);
eq('nửa tiếng nữa họp', [['Họp', '15/10 10:30']]);
eq('1h30 nữa họp', [['Họp', '15/10 11:30']]);
eq('20-10 9h họp', [['Họp', '20/10 09:00']]);
eq('nửa đêm gọi mẹ', [['Gọi mẹ', '16/10 00:00']]);
eq('họp thứ 6 tuần sau 10h30', [['Họp', '23/10 10:30']]);
eq('3 ngày nữa 9h họp', [['Họp', '18/10 09:00']]);
eq('5/11 họp 9h', [['Họp', '5/11 09:00']]);
// không phải giờ -> không có item
for (const s of ['mua 1.5kg thịt', 'tổng 2.000.000đ', 'đọc 3/4 cuốn sách', 'chia 1/2 cái bánh', '30/2 họp 9h', '13/13 9h', 'tỷ lệ 16:9', 'mai mốt đi khám', 'mai mốt 9h đi khám',
  'ngày 20 nộp tiền nhà', 'mua 500g thịt', 'giá 50-60k', 'Version 3.10', 'tối ưu website']) {
  t('không item: "' + s + '"', () => assert.deepStrictEqual(got(s), []));
}
t('mai mốt -> hạn mềm vài ngày tới, không phải giờ', () => {
  const r = U.understand('mai mốt đi khám răng', NOW);
  assert.ok(r.softDeadline && r.softDeadline.label === 'Mai mốt');
  assert.ok(r.softDeadline.due > NOW && r.softDeadline.due <= NOW + 4 * 864e5);
  assert.deepStrictEqual(r.items, []);
  assert.ok(!r.suggestions.some(s => s.kind === 'remind'));
  assert.strictEqual(E.extractEntities('mai mot di kham', NOW).softDeadline.label, 'Mai mốt');
});
t('"mai" thường vẫn hiểu', () => assert.deepStrictEqual(got('mai 9h họp'), [['Họp', '16/10 09:00']]));
t('tiêu đề note không bị đổi số chữ thành số', () => assert.strictEqual(U.understand('Hai giờ chiều họp nhóm', NOW).title, 'Hai giờ chiều họp nhóm'));
t('tất định: hai lần gọi giống nhau', () => assert.deepStrictEqual(U.understand('nửa tiếng nữa họp\n9.30 sáng mai gọi', NOW), U.understand('nửa tiếng nữa họp\n9.30 sáng mai gọi', NOW)));

for (const x of ['đi 3 ngày 2 đêm', 'thức đêm code', 'ca đêm', 'đêm qua nằm mơ']) eq(x, []);
eq('đêm nay xem phim', [['Xem phim', '15/10 22:00']]);
eq('đêm mai gọi mẹ', [['Gọi mẹ', '16/10 22:00']]);
eq('11h đêm đi ngủ', [['Đi ngủ', '15/10 23:00']]);
eq('0h họp', [['Họp', '16/10 00:00']]);
eq('0h', [['Việc lúc 00:00', '16/10 00:00']]);

console.log('understand2.test: ' + pass + ' đạt, ' + fail + ' hỏng (' + (pass + fail) + ' ca)');
process.exit(fail ? 1 : 0);
