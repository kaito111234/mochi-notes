'use strict';
// Bộ test hiểu ngôn ngữ của Mochi Notes (chạy offline): node tools/test-nlu.js
//  A) hiểu note: giờ hẹn / tiêu đề việc / intent / lặp (shared/understand + shared/parse)
//  B) hiểu lệnh cho bé (main/antics/commands.js) + dòng gọi bé trong note (note/command.js)
// In số đúng/sai, exit 1 nếu có câu sai. Thêm câu mới: dán vào mảng NOTES hoặc CMDS bên dưới.
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const root = path.join(__dirname, '..');
const U = require(path.join(root, 'src/shared/understand/index.js'));
const P = require(path.join(root, 'src/shared/parse.js'));
const C = require(path.join(root, 'src/main/antics/commands.js'));

// "bây giờ" cố định: thứ Năm 15/10/2026 10:00
const NOW_D = new Date(2026, 9, 15, 10, 0, 0), NOW = NOW_D.getTime();
const TODAY0 = new Date(2026, 9, 15).getTime();
let pass = 0, fail = 0;
const failures = [];
const ok = (cond, name, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? '   => ' + detail : '')); } };

// ---------------------------------------------------------------- A) NOTE
// expect: t = tiêu đề, i = intent, h/mi = giờ phút, d = lệch ngày so với hôm nay, rep = kiểu lặp,
//         none = không có việc/hẹn nào, dateOnly = chỉ có ngày (không giờ) -> scheduler dùng analyze
function nlu(text, now) {
  now = now || NOW;
  const r = U.understand(text, now);
  if (r.items.length) { const it = r.items[0]; return { due: it.due, title: it.title, intent: it.intent, rep: it.repeat && it.repeat.freq, items: r.items.length }; }
  const a = P.analyze(text, now);     // note chỉ có ngày (không có giờ)
  return { due: a.due, title: null, intent: a.intent, rep: null, items: 0, dateOnly: !!a.due };
}
const NOTES = [
  // --- tiêu đề không được thành "Báo" trơ trọi
  ['báo sau 1p', { t: 'Nhắc sau 1 phút', h: 10, mi: 1, d: 0 }],
  ['nhắc sau 5p', { t: 'Nhắc sau 5 phút', h: 10, mi: 5 }],
  ['báo 10 phút nữa', { t: 'Nhắc sau 10 phút', h: 10, mi: 10 }],
  ['nhắc tôi sau 2 tiếng', { t: 'Nhắc sau 2 tiếng', h: 12, mi: 0 }],
  ['bao sau 3 phut nha', { t: 'Nhắc sau 3 phút', h: 10, mi: 3 }],
  ['lát nữa 5 phút báo nha', { t: 'Nhắc sau 5 phút', h: 10, mi: 5 }],
  // --- dữ liệu thật của người dùng
  ['6h30 đi rước con', { t: 'Đi rước con', i: 'go', h: 18, mi: 30 }],
  ['2h giao máy, xóa cái này đi', { t: 'Giao máy', h: 14, mi: 0 }],
  ['chiều nay 4 giờ đón con', { t: 'Đón con', i: 'go', h: 16, mi: 0, d: 0 }],
  ['5p nữa đi làm', { t: 'Đi làm', h: 10, mi: 5 }],
  ['taaij sao koong thông báo', { none: true }],
  ['bé ói cái này xóa đi', { none: true }],
  ['bé oi xóa cái này nữa', { none: true }],
  ['đi công viẹc xóa cái nài đi', { none: true }],
  // --- khoảng thời gian nhiều kiểu
  ['1 tiếng nữa gọi mẹ', { t: 'Gọi mẹ', i: 'call', h: 11, mi: 0 }],
  ['nửa tiếng nữa gọi mẹ', { t: 'Gọi mẹ', i: 'call', h: 10, mi: 30 }],
  ['nua tieng nua goi me', { i: 'call', h: 10, mi: 30 }],
  ['30p nữa uống thuốc', { t: 'Uống thuốc', i: 'pill', h: 10, mi: 30 }],
  ['tí nữa uống thuốc', { t: 'Uống thuốc', i: 'pill', h: 10, mi: 10 }],
  ['lát nữa 15 phút họp', { t: 'Họp', i: 'meet', h: 10, mi: 15 }],
  ['sau 1 tiếng rưỡi họp', { i: 'meet', h: 11, mi: 30 }],
  ['2 tiếng rưỡi nữa đi đón con', { i: 'go', h: 12, mi: 30 }],
  ['hai tiếng nữa nộp báo cáo', { t: 'Nộp báo cáo', i: 'due', h: 12, mi: 0 }],
  ['trong 20 phút nữa tắt bếp', { t: 'Tắt bếp', h: 10, mi: 20 }],
  ['45 phút nữa họp team', { t: 'Họp team', i: 'meet', h: 10, mi: 45 }],
  ['1 giờ nữa đi chợ', { t: 'Đi chợ', i: 'buy', h: 11, mi: 0 }],
  ['10 phut nua tat may', { h: 10, mi: 10 }],
  ['chút nữa 10 phút gọi khách', { t: 'Gọi khách', i: 'call', h: 10, mi: 10 }],
  // --- giờ trong ngày nhiều kiểu
  ['5h chiều mai họp', { t: 'Họp', i: 'meet', h: 17, mi: 0, d: 1 }],
  ['8g tối xem phim', { t: 'Xem phim', h: 20, mi: 0 }],
  ['8h kém 15 họp', { t: 'Họp', i: 'meet', h: 19, mi: 45 }],
  ['8h kém 15 sáng mai họp', { t: 'Họp', i: 'meet', h: 7, mi: 45, d: 1 }],
  ['7 rưỡi sáng mai đi học', { t: 'Đi học', h: 7, mi: 30, d: 1 }],
  ['7h rưỡi sáng mai dậy', { h: 7, mi: 30, d: 1 }],
  ['7h30 sáng mai gọi khách', { t: 'Gọi khách', i: 'call', h: 7, mi: 30, d: 1 }],
  ['7:30 sáng mai họp', { t: 'Họp', h: 7, mi: 30, d: 1 }],
  ['19h họp phụ huynh', { t: 'Họp phụ huynh', i: 'meet', h: 19, mi: 0 }],
  ['trưa nay ăn cơm với sếp', { h: 12, mi: 0, d: 0 }],
  ['tối nay 8h đá bóng', { t: 'Đá bóng', h: 20, mi: 0, d: 0 }],
  ['tối nay đi chợ', { i: 'buy', h: 20, mi: 0, d: 0 }],
  ['sáng mai họp', { t: 'Họp', i: 'meet', h: 8, mi: 0, d: 1 }],
  ['sang mai hop', { i: 'meet', h: 8, mi: 0, d: 1 }],
  ['9h sáng mai họp khách hàng', { t: 'Họp khách hàng', i: 'meet', h: 9, mi: 0, d: 1 }],
  ['mai 9h gọi bác sĩ', { t: 'Gọi bác sĩ', i: 'call', h: 9, mi: 0, d: 1 }],
  ['ngày mai 14h nộp hồ sơ', { t: 'Nộp hồ sơ', i: 'due', h: 14, mi: 0, d: 1 }],
  ['14h30 chiều nay họp', { i: 'meet', h: 14, mi: 30 }],
  ['3h chiều nay đi khám', { t: 'Đi khám', h: 15, mi: 0, d: 0 }],
  ['3 giờ chiều đón bé', { t: 'Đón bé', i: 'go', h: 15, mi: 0 }],
  ['11h đêm tắt máy', { h: 23, mi: 0 }],
  ['lúc 6 giờ chiều mua rau', { t: 'Mua rau', i: 'buy', h: 18, mi: 0 }],
  ['khoảng 4h chiều cafe với Lan', { i: 'meet', h: 16, mi: 0 }],
  ['hop 15h', { i: 'meet', h: 15, mi: 0 }],
  ['nhac toi 3h chieu goi khach', { i: 'call', h: 15, mi: 0 }],
  ['bé oi nhac minh 3h chieu hop', { i: 'meet', h: 15, mi: 0 }],
  ['uong thuoc luc 21h', { i: 'pill', h: 21, mi: 0 }],
  ['9 giờ tối uống thuốc', { t: 'Uống thuốc', i: 'pill', h: 21, mi: 0 }],
  ['21:00 uống thuốc', { i: 'pill', h: 21, mi: 0 }],
  ['đi ngủ lúc 23h', { h: 23, mi: 0 }],
  ['dậy 5h sáng mai', { h: 5, mi: 0, d: 1 }],
  ['báo thức 6h sáng mai', { h: 6, mi: 0, d: 1 }],
  ['đặt báo thức 5h30 sáng mai', { h: 5, mi: 30, d: 1 }],
  // --- ngày
  ['thứ 6 20h xem phim', { h: 20, mi: 0, d: 1 }],
  ['thứ 2 tuần sau 9h họp', { t: 'Họp', i: 'meet', h: 9, mi: 0, d: 4 }],
  ['thứ 2 tuần sau nộp bài', { dateOnly: true, d: 4, i: 'due' }],
  ['cuối tuần đi chơi', { dateOnly: true, d: 2 }],
  ['cuối tuần 8h sáng đi chợ', { h: 8, mi: 0, d: 2 }],
  ['20/10 sinh nhật Lan', { dateOnly: true, d: 5, i: 'bday' }],
  ['ngày 20 nộp báo cáo', { dateOnly: true, d: 5, i: 'due' }],
  ['ngày 20 9h họp', { h: 9, mi: 0, d: 5 }],
  ['20/10 lúc 15h họp', { h: 15, mi: 0, d: 5, i: 'meet' }],
  ['ngày 20 tháng 10 họp 10h', { h: 10, mi: 0, d: 5 }],
  ['chủ nhật 7h đi chợ', { h: 7, mi: 0, d: 3 }],
  ['ngày kia 8h họp', { h: 8, mi: 0, d: 2, i: 'meet' }],
  ['cuối tháng đóng tiền nhà', { dateOnly: true, i: 'pay' }],
  ['mùng 5 tháng sau họp', { none: true }],
  // --- lặp
  ['mỗi sáng 7h tập thể dục', { t: 'Tập thể dục', i: 'health', h: 7, mi: 0, rep: 'daily' }],
  ['thứ 2 hàng tuần họp giao ban', { noItems: true }],
  ['nhắc tớ thứ 2 hàng tuần họp giao ban', { t: 'Họp giao ban', i: 'meet', h: 9, mi: 0, rep: 'weekly' }],
  ['thứ 2 hàng tuần 8h họp giao ban', { t: 'Họp giao ban', h: 8, mi: 0, rep: 'weekly' }],
  ['mỗi ngày 9h uống thuốc', { t: 'Uống thuốc', i: 'pill', h: 9, mi: 0, rep: 'daily' }],
  ['hằng ngày 21h uống thuốc', { i: 'pill', h: 21, mi: 0, rep: 'daily' }],
  ['moi sang 6h30 chay bo', { h: 6, mi: 30, rep: 'daily' }],
  ['mỗi 2 tiếng uống nước', { t: 'Uống nước', i: 'health', rep: 'hourly' }],
  ['ngày 5 hàng tháng đóng tiền nhà', { noItems: true }],
  ['nhắc ngày 5 hàng tháng đóng tiền nhà', { t: 'Đóng tiền nhà', i: 'pay', h: 9, mi: 0, rep: 'monthly' }],
  ['mua sữa hàng ngày', { noItems: true }],
  ['nhắc tớ uống thuốc mỗi ngày', { t: 'Uống thuốc', h: 9, mi: 0, rep: 'daily' }],
  ['mỗi tối 8h học tiếng anh', { h: 20, mi: 0, rep: 'daily' }],
  ['thứ 2, thứ 4 hàng tuần 19h đi bơi', { h: 19, mi: 0, rep: 'weekly' }],
  // --- không được bắt nhầm số không phải giờ
  ['mua 2 hộp sữa', { none: true }],
  ['phòng 305', { none: true }],
  ['giá 50k', { none: true }],
  ['iPhone 15', { none: true }],
  ['mua 3 cái bánh 20k', { none: true }],
  ['tầng 12 phòng 1205', { none: true }],
  ['biển số 59H1 12345', { none: true }],
  ['sdt 0912345678', { none: true }],
  ['chuyển 500k cho Lan', { none: true }],
  ['lương 15 triệu', { none: true }],
  ['bài 2 trang 15', { none: true }],
  ['size 38 màu đen', { none: true }],
  ['Tập 5 bộ phim', { none: true }],
  ['mua 5 ký thịt', { none: true }],
  ['hôm qua trời đẹp', { none: true }],
  ['ghi chú linh tinh', { none: true }],
  ['cô Mai gọi lại', { none: true }],
  ['anh tư bán hàng', { none: true }],
  ['thứ tự ưu tiên: A, B, C', { none: true }],
  ['đơn hàng #2045 đang giao', { none: true }],
  ['chị hai mua 2 kg táo', { none: true }],
  // --- intent
  ['gọi cho khách 3h chiều', { i: 'call', h: 15 }],
  ['họp với team 10h30 sáng mai', { i: 'meet', h: 10, mi: 30, d: 1 }],
  ['mua sữa 5h chiều', { i: 'buy', h: 17 }],
  ['nộp báo cáo 17h', { i: 'due', h: 17 }],
  ['rước con 4h chiều', { i: 'go', h: 16 }],
  ['đón mẹ ở sân bay 7h tối', { i: 'go', h: 19 }],
  ['uống thuốc 8h tối', { i: 'pill', h: 20 }],
  ['sinh nhật bạn 18h mai', { i: 'bday', h: 18, d: 1 }],
  ['trả tiền điện 9h sáng mai', { i: 'pay', h: 9, d: 1 }],
  ['uống nước 3h chiều', { i: 'health', h: 15 }],
  ['dọn nhà 9h sáng mai', { i: 'task', h: 9, d: 1 }],
  // --- sửa theo rà soát
  ['uống thuốc ngày 2 lần lúc 8h', { h: 20, mi: 0, d: 0 }],
  ['tập gym ngày 3 buổi', { none: true }],
  ['ăn ngày 3 bữa', { none: true }],
  ['uống 2 viên ngày 2 lần', { none: true }],
  ['mỗi ngày 2 lần 8h uống thuốc', { h: 8, mi: 0, rep: 'daily' }],
  ['họp 9 giờ ngày 12', { h: 9, mi: 0, d: 28 }],
  ['9h ngày 20 họp', { h: 9, mi: 0, d: 5 }],
  ['🍵 hai tiếng nữa gọi mẹ', { i: 'call', h: 12, mi: 0 }],
  ['🍵 nhắc tớ uống nước lúc 3h', { i: 'health', h: 15, mi: 0 }],
  ['ăn thêm chút nữa', { none: true }],
  ['đợi tí nữa', { none: true }],
  ['nhắc tớ chút nữa gọi khách', { t: 'Gọi khách', i: 'call', h: 10, mi: 10 }],
  ['mua balo cho con', { none: true }],
  ['mua balo 3h chiều', { i: 'buy', h: 15, mi: 0 }],
  ['đi salon 3h chiều', { i: 'task', h: 15, mi: 0 }],
  ['ngày 15 lúc 9h sáng nộp hồ sơ', { h: 9, mi: 0, d: 31 }],
  ['ngày 15 lúc 9h sáng nộp hồ sơ', { h: 9, mi: 0, d: 0, now: [8, 0] }],
  ['2h giao máy', { t: 'Giao máy', h: 14, mi: 0, d: 1, now: [15, 0] }],
  ['5h dậy', { h: 5, mi: 0, d: 1 }],
  ['5h sáng chạy bộ', { h: 5, mi: 0, d: 1 }],
  ['đêm nay 1h xem phim', { t: 'Xem phim', h: 1, mi: 0, d: 1 }],
  // --- nhiều việc trong một note
  ['10 phút nữa nhắc tôi gọi lại cho khách', { t: 'Gọi lại cho khách', i: 'call', h: 10, mi: 10 }],
  ['tối mai 7h đi ăn với bạn', { h: 19, mi: 0, d: 1 }],
  ['9h tối nay tắt điện thoại', { t: 'Tắt điện thoại', h: 21, mi: 0, d: 0 }],
  ['2h họp, 4h gọi khách', { t: 'Họp', h: 14, items: 2 }],
  ['8h sáng mai họp và 3h chiều mai gọi khách', { h: 8, d: 1, items: 2 }]
];
function runNotes() {
  for (const [text, e] of NOTES) {
    const r = nlu(text, e.now ? new Date(2026, 9, 15, e.now[0], e.now[1] || 0).getTime() : 0), where = JSON.stringify(text) + (e.now ? ' @' + e.now[0] + 'h' : '');
    const dd = r.due ? new Date(r.due) : null;
    const dayOff = dd ? Math.round((new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).getTime() - TODAY0) / 864e5) : null;
    const got = r.due ? `${r.title || '-'} | ${r.intent} | ${dd.getHours()}:${String(dd.getMinutes()).padStart(2, '0')} d${dayOff}${r.rep ? ' ' + r.rep : ''} x${r.items}` : 'không nhận ra';
    if (e.noItems) { ok(r.items === 0, 'NOTE ' + where + ' (không được tự tạo nhắc)', got); continue; }
    if (e.none) { ok(!r.due, 'NOTE ' + where, got); continue; }
    if (e.dateOnly) { ok(!!r.due && (e.d === undefined || dayOff === e.d) && (!e.i || r.intent === e.i), 'NOTE ' + where, got); continue; }
    let good = !!r.due;
    if (good && e.t !== undefined && r.title !== e.t) good = false;
    if (good && e.i !== undefined && r.intent !== e.i) good = false;
    if (good && e.h !== undefined && dd.getHours() !== e.h) good = false;
    if (good && e.mi !== undefined && dd.getMinutes() !== e.mi) good = false;
    if (good && e.d !== undefined && dayOff !== e.d) good = false;
    if (good && e.rep !== undefined && r.rep !== e.rep) good = false;
    if (good && e.items !== undefined && r.items !== e.items) good = false;
    ok(good, 'NOTE ' + where + ' (mong ' + JSON.stringify(e) + ')', got);
  }
}

