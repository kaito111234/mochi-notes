## note-persist — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/note-persist.test.js` (~100s). Kết quả: 12 test, 10 pass, 2 fail (1a, 1b — cùng một lỗi), 0 skip.
- Ghi chú khung: `app.close()` + `launch({configHome})` hoạt động tốt; xvfb không có window manager nhưng `document.activeElement` vẫn đáng tin (click vào editor là focus được), nên lỗi focus dưới đây là lỗi thật của code, không do xvfb.
- Cách đổi màu qua giao diện: bấm `#btnMenu` ("..."), rồi bấm ô màu `.sw[data-color="blue"]` (test 3a). Chạy ổn, màu lưu và khôi phục đúng.
- Đã kiểm, KHÔNG lỗi: tạo note lệch vị trí (+32,+32, 3 note liên tiếp không trùng); gõ Unicode dựng sẵn; dán NFC và NFD (giữ nguyên, không mất/nhân đôi dấu); insertText kiểu IME; thay thế ký tự a -> Backspace -> á; đóng app mở lại giữ nội dung/vị trí/cỡ/màu; nút X cất note (visible=false, không xoá, mở lại không hiện).
- Kill (SIGKILL) sau khi gõ (28 ký tự, đo 1 lần mỗi mốc): chờ 200ms mất 28/28 ký tự; chờ 1000ms mất 0; chờ 2500ms mất 0. Chuỗi lưu: renderer debounce 500ms + store debounce 300ms nên cửa sổ rủi ro tối đa ~0,8s. Dữ liệu gõ >2s trước khi kill không mất, đạt yêu cầu (không phải lỗi).
- Note mẫu vàng lần đầu: KHÔNG phải lỗi. Nội dung có trong dữ liệu (`note.text` chứa Ctrl+Alt+N) và editor hiện chữ sau ~18-570ms kể từ domcontentloaded (đợi `getNote` qua IPC rồi mới gán innerHTML, src/note/note.js:~729). Ảnh khói trống nhiều khả năng do chụp quá sớm (hoặc lúc đó cửa sổ chưa nạp xong). Ảnh sau khi chờ: docs/rooms/qa/img/note-persist-note-mau.png. Tuy vậy có thể nhẹ: cửa sổ hiện (`ready-to-show`) trước khi nội dung được gán nên có thể nháy trống ngắn.

### F-note-persist-1: Note mới tạo không tự focus vào vùng soạn
- Mức: Vừa
- Phòng: paper (renderer), có liên quan notes (noteWindows.openNote)
- Tái hiện: test 1a (Ctrl+Alt+N) và 1b (nút "+") đỏ: `bash test/e2e/run.sh test/e2e/note-persist.test.js`. Tạo note mới, chờ editor sẵn sàng 0,8s, kiểm `document.activeElement`.
- Kỳ vọng: tạo note mới (`createNote` gọi `openNote(..., {focus:true})`) thì con trỏ nằm sẵn trong vùng soạn, gõ được ngay.
- Thực tế: `activeElement` là BODY; người dùng phải bấm vào note mới gõ được. Không có chỗ nào gọi `ed.focus()` khi khởi động (editor còn bị đặt contenteditable=false lúc đầu rồi bật lại trong `applyLocked`).
- Nguyên nhân khả dĩ: src/note/note.js:~722-735 (khối khởi động async không gọi `ed.focus()` sau `applyLocked(false)`); chỉ `win.focus()` ở src/main/notes/noteWindows.js:45-46 mà không chuyển focus vào DOM.
- Ảnh: docs/rooms/qa/img/note-persist-khong-focus.png
- Độ chắc: đã tái hiện 3/3 lần.

### Đề xuất nhẹ (không phải lỗi)
- Ca kill: dữ liệu gõ trong ~0,8s cuối trước khi nguồn tắt đột ngột sẽ mất (đo: kill sau 200ms mất hết 28 ký tự). Có thể giảm bằng cách flush ngay ở renderer (debounce 500ms -> ~150ms) nếu muốn.
