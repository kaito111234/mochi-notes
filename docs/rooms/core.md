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

## Trạng thái Đợt 2
_Cập nhật 2026-10-15 — lượt 2 (Đợt 2). Kiến trúc & chia file nội bộ: `docs/rooms/core/ARCH.md` phần "Đợt 2"._

**Quyết định của trưởng phòng (không hỏi lại được)**
- Gói tạm **chép** sang `assets/pet/placeholder/` (không xoá `assets/pet/mochi/` vì thư mục đó nay thuộc phòng art — tránh xung đột gộp). Engine nạp `mochi` làm gói chính, action thiếu thì mượn từ `placeholder` (`pack.loadCharacter`, khung mượn dùng URL `file:` tuyệt đối + co giãn `fit`).
- Thêm 3 action ngoài danh sách 03-animation: `climb` (bám tường phải), `point` (chỉ tay sang phải), `write` (ghi chép) — có trong placeholder, thiếu thì fallback `idle`. Xem đề xuất 1.
- Nháy viền note làm bằng **cửa sổ phủ trong suốt của core** (`petcore/flash.js`), không đụng cửa sổ note của phòng paper; vẫn phát `pet:pointNote` cho ai muốn làm hiệu ứng riêng.
- Chuỗi đọc lại khi ghi nhanh dùng câu của core (`lines.captureSavedTime`), không dùng `persona.pick('note_created')` vì câu persona lạc đề (ví dụ "Sinh nhật hả?…").

**Đã xong**
1. Bé ghi note giúp: bấm đúp thân bé / menu "Ghi nhanh" → bong bóng nhập "Cậu muốn tớ ghi gì?" (Enter lưu, Shift+Enter xuống dòng, Esc huỷ, nháp lưu `pet.draft`); gọi `ctx.notes.quickCapture(text,{source})` nếu có, chưa có thì `ctx.notes.createNote({html})`; bé đọc lại "Ghi xong rồi. Tới 15:00 tớ báo cậu họp nhóm 15h nha". Kéo-thả chữ/link vào bé → tạo note (`dropText`). Nhắc lịch chen ngang thì ô nhập tạm đóng, giữ nháp.
2. Menu chuột phải trên bé (`petcore/menu.js`): Ghi nhanh · Note mới · Danh sách note · Báo thức… · Ẩn/hiện tất cả note · Cho bé ngủ · Ẩn bé 1 giờ · Bé đi lại · Cỡ bé · Cài đặt bé… (cửa sổ `src/pet/settings.*`: luôn trên desktop, đi lại, leo tường, theo con trỏ, cỡ 75–150%).
3. Tự do hơn: leo tường trái/phải (chỉ mép ngoài cùng), đi trên cạnh trên note / nhảy lên-xuống note / ngồi trên note, thỉnh thoảng đi theo con trỏ ≤ 6s, nấp mép; không tự di chuyển che con trỏ; tôn trọng `walkEnabled`, `climbEnabled`, `followCursor`.
4. Bé gắn với note: nhắc note đang dán → bé đi tới cạnh note (hoặc lên mép trên note nếu note lơ lửng cao), chỉ tay `point`, viền note nháy hồng, bong bóng + nút như cũ; note ẩn → giơ tờ note mini như Đợt 1. Mọi đường lỗi có timeout 6s rồi rơi về `hold_note` (nhắc lịch tất định).
5. `ctx.pet.occupiedRect()` + bus `pet:moved {rect}` (≤ 4 lần/s khi di chuyển + 1 lần khi dừng). Sửa tờ note sát mép phải (`goToCorner` chừa lề 220px cho tờ note; bong bóng/tờ note kẹp trong cửa sổ).
6. Nhớ vị trí (lưu debounce 2s mỗi lần dừng, khôi phục khi khởi động). `ctx.pet.hideFor(ms)` (Ẩn bé 1 giờ — nhắc lịch vẫn hiện bé, xong lại ẩn tới hết giờ).

