'use strict';
// store.js: normalizeNote/normalizeReminder (qua nạp file), createStore, migrate, ngăn lạ, ghi nguyên tử, flushSync.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, DEFAULT_SETTINGS, COLORS } = require('../../src/main/store.js');

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-store-'));
const put = (dir, obj) => fs.writeFileSync(path.join(dir, 'mochi-data.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
const read = dir => JSON.parse(fs.readFileSync(path.join(dir, 'mochi-data.json'), 'utf8'));
const good = (id, extra) => Object.assign({ id, html: '<b>x</b>', text: 'x', color: 'pink', bounds: { x: 1, y: 2, width: 200, height: 210 }, visible: true, alwaysOnTop: false, reminder: null, createdAt: 1, updatedAt: 2 }, extra);

test('thư mục chưa có: tạo, isFirstRun, mặc định', () => {
  const dir = path.join(mk(), 'a', 'b');
  const s = createStore(dir);
  assert.strictEqual(s.isFirstRun, true);
  assert.deepStrictEqual(s.notes, []);
  assert.deepStrictEqual(s.settings, DEFAULT_SETTINGS);
  assert.ok(fs.existsSync(dir));
});

test('nạp lại dữ liệu hợp lệ nguyên vẹn (vòng đi vòng về, có tiếng Việt)', () => {
  const dir = mk();
  put(dir, { version: 2, notes: [good('n_1', { text: 'Họp 3h chiều ở phòng 302 ✓', reminder: { due: 123456, lead: 600000, intent: 'meet', auto: false, preFired: true, fired: false, done: false } })], settings: { sound: false } });
  const s = createStore(dir);
  assert.strictEqual(s.isFirstRun, false);
  assert.strictEqual(s.notes.length, 1);
  const n = s.notes[0];
  assert.deepStrictEqual(n, good('n_1', { text: 'Họp 3h chiều ở phòng 302 ✓', reminder: { due: 123456, lead: 600000, intent: 'meet', auto: false, preFired: true, fired: false, done: false } }));
  assert.strictEqual(s.settings.sound, false);
  assert.strictEqual(s.settings.glass, true);
});

test('note thiếu/sai kiểu được chuẩn hoá bằng mặc định', () => {
  const dir = mk();
  put(dir, { notes: [
    { id: 'n_a' },
    { id: 'n_b', html: 5, text: null, color: 'đỏ', bounds: { x: 'a', y: NaN, width: -5, height: 0 }, visible: 'no', alwaysOnTop: 1, createdAt: '1', updatedAt: Infinity },
    { id: 'n_c', bounds: 'xx', reminder: 'abc' }
  ] });
  const s = createStore(dir);
  assert.strictEqual(s.notes.length, 3);
  for (const n of s.notes) {
    assert.strictEqual(typeof n.html, 'string');
    assert.strictEqual(typeof n.text, 'string');
    assert.ok(COLORS.includes(n.color));
    assert.ok(n.bounds.width > 0 && n.bounds.height > 0 && Number.isFinite(n.bounds.x) && Number.isFinite(n.bounds.y));
    assert.strictEqual(typeof n.visible, 'boolean');
    assert.ok(Number.isFinite(n.createdAt) && Number.isFinite(n.updatedAt));
    assert.strictEqual(n.reminder, null);
  }
  assert.strictEqual(s.notes[0].visible, true);       // thiếu -> hiện
  assert.strictEqual(s.notes[1].alwaysOnTop, true);
});

test('bỏ mục không phải note (không id / id sai kiểu / null / số) và trùng id; các note tốt vẫn giữ', () => {
  const dir = mk();
  put(dir, { notes: [good('n_1'), null, 5, 'x', [], { text: 'không id' }, { id: 7 }, { id: '' }, good('n_1', { text: 'trùng' }), good('n_2')] });
  const s = createStore(dir);
  assert.deepStrictEqual(s.notes.map(n => n.id), ['n_1', 'n_2']);
  assert.strictEqual(s.notes[0].text, 'x');
});

test('reminder: due sai kiểu -> null; lead âm -> 0; trường thiếu có mặc định; repeat giữ/chuẩn hoá', () => {
  const dir = mk();
  put(dir, { notes: [
    good('a', { reminder: { due: '123' } }),
    good('b', { reminder: { due: NaN } }),
    good('c', { reminder: { due: 1000, lead: -5, intent: 42 } }),
    good('d', { reminder: { due: 1000, repeat: { freq: 'weekly', byDay: [1, 3, 3, 9, 'x'], interval: 2.7, anchor: 5 } } }),
    good('e', { reminder: { due: 1000, repeat: { freq: 'yearly' } } }),
    good('f', { reminder: [] })
  ] });
  const s = createStore(dir);
  const by = id => s.notes.find(n => n.id === id).reminder;
  assert.strictEqual(by('a'), null);
  assert.strictEqual(by('b'), null);
  assert.deepStrictEqual(by('c'), { due: 1000, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false });
  assert.deepStrictEqual(by('d').repeat, { freq: 'weekly', interval: 2, byDay: [1, 3], anchor: 5 });
  assert.strictEqual(by('e').repeat, undefined);
  assert.strictEqual(by('f'), null);
});

test('trạng thái reminder đã báo/xong được giữ qua nạp lại', () => {
  const dir = mk();
  put(dir, { notes: [good('a', { reminder: { due: 1, lead: 5, intent: 'call', auto: false, preFired: true, fired: true, done: true } })] });
  const r = createStore(dir).notes[0].reminder;
  assert.deepStrictEqual([r.auto, r.preFired, r.fired, r.done], [false, true, true, true]);
});

test('file hỏng JSON: dùng mặc định, giữ .bak, không ném lỗi', () => {
  const dir = mk();
  put(dir, '{"notes": [ {"id": "n_1" ');
  const s = createStore(dir);
  assert.deepStrictEqual(s.notes, []);
  assert.ok(fs.existsSync(path.join(dir, 'mochi-data.json.bak')));
  assert.strictEqual(fs.readFileSync(path.join(dir, 'mochi-data.json.bak'), 'utf8'), '{"notes": [ {"id": "n_1" ');
});

test('gốc là mảng / notes không phải mảng: coi là hỏng, có .bak', () => {
  for (const bad of ['[]', '{"notes": {"a":1}}', 'null', '"x"', '']) {
    const dir = mk();
    put(dir, bad);
    const s = createStore(dir);
    assert.deepStrictEqual(s.notes, [], bad);
    assert.ok(fs.existsSync(path.join(dir, 'mochi-data.json.bak')), 'bak cho ' + JSON.stringify(bad));
  }
});

test('file có BOM vẫn đọc được', () => {
  const dir = mk();
  put(dir, '﻿' + JSON.stringify({ notes: [good('n_1')] }));
  assert.strictEqual(createStore(dir).notes.length, 1);
});

test('settings: sai kiểu bị bỏ, khoá lạ không lọt vào settings', () => {
  const dir = mk();
  put(dir, { notes: [], settings: { sound: 'yes', glass: false, mascotIdle: 1, volume: 9, hack: true } });
  const s = createStore(dir);
  assert.strictEqual(s.settings.sound, true);
  assert.strictEqual(s.settings.glass, false);
  assert.strictEqual(s.settings.mascotIdle, false);
  assert.ok(!('volume' in s.settings) && !('hack' in s.settings));
});

test('settings là null/mảng không làm hỏng việc nạp notes', () => {
  for (const st of [null, [], 'x', 5]) {
    const dir = mk();
    put(dir, { notes: [good('n_1')], settings: st });
    const s = createStore(dir);
    assert.strictEqual(s.notes.length, 1);
    assert.deepStrictEqual(s.settings, DEFAULT_SETTINGS);
  }
});

test('migrate: file 0.1 (không version, không ngăn) -> ghi ra version 2, giữ note', () => {
  const dir = mk();
  put(dir, { notes: [good('n_1')], settings: { sound: false } });
  const s = createStore(dir);
  s.save(); s.flushSync();
  const j = read(dir);
  assert.strictEqual(j.version, 2);
  assert.strictEqual(j.notes[0].id, 'n_1');
  assert.strictEqual(j.settings.sound, false);
});

test('ngăn lạ (chưa ai đăng ký) giữ nguyên khi ghi', () => {
  const dir = mk();
  const future = { a: [1, 2, { b: 'Việt' }], z: null };
  put(dir, { version: 2, notes: [], settings: {}, alarms: { list: [{ id: 'x' }] }, tương_lai: future, pet: { x: 1 } });
  const s = createStore(dir);
  s.save(); s.flushSync();
  const j = read(dir);
  assert.deepStrictEqual(j['tương_lai'], future);
  assert.deepStrictEqual(j.alarms, { list: [{ id: 'x' }] });
  assert.deepStrictEqual(j.pet, { x: 1 });
});

test('section: đăng ký sau khi nạp -> dùng dữ liệu cũ qua normalize (migrate); ghi lại giá trị mới', () => {
  const dir = mk();
  put(dir, { notes: [], alarms: { list: [{ id: 'a1' }] } });
  const s = createStore(dir);
  const box = s.section('alarms', () => ({ list: [], memos: [] }), st => Object.assign({ list: [], memos: [] }, st));
  assert.deepStrictEqual(box, { list: [{ id: 'a1' }], memos: [] });
  assert.strictEqual(s.section('alarms', () => ({})), box, 'gọi lại trả cùng object');
  box.memos.push({ id: 'm' });
  s.save(); s.flushSync();
  assert.deepStrictEqual(read(dir).alarms.memos, [{ id: 'm' }]);
});

test('section: normalize ném lỗi -> dùng defaults; chưa có dữ liệu -> defaults; tên dành riêng bị từ chối', () => {
  const dir = mk();
  put(dir, { notes: [], game: 'rác' });
  const s = createStore(dir);
  assert.deepStrictEqual(s.section('game', () => ({ stats: {} }), () => { throw new Error('bad'); }), { stats: {} });
  assert.deepStrictEqual(s.section('persona', () => ({ recentLines: [] })), { recentLines: [] });
  for (const n of ['notes', 'settings', 'version']) assert.throws(() => s.section(n, () => ({})));
});

test('section bị normalize ném lỗi thì dữ liệu hỏng không còn nằm lại ở raw (ghi lại sạch)', () => {
  const dir = mk();
  put(dir, { notes: [], game: 'rác' });
  const s = createStore(dir);
  s.section('game', () => ({ ok: 1 }), () => { throw new Error('x'); });
  s.save(); s.flushSync();
  assert.deepStrictEqual(read(dir).game, { ok: 1 });
});

test('ghi nguyên tử: sau flushSync không còn .tmp, file hợp lệ, save() là debounce', async () => {
  const dir = mk();
  const s = createStore(dir);
  s.notes.push(good('n_1'));
  s.save();
  assert.ok(!fs.existsSync(s.file), 'chưa ghi ngay (debounce)');
  s.flushSync();
  assert.ok(fs.existsSync(s.file));
  assert.ok(!fs.existsSync(s.file + '.tmp'));
  assert.strictEqual(read(dir).notes[0].id, 'n_1');
  // flushSync khi không dirty: không ghi lại
  fs.unlinkSync(s.file);
  s.flushSync();
  assert.ok(!fs.existsSync(s.file));
});

test('save() tự ghi sau ~300ms; nhiều save() gộp một lần', async () => {
  const dir = mk();
  const s = createStore(dir);
  s.save(); s.save(); s.save();
  await new Promise(r => setTimeout(r, 600));
  assert.ok(fs.existsSync(s.file));
});

test('ghi tạm lỗi giữa chừng: file cũ nguyên vẹn, không ném lỗi, lần sau ghi lại được', () => {
  const dir = mk();
  put(dir, { notes: [good('cũ')] });
  const s = createStore(dir);
  s.notes.push(good('mới'));
  const orig = fs.writeFileSync;
  fs.writeFileSync = function (p, ...a) { if (String(p).endsWith('.tmp')) throw new Error('ENOSPC'); return orig.call(fs, p, ...a); };
  try { s.save(); assert.doesNotThrow(() => s.flushSync()); } finally { fs.writeFileSync = orig; }
  assert.deepStrictEqual(read(dir).notes.map(n => n.id), ['cũ']);
  s.flushSync();
  assert.deepStrictEqual(read(dir).notes.map(n => n.id), ['cũ', 'mới']);
});

test('rename bị chặn (antivirus): vẫn ghi được bằng phương án dự phòng, không để lại .tmp', () => {
  const dir = mk();
  const s = createStore(dir);
  s.notes.push(good('n'));
  const orig = fs.renameSync;
  fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
  try { s.save(); s.flushSync(); } finally { fs.renameSync = orig; }
  assert.strictEqual(read(dir).notes[0].id, 'n');
  assert.ok(!fs.existsSync(s.file + '.tmp'));
});

test('ghi bằng file tạm + rename (không ghi thẳng vào file chính)', () => {
  const dir = mk();
  const s = createStore(dir);
  s.save();
  const calls = [];
  const w = fs.writeFileSync, r = fs.renameSync;
  fs.writeFileSync = function (p, ...a) { calls.push(['w', path.basename(String(p))]); return w.call(fs, p, ...a); };
  fs.renameSync = function (a, b) { calls.push(['r', path.basename(String(a)), path.basename(String(b))]); return r.call(fs, a, b); };
  try { s.flushSync(); } finally { fs.writeFileSync = w; fs.renameSync = r; }
  assert.ok(calls.some(c => c[0] === 'w' && c[1] === 'mochi-data.json.tmp'));
  assert.ok(calls.some(c => c[0] === 'r' && c[1] === 'mochi-data.json.tmp' && c[2] === 'mochi-data.json'));
  assert.ok(!calls.some(c => c[0] === 'w' && c[1] === 'mochi-data.json'));
});

test('sao lưu hằng ngày: tạo backups/mochi-data-YYYY-MM-DD.json từ file có sẵn, tối đa 7 bản', () => {
  const dir = mk();
  put(dir, { notes: [good('n_1')] });
  const bdir = path.join(dir, 'backups');
  fs.mkdirSync(bdir);
  for (let i = 1; i <= 9; i++) fs.writeFileSync(path.join(bdir, `mochi-data-2020-01-0${i}.json`), '{}');
  const s = createStore(dir);
  s.save(); s.flushSync();
  const files = fs.readdirSync(bdir).sort();
  assert.ok(files.length <= 7, files.join());
  const d = new Date();
  const today = `mochi-data-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  assert.ok(files.includes(today), files.join());
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(bdir, today), 'utf8')).notes[0].id, 'n_1');
});

test('dữ liệu lớn (2000 note) nạp/ghi được', () => {
  const dir = mk();
  put(dir, { notes: Array.from({ length: 2000 }, (_, i) => good('n_' + i)) });
  const s = createStore(dir);
  assert.strictEqual(s.notes.length, 2000);
  s.save(); s.flushSync();
  assert.strictEqual(read(dir).notes.length, 2000);
});

test('data.notes nạp qua store được sửa trực tiếp và ghi lại (đối tượng sống)', () => {
  const dir = mk();
  put(dir, { notes: [good('n_1')] });
  const s = createStore(dir);
  s.notes[0].text = 'đã sửa';
  s.settings.sound = false;
  s.save(); s.flushSync();
  const j = read(dir);
  assert.strictEqual(j.notes[0].text, 'đã sửa');
  assert.strictEqual(j.settings.sound, false);
});

test('trường lạ trên note/reminder (do phòng khác/bản sau thêm) không bị mất khi nạp-ghi', () => {
  const dir = mk();
  put(dir, { notes: [good('n_1', { pinned: true, zoom: 1.5, reminder: { due: 1, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false, snoozedUntil: 99 } })] });
  const s = createStore(dir);
  s.save(); s.flushSync();
  const n = read(dir).notes[0];
  assert.strictEqual(n.pinned, true);
  assert.strictEqual(n.reminder.snoozedUntil, 99);
});
