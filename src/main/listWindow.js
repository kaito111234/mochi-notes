'use strict';
// Cửa sổ danh sách note.
const { BrowserWindow, screen } = require('electron');

function init(ctx) {
  // Chuyển tab: gửi 'list:tab' (renderer chưa nghe kênh này) và gọi thẳng window.MochiList.setTab trong trang.
  function gotoTab(win, tab) {
    if (!tab || !ctx.alive(win)) return;
    ctx.send(win, 'list:tab', tab);
    try {
      win.webContents.executeJavaScript(
        'window.MochiList && window.MochiList.setTab(' + JSON.stringify(String(tab)) + ')', true
      ).catch(() => {});
    } catch (_) { /* bỏ qua */ }
  }
  function open(tab) {
    if (typeof tab !== 'string') tab = '';
    const cur = ctx.windows.list;
    if (ctx.alive(cur)) {
      if (cur.isMinimized()) cur.restore();
      cur.show(); cur.focus();
      gotoTab(cur, tab);
      return;
    }
    const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const o = {
      width: 420, height: 600, minWidth: 340, minHeight: 360,
      x: Math.round(a.x + (a.width - 420) / 2), y: Math.round(a.y + (a.height - 600) / 2),
      frame: false, show: false, resizable: true, title: 'Mochi Notes',
      webPreferences: ctx.webPrefs()
    };
    if (ctx.useGlass()) { o.backgroundMaterial = 'acrylic'; o.backgroundColor = '#00000000'; }
    else o.backgroundColor = '#f6f6f6';
    const win = new BrowserWindow(o);
    ctx.windows.list = win;
    ctx.hardenWebContents(win);
    win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.show(); win.focus(); } });
    win.on('closed', () => { if (ctx.windows.list === win) ctx.windows.list = null; });
    if (tab) win.webContents.once('did-finish-load', () => gotoTab(win, tab));
    win.loadFile(ctx.paths.listHtml);
  }
  Object.assign(ctx.list, { open });
}

module.exports = { init };
