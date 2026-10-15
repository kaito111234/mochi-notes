// Test understand/index.js bằng node thuần:
//   TZ=Asia/Ho_Chi_Minh node src/shared/understand/__tests__/understand.test.js
// Nhóm "cốt lõi" phải xanh (exit 1 nếu hỏng). Nhóm "phụ thuộc parse/entities" (không dấu, thực thể) chỉ báo CHỜ, không làm hỏng exit code.
const assert = require('assert');
const U = require('../index.js');

// Thứ Năm 15/10/2026 10:00 (giờ địa phương)
const NOW = new Date(2026, 9, 15, 10, 0).getTime();
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { if (ms == null) return null; const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const run = (text, now = NOW) => U.understand(text, now);
const got = text => run(text).items.map(i => [i.title, fmt(i.due)]);
const ids = ins => ins.suggestions.map(s => s.id);
const sug = (ins, id) => ins.suggestions.find(s => s.id === id);

const groups = { core: { pass: 0, fail: 0, fails: [] }, dep: { pass: 0, fail: 0, fails: [] } };
let cur = 'core';
function t(name, fn) {
  const g = groups[cur];
  try { fn(); g.pass++; } catch (e) { g.fail++; g.fails.push(name + '\n    ' + String(e.message).split('\n').join('\n    ')); }
}
/** Mỗi dòng bảng: [văn bản, [[tiêu đề, 'D/M HH:MM'], ...]] */
function table(rows) { for (const [text, exp] of rows) t(JSON.stringify(text), () => assert.deepStrictEqual(got(text), exp)); }

/* =========================== NHÓM CỐT LÕI (có dấu) =========================== */
cur = 'core';

/* ---- một việc, giờ trước/sau việc ---- */
table([
  ['Gọi khách lúc 14h', [['Gọi khách', '15/10 14:00']]],
  ['14h gọi khách', [['Gọi khách', '15/10 14:00']]],
  ['họp 15h30', [['Họp', '15/10 15:30']]],
  ['Họp nhóm 3h chiều', [['Họp nhóm', '15/10 15:00']]],
  ['mai họp 9h', [['Họp', '16/10 09:00']]],
  ['họp 9h sáng mai', [['Họp', '16/10 09:00']]],
  ['Họp lúc 9h sáng ngày mai', [['Họp', '16/10 09:00']]],
  ['thứ 6 họp 9h', [['Họp', '16/10 09:00']]],
  ['họp thứ 6 lúc 9h', [['Họp', '16/10 09:00']]],
  ['chủ nhật 8h đi chợ', [['Đi chợ', '18/10 08:00']]],
  ['tối nay 8h đi tập', [['Đi tập', '15/10 20:00']]],
  ['tối nay đi tập', [['Đi tập', '15/10 20:00']]],
  ['sáng mai gặp khách', [['Gặp khách', '16/10 08:00']]],
  ['trưa nay ăn cơm với mẹ', [['Ăn cơm với mẹ', '15/10 12:00']]],
  ['chiều mai 4h đón con', [['Đón con', '16/10 16:00']]],
  ['8h tối họp', [['Họp', '15/10 20:00']]],
  ['21h xem phim', [['Xem phim', '15/10 21:00']]],
  ['11:30 họp', [['Họp', '15/10 11:30']]],
  ['nộp báo cáo 17h30 thứ 6', [['Nộp báo cáo', '16/10 17:30']]],
  ['nhắc tớ gọi mẹ lúc 5h chiều', [['Gọi mẹ', '15/10 17:00']]],
  ['nhớ mua sữa 18h', [['Mua sữa', '15/10 18:00']]],
  ['nhắc mình uống thuốc 22h', [['Uống thuốc', '15/10 22:00']]],
  ['30 phút nữa gọi lại', [['Gọi lại', '15/10 10:30']]],
  ['2 tiếng nữa họp', [['Họp', '15/10 12:00']]],
  ['ngày 20/10 họp 15h', [['Họp', '20/10 15:00']]],
  ['20/10 lúc 15h họp', [['Họp', '20/10 15:00']]],
  ['ngày 20 tháng 10 họp 9h', [['Họp', '20/10 09:00']]],
  ['tuần sau thứ 2 họp 9h', [['Họp', '19/10 09:00']]],
  ['cuối tuần 10h đi chơi', [['Đi chơi', '17/10 10:00']]],
  ['ngày mốt 7h bay', [['Bay', '17/10 07:00']]],
  ['T7 9h cafe', [['Cafe', '17/10 09:00']]],
  ['t2 9h họp', [['Họp', '19/10 09:00']]],
  ['CN 7h30 chạy bộ', [['Chạy bộ', '18/10 07:30']]],
  ['ng mai 8h họp', [['Họp', '16/10 08:00']]],
  ['sáng t6 9h phỏng vấn', [['Phỏng vấn', '16/10 09:00']]],
  ['thứ 5 họp 9h', [['Họp', '22/10 09:00']]], // hôm nay là thứ 5 và 9h đã qua -> tuần sau
  ['9g30 sáng mai họp', [['Họp', '16/10 09:30']]],
  ['9 giờ rưỡi sáng mai họp', [['Họp', '16/10 09:30']]],
  ['họp 2 giờ chiều', [['Họp', '15/10 14:00']]],
  ['đi ngủ lúc 11 giờ đêm', [['Đi ngủ', '15/10 23:00']]],
  ['học bài 20h', [['Học bài', '15/10 20:00']]],
]);

/* ---- nhiều việc một dòng ---- */
table([
  ['họp 11h, 14h gọi khách, tối 8h đi tập', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00'], ['Đi tập', '15/10 20:00']]],
  ['11h họp; 14h gọi khách', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['họp 11h và gọi khách 14h', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['họp 11h rồi gọi khách 14h', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['11h họp xong 14h gọi khách', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['họp 11h sau đó 14h gọi khách', [['Họp', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['họp 11h, 12h, 13h', [['Họp', '15/10 11:00']]],
  ['họp 14h, mang laptop', [['Họp, mang laptop', '15/10 14:00']]],
  ['họp 11h, gọi khách', [['Họp, gọi khách', '15/10 11:00']]],
  ['mua sữa và trứng', []],
  ['11h, họp nhóm, 14h, gọi khách', [['Họp nhóm', '15/10 11:00'], ['Gọi khách', '15/10 14:00']]],
  ['mai 9h họp, 14h gọi khách', [['Họp', '16/10 09:00'], ['Gọi khách', '16/10 14:00']]],
  ['mua 1,5 kg cam lúc 17h', [['Mua 1,5 kg cam', '15/10 17:00']]],
  ['họp 11h, đi chợ 17h, nấu cơm 18h30', [['Họp', '15/10 11:00'], ['Đi chợ', '15/10 17:00'], ['Nấu cơm', '15/10 18:30']]],
]);

/* ---- ngày áp cho các mệnh đề sau trong cùng một dòng ---- */
table([
  ['Mai: 7h đón con, 10h nộp báo cáo cho chị Hoa gấp', [['Đón con', '16/10 07:00'], ['Nộp báo cáo cho chị Hoa gấp', '16/10 10:00']]],
  ['thứ 6 họp 9h, 14h gặp khách', [['Họp', '16/10 09:00'], ['Gặp khách', '16/10 14:00']]],
  ['mai 8h đi khám, 15h họp', [['Đi khám', '16/10 08:00'], ['Họp', '16/10 15:00']]],
  ['họp 11h hôm nay, mai 14h gặp khách', [['Họp', '15/10 11:00'], ['Gặp khách', '16/10 14:00']]],
  ['T6: 8h họp và 10h gọi khách', [['Họp', '16/10 08:00'], ['Gọi khách', '16/10 10:00']]],
  ['mai 8h đi khám, thứ 7 9h đá bóng, 11h tắm', [['Đi khám', '16/10 08:00'], ['Đá bóng', '17/10 09:00'], ['Tắm', '17/10 11:00']]],
  ['Mai:\n7h đón con, 10h họp\n15h gọi khách', [['Đón con', '16/10 07:00'], ['Họp', '16/10 10:00'], ['Gọi khách', '16/10 15:00']]],
  ['họp 14h, gọi khách 16h', [['Họp', '15/10 14:00'], ['Gọi khách', '15/10 16:00']]],
]);

/* ---- nhiều dòng + ngày chung ---- */
table([
  ['Mai:\nhọp 9h\n14h gọi khách', [['Họp', '16/10 09:00'], ['Gọi khách', '16/10 14:00']]],
  ['Thứ 6\nhọp 9h\nđi tập 18h', [['Họp', '16/10 09:00'], ['Đi tập', '16/10 18:00']]],
  ['T7 này\n8h cafe', [['Cafe', '17/10 08:00']]],
  ['Hôm nay\n14h họp\n16h gọi khách', [['Họp', '15/10 14:00'], ['Gọi khách', '15/10 16:00']]],
  ['Mai:\nhọp 9h\nCN:\nđi tập 18h', [['Họp', '16/10 09:00'], ['Đi tập', '18/10 18:00']]],
  ['Mai:\nhọp 9h\nthứ 7 đi chơi 8h', [['Họp', '16/10 09:00'], ['Đi chơi', '17/10 08:00']]],
  ['Việc hôm nay:\n14h họp', [['Họp', '15/10 14:00']]],
  ['Ngày mai\n9h họp', [['Họp', '16/10 09:00']]],
  ['Tuần sau:\n9h họp', [['Họp', '19/10 09:00']]],
  ['20/10\n9h họp\n15h gọi khách', [['Họp', '20/10 09:00'], ['Gọi khách', '20/10 15:00']]],
  ['Mai:\n8h họp', [['Họp', '16/10 08:00']]], // có ngày chung -> không đoán chiều
  ['Chủ nhật\n- 7h chạy bộ\n- 10h đi chợ', [['Chạy bộ', '18/10 07:00'], ['Đi chợ', '18/10 10:00']]],
  ['họp 14h\ngọi khách 15h\nđi tập 19h', [['Họp', '15/10 14:00'], ['Gọi khách', '15/10 15:00'], ['Đi tập', '15/10 19:00']]],
  ['Mai:\nmua sữa\nhọp 9h', [['Họp', '16/10 09:00']]],
  ['\n\nhọp 14h\n\ngọi khách 15h\n', [['Họp', '15/10 14:00'], ['Gọi khách', '15/10 15:00']]],
  ['họp 14h\r\ngọi khách 15h', [['Họp', '15/10 14:00'], ['Gọi khách', '15/10 15:00']]],
]);
t('ngày chung: dòng tiêu đề không thành item, line đúng', () => {
  const r = run('Thứ 6\nhọp 9h\nđi tập 18h');
  assert.deepStrictEqual(r.items.map(i => i.line), [1, 2]);
});
t('line của mệnh đề trong cùng dòng', () => {
  const r = run('ghi chú\nhọp 11h, gọi khách 14h');
  assert.deepStrictEqual(r.items.map(i => i.line), [1, 1]);
});

/* ---- lặp ---- */
t('lặp: mỗi sáng 8h uống thuốc', () => {
  const r = run('mỗi sáng 8h uống thuốc'), i = r.items[0];
  assert.strictEqual(i.title, 'Uống thuốc'); assert.strictEqual(i.repeat.freq, 'daily');
  assert.strictEqual(fmt(i.due), '16/10 08:00'); assert.strictEqual(i.time, '08:00'); assert.strictEqual(i.intent, 'pill');
});
t('lặp: uống thuốc hằng ngày 8h sáng', () => {
  const i = run('uống thuốc hằng ngày 8h sáng').items[0];
  assert.strictEqual(i.title, 'Uống thuốc'); assert.strictEqual(i.repeat.freq, 'daily'); assert.strictEqual(fmt(i.due), '16/10 08:00');
});
t('lặp: thứ 2 hàng tuần 9h họp', () => {
  const i = run('thứ 2 hàng tuần 9h họp').items[0];
  assert.strictEqual(i.title, 'Họp'); assert.strictEqual(i.repeat.freq, 'weekly'); assert.deepStrictEqual(i.repeat.byDay, [1]);
  assert.strictEqual(fmt(i.due), '19/10 09:00');
});
t('lặp: mỗi 2 tiếng uống nước (anchor = now)', () => {
  const i = run('mỗi 2 tiếng uống nước').items[0];
  assert.strictEqual(i.title, 'Uống nước'); assert.strictEqual(i.repeat.freq, 'hourly'); assert.strictEqual(i.repeat.interval, 2);
  assert.strictEqual(i.repeat.anchor, NOW); assert.strictEqual(fmt(i.due), '15/10 12:00');
});
t('lặp: mỗi tối 9h đọc sách -> hôm nay 21:00', () => {
  const i = run('mỗi tối 9h đọc sách').items[0];
  assert.strictEqual(i.title, 'Đọc sách'); assert.strictEqual(fmt(i.due), '15/10 21:00'); assert.strictEqual(i.repeat.freq, 'daily');
});
t('lặp: mỗi ngày 7h chạy bộ', () => {
  const i = run('mỗi ngày 7h chạy bộ').items[0];
  assert.strictEqual(i.title, 'Chạy bộ'); assert.strictEqual(fmt(i.due), '16/10 07:00');
});
t('lặp: ngày 5 hằng tháng 9h đóng tiền nhà', () => {
  const i = run('ngày 5 hằng tháng 9h đóng tiền nhà').items[0];
  assert.strictEqual(i.repeat.freq, 'monthly'); assert.strictEqual(i.repeat.byMonthDay, 5); assert.strictEqual(fmt(i.due), '5/11 09:00');
  assert.strictEqual(i.title, 'Đóng tiền nhà');
});
t('lặp: mỗi thứ 2, 4, 6 lúc 7h tập gym', () => {
  const r = run('mỗi thứ 2, 4, 6 lúc 7h tập gym'); assert.strictEqual(r.items.length, 1);
  const i = r.items[0];
  assert.strictEqual(i.title, 'Tập gym'); assert.deepStrictEqual(i.repeat.byDay, [1, 3, 5]); assert.strictEqual(fmt(i.due), '16/10 07:00');
});
t('lặp: hằng tuần thứ 6 17h báo cáo', () => {
  const i = run('hằng tuần thứ 6 17h báo cáo').items[0];
  assert.strictEqual(i.repeat.freq, 'weekly'); assert.deepStrictEqual(i.repeat.byDay, [5]); assert.strictEqual(fmt(i.due), '16/10 17:00'); assert.strictEqual(i.title, 'Báo cáo');
});
t('lặp không giờ ("mỗi tuần dọn nhà") không thành item', () => assert.deepStrictEqual(got('mỗi tuần dọn nhà'), []));
t('lặp có gợi ý remind với mô tả lặp', () => {
  const s = sug(run('mỗi sáng 8h uống thuốc'), 'remind:k:uong thuoc');
  assert.ok(s); assert.ok(/hằng ngày/.test(s.label), s.label);
});
t('lặp: không đặt due ở quá khứ', () => assert.ok(run('mỗi sáng 8h uống thuốc').items[0].due > NOW));
t('lặp: không lặp -> repeat null', () => assert.strictEqual(run('họp 14h').items[0].repeat, null));

/* ---- title sạch ---- */
table([
  ['- [ ] họp 15h', [['Họp', '15/10 15:00']]],
  ['• gọi khách 16h', [['Gọi khách', '15/10 16:00']]],
  ['1. mua sữa 17h', [['Mua sữa', '15/10 17:00']]],
  ['[x] họp 11h', [['Họp', '15/10 11:00']]],
  ['☐ gọi mẹ 18h', [['Gọi mẹ', '15/10 18:00']]],
  ['Họp (11h) với sếp', [['Họp với sếp', '15/10 11:00']]],
  ['Họp với sếp lúc 15h.', [['Họp với sếp', '15/10 15:00']]],
  ['HỌP 15H', [['HỌP', '15/10 15:00']]],
  ['gọi khách nhé 14h', [['Gọi khách', '15/10 14:00']]],
  ['vào lúc 14h họp', [['Họp', '15/10 14:00']]],
  ['14h: họp', [['Họp', '15/10 14:00']]],
  ['Mai - 9h - họp', [['Họp', '16/10 09:00']]],
  ['họp vào thứ 6 lúc 9h', [['Họp', '16/10 09:00']]],
  ['nhớ là gọi bác sĩ lúc 16h', [['Gọi bác sĩ', '15/10 16:00']]],
  ['nhắc tôi nộp tiền điện 16h30', [['Nộp tiền điện', '15/10 16:30']]],
  ['14h', [['Việc lúc 14:00', '15/10 14:00']]],
  ['lúc 14h', [['Việc lúc 14:00', '15/10 14:00']]],
  ['tối nay', [['Việc lúc 20:00', '15/10 20:00']]],
  ['  họp   14h   với    sếp  ', [['Họp với sếp', '15/10 14:00']]],
  ['họp ở quán Cộng 15h', [['Họp ở quán Cộng', '15/10 15:00']]],
]);
t('title dài bị cắt ≤ 80', () => {
  const r = run('họp ' + 'rất dài '.repeat(30) + '15h');
  assert.ok(r.items[0].title.length <= 80, String(r.items[0].title.length));
});
t('title viết hoa chữ đầu', () => assert.strictEqual(run('đi tập 19h').items[0].title[0], 'Đ'));
t('raw là mệnh đề gốc', () => assert.strictEqual(run('họp 11h, gọi khách 14h').items[1].raw, 'gọi khách 14h'));
t('time dạng HH:MM, timed true', () => { const i = run('họp 9h30 mai').items[0]; assert.strictEqual(i.time, '09:30'); assert.strictEqual(i.timed, true); });
t('intent/lead: họp -> meet, báo trước 10 phút', () => { const i = run('họp 15h').items[0]; assert.strictEqual(i.intent, 'meet'); assert.strictEqual(i.lead, 10 * 60000); });
t('intent: gọi -> call; mua -> buy', () => {
  assert.strictEqual(run('gọi khách 15h').items[0].intent, 'call');
  assert.strictEqual(run('mua sữa 17h').items[0].intent, 'buy');
});
t('intent theo từng mệnh đề', () => {
  const r = run('họp 11h, gọi khách 14h');
  assert.deepStrictEqual(r.items.map(i => i.intent), ['meet', 'call']);
});

/* ---- key ---- */
t('itemKey cơ bản', () => {
  assert.strictEqual(U.itemKey('Gọi khách'), 'k:goi khach');
  assert.strictEqual(U.itemKey('Đi tập'), 'k:di tap');
  assert.strictEqual(U.itemKey('Họp!!! @#'), 'k:hop');
  assert.strictEqual(U.itemKey('  Họp   nhóm  '), 'k:hop nhom');
});
t('itemKey tối đa 48 ký tự sau "k:"', () => assert.ok(U.itemKey('a'.repeat(200)).length <= 2 + 48));
t('itemKey không bao giờ ném', () => { assert.strictEqual(typeof U.itemKey(null), 'string'); assert.strictEqual(typeof U.itemKey(undefined), 'string'); });
t('key trùng thêm #2, #3', () => {
  const r = run('họp 11h, họp 14h, họp 16h');
  assert.deepStrictEqual(r.items.map(i => i.key), ['k:hop', 'k:hop#2', 'k:hop#3']);
});
t('key ổn định qua các lần gọi và đổi giờ', () => {
  assert.strictEqual(run('họp 14h').items[0].key, run('họp 15h').items[0].key);
  assert.strictEqual(run('họp 14h', NOW).items[0].key, run('họp 14h', NOW + 3600e3).items[0].key);
});
t('key khớp itemKey(title)', () => { const i = run('Gọi khách 14h').items[0]; assert.strictEqual(i.key, U.itemKey(i.title)); });

/* ---- gợi ý ---- */
t('remind: nhãn hôm nay', () => assert.strictEqual(sug(run('gọi khách 14h'), 'remind:k:goi khach').label, 'Nhắc “Gọi khách” lúc 14:00 hôm nay'));
t('remind: nhãn ngày mai', () => assert.strictEqual(sug(run('mai họp 9h'), 'remind:k:hop').label, 'Nhắc “Họp” lúc 09:00 ngày mai'));
t('remind: nhãn ngày khác', () => assert.strictEqual(sug(run('ngày 20/10 họp 15h'), 'remind:k:hop').label, 'Nhắc “Họp” lúc 15:00 T3 20/10'));
t('remind: kind, itemKey, data.due', () => {
  const s = sug(run('gọi khách 14h'), 'remind:k:goi khach');
  assert.strictEqual(s.kind, 'remind'); assert.strictEqual(s.itemKey, 'k:goi khach'); assert.strictEqual(fmt(s.data.due), '15/10 14:00');
});
t('remind-all khi ≥ 2 việc', () => {
  const r = run('họp 11h, 14h gọi khách, tối 8h đi tập');
  assert.strictEqual(sug(r, 'remind-all').label, 'Tạo nhắc cho 3 việc'); assert.strictEqual(r.suggestions.filter(s => s.kind === 'remind').length, 3);
});
t('không có remind-all khi chỉ 1 việc', () => assert.ok(!ids(run('họp 14h')).includes('remind-all')));
t('alarm cho "dậy 6h"', () => {
  const r = run('dậy 6h'), s = sug(r, 'alarm:' + r.items[0].key);
  assert.ok(s, ids(r).join()); assert.strictEqual(s.label, 'Đặt báo thức 6:00'); assert.strictEqual(s.kind, 'alarm');
  assert.strictEqual(fmt(r.items[0].due), '16/10 06:00');
});
t('alarm cho "báo thức 5h30"', () => { const r = run('báo thức 5h30'); assert.strictEqual(sug(r, 'alarm:' + r.items[0].key).label, 'Đặt báo thức 5:30'); });
t('alarm: "thức dậy lúc 5h45 sáng mai"', () => { const r = run('thức dậy lúc 5h45 sáng mai'); assert.strictEqual(sug(r, 'alarm:' + r.items[0].key).label, 'Đặt báo thức 5:45'); });
t('alarm: "mai dậy 6h" -> 16/10 06:00', () => assert.strictEqual(fmt(run('mai dậy 6h').items[0].due), '16/10 06:00'));
t('không alarm cho việc thường', () => assert.ok(!ids(run('họp 14h')).some(i => i.startsWith('alarm:'))));
t('không nhầm "dạy" (dạy học) là báo thức', () => assert.ok(!ids(run('dạy học 14h')).some(i => i.startsWith('alarm:'))));
t('checklist cho danh sách mua đồ', () => {
  const r = run('Đi chợ\nsữa\ntrứng\nrau muống');
  assert.ok(ids(r).includes('checklist')); assert.strictEqual(sug(r, 'checklist').label, 'Chuyển thành checklist'); assert.strictEqual(r.items.length, 0);
});
t('không gợi ý checklist khi đã là checklist', () => { const r = run('- [ ] sữa\n- [ ] trứng\n- [ ] rau'); assert.ok(!ids(r).includes('checklist')); assert.ok(r.checklist); });
t('không gợi ý checklist khi đa số dòng có giờ', () => assert.ok(!ids(run('họp 14h\ngọi khách 15h\nđi tập 19h')).includes('checklist')));
t('không gợi ý checklist cho 1 dòng', () => assert.ok(!ids(run('mua sữa')).includes('checklist')));
t('split khi ≥ 2 item ở các dòng khác nhau', () => {
  const r = run('11h họp\n14h gọi khách'); assert.strictEqual(sug(r, 'split').label, 'Tách thành 2 note'); assert.deepStrictEqual(sug(r, 'split').data.lines, [0, 1]);
});
t('không split khi 2 item cùng một dòng', () => assert.ok(!ids(run('họp 11h, gọi khách 14h')).includes('split')));
t('không split khi 1 item', () => assert.ok(!ids(run('họp 14h')).includes('split')));
t('id gợi ý ổn định qua các lần gọi', () => {
  const a = ids(run('11h họp\n14h gọi khách\ndậy 6h')), b = ids(run('11h họp\n14h gọi khách\ndậy 6h'));
  assert.deepStrictEqual(a, b);
});
t('id gợi ý không trùng nhau', () => { const a = ids(run('họp 11h, họp 14h, họp 16h')); assert.strictEqual(new Set(a).size, a.length); });
t('mọi gợi ý có id/kind/label chuỗi', () => {
  for (const s of run('11h họp\n14h gọi khách\ndậy 6h').suggestions) { assert.ok(s.id && s.kind && s.label); assert.ok(typeof s.label === 'string'); }
});

/* ---- mục đã qua ---- */
t('mục quá khứ vẫn là item nhưng không có remind', () => {
  const r = run('họp 8h sáng nay');
  assert.strictEqual(r.items.length, 1); assert.ok(r.items[0].due <= NOW);
  assert.ok(!ids(r).some(i => i.startsWith('remind')), ids(r).join());
});
t('quá khứ + tương lai: chỉ remind mục tương lai, không remind-all', () => {
  const r = run('8h sáng nay họp, 14h gọi khách');
  assert.strictEqual(r.items.length, 2);
  assert.deepStrictEqual(ids(r).filter(i => i.startsWith('remind')), ['remind:k:goi khach']);
});
t('quá khứ: ngày đã qua tuyệt đối', () => { const r = run('ngày 1/10/2026 họp 9h'); assert.ok(r.items.length === 1 && !ids(r).some(i => i.startsWith('remind:'))); });
t('đúng bằng now (due = now) không remind', () => { const r = run('họp 10h sáng nay'); assert.ok(!ids(r).some(i => i.startsWith('remind'))); });

/* ---- checklist ---- */
const cl = (text) => run(text).checklist;
t('checklist: gạch đầu dòng "-"', () => { const c = cl('- sữa\n- trứng\n- rau'); assert.strictEqual(c.total, 3); assert.strictEqual(c.done, 0); });
t('checklist: [x] [ ] [X]', () => { const c = cl('[x] a\n[ ] b\n[X] c'); assert.strictEqual(c.total, 3); assert.strictEqual(c.done, 2); });
t('checklist: - [ ] / - [x]', () => { const c = cl('- [ ] a\n- [x] b'); assert.deepStrictEqual(c.items.map(i => i.done), [false, true]); assert.deepStrictEqual(c.items.map(i => i.text), ['a', 'b']); });
t('checklist: ☐ ☑', () => { const c = cl('☑ họp\n☐ gọi'); assert.strictEqual(c.total, 2); assert.strictEqual(c.done, 1); });
t('checklist: ✓', () => { const c = cl('✓ xong rồi\n- chưa xong'); assert.strictEqual(c.total, 2); assert.strictEqual(c.done, 1); });
t('checklist: đánh số 1. 2)', () => { const c = cl('1. a\n2) b\n3. c'); assert.strictEqual(c.total, 3); });
t('checklist: * và + và •', () => { assert.strictEqual(cl('+ a\n* b').total, 2); assert.strictEqual(cl('• a\n• b\n• c').total, 3); });
t('checklist: 1 dòng gạch đầu dòng thường -> null', () => assert.strictEqual(cl('- mua sữa'), null));
t('checklist: 1 dòng có ô tick -> có', () => { const c = cl('[ ] mua sữa'); assert.strictEqual(c.total, 1); });
t('checklist: không có ký hiệu -> null', () => assert.strictEqual(cl('mua sữa\nmua trứng'), null));
t('checklist: lẫn dòng thường, line đúng', () => {
  const c = cl('Mua đồ\n- sữa\n- trứng'); assert.deepStrictEqual(c.items.map(i => i.line), [1, 2]);
});
t('checklist: CRLF', () => assert.strictEqual(cl('- a\r\n- b\r\n').total, 2));
t('checklist: số điện thoại/giờ không bị nhầm', () => assert.strictEqual(cl('9h họp\n0901234567'), null));
t('checklist: "-5 độ" không phải checklist', () => assert.strictEqual(cl('-5 độ\n-3 độ'), null));
t('checklist song song với items', () => {
  const r = run('- [ ] họp 14h\n- [x] mua sữa'); assert.strictEqual(r.items.length, 1); assert.strictEqual(r.checklist.done, 1);
});

/* ---- title note ---- */
t('title note: dòng đầu không rỗng', () => assert.strictEqual(run('\n\n  Họp tuần  \nabc').title, 'Họp tuần'));
t('title note: bỏ ký hiệu checklist', () => assert.strictEqual(run('- [ ] Mua sữa').title, 'Mua sữa'));
t('title note: bỏ dấu : cuối', () => assert.strictEqual(run('Mai:\nhọp 9h').title, 'Mai'));
t('title note: ≤ 80', () => assert.ok(run('x'.repeat(300)).title.length <= 80));
t('title note: không đổi khi có item', () => assert.strictEqual(run('Kế hoạch\nhọp 14h').title, 'Kế hoạch'));

/* ---- rỗng / bền vững / hiệu năng ---- */
const EMPTY_KEYS = ['version', 'title', 'items', 'checklist', 'people', 'places', 'money', 'phones', 'links', 'emails', 'tags', 'priority', 'priorityWords', 'softDeadline', 'suggestions'];
t('text rỗng -> Insight rỗng đủ khoá', () => {
  const r = run('');
  for (const k of EMPTY_KEYS) assert.ok(k in r, 'thiếu ' + k);
  assert.strictEqual(r.version, 1); assert.strictEqual(r.title, ''); assert.deepStrictEqual(r.items, []); assert.strictEqual(r.checklist, null);
  assert.deepStrictEqual(r.suggestions, []); assert.strictEqual(r.priority, 0); assert.strictEqual(r.softDeadline, null);
});
t('null/undefined/số/object không ném lỗi', () => {
  for (const v of [null, undefined, 5, {}, [], true, NaN]) { const r = U.understand(v, NOW); assert.deepStrictEqual(r.items, []); assert.strictEqual(r.title, ''); }
});
t('chỉ khoảng trắng/xuống dòng', () => { assert.deepStrictEqual(run('   \n\n \t ').items, []); assert.strictEqual(run('\n\n').title, ''); });
t('now hỏng -> dùng Date.now, không ném', () => { assert.doesNotThrow(() => U.understand('họp 14h', NaN)); assert.doesNotThrow(() => U.understand('họp 14h')); });
t('ký tự lạ/emoji/RTL không ném', () => {
  for (const s of ['😀😀 họp 14h 😀', '\u0000\u0001 họp', 'á̂ họp 14h', '‮abc 9h', '🧑‍💻 mai 9h code']) assert.doesNotThrow(() => run(s), s);
  assert.strictEqual(run('😀 họp 14h 😀').items[0].title, '😀 họp 😀'.replace('😀 họp 😀', '😀 họp 😀'));
});
t('chữ dạng NFD (tổ hợp) vẫn hiểu', () => assert.deepStrictEqual(got('mai họp 9h'.normalize('NFD')), [['Họp', '16/10 09:00']]));
t('số điện thoại không bị hiểu là giờ', () => assert.deepStrictEqual(got('gọi 0901234567'), []));
t('chuỗi toàn số', () => assert.deepStrictEqual(got('12345 67890'), []));
t('câu không có giờ -> không item', () => assert.deepStrictEqual(got('mua sữa\nmua trứng\nnhớ tưới cây'), []));
t('khối lượng "500g" không phải giờ', () => assert.deepStrictEqual(got('mua 500g thịt'), []));
t('"5 hộp" không phải giờ', () => assert.deepStrictEqual(got('mua 5 hộp sữa'), []));
t('"tôi" không phải buổi tối', () => assert.deepStrictEqual(got('nhắc tôi mua sữa'), []));
t('hiệu năng: 5.000 ký tự < 30ms', () => {
  const base = ['họp 14h với anh Nam', 'mua sữa, trứng, rau', '- [ ] gọi khách 0901 234 567', 'Mai:', 'đi tập 18h30, ăn tối 20h', 'ghi chú dài dòng không có giờ giấc gì cả'];
  let s = '';
  for (let i = 0; s.length < 5000; i++) s += base[i % base.length] + '\n';
  s = s.slice(0, 5000);
  let best = 1e9;
  for (let k = 0; k < 6; k++) { const a = process.hrtime.bigint(); U.understand(s, NOW); best = Math.min(best, Number(process.hrtime.bigint() - a) / 1e6); }
  assert.ok(best < 30, 'tốt nhất ' + best.toFixed(1) + 'ms');
});
t('hiệu năng: một dòng 5.000 ký tự không dấu cách', () => {
  const a = Date.now(); U.understand('a'.repeat(5000), NOW); assert.ok(Date.now() - a < 100);
});
t('hiệu năng: "9h," lặp 1.000 lần (không backtracking thảm hoạ)', () => {
  const a = Date.now(); const r = U.understand('9h, '.repeat(1000), NOW); assert.ok(Date.now() - a < 500, 'quá chậm'); assert.ok(r.items.length <= 100);
});
t('hiệu năng: chuỗi đối nghịch cho regex (số/khoảng trắng)', () => {
  const a = Date.now(); U.understand('1 '.repeat(2500) + 'thứ 2, 3, 4, 5, 6, 7 ' + '2,'.repeat(1000), NOW); assert.ok(Date.now() - a < 500);
});
t('giới hạn số item', () => {
  const r = run(Array.from({ length: 300 }, (_, i) => `việc ${i} lúc 14h`).join('\n'));
  assert.ok(r.items.length <= 100 && r.items.length > 0);
});
t('text quá lớn (1MB) vẫn nhanh và không ném', () => {
  const a = Date.now(); assert.doesNotThrow(() => U.understand('họp 14h\n'.repeat(150000), NOW)); assert.ok(Date.now() - a < 1500);
});
t('không biến đổi/đóng băng đầu vào, kết quả độc lập giữa các lần gọi', () => {
  const a = run('họp 14h'), b = run('họp 14h'); a.items[0].title = 'x'; assert.strictEqual(b.items[0].title, 'Họp'); assert.notStrictEqual(a.items, b.items);
});
t('items sắp theo thứ tự xuất hiện (line tăng)', () => {
  const r = run('14h họp\n15h gọi\n16h đi'); assert.deepStrictEqual(r.items.map(i => i.line), [0, 1, 2]);
});
t('một note nhiều ngày khác nhau', () => {
  assert.deepStrictEqual(got('thứ 6 họp 9h\nthứ 2 họp 10h'), [['Họp', '16/10 09:00'], ['Họp', '19/10 10:00']]);
});
t('Item đủ khoá', () => {
  const i = run('họp 14h').items[0];
  for (const k of ['key', 'line', 'raw', 'title', 'due', 'timed', 'time', 'repeat', 'intent', 'lead', 'priority']) assert.ok(k in i, 'thiếu ' + k);
  assert.ok(!('_wake' in i));
});

/* =========================== PHỤ THUỘC parse/entities =========================== */
cur = 'dep';

/* ---- không dấu / viết tắt ---- */
table([
  ['hop 9h sang mai', [['Hop', '16/10 09:00']]],
  ['goi khach 14h', [['Goi khach', '15/10 14:00']]],
  ['ng mai 8h hop', [['Hop', '16/10 08:00']]],
  ['ngmai 8h hop', [['Hop', '16/10 08:00']]],
  ['t2 9g hop', [['Hop', '19/10 09:00']]],
  ['cn 7h30 chay bo', [['Chay bo', '18/10 07:30']]],
  ['9g30 sang mai hop', [['Hop', '16/10 09:30']]],
  ['toi nay 8h di tap', [['Di tap', '15/10 20:00']]],
  ['chieu t6 3h hop', [['Hop', '16/10 15:00']]],
  ['thu 6 hop 9h', [['Hop', '16/10 09:00']]],
  ['chu nhat 8h di cho', [['Di cho', '18/10 08:00']]],
  ['nhac to goi me luc 5h chieu', [['Goi me', '15/10 17:00']]],
  ['mai 8g ra san bay', [['Ra san bay', '16/10 08:00']]],
  ['trua nay an com 12h30', [['An com', '15/10 12:30']]],
  ['hop 11h, 14h goi khach, toi 8h di tap', [['Hop', '15/10 11:00'], ['Goi khach', '15/10 14:00'], ['Di tap', '15/10 20:00']]],
  ['Mai:\nhop 9h\n14h goi khach', [['Hop', '16/10 09:00'], ['Goi khach', '16/10 14:00']]],
  ['Thu 6\nhop 9h\ndi tap 18h', [['Hop', '16/10 09:00'], ['Di tap', '16/10 18:00']]],
  ['nop bao cao 17h30 thu 6', [['Nop bao cao', '16/10 17:30']]],
  ['ngay 20/10 hop 15h', [['Hop', '20/10 15:00']]],
  ['21h xem phim', [['Xem phim', '15/10 21:00']]],
  ['30 phut nua goi lai', [['Goi lai', '15/10 10:30']]],
  ['hop 9 gio sang mai', [['Hop', '16/10 09:00']]],
  ['tuan sau thu 2 hop 9h', [['Hop', '19/10 09:00']]],
  ['mai: 8g hop', [['Hop', '16/10 08:00']]],
]);
t('không dấu: mỗi sáng 8h uống thuốc (moi sang 8h uong thuoc)', () => {
  const i = run('moi sang 8h uong thuoc').items[0]; assert.strictEqual(i.title, 'Uong thuoc'); assert.strictEqual(i.repeat.freq, 'daily'); assert.strictEqual(fmt(i.due), '16/10 08:00');
});
t('không dấu: thu 2 hang tuan 9h hop', () => { const i = run('thu 2 hang tuan 9h hop').items[0]; assert.strictEqual(i.repeat.freq, 'weekly'); assert.strictEqual(fmt(i.due), '19/10 09:00'); });
t('không dấu: alarm cho "day 6h"', () => { const r = run('day 6h'); assert.ok(sug(r, 'alarm:' + r.items[0].key), ids(r).join()); });
t('không dấu: "bao thuc 5h30"', () => { const r = run('bao thuc 5h30'); assert.strictEqual(sug(r, 'alarm:' + r.items[0].key).label, 'Đặt báo thức 5:30'); });
t('không dấu: checklist "di cho\\nsua\\ntrung\\nrau"', () => assert.ok(ids(run('di cho\nsua\ntrung\nrau')).includes('checklist')));
t('không dấu: "nhac toi mua sua" không phải buổi tối', () => assert.deepStrictEqual(got('nhac toi mua sua'), []));
t('không dấu: key giống bản có dấu', () => assert.strictEqual(run('hop 14h').items[0].key, run('họp 14h').items[0].key));
t('không dấu: intent họp nhận ra ("hop")', () => assert.strictEqual(run('hop 15h').items[0].intent, 'meet'));
t('không dấu: intent gọi nhận ra ("goi khach")', () => assert.strictEqual(run('goi khach 15h').items[0].intent, 'call'));
t('không dấu: checklist ô tick', () => assert.strictEqual(run('- [x] mua sua\n- [ ] goi me').checklist.done, 1));

/* ---- thực thể: số điện thoại, link, email, người, tiền, ưu tiên ---- */
t('call + message cho số điện thoại', () => {
  const r = run('gọi 0901 234 567 lúc 15h');
  assert.ok(ids(r).includes('call:0901234567'), ids(r).join());
  assert.strictEqual(sug(r, 'call:0901234567').label, 'Gọi 0901 234 567');
  assert.strictEqual(sug(r, 'message:0901234567').label, 'Nhắn 0901 234 567');
  assert.strictEqual(sug(r, 'call:0901234567').kind, 'call');
});
t('số điện thoại +84', () => { const r = run('liên hệ +84901234567'); assert.ok(ids(r).includes('call:0901234567'), ids(r).join()); });
t('hai số điện thoại -> 2 call', () => { const r = run('Nam 0901234567\nLan 0912345678'); assert.strictEqual(r.suggestions.filter(s => s.kind === 'call').length, 2); });
t('cùng số xuất hiện 2 lần -> 1 call', () => { const r = run('0901234567 và 0901 234 567'); assert.strictEqual(r.suggestions.filter(s => s.kind === 'call').length, 1); });
t('link -> gợi ý mở link', () => { const r = run('xem https://vnexpress.net/abc lúc 20h'); assert.ok(ids(r).includes('link:https://vnexpress.net/abc'), ids(r).join()); assert.strictEqual(r.suggestions.find(s => s.kind === 'link').kind, 'link'); });
t('email -> gợi ý gửi email', () => { const r = run('gửi báo giá cho an@congty.vn trước 17h'); assert.ok(ids(r).includes('email:an@congty.vn'), ids(r).join()); });
t('entities: people/places/money', () => {
  const r = run('họp với anh Nam ở quán Cộng 15h, trả 500k');
  assert.ok(r.people.length >= 1 && r.places.length >= 1 && r.money.length >= 1);
  assert.strictEqual(r.money[0].amount, 500000);
});
t('entities: tags', () => { const r = run('họp 14h #việc'); assert.ok(r.tags.some(x => x.tag === 'việc' || x.tag === '#việc')); });
t('priority: gấp -> 2', () => { const r = run('gấp: họp 14h'); assert.ok(r.priority >= 2); assert.ok(r.items[0].priority >= 2); });
t('priority: rất gấp -> 3', () => assert.strictEqual(run('rất gấp: nộp báo cáo 17h').priority, 3));
t('priority theo dòng, không lan sang dòng khác', () => {
  const r = run('họp 14h\ngấp gọi khách 15h'); assert.strictEqual(r.items[0].priority, 0); assert.ok(r.items[1].priority >= 2);
});
t('priority: thường = 0', () => assert.strictEqual(run('họp 14h').priority, 0));
t('softDeadline: trong tuần', () => { const r = run('hoàn thành báo cáo trong tuần'); assert.ok(r.softDeadline && Number.isFinite(r.softDeadline.due)); });
t('softDeadline: null khi không có', () => assert.strictEqual(run('họp 14h').softDeadline, null));
t('thực thể: mọi mảng luôn là mảng', () => { const r = run('họp 14h'); for (const k of ['people', 'places', 'money', 'phones', 'links', 'emails', 'tags', 'priorityWords']) assert.ok(Array.isArray(r[k]), k); });
t('thực thể không làm hỏng item: "họp với sếp 500k lúc 15h"', () => assert.strictEqual(got('họp với sếp lúc 15h')[0][1], '15/10 15:00'));

/* ---------------- tổng kết ---------------- */
const c = groups.core, d = groups.dep;
for (const f of c.fails) console.error('HỎNG (cốt lõi): ' + f);
for (const f of d.fails) console.error('CHỜ (phụ thuộc parse/entities): ' + f);
console.log(`Cốt lõi: ${c.pass} xanh, ${c.fail} hỏng | Phụ thuộc parse/entities: ${d.pass} xanh, ${d.fail} đang chờ | Tổng ${c.pass + c.fail + d.pass + d.fail} ca`);
process.exit(c.fail ? 1 : 0);
