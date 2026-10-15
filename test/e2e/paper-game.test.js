'use strict';
// QA lượt 2 — tích hợp paper<->main và game (Phòng của Mochi).
// Chạy: bash test/e2e/run.sh test/e2e/paper-game.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch, withApp, waitFor, sleep } = require('./lib/app');

const TO = 120000;
const MIN = 60000;

// ---------- helpers ----------
async function mkNote(app, html, opt = {}) {
  return app.main((c, e, a) => {
    const n = c.notes.createNote({ html: a.html, autoReminder: false });
    if (a.ageMs) { n.createdAt = Date.now() - a.ageMs; }
    if (a.dueMs !== undefined) c.notes.setNoteReminder(n.id, Object.assign({ due: Date.now() + a.dueMs, lead: 0 }, a.repeat ? { repeat: a.repeat } : {}));
    return n.id;
  }, { html, ageMs: opt.ageMs, dueMs: opt.dueMs, repeat: opt.repeat });
}
// ghi lại sự kiện bus trong main
const watch = app => app.main(c => {
  globalThis.__ev = [];
  for (const n of ['game:reward', 'game:outfit', 'game:levelup', 'persona:line', 'note:checkItem', 'reminder:due', 'reminder:done', 'game:mode']) {
    c.bus.on(n, p => { try { globalThis.__ev.push({ n, p: JSON.parse(JSON.stringify(p || {})), t: Date.now() }); } catch (_) { /* */ } });
  }
  return true;
});
const events = (app, name) => app.main((c, e, n) => (globalThis.__ev || []).filter(x => !n || x.n === n), name);
const gview = app => app.main(c => JSON.parse(JSON.stringify(c.game.view())));
const candy = async app => (await gview(app)).stats.candy;
const complete = (app, id) => app.main((c, e, i) => { c.notes.completeNote(i); return true; }, id);
const idOf = p => new URL(p.url()).searchParams.get('id');
const newGameSeed = (g) => ({ version: 2, notes: [], settings: {}, game: g });
// ngăn paper trong file (đã flush)
async function paperBox(app) { await app.flush(); return app.readData().paper; }

async function pickPaper(page, group, nth) {
  await page.click('#btnMenu');
  await page.click('[data-act="paper"]');
  await page.waitForSelector('#pickerPanel:not([hidden])', { timeout: 10000 });
  await page.click('.pk-tab[data-g="' + group + '"]');
  const cell = page.locator('.pk-cell').nth(nth || 0);
  const id = await cell.getAttribute('data-id');
  await cell.click();
  await waitFor(() => page.evaluate(i => document.body.getAttribute('data-paper') === i, id), { msg: 'body data-paper = ' + id });
  return id;
}

