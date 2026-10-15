'use strict';
// Sao lưu ra ngoài máy (thư mục đồng bộ đám mây): <thư mục>\MochiNotes-backup\mochi-YYYY-MM-DD.json.
// Cấu hình: settings.cloudBackup = { on, dir, last }. API: ctx.backup. Lỗi chỉ ghi log + cảnh báo nhẹ một lần.
const fs = require('fs');
const path = require('path');
const os = require('os');
const electron = require('electron');

const SUB = 'MochiNotes-backup';
const NAME_RE = /^mochi-\d{4}-\d{2}-\d{2}\.json$/;
const KEEP = 30;
const MIN_GAP = 10 * 60 * 1000;   // tối đa 1 lần / 10 phút
const SETTLE = 3000;              // chờ store ghi xong file chính
const POLL = 5 * 60 * 1000;
const MAX_SIZE = 50 * 1024 * 1024;

const pad = n => String(n).padStart(2, '0');
const dayStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const stampStr = d => dayStr(d).replace(/-/g, '') + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());

/** Phát hiện thư mục đồng bộ đám mây. env/exists/readFile có thể giả khi test. Trả [{ name, dir }]. */
function detectProviders(env, exists, readFile) {
  env = env || process.env;
  exists = exists || (p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  readFile = readFile || (p => fs.readFileSync(p, 'utf8'));
  const out = [], seen = new Set();
  const add = (name, dir) => {
    if (!dir || typeof dir !== 'string') return;
    const key = path.resolve(dir).toLowerCase();
    if (seen.has(key) || !exists(dir)) return;
    seen.add(key); out.push({ name, dir });
  };
  const home = env.USERPROFILE || env.HOME || os.homedir();
  add('OneDrive', env.OneDriveConsumer);
  add('OneDrive (công ty)', env.OneDriveCommercial);
  add('OneDrive', env.OneDrive);
  if (home) add('OneDrive', path.join(home, 'OneDrive'));
  if (home) { add('Google Drive', path.join(home, 'Google Drive')); add('Google Drive', path.join(home, 'My Drive')); }
  for (let c = 67; c <= 90; c++) {   // C..Z
    const L = String.fromCharCode(c) + ':\\';
    add('Google Drive', L + 'My Drive');
    add('Google Drive', L + 'Google Drive');
  }
  if (home) add('Dropbox', path.join(home, 'Dropbox'));
  for (const base of [env.APPDATA, env.LOCALAPPDATA]) {
    if (!base) continue;
    try {
      const j = JSON.parse(readFile(path.join(base, 'Dropbox', 'info.json')));
      for (const k of Object.keys(j || {})) if (j[k] && typeof j[k].path === 'string') add('Dropbox', j[k].path);
    } catch (_) { /* không có Dropbox */ }
  }
  return out;
}

const backupDirOf = dir => path.join(dir, SUB);

function writeAtomic(target, text) {
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  try { fs.renameSync(tmp, target); } catch (_) {
    fs.writeFileSync(target, text, 'utf8');
    try { fs.unlinkSync(tmp); } catch (_e) { /* bỏ qua */ }
  }
}

/** Xoá bản cũ vượt keep, chỉ trong thư mục sao lưu và chỉ file khớp mẫu tên. */
function rotate(bdir, keep) {
  const names = fs.readdirSync(bdir).filter(f => NAME_RE.test(f)).sort();
  let n = 0;
  while (names.length > keep) { try { fs.unlinkSync(path.join(bdir, names.shift())); n++; } catch (_) { break; } }
  return n;
}

/** Kiểm file JSON dữ liệu bằng chính createStore (dùng lại validate của store). Ném lỗi nếu hỏng. */
function validateText(text) {
  const j = JSON.parse(String(text).replace(/^﻿/, ''));
  if (!j || typeof j !== 'object' || Array.isArray(j) || !Array.isArray(j.notes)) throw new Error('Không phải dữ liệu Mochi Notes');
  const { createStore } = require('../store.js');
  const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-verify-'));
  try {
    fs.writeFileSync(path.join(tdir, 'mochi-data.json'), text, 'utf8');
    const st = createStore(tdir);
    if (st.corruptCopy || st.recoveredFrom) throw new Error('File hỏng');
    return { notes: st.notes.length };
  } finally {
    try { fs.rmSync(tdir, { recursive: true, force: true }); } catch (_) { /* bỏ qua */ }
  }
}

function create(ctx, opt) {
  opt = opt || {};
  const E = opt.electron || electron;
  const env = opt.env || process.env;
  const now = opt.now || (() => Date.now());
  const gap = opt.minGapMs != null ? opt.minGapMs : MIN_GAP;
  const settle = opt.settleMs != null ? opt.settleMs : SETTLE;
  const store = () => ctx.store;
  let timer = null, dirty = false, lastRun = 0, warned = false, restoring = false, lastMtime = 0, poller = null;

  const cfg = () => {
    const s = ctx.settings();
    if (!s.cloudBackup || typeof s.cloudBackup !== 'object' || Array.isArray(s.cloudBackup)) s.cloudBackup = { on: false, dir: '', last: 0 };
    return s.cloudBackup;
  };
  const rebuild = () => { try { if (ctx.tray && typeof ctx.tray.rebuild === 'function') ctx.tray.rebuild(); } catch (_) { /* bỏ qua */ } };
  const parent = () => (ctx.windows && ctx.alive && ctx.alive(ctx.windows.list) ? ctx.windows.list : undefined);
  const dlg = (fn, o) => { const p = parent(); return p ? fn(p, o) : fn(o); };

  function warnOnce(msg) {
    console.warn('[backup] ' + msg);
    if (warned) return;
    warned = true;
    try { if (E.Notification && E.Notification.isSupported()) new E.Notification({ title: 'Mochi Notes', body: 'Sao lưu đám mây chưa chạy được: ' + msg }).show(); } catch (_) { /* bỏ qua */ }
  }

  /** Ghi một bản sao lưu ngay. Trả { ok, file?, error? }. Không ném lỗi. */
  function backupNow() {
    const c = cfg();
    if (!c.dir) return { ok: false, error: 'Chưa chọn thư mục' };
    try {
      const st = store();
      if (st && typeof st.flushSync === 'function') st.flushSync();
      const text = fs.readFileSync(st.file, 'utf8');
      validateText(text);   // không sao lưu file hỏng
      const bdir = backupDirOf(c.dir);
      if (!fs.existsSync(c.dir)) throw new Error('Thư mục không còn: ' + c.dir);
      fs.mkdirSync(bdir, { recursive: true });
      const file = path.join(bdir, 'mochi-' + dayStr(new Date(now())) + '.json');
      writeAtomic(file, text);
      rotate(bdir, KEEP);
      lastRun = now(); dirty = false; warned = false;
      c.last = lastRun;   // chỉ đặt trong bộ nhớ (không gọi save() để khỏi tự kích hoạt vòng sao lưu); lần lưu sau sẽ ghi xuống
      try { lastMtime = fs.statSync(st.file).mtimeMs; } catch (_) { /* bỏ qua */ }
      return { ok: true, file };
    } catch (e) {
      console.error('[backup] lỗi sao lưu', e);
      warnOnce(String(e && e.message || e));
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  function schedule() {
    if (restoring) return;
    const c = cfg();
    if (!c.on || !c.dir) return;
    dirty = true;
    if (timer) return;
    const wait = Math.max(settle, lastRun + gap - now());
    timer = setTimeout(() => {
      timer = null;
      const c2 = cfg();
      if (dirty && !restoring && c2.on && c2.dir) backupNow();
    }, wait);
    if (timer.unref) timer.unref();
  }

  function setDir(dir) {
    const c = cfg();
    c.dir = dir; c.on = true;
    try { store().save(); } catch (_) { /* bỏ qua */ }
    rebuild();
    return backupNow();
  }
  function setOn(on) {
    const c = cfg();
    c.on = !!on;
    try { store().save(); } catch (_) { /* bỏ qua */ }
    if (c.on && c.dir) schedule();
    rebuild();
  }

  async function chooseDir() {
    try {
      const found = detectProviders(env);
      let start;
      if (found.length) {
        const buttons = found.map(f => f.name + ' — ' + f.dir).concat(['Chọn thư mục khác…', 'Hủy']);
        const r = await dlg(E.dialog.showMessageBox.bind(E.dialog), {
          type: 'question', title: 'Sao lưu Mochi Notes', message: 'Chọn nơi sao lưu',
          detail: 'Đã thấy thư mục đồng bộ đám mây trên máy. Bản sao lưu nằm trong thư mục con "' + SUB + '".',
          buttons, defaultId: 0, cancelId: buttons.length - 1, noLink: true
        });
        if (r.response >= found.length + 1) return { ok: false, canceled: true };
        if (r.response < found.length) return setDir(found[r.response].dir);
        start = found[0].dir;
      }
      const r2 = await dlg(E.dialog.showOpenDialog.bind(E.dialog), {
        title: 'Chọn thư mục sao lưu', defaultPath: start || cfg().dir || undefined, properties: ['openDirectory', 'createDirectory']
      });
      if (r2.canceled || !r2.filePaths || !r2.filePaths[0]) return { ok: false, canceled: true };
      return setDir(r2.filePaths[0]);
    } catch (e) { console.error('[backup] chọn thư mục', e); return { ok: false, error: String(e && e.message || e) }; }
  }

  function openDir() {
    const c = cfg();
    if (!c.dir) return false;
    const b = backupDirOf(c.dir);
    try { E.shell.openPath(fs.existsSync(b) ? b : c.dir); return true; } catch (e) { console.error('[backup] mở thư mục', e); return false; }
  }

  /** Ghi đè dữ liệu bằng file đã kiểm, sao lưu bản hiện tại trước. Không xác nhận/relaunch (để test). */
  function applyRestore(srcFile, userDataDir) {
    const st = store();
    const stat = fs.statSync(srcFile);
    if (stat.size > MAX_SIZE) throw new Error('File quá lớn');
    const text = fs.readFileSync(srcFile, 'utf8');
    validateText(text);
    try { if (st.flushSync) st.flushSync(); } catch (_) { /* bỏ qua */ }
    const bdir = path.join(userDataDir, 'backups');
    fs.mkdirSync(bdir, { recursive: true });
    if (fs.existsSync(st.file)) fs.copyFileSync(st.file, path.join(bdir, 'mochi-data-before-cloud-restore-' + stampStr(new Date(now())) + '.json'));
    try {
      const old = fs.readdirSync(bdir).filter(f => /^mochi-data-before-cloud-restore-\d{8}-\d{6}\.json$/.test(f)).sort();
      while (old.length > 5) fs.unlinkSync(path.join(bdir, old.shift()));
    } catch (_) { /* bỏ qua */ }
    writeAtomic(st.file, text);
  }

  async function restore() {
    const box = o => dlg(E.dialog.showMessageBox.bind(E.dialog), o);
    try {
      const c = cfg();
      const bdir = c.dir ? backupDirOf(c.dir) : '';
      if (!bdir || !fs.existsSync(bdir)) {
        await box({ type: 'info', title: 'Mochi Notes', message: 'Chưa có bản sao lưu đám mây để khôi phục.', buttons: ['Đóng'] });
        return { ok: false };
      }
      const r = await dlg(E.dialog.showOpenDialog.bind(E.dialog), {
        title: 'Khôi phục từ bản sao lưu', defaultPath: bdir, properties: ['openFile'], filters: [{ name: 'Mochi backup', extensions: ['json'] }]
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, canceled: true };
      const file = r.filePaths[0];
      if (path.resolve(path.dirname(file)).toLowerCase() !== path.resolve(bdir).toLowerCase()) {
        await box({ type: 'warning', title: 'Mochi Notes', message: 'Hãy chọn file nằm trong thư mục ' + SUB + '.', buttons: ['Đóng'] });
        return { ok: false };
      }
      let info;
      try { info = validateText(fs.readFileSync(file, 'utf8')); } catch (e) {
        console.warn('[backup] file khôi phục bị từ chối', file, e && e.message);
        await box({ type: 'warning', title: 'Mochi Notes', message: 'File này hỏng hoặc không phải bản sao lưu Mochi Notes, đã từ chối.', buttons: ['Đóng'] });
        return { ok: false, rejected: true };
      }
      const q = await box({
        type: 'warning', title: 'Khôi phục', message: 'Khôi phục ' + info.notes + ' note từ "' + path.basename(file) + '"?',
        detail: 'Dữ liệu hiện tại sẽ được sao lưu lại trước khi bị thay thế. Mochi Notes sẽ khởi động lại.',
        buttons: ['Khôi phục', 'Hủy'], defaultId: 1, cancelId: 1, noLink: true
      });
      if (q.response !== 0) return { ok: false, canceled: true };
      restoring = true;
      if (timer) { clearTimeout(timer); timer = null; }
      try { applyRestore(file, E.app.getPath('userData')); } catch (e) { restoring = false; throw e; }
      try { E.app.relaunch(); } catch (e) { console.error('[backup] relaunch', e); }
      E.app.exit(0);   // exit không chạy before-quit nên không ghi đè dữ liệu vừa khôi phục
      return { ok: true };
    } catch (e) {
      console.error('[backup] khôi phục', e);
      try { await box({ type: 'warning', title: 'Mochi Notes', message: 'Không khôi phục được: ' + String(e && e.message || e), buttons: ['Đóng'] }); } catch (_) { /* bỏ qua */ }
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  function state() {
    const c = cfg();
    return { on: !!c.on, dir: c.dir || '', last: c.last || 0, name: c.dir ? (path.basename(c.dir) || c.dir) : '' };
  }

  function start() {
    const st = store();
    if (st && !st.__cloudWrapped) {
      const orig = st.save;
      st.save = function () { const r = orig.apply(this, arguments); schedule(); return r; };
      st.__cloudWrapped = true;
    }
    for (const ev of ['note:created', 'note:updated', 'note:deleted', 'settings:changed']) {
      try { ctx.bus.on(ev, () => schedule()); } catch (_) { /* bỏ qua */ }
    }
    try {   // lưới an toàn: module giữ sẵn tham chiếu save() cũ
      lastMtime = fs.statSync(st.file).mtimeMs;
      poller = setInterval(() => {
        try { const m = fs.statSync(st.file).mtimeMs; if (m !== lastMtime) { lastMtime = m; schedule(); } } catch (_) { /* bỏ qua */ }
      }, opt.pollMs || POLL);
      if (poller.unref) poller.unref();
    } catch (_) { /* chưa có file */ }
    try {
      E.app.on('before-quit', () => {
        if (restoring) return;
        const c = cfg();
        if (c.on && c.dir && dirty) backupNow();
      });
    } catch (_) { /* bỏ qua */ }
    schedule();   // lần chạy đầu: có bản trong ngày
  }

  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (poller) { clearInterval(poller); poller = null; }
  }

  return { backupNow, schedule, chooseDir, setOn, restore, openDir, state, start, stop, applyRestore, isDirty: () => dirty };
}

function init(ctx) {
  if (ctx.backup) return;   // tray.js và main.js đều có thể gọi init: chỉ chạy một lần
  const b = create(ctx);
  ctx.backup = b;
  b.start();
}

module.exports = { init, create, detectProviders, rotate, validateText, backupDirOf, SUB, NAME_RE, KEEP };
