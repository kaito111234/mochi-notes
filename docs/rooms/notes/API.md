# Hợp đồng nội bộ phòng notes (Đợt 1)

Hợp đồng chung: `docs/spec/01-data.md`, `02-events.md`. Tài liệu này chốt chi tiết **bên trong phòng** để các nhân viên làm song song.

## Dữ liệu
- Ngăn `alarms` lấy qua `require('<...>/src/main/alarms/box.js').getBox(ctx)` — KHÔNG gọi `ctx.store.section('alarms', …)` trực tiếp. Hình dạng: xem `defaults()` trong `box.js` (`list, memos, missed, sounds, noteMeta, settings`). Sửa trực tiếp rồi `ctx.store.save()`.
- Alarm mở rộng thêm (ngoài 01-data.md): `createdAt`, `snoozedUntil?` (epoch ms — khi đang hoãn thì `nextAt === snoozedUntil`).
- Repeat mở rộng: `freq` có thêm `'hourly'` (chỉ dùng cho nhắc note, "mỗi 2 tiếng"); `anchor?: number` (epoch ms gốc để tính `interval` > 1).
- **Vì `store.js` (điều hành) bỏ khoá lạ trong note** khi nạp, `note.reminder.repeat` được **nhân bản** vào `box.noteMeta[noteId].repeat` và khôi phục lúc khởi động (`noteRepeat.js`). Cỡ chữ/khoá note cũng nằm ở `box.noteMeta`.

## `src/shared/recur.js` (thuần JS, UMD như `parse.js`: `module.exports` + `window.MochiRecur`)
Mọi thời gian là **giờ địa phương** (dùng `new Date(y, m, d, h, mi)`, không cộng 86400000 để sang ngày).
```js
parseRecur(text)                 // -> { repeat: Repeat, time: 'HH:MM' | null } | null   (hiểu tiếng Việt)
nextOccurrence(rule, afterMs)    // rule = { repeat: Repeat|null, time: 'HH:MM', date?: 'YYYY-MM-DD' }
                                 // -> epoch ms > afterMs (lần kế tiếp) hoặc null (một lần đã qua / rule hỏng)
                                 // hourly: lần kế = anchor + k*interval giờ (anchor bắt buộc với hourly)
alarmNextAt(alarm, now)          // alarm.enabled=false -> null; dùng alarm.repeat/time/date; > now
catchUp(nextAt, now, graceMs)    // -> 'wait' (nextAt > now) | 'ring' (trễ ≤ graceMs) | 'missed'
describeRepeat(repeat)           // -> 'Một lần' | 'Hằng ngày' | 'Ngày thường (T2–T6)' | 'Thứ 2, 4, 6' | 'Ngày 5 hằng tháng' | 'Mỗi 2 tiếng' ...
dayKey(ms)                       // -> 'YYYY-MM-DD' giờ địa phương
WEEKDAY_SHORT                    // ['CN','T2','T3','T4','T5','T6','T7']
```
Quy ước: `weekdays` = T2–T6. `monthly` với `byMonthDay` lớn hơn số ngày tháng đó → **dời về ngày cuối tháng** (31 → 28/29 tháng 2). `weekly` không có `byDay` → dùng thứ của `anchor` (hoặc của ngày đầu). `interval>1` tính từ `anchor`.

## Kênh IPC (khối preload phòng notes đã viết sẵn trong `src/main/preload.js` — chỉ đọc)
| Kênh | Ai đăng ký (main) |
|---|---|
| `alarm:list/create/update/delete/toggle/test/stop/snooze/pickSound/soundData/clearMissed/settings`, gửi `alarm:changed`, `alarm:ring`, `alarm:ringEnd`, nhận `alarm:ringReady` | `src/main/alarms/alarmService.js` |
| `alarm:devHint` | `src/main/alarms/index.js` |
| `memo:list/create/update/delete/test/ack/quitNow`, gửi `memo:changed`, `memo:show`, nhận `memo:popupReady` | `src/main/alarms/memoService.js` |
| `notes2:setRepeat` | `src/main/notes/noteRepeat.js` |
| `notes2:getMeta/setView`, gửi `notes2:meta` | `src/main/notes/noteView.js` |
| `notes2:export/exportNote/import/backups/readBackup/restore` | `src/main/notes/dataTransfer.js` |

`RingInfo` gửi tới cửa sổ chuông: `{alarmId, label, time:'HH:MM', sound, soundFile?, snoozeMin, volume, noteId?, noteTitle?, test?:boolean, ringMaxMin}`.

## Cửa sổ/renderer
- `src/alarms/ring.{html,js,css}` — cửa sổ chuông (alarmService tạo). `src/alarms/memo.{html,js,css}` — popup dặn dò (memoService tạo).
- `src/list/*` — thêm tab "Báo thức", "Dặn dò" và mục "Dữ liệu" (nhập/xuất/khôi phục) trong cài đặt.
- `src/note/*` — tìm kiếm, undo/redo, ảnh, cỡ chữ, khoá, chọn lặp.
- Renderer nạp `../shared/recur.js` bằng `<script src>` nếu cần (`window.MochiRecur`).
- CSP giữ như cũ; cửa sổ chuông cho phép thêm `media-src blob: data:`.

## Sân khấu bé
Khi `ctx.pet.stage` có (phòng core): `ctx.pet.stage.request({kind:'alarm', priority:100, payload})` / `{kind:'memo', priority:60}`. Khi chưa có: gọi `ctx.pet.enqueue({type:'alarm'|'memo', ...})` (0.1 sẽ bỏ qua an toàn) — **cửa sổ chuông/popup của phòng luôn hiện**, nên nhắc không phụ thuộc bé. Nếu `ctx.settings().mascotEnabled === false` thì thêm thông báo Windows.
