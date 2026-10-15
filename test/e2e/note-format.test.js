'use strict';
// QA nhóm note-format: định dạng, undo/redo, tìm, dán, cỡ chữ, khoá chỉ đọc trong cửa sổ note thật.
const test = require('node:test');
const assert = require('node:assert');
const { withApp, launch, waitFor, sleep } = require('./lib/app');

// PNG 40x30 đỏ (tạo bằng nativeImage trong main) -> dùng clipboard.writeImage
// xoá sạch bằng thao tác thật và tắt định dạng còn ở con trỏ (note mẫu mở đầu bằng chữ đậm)
async function clearEd(p) {
  await p.keyboard.press('Control+A');
  await p.evaluate(() => document.execCommand('removeFormat'));
  await p.keyboard.press('Delete');
  await p.evaluate(() => { for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) if (document.queryCommandState(c)) document.execCommand(c); });
}
async function openNote(app) {
  const p = await app.noteWindow();
  await p.waitForLoadState('domcontentloaded');
  await waitFor(() => p.evaluate(() => document.getElementById('editor').getAttribute('contenteditable') === 'true'), { msg: 'editor sửa được' });
  const id = new URL(p.url()).searchParams.get('id');
  await p.click('#editor');
  await clearEd(p);
  return { p, id };
}
const html = p => p.evaluate(() => document.getElementById('editor').innerHTML);
const noteHtml = async (app, id) => (await app.notes()).find(n => n.id === id).html;
const savedHtml = async (app, id, re) => { await waitFor(async () => re.test(await noteHtml(app, id) || ''), { msg: 'html lưu khớp ' + re }); return noteHtml(app, id); };

test('1a. định dạng bằng phím tắt: đậm/nghiêng/gạch chân/gạch ngang/danh sách', { timeout: 90000 }, async () => {
  await withApp('nf-1a', { waitNotes: 2 }, async app => {
    const { p, id } = await openNote(app);
    const cases = [['Control+B', /<(b|strong)>/, 'đậm'], ['Control+I', /<(i|em)>/, 'nghiêng'], ['Control+U', /<u>/, 'gạch chân'], ['Control+T', /<(s|strike|del)>/, 'gạch ngang']];
    const bad = [];
    for (const [key, re, name] of cases) {
      await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
      await p.keyboard.type('chu ' + name);
      await p.keyboard.press('Control+A');
      await p.keyboard.press(key);
      const h = await html(p);
      if (!re.test(h)) bad.push(name + ' (' + key + ') -> ' + h);
    }
    await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
    await p.keyboard.type('mot'); await p.keyboard.press('Control+Shift+L');
    if (!/<ul>/.test(await html(p))) bad.push('danh sách Ctrl+Shift+L -> ' + await html(p));
    assert.deepStrictEqual(bad, []);
  });
});

test('1b. định dạng bằng nút thanh công cụ + tô sáng, lưu & còn sau khi mở lại', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  let id, cfg = app.configHome;
  try {
    const o = await openNote(app); const p = o.p; id = o.id;
    await p.keyboard.type('dam');
    await p.keyboard.press('Control+A');
    for (const [cmd, re, name] of [['bold', /<(b|strong)>/, 'Đậm'], ['italic', /<(i|em)>/, 'Nghiêng'], ['underline', /<u>/, 'Gạch chân'], ['strikeThrough', /<(s|strike|del)>/, 'Gạch ngang']]) {
      await p.click(`[data-cmd="${cmd}"]`);
      assert.match(await html(p), re, 'nút ' + name);
      assert.strictEqual(await p.getAttribute(`[data-cmd="${cmd}"]`, 'aria-pressed'), 'true', `nút ${name} phải sáng (aria-pressed)`);
    }
    // tô sáng (chữ thường, không kèm định dạng khác)
    await clearEd(p);
    await p.keyboard.type('sang');
    await p.keyboard.press('Control+A');
    await p.click('#btnHl');
    await p.click('[data-hl="green"]');
    const h = await html(p);
    assert.match(h, /background-color/i, 'tô sáng phải có background-color: ' + h);
    await app.shot('nf-toolbar');
    // danh sách bằng nút
    await p.keyboard.press('End'); await p.keyboard.press('Enter');
    await p.click('[data-cmd="insertUnorderedList"]');
    await p.keyboard.type('muc 1');
    assert.match(await html(p), /<ul>/, 'nút danh sách');
    const want = await html(p);
    const saved = await savedHtml(app, id, /muc 1/);
    assert.match(saved, /background-color/);
    await app.flush();
    await app.close();
    const app2 = await launch({ configHome: cfg, waitNotes: 1 });
    try {
      const p2 = await app2.noteWindow('' + id);
      await p2.waitForLoadState('domcontentloaded');
      await waitFor(() => p2.evaluate(() => document.getElementById('editor').innerHTML.length > 0), { msg: 'html nạp lại' });
      const h2 = await html(p2);
      assert.match(h2, /<ul>/); assert.match(h2, /background-color/i, 'tô sáng mất sau khi mở lại: ' + h2); assert.match(h2, /muc 1/);
    } finally { await app2.close(); }
  } finally { await app.close(); }
});

