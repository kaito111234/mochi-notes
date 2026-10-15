'use strict';
// QA nhóm list: ẩn/hiện tất cả, cất/mở, xoá, tìm, cập nhật trực tiếp, single instance.
const test = require('node:test');
const assert = require('node:assert');
const { launch, withApp, waitFor, sleep } = require('./lib/app');

const now = Date.now();
const mk = (id, text, o = {}) => Object.assign({
  id, html: '<div>' + text + '</div>', text, color: 'yellow',
  bounds: { x: 100 + (o.dx || 0), y: 120, width: 300, height: 220 },
  visible: true, alwaysOnTop: false, reminder: null, createdAt: now - 1000, updatedAt: now - 1000
}, o);
const seed = () => ({
  notes: [
    mk('n_hop', 'Họp với khách', { bounds: { x: 120, y: 140, width: 310, height: 230 }, updatedAt: now - 1 }),
    mk('n_cho', 'Đi chợ mua rau', { color: 'green', bounds: { x: 520, y: 160, width: 300, height: 220 }, updatedAt: now - 2 }),
    mk('n_abc', 'Ghi chú khác', { color: 'pink', bounds: { x: 900, y: 180, width: 300, height: 220 }, updatedAt: now - 3 })
  ],
  settings: { mascotEnabled: false, mascotIdle: false, sound: false, glass: false, startup: false, allHidden: false }
});
const titles = p => p.$$eval('#cards .card .card-title', els => els.map(e => e.textContent));
const noteWins = app => app.pages('note.html').length;

test('list-1a: Ctrl+Alt+H ẩn/hiện tất cả', { timeout: 90000 }, async () => {
  await withApp('list-1a', { seed: seed(), waitNotes: 3 }, async app => {
    await app.shortcut('Ctrl+Alt+H');
    await waitFor(async () => (await app.main(c => c.settings().allHidden)) === true, { msg: 'allHidden=true' });
    await waitFor(() => noteWins(app) === 0, { msg: 'mọi note đóng' });
    await app.shortcut('Ctrl+Alt+H');
    await waitFor(() => noteWins(app) === 3, { msg: '3 note hiện lại' });
    assert.strictEqual(await app.main(c => c.settings().allHidden), false);
  });
});

test('list-1b: menu khay Ẩn/Hiện tất cả note', { timeout: 90000 }, async () => {
  await withApp('list-1b', { seed: seed(), waitNotes: 3 }, async app => {
    assert.ok(await app.trayClick('Ẩn tất cả note'));
    await waitFor(() => noteWins(app) === 0, { msg: 'mọi note đóng' });
    assert.strictEqual(await app.main(c => c.settings().allHidden), true);
    assert.ok(await app.trayClick('Hiện tất cả note'));
    await waitFor(() => noteWins(app) === 3, { msg: '3 note hiện lại' });
    assert.strictEqual(await app.main(c => c.settings().allHidden), false);
  });
});

test('list-1c: ẩn hết -> thoát -> mở lại vẫn ẩn', { timeout: 120000 }, async () => {
  const app = await launch({ seed: seed(), waitNotes: 3 });
  let app2;
  try {
    await app.shortcut('Ctrl+Alt+H');
    await waitFor(() => noteWins(app) === 0, { msg: 'đóng hết' });
    await app.close();
    assert.strictEqual(app.readData().settings.allHidden, true, 'allHidden phải lưu trong file');
    app2 = await launch({ configHome: app.configHome });
    await sleep(4000);
    assert.strictEqual(noteWins(app2), 0, 'mở lại phải vẫn ẩn hết');
    assert.strictEqual(await app2.main(c => c.settings().allHidden), true);
    await app2.shortcut('Ctrl+Alt+H');
    await waitFor(() => noteWins(app2) === 3, { msg: 'hiện lại 3 note' });
  } catch (e) { await (app2 || app).shot('list-1c-LOI'); throw e; }
  finally { await app.close(); if (app2) await app2.close(); }
});

test('list-2: cất bằng nút X, mở từ danh sách -> đúng vị trí cũ', { timeout: 90000 }, async () => {
  await withApp('list-2', { seed: seed(), waitNotes: 3 }, async app => {
    const p = await app.noteWindow('n_hop');
    await p.waitForLoadState('domcontentloaded');
    await p.click('#btnClose');
    await waitFor(() => noteWins(app) === 2, { msg: 'note đóng' });
    const n = (await app.notes()).find(x => x.id === 'n_hop');
    assert.strictEqual(n.visible, false);
    const bBefore = n.bounds;
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).includes('Họp với khách'), { msg: 'vẫn có trong danh sách' });
    await lp.click('.card[data-id="n_hop"] .card-body');
    await app.page('note.html?id=n_hop');
    await waitFor(() => noteWins(app) === 3);
    const b = await app.main(c => { const w = c.windows.notes.get('n_hop'); return w.getBounds(); });
    assert.deepStrictEqual({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: bBefore.x, y: bBefore.y, width: bBefore.width, height: bBefore.height });
    assert.strictEqual(bBefore.x, 120, 'vị trí đã lưu phải là vị trí ban đầu');
    assert.strictEqual((await app.notes()).find(x => x.id === 'n_hop').visible, true);
  });
});

