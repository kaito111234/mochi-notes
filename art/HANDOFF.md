# Bàn giao cho họa sĩ — vẽ lại từng lớp rig bé Mochi

Mục đích: thay bộ hình vector tạm hiện tại bằng nét vẽ của họa sĩ **mà không phải sửa code**. Rig (xương, pivot, thứ tự lớp, action) giữ nguyên; họa sĩ chỉ **thay nội dung các file SVG** trong `art/rig/mochi/parts/` theo đúng tên, đúng toạ độ.

Tài liệu liên quan: `art/rig/mochi/RIG-SPEC.md` (hợp đồng toạ độ), `art/rig/mochi/rig.json` (xương và lớp), `tools/rig/README.md` (công cụ), `docs/art/ART-BRIEF.md` (phong cách, bảng màu), hình gốc `art/source/character-sheet.png`, ảnh tham chiếu `art/review/ref/`.

## 1. Hệ toạ độ

- Mỗi file là **một lớp trong suốt 400 × 400** (`viewBox="0 0 400 400"`), vẽ **ngay tại vị trí của tư thế gốc**: đứng thẳng, nhìn chính diện, hai tay buông. Chồng tất cả lớp theo thứ tự z là ra nhân vật hoàn chỉnh, không cần biến đổi gì.
- Gốc toạ độ góc trên-trái, x sang phải, y xuống dưới. Điểm chân (anchor) = **(200, 392)**, đế giày ở y = 392. Cao ~315 px (chóp ahoge y ≈ 74, nhưng vùng thực của lớp ahoge là y 61–104 vì có đường cong). Chibi ~2,5 đầu.
- "Phải" = **bên phải người xem** (x lớn). Nơ đen và kẹp X ở bên phải người xem.
- Lề: chừa ≥ 16 px mỗi cạnh canvas (đã đạt, trừ tóc dài sát 98–305).

Mốc giải phẫu cần canh khi vẽ (trích RIG-SPEC mục 2):

| Mốc | Toạ độ |
|---|---|
| Ahoge: chóp / gốc | (206, 74) / (200, 98) |
| Đỉnh sọ | y = 94 |
| Mặt | rộng x 138–262, đáy cằm y = 222 |
| Tâm mắt trái / phải | (173, 184) / (227, 184); mỗi mắt ~30 × 36 |
| Lông mày | y ≈ 160 (trên mái, thuộc lớp `.over`) |
| Miệng / má hồng | (200, 209) / (160, 200), (240, 200) |
| Cổ + choker | x 191–209, y 214–234; choker y 226–232 |
| Vai khớp tay | (164, 244) / (236, 244) |
| Khuỷu | (156, 278) / (244, 278) |
| Cổ tay | (152, 306) / (248, 306) |
| Hông | (187, 306) / (213, 306) |
| Gối | (186, 348) / (214, 348) |
| Giày | trái x 172–198, phải x 202–228, đế y = 392 |
| Kẹp X / nơ | tâm (236, 128) / (270, 134) |

## 2. Các lớp (từ sau ra trước)

"Vùng bao" là hộp bao của phần có hình thật của file hiện tại (đo bằng cách kết xuất riêng từng file, alpha > 3%). Bản vẽ mới nên nằm **xấp xỉ trong hộp này** (lệch vài px là được); vượt xa là sẽ lệch khớp hoặc đè sai.

