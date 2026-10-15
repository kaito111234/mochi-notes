'use strict';
(function () {
  const $ = id => document.getElementById(id);
  let data = { items: [], quitting: false };

  function render() {
    $('title').textContent = data.title || 'Tớ dặn cậu nè';
    const ul = $('items'); ul.textContent = '';
    for (const it of data.items) { const li = document.createElement('li'); li.textContent = it.text; ul.appendChild(li); }
    $('btnStay').hidden = !data.quitting;
    $('btnOk').textContent = data.quitting ? 'Nhớ rồi, thoát' : 'Nhớ rồi';
  }
  $('btnOk').addEventListener('click', () => {
    if (data.quitting) window.mochi.memos.quitNow();
    else window.mochi.memos.ack(data.items.map(i => i.memoId));
  });
  $('btnStay').addEventListener('click', () => window.close());
  window.mochi.memos.onShow(d => { data = d || data; render(); });
  window.mochi.memos.popupReady();
})();
