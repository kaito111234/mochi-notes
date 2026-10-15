# Phòng 5 — Họa sĩ (`room/art`)

**Sứ mệnh**: vẽ lại bé Mochi **đúng nhân vật gốc** của chủ dự án thành bộ hình dùng được trong app, làm **từng phần một**: nhân vật → quần áo → phụ kiện → đồ vật.
Đọc trước: `CLAUDE.md`, `docs/spec/03-animation.md`, `docs/art/ART-BRIEF.md`, `docs/art/AI-PROMPTS.md`, `docs/persona/MOCHI.md`; **xem kỹ** `art/source/character-sheet.png` (Read; cắt phóng to từng vùng bằng Python PIL để nhìn chi tiết).

## Cách làm: nhân vật dạng "rối giấy" vector (rig)
Không có công cụ vẽ AI trong phiên — nên vẽ **SVG tay**, tách lớp như Live2D đơn giản, rồi **dựng hình động bằng biến đổi các lớp** và xuất PNG theo chuẩn 03-animation. Lợi ích: đồng nhất nhân vật ở mọi tư thế, thay quần áo/phụ kiện chỉ là đổi lớp, họa sĩ người thật sau này vẽ lại từng lớp là xong.
- `art/rig/mochi/parts/*.svg` — mỗi bộ phận một file: tóc sau, thân, váy/quần, chân trái/phải, tay trên/dưới trái/phải, cổ, đầu, tai, mắt (nhiều bộ theo 18 biểu cảm của bảng nhân vật), lông mày, miệng, má hồng, tóc mái, tóc mai, sợi tóc dựng (ahoge), kẹp tóc chữ X, nơ đen.
- `art/rig/mochi/rig.json` — thứ tự lớp, điểm xoay (pivot) mỗi khớp, khung xương đơn giản, khe gắn đồ (`slot`: hat, hairclip, glasses, neck, body, outer, hand_l, hand_r, back).
- `tools/rig/` — trình dựng: đọc rig + `tools/rig/actions/<action>.json` (keyframe: góc khớp, dịch, đổi bộ mắt/miệng theo thời gian) → xuất `assets/pet/mochi/<action>/<mood>/<phase>/NNNN_<ms>.png` + `pack.json` (anchor, hitbox, hand). Kết xuất SVG→PNG bằng Electron offscreen (đã có trong node_modules) hoặc `@resvg/resvg-js` (npm) — chọn cái chạy được, ghi lại.

## Đặc điểm nhân vật phải giữ (theo bảng gốc)
Tóc dài màu xanh da trời nhạt có ánh, sợi tóc dựng trên đỉnh, mái lệch, kẹp tóc hình chữ X màu vàng/xanh + nơ ruy băng đen bên phải; mắt xanh lá to; áo khoác đen viền trắng rộng, áo sơ mi trắng, cà vạt xanh dương; váy/quần ngắn đen, tất đen, giày bốt; tỉ lệ chibi ~2,5 đầu cho bản trên desktop. Bảng màu gốc: trắng, xanh nhạt, bạc hà, đen, xám. Trang phục kín đáo, dáng dễ thương, **không** tư thế gợi cảm.

## Lộ trình của phòng (từng cái một)
- **Đợt 2 (lượt này)**: nhân vật cơ bản + 18 biểu cảm khuôn mặt + 10 action ưu tiên: `idle`, `walk`, `lifted`, `fall`, `land`, `pat_head`, `sleep`, `hold_note`, `ring`, `happy` (mood `normal`, thêm `happy`/`tired` nếu kịp). Đặt cạnh bảng gốc so sánh, sửa ít nhất 2 vòng tới khi giống. Kiểm bằng `node tools/anim/validate.js assets/pet/mochi`.
- Đợt 3: các action còn lại + 8 bộ trang phục trong bảng (thường, ngủ, thể thao, đi học, cosplay, dự tiệc, mùa đông, cắm trại) thành lớp `assets/wardrobe/<id>/`.
- Đợt 4: phụ kiện (kẹp tóc, nơ, tai nghe…) và đồ vật (mèo đen bông, ba lô, điện thoại, đồ ngọt, máy game, sách, tai nghe, mặt trăng…) trong `assets/items/`.

## Tiêu chí nghiệm thu
- `art/review/` có ảnh so sánh: bảng gốc | bản vẽ của phòng (mặt, toàn thân, 18 biểu cảm), và tấm "contact sheet" mỗi action.
- Gói `assets/pet/mochi` qua `validate.js`, chạy trong app (ảnh xvfb: bé đứng trên taskbar, bị nhấc, giơ note).
- `art/HANDOFF.md`: hướng dẫn họa sĩ người thật vẽ lại từng lớp đúng kích thước/pivot để thay thế.

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
