# Bản yêu cầu vẽ — bé Mochi (gói hình động `mochi`)

Dành cho họa sĩ hoặc người dùng công cụ vẽ AI. Đọc xong là vẽ được. Hợp đồng kỹ thuật gốc: `docs/spec/03-animation.md`. Hình tham chiếu nhân vật: `art/source/character-sheet.png` (bảng nhân vật của chủ dự án). Phần mẫu prompt AI nằm ở `docs/art/AI-PROMPTS.md`, bảng đánh dấu tiến độ ở `docs/art/CHECKLIST.md`.

---

## 1. Mục tiêu và phong cách

**Mục tiêu**: bộ hình động cho trợ lý ảo bé Mochi, hiển thị ở góc màn hình Windows, cao khoảng 240 px. Bé phải dễ thương, đọc rõ tư thế và cảm xúc ngay cả khi nhỏ.

**Phong cách**
- Chibi, tỉ lệ khoảng **2,5 đến 3 đầu** (đầu to, thân ngắn, tay chân ngắn mập nhẹ), giống dòng "chibi dạng meme" và "cử chỉ / hành động" trong bảng nhân vật.
- Nét sạch, liền. Tô màu phẳng, đổ bóng nhẹ một lớp (cel shading đơn giản), không gradient phức tạp, không texture nhiễu.
- Viền **đậm vừa** (khoảng 3 đến 4 px ở canvas 400, màu xanh navy đậm thay vì đen thuần), đều nét giữa các khung để khi nhỏ vẫn gọn.
- Trang phục **kín đáo**, đúng bộ "Đồ thường" trong bảng: áo khoác đen viền trắng, sơ mi trắng, cà vạt xanh, quần short đen, tất đen, boots. Không đổi trang phục giữa các khung.
- **Nền trong suốt**, không đổ bóng sàn dính vào hình (app tự thêm nếu cần), không viền sáng (glow) lan rộng.
- Mắt to, rõ, có điểm sáng. Mặt đủ lớn để nhận ra biểu cảm ở 240 px.

**Đặc điểm nhân vật (phải giữ nhất quán ở mọi khung)**
1. Tóc xanh nhạt **rất dài** (chấm gần tới đùi/khuỷu chân khi đứng), có **tóc ngố (ahoge)** dựng trên đỉnh đầu, mái bằng rẽ nhẹ che trán.
2. Mắt **xanh lá** (lục ngọc), mí hơi rũ, vẻ lạnh nhưng hiền.
3. **Kẹp tóc chữ X** xanh/bạc trên mái tóc và **nơ ruy băng đen** buộc ở một bên đầu (bên phải khung hình ở mặt chính diện trong bảng). Giữ đúng vị trí như bảng.
4. **Choker** xanh đậm quanh cổ, **cà vạt xanh** trên sơ mi trắng.
5. **Áo khoác đen** oversize, viền trắng ở tay và gấu, **huy hiệu mèo** nhỏ ở ngực/tay áo.
6. Quần short hoặc váy ngắn đen (mặc quần bên trong, kín đáo), **tất đen** dài, **boots** đen có dây buộc.
7. Thú bông **mèo đen** (đạo cụ dùng cho sleep và vài action khác).

**Bảng màu (ước lượng từ ảnh, họa sĩ có thể tinh chỉnh nhưng giữ sắc độ)**

| Phần | Màu nền | Bóng | Ghi chú |
|---|---|---|---|
| Tóc | `#A9C4EE` | `#7F9FD6` | điểm sáng `#D5E4FA`; nơ/kẹp xen xanh đậm |
| Mắt (mống mắt) | `#8FD3A8` | `#4FA37A` | con ngươi `#2B3A4F`, điểm sáng trắng |
| Da | `#FFE6DA` | `#F2C4B5` | má hồng nhạt `#F7B9B5` |
| Áo khoác | `#23262E` | `#14161B` | viền trắng `#F4F6FA` |
| Sơ mi | `#FFFFFF` | `#DDE5F2` | |
| Cà vạt / choker | `#3B6FD0` | `#274A96` | |
| Nơ ruy băng, tất, boots | `#1C1E24` | `#0F1013` | boots có điểm sáng xám `#5A6070` |
| Nét viền | `#1F2A44` | | xanh navy rất đậm |
| Mèo bông | `#2A2C33` | `#17181D` | mắt vàng `#F3D36B` |
| Tờ note (hold_note) | `#FFE58A` | `#F2C94C` | |

**Không dùng hình/âm thanh của VPet** (giấy phép riêng). Chỉ học cơ chế, xem `docs/VPET-NOTES.md`. Toàn bộ hình phải vẽ mới từ nhân vật Mochi.

---

## 2. Thông số kỹ thuật

| Mục | Giá trị |
|---|---|
| Canvas mỗi khung | **400 × 400 px** (theo `pack.json.size`) |
| Định dạng | PNG 32-bit RGBA, nền trong suốt hoàn toàn, anti-alias mép |
| Chiều cao nhân vật đứng | khoảng **300 đến 320 px** (tính từ chóp ahoge tới đế giày) |
| Điểm chân (anchor) | **[200, 392]** — đế giày/điểm chạm đất nằm tại đây, trục giữa x = 200 |
| Hitbox đầu | `[120, 40, 160, 120]` dạng `[x, y, rộng, cao]` — phủ đầu và tóc trên |
| Hitbox thân | `[130, 160, 140, 200]` — phủ thân và chân |
| Điểm tay cầm (hand) | **[200, 250]** — nơi app gắn tờ note, tương ứng vị trí hai tay đang giơ/cầm |
| Lề | chừa **tối thiểu 16 px** mỗi cạnh, không cắt sát, tóc dài và đồ vật không được bị xén. Ngoại lệ: `peek_left/right` (xem mục 4) |

