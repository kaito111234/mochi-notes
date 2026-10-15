'use strict';
// Thanh công cụ ngang kiểu game hiện khi chuột phải lên bé Mochi (thay menu native).
// Nhận `tpl` (mảng MenuItem như Menu.buildFromTemplate) -> dữ liệu thuần + bản đồ id -> click handler ở main.
// Lỗi bất kỳ -> open() trả false để nơi gọi rơi về menu native cũ.
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const W = 920, H = 370, IDLE_MS = 30000;

function create(ctx, deps) {
  let win = null, entries = new Map(), pollT = null, idleT = null, openAt = 0, anchor = null;

  function ser(list, pre, group) {
    const out = [];
    (list || []).forEach((it, i) => {
      if (!it || it.type === 'separator') return;
      const id = pre + i;
      const o = { id, key: it.key || '', label: String(it.label || ''), type: it.type || 'normal', enabled: it.enabled !== false };
      if (o.type === 'checkbox' || o.type === 'radio') o.checked = !!it.checked;
      out.push(o);
      entries.set(id, { it, o, siblings: out });
      if (Array.isArray(it.submenu)) o.submenu = ser(it.submenu, id + '.');
    });
    return out;
  }

  function stop() {
    if (pollT) { clearInterval(pollT); pollT = null; }
    if (idleT) { clearTimeout(idleT); idleT = null; }
  }
  function close() {
    stop();
    const w = win; win = null;
    if (w && ctx.alive(w)) { try { w.destroy(); } catch (_) { /* bỏ qua */ } }
  }

  function place() {
    const body = deps.body();
    const p = body.pos(), sz = body.size();
    const cx = p.x, top = p.y - sz.h, feet = p.y;
    const wa = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(p.y - sz.h / 2) }).workArea;
    const width = Math.min(W, wa.width - 8), height = Math.min(H, wa.height - 8);
    let x = Math.round(cx - width / 2);
    x = Math.max(wa.x + 4, Math.min(wa.x + wa.width - width - 4, x));
    let dir = 'up', y = Math.round(top - height - 4);
    if (y < wa.y + 2) {
      dir = 'down'; y = Math.round(feet + 4);
      if (y + height > wa.y + wa.height - 2) y = Math.max(wa.y + 2, wa.y + wa.height - height - 2);
    }
    return { x, y, width, height, dir, ox: Math.round(cx - x), p };
  }

  function open(tpl, head) {
    try {
      close();
      entries = new Map();
      const items = ser(tpl, 't');
      const pos = place();
      anchor = pos.p;
      win = new BrowserWindow({
        x: pos.x, y: pos.y, width: pos.width, height: pos.height, show: false, frame: false, transparent: true,
        resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
        skipTaskbar: true, alwaysOnTop: true, hasShadow: false, focusable: true, backgroundColor: '#00000000',
        title: 'Thanh công cụ bé Mochi', webPreferences: ctx.webPrefs()
      });
      const w = win;
      ctx.hardenWebContents(w);
      w.setAlwaysOnTop(true, 'screen-saver');
      openAt = Date.now();
      w.on('blur', () => { if (win === w && Date.now() - openAt > 250) close(); });
      w.on('closed', () => { if (win === w) { win = null; stop(); } });
      w.webContents.on('did-fail-load', () => { if (win === w) { close(); try { deps.fallback(); } catch (_) { /* bỏ qua */ } } });
      w.webContents.once('did-finish-load', () => {
        if (win !== w || !ctx.alive(w)) return;
        w.webContents.send('toolbar:init', { head: String(head || ''), items, dir: pos.dir, ox: pos.ox, w: pos.width, h: pos.height });
        w.show(); w.focus();
      });
      w.loadFile(path.join(ctx.paths.src, 'toolbar/toolbar.html')).catch(e => { console.error('[toolbar]', e && e.message); if (win === w) { close(); try { deps.fallback(); } catch (_) { /* bỏ qua */ } } });
      // bé bị kéo đi / bị ẩn -> đóng; để lâu không dùng -> huỷ cửa sổ
      pollT = setInterval(() => {
        try {
          const b = deps.body();
          const q = b.pos();
          if (Math.abs(q.x - anchor.x) > 14 || Math.abs(q.y - anchor.y) > 14) close();
        } catch (_) { close(); }
      }, 120);
      idleT = setTimeout(close, IDLE_MS);
      return true;
    } catch (e) {
      console.error('[toolbar] lỗi mở thanh, dùng menu native', e && e.message);
      close();
      return false;
    }
  }

  const mine = e => ctx.alive(win) && e.sender === win.webContents;
  ipcMain.handle('toolbar:click', (e, id) => {
    if (!mine(e)) return { ok: false };
    if (idleT) { clearTimeout(idleT); idleT = setTimeout(close, IDLE_MS); }
    const en = entries.get(String(id));
    if (!en || !en.o.enabled || typeof en.it.click !== 'function') return { ok: false };
    const { it, o } = en;
    const run = arg => { try { it.click(arg, ctx.windows.pet, {}); } catch (err) { console.error('[toolbar] click', err); } };
    if (o.type === 'checkbox') {
      o.checked = !o.checked;
      run({ checked: o.checked, label: o.label, type: 'checkbox' });
      return { ok: true, close: false, states: { [o.id]: o.checked } };
    }
    if (o.type === 'radio') {
      const states = {};
      for (const s of en.siblings) if (s.type === 'radio') { s.checked = s === o; states[s.id] = s.checked; }
      run({ checked: true, label: o.label, type: 'radio' });
      return { ok: true, close: false, states };
    }
    setTimeout(close, 150);
    setTimeout(() => run({ label: o.label, type: 'normal' }), 190);
    return { ok: true, close: true };
  });
  ipcMain.on('toolbar:close', e => { if (mine(e)) close(); });

  return { open, close, isOpen: () => ctx.alive(win) };
}

module.exports = { create };
