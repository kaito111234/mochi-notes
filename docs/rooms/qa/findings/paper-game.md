# QA lượt 2 — tích hợp paper↔main và game (Phòng của Mochi)

File test: `test/e2e/paper-game.test.js` (12 test). Chạy: `bash test/e2e/run.sh test/e2e/paper-game.test.js`.
Kết quả: **10 xanh, 2 đỏ có chủ ý** (test 1 — xuất/nhập thiếu paper; test 2 — thiếu migration localStorage).

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Chọn 3 mẫu khác nhóm qua UI "…"→"Mẫu giấy…", "Dùng cho note mới", Ctrl+Alt+N, ngăn `paper` trong mochi-data.json | phần ngăn paper + mẫu mặc định + sao lưu: ĐẠT; xuất JSON + nhập lại: **ĐỎ** (N-paper-1) |
| 2 | Migration `mochi.paper.meta.*` → ngăn paper | **ĐỎ** (N-paper-2) |
| 3 | Tick checklist: bus `note:checkItem`, +2 xu/mục, tick-bỏ-tick không cày, counters.checkItems | ĐẠT |
| 4a | Xong note có hẹn (createdAt cũ 10 phút): +15 (10+5 đúng hạn), bé nói `persona:line`; note <2 phút không thưởng | ĐẠT |
| 4b | Note lặp daily: mỗi lần xong +15, note chuyển sang lần kế | ĐẠT |
| 4c | 24 note xong: `today.noteCoins` dừng đúng 300, note thứ 25 → 0 xu | ĐẠT |
| 5 | Ctrl+Alt+G, khay ("Phòng của Mochi…", "Máy gacha"), 5 tab (Tủ đồ, Máy gacha, Cửa hàng, Nhiệm vụ, Thống kê) chữ Việt đúng, gacha 1 lượt −50 xu (+20 lần đầu), đồ vào tủ, mặc/cởi → `game:outfit`, Esc đóng | ĐẠT |
| 6 | Tắt Game hóa (UI): không thưởng, nhắc `reminder:due` đúng giờ, Xong/tick vẫn chạy, bật lại giữ xu, thưởng lại bình thường | ĐẠT |
| 7 | `game` và `paper` hỏng kiểu chuỗi/mảng/số/null: app mở, note gõ+lưu bình thường, game mở được, paper chọn mẫu được, bản hỏng cất vào `mochi-data.section-*.json` | ĐẠT (4 biến thể) |

## Lỗi mới

### N-paper-1 — Xuất/nhập JSON của notes không mang theo mẫu giấy (Vừa)
- Phòng phụ trách: notes (`src/main/notes/transferLogic.js` `buildExportJson` ~dòng 437, `applyNoteMeta` ~dòng 379; `dataTransfer.js` ~dòng 40/111) — phối hợp paper (`src/main/paper`).
- Tái hiện: `bash test/e2e/run.sh test/e2e/paper-game.test.js` (test 1, giai đoạn cuối).
- Kỳ vọng: file xuất `.json` chứa mẫu giấy/phông/hình dạng của từng note (docs/rooms/paper.md "đề xuất 5" mới chỉ nói giữ `data-ck`); nhập vào app sạch thì mẫu còn.
- Thực tế: file xuất chỉ có khoá `app,kind,version,exportedAt,notes,alarms,noteMeta` (noteMeta của alarms: repeat/zoom/locked), không có paper. Nhập lại → `paper.noteMeta` của note mới rỗng, mọi note về mẫu trơn.
- Ảnh: `docs/rooms/qa/img/l2-paper-export-thieu-paper.png` (3 note giấy trước khi xuất). Ghi chú: bản sao lưu `backups/` thì CÓ paper (đạt) vì chép nguyên file.

### N-paper-2 — Chưa có migration localStorage cũ → ngăn paper (Vừa)
- Phòng phụ trách: paper (`src/note/paperStore.js` `load()`; `docs/rooms/paper.md` "Việc tiếp theo 1" tự thừa nhận chưa làm). Điều hành đã nạp `paper` nên cần làm ngay.
- Tái hiện: test 2. Ghi `mochi.paper.meta.<id>` và `mochi.paper.settings` vào localStorage của cửa sổ note, mở lại note.
- Kỳ vọng: lần đầu IPC `paper:get` rỗng mà localStorage có dữ liệu → chuyển vào ngăn `paper` một lần (note còn tồn tại), note hiện mẫu cũ.
- Thực tế: `paper.noteMeta` = {} và `settings.defaultPaper` = null; mẫu cũ bị bỏ, note về mẫu trơn (dữ liệu localStorage vẫn nằm đó, vô dụng). Người dùng đã chọn mẫu ở bản dự phòng (build trước khi nạp paper) mất mẫu.
- Ảnh: `docs/rooms/qa/img/l2-paper-migration-thieu.png`.

## Quan sát (không phải lỗi)
- Thưởng "lần đầu dùng tính năng" (+20) làm xu thực nhận khác con số trong spec (gacha 1 lượt: 200→170, không phải 150). Đúng thiết kế (`API.md` mục 3) nhưng người dùng thấy xu "trừ 30" lần đầu; nên ghi rõ trên máy gacha.
- Test dùng `ctx.notes.completeNote` thay cho bấm "Xong" trên bong bóng bé (cùng đường main→bus `reminder:done`); phần bấm nút trên bé đã có ở reminder.test.js.
- Bấm Esc trên cửa sổ Phòng của Mochi đóng cửa sổ ngay (Playwright báo "Target closed" nếu `await` phím) — hành vi đúng, chỉ cần lưu ý khi viết test.
