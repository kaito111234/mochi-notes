# Danh sách lỗi — phòng QA (cập nhật lượt 2, 2026-10-15)

Môi trường: Linux xvfb 1440x900 (thêm 1366x768 cho UX), `--disable-gpu`, Electron 33, TZ `Asia/Ho_Chi_Minh`.
- Lượt 1: `main` @ f84c7b4. **Lượt 2: `main` @ 70ebdd3** (đã gộp Đợt 2: notes, paper, game, art, core Đợt 2). Nhánh `room/core` @ 610178f (Đợt 2B, chưa gộp) kiểm riêng: `MOCHI_E2E_ROOT=<worktree core>`.
Chi tiết từng nhóm (bước, file:dòng, số liệu): `docs/rooms/qa/findings/<nhóm>.md`. Ảnh: `docs/rooms/qa/img/` (lượt 2 tiền tố `l2-`).
Lỗi Chặn/Nặng **trưởng phòng QA đã tự tái hiện** (lệnh kèm theo).

Mức: **Chặn** = mất dữ liệu / nhắc lịch không báo / app không dùng được · **Nặng** = tính năng chính hỏng hoặc nhắc sai giờ · **Vừa** = sai một phần, khó dùng · **Nhẹ** = chữ, thẩm mỹ.

**Đang mở: 0 Chặn · 6 Nặng · 26 Vừa · 17 Nhẹ (49 lỗi).** Đã sửa lượt 2: BUG-001, 003, 006, 008, 022 (+ BUG-014, 023 đã sửa trên `room/core`, chờ gộp).
Theo phòng chính (đang mở): notes 19 (5 Nặng) · paper 14 (1 Nặng) · core 11 · game 2 · persona 1 · điều hành 2.

## Ưu tiên (sửa theo thứ tự) — lỗi đang mở

