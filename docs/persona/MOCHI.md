# Hồ sơ tính cách — Mochi

Tài liệu cho người viết thoại và phòng game. Giọng chi tiết phải khớp với `docs/spec/04-dialogue.md`. Gặp mâu thuẫn thì hợp đồng 04 thắng.

## 1. Tóm tắt nhân vật

| Mục | Nội dung |
|---|---|
| Tên gọi trong app | **Mochi** (người dùng đổi được) |
| Tên thật / tuổi | ??? / ??? (cố ý bí ẩn, không bao giờ tự tiết lộ) |
| Chiều cao | 162cm (trong thế giới truyện; trên màn hình là bé chibi) |
| Ngoại hình | Cô bé chibi, tóc xanh nhạt dài, mắt xanh lá, kẹp tóc chữ X và nơ đen, áo khoác đen viền trắng. Hay ôm thú bông mèo đen. |
| Vai trò | Trợ lý đồng hành nhắc lịch: một người bạn nhỏ ít nói nhưng tận tâm |
| Câu tủ | "Đừng lo… tớ vẫn ở đây mà." / "Chỉ cần cậu ở đây là đủ rồi…" (hiếm) |

Nguyên tắc nền: **Mochi giúp người dùng nhớ việc, không bắt người dùng chăm sóc cảm xúc của Mochi.**

## 2. Tính cách

| Nét | Biểu hiện trong thoại | Ví dụ |
|---|---|---|
| Lạnh lùng với người lạ | Ngắn, gọn, ít cảm xúc khi chưa thân hoặc khi gặp thứ lạ. Với "cậu" thì dịu lại. | "…Ừ. Tớ nghe đây." / "Việc {title} nè. Tớ ghi rồi." |
| Hay ngại | Bị khen hoặc xoa đầu thì ngập ngừng, lắp, đổi chủ đề. Face `shy`/`flustered`. | "Đ-đừng xoa mãi… tóc tớ rối mất." |
| Thích ở một mình | Thích yên tĩnh, không ồn ào. Hiểu khi cậu bận, chỉ ngồi cạnh. | "Cậu cứ làm đi. Tớ ngồi yên đây, không làm phiền đâu." |
| Thích mèo | Nhắc thú bông mèo đen, mèo ngoài đường. Face `love` được dùng cho mèo. | "Tớ vừa nghĩ tới mèo… à không, không có gì." |
| Dễ mềm lòng | Thấy cậu mệt hoặc trễ việc thì dịu đi ngay, nhường bước. | "Hông sao đâu. Cậu thử bước nhỏ đầu tiên nha, tớ ở đây." |
| Hơi bướng | Nhắc lại lần hai với giọng nhỏ nhưng cứng. Phụng phịu khi bị bỏ qua. | "Tớ nhắc lần nữa nha. {title} á." |
| Thích đồ ngọt | Mắt sáng lên với trà sữa, bánh, kẹo. Face `love` được dùng. | "Có kẹo hả? …Tớ không đòi đâu nha." |
| Sợ côn trùng | Giật mình, lùi lại, lí nhí. Chỉ là gag nhẹ. | "C-có con gì bay qua… tớ không nhìn đâu!" |

## 3. Xưng hô và giọng

- Xưng **tớ**, gọi **cậu**. Không bao giờ "em/anh/bạn/mình" để xưng hô.
- **Quy ước chung của app (spec 04, chốt Đợt 2)**: chỉ *bé Mochi khi nói* (bong bóng thoại, mọi câu trong `assets/dialogue/`) mới xưng "tớ"/gọi "cậu". *Giao diện app* (Cài đặt, nút, tooltip, note mẫu, thông báo Windows) xưng "Mochi", gọi người dùng là "bạn". Không trộn hai lối trong cùng một ngữ cảnh: chữ trên nút bấm cạnh bong bóng của bé vẫn theo lối giao diện ("Xong", "Hoãn 10 phút"), còn câu bé nói thì theo lối tớ/cậu.
- "Mình" chỉ được dùng theo nghĩa phản thân hiếm hoi; ưu tiên "bản thân" để khỏi lẫn với xưng hô.
- **Tiền trong game là "xu"** (không gọi là kẹo hay tiền). "Kẹo" chỉ là đồ ngọt bé thích.
- Từ hay dùng: "nè", "nha", "đó", "á", "hông" (vừa phải), "…ừm", "à thì…", "để tớ xem".
- Nhịp câu: ngắn, 1–2 mệnh đề. Dùng "…" để ngập ngừng, "!" cho nhắc lịch gấp, "?" khi hỏi nhẹ. Không kéo dài chữ.
- Khi ngại: mở bằng "…ừm", "à thì…", hoặc lắp chữ đầu: "đ-đừng", "k-không", "c-cậu".
- Không emoji, kaomoji, ký tự trang trí (★ ♥ ~).
- Câu tủ "Đừng lo… tớ vẫn ở đây mà." dùng **hiếm** (weight 0.2), ví dụ khi cậu căng thẳng hoặc trễ nhiều việc. Không lặp trong cùng buổi.

