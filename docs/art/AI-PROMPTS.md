# Prompt mẫu cho công cụ vẽ AI — bé Mochi

Mục tiêu: sinh hình đúng chuẩn gói hình `assets/pet/mochi/` (xem `03-animation.md`, `ART-BRIEF.md`).
Prompt viết **tiếng Anh** (công cụ AI hiểu tốt hơn); phần giải thích bằng tiếng Việt.

Chuẩn đầu ra: PNG nền trong suốt, canvas **400×400**, chân chạm điểm **anchor [200,392]**, tay cầm đồ ở **hand [200,250]**.
Tên file: `assets/pet/mochi/<action>/<mood>/<phase>/<NNNN>_<ms>.png` — mood `happy|normal|tired|sad` (vẽ **normal trước**), phase `single|start|loop|end`. Mặt: `faces/<key>.png` 256×256.

---

## 1. Khối mô tả nhân vật cố định (character anchor)

Dán **nguyên văn** khối này vào đầu MỌI prompt, không sửa:

```
chibi girl character, 2.5 to 3 heads tall, very long pale light-blue hair with a small ahoge (antenna hair strand), green eyes, X-shaped hair clip on the left side of the head and a black ribbon bow on the right side of the hair, black oversized hooded jacket with white trim and a small white cat badge, white shirt underneath, blue necktie, black choker, modest black shorts under the jacket, black socks, black lace-up boots, fully clothed, modest outfit, cute, wholesome, calm shy expression, clean lineart, flat cel shading, soft pastel colors, full body, centered, consistent proportions, transparent background, no background
```

(Giải thích: tóc xanh nhạt rất dài + sợi tóc ngố, mắt xanh lá, kẹp chữ X + nơ đen, áo khoác đen viền trắng có huy hiệu mèo, sơ mi trắng, cà vạt xanh, vòng cổ đen, quần short đen kín đáo, tất đen, bốt đen. Tỉ lệ chibi 2,5–3 đầu. Trang phục luôn kín đáo, hình lành mạnh.)

## 2. Negative prompt chuẩn

```
nsfw, revealing clothes, cleavage, bare midriff, short skirt, upskirt, suggestive pose, sexualized, underwear, extra limbs, extra fingers, missing fingers, deformed hands, bad anatomy, text, watermark, signature, logo, background, scenery, floor shadow, frame, border, realistic, photo, 3d render, blurry, low quality, jpeg artifacts, cropped, cut off feet, multiple characters, different hairstyle, different hair color, different outfit
```

(Giải thích: cấm nội dung nhạy cảm, lỗi tay/chân thừa, chữ/watermark, nền, phong cách thật/3D, đổi kiểu tóc/trang phục, và nhân vật nhái VPet.)

Ghi chú theo công cụ: nếu công cụ không có ô negative (ví dụ vài dịch vụ web), thêm cuối prompt: `no text, no watermark, no background, modest clothing only`.

---

## 3. Mẹo giữ nhân vật nhất quán

1. **Ảnh tham chiếu**: dùng `art/source/character-sheet.png` (ảnh gốc của chủ dự án) hoặc **một khung đã duyệt** (ví dụ `idle/normal/loop/0001`) làm tham chiếu: img2img (độ mạnh/denoise 0.35–0.55), "character reference / --cref" (Midjourney), IP-Adapter / reference-only (Stable Diffusion), hoặc "dùng nhân vật này" (công cụ chat-ảnh). Cắt riêng từng ô nhân vật trong bảng thay vì đưa cả bảng.
2. **Cố định seed** và thông số (model, sampler, CFG, kích thước) cho cả đợt; chỉ đổi phần "action line".
3. **Cùng góc máy**: luôn nhìn ngang, chính diện hoặc 3/4 nhẹ, không cúi/ngước máy; cùng độ cao đầu và cỡ người trong mọi khung.
4. **Sinh sprite sheet** nhiều khung trong một ảnh (thêm `sprite sheet, 6 frames in a row, same character, same size, evenly spaced, transparent background`) rồi cắt: các khung cùng một lượt sinh sẽ giống nhau hơn sinh từng ảnh lẻ.
5. **Cách làm loop**: vẽ khung chính (A) và khung cực đoan (B), rồi chèn khung trung gian (tween) bằng img2img/ChatGPT/công cụ tween; khung cuối phải gần khung đầu (A→B→A). Idle loop chỉ cần chuyển động nhỏ (thở, chớp mắt, ahoge lắc).
6. **Mood** = cùng prompt, chỉ thêm cụm từ (mục 6). Giữ nguyên seed và tham chiếu.
7. **Sửa tay**: tay/ngón thường lỗi; sinh nhiều lần, chọn khung tốt; sửa bằng inpaint hoặc vẽ tay.

