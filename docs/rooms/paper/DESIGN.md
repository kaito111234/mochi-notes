# Hợp đồng nội bộ phòng paper (Đợt 2)

Hợp đồng chung: `docs/spec/*`. Tài liệu này chốt chi tiết **bên trong phòng** để các nhân viên làm song song.
Mỗi nhân viên chỉ sửa file trong mảng của mình (bảng cuối). Ưu tiên số 1: mọi chức năng note cũ vẫn chạy.

## 1. Dữ liệu

### Ngăn `paper` (main, `src/main/paper/index.js`)
```js
{
  v: 1,
  settings: { defaultPaper: null | string, defaultFont: null | string, hideDeco: false, tilt: false },
  noteMeta: { [noteId]: NotePaper }
}
interface NotePaper {
  paper?: string;      // id mẫu giấy; thiếu => 'plain-' + note.color (note 0.1 cũ giữ y nguyên màu)
  font?: string;       // id phông (mục 3); thiếu => font của mẫu
  shape?: 'free' | 'square' | 'tall' | 'mini';   // chỉ là lựa chọn gần nhất; kích thước thật vẫn là bounds của note
  tilt?: boolean;      // nghiêng nhẹ trang trí; thiếu => settings.tilt
  deco?: boolean;      // false = ẩn trang trí; thiếu => !settings.hideDeco
}
```
- `note:created` (bus) → nếu `settings.defaultPaper` có và note chưa có meta → `noteMeta[id] = {paper: defaultPaper, font?: defaultFont}`.
- `note:deleted` → xoá `noteMeta[id]`.
- `normalize` chịu được dữ liệu thiếu/hỏng (bỏ khoá lạ, id lạ `__proto__`...).

### Kênh IPC (preload khối `BẮT ĐẦU PHÒNG paper`)
```js
api.paper = {
  get: id => inv('paper:get', id),                  // -> {meta: NotePaper, settings}
  set: (id, patch) => inv('paper:set', id, patch),  // patch NotePaper (giá trị null = xoá khoá) -> meta; main gửi 'paper:meta' {id, meta} tới cửa sổ note đó
  settings: patch => inv('paper:settings', patch),  // patch settings (có thể {}) -> settings; main gửi 'paper:settings' tới mọi cửa sổ note
  resize: (id, size) => inv('paper:resize', id, size), // {width,height} -> boolean; main gọi win.setSize (giữ trong màn hình)
  checkItem: (id, index, done) => inv('paper:checkItem', id, index, !!done), // main phát bus 'note:checkItem' {noteId,index,done}
  onMeta: cb => on('paper:meta', cb),
  onSettings: cb => on('paper:settings', cb)
};
```
**Lưu ý**: `main.js` (điều hành) hiện chỉ nạp `alarms|petcore|game|persona`. Đã đề xuất thêm `paper`. Trước khi được gộp, các kênh trên **không có handler** → renderer phải tự rơi về `localStorage` (mục 2, `paperStore.js`).

## 2. Renderer — các module (đều là IIFE, `'use strict'`, không ES module, không thư viện)
Thứ tự nạp trong `note.html`:
```html
<link rel="stylesheet" href="../../assets/fonts/fonts.css">
<link rel="stylesheet" href="note.css">
<link rel="stylesheet" href="paper.css">
<link rel="stylesheet" href="checklist.css">
<link rel="stylesheet" href="picker.css">
<link rel="stylesheet" href="insight.css">
...
<script src="../shared/parse.js"></script>
<script src="../shared/recur.js"></script>
<script src="../../assets/paper/catalog.js"></script>   <!-- window.MochiPaperCatalog -->
<script src="paper.js"></script>          <!-- window.MochiPaper (engine thuần, không IPC) -->
<script src="paperStore.js"></script>     <!-- window.MochiPaperStore (IPC + dự phòng localStorage) -->
<script src="note.js"></script>           <!-- window.MochiNote (móc nối) -->
<script src="paperCtl.js"></script>       <!-- window.MochiPaperCtl (áp mẫu cho note này) -->
<script src="checklist.js"></script>      <!-- window.MochiChecklist -->
<script src="picker.js"></script>         <!-- bộ chọn mẫu -->
<script src="insight.js"></script>        <!-- dải gợi ý -->
```
Mọi module phải **chịu được module khác thiếu** (kiểm `window.X` trước khi dùng) và không ném lỗi làm hỏng note.

