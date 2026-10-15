/* Trang thử bộ chọn: MochiNote/MochiPaperCtl giả; MochiPaper thật nếu nạp được, không thì giả. ?color=charcoal */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  document.body.dataset.color = q.get('color') || 'yellow';
  window.__log = [];
  function log(s) { window.__log.push(s); }

  var pops = [document.getElementById('menu'), document.getElementById('pickerPanel')];
  window.MochiNote = {
    closePops: function () { pops.forEach(function (p) { p.hidden = true; }); },
    registerPop: function (el) { if (pops.indexOf(el) < 0) pops.push(el); log('registerPop'); },
    openPop: function (el) { window.MochiNote.closePops(); el.hidden = false; }
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.MochiNote.closePops(); });
  document.getElementById('btnMenu').addEventListener('click', function () { var m = document.getElementById('menu'); window.MochiNote.openPop(m); });

  function load(src) {
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = src;
      s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }
  function mockPaper() {
    var G = [{ id: 'plain', name: 'Trơn' }, { id: 'cute', name: 'Dễ thương' }, { id: 'student', name: 'Học sinh' }, { id: 'minimal', name: 'Tối giản' }, { id: 'office', name: 'Văn phòng' }, { id: 'season', name: 'Mùa & lễ' }];
    var cols = ['#fff2ab', '#cbf1c4', '#ffcce5', '#e7cfff', '#cde9ff', '#e0e0e0', '#4a4a4a', '#fbf3e2', '#ffe3ec', '#d6ecd2'];
    var names = ['Vàng', 'Xanh lá', 'Hồng', 'Tím', 'Xanh dương', 'Xám', 'Than', 'Kem lốm đốm & mèo đen', 'Hồng phấn', 'Bạc hà'];
    var L = cols.map(function (c, i) { return { id: 'm' + i, name: names[i], group: G[i < 7 ? 0 : (i < 9 ? 1 : 2)].id, bg: { color: c } }; });
    window.MochiPaper = {
      list: function () { return L; }, get: function (id) { return L.filter(function (d) { return d.id === id; })[0] || null; },
      groups: function () { return G; },
      fonts: function () { return [{ id: 'itim', name: 'Itim', family: '"Itim", cursive' }, { id: 'nunito', name: 'Nunito', family: 'Nunito, sans-serif' }, { id: 'system', name: 'Hệ thống', family: 'Segoe UI, sans-serif' }]; },
      thumb: function (id) { var d = this.get(id), e = document.createElement('div'); e.style.cssText = 'background:' + d.bg.color + ';width:84px;height:84px'; return e; }
    };
  }
  function ctl() {
    var st = { meta: { paper: q.get('paper') || 'm1' }, settings: { defaultPaper: null }, paperId: q.get('paper') || 'm1', tilt: false, deco: true }, cbs = [];
    function fire() { cbs.forEach(function (f) { f(); }); }
    window.MochiPaperCtl = {
      state: function () { return st; },
      preview: function (id) { log('preview ' + id); },
      choose: function (p) { log('choose ' + JSON.stringify(p)); if (p.paper) { st.paperId = st.meta.paper = p.paper; } if ('font' in p) st.meta.font = p.font; if ('tilt' in p) st.tilt = p.tilt; if ('deco' in p) st.deco = p.deco; fire(); return Promise.resolve(); },
      setDefault: function () { log('setDefault'); st.settings.defaultPaper = st.paperId; fire(); return Promise.resolve(); },
      setShape: function (s) { log('setShape ' + s); st.meta.shape = s; fire(); return Promise.resolve(); },
      on: function (e, cb) { if (e === 'change') cbs.push(cb); }
    };
  }
  load('../../../assets/paper/catalog.js').then(function () { return load('../paper.js'); }).then(function (ok) {
    return Promise.resolve(ok).then(function (ok2) {
      var real = ok && ok2 && window.MochiPaper && window.MochiPaper.list;
      if (!real) mockPaper();
      window.__realPaper = !!real;
      if (real && !q.get('paper')) q.set('paper', window.MochiPaper.list()[1].id);
      if (!q.has('nopaper')) { if (!q.has('noctl')) ctl(); } else delete window.MochiPaper;
      return load('../picker.js');
    });
  }).then(function () { window.__ready = true; });
})();