// ============================================================
// 1. Mẫu giấy qua UI; ngăn paper; sao lưu; xuất/nhập
// ============================================================
test('1. Mẫu giấy qua UI -> ngăn paper, mẫu mặc định cho note mới, sao lưu, xuất/nhập JSON', { timeout: 6 * TO }, async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-exp-'));
  let app = await launch({ waitNotes: 1, env: { MOCHI_DEV_TRANSFER: '1', MOCHI_DEV_DIR: outDir } });
  const home = app.configHome;
  let chosen = {};
  const fails = [];
  const soft = (ok, msg) => { if (!ok) fails.push(msg); };
  try {
    const groups = ['cute', 'student', 'season'];
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await mkNote(app, '<div>Giấy ' + i + ' tiếng Việt</div>'));
    for (let i = 0; i < 3; i++) {
      const pg = await app.noteWindow(ids[i]);
      await pg.waitForLoadState('domcontentloaded');
      await pg.waitForSelector('#btnMenu');
      await waitFor(() => pg.evaluate(() => !!window.MochiPaperCtl && !!window.MochiPaper), { msg: 'module paper nạp' });
      chosen[ids[i]] = await pickPaper(pg, groups[i], i);
      if (i === 2) {
        await pg.screenshot({ path: path.join(__dirname, 'out', 'l2-paper-picker.png') }).catch(() => {});
        await pg.click('.pk-def');
        await waitFor(() => pg.evaluate(() => /Note mới: (?!Theo màu)/.test(document.querySelector('.pk-defnote').textContent)), { msg: 'dòng "Note mới: <mẫu>"' });
      }
      await pg.keyboard.press('Escape');
    }
    const picks = Object.values(chosen);
    assert.strictEqual(new Set(picks).size, 3, 'ba mẫu khác nhau: ' + picks);
    const defPaper = chosen[ids[2]];

    let pb = await paperBox(app);
    assert.ok(pb && typeof pb === 'object' && !Array.isArray(pb), 'ngăn paper phải là object trong mochi-data.json: ' + JSON.stringify(pb));
    for (const id of ids) assert.strictEqual(pb.noteMeta[id] && pb.noteMeta[id].paper, chosen[id], 'noteMeta[' + id + '].paper');
    assert.strictEqual(pb.settings.defaultPaper, defPaper, 'settings.defaultPaper');

    // Ctrl+Alt+N -> note mới dùng mẫu mặc định
    const before = (await app.notes()).map(n => n.id);
    await app.shortcut('Ctrl+Alt+N');
    const nid = await waitFor(async () => (await app.notes()).map(n => n.id).find(i => !before.includes(i)), { msg: 'note mới' });
    const npg = await app.noteWindow(nid);
    await waitFor(() => npg.evaluate(p => document.body.getAttribute('data-paper') === p, defPaper), { msg: 'note mới có data-paper=' + defPaper });
    pb = await paperBox(app);
    assert.strictEqual(pb.noteMeta[nid] && pb.noteMeta[nid].paper, defPaper, 'noteMeta của note mới');
    chosen[nid] = defPaper;
    await app.shot('l2-paper-1-new-note-default');

    // xuất JSON qua IPC thật (như nút "Xuất" ở danh sách)
    const list = await app.openList();
    const ex = await list.evaluate(() => window.mochi.notes2.exportAll('json'));
    assert.ok(ex && ex.ok, 'xuất JSON: ' + JSON.stringify(ex));
    const exported = JSON.parse(fs.readFileSync(ex.path, 'utf8'));
    fs.copyFileSync(ex.path, path.join(outDir, 'export.json'));
    const exp = JSON.stringify(exported);
    // paper phải nằm đâu đó trong file xuất (khoá paper / noteMeta.paper / mẫu của từng note)
    const hasPaper = Object.values(chosen).every(p => exp.includes(p));
    if (!hasPaper) await app.shot('l2-paper-1-export');
    soft(hasPaper, 'file xuất JSON không chứa mẫu giấy đã chọn ' + JSON.stringify(Object.values(chosen)) + ' — khoá cấp 1: ' + Object.keys(exported).join(','));
  } finally { await app.close(); }

  // sao lưu: phiên 2 (cùng dữ liệu) -> lần ghi đầu tiên chép bản backups/ từ file có paper
  app = await launch({ configHome: home, waitNotes: 1 });
  try {
    await app.main(c => { c.store.save(); c.store.flushSync(); return true; });
    await app.main(c => { c.store.data.notes[0].updatedAt = Date.now(); c.store.save(); c.store.flushSync(); return true; });
    const bdir = path.join(app.userData, 'backups');
    const files = await waitFor(() => { try { const f = fs.readdirSync(bdir).filter(x => /^mochi-data-/.test(x)); return f.length ? f : null; } catch (_) { return null; } }, { msg: 'có file trong backups/' });
    const bk = JSON.parse(fs.readFileSync(path.join(bdir, files.sort().pop()), 'utf8'));
    soft(bk.paper && bk.paper.noteMeta && Object.keys(bk.paper.noteMeta).length >= 3, 'bản sao lưu phải có ngăn paper với meta của các note: ' + JSON.stringify(bk.paper));
  } finally { await app.close(); }

  // nhập lại vào app sạch -> mẫu còn
  const exportFile = path.join(outDir, 'export.json');
  const app2 = await launch({ waitNotes: 1, env: { MOCHI_DEV_TRANSFER: '1', MOCHI_DEV_DIR: outDir, MOCHI_DEV_IMPORT: exportFile } });
  try {
    const list = await app2.openList();
    const r = await list.evaluate(() => window.mochi.notes2.importFile());
    assert.ok(r && r.ok && r.count >= 4, 'nhập: ' + JSON.stringify(r));
    const imported = (await app2.notes()).filter(n => /Giấy \d tiếng Việt/.test(n.text));
    assert.strictEqual(imported.length, 3, 'số note nhập về');
    const pb = await paperBox(app2);
    const got = imported.map(n => pb && pb.noteMeta && pb.noteMeta[n.id] && pb.noteMeta[n.id].paper).sort();
    const want = Object.entries(chosen).filter(([k]) => true).map(([, v]) => v);
    const wantSorted = ['cute', 'student', 'season'].length && Object.values(chosen).slice(0, 3).sort();
    soft(JSON.stringify(got) === JSON.stringify(wantSorted), 'mẫu giấy sau khi nhập lại vào app sạch (ngăn paper.noteMeta) phải là ' + JSON.stringify(wantSorted) + ', thực tế ' + JSON.stringify(got));
    assert.ok(want.length);
  } catch (e) {
    const f = await app2.shot('l2-paper-1-import-LOI'); if (f) e.message += '\n  ảnh: ' + f;
    throw e;
  } finally { await app2.close(); fs.rmSync(outDir, { recursive: true, force: true }); }
  assert.strictEqual(fails.length, 0, 'Có ' + fails.length + ' lỗi tích hợp:\n - ' + fails.join('\n - '));
});

