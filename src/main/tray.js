'use strict';
// Khay hệ thống + phím tắt toàn cục.
const { app, Tray, Menu, globalShortcut, nativeImage, dialog, shell } = require('electron');

function init(ctx) {
  let tray = null;
  // Sao lưu đám mây: main.js chưa liệt kê thư mục backup nên khay tự nạp (init chỉ chạy một lần).
  try { require('./backup/index.js').init(ctx); } catch (e) { console.error('[tray] không nạp được backup', e); }

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
      { label: 'Nhắc to giữa màn hình', type: 'checkbox', checked: ps.bigAlert !== false, click: i => setPet({ bigAlert: i.checked }) },
      { label: 'Giờ yên lặng 22h–7h', type: 'checkbox', checked: !(ps.quietHours && ps.quietHours.on === false), click: i => setPet({ quietHours: { on: i.checked } }) },
      { label: 'Không nhắc to khi đang họp/trình chiếu', type: 'checkbox', checked: ps.smartAlert !== false, click: i => setPet({ smartAlert: i.checked }) },
      { label: 'Âm lượng nhắc', submenu: [['Tắt', 0], ['Nhỏ', 30], ['Vừa', 70], ['To', 100]].map(([name, v]) => ({
        label: v === 0 ? name : name + ' ' + v, type: 'radio', checked: (typeof ps.alertVolume === 'number' ? ps.alertVolume : 70) === v, click: () => setPet({ alertVolume: v })
      })) },
      { label: 'Hiệu ứng nhắc to', submenu: [['Sinh động', 'full'], ['Nhẹ nhàng', 'calm']].map(([name, v]) => ({
        label: name, type: 'radio', checked: (ps.alertMotion === 'calm' ? 'calm' : 'full') === v, click: () => setPet({ alertMotion: v })
      })) },
      { label: 'Cỡ bé', submenu: [0.75, 1, 1.25].map(v => ({
        label: Math.round(v * 100) + '%', type: 'radio', checked: Math.abs((ps.scale || 1) - v) < 0.01, click: () => setPet({ scale: v })
      })) }
    ] : [
      { label: 'Bé ngồi góc màn hình', type: 'checkbox', checked: s.mascotIdle, click: item => ctx.notes.applySettings({ mascotIdle: item.checked }) }
    ];
    const bk = ctx.backup && typeof ctx.backup.state === 'function' ? ctx.backup : null;
    const bs = bk ? bk.state() : null;
    const backupItems = bk ? [{ label: 'Sao lưu', submenu: [
      { label: 'Sao lưu lên: ' + (bs.dir ? bs.name : '(chưa chọn)'), type: 'checkbox', checked: bs.on && !!bs.dir, click: i => { if (!bs.dir && i.checked) bk.chooseDir(); else bk.setOn(i.checked); } },
      { label: 'Chọn thư mục sao lưu…', click: () => bk.chooseDir() },
      { label: 'Sao lưu ngay', enabled: !!bs.dir, click: () => { bk.backupNow(); rebuild(); } },
      { label: 'Khôi phục từ bản sao lưu…', enabled: !!bs.dir, click: () => bk.restore() },
      { label: 'Mở thư mục sao lưu', enabled: !!bs.dir, click: () => bk.openDir() }
    ] }] : [];
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
      ...backupItems,
      { type: 'separator' },
      { label: 'Hướng dẫn sử dụng', click: () => { try { ctx.onboarding.open(); } catch (_) { /* bỏ qua */ } } },
      { label: 'Giới thiệu Mochi Notes', click: () => showAbout() },
      { label: 'Thoát', click: () => app.quit() }
    ]));
  }
  function showAbout() {
    const dir = app.getPath('userData');
    const canUpd = !!(ctx.updater && ctx.updater.enabled());
    const buttons = ['Mở thư mục dữ liệu'].concat(canUpd ? ['Kiểm tra cập nhật'] : []).concat(['Đóng']);
    dialog.showMessageBox({
      type: 'info', title: 'Giới thiệu Mochi Notes', message: 'Mochi Notes ' + app.getVersion(),
      detail: 'Joiha\nElectron ' + process.versions.electron + ' · Chrome ' + process.versions.chrome +
        '\nThư mục dữ liệu: ' + dir + (canUpd ? '' : '\nTự cập nhật: đang tắt'),
      buttons, defaultId: buttons.length - 1, cancelId: buttons.length - 1, noLink: true
    }).then(async r => {
      if (r.response === 0) shell.openPath(dir);
      else if (canUpd && r.response === 1) {
        const u = await ctx.updater.check();
        dialog.showMessageBox({ type: u.ok ? 'info' : 'warning', title: 'Mochi Notes', message: u.message, buttons: ['Đóng'] });
      }
    }).catch(() => {});
  }
  function createTray() {
    tray = new Tray(trayIcon());
    tray.setToolTip('Mochi Notes ' + app.getVersion());
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
