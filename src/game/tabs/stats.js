(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var DOW = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  var SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var MILESTONES = [3, 7, 30];
  var els = {}, view = null, mode = 'd7';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function startOfWeek(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function fmt(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function logMap(v) {
    var m = {};
    (v && v.log || []).forEach(function (r) {
      if (!r || !r.day) return;
      var o = m[r.day] || (m[r.day] = { done: 0, coins: 0 });
      o.done += +r.done || 0; o.coins += +r.coins || 0;
    });
    return m;
  }
  function get(m, d) { return m[key(d)] || { done: 0, coins: 0 }; }
  function sumRange(m, from, n) {
    var t = { done: 0, coins: 0 };
    for (var i = 0; i < n; i++) { var r = get(m, addDays(from, i)); t.done += r.done; t.coins += r.coins; }
    return t;
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    if (v <= 20) return Math.ceil(v / 4) * 4;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), u = [1, 2, 4, 8, 10];
    for (var i = 0; i < u.length; i++) if (v <= u[i] * p) return Math.max(u[i] * p, 20);
    return 10 * p;
  }

  function build(el0) {
    el0.classList.add('st-root');
    var tiles = el('div', 'st-tiles');
    ['today', 'week', 'streak', 'coins'].forEach(function (k) {
      var t = el('div', 'card st-tile');
      els[k] = { lab: el('div', 'st-tile-lab'), num: el('div', 'st-tile-num'), sub: el('div', 'st-tile-sub') };
      t.appendChild(els[k].lab); t.appendChild(els[k].num); t.appendChild(els[k].sub);
      tiles.appendChild(t);
    });
    els.today.lab.textContent = 'Hôm nay';
    els.week.lab.textContent = 'Tuần này';
    els.streak.lab.textContent = 'Chuỗi ngày';
    els.coins.lab.textContent = 'Xu tuần này';
    el0.appendChild(tiles);

    var chartCard = el('div', 'card st-card');
    var head = el('div', 'st-head');
    head.appendChild(el('h3', 'st-title', 'Việc đã xong'));
    var chips = el('div', 'st-chips');
    chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Khoảng thời gian');
    els.chips = {};
    [['d7', '7 ngày'], ['w4', '4 tuần']].forEach(function (p) {
      var b = el('button', 'chip st-chip', p[1]);
      b.type = 'button';
      b.addEventListener('click', function () { mode = p[0]; draw(); });
      els.chips[p[0]] = b; chips.appendChild(b);
    });
    head.appendChild(chips);
    chartCard.appendChild(head);
    els.wrap = el('div', 'st-chart');
    els.tip = el('div', 'st-tip'); els.tip.hidden = true;
    els.empty = el('div', 'st-empty', 'Xong việc đầu tiên để Mochi ghi sổ nhé');
    els.empty.hidden = true;
    chartCard.appendChild(els.wrap);
    chartCard.appendChild(els.empty);
    el0.appendChild(chartCard);

    var heatCard = el('div', 'card st-card');
    var hh = el('div', 'st-head');
    hh.appendChild(el('h3', 'st-title', '5 tuần gần đây'));
    var legend = el('div', 'st-legend');
    legend.appendChild(el('span', 'st-legend-t', 'ít'));
    for (var i = 0; i < 5; i++) legend.appendChild(el('i', 'st-cell st-l' + i));
    legend.appendChild(el('span', 'st-legend-t', 'nhiều'));
    hh.appendChild(legend);
    heatCard.appendChild(hh);
    els.heat = el('div', 'st-heat');
    heatCard.appendChild(els.heat);
    el0.appendChild(heatCard);

    els.foot = el('div', 'st-foot');
    el0.appendChild(els.foot);
  }

  function showTip(x, y, text) {
    var t = els.tip;
    t.textContent = text; t.hidden = false;
    var w = els.wrap.clientWidth, tw = t.offsetWidth;
    t.style.left = Math.max(0, Math.min(w - tw, x - tw / 2)) + 'px';
    t.style.top = Math.max(0, y - t.offsetHeight - 8) + 'px';
  }
  function hideTip() { els.tip.hidden = true; }

  function tipText(name, r) { return name + ': ' + r.done + ' việc · ' + fmt(r.coins) + ' xu'; }

  function drawChart(m, t0) {
    var data = [], i, d;
    if (mode === 'd7') {
      for (i = 6; i >= 0; i--) {
        d = addDays(t0, -i);
        var r = get(m, d);
        data.push({ label: SHORT[d.getDay()], name: DOW[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1), done: r.done, coins: r.coins, now: i === 0 });
      }
    } else {
      var ws = startOfWeek(t0);
      for (i = 3; i >= 0; i--) {
        var s = addDays(ws, -7 * i), e = addDays(s, 6), tot = sumRange(m, s, 7);
        data.push({ label: s.getDate() + '/' + (s.getMonth() + 1), name: 'Tuần ' + s.getDate() + '/' + (s.getMonth() + 1) + ' - ' + e.getDate() + '/' + (e.getMonth() + 1), done: tot.done, coins: tot.coins, now: i === 0 });
      }
    }
    els.wrap.textContent = '';
    els.wrap.appendChild(els.tip);
    var W = 600, H = 210, L = 34, R = 8, T = 12, B = 26;
    var max = niceMax(Math.max.apply(null, data.map(function (x) { return x.done; })));
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'st-svg', role: 'img', 'aria-label': 'Biểu đồ cột số việc đã xong' });
    var ph = H - T - B, pw = W - L - R;
    for (i = 0; i <= 4; i++) {
      var v = max * i / 4, y = T + ph - ph * i / 4;
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: i === 0 ? 'st-axis' : 'st-grid' }));
      var tx = svg('text', { x: L - 6, y: y + 4, class: 'st-ytick', 'text-anchor': 'end' });
      tx.textContent = String(Math.round(v)); s.appendChild(tx);
    }
    var slot = pw / data.length, bw = Math.min(40, slot * 0.55);
    data.forEach(function (it, k) {
      var cx = L + slot * k + slot / 2, h = ph * it.done / max, x = cx - bw / 2, y = T + ph - h;
      var g = svg('g', { class: 'st-bargrp' });
      g.appendChild(svg('rect', { x: L + slot * k, y: T, width: slot, height: ph + B, fill: 'transparent', class: 'st-hit' }));
      if (it.done > 0) {
        var rr = Math.min(4, h, bw / 2);
        g.appendChild(svg('path', { d: 'M' + x + ' ' + (T + ph) + 'V' + (y + rr) + 'Q' + x + ' ' + y + ' ' + (x + rr) + ' ' + y + 'H' + (x + bw - rr) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + rr) + 'V' + (T + ph) + 'Z', class: 'st-bar' + (it.now ? ' st-bar-now' : '') }));
      } else {
        g.appendChild(svg('rect', { x: x, y: T + ph - 2, width: bw, height: 2, rx: 1, class: 'st-bar-zero' }));
      }
      var lb = svg('text', { x: cx, y: H - 8, class: 'st-xlab' + (it.now ? ' st-xlab-now' : ''), 'text-anchor': 'middle' });
      lb.textContent = it.label; g.appendChild(lb);
      g.addEventListener('mousemove', function (ev) {
        var br = els.wrap.getBoundingClientRect();
        showTip(ev.clientX - br.left, Math.max(ev.clientY - br.top, 30), tipText(it.name, it));
        g.classList.add('st-hot');
      });
      g.addEventListener('mouseleave', function () { hideTip(); g.classList.remove('st-hot'); });
      s.appendChild(g);
    });
    els.wrap.appendChild(s);
  }

  function level(done) {
    if (done <= 0) return 0;
    if (done >= 8) return 4;
    if (done >= 5) return 3;
    if (done >= 3) return 2;
    return 1;
  }

  function drawHeat(m, t0) {
    els.heat.textContent = '';
    var ws = addDays(startOfWeek(t0), -28), dn = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    var rows = el('div', 'st-heat-rows');
    dn.forEach(function (n) { rows.appendChild(el('span', 'st-heat-day', n)); });
    els.heat.appendChild(rows);
    for (var w = 0; w < 5; w++) {
      var col = el('div', 'st-heat-col');
      for (var d = 0; d < 7; d++) {
        var day = addDays(ws, w * 7 + d), c = el('i', 'st-cell');
        if (day > t0) { c.classList.add('st-future'); col.appendChild(c); continue; }
        var r = get(m, day);
        c.classList.add('st-l' + level(r.done));
        if (key(day) === key(t0)) c.classList.add('st-today');
        c.title = DOW[day.getDay()] + ' ' + day.getDate() + '/' + (day.getMonth() + 1) + ': ' + r.done + ' việc';
        col.appendChild(c);
      }
      els.heat.appendChild(col);
    }
  }

  function draw() {
    if (!view || !els.wrap) return;
    var t0 = today(), m = logMap(view);
    var from7 = addDays(t0, -6), wk = sumRange(m, from7, 7);
    var todayDone = view.today ? +view.today.done || 0 : 0;
    els.today.num.textContent = fmt(todayDone);
    els.today.sub.textContent = 'việc xong';
    els.week.num.textContent = fmt(wk.done);
    els.week.sub.textContent = '7 ngày gần nhất';
    var streak = (view.stats && view.stats.streak && +view.stats.streak.count) || 0;
    els.streak.num.textContent = fmt(streak);
    var next = null;
    for (var i = 0; i < MILESTONES.length; i++) if (streak < MILESTONES[i]) { next = MILESTONES[i]; break; }
    els.streak.sub.textContent = 'ngày liên tiếp' + (next ? ' · mốc ' + next + ' còn ' + (next - streak) : ' · đã qua mọi mốc');
    els.coins.num.textContent = fmt(wk.coins);
    els.coins.sub.textContent = 'xu kiếm được';

    var total = 0;
    (view.log || []).forEach(function (r) { total += (r && +r.done) || 0; });
    var empty = total === 0 && todayDone === 0;
    els.empty.hidden = !empty;
    els.wrap.hidden = empty;
    for (var k in els.chips) {
      els.chips[k].classList.toggle('active', k === mode);
      els.chips[k].setAttribute('aria-pressed', k === mode ? 'true' : 'false');
    }
    if (!empty) drawChart(m, t0);
    drawHeat(m, t0);

    var lv = view.level || 1;
    var rest = Math.max(0, (+view.nextLevelExp || 0) - ((view.stats && +view.stats.exp) || 0));
    els.foot.textContent = 'Tổng cộng ' + fmt(Math.max(total, todayDone)) + ' việc đã xong · Cấp ' + lv + (view.nextLevelExp ? ', còn ' + fmt(rest) + ' exp tới cấp ' + (lv + 1) : '');
  }

  window.MochiRoom.registerTab('stats', {
    label: 'Thống kê',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><rect x="5" y="12" width="3.5" height="8" rx="1"/><rect x="10.3" y="6" width="3.5" height="14" rx="1"/><rect x="15.5" y="9" width="3.5" height="11" rx="1"/></svg>',
    mount: function (root) { build(root); draw(); },
    update: function (v) { view = v; draw(); },
    show: function () { draw(); }
  });
})();