// ============================================================
// 2. Chuyển localStorage cũ -> ngăn paper
// ============================================================
test('2. Migration localStorage "mochi.paper.meta.*" -> ngăn paper', { timeout: 3 * TO }, async () => {
  let app = await launch({ waitNotes: 1 });
  const home = app.configHome;
  let id, want = 'cute-cream-cat';
  try {
    const known = await app.main(() => 0);
    id = (await app.notes())[0].id;
    const pg = await app.noteWindow(id);
    await pg.waitForLoadState('domcontentloaded');
    const wantId = await pg.evaluate(() => window.MochiPaper.list().filter(d => d.group === 'cute')[0].id);
    want = wantId;
    // giả lập dữ liệu của bản cũ (trước khi main nạp paper)
    await pg.evaluate(([i, p]) => {
      localStorage.setItem('mochi.paper.meta.' + i, JSON.stringify({ paper: p, shape: 'free' }));
      localStorage.setItem('mochi.paper.settings', JSON.stringify({ defaultPaper: p, tilt: false, hideDeco: false }));
    }, [id, want]);
    await pg.reload();
    await pg.waitForLoadState('domcontentloaded');
    await sleep(2500);
    const pb = await paperBox(app);
    const migrated = pb && pb.noteMeta && pb.noteMeta[id] && pb.noteMeta[id].paper === want;
    const shown = await pg.evaluate(p => document.body.getAttribute('data-paper') === p, want);
    if (!migrated || !shown) await app.shot('l2-paper-2-no-migration');
    assert.ok(migrated, 'dữ liệu localStorage cũ không được chuyển vào ngăn paper (paper=' + JSON.stringify(pb) + ')');
    assert.ok(shown, 'note không hiện mẫu cũ sau khi mở lại');
    assert.strictEqual(pb.settings.defaultPaper, want, 'settings.defaultPaper phải được chuyển');
  } finally { await app.close(); }
});

