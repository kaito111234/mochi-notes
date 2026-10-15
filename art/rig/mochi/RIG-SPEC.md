# Đặc tả rig "rối giấy" bé Mochi (phòng art — hợp đồng nội bộ giữa các nhân viên)

Trưởng phòng art giữ file này. Nhân viên **không tự đổi toạ độ/khớp**; cần đổi thì ghi vào báo cáo cuối.

## 1. Hệ toạ độ
- Mọi file bộ phận là SVG **`viewBox="0 0 400 400"`**, vẽ **ngay tại vị trí của tư thế gốc** (đứng thẳng, nhìn chính diện, hai tay buông). Xếp chồng các file theo thứ tự lớp là ra nhân vật hoàn chỉnh — không cần biến đổi gì.
- Canvas khung hình = 400×400, `anchor` (giữa đế giày) = **[200, 392]**. Nhân vật đứng cao ~315 px (chóp ahoge y≈74 → đế giày y=392). Chibi ~2,5 đầu.
- Nhìn chính diện (giống ô "Trước" và "Đồ thường" của bảng gốc). **Bên "phải" trong tài liệu = bên phải người xem** (x lớn). Nơ đen ở bên phải người xem, kẹp chữ X trên mái phía phải người xem.

## 2. Mốc giải phẫu (tư thế gốc)
| Mốc | Toạ độ |
|---|---|
| Chóp ahoge | (206, 74), gốc ahoge (200, 98) |
| Đỉnh sọ (đỉnh tóc) | y = 94 |
| Mặt (da) | hình trứng/chibi, rộng x 138–262, đáy cằm y = 222; má phồng tròn ở 2 bên dưới |
| Tâm mắt | trái (173, 184), phải (227, 184); mỗi mắt ~30 rộng × 36 cao (y 166–202) |
| Lông mày | y ≈ 160 (nằm TRÊN mái — vẽ ở lớp `face_over`) |
| Miệng | tâm (200, 209) |
| Má hồng | (160, 200) và (240, 200) |
| Tai | (138, 188) / (262, 188) (phần lớn bị tóc mai che) |
| Cổ | x 191–209, y 214–234; choker y 226–232 |
| Vai | y ≈ 238, x 160–240 |
| Thân áo khoác | y 234–308, loe ra x 150–250 ở gấu |
| Cà vạt | từ cổ (200, 234) xuống mũi (200, 290) |
| Váy xếp ly đen | y 290–322, x 166–234 |
| Hông (khớp chân) | trái (187, 306), phải (213, 306) |
| Gối | trái (186, 348), phải (214, 348) |
| Đế giày | y = 392; giày trái x 172–198, phải x 202–228 |
| Vai (khớp tay) | trái (164, 244), phải (236, 244) |
| Khuỷu | trái (156, 278), phải (244, 278) |
| Cổ tay | trái (152, 306), phải (248, 306) |
| Tóc sau | mảng lớn y 96–345, x 104–296 (rất dài, tới đùi) |
| Tóc mai (trước vai) | trái x 126–154, phải x 246–274, xuống tới y ≈ 300 |
| Kẹp chữ X | tâm (236, 128) trên mái |
| Nơ đen | tâm (270, 134), hai đuôi ruy băng rủ xuống tới y ≈ 215 |

## 3. Bảng màu (từ ART-BRIEF)
Tóc `#A9C4EE` / bóng `#7F9FD6` / sáng `#D5E4FA` · Mống mắt `#8FD3A8` / `#4FA37A`, con ngươi `#2B3A4F` · Da `#FFE6DA` / `#F2C4B5`, má `#F7B9B5` · Áo khoác `#23262E` / `#14161B`, viền trắng `#F4F6FA` · Sơ mi `#FFFFFF` / `#DDE5F2` · Cà vạt, choker `#3B6FD0` / `#274A96` · Nơ, tất, giày `#1C1E24` / `#0F1013`, ánh giày `#5A6070` · **Nét viền `#1F2A44`** (navy, không đen thuần) · Mèo bông `#2A2C33`/`#17181D`, mắt `#F3D36B` · Chuông `#F2C94C`.
- Nét viền ngoài **3 px** (`stroke-width="3"`, `stroke-linejoin="round"`, `stroke-linecap="round"`), nét chi tiết bên trong 1.5–2 px. Tô phẳng + **một lớp bóng** (cel), không gradient phức tạp (cho phép 1 linearGradient nhẹ ở tóc/mắt). Không filter blur, không ảnh nhúng, không chữ, không font.
- `id` trong SVG phải có tiền tố tên file (vd `hair_back-grad1`) để không trùng khi ghép.

## 4. Xương (bone) — `rig.json`
Mỗi xương xoay quanh `pivot` (toạ độ tư thế gốc), con kế thừa biến đổi của cha.
```
root (200,392)
└ hips (200,306)
  ├ thigh_l (187,306) → shin_l (186,348)
  ├ thigh_r (213,306) → shin_r (214,348)
  └ chest (200,300)
    ├ head (200,228)
    │  ├ hair_back (200,120)   ├ sidelock_l (146,176)   ├ sidelock_r (254,176)
    │  ├ ahoge (200,98)        └ ribbon (270,134)
    ├ upper_arm_l (164,244) → forearm_l (156,278) → hand_l (152,306)
    └ upper_arm_r (236,244) → forearm_r (244,278) → hand_r (248,306)
```

