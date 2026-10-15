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
    // Đợt 3: nút "Chi tiết" (hiện khi rê chuột) phủ giữa thẻ -> bấm vào TIÊU ĐỀ như người dùng (xem N-list-4)
    await settle(lp, '.card[data-id="n_hop"]');
    await lp.click('.card[data-id="n_hop"] .card-title');
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

// ---- Thùng rác (Đợt 2B): xoá mềm 30 ngày. Luồng người dùng: xoá -> chip "Thùng rác" -> Khôi phục / Xoá hẳn.
const DAY = 86400000;
const seedTrash = () => {
  const d = seed();
  d.notes[0].reminder = { due: Date.now() + 3 * DAY, lead: 0, intent: 'task', auto: false, preFired: false, fired: false, done: false };
  d.notes[0].html = '<div>Họp với khách</div><div>mang <b>hợp đồng</b> theo</div>';
  d.notes[0].text = 'Họp với khách\nmang hợp đồng theo';
  d.notes[0].color = 'blue';
  d.paper = { v: 1, settings: {}, noteMeta: { n_hop: { paper: 'student-grid' } } };
  return d;
};
const trashTitles = p => p.$$eval('#cards .trash-card .card-title', els => els.map(e => e.textContent));
const trashOf = app => app.main(c => JSON.parse(JSON.stringify(c.store.section('trash').items)));
// chờ khung của phần tử đứng yên (2 lần đo liên tiếp trùng nhau) — máy tải nặng thì chuyển động kéo dài
async function settle(lp, sel) {
  let prev = '';
  await waitFor(async () => {
    const b = await lp.evaluate(s => { const e = document.querySelector(s); if (!e) return ''; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }, sel);
    const ok = b && b === prev; prev = b; if (!ok) await sleep(250); return ok;
  }, { timeout: 20000, interval: 150, msg: 'danh sách đứng yên' });
}
async function deleteFromList(lp, id) {
  await sleep(700);   // chờ danh sách ngừng chuyển động sau lần xoá trước
  await settle(lp, '.card[data-id="' + id + '"]');
  await lp.hover('.card[data-id="' + id + '"]');
  await lp.click('.card[data-id="' + id + '"] [data-act="ask"]');
  await lp.click('.card[data-id="' + id + '"] [data-act="delete"]');
}

