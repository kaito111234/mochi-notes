// "Nhắc to" (renderer): bé phóng từ chỗ thú cưng ra giữa màn hình, vung CÁNH TAY CỦA CHÍNH BÉ đập vào "kính", kèm tờ note dán và các nút hành động.
// Điều khiển bởi src/main/petcore/bigAlert.js. Vẽ bé bằng engine anim.js + wear.js + outfit.js (cùng đồ, cùng hướng); khung giải mã ở cỡ gốc rồi phóng to.
// Mức giận (cfg.level 1..5): 1 ngạc nhiên (2 cái đập nhẹ) -> 2 hờn -> 3 giận (đập nhanh, xì hơi) -> 4 giận dữ (hai tay, nứt kính nhẹ) -> 5 đập liên hồi, khói, nứt kính.
// Kết quả gửi main: end { reason: 'timeout' | 'click' | 'esc' | 'done' | 'snooze' | 'open', minutes? }.
(function () {
  'use strict';
  const P = window.mochi && window.mochi.bigAlert;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), charEl = $('char'), shakeEl = $('shake'), wordsEl = $('words'), printsEl = $('prints'), fxEl = $('fx'), smokeEl = $('smoke');
  const dimEl = $('dim'), redEl = $('redv'), flashEl = $('flash'), outBack = $('outBack'), outFront = $('outFront');
  const armsEl = $('arms'), cracksEl = $('cracks'), sayEl = $('say'), faceEl = $('face');
  const panelEl = $('panel'), cardEl = $('card'), actsEl = $('acts'), hintEl = $('hint');
  const send = (t, d) => { try { P && P.send(t, d); } catch (e) { /* bỏ qua */ } };
  const OUT = window.MochiOutfit || { ANCHOR: {}, POSE: {}, FRAME: 400 };
  const FOLLOW = { hat: 1, hairclip: 1, glasses: 1, neck: 0.8, hand: 0.6, back: 0.7 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 'calm' (cài đặt alertMotion) = bản tĩnh; OS bật giảm chuyển động chỉ làm nhẹ: rung ~1/3, ít bụi/sao, không nhấp nháy
  let reduced = false;
  const soft = (() => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
  const INK = '#1f2a44', SKIN = '#FFE4D9';

  // Ảnh mặt trong gói (256x256, chân dung đầu) khớp lên đầu bé ở khung 400: đo bằng so khớp mẫu trên khung idle/normal/0001.
  const FACE = { x: 93, y: 61, k: 0.84, size: 256 };
  // Từng mức: mặt, lời, nhịp đập (ms), số cái đập tối đa, độ rung (px), ký hiệu 💢 (0 không, 1 nhỏ, 2 to nhấp nháy), má đỏ, hai tay cùng lúc,
  // chữ tượng thanh, màu bùng nổ, khói (0 không), nứt kính (0 không / 1 từ cái thứ 2 / 2 mỗi cái), vignette.
  const LV = {
    1: { face: 'surprised', say: 'Tới giờ rồi!', period: 640, max: 2, shake: 6, vein: 0, blush: 0, both: false, words: ['BỐP!', 'BẸP!'], burst: '#ffb36b', smoke: 0, crack: 0, red: 0, dim: 'radial-gradient(ellipse at 50% 55%, rgba(60,40,110,.04), rgba(40,20,80,.28))' },
    2: { face: 'protest', say: 'Ê! Tới giờ rồi mà!', period: 470, max: 3, shake: 7.5, vein: 1, blush: 0, both: false, words: ['BẸP!', 'BỐP!', 'ĐÙNG!'], burst: '#ff9a5a', smoke: 0, crack: 0, red: 0, dim: 'radial-gradient(ellipse at 50% 55%, rgba(80,30,90,.05), rgba(70,20,70,.32))' },
    3: { face: 'angry', say: 'Cậu có nghe tớ không đóóó!', period: 300, max: 99, shake: 9, vein: 2, blush: 1, both: false, words: ['ĐÙNG!', 'BỐP!', 'BẸP BẸP!'], burst: '#ff6b6b', smoke: 1, crack: 0, red: 1, dim: 'radial-gradient(ellipse at 50% 55%, rgba(100,24,60,.06), rgba(90,14,50,.34))' },
    4: { face: 'angry', say: 'Dậy làm việc điii!', period: 340, max: 99, shake: 10.5, vein: 2, blush: 1, both: true, words: ['ẦM!', 'ĐÙNG!', 'BỐP!!'], burst: '#ff4d6a', smoke: 1, crack: 1, red: 2, dim: 'radial-gradient(ellipse at 50% 55%, rgba(120,18,50,.08), rgba(100,10,44,.4))' },
    5: { face: 'angry', say: 'Tớ giận rồi đó…', period: 235, max: 99, shake: 12, vein: 2, blush: 1, both: false, words: ['ẦM!!', 'ĐÙNG!!', 'BỐP BỐP!', 'ẦM ẦM!'], burst: '#e8325a', smoke: 2, crack: 2, red: 2, dim: 'radial-gradient(ellipse at 50% 55%, rgba(130,16,50,.1), rgba(100,8,44,.44))' }
  };
  const ACT = {
    done: { label: 'Xong rồi', cls: 'main', reason: 'done', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
    snooze5: { label: 'Hoãn 5 phút', cls: 'soft', reason: 'snooze', minutes: 5, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/></svg>' },
    snooze10: { label: 'Hoãn 10 phút', cls: 'soft', reason: 'snooze', minutes: 10, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/></svg>' },
    open: { label: 'Mở note', cls: 'ghost', reason: 'open', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>' },
    dismiss: { label: 'Biết rồi', cls: 'ghost', reason: 'click', ico: '' }
  };

  let cfg = null, anim = null, wear = null, curSrc = '', outfit = [], L = LV[1];
  let S = 600, dw = 1280, dh = 720, u = 1, cxC = 640, charLeft = 0, charTop = 0, pivot = [0, 0], from = { dx: 0, dy: 0, s: 0.35 };
  let started = false, ending = false, endSent = false, ignoring = true, faceOn = false, hasDone = false, hasSnooze = false;
  let arms = [], slapN = 0, cracks = 0, endAt = 0, startAt = 0, holdUntil = 0, raf = 0;
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

  /* ------------ âm thanh (WebAudio tự tổng hợp, không file) ------------ */
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
  function bell(c, f, t0, vol, dur) {      // tiếng chuông nhỏ: nốt chính + hai hoạ âm lệch (như chuông thật)
    [[1, 1], [2.76, 0.26], [5.4, 0.08]].forEach(function (p) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol * p[1], t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (0.6 + 0.4 * p[0]));
      o.connect(g); g.connect(dst(c)); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  function noise(c, t0, dur, freq, vol, type, sweep) {
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    if (sweep) { f.frequency.setValueAtTime(freq * 0.4, t0); f.frequency.exponentialRampToValueAtTime(freq * 1.6, t0 + dur); }
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dst(c)); src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function sfx(name, power) {
    if (!cfg || cfg.sound === false || cfg.volume === 0) return;
    const c = actx(); if (!c) return;
    const t = c.currentTime + 0.01, pw = power || 1;
    if (name === 'thud') {          // bộp: thân trầm + nhiễu lọc thấp; giận hơn thì đục và nặng hơn
      const o = c.createOscillator(), g = c.createGain(), f0 = rnd(135, 175) / (1 + 0.16 * (pw - 1));
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * 1.5, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.14);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.95, 0.55 + 0.11 * pw), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + 0.03 * pw);
      o.connect(g); g.connect(dst(c)); o.start(t); o.stop(t + 0.3);
      noise(c, t, 0.08 + 0.015 * pw, 2600 / (1 + 0.45 * (pw - 1)), 0.22 + 0.05 * pw, 'lowpass', false);
      if (pw <= 2) noise(c, t, 0.05, 3200, 0.06, 'bandpass', false);          // mức nhẹ: thêm chút "bẹp" mềm
    } else if (name === 'whoosh') {
      noise(c, t, 0.4, 1400, 0.14, 'bandpass', true);
    } else if (name === 'chime') {   // chuông nhắc dễ thương: arpeggio C-E-G-C, nhắc lại một lần
      const notes = [1046.5, 1318.5, 1568, 2093];
      notes.forEach((f, i) => bell(c, f, t + i * 0.085, 0.2, 0.7));
      notes.forEach((f, i) => bell(c, f, t + 0.62 + i * 0.085, 0.13, 0.55));
    } else if (name === 'crack') {
      noise(c, t, 0.07, 5200, 0.12, 'highpass', false);
    } else if (name === 'happy') {
      [[1318.5, 0], [1568, 0.07], [2093, 0.14]].forEach(p => bell(c, p[0], t + p[1], 0.17, 0.5));
    } else if (name === 'blip') {
      bell(c, 880, t, 0.14, 0.35); bell(c, 660, t + 0.08, 0.12, 0.4);
    }
  }

  /* ------------ bố cục + đồ mặc ------------ */
  function layout() {
    dw = window.innerWidth || 1280; dh = window.innerHeight || 720;
    u = clamp(dh / 720, 0.8, 1.7);
    const wide = dw / dh >= 1.2;
    S = Math.round(wide ? Math.min(0.75 * dh, 0.5 * dw) : Math.min(0.46 * dh, 0.9 * dw));
    cxC = wide ? Math.min(0.6 * dw, dw - S * 0.5 - 16) : dw / 2;
    charLeft = Math.round(cxC - S / 2);
    charTop = Math.round(wide ? 0.5 * dh - 0.575 * S : dh - S * 1.2);
    charEl.style.left = charLeft + 'px'; charEl.style.top = charTop + 'px';
    charEl.style.width = S + 'px'; charEl.style.height = S + 'px';
    pivot = [charLeft + S / 2, charTop + S * 0.6];
    // bảng thông tin: cột trái (màn ngang) hoặc phía trên (màn vuông/dọc)
    const pw = Math.round(wide ? clamp(Math.min(0.32 * dw, 430 * u), 280, 600) : Math.min(0.92 * dw, 520 * u));
    panelEl.style.width = pw + 'px';
    panelEl.style.fontSize = Math.round(15 * u) + 'px';
    panelEl.style.gap = Math.round(14 * u) + 'px';
    const bodyL = cxC - 0.27 * S;
    const px = wide ? Math.max(20, Math.round((bodyL - pw) / 2)) : Math.round((dw - pw) / 2);
    panelEl.style.left = px + 'px';
    $('kicker').style.fontSize = '1.2em';
    $('ttl').style.fontSize = '2.15em';
    $('tm').style.fontSize = '1.05em';
    $('late').style.fontSize = '1.05em';
    hintEl.style.fontSize = '.82em';
    const ph = panelEl.offsetHeight || 380 * u;
    panelEl.style.top = Math.max(10, Math.round(wide ? (dh - ph) / 2 - 0.02 * dh : 0.02 * dh)) + 'px';
    sayEl.style.fontSize = Math.max(16, Math.round(0.034 * dh)) + 'px';
    sayEl.style.left = Math.round(cxC) + 'px';
    sayEl.style.translate = '-50% 0';
    sayEl.style.top = Math.round(Math.min(charTop + S * 0.99, dh - 58 * u)) + 'px';
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
    if (reduced) return;
    faceEl.querySelectorAll('.vein').forEach(v => {
      const t = v.style.transform || '';
      const sx = t.indexOf('scaleX(-1)') >= 0 ? -1 : 1;
      const kf = v._big
        ? [{ transform: 'scale(' + sx + ',1) rotate(-6deg)', opacity: 1 }, { transform: 'scale(' + (sx * 1.38) + ',1.38) rotate(5deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(' + (sx * 0.9) + ',0.9) rotate(-3deg)', opacity: 0.55, offset: 0.8 }, { transform: 'scale(' + sx + ',1) rotate(-6deg)', opacity: 1 }]
        : [{ transform: 'scale(' + sx + ',1)', opacity: 1 }, { transform: 'scale(' + (sx * 1.14) + ',1.14)', opacity: 1, offset: 0.5 }, { transform: 'scale(' + sx + ',1)', opacity: 1 }];
      ani(v, kf, { duration: v._big ? Math.max(240, L.period * 1.1) : 760, iterations: Infinity });
    });
  }

  /* ------------ cánh tay của bé: tay áo + bàn tay (SVG, cùng nét viền #1f2a44 như bé) ------------ */
  function handColors() {
    const w = cfg.wear || {};
    // tay áo theo màu chủ đạo đồ đang mặc; chưa mặc gì thì áo khoác navy mặc định của bé
    return { dark: w.dark || '#2a3358', light: w.light || '#4a5584', cuff: w.light ? '#ffffff' : '#f4f1fb' };
  }
  function handMarkup() {
    const fing = [[-23.5, -74], [-8, -82], [8, -80], [23.5, -70]].map(f => '<rect x="' + (f[0] - 7.75) + '" y="' + f[1] + '" width="15.5" height="' + (-f[1] - 28) + '" rx="7.75"/>').join('');
    const seam = [-23.5, -8, 8, 23.5].map(c => '<rect x="' + (c - 5.6) + '" y="-50" width="11.2" height="17" fill="' + SKIN + '" stroke="none"/>').join('');
    return '<g fill="' + SKIN + '" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">' +
      '<rect x="-46" y="-52" width="16" height="38" rx="8" transform="rotate(-30 -38 -16)"/>' + fing +
      '<path d="M-21 0 L21 0 Q36 -14 34 -42 L-34 -42 Q-36 -14 -21 0 Z"/>' + seam +
      '<ellipse cx="0" cy="-19" rx="15" ry="10" fill="#ff9fb0" fill-opacity=".42" stroke="none"/>' +
      '<path d="M-14 -33 Q0 -27 14 -33" fill="none" stroke-width="2.4" opacity=".28"/>' +
      '</g>';
  }
  function makeArms() {
    armsEl.textContent = ''; arms = [];
    const col = handColors();
    let html = '';
    [-1, 1].forEach(side => {
      html += '<g class="arm" data-s="' + side + '"><path class="so" fill="none" stroke="' + INK + '" stroke-linecap="round"/><path class="sf" fill="none" stroke="' + col.dark + '" stroke-linecap="round"/>' +
        '<path class="sl" fill="none" stroke="' + col.light + '" stroke-linecap="round" opacity=".42"/><g class="hd">' + handMarkup() + '</g>' +
        '<path class="co" fill="none" stroke="' + INK + '" stroke-linecap="butt"/><path class="cf" fill="none" stroke="' + col.cuff + '" stroke-linecap="butt"/></g>';
    });
    armsEl.innerHTML = html;
    armsEl.querySelectorAll('.arm').forEach(g => {
      const side = Number(g.getAttribute('data-s'));
      const a = {
        side, g, so: g.querySelector('.so'), sf: g.querySelector('.sf'), sl: g.querySelector('.sl'), co: g.querySelector('.co'), cf: g.querySelector('.cf'), hd: g.querySelector('.hd'),
        sx: cxC + side * 0.14 * S, sy: charTop + 0.6 * S, tg: { x: cxC + side * 0.3 * S, y: charTop + 0.5 * S }, run: null, cur: null, phase: Math.random() * 6
      };
      a.cur = poseDefs(a).rest;
      arms.push(a);
      drawArm(a, a.cur);
    });
  }
  const P0 = (x, y, sc, flat, off, qx, qy) => ({ x, y, sc, flat, off: off || 0, qx: qx || 1, qy: qy || 1 });
  function poseDefs(a) {
    const s = a.side, sx = a.sx, sy = a.sy, tg = a.tg, wy = sc => tg.y + 45 * 0.0022 * S * sc;
    return {
      rest: P0(sx + s * 0.17 * S, sy + 0.03 * S, 0.5, 0, s * 8),
      wind: P0(sx + s * 0.17 * S, sy - 0.31 * S, 0.62, 0, s * 18),
      hit: P0(tg.x, wy(1.42), 1.42, 1, 0, 1, 1),
      press: P0(tg.x, wy(1.48) + 0.012 * S, 1.48, 1, 0, 1.13, 0.86)
    };
  }
  function qpt(a, cx, cy, p, t) {
    const m = 1 - t;
    return [m * m * a.sx + 2 * m * t * cx + t * t * p.x, m * m * a.sy + 2 * m * t * cy + t * t * p.y];
  }
  function drawArm(a, p) {
    const k = 0.0022 * S * p.sc, fl = clamp((1.3 - p.sc) / 0.8, 0, 1), sw = 40 * k * (1 + 0.3 * fl), cw = 44 * k * (1 + 0.12 * fl);
    const mx = (a.sx + p.x) / 2, my = (a.sy + p.y) / 2;
    const dcx = mx + a.side * 0.07 * S, dcy = my + 0.08 * S;          // khuỷu hơi xệ xuống ngoài
    const bcx = p.x + a.side * 0.012 * S, bcy = p.y + 0.1 * S;        // áp kính: cẳng tay đi lên từ dưới -> bàn tay dựng đứng
    const cx = dcx + (bcx - dcx) * p.flat, cy = dcy + (bcy - dcy) * p.flat;
    const th = Math.atan2(p.x - cx, -(p.y - cy)) * 180 / Math.PI;
    const d = 'M' + a.sx.toFixed(1) + ' ' + a.sy.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    a.so.setAttribute('d', d); a.so.setAttribute('stroke-width', (sw + 6).toFixed(1));
    a.sf.setAttribute('d', d); a.sf.setAttribute('stroke-width', sw.toFixed(1));
    a.sl.setAttribute('d', d); a.sl.setAttribute('stroke-width', (sw * 0.26).toFixed(1));
    a.sl.setAttribute('transform', 'translate(' + (-a.side * sw * 0.2).toFixed(1) + ',' + (-sw * 0.18).toFixed(1) + ')');
    const c0 = qpt(a, cx, cy, p, 0.86), c1 = [p.x, p.y];
    const cd = 'M' + c0[0].toFixed(1) + ' ' + c0[1].toFixed(1) + ' L' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1);
    a.co.setAttribute('d', cd); a.co.setAttribute('stroke-width', (cw + 6).toFixed(1));
    a.cf.setAttribute('d', cd); a.cf.setAttribute('stroke-width', cw.toFixed(1));
    a.hd.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + (th + p.off).toFixed(1) + ') scale(' + (k * p.qx * a.side).toFixed(4) + ' ' + (k * p.qy).toFixed(4) + ')');
  }
  const EASE = {
    out: x => 1 - Math.pow(1 - x, 3), in: x => x * x * x, io: x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    back: x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  };
  function mix(p, q, e) {
    const o = {}; for (const k in p) o[k] = p[k] + (q[k] - p[k]) * e; return o;
  }
  // phát một cú đập: các mốc [t(0..1), tư thế, easing]; mốc 'hit' gọi onHit đúng lúc bàn tay chạm kính
  function runSlap(a, dur, quiet) {
    const d = poseDefs(a);
    a.run = { t0: performance.now(), dur, from: Object.assign({}, a.cur), d, hitDone: false, quiet: !!quiet };
  }
  function sample(a, now) {
    const r = a.run, uu = (now - r.t0) / r.dur;
    if (uu >= 1) { a.run = null; return poseDefs(a).rest; }
    const d = r.d;
    if (uu < 0.3) return mix(r.from, d.wind, EASE.back(uu / 0.3));
    if (uu < 0.56) return mix(d.wind, d.hit, EASE.in((uu - 0.3) / 0.26));
    if (!r.hitDone) { r.hitDone = true; if (!ending) impact(a, r.quiet); }
    if (uu < 0.7) return mix(d.hit, d.press, EASE.out((uu - 0.56) / 0.14));
    return mix(d.press, d.rest, EASE.io((uu - 0.7) / 0.3));
  }
  function tick(now) {
    raf = 0;
    if (ending && !arms.length) return;
    arms.forEach(a => {
      let p;
      if (a.run) p = sample(a, now);
      else {
        // đứng chờ: tay giơ lắc lư nhè nhẹ cho "sống"
        const b = poseDefs(a).rest, w = now / 380 + a.phase;
        p = Object.assign({}, b, { y: b.y + Math.sin(w) * 0.008 * S, off: b.off + Math.sin(w * 0.8) * 3 });
      }
      a.cur = p;
      drawArm(a, p);
    });
    if (!endSent) raf = requestAnimationFrame(tick);
  }

  /* ------------ nạp ------------ */
  async function init(c) {
    cfg = c;
    reduced = c.motion === 'calm';
    L = LV[clamp(Math.round(Number(c.level)) || 1, 1, 5)];
    cfg.level = clamp(Math.round(Number(c.level)) || 1, 1, 5);
    // nội dung thẻ + nút (layout cần đo chiều cao nên làm trước)
    $('kicker').textContent = c.kicker || 'Tới giờ rồi!';
    $('ttl').textContent = c.title || '';
    $('tm').textContent = c.time ? '⏰ ' + c.time : '';
    $('late').textContent = c.late || '';
    $('body').textContent = c.body || '';
    if (!c.title) $('ttl').style.display = 'none';
    if (!c.time) $('tm').style.display = 'none';
    if (!c.late) $('late').style.display = 'none';
    if (!c.body) $('body').style.display = 'none';
    $('sayTxt').textContent = c.say || L.say;
    buildActs(Array.isArray(c.actions) ? c.actions : []);
    const nz = noiseUrl();
    dimEl.style.background = nz ? 'url(' + nz + '), ' + L.dim : L.dim;
    if (nz) { dimEl.style.backgroundSize = '96px 96px, 100% 100%'; redEl.style.background = 'url(' + nz + '), radial-gradient(ellipse at 50% 55%, rgba(255,60,90,0) 38%, rgba(255,60,90,.34) 100%)'; redEl.style.backgroundSize = '96px 96px, 100% 100%'; }
    layout();
    makeArms();
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
  // nhiễu dither rất nhẹ phủ lên vignette để hết vân băng gradient
  function noiseUrl() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d'), im = g.createImageData(96, 96), d = im.data;
      for (let k = 0; k < d.length; k += 4) { const v = Math.random() < 0.5 ? 0 : 255; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = Math.floor(Math.random() * 7); }
      g.putImageData(im, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }
  function buildActs(list) {
    const ids = list.filter(x => ACT[x] && x !== 'dismiss');
    hasDone = ids.includes('done'); hasSnooze = ids.includes('snooze5');
    actsEl.textContent = '';
    const order = ['done', 'snooze5', 'snooze10', 'open'].filter(x => ids.includes(x));
    order.push('dismiss');
    order.forEach(id => {
      const a = ACT[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + a.cls; b.setAttribute('data-act', id);
      b.innerHTML = a.ico + '<span>' + a.label + '</span>';
      if (order.length === 1) b.style.gridColumn = '1 / 3';
      b.addEventListener('click', ev => { ev.stopPropagation(); if (started) finish(a.reason, a.minutes ? { minutes: a.minutes } : null); });
      actsEl.appendChild(b);
    });
    hintEl.textContent = hasDone ? 'Enter: Xong  ·  S: Hoãn 5 phút  ·  Esc: Biết rồi' : 'Esc hoặc bấm vào bé: Biết rồi';
  }

  /* ------------ hiệu ứng va chạm ------------ */
  function palm(side) {
    // dấu bàn tay in trên kính: lòng bàn tay + 4 ngón + ngón cái, trắng ngà trong mờ (ngón cái hướng vào trong như bàn tay thật)
    return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" style="transform:scaleX(' + (side < 0 ? -1 : 1) + ')">' +
      '<g fill="#fff" fill-opacity=".6" stroke="#ffd0e6" stroke-opacity=".75" stroke-width="2">' +
      '<ellipse cx="50" cy="82" rx="30" ry="30"/><ellipse cx="25" cy="42" rx="8.5" ry="22" transform="rotate(-14 25 42)"/>' +
      '<ellipse cx="42" cy="30" rx="8.5" ry="25"/><ellipse cx="60" cy="30" rx="8.5" ry="25"/><ellipse cx="77" cy="42" rx="8.5" ry="21" transform="rotate(14 77 42)"/>' +
      '<ellipse cx="14" cy="78" rx="8" ry="17" transform="rotate(-48 14 78)"/></g></svg>';
  }
  function addNode(parent, el, ttl) {
    parent.appendChild(el); nodes.add(el);
    after(ttl, () => { nodes.delete(el); if (el.parentNode) el.parentNode.removeChild(el); });
  }
  function sparkles(x, y, n, spread) {
    const cols = ['#ffffff', '#ffe14d', '#ffb3d1', '#b8e4ff'];
    for (let i = 0; i < n; i++) {
      const sp = document.createElement('div'), el = document.createElement('i');
      sp.className = 'spark';
      const sz = Math.round(rnd(9, 20) * u), star = i % 3 !== 2;
      el.style.width = el.style.height = sz + 'px';
      el.style.background = cols[i % cols.length];
      el.style.clipPath = star ? 'polygon(50% 0,61% 36%,100% 38%,69% 60%,80% 100%,50% 76%,20% 100%,31% 60%,0 38%,39% 36%)' : 'circle(50%)';
      if (!star) el.style.opacity = '.85';
      sp.style.left = Math.round(x) + 'px'; sp.style.top = Math.round(y) + 'px';
      sp.appendChild(el);
      const ang = rnd(0, Math.PI * 2), dist = rnd(0.35, 1) * spread * S;
      addNode(fxEl, sp, 720);
      ani(sp, [{ transform: 'translate(0,0) rotate(0deg) scale(.2)', opacity: 1 }, { transform: 'translate(' + Math.round(Math.cos(ang) * dist * 0.7) + 'px,' + Math.round(Math.sin(ang) * dist * 0.7 - 0.02 * S) + 'px) rotate(' + Math.round(rnd(-90, 90)) + 'deg) scale(1.1)', opacity: 1, offset: 0.45 },
        { transform: 'translate(' + Math.round(Math.cos(ang) * dist) + 'px,' + Math.round(Math.sin(ang) * dist + 0.05 * S) + 'px) rotate(' + Math.round(rnd(-160, 160)) + 'deg) scale(0)', opacity: 0 }], { duration: Math.round(rnd(480, 680)), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
  }
  function crackAt(x, y) {
    if (cracks >= 4 || reduced) return;
    cracks++;
    const NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g');
    g.setAttribute('fill', 'none'); g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
    const n = 6 + Math.floor(rnd(0, 3)), paths = [];
    for (let i = 0; i < n; i++) {
      let ang = (i / n) * Math.PI * 2 + rnd(-0.25, 0.25), px = x, py = y, d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      const segs = 2 + Math.floor(rnd(0, 2));
      for (let s = 0; s < segs; s++) {
        const len = rnd(0.035, 0.07) * S; ang += rnd(-0.55, 0.55);
        px += Math.cos(ang) * len; py += Math.sin(ang) * len; d += ' L' + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      paths.push(d);
    }
    [['#ff9fc4', 5.5, 0.55], ['#ffffff', 2.4, 0.95]].forEach(st => {
      paths.forEach(d => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('stroke', st[0]); p.setAttribute('stroke-width', String(st[1] * u)); p.setAttribute('opacity', String(st[2])); p.setAttribute('pathLength', '1');
        p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '0';
        g.appendChild(p);
        ani(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
      });
    });
    cracksEl.appendChild(g); nodes.add(g);
    const star = document.createElementNS(NS, 'circle');
    star.setAttribute('cx', x.toFixed(1)); star.setAttribute('cy', y.toFixed(1)); star.setAttribute('r', String(0.012 * S)); star.setAttribute('fill', '#fff'); star.setAttribute('opacity', '.9');
    g.appendChild(star);
    sfx('crack');
  }
  function puffSmoke(n) {
    if (reduced || ending) return;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, el = document.createElement('div'), sz = Math.round(S * rnd(0.04, 0.075) * (L.smoke === 2 ? 1.35 : 1));
      el.className = 'puff'; el.style.width = el.style.height = sz + 'px';
      el.style.left = Math.round(cxC + side * S * rnd(0.1, 0.19) - sz / 2) + 'px';
      el.style.top = Math.round(charTop + S * rnd(0.17, 0.24)) + 'px';
      addNode(smokeEl, el, 1300);
      const dx = Math.round(side * S * rnd(0.02, 0.1)), dy = -Math.round(S * rnd(0.16, 0.3));
      ani(el, [{ transform: 'translate(0,0) scale(.3)', opacity: 0.95 }, { transform: 'translate(' + Math.round(dx * 0.4) + 'px,' + Math.round(dy * 0.4) + 'px) scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.7)', opacity: 0 }], { duration: Math.round(rnd(900, 1200)), easing: 'ease-out', fill: 'forwards' });
    }
  }
  function smokeLoop() {
    if (ending || !L.smoke) return;
    puffSmoke(L.smoke === 2 ? 2 : 1);
    after(L.smoke === 2 ? 240 : 420, smokeLoop);
  }
  function impact(a, quiet) {
    const side = a.side, tg = a.tg, gentle = quiet === 'gentle';
    slapN++;
    if (quiet !== true && !reduced) {
      const amp = Math.round(L.shake * u * 0.9 * (soft ? 0.33 : 1) * (gentle ? 0.3 : 1));
      const j = k => Math.round(amp * k);
      ani(shakeEl, [
        { transform: 'translate(0,0)' }, { transform: 'translate(' + j(-1) + 'px,' + j(0.7) + 'px)', offset: 0.18 },
        { transform: 'translate(' + j(0.85) + 'px,' + j(-0.75) + 'px)', offset: 0.36 }, { transform: 'translate(' + j(-0.55) + 'px,' + j(0.4) + 'px)', offset: 0.56 },
        { transform: 'translate(' + j(0.3) + 'px,' + j(-0.25) + 'px)', offset: 0.78 }, { transform: 'translate(0,0)' }
      ], { duration: 220 + 18 * cfg.level });
      if (cfg.level >= 3 && !soft && !gentle) ani(flashEl, [{ opacity: 0.03 + 0.012 * cfg.level }, { opacity: 0 }], { duration: 160 });
      ani(cardEl, [{ translate: '0 0' }, { translate: '0 ' + Math.round(5 * u * cfg.level / 2) + 'px', offset: 0.35 }, { translate: '0 0' }], { duration: 200 });
    }
    if (quiet !== true) sfx('thud', gentle ? 1 : cfg.level);
    // vệt in trên kính ĐÚNG chỗ tay áp vào, rồi mờ dần; gợn sóng
    const ps = Math.round(0.2 * S * 1.45 * 0.9);
    const pr = document.createElement('div');
    pr.className = 'print';
    pr.style.width = ps + 'px'; pr.style.height = Math.round(ps * 1.2) + 'px';
    pr.style.left = Math.round(tg.x + rnd(-4, 4)) + 'px'; pr.style.top = Math.round(tg.y - 0.02 * S) + 'px';
    pr.innerHTML = palm(side);
    pr.style.rotate = Math.round(side * rnd(-4, 6)) + 'deg';
    addNode(printsEl, pr, 2000);
    ani(pr, [{ opacity: 0.9, scale: '0.8' }, { opacity: 0.8, scale: '1.04', offset: 0.1 }, { opacity: 0 }], { duration: 1900, easing: 'ease-out', fill: 'forwards' });
    if (reduced) return;
    const rg = document.createElement('div');
    rg.className = 'ring';
    rg.style.width = rg.style.height = Math.round(ps * 0.8) + 'px';
    rg.style.left = Math.round(tg.x) + 'px'; rg.style.top = Math.round(tg.y) + 'px';
    addNode(printsEl, rg, 460);
    ani(rg, [{ opacity: 0.85, scale: '0.5' }, { opacity: 0, scale: '1.7' }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
    // bụi + sao bay
    sparkles(tg.x, tg.y - 0.02 * S, gentle ? 3 : soft ? 2 + cfg.level : 4 + 2 * cfg.level, (gentle ? 0.12 : 0.2 + 0.025 * cfg.level) * (soft ? 0.6 : 1));
    if (!gentle && (L.crack === 2 || (L.crack === 1 && slapN >= 2))) crackAt(tg.x + rnd(-0.02, 0.02) * S, tg.y - 0.03 * S);
    if (quiet) return;
    // chữ tượng thanh có viền comic, ngẫu nhiên, to dần theo mức
    const w = document.createElement('div');
    w.className = 'word';
    const txt = L.words[Math.floor(Math.random() * L.words.length)];
    w.textContent = txt;
    w.style.setProperty('--burst', L.burst);
    w.style.fontSize = Math.round(S * (0.062 + 0.012 * cfg.level) * rnd(0.94, 1.08) * (txt.length > 6 ? 0.68 : 1)) + 'px';
    w.style.left = Math.round(clamp(tg.x + side * S * rnd(0.04, 0.1), cxC - 0.1 * S, Math.min(dw - 0.15 * S, cxC + 0.42 * S))) + 'px';
    w.style.top = Math.round(tg.y + S * rnd(0.26, 0.34)) + 'px';
    const outside = cfg.level >= 4;
    while (wordsEl.firstChild) { nodes.delete(wordsEl.firstChild); wordsEl.removeChild(wordsEl.firstChild); }   // chỉ một chữ tại một thời điểm
    w.style.rotate = Math.round(side * rnd(6, 16) + rnd(-4, 4)) + 'deg';
    addNode(wordsEl, w, 820);
    if (outside) {          // mức 4-5: chữ nằm lệch ra ngoài vùng bé (bên phải), không che mặt/thân
      const hw = w.offsetWidth * 0.78;
      w.style.left = Math.round(Math.min(dw - hw - 8, cxC + 0.47 * S + hw * 0.9)) + 'px';
      w.style.top = Math.round(clamp(tg.y + S * rnd(-0.14, 0.2), 0.14 * dh, 0.84 * dh)) + 'px';
    }
    ani(w, [{ opacity: 0, scale: '0.3' }, { opacity: 1, scale: '1.3', offset: 0.2 }, { opacity: 1, scale: '1', offset: 0.45 }, { opacity: 1, scale: '1.03', offset: 0.78 }, { opacity: 0, scale: '1.12' }], { duration: 780, easing: 'ease-out', fill: 'forwards' });
  }
  function slap(i, gentle) {
    if (ending) return;
    const side = i % 2 ? 1 : -1, period = L.period;
    const y = Math.round(dh * 0.012 * Math.min(1.6, cfg.level * 0.5 + 0.5));
    // thân bé nhún theo nhịp: rướn lên lúc vung tay, ép dẹt xuống lúc đập
    ani(charEl, [
      { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
      { transform: 'translate(0,' + (-y) + 'px) rotate(' + (-side * 2) + 'deg) scale(0.97,1.04)', offset: 0.3 },
      { transform: 'translate(0,' + y + 'px) rotate(' + (side * 1.2 * cfg.level * 0.6) + 'deg) scale(1.15,0.93)', offset: 0.55 },
      { transform: 'translate(0,' + Math.round(y / 3) + 'px) rotate(0deg) scale(1.06,0.97)', offset: 0.76 },
      { transform: 'translate(0,0) rotate(0deg) scale(1,1)' }
    ], { duration: Math.min(420, period + 40), easing: 'ease-in-out' });
    const dur = Math.max(300, Math.min(520, 2 * period - 20));
    if (L.both && !gentle) arms.forEach((a, k) => runSlap(a, dur, k === 1));
    else runSlap(arms.find(x => x.side === side) || arms[0], dur, gentle ? 'gentle' : false);
  }

  /* ------------ diễn ------------ */
  function go() {
    if (started || !cfg) return;
    started = true; startAt = Date.now();
    const total = Math.max(1500, cfg.ms || 5500);
    endAt = startAt + total - 420;
    charEl.style.opacity = '1';
    sfx('whoosh');
    if (!reduced) raf = requestAnimationFrame(tick);
    else arms.forEach(a => drawArm(a, a.cur));
    const fadeIn = (el, ms, delay) => ani(el, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, delay: delay || 0, fill: 'forwards' });
    fadeIn(dimEl, 520);
    if (L.red) {
      const r = ani(redEl, [{ opacity: 0 }, { opacity: L.red === 2 ? 0.6 : 0.45 }], { duration: 600, fill: 'forwards' });
      if (r && !reduced && !soft && L.red === 2) r.onfinish = () => ani(redEl, [{ opacity: 0.45 }, { opacity: 0.95 }], { duration: cfg.level >= 5 ? 460 : 640, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    }
    // vào: bé "phóng" từ chỗ thú cưng, kéo dãn trên đường bay, đáp bẹp rồi bật lại
    const d = from, up = Math.round(dh * 0.09), dir = cfg.dir === 'left' ? -1 : 1;
    if (reduced) fadeIn(charEl, 260);
    else ani(charEl, [
      { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ') rotate(' + (-14 * dir) + 'deg)', opacity: 1, easing: 'cubic-bezier(.2,.6,.3,1)' },
      { transform: 'translate(' + Math.round(d.dx * 0.28) + 'px,' + (Math.round(d.dy * 0.28) - up) + 'px) scale(0.94,1.16) rotate(' + (6 * dir) + 'deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(0,0) scale(1.14,0.86) rotate(0deg)', opacity: 1, offset: 0.74, easing: 'ease-out' },
      { transform: 'translate(0,-' + Math.round(dh * 0.012) + 'px) scale(0.97,1.05)', opacity: 1, offset: 0.88 },
      { transform: 'translate(0,0) scale(1,1)', opacity: 1 }
    ], { duration: 700 });
    animateFace();
    // tờ note dán xuống kèm chuông
    const cardDelay = reduced ? 0 : 360;
    after(cardDelay > 0 ? 280 : 0, () => sfx('chime'));
    after(cardDelay, () => {
      if (reduced) { fadeIn(cardEl, 220); return; }
      ani(cardEl, [
        { opacity: 0, transform: 'translateY(' + Math.round(-60 * u) + 'px) rotate(-12deg) scale(.7)' },
        { opacity: 1, transform: 'translateY(' + Math.round(10 * u) + 'px) rotate(2.5deg) scale(1.04)', offset: 0.55 },
        { opacity: 1, transform: 'translateY(0) rotate(-1.4deg) scale(1)' }
      ], { duration: 520, fill: 'forwards', easing: 'cubic-bezier(.3,.7,.4,1)' });
      cardEl.style.rotate = '-1.4deg';
    });
    after(reduced ? 80 : 640, () => {
      const bs = Array.from(actsEl.children);
      ani(actsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' });
      if (!reduced) bs.forEach((b, i) => ani(b, [{ transform: 'translateY(' + Math.round(16 * u) + 'px) scale(.85)', opacity: 0 }, { transform: 'translateY(0) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 340, delay: i * 70, easing: 'ease-out', fill: 'backwards' }));
    });
    after(reduced ? 100 : 760, () => ani(sayEl, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(10px) scale(.8)' }, { opacity: 1, transform: 'translateY(0) scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 320, fill: 'forwards' }));
    after(reduced ? 200 : 1500, () => ani(hintEl, [{ opacity: 0 }, { opacity: 0.85 }], { duration: 300, fill: 'forwards' }));
    if (reduced) { after(Math.max(600, total - 420), pollEnd); return; }
    // mỗi tay vào cảnh: tay áo hiện dần từ vai
    after(380, () => ani(armsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }));
    armsEl.style.opacity = '0';
    if (L.smoke) after(900, smokeLoop);
    const first = 860, period = L.period, last = total - 900;
    for (let t = first, i = 0; t <= last && i < L.max; t += period, i++) { const n = i; after(t, () => slap(n)); }
    // mức 1-2: sau mấy cú đầu bé vẫn gõ nhẹ/vẫy mỗi ~1.8s cho tới hết giờ (kể cả lúc chờ vì rê chuột)
    if (L.max < 99) { const tap = n => { if (ending) return; slap(n, true); after(1800, () => tap(n + 1)); }; after(first + (L.max - 1) * period + 1800, () => tap(L.max)); }
    after(Math.max(first + period, total - 420), pollEnd);
  }
  // hết giờ thì tự thu về, nhưng nếu cậu đang rê chuột vào thẻ/nút thì chờ thêm (tối đa +9s)
  function pollEnd() {
    if (ending) return;
    const t = Date.now();
    if (t < holdUntil && t < endAt + 9000) { after(250, pollEnd); return; }
    finish('timeout');
  }
  function finish(reason, extra) {
    if (ending || !started) return;
    ending = true;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    anims.forEach(a => { try { a.cancel(); } catch (e) { /* bỏ qua */ } });
    anims.clear();
    const d = from, ok = reason === 'done';
    if (ok) { sfx('happy'); sparkles(cxC, charTop + 0.3 * S, 14, 0.5); } else if (reason === 'snooze') sfx('blip');
    const out = (el, ms, kf, delay) => ani(el, kf, { duration: ms, delay: delay || 0, fill: 'forwards', easing: 'ease-in' });
    const fade = (el, ms, delay) => out(el, ms, [{ opacity: 1 }, { opacity: 0 }], delay);
    const lag = ok ? 200 : 0;
    if (reduced) { out(charEl, 200, [{ opacity: 1 }, { opacity: 0 }]); } else {
      // ra: bé nhún lên rồi nhảy ngược về chỗ thú cưng, thu nhỏ dần
      out(charEl, 460, [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(0,' + (-Math.round(dh * 0.03)) + 'px) scale(0.96,1.08)', opacity: 1, offset: 0.2 },
        { transform: 'translate(' + Math.round(d.dx * 0.4) + 'px,' + Math.round(d.dy * 0.4 - dh * 0.05) + 'px) scale(' + (0.6) + ',0.7)', opacity: 1, offset: 0.65 },
        { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ')', opacity: 0.9, offset: 0.92 },
        { transform: 'translate(' + d.dx + 'px,' + d.dy + 'px) scale(' + d.s + ')', opacity: 0 }
      ], lag);
    }
    out(cardEl, 260, [{ opacity: 1, transform: 'scale(1) rotate(-1.4deg)' }, { opacity: 0, transform: 'scale(0.6) rotate(-6deg) translateY(-12px)' }], lag);
    fade(actsEl, 180, lag); fade(sayEl, 160, lag); fade(hintEl, 140, 0); fade(armsEl, 220, lag); fade(cracksEl, 240, lag);
    fade(smokeEl, 220, 0); fade(redEl, 360, lag); fade(dimEl, 380, lag); fade(wordsEl, 120, 0); fade(printsEl, 160, 0);
    setTimeout(() => sendEnd(reason, extra), 500 + lag);
  }
  function sendEnd(reason, extra) {
    if (endSent) return;
    endSent = true;
    cleanup();
    send('end', Object.assign({ reason: reason }, extra || {}));
  }
  function cleanup() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
  function overUi(x, y) {
    return [cardEl, actsEl].some(el => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && parseFloat(getComputedStyle(el).opacity) > 0.3;
    });
  }
  function setIgnore(v) { if (v === ignoring) return; ignoring = v; send('ignore', { v: v }); }
  document.addEventListener('mousemove', ev => {
    if (!started || ending) return;
    const ui = overUi(ev.clientX, ev.clientY), ch = !ui && overChar(ev.clientX, ev.clientY);
    if (ui) holdUntil = Date.now() + 1800;
    document.body.style.cursor = ch ? 'pointer' : '';
    setIgnore(!(ui || ch));
  });
  document.addEventListener('mouseleave', () => setIgnore(true));
  document.addEventListener('mousedown', ev => {
    if (!started || ending) return;
    if (ev.target && ev.target.closest && ev.target.closest('.btn')) return;
    if (overChar(ev.clientX, ev.clientY)) finish('click');          // bấm vào bé = "Biết rồi"
  });
  document.addEventListener('keydown', ev => {
    if (!started || ending || ev.repeat) return;
    if (ev.key === 'Escape') finish('esc');
    else if (ev.key === 'Enter' && hasDone) finish('done');
    else if ((ev.key === 's' || ev.key === 'S') && hasSnooze) finish('snooze', { minutes: 5 });
  });

  if (P) P.onCmd(c => {
    if (!c || !c.op) return;
    if (c.op === 'init') init(c).catch(() => send('loaded', {}));
    else if (c.op === 'go') go();
  });
  const boot = () => send('ready', {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
