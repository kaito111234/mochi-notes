# tools/rig — trình dựng hình động cho nhân vật rối giấy SVG

Chỉ dùng Node built-in + Electron có sẵn của repo (không thêm npm). Kết xuất SVG→PNG bằng `svg2png.js` (Electron offscreen). Một lượt dựng = MỘT tiến trình Electron (~1 giây cho ~30 khung). Máy ít nhân: đừng chạy song song nhiều lượt.
Nếu không có `DISPLAY`, các công cụ tự gọi `xvfb-run -a`. Không cần Python (ghép ảnh so sánh cũng làm bằng Electron).

Mọi công cụ nhận `--rig <rig.json>` (mặc định `art/rig/mochi/rig.json`) và `--parts <thư mục bộ phận>` (mặc định `partsDir` trong rig.json, tức `art/rig/mochi/parts`). Đường dẫn tương đối tính từ thư mục hiện tại, không có thì từ gốc repo.

## Lệnh chính
| Việc | Lệnh |
|---|---|
| Xem nhanh một tư thế | `node tools/rig/pose.js --out x.png [--face happy] [--pose '{"bones":{"forearm_r":{"r":90}}}'] [--scale 2] [--bg white\|checker\|none]` |
| Xem một khung của action | `node tools/rig/pose.js --out x.png --from idle/normal/loop/3` |
| Dựng gói | `node tools/rig/build.js [--only idle,walk] [--out assets/pet/mochi] [--actions dir] [--faces] [--frames-only] [--keep-svg]` |
| Dựng ảnh bán thân mặt | `node tools/rig/faces.js [--out assets/pet/mochi]` (hoặc `build.js --faces`) |
| Lưới khung 1 action | `node tools/rig/sheet.js --contact idle` → `art/review/contact_idle.png` |
| Lưới 18 mặt | `node tools/rig/sheet.js --faces` → `art/review/faces.png` |
| So với bảng gốc | `node tools/rig/sheet.js --compare` → `art/review/compare_full.png` |
| Kiểm gói | `node tools/anim/validate.js assets/pet/mochi` |

`build.js`: trước khi ghi một action sẽ xoá đúng thư mục action đó trong `--out` (không đụng action khác); ghi `<out>/<action>/<mood>/<phase>/NNNN_<ms>.png`; sinh `<out>/pack.json` từ `tools/rig/pack.base.json` + `faces` chỉ gồm file `faces/<khoá>.png` thực có (18 khoá đầu). `--keep-svg` lưu SVG từng khung vào `art/build/svg/`. Bộ phận thiếu: cảnh báo một lần rồi bỏ qua lớp (lớp `optional` im lặng); mặt thiếu → rơi về `face/normal`.

## Quy ước hình học
- Ma trận mỗi xương: `M = M_cha · T(P + (x,y)) · R(r) · S(sx,sy) · T(−P)`, P = pivot trong rig.json. `r` đơn vị độ, **dương = quay thuận chiều kim đồng hồ trên màn hình**. Giá trị mặc định: r,x,y = 0; sx,sy = 1. Xoay xương cha kéo theo con (xoay `forearm_r` 90° → bàn tay quay quanh khuỷu (244,278)).
- `global` áp ngoài cùng cho cả nhân vật: `{r, px, py, x, y, sx, sy}`, xoay/co quanh điểm (px,py) (mặc định anchor [200,392]); dùng cho `lifted` (px,py = điểm nhấc), `fall`.
- Tên xương sai → báo lỗi (bắt lỗi gõ).

