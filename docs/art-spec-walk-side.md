# Yêu cầu vẽ: bé Mochi đi NGHIÊNG (walk_side)

Tài liệu cho phòng art. Không cần biết code. Làm đúng tên thư mục và tên file bên dưới thì app tự nhận hình.

## 1. Mục đích

Hiện bé Mochi chỉ có hình NHÌN THẲNG. Khi bé đi ngang màn hình, app đang xoay nghiêng cả tấm hình (như búp bê giấy) nên trông phẳng và gượng.
Ta muốn bé khi đi ngang là dáng NHÌN NGHIÊNG thật như các thú cưng desktop phổ biến: quay hẳn sang một bên, bước đi.

Khi có bộ hình này, app tự dùng nó cho việc đi ngang và tắt hiệu ứng xoay giả. Nếu chưa có hình thì app chạy như cũ, không hỏng gì.

## 2. Tư thế tham khảo (mô tả)

- Thân quay hẳn 90 độ: thấy MẶT BÊN, không còn thấy chính diện.
- Chỉ thấy MỘT mắt (mắt gần), mũi/miệng nhỏ ở mép trước mặt. Mặt nhìn về hướng đi.
- Tóc dài bay ra phía SAU lưng khi bước (ngược hướng đi), đung đưa nhẹ theo nhịp.
- Hai tay vung ngược nhau theo bước chân: tay gần người xem vung ra trước thì chân gần người xem lùi sau, và ngược lại.
- Đầu hơi nhấp nhô lên xuống theo bước (khoảng 2 đến 4 px), thân hơi chồm về trước.
- Đây là dáng đi dễ thương, không phải dáng chạy: bước ngắn, nhẹ nhàng.
- Giữ NGUYÊN nhân vật: cùng màu da, màu tóc, nét viền, kiểu tô bóng, cỡ đầu so với thân như bộ nhìn thẳng. Lấy bộ idle/walk hiện có (assets/pet/mochi/idle, assets/pet/mochi/walk) làm mẫu.

## 3. Quy cách kỹ thuật

| Mục | Yêu cầu |
|---|---|
| Định dạng | PNG RGBA, nền TRONG SUỐT |
| Kích thước | đúng 400 x 400 px, mọi khung |
| Tỉ lệ | cùng tỉ lệ với bộ nhìn thẳng (không vẽ to hơn/nhỏ hơn) |
| Hướng | quay sang PHẢI (mặt nhìn về bên phải ảnh). App tự lật ngang khi bé đi sang trái |
| Chân chạm đất | đáy bàn chân chạm đúng y = 392 ở MỌI khung (kể cả khung nhấc chân: chân đang đứng vẫn chạm y = 392) |
| Tâm ngang | trọng tâm thân (giữa hông) nằm quanh x = 200 |
| Đỉnh đầu | khoảng y = 62 (đo trên khung idle hiện có: vùng hình chiếm x 96..304, y 62..394 gồm cả viền) |
| Bóng đổ | KHÔNG vẽ bóng dưới chân (app tự lo) |

Thông số đo từ gói hiện tại (pack.json và khung idle): cỡ 400x400, anchor [200, 392], hitbox đầu [126, 70, 148, 160], hitbox thân [146, 230, 108, 162], tâm tay [200, 262].
Hình nghiêng thường hẹp hơn hình thẳng nên cứ để dư lề trong suốt hai bên, đừng phóng to cho đầy khung.

### Sơ đồ khung 400 x 400 (nhìn từ phía trước, minh hoạ vị trí)

```
 x=0                       x=200 (tâm)                    x=400
  +-------------------------:-------------------------------+ y=0
  |                         :                               |
  |                    .---------.   <- đỉnh đầu y ~ 62     |
  |                   (  mắt  )   |                         |
  |         tóc bay <-- (       ) |   (mặt nhìn sang PHẢI)  |
  |          ra sau    '---------'                          |
  |                    |  thân  |    <- tay vung hai bên    |
  |                    |        |                           |
  |                    |        |                           |
  |                   /|        |\                          |
  |                  / chân     chân \                      |
  |               ___/_/          \_\___                    |
  +--------------=================--------------------------+ y=392  <- ĐÁY BÀN CHÂN LUÔN Ở ĐÂY
  |                                                         | y=400
  +---------------------------------------------------------+
```

