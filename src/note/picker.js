/* Mochi Notes — bộ chọn mẫu giấy (phòng paper). window không xuất gì; tự gắn vào nút menu data-act="paper". */
(function () {
  'use strict';
  var SHAPES = [
    { id: 'free', name: 'Tự do', w: 14, h: 10, dash: true },
    { id: 'square', name: 'Vuông', w: 12, h: 12 },
    { id: 'tall', name: 'Đứng', w: 9, h: 14 },
    { id: 'mini', name: 'Mini', w: 13, h: 9 }
  ];
  var panel, built = false, registered = false;
  var activeGroup = null, previewing = false, offChange = null;
  var thumbCache = Object.create(null);   // id -> phần tử ô thumb
  var gridBuilt = Object.create(null);    // groupId -> true
  var els = {};
  var lastPaperId = null;

  function $(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function P() { return window.MochiPaper; }
  function C() { return window.MochiPaperCtl; }
  function safe(fn) { try { return fn(); } catch (_) { return undefined; } }
  function state() { return safe(function () { return C().state(); }) || {}; }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.getElementById('pickerPanel');
    if (!panel) {
      panel = $('div', 'pop picker-panel');
      panel.id = 'pickerPanel';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Mẫu giấy');
      (document.querySelector('.note') || document.body).appendChild(panel);
    }
    panel.classList.add('pk');
    return panel;
  }

  function build() {
    if (built) return;
    built = true;
    panel.textContent = '';
    if (!P() || !C() || !safe(function () { return P().list().length; })) {
      panel.appendChild(headRow());
      panel.appendChild($('div', 'pk-empty', 'Chưa có mẫu giấy'));
      built = false; // thử lại lần mở sau
      return;
    }
    panel.appendChild(headRow());
    els.tabs = $('div', 'pk-tabs');
    els.tabs.setAttribute('role', 'tablist');
    els.tabs.setAttribute('aria-label', 'Nhóm mẫu giấy');
    panel.appendChild(els.tabs);
    els.grid = $('div', 'pk-grid');
    els.grid.setAttribute('role', 'listbox');
    els.grid.setAttribute('aria-label', 'Mẫu giấy');
    panel.appendChild(els.grid);
    panel.appendChild(options());
    buildTabs();
    bindGrid();
  }

  function headRow() {
    var h = $('div', 'pk-head');
    h.appendChild($('div', 'ptitle pk-title', 'Mẫu giấy'));
    var x = $('button', 'pk-x', '✕');
    x.type = 'button'; x.title = 'Đóng (Esc)'; x.setAttribute('aria-label', 'Đóng bộ chọn mẫu giấy');
    x.addEventListener('click', function () { close(); });
    h.appendChild(x);
    return h;
  }

  /* ---------- tab nhóm ---------- */
  var groups = [];
  function buildTabs() {
    groups = safe(function () { return P().groups(); }) || [];
    els.tabs.textContent = '';
    els.tabBtns = {};
    groups.forEach(function (g) {
      var b = $('button', 'pk-tab', g.name);
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.g = g.id;
      b.addEventListener('click', function () { selectGroup(g.id, true); });
      b.addEventListener('keydown', function (e) {
        var i = groups.findIndex(function (x) { return x.id === g.id; }), n = -1;
        if (e.key === 'ArrowRight') n = (i + 1) % groups.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + groups.length) % groups.length;
        if (n >= 0) { e.preventDefault(); selectGroup(groups[n].id, true); els.tabBtns[groups[n].id].focus(); }
      });
      els.tabBtns[g.id] = b;
      els.tabs.appendChild(b);
    });
  }

  function groupOf(paperId) {
    var d = paperId && safe(function () { return P().get(paperId); });
    return d ? d.group : null;
  }

  function selectGroup(gid, userClick) {
    if (!gid && groups[0]) gid = groups[0].id;
    activeGroup = gid;
    groups.forEach(function (g) {
      var on = g.id === gid, b = els.tabBtns[g.id];
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    fillGrid(gid);
    if (userClick) preview(null);
    var b = els.tabBtns[gid];
    if (b && b.scrollIntoView) safe(function () { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  }

  /* ---------- lưới ---------- */
  function makeCell(def) {
    var c = thumbCache[def.id];
    if (c) return c;
    c = $('button', 'pk-cell');
    c.type = 'button'; c.setAttribute('role', 'option'); c.dataset.id = def.id;
    c.setAttribute('aria-label', def.name);
    var th = $('span', 'pk-th');
    var t = safe(function () { return P().thumb(def.id, {}); });
    if (t && t.nodeType === 1) th.appendChild(t);
    else th.style.background = (def.bg && def.bg.color) || '#ddd';
    c.appendChild(th);
    c.appendChild($('span', 'pk-name', def.name));
    c.title = def.name;
    thumbCache[def.id] = c;
    return c;
  }

  function fillGrid(gid) {
    var list = (safe(function () { return P().list(); }) || []).filter(function (d) { return d.group === gid; });
    els.grid.textContent = '';
    list.forEach(function (d) { els.grid.appendChild(makeCell(d)); });
    gridBuilt[gid] = true;
    syncSelection();
  }

  function cells() { return Array.prototype.slice.call(els.grid.querySelectorAll('.pk-cell')); }

  function syncSelection() {
    if (!els.grid) return;
    var cur = state().paperId, cs = cells(), tabbable = null;
    cs.forEach(function (c) {
      var on = c.dataset.id === cur;
      c.setAttribute('aria-selected', String(on));
      c.classList.toggle('sel', on);
      if (on) tabbable = c;
    });
    if (!tabbable) tabbable = cs[0];
    cs.forEach(function (c) { c.tabIndex = c === tabbable ? 0 : -1; });
  }

  function bindGrid() {
    var g = els.grid;
    g.addEventListener('mouseover', function (e) {
      var c = e.target.closest('.pk-cell'); if (c) preview(c.dataset.id);
    });
    g.addEventListener('mouseleave', function () { preview(null); });
    g.addEventListener('focusin', function (e) {
      var c = e.target.closest('.pk-cell'); if (c) preview(c.dataset.id);
    });
    g.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !g.contains(e.relatedTarget)) preview(null);
    });
    g.addEventListener('click', function (e) {
      var c = e.target.closest('.pk-cell'); if (c) choosePaper(c.dataset.id);
    });
    g.addEventListener('keydown', function (e) {
      var cs = cells(), i = cs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = i, k = e.key;
      if (k === 'Enter' || k === ' ') { e.preventDefault(); choosePaper(cs[i].dataset.id); return; }
      var cols = columns(cs);
      if (k === 'ArrowRight') n = Math.min(cs.length - 1, i + 1);
      else if (k === 'ArrowLeft') n = Math.max(0, i - 1);
      else if (k === 'ArrowDown') n = i + cols <= cs.length - 1 ? i + cols : i;
      else if (k === 'ArrowUp') n = i - cols >= 0 ? i - cols : i;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = cs.length - 1;
      else return;
      e.preventDefault();
      if (n !== i) { cs[i].tabIndex = -1; cs[n].tabIndex = 0; cs[n].focus(); }
    });
  }
  function columns(cs) {
    if (!cs.length) return 1;
    var top = cs[0].offsetTop, n = 0;
    for (var i = 0; i < cs.length && cs[i].offsetTop === top; i++) n++;
    return Math.max(1, n);
  }

  function preview(id) {
    if (id == null) { if (!previewing) return; previewing = false; safe(function () { C().preview(null); }); return; }
    previewing = true;
    safe(function () { C().preview(id); });
  }
  function choosePaper(id) {
    previewing = false;
    var p = safe(function () { return C().choose({ paper: id }); });
    if (p && p.then) p.then(sync, sync); else sync();
  }

  /* ---------- tuỳ chọn ---------- */
  function sw(label, key) {
    var b = $('button', 'pk-sw');
    b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', 'false');
    b.appendChild($('span', 'pk-swt', label));
    var k = $('span', 'pk-knob'); k.setAttribute('aria-hidden', 'true');
    b.appendChild(k);
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-checked') !== 'true', patch = {};
      patch[key] = on;
      b.setAttribute('aria-checked', String(on));
      var p = safe(function () { return C().choose(patch); });
      if (p && p.then) p.then(sync, sync);
    });
    return b;
  }

  function options() {
    var o = $('div', 'pk-opts');
    o.appendChild($('div', 'pk-sec', 'Tuỳ chọn'));

    var f = $('label', 'pk-fld');
    f.appendChild($('span', 'pk-lbl', 'Phông'));
    var sel = $('select', 'pk-font');
    sel.setAttribute('aria-label', 'Phông chữ');
    var o0 = $('option', null, 'Theo mẫu'); o0.value = ''; sel.appendChild(o0);
    (safe(function () { return P().fonts(); }) || []).forEach(function (ft) {
      var op = $('option', null, ft.name); op.value = ft.id;
      if (ft.family) op.style.fontFamily = ft.family;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      var p = safe(function () { return C().choose({ font: sel.value || null }); });
      if (p && p.then) p.then(sync, sync);
    });
    f.appendChild(sel);
    els.font = sel;
    o.appendChild(f);

    var sh = $('div', 'pk-fld');
    sh.appendChild($('span', 'pk-lbl', 'Hình dạng'));
    var row = $('div', 'pk-shapes');
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Hình dạng note');
    els.shapes = {};
    SHAPES.forEach(function (s) {
      var b = $('button', 'pk-shape');
      b.type = 'button'; b.dataset.shape = s.id; b.title = s.name;
      b.setAttribute('aria-label', 'Hình dạng ' + s.name); b.setAttribute('aria-pressed', 'false');
      var ic = $('i', 'pk-ic' + (s.dash ? ' dash' : ''));
      ic.style.width = s.w + 'px'; ic.style.height = s.h + 'px';
      b.appendChild(ic);
      b.appendChild($('span', null, s.name));
      b.addEventListener('click', function () {
        var p = safe(function () { return C().setShape(s.id); });
        if (p && p.then) p.then(sync, sync);
        shapeMark(s.id);
      });
      els.shapes[s.id] = b;
      row.appendChild(b);
    });
    sh.appendChild(row);
    o.appendChild(sh);

    els.tilt = sw('Nghiêng nhẹ', 'tilt');
    els.deco = sw('Hiện trang trí', 'deco');
    o.appendChild(els.tilt);
    o.appendChild(els.deco);

    var d = $('button', 'btn pk-def', 'Dùng cho note mới');
    d.type = 'button';
    d.addEventListener('click', function () {
      var p = safe(function () { return C().setDefault(); });
      if (p && p.then) p.then(sync, sync); else sync();
    });
    o.appendChild(d);
    els.defNote = $('div', 'pk-defnote');
    o.appendChild(els.defNote);
    return o;
  }

  function shapeMark(id) {
    Object.keys(els.shapes).forEach(function (k) { els.shapes[k].setAttribute('aria-pressed', String(k === id)); });
  }

  /* ---------- đồng bộ ---------- */
  function sync() {
    if (!built) return;
    var s = state();
    syncSelection();
    if (els.font) els.font.value = (s.meta && s.meta.font) || '';
    var shape = s.meta && s.meta.shape || 'free';
    shapeMark(shape);
    els.tilt.setAttribute('aria-checked', String(!!s.tilt));
    els.deco.setAttribute('aria-checked', String(s.deco !== false));
    var dp = s.settings && s.settings.defaultPaper, dd = dp && safe(function () { return P().get(dp); });
    els.defNote.textContent = 'Note mới: ' + (dd ? dd.name : 'Theo màu note');
    lastPaperId = s.paperId;
  }

  /* ---------- mở / đóng ---------- */
  function open(trigger) {
    var N = window.MochiNote;
    ensurePanel();
    if (N && N.closePops) safe(function () { N.closePops(); });
    build();
    if (built) {
      var gid = groupOf(state().paperId) || (groups[0] && groups[0].id);
      selectGroup(gid, false);
      sync();
    }
    if (N && N.registerPop && !registered) { registered = true; safe(function () { N.registerPop(panel); }); }
    if (N && N.openPop) safe(function () { N.openPop(panel, trigger); });
    else panel.hidden = false;
    if (built) {
      var cs = cells(), sel = cs.filter(function (c) { return c.classList.contains('sel'); })[0] || cs[0];
      if (sel) {
        safe(function () { sel.focus({ preventScroll: true }); });
        safe(function () { sel.scrollIntoView({ block: 'nearest' }); });
      }
      /* focus lần đầu sẽ kích hoạt preview của mẫu hiện dùng: vô hại */
    }
  }
  function close() {
    var N = window.MochiNote;
    preview(null);
    if (N && N.closePops) safe(function () { N.closePops(); });
    else if (panel) panel.hidden = true;
    var b = document.getElementById('btnMenu');
    if (b) safe(function () { b.focus(); });
  }

  function onHiddenChange() {
    if (panel.hidden) { previewing = true; preview(null); }
  }

  function init() {
    ensurePanel();
    new MutationObserver(onHiddenChange).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    var menu = document.getElementById('menu');
    if (menu) menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="paper"]');
      if (!b) return;
      e.preventDefault();
      open(document.getElementById('btnMenu'));
    });
    if (C() && C().on) safe(function () { offChange = C().on('change', function () { sync(); }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
