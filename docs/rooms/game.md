# Phòng 7 — Game hóa (`room/game`)

**Sứ mệnh**: làm việc thật → được thưởng → chăm và diện đồ cho bé Mochi. Vui, nhẹ nhàng, **không phạt** (CLAUDE.md), và **không bao giờ ảnh hưởng nhắc lịch**.
Đọc trước: `CLAUDE.md`, `docs/spec/*` (01 ngăn `game`, 02 sự kiện `game:*`), `docs/persona/MOCHI.md`, `docs/rooms/art.md` (lộ trình quần áo), `docs/VPET-NOTES.md` (cơ chế chỉ số, đồ ăn chống lặp).
File được sửa: `src/main/game/**`, `src/game/**`, `assets/game/**`, `docs/rooms/game*`, khối preload `PHÒNG game`.

## Đợt 2 — việc cần giao
1. **Kinh tế xu** (ngăn `game`): nhận xu khi xong note (+10), xong đúng hạn (+5), mỗi mục checklist (+2), xong việc dài hạn (+20), chuỗi ngày liên tục (thưởng ngày 3/7/30), lần đầu dùng tính năng. Nghe bus: `reminder:done`, `note:checkItem` (paper), `note:created`, `alarm:stopped`. Chống "cày": tối đa xu/ngày từ note tạo-rồi-xoá-ngay (note phải tồn tại ≥ 2 phút, mỗi note thưởng 1 lần). Phát `game:reward`, `game:levelup`, `game:mode` (mode từ chỉ số mood/energy — xem 01-data).
2. **Chỉ số bé nhẹ nhàng**: tâm trạng tăng khi được xoa đầu/cho ăn/khi cậu xong việc; năng lượng giảm chậm khi thức, hồi khi bé ngủ. Không ốm, không chết, không bỏ đi.
3. **Cửa sổ "Phòng của Mochi"** (`src/game/`): mở từ menu khay / menu chuột phải trên bé (đề xuất cho core/điều hành) / phím tắt đề xuất Ctrl+Alt+G. Gồm các tab:
   - **Tủ đồ**: xem trước bé mặc thử, mặc/cởi theo khe (hat, hairclip, glasses, neck, body, outer, hand, back — theo `docs/rooms/art.md`), lưu bộ đồ.
   - **Máy gacha**: 50 xu/lượt, 10+1 lượt 500 xu; độ hiếm Thường/Hiếm/Siêu hiếm/Huyền thoại với tỉ lệ ghi rõ trên máy; "bảo hiểm" chắc chắn ra Siêu hiếm sau 30 lượt; trùng đồ → đổi "mảnh" để mua đồ chọn sẵn. Hoạt ảnh quay viên nang. **Chỉ dùng xu kiếm trong app, không có nạp tiền.**
   - **Cửa hàng**: đồ ăn (bánh, trà sữa, cá cho mèo đen…) cho bé ăn tăng tâm trạng, có giảm hiệu quả khi ăn lặp (VPet).
   - **Nhiệm vụ**: 3 nhiệm vụ ngày ("xong 3 note", "dọn 1 note hết hạn", "xoa đầu bé"), 1 nhiệm vụ tuần; **Thành tích** (huy hiệu).
   - **Thống kê**: số việc xong theo ngày/tuần (biểu đồ nhỏ), chuỗi ngày.
4. **Danh mục đồ** `assets/game/catalog.json`: ít nhất 40 món chia khe & độ hiếm, đặt tên dễ thương tiếng Việt, lấy cảm hứng từ bảng nhân vật (đồ ngủ hình thú, đồ thể thao, đồng phục, cosplay, dự tiệc, mùa đông, cắm trại, tai nghe, nơ, kẹp tóc, ba lô, mèo đen bông…). Mỗi món có `id, slot, rarity, name, icon` — icon tạm là SVG phẳng do phòng tự vẽ; hình mặc lên người bé do phòng art làm sau theo `id` (đợt quần áo). Phát `game:outfit {worn: {slot: id}}` để core/art đổi hình.
5. Câu thoại khi trúng gacha/lên cấp/cho ăn: dùng `ctx.persona.pick('gacha_win'|'gacha_dup'|'levelup'|'feed'|'reward', vars)`.

## Tiêu chí nghiệm thu (ảnh xvfb trong `docs/rooms/game/`)
- Xong 1 note có hẹn → nhận xu (ảnh bé báo +xu); quay gacha (ảnh); tủ đồ mặc thử (ảnh); nhiệm vụ ngày.
- Test logic thuần: tính xu, chống cày, tỉ lệ gacha (mô phỏng 100.000 lượt khớp tỉ lệ ±1%), bảo hiểm 30 lượt, chuỗi ngày qua nửa đêm.
- Tắt game hóa trong cài đặt → mọi thứ note/nhắc vẫn chạy y nguyên.

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
