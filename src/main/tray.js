'use strict';
// Khay hệ thống + phím tắt toàn cục.
const { app, Tray, Menu, globalShortcut, nativeImage } = require('electron');

function init(ctx) {
  let tray = null;

  function trayIcon() {
    let img = nativeImage.createFromPath(ctx.paths.trayIcon);
    if (!img || img.isEmpty()) img = nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4), { width: 16, height: 16 });
    return img;
  }
  function rebuild() {
    if (!tray) return;
    const s = ctx.settings();
    const toggle = key => item => ctx.notes.applySettings({ [key]: item.checked });
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Note mới', click: () => ctx.notes.createNote({}) },
      { label: 'Hiện tất cả note', click: () => ctx.notes.showAll() },
      { label: 'Ẩn tất cả note', click: () => ctx.notes.hideAll() },
      { label: 'Danh sách note', click: () => ctx.list.open() },
      { label: 'Gọi bé ra', click: () => ctx.pet.enqueueHello() },
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
    tray.on('double-click', () => ctx.list.open());
    rebuild();
  }
  function registerShortcuts() {
    const reg = (acc, fn) => { try { globalShortcut.register(acc, fn); } catch (_) { /* bỏ qua */ } };
    reg('Ctrl+Alt+N', () => ctx.notes.createNote({}));
    reg('Ctrl+Alt+H', () => ctx.notes.toggleAll());
    reg('Ctrl+Alt+L', () => ctx.list.open());
    reg('Ctrl+Alt+M', () => ctx.pet.enqueueHello());
  }
  Object.assign(ctx.tray, { rebuild, createTray, registerShortcuts });
}

module.exports = { init };
