# Phòng 3 — Giấy & giao diện note (`room/paper`)

**Sứ mệnh**: note của Mochi phải **đẹp và khác Sticky Notes**: như những xấp giấy note dễ thương ngoài đời (giấy lốm đốm, kẻ ngang, ô ly, checklist, có hình thú vẽ tay ở góc), nhiều mẫu để chọn — nhưng vẫn **dùng nhanh, chắc chắn** như Sticky Notes.
Đọc trước: `CLAUDE.md`, `docs/spec/*`, code `src/note/*` (đã có: định dạng chữ, tìm kiếm, undo/redo, ảnh, cỡ chữ, khoá, chip nhắc, panel nhắc — **phải giữ hết**), `docs/rooms/notes/API.md`.
Cảm hứng người dùng gửi: xấp note giấy kem lốm đốm mực, ô vuông, kẻ dòng, checklist ô tick, đầu giấy có chữ "Notes"/"Memo"/"Checklist" viết tay và thú nhỏ (gấu, cún đeo tai nghe, mèo). **Không dùng nhân vật có bản quyền** (Hello Kitty, Sanrio, Disney…) — tự vẽ thú nguyên bản bằng SVG.

## Đợt 2 — việc cần giao
1. **Hệ mẫu giấy** `assets/paper/<id>/paper.json` + SVG/CSS: nền (màu, vân giấy, lốm đốm mực, kraft, pastel gradient), kiểu dòng (trơn, kẻ ngang, ô vuông, ô ly kiểu vở Việt Nam, chấm bi, lề đỏ), tiêu đề in sẵn (Notes / Memo / To do / Checklist / Hôm nay…), trang trí (thú góc giấy, băng dính washi, ghim, kẹp giấy, mép xé, góc gập), màu chữ hợp nền. **Tối thiểu 16 mẫu** chia nhóm: Dễ thương, Học sinh, Tối giản, Văn phòng, Mùa/lễ (Tết, Trung thu, Giáng sinh). Chữ trên giấy phải thẳng hàng với dòng kẻ (line-height khớp lưới).
2. **Bộ chọn mẫu**: trong menu "…" của note (lưới xem trước nhỏ, rê chuột xem thử ngay trên note), mẫu mặc định cho note mới (lưu trong ngăn `paper`, gửi qua `api.paper`). Giữ 7 màu cũ như một nhóm "Trơn".
3. **Thú trang trí nguyên bản** (SVG vẽ tay, nét đậm dễ thương): mèo đen (bé Mochi thích mèo), gấu, thỏ, cún tai nghe, viên mochi, ít nhất 10 hình; tuỳ chọn ẩn trang trí.
4. **Chế độ checklist**: dòng bắt đầu "- [ ]"/"[]"/"-" bật thành ô tick thật (bấm tick, gạch ngang, đếm "3/5"), thêm dòng bằng Enter, kéo đổi thứ tự; tick phát IPC để main phát bus `note:checkItem {noteId, index, done}` (đề xuất cho điều hành nếu cần kênh mới — dùng `api.paper` + `src/main/...` thuộc điều hành thì ghi đề xuất; tạm thời có thể chỉ cập nhật nội dung).
5. **Phông chữ offline** có tiếng Việt, giấy phép OFL, đặt trong `assets/fonts/` (tải từ npm `@fontsource/*` rồi chép file woff2, ghi giấy phép): ít nhất 1 chữ viết tay (Itim/Pangolin/Mali…), 1 chữ tròn (Nunito/Baloo 2), 1 chữ thường (Be Vietnam Pro). Chọn phông theo mẫu, người dùng đổi được.
6. **Hình dạng note**: vuông, chữ nhật đứng, mini (memo nhỏ), bóng đổ giấy thật, xoay nghiêng nhẹ tuỳ chọn. Giữ tuỳ chọn nền kính.
7. **Hiển thị gợi ý từ "hiểu note"** khi phòng notes cung cấp API (xem docs/rooms/notes.md Đợt 2): dải gợi ý nhỏ cuối note ("Bé thấy 2 việc có giờ — tạo nhắc?"); nếu API chưa có thì để sẵn chỗ và kiểm tra `window.mochi.alarms?.insight`.

## Tiêu chí nghiệm thu (ảnh xvfb trong `docs/rooms/paper/`)
- Ảnh lưới 16+ mẫu; 3 note thật trên màn hình ở 3 mẫu khác nhau có chữ tiếng Việt; checklist đang tick; bộ chọn mẫu.
- Mọi chức năng cũ của note vẫn chạy (gõ, định dạng, nhắc lịch, tìm, undo, khoá, ảnh). Note 0.1 cũ mở lên không lỗi (mẫu mặc định = màu cũ).
- Không dùng tài nguyên có bản quyền; ghi nguồn + giấy phép phông chữ trong `assets/fonts/LICENSES.md`.

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
