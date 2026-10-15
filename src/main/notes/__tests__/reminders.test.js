'use strict';
// Chạy: TZ=Asia/Ho_Chi_Minh node src/main/notes/__tests__/reminders.test.js
const assert = require('assert');
const R = require('../reminders.js');

let passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { console.error('FAIL:', name); throw e; } }
const mk = (due, extra) => Object.assign({ due, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false }, extra);

t('MAX = 20', () => assert.strictEqual(R.MAX, 20));
t('normItem: hỏng -> null', () => {
  for (const x of [null, undefined, 5, 'a', [], {}, { due: 'x' }, { due: NaN }, { due: Infinity }]) assert.strictEqual(R.normItem(x), null);
});
t('normItem: mặc định', () => {
  const r = R.normItem({ due: 1000 });
  assert.deepStrictEqual(r, { due: 1000, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false });
});
t('normItem: auto=false giữ, lead âm -> 0, cờ ép boolean', () => {
  const r = R.normItem({ due: 5, lead: -3, auto: false, fired: 1, done: 'x', preFired: 0 });
  assert.strictEqual(r.auto, false); assert.strictEqual(r.lead, 0); assert.strictEqual(r.fired, true); assert.strictEqual(r.done, true); assert.strictEqual(r.preFired, false);
});
t('normItem: id/title/key/line hợp lệ giữ, sai kiểu bỏ', () => {
  const r = R.normItem({ due: 5, id: 'r9', title: '  Họp  ', key: 'k:hop', line: 3 });
  assert.deepStrictEqual([r.id, r.title, r.key, r.line], ['r9', 'Họp', 'k:hop', 3]);
  const b = R.normItem({ due: 5, id: 7, title: '', key: 3, line: -1 });
  assert.ok(!('id' in b) && !('title' in b) && !('key' in b) && !('line' in b));
  const c = R.normItem({ due: 5, line: 1.5 }); assert.ok(!('line' in c));
});
t('normItem: title/key quá dài bị cắt', () => {
  const r = R.normItem({ due: 5, title: 'a'.repeat(500), key: 'k'.repeat(500) });
  assert.strictEqual(r.title.length, 120); assert.strictEqual(r.key.length, 80);
});
t('normItem: repeat hợp lệ giữ, sai bỏ (normRepeat)', () => {
  assert.deepStrictEqual(R.normItem({ due: 5, repeat: { freq: 'daily', anchor: 9, junk: 1 } }).repeat, { freq: 'daily', anchor: 9 });
  assert.ok(!('repeat' in R.normItem({ due: 5, repeat: { freq: 'yearly' } })));
  assert.ok(!('repeat' in R.normItem({ due: 5, repeat: 'daily' })));
});
t('normItem không sửa đối tượng gốc', () => {
  const src = { due: 5, repeat: { freq: 'daily' } }; R.normItem(src);
  assert.deepStrictEqual(src, { due: 5, repeat: { freq: 'daily' } });
});
t('newId: danh sách rỗng -> r1; còn lại duy nhất', () => {
  assert.strictEqual(R.newId([]), 'r1'); assert.strictEqual(R.newId(), 'r1');
  const list = [{ id: 'r1' }];
  const seen = new Set(['r1']);
  for (let i = 0; i < 200; i++) { const id = R.newId(list); assert.ok(/^r[0-9a-z]+$/.test(id)); assert.ok(!seen.has(id)); seen.add(id); list.push({ id }); }
});
t('ensureIds: thiếu id', () => {
  const l = [mk(1), mk(2), mk(3)]; R.ensureIds(l);
  assert.ok(l.every(r => typeof r.id === 'string' && r.id)); assert.strictEqual(new Set(l.map(r => r.id)).size, 3);
});
t('ensureIds: phần tử duy nhất thiếu id -> r1', () => { const l = [mk(1)]; R.ensureIds(l); assert.strictEqual(l[0].id, 'r1'); });
t('ensureIds: id trùng -> phần tử sau đổi, phần tử đầu giữ', () => {
  const l = [mk(1, { id: 'a' }), mk(2, { id: 'a' }), mk(3, { id: 'a' })]; R.ensureIds(l);
  assert.strictEqual(l[0].id, 'a'); assert.strictEqual(new Set(l.map(r => r.id)).size, 3);
});
t('ensureIds: giữ id sẵn có, bỏ qua phần tử không phải object', () => {
  const l = [mk(1, { id: 'x' }), null, mk(2)]; R.ensureIds(l);
  assert.strictEqual(l[0].id, 'x'); assert.ok(l[2].id && l[2].id !== 'x'); assert.strictEqual(l[1], null);
  assert.strictEqual(R.ensureIds(null), null);
});
t('sortList: tăng dần, ổn định khi trùng due, tại chỗ', () => {
  const a = mk(5, { id: 'a' }), b = mk(1, { id: 'b' }), c = mk(5, { id: 'c' }), d = mk(3, { id: 'd' });
  const l = [a, b, c, d]; assert.strictEqual(R.sortList(l), l);
  assert.deepStrictEqual(l.map(r => r.id), ['b', 'd', 'a', 'c']);
});
t('pickPrimary: rỗng/không hợp lệ -> null', () => {
  assert.strictEqual(R.pickPrimary([]), null); assert.strictEqual(R.pickPrimary(null), null); assert.strictEqual(R.pickPrimary([null, { due: 'x' }]), null);
});
t('pickPrimary: đã kêu chưa xong sớm nhất thắng chưa kêu sớm hơn', () => {
  const a = mk(1), b = mk(5, { fired: true }), c = mk(3, { fired: true }), d = mk(0, { fired: true, done: true });
  assert.strictEqual(R.pickPrimary([a, b, c, d]), c);
});
t('pickPrimary: không ai fired -> chưa xong sớm nhất', () => {
  const a = mk(9), b = mk(4), c = mk(1, { done: true });
  assert.strictEqual(R.pickPrimary([a, b, c]), b);
});
t('pickPrimary: tất cả xong -> due lớn nhất', () => {
  const a = mk(9, { done: true }), b = mk(4, { done: true, fired: true });
  assert.strictEqual(R.pickPrimary([b, a]), a);
});
t('pickPrimary trả đúng tham chiếu phần tử', () => { const a = mk(1); assert.strictEqual(R.pickPrimary([a]), a); });
console.log('OK ' + passed + ' ca');
