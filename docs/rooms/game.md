# Phòng 7 — Game hóa (`room/game`)

**Sứ mệnh**: làm việc thật → được thưởng → chăm và diện đồ cho bé Mochi. Vui, nhẹ nhàng, **không phạt** (CLAUDE.md), và **không bao giờ ảnh hưởng nhắc lịch**.
Đọc trước: `CLAUDE.md`, `docs/spec/*` (01 ngăn `game`, 02 sự kiện `game:*`), `docs/persona/MOCHI.md`, `docs/rooms/art.md` (lộ trình quần áo), `docs/VPET-NOTES.md` (cơ chế chỉ số, đồ ăn chống lặp).
File được sửa: `src/main/game/**`, `src/game/**`, `assets/game/**`, `docs/rooms/game*`, khối preload `PHÒNG game`.

## Đợt 2 — việc cần giao
1. **Kinh tế xu** (ngăn `game`): nhận xu khi xong note (+10), xong đúng hạn (+5), mỗi mục checklist (+2), xong việc dài hạn (+20), chuỗi ngày liên tục (thưởng ngày 3/7/30), lần đầu dùng tính năng. Nghe bus: `reminder:done`, `note:checkItem` (paper), `note:created`, `alarm:stopped`. Chống "cày": tối đa xu/ngày từ note tạo-rồi-xoá-ngay (note phải tồn tại ≥ 2 phút, mỗi note thưởng 1 lần). Phát `game:reward`, `game:levelup`, `game:mode` (mode từ chỉ số mood/energy — xem 01-data).
2. **Chỉ số bé nhẹ nhàng**: tâm trạng tăng khi được xoa đầu/cho ăn/khi cậu xong việc; năng lượng giảm chậm khi thức, hồi khi bé ngủ. Không ốm, không chết, không bỏ đi.
3. **Cửa sổ "Phòng của Mochi"** (`src/game/`): mở từ menu khay / menu chuột phải trên bé (đề xuất cho core/điều hành) / phím tắt đề xuất Ctrl+Alt+G. Gồm các tab:
   - **Tủ đồ**: xem trước bé mặc thử, mặc/cởi theo khe (hat, hairclip, glasses, neck, body, outer, hand, back — theo `docs/rooms/art.md`), lưu bộ đồ.
   - **Máy gacha**: 50 xu/lượt, 10+1 lượt 500 xu; độ hiếm Thường/Hiếm/Siêu hiếm/Huyền thoại với tỉ lệ ghi rõ trên máy; "bảo hiểm" chắc chắn ra Siêu hiếm sau 30 lượt; trùng đồ → đổi "mảnh" để mua đồ chọn sẵn. Hoạt ảnh quay viên nang. **Chỉ dùng xu kiếm trong app, không có nạp tiền.**
   - **Cửa hàng**: đồ ăn (bánh, trà sữa, cá cho mèo đen…) cho bé ăn tăng tâm trạng, có giảm hiệu quả khi ăn lặp (VPet).
   - **Nhiệm vụ**: 3 nhiệm vụ ngày ("xong 3 note", "dọn 1 note hết hạn", "xoa đầu bé"), 1 nhiệm vụ tuần; **Thành tích** (huy hiệu).
   - **Thống kê**: số việc xong theo ngày/tuần (biểu đồ nhỏ), chuỗi ngày.
4. **Danh mục đồ** `assets/game/catalog.json`: ít nhất 40 món chia khe & độ hiếm, đặt tên dễ thương tiếng Việt, lấy cảm hứng từ bảng nhân vật (đồ ngủ hình thú, đồ thể thao, đồng phục, cosplay, dự tiệc, mùa đông, cắm trại, tai nghe, nơ, kẹp tóc, ba lô, mèo đen bông…). Mỗi món có `id, slot, rarity, name, icon` — icon tạm là SVG phẳng do phòng tự vẽ; hình mặc lên người bé do phòng art làm sau theo `id` (đợt quần áo). Phát `game:outfit {worn: {slot: id}}` để core/art đổi hình.
5. Câu thoại khi trúng gacha/lên cấp/cho ăn: dùng `ctx.persona.pick('gacha_win'|'gacha_dup'|'levelup'|'feed'|'reward', vars)`.

## Tiêu chí nghiệm thu (ảnh xvfb trong `docs/rooms/game/`)
- Xong 1 note có hẹn → nhận xu (ảnh bé báo +xu); quay gacha (ảnh); tủ đồ mặc thử (ảnh); nhiệm vụ ngày.
- Test logic thuần: tính xu, chống cày, tỉ lệ gacha (mô phỏng 100.000 lượt khớp tỉ lệ ±1%), bảo hiểm 30 lượt, chuỗi ngày qua nửa đêm.
- Tắt game hóa trong cài đặt → mọi thứ note/nhắc vẫn chạy y nguyên.

