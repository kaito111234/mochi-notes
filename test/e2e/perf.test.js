'use strict';
// Nhóm perf: khởi động/RAM/CPU với 30 note, không treo, 30 nhắc cùng lúc, 200 note. Số liệu in ra [PERF] và ghi test/e2e/out/perf-results.json.
// Test chỉ đỏ khi treo/crash/hết giờ; ngưỡng hiệu năng chỉ để đánh giá trong findings.
const test = require('node:test');
const assert = require('node:assert');
const { launch, withApp, waitFor, sleep } = require('./lib/app');
const U = require('./lib/perf-util');

const IDLE_MS = +process.env.PERF_IDLE_MS || 30000;
const RUNS = +process.env.PERF_RUNS || 3;

async function measureLaunch(label, n, seedOpts) {
  const t0 = Date.now();
  const app = await launch({ seed: n === 0 ? undefined : U.makeSeed(n, seedOpts) });
  try {
    const ms = await U.waitNotesReady(app, n === 0 ? 2 : n, t0);
    await sleep(3000);                    // chờ ổn định (pet, tray...)
    const idle = await U.idleCpu(app, IDLE_MS);
    const r = { startMs: ms, procs: idle.mem.procs, wsMB: Math.round(idle.mem.wsMB), rssMB: Math.round(idle.mem.rssMB), pssMB: Math.round(idle.mem.pssMB), idleCpuPct: +idle.cpuPct.toFixed(2) };
    return r;
  } finally { await app.close(); }
}

async function series(label, n, seedOpts) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measureLaunch(label, n, seedOpts));
  const med = {};
  for (const k of Object.keys(runs[0])) med[k] = U.median(runs.map(r => r[k]));
  U.record(label, { runs, median: med });
  return med;
}

test('1a. mốc: 2 note mẫu (lần đầu)', { timeout: 300000 }, async () => {
  const m = await series('mốc-2-note-mẫu', 0);
  assert.ok(m.startMs > 0);
});
test('1b. mốc: 1 note', { timeout: 300000 }, async () => {
  const m = await series('mốc-1-note', 1);
  assert.ok(m.startMs > 0);
});
test('1c. 30 note: khởi động, RAM, CPU rảnh', { timeout: 600000 }, async () => {
  const m = await series('30-note', 30);
  assert.ok(m.startMs > 0);
});

test('2. 30 note: không treo khi gõ, ẩn/hiện tất cả, mở danh sách', { timeout: 240000 }, async () => {
  await withApp('perf-2', { seed: U.makeSeed(30) }, async app => {
    await U.waitNotesReady(app, 30, Date.now());
    await sleep(3000);
    await U.installLag(app);
    const out = {};
    // gõ vào note thứ 30
    const p30 = await app.noteWindow('perf-030');
    await p30.click('#editor');
    await U.lagReset(app);
    const lat = [];
    const txt = 'Gõ thử tiếng Việt trong note thứ ba mươi';
    for (const ch of txt) {
      const t = Date.now();
      await p30.keyboard.type(ch);
      await p30.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      lat.push(Date.now() - t);
    }
    out.typeMedianMs = U.median(lat); out.typeMaxMs = Math.max(...lat);
    out.typeMainLag = await U.lagRead(app);
    assert.ok((await p30.evaluate(() => document.getElementById('editor').innerText)).includes('ba mươi'), 'gõ không vào editor');

    // ẩn tất cả / hiện tất cả (Ctrl+Alt+H)
    await U.lagReset(app);
    let t = Date.now();
    await app.shortcut('Ctrl+Alt+H');
    await waitFor(async () => (await app.main(c => c.windows.notes.size)) === 0, { timeout: 30000, interval: 20, msg: 'ẩn hết' });
    out.hideAllMs = Date.now() - t;
    out.hideMainLag = await U.lagRead(app);
    await U.lagReset(app);
    t = Date.now();
    await app.shortcut('Ctrl+Alt+H');
    await U.waitNotesReady(app, 30, t, 60000);
    out.showAllMs = Date.now() - t;
    out.showMainLag = await U.lagRead(app);

    // mở danh sách
    await U.lagReset(app);
    t = Date.now();
    const lp = await app.openList();
    await lp.waitForLoadState('domcontentloaded');
    await waitFor(() => lp.evaluate(() => document.querySelectorAll('#cards .card').length >= 30), { timeout: 30000, interval: 20, msg: '30 thẻ trong danh sách' });
    out.openListMs = Date.now() - t;
    out.listMainLag = await U.lagRead(app);
    await app.shot('perf-30-note');
    U.record('30-note-không-treo', out);
    assert.strictEqual(await app.main(c => c.windows.notes.size), 30);
  });
});

