# Phòng 6 — Kiểm thử (`room/qa`)

**Sứ mệnh**: chủ dự án đặt ưu tiên số 1: **app note phải hoạt động tốt**. Phòng này dùng app như người dùng thật, tìm lỗi và ghi lại rõ ràng để phòng phụ trách sửa. Phòng **không sửa code** của phòng khác.
Đọc trước: `CLAUDE.md`, `docs/spec/*`, mục Trạng thái của mọi `docs/rooms/*.md`, `SPEC.md`.

## Đợt 2 — việc cần giao
1. **Khung test E2E** trong `test/e2e/` điều khiển app thật dưới xvfb (ưu tiên `playwright-core` `_electron` — ghi đề xuất thêm devDependency cho điều hành; trong lúc chờ có thể cài tạm `npm i --no-save`). Dữ liệu thử cô lập (`XDG_CONFIG_HOME` tạm).
2. **Kịch bản bắt buộc** (mỗi cái 1 test, có ảnh khi lỗi):
   - Tạo note (phím tắt + nút +), gõ tiếng Việt có dấu (Telex/Unicode dán vào), đóng app, mở lại → nội dung, vị trí, kích thước, màu còn nguyên.
   - Định dạng: đậm/nghiêng/gạch/danh sách/tô sáng; undo/redo; tìm Ctrl+F; dán ảnh; cỡ chữ; khoá.
   - Ẩn/hiện tất cả; cất note; mở từ danh sách; xoá + khôi phục từ thùng rác/thùng của bé; tìm trong danh sách có/không dấu.
   - Nhắc lịch: "họp 3h chiều nay", "gọi khách 2 phút nữa" → chip đúng; tới giờ bé hiện; Xong / Hoãn / Mở note đúng; note bị ẩn vẫn nhắc; nhắc lặp "mỗi sáng 8h" (giả lập đồng hồ nếu được, nếu không thì kiểm logic qua module).
   - Báo thức 1 phút; dặn dò khi mở máy; nhập/xuất JSON; khôi phục bản sao lưu.
   - 30 note cùng lúc: thời gian khởi động, RAM tổng (ghi số), không treo.
   - File dữ liệu hỏng → app vẫn mở, có bản `.bak`.
3. **Rà soát trải nghiệm** (đọc giao diện qua ảnh chụp): chữ tiếng Việt đúng chính tả, nút dễ hiểu, chồng lấn cửa sổ (chuông báo thức với bé), chỗ nào khó dùng so với Sticky Notes.
4. Ghi lỗi vào `docs/rooms/qa/BUGS.md`: mỗi lỗi có mã `BUG-###`, mức (Chặn / Nặng / Vừa / Nhẹ), **phòng phụ trách** (theo `docs/spec/00-ownership.md`), bước tái hiện, kỳ vọng, thực tế, ảnh.

## Tiêu chí nghiệm thu
- `test/e2e` chạy được bằng một lệnh (ghi trong trạng thái), kịch bản ở mục 2 đều có.
- `BUGS.md` có danh sách ưu tiên; 5 lỗi nặng nhất có ảnh.

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
