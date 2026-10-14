# Mochi Notes — quy tắc cho mọi phiên làm việc

Mochi Notes là app desktop Windows (Electron 33): sticky note + **trợ lý ảo bé Mochi** (cảm hứng VPet) biết nhắc lịch, dặn dò, báo thức, và có game hóa.
Giao diện, câu thoại, tài liệu: **tiếng Việt**. Trả lời người dùng bằng tiếng Việt, ngắn gọn.

## Tổ chức
- **Phiên = phòng làm việc. Agent = nhân viên.** Phòng điều hành (phiên chính) chia việc, duyệt, gộp và đóng gói.
- Mỗi phòng chỉ làm trong phạm vi được giao ở `docs/rooms/<phong>.md`. Không sửa file của phòng khác; cần đổi hợp đồng chung thì ghi đề xuất vào `docs/rooms/<phong>.md` mục "Đề xuất cho phòng điều hành".
- Mỗi phòng làm trên nhánh `room/<phong>`, commit nhỏ, push thường xuyên. **Không push thẳng vào `main`** — phòng điều hành gộp.
- Kết thúc mỗi lượt: cập nhật mục "Trạng thái" trong `docs/rooms/<phong>.md` (đã xong / đang dở / vướng gì / cần gì), commit, push.

## Cách làm việc (bắt buộc)
- Agent chính (Opus, suy nghĩ kỹ): lập kế hoạch, chia việc, kiểm tra. Không tự đọc khối lượng lớn.
- Tối đa 20 agent con mỗi nhiệm vụ, mỗi agent một mảng không chồng lấn, chạy song song. Agent viết code dùng **Sonnet**; tra cứu đơn giản có thể dùng Haiku. Agent rà soát chỉ đọc, không sửa.
- Agent chính tự kiểm lại phát hiện/kết quả quan trọng trước khi báo.
- Giới hạn ngữ cảnh ~500k token: đẩy việc đọc nặng cho agent con. Khi phiên dài, ghi tóm tắt vào file trạng thái phòng rồi dừng.
- Không làm lại việc đã xong: đọc `docs/` và trạng thái phòng trước khi bắt đầu.

## Kỹ thuật
- Chạy thử không màn hình: `xvfb-run -a -s "-screen 0 1440x900x24"` + `./node_modules/.bin/electron . --no-sandbox --disable-gpu`; chụp màn hình bằng `import -window root <file>.png`. Dữ liệu thử: đặt `XDG_CONFIG_HOME` vào thư mục tạm.
- Đóng gói Windows: `npx electron-builder --win zip --x64` (đã chạy được từ Linux).
- Renderer: `contextIsolation:true, sandbox:true, nodeIntegration:false`; chỉ dùng API qua `src/main/preload.js`. CSP chặt, không inline script, không CDN (app chạy offline).
- Dữ liệu người dùng là JSON trong `userData`, ghi nguyên tử, có bản sao lưu; mọi thay đổi định dạng phải có migration.
- **Nhắc lịch phải tất định**: không phụ thuộc random, tâm trạng hay game. Luôn có thông báo Windows dự phòng.
- Game hóa không phạt nặng: không bệnh/chết vì bỏ bê; tối đa là buồn, ngủ gật.

## Tài sản hình
- Không dùng hình/âm thanh của VPet (giấy phép riêng). Chỉ học cơ chế — xem `docs/VPET-NOTES.md`.
- Hình nhân vật gốc của chủ dự án: `art/source/character-sheet.png`. Sprite hiện tại cắt từ đó (độ phân giải thấp, tạm thời).

## Tài liệu
- `docs/ROADMAP.md` — các đợt và phòng.
- `docs/VPET-NOTES.md` — cơ chế học từ VPet.
- `SPEC.md` — đặc tả bản 0.1 (sẽ được thay dần bởi `docs/spec/*`).