| Mã | Mức | Phòng | Tóm tắt | Trạng thái lượt 2 | Gốc |
|---|---|---|---|---|---|
| BUG-032 | Nặng | notes | **MỚI.** Note "thứ 6 tuần sau 10h30 họp" (và "thứ 2/7 tuần sau 9h") **không tạo nhắc nào**: `understand()` trả 0 mục dù `parse.analyze` đúng 23/10 10:30 | mới | N-reminder-1 |
| BUG-033 | Nặng | notes | **MỚI.** `understand()` coi "sáng/trưa/chiều/tối" đứng một mình là giờ → nhắc rác + cắt chữ tiêu đề: "Tối ưu website" → 20:00 "Ưu website"; "Sáng tạo nội dung" → 08:00 "Tạo nội dung"; "đo chiều dài" → 15:00; "tô sáng" → có giờ | mới | N-unit-1, N-ux-10 |
| BUG-002 | Nặng | notes | Số thường thành ngày: "3/4 cuốn sách", "1/2 cái bánh" → ngày 2027 | MỘT PHẦN (500g, 50-60k đã hết) | F-unit-2 |
| BUG-005 | Nặng | notes | "1h30 nữa họp" → 13:30 thay vì +1h30 | CÒN | F-unit-5 |
| BUG-004 | Nặng | notes | "nửa đêm" → 22:00 (0h, 12h đêm, 2h đêm đã đúng) | MỘT PHẦN | F-unit-4 |
| BUG-007 | Nặng | paper | Tô sáng kết hợp đậm/gạch chân mất màu sau khi mở lại (`src/note/note.js:44-56`) | CÒN | F-note-format-1 |
| BUG-012 | Vừa | notes | "họp 3h chiều nay" gõ lúc đã quá 15h → im lặng, không chip | CÒN | F-reminder-3 |
| BUG-009 | Vừa | notes | "nửa tiếng nữa" / "nua tieng nua" không tạo nhắc ("1 tiếng rưỡi nữa", "sau 5 phút" đã được) | MỘT PHẦN | F-unit-5 |
| BUG-010 | Vừa | notes | Không dấu: còn "nua tieng nua" (phần lớn đã hiểu) | MỘT PHẦN | F-unit-7 |
| BUG-011 | Vừa | notes | `parse.analyze` đã sạch; phần còn lại nằm ở BUG-033 | MỘT PHẦN | F-unit-6 |
| BUG-034 | Vừa | core | **MỚI.** `ctx.pet.occupiedRect()` và sự kiện `pet:moved` chưa được công bố trong `src/main/petcore/index.js` → `placement.js` của notes luôn nhận `avoid=null` (gốc của BUG-013/015) | mới | N-layout-1 |
| BUG-013 | Vừa | core + notes | Chuông báo thức (1064,622 360x262) chồng cửa sổ bé (1140,475 300x430) | CÒN — chờ BUG-034 | F-alarm-memo-1 |
| BUG-015 | Vừa | core + notes | Popup dặn dò chồng bé/bong bóng (popup đã né chuông đúng) | CÒN — chờ BUG-034 | F-ux-2 |
| BUG-035 | Vừa | paper (+notes) | **MỚI.** Khôi phục note từ thùng rác → mất mẫu giấy (về giấy trơn). `src/main/paper/index.js:106-113` xoá `noteMeta` khi `note:deleted`, dọn meta mồ côi lúc khởi động cũng xoá meta của note trong thùng; `trashService.restoreNote` chỉ chép meta alarms | mới | N-list-1 |
| BUG-036 | Vừa | notes | **MỚI.** Nút "Hoàn tác" trong toast sau khi xoá không bấm được (`src/list/list.css:335` `.toast{pointer-events:none}`, `.toast-act` :375 không bật lại) | mới | N-list-2 |
| BUG-037 | Vừa | paper | **MỚI.** Hộp xác nhận xoá trong note vẫn ghi "Note sẽ bị xoá hẳn, không khôi phục được" (`src/note/note.html:110`) trong khi note vào thùng rác 30 ngày | mới | N-list-3 |
| BUG-038 | Vừa | notes (+paper) | **MỚI.** Xuất/nhập JSON không mang ngăn `paper` → nhập lại mọi note về giấy trơn (`transferLogic.js` `buildExportJson` ~437, `applyNoteMeta` ~379) | mới | N-paper-1 |
| BUG-039 | Vừa | paper | **MỚI.** Chưa chuyển dữ liệu `localStorage` cũ (`mochi.paper.meta.*`, `mochi.paper.settings`) sang ngăn `paper` → mất mẫu đã chọn ở bản dự phòng | mới | N-paper-2 |
| BUG-040 | Vừa | game | **MỚI.** `src/game/preview.js:8` gõ cứng tên khung (`0001_140.png`…) không tồn tại (thật: `0001_160.png`, sad `0001_208.png`) → ảnh bé xem trước trong Tủ đồ vỡ (khung trống), cả trong bản đóng gói | mới (QA đã kiểm file) | N-build-1, N-ux-4 |
| BUG-017 | Vừa | paper | Note mới không đặt con trỏ vào vùng soạn (`activeElement` = BODY) | CÒN | F-note-persist-1 |
| BUG-018 | Vừa | paper | Menu "…" bị cắt ở note nhỏ (300x220 thấy 4/12 mục, 220x160 thấy 2) | CÒN | F-ux-6 |
| BUG-019 | Vừa | paper | Panel "Nhắc lịch" ở note nhỏ: Lưu/Tắt nhắc/Xong ngoài khung | CÒN | F-ux-7 |
| BUG-041 | Vừa | paper | **MỚI.** Trang trí mẫu giấy đè nút "…" (Kraft, Tết, Bài tập, MEMO); hoa mai/thỏ che nút "x" dải gợi ý; thỏ Trung thu che chữ | mới | N-ux-1 |
| BUG-042 | Vừa | paper | **MỚI.** Bộ chọn "Mẫu giấy…" ở note 300x220 chỉ thấy 1 hàng, tab nhóm bị cắt, "Tuỳ chọn" khuất | mới | N-ux-2 |
| BUG-043 | Vừa | paper + notes | **MỚI.** Dải gợi ý chiếm ~1/3 note Mini, chữ bị cắt, nút "Tạo/Làm" không rõ; không có công tắc tắt hẳn | mới | N-ux-3 |
| BUG-044 | Vừa | core (+art) | **MỚI.** Tờ note bé giơ lệch tay ~55px ngang, ~70px dọc, che nửa người bé (art đã báo; vị trí do app vẽ — dùng `note.center` của pack) | mới | F-ux, art |
| BUG-016 | Vừa | core | Tờ note bé cầm: cạnh phải đã hết cắt; dòng phụ vẫn cắt "Gọi…" | MỘT PHẦN | F-ux-4 |
| BUG-014 | Vừa | core | Tờ "Dặn dò" bé cầm "NaN:NaN · undefined" | CÒN trên main · **ĐÃ SỬA trên room/core** | F-ux-1 |
| BUG-045 | Vừa | core | **MỚI (room/core, chưa gộp).** Nhắc `due` hiện trễ ~6 s (main 0,08 s): `stage.js:359-366` chờ đi tới góc (tối đa 6 s/bước) rồi mới nói; bé đi ~37 px/s, lề mới 220px → luôn phải đi. Làm đỏ `reminder.test.js` ca 2a | mới | N-core-1 |
| BUG-046 | Vừa | core | **MỚI (room/core, chưa gộp).** autoTidy dọn note CHƯA xong khi nhận `note:expired` cũ/giả (xếp hàng tới 30 phút): `tidy.js:215-228`, `stage.js:91` `validItem` không kiểm lại `expiredCandidates()`. Note vào thùng (khôi phục được) nhưng bị dọn không hỏi | mới | N-core-2 |
| BUG-020 | Vừa | notes | "Hiện tất cả" 30 note 3,9 s, chặn main tới 430 ms | CÒN (đo lại lượt 2) | F-perf-2 |
| BUG-021 | Vừa | điều hành | 30 note = 34 tiến trình, RSS 3,7 GB (PSS 0,75 GB) — cần đo trên Windows | CÒN | F-perf-1 |
| BUG-023 | Nhẹ | core | Câu thoại không khớp intent | CÒN trên main · **ĐÃ SỬA trên room/core** | F-ux-5 |
| BUG-024 | Nhẹ | core / notes | CPU rảnh 4,4–5,9% một nhân (main); room/core ~3,4% | MỘT PHẦN | F-perf-3 |
| BUG-025 | Nhẹ | notes | Chip "gọi khách 2 phút nữa" ghi "báo trước 5 phút" | CÒN | — |
| BUG-026 | Nhẹ | paper | Chip "quá hạn 0 giây/2 giây" | CÒN | F-ux-12 |
| BUG-027 | Nhẹ | notes | "Đang dán / Đang cất", "Cất/Dán" khó hiểu | CÒN | F-ux-8 |
| BUG-028 | Nhẹ | notes / persona | Xưng hô lẫn: note mẫu "Chào bạn, mình…", bé "tớ/cậu" | CÒN | F-ux-10 |
| BUG-029 | Nhẹ | notes | Bảng phím tắt thiếu Ctrl+Alt+G, Ctrl+F, Z/Y, Shift+K/R, zoom (nút popup đã đổi "Nhớ rồi") | MỘT PHẦN | F-ux-9 |
| BUG-030 | Nhẹ | core | "Hoãn 10 phút" viết cứng — cả trên room/core: `stage.js:117-128` đọc `ctx.alarms.settings`/`store.data.alarms` không tồn tại; đúng là `ctx.store.section('alarms').settings.defaultSnoozeMin` (tiêu đề "Mochi Notes" đã sửa) | MỘT PHẦN | F-ux |
| BUG-031 | Nhẹ | notes | `normalizeNote/normalizeReminder` bỏ trường lạ trên note/reminder (settings đã giữ) | MỘT PHẦN | F-unit-8 |
| BUG-047 | Nhẹ | game | **MỚI.** Dark mode: pill "Cấp 1", biểu tượng khoá gần như chìm; "Gốc / Có BH" ở máy gacha khó hiểu | mới | N-ux-5 |
| BUG-048 | Nhẹ | paper | **MỚI.** Tô sáng vàng trên giấy tối (Đêm/Than): chữ sáng trên nền vàng không đọc được | mới | N-ux-6 |
| BUG-049 | Nhẹ | paper / notes | **MỚI.** Gợi ý "bé Mochi sẽ nhắc cậu" và chip nhắc bị cắt ở note hẹp | mới | N-ux-7 |
| BUG-050 | Nhẹ | notes | **MỚI.** Toast Ghi nhanh "note mới đã có chỗ ở" lạ tai, đè nút Hiện/Ẩn tất cả vài giây | mới | N-ux-8 |
| BUG-051 | Nhẹ | persona | **MỚI.** Thoại thưởng nói "kẹo" (`assets/dialogue/vi.json:433-435`), giao diện game dùng "xu" | mới | N-ux-9 |
| BUG-052 | Nhẹ | paper | **MỚI.** Mẫu "Notes" (mèo): đường kẻ cắt qua chữ dòng 3–4 | mới | N-ux-11 |
| BUG-053 | Nhẹ | notes | **MỚI.** "họp 9h sáng và 3h chiều" chỉ ra 1 nhắc (09:00) | mới | N-notes2-1 |
| BUG-054 | Nhẹ | điều hành | **MỚI.** Gói có `assets/paper/deco/README.md` thừa; `signAndEditExecutable:false` → exe mang icon Electron | mới | N-build |

