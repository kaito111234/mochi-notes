# tools/anim — công cụ gói hình động

Hợp đồng: `docs/spec/03-animation.md`. Bộ đọc gói: `src/main/petcore/pack.js`. Chỉ dùng Node built-in (không cần npm).

## Sinh gói hình tạm
```
node tools/anim/make-placeholder.js [outDir]     # mặc định assets/pet/mochi
```
- Ghép từ 18 ảnh bán thân `assets/mascot/*.png` (chỉ đọc) + thân/váy/chân vẽ bằng hình đơn giản. Tất định, không random.
- Chạy lại sẽ xoá sạch các thư mục con và `pack.json` cũ trong `outDir` rồi sinh lại (mất ~10 giây).
- PNG ghi dạng bảng màu 256 (PLTE+tRNS) để gói nhỏ (~6 MB); gói thật của hoạ sĩ có thể dùng RGBA thường.
- Canvas 288x344, scale 0.6, anchor [144,338] (giữa đáy bàn chân), hand [216,200] (nơi renderer gắn tờ note; tay phải giơ lên ở `hold_note`).

## Kiểm gói
```
node tools/anim/validate.js <packDir> [--json]
```
In bảng action × mood × phase (số khung, tổng ms). Mã thoát 1 nếu có LỖI (thiếu `idle`, sai `pack.json`, khung sai kích thước / không có alpha / PNG hỏng, anchor-hand-hitbox ngoài canvas, faces thiếu); chỉ cảnh báo thì mã 0 (thiếu action khác, phase/mood lạ, tên khung sai…).

## Quy ước
- Đường dẫn khung: `<action>/<mood>/<phase>/<số>_<ms>.png`; mood: `happy normal tired sad`; phase: `single start loop end`. Không có `_<ms>` thì 100ms.
- Nhân vật mặc định nhìn sang PHẢI; engine lật ngang khi quay trái.
- `peek_left` = nấp ở mép trái màn hình: chỉ giữ NỬA PHẢI canvas (nửa trái trong suốt), nghiêng người vào trong; `peek_right` là bản lật. Cửa sổ đặt sao cho giữa canvas nằm đúng mép màn hình.
- Tờ note KHÔNG vẽ vào hình — renderer vẽ tại `hand`.
- `png.js`: `decode/encode/encodeIndexed`, `readSize` (đọc IHDR), `drawImage` (dịch/scale/xoay/lật, bilinear, source-over), `fillEllipse/fillRoundRect/fillPoly/drawLine`, `crop/flipH/clearRect/alphaBounds`.
