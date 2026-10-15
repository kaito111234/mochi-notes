# Ký số & uy tín bản cài (không tốn tiền)

Chưa có chứng chỉ ký số trả phí, nên bản cài sẽ hiện SmartScreen "Windows protected your PC / Unknown publisher". Có 3 hướng giảm ảnh hưởng, kết hợp được cả ba.

## 1. SmartScreen: người dùng làm gì

Khi chạy `MochiNotes-Setup-x.y.z-x64.exe` lần đầu:
1. Màn hình xanh "Windows protected your PC" → bấm **More info** (Thông tin thêm).
2. Bấm **Run anyway** (Vẫn chạy).

Uy tín SmartScreen tăng dần theo số lượt tải/chạy của cùng một file (và nhanh hơn khi file được ký). Mỗi bản mới là file mới nên có thể bị cảnh báo lại trong thời gian đầu.

Kiểm tra file tải về không bị sửa: so SHA256 với `SHA256SUMS.txt` đính kèm mỗi Release (workflow tự tạo):
```
certutil -hashfile MochiNotes-Setup-0.9.4-x64.exe SHA256
```
Nên dán hash vào phần ghi chú Release (copy từ `SHA256SUMS.txt`).

## 2. SignPath Foundation (ký số miễn phí cho mã nguồn mở)

https://signpath.org/ — SignPath Foundation cấp chứng chỉ ký (publisher hiện là "SignPath Foundation") miễn phí cho dự án OSS.

### 2.1 Điều kiện (kiểm lại ở trang của họ trước khi nộp)
- Repo **công khai**, giấy phép **OSI-approved** (MIT đạt — nhưng xem lưu ý hình nhân vật bên dưới), có người duy trì rõ ràng.
- Build trên CI công khai (GitHub Actions) — ký chạy theo build đó, không ký file làm tay.
- Dự án có mô tả/README rõ, không phải malware/PUA; không bundle phần mềm đóng không rõ nguồn.
- Điều khoản: phải ghi nguồn "Code signing is provided by SignPath.io, certificate by SignPath Foundation" trong README/trang tải.
- Lưu ý: hình nhân vật Mochi hiện KHÔNG theo MIT (`ASSETS-NOTICE.md`). Cần nói rõ trong đơn, hoặc cấp phép hình nhân vật để khỏi vướng điều kiện "toàn bộ dự án là OSS".

### 2.2 Các bước
1. Nộp đơn tại https://signpath.org/apply (hoặc qua mục OSS), điền link repo.
2. Được duyệt → tạo project trên SignPath: slug (vd `mochi-notes`), artifact configuration cho file `.exe`, signing policy `release-signing`.
3. Cài GitHub App "SignPath" / kết nối repo; tạo API token.
4. Trên GitHub repo: Settings → Secrets and variables → Actions:
   - Secret `SIGNPATH_API_TOKEN`
   - Variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, và `SIGNPATH_ENABLED=true`.
5. Workflow `.github/workflows/release.yml` đã có sẵn hai bước SignPath ở cuối, **tắt mặc định** (chỉ chạy khi `vars.SIGNPATH_ENABLED == 'true'`).

### 2.3 Lưu ý quan trọng khi bật
Hiện workflow build + publish chung một lệnh (`electron-builder --publish always`), nên file lên Release là bản CHƯA ký. Để ký đúng:
1. Đổi bước build thành `npx electron-builder --win --publish never` (chỉ build).
2. Gửi `dist/*.exe` cho SignPath (hai bước có sẵn), nhận lại bản đã ký ở `dist-signed/`.
3. Ký lại sẽ làm đổi hash → cần **tạo lại `latest.yml`/blockmap** (sha512 trong latest.yml phải khớp file đã ký, nếu không auto-update báo lỗi checksum). Cách đơn giản: ký bằng SignPath **trước khi** electron-builder đóng gói NSIS là không khả thi với NSIS; thay vào đó dùng `electron-builder` với `win.signtoolOptions`/custom sign hook gọi SignPath, hoặc sau khi ký chạy lại bước tạo `latest.yml`. Đây là phần cần làm thủ công/thử nghiệm khi được duyệt — chưa kiểm chứng.
4. Upload file đã ký + `latest.yml` bằng `gh release upload --clobber`.

## 3. Phát hành qua winget và Scoop

Cài qua trình quản lý gói giúp người dùng ít gặp SmartScreen hơn (tải bằng winget vẫn kiểm hash) và để AI/script cài tự động.

### winget (microsoft/winget-pkgs)
Mẫu manifest: `packaging/winget/*.yaml` (3 file). Hướng dẫn chi tiết cách gửi PR: `docs/winget.md`. Tóm tắt:
1. Phát hành Release trước, lấy SHA256 trong `SHA256SUMS.txt` → điền vào file installer (VIẾT HOA).
2. Cập nhật `PackageVersion` và URL trong cả 3 file.
3. Kiểm thử cục bộ: `winget validate packaging\winget` rồi `winget install --manifest packaging\winget` (cần bật `winget settings --enable LocalManifestFiles`).
4. Tạo PR vào https://github.com/microsoft/winget-pkgs, đặt 3 file ở `manifests/j/Joiha/MochiNotes/<version>/`. Công cụ `wingetcreate` (`wingetcreate update Joiha.MochiNotes --version x.y.z --urls <url x64> <url arm64> --submit`) tự làm bước này.
5. Người dùng/AI cài: `winget install Joiha.MochiNotes` (thêm `--silent` để cài không giao diện).

### Scoop
Mẫu: `packaging/scoop/mochi-notes.json` (bản zip x64, portable).
- Cách nhanh: tạo bucket riêng `kaito111234/scoop-bucket`, chép file vào `bucket/mochi-notes.json`; người dùng: `scoop bucket add joiha https://github.com/kaito111234/scoop-bucket` rồi `scoop install mochi-notes`.
- Hoặc gửi PR vào bucket `extras` của Scoop khi dự án đủ nổi tiếng.
- Điền `hash` từ `SHA256SUMS.txt`; `checkver` + `autoupdate` giúp bucket tự bắt phiên bản mới.

## 4. Tóm tắt khuyến nghị
1. Công khai repo + Release kèm `SHA256SUMS.txt` (làm ngay).
2. winget + Scoop (không tốn phí, vài giờ làm).
3. Nộp đơn SignPath Foundation (chờ duyệt, bật bước ký sau).