| z | Lớp | File (`parts/`) | Xương | Pivot | Vùng bao (x1,y1 – x2,y2) |
|---|---|---|---|---|---|
| 10 | hair_back | `hair_back.svg` | hair_back | [200, 120] | 98,88 – 305,360 |
| 20 | ribbon_back *(tuỳ chọn, hiện chưa có file)* | `ribbon_back.svg` | ribbon | [270, 134] | — |
| 40 | thigh_l | `thigh_l.svg` | thigh_l | [187, 306] | 175,302 – 198,357 |
| 41 | shin_l | `shin_l.svg` | shin_l | [186, 348] | 173,342 – 199,394 |
| 50 | thigh_r | `thigh_r.svg` | thigh_r | [213, 306] | 202,302 – 225,357 |
| 51 | shin_r | `shin_r.svg` | shin_r | [214, 348] | 201,342 – 227,394 |
| 60 | skirt | `skirt.svg` | hips | [200, 306] | 161,286 – 239,326 |
| 70 | torso | `torso.svg` | chest | [200, 300] | 139,222 – 261,316 |
| 80 | neck | `neck.svg` | chest | [200, 300] | 187,210 – 213,236 |
| 90 | upper_arm_l | `upper_arm_l.svg` | upper_arm_l | [164, 244] | 136,225 – 184,292 |
| 91 | upper_arm_r | `upper_arm_r.svg` | upper_arm_r | [236, 244] | 216,225 – 264,292 |
| 100 | forearm_l | `forearm_l.svg` | forearm_l | [156, 278] | 131,257 – 175,316 |
| 101 | forearm_r | `forearm_r.svg` | forearm_r | [244, 278] | 225,257 – 269,316 |
| 110 | hand_l | `hand_l.svg` | hand_l | [152, 306] | 140,303 – 167,336 |
| 111 | hand_r | `hand_r.svg` | hand_r | [248, 306] | 233,303 – 260,336 |
| 120 | head | `head.svg` | head | [200, 228] | 130,96 – 270,226 |
| 130 | face | `face/{face}.svg` | head | [200, 228] | xem mục 5 |
| 140 | hair_front | `hair_front.svg` | head | [200, 228] | 117,84 – 281,228 |
| 150 | face_over | `face/{face}.over.svg` | head | [200, 228] | xem mục 5 |
| 160 | sidelock_l | `sidelock_l.svg` | sidelock_l | [146, 176] | 105,164 – 152,316 |
| 161 | sidelock_r | `sidelock_r.svg` | sidelock_r | [254, 176] | 248,164 – 295,311 |
| 170 | hairclip | `hairclip.svg` | head | [200, 228] | 223,116 – 249,140 |
| 180 | ribbon | `ribbon.svg` | ribbon | [270, 134] | 243,126 – 294,220 |
| 190 | ahoge | `ahoge.svg` | ahoge | [200, 98] | 190,61 – 222,104 |

Ghi chú:
- `ribbon_back` (đuôi nơ sau tóc) là lớp tuỳ chọn, hiện chưa có file; trình dựng bỏ qua im lặng. Có thể vẽ thêm nếu muốn.
- `face` và `face_over` thay đổi theo khoá mặt (mục 5). Chúng gắn xương `head` nên xoay cùng đầu.
- Thứ tự vẽ cố định theo z. Action có thể đổi z (vd `ring` đưa `hand_r` lên 205 để tay giơ lên trước mặt; `happy` đổi z `upper_arm_l`), nên **mỗi lớp phải vẽ trọn vẹn** (không "gài" chi tiết của lớp khác vào).

### Quan hệ xương

```
root (200,392)
└ hips (200,306)
  ├ thigh_l (187,306) → shin_l (186,348)
  ├ thigh_r (213,306) → shin_r (214,348)
  └ chest (200,300)
    ├ head (200,228): hair_back (200,120), sidelock_l (146,176), sidelock_r (254,176), ahoge (200,98), ribbon (270,134)
    ├ upper_arm_l (164,244) → forearm_l (156,278) → hand_l (152,306)
    └ upper_arm_r (236,244) → forearm_r (244,278) → hand_r (248,306)
```
Xoay xương cha kéo cả con. Quay **thuận chiều kim đồng hồ là r dương**.

## 3. Yêu cầu chồng lấn ở khớp (quan trọng nhất)

Vì mỗi lớp xoay quanh pivot, mép lớp lộ ra khe hở nếu vẽ "cắt phẳng" ở khớp.

