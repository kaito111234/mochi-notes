## alarm-memo — lượt 3 (main sau Đợt 3)
- Lệnh: `bash test/e2e/run.sh test/e2e/alarm-memo.test.js` (~3 phút). Kết quả: 8 test, **7 pass, 1 fail**. Ca 6 (BUG-014) giữ đỏ, CÒN: `meta` tờ bé cầm = "NaN:NaN · undefined NaN/NaN" khi `when='startup'` (`src/main/pet/stage.js:331`, cũng `:137` dạng khác); bong bóng đúng. Các ca 1a-5b xanh.

---

## alarm-memo — lượt 2 (main @20ec6c9)
- Lệnh: `bash test/e2e/run.sh test/e2e/alarm-memo.test.js` (~3 phút, có ca chờ báo thức thật 1 phút). Kết quả: 8 test, **7 pass, 1 fail** (ca 6 mới = BUG-014). Ca 1b từng đỏ 1 lần dưới tải 2 CPU song song rồi xanh 3/3 lần chạy lại (nghi flaky do chậm, chưa tái hiện được nguyên nhân).
- Xanh: 1a (báo thức 1 phút thật: chuông trễ <5s, bé nhận `alarm:ring`, Tắt tự tắt), 1b Hoãn, 2 tạo nhanh bằng câu, 3 dặn dò startup (không lặp trong ngày), 4 tắt/bật/sửa/xoá, 5a kêu bù, 5b mục "Đã lỡ".

### BUG-014 CÒN: tờ "Dặn dò" bé cầm hiện chữ lỗi
- Ca 6. Thực tế `#nMeta` = "NaN:NaN · undefined NaN/NaN" (when='startup'; `src/main/pet/stage.js:108` và `:331` dùng `P.hm(p.when)` / `P.whenLabel(p.when)` trên chuỗi 'startup'/'evening' thay vì mốc thời gian). Bong bóng "À thì… cậu bảo tớ nhắc: Nhớ uống nước nha." đúng.
- Ảnh: `docs/rooms/qa/img/l2-alarm-tomemo-startup.png`. Phòng: core.

### Trạng thái lỗi cũ
- BUG-013 và BUG-015: xem `layout.md` — CÒN (chuông/popup vẫn che bé; nguyên nhân gốc: `ctx.pet.occupiedRect` chưa được core công bố nên `placement.js` luôn nhận `avoid=null`).
- Ghi nhận tốt: popup dặn dò KHÔNG chồng chuông (né nhau đúng).
