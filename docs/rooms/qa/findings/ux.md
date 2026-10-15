## LƯỢT 2 — ux: rà trải nghiệm Đợt 2 qua ảnh (main @20ec6c9)

- Lệnh: `bash test/e2e/run.sh test/e2e/ux2-shots.test.js` (10 test, 10 pass / 0 fail; test chỉ chụp). 1366x768: `UX2_TAG=-1366 xvfb-run -a -s "-screen 0 1366x768x24" node --test --test-concurrency=1 test/e2e/ux2-shots.test.js` (10/10 pass). Cũng chạy lại `ux-shots.test.js` ux-6, ux-8 (pass) để kiểm lỗi cũ. Ảnh gốc `test/e2e/out/ux2-*.png` (~80 ảnh, 1366 có tiền tố `ux2-1366-`); ảnh chọn: `docs/rooms/qa/img/l2-ux-*.png` (10 ảnh).
- Đã xem bằng mắt: bộ chọn mẫu 6 tab; 8 mẫu x 3 cỡ (Mini 220x170, 300x220, 400x420; có Than, Kraft, Đêm, Tết, Trung thu...); checklist 14 dòng; dải gợi ý; danh sách (Ghi nhanh, +N, thùng rác); Phòng của Mochi 5 tab sáng/tối; bé đứng/giơ note/chuông/ngủ/vui; nhắc note thật; chuông MOCHI_DEV_RING; Cài đặt 4 đoạn.
- Ổn: chữ trên mọi mẫu đọc được (Than, Kraft, Đêm, Tết, Trung thu đều đủ tương phản; chữ Việt có dấu đúng, không thấy lỗi chính tả); checklist gạch ngang + đếm 4/14 rõ; xem trước Ghi nhanh "Bé hiểu: 2 việc · 09:00 Họp · 14:00 Gọi khách" rất dễ hiểu; thùng rác có "Khôi phục/Xoá hẳn/Dọn sạch" + chú thích 30 ngày; Phòng của Mochi: dark mode dùng được, "xu" nhất quán trong giao diện (từ "kẹo" chỉ còn trong thoại bé `assets/dialogue/vi.json:433-435`, xem N-ux-9); bé cầm đồng hồ ở trạng thái chuông khớp tay; chuông/ngủ/vui không đè cửa sổ nào; ở 1366x768 bé, bong bóng, Phòng đều nằm trong màn.
- So Sticky Notes: (1) menu "..." và bộ chọn mẫu bị nhốt trong cửa sổ note nhỏ (mục N-ux-1/2); (2) trang trí/dải gợi ý chiếm chỗ làm note nhỏ chỉ còn 1-2 dòng chữ; (3) Sticky Notes không có dải gợi ý tự bật, ở đây dải hiện cả với note không cần (note mẫu "1 việc có giờ"), nên có cách tắt hẳn trong Cài đặt.

