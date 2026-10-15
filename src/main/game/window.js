'use strict';
// Cửa sổ "Phòng của Mochi": một cửa sổ duy nhất, 760×560.
const path = require('path');
const { BrowserWindow, screen } = require('electron');

const W = 760, H = 560;

function open(ctx, tab) {
  tab = typeof tab === 'string' ? tab : '';
  const cur = ctx.windows.game;
  if (ctx.alive(cur)) {
    if (cur.isMinimized()) cur.restore();
    cur.show(); cur.focus();
    if (tab) ctx.send(cur, 'game:tab', tab);
    return cur;
  }
  const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const win = new BrowserWindow({
    width: W, height: H, minWidth: 640, minHeight: 480,
    x: Math.round(a.x + (a.width - W) / 2), y: Math.round(a.y + (a.height - H) / 2),
    frame: false, show: false, resizable: true, title: 'Phòng của Mochi',
    backgroundColor: '#f3f7fd',
    webPreferences: ctx.webPrefs()
  });
  ctx.windows.game = win;
  ctx.hardenWebContents(win);
  win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.show(); win.focus(); } });
  win.on('closed', () => { if (ctx.windows.game === win) ctx.windows.game = null; });
  if (tab) win.webContents.once('did-finish-load', () => ctx.send(win, 'game:tab', tab));
  win.loadFile(path.join(ctx.paths.src, 'game/room.html'));
  return win;
}

module.exports = { open };
