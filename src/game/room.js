/* Phòng của Mochi — khung cửa sổ. Tab đăng ký qua MochiRoom.registerTab (API.md mục 11). */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src) || location.href;
  var MODE_VI = { happy: 'Vui vẻ', normal: 'Bình thường', tired: 'Mệt', sad: 'Buồn' };
  var ORDER = ['wardrobe', 'gacha', 'shop', 'quests', 'stats', 'album'];
  var tabs = {};          // id -> { def, btn, panel, ok }
  var regOrder = [];
  var current = null, started = false, lastCoin = null;
  var $ = function (id) { return document.getElementById(id); };

  var room = {
    api: window.mochi && window.mochi.game,
    view: null, catalog: null,
    preview: window.MochiPreview,
    setView: function (v) { if (v) { room.view = v; applyView(v); } },
    toast: function (text, kind) {
      var box = $('toasts'); if (!box) return;
      var t = document.createElement('div');
      t.className = 'toast t-' + (kind || 'ok'); t.textContent = text;
      box.appendChild(t);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 2400);
    },
    iconUrl: function (p) { return new URL('../../assets/game/' + p, BASE).href; },
    item: function (id) { return ((room.catalog && room.catalog.items) || []).find(function (i) { return i.id === id; }) || null; },
    food: function (id) { return ((room.catalog && room.catalog.foods) || []).find(function (i) { return i.id === id; }) || null; },
    rarityName: function (r) { var x = ((room.catalog && room.catalog.rarities) || []).find(function (i) { return i.id === r; }); return x ? x.name : r; },
    slotName: function (s) { var x = ((room.catalog && room.catalog.slots) || []).find(function (i) { return i.id === s; }); return x ? x.name : s; },
    goto: function (id) { select(id); }
  };

  function registerTab(id, def) {
    if (tabs[id]) return;
    tabs[id] = { def: def, ok: true };
    regOrder.push(id);
  }
  window.MochiRoom = { registerTab: registerTab, room: room };

  function safe(id, fn) {
    var t = tabs[id]; if (!t) return;
    try { fn(t); } catch (e) {
      t.ok = false; t.btn && t.btn.classList.add('has-error');
      if (!t.panel.querySelector('.tab-error')) {
        var d = document.createElement('div'); d.className = 'tab-error';
        d.textContent = 'Mục này gặp lỗi nhỏ nên tạm không hiển thị được.'; t.panel.prepend(d);
      }
      if (window.console) console.error('[room] tab ' + id, e);
    }
  }

  function buildTabs() {
    var list = $('tablist'), panels = $('panels');
    regOrder.sort(function (a, b) { var x = ORDER.indexOf(a), y = ORDER.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    regOrder.forEach(function (id, i) {
      var t = tabs[id], d = t.def;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tab-btn'; b.setAttribute('role', 'tab');
      b.id = 'tabbtn-' + id; b.dataset.tab = id; b.setAttribute('aria-controls', 'tab-' + id); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1;
      b.innerHTML = (d.icon || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>') + '<span class="tab-label"></span><kbd>' + (i + 1) + '</kbd>';
      b.querySelector('.tab-label').textContent = d.label || id;
      b.addEventListener('click', function () { select(id); });
      list.appendChild(b); t.btn = b;
      var p = document.createElement('section');
      p.className = 'tab-panel'; p.id = 'tab-' + id; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id); p.hidden = true;
      panels.appendChild(p); t.panel = p;
      safe(id, function () { d.mount && d.mount(p, room); });
    });
  }

  function select(id) {
    if (!tabs[id] || id === current && !tabs[id].panel.hidden) return;
    current = id;
    regOrder.forEach(function (k) {
      var on = k === id, t = tabs[k];
      t.panel.hidden = !on; t.btn.setAttribute('aria-selected', on ? 'true' : 'false'); t.btn.tabIndex = on ? 0 : -1;
    });
    if (room.view) safe(id, function (t) { t.def.show && t.def.show(room); });
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
  }

  function pct(v) { return Math.max(0, Math.min(100, Math.round(+v || 0))) + '%'; }

  function applyView(v) {
    var s = v.stats || {};
    // xu
    var num = $('coinNum'), coin = +s.candy || 0;
    num.textContent = coin.toLocaleString('vi-VN');
    if (lastCoin !== null && coin > lastCoin) {
      var w = $('coinIcon').parentNode; w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump');
      var f = document.createElement('span'); f.className = 'coin-fly'; f.textContent = '+' + (coin - lastCoin);
      w.appendChild(f); setTimeout(function () { f.remove(); }, 1200);
    }
    lastCoin = coin;
    // cấp
    $('levelLabel').textContent = 'Cấp ' + (v.level || 1);
    var span = (v.nextLevelExp || 0) - (v.levelExp || 0), got = (s.exp || 0) - (v.levelExp || 0);
    $('levelFill').style.width = span > 0 ? pct(got / span * 100) : '100%';
    $('levelChip').title = 'Exp: ' + (s.exp || 0) + ' / ' + (v.nextLevelExp || 0) + ' tới cấp ' + ((v.level || 1) + 1);
    // thẻ bé
    var pm = $('pcMode'); pm.textContent = MODE_VI[v.mode] || MODE_VI.normal; pm.dataset.mode = v.mode || 'normal';
    $('pcMood').style.width = pct(s.mood); $('pcEnergy').style.width = pct(s.energy);
    var n = (s.streak && s.streak.count) || 0;
    $('pcStreak').textContent = n > 0 ? n + ' ngày liên tiếp' : 'Chưa có chuỗi ngày';
    // công tắc & lớp phủ
    $('swEnabled').checked = !!v.enabled;
    $('offVeil').hidden = !!v.enabled;
    document.getElementById('panels').toggleAttribute('inert', !v.enabled);
    regOrder.forEach(function (id) { safe(id, function (t) { t.def.update && t.def.update(v, room); }); });
  }

  function guard(p) { return p && p.then ? p.then(null, function (e) { room.toast('Chưa làm được, thử lại nha', 'warn'); if (window.console) console.error(e); }) : p; }
  function setEnabled(on) { guard(room.api.setEnabled(on).then(function (v) { room.setView(v); })); }

  function start() {
    if (!room.api) { document.body.textContent = 'Không tìm thấy API trò chơi.'; return; }
    $('btnClose').addEventListener('click', function () { room.api.close(); });
    $('swEnabled').addEventListener('change', function (e) { setEnabled(e.target.checked); });
    $('btnEnable').addEventListener('click', function () { setEnabled(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { room.api.close(); return; }
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) && e.target.type !== 'checkbox' || e.ctrlKey || e.altKey || e.metaKey) return;
      var i = regOrder.indexOf(current);
      if (/^[1-9]$/.test(e.key) && regOrder[+e.key - 1]) { select(regOrder[+e.key - 1]); e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var j = (i + (e.key === 'ArrowDown' ? 1 : -1) + regOrder.length) % regOrder.length;
        select(regOrder[j]); tabs[regOrder[j]].btn.focus(); e.preventDefault();
      }
    });
    buildTabs();
    Promise.all([room.api.state(), room.api.catalog()]).then(function (r) {
      room.catalog = r[1]; room.view = r[0];
      var want = (location.hash || '').replace('#', '');
      select(tabs[want] ? want : regOrder[0]);
      applyView(r[0]);
      room.view = r[0];
      var cur = tabs[current]; if (cur) safe(current, function (t) { t.def.show && t.def.show(room); });
      room.api.onChanged(function (v) { room.setView(v); });
      room.api.onTab && room.api.onTab(function (id) { select(id); });
    }, function (e) { room.toast('Không tải được dữ liệu', 'warn'); if (window.console) console.error(e); });
  }

  document.addEventListener('DOMContentLoaded', function () { if (!started) { started = true; start(); } });
})();
