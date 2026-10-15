# Phòng 1 — Lõi nhân vật (`room/core`)

**Sứ mệnh**: biến bé Mochi từ "ảnh ló lên góc màn hình" thành **thú ảo sống trên desktop** như VPet, đồng thời là người đưa tin nhắc lịch đáng tin cậy.
Đọc trước: `CLAUDE.md`, `docs/spec/*.md` (nhất là 00, 02, 03), `docs/VPET-NOTES.md`, code hiện có `src/main/pet/*`, `src/mascot/*`.
File được sửa: xem `docs/spec/00-ownership.md` (dòng core).

## Đợt 1 — việc cần giao
1. **Engine hình động** (renderer, canvas): đọc gói theo `docs/spec/03-animation.md`, chạy Start → Loop → End, fallback mood/action, thời lượng khung từ tên file, nạp trước + cache (không giật). API renderer gọn: `play(action, {mood, loop, onEnd})`.
2. **Gói hình tạm** `assets/pet/mochi/` sinh tự động từ 18 ảnh bán thân trong `assets/mascot/` (biến đổi: nhún, nghiêng, lật, đổi biểu cảm theo khung) + `faces/`, đủ mọi action trong danh sách để test. Viết `tools/anim/validate.js` (báo thiếu gì, sai kích thước) và `tools/anim/make-placeholder.js`.
3. **Cửa sổ bé** kiểu VPet: cửa sổ trong suốt cỡ nhân vật, luôn nổi, di chuyển bằng cách dời cửa sổ; click-through phần trong suốt. Chế độ mặc định mới: **bé luôn ở trên desktop** (đứng trên mép taskbar), có thể tắt trong cài đặt → khi tắt, bé chỉ hiện lúc nhắc lịch như 0.1.
4. **Tương tác**: nhấn giữ 300ms để nhấc kéo đi (tư thế `lifted`), thả ra thì rơi (`fall` → `land`) xuống mép taskbar hoặc cạnh trên một cửa sổ note đang dán; rê chuột qua lại trên đầu = xoa đầu (`pat_head`), trên thân = `pat_body`; click = nói. Phát `pet:interact`.
5. **Đi lại & hành vi rảnh**: tick 15s, xúc xắc theo thời gian yên lặng (VPet): đi dọc taskbar, ngồi, ngủ khi lâu không ai đụng / máy rảnh (`app:idle`), dậy khi `app:resume`; bị kéo ra quá mép thì nấp (`peek_left/right`). Nhiều màn hình, DPI. Không bao giờ che con trỏ hay chặn click ngoài thân bé.
6. **Đạo diễn sân khấu** `ctx.pet.stage` đúng `docs/spec/02-events.md`; giữ `ctx.pet.enqueue(event)` cũ hoạt động (bọc sang stage) để phòng notes không bị gãy. Khi nhắc lịch: bé (đang ở đâu thì) chạy/nhảy tới góc gần nhất, **giơ tờ note** (`hold_note`, gắn tờ note tại `pack.hand`) + bong bóng + nút như 0.1. Báo thức (`alarm`, ưu tiên 100) dùng `ring`.
7. Nghe `game:mode` (nếu chưa có thì mặc định `normal`) để chọn mood hình.

## Tiêu chí nghiệm thu (chụp xvfb lưu vào `docs/rooms/core/`)
- Ảnh: bé đứng trên đáy màn hình; đang bị nhấc; đang ngủ; đang giơ note nhắc lịch.
- Luồng 0.1 vẫn chạy: note "Uống nước nè, 1 phút nữa" → bé giơ note sau ~1 phút, các nút Xong/Hoãn/Mở note hoạt động.
- `node tools/anim/validate.js assets/pet/mochi` không lỗi. CPU khi bé đứng yên thấp (đo sơ bộ, ghi số).

## Trạng thái
_Cập nhật 2026-10-15 — lượt 1 (Đợt 1)._

