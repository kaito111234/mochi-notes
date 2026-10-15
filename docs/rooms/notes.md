# Phòng 2 — Note & nhắc lịch (`room/notes`)

**Sứ mệnh**: mọi thứ người dùng ghi và mọi lời nhắc phải **đầy đủ như Sticky Notes và đáng tin tuyệt đối**: báo thức, nhắc lặp lại, dặn dò.
Đọc trước: `CLAUDE.md`, `docs/spec/*.md` (00, 01, 02), code `src/main/notes/*`, `src/note/*`, `src/list/*`, `src/shared/parse.js`.
File được sửa: xem `docs/spec/00-ownership.md` (dòng notes).

## Đợt 1 — việc cần giao
1. **Báo thức** (`src/main/alarms/`, ngăn `alarms`): tạo/sửa/xoá/bật tắt; một lần hoặc lặp (hằng ngày, ngày thường, chọn thứ trong tuần, hằng tháng); nhãn; âm báo (3 âm tổng hợp sẵn + chọn file âm thanh của người dùng); hoãn N phút; tính `nextAt` chính xác (DST không có ở VN nhưng vẫn dùng giờ địa phương đúng cách), bù khi máy ngủ dậy (kêu ngay nếu lỡ trong ≤ 30 phút, quá thì ghi "đã lỡ"). Phát `alarm:ring` và gọi `ctx.pet.enqueue({type:'alarm', ...})` (hoặc `ctx.pet.stage` khi phòng core đã có) — nếu bé tắt thì thông báo Windows có nút.
2. **Giao diện báo thức & dặn dò**: thêm tab trong cửa sổ danh sách (`src/list`) hoặc cửa sổ riêng `src/alarms/` — danh sách báo thức kiểu đồng hồ Windows (giờ to, công tắc, ngày lặp), form tạo nhanh; mục dặn dò.
3. **Dặn dò** (Memo): "khi mở máy", "buổi sáng/trưa/tối", "trước khi tắt máy" (bắt `session-end`/`before-quit`), lặp theo ngày; phát `memo:due`.
4. **Nhắc lặp cho note**: `reminder.repeat` (01-data.md). Hiểu tiếng Việt: "mỗi sáng 8h", "8h sáng hằng ngày", "thứ 2 hàng tuần", "các ngày trong tuần 9h", "ngày 5 hàng tháng", "mỗi 2 tiếng" (nếu làm được). Tạo `src/shared/recur.js` (thuần JS, có test) — **không sửa `parse.js`**; nếu cần đổi parse.js thì ghi đề xuất.
5. **Sticky note còn thiếu so với Windows**: tìm kiếm trong note, Ctrl+Z/Y chắc chắn, kéo thả ảnh ổn định, cỡ chữ (Ctrl +/−), chế độ chỉ đọc khi khoá, nhập/xuất (JSON + file .txt/.md), khôi phục từ bản sao lưu (`userData/backups`).
6. Kiểm thử: test logic thuần cho `recur.js` và tính `nextAt` (ít nhất 30 ca, có ca qua nửa đêm, cuối tháng, tháng 2, năm nhuận).

## Tiêu chí nghiệm thu (ảnh xvfb vào `docs/rooms/notes/`)
- Ảnh giao diện báo thức và dặn dò; báo thức thử 1 phút kêu được (bé hiện hoặc thông báo).
- `node test/...` của phòng chạy xanh (để test trong `src/shared/__tests__/` hoặc ghi đề xuất cho qa).
- Không làm hỏng luồng note 0.1.

## Trạng thái
_Cập nhật 2026-10-15 (lượt 1 của phòng)._

