## alarm-memo — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/alarm-memo.test.js` (~3,5 phút, có 1 ca chờ thật tới phút kế). Kết quả lần chạy cuối: 7 ca, **7 pass / 0 fail / 0 skip** (1b đã sửa assert của test rồi chạy lại riêng: pass).
- Lưu ý khung: test phải đặt `process.env.TZ='Asia/Ho_Chi_Minh'` (app.js ép TZ này cho app, còn tiến trình node test chạy UTC) — đã làm ở đầu file test. Ca có `seed` không có note thì không dùng `waitNotes`.
- Ca đã phủ: 1a báo thức 1 phút (tạo qua form, chờ thật, chuông ring.html + bus `alarm:ring` + stage `alarm`, Tắt -> tự tắt một lần); 1b Hoãn (snoozedUntil = bây giờ + snoozeMin, nút "Hoãn 10 phút", thẻ "Hoãn đến", kêu lại, hằng ngày dời đúng); 2 tạo nhanh ("6h30 sáng mai", "7h mỗi ngày thường", "8h tối hằng ngày", "6h30 sáng thứ 2, thứ 4"); 3 dặn dò startup; 4 tắt/bật/sửa/xoá + mở lại; 5a bù ≤30 phút; 5b >30 phút vào "Đã lỡ" (cả một lần và hằng ngày), nút Xoá mục lỡ.
- Hành vi dặn dò `when:'startup'` (ghi lại): popup hiện ~8 giây sau khi mở (`app:startup` + 8000ms), đặt `lastShownDay` ngay lúc hiện (không cần bấm "Nhớ rồi"); mở lại lần nữa cùng ngày KHÔNG hiện lặp; đặt `lastShownDay` về ngày cũ thì mở lại hiện lại. Memo không chọn "Chỉ một lần" vẫn chỉ hiện 1 lần/ngày. Đúng theo `memoLogic.eligibleToday`.
- Hành vi bù báo thức: trễ 10 phút -> kêu ngay khi mở, không ghi lỡ; trễ 45 phút -> không kêu, thêm vào `missed` + thông báo; báo thức hằng ngày bị lỡ vẫn dời sang lần kế.
- Các ca đúng ý: chuông chỉ trễ <5 giây so với nextAt; báo thức một lần tự `enabled:false, nextAt:null` ngay lúc kêu; Hoãn xoá/đặt snoozedUntil đúng.

### F-alarm-memo-1: Cửa sổ chuông che gần hết bé Mochi và cắt bong bóng thoại của bé
- Mức: Vừa
- Phòng: điều hành (đặt vị trí) / notes (alarmService) / core (vị trí bé) — cần thống nhất vùng
- Tái hiện: test `1a` (xanh vì không assert vị trí) — tạo báo thức phút kế, chờ tới giờ, xem ảnh `test/e2e/out/am-1a-chuong.png`. Hoặc: `MOCHI_DEV_ALARM=1` rồi chờ.
- Kỳ vọng: chuông báo hiện mà bé (đang diễn "Đến giờ rồi nè: báo thức…") và bong bóng vẫn nhìn thấy/bấm được.
- Thực tế: cửa sổ chuông 360x236 đặt góc dưới phải (1064,648) màn 1440x900, trùng với cửa sổ bé (1140,507, 300x397): chuông phủ ~60% thân bé; bong bóng thoại (nằm ở y~600–690) bị cắt cụt ở mép trên chuông ("Họp nhóm, 08:33!" chỉ thấy nửa dòng). Bé thành bị che, nút trên bong bóng (nếu có) không bấm được.
- Nguyên nhân khả dĩ: `src/main/alarms/alarmService.js:44-47` (`placeRing` luôn đặt sát góc dưới phải workArea, `alwaysOnTop 'screen-saver'`) không né cửa sổ bé; bé cũng đứng góc đó. Memo có `RING_OFFSET` né chuông (`memoService.js:17`) nhưng chuông không né bé.
- Ảnh: docs/rooms/qa/img/alarm-memo-chuong-che-be.png
- Độ chắc: đã tái hiện 2/2 lần (1a hai lần chạy, cùng bố cục)

### F-alarm-memo-2: Thẻ dặn dò trên tay bé hiện "NaN:NaN · undefin…"
- Mức: Nhẹ
- Phòng: core (stage) — hợp đồng sự kiện `memo:due` do notes phát
- Tái hiện: test `3` (xanh), ảnh `test/e2e/out/am-3-memo-popup.png`: tạo dặn dò "Khi mở máy", mở lại app, chờ ~10 giây; tờ giấy vàng "Dặn dò" bé cầm có dòng dưới "NaN:NaN · undefin…".
- Kỳ vọng: dòng meta là nhãn khung giờ ("Khi mở máy") hoặc giờ hợp lệ.
- Thực tế: hiển thị NaN:NaN và "undefin…".
- Nguyên nhân khả dĩ: `memoService.js:76` phát `memo:due` với `when` là khoá khung giờ ('startup'/'morning'…), trong khi `src/main/pet/stage.js:108` (`P.hm(p.when)`) và `stage.js:331` (`P.whenLabel(p.when)`) coi `when` là mốc thời gian (epoch). Hai phòng hiểu `when` khác nhau.
- Ảnh: docs/rooms/qa/img/alarm-memo-popup-che-bong-bong-nan.png
- Độ chắc: đã tái hiện 2/2 lần

### F-alarm-memo-3: Popup dặn dò che nửa bong bóng thoại của bé
- Mức: Nhẹ
- Phòng: notes (memoService) / core
- Tái hiện: như F-2, cùng ảnh: popup 360x300 đặt ở (1064,334) trùng cửa sổ bé/bong bóng ở (1140,507…); chữ bong bóng ("…uống nước nha.", nút "Ừ, nhớ rồi") chỉ lộ phần dưới.
- Kỳ vọng: popup và bong bóng không chồng nhau (cả hai đều nói cùng một nội dung).
- Nguyên nhân khả dĩ: `memoService.js:20-23,43-48` (`position` dựa RING_OFFSET=250 cố định, không biết vị trí/cỡ cửa sổ bé).
- Ảnh: docs/rooms/qa/img/alarm-memo-popup-che-bong-bong-nan.png
- Độ chắc: đã tái hiện 2/2 lần

### Ghi chú (không phải lỗi)
- Ảnh `docs/rooms/qa/img/alarm-memo-da-lo.png`: mục "Đã lỡ" hiển thị đúng.
- Thông báo Windows dự phòng không kiểm được dưới xvfb (Notification không hiện); chưa có test cho nhánh `mascotEnabled:false`.
- Âm thanh chuông (WebAudio) không kiểm được dưới xvfb; chỉ kiểm cửa sổ/dữ liệu.
