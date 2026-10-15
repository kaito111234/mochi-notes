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
_Cập nhật 2026-10-15 — lượt 2._ Thử trên `main` @ 70ebdd3 (đã gộp Đợt 2) + nhánh `room/core` @ 610178f (Đợt 2B, chưa gộp).

**Đã xong lượt 2**
- `MOCHI_E2E_ROOT=<thư mục>`: chạy bộ E2E lên worktree nhánh khác hoặc app.asar đã đóng gói (`test/e2e/lib/app.js`, `hook.js`).
- Hồi quy toàn bộ lỗi lượt 1 → **đã sửa 5** (BUG-001, 003, 006, 008, 022), BUG-014/023 sửa trên `room/core` chờ gộp; còn lại ghi trạng thái CÒN / MỘT PHẦN trong `BUGS.md`.
- Test mới: `notes2` (ghi nhanh, nhiều nhắc, dải gợi ý, thùng rác, hết hạn, không dấu, list:tab), `paper-game` (mẫu giấy ↔ ngăn paper, sao lưu, xuất/nhập, checklist → xu, thưởng/trần xu, Phòng của Mochi, tắt game hoá, ngăn hỏng kiểu), `layout` (chuông/dặn dò không chồng bé, trong workArea, dời theo `pet:moved`), `core2b` (dọn note, gõ cửa, 11 hành động — tự skip trên main), `ux2-shots` (ảnh giao diện Đợt 2, 1440 và 1366), `packaged` (kiểm app.asar thiếu file/404). Thêm ca: luồng thùng rác (list 3c–3g), mẫu giấy + checklist lưu lại (note-persist 6), một note 2 nhắc + note cất (reminder 7, 7b, 8), BUG-014 (alarm-memo 6), trường lạ (data 6b). Unit: `understand.test.js` (44), `store-recovery.test.js` (18); cập nhật store.test theo đặc tả khôi phục sao lưu.
- Đóng gói: `--win zip` chạy được (115 MB zip, app.asar 14,7 MB, 74% là hình bé); NSIS không dựng được trên Linux (cần wine) → cấu hình đề xuất `build/nsis.json`. Chi tiết `findings/build.md`.
- Hiệu năng (xvfb, 1 lần đo): khởi động 1 note 0,95 s / 30 note 4,8 s; RSS 30 note 3,7 GB (PSS 0,75 GB); CPU rảnh 4,4–5,9%; "Hiện tất cả" 30 note 3,9 s (main lag 430 ms); 30 nhắc cùng lúc không treo; 200 note mở danh sách 0,4 s.

**Lệnh chạy test**
- Toàn bộ E2E (~45 phút): `bash test/e2e/run.sh` · một nhóm: `bash test/e2e/run.sh test/e2e/<nhóm>.test.js` · perf rút gọn `PERF_RUNS=1 PERF_IDLE_MS=5000`.
- Lên nhánh khác: `MOCHI_E2E_ROOT=/đường/dẫn/worktree bash test/e2e/run.sh test/e2e/core2b.test.js`.
- Bản đóng gói: `npx electron-builder --win zip --x64 --config.directories.output=/tmp/qa-dist` rồi `MOCHI_PACKAGED_APP=/tmp/qa-dist/win-unpacked/resources/app.asar bash test/e2e/run.sh test/e2e/packaged.test.js`.
- Logic: `node test/unit/run.js` (2 múi giờ).

**Kết quả lượt 2** (mỗi file chạy riêng; đỏ = lỗi thật, trừ ghi chú)
| Bộ | Pass / Fail | Đỏ vì |
|---|---|---|
| unit (mỗi TZ) | 226 / 12 (+7 skip DST) | parse BUG-002/004/005/009/010, understand BUG-033, store BUG-031 |
| note-persist | 11 / 2 | BUG-017 |
| note-format | 10 / 1 | BUG-007 |
| list | 10 / 4 | BUG-035, 036, 037 |
| reminder | 13 / 5 (tính ca cha) | BUG-032, 009, 012, 025 |
| alarm-memo | 7 / 1 | BUG-014 (ca 1b từng đỏ 1 lần khi máy quá tải — theo dõi) |
| data | 13 / 1 | BUG-031 |
| layout | 0 / 5 | BUG-034 (→ 013, 015) |
| notes2 | 11 / 0 | — |
| paper-game | 10 / 2 | BUG-038, 039 |
| core2b (main) | 14 skip, 2 / 4 | BUG-014, 023, 030, 016 · trên room/core 17 / 3 (BUG-046, 030, 016) |
| packaged | 6 / 1 | BUG-040 |
| perf, smoke, ux-shots, ux2-shots | xanh | (chỉ đo/chụp) |

