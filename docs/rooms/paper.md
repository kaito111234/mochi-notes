# Phòng 3 — Giấy & giao diện note (`room/paper`)

**Sứ mệnh**: note của Mochi phải **đẹp và khác Sticky Notes**: như những xấp giấy note dễ thương ngoài đời (giấy lốm đốm, kẻ ngang, ô ly, checklist, có hình thú vẽ tay ở góc), nhiều mẫu để chọn — nhưng vẫn **dùng nhanh, chắc chắn** như Sticky Notes.
Đọc trước: `CLAUDE.md`, `docs/spec/*`, code `src/note/*` (đã có: định dạng chữ, tìm kiếm, undo/redo, ảnh, cỡ chữ, khoá, chip nhắc, panel nhắc — **phải giữ hết**), `docs/rooms/notes/API.md`.
Cảm hứng người dùng gửi: xấp note giấy kem lốm đốm mực, ô vuông, kẻ dòng, checklist ô tick, đầu giấy có chữ "Notes"/"Memo"/"Checklist" viết tay và thú nhỏ (gấu, cún đeo tai nghe, mèo). **Không dùng nhân vật có bản quyền** (Hello Kitty, Sanrio, Disney…) — tự vẽ thú nguyên bản bằng SVG.

## Đợt 2 — việc cần giao
1. **Hệ mẫu giấy** `assets/paper/<id>/paper.json` + SVG/CSS: nền (màu, vân giấy, lốm đốm mực, kraft, pastel gradient), kiểu dòng (trơn, kẻ ngang, ô vuông, ô ly kiểu vở Việt Nam, chấm bi, lề đỏ), tiêu đề in sẵn (Notes / Memo / To do / Checklist / Hôm nay…), trang trí (thú góc giấy, băng dính washi, ghim, kẹp giấy, mép xé, góc gập), màu chữ hợp nền. **Tối thiểu 16 mẫu** chia nhóm: Dễ thương, Học sinh, Tối giản, Văn phòng, Mùa/lễ (Tết, Trung thu, Giáng sinh). Chữ trên giấy phải thẳng hàng với dòng kẻ (line-height khớp lưới).
2. **Bộ chọn mẫu**: trong menu "…" của note (lưới xem trước nhỏ, rê chuột xem thử ngay trên note), mẫu mặc định cho note mới (lưu trong ngăn `paper`, gửi qua `api.paper`). Giữ 7 màu cũ như một nhóm "Trơn".
3. **Thú trang trí nguyên bản** (SVG vẽ tay, nét đậm dễ thương): mèo đen (bé Mochi thích mèo), gấu, thỏ, cún tai nghe, viên mochi, ít nhất 10 hình; tuỳ chọn ẩn trang trí.
4. **Chế độ checklist**: dòng bắt đầu "- [ ]"/"[]"/"-" bật thành ô tick thật (bấm tick, gạch ngang, đếm "3/5"), thêm dòng bằng Enter, kéo đổi thứ tự; tick phát IPC để main phát bus `note:checkItem {noteId, index, done}` (đề xuất cho điều hành nếu cần kênh mới — dùng `api.paper` + `src/main/...` thuộc điều hành thì ghi đề xuất; tạm thời có thể chỉ cập nhật nội dung).
5. **Phông chữ offline** có tiếng Việt, giấy phép OFL, đặt trong `assets/fonts/` (tải từ npm `@fontsource/*` rồi chép file woff2, ghi giấy phép): ít nhất 1 chữ viết tay (Itim/Pangolin/Mali…), 1 chữ tròn (Nunito/Baloo 2), 1 chữ thường (Be Vietnam Pro). Chọn phông theo mẫu, người dùng đổi được.
6. **Hình dạng note**: vuông, chữ nhật đứng, mini (memo nhỏ), bóng đổ giấy thật, xoay nghiêng nhẹ tuỳ chọn. Giữ tuỳ chọn nền kính.
7. **Hiển thị gợi ý từ "hiểu note"** khi phòng notes cung cấp API (xem docs/rooms/notes.md Đợt 2): dải gợi ý nhỏ cuối note ("Bé thấy 2 việc có giờ — tạo nhắc?"); nếu API chưa có thì để sẵn chỗ và kiểm tra `window.mochi.alarms?.insight`.

