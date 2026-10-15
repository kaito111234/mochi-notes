'use strict';
// Cỡ chữ và khoá chỉ đọc của từng note. Dữ liệu nằm ở box.noteMeta[noteId] (chung với noteRepeat.js,
// nên chỉ sửa khoá zoom/locked, không bao giờ ghi đè cả object).
const { ipcMain } = require('electron');
const { getBox } = require('../alarms/box.js');

const ZMIN = 0.5, ZMAX = 3;

function init(ctx) {
  const box = () => getBox(ctx);

  const BAD = new Set(['__proto__', 'constructor', 'prototype']);
  const okId = id => typeof id === 'string' && !!id && !BAD.has(id) && !!(ctx.findNote && ctx.findNote(id));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function metaOf(id) {
    const nm = box().noteMeta;
    const m = (nm && typeof nm === 'object' && own(nm, id) && nm[id]) || {};
    const n = ctx.findNote && ctx.findNote(id);
    const repeat = (n && n.reminder && n.reminder.repeat) || m.repeat || null;
    return { repeat, zoom: typeof m.zoom === 'number' ? m.zoom : 1, locked: !!m.locked };
  }

  function push(id) {
    const payload = Object.assign({ id }, metaOf(id));
    const win = ctx.windows.notes.get(id);
    if (win && ctx.alive(win)) win.webContents.send('notes2:meta', payload);
    return payload;
  }

  ipcMain.handle('notes2:getMeta', (_e, id) => (okId(id) ? metaOf(id) : { repeat: null, zoom: 1, locked: false }));

  ipcMain.handle('notes2:setView', (_e, id, patch) => {
    if (!okId(id) || !patch || typeof patch !== 'object') return null;
    const b = box();
    if (!b.noteMeta || typeof b.noteMeta !== 'object') b.noteMeta = {};
    const m = own(b.noteMeta, id) && b.noteMeta[id] ? b.noteMeta[id] : (b.noteMeta[id] = {});
    if (patch.zoom !== undefined) {
      const z = Number(patch.zoom);
      if (Number.isFinite(z)) {
        const c = Math.round(Math.min(ZMAX, Math.max(ZMIN, z)) * 10) / 10;
        if (c === 1) delete m.zoom; else m.zoom = c;
      }
    }
    if (patch.locked !== undefined) { if (patch.locked) m.locked = true; else delete m.locked; }
    if (!Object.keys(m).length) delete b.noteMeta[id];
    ctx.store.save();
    return push(id);
  });

  ctx.bus.on('note:deleted', p => {
    const id = p && p.id;
    if (ctx.notes.isTrashed && ctx.notes.isTrashed(id)) return;   // vào thùng rác: giữ meta tới khi xoá hẳn
    const b = box();
    const m = typeof id === 'string' && !BAD.has(id) && b.noteMeta && own(b.noteMeta, id) && b.noteMeta[id];
    if (!m) return;
    delete m.zoom; delete m.locked;
    if (!Object.keys(m).length) delete b.noteMeta[id];
    ctx.store.save();
  });
}

module.exports = { init };
