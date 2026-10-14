# Ghi chép từ mã nguồn VPet-Simulator (để các phòng tham khảo)

Nguồn: github.com/LorisYounger/VPet (code Apache-2.0). **Hình/animation nhân vật của VPet KHÔNG được dùng** (điều khoản riêng, cấm bán, thương mại phải xin phép). Chỉ học cơ chế, không chép code/hình.

## Cơ chế đáng học
1. **Lõi tách khỏi cửa sổ**: lõi mô phỏng chỉ nói chuyện qua một interface controller (di chuyển cửa sổ, đo mép màn hình).
2. **Animation = thư mục PNG**, tên file kết thúc `_<ms>` là thời lượng khung. Phân loại theo: loại hành động (Default, Touch_Head, Touch_Body, Raised, Move, Idle, Sleep, Say, Work, StartUp, Shutdown, Switch_*…) × kiểu (Single hoặc Start/Loop/End) × mode (Happy/Normal/Poor/Ill). Thiếu mode thì lấy mode kề (fallback).
3. **Start → Loop → End** cho hành động kéo dài; chạm tiếp thì kéo dài Loop.
4. **Tương tác**: vùng chạm đầu/thân khai báo bằng hình chữ nhật; nhấn giữ 300ms = nhấc lên kéo đi; rê chuột qua lại trên đầu (~5–10 lần đổi hướng) = xoa đầu, không cần click; ló ra bị kéo quá mép thì "nấp bên cạnh".
5. **Hành vi rảnh**: tick 15s, xúc xắc theo "bộ đếm yên lặng" (càng lâu không ai chạm càng hay tự làm gì: đi, ngồi, ngủ…). Khi đang làm việc thì ít cựa quậy hơn.
6. **Chỉ số**: thể lực, no, khát, tâm trạng, sức khỏe (ẩn), thân mật (ẩn, trần theo level), tiền, exp; Level = floor(sqrt(exp)/10)+1. Đồ ăn cộng một nửa ngay, nửa còn lại "nhỏ giọt" mỗi tick. Mode tổng hợp từ nhiều chỉ số điều khiển hình + thoại.
7. **Việc là dữ liệu**: mỗi Work/Study/Play có thời lượng, tiêu hao, thưởng, yêu cầu level, thưởng hoàn thành.
8. **Đồ ăn chống lặp**: ăn món giống nhau liên tục thì hiệu quả giảm dần.
9. **Thoại dữ liệu hóa**: mỗi câu có điều kiện min/max chỉ số, mode, buổi trong ngày, trạng thái, tag; có thể kèm cộng/trừ chỉ số. Bong bóng chữ hiện dần, hỗ trợ stream (chatbot) và giọng nói.
10. **Mod bằng thư mục + file dữ liệu**, plugin có vòng đời (Load, GameLoaded, Save, End).
11. **Hiệu năng**: gộp khung thành sprite sheet có cache; chỉ giữ vài khung gần trong RAM; giải phóng animation không dùng sau 2 phút.

## Nên làm khác
- Dữ liệu dùng JSON có schema, không dùng định dạng riêng (LPS).
- Không phạt người dùng nặng (không "bệnh/chết" vì bỏ bê) — chỉ buồn/ngủ gật nhẹ.
- **Nhắc lịch phải tất định, không phụ thuộc random/mood**; có thông báo Windows dự phòng.
- Không Steam/anti-cheat; plugin chạy trong sandbox, mặc định không đọc note.
- VPet không có báo thức/nhắc việc cho người dùng — đây là khoảng trống Mochi lấp vào.
