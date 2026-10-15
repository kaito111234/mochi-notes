## core Đợt 2B — lượt 2 (nhánh `room/core` @610178f)
- Mã thử: worktree `/home/claude/wt-core` (core @610178f) VÀ bản gộp thử `git merge-tree main origin/room/core` (cây e3f1a4a, KHÔNG xung đột, giải nén vào scratchpad). Cả hai cho kết quả giống hệt.
- Lưu ý: `room/core` dựa trên main CŨ (merge-base ac8891b), chưa có 70ebdd3 (module `paper` trong `main.js`, store chống mất dữ liệu). Chạy riêng wt-core có lỗi log `paper:get` vì thiếu module paper — chỉ do worktree cũ, KHÔNG có trong bản gộp.
- Lệnh: `MOCHI_E2E_ROOT=/home/claude/wt-core bash test/e2e/run.sh test/e2e/core2b.test.js` (~6 phút). Trên main chưa gộp: `bash test/e2e/run.sh test/e2e/core2b.test.js` (14 test tự skip, 4 đỏ = lỗi cũ thật, 2 xanh).
- Kết quả trên core: **20 test: 17 pass, 3 fail** (1g, 4c, 4d = lỗi thật bên dưới). Hồi quy: `smoke.test.js` 2/2 xanh; `reminder.test.js` + smoke: 20 mục, 14 pass / 6 fail = 5 đỏ cũ đã biết (N-reminder-1 gồm 2 subtest + ca cha, BUG-012 ca 1b, BUG-025 ca 8; BUG-009 nằm trong subtest) + **ca 2a mới đỏ** do N-core-1.
- Ảnh: `docs/rooms/qa/img/l2-core-*` (tidy-1..5, knock-1/2, act-*, demo2-*, bug014/016/023/030, tidy-stale).

### Bảng
| Mục | Kết quả |
|---|---|
| 1a dọn note (hỏi → Dọn đi → mang/vo/ném → thùng rác → khôi phục) | XANH. Note vào `trash` (ghi xuống đĩa, có hạn giữ), cửa sổ note đóng, cửa sổ giấy + thùng rác đóng sau ~6 s, `note:trashed` + `pet:stageAction` có, `restore` trả note nguyên văn |
| 1b Giữ lại / 1c `tidyEnabled=false` / 1d autoTidy + overdue vẫn hỏi / 1e autoTidy + done tự dọn | XANH |
| 1f ứng viên hết hạn | XANH: loại đúng nhắc tương lai, chưa xong, vừa sửa < 10 phút, đang cất, checklist dở, nhắc lặp; note "xong cũ" là ứng viên. Quan sát: note **khoá** (`noteMeta.locked`) vẫn là ứng viên (đặc tả không nói); vẫn phải hỏi trước, không tự dọn |
| 1g sự kiện hết hạn "cũ" + autoTidy | ĐỎ → N-core-2 |
| 2a/2b/2c/2d gõ cửa (dùng `MOCHI_FAKE_FG`) | XANH: `pre` → bé tới cạnh cửa sổ giả, `pet:knock`, nhắc vẫn hiện đủ (bong bóng + tờ note + nút); lần 2 trong 15 phút không gõ; `knockEnabled=false` / bé tắt / cửa sổ < 200x150 / không có foreground → không gõ; bé tắt vẫn có Notification dự phòng. **Chưa thử được trên Windows thật** (PowerShell + user32 chỉ chạy trên win32) |
| 3a/3b/3c 11 hành động | XANH: cả 11 (+ point, write) có khung ở `placeholder`, `play()` kết thúc 0,4–1,1 s, hành động lạ rơi về `idle`, gói thiếu hình về `idle`, không lỗi console/main; `MOCHI_PET_DEMO2=cheer|read|cat|peeknote|sleep|note` chạy sạch |
| 4a BUG-014 | **ĐÃ SỬA** — cả 5 giá trị `when` ra đúng nhãn ("Lúc mở máy"…), `when` số không còn NaN. Main: đỏ |
| 4b BUG-023 | **ĐÃ SỬA** — call/meet/pill, mỗi loại 3 lần, bong bóng luôn là câu `due` đúng intent. Main: đỏ |
| 4c BUG-030 | **CÒN** (xem dưới) |
| 4c2 BUG-030 (tiêu đề "Mochi Note") | ĐÃ SỬA (đã đúng "Mochi Notes" ngay trên main) |
| 4d BUG-016 | **MỘT PHẦN**: tờ note không còn cắt mép phải (tờ nằm trong cửa sổ bé, lề trái bé, trong màn hình) nhưng dòng phụ vẫn bị cắt "09:19 hôm nay · Gọi…" |
| 4e BUG-024 | **MỘT PHẦN**: CPU rảnh 30 s, mọi tiến trình Electron, 1 note + bé: core 3,2 / 3,3 / 3,4 / 3,6 / 5,3% (mid 3,4%); main 4,9 / 5,1 / 5,2% (main không có bé luôn hiện); bản gộp 5,4%. Mục tiêu `core.md` < 3%. Máy 2 CPU, tải thay đổi nên nhiễu ±1% |

