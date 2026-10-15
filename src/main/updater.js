'use strict';
// Tự cập nhật (electron-updater). Mặc định dùng GitHub Releases (provider 'github'):
//   owner/repo lấy từ package.json -> build.publish (provider github) hoặc trường "repository".
//   Nếu còn placeholder (OWNER / YOUR_...) hoặc không có thì KHÔNG bật GitHub.
// Ghi đè tuỳ chọn (provider 'generic'), theo thứ tự: settings.updateUrl -> update.json cạnh exe -> update.json trong thư mục dữ liệu.
//   Định dạng update.json: { "url": "https://.../mochi-notes/" }
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const SIX_HOURS = 6 * 60 * 60 * 1000;
let autoUpdater = null;
let timer = null;
let downloaded = null;
let ctxRef = null;

function log(...a) { try { console.log('[updater]', ...a); } catch (_) { /* bỏ qua */ } }

function readJsonUrl(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return j && typeof j.url === 'string' ? j.url.trim() : '';
  } catch (_) { return ''; }
}
function getUrl() {
  let u = '';
  try { u = String((ctxRef && ctxRef.settings && ctxRef.settings().updateUrl) || '').trim(); } catch (_) { /* bỏ qua */ }
  if (!u) u = readJsonUrl(path.join(path.dirname(process.execPath), 'update.json'));
  if (!u) u = readJsonUrl(path.join(app.getPath('userData'), 'update.json'));
  return /^https?:\/\//i.test(u) ? u : '';
}

const PLACEHOLDER_RE = /^(owner|your[-_ ]?.*|<.*>|example|changeme|todo)$/i;
function validName(v) { return typeof v === 'string' && /^[A-Za-z0-9._-]+$/.test(v) && !PLACEHOLDER_RE.test(v); }
// Trả { owner, repo } hợp lệ hoặc null.
function getGithub() {
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8').replace(/^﻿/, '')); } catch (_) { return null; }
  if (!pkg) return null;
  const pub = pkg.build && pkg.build.publish;
  const list = Array.isArray(pub) ? pub : (pub ? [pub] : []);
  for (const p of list) {
    if (p && p.provider === 'github' && validName(p.owner) && validName(p.repo)) return { owner: p.owner, repo: p.repo };
  }
  let r = pkg.repository;
  if (r && typeof r === 'object') r = r.url;
  if (typeof r === 'string') {
    const m = r.match(/github(?:\.com)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
    if (m && validName(m[1]) && validName(m[2])) return { owner: m[1], repo: m[2] };
  }
  return null;
}
// Nguồn cập nhật: ghi đè generic nếu có URL, ngược lại GitHub nếu cấu hình hợp lệ, ngược lại null.
function getFeed() {
  const url = getUrl();
  if (url) return { provider: 'generic', url };
  const gh = getGithub();
  if (gh) return { provider: 'github', owner: gh.owner, repo: gh.repo };
  return null;
}
function feedLabel() {
  const f = getFeed();
  return !f ? '' : f.provider === 'github' ? 'github:' + f.owner + '/' + f.repo : f.url;
}
function enabled() { return app.isPackaged && !!getFeed(); }

function prompt(version) {
  const win = ctxRef && ctxRef.windows && ctxRef.windows.list;
  const opts = {
    type: 'info', buttons: ['Khởi động lại để cập nhật', 'Để sau (cài khi thoát)'], defaultId: 0, cancelId: 1,
    title: 'Mochi Notes', message: 'Có bản mới ' + version,
    detail: 'Khởi động lại để cập nhật? Nếu để sau, bản mới sẽ tự cài khi bạn thoát Mochi.'
  };
  const p = win && !win.isDestroyed() ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
  p.then(r => { if (r.response === 0) { if (ctxRef) ctxRef.quitting = true; autoUpdater.quitAndInstall(false, true); } }).catch(() => {});
}

function setup() {
  if (autoUpdater) return true;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = { info: log, warn: log, error: log, debug() {} };
    autoUpdater.on('error', e => log('lỗi', e && e.message));
    autoUpdater.on('update-downloaded', info => { downloaded = info.version; prompt(info.version); });
    return true;
  } catch (e) { log('không nạp được electron-updater', e && e.message); autoUpdater = null; return false; }
}

// manual=true: trả về thông báo cho người dùng (qua hộp thoại gọi từ tray); trả { ok, message }.
async function check(manual) {
  const feed = getFeed();
  if (!app.isPackaged) return { ok: false, message: 'Chỉ kiểm tra được trên bản đã cài.' };
  if (!feed) return { ok: false, message: 'Chưa cấu hình nguồn cập nhật (GitHub OWNER/repo hoặc địa chỉ riêng).' };
  if (!setup()) return { ok: false, message: 'Không khởi tạo được bộ cập nhật.' };
  try {
    autoUpdater.setFeedURL(feed);
    if (downloaded) { prompt(downloaded); return { ok: true, message: 'Đã tải xong bản ' + downloaded + '.' }; }
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && v !== app.getVersion()) return { ok: true, message: 'Có bản mới ' + v + ', đang tải nền.' };
    return { ok: true, message: 'Bạn đang dùng bản mới nhất (' + app.getVersion() + ').' };
  } catch (e) {
    log('kiểm tra lỗi', e && e.message);
    return { ok: false, message: manual ? 'Không kiểm tra được (kiểm tra mạng rồi thử lại).' : '' };
  }
}

function init(ctx) {
  ctxRef = ctx;
  ctx.updater = { enabled, check: () => check(true), url: feedLabel };
  if (!enabled()) return;
  setTimeout(() => { check(false); }, 20000);
  timer = setInterval(() => { if (enabled()) check(false); }, SIX_HOURS);
  if (timer.unref) timer.unref();
}

module.exports = { init };
