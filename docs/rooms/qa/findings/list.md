## list — lượt 2 (main @70ebdd3, sau gộp paper Đợt 2 + notes Đợt 2B)
- Lệnh: `bash test/e2e/run.sh test/e2e/list.test.js` (~6 phút trên máy tải nặng). Kết quả: 14 test, 10 pass, 4 fail (3c, 3e, 3f, 3g), 0 skip. Chạy lại 2 lần, cùng kết quả.
- Lượt 1: list-3c đỏ vì "không có thùng rác". Lượt 2: giao diện đã đổi có chủ ý (docs/rooms/notes.md Đợt 2B: xoá = xoá mềm 30 ngày, chip "Thùng rác (N)", Khôi phục / Xoá hẳn / Dọn sạch xác nhận 2 bước, toast "Hoàn tác"). Ca 3c cũ chỉ là grep mã nguồn (xanh giả sau khi có thùng) nên đã VIẾT LẠI thành ca hành vi thật.
- Ca mới (kỳ vọng người dùng, theo luồng thùng rác):
  - 3c xoá từ danh sách -> chip Thùng rác (1) -> khôi phục: nội dung/html, màu, nhắc, cửa sổ mở lại ĐẠT; mẫu giấy KHÔNG còn (xem N-list-1) -> ĐỎ.
  - 3d xoá hẳn: bấm 1 lần chỉ đổi nút thành "Chắc chắn xoá hẳn?", lần 2 mới xoá; "Dọn sạch" 2 bước; thùng trống hiện trạng thái rỗng: ĐẠT.
  - 3e thùng nằm trong `mochi-data.json` (ngăn `trash`, `trashedAt`), còn sau khởi động lại, khôi phục được sau restart: phần dữ liệu ĐẠT; mẫu giấy mất (N-list-1) -> ĐỎ.
  - 3f xoá từ menu note cũng vào thùng; hộp xác nhận phải nói "thùng rác": dữ liệu vào thùng ĐẠT, chữ xác nhận SAI (N-list-3) -> ĐỎ.
  - 3g toast "Hoàn tác" sau khi xoá: bấm không được (N-list-2) -> ĐỎ.
- Các ca 1a/1b/1c/2/3a/3b/4/5/6 (ẩn/hiện tất cả, cất/mở, xoá có xác nhận, tìm không dấu, cập nhật trực tiếp, single instance): vẫn ĐẠT, không đổi selector.
- Ghi chú khung: nút Cất/Xoá chỉ bấm được khi hover; sau mỗi lần xoá phải chờ ~0,7s cho danh sách hết chuyển động (Playwright báo "element is not stable").

### N-list-1: Khôi phục note từ thùng rác làm mất mẫu giấy (ngăn `paper`)
- Mức: Vừa (mất tuỳ chỉnh giao diện, nội dung vẫn còn)
- Phòng: paper (nguyên nhân chính) + notes (khôi phục không giữ meta paper)
- Tái hiện: `bash test/e2e/run.sh test/e2e/list.test.js` -> `list-3c`, `list-3e`. Note có `paper.noteMeta[id].paper = 'student-grid'`, xoá từ danh sách, khôi phục từ thùng.
- Kỳ vọng: note về đủ nội dung, màu, mẫu giấy, nhắc (yêu cầu của điều hành).
- Thực tế: nội dung, màu, nhắc đủ; mẫu giấy mất (meta = null, note trở về giấy trơn).
- Nguyên nhân: src/main/paper/index.js:106-113 nghe `note:deleted` xoá `noteMeta[id]` vô điều kiện (trashService.js:56 phát `note:deleted` cho "module khác dọn" và chú thích "meta được giữ vì isTrashed" chỉ đúng với ngăn alarms/noteMeta của notes). Thêm: paper/index.js:~27 "dọn meta mồ côi" lúc khởi động xoá meta của note đang nằm trong thùng (hasNote chỉ tìm trong notes). Cũng không chép meta paper sang id mới khi `restoreId` đổi id (trashService.js:67).
- Ảnh: docs/rooms/qa/img/l2-list-khoi-phuc-mat-giay.png (ảnh lúc test đỏ), docs/rooms/qa/img/l2-list-thung-rac.png (thùng rác bình thường)
- Độ chắc: 3/3 lần.

### N-list-2: Nút "Hoàn tác" trong toast sau khi xoá không bấm được
- Mức: Vừa
- Phòng: notes (src/list)
- Tái hiện: `list-3g`. Xoá note từ danh sách, bấm "Hoàn tác" trên toast: Playwright báo `<footer class="bottombar"> intercepts pointer events`.
- Kỳ vọng: bấm "Hoàn tác" thì note về ngay (toast tồn tại 5s để bấm).
- Thực tế: `.toast { pointer-events: none }` và nút `.toast-act` không bật lại `pointer-events:auto`; ngoài ra toast (z-index 20, bottom 14px) nằm đè lên `.bottombar` nên chuột rơi xuống footer. Người dùng không hoàn tác được (phải vào thùng rác khôi phục tay).
- Nguyên nhân: src/list/list.css:335-339 (`pointer-events: none`), :375 (`.toast .toast-act` thiếu `pointer-events:auto`).
- Ảnh: docs/rooms/qa/img/l2-ux-thung-rac-toast.png (phòng ux, cùng hiện tượng)
- Độ chắc: 2/2 lần.

### N-list-3: Hộp xác nhận xoá trong cửa sổ note vẫn ghi "xoá hẳn, không khôi phục được"
- Mức: Vừa (sai thông tin, làm người dùng sợ xoá/không biết có thùng rác)
- Phòng: paper (src/note/note.html; notes đã gửi đề nghị đổi chữ trong docs/rooms/notes.md Đợt 2B)
- Tái hiện: `list-3f`: mở menu "..." -> "Xoá note" -> hộp "Xoá note này? Note sẽ bị xoá hẳn, không khôi phục được." -> Xoá -> note vào thùng (khôi phục được 30 ngày).
- Kỳ vọng: "Chuyển vào thùng rác? Khôi phục được trong 30 ngày".
- Nguyên nhân: src/note/note.html:109-110 (chữ cũ), nút "Xoá" nên là "Bỏ vào thùng".
- Độ chắc: 2/2 lần.

### Quan sát nhẹ
- Trong danh sách chính chữ là "Chuyển vào thùng rác?" / "Bỏ vào thùng" (đúng); chỉ cửa sổ note còn chữ cũ.
