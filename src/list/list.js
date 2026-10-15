(function () {
  'use strict';
  const P = window.MochiParse;
  const api = window.mochi;
  const $ = id => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 15v5"/>',
    box: '<path d="M4 7h16v3H4z"/><path d="M5.5 10v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8"/><path d="M10 14h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    note: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
  };
  function icon(name, cls) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = ICONS[name];
    return s;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
  const FILTERS = {
    all: () => true,
    remind: n => remList(n).length > 0,
    shown: n => !!n.visible,
    hidden: n => !n.visible
  };

  let notes = [];
  let settings = {};
  let filter = 'all';
  let confirmId = null;
  let panelOpen = false;
  let trash = [];
  let trashConfirm = null; // id | 'all'
  let trashTimer = 0;
  const hasTrash = () => !!(api.notes2 && typeof api.notes2.trashList === 'function');

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

  function splitText(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return { title: (lines[0] || '').slice(0, 120), excerpt: lines.slice(1).join(' ').slice(0, 240) };
  }

  function ago(t) {
    const now = Date.now(), diff = now - t;
    if (diff < 60e3) return 'vừa xong';
    const m = Math.floor(diff / 6e4);
    if (m < 60) return m + ' phút trước';
    const h = Math.floor(diff / 36e5);
    const sod = x => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const days = Math.round((sod(now) - sod(t)) / 864e5);
    if (days <= 0) return h + ' giờ trước';
    if (days === 1) return 'hôm qua';
    const d = new Date(t), p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1);
  }

  function remStatus(r) {
    if (!r) return null;
    if (r.done) return { done: true, late: false };
    const diff = r.due - Date.now();
    return { done: false, late: diff < 0, text: (diff < 0 ? 'quá hạn ' : 'còn ') + P.dur(diff), when: P.whenLabel(r.due) };
  }

  // ---------- nhiều nhắc ----------
  function remList(n) {
    if (Array.isArray(n.reminders) && n.reminders.length) return n.reminders;
    return n.reminder ? [n.reminder] : [];
  }
  function openRems(n) { return remList(n).filter(r => r && !r.done).sort((a, b) => a.due - b.due); }
  const hasRem = n => remList(n).length > 0;
  function remTitle(n, r) { return r.title || splitText(n.text).title || 'Note'; }
  function remText(r) {
    if (r.done) return 'đã xong';
    const diff = r.due - Date.now();
    return (diff < 0 ? 'quá hạn ' : 'còn ') + P.dur(diff);
  }

  // ---------- render ----------
  function visibleNotes() {
    const q = norm($('q').value).trim();
    return notes.filter(FILTERS[filter]).filter(n => !q || norm(n.text).includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function renderChips() {
    const chips = $('chips');
    let tc = chips.querySelector('[data-f="trash"]');
    if (hasTrash() && !tc) {
      tc = el('button', 'chip');
      tc.type = 'button'; tc.dataset.f = 'trash'; tc.setAttribute('aria-pressed', 'false');
      tc.append('Thùng rác ', el('span', 'n', '0'));
      chips.appendChild(tc);
    }
    chips.querySelectorAll('.chip').forEach(c => {
      const f = c.dataset.f;
      c.setAttribute('aria-pressed', String(f === filter));
      c.querySelector('.n').textContent = f === 'trash' ? trash.length : notes.filter(FILTERS[f]).length;
    });
  }

  function renderUpcoming() {
    const box = $('upcoming'), rows = $('upRows');
    const list = [];
    notes.forEach(n => openRems(n).forEach(r => list.push({ n, r })));
    list.sort((a, b) => a.r.due - b.r.due);
    rows.textContent = '';
    box.hidden = !list.length || filter === 'trash';
    list.slice(0, 8).forEach(({ n, r }) => {
      const st = remStatus(r);
      const b = el('button', 'up-row');
      b.type = 'button';
      b.dataset.id = n.id;
      const t = el('span', 'up-title');
      t.appendChild(document.createTextNode(remTitle(n, r) || 'Note trống'));
      if (r.repeat) {
        const rp = el('span', 'up-rep', '↻');
        rp.title = 'Nhắc lặp lại'; rp.setAttribute('aria-label', 'Nhắc lặp lại');
        t.appendChild(rp);
      }
      b.appendChild(t);
      b.appendChild(el('span', 'up-status' + (st.late ? ' late' : ''), st.text));
      b.appendChild(el('span', 'up-when', st.when));
      rows.appendChild(b);
    });
    if (list.length > 8) rows.appendChild(el('p', 'up-more', '+' + (list.length - 8) + ' nhắc nữa'));
  }

  const expanded = new Set();
  const suggs = new Map(); // noteId -> mảng gợi ý | 'loading' | 'none'
  function buildDetail(n) {
    const box = el('div', 'detail');
    const rl = remList(n).slice().sort((a, b) => a.due - b.due);
    if (rl.length) {
      const ul = el('ul', 'rem-list');
      rl.forEach(r => {
        const li = el('li', 'rem-row' + (r.done ? ' done' : r.due < Date.now() ? ' late' : ''));
        li.appendChild(el('span', 'rem-when', P.whenLabel(r.due)));
        li.appendChild(el('span', 'rem-title', remTitle(n, r)));
        li.appendChild(el('span', 'rem-st', r.done ? 'Đã xong' : remText(r)));
        if (!r.done && r.id && api.notes2 && api.notes2.doneItem) {
          const d = el('button', 'btn sm', 'Xong');
          d.type = 'button'; d.dataset.act = 'rdone'; d.dataset.rid = r.id;
          li.appendChild(d);
          if (api.notes2.snoozeItem) {
            const s = el('button', 'btn sm', 'Hoãn 10p');
            s.type = 'button'; s.dataset.act = 'rsnooze'; s.dataset.rid = r.id;
            li.appendChild(s);
          }
        }
        ul.appendChild(li);
      });
      box.appendChild(ul);
    } else box.appendChild(el('p', 'rem-none', 'Chưa có nhắc lịch.'));
    if (api.alarms && api.alarms.insight && api.alarms.applySuggestion) {
      const sg = suggs.get(n.id);
      if (Array.isArray(sg) && sg.length) {
        const w = el('div', 'sug-list');
        sg.forEach(s => {
          const b = el('button', 'btn sm sug', s.label || s.id);
          b.type = 'button'; b.dataset.act = 'apply'; b.dataset.sid = s.id;
          w.appendChild(b);
        });
        box.appendChild(w);
      } else if (sg === 'none') box.appendChild(el('p', 'rem-none', 'Tớ chưa có gợi ý nào cho note này.'));
      else {
        const b = el('button', 'btn sm', sg === 'loading' ? 'Đang xem…' : 'Gợi ý');
        b.type = 'button'; b.dataset.act = 'suggest'; if (sg === 'loading') b.disabled = true;
        box.appendChild(b);
      }
    }
    return box;
  }

  function buildCard(n) {
    const { title, excerpt } = splitText(n.text);
    const card = el('article', 'card ' + (n.visible ? 'is-shown' : 'is-hidden'));
    card.dataset.id = n.id;
    card.style.setProperty('--stripe', 'var(--c-' + (COLORS.includes(n.color) ? n.color : 'yellow') + ')');

    const body = el('button', 'card-body');
    body.type = 'button';
    body.dataset.act = 'open';
    const top = el('div', 'card-top');
    top.appendChild(el('span', 'card-title' + (title ? '' : ' untitled'), title || 'Note trống'));
    const ico = icon(n.visible ? 'pin' : 'box', 'state-ico');
    const tip = n.visible ? 'Đang hiện trên màn hình' : 'Đã cất vào danh sách (vẫn còn và vẫn nhắc lịch)';
    ico.insertAdjacentHTML('afterbegin', '<title>' + tip + '</title>');
    top.appendChild(ico);
    body.appendChild(top);
    if (excerpt) body.appendChild(el('p', 'excerpt', excerpt));

    const foot = el('div', 'card-foot');
    const rl = remList(n), open = openRems(n);
    if (rl.length) {
      const nx = open[0] || null;
      const st = nx ? remStatus(nx) : { done: true };
      const r = el('span', 'foot-remind' + (st.done ? ' done' : st.late ? ' late' : ''));
      r.appendChild(icon(st.done ? 'check' : 'clock'));
      r.appendChild(document.createTextNode(st.done ? 'Đã xong' : P.whenLabel(nx.due)));
      if (open.length > 1) r.appendChild(el('span', 'more', '+' + (open.length - 1)));
      r.title = rl.map(x => P.whenLabel(x.due) + ' · ' + remTitle(n, x) + ' · ' + remText(x)).join('\n');
      foot.appendChild(r);
    }
    foot.appendChild(el('span', 'foot-time', ago(n.updatedAt || n.createdAt || Date.now())));
    body.appendChild(foot);
    card.appendChild(body);

    const acts = el('div', 'actions');
    const toggle = el('button', 'act', n.visible ? 'Cất đi' : 'Hiện lên');
    toggle.type = 'button';
    toggle.dataset.act = n.visible ? 'hide' : 'show';
    toggle.title = n.visible ? 'Cất note vào danh sách. Note vẫn còn và vẫn nhắc lịch' : 'Hiện note lên màn hình';
    toggle.prepend(icon(n.visible ? 'box' : 'pin'));
    const del = el('button', 'act del', 'Xoá');
    del.type = 'button';
    del.dataset.act = 'ask';
    del.prepend(icon('trash'));
    const more = el('button', 'act', expanded.has(n.id) ? 'Thu gọn' : 'Chi tiết');
    more.type = 'button';
    more.dataset.act = 'expand';
    more.setAttribute('aria-expanded', String(expanded.has(n.id)));
    acts.append(more, toggle, del);
    card.appendChild(acts);
    if (expanded.has(n.id)) card.appendChild(buildDetail(n));

    if (confirmId === n.id) {
      card.classList.add('is-confirming');
      const c = el('div', 'confirm');
      c.setAttribute('role', 'alertdialog');
      c.setAttribute('aria-label', 'Xác nhận xoá');
      c.appendChild(el('span', 'confirm-q', hasTrash() ? 'Chuyển vào thùng rác?' : 'Xoá?'));
      const yes = el('button', 'btn sm danger', hasTrash() ? 'Bỏ vào thùng' : 'Xoá');
      yes.type = 'button'; yes.dataset.act = 'delete';
      const no = el('button', 'btn sm', 'Huỷ');
      no.type = 'button'; no.dataset.act = 'cancel';
      c.append(no, yes);
      card.appendChild(c);
    }
    return card;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function buildTrashCard(t) {
    const { title, excerpt } = splitText(t.text || t.title);
    const card = el('article', 'card trash-card');
    card.dataset.id = t.id;
    card.style.setProperty('--stripe', 'var(--c-' + (COLORS.includes(t.color) ? t.color : 'yellow') + ')');
    const body = el('div', 'card-body');
    const top = el('div', 'card-top');
    top.appendChild(el('span', 'card-title' + ((title || t.title) ? '' : ' untitled'), t.title || title || 'Note trống'));
    body.appendChild(top);
    if (excerpt) body.appendChild(el('p', 'excerpt', excerpt));
    const d = new Date(t.trashedAt || Date.now());
    const days = Math.max(0, Math.ceil(((t.expiresAt || 0) - Date.now()) / 864e5));
    const info = 'Xoá lúc ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) +
      (t.expiresAt ? ' · tự xoá hẳn sau ' + days + ' ngày' : '');
    const foot = el('div', 'card-foot');
    foot.appendChild(el('span', 'foot-time', info));
    body.appendChild(foot);
    card.appendChild(body);
    const acts = el('div', 'tr-actions');
    const rs = el('button', 'btn sm', 'Khôi phục'); rs.type = 'button'; rs.dataset.act = 'trestore';
    const confirming = trashConfirm === t.id;
    const pg = el('button', 'btn sm danger', confirming ? 'Chắc chắn xoá hẳn?' : 'Xoá hẳn');
    pg.type = 'button'; pg.dataset.act = 'tpurge';
    acts.append(rs, pg);
    card.appendChild(acts);
    return card;
  }
  function armTrashConfirm(v) {
    trashConfirm = v;
    clearTimeout(trashTimer);
    trashTimer = setTimeout(() => { trashConfirm = null; if (filter === 'trash') renderCards(); }, 3000);
  }
  function renderTrash() {
    const cards = $('cards'), empty = $('empty');
    const q = norm($('q').value).trim();
    const list = trash.filter(t => !q || norm(t.text || t.title).includes(q));
    cards.textContent = '';
    empty.textContent = '';
    if (trash.length) {
      const head = el('div', 'trash-head');
      head.appendChild(el('span', 'trash-note', trash.length + ' note trong thùng · tự xoá hẳn sau 30 ngày'));
      const all = el('button', 'btn sm danger', trashConfirm === 'all' ? 'Chắc chắn dọn sạch?' : 'Dọn sạch');
      all.title = 'Xoá hẳn mọi note trong thùng rác';
      all.type = 'button'; all.dataset.tact = 'empty';
      head.appendChild(all);
      cards.appendChild(head);
    }
    list.forEach(t => cards.appendChild(buildTrashCard(t)));
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.append(icon('trash'), el('h3', null, trash.length ? 'Không tìm thấy' : 'Thùng rác trống.'),
        el('p', null, trash.length ? 'Không có note nào khớp trong thùng rác.' : 'Note đã xoá nằm ở đây 30 ngày.'));
    }
  }

  function renderCards() {
    if (filter === 'trash') { renderTrash(); return; }
    const cards = $('cards'), empty = $('empty');
    const list = visibleNotes();
    const focusedId = document.activeElement && document.activeElement.closest && document.activeElement.closest('.card');
    const keep = focusedId ? { id: focusedId.dataset.id, act: document.activeElement.dataset.act } : null;
    cards.textContent = '';
    list.forEach(n => cards.appendChild(buildCard(n)));
    if (keep) {
      const c = cards.querySelector('.card[data-id="' + keep.id + '"]');
      const t = c && (c.querySelector('[data-act="' + keep.act + '"]') || c.querySelector('.card-body'));
      if (t) t.focus({ preventScroll: true });
    }

    empty.textContent = '';
    empty.hidden = list.length > 0;
    if (list.length) return;
    const q = $('q').value.trim();
    if (!notes.length) {
      empty.append(icon('note'), el('h3', null, 'Chưa có note nào'), el('p', null, 'Bấm dấu + để dán note đầu tiên. Tớ sẽ giúp cậu nhớ giờ.'));
      const b = el('button', 'btn primary', 'Tạo note mới');
      b.type = 'button'; b.dataset.act = 'new';
      empty.appendChild(b);
    } else if (q) {
      empty.append(icon('search'), el('h3', null, 'Không tìm thấy'), el('p', null, 'Không có note nào khớp với "' + q + '". Thử từ khoá khác nhé.'));
    } else {
      const msg = { remind: 'Chưa có note nào có nhắc lịch', shown: 'Chưa có note nào đang dán', hidden: 'Chưa có note nào đang cất' }[filter];
      empty.append(icon('note'), el('h3', null, msg));
    }
  }

  function renderSettings() {
    document.querySelectorAll('.row[data-key]').forEach(r => {
      r.setAttribute('aria-checked', String(!!settings[r.dataset.key]));
    });
  }

  function render() {
    renderChips();
    renderUpcoming();
    renderCards();
  }

  function setPanel(open) {
    panelOpen = open;
    const p = $('panel');
    p.classList.toggle('open', open);
    p.setAttribute('aria-hidden', String(!open));
    p.inert = !open;
    ['listView', 'alarmView', 'memoView'].forEach(id => { $(id).inert = open; });
    $('tabs').inert = open;
    $('btnSettings').setAttribute('aria-expanded', String(open));
    (open ? $('btnBack') : $('btnSettings')).focus({ preventScroll: true });
  }

  // ---------- tab, toast (dùng chung với alarms.js / memos.js / data.js) ----------
  const TABS = { note: 'listView', alarms: 'alarmView', memos: 'memoView' };
  const hooks = {};
  let curTab = 'note';
  function setTab(name, focus) {
    if (!TABS[name]) name = 'note';
    curTab = name;
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus({ preventScroll: true });
    });
    for (const [k, id] of Object.entries(TABS)) $(id).hidden = k !== name;
    if (hooks[name]) { try { hooks[name](); } catch (e) { /* bỏ qua */ } }
  }
  let toastTimer = 0;
  function toast(msg, bad, action) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    if (action) {
      const b = el('button', 'toast-act', action.label);
      b.type = 'button';
      b.addEventListener('click', () => { t.hidden = true; clearTimeout(toastTimer); action.run(); });
      t.append(' ', b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, action ? 5000 : 3200);
  }
  window.MochiList = { toast, el, setTab, setPanel, onTab: (n, fn) => { hooks[n] = fn; }, isPanelOpen: () => panelOpen, getTab: () => curTab };
  hooks.note = () => { render(); };
  $('tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  $('tabs').addEventListener('keydown', e => {
    const names = Object.keys(TABS), i = names.indexOf(curTab);
    if (e.key === 'ArrowRight') { e.preventDefault(); setTab(names[(i + 1) % names.length], true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setTab(names[(i + names.length - 1) % names.length], true); }
  });
  try {
    api.alarms.devHint().then(h => {
      const t = h && h.tab;
      if (t === 'alarms' || t === 'memos') setTab(t);
      else if (t === 'trash') { filter = 'trash'; render(); }
      else if (t === 'alarms-new') { setTab('alarms'); setTimeout(() => $('alAdd').click(), 300); }
      else if (t === 'memos-edit') { setTab('memos'); setTimeout(() => { const b = document.querySelector('.mm-row [data-act="edit"]'); if (b) b.click(); }, 800); }
      else if (t === 'restore') { setPanel(true); setTimeout(() => document.querySelector('[data-data="restore"]').click(), 300); }
      else if (t === 'shortcuts') { setPanel(true); setTimeout(() => { const g = document.querySelector('.keys'), pb = document.querySelector('.panel-body'); if (g && pb) pb.scrollTop = pb.scrollHeight; }, 300); }
      else if (t === 'data') { setPanel(true); const g = $('hData'), pb = document.querySelector('.panel-body'); if (g && pb) pb.scrollTop = g.offsetTop - 8; }
    }).catch(() => {});
  } catch (e) { /* chưa có handler */ }

  // ---------- events ----------
  $('btnNew').addEventListener('click', () => api.createNote({}));
  $('btnClose').addEventListener('click', () => api.closeWindow());
  $('btnSettings').addEventListener('click', () => setPanel(!panelOpen));
  $('btnBack').addEventListener('click', () => setPanel(false));
  $('btnShowAll').addEventListener('click', () => api.showAll());
  $('btnHideAll').addEventListener('click', () => api.hideAll());
  $('btnSummon').addEventListener('click', () => api.summonMascot());
  $('q').addEventListener('input', () => { confirmId = null; render(); });

  $('chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filter = c.dataset.f;
    confirmId = null; trashConfirm = null;
    render();
  });

  $('upRows').addEventListener('click', e => {
    const b = e.target.closest('.up-row');
    if (b) api.showNote(b.dataset.id);
  });

  $('empty').addEventListener('click', e => {
    if (e.target.closest('[data-act="new"]')) api.createNote({});
  });

  $('cards').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    const card = e.target.closest('.card');
    if (!btn || !card) return;
    const id = card.dataset.id;
    switch (btn.dataset.act) {
      case 'open':
      case 'show': api.showNote(id); break;
      case 'hide': api.hideNote(id); break;
      case 'ask': confirmId = id; renderCards(); {
        const y = document.querySelector('.card[data-id="' + id + '"] [data-act="cancel"]');
        if (y) y.focus();
      } break;
      case 'cancel': confirmId = null; renderCards(); break;
      case 'expand':
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        renderCards(); break;
      case 'rdone': guard(api.notes2.doneItem(id, btn.dataset.rid)); break;
      case 'rsnooze': guard(api.notes2.snoozeItem(id, btn.dataset.rid, 10), 'Hoãn 10 phút nha'); break;
      case 'suggest':
        suggs.set(id, 'loading'); renderCards();
        Promise.resolve(api.alarms.insight(id)).then(v => {
          const a = v && Array.isArray(v.suggestions) ? v.suggestions : [];
          suggs.set(id, a.length ? a : 'none'); renderCards();
        }).catch(() => { suggs.delete(id); renderCards(); toast('Chưa xem được gợi ý', true); });
        break;
      case 'apply':
        Promise.resolve(api.alarms.applySuggestion(id, btn.dataset.sid)).then(r => {
          toast((r && r.message) || (r && r.ok === false ? 'Chưa làm được' : 'Xong rồi nha'), !!(r && r.ok === false));
          suggs.delete(id); renderCards();
        }).catch(() => toast('Chưa làm được', true));
        break;
      case 'delete': {
        confirmId = null;
        const title = splitText((notes.find(n => n.id === id) || {}).text).title;
        Promise.resolve(api.deleteNote(id)).then(() => {
          if (hasTrash()) toast('Đã chuyển vào thùng rác', false, { label: 'Hoàn tác', run: () => guard(api.notes2.trashRestore(id), 'Đã khôi phục' + (title ? ' "' + title.slice(0, 30) + '"' : '')) });
        }).catch(() => toast('Chưa làm được', true));
        break;
      }
    }
  });

  $('cards').addEventListener('click', e => {
    if (filter !== 'trash') return;
    const btn = e.target.closest('[data-act],[data-tact]');
    if (!btn) return;
    if (btn.dataset.tact === 'empty') {
      if (trashConfirm !== 'all') { armTrashConfirm('all'); renderCards(); return; }
      trashConfirm = null;
      guard(api.notes2.trashEmpty(), 'Đã dọn sạch thùng rác').then(refreshTrash);
      return;
    }
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (btn.dataset.act === 'trestore') {
      guard(api.notes2.trashRestore(id), 'Đã khôi phục note').then(refreshTrash);
    } else if (btn.dataset.act === 'tpurge') {
      if (trashConfirm !== id) { armTrashConfirm(id); renderCards(); return; }
      trashConfirm = null;
      guard(api.notes2.trashPurge(id), 'Đã xoá hẳn').then(refreshTrash);
    }
  });

  function guard(p, okMsg) {
    return Promise.resolve(p).then(() => { if (okMsg) toast(okMsg); }).catch(() => toast('Chưa làm được', true));
  }

  // ---------- ghi nhanh ----------
  const qc = $('qcIn'), qcPrev = $('qcPrev');
  let qcTimer = 0, qcSeq = 0;
  function clearPrev() { qcPrev.hidden = true; qcPrev.textContent = ''; }
  function previewText(v) {
    const its = (v && v.items || []).filter(i => i && i.due);
    if (!its.length) return '';
    const parts = its.slice(0, 3).map(i => (i.time ? i.time + ' ' : '') + (i.title || ''));
    return 'Tớ hiểu: ' + its.length + ' việc · ' + parts.join(' · ') + (its.length > 3 ? '…' : '');
  }
  qc.addEventListener('input', () => {
    clearTimeout(qcTimer);
    const v = qc.value.trim();
    const seq = ++qcSeq;
    if (!v || !(api.alarms && api.alarms.insight)) { clearPrev(); return; }
    qcTimer = setTimeout(() => {
      Promise.resolve(api.alarms.insight(v)).then(r => {
        if (seq !== qcSeq) return;
        const t = previewText(r);
        qcPrev.textContent = t; qcPrev.hidden = !t;
      }).catch(() => { if (seq === qcSeq) clearPrev(); });
    }, 250);
  });
  qc.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); qc.value = ''; qcSeq++; clearTimeout(qcTimer); clearPrev(); return; }
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const text = qc.value.trim();
    if (!text) return;
    qc.value = ''; qcSeq++; clearTimeout(qcTimer); clearPrev();
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fallback = () => api.createNote({ html: text.split(/\r?\n/).map(l => '<div>' + esc(l) + '</div>').join('') });
    if (api.alarms && api.alarms.quickCapture) {
      Promise.resolve(api.alarms.quickCapture(text)).then(r => toast((r && r.reply) || 'Tớ ghi rồi nha'))
        .catch(() => { fallback(); toast('Tớ ghi rồi nha'); });
    } else { fallback(); toast('Tớ ghi rồi nha'); }
  });

  $('panel').addEventListener('click', e => {
    const row = e.target.closest('.row[data-key]');
    if (!row) return;
    const key = row.dataset.key;
    const val = !settings[key];
    settings[key] = val;
    renderSettings();
    api.setSettings({ [key]: val });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const sh = document.querySelector('#' + TABS[curTab] + ' .sheet.open');
    if (sh) { const b = sh.querySelector('.sheet-head .icon-btn'); if (b) b.click(); return; }
    if (confirmId) { confirmId = null; renderCards(); }
    else if (panelOpen) setPanel(false);
  });

  // ---------- sync ----------
  api.onNotesChanged(list => {
    notes = Array.isArray(list) ? list : [];
    if (confirmId && !notes.some(n => n.id === confirmId)) confirmId = null;
    render();
  });
  function setTrash(l) {
    trash = Array.isArray(l) ? l : [];
    if (filter === 'trash' && !hasTrash()) filter = 'all';
    render();
  }
  function refreshTrash() {
    if (!hasTrash()) return;
    Promise.resolve(api.notes2.trashList()).then(setTrash).catch(() => {});
  }
  try {
    if (hasTrash()) {
      if (typeof api.notes2.onTrashChanged === 'function') api.notes2.onTrashChanged(setTrash);
      refreshTrash();
    }
  } catch (e) { /* preload cũ */ }
  api.onSettingsChanged(s => { settings = s || {}; renderSettings(); });

  Promise.all([api.listNotes(), api.getSettings()]).then(([l, s]) => {
    notes = Array.isArray(l) ? l : [];
    settings = s || {};
    render();
    renderSettings();
  }).catch(() => render());

  try {
    if (api.notes2 && typeof api.notes2.onListTab === 'function') api.notes2.onListTab(t => window.MochiList.setTab(t));
  } catch (e) { /* preload cũ */ }

  setInterval(() => { if (curTab === 'note') render(); }, 30000);
})();
