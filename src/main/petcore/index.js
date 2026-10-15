'use strict';
// Phòng core — thân bé: ngăn dữ liệu 'pet', cửa sổ, thân (vị trí/vật lý), não (hành vi rảnh).
// Đăng ký ctx.pet.{settings,setSettings,mode,actor,body}; xem docs/rooms/core/ARCH.md mục 4.
const { app, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { createWindow } = require('./window.js');
const { createBody } = require('./body.js');
const { createBrain } = require('./brain.js');
const { createBigAlert } = require('./bigAlert.js');

const POSTURES = ['idle', 'walk', 'sit', 'sleep', 'lifted', 'peek', 'work'];
const MODES = ['happy', 'normal', 'tired', 'sad'];

function defaults() {
  return { x: null, y: null, displayId: null, posture: 'idle', settings: { alwaysVisible: true, scale: 1, walkEnabled: true, bigAlert: true, smartAlert: true, alertMotion: 'full', alertVolume: 70, quietHours: { on: true, from: '22:00', to: '07:00' } } };
}
const HM = /^([01]?d|2[0-3]):[0-5]d$/;
const fixHM = (v, d) => (typeof v === 'string' && HM.test(v.trim()) ? v.trim().replace(/^(d):/, '0$1:') : d);
const volOf = v => Math.min(100, Math.max(0, Math.round(v)));
function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  d.x = num(raw.x); d.y = num(raw.y); d.displayId = num(raw.displayId);
  if (POSTURES.includes(raw.posture)) d.posture = raw.posture;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  if (typeof s.alwaysVisible === 'boolean') d.settings.alwaysVisible = s.alwaysVisible;
  if (typeof s.walkEnabled === 'boolean') d.settings.walkEnabled = s.walkEnabled;
  if (typeof s.bigAlert === 'boolean') d.settings.bigAlert = s.bigAlert;
  if (typeof s.smartAlert === 'boolean') d.settings.smartAlert = s.smartAlert;
  if (s.alertMotion === 'full' || s.alertMotion === 'calm') d.settings.alertMotion = s.alertMotion;
  if (typeof s.alertVolume === 'number' && isFinite(s.alertVolume)) d.settings.alertVolume = volOf(s.alertVolume);
  if (s.quietHours && typeof s.quietHours === 'object') {
    const q = d.settings.quietHours;
    if (typeof s.quietHours.on === 'boolean') q.on = s.quietHours.on;
    q.from = fixHM(s.quietHours.from, q.from); q.to = fixHM(s.quietHours.to, q.to);
  }
  if (typeof s.scale === 'number' && isFinite(s.scale)) d.settings.scale = Math.min(2, Math.max(0.5, s.scale));
  return d;
}