## Tiêu chí nghiệm thu (ảnh xvfb trong `docs/rooms/paper/`)
- Ảnh lưới 16+ mẫu; 3 note thật trên màn hình ở 3 mẫu khác nhau có chữ tiếng Việt; checklist đang tick; bộ chọn mẫu.
- Mọi chức năng cũ của note vẫn chạy (gõ, định dạng, nhắc lịch, tìm, undo, khoá, ảnh). Note 0.1 cũ mở lên không lỗi (mẫu mặc định = màu cũ).
- Không dùng tài nguyên có bản quyền; ghi nguồn + giấy phép phông chữ trong `assets/fonts/LICENSES.md`.

## Trạng thái
_Cập nhật 2026-10-15 — lượt Đợt 3 (theo tin nhắn phòng điều hành)._ Mục 1–4 của tin nhắn đã làm xong ở lượt 2 (xem bên dưới); lượt này làm phần còn lại:
- **Mẫu ngẫu nhiên cho note mới** (tuỳ chọn): settings `randomPaper: boolean` (mặc định false). Main `paperLogic.pickRandomPaper/metaForNewNote` (rng tham số, test tất định) chọn mẫu thiết kế (bỏ nhóm plain, bỏ `hiddenPapers`, tránh lặp mẫu vừa dùng), hết mẫu → `defaultPaper`. Danh sách mẫu đọc `assets/paper/*/paper.json` lúc khởi động. Bộ chọn: công tắc "Mẫu ngẫu nhiên cho note mới". Test paper 28 ca xanh. Kiểm app thật: 4 note mới ra 4 mẫu khác nhau; tắt → về mặc định.
- **Thanh công cụ nhìn rõ trên mọi mẫu**: thanh định dạng dưới có nền "kính giấy" (màu giấy 88% + blur + viền + bóng), icon màu chữ của mẫu; nút thanh trên có nền đầu giấy ~72%, hiện rõ khi rê/focus; trang trí góc dưới mờ khi gõ/rê thanh. Mẫu plain-* giữ y 0.1. Đã kiểm app thật 5 mẫu (+Mini): mọi nút nằm trên cùng, bấm được.
- **Kiểm tương phản tự động** (`build-catalog --strict`): chữ thân ≥4.5 với mọi màu nền/gradient, icon thanh ≥3 với nền thân và `bg.head`, tiêu đề ≥3. 24 mẫu thiết kế đều đạt (thấp nhất chữ 6.6, tiêu đề 3.9) — không phải chỉnh màu. Mẫu dark: chữ trong vùng tô sáng hiển thị màu tối (chỉ hiển thị).
- **Chữ tránh trang trí góc trên phải**: `paper.js reserveTr` đo hộp bao các hình `tr`, `#editor::before` float phải (≤42% bề rộng) — dòng kẻ vẫn khớp, kể cả zoom.
- Ảnh: `r3-toolbar-grid.png` (31 mẫu, thanh hiện), `r3-toolbar-real.png` (app thật), `r3-random.png`, `paper-grid.png` (chụp lại đủ 31 mẫu). Gallery có ô "Hiện thanh công cụ" (`?bar=1`).
- Còn nhẹ: chưa kiểm riêng checklist + placeholder trên mẫu có hình `tr`; dòng trạng thái "Note mới: ngẫu nhiên (dự phòng: …)" dài, phải cuộn ở panel nhỏ; e2e đỏ còn lại không thuộc paper (như lượt 2).
- Đề xuất thêm cho điều hành: `01-data.md` ghi `paper.settings.randomPaper: boolean` cùng `hiddenPapers`.

_Cập nhật 2026-10-15 (lượt 2 của phòng). Đợt 2 xong từ lượt 1 (tóm tắt cuối mục). Hợp đồng nội bộ: `docs/rooms/paper/DESIGN.md`._

