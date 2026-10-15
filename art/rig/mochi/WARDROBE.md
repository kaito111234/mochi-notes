# Tủ đồ của Mochi — hướng dẫn họa sĩ và cách core đổi đồ

Hai khe độc lập, mọi tổ hợp `body × outer` đều dựng được:
- **body** (catalog `body`): áo trong + váy/quần + tất/giày = các bộ phận gốc `torso`, `skirt`, `thigh_l/r`, `shin_l/r`, `upper_arm_l/r`, `forearm_l/r`.
- **outer** (catalog `outer`): áo khoác = các lớp tuỳ chọn `outer_torso`, `outer_upper_arm_l/r`, `outer_forearm_l/r`. Có thể không mặc (`none`).
Tóc, mặt, bàn tay, phụ kiện (hat, glasses, hand, back...) không thuộc hai khe này.

## Định dạng một món: `assets/wardrobe/<itemId>/`
- `item.json`: `{ "id", "slot": "body"|"outer", "name", "replaces": [tên file], "hides": [id lớp], "keeps": [id lớp], "notes" }`
  - `replaces`: danh sách file SVG món này thay thế (kiểm tra đủ file khi dựng). Mọi `.svg` trong thư mục đều được chồng lên bộ phận gốc.
  - `hides` (chỉ body): lớp ẩn hẳn (ghi SVG rỗng đè cả biến thể), vd quần dài liền thân ẩn `skirt`.
  - `keeps` (chỉ outer): mặc định mỗi lớp `outer_upper_arm_*`/`outer_forearm_*` che hẳn tay áo trong cùng bên (rig `covers`). Áo khoác ngắn tay chỉ che cánh tay trên thì ghi `"keeps": ["forearm_l","forearm_r"]` để tay áo sơ mi hiện ra.
- File SVG đặt TÊN ĐÚNG như bộ phận gốc (kể cả biến thể): `torso.svg`, `skirt.svg`, `thigh_l.svg`, `thigh_l.sit.svg`, `shin_r.sit.svg`, `upper_arm_l.svg`, `forearm_r.svg`, hoặc `outer_torso.svg`, `outer_upper_arm_l.svg`, `outer_forearm_r.svg`... Thiếu file nào thì dùng bộ phận gốc (body) hoặc không vẽ lớp đó (outer). Body không được chứa file `outer_*`, outer chỉ được chứa `outer_*`.
- Món mặc định: `body_default` (sơ mi trắng, cà vạt xanh, váy đen, tất đen, bốt — chính là bộ phận gốc nên chỉ có item.json) và `outer_black_white` (áo khoác đen viền trắng, khớp id catalog). **Đề xuất cho game/catalog**: thêm mục `body_default` (slot body) để người chơi có "bộ thân gốc" khi tháo đồ.

## Vẽ một món (quy tắc)
- Khung vẽ 400×400, vẽ ở **tư thế gốc** (xem RIG-SPEC.md): pivot khớp cố định, rig tự xoay.
- Pivot/xương: `outer_torso`, `torso`: chest (200,300); `skirt`: hips (200,306); đùi `thigh_l` (187,306)/`thigh_r` (213,306); ống `shin_l` (186,348)/`shin_r` (214,348); tay trên `upper_arm_l` (164,244)/`upper_arm_r` (236,244); cẳng tay `forearm_l` (156,278)/`forearm_r` (244,278).
- **Vùng khớp**: tay trên kéo xuống y≈282–294, cẳng tay bắt đầu y≈258–268 (chồng ~20 px quanh khuỷu) để xoay không lộ khe; cẳng tay kết thúc y≈311 nơi bàn tay (pivot 152,306) đè lên. Vai: đỉnh tay trên y≈230 phủ khớp vai (164,244). Đùi/ống chồng quanh y≈340–352.
- **Biến thể sit**: `thigh_*.sit.svg`, `shin_*.sit.svg` dùng khi ngồi (action `sit`, `sit_on_note`); làm theo cặp gốc.
- **z** (rig tự xếp, không tự đặt trong SVG): chân 40–51, váy 60, torso 70, outer_torso 71, cổ 80, tay trên 90/91, cẳng tay 100/101, bàn tay 110/111. Lớp `outer_*` **bám lớp** của tay/thân (`follow`, dz +0.5/+1): action đổi `z`/`hide`/`opacity` của `upper_arm_l`... thì áo khoác tự theo.
- Mọi món có thể được mặc cùng mọi món khác: outer phải phủ kín body (torso sơ mi rộng ≤ x 169–231, tay áo trong nằm gọn trong tay áo khoác) vì khi mặc thì tay áo trong bị che (covers); body phải đẹp khi KHÔNG có outer (không lộ khe vai/khuỷu).
- Màu viền navy `#1F2A44`, nét 3 px, bo tròn như bộ phận gốc. Tay phải = lật của tay trái (`matrix(-1 0 0 1 400 0)`) hoặc vẽ riêng.
- **Kín đáo, lành mạnh**: váy/quần dài tối thiểu tới giữa đùi, cổ áo không hở sâu, không xuyên thấu; ngoại hình vẫn là chibi dễ thương.

## Bộ phận gốc và build mặc định
`art/rig/mochi/parts/` giữ sơ mi/tay áo sơ mi ở tên gốc, **và một bản sao áo khoác** dưới tên `outer_*.svg` (= `assets/wardrobe/outer_black_white/`) để `node tools/rig/build.js` (không tham số) vẫn ra đúng hình mặc định (có áo khoác). Khi sửa áo khoác gốc nhớ sửa cả hai chỗ. Với `outfit.js`, mọi `outer_*` trong parts gốc bị gỡ trước khi chồng món outer (`--outer none` = chỉ sơ mi).

## Cách core đổi đồ: `tools/rig/outfit.js`
```
node tools/rig/outfit.js --body <id> --outer <id|none> --out <thư mục> [--only a,b] [--faces] [--keep-svg] [--frames-only]
```
Mặc định `--body/--outer` lấy `defaultOutfit` trong rig.json (`body_default` + `outer_black_white`). Các bước: copy parts gốc → thư mục tạm; gỡ `outer_*`; chồng file của body (và `hides`); chồng file của outer; ghi rig tạm (áp `keeps`); gọi `node tools/rig/build.js --rig <tạm> --parts <tạm> --out <dir> ...` (tiến trình con); xoá thư mục tạm (`--keep-tmp` để giữ). Sinh `pack.json` như build. Dựng đủ 37 action ≈ 55–60 giây (gồm nén màu), một vài action ≈ 10 giây. Khuyến nghị cho core: dựng sẵn mỗi tổ hợp khi người chơi đổi đồ ở nền (chỉ `--only` các action cần ngay: idle, walk) hoặc dựng sẵn các tổ hợp phổ biến lúc đóng gói. Món lạ phải khai trong thư mục `assets/wardrobe/<id>/` (có thể chỉnh `--wardrobe <thư mục>`).

## Cơ chế rig (tóm tắt)
- `follow` (+ `dz`): lớp lấy z = z hiện tại của lớp được bám (kể cả khi `frame.z` ghi đè) + dz; ẩn (`frame.hide`) và `frame.opacity` của lớp chủ áp lên lớp bám.
- `covers`: khi lớp này được vẽ, các lớp liệt kê bị bỏ qua (áo khoác che tay áo sơ mi, tránh đè sai thứ tự ở khuỷu).
