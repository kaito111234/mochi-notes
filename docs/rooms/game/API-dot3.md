# Phòng game — bổ sung hợp đồng nội bộ Đợt 3

Bổ sung cho `API.md` (Đợt 2). Mọi thứ cũ giữ nguyên trừ khi ghi khác ở đây.

## 1. Thưởng checklist idempotent theo nội dung dòng
- Bus `note:checkItem {noteId, index, done}` (paper) không mang chữ. Game tra `ctx.findNote(noteId)`, lấy chữ dòng checklist thứ `index` theo đúng cách paper đánh chỉ số, chuẩn hoá (bỏ thẻ HTML, gộp khoảng trắng, chữ thường, cắt 200 ký tự) → khoá `chk:<noteId>:t:<hash>` (hash FNV-1a 32-bit, hex).
- Không lấy được chữ → khoá cũ `chk:<noteId>:<index>`.
- Chỉ lần 0→1 đầu tiên của mỗi dòng có thưởng: bỏ tick rồi tick lại, xoá dòng/thêm dòng làm lệch index, kéo đổi thứ tự → không thưởng thêm.

## 2. Đơn vị "xu"
- Mọi chuỗi giao diện/thoại mặc định của game dùng "xu", không dùng "kẹo".
- `game:reward` chỉ phát khi `candy > 0` (để persona không nói "0 xu"); `count` = `candy`. Persona tự nói câu `reward` với `{count}` (câu persona hiện ghi "kẹo" → đề xuất persona đổi).

## 3. Ngăn `game` — trường mới (normalize phải migrate dữ liệu Đợt 2, thiếu → mặc định)
```js
checkin: { cycleDay: 0, lastDay: '', total: 0 },   // cycleDay = số ngày đã điểm danh trong vòng 7 hiện tại (0–6)
inventory.food: { [foodId]: count },                // túi đồ ăn, mỗi món tối đa 99
album: { claimed: { [setId]: at } },
flags: { captureSeen: false },
counters: + tidy, captures, feeds (nếu chưa có)
```

## 4. Điểm danh 7 ngày (logic/checkin.js)
- Bấm "Điểm danh" mỗi ngày một lần (ngày theo giờ máy, như `time.js`). **Không phạt**: bỏ ngày không reset vòng; điểm danh lần kế là ô tiếp theo.
- Phần thưởng ô 1→7: 20 xu · 25 xu · 30 xu + 1 Bánh mochi · 35 xu · 40 xu + 1 Trà sữa trân châu · 50 xu · 100 xu + 1 Bánh dâu. Xong ô 7 → vòng mới (cycleDay về 0). Không tính vào trần 300 xu/ngày của note.
- Đồ ăn thưởng vào túi. Game tắt → không điểm danh được (`reason:'off'`).

## 5. Túi đồ ăn
- `buy(foodId, n)` mua n (1–10) vào túi, trừ xu `price×n`; thiếu xu → `reason:'coins'`; túi đầy (99) → `reason:'full'`.
- `feedBag(foodId)` cho ăn từ túi (giảm 1), cùng hiệu ứng/giảm hiệu quả/thoại/`game:fed` như `buyFeed`. Túi rỗng → `reason:'empty'`.
- `buyFeed` (mua & cho ăn ngay) giữ nguyên.

## 6. Nhiệm vụ tuần đa dạng (3 nhiệm vụ/tuần, tuần bắt đầu thứ Hai)
- Cố định: `weekly.done15` "Xong 15 note", `weekly.tidy3` "Dọn 3 note hết hạn" (đếm `note:trashed`).
- Xoay vòng 1 nhiệm vụ chọn tất định theo khoá tuần (hash) từ: `weekly.check10` "Tick 10 mục checklist", `weekly.feed5` "Cho Mochi ăn 5 lần", `weekly.pat10` "Xoa đầu Mochi 10 lần", `weekly.ontime8` "Xong đúng hạn 8 việc", `weekly.capture3` "Ghi nhanh qua bé 3 lần" (chỉ vào vòng khi `flags.captureSeen`).
- Ghi nhanh qua bé: đếm khi `note:created` có `source` là `'pet'`/`'drop'` (ở payload hoặc `note.source`), hoặc sự kiện `pet:capture`/`pet:captured` (nếu core phát). Thấy lần đầu → `flags.captureSeen = true`.
- Thưởng tuần: 150 xu + 80 exp mỗi nhiệm vụ.