## 4. Hậu kỳ (bắt buộc cho mọi khung)

1. **Tách nền** nếu chưa trong suốt (rembg, remove.bg, Photoshop "Remove background"); kiểm tra viền răng cưa/viền trắng, dùng "decontaminate/defringe".
2. **Căn chân theo anchor**: đặt điểm giữa hai bàn chân/đế bốt tại **[200, 392]** trên canvas 400×400; mọi khung trong cùng action giữ nguyên điểm này (trừ khi cố ý nhảy/bay: `lifted`, `fall`).
3. **Resize về 400×400**: đổi kích thước canvas (không méo tỉ lệ), nền trong suốt, đầu không bị cắt; chừa lề.
4. **Kiểm tra hand [200,250]**: khung `hold_note`, `ring`, `eat`… phải có tay/đồ vật quanh điểm này.
5. **Đặt tên** `NNNN_ms.png` (0001_120.png…), bỏ vào đúng thư mục; điền `pack.json` (anchor, hitbox, hand).
6. **Chạy `tools/anim`** (phòng core) để kiểm số khung, kích thước, thiếu gì.

---

## 5. Prompt mẫu cho TỪNG action

Cách dùng: `[character anchor] + [action line] + [phase/frames] ; negative prompt`.
Mỗi mục: **Action line** (tiếng Anh, dán sau khối anchor) + giải thích + số khung gợi ý. Đợt vẽ 1 đánh dấu (Đ1).

### 5.1 idle (Đ1) — loop
```
standing relaxed facing the viewer, arms hanging at sides, gentle breathing pose, ahoge slightly swaying, long hair hanging down, neutral calm face
```
Đứng thả lỏng, thở nhẹ, chớp mắt. ~4–6 khung, 120–200 ms; chỉ khác nhau chút xíu (ngực/tóc/ahoge/mắt).

### 5.2 walk (Đ1) — loop
```
side view walking pose, mid-step, one foot forward, arms swinging slightly, hair and ahoge bouncing, cheerful small steps
```
Đi nghiêng (hướng phải; app lật ảnh cho hướng trái). Chu kỳ 6–8 khung, 100 ms; chân chạm anchor ở khung tiếp đất.

### 5.3 sit
```
sitting on the ground with knees together, hands resting on knees, relaxed, looking forward, hair pooled on the ground
```
Ngồi bệt, tay đặt gối. start (đứng→ngồi, 3 khung), loop (ngồi thở, 4 khung), end (ngồi→đứng, 3 khung). Mông chạm anchor.

### 5.4 sleep (Đ1)
```
sleeping curled up sitting, head resting on arms on knees, eyes closed, small "z" bubble, peaceful, hair covering sides
```
Ngủ gật ngồi gục đầu. start (gật gù, 3 khung), loop (thở chậm, 4 khung, 250 ms), end (giật mình tỉnh, 3 khung). Có thể thêm chữ "z" bằng hậu kỳ thay vì để AI vẽ chữ.

### 5.5 pat_head (Đ1)
```
standing, head slightly bowed and tilted, eyes closed happily, soft blush, shy smile, small hands clasped in front, a gentle pressing-down feeling on the head
```
Được xoa đầu: cúi đầu nhẹ, nhắm mắt cười, ngại ngùng. start (2), loop (4), end (2). Bàn tay người dùng không vẽ (con trỏ chuột đóng vai).

### 5.6 pat_body
```
standing, body slightly squished and wobbling, surprised blinking eyes then embarrassed look, arms pulled in, blush
```
Bị chọc/vỗ người: giật nhẹ, ngạc nhiên rồi ngại. loop 4 khung; start/end tuỳ chọn.

### 5.7 lifted (Đ1) — loop
```
being lifted by the back of the jacket, dangling in the air, legs hanging and kicking slightly, arms flailing a little, surprised wide eyes, hair hanging straight down
```
Bị nhấc lên: người treo lơ lửng, chân đung đưa. loop 4 khung, 120 ms. Điểm nắm: đỉnh đầu/gáy. Anchor ở giữa chân (chân không chạm đất).

