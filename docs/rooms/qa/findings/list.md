## list — lượt 3 (main mới, notes Đợt 3 đổi giao diện danh sách)
- Lệnh: `bash test/e2e/run.sh test/e2e/list.test.js`. Kết quả: 15 test, 11 pass, 4 fail (3c, 3e, 3f, 3g đều là lỗi cũ). Chạy 2 lần: lần 1 (trước sửa) còn thêm list-2 và 3d đỏ do bấm/chờ không ổn định.
- list-2 (ĐỎ MỚI -> sửa test, kèm lỗi nhẹ N-list-4): thẻ mới có hàng nút `.actions` (Chi tiết, Cất đi, Xoá) hiện khi rê chuột, nằm tuyệt đối góc phải trên. Playwright bấm GIỮA `.card-body` -> rê chuột làm hiện nút, nút "Chi tiết" nằm đúng giữa thẻ (cửa sổ 420px) nên chặn click (`<button data-act="expand"> intercepts pointer events`, ảnh test/e2e/out/list-2-LOI.png). Đổi test: bấm vào `.card-title` (nơi người dùng thật bấm), kỳ vọng giữ nguyên (mở lại về đúng vị trí cũ 120). Thêm helper `settle()` chờ thẻ đứng yên (3d cũng từng đỏ "element is not stable" khi tải nặng, nay xanh).
- N-list-4 (Nhẹ, notes, src/list/list.css:127-130 + list.js:~297 `acts.append(more, toggle, del)`): nút hover phủ giữa thẻ khi cửa sổ hẹp; bấm vào giữa thẻ mở "Chi tiết" thay vì mở note. Gợi ý: đặt nút hover ở hàng riêng/hạn chế bề rộng, hoặc bấm vào thẻ ở vùng giữa vẫn mở note.
- Ca đỏ cũ, nguyên nhân VẪN NHƯ CŨ (không sửa cho xanh):
  - 3c, 3e = BUG-035 (N-list-1): "mất mẫu giấy sau khi khôi phục: null". src/main/paper/index.js:106-110 (`note:deleted` xoá `noteMeta[id]`) và :37 (dọn meta mồ côi khi khởi động) vẫn y như cũ (dòng 106-113 -> 106-110, ~27 -> 37).
  - 3g = BUG-036 (N-list-2): footer `.bottombar` chặn click "Hoàn tác"; src/list/list.css:337-340 (`.toast {... pointer-events:none}`), :377 `.toast .toast-act` vẫn thiếu `pointer-events:auto`.
  - 3f = BUG-037 (N-list-3): hộp xác nhận ở cửa sổ note vẫn "Xoá note này? Note sẽ bị xoá hẳn, không khôi phục được." (src/note/note.html:110).
- Kiểm theo bảng notes (ca MỚI list-l3-1, XANH 2/2): BUG-027 ĐÃ SỬA THẬT: chip "Đang hiện 3 / Đã cất 0 -> Đã cất 1", nút thẻ "Cất đi" -> "Hiện lên" sau khi cất, không còn "Đang dán/Đang cất". BUG-028 (phần giao diện danh sách) ĐÃ SỬA: toàn văn + tooltip của danh sách không có "tớ/cậu" (assert regex). Ảnh: docs/rooms/qa/img/l3-list-dang-hien-da-cat.png.

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
