## perf — tóm tắt
- Lệnh: `bash test/e2e/run.sh test/e2e/perf.test.js` (mất ~10 phút; rút gọn: `PERF_RUNS=1 PERF_IDLE_MS=5000`). Số liệu in dạng `[PERF] ...` và ghi `test/e2e/out/perf-results.json`.
- Kết quả: 6 pass / 0 fail / 0 skip. Không treo, không crash ở bất kỳ kịch bản nào. Test không đỏ theo ngưỡng hiệu năng (theo yêu cầu).
- Môi trường: xvfb 1440x900, `--disable-gpu` (render phần mềm, chậm hơn máy thật), nproc=2, RAM 8029 MB (free -m), Linux 6.18, Electron 33. Chạy song song với các nhân viên QA khác trên cùng máy 2 nhân nên số đo có nhiễu (xem độ lệch giữa 3 lần).
- Cách đo: RAM = cộng `app.getAppMetrics()` trong main (workingSetSize, tức VmRSS, trùng với /proc/<pid>/status) và PSS (/proc/<pid>/smaps_rollup, đã chia đều bộ nhớ dùng chung). Tổng RSS tính trùng thư viện dùng chung giữa các tiến trình nên bị phóng đại; PSS gần mức tiêu thụ thật hơn. CPU = chênh `cumulativeCPUUsage` của mọi tiến trình / 30 giây, tính theo % của MỘT nhân. Độ trễ main = setInterval 10ms trong main, ghi độ trễ lớn nhất.

### Bảng 1: khởi động / RAM / CPU rảnh (trung vị 3 lần; 30s rảnh)
| Kịch bản | Khởi động tới đủ note có nội dung | Số tiến trình | Tổng RSS (WS) | Tổng PSS | CPU rảnh (% một nhân) |
|---|---|---|---|---|---|
| 2 note mẫu (lần đầu) | 3,9 s (3,0–5,3) | 6 | 714 MB | 212 MB | 3,2 |
| 1 note | 2,1 s (0,8–2,4) | 5 | 609 MB | 226 MB | 4,0 |
| 30 note | 5,2 s (4,9–7,1) | 34 | 3617 MB | 612 MB | 3,2 (2,3–4,8) |

Nhận xét: mỗi note là một tiến trình renderer (~35 MB PSS, ~100 MB RSS/note). Khởi động 30 note < 10 s: đạt. CPU rảnh ~3-4% một nhân, gần như không đổi theo số note, nhưng ngay cả 1 note rảnh đã ~4% (nghi do bé Mochi/animation/timer — dưới ngưỡng 5% nhưng sát). RAM: theo tổng RSS vượt 1,5 GB, theo PSS (thực) chỉ ~0,6 GB; trên Windows tổng "Private working set" sẽ nằm giữa hai số này (xem F-perf-1).

### Bảng 2: 30 note đang mở — độ phản hồi
| Thao tác | Thời gian | Độ trễ main lớn nhất |
|---|---|---|
| Gõ từng ký tự vào note thứ 30 (trung vị / lớn nhất) | 17 ms / 35 ms (lần chạy đầu có nhiễu: 29 / 507 ms) | 3 ms (lần đầu 167 ms) |
| Ẩn tất cả (Ctrl+Alt+H) | 41 ms | 29 ms |
| Hiện tất cả (Ctrl+Alt+H) tới khi đủ 30 note có nội dung | 3,9 s (lần đầu 7,0 s) | 541 ms (lần đầu 1074 ms; 4 lần > 100 ms, 1 lần > 500 ms) |
| Mở danh sách tới khi đủ 30 thẻ | 334 ms | 9 ms |

### Bảng 3: 30 nhắc tới giờ cùng lúc (due = now+4 s cho cả 30 note)
| Chỉ số | Giá trị |
|---|---|
| Sự kiện `reminder:due` trên bus | 30/30 (cùng một tick, +4,19 s) |
| Note đánh dấu fired | 30/30 |
| Độ trễ main lớn nhất | 78 ms (không lần nào > 100 ms) |
| CPU trung bình 30 s sau đó | 15,7% một nhân (cao hơn lúc rảnh ~3%) |
| Tổng WS / số tiến trình | 3719 MB / 35 (thêm 1 cửa sổ: cửa sổ bé/thông báo) |
| Cửa sổ BrowserWindow | 31 (30 note + 1) — không sinh 30 cửa sổ thông báo |
Ảnh: docs/rooms/qa/img/perf-30-nhac.png. App không treo, vẫn phản hồi sau 30 s.

### Bảng 4: 200 note (195 cất, 5 đang dán)
| Thao tác | Thời gian |
|---|---|
| Mở danh sách tới khi có thẻ (200 thẻ) | 439 ms (lần đầu 1226 ms) |
| Bấm chip "Tất cả" | 218 ms |
| Tìm "hợp đồng" (120 kết quả): đồng bộ / tới khi vẽ | 26 ms / 98 ms |
| Tìm "Note số 150" (1 kết quả) | 5 ms / 19 ms |
| Tìm không có kết quả | 2 ms / 29 ms |
| Xoá ô tìm (về 200 thẻ) | 28 ms / 204 ms |
| Gõ thật "khách hàng" từng ký tự (trung vị / lớn nhất) | 162 ms / 257 ms (lần đầu 225 / 1358 ms) |
| Độ trễ main lớn nhất | 55 ms (lần đầu 533 ms) |
Ảnh: docs/rooms/qa/img/perf-30-note.png (30 note trên màn hình).

