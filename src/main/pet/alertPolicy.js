'use strict';
// Chính sách "nhắc to có biết ý": quyết định có đập màn hình hay chỉ nhắc ở góc.
// decide() là hàm THUẦN (không đọc đồng hồ/hệ thống) nên test được bằng node thường (tools/test-alert-policy.js).
// probeSystem() là phần dò hệ thống (PowerShell một lần, timeout 3s, cache 30s): lỗi/timeout -> { error } -> coi là KHÔNG bận.
// Không require('electron').

const DEFAULT_QUIET = { on: true, from: '22:00', to: '07:00' };
const DEFAULT_VOLUME = 70;
const QUIET_FACTOR = 0.5;           // trong giờ yên lặng: tiếng nhẹ giảm 50%

const BROWSERS = new Set(['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'coccoc', 'browser', 'arc', 'iexplore']);
// Cửa sổ foreground thuộc các exe này không bao giờ bị coi là "toàn màn hình trình chiếu" (desktop, shell, chính app)
const FULLSCREEN_EXEMPT = new Set(['explorer', 'searchhost', 'searchapp', 'startmenuexperiencehost', 'shellexperiencehost', 'lockapp', 'applicationframehost', 'textinputhost', 'electron', 'mochi notes', 'mochi-notes', 'mochinotes']);
const SHELL_TITLES = new Set(['program manager', '']);
const SHARE_RE = /(is sharing your screen|you(?:'|’)re sharing|you are sharing|stop sharing|đang chia sẻ màn hình|dừng chia sẻ|đang trình chiếu màn hình)/i;

const exeOf = v => String(v == null ? '' : v).toLowerCase().replace(/\.exe$/, '').trim();
const titleOf = v => String(v == null ? '' : v);

/** 'HH:MM' -> phút trong ngày, hoặc null nếu sai. */
function parseHM(s) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s == null ? '' : s));
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? h * 60 + mi : null;
}

/** Đang trong giờ yên lặng? (qua nửa đêm: from > to). [from, to). from == to -> không giờ nào yên lặng. */
function inQuietHours(now, qh) {
  const q = qh && typeof qh === 'object' ? qh : null;
  if (!q || q.on !== true) return false;
  let a = parseHM(q.from), b = parseHM(q.to);
  if (a == null) a = parseHM(DEFAULT_QUIET.from);
  if (b == null) b = parseHM(DEFAULT_QUIET.to);
  if (a === b) return false;
  const d = new Date(now);
  const m = d.getHours() * 60 + d.getMinutes();
  if (isNaN(m)) return false;
  return a < b ? (m >= a && m < b) : (m >= a || m < b);
}

/** alertVolume 0..100 -> 0..1 (mặc định 70). */
function volumeOf(settings) {
  const v = settings && typeof settings.alertVolume === 'number' && isFinite(settings.alertVolume) ? settings.alertVolume : DEFAULT_VOLUME;
  return Math.round(Math.min(100, Math.max(0, v))) / 100;
}

const round2 = x => Math.round(x * 100) / 100;

/** Âm lượng ding/cộp khi KHÔNG biết gì về màn hình (chỉ giờ yên lặng + âm lượng). Dùng cho tiếng ding ở góc. */
function soundLevel(now, settings) {
  const v = volumeOf(settings);
  return round2(inQuietHours(now, settings && settings.quietHours) ? v * QUIET_FACTOR : v);
}

/** Phát hiện họp / chia sẻ màn hình từ danh sách cửa sổ. Trả 'meeting' hoặc null. */
function meetingIn(processes) {
  const list = Array.isArray(processes) ? processes : [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const exe = exeOf(p.name != null ? p.name : p.exe), t = titleOf(p.title);
    if (!t) continue;
    if (SHARE_RE.test(t)) return 'meeting';
    if (exe === 'zoom' || exe === 'zoom.us') {
      if (/zoom (meeting|webinar)|screen shar|sharing|đang chia sẻ|chia sẻ màn hình|cuộc họp/i.test(t)) return 'meeting';
    } else if (exe === 'ms-teams' || exe === 'teams' || exe === 'msteams') {
      if (/meeting|cuộc họp|cuộc gọi|\bcall\b/i.test(t)) return 'meeting';
    } else if (BROWSERS.has(exe)) {
      if (/meet\s[-–—]|meet\.google\.com/i.test(t)) return 'meeting';
    } else if (exe === 'skype' || exe === 'skypeapp' || exe === 'lync') {
      if (/meeting|cuộc họp|cuộc gọi|\bcall\b|screen shar|sharing/i.test(t)) return 'meeting';
    } else if (exe.startsWith('webex') || exe === 'atmgr' || exe === 'ptoneclk') {
      if (/meeting|cuộc họp|share|sharing|chia sẻ/i.test(t) && !/^\s*(cisco\s+)?webex(\s+meetings?)?\s*$/i.test(t)) return 'meeting';
    } else if (exe === 'discord' || exe === 'discordptb' || exe === 'discordcanary') {
      if (/screen shar|sharing|đang chia sẻ|chia sẻ màn hình|\bstream/i.test(t)) return 'meeting';
    }
  }
  return null;
}

const covers = (r, d, tol) => !!r && !!d &&
  [r.left, r.top, r.right, r.bottom, d.left, d.top, d.right, d.bottom].every(n => typeof n === 'number' && isFinite(n)) &&
  r.left <= d.left + tol && r.top <= d.top + tol && r.right >= d.right - tol && r.bottom >= d.bottom - tol;

/** Cửa sổ foreground là trình chiếu/toàn màn hình? */
function fullscreenIn(fg) {
  if (!fg || typeof fg !== 'object') return false;
  const exe = exeOf(fg.exe), t = titleOf(fg.title);
  if (exe === 'powerpnt' && /slide show|slideshow|trình chiếu/i.test(t)) return true;     // slideshow dạng cửa sổ vẫn là đang trình chiếu
  if (FULLSCREEN_EXEMPT.has(exe)) return false;
  if (SHELL_TITLES.has(t.trim().toLowerCase()) && (exe === '' || exe === 'explorer')) return false;
  return covers(fg.rect, fg.display, 2);
}

/**
 * decide({ now, settings, fg, processes, focusAssist, probeError })
 *   settings: { bigAlert, quietHours:{on,from,to}, alertVolume 0..100, smartAlert }
 *   fg: { title, exe, rect:{left,top,right,bottom}, display:{left,top,right,bottom} }   processes: [{ name, title }]
 * -> { big:boolean, sound:0..1, reason: null|'off'|'quiet'|'meeting'|'fullscreen' }
 *   sound = độ to cuối cùng (đã nhân âm lượng; 0 = im). Bận trước người khác -> big=false, sound=0.
 *   Lỗi dò (probeError) -> coi là không bận (chỉ còn giờ yên lặng).
 */
function decide(input) {
  const o = input && typeof input === 'object' ? input : {};
  const s = o.settings && typeof o.settings === 'object' ? o.settings : {};
  const vol = volumeOf(s);
  if (s.bigAlert === false) return { big: false, sound: round2(vol), reason: 'off' };
  if (s.smartAlert !== false && !o.probeError) {
    let why = meetingIn(o.processes);
    if (!why && fullscreenIn(o.fg)) why = 'fullscreen';
    if (why) return { big: false, sound: 0, reason: why };
    if (o.focusAssist === true) return { big: false, sound: round2(vol * QUIET_FACTOR), reason: 'quiet' };
  }
  if (inQuietHours(o.now, s.quietHours)) return { big: false, sound: round2(vol * QUIET_FACTOR), reason: 'quiet' };
  return { big: true, sound: round2(vol), reason: null };
}

// ------------------------------------------------------------------ dò hệ thống (chỉ Windows, chạy khi cần)
const PS_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue'",
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
  'Add-Type -TypeDefinition @"',
  'using System; using System.Text; using System.Runtime.InteropServices;',
  'public static class MochiFg {',
  '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct MI { public int cb; public RECT mon; public RECT work; public int flags; }',
  '  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);',
  '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);',
  '  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MI mi);',
  '  public static string Title = ""; public static uint Pid = 0; public static RECT Rect; public static RECT Mon; public static bool Ok = false;',
  '  public static void Run() {',
  '    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return;',
  '    StringBuilder sb = new StringBuilder(512); GetWindowText(h, sb, 512); Title = sb.ToString();',
  '    GetWindowThreadProcessId(h, out Pid); GetWindowRect(h, out Rect);',
  '    MI mi = new MI(); mi.cb = Marshal.SizeOf(typeof(MI));',
  '    if (GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) { Mon = mi.mon; Ok = true; }',
  '  }',
  '}',
  '"@',
  '[MochiFg]::Run()',
  '$fg = $null',
  'if ([MochiFg]::Ok) {',
  '  $pn = (Get-Process -Id ([MochiFg]::Pid)).ProcessName',
  '  $fg = @{ title=[MochiFg]::Title; exe=$pn; rect=@{left=[MochiFg]::Rect.L;top=[MochiFg]::Rect.T;right=[MochiFg]::Rect.R;bottom=[MochiFg]::Rect.B}; display=@{left=[MochiFg]::Mon.L;top=[MochiFg]::Mon.T;right=[MochiFg]::Mon.R;bottom=[MochiFg]::Mon.B} }',
  '}',
  '$procs = @(Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { @{ name=$_.ProcessName; title=$_.MainWindowTitle } })',
  '$dnd = $false',
  "$v = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' -Name NOC_GLOBAL_SETTING_TOASTS_ENABLED).NOC_GLOBAL_SETTING_TOASTS_ENABLED",
  'if ($v -eq 0) { $dnd = $true }',
  '@{ fg=$fg; processes=$procs; dnd=$dnd } | ConvertTo-Json -Compress -Depth 5'
].join('\r\n');