test('2. undo/redo sau gõ, định dạng, dán (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)', { timeout: 90000 }, async () => {
  await withApp('nf-2', { waitNotes: 2 }, async app => {
    const { p } = await openNote(app);
    const txt = () => p.evaluate(() => document.getElementById('editor').innerText.trim());
    await p.keyboard.type('mot hai ba');
    await sleep(700);
    await p.keyboard.type(' bon nam');
    assert.strictEqual(await txt(), 'mot hai ba bon nam');
    await p.keyboard.press('Control+Z');
    assert.strictEqual(await txt(), 'mot hai ba', 'undo gõ');
    await p.keyboard.press('Control+Y');
    assert.strictEqual(await txt(), 'mot hai ba bon nam', 'redo Ctrl+Y');
    await p.keyboard.press('Control+Z');
    await p.keyboard.press('Control+Shift+Z');
    assert.strictEqual(await txt(), 'mot hai ba bon nam', 'redo Ctrl+Shift+Z');
    // sau định dạng
    await p.keyboard.press('Control+A'); await p.keyboard.press('Control+B');
    assert.match(await html(p), /<(b|strong)>/);
    await p.keyboard.press('Control+Z');
    assert.doesNotMatch(await html(p), /<(b|strong)>/, 'undo định dạng đậm');
    await p.keyboard.press('Control+Y');
    assert.match(await html(p), /<(b|strong)>/, 'redo định dạng đậm');
    // sau dán
    await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
    await p.keyboard.type('dau');
    await sleep(700);
    await app.main((c, e) => { e.clipboard.writeText('DAN-VAO'); });
    await p.keyboard.press('Control+V');
    assert.match(await txt(), /DAN-VAO/);
    await p.keyboard.press('Control+Z');
    assert.strictEqual(await txt(), 'dau', 'undo dán');
    await p.keyboard.press('Control+Y');
    assert.match(await txt(), /DAN-VAO/, 'redo dán');
  });
});

test('3. tìm Ctrl+F: không phân biệt dấu, Enter nhảy, Esc đóng', { timeout: 90000 }, async () => {
  await withApp('nf-3', { waitNotes: 2 }, async app => {
    const { p } = await openNote(app);
    await p.keyboard.type('Đi chợ mùa rau muống. Nhớ mua rau cải, mua rau thơm. Hết.');
    await p.keyboard.press('Control+F');
    assert.strictEqual(await p.evaluate(() => document.getElementById('findBar').hidden), false, 'findbar mở');
    assert.strictEqual(await p.evaluate(() => document.activeElement.id), 'findInput');
    await p.keyboard.type('mua rau');
    const cnt = () => p.textContent('#findCount');
    assert.strictEqual(await cnt(), '1/3', '"mua rau" phải khớp cả "mùa rau" và "mua rau"');
    await p.keyboard.press('Enter'); assert.strictEqual(await cnt(), '2/3');
    await p.keyboard.press('Enter'); assert.strictEqual(await cnt(), '3/3');
    await p.keyboard.press('Enter'); assert.strictEqual(await cnt(), '1/3', 'vòng lại');
    await p.keyboard.press('Shift+Enter'); assert.strictEqual(await cnt(), '3/3', 'Shift+Enter lùi');
    // gõ có dấu tìm không dấu
    await p.fill('#findInput', 'chợ');
    assert.strictEqual(await cnt(), '1/1');
    await p.fill('#findInput', 'cho'); assert.strictEqual(await cnt(), '1/1', 'không dấu tìm "chợ"');
    await p.fill('#findInput', 'DI CHO'); assert.strictEqual(await cnt(), '1/1', 'đ -> d, không phân biệt hoa/thường');
    await p.fill('#findInput', 'khongco'); assert.strictEqual(await cnt(), '0/0');
    await p.keyboard.press('Escape');
    assert.strictEqual(await p.evaluate(() => document.getElementById('findBar').hidden), true, 'Esc đóng');
    assert.strictEqual(await p.evaluate(() => document.activeElement.id), 'editor', 'trả focus về editor');
    // nội dung không bị đổi
    assert.match(await p.evaluate(() => document.getElementById('editor').innerText), /^Đi chợ mùa rau muống/);
  });
});

