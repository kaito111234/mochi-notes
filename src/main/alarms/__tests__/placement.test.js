'use strict';
const assert = require('assert');
const { placeAvoiding: P, needsMove, intersects, overlapArea } = require('../placement.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const WA = { x: 0, y: 0, width: 1440, height: 860 };
const S = { width: 360, height: 240 };
const box = p => ({ x: p.x, y: p.y, width: S.width, height: S.height });

t('không có bé: góc dưới phải', () => assert.deepStrictEqual(P(WA, S, null), { x: 1440 - 360 - 12, y: 860 - 240 - 12 }));
t('undefined như null', () => assert.deepStrictEqual(P(WA, S), P(WA, S, null)));
t('margin tuỳ chọn', () => assert.deepStrictEqual(P(WA, S, null, 20), { x: 1060, y: 600 }));
t('workArea lệch gốc (thanh tác vụ trên)', () => {
  const wa = { x: 0, y: 40, width: 1440, height: 820 };
  assert.deepStrictEqual(P(wa, S, null), { x: 1068, y: 40 + 820 - 240 - 12 });
});
t('bé ở xa: không dời', () => {
  const pet = { x: 100, y: 100, width: 120, height: 120 };
  assert.deepStrictEqual(P(WA, S, pet), P(WA, S, null));
});
t('bé ở góc dưới phải: lên trên bé', () => {
  const pet = { x: 1300, y: 700, width: 120, height: 140 };
  const p = P(WA, S, pet);
  assert.ok(!intersects(box(p), pet));
  assert.strictEqual(p.x, 1068);
  assert.strictEqual(p.y, 700 - 240 - 12);
});
t('bé cao sát đỉnh: sang trái bé', () => {
  const pet = { x: 1250, y: 20, width: 160, height: 820 };
  const p = P(WA, S, pet);
  assert.ok(!intersects(box(p), pet));
  assert.strictEqual(p.y, 608);
  assert.strictEqual(p.x, 1250 - 360 - 12);
});
t('kết quả luôn nằm trong workArea', () => {
  for (const pet of [{ x: 1300, y: 700, width: 120, height: 140 }, { x: 0, y: 0, width: 50, height: 50 }, { x: 700, y: 400, width: 100, height: 100 }]) {
    const p = P(WA, S, pet);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + 360 <= 1440 && p.y + 240 <= 860, JSON.stringify(p));
  }
});
t('bé ở giữa màn hình: không đè', () => {
  const pet = { x: 600, y: 300, width: 200, height: 200 };
  assert.ok(!intersects(box(P(WA, S, pet)), pet));
});
t('bé chiếm góc dưới trái và dưới phải: lên trên', () => {
  const pets = [{ x: 1300, y: 700, width: 120, height: 140 }, { x: 10, y: 700, width: 120, height: 140 }];
  const p = P(WA, S, pets);
  for (const r of pets) assert.ok(!intersects(box(p), r));
});
t('hai vùng tránh (chuông + bé) không chồng', () => {
  const pet = { x: 1300, y: 700, width: 120, height: 140 };
  const ring = { x: 1068, y: 600, width: 360, height: 240 };
  const p = P(WA, { width: 360, height: 300 }, [pet, ring]);
  assert.ok(!intersects({ x: p.x, y: p.y, width: 360, height: 300 }, pet));
  assert.ok(!intersects({ x: p.x, y: p.y, width: 360, height: 300 }, ring));
});
t('rect hỏng bị bỏ qua', () => {
  assert.deepStrictEqual(P(WA, S, { x: NaN, y: 0, width: 10, height: 10 }), P(WA, S, null));
  assert.deepStrictEqual(P(WA, S, { x: 1, y: 1, width: 0, height: 0 }), P(WA, S, null));
  assert.deepStrictEqual(P(WA, S, [null, undefined, 'x']), P(WA, S, null));
});
t('workArea hỏng: dùng mặc định, không ném lỗi', () => {
  const p = P(null, S, null);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
t('cửa sổ lớn hơn workArea: không NaN', () => {
  const p = P({ x: 0, y: 0, width: 200, height: 100 }, S, null);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
t('không còn chỗ trống: chọn chỗ ít chồng nhất và vẫn hợp lệ', () => {
  const pet = { x: 0, y: 0, width: 1440, height: 860 };
  const p = P(WA, S, pet);
  assert.ok(p.x >= 0 && p.y >= 0);
});
t('intersects: chạm cạnh không tính giao', () => {
  assert.strictEqual(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), false);
  assert.strictEqual(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 10, height: 10 }), true);
  assert.strictEqual(intersects(null, { x: 0, y: 0, width: 1, height: 1 }), false);
});
t('overlapArea', () => {
  assert.strictEqual(overlapArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), 25);
  assert.strictEqual(overlapArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 50, y: 50, width: 10, height: 10 }), 0);
});
t('needsMove: chỉ khi giao', () => {
  const b = { x: 1068, y: 608, width: 360, height: 240 };
  assert.strictEqual(needsMove(b, { x: 1300, y: 700, width: 100, height: 100 }), true);
  assert.strictEqual(needsMove(b, { x: 10, y: 10, width: 100, height: 100 }), false);
  assert.strictEqual(needsMove(b, null), false);
  assert.strictEqual(needsMove(b, [null, { x: 1100, y: 620, width: 10, height: 10 }]), true);
});
t('kết quả là số nguyên', () => {
  const p = P(WA, S, { x: 1300.4, y: 700.7, width: 120.2, height: 140.1 });
  assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
});
console.log(n + ' ca placement xanh');
