# Hợp đồng 00 — Ai sở hữu file nào

Một file chỉ có MỘT phòng được sửa. Cần thay đổi file của phòng khác: ghi vào mục "Đề xuất cho phòng điều hành" trong `docs/rooms/<phòng mình>.md`.

| Phòng | Được sửa |
|---|---|
| Điều hành | `src/main/main.js`, `context.js`, `bus.js`, `store.js`, `tray.js`, `listWindow.js`, `src/shared/parse.js`, `docs/spec/**`, `docs/ROADMAP.md`, `CLAUDE.md`, `package.json` |
| core (Lõi nhân vật) | `src/main/pet/**`, `src/main/petcore/**`, `src/mascot/**`, `src/pet/**` (renderer mới nếu cần), `assets/pet/**`, `tools/anim/**`, `docs/rooms/core.md` |
| notes (Note & nhắc lịch) | `src/main/notes/**`, `src/main/alarms/**`, `src/note/**`, `src/list/**`, `src/alarms/**` (cửa sổ mới nếu cần), `src/shared/recur.js`, `docs/rooms/notes.md` |
| game (Game hóa) | `src/main/game/**`, `src/game/**`, `assets/game/**`, `docs/rooms/game.md` |
| persona (Thoại & tính cách) | `src/main/persona/**`, `src/shared/dialogue.js`, `assets/dialogue/**`, `docs/art/**`, `docs/persona/**`, `docs/rooms/persona.md` |
| qa | `test/**`, `build/**`, `docs/rooms/qa.md` |

Ngoại lệ có kiểm soát:
- `src/main/preload.js`: mỗi phòng chỉ sửa trong khối `BẮT ĐẦU PHÒNG <tên>` … `HẾT PHÒNG <tên>` của mình. Kênh IPC mang tiền tố phòng.
- `package.json`: phòng cần thêm thư viện thì ghi đề xuất, không tự sửa. Ưu tiên không thêm thư viện.
- Module main của phòng: tạo `src/main/<alarms|petcore|game|persona>/index.js` xuất `init(ctx)`; `main.js` tự nạp nếu có.
- `src/main/notes/**` và `src/main/pet/**` là code 0.1 đã tách sẵn; phòng sở hữu được viết lại thoải mái miễn giữ các hợp đồng dưới đây.
