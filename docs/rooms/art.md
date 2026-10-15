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
_Cập nhật 2026-10-15, lượt Đợt 3 (theo tin phòng điều hành)._

**Đã xong (tính cả lượt 3 trước đó)**
1. **13 action còn lại** của hợp đồng 03 và **14 action core Đợt 2B** (knock, carry_note, crumple, throw, point, climb, sit_on_note, peek_note, read, write, cheer, yawn, stretch, play_cat), đúng tên thư mục. Bảng hành động (mood, phase, số khung, tham số căn chỉnh) ở **`art/ACTIONS.md`** — điều hành chốt vào 03. Gói `assets/pet/mochi`: 37 action, 479 khung, validate OK 0 cảnh báo.
2. **Nén PNG bảng màu** thuần Node (`tools/rig/lib/quant.js`, 128 màu, không dither, ảnh ≤128 màu giữ nguyên): gói **46 MB → 12 MB**; `build.js` mặc định nén (`--no-quantize` để tắt); `node tools/rig/quantize.js <thư mục>` nén tại chỗ. Ảnh `art/review/quantize_compare.png`.
3. **Tủ đồ**: tách áo khoác khỏi thân → lớp `outer_torso`, `outer_upper_arm_*`, `outer_forearm_*` bám lớp tay/thân (`follow`, `covers`, `keeps`, `hides` trong `lib/rig.js`); thân gốc = sơ mi + cà vạt. Định dạng `assets/wardrobe/<itemId>/` (SVG thay bộ phận + `item.json`), hướng dẫn họa sĩ `art/rig/mochi/WARDROBE.md`. Dựng một tổ hợp: `node tools/rig/outfit.js --body <id> --outer <id|none> --out <dir>` (đủ 37 action ≈56 s, ≈12 MB). Gói mặc định dựng lại qua outfit.js khớp pixel bản cũ (472/479 khung ≤30 px viền; startup/shutdown lệch nhẹ ở khung mờ dần vì opacity áp hai lớp).
4. **14 món trang phục** khớp id catalog (8 bộ của bảng nhân vật): thường `body_default`*+`outer_black_white`, `body_hoodie_cat`; ngủ `body_pajama_dino`; thể thao `body_sport_tee`+`outer_sport_jacket`; đi học `body_uniform`+`outer_blazer`; cosplay `body_star_dress`+`outer_witch_cape`/`outer_moon_cloak`; dự tiệc `body_party_blouse`; mùa đông `body_sweater`+`outer_puffer`; cắm trại `body_camp_shirt`*+`outer_raincoat` (*id đề xuất, chưa có trong catalog). Mọi món có biến thể `.sit` khi đổi chân. Đã thử đủ 37 action với sport tee+jacket: validate OK.
5. Vòng hoàn thiện nhân vật: tóc bất đối xứng + lọn bay + `hair_back.up`/`sidelock_*.up` cho lifted/fall; áo khoác có túi, khoá, đường may, huy hiệu mèo.

**Ảnh so sánh** (`art/review/`): `wardrobe_lineup.png` (10 tổ hợp, đứng + ngồi), `outfit_<bộ>.png` (bảng gốc | idle | walk | sit | hold_note | fall), `wardrobe_split.png`, `quantize_compare.png`, `round4_hair.png`, `round4_outfit.png`, `compare_full.png`, `contact_<action>.png` ×37.

**Cách dựng lại**: `npm install` → `node tools/rig/build.js --faces` (gói mặc định, ~60 s có nén) → `node tools/anim/validate.js assets/pet/mochi`. Bộ đồ: `node tools/rig/outfit.js --body body_uniform --outer outer_blazer --out /tmp/x`.

**Còn yếu / đang dở**
- Tóc dài che phần lớn thân nên chi tiết áo (huy hiệu, hoạ tiết) ít thấy ở cỡ thật; mũ trùm (hoodie, áo mưa) gần như khuất.
- Một số món theo id catalog nên lệch bảng gốc: áo phao (gốc là áo khoác dài + khăn), cắm trại (gốc áo khoác đen), cosplay (gốc váy đen + choàng trắng).
- Áo choàng cosplay chỉ có `outer_torso` (không phủ vai). Quần thể thao chưa rộng như gốc.
- Thiếu khoá mặt `talk_tired`, `talk_sad`, `puff`, mắt liếc. Rig vẫn chính diện.
- Chưa vẽ icon catalog `assets/game/icons/` (thuộc phòng game).

