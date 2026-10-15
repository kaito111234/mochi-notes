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
    const petApi = ctx.pet && typeof ctx.pet.settings === 'function' && typeof ctx.pet.setSettings === 'function' ? ctx.pet : null;
    const ps = petApi ? (petApi.settings() || {}) : {};
    const setPet = patch => { try { petApi.setSettings(patch); } catch (_) { /* bỏ qua */ } rebuild(); };
    const petItems = petApi ? [
      { label: 'Bé luôn ở trên desktop', type: 'checkbox', checked: ps.alwaysVisible !== false, click: i => setPet({ alwaysVisible: i.checked }) },
      { label: 'Cho bé đi lại', type: 'checkbox', checked: ps.walkEnabled !== false, click: i => setPet({ walkEnabled: i.checked }) },
      { label: 'Cỡ bé', submenu: [0.75, 1, 1.25].map(v => ({
        label: Math.round(v * 100) + '%', type: 'radio', checked: Math.abs((ps.scale || 1) - v) < 0.01, click: () => setPet({ scale: v })
      })) }
    ] : [
      { label: 'Bé ngồi góc màn hình', type: 'checkbox', checked: s.mascotIdle, click: item => ctx.notes.applySettings({ mascotIdle: item.checked }) }
    ];
    const toggle = key => item => ctx.notes.applySettings({ [key]: item.checked });
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Note mới', click: () => ctx.notes.createNote({}) },
      { label: 'Hiện tất cả note', click: () => ctx.notes.showAll() },
      { label: 'Ẩn tất cả note', click: () => ctx.notes.hideAll() },
      { label: 'Danh sách note', click: () => ctx.list.open() },
      { label: 'Báo thức…', click: () => ctx.list.open('alarms') },
      { label: 'Dặn dò…', click: () => ctx.list.open('memos') },
      ...(ctx.game && typeof ctx.game.open === 'function' ? [
        { label: 'Phòng của Mochi…', click: () => ctx.game.open() },
        { label: 'Máy gacha', click: () => ctx.game.open('gacha') }
      ] : []),
      { label: 'Gọi bé ra', click: () => ctx.pet.enqueueHello() },
      { type: 'separator' },
      ...petItems,
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
    reg('Ctrl+Alt+G', () => { if (ctx.game && typeof ctx.game.open === 'function') ctx.game.open(); });
  }
  Object.assign(ctx.tray, { rebuild, createTray, registerShortcuts });
}

module.exports = { init };
