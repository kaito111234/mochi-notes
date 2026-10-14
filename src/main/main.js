'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const P = require('../shared/parse.js');
const S = require('./scheduler.js');
const { createStore, DEFAULT_SETTINGS, COLORS: COLOR_LIST } = require('./store.js');

app.setAppUserModelId('vn.joiha.mochinotes');

const COLOR_BG = {
  yellow: '#fff3a8', green: '#d4f1c5', pink: '#ffd3e4', purple: '#e2d5ff',
  blue: '#cde8ff', gray: '#e4e4e4', charcoal: '#2d2d2d'
};
const WEB_PREFS = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
  autoplayPolicy: 'no-user-gesture-required'
});
const MASCOT_W = 440, MASCOT_H = 520;

let store = null;
const noteWins = new Map();      // id -> BrowserWindow
let listWin = null;
let mascotWin = null;
let mascotReady = false;
let mascotBusy = false;
let mascotLeaveTimer = null;
const queue = [];                // {type, noteId?}
const schedState = { lastNag: Date.now(), busy: false };
let tray = null;
let quitting = false;
const fallbackRefs = new Set();

const settings = () => store.data.settings;
const findNote = id => store.data.notes.find(n => n.id === id) || null;
const newId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function alive(w) { return !!w && !w.isDestroyed() && !w.webContents.isDestroyed(); }
function send(w, ch, d) { if (alive(w)) w.webContents.send(ch, d); }
function hardenWebContents(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
}
const useGlass = () => process.platform === 'win32' && !!settings().glass;

// ------------------------------------------------------------------ thông báo thay đổi dữ liệu
let listTimer = null;
function notifyList() {
  if (listTimer) return;
  listTimer = setTimeout(() => {
    listTimer = null;
    send(listWin, 'notes:changed', store.data.notes);
  }, 60);
}
/** skipWC: webContents không cần nhận lại (người vừa gõ). */
function noteChanged(n, skipWC) {
  const w = noteWins.get(n.id);
  if (alive(w) && w.webContents !== skipWC) send(w, 'note:updated', n);
  notifyList();
}
function broadcastSettings() {
  const s = Object.assign({}, settings());
  for (const w of BrowserWindow.getAllWindows()) send(w, 'settings:changed', s);
}

// ------------------------------------------------------------------ bounds
function fitBounds(b) {
  let { x, y, width, height } = Object.assign({ width: 300, height: 320 }, b || {});
  width = Math.max(220, Math.round(Number(width) || 300));
  height = Math.max(160, Math.round(Number(height) || 320));
  x = Math.round(Number(x)); y = Math.round(Number(y));
  const ok = Number.isFinite(x) && Number.isFinite(y) && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    const ox = Math.min(x + width, a.x + a.width) - Math.max(x, a.x);
    const oy = Math.min(y + height, a.y + a.height) - Math.max(y, a.y);
    return ox >= 80 && oy >= 40;
  });
  if (!ok) {
    const a = screen.getPrimaryDisplay().workArea;
    width = Math.min(width, a.width); height = Math.min(height, a.height);
    x = Math.round(a.x + (a.width - width) / 2);
    y = Math.round(a.y + (a.height - height) / 2);
  }
  return { x, y, width, height };
}
function newNoteBounds(nearId) {
  const nw = nearId && noteWins.get(nearId);
  const near = nw && alive(nw) ? nw.getBounds() : (nearId && findNote(nearId) ? findNote(nearId).bounds : null);
  if (near) return fitBounds({ x: near.x + 32, y: near.y + 32, width: near.width, height: near.height });
  const a = screen.getPrimaryDisplay().workArea;
  const k = noteWins.size % 8;
  return fitBounds({ x: a.x + Math.round((a.width - 300) / 2) + k * 32, y: a.y + Math.round((a.height - 320) / 2) + k * 32, width: 300, height: 320 });
}