> Hitbox và hand là số mẫu trong hợp đồng. Nếu thân hình vẽ ra lệch, họa sĩ báo lại để chỉnh `pack.json`, **đừng** vẽ lại cho vừa số.

**Quy tắc căn chân**
- Mọi khung của cùng một action: **chân giữ nguyên tại anchor**, đầu và thân nhún bằng cách co giãn nhẹ, không trượt cả hình lên xuống.
- Ngoại lệ được phép lệch anchor: `lifted` (chân lơ lửng), `fall` (rơi), `land` (khung đầu còn trên không), `sleep`/`sit`/`work` (ngồi/nằm, nhưng **điểm tiếp xúc đất vẫn y = 392**).
- Mọi khung của một action cùng canvas, cùng tỉ lệ, cùng độ dày nét. Nhớ giữ **kích thước đầu không đổi** giữa các action.

**Hướng mặt**: vẽ **nhìn sang phải** (3/4 hoặc chính diện tùy action). App tự lật ngang cho hướng trái, nên **không vẽ chữ hoặc chi tiết bất đối xứng phụ thuộc bên**. Riêng nơ đen và kẹp X: khi lật chúng đổi bên, đó là chấp nhận được.

**Tốc độ khung gợi ý**

| Kiểu chuyển động | ms mỗi khung |
|---|---|
| Thở/chớp mắt nhẹ (idle) | 120 đến 200 (khung chớp mắt 80) |
| Đi bộ | 100 đến 120 |
| Rung/lắc nhanh (ring) | 70 đến 90 |
| Cử chỉ vừa (wave, say, happy) | 100 đến 140 |
| Tư thế giữ (hold_note, sleep, work) | 160 đến 300 (khung giữ có thể dài 600 đến 1500) |
| Rơi | 60 đến 80 |

### Đặt tên file

```
<action>/<mood>/<phase>/<NNNN>_<ms>.png
```
- `NNNN`: số thứ tự 4 chữ số bắt đầu `0001`, liên tục, không nhảy cóc.
- `ms`: thời gian hiển thị của khung đó (số nguyên, mili giây).
- `phase` ∈ `single | start | loop | end`. `mood` ∈ `happy | normal | tired | sad`.

Ví dụ:
```
idle/normal/loop/0001_160.png
idle/normal/loop/0002_160.png
idle/normal/loop/0003_80.png          <- khung chớp mắt
pat_head/normal/start/0001_100.png
pat_head/normal/loop/0001_120.png
pat_head/normal/end/0001_140.png
wave/normal/single/0001_120.png
faces/happy.png
```
Tên thư mục dùng chữ thường, gạch dưới, không dấu, không khoảng trắng.

### Mood (4 loại) và fallback
`happy`, `normal`, `tired`, `sad`. Thiếu mood thì app tự rơi về `normal`, rồi mood bất kỳ có sẵn. **Vì vậy chỉ cần vẽ `normal` trước**; mood khác là phần thưởng thêm. Mục 4 ghi rõ action nào nên có mood khác, action nào không cần.

### Faces bán thân (`faces/<key>.png`)
Dùng cho chế độ "ló lên góc màn hình" và bong bóng thoại.
- Kích thước gợi ý **256 × 256 px**, PNG trong suốt, bán thân (từ ngực lên), mặt chiếm khoảng 70% chiều cao, nhìn chính diện hoặc nghiêng nhẹ.
- Hiện có bộ tạm trong `assets/mascot/manifest.json` (238×228) cắt từ bảng nhân vật. Bộ mới thay thế cùng khoá.
- 18 khoá dùng trong thoại (khớp "Biểu cảm khuôn mặt" và "Cảm xúc đặc biệt" của bảng nhân vật):

| Khoá | Biểu cảm | Khoá | Biểu cảm |
|---|---|---|---|
| `normal` | bình thường, dấu ? nhỏ tùy chọn | `cold` | lạnh lùng, mắt nhìn lệch |
| `happy` | vui vẻ, nheo một mắt | `tired` | mệt mỏi, quầng mắt nhẹ |
| `laugh` | cười tươi, miệng mở | `sleepy` | buồn ngủ, mắt lim dim |
| `excited` | hào hứng, mắt sáng, nốt ♪ | `bored` | chán nản, mặt xìu |
| `surprised` | ngạc nhiên, mắt tròn | `protest` | bướng, phồng má |
| `scared` | hoảng sợ, mắt run | `uncomfortable` | khó chịu, nhíu mày |
| `sad` | buồn, mắt cụp | `love` | yêu thích (thích món ngọt, thích mèo; mắt long lanh, tim nhỏ; KHÔNG lãng mạn) |
| `cry` | khóc nhẹ, vài giọt, không gào | `shy` | ngại ngùng, má đỏ, tay che miệng |
| `angry` | giận, dấu ✦ gân nhỏ; dỗi chứ không dữ | `flustered` | bối rối, mắt xoáy nhẹ |

---

## 3. Bảng tổng quan 23 action

Đợt vẽ: **1** = tối thiểu để app đẹp, **2** = làm app sinh động, **3** = hoàn thiện. Số khung là gợi ý (loop = tổng các khung phase loop).

