'use strict';
// Hỏi cửa sổ đang ở trên cùng (foreground) của Windows để bé "gõ cửa". Xem docs/rooms/core/ARCH.md mục K.
// Một tiến trình PowerShell sống lâu, khởi động lười, nói chuyện từng dòng qua stdin/stdout.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const TIMEOUT_MS = 1500;
const MAX_RESTARTS = 3;

// Mã PowerShell 5.1. Giao thức: nhận dòng "q" -> in 1 dòng JSON; dòng "exit" -> thoát.
const PS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$src = @'",
  'using System;',
  'using System.Runtime.InteropServices;',
  'using System.Text;',
  '',
  'public static class MochiFg {',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
  '',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct MONITORINFO {',
  '    public int cbSize;',
  '    public RECT rcMonitor;',
  '    public RECT rcWork;',
  '    public int dwFlags;',
  '  }',
  '',
  '  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
  '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);',
  '  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);',
  '  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint dwFlags);',
  '  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);',
  '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);',
  '  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();',
  '  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);',
  '',
  '  public static void InitDpi() {',
  '    try {',
  '      // -4 = DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 (Windows 10 1703+)',
  '      if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) { SetProcessDPIAware(); }',
  '    } catch (Exception) {',
  '      try { SetProcessDPIAware(); } catch (Exception) { }',
  '    }',
  '  }',
  '',
  '  static string Esc(string s) {',
  '    if (s == null) return "";',
  '    StringBuilder sb = new StringBuilder();',
  '    foreach (char c in s) {',
  '      if (c == (char)34) sb.Append("\\\\\\"");',
  '      else if (c == (char)92) sb.Append("\\\\\\\\");',
  '      else if (c < 32 || c > 126) sb.Append("\\\\u").Append(((int)c).ToString("x4"));',
  '      else sb.Append(c);',
  '    }',
  '    return sb.ToString();',
  '  }',
  '',
  '  public static string Query() {',
  '    IntPtr h = GetForegroundWindow();',
  '    if (h == IntPtr.Zero) return "null";',
  '    RECT r;',
  '    if (!GetWindowRect(h, out r)) return "null";',
  '    uint pid = 0;',
  '    GetWindowThreadProcessId(h, out pid);',
  '    bool iconic = IsIconic(h);',
  '    StringBuilder t = new StringBuilder(256);',
  '    GetWindowText(h, t, 256);',
  '    int mx = 0, my = 0, mr = 0, mb = 0;',
  '    IntPtr mon = MonitorFromWindow(h, 2);',
  '    MONITORINFO mi = new MONITORINFO();',
  '    mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));',
  '    if (mon != IntPtr.Zero && GetMonitorInfo(mon, ref mi)) {',
  '      mx = mi.rcMonitor.Left; my = mi.rcMonitor.Top; mr = mi.rcMonitor.Right; mb = mi.rcMonitor.Bottom;',
  '    }',
  '    return "{\\"x\\":" + r.Left + ",\\"y\\":" + r.Top + ",\\"w\\":" + (r.Right - r.Left) + ",\\"h\\":" + (r.Bottom - r.Top)',
  '      + ",\\"pid\\":" + pid + ",\\"iconic\\":" + (iconic ? "true" : "false")',
  '      + ",\\"mx\\":" + mx + ",\\"my\\":" + my + ",\\"mw\\":" + (mr - mx) + ",\\"mh\\":" + (mb - my)',
  '      + ",\\"title\\":\\"" + Esc(t.ToString()) + "\\"}";',
  '  }',
  '}',
  "'@",
  'Add-Type -TypeDefinition $src',
  '[MochiFg]::InitDpi()',
  "[Console]::Out.WriteLine('{\"ready\":true}')",
  '[Console]::Out.Flush()',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($line -eq $null) { break }',
  "  if ($line -eq 'exit') { break }",
  '  try { $out = [MochiFg]::Query() } catch { $out = "null" }',
  '  [Console]::Out.WriteLine($out)',
  '  [Console]::Out.Flush()',
  '}',
  ''
].join('\r\n');

// Thuần: một dòng từ PowerShell -> {rect(px vật lý), monitor, pid, iconic, title} | null | {ready:true}.
function parseLine(line) {
  if (typeof line !== 'string') return null;
  const s = line.trim();
  if (!s || s === 'null') return null;
  let o;
  try { o = JSON.parse(s); } catch (_) { return null; }
  if (!o || typeof o !== 'object') return null;
  if (o.ready === true) return { ready: true };
  const n = k => (typeof o[k] === 'number' && isFinite(o[k]) ? o[k] : null);
  const x = n('x'), y = n('y'), w = n('w'), h = n('h');
  if (x === null || y === null || w === null || h === null) return null;
  const mw = n('mw'), mh = n('mh');
  return {
    rect: { x, y, width: w, height: h },
    monitor: mw && mh ? { x: n('mx') || 0, y: n('my') || 0, width: mw, height: mh } : null,
    pid: n('pid') || 0,
    iconic: o.iconic === true,
    title: typeof o.title === 'string' ? o.title : ''
  };
}

