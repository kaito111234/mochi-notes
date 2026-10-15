'use strict';
// window.MochiPaperStore — lưu mẫu giấy của note: IPC (main) hoặc dự phòng localStorage.
(function () {
  var META = 'mochi.paper.meta.', SET = 'mochi.paper.settings';
  var SHAPES = ['free', 'square', 'tall', 'mini'];
  var fallback = false;              // đã chuyển hẳn sang localStorage cho cả phiên
  var metaCbs = [], setCbs = [], ipcHooked = false;

  function api() { return (window.mochi && window.mochi.paper) || null; }
  function defSettings() { return { defaultPaper: null, defaultFont: null, hideDeco: false, tilt: false, hiddenPapers: [] }; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function idOk(v) { return typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v); }

  function lsGet(k) { try { var s = window.localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (_) { return null; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (_) { /* bỏ qua */ } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }

  function cleanHidden(a) {
    var out = [];
    if (!Array.isArray(a)) return out;
    for (var i = 0; i < a.length && out.length < 200; i++) {
      var v = a[i];
      if (typeof v === 'string' && /^[a-z0-9-]{1,64}$/.test(v) && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }
  function cleanMeta(m) {
    var o = {};
    if (!isObj(m)) return o;
    if (idOk(m.paper)) o.paper = m.paper;
    if (idOk(m.font)) o.font = m.font;
    if (SHAPES.indexOf(m.shape) >= 0) o.shape = m.shape;
    if (typeof m.tilt === 'boolean') o.tilt = m.tilt;
    if (typeof m.deco === 'boolean') o.deco = m.deco;
    return o;
  }
  function cleanSettings(s) {
    var o = defSettings();
    if (!isObj(s)) return o;
    if (idOk(s.defaultPaper)) o.defaultPaper = s.defaultPaper;
    if (idOk(s.defaultFont)) o.defaultFont = s.defaultFont;
    if (typeof s.hideDeco === 'boolean') o.hideDeco = s.hideDeco;
    if (typeof s.tilt === 'boolean') o.tilt = s.tilt;
    o.hiddenPapers = cleanHidden(s.hiddenPapers);
    return o;
  }
  function patchMeta(old, patch) {
    var o = cleanMeta(old);
    if (!isObj(patch)) return o;
    ['paper', 'font', 'shape', 'tilt', 'deco'].forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) return;
      if (patch[k] === null) { delete o[k]; return; }
      var t = {}; t[k] = patch[k];
      var c = cleanMeta(t);
      if (k in c) o[k] = c[k];
    });
    return o;
  }
  function patchSettings(old, patch) {
    var o = cleanSettings(old);
    if (!isObj(patch)) return o;
    ['defaultPaper', 'defaultFont'].forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) return;
      if (patch[k] === null) o[k] = null; else if (idOk(patch[k])) o[k] = patch[k];
    });
    if (typeof patch.hideDeco === 'boolean') o.hideDeco = patch.hideDeco;
    if (typeof patch.tilt === 'boolean') o.tilt = patch.tilt;
    if (Array.isArray(patch.hiddenPapers)) o.hiddenPapers = cleanHidden(patch.hiddenPapers);
    return o;
  }

  function emit(list, arg) { list.slice().forEach(function (cb) { try { cb(arg); } catch (_) { /* bỏ qua */ } }); }

  // Gọi IPC; thiếu hàm hoặc bị từ chối => chuyển hẳn sang dự phòng (trả undefined để gọi tiếp nhánh dự phòng).
  function viaIpc(name, args) {
    var a = api();
    if (fallback || !a || typeof a[name] !== 'function') { fallback = true; return Promise.resolve(undefined); }
    try {
      return Promise.resolve(a[name].apply(a, args)).then(function (r) { return r; }, function () { fallback = true; return undefined; });
    } catch (_) { fallback = true; return Promise.resolve(undefined); }
  }

  function hasKeys(o) { return isObj(o) && Object.keys(o).length > 0; }
  function isDefaultSettings(s) {
    var d = defSettings(), c = cleanSettings(s);
    return c.defaultPaper === d.defaultPaper && c.defaultFont === d.defaultFont && c.hideDeco === d.hideDeco && c.tilt === d.tilt && c.hiddenPapers.length === 0;
  }
  // Gọi thẳng IPC (không đổi cờ fallback); lỗi => undefined.
  function rawCall(name, args) {
    try {
      var a = api();
      if (!a || typeof a[name] !== 'function') return Promise.resolve(undefined);
      return Promise.resolve(a[name].apply(a, args)).then(function (r) { return r; }, function () { return undefined; });
    } catch (_) { return Promise.resolve(undefined); }
  }
  // Chuyển một lần dữ liệu localStorage cũ (từ lúc main chưa có module paper) sang main. Không ghi đè; không ném lỗi.
  // r = kết quả paper:get ({meta, settings}); trả {meta, settings} sau khi chuyển. Khoá chỉ bị xoá khi đã xử lý xong.
  function migrateLegacy(id, r) {
    var meta = cleanMeta(r.meta), settings = cleanSettings(r.settings);
    var steps = [];
    try {
      var mk = META + id, oldMeta = lsGet(mk);
      if (oldMeta !== null || window.localStorage.getItem(mk) !== null) {
        var om = cleanMeta(oldMeta);
        if (hasKeys(meta) || !hasKeys(om)) lsDel(mk);          // main đã có / dữ liệu cũ rỗng-hỏng => chỉ dọn khoá
        else steps.push(rawCall('set', [id, om]).then(function (res) {
          if (isObj(res) && hasKeys(res)) { meta = cleanMeta(res); lsDel(mk); }
        }));
      }
    } catch (_) { /* bỏ qua */ }
    try {
      var os = lsGet(SET);
      if (os !== null || window.localStorage.getItem(SET) !== null) {
        var cs = isObj(os) ? cleanSettings(os) : null;
        if (!cs || isDefaultSettings(cs) || !isDefaultSettings(settings)) lsDel(SET); // hỏng / rỗng / main đã chỉnh => chỉ dọn
        else steps.push(rawCall('settings', [cs]).then(function (res) {
          if (isObj(res)) { settings = cleanSettings(res); lsDel(SET); }
        }));
      }
    } catch (_) { /* bỏ qua */ }
    return Promise.all(steps).then(function () { return { meta: meta, settings: settings }; }, function () { return { meta: meta, settings: settings }; });
  }

  function load(id) {
    return viaIpc('get', [id]).then(function (r) {
      if (r && isObj(r) && isObj(r.meta)) {
        return migrateLegacy(id, r).then(function (m) { return { meta: m.meta, settings: m.settings, persisted: true }; });
      }
      fallback = true;
      return { meta: cleanMeta(lsGet(META + id)), settings: cleanSettings(lsGet(SET)), persisted: false };
    });
  }

  function set(id, patch) {
    return viaIpc('set', [id, patch]).then(function (r) {
      if (r && isObj(r)) return cleanMeta(r);
      fallback = true;
      var m = patchMeta(lsGet(META + id), patch);
      lsSet(META + id, m);
      emit(metaCbs, { id: id, meta: m });
      return m;
    });
  }

  function setSettings(patch) {
    return viaIpc('settings', [patch || {}]).then(function (r) {
      if (r && isObj(r)) return cleanSettings(r);
      fallback = true;
      var s = patchSettings(lsGet(SET), patch);
      lsSet(SET, s);
      emit(setCbs, s);
      return s;
    });
  }

  function resize(id, w, h) {
    return viaIpc('resize', [id, { width: w, height: h }]).then(function (r) {
      if (typeof r === 'boolean') return r;
      try { window.resizeTo(Math.round(w), Math.round(h)); return true; } catch (_) { return false; }
    });
  }

  function checkItem(id, index, done) {
    return viaIpc('checkItem', [id, index, !!done]).then(function (r) { return r === undefined ? false : r; });
  }

  function hookIpc() {
    if (ipcHooked) return;
    var a = api();
    if (!a) return;
    ipcHooked = true;
    try { if (typeof a.onMeta === 'function') a.onMeta(function (d) { if (d && isObj(d) && typeof d.id === 'string') emit(metaCbs, { id: d.id, meta: cleanMeta(d.meta) }); }); } catch (_) { /* bỏ qua */ }
    try { if (typeof a.onSettings === 'function') a.onSettings(function (s) { emit(setCbs, cleanSettings(s)); }); } catch (_) { /* bỏ qua */ }
  }

  // Dự phòng: cửa sổ khác ghi localStorage => sự kiện 'storage'
  try {
    window.addEventListener('storage', function (e) {
      try {
        if (!e || typeof e.key !== 'string') return;
        if (e.key.indexOf(META) === 0) {
          var id = e.key.slice(META.length);
          var m = {}; try { m = cleanMeta(e.newValue ? JSON.parse(e.newValue) : {}); } catch (_) { /* hỏng */ }
          emit(metaCbs, { id: id, meta: m });
        } else if (e.key === SET) {
          var s = null; try { s = e.newValue ? JSON.parse(e.newValue) : null; } catch (_) { /* hỏng */ }
          emit(setCbs, cleanSettings(s));
        }
      } catch (_) { /* bỏ qua */ }
    });
  } catch (_) { /* bỏ qua */ }

  function sub(list, cb) {
    if (typeof cb !== 'function') return function () {};
    hookIpc();
    list.push(cb);
    return function () { var i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); };
  }

  window.MochiPaperStore = {
    load: load, set: set, setSettings: setSettings, resize: resize, checkItem: checkItem,
    onMeta: function (cb) { return sub(metaCbs, cb); },
    onSettings: function (cb) { return sub(setCbs, cb); },
    isFallback: function () { return fallback; }
  };
})();