### 2.1 `window.MochiNote` (do `note.js` tạo, đồng bộ, trước các module sau)
```js
MochiNote = {
  id, editor /* #editor */, body,
  note(),            // Note hiện tại (hoặc null khi chưa nạp)
  isLocked(), zoom(),
  histCommit(),      // chốt một bước undo (gọi TRƯỚC và SAU khi module sửa DOM editor)
  afterEdit(),       // báo đã sửa nội dung: cập nhật placeholder + hẹn lưu
  flush(),           // lưu ngay (Promise)
  toast(text, ms),
  openPop(el, trigger), closePops(), registerPop(el), // el là .pop (popover) của module; registerPop để Esc/click ngoài đóng được
  setColor(color),   // đổi note.color (7 màu cũ) qua M.updateNote, trả Promise<Note>
  on(evt, cb)        // 'note' (Note mới áp), 'locked' (bool), 'zoom' (number), 'ready' (lần nạp đầu xong)
  textHooks: []      // module đẩy fn(editor) -> string|null; note.js dùng hook đầu tiên trả chuỗi để tính `text` khi lưu (thay innerText)
};
```
- Sanitizer của `note.js` giữ thêm thuộc tính `data-ck="0"|"1"` trên `DIV` và `LI` (checklist). Mọi thuộc tính khác vẫn bị bỏ.
- Menu "…" có nút `data-act="paper"` "Mẫu giấy…" (picker bắt) và `data-act="checklist"` "Chuyển thành checklist" (checklist bắt). Hai module tự gắn listener cho nút của mình; `note.js` bỏ qua `act` lạ.
- Giữ 7 ô màu cũ trong menu (nhóm "Trơn"): bấm màu → `setColor` + `MochiPaperCtl.choose({paper: 'plain-' + color})` nếu có.
- `note.html` có sẵn chỗ: `<div class="paper-layer" id="paperLayer" aria-hidden="true"></div>` (con đầu tiên của `.note`, nằm dưới mọi thứ), `<div class="paper-head" id="paperHead" aria-hidden="true"></div>` (trong `.topbar`, trước `.spacer`), `<span class="ckcount" id="ckCount" hidden></span>` (trong `.topbar` sau `#lockInd`), `<div class="insightrow" id="insightRow" hidden></div>` (ngay trước `.chiprow`), `<div class="pop pickerpanel" id="pickerPanel" hidden role="dialog" aria-label="Mẫu giấy"></div>` (cạnh `#remPanel`).

### 2.2 `window.MochiPaper` (`src/note/paper.js` + `paper.css`) — engine thuần
```js
MochiPaper = {
  list(),                  // PaperDef[] theo thứ tự catalog (gồm cả 7 'plain-*')
  get(id),                 // PaperDef | null
  groups(),                // [{id:'plain',name:'Trơn'},{id:'cute',name:'Dễ thương'},{id:'student',name:'Học sinh'},{id:'minimal',name:'Tối giản'},{id:'office',name:'Văn phòng'},{id:'season',name:'Mùa & lễ'}]
  fonts(),                 // [{id, name, family}] (mục 3)
  apply(root, paperId, opts), // root = document.body của note (hoặc khung xem trước); opts {font?, tilt?, deco?(bool), headEl?, layerEl?}
                           // đặt data-paper, biến CSS (--bg-rgb, --head-rgb, --fg, --fg-rgb, --ink, --line, --step...), lớp nền, dòng kẻ, tiêu đề in sẵn vào headEl, trang trí vào layerEl
  thumb(paperId, opts),    // -> HTMLElement xem trước nhỏ (~84×84) dựng bằng cùng CSS, không ảnh chụp
  assetUrl(rel)            // '../../assets/paper/' + rel
};
```
- Mẫu `plain-*` = đúng giao diện cũ (không dòng kẻ, không tiêu đề, không trang trí, phông hệ thống). Áp `plain-*` phải trả note về **y hệt** 0.1.
- Chữ thẳng hàng dòng kẻ: `#editor { line-height: var(--step) }`, dòng kẻ vẽ bằng `background` trên `#editor` với `background-attachment: local` để cuộn theo chữ; `--step = calc(var(--step-base) * var(--zoom,1))`; `padding-top` của editor là bội số khớp lưới. Ảnh trong note không cần khớp.
- Nền kính (`body.glass`) vẫn chạy: khi kính bật, mẫu chỉ áp dòng kẻ/tiêu đề/trang trí, nền mờ như cũ.
- Bóng đổ giấy "thật" trong cửa sổ đục: viền mép sáng/tối nhẹ + bóng cong ở góc dưới (`.paper-layer::after`). Nghiêng (`tilt`): xoay nhẹ tiêu đề và trang trí (±2–4°), chữ không xoay.