**Đã xong (Đợt 1, cả 6 việc)** — hợp đồng nội bộ: `docs/rooms/notes/API.md`.
1. Báo thức: `src/main/alarms/alarmService.js` + `alarmLogic.js`, cửa sổ chuông `src/alarms/ring.*`. Một lần / hằng ngày / ngày thường / chọn thứ / hằng tháng; nhãn; 3 âm tổng hợp + file riêng (chép vào `userData/alarm-sounds`); hoãn N phút; `nextAt` theo giờ địa phương (`src/shared/recur.js`); bù khi máy ngủ dậy (≤ 30 phút kêu, quá → "đã lỡ" + thông báo). Phát `alarm:ring/stopped/snoozed`; gọi `ctx.pet.stage.request` nếu có, không thì `ctx.pet.enqueue` (0.1 bỏ qua an toàn). Cửa sổ chuông của phòng LUÔN hiện; bé tắt → thêm thông báo Windows.
2. Giao diện: tab "Note | Báo thức | Dặn dò" trong cửa sổ danh sách (`src/list/alarms.js`, `memos.js`), tạo nhanh bằng câu tiếng Việt, mục "Đã lỡ"; Cài đặt có nhóm "Báo thức" và "Dữ liệu".
3. Dặn dò: `memoService.js` + `memoLogic.js`, popup `src/alarms/memo.*`. Khi mở máy, sáng (từ 06:00), trưa (từ 11:00), tối (từ 17:00) — lỡ khung thì hiện bù trong ngày; trước khi tắt máy (chặn `before-quit` một lần, tự thoát sau 60s; `session-end`/`shutdown` chỉ hiện thông báo vì không chặn được). Phát `memo:due`.
4. Nhắc lặp note: `reminder.repeat` (`scheduler.js`, `noteRepeat.js`); hiểu "mỗi sáng 8h", "thứ 2, 4, 6 lúc 9h", "ngày thường 9h", "ngày 5 hàng tháng", "mỗi 2 tiếng"… Chỉ tự tạo nhắc lặp khi có giờ rõ ràng. Bấm Xong → sang lần kế; tắt máy nhiều ngày → báo đúng 1 lần.
5. Note: tìm (Ctrl+F, không phân biệt dấu), undo/redo riêng (Ctrl+Z/Y/Shift+Z), kéo-thả/dán ảnh thu nhỏ, cỡ chữ (Ctrl +/−/0, Ctrl+lăn), khoá chỉ đọc (Ctrl+Shift+K — Ctrl+Shift+L đã là danh sách chấm của 0.1), chọn lặp trong panel nhắc, xuất .txt/.md. Nhập/xuất JSON/.txt/.md và khôi phục từ `userData/backups` (`dataTransfer.js`, `transferLogic.js`; trước khi khôi phục tự lưu `mochi-data-before-restore-*.json`, giữ 10 bản).
6. Test: 5 bộ, tổng 177 ca, xanh ở TZ Asia/Ho_Chi_Minh và America/New_York.

**Quyết định đã ghi**: báo thức vẫn kêu khi tắt "Âm thanh nhắc" (báo thức là chủ động); báo thức một lần sau khi kêu thì tự tắt (như đồng hồ Windows); chuông tự im sau 5 phút (cửa sổ còn); `repeat`, cỡ chữ, khoá note lưu ở `box.noteMeta` vì `store.js` bỏ khoá lạ của note; nhập note có hạn đã qua → đánh dấu xong (không nhắc dai đồ cũ); `Repeat.freq` thêm `'hourly'` và `anchor` (chỉ trong phòng).

**Ảnh nghiệm thu** (`docs/rooms/notes/`): `alarm-1min-acceptance.png` (báo thức thật đặt +1 phút kêu lúc 00:46 cùng note 0.1 vẫn nhắc), `alarm-ring.png`, `memo-popup.png`, `list-alarms.png`, `list-alarm-form.png`, `list-memos.png`, `list-data.png`, `list-restore.png`, `note-window.png`.

**Cách chạy test**
```
for t in src/shared/__tests__/recur.test.js src/main/alarms/__tests__/alarm.test.js src/main/alarms/__tests__/memo.test.js src/main/notes/__tests__/scheduler.test.js src/main/notes/__tests__/transfer.test.js; do TZ=Asia/Ho_Chi_Minh node $t || echo FAIL $t; done
```
Biến chạy thử: `MOCHI_DEV_ALARM=<phút>` (tạo báo thức thật sau N phút), `MOCHI_DEV_RING=1` (chuông thử sau 3s), `MOCHI_DEV_MEMO=1`, `MOCHI_DEV_TAB=alarms|alarms-new|memos|memos-edit|data|restore` (cùng `MOCHI_DEV_LIST=1`), `MOCHI_DEV_TRANSFER=1 MOCHI_DEV_DIR=<thư mục>`.

**Chưa kiểm được / đang dở**
- Chưa thử trên Windows thật: âm thanh, thông báo Windows, `before-quit` khi tắt máy, kéo-thả file thật từ Explorer, hộp thoại nhập/xuất (đã thử bằng chế độ dev không hộp thoại).
- Cửa sổ chuông và bong bóng của bé cùng ở góc dưới phải nên chồng nhau (ảnh nghiệm thu) — chờ phòng core có `stage` để phối hợp.
- Thông báo Windows chỉ bấm để mở, chưa có nút Tắt/Hoãn ngay trên toast (cần `toastXml` + kích hoạt giao thức).

**Việc tiếp theo cụ thể**
1. Khi core có `ctx.pet.stage`: thử lại báo thức/dặn dò với bé, đặt cửa sổ chuông tránh chỗ bé (hoặc ẩn chuông khi bé đang cầm chuông nhưng vẫn giữ nút Tắt/Hoãn).
2. Toast Windows có nút Tắt/Hoãn (`toastXml`).
3. Nối `ctx.persona.pick('alarm'|'memo', vars)` cho câu thoại khi phòng persona có.
4. Chạy thử bản đóng gói trên Windows.

**Vướng mắc**: không.

