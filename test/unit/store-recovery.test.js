'use strict';
// QA lượt 2 — store.js Đợt 2: normalizeNote (migrate reminder -> reminders[]), khôi phục từ backups/, giữ bản hỏng, ngăn sai kiểu.
// Đặc tả: docs/spec/01-data.md (mục "Chống mất dữ liệu", interface Reminder/Note), docs/rooms/notes/API2.md mục 3.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../../src/main/store.js');

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-rec-'));
const put = (dir, obj) => fs.writeFileSync(path.join(dir, 'mochi-data.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
const read = dir => JSON.parse(fs.readFileSync(path.join(dir, 'mochi-data.json'), 'utf8'));
const note = (id, extra) => Object.assign({ id, html: id, text: id, color: 'blue', bounds: { x: 1, y: 2, width: 200, height: 210 }, visible: true, alwaysOnTop: false, reminder: null, createdAt: 1, updatedAt: 2 }, extra);
const rem = (due, extra) => Object.assign({ due, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false }, extra);
const corrupt = dir => fs.readdirSync(dir).filter(f => /^mochi-data\.corrupt-\d{8}-\d{6}(-\d+)?\.json$/.test(f)).sort();
const backup = (dir, day, obj) => {
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'backups', 'mochi-data-' + day + '.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
};
const sections = dir => fs.readdirSync(dir).filter(f => /^mochi-data\.section-/.test(f));

/* ---------- normalizeNote: reminders[] ---------- */
test('migrate: note 0.1 chỉ có reminder -> reminders=[{...reminder, id:"r1"}], reminder cùng tham chiếu primary', () => {
  const dir = mk();
  put(dir, { notes: [note('a', { reminder: rem(5000, { intent: 'meet', lead: 600000 }) })] });
  const n = createStore(dir).notes[0];
  assert.strictEqual(n.reminders.length, 1);
  assert.strictEqual(n.reminders[0].id, 'r1');
  assert.strictEqual(n.reminders[0].due, 5000);
  assert.strictEqual(n.reminders[0].intent, 'meet');
  assert.strictEqual(n.reminders[0].lead, 600000);
  assert.strictEqual(n.reminder, n.reminders[0], 'reminder phải CÙNG tham chiếu với phần tử primary');
  assert.deepStrictEqual(n.remindMuted, []);
});

test('không có reminder lẫn reminders -> reminders=[], reminder=null', () => {
  const dir = mk();
  put(dir, { notes: [note('a'), note('b', { reminders: 'x', reminder: 5 })] });
  for (const n of createStore(dir).notes) { assert.deepStrictEqual(n.reminders, []); assert.strictEqual(n.reminder, null); }
});

test('reminders[] là nguồn sự thật: sắp theo due tăng dần, bỏ mục hỏng, reminder = một phần tử trong reminders', () => {
  const dir = mk();
  put(dir, { notes: [note('a', { reminders: [rem(300, { id: 'x3' }), null, rem('bad'), rem(100, { id: 'x1' }), rem(200, { id: 'x2' })], reminder: rem(999) })] });
  const n = createStore(dir).notes[0];
  assert.deepStrictEqual(n.reminders.map(r => r.id), ['x1', 'x2', 'x3']);
  assert.deepStrictEqual(n.reminders.map(r => r.due), [100, 200, 300]);
  assert.ok(n.reminders.includes(n.reminder), 'reminder (primary) phải là một phần tử của reminders');
  assert.ok(!n.reminders.some(r => r.due === 999), 'reminder cũ không được chen vào khi reminders[] đã có');
});

test('tối đa 20 nhắc/note', () => {
  const dir = mk();
  const many = Array.from({ length: 35 }, (_, i) => rem(1000 + i));
  put(dir, { notes: [note('a', { reminders: many })] });
  const n = createStore(dir).notes[0];
  assert.strictEqual(n.reminders.length, 20);
  assert.deepStrictEqual(n.reminders.map(r => r.due), Array.from({ length: 20 }, (_, i) => 1000 + i), 'giữ 20 nhắc sớm nhất');
});

test('id nhắc: cấp cho mục thiếu, không trùng trong note; hợp lệ thì giữ nguyên', () => {
  const dir = mk();
  put(dir, { notes: [note('a', { reminders: [rem(1, { id: 'keep' }), rem(2), rem(3, { id: 'keep' }), rem(4, { id: '' }), rem(5, { id: 7 })] })] });
  const ids = createStore(dir).notes[0].reminders.map(r => r.id);
  assert.strictEqual(ids.length, 5);
  assert.ok(ids.every(i => typeof i === 'string' && i), JSON.stringify(ids));
  assert.strictEqual(new Set(ids).size, 5, 'id phải duy nhất: ' + JSON.stringify(ids));
  assert.ok(ids.includes('keep'));
});

test('id ổn định qua nhiều vòng nạp-ghi-nạp (nhiều nhắc, kể cả id do hệ thống cấp)', () => {
  const dir = mk();
  put(dir, { notes: [note('a', { reminders: [rem(1), rem(2), rem(3), rem(4)] }), note('b', { reminder: rem(9) })] });
  let s = createStore(dir);
  const snap = () => s.notes.map(n => n.reminders.map(r => r.id + ':' + r.due).join(','));
  const first = snap();
  for (let i = 0; i < 3; i++) {
    s.save(); s.flushSync();
    s = createStore(dir);
    assert.deepStrictEqual(snap(), first, 'vòng ' + (i + 1));
  }
  assert.ok(first[1].startsWith('r1:'), 'note 0.1 một nhắc -> id r1: ' + first[1]);
});

test('ghi ra file có CẢ reminder (primary) lẫn reminders; nạp lại vẫn cùng tham chiếu', () => {
  const dir = mk();
  put(dir, { notes: [note('a', { reminder: rem(50) })] });
  const s = createStore(dir);
  s.save(); s.flushSync();
  const j = read(dir).notes[0];
  assert.ok(j.reminder && Array.isArray(j.reminders) && j.reminders.length === 1);
  assert.strictEqual(j.reminder.id, j.reminders[0].id);
  const n2 = createStore(dir).notes[0];
  assert.strictEqual(n2.reminder, n2.reminders[0]);
});

test('remindMuted: chỉ chuỗi không rỗng, bỏ trùng, tối đa 50 (giữ 50 cuối)', () => {
  const dir = mk();
  const keys = Array.from({ length: 70 }, (_, i) => 'k:' + i);
  put(dir, { notes: [note('a', { remindMuted: ['k:x', 'k:x', '', 5, null, ...keys] })] });
  const m = createStore(dir).notes[0].remindMuted;
  assert.ok(m.length <= 50);
  assert.ok(m.every(k => typeof k === 'string' && k));
  assert.strictEqual(new Set(m).size, m.length);
  assert.strictEqual(m[m.length - 1], 'k:69');
});

/* ---------- Chống mất dữ liệu ---------- */
test('file hỏng + có backups/: khôi phục từ bản hợp lệ MỚI NHẤT, bỏ qua bản hỏng trong backups', () => {
  const dir = mk();
  backup(dir, '2026-10-10', { notes: [note('old')] });
  backup(dir, '2026-10-13', { notes: [note('new1'), note('new2')], settings: { sound: false } });
  backup(dir, '2026-10-14', '{"notes": [ hỏng');       // mới nhất nhưng hỏng -> thử bản kế
  put(dir, '{"notes": [ {"id": ');
  const s = createStore(dir);
  assert.deepStrictEqual(s.notes.map(n => n.id), ['new1', 'new2']);
  assert.strictEqual(s.settings.sound, false);
  assert.strictEqual(s.recoveredFrom, path.join(dir, 'backups', 'mochi-data-2026-10-13.json'));
  assert.ok(s.corruptCopy && fs.existsSync(s.corruptCopy));
  assert.strictEqual(fs.readFileSync(s.corruptCopy, 'utf8'), '{"notes": [ {"id": ');
  // file chính được đặt lại bằng bản đã khôi phục (đọc lại được)
  assert.deepStrictEqual(read(dir).notes.map(n => n.id), ['new1', 'new2']);
});

test('bản hỏng được GIỮ, không bị ghi đè ở lần hỏng thứ hai (hai file corrupt-* khác nhau, chứa đúng nội dung)', () => {
  const dir = mk();
  backup(dir, '2026-10-13', { notes: [note('ok')] });
  put(dir, 'HONG-LAN-1');
  const s1 = createStore(dir);
  assert.deepStrictEqual(s1.notes.map(n => n.id), ['ok']);
  put(dir, 'HONG-LAN-2');
  const s2 = createStore(dir);
  assert.deepStrictEqual(s2.notes.map(n => n.id), ['ok']);
  const c = corrupt(dir);
  assert.strictEqual(c.length, 2, 'phải còn 2 bản hỏng: ' + c);
  assert.deepStrictEqual(c.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).sort(), ['HONG-LAN-1', 'HONG-LAN-2']);
});

test('chỉ giữ tối đa 5 bản hỏng (xoá bản cũ nhất)', () => {
  const dir = mk();
  for (let i = 1; i <= 7; i++) { put(dir, 'HONG-' + i); createStore(dir); }
  assert.strictEqual(corrupt(dir).length, 5);
  const contents = corrupt(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
  assert.ok(contents.includes('HONG-7'), 'bản mới nhất phải còn');
});

test('khôi phục xong rồi ghi: bản hỏng KHÔNG lọt vào backups/', () => {
  const dir = mk();
  backup(dir, '2026-10-13', { notes: [note('ok')] });
  put(dir, 'RAC');
  const s = createStore(dir);
  s.save(); s.flushSync();
  for (const f of fs.readdirSync(path.join(dir, 'backups'))) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(dir, 'backups', f), 'utf8')), 'backups/' + f + ' phải là JSON hợp lệ');
  }
});

