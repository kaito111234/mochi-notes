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
      alwaysOnTop: !!note.alwaysOnTop, title: 'Mochi Notes',
      webPreferences: ctx.webPrefs()
    };
    if (ctx.useGlass()) { o.backgroundMaterial = 'acrylic'; o.backgroundColor = '#00000000'; }
    else o.backgroundColor = ctx.COLOR_BG[note.color] || ctx.COLOR_BG.yellow;
    // Cửa sổ trong suốt (tuỳ chọn, mặc định tắt): chỉ áp dụng cho cửa sổ mở sau khi bật; renderer đọc ?transparent=1.
    const transparent = ctx.settings().noteTransparent === true;
    if (transparent) { o.transparent = true; o.backgroundColor = '#00000000'; o.hasShadow = false; delete o.backgroundMaterial; }
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
    win.loadFile(ctx.paths.noteHtml, { query: transparent ? { id, transparent: '1' } : { id } });
    return win;
  }

  function closeNoteWin(id) {
    const w = noteWins.get(id);
    noteWins.delete(id);
    if (alive(w)) { w.__silent = true; w.close(); }
  }

  // BUG-020: tạo cửa sổ dần (lô nhỏ, nghỉ giữa các lô) để main không bị chặn; mỗi cửa sổ tự hiện khi ready-to-show.
  const OPEN_BATCH = 2;
  const OPEN_GAP = 40;
  let openGen = 0;
  function openAllVisible(inactive) {
    const gen = ++openGen;   // lệnh mới huỷ hàng đợi cũ
    const ids = ctx.store.data.notes.filter(n => n.visible).map(n => n.id);
    let i = 0;
    const step = () => {
      if (gen !== openGen || ctx.quitting) return;
      let made = 0;
      while (i < ids.length && made < OPEN_BATCH) {
        const id = ids[i++];
        const n = ctx.findNote(id);
        if (!n || !n.visible || ctx.settings().allHidden) continue;   // ẩn tất cả/xoá giữa chừng
        const had = alive(noteWins.get(id));
        openNote(id, { focus: !inactive });
        if (!had) made++;
      }
      if (i < ids.length) { const t = setTimeout(step, OPEN_GAP); if (t && t.unref) t.unref(); }
    };
    step();
  }
  ctx.notes.cancelOpenAll = () => { openGen++; };

  Object.assign(ctx.notes, { fitBounds, newNoteBounds, openNote, closeNoteWin, openAllVisible });
}

module.exports = { init };
