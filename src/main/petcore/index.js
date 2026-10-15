'use strict';
// Phòng core — thân bé: ngăn dữ liệu 'pet', cửa sổ, thân (vị trí/vật lý), não (hành vi rảnh).
// Đăng ký ctx.pet.{settings,setSettings,mode,actor,body}; xem docs/rooms/core/ARCH.md mục 4.
const { app, screen } = require('electron');
const { createWindow } = require('./window.js');
const { createBody } = require('./body.js');
const { createBrain } = require('./brain.js');
const { createCapture } = require('./capture.js');
const { createMenu } = require('./menu.js');
// Module của nhân viên khác: có thì nối, chưa có thì bỏ qua.
function optional(file, name) {
  try { const m = require(file); return typeof m[name] === 'function' ? m[name] : null; }
  catch (e) { if (!e || e.code !== 'MODULE_NOT_FOUND') console.error('[petcore] lỗi nạp', file, e && e.message); return null; }
}

const POSTURES = ['idle', 'walk', 'sit', 'sleep', 'lifted', 'peek', 'work'];
const MODES = ['happy', 'normal', 'tired', 'sad'];

function defaults() {
  return { x: null, y: null, displayId: null, posture: 'idle', draft: '', hiddenUntil: 0, outfit: {}, settings: { alwaysVisible: true, scale: 1, walkEnabled: true, climbEnabled: true, followCursor: true, autoTidy: false, tidyEnabled: true, knockEnabled: true } };
}
function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  d.x = num(raw.x); d.y = num(raw.y); d.displayId = num(raw.displayId);
  if (POSTURES.includes(raw.posture)) d.posture = raw.posture;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  if (typeof s.alwaysVisible === 'boolean') d.settings.alwaysVisible = s.alwaysVisible;
  if (typeof s.walkEnabled === 'boolean') d.settings.walkEnabled = s.walkEnabled;
  if (typeof s.climbEnabled === 'boolean') d.settings.climbEnabled = s.climbEnabled;
  if (typeof s.followCursor === 'boolean') d.settings.followCursor = s.followCursor;
  if (typeof s.autoTidy === 'boolean') d.settings.autoTidy = s.autoTidy;
  if (typeof s.tidyEnabled === 'boolean') d.settings.tidyEnabled = s.tidyEnabled;
  if (typeof s.knockEnabled === 'boolean') d.settings.knockEnabled = s.knockEnabled;
  if (raw.outfit && typeof raw.outfit === 'object' && !Array.isArray(raw.outfit)) d.outfit = Object.assign({}, raw.outfit);
  if (typeof raw.draft === 'string') d.draft = raw.draft.slice(0, 2000);
  if (num(raw.hiddenUntil) != null && raw.hiddenUntil > 0) d.hiddenUntil = raw.hiddenUntil;
  if (typeof s.scale === 'number' && isFinite(s.scale)) d.settings.scale = Math.min(2, Math.max(0.5, s.scale));
  return d;
}

