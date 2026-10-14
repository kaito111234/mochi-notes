'use strict';
// ctx dùng chung: các module đăng ký API của mình vào ctx.<ns> trong init(ctx) và gọi nhau lúc chạy
// (ctx.notes.x(), ctx.pet.x(), ctx.list.x(), ctx.tray.x()) nên không cần require vòng.
const path = require('path');
const bus = require('./bus.js');

const SRC = path.join(__dirname, '..');
const paths = {
  src: SRC,
  preload: path.join(__dirname, 'preload.js'),
  noteHtml: path.join(SRC, 'note/note.html'),
  listHtml: path.join(SRC, 'list/list.html'),
  mascotHtml: path.join(SRC, 'mascot/mascot.html'),
  trayIcon: path.join(SRC, '../assets/tray.png')
};

const COLOR_BG = {
  yellow: '#fff3a8', green: '#d4f1c5', pink: '#ffd3e4', purple: '#e2d5ff',
  blue: '#cde8ff', gray: '#e4e4e4', charcoal: '#2d2d2d'
};

const ctx = {
  store: null,                       // gán trong main.js sau khi app ready
  bus,
  paths,
  COLOR_BG,
  quitting: false,
  settings: () => ctx.store.data.settings,
  findNote: id => ctx.store.data.notes.find(n => n.id === id) || null,
  windows: {
    notes: new Map(),                // id -> BrowserWindow
    list: null,
    mascot: null
  },
  // API do từng module đăng ký:
  notes: {}, pet: {}, list: {}, tray: {},
  // tiện ích cửa sổ
  alive: w => !!w && !w.isDestroyed() && !w.webContents.isDestroyed(),
  send: (w, ch, d) => { if (ctx.alive(w)) w.webContents.send(ch, d); },
  webPrefs: () => ({
    preload: paths.preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    autoplayPolicy: 'no-user-gesture-required'
  }),
  hardenWebContents: win => {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
  },
  useGlass: () => process.platform === 'win32' && !!ctx.settings().glass
};

module.exports = ctx;
