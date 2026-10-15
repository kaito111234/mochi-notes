'use strict';
// Tạo/mở/đóng cửa sổ note, bounds, nền kính.
const path = require('path');
const { BrowserWindow, screen } = require('electron');

function init(ctx) {
  const noteWins = ctx.windows.notes;
  const { alive } = ctx;

  function fitBounds(b) {
    let { x, y, width, height } = Object.assign({ width: 300, height: 320 }, b || {});
    width = Math.max(220, Math.round(Number(width) || 300));
    height = Math.max(160, Math.round(Number(height) || 320));
    x = Math.round(Number(x)); y = Math.round(Number(y));
    const ok = Number.isFinite(x) && Number.isFinite(y) && screen.getAllDisplays().some(d => {
      const a = d.workArea;
      const ox = Math.min(x + width, a.x + a.width) - Math.max(x, a.x);
      const oy = Math.min(y + height, a.y + a.height) - Math.max(y, a.y);
      return ox >= 80 && oy >= 40;
    });
    if (!ok) {
      const a = screen.getPrimaryDisplay().workArea;
      width = Math.min(width, a.width); height = Math.min(height, a.height);
      x = Math.round(a.x + (a.width - width) / 2);
      y = Math.round(a.y + (a.height - height) / 2);
    }
    return { x, y, width, height };
  }

  function newNoteBounds(nearId) {
    const nw = nearId && noteWins.get(nearId);
    const near = nw && alive(nw) ? nw.getBounds() : (nearId && ctx.findNote(nearId) ? ctx.findNote(nearId).bounds : null);
    if (near) return fitBounds({ x: near.x + 32, y: near.y + 32, width: near.width, height: near.height });
    const a = screen.getPrimaryDisplay().workArea;
    const k = noteWins.size % 8;
    return fitBounds({ x: a.x + Math.round((a.width - 300) / 2) + k * 32, y: a.y + Math.round((a.height - 320) / 2) + k * 32, width: 300, height: 320 });
  }

  function openNote(id, opts = {}) {
    const note = ctx.findNote(id);
    if (!note) return null;
    const old = noteWins.get(id);
    if (alive(old)) {
      if (old.isMinimized()) old.restore();
      if (opts.focus !== false) { old.show(); old.focus(); } else old.showInactive();
      return old;
    }
    const b = fitBounds(note.bounds);
    note.bounds = b;
    const o = {
      x: b.x, y: b.y, width: b.width, height: b.height,
      minWidth: 220, minHeight: 160,
      frame: false, show: false, skipTaskbar: true, resizable: false, maximizable: false, fullscreenable: false,
      transparent: true, hasShadow: false, backgroundColor: '#00000000',   // tờ giấy tự vẽ bóng + ghim lòi ra ngoài mép
      alwaysOnTop: !!note.alwaysOnTop, title: 'Mochi Note',
      webPreferences: ctx.webPrefs()
    };
    const win = new BrowserWindow(o);
    noteWins.set(id, win);
    ctx.hardenWebContents(win);
    let bt = null;
    const saveBounds = () => {
      if (win.isDestroyed() || win.isMinimized()) return;
      const n = ctx.findNote(id);
      if (n) { n.bounds = win.getBounds(); ctx.store.save(); }
    };
    const later = () => { clearTimeout(bt); bt = setTimeout(saveBounds, 400); };
    // báo cho note biết đang bị kéo để tờ giấy đung đưa quanh cây ghim
    let last = null;
    win.on('move', () => {
      later();
      if (win.isDestroyed()) return;
      const p = win.getBounds();
      if (last) win.webContents.send('note:moved', { dx: p.x - last.x, dy: p.y - last.y });
      last = p;
    });
    win.on('moved', () => { last = null; });
    win.on('resize', later);
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      if (opts.focus === false) win.showInactive(); else win.show();
    });
    win.on('close', () => {
      clearTimeout(bt);
      if (!win.__silent && !ctx.quitting) {
        const n = ctx.findNote(id);
        if (n) { saveBounds(); n.visible = false; ctx.store.save(); ctx.notes.notifyList(); }
      } else if (!win.__silent) saveBounds();
    });
    win.on('closed', () => { if (noteWins.get(id) === win) noteWins.delete(id); });
    win.loadFile(ctx.paths.noteHtml, { query: { id } });
    return win;
  }

  function closeNoteWin(id) {
    const w = noteWins.get(id);
    noteWins.delete(id);
    if (alive(w)) { w.__silent = true; w.close(); }
  }

  function openAllVisible(inactive) {
    for (const n of ctx.store.data.notes) if (n.visible) openNote(n.id, { focus: !inactive });
  }

  // tờ giấy nằm lùi trong cửa sổ trong suốt (chừa chỗ cho ghim + bóng) — xem src/note/sheet.css
  function paperBounds(w) {
    const b = w.getBounds();
    return { x: b.x + 12, y: b.y + 24, width: Math.max(1, b.width - 26), height: Math.max(1, b.height - 44) };
  }

  Object.assign(ctx.notes, { paperBounds, fitBounds, newNoteBounds, openNote, closeNoteWin, openAllVisible });
}

module.exports = { init };