## Đề xuất cho phòng điều hành
1. `src/main/store.js`: `normalizeReminder` giữ `repeat` (dùng `normRepeat` trong `src/main/alarms/box.js`). Khi đó bản sao lưu cũng có lặp; `noteRepeat.js` vẫn tương thích (nhân bản vào `noteMeta` thành thừa nhưng vô hại).
2. `docs/spec/01-data.md`: ghi thêm `Repeat.freq: 'hourly'`, `Repeat.anchor?: number`, `Alarm.createdAt`, `Alarm.snoozedUntil?`, `box.missed/sounds/noteMeta` (xem `box.js`).
3. `src/main/tray.js` + `listWindow.js`: thêm mục khay "Báo thức…" / "Dặn dò…" → `ctx.list.open(tab)`; renderer list đã có hook chuyển tab (hiện qua `alarm:devHint`, có thể thêm kênh `list:tab`).
4. `package.json` `build.files`: loại `**/__tests__/**`. Phòng qa: thêm `npm test` chạy 5 bộ test ở trên.
5. Phòng core: `ctx.pet.enqueue` 0.1 bỏ qua kiểu `alarm`/`memo` — đúng ý; khi làm `stage` xin chừa góc dưới phải cho cửa sổ chuông (360×236) và popup dặn dò (cao hơn ~250px), hoặc báo kênh vị trí để phòng notes né.

---
# ĐỢT 2 — việc mới (phòng điều hành giao, làm sau khi đọc lại trạng thái Đợt 1 ở trên)
Chủ dự án nhấn mạnh: app phải **đọc hiểu note**, không chỉ nhận giờ. Phòng nhận thêm quyền `src/shared/parse.js`, `src/shared/understand/**`, 2 hàm chuẩn hoá trong `store.js` (xem 00-ownership). **Mất quyền `src/note/**`** (sang phòng paper) — cần đổi gì ở cửa sổ note thì cung cấp API qua `api.alarms` và ghi yêu cầu ở mục "Gửi phòng paper" dưới đây.
1. **Hiểu note** `src/shared/understand/` (thuần JS, chạy offline): `understand(text, now) → Insight` gồm:
   - **nhiều việc trong một note**: mỗi dòng/ý có giờ thành một mục `{line, title, due, repeat, intent, lead}`; "họp 9h, 14h gọi khách, tối 8h đi tập" → 3 mục;
   - checklist (dòng "-", "[ ]", "1.", "•"), tiến độ;
   - người (anh/chị/em/cô/chú + tên, @tên), nơi chốn ("ở/tại …"), số tiền ("500k", "1tr2", "2.000.000đ"), số điện thoại, đường link, email, #thẻ;
   - mức ưu tiên ("gấp", "quan trọng", "!!!", "ASAP"), hạn chót mềm ("trong tuần", "trước thứ 6", "cuối tháng");
   - đề xuất hành động: tạo nhắc cho từng mục, chuyển thành checklist, tách note, thêm báo thức, gọi/nhắn (hiện số).
   Bộ test ≥ 200 câu tiếng Việt đời thường (có/không dấu, viết tắt "h", "g", "ng mai", "t2", "cn").
2. **Nhiều nhắc trong một note**: `Note.reminders[]` (giữ `reminder` cũ tương thích: migrate trong `normalizeNote`), scheduler xử lý từng mục; chip/panel nhắc liệt kê nhiều mục (UI do paper làm theo API của bạn).
3. **API cho cửa sổ note & bé**: `mochi.alarms.insight(noteId|text)`, `mochi.alarms.applySuggestion(noteId, suggestionId)`; trong main: `ctx.notes.quickCapture(text, {source})` (bé dùng để "ghi giúp"), trả lại note + insight để bé đọc lại "Tớ ghi rồi, 15:00 tớ nhắc nha".
4. Phối hợp bé: dùng `ctx.pet.stage` (đã có ở main) cho báo thức/dặn dò; cửa sổ chuông né vùng bé (core công bố vùng chiếm chỗ — xem core.md Đợt 2) hoặc ẩn chuông khi bé đang cầm chuông nhưng vẫn có nút Tắt/Hoãn trên bé; câu thoại qua `ctx.persona.pick`.
5. Thông báo Windows có nút **Tắt / Hoãn** (toastXml) cho báo thức và nhắc note.
6. Kênh `list:tab` trong renderer danh sách (điều hành đang mở tab bằng `MochiList.setTab`).

## Gửi phòng paper (yêu cầu giao diện cửa sổ note)
_(phòng notes ghi ở đây khi có API mới)_

## ĐỢT 2B — chủ dự án bổ sung
1. **Thùng rác note** (xoá mềm): `ctx.notes.trash(id)`, `ctx.notes.restore(id)`, tự xoá hẳn sau 30 ngày; tab/khu "Thùng rác" trong danh sách. Xoá thường cũng vào thùng rác.
2. **Note hết hạn**: `ctx.notes.expiredCandidates()` → note đang dán mà (a) mọi nhắc đã Xong, hoặc (b) quá hạn > 24 giờ chưa xong, hoặc (c) checklist đã tick hết. Phát `note:expired {noteId, reason}` (tối đa 1 lần/note/ngày) để bé tới hỏi dọn.
