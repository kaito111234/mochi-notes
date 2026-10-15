'use strict';
// Nhóm data: xuất/nhập, khôi phục, file hỏng, ghi nguyên tử, sao lưu hằng ngày, migrate.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch, withApp, waitFor, sleep } = require('./lib/app');

const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-data-' + p + '-'));
const udir = home => path.join(home, 'Mochi Notes');
const bdir = home => path.join(udir(home), 'backups');
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const dayOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const note = (id, o) => Object.assign({
  id, html: '<div>' + id + '</div>', text: id, color: 'yellow',
  bounds: { x: 100, y: 100, width: 300, height: 320 }, visible: false, alwaysOnTop: false,
  reminder: null, createdAt: 1700000000000, updatedAt: 1700000000000
}, o || {});

function richSeed() {
  const now = Date.now();
  const due = now + 7 * DAY;
  const d = new Date(now + 3 * DAY);
  return {
    version: 2,
    notes: [
      note('n_viet', { html: '<div><b>Họp với khách</b> lúc 3h chiều</div><div>Đường Nguyễn Huệ, quận 1 — ươ ạ ế ỗ</div>', text: 'Họp với khách lúc 3h chiều\nĐường Nguyễn Huệ, quận 1 — ươ ạ ế ỗ', color: 'pink',
        reminder: { due, lead: 600000, intent: 'meeting', auto: true, preFired: false, fired: false, done: false, repeat: { freq: 'weekly', interval: 1, byDay: [1, 3] } } }),
      note('n_xanh', { html: '<ul><li>Sữa</li><li>Trứng gà</li></ul>', text: 'Sữa\nTrứng gà', color: 'green', reminder: { due: due + DAY, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false } }),
      note('n_tim', { html: '<div>Ghi chú tím ❤</div>', text: 'Ghi chú tím ❤', color: 'purple' })
    ],
    settings: { mascotEnabled: true, sound: true },
    alarms: {
      version: 1,
      list: [
        { id: 'a_day', label: 'Dậy tập thể dục', time: '06:30', repeat: { freq: 'daily' }, enabled: true, sound: 'bell', snoozeMin: 15, nextAt: null, createdAt: 1700000000000 },
        { id: 'a_once', label: 'Đón con', time: '16:45', repeat: null, date: dayOf(d), enabled: true, sound: 'chime', snoozeMin: 10, nextAt: null, createdAt: 1700000000000, noteId: 'n_viet' }
      ],
      memos: [
        { id: 'm_1', text: 'Nhớ uống nước nhé', when: 'morning', enabled: true, createdAt: 1700000000000, days: [1, 2, 3, 4, 5] },
        { id: 'm_2', text: 'Tắt máy trước khi về', when: 'before-shutdown', enabled: true, createdAt: 1700000000000 }
      ],
      missed: [], sounds: [],
      noteMeta: { n_viet: { zoom: 1.5, locked: true } },
      settings: { defaultSnoozeMin: 10, defaultSound: 'chime', ringMaxMin: 5, missedGraceMin: 30, volume: 0.8 }
    }
  };
}

async function setDev(app, env) {
  await app.main((c, e, v) => { for (const k of Object.keys(v)) { if (v[k] == null) delete process.env[k]; else process.env[k] = v[k]; } return true; }, env);
}
async function openSettings(app) {
  const p = await app.openList();
  await p.waitForLoadState('domcontentloaded');
  await p.click('#btnSettings');
  await p.waitForSelector('#grpData', { state: 'visible' });
  return p;
}
const toastText = p => p.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
async function clickData(p, key) {
  await p.click('[data-data="' + key + '"]');
}
const pick = (n, keys) => { const o = {}; for (const k of keys) o[k] = n[k]; return o; };
const strip = a => pick(a, ['id', 'label', 'time', 'repeat', 'date', 'enabled', 'sound', 'snoozeMin', 'noteId']);

