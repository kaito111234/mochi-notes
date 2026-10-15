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