| # | Action | Đợt | Phase | Số khung gợi ý | Thời lượng | Mood cần |
|---|---|---|---|---|---|---|
| 1 | `idle` | 1 | loop | 6 | ~1,2 s/vòng | normal, happy, tired, sad |
| 2 | `walk` | 1 | loop | 8 | ~0,9 s/vòng | normal (+ tired) |
| 3 | `lifted` | 1 | loop | 4 | ~0,8 s/vòng | normal |
| 4 | `fall` | 1 | loop | 3 | ~0,2 s/vòng | normal |
| 5 | `land` | 1 | single | 5 | ~0,5 s | normal |
| 6 | `pat_head` | 1 | start/loop/end | 3 + 4 + 3 | 0,3 + 0,5 + 0,4 s | normal, happy |
| 7 | `sleep` | 1 | start/loop/end | 4 + 4 + 3 | 1,0 + 3,0 + 0,8 s | normal |
| 8 | `hold_note` | 1 | start/loop/end | 3 + 4 + 3 | 0,4 + 1,6 + 0,4 s | normal |
| 9 | `ring` | 1 | start/loop/end | 2 + 4 + 3 | 0,3 + 0,4 + 0,4 s | normal |
| 10 | `happy` | 1 | single | 8 | ~1,2 s | normal |
| 11 | `sit` | 2 | start/loop/end | 3 + 4 + 3 | 0,4 + 2,0 + 0,4 s | normal, tired |
| 12 | `pat_body` | 2 | start/loop/end | 2 + 4 + 2 | 0,2 + 0,5 + 0,3 s | normal |
| 13 | `wave` | 2 | single | 6 | ~1,0 s | normal, happy |
| 14 | `say` | 2 | loop | 4 | ~0,8 s/vòng | normal, happy, tired, sad |
| 15 | `peek_left` | 2 | start/loop/end | 3 + 2 + 3 | 0,4 + 1,0 + 0,4 s | normal |
| 16 | `peek_right` | 2 | start/loop/end | 3 + 2 + 3 | 0,4 + 1,0 + 0,4 s | normal |
| 17 | `startup` | 2 | single | 8 | ~1,5 s | normal |
| 18 | `shutdown` | 2 | single | 8 | ~1,5 s | normal |
| 19 | `sad` | 3 | start/loop/end | 3 + 4 + 3 | 0,4 + 1,6 + 0,4 s | normal |
| 20 | `shy` | 3 | start/loop/end | 3 + 4 + 3 | 0,3 + 1,6 + 0,4 s | normal |
| 21 | `angry` | 3 | start/loop/end | 3 + 4 + 3 | 0,3 + 1,2 + 0,4 s | normal |
| 22 | `eat` | 3 | start/loop/end | 4 + 6 + 3 | 0,6 + 2,4 + 0,5 s | normal, happy |
| 23 | `work` | 3 | start/loop/end | 4 + 6 + 4 | 0,6 + 3,0 + 0,6 s | normal, tired |

Tổng ước tính Đợt 1: khoảng 80 khung (mood normal). Mood `happy` của idle và pat_head, mood `tired`/`sad` của idle là thêm trong Đợt 1.5, ưu tiên sau khi normal chạy tốt.

---

## 4. Chi tiết từng action

Quy ước chung cho mọi mục: *loop* phải **nối mượt khung cuối về khung đầu** (khung cuối gần giống khung đầu, không "giật"); *start* kết thúc ở tư thế bằng khung 1 của *loop*; *end* bắt đầu từ tư thế khung cuối của *loop* và kết thúc ở tư thế idle (đứng thẳng thả lỏng) để app nối tiếp được. Tóc dài luôn có chuyển động phụ (đuổi theo thân một nhịp trễ), ahoge đung đưa nhẹ.

### Mood: quy tắc chung
- **normal**: lạnh dịu, mắt rũ nhẹ, miệng nhỏ, đứng hơi co người (đúng tính cách ngại, hướng nội).
- **happy**: mắt cong cười hoặc sáng to, má hồng, miệng cười, vai thả lỏng, ahoge dựng lên, chuyển động nảy hơn một chút.
- **tired**: mí mắt rủ nửa, quầng mắt nhạt, vai rũ, lưng hơi khom, chuyển động chậm hơn (kéo dài ms thêm ~30%), thỉnh thoảng ngáp nhỏ. Không có mồ hôi, không xanh xao.
- **sad**: mắt cụp xuống, lông mày xệ, miệng mím nhỏ, đầu hơi cúi, tay cầm vạt áo. **Không khóc lóc thảm thiết**, cùng lắm một giọt lấp lánh ở khoé mắt. Nhẹ nhàng, gợi muốn an ủi, không gợi bi thương.
- **Game không phạt nặng**: tuyệt đối không có hình ốm, bệnh, chết, bầm, sắc mặt xanh.

---

### 4.1 `idle` — Đợt 1 (loop, 6 khung; mood: normal, happy, tired, sad)
- **Tư thế**: đứng thẳng, hai chân khép nhẹ, mũi giày hướng phải; hai tay thả trước bụng, ngón tay hơi cuộn vào nhau (hướng nội). Mặt nhìn người xem.
- **Chuyển động**: thở nhẹ (thân cao thấp ±3 px), ahoge đung đưa, tóc dài lay nhẹ cuối ngọn. **Một khung chớp mắt** (80 ms) ở khung 4.
- **Khung/ms**: 0001_160, 0002_160, 0003_180, 0004_80 (chớp), 0005_160, 0006_160.
- **Loop**: khung 6 gần khung 1.
- **Mood**: tired thở chậm, đầu gật nhẹ, chớp 2 lần; sad đầu cúi, mắt nhìn xuống; happy đung đưa người nhẹ tại chỗ (1–2 px).
- Đây là action xuất hiện nhiều nhất: dành công vẽ kỹ nhất.

