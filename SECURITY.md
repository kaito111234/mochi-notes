# Chính sách bảo mật · Security Policy

## Phiên bản được hỗ trợ · Supported versions

| Phiên bản / Version | Hỗ trợ / Supported |
| --- | --- |
| Bản mới nhất trên [Releases](https://github.com/kaito111234/mochi-notes/releases/latest) | ✅ |
| Các bản cũ hơn / Older versions | ❌ — vui lòng cập nhật / please update |

App tự cập nhật qua GitHub Releases (bản cài Setup). Bản Portable và zip cần tải bản mới thủ công.

## Báo lỗ hổng · Reporting a vulnerability

**Đừng mở issue công khai cho lỗ hổng bảo mật.** Hãy báo riêng qua GitHub:

1. Vào tab **Security** của repo → **Report a vulnerability** ([link](https://github.com/kaito111234/mochi-notes/security/advisories/new)).
2. Mô tả lỗi, cách tái hiện, phiên bản app và Windows, mức ảnh hưởng bạn đánh giá.

Chúng tôi sẽ phản hồi trong vòng **7 ngày**, cập nhật tiến độ trong quá trình sửa, và ghi công bạn trong ghi chú phát hành nếu bạn muốn.

**Please do not open public issues for security vulnerabilities.** Report privately via the repository's **Security → Report a vulnerability** page. We aim to respond within **7 days**, keep you updated while we fix it, and credit you in the release notes if you wish.

## Phạm vi · Scope

Trong phạm vi / In scope:
- Mã nguồn app (Electron main/renderer, preload, IPC) — ví dụ: thực thi mã từ nội dung note, vượt `contextIsolation`, đọc/ghi file ngoài thư mục dữ liệu.
- Cơ chế tự cập nhật và bộ cài.
- Sao lưu/khôi phục dữ liệu.

Ngoài phạm vi / Out of scope:
- Cảnh báo SmartScreen do bản cài chưa ký số (xem [docs/signing.md](docs/signing.md)).
- Lỗ hổng của Electron/Chromium đã có bản vá upstream — hãy báo để chúng tôi nâng cấp, nhưng lỗi gốc thuộc về upstream.
- Tấn công cần quyền quản trị hoặc truy cập vật lý vào máy đã mở khoá.

## Dữ liệu người dùng · User data

Mochi Notes chạy hoàn toàn trên máy: không có tài khoản, không gửi note lên máy chủ nào. Dữ liệu nằm ở `%APPDATA%\Mochi Notes` và (nếu bật) thư mục sao lưu bạn tự chọn. Kết nối mạng duy nhất là kiểm tra cập nhật tới GitHub Releases.

Mochi Notes runs fully locally: no account, no note is sent to any server. The only network access is the update check against GitHub Releases.