| Khớp | Cách vẽ |
|---|---|
| Vai (upper_arm ↔ thân) | Đỉnh tay áo là **mặt cắt tròn** có tâm đúng pivot (164,244)/(236,244), bán kính ≥ nửa bề rộng tay áo. Phần tay trên thò vào dưới/lên trên áo thân ~6–8 px. Tay áo phải che được thân khi xoay ±150° (như `wave`). |
| Khuỷu (forearm ↔ upper_arm) | Đầu trên cẳng tay tròn, tâm đúng (156,278)/(244,278); đầu dưới tay trên cũng tròn cùng tâm; **chồng nhau ≥ 8 px**. Màu và nét viền hai bên khớp nhau (ống tay rộng viền trắng). |
| Cổ tay (hand ↔ forearm) | Bàn tay có phần cổ tay tròn tâm (152,306)/(248,306), chui vào dưới ống tay ~6 px (bàn tay z cao hơn nên **ống tay phải che gốc bàn tay bằng nét viền ống tay, hoặc bàn tay tự có cổ tay gọn**). Mọi biến thể tay cùng điểm gốc cổ tay. |
| Hông (thigh ↔ váy) | Đỉnh đùi tròn, tâm (187,306)/(213,306), nằm **dưới váy** (váy z60 che). Váy phủ xuống đùi tới y ≈ 326. |
| Gối (shin ↔ thigh) | Đầu dưới đùi và đầu trên ống chân tròn, tâm (186,348)/(214,348), chồng ≥ 8 px. Ống chân (z 41/51) đè lên đùi. |
| Cổ (neck/đầu ↔ thân) | Đầu (xoay quanh (200,228)) phải **che hết chỗ nối cổ–thân**: đáy cằm y ≈ 222, cổ đi tới y 236. Khi gật/nghiêng ±10° vẫn không lộ khe. |
| Tóc (sidelock, hair_back, ahoge) | Gốc mỗi mảng **nằm sâu dưới mái/đỉnh tóc** (z thấp hơn hoặc bị `hair_front` che), vì nó xoay quanh pivot riêng để đung đưa. Không vẽ gốc tóc lộ ra ngoài mái. |
| Nơ (ribbon) | Nút nơ tâm (270,134), phần buộc nằm sát mái; xoay nhẹ quanh pivot nên mép gốc cần nằm trong vùng tóc. |

Nguyên tắc chung: **mọi đầu khớp là hình tròn**, tâm = pivot trong bảng; nét viền ngoài 3 px không được "đóng nắp" ở đầu khớp (để phần chồng không lộ vạch nét giữa hai lớp). Nên vẽ nét viền đầu khớp mờ/không có, hoặc để lớp phía trên che.

## 4. Biến thể (swap) và đạo cụ

### 4.1 Biến thể bàn tay và tóc

Action dùng `swap` để đổi file, thiếu biến thể thì rơi về bản thường. **Mỗi biến thể cùng pivot cổ tay như bản thường.**

| Biến thể | Hình dạng | Khi nào |
|---|---|---|
| (thường) `hand_*.svg` | bàn tay buông tự nhiên | tư thế gốc |
| `.open` | xoè bàn tay | rơi, rớt, nhấc lên, vẫy, vui |
| `.fist` | nắm tay | vui (đấm nhẹ), pat_head, ring (cầm chuông) |
| `.hold` | nắm hờ/cầm | cầm tờ note, ôm mèo, nhiều action nền |
| `.point` | chỉ ngón | chưa dùng (dự phòng) |
| `hair_back.sit` | tóc sau xoè ra mặt sàn khi ngồi | sleep |

