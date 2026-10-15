/* Tab "Tủ đồ" — xem trước, mặc thử, lưới đồ, bộ đồ đã lưu. Script thường (IIFE). */
(function () {
  'use strict';

  var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 6.5V5.4a2 2 0 1 1 2 2"/><path d="M12 6.5 3.4 13.6a1.3 1.3 0 0 0 .8 2.3h15.6a1.3 1.3 0 0 0 .8-2.3L12 6.5z"/></svg>';
  var LOCK = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7"/></svg>';
  var TICK = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
  var MAX_OUTFITS = 6;

  var S = {
    room: null, root: null, el: {},
    filter: 'all',
    tryItem: null,      // { slot, id }
    previewKey: null,
    confirmDel: null,   // id bộ đồ đang chờ xác nhận xoá
    focusId: null,
    busy: false
  };

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, text, fn) {
    var b = h('button', cls, text);
    b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function catalog() { return S.room.catalog || {}; }
  function view() { return S.v || S.room.view || {}; }
  function items() { return catalog().items || []; }
  function slots() { return catalog().slots || []; }
  function owned(id) { var it = (view().items || {})[id]; return it ? (it.count || 0) : 0; }
  function worn() { return view().worn || {}; }
  function itemOf(id) { return S.room.item ? S.room.item(id) : items().filter(function (x) { return x.id === id; })[0]; }

  function apply(p) {
    if (p && typeof p.then === 'function') {
      S.busy = true;
      return p.then(function (v) {
        S.busy = false;
        var nv = v && v.view ? v.view : v;
        if (nv && nv.worn) S.room.setView(nv);
        if (v && v.ok === false && v.reason) S.room.toast(v.reason, 'warn');
        return v;
      }, function () { S.busy = false; S.room.toast('Có lỗi, thử lại nhé', 'warn'); });
    }
  }

  /* ---------- Xem trước ---------- */
  function previewWorn() {
    var w = {}, k, cur = worn();
    for (k in cur) if (cur[k]) w[k] = cur[k];
    if (S.tryItem) w[S.tryItem.slot] = S.tryItem.id;
    return w;
  }
  function renderPreview() {
    var w = previewWorn(), mode = view().mode || 'normal';
    var key = JSON.stringify([w, mode]);
    if (key === S.previewKey) return;
    S.previewKey = key;
    try {
      S.room.preview.render(S.el.stage, w, catalog(), { size: 220, mode: mode });
    } catch (e) { S.el.stage.appendChild(h('div', 'wd-empty', 'Không vẽ được xem trước')); }
  }
  function renderTryBar() {
    var t = S.tryItem, it = t && itemOf(t.id);
    S.el.stageBox.classList.toggle('wd-trying', !!t);
    S.el.tryTag.hidden = !t;
    S.el.tryName.textContent = it ? it.name : '';
    S.el.wearBtn.disabled = !t;
    S.el.unTryBtn.disabled = !t;
  }

  /* ---------- Hàng khe ---------- */
  function renderSlots() {
    var box = S.el.slotRow, w = worn();
    box.textContent = '';
    var any = false;
    slots().forEach(function (s) {
      var id = w[s.id], it = id && itemOf(id);
      var b = h('button', 'wd-slot' + (it ? ' wd-slot-on' : ''));
      b.type = 'button';
      if (it) {
        any = true;
        var im = h('img'); im.alt = ''; im.src = S.room.iconUrl(it.icon); im.draggable = false;
        b.appendChild(im);
        b.classList.add('wd-r-' + it.rarity);
        b.title = s.name + ': ' + it.name + ' (bấm để cởi)';
        b.setAttribute('aria-label', 'Cởi ' + it.name);
        b.addEventListener('click', function () { apply(S.room.api.wear(s.id, null)); });
      } else {
        b.disabled = true;
        b.title = s.name + ': trống';
        b.setAttribute('aria-label', s.name + ' trống');
        b.appendChild(h('span', 'wd-slot-ph', s.name.charAt(0)));
      }
      box.appendChild(b);
    });
    S.el.stripAll.disabled = !any;
  }

  /* ---------- Chip lọc ---------- */
  function renderChips() {
    var box = S.el.chips;
    box.textContent = '';
    var all = [{ id: 'all', name: 'Tất cả' }].concat(slots());
    all.forEach(function (s) {
      var b = h('button', 'chip wd-chip', s.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', S.filter === s.id ? 'true' : 'false');
      b.addEventListener('click', function () { S.filter = s.id; renderChips(); renderGrid(); });
      box.appendChild(b);
    });
  }

  /* ---------- Lưới ---------- */
  function visibleItems() {
    return items().filter(function (it) { return S.filter === 'all' || it.slot === S.filter; });
  }
  function renderCount() {
    var all = items(), n = all.filter(function (it) { return owned(it.id) > 0; }).length;
    S.el.count.textContent = 'Đã có ' + n + '/' + all.length;
  }
  function cell(it) {
    var n = owned(it.id), has = n > 0, isWorn = worn()[it.slot] === it.id;
    var isTry = S.tryItem && S.tryItem.id === it.id;
    var b = h('button', 'wd-item ' + (has ? 'wd-has' : 'wd-lock') + ' wd-r-' + it.rarity +
      (isWorn ? ' wd-worn' : '') + (isTry ? ' wd-tried' : ''));
    b.type = 'button';
    b.dataset.id = it.id;
    b.tabIndex = -1;
    var im = h('img'); im.alt = ''; im.draggable = false; im.src = S.room.iconUrl(it.icon);
    b.appendChild(im);
    var rname = S.room.rarityName(it.rarity);
    if (has) {
      b.appendChild(h('span', 'wd-rar', rname));
      if (n > 1) b.appendChild(h('span', 'wd-qty', '×' + n));
      if (isWorn) { var t = h('span', 'wd-tick'); t.innerHTML = TICK; b.appendChild(t); }
      b.title = it.name + ' · ' + rname + (isWorn ? ' · đang mặc' : '') + (it.desc ? '\n' + it.desc : '');
      b.setAttribute('aria-label', it.name + ', ' + rname + (isWorn ? ', đang mặc' : ''));
    } else {
      var l = h('span', 'wd-lockic'); l.innerHTML = LOCK; b.appendChild(l);
      b.title = 'Quay gacha hoặc đổi mảnh để có';
      b.setAttribute('aria-label', 'Chưa có ' + it.name + '. Quay gacha hoặc đổi mảnh để có');
    }
    b.addEventListener('click', function () { S.focusId = it.id; onItem(it); });
    b.addEventListener('focus', function () { S.focusId = it.id; setRoving(b); });
    return b;
  }
  function setRoving(b) {
    var all = S.el.grid.querySelectorAll('.wd-item');
    for (var i = 0; i < all.length; i++) all[i].tabIndex = all[i] === b ? 0 : -1;
  }
  function renderGrid() {
    var g = S.el.grid, list = visibleItems();
    var hadFocus = g.contains(document.activeElement);
    var top = g.scrollTop;
    g.textContent = '';
    list.forEach(function (it) { g.appendChild(cell(it)); });
    if (!list.length) g.appendChild(h('div', 'wd-empty', 'Chưa có món nào ở khe này'));
    g.scrollTop = top;
    var target = S.focusId && g.querySelector('[data-id="' + S.focusId + '"]') || g.querySelector('.wd-item');
    if (target) { setRoving(target); if (hadFocus) target.focus({ preventScroll: true }); }
  }
  function onItem(it) {
    if (owned(it.id) <= 0) { S.room.goto('gacha'); return; }
    if (worn()[it.slot] === it.id) {
      if (S.tryItem && S.tryItem.slot === it.slot) tryClear();
      return;
    }
    S.tryItem = { slot: it.slot, id: it.id };
    refreshTry();
  }
  function tryClear() { S.tryItem = null; refreshTry(); }
  function refreshTry() { renderPreview(); renderTryBar(); renderGrid(); }

  function gridKey(e) {
    var keys = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Home: 1, End: 1 };
    var cur = document.activeElement;
    if (!cur || !cur.classList || !cur.classList.contains('wd-item')) return;
    if (!keys[e.key]) return;
    var all = Array.prototype.slice.call(S.el.grid.querySelectorAll('.wd-item'));
    var i = all.indexOf(cur), j = i;
    var cols = 1, y0 = all[0] ? all[0].offsetTop : 0;
    while (cols < all.length && all[cols].offsetTop === y0) cols++;
    if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowRight') j = i + 1;
    else if (e.key === 'ArrowUp') j = i - cols;
    else if (e.key === 'ArrowDown') j = i + cols;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = all.length - 1;
    e.preventDefault();
    if (j < 0 || j >= all.length) return;
    all[j].focus();
  }

  /* ---------- Bộ đồ đã lưu ---------- */
  function wornCount(o) { var n = 0, k; for (k in (o.worn || {})) if (o.worn[k]) n++; return n; }
  function nextName(list) {
    for (var n = 1; n <= 99; n++) {
      var nm = 'Bộ ' + n;
      if (!list.some(function (o) { return o.name === nm; })) return nm;
    }
    return 'Bộ ' + (list.length + 1);
  }
  function renderOutfits() {
    var list = view().outfits || [], box = S.el.outList;
    var typing = document.activeElement === S.el.nameInput;
    S.el.outCount.textContent = list.length + '/' + MAX_OUTFITS;
    var full = list.length >= MAX_OUTFITS;
    S.el.saveBtn.disabled = full || !wornCount({ worn: worn() });
    S.el.nameInput.disabled = full;
    if (!typing && !S.nameDirty) S.el.nameInput.placeholder = full ? 'Đã đủ 6 bộ' : nextName(list);
    S.el.saveBtn.title = full ? 'Đã đủ 6 bộ, hãy xoá bớt' : (S.el.saveBtn.disabled ? 'Hãy mặc đồ trước khi lưu' : 'Lưu bộ đang mặc');
    box.textContent = '';
    if (!list.length) box.appendChild(h('div', 'wd-out-empty', 'Chưa có bộ nào. Mặc đồ rồi bấm Lưu bộ.'));
    list.forEach(function (o) {
      var row = h('div', 'wd-out');
      var nm = h('span', 'wd-out-name', o.name); nm.title = o.name;
      row.appendChild(nm);
      row.appendChild(h('span', 'wd-out-n', wornCount(o) + ' món'));
      if (S.confirmDel === o.id) {
        row.classList.add('wd-out-confirm');
        row.appendChild(h('span', 'wd-out-ask', 'Xoá bộ này?'));
        row.appendChild(btn('btn btn-ghost wd-sm wd-danger', 'Xoá', function () {
          S.confirmDel = null; apply(S.room.api.deleteOutfit(o.id));
        }));
        row.appendChild(btn('btn btn-ghost wd-sm', 'Giữ', function () { S.confirmDel = null; renderOutfits(); }));
      } else {
        row.appendChild(btn('btn wd-sm', 'Áp dụng', function () { tryClear(); apply(S.room.api.applyOutfit(o.id)); }));
        var del = btn('btn btn-ghost wd-sm wd-x', '', function () { S.confirmDel = o.id; renderOutfits(); });
        del.textContent = 'Xoá'; del.setAttribute('aria-label', 'Xoá ' + o.name);
        row.appendChild(del);
      }
      box.appendChild(row);
    });
  }
  function saveOutfit() {
    var list = view().outfits || [];
    var name = (S.el.nameInput.value || '').trim().slice(0, 16) || nextName(list);
    S.el.nameInput.value = ''; S.nameDirty = false;
    apply(S.room.api.saveOutfit(name));
  }

  /* ---------- Dựng khung ---------- */
  function build(el) {
    el.textContent = '';
    var root = h('div', 'wd-root'); S.root = root; el.appendChild(root);

    var left = h('div', 'wd-left');
    var stageBox = h('div', 'wd-stagebox'); S.el.stageBox = stageBox;
    var stage = h('div', 'wd-stage'); S.el.stage = stage;
    var tag = h('div', 'wd-trytag'); tag.hidden = true;
    tag.appendChild(h('b', null, 'Đang thử'));
    var tn = h('span', 'wd-tryname'); tag.appendChild(tn);
    S.el.tryTag = tag; S.el.tryName = tn;
    stageBox.appendChild(stage); stageBox.appendChild(tag);
    left.appendChild(stageBox);

    var acts = h('div', 'wd-acts');
    S.el.wearBtn = btn('btn btn-primary', 'Mặc', function () {
      var t = S.tryItem; if (!t) return;
      S.tryItem = null; renderTryBar();
      apply(S.room.api.wear(t.slot, t.id));
    });
    S.el.unTryBtn = btn('btn btn-ghost', 'Bỏ thử', tryClear);
    acts.appendChild(S.el.wearBtn); acts.appendChild(S.el.unTryBtn);
    left.appendChild(acts);

    var sl = h('div', 'wd-slots-wrap');
    sl.appendChild(h('div', 'wd-label', 'Đang mặc'));
    S.el.slotRow = h('div', 'wd-slots');
    sl.appendChild(S.el.slotRow);
    S.el.stripAll = btn('btn btn-ghost wd-sm wd-stripall', 'Cởi hết', function () {
      tryClear();
      var w = worn(), ids = Object.keys(w).filter(function (k) { return w[k]; });
      (function next(i) {
        if (i >= ids.length) return;
        var p = S.room.api.wear(ids[i], null);
        Promise.resolve(p).then(function (v) {
          if (v && v.worn) S.room.setView(v);
          next(i + 1);
        });
      })(0);
    });
    sl.appendChild(S.el.stripAll);
    left.appendChild(sl);

    var right = h('div', 'wd-right');
    var head = h('div', 'wd-head');
    S.el.chips = h('div', 'wd-chips');
    S.el.count = h('span', 'wd-count');
    head.appendChild(S.el.chips); head.appendChild(S.el.count);
    right.appendChild(head);

    var grid = h('div', 'wd-grid'); S.el.grid = grid;
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Danh sách đồ');
    grid.addEventListener('keydown', gridKey);
    right.appendChild(grid);

    var out = h('div', 'wd-outfits');
    var oh = h('div', 'wd-out-head');
    oh.appendChild(h('div', 'wd-label', 'Bộ đồ đã lưu'));
    S.el.outCount = h('span', 'wd-out-count'); oh.appendChild(S.el.outCount);
    var inp = h('input', 'wd-name'); inp.type = 'text'; inp.maxLength = 16;
    inp.setAttribute('aria-label', 'Tên bộ đồ');
    inp.addEventListener('input', function () { S.nameDirty = !!inp.value; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!S.el.saveBtn.disabled) saveOutfit(); } });
    S.el.nameInput = inp;
    S.el.saveBtn = btn('btn wd-sm', 'Lưu bộ', saveOutfit);
    oh.appendChild(inp); oh.appendChild(S.el.saveBtn);
    out.appendChild(oh);
    S.el.outList = h('div', 'wd-outlist'); out.appendChild(S.el.outList);
    right.appendChild(out);

    root.appendChild(left); root.appendChild(right);

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.classList &&
          document.activeElement.classList.contains('wd-item')) {
        e.preventDefault();
        var id = document.activeElement.dataset.id, it = id && itemOf(id);
        if (it) onItem(it);
      } else if (e.key === 'Escape' && S.tryItem) { tryClear(); }
    });
  }

  function render() {
    // bỏ thử nếu món đó đã được mặc (hoặc không còn sở hữu)
    if (S.tryItem && (worn()[S.tryItem.slot] === S.tryItem.id || owned(S.tryItem.id) <= 0)) S.tryItem = null;
    if (S.confirmDel && !(view().outfits || []).some(function (o) { return o.id === S.confirmDel; })) S.confirmDel = null;
    renderChips(); renderPreview(); renderTryBar(); renderSlots(); renderCount(); renderGrid(); renderOutfits();
  }

  window.MochiRoom.registerTab('wardrobe', {
    label: 'Tủ đồ',
    icon: ICON,
    mount: function (el, room) {
      S.room = room;
      build(el);
      renderChips();
      if (room.view && room.catalog) render();
    },
    update: function (v, room) {
      S.room = room || S.room; S.v = v;
      if (!S.root) return;
      if (!(S.room.catalog || {}).items) return;
      render();
    }
  });
})();
