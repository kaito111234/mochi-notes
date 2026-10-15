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
**Đợt 2 (mới):**
- A. `scripts/test-all.js`: thêm `src/shared/__tests__/parse.test.js`, `src/shared/understand/__tests__/entities.test.js`, `understand.test.js`, `src/main/notes/__tests__/reminders.test.js`, `insight.test.js`, `src/main/alarms/__tests__/placement.test.js`, `toast.test.js`.
- B. `src/main/main.js` `second-instance`: bỏ qua mở danh sách khi argv có `mochi-notes://` (toast.js tự xử lý URL): `(_e, argv) => { if ((argv||[]).some(a => /^mochi-notes:\/\//i.test(a))) return; ctx.list.open(); }`.
- C. `docs/spec/01-data.md`: ghi `Note.reminders: Reminder[]` (thêm `id, title?, key?, line?`), `Note.remindMuted: string[]`, `Note.reminder` = primary (xem API2.md mục 3). `02-events.md`: `reminder:pre|due {noteId, reminderId, title}`, `reminder:done|snoozed` thêm `reminderId`; bus mới `alarms:layout {ring}` (vị trí chuông).
- D. Phòng core (`stage.js`): nút Xong/Hoãn của nhắc note gọi `ctx.notes.completeNote(noteId, p.reminderId)` / `snoozeNote(noteId, 10, p.reminderId)`, tiêu đề dùng `p.title`; thông báo dự phòng dùng `ctx.alarms.toast({kind:'note', refId:noteId, extra:{r:reminderId}, title, body, buttons:[{id:'done',label:'Xong'},{id:'snooze',label:'Hoãn 10 phút',m:10}]})`; công bố `ctx.pet.occupiedRect()` + `pet:moved {rect}`; bé "ghi giúp" gọi `ctx.notes.quickCapture(text, {source:'pet'})` → nói `reply`.
- E. Phòng persona: `pick('alarm', {label, time})`, `pick('memo', {title})` dùng trong chuông/popup; `note_created` chỉ dùng khi ghi nhanh không có giờ.

**Đợt 1 (cũ):**
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

## Trạng thái Đợt 2
_Cập nhật 2026-10-15 (lượt 2 của phòng). Hợp đồng nội bộ: `docs/rooms/notes/API2.md`._

**Đã xong (6/6 việc)**
1. Hiểu note `src/shared/understand/` (`index.js` + `entities.js`, UMD, offline): nhiều việc/dòng ("họp 9h, 14h gọi khách, tối 8h đi tập" → 3 mục), ngày chung ("Mai:" áp cho cả dòng và các dòng sau), checklist + tiến độ, người/nơi/tiền/SĐT/link/email/#thẻ, ưu tiên 0–3, hạn mềm, gợi ý (remind, remind-all, alarm, checklist, split, call, message, link, email). `parse.js` hiểu không dấu + viết tắt (`ng mai`, `t2`, `cn`, `9g30`, "8 giờ kém 15"), thêm `fold`, `whenSpans`. Sửa cố ý: "12h đêm" = 00:00 hôm sau, "1h đêm" = 01:00.
2. Nhiều nhắc/note: `Note.reminders[]` (nguồn sự thật, ≤20), `Note.reminder` = primary (cùng tham chiếu, code cũ chạy nguyên), `Note.remindMuted`; migrate trong `normalizeNote`; scheduler xử lý từng mục, gõ thêm chữ không reset trạng thái/id.
3. API: `mochi.alarms.insight/applySuggestion/quickCapture`, `mochi.notes2.setReminderItem/removeReminderItem/doneItem/snoozeItem/onListTab`; main `ctx.notes.insight/applySuggestion/quickCapture` (trả `reply` "Tớ ghi rồi nha, 3 việc: 09:00 họp…"). `source:'pet'` + đang ẩn hết → không bật cửa sổ note.
4. Phối hợp bé: chuông/popup dặn dò đặt bằng `placement.js`, né `ctx.pet.occupiedRect()` và dời theo `pet:moved` (khi core có); popup né cả chuông; câu thoại `ctx.persona.pick('alarm'|'memo')` hiện trong chuông/popup. Bus `reminder:pre|due|done|snoozed` thêm `reminderId`, `title`; stage payload có `reminderId`, `title`.
5. Toast Windows có nút Tắt/Hoãn (`src/main/alarms/toast.js`, giao thức `mochi-notes://`) cho báo thức khi bé tắt; `ctx.alarms.toast(...)` cho note (core dùng — xem đề xuất).
6. Danh sách: nghe `list:tab`; ô "Ghi nhanh" có xem trước "Bé hiểu: …"; chip "+N", chi tiết từng nhắc (Xong/Hoãn), nút "Gợi ý".

