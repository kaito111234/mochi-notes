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