// Thuần: cửa sổ phủ kín cả monitor (không tính thanh tác vụ -> cửa sổ phóng to thường KHÔNG tính).
function isFullscreen(rect, monitorRect) {
  if (!rect || !monitorRect) return false;
  if (!(monitorRect.width > 0 && monitorRect.height > 0)) return false;
  return rect.x <= monitorRect.x && rect.y <= monitorRect.y &&
    rect.x + rect.width >= monitorRect.x + monitorRect.width &&
    rect.y + rect.height >= monitorRect.y + monitorRect.height;
}

function parseFake(s) {
  if (typeof s !== 'string') return null;
  const p = s.split(',').map(v => Number(v.trim()));
  if (p.length !== 4 || p.some(v => !isFinite(v))) return null;
  return { x: p[0], y: p[1], width: p[2], height: p[3] };
}

function ownPids() {
  const set = new Set([process.pid]);
  try {
    const { app } = require('electron');
    if (app && typeof app.getAppMetrics === 'function') for (const m of app.getAppMetrics()) set.add(m.pid);
  } catch (_) {}
  return set;
}

function createForeground() {
  let child = null, starting = null, restarts = 0, stopped = false;
  let pending = null; // { resolve, timer }
  let buf = '';
  let queue = Promise.resolve();
  let scriptFile = null;

  function settle(val) {
    if (!pending) return;
    clearTimeout(pending.timer);
    const p = pending; pending = null;
    p.resolve(val);
  }

  function killChild() {
    const c = child; child = null; starting = null;
    if (!c) return;
    try { c.stdin.write('exit\n'); } catch (_) {}
    try { c.kill(); } catch (_) {}
  }

  function onLine(line) {
    const r = parseLine(line);
    if (r && r.ready) { if (starting) starting.ready(); return; }
    if (pending) settle(line.trim() === 'null' ? null : r);
  }

  function start() {
    if (child) return starting ? starting.promise : Promise.resolve(true);
    if (stopped || restarts > MAX_RESTARTS) return Promise.resolve(false);
    let ps;
    try {
      scriptFile = path.join(os.tmpdir(), 'mochi-fg-' + process.pid + '.ps1');
      fs.writeFileSync(scriptFile, '﻿' + PS_SCRIPT, 'utf8');
      ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptFile],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (_) { restarts++; return Promise.resolve(false); }
    child = ps; buf = '';
    let readyFn;
    const promise = new Promise(res => {
      readyFn = () => res(true);
      setTimeout(() => res(false), 8000); // Add-Type có thể chậm lần đầu
    });
    starting = { promise, ready: () => { readyFn(); starting = null; } };
    ps.stdout.setEncoding('utf8');
    ps.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) onLine(l); }
    });
    const dead = () => {
      if (child !== ps) return;
      child = null; starting = null; restarts++;
      settle(null);
    };
    ps.on('exit', dead);
    ps.on('error', dead);
    ps.stdin.on('error', () => {});
    return promise;
  }

  async function ask() {
    const ok = await start();
    if (!ok || !child) { if (child) killChild(); restarts++; return null; }
    return new Promise(resolve => {
      const timer = setTimeout(() => { settle(null); killChild(); restarts++; }, TIMEOUT_MS);
      pending = { resolve, timer };
      try { child.stdin.write('q\n'); } catch (_) { settle(null); }
    });
  }

  function dipRect(rect) {
    if (process.platform !== 'win32') return rect;
    try {
      const { screen } = require('electron');
      const r = screen.screenToDipRect(null, rect);
      if (r && isFinite(r.x)) return r;
    } catch (_) {}
    return rect;
  }

  async function get() {
    if (stopped) return null;
    const fake = parseFake(process.env.MOCHI_FAKE_FG);
    if (fake) return { rect: fake, title: 'fake', fullscreen: false, ownPid: false };
    if (process.platform !== 'win32') return null;
    const run = queue.then(ask, ask);
    queue = run.catch(() => null);
    let r = null;
    try { r = await run; } catch (_) { r = null; }
    if (!r || !r.rect) return null;
    const fullscreen = isFullscreen(r.rect, r.monitor);
    return {
      rect: dipRect(r.rect),
      title: r.title,
      fullscreen,
      ownPid: ownPids().has(r.pid),
      iconic: r.iconic
    };
  }

  function stop() {
    stopped = true;
    settle(null);
    killChild();
    try { if (scriptFile) fs.unlinkSync(scriptFile); } catch (_) {}
    scriptFile = null;
  }

  try { require('electron').app.once('before-quit', stop); } catch (_) {}

  return { get, stop };
}

module.exports = { createForeground, parseLine, isFullscreen };
