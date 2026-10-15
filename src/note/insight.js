(function () {
  'use strict';
  var MN = window.MochiNote;
  if (!MN || typeof MN.on !== 'function') return;

  var DEBOUNCE = 1500;
  var dismissed = new Map(); // băm nội dung -> true (chỉ trong phiên)
  var timer = null, inflight = false, pending = false;
  var cur = null; // { hash, sugs, mode }
  var row = null, busy = false;

  function api() {
    var m = window.mochi;
    return m && m.alarms && typeof m.alarms.insight === 'function' ? m.alarms : null;
  }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function noteText() {
    var n = safe(function () { return MN.note(); });
    var t = n && (typeof n.text === 'string' ? n.text : '');
    if (!t && MN.editor) t = safe(function () { return MN.editor.innerText; }) || '';
    return String(t || '').trim();
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return s.length + ':' + h;
  }
  function locked() { return !!safe(function () { return MN.isLocked(); }); }

  function ensureRow() {
    if (row && row.isConnected) return row;
    row = document.getElementById('insightRow');
    if (!row) {
      var chip = document.querySelector('.chiprow');
      if (!chip || !chip.parentNode) return null;
      row = document.createElement('div');
      row.id = 'insightRow';
      row.className = 'insight-row';
      row.hidden = true;
      chip.parentNode.insertBefore(row, chip);
    }
    return row;
  }

  // ---- nhận diện mềm kết quả ----
  function arr(v) { return Array.isArray(v) ? v : []; }
  function sugLabel(s) { return String(s.label || s.title || s.text || '').trim(); }
  function sugKind(s) { return String(s.kind || s.type || s.action || s.intent || '').toLowerCase(); }
  function isReminder(s) {
    return /remind|alarm|nhac|nhắc|bao.?thuc|báo thức|create/.test(sugKind(s)) ||
      /nhắc|nhac|báo thức/i.test(sugLabel(s));
  }
  function phoneOf(s) {
    var p = s.phone || s.number || s.tel || (s.payload && (s.payload.phone || s.payload.number));
    if (!p && /call|dial|sms|phone|goi|gọi|nhan|nhắn/.test(sugKind(s))) {
      var m = sugLabel(s).match(/\+?\d[\d .-]{7,}\d/);
      p = m && m[0];
    }
    return p ? String(p).trim() : '';
  }
  function analyze(res) {
    if (!res || typeof res !== 'object') return null;
    var r = res.insight && typeof res.insight === 'object' ? res.insight : res;
    var sugs = arr(r.suggestions).concat(arr(r.actions))
      .filter(function (s) { return s && typeof s === 'object' && s.id != null; });
    var seen = {};
    sugs = sugs.filter(function (s) { if (seen[s.id]) return false; seen[s.id] = 1; return true; });
    var timed = arr(r.items).filter(function (it) { return it && it.due; }).length;
    var rem = sugs.filter(isReminder);
    var phones = sugs.filter(function (s) { return !!phoneOf(s); });
    if (rem.length) {
      var n = timed || rem.length;
      return { mode: 'remind', sugs: rem, text: n + ' việc có giờ — bé nhắc nha?', btn: 'Tạo' };
    }
    if (phones.length) {
      return { mode: 'phone', sugs: [], text: 'Số ' + phoneOf(phones[0]) + ' — gọi nha?', btn: '' };
    }
    if (sugs.length) {
      var l = sugLabel(sugs[0]);
      return { mode: 'other', sugs: [sugs[0]], text: 'Bé gợi ý: ' + (l || 'làm theo gợi ý này') + '?', btn: 'Làm' };
    }
    if (timed) return null; // có giờ nhưng chưa có đề xuất hành động thì không hứa gì
    return null;
  }

  // ---- giao diện ----
  var ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5a4.2 4.2 0 0 0-2.4 7.6c.4.3.6.7.6 1.1v.3h3.6v-.3c0-.4.2-.8.6-1.1A4.2 4.2 0 0 0 8 1.5z" fill="currentColor"/><rect x="6.2" y="11.9" width="3.6" height="1.3" rx=".6" fill="currentColor"/><rect x="6.8" y="13.7" width="2.4" height="1" rx=".5" fill="currentColor"/></svg>';

  function hide() {
    var r = ensureRow(); if (!r) return;
    if (r.hidden) return;
    r.classList.remove('show');
    r.hidden = true;
    r.textContent = '';
  }
  function show(a) {
    var r = ensureRow(); if (!r) return;
    r.textContent = '';
    var ic = document.createElement('span'); ic.className = 'ins-ic'; ic.innerHTML = ICON;
    var tx = document.createElement('span'); tx.className = 'ins-tx'; tx.textContent = a.text; tx.title = a.text;
    r.appendChild(ic); r.appendChild(tx);
    if (a.btn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ins-go'; b.textContent = a.btn;
      b.addEventListener('click', function () { apply(); });
      r.appendChild(b);
    }
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'ins-x'; x.setAttribute('aria-label', 'Ẩn gợi ý'); x.textContent = '✕';
    x.addEventListener('click', function () {
      if (cur) dismissed.set(cur.hash, true);
      hide();
    });
    r.appendChild(x);
    var wasHidden = r.hidden;
    r.hidden = false;
    if (wasHidden) {
      r.classList.remove('show');
      void r.offsetWidth;
    }
    r.classList.add('show');
  }

  function apply() {
    var al = api();
    if (!al || !cur || busy || typeof al.applySuggestion !== 'function') return;
    var c = cur, id = safe(function () { return MN.id; });
    busy = true;
    var chain = Promise.resolve();
    c.sugs.forEach(function (s) {
      chain = chain.then(function () { return al.applySuggestion(id, s.id); });
    });
    chain.then(function () {
      dismissed.set(c.hash, true);
      hide();
      safe(function () { MN.toast('Bé nhớ rồi nè', 2200); });
    }, function () {
      safe(function () { MN.toast('Bé chưa tạo được, thử lại nha', 2200); });
    }).then(function () { busy = false; });
  }

  // ---- vòng làm mới ----
  function refresh() {
    var al = api();
    if (!al || locked()) { hide(); return; }
    var text = noteText();
    if (!text) { hide(); return; }
    var h = hash(text);
    if (dismissed.has(h)) { hide(); return; }
    if (inflight) { pending = true; return; }
    inflight = true;
    var p;
    try { p = Promise.resolve(al.insight(MN.id)); } catch (e) { p = Promise.reject(e); }
    p.then(function (res) {
      if (hash(noteText()) !== h || locked()) return; // nội dung đã đổi: bỏ
      var a = analyze(res);
      if (!a) { cur = null; hide(); return; }
      a.hash = h; cur = a;
      show(a);
    }, function () { hide(); }).then(function () {
      inflight = false;
      if (pending) { pending = false; schedule(); }
    });
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { safe(refresh); }, DEBOUNCE);
  }

  MN.on('note', function () {
    if (!api()) return;
    if (locked() || !noteText()) { hide(); return; }
    schedule();
  });
  MN.on('locked', function (v) { if (v) hide(); else schedule(); });
  MN.on('ready', function () { schedule(); });
})();