**Lỗi đang mở**: 0 Chặn · **6 Nặng** · 26 Vừa · 17 Nhẹ (49). Mới lượt 2: 23 (BUG-032…054), trong đó 2 Nặng (BUG-032, 033 — đã tự tái hiện).
**Theo phòng**: notes 19 (5 Nặng: 032, 033, 002, 005, 004) · paper 14 (1 Nặng: 007) · core 11 · game 2 · persona 1 · điều hành 2.

**Kết luận gộp `room/core` Đợt 2B**: không xung đột với main (merge-tree), không lỗi Chặn/Nặng, sửa BUG-014/023. Nên sửa **BUG-045** (nhắc trễ ~6 s, đỏ reminder 2a) và **BUG-046** (tự dọn note chưa xong) trước hoặc ngay sau khi gộp.

**Chưa kiểm được** (cần Windows thật): bộ cài NSIS, âm thanh, toast có nút, acrylic + mẫu giấy, gõ cửa (user32), kéo-nhấc bé bằng chuột thật, DPI/đa màn hình, RAM thật 30 note.

**Việc tiếp theo**
1. Khi notes sửa BUG-032/033 + parse: chạy lại `reminder`, `unit`; khi core công bố `occupiedRect`/`pet:moved`: chạy `layout` (kiểm lại tên sự kiện ca 5).
2. Sau khi gộp `room/core`: chạy toàn bộ trên main, đóng BUG-014/023.
3. Chạy NSIS + `packaged.test.js` trên Windows/CI (windows-latest); đo RAM/CPU trên Windows.
4. Thêm assert chống cắt chữ/che nút ở note nhỏ (BUG-018/019/041/042) để thành test đỏ thay vì chỉ ảnh.

## Đề xuất cho phòng điều hành
1. Giao lỗi (thứ tự ưu tiên trong `BUGS.md`): **notes** BUG-032, 033 (Nặng, `understand/index.js`), 002/004/005/009/010, 012, 036, 038, 020, 025, 027–029, 031, 050, 053 · **paper** BUG-007 (Nặng), 035, 037, 039, 017–019, 041–043, 026, 048, 049, 052 · **core** BUG-034 (công bố `occupiedRect`/`pet:moved` — mở khoá 013/015), 044, 045, 046, 016, 030 (đọc `store.section('alarms')`), 024 · **game** BUG-040 (`preview.js:8`), 047 · **persona** BUG-051 (chốt "xu" hay "kẹo").
2. Gộp `room/core` (xem kết luận trên). Sau gộp nhắc trễ ~6 s sẽ làm đỏ `reminder.test.js` 2a cho tới khi sửa BUG-045.
3. `package.json` (từ `findings/build.md`): thêm `nsis` vào `win.target` + khối `nsis` từ `build/nsis.json`; `win.icon` → `assets/icon.ico`; script `"dist:win:installer": "electron-builder --win nsis --x64"`; `files` thêm `"!assets/paper/deco/README.md"`; cân nhắc `"compression":"maximum"`; quyết định `signAndEditExecutable` (bật trên Windows/CI) và chứng chỉ ký số (SmartScreen).
4. CI Windows (GitHub Actions windows-latest) để dựng NSIS và chạy `packaged.test.js`; tự cập nhật nên dùng electron-updater + GitHub Releases (phương án và rủi ro trong `findings/build.md`), chưa thêm thư viện.
5. `scripts/test-all.js`: có thể thêm `test/unit/store-recovery.test.js` (xanh); chưa thêm `test/unit/run.js` toàn bộ cho tới khi notes sửa parse/understand.
6. Thống nhất xưng hô (BUG-028) và đơn vị tiền ("xu", BUG-051) trong `docs/persona/MOCHI.md`.
