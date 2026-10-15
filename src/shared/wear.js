/* MochiWear — mặc áo cho bé "thật": tô lại vùng áo khoác của từng khung hình theo màu + hoạ tiết món đồ,
 * giữ nguyên đường viền và nếp vải (sáng/tối của ảnh gốc). Dùng chung cho bé trên desktop và tủ đồ.
 *
 *   const W = MochiWear.create(packBaseUrl)          // url thư mục gói hình, có '/' cuối
 *   W.setStyle(styleOrNull)                          // style = { light, dark, pattern, pc, shirt?, tie? }
 *   W.apply(img, src) -> img | canvas                // src = đường dẫn khung trong gói, vd 'idle/normal/loop/0001_160.png'
 *   W.head(src) -> [dx, dy, s?]                      // đầu lệch so với khung đứng (px khung 400) để mũ kính bám theo; s = tỉ lệ đầu (khung nghiêng, mặc định 1)
 *   W.onReady(fn)                                    // gọi khi có thêm mặt nạ vừa nạp xong (để vẽ lại)
 *   MochiWear.styleFor(worn, wearData)               // gộp body + outer thành một style
 */
(function () {
  'use strict';

  function hex(c) {
    c = String(c || '#000').replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
    var n = parseInt(c, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function frac(x) { return x - Math.floor(x); }
  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

  // ---- hoạ tiết: (u, v) toạ độ theo thân bé (gốc = đỉnh đầu khung hiện tại) -> 0..1 độ phủ màu hoạ tiết
  function star(px, py, r) {
    var a = Math.atan2(py, px), d = Math.sqrt(px * px + py * py);
    var k = Math.cos(2.5 * a) * 0.5 + 0.5;         // 5 cánh
    return d < r * (0.45 + 0.55 * k) ? 1 : 0;
  }
  var PATTERNS = {
    none: function () { return 0; },
    stars: function (u, v) {
      var s = 30, row = Math.floor(v / s), off = (row % 2) * s / 2;
      var cx = Math.floor((u + off) / s) * s + s / 2 - off, cy = row * s + s / 2;
      var j = hash(cx, cy);
      if (j < 0.25) return 0;
      return star(u - cx - (j - 0.5) * 8, v - cy, j > 0.8 ? 6 : 4.2);
    },
    dots: function (u, v) {
      var s = 14, row = Math.floor(v / s), off = (row % 2) * s / 2;
      var x = frac((u + off) / s) * s - s / 2, y = frac(v / s) * s - s / 2;
      return x * x + y * y < 9 ? 1 : 0;
    },
    spots: function (u, v) {
      var s = 32, gx = Math.floor(u / s), gy = Math.floor(v / s);
      var j = hash(gx, gy), cx = (gx + 0.3 + j * 0.4) * s, cy = (gy + 0.3 + hash(gy, gx) * 0.4) * s;
      var r = 5 + j * 4, dx = u - cx, dy = v - cy;
      return dx * dx + dy * dy < r * r ? 1 : 0;
    },
    paws: function (u, v) {
      var s = 34, row = Math.floor(v / s), off = (row % 2) * s / 2;
      var x = frac((u + off) / s) * s - s / 2, y = frac(v / s) * s - s / 2;
      if (x * x + (y - 2) * (y - 2) < 18) return 1;
      var t = [[-5, -5], [0, -7.5], [5, -5]];
      for (var i = 0; i < 3; i++) { var dx = x - t[i][0], dy = y - t[i][1]; if (dx * dx + dy * dy < 4.4) return 1; }
      return 0;
    },
    bands: function (u, v) { var b = frac((v - 150) / 46); return b > 0.42 && b < 0.58 ? 1 : 0; },
    sailor: function (u, v) { return v > 150 && v < 168 ? 1 : (Math.abs(Math.abs(u) - 30) < 2.2 && v > 140 && v < 200 ? 1 : 0); },
    knit: function (u, v) {
      var row = Math.floor(v / 10), x = frac(u / 10) * 10, y = frac(v / 10) * 10;
      var z = Math.abs(x - 5);                       // hình chữ V
      return row % 3 === 0 && Math.abs(y - z) < 1.6 ? 1 : 0;
    },
    hem: function (u, v) { return Math.abs(frac(v / 60) - 0.5) < 0.03 ? 0.85 : 0; },
    quilt: function (u, v) { var b = frac(v / 22); return b < 0.12 ? -0.38 : (b > 0.5 && b < 0.62 ? 0.18 : 0); },
    zip: function (u, v) { return Math.abs(u) < 1.6 ? 1 : (Math.abs(u) < 3.2 && frac(v / 5) < 0.4 ? 0.6 : 0); },
    vstripes: function (u, v) { var a = Math.abs(u); return (a > 46 && a < 52) || (a > 56 && a < 60) ? 1 : 0; },
    plaid: function (u, v) {
      var a = Math.abs(frac(u / 24) - 0.5) < 0.05 ? 1 : 0, b = Math.abs(frac(v / 24) - 0.5) < 0.05 ? 1 : 0;
      return a || b ? 0.55 : 0;
    },
    moons: function (u, v) {
      var s = 36, row = Math.floor(v / s), off = (row % 2) * s / 2;
      var x = frac((u + off) / s) * s - s / 2, y = frac(v / s) * s - s / 2;
      var inA = x * x + y * y < 36, inB = (x - 3) * (x - 3) + (y - 2) * (y - 2) < 26;
      if (inA && !inB) return 1;
      var sx = x + 10, sy = y + 10;
      return sx * sx + sy * sy < 2.2 ? 1 : 0;
    }
  };

  function styleFor(worn, data) {
    var items = (data && data.items) || {};
    var b = worn && worn.body ? items[worn.body] : null, o = worn && worn.outer ? items[worn.outer] : null;
    if (!b && !o) return null;
    var jacket = o || b;
    return {
      key: (worn.body || '') + '|' + (worn.outer || ''),
      light: jacket.light, dark: jacket.dark, pattern: jacket.pattern || 'none', pc: jacket.pc || '#ffffff',
      shirt: b ? b.shirt : null, tie: b ? b.tie : null
    };
  }

  function create(baseUrl) {
    var masks = new Map();       // src -> { w, h, bits: Uint8Array (1 áo khoác, 2 sơ mi, 4 cà vạt) } | 'loading' | null
    var CACHE_MAX = 96;          // số khung đã tô màu giữ lại (LRU) — đủ cho vài động tác liền nhau
    var head = null;
    var style = null, cache = new Map();
    var readyFns = [];
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d', { willReadFrequently: true });

    function fire() { readyFns.forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } }); }
    function loadBitmap(url) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(function (b) { return createImageBitmap(b); });
    }
    fetch(baseUrl + 'masks/head.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { head = j || {}; fire(); }).catch(function () { head = {}; });
    // Dáng nghiêng: masks/head_side.json (cùng định dạng, khoá là đường dẫn khung walk_side/...). Chỉ nạp khi gọi loadSide().
    var sideLoaded = false;
    function loadSide() {
      if (sideLoaded) return Promise.resolve();
      sideLoaded = true;
      return fetch(baseUrl + 'masks/head_side.json').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && typeof j === 'object') { head = Object.assign(head || {}, j); fire(); }
        }).catch(function () { /* thiếu head_side.json: pet.js sẽ ẩn đồ đội đầu/cầm tay khi đi nghiêng */ });
    }

    // mặt nạ thu về đúng cỡ khung đang vẽ, nén thành 1 byte/điểm (thay vì ImageData 4 byte cỡ 400px)
    function maskOf(src, w, h) {
      var m = masks.get(src);
      if (m === 'loading' || (m === null && masks.has(src))) return null;
      if (m && m.w === w && m.h === h) return m;
      masks.set(src, 'loading');
      fetch(baseUrl + 'masks/' + src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(function (b) { return createImageBitmap(b, { resizeWidth: w, resizeHeight: h, resizeQuality: 'pixelated' }); })
        .then(function (bmp) {
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
          var d = x.getImageData(0, 0, w, h).data, bits = new Uint8Array(w * h);
          for (var i = 0, j = 0; j < bits.length; i += 4, j++) bits[j] = (d[i] > 127 ? 1 : 0) | (d[i + 1] > 127 ? 2 : 0) | (d[i + 2] > 127 ? 4 : 0);
          try { bmp.close(); } catch (e) { /* bỏ qua */ }
          masks.set(src, { w: w, h: h, bits: bits });
          fire();
        }).catch(function () { masks.set(src, null); });
      return null;
    }

    function recolor(img, mask, src) {
      var w = mask.w, h = mask.h;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      cx.clearRect(0, 0, w, h);
      cx.drawImage(img, 0, 0, w, h);
      var id = cx.getImageData(0, 0, w, h), d = id.data, mb = mask.bits;
      var L = hex(style.light), D = hex(style.dark), PC = hex(style.pc);
      var SH = style.shirt ? hex(style.shirt) : null, TI = style.tie ? hex(style.tie) : null;
      var pat = PATTERNS[style.pattern] || PATTERNS.none;
      var hd = head && head[src] ? head[src] : [0, 0];
      var ox = 200 * w / 400 + hd[0] * w / 400, oy = 91 * h / 400 + hd[1] * h / 400, k = 400 / w;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var bit = mb[y * w + x], i = (y * w + x) * 4;
          if (!bit || d[i + 3] < 8) continue;
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255, c;
          if (bit & 1) {
            // vải áo: độ sáng gốc (khoảng 0.04..0.3) -> dải dark..light, giữ nếp
            var t = Math.min(1, Math.max(0, (lum - 0.03) / 0.24));
            t = Math.pow(t, 0.8);
            c = mix(D, L, t);
            var u = (x - ox) * k, v = (y - oy) * k, p = pat(u, v);
            if (p > 0 && t > 0.12) c = mix(c, mix(mix(PC, D, 0.45), PC, t), Math.min(1, p));
            else if (p < 0) c = mix(c, D, -p);
          } else if ((bit & 2) && SH) {
            c = [SH[0] * lum, SH[1] * lum, SH[2] * lum];
          } else if ((bit & 4) && TI) {
            var s2 = Math.min(1.25, lum / 0.32);
            c = [Math.min(255, TI[0] * s2), Math.min(255, TI[1] * s2), Math.min(255, TI[2] * s2)];
          } else continue;
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
      }
      var out = document.createElement('canvas'); out.width = w; out.height = h;
      out.getContext('2d').putImageData(id, 0, 0);
      return out;
    }

    return {
      setStyle: function (s) {
        var key = s ? s.key + JSON.stringify(s) : '';
        var cur = style ? style.key + JSON.stringify(style) : '';
        if (key === cur) return false;
        style = s; cache = new Map(); return true;
      },
      style: function () { return style; },
      apply: function (img, src) {
        if (!style || !img || !src) return img;
        var c = cache.get(src);
        if (c) { cache.delete(src); cache.set(src, c); return c; }      // LRU: dời lên cuối
        var mask = maskOf(src, img.width, img.height);
        if (!mask) return img;
        try { c = recolor(img, mask, src); } catch (e) { return img; }
        cache.set(src, c);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        return c;
      },
      // nạp trước mặt nạ cho các khung của một hành động vừa nạp (áo tô màu không bị trễ khung đầu)
      prefetch: function (srcs, w, h) { if (!style) return; srcs.forEach(function (s) { maskOf(s, w, h); }); },
      // bỏ mặt nạ + khung đã tô màu của các khung vừa được giải phóng
      forget: function (srcs) { srcs.forEach(function (s) { masks.delete(s); cache.delete(s); }); },
      head: function (src) { return head && head[src] ? head[src] : [0, 0]; },
      hasHead: function (src) { return !!(head && head[src]); },
      loadSide: loadSide,
      onReady: function (fn) { readyFns.push(fn); }
    };
  }

  window.MochiWear = { create: create, styleFor: styleFor, PATTERNS: Object.keys(PATTERNS) };
})();
