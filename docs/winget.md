# Gửi Mochi Notes lên winget (microsoft/winget-pkgs)

Sau khi gói được duyệt, ai cũng cài được bằng `winget install Joiha.MochiNotes`. Không cần chứng chỉ ký số; winget tự kiểm SHA256 của bộ cài.

Mẫu manifest (schema 1.6.0, 3 file) ở `packaging/winget/`:

| File | Nội dung |
|---|---|
| `Joiha.MochiNotes.yaml` | version: mã gói, phiên bản, ngôn ngữ mặc định |
| `Joiha.MochiNotes.installer.yaml` | URL + SHA256 (VIẾT HOA) của Setup x64 và arm64 |
| `Joiha.MochiNotes.locale.en-US.yaml` | tên, mô tả, giấy phép, tag |

## 1. Cập nhật manifest cho phiên bản mới
1. Chờ workflow Release chạy xong, mở `SHA256SUMS.txt` trong Release.
2. Sửa `PackageVersion` trong cả 3 file, sửa URL và `InstallerSha256` (viết HOA) trong file installer, `ReleaseDate`, `ReleaseNotesUrl`.
3. Kiểm thử trên máy (winget không đọc được thư mục trong AppData của ứng dụng khác, nên chép ra thư mục ngắn như `C:\mochi-winget` trước):
   ```
   winget validate --manifest C:\mochi-winget
   winget settings --enable LocalManifestFiles
   winget install --manifest C:\mochi-winget
   ```
   Lệnh `settings --enable` cần quyền Administrator.

## 2. Gửi PR (người dùng tự làm)
Cách A, dùng `wingetcreate` (dễ nhất):
```
winget install Microsoft.WingetCreate
wingetcreate submit --token <GitHub PAT> C:\mochi-winget
```
Lần sau chỉ cần cập nhật:
```
wingetcreate update Joiha.MochiNotes --version 0.10.1 --urls <URL Setup x64> <URL Setup arm64> --submit
```
`wingetcreate` tự fork winget-pkgs, tạo nhánh và mở PR. PAT chỉ cần quyền `public_repo`; không lưu PAT vào repo.

Cách B, làm tay trên GitHub:
1. Fork https://github.com/microsoft/winget-pkgs.
2. Tạo thư mục `manifests/j/Joiha/MochiNotes/0.10.0/`, chép 3 file vào (giữ nguyên tên file).
3. Mở PR vào `master` của microsoft/winget-pkgs, điền mẫu PR (đánh dấu đã chạy `winget validate` và thử cài).

## 3. Sau khi mở PR
- Bot chạy kiểm tra tự động (tải bộ cài, kiểm hash, quét virus, cài thử im lặng). Lỗi sẽ được gắn nhãn kèm log; sửa manifest rồi push lại vào nhánh PR.
- Bộ cài chưa ký số vẫn được chấp nhận, nhưng có thể bị gắn nhãn chờ người duyệt xem xét lâu hơn.
- Mỗi phiên bản mới là một PR mới (thư mục phiên bản mới). Không sửa thư mục của phiên bản đã gộp, trừ khi sửa lỗi manifest.
- Không đổi URL hoặc ghi đè file trong một Release đã đưa lên winget: hash sẽ không khớp và người dùng cài bị lỗi.

## Scoop
Xem mục 3 trong `docs/signing.md`. Manifest: `packaging/scoop/mochi-notes.json` (bản zip x64).