## Đã sửa (QA xác nhận lượt 2)
| Mã | Chứng cứ |
|---|---|
| BUG-001 File hỏng → khôi phục bản sao lưu | `data.test.js` 3b xanh: dùng `backups/` hôm qua, có `recoveredFrom`, `corruptCopy` |
| BUG-003 "thứ N tuần sau" ở `parse.js` | unit xanh (23/10 09:00). **Nhưng** đường note mới qua `understand()` mất nhắc → BUG-032 |
| BUG-006 Thùng rác | `list.test.js` 3c/3d/3e, `notes2.test.js` 4: xoá mềm, khôi phục, xoá hẳn 2 bước, dọn >30 ngày, note trong thùng không nhắc (kèm BUG-035/036/037) |
| BUG-008 `.bak` bị ghi đè | `data.test.js` 3c: giữ cả 2 bản `mochi-data.corrupt-*` |
| BUG-022 Ngăn sai kiểu | `data.test.js` 3d, `store-recovery.test.js`: bản gốc ở `mochi-data.section-<tên>-*.json` |
| BUG-014, BUG-023 | Chỉ trên `room/core` (`core2b.test.js` 4a, 4b) — sẽ đóng khi gộp |

## Chi tiết lỗi Nặng mới (lượt 2)

### BUG-032 — "thứ N tuần sau" không tạo nhắc
- Phòng: notes. `src/shared/understand/index.js` (`ownTime` dòng 87, `whenOf` dòng 322); scheduler dùng `understandItems()` (`src/main/notes/scheduler.js:233`) nên kết quả `understand` thắng `parse.analyze`.
- Tái hiện (QA tự chạy, 15/10 10:00): `scheduler.applyText({text:'thứ 6 tuần sau 10h30 họp'}, now)` → `reminders=[]`; `understand('thứ 2 tuần sau 9h').items=[]`; trong khi `parse.analyze` → 23/10 10:30. E2E: `bash test/e2e/run.sh test/e2e/reminder.test.js` (subtest "thứ 6 tuần sau 10h30 họp" đỏ).
- Kỳ vọng: nhắc T6 23/10 10:30. Thực tế: không chip, không nhắc — người dùng tin đã hẹn mà bé im lặng.