### 2.3 PaperDef — `assets/paper/<id>/paper.json`
```jsonc
{
  "id": "cute-cream-cat",           // = tên thư mục, [a-z0-9-]
  "name": "Kem lốm đốm & mèo đen",  // tiếng Việt, ngắn
  "group": "cute",                  // plain|cute|student|minimal|office|season
  "order": 10,                      // thứ tự trong nhóm
  "noteColor": "yellow",            // 1 trong 7 màu cũ gần nhất (danh sách note, nền cửa sổ lúc mở)
  "dark": false,                    // true = nền tối (chữ sáng, color-scheme dark)
  "bg": {
    "color": "#fbf3e2",             // màu nền chính
    "head": "#f6e7c8",              // màu thanh trên (thường = color hoặc đậm hơn chút); nếu "same" thì trong suốt liền giấy
    "gradient": null,               // hoặc ["#ffe3ec", "#e8e3ff"] (dọc, trên→dưới)
    "texture": "speckle"            // none|speckle (lốm đốm mực)|grain (vân giấy)|kraft|linen
  },
  "lines": {
    "kind": "ruled",                // none|ruled|grid|oly (ô ly vở VN)|dots|margin-ruled
    "color": "rgba(90,120,170,.28)",
    "step": 24,                     // px ở zoom 1 — khoảng cách dòng = line-height
    "margin": "#e88a8a"             // tuỳ chọn: lề đỏ dọc bên trái (null = không)
  },
  "header": {                       // tiêu đề in sẵn (null = không có)
    "text": "Notes", "font": "pangolin", "color": "#3a2e2a", "size": 20, "align": "left", "style": "plain" // plain|underline|stamp|ribbon
  },
  "ink": "#3a2e2a",                 // màu chữ
  "font": "itim",                   // id phông mặc định của mẫu (mục 3)
  "edge": null,                     // null|"torn-top"|"torn-bottom" (mép xé)
  "corner": null,                   // null|"fold" (góc gập dưới phải)
  "deco": [                         // vẽ ở lớp dưới chữ, pointer-events:none
    { "kind": "img", "src": "deco/animals/cat-black.svg", "pos": "tr", "w": 56, "dx": 8, "dy": 2, "rot": -6 },
    { "kind": "washi", "color": "#f4b6c2", "pattern": "stripe", "pos": "top", "w": 90, "rot": -3 }
    // kind: img (src tương đối với assets/paper/) | washi (pattern: plain|stripe|dots|grid) 
    // pos: tl|tr|bl|br|top|bottom|left|right ; dx/dy: px lệch vào trong; rot: độ
  ],
  "checklist": false                // true = note mới dùng mẫu này bắt đầu ở chế độ checklist (dòng "- " thành ô tick)
}
```
Không cần CSS riêng cho từng mẫu; nếu thật cần thì `assets/paper/<id>/paper.css` chỉ dùng selector `body[data-paper="<id>"]` và phải được liệt kê trong catalog (`css` field) — hạn chế dùng.

### 2.4 Catalog
- `node src/note/tools/build-catalog.js` đọc mọi `assets/paper/*/paper.json`, kiểm hợp lệ (schema trên, file `src` tồn tại, id = tên thư mục, group hợp lệ), thêm 7 mẫu `plain-*`, sắp xếp theo group rồi `order`, ghi `assets/paper/catalog.js`:
  `window.MochiPaperCatalog = { version: 1, papers: [...] };` (có dòng chú thích "tự sinh, đừng sửa tay").
- Phải chạy lại sau khi sửa paper.json. Lỗi → in ra và exit 1.
- 7 mẫu trơn: `plain-yellow|green|pink|purple|blue|gray|charcoal`, group `plain`, `bg.color` = màu nền 0.1 (`--bg-rgb` trong note.css), `bg.head` = `--head-rgb`, `lines.kind: none`, `font: "system"`, `header: null`, `deco: []`, `charcoal.dark = true`.

## 3. Phông chữ (`assets/fonts/`)
`assets/fonts/fonts.css` khai báo `@font-face` (woff2, subset vietnamese + latin + latin-ext, `font-display: swap`), tên family có tiền tố `Mochi `:
| id | family CSS | nguồn | kiểu |
|---|---|---|---|
| `itim` | `Mochi Itim` | @fontsource/itim | viết tay tròn |
| `pangolin` | `Mochi Pangolin` | @fontsource/pangolin | viết tay bút dạ |
| `mali` | `Mochi Mali` | @fontsource/mali (400, 600) | viết tay học sinh |
| `nunito` | `Mochi Nunito` | @fontsource/nunito (400, 700) | chữ tròn |
| `baloo2` | `Mochi Baloo 2` | @fontsource/baloo-2 (400, 700) | chữ tròn mập |
| `bevietnam` | `Mochi Be Vietnam Pro` | @fontsource/be-vietnam-pro (400, 700) | chữ thường |
| `system` | (hệ thống) | — | "Segoe UI" như 0.1 |
`MochiPaper.fonts()` trả danh sách này; stack: `"Mochi Itim", "Segoe UI", system-ui, sans-serif`.
Giấy phép: `assets/fonts/LICENSES.md` + file `OFL-<tên>.txt`.

