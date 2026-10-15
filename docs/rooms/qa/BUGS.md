# Danh sách lỗi — phòng QA (Đợt 2, lượt 1, 2026-10-15)

Môi trường: Linux xvfb 1440x900, `--disable-gpu`, Electron 33, TZ `Asia/Ho_Chi_Minh`, nhánh `main` @ f84c7b4.
Chi tiết từng nhóm (bước đầy đủ, file:dòng, số liệu): `docs/rooms/qa/findings/<nhóm>.md`. Mã gốc `F-<nhóm>-N` ghi trong cột "Gốc".
Lỗi Chặn/Nặng dưới đây **trưởng phòng QA đã tự tái hiện** (lệnh ghi kèm).

Mức: **Chặn** = mất dữ liệu / nhắc lịch không báo / app không dùng được · **Nặng** = tính năng chính hỏng hoặc nhắc sai giờ · **Vừa** = sai một phần, khó dùng · **Nhẹ** = chữ, thẩm mỹ.

Tổng: **0 Chặn · 8 Nặng · 14 Vừa · 9 Nhẹ** (31 lỗi). Theo phòng chính: notes 16 · paper 5 · core 4 · điều hành 6.

## Ưu tiên (sửa theo thứ tự)

| Mã | Mức | Phòng | Tóm tắt | Gốc |
|---|---|---|---|---|
| BUG-001 | Nặng | điều hành | File dữ liệu hỏng → app mở với 0 note, không dùng bản sao lưu gần nhất, không báo người dùng | F-data-1 |
| BUG-002 | Nặng | notes | Số thường bị hiểu thành giờ/ngày → nhắc rác: "500g" → 00:00, "3/4", "1/2", "50-60k" → ngày (2027, 2031) | F-unit-2, F-unit-3 |
| BUG-003 | Nặng | notes | "thứ 6 tuần sau 10h30" → hiểu thành "6 tuần nữa" (26/11 10:00, mất cả phút) | F-reminder-1, F-unit-1 |
| BUG-004 | Nặng | notes | Giờ đêm sai 12 tiếng: "0h", "12h đêm" → 12:00 trưa; "2h đêm" → 14:00 | F-unit-4 |
| BUG-005 | Nặng | notes | "1h30 nữa họp" → 13:30 (hiểu là giờ đồng hồ) thay vì +1 giờ 30 phút | F-unit-5 |
| BUG-006 | Nặng | notes | Không có thùng rác: xoá note là mất hẳn, không khôi phục từng note | F-list-1 |
| BUG-007 | Nặng | paper | Tô sáng kết hợp đậm/gạch chân/gạch ngang mất màu sau khi mở lại app | F-note-format-1 |
| BUG-008 | Nặng | điều hành | File hỏng lần 2 ghi đè `.bak` của lần 1 → mất bản hỏng đầu tiên (nguồn cứu dữ liệu duy nhất ngoài backups) | F-data-2 |
| BUG-009 | Vừa | notes | "nửa tiếng nữa", "1 tiếng rưỡi nữa", "sau 5 phút" không tạo nhắc | F-reminder-2, F-unit-5 |
| BUG-010 | Vừa | notes | Gõ không dấu không hiểu ("hop 3h chieu nay", "goi khach 2 phut nua", "thu 6 10h30") | F-unit-7 |
| BUG-011 | Vừa | notes | Từ thường bị đọc thành giờ: "tối ưu" → 20:00, "chiều dài" → 15:00, "năm nay", "16:9" | F-unit-6 |
| BUG-012 | Vừa | notes | "họp 3h chiều nay" gõ lúc đã quá 15h → im lặng, không chip, không báo | F-reminder-3 |
| BUG-013 | Vừa | notes + core | Cửa sổ chuông báo thức (360x236, góc dưới phải) che ~60% bé và bong bóng; nút trên bong bóng bé bị che | F-alarm-memo-1, F-ux-3 |
| BUG-014 | Vừa | core | Tờ "Dặn dò" bé cầm hiện "NaN:NaN · undefin…" (`stage.js` coi `when` là mốc giờ, thực tế là 'startup'/'evening') | F-ux-1, F-alarm-memo-2 |
| BUG-015 | Vừa | notes + core | Popup dặn dò đè bong bóng bé; hai khung nói cùng một câu | F-ux-2, F-alarm-memo-3 |
| BUG-016 | Vừa | core | Tờ note bé cầm bị cắt ở mép phải màn hình | F-ux-4 |
| BUG-017 | Vừa | paper | Note mới (Ctrl+Alt+N / nút +) không đặt con trỏ vào vùng soạn — phải bấm mới gõ được | F-note-persist-1 |
| BUG-018 | Vừa | paper | Menu "..." bị cắt ở note nhỏ (300x220 thấy 4/11 mục; "Xoá note" phải cuộn) | F-ux-6 |
| BUG-019 | Vừa | paper | Panel "Nhắc lịch" ở note nhỏ: nút Lưu / Tắt nhắc / Xong nằm ngoài khung | F-ux-7 |
| BUG-020 | Vừa | notes | "Hiện tất cả" 30 note mất 4–7 s, chặn main 0,5–1 s (tạo cửa sổ đồng bộ) | F-perf-2 |
| BUG-021 | Vừa | điều hành | 30 note = 30 tiến trình renderer: RSS 3,6 GB (PSS 0,6 GB) — cần đo trên Windows | F-perf-1 |
| BUG-022 | Vừa | điều hành | Ngăn dữ liệu sai kiểu (vd `alarms` là chuỗi) bị thay mặc định và ghi đè, không giữ bản gốc | F-data-3 |
| BUG-023 | Nhẹ | core / persona | Câu thoại không khớp intent: note "Gọi điện" nhận câu loại `go`; `varsFor` (stage.js:98-111) không đặt `intent` | F-ux-5 |
| BUG-024 | Nhẹ | core / notes | CPU rảnh 3–4% một nhân kể cả 1 note; 15,7% trong 30 s sau 30 nhắc | F-perf-3 |
| BUG-025 | Nhẹ | notes | Chip "gọi khách 2 phút nữa" ghi "báo trước 5 phút" khi hạn chỉ còn 2 phút | (reminder, ghi chú) |
| BUG-026 | Nhẹ | paper | Chip nhắc ghi "quá hạn 0 giây"/"1 giây" | F-ux-12 |
| BUG-027 | Nhẹ | notes | Từ "Đang dán / Đang cất", "Cất/Dán" khó hiểu; nút X không nói note vẫn còn trong danh sách | F-ux-8 |
| BUG-028 | Nhẹ | notes / persona | Xưng hô lẫn "bạn/cậu/mình/tớ" (note mẫu "mình là Mochi Notes", bé xưng "tớ") | F-ux-10 |
| BUG-029 | Nhẹ | notes | Bảng phím tắt trong Cài đặt thiếu Ctrl+F, Z/Y, Shift+K, zoom; nút "Ở lại" ở popup dặn dò khó hiểu; ghim xanh dễ nhầm "luôn nổi" | F-ux-9, F-ux-11 |
| BUG-030 | Nhẹ | điều hành / core | "Hoãn 10 phút" viết cứng (stage.js:257, lines.js:58) dù Cài đặt có "Hoãn mặc định"; tiêu đề cửa sổ "Mochi Note" ≠ "Mochi Notes" | F-ux (soát chuỗi) |
| BUG-031 | Nhẹ | điều hành / notes | `store.js` bỏ trường lạ trên note/reminder/settings khi nạp rồi ghi lại (ngăn lạ cấp cao thì giữ) | F-unit-8, F-data-4 |

