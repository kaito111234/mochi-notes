'use strict';
// Nhóm note-persist: tạo note, gõ tiếng Việt, lưu/khôi phục, note mẫu, cất note.
const test = require('node:test');
const assert = require('node:assert');
const { launch, withApp, waitFor, sleep } = require('./lib/app');

const idOf = p => new URL(p.url()).searchParams.get('id');
const edText = p => p.evaluate(() => document.getElementById('editor').innerText);
const bounds = (app, id) => app.main((c, e, i) => { const w = c.windows.notes.get(i); return w ? w.getBounds() : null; }, id);
async function noteByNew(app, before) {
  const pg = await waitFor(() => app.pages('note.html').find(p => !before.includes(idOf(p))), { msg: 'cửa sổ note mới' });
  await pg.waitForLoadState('domcontentloaded');
  return pg;
}
// mở note mới sạch (bằng shortcut), chờ editor sẵn sàng rồi CLICK vào editor (như người dùng phải làm
// vì app không tự focus — xem F-note-persist-1; test 1a/1b kiểm riêng việc tự focus)
async function freshNote(app) {
  const before = app.pages('note.html').map(idOf);
  await app.shortcut('Ctrl+Alt+N');
  const pg = await noteByNew(app, before);
  await waitFor(() => pg.evaluate(() => document.getElementById('editor').getAttribute('contenteditable') === 'true'), { msg: 'editor sẵn sàng' });
  await pg.click('#editor');
  await waitFor(() => pg.evaluate(() => document.activeElement && document.activeElement.id === 'editor'), { msg: 'focus editor sau click' });
  return pg;
}
async function freshNoteNoClick(app) {
  const before = app.pages('note.html').map(idOf);
  await app.shortcut('Ctrl+Alt+N');
  const pg = await noteByNew(app, before);
  await waitFor(() => pg.evaluate(() => document.getElementById('editor').getAttribute('contenteditable') === 'true'), { msg: 'editor sẵn sàng' });
  return pg;
}
const savedNote = async (app, id) => (await app.notes()).find(n => n.id === id);
const sanitizeText = s => s.replace(/ /g, ' ').replace(/\n+$/, '');

// ---------- 1. Tạo note ----------
test('1a. Ctrl+Alt+N tạo note mới, focus vào vùng soạn', { timeout: 60000 }, async () => {
  await withApp('np-1a', { waitNotes: 2 }, async app => {
    const n0 = (await app.notes()).length;
    const pg = await freshNoteNoClick(app);
    assert.strictEqual((await app.notes()).length, n0 + 1);
    await sleep(800);
    assert.ok(await pg.evaluate(() => document.activeElement.id === 'editor'), 'editor không được focus: activeElement=' + await pg.evaluate(() => document.activeElement.tagName));
    // gõ được ngay không cần click
    await pg.keyboard.type('abc');
    assert.strictEqual(sanitizeText(await edText(pg)), 'abc');
  });
});

test('1b. nút "+" trên thanh tiêu đề tạo note mới, lệch vị trí note gọi, focus vào soạn', { timeout: 60000 }, async () => {
  await withApp('np-1b', { waitNotes: 2 }, async app => {
    const src = await app.page('note.html');
    const srcId = idOf(src);
    const before = app.pages('note.html').map(idOf);
    const b0 = await bounds(app, srcId);
    await src.click('#btnNew');
    const pg = await noteByNew(app, before);
    const nid = idOf(pg);
    await sleep(800);
    const focused = await pg.evaluate(() => document.activeElement && document.activeElement.id === 'editor');
    const b1 = await waitFor(() => bounds(app, nid), { msg: 'bounds note mới' });
    assert.ok(b1.x !== b0.x || b1.y !== b0.y, `note mới trùng vị trí: ${JSON.stringify(b0)} vs ${JSON.stringify(b1)}`);
    assert.ok(Math.abs(b1.x - b0.x) >= 16 || Math.abs(b1.y - b0.y) >= 16, 'lệch quá ít: ' + JSON.stringify([b0, b1]));
    assert.ok(focused, 'note mới tạo bằng nút "+" không focus vào vùng soạn');
  });
});