**Test** (`npm test` chưa gồm các bộ mới — xem đề xuất): parse 198, entities 227, understand 245, scheduler 82, reminders 19, insight 56, transfer 52, alarm 12, memo 17, placement 19, toast 25 — xanh ở Asia/Ho_Chi_Minh và America/New_York:
```
for t in src/shared/__tests__/*.test.js src/shared/understand/__tests__/*.test.js src/main/notes/__tests__/*.test.js src/main/alarms/__tests__/*.test.js; do TZ=Asia/Ho_Chi_Minh node $t >/dev/null || echo FAIL $t; done
```
Chạy thử: `MOCHI_DEV_CAPTURE="họp 9h, 14h gọi khách|mua sữa" MOCHI_DEV_LIST=1` (ghi nhanh như bé lúc khởi động, in `[notes] dev capture …`).
**Ảnh nghiệm thu**: `docs/rooms/notes/d2-quick-capture-list.png` (3 câu ghi nhanh → nhắc "Họp 09:00", "Đón con 07:00 ngày mai"), `d2-ring-line-list.png` (chuông có câu thoại bé + ô Ghi nhanh, note 0.1 mở bình thường).

**Chưa kiểm được / việc tiếp theo cụ thể**
1. Windows thật: toast có nút (giao thức `mochi-notes://`), âm thanh, kéo-thả.
2. Mục "Sắp tới" trong danh sách đang hiện 1 nhắc/note (primary) — nên liệt kê từng nhắc.
3. Khi core có `occupiedRect`/`pet:moved`: chụp ảnh chuông né bé.
4. Gom các bộ test mới vào `npm test` (chờ điều hành).
5. Hiểu note còn thiếu: số bằng chữ ("chín giờ"), "ngày 20" đứng một mình, "9.30", "trong 5 phút", "mai mốt"; câu chỉ có ngày (không giờ) chưa thành mục — có thể thêm nhắc cả ngày.

**Vướng mắc**: không.

## Gửi phòng paper (yêu cầu giao diện cửa sổ note)
API đã có trong preload (khối notes), chi tiết `docs/rooms/notes/API2.md` mục 2–5:
- `await mochi.alarms.insight(noteId)` → `{items, checklist, suggestions:[{id, kind, label}], reminders, people, phones, links, priority, softDeadline, …}`. Dải gợi ý cuối note: hiện tối đa 2–3 `suggestions[].label`; bấm → `mochi.alarms.applySuggestion(noteId, id)` → `{ok, message}` (hiện `message` dạng toast). Gọi lại sau khi gõ (debounce ≥ 600ms) hoặc khi `onNoteUpdated`.
- Nhiều nhắc: `note.reminders[]` (`{id, due, done, fired, repeat?, title?}`); `note.reminder` vẫn là nhắc chính (chip cũ chạy nguyên). Panel nhắc nên liệt kê từng mục với Xong `mochi.notes2.doneItem(id, rid)`, Hoãn `snoozeItem(id, rid, phút)`, Sửa `setReminderItem(id, rid|null, {due, lead, repeat, title})`, Xoá `removeReminderItem(id, rid)`.
- Gợi ý `checklist` ghi ra text dạng `- [ ] …` (mỗi dòng một `<div>`) để chế độ checklist của paper nhận. Note có ảnh → `checklist`/`split` trả `ok:false` (không làm mất ảnh).
- Không cần nạp `understand` trong renderer; nếu muốn xem trước không qua IPC: `<script>` theo thứ tự `shared/parse.js`, `shared/recur.js`, `shared/understand/entities.js`, `shared/understand/index.js` → `window.MochiUnderstand.understand(text)`.

## ĐỢT 2B — chủ dự án bổ sung
1. **Thùng rác note** (xoá mềm): `ctx.notes.trash(id)`, `ctx.notes.restore(id)`, tự xoá hẳn sau 30 ngày; tab/khu "Thùng rác" trong danh sách. Xoá thường cũng vào thùng rác.
2. **Note hết hạn**: `ctx.notes.expiredCandidates()` → note đang dán mà (a) mọi nhắc đã Xong, hoặc (b) quá hạn > 24 giờ chưa xong, hoặc (c) checklist đã tick hết. Phát `note:expired {noteId, reason}` (tối đa 1 lần/note/ngày) để bé tới hỏi dọn.