function init(ctx) {
  const bus = ctx.bus;
  const box = ctx.store.section('pet', defaults, normalize);

  const core = {
    ctx, box, pack: null, layout: null,
    stage: false, antic: false, shown: false, showSeq: 0, curPosture: 'idle', curMode: 'normal',
    window: null, body: null, brain: null, actor: null,
    posture: () => core.curPosture,
    mode: () => core.curMode,
    setPosture(p) {
      if (!POSTURES.includes(p) || p === core.curPosture) return;
      core.curPosture = p;
      bus.emit('pet:posture', { posture: p });
    },
    toIdle() {
      if (!core.shown) return;
      core.setPosture('idle');
      actor.play('idle', { loop: true });
    },
    onWindowClosed() { core.shown = false; core.body.unplace(); core.body.stopWatch(); }
  };

  core.window = createWindow(core);
  core.body = createBody(core);
  core.brain = createBrain(core);

  // ---- play: Promise resolve khi animEnd cùng token (loop thì resolve ngay), an toàn 10s
  let tokenSeq = 0;
  const pending = new Map();           // token -> resolve (play: hình mới cắt hình cũ)
  const acts = new Map();              // token -> resolve (move/crumple/toss: chạy song song với play, không bị play cắt)
  function settleAll() { for (const [, r] of pending) r(); pending.clear(); }
  core.window.on('animEnd', d => {
    const r = pending.get(d.token) || acts.get(d.token);
    if (r) { pending.delete(d.token); acts.delete(d.token); r(); }
  });

  function play(action, opts) {
    opts = opts || {};
    const mood = MODES.includes(opts.mood) ? opts.mood : core.curMode;
    settleAll();                                       // hình mới cắt ngang hình cũ
    const token = ++tokenSeq;
    core.window.cmd({ op: 'play', action, mood, loop: !!opts.loop, token });
    if (opts.loop) return Promise.resolve();
    return new Promise(resolve => {
      const t = setTimeout(() => { pending.delete(token); resolve(); }, 10000);
      pending.set(token, () => { clearTimeout(t); resolve(); });
    });
  }

  /** Lệnh có kết thúc (move/crumple/toss): Promise resolve khi renderer báo animEnd cùng token (an toàn maxMs). */
  function act(c, maxMs) {
    const token = ++tokenSeq;
    core.window.cmd(Object.assign({}, c, { token }));
    return new Promise(resolve => {
      const t = setTimeout(() => { acts.delete(token); resolve(); }, maxMs || 10000);
      acts.set(token, () => { clearTimeout(t); resolve(); });
    });
  }

  async function show(opts) {
    opts = opts || {};
    const mySeq = ++core.showSeq;
    const win = actor.ensure();
    await Promise.race([core.window.whenReady(), new Promise(r => setTimeout(r, 5000))]);
    if (mySeq !== core.showSeq || !core.window.win()) return false;
    if (!core.window.isReady()) return false;
    const wasShown = core.shown;
    if (opts.corner) { core.body.placeCorner(); }
    else if (!core.body.placedYet() || !wasShown) core.body.placeInitial();
    core.shown = true;
    core.window.setLevel(core.stage);
    if (!win.isVisible()) {
      core.window.cmd({ op: 'fade', to: 0, ms: 0 });
      win.showInactive();
      core.window.cmd({ op: 'fade', to: 1, ms: 250 });
    }
    core.body.startWatch();
    core.brain.start();
    if (!wasShown && (opts.startup || opts.corner)) {
      core.setPosture('idle');
      await Promise.race([play('startup', { mood: core.curMode }), new Promise(r => setTimeout(r, 3000))]);
    }
    if (mySeq === core.showSeq) core.toIdle();
    return true;
  }

  function hide() {
    core.showSeq++;
    const win = core.window.win();
    if (!win) { core.shown = false; return; }
    core.body.cancel();
    core.brain.onHidden();
    core.shown = false;
    core.body.stopWatch();
    core.brain.stop();
    core.setPosture('idle');
    core.window.cmd({ op: 'fade', to: 0, ms: 200 });
    setTimeout(() => {
      const w = core.window.win();
      if (w && !core.shown) w.hide();
    }, 230);
  }

  function wantVisible() { return !!(box.settings.alwaysVisible && ctx.settings().mascotEnabled); }
  function applyVisibility(opts) {
    if (wantVisible()) { if (!core.shown) show(opts).catch(e => console.error('[petcore] show', e)); }
    else if (!core.stage && core.shown) hide();
  }

  const actor = {
    ensure: () => core.window.ensure(),
    isReady: () => core.window.isReady(),
    whenReady: () => core.window.whenReady(),
    visible: () => core.shown && !!core.window.win() && core.window.win().isVisible(),
    show, hide, applyVisibility,
    cmd: c => core.window.cmd(c),
    play,
    act,
    move: (kind, n, extra) => act(Object.assign({ op: 'move', kind, n: n || 0 }, extra || {})),
    fx: (kind, extra) => core.window.cmd(Object.assign({ op: 'fx', kind }, extra || {})),
    ball: (on, color) => core.window.cmd({ op: 'ball', on: !!on, color: color || 'yellow' }),
    crumple: color => act({ op: 'crumple', color: color || 'yellow' }, 3000),
    toss: (x, y, ms) => act({ op: 'toss', x, y, ms }, 4000),
    bed: state => act({ op: 'bed', state }, 4000),
    prop: (kind, opts) => core.window.cmd(Object.assign({ op: 'prop', kind: kind || null }, opts || {})),
    say: (text, opts) => core.window.cmd(Object.assign({ op: 'say', text: String(text || '') }, opts || {})),
    hush: () => core.window.cmd({ op: 'hush' }),
    holdNote: note => core.window.cmd({ op: 'note', note: note || null }),
    sound: name => core.window.cmd({ op: 'sound', name }),
    shake: on => core.window.cmd({ op: 'shake', on: !!on }),
    setStage(on) {
      on = !!on;
      if (core.stage === on) return;
      core.stage = on;
      core.window.setLevel(on);
      core.brain.onStage(on);
    },
    goToCorner: () => core.body.goToCorner(),
    on: (type, fn) => core.window.on(type, fn)
  };
  core.actor = actor;

  function setSettings(patch) {
    if (!patch || typeof patch !== 'object') return box.settings;
    const s = box.settings, prev = Object.assign({}, s);
    if (typeof patch.alwaysVisible === 'boolean') s.alwaysVisible = patch.alwaysVisible;
    if (typeof patch.walkEnabled === 'boolean') s.walkEnabled = patch.walkEnabled;
    if (typeof patch.bigAlert === 'boolean') s.bigAlert = patch.bigAlert;
    if (typeof patch.smartAlert === 'boolean') s.smartAlert = patch.smartAlert;
    if (patch.alertMotion === 'full' || patch.alertMotion === 'calm') s.alertMotion = patch.alertMotion;
    if (typeof patch.alertVolume === 'number' && isFinite(patch.alertVolume)) s.alertVolume = volOf(patch.alertVolume);
    if (patch.quietHours && typeof patch.quietHours === 'object') {
      const q = Object.assign({ on: true, from: '22:00', to: '07:00' }, s.quietHours);
      if (typeof patch.quietHours.on === 'boolean') q.on = patch.quietHours.on;
      q.from = fixHM(patch.quietHours.from, q.from); q.to = fixHM(patch.quietHours.to, q.to);
      s.quietHours = q;
    }
    if (typeof patch.scale === 'number' && isFinite(patch.scale)) s.scale = Math.min(2, Math.max(0.5, patch.scale));
    ctx.store.save();
    if (s.scale !== prev.scale) core.window.relayout();
    if (!s.walkEnabled && prev.walkEnabled && !core.stage) core.body.stopWalk();
    if (s.alwaysVisible !== prev.alwaysVisible) applyVisibility();
    core.window.sendSettings();
    return s;
  }

  // "Nhắc to" giữa màn hình: ctx.pet.bigAlert({ title, time, kicker?, ms? }) -> { done: Promise<{reason}>, abort() }
  const big = createBigAlert(core);

  Object.assign(ctx.pet, {
    bigAlert: opts => big.bigAlert(opts),
    abortBigAlert: reason => big.abort(reason),
    settings: () => box.settings,
    setSettings,
    mode: () => core.curMode,
    actor,
    body: {
      pos: () => core.body.pos(), posture: () => core.curPosture,
      walk: o => core.body.walk(o), leap: (x, y, o) => core.body.leap(x, y, o), hopDown: x => core.body.hopDown(x),
      setFace: d => core.body.setFace(d), face: () => core.body.face(), busy: () => core.body.busy(), mode: () => core.body.mode(),
      floorAt: (x, y) => core.body.floorAt(x, y), workArea: () => core.body.getWorkArea(), cancel: () => core.body.cancel(),
      startFall: () => core.body.startFall(), goToCorner: () => core.body.goToCorner(), jumpTo: (x, y) => core.body.jumpTo(x, y),
      size: () => (core.layout ? { w: core.layout.charW, h: core.layout.charH, winW: core.layout.winW, winH: core.layout.winH, charLeft: core.layout.charLeft, charTop: core.layout.charTop, scale: core.layout.scale } : null),
      handOffset: () => {                       // tay so với điểm chân (DIP), đã tính lật mặt
        const p = core.pack, l = core.layout; if (!p || !l) return { x: 0, y: -80 };
        const left = core.body.face() === 'left';
        const hx = (left ? p.size[0] - p.hand[0] : p.hand[0]) - (left ? p.size[0] - p.anchor[0] : p.anchor[0]);
        return { x: hx * l.scale, y: (p.hand[1] - p.anchor[1]) * l.scale };
      }
    },
    core: {
      shown: () => core.shown, stage: () => core.stage,
      toIdle: () => core.toIdle(), setPosture: p => core.setPosture(p),
      antic: () => !!core.antic, setAntic: v => { core.antic = !!v; },
      brain: { touch: () => core.brain.touch(), wake: () => core.brain.wake(), sleep: () => core.brain.sleep(), isSleeping: () => core.brain.isSleeping(), sit: () => core.brain.sit() }
    }
  });

  // ---- đồ đang mặc: vẽ đè lên bé (điểm neo ở src/shared/outfit.js)
  let worn = {};
  let catalogItems = null;
  function itemsById() {
    if (catalogItems) return catalogItems;
    catalogItems = new Map();
    try {
      const C = require('../game/catalog.js');
      for (const it of C.loadCatalog(C.DEFAULT_PATH).items) catalogItems.set(it.id, it);
    } catch (e) { console.error('[petcore] không đọc được danh mục đồ', e && e.message); }
    return catalogItems;
  }
  function outfitPayload() {
    const map = itemsById(), list = [];
    for (const slot of Object.keys(worn)) {
      const it = map.get(worn[slot]);
      if (!it || !it.icon) continue;
      try { list.push({ slot, src: pathToFileURL(path.join(ctx.paths.src, '..', 'assets', 'game', it.icon)).href }); }
      catch (_) { /* bỏ qua */ }
    }
    return { items: list, wear: wearStyle(worn) };
  }
  function sendOutfit() { const o = outfitPayload(); core.window.cmd({ op: 'outfit', items: o.items, wear: o.wear }); }
  core.outfitPayload = outfitPayload;           // bigAlert.js dùng để vẽ bé phóng to cùng đồ đang mặc
  // áo/áo khoác: không dán icon mà tô lại áo của bé (assets/game/wear.json + src/shared/wear.js)
  let wearData = null;
  function wearStyle(w) {
    if (!wearData) {
      try { wearData = JSON.parse(require('fs').readFileSync(path.join(ctx.paths.src, '..', 'assets', 'game', 'wear.json'), 'utf8')); }
      catch (e) { wearData = { items: {} }; console.error('[petcore] wear.json', e && e.message); }
    }
    const items = wearData.items || {};
    const b = w.body ? items[w.body] : null, o = w.outer ? items[w.outer] : null;
    if (!b && !o) return null;
    const j = o || b;
    return { key: (w.body || '') + '|' + (w.outer || ''), light: j.light, dark: j.dark, pattern: j.pattern || 'none', pc: j.pc || '#ffffff',
      shirt: b ? b.shirt || null : null, tie: b ? b.tie || null : null };
  }
  bus.on('game:outfit', d => { worn = (d && d.worn && typeof d.worn === 'object') ? Object.assign({}, d.worn) : {}; sendOutfit(); });
  core.window.on('packReady', () => {
    try { if (ctx.game && typeof ctx.game.view === 'function') { const v = ctx.game.view(); if (v && v.worn && ctx.game.enabled()) worn = Object.assign({}, v.worn); } }
    catch (_) { /* bỏ qua */ }
    sendOutfit();
  });

  // ---- bus
  let prevS = Object.assign({}, ctx.settings());
  bus.on('game:mode', d => {
    const m = d && (typeof d === 'string' ? d : d.mode);
    if (MODES.includes(m) && m !== core.curMode) {
      core.curMode = m;
      if (core.shown && !core.stage && !core.body.busy() && !core.brain.isSleeping() && core.curPosture === 'idle') core.toIdle();
    }
  });
  bus.on('settings:changed', d => {
    const s = (d && d.settings) || ctx.settings();
    if (s.mascotIdle !== prevS.mascotIdle) setSettings({ alwaysVisible: !!s.mascotIdle });
    if (s.mascotEnabled !== prevS.mascotEnabled) applyVisibility();
    if (s.sound !== prevS.sound) core.window.sendSettings();
    prevS = Object.assign({}, s);
  });
  bus.on('app:startup', () => {
    applyVisibility({ startup: true });
    if (process.env.MOCHI_PET_DEMO) setTimeout(() => runDemo(process.env.MOCHI_PET_DEMO), 1500);
  });

  // Gỡ lỗi/nghiệm thu: MOCHI_PET_DEMO = lifted | sleep | walk | peek (chạy sau app:startup ~1.5s).
  async function runDemo(what) {
    try {
      if (!core.shown) await show({ startup: false });
      if (!core.shown) return;
      await new Promise(r => setTimeout(r, 600));
      if (what === 'lifted') core.body.demoLift();         // không bám chuột
      else if (what === 'sleep') core.brain.sleep();
      else if (what === 'walk') core.body.walk({ dir: 'left', dist: 400 });
      else if (what === 'peek') core.body.peek('right');
    } catch (e) { console.error('[petcore] demo', e); }
  }

  app.on('before-quit', () => {
    try {
      if (core.shown && core.body.placedYet()) core.body.save();
      ctx.store.flushSync();
    } catch (_) { /* bỏ qua */ }
  });
  void screen;
}

module.exports = { init, defaults, normalize };
