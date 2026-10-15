(function () {
  'use strict';
  var R = window.MochiRoom;
  if (!R) return;
  var el = null, room = null, refs = {}, timer = null, busy = false;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function p2(n) { return n < 10 ? '0' + n : String(n); }

  var P = {
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8L12 3.5z"/>',
    cat: '<path d="M5 9V4.5l4 2.5h6l4-2.5V9c1 1.2 1.5 2.5 1.5 4 0 3.6-3.6 6-8.5 6S3.5 16.6 3.5 13c0-1.5.5-2.8 1.5-4z"/><circle cx="9.5" cy="12.5" r=".6"/><circle cx="14.5" cy="12.5" r=".6"/><path d="M11 15l1 .8 1-.8"/>',
    fire: '<path d="M12 3c.5 3-2.5 4.5-3.5 7.5-.8 2.4.2 4.5 1.5 5.5-.2-1.5.5-2.5 1.5-3.5 0 2 2.5 2.5 2.5 5 1.2-.8 2.5-2.500 2.5-4.5C16.5 9 13 7 12 3z"/><path d="M12 21c-2.500 0-4.500-1.800-4.500-4.200"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3.5 9h17v3h-17zM12 9v11"/><path d="M12 9c-1-3-4.500-3.500-4.500-1.200C7.500 9 12 9 12 9zm0 0c1-3 4.500-3.500 4.500-1.200C16.500 9 12 9 12 9z"/>',
    heart: '<path d="M12 19.500s-7.500-4.600-7.500-10A4.200 4.200 0 0 1 12 7a4.200 4.200 0 0 1 7.500 2.500c0 5.400-7.500 10-7.500 10z"/>',
    crown: '<path d="M4 8l4 4 4-6 4 6 4-4-1.500 10h-13L4 8z"/><path d="M6 20.500h12"/>',
    sparkle: '<path d="M12 3l1.800 6.200L20 11l-6.200 1.800L12 19l-1.800-6.200L4 11l6.200-1.800L12 3z"/><path d="M19 3.500v3M17.500 5h3"/>',
    shirt: '<path d="M8.500 4L3.500 7l2 3.500L8 9.500V20h8V9.500l2.500 1L20.500 7l-5-3c-.5 1.200-1.800 2-3.500 2s-3-.8-3.500-2z"/>',
    cake: '<path d="M4.500 13h15v6.500h-15z"/><path d="M4.500 16c1.500 1 3 1 4.500 0s3-1 4.500 0 3 1 4.500 0"/><path d="M12 13V9.500"/><path d="M12 6.500c.8.900.8 1.700 0 2.500-.8-.8-.8-1.600 0-2.500z"/>',
    calendar: '<rect x="4" y="5.500" width="16" height="14.500" rx="2"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/><path d="M8.500 14h.01M12 14h.01M15.500 14h.01M8.500 17h.01M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="8.500"/><path d="M8 12.300l2.700 2.700L16.200 9.500"/>',
    paw: '<circle cx="8" cy="9" r="1.800"/><circle cx="16" cy="9" r="1.800"/><circle cx="5.500" cy="13.500" r="1.600"/><circle cx="18.500" cy="13.500" r="1.600"/><path d="M12 12.500c-2.500 0-4.500 2.500-4.500 4.300 0 1.500 1.500 2 2.500 1.700.8-.3 1.300-.5 2-.5s1.200.2 2 .5c1 .3 2.500-.2 2.500-1.700 0-1.800-2-4.300-4.500-4.300z"/>'
  };
  function badgeSvg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.star) + '</svg>';
  }
  function flagIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4"/><path d="M6 5c3-1.500 5 1.500 8 0s3-1 4-.5v8c-1 .5-1 1-4 .5s-5 1.500-8 0"/></svg>';
  }

  function untilMidnight() {
    var n = new Date();
    var m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0);
    var mins = Math.max(0, Math.ceil((m - n) / 60000));
    return p2(Math.floor(mins / 60)) + ':' + p2(mins % 60);
  }
  function tickClock() {
    if (refs.clock) refs.clock.textContent = 'Làm mới sau ' + untilMidnight();
  }

  function questCard(q, enabled) {
    var done = q.progress >= q.goal;
    var card = h('div', 'qs-card card' + (q.claimed ? ' claimed' : done ? ' ready' : ''));
    var top = h('div', 'qs-top');
    top.appendChild(h('div', 'qs-name', q.name));
    var rw = h('div', 'qs-reward');
    var c = h('span', 'coin');
    rw.appendChild(c);
    var r = q.reward || {};
    rw.appendChild(h('span', null, '+' + (r.candy || 0)));
    rw.appendChild(h('span', 'qs-exp', '+' + (r.exp || 0) + ' exp'));
    top.appendChild(rw);
    card.appendChild(top);
    var row = h('div', 'qs-row');
    var bar = h('div', 'qs-bar');
    var fill = h('i');
    var pr = Math.max(0, Math.min(1, q.goal ? q.progress / q.goal : 0));
    fill.style.width = Math.round(pr * 100) + '%';
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(h('span', 'qs-count', Math.min(q.progress, q.goal) + '/' + q.goal));
    var btn;
    if (q.claimed) {
      btn = h('span', 'qs-done', 'Đã nhận');
    } else {
      btn = h('button', 'btn btn-primary qs-claim', 'Nhận');
      btn.type = 'button';
      btn.disabled = !done || !enabled;
      if (!enabled) btn.title = 'Game hóa đang tắt';
      btn.addEventListener('click', function () { claim(q, btn); });
    }
    row.appendChild(btn);
    card.appendChild(row);
    return card;
  }

  function claim(q, btn) {
    if (busy) return;
    busy = true; btn.disabled = true;
    Promise.resolve(room.api.claim(q.id)).then(function (res) {
      res = res || {};
      if (res.view) room.setView(res.view);
      if (res.ok) {
        var r = res.reward || {};
        room.toast('Nhận ' + (r.candy || 0) + ' xu, ' + (r.exp || 0) + ' exp', 'coin');
      } else {
        room.toast(reasonText(res.reason), 'warn');
      }
    }).catch(function () { room.toast('Có lỗi, thử lại nhé', 'warn'); })
      .then(function () { busy = false; });
  }

  var REASONS = { off: 'Game hóa đang tắt', done: 'Hôm nay Mochi nhận rồi nhé', bad: 'Có lỗi, thử lại nhé', coins: 'Chưa đủ xu', full: 'Túi đầy rồi', empty: 'Hết rồi', incomplete: 'Chưa đủ bộ' };
  function reasonText(r) { return REASONS[r] || 'Chưa làm được'; }

  function renderCheckin(view) {
    var ci = view.checkin;
    var box = refs.checkin;
    box.textContent = '';
    if (!ci) { box.hidden = true; return; }
    box.hidden = false;
    var enabled = view.enabled !== false;
    var top = h('div', 'qs-top');
    top.appendChild(h('div', 'qs-name', 'Điểm danh 7 ngày'));
    top.appendChild(h('div', 'qs-clock', 'Đã điểm danh ' + (ci.total || 0) + ' lần'));
    box.appendChild(top);
    var grid = h('div', 'qs-days');
    (ci.rewards || []).forEach(function (r, i) {
      var st = i < ci.cycleDay ? 'done' : (i === ci.cycleDay && !ci.todayDone) ? 'today' : 'next';
      var c = h('div', 'qs-day ' + st);
      c.appendChild(h('div', 'qs-day-n', 'Ngày ' + r.day));
      var ic = h('div', 'qs-day-ic');
      if (r.food) {
        var f = room.food(r.food.id);
        if (f && f.icon) {
          var img = document.createElement('img');
          img.src = room.iconUrl(f.icon); img.alt = ''; img.draggable = false;
          ic.appendChild(img);
          if (r.food.n > 1) ic.appendChild(h('span', 'qs-day-x', '×' + r.food.n));
        }
        c.title = (f ? f.name : 'Đồ ăn') + (r.food.n > 1 ? ' ×' + r.food.n : '');
      }
      c.appendChild(ic);
      var amt = h('div', 'qs-day-amt');
      amt.appendChild(h('span', 'coin'));
      amt.appendChild(h('span', null, String(r.candy)));
      c.appendChild(amt);
      if (st === 'done') {
        var tick = h('span', 'qs-day-tick');
        tick.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 12.500l4 4 8-9"/></svg>';
        c.appendChild(tick);
      }
      grid.appendChild(c);
    });
    box.appendChild(grid);
    var foot = h('div', 'qs-ci-foot');
    foot.appendChild(h('div', 'qs-ci-note', 'Lỡ ngày không sao, vòng không bị mất.'));
    var btn = h('button', 'btn qs-ci-btn' + (ci.todayDone ? '' : ' btn-primary'), ci.todayDone ? 'Mai quay lại nhé' : 'Điểm danh');
    btn.type = 'button';
    btn.disabled = ci.todayDone || !enabled;
    if (!enabled) btn.title = REASONS.off;
    btn.addEventListener('click', function () { checkin(btn); });
    foot.appendChild(btn);
    box.appendChild(foot);
  }

  function checkin(btn) {
    if (busy) return;
    busy = true; btn.disabled = true;
    Promise.resolve(room.api.checkin()).then(function (res) {
      res = res || {};
      if (res.view) room.setView(res.view);
      if (res.ok) {
        var r = res.reward || {}, msg = 'Điểm danh xong, nhận ' + (r.candy || 0) + ' xu';
        if (r.food) {
          var f = room.food(r.food.id);
          msg += ' và ' + (f ? f.name : 'đồ ăn') + (r.food.n > 1 ? ' ×' + r.food.n : '');
        }
        room.toast(msg, 'coin');
      } else {
        room.toast(reasonText(res.reason), 'warn');
      }
    }).catch(function () { room.toast('Có lỗi, thử lại nhé', 'warn'); })
      .then(function () { busy = false; if (room.view) renderCheckin(room.view); });
  }

  function fmtDate(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function render(view) {
    if (!el) return;
    var enabled = view.enabled !== false;
    renderCheckin(view);
    var qd = (view.quests && view.quests.daily) || [];
    var qw = (view.quests && view.quests.weekly) || [];
    refs.daily.textContent = '';
    qd.forEach(function (q) { refs.daily.appendChild(questCard(q, enabled)); });
    refs.weekly.textContent = '';
    qw.forEach(function (q) { refs.weekly.appendChild(questCard(q, enabled)); });

    var ach = view.achievements || [];
    var got = ach.filter(function (a) { return a.unlocked; }).length;
    refs.achCount.textContent = 'Đã mở ' + got + '/' + ach.length;
    refs.ach.textContent = '';
    ach.forEach(function (a) {
      var cell = h('div', 'qs-ach' + (a.unlocked ? ' on' : ''));
      var b = h('div', 'qs-badge');
      b.innerHTML = badgeSvg(a.icon);
      cell.appendChild(b);
      cell.appendChild(h('div', 'qs-ach-name', a.name));
      cell.appendChild(h('div', 'qs-ach-sub', a.unlocked ? 'Mở ngày ' + fmtDate(a.at) : a.desc));
      cell.title = a.desc + (a.reward ? ' (thưởng ' + a.reward + ' xu)' : '');
      refs.ach.appendChild(cell);
    });
    tickClock();
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(tickClock, 30000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  R.registerTab('quests', {
    label: 'Nhiệm vụ',
    icon: flagIcon(),
    mount: function (root, r) {
      el = root; room = r;
      el.classList.add('qs-root');
      refs.checkin = h('div', 'qs-checkin card');
      refs.checkin.hidden = true;
      el.appendChild(refs.checkin);
      var head = h('div', 'qs-head');
      head.appendChild(h('div', 'qs-title', 'Hôm nay'));
      refs.clock = h('div', 'qs-clock');
      head.appendChild(refs.clock);
      el.appendChild(head);
      refs.daily = h('div', 'qs-list');
      el.appendChild(refs.daily);
      var h2 = h('div', 'qs-head');
      h2.appendChild(h('div', 'qs-title', 'Tuần này'));
      el.appendChild(h2);
      refs.weekly = h('div', 'qs-list');
      el.appendChild(refs.weekly);
      var h3 = h('div', 'qs-head');
      h3.appendChild(h('div', 'qs-title', 'Thành tích'));
      refs.achCount = h('div', 'qs-clock');
      h3.appendChild(refs.achCount);
      el.appendChild(h3);
      refs.ach = h('div', 'qs-ach-grid');
      el.appendChild(refs.ach);
      startTimer();
      if (room.view) render(room.view);
    },
    update: function (view, r) { room = r || room; render(view); },
    show: function () { tickClock(); }
  });
})();
