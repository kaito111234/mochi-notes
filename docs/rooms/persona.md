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
_Cập nhật 2026-10-15 — lượt 2 (tích hợp Đợt 2/2B). Đợt 1 đã xong và đã gộp vào main (xem lịch sử git)._

### Đã xong lượt này
- **Bỏ nói trùng** (phát hiện khi đọc code các phòng sau Đợt 2):
  - `click`/`pat_head`/`pat_body`: petcore/brain.js đã tự nói → persona chỉ còn tự nói `lift`/`drop`.
  - `feed`, `gacha_*`: game tự `speak()` → persona không nói.
  - `done`/`done_late`/`snooze`: hoãn 400ms, huỷ nếu có `pet:stageAction` cùng `noteId` (bấm nút trên bé thì core đã nói).
  - `reward`: im nếu trong 5s vừa có câu priority ≥ 30 hoặc đang chờ câu done (tránh "xong rồi" + "được kẹo" dồn dập). `levelup` vẫn nói.
- **Nhiều nhắc/note** (hợp đồng 01 mới): `remindersOf(note)`; `overdue` đếm theo `reminders`; `note_created` phát hiện nhắc mới theo khoá `id:due`, dùng `r.title`/`r.intent`; `reminder:done/snoozed` dùng `reminderId`. Payload `note:created` có `source:'pet'` thì im (chờ notes thêm, xem đề xuất).
- `game:mode` lấy thêm `level`.
- **Intent nghiêm** trong `dialogue.matches`: câu có `cond.intent` chỉ khớp khi state có intent đó (trước đây note thường có thể nhận câu "nhắc uống thuốc").
- **Event mới** (đã có trong `EVENTS` của dialogue.js, cần điều hành ghi vào spec 04): `due_again` (core đã dùng trong stage.js), `knock` (Đợt 2B bé gõ app), `outfit` (persona tự nói khi `game:outfit` đổi/thêm món, bỏ qua lần phát đầu), `expired_done|expired_overdue|expired_checklist` (persona tự nói khi `note:expired`, p15, ≤1 câu/30s, trừ khi `ctx.pet.tossesNotes === true`).
- **Kho thoại +132 câu → 639**: due_again 30 (10 chung + 2/intent), idle +40 theo level (1–3/4–8/9+), năng lượng thấp, mode sad, buổi chiều; outfit 16; knock 16; expired_* 30. Trưởng phòng đã đọc hết và sửa 4 câu.
- Chạy thử Electron thật (xvfb, `MOCHI_DEV_CAPTURE`): persona nạp được, không lỗi, ngăn `persona` lưu đúng.

### Số câu theo event (tổng 639)
click 18, pat_head 16, pat_body 10, lift 10, drop 8, feed 12, idle 73, sleepy 10, wake 10, startup 14, shutdown 10, morning 10, noon 8, evening 8, late_night 10, pre 48, due 64, due_again 30, done 22, done_late 14, snooze 14, nag 18, alarm 22, alarm_stop 10, alarm_snooze 10, memo 22, reward 14, levelup 12, hungry 10, gacha_win 12, gacha_dup 10, note_created 18, knock 16, outfit 16, expired_done 10, expired_overdue 10, expired_checklist 10.

### Cách chạy
- Test: `node --test src/main/persona/test/*.test.js` (35 test xanh).
- Đếm + kiểm kho thoại: `node src/main/persona/tools/count-lines.js [file]` (exit 1 nếu lỗi).

### Quyết định đã chốt (phòng tự quyết)
- Như lượt 1 (đã được điều hành ghi vào spec 04), thêm: intent nghiêm; 6 event mới ở trên; persona không nói click/pat/feed.

### Việc tiếp theo
1. Câu theo mùa/ngày lễ (Tết, Trung thu, Giáng sinh) — cần khoá `cond.date` (xem đề xuất 3).
2. Câu riêng theo món ăn/gacha khi game chốt danh mục.
3. `hungry` chưa ai phát — chờ game có chỉ số đói hoặc bỏ event.
4. Cập nhật `docs/art/ART-BRIEF.md` khi spec 03 thêm action Đợt 2B (vo note, ném, gõ cửa sổ, thay đồ).

### Vướng mắc
- Chạy thử thấy ghi nhanh qua bé có nhắc thì bé nói 2 câu (quickCapture đọc lại giờ + persona `note_created`) — chờ đề xuất 1.

## Đề xuất cho phòng điều hành
1. **notes** (`insightService.quickCapture`): phát `note:created` kèm `source: 'pet'` (cả nhánh `N.createNote`) để persona không nói `note_created` trùng câu đọc lại giờ. Persona đã sẵn sàng nhận.
2. **Spec 04**: thêm event `due_again`, `knock`, `outfit`, `expired_done`, `expired_overdue`, `expired_checklist`; ghi "câu có `cond.intent` chỉ khớp khi có intent".
3. **Spec 04**: thêm khoá `cond.date: ["MM-DD","MM-DD"]` (dương lịch) và có thể `cond.lunar` cho Tết/Trung thu — persona sẽ viết câu theo mùa khi được duyệt.
4. **core**: khi làm cảnh ném note (Đợt 2B), đặt `ctx.pet.tossesNotes = true` và gọi `ctx.persona.pick('expired_' + reason, {title})`; cảnh gõ app gọi `pick('knock', {title, time})`.
5. **game**: công bố `ctx.game.itemName(id)` để câu `outfit` có tên món.
6. Từ lượt 1 còn mở: loại `src/main/persona/test/**`, `tools/**` khỏi `build.files`; script `test:persona`.
