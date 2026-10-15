# Danh sách lỗi — phòng QA (cập nhật lượt 3, 2026-10-15)

Môi trường: Linux xvfb 1440x900, `--disable-gpu`, Electron 33, TZ `Asia/Ho_Chi_Minh`.
- Lượt 1: `main` @ f84c7b4 · lượt 2: @ 70ebdd3 · **lượt 3: @ 4b31347** (Đợt 3 đã gộp: notes, game, persona, art). `room/core` Đợt 2B vẫn **chưa gộp**.
Chi tiết từng nhóm: `docs/rooms/qa/findings/<nhóm>.md` (mục "Lượt 3" ở đầu). Ảnh: `docs/rooms/qa/img/` (tiền tố `l3-` cho lượt 3).
Lỗi Chặn/Nặng **trưởng phòng QA đã tự tái hiện** (lệnh kèm theo).

Mức: **Chặn** = mất dữ liệu / nhắc lịch không báo / app không dùng được · **Nặng** = tính năng chính hỏng hoặc nhắc sai giờ · **Vừa** = sai một phần, khó dùng · **Nhẹ** = chữ, thẩm mỹ.

**Đang mở: 0 Chặn · 2 Nặng · 21 Vừa · 12 Nhẹ (35 lỗi).** Lượt 3 đóng **19 lỗi** (BUG-002, 004, 005, 009–013, 015, 023, 025–027, 029, 031–033, 051, 052); mở mới 5 (BUG-055…059).
Theo phòng (đang mở): paper 12 (1 Nặng) · core 10 (1 Nặng) · notes 7 · game 4 · điều hành 2.

## Ưu tiên (sửa theo thứ tự) — lỗi đang mở