## Định dạng action: `tools/rig/actions/<action>.json` (hoặc `.js`, ưu tiên hơn)
```json
{ "action": "wave",
  "moods": {
    "normal": {
      "start": [ { "ms":100, "face":"happy", "bones":{"upper_arm_r":{"r":0}} },
                 { "ms":100, "inherit":true, "tween":3, "bones":{"upper_arm_r":{"r":-150},"forearm_r":{"r":-20}}, "swap":{"hand_r":"open"} } ],
      "loop":  [ { "ms":120, "inherit":true, "bones":{"forearm_r":{"r":-30}} },
                 { "ms":120, "inherit":true, "bones":{"forearm_r":{"r":10}} } ],
      "end":   [ ... ], "single": [ ... ] },
    "happy": { "$ref":"normal", "override": { "loop":[ {"face":"laugh"}, {"face":"laugh"} ] } }
  } }
```
- Phase: `single | start | loop | end`. Mood: `normal | happy | tired | sad`.
- Khung: `ms` (mặc định 100), `face` (mặc định normal), `bones` {xương:{r,x,y,sx,sy}}, `global`, `swap` {idLớp: "biến thể"} (vd `{"hand_r":"open"}` → `hand_r.open.svg`; thiếu file thì dùng bản thường), `show` [{id, file (tương đối parts/), bone, z, x, y, r, s, opacity}], `hide` [idLớp], `z` {idLớp: zMới}, `opacity` {idLớp: 0..1}.
- `show`: `bone` là tên xương (đạo cụ bám theo xương, toạ độ x,y,r,s là dịch/xoay/tỉ lệ thêm trong hệ xương), `"none"` = toạ độ canvas nhưng vẫn chịu `global`, `"canvas"` = cố định trên canvas (không chịu `global`; dùng cho hiệu ứng như sóng, bụi). Không có `z` thì 200 (trên mọi lớp thân).
- `"inherit": true`: gộp sâu lên khung trước TRONG CÙNG PHASE (bones/global/swap/z/opacity gộp theo khoá; show/hide/face/ms được thay nếu khai báo). Không inherit = bắt đầu từ tư thế gốc.
- `"tween": n` (+ tuỳ chọn `"tweenMs"`, mặc định = ms của khung): chèn n khung trung gian nội suy tuyến tính có ease in-out giữa khung trước và khung này cho bones/global; face/swap/show/hide/z lấy khung trước ở nửa đầu, khung này ở nửa sau. Khung đầu phase không tween.
- `$ref` + `override`: mood copy mood khác (đã giải kế thừa/tween) rồi đè từng khung theo mảng override **cùng độ dài** của từng phase (mỗi phần tử là khung từng phần, gộp như inherit). Đã hỗ trợ.
- `.js`: `module.exports = { action:'idle', moods:{...} }` (hoặc hàm trả về đối tượng) — tạo khung bằng vòng lặp/sin; cùng cấu trúc như JSON.

## Thêm mới
- **Action**: tạo file trong `actions/`, chạy `build.js --only <tên>`, xem bằng `sheet.js --contact <tên>`. Chân phải giữ ở anchor (đường đỏ y=392 trong lưới).
- **Mặt**: thêm khoá vào `faces` của rig.json (phòng điều hành), vẽ `parts/face/<khoá>.svg` (+ `.over.svg`), dùng `"face":"<khoá>"`; `faces.js` dựng ảnh bán thân 256×256 cho 18 khoá đầu (cắt canvas [92,60,216,216]).
- **Đạo cụ / hiệu ứng**: đặt `parts/props/<id>.svg` hoặc `parts/fx/<id>.svg` (viewBox 400×400, vẽ ở toạ độ tư thế gốc nếu `bone` là xương, hoặc tuỳ ý nếu `none/canvas`), rồi `show` trong khung. Mỗi `id` trong SVG nên có tiền tố tên file.
- Thử khi chưa có hình thật: tạo bộ phận giả (hình chữ nhật đúng toạ độ RIG-SPEC) trong thư mục tạm và trỏ bằng `--parts`.

## Cấu trúc
`lib/rig.js` (ma trận + ghép SVG), `lib/action.js` (đọc action, inherit/tween/$ref), `lib/util.js` (tham số, chạy Electron), `build.js`, `faces.js`, `pose.js`, `sheet.js`, `pack.base.json`, `svg2png.js`.
