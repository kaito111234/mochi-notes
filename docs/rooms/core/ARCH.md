# Phòng core — Kiến trúc nội bộ Đợt 1 (hợp đồng giữa các nhân viên)

Tài liệu nội bộ phòng core. Hợp đồng chung vẫn là `docs/spec/*` — file này chỉ chia nhỏ bên trong phòng.

## Sơ đồ file & chủ (mỗi nhân viên chỉ sửa file của mình)

| Nhân viên | File |
|---|---|
| A. Gói hình & công cụ | `src/main/petcore/pack.js`, `tools/anim/**`, `assets/pet/mochi/**` |
| B. Engine hình động (renderer) | `src/pet/anim.js` |
| C. Cửa sổ bé (renderer) | `src/pet/pet.html`, `src/pet/pet.css`, `src/pet/pet.js` |
| D. Thân bé (main) | `src/main/petcore/index.js`, `window.js`, `body.js`, `brain.js` |
| E. Đạo diễn sân khấu (main) | `src/main/pet/stage.js`, `src/main/pet/mascotWindow.js`, `src/main/pet/ipcPet.js`, `src/main/pet/lines.js` |
| Trưởng phòng | `src/main/preload.js` (khối core), `docs/rooms/core*` |

Thứ tự nạp (do `main.js`, không sửa được): `pet/mascotWindow.js` → `pet/ipcPet.js` → … → `petcore/index.js`. Vì vậy các API gọi nhau **lúc chạy** qua `ctx.pet.*`, không gọi lúc `init`.
Cửa sổ cũ `src/mascot/*` không còn được mở (giữ file, không xoá ở Đợt 1).

## 1. Gói hình (A) — `src/main/petcore/pack.js` (Node thuần, không cần Electron)
```js
loadPack(dir) -> Pack   // ném lỗi nếu không có pack.json đọc được
packDirs(ctx) -> string[]   // [assets/pet, userData/pets] (userData chỉ khi có ctx)
findPack(id, dirs) -> string|null
interface Pack {
  id, name, author, license, dir,          // dir tuyệt đối
  size: [w,h], scale, anchor: [x,y], hand: [x,y],
  hitbox: { head:[x,y,w,h], body:[x,y,w,h] },
  faces: { [mood|expr]: 'faces/x.png' },    // đường dẫn tương đối dir, dùng '/'
  params: { [action]: object },             // = pack.json.actions
  anims: { [action]: { [mood]: { single?: Frame[], start?: Frame[], loop?: Frame[], end?: Frame[] } } },
  warnings: string[]
}
interface Frame { src: 'idle/normal/loop/0001_120.png', ms: 120 }   // sắp theo số thứ tự
```
Tên file khung: `<số>_<ms>.png`; không có `_<ms>` thì ms = 100.

