(function () {
  'use strict';
  const L = window.MochiList, api = window.mochi;
  if (!L || !api) return;
  const $ = id => document.getElementById(id);
  const el = L.el;
  const NOT_READY = 'Chưa sẵn sàng';
  const pad = n => String(n).padStart(2, '0');
  let selFile = null, items = [];

  function fmtDay(day) {
    const s = String(day || '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    const t = Number(day);
    if (Number.isFinite(t) && t > 1e9) { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
    return s;
  }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB'; }

  // ---------- xuất / nhập ----------
  async function exportAll(fmt) {
    try {
      const r = await api.notes2.exportAll(fmt);
      if (r && r.ok) L.toast('Đã xuất ' + (r.count != null ? r.count + ' note' : 'file'));
      else if (r && r.error) L.toast('Không xuất được: ' + r.error, true);
      // r.ok=false không có lỗi: người dùng bấm huỷ
    } catch (e) { L.toast(NOT_READY, true); }
  }
  async function importFile() {
    try {
      const r = await api.notes2.importFile();
      if (!r) return;
      if (r.ok) L.toast('Đã nhập ' + (r.count || 0) + ' note' + (r.errors && r.errors.length ? ', ' + r.errors.length + ' lỗi' : ''), !!(r.errors && r.errors.length && !r.count));
      else if (r.errors && r.errors.length) L.toast('Không nhập được: ' + r.errors[0], true);
    } catch (e) { L.toast(NOT_READY, true); }
  }

  // ---------- khôi phục ----------
  function sheet(open) {
    const s = $('bkSheet');
    s.classList.toggle('open', open);
    s.setAttribute('aria-hidden', String(!open));
    s.inert = !open;
  }
  function setBody(...nodes) { const b = $('bkBody'); b.textContent = ''; nodes.forEach(n => b.appendChild(n)); }
  function msg(t, sub) { const d = el('div', 'empty'); d.appendChild(el('h3', null, t)); if (sub) d.appendChild(el('p', null, sub)); return d; }

  async function openBackups() {
    selFile = null; items = [];
    $('bkTitle').textContent = 'Bản sao lưu';
    $('bkFoot').hidden = true;
    setBody(msg('Đang tải...'));
    sheet(true);
    setTimeout(() => $('bkBack').focus({ preventScroll: true }), 30);
    let list;
    try { list = await api.notes2.listBackups(); } catch (e) { setBody(msg(NOT_READY, 'Chưa kết nối được phần sao lưu.')); return; }
    if (!Array.isArray(list) || !list.length) { setBody(msg('Chưa có bản sao lưu nào', 'Mochi tự sao lưu mỗi ngày khi bạn dùng.')); return; }
    const ul = el('div', 'bk-list');
    list.forEach(b => {
      const btn = el('button', 'bk-item');
      btn.type = 'button'; btn.dataset.file = b.file;
      btn.appendChild(el('span', 'bk-day', fmtDay(b.day)));
      btn.appendChild(el('span', 'bk-sub', (b.noteCount != null ? b.noteCount + ' note' : '') + (b.size ? ' · ' + fmtSize(b.size) : '')));
      ul.appendChild(btn);
    });
    setBody(el('p', 'bk-hint', 'Chọn một bản để xem các note trong đó.'), ul);
    const first = ul.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }

  async function openBackup(file, dayLabel) {
    selFile = file;
    $('bkTitle').textContent = 'Bản ngày ' + dayLabel;
    setBody(msg('Đang đọc...'));
    let r;
    try { r = await api.notes2.readBackup(file); } catch (e) { r = null; }
    if (!r || !Array.isArray(r.notes)) { setBody(msg('Không đọc được bản này', 'File có thể đã bị hỏng.')); return; }
    items = r.notes;
    if (!items.length) { setBody(msg('Bản này không có note')); return; }
    const ul = el('div', 'bk-notes');
    items.forEach(n => {
      const lab = el('label', 'bk-note');
      const cb = el('input'); cb.type = 'checkbox'; cb.dataset.id = n.id;
      cb.checked = !n.exists;      // mặc định chọn các note đã bị xoá
      const t = el('span', 'bk-ntitle', n.title || 'Note trống');
      const st = n.exists ? (n.same ? 'giống' : 'khác hiện tại') : 'đã xoá';
      const tag = el('span', 'tag ' + (n.exists ? (n.same ? 'same' : 'diff') : 'gone'), st);
      lab.append(cb, t, tag);
      ul.appendChild(lab);
    });
    setBody(ul);
    $('bkFoot').hidden = false;
    $('bkRestore').textContent = 'Khôi phục mục đã chọn';
    $('bkRestore').dataset.ask = '';
    syncAll();
  }
  function checks() { return [...$('bkBody').querySelectorAll('.bk-note input')]; }
  function syncAll() {
    const c = checks();
    $('bkAll').checked = c.length > 0 && c.every(x => x.checked);
  }
  async function doRestore() {
    const ids = checks().filter(c => c.checked).map(c => c.dataset.id);
    const btn = $('bkRestore');
    if (!ids.length) { L.toast('Chưa chọn note nào', true); return; }
    if (btn.dataset.ask !== '1') {
      btn.dataset.ask = '1';
      btn.textContent = 'Xác nhận khôi phục ' + ids.length + ' note';
      setTimeout(() => { btn.dataset.ask = ''; btn.textContent = 'Khôi phục mục đã chọn'; }, 4000);
      return;
    }
    btn.dataset.ask = ''; btn.textContent = 'Khôi phục mục đã chọn';
    try {
      const r = await api.notes2.restoreBackup(selFile, ids);
      if (r && r.ok) { L.toast('Đã khôi phục ' + (r.restored != null ? r.restored : ids.length) + ' note'); sheet(false); }
      else L.toast('Không khôi phục được', true);
    } catch (e) { L.toast(NOT_READY, true); }
  }

  // ---------- cài đặt báo thức ----------
  let muteSave = false;
  function alarmSettings(s) {
    if (!s) return;
    muteSave = true;
    const set = (id, v) => {
      const e = $(id); if (!e || v == null) return;
      if (![...e.options].some(o => o.value === String(v))) { const o = el('option', null, v + ' phút'); o.value = v; e.appendChild(o); }
      e.value = String(v);
    };
    set('sDefSnooze', s.defaultSnoozeMin); set('sRingMax', s.ringMaxMin);
    if (typeof s.volume === 'number') { $('sVol').value = Math.round(s.volume * 100); $('sVolOut').textContent = Math.round(s.volume * 100) + '%'; }
    muteSave = false;
  }
  function saveSettings(patch) {
    if (muteSave) return;
    try { api.alarms.setSettings(patch).then(s => { if (s) alarmSettings(s); }).catch(() => L.toast(NOT_READY, true)); }
    catch (e) { L.toast(NOT_READY, true); }
  }

  function bind() {
    $('grpData').addEventListener('click', e => {
      const b = e.target.closest('[data-data]'); if (!b) return;
      const k = b.dataset.data;
      if (k === 'exp-json') exportAll('json');
      else if (k === 'exp-txt') exportAll('txt');
      else if (k === 'exp-md') exportAll('md');
      else if (k === 'import') importFile();
      else if (k === 'restore') openBackups();
    });
    $('bkBack').addEventListener('click', () => {
      if (selFile) { selFile = null; $('bkFoot').hidden = true; openBackups(); }
      else { sheet(false); const r = document.querySelector('[data-data="restore"]'); if (r) r.focus({ preventScroll: true }); }
    });
    $('bkBody').addEventListener('click', e => {
      const b = e.target.closest('.bk-item');
      if (b) openBackup(b.dataset.file, b.querySelector('.bk-day').textContent);
    });
    $('bkBody').addEventListener('change', syncAll);
    $('bkAll').addEventListener('change', () => { const v = $('bkAll').checked; checks().forEach(c => { c.checked = v; }); });
    $('bkRestore').addEventListener('click', doRestore);
    $('sDefSnooze').addEventListener('change', e => saveSettings({ defaultSnoozeMin: +e.target.value }));
    $('sRingMax').addEventListener('change', e => saveSettings({ ringMaxMin: +e.target.value }));
    $('sVol').addEventListener('input', e => { $('sVolOut').textContent = e.target.value + '%'; });
    $('sVol').addEventListener('change', e => saveSettings({ volume: (+e.target.value) / 100 }));
    try { api.alarms.list().then(s => { if (s) alarmSettings(s.settings); }).catch(() => {}); } catch (e) { /* chưa có */ }
  }
  window.MochiData = { alarmSettings };
  bind();
})();
