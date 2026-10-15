// Cửa sổ bé Mochi (renderer). Hợp đồng: docs/rooms/core/ARCH.md mục 2.
(function () {
  'use strict';
  const P = window.mochi && window.mochi.pet;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), root = $('root'), shaker = $('shaker');
  const turnEl = $('turn'), actorEl = $('actor'), outBack = $('outBack'), outFront = $('outFront'), ballEl = $('ball'), fxEl = $('fx');
  const note = $('note'), bubble = $('bubble'), bShown = $('bShown'), bRest = $('bRest'), bBtns = $('bBtns'), bTail = $('bTail');
  const MP = window.MochiProps || null;
  const bedBack = $('bedBack'), bedFront = $('bedFront'), propFront = $('propFront'), groundProps = $('groundProps');
  const send = (t, d) => { try { P && P.send(t, d); } catch (e) { /* bỏ qua */ } };

  const COLORS = {
    yellow: ['#FFF7D1', '#F5E27A', '#3a2a2a'], green: ['#E4F9E0', '#BFE8B8', '#2a3a2a'],
    pink: ['#FFE4F1', '#F7B9D6', '#3a2a35'], purple: ['#F2E6FF', '#D9BFF5', '#322a3f'],
    blue: ['#E2F1FF', '#B5D8F7', '#2a3340'], gray: ['#F3F2F1', '#D6D4D1', '#333'],
    charcoal: ['#4A4A4A', '#2f2f2f', '#f2f2f2']
  };

  let pack = null, layout = { winW: 400, winH: 400, charLeft: 0, charTop: 0, scale: 1 };
  let dir = 'right', settings = { sound: true };
  let anim = null, loading = false, queued = [];
  let curNote = null;
  const dpr = () => window.devicePixelRatio || 1;

  /* ------------ dáng nghiêng (walk_side) — chỉ hoạt động khi gói có hình; không có thì mọi thứ như cũ ------------ */
  let sideOn = false, sideGen = 0, sideBad = false, curSrc = '';
  const SIDE_RE = /^(walk_side|turn_side|run_side)\//;
  const inSide = () => SIDE_RE.test(curSrc);
  const okArr = (v, n) => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && isFinite(x));
  const sideCfg = () => (inSide() && pack && pack.side && typeof pack.side === 'object') ? pack.side : null;
  function curAnchor() { const s = sideCfg(); return s && okArr(s.anchor, 2) ? s.anchor : pack.anchor; }
  function curHand() { const s = sideCfg(); return s && okArr(s.hand, 2) ? s.hand : pack.hand; }
  function curHeadHit() { const s = sideCfg(); return s && okArr(s.head, 4) ? s.head : (pack.hitbox && pack.hitbox.head); }
  function hasPhase(action, phase) {
    const a = pack && pack.anims && pack.anims[action];
    return !!a && Object.keys(a).some(m => a[m] && a[m][phase] && a[m][phase].length);
  }

  /* ------------ hình học ------------ */
  function cw() { return (pack ? pack.size[0] : 200) * layout.scale; }
  function ch() { return (pack ? pack.size[1] : 200) * layout.scale; }
  // điểm trên canvas gói -> toạ độ trong cửa sổ
  function toWin(px, py) {
    let x = px * layout.scale;
    if (dir === 'left') x = cw() - x;
    return [layout.charLeft + x, layout.charTop + py * layout.scale];
  }
  // hộp [x,y,w,h] của gói -> {l,t,r,b} trong cửa sổ
  function boxWin(b) {
    if (!b) return null;
    const a = toWin(b[0], b[1]), c = toWin(b[0] + b[2], b[1] + b[3]);
    return { l: Math.min(a[0], c[0]), r: Math.max(a[0], c[0]), t: Math.min(a[1], c[1]), b: Math.max(a[1], c[1]) };
  }
  const inBox = (bx, x, y) => bx && x >= bx.l && x <= bx.r && y >= bx.t && y <= bx.b;

  function layoutAll() {
    cv.style.left = layout.charLeft + 'px';
    cv.style.top = layout.charTop + 'px';
    cv.style.width = cw() + 'px';
    cv.style.height = ch() + 'px';
    placeNote();
    placeBubble();
    placeOutfit();
    placeFoot();
    placeBed();
  }

  /* ------------ tờ note ------------ */
  function placeNote() {
    if (!pack || note.hidden) return;
    const hp = curHand(), h = toWin(hp[0], hp[1]);
    const W = 120, H = 110, left = dir === 'left';
    let x = left ? h[0] - W : h[0], y = h[1] - H;
    x = Math.max(0, Math.min(layout.winW - W, x));
    y = Math.max(0, Math.min(layout.winH - H, y));
    note.style.left = x + 'px'; note.style.top = y + 'px';
    note.classList.toggle('faceL', left);
  }
  function setNote(n) {
    curNote = n || null;
    if (!n) { note.hidden = true; return; }
    const c = COLORS[n.color] || COLORS.yellow;
    note.style.setProperty('--paper', c[0]);
    note.style.setProperty('--head', c[1]);
    note.style.setProperty('--txt', c[2]);
    note.className = (n.kind || 'memo') + (n.color === 'charcoal' ? ' charcoal' : '');
    $('nBig').textContent = n.big || '';
    $('nTitle').textContent = n.title || '';
    $('nMeta').textContent = n.meta || '';
    note.hidden = false;
    placeNote();
  }

  /* ------------ bong bóng ------------ */
  let typeTimer = 0, ttlTimer = 0, chars = [], shownN = 0, bubbleOn = false;
  function placeBubble() {
    if (!bubbleOn || !pack) return;
    const bh = bedHead();
    const hb = bh ? { l: bh[0] - 40, r: bh[0] + 40, t: bh[1] - 45, b: bh[1] + 45 } : boxWin(curHeadHit()) || { l: layout.charLeft, r: layout.charLeft + cw(), t: layout.charTop, b: layout.charTop + ch() / 3 };
    const w = bubble.offsetWidth, h = bubble.offsetHeight, cx = (hb.l + hb.r) / 2;
    let x = Math.max(4, Math.min(layout.winW - w - 4, cx - w / 2));
    let y = hb.t - h - 12;
    y = Math.max(4, Math.min(layout.winH - h - 4, y));
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
    const tx = Math.max(16, Math.min(w - 16, cx - x));
    bTail.style.left = tx + 'px';
    // đuôi chỉ xuống; nếu bong bóng nằm thấp hơn đỉnh đầu (bị kẹp) thì ẩn đuôi
    bTail.style.display = (y + h + 4 <= hb.t + 8) ? '' : 'none';
  }
  function clearSay() {
    clearInterval(typeTimer); clearTimeout(ttlTimer); typeTimer = ttlTimer = 0;
  }
  function revealAll() {
    if (!bubbleOn) return;
    clearInterval(typeTimer); typeTimer = 0;
    shownN = chars.length; bShown.textContent = chars.join(''); bRest.textContent = '';
  }
  function say(c) {
    clearSay();
    chars = Array.from(String(c.text == null ? '' : c.text));
    shownN = 0; bShown.textContent = ''; bRest.textContent = chars.join('');
    bubble.classList.toggle('big', !!c.big);
    bBtns.textContent = '';
    const btns = Array.isArray(c.buttons) ? c.buttons : [];
    btns.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label; el.dataset.id = b.id;
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        bBtns.querySelectorAll('button').forEach(x => { x.disabled = true; });
        send('button', { id: b.id });
      });
      bBtns.appendChild(el);
    });
    // phát lại hiệu ứng xuất hiện
    bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
    bubble.hidden = false; bubbleOn = true;
    placeBubble();
    if (btns.length) revealAll();
    else if (chars.length) {
      typeTimer = setInterval(() => {
        shownN++;
        bShown.textContent = chars.slice(0, shownN).join('');
        bRest.textContent = chars.slice(shownN).join('');
        if (shownN >= chars.length) { clearInterval(typeTimer); typeTimer = 0; }
      }, 35);
    }
    if (c.ttlMs > 0) ttlTimer = setTimeout(() => { hush(); send('sayEnd', {}); }, c.ttlMs);
  }
  function hush() { clearSay(); bubbleOn = false; bubble.hidden = true; }
  bubble.addEventListener('click', () => { if (typeTimer) revealAll(); });

  /* ------------ âm thanh ------------ */
  let ac = null;
  function actx() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
    return ac;
  }
  function tone(c, f, t0, vol, dur, type) {
    [[f, vol], [f * 2, vol * 0.18]].forEach(([fr, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  // tiếng nhiễu (vò giấy, gió): bursts > 0 thì cắt thành nhiều tiếng sột soạt ngắn
  function noise(c, t0, dur, freq, vol, bursts, sweep) {
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      let env = 1;
      if (bursts) { const k = (i / n) * bursts; env = Math.pow(Math.max(0, Math.sin(Math.PI * (k % 1))), 3) * (0.5 + Math.random() * 0.5); }
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    if (sweep) { f.frequency.setValueAtTime(freq * 0.4, t0); f.frequency.exponentialRampToValueAtTime(freq * 1.6, t0 + dur); }
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function thud(c, t0, f0, vol) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.2);
  }
  function sound(name) {
    if (settings.sound === false) return;
    // 'ding:0.35' = ding ở độ to 0..1 do stage tính (âm lượng x giờ yên lặng); 'ding' trơn = alertVolume/100. Độ to 0.7 = như cũ.
    let lv = null;
    const mm = /^(w+):([d.]+)$/.exec(String(name));
    if (mm) { name = mm[1]; lv = Math.min(1, Math.max(0, parseFloat(mm[2]))); }
    if (name === 'ding') {
      if (lv == null) lv = (typeof settings.alertVolume === 'number' ? Math.min(100, Math.max(0, settings.alertVolume)) : 70) / 100;
      if (!(lv > 0)) return;
    }
    const dk = lv == null ? 1 : lv / 0.7;
    const real = actx(); if (!real) return;
    let c = real;
    if (name === 'ding' && dk !== 1) {         // chỉ ding đi qua GainNode riêng; các tiếng khác giữ nguyên
      try {
        const mg = real.createGain(); mg.gain.value = Math.min(1.5, dk); mg.connect(real.destination);
        c = new Proxy(real, { get(tg, k) { if (k === 'destination') return mg; const v = tg[k]; return typeof v === 'function' ? v.bind(tg) : v; } });
      } catch (_) { c = real; }
    }
    const t = c.currentTime + 0.02;
    if (name === 'ding') {
      for (let r = 0; r < 2; r++) { tone(c, 1318.5, t + r * 0.7, 0.22, 0.9); tone(c, 1046.5, t + r * 0.7 + 0.2, 0.22, 0.9); }
    } else if (name === 'pop') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.16);
    } else if (name === 'crumple') {
      noise(c, t, 0.45, 2600, 0.22, 18);
    } else if (name === 'knock') {
      [0, 0.22].forEach(d => thud(c, t + d, 190, 0.5));
    } else if (name === 'thunk') {
      thud(c, t, 120, 0.45); noise(c, t, 0.12, 900, 0.12, 0);
    } else if (name === 'coin') {
      tone(c, 1568, t, 0.16, 0.18); tone(c, 2093, t + 0.08, 0.16, 0.35);
    } else if (name === 'boing') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.12); o.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35);
    } else if (name === 'whoosh') {
      noise(c, t, 0.35, 1400, 0.14, 0, true);
    } else if (name === 'tada') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.09, 0.14, 0.5));
    } else if (name === 'alarm') {
      for (let r = 0; r < 3; r++) {
        const b = t + r * 0.9;
        tone(c, 1568, b, 0.4, 0.35, 'triangle'); tone(c, 1318.5, b + 0.15, 0.4, 0.35, 'triangle');
        tone(c, 1568, b + 0.3, 0.4, 0.35, 'triangle'); tone(c, 1318.5, b + 0.45, 0.4, 0.45, 'triangle');
      }
    }
  }

  /* ------------ click xuyên ------------ */
  let ignored = true, hovering = false, lifted = false, faded = false;
  function setIgnore(v) {
    if (v === ignored) return;
    ignored = v;
    try { P && P.ignore(v); } catch (e) { /* bỏ qua */ }
  }
  function setHover(on) {
    if (on === hovering) return;
    hovering = on; send('hover', { on });
  }
  function overUi(t) { return !!(t && t.closest && t.closest('#bubble, #note')); }
  function overChar(x, y) {
    if (!anim || !pack) return false;
    if (bed.on) { // đang nằm: vùng giường thay cho alpha của khung hình đứng
      const f = footPt(), r = rr();
      return x >= f[0] - 115 * r && x <= f[0] + 115 * r && y >= f[1] - 100 * r && y <= f[1] + 4;
    }
    const rx = x - layout.charLeft, ry = y - layout.charTop;
    if (rx < 0 || ry < 0 || rx >= cw() || ry >= ch()) return false;
    try { return anim.alphaAt(rx, ry) > 24; } catch (e) { return false; }
  }
  function updateIgnore(ev) {
    if (lifted) { setIgnore(false); return; }
    if (faded) { setIgnore(true); setHover(false); return; }
    const hit = overUi(ev.target) || overChar(ev.clientX, ev.clientY);
    setIgnore(!hit); setHover(hit);
  }

  /* ------------ xoa ------------ */
  const pat = { zone: null, lastX: 0, dirn: 0, flips: [], cool: 0 };
  function trackPat(ev) {
    if (!pack || ev.buttons || lifted || bed.on) { pat.zone = null; return; }
    const now = performance.now(), x = ev.clientX, y = ev.clientY;
    if (now < pat.cool) return;
    const hb = boxWin(curHeadHit()), bb = boxWin(pack.hitbox && pack.hitbox.body);
    const zone = inBox(hb, x, y) ? 'head' : inBox(bb, x, y) ? 'body' : null;
    if (zone !== pat.zone) { pat.zone = zone; pat.flips = []; pat.dirn = 0; pat.lastX = x; return; }
    if (!zone) return;
    const dx = x - pat.lastX;
    if (Math.abs(dx) < 3) return;
    const d = dx > 0 ? 1 : -1;
    pat.lastX = x;
    if (pat.dirn && d !== pat.dirn) {
      pat.flips.push(now);
      pat.flips = pat.flips.filter(t => now - t <= 1500);
      if (pat.flips.length >= 5) {
        send('interact', { kind: zone === 'head' ? 'pat-head' : 'pat-body' });
        pat.flips = []; pat.cool = now + 1200; pat.dirn = 0; return;
      }
    }
    pat.dirn = d;
  }

  /* ------------ cử chỉ nhấn ------------ */
  let down = null, clicks = [], lastWheel = 0;
  cv.addEventListener('wheel', ev => {
    if (!overChar(ev.clientX, ev.clientY)) return;
    const now = performance.now();
    if (now - lastWheel < 450) return;
    lastWheel = now;
    send('interact', { kind: 'wheel', dir: ev.deltaY > 0 ? 1 : -1 });
  }, { passive: true });
  cv.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || down) return;
    if (!overChar(ev.clientX, ev.clientY)) return;
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* bỏ qua */ }
    down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lift: false, timer: 0 };
    warm('lifted', 'fall', 'land', 'pat_head');   // sắp nhấc/vỗ đầu: nạp trước
    down.timer = setTimeout(() => startLift(), 300);
  });
  function startLift() {
    if (!down || down.lift) return;
    clearTimeout(down.timer);
    down.lift = true; lifted = true; cv.classList.add('lifted'); bedExitNow();
    setIgnore(false); send('lift', {});
  }
  cv.addEventListener('pointermove', ev => {
    if (!down || down.lift || ev.pointerId !== down.id) return;
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) startLift();
  });
  function endPress(ev, cancel) {
    if (!down || ev.pointerId !== down.id) return;
    clearTimeout(down.timer);
    const was = down; down = null;
    try { cv.releasePointerCapture(ev.pointerId); } catch (e) { /* bỏ qua */ }
    if (was.lift) { lifted = false; cv.classList.remove('lifted'); send('drop', {}); updateIgnore(ev); }
    else if (!cancel) {
      // chọc liên tục: đếm số cú bấm sát nhau
      const now = performance.now();
      clicks = clicks.filter(t => now - t < 700); clicks.push(now);
      send('interact', { kind: 'click', n: clicks.length });
    }
  }
  cv.addEventListener('pointerup', ev => endPress(ev, false));
  cv.addEventListener('pointercancel', ev => endPress(ev, true));
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); if (overChar(ev.clientX, ev.clientY)) send('menu', {}); });
  cv.addEventListener('dblclick', ev => { if (overChar(ev.clientX, ev.clientY)) send('interact', { kind: 'dblclick' }); });
  note.addEventListener('click', () => send('noteClick', {}));

  document.addEventListener('pointermove', ev => { updateIgnore(ev); trackPat(ev); });
  document.addEventListener('mousemove', ev => { updateIgnore(ev); trackPat(ev); });
  document.addEventListener('mouseleave', () => { if (!lifted) { setIgnore(true); setHover(false); } });


  /* ------------ đồ mặc ------------ */
  const OUT = window.MochiOutfit || { ANCHOR: {}, POSE: {}, FRAME: 400 };
  let outfit = [], curAction = 'idle', wear = null, wearStyle = null;
  // phụ kiện bám theo đầu (mũ, kẹp, kính) đi trọn độ lệch đầu; cổ/tay/lưng đi theo một phần
  const FOLLOW = { hat: 1, hairclip: 1, glasses: 1, neck: 0.8, hand: 0.6, back: 0.7 };
  function redrawCurrent() {
    if (!anim || !anim.cache || !curSrc) return;
    const img = anim.cache.get(curSrc);
    if (img) anim._drawFrame(anim.filter ? anim.filter(img, curSrc) || img : img);
  }
  function setWear(style) {
    wearStyle = style || null;
    if (wear && wear.setStyle(wearStyle)) redrawCurrent();
  }
  function placeFoot() {
    if (!pack) return;
    const f = toWin(curAnchor()[0], curAnchor()[1]);
    [actorEl, turnEl].forEach(el => { el.style.setProperty('--foot-x', f[0] + 'px'); el.style.setProperty('--foot-y', f[1] + 'px'); });
  }
  function placeOutfit() {
    if (!pack) return;
    const k = pack.size[0] / (OUT.FRAME || 400);
    const hd = wear && curSrc ? wear.head(curSrc) : null;
    // đang nghiêng mà thiếu độ lệch đầu (head_side.json) -> ẩn đồ đội đầu/cầm tay/phụ kiện để khỏi lệch
    const side = inSide() && !!(wear && wear.hasHead(curSrc));
    const hideSide = inSide() && !side;
    const SD = OUT.SIDE || null, hs = side ? (hd && hd[2] > 0 ? hd[2] : (SD && SD.s) || 1) : 1;     // hs: tỉ lệ đầu khung nghiêng (nếu head_side.json có)
    const pose = hd ? { dx: hd[0], dy: hd[1], rot: 0 } : (OUT.POSE[curAction] || { dx: 0, dy: 0, rot: 0 });
    outfit.forEach(o => {
      const a = OUT.ANCHOR[o.slot]; if (!a) return;
      const sc = side && SD ? SD[o.slot] : null;
      const tn = side && SD && SD.turn && /^turn_side\//.test(curSrc) && pose.dx < SD.turn.maxDx && SD.turn.hide.indexOf(o.slot) >= 0;
      const hid = hideSide || tn || (sc && (sc.hide || (sc.side && o.badSide)));     // thiếu bản nghiêng -> ẩn, không vẽ sai
      o.el.style.display = hid ? 'none' : '';
      if (hid) return;
      // đồ có bản vẽ nghiêng: đổi hình theo dáng (nghiêng <-> thẳng)
      const want = sc && sc.side ? o.sideSrc : o.src;
      if (want && o.cur !== want) { o.cur = want; o.el.src = want; }
      const f = hd ? (FOLLOW[o.slot] || 1) : 1;
      let px, py, sz;
      if (sc) {
        // dáng nghiêng: neo quanh tâm đầu C, co theo tỉ lệ đầu hs, cộng lệch off của từng loại đồ
        const cc = SD.C, off = (sc.off || [0, 0]).slice();
        if (sc.lean) { const ln = Math.max(0, Math.min(1, (pose.dx - 25) / 25)); off[0] += sc.lean[0] * ln; off[1] += sc.lean[1] * ln; }
        px = cc[0] + pose.dx * f + (a[0] + off[0] - cc[0]) * hs; py = cc[1] + pose.dy * f + (a[1] + off[1] - cc[1]) * hs;
        sz = (sc.size || a[2]) * hs * k * layout.scale;
      } else { px = a[0] + pose.dx * f; py = a[1] + pose.dy * f; sz = a[2] * k * layout.scale; }
      const c = toWin(px * k, py * k);
      o.el.style.left = (c[0] - sz / 2) + 'px'; o.el.style.top = (c[1] - sz / 2) + 'px';
      o.el.style.width = sz + 'px'; o.el.style.height = sz + 'px';
      o.el.style.zIndex = a[3];
      const sxv = sc && sc.sx ? sc.sx : 1;
      o.el.style.transform = ((dir === 'left' ? -1 : 1) * sxv !== 1 ? 'scaleX(' + ((dir === 'left' ? -1 : 1) * sxv) + ') ' : '') + (pose.rot ? 'rotate(' + (dir === 'left' ? -pose.rot : pose.rot) + 'deg)' : '');
    });
    placeProps();
  }
  function setOutfit(items) {
    outBack.textContent = ''; outFront.textContent = ''; outfit = [];
    (Array.isArray(items) ? items : []).forEach(it => {
      const a = OUT.ANCHOR[it.slot]; if (!a || typeof it.src !== 'string') return;
      const im = document.createElement('img'); im.alt = ''; im.draggable = false; im.src = it.src;
      const ss = OUT.sideSrc && it.slot === 'glasses' ? OUT.sideSrc(it.src) : null;   // bản vẽ nghiêng (nếu có); lỗi tải -> ẩn
      const rec = { slot: it.slot, el: im, src: it.src, sideSrc: ss, cur: it.src };
      im.addEventListener('error', () => { if (ss && rec.cur === ss) { rec.badSide = true; placeOutfit(); } });
      (a[3] < 2 ? outBack : outFront).appendChild(im);
      outfit.push(rec);
    });
    placeOutfit();
  }

  /* ------------ cử động cả thân (canvas + đồ mặc + bóng giấy) ------------ */
  let moveTimer = 0, moveDone = null;
  const MOVES = new Set(['hop', 'tap', 'stomp', 'spin', 'dance', 'stretch', 'shiver', 'nod', 'bow', 'wiggle', 'glass', 'throw', 'look', 'squash',
    'yawn', 'munch', 'sip', 'sweep', 'read', 'bob', 'tiptoe']);
  function move(c) {
    clearTimeout(moveTimer);
    if (moveDone) { const d = moveDone; moveDone = null; d(); }
    actorEl.className = '';
    if (!MOVES.has(c.kind)) { send('animEnd', { token: c.token, action: 'move' }); return; }
    void actorEl.offsetWidth;
    if (c.n) actorEl.style.setProperty('--n', String(Math.max(1, Math.min(30, c.n))));
    else actorEl.style.removeProperty('--n');
    // nghiêng về phía mặt đang nhìn (c.away: ngược lại)
    actorEl.style.setProperty('--lean', String((dir === 'left' ? -1 : 1) * (c.away ? -1 : 1)));
    actorEl.className = 'm-' + c.kind;
    const onEnd = ev => { if (ev.target === actorEl && moveDone) { const d = moveDone; moveDone = null; d(); } };
    moveDone = () => {
      clearTimeout(moveTimer);
      actorEl.removeEventListener('animationend', onEnd);
      actorEl.className = '';
      send('animEnd', { token: c.token, action: 'move:' + c.kind });
    };
    actorEl.addEventListener('animationend', onEnd);
    moveTimer = setTimeout(() => { if (moveDone) { const d = moveDone; moveDone = null; d(); } }, 9000);
  }

  /* ------------ bóng giấy ------------ */
  function handPoint() { return pack ? toWin(curHand()[0], curHand()[1]) : [layout.winW / 2, layout.winH - 80]; }
  function setBall(c) {
    if (!c || !c.on) { ballEl.hidden = true; ballEl.className = ''; return; }
    const col = COLORS[c.color] || COLORS.yellow;
    ballEl.style.setProperty('--paper', col[0]);
    const h = handPoint();
    ballEl.style.left = h[0] + 'px'; ballEl.style.top = (h[1] - 6) + 'px';
    ballEl.className = 'pop'; ballEl.hidden = false;
  }
  function crumple(c) {
    c = c || {};
    if (note.hidden) { setBall({ on: true, color: c.color }); send('animEnd', { token: c.token, action: 'crumple' }); return; }
    note.classList.add('crumple');
    setTimeout(() => {
      note.classList.remove('crumple'); note.hidden = true; curNote = null;
      setBall({ on: true, color: c.color });
      send('animEnd', { token: c.token, action: 'crumple' });
    }, 700);
  }
  function toss(c) {
    if (ballEl.hidden) { send('animEnd', { token: c.token, action: 'toss' }); return; }
    const h = handPoint(), ms = c.ms || 700;
    const tx = (typeof c.x === 'number' ? c.x : (dir === 'left' ? -60 : layout.winW + 60)) - h[0];
    const ty = (typeof c.y === 'number' ? c.y : h[1] - 40) - h[1];
    ballEl.style.setProperty('--tx', tx + 'px'); ballEl.style.setProperty('--ty', ty + 'px');
    ballEl.style.setProperty('--dur', ms + 'ms');
    ballEl.className = ''; void ballEl.offsetWidth; ballEl.className = 'toss';
    setTimeout(() => { ballEl.hidden = true; ballEl.className = ''; send('animEnd', { token: c.token, action: 'toss' }); }, ms + 20);
  }

  /* ------------ hiệu ứng ------------ */
  const FX = {
    bonk: { chars: ['💥', '✦', '✧', '⭐'], n: 5, cls: 'f-burst', spread: 46 },
    hearts: { chars: ['💗', '💕', '💖'], n: 5, cls: 'f-float', spread: 40 },
    notes: { chars: ['♪', '♫', '♬'], n: 6, cls: 'f-float', spread: 50, color: '#8f78e8', size: 22 },
    sparkle: { chars: ['✨', '✦', '✧'], n: 7, cls: 'f-burst', spread: 60 },
    sweat: { chars: ['💦'], n: 2, cls: 'f-float', spread: 18 },
    anger: { chars: ['💢'], n: 1, cls: 'f-burst', spread: 0 },
    question: { chars: ['❓'], n: 1, cls: 'f-float', spread: 0 },
    exclaim: { chars: ['❗'], n: 1, cls: 'f-burst', spread: 0 },
    zzz: { chars: ['💤'], n: 2, cls: 'f-float', spread: 20 },
    dust: { chars: ['💨'], n: 3, cls: 'f-float', spread: 30 },
    confetti: { chars: ['🎉', '🎊', '✨', '⭐', '💖', '🌸'], n: 16, cls: 'f-fall', spread: 140 },
    flower: { chars: ['🌸', '🌼', '🌷'], n: 6, cls: 'f-fall', spread: 120 },
    idea: { chars: ['💡'], n: 1, cls: 'f-burst', spread: 0 },
    yum: { chars: ['🍡', '😋', '✨'], n: 3, cls: 'f-float', spread: 30 },
    dizzy: { chars: ['💫', '⭐', '💫', '✦'], n: 6, cls: 'f-burst', spread: 34 },
    blush: { chars: ['💗', '///'], n: 2, cls: 'f-float', spread: 26 },
    pout: { chars: ['💢', '😤'], n: 2, cls: 'f-burst', spread: 22 }
  };
  function headPoint() {
    const bh = bedHead();
    if (bh) return [bh[0], bh[1] - 30];
    const hb = pack && boxWin(curHeadHit());
    return hb ? [(hb.l + hb.r) / 2, hb.t + 10] : [layout.winW / 2, layout.charTop + 30];
  }
  function spawn(text, cls, x, y, vars) {
    const i = document.createElement('i');
    i.className = cls; i.textContent = text;
    i.style.left = x + 'px'; i.style.top = y + 'px';
    Object.keys(vars || {}).forEach(k => i.style.setProperty(k, vars[k]));
    fxEl.appendChild(i);
    setTimeout(() => i.remove(), 4500);
    return i;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // phần tử fx hình khối (không chữ); class k = giữ hoạt ảnh khi bật prefers-reduced-motion
  function blob(cls, x, y, w, h, vars, delay) {
    const el = spawn('', cls + ' k', x, y, vars);
    if (w) { el.style.width = w + 'px'; el.style.height = h + 'px'; }
    if (delay) el.style.animationDelay = delay.toFixed(2) + 's';
    return el;
  }
  function fxNew(c, at) {
    const k = c.kind, face = dir === 'left' ? -1 : 1, r = rr();
    if (k === 'bubbles') {
      for (let i = 0; i < 7; i++) {
        const s = rnd(10, 24);
        blob('f-bub', at[0] - s / 2 + rnd(-10, 10), at[1] - s / 2 + rnd(-6, 6), s, s,
          { '--dx': rnd(-16, 16).toFixed(0) + 'px', '--dy': rnd(-110, -70).toFixed(0) + 'px', '--d': rnd(2.2, 2.8).toFixed(2) + 's' }, i * 0.2);
      }
      return true;
    }
    if (k === 'steam') {
      for (let i = 0; i < 3; i++) blob('f-steam', at[0] - 4 + (i - 1) * 7, at[1] - 10, 0, 0, { '--dx': rnd(4, 9).toFixed(0) + 'px', '--d': rnd(1.6, 2).toFixed(2) + 's' }, i * 0.35);
      return true;
    }
    if (k === 'crumbs') {
      for (let i = 0; i < 6; i++) {
        const s = rnd(3, 6);
        blob('f-crumb', at[0] + rnd(-8, 8), at[1], s, s, { '--dx': rnd(-14, 14).toFixed(0) + 'px', '--dy': rnd(55, 90).toFixed(0) + 'px', '--r': rnd(-200, 200).toFixed(0) + 'deg', '--d': rnd(0.6, 0.9).toFixed(2) + 's' }, i * 0.07);
      }
      return true;
    }
    if (k === 'water') {
      const ox = c.at != null ? 0 : face * 40 * r;
      for (let i = 0; i < 7; i++) {
        blob('f-drop', at[0] + ox + face * rnd(0, 10), at[1] - 6, 0, 0, { '--dx': (face * rnd(6, 20)).toFixed(0) + 'px', '--dy': rnd(50, 80).toFixed(0) + 'px', '--r': '0deg', '--d': rnd(0.5, 0.7).toFixed(2) + 's' }, i * 0.09);
      }
      return true;
    }
    if (k === 'dust') {
      for (let i = 0; i < 6; i++) {
        const s = rnd(10, 18), side = i % 2 ? 1 : -1;
        blob('f-puff', at[0] + side * rnd(8, 22) - s / 2, at[1] - s - 2, s, s, { '--dx': (side * rnd(14, 34)).toFixed(0) + 'px', '--dy': rnd(-14, -2).toFixed(0) + 'px', '--d': rnd(0.55, 0.8).toFixed(2) + 's' }, i * 0.03);
      }
      return true;
    }
    if (k === 'zzz') {
      [22, 17, 13].forEach((fs, i) => {
        const el = spawn('Z', 'f-z k', at[0] + face * (8 + i * 10), at[1] - 8 - i * 10, { '--dx': (face * (24 + i * 8)).toFixed(0) + 'px', '--dy': (-34 - i * 14) + 'px', '--d': '2.2s' });
        el.style.fontSize = fs + 'px';
        el.style.animationDelay = (i * 0.55).toFixed(2) + 's';
      });
      return true;
    }
    if (k === 'stars') {
      for (let i = 0; i < 8; i++) {
        const el = spawn(i % 3 ? '✦' : '✧', 'f-star k', layout.charLeft + rnd(-12, cw() + 12), layout.charTop + rnd(10, ch() * 0.85), { '--d': rnd(1.1, 1.6).toFixed(2) + 's' });
        el.style.fontSize = Math.round(rnd(10, 20)) + 'px';
        el.style.animationDelay = (i * 0.15 + rnd(0, 0.15)).toFixed(2) + 's';
      }
      return true;
    }
    if (k === 'butterfly') { butterfly(); return true; }
    return false;
  }
  function butterfly() {
    const el = document.createElement('i');
    el.className = 'f-bfly k';
    el.innerHTML = '<svg viewBox="0 0 28 24" width="28" height="24"><g stroke="#3a2a4d" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
      '<g class="wl"><path d="M14 12 C8 0 -1 3 2 10 C3 14 9 14 14 12 Z" fill="#ffb3d9"/><path d="M14 12 C9 14 4 17 6 21 C9 24 13 18 14 12 Z" fill="#ffd1e8"/></g>' +
      '<g class="wr"><path d="M14 12 C20 0 29 3 26 10 C25 14 19 14 14 12 Z" fill="#ffb3d9"/><path d="M14 12 C19 14 24 17 22 21 C19 24 15 18 14 12 Z" fill="#ffd1e8"/></g>' +
      '<path d="M14 7 L14 18" stroke-width="2.4"/><path d="M14 7 Q12 3 10 3 M14 7 Q16 3 18 3" fill="none"/></g></svg>';
    el.style.left = '0px'; el.style.top = '0px';
    fxEl.appendChild(el);
    const cx = layout.charLeft + cw() / 2, cy = layout.charTop + ch() * 0.4;
    const rx = Math.min(80, layout.winW / 2 - 24), ry = 44, T = 4600, t0 = performance.now();
    const orbit = t => { const a = t / 1000 * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a * 1.5)]; };
    let last = null, done = false;
    const stop = () => { if (done) return; done = true; el.remove(); };
    setTimeout(stop, T + 3000);
    (function tick(now) {
      if (done) return;
      const t = now - t0;
      if (t >= T) { stop(); return; }
      let p = orbit(t);
      if (t < 500) { const w = 1 - Math.pow(1 - t / 500, 2); p = [layout.winW + 20 + (p[0] - layout.winW - 20) * w, 10 + (p[1] - 10) * w]; }
      if (t > 3900) { const u = Math.pow((t - 3900) / (T - 3900), 2); p = [p[0] + (layout.winW + 40 - p[0]) * u, p[1] + (-30 - p[1]) * u]; el.style.opacity = String(1 - u * 0.8); }
      const vx = last ? p[0] - last[0] : 1; last = p;
      el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px) scaleX(' + (vx >= 0 ? 1 : -1) + ') rotate(' + (vx >= 0 ? 12 : -12) + 'deg)';
      requestAnimationFrame(tick);
    })(t0);
  }
  function fx(c) {
    const HANDFX = { steam: 1, crumbs: 1, water: 1, bubbles: 1 };
    const at = c.at === 'hand' ? handPoint() : Array.isArray(c.at) ? c.at : (c.at == null && HANDFX[c.kind]) ? handPoint() : (c.at == null && c.kind === 'dust') ? footPt() : headPoint();
    if (fxNew(c, at)) return;
    if (c.kind === 'coin') { spawn('+' + (c.n || 0) + ' xu 🪙', 'f-coin', at[0] - 40, at[1] - 10, { '--dy': '-80px' }); return; }
    if (c.kind === 'text') { spawn(String(c.text || '').slice(0, 24), 'f-text', at[0] - 40, at[1] - 24, { '--dy': '-30px' }); return; }
    const f = FX[c.kind]; if (!f) return;
    for (let k = 0; k < f.n; k++) {
      const ang = (k / f.n) * Math.PI * 2 + Math.random() * 0.6;
      const burst = f.cls === 'f-burst', fall = f.cls === 'f-fall';
      const dx = burst ? Math.cos(ang) * f.spread : (Math.random() - 0.5) * f.spread;
      const dy = burst ? Math.sin(ang) * f.spread : fall ? 120 + Math.random() * 120 : -50 - Math.random() * 50;
      const x = fall ? at[0] + (Math.random() - 0.5) * f.spread * 1.6 : at[0];
      const y = fall ? at[1] - 60 - Math.random() * 40 : at[1];
      const el = spawn(f.chars[k % f.chars.length], f.cls, x - 10, y - 10, {
        '--dx': dx.toFixed(0) + 'px', '--dy': dy.toFixed(0) + 'px', '--r': ((Math.random() - 0.5) * 540).toFixed(0) + 'deg',
        '--d': (fall ? 1.4 + Math.random() * 0.8 : 0.9 + Math.random() * 0.6).toFixed(2) + 's'
      });
      el.style.fontSize = (f.size || (16 + Math.random() * 8)).toFixed(0) + 'px';
      if (f.color) el.style.color = f.color;
      el.style.animationDelay = (fall ? Math.random() * 0.5 : k * 0.04).toFixed(2) + 's';
    }
  }

  /* ------------ giường (búp bê giấy: cả khối #turn ngả nằm) ------------ */
  // Hình học (r = scale/0.6): chân bé ở footY; tâm xoay = footY - 85r; hộp giường 240r x 110r, đáy ở footY + 5r.
  // Đầu nằm bên TRÁI khi bé quay phải (hs = -1, xoay -80deg), bên PHẢI khi quay trái (hs = +1, +80deg).
  const bed = { on: false, phase: '', hs: -1, timers: [], pending: null };
  const rr = () => layout.scale / 0.6;
  function footPt() { return pack ? toWin(curAnchor()[0], curAnchor()[1]) : [layout.winW / 2, layout.winH - 5]; }
  function bedHead() {
    if (!bed.on) return null;
    const f = footPt(), r = rr(), th = bed.hs * 80 * Math.PI / 180;
    return [f[0] + 47 * r * Math.sin(th) + bed.hs * 22 * r, f[1] - 85 * r - 47 * r * Math.cos(th) + 24 * r];   // khớp --lie-* (scale .78)
  }
  function placeBed() {
    if (!pack || !MP) return;
    const f = footPt(), r = rr();
    if (!bedBack.firstChild) bedBack.innerHTML = MP.bedBack();     // vẽ SVG giường/chăn lần đầu dùng
    if (!bedFront.firstChild) bedFront.innerHTML = MP.bedFront();
    [bedBack, bedFront].forEach(b => {
      b.style.left = (f[0] - 120 * r) + 'px'; b.style.top = (f[1] - 105 * r) + 'px';
      b.style.width = (240 * r) + 'px'; b.style.height = (110 * r) + 'px';
      b.style.transform = bed.hs === 1 ? 'scaleX(-1)' : '';
    });
    turnEl.style.setProperty('--pv-y', (f[1] - 85 * r) + 'px');
    turnEl.style.setProperty('--lie-x', (bed.hs * 22 * r) + 'px');   // đầu dịch về phía gối
    turnEl.style.setProperty('--lie-y', (24 * r) + 'px');
    turnEl.style.setProperty('--lie-rot', (bed.hs * 80) + 'deg');
  }
  function bedT(fn, ms) { bed.timers.push(setTimeout(fn, ms)); }
  function bedClear() { bed.timers.forEach(clearTimeout); bed.timers = []; }
  function bedDone() { // đúng một animEnd cho mỗi lệnh bed
    const t = bed.pending; bed.pending = null;
    if (t) send('animEnd', { token: t.token, action: 'bed:' + t.state });
  }
  function bedCleanup() {
    bedClear();
    bedBack.hidden = true; bedFront.hidden = true; bedBack.className = ''; bedFront.className = '';
    turnEl.style.transition = 'none';
    turnEl.classList.remove('lying', 'lied');
    void turnEl.offsetWidth;
    turnEl.style.transition = '';
    actorEl.classList.remove('stir');
    bed.on = false; bed.phase = '';
    placeBubble();
  }
  function bedExitNow() {
    if (!bed.on && !bed.pending) return;
    bedCleanup(); bedDone();
  }
  function bedOp(c) {
    const state = c.state, tk = { token: c.token, state };
    if (!MP || !pack) { send('animEnd', { token: c.token, action: 'bed:' + state }); return; }
    if (state === 'in') {
      if (bed.on) { send('animEnd', { token: c.token, action: 'bed:in' }); return; }
      bed.on = true; bed.phase = 'in'; bed.hs = dir === 'left' ? 1 : -1; bed.pending = tk;
      turnEl.classList.remove('walking', 'sidewalk'); sideOn = false;
      placeBed();
      bedBack.hidden = false; bedBack.className = 'in';
      bedFront.hidden = false; bedFront.className = '';
      bedT(() => { turnEl.classList.add('lied', 'lying'); placeBubble(); }, 220);
      bedT(() => { bedFront.className = 'on'; }, 760);
      bedT(() => { bedFront.className = 'on breathe'; bed.phase = 'on'; bedDone(); }, 1320);
    } else if (state === 'out') {
      if (!bed.on || bed.phase === 'out') { send('animEnd', { token: c.token, action: 'bed:out' }); return; }
      bedClear(); bedDone(); // nếu đang 'in' dở: báo xong lệnh cũ
      bed.phase = 'out'; bed.pending = tk;
      bedFront.className = 'on off';
      bedT(() => { turnEl.classList.remove('lying'); }, 300);
      bedT(() => { bedBack.className = 'out'; }, 950);
      bedT(() => { bedCleanup(); bedDone(); }, 1320);
    } else if (state === 'stir') {
      if (!bed.on || bed.phase !== 'on' || bed.pending) { send('animEnd', { token: c.token, action: 'bed:stir' }); return; }
      bed.pending = tk;
      actorEl.classList.add('stir'); bedFront.classList.add('stir');
      bedT(() => { actorEl.classList.remove('stir'); bedFront.classList.remove('stir'); bedDone(); }, 800);
    } else send('animEnd', { token: c.token, action: 'bed:' + state });
  }

  /* ------------ đồ vật ------------ */
  const props = new Map();
  function propSpot(p) {
    const r = rr(), f = footPt();
    if (p.def.slot === 'ground') return [f[0] + p.side * 92 * r, Math.min(layout.winH - 2, f[1] + 3 * r)];
    let hd = null;
    try { hd = wear && curSrc ? wear.head(curSrc) : null; } catch (e) { hd = null; }
    const dx = hd ? hd[0] : 0, dy = hd ? hd[1] : 0;
    if (p.def.slot === 'head') return toWin(200 + dx, 160 + dy);
    const hp = curHand();
    return toWin(hp[0] + dx * 0.6, hp[1] + dy * 0.6);
  }
  function placeProps() {
    if (!pack || !props.size) return;
    const r = rr();
    props.forEach(p => {
      const pt = propSpot(p);
      p.wrap.style.display = (inSide() && p.def.slot !== 'ground' && !(wear && wear.hasHead(curSrc))) ? 'none' : '';
      p.wrap.style.left = pt[0] + 'px'; p.wrap.style.top = pt[1] + 'px';
      const fl = p.def.slot === 'ground' ? 1 : (dir === 'left' ? -1 : 1);
      p.wrap.style.transform = 'scaleX(' + fl + ') scale(' + r + ')';
    });
  }
  function propRemove(kind) {
    const p = props.get(kind); if (!p) return;
    props.delete(kind);
    p.pin.classList.remove('pop'); p.pin.classList.add('out');
    setTimeout(() => p.wrap.remove(), 300);
  }
  function prop(c) {
    if (!MP) return;
    if (c.kind == null) { Array.from(props.keys()).forEach(propRemove); return; }
    const def = MP.KINDS[c.kind]; if (!def) return;
    if (c.on === false) { propRemove(c.kind); return; }
    let p = props.get(c.kind);
    if (!p) {
      const wrap = document.createElement('div'), pin = document.createElement('div');
      wrap.className = 'prop p-' + c.kind; pin.className = 'pin pop';
      pin.style.left = -def.ax + 'px'; pin.style.top = -def.ay + 'px';
      pin.style.width = def.w + 'px'; pin.style.height = def.h + 'px';
      pin.style.transformOrigin = def.ax + 'px ' + def.ay + 'px';
      pin.innerHTML = def.svg;
      pin.addEventListener('animationend', ev => { if (ev.target === pin) pin.classList.remove('pop'); });
      wrap.appendChild(pin);
      (def.slot === 'ground' ? groundProps : propFront).appendChild(wrap);
      p = { def, wrap, pin, side: dir === 'left' ? -1 : 1, opts: {} };
      props.set(c.kind, p);
    }
    const o = Object.assign({}, c); delete o.op; delete o.kind;
    p.opts = Object.assign(p.opts, o);
    if (def.update) def.update(pin_(p), p.opts, c);
    placeProps();
  }
  const pin_ = p => p.pin;

  /* ------------ lệnh từ main ------------ */
  // Nạp trước (nóng) hành động sắp dùng; hành động lõi (idle/walk) và chưa có gói thì bỏ qua.
  function warm() { if (anim && anim.warm) anim.warm(Array.prototype.slice.call(arguments)); }
  const WARM_AFTER = { lifted: ['fall', 'land'], fall: ['land'], hold_note: ['happy'], ring: ['happy', 'sleep'], sit: ['sleep'], sleep: ['idle'] };
  function playNormal(c) {
    const nx = WARM_AFTER[String(c.action || '')]; if (nx) warm.apply(null, nx);
    if (anim) anim.play(c.action, { mood: c.mood, loop: !!c.loop, token: c.token });
    curAction = String(c.action || 'idle'); placeOutfit();
    turnEl.classList.toggle('walking', curAction === 'walk');
  }
  // Đi ngang: nếu gói có walk_side thì dùng dáng nghiêng (tắt xoay 3D). Trả true nếu đã xử lý.
  function trySide(c, act, gen) {
    if (!anim || !pack || bed.on || sideBad) return false;
    if (act !== 'walk' && act !== 'run_side') return false;
    if (!anim.hasSide()) return false;
    const kind = act === 'run_side' && pack.anims.run_side ? 'run_side' : 'walk_side';
    if (anim.sideReady) { startSide(c, kind, gen); return true; }
    // lần đầu đi: nạp nền; trong lúc chờ vẫn đi dáng thẳng như cũ, nạp xong (nếu còn đang đi) thì chuyển sang nghiêng
    anim.loadSide().then(ok => {
      if (!ok) { sideBad = true; return; }
      if (wear) wear.loadSide();
      if (gen === sideGen) startSide(c, kind, gen);
    });
    return false;
  }
  function startSide(c, kind, gen) {
    const was = sideOn;
    sideOn = true;
    if (wear) wear.loadSide();
    turnEl.classList.remove('walking', 'fast');
    turnEl.classList.add('sidewalk');
    curAction = 'walk';
    const go = () => {
      if (gen !== sideGen || !anim) return;
      anim.play(kind, { mood: c.mood, loop: true, token: c.token });
      placeOutfit(); placeFoot(); placeNote(); placeBubble();
    };
    if (!was && hasPhase('turn_side', 'start')) anim.play('turn_side', { mood: c.mood, loop: false, only: 'start', onEnd: go });
    else go();
  }
  function leaveSide(c, gen) {
    sideOn = false;
    turnEl.classList.remove('sidewalk');
    const after = () => { if (gen === sideGen) { playNormal(c); placeFoot(); placeNote(); placeBubble(); } };
    if (String(c.action || 'idle') === 'idle' && anim && hasPhase('turn_side', 'end')) {
      curAction = 'idle';
      anim.play('turn_side', { mood: c.mood, loop: false, only: 'end', onEnd: after });
    } else after();
  }

  async function loadPack(c) {
    pack = c.pack; if (c.layout) layout = Object.assign({}, layout, c.layout);
    document.body.style.width = layout.winW + 'px'; document.body.style.height = layout.winH + 'px';
    const d = dpr();
    cv.width = Math.round(cw() * d); cv.height = Math.round(ch() * d);
    layoutAll();
    loading = true;
    let res = { ok: false, missing: [] };
    try {
      if (!anim) anim = new window.MochiAnim.Animator(cv, {
        onEnd: (token, action) => send('animEnd', { token, action }),
        onMissing: () => {}
      });
      anim.flip(dir === 'left');
      if (window.MochiWear && c.baseUrl) {
        wear = window.MochiWear.create(c.baseUrl);
        if (wearStyle) wear.setStyle(wearStyle);
        wear.onReady(() => { if (anim && anim._run) redrawCurrent(); placeOutfit(); });
        anim.filter = (img, src) => wear.apply(img, src);
        anim.onFrame = src => { curSrc = src; placeOutfit(); };
        anim.onActionLoaded = (srcs, w, h) => wear.prefetch(srcs, w, h);
        anim.onActionFreed = srcs => wear.forget(srcs);
      }
      anim.decodeScale = layout.scale;
      const r = await anim.load(pack, c.baseUrl);
      res = { ok: !!(r && r.ok), missing: (r && r.missing) || [] };
      if (anim.setScale) anim.setScale(layout.scale); // engine tự đặt scale theo pack; layout mới là chuẩn
    } catch (e) { res = { ok: false, missing: [String(e && e.message || e)] }; }
    loading = false;
    send('packReady', res);
    const q = queued; queued = []; q.forEach(handle);
  }
  function handle(c) {
    if (!c || !c.op) return;
    if (c.op === 'pack') { bedExitNow(); sideOn = false; sideBad = false; sideGen++; curSrc = ''; turnEl.classList.remove('sidewalk'); loadPack(c); return; }
    if (loading && (c.op === 'play' || c.op === 'face')) { queued.push(c); return; }
    switch (c.op) {
      case 'play': {
        const gen = ++sideGen;
        if (bed.on && String(c.action || 'idle') !== 'sleep') bedExitNow();
        const act = String(c.action || 'idle');
        if (trySide(c, act, gen)) break;
        if (act === 'run_side') c = Object.assign({}, c, { action: 'walk' });   // không có dáng nghiêng: chạy = đi như cũ
        if (sideOn) { leaveSide(c, gen); break; }
        playNormal(c);
        break;
      }
      case 'face':
        if (bed.on) break; // đang nằm giường: giữ hướng nằm
        if ((c.dir === 'left' ? 'left' : 'right') !== dir && turnEl.classList.contains('walking')) {
          // đổi hướng giữa lúc đi: lật qua cạnh (90°) rồi xoay sang hướng mới
          turnEl.classList.add('flipping');
          setTimeout(() => turnEl.classList.remove('flipping'), 170);
        }
        dir = c.dir === 'left' ? 'left' : 'right';
        turnEl.style.setProperty('--face', dir === 'left' ? '-1' : '1');
        if (anim) anim.flip(dir === 'left');
        placeNote(); placeBubble(); placeOutfit(); placeFoot(); break;
      case 'say': if (c.buttons && c.buttons.length) warm('ring', 'hold_note', 'happy', 'sleep'); say(c); break;
      case 'outfit': setOutfit((c.items || []).filter(it => it.slot !== 'body' && it.slot !== 'outer')); setWear(c.wear); break;
      case 'move': bedExitNow(); move(c); break;
      case 'bed': warm('sleep'); bedOp(c); break;
      case 'prop': prop(c); break;
      case 'ball': setBall(c); break;
      case 'crumple': crumple(c); break;
      case 'toss': toss(c); break;
      case 'fx': fx(c); break;
      case 'hush': hush(); break;
      case 'pointer': { // chỉ Linux: main dò con trỏ thay cho forward chuột
        if (faded) break;
        const el = document.elementFromPoint(c.x, c.y);
        if (overUi(el) || overChar(c.x, c.y)) { setIgnore(false); setHover(true); }
        break;
      }
      case 'note': setNote(c.note); break;
      case 'sound': sound(c.name); break;
      case 'shake': shaker.classList.toggle('shake', !!c.on); break;
      case 'settings': settings = Object.assign({}, settings, c.settings || {}); break;
      case 'fade': {
        const to = Math.max(0, Math.min(1, +c.to)), ms = Math.max(0, +c.ms || 0);
        root.style.transition = 'opacity ' + ms + 'ms ease';
        root.style.opacity = String(to);
        faded = to < 0.05;
        if (faded) { setIgnore(true); setHover(false); bedExitNow(); }
        break;
      }
    }
  }
  if (P) P.onCmd(handle);
  const boot = () => send('ready', {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
