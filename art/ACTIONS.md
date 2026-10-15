# Bảng hành động gói `mochi`

_Sinh từ `assets/pet/mochi` (lượt Đợt 3). Phòng điều hành chốt vào hợp đồng 03._

Đường dẫn: `<action>/<mood>/<phase>/NNNN_<ms>.png`. Hướng: action có `dir:"right"` trong `pack.json.actions` vẽ hướng PHẢI, engine lật khi cần. Tham số căn chỉnh (px canvas 400×400) cũng ở `pack.json.actions`.

| Action | Nguồn | Mood | Phase (số khung) | Mô tả | Tham số |
|---|---|---|---|---|---|
| `angry` | hợp đồng 03 | normal | start 3, loop 4, end 3 | phụng phịu giậm chân |  |
| `eat` | hợp đồng 03 | happy, normal | start 4, loop 6, end 3 | ăn bánh daifuku |  |
| `fall` | hợp đồng 03 | normal | loop 3 | đang rơi |  |
| `happy` | hợp đồng 03 | normal | single 8 | vui nhảy |  |
| `hold_note` | hợp đồng 03 | normal | start 3, loop 4, end 3 | giơ tờ note hai tay (note.center) |  |
| `idle` | hợp đồng 03 | happy, normal, sad, tired | loop 6 | đứng thở, chớp mắt |  |
| `land` | hợp đồng 03 | normal | single 5 | tiếp đất |  |
| `lifted` | hợp đồng 03 | normal | loop 4 | bị nhấc, tóc hất lên |  |
| `pat_body` | hợp đồng 03 | normal | start 2, loop 4, end 3 | bị chọc thân, nhột |  |
| `pat_head` | hợp đồng 03 | happy, normal | start 3, loop 4, end 3 | được xoa đầu |  |
| `peek_left` | hợp đồng 03 | normal | start 3, loop 4, end 3 | nấp mép trái, tay bám x=0 | edgeX=0 |
| `peek_right` | hợp đồng 03 | normal | start 3, loop 4, end 3 | nấp mép phải, tay bám x=400 | edgeX=400 |
| `ring` | hợp đồng 03 | normal | start 2, loop 4, end 3 | rung chuông báo thức |  |
| `sad` | hợp đồng 03 | normal | start 3, loop 4, end 3 | buồn, mây mưa |  |
| `say` | hợp đồng 03 | happy, normal, sad, tired | loop 4 | cử chỉ khi nói |  |
| `shutdown` | hợp đồng 03 | normal | single 8 | chào, ôm mèo, mờ dần |  |
| `shy` | hợp đồng 03 | normal | start 3, loop 4, end 3 | ngại che má |  |
| `sit` | hợp đồng 03 | normal, tired | start 3, loop 4, end 3 | ngồi bệt, mặt ngồi = anchor | seatY=392 |
| `sleep` | hợp đồng 03 | normal | start 4, loop 4, end 3 | ngồi ôm mèo ngủ |  |
| `startup` | hợp đồng 03 | normal | single 8 | hiện ra, vươn vai, chào |  |
| `walk` | hợp đồng 03 | happy, normal, sad, tired | loop 8 | đi bộ tại chỗ (engine dịch cửa sổ) | speed=2.2 |
| `wave` | hợp đồng 03 | happy, normal | single 6 | vẫy tay |  |
| `work` | hợp đồng 03 | normal, tired | start 4, loop 6, end 4 | ngồi gõ laptop |  |
| `carry_note` | core Đợt 2B | normal | loop 8 | ôm tờ note đi bộ | speed=2.2 |
| `cheer` | core Đợt 2B | normal | single 9 | reo mừng, hoa giấy |  |
| `climb` | core Đợt 2B | normal | loop 6 | leo mép phải (gripX) | gripX=300, dir="right" |
| `crumple` | core Đợt 2B | normal | single 9 | vo tờ note thành cục |  |
| `knock` | core Đợt 2B | normal | start 3, loop 6, end 3 | gõ cộc cộc vào mép phải (wallX) | wallX=315, dir="right" |
| `peek_note` | core Đợt 2B | normal | start 4, loop 6, end 3 | thò đầu sau mép note (edgeY) | edgeY=232 |
| `play_cat` | core Đợt 2B | happy, normal | start 4, loop 6, end 3 | chơi với mèo đen bông |  |
| `point` | core Đợt 2B | normal | start 3, loop 4, end 3 | chỉ tay sang phải (tip) | tip=[342,237], dir="right" |
| `read` | core Đợt 2B | normal | start 3, loop 6, end 3 | đọc sách/note |  |
| `sit_on_note` | core Đợt 2B | happy, normal | start 4, loop 6, end 3 | ngồi vắt vẻo mép note (seatY) | seatY=338 |
| `stretch` | core Đợt 2B | normal | single 9 | vươn vai |  |
| `throw` | core Đợt 2B | normal | single 8 | ném cục giấy sang phải (release) | dir="right", releaseFrame=5, releaseMs=330, release=[301,181], velocity=[0.4,-0.3] |
| `write` | core Đợt 2B | normal | start 3, loop 6, end 3 | viết lên giấy note |  |
| `yawn` | core Đợt 2B | normal, tired | single 8 | ngáp |  |
