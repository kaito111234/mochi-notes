'use strict';
(function () {
  const $ = id => document.getElementById(id);
  let data = { items: [], quitting: false };

  function render() {
    $('title').textContent = data.title || 'Tớ dặn cậu nè';
    $('line').textContent = data.line || ''; $('line').hidden = !data.line;
    const ul = $('items'); ul.textContent = '';
    for (const it of data.items) { const li = document.createElement('li'); li.textContent = it.text; ul.appendChild(li); }
    const st = $('btnStay'), ok = $('btnOk');
    st.hidden = !data.quitting;
    st.textContent = 'Chưa thoát';
    st.title = 'Đóng lời dặn, Mochi Notes vẫn chạy; lần sau cậu thoát tớ sẽ dặn lại';
    ok.textContent = data.quitting ? 'Thoát luôn' : 'Nhớ rồi';
    ok.title = data.quitting ? 'Cậu đã nhớ lời dặn, thoát Mochi Notes luôn' : 'Cậu đã nhớ, tớ sẽ không dặn lại lần này';
  }
  $('btnOk').addEventListener('click', () => {
    if (data.quitting) window.mochi.memos.quitNow();
    else window.mochi.memos.ack(data.items.map(i => i.memoId));
  });
  $('btnStay').addEventListener('click', () => window.close());
  window.mochi.memos.onShow(d => { data = d || data; render(); });
  window.mochi.memos.popupReady();
})();
