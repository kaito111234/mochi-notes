# Hợp đồng 01 — Dữ liệu

Một file `userData/mochi-data.json` (`version: 2`), ghi nguyên tử, sao lưu mỗi ngày vào `userData/backups/` (giữ 7 bản; không sao lưu file hỏng). API: `ctx.store`.
- `store.data.notes`, `store.data.settings` — có sẵn từ 0.1 (xem `SPEC.md`).
- **Ngăn của phòng**: `const box = ctx.store.section(name, defaults, normalize)` trả về object sống; sửa trực tiếp rồi `ctx.store.save()`. `normalize(stored)` phải chịu được dữ liệu cũ/thiếu (migrate) và ném lỗi nếu hỏng hẳn (khi đó dùng `defaults()`).
- Ngăn không ai đăng ký vẫn được giữ nguyên khi ghi (không mất dữ liệu giữa các phiên bản).
- Cài đặt riêng của phòng để trong ngăn của phòng (`box.settings`), không thêm khóa vào `store.data.settings`.

## Ngăn đã đặt tên
| Ngăn | Chủ | Nội dung tối thiểu |
|---|---|---|
| `alarms` | notes | `{ list: Alarm[], memos: Memo[], missed: {alarmId,label,at}[] /*tối đa 50*/, sounds: {soundFile,name}[], noteMeta: { [noteId]: {repeat?: Repeat\|null, zoom?: number, locked?: boolean} }, settings: {...} }` |
| `paper` | paper | `{ v: 1, settings: { defaultPaper: null\|string, defaultFont: null\|string, hideDeco: false, tilt: false }, noteMeta: { [noteId]: NotePaper } }` |
| `pet` | core | `{ x, y, displayId, posture, settings: { alwaysVisible, scale, walkEnabled } }` |
| `game` | game | `{ stats: PetStats, inventory, quests, achievements, log: [] }` |
| `persona` | persona | `{ recentLines: string[], name, settings: {...} }` |

```ts
// notes
interface Alarm {
  id: string; label: string;
  time: string;              // "HH:MM" giờ địa phương
  repeat: Repeat | null;     // null = một lần (dùng date)
  date?: string;             // "YYYY-MM-DD" cho báo thức một lần
  enabled: boolean;
  sound: 'chime' | 'bell' | 'soft' | 'custom'; soundFile?: string;
  snoozeMin: number;         // mặc định 10
  noteId?: string;           // gắn với note (tuỳ chọn)
  nextAt: number | null;     // epoch ms lần kêu kế tiếp (tính sẵn, nguồn sự thật cho bộ hẹn giờ)
  lastFiredAt?: number;
  createdAt: number;         // epoch ms lúc tạo
  snoozedUntil?: number;     // epoch ms hết hoãn (đang hoãn)
}
interface Repeat { freq: 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly'; interval?: number; byDay?: number[] /*0=CN*/; byMonthDay?: number; anchor?: number /*epoch ms mốc tính lặp, dùng cho hourly*/ }
interface Memo {             // "dặn dò": bé nói khi tới thời điểm, không cần giờ chính xác
  id: string; text: string;
  when: 'startup' | 'morning' | 'noon' | 'evening' | 'before-shutdown';
  days?: number[]; enabled: boolean; lastShownDay?: string; once?: boolean;
}
// Note.reminder (0.1) được mở rộng thêm: repeat?: Repeat | null — khi bấm Xong/đã báo, tính lần kế tiếp.
// store.normalizeReminder giữ `repeat` bằng alarms/box.js normRepeat (bản sao lưu cũng có lặp).

// paper (chi tiết: docs/rooms/paper/DESIGN.md mục 1)
interface NotePaper {
  paper?: string;   // id mẫu giấy; thiếu => 'plain-' + note.color
  font?: string;    // id phông; thiếu => phông của mẫu
  shape?: 'free' | 'square' | 'tall' | 'mini';
  tilt?: boolean;   // thiếu => settings.tilt
  deco?: boolean;   // false = ẩn trang trí; thiếu => !settings.hideDeco
}

// Note (store.data.notes) — nhiều nhắc/note (docs/rooms/notes/API2.md mục 3)
interface Reminder {         // như 0.1 + các trường mới
  id: string;                // 'r1', 'r2'… duy nhất trong note
  due: number; lead: number; intent: string; auto: boolean; preFired: boolean; fired: boolean; done: boolean;
  repeat?: Repeat; title?: string; key?: string; line?: number;
}
// Note.reminders: Reminder[]  — NGUỒN SỰ THẬT, tối đa 20, sắp theo due tăng dần
// Note.reminder: Reminder|null — primary (cùng tham chiếu trong bộ nhớ), giữ cho code/bản 0.1; ghi ra file cả hai
// Note.remindMuted: string[]  — key các nhắc tự động người dùng đã xoá (không tự tạo lại), tối đa 50
// normalizeNote migrate: chỉ có `reminder` => reminders=[{...reminder, id:'r1'}].

// game
interface PetStats {
  energy: number;     // 0-100, giảm theo giờ thức, hồi khi bé ngủ / máy rảnh
  mood: number;       // 0-100
  affection: number;  // 0-∞ (ẩn), level thân mật suy ra
  candy: number; exp: number;   // level = floor(sqrt(exp)/10)+1
  streak: { count: number; lastDay: string };
}
```
Mode tâm trạng (dùng cho hình & thoại) do phòng game tính và phát qua bus: `'happy' | 'normal' | 'tired' | 'sad'`. Không có "ốm/chết".

## Chống mất dữ liệu (store.js)
- File chính hỏng → cất bản hỏng thành `mochi-data.corrupt-YYYYMMDD-HHMMSS.json` (giữ tối đa 5), nạp bản `backups/` hợp lệ mới nhất rồi đặt lại file chính. `store.recoveredFrom` (đường dẫn bản đã dùng; null nếu không có) và `store.corruptCopy` để `main.js` báo người dùng bằng thông báo Windows.
- Ngăn mà `normalize` ném lỗi → cất nguyên bản vào `mochi-data.section-<tên>-YYYYMMDD-HHMMSS.json` rồi mới dùng mặc định.
- `settings`: khoá lạ (ngoài `DEFAULT_SETTINGS`) được giữ nguyên khi ghi lại.
- `settings.noteTransparent` (boolean, mặc định false): cửa sổ note trong suốt (notes, Đợt 3).
