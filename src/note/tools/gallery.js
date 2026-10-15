/* Công cụ dev: lưới mọi mẫu giấy. Mở src/note/tools/gallery.html bằng trình duyệt (file://). Không đóng gói. */
(function () {
  'use strict';
  var P = window.MochiPaper;
  P.assetBase = '../../../assets/paper/';
  var STAR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 6l7 17 18 1-14 12 5 18-16-10-16 10 5-18L7 24l18-1z" fill="#ffd966" stroke="#2b2420" stroke-width="3" stroke-linejoin="round"/></svg>');

  if (!window.MochiPaperCatalog || !window.MochiPaperCatalog.papers) {
    var mk = function (id, name, extra) {
      var base = { id: id, name: name, group: 'cute', order: 1, noteColor: 'yellow', dark: false,
        bg: { color: '#fbf3e2', head: 'same', gradient: null, texture: 'none' },
        lines: { kind: 'none', color: 'rgba(90,120,170,.3)', step: 26, margin: null },
        header: null, ink: '#3a2e2a', font: 'itim', edge: null, corner: null, deco: [], checklist: false };
      for (var k in extra) base[k] = extra[k];
      return base;
    };
    window.MochiPaperCatalog = { version: 1, papers: [
      mk('plain-yellow', 'Vàng', { group: 'plain', font: 'system', ink: '#1f1f1f', bg: { color: '#FFF7D1', head: '#FFF2AB', gradient: null, texture: 'none' } }),
      mk('t-ruled', 'Kẻ ngang + speckle', { bg: { color: '#fbf3e2', head: '#f6e7c8', gradient: null, texture: 'speckle' }, lines: { kind: 'ruled', color: 'rgba(150,120,90,.3)', step: 26, margin: null },
        header: { text: 'Notes', font: 'pangolin', color: '#5a3f33', size: 22, align: 'left', style: 'plain' },
        deco: [{ kind: 'img', src: STAR, pos: 'tr', w: 34, dx: 10, dy: 4, rot: 10 }, { kind: 'washi', color: '#f4b6c2', pattern: 'stripe', pos: 'bottom', w: 90, rot: -3 }] }),
      mk('t-grid', 'Ô vuông', { bg: { color: '#f4fbf6', head: 'same', gradient: null, texture: 'grain' }, lines: { kind: 'grid', color: 'rgba(60,140,100,.25)', step: 26 } }),
      mk('t-oly', 'Vở ô ly', { group: 'student', font: 'mali', ink: '#1f2d4d', bg: { color: '#fdfdf8', head: '#f4f4ea', gradient: null, texture: 'grain' },
        lines: { kind: 'oly', color: 'rgba(70,120,200,.3)', step: 26, margin: '#e07a7a' }, header: { text: 'Vở ghi', font: 'mali', color: '#c0392b', size: 20, align: 'left', style: 'underline' } }),
      mk('t-dots', 'Chấm bi', { bg: { color: '#fffaf0', head: 'same', gradient: null, texture: 'none' }, lines: { kind: 'dots', color: 'rgba(120,100,80,.5)', step: 26 }, font: 'nunito' }),
      mk('t-margin', 'Giấy có lề (xé mép)', { edge: 'torn-top', bg: { color: '#fffdf5', head: 'same', gradient: null, texture: 'grain' }, lines: { kind: 'margin-ruled', color: 'rgba(80,120,190,.3)', step: 26, margin: '#e88a8a' }, font: 'bevietnam' }),
      mk('t-grad', 'Gradient + ribbon + gập góc', { bg: { color: '#ffe3ec', head: 'same', gradient: ['#ffe3ec', '#e8e3ff'], texture: 'none' }, corner: 'fold', font: 'baloo2',
        header: { text: 'Việc hôm nay', font: 'baloo2', color: '#d6598a', size: 20, align: 'center', style: 'ribbon' }, deco: [{ kind: 'img', src: STAR, pos: 'bl', w: 28, dx: 6, dy: 40, rot: -12 }] }),
      mk('t-kraft', 'Giấy kraft + tem', { bg: { color: '#d9b98a', head: 'same', gradient: null, texture: 'kraft' }, ink: '#3b2a18', lines: { kind: 'ruled', color: 'rgba(80,50,20,.3)', step: 26 },
        header: { text: 'GHI NHỚ', font: 'bevietnam', color: '#7a2e1a', size: 17, align: 'right', style: 'stamp' }, edge: 'torn-bottom' }),
      mk('t-night', 'Đêm', { dark: true, ink: '#eaeaf5', bg: { color: '#262a3a', head: '#1f2230', gradient: null, texture: 'speckle' }, lines: { kind: 'ruled', color: 'rgba(200,210,255,.18)', step: 26 },
        header: { text: 'Đêm', font: 'itim', color: '#cdd6ff', size: 20, align: 'left', style: 'plain' }, deco: [{ kind: 'washi', color: '#8fb4ff', pattern: 'dots', pos: 'tr', w: 70, rot: 8 }] })
    ] };
    document.getElementById('gInfo').textContent = '(catalog giả — chưa có assets/paper/catalog.js)';
  }

  var SAMPLE = 'Đi chợ: rau, trứng\nHọp nhóm 9h sáng\nGọi mẹ lúc 20h\nỔn định ổ cứng ẩn quả ơ ư\nMua sách giáo khoa';
  var ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var ICON_DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="dots" d="M5 12h.01M12 12h.01M19 12h.01"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var FMT = "<div class=\"fmtwrap\"><div class=\"fmt\" role=\"toolbar\"><button class=\"fb\" type=\"button\" data-cmd=\"bold\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z\"/></svg></button><button class=\"fb\" type=\"button\" data-cmd=\"italic\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 5h8M6 19h8M15 5L9 19\"/></svg></button><button class=\"fb\" type=\"button\" data-cmd=\"underline\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 4v7a5 5 0 0 0 10 0V4M5 20h14\"/></svg></button><button class=\"fb\" type=\"button\" data-cmd=\"strikeThrough\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 12h16M16 7.5C15.5 5.8 14 5 12 5c-2.4 0-4 1.2-4 3M8 16.5c.7 1.7 2.3 2.5 4.3 2.5 2.4 0 4.2-1.2 4.2-3\"/></svg></button><button class=\"fb\" type=\"button\" data-cmd=\"insertUnorderedList\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 6h11M9 12h11M9 18h11\"/><path class=\"dots\" d=\"M4 6h.01M4 12h.01M4 18h.01\"/></svg></button><button class=\"fb\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 11-6 6v3h9l3-3\"/><path d=\"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4\"/></svg><i class=\"hlbar\"></i></button><button class=\"fb\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg></button><button class=\"fb\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path class=\"shackle\" d=\"M8 11V8a4 4 0 0 1 8 0v3\"/></svg></button></div></div>";

  function fakeNote(def) {
    var root = document.createElement('div');
    root.className = 'gn-root';
    root.innerHTML = '<div class="note"><div class="paper-layer" id="paperLayer" aria-hidden="true"></div>' +
      '<header class="topbar"><button class="ib" type="button">' + ICON_PLUS + '</button><div class="paper-head" id="paperHead" aria-hidden="true"></div><span class="spacer"></span>' +
      '<button class="ib" type="button">' + ICON_DOTS + '</button><button class="ib" type="button">' + ICON_X + '</button></header>' +
      '<div class="lower"><main class="body"><div id="editor" contenteditable="true" spellcheck="false"></div></main>' + FMT + '</div></div>';
    var ed = root.querySelector('#editor');
    SAMPLE.split('\n').forEach(function (t) { var d = document.createElement('div'); d.textContent = t; ed.appendChild(d); });
    return root;
  }

  var grid = document.getElementById('gGrid'), thumbs = document.getElementById('gThumbs');
  var optTilt = document.getElementById('optTilt'), optDeco = document.getElementById('optDeco'), optGlass = document.getElementById('optGlass');
  var optZoom = document.getElementById('optZoom'), optFont = document.getElementById('optFont'), optBar = document.getElementById('optBar');
  P.fonts().forEach(function (f) { var o = document.createElement('option'); o.value = f.id; o.textContent = f.name; optFont.appendChild(o); });

  function render() {
    grid.textContent = ''; thumbs.textContent = '';
    P.list().forEach(function (def) {
      var cell = document.createElement('div'); cell.className = 'gcell';
      var root = fakeNote(def);
      root.dataset.color = def.noteColor || 'yellow';
      root.classList.toggle('glass', optGlass.checked);
      root.querySelector('#editor').style.setProperty('--zoom', optZoom.value);
      P.apply(root, def.id, { tilt: optTilt.checked, deco: optDeco.checked, font: optFont.value || undefined });
      if (/^plain-/.test(def.id)) { // giả lập body[data-color] của note.css
        var cs = root.style, bgc = def.bg || {};
        var hx = function (h) { h = String(h || '#fff').replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(','); };
        cs.setProperty('--bg-rgb', hx(bgc.color)); cs.setProperty('--head-rgb', hx(bgc.head)); cs.setProperty('--fg', def.ink || '#1f1f1f'); cs.setProperty('--fg-rgb', hx(def.ink || '#1f1f1f'));
        cs.background = 'rgb(' + hx(bgc.color) + ')';
      }
      var nm = document.createElement('div'); nm.className = 'gname'; nm.textContent = def.name + ' · ' + def.id;
      cell.appendChild(root); cell.appendChild(nm); grid.appendChild(cell);
      thumbs.appendChild(P.thumb(def.id, { tilt: optTilt.checked, deco: optDeco.checked, font: optFont.value || undefined }));
    });
  }
  [optTilt, optDeco, optGlass, optZoom, optFont].forEach(function (e) { e.addEventListener('change', render); });
  // giả lập trạng thái rê chuột/đang gõ: thanh trên + thanh định dạng hiện đủ, trang trí góc dưới mờ như thật
  optBar.addEventListener('change', function () { document.body.classList.toggle('editing', optBar.checked); document.body.classList.toggle('show-bar', optBar.checked); });
  if (/[?&]bar=1/.test(location.search)) { optBar.checked = true; optBar.dispatchEvent(new Event('change')); }
  render();

  // thử đổi qua lại nhiều lần: không rò rỉ phần tử
  window.__stress = function (n) {
    var r = grid.querySelector('.gn-root'), ids = P.list().map(function (d) { return d.id; }), t0 = performance.now();
    for (var i = 0; i < (n || 500); i++) P.apply(r, ids[i % ids.length], {});
    return { ms: performance.now() - t0, layerKids: r.querySelector('#paperLayer').children.length, headKids: r.querySelector('#paperHead').children.length };
  };
})();
