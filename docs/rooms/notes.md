# Phòng 2 — Note & nhắc lịch (`room/notes`)

**Sứ mệnh**: mọi thứ người dùng ghi và mọi lời nhắc phải **đầy đủ như Sticky Notes và đáng tin tuyệt đối**: báo thức, nhắc lặp lại, dặn dò.
Đọc trước: `CLAUDE.md`, `docs/spec/*.md` (00, 01, 02), code `src/main/notes/*`, `src/note/*`, `src/list/*`, `src/shared/parse.js`.
File được sửa: xem `docs/spec/00-ownership.md` (dòng notes).

## Đợt 1 — việc cần giao
1. **Báo thức** (`src/main/alarms/`, ngăn `alarms`): tạo/sửa/xoá/bật tắt; một lần hoặc lặp (hằng ngày, ngày thường, chọn thứ trong tuần, hằng tháng); nhãn; âm báo (3 âm tổng hợp sẵn + chọn file âm thanh của người dùng); hoãn N phút; tính `nextAt` chính xác (DST không có ở VN nhưng vẫn dùng giờ địa phương đúng cách), bù khi máy ngủ dậy (kêu ngay nếu lỡ trong ≤ 30 phút, quá thì ghi "đã lỡ"). Phát `alarm:ring` và gọi `ctx.pet.enqueue({type:'alarm', ...})` (hoặc `ctx.pet.stage` khi phòng core đã có) — nếu bé tắt thì thông báo Windows có nút.
2. **Giao diện báo thức & dặn dò**: thêm tab trong cửa sổ danh sách (`src/list`) hoặc cửa sổ riêng `src/alarms/` — danh sách báo thức kiểu đồng hồ Windows (giờ to, công tắc, ngày lặp), form tạo nhanh; mục dặn dò.
3. **Dặn dò** (Memo): "khi mở máy", "buổi sáng/trưa/tối", "trước khi tắt máy" (bắt `session-end`/`before-quit`), lặp theo ngày; phát `memo:due`.
4. **Nhắc lặp cho note**: `reminder.repeat` (01-data.md). Hiểu tiếng Việt: "mỗi sáng 8h", "8h sáng hằng ngày", "thứ 2 hàng tuần", "các ngày trong tuần 9h", "ngày 5 hàng tháng", "mỗi 2 tiếng" (nếu làm được). Tạo `src/shared/recur.js` (thuần JS, có test) — **không sửa `parse.js`**; nếu cần đổi parse.js thì ghi đề xuất.
5. **Sticky note còn thiếu so với Windows**: tìm kiếm trong note, Ctrl+Z/Y chắc chắn, kéo thả ảnh ổn định, cỡ chữ (Ctrl +/−), chế độ chỉ đọc khi khoá, nhập/xuất (JSON + file .txt/.md), khôi phục từ bản sao lưu (`userData/backups`).
6. Kiểm thử: test logic thuần cho `recur.js` và tính `nextAt` (ít nhất 30 ca, có ca qua nửa đêm, cuối tháng, tháng 2, năm nhuận).

## Tiêu chí nghiệm thu (ảnh xvfb vào `docs/rooms/notes/`)
- Ảnh giao diện báo thức và dặn dò; báo thức thử 1 phút kêu được (bé hiện hoặc thông báo).
- `node test/...` của phòng chạy xanh (để test trong `src/shared/__tests__/` hoặc ghi đề xuất cho qa).
- Không làm hỏng luồng note 0.1.

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
