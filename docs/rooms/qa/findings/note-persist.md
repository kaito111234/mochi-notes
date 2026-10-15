## note-persist — lượt 3 (main mới)
- Lệnh: `bash test/e2e/run.sh test/e2e/note-persist.test.js`. Kết quả: 13 test, 11 pass, 2 fail (1a, 1b). Chạy 2 lần (lần 2 sau sửa ca 4).
- Ca 4 (ĐỎ MỚI -> sửa test, đổi giao diện CÓ CHỦ Ý): note vàng hướng dẫn nay mở bằng "Chào cậu, tớ là Mochi nè!" (src/main/notes/noteService.js:216, notes Đợt 3: lời bé xưng tớ/cậu, BUG-028) trong khi test chờ "Chào bạn". Nội dung vẫn đủ (Ctrl+Alt+N, Ctrl+Alt+M...). Đổi chuỗi chờ thành "Chào cậu"; mọi kỳ vọng khác giữ nguyên. Xanh 2/2. BUG-028 (note mẫu) ĐÃ SỬA THẬT: innerHTML trong ảnh lỗi cũ test/e2e/out/np-4-LOI.png đã có "Chào cậu, tớ là Mochi nè!".
- 1a/1b = BUG-017 VẪN ĐỎ, nguyên nhân y như cũ: activeElement=BODY; src/note/note.js không gọi `ed.focus()` khi khởi động (chỉ ed.focus() ở histRestore :164 và closeFind :259), noteWindows.js:76 chỉ `win.show()`. note.js không đổi từ Đợt 2.

## note-persist — lượt 2 (main @70ebdd3)
- Lệnh: `bash test/e2e/run.sh test/e2e/note-persist.test.js` (~4 phút). Kết quả: 13 test, 11 pass, 2 fail (1a, 1b — BUG-017), 0 skip. Chạy 2 lần, như nhau.
- 1a/1b: VẪN đỏ, cùng nguyên nhân lượt 1 (note mới tạo `document.activeElement` = BODY). src/note/note.js khối khởi động vẫn không gọi `ed.focus()` (chỉ có `win.focus()` ở noteWindows.js:45). Không phải do giao diện mới đổi có chủ ý: giữ nguyên kỳ vọng. Ảnh cũ: docs/rooms/qa/img/note-persist-khong-focus.png.
- Các ca 1c, 2a-2e, 3a (đổi màu bằng `.sw[data-color]` trong menu "..." vẫn chạy, màu + vị trí + cỡ còn sau mở lại), 3b, 4, 5: ĐẠT, không phải đổi selector.
- Ca mới 6: mẫu giấy + checklist + lưu (ĐẠT, 1/1; chạy lại trong bộ đầy đủ cũng ĐẠT). Luồng: seed 2 note; note 1: menu "..." -> "Mẫu giấy…" -> tab "Học sinh" -> ô `student-grid` (kẻ ô); gõ "[] " + 3 dòng tiếng Việt có dấu ("Mua sữa đậu nành", "Gửi thư ở bưu điện", "Đóng tiền điện tháng chín"; Enter tạo dòng mới); bấm tick dòng 1 và 3 (đếm "2/3" trên thanh trên); tick dòng 2 -> Ctrl+Z bỏ tick (chữ giữ nguyên, đếm lại 2/3) -> Ctrl+Y tick lại -> Ctrl+Z; kéo tay nắm dòng 3 lên đầu (đổi thứ tự). Note 2: đổi sang `minimal-kraft` qua `window.mochi.paper.set`. Kiểm: `localStorage` không có khoá paper/mochi; flush + đóng app; `mochi-data.json` có `paper.noteMeta.n_ck.paper = student-grid`, `n_kraft.paper = minimal-kraft`, html có `data-ck="1"/"0"`, `text` dạng `- [x] Đóng tiền điện tháng chín\n- [x] Mua sữa đậu nành\n- [ ] Gửi thư ở bưu điện`; mở lại: `data-paper` đúng, thứ tự + trạng thái tick + đếm 2/3 còn nguyên, localStorage vẫn sạch.
- Đã kiểm, KHÔNG lỗi: mẫu/tick/thứ tự lưu vào ngăn `paper` thật (main đã nạp module paper, không còn rơi về localStorage); tiếng Việt có dấu trong checklist đúng; undo/redo sau tick đúng.
- Ảnh: docs/rooms/qa/img/l2-note-giay-checklist.png (2 note: kẻ ô + checklist 2/3, và kraft).
- Chưa kiểm: luồng migrate localStorage cũ -> ngăn paper (phòng khác/ux đã ghi); tick phát bus `note:checkItem` (thuộc game/paper unit).

## Kiểm lại lỗi cũ (lượt 2)
| Mã | Trạng thái | Chứng cứ |
|---|---|---|
| BUG-006 thùng rác | ĐÃ SỬA (kèm lỗi mới N-list-1/2/3) | list-3c/3d/3e: xoá -> chip "Thùng rác (1)" -> Khôi phục về đủ nội dung/màu/nhắc; Xoá hẳn + Dọn sạch cần 2 bước; ngăn `trash` trong mochi-data.json, còn sau restart. Mất mẫu giấy khi khôi phục; "Hoàn tác" không bấm được; chữ xác nhận ở cửa sổ note còn "xoá hẳn". |
| BUG-007 tô sáng mất | CÒN | note-format 1c đỏ: `<b><u>vua dam vua sang</u></b>`; note.js:44-56 không đổi. |
| BUG-017 không focus note mới | CÒN | note-persist 1a, 1b đỏ (activeElement = BODY); note.js không gọi `ed.focus()` khi khởi động. |
| BUG-018 menu "..." bị cắt | CÒN | probe (scratchpad probe-ux.js): note 300x220 thấy 4/11 mục, "Xoá note" ngoài khung (scroll 409 > 176); 220x160 thấy 2/11. note.css:107 không đổi. Ảnh: docs/rooms/qa/img/l2-note-menu-300x220.png |
| BUG-019 panel nhắc ở note nhỏ | CÒN | probe: 300x220 và 220x160, nút Lưu/Tắt nhắc/Xong ngoài vùng nhìn (scroll 227 > 178). Ảnh: docs/rooms/qa/img/l2-note-nhac-300x220.png |
| BUG-026 "quá hạn 0/1 giây" | CÒN | probe: chip "09:15 hôm nay · quá hạn 2 giây"; note.js:398, `P.dur(1000)` = "1 giây". |
| BUG-027 từ "Đang dán/Đang cất", tooltip X | CÒN | probe: chip "Đang dán 2 / Đang cất 0", nút "Cất"/"Xoá", tooltip X "Cất note (Ctrl+W)" (không nói note còn trong danh sách). |