Quy tắc: đỉnh đầu ~ y=62, bàn chân chạm y=392, thân xoay quanh x=200. Hướng tiến: sang PHẢI.

## 4. Các bộ hình cần vẽ

### 4.1 walk_side (BẮT BUỘC, mood normal)

Chu kỳ bước, lặp vô hạn. Khung cuối nối mượt về khung đầu.

- Khuyến nghị 8 khung, mỗi khung 110 ms (giống walk nhìn thẳng hiện tại, tổng 880 ms mỗi chu kỳ).
- Thứ tự gợi ý: chạm đất, hạ thấp, bước qua, nhấc cao, chạm đất chân kia, hạ thấp, bước qua, nhấc cao.
- Bé đi chậm và dễ thương; hãy vẽ bước ngắn để chân ít bị "trượt" trên nền. Một bước (chân này chạm đất đến chân kia chạm đất) ~ 440 ms.

### 4.2 walk_side mood tired (tuỳ chọn)

Cùng 8 khung nhưng uể oải: đầu cúi, vai trễ, bước chậm. Khuyến nghị 150 ms mỗi khung (khớp walk/tired hiện tại). Nếu không vẽ, app dùng bản normal khi bé mệt.

### 4.3 walk_side mood happy (tuỳ chọn)

Bước nhún nhảy hơn. 8 khung, 100 ms mỗi khung. Hiện app chỉ có các mood: normal, happy, tired, sad. Không vẽ thì dùng normal.

### 4.4 turn_side (tuỳ chọn, rất nên có)

Chuyển động xoay giữa nhìn thẳng và nghiêng.

- `start`: nhìn thẳng chuyển sang nghiêng, 3 khung (ví dụ nhìn thẳng, chéo 45 độ, nghiêng gần hẳn), mỗi khung ~ 70 ms. Khung cuối phải gần giống khung đầu của walk_side.
- `end`: nghiêng quay lại nhìn thẳng, 3 khung, đảo ngược start, mỗi khung ~ 70 ms. Khung cuối phải gần giống khung đầu của idle.
- Chấp nhận 2 đến 4 khung mỗi phase. Cả hai phase đều tuỳ chọn.

### 4.5 run_side (tuỳ chọn)

Dáng chạy khi bé chạy nhanh (ví dụ đuổi theo trái bóng, vội về chỗ). Bước dài hơn, người chồm hẳn về trước, tay vung mạnh, có khung hai chân cùng rời đất (khi đó chân sau vẫn phải đúng quy tắc: không khung nào được vượt y = 392 làm bé chìm xuống đất; khung bay lên thì đáy chân cao hơn 392 là được).

- 6 khung, 80 ms mỗi khung (tổng 480 ms).
- Chỉ phase `loop`.
- Không có thì bé chạy nhanh bằng walk_side.

> Lưu ý ngoại lệ về quy tắc "chân chạm y=392": CHỈ riêng run_side được phép có khung chân rời đất. walk_side và turn_side luôn có ít nhất một chân chạm y = 392.

## 5. Cây thư mục mẫu và tên file

Chép vào `assets/pet/mochi/`. Tên file: `NNNN_ms.png`. NNNN là số thứ tự 4 chữ số bắt đầu từ 0001 và liên tục, ms là thời lượng khung bằng mili giây. Ví dụ `0003_110.png` = khung thứ 3 hiện 110 ms.

```
assets/pet/mochi/
  walk_side/
    normal/loop/
      0001_110.png
      0002_110.png
      ...
      0008_110.png
    tired/loop/            (tuỳ chọn)
      0001_150.png ... 0008_150.png
    happy/loop/            (tuỳ chọn)
      0001_100.png ... 0008_100.png
  turn_side/               (tuỳ chọn)
    normal/start/
      0001_70.png
      0002_70.png
      0003_70.png
    normal/end/
      0001_70.png
      0002_70.png
      0003_70.png
  run_side/                (tuỳ chọn)
    normal/loop/
      0001_80.png ... 0006_80.png
  masks/
    head_side.json         (xem mục 7)
    walk_side/normal/loop/0001_110.png ... (mặt nạ, xem mục 6)
    walk_side/tired/loop/...
    turn_side/normal/start/...
    turn_side/normal/end/...
    run_side/normal/loop/...
```

