(function () {
  'use strict';
  var MN = window.MochiNote;
  if (!MN || typeof MN.on !== 'function') return;

  var DEBOUNCE = 700;
  var MAX = 3;
  var dismissed = {};            // băm nội dung -> true (chỉ trong phiên)
  var timer = null, inflight = false, pending = false, busy = false;
  var cur = null;                // { hash, sugs, lead, page }
  var row = null;

  function api() {
    var m = window.mochi;
    return m && m.alarms && typeof m.alarms.insight === 'function' ? m.alarms : null;
  }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function noteId() { return safe(function () { return MN.id; }) || safe(function () { return MN.note().id; }); }
  function noteText() {
    var n = safe(function () { return MN.note(); });
    var t = n && typeof n.text === 'string' ? n.text : '';
    if (MN.editor) { var e = safe(function () { return MN.editor.innerText; }); if (typeof e === 'string') t = e; }
    return String(t || '').trim();
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return s.length + ':' + h;
  }
  function locked() { return !!safe(function () { return MN.isLocked(); }); }
  function toast(t) { safe(function () { MN.toast(t, 2600); }); }

  function ensureRow() {
    if (row && row.isConnected) return row;
    row = document.getElementById('insightRow');
    if (!row) {
      var chip = document.querySelector('.chiprow');
      if (!chip || !chip.parentNode) return null;
      row = document.createElement('div');
      row.id = 'insightRow';
      row.hidden = true;
      chip.parentNode.insertBefore(row, chip);
    }
    row.classList.add('insight-row');
    return row;
  }

  // ---- phân tích kết quả (kind thật: remind, remind-all, alarm, checklist, split, call, message, link, email) ----
  var ORDER = ['remind-all', 'remind', 'alarm', 'checklist', 'split', 'call', 'message', 'link', 'email'];
  function kindOf(s) { return String(s.kind || s.type || '').toLowerCase(); }
  function rank(s) { var i = ORDER.indexOf(kindOf(s)); return i < 0 ? ORDER.length : i; }
  function sugLabel(s) { return String(s.label || s.title || s.text || '').trim(); }
  function needsEdit(s) { var k = kindOf(s); return k === 'checklist' || k === 'split'; }

  function leadFor(first, r, sugs) {
    var items = Array.isArray(r.items) ? r.items : [];
    var timed = items.filter(function (it) { return it && it.due; }).length;
    var nRemind = sugs.filter(function (s) { var k = kindOf(s); return k === 'remind'; }).length;
    switch (kindOf(first)) {
      case 'remind-all': case 'remind':
        var n = timed || nRemind || 1;
        return 'Bé thấy ' + n + ' việc có giờ — tạo nhắc?';
      case 'alarm': return 'Có giờ rõ ràng — đặt báo thức nha?';
      case 'checklist': return 'Nhiều việc nhỏ — chuyển checklist nha?';
      case 'split': return 'Nhiều ý khác nhau — tách note nha?';
      case 'call': case 'message': return 'Bé thấy số điện thoại nè';
      case 'link': return 'Bé thấy đường link nè';
      case 'email': return 'Bé thấy địa chỉ email nè';
    }
    return 'Bé gợi ý nè';
  }
  function analyze(res) {
    if (!res || typeof res !== 'object') return null;
    var r = res.insight && typeof res.insight === 'object' ? res.insight : res;
    var list = (Array.isArray(r.suggestions) ? r.suggestions : []).concat(Array.isArray(r.actions) ? r.actions : []);
    var seen = {};
    var sugs = list.filter(function (s) {
      if (!s || typeof s !== 'object' || s.id == null || seen[s.id]) return false;
      seen[s.id] = 1; return !!sugLabel(s);
    });
    if (!sugs.length) return null;
    // sắp ổn định theo loại; nhiều "remind" thì đã có "remind-all" đứng trước
    sugs = sugs.map(function (s, i) { return { s: s, i: i }; })
      .sort(function (a, b) { return rank(a.s) - rank(b.s) || a.i - b.i; })
      .map(function (x) { return x.s; });
    return { sugs: sugs, lead: leadFor(sugs[0], r, sugs), page: 0 };
  }

  // ---- giao diện ----
  var ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5a4.2 4.2 0 0 0-2.4 7.6c.4.3.6.7.6 1.1v.3h3.6v-.3c0-.4.2-.8.6-1.1A4.2 4.2 0 0 0 8 1.5z" fill="currentColor"/><rect x="6.2" y="11.9" width="3.6" height="1.3" rx=".6" fill="currentColor"/><rect x="6.8" y="13.7" width="2.4" height="1" rx=".5" fill="currentColor"/></svg>';

  function compact() {
    var w = window.innerWidth || 300, h = window.innerHeight || 300;
    return w < 270 || h < 200;
  }
  function hide() {
    var r = ensureRow(); if (!r || r.hidden) return;
    r.classList.remove('show');
    r.hidden = true;
    r.textContent = '';
  }
  function btn(cls, text, title) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  }
  function render() {
    var r = ensureRow(); if (!r || !cur) return;
    var wasHidden = r.hidden;
    var comp = compact();
    var w = window.innerWidth || 300;
    var per = comp || w < 340 ? 1 : (w < 420 ? 2 : MAX);
    var all = cur.sugs;
    var pages = Math.ceil(all.length / per);
    var pg = cur.page % pages;
    var shown = all.slice(pg * per, pg * per + per);
    var more = pages > 1;
    var showLead = !comp && (per === 1 || shown.length < 2) && w >= 360;
    r.textContent = '';
    r.classList.toggle('compact', comp);
    var lk = locked();
    var ic = document.createElement('span'); ic.className = 'ins-ic'; ic.innerHTML = ICON;
    ic.title = cur.lead;
    r.appendChild(ic);
    if (showLead) {
      var tx = document.createElement('span'); tx.className = 'ins-tx'; tx.textContent = cur.lead; tx.title = cur.lead;
      r.appendChild(tx);
    }
    var box = document.createElement('span'); box.className = 'ins-btns';
    shown.forEach(function (s) {
      var b = btn('ins-go', sugLabel(s), sugLabel(s));
      if (lk && needsEdit(s)) { b.disabled = true; b.title = 'Note đang khoá'; }
      b.addEventListener('click', function () { apply(s); });
      box.appendChild(b);
    });
    if (more) {
      var m = btn('ins-more', '…', 'Gợi ý khác');
      m.addEventListener('click', function () { cur.page++; render(); });
      box.appendChild(m);
    }
    r.appendChild(box);
    var x = btn('ins-x', '✕', 'Ẩn gợi ý');
    x.addEventListener('click', function () {
      if (cur) dismissed[cur.hash] = true;
      hide();
    });
    r.appendChild(x);
    r.hidden = false;
    if (wasHidden) { r.classList.remove('show'); void r.offsetWidth; r.classList.add('show'); }
  }

  function apply(s) {
    var al = api();
    if (!al || typeof al.applySuggestion !== 'function' || busy) return;
    var id = noteId();
    busy = true;
    var r = ensureRow(); if (r) r.classList.add('busy');
    var p;
    try { p = Promise.resolve(al.applySuggestion(id, s.id)); } catch (e) { p = Promise.reject(e); }
    p.then(function (res) {
      var msg = res && typeof res === 'object' && res.message;
      toast(msg || (res && res.ok === false ? 'Bé chưa làm được, thử lại nha' : 'Bé làm rồi nè'));
    }, function () { toast('Bé chưa làm được, thử lại nha'); })
      .then(function () {
        busy = false;
        var rr = ensureRow(); if (rr) rr.classList.remove('busy');
        refresh(true);
      });
  }

  // ---- vòng làm mới ----
  function refresh(force) {
    var al = api();
    if (!al) { hide(); return; }
    var text = noteText();
    if (!text) { cur = null; hide(); return; }
    var h = hash(text);
    if (dismissed[h]) { hide(); return; }
    if (inflight) { pending = true; return; }
    inflight = true;
    var p;
    try { p = Promise.resolve(al.insight(noteId())); } catch (e) { p = Promise.reject(e); }
    p.then(function (res) {
      if (hash(noteText()) !== h) return;   // nội dung đã đổi: bỏ, lượt sau sẽ gọi lại
      var a = analyze(res);
      if (!a) { cur = null; hide(); return; }
      a.hash = h;
      if (cur && cur.hash === h) a.page = cur.page;
      cur = a;
      render();
    }, function () { hide(); }).then(function () {
      inflight = false;
      if (pending) { pending = false; schedule(); }
    });
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { safe(refresh); }, DEBOUNCE);
  }
  function onChange() {
    if (!api()) return;
    if (!noteText()) { cur = null; hide(); return; }
    schedule();
  }

  MN.on('note', onChange);
  MN.on('locked', function () { if (cur && !row.hidden) render(); else schedule(); });
  MN.on('ready', schedule);
  if (MN.editor && MN.editor.addEventListener) MN.editor.addEventListener('input', onChange);
  window.addEventListener('resize', function () { if (cur && row && !row.hidden) render(); });
})();
