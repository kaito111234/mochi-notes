# Hợp đồng 03 — Gói hình động của bé

Một nhân vật = một thư mục `assets/pet/<packId>/` (người dùng có thể thêm gói ở `userData/pets/<packId>/`).

```
assets/pet/mochi/
  pack.json
  idle/normal/loop/0001_120.png 0002_120.png ...     # <số thứ tự>_<ms hiển thị>.png
  idle/happy/loop/...
  pat_head/normal/start/... loop/... end/...
  lifted/normal/loop/...
  faces/normal.png faces/happy.png ...                # (tuỳ chọn) ảnh bán thân dùng cho chế độ "ló lên góc màn hình"
```
- Đường dẫn: `<action>/<mood>/<phase>/<frame>_<ms>.png`. `phase` ∈ `single | start | loop | end`. `mood` ∈ `happy | normal | tired | sad`.
- **Fallback**: thiếu mood → `normal` → mood bất kỳ có sẵn. Thiếu action → `idle`. Thiếu `start`/`end` → chỉ chạy `loop`. Thiếu hẳn ảnh → engine vẫn chạy với `faces/` hoặc khung giữ chỗ (không crash).
- Mọi khung cùng kích thước canvas `pack.json.size`. PNG nền trong suốt.

```jsonc
// pack.json
{
  "id": "mochi", "name": "Mochi", "author": "...", "license": "...",
  "size": [400, 400],            // px canvas mỗi khung
  "scale": 0.6,                  // tỉ lệ hiển thị mặc định
  "anchor": [200, 392],          // điểm "bàn chân" trên canvas — đặt lên mép taskbar / cạnh note
  "hitbox": { "head": [120, 40, 160, 120], "body": [130, 160, 140, 200] },
  "hand":   [200, 250],          // điểm tay cầm — nơi gắn tờ note khi nhắc lịch
  "faces":  { "normal": "faces/normal.png", "happy": "faces/happy.png" },
  "actions": { "walk": { "speed": 2.2 } }   // tham số riêng tuỳ action
}
```

## Danh sách action (tối thiểu Đợt 1 phải chạy được với hình tạm)
`idle`, `walk`, `sit`, `sleep`, `pat_head`, `pat_body`, `lifted` (bị nhấc), `fall`, `land`, `peek_left`, `peek_right` (nấp mép), `hold_note` (giơ tờ note — nhắc lịch), `ring` (báo thức, rung chuông), `happy`, `sad`, `shy`, `angry`, `eat`, `work`, `wave`, `startup`, `shutdown`, `say` (cử chỉ khi nói).

Phòng persona viết bảng yêu cầu vẽ cho đúng danh sách này (`docs/art/ART-BRIEF.md`). Phòng core cung cấp công cụ `tools/anim/` để kiểm tra gói (đếm khung, kích thước, thiếu gì) và một gói hình tạm sinh tự động để test.

## Bảng hành động Đợt 3
Bảng hành động đầy đủ, tham số action (`seatY`, `tip`, `gripX`, `edgeY/edgeX`, `wallX`, `release`, `speed`…) và hitbox của gói `mochi` nằm ở `art/ACTIONS.md` (art sở hữu, là nguồn chuẩn). Gói `mochi` 400×400, scale 0.6, đủ 23 action hợp đồng + 14 action 2B; core đọc `pack.note.anchor`/`pack.json.actions` theo bảng đó.

## Chốt cách đổi đồ (điều hành, sau Đợt 3)
- **Khe thân** (`body`, `outer`): phòng art **dựng sẵn gói theo bộ đồ** `assets/pet/mochi@<outfitId>/` (đủ mọi action, cùng canvas/anchor với `mochi`). Core nạp gói theo `game:outfit.worn.body/outer`; thiếu action thì lấy từ `mochi` rồi `placeholder`.
- **Khe nhỏ** (`hat`, `hairclip`, `glasses`, `neck`, `hand`, `back`): art xuất ảnh lớp `assets/wardrobe/<itemId>/<slot>.png` + điểm neo; `pack.json` của gói có `slots: {head:[x,y], neck:[x,y], hand_r:[x,y], back:[x,y]}` theo từng khung hoặc theo action. Core vẽ chồng thời gian thực theo điểm neo.
- Mặc định khi chưa có đồ: gói `mochi` gốc.