## 5. Lớp (thứ tự vẽ từ sau ra trước) và file
Thư mục `art/rig/mochi/parts/`. Biến thể dùng hậu tố: `hand_r.open.svg`.
| z | Lớp | File | Xương |
|---|---|---|---|
| 1 | Tóc sau | `hair_back.svg` | hair_back |
| 2 | Đuôi nơ phía sau (tuỳ chọn) | `ribbon_back.svg` | ribbon |
| 3 | Tay trái trên/dưới (khi đưa ra sau) | — dùng chung lớp tay, z đổi bằng action |  |
| 4 | Chân trái: đùi / ống+giày | `thigh_l.svg`, `shin_l.svg` | thigh_l / shin_l |
| 5 | Chân phải | `thigh_r.svg`, `shin_r.svg` | thigh_r / shin_r |
| 6 | Váy | `skirt.svg` | hips |
| 7 | Thân: sơ mi, cà vạt (body) / áo khoác thân (outer, tuỳ chọn, bám torso z+1) | `torso.svg` / `outer_torso.svg` | chest |
| 8 | Cổ + choker | `neck.svg` | chest |
| 9 | Tay trên trái/phải (tay áo sơ mi; áo khoác `outer_upper_arm_*` bám z+0.5 và che tay áo sơ mi) | `upper_arm_l.svg`, `upper_arm_r.svg` | upper_arm_* |
| 10 | Cẳng tay (tay áo sơ mi có măng sét; áo khoác `outer_forearm_*` ống rộng viền trắng bám z+0.5) | `forearm_l.svg`, `forearm_r.svg` | forearm_* |
| 11 | Bàn tay | `hand_l.svg`, `hand_r.svg` (+ `.open` `.fist` `.hold` `.point`) | hand_* |
| 12 | Đầu: da mặt, tai, bóng tóc trên trán | `head.svg` | head |
| 13 | Mặt (mắt, miệng, má) | `face/<key>.svg` | head |
| 14 | Mái tóc | `hair_front.svg` | head |
| 15 | Mặt phủ trên mái (lông mày, ký hiệu ♪ ? ✦, giọt lệ, vạch) | `face/<key>.over.svg` (tuỳ chọn) | head |
| 16 | Tóc mai | `sidelock_l.svg`, `sidelock_r.svg` | sidelock_* |
| 17 | Kẹp X | `hairclip.svg` | head |
| 18 | Nơ | `ribbon.svg` | ribbon |
| 19 | Ahoge | `ahoge.svg` | ahoge |
| 20 | Đạo cụ / hiệu ứng | `props/<id>.svg`, `fx/<id>.svg` | tuỳ (hand_r, root, none) |

Bàn tay trước thân nhưng đầu/tóc mai đè lên tay khi tay ở thấp là đúng. Action có thể đổi z của lớp (vd tay giơ lên trước mặt ở `ring`).

## 6. Bộ mặt `face/<key>`
18 khoá của bảng: `normal happy laugh excited surprised scared sad cry angry shy flustered cold tired sleepy bored protest uncomfortable love`.
Thêm khoá phục vụ hình động: `blink` (nhắm nhẹ, cong xuống), `closed_happy` (^ ^), `sleep` (nhắm thư thái, miệng hé), `shout` (mắt nheo >< , miệng mở to — rung chuông), `wince` (> <, miệng há nhỏ — rơi), `o` (mắt tròn, miệng chữ o nhỏ — bị nhấc), `yawn` (mắt nhắm, miệng ngáp tròn), `talk` (như normal nhưng miệng mở nhỏ).
- `face/<key>.svg`: mắt, miệng, má hồng (vẽ dưới mái tóc → mái che mép trên mắt hơi hơi là đúng chất anime).
- `face/<key>.over.svg`: lông mày và ký hiệu nằm trên mái tóc. Ký hiệu (♪ ? ! ✦ tim, giọt mồ hôi) vẽ bằng path, **không dùng text**.
- Mắt chuẩn (normal): tròng lớn xanh lá, con ngươi tối hình bầu dục dọc, 2 điểm sáng trắng (to trên-trái, nhỏ dưới-phải), viền mi trên dày navy cong, mí trên hơi rũ (vẻ lạnh dịu), mi dưới mảnh. Miệng nhỏ.

## 7. Action (`tools/rig/actions/<action>.json`)
Xem `tools/rig/README.md` (phòng art viết). Tóm tắt: mỗi phase là danh sách khung; mỗi khung có `ms`, `face`, `bones` {tên: {r, x, y, sx, sy}} (độ, px, tỉ lệ), `swap` {lớp: biến thể}, `show`/`hide`, `z` {lớp: z mới}, `global` {r, px, py, x, y}. Khung kế thừa khung trước nếu `"inherit": true`.

## 7. Tủ đồ (body × outer)
Hai khe độc lập: `body` (torso, skirt, thigh_*, shin_*, upper_arm_*, forearm_*) và `outer` (`outer_torso`, `outer_upper_arm_*`, `outer_forearm_*`). Lớp rig có `follow`/`dz` (bám z, ẩn, opacity của lớp chủ) và `covers` (che lớp khác). Chi tiết và quy tắc vẽ: `WARDROBE.md`; dựng: `tools/rig/outfit.js`.
