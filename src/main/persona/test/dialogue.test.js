'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = require('../../../shared/dialogue.js');

const L = (id, event, text, extra) => Object.assign({ id, event, text }, extra);

test('lọc cond: hour, mode, khoảng bao gồm hai đầu', () => {
  const lines = [L('a', 'idle', 'a', { cond: { hour: [8, 11] } }), L('b', 'idle', 'b', { cond: { mode: ['sad'] } })];
  assert.equal(D.pick(lines, 'idle', {}, { hour: 8, mode: 'normal' }, []).id, 'a');
  assert.equal(D.pick(lines, 'idle', {}, { hour: 11, mode: 'normal' }, []).id, 'a');
  assert.equal(D.pick(lines, 'idle', {}, { hour: 12, mode: 'normal' }, []), null);
  assert.equal(D.pick(lines, 'idle', {}, { hour: 12, mode: 'sad' }, []).id, 'b');
});

test('khoá state thiếu thì bỏ qua cond', () => {
  const lines = [L('a', 'idle', 'a', { cond: { hour: [8, 11], energy: [0, 10], mode: ['sad'] } })];
  assert.equal(D.pick(lines, 'idle', {}, {}, []).id, 'a');
  assert.equal(D.pick(lines, 'idle', {}, { energy: null }, []).id, 'a');
  assert.equal(D.pick(lines, 'idle', {}, { energy: 50 }, []), null);
});

test('weekday và intent là danh sách thành viên', () => {
  const l = L('a', 'due', 'a {title}', { cond: { weekday: [1, 2], intent: ['meet'] } });
  assert.ok(D.matches(l, { weekday: 2, intent: 'meet' }));
  assert.ok(!D.matches(l, { weekday: 3, intent: 'meet' }));
  assert.ok(!D.matches(l, { weekday: 1, intent: 'pay' }));
});

test('trọng số: rng giả, weight 0 bị loại, phân phối', () => {
  const lines = [L('a', 'idle', 'a', { weight: 1 }), L('b', 'idle', 'b', { weight: 3 }), L('z', 'idle', 'z', { weight: 0 })];
  assert.equal(D.pick(lines, 'idle', {}, {}, [], () => 0).id, 'a');
  assert.equal(D.pick(lines, 'idle', {}, {}, [], () => 0.5).id, 'b');
  assert.equal(D.pick(lines, 'idle', {}, {}, [], () => 0.999).id, 'b');
  const c = { a: 0, b: 0, z: 0 };
  let seed = 12345;
  const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 4000; i++) c[D.pick(lines, 'idle', {}, {}, [], rng).id]++;
  assert.equal(c.z, 0);
  assert.ok(c.b / c.a > 2.4 && c.b / c.a < 3.8, JSON.stringify(c));
});

test('chống lặp 5 câu gần nhất', () => {
  const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(i => L(i, 'idle', i));
  for (let k = 0; k < 20; k++) {
    const r = D.pick(lines, 'idle', {}, {}, ['x', 'a', 'b', 'c', 'd', 'e']);
    assert.ok(['f', 'g'].includes(r.id));
  }
  // chỉ 5 phần tử cuối được tính
  const r = D.pick([L('a', 'idle', 'a'), L('b', 'idle', 'b')], 'idle', {}, {}, ['a', 'x', 'x', 'x', 'x', 'x'], () => 0);
  assert.equal(r.id, 'a');
});

test('cạn câu thì cho lặp nhưng tránh câu cuối', () => {
  const lines = [L('a', 'idle', 'a'), L('b', 'idle', 'b')];
  for (let k = 0; k < 20; k++) assert.equal(D.pick(lines, 'idle', {}, {}, ['a', 'b']).id, 'a');
  assert.equal(D.pick([L('a', 'idle', 'a')], 'idle', {}, {}, ['a']).id, 'a');
});

test('thay biến, biến lạ giữ nguyên, câu thiếu biến bị bỏ', () => {
  assert.equal(D.fill('Chào {name}, {title}! {Lạ} {x}', { name: 'Hà', title: 5 }), 'Chào Hà, 5! {Lạ} {x}');
  const lines = [L('a', 'due', 'Tới giờ {title} rồi'), L('b', 'due', 'Tới giờ rồi')];
  assert.equal(D.pick(lines, 'due', { title: 'họp' }, {}, [], () => 0).text, 'Tới giờ họp rồi');
  assert.equal(D.pick(lines, 'due', {}, {}, [], () => 0).id, 'b');
  assert.equal(D.pick(lines, 'due', { title: '' }, {}, [], () => 0).id, 'b');
  assert.equal(D.pick([lines[0]], 'due', { title: null }, {}, []), null);
});

