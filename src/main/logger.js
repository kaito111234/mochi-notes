'use strict';
// Nhật ký lỗi: %APPDATA%\Mochi Notes\logs\mochi-YYYY-MM-DD.log (theo userData; tôn trọng MOCHI_DATA_DIR).
// Xoay vòng: giữ 7 ngày, mỗi file tối đa 2MB (đầy thì chuyển thành mochi-YYYY-MM-DD.1.log, ghi đè bản .1 cũ).
// Ghi theo lô (flush mỗi 2s / khi thoát). KHÔNG ghi nội dung note: chỉ thông điệp lỗi (cắt ngắn).
// Dùng: require('./logger.js').init(app)  — gọi sớm nhất có thể trong main.js.
const fs = require('fs');
const path = require('path');
const util = require('util');

const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_DAYS = 7;
const FLUSH_MS = 2000;
const MAX_BUFFER = 256 * 1024;   // buffer quá lớn thì flush ngay
const MAX_MSG = 2000;
const FILE_RE = /^mochi-(\d{4})-(\d{2})-(\d{2})(?:\.\d+)?\.log$/;

let appRef = null;
let buf = [];
let bufBytes = 0;
let timer = null;
let inited = false;
let version = '?';
let lastPrune = '';
let dirOverride = null;

const pad = n => String(n).padStart(2, '0');
const dayOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const stampOf = d => dayOf(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + String(d.getMilliseconds()).padStart(3, '0');

/** Thư mục log. Tính lười để theo kịp app.setPath('userData') của main.js. */
function dir() {
  if (dirOverride) return dirOverride;
  let base = process.env.MOCHI_DATA_DIR || '';
  if (!base && appRef) { try { base = appRef.getPath('userData'); } catch (_) { base = ''; } }
  if (!base) base = path.join(process.env.APPDATA || process.cwd(), 'Mochi Notes');
  return path.join(base, 'logs');
}

function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…[+' + (s.length - n) + ']' : s; }
function fmtErr(e) {
  if (e instanceof Error) return clip(e.stack || (e.name + ': ' + e.message), MAX_MSG);
  if (typeof e === 'string') return clip(e, MAX_MSG);
  try { return clip(util.inspect(e, { depth: 2, breakLength: Infinity }), MAX_MSG); } catch (_) { return '[không in được]'; }
}

/** Ghi một dòng vào buffer (không đụng đĩa). level: ERROR|WARN|FATAL|INFO|... */
function write(level, tag, msg) {
  try {
    const line = stampOf(new Date()) + ' [' + level + '] ' + (tag ? '[' + tag + '] ' : '') + String(msg).replace(/\r?\n/g, '\n    ') + '\n';
    buf.push(line);
    bufBytes += line.length;
    if (bufBytes >= MAX_BUFFER) flush();
    else schedule();
  } catch (_) { /* logger không được làm hỏng app */ }
}

function schedule() {
  if (timer || !inited) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
  if (timer.unref) timer.unref();
}

function prune(d) {
  const today = dayOf(d);
  if (lastPrune === today) return;
  lastPrune = today;
  try {
    const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (KEEP_DAYS - 1)).getTime();   // giữ hôm nay + 6 ngày trước
    for (const f of fs.readdirSync(dir())) {
      const m = FILE_RE.exec(f);
      if (!m) continue;
      if (new Date(+m[1], +m[2] - 1, +m[3]).getTime() < cutoff) { try { fs.unlinkSync(path.join(dir(), f)); } catch (_) { /* bỏ qua */ } }
    }
  } catch (_) { /* bỏ qua */ }
}

/** Ghi buffer xuống đĩa (đồng bộ, nhẹ: một appendFile cho cả lô). */
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!buf.length) return;
  let text = buf.join('');
  buf = []; bufBytes = 0;
  try {
    const d = new Date(), base = dir(), file = path.join(base, 'mochi-' + dayOf(d) + '.log');
    fs.mkdirSync(base, { recursive: true });
    let size = 0;
    try { size = fs.statSync(file).size; } catch (_) { /* chưa có file */ }
    if (size + Buffer.byteLength(text) > MAX_BYTES) {
      // xoay: file hiện tại -> .1.log (ghi đè), bắt đầu file mới
      if (size > 0) {
        const old = path.join(base, 'mochi-' + dayOf(d) + '.1.log');
        try { try { fs.unlinkSync(old); } catch (_) { /* chưa có */ } fs.renameSync(file, old); } catch (_) { try { fs.truncateSync(file, 0); } catch (_e) { /* bỏ qua */ } }
      }
      if (Buffer.byteLength(text) > MAX_BYTES - 1024) text = text.slice(-Math.floor(MAX_BYTES / 4));   // một lô khổng lồ: giữ phần cuối
      size = 0;
    }
    if (size === 0) text = '=== Mochi Notes ' + version + ' | log ' + dayOf(d) + ' ===\n' + text;
    fs.appendFileSync(file, text, 'utf8');
    prune(d);
  } catch (_) { /* ổ đĩa lỗi: bỏ lô này, không ném */ }
}

