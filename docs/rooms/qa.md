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
_Cập nhật 2026-10-15 — lượt 3._ Thử trên `main` @ 4b31347 (Đợt 3 đã gộp) — `room/qa` đã gộp main (merge 8371afb). `room/core` Đợt 2B vẫn chưa gộp.

**Đã xong lượt 3** (theo yêu cầu điều hành)
1. Chạy lại toàn bộ: unit 238/0 (HCM, 7 skip DST) + 245/0 (NY), `npm test` xanh; E2E cả bộ một lệnh: 159 test, 119 pass / 19 fail / 21 skip (core2b skip vì chưa gộp core, packaged skip khi không đặt biến). Phân loại 19 ca đỏ: 3 do giao diện Đợt 3 đổi có chủ ý (list-2, note-persist 4, paper-game 5 tab Album) → đã sửa test; 1 do máy quá tải (notes2-6, chạy riêng xanh, nới chờ); còn lại là lỗi thật.
2. `BUGS.md`: **đóng 19 lỗi** (hiểu giờ BUG-002/004/005/009–011/032/033, 012, 013, 015, 023, 025–027, 029, 031, 051, 052), mở 5 lỗi mới (BUG-055…059), hạ BUG-034 xuống Nhẹ.
3. Ca E2E tính năng mới (đã có từ lượt 2, cập nhật lượt 3): mẫu giấy đổi/lưu/mở lại (note-persist 6, paper-game 1), checklist tick + xu (paper-game 3), nhiều nhắc/note (reminder 7, 7b, **7c mới**, notes2-2), ghi nhanh (notes2-1), thùng rác + khôi phục (list 3c–3g, notes2-4), Phòng của Mochi 6 tab + gacha trừ xu + tủ đồ (paper-game 5), **điểm danh + túi đồ ăn (5b mới)**, tắt game hoá (paper-game 6), chữ "Đang hiện/Đã cất" (list-l3-1 mới).
4. Vị trí cửa sổ BUG-013/015: `layout.test.js` 4/5 xanh — chuông/popup né cửa sổ bé, dời khi bé đi; ca 1 đỏ vì core chưa công bố `occupiedRect` (BUG-034).
5. Đóng gói: `--win zip --x64` chạy được 2m10s; zip 114 MB, win-unpacked 243 MB, app.asar 14,4 MB (assets/pet 12,2 MB, wardrobe 0,65 MB). Không lọt test/docs/art/tools/scripts; file thừa: `assets/paper/deco/README.md`; `assets/wardrobe` có trong gói nhưng chưa dùng. `packaged.test.js` 8/9 (đỏ BUG-040). package.json chưa nhận đề xuất NSIS/icon.

**Lỗi đang mở**: 0 Chặn · **2 Nặng** (BUG-055 core: Xong nhắc 1 làm mất nhắc 2 cùng note — đã tự tái hiện; BUG-007 paper) · 21 Vừa · 12 Nhẹ = 35.
**Theo phòng**: paper 12 · core 10 · notes 7 · game 4 · điều hành 2.

**Lệnh chạy test**
- Toàn bộ E2E (~50 phút): `bash test/e2e/run.sh` · một nhóm: `bash test/e2e/run.sh test/e2e/<nhóm>.test.js` · perf rút gọn `PERF_RUNS=1 PERF_IDLE_MS=5000`.
- Lên nhánh khác: `MOCHI_E2E_ROOT=<worktree> bash test/e2e/run.sh test/e2e/core2b.test.js`.
- Bản đóng gói: `npx electron-builder --win zip --x64 --config.directories.output=/tmp/qa-dist` → `MOCHI_PACKAGED_APP=/tmp/qa-dist/win-unpacked/resources/app.asar bash test/e2e/run.sh test/e2e/packaged.test.js`.
- Logic: `node test/unit/run.js` (2 múi giờ).

**Kết quả lượt 3 theo bộ** (sau khi sửa test): list 11/4 (BUG-035×2, 036, 037) · note-persist 11/2 (BUG-017) · note-format đỏ 1c (BUG-007) · notes2 11/0 · reminder 17/2 (BUG-055) · paper-game 11/2 (BUG-038, 039) · layout 4/1 (BUG-034) · alarm-memo 7/1 (BUG-014) · data xanh · core2b trên main: đỏ 4a (014), 4c (030), 4d (016), còn lại skip/xanh · packaged 8/1 (BUG-040) · perf, smoke, ux-shots, ux2-shots (13) xanh.
**Hiệu năng** (xvfb, 3 lần): khởi động 1 note 0,95 s, 30 note 5,3 s; PSS 1 note 558 MB (lượt 2: 337 → BUG-059), 30 note 960 MB; CPU rảnh 1 note ~5%, 30 note ~3,5%; hiện tất cả 30 note 5,0 s; 30 nhắc cùng lúc không treo; 200 note mở danh sách 0,45 s.

**Chưa kiểm được** (cần Windows thật): bộ cài NSIS, âm thanh, toast có nút, acrylic/note trong suốt thật, gõ cửa (user32), chuột thật, DPI/đa màn hình, RAM thật.

**Việc tiếp theo**
1. Khi `room/core` gộp: chạy `core2b` + toàn bộ; kiểm lại BUG-045/046 (nhánh đã lên @4ceb710), BUG-055.
2. Khi paper/notes sửa: chạy lại `list`, `note-persist`, `note-format`, `paper-game`.
3. Chụp lại 220x160 cho BUG-019; thêm assert chống cắt/che nút ở note nhỏ (BUG-018/019/041/042).
4. NSIS + `packaged.test.js` trên Windows/CI.

## Đề xuất cho phòng điều hành
_Lượt 3._
1. **Gấp — core BUG-055** (Nặng): `mascotWindow.js` `dropNote` phải lọc theo `reminderId`; `stage.js` truyền `reminderId` vào `completeNote/snoozeNote`. Áp dụng cho cả `room/core` trước khi gộp.
2. Giao lỗi: **paper** BUG-007 (Nặng), 035, 037, 039, 017, 018, 019, 041–043, 048, 049 · **core** BUG-055, 059 (RAM cửa sổ bé), 014 (gộp room/core), 044, 016, 045, 046, 034, 030, 024 · **notes** BUG-036, 038, 020, 050, 053, 056, 028 · **game** BUG-040, 057 (cùng art/core: hiện đồ đang mặc, nạp `assets/wardrobe`), 047, 058.
3. Gộp `room/core` sau khi sửa BUG-055 (và nên cả 045/046); QA sẽ chạy `core2b` + toàn bộ ngay sau gộp.
4. `package.json` build (chưa nhận từ lượt 2): `nsis` + khối từ `build/nsis.json`, `win.icon: assets/icon.ico`, `files` thêm `"!assets/paper/deco/README.md"`, cân nhắc `compression: maximum`, quyết định `signAndEditExecutable` + ký số; CI windows-latest dựng NSIS và chạy `packaged.test.js`.
5. Xưng hô (BUG-028): `docs/persona/MOCHI.md:34` và mã notes đang lệch nhau — chốt một bên.
6. `scripts/test-all.js`: nay có thể thêm `node test/unit/run.js` (xanh cả 2 múi giờ).

### Lượt 2 (lưu lại)
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

Kết quả lượt 2 (mỗi file chạy riêng; đỏ = lỗi thật, trừ ghi chú)
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