## 4. Trang trí (`assets/paper/deco/`)
SVG nguyên bản, nét đậm tay (stroke `#2b2420` ~2.5–3px, đầu nét tròn), tô màu phẳng pastel, `viewBox="0 0 64 64"` (hoặc tỉ lệ khác ghi rõ), không script, không ảnh ngoài, không font. **Không mô phỏng nhân vật có bản quyền.**
- `deco/animals/`: `cat-black.svg` (mèo đen ngồi), `cat-black-sleep.svg` (mèo đen ngủ cuộn tròn), `cat-peek.svg` (mèo đen ló đầu qua mép, viewBox 64×40), `bear.svg`, `bunny.svg`, `puppy-headphones.svg` (cún đeo tai nghe), `mochi-ball.svg` (viên mochi có mặt), `chick.svg`, `hamster.svg`, `penguin.svg`, `frog.svg`, `whale.svg`.
- `deco/items/`: `pin-red.svg`, `pin-blue.svg`, `clip.svg` (kẹp giấy, viewBox 24×64), `star.svg`, `heart.svg`, `flower-mai.svg` (hoa mai vàng), `flower-dao.svg` (hoa đào hồng), `lantern-star.svg` (đèn ông sao), `lantern-round.svg` (đèn lồng đỏ), `mooncake.svg`, `xmas-tree.svg`, `holly.svg`, `snowflake.svg`, `leaf.svg`, `coffee.svg`, `pencil.svg`.
- `deco/README.md`: bảng tên file – mô tả – viewBox – "vẽ nguyên bản cho Mochi Notes, giấy phép như dự án".

## 5. Checklist (`src/note/checklist.js` + `checklist.css`)
- Dòng checklist = khối `<div data-ck="0">chữ</div>` (hoặc `"1"` khi đã tick) trực tiếp trong `#editor`. Ô tick vẽ bằng CSS `::before` ở lề trái (padding-left ~26px); bấm vào vùng ô (clientX trong 24px đầu dòng) → đổi 0/1 (histCommit trước/sau, afterEdit), gạch ngang + mờ khi xong.
- Gõ `[] `, `[ ] `, `- [ ] `, `- [x] ` ở đầu dòng → thành dòng checklist. Khi note ở chế độ checklist (đã có ≥1 dòng `data-ck` hoặc mẫu `checklist:true` lúc note trống) thì `- ` cũng thành ô tick.
- Enter trong dòng checklist → dòng mới `data-ck="0"` (không chép trạng thái tick); Enter trên dòng checklist rỗng → bỏ checklist dòng đó. Backspace ở đầu dòng checklist → bỏ ô tick (giữ chữ).
- Kéo đổi thứ tự: tay nắm `⋮⋮` hiện khi rê chuột vào dòng (phần tử nổi ngoài editor, không lưu vào html), kéo bằng pointer events, thả → di chuyển khối, histCommit + afterEdit.
- Đếm `x/y` vào `#ckCount` (ẩn khi không có dòng checklist).
- Menu "Chuyển thành checklist": mọi dòng không rỗng (bỏ tiền tố `- `, `* `, `• `, `[ ] `) thành dòng checklist; nếu đã toàn checklist thì "Bỏ checklist" (trả về dòng thường, giữ chữ).
- Khi tick: `MochiPaperStore.checkItem(id, index, done)` (index = thứ tự trong các dòng checklist, từ 0).
- `textHooks`: chuyển nội dung thành text với dòng checklist dạng `- [ ] chữ` / `- [x] chữ` (để "hiểu note" của phòng notes đọc được).
- Khoá note: không tick, không kéo.

