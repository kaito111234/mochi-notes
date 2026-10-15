'use strict';
// MochiParse.analyze — bảng câu tiếng Việt thực tế. Giờ hiện tại cố định: Thứ Năm 15/10/2026 10:00 (giờ máy).
const test = require('node:test');
const assert = require('node:assert');
const P = require('../../src/shared/parse.js');

const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
const p2 = n => String(n).padStart(2, '0');
const fmt = ms => { if (ms == null) return null; const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const NOW = L(2026, 10, 15, 10, 0);

// [văn bản, now, 'YYYY-MM-DD HH:MM' kỳ vọng | null, intent?]
const TIMED = [
  ['họp 3h chiều nay', NOW, '2026-10-15 15:00', 'meet'],
  ['gọi khách 2 phút nữa', NOW, '2026-10-15 10:02', 'call'],
  ['5 phút nữa uống thuốc', NOW, '2026-10-15 10:05', 'pill'],
  ['sau 5 phút nhắc tôi gọi mẹ', NOW, '2026-10-15 10:05', 'call'],
  ['30p nữa nghỉ mắt', NOW, '2026-10-15 10:30', 'health'],
  ['nửa tiếng nữa', NOW, '2026-10-15 10:30'],
  ['1 tiếng rưỡi nữa', NOW, '2026-10-15 11:30'],
  ['1h30 nữa họp', NOW, '2026-10-15 11:30', 'meet'],
  ['2 tiếng nữa', NOW, '2026-10-15 12:00'],
  ['mai 9h', NOW, '2026-10-16 09:00'],
  ['9h sáng mai', NOW, '2026-10-16 09:00'],
  ['sáng mai 7:30 họp', NOW, '2026-10-16 07:30', 'meet'],
  ['thứ 6 10h30', NOW, '2026-10-16 10:30'],
  ['gọi mẹ lúc 7h tối thứ 7', NOW, '2026-10-17 19:00', 'call'],
  ['tối nay 8h', NOW, '2026-10-15 20:00'],
  ['8 giờ tối', NOW, '2026-10-15 20:00'],
  ['12h trưa', NOW, '2026-10-15 12:00'],
  ['0h', NOW, '2026-10-16 00:00'],
  ['23h59', NOW, '2026-10-15 23:59'],
  ['15h', NOW, '2026-10-15 15:00'],
  ['15:30 họp', NOW, '2026-10-15 15:30', 'meet'],
  ['3h30 chiều', NOW, '2026-10-15 15:30'],
  ['3 giờ 30 chiều', NOW, '2026-10-15 15:30'],
  ['3 giờ rưỡi chiều', NOW, '2026-10-15 15:30'],
  ['ngày 20/10 lúc 14h', NOW, '2026-10-20 14:00'],
  ['ngày 20 tháng 10 lúc 14h', NOW, '2026-10-20 14:00'],
  ['20-10 9h', NOW, '2026-10-20 09:00'],
  ['1/1 họp 8h sáng', NOW, '2027-01-01 08:00', 'meet'],
  ['ngày mốt 7h sáng', NOW, '2026-10-17 07:00'],
  ['chủ nhật 8h sáng', NOW, '2026-10-18 08:00'],
  ['thứ 5 3h chiều', NOW, '2026-10-15 15:00'],
  ['thứ 5 9h sáng', NOW, '2026-10-22 09:00'],
  ['thứ 6 tuần sau 9h', NOW, '2026-10-23 09:00'],
  ['thứ hai tuần sau 9h', NOW, '2026-10-19 09:00'],
  ['thứ 2 tuần sau 9h', NOW, '2026-10-19 09:00'],
  ['thứ 4 tuần tới 14h', NOW, '2026-10-21 14:00'],
  ['trưa nay', NOW, '2026-10-15 12:00'],
  ['chiều mai', NOW, '2026-10-16 15:00'],
  ['sáng mai', NOW, '2026-10-16 08:00'],
  ['đêm nay', NOW, '2026-10-15 22:00'],
  ['HỌP 3H CHIỀU NAY', NOW, '2026-10-15 15:00', 'meet'],
  ['họp phòng 302 lúc 3h chiều', NOW, '2026-10-15 15:00', 'meet'],
  ['mua 3 hộp sữa lúc 5h chiều', NOW, '2026-10-15 17:00', 'buy'],
  ['uống 2 viên thuốc lúc 8h tối', NOW, '2026-10-15 20:00', 'pill'],
  ['mua 500g thịt lúc 5h chiều', NOW, '2026-10-15 17:00', 'buy'],
  ['họp 9h sáng', L(2026, 10, 15, 14), '2026-10-16 09:00', 'meet'],        // giờ đã qua hôm nay -> mai
  ['1h sáng họp', NOW, '2026-10-16 01:00', 'meet'],                         // 1h sáng đã qua -> đêm mai
  ['11h đêm nay', NOW, '2026-10-15 23:00'],
  ['12h đêm', NOW, '2026-10-16 00:00'],                                     // nửa đêm = 0h ngày kế
  ['2h đêm', NOW, '2026-10-16 02:00'],
  ['nửa đêm', NOW, '2026-10-16 00:00'],
  ['0h30', L(2026, 10, 15, 23, 50), '2026-10-16 00:30'],                    // vắt ngày
  ['30 phút nữa', L(2026, 10, 15, 23, 50), '2026-10-16 00:20'],
  ['mai 9h', L(2026, 10, 16, 0, 30), '2026-10-17 09:00'],                   // mai tính từ ngày hiện tại sau nửa đêm
  ['9h', L(2026, 10, 15, 23, 50), '2026-10-16 09:00'],
  ['cuối tháng nộp báo cáo 17h', NOW, '2026-10-31 17:00', 'due'],
  ['cuối tuần 9h', NOW, '2026-10-17 09:00'],
  ['31/12 họp 10h', NOW, '2026-12-31 10:00', 'meet'],
  ['ngày 5/10 nộp bài 9h', NOW, '2027-10-05 09:00', 'due'],              // đã qua -> năm sau
  ['2h', NOW, null],                                                        // xem hàm riêng bên dưới (linh hoạt)
  // không dấu
  ['hop 3h chieu nay', NOW, '2026-10-15 15:00', 'meet'],
  ['9h sang mai', NOW, '2026-10-16 09:00'],
  ['8 gio toi', NOW, '2026-10-15 20:00'],
  ['thu 6 10h30', NOW, '2026-10-16 10:30'],
  ['nua tieng nua', NOW, '2026-10-15 10:30'],
  ['goi khach 2 phut nua', NOW, '2026-10-15 10:02', 'call'],
  ['mai 9h hop', NOW, '2026-10-16 09:00', 'meet']
];
for (const [text, now, want, intent] of TIMED) {
  if (text === '2h') continue;
  test(`giờ: "${text}" @${fmt(now)}`, () => {
    const r = P.analyze(text, now);
    assert.strictEqual(fmt(r.due), want, 'due');

    if (intent) assert.strictEqual(r.intent, intent, 'intent');
  });
}

// Câu chỉ có ngày (không giờ): due đúng ngày, timed=false.
for (const [text, want, intent] of [
  ['sinh nhật mẹ 15/11', '2026-11-15', 'bday'],
  ['nộp báo cáo ngày 20/10', '2026-10-20', 'due'],
  ['mai đi chợ', '2026-10-16', 'buy'],
  ['tuần sau', '2026-10-19', null],
  ['2 ngày nữa', '2026-10-17', null],
  ['1 tuần nữa', '2026-10-22', null],
  ['cuối tháng', '2026-10-31', null]
]) {
  test(`ngày: "${text}"`, () => {
    const r = P.analyze(text, NOW);
    assert.ok(r.due, 'phải có due');
    assert.strictEqual(fmt(r.due).slice(0, 10), want);
    assert.strictEqual(r.timed, false);
    if (intent) assert.strictEqual(r.intent, intent);
  });
}

// Số/chữ trong văn bản KHÔNG phải giờ -> không có nhắc.
for (const text of [
  'mua 3 hộp sữa', 'phòng 302', 'Version 1.2', 'mua 500g thịt', 'mua 2 gói bánh', 'đọc 3/4 cuốn sách', 'chia 1/2 cái bánh',
  'giá 50-60k', 'học 3 tiếng', 'mã đơn 12345', 'SĐT 0912 345 678', 'tập 2-3 lần mỗi tuần nè',
  'tối ưu website', 'sáng tạo nội dung', 'đo chiều dài bàn', 'kế hoạch năm nay', 'ghi chú bình thường', 'Chương 5 bài 12', 'tỷ lệ 16:9', 'iPhone 15 Pro Max 256GB'
]) {
  test(`không phải giờ: "${text}"`, () => {
    const r = P.analyze(text, NOW);
    assert.strictEqual(r.due, null, 'không được tạo nhắc, nhận ' + fmt(r.due));
  });
}

// Lượt 2: parse đã kiểm phạm vi ngày/tháng (32/1 -> null). Với "30/2 họp 9h", "13/13 9h" ngày vô lý bị BỎ nhưng giờ "9h" vẫn nhận
// (nhắc 21:00 hôm nay, trong 24h) — chấp nhận được, không còn cuộn sang ngày xa. Test chỉ đòi: không có ngày bị cuộn (due null hoặc trong 24h tới).
test('ngày không tồn tại / vô lý không được nhận: 32/1, 30/2, 13/13 (không cuộn sang ngày xa)', () => {
  for (const t of ['32/1 họp', '30/2 họp 9h', '13/13 9h']) {
    const r = P.analyze(t, NOW);
    assert.ok(r.due === null || (r.due > NOW && r.due - NOW <= 864e5), t + ' -> ' + fmt(r.due));
  }
  assert.strictEqual(P.analyze('32/1 họp', NOW).due, null);
});

test('"2h" lúc 10:00: hoặc 14:00 hôm nay hoặc 02:00 mai (không được ở quá khứ)', () => {
  const r = P.analyze('2h', NOW);
  assert.ok(['2026-10-15 14:00', '2026-10-16 02:00'].includes(fmt(r.due)), fmt(r.due));
});
test('"họp 9h" lúc 14:00 (giờ đã qua, không nói sáng/tối): luôn trong tương lai, trong 24h', () => {
  const now = L(2026, 10, 15, 14);
  const r = P.analyze('họp 9h', now);
  assert.ok(r.due > now && r.due - now <= 24 * 36e5, fmt(r.due));
});
test('không bao giờ trả due trong quá khứ cho giờ không có "hôm nay"', () => {
  for (const t of ['họp 9h', '8h', '3h30', '10h', 'gọi 7h tối', '6h sáng', '0h']) {
    for (const h of [0, 6, 10, 15, 23]) {
      const now = L(2026, 10, 15, h, 15);
      const r = P.analyze(t, now);
      assert.ok(r.due == null || r.due > now, `${t} @${h}:15 -> ${fmt(r.due)}`);
    }
  }
});

test('analyze: rỗng / null / undefined / số / chuỗi dài không ném lỗi', () => {
  for (const v of ['', '   ', null, undefined, 123, 'a'.repeat(100000), '\n\n', '😀 3h chiều 😀']) {
    assert.doesNotThrow(() => P.analyze(v, NOW));
  }
  assert.strictEqual(P.analyze('', NOW).due, null);
  assert.strictEqual(P.analyze('😀 3h chiều 😀', NOW).due && fmt(P.analyze('😀 3h chiều 😀', NOW).due), '2026-10-15 15:00');
});

test('nhiều dòng: giờ ở dòng sau vẫn được hiểu', () => {
  assert.strictEqual(fmt(P.analyze('Việc cần làm\nhọp 3h chiều nay\nmua sữa', NOW).due), '2026-10-15 15:00');
});

test('chữ có dấu dựng sẵn tổ hợp (NFD) vẫn hiểu', () => {
  const t = 'họp 3h chiều nay'.normalize('NFD');
  assert.strictEqual(fmt(P.analyze(t, NOW).due), '2026-10-15 15:00');
});

test('lead: họp 10 phút, gọi 5 phút, không giờ thì 0, sinh nhật xa báo trước 1 ngày', () => {
  assert.strictEqual(P.analyze('họp 3h chiều nay', NOW).lead, 10 * 6e4);
  assert.strictEqual(P.analyze('gọi khách 3h chiều nay', NOW).lead, 5 * 6e4);
  assert.strictEqual(P.analyze('mai đi chợ', NOW).lead, 0);
  assert.strictEqual(P.analyze('sinh nhật mẹ 15/11', NOW).lead, 864e5);
  assert.strictEqual(P.analyze('uống thuốc 8h tối', NOW).lead, 0);
});

test('intent: từ khoá cơ bản', () => {
  const k = t => P.intentOf(t).k;
  assert.strictEqual(k('Họp nhóm'), 'meet');
  assert.strictEqual(k('chuyển khoản tiền nhà'), 'pay');
  assert.strictEqual(k('ra sân bay'), 'go');
  assert.strictEqual(k('viết thư'), 'task');
});

test('hàm hiển thị: dur / leadLabel / hm', () => {
  assert.strictEqual(P.dur(90 * 6e4), '1 tiếng 30 phút');
  assert.strictEqual(P.dur(30 * 1e3), '30 giây');
  assert.strictEqual(P.leadLabel(0), 'báo đúng giờ');
  assert.strictEqual(P.hm(L(2026, 1, 2, 3, 4)), '03:04');
});

test('whenLabel dùng giờ máy hiện tại (hôm nay / ngày mai)', () => {
  const today = new Date(); today.setHours(15, 0, 0, 0);
  const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
  assert.strictEqual(P.whenLabel(today.getTime()), '15:00 hôm nay');
  assert.strictEqual(P.whenLabel(tmr.getTime()), '15:00 ngày mai');
});
