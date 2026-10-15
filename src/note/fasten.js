'use strict';
// window.MochiFasten — tờ giấy được ghim/kẹp/dán lên màn hình: vẽ ghim (MochiPins), đung đưa khi kéo cửa sổ,
// nghiêng nhẹ, và nút kéo đổi cỡ (cửa sổ trong suốt không tự đổi cỡ được).
(function () {
  var body = document.body, sheet = document.getElementById('sheet'), layer = document.getElementById('fasten');
  var note = document.getElementById('note'), grip = document.getElementById('grip');
  if (!sheet || !layer || !note || !window.MochiPins) return;
  var Pins = window.MochiPins;
  var FALLBACK = ['red', 'pink', 'coral', 'orange', 'yellow', 'mint', 'sky', 'blue', 'lavender', 'purple'];
  var TOP = { nail: 46, mappin: 36, clothespin: 34, binder: 30, bulldog: 30, paperclip: 26, heartclip: 28, bow: 26, magnet: 22, 'magnet-strawberry': 22, 'magnet-cat': 22, none: 10, photocorners: 10, brad: 10 };

  function ctl() { return window.MochiPaperCtl || null; }
  function noteId() { return (window.MochiNote && window.MochiNote.id) || ''; }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ghim đang dùng: chọn riêng cho note > ghim kèm mẫu giấy > đinh ghim màu theo note
  function current() {
    var st = {}; try { st = ctl() ? ctl().state() : {}; } catch (_) { /* bỏ qua */ }
    var meta = st.meta || {}, def = null;
    try { def = window.MochiPaper.get(st.paperId); } catch (_) { /* bỏ qua */ }
    var dp = (def && def.pin) || null;
    var type = meta.pin || (dp && dp.type) || 'pushpin';
    if (type === 'magnet' && !meta.pin && dp && dp.shape && dp.shape !== 'round') type = 'magnet-' + dp.shape;
    if (!Pins.has(type)) type = 'pushpin';
    var color = meta.pinColor || (!meta.pin && dp && dp.color) || Pins.DEF_COLOR[type] || FALLBACK[hash(noteId()) % FALLBACK.length];
    return { type: type, color: color, pattern: !meta.pin && dp ? dp.pattern : null, kind: def && def.kind, tilt: !!st.tilt, own: !!meta.pin };
  }

  var cur = null, lastKey = '';
  function render(force) {
    cur = current();
    var W = note.offsetWidth, H = note.offsetHeight;
    var key = [cur.type, cur.color, cur.pattern, cur.kind, W, H].join('|');
    body.style.setProperty('--mt', (TOP[cur.type] || 24) + 'px');
    if (!force && key === lastKey) { applyTransform(); return; }
    lastKey = key;
    layer.textContent = '';
    var items = Pins.render(cur.type, cur.color, W, H, { pattern: cur.pattern, hole: cur.kind === 'kraft' });
    items.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'fz';
      d.style.left = it.x + 'px'; d.style.top = it.y + 'px'; d.style.width = it.w + 'px'; d.style.height = it.h + 'px';
      d.innerHTML = it.html;          // SVG do pins.js tự sinh, không có dữ liệu người dùng
      layer.appendChild(d);
    });
    var pv = Pins.pivot(cur.type, W);
    sheet.style.transformOrigin = pv[0] + 'px ' + pv[1] + 'px';
    body.dataset.pin = cur.type;
    applyTransform();
  }

  /* ---------- đung đưa (lò xo tắt dần quanh cây ghim) ---------- */
  var ang = 0, vel = 0, raf = 0, lastT = 0;
  function tilt() { return cur && cur.tilt ? ((hash(noteId()) % 2 ? 1 : -1) * (0.8 + (hash(noteId() + 't') % 9) / 10)) : 0; }
  function applyTransform() {
    var still = body.classList.contains('pop');      // đang mở bảng chọn: giữ giấy thẳng cho dễ bấm
    var a = still ? 0 : tilt() + ang;
    sheet.style.transform = a ? 'rotate(' + a.toFixed(2) + 'deg)' : '';
  }
  function step(t) {
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000 || 0.016); lastT = t;
    var acc = -110 * ang - 5.5 * vel;
    vel += acc * dt; ang += vel * dt;
    if (ang > 9) { ang = 9; vel *= -0.4; } else if (ang < -9) { ang = -9; vel *= -0.4; }
    applyTransform();
    if (Math.abs(ang) < 0.02 && Math.abs(vel) < 0.05) { ang = 0; vel = 0; raf = 0; lastT = 0; applyTransform(); return; }
    raf = requestAnimationFrame(step);
  }
  function kick(dx, dy, minK) {
    var k = cur ? Pins.swingOf(cur.type) : 0;
    if (k && minK) k = Math.max(k, minK);
    if (!k || body.classList.contains('pop')) return;
    vel += (-dx * 4.5 + (Math.abs(dy) > 6 ? (Math.random() - 0.5) * dy * 0.6 : 0)) * k;
    if (!raf) raf = requestAnimationFrame(step);
  }
  try { if (window.mochi && window.mochi.paper && window.mochi.paper.onMoved) window.mochi.paper.onMoved(function (d) { if (d) kick(+d.dx || 0, +d.dy || 0); }); } catch (_) { /* bỏ qua */ }

  /* ---------- nút đổi cỡ ---------- */
  if (grip) {
    var drag = null, busy = false, want = null;
    function push() {
      if (busy || !want) return;
      var sz = want; want = null; busy = true;
      var p = null;
      try { p = window.mochi.paper.resize(noteId(), sz); } catch (_) { /* bỏ qua */ }
      Promise.resolve(p).catch(function () {}).then(function () { busy = false; push(); });
    }
    grip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      drag = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight };
      body.classList.add('resizing');
    });
    grip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      want = { width: Math.round(drag.w + e.screenX - drag.x), height: Math.round(drag.h + e.screenY - drag.y) };
      push();
    });
    function end() { drag = null; body.classList.remove('resizing'); }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  /* ---------- nối dây ---------- */
  if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(note);
  new MutationObserver(function () { applyTransform(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  try { if (ctl() && ctl().on) ctl().on('change', function () { render(); }); } catch (_) { /* bỏ qua */ }
  render(true);

  window.MochiFasten = {
    current: function () { return cur || current(); },
    set: function (type, color) {
      var c = ctl(); if (!c || !c.choose) return Promise.resolve();
      return c.choose({ pin: type || null, pinColor: color || null }).then(function () { render(true); kick(14, 0); });
    },
    wiggle: function (n) { kick(n || 18, 0, 0.6); }   // bé Mochi lắc: ghim chặt cũng rung nhẹ
  };
})();
