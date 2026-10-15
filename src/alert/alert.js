// "Nhắc to" (renderer): bé phóng to giữa màn hình, dí sát "kính" và dùng HAI BÀN TAY đập bẹp bẹp. Điều khiển bởi src/main/petcore/bigAlert.js.
// Vẽ lại bé bằng chính engine anim.js + wear.js + outfit.js (cùng đồ, cùng hướng); khung giải mã ở cỡ gốc rồi phóng to.
// Mức giận (cfg.level 1..5): 1 ngạc nhiên -> 2 hờn -> 3 giận (má đỏ, đập nhanh) -> 4 giận dữ (đập hai tay) -> 5 khóc dỗi.
(function () {
  'use strict';
  const P = window.mochi && window.mochi.bigAlert;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), charEl = $('char'), noteEl = $('note'), shakeEl = $('shake'), wordsEl = $('words'), printsEl = $('prints');
  const dimEl = $('dim'), hintEl = $('hint'), outBack = $('outBack'), outFront = $('outFront');
  const handsEl = $('hands'), sayEl = $('say'), faceEl = $('face');
  const send = (t, d) => { try { P && P.send(t, d); } catch (e) { /* bỏ qua */ } };
  const OUT = window.MochiOutfit || { ANCHOR: {}, POSE: {}, FRAME: 400 };
  const FOLLOW = { hat: 1, hairclip: 1, glasses: 1, neck: 0.8, hand: 0.6, back: 0.7 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Ảnh mặt trong gói (256x256, chân dung đầu) khớp lên đầu bé ở khung 400: đo bằng so khớp mẫu trên khung idle/normal/0001.
  const FACE = { x: 93, y: 61, k: 0.84, size: 256 };
  // Từng mức: mặt, chữ, lời, nhịp đập (ms), độ rung, ký hiệu 💢 (0 không, 1 nhỏ, 2 to nhấp nháy), má đỏ, đập hai tay cùng lúc, màu phủ nền.
  const LV = {
    1: { face: 'surprised', words: ['BẸP!', 'BẸP!', 'BỐP!'], say: 'Tới giờ rồi!', period: 360, shake: 1, vein: 0, blush: 0, both: false, dim: 'radial-gradient(ellipse at 50% 55%, rgba(30,14,60,.12), rgba(20,8,44,.38))' },
    2: { face: 'protest', words: ['BẸP!! BẸP!!'], say: 'Ê! Tới giờ rồi mà!', period: 340, shake: 1.35, vein: 1, blush: 0, both: false, dim: 'radial-gradient(ellipse at 50% 55%, rgba(70,14,40,.16), rgba(60,8,36,.44))' },
    3: { face: 'angry', words: ['BẸP BẸP BẸP!!!'], say: 'Cậu có nghe tớ không đóóó!', period: 260, shake: 1.9, vein: 2, blush: 1, both: false, dim: 'radial-gradient(ellipse at 50% 55%, rgba(120,12,30,.2), rgba(90,6,26,.52))' },
    4: { face: 'angry', words: ['BẸP BẸP BẸP!!!'], say: 'Dậy làm việc điii!', period: 250, shake: 2.2, vein: 2, blush: 1, both: true, dim: 'radial-gradient(ellipse at 50% 55%, rgba(140,10,28,.24), rgba(100,4,24,.58))' },
    5: { face: 'cry', words: ['BẸP BẸP BẸP!!!'], say: 'Tớ giận rồi đó…', period: 270, shake: 2, vein: 1, blush: 1, both: false, dim: 'radial-gradient(ellipse at 50% 55%, rgba(90,14,50,.2), rgba(60,8,40,.54))' }
  };

  let cfg = null, anim = null, wear = null, curSrc = '', outfit = [], L = LV[1];
  let S = 600, dw = 1280, dh = 720, charLeft = 0, charTop = 0, pivot = [0, 0], from = { dx: 0, dy: 0, s: 0.35 };
  let started = false, ending = false, endSent = false, ignoring = true, faceOn = false;
  let hands = [];
  const timers = new Set(), anims = new Set(), nodes = new Set();
  let ac = null;

  const after = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  function ani(el, kf, opt) {
    let a = null;
    try { a = el.animate(kf, opt); } catch (e) { return null; }
    anims.add(a);
    const rm = () => anims.delete(a);
    a.onfinish = rm; a.oncancel = rm;
    return a;
  }

  /* ------------ âm thanh (WebAudio, không file) ------------ */
  function actx() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
    return ac;
  }
  // âm lượng tổng: alertVolume/70 (70% = như cũ); mọi tiếng đi qua một GainNode chung
  let master = null;
  function dst(c) {
    if (!master || master.context !== c) {
      try {
        master = c.createGain();
        master.gain.value = Math.min(1.5, Math.max(0, (cfg && typeof cfg.volume === 'number' ? cfg.volume : 0.7) / 0.7));
        master.connect(c.destination);
      } catch (e) { master = null; return c.destination; }
    }
    return master;
  }
  function tone(c, f, t0, vol, dur, type) {
    [[f, vol], [f * 2, vol * 0.18]].forEach(function (p) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = p[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p[1], t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(dst(c)); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  function noise(c, t0, dur, freq, vol, sweep) {
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    if (sweep) { f.frequency.setValueAtTime(freq * 0.4, t0); f.frequency.exponentialRampToValueAtTime(freq * 1.6, t0 + dur); }
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dst(c)); src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function sfx(name, power) {
    if (!cfg || cfg.sound === false || cfg.volume === 0) return;
    const c = actx(); if (!c) return;
    const t = c.currentTime + 0.01, pw = power || 1;
    if (name === 'thud') {          // cộp: tiếng trầm + chút nhiễu "bẹp"; giận hơn thì trầm và mạnh hơn
      const o = c.createOscillator(), g = c.createGain(), f0 = rnd(125, 165) / (1 + 0.12 * (pw - 1));
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + 0.13);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.95, 0.6 + 0.12 * pw), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(dst(c)); o.start(t); o.stop(t + 0.22);
      noise(c, t, 0.09, 1100, 0.2 + 0.05 * pw, false);
    } else if (name === 'whoosh') {
      noise(c, t, 0.35, 1400, 0.16, true);
    } else if (name === 'ding') {
      for (let r = 0; r < 2; r++) { tone(c, 1318.5, t + r * 0.7, 0.22, 0.9); tone(c, 1046.5, t + r * 0.7 + 0.2, 0.22, 0.9); }
    }
  }

  /* ------------ bố cục + đồ mặc ------------ */
  function layout() {
    dw = window.innerWidth || 1280; dh = window.innerHeight || 720;
    // nhân vật cao ~60% màn hình: thân bé chiếm ~80% khung gói
    S = Math.round(Math.min(0.75 * dh, 0.95 * dw));
    charLeft = Math.round((dw - S) / 2);
    charTop = Math.round(0.5 * dh - 0.575 * S);
    charEl.style.left = charLeft + 'px'; charEl.style.top = charTop + 'px';
    charEl.style.width = S + 'px'; charEl.style.height = S + 'px';
    pivot = [charLeft + S / 2, charTop + S * 0.6];
    const nh = Math.max(110, Math.min(0.2 * dh, 230)), nw = Math.min(0.62 * dw, nh * 4.4, 800);
    noteEl.style.width = nw + 'px'; noteEl.style.height = nh + 'px';
    noteEl.style.left = Math.round((dw - nw) / 2) + 'px';
    noteEl.style.top = Math.max(6, Math.round(0.2 * dh - nh + 0.02 * dh)) + 'px';
    $('kicker').style.fontSize = Math.round(nh * 0.2) + 'px';
    $('ttl').style.fontSize = Math.round(nh * 0.2) + 'px';
    $('tm').style.fontSize = Math.round(nh * 0.17) + 'px';
    $('late').style.fontSize = Math.round(nh * 0.14) + 'px';
    hintEl.style.fontSize = Math.max(12, Math.round(dh * 0.016)) + 'px';
    sayEl.style.fontSize = Math.max(16, Math.round(dh * 0.034)) + 'px';
    // điểm xuất phát (chỗ bé thật đứng) -> độ lệch so với tâm xoay
    const s0 = Math.min(0.55, Math.max(0.12, (cfg.petH || 0.3 * S) / (0.8 * S)));
    let ox = dw / 2, oy = dh * 0.97;
    if (cfg.origin) { ox = cfg.origin.x; oy = cfg.origin.y - (cfg.petH || 0) * 0.4; }
    from = { dx: Math.round(ox - pivot[0]), dy: Math.round(oy - pivot[1]), s: s0 };
  }
  function placeOutfit() {
    const sc = S / (OUT.FRAME || 400), left = cfg.dir === 'left';
    const hd = wear && curSrc ? wear.head(curSrc) : null;
    const pose = hd ? { dx: hd[0], dy: hd[1], rot: 0 } : (OUT.POSE.idle || { dx: 0, dy: 0, rot: 0 });
    outfit.forEach(o => {
      const a = OUT.ANCHOR[o.slot]; if (!a) return;
      const f = hd ? (FOLLOW[o.slot] || 1) : 1;
      let x = (a[0] + pose.dx * f) * sc; const y = (a[1] + pose.dy * f) * sc, sz = a[2] * sc;
      if (left) x = S - x;
      o.el.style.left = (x - sz / 2) + 'px'; o.el.style.top = (y - sz / 2) + 'px';
      o.el.style.width = sz + 'px'; o.el.style.height = sz + 'px'; o.el.style.zIndex = a[3];
      o.el.style.transform = (left ? 'scaleX(-1) ' : '') + (pose.rot ? 'rotate(' + (left ? -pose.rot : pose.rot) + 'deg)' : '');
    });
    placeFace();
  }
  // Mặt: ảnh face của gói đè lên vùng mặt (ellipse mềm), bám theo độ lệch đầu của khung hiện tại, lật theo hướng bé.
  function placeFace() {
    if (!faceOn || !cfg) return;
    const sc = S / ((cfg.pack && cfg.pack.size && cfg.pack.size[0]) || 400), left = cfg.dir === 'left';
    const hd = wear && curSrc ? wear.head(curSrc) : null;
    const x = (FACE.x + (hd ? hd[0] : 0)) * sc, y = (FACE.y + (hd ? hd[1] : 0)) * sc, sz = FACE.size * FACE.k * sc;
    faceEl.style.width = sz + 'px'; faceEl.style.height = sz + 'px';
    faceEl.style.top = y + 'px';
    faceEl.style.left = (left ? S - x - sz : x) + 'px';
    faceEl.style.transform = left ? 'scaleX(-1)' : '';
  }
  function setOutfit(items) {
    outBack.textContent = ''; outFront.textContent = ''; outfit = [];
    (Array.isArray(items) ? items : []).forEach(it => {
      if (!it || it.slot === 'body' || it.slot === 'outer') return;      // áo: tô lại thân bé (wear), không dán icon
      const a = OUT.ANCHOR[it.slot]; if (!a || typeof it.src !== 'string') return;
      const im = document.createElement('img'); im.alt = ''; im.draggable = false; im.src = it.src;
      (a[3] < 2 ? outBack : outFront).appendChild(im);
      outfit.push({ slot: it.slot, el: im });
    });
    placeOutfit();
  }
  function redrawCurrent() {
    if (!anim || !curSrc) return;
    const img = anim.cache.get(curSrc);
    if (img) anim._drawFrame(anim.filter ? anim.filter(img, curSrc) || img : img);
  }

  /* ------------ mặt giận + 💢 + má đỏ ------------ */
  function veinSvg() {
    const d = ['M12 38 Q38 38 38 12', 'M62 12 Q62 38 88 38', 'M12 62 Q38 62 38 88', 'M62 88 Q62 62 88 62'];
    const p = (w, c) => d.map(x => '<path d="' + x + '" stroke="' + c + '" stroke-width="' + w + '"/>').join('');
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round">' + p(19, '#6b0f1a') + p(10, '#ff2d2d') + '</g></svg>';
  }
  function faceUrl(name) {
    const rel = cfg.faces && cfg.faces[name];
    if (!rel || !cfg.baseUrl) return '';
    return cfg.baseUrl + String(rel).split('/').map(encodeURIComponent).join('/');
  }
  async function setupFace() {
    const url = faceUrl(L.face) || faceUrl('angry');
    faceEl.textContent = '';
    if (!url) return;
    const im = new Image(); im.alt = ''; im.draggable = false; im.id = 'faceImg'; im.className = 'fimg';
    const ok = await new Promise(res => {
      const to = setTimeout(() => res(false), 1500);
      im.onload = () => { clearTimeout(to); res(true); };
      im.onerror = () => { clearTimeout(to); res(false); };
      im.src = url;
    });
    if (!ok) return;
    faceEl.appendChild(im);
    if (L.blush) {
      ['l', 'r'].forEach(k => { const b = document.createElement('div'); b.className = 'blush ' + k; faceEl.appendChild(b); });
    }
    if (L.vein) {
      const big = L.vein === 2;
      const mk = (cls, l, t, w) => {
        const v = document.createElement('div'); v.className = 'vein ' + cls; v.innerHTML = veinSvg();
        v.style.left = l + '%'; v.style.top = t + '%'; v.style.width = w + '%'; v.style.height = w + '%';
        faceEl.appendChild(v); return v;
      };
      const v1 = mk('v1', big ? 66 : 68, big ? -4 : 0, big ? 34 : 26);
      v1._big = big;
      if (cfg.level >= 4) { const v2 = mk('v2', 2, 4, 22); v2.style.transform = 'scaleX(-1)'; v2._big = true; }
    }
    faceOn = true;
    placeFace();
  }
  function animateFace() {
    faceEl.querySelectorAll('.vein').forEach(v => {
      const t = v.style.transform || '';
      const sx = t.indexOf('scaleX(-1)') >= 0 ? -1 : 1;
      const kf = v._big
        ? [{ transform: 'scale(' + sx + ',1) rotate(-6deg)', opacity: 1 }, { transform: 'scale(' + (sx * 1.38) + ',1.38) rotate(5deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(' + (sx * 0.9) + ',0.9) rotate(-3deg)', opacity: 0.55, offset: 0.8 }, { transform: 'scale(' + sx + ',1) rotate(-6deg)', opacity: 1 }]
        : [{ transform: 'scale(' + sx + ',1)', opacity: 1 }, { transform: 'scale(' + (sx * 1.14) + ',1.14)', opacity: 1, offset: 0.5 }, { transform: 'scale(' + sx + ',1)', opacity: 1 }];
      const a = ani(v, kf, { duration: v._big ? Math.max(240, L.period * 1.1) : 760, iterations: Infinity });
      if (!a) return;
    });
  }

  /* ------------ bàn tay ------------ */
  function handColors() {
    const w = cfg.wear || {};
    // tay áo theo màu chủ đạo đồ đang mặc; chưa mặc gì thì áo khoác đen mặc định của bé
    return { dark: w.dark || '#2a2e45', light: w.light || '#4a5072', cuff: w.light ? '#ffffff' : '#f4f1fb' };
  }
  function handSvg(side, col) {
    const sk = '#FFE4D9', ol = '#3a2a4d';
    // gốc: ngón cái bên trái (side=+1, tay phải màn hình); side=-1 lật gương (ngón cái hướng vào trong)
    const fingers = [[26, 36, 46], [44, 22, 58], [62, 24, 56], [80, 38, 42]].map(f =>
      '<rect x="' + f[0] + '" y="' + f[1] + '" width="17" height="' + f[2] + '" rx="8.5" fill="' + sk + '"/>').join('');
    const seam = [26, 44, 62, 80].map(x => '<rect x="' + (x + 2.5) + '" y="56" width="12" height="20" fill="' + sk + '" stroke="none"/>').join('');
    return '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="transform:scaleX(' + (side < 0 ? -1 : 1) + ')">' +
      '<g stroke="' + ol + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M18 160 L27 110 Q60 124 93 110 L102 160 Z" fill="' + col.dark + '"/>' +
      '<path d="M32 156 L37 124 Q44 128 46 130 L42 156 Z" fill="' + col.light + '" fill-opacity=".38" stroke="none"/>' +
      '<ellipse cx="21" cy="92" rx="11.5" ry="24" transform="rotate(-32 21 92)" fill="' + sk + '"/>' +
      fingers +
      '<path d="M27 112 Q15 84 26 62 L94 62 Q105 84 93 112 Q60 126 27 112 Z" fill="' + sk + '"/>' + seam +
      '<path d="M44 100 Q60 108 76 100" fill="none" stroke-width="3" opacity=".3"/>' +
      '<ellipse cx="60" cy="90" rx="15" ry="10" fill="#ff9fb0" fill-opacity=".38" stroke="none"/>' +
      '<path d="M24 112 Q60 126 96 112 L99 130 Q60 144 21 130 Z" fill="' + col.cuff + '"/>' +
      '</g></svg>';
  }
  const HP = {   // tư thế bàn tay: dịch/xoay/phóng so với vị trí "áp kính"; xa kính thì nhỏ hơn
    t: (dx, dy, r, sx, sy) => 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px) rotate(' + r + 'deg) scale(' + sx + ',' + sy + ')',
    ready: s => HP.t(-s * 0.05 * S, -0.27 * S, s * 16, 0.62, 0.62),
    windup: s => HP.t(-s * 0.075 * S, -0.37 * S, s * 24, 0.55, 0.55),
    hit: () => HP.t(0, 0, 0, 1.56, 1.34),
    press: () => HP.t(0, 0.012 * S, 0, 1.62, 1.28)
  };
  function handTarget(side) { return { x: charLeft + S / 2 + side * 0.32 * S, y: charTop + 0.55 * S }; }
  function makeHands() {
    handsEl.textContent = ''; hands = [];
    const hw = Math.round(0.2 * S), col = handColors();
    [-1, 1].forEach(side => {
      const tg = handTarget(side), el = document.createElement('div');
      el.className = 'hand';
      el.style.width = hw + 'px'; el.style.height = Math.round(hw * 4 / 3) + 'px';
      el.style.left = Math.round(tg.x - hw / 2) + 'px'; el.style.top = Math.round(tg.y - hw * 2 / 3) + 'px';
      el.style.transform = HP.ready(side); el.style.opacity = '0';
      el.innerHTML = handSvg(side, col);
      handsEl.appendChild(el);
      hands.push({ side, el, x: tg.x, y: tg.y });
    });
  }
  function slamHand(h, dur) {
    const s = h.side;
    ani(h.el, [
      { transform: HP.ready(s), offset: 0, easing: 'ease-out' },
      { transform: HP.windup(s), offset: 0.26, easing: 'cubic-bezier(.6,0,1,.55)' },
      { transform: HP.hit(), offset: 0.55, easing: 'ease-out' },
      { transform: HP.press(), offset: 0.7, easing: 'ease-in-out' },
      { transform: HP.ready(s), offset: 1 }
    ], { duration: dur });
    after(Math.round(dur * 0.55), () => { if (!ending) impact(s, h.quiet); });
  }

  /* ------------ nạp ------------ */
  async function init(c) {
    cfg = c;
    L = LV[clamp(Math.round(Number(c.level)) || 1, 1, 5)];
    cfg.level = clamp(Math.round(Number(c.level)) || 1, 1, 5);
    layout();
    $('kicker').textContent = c.kicker || 'Tới giờ rồi!';
    $('ttl').textContent = c.title || '';
    $('tm').textContent = c.time || '';
    $('late').textContent = c.late || '';
    if (!c.title) $('ttl').style.display = 'none';
    if (!c.time) $('tm').style.display = 'none';
    if (!c.late) $('late').style.display = 'none';
    sayEl.textContent = c.say || L.say;
    dimEl.style.background = L.dim;
    makeHands();
    const pack = Object.assign({}, c.pack, { scale: S / ((c.pack.size && c.pack.size[0]) || 400) });
    try {
      anim = new window.MochiAnim.Animator(cv, { onMissing: () => {} });
      anim.flip(c.dir === 'left');
      anim.decodeScale = 1;                 // giải mã cỡ gốc (400px), vẽ phóng to bằng smoothing 'high'
      if (window.MochiWear && c.baseUrl) {
        wear = window.MochiWear.create(c.baseUrl);
        if (c.wear) wear.setStyle(c.wear);
        wear.onReady(() => { redrawCurrent(); placeOutfit(); });
        anim.filter = (img, src) => wear.apply(img, src);
      }
      anim.onFrame = src => { curSrc = src; placeOutfit(); };
      await anim.load(pack, c.baseUrl);
      anim.setScale(pack.scale);
      setOutfit(c.outfit);
      anim.play('idle', { mood: c.mood || 'normal', loop: true });
      // chờ mặt nạ áo của khung đầu (tối đa 300ms) để không chớp áo chưa tô màu
      if (wear && wear.style && wear.style()) {
        const t0 = Date.now();
        while (Date.now() - t0 < 300) {
          const im = anim.cache.get(curSrc);
          if (im && wear.apply(im, curSrc) !== im) break;
          await new Promise(r => setTimeout(r, 30));
        }
      }
    } catch (e) { /* vẫn báo loaded: engine tự vẽ hình giữ chỗ */ }
    try { await setupFace(); } catch (e) { faceOn = false; faceEl.textContent = ''; }
    send('loaded', {});
  }

  /* ------------ diễn ------------ */
  function palm(side) {
    // dấu bàn tay: lòng bàn tay + 4 ngón + ngón cái, trắng ngà trong mờ (ngón cái hướng vào trong như bàn tay thật)
    return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" style="transform:scaleX(' + (side < 0 ? -1 : 1) + ')">' +
      '<g fill="#fff" fill-opacity=".62" stroke="#ffd0e6" stroke-opacity=".7" stroke-width="2">' +
      '<ellipse cx="50" cy="82" rx="30" ry="30"/><ellipse cx="25" cy="42" rx="8.5" ry="22" transform="rotate(-14 25 42)"/>' +
      '<ellipse cx="42" cy="30" rx="8.5" ry="25"/><ellipse cx="60" cy="30" rx="8.5" ry="25"/><ellipse cx="77" cy="42" rx="8.5" ry="21" transform="rotate(14 77 42)"/>' +
      '<ellipse cx="14" cy="78" rx="8" ry="17" transform="rotate(-48 14 78)"/></g></svg>';
  }
  function addNode(parent, el, ttl) {
    parent.appendChild(el); nodes.add(el);
    after(ttl, () => { nodes.delete(el); if (el.parentNode) el.parentNode.removeChild(el); });
  }
  function impact(side, quiet) {
    const I = L.shake, a = Math.round(7 * I);
    if (!quiet) {
      ani(shakeEl, [
        { transform: 'translate(0,0)' }, { transform: 'translate(' + (-a) + 'px,' + Math.round(a * 0.7) + 'px)', offset: 0.2 },
        { transform: 'translate(' + Math.round(a * 0.85) + 'px,' + Math.round(-a * 0.7) + 'px)', offset: 0.4 },
        { transform: 'translate(' + Math.round(-a * 0.55) + 'px,' + Math.round(a * 0.4) + 'px)', offset: 0.6 },
        { transform: 'translate(' + Math.round(a * 0.3) + 'px,' + Math.round(-a * 0.25) + 'px)', offset: 0.8 }, { transform: 'translate(0,0)' }
      ], { duration: 200 + 30 * I });
      sfx('thud', I);
      ani(noteEl, [{ translate: '0 0' }, { translate: '0 ' + Math.round(dh * 0.008 * I) + 'px', offset: 0.4 }, { translate: '0 0' }], { duration: 160 });
    }
    const tg = handTarget(side);
    // dấu tay in lên kính ĐÚNG chỗ tay áp vào, rồi mờ dần
    const ps = Math.round(0.2 * S * 1.45 * 0.9);
    const pr = document.createElement('div');
    pr.className = 'print';
    pr.style.width = ps + 'px'; pr.style.height = Math.round(ps * 1.2) + 'px';
    pr.style.left = Math.round(tg.x + rnd(-4, 4)) + 'px';
    pr.style.top = Math.round(tg.y - 0.02 * S) + 'px';
    pr.innerHTML = palm(side);
    pr.style.rotate = Math.round(side * rnd(-4, 6)) + 'deg';
    addNode(printsEl, pr, 2000);
    ani(pr, [{ opacity: 0.9, scale: '0.8' }, { opacity: 0.8, scale: '1.04', offset: 0.1 }, { opacity: 0 }], { duration: 1900, easing: 'ease-out', fill: 'forwards' });
    // gợn sóng trên kính
    const rg = document.createElement('div');
    rg.className = 'ring';
    rg.style.width = rg.style.height = Math.round(ps * 0.8) + 'px';
    rg.style.left = Math.round(tg.x) + 'px'; rg.style.top = Math.round(tg.y) + 'px';
    addNode(printsEl, rg, 460);
    ani(rg, [{ opacity: 0.85, scale: '0.5' }, { opacity: 0, scale: '1.7' }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
    if (quiet) return;
    // chữ truyện tranh cạnh tay
    const w = document.createElement('div');
    w.className = 'word';
    const txt = L.words[Math.floor(Math.random() * L.words.length)];
    w.textContent = txt;
    w.style.fontSize = Math.round(S * rnd(0.1, 0.12) * (txt.length > 9 ? 0.72 : 1)) + 'px';
    // bật ra cạnh tay, phía ngoài-dưới để không che tay và mặt
    w.style.left = Math.round(clamp(tg.x + side * S * rnd(0.06, 0.12), dw * 0.14, dw * 0.86)) + 'px';
    w.style.top = Math.round(tg.y + S * rnd(0.22, 0.3)) + 'px';
    while (wordsEl.firstChild) { nodes.delete(wordsEl.firstChild); wordsEl.removeChild(wordsEl.firstChild); }   // chỉ một chữ tại một thời điểm
    w.style.rotate = Math.round(side * rnd(6, 16) + rnd(-4, 4)) + 'deg';
    addNode(wordsEl, w, 800);
    ani(w, [{ opacity: 0, scale: '0.3' }, { opacity: 1, scale: '1.28', offset: 0.2 }, { opacity: 1, scale: '1', offset: 0.45 }, { opacity: 1, scale: '1.02', offset: 0.75 }, { opacity: 0, scale: '1.1' }], { duration: 760, easing: 'ease-out', fill: 'forwards' });
  }
  function slap(i) {
    if (ending) return;
    const side = i % 2 ? 1 : -1, y = Math.round(dh * 0.012 * Math.min(1.6, L.shake));
    const period = L.period;
    // thân bé nhún theo nhịp: rướn lên lúc vung tay, ép dẹt xuống lúc đập
    ani(charEl, [
      { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
      { transform: 'translate(0,' + (-y) + 'px) rotate(' + (-side * 2) + 'deg) scale(0.97,1.04)', offset: 0.3 },
      { transform: 'translate(0,' + y + 'px) rotate(' + (side * 1.5 * L.shake) + 'deg) scale(1.17,0.92)', offset: 0.55 },
      { transform: 'translate(0,' + Math.round(y / 3) + 'px) rotate(0deg) scale(1.07,0.97)', offset: 0.76 },
      { transform: 'translate(0,0) rotate(0deg) scale(1,1)' }
    ], { duration: Math.min(340, period + 20), easing: 'ease-in-out' });
    if (L.both) {
      const dur = Math.max(200, period - 20);
      hands.forEach((h, k) => { h.quiet = k === 1; slamHand(h, dur); });
    } else {
      const h = hands.find(x => x.side === side) || hands[0];
      h.quiet = false;
      slamHand(h, Math.min(340, 2 * period - 20));
    }
  }
  function go() {
    if (started || !cfg) return;
    started = true;
    const total = Math.max(1500, cfg.ms || 5500);
    charEl.style.opacity = '1';
    ani(dimEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 350, fill: 'forwards' });
    sfx('whoosh');
    // nhảy ra từ chỗ bé đứng: cung nhảy + phóng to + đáp bẹp
    const d = from, up = Math.round(dh * 0.1);
    ani(charEl, [
      { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ')', opacity: 1 },
      { transform: 'translate(' + Math.round(d.dx * 0.3) + 'px,' + (Math.round(d.dy * 0.3) - up) + 'px) scale(1.13)', opacity: 1, offset: 0.55 },
      { transform: 'translate(0,0) scale(1.05,0.93)', opacity: 1, offset: 0.78 },
      { transform: 'translate(0,0) scale(1,1)', opacity: 1 }
    ], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
    animateFace();
    after(330, () => { sfx('ding'); ani(noteEl, [{ opacity: 0, transform: 'scale(0.2)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, fill: 'forwards' }); });
    // hai tay giơ lên từ vai rồi hiện dần
    after(300, () => hands.forEach(h => ani(h.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, fill: 'forwards' })));
    after(450, () => ani(sayEl, [{ opacity: 0, transform: 'translate(-50%,10px) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 320, fill: 'forwards' }));
    after(1100, () => ani(hintEl, [{ opacity: 0 }, { opacity: 0.85 }], { duration: 300, fill: 'forwards' }));
    const first = 560, period = L.period, last = total - 800;
    for (let t = first, i = 0; t <= last; t += period, i++) { const n = i; after(t, () => slap(n)); }
    after(Math.max(first + period, total - 420), () => finish('timeout'));
  }
  function finish(reason) {
    if (ending || !started) return;
    ending = true;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    anims.forEach(a => { try { a.cancel(); } catch (e) { /* bỏ qua */ } });
    anims.clear();
    const d = from;
    ani(charEl, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(0,' + (-Math.round(dh * 0.03)) + 'px) scale(1.04)', opacity: 1, offset: 0.25 },
      { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ')', opacity: 0.9, offset: 0.9 },
      { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ')', opacity: 0 }
    ], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    ani(noteEl, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }], { duration: 240, fill: 'forwards' });
    ani(handsEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    ani(sayEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    ani(dimEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
    ani(hintEl, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
    nodes.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
    nodes.clear();
    setTimeout(() => sendEnd(reason), 420);
  }
  function sendEnd(reason) {
    if (endSent) return;
    endSent = true;
    cleanup();
    send('end', { reason: reason });
  }
  function cleanup() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    try { if (anim) anim.destroy(); } catch (e) { /* bỏ qua */ }
    anim = null; wear = null;
    try { if (ac) { ac.close(); ac = null; } } catch (e) { /* bỏ qua */ }
  }

  /* ------------ chuột / phím ------------ */
  function overChar(x, y) {
    if (!anim) return false;
    const r = cv.getBoundingClientRect();
    if (!r.width || x < r.left || y < r.top || x > r.right || y > r.bottom) return false;
    try { return anim.alphaAt((x - r.left) * S / r.width, (y - r.top) * S / r.height) > 24; } catch (e) { return false; }
  }
  function overNote(x, y) {
    const r = noteEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && parseFloat(getComputedStyle(noteEl).opacity) > 0.3;
  }
  function setIgnore(v) { if (v === ignoring) return; ignoring = v; send('ignore', { v: v }); }
  document.addEventListener('mousemove', ev => { if (!started || ending) return; setIgnore(!(overChar(ev.clientX, ev.clientY) || overNote(ev.clientX, ev.clientY))); });
  document.addEventListener('mouseleave', () => setIgnore(true));
  document.addEventListener('mousedown', () => { if (started) finish('click'); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && started) finish('esc'); });

  if (P) P.onCmd(c => {
    if (!c || !c.op) return;
    if (c.op === 'init') init(c).catch(() => send('loaded', {}));
    else if (c.op === 'go') go();
  });
  const boot = () => send('ready', {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
