'use strict';
// Thùng rác trên desktop: cửa sổ trong suốt nhỏ đứng trên sàn màn hình. Mặc định ẨN: chỉ trồi lên cạnh bé khi bé đi dọn
// rồi lặn xuống (summon/dismiss); bật "luôn hiện" thì đứng yên chỗ đã kéo tới.
// Bấm = mở thùng rác trong danh sách note (nhặt lại note). Bé Mochi ném bóng giấy vào đây.
const path = require('path');
const { BrowserWindow, ipcMain, screen, Menu } = require('electron');

const W = 150, H = 210;          // khung cửa sổ; thùng 92x103 đứng sát đáy, phía trên chừa chỗ cho bóng rơi
const CAN_H = 103, MOUTH_Y = 26; // miệng thùng cách đỉnh thùng

function createBin(ctx, box, save) {
  let win = null, ready = false, clickCb = null, lastCount = -1, pending = null, leaveT = null, summoned = false;
  const send = c => { if (ready) ctx.send(win, 'antics:bin', c); };
  const alive = () => ctx.alive(win);

  function count() { try { return (ctx.notes.trashList() || []).length; } catch (_) { return 0; } }
  function pushCount(force) { const n = count(); if (force || n !== lastCount) { lastCount = n; send({ op: 'count', n }); } }

  function defaultPos() {
    const wa = screen.getPrimaryDisplay().workArea;
    return { x: wa.x + 18, y: wa.y + wa.height - H };
  }
  /** Giữ thùng nằm trên sàn của màn hình chứa nó. */
  function fit(x, y) {
    const d = screen.getDisplayNearestPoint({ x: Math.round(x + W / 2), y: Math.round(y + H / 2) }), wa = d.workArea;
    x = Math.min(wa.x + wa.width - W, Math.max(wa.x - 20, x));
    y = Math.min(wa.y + wa.height - H, Math.max(wa.y, y));
    return { x: Math.round(x), y: Math.round(y) };
  }
  function pos() {
    const b = box.bin;
    if (typeof b.x === 'number' && typeof b.y === 'number') return fit(b.x, b.y);
    return defaultPos();
  }

  function ensure() {
    if (alive()) return win;
    ready = false;
    const p = pos();
    const w = new BrowserWindow({
      x: p.x, y: p.y, width: W, height: H, show: false,
      transparent: true, frame: false, resizable: false, skipTaskbar: true, focusable: false, hasShadow: false,
      backgroundColor: '#00000000', title: 'Thùng rác Mochi', webPreferences: ctx.webPrefs()
    });
    win = w;
    ctx.hardenWebContents(w);
    w.setIgnoreMouseEvents(true, { forward: true });
    w.setAlwaysOnTop(true, 'floating');
    w.setVisibleOnAllWorkspaces(true);
    w.on('closed', () => { if (win === w) { win = null; ready = false; } });
    w.webContents.on('did-finish-load', () => { ready = true; pushCount(true); if (pending) { send(pending); pending = null; } });
    w.loadFile(path.join(ctx.paths.src, 'bin/bin.html')).catch(e => console.error('[antics] không tải được bin.html', e && e.message));
    return w;
  }
  function wanted() { return !!box.bin.always && ctx.settings().mascotEnabled !== false; }
  function show() {
    const w = ensure();
    if (!w.isVisible()) w.showInactive();
    // luôn đè lên note nhưng dưới bé (bé dùng cùng mức 'floating' và được đưa lên sau)
    try { const pw = ctx.windows.pet; if (ctx.alive(pw) && pw.isVisible()) pw.moveTop(); } catch (_) { /* bỏ qua */ }
  }
  function apply() {
    if (wanted()) show();
    else if (alive() && !summoned) win.hide();
  }
  function anim(op) { if (ready) send({ op }); else pending = { op }; }
  /** Thùng trồi lên trên sàn cạnh hoành độ nearX (luôn hiện thì giữ chỗ cũ). */
  function summon(nearX, nearY) {
    clearTimeout(leaveT); leaveT = null;
    if (wanted() && alive() && win.isVisible()) return;
    const wasShown = summoned && alive() && win.isVisible();
    summoned = true;
    if (!wasShown) {
      const wa = screen.getDisplayNearestPoint({ x: Math.round(nearX), y: Math.round(nearY || 0) }).workArea;
      const p = fit(nearX - W / 2, wa.y + wa.height - H);
      ensure().setBounds({ x: p.x, y: p.y, width: W, height: H });
      show();
      anim('appear');
    }
  }
  /** Lặn xuống sau delay ms (bị huỷ nếu bé lại gọi thùng). */
  function dismiss(delay) {
    if (!summoned || wanted()) { summoned = false; return; }
    clearTimeout(leaveT);
    leaveT = setTimeout(() => {
      leaveT = null;
      anim('leave');
      setTimeout(() => { if (!leaveT && summoned) { summoned = false; if (alive() && !wanted()) win.hide(); } }, 480);
    }, delay || 0);
  }
  /** Miệng thùng theo toạ độ màn hình (DIP). */
  function mouth() {
    if (!alive()) return null;
    const b = win.getBounds();
    return { x: b.x + W / 2, y: b.y + H - 4 - CAN_H + MOUTH_Y };
  }

  // ---- IPC từ renderer thùng
  const mine = e => alive() && e.sender === win.webContents;
  ipcMain.on('antics:binIgnore', (e, v) => { if (mine(e)) win.setIgnoreMouseEvents(!!v, { forward: true }); });
  let dragStart = null;
  ipcMain.on('antics:binDrag', (e, phase, dx, dy) => {
    if (!mine(e)) return;
    if (phase === 'start') { dragStart = win.getBounds(); return; }
    if (!dragStart) return;
    if (phase === 'move') {
      win.setBounds({ x: Math.round(dragStart.x + dx), y: Math.round(dragStart.y + dy), width: W, height: H });
    } else if (phase === 'end') {
      const b = win.getBounds();
      // thả ra: rơi về sàn của màn hình đang đứng
      const d = screen.getDisplayNearestPoint({ x: b.x + W / 2, y: b.y + H / 2 }).workArea;
      const p = fit(b.x, d.y + d.height - H);
      win.setBounds({ x: p.x, y: p.y, width: W, height: H });
      box.bin.x = p.x; box.bin.y = p.y; save();
      dragStart = null;
    }
  });
  ipcMain.on('antics:binClick', e => { if (mine(e) && clickCb) clickCb(); });
  ipcMain.on('antics:binMenu', e => {
    if (!mine(e)) return;
    const n = count();
    Menu.buildFromTemplate([
      { label: n ? 'Thùng rác: ' + n + ' note (giữ 30 ngày)' : 'Thùng rác trống', enabled: false },
      { label: 'Mở thùng rác / nhặt lại note…', click: () => ctx.list.open('trash') },
      { type: 'separator' },
      { label: 'Về góc trái', click: () => moveCorner('left') },
      { label: 'Về góc phải', click: () => moveCorner('right') },
      { label: 'Chỉ hiện khi bé đi dọn', type: 'checkbox', checked: !box.bin.always, click: () => { box.bin.always = !box.bin.always; save(); apply(); if (!box.bin.always) { summoned = true; dismiss(300); } } }
    ]).popup({ window: win });
  });
  function moveCorner(side) {
    if (!alive()) return;
    const b = win.getBounds(), wa = screen.getDisplayNearestPoint({ x: b.x + W / 2, y: b.y + H / 2 }).workArea;
    const x = side === 'left' ? wa.x + 18 : wa.x + wa.width - W - 18;
    const p = fit(x, wa.y + wa.height - H);
    win.setBounds({ x: p.x, y: p.y, width: W, height: H });
    box.bin.x = p.x; box.bin.y = p.y; save();
  }

  // ---- giữ vị trí khi màn hình đổi
  const revalidate = () => { if (alive()) { const p = pos(); win.setBounds({ x: p.x, y: p.y, width: W, height: H }); } };
  screen.on('display-metrics-changed', revalidate);
  screen.on('display-removed', revalidate);

  // ---- số note trong thùng
  ctx.bus.on('note:trashed', () => pushCount());
  ctx.bus.on('note:restored', () => pushCount());
  const t = setInterval(() => { if (alive() && win.isVisible()) pushCount(); }, 4000);
  if (t.unref) t.unref();
  ctx.bus.on('settings:changed', () => apply());

  return {
    apply, show, mouth, count, summon, dismiss, isOut: () => alive() && win.isVisible(),
    open: on => send({ op: 'open', on: !!on }),
    catchBall: (color, from, ms) => send({ op: 'catch', color, from, ms, count: count() }),
    landed: () => { lastCount = count(); send({ op: 'bump', happy: true }); send({ op: 'count', n: lastCount }); },
    onClick: fn => { clickCb = fn; },
    /** Note vừa vào thùng sau khi bị "tháo" (cửa sổ đã bị thu nhỏ): trả lại vị trí/kích thước gốc để khi nhặt lại vẫn đúng chỗ. */
    fixBounds(noteId, bounds) {
      try {
        const tr = ctx.store.section('trash');
        const it = tr && Array.isArray(tr.items) ? tr.items.find(x => x && x.note && x.note.id === noteId) : null;
        if (it && bounds) { it.note.bounds = Object.assign({}, bounds); save(); }
      } catch (e) { console.error('[antics] fixBounds', e && e.message); }
    }
  };
}

module.exports = { createBin };
