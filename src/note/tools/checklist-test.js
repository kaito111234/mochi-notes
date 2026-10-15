/* MochiNote giả tối thiểu cho trang thử */
(function () {
  'use strict';
  const ed = document.getElementById('editor');
  const hist = { s: [ed.innerHTML], i: 0 };
  const listeners = {};
  function toggleEmpty() { ed.classList.toggle('empty', !ed.querySelector('img') && ed.textContent.trim() === ''); }
  window.__calls = { after: 0, checks: [] };
  window.MochiPaperStore = { checkItem(id, i, d) { window.__calls.checks.push([id, i, d]); } };
  window.MochiNote = {
    id: 'test', editor: ed, body: document.querySelector('.body'),
    isLocked: () => !!window.__locked,
    histCommit() { const h = ed.innerHTML; if (h !== hist.s[hist.i]) { hist.s.length = hist.i + 1; hist.s.push(h); hist.i++; } },
    afterEdit() { window.__calls.after++; toggleEmpty(); },
    closePops() { document.getElementById('menu').hidden = true; },
    on(e, cb) { (listeners[e] = listeners[e] || []).push(cb); },
    textHooks: [],
    note: () => null, zoom: () => 1, toast() {}
  };
  window.__hist = hist;
  window.__text = () => { for (const h of window.MochiNote.textHooks) { const t = h(ed); if (typeof t === 'string') return t; } return ed.innerText; };
  document.getElementById('btnMenu').addEventListener('click', () => { const m = document.getElementById('menu'); m.hidden = !m.hidden; });
  toggleEmpty();
})();