test('1c. tạo nhiều note bằng Ctrl+Alt+N: vị trí không trùng nhau', { timeout: 60000 }, async () => {
  await withApp('np-1c', { waitNotes: 2 }, async app => {
    for (let i = 0; i < 3; i++) await freshNote(app);
    const bs = await app.main(c => [...c.windows.notes.values()].map(w => { const b = w.getBounds(); return b.x + ',' + b.y; }));
    assert.strictEqual(new Set(bs).size, bs.length, 'trùng vị trí: ' + bs.join(' | '));
  });
});

// ---------- 2. Gõ tiếng Việt ----------
const VN = 'Đi chợ mua rau muống, cá rô; nhớ trả tiền điện';
async function lastSaved(app, id, expectText, to = 6000) {
  return waitFor(async () => { const n = await savedNote(app, id); return n && sanitizeText(n.text) === expectText ? n : null; }, { timeout: to, msg: 'lưu đúng text ' + JSON.stringify(expectText) });
}

test('2a. gõ Unicode dựng sẵn bằng keyboard.type, lưu đúng', { timeout: 60000 }, async () => {
  await withApp('np-2a', { waitNotes: 2 }, async app => {
    const pg = await freshNote(app); const id = idOf(pg);
    await pg.keyboard.type(VN);
    assert.strictEqual(sanitizeText(await edText(pg)), VN);
    const n = await lastSaved(app, id, VN);
    assert.ok(n.html.includes(VN.replace(/;/, ';')) , 'html: ' + n.html);
  });
});

test('2b. dán chuỗi dựng sẵn (NFC) và tổ hợp (NFD)', { timeout: 60000 }, async () => {
  await withApp('np-2b', { waitNotes: 2 }, async app => {
    const nfc = 'Việt Nam đẹp lắm, ơn trời';
    const nfd = nfc.normalize('NFD');
    assert.notStrictEqual(nfc, nfd);
    const pg = await freshNote(app); const id = idOf(pg);
    await app.main((c, e, t) => e.clipboard.writeText(t), nfc);
    await pg.keyboard.press('Control+V');
    await sleep(200);
    await pg.keyboard.press('Enter');
    await app.main((c, e, t) => e.clipboard.writeText(t), nfd);
    await pg.keyboard.press('Control+V');
    await waitFor(async () => { const n = await savedNote(app, id); return n && n.text.includes('\n') && n.text.replace(/\s+$/, '').split('\n').length >= 2; }, { msg: 'lưu 2 dòng' });
    const n = await savedNote(app, id);
    const lines = n.text.split('\n').map(s => s.replace(/ /g, ' ').trim()).filter(Boolean);
    assert.strictEqual(lines.length, 2, JSON.stringify(n.text));
    assert.strictEqual(lines[0], nfc, 'dòng NFC');
    assert.strictEqual(lines[1].normalize('NFC'), nfc, 'dòng NFD (so sau chuẩn hoá NFC)');
    assert.strictEqual(lines[1], nfd, 'NFD nên được giữ nguyên, không mất/nhân đôi dấu');
  });
});

test('2c. giả lập IME Telex: insertText từng đoạn', { timeout: 60000 }, async () => {
  await withApp('np-2c', { waitNotes: 2 }, async app => {
    const pg = await freshNote(app); const id = idOf(pg);
    for (const seg of ['Xin ', 'chào', ' các ', 'bạn', ', ', 'Việt', ' Nam']) await pg.keyboard.insertText(seg);
    const want = 'Xin chào các bạn, Việt Nam';
    assert.strictEqual(sanitizeText(await edText(pg)), want);
    await lastSaved(app, id, want);
  });
});