// ---------------------------------------------------------------- 1. xuất / nhập
test('1. xuất JSON -> nhập vào hồ sơ mới: note/báo thức/dặn dò giống hệt; nhập lại không nhân đôi', { timeout: 120000 }, async () => {
  const exportDir = tmp('exp');
  const seed = richSeed();
  let exported;
  // --- hồ sơ A: xuất qua giao diện
  await withApp('data-1-A', { seed, waitNotes: 0 }, async app => {
    await setDev(app, { MOCHI_DEV_TRANSFER: '1', MOCHI_DEV_DIR: exportDir });
    const p = await openSettings(app);
    await clickData(p, 'exp-json');
    await waitFor(() => fs.readdirSync(exportDir).some(f => f.endsWith('.json')), { msg: 'file xuất .json' });
    await waitFor(() => toastText(p), { msg: 'toast xuất' });
    assert.match(await toastText(p), /Đã xuất 3 note/);
    exported = path.join(exportDir, fs.readdirSync(exportDir).find(f => f.endsWith('.json')));
  });
  const ex = JSON.parse(fs.readFileSync(exported, 'utf8'));
  assert.strictEqual(ex.notes.length, 3);
  assert.strictEqual(ex.alarms.list.length, 2, 'file xuất phải chứa báo thức');
  assert.strictEqual(ex.alarms.memos.length, 2, 'file xuất phải chứa dặn dò');

  // --- hồ sơ B (trống): nhập 2 lần
  const emptySeed = { version: 2, notes: [], settings: {} };
  await withApp('data-1-B', { seed: emptySeed }, async app => {
    await setDev(app, { MOCHI_DEV_TRANSFER: '1', MOCHI_DEV_DIR: exportDir, MOCHI_DEV_IMPORT: exported });
    const p = await openSettings(app);
    await clickData(p, 'import');
    await waitFor(async () => (await app.notes()).length === 3, { msg: '3 note sau nhập' });
    await waitFor(() => toastText(p), { msg: 'toast nhập' });
    assert.match(await toastText(p), /Đã nhập 3 note/);
    await app.flush();
    const got = await app.notes();
    for (const o of seed.notes) {
      const g = got.find(x => x.id === o.id);
      assert.ok(g, 'thiếu note ' + o.id);
      assert.deepStrictEqual(pick(g, ['html', 'text', 'color', 'reminder', 'createdAt']), pick(o, ['html', 'text', 'color', 'reminder', 'createdAt']), 'note ' + o.id + ' khác bản gốc');
    }
    const data = app.readData();
    assert.deepStrictEqual(data.alarms.list.map(strip).sort((a, b) => a.id < b.id ? -1 : 1), seed.alarms.list.map(strip).sort((a, b) => a.id < b.id ? -1 : 1), 'báo thức khác');
    assert.deepStrictEqual(data.alarms.memos.map(m => pick(m, ['id', 'text', 'when', 'days', 'enabled'])).sort((a, b) => a.id < b.id ? -1 : 1),
      seed.alarms.memos.map(m => pick(m, ['id', 'text', 'when', 'days', 'enabled'])).sort((a, b) => a.id < b.id ? -1 : 1), 'dặn dò khác');
    assert.ok(data.alarms.list.find(a => a.id === 'a_day').nextAt > Date.now(), 'báo thức lặp phải có nextAt tương lai');
    assert.strictEqual(data.alarms.noteMeta.n_viet.zoom, 1.5, 'zoom mất');
    assert.strictEqual(data.alarms.noteMeta.n_viet.locked, true, 'khoá mất');
    // lặp của note vẫn còn
    assert.deepStrictEqual(got.find(x => x.id === 'n_viet').reminder.repeat, { freq: 'weekly', interval: 1, byDay: [1, 3] });

    // nhập lần 2 cùng file: ghi nhận hành vi
    await sleep(3500);   // chờ toast cũ ẩn
    await clickData(p, 'import');
    await sleep(1500);
    const n2 = (await app.notes()).length;
    const d2 = (await app.main(c => JSON.parse(JSON.stringify({ a: c.store.section('alarms', () => ({})).list.length, m: c.store.section('alarms', () => ({})).memos.length })))); 
    console.log('[data-1] nhập trùng lần 2 -> note:', n2, 'báo thức:', d2.a, 'dặn dò:', d2.m, 'toast:', await toastText(p));
    assert.strictEqual(n2, 3, 'nhập trùng 2 lần nhân đôi note');
    assert.strictEqual(d2.a, 2, 'nhập trùng 2 lần nhân đôi báo thức');
    assert.strictEqual(d2.m, 2, 'nhập trùng 2 lần nhân đôi dặn dò');
  });
});