Chỉ dùng tên mood: `normal`, `happy`, `tired`, `sad`. Chỉ dùng tên phase: `single`, `start`, `loop`, `end`. Tên sai sẽ bị bỏ qua.

## 6. Mặt nạ đồ mặc (masks)

Bé mặc áo/đồ có màu khác nhau. App tô màu áo bằng cách đọc một ảnh MẶT NẠ đi kèm mỗi khung. Mỗi khung hình PHẢI có một mặt nạ cùng đường dẫn, cùng tên file, cùng cỡ 400x400, đặt trong thư mục `masks/`:

```
walk_side/normal/loop/0003_110.png          <- khung hình
masks/walk_side/normal/loop/0003_110.png    <- mặt nạ của khung đó
```

Quy cách mặt nạ (đo từ các mặt nạ walk hiện có, xem thêm `src/shared/wear.js`):

- PNG RGB, 400x400, chỉ dùng 4 màu THUẦN (không khử răng cưa, không chuyển màu mềm):
  - ĐỎ thuần (255, 0, 0): vùng ÁO KHOÁC/áo ngoài (phần app sẽ đổi màu theo món đồ đang mặc).
  - XANH LÁ thuần (0, 255, 0): vùng ÁO SƠ MI bên trong.
  - XANH DƯƠNG thuần (0, 0, 255): vùng CÀ VẠT/nơ.
  - ĐEN (0, 0, 0): mọi chỗ còn lại (da, tóc, chân, nền) — giữ nguyên màu gốc.
- Chỉ cần tô các vùng nằm trong hình bé; app chỉ đổi màu những điểm hình thực sự không trong suốt.
- Mặt nạ phải khít với khung hình: cùng tư thế, cùng vị trí. Lệch vài px là viền áo bị lem màu.
- Khi quay nghiêng, nhiều phần sẽ bị che (cà vạt chỉ còn sườn, sơ mi lộ ít). Cứ tô đúng những phần nhìn thấy.
- Công cụ gợi ý: dùng cùng quy trình tạo mặt nạ walk hiện có (`tools/build_pet_masks.py` ra tay làm mẫu), hoặc tô thủ công trên layer riêng rồi xuất.

Nếu THIẾU mặt nạ: bé vẫn đi nghiêng bình thường nhưng áo giữ màu gốc (không đổi theo đồ mặc).

## 7. head_side.json (đồ đội đầu, kính, kẹp, đồ cầm tay)

Mũ, kính, kẹp tóc, khăn... là các lớp riêng đặt chồng lên đầu bé. Để chúng bám theo đầu khi đầu nhấp nhô, app cần biết ở mỗi khung đầu lệch bao nhiêu so với tư thế đứng.

File: `assets/pet/mochi/masks/head_side.json`. Định dạng GIỐNG HỆT `masks/head.json` hiện có: một đối tượng JSON, khoá là đường dẫn khung (so với thư mục gói), giá trị là `[dx, dy]` (hai số, đơn vị px trên khung 400x400, dx dương = đầu lệch sang phải, dy dương = đầu lệch xuống), đo từ đỉnh đầu so với khung idle/normal/loop/0001 (có giá trị [0, 0]).

Ví dụ thật từ head.json hiện tại (walk):

```json
{
  "walk/normal/loop/0001_110.png": [9.8, 1],
  "walk/normal/loop/0002_110.png": [16.3, 1],
  "walk/normal/loop/0003_110.png": [18.1, 1]
}
```

Mẫu cho head_side.json:

```json
{
  "walk_side/normal/loop/0001_110.png": [24.0, 2],
  "walk_side/normal/loop/0002_110.png": [24.5, -1],
  "turn_side/normal/start/0001_70.png": [8.0, 0]
}
```

Cách đo: lấy toạ độ tâm đỉnh đầu (giữa đỉnh đầu, không tính tóc bay) ở khung idle 0001 làm gốc, rồi ở từng khung nghiêng đo tâm đỉnh đầu, lấy hiệu. Mỗi khung (của walk_side, turn_side, run_side) cần một mục. Số lẻ một chữ số thập phân là đủ.