### Trạng thái Đợt 2B
_Cập nhật 2026-10-15 (lượt 3). Đợt 2 đã xong từ lượt 2 (xem "Trạng thái Đợt 2"); lượt này gộp main và làm 2B._
**Đã xong**
1. Thùng rác: `ctx.notes.trash/restore/purge/emptyTrash/trashList/isTrashed`; ngăn dữ liệu `trash` `{items:[{note, trashedAt}]}` (≤500), tự xoá hẳn sau 30 ngày (lúc khởi động + mỗi 6 giờ). `deleteNote` (kênh `note:delete`) giờ là xoá mềm; xoá hẳn: `deleteNotePermanently`. Bus: `note:deleted {id}` rồi `note:trashed {noteId}`; khôi phục: `note:created` rồi `note:restored`. Cỡ chữ/khoá/lặp (`noteMeta`) giữ lại khi vào thùng. Danh sách: chip "Thùng rác (N)" (Khôi phục / Xoá hẳn / Dọn sạch, xác nhận 2 bước), xoá note có toast "Hoàn tác".
2. Note hết hạn: `ctx.notes.expiredCandidates()` → `[{noteId, reason, title}]` (`overdue` > 24h chưa xong ưu tiên > `done` mọi nhắc xong (không lặp) > `checklist` tick hết; bỏ qua note sửa trong 10 phút). Phát `note:expired {noteId, reason}` 60s sau khởi động rồi mỗi 5 phút, tối đa 1 lần/note/ngày (`noteMeta[id].expiredDay`). Không bao giờ tự xoá.
3. Preload `mochi.notes2.trashList/trashRestore/trashPurge/trashEmpty/onTrashChanged/expired`.
**Test**: thêm `trash.test.js` (24), `expiry.test.js` (31) — mọi bộ của phòng xanh ở 2 múi giờ. Chạy thử: `MOCHI_DEV_TRASH=1 MOCHI_DEV_LIST=1 MOCHI_DEV_TAB=trash`. Ảnh: `docs/rooms/notes/d2b-trash.png`.
**Việc tiếp theo**: core nghe `note:expired` → hỏi dọn → `ctx.notes.trash(noteId)`; thêm cài đặt "tự dọn note đã xong" (mặc định tắt) khi core làm luồng dọn; ảnh nghiệm thu bé dọn note (cần core).
**Đề xuất cho điều hành (2B)**: `scripts/test-all.js` thêm `src/main/notes/__tests__/trash.test.js`, `expiry.test.js` (cùng danh sách mục A ở trên); `01-data.md` ghi ngăn `trash` (chủ: notes) và `noteMeta[id].expiredDay`.
**Gửi phòng paper (2B)**: nút xoá trong cửa sổ note gọi `mochi.deleteNote(id)` như cũ — nay là chuyển vào thùng rác, nên đổi chữ xác nhận thành "Chuyển vào thùng rác?" (khôi phục được 30 ngày trong danh sách).


---
## Trạng thái lượt 4 — sửa lỗi QA (Đợt 1/2/2B đã xong từ trước)
_Cập nhật 2026-10-15. Nhánh `room/notes` = main + 4 commit sửa lỗi._

**Đã xong** (theo `docs/rooms/qa/BUGS.md`)
- Hiểu giờ (`parse.js`, `understand/`): BUG-002 (phân số 3/4, 1/2 không thành ngày), 003 ("thứ 6 tuần sau 10h30" ở understand), 004 (+"nửa đêm" = 00:00 hôm sau), 005 ("1h30 nữa" = +1:30), 009 ("nửa tiếng nữa", "trong 5 phút", "5 phút sau"), 011 ("tối ưu", "sáng tạo", "chiều dài"), ngày vô lý 30/2, 13/13, 32/1 bị bỏ. Mới: số bằng chữ ("chín giờ", "hai giờ chiều", "mười giờ rưỡi"), "9.30"/"9.30 sáng" (không nhận "1.5kg", "giá 9.30", "v3.10"), "mai mốt" = hạn mềm (+3 ngày, không giờ), "ngày 20" một mình = 09:00 ngày 20 (đã qua → tháng sau). API thêm `P.normNum`.
- Main notes: BUG-012 (giờ đã qua trong hôm nay → vẫn lưu nhắc `past:true, fired:true`, không kêu, không nhắc dai; `quickCapture.reply` nói "đã qua rồi"), BUG-025 (`clampLead`: còn ít hơn mức báo trước → lead 0), BUG-020 (hiện tất cả theo lô 2 cửa sổ/40ms, huỷ được — `ctx.notes.cancelOpenAll`), BUG-024 (vòng nhắc ngủ tới mốc kế `S.nextWake`, trần 15s, dậy ngay khi có thay đổi note/settings, `resume`, `unlock-screen`; bé bận → nhịp 1s như cũ; rảnh đo 0 tick CPU/10s), BUG-031 (normalizeNote/normalizeReminder giữ trường lạ), BUG-028 (note mẫu xưng tớ/cậu).
- Báo thức/dặn dò: BUG-013/015 — `placement.petRectFor`: `occupiedRect()` → bounds `ctx.windows.pet` khi hiện → vùng 300×400 góc dưới phải; chuông/popup đặt né (thường lên trên bé). Bé đang hiện → chuông/popup không lặp câu thoại. BUG-029: nút popup trước khi thoát "Chưa thoát" / "Thoát luôn".
- Danh sách: "Sắp tới" liệt kê từng nhắc (≤8 + "+N"), ↻ cho nhắc lặp; BUG-027 "Đang hiện / Đã cất", nút "Cất đi / Hiện lên" + tooltip; bảng phím tắt đủ Ctrl+F/F3, Z/Y, Shift+K, +/−/0, Shift+R; xưng tớ/cậu. Dev: `MOCHI_DEV_TAB=shortcuts`.
- Kiểm tay: ghi nhanh "gọi khách 1 phút nữa" kêu đúng phút với vòng nhắc mới (bé + thông báo).

