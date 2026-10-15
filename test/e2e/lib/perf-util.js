'use strict';
// Tiện ích đo hiệu năng cho test/e2e/perf.test.js (phòng qa). Không đụng src/.
const fs = require('fs');
const path = require('path');
const { waitFor, sleep, OUT } = require('./app');

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const SENT = [
  'Họp với khách hàng lúc 3 giờ chiều về hợp đồng quý bốn, nhớ mang theo bản in.',
  'Mua sữa, trứng, rau muống và bánh mì cho bữa sáng ngày mai.',
  'Gọi điện cho mẹ hỏi thăm sức khoẻ và báo lịch về quê cuối tuần.',
  'Nộp báo cáo tuần cho chị Hương trước 5 giờ chiều thứ Sáu.',
  'Ý tưởng: làm bảng theo dõi chi tiêu, thêm biểu đồ tròn theo danh mục.'
];

/** Tạo seed n note: bounds rải lưới trên 1440x900; một số có nhắc; `visible` quyết định note nào đang dán. */
function makeSeed(n, { visible = () => true, remindEvery = 6, dueAt = null } = {}) {
  const cols = Math.ceil(Math.sqrt(n * 1440 / 900)), rows = Math.ceil(n / cols);
  const w = 260, h = 220, now = Date.now();
  const notes = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = Math.round(c * Math.max(0, (1440 - w)) / Math.max(1, cols - 1));
    const y = Math.round(r * Math.max(0, (900 - h)) / Math.max(1, rows - 1));
    const lines = [0, 1, 2].map(k => SENT[(i + k) % SENT.length]);
    const text = 'Note số ' + (i + 1) + '\n' + lines.join('\n');
    const html = '<div>Note số ' + (i + 1) + '</div>' + lines.map(l => '<div>' + l + '</div>').join('');
    const note = {
      id: 'perf-' + String(i + 1).padStart(3, '0'), html, text,
      color: COLORS[i % COLORS.length], bounds: { x, y, width: w, height: h },
      visible: !!visible(i), alwaysOnTop: false, reminder: null,
      createdAt: now - (n - i) * 60000, updatedAt: now - (n - i) * 60000
    };
    if (dueAt != null) note.reminder = { due: dueAt, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false };
    else if (remindEvery && i % remindEvery === 0) note.reminder = { due: now + (2 + i) * 3600e3, lead: 600000, intent: 'task', auto: true, preFired: false, fired: false, done: false };
    notes.push(note);
  }
  return { version: 2, notes, settings: {} };
}

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Đọc /proc/<pid>/status VmRSS và smaps_rollup Pss (KB). */
function procMem(pid) {
  const r = { rss: 0, pss: 0 };
  try { const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync('/proc/' + pid + '/status', 'utf8')); if (m) r.rss = +m[1]; } catch (_) { /* */ }
  try { const m = /Pss:\s+(\d+)/.exec(fs.readFileSync('/proc/' + pid + '/smaps_rollup', 'utf8')); if (m) r.pss = +m[1]; } catch (_) { /* */ }
  return r;
}

/** RAM + CPU tích luỹ của mọi tiến trình Electron (từ app.getAppMetrics trong main). Đơn vị MB, giây CPU. */
async function metrics(app) {
  const list = await app.main((c, e) => e.app.getAppMetrics().map(m => ({ pid: m.pid, type: m.type, ws: m.memory.workingSetSize, cpu: m.cpu.cumulativeCPUUsage || 0 })));
  let ws = 0, rss = 0, pss = 0, cpu = 0;
  for (const m of list) { ws += m.ws; cpu += m.cpu; const p = procMem(m.pid); rss += p.rss; pss += p.pss; }
  const byType = {};
  for (const m of list) byType[m.type] = (byType[m.type] || 0) + 1;
  return { procs: list.length, byType, wsMB: ws / 1024, rssMB: rss / 1024, pssMB: pss / 1024, cpuSec: cpu, t: Date.now() };
}

/** CPU trung bình (% của MỘT nhân) trong `ms` ms, theo cumulativeCPUUsage. */
async function idleCpu(app, ms) {
  const a = await metrics(app);
  await sleep(ms);
  const b = await metrics(app);
  return { cpuPct: (b.cpuSec - a.cpuSec) / ((b.t - a.t) / 1000) * 100, mem: b };
}

/** Chờ đủ n cửa sổ note đã domcontentloaded và có nội dung. Trả ms từ t0. */
async function waitNotesReady(app, n, t0, timeout = 90000) {
  await waitFor(async () => {
    const ps = app.pages('note.html');
    if (ps.length < n) return false;
    const ok = await Promise.all(ps.map(p => p.evaluate(() => document.readyState !== 'loading' && !!document.getElementById('editor') && document.getElementById('editor').innerText.length > 0).catch(() => false)));
    return ok.filter(Boolean).length >= n;
  }, { timeout, interval: 50, msg: n + ' cửa sổ note có nội dung' });
  return Date.now() - t0;
}

/** Cài đồng hồ đo độ trễ event loop của main (setInterval 10ms). */
function installLag(app) {
  return app.main(() => {
    if (globalThis.__lag) return true;
    const L = globalThis.__lag = { max: 0, over100: 0, over500: 0, last: Date.now(), samples: 0, sumOver: 0 };
    L.timer = setInterval(() => {
      const now = Date.now(), lag = now - L.last - 10; L.last = now; L.samples++;
      if (lag > L.max) L.max = lag;
      if (lag > 100) L.over100++;
      if (lag > 500) L.over500++;
      if (lag > 20) L.sumOver += lag;
    }, 10);
    return true;
  });
}
const lagRead = app => app.main(() => { const L = globalThis.__lag; return L && { max: L.max, over100: L.over100, over500: L.over500, sumOver: L.sumOver }; });
const lagReset = app => app.main(() => { const L = globalThis.__lag; if (L) { L.max = 0; L.over100 = 0; L.over500 = 0; L.sumOver = 0; L.last = Date.now(); } return true; });

const results = {};
function record(key, val) {
  results[key] = val;
  try { fs.writeFileSync(path.join(OUT, 'perf-results.json'), JSON.stringify(results, null, 2)); } catch (_) { /* */ }
  console.log('[PERF] ' + key + ' = ' + JSON.stringify(val));
}

module.exports = { makeSeed, median, metrics, idleCpu, waitNotesReady, installLag, lagRead, lagReset, record, results };