## 7. Album theo bộ
- `catalog.json` thêm `"sets": [{ "id", "name", "reward" }]` cho 9 bộ (`pajama, sport, school, cosplay, party, winter, camping, daily, cat`), tên tiếng Việt.
- Đủ mọi món của bộ → `claimSet(setId)` nhận thưởng một lần (`reward` xu, 100–500 theo độ khó) + mở huy hiệu bộ.

## 8. View — trường mới
```js
checkin: { cycleDay, todayDone, total, rewards: [{ day: 1..7, candy, food?: { id, n } }] },
bag: { [foodId]: count },
album: [{ setId, name, items: [itemId], owned, total, complete, claimed, reward }],
quests.weekly: [{ id, name, progress, goal, claimed, reward }]   // 3 mục
```

## 9. IPC mới (khối preload "PHÒNG game")
```js
checkin: () => inv('game:checkin'),             // -> { ok, reason?, reward: { candy, food? }, view }
buy: (foodId, n) => inv('game:buy', foodId, n), // -> { ok, reason?, view }
feedBag: foodId => inv('game:feedBag', foodId), // -> { ok, reason?, factor, line?, view }
claimSet: setId => inv('game:claimSet', setId), // -> { ok, reason?, reward, view }
```
Lý do lỗi chung: `'off'` (game tắt), `'bad'` (tham số rác), `'coins'`, `'empty'`, `'full'`, `'done'` (đã nhận/đã điểm danh), `'incomplete'`.

## 10. Renderer
- Tab mới `album` (phím 6) — `tabs/album.js|.css`, lớp tiền tố `.al-`.
- Tab Nhiệm vụ: thẻ "Điểm danh 7 ngày" ở đầu; 3 nhiệm vụ tuần.
- Tab Cửa hàng: mỗi món có "Mua" (vào túi, chọn 1/5) và "Mua & cho ăn"; khu "Túi đồ ăn" có nút "Cho ăn" từng món.

## 11. Tắt game hoá
Không phát `game:reward`, `game:levelup`, `game:fed`, `persona:line` của game; không đổi xu/chỉ số; mọi IPC hành động trả `reason:'off'`. Test chứng minh note/nhắc không bị game chạm tới.

## 12. Làm rõ khi hiện thực (backend)
- Nhận diện dòng checklist (`logic/checklist.js`): dòng = phần tử `<div data-ck>` là con trực tiếp của `note.html` (đúng `isCk` trong `src/note/checklist.js`), `index` = vị trí theo thứ tự tài liệu, tính cả dòng đã/chưa tick; `div` lồng trong `ul/li/p...` không tính. Dòng trống hoặc index vượt → khoá cũ `chk:<noteId>:<index>`.
- Mã lý do của 4 action mới là MÃ (`off|bad|coins|empty|full|done|incomplete`), giao diện tự dịch; action cũ giữ câu tiếng Việt.
- Nhiệm vụ xoay vòng chốt lúc đổi tuần (lưu trong `quests.weekly`), nên `captureSeen` bật giữa tuần chỉ ảnh hưởng tuần sau. Dữ liệu Đợt 2 (tuần chỉ có `done15`) được bù thêm 2 mục, giữ tiến độ.
- Ghi nhanh qua bé đếm một lần cho mỗi note (khử trùng `note:created` + `pet:captured` cùng `noteId`). Xoa đầu chỉ tính nhiệm vụ khi còn trong trần 15 lần/ngày.
- Thành tích bộ: `set_first` (50 xu), `set_all` (300 xu). Thưởng bộ có `reason:'set:<id>'`, điểm danh `reason:'checkin'`.
