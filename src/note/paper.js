/* Mochi Notes — engine mẫu giấy: window.MochiPaper (thuần, không IPC). Xem docs/rooms/paper/DESIGN.md mục 2.2 */
(function () {
  'use strict';

  var GROUPS = [
    { id: 'plain', name: 'Trơn' }, { id: 'cute', name: 'Dễ thương' }, { id: 'student', name: 'Học sinh' },
    { id: 'minimal', name: 'Tối giản' }, { id: 'office', name: 'Văn phòng' }, { id: 'season', name: 'Mùa & lễ' }
  ];
  var SYS = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
  var FONTS = [
    { id: 'itim', name: 'Itim', family: '"Mochi Itim", "Segoe UI", system-ui, sans-serif' },
    { id: 'pangolin', name: 'Pangolin', family: '"Mochi Pangolin", "Segoe UI", system-ui, sans-serif' },
    { id: 'mali', name: 'Mali', family: '"Mochi Mali", "Segoe UI", system-ui, sans-serif' },
    { id: 'nunito', name: 'Nunito', family: '"Mochi Nunito", "Segoe UI", system-ui, sans-serif' },
    { id: 'baloo2', name: 'Baloo 2', family: '"Mochi Baloo 2", "Segoe UI", system-ui, sans-serif' },
    { id: 'bevietnam', name: 'Be Vietnam Pro', family: '"Mochi Be Vietnam Pro", "Segoe UI", system-ui, sans-serif' },
    { id: 'system', name: 'Hệ thống', family: SYS }
  ];

  /* ---------- tiện ích tất định ---------- */
  function hash(s) { // FNV-1a
    s = String(s); var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function r1(n) { return Math.round(n * 10) / 10; }

  function parseColor(s) {
    if (!s || typeof s !== 'string') return null;
    s = s.trim();
    var m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      if (p.length < 3 || p.some(isNaN)) return null;
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    return null;
  }
  function trip(c) { return Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]); }
  function rgba(c, a) { return 'rgba(' + trip(c) + ',' + r1(a) + ')'; }
  function luma(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }

  function svgUri(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }

  /* ---------- danh mục ---------- */
  var cacheSrc = null, cacheList = [], cacheMap = {};
  function sync() {
    var cat = window.MochiPaperCatalog, src = cat && cat.papers;
    if (src === cacheSrc) return;
    cacheSrc = src; cacheList = []; cacheMap = Object.create(null);
    if (Array.isArray(src)) {
      src.forEach(function (p) { if (p && typeof p.id === 'string') { cacheList.push(p); cacheMap[p.id] = p; } });
    }
  }
  function list() { sync(); return cacheList.slice(); }
  function get(id) { sync(); return (typeof id === 'string' && cacheMap[id]) || null; }
  function groups() { return GROUPS.map(function (g) { return { id: g.id, name: g.name }; }); }
  function fonts() { return FONTS.map(function (f) { return { id: f.id, name: f.name, family: f.family }; }); }
  function fontFamily(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i].family;
    return null;
  }
  function assetUrl(rel) {
    rel = String(rel || '');
    if (/^(data:|https?:|\/)/i.test(rel)) return rel;
    return MochiPaper.assetBase + rel;
  }
  function isPlain(id, def) { return !def || /^plain-/.test(String(id)); }

  /* ---------- hình nền sinh bằng SVG data: URI (tất định theo seed) ---------- */
  var texCache = Object.create(null);
  function texture(kind, seed, ink, dark) {
    var key = kind + '|' + seed + '|' + ink + '|' + dark;
    if (texCache[key]) return texCache[key];
    var c = parseColor(ink) || [60, 50, 40, 1], r = rng(hash(seed + kind)), out = null, i, S;
    if (kind === 'speckle') {
      S = 240;
      var d = '';
      for (i = 0; i < 54; i++) {
        var big = i < 5;
        var rx = big ? 1.6 + r() * 1.4 : 0.5 + r() * 1.2, ry = rx * (0.55 + r() * 0.6);
        var x = 8 + r() * (S - 16), y = 8 + r() * (S - 16), a = big ? 0.28 + r() * 0.2 : 0.22 + r() * 0.4;
        d += '<ellipse cx="' + r1(x) + '" cy="' + r1(y) + '" rx="' + r1(rx) + '" ry="' + r1(ry) + '" transform="rotate(' + Math.round(r() * 180) + ' ' + r1(x) + ' ' + r1(y) + ')" fill="rgba(' + trip(c) + ',' + r1(a) + ')"/>';
      }
      out = { uri: svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="' + S + '" height="' + S + '">' + d + '</svg>'), size: S };
    } else if (kind === 'grain' || kind === 'kraft' || kind === 'linen') {
      S = 200;
      var tone = dark ? '1 1 1' : (kind === 'kraft' ? '0.35 0.22 0.1' : '0.4 0.33 0.25');
      var t = tone.split(' ');
      var amp = kind === 'kraft' ? 0.34 : (kind === 'linen' ? 0.14 : 0.2);
      var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + S + '" height="' + S + '"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="' + (kind === 'kraft' ? 0.55 : 0.85) + '" numOctaves="2" seed="' + (hash(seed) % 997) + '" stitchTiles="stitch"/>' +
        '<feColorMatrix values="0 0 0 0 ' + t[0] + ' 0 0 0 0 ' + t[1] + ' 0 0 0 0 ' + t[2] + ' ' + amp * 2 + ' 0 0 0 ' + (-amp * 0.8) + '"/></filter><rect width="100%" height="100%" filter="url(#n)"/>';
      if (kind === 'kraft') {
        for (i = 0; i < 34; i++) {
          var fx = r() * S, fy = r() * S, l = 6 + r() * 14, ang = r() * Math.PI;
          s += '<path d="M' + r1(fx) + ' ' + r1(fy) + 'l' + r1(Math.cos(ang) * l) + ' ' + r1(Math.sin(ang) * l) + '" stroke="rgba(' + (dark ? '255,255,255' : '90,55,25') + ',' + r1(0.1 + r() * 0.14) + ')" stroke-width=".7" fill="none"/>';
        }
      }
      if (kind === 'linen') {
        for (i = 0; i < S; i += 4) {
          var ca = dark ? '255,255,255' : '120,100,70';
          s += '<rect x="0" y="' + i + '" width="' + S + '" height="1" fill="rgba(' + ca + ',.07)"/><rect x="' + i + '" y="0" width="1" height="' + S + '" fill="rgba(' + ca + ',.06)"/>';
        }
      }
      out = { uri: svgUri(s + '</svg>'), size: S };
    }
    if (out) texCache[key] = out;
    return out;
  }

  var edgeCache = Object.create(null);
  function tornMask(which, seed) {
    var key = which + seed;
    if (edgeCache[key]) return edgeCache[key];
    var r = rng(hash(seed + 'edge')), W = 72, H = 6, pts = ['0,' + H], y0 = 2.5, x = 0, first = true;
    pts.push('0,' + y0);
    while (x < W - 4) {
      x += 2 + r() * 4; if (x > W - 3) x = W - 3;
      pts.push(r1(x) + ',' + r1(0.4 + r() * 4));
    }
    pts.push(W + ',' + y0, W + ',' + H);
    if (which === 'bottom') {
      pts = pts.map(function (p) { var a = p.split(','); return a[0] + ',' + r1(H - parseFloat(a[1])); });
    }
    void first;
    var uri = svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><polygon points="' + pts.join(' ') + '" fill="#000"/></svg>');
    var m = which === 'top'
      ? 'url("' + uri + '") 0 0/' + W + 'px ' + H + 'px repeat-x, linear-gradient(#000,#000) 0 ' + H + 'px/100% calc(100% - ' + H + 'px) no-repeat'
      : 'url("' + uri + '") 0 100%/' + W + 'px ' + H + 'px repeat-x, linear-gradient(#000,#000) 0 0/100% calc(100% - ' + H + 'px) no-repeat';
    edgeCache[key] = m;
    return m;
  }

  /* ---------- áp mẫu ---------- */
  var PROPS = ['--bg-rgb', '--head-rgb', '--fg', '--fg-rgb', '--ink', '--paper-font', '--step-base', '--line', '--line-soft', '--margin-color',
    '--tr-w', '--tr-h', '--paper-bg', '--topbar-h', '--head-font', '--head-color', '--head-size', '--head-ink', '--paper-mask', '--paper-clip'];
  var CLASSES = ['has-paper', 'paper-dark', 'paper-hashead', 'paper-edge'];

  function clearRoot(root, headEl, layerEl) {
    PROPS.forEach(function (p) { root.style.removeProperty(p); });
    CLASSES.forEach(function (c) { root.classList.remove(c); });
    delete root.dataset.lines; delete root.dataset.margin; delete root.dataset.edge; delete root.dataset.corner; delete root.dataset.headStyle; delete root.dataset.tr;
    if (headEl) headEl.textContent = '';
    if (layerEl) layerEl.textContent = '';
  }

  function tiltOf(seed, lo, hi) {
    var r = rng(hash(seed)), mag = lo + r() * (hi - lo);
    return (r() < 0.5 ? -1 : 1) * mag;
  }

  function washiNode(d, seed, tilt, idx) {
    var el = document.createElement('div');
    el.className = 'paper-washi';
    var w = Math.max(20, +d.w || 80), h = Math.max(10, +d.h || Math.round(Math.min(26, w * 0.28)));
    var col = parseColor(d.color) || [244, 182, 194, 1];
    var pat = d.pattern || 'plain', hi = 'rgba(255,255,255,.4)', base = rgba(col, 0.78), bg;
    if (pat === 'stripe') bg = 'repeating-linear-gradient(135deg,' + base + ' 0 6px,' + rgba(mix(col, [255, 255, 255, 1], 0.55), 0.78) + ' 6px 12px)';
    else if (pat === 'dots') bg = 'radial-gradient(circle,' + hi + ' 1.6px,transparent 2px) 0 0/9px 9px,' + base;
    else if (pat === 'grid') bg = 'linear-gradient(' + hi + ' 1px,transparent 1px) 0 0/7px 7px,linear-gradient(90deg,' + hi + ' 1px,transparent 1px) 0 0/7px 7px,' + base;
    else bg = base;
    el.style.background = bg;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    // mép răng cưa hai đầu
    var pts = ['0 0'], n = Math.max(3, Math.round(h / 4)), rr = rng(hash(seed + 'w' + idx)), i, k = 2.5;
    for (i = 0; i <= n; i++) pts.push((i % 2 ? k + 'px' : '0px') + ' ' + r1(h * i / n) + 'px');
    pts.push('100% 100%');
    for (i = n; i >= 0; i--) pts.push('calc(100% - ' + (i % 2 ? k : 0) + 'px) ' + r1(h * i / n) + 'px');
    void rr;
    el.style.clipPath = 'polygon(' + pts.join(',') + ')';
    return { el: el, w: w, h: h };
  }

  function place(el, pos, dx, dy, rot, w) {
    var s = el.style, tf = '';
    dx = +dx || 0; dy = +dy || 0;
    s.position = 'absolute';
    el.setAttribute('data-pos', pos || 'tr');
    switch (pos) {
      case 'tl': s.left = dx + 'px'; s.top = dy + 'px'; break;
      case 'bl': s.left = dx + 'px'; s.bottom = dy + 'px'; break;
      case 'br': s.right = dx + 'px'; s.bottom = dy + 'px'; break;
      case 'top': s.left = 'calc(50% + ' + dx + 'px)'; s.top = dy + 'px'; tf = 'translateX(-50%) '; break;
      case 'bottom': s.left = 'calc(50% + ' + dx + 'px)'; s.bottom = dy + 'px'; tf = 'translateX(-50%) '; break;
      case 'left': s.left = dx + 'px'; s.top = 'calc(50% + ' + dy + 'px)'; tf = 'translateY(-50%) '; break;
      case 'right': s.right = dx + 'px'; s.top = 'calc(50% + ' + dy + 'px)'; tf = 'translateY(-50%) '; break;
      default: s.right = dx + 'px'; s.top = 'calc(' + dy + 'px + var(--tb-r, 0px))'; // tr: hạ xuống dưới hàng nút thanh trên
    }
    if (w && el.tagName === 'IMG') s.width = w + 'px';
    if (rot) tf += 'rotate(' + r1(rot) + 'deg)';
    if (tf) s.transform = tf;
  }

  /* vùng chữ tránh trang trí 'tr': đo hộp bao các hình 'tr' (rộng = lề phải + w, cao = dy + h so với đầu vùng soạn) */
  function reserveTr(root, items) {
    if (!root || !items.length) return;
    function upd() {
      var W = 0, H = 0, main = items[0];
      items.forEach(function (it) { if (it.w > main.w) main = it; }); // chỉ chừa chỗ cho hình lớn nhất; hình nhỏ đi kèm chấp nhận đè nhẹ
      [main].forEach(function (it) {
        var h = it.el.naturalWidth > 0 ? it.w * it.el.naturalHeight / it.el.naturalWidth : it.w;
        W = Math.max(W, it.dx + it.w + 6 - 12); H = Math.max(H, it.dy - 2 + h + 2);
      });
      root.style.setProperty('--tr-w', Math.max(0, Math.round(W)) + 'px');
      root.style.setProperty('--tr-h', Math.max(0, Math.round(H)) + 'px');
      root.dataset.tr = '1';
    }
    upd();
    items.forEach(function (it) { if (!(it.el.naturalWidth > 0)) it.el.addEventListener('load', upd); });
  }

  function buildLayer(layerEl, def, o, root) {
    var trItems = [];
    var seed = def.id, deco = Array.isArray(def.deco) ? def.deco : [];
    if (o.deco !== false) {
      deco.forEach(function (d, i) {
        if (!d || typeof d !== 'object') return;
        var el = null, w = +d.w || 48, rot = (+d.rot || 0);
        if (o.tilt) rot += tiltOf(seed + 'd' + i, 2, 4);
        if (d.kind === 'img' && d.src) {
          el = document.createElement('img');
          el.alt = ''; el.draggable = false; el.decoding = 'async';
          el.src = assetUrl(d.src);
          el.className = 'paper-deco';
          place(el, d.pos, d.dx, d.dy, rot, w);
          if ((d.pos || 'tr') === 'tr') trItems.push({ el: el, w: w, dx: +d.dx || 0, dy: +d.dy || 0 });
        } else if (d.kind === 'washi') {
          var wn = washiNode(d, seed, o.tilt, i);
          el = wn.el;
          place(el, d.pos || 'top', d.dx, d.dy, rot, 0);
        }
        if (el) layerEl.appendChild(el);
      });
      reserveTr(root, trItems);
    }
    if (def.corner === 'fold') {
      var f = document.createElement('div');
      f.className = 'paper-fold';
      layerEl.appendChild(f);
    }
  }

  function buildHead(headEl, hd, def, o) {
    var t = document.createElement('span');
    t.className = 'ph-t ph-' + (hd.style || 'plain');
    t.textContent = String(hd.text || '');
    if (o.tilt) t.style.transform = 'rotate(' + r1(tiltOf(def.id + 'h', 1.2, 2.4)) + 'deg)';
    else if (hd.style === 'stamp') t.style.transform = 'rotate(-2deg)';
    headEl.appendChild(t);
    var al = hd.align === 'center' ? 'center' : (hd.align === 'right' ? 'flex-end' : 'flex-start');
    headEl.style.justifyContent = al;
  }

  function apply(root, paperId, opts) {
    if (!root || !root.style) return null;
    var o = opts || {};
    var headEl = o.headEl || root.querySelector('#paperHead, .paper-head');
    var layerEl = o.layerEl || root.querySelector('#paperLayer, .paper-layer');
    var def = get(paperId);
    clearRoot(root, headEl, layerEl);
    if (headEl) headEl.style.justifyContent = '';
    root.dataset.paper = String(paperId == null ? '' : paperId);
    if (isPlain(paperId, def)) return def; // giao diện 0.1 nguyên vẹn

    var st = root.style, bg = def.bg || {}, ln = def.lines || {}, hd = def.header;
    var dark = !!def.dark;
    var c1 = parseColor(bg.color) || (dark ? [58, 58, 58, 1] : [255, 247, 209, 1]);
    var grad = Array.isArray(bg.gradient) && bg.gradient.length >= 2 ? bg.gradient.map(parseColor) : null;
    if (grad && grad.some(function (g) { return !g; })) grad = null;
    var mid = grad ? mix(grad[0], grad[grad.length - 1], 0.5) : c1;
    var headSame = !bg.head || bg.head === 'same';
    var ch = headSame ? null : parseColor(bg.head);
    if (ch && ch[0] === c1[0] && ch[1] === c1[1] && ch[2] === c1[2] && !grad) ch = null;
    var ink = parseColor(def.ink) || (dark ? [242, 242, 242, 1] : [31, 31, 31, 1]);
    var hasHead = !!(hd && hd.text);
    var topH = hasHead ? Math.max(40, Math.round((+hd.size || 20) + 18)) : 32;

    root.classList.add('has-paper');
    if (dark) root.classList.add('paper-dark');
    if (hasHead) root.classList.add('paper-hashead');
    st.setProperty('--bg-rgb', trip(mid));
    st.setProperty('--head-rgb', trip(ch || mid));
    st.setProperty('--fg', rgba(ink, ink[3]).replace(/^rgba\(([^)]*),1\)$/, 'rgb($1)'));
    st.setProperty('--fg-rgb', trip(ink));
    st.setProperty('--ink', st.getPropertyValue('--fg'));
    st.setProperty('--topbar-h', topH + 'px');

    // font
    var fam = (o.font && fontFamily(o.font)) || fontFamily(def.font) || SYS;
    st.setProperty('--paper-font', fam);

    // nền (vẽ trên .note: liền mạch giữa thanh trên và phần dưới)
    var layers = [];
    if (ch) { var hc = trip(ch); layers.push('linear-gradient(rgb(' + hc + '),rgb(' + hc + ')) 0 0/100% var(--topbar-h) no-repeat'); }
    var tx = bg.texture && bg.texture !== 'none' ? texture(bg.texture, def.id, def.ink || '#3a2e2a', dark) : null;
    if (tx) layers.push('url("' + tx.uri + '") 0 0/' + tx.size + 'px ' + tx.size + 'px repeat');
    if (grad) {
      var stops = grad.map(function (g, i) { return 'rgb(' + trip(g) + ') ' + Math.round(i * 100 / (grad.length - 1)) + '%'; });
      layers.push('linear-gradient(180deg,' + stops.join(',') + ')');
    } else {
      layers.push('rgb(' + trip(c1) + ')');
    }
    st.setProperty('--paper-bg', layers.join(','));

    // dòng kẻ
    var kind = ln.kind;
    var step = Math.max(14, Math.min(60, +ln.step || 26));
    st.setProperty('--step-base', step + 'px');
    if (kind && kind !== 'none') {
      var lc = parseColor(ln.color) || [ink[0], ink[1], ink[2], 0.25];
      st.setProperty('--line', rgba(lc, lc[3]));
      st.setProperty('--line-soft', rgba(lc, lc[3] * 0.55));
      var mc = ln.margin ? parseColor(ln.margin) : null;
      if (kind === 'margin-ruled' && !mc) mc = [224, 122, 122, 1];
      if (mc) st.setProperty('--margin-color', rgba(mc, mc[3] == null ? 1 : mc[3]));
      root.dataset.lines = kind === 'margin-ruled' ? 'ruled' : kind;
      if (kind === 'margin-ruled') root.dataset.margin = '1';
      if (mc) root.dataset.margin = '1';
    }

    // tiêu đề
    if (hasHead && headEl) {
      var hcol = parseColor(hd.color) || ink;
      st.setProperty('--head-font', fontFamily(hd.font) || fam);
      st.setProperty('--head-color', 'rgb(' + trip(hcol) + ')');
      st.setProperty('--head-ink', luma(hcol) > 0.6 ? '#2b2420' : '#ffffff');
      st.setProperty('--head-size', (+hd.size || 20) + 'px');
      root.dataset.headStyle = hd.style || 'plain';
      buildHead(headEl, hd, def, o);
    }

    // mép / góc
    var edge = def.edge, corner = def.corner;
    if (edge === 'torn-top') { st.setProperty('--paper-mask', tornMask('top', def.id)); root.dataset.edge = edge; root.classList.add('paper-edge'); }
    else if (edge === 'torn-bottom') { st.setProperty('--paper-mask', tornMask('bottom', def.id)); root.dataset.edge = edge; root.classList.add('paper-edge'); }
    if (corner === 'fold') {
      st.setProperty('--paper-clip', 'polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%)');
      root.dataset.corner = 'fold'; root.classList.add('paper-edge');
    }

    if (layerEl) buildLayer(layerEl, def, o, root);
    return def;
  }

  /* ---------- hình xem trước ---------- */
  var SAMPLE = ['Đi chợ: rau, trứng', 'Họp nhóm 9h sáng', 'Gọi mẹ lúc 20h'];
  function thumb(paperId, opts) {
    var o = opts || {}, size = +o.size || 84, W = 200;
    var def = get(paperId);
    var wrap = document.createElement('div');
    wrap.className = 'ppthumb';
    wrap.style.width = wrap.style.height = size + 'px';
    wrap.title = def ? def.name : String(paperId || '');
    var inner = document.createElement('div');
    inner.className = 'ppt-in';
    inner.style.width = inner.style.height = W + 'px';
    inner.style.transform = 'scale(' + r1(size / W * 1000) / 1000 + ')';
    var note = document.createElement('div'); note.className = 'note ppt-note';
    var layer = document.createElement('div'); layer.className = 'paper-layer';
    var top = document.createElement('header'); top.className = 'topbar';
    var head = document.createElement('div'); head.className = 'paper-head';
    top.appendChild(head);
    var lower = document.createElement('div'); lower.className = 'lower';
    var ed = document.createElement('div'); ed.className = 'ppt-ed';
    SAMPLE.forEach(function (t) { var d = document.createElement('div'); d.textContent = t; ed.appendChild(d); });
    lower.appendChild(ed);
    note.appendChild(layer); note.appendChild(top); note.appendChild(lower);
    inner.appendChild(note); wrap.appendChild(inner);
    if (isPlain(paperId, def)) {
      var bgc = def && parseColor(def.bg && def.bg.color), hc = def && parseColor(def.bg && def.bg.head), ik = def && parseColor(def.ink);
      var s = inner.style;
      s.setProperty('--bg-rgb', trip(bgc || [255, 247, 209, 1]));
      s.setProperty('--head-rgb', trip(hc || bgc || [255, 242, 171, 1]));
      s.setProperty('--fg', ik ? 'rgb(' + trip(ik) + ')' : '#1f1f1f');
      s.setProperty('--fg-rgb', ik ? trip(ik) : '31,31,31');
      inner.classList.add('ppt-plain');
      if (def && def.dark) inner.classList.add('paper-dark');
    } else {
      apply(inner, paperId, { font: o.font, tilt: o.tilt, deco: o.deco, headEl: head, layerEl: layer });
    }
    return wrap;
  }

  var MochiPaper = {
    assetBase: '../../assets/paper/',
    list: list, get: get, groups: groups, fonts: fonts, apply: apply, thumb: thumb, assetUrl: assetUrl
  };
  window.MochiPaper = MochiPaper;
})();