// ------------------------------------------------------------------ cửa sổ note
function openNote(id, opts = {}) {
  const note = findNote(id);
  if (!note) return null;
  const old = noteWins.get(id);
  if (alive(old)) {
    if (old.isMinimized()) old.restore();
    if (opts.focus !== false) { old.show(); old.focus(); } else old.showInactive();
    return old;
  }
  const b = fitBounds(note.bounds);
  note.bounds = b;
  const o = {
    x: b.x, y: b.y, width: b.width, height: b.height,
    minWidth: 220, minHeight: 160,
    frame: false, show: false, skipTaskbar: true, resizable: true,
    alwaysOnTop: !!note.alwaysOnTop, title: 'Mochi Note',
    webPreferences: WEB_PREFS()
  };
  if (useGlass()) { o.backgroundMaterial = 'acrylic'; o.backgroundColor = '#00000000'; }
  else o.backgroundColor = COLOR_BG[note.color] || COLOR_BG.yellow;
  const win = new BrowserWindow(o);
  noteWins.set(id, win);
  hardenWebContents(win);
  let bt = null;
  const saveBounds = () => {
    if (win.isDestroyed() || win.isMinimized()) return;
    const n = findNote(id);
    if (n) { n.bounds = win.getBounds(); store.save(); }
  };
  const later = () => { clearTimeout(bt); bt = setTimeout(saveBounds, 400); };
  win.on('move', later);
  win.on('resize', later);
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    if (opts.focus === false) win.showInactive(); else win.show();
  });
  win.on('close', () => {
    clearTimeout(bt);
    if (!win.__silent && !quitting) {
      const n = findNote(id);
      if (n) { saveBounds(); n.visible = false; store.save(); notifyList(); }
    } else if (!win.__silent) saveBounds();
  });
  win.on('closed', () => { if (noteWins.get(id) === win) noteWins.delete(id); });
  win.loadFile(path.join(__dirname, '../note/note.html'), { query: { id } });
  return win;
}
function closeNoteWin(id) {
  const w = noteWins.get(id);
  noteWins.delete(id);
  if (alive(w)) { w.__silent = true; w.close(); }
}
function openAllVisible(inactive) {
  for (const n of store.data.notes) if (n.visible) openNote(n.id, { focus: !inactive });
}

// ------------------------------------------------------------------ nghiệp vụ note
function makeNote(o) {
  const now = Date.now();
  const html = o.html || '';
  const text = o.text != null ? o.text : S.htmlToText(html);
  const n = {
    id: newId(), html, text,
    color: COLOR_LIST.includes(o.color) ? o.color : 'yellow',
    bounds: o.bounds || newNoteBounds(o.nearId),
    visible: true, alwaysOnTop: false, reminder: null,
    createdAt: now, updatedAt: now
  };
  if (o.autoReminder !== false) S.applyText(n, now);
  return n;
}
function createNote(opts = {}) {
  const n = makeNote(opts);
  store.data.notes.push(n);
  store.save();
  if (settings().allHidden) { settings().allHidden = false; store.save(); broadcastSettings(); rebuildTray(); openAllVisible(true); }
  openNote(n.id, { focus: true });
  notifyList();
  return n;
}
function showNote(id) {
  const n = findNote(id);
  if (!n) return null;
  n.visible = true;
  store.save();
  openNote(id, { focus: true });
  noteChanged(n);
  return n;
}
function hideNote(id) {
  const n = findNote(id);
  if (!n) return null;
  const w = noteWins.get(id);
  if (alive(w) && !w.isMinimized()) n.bounds = w.getBounds();
  n.visible = false;
  closeNoteWin(id);
  store.save();
  noteChanged(n);
  return n;
}
function deleteNote(id) {
  const i = store.data.notes.findIndex(n => n.id === id);
  if (i < 0) return false;
  closeNoteWin(id);
  store.data.notes.splice(i, 1);
  for (let k = queue.length - 1; k >= 0; k--) if (queue[k].noteId === id) queue.splice(k, 1);
  store.save();
  notifyList();
  return true;
}
function hideAll() {
  settings().allHidden = true;
  for (const id of Array.from(noteWins.keys())) {
    const w = noteWins.get(id), n = findNote(id);
    if (alive(w) && n && !w.isMinimized()) n.bounds = w.getBounds();
    closeNoteWin(id);
  }
  store.save(); broadcastSettings(); rebuildTray();
}
function showAll() {
  settings().allHidden = false;
  // Nếu chẳng note nào đang dán thì "Hiện tất cả" thật sự hiện tất cả.
  if (!store.data.notes.some(n => n.visible)) for (const n of store.data.notes) n.visible = true;
  store.save(); broadcastSettings(); rebuildTray();
  openAllVisible(false);
  notifyList();
}
function toggleAll() {
  if (settings().allHidden || noteWins.size === 0) showAll(); else hideAll();
}