### Kiểm lại lỗi UX cũ
| Mã | Trạng thái | Chứng cứ |
|---|---|---|
| BUG-013 chuông che bé | CÒN | `MOCHI_DEV_RING=1`: ring (1064,622,360x262) đè pet (1140,475,300x430); chỉ thấy chân bé (l2-ux-chuong-che-be.png). 1366: ring (990,490) vs pet (1066,343) vẫn chồng. Ghi chú: bé "cầm đồng hồ" (hold) hiển thị tốt khi dùng actor trực tiếp (ux2-52), nên nếu ring chỉ là dự phòng thì cần bỏ cửa sổ ring khi bé đang ở sân khấu |
| BUG-015 dặn dò đè bé | CÒN | memo (1064,564,360x320) phủ gần hết pet; chỉ lộ chân (l2-ux-dando-che-be.png). Hết cảnh 2 khung nói trùng nhưng bé vẫn mất |
| BUG-016 tờ note cắt mép phải | ĐÃ SỬA (phần lớn) | ux2-51b: tờ nằm trọn (mép phải 1410/1440; 1366 cũng trọn). Còn dòng phụ cắt "09:30 hôm nay · Go…" |
| BUG-018 menu "..." bị cắt | CÒN (nặng hơn) | 300x220 thấy 4/12 mục (thêm "Mẫu giấy…", "Chuyển thành checklist" làm "Xoá note" càng xa); ux2-01-menu.png |
| BUG-019 panel Nhắc lịch ở note nhỏ | CÒN | ux-52 (220x160): chỉ thấy ô Thời gian, nút Lưu/Tắt nhắc/Xong ngoài khung |
| BUG-027 "Đang dán/Đang cất" | CÒN | chip "Đang dán 3 / Đang cất 0" ở danh sách (l2-ux-thung-rac-toast.png) |
| BUG-028 xưng hô | CÒN | note mẫu "Chào bạn, mình là Mochi Notes!... nhắc bạn" trong khi bé/popup dặn dò nói "Tớ dặn cậu nè", "Cậu ơi" (ux-30-dando-2, ux2-61) |
| BUG-029 phím tắt thiếu | CÒN (một phần) | Cài đặt chỉ liệt kê Ctrl+Alt+N/H/L/M và 6 phím trong note; thiếu Ctrl+Alt+G (Phòng của Mochi), Ctrl+F, Ctrl+Z/Y, Ctrl+Shift+K/R, zoom (l2-ux-caidat-phim-tat-thieu.png). Nút popup dặn dò nay là "Nhớ rồi" (đã dễ hiểu hơn "Ở lại") |
| Art: "tờ note lệch khỏi tay" | CÒN | khi bé giơ note, tờ nằm lệch phải ~55px, cao hơn tay ~70px, che nửa người bé, tay không chạm tờ (l2-ux-be-giat-note-lech-tay.png) |