test('list-3c: xoá note -> vào thùng rác -> khôi phục: về đủ nội dung, màu, mẫu giấy, nhắc', { timeout: 120000 }, async () => {
  await withApp('list-3c', { seed: seedTrash(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    const before = (await app.notes()).find(n => n.id === 'n_hop');
    await deleteFromList(lp, 'n_hop');
    await waitFor(async () => (await app.notes()).length === 2, { msg: 'note ra khỏi danh sách chính' });
    await waitFor(() => noteWins(app) === 2, { msg: 'cửa sổ note đóng' });
    assert.strictEqual((await trashOf(app)).length, 1, 'phải nằm trong thùng (xoá mềm)');
    // chip Thùng rác có số 1 và mở ra thấy note
    await waitFor(async () => (await lp.textContent('[data-f="trash"] .n')) === '1', { msg: 'chip Thùng rác (1)' });
    await lp.click('[data-f="trash"]');
    await waitFor(async () => (await trashTitles(lp)).includes('Họp với khách'), { msg: 'note hiện trong thùng' });
    await app.shot('l2-list-thung-rac');
    // khôi phục
    await lp.click('.trash-card[data-id="n_hop"] [data-act="trestore"]');
    await waitFor(async () => (await app.notes()).some(n => n.text === before.text), { msg: 'note quay về' });
    await waitFor(() => noteWins(app) === 3, { msg: 'cửa sổ note mở lại' });
    const after = (await app.notes()).find(n => n.text === before.text);
    assert.strictEqual(after.html, before.html, 'nội dung/định dạng phải đủ');
    assert.strictEqual(after.color, 'blue');
    assert.ok(after.reminder && after.reminder.due === before.reminder.due, 'nhắc còn nguyên: ' + JSON.stringify(after.reminder));
    assert.strictEqual((await trashOf(app)).length, 0, 'thùng hết');
    // mẫu giấy: ngăn paper còn meta cho id của note khôi phục, và cửa sổ note áp mẫu đó
    const meta = await app.main((c, e, id) => { const b = c.store.section('paper'); return b && b.noteMeta[id] ? b.noteMeta[id] : null; }, after.id);
    assert.ok(meta && meta.paper === 'student-grid', 'mất mẫu giấy sau khi khôi phục: ' + JSON.stringify(meta));
    const np = await app.noteWindow(after.id);
    await np.waitForLoadState('domcontentloaded');
    await waitFor(async () => (await np.evaluate(() => document.body.getAttribute('data-paper'))) === 'student-grid', { msg: 'cửa sổ note áp mẫu ô ly/kẻ ô' });
    await waitFor(async () => (await np.evaluate(() => document.getElementById('editor').innerText)).includes('hợp đồng'), { msg: 'chữ hiện' });
  });
});

test('list-3d: xoá hẳn khỏi thùng cần xác nhận 2 bước; dọn sạch', { timeout: 120000 }, async () => {
  await withApp('list-3d', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    await deleteFromList(lp, 'n_abc');
    await waitFor(async () => (await trashOf(app)).length === 1);
    await deleteFromList(lp, 'n_cho');
    await waitFor(async () => (await trashOf(app)).length === 2);
    await lp.click('[data-f="trash"]');
    await waitFor(async () => (await trashTitles(lp)).length === 2, { msg: '2 note trong thùng' });
    // bấm "Xoá hẳn" 1 lần: chưa xoá
    await lp.click('.trash-card[data-id="n_abc"] [data-act="tpurge"]');
    await sleep(400);
    assert.strictEqual((await trashOf(app)).length, 2, 'bấm 1 lần chưa được xoá hẳn');
    assert.ok(/Chắc chắn/.test(await lp.textContent('.trash-card[data-id="n_abc"] [data-act="tpurge"]')), 'phải hỏi lại');
    await lp.click('.trash-card[data-id="n_abc"] [data-act="tpurge"]');
    await waitFor(async () => (await trashOf(app)).length === 1, { msg: 'xoá hẳn 1 note' });
    assert.ok(!(await app.notes()).some(n => n.id === 'n_abc'), 'không quay lại danh sách chính');
    // dọn sạch: 2 bước
    await lp.click('[data-tact="empty"]');
    await sleep(300);
    assert.strictEqual((await trashOf(app)).length, 1);
    await lp.click('[data-tact="empty"]');
    await waitFor(async () => (await trashOf(app)).length === 0, { msg: 'dọn sạch' });
    await waitFor(() => lp.isVisible('#empty'), { msg: 'trạng thái thùng trống' });
  });
});

test('list-3e: thùng rác còn sau khi khởi động lại (nằm trong mochi-data.json) và khôi phục được', { timeout: 150000 }, async () => {
  const app = await launch({ seed: seedTrash(), waitNotes: 3 });
  let app2;
  try {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    await deleteFromList(lp, 'n_cho');
    await deleteFromList(lp, 'n_hop');
    await waitFor(async () => (await trashOf(app)).length === 2);
    await app.close();
    const saved = app.readData();
    assert.ok(saved.trash && saved.trash.items.length === 2, 'ngăn trash trong mochi-data.json: ' + JSON.stringify(saved.trash && saved.trash.items.length));
    assert.ok(saved.trash.items.every(i => i.trashedAt > 0 && i.note && i.note.html));
    app2 = await launch({ configHome: app.configHome });
    await waitFor(async () => (await app2.main(c => c.store.section('trash').items.length)) === 2, { msg: 'thùng còn sau mở lại' });
    assert.strictEqual((await app2.notes()).length, 1);
    const lp2 = await app2.openList();
    await waitFor(() => lp2.isVisible('[data-f="trash"]'));
    await lp2.click('[data-f="trash"]');
    await waitFor(async () => (await trashTitles(lp2)).length === 2, { msg: 'thấy 2 note trong thùng sau mở lại' });
    // khôi phục note có mẫu giấy sau khi khởi động lại
    await lp2.click('.trash-card[data-id="n_hop"] [data-act="trestore"]');
    await waitFor(async () => (await app2.notes()).some(n => n.text.startsWith('Họp với khách')), { msg: 'khôi phục sau restart' });
    const nid = (await app2.notes()).find(n => n.text.startsWith('Họp với khách')).id;
    const np = await app2.noteWindow(nid);
    await np.waitForLoadState('domcontentloaded');
    await waitFor(async () => (await np.evaluate(() => document.body.getAttribute('data-paper'))) === 'student-grid', { msg: 'mẫu giấy còn sau restart + khôi phục' });
  } catch (e) { await (app2 || app).shot('list-3e-LOI'); throw e; }
  finally { await app.close(); if (app2) await app2.close(); }
});