test('1b. nhập file .txt và .md thành note có dấu', { timeout: 90000 }, async () => {
  const dir = tmp('txt');
  const f1 = path.join(dir, 'ghi-chu.txt'), f2 = path.join(dir, 'viec.md');
  fs.writeFileSync(f1, 'Mua sắm cuối tuần\nCà phê sữa đá\n');
  fs.writeFileSync(f2, '# Việc cần làm\n\n- **Gọi** điện cho mẹ\n- Đặt vé tàu\n');
  await withApp('data-1b', { seed: { version: 2, notes: [], settings: {} } }, async app => {
    await setDev(app, { MOCHI_DEV_TRANSFER: '1', MOCHI_DEV_DIR: dir, MOCHI_DEV_IMPORT: [f1, f2].join(path.delimiter) });
    const p = await openSettings(app);
    await clickData(p, 'import');
    await waitFor(async () => (await app.notes()).length === 2, { timeout: 25000, msg: '2 note từ txt/md' });
    const ns = await app.notes();
    const t = ns.find(n => n.text.includes('Mua sắm'));
    const m = ns.find(n => n.text.includes('Việc cần làm'));
    assert.ok(t && m, JSON.stringify(ns.map(n => n.text)));
    assert.ok(t.text.includes('Cà phê sữa đá'));
    assert.ok(m.html.includes('<b>Gọi</b>'), m.html);
    assert.ok(/<li>/.test(m.html), 'markdown list -> <li>');
    await app.shot('data-1b-nhap-txt-md');
  });
});

// ---------------------------------------------------------------- 2. khôi phục
test('2. khôi phục bản sao lưu qua tab Dữ liệu (MOCHI_DEV_TAB=restore): về đúng bản + có before-restore', { timeout: 120000 }, async () => {
  const home = tmp('restore');
  fs.mkdirSync(bdir(home), { recursive: true });
  const old = {
    version: 2,
    notes: [
      note('r1', { html: '<div>Bản gốc có dấu: Hà Nội</div>', text: 'Bản gốc có dấu: Hà Nội', color: 'blue' }),
      note('r2', { html: '<div>Note sẽ bị xoá</div>', text: 'Note sẽ bị xoá', color: 'green' }),
      note('r3', {})
    ], settings: {}
  };
  fs.writeFileSync(path.join(bdir(home), 'mochi-data-2026-10-01.json'), JSON.stringify(old));
  const cur = {
    version: 2,
    notes: [
      note('r1', { html: '<div>Đã sửa sai</div>', text: 'Đã sửa sai', color: 'pink' }),
      note('r3', {}),
      note('r4', { html: '<div>Note mới sau bản sao lưu</div>', text: 'Note mới sau bản sao lưu' })
    ], settings: {}
  };
  const app = await launch({ configHome: home, seed: cur, env: { MOCHI_DEV_TAB: 'restore', MOCHI_DEV_LIST: '1' } });
  try {
    const p = await app.page('list.html');
    await p.waitForLoadState('domcontentloaded');
    await p.waitForSelector('#bkSheet.open', { timeout: 8000 });
    await p.waitForSelector('.bk-item');
    const items = await p.$$eval('.bk-item', els => els.map(e => e.dataset.file));
    assert.ok(items.includes('mochi-data-2026-10-01.json'), items.join(','));
    await p.click('.bk-item[data-file="mochi-data-2026-10-01.json"]');
    await p.waitForSelector('.bk-note');
    await app.shot('data-2-restore-chon');
    const tags = await p.$$eval('.bk-note', els => els.map(e => e.querySelector('.bk-ntitle').textContent + '|' + e.querySelector('.tag').textContent));
    console.log('[data-2] danh sách:', JSON.stringify(tags));
    await p.check('#bkAll');
    await p.click('#bkRestore');                       // bấm lần 1: xin xác nhận
    assert.match(await p.textContent('#bkRestore'), /Xác nhận/);
    await p.click('#bkRestore');
    await waitFor(async () => { const n = (await app.notes()).find(x => x.id === 'r2'); return !!n; }, { msg: 'r2 được khôi phục' });
    const ns = await app.notes();
    const byId = id => ns.find(n => n.id === id);
    assert.strictEqual(byId('r1').html, old.notes[0].html);
    assert.strictEqual(byId('r1').color, 'blue');
    assert.strictEqual(byId('r2').html, old.notes[1].html);
    assert.strictEqual(byId('r2').color, 'green');
    console.log('[data-2] note r4 (mới hơn bản sao lưu) sau khôi phục:', !!byId('r4'), '| tổng', ns.length);
    assert.ok(byId('r4'), 'note mới hơn bản sao lưu không được bị xoá');
    await app.flush();
    const files = fs.readdirSync(bdir(home));
    assert.ok(files.some(f => /^mochi-data-before-restore-.*\.json$/.test(f)), 'thiếu mochi-data-before-restore-*.json: ' + files.join(','));
    const before = JSON.parse(fs.readFileSync(path.join(bdir(home), files.find(f => f.startsWith('mochi-data-before-restore-'))), 'utf8'));
    assert.strictEqual(before.notes.find(n => n.id === 'r1').html, '<div>Đã sửa sai</div>', 'bản trước khi khôi phục phải giữ dữ liệu cũ');
    assert.strictEqual(app.readData().notes.find(n => n.id === 'r1').html, old.notes[0].html, 'file dữ liệu chưa ghi bản khôi phục');
    await app.shot('data-2-restore-xong');
  } catch (e) { await app.shot('data-2-LOI'); throw e; } finally { await app.close(); }
});

