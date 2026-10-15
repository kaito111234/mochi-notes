# Hợp đồng nội bộ phòng notes — Đợt 2 (hiểu note, nhiều nhắc, ghi nhanh, toast)

Bổ sung cho `API.md` (Đợt 1, vẫn hiệu lực). Mọi nhân viên làm theo đúng tên hàm/khóa dưới đây để ghép được với nhau.

## 1. `src/shared/parse.js` (nâng cấp, GIỮ NGUYÊN API cũ)
Hàm cũ giữ chữ ký và hành vi với câu có dấu: `parseWhen, analyze, intentOf, intentLabel, leadFor, whenLabel, dur, leadLabel, hm, MIN, HOUR, DAY`.
Thêm:
```js
fold(s)            // -> chữ thường, bỏ dấu tiếng Việt (đ->d), gộp khoảng trắng. Dùng để so khớp không dấu.
parseWhen(text, nowDate)   // hiểu thêm: không dấu ("hop 9h sang mai"), viết tắt "ng mai"/"ngmai"/"mai" , "t2".."t7", "cn",
                           // "9g", "9g30", "9h30", "9:30", "21h", "14h gọi", "sáng mai", "trưa nay", "chiều t6", "tối cn", "8h tối"
whenSpans(text)    // -> [[start,end], ...] vị trí (theo chỉ số trong CHUỖI GỐC) các cụm chỉ thời gian đã nhận ra,
                   //    để bên gọi bỏ khỏi tiêu đề: "họp 9h sáng mai" -> span của "9h sáng mai"
```

## 2. `src/shared/understand/` (thuần JS, UMD: `module.exports` + `window.MochiUnderstand`; không phụ thuộc Electron)
Trình duyệt nạp theo thứ tự: `parse.js`, `recur.js`, `understand/entities.js`, `understand/index.js`. Trong Node dùng `require`.
### `entities.js` → `module.exports` / `window.MochiEntities`
```js
extractEntities(text, now) -> {
  people:  [{name, raw, line}],          // "anh Nam", "chị Lan", "@minh", "cô Hoa", "chú Ba", "em Tú", "bạn Hùng", "sếp", "mẹ"...
  places:  [{name, raw, line}],          // "ở quán Cộng", "tại phòng 302", "ở nhà", "tại công ty"
  money:   [{amount, raw, line}],        // amount: số đồng (VND): "500k"->500000, "1tr2"->1200000, "2.000.000đ", "50 nghìn", "1,5 triệu", "3 củ"
  phones:  [{number, display, raw, line}],// number: chỉ chữ số (+84->0), display: "0901 234 567"
  links:   [{url, raw, line}],           // http(s)://..., www..., domain.vn/abc
  emails:  [{email, line}],
  tags:    [{tag, line}],                // "#việc", "#nha" (không lấy #1, #fff)
  priority: 0|1|2|3,                     // 0 thường; 1 "quan trọng"/"!"; 2 "gấp"/"!!"/"ưu tiên"; 3 "rất gấp"/"khẩn"/"!!!"/"ASAP"/"urgent"
  priorityWords: string[],
  softDeadline: {label, due, raw} | null // "trong tuần"->cuối CN tuần này 23:59, "trước thứ 6"->T5 23:59, "cuối tháng", "cuối tuần",
                                         // "tuần sau", "trong hôm nay"/"trong ngày" ; due = epoch ms
}
lineEntities(line, lineIndex, now) -> cùng dạng nhưng cho 1 dòng (index dùng gom).
```
`line` = chỉ số dòng (0-based) trong `text.split(/\r?\n/)`. Mọi hàm hiểu cả không dấu.

