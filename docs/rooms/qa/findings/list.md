## list — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/list.test.js` — 10 test: 9 pass, 1 fail (list-3c), 0 skip. Chạy 2 lần, kết quả như nhau.
- Ghi chú khung: nút Cất/Xoá trong list.html chỉ bấm được khi rê chuột vào thẻ (opacity 0 + pointer-events none) nên test phải `hover` trước — đúng hành vi người dùng thật, không phải lỗi.
- Kết quả theo kịch bản: (1) Ctrl+Alt+H, menu khay Ẩn/Hiện tất cả, allHidden lưu và còn sau khi mở lại: ĐẠT. (2) Cất bằng X, mở lại từ list đúng vị trí cũ: ĐẠT. (3) Xoá từ list và từ menu note đều có xác nhận (ĐẠT); khôi phục: KHÔNG CÓ (F-list-1). (4) Tìm "hop", "Họp", "HỌP", "HOP", "đi", "di", "ĐI", "DI CHO" đều thấy đúng note; không khớp thì hiện trạng thái rỗng: ĐẠT. (5) List cập nhật trực tiếp khi note đổi nội dung/màu/xoá: ĐẠT. (6) Ctrl+Alt+L và mở lần 2/3 chỉ có 1 cửa sổ list: ĐẠT.

### F-list-1: Không có thùng rác / khôi phục note đã xoá
- Mức: Nặng
- Phòng: notes
- Tái hiện: `bash test/e2e/run.sh test/e2e/list.test.js` -> test `list-3c` đỏ. Thủ công: xoá note từ list hoặc menu note, không có chỗ nào để lấy lại.
- Kỳ vọng: nghiệm thu có "xoá + khôi phục": note xoá vào thùng (thùng của bé), khôi phục được trong một thời gian.
- Thực tế: xoá là xoá hẳn; hộp thoại ghi "Note sẽ bị xoá hẳn, không khôi phục được." Chỉ có khôi phục từ bản sao lưu toàn bộ dữ liệu (list.html, mục "Khôi phục từ bản sao lưu"), không phải khôi phục từng note.
- Nguyên nhân khả dĩ: src/main/notes/noteService.js:107-116 (`deleteNote` splice thẳng khỏi `store.data.notes`, không có ngăn `deleted`/thùng); src/note/note.html:97 (câu cảnh báo); src/list/list.js (không có tab/chip thùng rác).
- Ảnh: không cần
- Độ chắc: đã tái hiện 2/2 lần (cộng đọc code)

### Quan sát nhẹ (không tính lỗi)
- Nút Cất/Xoá trong thẻ danh sách ẩn cho tới khi rê chuột/focus (src/list/list.css:123-126): trên màn hình cảm ứng khó thấy. Ảnh tham khảo tìm kiếm: docs/rooms/qa/img/list-tim-kiem.png