test('3. 30 nhắc tới giờ cùng lúc: không treo, bé xếp hàng', { timeout: 240000 }, async () => {
  await withApp('perf-3', { seed: U.makeSeed(30, { remindEvery: 0 }) }, async app => {
    await U.waitNotesReady(app, 30, Date.now());
    await sleep(2000);
    await U.installLag(app);
    await app.main((c, e) => {
      globalThis.__due = 0; globalThis.__pre = 0; globalThis.__t0 = Date.now(); globalThis.__dueTimes = [];
      c.bus.on('reminder:due', () => { globalThis.__due++; globalThis.__dueTimes.push(Date.now()); });
      c.bus.on('reminder:pre', () => { globalThis.__pre++; });
      const due = Date.now() + 4000;
      for (const n of c.store.data.notes) n.reminder = { due, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false };
      c.store.save();
      return true;
    });
    await U.lagReset(app);
    const t0 = Date.now();
    let before = await U.metrics(app);
    await sleep(30000);
    const after = await U.metrics(app);
    const ev = await app.main((c, e) => ({
      due: globalThis.__due, pre: globalThis.__pre,
      firstMs: globalThis.__dueTimes.length ? globalThis.__dueTimes[0] - globalThis.__t0 : null,
      lastMs: globalThis.__dueTimes.length ? globalThis.__dueTimes[globalThis.__dueTimes.length - 1] - globalThis.__t0 : null,
      fired: c.store.data.notes.filter(n => n.reminder && n.reminder.fired).length,
      wins: e.BrowserWindow.getAllWindows().length
    }));
    const lag = await U.lagRead(app);
    // app còn phản hồi
    const alive = await app.main(() => 1);
    await app.shot('perf-30-nhac');
    U.record('30-nhắc-cùng-lúc', { events: ev, lag, cpuPctDuring30s: +((after.cpuSec - before.cpuSec) / ((after.t - before.t) / 1000) * 100).toFixed(1), wsMB: Math.round(after.wsMB), procs: after.procs });
    assert.strictEqual(alive, 1);
    assert.ok(ev.fired > 0 || ev.due > 0, 'không có nhắc nào được kích hoạt');
  });
});

test('4. 200 note (đa số cất): mở danh sách, tìm kiếm', { timeout: 240000 }, async () => {
  const seed = U.makeSeed(200, { visible: i => i < 5 });
  await withApp('perf-4', { seed }, async app => {
    await U.waitNotesReady(app, 5, Date.now());
    await sleep(3000);
    await U.installLag(app);
    const out = {};
    await U.lagReset(app);
    let t = Date.now();
    const lp = await app.openList();
    await lp.waitForLoadState('domcontentloaded');
    await waitFor(() => lp.evaluate(() => document.querySelectorAll('#cards .card').length > 0), { timeout: 30000, interval: 20, msg: 'thẻ danh sách' });
    out.openListMs = Date.now() - t;
    out.cardsAtOpen = await lp.evaluate(() => document.querySelectorAll('#cards .card').length);
    // bấm chip "Tất cả" nếu có để thấy cả note cất
    out.chips = await lp.evaluate(() => [...document.querySelectorAll('.chip')].map(c => c.dataset.f + ':' + c.textContent.trim()));
    t = Date.now();
    await lp.evaluate(() => { const c = document.querySelector('.chip[data-f="all"]'); if (c) c.click(); });
    await sleep(50);
    out.allCards = await lp.evaluate(() => document.querySelectorAll('#cards .card').length);
    out.chipAllMs = Date.now() - t;
    // tìm kiếm: đo từ lúc gõ tới lúc DOM cập nhật (trong trang, dùng performance.now)
    const q = async (text) => lp.evaluate(async txt => {
      const inp = document.getElementById('q');
      inp.focus(); inp.value = txt;
      const t0 = performance.now();
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      const t1 = performance.now();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { syncMs: t1 - t0, paintMs: performance.now() - t0, cards: document.querySelectorAll('#cards .card').length };
    }, text);
    out.searchSingle = await q('hợp đồng');
    out.searchNote150 = await q('Note số 150');
    out.searchNone = await q('không có chuỗi này');
    out.searchClear = await q('');
    // gõ thật từng ký tự
    await lp.click('#q');
    const lat = [];
    for (const ch of 'khách hàng') {
      const t1 = Date.now(); await lp.keyboard.type(ch);
      await lp.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      lat.push(Date.now() - t1);
    }
    out.typeSearchMedianMs = U.median(lat); out.typeSearchMaxMs = Math.max(...lat);
    out.mainLag = await U.lagRead(app);
    await app.shot('perf-200-note');
    U.record('200-note', out);
    assert.ok(out.cardsAtOpen > 0);
  });
});