### Lỗi mới
- N-ux-1 (Vừa, paper): trang trí đè nút "..." / "x" / chip. Kraft (lá), Tết (hoa mai), Bài tập (kẹp giấy), MEMO (tách trà) phủ lên nút "..." ở thanh trên; hoa mai/thỏ/bánh trung thu ở góc dưới phủ nút "x" của dải gợi ý; thỏ Trung thu che chữ "2 việc có giờ". Tái hiện: `ux2-shots` ux2-2-mini/mac (ảnh l2-ux-mini-deco-che-nut-menu.png). Kỳ vọng: deco không chồng lên nút bấm. Thực tế: nút "..." bị che một phần (bấm trúng vẫn có thể nhưng không nhìn thấy).
- N-ux-2 (Vừa, paper): bộ chọn Mẫu giấy trong note 300x220 chỉ thấy 1 hàng mẫu và tab nhóm bị cắt ("sinh", "Tối giản"; "Văn phòng", "Mùa & lễ" phải cuộn ngang), phần "Tuỳ chọn" nằm dưới nếp gập. Cách sửa gợi ý: tự phóng cửa sổ khi mở bộ chọn (có sẵn `paper.resize`) hoặc mở dạng cửa sổ riêng. Ảnh l2-ux-picker-300x220-chat.png (và ux2-02-picker-tab*).
- N-ux-3 (Vừa, notes): dải gợi ý ăn ~1/3 note Mini 220x170: chỉ còn 1-2 dòng chữ, chữ trong dải bị cắt "2 việc có giờ — ..." / "Bé gợi ý: Chuyển thành check…", nút "Tạo"/"Làm" không nói tạo/làm gì. Kỳ vọng: ẩn dải ở note nhỏ hoặc gọn thành 1 biểu tượng; nút ghi rõ "Tạo nhắc"/"Chuyển checklist". Ảnh l2-ux-mini-deco-che-nut-menu.png, l2-ux-checklist-insight.png.
- N-ux-4 (Vừa, game/art): tab Tủ đồ, khung xem trước bé trống (chỉ có bệ xanh, không có bé) ở cả sáng và tối (ux2-40-phong-sang-0, l2-ux-phong-toi-preview-trong.png). Tên đồ bị cắt "Cà vạt x…", "Kẹp chữ…". Chưa loại trừ do xvfb/tải ảnh chậm (chờ 0.9s).
- N-ux-5 (Nhẹ, game): dark mode — pill "Cấp 1" nền tối trên nền tối gần như chìm, biểu tượng khoá trong ô đồ chưa mở gần như vô hình (l2-ux-phong-toi-preview-trong.png). Nhãn "Gốc / Có BH" ở Máy gacha viết tắt khó hiểu ("BH" = bảo hiểm).
- N-ux-6 (Nhẹ, notes): tô sáng trên giấy Đêm/Than: chữ sáng trên nền vàng tô sáng gần như không đọc được ("tô sáng" ở ux2-11-lon-minimal-night.png). Nên tự đổi màu chữ trong vùng tô sáng.
- N-ux-7 (Nhẹ, notes): "bé Mochi sẽ nhắc cậu" (hint cạnh chip) bị cắt ở mép phải khi note 300px; chip "06:00 ngày mai · bá…" bị cắt (ux2-21-is3.png). Chip nhắc đến hạn hiện "quá hạn 0 giây" (ux2-60-nhac-3.png) nên là "vừa tới giờ".
- N-ux-8 (Nhẹ, notes): toast Ghi nhanh "Xong rồi nè, note mới đã có chỗ ở." nằm đè lên nút "Hiện tất cả/Ẩn tất cả" nhiều giây (kể cả khi đổi qua tab Thùng rác); câu "có chỗ ở" lạ tai (l2-ux-thung-rac-toast.png).
- N-ux-9 (Nhẹ, persona/game): thoại thưởng dùng "kẹo" ("Nhận được {count} kẹo rồi nè", `assets/dialogue/vi.json:433-435`) trong khi giao diện Phòng gọi "xu". Thoại cho note intent "Gọi điện" ra câu "đến rồi nè. Một lời chúc ngắn thôi cũng đáng yêu lắm." (ux2-60-nhac-3.png): lệch loại việc (còn F-ux-5).
- N-ux-10 (Nhẹ, notes): bộ hiểu note coi chữ "sáng" đơn lẻ là giờ (08:00): "Đậm nghiêng tô sáng" -> "2 việc có giờ" (chạy `understand()` xác nhận). Gợi ý nhắc sai cho từ như "tô sáng", "sáng tạo". Chuông thử MOCHI_DEV_RING chữ lặp "Báo thức Báo thức thử lúc 09:09" (dev, ux2-61).
- N-ux-11 (Nhẹ, notes): bộ lọc danh sách vẫn đếm "Đang dán"/"Đang cất" (xem BUG-027); trang trí Mẫu "Notes" (mèo): dòng kẻ cắt qua chữ ở dòng 3-4 (ux2-10-luoi-mac.png) — lệch căn dòng chữ với đường kẻ.

---

## ux — rà soát trải nghiệm qua ảnh chụp

