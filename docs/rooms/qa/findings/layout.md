## layout — lượt 3 (main sau Đợt 3, notes né bounds cửa sổ bé)
- Lệnh: `bash test/e2e/run.sh test/e2e/layout.test.js` (~45 s). Kết quả: 5 test, **4 pass, 1 fail** (ca 1: core chưa công bố `ctx.pet.occupiedRect`, `occupied=null`). Ca 2, 3, 4, 5 XANH.
- Số đo (màn 1440x900): pet 1140,475 300x430; chuông 1064,197 360x262 (trên đầu cửa sổ bé, trước đây 1064,622); popup dặn dò một mình 1064,139 360x320; khi có cả hai: chuông 1064,197, popup 764,564 (trái bé). Khi bé di chuyển lên 1094,113 thì chuông dời xuống 1064,622 (né). Không cái nào chồng cửa sổ bé (cửa sổ bé bao cả thân + bong bóng).
- Xem ảnh `docs/rooms/qa/img/l3-layout-all.png`, `l3-layout-move-sau.png`: chuông và popup KHÔNG che bé và bong bóng; chỉ chồng lên note vàng phía trên (chấp nhận được, cửa sổ nổi trên cùng).
- **BUG-013 và BUG-015: ĐÃ SỬA phía notes** (né bằng bounds cửa sổ bé, dời khi `pet:moved`). Phần còn lại: core chưa công bố `occupiedRect` (ca 1 đỏ, mức Nhẹ) nên vùng né là cả cửa sổ 300x430 (rộng hơn thân bé; không gây sai, chỉ chừa dư chỗ).
- Quan sát thêm: ảnh `l3-layout-all.png` tờ Dặn dò bé cầm vẫn có chữ "NaN:NaN · undefin…" (BUG-014, xem alarm-memo).

---

## layout — lượt 2 (mới) `test/e2e/layout.test.js`
- Lệnh: `bash test/e2e/run.sh test/e2e/layout.test.js` (~50 giây, MOCHI_DEV_RING/MOCHI_DEV_MEMO). Kết quả: 5 test, **0 pass, 5 fail** (cùng một gốc).
- Cách đo: `BrowserWindow.getBounds()` của ring.html / memo.html / pet.html trong main; vùng bé = `ctx.pet.occupiedRect()` nếu có, không thì cửa sổ pet.html (trong suốt, bao cả thân bé + bong bóng); chờ bố cục đứng yên 6 lần liên tiếp.
- Số đo (màn 1440x900, workArea 0,0 1440x900): pet 1140,475 300x430; chuông 1064,622 360x262; popup dặn dò 1064,564 360x320 (một mình) hoặc 1064,286 (khi có chuông). Chuông và popup nằm trọn workArea và popup né chuông (đạt); nhưng cả hai chồng vùng bé.

### N-layout-1 (= BUG-013, BUG-015 CÒN): `ctx.pet.occupiedRect` + `pet:moved` chưa được core công bố -> chuông/popup che bé
- Mức: Vừa — Phòng: core (`src/main/petcore/index.js` Object.assign(ctx.pet…), hợp đồng `docs/rooms/core.md` mục 5; notes đã nối sẵn ở `alarmService.js:58,74` và `memoService.js:49,71`)
- Tái hiện: ca 1 (`occupiedRect` không tồn tại), ca 2 (chuông chồng bé), ca 3 (popup chồng bé), ca 4 (cả ba), ca 5 (bé di chuyển + `pet:moved`: chuông không dời).
- Kỳ vọng: không chồng; dời theo khi bé đi. Thực tế: `placeAvoiding(workArea,size,null)` -> góc dưới phải, đè gần hết bé; popup đè luôn bong bóng (bong bóng chỉ lộ vài chữ dưới popup).
- Ảnh: `docs/rooms/qa/img/l2-layout-ring.png`, `l2-layout-memo.png`, `l2-layout-all.png`, `l2-layout-move-sau.png`.
- Lưu ý: khi core công bố, nên kiểm lại ca 5 (test phát `pet:moved` sau khi dời cửa sổ bé; nếu core dùng tên sự kiện/khoá khác, sửa test theo).
