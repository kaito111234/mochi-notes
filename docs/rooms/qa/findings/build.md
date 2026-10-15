## build — đóng gói & bộ cài (lượt 2, main @70ebdd3)
Output để ngoài repo: `/home/claude/qa-dist`. File tạo: `build/nsis.json` (đề xuất), `test/e2e/packaged.test.js`, file này.

### 1. Zip Windows
- Lệnh: `npx electron-builder --win zip --x64 --config.directories.output=/home/claude/qa-dist` -> CHẠY ĐƯỢC từ Linux, ~3 phút (máy 2 CPU, tải Electron 33.2.1 win32-x64 ~2s).
- Kết quả: `Mochi Notes-0.1.0-win.zip` = 115 MB (114.916.229 B). `win-unpacked` ~233 MB: `Mochi Notes.exe` 189 MB (chính Electron), `resources/app.asar` 14,7 MB, locales 1,2 MB (đúng 2 ngôn ngữ vi, en-US nhờ `electronLanguages`), `LICENSES.chromium.html` 9 MB.
- app.asar: 517 mục; gốc chỉ có `/assets /src /package.json`. Có src/, assets/{pet/mochi, paper, fonts, game, dialogue, mascot, icon, tray}, package.json. KHÔNG lọt: test/, docs/, art/, tools/, scripts/, __tests__, src/game/test, src/note/tools, src/main/persona/{test,tools}, node_modules. Chỉ 2 file .md thừa: `assets/fonts/LICENSES.md` (nên giữ, giấy phép OFL), `assets/paper/deco/README.md` (thừa, 1 file nhỏ).
- `src/game/preview.js` là MÃ THẬT của Phòng của Mochi (room.html nạp), không phải mock -> đúng khi có trong gói.
- Dung lượng asar theo thư mục (KB): assets/pet 10930 (74%), assets/mascot 1465, assets/fonts 610, src/main 341, src/note 150, src/game 115, src/list 101, src/shared 86, icon.ico 84, dialogue 82, icon.png 74, game 69, paper 66. File lớn nhất ~97 KB (khung PNG của bé: land/ring/lifted/happy...). Không có file đơn nào lớn bất thường.
- Đề xuất bớt: (a) khung bé PNG 11 MB -> lượng tử hoá (pngquant) hoặc WebP, giảm ~50-70% (nhưng gói chỉ 15 MB trong 233 MB nên ưu tiên thấp); (b) `"compression": "maximum"` (zip/NSIS); (c) afterPack xoá `LICENSES.chromium.html` (9 MB, nhưng giấy phép Chromium nên giữ khi phát hành — KHÔNG khuyến nghị) ; (d) `!**/*.md` + giữ `assets/fonts/LICENSES.md`; (e) `assets/icon.ico` trong asar không cần (84 KB) vì ico được nhúng vào exe — thêm `!assets/icon.ico` sau khi đổi `win.icon` (xem mục 3). Dung lượng chủ yếu là runtime Electron, không giảm được.

### 2. Chạy thử bản đóng gói
- Cách: dùng chính `win-unpacked/resources/app.asar` (cùng `files` với bản Linux) chạy bằng Electron Linux của repo dưới xvfb. Không cần dựng `--linux dir`.
- `MOCHI_PACKAGED_APP=/home/claude/qa-dist/win-unpacked/resources/app.asar bash test/e2e/run.sh test/e2e/packaged.test.js` (không đặt biến -> 7 test tự skip). Tuỳ chọn `MOCHI_PACKAGED_ELECTRON`. Tận dụng `lib/hook.js` qua `MOCHI_E2E_ROOT`.
- Kết quả: 7 test, 6 xanh, 1 ĐỎ (có chủ ý, lỗi thật N-build-1). ~20 s. Test bao: không lọt thư mục thừa + file bắt buộc; 2 note mẫu hiện có chữ; quét tĩnh mọi `url()` phông, 100% deco mẫu giấy, icon game, mọi khung/mặt của gói bé (loadPack, không cảnh báo thiếu); đổi qua toàn bộ mẫu giấy qua `window.mochi.paper.set` và `document.fonts.load` mọi họ phông (không 404); cửa sổ bé nạp hình; Phòng của Mochi mở (tab > 3, có nội dung); `ctx.persona.lines` > 50 và `pick` trả câu; cuối phiên: không `requestfailed`/HTTP>=400/console "Failed to load resource" (bỏ qua ERR_ABORTED do reload).

### Lỗi mới
**N-build-1 (Vừa)** — Phòng game (`src/game/preview.js:8`). `FRAME = {happy:'140', normal:'150', tired:'220', sad:'200'}` sai tên file: khung thật là `0001_160.png` (happy, normal, tired) và `0001_208.png` (sad, kiểm `ls assets/pet/mochi/idle/*/loop`). Hậu quả: ảnh xem trước bé trong Phòng của Mochi (tab Tủ đồ) bị vỡ (ERR_FILE_NOT_FOUND), ở CẢ nguồn lẫn gói (không phải do đóng gói). Tái hiện: lệnh trên, test số 7. Kỳ vọng: nạp được; sửa: lấy tên khung từ `pack.json`/danh sách thay vì gõ cứng thời lượng trong tên file. Ảnh: không có (log test).