- Lệnh chạy: `bash test/e2e/run.sh test/e2e/ux-shots.test.js` (8 test, 8 pass / 0 fail / 0 skip — test chỉ chụp, việc đánh giá bằng mắt). Ảnh gốc ở `test/e2e/out/ux-*.png` (~45 ảnh: lần đầu, chip nhắc, menu "...", thanh định dạng, tô sáng, 7 màu + từng màu, list 3 tab + cài đặt cuộn 4 đoạn, form báo thức, chuông 6 khung, dặn dò 3 khung, bé nhắc note 8 khung, note 220x160 + menu + panel nhắc). Ảnh chứng minh chọn 8 tấm ở `docs/rooms/qa/img/ux-*.png`.
- Ghi chú khung: xvfb không có hộp thoại hệ thống; ô ngày giờ hiện kiểu Mỹ (10/16/2026, AM) là do locale Linux, không tính lỗi. Thanh định dạng chỉ hiện khi con trỏ ở trong note (thiết kế giống Sticky Notes).
- Đã xem và ổn: 7 màu note đều đọc được (charcoal chữ #f2f2f2 trên nền #4a4a4a, tương phản ~8:1; tô sáng vàng vẫn rõ trên charcoal); chính tả tiếng Việt toàn bộ ~700 chuỗi giao diện (không thấy lỗi dấu/lỗi chính tả, không có chữ Anh lọt vào giao diện người dùng); danh sách báo thức/dặn dò/cài đặt/dữ liệu bố cục gọn.

### F-ux-1: Dặn dò — tờ note bé cầm hiện "NaN:NaN · undefin…"
- Mức: Vừa
- Phòng: core (điều hành nối stage)
- Tái hiện: `MOCHI_DEV_MEMO=1`, chờ ~4s, nhìn tờ note nhỏ bé cầm ở góc phải dưới (test `ux-6`).
- Kỳ vọng: dòng nhỏ dưới tờ là giờ/khung ("Khi mở máy", "Buổi sáng"…) hoặc để trống. Thực tế: "NaN:NaN · undefin…" (chữ bị cắt).
- Nguyên nhân khả dĩ: `src/main/pet/stage.js:333` truyền `P.whenLabel(p.when)` trong khi `memo.when` là khoá chuỗi ('startup', 'evening'…) chứ không phải mốc thời gian; dòng 108 `P.hm(p.when)` cũng sai cùng lý do (biến `{time}` của câu thoại dặn dò thành NaN).
- Ảnh: docs/rooms/qa/img/ux-nan-nan-undefined.png, docs/rooms/qa/img/ux-dando-che-be.png
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-2: Popup dặn dò (memo.html) che bong bóng thoại của bé
- Mức: Vừa
- Phòng: notes (vị trí cửa sổ) / core (vùng chiếm chỗ của bé)
- Tái hiện: `MOCHI_DEV_MEMO=1`, test `ux-6`. Cửa sổ memo (1064,334, 360x300) chồng lên bong bóng của bé (cửa sổ pet 1140,507, 300x397): bong bóng chỉ còn thấy nửa dưới ("…thoáng nha." và nút "Ừ, nhớ rồi"), nội dung trùng với popup nên người dùng thấy 2 khung nói cùng một câu; popup còn có khoảng trống lớn (~130px) giữa nội dung và nút "Nhớ rồi".
- Kỳ vọng: không cửa sổ nào đè lên bong bóng/nút của bé. Thực tế: chồng một phần.
- Nguyên nhân khả dĩ: `src/main/alarms/memoService.js` đặt popup theo góc phải dưới cố định, chưa dùng vùng chiếm chỗ của bé (notes.md đã ghi "chờ core"). Nếu bé đang cầm dặn dò thì nên chỉ hiện 1 trong 2.
- Ảnh: docs/rooms/qa/img/ux-dando-che-be.png
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-3: Cửa sổ chuông ring.html phủ kín bé và bong bóng của bé
- Mức: Vừa (nút Tắt/Hoãn của chính cửa sổ chuông vẫn thấy và bấm được; nếu chuông bị đóng/ẩn trước thì nút trên bong bóng cũng bị che → xem F-ux-3 phần cuối)
- Phòng: notes + core
- Tái hiện: `MOCHI_DEV_RING=1`, test `ux-5` (6 ảnh liên tiếp). Chuông (1064,648, 360x236, always-on-top) nằm đè lên bé (1140,507, 300x397): chỉ còn thấy đôi chân bé; bong bóng/nút "Tắt/Hoãn" của bé không thấy suốt 9s.
- Kỳ vọng: bé và chuông không che nhau (bé cầm chuông hoặc chuông né sang trái/lên trên). Thực tế: chuông che gần hết bé, tính năng "bé lên sân khấu" cho báo thức vô hình. Chưa xác nhận được ca chuông thật (không phải `test`) vì chạy MOCHI_DEV_RING dùng cờ test; nên chạy thêm `MOCHI_DEV_ALARM=1` trên máy thật.
- Nguyên nhân khả dĩ: `src/main/alarms/alarmService.js:68-84` đặt vị trí góc phải dưới, độc lập vùng bé; `src/main/pet/stage.js:344` phát nút Tắt/Hoãn trên bong bóng bị che.
- Ảnh: docs/rooms/qa/img/ux-chuong-che-be.png
- Độ chắc: đã tái hiện 2/2 lần. Mức Nặng nếu xác nhận trong ca chuông thật rằng nút Tắt của chuông bị bé/cửa sổ khác che (ảnh hiện tại: chuông nằm TRÊN nên không che nút Tắt).

### F-ux-4: Tờ note bé cầm bị cắt ở mép phải màn hình
- Mức: Vừa
- Phòng: core
- Tái hiện: seed một note có `reminder.due = now+3s`, bật bé (test `ux-7`), nhìn khung ảnh `ux-40-nhac-3/7`. Tờ "Tới giờ rồi!" kéo sát/ra khỏi mép phải (x≈1313–1440 trên màn 1440): bóng đổ và góc phải bị cắt; dòng phụ "08:21 hôm nay · Gọi…" bị cắt chữ ("Gọi điện" thành "Gọi…").
- Kỳ vọng: tờ nằm trọn trong cửa sổ bé với lề; dòng phụ đọc được. Thực tế: chạm/cắt mép.
- Nguyên nhân khả dĩ: vị trí `.note-held` trong `src/pet/pet.css` / `src/pet/pet.js` (offset vượt khung 300px của cửa sổ pet khi bé đứng sát mép phải).
- Ảnh: docs/rooms/qa/img/ux-to-note-cat-mep.png
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-5: Câu thoại bé không khớp loại việc (intent) của note
- Mức: Nhẹ
- Phòng: core (stage) / persona
- Tái hiện: note "Gọi điện cho khách hàng" `intent:'call'` đến hạn: lần 1 bé nói "…đến hạn rồi. Chưa xong thì gửi bản đang có trước cũng được nha." (câu cho intent `due`), lần 2 nói "Cậu đi cẩn thận, nhớ mang ví và điện thoại nha." (câu cho intent `go`). Kho thoại có 9 câu cho `call` nhưng không được chọn.
- Nguyên nhân khả dĩ: `src/main/pet/stage.js:98-111` `varsFor` không đặt `v.intent` từ `note.reminder.intent`, nên `persona.pick` không lọc theo `cond.intent` (`src/main/persona/index.js:93`).
- Ảnh: docs/rooms/qa/img/ux-to-note-cat-mep.png (xem bong bóng)
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-6: Menu "..." bị cắt ở note 300x220 và gần như không dùng được ở 220x160
- Mức: Vừa
- Phòng: paper
- Tái hiện: test `ux-2` (300x220) và `ux-8` (220x160): bấm "...". Menu có 11 mục + hàng màu nhưng cửa sổ note nhỏ nên chỉ thấy 4 mục ở 300x220 (thanh cuộn mảnh), và chỉ thấy hàng màu + 2 mục ở 220x160; "Xuất", "Danh sách note", "Ẩn tất cả" và đặc biệt "Xoá note" ở dưới cùng phải cuộn mới thấy, dễ không biết có.
- Kỳ vọng: menu thấy hết mục chính (như Sticky Notes: menu là cửa sổ riêng, không bị cắt theo cỡ note) hoặc có chỉ báo cuộn rõ. Thực tế: cắt giữa mục (chữ "Tìm trong note" bị cắt đôi ở 220x160).
- Nguyên nhân khả dĩ: `src/note/note.html:73-95`, menu là `.pop` tuyệt đối trong cửa sổ note, chiều cao tối đa = cửa sổ (`src/note/note.css`, `.menu` max-height).
- Ảnh: docs/rooms/qa/img/ux-menu-300x220-cat.png, docs/rooms/qa/img/ux-note-nho-menu-cat.png
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-7: Panel "Nhắc lịch" ở note nhỏ — nút Lưu / Tắt nhắc / Đánh dấu xong nằm ngoài khung nhìn
- Mức: Vừa
- Phòng: paper
- Tái hiện: test `ux-8`: note 220x160, bấm biểu tượng đồng hồ. Chỉ thấy tiêu đề, ô Thời gian và nhãn "Báo trước / Lặp lại"; các ô chọn và 3 nút phải cuộn trong panel (thanh cuộn mảnh). Ở 300x220 panel cũng chỉ vừa tới ô chọn, nút Lưu bị cắt (ảnh `ux-06-panel-nhac-win`). Enter lưu được (có xử lý phím) nhưng người dùng không biết.
- Kỳ vọng: panel luôn thấy nút Lưu (ghim nút ở đáy panel hoặc panel cuộn cả khối với gợi ý). Thực tế: cắt.
- Nguyên nhân khả dĩ: `src/note/note.html:104-138` panel có `.row` nút nằm cuối nội dung cuộn.
- Ảnh: docs/rooms/qa/img/ux-note-nho-panel-nhac.png
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-8: Nhãn lọc "Đang dán" / "Đang cất" và nút "Cất/Dán" là từ lóng khó hiểu
- Mức: Nhẹ
- Phòng: notes (src/list)
- Tái hiện: mở cửa sổ danh sách, tab Note (test `ux-4`). Bộ lọc "Tất cả / Có nhắc lịch / Đang dán / Đang cất"; nút trên thẻ "Cất" và "Dán"; tooltip "Dán note lên màn hình". Người dùng Sticky Notes quen "Mở/Đóng" hoặc "Hiện/Ẩn"; nút X trên note cũng là "Cất note" nhưng không ghi rõ note vẫn còn trong danh sách (nỗi lo "đóng note thì mất?").
- Kỳ vọng: từ gần gũi ("Đang hiện / Đang ẩn", nút "Hiện/Ẩn") hoặc tooltip nêu rõ "Ẩn note, vẫn lưu trong danh sách". Thực tế: tooltip X chỉ "Cất note (Ctrl+W)".
- Nguyên nhân khả dĩ: `src/list/list.html:39-40`, `src/list/list.js:119,138-141`, `src/note/note.html:26`.
- Ảnh: docs/rooms/qa/img/ux-list-bo-loc.png (bộ lọc xuống 2 hàng vì chip "Đang cất" bị đẩy xuống)
- Độ chắc: đã tái hiện 2/2 lần.

### F-ux-9: Biểu tượng ghim xanh trên thẻ note trong danh sách dễ nhầm với "luôn nổi trên cùng"
- Mức: Nhẹ
- Phòng: notes (src/list)
- Tái hiện: test `ux-4`, ảnh `ux-10-list-note`: cả 2 note (đều `alwaysOnTop:false`) đều có biểu tượng ghim xanh cạnh tiêu đề; có vẻ là dấu "đang dán/đang hiện" nhưng ghim thường nghĩa là luôn nổi. (Chưa kiểm xem thẻ có trích nội dung nhiều dòng không: note thử chỉ 1 dòng.)
- Kỳ vọng: ghim chỉ khi luôn nổi; trạng thái hiện/ẩn dùng biểu tượng khác. Độ chắc: cần phòng notes xác nhận ý đồ (xem `src/list/list.js:100-130`).
- Ảnh: docs/rooms/qa/img/ux-list-bo-loc.png
- Độ chắc: đã tái hiện 2/2 lần (hiện tượng), ý đồ chưa rõ.

### F-ux-10: Đại từ không thống nhất: "bạn" và "cậu"
- Mức: Nhẹ
- Phòng: notes/persona
- Ví dụ: note chào "Chào bạn, mình là Mochi Notes!… bé Mochi sẽ tự hiện ra nhắc bạn." (`src/main/notes/noteService.js:182-186`); chip "Bé Mochi sẽ nhắc cậu" (`src/note/note.html:49`); list "Bé Mochi sẽ giúp bạn nhớ giờ" (`src/list/list.js:184`), "Bé sẽ nhắc bạn đúng lúc" (`src/list/memos.js:41`), "Mochi tự sao lưu mỗi ngày khi bạn dùng" (`src/list/data.js:58`) trong khi bé xưng "tớ/cậu" mọi nơi khác (`src/main/pet/lines.js`, …). Cả "mình" lẫn "tớ" cho cùng nhân vật.
- Kỳ vọng: giao diện hệ thống trung tính ("bạn") còn lời của bé xưng "tớ/cậu"; riêng chip `note.html:49` là lời bé nên đúng, nhưng note mẫu đầu tiên nên chọn một giọng. Nhẹ.
- Độ chắc: đọc code 1/1 (không cần chạy).

### F-ux-11: Bảng phím tắt trong Cài đặt thiếu phím có thật; nhãn nút "Ở lại" không rõ
- Mức: Nhẹ
- Phòng: notes (src/list, src/alarms)
- Chi tiết: mục "TRONG NOTE" (`src/list/list.html:200-206`) thiếu Ctrl+N (note mới), Ctrl+F (tìm), Ctrl+Z/Y, Ctrl+Shift+K (khoá), Ctrl+Shift+R (nhắc), Ctrl +/−/0 (cỡ chữ) — những phím được ghi trong `src/note/note.js:686-710` và tooltip. Nút "Ở lại" của popup dặn dò trước khi tắt máy (`src/alarms/memo.html:15`) dễ hiểu nhầm; nên "Chưa tắt máy".
- Độ chắc: đọc code 1/1.

### F-ux-12: Chip nhắc quá hạn hiện "quá hạn 0 giây"/"1 giây"
- Mức: Nhẹ
- Phòng: paper (src/note)
- Tái hiện: test `ux-7`: ngay khi đến hạn chip viết "08:18 hôm nay · quá hạn 1 giây" (đỏ). Cách nói máy móc; nên "đến giờ rồi" khi < 1 phút.
- Nguyên nhân khả dĩ: `src/note/note.js:381-393`.
- Ảnh: docs/rooms/qa/img/ux-to-note-cat-mep.png (ảnh chụp cùng lúc, chip ở note ảnh `ux-40-nhac-3`)
- Độ chắc: đã tái hiện 2/2 lần.

## Soát chuỗi tiếng Việt (grep src/**/*.html, *.js, ~700 chuỗi)
Không có lỗi dấu/chính tả rõ ràng; không có chữ Anh trong nhãn người dùng. Điểm lẻ (đều Nhẹ):
- Dùng kiểu dấu cũ "Xoá/Huỷ/Khoá/Hoà" thống nhất trong toàn app (Windows tiếng Việt hiện dùng "Xóa/Hủy/Khóa") — nên chốt một kiểu: `src/note/note.html:94-101,88`, `src/list/list.js:143,158`, `src/list/memos.js:66-67`.
- Dấu chấm lửng không thống nhất: "..." (`src/list/list.html:34` "Tìm trong note...", `:127` "Dặn bé điều gì đó...", `src/list/data.js:53,74` "Đang tải...", "Đang đọc...") và "…" (`src/note/note.html:39` "Ghi chú…", `:86`).
- `src/list/list.html:34` placeholder "Tìm trong note..." trong khi aria-label ở dòng 34 "Tìm trong note" — ổn, chỉ là kiểu dấu.
- "Hoãn 10 phút" cứng trong `src/main/pet/stage.js:257` và `src/mascot/mascot.js:228` (lines.js:58-59 cũng cứng "10 phút") dù cài đặt có "Hoãn mặc định" (list.html:178) → nếu người dùng đặt 15 phút, nút trên bé vẫn ghi 10.
- Tiêu đề cửa sổ note là "Mochi Note" (`src/main/notes/noteWindows.js:54`) còn app tên "Mochi Notes" (ảnh hưởng thanh tác vụ/Alt+Tab).
- "Các thứ trong tuần" (list.html:97) → nên "Chọn thứ" hoặc "Thứ trong tuần" cho khớp nút "Chọn thứ".

## So với Microsoft Sticky Notes (nhận xét)
- Có: nút "+" tạo note ngay trên note, X đóng, menu "...", đổi 7 màu, thanh định dạng khi đang gõ, Ctrl+F tìm trong note, tìm trong danh sách, ghim luôn nổi.
- Khó khám phá: thanh định dạng chỉ hiện sau khi bấm vào note (lần đầu mở không thấy); tìm trong note chỉ ở menu "..." / Ctrl+F; X "cất" không nói rõ vẫn còn (F-ux-8); chưa thấy cách mở danh sách từ note ngoài menu "..." (không có biểu tượng danh sách trên thanh note).
- Hiệu năng/độ trễ: lần đầu load note ổn trong 3s (ảnh `ux-01-lan-dau`).