| File | Xương | Vùng bao | Dùng ở action |
|---|---|---|---|
| `hand_l.open.svg` | hand_l | 133,303 – 173,345 | fall, happy, idle, land, lifted, sleep, walk |
| `hand_l.fist.svg` | hand_l | 139,303 – 166,338 | happy, pat_head, ring |
| `hand_l.hold.svg` | hand_l | 140,303 – 167,334 | happy, hold_note, idle, land, pat_head, ring, sleep, walk |
| `hand_l.point.svg` | hand_l | 142,303 – 166,349 | **chưa action nào dùng** (dự phòng) |
| `hand_r.open.svg` | hand_r | 227,303 – 267,345 | fall, happy, idle, land, lifted, sleep, walk |
| `hand_r.fist.svg` | hand_r | 234,303 – 261,338 | happy, pat_head, ring |
| `hand_r.hold.svg` | hand_r | 233,303 – 260,334 | happy, hold_note, idle, land, pat_head, ring, sleep, walk |
| `hand_r.point.svg` | hand_r | 234,303 – 258,349 | **chưa action nào dùng** (dự phòng) |
| `hair_back.sit.svg` | hair_back | 94,88 – 306,350 | sleep (tóc xoè ra khi ngồi) |

### 4.2 Đạo cụ và hiệu ứng (`parts/props/`, `parts/fx/`)

Cũng là SVG 400 × 400. Đạo cụ gắn `hand_r` được đặt bằng độ lệch trong hệ xương; fx `canvas` đứng yên trên khung, `head` bám đầu, `none` bám toạ độ canvas nhưng chịu chuyển động toàn thân.

| File | Vùng bao | Gắn vào | Action dùng |
|---|---|---|---|
| `fx/blush_lines.svg` | 149,192 – 255,208 | head | pat_head |
| `fx/bubble.svg` | 205,205 – 225,225 | head | sleep |
| `fx/bubble_big.svg` | 200,200 – 230,230 | head | sleep |
| `fx/dust.svg` | 112,374 – 291,399 | canvas | land |
| `fx/dust2.svg` | 94,366 – 309,400 | canvas | land |
| `fx/hearts.svg` | 114,94 – 287,140 | head | pat_head |
| `fx/notes_music.svg` | 98,82 – 306,147 | canvas | happy |
| `fx/question.svg` | 272,64 – 308,126 | chưa dùng | chưa action nào dùng |
| `fx/ring_lines.svg` | 172,206 – 324,254 | none | ring |
| `fx/ring_lines2.svg` | 172,219 – 324,257 | none | ring |
| `fx/sparkle.svg` | 126,89 – 293,178 | canvas hoặc head | happy, pat_head |
| `fx/sparkle2.svg` | 122,73 – 302,160 | canvas hoặc head | happy, pat_head |
| `fx/speed_lines.svg` | 148,18 – 254,80 | none | fall |
| `fx/surprise.svg` | 276,68 – 294,123 | head | pat_head, sleep |
| `fx/sweat.svg` | 250,136 – 274,170 | head | lifted |
| `fx/zzz.svg` | 241,128 – 337,230 | head | sleep |
| `fx/zzz2.svg` | 246,116 – 340,223 | head | sleep |
| `props/bell.svg` | 214,245 – 283,344 | hand_r | ring |
| `props/bell_shake.svg` | 214,247 – 283,344 | hand_r | ring |
| `props/cat_plush.svg` | 151,250 – 268,349 | none (canvas+global) | sleep |

### 4.3 Bổ sung lượt 3 (Đợt 2 hoàn thiện + action Đợt 3/2B)

Biến thể mới (cùng pivot với bản thường; vùng bao xem bằng `node tools/rig/pose.js --keep-svg` hoặc mở file):
| File | Khi nào |
|---|---|
| `hair_back.up.svg`, `sidelock_l.up.svg`, `sidelock_r.up.svg` | tóc hất lên/xoè ra: lifted, fall. Chóp không cao hơn y≈196 (tránh trông như tai). |
| `thigh_l.sit.svg`, `thigh_r.sit.svg`, `shin_l.sit.svg`, `shin_r.sit.svg` | chân gập nhìn chính diện (đùi co phối cảnh): sit, sit_on_note |
| `hand_l.grip.svg`, `hand_r.grip.svg` | nắm quanh vật, ngón trước vật: eat, play_cat |
| `hand_r.point.svg` | nay đã dùng: point |

