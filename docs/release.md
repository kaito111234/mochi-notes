# Phát hành Mochi Notes

Repo: https://github.com/kaito111234/mochi-notes (owner `kaito111234`, repo `mochi-notes`; khai báo ở `package.json` → `build.publish` và `repository`).

> **BẮT BUỘC: repo phải ở chế độ PUBLIC trước khi phát hành.** Hiện repo đang PRIVATE. Updater (provider `github`) và link tải chỉ hoạt động với repo công khai; với repo private, máy người dùng nhận 404 và không tự cập nhật. Chuyển: GitHub → Settings → General → Danger zone → Change visibility → Public. Trước đó xem mục "Rà trước khi công khai" (ASSETS-NOTICE.md, dữ liệu cá nhân trong lịch sử git).

## 1. Quy trình phát hành (chuẩn)

1. Đảm bảo test xanh: `npm test`.
2. Tăng version (KHÔNG dùng PowerShell `Set-Content`/`ConvertTo-Json` — hỏng chữ có dấu):
   ```
   npm version 0.9.5 --no-git-tag-version
   ```
3. Commit thay đổi (`git commit -am "0.9.5: ..."`).
4. Tạo tag khớp version rồi push:
   ```
   git tag v0.9.5
   git push origin main --tags
   ```
5. GitHub Actions (`.github/workflows/release.yml`) tự chạy trên `windows-latest`: `npm ci` → test → build NSIS x64 + arm64, portable x64, zip x64 → upload lên GitHub Release (kèm `latest.yml`, `*.blockmap`) → tạo `SHA256SUMS.txt`. Workflow kiểm tag phải bằng `v<version trong package.json>`, sai thì dừng.
6. Vào trang Releases, kiểm file, viết ghi chú, dán SHA256 từ `SHA256SUMS.txt`. Release do electron-builder tạo ở dạng `release` (không phải draft); nếu muốn duyệt trước, đổi `releaseType` thành `draft` trong `package.json`.

Tên file: `MochiNotes-Setup-<v>-x64.exe`, `MochiNotes-Setup-<v>-arm64.exe`, `MochiNotes-Portable-<v>.exe`, `MochiNotes-<v>-x64.zip`, `latest.yml`, `SHA256SUMS.txt`.

`.github/workflows/ci.yml` chạy test trên mỗi push/PR.

## 2. Build cục bộ (thử, không publish)

```
npm run dist        # NSIS x64, --publish never, ra dist/
npm run dist:full   # NSIS x64+arm64 + portable + zip, --publish never
```
`dist:win` là bí danh của `dist` (khớp README trên repo).

- Đầu ra mặc định là `dist/` trong thư mục dự án (đã .gitignore).
- **Đường dẫn dự án phải ngắn** (< ~200 ký tự) trên máy dev, nếu không makensis báo `spawn ... makensis.exe ENOENT`. Chép sang thư mục ngắn (vd `C:\mochi-build`, loại `.git`, `tools`, `docs`) rồi build; có thể đặt `ELECTRON_BUILDER_CACHE` sang thư mục khác. GitHub Actions không gặp lỗi này.
- Không chạy Setup trên máy dev nếu không muốn cài thật.
- Gỡ cài KHÔNG xoá `%APPDATA%\Mochi Notes` (giữ note).

## 3. Tự cập nhật

`src/main/updater.js` mặc định dùng provider **github**, `owner/repo` đọc từ `package.json` (`build.publish` có provider github, hoặc trường `repository`). Nếu còn placeholder (`OWNER`, `YOUR_...`) hoặc thiếu thì **tắt** GitHub.

Ghi đè tuỳ chọn (provider `generic`, ưu tiên hơn GitHub), theo thứ tự: `settings.updateUrl` trong `mochi-data.json` → `update.json` cạnh `Mochi Notes.exe` → `update.json` trong `%APPDATA%\Mochi Notes\`, định dạng `{ "url": "https://may-chu/mochi-notes/" }`.

Khi bật: kiểm tra sau 20 giây khi khởi động và mỗi 6 giờ, tải nền, xong hỏi "Khởi động lại để cập nhật?" ("Để sau" thì tự cài khi thoát). Chỉ chạy ở bản đã cài (`app.isPackaged`). **Bản portable và zip không tự cập nhật** (updater chỉ hỗ trợ bản NSIS); người dùng tải bản mới thủ công.

Đổi repo (fork): sửa `owner`/`repo` trong `build.publish` và `repository` của `package.json`.

## 4. Ký số

Chưa có chứng chỉ trả phí. Xem `docs/signing.md`: SignPath Foundation (miễn phí cho OSS), winget/Scoop, SmartScreen. Nếu sau này có `.pfx`: đặt secret `CSC_LINK`, `CSC_KEY_PASSWORD` trên GitHub và truyền vào bước build; không đưa chứng chỉ vào repo.

## 5. Chuyển từ bản zip sang bản cài

1. Chạy `MochiNotes-Setup-x.y.z-x64.exe`.
2. Dữ liệu `%APPDATA%\Mochi Notes\mochi-data.json` dùng chung nên note giữ nguyên.
3. Tự xoá thư mục zip cũ và lối tắt cũ.
4. "Khởi động cùng Windows" ghi lại đường dẫn exe hiện tại mỗi lần mở; thoát bản zip cũ khỏi khay trước khi cài.

## 6. Kiểm tra bản build (không cần cài)

- `npx @electron/asar list dist\win-unpacked\resources\app.asar`: phải có `src\`, `assets\`, `node_modules\electron-updater`; không có `tools`, `docs`, `.github`, `packaging`.
- `npx @electron/asar extract-file <app.asar> package.json` rồi đọc: version và description (tiếng Việt) đúng.