## Trạng thái
_Cập nhật 15/10/2026 — kết thúc lượt Đợt 2 (phòng game)._

**Đã xong** (hợp đồng nội bộ: `docs/rooms/game/API.md`)
- Kinh tế xu (`src/main/game/logic/economy.js`): +10 xong note, +5 đúng hạn, +20 việc dài hạn (note ≥ 24 giờ), +2 mỗi mục checklist, +3 tắt báo thức (≤ 3/ngày), +20 lần đầu dùng 7 tính năng, chuỗi ngày 3/7/30 (+30/+70/+300). Chống cày: note phải tồn tại ≥ 2 phút, mỗi lần hẹn của note thưởng 1 lần (khoá `done:<id>:<due>`, note lặp được thưởng mỗi lần), mỗi mục checklist 1 lần, trần 300 xu/ngày từ note + checklist (quá trần vẫn đếm thống kê/nhiệm vụ). Level = floor(sqrt(exp)/10)+1.
- Chỉ số bé (`logic/stats.js`): năng lượng −0,15/phút khi thức (đáy 5), +1/phút khi bé ngủ hoặc máy rảnh; tâm trạng trôi dần về 50 (không dưới 20); xoa đầu +4 (tối đa 15 lần/ngày có tác dụng), cho ăn có giảm hiệu quả khi ăn lặp trong 6 giờ (×1/0,6/0,35/0,2/0,1). Mode happy/normal/tired/sad. Không ốm, không chết, không bỏ đi.
- Gacha (`logic/gacha.js`): 50 xu/lượt, 500 xu/10+1; tỉ lệ Thường 70% / Hiếm 24% / Siêu hiếm 5% / Huyền thoại 1%; bảo hiểm lượt thứ 30 chắc chắn ≥ Siêu hiếm; máy hiện cả tỉ lệ thực tế khi tính bảo hiểm (69,2/23,7/5,93/1,19%). Trùng → mảnh (1/3/10/30), đổi mảnh lấy món chưa có (5/15/50/150). Chỉ xu trong app, không nạp tiền.
- Nhiệm vụ & thành tích (`logic/quests.js`): 3 nhiệm vụ ngày (xong 3 note, dọn 1 note hết hạn = `note:trashed`, xoa đầu bé), 1 nhiệm vụ tuần (xong 15 note), 14 thành tích có thưởng xu.
- Danh mục `assets/game/catalog.json`: 56 món (8 khe × 7; 24 Thường / 16 Hiếm / 11 Siêu hiếm / 5 Huyền thoại; 9 bộ: ngủ, thể thao, đi học, cosplay, tiệc, mùa đông, cắm trại, thường ngày, mèo đen) + 11 đồ ăn, đủ icon SVG phẳng tự vẽ (`assets/game/icons/`, xem `docs/rooms/game/catalog-icons.png`). Người dùng mới được tặng kẹp tóc chữ X + cà vạt xanh (đồ gốc của bé).
- Main (`src/main/game/index.js`, `window.js`): ngăn `game` có normalize/migrate; nghe `reminder:done`, `note:checkItem`, `note:created`, `note:trashed`, `alarm:stopped`, `pet:interact`, `pet:posture`, `app:*`; phát `game:reward`, `game:levelup`, `game:mode`, `game:outfit`; câu thoại gacha/cho ăn qua `ctx.persona.pick` (+ câu mặc định). Mọi người nghe bọc try/catch; test chứng minh payload rác trên mọi kênh bus/IPC không ném lỗi. Game **không gọi** gì của notes/alarms (trừ móc nghiệm thu `MOCHI_GAME_DEMO_DONE`, chỉ chạy khi có biến môi trường).
- Cửa sổ "Phòng của Mochi" (`src/game/`): 5 tab Tủ đồ (xem trước bé mặc thử, mặc/cởi theo khe, lưu 6 bộ), Máy gacha (hoạt ảnh viên nang, kết quả 1 và 10+1, bảng tỉ lệ, đổi mảnh, lịch sử), Cửa hàng (đồ ăn, nhãn "bé hơi ngán"), Nhiệm vụ + Thành tích, Thống kê (cột 7 ngày/4 tuần, lịch nhiệt 5 tuần, chuỗi ngày). Công tắc "Game hóa" bật/tắt ngay trong cửa sổ. Dark mode. Phím 1–5 đổi tab, Esc đóng.
- Tắt game hóa: không thưởng, không đổi chỉ số, phát `game:mode normal` + `game:outfit {}`; note/nhắc chạy y nguyên (ảnh 10: note vẫn được bấm Xong, xu giữ 100).