test('2d. giả lập Telex kiểu thay thế ký tự: "a" -> Backspace -> "á", "o" -> "ô" -> "ộ"', { timeout: 60000 }, async () => {
  await withApp('np-2d', { waitNotes: 2 }, async app => {
    const pg = await freshNote(app); const id = idOf(pg);
    await pg.keyboard.type('c');
    await pg.keyboard.type('a'); await pg.keyboard.press('Backspace'); await pg.keyboard.insertText('á');
    await pg.keyboard.type('m ');
    await pg.keyboard.type('o'); await pg.keyboard.press('Backspace'); await pg.keyboard.insertText('ô');
    await pg.keyboard.press('Backspace'); await pg.keyboard.insertText('ộ');
    await pg.keyboard.type('n');
    const want = 'cám ộn';
    assert.strictEqual(sanitizeText(await edText(pg)), want);
    await lastSaved(app, id, want);
  });
});

test('2e. gõ dài rồi đóng app: không nhân đôi/mất ký tự sau khi mở lại', { timeout: 90000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  let app2;
  try {
    const pg = await freshNote(app); const id = idOf(pg);
    const txt = 'Ừ thì mưa, đường ướt; ăn phở bò tái nạm gầu 3 tô.';
    await pg.keyboard.type(txt);
    await lastSaved(app, id, txt);
    await app.close();
    app2 = await launch({ configHome: app.configHome, waitNotes: 3 });
    const pg2 = await app2.noteWindow(id);
    await waitFor(async () => sanitizeText(await edText(pg2)) === txt, { msg: 'nội dung khi mở lại' });
    const n = (await app2.notes()).find(x => x.id === id);
    assert.strictEqual(sanitizeText(n.text), txt);
  } finally { await app.close(); if (app2) await app2.close(); }
});

// ---------- 3. Lưu / khôi phục ----------
test('3a. đổi màu (menu "..." -> ô màu), di chuyển, đổi cỡ, đóng app, mở lại: còn nguyên', { timeout: 90000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  let app2;
  try {
    const pg = await freshNote(app); const id = idOf(pg);
    const txt = 'Nhớ họp lúc 9 giờ sáng mai nhé';
    await pg.keyboard.type(txt);
    // Cách làm: bấm #btnMenu rồi bấm ô màu .sw[data-color=blue]
    await pg.click('#btnMenu');
    await pg.click('.sw[data-color="blue"]');
    await waitFor(async () => (await savedNote(app, id)).color === 'blue', { msg: 'màu blue được lưu' });
    assert.strictEqual(await pg.evaluate(() => document.body.dataset.color), 'blue');
    await pg.keyboard.press('Escape');
    await app.main((c, e, i) => { c.windows.notes.get(i).setBounds({ x: 123, y: 87, width: 410, height: 333 }); }, id);
    await waitFor(async () => { const b = (await savedNote(app, id)).bounds; return b && b.x === 123 && b.width === 410; }, { msg: 'bounds được lưu (debounce)' });
    await lastSaved(app, id, txt);
    await app.close();
    app2 = await launch({ configHome: app.configHome, waitNotes: 3 });
    const pg2 = await app2.noteWindow(id);
    await waitFor(async () => sanitizeText(await edText(pg2)) === txt, { msg: 'nội dung' });
    const b = await bounds(app2, id);
    assert.deepStrictEqual([b.x, b.y, b.width, b.height], [123, 87, 410, 333]);
    assert.strictEqual(await pg2.evaluate(() => document.body.dataset.color), 'blue');
    assert.strictEqual((await app2.notes()).find(n => n.id === id).color, 'blue');
  } finally { await app.close(); if (app2) await app2.close(); }
});