// ============================================================
// 3. Checklist -> note:checkItem -> game +2 xu/mục, 1 lần/mục
// ============================================================
test('3. Tick checklist: +2 xu mỗi mục, tick-bỏ-tick không cày', { timeout: 3 * TO }, async () => {
  await withApp('l2-game-3', { waitNotes: 1 }, async app => {
    await watch(app);
    const id = await mkNote(app, '<div data-ck="0">việc một</div><div data-ck="0">việc hai</div><div data-ck="0">việc ba</div>', { ageMs: 10 * MIN });
    const pg = await app.noteWindow(id);
    await pg.waitForLoadState('domcontentloaded');
    await waitFor(() => pg.evaluate(() => document.querySelectorAll('#editor [data-ck]').length === 3), { msg: '3 dòng checklist' });
    await sleep(800);
    const tick = async i => {
      await pg.evaluate(() => document.getElementById('editor').blur());
      const row = pg.locator('#editor > div').nth(i);
      await row.click({ position: { x: 8, y: 10 } });
    };
    const state = i => pg.evaluate(k => document.querySelectorAll('#editor [data-ck]')[k].getAttribute('data-ck'), i);
    const chkRewards = async () => (await events(app, 'game:reward')).filter(e => e.p.reason === 'checklist');

    await tick(0);
    await waitFor(async () => (await state(0)) === '1', { msg: 'mục 1 được tick' });
    await waitFor(async () => (await events(app, 'note:checkItem')).length >= 1, { msg: 'bus note:checkItem' });
    const ev0 = (await events(app, 'note:checkItem'))[0].p;
    assert.deepStrictEqual([ev0.noteId, ev0.index, ev0.done], [id, 0, true]);
    await waitFor(async () => (await chkRewards()).length >= 1, { msg: 'thưởng checklist mục 1' });

    const c1 = await candy(app);
    await tick(1);
    await waitFor(async () => (await state(1)) === '1', { msg: 'mục 2 tick' });
    await waitFor(async () => (await candy(app)) > c1, { msg: 'xu tăng sau mục 2' });
    assert.strictEqual((await candy(app)) - c1, 2, 'mỗi mục +2 xu');
    const r2 = (await chkRewards()).pop();
    assert.strictEqual(r2.p.candy, 2, 'game:reward.candy của mục 2');

    // tick-bỏ-tick mục 1: không thêm xu
    const c2 = await candy(app);
    await tick(0); await waitFor(async () => (await state(0)) === '0', { msg: 'bỏ tick mục 1' });
    await tick(0); await waitFor(async () => (await state(0)) === '1', { msg: 'tick lại mục 1' });
    await sleep(1500);
    assert.strictEqual(await candy(app), c2, 'tick-bỏ-tick không được cày xu');
    // mục 3 vẫn được 2
    await tick(2); await waitFor(async () => (await candy(app)) > c2, { msg: 'mục 3 được xu' });
    assert.strictEqual((await candy(app)) - c2, 2);
    assert.strictEqual((await chkRewards()).length, 3, 'đúng 3 thưởng cho 3 mục');
    // thống kê
    const v = await app.main(c => c.store.section('game').counters.checkItems);
    assert.strictEqual(v, 3, 'counters.checkItems');
  });
});