### 5.8 fall (Đ1) — loop
```
falling through the air, arms raised up, scared surprised face, mouth open, hair and ahoge flying upward, legs bent
```
Rơi: tóc bay ngược lên, tay giơ lên. loop 2–3 khung, 80 ms.

### 5.9 land (Đ1) — single/start
```
landing on the ground, knees bent deeply, squashed pose, arms out for balance, dazed small eyes, a tiny dust puff
```
Tiếp đất: gối khuỵu, hơi bẹp, lảo đảo rồi đứng dậy. 4 khung (khuỵu → bật lên → đứng thẳng), 80–120 ms. Chân chạm anchor.

### 5.10 peek_left / peek_right
```
peeking out from behind the left edge, only half of the body visible, one eye and half the face looking out shyly, one hand gripping the edge
```
Nấp mép màn hình, ló nửa người. peek_right: đổi "left" thành "right" (hoặc lật ngang). loop 3–4 khung; hình chỉ vẽ nửa người sát mép canvas.

### 5.11 hold_note (Đ1)
```
standing and holding a small blank yellow sticky note with both hands in front of the chest at hand point, looking at the viewer, helpful earnest expression, note without any text
```
Giơ tờ note nhắc lịch (note trống để app gắn chữ thật). start (giơ lên, 3), loop (cầm, nhún nhẹ, 4), end (hạ xuống, 3). Hai tay quanh [200,250].

### 5.12 ring (Đ1)
```
holding a small golden handbell raised in one hand, ringing it, other hand near mouth shouting gently, motion lines near the bell, alert but cute face
```
Báo thức: lắc chuông. loop 4 khung, 100 ms, rung ngang nhẹ. Không dùng chữ/ký hiệu âm thanh bằng chữ; vạch chuyển động thì được.

### 5.13 happy (Đ1)
```
jumping lightly with both arms raised in joy, big happy open smile, closed curved eyes, sparkles around, hair bouncing
```
Mừng rỡ: nhảy nhẹ, giơ tay. single hoặc loop 4–6 khung.

### 5.14 sad
```
standing with head lowered, shoulders drooped, hands clasped in front, teary downcast eyes, small frown, hair hanging forward
```
Buồn: cúi đầu, vai xuôi. loop 3–4 khung chậm (200 ms). Chỉ buồn, không đau đớn.

### 5.15 shy
```
standing with one hand covering half the face, looking away sideways, strong blush, small embarrassed smile, other hand holding the jacket sleeve
```
Ngại ngùng: che mặt, đỏ mặt, liếc đi. loop 3–4 khung.

### 5.16 angry
```
standing with puffed cheeks, arms crossed, pouting, angry eyebrows, small anger mark above head, cute not scary
```
Giận dỗi (dễ thương, không dữ dằn): phồng má, khoanh tay. loop 3–4 khung. Dấu giận có thể thêm bằng hậu kỳ.

### 5.17 eat
```
sitting and eating a small sweet dessert (dango or small cake) with both hands at hand point, cheeks slightly full, happy closed eyes
```
Ăn đồ ngọt: cầm bánh, má phồng. start (nhận đồ, 3), loop (nhai, 4), end (ăn xong, 3). Đồ ăn đơn giản, không chữ.

### 5.18 work
```
sitting cross-legged with a small laptop on lap, typing, focused serious eyes, a pencil behind the ear, calm concentration
```
Làm việc cùng người dùng: ngồi gõ laptop. loop 4 khung, 150 ms. Màn hình laptop để trống/màu trơn.

### 5.19 wave
```
standing and waving one hand at the viewer, friendly smile, slightly tilted head, other arm down
```
Vẫy tay chào. loop 4 khung (tay trái–phải), 120 ms.

### 5.20 startup
```
waking up and stretching with arms up and a small yawn, then a bright smile, cheerful greeting pose, sparkles
```
Khởi động app: vươn vai, ngáp, mỉm cười chào. single 6–8 khung.

### 5.21 shutdown
```
yawning and rubbing one eye, hand waving a sleepy goodbye, heavy eyelids, small smile
```
Tắt app: ngáp, vẫy chào tạm biệt, buồn ngủ. single 6 khung.