### BUG-033 — "sáng/tối/chiều" trong từ thường thành giờ
- Phòng: notes. `src/shared/understand/index.js:61-73` (`PER_ACC` khớp buổi đứng một mình) + `:64 PERIOD_DEFAULT`, `:101`.
- Tái hiện (QA tự chạy): `scheduler.applyText` với "Tối ưu website cho khách" → nhắc 20:00 "Ưu website cho khách"; "Sáng tạo nội dung tuần này" → 08:00 hôm sau "Tạo nội dung". Unit: `TZ=Asia/Ho_Chi_Minh node --test test/unit/understand.test.js` (4 ca đỏ).
- Kỳ vọng: không tạo nhắc (như `parse.analyze` đã làm), tiêu đề không bị cắt chữ. Thực tế: bé nhắc rác, tiêu đề hỏng.

## Chi tiết lỗi Nặng lượt 1 (giữ để tham khảo; trạng thái xem bảng trên)


### BUG-001 — File dữ liệu hỏng: mở ra trống trơn, bỏ qua bản sao lưu
- Mức: Nặng (chưa mất ngay vì file hỏng còn ở `.bak` và `backups/`, nhưng người dùng thấy mất hết note; bản tốt bị đẩy khỏi `backups/` sau 7 ngày → thành mất thật). Phòng: điều hành (`src/main/store.js`).
- Tái hiện: có `backups/mochi-data-<hôm qua>.json` hợp lệ; ghi `mochi-data.json` = `{"notes":[{"id":` → mở app.
- Kỳ vọng: nạp bản sao lưu gần nhất hợp lệ, báo "Dữ liệu bị hỏng, đã khôi phục bản ngày …".
- Thực tế: 0 note, không thông báo; file mới ghi đè bằng dữ liệu rỗng.
- Nguyên nhân: `store.js:95-101` khối `catch` chỉ đổi tên sang `.bak` rồi dùng mặc định.
- Test: `bash test/e2e/run.sh test/e2e/data.test.js` (ca 3b đỏ). QA tái hiện tay bằng electron + XDG tạm: xác nhận.
- Ảnh: `img/data-hong-co-backup-mat-note.png`