## Chi tiết lỗi Nặng

### BUG-001 — File dữ liệu hỏng: mở ra trống trơn, bỏ qua bản sao lưu
- Mức: Nặng (chưa mất ngay vì file hỏng còn ở `.bak` và `backups/`, nhưng người dùng thấy mất hết note; bản tốt bị đẩy khỏi `backups/` sau 7 ngày → thành mất thật). Phòng: điều hành (`src/main/store.js`).
- Tái hiện: có `backups/mochi-data-<hôm qua>.json` hợp lệ; ghi `mochi-data.json` = `{"notes":[{"id":` → mở app.
- Kỳ vọng: nạp bản sao lưu gần nhất hợp lệ, báo "Dữ liệu bị hỏng, đã khôi phục bản ngày …".
- Thực tế: 0 note, không thông báo; file mới ghi đè bằng dữ liệu rỗng.
- Nguyên nhân: `store.js:95-101` khối `catch` chỉ đổi tên sang `.bak` rồi dùng mặc định.
- Test: `bash test/e2e/run.sh test/e2e/data.test.js` (ca 3b đỏ). QA tái hiện tay bằng electron + XDG tạm: xác nhận.
- Ảnh: `img/data-hong-co-backup-mat-note.png`

### BUG-002 — Số thường thành nhắc rác
- Phòng: notes (`src/shared/parse.js`: regex giờ ~dòng 62 thiếu biên trái, nhận `g` là "giờ"; ngày `a/b`, `a-b` không kiểm phạm vi).
- Tái hiện: gõ note "Đi chợ: mua 500g thịt, 3/4 kg cà chua" → chip "00:00 · T7 03/04 · báo trước 30 phút", bé nói "Tớ ghi đồ cần mua rồi". `node -e` dưới: "mua 500g thịt" → 12:00 hôm nay; "giá 50-60k" → 19/01/2031.
- Kỳ vọng: không tạo nhắc. Thực tế: nhắc sai, bé nhảy ra lúc vô lý.
- Ảnh: `img/bug-500g-thanh-nhac.png`

