/* MochiPins — kim ghim / băng keo / kẹp / nam châm... giữ tờ note trên màn hình. Vẽ bằng SVG, ánh sáng từ trên-trái.
 *   MochiPins.TYPES   [{ id, name, swing }]           swing: hệ số đung đưa khi kéo note (0 = không)
 *   MochiPins.COLORS  { id: { name, c } }
 *   MochiPins.render(type, color, W, H, opts) -> [{ html, x, y, w, h, back? }]   toạ độ theo tờ giấy (px), back = nằm sau giấy
 *   MochiPins.pivot(type, W) -> [x, y]                điểm treo (để giấy xoay quanh khi đung đưa)
 */
(function () {
  'use strict';

  var COLORS = {
    red: { name: 'Đỏ', c: '#e5484d' }, pink: { name: 'Hồng', c: '#ff8fb6' }, coral: { name: 'San hô', c: '#ff8a65' },
    orange: { name: 'Cam', c: '#ffa53d' }, yellow: { name: 'Vàng', c: '#ffd23f' }, mint: { name: 'Bạc hà', c: '#6fd6b0' },
    green: { name: 'Xanh lá', c: '#4fbf6a' }, sky: { name: 'Xanh trời', c: '#6ec6ff' }, blue: { name: 'Xanh dương', c: '#3b82f6' },
    lavender: { name: 'Oải hương', c: '#b9a4ff' }, purple: { name: 'Tím', c: '#8b5cf6' }, black: { name: 'Đen', c: '#2b2b33' },
    white: { name: 'Trắng', c: '#f4f4f6' }, gold: { name: 'Vàng kim', c: '#e2b44a' }, silver: { name: 'Bạc', c: '#c3c9d4' },
    beige: { name: 'Be', c: '#e7d8b6' }, brown: { name: 'Nâu gỗ', c: '#b07a48' }, clear: { name: 'Trong', c: '#e8f4ff' }
  };
  var TYPES = [
    { id: 'none', name: 'Không ghim', swing: 0 },
    { id: 'pushpin', name: 'Đinh ghim tròn', swing: 1 },
    { id: 'thumbtack', name: 'Đinh bấm dẹt', swing: 0.7 },
    { id: 'mappin', name: 'Ghim bản đồ', swing: 1 },
    { id: 'heartpin', name: 'Ghim trái tim', swing: 1 },
    { id: 'starpin', name: 'Ghim ngôi sao', swing: 1 },
    { id: 'flowerpin', name: 'Ghim bông hoa', swing: 1 },
    { id: 'twopins', name: 'Hai đinh ghim', swing: 0.15 },
    { id: 'washi', name: 'Băng keo washi', swing: 0.25 },
    { id: 'washi2', name: 'Washi hai góc', swing: 0.1 },
    { id: 'masking', name: 'Băng keo giấy', swing: 0.1 },
    { id: 'cleartape', name: 'Băng keo trong', swing: 0.2 },
    { id: 'paperclip', name: 'Kẹp giấy', swing: 0.6 },
    { id: 'heartclip', name: 'Kẹp trái tim', swing: 0.6 },
    { id: 'binder', name: 'Kẹp bướm', swing: 0.9 },
    { id: 'bulldog', name: 'Kẹp càng cua', swing: 1 },
    { id: 'clothespin', name: 'Kẹp gỗ', swing: 1 },
    { id: 'magnet', name: 'Nam châm tròn', swing: 0 },
    { id: 'magnet-strawberry', name: 'Nam châm dâu', swing: 0 },
    { id: 'magnet-cat', name: 'Nam châm mèo', swing: 0 },
    { id: 'sticker-heart', name: 'Sticker tim', swing: 0.1 },
    { id: 'sticker-star', name: 'Sticker sao', swing: 0.1 },
    { id: 'waxseal', name: 'Dấu sáp', swing: 0.1 },
    { id: 'safetypin', name: 'Kim băng', swing: 0.8 },
    { id: 'nail', name: 'Đinh + dây treo', swing: 1.2 },
    { id: 'bow', name: 'Nơ ruy băng', swing: 0.9 },
    { id: 'brad', name: 'Đinh tán', swing: 0.5 },
    { id: 'photocorners', name: 'Góc dán ảnh', swing: 0 }
  ];
  var DEF_COLOR = { washi: 'pink', washi2: 'mint', masking: 'beige', cleartape: 'clear', paperclip: 'silver', heartclip: 'pink', binder: 'black',
    bulldog: 'silver', clothespin: 'brown', nail: 'silver', brad: 'gold', waxseal: 'red', photocorners: 'black', 'magnet-strawberry': 'red', 'magnet-cat': 'black' };

  /* ---------- màu ---------- */
  function rgb(h) { h = h.replace('#', ''); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function shade(h, t) { var c = rgb(h); return hex(t >= 0 ? c.map(function (v) { return v + (255 - v) * t; }) : c.map(function (v) { return v * (1 + t); })); }
  function col(id, type) { var k = COLORS[id] ? id : (DEF_COLOR[type] || 'red'); return COLORS[k].c; }

  var uid = 0;
  function U() { return 'p' + (++uid); }
  function svg(w, h, body, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible' + (extra || '') + '">' + body + '</svg>';
  }
  // bóng đổ mềm xuống phải
  function shadowDef(id, dx, dy, blur, op) {
    return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="' + blur + '"/>' +
      '<feOffset dx="' + dx + '" dy="' + dy + '" result="o"/><feComponentTransfer><feFuncA type="linear" slope="' + op + '"/></feComponentTransfer>' +
      '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }
  function gloss(id, base) {
    return '<radialGradient id="' + id + '" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="' + shade(base, 0.75) + '"/>' +
      '<stop offset=".45" stop-color="' + base + '"/><stop offset="1" stop-color="' + shade(base, -0.38) + '"/></radialGradient>';
  }
  function metal(id, base) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(base, 0.6) + '"/>' +
      '<stop offset=".5" stop-color="' + base + '"/><stop offset=".55" stop-color="' + shade(base, -0.25) + '"/><stop offset="1" stop-color="' + shade(base, 0.25) + '"/></linearGradient>';
  }

  /* ---------- ghim đầu tròn / hình (nhìn chéo 3/4, kim cắm xuống giấy) ---------- */
  function headPin(shape, c) {
    var g = U(), s = U(), body;
    var path = {
      ball: '<circle cx="20" cy="15" r="10" fill="url(#' + g + ')"/>',
      heart: '<path d="M20 26 C9 18 7 11 11.5 7.5 C15 5 18.5 6.5 20 10 C21.5 6.5 25 5 28.5 7.5 C33 11 31 18 20 26Z" fill="url(#' + g + ')"/>',
      star: '<path d="M20 3.5 L23.4 11 L31.5 11.8 L25.4 17.2 L27.2 25.2 L20 21 L12.8 25.2 L14.6 17.2 L8.5 11.8 L16.6 11Z" fill="url(#' + g + ')" stroke="' + shade(c, -0.35) + '" stroke-width="1" stroke-linejoin="round"/>',
      flower: '<g fill="url(#' + g + ')">' + [0, 72, 144, 216, 288].map(function (a) {
        var r = a * Math.PI / 180; return '<circle cx="' + (20 + Math.cos(r) * 6.5).toFixed(1) + '" cy="' + (14 + Math.sin(r) * 6.5).toFixed(1) + '" r="5.6"/>';
      }).join('') + '</g><circle cx="20" cy="14" r="4" fill="#ffe27a" stroke="#d9a520" stroke-width=".8"/>'
    }[shape];
    body = '<defs>' + gloss(g, c) + shadowDef(s, 3, 5, 2.2, 0.38) + '</defs>' +
      '<path d="M21 22 L24.5 34" stroke="#9aa3b0" stroke-width="1.6" stroke-linecap="round"/>' +
      '<ellipse cx="25" cy="34.5" rx="3" ry="1.2" fill="rgba(0,0,0,.25)"/>' +
      '<g filter="url(#' + s + ')">' + path + '</g>' +
      '<ellipse cx="16" cy="10" rx="3.2" ry="2.2" fill="rgba(255,255,255,.75)" transform="rotate(-30 16 10)"/>';
    return svg(40, 40, body);
  }
  function thumbtack(c) {
    var g = U(), s = U();
    return svg(36, 36, '<defs>' + gloss(g, c) + shadowDef(s, 1.5, 2.5, 1.4, 0.4) + '</defs>' +
      '<g filter="url(#' + s + ')"><circle cx="18" cy="18" r="12" fill="url(#' + g + ')"/>' +
      '<circle cx="18" cy="18" r="12" fill="none" stroke="' + shade(c, -0.3) + '" stroke-width="1"/>' +
      '<circle cx="18" cy="18" r="7.5" fill="none" stroke="' + shade(c, 0.35) + '" stroke-width="1.6" opacity=".8"/>' +
      '<circle cx="18" cy="18" r="2.2" fill="' + shade(c, -0.25) + '"/></g>' +
      '<path d="M10.5 12.5 A9 9 0 0 1 17 9.4" stroke="rgba(255,255,255,.85)" stroke-width="2" fill="none" stroke-linecap="round"/>');
  }
  function mappin(c) {
    var g = U(), s = U();
    return svg(40, 48, '<defs>' + gloss(g, c) + shadowDef(s, 4, 5, 2.4, 0.35) + '</defs>' +
      '<g transform="rotate(18 20 38)">' +
      '<path d="M20 30 L20 42" stroke="#9aa3b0" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g filter="url(#' + s + ')"><path d="M20 31 C13 22 9 17 9 12 A11 11 0 0 1 31 12 C31 17 27 22 20 31Z" fill="url(#' + g + ')"/></g>' +
      '<circle cx="20" cy="12" r="3.6" fill="#fff"/><ellipse cx="15.5" cy="7.5" rx="3" ry="1.8" fill="rgba(255,255,255,.7)" transform="rotate(-35 15.5 7.5)"/></g>');
  }

  /* ---------- băng keo ---------- */
  function tapeFill(id, c, pattern, op) {
    var light = shade(c, 0.55), p = '';
    if (pattern === 'dots') p = '<pattern id="' + id + '" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="' + c + '"/><circle cx="4.5" cy="4.5" r="1.7" fill="' + light + '"/></pattern>';
    else if (pattern === 'stripe') p = '<pattern id="' + id + '" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="' + c + '"/><rect width="5" height="10" fill="' + light + '"/></pattern>';
    else if (pattern === 'gingham') p = '<pattern id="' + id + '" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="' + light + '"/><rect width="5" height="10" fill="' + c + '" opacity=".55"/><rect width="10" height="5" fill="' + c + '" opacity=".55"/></pattern>';
    else if (pattern === 'flower') p = '<pattern id="' + id + '" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="' + c + '"/><g fill="' + light + '"><circle cx="8" cy="5" r="2"/><circle cx="5" cy="8" r="2"/><circle cx="11" cy="8" r="2"/><circle cx="8" cy="11" r="2"/></g><circle cx="8" cy="8" r="1.4" fill="#ffe27a"/></pattern>';
    else p = '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(c, 0.2) + '"/><stop offset="1" stop-color="' + c + '"/></linearGradient>';
    return { def: p, fill: 'url(#' + id + ')', op: op };
  }
  function serrated(w, h, rough) {
    var pts = [], n = Math.max(4, Math.round(h / 3)), i;
    for (i = 0; i <= n; i++) pts.push(((i % 2 ? rough : 0) + (rough === 3.5 ? Math.random() * 1.2 : 0)).toFixed(1) + ',' + (h * i / n).toFixed(1));
    for (i = n; i >= 0; i--) pts.push((w - (i % 2 ? rough : 0)).toFixed(1) + ',' + (h * i / n).toFixed(1));
    return pts.join(' ');
  }
  function tape(c, w, h, rot, pattern, kind) {
    var id = U(), s = U(), t;
    if (kind === 'masking') t = { def: '<linearGradient id="' + id + '"><stop offset="0" stop-color="' + shade(c, 0.1) + '"/><stop offset="1" stop-color="' + c + '"/></linearGradient>', fill: 'url(#' + id + ')', op: 0.9 };
    else if (kind === 'clear') t = { def: '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.55)"/><stop offset=".5" stop-color="rgba(220,235,250,.25)"/><stop offset="1" stop-color="rgba(255,255,255,.4)"/></linearGradient>', fill: 'url(#' + id + ')', op: 1 };
    else t = tapeFill(id, c, pattern, 0.82);
    var body = '<defs>' + t.def + shadowDef(s, 0, 1.5, 1, 0.22) + '</defs><g transform="rotate(' + rot + ' ' + w / 2 + ' ' + h / 2 + ')" filter="url(#' + s + ')">' +
      '<polygon points="' + serrated(w, h, kind === 'masking' ? 3.5 : 2.4) + '" fill="' + t.fill + '" opacity="' + t.op + '"/>' +
      (kind === 'clear' ? '<rect x="4" y="' + (h * 0.22) + '" width="' + (w - 8) + '" height="2" fill="rgba(255,255,255,.8)"/>' : '<rect x="3" y="1" width="' + (w - 6) + '" height="' + (h * 0.3) + '" fill="rgba(255,255,255,.18)"/>') +
      '</g>';
    return svg(w, h, body);
  }

  /* ---------- kẹp ---------- */
  function paperclip(c, heart) {
    var g = U(), s = U();
    var d = heart
      ? 'M15 46 L15 18 C15 10 6 8 6 15 C6 20 15 24 15 30 M15 30 C15 24 24 20 24 15 C24 8 15 10 15 18'
      : 'M11 44 L11 12 A5.5 5.5 0 0 1 22 12 L22 40 A8 8 0 0 1 6 40 L6 16';
    return svg(30, 52, '<defs>' + metal(g, c) + shadowDef(s, 2, 2.5, 1.2, 0.35) + '</defs><g filter="url(#' + s + ')">' +
      '<path d="' + d + '" fill="none" stroke="' + shade(c, -0.35) + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="url(#' + g + ')" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>');
  }
  function binder(c) {
    var g = U(), m = U(), s = U();
    return svg(54, 46, '<defs>' + gloss(g, c) + metal(m, '#c8ced8') + shadowDef(s, 2, 3, 1.6, 0.38) + '</defs><g filter="url(#' + s + ')">' +
      '<path d="M15 20 L10 4 Q9 1 12 1 L42 1 Q45 1 44 4 L39 20" fill="none" stroke="url(#' + m + ')" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M8 18 L46 18 L50 40 Q50 44 46 44 L8 44 Q4 44 4 40 Z" fill="url(#' + g + ')"/>' +
      '<path d="M8 18 L46 18 L47 23 L7 23Z" fill="rgba(255,255,255,.25)"/></g>');
  }
  function bulldog(c) {
    var g = U(), s = U();
    return svg(56, 50, '<defs>' + metal(g, c) + shadowDef(s, 2, 3, 1.6, 0.38) + '</defs><g filter="url(#' + s + ')">' +
      '<rect x="6" y="6" width="44" height="10" rx="5" fill="url(#' + g + ')" stroke="' + shade(c, -0.4) + '" stroke-width="1"/>' +
      '<path d="M8 14 L48 14 L46 44 Q46 47 43 47 L13 47 Q10 47 10 44Z" fill="url(#' + g + ')" stroke="' + shade(c, -0.4) + '" stroke-width="1"/>' +
      '<circle cx="28" cy="27" r="4.5" fill="' + shade(c, -0.45) + '"/><circle cx="28" cy="27" r="3" fill="rgba(0,0,0,.35)"/></g>');
  }
  function clothespin(c) {
    var g = U(), s = U();
    return svg(24, 64, '<defs><linearGradient id="' + g + '" x1="0" x2="1"><stop offset="0" stop-color="' + shade(c, 0.25) + '"/><stop offset="1" stop-color="' + shade(c, -0.2) + '"/></linearGradient>' + shadowDef(s, 2, 3, 1.4, 0.35) + '</defs>' +
      '<g filter="url(#' + s + ')"><path d="M4 2 L11 2 L11 62 L6 62 Q4 62 4 58Z" fill="url(#' + g + ')"/><path d="M13 2 L20 2 L20 58 Q20 62 18 62 L13 62Z" fill="url(#' + g + ')"/>' +
      '<rect x="2" y="22" width="20" height="7" rx="2" fill="#c9ced8" stroke="#8a919c" stroke-width=".8"/>' +
      '<path d="M6 8 L6 18 M17 8 L17 18" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/></g>');
  }
  function magnet(c, shape) {
    var g = U(), s = U(), b;
    if (shape === 'strawberry') {
      b = '<path d="M24 44 C10 36 7 22 12 16 C16 11 32 11 36 16 C41 22 38 36 24 44Z" fill="url(#' + g + ')"/>' +
        '<g fill="#ffe8a8">' + [[17, 22], [24, 20], [31, 22], [20, 29], [28, 29], [24, 36]].map(function (p) { return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.1" ry="1.6"/>'; }).join('') + '</g>' +
        '<path d="M14 15 L19 9 L24 13 L29 9 L34 15 Q24 19 14 15Z" fill="#4fbf6a" stroke="#2e8a45" stroke-width=".8"/>';
    } else if (shape === 'cat') {
      b = '<path d="M9 18 L11 4 L19 11 L29 11 L37 4 L39 18 C41 32 34 42 24 42 C14 42 7 32 9 18Z" fill="url(#' + g + ')"/>' +
        '<ellipse cx="18" cy="24" rx="2.4" ry="3" fill="#ffe27a"/><ellipse cx="30" cy="24" rx="2.4" ry="3" fill="#ffe27a"/>' +
        '<path d="M22 30 Q24 32 26 30" stroke="#ffb3c4" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    } else {
      b = '<circle cx="24" cy="24" r="16" fill="url(#' + g + ')"/><circle cx="24" cy="24" r="16" fill="none" stroke="' + shade(c, -0.35) + '" stroke-width="1.2"/>';
    }
    return svg(48, 48, '<defs>' + gloss(g, c) + shadowDef(s, 3, 5, 2.6, 0.45) + '</defs><g filter="url(#' + s + ')">' + b + '</g>' +
      '<ellipse cx="17" cy="15" rx="4" ry="2.4" fill="rgba(255,255,255,.6)" transform="rotate(-35 17 15)"/>');
  }
  function sticker(c, shape) {
    var g = U(), s = U();
    var p = shape === 'star'
      ? 'M22 4 L27 15 L39 16.5 L30 24.5 L32.5 36.5 L22 30.5 L11.5 36.5 L14 24.5 L5 16.5 L17 15Z'
      : 'M22 38 C8 28 4 18 9.5 12 C14 7 19.5 9 22 13.5 C24.5 9 30 7 34.5 12 C40 18 36 28 22 38Z';
    return svg(44, 42, '<defs>' + gloss(g, c) + shadowDef(s, 1, 2, 1.2, 0.3) + '</defs><g filter="url(#' + s + ')">' +
      '<path d="' + p + '" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="' + p + '" fill="url(#' + g + ')"/></g>' +
      '<path d="M12 14 Q15 11 19 12" stroke="rgba(255,255,255,.85)" stroke-width="2" fill="none" stroke-linecap="round"/>');
  }
  function waxseal(c) {
    var g = U(), s = U(), pts = [];
    for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2, r = 17 + (i % 3 === 0 ? 2.5 : i % 2 ? 0.8 : 1.6); pts.push((24 + Math.cos(a) * r).toFixed(1) + ',' + (24 + Math.sin(a) * r).toFixed(1)); }
    return svg(48, 48, '<defs>' + gloss(g, c) + shadowDef(s, 1.5, 2.5, 1.5, 0.4) + '</defs><g filter="url(#' + s + ')">' +
      '<polygon points="' + pts.join(' ') + '" fill="url(#' + g + ')"/><circle cx="24" cy="24" r="11.5" fill="none" stroke="' + shade(c, -0.35) + '" stroke-width="1.6"/>' +
      '<path d="M24 31 C17 26 16 21 19 18.5 C21 17 23 17.8 24 20 C25 17.8 27 17 29 18.5 C32 21 31 26 24 31Z" fill="' + shade(c, -0.3) + '"/></g>');
  }
  function safetypin(c) {
    var g = U(), s = U();
    return svg(64, 26, '<defs>' + metal(g, c) + shadowDef(s, 1.5, 2.5, 1.1, 0.35) + '</defs><g filter="url(#' + s + ')" transform="rotate(-14 32 13)">' +
      '<path d="M8 9 L50 9 M8 17 L46 17" stroke="url(#' + g + ')" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="8" cy="13" r="4.5" fill="none" stroke="url(#' + g + ')" stroke-width="2"/>' +
      '<rect x="46" y="6" width="12" height="14" rx="3" fill="url(#' + g + ')" stroke="' + shade(c, -0.4) + '" stroke-width=".8"/></g>');
  }
  function bow(c) {
    var g = U(), s = U();
    return svg(60, 42, '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(c, 0.35) + '"/><stop offset="1" stop-color="' + shade(c, -0.2) + '"/></linearGradient>' + shadowDef(s, 2, 3, 1.4, 0.35) + '</defs>' +
      '<g filter="url(#' + s + ')"><path d="M30 18 C20 4 6 6 6 16 C6 26 20 26 30 20Z" fill="url(#' + g + ')"/><path d="M30 18 C40 4 54 6 54 16 C54 26 40 26 30 20Z" fill="url(#' + g + ')"/>' +
      '<path d="M27 22 L20 40 L25 37 L28 41 Z M33 22 L40 40 L35 37 L32 41Z" fill="' + shade(c, -0.15) + '"/>' +
      '<rect x="25" y="13" width="10" height="11" rx="4" fill="' + shade(c, -0.05) + '" stroke="' + shade(c, -0.35) + '" stroke-width=".8"/></g>' +
      '<path d="M12 12 Q16 9 22 12" stroke="rgba(255,255,255,.6)" stroke-width="1.8" fill="none" stroke-linecap="round"/>');
  }
  function brad(c) {
    var g = U(), s = U();
    return svg(26, 26, '<defs>' + gloss(g, c) + shadowDef(s, 1.2, 2, 1, 0.4) + '</defs><g filter="url(#' + s + ')"><circle cx="13" cy="13" r="8" fill="url(#' + g + ')"/>' +
      '<circle cx="13" cy="13" r="8" fill="none" stroke="' + shade(c, -0.4) + '" stroke-width="1"/></g>');
  }
  function nailHead(c) {
    var g = U(), s = U();
    return svg(22, 22, '<defs>' + metal(g, c) + shadowDef(s, 2, 3, 1.2, 0.45) + '</defs><g filter="url(#' + s + ')"><circle cx="11" cy="11" r="6" fill="url(#' + g + ')" stroke="' + shade(c, -0.5) + '" stroke-width="1"/></g>');
  }
  function corner(c, rot) {
    return svg(26, 26, '<g transform="rotate(' + rot + ' 13 13)"><path d="M0 0 L26 0 L0 26Z" fill="' + c + '" opacity=".92"/><path d="M3 3 L20 3" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/></g>');
  }

  /* ---------- đặt lên tờ giấy (W x H) ---------- */
  function pivot(type, W) {
    if (type === 'nail') return [W / 2, -30];
    if (type === 'mappin') return [W / 2 + 4, 12];
    return [W / 2, 6];
  }
  function render(type, color, W, H, opts) {
    opts = opts || {};
    var c = col(color, type), out = [], cx = W / 2;
    switch (type) {
      case 'pushpin': out.push({ html: headPin('ball', c), x: cx - 20, y: -10, w: 40, h: 40 }); break;
      case 'heartpin': out.push({ html: headPin('heart', c), x: cx - 20, y: -10, w: 40, h: 40 }); break;
      case 'starpin': out.push({ html: headPin('star', c), x: cx - 20, y: -10, w: 40, h: 40 }); break;
      case 'flowerpin': out.push({ html: headPin('flower', c), x: cx - 20, y: -10, w: 40, h: 40 }); break;
      case 'thumbtack': out.push({ html: thumbtack(c), x: cx - 18, y: -8, w: 36, h: 36 }); break;
      case 'mappin': out.push({ html: mappin(c), x: cx - 16, y: -32, w: 40, h: 48 }); break;
      case 'twopins':
        out.push({ html: headPin('ball', c), x: 4, y: -10, w: 40, h: 40 });
        out.push({ html: headPin('ball', c), x: W - 44, y: -10, w: 40, h: 40 }); break;
      case 'washi': out.push({ html: tape(c, Math.min(96, W * 0.42), 24, -4, opts.pattern || 'dots'), x: cx - Math.min(96, W * 0.42) / 2, y: -12, w: Math.min(96, W * 0.42), h: 24 }); break;
      case 'washi2':
        out.push({ html: tape(c, 70, 22, -38, opts.pattern || 'stripe'), x: -22, y: -4, w: 70, h: 22 });
        out.push({ html: tape(c, 70, 22, 38, opts.pattern || 'stripe'), x: W - 48, y: -4, w: 70, h: 22 }); break;
      case 'masking':
        out.push({ html: tape(c, 64, 22, -36, null, 'masking'), x: -20, y: -2, w: 64, h: 22 });
        out.push({ html: tape(c, 64, 22, 36, null, 'masking'), x: W - 44, y: -2, w: 64, h: 22 }); break;
      case 'cleartape': out.push({ html: tape(c, Math.min(110, W * 0.5), 26, 2, null, 'clear'), x: cx - Math.min(110, W * 0.5) / 2, y: -13, w: Math.min(110, W * 0.5), h: 26 }); break;
      case 'paperclip': out.push({ html: paperclip(c), x: 22, y: -20, w: 30, h: 52 }); break;
      case 'heartclip': out.push({ html: paperclip(c, true), x: 22, y: -22, w: 30, h: 52 }); break;
      case 'binder': out.push({ html: binder(c), x: cx - 27, y: -26, w: 54, h: 46 }); break;
      case 'bulldog': out.push({ html: bulldog(c), x: cx - 28, y: -24, w: 56, h: 50 }); break;
      case 'clothespin': out.push({ html: clothespin(c), x: cx - 12, y: -30, w: 24, h: 64 }); break;
      case 'magnet': out.push({ html: magnet(c, 'round'), x: cx - 24, y: -16, w: 48, h: 48 }); break;
      case 'magnet-strawberry': out.push({ html: magnet(c, 'strawberry'), x: cx - 24, y: -16, w: 48, h: 48 }); break;
      case 'magnet-cat': out.push({ html: magnet(c, 'cat'), x: cx - 24, y: -16, w: 48, h: 48 }); break;
      case 'sticker-heart': out.push({ html: sticker(c, 'heart'), x: cx - 22, y: -14, w: 44, h: 42 }); break;
      case 'sticker-star': out.push({ html: sticker(c, 'star'), x: cx - 22, y: -14, w: 44, h: 42 }); break;
      case 'waxseal': out.push({ html: waxseal(c), x: cx - 24, y: -18, w: 48, h: 48 }); break;
      case 'safetypin': out.push({ html: safetypin(c), x: 8, y: -12, w: 64, h: 26 }); break;
      case 'bow': out.push({ html: bow(c), x: cx - 30, y: -20, w: 60, h: 42 }); break;
      case 'brad':
        out.push({ html: brad(c), x: 6, y: 6, w: 26, h: 26 });
        out.push({ html: brad(c), x: W - 32, y: 6, w: 26, h: 26 }); break;
      case 'photocorners':
        out.push({ html: corner(c, 0), x: -3, y: -3, w: 26, h: 26 });
        out.push({ html: corner(c, 90), x: W - 23, y: -3, w: 26, h: 26 });
        out.push({ html: corner(c, 270), x: -3, y: H - 23, w: 26, h: 26 });
        out.push({ html: corner(c, 180), x: W - 23, y: H - 23, w: 26, h: 26 }); break;
      case 'nail': {
        // đinh trên tường + dây chữ V xuống hai góc trên của giấy (kraft: xuống lỗ giữa)
        var px = cx, py = -30, hole = opts.hole;
        var ends = hole ? [[cx, 22]] : [[14, 4], [W - 14, 4]];
        var d = ends.map(function (e) { return 'M' + px + ' ' + py + ' L' + e[0] + ' ' + e[1]; }).join(' ');
        out.push({ html: svg(W, 60, '<path d="' + d + '" transform="translate(0 30)" stroke="#b9925e" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
          '<path d="' + d + '" transform="translate(0 30)" stroke="rgba(255,255,255,.35)" stroke-width=".6" fill="none"/>'), x: 0, y: -30, w: W, h: 60 });
        out.push({ html: nailHead(c), x: px - 11, y: py - 11, w: 22, h: 22 });
        break;
      }
    }
    return out;
  }

  window.MochiPins = {
    TYPES: TYPES, COLORS: COLORS, DEF_COLOR: DEF_COLOR, render: render, pivot: pivot,
    swingOf: function (t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === t) return TYPES[i].swing; return 0; },
    has: function (t) { return TYPES.some(function (x) { return x.id === t; }); }
  };
})();