### 5.22 say
```
standing facing the viewer, one hand raised in a small explaining gesture, mouth slightly open as if speaking, attentive friendly eyes
```
Cử chỉ khi nói (đi kèm bóng thoại do app vẽ): miệng mở khép. loop 3–4 khung, 150 ms. **Không vẽ bóng thoại/chữ.**

### Đủ 23 action
idle, walk, sit, sleep, pat_head, pat_body, lifted, fall, land, peek_left, peek_right (chung mục 5.10), hold_note, ring, happy, sad, shy, angry, eat, work, wave, startup, shutdown, say.

---

## 6. Biến thể mood (chỉ thêm cụm từ vào cuối action line)

Giữ nguyên mọi thứ khác (seed, tham chiếu, anchor). Mood `normal` vẽ trước và là bản dự phòng.

| Mood | Cụm thêm vào prompt |
|---|---|
| normal | _(không thêm)_ |
| happy | `, extra cheerful, bright sparkling eyes, gentle smile, slight blush, bouncier energy` |
| tired | `, tired sleepy look, half-closed heavy eyelids, slightly slouched posture, small dark circles, slower movement` |
| sad | `, a bit gloomy, downcast eyes, small frown, drooping posture, hair hanging heavier` |

(Không vẽ bệnh tật, vết thương hay cảnh "chết" — game hoá chỉ tới buồn/ngủ gật.)

## 7. Prompt mẫu cho faces (256×256, bán thân/đầu)

Dùng cho chế độ "ló lên góc màn hình". Khung 256×256, nền trong suốt, mặt nhìn thẳng, đầu + vai trên, căn giữa.

Khuôn:
```
[character anchor, but "bust up portrait, head and shoulders" instead of "full body"], square composition 1:1, face centered, expression: <EXPRESSION>
```

Thay `<EXPRESSION>` theo key (khớp ô "Biểu cảm khuôn mặt" trong bảng nhân vật gốc):

| key | EXPRESSION |
|---|---|
| normal | calm neutral face, small closed mouth |
| happy | gentle happy smile, eyes closed in a curve |
| laugh | laughing with open mouth, eyes closed, big smile |
| excited | sparkling eyes, open smile, cheeks flushed, enthusiastic |
| surprised | wide open eyes, small open mouth, surprised |
| scared | frightened, trembling, wide shaky eyes, small cold sweat drop |
| sad | sad downcast eyes, small frown |
| cry | crying with tears streaming, closed eyes, wobbly mouth |
| angry | puffed cheeks, angry eyebrows, pouting (cute) |
| shy | blushing, eyes looking away, small embarrassed smile |
| flustered | confused, swirling eyes, flushed face, sweat drop |
| cold | cool indifferent expression, half-lidded eyes, flat mouth |
| tired | tired droopy eyes, slight dark circles |
| sleepy | very sleepy, eyes nearly closed, yawning |
| bored | bored, half-lidded eyes, chin resting on hand |
| protest | pouting, cheeks puffed, eyes narrowed, protesting |
| uncomfortable | uneasy, awkward grimace, eyes averted |
| love | soft warm smile, blush, tiny heart effect (wholesome, friendly affection only) |

Gợi ý: sinh cả 18 mặt trong **một sprite sheet** (3 hàng × 6 cột, cùng seed) rồi cắt, đặt tên `faces/<key>.png`.

## 8. Lưu ý pháp lý và an toàn

- **Không** dùng hình/âm thanh của VPet hay bất kỳ nhân vật có bản quyền (anime, game, thương hiệu) làm ảnh tham chiếu hoặc nhắc tên trong prompt. Chỉ dùng ảnh gốc của chủ dự án (`art/source/character-sheet.png`) và các khung chính mình đã duyệt.
- **Kiểm tra điều khoản** của công cụ AI đang dùng về **mục đích thương mại**, quyền sở hữu hình sinh ra, và việc dùng ảnh tham chiếu; lưu lại tên công cụ, ngày, bản mô hình, prompt/seed (ghi vào `pack.json` mục `license`/`author` hoặc file ghi chú).
- Nhân vật luôn **kín đáo, lành mạnh**; loại bỏ khung có yếu tố gợi cảm hoặc đáng sợ dù AI sinh ra.
- Không để chữ/watermark/chữ ký lọt vào ảnh cuối.
