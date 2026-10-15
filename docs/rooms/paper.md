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
_Cập nhật 2026-10-15 (lượt 1 của phòng)._ Hợp đồng nội bộ: `docs/rooms/paper/DESIGN.md`.

**Đã xong (cả 7 việc Đợt 2)**
1. **Hệ mẫu giấy**: 19 mẫu thiết kế + 7 mẫu "Trơn" (= 7 màu cũ) — Dễ thương 5, Học sinh 4 (có ô ly vở VN, lề đỏ), Tối giản 4 (có kraft, nền tối), Văn phòng 3 (MEMO, To do, legal pad mép xé), Mùa & lễ 3 (Tết, Trung thu, Giáng sinh). `assets/paper/<id>/paper.json` → `node src/note/tools/build-catalog.js [--strict]` sinh `assets/paper/catalog.js` (kiểm schema + tương phản WCAG). Engine `src/note/paper.js/.css`: nền (màu/gradient/lốm đốm/vân/kraft), dòng kẻ cuộn theo chữ, line-height = bước lưới (khớp cả khi zoom), tiêu đề in sẵn, trang trí, mép xé, góc gập, bóng mép giấy. Mẫu trơn = y hệt 0.1.
2. **Bộ chọn mẫu** (`picker.js`): menu "…" → "Mẫu giấy…": tab nhóm, lưới xem trước, rê chuột xem thử ngay trên note, phông, hình dạng, nghiêng nhẹ, ẩn/hiện trang trí, "Dùng cho note mới". 7 ô màu cũ giữ nguyên (chọn = mẫu trơn).
3. **Thú nguyên bản**: 12 thú SVG (mèo đen ×3, gấu, thỏ, cún tai nghe, viên mochi, gà con, hamster, cánh cụt, ếch, cá voi) + 16 đồ trang trí (ghim, kẹp, hoa mai/đào, đèn ông sao, bánh trung thu, thông Noel…) — `assets/paper/deco/README.md`.
4. **Checklist** (`checklist.js`): `<div data-ck="0|1">`; gõ `[] `/`[ ] `/`- [ ] ` (và `- ` khi đã ở chế độ checklist) → ô tick; bấm tick (gạch ngang, mờ), đếm `x/y` trên thanh trên, Enter thêm dòng, Enter dòng rỗng/Backspace đầu dòng thoát, kéo tay nắm đổi thứ tự, menu "Chuyển thành checklist/Bỏ checklist", undo/redo được. Text lưu dạng `- [ ] …`/`- [x] …` cho "hiểu note". Tick → `MochiPaperStore.checkItem` → (main) bus `note:checkItem {noteId,index,done}`.
5. **Phông offline** OFL có tiếng Việt: Itim, Pangolin, Mali, Nunito, Baloo 2, Be Vietnam Pro (716 KB) — `assets/fonts/LICENSES.md`.
6. **Hình dạng**: Tự do/Vuông 300×300/Đứng 260×360/Mini 220×170; bóng mép giấy; nghiêng nhẹ (tiêu đề + trang trí). Nền kính vẫn giữ (khi kính bật chỉ vẽ dòng kẻ/tiêu đề/trang trí — chưa thử trên Windows thật).
7. **Dải gợi ý "hiểu note"** (`insight.js`): chỉ bật khi có `mochi.alarms.insight`; nhận diện mềm `suggestions|actions`. Phòng notes chưa công bố API nên hiện luôn ẩn.
- Dữ liệu: ngăn `paper` (`src/main/paper/index.js`, test `node src/main/paper/__tests__/paper.test.js` 24 ca). **Khi main chưa nạp module paper** (hiện tại), renderer tự rơi về `localStorage` — mọi tính năng vẫn chạy, chỉ là chưa vào `mochi-data.json`/sao lưu và chưa phát `note:checkItem`.