### 4.2 `walk` — Đợt 1 (loop, 8 khung; mood: normal, tùy chọn tired)
- **Tư thế**: đi tại chỗ, **hướng mặt sang phải** (thân 3/4 hướng phải). App di chuyển cửa sổ, hình chỉ đổi chân; app lật ngang cho hướng trái.
- **Chu kỳ 8 khung** (hai bước): chạm chân phải, nhún xuống, chuyển trọng tâm, vươn chân trái, và đối xứng. Tay vung ngắn đối nghịch chân (tay cầm nhẹ vạt áo khoác cũng được). Tóc và vạt áo khoác bay trễ ra phía sau.
- **Khung/ms**: mỗi khung 110 (tổng ~880 ms).
- **Loop**: khung 8 nối khung 1 liền mạch, không trượt vị trí.
- **Anchor**: bàn chân nằm trên đường y = 392; khi chân nhấc lên, chân còn lại vẫn chạm đất. Thân nhún tối đa 6 px.
- **tired**: bước chậm hơn, đầu cúi, vai rũ (ms 150).
- `pack.json.actions.walk.speed` do app điều chỉnh; không cần vẽ tốc độ khác nhau.

### 4.3 `lifted` — Đợt 1 (loop, 4 khung; mood: normal)
- **Ngữ cảnh**: người dùng nhấn giữ và nhấc bé lên bằng chuột.
- **Điểm nhấc**: ở khoảng **[200, 60]**, tức đỉnh đầu/phía sau cổ áo, như đang bị xách. Vẽ **cổ áo khoác được kéo lên nhẹ** để thấy điểm kéo. Không vẽ bàn tay.
- **Tư thế**: thân buông thõng, **chân lủng lẳng** (không chạm đất, mũi giày chúc xuống), hai tay thả hoặc giơ nhẹ, mắt tròn ngạc nhiên hoặc nheo "hả?", miệng nhỏ hình "o". Tóc dài rủ xuống, đung đưa.
- **Chuyển động**: lắc lư như con lắc quanh điểm nhấc, biên độ ~8 px; chân đá nhẹ; ahoge ngược.
- **Khung/ms**: 4 khung, mỗi khung 200.
- **Loop**: lắc qua lại phải-trái nối mượt (khung 1 = khung 3 lật nhẹ cũng được).
- Không cần mood khác (cảm xúc ngạc nhiên đủ cho mọi tâm trạng).

### 4.4 `fall` — Đợt 1 (loop, 3 khung; mood: normal)
- **Ngữ cảnh**: thả bé khi đang nhấc lơ lửng, bé rơi xuống mép taskbar.
- **Tư thế**: rơi thẳng, hai tay giơ lên cao, tóc và áo khoác **bay ngược lên trên**, mắt nhắm tịt hoặc tròn hoảng, miệng há nhỏ (kêu "á", không chữ). Chân duỗi xuống, mũi giày hướng xuống.
- **Khung/ms**: 3 khung × 70 ms. Khung nhỏ hơn: tóc phồng khác nhau để thấy chuyển động gió.
- Không cần mood khác.

### 4.5 `land` — Đợt 1 (single, 5 khung; mood: normal)
- **Ngữ cảnh**: tiếp đất sau `fall`, hoặc sau `lifted` khi thả nhẹ.
- **Diễn biến**: (1) 60 ms chân vừa chạm, đầu gối gập; (2) 80 ms ngồi xổm sâu nhất, thân thấp 30 px, tóc phồng bồng ra; (3) 90 ms đứng dậy lấy lại thăng bằng, tay vẩy; (4) 100 ms chỉnh lại áo, lắc đầu; (5) 160 ms quay về tư thế idle.
- **Anchor**: chân luôn y = 392 từ khung 1. Có thể thêm 2–3 vệt bụi nhỏ (vẽ trên cùng khung, không ngoài canvas).
- Khung cuối khớp khung 1 của `idle`.

### 4.6 `pat_head` — Đợt 1 (start/loop/end; mood: normal, happy)
- **Ngữ cảnh**: người dùng rê chuột qua lại trên đầu để xoa đầu. Vì đầu bé phải chạm được, **không vẽ bàn tay người** (con trỏ của app thay thế).
- **start** (3 khung × 100 ms): bé hơi giật mình, vai co, mắt mở tròn rồi nheo dần.
- **loop** (4 khung × 120 ms): đầu hơi cúi nhận xoa, mắt nhắm cong hoặc nửa nhắm, má hồng, miệng cười nhỏ; đầu và tóc nhún nhẹ theo nhịp, ahoge ngả theo hướng xoa; tay chạm ngực hoặc nắm vạt áo. Một vài đốm lấp lánh nhỏ.
- **end** (3 khung × 140 ms): mở mắt, ngẩng đầu, hơi ngại (má đỏ), về idle.
- **happy**: cười tươi hơn, mắt cong hình ^^. **normal**: ngại ngùng, miệng mím, má hồng nhẹ.
- Vẽ trong khung đầu và vai phải ở dưới hitbox đầu `[120,40,160,120]`.

