// Ô ra lệnh nhanh cho bé Mochi (Ctrl+Alt+B): Enter gửi, Esc đóng, ↑ gọi lại lệnh trước.
(function () {
  'use strict';
  const X = window.mochi && window.mochi.extras;
  const f = document.getElementById('f'), t = document.getElementById('t');
  const hist = [];
  let hi = 0;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const v = t.value.trim();
    if (!v || !X) return;
    if (hist[hist.length - 1] !== v) hist.push(v);
    hi = hist.length;
    t.value = '';
    X.cmd(v);
  });
  t.addEventListener('keydown', e => {
    if (e.key === 'Escape') { t.value = ''; if (X) X.close(); }
    else if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); t.value = hist[hi]; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && hist.length) { hi = Math.min(hist.length, hi + 1); t.value = hist[hi] || ''; e.preventDefault(); }
  });
  if (X) X.onShow(() => { t.focus(); t.select(); });
})();
