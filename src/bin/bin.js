// Thùng rác trên desktop: bấm để mở thùng rác (nhặt lại note), kéo để dời, nhận bóng giấy bé Mochi ném vào.
(function () {
  'use strict';
  const A = window.mochi && window.mochi.antics;
  const can = document.getElementById('can'), ball = document.getElementById('ball'), count = document.getElementById('count');
  const COLORS = { yellow: '#FFF7D1', green: '#E4F9E0', pink: '#FFE4F1', purple: '#F2E6FF', blue: '#E2F1FF', gray: '#F3F2F1', charcoal: '#7a7a7a' };

  // click xuyên, trừ khi chuột đang trên thùng
  let ignoring = true, drag = null;
  function setIgnore(v) { if (v !== ignoring) { ignoring = v; try { A && A.binIgnore(v); } catch (_) { /* bỏ qua */ } } }
  document.addEventListener('mousemove', ev => { if (!drag) setIgnore(!(ev.target && ev.target.closest && ev.target.closest('#can'))); });
  document.addEventListener('mouseleave', () => { if (!drag) setIgnore(true); });

  // kéo để dời / bấm để mở
  can.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    drag = { x: ev.screenX, y: ev.screenY, moved: false };
    try { can.setPointerCapture(ev.pointerId); } catch (_) { /* bỏ qua */ }
    if (A) A.binDrag('start', 0, 0);
  });
  can.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.screenX - drag.x, dy = ev.screenY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; can.classList.add('drag');
    if (A) A.binDrag('move', dx, dy);
  });
  function end(ev) {
    if (!drag) return;
    const was = drag; drag = null; can.classList.remove('drag');
    try { can.releasePointerCapture(ev.pointerId); } catch (_) { /* bỏ qua */ }
    if (A) A.binDrag('end', 0, 0);
    if (!was.moved) { bump(false); if (A) A.binClick(); }
  }
  can.addEventListener('pointerup', end);
  can.addEventListener('pointercancel', end);
  can.addEventListener('contextmenu', ev => { ev.preventDefault(); if (A) A.binMenu(); });

  function setCount(n) { n = Math.max(0, n | 0); count.textContent = n > 99 ? '99+' : String(n); count.hidden = !n; }
  function bump(happy) {
    can.classList.remove('bump', 'happy'); void can.offsetWidth;
    can.classList.add('bump'); if (happy) can.classList.add('happy');
    setTimeout(() => can.classList.remove('happy'), 1300);
  }
  // bóng giấy bay vào từ mép trái/phải cửa sổ (nối tiếp cú ném bên cửa sổ bé) rồi rơi vào miệng thùng
  function catchBall(c) {
    const W = window.innerWidth;
    const r = can.getBoundingClientRect(), ms = c.ms || 520;
    const fromRight = c.from !== 'left';
    const sx = fromRight ? W - 6 : 6, sy = Math.max(16, r.top - 70);
    ball.style.left = sx + 'px'; ball.style.top = sy + 'px';
    ball.style.setProperty('--paper', COLORS[c.color] || COLORS.yellow);
    ball.style.setProperty('--tx', ((r.left + r.width / 2) - sx) + 'px');
    ball.style.setProperty('--ty', ((r.top + 26) - sy) + 'px');
    ball.style.setProperty('--dur', ms + 'ms');
    can.classList.add('open');
    ball.hidden = false; ball.className = ''; void ball.offsetWidth; ball.className = 'drop';
    setTimeout(() => {
      ball.hidden = true; ball.className = '';
      can.classList.remove('open'); bump(true);
      if (typeof c.count === 'number') setCount(c.count);
    }, ms + 40);
  }

  if (A) A.onBin(c => {
    if (!c || !c.op) return;
    if (c.op === 'count') setCount(c.n);
    else if (c.op === 'catch') catchBall(c);
    else if (c.op === 'open') can.classList.toggle('open', !!c.on);
    else if (c.op === 'bump') bump(!!c.happy);
    else if (c.op === 'appear' || c.op === 'leave') {
      const w = document.getElementById('wrap');
      w.classList.remove('appear', 'leave'); void w.offsetWidth; w.classList.add(c.op);
    }
  });
})();