// ------------------------------------------------------------------ cửa sổ danh sách
function openList() {
  if (alive(listWin)) {
    if (listWin.isMinimized()) listWin.restore();
    listWin.show(); listWin.focus();
    return;
  }
  const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const o = {
    width: 420, height: 600, minWidth: 340, minHeight: 360,
    x: Math.round(a.x + (a.width - 420) / 2), y: Math.round(a.y + (a.height - 600) / 2),
    frame: false, show: false, resizable: true, title: 'Mochi Notes',
    webPreferences: WEB_PREFS()
  };
  if (useGlass()) { o.backgroundMaterial = 'acrylic'; o.backgroundColor = '#00000000'; }
  else o.backgroundColor = '#f6f6f6';
  const win = new BrowserWindow(o);
  listWin = win;
  hardenWebContents(win);
  win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.show(); win.focus(); } });
  win.on('closed', () => { if (listWin === win) listWin = null; });
  win.loadFile(path.join(__dirname, '../list/list.html'));
}

// ------------------------------------------------------------------ bé Mochi
function ensureMascot() {
  if (alive(mascotWin)) return mascotWin;
  mascotReady = false;
  const win = new BrowserWindow({
    width: MASCOT_W, height: MASCOT_H, show: false,
    transparent: true, frame: false, resizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, backgroundColor: '#00000000',
    title: 'Mochi', webPreferences: WEB_PREFS()
  });
  mascotWin = win;
  hardenWebContents(win);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on('closed', () => {
    if (mascotWin === win) { mascotWin = null; mascotReady = false; mascotBusy = false; schedState.busy = queue.length > 0; }
  });
  win.loadFile(path.join(__dirname, '../mascot/mascot.html'));
  return win;
}
function placeMascot() {
  const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  mascotWin.setBounds({
    x: a.x + a.width - MASCOT_W - 8,
    y: a.y + a.height - MASCOT_H,
    width: MASCOT_W, height: MASCOT_H
  });
}
function showMascot() {
  clearTimeout(mascotLeaveTimer);
  placeMascot();
  mascotWin.setAlwaysOnTop(true, 'screen-saver');
  if (!mascotWin.isVisible()) mascotWin.showInactive();
}
function mascotNote(n) {
  const r = n.reminder;
  return {
    id: n.id, title: S.noteTitle(n.text), text: n.text || '', color: n.color,
    due: r ? r.due : null, lead: r ? r.lead : 0,
    intentLabel: r ? P.intentLabel(r.intent) : ''
  };
}
function sendMascot(ev) {
  ev.settings = Object.assign({}, settings());
  send(mascotWin, 'mascot:event', ev);
}
function validItem(item, n, now) {
  if (item.type === 'hello') return true;
  if (!n || !n.reminder || n.reminder.done) return false;
  if (item.type === 'due') return n.reminder.due <= now + 1500;
  if (item.type === 'nag') return S.overdueNotes(store.data.notes, now).length > 0;
  return true; // pre
}
function fallbackNotify(item, n, now) {
  if (!Notification.isSupported()) return;
  const r = n.reminder;
  const label = P.intentLabel(r.intent);
  let body;
  if (item.type === 'pre') body = `${label} · còn ${P.dur(r.due - now)} nữa (${P.hm(r.due)})`;
  else if (item.type === 'due') body = `${label} · đã tới giờ (${P.hm(r.due)})`;
  else body = `Quá hạn ${P.dur(now - r.due)} · ${S.overdueNotes(store.data.notes, now).length} việc chưa xong`;
  const nt = new Notification({ title: S.noteTitle(n.text) || 'Mochi Notes', body, silent: !settings().sound });
  fallbackRefs.add(nt);
  const drop = () => fallbackRefs.delete(nt);
  nt.on('click', () => { drop(); showNote(n.id); });
  nt.on('close', drop);
  nt.on('failed', drop);
  nt.show();
}
function pump() {
  if (mascotBusy) return;
  while (queue.length) {
    const item = queue[0];
    const now = Date.now();
    const n = item.noteId ? findNote(item.noteId) : null;
    if (!validItem(item, n, now)) { queue.shift(); continue; }
    if (!settings().mascotEnabled && item.type !== 'hello') {
      queue.shift();
      try { fallbackNotify(item, n, now); } catch (_) { /* bỏ qua */ }
      continue;
    }
    ensureMascot();
    if (!mascotReady) { schedState.busy = true; return; } // chờ 'mascot:ready'
    queue.shift();
    mascotBusy = true; schedState.busy = true;
    showMascot();
    const ev = { type: item.type };
    if (n) ev.note = mascotNote(n);
    if (item.type === 'nag') ev.overdueCount = S.overdueNotes(store.data.notes, now).length;
    sendMascot(ev);
    return;
  }
  schedState.busy = false;
}
/** Đồng bộ trạng thái "ngồi góc" với settings khi bé đang rảnh. */
function syncIdle() {
  if (mascotBusy || queue.length) return;
  const s = settings();
  if (s.mascotIdle && s.mascotEnabled) {
    ensureMascot();
    if (mascotReady) { showMascot(); sendMascot({ type: 'idle' }); }
  } else if (alive(mascotWin) && mascotWin.isVisible()) {
    sendMascot({ type: 'leave' });
    clearTimeout(mascotLeaveTimer);
    mascotLeaveTimer = setTimeout(() => {
      const s2 = settings();
      if (!mascotBusy && !queue.length && !(s2.mascotIdle && s2.mascotEnabled) && alive(mascotWin)) mascotWin.hide();
    }, 1200);
  }
}
function enqueueHello() {
  if (queue.some(q => q.type === 'hello')) return;
  queue.push({ type: 'hello' });
  pump();
}

