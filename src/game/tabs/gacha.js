(function () {
  'use strict';
  var RARS = ['common', 'rare', 'epic', 'legend'];
  var RANK = { common: 0, rare: 1, epic: 2, legend: 3 };
  var PITY = 30;
  var ANIM_MS = 1600;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtPct(x) {
    var p = (Number(x) || 0) * 100;
    return (p >= 10 ? p.toFixed(1) : p.toFixed(2)).replace('.', ',') + '%';
  }
  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function capsuleSvg(top, bot, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 40 52" aria-hidden="true">' +
      '<g class="gc-cap-top"><path d="M3 26V20C3 9 10 3 20 3s17 6 17 17v6z" fill="' + top + '" stroke="#5b6b73" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="13" cy="12" rx="4" ry="2.6" fill="#fff" opacity=".6"/></g>' +
      '<g class="gc-cap-bot"><path d="M3 26h34v6c0 11-7 17-17 17S3 43 3 32z" fill="' + bot + '" stroke="#5b6b73" stroke-width="1.6" stroke-linejoin="round"/></g></svg>';
  }
  var PASTELS = [['#ffb3c7', '#fff'], ['#ffe08a', '#fff'], ['#a8e0ff', '#fff'], ['#c9b6ff', '#fff'], ['#b6f0c8', '#fff'], ['#ffc9a3', '#fff']];

  function machineSvg() {
    var caps = [[44, 52, 0], [74, 44, 1], [104, 54, 2], [58, 78, 3], [92, 80, 4], [124, 76, 5], [40, 100, 2], [76, 106, 0], [112, 104, 1], [136, 98, 4], [60, 58, 5]];
    var s = '<svg class="gc-machine-svg" viewBox="0 0 180 250" aria-label="Máy gacha" role="img">' +
      '<defs><clipPath id="gcDome"><circle cx="90" cy="84" r="68"/></clipPath>' +
      '<linearGradient id="gcGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/></linearGradient></defs>' +
      '<ellipse cx="90" cy="242" rx="66" ry="6" fill="#000" opacity=".1"/>' +
      '<rect x="14" y="140" width="152" height="96" rx="18" fill="#9fe0cd" stroke="#4f7f74" stroke-width="3"/>' +
      '<rect x="22" y="148" width="136" height="14" rx="7" fill="#c9f2e5" opacity=".7"/>' +
      '<circle cx="90" cy="84" r="68" fill="#eef9ff" stroke="#4f7f74" stroke-width="3"/>' +
      '<g clip-path="url(#gcDome)">';
    caps.forEach(function (c) {
      var p = PASTELS[c[2] % PASTELS.length];
      s += '<g transform="translate(' + (c[0] - 11) + ' ' + (c[1] - 14) + ') scale(.55)"><g class="gc-cap-in" style="--d:' + (c[2] * 0.15) + 's">' +
        '<path d="M3 26V20C3 9 10 3 20 3s17 6 17 17v6z" fill="' + p[0] + '" stroke="#5b6b73" stroke-width="2.4"/><path d="M3 26h34v6c0 11-7 17-17 17S3 43 3 32z" fill="' + p[1] + '" stroke="#5b6b73" stroke-width="2.4"/></g></g>';
    });
    s += '</g><circle cx="90" cy="84" r="68" fill="url(#gcGlass)"/>' +
      '<path d="M44 52a56 56 0 0 1 22-18" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>' +
      '<rect x="62" y="136" width="56" height="12" rx="5" fill="#7fc9b4" stroke="#4f7f74" stroke-width="2.5"/>' +
      '<circle cx="52" cy="190" r="20" fill="#fff" stroke="#4f7f74" stroke-width="3"/>' +
      '<g class="gc-crank"><circle cx="52" cy="190" r="14" fill="#ffd6e1" stroke="#c98499" stroke-width="2"/><rect x="48" y="172" width="8" height="18" rx="4" fill="#ff9fb8" stroke="#c98499" stroke-width="2"/></g>' +
      '<circle cx="52" cy="190" r="4" fill="#c98499"/>' +
      '<rect x="92" y="172" width="60" height="50" rx="12" fill="#5d7f78" stroke="#4f7f74" stroke-width="3"/>' +
      '<rect x="98" y="180" width="48" height="10" rx="5" fill="#2f4a45"/>' +
      '<path d="M96 196h52v18a6 6 0 0 1-6 6H102a6 6 0 0 1-6-6z" fill="#2f4a45" opacity=".85"/>' +
      '</svg>';
    return s;
  }

  var st = { room: null, el: null, busy: false, skip: null, filter: 'all', ui: {} };

  function mount(el, room) {
    st.room = room; st.el = el;
    el.classList.add('gc-root');
    var left = h('div', 'gc-left');
    var stage = h('div', 'gc-stage');
    var mw = h('div', 'gc-machine');
    mw.innerHTML = machineSvg();
    var drop = h('div', 'gc-drop');
    mw.appendChild(drop);
    stage.appendChild(mw);
    left.appendChild(stage);

    var btns = h('div', 'gc-btns');
    var b1 = h('button', 'btn btn-primary gc-pull'); b1.type = 'button';
    var b10 = h('button', 'btn btn-primary gc-pull'); b10.type = 'button';
    [[b1, 'Quay 1 lượt · ', 'one'], [b10, 'Quay 10+1 · ', 'ten']].forEach(function (x) {
      x[0].appendChild(h('span', '', x[1]));
      var c = h('span', 'gc-cost'); x[0].appendChild(c);
      x[0].appendChild(h('i', 'coin'));
      x[0].addEventListener('click', function () { pull(x[2] === 'one' ? 1 : 10); });
    });
    btns.appendChild(b1); btns.appendChild(b10);
    left.appendChild(btns);

    var pity = h('div', 'gc-pity');
    var pt = h('div', 'gc-pity-text');
    var bar = h('div', 'gc-bar'); var fill = h('i'); bar.appendChild(fill);
    var shards = h('div', 'gc-shards');
    pity.appendChild(pt); pity.appendChild(bar); pity.appendChild(shards);
    left.appendChild(pity);

    var right = h('div', 'gc-right');
    var rates = h('div', 'card gc-box gc-rates');
    var exch = h('div', 'card gc-box gc-exch');
    var hist = h('div', 'card gc-box gc-hist');
    right.appendChild(rates); right.appendChild(exch); right.appendChild(hist);

    var overlay = h('div', 'gc-overlay'); overlay.hidden = true;
    el.appendChild(left); el.appendChild(right); el.appendChild(overlay);

    st.ui = { mw: mw, drop: drop, b1: b1, b10: b10, pt: pt, fill: fill, shards: shards, rates: rates, exch: exch, hist: hist, overlay: overlay, stage: stage };

    stage.addEventListener('click', function () { if (st.skip) st.skip(); });
    document.addEventListener('keydown', function (e) {
      if (st.skip && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { st.skip(); e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  function update(view, room) {
    st.room = room; if (!st.ui.mw) return;
    var u = st.ui, cost = view.cost || { one: 50, ten: 500 }, coins = (view.stats && view.stats.candy) || 0;
    [[u.b1, cost.one], [u.b10, cost.ten]].forEach(function (x) {
      x[0].querySelector('.gc-cost').textContent = x[1];
      var no = coins < x[1];
      x[0].classList.toggle('gc-dim', no);
      x[0].setAttribute('aria-disabled', no ? 'true' : 'false');
      x[0].title = no ? 'Chưa đủ xu' : '';
    });
    var left = view.pityLeft != null ? view.pityLeft : Math.max(0, PITY - (view.pity || 0));
    var done = Math.min(PITY, PITY - left);
    u.pt.textContent = 'Bảo hiểm: còn ' + left + ' lượt chắc chắn ra Siêu hiếm';
    u.fill.style.width = (done / PITY * 100) + '%';
    u.fill.parentNode.title = done + '/' + PITY;
    u.shards.textContent = (view.shards || 0) + ' mảnh';
    renderRates(view); renderExch(view); renderHist(view);
  }

  function renderRates(view) {
    var box = st.ui.rates, cat = st.room.catalog || { items: [] }, r = view.rates || { base: {}, effective: {} };
    box.textContent = '';
    box.appendChild(h('div', 'gc-title', 'Tỉ lệ'));
    var tb = h('div', 'gc-rt');
    var hd = h('div', 'gc-rt-row gc-rt-head');
    ['', 'Gốc', 'Có BH', 'Món'].forEach(function (t) { hd.appendChild(h('span', '', t)); });
    tb.appendChild(hd);
    RARS.forEach(function (id) {
      var n = (cat.items || []).filter(function (i) { return i.rarity === id; }).length;
      var row = h('div', 'gc-rt-row');
      var nm = h('span', 'gc-rt-name gc-r-' + id, st.room.rarityName(id));
      row.appendChild(nm);
      row.appendChild(h('span', '', fmtPct(r.base && r.base[id])));
      row.appendChild(h('span', '', fmtPct(r.effective && r.effective[id])));
      row.appendChild(h('span', '', String(n)));
      tb.appendChild(row);
    });
    box.appendChild(tb);
    box.appendChild(h('p', 'gc-note', 'Có BH: tỉ lệ thực tế khi tính cả bảo hiểm. Lượt thứ 30 liên tiếp chưa ra Siêu hiếm trở lên chắc chắn ra Siêu hiếm hoặc Huyền thoại. Món trùng đổi thành mảnh.'));
  }

  function renderExch(view) {
    var box = st.ui.exch, room = st.room, cat = room.catalog || { items: [] };
    box.textContent = '';
    box.appendChild(h('div', 'gc-title', 'Đổi mảnh'));
    var chips = h('div', 'gc-chips');
    [['all', 'Tất cả']].concat(RARS.map(function (r) { return [r, room.rarityName(r)]; })).forEach(function (p) {
      var c = h('button', 'chip gc-chip' + (st.filter === p[0] ? ' on active' : ''), p[1]); c.type = 'button';
      c.setAttribute('aria-pressed', st.filter === p[0] ? 'true' : 'false');
      c.addEventListener('click', function () { st.filter = p[0]; renderExch(room.view || view); });
      chips.appendChild(c);
    });
    box.appendChild(chips);
    var owned = view.items || {}, price = view.shardPrice || {}, shards = view.shards || 0;
    var list = (cat.items || []).filter(function (i) {
      return !(owned[i.id] && owned[i.id].count > 0) && (st.filter === 'all' || i.rarity === st.filter);
    }).sort(function (a, b) { return RANK[a.rarity] - RANK[b.rarity]; });
    var ul = h('div', 'gc-ex-list');
    if (!list.length) ul.appendChild(h('div', 'gc-empty', 'Không còn món nào chưa có.'));
    list.forEach(function (i) {
      var p = price[i.rarity] || 0, can = shards >= p;
      var row = h('div', 'gc-ex-row');
      var im = h('img', 'gc-ico gc-b-' + i.rarity); im.src = room.iconUrl(i.icon); im.alt = ''; im.loading = 'lazy';
      var nm = h('span', 'gc-ex-name', i.name); nm.title = i.name;
      var b = h('button', 'btn gc-ex-btn' + (can ? '' : ' gc-dim'), 'Đổi ' + p); b.type = 'button';
      b.title = can ? 'Đổi ' + p + ' mảnh' : 'Chưa đủ mảnh';
      b.setAttribute('aria-disabled', can ? 'false' : 'true');
      b.addEventListener('click', function () {
        if (!can) { room.toast('Chưa đủ mảnh', 'warn'); return; }
        room.api.exchange(i.id).then(function (res) {
          if (!res.ok) room.toast(res.reason || 'Không đổi được', 'warn');
          else room.toast('Đã đổi: ' + i.name, 'ok');
          if (res.view) room.setView(res.view);
        });
      });
      row.appendChild(im); row.appendChild(nm); row.appendChild(b);
      ul.appendChild(row);
    });
    box.appendChild(ul);
  }

  function renderHist(view) {
    var box = st.ui.hist, room = st.room;
    box.textContent = '';
    box.appendChild(h('div', 'gc-title', 'Lịch sử 10 lượt gần nhất'));
    var hs = (view.history || []).slice();
    if (hs.length && hs[0].at != null) hs.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    else hs.reverse();
    hs = hs.slice(0, 10);
    var row = h('div', 'gc-hist-row');
    if (!hs.length) row.appendChild(h('div', 'gc-empty', 'Chưa quay lượt nào.'));
    hs.forEach(function (x) {
      var it = room.item(x.itemId); if (!it) return;
      var im = h('img', 'gc-ico gc-b-' + x.rarity); im.src = room.iconUrl(it.icon); im.alt = it.name;
      im.title = it.name + ' (' + room.rarityName(x.rarity) + ')' + (x.dup ? ' - trùng' : '');
      row.appendChild(im);
    });
    box.appendChild(row);
  }

  /* ---------- quay ---------- */
  function pull(n) {
    if (st.busy) return;
    var room = st.room, view = room.view || {}, cost = (view.cost || { one: 50, ten: 500 })[n === 1 ? 'one' : 'ten'];
    if (((view.stats && view.stats.candy) || 0) < cost) { room.toast('Chưa đủ xu', 'warn'); return; }
    st.busy = true;
    st.ui.el = null;
    var t0 = Date.now();
    room.api.pull(n).then(function (res) {
      if (res && res.view) room.setView(res.view);
      if (!res || !res.ok || !res.results || !res.results.length) {
        st.busy = false;
        room.toast((res && res.reason) || 'Không quay được', 'warn');
        return;
      }
      var top = res.results.reduce(function (a, b) { return RANK[b.rarity] > RANK[a.rarity] ? b : a; });
      playAnim(top.rarity, function () { showResult(res, n); });
    }, function () { st.busy = false; room.toast('Không quay được', 'warn'); });
  }

  function playAnim(rarity, done) {
    var u = st.ui, finished = false, timer;
    function end() {
      if (finished) return; finished = true; clearTimeout(timer);
      st.skip = null;
      u.mw.classList.remove('gc-spin');
      u.drop.className = 'gc-drop'; u.drop.textContent = '';
      done();
    }
    st.skip = end;
    if (reduced()) { timer = setTimeout(end, 250); return; }
    var col = 'var(--r-' + rarity + ')';
    u.drop.innerHTML = capsuleSvg(col, '#fff', 'gc-drop-svg');
    u.mw.classList.add('gc-spin');
    u.drop.className = 'gc-drop gc-drop-go';
    timer = setTimeout(end, ANIM_MS);
  }

  function showResult(res, n) {
    var room = st.room, ov = st.ui.overlay;
    ov.textContent = ''; ov.hidden = false;
    var wrap = h('div', 'gc-res');
    var results = res.results, top = results.reduce(function (a, b) { return RANK[b.rarity] > RANK[a.rarity] ? b : a; });
    var firstNew = null;
    if (results.length === 1) {
      var r = results[0], it = room.item(r.itemId) || { name: r.itemId, icon: '' };
      if (!r.dup) firstNew = r;
      var big = h('div', 'gc-one gc-fx-' + r.rarity);
      if (RANK[r.rarity] >= 2) {
        big.appendChild(h('div', 'gc-rays'));
        for (var k = 0; k < 8; k++) { var sp = h('i', 'gc-spark'); sp.style.setProperty('--a', (k * 45) + 'deg'); sp.style.setProperty('--dl', (k * 0.18) + 's'); big.appendChild(sp); }
      }
      var cap = h('div', 'gc-open'); cap.innerHTML = capsuleSvg('var(--r-' + r.rarity + ')', '#fff', 'gc-open-svg');
      big.appendChild(cap);
      var im = h('img', 'gc-one-ico gc-b-' + r.rarity); im.src = room.iconUrl(it.icon); im.alt = it.name;
      big.appendChild(im);
      wrap.appendChild(big);
      wrap.appendChild(h('div', 'gc-one-name', it.name));
      wrap.appendChild(h('span', 'gc-tag gc-t-' + r.rarity, room.rarityName(r.rarity)));
      wrap.appendChild(h('div', r.dup ? 'gc-dup' : 'gc-new', r.dup ? 'Trùng → +' + r.shards + ' mảnh' : 'Món mới!'));
    } else {
      var grid = h('div', 'gc-grid');
      var shardSum = 0, newN = 0;
      results.forEach(function (r, i) {
        var it = room.item(r.itemId) || { name: r.itemId, icon: '' };
        if (!r.dup) { newN++; if (!firstNew) firstNew = r; } else shardSum += r.shards || 0;
        var card = h('div', 'gc-card gc-fx-' + r.rarity + (RANK[r.rarity] >= 2 ? ' gc-hot' : ''));
        card.style.setProperty('--i', i);
        card.title = it.name + ' (' + room.rarityName(r.rarity) + ')';
        var inner = h('div', 'gc-card-in');
        var back = h('div', 'gc-face gc-back'); back.innerHTML = capsuleSvg('#ffd0dc', '#fff', 'gc-mini');
        var front = h('div', 'gc-face gc-front gc-bd-' + r.rarity);
        var im = h('img'); im.src = room.iconUrl(it.icon); im.alt = it.name;
        front.appendChild(im);
        front.appendChild(h('span', 'gc-card-r gc-t-' + r.rarity, room.rarityName(r.rarity)));
        front.appendChild(h('span', 'gc-card-s' + (r.dup ? ' dup' : ' new'), r.dup ? '+' + r.shards + ' mảnh' : 'Mới!'));
        inner.appendChild(back); inner.appendChild(front); card.appendChild(inner);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      wrap.appendChild(h('div', 'gc-sum', newN + ' món mới, +' + shardSum + ' mảnh'));
    }
    if (res.line) {
      var bub = h('div', 'gc-bubble', res.line);
      wrap.appendChild(bub);
    }
    var acts = h('div', 'gc-acts');
    if (firstNew) {
      var w = h('button', 'btn gc-wear', 'Mặc thử ngay'); w.type = 'button';
      w.addEventListener('click', function () {
        var it = room.item(firstNew.itemId);
        if (!it) return;
        room.api.wear(it.slot, it.id).then(function (v) {
          if (v && v.ok === false) { room.toast(v.reason || 'Không mặc được', 'warn'); return; }
          room.setView((v && v.view) || v);
          close(); room.goto('wardrobe');
        });
      });
      acts.appendChild(w);
    }
    var c = h('button', 'btn btn-primary gc-cont', 'Tiếp tục'); c.type = 'button';
    c.addEventListener('click', close);
    acts.appendChild(c);
    wrap.appendChild(acts);
    ov.appendChild(wrap);
    c.focus();
    st.closeKey = function (e) { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    document.addEventListener('keydown', st.closeKey, true);
  }

  function close() {
    var ov = st.ui.overlay;
    ov.hidden = true; ov.textContent = '';
    document.removeEventListener('keydown', st.closeKey, true);
    st.busy = false;
  }

  var api = window.MochiRoom;
  api.registerTab('gacha', {
    label: 'Máy gacha',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5.5"/><path d="M5 14h14v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><circle cx="9.5" cy="17.5" r="1.4"/><path d="M14 18h3"/><path d="M9.5 6.5l1.5 1.5"/></svg>',
    mount: mount,
    update: update
  });
})();
