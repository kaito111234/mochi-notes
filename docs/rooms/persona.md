# Phòng 4 — Thoại & tính cách (`room/persona`)

**Sứ mệnh**: cho bé Mochi **một tính cách nhất quán** và **một bản yêu cầu vẽ đủ rõ** để họa sĩ (hoặc công cụ AI vẽ) làm ra bộ hình động đúng chuẩn.
Đọc trước: `CLAUDE.md`, `docs/spec/*.md` (00, 02, 03, 04), `docs/VPET-NOTES.md`, ảnh `art/source/character-sheet.png` (xem bằng Read).
File được sửa: xem `docs/spec/00-ownership.md` (dòng persona).

## Đợt 1 — việc cần giao
1. **Hồ sơ tính cách** `docs/persona/MOCHI.md`: lấy từ bảng nhân vật (cao 162cm, lạnh lùng với người lạ, hay ngại, thích ở một mình, thích mèo, dễ mềm lòng, hơi bướng, thích đồ ngọt, sợ côn trùng; câu "Đừng lo… tớ vẫn ở đây mà"). Cách xưng hô, từ hay dùng, điều không bao giờ nói, cách nhắc lịch (rõ trước, dễ thương sau), cách phản ứng khi người dùng trễ hạn (không trách móc nặng).
   Nhân vật là trợ lý đồng hành, lành mạnh: **không** nội dung lãng mạn/gợi cảm, không ghen tuông, không thao túng cảm xúc kiểu "cậu bỏ tớ thì tớ buồn chết".
2. **Kho thoại** `assets/dialogue/vi.json` đúng `docs/spec/04-dialogue.md`: ≥ 400 câu, phủ mọi `event`, có biến thể theo giờ/mode/intent (họp, gọi điện, hạn chót, uống thuốc, sức khoẻ, mua sắm, sinh nhật…). Câu nhắc lịch luôn chứa `{title}`/`{label}`.
3. **Bộ chọn thoại** `src/shared/dialogue.js` + test thuần (lọc điều kiện, trọng số, chống lặp 5 câu, thay biến, câu thiếu biến thì bỏ). Module main `src/main/persona/index.js` công bố `ctx.persona.pick(event, vars)` và nghe `game:mode`.
4. **Bản yêu cầu vẽ** `docs/art/ART-BRIEF.md` cho đúng danh sách action trong `03-animation.md`: mỗi action mô tả tư thế bằng lời, số khung gợi ý, thời lượng, phase start/loop/end, mood nào cần, điểm neo chân/tay/hitbox, kích thước canvas, quy ước tên file, ưu tiên (đợt vẽ 1 tối thiểu để app đẹp: idle, walk, lifted, fall/land, pat_head, sleep, hold_note, ring, happy). Kèm `docs/art/AI-PROMPTS.md`: mẫu prompt cho công cụ vẽ AI giữ đúng nhân vật (tóc xanh nhạt dài, mắt xanh lá, kẹp tóc chữ X + nơ đen, áo khoác đen viền trắng…), nhấn mạnh trang phục kín đáo, phong cách chibi dễ thương, nền trong suốt.
5. Bảng kiểm tra `docs/art/CHECKLIST.md` để người dùng tự đánh dấu hình nào đã có.

## Tiêu chí nghiệm thu
- `vi.json` hợp lệ JSON, đếm câu theo event in ra bằng một script nhỏ (ghi kết quả vào trạng thái).
- Test bộ chọn chạy xanh.
- ART-BRIEF đủ mọi action, đọc là vẽ được.

## Trạng thái
_Cập nhật 2026-10-15 — lượt 1 (Đợt 1)._

### Đã xong
- `docs/persona/MOCHI.md` — hồ sơ tính cách: nét tính cách + ví dụ, xưng hô tớ/cậu, điều cấm (bảng sai → sửa), công thức nhắc lịch "rõ trước, dễ thương sau" theo 10 intent, trễ hạn/hoãn, mode, mức thân theo level, checklist viết câu mới.
- `assets/dialogue/vi.json` — **507 câu**, phủ đủ 31 event, validate OK (không emoji, tớ/cậu, ≤80/≤120 ký tự, câu nhắc lịch luôn có `{title}`/`{label}`). Trưởng phòng đã đọc toàn bộ và sửa 10 câu (bỏ "mình" xưng hô, bỏ câu bắt người dùng gánh tâm trạng bé, bớt câu dễ hiểu thành thân mật).
- `src/shared/dialogue.js` — `pick`, `fill`, `matches`, `validate`, `EVENTS`, `REMIND_EVENTS` (UMD, dùng được ở main/renderer/test).
- `src/main/persona/index.js` — `ctx.persona = { pick(event, vars), lines, reload(), state() }`; ngăn `persona` = `{ recentLines, name, settings: { chatter, chatterEveryMin }, greeted }`.
- `docs/art/ART-BRIEF.md` (23 action, thông số, chi tiết từng action, quy trình giao), `docs/art/AI-PROMPTS.md`, `docs/art/CHECKLIST.md` (bảng sinh từ mục 3 ART-BRIEF nên khớp phase/đợt).

