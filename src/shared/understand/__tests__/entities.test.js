// Test entities.js bằng node thuần: node src/shared/understand/__tests__/entities.test.js  (chạy được với mọi TZ)
const assert = require('assert');
const E = require('../entities.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error('HỎNG: ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
// now cố định: thứ Năm 15/10/2026 10:00 (giờ địa phương)
const NOW = new Date(2026, 9, 15, 10, 0);
const X = (s, now = NOW) => E.extractEntities(s, now);
const names = (s, k) => X(s)[k].map(p => p.name);
const amounts = s => X(s).money.map(m => m.amount);
const nums = s => X(s).phones.map(m => m.number);
const urls = s => X(s).links.map(m => m.url);
const L = (y, mo, d, h = 0, mi = 0, se = 0) => new Date(y, mo - 1, d, h, mi, se, 0).getTime();

/* ---- Người ---- */
t('người: anh Nam', () => assert.deepStrictEqual(names('Gọi anh Nam', 'people'), ['Nam']));
t('người: raw giữ nguyên', () => assert.strictEqual(X('Gọi anh Nam').people[0].raw, 'anh Nam'));
t('người: chị Lan Anh (2 chữ)', () => assert.deepStrictEqual(names('hẹn chị Lan Anh', 'people'), ['Lan Anh']));
t('người: a Tuấn', () => assert.deepStrictEqual(names('nhắn a Tuấn', 'people'), ['Tuấn']));
t('người: c Hoa', () => assert.deepStrictEqual(names('hỏi c Hoa', 'people'), ['Hoa']));
t('người: a. Tuấn', () => assert.deepStrictEqual(names('hỏi a. Tuấn', 'people'), ['Tuấn']));
t('người: cô Hoa', () => assert.deepStrictEqual(names('thăm cô Hoa', 'people'), ['Hoa']));
t('người: chú Ba', () => assert.deepStrictEqual(names('chú Ba qua chơi', 'people'), ['Ba']));
t('người: em Tú', () => assert.deepStrictEqual(names('dạy em Tú', 'people'), ['Tú']));
t('người: bạn Hùng', () => assert.deepStrictEqual(names('đi với bạn Hùng', 'people'), ['Hùng']));
t('người: bác Sáu', () => assert.deepStrictEqual(names('qua nhà bác Sáu', 'people'), ['Sáu']));
t('người: ông Tư, bà Năm', () => assert.deepStrictEqual(names('ông Tư và bà Năm', 'people'), ['Tư', 'Năm']));
t('người: thầy Long', () => assert.deepStrictEqual(names('nộp bài cho thầy Long', 'people'), ['Long']));
t('người: sếp đứng riêng', () => assert.deepStrictEqual(names('báo cáo sếp', 'people'), ['sếp']));
t('người: mẹ đứng riêng', () => assert.deepStrictEqual(names('gọi mẹ', 'people'), ['mẹ']));
t('người: bố mẹ', () => assert.deepStrictEqual(names('về thăm bố mẹ', 'people'), ['bố', 'mẹ']));
t('người: mẹ Lan lấy tên', () => assert.deepStrictEqual(names('mẹ Lan gọi', 'people'), ['Lan']));
t('người: @minh', () => assert.deepStrictEqual(names('nhờ @minh làm', 'people'), ['minh']));
t('người: @Minh_Anh', () => assert.deepStrictEqual(names('nhờ @Minh_Anh.', 'people'), ['Minh_Anh']));
t('người: hai người trong một dòng', () => assert.deepStrictEqual(names('anh Nam chị Lan', 'people'), ['Nam', 'Lan']));
t('người: không dấu "anh Nam" (tiền tố không dấu)', () => assert.deepStrictEqual(names('goi chi Lan', 'people'), ['Lan']));
t('người: tên có dấu sau tiền tố không dấu', () => assert.deepStrictEqual(names('nhac co Thảo', 'people'), ['Thảo']));
t('người: dừng ở từ chữ thường', () => assert.deepStrictEqual(names('gặp anh Nam sáng mai', 'people'), ['Nam']));
t('người: dừng ở từ thời gian viết hoa', () => assert.deepStrictEqual(names('Gọi anh Nam Hôm nay', 'people'), ['Nam']));
t('người: dedupe giữa các dòng', () => assert.strictEqual(X('anh Nam\ngọi anh Nam').people.length, 1));
t('người: line đúng chỉ số dòng', () => assert.strictEqual(X('x\ny\nchị Lan').people[0].line, 2));
t('người (âm): anh ấy', () => assert.deepStrictEqual(names('anh ấy đến', 'people'), []));
t('người (âm): em bé', () => assert.deepStrictEqual(names('chăm em bé', 'people'), []));
t('người (âm): chị em', () => assert.deepStrictEqual(names('hai chị em đi chơi', 'people'), []));
t('người (âm): cô đơn', () => assert.deepStrictEqual(names('thấy cô đơn', 'people'), []));
t('người (âm): bạn bè', () => assert.deepStrictEqual(names('đi chơi với bạn bè', 'people'), []));
t('người (âm): Ba Đình', () => assert.deepStrictEqual(names('đi Ba Đình', 'people'), []));
t('người (âm): không dính trong email', () => assert.deepStrictEqual(names('mail a@b.com', 'people'), []));
t('người (âm): chữ thường sau tiền tố', () => assert.deepStrictEqual(names('anh đi làm', 'people'), []));
t('người (âm): giữa từ (banh Nam)', () => assert.deepStrictEqual(names('mua banh Nam', 'people'), []));
t('người (âm): tiền tố mà không có tên', () => assert.deepStrictEqual(names('cô', 'people'), []));

/* ---- Nơi ---- */
t('nơi: ở quán Cộng', () => assert.deepStrictEqual(names('cafe ở quán Cộng', 'places'), ['quán Cộng']));
t('nơi: raw gồm "ở"', () => assert.strictEqual(X('cafe ở quán Cộng').places[0].raw, 'ở quán Cộng'));
t('nơi: tại phòng 302', () => assert.deepStrictEqual(names('họp tại phòng 302', 'places'), ['phòng 302']));
t('nơi: ở nhà', () => assert.deepStrictEqual(names('làm việc ở nhà', 'places'), ['nhà']));
t('nơi: tại công ty', () => assert.deepStrictEqual(names('họp tại công ty', 'places'), ['công ty']));
t('nơi: ở Vincom', () => assert.deepStrictEqual(names('gặp ở Vincom', 'places'), ['Vincom']));
t('nơi: dừng ở "lúc"', () => assert.deepStrictEqual(names('họp tại phòng 302 lúc 9h', 'places'), ['phòng 302']));
t('nơi: dừng ở "vào"', () => assert.deepStrictEqual(names('gặp ở quán Cộng vào thứ 6', 'places'), ['quán Cộng']));
t('nơi: dừng ở giờ 9h', () => assert.deepStrictEqual(names('hẹn ở quán Cộng 9h', 'places'), ['quán Cộng']));
t('nơi: dừng ở 9h30', () => assert.deepStrictEqual(names('hẹn tại Highlands 9h30', 'places'), ['Highlands']));
t('nơi: dừng ở dấu phẩy', () => assert.deepStrictEqual(names('ở Vincom, mua đồ', 'places'), ['Vincom']));
t('nơi: dừng ở động từ', () => assert.deepStrictEqual(names('ở nhà ăn cơm', 'places'), ['nhà']));
t('nơi: dừng ở "sáng mai"', () => assert.deepStrictEqual(names('ở quán Cộng sáng mai', 'places'), ['quán Cộng']));
t('nơi: tên riêng 2 chữ', () => assert.deepStrictEqual(names('gặp tại Royal City', 'places'), ['Royal City']));
t('nơi: tên riêng trùng động từ vẫn giữ (An Phú)', () => assert.deepStrictEqual(names('ở An Phú', 'places'), ['An Phú']));
t('nơi: không dấu "o nha"', () => assert.deepStrictEqual(names('lam viec o nha', 'places'), ['nha']));
t('nơi: không dấu "tai cong ty luc 9h"', () => assert.deepStrictEqual(names('hop tai cong ty luc 9h', 'places'), ['cong ty']));
t('nơi: "tại" in hoa đầu câu', () => assert.deepStrictEqual(names('Tại phòng họp 2 lúc 3h', 'places'), ['phòng họp 2']));
t('nơi: "ở số 5 Lê Lợi"', () => assert.deepStrictEqual(names('ở số 5 Lê Lợi', 'places'), ['số 5 Lê Lợi']));
t('nơi: không dedupe cùng chỗ khác dòng thành 2', () => assert.strictEqual(X('ở nhà\nở nhà').places.length, 1));
t('nơi (âm): ở lại', () => assert.deepStrictEqual(names('ở lại làm thêm', 'places'), []));
t('nơi (âm): ở đâu', () => assert.deepStrictEqual(names('không biết ở đâu', 'places'), []));
t('nơi (âm): tai nghe (không dấu)', () => assert.deepStrictEqual(names('mua tai nghe', 'places'), []));
t('nơi (âm): không có giới từ', () => assert.deepStrictEqual(names('họp phòng 302', 'places'), []));
t('nơi (âm): không lấy trong link', () => assert.deepStrictEqual(names('xem tại https://a.com/x', 'places'), []));
t('nơi (âm): chữ "ở" giữa từ', () => assert.deepStrictEqual(names('mở cửa', 'places'), []));

/* ---- Tiền ---- */
t('tiền: 500k', () => assert.deepStrictEqual(amounts('chuyển 500k'), [500000]));
t('tiền: 500K', () => assert.deepStrictEqual(amounts('chuyển 500K'), [500000]));
t('tiền: raw giữ nguyên', () => assert.strictEqual(X('chuyển 500K nhé').money[0].raw, '500K'));
t('tiền: 1tr2', () => assert.deepStrictEqual(amounts('lương 1tr2'), [1200000]));
t('tiền: 1tr', () => assert.deepStrictEqual(amounts('thuê 1tr'), [1000000]));
t('tiền: 1.5tr', () => assert.deepStrictEqual(amounts('thuê 1.5tr'), [1500000]));
t('tiền: 1,5 triệu', () => assert.deepStrictEqual(amounts('thuê 1,5 triệu'), [1500000]));
t('tiền: 2.000.000đ', () => assert.deepStrictEqual(amounts('đóng 2.000.000đ'), [2000000]));
t('tiền: 2,000,000 vnd', () => assert.deepStrictEqual(amounts('đóng 2,000,000 vnd'), [2000000]));
t('tiền: 50 nghìn', () => assert.deepStrictEqual(amounts('mua 50 nghìn'), [50000]));
t('tiền: 50 ngàn', () => assert.deepStrictEqual(amounts('mua 50 ngàn'), [50000]));
t('tiền: 50 nghin (không dấu)', () => assert.deepStrictEqual(amounts('mua 50 nghin'), [50000]));
t('tiền: 3 củ', () => assert.deepStrictEqual(amounts('nợ 3 củ'), [3000000]));
t('tiền: 200 đồng', () => assert.deepStrictEqual(amounts('trả 200 đồng'), [200]));
t('tiền: 200 dong (không dấu)', () => assert.deepStrictEqual(amounts('tra 200 dong'), [200]));
t('tiền: 1 tỷ', () => assert.deepStrictEqual(amounts('giá 1 tỷ'), [1000000000]));
t('tiền: 2.5 tỷ', () => assert.deepStrictEqual(amounts('giá 2.5 tỷ'), [2500000000]));
t('tiền: 2tr350', () => assert.deepStrictEqual(amounts('2tr350'), [2350000]));
t('tiền: 5 triệu', () => assert.deepStrictEqual(amounts('thưởng 5 triệu'), [5000000]));
t('tiền: 5 trieu (không dấu)', () => assert.deepStrictEqual(amounts('thuong 5 trieu'), [5000000]));
t('tiền: 100k và 2tr trong một dòng', () => assert.deepStrictEqual(amounts('ăn 100k, thuê 2tr'), [100000, 2000000]));
t('tiền: 200d với đ gốc', () => assert.deepStrictEqual(amounts('giá 200đ'), [200]));
t('tiền: 15.000đ', () => assert.deepStrictEqual(amounts('15.000đ'), [15000]));
t('tiền: 1.000.000 vnđ', () => assert.deepStrictEqual(amounts('1.000.000 vnđ'), [1000000]));
t('tiền: nhiều dòng giữ line', () => assert.strictEqual(X('a\nb 50k').money[0].line, 1));
t('tiền (âm): 9h', () => assert.deepStrictEqual(amounts('họp 9h'), []));
t('tiền (âm): 9h30', () => assert.deepStrictEqual(amounts('họp 9h30'), []));
t('tiền (âm): ngày 5/11', () => assert.deepStrictEqual(amounts('ngày 5/11'), []));
t('tiền (âm): phòng 302', () => assert.deepStrictEqual(amounts('phòng 302'), []));
t('tiền (âm): SĐT không thành tiền', () => assert.deepStrictEqual(amounts('gọi 0901234567'), []));
t('tiền (âm): 5kg', () => assert.deepStrictEqual(amounts('mua 5kg gạo'), []));
t('tiền (âm): 12 trưa', () => assert.deepStrictEqual(amounts('hẹn 12 trưa'), []));
t('tiền (âm): 10 trong 20', () => assert.deepStrictEqual(amounts('đạt 10 trong 20'), []));
t('tiền (âm): 3d không đơn vị tiền', () => assert.deepStrictEqual(amounts('đi 3d2n'), []));
t('tiền (âm): số trơn', () => assert.deepStrictEqual(amounts('có 500 người'), []));

/* ---- SĐT ---- */
t('sđt: 10 số liền', () => assert.deepStrictEqual(nums('gọi 0901234567'), ['0901234567']));
t('sđt: display', () => assert.strictEqual(X('gọi 0901234567').phones[0].display, '0901 234 567'));
t('sđt: +84 901 234 567', () => assert.deepStrictEqual(nums('gọi +84 901 234 567'), ['0901234567']));
t('sđt: +84901234567', () => assert.deepStrictEqual(nums('+84901234567'), ['0901234567']));
t('sđt: 090.123.4567', () => assert.deepStrictEqual(nums('090.123.4567'), ['0901234567']));
t('sđt: 090-123-4567', () => assert.deepStrictEqual(nums('090-123-4567'), ['0901234567']));
t('sđt: 0901 234 567', () => assert.deepStrictEqual(nums('0901 234 567'), ['0901234567']));
t('sđt: máy bàn 02812345678', () => assert.deepStrictEqual(nums('văn phòng 02812345678'), ['02812345678']));
t('sđt: máy bàn display', () => assert.strictEqual(X('02812345678').phones[0].display, '0281 234 5678'));
t('sđt: raw giữ định dạng', () => assert.strictEqual(X('gọi 090.123.4567 nhé').phones[0].raw, '090.123.4567'));
t('sđt: kèm tiền cạnh nhau', () => { const r = X('0901234567 500k'); assert.strictEqual(r.phones.length, 1); assert.deepStrictEqual(r.money.map(m => m.amount), [500000]); });
t('sđt: hai số', () => assert.deepStrictEqual(nums('0901234567 hoặc 0912345678'), ['0901234567', '0912345678']));
t('sđt: dedupe', () => assert.strictEqual(X('0901234567\n090.123.4567').phones.length, 1));
t('sđt (âm): 9 số', () => assert.deepStrictEqual(nums('090123456'), []));
t('sđt (âm): 11 số', () => assert.deepStrictEqual(nums('09012345678'), []));
t('sđt (âm): số tiền', () => assert.deepStrictEqual(nums('2.000.000đ'), []));
t('sđt (âm): ngày 15.10.2026', () => assert.deepStrictEqual(nums('15.10.2026'), []));
t('sđt (âm): ngày 05/11/2026', () => assert.deepStrictEqual(nums('05/11/2026'), []));
t('sđt (âm): phòng 302', () => assert.deepStrictEqual(nums('phòng 302'), []));
t('sđt (âm): không bắt đầu bằng 0', () => assert.deepStrictEqual(nums('1901234567'), []));
t('sđt (âm): 0 rồi số 1 (không phải đầu số)', () => assert.deepStrictEqual(nums('0101234567'), []));
t('sđt (âm): chứa trong số dài hơn', () => assert.deepStrictEqual(nums('1.0901234567'), []));

/* ---- Link / email ---- */
t('link: https', () => assert.deepStrictEqual(urls('xem https://example.com/a?b=1'), ['https://example.com/a?b=1']));
t('link: http', () => assert.deepStrictEqual(urls('xem http://a.vn'), ['http://a.vn']));
t('link: www', () => assert.deepStrictEqual(urls('vào www.joiha.com'), ['https://www.joiha.com']));
t('link: tên miền .com', () => assert.deepStrictEqual(urls('vào joiha.com'), ['https://joiha.com']));
t('link: .vn có đường dẫn', () => assert.deepStrictEqual(urls('xem shop.vn/abc'), ['https://shop.vn/abc']));
t('link: .com.vn', () => assert.deepStrictEqual(urls('xem abc.com.vn/x'), ['https://abc.com.vn/x']));
t('link: .io .me .net .org', () => assert.deepStrictEqual(urls('a.io b.me c.net d.org'), ['https://a.io', 'https://b.me', 'https://c.net', 'https://d.org']));
t('link: bỏ dấu câu cuối', () => assert.deepStrictEqual(urls('xem https://a.com/x.'), ['https://a.com/x']));
t('link: bỏ dấu ngoặc/phẩy', () => assert.deepStrictEqual(urls('(xem a.com), xong'), ['https://a.com']));
t('link: raw giữ nguyên', () => assert.strictEqual(X('vào joiha.com nhé').links[0].raw, 'joiha.com'));
t('link: không lẫn với email', () => { const r = X('mail a@joiha.com'); assert.strictEqual(r.links.length, 0); assert.strictEqual(r.emails.length, 1); });
t('link (âm): chữ thường không có TLD', () => assert.deepStrictEqual(urls('xong rồi. Mai họp'), []));
t('link (âm): số thập phân', () => assert.deepStrictEqual(urls('giá 1.5 triệu'), []));
t('email: chuẩn', () => assert.deepStrictEqual(X('gửi a.b@joiha.com').emails.map(e => e.email), ['a.b@joiha.com']));
t('email: dấu câu cuối', () => assert.deepStrictEqual(X('gửi a@b.vn.').emails.map(e => e.email), ['a@b.vn']));
t('email: line', () => assert.strictEqual(X('x\na@b.com').emails[0].line, 1));
t('email (âm): thiếu miền', () => assert.deepStrictEqual(X('gửi a@b').emails, []));
t('email: @mention không phải email', () => { const r = X('nhờ @minh'); assert.strictEqual(r.emails.length, 0); });
t('link: email trong URL không tách thành email', () => { const r = X('https://a.com/?e=x@y.com'); assert.strictEqual(r.emails.length, 0); assert.strictEqual(r.links.length, 1); });

/* ---- Thẻ ---- */
t('thẻ: #việc', () => assert.deepStrictEqual(X('xong #việc').tags.map(x => x.tag), ['việc']));
t('thẻ: #nha', () => assert.deepStrictEqual(X('#nha').tags.map(x => x.tag), ['nha']));
t('thẻ: nhiều thẻ', () => assert.deepStrictEqual(X('#a1x #công_ty').tags.map(x => x.tag), ['a1x', 'công_ty']));
t('thẻ: chữ hoa -> thường', () => assert.deepStrictEqual(X('#Việc').tags.map(x => x.tag), ['việc']));
t('thẻ: dedupe', () => assert.strictEqual(X('#a\n#a').tags.length, 1));
t('thẻ (âm): #1', () => assert.deepStrictEqual(X('việc #1').tags, []));
t('thẻ (âm): #fff', () => assert.deepStrictEqual(X('màu #fff').tags, []));
t('thẻ (âm): #a1b2c3', () => assert.deepStrictEqual(X('màu #a1b2c3').tags, []));
t('thẻ (âm): # đơn', () => assert.deepStrictEqual(X('số # 5').tags, []));
t('thẻ (âm): fragment trong URL', () => assert.deepStrictEqual(X('https://a.com/x#top').tags, []));

/* ---- Ưu tiên ---- */
const pr = s => X(s).priority;
t('ưu tiên: thường = 0', () => assert.strictEqual(pr('họp 9h'), 0));
t('ưu tiên: quan trọng = 1', () => assert.strictEqual(pr('việc quan trọng'), 1));
t('ưu tiên: quan trong (không dấu) = 1', () => assert.strictEqual(pr('viec quan trong'), 1));
t('ưu tiên: ! cuối = 1', () => assert.strictEqual(pr('họp 9h!'), 1));
t('ưu tiên: gấp = 2', () => assert.strictEqual(pr('nộp báo cáo gấp'), 2));
t('ưu tiên: gap (không dấu) = 2', () => assert.strictEqual(pr('nop bao cao gap'), 2));
t('ưu tiên: ưu tiên = 2', () => assert.strictEqual(pr('ưu tiên làm trước'), 2));
t('ưu tiên: !! cuối = 2', () => assert.strictEqual(pr('nộp bài!!'), 2));
t('ưu tiên: rất gấp = 3', () => assert.strictEqual(pr('rất gấp'), 3));
t('ưu tiên: rat gap = 3', () => assert.strictEqual(pr('rat gap'), 3));
t('ưu tiên: khẩn = 3', () => assert.strictEqual(pr('việc khẩn'), 3));
t('ưu tiên: khan (không dấu) = 3', () => assert.strictEqual(pr('viec khan'), 3));
t('ưu tiên: ASAP = 3', () => assert.strictEqual(pr('gửi hợp đồng ASAP'), 3));
t('ưu tiên: urgent = 3', () => assert.strictEqual(pr('Urgent: call client'), 3));
t('ưu tiên: !!! cuối = 3', () => assert.strictEqual(pr('nộp bài!!!'), 3));
t('ưu tiên: lấy mức cao nhất giữa các dòng', () => assert.strictEqual(pr('quan trọng\nrất gấp\ngấp'), 3));
t('ưu tiên: priorityWords', () => assert.deepStrictEqual(X('việc gấp và quan trọng').priorityWords.slice().sort(), ['gấp', 'quan trọng']));
t('ưu tiên: priorityWords có "gấp"', () => assert.ok(X('nộp gấp').priorityWords.includes('gấp')));
t('ưu tiên (âm): gặp không phải gấp', () => assert.strictEqual(pr('gặp anh Nam'), 0));
t('ưu tiên (âm): "hop gap anh" không dấu', () => assert.strictEqual(pr('hop gap anh Nam'), 0));
t('ưu tiên (âm): hen gap khach', () => assert.strictEqual(pr('hen gap khach'), 0));
t('ưu tiên (âm): mua khăn', () => assert.strictEqual(pr('mua khăn'), 0));
t('ưu tiên (âm): mua khan (không dấu)', () => assert.strictEqual(pr('mua khan'), 0));
t('ưu tiên (âm): ! giữa câu', () => assert.strictEqual(pr('Ôi! họp 9h'), 0));
t('ưu tiên (âm): ?!', () => assert.strictEqual(pr('thật sao?!'), 0));
t('ưu tiên (âm): tách từ (ngap)', () => assert.strictEqual(pr('ngap nuoc'), 0));
t('ưu tiên (âm): "gap" trong link', () => assert.strictEqual(pr('xem gap.com'), 0));

/* ---- Hạn mềm ---- (NOW = thứ Năm 15/10/2026) */
const sd = (s, now) => X(s, now).softDeadline;
t('hạn: trong tuần -> CN 18/10 23:59:59', () => assert.strictEqual(sd('xong trong tuần').due, L(2026, 10, 18, 23, 59, 59)));
t('hạn: trong tuần label', () => assert.strictEqual(sd('xong trong tuần').label, 'Trong tuần'));
t('hạn: trong tuan (không dấu)', () => assert.strictEqual(sd('xong trong tuan').due, L(2026, 10, 18, 23, 59, 59)));
t('hạn: raw', () => assert.strictEqual(sd('xong trong tuần nhé').raw, 'trong tuần'));
t('hạn: trước thứ 6 -> T5 23:59:59', () => assert.strictEqual(sd('nộp trước thứ 6').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: trước thứ 6 label', () => assert.strictEqual(sd('nộp trước thứ 6').label, 'Trước thứ 6'));
t('hạn: trước t6', () => assert.strictEqual(sd('nộp trước t6').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: truoc thu 6 (không dấu)', () => assert.strictEqual(sd('nop truoc thu 6').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: trước thứ sáu (chữ)', () => assert.strictEqual(sd('nộp trước thứ sáu').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: trước thứ 7 -> T6', () => assert.strictEqual(sd('trước thứ 7').due, L(2026, 10, 16, 23, 59, 59)));
t('hạn: trước thứ 4 đã qua -> tuần sau (T3)', () => assert.strictEqual(sd('trước thứ 4').due, L(2026, 10, 20, 23, 59, 59)));
t('hạn: trước thứ 2 -> CN tuần này', () => assert.strictEqual(sd('trước thứ 2').due, L(2026, 10, 18, 23, 59, 59)));
t('hạn: trước chủ nhật -> T7', () => assert.strictEqual(sd('trước chủ nhật').due, L(2026, 10, 17, 23, 59, 59)));
t('hạn: trước thứ 6 khi hôm nay là T6 -> T5 tuần sau', () => assert.strictEqual(sd('trước thứ 6', new Date(2026, 9, 16, 9, 0)).due, L(2026, 10, 22, 23, 59, 59)));
t('hạn: cuối tuần -> CN', () => assert.strictEqual(sd('đi chơi cuối tuần').due, L(2026, 10, 18, 23, 59, 59)));
t('hạn: cuối tuần label', () => assert.strictEqual(sd('cuối tuần').label, 'Cuối tuần'));
t('hạn: cuối tuần vào chủ nhật -> hôm nay', () => assert.strictEqual(sd('cuối tuần', new Date(2026, 9, 18, 8, 0)).due, L(2026, 10, 18, 23, 59, 59)));
t('hạn: cuối tháng', () => assert.strictEqual(sd('đóng tiền cuối tháng').due, L(2026, 10, 31, 23, 59, 59)));
t('hạn: cuối tháng label', () => assert.strictEqual(sd('cuối tháng').label, 'Cuối tháng'));
t('hạn: cuối tháng 2 (28 ngày)', () => assert.strictEqual(sd('cuối tháng', new Date(2027, 1, 10, 9, 0)).due, L(2027, 2, 28, 23, 59, 59)));
t('hạn: cuối tháng 2 năm nhuận', () => assert.strictEqual(sd('cuối tháng', new Date(2028, 1, 10, 9, 0)).due, L(2028, 2, 29, 23, 59, 59)));
t('hạn: tuần sau -> CN tuần sau', () => assert.strictEqual(sd('làm tuần sau').due, L(2026, 10, 25, 23, 59, 59)));
t('hạn: tuần tới', () => assert.strictEqual(sd('làm tuần tới').due, L(2026, 10, 25, 23, 59, 59)));
t('hạn: tuần sau label', () => assert.strictEqual(sd('tuần sau').label, 'Tuần sau'));
t('hạn: trong hôm nay', () => assert.strictEqual(sd('xong trong hôm nay').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: trong ngày', () => assert.strictEqual(sd('xong trong ngày').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: hết hôm nay', () => assert.strictEqual(sd('xong hết hôm nay').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: trong hôm nay label', () => assert.strictEqual(sd('trong hôm nay').label, 'Trong hôm nay'));
t('hạn: trước 5/11 -> 4/11 23:59', () => assert.strictEqual(sd('nộp trước 5/11').due, L(2026, 11, 4, 23, 59, 59)));
t('hạn: trước 5/11 label', () => assert.strictEqual(sd('nộp trước 5/11').label, 'Trước 5/11'));
t('hạn: trước ngày 5/11', () => assert.strictEqual(sd('nộp trước ngày 5/11').due, L(2026, 11, 4, 23, 59, 59)));
t('hạn: trước 1/11 -> 31/10', () => assert.strictEqual(sd('trước 1/11').due, L(2026, 10, 31, 23, 59, 59)));
t('hạn: trước 5/10 đã qua -> năm sau', () => assert.strictEqual(sd('trước 5/10').due, L(2027, 10, 4, 23, 59, 59)));
t('hạn: trước 5/11/2027 có năm', () => assert.strictEqual(sd('trước 5/11/2027').due, L(2027, 11, 4, 23, 59, 59)));
t('hạn: trước ngày 20 -> 19 tháng này', () => assert.strictEqual(sd('trước ngày 20').due, L(2026, 10, 19, 23, 59, 59)));
t('hạn: lấy hạn sớm nhất giữa các dòng', () => assert.strictEqual(sd('tuần sau\ntrong hôm nay').due, L(2026, 10, 15, 23, 59, 59)));
t('hạn: không có -> null', () => assert.strictEqual(sd('họp 9h sáng mai'), null));
t('hạn (âm): trước 9h không phải hạn', () => assert.strictEqual(sd('trước 9h'), null));
t('hạn (âm): thứ 3 tuần sau là ngày cụ thể', () => assert.strictEqual(sd('họp thứ 3 tuần sau'), null));
t('hạn (âm): trong tuần sau không tính "trong tuần"', () => assert.strictEqual(sd('làm trong tuần sau').label, 'Tuần sau'));
t('hạn (âm): ngày 32/13 vô lý', () => assert.strictEqual(sd('trước 32/13'), null));
t('hạn: due dùng giờ địa phương (không lệch múi giờ)', () => { const d = new Date(sd('trong ngày').due); assert.deepStrictEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()], [2026, 9, 15, 23, 59, 59]); });

/* ---- Tổng hợp / lineEntities / UMD ---- */
t('tổng hợp: một câu nhiều thực thể', () => {
  const r = X('Gọi anh Nam 0901234567 ở quán Cộng lúc 9h, trả 500k #việc gấp trước thứ 6');
  assert.deepStrictEqual(r.people.map(p => p.name), ['Nam']);
  assert.deepStrictEqual(r.phones.map(p => p.number), ['0901234567']);
  assert.deepStrictEqual(r.places.map(p => p.name), ['quán Cộng']);
  assert.deepStrictEqual(r.money.map(p => p.amount), [500000]);
  assert.deepStrictEqual(r.tags.map(p => p.tag), ['việc']);
  assert.strictEqual(r.priority, 2);
  assert.strictEqual(r.softDeadline.label, 'Trước thứ 6');
});
t('tổng hợp: văn bản rỗng', () => {
  const r = X('');
  assert.deepStrictEqual([r.people, r.places, r.money, r.phones, r.links, r.emails, r.tags, r.priorityWords], [[], [], [], [], [], [], [], []]);
  assert.strictEqual(r.priority, 0); assert.strictEqual(r.softDeadline, null);
});
t('tổng hợp: null/undefined không ném lỗi', () => { E.extractEntities(null, NOW); E.extractEntities(undefined); E.lineEntities(undefined, 0); });
t('tổng hợp: CRLF', () => assert.strictEqual(X('a\r\nchị Lan').people[0].line, 1));
t('tổng hợp: now là số ms', () => assert.strictEqual(E.extractEntities('trong ngày', NOW.getTime()).softDeadline.due, L(2026, 10, 15, 23, 59, 59)));
t('lineEntities: gán đúng chỉ số dòng', () => { const r = E.lineEntities('gọi anh Nam 50k #a', 7, NOW); assert.deepStrictEqual([r.people[0].line, r.money[0].line, r.tags[0].line], [7, 7, 7]); });
t('lineEntities: có đủ khóa như extractEntities', () => assert.deepStrictEqual(Object.keys(E.lineEntities('x', 0, NOW)).sort(), Object.keys(X('x')).sort()));
t('fold: bỏ dấu giữ độ dài', () => { const s = 'Đặt Phòng Họp'; assert.strictEqual(E.fold(s), 'dat phong hop'); });
t('NFD đầu vào vẫn nhận (chuẩn hoá NFC)', () => assert.deepStrictEqual(names('gọi chị Lan'.normalize('NFD'), 'people'), ['Lan']));
t('mọi thứ không có thực thể -> rỗng', () => { const r = X('mua rau và nấu cơm'); assert.strictEqual(r.people.length + r.places.length + r.money.length + r.phones.length + r.links.length + r.tags.length, 0); });

console.log('Đạt ' + pass + '/' + (pass + fail) + ' ca (TZ=' + (process.env.TZ || 'mặc định') + ')');
process.exit(fail ? 1 : 0);
