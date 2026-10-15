'use strict';
// Phòng paper: mẫu giấy / phông / hình dạng của từng note. Ngăn dữ liệu 'paper' (docs/rooms/paper/DESIGN.md mục 1).
const L = require('./paperLogic.js');

function init(ctx) {
  let ipcMain = null, screen = null;
  try { ({ ipcMain, screen } = require('electron')); } catch (_) { return; }
  if (!ipcMain || !ctx || !ctx.store || typeof ctx.store.section !== 'function') return;

  let box;
  try { box = ctx.store.section('paper', L.defaults, L.normalize); } catch (_) { return; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const save = () => { try { ctx.store.save(); } catch (_) { /* bỏ qua */ } };
  const hasNote = id => L.okNoteId(id) && !!(ctx.findNote && ctx.findNote(id));
  const metaOf = id => (L.okNoteId(id) && own(box.noteMeta, id) ? box.noteMeta[id] : {});
  const clone = o => JSON.parse(JSON.stringify(o));

  function sendNote(id, ch, data) {
    try {
      const w = ctx.windows && ctx.windows.notes && ctx.windows.notes.get(id);
      if (w && ctx.alive(w)) w.webContents.send(ch, data);
    } catch (_) { /* bỏ qua */ }
  }
  function sendAll(ch, data) {
    try {
      if (!ctx.windows || !ctx.windows.notes) return;
      for (const w of ctx.windows.notes.values()) if (ctx.alive(w)) w.webContents.send(ch, data);
    } catch (_) { /* bỏ qua */ }
  }
  function storeMeta(id, m) {
    if (Object.keys(m).length) box.noteMeta[id] = m; else delete box.noteMeta[id];
  }

  // dọn meta mồ côi (note đã bị xoá khi app tắt)
  try {
    let dirty = false;
    for (const id of Object.keys(box.noteMeta)) if (!hasNote(id)) { delete box.noteMeta[id]; dirty = true; }
    if (dirty) save();
  } catch (_) { /* bỏ qua */ }

  ipcMain.handle('paper:get', (_e, id) => {
    try { return { meta: clone(metaOf(id)), settings: clone(box.settings) }; }
    catch (_) { return { meta: {}, settings: L.defaultSettings() }; }
  });

  ipcMain.handle('paper:set', (_e, id, patch) => {
    try {
      if (!hasNote(id)) return {};
      const m = L.applyPatch(metaOf(id), patch);
      storeMeta(id, m);
      save();
      const out = clone(m);
      sendNote(id, 'paper:meta', { id, meta: out });
      return out;
    } catch (_) { return {}; }
  });

  ipcMain.handle('paper:settings', (_e, patch) => {
    try {
      box.settings = L.applySettings(box.settings, patch);
      save();
      const out = clone(box.settings);
      sendAll('paper:settings', out);
      return out;
    } catch (_) { return L.defaultSettings(); }
  });

  ipcMain.handle('paper:resize', (_e, id, size) => {
    try {
      if (!hasNote(id)) return false;
      const win = ctx.windows.notes.get(id);
      if (!win || !ctx.alive(win)) return false;
      const cur = win.getBounds();
      let wa = null;
      try { wa = screen.getDisplayMatching(cur).workArea; } catch (_) { /* không có màn hình */ }
      const b = L.clampBounds(size, cur, wa);
      if (!b) return false;
      win.setBounds(b);
      const n = ctx.findNote(id);
      if (n) { n.bounds = win.getBounds(); save(); }
      return true;
    } catch (_) { return false; }
  });

  ipcMain.handle('paper:checkItem', (_e, id, index, done) => {
    try {
      const i = L.cleanIndex(index);
      if (!hasNote(id) || i === null) return false;
      if (ctx.bus && typeof ctx.bus.emit === 'function') ctx.bus.emit('note:checkItem', { noteId: id, index: i, done: !!done });
      return true;
    } catch (_) { return false; }
  });

  if (ctx.bus && typeof ctx.bus.on === 'function') {
    ctx.bus.on('note:created', p => {
      try {
        const id = p && p.note && p.note.id;
        if (!L.okNoteId(id) || own(box.noteMeta, id)) return;
        const m = L.defaultFor(box.settings);
        if (!m) return;
        box.noteMeta[id] = m;
        save();
        sendNote(id, 'paper:meta', { id, meta: clone(m) });
      } catch (_) { /* bỏ qua */ }
    });
    ctx.bus.on('note:deleted', p => {
      try {
        const id = p && p.id;
        if (!L.okNoteId(id) || !own(box.noteMeta, id)) return;
        delete box.noteMeta[id];
        save();
      } catch (_) { /* bỏ qua */ }
    });
  }
}

module.exports = { init };