ipcMain.on('mascot:ignore', (e, v) => {
  if (alive(mascotWin) && e.sender === mascotWin.webContents) mascotWin.setIgnoreMouseEvents(!!v, { forward: true });
});
ipcMain.on('mascot:ready', e => {
  if (!alive(mascotWin) || e.sender !== mascotWin.webContents) return;
  mascotReady = true;
  pump();
  if (!mascotBusy) syncIdle();
});
ipcMain.handle('mascot:summon', () => { enqueueHello(); return true; });
ipcMain.handle('mascot:action', (_e, action, noteId) => {
  const n = noteId ? findNote(noteId) : null;
  switch (action) {
    case 'done':
      if (n && S.markDone(n)) { n.updatedAt = Date.now(); store.save(); noteChanged(n); }
      return n;
    case 'snooze':
      if (n && S.snooze(n, 10)) { n.updatedAt = Date.now(); store.save(); noteChanged(n); }
      return n;
    case 'open':
      return n ? showNote(n.id) : null;
    case 'dismiss':
      mascotBusy = false;
      if (queue.length) pump();
      else {
        schedState.busy = false;
        const s = settings();
        if (s.mascotIdle && s.mascotEnabled) { showMascot(); sendMascot({ type: 'idle' }); }
        else if (alive(mascotWin)) mascotWin.hide();
      }
      return true;
    case 'poke':
      if (!mascotBusy && !queue.length) enqueueHello();
      return true;
    default:
      return false;
  }
});

// ------------------------------------------------------------------ settings
function applySettings(patch) {
  const prev = Object.assign({}, settings());
  const s = settings();
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof patch[k] === 'boolean') s[k] = patch[k];
  store.save();
  if (s.startup !== prev.startup) {
    try { app.setLoginItemSettings({ openAtLogin: !!s.startup }); } catch (_) { /* bỏ qua */ }
  }
  if (s.glass !== prev.glass) {
    const ids = Array.from(noteWins.keys());
    for (const id of ids) closeNoteWin(id);
    for (const id of ids) openNote(id, { focus: false });
    if (alive(listWin) && typeof listWin.setBackgroundMaterial === 'function' && process.platform === 'win32') {
      try { listWin.setBackgroundMaterial(s.glass ? 'acrylic' : 'none'); } catch (_) { /* bỏ qua */ }
    }
  }
  broadcastSettings();
  rebuildTray();
  if (s.mascotIdle !== prev.mascotIdle || s.mascotEnabled !== prev.mascotEnabled) syncIdle();
  return Object.assign({}, s);
}