Nếu THIẾU head_side.json (hoặc thiếu mục của khung nào): trong lúc bé đi nghiêng, app tạm ẨN đồ đội đầu, kính, kẹp, đồ cầm tay và vật cầm để khỏi bị lệch. Đây là cách xử lý an toàn, không gây lỗi.

## 8. Toạ độ riêng cho dáng nghiêng (tuỳ chọn, trong pack.json)

Mặc định app dùng cùng toạ độ như dáng thẳng (chân anchor [200, 392], tay [200, 262], hitbox đầu [126, 70, 148, 160]). Nếu dáng nghiêng khác nhiều (thân hẹp, đầu lệch về phía trước) thì thêm vào `pack.json`:

```json
"side": {
  "anchor": [200, 392],
  "hand": [230, 262],
  "head": [150, 70, 110, 150]
}
```

Trong đó `head` là hộp [x, y, rộng, cao] của đầu (để vỗ đầu và đặt bong bóng chat). Cả ba khoá đều tuỳ chọn; thiếu thì dùng mặc định. Hãy báo lập trình viên điền, đừng tự sửa nếu không chắc.

## 9. Cách thả vào và kiểm tra

1. Chép các thư mục `walk_side`, `turn_side`, `run_side` vào `assets/pet/mochi/`, và các mặt nạ vào `assets/pet/mochi/masks/` đúng cây ở mục 5.
2. Chạy công cụ kiểm tra (cần Node, đã có sẵn trong dự án):
   ```
   node tools/check-pack.js
   ```
   Công cụ đếm khung mỗi bộ, kiểm cỡ 400x400, kiểm tên file, kiểm mặt nạ và head_side.json, rồi in báo cáo. Dòng cuối "0 lỗi" là đạt. "GHI CHÚ" là phần tuỳ chọn còn thiếu (không sao). "CẢNH BÁO" nên sửa. "LỖI" bắt buộc sửa.
3. Tắt hẳn app Mochi Notes (kể cả biểu tượng ở khay hệ thống) rồi mở lại. Gói hình chỉ được đọc lúc khởi động.
4. Cho bé đi ngang (bảo bé đi, hoặc đợi bé tự đi) và xem. Hình nghiêng chỉ được nạp vào bộ nhớ ở lần đi ĐẦU TIÊN, nên lần đầu có thể thấy dáng cũ ~1 giây rồi chuyển sang dáng nghiêng.
5. Thử mặc áo màu khác từ tủ đồ, đội mũ, rồi cho bé đi: áo phải đổi màu đúng, mũ bám đầu.
6. Thử cho bé đi sang cả hai hướng (trái, phải): hình sang trái là bản lật của hình sang phải, phải trông ổn.

## 10. Checklist nghiệm thu

- [ ] Mọi khung PNG RGBA 400x400, nền trong suốt.
- [ ] Quay sang PHẢI; lật sang trái vẫn đẹp (không có chữ/hoa văn bất đối xứng bị lật ngược).
- [ ] Đáy bàn chân chạm y = 392 ở mọi khung walk_side và turn_side (run_side: khung đạp đất chạm 392).
- [ ] Trọng tâm quanh x = 200; không khung nào bị cắt mép khung.
- [ ] Cùng tỉ lệ, cùng màu, cùng nét viền với bộ nhìn thẳng.
- [ ] walk_side/normal/loop: 8 khung x 110 ms, khung 8 nối mượt về khung 1.
- [ ] Chân không "trượt": nhịp bước khớp tốc độ di chuyển.
- [ ] turn_side start/end (nếu có): khung đầu/cuối khớp với idle và walk_side.
- [ ] Tên file đúng mẫu NNNN_ms.png, số liên tục từ 0001.
- [ ] Mỗi khung có mặt nạ cùng đường dẫn trong masks/, 4 màu thuần (đỏ/xanh lá/xanh dương/đen).
- [ ] masks/head_side.json có đủ mọi khung nghiêng, định dạng [dx, dy].
- [ ] `node tools/check-pack.js` báo 0 lỗi (0 cảnh báo càng tốt).
- [ ] Đã thử trong app: đi trái/phải, áo đổi màu, mũ bám đầu, không giật khi bắt đầu/dừng đi.