**Quyết định đã ghi**: per-note lưu trong ngăn `paper.noteMeta` (store.js bỏ khoá lạ của note); note 0.1 không có meta → `plain-<màu>`; đổi mẫu thì đổi luôn `note.color` sang màu gần nhất (danh sách note, nền cửa sổ); tiêu đề Tết là "Tết" (câu dài bị cắt ở note hẹp); trang trí góc dưới mờ đi khi đang gõ để không đè thanh định dạng; số đếm checklist đặt cạnh nút menu.

**Đã kiểm (xvfb + điều khiển qua CDP)**: chọn mẫu, xem thử, lưu & khởi động lại vẫn giữ, mẫu mặc định cho note mới (Ctrl+N), Mini, chế độ dự phòng localStorage; chức năng cũ: gõ, đậm, undo/redo, tìm (1/3), zoom (dòng kẻ giãn theo), khoá chỉ đọc, chip nhắc tự hiểu giờ, note 0.1 hồng trơn y nguyên; `npm test` xanh. Rà soát code: không lỗi mức cao; các lỗi trung/thấp đã sửa.

**Ảnh nghiệm thu** (`docs/rooms/paper/`): `paper-grid.png` (26 mẫu + thumb), `notes-3-papers-checklist.png` (3 mẫu khác nhau, chữ Việt, checklist đang tick 2/6, note 0.1 trơn), `checklist.png`, `picker.png` (bộ chọn, đang xem thử "Hồng chấm bi"), `fallback-localstorage.png`.

**Cách chạy thử**: thư viện mẫu `src/note/tools/gallery.html` (mở bằng Chromium/Electron qua file://); trang thử `src/note/tools/{checklist,picker,insight}-test.html`. App: như CLAUDE.md; muốn thử ngăn `paper` thật thì sửa tạm `main.js` thêm `'paper'` vào danh sách module (không commit).

**Chưa kiểm được / đang dở**
- Chưa thử trên Windows thật (nền kính acrylic + mẫu giấy, phông hiển thị, IME Telex/VNI khi gõ `[] `).
- Mép xé/góc gập cắt bằng mask trên cửa sổ đục nên phần bị cắt lộ màu nền cửa sổ; nghiêng chỉ áp cho trang trí — cần cửa sổ trong suốt (đề xuất 4).
- Dải gợi ý chờ API của phòng notes.

**Việc tiếp theo cụ thể**
1. Khi điều hành nạp `paper`: chuyển dữ liệu localStorage cũ (nếu có) vào ngăn `paper` một lần (paperStore: đọc `mochi.paper.meta.*` rồi `set`).
2. Khi notes công bố Insight: khớp `insight.js` theo API.md của họ.
3. Thêm mẫu (mùa hè, sinh nhật, Valentine) và cho người dùng ẩn bớt mẫu.

**Vướng mắc**: không.

## Đề xuất cho phòng điều hành
1. `src/main/main.js`: thêm `'paper'` vào mảng module phòng (`['alarms', 'petcore', 'game', 'persona', 'paper']`). Đã thử: khởi động sạch, dữ liệu lưu vào ngăn `paper`.
2. `docs/spec/00-ownership.md`: paper sở hữu thêm `src/main/paper/**`. `docs/spec/01-data.md`: ngăn `paper` (hình dạng ở DESIGN.md mục 1).
3. `docs/spec/02-events.md`: sự kiện `note:checkItem {noteId, index, done}` (phát bởi paper, mỗi lần người dùng bấm tick/bỏ tick). Phòng game sau này nên thưởng idempotent (chỉ lần 0→1 đầu tiên theo noteId+nội dung dòng) để chống cày.
4. Phòng notes (`noteWindows.js`): tuỳ chọn cửa sổ note trong suốt (`transparent: true`, nền do renderer vẽ) để mẫu giấy có mép xé/góc gập/nghiêng/bóng đổ thật; và `backgroundColor` lúc mở theo màu mẫu (hiện theo `note.color` — đã đồng bộ màu gần nhất nên chấp nhận được).
5. Phòng notes (`transferLogic.js` sanitizer khi nhập): giữ `data-ck="0|1"` trên DIV/LI để nhập/xuất không mất ô tick.