**Đã xong** (kiến trúc nội bộ: `docs/rooms/core/ARCH.md`)
- Engine hình động `src/pet/anim.js`: Start→Loop→End, fallback mood/action, khung theo `_<ms>`, nạp trước + cache ImageBitmap, hẹn giờ theo khung (không rAF), `alphaAt` để click xuyên.
- Gói hình tạm `assets/pet/mochi/` (23 action, 174 khung, 5,9 MB) sinh bằng `node tools/anim/make-placeholder.js` từ 18 ảnh bán thân; `tools/anim/validate.js` → `OK (0 cảnh báo)`; `tools/anim/png.js` (PNG thuần Node, không thư viện).
- Cửa sổ bé `src/pet/pet.*` + `src/main/petcore/` (window/body/brain/index, ngăn dữ liệu `pet`): trong suốt, luôn nổi, click xuyên phần trong suốt; mặc định **bé luôn ở trên desktop** đứng trên mép taskbar (`pet.settings.alwaysVisible`, tắt → chỉ hiện khi nhắc lịch); nhấn giữ 300ms nhấc, thả rơi xuống taskbar/cạnh trên note, nấp mép; xoa đầu/thân bằng rê chuột; click nói; đi lại/ngồi/ngủ theo tick 15s; ngủ khi `app:idle`, dậy khi `app:resume`; nghe `game:mode`; đa màn hình.
- Đạo diễn `ctx.pet.stage` (`src/main/pet/stage.js`) đúng 02-events, API cũ `ctx.pet.enqueue/...` bọc sang stage; nhắc lịch: bé chạy/nhảy tới góc, giơ tờ note + bong bóng + nút như 0.1; báo thức `ring`; thông báo Windows dự phòng khi bé tắt/không sẵn sàng 5s. Câu mặc định `src/main/pet/lines.js`, dùng `ctx.persona.pick` nếu có.
- Linux/xvfb: Electron không forward chuột khi click xuyên → main dò con trỏ 80ms (chỉ ngoài Windows/macOS) và hỏi renderer (op `pointer`).

**Nghiệm thu** (ảnh trong `docs/rooms/core/`)
- `01-dung-tren-day-man-hinh.png`, `02-dang-bi-nhac.png`, `03-dang-ngu.png`, `04-gio-note-nhac-lich.png`, `05-bam-xong-roi.png`.
- Luồng 0.1: note "Uống nước nè, 1 phút nữa" → ~70s sau bé giơ note; bấm thử bằng sự kiện chuột thật của renderer: **Xong rồi** → `reminder.done=true`; **Hoãn 10 phút** → due +10 phút; **Mở note** → note được mở/focus.
- CPU khi bé đứng yên (xvfb, `--disable-gpu`, tổng mọi tiến trình Electron kể cả 1 note): ~2,5% một nhân, đo 30s.

**Cách chạy thử**
- Kiểm gói: `node tools/anim/validate.js assets/pet/mochi`; sinh lại: `node tools/anim/make-placeholder.js`.
- App: `XDG_CONFIG_HOME=$(mktemp -d) xvfb-run -a -s "-screen 0 1440x900x24" ./node_modules/.bin/electron . --no-sandbox --disable-gpu`
- Biến môi trường gỡ lỗi: `MOCHI_PET_DEMO=lifted|sleep|walk|peek`; `MOCHI_PET_LOG=1` (log tin renderer); `MOCHI_PET_CLICK="x,y,ms[;...]"` (giả lập click trong cửa sổ bé sau ms — xvfb ở đây không di được chuột bằng xdotool).