### N-core-1: Nhắc `due` lên sân khấu chậm ~6 giây vì bé đi bộ trước rồi mới nói
- Mức: Vừa — Phòng: core (`src/main/pet/stage.js:359-366` chờ `tryPoint`/`goToCorner` tối đa 6 s mỗi bước trước khi `say`; `src/main/petcore/body.js:291-292` tốc độ đi ~37 px/s, cố ý chậm; `goToCorner` chừa lề 220 px mép phải từ sửa BUG-016 nên bé đứng ở góc mặc định luôn phải đi ~220 px)
- Tái hiện: `MOCHI_E2E_ROOT=/home/claude/wt-core xvfb-run … node --test --test-name-pattern='^2a\.' test/e2e/reminder.test.js` (đỏ 2/2 trên core, xanh trên main). Đo: stage có mục `due` lúc +3 ms, bong bóng hiện lúc **+6,5 s** (đo 6,6 s và 5,7 s); main: +80 ms. Vị trí bé giảm đều 1288→1062 px, tới sát lúc hết timeout 6 s.
- Kỳ vọng: nhắc đúng giờ hiện lời nhắc ngay (tất định); hiệu ứng đi tới note/góc nên diễn song song với bong bóng hoặc nhanh hơn. Thực tế: lời nhắc (và nút Xong/Hoãn) trễ tới 6 s, tệ nhất có thể cộng hai lần chờ (tryPoint rồi goToCorner). Không mất nhắc, thông báo dự phòng vẫn đúng.
- Hệ quả: `reminder.test.js` ca 2a (chờ cố định 2,5 s) đỏ trên core; sửa test hoặc sửa core, trưởng phòng quyết (QA không sửa file đó).
- Ảnh: không (số đo trong log).

### N-core-2: `autoTidy` tự dọn note chưa xong khi nhận sự kiện `note:expired` cũ/giả (không kiểm lại với notes)
- Mức: Vừa (note vẫn vào thùng rác, khôi phục được; nhưng "tự dọn mà không hỏi" nhầm note đang dùng) — Phòng: core (`src/main/petcore/tidy.js:215-228` `request()` tin `reason` của sự kiện; `src/main/pet/stage.js:91` `validItem` cho `tidy` chỉ kiểm note còn tồn tại và đang hiện)
- Tái hiện: `MOCHI_E2E_ROOT=/home/claude/wt-core bash test/e2e/run.sh test/e2e/core2b.test.js` ca 1g: `setSettings({autoTidy:true})`, note "Họp lúc 9h sáng mai" CHƯA xong, nhắc tương lai, rồi phát `note:expired {reason:'done'}` → ~8 s sau note vào thùng rác không hỏi. Kịch bản thật: sự kiện xếp hàng (tối đa 30 phút, `ttlMs`) trong khi người dùng đã mở lại/đặt nhắc mới cho note.
- Kỳ vọng: trước khi dọn (nhất là `auto`), gọi lại `ctx.notes.expiredCandidates()` và bỏ nếu note không còn là ứng viên. Thực tế: dọn theo sự kiện cũ.
- Ảnh: `docs/rooms/qa/img/l2-core-tidy-stale-LOI.png`

### BUG-030 CÒN: "Hoãn N phút" vẫn luôn là 10 dù Cài đặt đặt 20
- Tái hiện: ca 4c: `ctx.store.section('alarms').settings.defaultSnoozeMin = 20` (đúng chỗ giao diện Cài đặt ghi qua IPC `alarm:settings`), note đến hạn → nút "Hoãn 10 phút", bấm → due +10 phút.
- Nguyên nhân: `stage.js:117-128` `snoozeMinutes()` tìm `ctx.alarms.settings()` / `ctx.alarms.settings` — **không tồn tại** (`ctx.alarms` chỉ có list/create/update/remove/stop/snooze/isRinging/ringBounds/ring, `alarmService.js:344`) và `ctx.store.data.alarms.settings` — **không tồn tại** (ngăn tách bằng `store.section`, không nằm trong `store.data`). Luôn rơi về 10. Sửa: dùng `ctx.store.section('alarms')` (có `.settings.defaultSnoozeMin`) hoặc nhờ phòng notes công bố `ctx.alarms.settings()`.
- Ảnh: `docs/rooms/qa/img/l2-core-bug030-LOI.png`

### BUG-016 MỘT PHẦN
- Cạnh phải: ĐÃ SỬA (tờ note ở x 30–160 trong cửa sổ 300 px, bé sát mép phải màn hình; không tràn).
- Còn: dòng phụ tờ note cắt "…" (`#sheet .meta` ở `src/pet/pet.css:38`, `nowrap + ellipsis`, rộng 102 px, chữ cần 119 px) → "09:19 hôm nay · Gọi…". Nhẹ.
- Ảnh: `docs/rooms/qa/img/l2-core-bug016-LOI.png`

### Quan sát khác (không phải lỗi)
- Bé chỉ gõ cho `pre`/`nag`, không gõ cho `due` (đúng hợp đồng ARCH K); người dùng nói "tới giờ" có thể mong gõ cả lúc `due`.
- Hỏi dọn tối đa 1 lần/10 phút, xếp hàng tối đa 3 (đúng hợp đồng); trong lúc bé mang giấy, nút bong bóng bị làm mờ nhưng bong bóng vẫn còn tới hết màn diễn.
- xvfb không có compositor: cửa sổ trong suốt (giấy, thùng) hiện khối đen ở viền; ảnh thùng rác/giấy vẫn rõ.
