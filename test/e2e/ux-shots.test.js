'use strict';
// QA nhóm ux: chụp tự động các màn hình để rà trải nghiệm bằng mắt (ảnh vào test/e2e/out/ux-*.png).
// Test chỉ kiểm "chụp được + cửa sổ có mặt"; phần đánh giá là xem ảnh (docs/rooms/qa/findings/ux.md).
const test = require('node:test');
const assert = require('node:assert');
const { withApp, waitFor, sleep, OUT } = require('./lib/app');
const path = require('path');

const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const now = Date.now();
const mkNote = (id, text, o = {}) => Object.assign({
  id, html: '<div>' + text + '</div>', text, color: 'yellow',
  bounds: { x: 100, y: 120, width: 300, height: 220 }, visible: true, alwaysOnTop: false,
  reminder: null, createdAt: now - 1000, updatedAt: now - 1000
}, o);
const QUIET = { mascotEnabled: false, mascotIdle: false, sound: false, glass: false, startup: false, allHidden: false };
const pshot = async (p, name) => p.screenshot({ path: path.join(OUT, 'ux-' + name + '.png') });
const loaded = async p => { await p.waitForLoadState('domcontentloaded'); await sleep(700); };

test('ux-1: lần đầu (2 note mẫu) chờ 3s', { timeout: 90000 }, async () => {
  await withApp('ux-1', { waitNotes: 2 }, async app => {
    const p = await app.noteWindow(); await loaded(p);
    await sleep(3000);
    await app.shot('ux-01-lan-dau');
    assert.ok(app.windows().length >= 2);
  });
});

test('ux-2: chip nhắc + menu "..." + thanh định dạng + popup nhắc', { timeout: 90000 }, async () => {
  const seed = { notes: [mkNote('n1', 'Họp với khách lúc 15h chiều mai, nhớ mang hợp đồng và laptop', {
    reminder: { due: now + 26 * 3600000, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false } })], settings: QUIET };
  await withApp('ux-2', { seed, waitNotes: 1 }, async app => {
    const p = await app.noteWindow(); await loaded(p);
    await app.shot('ux-02-chip-nhac'); await pshot(p, '02-chip-nhac-win');
    await p.click('#editor'); await p.keyboard.press('Control+A');
    await app.shot('ux-03-thanh-dinh-dang'); await pshot(p, '03-thanh-dinh-dang-win');
    await p.click('#btnMenu'); await sleep(400);
    await app.shot('ux-04-menu'); await pshot(p, '04-menu-win');
    await p.keyboard.press('Escape'); await sleep(200);
    await p.click('#editor'); await p.keyboard.press('Control+A'); await sleep(200);
    await p.click('#btnHl').catch(() => {}); await sleep(300);
    await pshot(p, '05-to-sang-win');
    await p.keyboard.press('Escape'); await sleep(200);
    await p.click('#editor'); await sleep(200);
    await p.click('#btnRem').catch(() => {}); await sleep(400);
    await pshot(p, '06-panel-nhac-win'); await app.shot('ux-06-panel-nhac');
  });
});

test('ux-3: 7 màu note (chữ đọc được không)', { timeout: 90000 }, async () => {
  const notes = COLORS.map((c, i) => mkNote('c_' + c, 'Màu ' + c + ': Đi chợ mua rau, gọi anh Nam 0912345678, họp 9h sáng thứ 2', {
    color: c, html: '<div>Màu ' + c + ': Đi chợ mua rau</div><div><b>Đậm</b> <i>nghiêng</i> <u>gạch chân</u></div><ul><li>Họp 9h sáng</li><li>Gọi anh Nam</li></ul><div><mark>Tô sáng</mark></div>',
    bounds: { x: 20 + (i % 4) * 340, y: 30 + Math.floor(i / 4) * 300, width: 320, height: 270 } }));
  await withApp('ux-3', { seed: { notes, settings: QUIET }, waitNotes: 7 }, async app => {
    await sleep(1500);
    await app.shot('ux-07-bay-mau');
    for (const c of COLORS) {
      const p = await app.noteWindow('c_' + c); await pshot(p, '07-mau-' + c);
    }
    // contrast chữ/nền theo CSS
    const p = await app.noteWindow('c_charcoal');
    const cs = await p.evaluate(() => { const e = document.getElementById('editor'); const s = getComputedStyle(e); const n = getComputedStyle(document.getElementById('note')); return { color: s.color, bg: n.backgroundColor, bodybg: getComputedStyle(document.body).backgroundColor }; });
    console.log('charcoal css', JSON.stringify(cs));
  });
});