// ------------------------------------------------------------------ tray
function trayIcon() {
  let img = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray.png'));
  if (!img || img.isEmpty()) img = nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4), { width: 16, height: 16 });
  return img;
}
function rebuildTray() {
  if (!tray) return;
  const s = settings();
  const toggle = key => item => applySettings({ [key]: item.checked });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Note mới', click: () => createNote({}) },
    { label: 'Hiện tất cả note', click: showAll },
    { label: 'Ẩn tất cả note', click: hideAll },
    { label: 'Danh sách note', click: openList },
    { label: 'Gọi bé ra', click: enqueueHello },
    { type: 'separator' },
    { label: 'Bé ngồi góc màn hình', type: 'checkbox', checked: s.mascotIdle, click: toggle('mascotIdle') },
    { label: 'Âm thanh', type: 'checkbox', checked: s.sound, click: toggle('sound') },
    { label: 'Nền kính', type: 'checkbox', checked: s.glass, click: toggle('glass') },
    { label: 'Khởi động cùng Windows', type: 'checkbox', checked: s.startup, click: toggle('startup') },
    { type: 'separator' },
    { label: 'Thoát', click: () => app.quit() }
  ]));
}
function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Mochi Notes');
  tray.on('double-click', openList);
  rebuildTray();
}

// ------------------------------------------------------------------ IPC dữ liệu
ipcMain.handle('note:get', (_e, id) => findNote(id));
ipcMain.handle('note:list', () => store.data.notes);
ipcMain.handle('note:create', (_e, opts) => createNote(opts && typeof opts === 'object' ? opts : {}));
ipcMain.handle('note:update', (e, id, patch) => {
  const n = findNote(id);
  if (!n || !patch || typeof patch !== 'object') return n;
  const now = Date.now();
  let textChanged = false;
  if (typeof patch.html === 'string') {
    n.html = patch.html;
    if (typeof patch.text !== 'string') { n.text = S.htmlToText(patch.html); textChanged = true; }
  }
  if (typeof patch.text === 'string') { n.text = patch.text; textChanged = true; }
  let colorChanged = false;
  if (COLOR_LIST.includes(patch.color) && patch.color !== n.color) {
    n.color = patch.color; colorChanged = true;
    const w = noteWins.get(id);
    if (alive(w) && !useGlass()) { try { w.setBackgroundColor(COLOR_BG[n.color]); } catch (_) { /* bỏ qua */ } }
  }
  if (textChanged) S.applyText(n, now);
  n.updatedAt = now;
  store.save();
  // Người đang gõ không cần nhận lại chính nội dung của mình (tránh nhảy con trỏ).
  noteChanged(n, textChanged && !colorChanged ? e.sender : null);
  return n;
});
ipcMain.handle('note:delete', (_e, id) => deleteNote(id));
ipcMain.handle('note:show', (_e, id) => showNote(id));
ipcMain.handle('note:hide', (_e, id) => hideNote(id));
ipcMain.handle('note:top', (_e, id, v) => {
  const n = findNote(id);
  if (!n) return null;
  n.alwaysOnTop = !!v;
  const w = noteWins.get(id);
  if (alive(w)) w.setAlwaysOnTop(!!v);
  store.save(); noteChanged(n);
  return n;
});
ipcMain.handle('note:reminder', (_e, id, r) => {
  const n = findNote(id);
  if (!n) return null;
  S.setReminder(n, r && typeof r === 'object' ? { due: Number(r.due), lead: Number(r.lead) } : null, Date.now());
  n.updatedAt = Date.now();
  store.save(); noteChanged(n);
  return n;
});
ipcMain.handle('note:done', (_e, id) => {
  const n = findNote(id);
  if (n && S.markDone(n)) { n.updatedAt = Date.now(); store.save(); noteChanged(n); }
  return n;
});
ipcMain.handle('note:snooze', (_e, id, minutes) => {
  const n = findNote(id);
  if (n && S.snooze(n, Number(minutes) || 10)) { n.updatedAt = Date.now(); store.save(); noteChanged(n); }
  return n;
});
ipcMain.handle('notes:hideAll', () => { hideAll(); return true; });
ipcMain.handle('notes:showAll', () => { showAll(); return true; });
ipcMain.handle('list:open', () => { openList(); return true; });
ipcMain.handle('settings:get', () => Object.assign({}, settings()));
ipcMain.handle('settings:set', (_e, patch) => applySettings(patch && typeof patch === 'object' ? patch : {}));
ipcMain.handle('win:close', e => {
  for (const [id, w] of noteWins) if (alive(w) && w.webContents === e.sender) { hideNote(id); return true; }
  if (alive(listWin) && listWin.webContents === e.sender) { listWin.close(); return true; }
  return false;
});

