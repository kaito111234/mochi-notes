'use strict';
// Điểm vào mỏng: single instance, vòng đời app, nạp module theo thứ tự rồi gọi init(ctx).
const { app, Menu, globalShortcut, powerMonitor, Notification } = require('electron');
require('./logger.js').init(app);   // nhật ký lỗi: <userData>\logs, giữ 7 ngày
const path = require('path');
const bus = require('./bus.js');
const ctx = require('./context.js');
const { createStore } = require('./store.js');

app.setAppUserModelId('vn.joiha.mochinotes');
// Chạy thử không đụng dữ liệu thật: MOCHI_DATA_DIR=<thư mục> (phải đặt trước khi xin khoá single instance).
if (process.env.MOCHI_DATA_DIR) { app.setPath('userData', process.env.MOCHI_DATA_DIR); global.mochiCtx = ctx; global.mochiRequire = require; }
// Tiết kiệm RAM: mỗi note là một cửa sổ; gom tối đa 6 tiến trình renderer (20 note: ~570MB -> ~320MB). MOCHI_RENDERERS=0 để tắt.
{ const lim = process.env.MOCHI_RENDERERS === undefined ? 6 : Number(process.env.MOCHI_RENDERERS); if (lim > 0) app.commandLine.appendSwitch('renderer-process-limit', String(lim)); }

// Thứ tự nạp: cửa sổ -> nghiệp vụ -> IPC -> khay. (API gọi nhau lúc chạy qua ctx nên không phụ thuộc thứ tự.)
const modules = [
  require('./notes/noteWindows.js'),
  require('./notes/noteService.js'),
  require('./notes/reminderLoop.js'),
  require('./notes/ipcNotes.js'),
  require('./pet/mascotWindow.js'),
  require('./pet/ipcPet.js'),
  require('./listWindow.js'),
  require('./tray.js'),
  require('./updater.js')
];
// Module của từng phòng: mỗi phòng sở hữu src/main/<thư mục>/index.js xuất init(ctx).
// Thư mục chưa tồn tại thì bỏ qua — các phòng KHÔNG sửa danh sách này, chỉ tạo index.js của mình.
for (const dir of ['alarms', 'paper', 'petcore', 'game', 'persona', 'antics', 'extras', 'backup', 'onboarding']) {
  try { modules.push(require('./' + dir + '/index.js')); }
  catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(dir + '/index.js')) throw e; }
}

// Báo người dùng khi file dữ liệu hỏng (store đã cất bản hỏng và khôi phục nếu có bản sao lưu).
function reportRecovery() {
  try {
    const st = ctx.store;
    if (!st || (!st.recoveredFrom && !st.corruptCopy) || !Notification.isSupported()) return;
    let body;
    if (st.recoveredFrom) {
      const m = /mochi-data-(\d{4})-(\d{2})-(\d{2})\.json$/.exec(path.basename(st.recoveredFrom));
      const day = m ? m[3] + '/' + m[2] + '/' + m[1] : path.basename(st.recoveredFrom);
      body = 'Dữ liệu bị hỏng, đã khôi phục từ bản sao lưu ngày ' + day + '. Bản hỏng được giữ lại trong thư mục dữ liệu.';
    } else {
      body = 'Dữ liệu bị hỏng và chưa có bản sao lưu để khôi phục. Bản hỏng được giữ lại: ' + path.basename(st.corruptCopy);
    }
    new Notification({ title: 'Mochi Notes', body }).show();
    console.log('[store] ' + body);
  } catch (_) { /* bỏ qua */ }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    // toast.js tự xử lý URL mochi-notes:// (nút Tắt/Hoãn của thông báo)
    if ((argv || []).some(a => /^mochi-notes:\/\//i.test(String(a)))) return;
    if (app.isReady()) ctx.list.open();
  });
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
    reportRecovery();
    if (app.isPackaged) {
      try { app.setLoginItemSettings({ openAtLogin: !!ctx.settings().startup, path: process.execPath }); /* luôn ghi lại đường dẫn exe hiện tại */ } catch (_) { /* bỏ qua */ }
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
