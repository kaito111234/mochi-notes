'use strict';
// Chạy: node src/main/alarms/__tests__/alarm.test.js  (cần src/shared/recur.js)
const assert = require('assert');
const L = require('../alarmLogic.js');
const R = require('../../../shared/recur.js');

const MIN = 60000;
const at = (h, m, s = 0, d = 15) => new Date(2026, 9, d, h, m, s).getTime();
const S = { missedGraceMin: 30 };
const base = o => Object.assign({ id: 'a_1', label: 'x', time: '07:00', repeat: null, enabled: true, nextAt: null }, o);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('chưa tới giờ -> none', () => {
  const a = base({ nextAt: at(7, 0) });
  const d = L.decide(a, at(6, 59, 59), S, R);
  assert.strictEqual(d.action, 'none'); assert.strictEqual(d.nextAt, a.nextAt); assert.strictEqual(d.enabled, true);
});
t('tới giờ, một lần -> ring, tắt, nextAt null', () => {
  const d = L.decide(base({ nextAt: at(7, 0) }), at(7, 0, 1), S, R);
  assert.strictEqual(d.action, 'ring'); assert.strictEqual(d.enabled, false); assert.strictEqual(d.nextAt, null); assert.ok(d.clearSnooze);
});
t('lặp hằng ngày -> ring, nextAt = mai 07:00', () => {
  const d = L.decide(base({ repeat: { freq: 'daily' }, nextAt: at(7, 0) }), at(7, 0, 2), S, R);
  assert.strictEqual(d.action, 'ring'); assert.strictEqual(d.nextAt, at(7, 0, 0, 16)); assert.strictEqual(d.enabled, true);
});
t('không kêu đôi: áp kết quả rồi decide lại -> none', () => {
  const a = base({ repeat: { freq: 'daily' }, nextAt: at(7, 0) });
  const now = at(7, 0, 5);
  const d = L.decide(a, now, S, R); a.nextAt = d.nextAt; a.enabled = d.enabled;
  assert.strictEqual(L.decide(a, now + 1000, S, R).action, 'none');
});
t('trễ <= grace -> ring (bù); trễ > grace -> missed', () => {
  assert.strictEqual(L.decide(base({ nextAt: at(7, 0) }), at(7, 29), S, R).action, 'ring');
  const d = L.decide(base({ repeat: { freq: 'daily' }, nextAt: at(7, 0) }), at(8, 0), S, R);
  assert.strictEqual(d.action, 'missed'); assert.strictEqual(d.nextAt, at(7, 0, 0, 16));
});
t('lỡ + một lần -> tắt', () => {
  const d = L.decide(base({ nextAt: at(7, 0) }), at(9, 0), S, R);
  assert.strictEqual(d.action, 'missed'); assert.strictEqual(d.enabled, false); assert.strictEqual(d.nextAt, null);
});
t('đang tắt -> none, nextAt null', () => {
  const d = L.decide(base({ enabled: false, nextAt: at(7, 0) }), at(8, 0), S, R);
  assert.strictEqual(d.action, 'none'); assert.strictEqual(d.nextAt, null);
});
t('bật mà thiếu nextAt -> tính lại, không kêu', () => {
  const d = L.decide(base({ repeat: { freq: 'daily' } }), at(6, 0), S, R);
  assert.strictEqual(d.action, 'none'); assert.strictEqual(d.nextAt, at(7, 0));
});
t('hoãn: nextAt = now + N phút; kêu xong lặp tính lại từ repeat', () => {
  const now = at(7, 1);
  const p = L.snoozePatch(now, 10);
  assert.strictEqual(p.nextAt, now + 10 * MIN); assert.strictEqual(p.snoozedUntil, p.nextAt); assert.strictEqual(p.enabled, true);
  const a = base({ repeat: { freq: 'daily' } }, p); Object.assign(a, p);
  const d = L.decide(a, p.nextAt + 500, S, R);
  assert.strictEqual(d.action, 'ring'); assert.strictEqual(d.nextAt, at(7, 0, 0, 16));
});
t('missed tối đa 50', () => {
  const m = []; for (let i = 0; i < 60; i++) L.pushMissed(m, { alarmId: 'a', label: '', at: i });
  assert.strictEqual(m.length, 50); assert.strictEqual(m[0].at, 10);
});
t('safeSoundName chặn đường dẫn và dấu', () => {
  assert.strictEqual(L.safeSoundName('../../Nhạc báo.MP3'), 'Nhac_bao.mp3');
  assert.ok(!/[\\/]/.test(L.safeSoundName('a/b\\c.wav')));
});
console.log(n + ' test đạt');