### `index.js` → `module.exports` / `window.MochiUnderstand`
```js
understand(text, now = Date.now()) -> Insight
itemKey(title) -> string                // 'k:' + fold(title) bỏ ký tự lạ, tối đa 48 ký tự
```
```ts
interface Insight {
  version: 1;
  title: string;                 // dòng đầu không rỗng, bỏ ký hiệu checklist, tối đa 80
  items: Item[];                 // MỌI ý có thời gian (mỗi dòng, hoặc mỗi mệnh đề nếu một dòng có nhiều giờ)
  checklist: { items: {line, text, done}[], done: number, total: number } | null; // dòng "-", "*", "•", "+", "[ ]", "[x]", "1.", "1)", "☐", "☑", "✓"
  people, places, money, phones, links, emails, tags, priority, priorityWords, softDeadline; // từ entities
  suggestions: Suggestion[];
}
interface Item {
  key: string;          // itemKey(title); trùng thì thêm '#2', '#3'
  line: number;         // chỉ số dòng
  raw: string;          // mệnh đề gốc
  title: string;        // mệnh đề bỏ cụm thời gian/ký hiệu đầu dòng, viết hoa chữ đầu ("Họp", "Gọi khách", "Đi tập")
  due: number | null;   // epoch ms lần tới (đã áp repeat nếu có)
  timed: boolean;       // có giờ rõ ràng
  time: string | null;  // 'HH:MM'
  repeat: Repeat | null;// từ recur.parseRecur (01-data.md + 'hourly', anchor)
  intent: string; lead: number; // như parse.analyze
  priority: 0|1|2|3;
}
interface Suggestion {
  id: string;           // ỔN ĐỊNH qua các lần gọi: 'remind:<key>', 'remind-all', 'alarm:<key>', 'checklist', 'split',
                        // 'call:<digits>', 'message:<digits>', 'link:<url>', 'email:<addr>'
  kind: 'remind' | 'remind-all' | 'alarm' | 'checklist' | 'split' | 'call' | 'message' | 'link' | 'email';
  label: string;        // tiếng Việt ngắn: "Nhắc 'Gọi khách' lúc 14:00", "Tạo nhắc cho 3 việc", "Đặt báo thức 6:00",
                        // "Chuyển thành checklist", "Tách thành 3 note", "Gọi 0901 234 567", "Nhắn 0901 234 567", "Mở link", "Gửi email"
  itemKey?: string;  data?: any;
}
```
Quy tắc ngày dùng chung: dòng/đoạn đầu chỉ có ngày ("Mai:", "Thứ 6", "T7 này") áp cho các mục bên dưới/không có ngày riêng. Câu không có giờ → không thành Item (trừ "mỗi ..."/lặp có giờ).
Gợi ý: `remind:<key>` cho mỗi item có `due > now`; `remind-all` khi ≥ 2 item; `alarm:<key>` cho item có giờ và intent dậy/thức/báo thức ("dậy 6h", "báo thức 5h30"); `checklist` khi ≥ 2 dòng nội dung mà chưa phải checklist và không có giờ trên đa số dòng (danh sách mua đồ); `split` khi ≥ 2 item ở các dòng khác nhau; `call`/`message` cho mỗi số điện thoại; `link`, `email`.

## 3. Nhiều nhắc trong một note
```ts
interface Reminder {          // mở rộng Reminder 0.1
  id: string;                 // 'r' + base36 ngẫu nhiên/đếm, duy nhất trong note
  due: number; lead: number; intent: string; auto: boolean; preFired: boolean; fired: boolean; done: boolean;
  repeat?: Repeat;            // như Đợt 1
  title?: string;             // tiêu đề mục (Item.title); không có = dùng tiêu đề note
  key?: string;               // Item.key khi sinh từ chữ (auto) hoặc từ gợi ý
  line?: number;
}
Note.reminders: Reminder[]    // NGUỒN SỰ THẬT, tối đa 20, sắp theo due tăng dần
Note.reminder: Reminder|null  // = primary(note): CHÍNH object trong reminders (cùng tham chiếu trong bộ nhớ) — giữ cho code cũ
Note.remindMuted: string[]    // key các nhắc tự động người dùng đã xoá (không tự tạo lại), tối đa 50
```
`primary(note)`: nhắc đã kêu (fired) chưa xong có due sớm nhất → nếu không: chưa xong có due sớm nhất → nếu không: phần tử có due lớn nhất → null nếu rỗng.
Migrate (`normalizeNote`): có `reminders` hợp lệ → dùng; không có mà có `reminder` → `reminders=[{...reminder, id:'r1'}]`. Luôn đặt `reminder = primary`. File ghi ra có cả hai (trùng lặp chấp nhận được, bản 0.1 đọc vẫn hiểu `reminder`).