**Lượt 2 — đã xong** (commit trên `room/paper`, `npm test` xanh, `build-catalog --strict` xanh)
1. **Sửa lỗi QA của phòng**: BUG-007 (tô sáng kết hợp đậm/gạch chân mất khi mở lại — sanitizer giữ `background-color` trên B/I/U/S/STRIKE/DEL/MARK/SPAN/FONT; e2e `note-format` 11/11 xanh), BUG-017 (note rỗng mới tự đặt con trỏ), BUG-018 (menu "…" cuộn trong khung, gọn/2 cột ở note thấp — "Xoá note" tới được ở 300×220 và Mini 220×170), BUG-019 (panel nhắc: thân cuộn, hàng nút ghim đáy), BUG-026 (chip: "vừa đến giờ"/"quá hạn vài giây", không hiện giây).
2. **Thùng rác**: xác nhận xoá đổi thành "Chuyển vào thùng rác?" + "Khôi phục được trong 30 ngày ở danh sách note."
3. **Nhiều nhắc/note** (API2 của notes): panel liệt kê từng nhắc (tiêu đề, giờ, lặp, quá hạn) với Xong / Hoãn 10 phút / Sửa (thêm ô "Tên nhắc") / Xoá, "+ Thêm nhắc"; chip nhắc chính thêm "· +N". Hoãn nhắc chưa tới giờ tính từ giờ hẹn (không làm nhắc sớm hơn). Không có `mochi.notes2.setReminderItem` hoặc `reminders[]` → hành vi cũ. CSS mới `src/note/reminders.css`.
4. **Dải gợi ý "hiểu note"** khớp API thật: `mochi.alarms.insight(noteId)` → tối đa 3 nút (co 2/1 nút + "…" ở note hẹp), câu dẫn theo loại gợi ý, bấm → `applySuggestion` → toast `message` → gọi lại; debounce 700ms + `MochiNote.on('note')`; × ẩn tới khi nội dung đổi; note khoá thì tắt checklist/split.
5. **Ẩn/hiện mẫu**: settings `hiddenPapers: string[]` (main `paperLogic.cleanHidden` + renderer, id `/^[a-z0-9-]{1,64}$/`, ≤200, thay cả mảng). Bộ chọn: "Sửa danh sách" → con mắt trên từng ô, "Hiện lại tất cả"; mẫu đang dùng/mặc định luôn hiện; tab hết mẫu thì ẩn. Đã kiểm: khởi động lại vẫn ẩn.
6. **Chuyển dữ liệu localStorage cũ → ngăn `paper`** (`paperStore.migrateLegacy`, chạy trong `load`): không ghi đè meta/settings đã có ở main, idempotent, xoá khoá sau khi chuyển. Đã kiểm trên app thật.
7. **5 mẫu mới** (tổng 31: Trơn 7, Dễ thương 6, Học sinh 4, Tối giản 4, Văn phòng 3, Mùa & lễ 7): `season-summer` "Hè rồi!", `season-birthday` "Sinh nhật", `season-valentine` "Thương", `season-halloween` (mèo đen đội mũ phù thuỷ + bí ngô, không đáng sợ), `cute-rainy` "Mưa rồi" (ếch che ô). 14 SVG trang trí mới nguyên bản (README deco).
8. **Engine**: trang trí góc trên phải tự hạ xuống dưới hàng nút (`--tb-r`), các nút thanh trên luôn nằm trên trang trí — trước đây ô/phong thư/mèo che "…"/× ở nhiều mẫu.

**Đã kiểm tích hợp (nhân viên rà soát chạy app thật xvfb + CDP, 0 lỗi console)**: bộ chọn đủ 31 mẫu, xem thử, chọn, "Dùng cho note mới"; ẩn mẫu bền qua khởi động lại; chuyển dữ liệu cũ; checklist (tick, 1/2, lưu `- [x]`); panel nhắc + Mini; dải gợi ý + toast; gõ Việt, đậm + tô sáng giữ sau khởi động lại, undo/redo, Ctrl+F, zoom, khoá, xoá → thùng rác; note 0.1 hồng trơn y nguyên.
E2E toàn bộ: ca note-format/persist/list xanh. Ca đỏ **không thuộc paper**: `reminder.test.js` 3 ca parse (BUG-009/012, notes), `data.test.js` ca 1 (nhập JSON thêm `reminder.id 'r1'` — migration notes) và 3d (ngăn game mất khi `alarms` hỏng — store/game).