Đạo cụ/hiệu ứng mới (tiền tố = nhóm action): `props/work_*` (laptop mở/hé/đóng, bút chì, giấy, nét chữ 1–4, sách, lật trang — work, write, read), `props/eat_*` (daifuku + 3 mức cắn), `props/clean_*` (tờ note, giấy vo, cục giấy — carry_note, crumple, throw; vẽ tâm tại (0,0), đặt bằng `show` x,y,s,r), `fx/emo_*` (mây buồn, vạch u ám, lệ, dấu gân, khói — sad, angry), `fx/shy_*` (hơi ngại, giọt mồ hôi), `fx/start_*` (vầng sáng, sao, lệ ngáp — startup, shutdown, yawn), `fx/knock_*` (vệt chấn; `knock_text.svg` KHÔNG dùng vì engine lật ảnh), `fx/cheer_*` (hoa giấy), `fx/eat_*` (vụn, má phồng).

Action vẽ một hướng (PHẢI, engine lật khi cần): point, climb, knock, throw. Tham số căn chỉnh cho core nằm trong `pack.json.actions` (seatY, tip, gripX, edgeX/edgeY, wallX, release…).

## 5. Bộ mặt (`face/<khoá>.svg` + `face/<khoá>.over.svg`)

- `<khoá>.svg` (z130): mắt, miệng, má hồng. Nằm **dưới** mái tóc, nên mái che mép trên mắt là đúng.
- `<khoá>.over.svg` (z150): lông mày, ký hiệu (♪ ? ! ✦ tim, giọt lệ, mồ hôi, vạch ngại ngùng), nằm **trên** mái tóc. Ký hiệu vẽ bằng path, **không dùng chữ**. File `.over` có thể để trống (SVG rỗng) nếu khoá đó không cần.
- 26 khoá phải đủ, đúng tên (thiếu khoá → rơi về `normal`). Đây là ảnh hưởng lớn nhất tới cảm xúc của bé.
- Mắt chuẩn: tròng lớn xanh lá `#8FD3A8`/`#4FA37A`, con ngươi dọc `#2B3A4F`, hai điểm sáng trắng (to trên-trái, nhỏ dưới-phải), viền mi trên dày navy, mí trên hơi rũ, mi dưới mảnh, miệng nhỏ.
- Vùng mặt chính x 149–251, y 164–223; `.over` có thể rộng hơn (giọt lệ, tia ký hiệu).
- 18 khoá đầu còn được dùng làm **ảnh bán thân** (`faces/<khoá>.png`, 256 × 256, cắt khung [92,60,216,216]); `node tools/rig/faces.js` tự dựng.

18 khoá thoại (so khớp với bảng gốc; ảnh so sánh ở `art/review/compare_faces_18.png`): `normal happy laugh excited surprised scared sad cry angry shy flustered cold tired sleepy bored protest uncomfortable love`.
8 khoá phục vụ hình động: `blink` (nhắm nhẹ, cong xuống), `closed_happy` (^ ^), `sleep` (nhắm thư thái, miệng hé), `shout` (>< , miệng mở to, rung chuông), `wince` (> <, miệng nhỏ, lúc rơi), `o` (mắt tròn, miệng o nhỏ, bị nhấc), `yawn` (mắt nhắm, miệng ngáp), `talk` (như normal, miệng hé nhỏ).

