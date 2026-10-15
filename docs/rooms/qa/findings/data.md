## data — lượt 2 (main @20ec6c9, store 70ebdd3)
- Lệnh: `bash test/e2e/run.sh test/e2e/data.test.js` (~2 phút). Kết quả: 14 test, **13 pass, 1 fail** (6b mới = BUG-031 một phần).
- Cập nhật test theo đặc tả mới (có chủ ý): (1) ca 1 so note bỏ `reminder.id` và kiểm `reminders[]` (migration Đợt 2 thêm `id:'r1'` + `reminders[]`, API2.md mục 3); (2) ca 3d: ngăn `alarms` sai kiểu được cất nguyên bản vào `mochi-data.section-alarms-*.json` (store.js section(), 01-data.md) nên kiểm file đó thay vì `.bak`; ngăn `game` cho phép thêm khoá mặc định, chỉ kiểm `stats.candy===5`; (3) ca 3b thêm kiểm `store.recoveredFrom`/`corruptCopy` và file `mochi-data.corrupt-*.json`.
- Xanh: xuất/nhập (không nhân đôi), .txt/.md, khôi phục từ tab Dữ liệu (+before-restore), 4 kiểu file hỏng (cất bản hỏng), 3b (khôi phục b1,b2 từ backups, recoveredFrom có), 3c (2 lần hỏng giữ cả 2 bản), 3d, kill -9 x5, sao lưu 7 bản, migrate v1.

### N-data-1 = BUG-031 (MỘT PHẦN): khoá lạ trên note/reminder vẫn bị bỏ
- Mức: Nhẹ — Phòng: điều hành / notes (`src/main/store.js` chuẩn hoá note)
- Tái hiện: `bash test/e2e/run.sh test/e2e/data.test.js` ca 6b. Seed note có `xyzNote`, `reminder.xyzRem`, `settings.xyzSetting`.
- Kỳ vọng: giữ cả ba (hoặc ít nhất settings theo spec). Thực tế: `settings.xyzSetting=7` GIỮ (đúng spec 01-data.md dòng 77); `note.xyzNote` và `reminder.xyzRem` bị bỏ.

### Trạng thái lỗi cũ
- BUG-001 ĐÃ SỬA (3b xanh: mở app dùng backups/mochi-data-<hôm qua>.json, `recoveredFrom`+`corruptCopy` có giá trị).
- BUG-008 ĐÃ SỬA (3c xanh: 2 lần hỏng -> 2 bản `mochi-data.corrupt-*` giữ nguyên nội dung lần 1).
- BUG-022 ĐÃ SỬA (3d xanh: log `file cất: mochi-data.section-alarms-<giờ>.json | giữ bản gốc: true`; ngăn alarms vẫn được thay bằng mặc định nhưng bản gốc còn nguyên).
- BUG-031 MỘT PHẦN (xem trên).