### BUG-002 — Số thường thành nhắc rác
- Phòng: notes (`src/shared/parse.js`: regex giờ ~dòng 62 thiếu biên trái, nhận `g` là "giờ"; ngày `a/b`, `a-b` không kiểm phạm vi).
- Tái hiện: gõ note "Đi chợ: mua 500g thịt, 3/4 kg cà chua" → chip "00:00 · T7 03/04 · báo trước 30 phút", bé nói "Tớ ghi đồ cần mua rồi". `node -e` dưới: "mua 500g thịt" → 12:00 hôm nay; "giá 50-60k" → 19/01/2031.
- Kỳ vọng: không tạo nhắc. Thực tế: nhắc sai, bé nhảy ra lúc vô lý.
- Ảnh: `img/bug-500g-thanh-nhac.png`

### BUG-003 — "thứ N tuần sau"
- Phòng: notes (`parse.js` ~40-46: mẫu tương đối "N tuần sau" khớp trước thứ trong tuần).
- "thứ 6 tuần sau 10h30 họp" (hôm nay T5 15/10) → 26/11 10:00. Kỳ vọng T6 23/10 10:30. Tương tự "thứ 2/5 tuần sau".
- Ảnh: `img/reminder-chip-t6-sai.png`

### BUG-004 — Giờ đêm lệch 12 tiếng
- Phòng: notes (`parse.js` ~76-84 cộng 12 cho "đêm/khuya" kể cả 12h và 0–4h).
- "0h" → 12:00; "12h đêm" → 12:00 trưa; "2h đêm" → 14:00; "nửa đêm" → không hiểu. Kỳ vọng 00:00 / 00:00 / 02:00 hôm sau.

### BUG-005 — "1h30 nữa"
- Phòng: notes. "1h30 nữa họp" lúc 10:00 → 13:30 (kỳ vọng 11:30).

