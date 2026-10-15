// Hướng dẫn lần đầu của Mochi Notes: 6 bước, nội dung tĩnh (không nhận dữ liệu từ ngoài) nên dùng innerHTML an toàn.
(function () {
  'use strict';
  const O = (window.mochi && window.mochi.onboarding) || { finish() {}, close() {} };
  const $ = id => document.getElementById(id);
  const k = (...keys) => keys.map(x => '<span class="key">' + x + '</span>').join('+');

  // ---------------------------------------------------------------- hình minh hoạ: khung hình THẬT của bé Mochi (assets/pet/mochi)
  // Tên file NNNN_ms.png: ms = thời lượng khung. Mỗi bước một hoạt ảnh lặp.
  const BASE = '../../assets/pet/mochi/';
  const seq = (dir, ms) => ms.map((d, i) => BASE + dir + '/' + String(i + 1).padStart(4, '0') + '_' + d + '.png');
  const ANIM = [
    seq('idle/normal/loop', [160, 160, 180, 80, 160, 160]),     // 1 chào
    seq('hold_note/normal/loop', [400, 400, 400, 400]),         // 2 cầm note
    seq('ring/normal/loop', [100, 100, 100, 100]),              // 3 rung chuông nhắc giờ
    seq('happy/normal/single', [100, 100, 100, 100, 80, 100, 160, 160]), // 4 vui
    seq('pat_head/happy/loop', [120, 120, 120, 120]),           // 5 được xoa đầu
    seq('idle/happy/loop', [160, 160, 180, 80, 160, 160])       // 6 vui vẻ chào
  ];
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delays = list => list.map(u => +(/_(d+).png$/.exec(u) || [0, 150])[1]);
  const cache = {};
  function preload(list) { list.forEach(u => { if (!cache[u]) { const i = new Image(); i.src = u; cache[u] = i; } }); }
  ANIM.forEach(preload);
  let animT = null;
  function play(list) {
    if (animT) { clearTimeout(animT); animT = null; }
    hero.textContent = '';
    const img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.src = list[0];
    hero.appendChild(img);
    if (still || list.length < 2) return;
    const ds = delays(list);
    let i = 0;
    const tick = () => { i = (i + 1) % list.length; img.src = list[i]; animT = setTimeout(tick, Math.max(60, ds[i])); };
    animT = setTimeout(tick, Math.max(60, ds[0]));
  }

  // ---------------------------------------------------------------- nội dung các bước
  const say = t => '<span class="chip say">' + t + '</span>';
  const STEPS = [
    { t: 'Chào cậu, tớ là Mochi!', b: 'Tớ là <b>bé thú cưng sống trên màn hình</b> của cậu. Tớ giữ note, <b>nhắc việc đúng giờ</b> và ngồi chơi cùng cậu cho đỡ buồn. Cùng đi một vòng chưa tới một phút nhé?', c: '' },
    { t: 'Tạo note thật nhanh', b: 'Bấm ' + k('Ctrl', 'Alt', 'N') + ' ở bất cứ đâu để tạo note mới.<br><b>Bấm đúp</b> biểu tượng Mochi ở khay hệ thống (góc phải thanh tác vụ) để mở danh sách note.', c: '<span class="chip">' + k('Ctrl', 'Alt', 'L') + ' danh sách</span><span class="chip">' + k('Ctrl', 'Alt', 'H') + ' ẩn/hiện note</span>' },
    { t: 'Nhắc giờ không cần cài đặt', b: 'Cứ <b>gõ giờ vào note</b>, tớ tự hiểu và nhắc. Tới giờ tớ hiện <b>to giữa màn hình</b> để cậu không bỏ lỡ.', c: say('“9h sáng mai họp”') + say('“nhắc 15 phút nữa”') },
    { t: 'Ra lệnh cho tớ', b: 'Trong note gõ <b>“bé ơi, …”</b> rồi dừng tay là tớ làm ngay. Không mở note cũng được: bấm ' + k('Ctrl', 'Alt', 'B') + ' để gõ lệnh.', c: say('“bé ơi, dọn dẹp”') + say('“bé ơi, hát”') + say('“bé ơi, tập trung 25 phút”') },
    { t: 'Chuột phải lên tớ nè', b: '<b>Nhấp chuột phải</b> lên tớ để mở thanh công cụ (tủ đồ, gacha, trò chơi...). <b>Giữ chuột trái và kéo thả</b> để đưa tớ tới chỗ khác. Bấm đúp vào tớ để mở tủ đồ.', c: '' },
    { t: 'Chỉnh theo ý cậu ở khay', b: 'Nhấp chuột phải biểu tượng Mochi ở khay để chỉnh: <b>giờ yên lặng</b>, <b>âm lượng nhắc</b>, <b>sao lưu</b> note ra thư mục cậu chọn, và “Giới thiệu”. Muốn xem lại bài này: mục “Hướng dẫn sử dụng”.', c: '' }
  ];

  const hero = $('hero'), title = $('title'), body = $('body'), chips = $('chips'), stepNo = $('stepNo'), dots = $('dots');
  const back = $('back'), next = $('next');
  let cur = 0, closing = false;

  STEPS.forEach(() => { const d = document.createElement('span'); d.className = 'dot'; dots.appendChild(d); });

  function render(animate) {
    const s = STEPS[cur], last = cur === STEPS.length - 1;
    stepNo.textContent = (cur + 1) + ' / ' + STEPS.length;
    play(ANIM[cur]);
    hero.classList.remove('swap');
    if (animate) { void hero.offsetWidth; hero.classList.add('swap'); }
    title.textContent = s.t;
    body.innerHTML = s.b;
    chips.innerHTML = s.c;
    [...dots.children].forEach((d, i) => { d.className = 'dot' + (i === cur ? ' on' : i < cur ? ' past' : ''); });
    back.hidden = cur === 0;
    next.textContent = last ? 'Bắt đầu' : 'Tiếp';
    next.focus();
  }
  function go(d) {
    if (closing) return;
    const n = cur + d;
    if (n < 0) return;
    if (n >= STEPS.length) { closing = true; O.finish('start'); return; }
    cur = n; render(true);
  }
  function skip() { if (closing) return; closing = true; O.finish('skip'); }

  next.addEventListener('click', () => go(1));
  back.addEventListener('click', () => go(-1));
  $('skip').addEventListener('click', skip);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); skip(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  // cho bộ chụp ảnh thử: ?step=N nhảy thẳng tới bước N (không ảnh hưởng người dùng thật)
  const m = /[?&]step=(\d)/.exec(location.search);
  if (m && +m[1] >= 1 && +m[1] <= STEPS.length) cur = +m[1] - 1;
  render(false);
})();
