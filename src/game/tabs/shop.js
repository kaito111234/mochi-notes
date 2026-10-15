(function () {
  'use strict';
  var R = window.MochiRoom;
  if (!R) return;
  var el = null, room = null, lastView = null, lineTimer = null, busy = false;
  var refs = {};

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pct(v) { return Math.max(0, Math.min(100, Math.round(v || 0))); }
  function fmt(x) { return String(Math.round(x)); }

  function buildStats() {
    var box = h('div', 'sh-stats card');
    var bubble = h('div', 'sh-bubble');
    bubble.hidden = true;
    refs.bubble = bubble;
    var rows = h('div', 'sh-meters');
    function row(label, cls, key) {
      var r = h('div', 'sh-meter-row');
      r.appendChild(h('span', 'sh-meter-lab', label));
      var bar = h('span', 'sh-meter ' + cls);
      var fill = h('i');
      bar.appendChild(fill);
      r.appendChild(bar);
      var num = h('span', 'sh-meter-num', '0');
      r.appendChild(num);
      refs[key + 'Fill'] = fill;
      refs[key + 'Num'] = num;
      rows.appendChild(r);
    }
    row('Tâm trạng', 'sh-mood', 'mood');
    row('Năng lượng', 'sh-energy', 'energy');
    box.appendChild(rows);
    box.appendChild(bubble);
    return box;
  }

  function bagIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M9.5 13a2.5 2.5 0 0 0 5 0"/></svg>';
  }

  function render(view) {
    lastView = view;
    if (!el) return;
    var st = view.stats || {};
    refs.moodFill.style.width = pct(st.mood) + '%';
    refs.energyFill.style.width = pct(st.energy) + '%';
    refs.moodNum.textContent = fmt(st.mood || 0);
    refs.energyNum.textContent = fmt(st.energy || 0);

    var foods = (room.catalog && room.catalog.foods) || [];
    var factors = view.foodFactor || {};
    var coins = st.candy || 0;
    refs.grid.textContent = '';
    foods.forEach(function (f) {
      var factor = factors[f.id] != null ? factors[f.id] : 1;
      var card = h('div', 'sh-card card');
      card.dataset.food = f.id;
      var ic = h('div', 'sh-icon');
      var img = document.createElement('img');
      img.src = room.iconUrl(f.icon);
      img.alt = '';
      img.draggable = false;
      ic.appendChild(img);
      card.appendChild(ic);
      card.appendChild(h('div', 'sh-name', f.name));
      var price = h('div', 'sh-price');
      var coin = h('span', 'coin');
      price.appendChild(coin);
      price.appendChild(h('span', 'sh-price-num', String(f.price)));
      card.appendChild(price);
      var m = Math.round(f.mood * factor), en = Math.round(f.energy * factor);
      card.appendChild(h('div', 'sh-gain', '+' + m + ' Tâm trạng · +' + en + ' Năng lượng'));
      var tag = h('div', 'sh-tag' + (factor < 1 ? ' on' : ''));
      if (factor < 1) {
        tag.textContent = 'Mochi hơi ngán (×' + String(Math.round(factor * 100) / 100).replace('.', ',') + ')';
        tag.title = 'Ăn món khác hoặc đợi vài giờ nhé';
        card.title = 'Ăn món khác hoặc đợi vài giờ nhé';
      } else {
        tag.innerHTML = '&nbsp;';
      }
      card.appendChild(tag);
      var btn = h('button', 'btn btn-primary sh-buy', 'Mua & cho ăn');
      btn.type = 'button';
      var short = coins < f.price;
      if (!view.enabled) { btn.disabled = true; btn.title = 'Game hóa đang tắt'; }
      else if (short) { btn.disabled = true; btn.title = 'Chưa đủ xu'; }
      if (btn.disabled) card.classList.add('dim');
      btn.addEventListener('click', function () { buy(f, card, btn); });
      card.appendChild(btn);
      refs.grid.appendChild(card);
    });
  }

  function say(text) {
    if (!text) return;
    refs.bubble.textContent = text;
    refs.bubble.hidden = false;
    refs.bubble.classList.remove('pop');
    void refs.bubble.offsetWidth;
    refs.bubble.classList.add('pop');
    clearTimeout(lineTimer);
    lineTimer = setTimeout(function () { refs.bubble.hidden = true; }, 7000);
  }

  function fly(card, f) {
    try {
      var img = card.querySelector('img');
      var from = img.getBoundingClientRect();
      var to = refs.moodFill.getBoundingClientRect();
      var f1 = document.createElement('img');
      f1.src = img.src; f1.className = 'sh-fly'; f1.alt = '';
      f1.style.left = (from.left + from.width / 2 - 16) + 'px';
      f1.style.top = (from.top + from.height / 2 - 16) + 'px';
      document.body.appendChild(f1);
      var dx = (to.left + 20) - (from.left + from.width / 2);
      var dy = (to.top) - (from.top + from.height / 2);
      f1.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 30) + 'px) scale(1.15)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.5)', opacity: 0 }
      ], { duration: 750, easing: 'ease-in' }).onfinish = function () {
        f1.remove();
        var heart = h('span', 'sh-heart');
        heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
        heart.style.left = (to.left + 10) + 'px';
        heart.style.top = (to.top - 8) + 'px';
        document.body.appendChild(heart);
        setTimeout(function () { heart.remove(); }, 900);
      };
    } catch (e) { /* hiệu ứng không bắt buộc */ }
  }

  function buy(f, card, btn) {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    Promise.resolve(room.api.buyFeed(f.id)).then(function (res) {
      res = res || {};
      if (res.view) room.setView(res.view);
      if (res.ok) {
        room.toast('Mochi đã ăn ' + f.name, 'ok');
        say(res.line || 'Ngon quá, cảm ơn cậu nha!');
        var c = refs.grid.querySelector('[data-food="' + f.id + '"]') || card;
        fly(c, f);
      } else {
        room.toast(res.reason || 'Không mua được', 'warn');
        if (!res.view && lastView) render(lastView);
      }
    }).catch(function () {
      room.toast('Có lỗi, thử lại nhé', 'warn');
      if (lastView) render(lastView);
    }).then(function () { busy = false; });
  }

  R.registerTab('shop', {
    label: 'Cửa hàng',
    icon: bagIcon(),
    mount: function (root, r) {
      el = root; room = r;
      el.classList.add('sh-root');
      el.appendChild(buildStats());
      var title = h('div', 'sh-section', 'Đồ ăn cho bé');
      el.appendChild(title);
      refs.grid = h('div', 'sh-grid');
      el.appendChild(refs.grid);
      if (room.view) render(room.view);
    },
    update: function (view, r) { room = r || room; render(view); }
  });
})();