// ============================================================
// 4. Xong note có hẹn: +10, +5 đúng hạn; note lặp; trần 300/ngày
// ============================================================
test('4a. Xong note có hẹn (tồn tại >=2 phút): +10 +5 đúng hạn, bé báo', { timeout: 3 * TO }, async () => {
  await withApp('l2-game-4a', { waitNotes: 1 }, async app => {
    await watch(app);
    // khởi động: làm nóng (thành tích "xong note đầu tiên", lần đầu... để số đo sạch)
    const w = await mkNote(app, '<div>khởi động</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN });
    await complete(app, w);
    await waitFor(async () => (await events(app, 'game:reward')).length >= 1, { msg: 'thưởng khởi động' });
    const before = await gview(app);
    const n0 = (await events(app, 'game:reward')).length;
    const id = await mkNote(app, '<div>nộp báo cáo</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN });
    await complete(app, id);
    await waitFor(async () => (await events(app, 'game:reward')).length > n0, { msg: 'game:reward' });
    const rw = (await events(app, 'game:reward'))[n0].p;
    assert.strictEqual(rw.candy, 15, 'xong đúng hạn = +10 +5, thực tế ' + JSON.stringify(rw));
    assert.strictEqual((await candy(app)) - before.stats.candy, 15);
    // bé báo
    await waitFor(async () => (await events(app, 'persona:line')).some(e => e.t >= (0) && e.p.text), { msg: 'bé nói (persona:line)' });
    const lines = (await events(app, 'persona:line')).map(e => e.p.text);
    assert.ok(lines.length, 'có câu thoại');
    await app.shot('l2-game-4a-reward');
    // note mới tạo (<2 phút) bấm Xong: không thưởng (chống cày)
    const n1 = (await events(app, 'game:reward')).length;
    const fresh = await mkNote(app, '<div>vừa tạo</div>', { dueMs: 60 * MIN });
    const cf = await candy(app);
    await complete(app, fresh);
    await sleep(1200);
    assert.strictEqual(await candy(app), cf, 'note <2 phút không được thưởng');
    assert.strictEqual((await events(app, 'game:reward')).length, n1);
  });
});

test('4b. Note lặp: thưởng mỗi lần xong', { timeout: 3 * TO }, async () => {
  await withApp('l2-game-4b', { waitNotes: 1 }, async app => {
    await watch(app);
    const w = await mkNote(app, '<div>khởi động</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN });
    await complete(app, w);
    await waitFor(async () => (await events(app, 'game:reward')).length >= 1, { msg: 'thưởng khởi động' });
    const id = await mkNote(app, '<div>uống thuốc</div>', { ageMs: 10 * MIN, dueMs: 30 * MIN, repeat: { freq: 'daily' } });
    const c0 = await candy(app);
    await complete(app, id);
    await waitFor(async () => (await candy(app)) > c0, { msg: 'lần 1 được thưởng' });
    const c1 = await candy(app);
    assert.strictEqual(c1 - c0, 15, 'lần 1');
    const nn = await app.main((c, e, i) => JSON.parse(JSON.stringify(c.findNote(i))), id);
    const rem = (nn.reminders && nn.reminders[0]) || nn.reminder;
    assert.ok(rem && !rem.done, 'note lặp chuyển sang lần kế, chưa done: ' + JSON.stringify(rem));
    await complete(app, id);
    await waitFor(async () => (await candy(app)) > c1, { msg: 'lần 2 được thưởng' });
    assert.strictEqual((await candy(app)) - c1, 15, 'lần 2 cũng +15');
  });
});

test('4c. Trần 300 xu/ngày từ note', { timeout: 6 * TO }, async () => {
  await withApp('l2-game-4c', { waitNotes: 1 }, async app => {
    await watch(app);
    const ids = [];
    for (let i = 0; i < 24; i++) ids.push(await mkNote(app, '<div>việc ' + i + '</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN }));
    const c0 = await candy(app);
    for (const id of ids) await complete(app, id);
    await waitFor(async () => (await app.main(c => c.store.section('game').counters.done)) >= 24, { timeout: 30000, msg: '24 lần xong được đếm' });
    const b = await app.main(c => JSON.parse(JSON.stringify(c.store.section('game'))));
    assert.strictEqual(b.today.noteCoins, 300, 'today.noteCoins phải dừng ở 300: ' + b.today.noteCoins);
    const doneSum = (await events(app, 'game:reward')).filter(e => e.p.reason === 'done').reduce((s, e) => s + e.p.candy, 0);
    assert.ok(doneSum >= 300 && doneSum <= 300 + 400, 'tổng xu "done" ' + doneSum);
    // sau trần: thêm một note nữa -> không có xu từ note (thành tích/nhiệm vụ không tính)
    const extra = await mkNote(app, '<div>thêm</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN });
    const cA = await candy(app), nA = (await events(app, 'game:reward')).length;
    await complete(app, extra);
    await sleep(1500);
    const gain = (await candy(app)) - cA;
    const noteGain = (await events(app, 'game:reward')).slice(nA).filter(e => e.p.reason === 'done').reduce((s, e) => s + e.p.candy, 0);
    assert.strictEqual(noteGain, 0, 'quá trần phải 0 xu từ note, thực tế +' + noteGain + ' (xu +' + gain + ')');
    assert.strictEqual((await app.main(c => c.store.section('game').today.noteCoins)), 300);
    assert.ok(c0 >= 0);
  });
});

// ============================================================
// 5. Phòng của Mochi
// ============================================================
test('5. Phòng của Mochi: Ctrl+Alt+G, khay, 5 tab tiếng Việt, gacha, mặc đồ, Esc', { timeout: 4 * TO }, async () => {
  await withApp('l2-game-5', { waitNotes: 0, seed: newGameSeed({ version: 1, stats: { candy: 200 } }) }, async app => {
    await watch(app);
    assert.strictEqual(await candy(app), 200, 'seed xu qua ngăn game');
    await app.shortcut('Ctrl+Alt+G');
    let room = await app.page('room.html');
    await room.waitForLoadState('domcontentloaded');
    await room.waitForSelector('.tab-btn');
    const labels = await room.evaluate(() => [...document.querySelectorAll('.tab-btn .tab-label')].map(e => e.textContent));
    assert.deepStrictEqual(labels, ['Tủ đồ', 'Máy gacha', 'Cửa hàng', 'Nhiệm vụ', 'Thống kê']);
    assert.strictEqual(await room.title(), 'Phòng của Mochi');
    assert.strictEqual(await room.textContent('.brand-name'), 'Phòng của Mochi');
    // từng tab hiện được, không có dấu hỏng chữ
    for (const [i, lab] of labels.entries()) {
      await room.click('.tab-btn:nth-child(' + (i + 1) + ')');
      const vis = await room.evaluate(k => !document.querySelectorAll('.tab-panel')[k].hidden, i);
      assert.ok(vis, 'tab ' + lab + ' hiện');
      const txt = await room.evaluate(k => document.querySelectorAll('.tab-panel')[k].innerText, i);
      assert.ok(!/�|Ã.|Ä./.test(txt), 'chữ lỗi mã hoá ở tab ' + lab + ': ' + txt.slice(0, 80));
      assert.ok(!(await room.$('.tab-error')), 'tab ' + lab + ' báo lỗi dựng');
    }
    await app.shot('l2-game-5-tabs');
    // Esc đóng
    await room.keyboard.press('Escape').catch(() => {});
    await waitFor(() => app.pages('room.html').length === 0, { msg: 'Esc đóng cửa sổ' });
    assert.ok(!(await app.main(c => !!(c.windows.game && c.alive(c.windows.game)))));
    // khay
    const labelsT = await app.trayLabels();
    assert.ok(labelsT.includes('Phòng của Mochi…'), 'khay có "Phòng của Mochi…": ' + labelsT);
    assert.ok(await app.trayClick('Máy gacha'), 'mục khay "Máy gacha"');
    room = await app.page('room.html');
    await room.waitForSelector('.gc-pull');
    await waitFor(() => room.evaluate(() => !document.getElementById('tab-gacha').hidden), { msg: 'tab gacha hiện khi mở từ khay' });

    // gacha 1 lượt
    const v0 = await gview(app);
    const ownedBefore = Object.keys(v0.items).length;
    await room.click('.gc-pull >> nth=0');
    await waitFor(async () => (await gview(app)).totalPulls === 1, { msg: 'đã quay 1 lượt' });
    const v1 = await gview(app);
    // trừ 50 xu (+ thưởng "lần đầu dùng gacha" +20 nếu có, tính qua game:reward)
    const bonus = (await events(app, 'game:reward')).reduce((a, e) => a + e.p.candy, 0);
    assert.strictEqual(v1.stats.candy, 200 - 50 + bonus, 'trừ 50 xu mỗi lượt (thưởng kèm ' + bonus + ')');
    const hit = v1.history[v1.history.length - 1] || v1.history[0];
    assert.ok(hit && v1.items[hit.itemId] && v1.items[hit.itemId].count >= 1, 'đồ vào tủ: ' + JSON.stringify(hit));
    if (!hit.dup) assert.strictEqual(Object.keys(v1.items).length, ownedBefore + 1);
    await room.waitForSelector('.gc-cont', { timeout: 15000 });
    await app.shot('l2-game-5-gacha');
    await room.click('.gc-cont');

    // mặc đồ trong tủ -> game:outfit
    await room.click('.tab-btn:nth-child(1)');
    const wear = async id => {
      await room.click('.wd-item[data-id="' + id + '"]');
      await room.click('.wd-acts .btn-primary');
    };
    await wear('clip_x');
    await waitFor(async () => (await gview(app)).worn.hairclip === 'clip_x', { msg: 'mặc kẹp tóc' });
    const out = (await events(app, 'game:outfit')).pop();
    assert.ok(out && out.p.worn && out.p.worn.hairclip === 'clip_x', 'game:outfit {worn}: ' + JSON.stringify(out));
    await app.shot('l2-game-5-wardrobe');
    // cởi
    await room.click('.wd-slot.wd-slot-on');
    await waitFor(async () => !(await gview(app)).worn.hairclip, { msg: 'cởi' });
    const out2 = (await events(app, 'game:outfit')).pop();
    assert.ok(!out2.p.worn.hairclip, 'game:outfit sau khi cởi');
    // Esc đóng lần nữa
    await room.keyboard.press('Escape').catch(() => {});
    await waitFor(() => app.pages('room.html').length === 0, { msg: 'Esc đóng (lần 2)' });
  });
});

// ============================================================
// 6. Tắt / bật "Game hóa"
// ============================================================
test('6. Tắt Game hóa: không thưởng, note/nhắc vẫn chạy; bật lại giữ xu', { timeout: 4 * TO }, async () => {
  await withApp('l2-game-6', { waitNotes: 1 }, async app => {
    await watch(app);
    const room0 = await (async () => { await app.shortcut('Ctrl+Alt+G'); return app.page('room.html'); })();
    await room0.waitForSelector('#swEnabled', { state: 'attached' });
    await room0.click('label[for="swEnabled"]');
    await waitFor(async () => (await gview(app)).enabled === false, { msg: 'đã tắt game hóa' });
    assert.ok(await room0.evaluate(() => !document.getElementById('offVeil').hidden), 'có lớp phủ "Game hóa đang tắt"');
    await app.shot('l2-game-6-off');
    const xu = await candy(app);

    // note có hẹn ngắn: vẫn nhắc đúng giờ và Xong vẫn chạy
    const id = await mkNote(app, '<div data-ck="0">mục</div><div>họp nhóm</div>', { ageMs: 10 * MIN, dueMs: 2500 });
    await waitFor(async () => (await events(app, 'reminder:due')).some(e => e.p.noteId === id), { timeout: 20000, msg: 'reminder:due khi game tắt' });
    await complete(app, id);
    const n = await app.main((c, e, i) => JSON.parse(JSON.stringify(c.findNote(i))), id);
    const rem = (n.reminders && n.reminders[0]) || n.reminder;
    assert.ok(rem && rem.done, 'note vẫn được đánh dấu Xong khi game tắt');
    // tick checklist
    const pg = await app.noteWindow(id);
    await pg.waitForLoadState('domcontentloaded');
    await sleep(800);
    await pg.locator('#editor > div').nth(0).click({ position: { x: 8, y: 10 } });
    await waitFor(() => pg.evaluate(() => document.querySelector('#editor [data-ck]').getAttribute('data-ck') === '1'), { msg: 'tick vẫn chạy' });
    await sleep(1200);
    assert.strictEqual(await candy(app), xu, 'game tắt: không thưởng');
    assert.strictEqual((await events(app, 'game:reward')).length, 0, 'không phát game:reward khi tắt');
    // bật lại: giữ xu; việc mới lại được thưởng
    await room0.click('#btnEnable');
    await waitFor(async () => (await gview(app)).enabled === true, { msg: 'bật lại' });
    assert.strictEqual(await candy(app), xu, 'bật lại giữ nguyên xu');
    const id2 = await mkNote(app, '<div>việc sau khi bật</div>', { ageMs: 10 * MIN, dueMs: 60 * MIN });
    await complete(app, id2);
    await waitFor(async () => (await candy(app)) > xu, { msg: 'có thưởng sau khi bật lại' });
  });
});

// ============================================================
// 7. Ngăn game/paper hỏng kiểu
// ============================================================
const note0 = { id: 'n_seed1', html: '<div>ghi chú gốc</div>', text: 'ghi chú gốc', color: 'yellow', bounds: { x: 200, y: 200, width: 280, height: 260 }, visible: true, alwaysOnTop: false, reminder: null, reminders: [], remindMuted: [], createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 };
for (const [name, bad] of [['chuỗi', 'đây là chuỗi'], ['mảng', [1, 2, { a: 3 }]], ['số', 42], ['null', null]]) {
  test('7. Ngăn game & paper hỏng kiểu ' + name + ': app vẫn mở, note không ảnh hưởng', { timeout: 3 * TO }, async () => {
    await withApp('l2-game-7-' + name, { seed: { version: 2, notes: [note0], settings: {}, game: bad, paper: bad } }, async app => {
      await app.page('note.html');
      const pg = await app.noteWindow('n_seed1');
      await pg.waitForLoadState('domcontentloaded');
      await waitFor(() => pg.evaluate(() => document.getElementById('editor').innerText.includes('ghi chú gốc')), { msg: 'nội dung note còn' });
      // gõ + lưu
      await pg.click('#editor');
      await pg.keyboard.press('End');
      await pg.keyboard.type(' thêm chữ');
      await waitFor(async () => (await app.notes())[0].text.includes('thêm chữ'), { msg: 'lưu chữ mới' });
      // game dùng được (mặc định)
      const v = await gview(app);
      assert.strictEqual(v.enabled, true); assert.ok(Number.isFinite(v.stats.candy));
      await app.shortcut('Ctrl+Alt+G');
      const room = await app.page('room.html');
      await room.waitForSelector('.tab-btn');
      assert.ok(!(await room.$('.tab-error')));
      await room.keyboard.press('Escape').catch(() => {});
      // paper dùng được: chọn mẫu
      await waitFor(() => pg.evaluate(() => !!window.MochiPaperCtl), { msg: 'paper nạp' });
      const pid = await pickPaper(pg, 'cute', 0);
      await pg.keyboard.press('Escape');
      const pb = await paperBox(app);
      assert.ok(pb && !Array.isArray(pb) && typeof pb === 'object', 'ngăn paper được dựng lại dạng object: ' + JSON.stringify(pb));
      assert.strictEqual(pb.noteMeta['n_seed1'].paper, pid);
      const g = app.readData().game;
      assert.ok(g && !Array.isArray(g) && typeof g === 'object' && g.stats, 'ngăn game được dựng lại: ' + JSON.stringify(g).slice(0, 120));
      // dữ liệu hỏng gốc phải được cất lại (không mất)
      const kept = fs.readdirSync(app.userData).filter(f => /^mochi-data\.section-(game|paper)-/.test(f));
      if (bad !== null) assert.ok(kept.length >= 1, 'bản hỏng nên được cất vào mochi-data.section-*.json: ' + fs.readdirSync(app.userData));
    });
  });
}