// ---------------------------------------------------------------- B) LỆNH CHO BÉ
// expect: chuỗi kind ('trashThis'), 'trick:dance', 'room:gacha', 'focus:45', hoặc object { kind, text? },
//         { multi: [..] } -> chạy lần lượt, 'negated', 'unclear:a,b' (các kind trong options), 'unknown'
function sig(c) {
  if (c.kind === 'trick') return 'trick:' + c.name;
  if (c.kind === 'room') return 'room:' + c.tab;
  if (c.kind === 'focus') return 'focus:' + c.min;
  return c.kind;
}
const CMDS = [
  // help
  ['giúp', 'help'], ['giup', 'help'], ['help', 'help'], ['hướng dẫn', 'help'], ['bé làm được gì', 'help'], ['be lam duoc gi', 'help'],
  ['lệnh', 'help'], ['các lệnh', 'help'], ['giúp tớ với', 'help'], ['hlep', 'help'],
  // openTrash
  ['mở thùng rác', 'openTrash'], ['mo thung rac', 'openTrash'], ['xem thùng rác', 'openTrash'], ['thùng rác', 'openTrash'], ['cho tớ xem thùng rác nhé', 'openTrash'],
  // trashThis
  ['xoá note này', 'trashThis'], ['xóa note này đi', 'trashThis'], ['xoa note nay', 'trashThis'], ['vứt note này', 'trashThis'], ['xoá cái này', 'trashThis'],
  ['xóa cái này đi', 'trashThis'], ['xóa cái này nữa', 'trashThis'], ['xoá cái nài đi', 'trashThis'], ['note này xoá đi', 'trashThis'], ['cái này vứt', 'trashThis'],
  ['cái này xóa đi', 'trashThis'], ['vứt đi', 'trashThis'], ['xoá đi', 'trashThis'], ['xoá', 'trashThis'], ['bỏ note này đi', 'trashThis'], ['ném note này vào thùng rác', 'trashThis'],
  ['xoá note này giúp tớ nhé', 'trashThis'], ['xóa giùm cái này với', 'trashThis'], ['xoas cai nay di', 'trashThis'], ['xoa nhanh note nay', 'trashThis'], ['huỷ note này', 'trashThis'],
  ['bỏ cái này vào thùng rác', 'trashThis'], ['delete note này', 'trashThis'], ['ko cần note này nữa, xoá đi', 'trashThis'], ['thôi xoá luôn note này đi', 'trashThis'],
  // arrange
  ['xếp note lại', 'arrange'], ['xep note gon lai', 'arrange'], ['sắp xếp note', 'arrange'], ['sắp xếp lại giúp tớ', 'arrange'], ['gom note lại', 'arrange'],
  ['xếp gọn lại đi', 'arrange'], ['xep note di nhe', 'arrange'], ['làm gọn note', 'arrange'], ['note xếp gọn lại nha', 'arrange'], ['xếp hàng note đi', 'arrange'], ['sap xep', 'arrange'],
  // clean
  ['dọn dẹp', 'cleanDone'], ['don dep', 'cleanDone'], ['dọn đi', 'cleanDone'], ['dọn dẹp giúp tớ nhé', 'cleanDone'], ['dọn note đã xong', 'cleanDone'],
  ['dọn mấy cái note xong rồi', 'cleanDone'], ['dọn dẹp note đi mà', 'cleanDone'], ['dọn dẹp đi', 'cleanDone'], ['don dẹp giùm', 'cleanDone'], ['dọn dẹp nha', 'cleanDone'],
  ['dọn note trống', 'cleanEmpty'], ['don note trong', 'cleanEmpty'], ['xoá note trống', 'cleanEmpty'], ['dọn mấy note trống giúp', 'cleanEmpty'], ['vứt các note rỗng', 'cleanEmpty'], ['dọn note trắng', 'cleanEmpty'],
  ['dọn note hết hạn', 'cleanExpired'], ['don note qua han', 'cleanExpired'], ['xoá note quá hạn', 'cleanExpired'], ['dọn mấy cái note hết hạn đi', 'cleanExpired'], ['dọn các note cũ', 'cleanExpired'],
  // hide / show
  ['ẩn hết note', 'hideAll'], ['an het note', 'hideAll'], ['giấu hết note đi', 'hideAll'], ['ẩn tất cả note', 'hideAll'], ['cất hết note', 'hideAll'], ['giấu note', 'hideAll'], ['thu gọn hết note nha', 'hideAll'],
  ['hiện hết note', 'showAll'], ['hien het note', 'showAll'], ['mở tất cả note', 'showAll'], ['hiện tất cả note ra', 'showAll'], ['cho tớ xem hết note', 'showAll'], ['show hết note', 'showAll'],
  // newNote / remind
  [{ t: 'tạo note mua sữa' }, { kind: 'newNote', text: 'mua sữa' }], [{ t: 'tao note moi: goi me' }, { kind: 'newNote', text: 'goi me' }],
  [{ t: 'viết note họp 3h' }, { kind: 'newNote', text: 'họp 3h' }], [{ t: 'thêm ghi chú mua rau' }, { kind: 'newNote', text: 'mua rau' }], [{ t: 'tạo note mới' }, { kind: 'newNote', text: '' }],
  [{ t: 'nhắc tớ uống nước lúc 15h' }, { kind: 'remind', text: 'uống nước lúc 15h' }], [{ t: 'nhắc tớ 5 phút nữa tắt bếp' }, { kind: 'remind', text: '5 phút nữa tắt bếp' }],
  [{ t: 'nhac minh 3h chieu hop' }, { kind: 'remind', text: '3h chieu hop' }], [{ t: 'nhắc mình họp ngày mai 9h' }, { kind: 'remind', text: 'họp ngày mai 9h' }],
  [{ t: 'báo tớ sau 10p nhé' }, { kind: 'remind' }], [{ t: 'đặt báo thức 6h sáng mai' }, { kind: 'remind' }], [{ t: 'tối nay 8h nhắc tớ đá bóng' }, { kind: 'remind' }],
  [{ t: 'nhac toi lúc 7 rưỡi di hoc' }, { kind: 'remind' }],
  // knock / list / room
  ['nhắc việc', 'knock'], ['gõ cửa nhắc việc đi', 'knock'], ['có việc gì không', 'knock'], ['kiểm tra việc', 'knock'], ['nhac', 'knock'], ['còn việc gì nè', 'knock'],
  ['danh sách', 'list'], ['mở danh sách note', 'list'], ['danh sach note', 'list'], ['liệt kê note', 'list'],
  ['mở tủ đồ', 'room:wardrobe'], ['thay đồ', 'room:wardrobe'], ['tu do', 'room:wardrobe'], ['mặc đồ mới', 'room:wardrobe'],
  ['quay gacha', 'room:gacha'], ['quay đồ', 'room:gacha'], ['gacha', 'room:gacha'],
  ['cửa hàng', 'room:shop'], ['đổi bụng', 'room:shop'], ['cua hang', 'room:shop'], ['nhiệm vụ', 'room:quests'], ['nhiem vu hom nay', 'room:quests'], ['thống kê', 'room:stats'], ['thong ke', 'room:stats'],
  // sleep / wake
  ['đi ngủ', 'sleep'], ['di ngu', 'sleep'], ['ngủ đi', 'sleep'], ['ngủ ngon nhé', 'sleep'], ['nghỉ ngơi đi', 'sleep'], ['bé đi ngủ đi', 'sleep'],
  ['dậy đi', 'wake'], ['thức dậy', 'wake'], ['thuc day di', 'wake'], ['dậy', 'wake'], ['dậy rồi nha', 'wake'],
  // tricks
  ['múa', 'trick:dance'], ['mua di', 'trick:dance'], ['nhảy múa đi', 'trick:dance'], ['múa cho tớ xem', 'trick:dance'], ['hát', 'trick:sing'], ['hát đi', 'trick:sing'], ['hat mot bai di', 'trick:sing'],
  ['tập thể dục', 'trick:exercise'], ['tap the duc', 'trick:exercise'], ['đánh đu', 'trick:swing'], ['danh du di', 'trick:swing'], ['ngủ trưa', 'trick:nap'], ['ngu trua di', 'trick:nap'], ['chợp mắt tí', 'trick:nap'],
  ['đọc sách', 'trick:read'], ['doc sach di', 'trick:read'], ['ăn cơm nắm', 'trick:eat'], ['ăn đi', 'trick:eat'], ['bé ăn', 'trick:eat'], ['ăn bánh', 'trick:eat'],
  ['uống trà', 'trick:tea'], ['uong tra di', 'trick:tea'], ['quét nhà', 'trick:sweep'], ['quet nha', 'trick:sweep'], ['quét dọn đi', 'trick:sweep'], ['tưới cây', 'trick:water'], ['tuoi cay di', 'trick:water'],
  ['thổi bong bóng', 'trick:bubbles'], ['bong bong', 'trick:bubbles'], ['nghe nhạc', 'trick:music'], ['nghe nhac di', 'trick:music'], ['bắt bướm', 'trick:butterfly'], ['bat buom', 'trick:butterfly'],
  ['vẽ', 'trick:draw'], ['vẽ tranh đi', 'trick:draw'], ['ngáp', 'trick:yawn'], ['ngáp một cái', 'trick:yawn'], ['xoay', 'trick:spin'], ['xoay vòng đi', 'trick:spin'], ['vẫy tay', 'trick:wave'], ['chào đi', 'trick:wave'],
  ['ghim', 'trick:pinfix'], ['ngó note', 'trick:peek'], ['ngo xem nao', 'trick:peek'], ['vươn vai', 'trick:stretch'], ['vuon vai di', 'trick:stretch'], ['nhảy', 'trick:hop'], ['nhảy nhảy đi', 'trick:hop'],
  ['nhìn quanh', 'trick:look'], ['nhìn', 'trick:look'],
  // focus / daily / summary / backup
  ['tập trung', 'focus:25'], ['tập trung 25 phút', 'focus:25'], ['tap trung 45p', 'focus:45'], ['tập trung 1 tiếng', 'focus:60'], ['focus 30', 'focus:30'], ['pomodoro', 'focus:25'], ['tập trung nửa tiếng', 'focus:30'],
  ['dừng tập trung', 'focusStop'], ['dung tap trung', 'focusStop'], ['hủy tập trung', 'focusStop'], ['thôi tập trung', 'focusStop'], ['kết thúc pomodoro', 'focusStop'],
  ['lặp hằng ngày', 'daily'], ['lap hang ngay', 'daily'], ['mỗi ngày làm lại', 'daily'], ['lặp lại mỗi ngày', 'daily'],
  ['bỏ lặp hằng ngày', 'dailyOff'], ['tắt lặp hàng ngày', 'dailyOff'], ['thôi lặp mỗi ngày', 'dailyOff'], ['dừng lặp hằng ngày', 'dailyOff'],
  ['tổng kết hôm nay', 'summary'], ['tong ket', 'summary'], ['tóm tắt hôm nay', 'summary'], ['hôm nay thế nào', 'summary'], ['báo cáo hôm nay', 'summary'],
  ['sao lưu', 'backup'], ['sao luu note', 'backup'], ['backup', 'backup'], ['lưu dự phòng', 'backup'],
  // câu gộp
  ['dọn dẹp rồi xếp note lại', { multi: ['cleanDone', 'arrange'] }], ['xếp note rồi dọn dẹp', { multi: ['arrange', 'cleanDone'] }], ['dọn dẹp và xếp note lại nhé', { multi: ['cleanDone', 'arrange'] }],
  ['xoá note này rồi hát', { multi: ['trashThis', 'trick:sing'] }], ['don dep, xep note, roi di ngu', { multi: ['cleanDone', 'arrange', 'sleep'] }], ['ẩn hết note rồi múa', { multi: ['hideAll', 'trick:dance'] }],
  ['dọn note trống rồi dọn note hết hạn', { multi: ['cleanEmpty', 'cleanExpired'] }], ['tập trung 25 phút rồi ngủ', { multi: ['focus:25', 'sleep'] }],
  // phủ định: không được chạy
  ['đừng xoá note này', 'negated'], ['dung xoa note nay', 'negated'], ['không cần dọn', 'negated'], ['ko cần dọn dẹp đâu', 'negated'], ['đừng đi ngủ', 'negated'], ['không xếp note nữa', 'negated'],
  ['khỏi dọn nhé', 'negated'], ['chưa cần xoá đâu', 'negated'], ['đừng ẩn note', 'negated'], ['không được xoá note này', 'negated'],
  // lỗi gõ / teencode
  ['dọn dẹp ko?', { unclear: ['cleanDone'] }], ['xoá cái này dc ko', { unclear: ['trashThis'] }], ['xoa not nay', 'trashThis'], ['dọn dẹ', 'cleanDone'], ['xep note lai nha', 'arrange'], ['sap xep not', 'arrange'], ['tap trun 25 phut', 'focus:25'],
  ['don dep nha', 'cleanDone'], ['nghe nhacj di', 'trick:music'],
  // sửa theo rà soát: nhắc bị phủ định / huỷ, phủ định sót, câu hỏi, từ trùng
  ['đừng nhắc tớ lúc 3h nữa', 'negated'], ['không cần nhắc lúc 5h', 'negated'], ['hủy nhắc 5h', 'cancelRemind'], ['bỏ nhắc lúc 3h', 'cancelRemind'], ['xoá nhắc lúc 3h', 'cancelRemind'],
  [{ t: 'nhắc tớ đừng quên họp lúc 3h' }, { kind: 'remind' }], [{ t: '🍵 nhắc tớ uống nước lúc 3h' }, { kind: 'remind' }],
  ['chưa xoá', 'negated'], ['tớ chưa muốn xoá note này', 'negated'], ['chẳng xoá', 'negated'], ['dừng xoá', 'negated'], ['khoan xoá', 'negated'], ['khoan đã xoá note này', 'negated'],
  ['có xoá note này không', { unclear: ['trashThis'] }], ['nên xoá note này không', { unclear: ['trashThis'] }], ['có nên dọn dẹp không', { unclear: ['cleanDone'] }],
  ['xoá thùng rác', 'openTrash'], ['xoá lặp hằng ngày', 'dailyOff'], ['dọn thùng rác', 'openTrash'], ['có việc gì không', 'knock'], ['dừng tập trung đi', 'focusStop'],
  // không chắc -> hỏi lại; không hiểu -> gợi ý
  // câu hỏi / giả định với lệnh phá hoại -> hỏi lại, không chạy
  ['dọn dẹp được không', { unclear: ['cleanDone'] }], ['dọn dẹp hả', { unclear: ['cleanDone'] }], ['dọn dẹp làm gì', { unclear: ['cleanDone'] }], ['tại sao dọn dẹp', { unclear: ['cleanDone'] }],
  ['xoá note này không nhỉ', { unclear: ['trashThis'] }], ['xoá note này à?', { unclear: ['trashThis'] }], ['nếu xoá note này thì sao', { unclear: ['trashThis'] }], ['xoá note này là sao', { unclear: ['trashThis'] }],
  ['ai bảo xoá note này', { unclear: ['trashThis'] }], ['dọn dẹp không', { unclear: ['cleanDone'] }], ['dọn dẹp?', { unclear: ['cleanDone'] }], ['sao lại dọn dẹp', { unclear: ['cleanDone'] }], ['giả sử xoá note này', { unclear: ['trashThis'] }],
  ['hủy xoá note này', 'negated'], ['huỷ xoá note này', 'negated'],
  // lệnh thường không được hỏng
  ['bé ơi dọn dẹp đi', 'cleanDone'], ['dọn dẹp giúp chị', 'cleanDone'], ['xoá note này nha', 'trashThis'], ['xoá note này nhé', 'trashThis'], ['dọn đi', 'cleanDone'], ['dọn dẹp ạ', 'cleanDone'],
  ['mở ra xem', 'unclear'], ['asdf qwer', 'unknown'], ['hôm qua trời mưa', 'unknown'], ['alo alo', 'unknown']
];
function runCmds() {
  for (const row of CMDS) {
    let text = row[0], e = row[1];
    if (typeof text === 'object') text = text.t;
    const c = C.parse(text, NOW), where = JSON.stringify(text), got = JSON.stringify(c);
    if (typeof e === 'string') {
      if (e.startsWith('unclear')) ok(c.kind === 'unclear' && c.options.length >= 1 && c.options.every(o => o.label && o.cmd && o.cmd.kind), 'CMD ' + where, got);
      else if (e === 'unknown') ok(c.kind === 'unknown' && Array.isArray(c.hints) && c.hints.length >= 2, 'CMD ' + where, got);
      else ok(sig(c) === e, 'CMD ' + where + ' (mong ' + e + ')', got);
    } else if (e.multi) {
      ok(c.kind === 'multi' && c.cmds.map(sig).join(',') === e.multi.join(','), 'CMD ' + where + ' (mong ' + e.multi.join('+') + ')', got);
    } else if (e.unclear) {
      ok(c.kind === 'unclear' && e.unclear.every(k => c.options.some(o => sig(o.cmd) === k)), 'CMD ' + where + ' (mong hỏi lại ' + e.unclear.join('/') + ')', got);
    } else {
      ok(c.kind === e.kind && (e.text === undefined || c.text === e.text), 'CMD ' + where + ' (mong ' + JSON.stringify(e) + ')', got);
    }
  }
}

