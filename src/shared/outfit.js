/* MochiOutfit — điểm neo đồ mặc trên hình bé, dùng chung cho tủ đồ (preview) và bé trên desktop (pet).
 * Toạ độ theo khung gói hình 400x400 (assets/pet/mochi). slot: [tâm x, tâm y, cỡ, lớp z]; z < 2 nằm sau thân bé. */
(function () {
  'use strict';
  var ANCHOR = {
    back: [200, 242, 190, 1],
    body: [200, 286, 112, 3],
    outer: [200, 284, 142, 4],
    neck: [200, 238, 62, 5],
    glasses: [200, 182, 100, 6],
    hairclip: [240, 126, 50, 7],
    hat: [200, 92, 150, 8],
    hand: [266, 302, 72, 9]
  };
  // Một số hình làm đầu bé lệch khỏi tư thế đứng: bù theo hành động (dx, dy theo khung 400, góc xoay độ).
  var POSE = {
    sleep: { dx: 0, dy: 26, rot: 8 },
    sit: { dx: 0, dy: 18, rot: 0 },
    fall: { dx: 0, dy: -6, rot: 0 },
    lifted: { dx: 0, dy: -4, rot: 0 },
    land: { dx: 0, dy: 10, rot: 0 }
  };
  // Dáng nghiêng (walk_side/turn_side, mặt nhìn sang phải): đồ đầu/cổ không vẽ như dáng thẳng.
  //   C = đỉnh đầu của khung đứng; vị trí = C + [dx,dy,(s)] của head_side.json + (neo + off - C) * s  (s = tỉ lệ đầu, mặc định 1)
  //   off = lệch so với neo dáng thẳng (px khung 400, ở s = 1); sx = ép ngang (hình nhìn cạnh hẹp hơn);
  //   side = true -> dùng bản vẽ nghiêng icons/side/<tên icon>; hide = ẩn khi nghiêng (không có cách vẽ nghiêng hợp lý).
  var SIDE = {
    C: [200, 88],      // điểm co đầu = đỉnh đầu (art mới thu đầu quanh đỉnh)
    s: 1,              // tỉ lệ đầu mặc định của khung nghiêng (art vòng 4: đầu về cỡ idle); head_side.json có phần tử thứ 3 thì dùng cái đó
    glasses: { off: [42, -5], size: 124, side: true, lean: [-30, 8] },   // lean: bù khi đầu cúi/chúi (dx lớn, dáng mệt) — cộng dần từ dx=25 tới dx=50
    hat: { off: [-2, 16], sx: 0.95 },
    hairclip: { off: [-80, 62], lean: [-14, 14] },
    neck: { off: [20, -12], sx: 0.55, lean: [-25, 4] },
    // turn: { hide: [slot...], maxDx } — ẩn slot ở khung turn_side có dx < maxDx (hiện không dùng: khung xoay vòng 5 là hình nghiêng nén ngang, vẽ nghiêng được)
    back: { hide: true },
    hand: { hide: true }
  };
  // đường dẫn bản nghiêng của một icon: .../icons/x.svg -> .../icons/side/x.svg
  function sideSrc(src) { return String(src).replace(/\/([^\/]+)$/, '/side/$1'); }
  window.MochiOutfit = { ANCHOR: ANCHOR, POSE: POSE, FRAME: 400, SIDE: SIDE, sideSrc: sideSrc };
})();
