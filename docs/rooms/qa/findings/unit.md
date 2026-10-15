## unit — tóm tắt
- Lệnh: `node test/unit/run.js` (chạy mọi `test/unit/*.test.js` lần lượt với TZ=Asia/Ho_Chi_Minh rồi America/New_York; thoát 1 nếu lỗi). Từng file: `TZ=... node --test test/unit/parse.test.js`.
- Kết quả: 183 test/TZ. Asia/Ho_Chi_Minh: 146 pass, 30 fail, 7 skip (ca DST chỉ chạy ở New_York). America/New_York: 153 pass, 30 fail, 0 skip.
- File: `stage.test.js` (22 test, xanh hết), `parse.test.js` (~100 ca, 29 đỏ), `store.test.js` (25 test, 1 đỏ), `recur.test.js` (32 test, xanh hết cả hai TZ: DST, cuối tháng, năm nhuận, weekdays).
- `store.js` không export normalizeNote/normalizeReminder nên test qua nạp file bằng `createStore(thư mục tạm)`. `stage.js` test bằng ctx/actor/Notification giả (không cần Electron), `timeScale` nhỏ.
- Giờ giả cho parse: Thứ Năm 15/10/2026 10:00 giờ máy (truyền `now` vào `analyze`).
- Không có lỗi ở stage.js, recur.js, store.js (trừ F-unit-8 Nhẹ). Toàn bộ lỗi nằm ở `src/shared/parse.js` (phòng notes).

### F-unit-1: "thứ N tuần sau/tới" bị hiểu thành "N tuần nữa"
- Mức: Nặng
- Phòng: notes
- Tái hiện: `analyze('thứ 6 tuần sau 9h', now)`; test đỏ: `giờ: "thứ 6 tuần sau 9h"`, `"thứ 2 tuần sau 9h"`, `"thứ 4 tuần tới 14h"`.
- Kỳ vọng: thứ 6 tuần sau = 23/10/2026 09:00. Thực tế: 26/11/2026 (6 tuần sau), mất cả giờ (timed=false) vì nhánh "N tuần sau" bắt trước.
- Nguyên nhân khả dĩ: src/shared/parse.js:46 regex `(\d+)\s*(...|tuần)\s*(nữa|sau|tới)` khớp "6 tuần sau" trong "thứ 6 tuần sau"; cần loại trường hợp đứng sau "thứ" (lookbehind) hoặc xử lý "thứ N" trước. (Dạng chữ "thứ hai tuần sau" đúng.)
- Độ chắc: 3/3 lần, cả 2 TZ.

### F-unit-2: Số kèm đơn vị "500g" bị đọc thành giờ 00:00
- Mức: Nặng (nhắc nhầm từ số thường)
- Phòng: notes
- Tái hiện: `analyze('mua 500g thịt', now)` -> due 12:00 hôm nay, timed. `analyze('mua 500g thịt lúc 5h chiều')` -> 12:00 thay vì 17:00. Test đỏ: `không phải giờ: "mua 500g thịt"`, `giờ: "mua 500g thịt lúc 5h chiều"`.
- Kỳ vọng: không có nhắc / 17:00. Thực tế: "00g" khớp `(\d{1,2})\s*g`.
- Nguyên nhân khả dĩ: parse.js:62 regex giờ không có biên trái (`(?<!\d)`) và nhận `g` là "giờ".
- Độ chắc: 3/3.

### F-unit-3: Phân số/khoảng số bị đọc thành ngày
- Mức: Nặng (nhắc nhầm từ số thường)
- Phòng: notes
- Tái hiện: "đọc 3/4 cuốn sách" -> 3/4/2027; "chia 1/2 cái bánh" -> 1/2/2027; "giá 50-60k" -> năm 2031; "tập 2-3 lần mỗi tuần" -> 2/3/2027; "32/1 họp" -> 1/2/2027; "30/2 họp 9h" -> 2/3/2027; "13/13 9h" -> 13/1/2027. Test đỏ: `không phải giờ: ...` và `ngày không tồn tại / vô lý ...`.
- Kỳ vọng: không nhận (ngày>31/tháng>12/ngày không tồn tại, hoặc số đứng giữa chữ không phải ngày tháng) -> due=null. Thực tế: Date tự cuộn ngày, ra nhắc xa vô nghĩa.
- Nguyên nhân khả dĩ: parse.js:46-49 không kiểm tra phạm vi ngày/tháng và không kiểm tra Date có khớp lại (new Date(y,m-1,d).getDate()===d).
- Độ chắc: 3/3.

### F-unit-4: "0h", "12h đêm", "2h đêm", "nửa đêm" sai giờ
- Mức: Nặng (sai giờ hẳn)
- Phòng: notes
- Tái hiện: `analyze('0h')` -> 12:00 hôm nay (kỳ vọng 00:00 ngày mai). `'12h đêm'` -> 12:00 trưa (kỳ vọng 00:00). `'2h đêm'` -> 14:00 (kỳ vọng 02:00 ngày mai). `'nửa đêm'` -> null (kỳ vọng 00:00 ngày mai). Test đỏ cùng tên.
- Nguyên nhân khả dĩ: parse.js:76-79 mọi "đêm/khuya" có h<12 đều +12; không xử lý 12h đêm = 0h và đêm 1-5h là rạng sáng; parse.js:84 `h<12 && d+12h>now` đổi "0h" thành 12:00. recur.js:242 xử lý đêm/khuya đúng hơn — nên dùng chung logic.
- Độ chắc: 3/3.

