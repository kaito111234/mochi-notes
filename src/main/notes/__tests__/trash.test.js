'use strict';
const assert = require('assert');
const T = require('../trashLogic.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const NOW = Date.UTC(2026, 5, 10, 5, 0, 0);
const mk = (id, at, o) => ({ note: Object.assign({ id, text: 'Note ' + id, color: 'pink' }, o), trashedAt: at });

t('TTL = 30 ngày', () => assert.strictEqual(T.TTL, 30 * 86400000));
t('normalize rác -> rỗng', () => { for (const x of [null, undefined, 5, 'x', [], {}, { items: 3 }]) assert.deepStrictEqual(T.normalize(x), { items: [] }); });
t('normalize bỏ phần tử hỏng', () => {
  const r = T.normalize({ items: [null, 1, {}, { note: null }, { note: { id: '' } }, { note: { id: 5 } }, mk('a', NOW)] });
  assert.strictEqual(r.items.length, 1); assert.strictEqual(r.items[0].note.id, 'a');
});
t('normalize bỏ id trùng, giữ cái đầu', () => {
  const r = T.normalize({ items: [mk('a', 1000, { text: 'x' }), mk('a', 2000, { text: 'y' })] });
  assert.strictEqual(r.items.length, 1); assert.strictEqual(r.items[0].note.text, 'x');
});
t('normalize trashedAt hỏng -> lấy giờ hiện tại', () => {
  const r = T.normalize({ items: [{ note: { id: 'a' }, trashedAt: 'x' }] });
  assert.ok(r.items[0].trashedAt > 0);
});
t('normalize giữ trashedAt hợp lệ', () => assert.strictEqual(T.normalize({ items: [mk('a', 12345)] }).items[0].trashedAt, 12345));
t('normalize tối đa 500, giữ mới nhất', () => {
  const items = []; for (let i = 0; i < 520; i++) items.push(mk('n' + i, 1000 + i));
  const r = T.normalize({ items });
  assert.strictEqual(r.items.length, 500);
  assert.ok(r.items.some(x => x.note.id === 'n519')); assert.ok(!r.items.some(x => x.note.id === 'n0'));
});
t('normalize không ném lỗi khi note là mảng', () => assert.strictEqual(T.normalize({ items: [{ note: [], trashedAt: 1 }] }).items.length, 0));
t('expiresAt = trashedAt + 30 ngày', () => assert.strictEqual(T.expiresAt(mk('a', 1000)), 1000 + T.TTL));
t('isExpired: trước hạn 1ms -> false', () => assert.strictEqual(T.isExpired(mk('a', 0), T.TTL - 1), false));
t('isExpired: đúng hạn -> true', () => assert.strictEqual(T.isExpired(mk('a', 0), T.TTL), true));
t('isExpired: 29 ngày -> false', () => assert.strictEqual(T.isExpired(mk('a', NOW - 29 * T.DAY), NOW), false));
t('isExpired: 31 ngày -> true', () => assert.strictEqual(T.isExpired(mk('a', NOW - 31 * T.DAY), NOW), true));
t('keepLive bỏ cái hết hạn', () => {
  const l = T.keepLive([mk('a', NOW - 40 * T.DAY), mk('b', NOW - 1 * T.DAY), mk('c', NOW - 30 * T.DAY)], NOW);
  assert.deepStrictEqual(l.map(x => x.note.id), ['b']);
});
t('keepLive không đổi mảng gốc', () => {
  const src = [mk('a', 0)]; T.keepLive(src, NOW); assert.strictEqual(src.length, 1);
});
t('restoreId giữ id nếu chưa bị chiếm', () => assert.strictEqual(T.restoreId('a', new Set(['b']), () => 'z'), 'a'));
t('restoreId cấp id mới khi trùng', () => assert.strictEqual(T.restoreId('a', new Set(['a']), () => 'z'), 'z'));
t('restoreId tránh cả id mới trùng', () => {
  let i = 0; const gen = () => (i++ < 2 ? 'a' : 'q');
  const r = T.restoreId('a', new Set(['a']), gen);
  assert.notStrictEqual(r, 'a');
});
t('listView mới nhất trước', () => {
  const v = T.listView([mk('a', 100), mk('b', 300), mk('c', 200)]);
  assert.deepStrictEqual(v.map(x => x.id), ['b', 'c', 'a']);
});
t('listView không đổi thứ tự mảng gốc', () => {
  const src = [mk('a', 100), mk('b', 300)]; T.listView(src); assert.strictEqual(src[0].note.id, 'a');
});
t('listView cắt text 200 ký tự', () => {
  const v = T.listView([mk('a', 1, { text: 'x'.repeat(500) })]); assert.strictEqual(v[0].text.length, 200);
});
t('listView dùng hàm lấy tiêu đề', () => {
  const v = T.listView([mk('a', 1, { text: 'Dòng 1\nDòng 2' })], s => s.split('\n')[0]); assert.strictEqual(v[0].title, 'Dòng 1');
});
t('listView expiresAt và màu', () => {
  const v = T.listView([mk('a', 1000)]); assert.strictEqual(v[0].expiresAt, 1000 + T.TTL); assert.strictEqual(v[0].color, 'pink');
});
t('listView text thiếu -> rỗng, màu thiếu -> yellow', () => {
  const v = T.listView([{ note: { id: 'a' }, trashedAt: 1 }]); assert.strictEqual(v[0].text, ''); assert.strictEqual(v[0].color, 'yellow');
});

console.log(n + ' ca đạt');