function hookConsole() {
  for (const [name, level] of [['error', 'ERROR'], ['warn', 'WARN']]) {
    const orig = console[name];
    if (orig && orig.__mochiLogged) continue;
    const wrapped = function () {
      try { write(level, 'main', Array.prototype.map.call(arguments, a => (typeof a === 'string' ? clip(a, MAX_MSG) : fmtErr(a))).join(' ')); } catch (_) { /* bỏ qua */ }
      return orig.apply(console, arguments);   // giữ in ra console
    };
    wrapped.__mochiLogged = true;
    console[name] = wrapped;
  }
}

function hookProcess() {
  process.on('uncaughtException', (err, origin) => { write('FATAL', 'uncaughtException', fmtErr(err) + (origin ? ' (' + origin + ')' : '')); flush(); });
  process.on('unhandledRejection', reason => { write('ERROR', 'unhandledRejection', fmtErr(reason)); });
  process.on('exit', code => { write('INFO', 'exit', 'code=' + code); flush(); });
}

// Thông điệp console renderer: tối đa 500 ký tự, nguồn rút gọn thành tên file:dòng (không ghi nội dung note).
function onConsoleMessage(wcId, a, b, c, d, e) {
  let level, message, line, source;
  if (a && typeof a === 'object' && ('level' in a || 'message' in a)) { level = a.level; message = a.message; line = a.lineNumber; source = a.sourceId; }   // Electron >= 35
  else { level = b; message = c; line = d; source = e; }                                                                                         // Electron <= 34
  if (!(level === 3 || level === 'error')) return;
  write('ERROR', 'renderer#' + wcId, clip(message, 500) + ' (' + path.basename(String(source || '?')) + ':' + (line || 0) + ')');
}

function hookApp(app) {
  app.on('render-process-gone', (_e, wc, details) => {
    write('ERROR', 'render-process-gone', 'reason=' + (details && details.reason) + ' exitCode=' + (details && details.exitCode) + ' wc=' + (wc && wc.id));
    flush();
  });
  app.on('child-process-gone', (_e, details) => {
    write('ERROR', 'child-process-gone', 'type=' + (details && details.type) + ' reason=' + (details && details.reason) + ' exitCode=' + (details && details.exitCode) + (details && details.name ? ' name=' + details.name : ''));
    flush();
  });
  app.on('web-contents-created', (_e, wc) => {
    try {
      const id = wc.id;
      wc.on('console-message', (a, b, c, d, e) => { try { onConsoleMessage(id, a, b, c, d, e); } catch (_) { /* bỏ qua */ } });
    } catch (_) { /* bỏ qua */ }
  });
  app.on('before-quit', flush);
  app.on('will-quit', flush);
}

/** Gắn mọi bộ bắt lỗi. Gọi một lần, càng sớm càng tốt. app: electron.app (hoặc stub có getPath/getVersion/on). */
function init(app) {
  if (inited) return module.exports;
  inited = true;
  appRef = app || null;
  try { version = (appRef && appRef.getVersion && appRef.getVersion()) || '?'; } catch (_) { version = '?'; }
  write('INFO', 'start', 'Mochi Notes ' + version + ' pid=' + process.pid + ' electron=' + (process.versions.electron || '-') + ' node=' + process.versions.node + ' ' + process.platform);
  hookConsole();
  hookProcess();
  if (appRef && typeof appRef.on === 'function') hookApp(appRef);
  schedule();
  return module.exports;
}

module.exports = {
  init, dir, flush, write,
  error: (tag, e) => write('ERROR', tag, fmtErr(e)),
  warn: (tag, e) => write('WARN', tag, fmtErr(e)),
  _setDir: d => { dirOverride = d; },   // chỉ cho test
  MAX_BYTES, KEEP_DAYS
};