**Đang dở / việc tiếp theo**
1. Kéo-nhấc-thả, xoa đầu, đứng trên note, đa màn hình/DPI mới chạy qua demo — cần thử bằng chuột thật trên Windows.
2. Hình tạm: tư thế `sit` hơi lạ, đường nối ở cổ khi nghiêng; chờ hình thật theo `docs/art/ART-BRIEF.md` (phòng persona).
3. Tờ note khi bé đứng sát mép phải có thể chạm mép màn hình — nên để `goToCorner` chừa thêm lề theo bề rộng tờ note.
4. Chưa có giao diện cài đặt cho `pet.settings` (alwaysVisible/scale/walkEnabled) — xem đề xuất 1.
5. Chưa có test tự động trong repo (test stage.js đang ở /tmp) — chuyển cho phòng qa (`test/**`).
6. Cửa sổ cũ `src/mascot/*` không còn được mở; xoá ở Đợt 2 khi phòng điều hành bỏ `paths.mascotHtml`.

**Vướng mắc**: không có.

## Đề xuất cho phòng điều hành
1. `tray.js`: mục "Bé ngồi góc màn hình" (đang toggle `settings.mascotIdle`, mặc định false) → đổi thành "Bé luôn ở trên desktop", đọc/ghi `ctx.pet.settings().alwaysVisible` / `ctx.pet.setSettings({alwaysVisible})` (mặc định true). Hiện core chép `mascotIdle` → `alwaysVisible` khi nó đổi nên menu cũ vẫn chạy, nhưng dấu tick có thể không khớp lúc đầu. Thêm mục "Cho bé đi lại" (`walkEnabled`) và cỡ bé (`scale` 0.75/1/1.25) nếu được.
2. `main.js` dòng `if (mascotIdle && mascotEnabled) ctx.pet.ensureMascot()` không còn cần (core tự hiện bé ở `app:startup`); để nguyên cũng vô hại.
3. `context.js`: thêm `windows.pet` vào khai báo (core đang gán `ctx.windows.pet`); `paths.mascotHtml` có thể bỏ ở Đợt 2.
4. Gửi phòng notes: báo thức gọi `ctx.pet.stage.request({kind:'alarm', payload:{alarmId, label, noteId?, snoozeMin?, onAction?(id)}})` hoặc `ctx.pet.enqueue({type:'alarm', ...})` — core cũng nghe `alarm:ring`/`memo:due` và chống trùng theo id, nên chỉ phát bus cũng đủ. Nút trên bé gọi `ctx.alarms.stop(alarmId)` / `ctx.alarms.snooze(alarmId, min)` nếu có và phát `pet:stageAction`. `alarm:stopped`/`alarm:snoozed` làm bé thôi kêu.
5. Gửi phòng persona: core gọi `ctx.persona.pick(event, vars)` với event `click`, `pat_head`, `pat_body`, `pre`, `due`, `nag`, `alarm`, `memo`, `done`, `snooze`, `startup`…; vars `{title, time, left, label, count}`.
6. Bổ sung 02-events: sự kiện `pet:stageAction {stageId, kind, button, alarmId?, noteId?, memoId?}` (core phát khi người dùng bấm nút trên bé).

