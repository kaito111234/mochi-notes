## notes2 — lượt 3 (main mới)
- Lệnh: `bash test/e2e/run.sh test/e2e/notes2.test.js`. Kết quả: 11 test, 11 pass, 0 fail. Chạy 2 lần (lần 1 trước, lần 2 sau sửa timeout), đều xanh.
- notes2-6 (ĐỎ MỚI trong bộ đầy đủ -> LỖI KHUNG/TẢI, không phải lỗi thật): "Hết giờ chờ xem trước không dấu" = đợi `#qcPrev` "Bé hiểu: 2 việc" quá 10s lúc cả bộ E2E chạy nặng trên 2 CPU. Kiểm riêng: `understand('hop 9h sang mai, 2h chieu goi khach')` ra đúng 2 việc 09:00/14:00; list.js:586 vẫn "Bé hiểu"; không đổi hành vi từ Đợt 3. Xanh 2/2 khi chạy riêng. Chỉ nới `waitFor` xem trước lên 40s; kỳ vọng giữ nguyên. Nếu đỏ lại khi tải thấp thì mở lỗi.

# QA lượt 2 — phòng notes Đợt 2/2B (test mới)

File test: `test/e2e/notes2.test.js` (11 test). Chạy: `bash test/e2e/run.sh test/e2e/notes2.test.js`.
Kết quả: **11/11 xanh** (≈ 6 phút trên máy 2 CPU; notes2-5 chờ ~60s vì `note:expired` phát sau 60s khởi động).
Dữ liệu thử: TZ Etc/GMT để giờ app ≈ 06:xx (mốc 9h/14h/20h hôm nay đều ở tương lai).

| Test | Kịch bản | Kết quả |
|---|---|---|
| notes2-1 | Ô "Ghi nhanh": gõ "họp 9h, 14h gọi khách, tối 8h đi tập" -> xem trước "Bé hiểu: 3 việc · 09:00 Họp · 14:00 Gọi khách · 20:00 Đi tập"; Enter -> note có 3 nhắc 09:00/14:00/20:00, toast "Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách…" | xanh |
| notes2-1b | `ctx.notes.quickCapture`: reply 3 việc ≤120 ký tự, 1 việc "Tớ ghi rồi nha. 15:00 tớ nhắc cậu gọi mẹ", không giờ (persona), rỗng -> ok:false; `source:'pet'` + ẩn hết không mở cửa sổ, vẫn ẩn hết | xanh |
| notes2-2 | Note 4 nhắc: chip "+3", chi tiết 4 hàng đúng giờ/tiêu đề, Xong mục 1 (chip -> +2), Hoãn 10p mục 3 (due ≈ now+10p), gõ thêm dòng mới + sửa dòng đầu: id/done/preFired giữ nguyên, ≤20 nhắc (tay và auto), file có cả `reminders` và `reminder` | xanh |
| notes2-2b | Xoá nhắc tự động -> `remindMuted`, sửa chữ không tạo lại | xanh |
| notes2-3 | Dải gợi ý trong cửa sổ note: remind ("2 việc có giờ — bé nhắc nha?" + Tạo -> 2 nhắc, dải ẩn, không còn đề xuất trùng), checklist (-> "- [ ] ..." 3 dòng), số điện thoại (hiện số, `applySuggestion` chép clipboard) | xanh |
| notes2-3b | `applySuggestion`: alarm (06:30, bấm 2 lần không tạo trùng), split (3 note, mỗi việc đúng 1 note), link/email có gợi ý, `link:javascript:` bị từ chối, gợi ý/ note không tồn tại -> ok:false | xanh |
| notes2-4 | Thùng rác: seed 40 ngày bị dọn khi mở, 29 ngày còn; xoá qua UI (chữ "Chuyển vào thùng rác?"), `note:trashed`, cửa sổ đóng, chip "Thùng rác" 2 thẻ, Khôi phục (nội dung nguyên, `note:restored`, mở lại cửa sổ), Xoá hẳn cần 2 lần bấm, thùng trống | xanh |
| notes2-4b | Note trong thùng (seed) và note vừa xoá có nhắc đến hạn: không có `reminder:pre/due`, không thông báo Windows; khôi phục giữ nhắc | xanh |
| notes2-5 | `expiredCandidates`: done / overdue (>24h) / checklist đúng; không hỏi note mới sửa <10 phút, note đã cất, nhắc lặp, note còn nhắc tương lai; `note:expired` phát đúng 1 lần/note sau ~60s; không mất note/chữ, không tự vào thùng; IPC `notes2.expired` | xanh |
| notes2-6 | Gõ thật trong cửa sổ note: "hop 3h chieu mai" -> chip "15:00 ngày mai"; "ng mai 9g30 goi a Nam" -> "09:30 ngày mai"; "t2 8h nop bao cao" -> 08:00 thứ 2 trong 7 ngày; ghi nhanh không dấu 2 việc | xanh |
| notes2-7 | `list:tab` (alarms/memos/note/tab lạ), `onListTab`, `ctx.list.open(tab)` khi đã mở và khi mở mới, menu khay | xanh |

## Lỗi mới
Không có lỗi Nặng/Vừa. Mọi kỳ vọng theo đặc tả đều đạt. Ghi chú nhỏ (không để test đỏ):

- N-notes2-1 (Nhẹ, phòng notes, `src/shared/understand/index.js`): "họp 9h sáng và 3h chiều" chỉ ra 1 mục (09:00); mốc 15:00 mất vì mệnh đề thứ hai không có nội dung riêng ("họp 9h sáng và 3h chiều gọi khách" thì ra 2 mục). Tái hiện: `node -e` với `understand('họp 9h sáng và 3h chiều')`. Kỳ vọng: 2 nhắc cùng tiêu đề "Họp". Chưa có test đỏ (chưa rõ đặc tả có coi là lỗi).
- Quan sát (không phải lỗi): với ghi nhanh không có giờ, `reply` là câu persona ("Ừm, tớ nhớ rồi. Cậu yên tâm.") chứ không phải "Tớ ghi rồi nha: <tiêu đề>" — API2.md cho phép (dùng `persona.pick('note_created')` nếu trả câu), nên test chỉ kiểm độ dài/không lỗi mẫu.
- Quan sát: gõ nối vào cuối dòng có giờ ("21h30 đọc sách" + " nhớ mang laptop") đổi tiêu đề nhắc thành "Đọc sách nhớ mang laptop" nhưng giữ id và trạng thái — đúng thiết kế.
- Nút Xoá/Chi tiết ở thẻ danh sách chỉ bấm được khi rê chuột (hover) — đúng thiết kế; test phải `hover` trước.

## Ảnh
`test/e2e/out/notes2-3-strip.png`, `notes2-4-trash.png`, `notes2-6-*.png` (không lỗi nên không chép vào `docs/rooms/qa/img/`).