### `src/main/notes/reminders.js` (thuần): `normItem(r)`, `ensureIds(list)`, `pickPrimary(list)`, `sortList(list)`, `newId(list)`, `MAX = 20`.
### `src/main/notes/scheduler.js` (thuần) — API mới, tham số `reminderId` tuỳ chọn (mặc định = primary):
```js
ensureReminders(note)                       // migrate trong bộ nhớ + syncPrimary; idempotent
syncPrimary(note)                           // sort + note.reminder = pickPrimary
applyText(note, now)                        // sinh lại nhắc AUTO từ understand(note.text).items (bỏ key trong remindMuted);
                                            // giữ nguyên trạng thái (fired/done/preFired) của nhắc auto cùng key & cùng due (hoặc cùng lịch lặp);
                                            // nhắc tay (auto=false) giữ nguyên. Một note chỉ có 1 ý giờ -> hành vi như 0.1.
setReminder(note, r, now)                   // API cũ: r null = xoá primary (auto -> thêm key vào remindMuted); r -> sửa primary (hoặc tạo nếu chưa có), auto=false
upsertReminder(note, reminderId|null, r, now) // r: {due, lead?, repeat?, title?, key?, auto?}; id null -> thêm mới (bỏ key khỏi remindMuted). Trả Reminder
removeReminder(note, reminderId)            // auto -> mute key. Trả boolean
snooze(note, minutes, now, reminderId?)  markDone(note, reminderId?)  rollRepeat(note, now, reminderId?)  setRepeat(note, repeat, now, reminderId?)
overdueNotes(notes, now)                    // note có BẤT KỲ nhắc fired && !done quá NAG_AFTER
tick(notes, now, state)                     // events: {type:'pre'|'due', noteId, reminderId, title} | {type:'nag', noteId, overdueCount}
```
Bus: `reminder:pre|due {noteId, reminderId, title}`, `reminder:done {noteId, onTime, reminderId}`, `reminder:snoozed {noteId, minutes, reminderId}` (thêm khoá, khoá cũ giữ).
`ctx.pet.stage.request({kind:'due'|'pre', payload:{noteId, reminderId, title}})`.

## 4. Main: `ctx.notes` (noteService / insightService)
```js
ctx.notes.completeNote(id, reminderId?)   ctx.notes.snoozeNote(id, minutes, reminderId?)   // reminderId tuỳ chọn, tương thích cũ
ctx.notes.setReminderItem(id, reminderId|null, r) -> Note   ctx.notes.removeReminderItem(id, reminderId) -> Note
ctx.notes.insight(noteIdOrText) -> InsightView | null
ctx.notes.applySuggestion(noteId, suggestionId) -> {ok, note?, message, alarm?, notes?, copied?}
ctx.notes.quickCapture(text, {source}) -> {note, insight, reply}   // tạo note (không mở cửa sổ nếu source==='pet' và allHidden), reply = câu đọc lại
```
`InsightView` = Insight + `{ noteId?, reminders: Reminder[] (của note), suggestions đã lọc }` — bỏ `remind:<key>` đã có nhắc cùng key, bỏ `remind-all` khi mọi item đã có nhắc.
`reply` (tiếng Việt, xưng "tớ" gọi "cậu", ≤ 120 ký tự): 0 giờ → "Tớ ghi rồi nha: <tiêu đề>"; 1 nhắc → "Tớ ghi rồi nha. 15:00 tớ nhắc cậu <title thường>"; nhiều → "Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách…". Có `ctx.persona.pick('note_created', {title,time,count})` thì dùng nếu trả câu.
applySuggestion: remind → upsert nhắc theo item (auto=true, key); remind-all; alarm → `ctx.alarms.create({label, time, date|repeat, noteId})`; checklist → đổi các dòng thành `- [ ] ...` (html `<div>- [ ] …</div>`); split → tạo note mới cho mục 2..n (cùng màu, cạnh note gốc), xoá các dòng đó khỏi note gốc; call/message → chép số vào clipboard (`copied`); link → `shell.openExternal` chỉ http/https; email → `mailto:`.

