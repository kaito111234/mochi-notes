// Đồ vật + giường của bé Mochi: toàn bộ vẽ bằng SVG inline (viền đậm #3a2a4d, màu pastel).
// Chỉ chứa hình và hàm cập nhật trạng thái; vị trí/hoạt ảnh do pet.js + pet.css lo.
(function () {
  'use strict';
  const INK = '#3a2a4d';
  const S = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  const S2 = 'stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
  const svg = (w, h, inner) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="overflow:visible">' + inner + '</svg>';
  function star(cx, cy, r, fill) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + fill + '"/>';
  }

  /* ---------------- giường (vẽ theo hướng đầu bên TRÁI; hướng kia lật bằng CSS) ---------------- */
  // hộp 240x110; chân giường ở y=108; mặt đệm ở y=83
  function bedBack() {
    return svg(240, 110,
      '<rect x="28" y="100" width="10" height="8" rx="2" fill="#c98f5e" ' + S + '/>' +
      '<rect x="206" y="100" width="10" height="8" rx="2" fill="#c98f5e" ' + S + '/>' +
      '<rect x="18" y="93" width="206" height="11" rx="4" fill="#eab07a" ' + S + '/>' +
      '<path d="M20 95 L20 87 Q20 83 25 83 L218 83 Q224 83 224 87 L224 95 Z" fill="#fff0f5" ' + S + '/>' +
      // đầu giường
      '<path d="M4 102 L4 38 Q4 24 16 24 Q28 24 28 38 L28 102 Z" fill="#eab07a" ' + S + '/>' +
      '<path d="M10 96 L10 42 Q10 34 16 34 Q22 34 22 42 L22 96 Z" fill="#f6cfa4" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M16 62 C9 55 11 49 16 52 C21 49 23 55 16 62 Z" fill="#ff9fc0" ' + S2 + '/>' +
      // cuối giường
      '<path d="M216 102 L216 68 Q216 60 224 60 L232 60 Q240 60 240 68 L240 102 Z" fill="#eab07a" ' + S + '/>' +
      // gối
      '<path d="M28 80 Q26 62 46 62 L86 62 Q106 62 102 80 Q102 85 97 85 L33 85 Q28 85 28 80 Z" fill="#fffdf8" ' + S + '/>' +
      '<path d="M40 70 Q64 64 90 70" fill="none" stroke="#e8d9f3" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="36" cy="77" r="2" fill="#ffc0d8"/><circle cx="94" cy="77" r="2" fill="#ffc0d8"/>');
  }
  // chăn (lớp trước nhân vật): từ chân (phải) tới ngực (x≈120)
  function bedFront() {
    let dots = '';
    [[150, 34], [176, 30], [200, 40], [160, 58], [188, 62], [208, 76], [146, 82], [172, 84]].forEach((p, i) => {
      dots += i % 2 ? star(p[0], p[1], 6, '#fff7b0') : '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="#ffd1e6"/>';
    });
    return svg(240, 110,
      '<g class="blk">' +
      '<path d="M122 26 Q122 14 136 14 L198 16 Q214 18 214 36 L214 90 Q205 100 196 93 Q187 100 178 93 Q169 100 160 93 Q151 100 142 93 Q133 100 124 92 Z" fill="#c4b0f4" ' + S + '/>' +
      dots +
      '<path d="M122 26 Q122 14 136 14 L142 14 L142 94 L130 94 Q122 94 122 88 Z" fill="#efe4ff" ' + S + '/>' +
      '<path d="M130 24 L130 80" stroke="#c4b0f4" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 6"/>' +
      '</g>');
  }

  /* ---------------- đồ vật ---------------- */
  const KINDS = {};

  // sách mở (cầm tay)
  KINDS.book = {
    slot: 'hand', w: 84, h: 56, ax: 42, ay: 34,
    svg: svg(84, 56,
      '<path d="M5 20 L42 27 L79 20 L79 48 L42 55 L5 48 Z" fill="#f7a8c4" ' + S + '/>' +
      '<path d="M9 13 Q26 8 42 17 L42 47 Q26 39 9 43 Z" fill="#fffaf0" ' + S + '/>' +
      '<path d="M75 13 Q58 8 42 17 L42 47 Q58 39 75 43 Z" fill="#fffaf0" ' + S + '/>' +
      '<path d="M15 22 Q26 19 36 24 M15 29 Q26 26 36 31 M15 36 Q26 33 36 38 M48 24 Q58 19 69 22 M48 31 Q58 26 69 29" fill="none" stroke="#c9b8d9" stroke-width="2" stroke-linecap="round"/>' +
      '<path class="pgflip" d="M42 17 Q58 8 75 13 L75 43 Q58 39 42 47 Z" fill="#fff4e0" ' + S + '/>'),
    update(el, o, c) {
      if (c.flip) {
        const pg = el.querySelector('.pgflip');
        if (pg) { pg.classList.remove('go'); void pg.getBoundingClientRect(); pg.classList.add('go'); }
      }
    }
  };

  // cơm nắm (cầm tay), bite 0..3
  KINDS.onigiri = {
    slot: 'hand', w: 56, h: 56, ax: 28, ay: 30,
    svg: svg(56, 56,
      '<defs><mask id="onbite" maskUnits="userSpaceOnUse" x="-10" y="-10" width="76" height="76"><rect x="-10" y="-10" width="76" height="76" fill="#fff"/>' +
      '<circle class="b1" cx="43" cy="19" r="0" fill="#000"/><circle class="b2" cx="49" cy="30" r="0" fill="#000"/><circle class="b3" cx="36" cy="10" r="0" fill="#000"/></mask></defs>' +
      '<g mask="url(#onbite)">' +
      '<path d="M28 6 Q33 6 37 13 L52 41 Q55 48 48 49 L8 49 Q1 48 4 41 L19 13 Q23 6 28 6 Z" fill="#fffef8" ' + S + '/>' +
      '<path d="M13 34 L43 34 L49 45 Q51 49 47 49 L9 49 Q5 49 7 45 Z" fill="#4a5a52" ' + S2 + '/>' +
      '<circle cx="22" cy="24" r="2" fill="' + INK + '"/><circle cx="34" cy="24" r="2" fill="' + INK + '"/>' +
      '<ellipse cx="17" cy="28" rx="3" ry="2" fill="#ffb3cc"/><ellipse cx="39" cy="28" rx="3" ry="2" fill="#ffb3cc"/>' +
      '<path d="M26 27 Q28 29.5 30 27" fill="none" ' + S2 + '/></g>'),
    update(el, o) {
      const n = Math.max(0, Math.min(3, +o.bite || 0)), R = [7, 7, 9];
      for (let i = 1; i <= 3; i++) { const ci = el.querySelector('.b' + i); if (ci) ci.setAttribute('r', n >= i ? R[i - 1] : 0); }
    }
  };

  // tách trà có khói (cầm tay)
  KINDS.tea = {
    slot: 'hand', w: 64, h: 62, ax: 30, ay: 42,
    svg: svg(64, 62,
      '<path class="stm s1" d="M24 18 Q19 12 24 7 Q29 2 24 -3" fill="none" stroke="#bfb0dc" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stm s2" d="M36 18 Q41 12 36 7 Q31 2 36 -3" fill="none" stroke="#bfb0dc" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="30" cy="54" rx="25" ry="6" fill="#fff" ' + S + '/>' +
      '<path d="M44 32 Q58 30 56 41 Q54 48 44 46" fill="none" ' + S + '/>' +
      '<path d="M13 28 L47 28 Q47 52 30 52 Q13 52 13 28 Z" fill="#cfeee0" ' + S + '/>' +
      '<ellipse cx="30" cy="28" rx="17" ry="4.5" fill="#c98f5e" ' + S + '/>' +
      '<circle cx="25" cy="38" r="2" fill="' + INK + '"/><circle cx="35" cy="38" r="2" fill="' + INK + '"/>' +
      '<path d="M28 42 Q30 44.5 32 42" fill="none" ' + S2 + '/>')
  };

  // chổi dựng chéo (cầm tay): cán đi qua điểm tay
  KINDS.broom = {
    slot: 'hand', w: 70, h: 136, ax: 34, ay: 56,
    svg: svg(70, 136,
      '<path d="M50 4 L22 96" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M50 4 L22 96" stroke="#e8b87c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M10 98 L35 90 L48 124 Q28 133 4 124 Z" fill="#f2d27a" ' + S + '/>' +
      '<path d="M16 108 L12 124 M26 106 L24 128 M36 104 L38 128" stroke="#d9b24f" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M12 97 L35 89" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M12 97 L35 89" stroke="#ff9fc0" stroke-width="4" stroke-linecap="round"/>')
  };

  // bình tưới (cầm tay), pour => nghiêng + giọt nước
  KINDS.watering_can = {
    slot: 'hand', w: 100, h: 70, ax: 38, ay: 42,
    svg: svg(100, 70,
      '<g class="tilt">' +
      '<path d="M14 30 Q0 30 2 44 Q4 54 15 52" fill="none" ' + S + '/>' +
      '<path d="M22 22 Q33 4 46 22" fill="none" ' + S + '/>' +
      '<path d="M52 36 L84 15 L89 22 L54 48 Z" fill="#9fd8f0" ' + S + '/>' +
      '<path d="M83 7 L95 12 L93 26 L81 21 Z" fill="#7fc0de" ' + S2 + '/>' +
      '<path d="M14 22 L52 22 L54 56 Q54 61 49 61 L19 61 Q14 61 14 56 Z" fill="#9fd8f0" ' + S + '/>' +
      '<path d="M20 34 L48 34" stroke="#d8f1fb" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="28" cy="46" r="2" fill="' + INK + '"/><circle cx="40" cy="46" r="2" fill="' + INK + '"/>' +
      '<path d="M31 50 Q34 53 37 50" fill="none" ' + S2 + '/>' +
      '<g class="drops"><ellipse class="d1" cx="92" cy="30" rx="2.5" ry="4" fill="#8fd0ff"/><ellipse class="d2" cx="87" cy="30" rx="2.5" ry="4" fill="#8fd0ff"/><ellipse class="d3" cx="96" cy="30" rx="2.5" ry="4" fill="#8fd0ff"/></g>' +
      '</g>'),
    update(el, o) { const t = el.querySelector('.tilt'); if (t) t.classList.toggle('pour', !!o.pour); }
  };

  // bút chì (cầm tay)
  KINDS.pencil = {
    slot: 'hand', w: 40, h: 76, ax: 20, ay: 44,
    svg: svg(40, 76,
      '<g transform="rotate(24 20 38)">' +
      '<path d="M14 14 L26 14 L26 58 L14 58 Z" fill="#ffd966" ' + S + '/>' +
      '<path d="M20 15 L20 57" stroke="#f2b93b" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M14 58 L26 58 L20 71 Z" fill="#f7dcc0" ' + S + '/><path d="M18 66 L22 66 L20 71 Z" fill="' + INK + '"/>' +
      '<path d="M14 14 L26 14 L26 8 Q26 4 22 4 L18 4 Q14 4 14 8 Z" fill="#ffa8c8" ' + S + '/>' +
      '<rect x="14" y="14" width="12" height="5" fill="#cfd6e6" ' + S2 + '/></g>')
  };

  // que thổi bong bóng (cầm tay)
  KINDS.bubble_wand = {
    slot: 'hand', w: 56, h: 100, ax: 22, ay: 76,
    svg: svg(56, 100,
      '<path d="M22 96 L22 44" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M22 96 L22 44" stroke="#ff9fc0" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="22" cy="28" r="17" fill="rgba(160,215,255,.28)" ' + S + '/>' +
      '<path d="M12 22 Q15 14 23 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="44" cy="12" r="5" fill="rgba(160,215,255,.3)" stroke="#7fb8e6" stroke-width="1.5"/>')
  };

  // tai nghe trên đầu (neo ở tâm đầu; vòng đeo qua đỉnh, hai núm ở tai)
  KINDS.headphones = {
    slot: 'head', w: 120, h: 90, ax: 60, ay: 56,
    svg: svg(120, 90,
      '<g class="hp">' +
      '<path d="M14 54 Q14 8 60 8 Q106 8 106 54" fill="none" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M14 54 Q14 8 60 8 Q106 8 106 54" fill="none" stroke="#ff9fc0" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="3" y="40" width="21" height="31" rx="10" fill="#b79cf0" ' + S + '/>' +
      '<rect x="96" y="40" width="21" height="31" rx="10" fill="#b79cf0" ' + S + '/>' +
      '<rect x="8" y="47" width="6" height="17" rx="3" fill="#e4d8ff"/><rect x="106" y="47" width="6" height="17" rx="3" fill="#e4d8ff"/>' +
      '</g>')
  };

  // chậu cây dưới đất, grow / bloom
  KINDS.plant = {
    slot: 'ground', w: 64, h: 110, ax: 32, ay: 108,
    svg: svg(64, 110,
      '<g class="fl"><circle cx="32" cy="12" r="7" fill="#ffb3d1" ' + S2 + '/><circle cx="43" cy="20" r="7" fill="#ffb3d1" ' + S2 + '/><circle cx="39" cy="32" r="7" fill="#ffb3d1" ' + S2 + '/><circle cx="25" cy="32" r="7" fill="#ffb3d1" ' + S2 + '/><circle cx="21" cy="20" r="7" fill="#ffb3d1" ' + S2 + '/><circle cx="32" cy="23" r="6" fill="#ffe27a" ' + S2 + '/></g>' +
      '<g class="st">' +
      '<path d="M32 70 L32 24" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/><path d="M32 70 L32 24" stroke="#7fd08e" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M32 50 Q10 48 8 32 Q28 32 32 50 Z" fill="#8fdc9a" ' + S2 + '/>' +
      '<path d="M32 40 Q54 36 56 20 Q36 22 32 40 Z" fill="#8fdc9a" ' + S2 + '/></g>' +
      '<path d="M12 68 L52 68 Q55 68 55 71 L55 75 Q55 78 52 78 L48 78 L45 105 Q44 108 41 108 L23 108 Q20 108 19 105 L16 78 L12 78 Q9 78 9 75 L9 71 Q9 68 12 68 Z" fill="#f4b6a0" ' + S + '/>' +
      '<circle cx="26" cy="92" r="2" fill="' + INK + '"/><circle cx="38" cy="92" r="2" fill="' + INK + '"/>' +
      '<path d="M29 96 Q32 99 35 96" fill="none" ' + S2 + '/>' +
      '<ellipse cx="22" cy="96" rx="3" ry="2" fill="#ff9fb0"/><ellipse cx="42" cy="96" rx="3" ry="2" fill="#ff9fb0"/>'),
    update(el, o) {
      const st = el.querySelector('.st'), fl = el.querySelector('.fl');
      const grown = !!(o.grow || o.bloom);
      if (st) st.classList.toggle('grown', grown);
      if (fl) fl.classList.toggle('bloom', !!o.bloom);
    }
  };

  window.MochiProps = { KINDS, bedBack, bedFront, svg };
})();