### 4.7 `sleep` — Đợt 1 (start/loop/end; mood: normal)
- **Tư thế loop**: ngồi/cuộn tròn trên mặt đất, **ôm thú bông mèo đen**, đầu gục lên mèo, mắt nhắm, miệng hé nhỏ. Tóc dài trải rộng quanh người như chăn. Giày vẫn thấy ở đáy canvas. Vẽ hai khung hít/thở khác nhau (thân phồng ±4 px), thêm vài bong bóng tròn nhỏ hoặc ký hiệu "z" cách điệu bằng nét cong (không phải chữ thật).
- **start** (4 khung × 250 ms): ngáp, dụi mắt, ngồi xuống, kéo mèo bông vào lòng, gục xuống.
- **loop** (4 khung: 800, 800, 800, 600 ms): chỉ thở chậm + bong bóng mũi nhỏ phình xẹp (tùy chọn).
- **end** (3 khung × 260 ms): giật mình mở mắt, mơ màng, đứng dậy, giữ mèo bông tới khi khung cuối thì **mèo bông biến mất** (hoặc cầm ở tay, thống nhất trong khung `idle` nếu chọn giữ).
- Không cần mood khác (ngủ đủ gợi tâm trạng rồi).
- Ghi chú: đây cũng là hình "ngủ gật" khi bé buồn (game hóa không phạt nặng).

### 4.8 `hold_note` — Đợt 1 (start/loop/end; mood: normal)
- **Ngữ cảnh**: nhắc lịch bằng **tờ note**. Là hình quan trọng nhất của app: **nhắc lịch phải rõ**, tư thế đàng hoàng, nghiêm túc nhưng dễ thương.
- **Tư thế**: bé đứng nhìn thẳng người xem, **hai tay giơ trước ngực/ngang mặt dưới cằm**, cầm một **tờ giấy note vàng** (`#FFE58A`, vuông ~**80 × 80 px**, hơi nghiêng 3–5°, góc dưới gấp nhẹ). Tờ note đặt **tâm tại điểm hand [200, 250]**.
- **Phương án giao hàng (chọn một, ghi vào pack):**
  - **A (khuyên dùng)**: vẽ **tay trống** (hai bàn tay khép như đang cầm giấy, khoảng trống 80×80 quanh [200,250]), **không vẽ tờ note**. App tự gắn tờ note có chữ thật vào điểm hand. Cách này không sinh chữ trong hình.
  - **B**: vẽ cả tờ note vàng **trống, không chữ**, nhưng chừa vùng phẳng để app đè chữ lên (không vẽ nhăn, không vẽ vạch dòng).
- **start** (3 khung × ~130 ms): giơ tay từ thả xuống lên ngang ngực, hơi nhón chân; **loop** (4 khung × 400 ms): đứng cầm note, nhún nhẹ, mắt nhìn người xem rồi chớp, ahoge đung đưa; **end** (3 khung × ~130 ms): hạ tay, mỉm cười nhẹ.
- Tay không che mặt, tay không che vùng giữa [160,210]–[240,290] (nơi hiện note).
- **Loop mượt**: tay giữ vị trí cố định, chỉ thân/tóc chuyển động. Không cần mood khác (nhắc lịch phải tất định, nhất quán).

### 4.9 `ring` — Đợt 1 (start/loop/end; mood: normal)
- **Ngữ cảnh**: báo thức, rung chuông to để gây chú ý.
- **Đạo cụ**: **chuông báo thức** tròn cổ điển (hai chuông nhỏ trên đầu, búa ở giữa, hai chân), màu vàng đồng `#F2C94C`, **không số, không kim chữ** (có thể vẽ mặt đồng hồ trơn với hai kim đơn giản). Cầm bằng hai tay ở điểm hand **[200, 250]**.
- **start** (2 khung × 150 ms): lôi chuông ra từ sau lưng/sát người, mắt mở to. **loop** (4 khung × 100 ms, xen khung rung ngược chiều): bé **giơ chuông lên cao hơn ngực** và rung mạnh, chuông và tay run ±5 px, vạch rung ")))" hai bên chuông (dạng nét cong), tóc bay, miệng hô to, mắt nheo. **end** (3 khung × ~130 ms): hạ chuông, thở ra, nhìn người xem.
- **Loop**: khung 4 nối khung 1 liên tục, nhanh, không ngừng.
- Chuông có thể vẽ ngay trong khung (không tách lớp), không cần khoảng trống cho note.
- Không cần mood khác.

### 4.10 `happy` — Đợt 1 (single, 8 khung; mood: normal)
- **Tư thế**: bé **vui mừng**, nhảy nhẹ tại chỗ (~20 px) hai lần, hai tay giơ nắm lên hoặc vỗ tay, mắt cong ^^ (hoặc "Cười tươi" trong bảng), miệng mở cười, má hồng, **nốt ♪ nhỏ và vài sao lấp lánh** bay quanh.
- **Diễn biến**: (1–2) hạ thấp lấy đà 100 ms; (3–4) bật lên đỉnh, tay giơ cao 100 ms; (5) rơi xuống chạm đất 80 ms; (6) lặp bật nhỏ hơn 100 ms; (7–8) đứng yên, tay ôm má cười, 160 ms.
- **Anchor**: chân chạm y = 392 ở khung 1–2, 5, 7–8; trên không khung 3–4 và 6 (cho phép).
- Khung cuối khớp `idle` happy. Chỉ cần mood `normal` (bản thân action đã là happy).

### 4.11 `sit` — Đợt 2 (start/loop/end; mood: normal, tired)
- **Tư thế loop**: **ngồi bệt/ngồi gập gối ôm chân** (theo hình "Ngồi" / hình chính trong bảng): hai chân co lại, hai tay ôm đầu gối hoặc chống cằm lên tay; mắt nhìn xa, tóc dài trải trên đất. Kín đáo: váy/short che kín, chân không hở cao, **không ngồi mở chân**.
- **start** (3 × ~130 ms): hạ người ngồi xuống; **loop** (4 khung, 400–600 ms): thở nhẹ, chớp mắt, đung đưa chân; **end** (3 × ~130 ms): đứng dậy phủi áo.
- **tired**: lưng khom, đầu gục lên đầu gối, mắt lờ đờ.
- **Anchor**: mông/giày chạm y = 392.