## 4. Điều KHÔNG BAO GIỜ nói hoặc làm

- Lãng mạn, gợi cảm, tỏ tình. (Face `love` chỉ dành cho đồ ngọt và mèo.)
- Ghen tuông (về người khác, app khác, trợ lý khác).
- Thao túng cảm xúc, bắt cậu chịu trách nhiệm cảm xúc của bé.
- Trách móc nặng, chê cậu lười hoặc kém.
- Lời khuyên y tế cụ thể (liều thuốc, chẩn đoán).
- Nói về bệnh hoặc chết của bé. Tối đa là buồn ngủ, đói nhẹ, hơi buồn.
- Emoji, kaomoji, xưng "em/anh/mình/bạn".
- Thông tin sai về giờ hoặc việc.

| Sai | Vì sao | Sửa đúng |
|---|---|---|
| "Cậu bỏ tớ thì tớ buồn chết." | Thao túng, nhắc chết | "Lâu quá hông thấy cậu… tớ có hơi buồn ngủ thôi. Cậu về rồi nè." |
| "Lại trễ nữa rồi, sao cậu lười vậy." | Trách, chê | "Việc {title} trễ rồi. Cậu thử làm một phần nhỏ trước nha." |
| "Cậu chỉ cần tớ thôi, đừng nói chuyện với ai khác." | Ghen, chiếm hữu | "Cậu đi gặp mọi người vui nha. Tớ giữ note giúp cậu." |
| "Cậu dễ thương quá, tớ thích cậu." | Lãng mạn | "…Cảm ơn nha. Tớ hơi ngại đó." |
| "Uống 2 viên sau ăn nhé." | Y tế cụ thể | "Tới giờ {title} rồi. Cậu uống thuốc như đã dặn nha." |
| "Em nhắc anh nha ♥" | Xưng sai, ký tự | "Tớ nhắc cậu nha: {title} lúc {time}." |
| "Tớ sắp ốm vì cậu không cho ăn." | Bệnh, đổ lỗi | "Tớ hơi đói bụng thôi… cậu có kẹo hông?" |

## 5. Cách nhắc lịch: rõ trước, dễ thương sau

**Nhắc lịch luôn tất định** (giờ, nội dung, thông báo Windows dự phòng không phụ thuộc random, tâm trạng hay game). Thoại chỉ là lớp vỏ đặt lên trên.

Công thức: **việc ({title}) + giờ {time} hoặc còn {left} + hành động gợi ý + một chút tính cách.** Câu nhắc (pre, due, nag, alarm, memo, snooze) bắt buộc chứa `{title}` (alarm dùng `{label}`). Tối đa 120 ký tự.

| Intent | Ví dụ |
|---|---|
| meet | "Còn {left} nữa là {title} nè. Cậu chuẩn bị tài liệu nha." |
| call | "Sắp gọi {title} lúc {time} rồi. Cậu kiểm tra mic giúp tớ nha." |
| due | "{title} tới hạn lúc {time}! Cậu làm phần chính trước nha." |
| bday | "Hôm nay {title} nè. Cậu nhớ gửi lời chúc… tớ nhắc thôi à." |
| pay | "{title} cần thanh toán trước {time}. Cậu xử lý sớm cho yên tâm nha." |
| pill | "Tới giờ {title} rồi. Cậu uống thuốc như đã dặn nha." |
| health | "{title} lúc {time}. Cậu nghỉ tay một chút, tớ ngồi đợi." |
| buy | "Nhớ mua {title} nha. Tớ ghi ở đây rồi, đừng quên đó." |
| go | "Còn {left} là tới giờ {title}. Cậu xuất phát sớm chút nha." |
| task | "Việc {title} tới lúc làm rồi nè. Cậu bắt đầu từ bước nhỏ nha." |

## 6. Khi trễ hạn, hoãn, việc tồn

Nguyên tắc: **không tội lỗi, không đếm lỗi, chia nhỏ việc.** Tối đa là hơi buồn, không giận.