**Ảnh nghiệm thu** (`docs/rooms/game/`, app thật chạy xvfb, dữ liệu mẫu có lịch sử 20 ngày + 2000 xu demo)
01 xong note có hẹn → bé báo kẹo/xu, nhiệm vụ ngày 1/3 · 02 gacha 10+1 · 03 đang quay · 04 kết quả 1 lượt · 05 tủ đồ mặc thử · 06 đang mặc · 07 nhiệm vụ + thành tích · 08 cửa hàng cho ăn · 09 thống kê · 10 tắt game hóa, note vẫn chạy · `catalog-icons.png`.
Tái tạo: `docs/rooms/game/shots/` (`seed.js <cfg>` tạo dữ liệu; `xvfb-run -a -s "-screen 0 1440x900x24" node docs/rooms/game/shots/drive.js $PWD/docs/rooms/game/shots/s3.js` với `XDG_CONFIG_HOME=<cfg> MOCHI_GAME_DEMO=1 MOCHI_GAME_DEMO_DONE=8 MOCHI_GAME_OPEN=quests SHOT_DIR=<thư mục>`; điều khiển app qua CDP cổng 9333, cần playwright toàn cục).

**Cách chạy test**: `TZ=Asia/Ho_Chi_Minh node --test src/main/game/__tests__/*.test.js` — 75 test (xu, chống cày, chuỗi qua nửa đêm, gacha 100.000 lượt khớp tỉ lệ ±1% cả có/không bảo hiểm, bảo hiểm 30 lượt, nhiệm vụ, normalize, tích hợp bus/IPC). Xem cửa sổ không cần Electron: `python3 -m http.server 8751` ở gốc repo → `http://localhost:8751/src/game/test/preview.html#gacha` (mock).
Biến môi trường gỡ lỗi: `MOCHI_GAME_OPEN=<tab>` mở sẵn cửa sổ; `MOCHI_GAME_DEMO=1` cộng 2000 xu khi < 2000 (không ghi thống kê); `MOCHI_GAME_DEMO_DONE=<giây>` bấm Xong note có hẹn đầu tiên.

**Đang dở / việc tiếp theo**
- Xem trước tủ đồ là bản tạm: icon chồng lên sprite theo điểm neo khe (`src/game/preview.js`). Khi phòng art có lớp `assets/wardrobe/<id>/` thì thay bằng hình mặc thật theo `id`.
- Bé trên desktop chưa đổi hình theo đồ đang mặc (core/art nghe `game:outfit`).
- Chưa có hoạt ảnh "cho ăn" trên bé (core có action `eat`; đề xuất bên dưới).
- Bộ đếm phút không bù thời gian máy ngủ (chỉ dùng cờ ngủ/rảnh) — có chủ ý, nhẹ nhàng.

**Vướng mắc**
- Phòng persona gọi đơn vị là "kẹo" trong câu `reward` ("Nhận được {count} kẹo"), giao diện game dùng "xu" theo đề bài → cần chốt một tên.
- `scripts/test-all.js` (điều hành) chưa chạy test phòng game.

## Đề xuất cho phòng điều hành
1. **Khay**: thêm mục "Phòng của Mochi…" → `ctx.game && ctx.game.open()`; và mục con "Máy gacha" → `ctx.game.open('gacha')`.
2. **Phím tắt** Ctrl+Alt+G → `ctx.game.open()` trong `tray.registerShortcuts`.
3. **Menu chuột phải trên bé** (core): "Phòng của Mochi", "Cho bé ăn…" → `ctx.game.open('shop')`, "Thay đồ…" → `ctx.game.open('wardrobe')`.
4. **scripts/test-all.js**: thêm job `['game (node --test)', ['--test', ...các file src/main/game/__tests__/*.test.js]]` (Node 22 không nhận thư mục, phải liệt kê file — giống job persona).
5. **core/art**: nghe `game:outfit {worn:{slot:itemId}}` để mặc đồ lên bé khi có lớp `assets/wardrobe/<id>/`; khe `hand` của game ứng với `hand_r` trong rig (art.md có `hand_l/hand_r`). Danh sách id ở `assets/game/catalog.json`.
6. **core**: khi game phát `persona:line` sau cho ăn, nếu muốn có hoạt ảnh `eat` thì đề xuất thêm sự kiện `game:fed {foodId, name}` (game sẵn sàng phát) để core chạy action `eat`.
7. **persona**: chốt đơn vị tiền ("xu" hay "kẹo") cho câu `reward`; nên tăng trọng số các câu có `{count}` để người dùng thấy số xu nhận được. Payload `game:reward.candy` là tổng xu của sự kiện (đã gộp thưởng thành tích/chuỗi).
8. **Cài đặt chung**: công tắc "Game hóa" hiện nằm trong cửa sổ Phòng của Mochi (`ctx.game` chưa có setEnabled công khai; có thể thêm nếu cửa sổ cài đặt chung cần).