### 3. Bộ cài NSIS
- Thử `electron-builder --win nsis --x64` (cấu hình ghép từ package.json + `build/nsis.json`): KHÔNG chạy được trên Linux: `wine is required` (cần wine để tạo uninstaller). Máy không có wine/makensis. Bước tải NSIS 3.0.4.1 + nsis-resources ok. (File setup 290 KB dở dang đã xoá.)
- Cách chạy: trên Windows (`npx electron-builder --win nsis --x64`) hoặc CI `windows-latest` (GitHub Actions) — không cần wine. Chưa kiểm được bộ cài thật; cần 1 lượt thử trên Windows sạch (cài, lối tắt, gỡ, giữ dữ liệu).
- Đề xuất: `build/nsis.json` (chép khối `win` + `nsis` vào package.json `build`): oneClick:false, perMachine:false (cài theo người dùng, không cần quyền admin), allowToChangeInstallationDirectory:true, lối tắt Desktop + Start Menu tên "Mochi Notes", `deleteAppDataOnUninstall:false` (giữ ghi chú khi gỡ), runAfterFinish, `installerLanguages:["vi_VN"]`, `language:"1066"`, `artifactName:"Mochi-Notes-Setup-${version}.${ext}"`. KHÔNG cần `build/installer.nsh`. Chưa kiểm được trên Linux: khoá `language`/`installerLanguages` hiển thị tiếng Việt (cần xác nhận khi build trên Windows; nếu lỗi thì bỏ `language`).
- Tự chạy cùng Windows: thuộc app, đã có `app.setLoginItemSettings` (main.js:78, ipcNotes.js:17); không đặt trong NSIS. `setAppUserModelId('vn.joiha.mochinotes')` đã có (cần cho thông báo + lối tắt Start Menu); `requestSingleInstanceLock` đã có (nâng cấp/cài đè an toàn).
- Icon: `assets/icon.png` 256x256 RGBA (đủ ngưỡng). `assets/icon.ico` có 16/32/48/256 -> NÊN dùng `win.icon: "assets/icon.ico"` (đủ cỡ cho thanh tác vụ/Explorer) thay `icon.png`.
- `signAndEditExecutable:false` => exe không được nhúng icon/thông tin phiên bản (không chạy rcedit/wine). Trên Windows/CI có thể bật lại để exe có icon riêng + metadata; nếu giữ false thì exe hiện icon Electron mặc định trong Explorer (zip & setup). Cần quyết định.
- Không ký số (Authenticode): Windows SmartScreen sẽ cảnh báo "Unknown publisher"; cân nhắc chứng chỉ ký mã trước khi phát hành rộng.

### 4. Tự cập nhật (chỉ phương án)
- Phương án: `electron-updater` + GitHub Releases (`build.publish: {provider:"github"}`; CI chạy `electron-builder --win nsis --publish always`, sinh `latest.yml`). App gọi `autoUpdater.checkForUpdatesAndNotify()` sau khi khởi động xong, im lặng khi lỗi/offline.
- Rủi ro: (1) chỉ hỗ trợ bản NSIS, KHÔNG hỗ trợ zip portable; (2) kho riêng tư cần token -> dùng repo/Release công khai hoặc server tĩnh riêng; (3) không ký số -> vẫn cập nhật được nhưng SmartScreen/AV có thể chặn; (4) CLAUDE.md: app phải chạy offline và CSP chặt — cập nhật chạy ở main, không đụng renderer, nhưng phải chịu lỗi mạng; (5) khởi động lại giữa lúc đang có nhắc lịch/báo thức: chỉ `quitAndInstall` khi người dùng đồng ý, và không để ảnh hưởng nhắc lịch tất định; (6) migration dữ liệu phải chạy được khi nhảy nhiều phiên bản; (7) thêm dependency => cần phòng điều hành duyệt; (8) `app-update.yml` phải nằm trong resources (chỉ sinh khi build có `publish`).

### Đề xuất cho điều hành (package.json, không sửa được ở đây)
1. Thêm `nsis` vào `win.target` + khối `nsis` từ `build/nsis.json`; `win.icon` -> `assets/icon.ico`; script `"dist:win:installer": "electron-builder --win nsis --x64"`.
2. Thêm `"!**/*.md"` + `"assets/fonts/LICENSES.md"` (hoặc chỉ `"!assets/paper/deco/README.md"`) và `"!assets/icon.ico"` vào `files`; `"compression":"maximum"`.
3. Quy trình phát hành: build trên Windows/CI cho NSIS; trước khi phát hành chạy `packaged.test.js` trên asar vừa build (có thể chèn vào `scripts/test-all.js` khi có sẵn bản build).
4. Quyết định `signAndEditExecutable` (icon exe) và ký số.
5. Giao phòng game sửa N-build-1.
