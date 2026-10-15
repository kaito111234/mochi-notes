/* MochiPreview — vẽ bé Mochi + đồ đang mặc.
 * BẢN TẠM: đồ chỉ là icon 64x64 đặt chồng theo điểm neo khe. Hình mặc thật (theo khung nhân vật)
 * do phòng art làm sau, ánh xạ theo id món; khi có chỉ cần thay hàm drawItem(). */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src) || location.href;
  var W = 288, H = 344;
  // tên file khung đầu của idle/<mode>/loop (đuôi số là thời lượng khung, phải khớp file thật)
  var FRAME = { happy: '160', normal: '160', tired: '208', sad: '160' };
  // slot: [x, y, cỡ, lớp z] trong khung 288x344 — đổi từ điểm neo chung (khung 400x400, ảnh vừa khung, sát đáy)
  var K = W / 400, OY = H - 400 * K;
  var ANCHOR = {};
  var SRC = (window.MochiOutfit && window.MochiOutfit.ANCHOR) || {};
  Object.keys(SRC).forEach(function (k) { var a = SRC[k]; ANCHOR[k] = [a[0] * K, a[1] * K + OY, a[2] * K, a[3]]; });
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
      '.mp-pet{left:0;bottom:0;top:auto;width:100%;height:auto;aspect-ratio:1;z-index:2;filter:drop-shadow(0 3px 3px rgba(20,27,45,.18))}' +
      '.mp-item{aspect-ratio:1;object-fit:contain}';
    document.head.appendChild(s);
  }

  function fadeOut(img) {
    img.classList.remove('on');
    setTimeout(function () { img.remove(); }, FADE + 30);
  }

  // áo/áo khoác: tô lại áo của bé như trên desktop (src/shared/wear.js), không dán icon
  var packBase = url('../../assets/pet/mochi/');
  var wearer = window.MochiWear ? window.MochiWear.create(packBase) : null;
  var wearData = null;
  fetch(url('../../assets/game/wear.json')).then(function (r) { return r.json(); }).then(function (j) { wearData = j; redrawAll(); }).catch(function () {});
  var stages = [];
  function redrawAll() { stages.forEach(function (st) { drawPet(st); }); }
  if (wearer) wearer.onReady(redrawAll);
  function frameRel(mode) { return 'idle/' + mode + '/loop/0001_' + FRAME[mode] + '.png'; }
  function drawPet(st) {
    if (!st.bmp || !st.canvas) return;
    var img = st.bmp;
    if (wearer && window.MochiWear) {
      wearer.setStyle(wearData ? window.MochiWear.styleFor(st.worn || {}, wearData) : null);
      img = wearer.apply(st.bmp, frameRel(st.mode)) || st.bmp;
    }
    var c = st.canvas, x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
  }
  function setPet(st, mode) {
    mode = FRAME[mode] ? mode : 'normal';
    if (st.mode === mode && st.pet) { drawPet(st); return; }
    st.mode = mode;
    var cvs = mk('canvas', 'mp-l mp-pet'); cvs.width = 400; cvs.height = 400;
    function use(m) {
      return fetch(petSrc(m)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(function (b) { return createImageBitmap(b); })
        .then(function (bmp) {
          st.mode = m; st.bmp = bmp; st.canvas = cvs; drawPet(st);
          requestAnimationFrame(function () { cvs.classList.add('on'); });
          if (st.pet && st.pet !== cvs) fadeOut(st.pet);
          st.pet = cvs;
        });
    }
    use(mode).catch(function () { if (mode !== 'normal') use('normal').catch(function () {}); });
    st.stage.appendChild(cvs);
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
    worn = worn || {};
    st.worn = worn;
    if (stages.indexOf(st) < 0) stages.push(st);
    setPet(st, opts.mode || 'normal');
    var items = (catalog && catalog.items) || [];
    Object.keys(ANCHOR).forEach(function (slot) {
      var id = slot === 'body' || slot === 'outer' ? null : worn[slot], it = id ? items.find(function (i) { return i.id === id; }) : null;
      drawItem(st, slot, it || null);
    });
    return st.stage;
  }

  window.MochiPreview = { render: render, ANCHOR: ANCHOR };
})();