| Mã | Mức | Phòng | Tóm tắt | Trạng thái lượt 3 |
|---|---|---|---|---|
| BUG-055 | **Nặng** | core | **MỚI.** Note có 2 nhắc chín sát nhau: bấm Xong/Hoãn nhắc 1 → **nhắc 2 bị huỷ khỏi sân khấu**, bé không bao giờ báo (chỉ còn chip "quá hạn"/nhắc dai). `src/main/pet/mascotWindow.js:27` `dropNote(noteId)` + `:44-46` nghe `reminder:done/snoozed` bỏ qua `reminderId`; `stage.js:279,291` gọi `completeNote/snoozeNote(p.noteId)` không truyền `reminderId`. Cùng mã trên `room/core` @4ceb710 | mới — QA tái hiện 2/2 (reminder 7, 7c) |
| BUG-007 | **Nặng** | paper | Tô sáng kết hợp đậm/gạch chân mất màu sau khi mở lại (`src/note/note.js:44-56`) | CÒN |
| BUG-035 | Vừa | paper (+notes) | Khôi phục từ thùng rác mất mẫu giấy (`src/main/paper/index.js:106-110` xoá meta khi `note:deleted`, `:37` dọn meta mồ côi) | CÒN |
| BUG-038 | Vừa | notes (+paper) | Xuất/nhập JSON không mang ngăn `paper` | CÒN |
| BUG-039 | Vừa | paper | Chưa chuyển `localStorage` cũ sang ngăn `paper` | CÒN |
| BUG-036 | Vừa | notes | Nút "Hoàn tác" trong toast sau xoá không bấm được (`src/list/list.css:337-340`, `:377`) | CÒN |
| BUG-037 | Vừa | paper | Hộp xác nhận xoá ghi "xoá hẳn, không khôi phục được" (`src/note/note.html:110`) | CÒN |
| BUG-017 | Vừa | paper | Note mới không focus vùng soạn (`activeElement`=BODY) | CÒN |
| BUG-059 | Vừa | core (+art) | **MỚI.** RAM tăng: 1 note PSS 558 MB (lượt 2: 337), 30 note PSS 960 MB (749). Cửa sổ bé ~414 MB RSS — có vẻ giải mã sẵn toàn bộ 479 khung 400×400 của gói 37 action. Đề xuất: chỉ nạp trước action đang/ sắp dùng, giải phóng ImageBitmap khi rảnh | mới (perf + `ps` theo tiến trình) |
| BUG-057 | Vừa | game + core + art | **MỚI.** Đồ đang mặc không hiện trên bé (desktop) và khung xem trước Tủ đồ trống; `assets/wardrobe` (648 KB) có trong gói nhưng chưa mã nào nạp | mới |
| BUG-040 | Vừa | game | `src/game/preview.js:8` tên khung gõ cứng (`0001_140.png`…) → ảnh xem trước vỡ (ERR_FILE_NOT_FOUND, cả bản đóng gói) | CÒN |
| BUG-014 | Vừa | core | Tờ "Dặn dò" bé cầm "NaN:NaN · undefined" (`stage.js:331`) | CÒN trên main (đã sửa trên room/core, chưa gộp) |
| BUG-044 | Vừa | core (+art) | Tờ note bé giơ lệch tay, che mặt bé | CÒN |
| BUG-016 | Vừa | core | Dòng phụ tờ note bé cầm bị cắt "· Go…" | MỘT PHẦN |
| BUG-045 | Vừa | core | (room/core) Nhắc `due` hiện trễ ~6 s vì bé đi tới góc trước | chưa kiểm lại trên @4ceb710 |
| BUG-046 | Vừa | core | (room/core) autoTidy dọn note chưa xong khi nhận `note:expired` cũ | chưa kiểm lại trên @4ceb710 |
| BUG-018 | Vừa | paper | Menu "…" bị cắt ở note nhỏ (300x220 thấy 4/12 mục) | CÒN |
| BUG-019 | Vừa | paper | Panel "Nhắc lịch" ở note nhỏ: nút ngoài khung | CÒN (chưa chụp lại 220x160) |
| BUG-041 | Vừa | paper | Trang trí mẫu giấy đè nút "…" (Kraft, Tết…) | CÒN |
| BUG-042 | Vừa | paper | Bộ chọn "Mẫu giấy…" chật ở note 300x220 | CÒN |
| BUG-043 | Vừa | paper + notes | Dải gợi ý chiếm 1/3 note Mini, nút "Tạo" không rõ, không tắt được | CÒN |
| BUG-020 | Vừa | notes | "Hiện tất cả" 30 note 5,0 s (main lag tối đa 330 ms, trước 430) | MỘT PHẦN |
| BUG-021 | Vừa | điều hành | 30 note = 34 tiến trình, RSS ~4 GB — cần đo trên Windows | CÒN |
| BUG-034 | Nhẹ | core | `ctx.pet.occupiedRect()`/`pet:moved` chưa công bố (notes đã né bằng bounds cửa sổ bé nên hạ mức) | CÒN (hạ Vừa → Nhẹ) |
| BUG-030 | Nhẹ | core | "Hoãn 10 phút" viết cứng (`stage.js` đọc sai chỗ cài đặt) | CÒN |
| BUG-024 | Nhẹ | core | CPU rảnh ~5% (1 note + bé), mục tiêu < 3% | MỘT PHẦN |
| BUG-028 | Nhẹ | notes / persona | Xưng hô: `docs/persona/MOCHI.md:34` quy định UI/note mẫu "Mochi/bạn", nhưng note mẫu (`noteService.js:216`) và toast Ghi nhanh xưng "tớ/cậu" — cần thống nhất tài liệu hoặc mã | MỘT PHẦN |
| BUG-047 | Nhẹ | game | Dark mode: pill "Cấp N" vẫn chìm | MỘT PHẦN |
| BUG-048 | Nhẹ | paper | Tô sáng vàng trên giấy tối khó đọc | CÒN |
| BUG-049 | Nhẹ | paper / notes | Gợi ý/chip nhắc bị cắt ở note hẹp | CÒN |
| BUG-050 | Nhẹ | notes | Toast Ghi nhanh đè nút Hiện/Ẩn tất cả (chữ đã sửa) | MỘT PHẦN |
| BUG-053 | Nhẹ | notes | "họp 9h sáng và 3h chiều" chỉ ra 1 nhắc | CÒN |
| BUG-054 | Nhẹ | điều hành | Gói lọt `assets/paper/deco/README.md`; exe icon Electron (`signAndEditExecutable:false`); chưa nhận đề xuất NSIS/icon.ico | CÒN |
| BUG-056 | Nhẹ | notes | **MỚI.** Nút hover (Chi tiết/Cất đi/Xoá) phủ giữa thẻ khi cửa sổ danh sách hẹp → bấm giữa thẻ mở "Chi tiết" thay vì mở note (`src/list/list.css:127-130`) | mới |
| BUG-058 | Nhẹ | game | **MỚI.** Điểm danh khó tìm (chỉ thấy chuỗi ngày ở thẻ trái); chức năng chạy đúng (+20 xu) | mới |

