'use strict';
// window.MochiPaperCtl — áp mẫu giấy cho note này, nối MochiNote + MochiPaper + MochiPaperStore.
(function () {
  var SIZES = { square: [300, 300], tall: [260, 360], mini: [220, 170] };
  var FRESH_MS = 15000;

  var meta = {}, settings = { defaultPaper: null, defaultFont: null, hideDeco: false, tilt: false };
  var persisted = true, loaded = false, previewId = null;
  var cbs = [];

  function N() { return window.MochiNote || null; }
  function P() { return window.MochiPaper || null; }
  function S() { return window.MochiPaperStore || null; }
  function noteId() { var n = N(); return n && n.id ? n.id : null; }
  function curNote() { var n = N(); try { return n && typeof n.note === 'function' ? n.note() : null; } catch (_) { return null; } }
  function defOf(id) { var p = P(); try { return p && typeof p.get === 'function' ? p.get(id) : null; } catch (_) { return null; } }
  function fire() { var s = state(); cbs.slice().forEach(function (cb) { try { cb(s); } catch (_) { /* bỏ qua */ } }); }

  function computePaperId() {
    var n = curNote();
    var plain = 'plain-' + ((n && n.color) || 'yellow');
    var id = meta && meta.paper;
    if (id && id.indexOf('plain-') !== 0 && defOf(id)) return id;   // mẫu thường còn trong catalog
    if (id && id.indexOf('plain-') === 0 && defOf(id) && !n) return id;
    return plain;                                                   // trơn: luôn theo màu note
  }

  function opts(paperId) {
    var def = defOf(paperId);
    var o = {
      font: meta.font || (def && def.font) || 'system',
      tilt: typeof meta.tilt === 'boolean' ? meta.tilt : !!settings.tilt,
      deco: typeof meta.deco === 'boolean' ? meta.deco : !settings.hideDeco
    };
    var h = document.getElementById('paperHead'), l = document.getElementById('paperLayer');
    if (h) o.headEl = h;
    if (l) o.layerEl = l;
    return o;
  }

  function applyNow(paperId) {
    var p = P();
    if (!p || typeof p.apply !== 'function' || !document.body) return;
    try { p.apply(document.body, paperId, opts(paperId)); } catch (_) { /* không làm hỏng note */ }
  }

  function state() {
    var pid = computePaperId(), def = defOf(pid), o = opts(pid);
    return { meta: meta, settings: settings, paperId: pid, fontId: o.font, tilt: o.tilt, deco: o.deco };
  }

  function refresh() { previewId = null; applyNow(computePaperId()); fire(); }

  function setColorFor(def) {
    var n = N(), cur = curNote();
    if (!def || !def.noteColor || !n || typeof n.setColor !== 'function') return;
    if (cur && cur.color === def.noteColor) return;
    try { var r = n.setColor(def.noteColor); if (r && r.catch) r.catch(function () {}); } catch (_) { /* bỏ qua */ }
  }

  function toast(t) { var n = N(); try { if (n && typeof n.toast === 'function') n.toast(t, 2200); } catch (_) { /* bỏ qua */ } }

  function plainText(n) {
    if (!n) return '';
    if (typeof n.text === 'string') return n.text.trim();
    return String(n.html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  // Dự phòng: note mới trống, chưa có meta, vừa tạo => gán mẫu mặc định
  function maybeFallbackDefault() {
    var id = noteId(), st = S(), n = curNote();
    if (!id || !st || persisted || !n || Object.keys(meta).length || !settings.defaultPaper) return;
    if (plainText(n) || !(Date.now() - (n.createdAt || 0) < FRESH_MS)) return;
    var patch = { paper: settings.defaultPaper };
    if (settings.defaultFont) patch.font = settings.defaultFont;
    st.set(id, patch).then(function (m) { meta = m || {}; refresh(); }).catch(function () {});
  }

  function init() {
    var st = S(), id = noteId();
    if (!st || !id) { applyNow(computePaperId()); return; }
    var p;
    try { p = st.load(id); } catch (_) { p = null; }
    Promise.resolve(p).then(function (r) {
      if (r) { meta = r.meta || {}; settings = r.settings || settings; persisted = r.persisted !== false; }
      loaded = true;
      refresh();
      maybeFallbackDefault();
    }).catch(function () { loaded = true; refresh(); });
    try {
      st.onMeta(function (d) { if (d && d.id === id) { meta = d.meta || {}; refresh(); } });
      st.onSettings(function (s) { if (s) { settings = s; refresh(); } });
    } catch (_) { /* bỏ qua */ }
  }

  function wire() {
    var n = N();
    if (!n || typeof n.on !== 'function') { try { init(); } catch (_) { /* bỏ qua */ } return; }
    var started = false;
    function go() { if (started) return; started = true; try { init(); } catch (_) { /* bỏ qua */ } }
    try {
      n.on('ready', go);
      n.on('note', function (note) {
        if (!loaded) return;
        var pid = computePaperId();
        if (!previewId) applyNow(pid);
        fire();
      });
    } catch (_) { /* bỏ qua */ }
    // đã nạp xong trước khi paperCtl chạy?
    try { if (curNote()) go(); } catch (_) { /* bỏ qua */ }
  }

  var api = {
    state: state,
    preview: function (id) {
      try {
        if (!id || !defOf(id)) { previewId = null; applyNow(computePaperId()); return; }
        previewId = id; applyNow(id);
      } catch (_) { /* bỏ qua */ }
    },
    choose: function (patch) {
      var st = S(), id = noteId();
      if (!st || !id || !patch || typeof patch !== 'object') return Promise.resolve();
      return st.set(id, patch).then(function (m) {
        meta = m || meta;
        refresh();
        if (patch.paper) setColorFor(defOf(patch.paper));
      }).catch(function () {});
    },
    setDefault: function () {
      var st = S();
      if (!st) return Promise.resolve();
      var pid = computePaperId();
      var patch = { defaultPaper: pid, defaultFont: meta.font || null };
      return st.setSettings(patch).then(function (s) {
        settings = s || settings; refresh();
        toast('Note mới sẽ dùng mẫu này');
      }).catch(function () {});
    },
    setShape: function (shape) {
      var st = S(), id = noteId();
      if (!st || !id) return Promise.resolve();
      var sz = SIZES[shape];
      var done = sz ? st.resize(id, sz[0], sz[1]) : Promise.resolve(true);
      return Promise.resolve(done).catch(function () {}).then(function () {
        return st.set(id, { shape: shape });
      }).then(function (m) { meta = m || meta; fire(); }).catch(function () {});
    },
    // note.js gọi sau Ctrl+N: chế độ dự phòng thì gán mẫu mặc định cho note mới
    noteCreated: function (newNote) {
      try {
        var st = S();
        if (!st || !newNote || !newNote.id) return Promise.resolve();
        return st.load(newNote.id).then(function (r) {
          if (!r || r.persisted || Object.keys(r.meta).length || !r.settings.defaultPaper) return;
          var patch = { paper: r.settings.defaultPaper };
          if (r.settings.defaultFont) patch.font = r.settings.defaultFont;
          return st.set(newNote.id, patch);
        }).catch(function () {});
      } catch (_) { return Promise.resolve(); }
    },
    on: function (evt, cb) {
      if (evt !== 'change' || typeof cb !== 'function') return function () {};
      cbs.push(cb);
      return function () { var i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); };
    }
  };

  window.MochiPaperCtl = api;
  wire();
})();
