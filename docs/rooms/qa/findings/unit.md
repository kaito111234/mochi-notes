## unit — lượt 2 (main @70ebdd3)
- Lệnh: `node test/unit/run.js` (mọi `test/unit/*.test.js`, lần lượt TZ=Asia/Ho_Chi_Minh rồi America/New_York; run.js tự quét file mới). Từng file: `TZ=... node --test test/unit/<f>.test.js`.
- Kết quả: 245 test/TZ. HCM: 226 pass, 12 fail, 7 skip (ca DST chỉ chạy ở New_York). New_York: 233 pass, 12 fail. Hai TZ cho cùng 12 ca đỏ.
- File: stage (22, xanh), recur (32, xanh), parse (~100), store (25), MỚI `store-recovery.test.js` (18, xanh), MỚI `understand.test.js` (44, 4 đỏ).
- Lượt 1: 14 đỏ -> lượt 2 phân loại từng ca (dưới). Đã đóng các lỗi lượt 1 phía parse (BUG-003, 004 trừ "nửa đêm", 011 ở parse.analyze, 010 phần lớn).

### 1. Phân loại 14 ca đỏ ban đầu
| Ca | Kết luận | Xử lý |
|---|---|---|
| store: vòng đi vòng về | Đặc tả đổi có chủ ý (01-data.md: thêm `reminders[]`, `remindMuted`, id `r1`) | Cập nhật kỳ vọng, comment lý do |
| store: reminder due sai kiểu... | Có chủ ý (nhắc duy nhất được cấp id `r1`) | Cập nhật kỳ vọng |
| store: file hỏng JSON; gốc là mảng | Có chủ ý: không còn `.bak`, thay bằng `mochi-data.corrupt-*.json` + khôi phục `backups/` | Viết lại 2 test theo đặc tả |
| store: settings khoá lạ | Có chủ ý (01-data.md: khoá lạ được giữ) | Đổi kỳ vọng: giữ khoá lạ, khoá biết sai kiểu vẫn về mặc định |
| store: trường lạ trên note/reminder | LỖI THẬT còn (F-unit-8, BUG-031) | Giữ đỏ |
| parse: "nửa tiếng nữa", "nua tieng nua" | LỖI THẬT (null) | Giữ đỏ |
| parse: "1h30 nữa họp" | LỖI THẬT (13:30 thay vì 11:30) | Giữ đỏ |
| parse: "20-10 9h" | LỖI THẬT (ra 21:00 hôm nay, mất ngày) | Giữ đỏ |
| parse: "nửa đêm" | LỖI THẬT (ra 22:00; "12h đêm"/"0h"/"2h đêm" đã đúng) | Giữ đỏ |
| parse: "đọc 3/4 cuốn sách", "chia 1/2 cái bánh" | LỖI THẬT (ra 3/4/2027, 1/2/2027) | Giữ đỏ |
| parse: ngày vô lý 32/1, 30/2, 13/13 | Một phần sửa: 32/1 -> null; "30/2 họp 9h", "13/13 9h" ngày bị bỏ nhưng giờ 9h vẫn nhận (21:00 hôm nay), hết cuộn sang ngày xa | Nới kỳ vọng (null hoặc trong 24h), ghi comment; 32/1 vẫn đòi null |

