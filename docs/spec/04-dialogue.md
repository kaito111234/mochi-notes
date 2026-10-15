# Hợp đồng 04 — Thoại

Kho thoại: `assets/dialogue/vi.json` (mảng). Bộ chọn: `src/shared/dialogue.js` (thuần JS, dùng được ở main và test, không phụ thuộc Electron).

```jsonc
{
  "id": "due.meet.01",
  "event": "due",                 // xem danh sách bên dưới
  "text": "Tới giờ {title} rồi nè! Tớ cầm note lên cho cậu đó.",
  "cond": {                       // tất cả đều tuỳ chọn
    "hour": [8, 11],              // giờ địa phương [từ, đến] bao gồm
    "mode": ["happy", "normal"],
    "intent": ["meet"],           // intent của note (parse.js)
    "energy": [0, 30], "mood": [60, 100], "level": [3, 99],
    "overdue": [1, 99],           // số việc quá hạn
    "weekday": [1, 2, 3, 4, 5]
  },
  "face": "excited",              // khoá trong faces/ hoặc mood sprite
  "anim": "hold_note",            // action gợi ý
  "weight": 1,
  "effects": { "mood": 1 }        // tuỳ chọn, phòng game quyết định có áp dụng không
}
```
Biến thay thế: `{title}`, `{time}`, `{left}` (còn bao lâu), `{label}` (tên báo thức), `{count}`, `{name}` (tên người dùng), `{level}`, `{item}`.

## event
`click`, `pat_head`, `pat_body`, `lift`, `drop`, `idle`, `sleepy`, `wake`, `startup`, `shutdown`, `morning`, `noon`, `evening`, `late_night`, `pre`, `due`, `done`, `done_late`, `snooze`, `nag`, `alarm`, `alarm_stop`, `alarm_snooze`, `memo`, `reward`, `levelup`, `feed`, `hungry`, `gacha_win`, `gacha_dup`, `note_created`.

## Bộ chọn
`pick(lines, event, vars, state, recent)` → `{id, text, face, anim}` hoặc `null`.
Lọc theo `event` + `cond` (bỏ qua điều kiện mà `state` không có), chọn ngẫu nhiên có trọng số, tránh 5 câu dùng gần nhất (`recent`), thay biến. Không có câu hợp lệ → `null` (người gọi dùng câu mặc định).
Main công bố `ctx.persona.pick(event, vars)` (phòng persona) — tự lấy state từ bus (`game:mode`, giờ…).

## Giọng văn
Xưng "tớ", gọi "cậu". Ngại ngùng, dịu dàng, hơi bướng, thích mèo và đồ ngọt (theo bảng nhân vật). Ngắn (≤ 80 ký tự với bong bóng thường, ≤ 120 với nhắc lịch). Không emoji. Nhắc lịch phải rõ việc gì, giờ nào trước khi dễ thương.

## Bổ sung (điều hành chốt sau Đợt 1)
- `cond.weekday`: 0=CN … 6=T7 (như `Date.getDay()`). `cond.hour` không vòng qua nửa đêm — muốn 23h–4h thì tách 2 câu.
- Câu có `cond.intent` khớp intent hiện tại được ưu tiên tuyệt đối so với câu chung.
- `memo` dùng `{title}` = nội dung lời dặn.
- Phân vai: persona tự phát `persona:line` cho tương tác, chào buổi, chatter, done/snooze, alarm_stop/alarm_snooze, reward/levelup, note_created. **Core** khi lên sân khấu cho `alarm/due/pre/memo/nag` gọi `ctx.persona.pick(kind, {title, time, left, label, count, intent})`, `left` dạng "10 phút".