async function pasteImage(app, p, w, h) {
  await app.main((c, e, d) => {
    const { nativeImage, clipboard } = e;
    const buf = Buffer.alloc(d.w * d.h * 4);
    for (let i = 0; i < d.w * d.h; i++) { buf[i * 4] = 220; buf[i * 4 + 1] = (i * 7) % 256; buf[i * 4 + 2] = (i * 13) % 256; buf[i * 4 + 3] = 255; }
    clipboard.writeImage(nativeImage.createFromBitmap(buf, { width: d.w, height: d.h }));
  }, { w, h });
  await p.keyboard.press('Control+V');
}

test('4a. dán ảnh: hiện, thu nhỏ, lưu, mở lại còn', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    const { p, id } = await openNote(app);
    await p.keyboard.type('anh nho ');
    await pasteImage(app, p, 40, 30);
    await waitFor(() => p.evaluate(() => document.querySelectorAll('#editor img').length === 1), { msg: 'ảnh nhỏ hiện' });
    // ảnh lớn 2400x1200 -> phải thu nhỏ về cạnh dài <= 1600
    await p.keyboard.press('Enter');
    await pasteImage(app, p, 2400, 1200);
    await waitFor(() => p.evaluate(() => document.querySelectorAll('#editor img').length === 2), { msg: 'ảnh lớn hiện', timeout: 20000 });
    await sleep(500);
    const dims = await p.evaluate(() => Array.from(document.querySelectorAll('#editor img')).map(i => [i.naturalWidth, i.naturalHeight]));
    assert.ok(dims[1][0] <= 1600, 'ảnh lớn phải thu nhỏ, thực tế ' + dims[1]);
    const vis = await p.evaluate(() => { const r = document.querySelectorAll('#editor img')[1].getBoundingClientRect(); const e = document.getElementById('editor').getBoundingClientRect(); return r.width <= e.width + 1; });
    assert.ok(vis, 'ảnh lớn không được tràn khung note');
    await app.shot('nf-anh');
    await savedHtml(app, id, /<img[^>]+src="data:image/);
    await app.flush();
    await app.close();
    const app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try {
      const p2 = await app2.noteWindow(id);
      await waitFor(() => p2.evaluate(() => document.querySelectorAll('#editor img').length === 2), { msg: '2 ảnh sau mở lại' });
      const ok = await p2.evaluate(() => Array.from(document.querySelectorAll('#editor img')).every(i => i.complete && i.naturalWidth > 0));
      assert.ok(ok, 'ảnh giải mã được sau khi mở lại');
    } finally { await app2.close(); }
  } finally { await app.close(); }
});