Lệnh tái hiện chung BUG-002…005:
```
node -e "const P=require('./src/shared/parse.js');const n=new Date(2026,9,15,10).getTime();for(const t of ['thứ 6 tuần sau 10h30 họp','mua 500g thịt','đọc 3/4 cuốn sách','giá 50-60k','0h','12h đêm','2h đêm','1h30 nữa họp']){const r=P.analyze(t,n);console.log(t,'=>',r&&r.due?new Date(r.due).toString().slice(0,21):null)}"
```
Bộ đầy đủ ~100 câu: `node test/unit/run.js` (29 ca parse đỏ).

### BUG-006 — Không có thùng rác
- Phòng: notes (`noteService.js:108-116` `deleteNote` splice thẳng; `src/note/note.html:98` "không khôi phục được").
- Yêu cầu nghiệm thu có "xoá + khôi phục từ thùng rác/thùng của bé". Xoá nhầm chỉ còn cách khôi phục cả bản sao lưu.
- Kỳ vọng: xoá → vào thùng rác (giữ ≥30 ngày), khôi phục từ danh sách (hoặc "thùng của bé"); có "Hoàn tác" ngay sau khi xoá.
- Test: `list.test.js` ca 3c đỏ. Ảnh: `img/bug-xoa-khong-khoi-phuc.png`

### BUG-007 — Tô sáng mất khi mở lại
- Phòng: paper (`src/note/note.js:44-51` `cleanInto` chỉ giữ `background-color` trên SPAN/MARK; Chromium đặt style lên `<b>/<u>/<strike>` trong cùng).
- Tái hiện: gõ chữ → Ctrl+A → Ctrl+B → Ctrl+U → Ctrl+Shift+H → chờ lưu → thoát → mở lại: hết màu.
- Test: `note-format.test.js` ca 1c đỏ (QA chạy lại: đỏ). Ảnh: `img/note-format-to-sang-mat.png`

### BUG-008 — `.bak` bị ghi đè
- Phòng: điều hành (`store.js:98` `renameSync(file, file+'.bak')` không giữ bản cũ). Đề xuất `.bak-<thời gian>` giữ vài bản.
- Test: `data.test.js` ca 3c đỏ.

## Không phải lỗi (đã kiểm)
- Note vàng mẫu "trống" trong ảnh khói: chụp quá sớm, nội dung có đủ (`img/note-persist-note-mau.png`).
- Gõ tiếng Việt (dựng sẵn, NFD dán vào, IME insertText, thay ký tự): đúng. Mở lại giữ nội dung/vị trí/kích thước/màu.
- Kill -9: mất chữ chỉ khi kill < ~0,8 s sau khi gõ (2 lớp debounce); file luôn là JSON hợp lệ.
- Nhắc lịch tới giờ, Xong/Hoãn/Mở note, note cất vẫn nhắc, lặp "mỗi sáng 8h", thông báo dự phòng khi tắt bé, 2 nhắc cùng lúc, 30 nhắc cùng lúc: đúng.
- Báo thức 1 phút, hoãn, kêu bù ≤30 phút/"Đã lỡ", dặn dò khi mở máy, nhập/xuất JSON/.txt/.md, khôi phục sao lưu, giữ 7 bản: đúng.
- (Lượt 2) Mẫu "Trơn" luôn theo `note.color` chứ không theo meta paper — đúng thiết kế (`paperCtl.js:21`).
- (Lượt 2) Xu thực nhận lệch số trong đặc tả vì thưởng "lần đầu dùng tính năng" +20 — đúng `docs/rooms/game/API.md` mục 3.
- (Lượt 2) Ghi nhanh không có giờ trả câu persona `note_created` thay cho "Tớ ghi rồi nha: …" — API2 cho phép.
- (Lượt 2) Gõ nối vào cuối dòng có giờ đổi tiêu đề nhắc nhưng giữ id/trạng thái — đúng.
- (Lượt 2) Bản đóng gói (app.asar): không thiếu file nào ngoài BUG-040; không lọt test/docs/art/tools.
