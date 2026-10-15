'use strict';
// QA lượt 2 — src/shared/understand (index.js + entities.js): nhiều việc/dòng, ngày chung, checklist, thực thể, gợi ý, đầu vào rác, câu thường.
// Đặc tả: docs/rooms/notes/API2.md mục 2. Giờ giả: Thứ Năm 15/10/2026 06:00 (giờ máy) để "9h" không bị đẩy sang tối.
const test = require('node:test');
const assert = require('node:assert');
const U = require('../../src/shared/understand/index.js');
const E = require('../../src/shared/understand/entities.js');

const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
const p2 = n => String(n).padStart(2, '0');
const fmt = ms => { if (ms == null) return null; const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const NOW = L(2026, 10, 15, 6, 0);
const U0 = t => U.understand(t, NOW);
const sig = r => r.items.map(i => `${i.line}|${i.title}|${fmt(i.due)}`);

test('API có đủ hàm', () => {
  assert.strictEqual(typeof U.understand, 'function');
  assert.strictEqual(typeof U.itemKey, 'function');
});

test('hình dạng Insight: version 1, mảng rỗng khi câu trống', () => {
  const r = U0('');
  assert.strictEqual(r.version, 1);
  for (const k of ['items', 'suggestions', 'people', 'places', 'money', 'phones', 'links', 'emails', 'tags']) assert.ok(Array.isArray(r[k]), k);
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.checklist, null);
  assert.strictEqual(r.priority, 0);
});

/* ---------- nhiều việc ---------- */
test('một dòng nhiều giờ: "họp 9h, 14h gọi khách, tối 8h đi tập" -> 3 mục, đúng giờ/tiêu đề/intent', () => {
  const r = U0('họp 9h, 14h gọi khách, tối 8h đi tập');
  assert.deepStrictEqual(sig(r), ['0|Họp|2026-10-15 09:00', '0|Gọi khách|2026-10-15 14:00', '0|Đi tập|2026-10-15 20:00']);
  assert.strictEqual(r.items[0].intent, 'meet');
  assert.strictEqual(r.items[1].intent, 'call');
  assert.ok(r.items.every(i => i.timed && /^\d\d:\d\d$/.test(i.time)));
});

test('nhiều dòng: mỗi dòng có giờ một mục, dòng không giờ bị bỏ; key duy nhất', () => {
  const r = U0('họp 9h\nmua sữa\n14h gọi khách\nhọp 15h');
  assert.deepStrictEqual(r.items.map(i => i.line), [0, 2, 3]);
  const keys = r.items.map(i => i.key);
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.ok(keys.every(k => k.startsWith('k:')));
});