test('4b. dán HTML từ web: lọc script/style/onerror/link', { timeout: 90000 }, async () => {
  await withApp('nf-4b', { waitNotes: 2 }, async app => {
    const { p, id } = await openNote(app);
    await p.evaluate(() => { window.__pwn = 0; });
    const evil = '<p style="color:red" onclick="window.__pwn=1">Xin <b>chao</b> <a href="javascript:window.__pwn=2">link</a></p>' +
      '<script>window.__pwn=3</script><style>body{display:none}</style>' +
      '<img src="x" onerror="window.__pwn=4"><img src="data:image/png;base64,iVBORw0KGgo=" onerror="window.__pwn=5">' +
      '<iframe src="https://example.com"></iframe><span style="font-size:99px;background-color:#ff0">to</span>';
    await app.main((c, e, h) => { e.clipboard.write({ html: h, text: 'Xin chao link to' }); }, evil);
    await p.keyboard.press('Control+V');
    await sleep(400);
    const h = await html(p);
    assert.match(h, /Xin/); assert.match(h, /<b>chao<\/b>/);
    assert.doesNotMatch(h, /<script|<style|<iframe|onerror|onclick|javascript:|<a\b/i, 'html còn đồ nguy hiểm: ' + h);
    assert.doesNotMatch(h, /font-size|color:\s*red/i, 'style lạ còn lại: ' + h);
    assert.strictEqual(await p.evaluate(() => window.__pwn), 0, 'script đã chạy');
    const saved = await savedHtml(app, id, /chao/);
    assert.doesNotMatch(saved, /<script|<style|onerror|onclick|javascript:/i);
  });
});

test('5. cỡ chữ Ctrl+=/Ctrl+-/Ctrl+0, Ctrl+lăn chuột, còn sau khi mở lại', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    const { p, id } = await openNote(app);
    const z = () => p.evaluate(() => parseFloat(document.getElementById('editor').style.getPropertyValue('--zoom') || '1'));
    await p.keyboard.type('co chu');
    await p.keyboard.press('Control+='); await p.keyboard.press('Control+=');
    assert.strictEqual(await z(), 1.2, 'Ctrl+= x2');
    await p.keyboard.press('Control+-');
    assert.strictEqual(await z(), 1.1, 'Ctrl+-');
    await p.keyboard.press('Control+0');
    assert.strictEqual(await z(), 1, 'Ctrl+0');
    await p.keyboard.press('Control+Shift+='); // Ctrl++ trên bàn phím thật
    assert.strictEqual(await z(), 1.1, 'Ctrl++ (Shift+=)');
    // lăn chuột
    await p.mouse.move(150, 150);
    await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.mouse.wheel(0, -100); await p.keyboard.up('Control');
    await sleep(200);
    assert.ok(await z() >= 1.3 - 1e-9, 'Ctrl+lăn lên phải phóng to, thực tế ' + await z());
    // cỡ chữ thực sự đổi
    const fs0 = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('editor')).fontSize));
    await p.keyboard.press('Control+0');
    const fs1 = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('editor')).fontSize));
    assert.ok(fs0 > fs1, `font-size tính được phải đổi theo zoom (${fs0} vs ${fs1})`);
    await p.keyboard.press('Control+='); await p.keyboard.press('Control+='); await p.keyboard.press('Control+=');
    const want = await z();
    await waitFor(async () => (await p.evaluate(i => window.mochi.notes2.getMeta(i), id)).zoom === want, { msg: 'zoom lưu vào dữ liệu' });
    await app.flush(); await app.close();
    const app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try {
      const p2 = await app2.noteWindow(id);
      await waitFor(async () => (await p2.evaluate(() => parseFloat(document.getElementById('editor').style.getPropertyValue('--zoom') || '1'))) === want, { msg: 'zoom ' + want + ' sau mở lại' });
    } finally { await app2.close(); }
  } finally { await app.close(); }
});

