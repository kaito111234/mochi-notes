(function () {
  'use strict';
  const M = window.mochi, P = window.MochiParse;
  const $ = id => document.getElementById(id);
  const stage = $('stage'), rig = $('rig'), shaker = $('shaker'), tilt = $('tilt');
  const imgs = [$('imgA'), $('imgB')];
  const noteWrap = $('noteWrap'), bubble = $('bubble'), bText = $('bText'), bBtns = $('bBtns');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WIN_H = 520;

  const STATES = ['normal', 'happy', 'laugh', 'excited', 'surprised', 'scared', 'sad', 'cry', 'angry',
    'uncomfortable', 'shy', 'cold', 'tired', 'sleepy', 'love', 'flustered', 'protest', 'bored'];
  const COLORS = {
    yellow: ['#FFF7D1', '#F5E27A', '#3a2a2a'], green: ['#E4F9E0', '#BFE8B8', '#2a3a2a'],
    pink: ['#FFE4F1', '#F7B9D6', '#3a2a35'], purple: ['#F2E6FF', '#D9BFF5', '#322a3f'],
    blue: ['#E2F1FF', '#B5D8F7', '#2a3340'], gray: ['#F3F2F1', '#D6D4D1', '#333'],
    charcoal: ['#4A4A4A', '#2f2f2f', '#f2f2f2']
  };
  const L = {
    pre: ['Ding ding~ sắp tới giờ rồi nè', 'Ơ, cậu ơi… sắp tới giờ rồi đó', 'Tớ nhắc trước nè, đừng quên nha~'],
    poke: ['Á… đừng chọc tớ mà, tớ ngại đó…', 'Cậu có thấy con mèo nào không? Tớ thích mèo lắm…', 'Hửm? Cậu gọi tớ hả?', 'Tớ đang nghĩ tới bánh mochi đây… ngọt ngọt dẻo dẻo…', 'Đừng lo… tớ vẫn ở đây mà', 'Hì… cậu cứ làm việc đi, tớ ngồi canh giờ cho', 'Tớ muốn ôm một bé mèo quá… meo~'],
    again: ['Cậu ơi, tới giờ rồi mà…', 'Này này, đừng làm lơ tớ chứ!', 'Tớ gọi lần cuối đó nha… tới giờ rồi!']
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  let settings = { sound: true, mascotIdle: false };
  let sprites = {}, dims = { w: 1, h: 1 };
  let visible = false, session = 0, timers = [], curMode = null;
  let front = 0, curExpr = null;

  /* ------------ tiện ích ------------ */
  function setT(fn, ms) { const s = session; const t = setTimeout(() => { if (s === session) fn(); }, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ------------ sprite ------------ */
  function loadSprites() {
    const fallback = () => { const o = {}; STATES.forEach(k => { o[k] = k + '.png'; }); return { w: 0, h: 0, states: o }; };
    return fetch('../../assets/mascot/manifest.json').then(r => r.json()).catch(fallback).then(mf => {
      if (!mf || !mf.states) mf = fallback();
      const base = '../../assets/mascot/';
      const keys = Object.keys(mf.states);
      return Promise.all(keys.map(k => new Promise(res => {
        const im = new Image();
        im.onload = () => res({ k, im });
        im.onerror = () => res(null);
        im.src = base + mf.states[k];
      }))).then(list => {
        list.forEach(x => { if (x) sprites[x.k] = x.im.src; });
        const first = list.find(x => x);
        dims.w = mf.w || (first && first.im.naturalWidth) || 1;
        dims.h = mf.h || (first && first.im.naturalHeight) || 1;
      });
    });
  }
  function layoutSprite() {
    const w = stage.classList.contains('idle') ? 170 : 250;
    stage.style.setProperty('--sh', Math.round(w * dims.h / dims.w) + 'px');
  }
  function setExpr(name, instant) {
    if (!sprites[name]) name = sprites.normal ? 'normal' : Object.keys(sprites)[0];
    if (!name || name === curExpr) return;
    curExpr = name;
    const inn = imgs[1 - front], out = imgs[front];
    inn.src = sprites[name];
    if (instant) { inn.style.transition = 'none'; out.style.transition = 'none'; }
    inn.classList.add('on'); out.classList.remove('on');
    if (instant) { void inn.offsetWidth; inn.style.transition = ''; out.style.transition = ''; }
    front = 1 - front;
  }

  /* ------------ âm thanh ------------ */
  let ac = null;
  function ctx() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
    return ac;
  }
  function tone(c, f, t0, vol, dur) {
    [[f, vol], [f * 2, vol * 0.18]].forEach(([fr, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  function ding() {
    if (!settings.sound) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime + 0.02;
    for (let r = 0; r < 2; r++) {
      tone(c, 1318.5, t + r * 0.7, 0.22, 0.9);
      tone(c, 1046.5, t + r * 0.7 + 0.2, 0.22, 0.9);
    }
  }
  function pop() {
    if (!settings.sound) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.16);
  }

  /* ------------ vào / ra ------------ */
  function anim(kf, opts) {
    if (reduced) { rig.style.transform = kf[kf.length - 1].transform; return Promise.resolve(); }
    const a = rig.animate(kf, Object.assign({ fill: 'forwards' }, opts));
    return a.finished.then(() => { rig.style.transform = kf[kf.length - 1].transform; a.cancel(); }, () => {});
  }
  function enter() {
    rig.getAnimations().forEach(a => a.cancel());
    visible = true;
    pop();
    return anim([{ transform: 'translateY(100%)', offset: 0 }, { transform: 'translateY(-3.5%)', offset: .72 },
      { transform: 'translateY(1%)', offset: .88 }, { transform: 'translateY(0)', offset: 1 }],
      { duration: 550, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  function exit(keepIdleHandled) {
    const s = ++session; clearTimers();
    session = s;
    setIgnore(true, true);
    visible = false;
    anim([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 380, easing: 'cubic-bezier(.6,0,.8,.4)' })
      .then(() => {
        if (s !== session) return;
        bubble.hidden = true; noteWrap.hidden = true;
        M.mascotAction('dismiss');
      });
  }

  /* ------------ bong bóng ------------ */
  function say(text, buttons) {
    bText.textContent = text;
    bBtns.textContent = '';
    (buttons || []).forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', () => { if (!el.disabled) b.fn(); });
      bBtns.appendChild(el);
    });
    bubble.hidden = false;
    bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
    placeBubble();
  }
  function placeBubble() {
    const sh = parseFloat(stage.style.getPropertyValue('--sh')) || 300;
    const bh = bubble.offsetHeight || 100;
    let bottom = sh * 0.82;
    if (!noteWrap.hidden) bottom = Math.max(bottom, 150);
    bottom = Math.min(bottom, WIN_H - 6 - bh);
    bubble.style.bottom = Math.max(bottom, 4) + 'px';
    bubble.style.left = stage.classList.contains('idle') ? '40px' : '8px';
    bubble.style.width = stage.classList.contains('idle') ? '200px' : '224px';
  }
  function disableBtns() { bBtns.querySelectorAll('button').forEach(b => { b.disabled = true; }); }
  function shake() {
    if (reduced) return;
    shaker.classList.remove('shake'); void shaker.offsetWidth; shaker.classList.add('shake');
    setTimeout(() => shaker.classList.remove('shake'), 650);
  }

  /* ------------ tờ note ------------ */
  function showNote(kind, note, bigText) {
    const c = COLORS[note && note.color] || COLORS.yellow;
    noteWrap.style.setProperty('--paper', c[0]);
    noteWrap.style.setProperty('--head', c[1]);
    noteWrap.style.setProperty('--txt', c[2]);
    noteWrap.className = kind + (note && note.color === 'charcoal' ? ' charcoal' : '');
    $('nBig').textContent = bigText;
    $('nTitle').textContent = (note && note.title) || '';
    const when = note && note.due ? P.whenLabel(note.due) : '';
    $('nMeta').textContent = [when, note && note.intentLabel].filter(Boolean).join(' · ');
    noteWrap.hidden = false;
  }

  /* ------------ xử lý sự kiện ------------ */
  function open(note) { M.mascotAction('open', note && note.id); }
  function btn(label, fn, primary) { return { label, fn, primary }; }

  function handle(ev) {
    if (!ev) return;
    if (ev.settings) settings = Object.assign(settings, ev.settings);
    if (ev.type === 'leave') { exit(); return; }
    ++session; clearTimers();
    const wasVisible = visible;
    stage.classList.toggle('idle', ev.type === 'idle');
    layoutSprite();
    curMode = ev.type;
    noteWrap.hidden = true; bubble.hidden = true;
    shaker.classList.remove('shake');
    const note = ev.note || null;
    const ready = wasVisible ? Promise.resolve() : (setExpr(ev.type === 'pre' ? 'surprised' : ev.type === 'due' ? 'scared' : 'normal', true), enter());
    const s = session;
    ready.then(() => { if (s === session) run(ev, note, wasVisible); });
  }

  function run(ev, note, wasVisible) {
    switch (ev.type) {
      case 'pre': {
        setExpr('surprised');
        const left = note && note.due ? P.dur(note.due - Date.now()) : '';
        showNote('pre', note, left ? 'Còn ' + left : 'Sắp tới giờ rồi');
        ding();
        say(pick(L.pre), [
          btn('Biết rồi', () => exit()),
          btn('Mở note', () => { open(note); exit(); }, true)
        ]);
        setT(() => setExpr('excited'), 600);
        setT(() => exit(), 20000);
        break;
      }
      case 'due': {
        setExpr('scared');
        showNote('due', note, 'Tới giờ rồi!');
        ding(); shake();
        const lock = () => { disableBtns(); ++session; clearTimers(); };
        say('Tới giờ rồi! Đừng quên nha…', [
          btn('Xong rồi', () => {
            lock(); M.mascotAction('done', note && note.id);
            noteWrap.hidden = true; setExpr('laugh');
            say('Giỏi quá! Tớ biết cậu làm được mà');
            const s = session; setTimeout(() => { if (s === session) setExpr('love'); }, 600);
            setT(() => exit(), 1600);
          }, true),
          btn('Hoãn 10 phút', () => {
            lock(); M.mascotAction('snooze', note && note.id);
            noteWrap.hidden = true; setExpr('sleepy');
            say('Ừa… 10 phút nữa tớ gọi lại nha');
            setT(() => exit(), 1400);
          }),
          btn('Mở note', () => { open(note); exit(); })
        ]);
        setT(() => setExpr('protest'), 500);
        let n = 0;
        const again = () => {
          if (n >= 3) return;
          n++;
          setExpr(n % 2 ? 'angry' : 'protest');
          bText.textContent = L.again[n - 1] || L.again[0];
          placeBubble(); shake(); ding();
          setT(again, 60000);
        };
        setT(again, 60000);
        break;
      }
      case 'nag': {
        setExpr(Math.random() < .5 ? 'angry' : 'protest');
        const c = ev.overdueCount || 1;
        say('Còn ' + c + ' việc quá hạn đó… làm hay hoãn đi mà', [
          btn('Để tớ xem', () => { open(note); exit(); }, true),
          btn('Để sau', () => exit())
        ]);
        setT(() => exit(), 15000);
        break;
      }
      case 'hello': {
        setExpr('happy');
        say('Chào cậu! Tới giờ là tớ chạy ra nhắc liền');
        setT(() => exit(), 5000);
        break;
      }
      case 'idle': {
        setExpr('normal');
        bubble.hidden = true;
        scheduleIdle();
        break;
      }
    }
    syncPointer();
  }

  function scheduleIdle() {
    setT(() => {
      setExpr(pick(['normal', 'shy', 'bored', 'sleepy']));
      setT(() => { setExpr('normal'); scheduleIdle(); }, 4500);
    }, 20000 + Math.random() * 20000);
  }

  /* ------------ bấm vào bé (idle) ------------ */
  let pokeTimer = 0;
  $('spriteHit').addEventListener('click', () => {
    if (curMode !== 'idle') return;
    M.mascotAction('poke');
    pop();
    setExpr(pick(['shy', 'flustered', 'happy']));
    say(pick(L.poke));
    clearTimeout(pokeTimer);
    const s = session;
    pokeTimer = setTimeout(() => {
      if (s !== session || curMode !== 'idle') return;
      bubble.hidden = true; setExpr('normal');
    }, 3000);
  });

  /* ------------ click-through ------------ */
  let ignoring = true, lx = -1, ly = -1;
  function setIgnore(v, force) {
    if (v === ignoring && !force) return;
    ignoring = v; M.setIgnoreMouse(v);
  }
  function syncPointer() {
    if (lx < 0) return;
    const el = document.elementFromPoint(lx, ly);
    setIgnore(!(el && el.closest && el.closest('.hit')));
  }
  document.addEventListener('mousemove', e => { lx = e.clientX; ly = e.clientY; syncPointer(); });
  document.addEventListener('mouseleave', () => { lx = -1; setIgnore(true); });

  /* ------------ nghiêng đầu ------------ */
  function tiltLoop() {
    setTimeout(() => {
      if (visible && !reduced) {
        const a = (Math.random() < .5 ? -1 : 1) * (0.8 + Math.random() * .7);
        tilt.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
        setTimeout(() => { tilt.style.transform = 'rotate(0deg)'; }, 1800 + Math.random() * 1500);
      }
      tiltLoop();
    }, 6000 + Math.random() * 6000);
  }

  /* ------------ khởi động ------------ */
  const loaded = loadSprites();
  M.onSettingsChanged(s => { settings = Object.assign(settings, s); });
  M.onMascotEvent(ev => { loaded.then(() => handle(ev)); });
  M.getSettings().then(s => { if (s) settings = Object.assign(settings, s); }).catch(() => {});
  loaded.then(() => {
    layoutSprite();
    setExpr('normal', true);
    tiltLoop();
    M.mascotReady();
  });
})();