### BUG-003 — "thứ N tuần sau"
- Phòng: notes (`parse.js` ~40-46: mẫu tương đối "N tuần sau" khớp trước thứ trong tuần).
- "thứ 6 tuần sau 10h30 họp" (hôm nay T5 15/10) → 26/11 10:00. Kỳ vọng T6 23/10 10:30. Tương tự "thứ 2/5 tuần sau".
- Ảnh: `img/reminder-chip-t6-sai.png`

### BUG-004 — Giờ đêm lệch 12 tiếng
- Phòng: notes (`parse.js` ~76-84 cộng 12 cho "đêm/khuya" kể cả 12h và 0–4h).
- "0h" → 12:00; "12h đêm" → 12:00 trưa; "2h đêm" → 14:00; "nửa đêm" → không hiểu. Kỳ vọng 00:00 / 00:00 / 02:00 hôm sau.

### BUG-005 — "1h30 nữa"
- Phòng: notes. "1h30 nữa họp" lúc 10:00 → 13:30 (kỳ vọng 11:30).

Lệnh tái hiện chung BUG-002…005:
```
node -e "const P=require('./src/shared/parse.js');const n=new Date(2026,9,15,10).getTime();for(const t of ['thứ 6 tuần sau 10h30 họp','mua 500g thịt','đọc 3/4 cuốn sách','giá 50-60k','0h','12h đêm','2h đêm','1h30 nữa họp']){const r=P.analyze(t,n);console.log(t,'=>',r&&r.due?new Date(r.due).toString().slice(0,21):null)}"
```
Bộ đầy đủ ~100 câu: `node test/unit/run.js` (29 ca parse đỏ).

### BUG-006 — Không có thùng rác
- Phòng: notes (`noteService.js:108-116` `deleteNote` splice thẳng; `src/note/note.html:98` "không khôi phục được").
- Yêu cầu nghiệm thu có "xoá + khôi phục từ thùng rác/thùng của bé". Xoá nhầm chỉ còn cách khôi phục cả bản sao lưu.
- Kỳ vọng: xoá → vào thùng rác (giữ ≥30 ngày), khôi phục từ danh sách (hoặc "thùng của bé"); có "Hoàn tác" ngay sau khi xoá.
- Test: `list.test.js` ca 3c đỏ. Ảnh: `img/bug-xoa-khong-khoi-phuc.png`

### BUG-007 — Tô sáng mất khi mở lại
- Phòng: paper (`src/note/note.js:44-51` `cleanInto` chỉ giữ `background-color` trên SPAN/MARK; Chromium đặt style lên `<b>/<u>/<strike>` trong cùng).
- Tái hiện: gõ chữ → Ctrl+A → Ctrl+B → Ctrl+U → Ctrl+Shift+H → chờ lưu → thoát → mở lại: hết màu.
- Test: `note-format.test.js` ca 1c đỏ (QA chạy lại: đỏ). Ảnh: `img/note-format-to-sang-mat.png`

### BUG-008 — `.bak` bị ghi đè
- Phòng: điều hành (`store.js:98` `renameSync(file, file+'.bak')` không giữ bản cũ). Đề xuất `.bak-<thời gian>` giữ vài bản.
- Test: `data.test.js` ca 3c đỏ.

## Không phải lỗi (đã kiểm)
- Note vàng mẫu "trống" trong ảnh khói: chụp quá sớm, nội dung có đủ (`img/note-persist-note-mau.png`).
- Gõ tiếng Việt (dựng sẵn, NFD dán vào, IME insertText, thay ký tự): đúng. Mở lại giữ nội dung/vị trí/kích thước/màu.
- Kill -9: mất chữ chỉ khi kill < ~0,8 s sau khi gõ (2 lớp debounce); file luôn là JSON hợp lệ.
- Nhắc lịch tới giờ, Xong/Hoãn/Mở note, note cất vẫn nhắc, lặp "mỗi sáng 8h", thông báo dự phòng khi tắt bé, 2 nhắc cùng lúc, 30 nhắc cùng lúc: đúng.
- Báo thức 1 phút, hoãn, kêu bù ≤30 phút/"Đã lỡ", dặn dò khi mở máy, nhập/xuất JSON/.txt/.md, khôi phục sao lưu, giữ 7 bản: đúng.