test('hai việc trùng tên -> key thêm #2', () => {
  const r = U0('họp 9h\nhọp 15h');
  assert.strictEqual(r.items.length, 2);
  assert.notStrictEqual(r.items[0].key, r.items[1].key);
  assert.ok(/#2$/.test(r.items[1].key), r.items[1].key);
});

test('key ổn định giữa các lần gọi (cùng chữ -> cùng key; gõ thêm dòng khác không đổi key cũ)', () => {
  const a = U0('họp 9h');
  const b = U0('họp 9h\nmua sữa thêm');
  assert.strictEqual(a.items[0].key, b.items[0].key);
  assert.strictEqual(U.itemKey('Gọi khách'), U.itemKey('gọi khách'));
});

/* ---------- ngày chung ---------- */
test('"Mai:" áp cho các dòng bên dưới chưa có ngày riêng, không áp cho dòng không giờ', () => {
  const r = U0('Mai:\nhọp 9h\n14h gọi khách\nmua sữa');
  assert.deepStrictEqual(sig(r), ['1|Họp|2026-10-16 09:00', '2|Gọi khách|2026-10-16 14:00']);
});

test('ngày chung bị thay bởi ngày riêng của dòng ("thứ 6" chung, dòng có "ngày 20/10")', () => {
  const r = U0('Thứ 6:\nhọp 9h\nnộp báo cáo ngày 20/10 lúc 14h');
  assert.strictEqual(fmt(r.items[0].due), '2026-10-16 09:00');
  assert.strictEqual(fmt(r.items[1].due), '2026-10-20 14:00');
});

/* ---------- checklist ---------- */
test('checklist: "- [ ]", "[x]", "-" -> total/done; dòng giờ trong checklist vẫn thành mục', () => {
  const r = U0('- [ ] mua sữa\n- [x] gọi mẹ\n- [ ] trả tiền');
  assert.deepStrictEqual([r.checklist.done, r.checklist.total], [1, 3]);
  assert.deepStrictEqual(r.checklist.items.map(i => i.done), [false, true, false]);
  const r2 = U0('- họp 9h\n- mua sữa');
  assert.strictEqual(r2.checklist.total, 2);
  assert.strictEqual(r2.items.length, 1);
  assert.strictEqual(fmt(r2.items[0].due), '2026-10-15 09:00');
});

test('checklist: nhiều kiểu ký hiệu (1. / 1) / • / ☐ / ☑)', () => {
  for (const t of ['1. a\n2. b', '1) a\n2) b', '• a\n• b', '☐ a\n☑ b', '* a\n* b', '+ a\n+ b']) {
    const r = U0(t);
    assert.ok(r.checklist, JSON.stringify(t));
    assert.strictEqual(r.checklist.total, 2, JSON.stringify(t));
  }
  assert.strictEqual(U0('☐ a\n☑ b').checklist.done, 1);
});

test('danh sách mua đồ (≥2 dòng, không ký hiệu, không giờ) -> gợi ý "checklist"', () => {
  const r = U0('mua sữa\nmua trứng\nmua bánh');
  assert.ok(r.suggestions.some(s => s.id === 'checklist'));
  assert.strictEqual(r.checklist, null);
});

/* ---------- thực thể ---------- */
test('SĐT: nhiều kiểu viết -> số chuẩn + gợi ý call/message', () => {
  const r = U0('gọi anh Nam 0901 234 567');
  assert.strictEqual(r.phones.length, 1);
  assert.strictEqual(r.phones[0].number, '0901234567');
  const ids = r.suggestions.map(s => s.id);
  assert.ok(ids.includes('call:0901234567') && ids.includes('message:0901234567'), ids.join());
  assert.strictEqual(U0('liên hệ 0901.234.567').phones[0].number, '0901234567');
  assert.strictEqual(U0('sđt 0912345678').phones.length, 1);
});

test('số thường KHÔNG thành SĐT: mã đơn, ngày, giá', () => {
  for (const t of ['mã đơn 12345', 'phòng 302', 'năm 2026', 'mua 500g thịt', 'điểm 8/10']) assert.strictEqual(U0(t).phones.length, 0, t);
});

test('tiền: 500k, 1tr2, 2.000.000đ, 50k', () => {
  const m = U0('đưa 500k, 1tr2, 2.000.000đ').money.map(x => x.amount);
  assert.deepStrictEqual(m, [500000, 1200000, 2000000]);
  assert.strictEqual(U0('giá 50k').money[0].amount, 50000);
});

test('"500g" / "16:9" / "8/10" không phải tiền', () => {
  for (const t of ['mua 500g thịt', 'tỉ lệ 16:9', 'điểm 8/10', 'phòng 302']) assert.strictEqual(U0(t).money.length, 0, t);
});

test('link / email / #thẻ / người / nơi', () => {
  const r = U0('anh Nam gửi https://joiha.com và a@b.com #việc ở quán cafe');
  assert.strictEqual(r.links[0].url, 'https://joiha.com');
  assert.strictEqual(r.emails[0].email, 'a@b.com');
  assert.strictEqual(r.tags[0].tag, 'việc');
  assert.strictEqual(r.people[0].name, 'Nam');
  assert.ok(/quán cafe/.test(r.places[0].name));
  const ids = r.suggestions.map(s => s.id);
  assert.ok(ids.includes('link:https://joiha.com') && ids.includes('email:a@b.com'), ids.join());
});

test('email không bị đọc thành link/thẻ; không có link giả từ "abc.def"', () => {
  const r = U0('gửi a@b.com');
  assert.strictEqual(r.links.length, 0);
  assert.strictEqual(r.tags.length, 0);
  assert.strictEqual(U0('xong rồi. ok nhé').links.length, 0);
});

test('ưu tiên: "gấp"/"!!!"/"ASAP" > 0; câu thường = 0', () => {
  assert.ok(U0('gấp: nộp báo cáo').priority >= 1);
  assert.ok(U0('nộp báo cáo !!!').priority >= 1);
  assert.ok(U0('submit ASAP').priority >= 1);
  assert.strictEqual(U0('mua sữa').priority, 0);
});

/* ---------- gợi ý ---------- */
test('gợi ý: remind:<key> cho item tương lai, remind-all khi ≥2, split khi ≥2 dòng khác nhau; id ổn định', () => {
  const t = 'họp 9h\n14h gọi khách';
  const a = U0(t).suggestions.map(s => s.id), b = U0(t).suggestions.map(s => s.id);
  assert.deepStrictEqual(a, b);
  assert.ok(a.includes('remind-all') && a.includes('split'));
  assert.strictEqual(a.filter(i => i.startsWith('remind:')).length, 2);
  for (const s of U0(t).suggestions) assert.ok(s.id && s.kind && s.label, JSON.stringify(s));
});

test('gợi ý alarm cho "dậy 6h"; một mục không có remind-all', () => {
  const ids = U0('dậy 6h').suggestions.map(s => s.id);
  assert.ok(ids.some(i => i.startsWith('alarm:')), ids.join());
  assert.ok(!ids.includes('remind-all'));
});

/* ---------- câu thường không sinh nhắc rác ---------- */
// Mỗi câu một test để thấy rõ câu nào còn sinh nhắc rác.
// 4 câu cuối (tối ưu / sáng tạo / chiều dài / ưu tiên sáng tạo): LỖI THẬT còn đỏ — understand coi từ "tối/sáng/chiều" đứng một mình
// (không số giờ) là buổi trong ngày -> mục 20:00/08:00/15:00 + gợi ý remind (BUG-011 chỉ sửa ở parse.analyze, chưa sửa ở understand).
for (const t of ['mua 500g thịt', 'tỉ lệ 16:9', 'điểm 8/10', 'mã đơn 12345', 'phòng 302', 'Version 1.2', 'mua 3 hộp sữa',
  'kế hoạch năm nay', 'iPhone 15 Pro Max 256GB', 'học 3 tiếng', 'ghi chú bình thường', 'Chương 5 bài 12', 'giá 50-60k', 'SĐT 0912 345 678',
  'tối ưu website', 'sáng tạo nội dung', 'đo chiều dài bàn', 'ưu tiên sáng tạo']) {
  test(`câu thường không sinh mục nhắc: "${t}"`, () => {
    const r = U0(t);
    assert.strictEqual(r.items.length, 0, `-> ${sig(r)}`);
    assert.ok(!r.suggestions.some(s => s.kind === 'remind' || s.kind === 'alarm'), 'không được gợi ý nhắc');
  });
}

test('phân số/khoảng số không sinh mục nhắc (liên quan BUG-002: đỏ nếu parse còn nhận 3/4, 1/2 là ngày)', () => {
  for (const t of ['đọc 3/4 cuốn sách', 'chia 1/2 cái bánh', 'tập 2-3 lần mỗi tuần']) assert.strictEqual(U0(t).items.length, 0, t);
});

/* ---------- đầu vào rác ---------- */
test('đầu vào rác không ném lỗi, luôn trả Insight hợp lệ', () => {
  const junk = [null, undefined, 0, 5, NaN, true, {}, [], [1, 2], () => 1, Symbol.iterator && 'x',
    '\u0000', '\uD800', '\uDFFF\uD800', '\u202E9h\u202C', '😀'.repeat(50) + ' 9h', '\n\n\n', '   ', '- [ ]', '#', '@', 'http://', ':::', '9h:'.repeat(30),
    'a'.repeat(100000), '9h\n'.repeat(5000), '0'.repeat(5000), '<script>alert(1)</script> 9h', '${x} {{y}} 9h'];
  for (const x of junk) {
    let r;
    assert.doesNotThrow(() => { r = U.understand(x, NOW); }, String(typeof x));
    assert.strictEqual(r.version, 1);
    assert.ok(Array.isArray(r.items) && Array.isArray(r.suggestions));
  }
  for (const n of [undefined, null, NaN, 'x', Infinity, -1, 8.64e15 + 1]) assert.doesNotThrow(() => U.understand('họp 9h', n), String(n));
});

test('văn bản rất dài/nhiều dòng bị chặn: ≤100 mục, chạy nhanh (<3s)', () => {
  const t0 = Date.now();
  const r = U.understand('9h\n'.repeat(5000), NOW);
  assert.ok(r.items.length <= 100, String(r.items.length));
  assert.ok(Date.now() - t0 < 3000, 'chậm: ' + (Date.now() - t0));
});

test('mệnh đề thô không phình: title ≤ 80, tiêu đề insight không rỗng khi có chữ', () => {
  const r = U0('x'.repeat(500) + ' 9h');
  assert.ok(r.title.length <= 80);
  for (const i of r.items) assert.ok(i.title.length <= 200);
});

test('entities.js: hàm thuần chịu đầu vào rác', () => {
  for (const k of Object.keys(E)) {
    if (typeof E[k] !== 'function') continue;
    for (const x of [null, undefined, 5, {}, '', 'abc 0901234567 500k']) { try { E[k](x); } catch (e) { assert.fail(`E.${k}(${String(x)}) ném: ${e.message}`); } }
  }
});

/* ---------- BUG-012 (ghi nhận hành vi, không assert xấu) ---------- */
test('"họp 3h chiều nay" lúc 16:00: parse vẫn trả due 15:00 (quá khứ) để scheduler nhắc dai; understand không tạo gợi ý remind', () => {
  const now = L(2026, 10, 15, 16, 0);
  const r = U.understand('họp 3h chiều nay', now);
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(fmt(r.items[0].due), '2026-10-15 15:00');
  assert.ok(!r.suggestions.some(s => s.kind === 'remind'), 'remind:<key> chỉ cho item có due > now (API2.md)');
});