test('ưu tiên câu khớp intent', () => {
  const lines = [L('g', 'due', 'chung {title}'), L('m', 'due', 'họp {title}', { cond: { intent: ['meet'] } })];
  for (let k = 0; k < 10; k++) assert.equal(D.pick(lines, 'due', { title: 't' }, { intent: 'meet' }, []).id, 'm');
  assert.equal(D.pick(lines, 'due', { title: 't' }, { intent: 'pay' }, []).id, 'g');
  // Intent nghiêm: state không có intent thì câu theo intent bị loại (không nhắc "uống thuốc" cho note thường).
  for (let k = 0; k < 10; k++) assert.equal(D.pick(lines, 'due', { title: 't' }, {}, [], () => 0.99).id, 'g');
  assert.equal(D.pick([lines[1]], 'due', { title: 't' }, {}, []), null);
  assert.ok(!D.matches(lines[1], {}));
  assert.ok(D.matches(lines[1], { intent: 'meet' }));
  assert.ok(D.matches(L('x', 'due', 'x', { cond: { hour: [1, 2] } }), {})); // khoá khác vẫn bỏ qua khi state thiếu
});

test('event mới: due_again/knock cần {title}, expired_* tồn tại', () => {
  for (const ev of ['due_again', 'knock', 'outfit', 'expired_done', 'expired_overdue', 'expired_checklist']) assert.ok(D.EVENTS.includes(ev), ev);
  assert.ok(D.REMIND_EVENTS.includes('due_again') && D.REMIND_EVENTS.includes('knock'));
  assert.ok(D.validate([L('a', 'due_again', 'lại nữa')]).some(e => e.includes('thiếu {title}')));
  assert.ok(D.validate([L('b', 'knock', 'cốc cốc')]).some(e => e.includes('thiếu {title}')));
  assert.deepEqual(D.validate([L('c', 'knock', 'cốc cốc {title}'), L('d', 'expired_done', 'vứt nè'), L('e', 'outfit', 'đẹp không')]), []);
});

test('face/anim/effects được trả về, thiếu thì undefined', () => {
  const r = D.pick([L('a', 'idle', 'a', { face: 'shy', effects: { mood: 1 } })], 'idle', {}, {}, []);
  assert.equal(r.face, 'shy'); assert.equal(r.anim, undefined); assert.deepEqual(r.effects, { mood: 1 });
});

test('validate bắt lỗi', () => {
  const bad = [
    L('a', 'idle', 'ok'), L('a', 'idle', 'trùng'),
    { event: 'idle', text: 'thiếu id' }, { id: 'e1', text: 'thiếu event' }, { id: 'e2', event: 'idle' },
    L('e3', 'lạ', 'x'), L('e4', 'idle', 'x', { face: 3 }), L('e5', 'idle', 'x', { anim: {} }),
    L('e6', 'idle', 'x', { cond: { foo: [1, 2] } }), L('e7', 'idle', 'x', { cond: { hour: [9, 3] } }),
    L('e8', 'due', 'không có tiêu đề'), L('e9', 'alarm', 'không nhãn'),
    L('e10', 'idle', 'x'.repeat(81)), L('e11', 'due', '{title} ' + 'x'.repeat(115)), L('e12', 'idle', '{a}{b}{c}{d}{e}{f}{g}'),
  ];
  const errs = D.validate(bad);
  for (const key of ['id trùng', 'thiếu id', 'thiếu event', 'thiếu text', 'event lạ', 'face sai', 'anim sai', 'khoá lạ', 'khoảng sai',
    'e8: nhắc lịch thiếu {title}', 'e9: báo thức thiếu {label}', 'e10: quá dài', 'e11: quá dài', 'e12: quá dài']) {
    assert.ok(errs.some(e => e.includes(key)), 'thiếu lỗi: ' + key + '\n' + errs.join('\n'));
  }
  assert.deepEqual(D.validate([L('ok', 'due', 'Tới giờ {title}', { cond: { hour: [1, 2] } })]), []);
  assert.equal(D.EVENTS.length, 44);
});

test('kho thoại assets/dialogue/vi.json hợp lệ', t => {
  const file = path.join(__dirname, '../../../../assets/dialogue/vi.json');
  if (!fs.existsSync(file)) return t.skip('chưa có vi.json');
  const lines = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(D.validate(lines), []);
  // 6 event mới chưa bắt buộc có câu trong vi.json (phòng thoại sẽ bổ sung).
  const NEW = ['due_again', 'knock', 'outfit', 'expired_done', 'expired_overdue', 'expired_checklist',
    'capture', 'capture_many', 'checkin', 'quest_done', 'expire_ask', 'expire_keep', 'holiday'];
  for (const ev of D.EVENTS.filter(e => !NEW.includes(e))) {
    assert.ok(lines.some(l => l.event === ev && !l.cond), 'event ' + ev + ' chưa có câu không cond');
  }
});