// ------------------------------------------------------------------ khởi động
function seedNotes() {
  const a = screen.getPrimaryDisplay().workArea;
  const guide =
    '<div><b>Chào bạn, mình là Mochi Notes!</b></div><div><br></div>' +
    '<div>Phím tắt dùng được mọi lúc:</div>' +
    '<ul><li>Ctrl+Alt+N: tạo note mới</li><li>Ctrl+Alt+H: ẩn/hiện tất cả note</li>' +
    '<li>Ctrl+Alt+L: mở danh sách note</li><li>Ctrl+Alt+M: gọi bé Mochi ra</li></ul>' +
    '<div><br></div><div>Cứ gõ giờ tự nhiên như "họp 3h chiều nay", bé Mochi sẽ tự hiện ra nhắc bạn.</div>';
  const n1 = makeNote({ html: guide, color: 'yellow', autoReminder: false, bounds: fitBounds({ x: a.x + a.width - 340, y: a.y + 60, width: 300, height: 340 }) });
  const n2 = makeNote({ html: '<div>Uống nước nè, 1 phút nữa</div>', color: 'pink', bounds: fitBounds({ x: a.x + a.width - 660, y: a.y + 60, width: 300, height: 200 }) });
  store.data.notes.push(n1, n2);
  store.save();
}
function registerShortcuts() {
  const reg = (acc, fn) => { try { globalShortcut.register(acc, fn); } catch (_) { /* bỏ qua */ } };
  reg('Ctrl+Alt+N', () => createNote({}));
  reg('Ctrl+Alt+H', toggleAll);
  reg('Ctrl+Alt+L', openList);
  reg('Ctrl+Alt+M', enqueueHello);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (app.isReady()) openList(); });
  app.on('window-all-closed', () => { /* ở lại khay hệ thống */ });
  app.on('before-quit', () => {
    quitting = true;
    if (store) {
      for (const [id, w] of noteWins) {
        const n = findNote(id);
        if (n && alive(w) && !w.isMinimized()) n.bounds = w.getBounds();
      }
      store.flushSync();
    }
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (store) store.flushSync(); });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (process.env.MOCHI_DEV_LIST) setTimeout(() => openList(), 2500);
    store = createStore(app.getPath('userData'));
    if (store.isFirstRun && store.data.notes.length === 0) seedNotes();
    createTray();
    registerShortcuts();
    if (app.isPackaged) {
      try { app.setLoginItemSettings({ openAtLogin: !!settings().startup }); } catch (_) { /* bỏ qua */ }
    }
    if (!settings().allHidden) openAllVisible(true);
    if (settings().mascotIdle && settings().mascotEnabled) ensureMascot();
    setInterval(() => {
      const now = Date.now();
      schedState.busy = mascotBusy || queue.length > 0;
      const r = S.tick(store.data.notes, now, schedState);
      if (r.changed) {
        store.save();
        for (const id of r.changedIds) { const n = findNote(id); if (n) noteChanged(n); }
      }
      if (r.events.length) {
        for (const ev of r.events) queue.push({ type: ev.type, noteId: ev.noteId });
        pump();
      } else if (queue.length && !mascotBusy) pump();
    }, 1000);
  });
}