| Khoá | Vùng bao `.svg` | Vùng bao `.over.svg` | Action dùng |
|---|---|---|---|
| `normal` | 149,168 – 251,212 | 159,154 – 241,159 | hold_note, idle, land, pat_head, ring, sleep, walk |
| `happy` | 149,168 – 251,212 | 159,150 – 241,158 | hold_note, idle |
| `laugh` | 149,177 – 251,208 | 159,149 – 241,221 | happy, pat_head |
| `excited` | 149,168 – 251,208 | 135,137 – 262,219 | happy |
| `surprised` | 149,165 – 251,221 | 138,112 – 240,150 | land, lifted, pat_head, ring, sleep |
| `scared` | 149,164 – 251,219 | 120,146 – 280,189 | fall |
| `sad` | 149,171 – 251,219 | 159,152 – 266,192 | idle |
| `cry` | 149,179 – 251,219 | 149,151 – 252,231 | —(khoá thoại/ảnh bán thân) |
| `angry` | 149,165 – 251,214 | 155,91 – 278,165 | —(khoá thoại/ảnh bán thân) |
| `shy` | 147,170 – 253,210 | 146,152 – 251,214 | pat_head |
| `flustered` | 147,168 – 253,218 | 139,135 – 255,168 | —(khoá thoại/ảnh bán thân) |
| `cold` | 149,172 – 251,211 | 158,157 – 242,162 | —(khoá thoại/ảnh bán thân) |
| `tired` | 149,174 – 251,213 | 158,156 – 242,164 | idle, walk |
| `sleepy` | 149,182 – 251,212 | 158,158 – 247,206 | idle, sleep, walk |
| `bored` | 149,173 – 251,212 | 158,103 – 242,163 | —(khoá thoại/ảnh bán thân) |
| `protest` | 144,177 – 256,215 | 158,151 – 242,214 | —(khoá thoại/ảnh bán thân) |
| `uncomfortable` | 149,176 – 251,212 | 156,142 – 244,165 | —(khoá thoại/ảnh bán thân) |
| `love` | 149,168 – 251,208 | 138,145 – 261,212 | —(khoá thoại/ảnh bán thân) |
| `blink` | 149,178 – 251,212 | 159,154 – 241,159 | hold_note, idle, pat_head |
| `closed_happy` | 149,177 – 251,212 | 159,152 – 241,158 | happy, idle, pat_head |
| `sleep` | 149,179 – 251,213 | 158,155 – 242,161 | sleep |
| `shout` | 149,170 – 251,222 | 116,152 – 284,213 | ring |
| `wince` | 149,171 – 251,223 | 117,151 – 283,173 | fall, land |
| `o` | 149,165 – 251,220 | 159,149 – 241,154 | lifted |
| `yawn` | 149,177 – 251,221 | 158,153 – 246,203 | sleep |
| `talk` | 149,168 – 251,208 | 159,154 – 241,216 | hold_note, ring |

(Ghi chú: `normal`, `blink`, `closed_happy`, `sleep`, `o`, `tired` có `.over` rất nhỏ — chỉ lông mày. `cry`, `laugh`, `excited`, `love`, `scared`, `shout`, `wince`, `flustered` có ký hiệu lớn.)

## 6. Cách thay (quy trình)

1. **Chuẩn bị canvas**: tạo tài liệu **400 × 400** (Krita, Clip Studio Paint, Photoshop, Illustrator, Inkscape đều được). Nên vẽ ở **1600 × 1600** (×4) rồi thu xuống, hoặc làm vector 400 × 400 để nét sắc ở mọi cỡ. Đặt `art/rig/mochi/parts/*.svg` hiện có làm **lớp dưới (tham chiếu, khoá)** để canh toạ độ; thêm hình tham chiếu `art/source/character-sheet.png`.
2. **Dựng khung dẫn**: đặt guide tại các pivot trong bảng mục 2 (và đường anchor y = 392, trục x = 200).
3. **Vẽ mỗi lớp trên một layer/tệp riêng**, trong suốt, đúng vùng bao, đúng chồng lấn mục 3.
4. **Xuất từng lớp thành SVG** cùng tên file trong bảng (`hair_back.svg`, `face/happy.svg`, …), `viewBox="0 0 400 400"`, ghi đè vào `art/rig/mochi/parts/`.
   - **Có công cụ vector (Illustrator, Inkscape, Affinity, hoặc Krita vector)**: vẽ vector thẳng, xuất SVG, tránh text (chuyển chữ thành đường), tránh filter blur.
   - **Họa sĩ vẽ raster (Krita/CSP/Photoshop)**: trình dựng hiện **chỉ đọc SVG**. Cách làm được (đã thử: kết xuất đúng): xuất PNG nền trong suốt, rồi bọc thành SVG:

     ```svg
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
       <image href="data:image/png;base64,..." x="0" y="0" width="400" height="400"/>
     </svg>
     ```
     (`base64 -w0 lop.png` để lấy chuỗi). Lưu ý: (a) PNG nên **1600 × 1600** để nét không vỡ khi xoay/phóng, nhưng mỗi PNG phình thêm ~33% khi base64; mục tiêu **≤ 300 KB mỗi lớp**, dùng PNG đã tối ưu (pngquant/oxipng); (b) tổng bộ mặt có 52 file, giữ mặt ≤ 60 KB mỗi file, hoặc vẽ mặt dạng vector; (c) bắt buộc `width`/`height` = 400 và `href` (không dùng liên kết ngoài, chỉ data URI); (d) nét viền raster vẫn 3 px quy đổi ở canvas 400 (12 px ở bản 1600); (e) gói hiện tại có ~110 khung PNG sinh từ rig: lớp raster nặng thì dựng lâu hơn nhưng kết quả cuối vẫn là PNG 400 × 400 nhẹ như cũ.