**Ảnh nghiệm thu lượt 2** (`docs/rooms/paper/`): `paper-grid.png` (31 mẫu), `r2-new-papers.png` (5 mẫu mới), `r2-3-notes-picker.png` (3 note: checklist đang tick 2/3, bộ chọn đang mở, kraft), `r2-picker-hide.png`, `r2-reminders.png` (panel 4 nhắc), `r2-reminders-mini.png` (panel ở Mini), `r2-menu-small.png`, `r2-insight.png`.

**Cách chạy thử**: như lượt 1 (gallery `src/note/tools/gallery.html`, trang thử `src/note/tools/*-test.html`); app chạy theo CLAUDE.md — ngăn `paper` nay đã được main nạp, không cần sửa tạm `main.js`.

**Chưa kiểm được / đang dở**
- Chưa thử trên Windows thật (nền kính + mẫu giấy, phông, IME Telex/VNI khi gõ `[] `).
- Gợi ý loại `remind`/`remind-all`/`alarm` chưa thấy trên app thật (nhắc tự động của notes đã lọc hết) — chỉ kiểm bằng trang thử.
- Bộ chọn mẫu phủ gần hết note nhỏ nên khó thấy bản xem thử khi rê (nhẹ); trang trí góc trên phải nay hơi chồng chữ dòng đầu bên phải (chữ vẫn nằm trên, đọc được).
- Mép xé/góc gập/nghiêng thật vẫn chờ cửa sổ trong suốt (đề xuất 4).

**Việc tiếp theo cụ thể**
1. Bộ chọn: khi rê xem thử thì làm mờ/thu popover (hoặc mở popover ở chế độ "nhỏ gọn" dạng dải ngang dưới đáy) để thấy note.
2. Engine: dành lề phải dòng đầu (padding) khi có trang trí `tr` để chữ không chồng trang trí.
3. Thêm mẫu Tết Trung thu thiếu nhi/ khai giảng/ 20-11; cho phép người dùng chọn thú trang trí riêng (đổi thú trên mẫu).
4. Khi notes sửa xong migration `reminder.id`, chạy lại `data.test.js`.

**Vướng mắc**: không.

_Tóm tắt lượt 1 (Đợt 2)_: hệ mẫu giấy `assets/paper/<id>/paper.json` → `assets/paper/catalog.js` (kiểm schema + WCAG), engine `paper.js/.css` (dòng kẻ khớp line-height kể cả zoom), bộ chọn `picker.js`, 12 thú + 16 đồ SVG nguyên bản, checklist `checklist.js` (lưu `- [ ]`/`- [x]`, bus `note:checkItem`), 6 phông OFL tiếng Việt (`assets/fonts/LICENSES.md`), hình dạng Tự do/Vuông/Đứng/Mini + nghiêng + bóng; per-note lưu ở `paper.noteMeta`, note 0.1 → `plain-<màu>`.

## Đề xuất cho phòng điều hành
1. ~~Nạp module `paper` trong `main.js`~~ — đã gộp. ~~Ownership `src/main/paper/**`, ngăn `paper` trong 01-data, sự kiện `note:checkItem` trong 02-events~~ — đã có.
2. `docs/spec/01-data.md`: thêm `paper.settings.hiddenPapers: string[]` (mặc định `[]`) và `paper.settings.randomPaper: boolean` (mặc định false).
3. Phòng notes (`noteWindows.js`): tuỳ chọn cửa sổ note trong suốt (`transparent: true`, nền do renderer vẽ) để mép xé/góc gập/nghiêng/bóng đổ thật; `backgroundColor` lúc mở theo màu mẫu.
4. Phòng notes (`transferLogic.js` sanitizer khi nhập): giữ `data-ck="0|1"` trên DIV/LI để nhập/xuất không mất ô tick (chưa làm).
5. Phòng notes: `snoozeItem` khi nhắc chưa tới giờ nên tính từ `max(due, now)` (paper đã tự bù ở renderer; nên sửa gốc để bé/toast cũng đúng). IPC kẹp 7 ngày.
6. Phòng game (nếu thưởng checklist): thưởng idempotent theo noteId + nội dung dòng, chỉ lần 0→1 đầu tiên.
