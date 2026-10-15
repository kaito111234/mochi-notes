'use strict';
// Nạp sớm vào tiến trình main bằng `electron -r hook.js` (chỉ khi chạy E2E, xem app.js).
// - globalThis.__mochiCtx(): ctx thật của app.
// - globalThis.__mochiShortcuts: { 'Ctrl+Alt+N': fn, ... } — phím tắt toàn cục đã đăng ký
//   (xvfb không gửi được phím toàn cục, nên test gọi thẳng hàm đã đăng ký).
// - globalThis.__mochiTrayMenu: Menu khay gần nhất (bấm mục: item.click()).
const path = require('path');
globalThis.__mochiCtx = () => require(path.join(__dirname, '..', '..', '..', 'src', 'main', 'context.js'));
globalThis.__mochiRequire = m => require(m);
globalThis.__mochiShortcuts = {};
globalThis.__mochiTrayMenu = null;
const electron = require('electron');
electron.app.whenReady().then(() => {
  const gs = electron.globalShortcut;
  const reg = gs.register.bind(gs);
  gs.register = (acc, fn) => { globalThis.__mochiShortcuts[acc] = fn; return reg(acc, fn); };
  const proto = electron.Tray && electron.Tray.prototype;
  if (proto && proto.setContextMenu) {
    const set = proto.setContextMenu;
    proto.setContextMenu = function (menu) { globalThis.__mochiTrayMenu = menu; return set.call(this, menu); };
  }
});