## 5. IPC & preload (khối notes)
| preload | kênh |
|---|---|
| `mochi.alarms.insight(noteIdOrText)` | `notes2:insight` |
| `mochi.alarms.applySuggestion(noteId, suggestionId)` | `notes2:applySuggestion` |
| `mochi.alarms.quickCapture(text)` | `notes2:quickCapture` |
| `mochi.notes2.setReminderItem(noteId, reminderId, r)` / `removeReminderItem(noteId, reminderId)` | `notes2:setReminderItem` / `notes2:removeReminderItem` |
| `mochi.notes2.doneItem(noteId, reminderId)` / `snoozeItem(noteId, reminderId, minutes)` | `notes2:doneItem` / `notes2:snoozeItem` |
| `mochi.notes2.onListTab(cb)` | nghe `list:tab` (điều hành gửi) |

## 6. Toast Windows có nút (`src/main/alarms/toast.js`)
```js
buildToastXml({title, body, buttons:[{id,label}], kind, refId, extra?}) -> string   // thuần, có test; escape XML
toastUrl(kind, action, refId, extra?) -> 'mochi-notes://<kind>/<action>?id=<refId>&r=<reminderId>&m=<minutes>'
parseToastUrl(url) -> {kind:'alarm'|'note'|'memo', action:'stop'|'snooze'|'done'|'open', id, r?, m?} | null
show({kind, refId, title, body, buttons, extra}) // win32 + Notification.isSupported: toastXml; nơi khác: Notification thường, click = open
handleUrl(url)                                   // gọi ctx.alarms.stop/snooze, ctx.notes.completeNote/snoozeNote/showNote
```
`ctx.alarms.toast = show`. Đăng ký `app.setAsDefaultProtocolClient('mochi-notes')` (dev: kèm execPath + đường dẫn app), nghe `app.on('second-instance', (_e, argv) => …)` tìm đối số bắt đầu bằng `mochi-notes://`.

## 7. Né bé
`src/main/alarms/placement.js` (thuần, có test): `placeAvoiding(workArea, size, avoidRect|null, margin=12) -> {x,y}` — ưu tiên góc dưới phải; nếu giao với vùng bé thì thử dịch lên trên vùng bé, rồi sang trái vùng bé, rồi góc dưới trái, rồi góc trên phải. Cửa sổ chuông/popup dặn dò đọc `ctx.pet.occupiedRect?.()` khi mở và nghe `pet:moved {rect}` để dời (throttle 300ms, chỉ dời khi giao nhau).

## Cửa sổ trong suốt (noteTransparent)
- Khoá settings người dùng `noteTransparent` (boolean, mặc định false/thiếu; store giữ khoá lạ). Bật = `true` trong `settings` của mochi-data.json (hoặc `settings:set` nếu giao diện có).
- Khi bật, **cửa sổ note mở sau đó** dùng `transparent: true, backgroundColor: '#00000000', hasShadow: false` (bỏ acrylic). Không dựng lại cửa sổ đang mở.
- Báo renderer: URL note.html có thêm `?id=<id>&transparent=1`. Đọc: `new URLSearchParams(location.search).get('transparent') === '1'` (không cần preload). Tắt thì URL chỉ có `?id=`.
- Renderer nên: để `html, body` nền `transparent` khi cờ bật, tự vẽ bóng/nền giấy và mép trong chính khung giấy (cửa sổ không còn bóng hệ thống).
- Windows: cửa sổ transparent + frameless + resizable có thể mất tay nắm đổi cỡ ngoài mép ở một số máy; vùng trong suốt vẫn bắt chuột (trừ khi renderer dùng pointer-events) — nên chừa lề nhỏ cho shadow CSS và kiểm tra thực tế.
