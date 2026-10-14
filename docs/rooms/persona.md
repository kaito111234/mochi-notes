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
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