function init(ctx) {
  const bus = ctx.bus;
  const box = ctx.store.section('pet', defaults, normalize);

  const core = {
    ctx, box, pack: null, layout: null,
    stage: false, shown: false, showSeq: 0, curPosture: 'idle', curMode: 'normal',
    window: null, body: null, brain: null, actor: null,
    capture: null, menu: null, settingsWin: null, flash: null, tidy: null, knock: null,
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
  core.capture = createCapture(core);
  core.menu = createMenu(core);
  const mkSettings = optional('./settingsWindow.js', 'createSettingsWindow');
  const mkFlash = optional('./flash.js', 'createFlash');
  try { if (mkSettings) core.settingsWin = mkSettings(core); } catch (e) { console.error('[petcore] settingsWindow', e && e.message); }
  const mkTidy = optional('./tidy.js', 'createTidy');
  const mkKnock = optional('./knock.js', 'createKnock');
  try { if (mkTidy) core.tidy = mkTidy(core); } catch (e) { console.error('[petcore] tidy', e && e.message); }
  try { if (mkKnock) core.knock = mkKnock(core); } catch (e) { console.error('[petcore] knock', e && e.message); }
  try { if (mkFlash) core.flash = mkFlash(core); } catch (e) { console.error('[petcore] flash', e && e.message); }

  // ---- play: Promise resolve khi animEnd cùng token (loop thì resolve ngay), an toàn 10s
  let tokenSeq = 0;
  const pending = new Map();           // token -> resolve
  function settleAll() { for (const [, r] of pending) r(); pending.clear(); }
  core.window.on('animEnd', d => {
    const r = pending.get(d.token);
    if (r) { pending.delete(d.token); r(); }
  });

  function play(action, opts) {
    opts = opts || {};
    const mood = MODES.includes(opts.mood) ? opts.mood : core.curMode;
    settleAll();                                       // hình mới cắt ngang hình cũ
    const token = ++tokenSeq;
    if (process.env.MOCHI_PET_LOG) console.log('[play]', action, opts.loop ? 'loop' : 'once', Date.now() % 100000, action === 'idle' && process.env.MOCHI_PLAY_STACK ? new Error().stack.split('\n').slice(2, 5).join(' | ') : '');
    core.window.cmd({ op: 'play', action, mood, loop: !!opts.loop, token });
    if (opts.loop) return Promise.resolve();
    return new Promise(resolve => {
      const t = setTimeout(() => { pending.delete(token); resolve(); }, 10000);
      pending.set(token, () => { clearTimeout(t); resolve(); });
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

  function wantVisible() { return !!(box.settings.alwaysVisible && ctx.settings().mascotEnabled && Date.now() >= (box.hiddenUntil || 0)); }
  let hideTimer = null;
  function armHideTimer() {
    clearTimeout(hideTimer); hideTimer = null;
    const left = (box.hiddenUntil || 0) - Date.now();
    if (left <= 0) { if (box.hiddenUntil) { box.hiddenUntil = 0; ctx.store.save(); } return; }
    // setTimeout tối đa ~24 ngày; hẹn lại theo từng đoạn nếu dài hơn
    hideTimer = setTimeout(() => { armHideTimer(); if (!box.hiddenUntil) applyVisibility(); }, Math.min(left + 50, 2147000000));
  }
  function hideFor(ms) {
    ms = Number(ms);
    if (!isFinite(ms) || ms <= 0) { box.hiddenUntil = 0; }
    else box.hiddenUntil = Date.now() + Math.min(ms, 24 * 3600 * 1000);
    ctx.store.save();
    armHideTimer();
    if (core.capture.isOpen()) core.capture.close();
    applyVisibility();
    return box.hiddenUntil;
  }
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
    goToNote: id => (core.body && typeof core.body.goToNote === 'function'
      ? core.body.goToNote(id) : Promise.resolve({ ok: false, side: null })),
    goToRect: (rect, opts) => (core.body && typeof core.body.goToRect === 'function'
      ? core.body.goToRect(rect, opts) : Promise.resolve({ ok: false, side: null })),
    handScreen: () => { try { return core.body && typeof core.body.handScreen === 'function' ? core.body.handScreen() : null; } catch (_) { return null; } },
    on: (type, fn) => core.window.on(type, fn)
  };
  core.actor = actor;

  function setSettings(patch) {
    if (!patch || typeof patch !== 'object') return box.settings;
    const s = box.settings, prev = Object.assign({}, s);
    if (typeof patch.alwaysVisible === 'boolean') s.alwaysVisible = patch.alwaysVisible;
    if (typeof patch.walkEnabled === 'boolean') s.walkEnabled = patch.walkEnabled;
    if (typeof patch.climbEnabled === 'boolean') s.climbEnabled = patch.climbEnabled;
    if (typeof patch.followCursor === 'boolean') s.followCursor = patch.followCursor;
    if (typeof patch.autoTidy === 'boolean') s.autoTidy = patch.autoTidy;
    if (typeof patch.tidyEnabled === 'boolean') s.tidyEnabled = patch.tidyEnabled;
    if (typeof patch.knockEnabled === 'boolean') s.knockEnabled = patch.knockEnabled;
    if (typeof patch.scale === 'number' && isFinite(patch.scale)) s.scale = Math.min(2, Math.max(0.5, patch.scale));
    ctx.store.save();
    if (s.scale !== prev.scale) core.window.relayout();
    if (((!s.walkEnabled && prev.walkEnabled) || (s.climbEnabled === false && prev.climbEnabled !== false)) && !core.stage) core.body.stopWalk();
    if (s.alwaysVisible !== prev.alwaysVisible) applyVisibility();
    core.window.sendSettings();
    return s;
  }

  Object.assign(ctx.pet, {
    settings: () => box.settings,
    setSettings,
    hideFor,
    occupiedRect() {
      try {
        if (core.body && typeof core.body.occupiedRect === 'function') return core.body.occupiedRect();
      } catch (_) { /* bỏ qua */ }
      const w = core.window.win();
      if (!core.shown || !w || !w.isVisible() || !core.layout) return null;
      const b = w.getBounds(), L = core.layout;
      return { x: b.x + L.charLeft, y: b.y + L.charTop, width: L.charW, height: L.charH };
    },
    flashNote(id, ms) {
      try { return !!(core.flash && typeof core.flash.flash === 'function' && core.flash.flash(id, ms)); } catch (_) { return false; }
    },
    capture: core.capture,
    tidy: core.tidy,
    knock: core.knock,
    mode: () => core.curMode,
    actor,
    body: { pos: () => core.body.pos(), posture: () => core.curPosture }
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
  bus.on('game:outfit', d => {
    const worn = d && d.worn && typeof d.worn === 'object' ? d.worn : {};
    box.outfit = Object.assign({}, worn);
    try { ctx.store.save(); } catch (_) { /* bỏ qua */ }
    core.window.cmd({ op: 'outfit', worn: box.outfit });
  });
  bus.on('settings:changed', d => {
    const s = (d && d.settings) || ctx.settings();
    if (s.mascotIdle !== prevS.mascotIdle) setSettings({ alwaysVisible: !!s.mascotIdle });
    if (s.mascotEnabled !== prevS.mascotEnabled) applyVisibility();
    if (s.sound !== prevS.sound) core.window.sendSettings();
    prevS = Object.assign({}, s);
  });
  // ---- tin từ renderer bé
  const safeOn = (type, fn) => core.window.on(type, d => { try { const r = fn(d); if (r && typeof r.catch === 'function') r.catch(e => console.error('[petcore]', type, e && e.message)); } catch (e) { console.error('[petcore]', type, e && e.message); } });
  safeOn('menu', () => core.menu.popup());
  safeOn('captureOpen', () => core.capture.open());
  safeOn('captureSubmit', d => core.capture.submit(d.text, 'pet'));
  safeOn('captureCancel', d => { if (typeof d.text === 'string') core.capture.setDraft(d.text); core.capture.close(); });
  safeOn('captureDraft', d => { if (typeof d.text === 'string') core.capture.onDraft(d.text); });
  safeOn('dropText', d => { if (typeof d.text === 'string' && d.text.trim()) return core.capture.submit(d.text, 'drop'); });

  bus.on('app:startup', () => {
    armHideTimer();
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
      else if (what === 'capture') {
        // MOCHI_PET_TYPE = chữ gõ thử; MOCHI_PET_ENTER = ms sau đó gửi Enter
        await core.capture.open();
        const wc = core.window.win().webContents;
        await new Promise(r => setTimeout(r, 800));
        if (process.env.MOCHI_PET_TYPE) wc.insertText(process.env.MOCHI_PET_TYPE);
        const ms = Number(process.env.MOCHI_PET_ENTER);
        if (isFinite(ms) && ms > 0) {
          await new Promise(r => setTimeout(r, ms));
          wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
          wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
        }
      }
      else if (what === 'menu') core.menu.popup();
      else if (what === 'tidyask') {        // MOCHI_PET_NOTEY = y của note; hỏi dọn note đầu tiên (không cần note:expired)
        const y = Number(process.env.MOCHI_PET_NOTEY) || 640;
        const id = ctx.windows.notes.keys().next().value;
        const w = id && ctx.windows.notes.get(id);
        if (w && ctx.alive(w)) { const b = w.getBounds(); w.setBounds({ x: 700, y, width: b.width, height: b.height }); }
        const n = id && ctx.findNote(id);
        ctx.pet.stage.request({ kind: 'tidy', priority: 35, payload: { noteId: id, reason: 'done', title: n ? String(n.text || '').slice(0, 30) : 'Note' }, ttlMs: 30 * 60000 });
      }
      else if (what === 'expire') {          // phát bus note:expired như phòng notes (đường thật của tidy.js)
        const id = ctx.windows.notes.keys().next().value;
        bus.emit('note:expired', { noteId: id, reason: process.env.MOCHI_PET_REASON || 'done' });
      }
      else if (what === 'memo') bus.emit('memo:due', { memoId: 'demo1', text: 'Nhớ uống thuốc nha', when: process.env.MOCHI_PET_WHEN || 'morning' });   // đúng đường của phòng alarms
      else if (what === 'settings') core.settingsWin && core.settingsWin.open();
      else if (what === 'hide') ctx.pet.hideFor(3600000);
      else if (what === 'drop') core.window.emit('dropText', { text: process.env.MOCHI_PET_TYPE || 'https://example.com/trang', kind: 'url' });
      else if (what === 'point' || what === 'done') {
        if (process.env.MOCHI_PET_LOG) setInterval(() => { const w = core.window.win(); if (w) console.log('[pet:bounds]', JSON.stringify(w.getBounds())); }, 5000).unref();
        // note mẫu 0.1 "Uống nước nè, 1 phút nữa" tự có sẵn khi mở lần đầu: chỉ cần chờ ~1 phút
        // MOCHI_PET_NOTEY = y (mặc định 640): dời note đó xuống thấp để bé có sàn đứng cạnh nó
        const y = Number(process.env.MOCHI_PET_NOTEY) || 640;
        for (const [id, w] of ctx.windows.notes) {
          const n = ctx.findNote(id);
          if (n && /Uống nước/.test(n.text || '') && ctx.alive(w)) { const b = w.getBounds(); w.setBounds({ x: 700, y, width: b.width, height: b.height }); }
        }
      }
    } catch (e) { console.error('[petcore] demo', e); }
  }

  app.on('before-quit', () => {
    try {
      clearTimeout(hideTimer);
      for (const m of [core.tidy, core.knock]) { try { if (m && typeof m.stop === 'function') m.stop(); } catch (_) { /* bỏ qua */ } }
      if (core.shown && core.body.placedYet()) core.body.save();
      ctx.store.flushSync();
    } catch (_) { /* bỏ qua */ }
  });
  void screen;
}

module.exports = { init, defaults, normalize };
