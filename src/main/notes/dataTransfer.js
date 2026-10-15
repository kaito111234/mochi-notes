'use strict';
// Nhập/xuất note, khôi phục từ bản sao lưu. IPC: notes2:export/exportNote/import/backups/readBackup/restore.
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain, BrowserWindow } = require('electron');
const T = require('./transferLogic.js');
const { getBox, normAlarm, normMemo } = require('../alarms/box.js');

function init(ctx) {
  const bdir = () => path.join(app.getPath('userData'), 'backups');
  const newId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const parentWin = () => (ctx.alive(ctx.windows.list) ? ctx.windows.list : undefined);
  const dlg = (fn, opts) => { const p = parentWin(); return p ? fn(p, opts) : fn(opts); };
  const readLimited = file => {
    const st = fs.statSync(file);
    if (st.size > T.MAX_FILE) throw new Error('File quá lớn (tối đa 20MB)');
    return fs.readFileSync(file, 'utf8');
  };
  let nudge = 0;

  // ---------- xuất ----------
  async function pickSave(name, ext) {
    const r = await dlg(dialog.showSaveDialog.bind(dialog), {
      title: 'Xuất note', defaultPath: name,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    });
    return r.canceled || !r.filePath ? null : r.filePath;
  }

  async function exportAll(_e, format) {
    try {
      const fmt = ['json', 'txt', 'md'].includes(format) ? format : 'json';
      const now = new Date();
      const dir = process.env.MOCHI_DEV_TRANSFER && process.env.MOCHI_DEV_DIR;
      const name = 'mochi-notes-' + T.dayStr(now) + '.' + fmt;
      const file = dir ? path.join(dir, name) : await pickSave(name, fmt);
      if (!file) return { ok: false };
      ctx.store.flushSync();
      const notes = ctx.store.data.notes;
      const out = fmt === 'json'
        ? JSON.stringify(T.buildExportJson(notes, getBox(ctx), now.getTime()), null, 2)
        : T.notesToText(notes, fmt);
      fs.writeFileSync(file, out, 'utf8');
      return { ok: true, path: file, count: notes.length };
    } catch (e) { console.error('[notes] export', e); return { ok: false, error: String(e && e.message || e) }; }
  }

  async function exportNote(_e, id, format) {
    try {
      const n = ctx.findNote(id);
      if (!n) return { ok: false };
      const fmt = format === 'md' ? 'md' : 'txt';
      const name = 'mochi-note-' + T.dayStr(new Date()) + '.' + fmt;
      const dir = process.env.MOCHI_DEV_TRANSFER && process.env.MOCHI_DEV_DIR;
      const file = dir ? path.join(dir, name) : await pickSave(name, fmt);
      if (!file) return { ok: false };
      fs.writeFileSync(file, T.noteToText(n, fmt) + '\n', 'utf8');
      return { ok: true, path: file, count: 1 };
    } catch (e) { console.error('[notes] exportNote', e); return { ok: false, error: String(e && e.message || e) }; }
  }

  // ---------- nhập ----------
  function placeNew(n) {
    let b = null;
    try { b = ctx.notes.newNoteBounds && ctx.notes.newNoteBounds(); } catch (_) { /* bỏ qua */ }
    if (b) { b = Object.assign({}, b); b.x += (nudge % 10) * 24; b.y += (nudge % 10) * 24; }
    nudge++;
    if (b && ctx.notes.fitBounds) b = ctx.notes.fitBounds(b);
    if (b) n.bounds = b; else { n.bounds.x += (nudge % 10) * 24; n.bounds.y += (nudge % 10) * 24; }
  }

  function importAlarms(parsed, idMap) {
    if (!parsed.alarms.length && !parsed.memos.length) return;
    const R = require('../../shared/recur.js');
    const L = require('../alarms/alarmLogic.js');
    const box = getBox(ctx);
    const res = T.mergeAlarmBox(box, parsed, { normAlarm, normMemo, computeNext: (a, now) => L.computeNext(a, now, R) }, Date.now(), idMap);
    if (!res.alarms.length && !res.memos.length) return;
    const snapA = JSON.parse(JSON.stringify({ alarms: box.list, missed: box.missed, settings: box.settings, sounds: box.sounds }));
    const snapM = JSON.parse(JSON.stringify({ memos: box.memos, settings: box.settings }));
    for (const w of BrowserWindow.getAllWindows()) { ctx.send(w, 'alarm:changed', snapA); ctx.send(w, 'memo:changed', snapM); }
    try { if (ctx.alarms && typeof ctx.alarms.recompute === 'function') ctx.alarms.recompute(); } catch (_) { /* bỏ qua */ }
    ctx.bus.emit('alarm:imported', { alarms: res.alarms.length, memos: res.memos.length });
  }

  async function importFiles(_e) {
    const errors = [];
    try {
      let files;
      if (process.env.MOCHI_DEV_TRANSFER && process.env.MOCHI_DEV_IMPORT) files = process.env.MOCHI_DEV_IMPORT.split(path.delimiter);
      else {
        const r = await dlg(dialog.showOpenDialog.bind(dialog), {
          title: 'Nhập note', properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Note (.json, .txt, .md)', extensions: ['json', 'txt', 'md'] }]
        });
        if (r.canceled || !r.filePaths.length) return { ok: false, count: 0, errors };
        files = r.filePaths;
      }
      const added = [];
      const pool = ctx.store.data.notes.slice();
      for (const f of files) {
        const base = path.basename(f);
        try {
          const text = readLimited(f);
          const ext = path.extname(f).toLowerCase();
          if (ext === '.json') {
            const parsed = T.parseImportJson(text);
            const m = T.mergeImported(pool, parsed.notes, newId, { now: Date.now(), pastDone: true });
            for (const x of m.added) { pool.push(x); added.push(x); }
            if (m.invalid) errors.push(base + ': bỏ qua ' + m.invalid + ' mục không hợp lệ');
            try { T.applyNoteMeta(getBox(ctx).noteMeta, parsed.noteMeta, m.idMap, m.added); } catch (e) { console.error('[notes] import noteMeta', e); }
            importAlarms(parsed, m.idMap);
          } else if (ext === '.txt' || ext === '.md') {
            const html = ext === '.md' ? T.markdownToHtml(text) : T.textToHtml(text);
            const now = Date.now();
            const n = T.sanitizeNote({ id: newId(), html, createdAt: now, updatedAt: now });
            pool.push(n); added.push(n);
          } else errors.push(base + ': định dạng không hỗ trợ');
        } catch (e) { errors.push(base + ': ' + (e && e.message || e)); }
      }
      for (const n of added) { placeNew(n); n.visible = false; }
      if (added.length === 1) added[0].visible = true;
      for (const n of added) ctx.store.data.notes.push(n);
      if (added.length) {
        ctx.store.save();
        ctx.notes.notifyList();
        for (const n of added) {
          ctx.bus.emit('note:created', { note: n });
          if (n.visible) { try { ctx.notes.openNote(n.id, { focus: true }); } catch (_) { /* bỏ qua */ } }
        }
      }
      return { ok: true, count: added.length, errors };
    } catch (e) {
      console.error('[notes] import', e);
      errors.push(String(e && e.message || e));
      return { ok: false, count: 0, errors };
    }
  }

  // ---------- sao lưu ----------
  function listBackups() {
    try {
      const dir = bdir();
      const out = [];
      for (const f of fs.readdirSync(dir)) {
        if (!T.isBackupName(f)) continue;
        try {
          const full = path.join(dir, f), st = fs.statSync(full);
          let noteCount = null;
          if (st.size <= T.MAX_FILE) {
            try { const j = JSON.parse(fs.readFileSync(full, 'utf8').replace(/^﻿/, '')); if (j && Array.isArray(j.notes)) noteCount = j.notes.length; } catch (_) { /* hỏng */ }
          }
          out.push({ file: f, day: T.backupDay(f, st.mtimeMs), size: st.size, noteCount, _t: st.mtimeMs });
        } catch (_) { /* bỏ qua */ }
      }
      out.sort((a, b) => b._t - a._t || (a.file < b.file ? 1 : -1));
      return out.map(({ _t, ...r }) => r);
    } catch (_) { return []; }
  }

  function loadBackup(file) {
    if (!T.isBackupName(file)) return null;
    const full = path.join(bdir(), file);
    if (path.dirname(full) !== bdir()) return null;
    try {
      const j = JSON.parse(readLimited(full).replace(/^﻿/, ''));
      return j && Array.isArray(j.notes) ? j.notes : null;
    } catch (_) { return null; }
  }

  function readBackup(_e, file) {
    const notes = loadBackup(file);
    if (!notes) return null;
    return { notes: T.summarizeBackup(notes, ctx.store.data.notes) };
  }

  /** Giữ 10 bản mochi-data-before-restore-*.json mới nhất (tên chứa mốc thời gian nên sắp theo tên). */
  function pruneBeforeRestore(dir) {
    try {
      const old = fs.readdirSync(dir).filter(f => /^mochi-data-before-restore-[\w-]+\.json$/.test(f)).sort().reverse().slice(10);
      for (const f of old) { try { fs.unlinkSync(path.join(dir, f)); } catch (_) { /* bỏ qua */ } }
    } catch (_) { /* bỏ qua */ }
  }

  function restore(_e, file, ids) {
    try {
      const notes = loadBackup(file);
      if (!notes) return { ok: false, restored: 0 };
      ctx.store.flushSync();
      try {
        const dir = bdir();
        fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(ctx.store.file)) fs.copyFileSync(ctx.store.file, path.join(dir, 'mochi-data-before-restore-' + T.stampStr(new Date()) + '.json'));
        pruneBeforeRestore(dir);
      } catch (e) { console.error('[notes] không chép được bản trước khi khôi phục', e); return { ok: false, restored: 0 }; }
      const plan = T.planRestore(notes, ctx.store.data.notes, Array.isArray(ids) ? ids.filter(x => typeof x === 'string') : null, Date.now());
      const now = Date.now();
      let restored = 0;
      for (const n of plan.add) {
        placeNew(n); n.visible = false; n.updatedAt = now;
        ctx.store.data.notes.push(n); restored++;
        ctx.bus.emit('note:created', { note: n });
      }
      for (const o of plan.overwrite) {
        const n = ctx.findNote(o.id);
        if (!n) continue;
        Object.assign(n, o.patch);
        n.updatedAt = now; restored++;
        const w = ctx.windows.notes.get(n.id);
        void w;   // cửa sổ note trong suốt: không đặt màu nền
        ctx.notes.noteChanged(n);
        // renderer bỏ qua note:updated khi editor đang focus -> đóng rồi mở lại cửa sổ để chắc chắn hiện bản khôi phục
        if (ctx.alive(w)) {
          try { ctx.notes.closeNoteWin(n.id); ctx.notes.openNote(n.id, { focus: false }); } catch (e) { console.error('[notes] mở lại cửa sổ note', e); }
        }
      }
      if (restored) { ctx.store.save(); ctx.notes.notifyList(); }
      return { ok: true, restored };
    } catch (e) { console.error('[notes] restore', e); return { ok: false, restored: 0 }; }
  }

  ipcMain.handle('notes2:export', exportAll);
  ipcMain.handle('notes2:exportNote', exportNote);
  ipcMain.handle('notes2:import', importFiles);
  ipcMain.handle('notes2:backups', () => listBackups());
  ipcMain.handle('notes2:readBackup', readBackup);
  ipcMain.handle('notes2:restore', restore);

  // Thử không hộp thoại: MOCHI_DEV_TRANSFER=1 MOCHI_DEV_DIR=<thư mục> [MOCHI_DEV_IMPORT=file1:file2]
  if (process.env.MOCHI_DEV_TRANSFER && process.env.MOCHI_DEV_DIR) {
    setTimeout(async () => {
      for (const f of ['json', 'md', 'txt']) console.log('[notes] dev export', f, JSON.stringify(await exportAll(null, f)));
      console.log('[notes] dev backups', JSON.stringify(listBackups()));
      if (process.env.MOCHI_DEV_IMPORT) console.log('[notes] dev import', JSON.stringify(await importFiles(null)));
    }, 4000);
  }

  Object.assign(ctx.notes, { transfer: { listBackups } });
}

module.exports = { init };