**Việc tiếp theo**: Đợt 4 — các khe còn lại (hat, hairclip, glasses, neck, hand, back: 42 món catalog) thành lớp gắn khe theo `rig.json.slots` (lớp chồng, không cần thay bộ phận); thêm 4 khoá mặt; sửa opacity hai lớp ở startup/shutdown (nhóm opacity theo thân); phòng core nối đổi đồ theo đề xuất 6.

**Vướng mắc**: không có.

## Đề xuất cho phòng điều hành
1. **Gửi core — đặt tờ note vào giữa hai tay**: nếu `pack.note.anchor === "center"` thì đặt tâm note tại `note.center` [200,262] và co về `note.size` [84,84] × `pack.scale` (điều hành báo đã chuyển).
2. Gói `mochi` 400×400 scale 0.6 — giờ đủ 23 action hợp đồng + 14 action 2B, không còn cần gói tạm.
3. `hitbox`: head [126,70,148,160], body [146,230,108,162].
4. **Tham số action cho core** trong `pack.json.actions` (xem `art/ACTIONS.md`): `sit_on_note.seatY=338`, `point.tip=[342,237]`, `climb.gripX=300`, `peek_note.edgeY=232`, `peek_left/right.edgeX=0/400`, `knock.wallX=315`, `throw.release=[301,181]` ở khung 5 (330 ms) vận tốc ≈(0.4,−0.3) px/ms, `carry_note.speed=2.2`. point/climb/knock/throw vẽ hướng phải.
5. **Chốt bảng hành động** `art/ACTIONS.md` vào `docs/spec/03-animation.md`.
6. **Cách đổi đồ (đề xuất art, cần điều hành chốt với core/game)** — chọn *dựng gói theo bộ đồ tại máy người dùng, lưu cache*:
   - Khi người dùng mặc tổ hợp (body, outer) chưa có, core dựng gói `userData/pets/mochi@<body>+<outer>/` từ `art/rig/mochi` + `assets/wardrobe` bằng chính Electron của app (cửa sổ offscreen như `tools/rig/svg2png.js`; phần ghép SVG là thuần JS trong `tools/rig/lib/rig.js` + `action.js`, nén bằng `lib/quant.js`) — ≈1 phút/tổ hợp, chạy nền ở mức ưu tiên thấp, trong lúc đó bé vẫn mặc bộ cũ; xong thì đổi gói (hiệu ứng "thay đồ" ngắn). Cache tối đa ~6 tổ hợp (≈12 MB mỗi cái), xoá cái ít dùng.
   - Lý do: hỗ trợ mọi tổ hợp 8 body × 9 outer mà bộ cài không phình (dựng sẵn 8 bộ ≈ +96 MB); chất lượng y hệt gói chính; không cần chồng lớp thời gian thực (thứ tự lớp xen kẽ tóc–tay–áo nên một ảnh chồng không đúng).
   - Cần: đóng gói kèm `art/rig/mochi/**`, `assets/wardrobe/**`, `tools/rig/lib/**`, `tools/rig/actions/**` (≈2 MB SVG/JS). Art có thể tách `tools/rig/lib/pack-builder.js` (API `buildPack({rigDir, wardrobe:[body,outer], out, render})`, `render` do core cung cấp) nếu điều hành chốt — đề nghị giao art làm ở lượt sau.
   - Phương án dự phòng nếu chưa làm kịp: dựng sẵn chỉ `idle, walk, sit, hold_note` cho 8 bộ (≈1,5 MB/bộ) và các action khác dùng gói mặc định.
   - Khe `hat/hairclip/glasses/neck/hand/back` (Đợt 4) là lớp gắn khe — cùng cơ chế dựng nên không cần thêm gì.
7. **Gửi game**: thêm vào catalog `body_default` (slot body, set daily — đồ gốc: sơ mi trắng, cà vạt xanh, váy đen, tất đen, bốt; nên là đồ mặc định có sẵn) và `body_camp_shirt` (slot body, set camping — sơ mi ca-rô, short kaki, bốt nâu). `outer_black_white` là áo khoác mặc định.
