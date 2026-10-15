(function () {
  'use strict';
  const L = window.MochiList, api = window.mochi, R = window.MochiRecur, P = window.MochiParse;
  if (!L || !api) return;
  const $ = id => document.getElementById(id);
  const el = L.el;
  const pad = n => String(n).padStart(2, '0');
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const NOT_READY = 'Chưa sẵn sàng';

  let alarms = [], missed = [], sounds = [], settings = {};
  let ready = false, failed = false;
  let editing = null;        // null = tạo mới, object = đang sửa
  let dirtyDate = false, dirtyRep = false;
  let form = null;

  // ---------- tiện ích ----------
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function remaining(ms) {
    const m = Math.max(0, Math.ceil(ms / 6e4));
    if (m < 1) return 'Còn chưa đầy 1 phút';
    if (m < 60) return 'Còn ' + m + ' phút';
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return 'Còn ' + h + ' giờ' + (mm ? ' ' + mm + ' phút' : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return 'Còn ' + d + ' ngày' + (hh ? ' ' + hh + ' giờ' : '');
  }
  function describe(a) {
    const r = a.repeat;
    if (!r) {
      if (a.date) {
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const [y, mo, d] = a.date.split('-').map(Number);
        const diff = Math.round((new Date(y, mo - 1, d) - t) / 864e5);
        if (diff === 0) return 'Một lần · hôm nay';
        if (diff === 1) return 'Một lần · ngày mai';
        return 'Một lần · ' + pad(d) + '/' + pad(mo) + '/' + y;
      }
      return 'Một lần';
    }
    try { if (R && R.describeRepeat) return R.describeRepeat(r); } catch (e) { /* dùng bản dự phòng */ }
    if (r.freq === 'daily') return 'Hằng ngày';
    if (r.freq === 'weekdays') return 'Ngày thường (T2–T6)';
    if (r.freq === 'weekly') return (r.byDay || []).map(d => WD[d]).join(', ') || 'Hằng tuần';
    if (r.freq === 'monthly') return 'Ngày ' + (r.byMonthDay || '') + ' hằng tháng';
    return 'Lặp lại';
  }
  function statusText(a) {
    if (!a.enabled) return 'Đã tắt';
    if (a.snoozedUntil && a.nextAt === a.snoozedUntil) {
      const d = new Date(a.snoozedUntil);
      return 'Hoãn đến ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    if (!a.nextAt) return a.repeat ? '' : 'Đã qua';
    return remaining(a.nextAt - Date.now());
  }

  // ---------- danh sách ----------
  function render() {
    const cards = $('alCards'), empty = $('alEmpty');
    cards.textContent = '';
    empty.textContent = '';
    const list = alarms.slice().sort((a, b) => (b.enabled - a.enabled) || String(a.time).localeCompare(String(b.time)));
    list.forEach(a => cards.appendChild(buildCard(a)));
    empty.hidden = list.length > 0;
    if (!list.length) {
      if (failed) empty.append(el('h3', null, NOT_READY), el('p', null, 'Báo thức chưa kết nối được, thử lại sau ít giây.'));
      else if (ready) empty.append(el('h3', null, 'Chưa có báo thức nào'), el('p', null, 'Bấm "Thêm báo thức" hoặc gõ một dòng như "6h30 sáng ngày thường dậy tập".'));
    }
    renderMissed();
  }
  function buildCard(a) {
    const card = el('article', 'al-card' + (a.enabled ? '' : ' off'));
    card.dataset.id = a.id;
    const main = el('button', 'al-main');
    main.type = 'button';
    main.dataset.act = 'edit';
    main.setAttribute('aria-label', 'Sửa báo thức ' + a.time + (a.label ? ', ' + a.label : ''));
    main.appendChild(el('span', 'al-time', a.time));
    main.appendChild(el('span', 'al-label' + (a.label ? '' : ' none'), a.label || 'Báo thức'));
    main.appendChild(el('span', 'al-rep', describe(a)));
    main.appendChild(el('span', 'al-left', statusText(a)));
    card.appendChild(main);
    const sw = el('button', 'switch-btn');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(!!a.enabled));
    sw.setAttribute('aria-label', 'Bật tắt báo thức ' + a.time + (a.label ? ' ' + a.label : ''));
    sw.dataset.act = 'toggle';
    sw.appendChild(el('span', 'switch'));
    card.appendChild(sw);
    return card;
  }
  function tickLeft() {
    document.querySelectorAll('#alCards .al-card').forEach(c => {
      const a = alarms.find(x => x.id === c.dataset.id);
      const t = c.querySelector('.al-left');
      if (a && t) t.textContent = statusText(a);
    });
  }
  function renderMissed() {
    const box = $('alMissed'), ul = $('alMissedList');
    ul.textContent = '';
    box.hidden = !missed.length;
    missed.slice().reverse().forEach(m => {
      const d = new Date(m.at);
      const li = el('li');
      li.appendChild(el('span', 'm-when', pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())));
      li.appendChild(el('span', 'm-label', m.label || 'Báo thức'));
      ul.appendChild(li);
    });
  }

  function apply(snap) {
    if (!snap || typeof snap !== 'object') return;
    alarms = Array.isArray(snap.alarms) ? snap.alarms : [];
    missed = Array.isArray(snap.missed) ? snap.missed : [];
    sounds = Array.isArray(snap.sounds) ? snap.sounds : [];
    settings = snap.settings || {};
    ready = true; failed = false;
    render();
    if (form && !$('alSheet').classList.contains('open')) fillSoundList();
    if (window.MochiData && window.MochiData.alarmSettings) window.MochiData.alarmSettings(settings);
  }
  function load() {
    try {
      api.alarms.list().then(apply).catch(() => { failed = true; render(); });
    } catch (e) { failed = true; render(); }
  }

  // ---------- form ----------
  const f = {};
  function initForm() {
    ['alH', 'alM', 'alLabel', 'alRep', 'alDate', 'alDateWrap', 'alDowWrap', 'alDows', 'alMonWrap', 'alMonDay', 'alSnd', 'alSndCustom', 'alSndFile', 'alSnooze', 'alDel', 'alTest', 'alFormTitle', 'alSheet', 'alForm']
      .forEach(k => { f[k] = $(k); });
    for (let i = 0; i < 7; i++) {
      const order = [1, 2, 3, 4, 5, 6, 0][i];
      const b = el('button', 'dow', WD[order]);
      b.type = 'button'; b.dataset.d = order;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', order === 0 ? 'Chủ nhật' : 'Thứ ' + (order + 1));
      f.alDows.appendChild(b);
    }
    for (let d = 1; d <= 31; d++) { const o = el('option', null, 'Ngày ' + d); o.value = d; f.alMonDay.appendChild(o); }
    form = f;
  }
  const segVal = (seg) => { const b = seg.querySelector('[aria-checked="true"]'); return b ? b.dataset.v : null; };
  function setSeg(seg, v) { seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v))); }
  function getDows() { return [...f.alDows.querySelectorAll('.dow[aria-pressed="true"]')].map(b => +b.dataset.d); }
  function setDows(arr) { f.alDows.querySelectorAll('.dow').forEach(b => b.setAttribute('aria-pressed', String(arr.includes(+b.dataset.d)))); }
  function timeStr() {
    const h = Math.min(23, Math.max(0, parseInt(f.alH.value, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(f.alM.value, 10) || 0));
    return pad(h) + ':' + pad(m);
  }
  function defaultDate() {
    const [h, m] = timeStr().split(':').map(Number);
    const n = new Date();
    const t = new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, m);
    if (t <= n) t.setDate(t.getDate() + 1);
    return dayKey(t);
  }
  function syncRepeatUi() {
    const v = segVal(f.alRep);
    f.alDateWrap.hidden = v !== 'once';
    f.alDowWrap.hidden = v !== 'weekly';
    f.alMonWrap.hidden = v !== 'monthly';
  }
  function syncSoundUi() {
    f.alSndCustom.hidden = segVal(f.alSnd) !== 'custom';
  }
  function fillSoundList(sel) {
    const cur = sel !== undefined ? sel : f.alSndFile.value;
    f.alSndFile.textContent = '';
    if (!sounds.length) { const o = el('option', null, 'Chưa có file nào'); o.value = ''; f.alSndFile.appendChild(o); }
    sounds.forEach(s => { const o = el('option', null, s.name || s.soundFile); o.value = s.soundFile; f.alSndFile.appendChild(o); });
    if (cur && sounds.some(s => s.soundFile === cur)) f.alSndFile.value = cur;
  }
  function openSheet(open) {
    const s = f.alSheet;
    s.classList.toggle('open', open);
    s.setAttribute('aria-hidden', String(!open));
    s.inert = !open;
  }
  function openForm(alarm, prefill) {
    if (!form) initForm();
    editing = alarm || null;
    dirtyDate = false; dirtyRep = false;
    const a = alarm || {};
    const p = prefill || {};
    f.alFormTitle.textContent = alarm ? 'Sửa báo thức' : 'Báo thức mới';
    const time = p.time || a.time || '07:00';
    f.alH.value = time.slice(0, 2); f.alM.value = time.slice(3, 5);
    f.alLabel.value = p.label != null ? p.label : (a.label || '');
    const r = p.repeat !== undefined ? p.repeat : a.repeat;
    let kind = 'once', byDay = [], mday = new Date().getDate();
    if (r) {
      if (r.freq === 'daily') kind = 'daily';
      else if (r.freq === 'weekdays') kind = 'weekdays';
      else if (r.freq === 'weekly') { kind = 'weekly'; byDay = r.byDay || []; }
      else if (r.freq === 'monthly') { kind = 'monthly'; mday = r.byMonthDay || mday; }
    }
    setSeg(f.alRep, kind); setDows(byDay); f.alMonDay.value = String(mday);
    f.alDate.value = p.date || a.date || defaultDate();
    if (p.date || a.date) dirtyDate = true;
    const snd = a.sound || settings.defaultSound || 'chime';
    setSeg(f.alSnd, snd);
    fillSoundList(a.soundFile || '');
    const sm = String(a.snoozeMin || settings.defaultSnoozeMin || 10);
    if (![...f.alSnooze.options].some(o => o.value === sm)) { const o = el('option', null, sm + ' phút'); o.value = sm; f.alSnooze.appendChild(o); }
    f.alSnooze.value = sm;
    f.alDel.hidden = !alarm; f.alTest.hidden = !alarm;
    f.alForm._orig = a.repeat || null;
    syncRepeatUi(); syncSoundUi();
    openSheet(true);
    setTimeout(() => f.alH.focus({ preventScroll: true }), 30);
  }
  function closeForm() { openSheet(false); editing = null; $('alAdd').focus({ preventScroll: true }); }

  function collect() {
    const kind = segVal(f.alRep);
    const out = { label: f.alLabel.value.trim(), time: timeStr(), snoozeMin: +f.alSnooze.value || 10 };
    if (kind === 'once') {
      out.repeat = null;
      out.date = f.alDate.value || defaultDate();
    } else {
      out.date = '';
      if (kind === 'daily') out.repeat = { freq: 'daily' };
      else if (kind === 'weekdays') out.repeat = { freq: 'weekdays' };
      else if (kind === 'weekly') {
        const d = getDows();
        if (!d.length) { L.toast('Hãy chọn ít nhất một thứ trong tuần', true); return null; }
        out.repeat = { freq: 'weekly', byDay: d };
      } else if (kind === 'monthly') out.repeat = { freq: 'monthly', byMonthDay: +f.alMonDay.value || 1 };
      const orig = f.alForm._orig;
      if (orig && !dirtyRep && (orig.freq === 'hourly' || (orig.interval && orig.interval > 1))) out.repeat = orig;
    }
    const sound = segVal(f.alSnd) || 'chime';
    out.sound = sound;
    if (sound === 'custom') {
      if (!f.alSndFile.value) { L.toast('Chưa chọn file âm thanh', true); return null; }
      out.soundFile = f.alSndFile.value;
    }
    return out;
  }

  async function save() {
    const data = collect();
    if (!data) return;
    try {
      let res;
      if (editing) res = await api.alarms.update(editing.id, data);
      else res = await api.alarms.create(Object.assign({ enabled: true }, data));
      if (!res) { L.toast('Không lưu được báo thức', true); return; }
      L.toast('Đã lưu báo thức ' + data.time);
      closeForm();
      load();
    } catch (e) { L.toast(NOT_READY, true); }
  }

  // ---------- tạo nhanh ----------
  function quickParse(text) {
    const out = { label: '', time: null, repeat: null, date: null };
    let rec = null;
    try { rec = R && R.parseRecur ? R.parseRecur(text) : null; } catch (e) { rec = null; }
    if (rec) { out.repeat = rec.repeat; out.time = rec.time; }
    if (!out.repeat || !out.time) {
      try {
        const w = P && P.parseWhen ? P.parseWhen(text) : null;
        if (w && w.timed) {
          const d = w.date;
          if (!out.time) out.time = pad(d.getHours()) + ':' + pad(d.getMinutes());
          if (!out.repeat) out.date = dayKey(d);
        }
      } catch (e) { /* bỏ qua */ }
    }
    if (!out.time) {
      const m = text.match(/(\d{1,2})\s*(?:h|giờ|:|g)\s*(\d{1,2})?/i);
      if (m && +m[1] < 24) out.time = pad(+m[1]) + ':' + pad(Math.min(59, +(m[2] || 0)));
    }
    // nhãn: bỏ các cụm chỉ giờ/lặp
    let s = ' ' + text + ' ';
    const kill = [
      /\d{1,2}\s*(?:h|giờ|g|:)\s*\d{0,2}/gi, /\d{1,2}\s*rưỡi/gi, /\b(?:sáng|trưa|chiều|tối|đêm|khuya)\b/gi,
      /(?:vào\s+)?(?:hằng|hàng|mỗi)\s+(?:ngày|tuần|tháng)(?:\s+\d{1,2})?/gi, /ngày thường|các ngày trong tuần|cuối tuần/gi,
      /(?:vào\s+)?(?:thứ\s*(?:hai|ba|tư|bốn|năm|sáu|bảy|[2-7])|chủ nhật|\bcn\b|\bt[2-7]\b)(?:\s*(?:,|và|-)\s*(?:thứ\s*)?(?:hai|ba|tư|bốn|năm|sáu|bảy|[2-7]|cn|t[2-7]))*/gi,
      /hôm nay|ngày mai|ngày mốt|\bmai\b/gi, /lúc|vào/gi
    ];
    kill.forEach(re => { s = s.replace(re, ' '); });
    out.label = s.replace(/\s+/g, ' ').trim();
    return out;
  }
  function quickSubmit(e) {
    e.preventDefault();
    const inp = $('alQuickIn');
    const text = inp.value.trim();
    if (!text) return;
    const q = quickParse(text);
    if (!q.time) { L.toast('Chưa hiểu giờ trong câu này. Ví dụ: 6h30 sáng dậy tập', true); return; }
    inp.value = '';
    openForm(null, { label: q.label, time: q.time, repeat: q.repeat || null, date: q.date || null });
  }

  // ---------- sự kiện ----------
  function bind() {
    initForm();
    $('alAdd').addEventListener('click', () => openForm(null));
    $('alBack').addEventListener('click', closeForm);
    $('alQuick').addEventListener('submit', quickSubmit);
    $('alForm').addEventListener('submit', e => { e.preventDefault(); save(); });
    $('alMissedClear').addEventListener('click', () => {
      try { api.alarms.clearMissed().then(load).catch(() => L.toast(NOT_READY, true)); } catch (e) { L.toast(NOT_READY, true); }
    });
    $('alCards').addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'), card = e.target.closest('.al-card');
      if (!btn || !card) return;
      const a = alarms.find(x => x.id === card.dataset.id);
      if (!a) return;
      if (btn.dataset.act === 'edit') openForm(a);
      else if (btn.dataset.act === 'toggle') {
        const on = !a.enabled;
        a.enabled = on; render();
        try { const r = await api.alarms.toggle(a.id, on); if (!r) load(); } catch (err) { L.toast(NOT_READY, true); load(); }
      }
    });
    f.alRep.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      setSeg(f.alRep, b.dataset.v); dirtyRep = true; syncRepeatUi();
    });
    f.alSnd.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      setSeg(f.alSnd, b.dataset.v); syncSoundUi();
    });
    f.alDows.addEventListener('click', e => {
      const b = e.target.closest('.dow'); if (!b) return;
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
    f.alDate.addEventListener('input', () => { dirtyDate = true; });
    const onTime = () => { if (!editing && !dirtyDate) f.alDate.value = defaultDate(); };
    [f.alH, f.alM].forEach(i => {
      i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 2); onTime(); });
      i.addEventListener('focus', () => i.select());
      i.addEventListener('blur', () => { const t = timeStr().split(':'); f.alH.value = t[0]; f.alM.value = t[1]; });
      i.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const max = i === f.alH ? 23 : 59, d = e.key === 'ArrowUp' ? 1 : -1;
        i.value = pad(((parseInt(i.value, 10) || 0) + d + max + 1) % (max + 1));
        onTime();
      });
    });
    $('alPick').addEventListener('click', async () => {
      try {
        const r = await api.alarms.pickSound();
        if (!r || !r.soundFile) return;
        if (!sounds.some(s => s.soundFile === r.soundFile)) sounds.push({ soundFile: r.soundFile, name: r.name || r.soundFile });
        fillSoundList(r.soundFile);
        setSeg(f.alSnd, 'custom'); syncSoundUi();
      } catch (e) { L.toast(NOT_READY, true); }
    });
    f.alTest.addEventListener('click', async () => {
      if (!editing) return;
      try { const ok = await api.alarms.test(editing.id); if (ok === false) L.toast('Không thử được chuông', true); }
      catch (e) { L.toast(NOT_READY, true); }
    });
    f.alDel.addEventListener('click', async () => {
      if (!editing) return;
      if (f.alDel.dataset.ask !== '1') {
        f.alDel.dataset.ask = '1'; f.alDel.textContent = 'Bấm lần nữa để xoá';
        setTimeout(() => { f.alDel.dataset.ask = ''; f.alDel.textContent = 'Xoá'; }, 3000);
        return;
      }
      try { await api.alarms.remove(editing.id); L.toast('Đã xoá báo thức'); closeForm(); load(); }
      catch (e) { L.toast(NOT_READY, true); }
    });
    try { api.alarms.onChanged(apply); } catch (e) { /* chưa có */ }
    L.onTab('alarms', () => { load(); });
    setInterval(() => { if (L.getTab() === 'alarms') tickLeft(); }, 30000);
    load();
  }
  bind();
  window.MochiAlarms = { reload: load };
})();
