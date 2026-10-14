# Hợp đồng 01 — Dữ liệu

Một file `userData/mochi-data.json` (`version: 2`), ghi nguyên tử, sao lưu mỗi ngày vào `userData/backups/` (giữ 7 bản). API: `ctx.store`.
- `store.data.notes`, `store.data.settings` — có sẵn từ 0.1 (xem `SPEC.md`).
- **Ngăn của phòng**: `const box = ctx.store.section(name, defaults, normalize)` trả về object sống; sửa trực tiếp rồi `ctx.store.save()`. `normalize(stored)` phải chịu được dữ liệu cũ/thiếu (migrate) và ném lỗi nếu hỏng hẳn (khi đó dùng `defaults()`).
- Ngăn không ai đăng ký vẫn được giữ nguyên khi ghi (không mất dữ liệu giữa các phiên bản).
- Cài đặt riêng của phòng để trong ngăn của phòng (`box.settings`), không thêm khóa vào `store.data.settings`.

## Ngăn đã đặt tên
| Ngăn | Chủ | Nội dung tối thiểu |
|---|---|---|
| `alarms` | notes | `{ list: Alarm[], memos: Memo[], settings: {...} }` |
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
}
interface Repeat { freq: 'daily' | 'weekdays' | 'weekly' | 'monthly'; interval?: number; byDay?: number[] /*0=CN*/; byMonthDay?: number }
interface Memo {             // "dặn dò": bé nói khi tới thời điểm, không cần giờ chính xác
  id: string; text: string;
  when: 'startup' | 'morning' | 'noon' | 'evening' | 'before-shutdown';
  days?: number[]; enabled: boolean; lastShownDay?: string; once?: boolean;
}
// Note.reminder (0.1) được mở rộng thêm: repeat?: Repeat | null — khi bấm Xong/đã báo, tính lần kế tiếp.

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