**Nghiệm thu** (xvfb; ảnh `docs/rooms/core/d2-*.png`)
- `d2-01-ghi-nhanh.png`, `d2-02-ghi-xong.png`, `d2-03-chi-vao-note.png`, `d2-04-leo-tuong.png`, `d2-05-tren-note.png`, `d2-06-cai-dat.png`, `d2-07-menu.png`. (xvfb không có compositor nên cửa sổ trong suốt chồng lên note hiện khối đen; ở d2-03 phần ruột note được ghép lại từ ảnh trước khi nháy.)
- Luồng 0.1: note "Uống nước nè, 1 phút nữa" → ~61s bé đi tới chỉ vào note; bấm "Xong rồi" (MOCHI_PET_CLICK) → `reminder.done=true`.
- Ẩn 1 giờ → nhắc lịch vẫn hiện bé. Khởi động lại → bé đứng đúng chỗ cũ.
- CPU đứng yên (30s, mọi tiến trình Electron, 2 note): **2,6%** một nhân (trước khi chỉnh idle ≥ 260ms/khung: 3,7–4,0%); tắt bé: 0,6%.
- `node tools/anim/validate.js assets/pet/placeholder` OK; `node tools/anim/test-pack.js` OK; `npm test` đạt hết.

**Cách chạy thử**: như Đợt 1, thêm biến gỡ lỗi: `MOCHI_PET_DEMO=capture` (+ `MOCHI_PET_TYPE="họp nhóm 15h"`, `MOCHI_PET_ENTER=<ms>`), `menu`, `settings`, `hide`, `drop`, `point`, `done` (+ `MOCHI_PET_NOTEY`); `MOCHI_PET_DEMO2=climb|note|follow`; `MOCHI_PET_NOPOLL=1` (tắt dò con trỏ trên Linux).

**Đang dở / việc tiếp theo**
1. Thử trên Windows bằng chuột thật: chuột phải → menu, bấm đúp → ô nhập (focus bàn phím, bộ gõ tiếng Việt), kéo-thả chữ/link từ trình duyệt vào bé khi cửa sổ đang click xuyên, leo tường, đa màn hình/DPI, taskbar trái/phải.
2. Bong bóng khi bé đứng cạnh note có thể che mép note vài chục px — chỉnh `gap` trong `goToNote` hoặc đặt bong bóng lệch ra phía ngoài note.
3. Note lơ lửng cao không có chỗ đứng trên mép → bé đứng dưới sàn khá xa note (mô hình sàn không cho lơ lửng). Có thể cho bé leo cạnh note.
4. Sprite placeholder `write`/`climb` bị cắt mép; chờ hình thật của phòng art (cần thêm `climb`, `point`, `write` vào ART-BRIEF).
5. Khi phòng notes có `ctx.notes.quickCapture` trả `insight` → đọc lại phong phú hơn (nhiều mục giờ, checklist).
6. Xoá `src/mascot/*` khi điều hành bỏ `paths.mascotHtml`.

**Vướng mắc**: không có.

## Đề xuất cho phòng điều hành (Đợt 2)
1. `docs/spec/03-animation.md`: thêm action tuỳ chọn `climb` (bám tường, hình gốc bám tường bên phải), `point` (chỉ tay sang phải), `write` (ghi chép); và nói rõ gói `placeholder` là dự phòng theo từng action. Báo phòng persona/art bổ sung vào `docs/art/ART-BRIEF.md`. Phòng art có thể xoá nội dung tạm trong `assets/pet/mochi/` bất cứ lúc nào — engine tự mượn từ placeholder.
2. `docs/spec/02-events.md`: thêm `pet:moved {rect}` (core, rect DIP màn hình của thân bé) , `pet:pointNote {noteId, on}` (core), và API `ctx.pet.occupiedRect()`, `ctx.pet.hideFor(ms)`, `ctx.pet.flashNote(noteId, ms)`, `ctx.pet.capture.open()`.
3. `docs/spec/01-data.md` ngăn `pet`: thêm `draft: string`, `hiddenUntil: number`, `settings.climbEnabled`, `settings.followCursor` (bool, mặc định true).
4. `tray.js`: thêm "Ghi nhanh với bé" → `ctx.pet.capture.open()`, "Cài đặt bé…" (cần core công bố `ctx.pet.openSettings` — core sẵn sàng thêm nếu đồng ý), "Cho bé leo tường" (`climbEnabled`). Phím tắt gợi ý Ctrl+Alt+Space → ghi nhanh.
5. Gửi phòng notes: `ctx.notes.quickCapture(text, {source:'pet'|'drop'})` nên trả `{note, insight}`, KHÔNG tự mở cửa sổ note đè lên bé khi `source` là `pet` (hoặc mở cạnh bé); cửa sổ chuông/dặn dò né `ctx.pet.occupiedRect()` / nghe `pet:moved`.
6. Gửi phòng paper: có thể nghe `pet:pointNote` (qua kênh `paper:*` của mình) để làm hiệu ứng riêng trong note; khi đó core sẽ tắt cửa sổ viền nháy để không trùng.