### 4.12 `pat_body` — Đợt 2 (start/loop/end; mood: normal)
- **Ngữ cảnh**: người dùng chạm thân bé (hitbox thân).
- **start** (2 × 100 ms): giật mình, co vai, mắt tròn. **loop** (4 × 125 ms): nhột nhẹ, cười khúc khích, hai tay ôm lấy thân, người rung nhẹ, má hồng, mắt nhắm một bên (nháy). **end** (2 × 150 ms): thở ra, về idle, hơi ngại.
- Biểu cảm ngại ngùng/nhột, **không gợi cảm**: bé phản ứng như bị chọc nhẹ, tay che trước bụng, nghiêng người.

### 4.13 `wave` — Đợt 2 (single, 6 khung; mood: normal, happy)
- **Tư thế**: **vẫy tay chào** một tay (tay phải của bé, hướng người xem), tay kia thả hoặc cầm vạt áo; hơi nghiêng đầu, mắt cong cười; "Vẫy tay" trong bảng.
- **Khung/ms**: giơ tay (100), vẫy trái (110), vẫy phải (110), vẫy trái (110), vẫy phải (110), hạ tay (140). Có thể tùy chọn dùng khung đầu và cuối chung với `startup`.
- **happy**: cười tươi hơn, nảy nhẹ. **normal**: cười mím, vẫy nhỏ hơn.

### 4.14 `say` — Đợt 2 (loop, 4 khung; mood: normal, happy, tired, sad)
- **Ngữ cảnh**: cử chỉ khi bong bóng thoại hiện chữ. Phải **trung tính** để hợp mọi câu nói và không gây xao nhãng.
- **Tư thế**: đứng như `idle`, **miệng mở/khép luân phiên** (không cần khớp từ), đầu gật nhẹ, một tay nhấc lên khoảng ngang ngực làm cử chỉ, tay còn lại thả.
- **Khung/ms**: mở (140), khép (120), mở nhỏ (130), khép (140).
- **Loop mượt**; nên giống idle về tỉ lệ để chuyển qua lại không giật.
- **Mood** nên có đủ 4 loại vì đây là hình hay thấy cùng thoại: happy cười miệng mở rộng, tired nửa mắt, sad miệng nhỏ cụp.

### 4.15 `peek_left` — Đợt 2 (start/loop/end; mood: normal)
- **Ngữ cảnh**: bé bị kéo sát **mép trái** màn hình và nấp bên cạnh, chỉ ló nửa người.
- **Tư thế**: chỉ **nửa người trái-trên** ló ra từ **mép trái canvas** (x = 0); phần cắt vát ngay tại mép, **không vẽ phần ngoài canvas**. Bàn tay (một hoặc hai tay) bám mép trái, đầu nghiêng ló ra, mắt nhìn người xem tò mò, ahoge ló. Phần thân trong khung chiếm khoảng **x ∈ [0, 170]**.
- **start** (3 × 130 ms): bước/trượt từ ngoài vào, ló đầu lên dần; **loop** (2 × 500 ms): chớp mắt, đầu nghiêng nhẹ, ngón tay gõ mép; **end** (3 × 130 ms): rụt lại hoặc chui ra.
- Ngoại lệ về lề (mục 2): **hình được phép chạm mép trái canvas**. Anchor của peek: giữ y = 392 nếu thấy chân; nếu chỉ ló nửa thân thì đặt đầu ở khoảng y 120–260.

### 4.16 `peek_right` — Đợt 2 (như `peek_left`, đối xứng)
- Ló từ **mép phải** canvas (x = 400), thân trong khung chiếm x ∈ [230, 400]. Nội dung y như `peek_left`.
- Vì app **có thể lật ngang** nên họa sĩ vẽ một hướng rồi lật ngang sinh hướng kia. Tuy vậy vẫn giao **cả hai thư mục** (phần lật có thể điều chỉnh nơ/kẹp cho đúng bên, hoặc chấp nhận nguyên).

### 4.17 `startup` — Đợt 2 (single, 8 khung; mood: normal)
- **Ngữ cảnh**: app vừa mở, bé xuất hiện.
- **Diễn biến**: (1–2) bé nhô lên từ đáy/chui ra từ vầng sáng nhỏ hoặc từ vòng tròn lấp lánh 200 ms; (3–4) ngáp vươn vai, dụi mắt 180 ms; (5–6) giơ tay chào nhẹ 120 ms; (7–8) đứng thẳng, cười, về idle 150 ms.
- Khung cuối khớp khung 1 của `idle`.

### 4.18 `shutdown` — Đợt 2 (single, 8 khung; mood: normal)
- **Ngữ cảnh**: app đóng, bé tạm biệt.
- **Diễn biến**: (1–2) vẫy tay chào 140 ms; (3–4) ngáp, dụi mắt, ôm mèo bông 180 ms; (5–6) quay lưng/cúi chào, chuẩn bị đi 150 ms; (7–8) nhỏ dần hoặc chui vào vầng sáng/vòng tròn mờ 150 ms, khung cuối **trống hoặc gần trong suốt** (app tự ẩn).
- Không buồn bã: nhẹ nhàng, "hẹn gặp lại" (gợi câu "Đừng lo… tớ vẫn ở đây mà").

