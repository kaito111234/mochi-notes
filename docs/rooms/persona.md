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
_Cập nhật 2026-10-15 — lượt 3 (Đợt 3, theo yêu cầu điều hành). Đợt 1 đã gộp; lượt 2 (bỏ nói trùng, nhiều nhắc/note) nằm trên nhánh này, chưa gộp._

### Đã xong lượt 3 (theo 5 mục của điều hành)
1. **Xưng hô**: `docs/persona/MOCHI.md` mục 3 ghi quy ước spec 04 (giao diện "Mochi/bạn", bé nói "tớ/cậu", không trộn), "mình" chỉ phản thân.
2. **Tiền là "xu"**: 7 câu reward đổi kẹo → xu; mọi câu reward có `{count}` weight 2; thêm 12 câu `reward.xu.*`. MOCHI.md ghi rõ.
3. **Event mới** (đã đăng ký trong `EVENTS` của `src/shared/dialogue.js`, mỗi event ≥ 12 câu):
   - Dọn note hết hạn: `expire_ask` (hỏi trước, {title}/{count}) 14, `expired_done|overdue|checklist` (khi dọn) 12 mỗi loại, `expire_keep` (bấm "Giữ lại") 12.
   - `knock` 16 (lượt 2).
   - Ghi nhanh qua bé: `capture` ({title}, {time} có thể trống) 16, `capture_many` ({count}, {title} = việc sớm nhất) 12.
   - Gacha theo độ hiếm và theo món: khoá cond mới `rarity`, `item`. gacha_win 42 (16 theo 4 độ hiếm, 14 theo món: đủ 5 legend, 6 epic, 3 món mèo), gacha_dup 16.
   - Cho ăn theo món: feed 34 (2 câu × 11 món trong `assets/game/catalog.json`).
   - `checkin` ({count} = số ngày liên tiếp) 14, `quest_done` ({count} xu, {title}) 14. Persona tự chọn khi `game:reward`: reason `quest:*` → quest_done; payload có `streak` → checkin; còn lại → reward.
   - Persona tự đổi tên món → id qua catalog (game đang truyền `{item: tên}`), nên câu theo món chạy ngay không cần game sửa.
4. **BUG-023**: `dialogue.pick` ưu tiên tuyệt đối theo nhóm: `cond.item` > `cond.rarity`/`cond.intent` > câu chung (nhóm hết câu do chống lặp 5 câu thì rơi xuống nhóm kế). Câu có intent chỉ khớp khi có intent (lượt 2). Trong khi core chưa truyền `intent`, `ctx.persona.pick` tự tra intent cho các event nhắc qua `vars.noteId`/`reminderId`, hoặc khớp `vars.title` với reminder/note. Test với kho thật: note "Gọi điện cho mẹ" (call) ra câu `due.call.*`, không ra `due.go.*`.
5. **Lễ Việt Nam**: khoá cond mới `date` và `lunar` (["MM-DD","MM-DD"], vòng qua cuối năm được), đổi âm lịch bằng `src/main/persona/lunar.js` (thuật toán Hồ Ngọc Đức, GMT+7; test 6 mốc Tết/Trung thu 2024–2027). Ngày cuối tháng Chạp luôn tính là `12-30` (giao thừa tháng thiếu như 16/02/2026). Event `holiday` 42 câu: Tết (mùng 1–3) 8, giao thừa 3, cuối năm (26–29 Chạp) 3, ông Táo 2, Trung thu (14–15/8 âm) 6, 20/10 5, 8/3 5 (chúc trung tính, không giả định giới tính), Giáng sinh 6, Tết Dương 4. Bé nói 1 lần/ngày ở khởi động hoặc lần nói rảnh đầu tiên; ngày thường không có câu khớp nên im.

Tất cả khoá cond mới (`date`, `lunar`, `item`, `rarity`) và `intent` đều **nghiêm**: state không có giá trị thì câu bị loại.

### Số câu theo event (tổng 839)
click 18, pat_head 16, pat_body 10, lift 10, drop 8, idle 73, sleepy 10, wake 10, startup 14, shutdown 10, morning 10, noon 8, evening 8, late_night 10, pre 48, due 64, due_again 30, done 22, done_late 14, snooze 14, nag 18, alarm 22, alarm_stop 10, alarm_snooze 10, memo 22, reward 26, levelup 12, feed 34, hungry 10, gacha_win 42, gacha_dup 16, note_created 18, knock 16, outfit 16, expired_done 12, expired_overdue 12, expired_checklist 12, capture 16, capture_many 12, checkin 14, quest_done 14, expire_ask 14, expire_keep 12, holiday 42.

### Cách chạy
- Test: `node --test src/main/persona/test/*.test.js` (57 test xanh, gồm `lunar.test.js`).
- Đếm + kiểm kho thoại: `node src/main/persona/tools/count-lines.js [file]` (exit 1 nếu lỗi; in thêm bảng theo intent/item/rarity và lịch lễ).

### Việc tiếp theo
1. Khi core/notes/game nối các event mới (xem đề xuất), chạy thử xvfb để soát câu thực tế.
2. Câu `gacha_win` cho 5 món epic còn lại; câu outfit theo món.
3. `hungry` vẫn chưa ai phát.
4. Cập nhật `docs/art/ART-BRIEF.md` khi spec 03 có action Đợt 2B (vo note, ném, gõ cửa sổ).

### Vướng mắc
- Không có. Ghi nhanh qua bé vẫn có thể nói 2 câu cho tới khi notes làm đề xuất 1.

## Đề xuất cho phòng điều hành
1. **notes** (`insightService.quickCapture`): dùng `ctx.persona.pick('capture', {title, time})` (một việc) / `pick('capture_many', {count, title})` (nhiều việc) thay `buildReply`, giữ `buildReply` làm dự phòng; phát `note:created` kèm `source: 'pet'` để persona không nói thêm `note_created`.
2. **core** (`stage.js varsFor`): truyền `intent` và `noteId`/`reminderId` cho pre/due/due_again/nag/done/snooze (BUG-023; persona đã tự tra nếu thiếu). Cảnh dọn note: `pick('expire_ask', {title|count})` khi hỏi, `pick('expired_<reason>', {title})` khi dọn, `pick('expire_keep', {title})` khi bấm "Giữ lại"; đặt `ctx.pet.tossesNotes = true` để persona không tự nói `note:expired`. Gõ cửa sổ: `pick('knock', {title, time})`.
3. **game**: `game:reward` kèm `streak` (khi chạm mốc chuỗi ngày) và `title` (tên nhiệm vụ) để `checkin`/`quest_done` đủ biến; nên truyền `itemId` (và `rarity`) cho `pick('feed'|'gacha_win'|'gacha_dup')` thay vì chỉ tên; công bố `ctx.game.itemName(id)` cho câu `outfit`.
4. **Spec 04**: thêm 13 event mới (`due_again`, `knock`, `outfit`, `expired_done`, `expired_overdue`, `expired_checklist`, `expire_ask`, `expire_keep`, `capture`, `capture_many`, `checkin`, `quest_done`, `holiday`) và khoá cond `date`, `lunar`, `item`, `rarity` (nghiêm, như `intent`); ghi thứ tự ưu tiên item > rarity/intent > chung; biến `{count}` của reward là số xu.
5. Còn mở từ lượt 1: loại `src/main/persona/test/**`, `tools/**` khỏi `build.files`; script `test:persona`.