test('file chính tốt: không đụng backups, recoveredFrom/corruptCopy = null, không tạo corrupt-*', () => {
  const dir = mk();
  backup(dir, '2026-10-13', { notes: [note('old')] });
  put(dir, { notes: [note('cur')] });
  const s = createStore(dir);
  assert.deepStrictEqual(s.notes.map(n => n.id), ['cur']);
  assert.strictEqual(s.recoveredFrom, null);
  assert.strictEqual(s.corruptCopy, null);
  assert.deepStrictEqual(corrupt(dir), []);
});

test('backups/ trống hoặc toàn bản hỏng: dùng mặc định, vẫn cất bản hỏng chính, không ném lỗi', () => {
  const dir = mk();
  backup(dir, '2026-10-12', 'xx');
  backup(dir, '2026-10-13', '[]');
  put(dir, 'RAC');
  const s = createStore(dir);
  assert.deepStrictEqual(s.notes, []);
  assert.strictEqual(s.recoveredFrom, null);
  assert.strictEqual(corrupt(dir).length, 1);
});

test('sao lưu hằng ngày không sao lưu file hỏng (hợp đồng: "không sao lưu file hỏng")', () => {
  const dir = mk();
  put(dir, 'RAC');
  const s = createStore(dir);       // không có backups -> mặc định
  s.save(); s.flushSync();
  const bdir = path.join(dir, 'backups');
  const files = fs.existsSync(bdir) ? fs.readdirSync(bdir) : [];
  for (const f of files) assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(bdir, f), 'utf8')), f);
  assert.ok(!files.some(f => fs.readFileSync(path.join(bdir, f), 'utf8') === 'RAC'));
});