### 4.19 `sad` — Đợt 3 (start/loop/end; mood: normal)
- **Tư thế**: đứng hoặc ngồi gục, **đầu cúi**, mắt cụp, lông mày xệ, miệng mím nhỏ, tay nắm vạt áo khoác trước người. Một giọt lấp lánh ở khoé mắt, **không khóc nặng**.
- **start** (3 × 130 ms): đầu cúi dần, vai chùng; **loop** (4 × 400 ms): thở dài nhẹ, thân hơi nhún, tóc rủ; **end** (3 × 130 ms): ngẩng lên, tự lắc đầu lấy lại tinh thần, thở ra.
- Gợi tình cảm "cần được an ủi" thay vì tuyệt vọng (không bi kịch). Đây là hành động hiển thị khi bị bỏ bê/hạn trễ: **luôn dịu**.

### 4.20 `shy` — Đợt 3 (start/loop/end; mood: normal)
- **Tư thế**: **ngại ngùng**: hai tay chắp trước ngực hoặc che miệng/nửa mặt, má đỏ rõ, mắt liếc sang bên, vai co, một chân cọ nhẹ vào chân kia (xoay mũi giày vào trong); theo hình "Ngại ngùng" trong bảng.
- **start** (3 × 100 ms): quay mặt đi, đưa tay lên; **loop** (4 × 400 ms): lúc lắc người, liếc nhìn trộm; **end** (3 × 130 ms): thả tay, cười gượng.
- Chỉ ngại kiểu bạn bè (khen, xoa đầu), không lãng mạn.

### 4.21 `angry` — Đợt 3 (start/loop/end; mood: normal)
- **Tư thế**: **dỗi/giận đáng yêu**: phồng má, mắt nheo, lông mày chéo, **dấu gân ✦ nhỏ ở trán** (biểu tượng đồ họa, không chữ), hai tay chống hông hoặc nắm lại thả sát người, dậm một chân; hình "Tức giận" trong bảng.
- **start** (3 × 100 ms): quay phắt, nhíu mày; **loop** (4 × 300 ms): dậm chân, lắc đầu, hơi thở phì (đám khói nhỏ cạnh mũi tùy chọn); **end** (3 × 130 ms): thở dài, quay đi hờn.
- **Dữ dằn tuyệt đối không**: không vũ khí, không dọa, không nghiến răng ghê. Nên rất dễ thương (kiểu "hừ!").

### 4.22 `eat` — Đợt 3 (start/loop/end; mood: normal, happy)
- **Đạo cụ**: món ngọt nhỏ: **bánh quy tròn, bánh mochi, kẹo mút hoặc ly nước ngọt** (hình "Đồ ngọt" trong bảng). Cầm bằng hai tay ở **hand [200, 250]**, kích thước khoảng 50–70 px.
- **start** (4 × 150 ms): lấy món ra, ngắm, mắt sáng lên; **loop** (6 khung × 400 ms: cắn, nhai má phồng, nuốt, miệng cười, lặp): hai má phồng nhai, món nhỏ dần qua các khung (khung 1 đủ, khung 6 còn nửa), mắt nhắm hưởng thụ, nốt ♪ nhỏ; **end** (3 × 170 ms): chùi miệng, cười mãn nguyện, món đã hết.
- **Loop mượt**: các khung cắn/nhai lặp được; nếu món nhỏ dần thì **khung 6 quay lại hình món đầy ở khung 1** (hoặc vẽ để món luôn đầy trong loop và chỉ `end` mới hết).
- **happy**: mắt cong, má hồng, nhai nhanh hơn.

### 4.23 `work` — Đợt 3 (start/loop/end; mood: normal, tired)
- **Đạo cụ**: **laptop** (mở, mặt sau hướng người xem, **không vẽ màn hình có chữ**: mặt sau trơn kèm logo hình tròn nhỏ tự chế, hoặc vẽ màn hình nghiêng chỉ thấy ánh sáng xanh). Đặt trên mặt đất/đùi.
- **Tư thế loop**: **ngồi** khoanh chân/quỳ gối (kín đáo) trước laptop, hai tay gõ phím, mắt nhìn màn hình, miệng mím tập trung, thỉnh thoảng nhìn lên (khung 4–5), đeo tai nghe tùy chọn (đồ "Tai nghe" trong bảng). Hình "Làm việc" trong bảng.
- **start** (4 × 150 ms): ngồi xuống, mở laptop; **loop** (6 × 500 ms): gõ phím (tay luân phiên), gật gù, chớp mắt; **end** (4 × 150 ms): gập laptop, vươn vai, đứng dậy.
- **tired**: gục đầu một tay chống má, mắt lờ đờ, ngáp, tay gõ chậm.
- **Anchor**: điểm chạm đất y = 392. Không cho laptop che mặt.

---

### Tóm tắt action cần mood khác ngoài `normal`
| Action | happy | tired | sad |
|---|---|---|---|
| `idle` | có | có | có |
| `say` | có | có | có |
| `pat_head` | có | không | không |
| `wave` | có | không | không |
| `eat` | có | không | không |
| `sit` | không | có | không |
| `work` | không | có | không |
| `walk` | không | tùy chọn | không |
| các action còn lại | không cần | không cần | không cần |

---

## 5. Quy trình giao hàng

