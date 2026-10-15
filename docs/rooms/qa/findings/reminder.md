## reminder — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/reminder.test.js` (~110 giây). Kết quả: 15 test (tính cả 6 subtest ca 1): **11 pass, 4 fail (2 subtest ca 1, ca 1b là test cha của ca 1), 0 skip**. Thực chất 3 lỗi thật.
- Giờ tất định: `launchAt(hour)` chọn TZ `Etc/GMT±N` để giờ địa phương của app ~ hour (6h sáng cho ca gõ giờ, 14h cho ca lặp, 20h cho ca "quá giờ"). Giờ kỳ vọng tính tay trong main bằng `new Date(y,m,d,h,mi)` (không dùng parse.js).
- Notification: bọc `Notification.prototype.show` trong main. Linux/xvfb không có dbus nên `Notification.isSupported()=false`; test ép `true` để kiểm đường gọi (Windows thật luôn true). Đây là giới hạn môi trường, không phải lỗi app.
- Ca "quá giờ" (ghi theo yêu cầu): lúc 20h gõ "họp 3h chiều nay" -> không tạo reminder, không chip, không báo gì (xem F-reminder-3). Ca 1 giờ còn sớm (6h): đúng 15:00 hôm nay.
- Chạy được/đạt: chip "họp 3h chiều nay", "gọi khách 2 phút nữa", "mai 9h nộp báo cáo", "8h tối nay" (due + chip đúng); tới giờ bé hiện, bong bóng có Xong/Hoãn/Mở; Xong -> done=true; Hoãn -> due+10', fired=false; Mở note (note đang cất) -> visible=true, cửa sổ hiện; note ẩn vẫn nhắc đúng giờ (trễ <6s); "mỗi sáng 8h" -> repeat daily, due 08:00 hôm sau, Xong -> due nhảy về 08:00 hôm sau, done=false; bé tắt -> có Notification dự phòng (tiêu đề = tên note); hai nhắc cùng lúc xếp hàng 1 đang diễn + 1 chờ, bấm Xong lần lượt đều xong, không mất.
- Lưu ý khung: ca "Mở note" từng flaky do test kiểm `isVisible()` quá sớm (đã sửa bằng chờ), không phải lỗi app.

### F-reminder-1: "thứ 6 tuần sau 10h30 họp" bị hiểu thành "6 tuần sau" (mất giờ)
- Mức: Nặng
- Phòng: notes
- Tái hiện: gõ "thứ 6 tuần sau 10h30 họp" vào note (hoặc `node -e "console.log(new Date(require('./src/shared/parse.js').analyze('thứ 6 tuần sau 10h30 họp', Date.now()).due))"`). Test đỏ: `reminder.test.js` ca 1, subtest "thứ 6 tuần sau 10h30 họp".
- Kỳ vọng: thứ Sáu của tuần sau lúc 10:30 (hôm nay 15/10/2026 -> 23/10 10:30). Thực tế: due = hiện tại + 6 tuần (26/11/2026, giờ lệch theo lúc gõ), chip hiện sai ngày. Tương tự "thứ 2 tuần sau 9h" -> +2 tuần, "thứ 5 tuần sau 9h" -> +5 tuần. Dạng chữ "thứ sáu tuần sau" thì đúng.
- Nguyên nhân khả dĩ: `src/shared/parse.js:40` — regex tương đối `(\d+)\s*(...|tuần)\s*(nữa|sau|tới)` khớp "6 tuần sau" trong "thứ 6 tuần sau" trước khi xét thứ trong tuần (dòng 51+). Cần loại trường hợp đứng sau "thứ"/"t" (lookbehind) hoặc xét "thứ N" trước.
- Ảnh: docs/rooms/qa/img/reminder-chip-t6-sai.png
- Độ chắc: đã tái hiện 4/4 (3 lần chạy E2E + module).

### F-reminder-2: "nửa tiếng nữa" / "1 tiếng rưỡi nữa" không được hiểu
- Mức: Vừa
- Phòng: notes
- Tái hiện: gõ "nửa tiếng nữa uống thuốc"; test đỏ: ca 1, subtest "nửa tiếng nữa uống thuốc". Module: `analyze('nửa tiếng nữa uống thuốc').due === null`; "1 tiếng rưỡi nữa" cũng null.
- Kỳ vọng: due = bây giờ + 30 phút (và 90 phút cho "1 tiếng rưỡi"). Thực tế: không có reminder, không chip, không báo gì.
- Nguyên nhân khả dĩ: `src/shared/parse.js:40` — regex tương đối bắt buộc có chữ số (`\d+`), không có "nửa/rưỡi".
- Ảnh: không cần (chip không hiện).
- Độ chắc: đã tái hiện 4/4.

### F-reminder-3: giờ trong chữ đã qua ("3h chiều nay" lúc 20h) -> im lặng, không báo gì
- Mức: Vừa
- Phòng: notes (chip hiển thị: paper)
- Tái hiện: giờ máy 20:00, gõ "họp 3h chiều nay". Test đỏ: `reminder.test.js` ca 1b (kỳ vọng: hoặc nhắc 15:00 ngày mai, hoặc chip báo "đã qua"; không im lặng).
- Kỳ vọng: người dùng được phản hồi (vd chip "15:00 hôm nay đã qua" hoặc tự đặt ngày mai). Thực tế: `reminder=null`, chip ẩn, note không có dấu hiệu nào — người dùng tưởng đã được nhắc.
- Nguyên nhân khả dĩ: `src/shared/parse.js:73-77` (có "nay" -> giữ nguyên ngày hôm nay, giờ trong quá khứ) và `src/main/notes/scheduler.js:131` (`a.due > now` mới tạo reminder, ngược lại trả null).
- Ảnh: docs/rooms/qa/img/reminder-qua-gio-im-lang.png
- Độ chắc: đã tái hiện 3/3. Ghi chú: đây là quyết định thiết kế cần chốt; mức Vừa vì "nhắc lịch không báo" từ góc nhìn người dùng.

### Nhận xét nhỏ (không lập mã)
- Chip "gọi khách 2 phút nữa" ghi "báo trước 5 phút" dù hạn chỉ còn 2 phút (lead mặc định 5' của intent `call`, `preFired` đã true nên không có lần báo trước) — dễ gây hiểu nhầm, mức Nhẹ (`parse.js` `leadFor` / chip trong `src/note/note.js:~384`).
- Ảnh tham khảo luồng đạt: docs/rooms/qa/img/reminder-due-stage.png, reminder-hai-nhac.png.