5. **Dựng lại**: `node tools/rig/build.js --faces` (toàn bộ action + ảnh bán thân; `--only idle,walk` để dựng một phần). Công cụ tự gọi `xvfb-run` nếu không có màn hình.
6. **Kiểm gói**: `node tools/anim/validate.js assets/pet/mochi`.
7. **Xem bằng mắt**:
   - Một tư thế: `node tools/rig/pose.js --out x.png --face happy --scale 2 [--bg checker]`.
   - Một action: `node tools/rig/sheet.js --contact idle` → `art/review/contact_idle.png` (thử cả `walk`, `ring`, `sleep`, `pat_head`, `happy`, `hold_note`, `lifted`, `fall`, `land`).
   - 18 mặt: `node tools/rig/sheet.js --faces` → `art/review/faces.png`.
   - So với bảng gốc: `node tools/rig/sheet.js --compare` → `art/review/compare_full.png`.
   - Kiểm tra **khe hở ở khớp** bằng cách xem các khung vẫy tay (`happy`), cầm chuông (`ring`), ngồi (`sleep`), gật đầu (`pat_head`).
8. Thử thay **từng lớp một** và dựng lại — dễ quay lui bằng `git` hơn thay cả bộ.

Thử nhanh khi chưa vẽ xong cả bộ: có thể trỏ `--parts <thư mục khác>` cho `pose.js/build.js` để không đụng bộ gốc.

## 7. Ràng buộc nghệ thuật

- **Bảng màu** (ART-BRIEF): tóc `#A9C4EE` / bóng `#7F9FD6` / sáng `#D5E4FA`; mống mắt `#8FD3A8`/`#4FA37A`, con ngươi `#2B3A4F`; da `#FFE6DA`/`#F2C4B5`, má `#F7B9B5`; áo khoác `#23262E`/`#14161B`, viền trắng `#F4F6FA`; sơ mi `#FFFFFF`/`#DDE5F2`; cà vạt, choker `#3B6FD0`/`#274A96`; nơ, tất, giày `#1C1E24`/`#0F1013`, ánh giày `#5A6070`; mèo bông `#2A2C33`/`#17181D`, mắt `#F3D36B`; chuông `#F2C94C`. Họa sĩ được tinh chỉnh nhưng **giữ sắc độ** và đồng nhất mọi lớp.
- **Nét viền** navy `#1F2A44` (không đen thuần): ngoài **3 px**, chi tiết trong 1,5–2 px (ở canvas 400), tròn đầu nét, đều giữa các lớp.
- **Tô phẳng + một lớp bóng** (cel). Cho phép tối đa một gradient nhẹ ở tóc/mắt. Không blur/glow, không texture nhiễu, không đổ bóng sàn.
- **Trang phục kín đáo, không đổi**: áo khoác đen oversize viền trắng, sơ mi trắng, cà vạt xanh, váy xếp ly đen (có quần trong), tất đen, boots buộc dây, huy hiệu mèo nhỏ. Không hở, không gợi dục.
- **Đặc điểm cố định**: tóc xanh nhạt rất dài tới đùi, ahoge, mái bằng rẽ nhẹ; mắt xanh lá mí rũ; kẹp X (bên phải người xem); nơ đen (bên phải người xem); choker xanh.
- **Không chữ** trong hình (kể cả trên huy hiệu, ký hiệu): ký hiệu ♪ ? ! tim vẽ bằng path.
- **Không dùng hình/âm thanh của VPet** (giấy phép riêng); vẽ mới hoàn toàn từ nhân vật Mochi (`art/source/character-sheet.png`).
- **`id` trong SVG có tiền tố tên file** (vd `hair_back-grad1`, `face_happy-g1`) để không trùng khi ghép nhiều lớp trong một khung.
- Không ảnh nhúng ngoài data URI, không font, không script, không liên kết ngoài. Mỗi file ≤ 16 MB (mục tiêu nhỏ hơn nhiều).
- Kích thước đầu và độ dày nét **không đổi giữa các lớp**. Không vẽ chi tiết phụ thuộc bên trái/phải ngoài nơ và kẹp (app có thể lật ngang; nơ/kẹp đổi bên là chấp nhận được).