// ---- Đợt 3: cond date/lunar/item/rarity, ưu tiên nhóm ----
const first = () => 0;
test('cond.date: bao gồm hai đầu, vòng cuối năm, nghiêm khi thiếu state', () => {
  const l = { id: 'x', event: 'holiday', text: 'a', cond: { date: ['12-30', '01-02'] } };
  for (const d of ['12-30', '12-31', '01-01', '01-02']) assert.ok(D.matches(l, { date: d }), d);
  for (const d of ['12-29', '01-03', '06-15']) assert.ok(!D.matches(l, { date: d }), d);
  assert.ok(!D.matches(l, {}));
  const m = { id: 'y', event: 'holiday', text: 'a', cond: { date: ['02-14', '02-14'] } };
  assert.ok(D.matches(m, { date: '02-14' })); assert.ok(!D.matches(m, { date: '02-15' }));
});
test('cond.lunar tương tự, nghiêm', () => {
  const l = { id: 'x', event: 'holiday', text: 'a', cond: { lunar: ['12-28', '01-03'] } };
  assert.ok(D.matches(l, { lunar: '12-30' })); assert.ok(D.matches(l, { lunar: '01-01' }));
  assert.ok(!D.matches(l, { lunar: '05-05' })); assert.ok(!D.matches(l, {}));
});
test('cond.item/rarity nghiêm, lọc theo danh sách', () => {
  const l = { id: 'x', event: 'feed', text: 'a', cond: { item: ['f1', 'f2'] } };
  assert.ok(D.matches(l, { item: 'f2' })); assert.ok(!D.matches(l, { item: 'f3' })); assert.ok(!D.matches(l, {}));
  const r = { id: 'y', event: 'gacha_win', text: 'a', cond: { rarity: ['epic'] } };
  assert.ok(D.matches(r, { rarity: 'epic' })); assert.ok(!D.matches(r, { rarity: 'rare' })); assert.ok(!D.matches(r, {}));
});
test('pick ưu tiên item > rarity/intent > chung, rơi nhóm kế khi chống lặp cạn', () => {
  const lines = [
    { id: 'gen', event: 'feed', text: 'g' },
    { id: 'rar', event: 'feed', text: 'r', cond: { rarity: ['rare'] } },
    { id: 'itm', event: 'feed', text: 'i', cond: { item: ['f1'] } }
  ];
  const st = { item: 'f1', rarity: 'rare' };
  assert.equal(D.pick(lines, 'feed', {}, st, [], first).id, 'itm');
  assert.equal(D.pick(lines, 'feed', {}, st, ['itm'], first).id, 'rar');
  assert.equal(D.pick(lines, 'feed', {}, st, ['itm', 'rar'], first).id, 'gen');
  assert.equal(D.pick(lines, 'feed', {}, {}, [], first).id, 'gen');
  // Cạn hết: không kẹt, tránh câu cuối.
  const only = [lines[2]];
  assert.equal(D.pick(only, 'feed', {}, st, ['itm'], first).id, 'itm');
});
test('validate: khoá date/lunar/item/rarity', () => {
  const ok = (cond, ev) => D.validate([{ id: 'a', event: ev || 'holiday', text: 'x', cond }]);
  assert.deepEqual(ok({ date: ['12-30', '01-02'] }), []);
  assert.deepEqual(ok({ lunar: ['01-01', '01-03'] }), []);
  assert.deepEqual(ok({ item: ['a'], rarity: ['rare'] }, 'feed'), []);
  assert.ok(ok({ date: ['1-1', '01-02'] }).length);
  assert.ok(ok({ date: ['13-01', '01-02'] }).length);
  assert.ok(ok({ lunar: ['01-01'] }).length);
  assert.ok(ok({ item: [] }, 'feed').length);
  assert.ok(ok({ rarity: 'rare' }, 'feed').length);
  assert.ok(ok({ foo: [1] }).length);
});
test('event mới có trong EVENTS, không thuộc REMIND_EVENTS', () => {
  for (const e of ['capture', 'capture_many', 'checkin', 'quest_done', 'expire_ask', 'expire_keep', 'holiday']) {
    assert.ok(D.EVENTS.includes(e), e); assert.ok(!D.REMIND_EVENTS.includes(e), e);
  }
  assert.deepEqual(D.validate([{ id: 'c', event: 'capture', text: 'Ghi {title} nha' }]), []);
});
