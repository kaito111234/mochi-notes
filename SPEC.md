# Mochi Notes — app desktop Windows (Electron 33)

Sticky note kiểu Windows Sticky Notes + trợ lý ảo (bé Mochi) tự hiện đè lên mọi ứng dụng khi gần tới giờ.
Ngôn ngữ giao diện: **tiếng Việt**. Không dùng emoji trong giao diện; icon là SVG inline (stroke, 24x24, currentColor).
Không có mạng: không dùng CDN/Google Fonts. Font: `"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif`.

## Cấu trúc thư mục (mỗi agent chỉ sửa phần của mình)
```
package.json                 (điều phối viên)
src/shared/parse.js          (điều phối viên — ĐỌC, KHÔNG SỬA) UMD: require() ở main, <script src="../shared/parse.js"> -> window.MochiParse
src/main/preload.js          (điều phối viên — ĐỌC, KHÔNG SỬA) định nghĩa window.mochi và TÊN KÊNH IPC
src/main/main.js, store.js, scheduler.js   (agent MAIN)
src/note/note.html|css|js    (agent NOTE)
src/mascot/mascot.html|css|js (agent MASCOT)
src/list/list.html|css|js    (agent LIST)
assets/mascot/manifest.json + *.png  (điều phối viên) sprite bé
assets/tray.png (32x32), assets/icon.png (256x256)  (điều phối viên)
```
Mọi HTML: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'">` — KHÔNG inline script (dùng file .js riêng), không inline event handler (onclick=...).
Renderer chạy với `contextIsolation:true, nodeIntegration:false, sandbox:true`, chỉ dùng `window.mochi` (xem preload.js) và `window.MochiParse`.

## Dữ liệu (main lưu ở `app.getPath('userData')/mochi-data.json`)
```ts
type Color = 'yellow'|'green'|'pink'|'purple'|'blue'|'gray'|'charcoal';
interface Reminder {
  due: number;        // epoch ms
  lead: number;       // ms báo trước (0 = chỉ báo đúng giờ)
  intent: string;     // khoá intent từ parse.js (meet, call, due, ...)
  auto: boolean;      // true = tự hiểu từ nội dung; false = người dùng đặt tay
  preFired: boolean;  // đã báo trước
  fired: boolean;     // đã báo đúng giờ
  done: boolean;      // người dùng bấm Xong
}
interface Note {
  id: string;         // 'n_' + Date.now().toString(36) + random
  html: string;       // nội dung rich text (contenteditable innerHTML, đã lọc)
  text: string;       // bản chữ thuần (innerText) — dùng để parse + tìm kiếm
  color: Color;
  bounds: {x:number,y:number,width:number,height:number};
  visible: boolean;   // đang dán trên màn hình hay đang cất
  alwaysOnTop: boolean;
  reminder: Reminder | null;
  createdAt: number; updatedAt: number;
}
interface Settings {
  mascotEnabled: boolean;   // true: bé hiện ra nhắc; false: dùng thông báo Windows
  mascotIdle: boolean;      // true: bé luôn ngồi góc màn hình (mặc định false)
  sound: boolean;           // true
  glass: boolean;           // true: nền kính acrylic Windows 11; false: nền đặc
  startup: boolean;         // khởi động cùng Windows (false)
  allHidden: boolean;       // trạng thái "ẩn tất cả"
}
interface MascotEvent {
  type: 'pre'|'due'|'nag'|'hello'|'idle'|'leave';
  note?: { id:string; title:string; text:string; color:Color; due:number|null; lead:number; intentLabel:string };
  overdueCount?: number;    // cho 'nag'
  settings: Settings;
}
```
`title` = dòng đầu tiên không rỗng của text (tối đa 80 ký tự).

## Quy tắc reminder (main thực hiện)
- `updateNote(id,{html,text})`: nếu `reminder==null || reminder.auto` → `MochiParse.analyze(text)`. Có `due > now` → reminder mới `{due,lead,intent,auto:true,preFired: lead>0 && now>=due-lead, fired:false, done:false}` (giữ nguyên reminder cũ nếu `due` không đổi). Không có → `reminder=null` (chỉ khi reminder đang auto).
- `setReminder(id,{due,lead})` → auto=false; `null` → xoá.
- Bộ hẹn giờ mỗi 1 giây: với reminder chưa done: `!preFired && lead>0 && now>=due-lead && now<due` → sự kiện `pre`; `!fired && now>=due` → sự kiện `due` (đặt preFired=fired=true). Sự kiện xếp hàng, mỗi lúc chỉ hiện 1.
- Note bị ẩn (visible=false) **vẫn được nhắc**.
- Quá hạn chưa xong: mỗi 15 phút gửi `nag` (nếu có ≥1 note quá hạn >10 phút và bé đang rảnh).
- `snooze(id,m)`: due=now+m phút, fired=false, preFired=true, done=false.
- `markDone`: done=true.

## Cửa sổ
- **Note**: mỗi note một BrowserWindow `frame:false`, `minWidth 220 minHeight 160`, mặc định 300x320, `skipTaskbar:true`, resizable. Trên Windows 11 (`process.platform==='win32'`) và settings.glass: `backgroundMaterial:'acrylic', backgroundColor:'#00000000'`; ngược lại `backgroundColor` = màu note. Mở bằng `src/note/note.html?id=<id>`. Lưu bounds khi move/resize (debounce 400ms). Cửa sổ mới tạo lệch +32px so với note gọi nó (nearId).
- **Bé Mochi**: 1 BrowserWindow trong suốt `transparent:true, frame:false, resizable:false, skipTaskbar:true, focusable:false, hasShadow:false`, kích thước 440x520, `setAlwaysOnTop(true,'screen-saver')`, `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})`, `setIgnoreMouseEvents(true,{forward:true})` mặc định; renderer gọi `setIgnoreMouse(false)` khi chuột vào vùng bấm được. Đặt ở **góc dưới phải workArea** của màn hình đang có con trỏ (đáy cửa sổ = đáy workArea, cách mép phải 8px). Hiện bằng `showInactive()` (không cướp focus). Ẩn khi renderer gọi `mascotAction('dismiss')` (trừ khi settings.mascotIdle → giữ lại, gửi `idle`).
- **Danh sách**: 1 cửa sổ 420x600 có khung `frame:false` (tự vẽ thanh tiêu đề, kéo bằng `-webkit-app-region: drag`), `src/list/list.html`.

## Khay hệ thống & phím tắt (main)
Tray (assets/tray.png), tooltip "Mochi Notes". Menu: Note mới · Hiện tất cả note · Ẩn tất cả note · Danh sách note · Gọi bé ra · (checkbox) Bé ngồi góc màn hình · (checkbox) Âm thanh · (checkbox) Nền kính · (checkbox) Khởi động cùng Windows · Thoát. Bấm đúp icon khay = mở danh sách.
Phím tắt toàn cục: `Ctrl+Alt+N` note mới · `Ctrl+Alt+H` ẩn/hiện tất cả · `Ctrl+Alt+L` danh sách · `Ctrl+Alt+M` gọi bé.
Single instance (mở lần 2 = mở danh sách). Đóng mọi cửa sổ không thoát app (chỉ thoát từ khay).
Lần chạy đầu: tạo 2 note mẫu — (1) màu vàng, nội dung hướng dẫn ngắn (phím tắt, gõ giờ tự nhiên); (2) màu hồng "Uống nước nè, 1 phút nữa" (tự parse → bé hiện sau 1 phút).