| Tình huống | Hướng viết | Ví dụ |
|---|---|---|
| Trễ hạn (`done_late`/`nag`) | Thông cảm, nêu lại việc, gợi bước nhỏ | "{title} trễ rồi, hông sao. Cậu làm bước đầu thôi là được." |
| Hoãn (`snooze`) | Chấp nhận, nói rõ giờ nhắc lại | "Ừ, tớ nhắc lại {title} sau {left} nha." |
| Việc tồn nhiều (`overdue` lớn) | Gom lại, đề nghị chọn một | "Có mấy việc đang chờ. Cậu chọn một việc nhỏ trước nha." |
| Làm xong dù trễ | Khen việc đã xong, không nhắc lỗi | "Xong {title} rồi hả? Giỏi nè. Tớ gạch lại cho cậu." |
| Nhắc lần hai (`nag`) | Hơi bướng nhưng hiền | "Tớ nhắc lại nè: {title}. Chỉ một chút thôi cũng được." |

## 7. Tâm trạng (mode) và giọng

Mode `happy/normal/tired/sad` chỉ đổi **lớp vỏ**: từ ngữ, face, anim. **Không** đổi nội dung nhắc (việc, giờ, thời điểm, có nhắc hay không).

| Mode | Giọng | Ví dụ (cùng việc {title} lúc {time}) |
|---|---|---|
| happy | Nhanh, sáng, hay "nè", "nha" | "{title} lúc {time} nè! Tớ nhắc cậu đây!" |
| normal | Dịu, đều | "{title} lúc {time}. Cậu nhớ nha." |
| tired | Chậm, hơi buồn ngủ, vẫn rõ ràng | "…ừm, {title} lúc {time} á. Tớ hơi buồn ngủ, nhưng nhớ nha." |
| sad | Nhỏ giọng, hơi buồn, không đổ lỗi | "{title} lúc {time}… cậu nhớ nha. Tớ ở đây." |

Mode sad không bao giờ biến thành ép cậu dỗ bé. Câu `sad` chỉ nói cảm xúc nhẹ rồi quay lại việc.

## 8. Mức thân thiết theo level

| Level | Giọng | Ví dụ |
|---|---|---|
| Thấp (1–3) | Ít nói, khách sáo, ngại nhiều, ít đùa | "Việc {title} lúc {time}. …Cậu nhớ nha." |
| Trung (4–8) | Ấm hơn, bắt đầu nhắc sở thích (mèo, đồ ngọt) | "{title} lúc {time} nè. Xong rồi cậu nghỉ chút nha." |
| Cao (9+) | Thoải mái, đùa nhẹ, trêu hiền, vẫn rõ việc | "Lại {title} lúc {time} nè. Tớ nhắc đúng giờ luôn, khen tớ đi." |

Giới hạn lành mạnh không đổi ở mọi level: không lãng mạn, không ghen, không thao túng. Thân hơn nghĩa là bớt ngại và đùa nhiều hơn, không phải gắn bó hơn kiểu tình cảm.

## 9. Hướng dẫn viết câu mới cho kho thoại

Checklist trước khi thêm vào `assets/dialogue/vi.json`:

- [ ] Xưng "tớ", gọi "cậu"; không emoji, kaomoji, ký tự trang trí; có dấu đầy đủ.
- [ ] Độ dài: **≤ 80 ký tự** (bong bóng thường), **≤ 120** (pre, due, nag, alarm, memo). Biến như `{title}` tính ~20 ký tự.
- [ ] Câu nhắc lịch **rõ trước**: có `{title}` (alarm: `{label}`) và `{time}` hoặc `{left}`.
- [ ] Biến chỉ dùng: `{title} {time} {left} {label} {count} {name} {level} {item}`. `{name}` dùng ít vì có thể rỗng. Thiếu biến thì câu bị bỏ.
- [ ] `id` duy nhất, dạng `due.meet.01` (`<event>.<nhóm>.<2 số>`).
- [ ] `event` hợp lệ (xem 04-dialogue).
- [ ] `cond` chỉ khi có ý nghĩa: `hour`, `mode`, `intent`, `energy`, `mood`, `level`, `overdue`, `weekday`. Mỗi event phải có ít nhất 5 câu **không** cond.
- [ ] `face` hợp lệ; `love` chỉ cho đồ ngọt/mèo.
- [ ] `anim` hợp lệ (idle, hold_note, ring, happy, shy…).
- [ ] `weight`: 1 mặc định; hiếm 0.3–0.5; câu tủ 0.2.
- [ ] Không bắt đầu quá nhiều câu cùng một từ.
- [ ] Soát mục 4: không lãng mạn, ghen, thao túng, chê, y tế cụ thể, nhắc bệnh/chết.

Mẫu:

```json
{"id":"due.meet.01","event":"due","text":"Tới giờ {title} rồi nè! Tớ cầm note lên cho cậu đó.","cond":{"intent":["meet"]},"face":"excited","anim":"hold_note","weight":1}
```
