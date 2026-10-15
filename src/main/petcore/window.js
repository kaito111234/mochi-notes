'use strict';
// Cửa sổ của bé: tạo cửa sổ trong suốt, bắt tay với renderer (ready -> pack/settings -> packReady),
// nhận tin 'pet:msg' (lọc theo danh sách cho phép) và phát tới người nghe actor.on(type, fn).
const path = require('path');
const { pathToFileURL } = require('url');
const { BrowserWindow, ipcMain } = require('electron');

// Các loại tin renderer -> main được phép (docs/rooms/core/ARCH.md mục 2).
const ALLOWED = new Set(['ready', 'packReady', 'animEnd', 'lift', 'drop', 'interact', 'button', 'sayEnd', 'noteClick', 'hover']);

/** Gói tối thiểu khi gói thật lỗi/thiếu: engine sẽ vẽ khung giữ chỗ. */
function minimalPack(dir) {
  return {
    id: 'mochi', name: 'Mochi', author: '', license: '', dir,
    size: [256, 320], scale: 0.6, anchor: [128, 316], hand: [128, 170],
    hitbox: { head: [40, 0, 176, 140], body: [40, 140, 176, 180] },
    faces: {}, params: {}, anims: {}, warnings: ['Dùng gói tối thiểu (không nạp được gói thật)']
  };
}

function loadCorePack(ctx) {
  const fallbackDir = path.join(ctx.paths.src, '..', 'assets', 'pet', 'mochi');
  try {
    const { loadPack, packDirs, findPack } = require('./pack.js');
    const dir = findPack('mochi', packDirs(ctx)) || fallbackDir;
    return loadPack(dir);
  } catch (e) {
    console.error('[petcore] không nạp được gói hình, dùng gói tối thiểu:', e && e.message);
    return minimalPack(fallbackDir);
  }
}

/** Bố cục cửa sổ theo gói + tỉ lệ người dùng (xem ARCH mục 2). */
function computeLayout(pack, settings) {
  const scale = (pack.scale || 1) * (settings.scale || 1);
  const charW = Math.ceil(pack.size[0] * scale), charH = Math.ceil(pack.size[1] * scale);
  const winW = Math.max(charW + 40, 300);
  const winH = charH + 190;               // chỗ cho bong bóng + tờ note phía trên
  return { winW, winH, charLeft: Math.round((winW - charW) / 2), charTop: winH - charH, scale, charW, charH };
}

function createWindow(core) {
  const { ctx } = core;
  const listeners = new Map();            // type -> Set<fn>
  let win = null;
  let ready = false;
  let readyPromise = null, readyResolve = null;
  let pending = [];                       // lệnh gửi trước khi sẵn sàng

  function alive() { return ctx.alive(win); }

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type) && listeners.get(type).delete(fn);
  }
  function emit(type, data) {
    const set = listeners.get(type);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(data || {}); } catch (e) { console.error('[petcore] lỗi người nghe', type, e); }
    }
  }

  function rawSend(cmd) { if (alive()) ctx.send(win, 'pet:cmd', cmd); }

  /** Gửi lệnh; trước khi sẵn sàng thì xếp hàng (trừ lệnh bắt tay). */
  function cmd(c) {
    if (!c || typeof c !== 'object') return;
    if (ready) rawSend(c);
    else if (pending.length < 50) pending.push(c);
  }

  function sendPack() {
    const p = core.pack, L = core.layout;
    let baseUrl;
    try { baseUrl = pathToFileURL(p.dir).href + '/'; } catch (_) { baseUrl = ''; }
    rawSend({ op: 'pack', pack: p, baseUrl, layout: { winW: L.winW, winH: L.winH, charLeft: L.charLeft, charTop: L.charTop, scale: L.scale } });
    sendSettings();
  }
  function sendSettings() {
    rawSend({ op: 'settings', settings: Object.assign({}, ctx.store ? ctx.settings() : {}, core.box.settings) });
  }

  function resetReady() {
    ready = false;
    readyPromise = new Promise(res => { readyResolve = res; });
  }

  function ensure() {
    if (alive()) return win;
    core.pack = core.pack || loadCorePack(ctx);
    core.layout = computeLayout(core.pack, core.box.settings);
    resetReady();
    pending = [];
    const L = core.layout;
    const w = new BrowserWindow({
      width: L.winW, height: L.winH, show: false,
      transparent: true, frame: false, resizable: false, skipTaskbar: true,
      focusable: false, hasShadow: false, backgroundColor: '#00000000',
      title: 'Mochi', webPreferences: ctx.webPrefs()
    });
    win = w;
    ctx.windows.pet = w;
    ctx.hardenWebContents(w);
    w.setIgnoreMouseEvents(true, { forward: true });
    w.setAlwaysOnTop(true, core.stage ? 'screen-saver' : 'floating');
    w.setVisibleOnAllWorkspaces(true);
    w.on('closed', () => {
      if (win === w) { win = null; if (ctx.windows.pet === w) ctx.windows.pet = null; ready = false; core.onWindowClosed(); }
    });
    w.loadFile(path.join(ctx.paths.src, 'pet/pet.html')).catch(e => console.error('[petcore] không tải được pet.html', e && e.message));
    return w;
  }

  /** Đổi kích thước (đổi scale): giữ nguyên điểm chân, nạp lại gói với layout mới. */
  function relayout() {
    if (!alive()) return;
    core.layout = computeLayout(core.pack, core.box.settings);
    ready = false;
    resetReady();
    core.body.apply();
    rawSend({ op: 'pack', pack: core.pack, baseUrl: pathToFileURL(core.pack.dir).href + '/', layout: core.layout });
  }

  function onMsg(sender, type, data) {
    if (!alive() || sender !== win.webContents) return;
    if (!ALLOWED.has(type)) return;
    data = data && typeof data === 'object' ? data : {};
    if (type === 'ready') {
      ready = false;
      if (!readyPromise) resetReady();
      sendPack();
    } else if (type === 'packReady') {
      ready = true;
      const q = pending; pending = [];
      readyResolve && readyResolve(true);
      for (const c of q) rawSend(c);
    }
    emit(type, data);
  }

  ipcMain.on('pet:ignore', (e, v) => {
    if (alive() && e.sender === win.webContents) win.setIgnoreMouseEvents(!!v, { forward: true });
  });
  ipcMain.on('pet:msg', (e, type, data) => onMsg(e.sender, String(type), data));

  return {
    ensure, cmd, on, emit, relayout, sendSettings, computeLayout,
    win: () => (alive() ? win : null),
    isReady: () => ready && alive(),
    whenReady: () => { ensure(); return readyPromise; },
    setLevel(stage) { if (alive()) win.setAlwaysOnTop(true, stage ? 'screen-saver' : 'floating'); },
    destroy() { if (alive()) win.destroy(); }
  };
}

module.exports = { createWindow, computeLayout, minimalPack, ALLOWED };
