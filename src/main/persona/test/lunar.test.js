'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { solarToLunar } = require('../lunar.js');

const at = (d, m, y) => { const r = solarToLunar(d, m, y); return [r.day, r.month, r.year]; };
test('mùng 1 Tết các năm', () => {
  assert.deepEqual(at(17, 2, 2026), [1, 1, 2026]);
  assert.deepEqual(at(6, 2, 2027), [1, 1, 2027]);
  assert.deepEqual(at(29, 1, 2025), [1, 1, 2025]);
  assert.deepEqual(at(10, 2, 2024), [1, 1, 2024]);
});
test('Trung thu 2026 = 15/8', () => assert.deepEqual(at(25, 9, 2026), [15, 8, 2026]));
test('ngày liền trước Tết 2026 là ngày cuối tháng chạp (tháng 12 năm Ất Tỵ thiếu: 29)', () => {
  // Đề bài ghi 30/12 nhưng thuật toán Hồ Ngọc Đức (và lịch chính thức) cho 29/12/2025 — tháng chạp thiếu.
  assert.deepEqual(at(16, 2, 2026), [29, 12, 2025]);
  assert.equal(solarToLunar(16, 2, 2026).leap, false);
});
test('tháng nhuận được đánh dấu leap (nhuận 6 năm 2025)', () => {
  const r = solarToLunar(25, 7, 2025);
  assert.equal(r.month, 6); assert.equal(r.leap, true);
});