---
# ĐỢT 2 — việc mới (phòng điều hành giao)
Chủ dự án muốn **"một pet tự do trên màn hình, tương tác và giúp tôi note"**. **Mất quyền `assets/pet/mochi/**`** (sang phòng art): chuyển gói hình tạm sang `assets/pet/placeholder/`, engine nạp `mochi` nếu có, thiếu action nào thì lấy từ `placeholder`.
1. **Bé ghi note giúp**: bấm đúp vào bé (hoặc menu chuột phải "Ghi nhanh") → bong bóng có ô nhập "Cậu muốn tớ ghi gì?" (Enter để lưu, Esc huỷ, nhớ nháp), gọi `ctx.notes.quickCapture(text)` (phòng notes làm; chưa có thì tạo note qua `ctx.notes.create`) → bé đọc lại điều đã hiểu ("Tớ ghi rồi nha. 15:00 tớ nhắc cậu họp"). Kéo-thả chữ/đường link vào bé cũng tạo note.
2. **Menu chuột phải trên bé**: Ghi nhanh · Note mới · Danh sách note · Báo thức · Ẩn/hiện tất cả note · Cho bé ngủ · Ẩn bé 1 giờ · Bé đi lại (bật/tắt) · Cỡ bé · Cài đặt bé.
3. **Tự do hơn trên màn hình** (VPet): leo cạnh trái/phải màn hình, đi trên mép trên các cửa sổ note đang dán, ngồi lên note, thỉnh thoảng đi theo con trỏ một đoạn, nấp mép; không bao giờ che con trỏ hay chặn thao tác; tôn trọng `walkEnabled`.
4. **Bé gắn với note**: khi nhắc một note đang dán, bé đi tới cạnh cửa sổ note đó, chỉ vào nó (note nháy viền); khi note bị ẩn thì bé giơ tờ note mini như hiện nay.
5. **Vùng chiếm chỗ**: công bố `ctx.pet.occupiedRect()` + phát `pet:moved {rect}` để cửa sổ chuông/dặn dò của notes né bé; sửa lỗi tờ note sát mép phải.
6. Giữ ổn định: CPU khi đứng yên < 3% một nhân; nhiều màn hình; khởi động lại nhớ vị trí bé.

## ĐỢT 2B — chủ dự án bổ sung (làm sau Đợt 2, hoặc cùng lượt nếu kịp)
Chủ dự án: "Mochi không chỉ ở dưới taskbar mà còn **tương tác được với thẻ note đang treo**; hết hạn thì **tháo xuống, vo tròn rồi ném vào thùng**; lâu lâu **hiện ra vỗ vỗ vào cái app** để nhắc; thêm nhiều hành động".
1. **Dọn note hết hạn**: khi notes báo note "hết hạn" (API `ctx.notes.expiredCandidates()` — phòng notes làm), bé đi tới cửa sổ note đó, hỏi bằng bong bóng "Note này xong/hết hạn rồi, tớ dọn nha?" [Dọn đi] [Giữ lại]. Đồng ý → bé "gỡ" note: cửa sổ note bị kéo theo tay bé (dời cửa sổ theo bé), co lại thành cục giấy (hiệu ứng vo), bé ném vào **thùng rác hiện ra cạnh taskbar** (cửa sổ nhỏ tạm), gọi `ctx.notes.trash(noteId)` (xoá mềm, khôi phục được). **Không bao giờ tự xoá khi chưa hỏi**; có cài đặt "tự dọn note đã xong" (mặc định tắt).
2. **Vỗ vào app để nhắc**: khi có việc quá hạn/sắp tới mà người dùng đang làm ở app khác, thỉnh thoảng (tối đa 1 lần/15 phút, tôn trọng chế độ "Đừng làm phiền"/đang trình chiếu toàn màn hình) bé chạy tới **mép cửa sổ đang dùng** và gõ cộc cộc (hành động `knock`, rung nhẹ cửa sổ bé, tiếng gõ nhỏ). Lấy vị trí cửa sổ đang dùng trên Windows bằng PowerShell + user32 (`GetForegroundWindow`/`GetWindowRect`) chạy nền, không cần module native; nền tảng khác thì bỏ qua.
3. **Thêm hành động** (dùng hình tạm, ghi danh sách cho art): `knock`, `carry_note` (mang note), `crumple` (vo giấy), `throw` (ném), `point` (chỉ vào note), `peek_note` (thò đầu sau note), `sit_on_note`, `climb` (leo mép), `yawn`, `stretch`, `read` (đọc note), `write` (ghi note giúp), `cheer` (khi xong việc), `eat`, `play_cat` (chơi với mèo đen). Đi kèm thoại qua `ctx.persona.pick`.
4. Nghe `game:outfit` để đổi bộ hình đang mặc khi art có (tạm thời ghi nhận, chưa cần vẽ).
5. Menu chuột phải trên bé thêm "Phòng của Mochi" (mở cửa sổ game — kênh do phòng game công bố).
