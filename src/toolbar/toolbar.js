// Thanh công cụ chuột phải của bé Mochi. Dữ liệu menu do main gửi (toolbar:init); ở đây chỉ chọn icon/nhóm theo `key`.
(function () {
  'use strict';
  const T = window.mochi && window.mochi.toolbar;
  const $ = id => document.getElementById(id);
  const root = $('root'), bar = $('bar'), tray = $('tray'), tip = $('tip');
  const NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------- icon SVG tự vẽ (nét đậm #3a2a4d, tô pastel)
  const S = (body) => '<svg viewBox="0 0 32 32" fill="none" stroke="#3a2a4d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  const ICON = {
    note: S('<path d="M8 4h11l6 6v18H8z" fill="#fff6c9"/><path d="M19 4v6h6"/><path d="M16.5 15v8M12.5 19h8" stroke="#ff7fae" stroke-width="2.8"/>'),
    list: S('<path d="M7 4h18v24H7z" fill="#fff6c9"/><path d="M11 11h10M11 16h10M11 21h6" stroke="#8f7bd9"/><circle cx="24" cy="25" r="0.5"/>'),
    hanger: S('<path d="M16 12v-1.5a3 3 0 1 0-3-3" /><path d="M16 12 4.5 20.5c-1.6 1.2-.8 3.5 1.2 3.5h20.6c2 0 2.800-2.300 1.200-3.500z" fill="#c9e6ff"/>'),
    gacha: S('<circle cx="16" cy="12" r="8.5" fill="#d9f2ff"/><circle cx="12.5" cy="10" r="2.6" fill="#ffb3cf"/><circle cx="19" cy="13" r="2.4" fill="#ffe27a"/><path d="M7 20h18v8H7z" fill="#ffb3cf"/><circle cx="16" cy="24" r="2.400" fill="#fff"/>'),
    cake: S('<path d="M8 17h16l-2 11H10z" fill="#ffd9a8"/><path d="M6.500 17c-1.500-4 2-6 4-5.500 1-3.500 7-3.500 8 0 2.500-1 5.500 1.500 4.500 5.500z" fill="#ffc2db"/><circle cx="16" cy="7" r="2.200" fill="#ff6f9c"/><path d="M13 21v4M16 21v4M19 21v4" stroke-width="1.800"/>'),
    star: S('<path d="M16 3.500l3.800 7.800 8.500 1.200-6.200 6 1.500 8.500L16 22.900l-7.600 4.100 1.500-8.500-6.200-6 8.500-1.200z" fill="#ffe27a"/>'),
    stats: S('<path d="M5 27h22"/><path d="M7 27V17h5v10M13.500 27V8h5v19M20 27v-13h5v13" fill="#b9ecd0"/>'),
    game: S('<path d="M9 10h14c4 0 6 5 6 10 0 3-1.500 5-4 5-2.500 0-3.500-2-5-4h-8c-1.500 2-2.500 4-5 4-2.500 0-4-2-4-5 0-5 2-10 6-10z" fill="#d9ccff"/><path d="M10 15v5M7.500 17.500h5" stroke-width="2.200"/><circle cx="21" cy="15.500" r="1.300" fill="#3a2a4d"/><circle cx="24" cy="18.500" r="1.300" fill="#3a2a4d"/>'),
    tomato: S('<circle cx="16" cy="18" r="10" fill="#ff9a9a"/><path d="M16 8c-1-3-4-4-6-3 2 0 3 1 3.500 3-3-1.500-5 0-6 1.500 2-.5 4 0 5 1.500" fill="#9be3b5"/><path d="M16 8c1-3 4-4 6-3-2 0-3 1-3.500 3" fill="#9be3b5"/><path d="M12 17v2M20 17v2" stroke-width="2.600"/>'),
    chat: S('<path d="M5 8c0-2 1.500-3.500 3.500-3.500h15c2 0 3.500 1.500 3.500 3.500v11c0 2-1.500 3.500-3.500 3.500H15l-6 5v-5H8.500C6.500 22.500 5 21 5 19z" fill="#ffd9e8"/><circle cx="11" cy="13.500" r="1.400" fill="#3a2a4d"/><circle cx="16" cy="13.500" r="1.400" fill="#3a2a4d"/><circle cx="21" cy="13.500" r="1.400" fill="#3a2a4d"/>'),
    calendar: S('<rect x="5" y="7" width="22" height="20" rx="4" fill="#ffe9c4"/><path d="M5 13h22"/><path d="M11 4v5M21 4v5"/><path d="M11 19l3 3 6-6" stroke="#ff7fae" stroke-width="2.800"/>'),
    cloud: S('<path d="M9 24a6 6 0 0 1-.5-12 8 8 0 0 1 15-1.500A6.500 6.500 0 0 1 23.500 24z" fill="#d9f2ff"/><path d="M16 21v-7M12.500 17l3.500-3.500 3.500 3.500" stroke="#5aa9e6" stroke-width="2.800"/>'),
    bin: S('<path d="M7 9h18l-1.500 18h-15z" fill="#d6e4ff"/><path d="M5 9h22M12 9V6h8v3"/><path d="M13 14v9M19 14v9" stroke-width="1.900"/>'),
    gear: S('<circle cx="16" cy="16" r="9.500" stroke-width="5" stroke-dasharray="4.400 4.400"/><circle cx="16" cy="16" r="8" fill="#e1d6ff"/><circle cx="16" cy="16" r="3.200" fill="#fff"/>'),
    eye: S('<path d="M4.500 15c4 6 19 6 23 0" fill="#e9e0ff"/><path d="M8 20.500l-2 3M16 22.500v3.500M24 20.500l2 3" stroke-width="2.200"/><circle cx="22" cy="6.500" r="0.2"/><path d="M20 6h4M22 4v4" stroke="#ffb347" stroke-width="2"/>'),
    paw: S('<ellipse cx="16" cy="21" rx="6.500" ry="5.500" fill="#ffd0e2"/><circle cx="8.500" cy="14" r="2.800" fill="#ffd0e2"/><circle cx="14" cy="8.500" r="2.800" fill="#ffd0e2"/><circle cx="20" cy="8.500" r="2.800" fill="#ffd0e2"/><circle cx="25" cy="14" r="2.800" fill="#ffd0e2"/>'),
    spark: S('<path d="M16 4l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#ffe27a"/>'),
    check: S('<circle cx="16" cy="16" r="11" fill="#b9ecd0"/><path d="M10.500 16.500l4 4 7-8" stroke-width="3"/>'),
    folder: S('<path d="M4 9h8l3 3h13v14H4z" fill="#ffe9a8"/>'),
    clock: S('<circle cx="16" cy="16" r="11" fill="#fff6c9"/><path d="M16 9v7l5 3"/>'),
    stop: S('<circle cx="16" cy="16" r="11" fill="#ffc2c2"/><rect x="11.500" y="11.500" width="9" height="9" rx="2" fill="#fff"/>'),
    coin: S('<circle cx="16" cy="16" r="12" fill="#ffd45e"/><circle cx="16" cy="16" r="8" stroke-width="1.800"/><path d="M16 11v10M13 14.500c0-2.500 6-2.500 6 0s-6 2.500-6 5" stroke-width="2"/>')
  };
  // key (hoặc tiền tố key) -> icon cho ô trong khay
  const CELL_ICON = [['note.new', 'note'], ['note.paper', 'note'], ['note.list', 'list'], ['summary', 'calendar'], ['cmd', 'chat'], ['bin', 'bin'],
    ['focus.stop', 'stop'], ['focus', 'clock'], ['backup', 'cloud'], ['trick.', 'paw'], ['set.', 'gear'], ['hide', 'eye']];
  const cellIcon = key => { for (const [p, ic] of CELL_ICON) if (key && key.indexOf(p) === 0) return ICON[ic]; return ICON.spark; };

  // ---------------------------------------------------------------- nhóm nút trên thanh (đọc dữ liệu theo key)
  // k: key mục cấp 1 (mảng = thử lần lượt); tray: true nếu mục có submenu -> mở khay; settings: gom mục lẻ vào khay Cài đặt
  const GROUPS = [
    { k: 'note.new', name: 'Note mới', icon: 'note', c: '#ffd6e7' },
    { k: 'note.list', name: 'Danh sách note', icon: 'list', c: '#fff1b8' },
    { k: 'room.wardrobe', name: 'Tủ đồ', icon: 'hanger', c: '#cfe8ff' },
    { k: 'room.gacha', name: 'Máy gacha', icon: 'gacha', c: '#d9f2ff' },
    { k: 'room.shop', name: 'Cửa hàng', icon: 'cake', c: '#ffe0c2' },
    { k: 'room.quests', name: 'Nhiệm vụ', icon: 'star', c: '#fff1b8' },
    { k: 'room.stats', name: 'Thống kê', icon: 'stats', c: '#c9f2dc' },
    { sep: true },
    { k: 'tricks', name: 'Trò chơi', icon: 'game', c: '#e1d6ff' },
    { k: ['focus.stop', 'focus'], name: 'Mochi Focus', icon: 'tomato', c: '#ffc9c9' },
    { k: 'cmd', name: 'Ra lệnh', icon: 'chat', c: '#ffd6e7' },
    { k: 'summary', name: 'Tổng kết hôm nay', icon: 'calendar', c: '#ffe9c4' },
    { k: 'backup', name: 'Sao lưu', icon: 'cloud', c: '#d9f2ff' },
    { k: 'bin', name: 'Thùng rác', icon: 'bin', c: '#dbe6ff' },
    { sep: true },
    { settings: true, name: 'Cài đặt', icon: 'gear', c: '#e9defa' },
    { k: 'hide', name: 'Ẩn bé', icon: 'eye', c: '#e6e0f2' }
  ];

  let items = [], byId = new Map(), openBtn = null, dir = 'up', ox = 0;

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const txt = s => document.createTextNode(s);
  function index(list) { for (const it of list) { byId.set(it.id, it); if (it.submenu) index(it.submenu); } }
  const findKey = k => (Array.isArray(k) ? k : [k]).map(x => items.find(i => i.key === x)).find(Boolean);

  // ---------------------------------------------------------------- tooltip bong bóng
  const tipReadyAt = Date.now() + 700;          // các nút còn đang bay vào: chưa hiện tooltip (đặt sẽ lệch)
  function showTip(btn, text) {
    if (Date.now() < tipReadyAt) return;
    tip.textContent = text; tip.hidden = false;
    const r = btn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const up = dir === 'up';
    tip.className = 'tip ' + (up ? 'up' : 'dn');
    let x = r.left + r.width / 2;
    const hw = tip.offsetWidth / 2;
    x = Math.max(hw + 4, Math.min(rr.width - hw - 4, x));
    tip.style.left = x + 'px';
    tip.style[up ? 'bottom' : 'top'] = '';
    if (up) tip.style.top = Math.max(2, r.top - tip.offsetHeight - 9) + 'px'; else tip.style.top = (r.bottom + 9) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  function tipOn(node, text) {
    node.addEventListener('mouseenter', () => showTip(node, text));
    node.addEventListener('focus', () => showTip(node, text));
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('blur', hideTip);
  }

  // ---------------------------------------------------------------- hành động
  async function activate(it, node) {
    if (!it || !it.enabled || !T) return;
    node.classList.remove('pop'); void node.offsetWidth;
    const r = await T.click(it.id);
    if (!r || !r.ok) return;
    if (r.states) {
      for (const id in r.states) {
        const v = byId.get(id); if (v) v.checked = r.states[id];
        tray.querySelectorAll('[data-id="' + id + '"]').forEach(n => n.classList.toggle('on', !!r.states[id]));
      }
    }
    if (r.close) { bar.classList.add('out'); hideTip(); }
  }

  // ---------------------------------------------------------------- khay (popover lưới)
  function closeTray() {
    tray.hidden = true; tray.innerHTML = '';
    if (openBtn) { openBtn.classList.remove('open'); openBtn = null; }
  }
  function renderTray(list, extraNote) {
    tray.innerHTML = '';
    const cells = list.filter(i => i.type === 'normal' && !i.submenu);
    const toggles = list.filter(i => i.type === 'checkbox');
    const subs = list.filter(i => i.submenu);
    const addCells = (arr, host) => {
      const g = el('div', 'grid');
      arr.forEach((it, n) => {
        if (!it.enabled && !it.key) { g.appendChild(el('div', 'note')).textContent = it.label; return; }
        if (!it.enabled) { g.appendChild(el('div', 'note')).textContent = it.label; return; }
        const b = el('button', 'cell', cellIcon(it.key));
        b.type = 'button'; b.style.setProperty('--i', n);
        b.appendChild(el('span')).textContent = it.label.replace(/…$/, '');
        b.title = '';
        b.addEventListener('click', () => activate(it, b));
        g.appendChild(b);
      });
      host.appendChild(g);
    };
    if (cells.length) addCells(cells, tray);
    if (toggles.length) {
      if (cells.length) tray.appendChild(el('div', 'title')).textContent = '';
      const rows = el('div', 'rows');
      for (const it of toggles) {
        const b = el('button', 'row' + (it.checked ? ' on' : ''));
        b.type = 'button'; b.dataset.id = it.id;
        b.appendChild(el('span')).textContent = it.label.replace(/\s*\(.*\)\s*$/, '');
        b.appendChild(el('span', 'sw'));
        b.addEventListener('click', () => activate(it, b));
        rows.appendChild(b);
      }
      tray.appendChild(rows);
    }
    for (const s of subs) {
      tray.appendChild(el('div', 'title')).textContent = s.label;
      const radios = s.submenu.every(i => i.type === 'radio');
      if (radios) {
        const c = el('div', 'chips');
        for (const it of s.submenu) {
          const b = el('button', 'chip' + (it.checked ? ' on' : '')); b.type = 'button'; b.dataset.id = it.id; b.textContent = it.label;
          b.addEventListener('click', () => activate(it, b)); c.appendChild(b);
        }
        tray.appendChild(c);
      } else addCells(s.submenu, tray);
    }
    if (extraNote) tray.appendChild(el('div', 'note')).textContent = extraNote;
  }
  function toggleTray(btn, list) {
    hideTip();
    if (openBtn === btn) { closeTray(); return; }
    closeTray();
    openBtn = btn; btn.classList.add('open');
    renderTray(list);
    tray.hidden = false;
    // canh khay theo nút, kẹp trong cửa sổ; mũi tên không dùng — chỉ đặt gốc phóng to
    const rr = root.getBoundingClientRect(), r = btn.getBoundingClientRect(), tw = tray.offsetWidth;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(4, Math.min(rr.width - tw - 4, left));
    tray.style.alignSelf = 'flex-start'; tray.style.marginLeft = left + 'px';
    tray.style.setProperty('--tx', (r.left + r.width / 2 - left) + 'px');
    const first = tray.querySelector('button'); if (first && document.activeElement === btn) { /* giữ focus ở nút; ↑/↓ để vào khay */ }
  }

  // ---------------------------------------------------------------- dựng thanh
  function build(d) {
    items = d.items || []; dir = d.dir === 'down' ? 'down' : 'up'; ox = d.ox || 0;
    index(items);
    root.className = dir;
    bar.innerHTML = '';
    const head = items.find(i => i.key === 'head');
    const label = (head ? head.label : d.head) || 'Bé Mochi';
    const m = /(\d+)\s*xu\s*·\s*(.+)$/.exec(label);
    const badge = el('div', 'badge', ICON.coin);
    const tx = el('span');
    if (m) { tx.appendChild(el('b')).textContent = m[1] + ' xu'; tx.appendChild(el('small')).textContent = m[2]; }
    else tx.appendChild(el('b')).textContent = label.replace(/^\S*\s/, '');
    badge.appendChild(tx); bar.appendChild(badge);

    const placed = new Set(['head']);
    let n = 0;
    const settingsKeys = [];
    for (const g of GROUPS) {
      if (g.sep) { const s = el('div', 'sep'); bar.appendChild(s); continue; }
      let list = null, it = null;
      if (g.settings) { list = true; }
      else { it = findKey(g.k); if (!it) continue; placed.add(it.key); if (it.submenu) list = it.submenu; }
      const b = el('button', 'btn' + (list ? ' more' : ''), ICON[g.icon] || ICON.spark);
      b.type = 'button'; b.style.setProperty('--i', n++); b.style.setProperty('--c', g.c);
      b.dataset.gk = g.settings ? 'settings' : it.key;
      b.setAttribute('aria-label', g.name);
      if (!g.settings) { b.disabled = !it.enabled; b.addEventListener('click', () => (list ? toggleTray(b, list) : activate(it, b))); }
      else b.addEventListener('click', () => toggleTray(b, items.filter(i => !isMain(i))));
      tipOn(b, g.name);
      bar.appendChild(b);
    }
    // mục không nằm trong nhóm nào (cũng không phải mục chính) -> khay Cài đặt
    void settingsKeys;
    bar.style.setProperty('--ox', '50%');
    requestAnimationFrame(() => {
      const left = bar.offsetLeft;
      bar.style.setProperty('--ox', Math.max(0, ox - left) + 'px');
    });
    const first = bar.querySelector('.btn'); if (first) first.focus({ preventScroll: true });
  }
  // mục thuộc nhóm chính (đã có nút riêng) thì không vào khay Cài đặt
  function isMain(i) {
    return GROUPS.some(g => g.k && (Array.isArray(g.k) ? g.k : [g.k]).indexOf(i.key) >= 0) || i.key === 'head';
  }

  // ---------------------------------------------------------------- bàn phím + đóng
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    if (e.key === 'Escape') { e.preventDefault(); if (!tray.hidden) { const b = openBtn; closeTray(); if (b) b.focus(); } else if (T) T.close(); return; }
    const inBar = a && a.classList.contains('btn');
    const inTray = a && tray.contains(a);
    if (inBar && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const bs = Array.from(bar.querySelectorAll('.btn:not(:disabled)')), i = bs.indexOf(a);
      const nx = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; if (nx) nx.focus(); e.preventDefault();
    } else if (inBar && !tray.hidden && (e.key === (dir === 'up' ? 'ArrowUp' : 'ArrowDown'))) {
      const f = tray.querySelector('button'); if (f) f.focus(); e.preventDefault();
    } else if (inTray && /^Arrow/.test(e.key)) {
      const ts = Array.from(tray.querySelectorAll('button')), i = ts.indexOf(a);
      const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const back = e.key === (dir === 'up' ? 'ArrowDown' : 'ArrowUp');
      if (back && i <= 0 || (back && i < 0)) { if (openBtn) openBtn.focus(); }
      else { const nx = ts[Math.max(0, Math.min(ts.length - 1, i + (fwd ? 1 : -1)))]; if (nx) nx.focus(); }
      e.preventDefault();
    }
  });
  // bấm vào vùng trong suốt = bấm ra ngoài
  document.addEventListener('mousedown', e => {
    if (e.target === document.body || e.target === document.documentElement || e.target === root) { if (T) T.close(); }
  });
  window.addEventListener('contextmenu', e => { e.preventDefault(); if (T && (e.target === root || e.target === document.body)) T.close(); });

  if (T) T.onInit(build);
  window.__toolbarBuild = build;   // để xem thử bằng Chrome headless với dữ liệu giả
})();
