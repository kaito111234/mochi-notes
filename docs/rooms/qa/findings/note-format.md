## note-format — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/note-format.test.js` (11 test; chạy 3 lần: 10 pass / 1 fail / 0 skip, ổn định).
- Đã phủ: định dạng bằng phím tắt (Ctrl+B/I/U/T, Ctrl+Shift+L) và nút thanh công cụ + tô sáng, lưu và mở lại; undo/redo (gõ, định dạng, dán; Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z); tìm Ctrl+F (không dấu, Enter/Shift+Enter, Esc); dán ảnh (nhỏ, 2400x1200 thu về <=1600, mở lại còn); dán HTML độc hại bị lọc; cỡ chữ (Ctrl+=/-/0, Ctrl++, Ctrl+lăn, mở lại còn); khoá chỉ đọc (gõ/xoá/dán/Ctrl+B/Ctrl+Z/nút không đổi nội dung, mở khoá, mở lại còn); thoát app ngay sau khi gõ không mất chữ.
- Lưu ý khung: note mẫu số 1 bắt đầu bằng chữ đậm nên test dọn bằng removeFormat trước khi gõ. Zoom/khoá lưu ở `box.noteMeta` (không nằm trong store.data.notes), test đọc qua `window.mochi.notes2.getMeta`.
- Phím tắt: không phát hiện xung đột/phím không chạy. Ctrl+B/I/U/T, Ctrl+Shift+L/H/K, Ctrl+F, Ctrl+=/-/0/+ đều chạy. Ctrl+B trong ô tìm không đổi note. Chỉ lưu ý: Ctrl+U/Ctrl+T/Ctrl+N/Ctrl+W/Ctrl+D chỉ chạy khi focus trong editor (Ctrl+N/W/D chạy cả ngoài editor).
- Ảnh thanh công cụ: docs/rooms/qa/img/note-format-toolbar.png

### F-note-format-1: Tô sáng kèm đậm/gạch chân/gạch ngang bị mất sau khi mở lại app
- Mức: Nặng (tính năng tô sáng mất dữ liệu định dạng lặng lẽ)
- Phòng: paper
- Tái hiện: gõ chữ, Ctrl+A, Ctrl+B, Ctrl+U, Ctrl+Shift+H (tô sáng); đợi lưu; thoát và mở lại app. Test đỏ: `1c. tô sáng kèm đậm/gạch chân/gạch ngang vẫn còn sau khi mở lại`.
- Kỳ vọng: chữ vẫn được tô màu sau khi mở lại.
- Thực tế: Chrome gắn `style="background-color:..."` lên phần tử trong cùng (`<b>`, `<u>`, `<strike>`, `<i>`), nhưng `cleanInto` chỉ giữ style trên `SPAN` và `MARK`; html lưu có màu nhưng khi nạp lại qua `sanitizeHtml` màu bị bỏ (kết quả `<b><u>vua dam vua sang</u></b>`). Bấm lại tô sáng trong note đã định dạng cũng cho kết quả tương tự. Bỏ qua cả khi dán/thả.
- Nguyên nhân khả dĩ: src/note/note.js:44-51 (chỉ SPAN/MARK giữ `background-color`); nên cho mọi thẻ cho phép giữ `background-color` hợp lệ qua `bgOf`, hoặc sau `hiliteColor` chuẩn hoá về `<span>`/`<mark>`.
- Ảnh: docs/rooms/qa/img/note-format-to-sang-mat.png
- Độ chắc: đã tái hiện 3/3 lần.