**Test**: thêm `parse2.test.js` (108), `understand2.test.js` (33), `fixes.test.js` (14), placement +7. Mọi bộ của phòng xanh ở Asia/Ho_Chi_Minh và America/New_York (lệnh ở "Trạng thái Đợt 2"). `npm test` xanh. `node test/unit/run.js`: parse xanh hết; còn đỏ 5 ca store (xem đề xuất F).
**Ảnh**: `docs/rooms/notes/d3-upcoming.png`, `d3-shortcuts.png`, `d3-ring-avoid-pet.png`, `d3-memo-avoid-pet.png`.

**Việc tiếp theo cụ thể**
1. "đêm" đứng một mình vẫn = 22:00 → "đi 3 ngày 2 đêm" ra nhắc rác; nên chỉ nhận "đêm" khi có số giờ hoặc "tối/đêm nay".
2. Khi core có `occupiedRect` chỉ gồm thân + bong bóng: chụp lại ảnh né bé (hiện né cả cửa sổ 300×397 nên hơi rộng; chuông có thể đè note ở góc trên).
3. Windows thật: toast có nút, âm thanh, kéo-thả, before-quit.

**Vướng mắc**: không.

**Đề xuất cho phòng điều hành (lượt 4)**
- F. Test qa `test/unit/store.test.js`: ca 160, 163 so object theo hình Đợt 1 — cần thêm `reminders[]`, `remindMuted[]`, `reminder.id` (hợp đồng Đợt 2). Ca 165/166 đòi `.bak` nhưng store giờ giữ `mochi-data.corrupt-*.json` → sửa test. Ca 168 (khoá lạ settings bị bỏ) mâu thuẫn BUG-031 (giữ khoá lạ) → điều hành chốt một hướng.
- G. Phòng core: thêm `ctx.pet.occupiedRect()` (thân + bong bóng) và `pet:moved`; BUG-014 (tờ "Dặn dò" bé cầm hiện "NaN:NaN") vẫn còn; nếu `pet.pump` cần nhịp riêng thì core tự giữ timer (vòng nhắc notes chỉ tick 1s khi `pet.isBusy()`).
- H. Phòng paper: chip nhắc đọc `reminder.past` → hiện "15:00 hôm nay · đã qua"; `src/note/insight.js:73` "bé nhắc nha?" → "tớ nhắc nha?"; bảng phím tắt ghi Ctrl+D = "Xoá note" nhưng note.js mở menu — kiểm lại.

---
## Trạng thái Đợt 3 (lượt 5 — theo lệnh điều hành Đợt 3)
_Cập nhật 2026-10-15. Bao gồm cả lượt 4 ở trên. Nhánh `room/notes` = main @70ebdd3 + 8 commit._