test('ux-4: cửa sổ danh sách mọi tab + cài đặt + dữ liệu + form báo thức', { timeout: 120000 }, async () => {
  await withApp('ux-4', { seed: { notes: [mkNote('a', 'Họp với khách', { color: 'green' }), mkNote('b', 'Đi chợ mua rau', { color: 'pink', bounds: { x: 500, y: 120, width: 300, height: 220 } })], settings: QUIET }, waitNotes: 2 }, async app => {
    const l = await app.openList(); await loaded(l);
    await pshot(l, '10-list-note');
    await l.click('#tabAlarms'); await sleep(500); await pshot(l, '11-list-baothuc');
    await l.click('#alAdd').catch(() => {}); await sleep(600); await pshot(l, '12-form-baothuc');
    await l.keyboard.press('Escape'); await sleep(300);
    await l.click('#tabMemos'); await sleep(500); await pshot(l, '13-list-dando');
    await l.click('#tabNote'); await sleep(300);
    await l.click('#btnSettings'); await sleep(500); await pshot(l, '14-caidat');
    for (const [i, y] of [[1, 450], [2, 900], [3, 1350], [4, 99999]]) {
      await l.evaluate(v => { const s = document.querySelector('#panel .panel-body'); if (s) { s.style.scrollBehavior = 'auto'; s.scrollTop = v; } }, y);
      await sleep(300); await pshot(l, '15-caidat-cuon' + i);
    }
    await app.shot('ux-10-list-full');
  });
});

test('ux-5: chuông ring.html cùng bé lên sân khấu', { timeout: 90000 }, async () => {
  await withApp('ux-5', { env: { MOCHI_DEV_RING: '1' }, waitNotes: 2 }, async app => {
    await sleep(2500);
    for (let i = 0; i < 6; i++) { await sleep(1500); await app.shot('ux-20-chuong-' + i); }
    const r = app.pages('ring.html');
    if (r[0]) await pshot(r[0], '20-chuong-win');
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop().slice(0, 30), b: w.getBounds(), vis: w.isVisible(), top: w.isAlwaysOnTop() })));
    console.log('windows', JSON.stringify(wins));
  });
});

test('ux-6: popup dặn dò cùng bé', { timeout: 90000 }, async () => {
  await withApp('ux-6', { env: { MOCHI_DEV_MEMO: '1' }, waitNotes: 2 }, async app => {
    await sleep(3500);
    for (let i = 0; i < 3; i++) { await sleep(1500); await app.shot('ux-30-dando-' + i); }
    const m = app.pages('memo.html'); if (m[0]) await pshot(m[0], '30-dando-win');
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop().slice(0, 30), b: w.getBounds(), vis: w.isVisible() })));
    console.log('windows', JSON.stringify(wins));
  });
});

test('ux-7: bé nhắc note (due = now+3s)', { timeout: 90000 }, async () => {
  const seed = { notes: [mkNote('n1', 'Gọi điện cho khách hàng', { bounds: { x: 100, y: 120, width: 300, height: 220 },
    reminder: { due: Date.now() + 5000, lead: 0, intent: 'call', auto: true, preFired: false, fired: false, done: false } })], settings: Object.assign({}, QUIET, { mascotEnabled: true }) };
  await withApp('ux-7', { seed, waitNotes: 1 }, async app => {
    await app.main((c) => { const n = c.store.data.notes[0]; n.reminder.due = Date.now() + 3000; return true; });
    for (let i = 0; i < 8; i++) { await sleep(1200); await app.shot('ux-40-nhac-' + i); }
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop().slice(0, 30), b: w.getBounds(), vis: w.isVisible() })));
    console.log('windows', JSON.stringify(wins));
  });
});

test('ux-8: note cỡ nhỏ nhất 220x160', { timeout: 90000 }, async () => {
  const seed = { notes: [mkNote('nhoA', 'Họp với khách lúc 15h chiều mai, mang hợp đồng', { bounds: { x: 100, y: 100, width: 220, height: 160 },
    reminder: { due: now + 26 * 3600000, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false } }),
    mkNote('nhoB', 'Note nhỏ không nhắc', { bounds: { x: 400, y: 100, width: 220, height: 160 }, color: 'charcoal' })], settings: QUIET };
  await withApp('ux-8', { seed, waitNotes: 2 }, async app => {
    await sleep(1000);
    const p = await app.noteWindow('nhoA'); await pshot(p, '50-nho-win'); await app.shot('ux-50-nho');
    await p.click('#btnMenu'); await sleep(400); await pshot(p, '51-nho-menu'); await app.shot('ux-51-nho-menu');
    await p.keyboard.press('Escape');
    await p.click('#editor'); await sleep(200);
    await p.click('#btnRem').catch(() => {}); await sleep(400); await pshot(p, '52-nho-panel'); await app.shot('ux-52-nho-panel');
  });
});