## 6. Bộ chọn mẫu (`src/note/picker.js` + `picker.css`)
- Nút menu `data-act="paper"` → mở `#pickerPanel` (popover chiếm gần hết cửa sổ, cuộn được).
- Hàng tab nhóm (Trơn, Dễ thương, Học sinh, Tối giản, Văn phòng, Mùa & lễ); lưới thumb (`MochiPaper.thumb`); mẫu đang dùng có viền chọn.
- Rê chuột/focus bàn phím vào thumb → `MochiPaperCtl.preview(id)` (xem thử ngay trên note); rời lưới / đóng panel → `preview(null)` (trả về mẫu thật). Bấm → `choose({paper:id})`.
- Phần "Tuỳ chọn": Phông (select, "Theo mẫu" + 7 phông, hiện bằng chính phông đó), Hình dạng (Tự do / Vuông / Chữ nhật đứng / Mini — nút), "Nghiêng nhẹ" (công tắc), "Hiện trang trí" (công tắc), nút "Dùng mẫu này cho note mới" (`setDefault()`), dòng chữ nhỏ cho biết mẫu mặc định hiện tại.
- Bàn phím: mũi tên di chuyển trong lưới, Enter chọn, Esc đóng. Tiếng Việt toàn bộ.

## 7. `window.MochiPaperStore` (`src/note/paperStore.js`) và `window.MochiPaperCtl` (`src/note/paperCtl.js`)
```js
MochiPaperStore = {
  load(id) -> Promise<{meta, settings, persisted: boolean}>, // persisted=false nghĩa là đang dùng localStorage dự phòng
  set(id, patch) -> Promise<meta>, setSettings(patch) -> Promise<settings>,
  resize(id, w, h) -> Promise<boolean>,   // dự phòng: window.resizeTo
  checkItem(id, index, done) -> Promise,  // dự phòng: bỏ qua
  onMeta(cb), onSettings(cb)              // dự phòng: sự kiện 'storage' của localStorage
};
// localStorage: 'mochi.paper.meta.<id>' (JSON NotePaper), 'mochi.paper.settings' (JSON)
MochiPaperCtl = {
  state() -> {meta, settings, paperId, fontId, tilt, deco},
  preview(paperId|null), choose(patch) -> Promise, setDefault() -> Promise, setShape(shape) -> Promise,
  on('change', cb)
};
```
- `paperCtl` nạp khi `MochiNote.on('ready')`, áp mẫu (`MochiPaper.apply(document.body, ...)`), nghe `onMeta/onSettings`, và khi đổi mẫu thì gọi `MochiNote.setColor(def.noteColor)` nếu khác.
- Note 0.1 cũ (không meta) → `plain-<note.color>`. Note đổi màu bằng 7 ô màu → paper `plain-<color>`.
- Dự phòng localStorage: note mới tạo từ chính cửa sổ này (`Ctrl+N`) được gán mẫu mặc định; note mới tạo nơi khác mà chưa có meta, nội dung rỗng và `createdAt` trong 15 giây → cũng gán mẫu mặc định.
- Hình dạng: square 300×300, tall 260×360, mini 220×170 (tối thiểu cửa sổ là 220×160), free = không đổi.

## 8. Dải gợi ý "hiểu note" (`src/note/insight.js` + `insight.css`)
- Chỉ chạy nếu `window.mochi.alarms && typeof window.mochi.alarms.insight === 'function'`; không có → `#insightRow` luôn ẩn.
- Gọi `insight(noteId)` sau khi lưu (nghe `MochiNote.on('note')`, debounce 1.5s). Nhận diện mềm: mảng `suggestions` (hoặc `actions`) mỗi phần tử có `id` và `label`/`title`/`text`. Hiện tối đa 1 dải nhỏ: "Bé thấy 2 việc có giờ — tạo nhắc?" + nút "Tạo" (gọi `applySuggestion(noteId, sid)`) + nút ✕ ẩn (nhớ theo nội dung trong phiên).
- Không bao giờ ném lỗi; khoá note thì ẩn.

## 9. Phân công file (không chồng lấn)
| Mảng | File |
|---|---|
| Phông | `assets/fonts/**` |
| Thú | `assets/paper/deco/animals/**` |
| Đồ trang trí | `assets/paper/deco/items/**`, `assets/paper/deco/README.md` |
| Engine | `src/note/paper.js`, `src/note/paper.css`, `src/note/tools/gallery.html`, `src/note/tools/gallery.js` |
| Mẫu giấy | `assets/paper/<id>/**` (trừ `deco/`), `src/note/tools/build-catalog.js`, `assets/paper/catalog.js` |
| Lưu trữ & điều khiển | `src/main/paper/**`, khối paper trong `src/main/preload.js`, `src/note/paperStore.js`, `src/note/paperCtl.js` |
| Tích hợp | `src/note/note.html`, `src/note/note.js`, `src/note/note.css` |
| Checklist | `src/note/checklist.js`, `src/note/checklist.css` |
| Bộ chọn | `src/note/picker.js`, `src/note/picker.css` |
| Gợi ý | `src/note/insight.js`, `src/note/insight.css` |