## 2. IPC cửa sổ bé (C ↔ D/E) — preload khối core
Renderer: `window.mochi.pet`
```js
mochi.pet.onCmd(cb)         // cb(cmd) — lệnh từ main, kênh 'pet:cmd'
mochi.pet.send(type, data)  // tin nhắn lên main, kênh 'pet:msg' (main lọc type)
mochi.pet.ignore(v)         // true = click xuyên qua (kênh 'pet:ignore')
```
### Lệnh main → renderer (`cmd.op`)
| op | trường | ý nghĩa |
|---|---|---|
| `pack` | `pack: Pack`, `baseUrl` (file:// tới `pack.dir` có `/` cuối), `layout` | nạp gói; renderer nạp trước ảnh rồi gửi `packReady` |
| `play` | `action, mood, loop?:bool, token?` | chạy hình (xem engine). Hết hình không lặp → gửi `animEnd {token, action}` |
| `face` | `dir: 'left'\|'right'` | quay mặt (lật ngang quanh tâm nhân vật). Hình gốc nhìn sang phải là `right`. |
| `say` | `text, buttons?:[{id,label,primary?}], ttlMs?, big?:bool` | bong bóng, chữ chạy dần (~35ms/ký tự, có nút thì hiện nút ngay). ttl hết → `sayEnd {}`; bấm nút → `button {id}` |
| `hush` | — | ẩn bong bóng |
| `note` | `note: {title, big, meta, color, kind:'pre'\|'due'\|'alarm'\|'memo'} \| null` | tờ note gắn tại điểm tay `pack.hand`; bấm vào tờ note → `noteClick {}` |
| `sound` | `name: 'ding'\|'pop'\|'alarm'` | âm tổng hợp WebAudio (tôn trọng `settings.sound`) |
| `shake` | `on: bool` | rung cả nhân vật (báo thức) |
| `settings` | `settings` | `{sound, ...}` |
| `fade` | `to: 0..1, ms` | hiện/ẩn mờ (vào/ra sân khấu khi bé không thường trực) |

`layout = { winW, winH, charLeft, charTop, scale }` — khung nhân vật (canvas) đặt ở `(charLeft, charTop)` kích thước `size*scale` (px CSS). Toạ độ điểm trên canvas gói `(px,py)` → trong cửa sổ: `(charLeft + px*scale, charTop + py*scale)`; khi `face` = left thì x đối xứng quanh `charLeft + size[0]*scale/2`.

### Tin renderer → main (`type`)
`ready {}`, `packReady {ok, missing:[]}`, `animEnd {token, action}`, `lift {}` (nhấn giữ 300ms trên thân), `drop {}` (thả chuột sau lift), `interact {kind:'click'|'pat-head'|'pat-body'}`, `button {id}`, `sayEnd {}`, `noteClick {}`, `hover {on:bool}` (con trỏ vào/ra phần thân/bong bóng).
Renderer tự gọi `mochi.pet.ignore(false)` khi con trỏ ở trên điểm ảnh không trong suốt của nhân vật / bong bóng / tờ note, `ignore(true)` khi ra ngoài (cửa sổ mặc định click xuyên, có forward).

## 3. Engine (B) — `src/pet/anim.js` (script thường, gắn `window.MochiAnim`)
```js
const a = new MochiAnim.Animator(canvas, { onEnd(token, action) {}, onMissing(msg){} });
await a.load(pack, baseUrl)            // nạp trước TẤT CẢ khung thành ImageBitmap, cache; trả {ok, missing}
a.play(action, { mood, loop, onEnd, token })   // Start→Loop→End; loop=true: lặp Loop mãi đến khi gọi a.stop()/play khác
a.stop()                               // nếu đang Loop có End: chạy End rồi gọi onEnd
a.current  // {action, mood, phase}
a.flip(bool)                           // lật ngang
a.alphaAt(x, y) -> 0..255              // x,y theo px CSS trong canvas — để hit-test
MochiAnim.resolve(pack, action, mood) -> { action, mood, start, loop, end, single } // fallback theo 03-animation
```
Fallback: mood thiếu → `normal` → mood bất kỳ; action thiếu → `idle`; không có ảnh nào → vẽ `faces/<mood|normal>.png` hoặc khung giữ chỗ (hình tròn). Không dùng rAF liên tục: hẹn giờ theo ms từng khung (CPU thấp khi đứng yên). Có `loop` mà không có start/end → lặp loop; không loop → chạy (start?) + loop một lượt + (end?) rồi onEnd. `single` coi như loop chạy 1 lượt.

## 4. Thân bé (D) — main, `ctx.pet.actor`, `ctx.pet.body`
`petcore/index.js` `init(ctx)`: ngăn `pet` (01-data) `{x, y, displayId, posture, settings:{alwaysVisible:true, scale:1, walkEnabled:true}}`; đăng ký:
```js
ctx.pet.settings() -> box.settings
ctx.pet.setSettings(patch)            // lưu + áp dụng ngay (ẩn/hiện, scale)
ctx.pet.mode() -> 'happy'|'normal'|'tired'|'sad'  // từ bus game:mode, mặc định normal
ctx.pet.actor = {
  ensure(),            // tạo cửa sổ nếu chưa có; trả BrowserWindow
  isReady(),           // renderer đã ready + packReady
  whenReady(): Promise,
  visible(),
  show(),              // hiện tại vị trí đã lưu (đứng trên sàn) — dùng khi thường trực
  hide(),
  applyVisibility(),   // theo settings: alwaysVisible && store.settings.mascotEnabled → show, ngược lại hide nếu không bận sân khấu
  cmd(cmd),            // gửi pet:cmd thô
  play(action, opts),  // opts {mood?, loop?} → Promise resolve khi animEnd (loop thì resolve ngay)
  say(text, opts),     // {buttons, ttlMs, big}
  hush(), holdNote(noteObj|null), sound(name), shake(on),
  setStage(bool),      // true: đang diễn — não dừng tự đi/ngủ, đánh thức, không phản ứng xoa/click bằng hành vi riêng
  goToCorner(): Promise,// chạy (walk tốc độ x2) hoặc nhảy tới góc dưới gần nhất của màn hình đang đứng; nếu đang ẩn: hiện ngay ở góc phải dưới màn hình có con trỏ (trồi lên + land)
  on(type, fn),        // nghe tin renderer: 'button','sayEnd','noteClick','interact',...
}
ctx.pet.body = { pos(): {x,y,displayId}, posture(): string }
```
Bus phát: `pet:interact`, `pet:posture`, `pet:idleTick`. Nghe: `game:mode`, `app:idle`, `app:resume`, `app:startup`, `settings:changed` (khi `mascotIdle` đổi → chép sang `alwaysVisible`; `mascotEnabled` đổi → applyVisibility).
Vật lý: sàn = đáy `workArea` của màn hình chứa chân bé, hoặc cạnh trên cửa sổ note đang hiện nằm dưới chân (x trong khoảng note). Nhấc: main bám con trỏ ~60Hz giữ độ lệch lúc nhấc. Thả: rơi có gia tốc tới sàn (fall) → land → idle. Kéo ra quá mép trái/phải >40% thân → nấp `peek_left/right` (ló nửa người). Đi: dời cửa sổ ~20 bước/s theo `params.walk.speed` px/khung*scale, quay mặt theo hướng.
Não: tick 15s phát `pet:idleTick {quietMs}`; xúc xắc theo quietMs → idle/walk/sit/sleep; `app:idle` → sleep; `app:resume` hoặc tương tác → wake. Xoa đầu/thân → play `pat_head`/`pat_body` (mood happy). Click → hỏi `ctx.persona.pick('click')` nếu có, không có thì câu mặc định → say.

## 5. Đạo diễn (E) — `ctx.pet.stage` + API cũ
```js
ctx.pet.stage.request({ kind, priority?, payload, ttlMs? }) -> id
ctx.pet.stage.cancel(id)
ctx.pet.stage.current() -> {id, kind, priority, payload} | null
ctx.pet.stage.size() -> number
// API cũ giữ nguyên chữ ký: enqueue({type, noteId}), enqueueHello(), pump(), syncIdle(), ensureMascot(), dropNote(id), isBusy()
```
`kind` → priority mặc định theo 02-events: alarm 100, due 90, pre 70, memo 60, nag 40, reward 30, chatter 10, hello 10.
Payload: note (`noteId`), alarm (`alarmId, label, noteId?, snoozeMin?, buttons?, onAction?(buttonId)`), memo (`memoId, text, when`), chatter/reward (`text, face?, anim?`).
Diễn: `actor.setStage(true)` → `goToCorner()` → `holdNote` + `play('hold_note'|'ring', loop)` + `say(câu, nút)` → chờ nút/ttl → dọn → `setStage(false)` → nếu không thường trực thì `hide()`.
Nút: pre (Biết rồi / Mở note), due (Xong rồi / Hoãn 10 phút / Mở note; nhắc lại mỗi 60s tối đa 3 lần), nag (Để tớ xem / Để sau), alarm (Tắt / Hoãn N phút — gọi `payload.onAction`, phát bus `pet:stageAction {stageId, kind, button, alarmId?, noteId?, memoId?}`), memo (Ừ, nhớ rồi).
Bé bị tắt (`store.settings.mascotEnabled=false`) hoặc cửa sổ không sẵn sàng sau 5s: kind ≥ memo (60) → thông báo Windows dự phòng (như 0.1). Không bao giờ bỏ nhắc lịch vì game/thoại.
Nghe bus: `memo:due`, `alarm:ring` (chống trùng nếu phòng notes vừa gọi enqueue/stage cho cùng alarmId trong 60s), `alarm:stopped` (huỷ), `persona:line` (→ chatter/reward theo priority), `note:deleted` (bỏ khỏi hàng đợi).
Câu thoại: `ctx.persona.pick(event, vars)` nếu có, không thì `lines.js` (câu mặc định của core).

---
# Đợt 2 — chia việc nội bộ & hợp đồng mới (trưởng phòng chốt 2026-10-15)

## Sơ đồ file & chủ Đợt 2
| Nhân viên | File (chỉ sửa file của mình) |
|---|---|
| P. Gói hình | `src/main/petcore/pack.js`, `src/pet/anim.js`, `tools/anim/**`, `assets/pet/placeholder/**` (mới). **Không đụng `assets/pet/mochi/**`** (của phòng art). |
| R. Renderer bé | `src/pet/pet.html`, `src/pet/pet.css`, `src/pet/pet.js` |
| W. Cửa sổ + ghi nhanh + menu | `src/main/petcore/window.js`, `src/main/petcore/index.js`, `src/main/petcore/capture.js` (mới), `src/main/petcore/menu.js` (mới) |
| M. Cửa sổ phụ | `src/pet/settings.html|css|js` (mới), `src/pet/flash.html|css|js` (mới), `src/main/petcore/settingsWindow.js` (mới), `src/main/petcore/flash.js` (mới) |
| B. Thân & não | `src/main/petcore/body.js`, `src/main/petcore/brain.js` |
| S. Sân khấu | `src/main/pet/stage.js`, `src/main/pet/lines.js`, `src/main/pet/ipcPet.js`, `src/main/pet/mascotWindow.js` |
| Trưởng phòng | `src/main/preload.js` (khối core), `docs/rooms/core*` |

## P. Gói hình: mochi + placeholder
- Gói tạm chuyển sang `assets/pet/placeholder/` (`pack.json.id = "placeholder"`), sinh bằng `node tools/anim/make-placeholder.js` (mặc định ghi vào placeholder). Thêm action mới cho Đợt 2: `climb` (bám tường, hình gốc quay mặt về phía tường bên PHẢI — body lật khi bám tường trái), `point` (chỉ tay sang phải), `write` (cầm bút ghi chép, dùng khi ghi nhanh).
- `pack.js` xuất thêm `loadCharacter(ctx) -> Pack`: nạp `mochi` (tìm trong `packDirs`) làm gói chính; nạp `placeholder` làm gói dự phòng; action nào gói chính thiếu (hoặc thiếu hẳn gói chính) thì lấy từ dự phòng. Khung lấy từ dự phòng có `src` là **URL tuyệt đối** `file:///…` và `fit: true` (renderer vẽ co giãn khung đó vào đúng `pack.size`). `faces` thiếu cũng lấy từ dự phòng (URL tuyệt đối). Thêm `pack.sources = {primary: 'mochi'|null, fallback: 'placeholder', borrowed: [action…]}`. Không bao giờ ném lỗi: thiếu cả hai → gói tối thiểu (như `minimalPack`).
- `anim.js`: `src` tuyệt đối (bắt đầu `file:`/`data:`) dùng nguyên; tương đối thì ghép `baseUrl`. Khung `fit` vẽ `drawImage(img, 0, 0, size[0], size[1])`. `alphaAt` vẫn đúng.

## IPC renderer bé — bổ sung Đợt 2 (preload không đổi: vẫn `mochi.pet.send/onCmd/ignore`)
Lệnh main → renderer:
| op | trường | ý nghĩa |
|---|---|---|
| `capture` | `draft, prompt` | mở bong bóng nhập (ô nhập 1–3 dòng, nhãn `prompt` mặc định "Cậu muốn tớ ghi gì?", điền sẵn `draft`), renderer `ignore(false)`, focus ô nhập. Enter = gửi, Shift+Enter = xuống dòng, Esc = huỷ. |
| `captureClose` | — | đóng bong bóng nhập (do main, ví dụ nhắc lịch chen ngang) — renderer gửi lại `captureDraft {text}` trước khi đóng |
| `climb` | `side: 'left'\|'right'\|null` | (tuỳ chọn) renderer chỉ cần biết để đặt bong bóng khỏi tràn; có thể bỏ qua |
Tin renderer → main (thêm vào `ALLOWED` trong window.js):
`menu {}` (chuột phải trên thân bé), `captureOpen {}` (bấm đúp thân bé — renderer hoãn click đơn ~250ms để phân biệt), `captureSubmit {text}`, `captureCancel {text}`, `captureDraft {text}` (gõ, hãm 500ms), `dropText {text, kind:'text'|'url'}` (kéo thả chữ/link vào bé).

## W. Cửa sổ/ghi nhanh/menu (main)
- `window.js`: `loadCorePack` dùng `pack.loadCharacter(ctx)`; `ALLOWED` thêm các tin trên; trả thêm `setFocusable(bool)`, `focus()`; `computeLayout` giữ chiều cao đủ cho bong bóng nhập (~ +40px nếu cần).
- `capture.js` `createCapture(core) -> { open(), close(), suspend(), isOpen(), submit(text, source) }`:
  open: nếu sân khấu đang bận mức ≥ 60 thì bé nói "Đợi tớ nhắc xong việc này đã nha" và thôi; còn lại `core.brain.setBusy(true)`, play `write` loop, `window.setFocusable(true)`, gửi `{op:'capture', draft: box.draft}`, `focus()`.
  submit: text rỗng → đóng. Gọi `ctx.notes.quickCapture(text, {source:'pet'|'drop'})` nếu có (kỳ vọng trả `{note, insight}` hoặc note); không có → `ctx.notes.createNote({html: escape(text) với <br>})`. Xoá nháp. Đọc lại: có `note.reminders[]`/`note.reminder.due` → "Tớ ghi rồi nha. HH:MM tớ nhắc cậu {title}" (ưu tiên `ctx.persona.pick('note_created', {title, time})`), không có giờ → "Tớ ghi vào note rồi nha." Play `happy` rồi idle. Lỗi → "Ơ, tớ ghi không được…" + log.
  close/suspend: gửi `captureClose`, `setFocusable(false)`, `brain.setBusy(false)`; nháp lưu ở `box.draft` (chuỗi ≤ 2000 ký tự, lưu khi `captureDraft`/`captureCancel`).
  `dropText`: submit trực tiếp với source 'drop'.
- `menu.js` `createMenu(core) -> { popup() }` (Menu gốc Electron, `popup({window})`): Ghi nhanh · Note mới · Danh sách note · Báo thức… · Ẩn/hiện tất cả note · ─ · Cho bé ngủ · Ẩn bé 1 giờ · Bé đi lại (checkbox) · Cỡ bé (75/100/125%) · Cài đặt bé… Gọi `ctx.notes.createNote({})`, `ctx.list.open()`, `ctx.list.open('alarms')`, `ctx.notes.toggleAll()`, `core.brain.sleep()`, `ctx.pet.hideFor(3600000)`, `ctx.pet.setSettings`, `core.settingsWin.open()`. Sau khi đổi cài đặt gọi `ctx.tray.rebuild && ctx.tray.rebuild()`.
- `index.js`: ngăn `pet` thêm `draft: ''`, `hiddenUntil: 0` (normalize chịu dữ liệu cũ); settings thêm `climbEnabled: true`, `followCursor: true` (bool). Đăng ký thêm:
  ```js
  ctx.pet.hideFor(ms)          // ẩn bé tới hiddenUntil (lưu), hết giờ tự hiện lại; nhắc lịch vẫn lên sân khấu bình thường
  ctx.pet.occupiedRect()       // {x,y,width,height} DIP của phần thân bé đang hiện (+ bong bóng/tờ note nếu đang hiện) hoặc null khi ẩn  -> core.body.occupiedRect()
  ctx.pet.flashNote(noteId, ms) // viền nháy quanh cửa sổ note -> core.flash.flash(noteId, ms); trả boolean
  ctx.pet.capture              // = core.capture (open/close/suspend/isOpen)
  actor.goToNote(noteId) -> Promise<{ok, side:'left'|'right'|null}>   // -> core.body.goToNote
  ```
  `wantVisible()` thêm điều kiện `Date.now() >= box.hiddenUntil`. Nối `core.capture = createCapture(core)`, `core.menu = createMenu(core)`, `core.settingsWin = createSettingsWindow(core)`, `core.flash = createFlash(core)`; nghe `menu` → `core.menu.popup()`, `captureOpen` → `core.capture.open()`, v.v.

## M. Cửa sổ phụ
- `settingsWindow.js` `createSettingsWindow(core) -> { open() }`: cửa sổ nhỏ (360×420, khung thường, không thu phóng, một bản), tải `src/pet/settings.html`. `ipcMain.handle('pet:getSettings')` → `Object.assign({}, core.box.settings)`; `ipcMain.handle('pet:setSettings', patch)` → `core.ctx.pet.setSettings(patch)` rồi `ctx.tray.rebuild()`; trả settings mới. Chỉ chấp nhận từ webContents của cửa sổ cài đặt.
- Renderer cài đặt dùng `window.mochi.pet.getSettings()` / `setSettings(patch)` (trưởng phòng thêm vào preload). Mục: Bé luôn ở trên desktop · Cho bé đi lại · Cho bé leo tường · Thỉnh thoảng đi theo con trỏ · Cỡ bé (75/100/125/150%). CSP chặt như các trang khác, không inline script.
- `flash.js` `createFlash(core) -> { flash(noteId, ms=4000), stop() }`: tìm `ctx.windows.notes.get(noteId)`; không có/ẩn → false. Tạo (dùng lại) một cửa sổ trong suốt, click xuyên hoàn toàn (`setIgnoreMouseEvents(true)`), không focus, luôn nổi, phủ khít bounds note + 6px mỗi phía, tải `src/pet/flash.html` (viền bo tròn hồng nhạt nhấp nháy bằng CSS animation). Bám theo note nếu note di chuyển (kiểm 250ms trong lúc nháy). Hết `ms` thì ẩn. Không preload cần thiết (trang tĩnh).

## B. Thân & não
- Toạ độ, vật lý giữ như Đợt 1. Mới:
  - **Leo tường**: khi đi chạm mép trái/phải workArea (và `climbEnabled`, `walkEnabled`), đôi khi (xác suất) leo lên: play `climb` loop, `face` hướng về tường, chân bám mép (x = mép ± nửa thân), y giảm dần; dừng ở độ cao ngẫu nhiên, nghỉ, rồi tụt xuống hoặc buông ra rơi (`fall`→`land`). Posture phát `walk` khi leo. Nhấc lên khi đang leo hoạt động bình thường.
  - **Đi trên note**: sàn đã gồm cạnh trên note; khi đứng trên note thì đi trong khoảng bề ngang note; tới mép note thì hoặc quay lại, hoặc nhảy xuống (rơi tới sàn dưới). Thỉnh thoảng nhảy lên note gần (nếu note thấp hơn mép trên màn hình đủ chỗ). Ngồi trên note (`sit`). Note di chuyển/đóng → watch 1s xử lý rơi (đã có).
  - **Đi theo con trỏ một đoạn** (`followCursor`, `walkEnabled`): thỉnh thoảng khi con trỏ ở gần (≤ 400px, cùng màn hình) và bé rảnh, đi tới cách con trỏ ~80px theo phương ngang trong ≤ 6s rồi dừng. Không bao giờ để cửa sổ bé che con trỏ: nếu con trỏ nằm trong `occupiedRect` khi bé tự đi (không phải người dùng rê lên thân) thì dừng/quay đi.
  - **Nấp mép**: giữ như Đợt 1.
  - `goToNote(noteId) -> Promise<{ok, side}>`: cửa sổ note đang hiện → đi (nhanh) hoặc nhảy tới sàn ngay cạnh note (bên còn chỗ trên màn hình; ưu tiên bên phải), quay mặt về phía note; `ok:false` nếu note không hiện.
  - `occupiedRect()`: bounds phần nhân vật (charLeft/charTop/charW/charH theo layout, đổi sang toạ độ màn hình); `null` khi ẩn. Phát `bus.emit('pet:moved', {rect})` khi bé dừng sau di chuyển/rơi/nhấc thả và trong khi di chuyển tối đa 4 lần/s.
  - Sửa lỗi tờ note sát mép phải: `goToCorner` chừa lề để tờ note (rộng ~ 220px CSS, gắn tại `pack.hand`) và bong bóng không ra khỏi workArea.
  - **Nhớ vị trí**: lưu `box.x/y/displayId` (debounce 2s) sau mỗi lần dừng, không chỉ lúc thoát; khởi động đặt lại đúng chỗ nếu vẫn nằm trong một workArea.
  - Não: `brain.setBusy(on)` (đang ghi nhanh/menu: dừng tự đi, đánh thức nếu ngủ, không xúc xắc); xúc xắc tick 15s thêm lựa chọn leo/đi lên note/theo con trỏ, tôn trọng `walkEnabled` (tắt → chỉ idle/ngồi/ngủ). CPU khi đứng yên: không timer nào < 1s ngoài lúc chuyển động.

## S. Sân khấu
- Nhắc note (`pre`/`due`/`nag`) mà note có cửa sổ đang hiện (`ctx.windows.notes.get(id)` sống, visible, không minimize): `actor.goToNote(id)` → nếu ok: play `point` loop, `ctx.pet.flashNote(id, …)` (nháy suốt lúc diễn, tắt khi xong), **không** giơ tờ note, bong bóng + nút như cũ; phát `bus.emit('pet:pointNote', {noteId, on})`. Không ok/không hiện → như Đợt 1 (`goToCorner` + `hold_note`).
- Trước khi diễn mức ≥ 60: `ctx.pet.capture && ctx.pet.capture.isOpen() && ctx.pet.capture.suspend()` (nháp được giữ).
- Lỗi tờ note sát mép phải: phần này B sửa trong `goToCorner`; S chỉ đảm bảo gọi đúng.
- Câu mặc định cho ghi nhanh (`captureSaved`, `captureSavedTime`, `captureBusy`, `captureFail`) thêm vào `lines.js` để W dùng: `lines.pick(key, vars)` (giữ API cũ của lines.js).

---
# Đợt 2B — chia việc nội bộ & hợp đồng (trưởng phòng chốt 2026-10-15, lượt 3)
Nhiệm vụ: `docs/rooms/core.md` mục "ĐỢT 2B" + lỗi core trong `docs/rooms/qa/BUGS.md` (BUG-014, 016, 023, 024, 030; phối hợp 013/015).
API notes đã có ở main: `ctx.notes.trash(id)` (xoá mềm, đóng cửa sổ, phát `note:trashed`), `restore(id)`, `expiredCandidates() -> [{noteId, reason, title}]`, bus `note:expired {noteId, reason:'done'|'overdue'|'checklist'}`; `ctx.notes.quickCapture(text,{source}) -> {ok, note, insight, reply}`. Game: `ctx.game.open(tab?)`, bus `game:outfit {worn}`.

## Sơ đồ file 2B
| Nhân viên | File |
|---|---|
| P. Gói hình | `tools/anim/**`, `assets/pet/placeholder/**` |
| S. Sân khấu | `src/main/pet/stage.js`, `src/main/pet/lines.js` |
| T. Dọn note | `src/main/petcore/tidy.js` (mới), `src/pet/bin.html|css|js` (mới, thùng rác), `src/pet/crumple.html|css|js` (mới, tờ giấy bị mang/vo/ném) |
| K. Gõ cửa | `src/main/petcore/foreground.js` (mới), `src/main/petcore/knock.js` (mới) |
| B. Thân & não | `src/main/petcore/body.js`, `src/main/petcore/brain.js` |
| W. Nối & renderer | `src/main/petcore/index.js`, `window.js`, `capture.js`, `menu.js`, `src/pet/pet.js|css|html` |
| M. Cài đặt | `src/pet/settings.*`, `src/main/petcore/settingsWindow.js` |

## Action mới (P vẽ hình tạm; thiếu thì engine fallback `idle`)
`knock` (gõ cộc cộc sang phải), `carry_note` (hai tay ôm/giơ tờ giấy, đi được — dùng khi mang), `crumple` (vo giấy trong tay), `throw` (ném sang phải), `peek_note` (thò đầu từ sau mép — hình gốc thò từ bên trái sang phải), `sit_on_note` (ngồi buông chân), `yawn`, `stretch`, `read` (cầm tờ giấy đọc), `cheer` (reo mừng), `play_cat` (chơi với mèo đen nhỏ — vẽ mèo đen đơn giản bằng hình khối, tự vẽ, không lấy hình ở đâu). Quy ước hướng: hình gốc quay mặt/hành động sang PHẢI; body lật khi cần.

## Cài đặt mới (ngăn `pet.settings`, W thêm normalize/setSettings, M thêm vào cửa sổ cài đặt)
`autoTidy: false` (tự dọn note đã xong mà không hỏi — chỉ áp cho reason `done`), `tidyEnabled: true` (bé đi hỏi dọn note hết hạn), `knockEnabled: true` (bé gõ vào app đang dùng để nhắc). Ngăn `pet` thêm `outfit: {}` (ghi lại `game:outfit.worn`).

## B. Thân — API mới
```js
core.body.goToRect(bounds, {prefer:'right'|'left', fast?:true}) -> Promise<{ok, side}>  // tới sàn sát cạnh hình chữ nhật (cửa sổ bất kỳ / thùng rác), quay mặt về nó; goToNote dùng lại hàm này
core.body.handScreen() -> {x, y} | null      // toạ độ màn hình (DIP) của pack.hand theo hướng mặt hiện tại
core.body.face() -> 'left'|'right';  core.body.setFace(dir)  (đã có nội bộ thì công bố)
core.body.footScreen() -> {x, y}             // = pos()
```
Não: dùng thêm `yawn`/`stretch` (trước/sau ngủ), `read` (đứng/ngồi cạnh note), `sit_on_note` (khi ngồi trên note), `peek_note` (thỉnh thoảng đứng sau mép note), `play_cat` (thỉnh thoảng khi rảnh lâu), `cheer` khi bus `reminder:done` (nếu không đang diễn). Không phá CPU đứng yên.

## T. Dọn note — `tidy.js` `createTidy(core) -> { carryAway(noteId) -> Promise<boolean>, binRect() }`, W đăng ký `ctx.pet.tidy = core.tidy`
- Nghe `note:expired`: nếu `tidyEnabled` và cửa sổ note đang hiện → `ctx.pet.stage.request({kind:'tidy', priority:35, payload:{noteId, reason, title}, ttlMs: 30*60000})`; tối đa 1 lần hỏi / 10 phút (xếp hàng phần còn lại tối đa 3). `autoTidy && reason==='done'` → vẫn qua stage nhưng payload `auto:true` (không hỏi).
- `carryAway(noteId)`: (1) `w.webContents.capturePage()` cửa sổ note → dataURL; (2) mở cửa sổ phụ trong suốt `crumple.html` (click xuyên, không focus, luôn nổi) đè đúng bounds note, nạp ảnh bằng `win.webContents.executeJavaScript('window.setPaper(' + JSON.stringify(url) + ')')`; (3) `ctx.notes.trash(noteId)` (cửa sổ note thật đóng; không bao giờ xoá hẳn); (4) hiện thùng rác `bin.html` (cửa sổ nhỏ ~96×110 trong suốt, đứng trên sàn workArea cùng màn hình, phía xa bé hơn hoặc góc dưới trái/phải còn trống, né cửa sổ chuông góc dưới phải nếu có thể); (5) tờ giấy co nhỏ (~120px) về tay bé, bé `carry_note` đi tới cạnh thùng (`core.body.goToRect(binRect)`), tờ giấy bám `core.body.handScreen()` ~30 lần/s CHỈ trong lúc mang; (6) `crumple`: tờ giấy vo thành cục (CSS), bé play `crumple`; (7) `throw`: cục giấy bay theo đường cong vào miệng thùng (dời cửa sổ crumple), thùng nảy nắp (`window.bump()` qua executeJavaScript); (8) ẩn cả hai sau ~1,2s. Mọi bước có timeout; lỗi giữa chừng vẫn đảm bảo note đã vào thùng rác HOẶC chưa bị đụng (không mất note). Trả true nếu đã trash.
- Hai trang tĩnh, CSP `default-src 'self'; img-src data:; script-src 'self'; style-src 'self'`, không cần preload API.

## S. Sân khấu
- Kind mới `tidy` (priority 35): `actor.goToNote(noteId)` → play `point` + flashNote → hỏi "Note “{title}” {lý do} rồi, tớ dọn vào thùng rác nha?" nút **Dọn đi** / **Giữ lại** (ttl 60s → Giữ lại, không làm gì). Payload `auto` → bỏ hỏi. Dọn đi → `ctx.pet.tidy.carryAway(noteId)` → nói "Tớ dọn rồi nha. Cần thì lấy lại trong thùng rác." Lỗi → nói xin lỗi, note giữ nguyên. Bị mức cao hơn chen ngang trước khi bấm → hủy (không dọn). Phát `pet:stageAction` như các kind khác.
- Gõ cửa: khi diễn `nag` hoặc `pre`, nếu `ctx.pet.knock && await ctx.pet.knock.target()` trả `{rect}` (đã kiểm giới hạn tần suất, cài đặt, toàn màn hình) → thay `goToCorner` bằng `actor.goToRect(rect, {prefer:'right'})`, play `knock` 2 lượt + `actor.sound('knock')` + `bus.emit('pet:knock', {target:'foreground'})`, rồi bong bóng + nút như cũ (giơ tờ note như cũ). Mọi lỗi/timeout 6s → đường cũ. Nhắc lịch tất định: knock chỉ thêm đoạn mở màn, không bao giờ làm mất lời nhắc.
- Sửa BUG-014 (tờ "Dặn dò" NaN — `when` là 'startup'|'morning'|'noon'|'evening'|'before-shutdown' → nhãn "Lúc mở máy"/"Buổi sáng"/"Buổi trưa"/"Buổi tối"/"Trước khi tắt máy"), BUG-023 (`varsFor` thêm `intent` của note qua `require('../../shared/parse.js').intentOf` hoặc `analyze` nếu có; reminder có `title` thì dùng `payload.title`/`reminder.title`), BUG-030 (số phút hoãn lấy từ cài đặt hoãn mặc định của báo thức: `ctx.alarms` nếu có API settings, nếu không đọc `ctx.store.data.alarms.settings.defaultSnoozeMin`, mặc định 10; nhãn nút "Hoãn N phút"), dùng `p.reminderId` khi gọi `ctx.notes.completeNote/snoozeNote(noteId, …, reminderId)`, thông báo dự phòng note dùng `ctx.alarms.toast` nếu có (xem docs/rooms/notes/API2.md mục 6), không thì như cũ.
- lines.js thêm khoá: `tidyAsk` ({title},{why}), `tidyDone`, `tidyKeep`, `tidyFail`, `knock`, `cheer`, `yawn`, `catPlay`.

## K. Gõ cửa — `foreground.js` + `knock.js`
- `foreground.js` `createForeground() -> { get(): Promise<{rect:{x,y,width,height}, title, fullscreen:boolean, ownPid:boolean} | null>, stop() }`: chỉ `win32`: một tiến trình PowerShell sống lâu (`-NoProfile -NonInteractive -WindowStyle Hidden -Command -`), Add-Type C# nhỏ gọi user32 `GetForegroundWindow`, `GetWindowRect`, `GetWindowThreadProcessId`, `MonitorFromWindow`/`GetMonitorInfo` (toàn màn hình = rect phủ hết monitor), `IsIconic`; giao tiếp từng dòng JSON qua stdin/stdout, timeout 1,5s mỗi lần hỏi, tự khởi động lại tối đa 3 lần, khởi chạy lười (lần hỏi đầu). Toạ độ trả về là pixel vật lý → đổi sang DIP bằng `screen.screenToDipRect(null, rect)`. Nền tảng khác → luôn `null`. Biến gỡ lỗi `MOCHI_FAKE_FG="x,y,w,h"` trả rect giả trên mọi nền tảng (để thử trên xvfb).
- `knock.js` `createKnock(core) -> { target(): Promise<{rect}|null>, allowed(): boolean }`, W đăng ký `ctx.pet.knock`: `allowed` = `knockEnabled` && bé không bị tắt && đã ≥ 15 phút từ lần gõ trước && không `app:idle`; `target`: lấy foreground; bỏ nếu null, fullscreen (đang trình chiếu/xem phim), cửa sổ của chính app (pid trùng `process.pid` hoặc tiến trình con — so `ownPid`), rect quá nhỏ (< 200×150), hoặc thu nhỏ; ghi lại thời điểm gõ khi trả rect. Rect được kẹp vào workArea.

## W. Nối
- index.js: settings mới + `outfit`; nghe `game:outfit` → lưu `box.outfit`, gửi renderer `{op:'outfit', worn}` (renderer chỉ ghi nhận); tạo `core.tidy`, `core.knock` (require phòng thủ); `ctx.pet.tidy`, `ctx.pet.knock`; `actor.goToRect(rect, opts)` → `core.body.goToRect`; `actor.handScreen()`.
- capture.js: dùng `res.reply` của `quickCapture` khi `res.ok` (câu do notes soạn), `res.ok === false` → nói `res.message`; giữ đường dự phòng cũ.
- menu.js: thêm "Phòng của Mochi" (`ctx.game.open()` nếu có) và "Dọn note hết hạn…" (gọi `ctx.notes.expiredCandidates()` → đưa từng note (tối đa 3) lên sân khấu `tidy`; không có → bé nói "Không có note nào cần dọn cả").
- pet.js: âm `knock` (2 tiếng gõ gỗ ngắn, WebAudio), `crumple` (tiếng sột soạt noise ngắn); op `outfit` lưu lại. Không đổi gì khác.