const TIMEOUT_MS = 3000;       // PowerShell khởi động nguội trên máy này mất ~1.3-1.7s nên 1.5s quá sát; quá hạn vẫn coi là không bận
const CACHE_MS = 30000;

/**
 * probeSystem(opts?) -> Promise<{ fg, processes, focusAssist } | { error }>. Không bao giờ reject, không bao giờ quá timeoutMs.
 * opts: { execFile?, platform?, now?, timeoutMs?, cacheMs?, force? }  (chỉ để test)
 */
let cache = null;
function probeSystem(opts) {
  opts = opts || {};
  const now = (opts.now || Date.now)(), cacheMs = opts.cacheMs != null ? opts.cacheMs : CACHE_MS;
  if (!opts.force && cache && now - cache.at < cacheMs) return Promise.resolve(cache.data);
  if ((opts.platform || process.platform) !== 'win32') return Promise.resolve({ error: 'platform' });
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  let child = null, timer = null;
  const run = new Promise(resolve => {
    try {
      const execFile = opts.execFile || require('child_process').execFile;
      const enc = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
      child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
        { windowsHide: true, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: timeoutMs },
        (err, stdout) => {
          if (err) return resolve({ error: String(err.message || err).slice(0, 120) });
          try { resolve(parseProbe(stdout)); } catch (e) { resolve({ error: 'parse' }); }
        });
    } catch (e) { resolve({ error: String(e && e.message || e).slice(0, 120) }); }
  });
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ error: 'timeout' }), timeoutMs); });
  return Promise.race([run, timeout]).then(data => {
    clearTimeout(timer);
    if (data && data.error) { try { if (child && child.kill) child.kill(); } catch (_) { /* bỏ qua */ } } else cache = { at: now, data };
    return data;
  }, () => { clearTimeout(timer); return { error: 'fail' }; });
}

function parseProbe(stdout) {
  const txt = String(stdout || '').replace(/^﻿/, '').trim();
  const j = JSON.parse(txt.slice(txt.indexOf('{')));
  const procs = Array.isArray(j.processes) ? j.processes : (j.processes ? [j.processes] : []);
  return {
    fg: j.fg && typeof j.fg === 'object' ? j.fg : null,
    processes: procs.map(p => ({ name: String(p && p.name || ''), title: String(p && p.title || '') })),
    focusAssist: j.dnd === true
  };
}

module.exports = { decide, inQuietHours, soundLevel, volumeOf, meetingIn, fullscreenIn, parseHM, probeSystem, parseProbe, PS_SCRIPT, DEFAULT_QUIET, DEFAULT_VOLUME, QUIET_FACTOR };
