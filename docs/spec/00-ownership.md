# Hợp đồng 00 — Ai sở hữu file nào

Một file chỉ có MỘT phòng được sửa. Cần thay đổi file của phòng khác: ghi vào mục "Đề xuất cho phòng điều hành" trong `docs/rooms/<phòng mình>.md`.

| Phòng | Được sửa |
|---|---|
| Điều hành | `src/main/main.js`, `context.js`, `bus.js`, `store.js` (trừ 2 hàm của notes), `tray.js`, `listWindow.js`, `scripts/**`, `docs/spec/**`, `docs/ROADMAP.md`, `CLAUDE.md`, `package.json` |
| core (Lõi nhân vật) | `src/main/pet/**`, `src/main/petcore/**`, `src/mascot/**`, `src/pet/**`, `assets/pet/**` **trừ** `assets/pet/mochi/**`, `tools/anim/**`, `docs/rooms/core*` |
| notes (Note, nhắc lịch, hiểu note) | `src/main/notes/**`, `src/main/alarms/**`, `src/list/**`, `src/alarms/**`, `src/shared/recur.js`, `src/shared/parse.js`, `src/shared/understand/**`, hàm `normalizeNote`/`normalizeReminder` trong `src/main/store.js` (chỉ 2 hàm này), `docs/rooms/notes*` |
| paper (Giấy & giao diện note) | `src/note/**`, `assets/paper/**`, `assets/fonts/**`, `docs/rooms/paper*` |
| art (Họa sĩ) | `art/**` (trừ `art/source/`), `assets/pet/mochi/**`, `assets/wardrobe/**`, `assets/items/**`, `tools/rig/**`, `docs/rooms/art*` |
| game (Game hóa) | `src/main/game/**`, `src/game/**`, `assets/game/**`, `docs/rooms/game.md` |
| persona (Thoại & tính cách) | `src/main/persona/**`, `src/shared/dialogue.js`, `assets/dialogue/**`, `docs/art/**`, `docs/persona/**`, `docs/rooms/persona.md` |
| qa | `test/**`, `build/**`, `docs/rooms/qa*` (chỉ báo lỗi, không sửa code phòng khác) |

Ngoại lệ có kiểm soát:
- `src/main/preload.js`: mỗi phòng chỉ sửa trong khối `BẮT ĐẦU PHÒNG <tên>` … `HẾT PHÒNG <tên>` của mình. Kênh IPC mang tiền tố phòng.
- `package.json`: phòng cần thêm thư viện thì ghi đề xuất, không tự sửa. Ưu tiên không thêm thư viện.
- Module main của phòng: tạo `src/main/<alarms|petcore|game|persona>/index.js` xuất `init(ctx)`; `main.js` tự nạp nếu có.
- `src/main/notes/**` và `src/main/pet/**` là code 0.1 đã tách sẵn; phòng sở hữu được viết lại thoải mái miễn giữ các hợp đồng dưới đây.


## Đợt 2 — chuyển quyền
- `src/note/**` chuyển từ notes sang **paper**. Notes cần thay đổi cửa sổ note thì thêm API trong khối preload của mình và ghi yêu cầu cho paper trong `docs/rooms/notes.md`.
- `assets/pet/mochi/**` chuyển từ core sang **art**. Core đặt gói hình tạm ở `assets/pet/placeholder/` và engine tự dùng khi `mochi` thiếu action.
- `src/shared/parse.js` chuyển từ điều hành sang **notes**.
- Khối preload mới: `BẮT ĐẦU PHÒNG paper` (`api.paper`, kênh `paper:*`).
