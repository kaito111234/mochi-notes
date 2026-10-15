'use strict';
// Điểm vào mỏng: single instance, vòng đời app, nạp module theo thứ tự rồi gọi init(ctx).
const { app, Menu, globalShortcut, powerMonitor } = require('electron');
const bus = require('./bus.js');
const ctx = require('./context.js');
const { createStore } = require('./store.js');

app.setAppUserModelId('vn.joiha.mochinotes');

// Thứ tự nạp: cửa sổ -> nghiệp vụ -> IPC -> khay. (API gọi nhau lúc chạy qua ctx nên không phụ thuộc thứ tự.)
const modules = [
  require('./notes/noteWindows.js'),
  require('./notes/noteService.js'),
  require('./notes/reminderLoop.js'),
  require('./notes/ipcNotes.js'),
  require('./pet/mascotWindow.js'),
  require('./pet/ipcPet.js'),
  require('./listWindow.js'),
  require('./tray.js')
];
// Module của từng phòng: mỗi phòng sở hữu src/main/<thư mục>/index.js xuất init(ctx).
// Thư mục chưa tồn tại thì bỏ qua — các phòng KHÔNG sửa danh sách này, chỉ tạo index.js của mình.
for (const dir of ['alarms', 'petcore', 'game', 'persona']) {
  try { modules.push(require('./' + dir + '/index.js')); }
  catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(dir + '/index.js')) throw e; }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (app.isReady()) ctx.list.open(); });
  app.on('window-all-closed', () => { /* ở lại khay hệ thống */ });
  app.on('before-quit', () => {
    ctx.quitting = true;
    if (ctx.store) {
      for (const [id, w] of ctx.windows.notes) {
        const n = ctx.findNote(id);
        if (n && ctx.alive(w) && !w.isMinimized()) n.bounds = w.getBounds();
      }
      ctx.store.flushSync();
    }
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (ctx.store) ctx.store.flushSync(); });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (process.env.MOCHI_DEV_LIST) setTimeout(() => ctx.list.open(), 2500);
    ctx.store = createStore(app.getPath('userData'));
    for (const m of modules) m.init(ctx);
    if (ctx.store.isFirstRun && ctx.store.data.notes.length === 0) ctx.notes.seed();
    ctx.tray.createTray();
    ctx.tray.registerShortcuts();
    if (app.isPackaged) {
      try { app.setLoginItemSettings({ openAtLogin: !!ctx.settings().startup }); } catch (_) { /* bỏ qua */ }
    }
    if (!ctx.settings().allHidden) ctx.notes.openAllVisible(true);
    ctx.notes.startReminderLoop();
    // Sự kiện vòng đời cho các phòng (docs/spec/02-events.md)
    bus.emit('app:startup', {});
    try {
      powerMonitor.on('resume', () => bus.emit('app:resume', {}));
      powerMonitor.on('unlock-screen', () => bus.emit('app:resume', {}));
      let wasIdle = false;
      setInterval(() => {
        const idle = powerMonitor.getSystemIdleTime() >= 300;   // 5 phút không đụng chuột/phím
        if (idle && !wasIdle) bus.emit('app:idle', {});
        if (!idle && wasIdle) bus.emit('app:resume', {});
        wasIdle = idle;
      }, 30000);
    } catch (_) { /* powerMonitor không có trên môi trường thử */ }
  });
}
