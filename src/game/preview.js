/* MochiPreview — vẽ bé Mochi + đồ đang mặc.
 * BẢN TẠM: đồ chỉ là icon 64x64 đặt chồng theo điểm neo khe. Hình mặc thật (theo khung nhân vật)
 * do phòng art làm sau, ánh xạ theo id món; khi có chỉ cần thay hàm drawItem(). */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src) || location.href;
  var W = 288, H = 344;
  var FRAME = { happy: '140', normal: '150', tired: '220', sad: '200' };
  // slot: [x, y, cỡ, lớp z]   (toạ độ trong khung 288x344, icon tâm tại điểm)
  var ANCHOR = {
    back: [88, 214, 110, 1], body: [144, 262, 96, 3], outer: [144, 256, 120, 4], neck: [144, 214, 58, 5],
    glasses: [144, 160, 84, 6], hairclip: [186, 118, 44, 7], hat: [144, 38, 96, 8], hand: [222, 262, 64, 9]
  };
  var FADE = 150;
  var url = function (p) { return new URL(p, BASE).href; };
  var petSrc = function (mode) { return url('../../assets/pet/mochi/idle/' + mode + '/loop/0001_' + FRAME[mode] + '.png'); };
  var iconSrc = function (p) { return url('../../assets/game/' + p); };

  function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function injectStyle() {
    if (document.getElementById('mp-style')) return;
    var s = document.createElement('style'); s.id = 'mp-style';
    s.textContent =
      '.mp-stage{position:relative;aspect-ratio:288/344;height:var(--mp-size,220px);flex:none;user-select:none;pointer-events:none}' +
      '.mp-rug{position:absolute;left:4%;right:4%;bottom:-2%;height:15%;border-radius:50%;' +
        'background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,#a8e6cf 80%,#fff) 0%,#a8e6cf 55%,color-mix(in srgb,#a9c7f0 70%,transparent) 100%);' +
        'box-shadow:0 0 0 3px rgba(255,255,255,.55),0 4px 10px rgba(31,45,79,.16)}' +
      '.mp-rug::after{content:"";position:absolute;inset:22% 18%;border-radius:50%;border:1.5px dashed rgba(31,45,79,.22)}' +
      '.mp-l{position:absolute;opacity:0;transition:opacity ' + FADE + 'ms ease;filter:drop-shadow(0 2px 2px rgba(20,27,45,.28))}' +
      '.mp-l.on{opacity:1}' +
      '.mp-pet{left:0;top:0;width:100%;height:100%;z-index:2;object-fit:contain;object-position:bottom;filter:drop-shadow(0 3px 3px rgba(20,27,45,.18))}' +
      '.mp-item{aspect-ratio:1;object-fit:contain}';
    document.head.appendChild(s);
  }

  function fadeOut(img) {
    img.classList.remove('on');
    setTimeout(function () { img.remove(); }, FADE + 30);
  }

  function setPet(st, mode) {
    mode = FRAME[mode] ? mode : 'normal';
    if (st.mode === mode && st.pet) return;
    st.mode = mode;
    var img = mk('img', 'mp-l mp-pet'); img.alt = ''; img.draggable = false;
    var tried = false;
    img.onerror = function () { if (!tried && mode !== 'normal') { tried = true; img.src = petSrc('normal'); } };
    img.onload = function () { requestAnimationFrame(function () { img.classList.add('on'); }); if (st.pet && st.pet !== img) fadeOut(st.pet); st.pet = img; };
    img.src = petSrc(mode);
    st.stage.appendChild(img);
  }

  function drawItem(st, slot, item) {
    var a = ANCHOR[slot]; if (!a) return;
    var cur = st.items[slot];
    var id = item ? item.id : null;
    if (cur && cur.id === id) return;
    if (cur) { fadeOut(cur.el); delete st.items[slot]; }
    if (!item) return;
    var img = mk('img', 'mp-l mp-item'); img.alt = ''; img.draggable = false;
    img.style.left = ((a[0] - a[2] / 2) / W * 100) + '%';
    img.style.top = ((a[1] - a[2] / 2) / H * 100) + '%';
    img.style.width = (a[2] / W * 100) + '%';
    img.style.zIndex = a[3];
    img.src = iconSrc(item.icon);
    st.stage.appendChild(img);
    requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('on'); }); });
    st.items[slot] = { id: id, el: img };
  }

  function render(container, worn, catalog, opts) {
    injectStyle();
    opts = opts || {};
    var st = container && container._mp;
    if (!st) {
      var stage = mk('div', 'mp-stage'); stage.appendChild(mk('div', 'mp-rug'));
      st = { stage: stage, items: {}, mode: null, pet: null };
      if (container) { container._mp = st; container.appendChild(stage); }
    }
    st.stage.style.setProperty('--mp-size', (opts.size || 220) + 'px');
    setPet(st, opts.mode || 'normal');
    var items = (catalog && catalog.items) || [];
    worn = worn || {};
    Object.keys(ANCHOR).forEach(function (slot) {
      var id = worn[slot], it = id ? items.find(function (i) { return i.id === id; }) : null;
      drawItem(st, slot, it || null);
    });
    return st.stage;
  }

  window.MochiPreview = { render: render, ANCHOR: ANCHOR };
})();