// ---------------------------------------------------------------- 3. file hỏng
const GOOD_BACKUP = {
  version: 2, notes: [note('b1', { html: '<div>Từ bản sao lưu</div>', text: 'Từ bản sao lưu' }), note('b2', {})], settings: {}
};
const CORRUPT = [
  ['json-cut', Buffer.from('{"version":2,"notes":[{"id":"x1","html":"<div>Dang go dở', 'utf8')],
  ['rac-nhi-phan', Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x9c, 0x80, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x7b])],
  ['notes-la-object', Buffer.from(JSON.stringify({ version: 2, notes: { a: 1 }, settings: {}, alarms: { list: [{ id: 'al', label: 'x', time: '07:00' }] } }), 'utf8')],
  ['rong', Buffer.alloc(0)]
];
for (const [name, bytes] of CORRUPT) {
  test('3. file hỏng (' + name + '): app vẫn mở, giữ .bak', { timeout: 90000 }, async () => {
    const home = tmp('bad-' + name);
    fs.mkdirSync(udir(home), { recursive: true });
    fs.writeFileSync(path.join(udir(home), 'mochi-data.json'), bytes);
    const app = await launch({ configHome: home });
    try {
      const n = await app.main(c => c.store.data.notes.length);
      assert.ok(Number.isInteger(n));
      const files = fs.readdirSync(udir(home));
      const bak = files.filter(f => /\.bak$|corrupt|hong|broken/i.test(f));
      console.log('[data-3:' + name + '] app mở; notes=' + n + '; file trong userData=' + files.join(','));
      if (bytes.length) {
        assert.ok(bak.length >= 1, 'không có bản .bak giữ file hỏng: ' + files.join(','));
        assert.ok(Buffer.compare(fs.readFileSync(path.join(udir(home), bak[0])), bytes) === 0, '.bak không giống file hỏng gốc');
      }
      await app.main(c => { c.store.save(); c.store.flushSync(); return 1; });
      JSON.parse(fs.readFileSync(path.join(udir(home), 'mochi-data.json'), 'utf8'));   // file mới hợp lệ
    } catch (e) { await app.shot('data-3-' + name + '-LOI'); throw e; } finally { await app.close(); }
  });
}

test('3b. file hỏng + có bản sao lưu gần nhất: app có dùng lại bản sao lưu không?', { timeout: 90000 }, async () => {
  const home = tmp('bad-vs-backup');
  fs.mkdirSync(bdir(home), { recursive: true });
  fs.writeFileSync(path.join(bdir(home), 'mochi-data-' + dayOf(new Date(Date.now() - DAY)) + '.json'), JSON.stringify(GOOD_BACKUP));
  fs.writeFileSync(path.join(udir(home), 'mochi-data.json'), '{"version":2,"notes":[{"id":"x1"');
  const app = await launch({ configHome: home });
  try {
    await sleep(1500);
    const ids = (await app.notes()).map(n => n.id);
    console.log('[data-3b] sau khi file hỏng, note hiện có:', JSON.stringify(ids), '(bản sao lưu có b1,b2)');
    await app.shot('data-3b-hong-co-backup');
    assert.ok(ids.includes('b1') && ids.includes('b2'),
      'file chính hỏng nhưng app khởi động với ' + ids.length + ' note, không dùng bản sao lưu gần nhất (người dùng thấy mất sạch note)');
  } finally { await app.close(); }
});

