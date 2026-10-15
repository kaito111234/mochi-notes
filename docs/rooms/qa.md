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
_Cập nhật 2026-10-15 — lượt 1 (Đợt 2)._ Thử trên `main` @ f84c7b4.

**Đã xong**
- Khung E2E `test/e2e/lib/app.js` (playwright-core `_electron`, dữ liệu cô lập `XDG_CONFIG_HOME` tạm, ảnh tự động khi lỗi) + `lib/hook.js` nạp bằng `electron -r` để lấy `ctx`, gọi phím tắt toàn cục và bấm menu khay (xvfb không gửi được phím toàn cục, không có xdotool).
- Đủ kịch bản bắt buộc mục 2: `note-persist`, `note-format`, `list`, `reminder`, `alarm-memo`, `data`, `perf`, `ux-shots` (chụp ~45 màn hình), `smoke`. Test logic `test/unit/` (stage, parse ~100 câu, store, recur; chạy 2 múi giờ).
- `docs/rooms/qa/BUGS.md`: 31 lỗi xếp ưu tiên, 8 lỗi Nặng đều có ảnh/lệnh tái hiện và đã được trưởng phòng tự tái hiện. Báo cáo chi tiết từng nhóm: `docs/rooms/qa/findings/*.md`; ảnh: `docs/rooms/qa/img/`.

**Lệnh chạy test**
- Toàn bộ E2E (~20 phút, có ca chờ báo thức thật và đo hiệu năng): `bash test/e2e/run.sh`
- Một nhóm: `bash test/e2e/run.sh test/e2e/note-format.test.js` · nhanh: bỏ `perf` và `alarm-memo`; perf rút gọn `PERF_RUNS=1 PERF_IDLE_MS=5000`.
- Logic: `node test/unit/run.js` (TZ Asia/Ho_Chi_Minh + America/New_York).
- `run.sh` tự cài tạm `playwright-core@1.48.2 --no-save` nếu thiếu. Ảnh ra `test/e2e/out/` (không commit).

**Kết quả lượt này**: E2E 84 test — đỏ 10 (đều là lỗi thật: data 3b/3c, note-format 1c, list 3c, note-persist 1a/1b, reminder ca 1 gồm 3 ca con + ca cha); unit 183/múi giờ — đỏ 30 (29 parse + 1 store).

**Lỗi theo mức**: 0 Chặn · 8 Nặng · 14 Vừa · 9 Nhẹ.
**Theo phòng chính**: notes 16 (6 Nặng: parse.js nhắc rác/sai giờ ×4, thiếu thùng rác) · điều hành 6 (2 Nặng: store.js file hỏng) · paper 5 (1 Nặng: tô sáng mất) · core 4.

**Chưa kiểm được** (cần Windows thật): âm thanh, toast Windows, acrylic, kéo-nhấc bé bằng chuột thật, DPI/đa màn hình, bộ cài; RAM thật khi 30 note.

**Việc tiếp theo**
1. Khi các phòng sửa: chạy lại test đỏ tương ứng, đóng lỗi trong BUGS.md.
2. Thêm assert vị trí cửa sổ (chuông/popup/bé không chồng nhau) để BUG-013/015 thành test đỏ.
3. Bộ cài NSIS + chạy thử bản đóng gói (`build/**`), đo hiệu năng trên Windows.
4. Ca E2E cho tính năng Đợt 2 của notes/core/paper khi gộp (nhiều nhắc/note, mẫu giấy).

## Đề xuất cho phòng điều hành
1. `package.json` devDependencies: thêm `"playwright-core": "1.48.2"`; scripts: `"test:e2e": "bash test/e2e/run.sh"`, `"test:unit": "node test/unit/run.js"`. Đề nghị CHƯA đưa `test:unit` vào `npm test` cho tới khi notes sửa parse.js (đang đỏ 29 ca có chủ đích).
2. (Đã kiểm: `build.files` chỉ lấy `src/`, `assets/`, `package.json` nên `test/` không vào gói — không cần sửa.)
3. `store.js` (BUG-001, BUG-008, BUG-022): khi file hỏng thì thử bản `backups/` mới nhất hợp lệ và báo người dùng; `.bak` kèm thời gian, giữ vài bản; ngăn sai kiểu thì cất bản gốc vào `raw`/file riêng thay vì ghi đè.
4. Giao cho notes: BUG-002…006, 009…012 (parse.js — đã có bộ ~100 câu ở `test/unit/parse.test.js` làm chuẩn nghiệm thu). Giao cho paper: BUG-007, 017–019, 026. Giao cho core: BUG-014, 016, 023 và phối hợp với notes BUG-013/015 (kênh vị trí bé để chuông/popup né).
5. Thống nhất xưng hô (BUG-028): note mẫu và Cài đặt dùng "bạn"/"mình", bé dùng "tớ/cậu" — cần một quy tắc chung trong `docs/persona/MOCHI.md`.
