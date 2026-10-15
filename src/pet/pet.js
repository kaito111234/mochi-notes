// Cửa sổ bé Mochi (renderer). Hợp đồng: docs/rooms/core/ARCH.md mục 2.
(function () {
  'use strict';
  const P = window.mochi && window.mochi.pet;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), root = $('root'), shaker = $('shaker');
  const cap = $('cap'), capText = $('capText'), capLabel = $('capLabel'), capTail = $('capTail');
  const note = $('note'), bubble = $('bubble'), bShown = $('bShown'), bRest = $('bRest'), bBtns = $('bBtns'), bTail = $('bTail');
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
  let curNote = null, climbSide = null;
  const dpr = () => window.devicePixelRatio || 1;

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
  }

  /* ------------ tờ note ------------ */
  function placeNote() {
    if (!pack || note.hidden) return;
    const h = toWin(pack.hand[0], pack.hand[1]);
    const W = note.offsetWidth || 120, H = note.offsetHeight || 110, left = dir === 'left';
    let x = left ? h[0] - W : h[0], y = h[1] - H;
    x = Math.max(0, Math.min(Math.max(0, layout.winW - W), x));
    y = Math.max(0, Math.min(Math.max(0, layout.winH - H), y));
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
  let capOn = false, pendingSay = null;
  // đặt một bong bóng (nói/nhập) trên đầu bé, kẹp trong cửa sổ; khi bám tường thì chừa thêm lề phía tường
  function placeAbove(el, tailEl) {
    if (!pack) return;
    const hb = boxWin(pack.hitbox && pack.hitbox.head) || { l: layout.charLeft, r: layout.charLeft + cw(), t: layout.charTop, b: layout.charTop + ch() / 3 };
    const w = el.offsetWidth, h = el.offsetHeight, cx = (hb.l + hb.r) / 2;
    const mL = climbSide === 'left' ? 8 : 4, mR = climbSide === 'right' ? 8 : 4;
    const maxX = Math.max(mL, layout.winW - w - mR);
    const x = Math.max(mL, Math.min(maxX, cx - w / 2));
    let y = hb.t - h - 12;
    y = Math.max(4, Math.min(Math.max(4, layout.winH - h - 4), y));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    tailEl.style.left = Math.max(16, Math.min(w - 16, cx - x)) + 'px';
    // đuôi chỉ xuống; nếu bong bóng nằm thấp hơn đỉnh đầu (bị kẹp) thì ẩn đuôi
    tailEl.style.display = (y + h + 4 <= hb.t + 8) ? '' : 'none';
  }
  function placeBubble() {
    if (capOn) placeAbove(cap, capTail);
    if (bubbleOn) placeAbove(bubble, bTail);
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
    if (capOn) { pendingSay = c; return; }
    pendingSay = null;
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
  function hush() { clearSay(); bubbleOn = false; bubble.hidden = true; pendingSay = null; }
  bubble.addEventListener('click', () => { if (typeTimer) revealAll(); });

  /* ------------ bong bóng nhập (ghi nhanh) ------------ */
  let draftTimer = 0;
  function fitCap() {
    capText.style.height = 'auto';
    capText.style.height = Math.min(68, Math.max(32, capText.scrollHeight + 2)) + 'px';
    placeBubble();
  }
  function flushDraft() {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = 0; }
  }
  function openCap(c) {
    hush();
    capLabel.textContent = (c && c.prompt) || 'Cậu muốn tớ ghi gì?';
    capText.value = String((c && c.draft) || '').slice(0, 2000);
    if (!capOn) { cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = ''; }
    capOn = true; cap.hidden = false;
    setIgnore(false);
    fitCap();
    capText.focus();
    try { capText.setSelectionRange(capText.value.length, capText.value.length); } catch (e) { /* bỏ qua */ }
  }
  function closeCap(sendDraft) {
    if (!capOn) return;
    flushDraft();
    if (sendDraft) send('captureDraft', { text: capText.value });
    capOn = false; cap.hidden = true;
    try { capText.blur(); } catch (e) { /* bỏ qua */ }
    // trả lại click xuyên; lần rê chuột kế tiếp sẽ cập nhật lại nếu đang ở trên bé
    hovering = false; send('hover', { on: false });
    if (!lifted && !dragging) setIgnore(true);
    if (pendingSay) { const s = pendingSay; pendingSay = null; say(s); }
  }
  function submitCap() { const t = capText.value; flushDraft(); closeCap(false); send('captureSubmit', { text: t }); }
  function cancelCap() { const t = capText.value; flushDraft(); closeCap(false); send('captureCancel', { text: t }); }
  capText.addEventListener('input', () => {
    fitCap();
    flushDraft();
    draftTimer = setTimeout(() => { draftTimer = 0; send('captureDraft', { text: capText.value }); }, 500);
  });
  capText.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); submitCap(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancelCap(); }
  });
  $('capSave').addEventListener('click', ev => { ev.stopPropagation(); submitCap(); });
  $('capCancel').addEventListener('click', ev => { ev.stopPropagation(); cancelCap(); });

  /* ------------ kéo thả chữ/link vào bé ------------ */
  function dragKind(dt) {
    if (!dt || !dt.types) return null;
    const t = Array.from(dt.types);
    if (t.includes('Files')) return null;
    if (t.includes('text/uri-list')) return 'url';
    if (t.includes('text/plain') || t.includes('text')) return 'text';
    return null;
  }
  function endDrag(ev) {
    dragging = false; cv.classList.remove('dropHot');
    if (ev && ev.clientX != null && !capOn) updateIgnore(ev); else if (!capOn && !lifted) setIgnore(true);
  }
  function onDrag(ev) {
    if (!dragKind(ev.dataTransfer)) return;
    dragging = true; setIgnore(false);
    const hot = overChar(ev.clientX, ev.clientY);
    cv.classList.toggle('dropHot', hot);
    if (hot) { ev.preventDefault(); try { ev.dataTransfer.dropEffect = 'copy'; } catch (e) { /* bỏ qua */ } }
  }
  document.addEventListener('dragenter', onDrag);
  document.addEventListener('dragover', onDrag);
  document.addEventListener('dragleave', ev => {
    if (ev.relatedTarget == null) endDrag(null);
    else cv.classList.remove('dropHot');
  });
  document.addEventListener('dragend', () => endDrag(null));
  document.addEventListener('drop', ev => {
    const dt = ev.dataTransfer, hot = overChar(ev.clientX, ev.clientY);
    if (!dragKind(dt)) { endDrag(ev); return; }
    ev.preventDefault();
    if (hot) {
      let kind = 'text', text = '';
      try {
        const u = dt.getData('text/uri-list');
        const first = String(u || '').split(/\r?\n/).map(s => s.trim()).find(s => s && s[0] !== '#');
        if (first) { text = first; kind = 'url'; } else text = dt.getData('text/plain') || '';
      } catch (e) { text = ''; }
      text = String(text).slice(0, 5000);
      if (text.trim()) send('dropText', { text, kind });
    }
    endDrag(ev);
  });

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
  function sound(name) {
    if (settings.sound === false) return;
    const c = actx(); if (!c) return;
    const t = c.currentTime + 0.02;
    if (name === 'ding') {
      for (let r = 0; r < 2; r++) { tone(c, 1318.5, t + r * 0.7, 0.22, 0.9); tone(c, 1046.5, t + r * 0.7 + 0.2, 0.22, 0.9); }
    } else if (name === 'pop') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.16);
    } else if (name === 'alarm') {
      for (let r = 0; r < 3; r++) {
        const b = t + r * 0.9;
        tone(c, 1568, b, 0.4, 0.35, 'triangle'); tone(c, 1318.5, b + 0.15, 0.4, 0.35, 'triangle');
        tone(c, 1568, b + 0.3, 0.4, 0.35, 'triangle'); tone(c, 1318.5, b + 0.45, 0.4, 0.45, 'triangle');
      }
    }
  }

  /* ------------ click xuyên ------------ */
  let ignored = true, hovering = false, lifted = false, faded = false, dragging = false;
  function setIgnore(v) {
    if (v === ignored) return;
    ignored = v;
    try { P && P.ignore(v); } catch (e) { /* bỏ qua */ }
  }
  function setHover(on) {
    if (on === hovering) return;
    hovering = on; send('hover', { on });
  }
  function overUi(t) { return !!(t && t.closest && t.closest('#bubble, #note, #cap')); }
  function overChar(x, y) {
    if (!anim || !pack) return false;
    const rx = x - layout.charLeft, ry = y - layout.charTop;
    if (rx < 0 || ry < 0 || rx >= cw() || ry >= ch()) return false;
    try { return anim.alphaAt(rx, ry) > 24; } catch (e) { return false; }
  }
  function updateIgnore(ev) {
    if (capOn || dragging) { setIgnore(false); return; }
    if (lifted) { setIgnore(false); return; }
    if (faded) { setIgnore(true); setHover(false); return; }
    const hit = overUi(ev.target) || overChar(ev.clientX, ev.clientY);
    setIgnore(!hit); setHover(hit);
  }

  /* ------------ xoa ------------ */
  const pat = { zone: null, lastX: 0, dirn: 0, flips: [], cool: 0 };
  function trackPat(ev) {
    if (!pack || ev.buttons || lifted) { pat.zone = null; return; }
    const now = performance.now(), x = ev.clientX, y = ev.clientY;
    if (now < pat.cool) return;
    const hb = boxWin(pack.hitbox && pack.hitbox.head), bb = boxWin(pack.hitbox && pack.hitbox.body);
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
  let down = null, clickTimer = 0;
  cv.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || down) return;
    if (!overChar(ev.clientX, ev.clientY)) return;
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* bỏ qua */ }
    down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lift: false, timer: 0 };
    down.timer = setTimeout(() => startLift(), 300);
  });
  function startLift() {
    if (!down || down.lift) return;
    clearTimeout(down.timer);
    down.lift = true; lifted = true; cv.classList.add('lifted');
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
      // hoãn click đơn để phân biệt với bấm đúp (mở ghi nhanh)
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = 0; send('captureOpen', {}); }
      else clickTimer = setTimeout(() => { clickTimer = 0; send('interact', { kind: 'click' }); }, 250);
    }
  }
  cv.addEventListener('pointerup', ev => endPress(ev, false));
  cv.addEventListener('pointercancel', ev => endPress(ev, true));
  cv.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    if (!overChar(ev.clientX, ev.clientY)) return;
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = 0; }
    send('menu', {});
  });
  note.addEventListener('click', () => send('noteClick', {}));

  document.addEventListener('pointermove', ev => { updateIgnore(ev); trackPat(ev); });
  document.addEventListener('mousemove', ev => { updateIgnore(ev); trackPat(ev); });
  document.addEventListener('mouseleave', () => { if (!lifted && !capOn && !dragging) { setIgnore(true); setHover(false); } });

  /* ------------ lệnh từ main ------------ */
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
    if (c.op === 'pack') { loadPack(c); return; }
    if (loading && (c.op === 'play' || c.op === 'face')) { queued.push(c); return; }
    switch (c.op) {
      case 'play': if (anim) anim.play(c.action, { mood: c.mood, loop: !!c.loop, token: c.token }); break;
      case 'face':
        dir = c.dir === 'left' ? 'left' : 'right';
        if (anim) anim.flip(dir === 'left');
        placeNote(); placeBubble(); break;
      case 'say': say(c); break;
      case 'hush': hush(); break;
      case 'capture': openCap(c); break;
      case 'captureClose': closeCap(true); break;
      case 'climb': climbSide = (c.side === 'left' || c.side === 'right') ? c.side : null; placeNote(); placeBubble(); break;
      case 'pointer': { // chỉ Linux: main dò con trỏ thay cho forward chuột
        if (faded || capOn || dragging) break;
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
        if (faded) { setIgnore(true); setHover(false); }
        break;
      }
    }
  }
  if (P) P.onCmd(handle);
  const boot = () => send('ready', {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
