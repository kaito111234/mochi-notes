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
_Cập nhật 2026-10-15, hết lượt Đợt 2._

**Đã xong**
- Rig rối giấy vector: `art/rig/mochi/RIG-SPEC.md` (hệ toạ độ 400×400, mốc giải phẫu, màu, 19 xương, 24 lớp, khe đồ), `rig.json`, bộ phận `art/rig/mochi/parts/` (đầu, tóc sau/mái/mai/ahoge, kẹp X, nơ, thân, cổ, váy, tay 2 đốt + 5 kiểu bàn tay, chân 2 đốt + bốt, biến thể `hair_back.sit`), **26 bộ mặt** (18 khoá bảng gốc + blink, closed_happy, sleep, shout, wince, o, yawn, talk; mỗi khoá `.svg` + `.over.svg`), đạo cụ (chuông, mèo bông) và 17 hiệu ứng.
- Trình dựng `tools/rig/` (chỉ Node + Electron offscreen có sẵn, không thêm thư viện): `build.js`, `pose.js`, `faces.js`, `sheet.js`, `svg2png.js`; action keyframe `tools/rig/actions/*.js` (inherit, tween, $ref mood). README đầy đủ.
- Gói `assets/pet/mochi` (thay gói tạm 288×344): 10 action Đợt 2 — idle (normal/happy/tired/sad), walk (normal/tired), lifted, fall, land, pat_head (normal/happy), sleep, hold_note, ring, happy — 110 khung + 18 ảnh `faces/` 256×256. `validate.js`: OK, chỉ cảnh báo thiếu 13 action Đợt 3 (engine rơi về idle).
- Duyệt: đầu/tóc 4 vòng, thân 2 vòng, mặt 1 vòng + tổng duyệt, walk/land/sleep/pat_head/ring 2 vòng, các action khác trưởng phòng duyệt từng khung ở 400px.
- Chạy app thật dưới xvfb: gói tải OK, không lỗi console; ảnh `art/review/app_0*.png`.
- `art/HANDOFF.md`: hướng dẫn họa sĩ người thật vẽ lại từng lớp (pivot, z, vùng bao, biến thể, cách nhúng PNG vào SVG).

**Ảnh so sánh** (`art/review/`): `compare_full.png`, `compare_faces_18.png`, `compare_face_closeup.png`, `faces.png`, `contact_<action>.png` (10 action), `round*_head|body|faces|props.png` (các vòng sửa), `app_*.png`; ảnh tham chiếu cắt từ bảng gốc ở `art/review/ref/`.

**Cách dựng lại**: `npm install` → `node tools/rig/build.js --faces` (≈3 giây, tự gọi xvfb-run nếu không có DISPLAY) → `node tools/anim/validate.js assets/pet/mochi` → `node tools/rig/sheet.js --contact <action>`. Xem nhanh tư thế: `node tools/rig/pose.js --out x.png --face happy --scale 2 --bg white`.

**Đang dở / còn yếu**
- Nhân vật nhìn chính diện (rig 2D): walk là bước tại chỗ nghiêng người, chưa có góc 3/4; tóc là mảng cứng xoay/co.
- Tóc còn đối xứng hơn bảng gốc, thiếu lọn bay; áo khoác đen ít tương phản chi tiết (túi, khoá); huy hiệu mèo nhỏ.
- fall: tay giơ ±120° (giơ cao hơn thì khuất sau tóc); chưa có `hair_back.up` (tóc hất lên) và cổ áo bị kéo ở lifted.
- Gói PNG RGBA ≈12 MB (128 ảnh) — có thể nén bảng màu sau.
- `hand_*.point`, `fx/question` chưa dùng.

**Việc tiếp theo (Đợt 3)**: 13 action còn lại (sit, pat_body, wave, say, peek_left/right, startup, shutdown, sad, shy, angry, eat, work) bằng cùng rig — mỗi action một file `tools/rig/actions/*.js`; vẽ `hair_back.up`, `sidelock_*.up`, tay biến thể "grip"; thêm mood happy/tired cho hold_note? (không — nhắc lịch phải nhất quán); 8 bộ trang phục thành lớp `assets/wardrobe/<id>/` (thay torso/arms/skirt/legs theo khe `body`/`outer`).

**Vướng mắc**: tờ note do app vẽ đang lệch khỏi tay (xem đề xuất 1).

## Đề xuất cho phòng điều hành
1. **Gửi phòng core — đặt tờ note vào giữa hai tay** (đã xác minh trong `src/pet/pet.js` `placeNote()` và ảnh `art/review/app_03_giu_note.png`): hiện góc DƯỚI-TRÁI tờ note 120×110 đặt tại `pack.hand`, nên note lệch ~56 px phải / 62 px lên và che mặt bé. Theo ART-BRIEF 4.8, `hand` là **tâm** tờ note. Gói mochi mới thêm `pack.json.note = {anchor:"center", center:[200,262], size:[84,84]}` (px canvas). Đề nghị: nếu `pack.note.anchor === "center"` thì đặt tâm note tại `note.center` và co tờ note về `note.size × pack.scale` (hiện chỉ tiêu đề; nội dung đầy đủ đã có trong bong bóng). Gói tạm của core giữ cách cũ.
2. Gửi core: gói `mochi` giờ là 400×400 (scale 0.6) còn gói tạm là 288×344 — khi engine lấy action thiếu từ `assets/pet/placeholder/`, cần căn theo anchor/scale riêng của từng gói (không giả định cùng canvas).
3. `hitbox` gói mới: head [126,70,148,160], body [146,230,108,162] (khác số mẫu trong brief vì đầu chibi to hơn) — engine đọc từ pack.json nên không cần đổi code.
