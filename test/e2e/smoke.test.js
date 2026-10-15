'use strict';
// Khói: app mở được, lần đầu có 2 note mẫu, chụp ảnh.
const test = require('node:test');
const assert = require('node:assert');
const { withApp, waitFor } = require('./lib/app');

test('khói: mở app lần đầu có 2 note mẫu', { timeout: 60000 }, async () => {
  await withApp('smoke', { waitNotes: 2 }, async app => {
    const notes = await app.notes();
    assert.strictEqual(notes.length, 2);
    const p = await app.noteWindow();
    await p.waitForLoadState('domcontentloaded');
    await waitFor(() => p.evaluate(() => document.body.innerText.length > 0));
    await app.shot('smoke-lan-dau');
  });
});

test('khói: phím tắt Ctrl+Alt+N và menu khay hoạt động qua hook', { timeout: 60000 }, async () => {
  await withApp('smoke-hook', { waitNotes: 2 }, async app => {
    await app.shortcut('Ctrl+Alt+N');
    await waitFor(async () => (await app.notes()).length === 3, { msg: 'note thứ 3' });
    const labels = await app.trayLabels();
    assert.ok(labels.includes('Ẩn tất cả note'), labels.join('|'));
  });
});
