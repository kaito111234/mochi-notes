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
_Cập nhật 2026-10-15, lượt 3 (Đợt 2 hoàn thiện + kéo action Đợt 3/2B lên)._

**Quyết định đầu lượt**: Đợt 2 đã xong và gộp; gói `mochi` mới thay gói tạm 23 action nên 13 action còn lại đang rơi về idle trong app (core chưa có `assets/pet/placeholder/`). Vì vậy lượt này: (1) vòng hoàn thiện Đợt 2 (tóc, trang phục, mood, tóc hất lên); (2) dựng nốt 13 action hợp đồng 03 + 14 action core xin cho Đợt 2B. Trang phục wardrobe và items để Đợt 3/4.

**Đã xong lượt này** (12 nhân viên Sonnet song song, trưởng phòng duyệt 2–3 vòng)
- Tóc vòng 4: bất đối xứng, mái lệch, lọn bay rủ xuống, sợi mảnh + vệt sáng, viền 3→2,4; bỏ "vây" ngang hông. Mới: `hair_back.up`, `sidelock_*.up` (lifted, fall; đã sửa chóp giống tai).
- Trang phục vòng 4: viền trắng, túi, đường may, khoá kéo, **một** huy hiệu mèo, sọc tay áo mảnh, ly váy, dây bốt, cà vạt có ánh.
- 27 action mới: hợp đồng 03 — sit (normal/tired), pat_body, wave (normal/happy), say (4 mood), peek_left, peek_right, startup, shutdown, sad, shy, angry, eat (normal/happy), work (normal/tired); core 2B — sit_on_note (normal/happy), point, climb, peek_note, yawn (normal/tired), stretch, knock, cheer, carry_note, crumple, throw, write, read, play_cat (normal/happy). Mood mới: walk happy/sad. lifted/fall dùng tóc `.up`, fall tay nổi trước tóc.
- Gói `assets/pet/mochi`: **37 action, 479 khung**, `validate.js` OK **0 cảnh báo**. App chạy xvfb tải gói OK (`art/review/app_06_luot3.png`).
- `pack.json.actions` có tham số căn chỉnh cho core (xem đề xuất 4). `art/HANDOFF.md` mục 4.3 liệt kê biến thể/đạo cụ mới.

**Ảnh so sánh** (`art/review/`): `compare_full.png`, `round4_hair.png`, `round4_outfit.png`, `compare_faces_18.png`, `faces.png`, `contact_<action>.png` cho cả 37 action, `app_*.png`.

**Cách dựng lại**: `npm install` → `node tools/rig/build.js --faces` (~11 giây, 479 khung) → `node tools/anim/validate.js assets/pet/mochi` → `node tools/rig/sheet.js --contact <action>` / `--compare` / `--faces`.

**Còn yếu / đang dở**
- Rig vẫn chính diện: walk/climb/peek không có góc 3/4; tóc vẫn kém bồng hơn gốc (giữ vùng bao).
- Thiếu khoá mặt: `talk_tired`, `talk_sad` (say mood tired/sad nhảy mắt), `puff` (má phồng thật cho angry/eat), mắt liếc (read, shy), nháy một mắt.
- Tay ngắn: eat dang khuỷu rộng; tay che má (shy) che nửa mặt; bàn tay bám (peek) chỉ là nắm tay xoay.
- peek_left/right vẫn thấy chân dưới mép; peek_note start/end có phần dưới mép (core cắt tại edgeY).
- Gói PNG ≈46 MB (xem đề xuất 5).

**Việc tiếp theo (Đợt 3)**: 8 bộ trang phục thành lớp `assets/wardrobe/<id>/` (thay torso/arms/skirt/legs theo khe body/outer) — bắt đầu từ đồ ngủ, đồ học; thêm 4 khoá mặt trên (cần sửa `rig.json`, thuộc art); mood happy/tired cho sit_on_note/work đã có, cân nhắc mood cho knock/point (không — nhắc lịch phải nhất quán). Đợt 4: phụ kiện + đồ vật `assets/items/`.

**Vướng mắc**: không có. Đề xuất 1 (đặt note vào giữa hai tay) chưa thấy core làm.

## Đề xuất cho phòng điều hành
1. **Gửi phòng core — đặt tờ note vào giữa hai tay** (đã xác minh trong `src/pet/pet.js` `placeNote()` và ảnh `art/review/app_03_giu_note.png`): hiện góc DƯỚI-TRÁI tờ note 120×110 đặt tại `pack.hand`, nên note lệch ~56 px phải / 62 px lên và che mặt bé. Theo ART-BRIEF 4.8, `hand` là **tâm** tờ note. Gói mochi có `pack.json.note = {anchor:"center", center:[200,262], size:[84,84]}` (px canvas). Đề nghị: nếu `pack.note.anchor === "center"` thì đặt tâm note tại `note.center` và co tờ note về `note.size × pack.scale`.
2. Gửi core: gói `mochi` là 400×400 (scale 0.6), gói tạm cũ 288×344 — khi lấy action thiếu từ gói khác cần căn theo anchor/scale riêng từng gói. (Nay `mochi` đã đủ 23 action hợp đồng nên ít cần fallback.)
3. `hitbox` gói mới: head [126,70,148,160], body [146,230,108,162] — engine đọc từ pack.json.
4. **Gửi core — tham số action mới trong `pack.json.actions`** (px canvas): `sit_on_note.seatY=338` (mép trên cửa sổ note), `sit.seatY=392`; `point.tip=[342,237]`; `climb.gripX=300` (trùng mép phải màn hình); `peek_left.edgeX=0`, `peek_right.edgeX=400`; `peek_note.edgeY=232` (cắt/vẽ note đè dưới đường này ở start/end); `knock.wallX=315`; `throw.release=[301,181]` ở khung 5 (330 ms), vận tốc ≈(0.4,−0.3) px/ms — core vẽ cục giấy bay tiếp vào thùng; `carry_note.speed=2.2`. point/climb/knock/throw vẽ hướng PHẢI, engine lật khi cần (vì vậy không có chữ trong hình). Tên action mới đúng danh sách core Đợt 2B.
5. **Dung lượng gói** 46 MB PNG RGBA: lượng tử hoá 256 màu (PIL FASTOCTREE) giảm ~5× (97→19 KB/khung), nhìn gần như không đổi. Đề nghị cho phép một bước nén tuỳ chọn khi đóng gói (Python PIL có sẵn trên máy dựng, hoặc thư viện npm như `pngquant-bin`/`upng-js` — cần duyệt `package.json`). Art chưa áp dụng để giữ quy trình chỉ-Node.
