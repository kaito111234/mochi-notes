# Hợp đồng 02 — Sự kiện (bus) & quyền nói của bé

`const bus = require('../bus.js')` trong main. `bus.emit(name, payload)`; `bus.on(name, fn)`. Payload là object thuần (JSON được). Không ai gọi thẳng hàm nội bộ của phòng khác — chỉ qua bus hoặc `ctx.<namespace>` đã công bố dưới đây.

## Sự kiện đã có (0.1)
`note:created {note}`, `note:updated {note}`, `note:deleted {id}`, `reminder:pre {noteId}`, `reminder:due {noteId}`, `reminder:done {noteId, onTime}`, `reminder:snoozed {noteId, minutes}`, `settings:changed {settings}`.

## Sự kiện mới
| Tên | Phát bởi | Payload |
|---|---|---|
| `alarm:ring` | notes | `{alarmId, label, noteId?}` |
| `alarm:stopped` / `alarm:snoozed` | notes | `{alarmId, minutes?}` |
| `memo:due` | notes | `{memoId, text, when}` |
| `pet:interact` | core | `{kind: 'click'\|'pat-head'\|'pat-body'\|'lift'\|'drop'\|'feed', itemId?}` |
| `pet:posture` | core | `{posture: 'idle'\|'walk'\|'sit'\|'sleep'\|'lifted'\|'peek'\|'work'}` |
| `pet:idleTick` | core | `{quietMs}` — mỗi 15s khi bé rảnh, `quietMs` = thời gian chưa ai tương tác |
| `game:mode` | game | `{mode: 'happy'\|'normal'\|'tired'\|'sad'}` |
| `game:reward` | game | `{candy, exp, affection, reason}` |
| `game:levelup` | game | `{level}` |
| `persona:line` | persona | `{text, face?, anim?, priority, ttlMs?}` — yêu cầu bé nói |
| `app:startup` / `app:idle` / `app:resume` | điều hành | `{}` — khởi động, máy rảnh, thức dậy sau sleep |

## Đạo diễn sân khấu (core sở hữu): `ctx.pet.stage`
Mọi thứ khiến bé "lên sân khấu" (hiện ra, giơ note, nói) đi qua MỘT hàng đợi ưu tiên trong `src/main/pet/`:
```js
ctx.pet.stage.request({ kind, priority, payload })  // trả về id
ctx.pet.stage.cancel(id)
```
| priority | kind | ví dụ |
|---|---|---|
| 100 | `alarm` | báo thức — luôn chen ngang, chỉ dừng khi người dùng bấm |
| 90 | `due` | tới giờ note |
| 70 | `pre` | sắp tới giờ |
| 60 | `memo` | dặn dò |
| 40 | `nag` | việc quá hạn |
| 30 | `reward` | khen, lên cấp |
| 10 | `chatter` | nói linh tinh khi rảnh |
Mức cao hơn được ngắt mức thấp hơn (mức thấp quay lại hàng đợi nếu chưa hết hạn `ttlMs`). Nhắc lịch (≥60) **không bao giờ bị bỏ** vì game/thoại; nếu bé bị tắt thì core phải dùng thông báo Windows.
Câu thoại cho mỗi lần lên sân khấu: core hỏi `ctx.persona.pick(event, vars)` nếu có (phòng persona), nếu không có thì dùng câu mặc định của core.
