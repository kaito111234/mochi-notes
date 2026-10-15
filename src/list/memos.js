(function () {
  'use strict';
  const L = window.MochiList, api = window.mochi;
  if (!L || !api) return;
  const $ = id => document.getElementById(id);
  const el = L.el;
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const WHENS = [
    ['startup', 'Khi mở máy'], ['morning', 'Buổi sáng'], ['noon', 'Buổi trưa'],
    ['evening', 'Buổi tối'], ['before-shutdown', 'Trước khi tắt máy']
  ];
  const NOT_READY = 'Chưa sẵn sàng';
  let memos = [], ready = false, failed = false, editing = null, askId = null;

  function daysLabel(m) {
    if (!m.days || !m.days.length || m.days.length >= 7) return 'Mọi ngày';
    const s = m.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return s.map(d => WD[d]).join(', ');
  }

  function render() {
    const root = $('mmGroups'), empty = $('mmEmpty');
    root.textContent = '';
    empty.textContent = '';
    const known = WHENS.map(w => w[0]);
    const groups = WHENS.concat([['__other', 'Khác']]);
    groups.forEach(([k, label]) => {
      const list = memos.filter(m => k === '__other' ? !known.includes(m.when) : m.when === k);
      if (!list.length) return;
      const g = el('section', 'mm-group');
      g.setAttribute('aria-label', label);
      g.appendChild(el('h3', null, label));
      const box = el('div', 'mm-list');
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(m => box.appendChild(buildRow(m)));
      g.appendChild(box);
      root.appendChild(g);
    });
    empty.hidden = memos.length > 0;
    if (!memos.length) {
      if (failed) empty.append(el('h3', null, NOT_READY), el('p', null, 'Dặn dò chưa kết nối được, thử lại sau ít giây.'));
      else if (ready) empty.append(el('h3', null, 'Chưa có dặn dò nào'), el('p', null, 'Tớ sẽ nhắc cậu đúng lúc, ví dụ "Uống thuốc" vào buổi sáng.'));
    }
  }

  function iconBtn(act, label, path) {
    const b = el('button', 'mini');
    b.type = 'button'; b.dataset.act = act; b.title = label; b.setAttribute('aria-label', label);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = path;
    b.appendChild(s);
    return b;
  }

  function buildRow(m) {
    const row = el('div', 'mm-row' + (m.enabled ? '' : ' off'));
    row.dataset.id = m.id;
    const txt = el('div', 'mm-txt');
    txt.appendChild(el('span', 'mm-text', m.text));
    const meta = el('span', 'mm-meta', daysLabel(m));
    if (m.once) meta.appendChild(el('span', 'tag', 'Một lần'));
    txt.appendChild(meta);
    row.appendChild(txt);
    const acts = el('div', 'mm-acts');
    if (askId === m.id) {
      const y = el('button', 'btn sm danger', 'Xoá'); y.type = 'button'; y.dataset.act = 'del-yes';
      const n = el('button', 'btn sm', 'Huỷ'); n.type = 'button'; n.dataset.act = 'del-no';
      acts.append(n, y);
    } else {
      acts.appendChild(iconBtn('test', 'Thử dặn dò này', '<path d="M8 5v14l11-7z"/>'));
      acts.appendChild(iconBtn('edit', 'Sửa dặn dò', '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'));
      acts.appendChild(iconBtn('ask', 'Xoá dặn dò', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'));
    }
    row.appendChild(acts);
    const sw = el('button', 'switch-btn');
    sw.type = 'button'; sw.dataset.act = 'toggle';
    sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(!!m.enabled));
    sw.setAttribute('aria-label', 'Bật tắt dặn dò: ' + m.text);
    sw.appendChild(el('span', 'switch'));
    row.appendChild(sw);
    return row;
  }

  function apply(snap) {
    if (!snap || typeof snap !== 'object') return;
    memos = Array.isArray(snap.memos) ? snap.memos : [];
    ready = true; failed = false;
    if (askId && !memos.some(m => m.id === askId)) askId = null;
    render();
  }
  function load() {
    try { api.memos.list().then(apply).catch(() => { failed = true; render(); }); }
    catch (e) { failed = true; render(); }
  }

  // ---------- form sửa ----------
  function fillWhen(sel) {
    WHENS.forEach(([k, label]) => { const o = el('option', null, label); o.value = k; sel.appendChild(o); });
  }
  function dowsInit() {
    const box = $('mmDows');
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const b = el('button', 'dow', WD[d]);
      b.type = 'button'; b.dataset.d = d; b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', d === 0 ? 'Chủ nhật' : 'Thứ ' + (d + 1));
      box.appendChild(b);
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('.dow'); if (!b) return;
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
  }
  function openSheet(open) {
    const s = $('mmSheet');
    s.classList.toggle('open', open);
    s.setAttribute('aria-hidden', String(!open));
    s.inert = !open;
  }
  function openEdit(m) {
    editing = m;
    $('mmEText').value = m.text;
    $('mmEWhen').value = m.when;
    $('mmEOnce').checked = !!m.once;
    $('mmDows').querySelectorAll('.dow').forEach(b => b.setAttribute('aria-pressed', String((m.days || []).includes(+b.dataset.d))));
    openSheet(true);
    setTimeout(() => $('mmEText').focus({ preventScroll: true }), 30);
  }
  function closeEdit() { openSheet(false); editing = null; }

  async function saveEdit() {
    if (!editing) return;
    const text = $('mmEText').value.trim();
    if (!text) { L.toast('Nội dung dặn dò đang trống', true); return; }
    const days = [...$('mmDows').querySelectorAll('.dow[aria-pressed="true"]')].map(b => +b.dataset.d);
    try {
      const r = await api.memos.update(editing.id, { text, when: $('mmEWhen').value, days: days.length && days.length < 7 ? days : [], once: $('mmEOnce').checked });
      if (!r) { L.toast('Không lưu được', true); return; }
      L.toast('Đã lưu dặn dò'); closeEdit(); load();
    } catch (e) { L.toast(NOT_READY, true); }
  }

  function bind() {
    fillWhen($('mmWhen')); fillWhen($('mmEWhen')); dowsInit();
    $('mmAdd').addEventListener('submit', async e => {
      e.preventDefault();
      const text = $('mmText').value.trim();
      if (!text) { $('mmText').focus(); return; }
      try {
        const r = await api.memos.create({ text, when: $('mmWhen').value, once: $('mmOnce').checked });
        if (!r) { L.toast('Không thêm được', true); return; }
        $('mmText').value = ''; $('mmOnce').checked = false;
        L.toast('Đã thêm dặn dò'); load();
      } catch (err) { L.toast(NOT_READY, true); }
    });
    $('mmGroups').addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'), row = e.target.closest('.mm-row');
      if (!btn || !row) return;
      const m = memos.find(x => x.id === row.dataset.id);
      if (!m) return;
      try {
        switch (btn.dataset.act) {
          case 'toggle': m.enabled = !m.enabled; render(); if (!(await api.memos.update(m.id, { enabled: m.enabled }))) load(); break;
          case 'test': { const ok = await api.memos.test(m.id); if (ok === false) L.toast('Không thử được', true); break; }
          case 'edit': openEdit(m); break;
          case 'ask': askId = m.id; render(); { const n = document.querySelector('.mm-row[data-id="' + m.id + '"] [data-act="del-no"]'); if (n) n.focus(); } break;
          case 'del-no': askId = null; render(); break;
          case 'del-yes': askId = null; await api.memos.remove(m.id); L.toast('Đã xoá dặn dò'); load(); break;
        }
      } catch (err) { L.toast(NOT_READY, true); load(); }
    });
    $('mmBack').addEventListener('click', closeEdit);
    $('mmForm').addEventListener('submit', e => { e.preventDefault(); saveEdit(); });
    try { api.memos.onChanged(apply); } catch (e) { /* chưa có */ }
    L.onTab('memos', load);
    load();
  }
  bind();
})();