// ---------------------------------------------------------------- C) DÒNG GỌI BÉ TRONG NOTE (src/note/command.js)
function loadCallRe() {
  const src = fs.readFileSync(path.join(root, 'src/note/command.js'), 'utf8');
  const win = { MochiNote: { editor: { addEventListener() {}, childNodes: [] } }, mochi: { antics: { command() {} } } };
  vm.runInNewContext(src, { window: win, document: { activeElement: null }, setTimeout, clearTimeout, console });
  return win.MochiCmdRe;
}
const CALLS = [
  // [dòng gõ, lệnh phải bắt được | null nếu là câu thường không được bắt]
  ['bé ơi, dọn dẹp', 'dọn dẹp'], ['bé ơi dọn dẹp', 'dọn dẹp'], ['Bé ơi xoá note này', 'xoá note này'], ['be oi xoa note nay', 'xoa note nay'], ['bé ói cái này xóa đi', 'cái này xóa đi'],
  ['bê ơi hát đi', 'hát đi'], ['mochi ơi, múa đi', 'múa đi'], ['Mochi ơi xếp note', 'xếp note'], ['mochi, dọn dẹp', 'dọn dẹp'], ['mochi: nghe nhạc', 'nghe nhạc'], ['@mochi hát', 'hát'],
  ['@bé xếp note lại', 'xếp note lại'], ['@be dọn dẹp', 'dọn dẹp'], ['- bé ơi dọn dẹp', 'dọn dẹp'], ['- [ ] bé ơi, hát', 'hát'], ['* mochi ơi múa', 'múa'],
  ['ê bé ơi dọn dẹp', 'dọn dẹp'], ['hey mochi ơi dọn dẹp đi', 'dọn dẹp đi'], ['bé mochi ơi, ngủ đi', 'ngủ đi'], ['BÉ ƠI DỌN DẸP', 'DỌN DẸP'],
  // câu thường: không được bắt
  ['bé ăn cơm lúc 6h', null], ['Bé: tiêm phòng 9h', null], ['Bé, mai đi học 7h', null], ['Em ơi mai họp lúc 9h nhé', null], ['Em ơi, dọn dẹp bàn giúp chị', null], ['cưng ơi ngủ đi', null], ['bé, dọn dẹp', null], ['bé đi học 7h', null], ['em đi chợ mua rau', null], ['em gái tôi sinh nhật', null], ['mochi là con mèo', null], ['cưng quá', null], ['bé ơi', null],
  ['ghi nhớ: bé ơi dọn dẹp', null], ['nhắc bé ơi uống sữa lúc 3h', null], ['hôm nay mochi ơi', null], ['bé Lan sinh nhật 20/10', null], ['em ơi', null]
];
function runCalls() {
  let re;
  try { re = loadCallRe(); } catch (e) { ok(false, 'CALL không nạp được note/command.js', String(e && e.message)); return; }
  if (Object.prototype.toString.call(re) !== '[object RegExp]') { ok(false, 'CALL note/command.js chưa xuất window.MochiCmdRe'); return; }
  for (const [line, want] of CALLS) {
    const m = re.exec(line.replace(/ /g, ' ').trim());
    const got = m && m[1] && m[1].trim() ? m[1].trim() : null;
    ok(got === want, 'CALL ' + JSON.stringify(line) + ' (mong ' + JSON.stringify(want) + ')', JSON.stringify(got));
  }
}

runNotes(); runCmds(); runCalls();
const total = pass + fail;
const nN = NOTES.length, nC = CMDS.length, nK = CALLS.length;
for (const f of failures) console.log('SAI  ' + f);
console.log(`\nNote: ${nN} câu · Lệnh bé: ${nC} câu · Dòng gọi bé: ${nK} câu`);
console.log(`ĐÚNG ${pass} / ${total}  (${(100 * pass / total).toFixed(1)}%)  ·  SAI ${fail}`);
process.exit(fail ? 1 : 0);