### F-unit-5: "1h30 nữa", "1 tiếng rưỡi nữa", "nửa tiếng nữa", "sau 5 phút" không hiểu / sai giờ
- Mức: Nặng cho "1h30 nữa họp" (hiểu thành 13:30 thay vì 11:30), Vừa cho các câu còn lại (không nhận ra -> không có nhắc)
- Phòng: notes
- Tái hiện: `analyze('1h30 nữa họp')` -> 13:30 (kỳ vọng 11:30). `'1 tiếng rưỡi nữa'` -> null. `'nửa tiếng nữa'` -> null. `'sau 5 phút nhắc tôi gọi mẹ'` -> null (kỳ vọng 10:05).
- Nguyên nhân khả dĩ: parse.js:46 chỉ khớp `<số> <đơn vị> <nữa|sau|tới>` liền nhau; thiếu dạng "sau N đơn vị", "N giờ M nữa", "rưỡi", "nửa tiếng".
- Độ chắc: 3/3.

### F-unit-6: Từ thường chứa buổi trong ngày bị coi là giờ (sáng/tối/chiều/nay)
- Mức: Vừa
- Phòng: notes
- Tái hiện: "tối ưu website" -> 20:00 hôm nay; "sáng tạo nội dung" -> 08:00 (hoặc mai); "đo chiều dài bàn" -> 15:00; "kế hoạch năm nay" -> 21:00 hôm nay; "tỷ lệ 16:9" -> 16:09 hôm nay. Tạo nhắc tự động nhầm từ ghi chú bình thường.
- Kỳ vọng: không có nhắc (hoặc chỉ khi đi cùng giờ/ngày rõ ràng, "tối ưu" không phải buổi tối, "năm nay" không phải "hôm nay").
- Nguyên nhân khả dĩ: parse.js:65 (`/sáng|trưa|chiều|tối|đêm|khuya/` không có biên từ/ngữ cảnh), parse.js:63 (`/hôm nay| nay /`), parse.js:67 regex giờ nhận `:` cho "16:9".
- Độ chắc: 3/3.

### F-unit-7: Gõ không dấu không được hiểu (người dùng Việt hay gõ không dấu)
- Mức: Vừa
- Phòng: notes
- Tái hiện: "hop 3h chieu nay" (ra chiều thiếu: 10:00/mai?), "8 gio toi", "thu 6 10h30", "nua tieng nua", "goi khach 2 phut nua", "mai 9h hop" (đúng giờ nhưng intent = task thay vì meet). Test đỏ cùng tên.
- Kỳ vọng: hiểu như bản có dấu (recur.js đã có strip() không dấu, parse.js thì không).
- Nguyên nhân khả dĩ: parse.js:41, INTENTS (parse.js:10-18) và các regex chỉ có dấu; nên chuẩn hoá NFD+bỏ dấu như recur.js:170.
- Độ chắc: 3/3.

### F-unit-8: Trường lạ trên note/reminder bị loại khi nạp-ghi lại
- Mức: Nhẹ
- Phòng: notes (normalizeNote/normalizeReminder)
- Tái hiện: nạp note có `pinned:true`, `reminder.snoozedUntil:99` rồi `save()+flushSync()` -> mất. Test đỏ: `trường lạ trên note/reminder ... không bị mất khi nạp-ghi`.
- Kỳ vọng: giữ trường chưa biết (bản mới ghi, bản cũ mở lại rồi ghi sẽ làm mất dữ liệu). Hợp đồng 01-data chỉ bảo đảm ngăn lạ cấp cao (test ngăn lạ xanh), nên mức Nhẹ.
- Nguyên nhân khả dĩ: store.js:29-35 và 41-56 dựng object mới chỉ với trường đã biết.

### Ghi chú (không phải lỗi)
- Giờ đã qua trong ngày: "họp 9h" lúc 14:00 -> 21:00 cùng ngày (chấp nhận); "9h sáng" lúc 10:00 -> mai 9:00 (đúng). "tối nay 8h" lúc 21:00 hoặc "9h sáng nay" lúc 10:00 trả due trong quá khứ (không assert, nhắc ngay) — nên để phòng notes cân nhắc.
- stage.js: toàn bộ 22 test xanh (ưu tiên, ngắt/quay lại, ttl, nhắc >=60 không bỏ, cancel, chống trùng alarm/memo, thông báo dự phòng, actor lỗi).
- recur.js: toàn bộ xanh ở cả hai múi giờ (DST New_York 8/3 và 1/11/2026, 31 hằng tháng, 29/2 nhuận, 2100 không nhuận, weekdays qua cuối tuần/tháng/năm).
