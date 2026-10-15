# Bảng kiểm hình — bé Mochi

Quy ước: canvas 400×400 PNG trong suốt, anchor [200,392], hand [200,250].
Đường dẫn: `assets/pet/mochi/<action>/<mood>/<phase>/<NNNN>_<ms>.png`.
**normal bắt buộc; happy/tired/sad tuỳ chọn** (thiếu thì app dùng normal).
Đổi `[ ]` thành `[x]` khi xong (sửa trực tiếp file). Chi tiết tư thế: `ART-BRIEF.md`; prompt: `AI-PROMPTS.md`.

## Đợt vẽ 1 — tối thiểu để app đẹp

| Action | Phase | normal (bắt buộc) | happy | tired | sad |
|---|---|---|---|---|---|
| idle | loop | [ ] | [ ] | [ ] | [ ] |
| walk | loop | [ ] | [ ] | [ ] | [ ] |
| lifted | loop | [ ] | [ ] | [ ] | [ ] |
| fall | loop | [ ] | [ ] | [ ] | [ ] |
| land | single | [ ] | [ ] | [ ] | [ ] |
| pat_head | start | [ ] | [ ] | [ ] | [ ] |
| pat_head | loop | [ ] | [ ] | [ ] | [ ] |
| pat_head | end | [ ] | [ ] | [ ] | [ ] |
| sleep | start | [ ] | [ ] | [ ] | [ ] |
| sleep | loop | [ ] | [ ] | [ ] | [ ] |
| sleep | end | [ ] | [ ] | [ ] | [ ] |
| hold_note | start | [ ] | [ ] | [ ] | [ ] |
| hold_note | loop | [ ] | [ ] | [ ] | [ ] |
| hold_note | end | [ ] | [ ] | [ ] | [ ] |
| ring | start | [ ] | [ ] | [ ] | [ ] |
| ring | loop | [ ] | [ ] | [ ] | [ ] |
| ring | end | [ ] | [ ] | [ ] | [ ] |
| happy | single | [ ] | [ ] | [ ] | [ ] |

## Đợt vẽ 2 — cử chỉ và tương tác

| Action | Phase | normal (bắt buộc) | happy | tired | sad |
|---|---|---|---|---|---|
| sit | start | [ ] | [ ] | [ ] | [ ] |
| sit | loop | [ ] | [ ] | [ ] | [ ] |
| sit | end | [ ] | [ ] | [ ] | [ ] |
| pat_body | start | [ ] | [ ] | [ ] | [ ] |
| pat_body | loop | [ ] | [ ] | [ ] | [ ] |
| pat_body | end | [ ] | [ ] | [ ] | [ ] |
| wave | single | [ ] | [ ] | [ ] | [ ] |
| say | loop | [ ] | [ ] | [ ] | [ ] |
| peek_left | start | [ ] | [ ] | [ ] | [ ] |
| peek_left | loop | [ ] | [ ] | [ ] | [ ] |
| peek_left | end | [ ] | [ ] | [ ] | [ ] |
| peek_right | start | [ ] | [ ] | [ ] | [ ] |
| peek_right | loop | [ ] | [ ] | [ ] | [ ] |
| peek_right | end | [ ] | [ ] | [ ] | [ ] |
| startup | single | [ ] | [ ] | [ ] | [ ] |
| shutdown | single | [ ] | [ ] | [ ] | [ ] |

## Đợt vẽ 3 — hoàn thiện

| Action | Phase | normal (bắt buộc) | happy | tired | sad |
|---|---|---|---|---|---|
| sad | start | [ ] | [ ] | [ ] | [ ] |
| sad | loop | [ ] | [ ] | [ ] | [ ] |
| sad | end | [ ] | [ ] | [ ] | [ ] |
| shy | start | [ ] | [ ] | [ ] | [ ] |
| shy | loop | [ ] | [ ] | [ ] | [ ] |
| shy | end | [ ] | [ ] | [ ] | [ ] |
| angry | start | [ ] | [ ] | [ ] | [ ] |
| angry | loop | [ ] | [ ] | [ ] | [ ] |
| angry | end | [ ] | [ ] | [ ] | [ ] |
| eat | start | [ ] | [ ] | [ ] | [ ] |
| eat | loop | [ ] | [ ] | [ ] | [ ] |
| eat | end | [ ] | [ ] | [ ] | [ ] |
| work | start | [ ] | [ ] | [ ] | [ ] |
| work | loop | [ ] | [ ] | [ ] | [ ] |
| work | end | [ ] | [ ] | [ ] | [ ] |

(Tổng 23 action: Đợt 1 có 10, Đợt 2 có 8, Đợt 3 có 5. Phase và đợt lấy theo bảng mục 3 của ART-BRIEF.md.)

## Faces (256×256, `faces/<key>.png`)

- [ ] normal
- [ ] happy
- [ ] laugh
- [ ] excited
- [ ] surprised
- [ ] scared
- [ ] sad
- [ ] cry
- [ ] angry
- [ ] shy
- [ ] flustered
- [ ] cold
- [ ] tired
- [ ] sleepy
- [ ] bored
- [ ] protest
- [ ] uncomfortable
- [ ] love

## Chất lượng từng khung (kiểm chung)

- [ ] Nền trong suốt, không viền trắng/răng cưa
- [ ] Canvas đúng 400×400 (faces 256×256)
- [ ] Chân đặt đúng anchor [200,392] ở mọi khung đứng/đi
- [ ] Khung `hold_note`/`ring`/`eat` có tay quanh hand [200,250]
- [ ] Nhân vật đúng chuẩn (tóc xanh nhạt, mắt xanh lá, kẹp X + nơ đen, áo khoác đen), trang phục kín đáo
- [ ] Không chữ, watermark, nền
- [ ] Loop mượt (khung cuối nối được khung đầu)
- [ ] Tên file đúng `NNNN_ms.png`, số thứ tự liên tục

## Gói (pack)

- [ ] `pack.json` có `id`, `name`, `author`, `license`, `size: [400,400]`, `scale`
- [ ] `pack.json`: `anchor` [200,392]
- [ ] `pack.json`: `hitbox` (head, body) khớp hình thật
- [ ] `pack.json`: `hand` [200,250]
- [ ] `pack.json`: `faces` liệt kê các mặt đã có
- [ ] `pack.json`: `actions` (ví dụ `walk.speed`) nếu cần
- [ ] Đã ghi nguồn tạo hình (công cụ AI/họa sĩ, ngày, điều khoản thương mại) vào `license`/ghi chú
- [ ] Chạy `tools/anim` (phòng core): không báo thiếu/sai kích thước ở Đợt đang làm
- [ ] Chạy thử app: idle, walk, nhấc/thả, xoa đầu, nhắc lịch (hold_note/ring) hiển thị đúng