test('3c. file hỏng 2 lần liên tiếp: .bak của lần đầu không bị ghi đè mất', { timeout: 90000 }, async () => {
  const home = tmp('bad-twice');
  fs.mkdirSync(udir(home), { recursive: true });
  const f = path.join(udir(home), 'mochi-data.json');
  const first = '{"version":2,"notes":[{"id":"quan-trong","html":"<div>Rất quan trọng';
  fs.writeFileSync(f, first);
  let a = await launch({ configHome: home });
  await a.close();
  fs.writeFileSync(f, '{"hong lan 2"');
  a = await launch({ configHome: home });
  await a.close();
  const all = fs.readdirSync(udir(home)).filter(x => /\.bak|corrupt/i.test(x)).map(x => fs.readFileSync(path.join(udir(home), x), 'utf8'));
  console.log('[data-3c] các bản giữ file hỏng:', all.length);
  assert.ok(all.some(t => t === first), 'bản hỏng lần 1 đã bị ghi đè mất');
});

test('3d. JSON hợp lệ nhưng ngăn alarms sai kiểu: dữ liệu báo thức có bị mất âm thầm không?', { timeout: 90000 }, async () => {
  const home = tmp('bad-box');
  fs.mkdirSync(udir(home), { recursive: true });
  const f = path.join(udir(home), 'mochi-data.json');
  const seed = { version: 2, notes: [note('k1')], settings: {}, alarms: 'hỏng', game: { stats: { candy: 5 } } };
  fs.writeFileSync(f, JSON.stringify(seed));
  const app = await launch({ configHome: home });
  try {
    await app.main(c => { c.store.save(); c.store.flushSync(); return 1; });
    const d = app.readData();
    const preserved = JSON.stringify(d).includes('hỏng') || fs.readdirSync(udir(home)).some(x => /\.bak/.test(x));
    console.log('[data-3d] alarms sau ghi:', JSON.stringify(d.alarms).slice(0, 80), '| giữ bản gốc:', preserved);
    assert.ok(d.notes.find(n => n.id === 'k1'), 'mất note');
    assert.deepStrictEqual(d.game, seed.game, 'ngăn game bị mất');
  } finally { await app.close(); }
});

// ---------------------------------------------------------------- 4. ghi nguyên tử
test('4. kill -9 giữa lúc ghi liên tục 5 lần: file luôn là JSON hợp lệ', { timeout: 180000 }, async () => {
  const home = tmp('kill');
  let prev = 0;
  for (let round = 1; round <= 5; round++) {
    const app = await launch({ configHome: home, seed: round === 1 ? { version: 2, notes: [], settings: {} } : undefined });
    try {
      await waitFor(() => app.main(c => !!c.store), { msg: 'store' });
      // gõ liên tục: thêm note lớn mỗi 15ms + save()
      await app.main((c, e, r) => {
        const big = '<div>' + 'Tiếng Việt có dấu ăâêôơư '.repeat(4000) + '</div>';
        let i = 0;
        globalThis.__stress = setInterval(() => {
          i++;
          c.store.data.notes.push({ id: 'k' + r + '_' + i, html: big, text: 'x', color: 'yellow', bounds: { x: 1, y: 1, width: 300, height: 300 }, visible: false, alwaysOnTop: false, reminder: null, createdAt: Date.now(), updatedAt: Date.now() });
          c.store.save();
        }, 15);
        return true;
      }, round);
      const dataFile = path.join(udir(home), 'mochi-data.json');
      let m0 = fs.existsSync(dataFile) ? fs.statSync(dataFile).mtimeMs : 0, writes = 0;
      const t0 = Date.now();
      while (writes < 3 && Date.now() - t0 < 15000) {
        await sleep(20);
        const m = fs.existsSync(dataFile) ? fs.statSync(dataFile).mtimeMs : 0;
        if (m !== m0) { writes++; m0 = m; }
      }
      await sleep(Math.floor(Math.random() * 250));
      await app.kill();
    } finally { await app.close(); }
    const raw = fs.readFileSync(path.join(udir(home), 'mochi-data.json'), 'utf8');
    let j;
    try { j = JSON.parse(raw); } catch (e) { throw new Error('vòng ' + round + ': file dữ liệu KHÔNG hợp lệ sau kill -9 (' + raw.length + ' byte): ' + e.message); }
    assert.ok(Array.isArray(j.notes));
    assert.ok(j.notes.length >= prev, 'vòng ' + round + ': số note giảm ' + prev + ' -> ' + j.notes.length);
    console.log('[data-4] vòng', round, 'notes =', j.notes.length, '| file khác:', fs.readdirSync(udir(home)).filter(x => x.startsWith('mochi-data.json')).join(','));
    prev = j.notes.length;
  }
});