test('6. khoá chỉ đọc Ctrl+Shift+K: gõ không đổi, mở khoá được, còn sau khi mở lại', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    const { p, id } = await openNote(app);
    await p.keyboard.type('noi dung that');
    const before = await html(p);
    await p.keyboard.press('Control+Shift+K');
    await waitFor(() => p.evaluate(() => document.getElementById('editor').getAttribute('contenteditable') === 'false'), { msg: 'khoá' });
    assert.strictEqual(await p.evaluate(() => document.getElementById('lockInd').hidden), false, 'biểu tượng khoá hiện');
    await p.click('#editor');
    await p.keyboard.type('XXX'); await p.keyboard.press('Backspace'); await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
    await p.keyboard.press('Control+B'); await p.keyboard.press('Control+Z');
    await app.main((c, e) => { e.clipboard.writeText('DAN'); });
    await p.keyboard.press('Control+V');
    assert.strictEqual(await html(p), before, 'nội dung phải giữ nguyên khi khoá');
    await p.evaluate(() => document.querySelector('[data-cmd="bold"]').click());
    assert.strictEqual(await html(p), before, 'nút Đậm không được đổi nội dung khi khoá');
    await app.shot('nf-khoa');
    await waitFor(async () => (await p.evaluate(i => window.mochi.notes2.getMeta(i), id)).locked === true, { msg: 'locked lưu' });
    await app.flush(); await app.close();
    const app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try {
      const p2 = await app2.noteWindow(id);
      await waitFor(() => p2.evaluate(() => document.body.classList.contains('locked')), { msg: 'còn khoá sau mở lại' });
      assert.strictEqual(await p2.evaluate(() => document.getElementById('editor').getAttribute('contenteditable')), 'false');
      assert.strictEqual(await html(p2), before);
      await p2.keyboard.press('Control+Shift+K');   // mở khoá (focus có thể ở body)
      await waitFor(() => p2.evaluate(() => document.getElementById('editor').getAttribute('contenteditable') === 'true'), { msg: 'mở khoá' });
      await p2.click('#editor'); await p2.keyboard.press('End'); await p2.keyboard.type(' +them');
      assert.match(await html(p2), /\+them/, 'gõ được sau mở khoá');
    } finally { await app2.close(); }
  } finally { await app.close(); }
});

test('7. khoá bằng nút trên thanh công cụ + phím tắt khi focus ngoài editor', { timeout: 90000 }, async () => {
  await withApp('nf-7', { waitNotes: 2 }, async app => {
    const { p } = await openNote(app);
    await p.keyboard.type('abc');
    const h0 = await html(p);
    await p.click('#btnLock');
    assert.strictEqual(await p.evaluate(() => document.getElementById('editor').getAttribute('contenteditable')), 'false', 'nút khoá');
    await p.keyboard.press('Control+Shift+K');
    assert.strictEqual(await p.evaluate(() => document.getElementById('editor').getAttribute('contenteditable')), 'true', 'Ctrl+Shift+K mở khoá sau khi bấm nút');
    // các phím định dạng có gõ được khi focus ở ô tìm kiếm?
    await p.keyboard.press('Control+F');
    await p.keyboard.type('a');
    await p.keyboard.press('Control+B');
    assert.strictEqual(await html(p), h0, 'Ctrl+B ở ô tìm không được định dạng note');
  });
});

test('1c. tô sáng kèm đậm/gạch chân/gạch ngang vẫn còn sau khi mở lại', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    const { p, id } = await openNote(app);
    await p.keyboard.type('vua dam vua sang');
    await p.keyboard.press('Control+A');
    await p.keyboard.press('Control+B'); await p.keyboard.press('Control+U');
    await p.keyboard.press('Control+Shift+H');
    const live = await html(p);
    assert.match(live, /background-color/, 'tô sáng bằng Ctrl+Shift+H: ' + live);
    await savedHtml(app, id, /background-color/);
    await app.flush(); await app.close();
    const app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try {
      const p2 = await app2.noteWindow(id);
      await waitFor(() => p2.evaluate(() => document.getElementById('editor').innerHTML.length > 0), { msg: 'nạp lại' });
      const h2 = await html(p2);
      await app2.shot('nf-to-sang-mat');
      assert.match(h2, /background-color/, 'sau khi mở lại mất tô sáng: ' + h2);
    } finally { await app2.close(); }
  } finally { await app.close(); }
});

test('8. gõ xong thoát app ngay (<500ms) không mất chữ vừa gõ', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    const { p, id } = await openNote(app);
    await p.keyboard.type('chu moi go');
    await sleep(1500);                                 // cho lưu xong mốc đầu
    await p.keyboard.type(' ... them ngay truoc khi thoat');
    await app.close();                                 // thoát như người dùng, không chờ debounce 500ms
    const app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try {
      const n = (await app2.notes()).find(x => x.id === id);
      assert.match(n.html || '', /them ngay truoc khi thoat/, 'chữ gõ ngay trước khi thoát bị mất: ' + (n.html || ''));
    } finally { await app2.close(); }
  } finally { await app.close(); }
});