/* ---------- Ngăn sai kiểu: giữ bản gốc (F-data-3 / BUG-022) ---------- */
test('ngăn sai kiểu (normalize ném lỗi): dùng mặc định NHƯNG cất nguyên bản vào mochi-data.section-<tên>-*.json', () => {
  const dir = mk();
  put(dir, { notes: [], alarms: 'chuỗi hỏng', pet: { x: 5 } });
  const s = createStore(dir);
  const box = s.section('alarms', () => ({ list: [] }), v => { if (!v || typeof v !== 'object') throw new Error('bad'); return v; });
  assert.deepStrictEqual(box, { list: [] });
  const f = sections(dir);
  assert.strictEqual(f.length, 1, 'phải có đúng 1 file cất ngăn: ' + f);
  assert.ok(/^mochi-data\.section-alarms-/.test(f[0]));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, f[0]), 'utf8')), 'chuỗi hỏng');
  // ngăn hợp lệ khác không bị ảnh hưởng
  assert.deepStrictEqual(s.section('pet', () => ({}), v => v), { x: 5 });
  assert.strictEqual(sections(dir).length, 1);
});

test('ngăn hợp lệ không sinh file cất; ngăn lạ chưa ai đăng ký được giữ nguyên khi ghi', () => {
  const dir = mk();
  put(dir, { notes: [], alarms: { list: [1] }, tuongLai: { v: 9 } });
  const s = createStore(dir);
  s.section('alarms', () => ({ list: [] }), v => v);
  s.save(); s.flushSync();
  assert.deepStrictEqual(sections(dir), []);
  const j = read(dir);
  assert.deepStrictEqual(j.tuongLai, { v: 9 });
  assert.deepStrictEqual(j.alarms, { list: [1] });
});

test('khoá nguy hiểm (__proto__/constructor) trong file không làm bẩn prototype', () => {
  const dir = mk();
  put(dir, '{"notes":[],"settings":{"__proto__":{"polluted":1},"constructor":2},"__proto__":{"polluted2":1}}');
  const s = createStore(dir);
  assert.strictEqual(({}).polluted, undefined);
  assert.strictEqual(({}).polluted2, undefined);
  assert.ok(Array.isArray(s.notes));
});