## 8. Hạn chế của rig hiện tại (họa sĩ cần biết)

- **Chỉ nhìn chính diện.** Không có góc 3/4 hay nhìn nghiêng: `walk` là chuyển động rối giấy chính diện (xoay xương chân/thân), không phải đi nghiêng. Muốn góc 3/4 phải làm bộ rig/lớp mới (đề xuất lên phòng điều hành).
- **Tóc là mảng cứng xoay quanh pivot** (hair_back, sidelock, ahoge, ribbon), không có mô phỏng tóc/vải thật; vì thế gốc mảng tóc phải được giấu dưới mái, đuôi tóc không nên có chi tiết quá phức tạp bị méo khi xoay.
- **Cơ thể là các khối cứng**: tay/chân co duỗi bằng xoay + co giãn `sx/sy`, không biến dạng (không bẻ cong cẳng tay). Ống tay rộng giúp che khớp, nên giữ kiểu ống tay rộng.
- **Mặt là ảnh phẳng theo khoá** (26 khoá, đổi nguyên khối), không có mắt/miệng rời để ghép; mắt nhìn sang bên không có (trừ vài khoá có sẵn). Chớp mắt dùng khoá `blink`.
- **Không có vòng/ngón tay chuyển tiếp**: chỉ 5 kiểu tay (thường, open, fist, hold, point). Muốn thêm kiểu tay mới cần thêm biến thể + action.
- **Tư thế ngồi** (sleep) chỉ là chân gập bằng xoay xương + `hair_back.sit` + thú bông; không có lớp ngồi riêng.
- Đạo cụ cầm tay (chuông) bám cổ tay bằng toạ độ cố định nên bàn tay `fist` cần để trống chỗ nắm phù hợp (vị trí chuông ~ (214–283, 245–344)).
- Mọi thay đổi toạ độ, xương, tên lớp, khoá mặt phải do **phòng điều hành** đổi (`rig.json`), họa sĩ không tự đổi; cần thì ghi đề xuất ở `docs/rooms/art.md`, mục "Đề xuất cho phòng điều hành".

## 9. Danh sách nghiệm thu

- [ ] Mọi file trong bảng mục 2, 4, 5 đã được thay, đúng tên, `viewBox="0 0 400 400"`.
- [ ] Đầu khớp tròn đúng pivot, chồng ≥ 8 px, không lộ khe ở `happy`, `ring`, `sleep`, `pat_head`.
- [ ] 26 khoá mặt (+ `.over`) đủ; ảnh `faces.png` khớp bảng gốc.
- [ ] `node tools/rig/build.js --faces` chạy không cảnh báo thiếu bộ phận.
- [ ] `node tools/anim/validate.js assets/pet/mochi` qua.
- [ ] Màu, nét viền, trang phục đúng mục 7; không chữ; không tài sản VPet.