### 2. Đối chiếu lỗi cũ
| Mã | Trạng thái | Chứng cứ |
|---|---|---|
| BUG-002 | MỘT PHẦN | "500g", "50-60k", "2-3 lần" hết nhận; "3/4", "1/2" còn thành ngày 2027 (parse.test.js ca 79, 80 đỏ). understand.js thì không nhận (xanh) |
| BUG-003 | ĐÃ SỬA | "thứ 6 tuần sau 9h" = 23/10 09:00 (xanh) |
| BUG-004 | MỘT PHẦN | "0h", "12h đêm", "2h đêm" đúng; "nửa đêm" còn sai (22:00) — ca 51 đỏ |
| BUG-005 | CÒN | "1h30 nữa họp" vẫn 13:30 (ca 8 đỏ) |
| BUG-009 | MỘT PHẦN | "1 tiếng rưỡi nữa", "sau 5 phút..." đúng; "nửa tiếng nữa" vẫn null (ca 6 đỏ) |
| BUG-010 | MỘT PHẦN | "hop 3h chieu nay", "thu 6 10h30", "goi khach 2 phut nua", "8 gio toi" đúng; "nua tieng nua" còn null (ca 64 đỏ) |
| BUG-011 | MỘT PHẦN | parse.analyze: "tối ưu", "sáng tạo", "chiều dài", "năm nay", "16:9" hết nhận. NHƯNG `understand()` (đường Ghi nhanh/gợi ý) còn sinh mục: xem N-unit-1 |
| BUG-012 | CHƯA KẾT LUẬN ở unit | `analyze` lúc 16:00 vẫn trả due 15:00 (quá khứ) và `understand` không gợi ý remind (đúng API2). Việc chip/nhắc dai có hiện hay không là E2E (scheduler.js:224, 271) |
| BUG-022 | ĐÃ SỬA | `store-recovery`: ngăn sai kiểu -> mặc định + cất nguyên bản `mochi-data.section-<tên>-*.json` (xanh) |
| BUG-031 | MỘT PHẦN | khoá lạ của settings đã giữ; trường lạ trên note/reminder vẫn mất (store.test ca "trường lạ" đỏ) |

### 3. Lỗi mới
#### N-unit-1: `understand()` coi "tối/sáng/chiều" đứng một mình là giờ -> nhắc rác
- Mức: Nặng (nhắc sai từ câu thường; Ghi nhanh/bé "ghi giúp" dùng chính hàm này)
- Phòng: notes (`src/shared/understand/index.js`, PER_ACC/PERIOD_DEFAULT ~dòng 62-70)
- Tái hiện: `node --test test/unit/understand.test.js` (4 ca đỏ). `understand('tối ưu website')` -> mục "Ưu website" 20:00 + gợi ý `remind:k:uu website`; "sáng tạo nội dung" -> 08:00; "đo chiều dài bàn" -> 15:00; "ưu tiên sáng tạo" -> 08:00.
- Kỳ vọng: không có mục/gợi ý (như `parse.analyze`, đã không nhận các câu này). "tối nay ăn gì" thì hợp lệ (20:00).
- Thực tế: tiêu đề còn bị cắt mất chữ ("Ưu website", "Tạo nội dung").
- Độ chắc: 3/3, hai TZ. Ảnh: không (logic thuần).

### 4. Test mới đã thêm
- `understand.test.js` (44): nhiều việc/dòng, key ổn định/#2, ngày chung "Mai:"/"Thứ 6:", checklist nhiều ký hiệu, SĐT/tiền/link/email/#thẻ/người/nơi/ưu tiên, gợi ý (remind, remind-all, split, alarm, checklist, call/message/link/email), 18 câu thường mỗi câu một test, phân số, đầu vào rác (null/số/lone surrogate/100KB/5000 dòng/XSS), giới hạn ≤100 mục, entities.js chịu rác, hành vi BUG-012.
- `store-recovery.test.js` (18): migrate reminder -> reminders[] (id `r1`, cùng tham chiếu primary), reminders[] là nguồn sự thật + sắp xếp, ≤20, id duy nhất/ổn định qua 3 vòng nạp-ghi, remindMuted ≤50; file hỏng -> khôi phục bản `backups/` hợp lệ mới nhất (bỏ bản hỏng), bản hỏng được giữ không ghi đè lần 2, tối đa 5 bản hỏng, bản hỏng không lọt backups/, không sao lưu file hỏng, ngăn sai kiểu cất ra file riêng, ngăn lạ giữ nguyên, chống `__proto__`.

### 5. Ghi chú
- Giờ đã qua: "họp 9h" lúc 10:00 trong câu nhiều giờ -> 21:00 cùng ngày (lượt 1 đã nêu, chấp nhận).
- `store.js` vẫn không export `normalizeNote`; test qua `createStore(thư mục tạm)`.
- `understand.test.js` dùng giờ giả 06:00 để "9h" không bị đẩy sang tối.