### Số câu theo event
| event | số | event | số | event | số |
|---|---|---|---|---|---|
| click | 18 | pat_head | 16 | pat_body | 10 |
| lift | 10 | drop | 8 | feed | 12 |
| idle | 33 | sleepy | 10 | wake | 10 |
| startup | 14 | shutdown | 10 | morning | 10 |
| noon | 8 | evening | 8 | late_night | 10 |
| pre | 48 | due | 64 | done | 22 |
| done_late | 14 | snooze | 14 | nag | 18 |
| alarm | 22 | alarm_stop | 10 | alarm_snooze | 10 |
| memo | 22 | reward | 14 | levelup | 12 |
| hungry | 10 | gacha_win | 12 | gacha_dup | 10 |
| note_created | 18 | | | **Tổng** | **507** |

pre/due theo intent: mỗi intent (meet, call, due, bday, pay, pill, health, buy, go, task) 4 câu pre / 5 câu due + câu chung (pre 8, due 14).

### Cách chạy
- Test: `node --test src/main/persona/test/*.test.js` (27 test xanh; truyền thư mục thay glob sẽ lỗi trên Node 22).
- Đếm + kiểm kho thoại: `node src/main/persona/tools/count-lines.js [file]` (exit 1 nếu lỗi).

### Quyết định đã chốt (phòng tự quyết, cần điều hành xác nhận)
- `cond.weekday` dùng 0=CN … 6=T7 (giống `Date.getDay()` và `Repeat.byDay`).
- `cond.hour` không vòng qua nửa đêm; muốn 23h–4h thì tách 2 câu `[23,23]` và `[0,4]`.
- Câu có `cond.intent` khớp `state.intent` được ưu tiên tuyệt đối so với câu chung (nhắc lịch theo loại việc rõ hơn).
- Memo dùng biến `{title}` = nội dung lời dặn.
- **Phân vai nói**: persona tự phát `persona:line` cho: `pet:interact` (p20), `app:startup` + chào buổi 1 lần/buổi/ngày (p15), `app:resume`→wake (p15, ≤1 lần/10 phút), `pet:idleTick` chatter (p10, mặc định 20 phút/lần, tắt được), `reminder:done`→done/done_late, `reminder:snoozed`→snooze, `alarm:stopped/snoozed`, `game:reward`, `game:levelup` (p30), và note_created khi một note **có giờ nhắc mới** (qua `note:created`/`note:updated`, p20). Persona **không** tự nói alarm/due/pre/memo/nag — core hỏi `ctx.persona.pick()` khi lên sân khấu (đúng hợp đồng 02), nên không trùng.
- Trường note đọc: `reminder.due`, `reminder.done`, `reminder.intent`, `text` (theo code 0.1).

### Đang dở / việc tiếp theo
1. Chưa chạy thử trong Electron thật (repo chưa có `node_modules`); mới test với ctx giả. Lượt sau: `npm i`, chạy xvfb, xem log `[persona]`.
2. Đợt 2: tăng biến thể theo mode/level/energy cho chatter; câu theo mùa/ngày lễ (Tết, Trung thu); câu khi người dùng đổi tên `{name}` (UI đổi tên thuộc phòng khác).
3. Khi phòng game chốt danh sách đồ ăn/gacha: câu riêng theo món (`cond` có thể cần khoá `item`).
4. Bong bóng chữ chạy dần là phần renderer của core; persona chỉ cấp text.

### Vướng mắc
- Không có. `tools/anim/` (core) chưa có nên ART-BRIEF ghi "khi có thì chạy".

## Đề xuất cho phòng điều hành
1. **Payload**: thêm `label` vào `alarm:stopped`/`alarm:snoozed` (persona đang tra `ctx.alarms.get(id)` hoặc `store.data.alarms.list` nếu không có); thêm `itemName` vào `pet:interact` kind `feed`; `game:mode` nên kèm `energy`, `mood`, `level` để thoại lọc theo chỉ số.
2. **Hợp đồng 04**: ghi rõ `weekday` 0=CN, `hour` không vòng nửa đêm, memo dùng `{title}`, ưu tiên câu khớp intent (như trên).
3. **Core**: khi `ctx.pet.stage` lên sân khấu cho alarm/due/pre/memo/nag, gọi `ctx.persona.pick(kind, { title, time, left, label, count, intent })` — `intent` lấy từ `note.reminder.intent` để có câu theo loại việc; `left` dạng "10 phút". Nghe `persona:line` để hiển thị bong bóng/face/anim theo priority.
4. **package.json/đóng gói**: loại `src/main/persona/test/**` và `src/main/persona/tools/**` khỏi `build.files` (hoặc chuyển sang `test/` của phòng qa); thêm script `"test:persona": "node --test src/main/persona/test/*.test.js"`.
5. Ngưỡng level thân mật trong MOCHI.md (1–3 / 4–8 / 9+) là đề xuất — phòng game xác nhận.
