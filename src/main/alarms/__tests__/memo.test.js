'use strict';
const assert = require('assert');
const L = require('../memoLogic.js');

const at = (h, mi, d) => new Date(2026, 9, d || 14, h, mi); // 14/10/2026 là thứ Tư (3)
const M = (o) => Object.assign({ id: 'm_1', text: 'x', when: 'morning', enabled: true }, o);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('slotOf biên morning', () => {
  assert.strictEqual(L.slotOf(at(5, 59)), null);
  assert.strictEqual(L.slotOf(at(6, 0)), 'morning');
  assert.strictEqual(L.slotOf(at(10, 59)), 'morning');
});
t('slotOf noon', () => {
  assert.strictEqual(L.slotOf(at(11, 0)), 'noon');
  assert.strictEqual(L.slotOf(at(13, 59)), 'noon');
  assert.strictEqual(L.slotOf(at(14, 0)), null);
});
t('slotOf evening và khoảng trống', () => {
  assert.strictEqual(L.slotOf(at(16, 59)), null);
  assert.strictEqual(L.slotOf(at(17, 0)), 'evening');
  assert.strictEqual(L.slotOf(at(21, 59)), 'evening');
  assert.strictEqual(L.slotOf(at(22, 0)), null);
  assert.strictEqual(L.slotOf(at(0, 30)), null);
});
t('tick hiện memo đúng khung (đã hiện khung trước thì không lặp)', () => {
  const ms = [M({ id: 'a' }), M({ id: 'b', when: 'evening' }), M({ id: 'c', when: 'noon' })];
  assert.deepStrictEqual(L.dueMemos(ms, at(8, 0), 'tick').map(m => m.id), ['a']);
  assert.deepStrictEqual(L.dueMemos(ms, at(5, 0), 'tick'), []);
  ms[0].lastShownDay = '2026-10-14';
  assert.deepStrictEqual(L.dueMemos(ms, at(12, 0), 'tick').map(m => m.id), ['c']);
  ms[2].lastShownDay = '2026-10-14';
  assert.deepStrictEqual(L.dueMemos(ms, at(15, 0), 'tick'), []);
  assert.deepStrictEqual(L.dueMemos(ms, at(18, 0), 'tick').map(m => m.id), ['b']);
});
t('bù: mở máy sau khung thì hiện bù, nhiều khung bị lỡ gộp cùng lúc', () => {
  const ms = [M({ id: 'a' }), M({ id: 'c', when: 'noon' }), M({ id: 'b', when: 'evening' })];
  assert.deepStrictEqual(L.dueMemos(ms, at(11, 45), 'tick').map(m => m.id), ['a', 'c']);   // sau 11:30
  assert.deepStrictEqual(L.dueMemos(ms, at(15, 0), 'tick').map(m => m.id), ['a', 'c']);
  assert.deepStrictEqual(L.dueMemos(ms, at(23, 30), 'tick').map(m => m.id), ['a', 'c', 'b']); // đến hết ngày
});
t('gom nhiều memo cùng lúc', () => {
  const ms = [M({ id: 'a' }), M({ id: 'b' }), M({ id: 'c', enabled: false })];
  assert.deepStrictEqual(L.dueMemos(ms, at(9, 0), 'tick').map(m => m.id), ['a', 'b']);
});
t('startup chỉ memo startup, không phụ thuộc giờ', () => {
  const ms = [M({ id: 's', when: 'startup' }), M({ id: 'a' })];
  assert.deepStrictEqual(L.dueMemos(ms, at(3, 0), 'startup').map(m => m.id), ['s']);
});
t('lọc days (0=CN)', () => {
  const m = M({ days: [1, 2] });
  assert.strictEqual(L.dueMemos([m], at(9, 0), 'tick').length, 0);       // thứ Tư
  assert.strictEqual(L.dueMemos([m], at(9, 0, 13), 'tick').length, 1);   // thứ Ba
  const cn = M({ days: [0] });
  assert.strictEqual(L.dueMemos([cn], at(9, 0, 18), 'tick').length, 1);  // Chủ nhật 18/10
});
t('đã hiện hôm nay thì không hiện lại', () => {
  const m = M({ lastShownDay: '2026-10-14' });
  assert.strictEqual(L.dueMemos([m], at(9, 0), 'tick').length, 0);
});
t('qua ngày mới thì hiện lại', () => {
  const m = M({ lastShownDay: '2026-10-14' });
  assert.strictEqual(L.dueMemos([m], at(9, 0, 15), 'tick').length, 1);
});
t('markShown đặt lastShownDay', () => {
  const m = M();
  assert.strictEqual(L.markShown(m, at(9, 0)), true);
  assert.strictEqual(m.lastShownDay, '2026-10-14');
  assert.strictEqual(m.enabled, true);
  assert.strictEqual(L.markShown(m, at(9, 5)), false);
});
t('once tắt sau khi hiện', () => {
  const m = M({ once: true });
  L.markShown(m, at(9, 0));
  assert.strictEqual(m.enabled, false);
  assert.strictEqual(L.dueMemos([m], at(9, 0, 15), 'tick').length, 0);
});
t('máy rảnh thì tick không hiện; startup vẫn hiện', () => {
  const ms = [M(), M({ id: 's', when: 'startup' })];
  assert.strictEqual(L.dueMemos(ms, at(9, 0), 'tick', { idle: true }).length, 0);
  assert.strictEqual(L.dueMemos(ms, at(9, 0), 'tick', { idle: false }).length, 1);
  assert.strictEqual(L.dueMemos(ms, at(9, 0), 'startup', { idle: true }).length, 1);
});
t('before-shutdown', () => {
  const ms = [M({ id: 'q', when: 'before-shutdown' }), M({ id: 'q2', when: 'before-shutdown', lastShownDay: '2026-10-14' })];
  assert.deepStrictEqual(L.dueMemos(ms, at(23, 0), 'before-shutdown').map(m => m.id), ['q']);
});
t('dayKey giờ địa phương, có đệm số 0', () => {
  assert.strictEqual(L.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
t('titleFor', () => {
  assert.strictEqual(L.titleFor([{ when: 'morning' }]), 'Sáng nay nhớ nhé');
  assert.strictEqual(L.titleFor([{ when: 'morning' }, { when: 'noon' }]), 'Tớ dặn cậu nè');
  assert.strictEqual(L.titleFor([{ when: 'startup' }], true), 'Trước khi tắt máy…');
});
t('kind lạ không trả gì', () => { assert.deepStrictEqual(L.dueMemos([M()], at(9, 0), 'zzz'), []); });
console.log(`${n} ca đạt`);
