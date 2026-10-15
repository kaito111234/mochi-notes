# Contributing / Đóng góp

- Mở issue trước khi làm thay đổi lớn. / Open an issue before large changes.
- Chạy test trước khi gửi PR / run tests before opening a PR (`npm ci` trước):
  ```
  npm test
  ```
  (gồm `tools/test-nlu.js`, `tools/test-core.js`, `tools/test-alert-policy.js`, `tools/check-pack.js`)
- Giữ kiểu code hiện có (Node thuần, `'use strict'`, không thêm thư viện nặng). / Keep the existing style.
- Sửa `package.json` bằng `npm` hoặc node (utf8), không dùng PowerShell `Set-Content` (hỏng chữ có dấu).
- Hình nhân vật Mochi KHÔNG thuộc MIT, xem `ASSETS-NOTICE.md`; đừng đưa hình của bên thứ ba vào repo khi chưa rõ giấy phép.
- Đóng góp của bạn được cấp phép theo MIT (phần mã nguồn). / Contributions are licensed under MIT (source code).