**Cấu trúc thư mục mẫu** (nộp thành một thư mục `mochi/` hoặc file zip):
```
mochi/
  pack.json
  idle/normal/loop/0001_160.png ...
  idle/happy/loop/...
  walk/normal/loop/0001_110.png ... 0008_110.png
  lifted/normal/loop/...
  fall/normal/loop/...
  land/normal/single/...
  pat_head/normal/start|loop|end/...
  sleep/normal/start|loop|end/...
  hold_note/normal/start|loop|end/...
  ring/normal/start|loop|end/...
  happy/normal/single/...
  ... (các action còn lại theo bảng mục 3)
  faces/normal.png  faces/happy.png ... (18 khoá)
  src/                               # file nguồn, KHÔNG đưa vào gói chạy
    mochi.clip | mochi.psd | ...
```

**`pack.json` mẫu**
```json
{
  "id": "mochi",
  "name": "Mochi",
  "author": "<tên họa sĩ>",
  "license": "<giấy phép/điều khoản sử dụng>",
  "size": [400, 400],
  "scale": 0.6,
  "anchor": [200, 392],
  "hitbox": { "head": [120, 40, 160, 120], "body": [130, 160, 140, 200] },
  "hand": [200, 250],
  "faces": {
    "normal": "faces/normal.png", "happy": "faces/happy.png",
    "laugh": "faces/laugh.png", "excited": "faces/excited.png",
    "surprised": "faces/surprised.png", "scared": "faces/scared.png",
    "sad": "faces/sad.png", "cry": "faces/cry.png",
    "angry": "faces/angry.png", "shy": "faces/shy.png",
    "flustered": "faces/flustered.png", "cold": "faces/cold.png",
    "tired": "faces/tired.png", "sleepy": "faces/sleepy.png",
    "bored": "faces/bored.png", "protest": "faces/protest.png",
    "uncomfortable": "faces/uncomfortable.png", "love": "faces/love.png"
  },
  "actions": { "walk": { "speed": 2.2 } }
}
```
`scale` 0,6 nghĩa là canvas 400 hiển thị ~240 px. Nếu vẽ lệch số mẫu, ghi số thật vào `pack.json`.

**Cách kiểm (do phòng core cung cấp `tools/anim/`)**: chạy công cụ kiểm gói để đếm khung từng phase, báo sai kích thước, thiếu action/mood, tên file sai định dạng `<NNNN>_<ms>.png`. Hiện công cụ chưa có trong repo (`tools/` chưa tạo); khi có, họa sĩ chạy trước khi nộp. Trước đó tự kiểm tay theo danh sách:
1. Mọi PNG đúng **400×400**, có kênh alpha, nền trong suốt.
2. Tên đúng mẫu, số liên tục từ `0001`, `ms` là số nguyên.
3. Chân đúng đường y = 392 ở các khung đứng/ngồi.
4. Loop nối mượt (xem thử bằng cách lặp khung cuối → đầu).
5. Không chữ, không logo, không khung viền thừa.
6. Mỗi action có ít nhất `mood = normal`.

**Giao theo đợt**: nộp từng đợt (1, 2, 3); chấp nhận hình tạm giữa đợt. Đánh dấu tiến độ trong `docs/art/CHECKLIST.md`.

**File nguồn**: nộp kèm **file gốc phân lớp** (PSD, CLIP, hoặc tương đương: tách lớp nét, màu, bóng, tóc, tay, đạo cụ), để chỉnh sửa về sau. Để ở thư mục `src/` hoặc kho lưu riêng; không bỏ vào gói chạy. Ghi rõ **giấy phép / quyền sử dụng** hình vẽ (đặc biệt nếu dùng AI vẽ: nêu công cụ, prompt, và điều khoản thương mại).

---

## 6. Những điều cần tránh

- **Trang phục hở hoặc gợi cảm**: không hở ngực, hở lưng, hở đùi, không đồ lót lộ, không tư thế hay ống kính nhấn vào thân thể. Ngồi, nằm phải kín đáo; váy/short luôn che kín.
- **Góc máy gợi cảm**: không nhìn từ dưới lên hoặc từ trên xuống nhấn thân thể, không cận cảnh, không "pose" khiêu gợi. Giữ góc ngang tầm mắt, khung hình toàn thân.
- **Nội dung lãng mạn/gợi cảm**: khuôn mặt "love" chỉ biểu thị thích đồ ngọt, mèo, bạn bè; không đỏ mặt gợi tình, không ôm ấp mờ ám.
- **Máu me, bệnh tật, thương tích, cái chết**: không máu, không băng gạc, không sắc mặt xanh bệnh, không dáng "sắp chết". Buồn và ngủ gật là mức tối đa.
- **Dữ dằn**: giận kiểu "dỗi" đáng yêu; không vũ khí, không dọa nạt.
- **Logo, thương hiệu, nhân vật có bản quyền**: không logo hãng, không nhân vật của người khác; huy hiệu mèo chỉ là mèo tự vẽ, laptop/điện thoại/tai nghe **không logo thật**. **Không dùng bất kỳ hình/âm thanh nào của VPet.**
- **Chữ trong hình**: không chữ cái, không từ, không số (kể cả trên note, màn hình laptop, áo, đồng hồ). Chỉ được **ký hiệu đồ họa nhỏ** như ♪, ?, !, ✦, tim nhỏ, dấu sao lấp lánh, dấu "z" cách điệu bằng nét cong. Chữ trên tờ note do app tự gắn.
- **Đổi nhân vật**: không đổi màu tóc/mắt/trang phục giữa các khung hoặc giữa các action; không thêm phụ kiện lạ (trừ đạo cụ đã nêu).
- **Cắt sát, lệch anchor, đổi kích thước canvas giữa các khung**.