**Lỗi QA phòng notes — đề nghị qa chạy lại và đóng**
| Mã | Kết quả | Ghi chú |
|---|---|---|
| BUG-002 | ĐÃ SỬA | 500g, 3/4, 1/2, 50-60k, 2-3 lần, ngày vô lý 30/2, 13/13, 32/1 → không nhắc |
| BUG-003 | ĐÃ SỬA | "thứ 6 tuần sau 10h30" = 23/10 10:30 (cả parse và understand) |
| BUG-004 | ĐÃ SỬA | 0h, 12h đêm, nửa đêm = 00:00 hôm sau; 2h đêm = 02:00 (understand "0h" sửa lượt này) |
| BUG-005 | ĐÃ SỬA | "1h30 nữa" = +1:30 |
| BUG-006 | ĐÃ SỬA (2B) | Thùng rác 30 ngày, `trash.test.js` |
| BUG-009 | ĐÃ SỬA | nửa tiếng nữa, 1 tiếng rưỡi nữa, sau/trong 5 phút |
| BUG-010 | ĐÃ SỬA | không dấu: hop 3h chieu nay, goi khach 2 phut nua, thu 6 10h30, 8 gio toi |
| BUG-011 | ĐÃ SỬA | tối ưu, sáng tạo, chiều dài, năm nay, 16:9; thêm: "đêm" lẻ (3 ngày 2 đêm, ca đêm, thức đêm) |
| BUG-012 | ĐÃ SỬA | giờ đã qua hôm nay → nhắc `past:true` (không kêu), reply báo "đã qua" |
| BUG-013, 015 | ĐÃ SỬA (phần notes) | chuông/popup né `occupiedRect()` (tương thích room/core: `{rect}` của `pet:moved`) → bounds cửa sổ bé → vùng mặc định; không lặp câu bé đang nói |
| BUG-020 | ĐÃ SỬA | hiện tất cả theo lô 2/40ms, không chặn main |
| BUG-024 | ĐÃ SỬA (phần notes) | vòng nhắc ngủ tới mốc kế, trần 15s |
| BUG-025 | ĐÃ SỬA | `clampLead` |
| BUG-027 | ĐÃ SỬA | "Đang hiện / Đã cất", "Cất đi / Hiện lên" + tooltip |
| BUG-028 | ĐÃ SỬA | Giao diện danh sách gọi "bạn"/"bé Mochi"; chỉ lời bé (note mẫu, `reply`, chuông/popup) xưng "tớ/cậu" |
| BUG-029 | ĐÃ SỬA (phần notes) | bảng phím tắt đủ; nút popup "Chưa thoát / Thoát luôn" |
| BUG-030 (tiêu đề) | ĐÃ SỬA | cửa sổ note "Mochi Notes" |
| BUG-031 | ĐÃ SỬA (note/reminder) | giữ trường lạ |

**Việc thêm Đợt 3**
- Danh sách: nền xem trước + dải màu theo mẫu giấy (`api.paper.get(id).meta.paper`, catalog `assets/paper/catalog.js`, cache 10s; mẫu `plain-*` như cũ); tiêu đề = dòng đầu, đoạn trích các dòng sau nối " · " (đọc từ html). Ảnh `d3-list-paper.png`.
- Nhập/xuất giữ `data-ck="0|1"` trên DIV/LI.
- Cửa sổ note trong suốt: khoá settings `noteTransparent` (mặc định tắt), công tắc trong Cài đặt; bật/tắt thì mở lại các note đang mở. Renderer nhận `?transparent=1` (API2.md mục "Cửa sổ trong suốt"). Chưa thử kéo/đổi cỡ trên Windows — để mặc định TẮT. Ảnh `d3-transparent.png` (xvfb không compositor nên nền đen).
- Hiệu năng understand 5.000 ký tự ~16ms (gốc 17ms).

**Test**: `npm test` xanh (chạy 3 lần). Mọi bộ của phòng xanh ở 2 múi giờ. `node test/unit/run.js`: mọi ca parse/entities xanh; còn đỏ 5 ca store (đề xuất F).

**Việc tiếp theo**: "khuya" lẻ ("thức khuya") vẫn = 23:00; thử cửa sổ trong suốt trên Windows; khi room/core gộp, chụp lại ảnh né bé bằng `occupiedRect` thật; danh sách nghe `paper:meta` để cập nhật mẫu ngay (hiện cache 10s).
**Vướng mắc**: không.

**Đề xuất cho phòng điều hành (Đợt 3)**
- I. `scripts/test-all.js` thêm `node test/unit/run.js` (test:unit) vào `npm test` sau khi qa cập nhật 5 ca store theo đề xuất F (parse đã xanh hết).
- J. `store.js` `DEFAULT_SETTINGS` + `01-data.md`: thêm `noteTransparent: false` (hiện `ipcNotes.applySettings` tự nhận khoá này).
- K. Gửi phòng paper: khi `new URLSearchParams(location.search).get('transparent') === '1'` thì `html, body` nền transparent, tự vẽ nền giấy + bóng CSS trong khung có lề; "bé nhắc nha?" ở `src/note/insight.js` giữ được (giao diện gọi "bé"); chip đọc `reminder.past`.