// ---------------------------------------------------------------- 5. sao lưu hằng ngày
test('5. sao lưu hằng ngày: tạo bản hôm nay khi mở app, giữ tối đa 7 bản', { timeout: 90000 }, async () => {
  const home = tmp('backup7');
  fs.mkdirSync(bdir(home), { recursive: true });
  const olds = [];
  for (let i = 1; i <= 9; i++) { const n = 'mochi-data-2026-09-' + pad(i) + '.json'; olds.push(n); fs.writeFileSync(path.join(bdir(home), n), JSON.stringify({ version: 2, notes: [note('o' + i)], settings: {} })); }
  const today = 'mochi-data-' + dayOf(new Date()) + '.json';
  const app = await launch({ configHome: home, seed: { version: 2, notes: [note('hien-tai')], settings: {} }, waitNotes: 0 });
  try {
    await sleep(2500);
    let files = fs.readdirSync(bdir(home)).filter(f => /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    console.log('[data-5] ngay sau khi mở (không sửa gì):', files.length, 'bản; có bản hôm nay:', files.includes(today));
    const atOpen = files.includes(today);
    await app.main(c => { c.store.save(); c.store.flushSync(); return 1; });
    files = fs.readdirSync(bdir(home)).filter(f => /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    console.log('[data-5] sau 1 lần ghi:', files.join(','));
    assert.ok(files.includes(today), 'không có bản sao lưu hôm nay ' + today);
    assert.ok(files.length <= 7, 'giữ ' + files.length + ' bản (>7)');
    assert.deepStrictEqual(files.slice(0, -1), olds.slice(olds.length - (files.length - 1)), 'phải xoá bản CŨ NHẤT trước');
    const t = JSON.parse(fs.readFileSync(path.join(bdir(home), today), 'utf8'));
    assert.ok(t.notes.length >= 1);
    assert.ok(atOpen, 'bản sao lưu hôm nay chỉ được tạo sau lần ghi đầu tiên, không phải ngay khi mở app');
  } finally { await app.close(); }
});

// ---------------------------------------------------------------- 6. migrate
test('6. dữ liệu cũ (version 1, thiếu khoá, ngăn lạ): migrate, ngăn lạ giữ nguyên sau khi ghi', { timeout: 90000 }, async () => {
  const home = tmp('migrate');
  const seed = {
    version: 1,
    notes: [
      { id: 'old1', html: '<div>Note cũ thiếu khoá</div>' },
      { id: 'old2', text: 'chỉ có text', color: 'khong-co-mau', reminder: { due: Date.now() + DAY } },
      { notAnId: true }
    ],
    phongChuaCo: { x: 1, list: ['a', 'b'], nested: { ok: true } },
    game: { stats: { candy: 42 } }
  };
  const app = await launch({ configHome: home, seed });
  try {
    await sleep(1500);
    const ns = await app.notes();
    assert.deepStrictEqual(ns.map(n => n.id).sort(), ['old1', 'old2']);
    const o1 = ns.find(n => n.id === 'old1'), o2 = ns.find(n => n.id === 'old2');
    assert.strictEqual(o1.color, 'yellow');
    assert.ok(o1.bounds && o1.bounds.width > 0);
    assert.strictEqual(o2.color, 'yellow');
    assert.ok(o2.reminder && o2.reminder.due > Date.now());
    await app.main(c => { c.store.save(); c.store.flushSync(); return 1; });
    const d = app.readData();
    assert.strictEqual(d.version, 2, 'chưa nâng version');
    assert.deepStrictEqual(d.phongChuaCo, seed.phongChuaCo, 'ngăn lạ bị mất/đổi');
    assert.strictEqual(d.game.stats.candy, 42, 'ngăn game (có thể đã có phòng đăng ký) mất candy=42: ' + JSON.stringify(d.game));
    assert.ok(d.settings && typeof d.settings.mascotEnabled === 'boolean', 'thiếu settings mặc định');
    assert.ok(d.alarms && Array.isArray(d.alarms.list), 'thiếu ngăn alarms mặc định');
    // mở lại lần nữa: vẫn giữ ngăn lạ
    await app.close();
    const app2 = await launch({ configHome: home });
    try { await app2.main(c => { c.store.save(); c.store.flushSync(); return 1; }); assert.deepStrictEqual(app2.readData().phongChuaCo, seed.phongChuaCo); }
    finally { await app2.close(); }
  } finally { await app.close(); }
});