## Đã sửa lượt 3 (QA xác nhận trên main @4b31347)
| Mã | Chứng cứ |
|---|---|
| BUG-002, 004, 005, 009, 010, 011, 032, 033 (hiểu giờ) | unit 238/0 (HCM) + 245/0 (NY); QA tự chạy `scheduler.applyText`: "Tối ưu website", "Sáng tạo nội dung", "đọc 3/4 cuốn sách" → không nhắc; "thứ 6 tuần sau 10h30" → 23/10 10:30; "1h30 nữa" → 11:30; "nửa đêm" → 00:00 hôm sau; "nửa tiếng nữa" → 10:30 |
| BUG-012, 025 | reminder 1b, 8 xanh |
| BUG-013, 015 | layout 2–5 xanh, ảnh `l3-layout-all.png`: chuông/popup né cửa sổ bé, dời khi bé đi (phần còn lại: BUG-034) |
| BUG-023 | core2b 4b xanh trên main (persona tự tra intent) |
| BUG-026 | chip "báo đúng giờ", hết "quá hạn 0 giây" |
| BUG-027 | list-l3-1: "Đang hiện / Đã cất", "Cất đi / Hiện lên" |
| BUG-029 | bảng phím tắt đủ (thiếu Ctrl+Alt+G — nhỏ) |
| BUG-031 | data 6b xanh: giữ trường lạ trên note/reminder |
| BUG-051 | thoại thưởng dùng "xu" |
| BUG-052 | mẫu mèo: chữ nằm trên dòng kẻ |

## Đã sửa lượt 2
| Mã | Chứng cứ |
|---|---|
| BUG-001 File hỏng → khôi phục bản sao lưu | `data.test.js` 3b xanh: dùng `backups/` hôm qua, có `recoveredFrom`, `corruptCopy` |
| BUG-003 "thứ N tuần sau" ở `parse.js` | unit xanh (23/10 09:00). **Nhưng** đường note mới qua `understand()` mất nhắc → BUG-032 |
| BUG-006 Thùng rác | `list.test.js` 3c/3d/3e, `notes2.test.js` 4: xoá mềm, khôi phục, xoá hẳn 2 bước, dọn >30 ngày, note trong thùng không nhắc (kèm BUG-035/036/037) |
| BUG-008 `.bak` bị ghi đè | `data.test.js` 3c: giữ cả 2 bản `mochi-data.corrupt-*` |
| BUG-022 Ngăn sai kiểu | `data.test.js` 3d, `store-recovery.test.js`: bản gốc ở `mochi-data.section-<tên>-*.json` |
| BUG-014, BUG-023 | Chỉ trên `room/core` (`core2b.test.js` 4a, 4b) — sẽ đóng khi gộp |

## Chi tiết lỗi Nặng mới (lượt 3)

### BUG-055 — Xong nhắc 1 làm mất nhắc 2 của cùng note
- Phòng: core. `src/main/pet/mascotWindow.js:27` `dropNote(id)` huỷ MỌI mục sân khấu có `payload.noteId === id`; `:44-46` gọi nó khi `reminder:done`/`reminder:snoozed` mà bỏ qua `reminderId`. `stage.js:279,291` gọi `ctx.notes.completeNote/snoozeNote(p.noteId)` không truyền `reminderId` (có thể Xong/Hoãn nhầm nhắc chính); `validItem` chỉ xét `n.reminder`.
- Tái hiện: `bash test/e2e/run.sh test/e2e/reminder.test.js` → ca 7 ("họp 1 phút nữa / gọi khách 3 phút nữa") và 7c (2 nhắc +2 s/+4 s, bấm Xong nhắc 1 khi nhắc 2 đã chín và đang xếp hàng) đỏ: `stage.current()=null`, `size()=0`, nhắc 2 `fired=true, done=false`. QA chạy lại 2/2 đỏ; đọc mã xác nhận cơ chế (cùng mã trên `room/core` @4ceb710).
- Kỳ vọng: nhắc 2 vẫn lên sân khấu đúng giờ. Thực tế: bé im lặng — vi phạm "nhắc lịch phải tất định". Ảnh: `img/l3-reminder-2gio-sat-LOI.png`.
- Gợi ý: `dropNote(noteId, reminderId)` chỉ huỷ mục cùng `reminderId` khi có; truyền `p.reminderId` vào `completeNote/snoozeNote`.

## Chi tiết lỗi Nặng mới (lượt 2) — đã sửa lượt 3

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
