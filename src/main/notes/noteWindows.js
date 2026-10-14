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
      frame: false, show: false, skipTaskbar: true, resizable: true,
      alwaysOnTop: !!note.alwaysOnTop, title: 'Mochi Note',
      webPreferences: ctx.webPrefs()
    };
    if (ctx.useGlass()) { o.backgroundMaterial = 'acrylic'; o.backgroundColor = '#00000000'; }
    else o.backgroundColor = ctx.COLOR_BG[note.color] || ctx.COLOR_BG.yellow;
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
    win.on('move', later);
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

  Object.assign(ctx.notes, { fitBounds, newNoteBounds, openNote, closeNoteWin, openAllVisible });
}

module.exports = { init };
