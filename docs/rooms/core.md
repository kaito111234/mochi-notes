# Phòng 1 — Lõi nhân vật (`room/core`)

**Sứ mệnh**: biến bé Mochi từ "ảnh ló lên góc màn hình" thành **thú ảo sống trên desktop** như VPet, đồng thời là người đưa tin nhắc lịch đáng tin cậy.
Đọc trước: `CLAUDE.md`, `docs/spec/*.md` (nhất là 00, 02, 03), `docs/VPET-NOTES.md`, code hiện có `src/main/pet/*`, `src/mascot/*`.
File được sửa: xem `docs/spec/00-ownership.md` (dòng core).

## Đợt 1 — việc cần giao
1. **Engine hình động** (renderer, canvas): đọc gói theo `docs/spec/03-animation.md`, chạy Start → Loop → End, fallback mood/action, thời lượng khung từ tên file, nạp trước + cache (không giật). API renderer gọn: `play(action, {mood, loop, onEnd})`.
2. **Gói hình tạm** `assets/pet/mochi/` sinh tự động từ 18 ảnh bán thân trong `assets/mascot/` (biến đổi: nhún, nghiêng, lật, đổi biểu cảm theo khung) + `faces/`, đủ mọi action trong danh sách để test. Viết `tools/anim/validate.js` (báo thiếu gì, sai kích thước) và `tools/anim/make-placeholder.js`.
3. **Cửa sổ bé** kiểu VPet: cửa sổ trong suốt cỡ nhân vật, luôn nổi, di chuyển bằng cách dời cửa sổ; click-through phần trong suốt. Chế độ mặc định mới: **bé luôn ở trên desktop** (đứng trên mép taskbar), có thể tắt trong cài đặt → khi tắt, bé chỉ hiện lúc nhắc lịch như 0.1.
4. **Tương tác**: nhấn giữ 300ms để nhấc kéo đi (tư thế `lifted`), thả ra thì rơi (`fall` → `land`) xuống mép taskbar hoặc cạnh trên một cửa sổ note đang dán; rê chuột qua lại trên đầu = xoa đầu (`pat_head`), trên thân = `pat_body`; click = nói. Phát `pet:interact`.
5. **Đi lại & hành vi rảnh**: tick 15s, xúc xắc theo thời gian yên lặng (VPet): đi dọc taskbar, ngồi, ngủ khi lâu không ai đụng / máy rảnh (`app:idle`), dậy khi `app:resume`; bị kéo ra quá mép thì nấp (`peek_left/right`). Nhiều màn hình, DPI. Không bao giờ che con trỏ hay chặn click ngoài thân bé.
6. **Đạo diễn sân khấu** `ctx.pet.stage` đúng `docs/spec/02-events.md`; giữ `ctx.pet.enqueue(event)` cũ hoạt động (bọc sang stage) để phòng notes không bị gãy. Khi nhắc lịch: bé (đang ở đâu thì) chạy/nhảy tới góc gần nhất, **giơ tờ note** (`hold_note`, gắn tờ note tại `pack.hand`) + bong bóng + nút như 0.1. Báo thức (`alarm`, ưu tiên 100) dùng `ring`.
7. Nghe `game:mode` (nếu chưa có thì mặc định `normal`) để chọn mood hình.

## Tiêu chí nghiệm thu (chụp xvfb lưu vào `docs/rooms/core/`)
- Ảnh: bé đứng trên đáy màn hình; đang bị nhấc; đang ngủ; đang giơ note nhắc lịch.
- Luồng 0.1 vẫn chạy: note "Uống nước nè, 1 phút nữa" → bé giơ note sau ~1 phút, các nút Xong/Hoãn/Mở note hoạt động.
- `node tools/anim/validate.js assets/pet/mochi` không lỗi. CPU khi bé đứng yên thấp (đo sơ bộ, ghi số).

## Trạng thái
_(phòng cập nhật cuối mỗi lượt)_ — chưa bắt đầu.

## Đề xuất cho phòng điều hành
_(trống)_
