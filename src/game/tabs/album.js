(function () {
  'use strict';
  var RANK = { common: 0, rare: 1, epic: 2, legend: 3 };
  var els = {}, room = null, view = null, openId = null, busy = false;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function albumOf(v) { return v && Array.isArray(v.album) ? v.album : []; }
  function has(id) { var it = view && view.items; var x = it && it[id]; return !!x && (typeof x === 'object' ? (x.count == null || x.count > 0) : x > 0); }
  function topRarity(set) {
    var best = 'common';
    (set.items || []).forEach(function (id) {
      var it = room.item(id); if (it && (RANK[it.rarity] || 0) > (RANK[best] || 0)) best = it.rarity;
    });
    return best;
  }
  function guard(p) { return p && p.then ? p.then(null, function (e) { room.toast('Chưa làm được, thử lại nha', 'warn'); if (window.console) console.error(e); }) : p; }

  function thumb(id, owned, cls) {
    var it = room.item(id), box = el('span', 'al-ico ' + (cls || '') + (owned ? ' is-own' : ' is-miss'));
    box.dataset.r = it ? it.rarity : 'common';
    if (it && it.icon) {
      var img = el('img'); img.alt = ''; img.draggable = false; img.src = room.iconUrl(it.icon); box.appendChild(img);
    }
    if (!owned) box.appendChild(el('b', 'al-q', '?'));
    box.title = owned && it ? it.name : (it ? 'Chưa có: ' + it.name : 'Chưa có');
    return box;
  }

  function claim(set) {
    if (busy) return; busy = true;
    var p = room.api.claimSet(set.setId);
    guard(p && p.then(function (res) {
      if (res && res.view) room.setView(res.view);
      if (res && res.ok) room.toast('Nhận ' + fmt(res.reward || set.reward) + ' xu từ bộ ' + set.name, 'coin');
      else if (res && res.reason === 'done') room.toast('Bộ này nhận rồi nha', 'warn');
      else if (res && res.reason === 'incomplete') room.toast('Bộ này còn thiếu món', 'warn');
      else room.toast('Chưa nhận được, thử lại nha', 'warn');
    })).then(function () { busy = false; }, function () { busy = false; });
  }

  function rewardBtn(set, small) {
    if (set.claimed) { var d = el('span', 'al-done', 'Đã nhận'); return d; }
    if (!set.complete) return null;
    var b = el('button', 'btn btn-primary al-claim' + (small ? ' al-claim-s' : ''), 'Nhận thưởng ' + fmt(set.reward) + ' xu');
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); claim(set); });
    return b;
  }

  function card(set) {
    var r = topRarity(set), total = set.total || (set.items || []).length || 0, owned = set.owned || 0;
    var c = el('div', 'card al-card' + (set.complete ? ' is-full' : '') + (set.claimed ? ' is-claimed' : ''));
    c.dataset.r = r; c.tabIndex = 0; c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Bộ ' + set.name + ', ' + owned + ' trên ' + total + ' món. Xem chi tiết');
    var head = el('div', 'al-head');
    head.appendChild(el('span', 'al-name', set.name));
    var tag = el('span', 'al-rar', room.rarityName(r)); tag.dataset.r = r; head.appendChild(tag);
    c.appendChild(head);
    var pr = el('div', 'al-prog');
    var bar = el('span', 'al-bar'), fill = el('i'); fill.style.width = (total ? Math.round(owned / total * 100) : 0) + '%';
    bar.appendChild(fill); pr.appendChild(bar); pr.appendChild(el('span', 'al-count', owned + '/' + total));
    c.appendChild(pr);
    var row = el('div', 'al-row');
    (set.items || []).forEach(function (id) { row.appendChild(thumb(id, has(id))); });
    c.appendChild(row);
    var foot = el('div', 'al-foot'), rb = rewardBtn(set);
    if (rb) foot.appendChild(rb);
    else foot.appendChild(el('span', 'al-reward', 'Thưởng ' + fmt(set.reward) + ' xu khi đủ bộ'));
    c.appendChild(foot);
    function open() { openId = set.setId; draw(); }
    c.addEventListener('click', open);
    c.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); open(); } });
    return c;
  }

  function wearTry(it) {
    var p = room.api.wear && room.api.wear(it.slot, it.id);
    guard(p && p.then(function (v) { if (v) room.setView(v.view || v); room.goto('wardrobe'); }));
  }

  function detail(set) {
    var wrap = el('div', 'al-detail');
    var top = el('div', 'al-dtop');
    var back = el('button', 'btn al-back', '‹ Album'); back.type = 'button';
    back.addEventListener('click', function () { openId = null; draw(); });
    top.appendChild(back);
    top.appendChild(el('h3', 'al-dname', set.name));
    var rb = rewardBtn(set, true); if (rb) top.appendChild(rb);
    wrap.appendChild(top);
    var total = set.total || (set.items || []).length || 0;
    var pr = el('div', 'al-prog al-prog-d');
    var bar = el('span', 'al-bar'), fill = el('i'); fill.style.width = (total ? Math.round((set.owned || 0) / total * 100) : 0) + '%';
    bar.appendChild(fill); pr.appendChild(bar); pr.appendChild(el('span', 'al-count', (set.owned || 0) + '/' + total + ' món · thưởng ' + fmt(set.reward) + ' xu'));
    wrap.appendChild(pr);
    var list = el('ul', 'al-list');
    (set.items || []).forEach(function (id) {
      var it = room.item(id), own = has(id), li = el('li', 'card al-li' + (own ? '' : ' is-miss'));
      li.appendChild(thumb(id, own, 'al-ico-l'));
      var mid = el('div', 'al-li-mid');
      mid.appendChild(el('div', 'al-li-name', it ? it.name : id));
      var meta = el('div', 'al-li-meta');
      meta.appendChild(el('span', '', it ? room.slotName(it.slot) : ''));
      var tg = el('span', 'al-rar', it ? room.rarityName(it.rarity) : ''); tg.dataset.r = it ? it.rarity : 'common'; meta.appendChild(tg);
      mid.appendChild(meta); li.appendChild(mid);
      if (own && it) {
        var b = el('button', 'btn al-try', 'Mặc thử'); b.type = 'button';
        b.addEventListener('click', function () { wearTry(it); });
        li.appendChild(b);
      } else li.appendChild(el('span', 'al-state', 'Chưa có'));
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function draw() {
    if (!els.root || !room) return;
    var al = albumOf(view), root = els.root;
    root.textContent = '';
    if (!al.length) {
      var e = el('div', 'card al-empty');
      e.appendChild(el('div', 'al-empty-t', 'Album chưa có gì'));
      e.appendChild(el('p', '', 'Mochi chưa mở album sưu tầm. Quay lại sau nha.'));
      root.appendChild(e); return;
    }
    var set = openId && al.filter(function (s) { return s.setId === openId; })[0];
    if (openId && !set) openId = null;
    if (set) { root.appendChild(detail(set)); return; }
    var own = 0, tot = 0, done = 0;
    al.forEach(function (s) { own += s.owned || 0; tot += s.total || (s.items || []).length || 0; if (s.complete) done++; });
    var sum = el('div', 'al-sum');
    var a = el('div', 'card al-tile'); a.appendChild(el('span', 'al-tile-lab', 'Đã sưu tầm'));
    var n1 = el('span', 'al-tile-num', own + '/' + tot); n1.appendChild(el('small', '', ' món')); a.appendChild(n1); sum.appendChild(a);
    var b = el('div', 'card al-tile'); b.appendChild(el('span', 'al-tile-lab', 'Bộ hoàn thành'));
    var n2 = el('span', 'al-tile-num', done + '/' + al.length); n2.appendChild(el('small', '', ' bộ')); b.appendChild(n2); sum.appendChild(b);
    root.appendChild(sum);
    var grid = el('div', 'al-grid');
    al.forEach(function (s) { grid.appendChild(card(s)); });
    root.appendChild(grid);
  }

  window.MochiRoom.registerTab('album', {
    label: 'Album',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="4" width="15" height="16" rx="2.2"/><path d="M8.5 4v16"/><path d="M13.6 9.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L10.7 11.3l2-.3z"/></svg>',
    mount: function (el0, r) { room = r; els.root = el0; el0.classList.add('al-root'); draw(); },
    update: function (v, r) { view = v; room = r; draw(); },
    show: function () { openId = null; draw(); }
  });
})();