test('3b. kill (SIGKILL) ~1s sau khi gõ: đo số chữ mất', { timeout: 90000 }, async () => {
  const res = {};
  for (const wait of [200, 1000, 2500]) {
    const app = await launch({ waitNotes: 2 });
    let app2;
    try {
      const pg = await freshNote(app); const id = idOf(pg);
      const txt = 'Ghi nhanh trước khi mất điện';
      // chờ note mới được ghi xuống đĩa trước, để đo riêng phần chữ gõ
      await waitFor(() => { try { return app.readData().notes.some(n => n.id === id); } catch (_) { return false; } }, { msg: 'note mới ghi đĩa' });
      await sleep(700);
      await pg.keyboard.type(txt);
      await sleep(wait);
      await app.kill();
      app2 = await launch({ configHome: app.configHome });
      await sleep(500);
      const n = app2.readData().notes.find(x => x.id === id);
      const got = n ? sanitizeText(n.text || '') : '';
      res[wait] = { gõ: txt.length, còn: got.length, mất: txt.length - got.length, got };
    } finally { await app.close(); if (app2) await app2.close(); }
  }
  console.log('SỐ LIỆU kill:', JSON.stringify(res));
  assert.strictEqual(res[2500].mất, 0, 'mất dữ liệu đã gõ >2s trước khi kill: ' + JSON.stringify(res[2500]));
});

// ---------- 4. Note mẫu ----------
test('4. lần chạy đầu: note vàng hướng dẫn có nội dung (cả trong dữ liệu lẫn hiển thị)', { timeout: 60000 }, async () => {
  await withApp('np-4', { waitNotes: 2 }, async app => {
    const notes = await app.notes();
    const y = notes.find(n => n.color === 'yellow');
    assert.ok(y, 'không có note vàng');
    assert.ok(y.text && y.text.includes('Ctrl+Alt+N'), 'text dữ liệu: ' + JSON.stringify(y.text));
    const pg = await app.noteWindow(y.id);
    await pg.waitForLoadState('domcontentloaded');
    // chờ tối đa 5s: nếu lúc đầu trống mà sau đó có -> chụp sớm; nếu mãi trống -> lỗi thật
    const t0 = Date.now();
    let firstFilledAt = null;
    while (Date.now() - t0 < 5000) {
      const t = await edText(pg);
      if (t.includes('Chào bạn')) { firstFilledAt = Date.now() - t0; break; }
      await sleep(100);
    }
    await app.shot('np-4-note-mau');
    assert.notStrictEqual(firstFilledAt, null, 'editor trống sau 5s; innerHTML=' + await pg.evaluate(() => document.getElementById('editor').innerHTML.slice(0, 200)));
    console.log('Note mẫu hiện chữ sau (ms từ domcontentloaded):', firstFilledAt);
    const txt = await edText(pg);
    assert.ok(txt.includes('Ctrl+Alt+N') && txt.includes('Ctrl+Alt+M'), txt);
    // placeholder không được hiện
    assert.ok(!(await pg.evaluate(() => document.getElementById('editor').classList.contains('empty'))), 'editor còn class empty');
  });
});

// ---------- 5. Đóng note ----------
test('5. nút X cất note (visible=false, không xoá); mở lại app không hiện note đã cất', { timeout: 90000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  let app2;
  try {
    const pg = await freshNote(app); const id = idOf(pg);
    await pg.keyboard.type('Note sắp cất');
    await lastSaved(app, id, 'Note sắp cất');
    const n0 = (await app.notes()).length;
    await pg.click('#btnClose');
    await waitFor(async () => (await savedNote(app, id)).visible === false, { msg: 'visible=false' });
    const notes = await app.notes();
    assert.strictEqual(notes.length, n0, 'note bị xoá thay vì cất');
    assert.strictEqual(sanitizeText((await savedNote(app, id)).text), 'Note sắp cất');
    await waitFor(() => !app.pages('note.html').some(p => idOf(p) === id), { msg: 'cửa sổ đóng' });
    await app.close();
    app2 = await launch({ configHome: app.configHome, waitNotes: 2 });
    await sleep(1500);
    assert.ok(!app2.pages('note.html').some(p => idOf(p) === id), 'note đã cất vẫn hiện khi mở lại');
    const n = (await app2.notes()).find(x => x.id === id);
    assert.ok(n && n.visible === false, 'note đã cất mất/đổi trạng thái sau khi mở lại');
  } finally { await app.close(); if (app2) await app2.close(); }
});
