# Lộ trình Mochi Notes

Bản hiện có (0.1, nhánh `main`): sticky note nhiều cửa sổ, định dạng chữ, tự hiểu giờ tiếng Việt, ẩn/hiện tất cả, khay hệ thống, bé hiện góc màn hình nhắc lịch (sprite tĩnh cắt từ bảng nhân vật), danh sách note, cài đặt, đóng gói Windows.

## Các phòng
| Phòng | Nhánh | Phạm vi |
|---|---|---|
| Điều hành | `main` | Đặc tả, hợp đồng chung, duyệt & gộp, đóng gói, báo cáo |
| 1. Lõi nhân vật | `room/core` | Cửa sổ bé trong suốt/luôn nổi/click-through; hệ animation thư mục PNG (Start/Loop/End × tâm trạng, fallback); kéo-nhấc-thả-rơi, xoa đầu bằng rê chuột, đi lại theo mép màn hình/taskbar, nấp mép; hành vi rảnh; nhiều màn hình; hiệu năng (sprite sheet, cache) |
| 2. Note & nhắc lịch | `room/notes` | Sticky note đầy đủ; báo thức (giờ cố định, lặp ngày/tuần/tháng, chuông); dặn dò (nhắc khi mở máy/đầu ngày); lặp lịch; hiểu tiếng Việt nâng cao; thông báo Windows dự phòng; nhập/xuất, sao lưu |
| 3. Game hóa | `room/game` | Chỉ số bé (năng lượng, tâm trạng, thân mật, kẹo/tiền, exp, level); thưởng từ việc thật (xong note, đúng hạn, chuỗi ngày); nhiệm vụ ngày/tuần; cửa hàng, đồ ăn, gacha trang phục; thành tích; cân bằng chống "cày" |
| 4. Thoại & tính cách | `room/persona` | Kho thoại JSON có điều kiện (giờ, tâm trạng, việc tồn, sự kiện); tính cách bé (ngại ngùng, thích mèo, đồ ngọt); bong bóng chữ chạy dần; **bảng yêu cầu vẽ** cho họa sĩ (danh sách tư thế, kích thước, quy ước tên file) |
| 5. Kiểm thử & đóng gói | `room/qa` | Test tự động (logic + chạy xvfb chụp màn hình), bộ cài Windows (NSIS), tự cập nhật, đo hiệu năng, danh sách lỗi |

## Trạng thái
- Đợt 1 xong và đã gộp (core, notes, persona).
- **Đợt 2 đang chạy**: notes (hiểu note, nhiều nhắc/note, API ghi nhanh), core (bé ghi note giúp, tự do hơn), **paper** (mẫu giấy note dễ thương), **art** (họa sĩ vẽ lại bé dạng rig vector, từng phần), **qa** (kiểm thử note như người dùng thật). Game hóa để Đợt 3.

## Đợt 1 — Nền móng (làm trước)
- Điều hành: hợp đồng chung `docs/spec/` — mô hình dữ liệu v2 (note, alarm, pet state, inventory), bus sự kiện giữa các module, định dạng gói animation & thoại.
- Phòng 1: engine animation + cửa sổ bé đi lại/kéo thả (dùng hình tạm).
- Phòng 2: báo thức + lặp lịch + dặn dò trên nền note hiện có.
- Phòng 4: bảng yêu cầu vẽ + kho thoại khung.

## Đợt 2 — Thú ảo sống
- Phòng 3 game hóa nối vào sự kiện note; phòng 1 nối tâm trạng → animation; phòng 4 nối thoại theo điều kiện.

## Đợt 3 — Hoàn thiện
- Phòng 5: bộ cài, test, hiệu năng; sửa lỗi theo phản hồi người dùng.