### Lỗi / rủi ro
### F-perf-1: Mỗi note một tiến trình renderer — RAM tổng lớn, tỷ lệ tuyến tính theo số note
- Mức: Vừa
- Phòng: điều hành (main.js/noteWindows) + paper (src/note)
- Tái hiện: `bash test/e2e/run.sh test/e2e/perf.test.js` (test 1c) và đọc `[PERF] 30-note`.
- Kỳ vọng / Thực tế: Kỳ vọng tổng RAM < 1,5 GB với 30 note. Thực tế: tổng RSS 3,6 GB (34 tiến trình, ~100 MB/note), PSS 0,6 GB. Mức thật trên Windows chưa đo được (Linux có chia sẻ trang); nhiều khả năng ~1,5–2,5 GB. 1 note đã ~600 MB RSS (5 tiến trình gồm GPU/utility/bé).
- Nguyên nhân khả dĩ: mỗi `BrowserWindow` note là một renderer riêng (src/main/notes/noteWindows.js); cân nhắc giới hạn số note dán cùng lúc, hoặc cất note lâu không dùng thành ảnh tĩnh, hoặc bật `backgroundThrottling`/không nạp lại module nặng.
- Ảnh: docs/rooms/qa/img/perf-30-note.png
- Độ chắc: 4/4 lần (cả bản chạy thử và 3 lần chính thức)

### F-perf-2: "Hiện tất cả" 30 note mất 4–7 s và chặn event loop main tới ~0,5–1 s
- Mức: Vừa
- Phòng: notes (src/main/notes/noteService.js, noteWindows.js)
- Tái hiện: test 2 (`[PERF] 30-note-không-treo`, `showAllMs`, `showMainLag`).
- Kỳ vọng / Thực tế: Kỳ vọng không chặn main > 1 s. Thực tế: tạo 30 cửa sổ cùng lúc làm main lag lớn nhất 541 ms (lần chạy đầu 1074 ms, 4 lần > 500 ms); tới khi đủ nội dung 3,9–7,0 s (xvfb, CPU 2 nhân bị chia sẻ nên có thể tốt hơn trên máy thật). Trong lúc đó nhắc lịch/IPC cũng bị chậm tương ứng.
- Nguyên nhân khả dĩ: `showAll` → `ctx.notes.openAllVisible` (noteService.js ~dòng 127–133) tạo 30 cửa sổ đồng bộ trong một vòng lặp; nên tạo tuần tự cách nhau 30–50 ms (setImmediate/xếp lô) để main thở.
- Ảnh: không (số liệu)
- Độ chắc: 2/2 lần chạy đầy đủ (vượt 500 ms ở cả hai)

### F-perf-3: CPU tăng ~16% một nhân suốt 30 s sau khi 30 nhắc cùng nổ; CPU rảnh nền ~3–4% ngay cả với 1 note
- Mức: Nhẹ
- Phòng: core (src/main/pet*, src/pet) / notes (reminderLoop)
- Tái hiện: test 3 (`cpuPctDuring30s`) và test 1b (`idleCpuPct`).
- Kỳ vọng / Thực tế: Kỳ vọng CPU rảnh gần 0 và trở lại thấp sau khi xử lý nhắc. Thực tế: rảnh 3,2–4,0% (1 note đã 4%), sau 30 nhắc 15,7% trung bình 30 s. Dưới ngưỡng lỗi 5% một nhân khi rảnh nhưng sát; khả năng liên quan animation bé (xvfb software render làm tăng) nên cần đo lại trên Windows.
- Nguyên nhân khả dĩ: vòng animation/rAF của bé (src/pet, src/main/petcore/window.js) và timer 1 s của src/main/notes/reminderLoop.js. Chưa tách được nguyên nhân.
- Ảnh: docs/rooms/qa/img/perf-30-nhac.png
- Độ chắc: 1/1 (test 3), rảnh 7/7 lần đo ở mức 2,3–4,9%

### Ghi chú không phải lỗi
- 30 nhắc cùng giờ: bus phát đủ 30 `reminder:due` trong cùng một tick và app vẫn phản hồi; việc "bé xếp hàng" qua `ctx.pet.stage` không quan sát trực tiếp được từ test này (chỉ đếm sự kiện bus, số cửa sổ không tăng). Nên có ca riêng của phòng core/notes kiểm hàng đợi bé và thông báo Windows dự phòng.
- Danh sách 200 note: mở < 0,5 s, tìm kiếm < 0,1 s ở trạng thái ổn định; danh sách render lại toàn bộ thẻ mỗi lần gõ (`renderCards` src/list/list.js:~165 xoá và dựng lại) — xoá ô tìm (200 thẻ) ~200 ms, gõ thật trung vị 160 ms/ký tự trên xvfb: chấp nhận được nhưng sẽ tệ hơn với vài nghìn note (có thể thêm debounce/ảo hoá danh sách).
