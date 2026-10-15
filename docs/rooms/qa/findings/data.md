## data — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/data.test.js` (file: `test/e2e/data.test.js`, 13 test). Kết quả lần chạy cuối: 11 pass, 2 fail (3b, 3c), 0 skip, 0 skip. Test 1b có 1/4 lần đỏ do chờ quá sớm (đã tăng thời gian chờ; không phải lỗi app).
- Kết quả theo kịch bản: 1 (xuất/nhập JSON, trùng 2 lần) pass; 1b (.txt/.md) pass; 2 (khôi phục qua UI) pass; 3 (4 kiểu file hỏng) pass — app mở được và giữ `.bak`; 3b, 3c FAIL (lỗi thật); 3d chỉ ghi nhận hành vi; 4 (kill -9 x5) pass; 5 (sao lưu 7 bản) pass; 6 (migrate) pass.
- Ghi chú khung: nhập/xuất dùng `MOCHI_DEV_TRANSFER/MOCHI_DEV_DIR/MOCHI_DEV_IMPORT` đặt vào `process.env` của main sau khi mở (tránh tự động xuất lúc khởi động), rồi bấm nút thật trong cài đặt của list. Mở sẵn bảng khôi phục cần `MOCHI_DEV_TAB=restore` kèm `MOCHI_DEV_LIST=1`.

### Hành vi đã ghi nhận (không phải lỗi)
- Nhập trùng 2 lần: toast "Đã nhập 0 note"; note, báo thức, dặn dò không nhân đôi (so id + nội dung).
- Nhập hồ sơ mới: note giữ nguyên html/màu/nhắc/lặp (`reminder.repeat`), báo thức/dặn dò đủ, noteMeta (zoom/khoá) giữ; nextAt báo thức tính lại.
- Khôi phục: chọn "tất cả" sẽ ghi đè note đã sửa và thêm lại note đã xoá; note mới hơn bản sao lưu được GIỮ (không phải "về đúng bản" tuyệt đối). Có `mochi-data-before-restore-*.json` chứa dữ liệu trước đó. Chỉ khôi phục note, không khôi phục báo thức/dặn dò.
- File hỏng (JSON cụt, rác nhị phân, `notes` là object, rỗng): app mở, 0 note, file hỏng được đổi tên `mochi-data.json.bak`; KHÔNG có note mẫu (firstRun=false).
- kill -9 x5 khi ghi liên tục (~50 note x ~100KB mỗi vòng): file luôn là JSON hợp lệ, số note không giảm.
- Sao lưu: tạo bản hôm nay ngay khi mở app (có lần ghi), giữ 7 bản, xoá bản cũ nhất trước.
- Migrate version 1/thiếu khoá: màu về `yellow`, bounds mặc định, version -> 2, ngăn lạ (`phongChuaCo`) và `game` giữ nguyên qua 2 lần mở/ghi. Mục note không có id bị bỏ âm thầm. Trường lạ trong từng note (vd `pinned` của bản tương lai) và khoá lạ trong `settings` bị bỏ khi ghi (không giữ).

### F-data-1: File dữ liệu hỏng — không dùng lại bản sao lưu gần nhất, người dùng thấy mất sạch note
- Mức: Nặng (gần Chặn: dữ liệu vẫn còn trong `.bak` và `backups/` nhưng người dùng không có cách tự lấy lại trong giao diện)
- Phòng: điều hành (store.js)
- Tái hiện: seed `backups/mochi-data-<hôm qua>.json` có 2 note, ghi `mochi-data.json` = `{"version":2,"notes":[{"id":"x1"` rồi mở app. Test đỏ: `3b`.
- Kỳ vọng: khi file chính hỏng, nạp bản sao lưu hợp lệ gần nhất (hoặc báo người dùng và gợi ý khôi phục).
- Thực tế: app mở với 0 note, không thông báo gì, không có note mẫu. Lần ghi kế tiếp tạo file mới; bản sao lưu hằng ngày kế tiếp (mỗi ngày 1 bản, quay vòng 7) cuối cùng sẽ chứa trạng thái rỗng; sau 7 ngày bản tốt bị xoá.
- Nguyên nhân khả dĩ: `src/main/store.js:~76-82` (khối catch của `load()` chỉ đổi tên file thành `.bak`, không đọc `backups/`).
- Ảnh: docs/rooms/qa/img/data-hong-co-backup-mat-note.png
- Độ chắc: 3/3 lần.

### F-data-2: `.bak` bị ghi đè khi file hỏng lần thứ hai
- Mức: Nặng
- Phòng: điều hành (store.js)
- Tái hiện: ghi file hỏng A, mở/đóng app; ghi file hỏng B, mở/đóng app. Test đỏ: `3c`. Chỉ còn 1 bản giữ file hỏng (của B), nội dung A mất.
- Kỳ vọng: không ghi đè bản giữ lại (đặt tên có mốc thời gian, vd `mochi-data.json.bak-<stamp>`).
- Thực tế: `renameSync(file, file + '.bak')` thay thế `.bak` cũ.
- Nguyên nhân khả dĩ: `src/main/store.js:~82`.
- Độ chắc: 3/3 lần.

### F-data-3: Ngăn của phòng sai kiểu bị thay bằng mặc định rồi ghi đè, không giữ bản gốc
- Mức: Vừa
- Phòng: điều hành (store.js `section()`) / notes (box.js normalize)
- Tái hiện: `{"notes":[...],"alarms":"hỏng"}` rồi mở app và ghi. Test `3d` ghi nhận (không đỏ): `alarms` thành mặc định, không có `.bak`/bản lưu chứa chuỗi gốc. Tương tự, `notes` là object thì cả ngăn alarms nằm trong `.bak` nhưng không được nạp lại.
- Kỳ vọng: khi normalize ném lỗi, giữ bản gốc ngăn đó (vd ghi `<ngăn>.invalid` hoặc `.bak`) trước khi ghi đè.
- Nguyên nhân khả dĩ: `src/main/store.js:~150` (`catch (_) { value = defaults(); }`).
- Độ chắc: 2/2 lần.

### F-data-4 (Nhẹ, ghi chú): trường lạ trong note/settings không được bảo toàn khi ghi
- Mức: Nhẹ; Phòng: điều hành. `normalizeNote` (store.js:~34) và vòng lặp settings (store.js:~71) chỉ giữ khoá đã biết; bản app cũ mở dữ liệu của bản mới sẽ làm mất trường mới. Không có test đỏ (chỉ ghi nhận).