test('list-3a: xoá từ danh sách có xác nhận', { timeout: 90000 }, async () => {
  await withApp('list-3a', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    await lp.hover('.card[data-id="n_abc"]');
    await lp.click('.card[data-id="n_abc"] [data-act="ask"]');
    await lp.waitForSelector('.card[data-id="n_abc"] .confirm');
    assert.strictEqual((await app.notes()).length, 3, 'chưa xác nhận thì chưa xoá');
    await lp.click('.card[data-id="n_abc"] [data-act="cancel"]');
    assert.strictEqual((await app.notes()).length, 3);
    await lp.hover('.card[data-id="n_abc"]');
    await lp.click('.card[data-id="n_abc"] [data-act="ask"]');
    await lp.click('.card[data-id="n_abc"] [data-act="delete"]');
    await waitFor(async () => (await app.notes()).length === 2, { msg: 'đã xoá' });
    await waitFor(async () => (await titles(lp)).length === 2);
    await waitFor(() => noteWins(app) === 2);
  });
});

test('list-3b: xoá từ menu note có xác nhận', { timeout: 90000 }, async () => {
  await withApp('list-3b', { seed: seed(), waitNotes: 3 }, async app => {
    const p = await app.noteWindow('n_cho');
    await p.waitForLoadState('domcontentloaded');
    await p.click('#btnMenu');
    await p.click('[data-act="delete"]');
    await p.waitForSelector('#menuConfirm:not([hidden])');
    assert.strictEqual((await app.notes()).length, 3);
    await p.click('[data-act="del-yes"]');
    await waitFor(async () => (await app.notes()).length === 2, { msg: 'đã xoá' });
  });
});

test('list-3c: khôi phục note đã xoá (thùng rác / thùng của bé)', { timeout: 60000 }, async () => {
  const fs = require('fs'), path = require('path');
  const ROOT = path.join(__dirname, '..', '..');
  const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { return ''; } };
  const src = ['src/list/list.js', 'src/list/list.html', 'src/main/notes/noteService.js', 'src/main/store.js', 'src/main/tray.js'].map(read).join('\n');
  const cleaned = src.replace(/Khôi phục (từ bản sao|mục đã chọn)/g, '').replace(/data-data="restore"|t === 'restore'|bkRestore|icon\('trash'\)|trash: '/g, '');
  assert.ok(/thùng|\btrash\b|khôi phục note|deletedNotes|restoreNote/i.test(cleaned),
    'app không có thùng rác / khôi phục note đã xoá (deleteNote splice thẳng, hộp thoại ghi "không khôi phục được")');
});

test('list-4: tìm kiếm không dấu, hoa/thường, đ/d', { timeout: 90000 }, async () => {
  await withApp('list-4', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    const cases = [['hop', 'Họp với khách'], ['Họp', 'Họp với khách'], ['HỌP', 'Họp với khách'], ['HOP', 'Họp với khách'],
      ['đi', 'Đi chợ mua rau'], ['di', 'Đi chợ mua rau'], ['DI CHO', 'Đi chợ mua rau'], ['ĐI', 'Đi chợ mua rau']];
    const fails = [];
    for (const [q, want] of cases) {
      await lp.fill('#q', q);
      await sleep(150);
      const t = await titles(lp);
      if (!t.includes(want)) fails.push(`"${q}" -> [${t.join(', ')}]`);
    }
    await app.shot('list-4-search');
    assert.deepStrictEqual(fails, [], 'tìm sai: ' + fails.join(' ; '));
    await lp.fill('#q', 'zzzz');
    await sleep(150);
    assert.strictEqual((await titles(lp)).length, 0);
    assert.ok(await lp.isVisible('#empty'));
  });
});

test('list-5: danh sách cập nhật trực tiếp khi note đổi nội dung/màu/xoá', { timeout: 90000 }, async () => {
  await withApp('list-5', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    const np = await app.noteWindow('n_abc');
    await np.waitForLoadState('domcontentloaded');
    await np.click('#editor');
    await np.keyboard.press('Control+A');
    await np.keyboard.type('Tiêu đề mới tinh');
    await waitFor(async () => (await titles(lp)).includes('Tiêu đề mới tinh'), { msg: 'nội dung mới hiện ở danh sách' });
    // màu: đổi qua menu note nếu có, nếu không qua IPC thật của main
    await np.click('#btnMenu');
    const sw = await np.$('#menu [data-color="blue"], #menu .sw[data-c="blue"], #menu [data-c="blue"]');
    if (sw) await sw.click(); else await app.main(c => c.notes.updateNote('n_abc', { color: 'blue' }));
    await waitFor(async () => (await app.notes()).find(n => n.id === 'n_abc').color === 'blue');
    await waitFor(async () => (await lp.$eval('.card[data-id="n_abc"]', e => e.style.getPropertyValue('--stripe'))).includes('blue'), { msg: 'màu mới ở danh sách' });
    await lp.keyboard.press('Escape');
    await app.main(c => c.notes.deleteNote('n_cho'));
    await waitFor(async () => (await titles(lp)).length === 2, { msg: 'xoá ở nơi khác -> list cập nhật' });
  });
});

test('list-6: Ctrl+Alt+L mở danh sách, mở lần 2 chỉ 1 cửa sổ', { timeout: 90000 }, async () => {
  await withApp('list-6', { seed: seed(), waitNotes: 3 }, async app => {
    await app.shortcut('Ctrl+Alt+L');
    await app.page('list.html');
    await app.shortcut('Ctrl+Alt+L');
    await app.shortcut('Ctrl+Alt+L');
    await app.main(c => c.list.open());
    await sleep(800);
    assert.strictEqual(app.pages('list.html').length, 1);
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().includes('list.html')).length);
    assert.strictEqual(wins, 1);
  });
});