test('list-3g: xoá từ danh sách -> toast "Hoàn tác" đưa note về ngay', { timeout: 90000 }, async () => {
  await withApp('list-3g', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    await deleteFromList(lp, 'n_cho');
    await waitFor(async () => (await trashOf(app)).length === 1);
    await lp.click('#toast .toast-act');
    await waitFor(async () => (await app.notes()).length === 3, { msg: 'Hoàn tác đưa note về' });
    assert.strictEqual((await trashOf(app)).length, 0);
    assert.ok((await app.notes()).some(n => n.text === 'Đi chợ mua rau'));
  });
});

test('list-3f: xoá từ menu note cũng vào thùng rác (chữ xác nhận nói rõ thùng rác)', { timeout: 90000 }, async () => {
  await withApp('list-3f', { seed: seed(), waitNotes: 3 }, async app => {
    const p = await app.noteWindow('n_cho');
    await p.waitForLoadState('domcontentloaded');
    await p.click('#btnMenu');
    await p.click('[data-act="delete"]');
    await p.waitForSelector('#menuConfirm:not([hidden])');
    const txt = await p.textContent('#menuConfirm');
    await p.click('[data-act="del-yes"]');
    await waitFor(async () => (await trashOf(app)).length === 1, { msg: 'vào thùng rác' });
    assert.ok(/thùng/i.test(txt), 'hộp xác nhận phải nói "thùng rác" (hiện: ' + txt.trim().replace(/\s+/g, ' ') + ')');
  });
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

// Đợt 3 (BUG-027/028): chữ Đang hiện/Đã cất, Cất đi/Hiện lên; giao diện danh sách gọi "bạn", không xưng tớ/cậu
test('list-l3-1: chữ Đang hiện/Đã cất + Cất đi/Hiện lên; giao diện không xưng tớ/cậu', { timeout: 120000 }, async () => {
  await withApp('list-l3-1', { seed: seed(), waitNotes: 3 }, async app => {
    const lp = await app.openList();
    await waitFor(async () => (await titles(lp)).length === 3);
    const chips = await lp.$$eval('#chips .chip', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    assert.ok(chips.some(c => /^Đang hiện 3/.test(c)) && chips.some(c => /^Đã cất 0/.test(c)), 'chip: ' + chips);
    assert.ok(!chips.some(c => /Đang dán|Đang cất/.test(c)), 'còn chữ cũ: ' + chips);
    const lbl = async id => lp.$eval('.card[data-id="' + id + '"] [data-act="hide"], .card[data-id="' + id + '"] [data-act="show"]', e => e.textContent.trim());
    assert.strictEqual(await lbl('n_cho'), 'Cất đi');
    await lp.hover('.card[data-id="n_cho"]');
    await lp.click('.card[data-id="n_cho"] [data-act="hide"]');
    await waitFor(async () => (await app.notes()).find(n => n.id === 'n_cho').visible === false, { msg: 'cất note' });
    await waitFor(async () => /Đã cất 1/.test(await lp.textContent('#chips')), { msg: 'chip Đã cất 1' });
    await waitFor(async () => (await lbl('n_cho')) === 'Hiện lên', { msg: 'nút Hiện lên' });
    await app.shot('list-l3-1');
    const txt = await lp.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[title]')].map(e => e.title).join(' '));
    assert.ok(!/\b(tớ|cậu)\b/i.test(txt), 'giao diện danh sách còn xưng tớ/cậu: ' + (txt.match(/.{0,20}\b(tớ|cậu)\b.{0,20}/i) || [''])[0]);
  });
});
