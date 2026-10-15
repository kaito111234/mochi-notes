## reminder — lượt 3 (main sau Đợt 3, nhánh room/qa)
- Lệnh: `bash test/e2e/run.sh test/e2e/reminder.test.js` (~4 phút). Kết quả: 19 test, **17 pass, 2 fail** (ca 7 và ca 7c mới). Các ca khác (1, 1b, 2a-c, 3, 4, 5, 6, 7b, 8) xanh; BUG-012 và BUG-025 trên main: **ĐÃ SỬA** (ca 1b, ca 8 xanh).
- Ca 7 đỏ 4/4 lần (full log + 2 lần chạy lại + 1 lần chạy chẩn đoán). Ca 7c (mới, tất định hơn) đỏ 1/1.

### N-reminder-2 (ca 7): Xong nhắc 1 làm MẤT nhắc 2 của cùng note đang xếp hàng trên sân khấu
- Mức: **Nặng** (nhắc không hiện; chỉ còn thông báo "nhắc dai" sau khi quá hạn) — Phòng: core (`src/main/pet/mascotWindow.js:27` `dropNote`, `:13` `sameNote`, `:45-46` nghe `reminder:done`/`reminder:snoozed`)
- Nguyên nhân (đã dò bằng test chẩn đoán): khi nhắc 1 đang lên sân khấu mà nhắc 2 của CÙNG note tới hạn, nhắc 2 vào hàng đợi (`fired=true`). Bấm Xong nhắc 1 -> `completeNote` phát `reminder:done {noteId, reminderId}` -> `noteResolved` gọi `dropNote(noteId)` -> `stage.cancelWhere(sameNote)` huỷ MỌI mục sân khấu của note, bỏ qua `reminderId`. Hàng đợi về 0, nhắc 2 `fired=true, done=false` mãi mãi, bé không bao giờ nói. Không phải do bé bận nói, không phải do đổi tên kind/payload. Không đổi ở Đợt 3: lỗi cũ từ Đợt 1 (`fd1e8c4`) nhưng lộ ra vì vòng nhắc mới ngủ tới mốc kế (trần 15 s) làm hai nhắc hay chín cùng một nhịp tick; lượt 2 ca 7 xanh do hai nhắc cách nhau đủ xa.
- Cũng liên quan: `src/main/pet/stage.js:271-ish` `validItem` chỉ xét `n.reminder` (nhắc chính) chứ không xét `item.payload.reminderId`; và `stage.js:279/291` `completeNote(p.noteId)` / `snoozeNote(p.noteId, 10)` không truyền `reminderId` (xong/hoãn nhầm nhắc chính thay vì nhắc đang hiện). Đề xuất: `dropNote` nhận `reminderId` (chỉ huỷ mục cùng reminderId; không có reminderId mới huỷ cả note), và truyền `p.reminderId` vào `completeNote/snoozeNote`.
- Tái hiện: `bash test/e2e/run.sh test/e2e/reminder.test.js` (ca 7 và 7c). Ca 7c: 2 nhắc cùng note, due +2 s / +4 s, `wakeReminderLoop()`, chờ nhắc 2 `fired`, bấm Xong nhắc 1 -> chờ nhắc 2 lên sân khấu: hết giờ.
- Kỳ vọng: nhắc 2 lên sân khấu ngay sau nhắc 1. Thực tế: `stage.current()=null, size()=0`, nhắc 2 `fired=true done=false`, chip note "quá hạn N giây".
- Ảnh: `docs/rooms/qa/img/l3-reminder-2gio-sat-LOI.png`.

---

## reminder — lượt 2 (main @20ec6c9, notes Đợt 2)
- Lệnh: `bash test/e2e/run.sh test/e2e/reminder.test.js` (~4 phút). Kết quả: 17 test (kể cả 6 subtest ca 1): **13 pass, 4 fail** (subtest "thứ 6 tuần sau 10h30 họp", "nửa tiếng nữa uống thuốc", ca cha 1, ca 1b) + ca 8 (BUG-025) đỏ chạy riêng -> tổng thực tế 5 đỏ (3 lỗi thật: N-reminder-1, BUG-009, BUG-012, BUG-025).
- Ca "họp 3h chiều nay", "gọi khách 2 phút nữa", "mai 9h", "8h tối nay", Xong/Hoãn/Mở note, note ẩn vẫn nhắc, nhắc lặp mỗi sáng, thông báo dự phòng khi bé tắt, hai nhắc xếp hàng: ĐỀU XANH.
- Ca mới 7 (một note 2 giờ "họp 1 phút nữa / gọi khách 3 phút nữa"): XANH — `reminders[]` có 2 phần tử id khác nhau, `note.reminder` = nhắc gần nhất, Xong nhắc 1 không đụng nhắc 2, nhắc 2 lên sân khấu với `reminderId` đúng, file dữ liệu có đủ 2 nhắc. Ca 7b (note cất `visible=false`, 2 nhắc): XANH, cả hai fired, bé nhắc, note không tự bật.
- Ca mới 8 (BUG-025): ĐỎ.
- Ảnh: `docs/rooms/qa/img/l2-reminder-*` (không có: chip không hiện cho các ca đỏ; ca xanh chỉ ghi ở test/e2e/out).

### N-reminder-1: "thứ N tuần sau HHhMM" không tạo nhắc trong note (parse đúng nhưng `understand` bỏ mất)
- Mức: Nặng — Phòng: notes (`src/shared/understand/index.js`, `ownTime` dòng 87 / `whenOf` dòng 322)
- Tái hiện: `bash test/e2e/run.sh test/e2e/reminder.test.js` subtest "thứ 6 tuần sau 10h30 họp"; hoặc `TZ=Asia/Ho_Chi_Minh node -e "const u=require('./src/shared/understand/index.js');console.log(u.understand('thứ 6 tuần sau 10h30 họp',Date.now()).items.length)"` -> 0 (còn `parse.analyze` trả due 23/10 10:30 đúng, `tuần sau 10h30 họp` và `thứ 6 10h30 họp` đều ra 1 item).
- Kỳ vọng: nhắc 23/10 10:30 (+ chip). Thực tế: không có reminder, không chip. BUG-003 (sai +6 tuần) đã hết ở `parse.js` nhưng bị thay bằng "mất hẳn nhắc" ở đường mới của note (Đợt 2 dùng `understand().items`, không dùng `analyze`).
- Độ chắc: 3/3.

### Trạng thái lỗi cũ
- BUG-009 CÒN (unit `test/unit/parse.test.js` "nửa tiếng nữa", "nua tieng nua", "1h30 nữa họp" vẫn đỏ; E2E subtest "nửa tiếng nữa uống thuốc": không reminder).
- BUG-012 CÒN: giờ 20h, "họp 3h chiều nay" -> `reminder=null`, chip ẩn (ca 1b đỏ, in `# 1b: reminder=null chip={"hidden":true}`).
- BUG-025 CÒN: "gọi khách 2 phút nữa" -> `lead=300000`, chip "06:17 hôm nay · báo trước 5 phút" (hạn còn 2 phút). Ca 8.
