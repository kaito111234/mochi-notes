'use strict';
// Test index.js của phòng game: chạy bằng node thường, không cần electron.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createGame } = require('../index');
const box_ = require('../logic/box');
const { loadCatalog } = require('../catalog');

const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();
const MIN = 60000;

function setup(extra) {
  const bus = new EventEmitter();
  const notes = {};
  const sent = [];
  const saves = { n: 0 };
  const store = {
    section: (name, d, norm) => norm(d()),
    save: () => { saves.n++; }
  };
  const clock = { t: T0 };
  const ctx = Object.assign({
    bus, store, findNote: id => notes[id] || null,
    persona: { pick: (ev, vars) => ({ text: `[${ev}] ${vars.item}`, face: 'happy', anim: 'idle' }) },
    windows: { game: { fake: true } },
    alive: () => true,
    send: (w, ch, d) => sent.push([ch, d])
  }, extra || {});
  const seq = [0.5];
  const game = createGame(ctx, { now: () => clock.t, rng: () => seq[0], catalog: loadCatalog() });
  const ev = {};
  for (const n of ['game:reward', 'game:levelup', 'game:mode', 'game:outfit', 'persona:line']) {
    ev[n] = [];
    bus.on(n, p => ev[n].push(p));
  }
  return { bus, ctx, game, notes, ev, sent, clock, saves, seq };
}

test('xong note tạo 5 phút trước: game:reward candy 15, xu tăng', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN, reminder: { due: 1 } };
  s.bus.emit('reminder:done', { noteId: 'a', onTime: true });
  assert.equal(s.ev['game:reward'].length, 1);
  const r = s.ev['game:reward'][0];
  assert.equal(r.candy >= 15, true);
  assert.equal(r.reason, 'done');
  assert.equal(s.game.box.stats.candy, 100 + r.candy);
  assert.ok(s.sent.some(m => m[0] === 'game:changed'));
  assert.equal(s.game.box.quests.daily[0].progress, 1);
});

test('xong note: thưởng thành tích gộp vào đúng 1 game:reward', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN, reminder: { due: 1 } };
  s.bus.emit('reminder:done', { noteId: 'a', onTime: true });
  // done 15 + first_done 20 = 35
  assert.equal(s.ev['game:reward'].length, 1);
  assert.equal(s.ev['game:reward'][0].candy, 35);
  assert.ok(s.game.box.achievements.first_done);
});

test('note mới tạo (< 2 phút): không thưởng', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: T0 - 10000, reminder: { due: 1 } };
  s.bus.emit('reminder:done', { noteId: 'a', onTime: true });
  assert.equal(s.ev['game:reward'].length, 0);
  assert.equal(s.game.box.stats.candy, 100);
  assert.equal(s.game.box.quests.daily[0].progress, 0);
});

test('tắt game: không đổi xu, phát mode normal; bật lại phát mode thật', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN, reminder: { due: 1 } };
  const v = s.game.actions.setEnabled(false);
  assert.equal(v.enabled, false);
  const m = s.ev['game:mode'].at(-1);
  assert.deepEqual(m, { mode: 'normal', energy: 100, mood: 70, level: 1 });
  assert.deepEqual(s.ev['game:outfit'].at(-1), { worn: {} });
  s.bus.emit('reminder:done', { noteId: 'a', onTime: true });
  assert.equal(s.game.box.stats.candy, 100);
  assert.equal(s.ev['game:reward'].length, 0);
  assert.equal(s.game.actions.pull(1).reason, 'Game hóa đang tắt');
  s.game.actions.setEnabled(true);
  assert.equal(s.ev['game:mode'].at(-1).mood, 70);
  s.bus.emit('reminder:done', { noteId: 'a', onTime: true });
  assert.equal(s.ev['game:reward'].length, 1);
});

test('người nghe ngoài ném lỗi không làm game sập', () => {
  const s = setup();
  s.bus.on('game:reward', () => { throw new Error('nghe hỏng'); });
  s.bus.on('persona:line', () => { throw new Error('nghe hỏng'); });
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN, reminder: { due: 1 } };
  assert.doesNotThrow(() => s.bus.emit('reminder:done', { noteId: 'a' }));
  assert.equal(s.game.box.counters.done, 1);
  const r = s.game.actions.pull(1);
  assert.equal(r.ok, true);
});

test('persona.pick ném lỗi / ctx.findNote ném lỗi: vẫn không ném ra bus', () => {
  const s = setup({ persona: { pick: () => { throw new Error('x'); } }, findNote: () => { throw new Error('y'); } });
  assert.doesNotThrow(() => s.bus.emit('reminder:done', { noteId: 'a' }));
  const r = s.game.actions.pull(1);
  assert.equal(r.ok, true);
  assert.ok(r.line && r.line.length <= 80);
});

test('payload rác không ném lỗi và không cho thưởng', () => {
  const s = setup();
  const junk = [undefined, null, {}, 'abc', 42, [], true, { noteId: {} }, { noteId: '' }, { index: -1, done: true },
    { index: 'x', done: true }, { kind: 5 }, { posture: null }];
  const names = ['reminder:done', 'note:checkItem', 'note:created', 'note:trashed', 'alarm:stopped',
    'pet:interact', 'pet:posture', 'app:idle', 'app:resume', 'app:startup'];
  for (const n of names) for (const j of junk) assert.doesNotThrow(() => s.bus.emit(n, j), n);
  // chỉ các sự kiện không cần payload mới được thưởng (note:created lần đầu, alarm:stopped...) — xu không âm, không NaN
  assert.ok(Number.isFinite(s.game.box.stats.candy) && s.game.box.stats.candy >= 100);
  assert.equal(s.game.box.counters.done, 0);
  assert.equal(s.game.box.counters.checkItems, 0);
  // IPC với đối số rác
  for (const ch of s.game.channels) for (const j of junk) assert.doesNotThrow(() => s.game.ipc[ch](j, j), ch);
});

test('note:checkItem, note:created, alarm:stopped, pat-head, trashed', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN };
  s.bus.emit('note:checkItem', { noteId: 'a', index: 0, done: true });
  assert.equal(s.game.box.counters.checkItems, 1);
  assert.ok(s.game.box.firstUse.checklist);
  s.bus.emit('note:created', { note: { id: 'b' } });
  assert.ok(s.game.box.firstUse.note);
  s.bus.emit('alarm:stopped', { alarmId: 'x' });
  assert.equal(s.game.box.counters.alarms, 1);
  assert.ok(s.game.box.firstUse.alarm);
  s.bus.emit('pet:interact', { kind: 'pat-head' });
  assert.equal(s.game.box.counters.pats, 1);
  assert.equal(s.game.box.quests.daily[2].progress, 1);
  assert.ok(s.game.box.firstUse.pat);
  s.bus.emit('note:trashed', { noteId: 'a' });
  assert.equal(s.game.box.counters.trashed, 1);
  assert.equal(s.game.box.quests.daily[1].progress, 1);
});

test('pull: trừ đúng xu, thiếu xu thì có reason', () => {
  const s = setup();
  s.game.box.stats.candy = 120;
  const r = s.game.actions.pull(1);
  assert.equal(r.ok, true);
  // 120 - 50 + 20 (lần đầu gacha) [+ thành tích nếu có]
  assert.equal(s.game.box.stats.candy, 120 - 50 + 20);
  assert.equal(r.results.length, 1);
  assert.equal(r.view.stats.candy, 90);
  assert.ok(r.line && r.line.length <= 80);
  assert.equal(s.ev['persona:line'].at(-1).priority, 30);
  assert.equal(s.ev['persona:line'].at(-1).ttlMs, 6000);
  assert.match(s.ev['persona:line'].at(-1).text, /^\[gacha_win\]/);
  const before = s.game.box.stats.candy;
  s.game.box.stats.candy = 499;
  const bad = s.game.actions.pull(10);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'Chưa đủ xu');
  assert.equal(s.game.box.stats.candy, 499);
  assert.equal(s.game.actions.pull(5).ok, false);
  assert.ok(before > 0);
  s.game.box.stats.candy = 600;
  const ten = s.game.actions.pull(10);
  assert.equal(ten.results.length, 11);
  assert.equal(s.game.box.stats.candy, 100 + 40);   // + thành tích pull_10
});

test('pull toàn trùng dùng câu gacha_dup', () => {
  const s = setup();
  s.game.box.stats.candy = 1000;
  s.game.actions.pull(1);
  s.game.actions.pull(1);   // rng cố định -> cùng món -> trùng
  assert.match(s.ev['persona:line'].at(-1).text, /^\[gacha_dup\]/);
  assert.ok(s.game.box.inventory.shards > 0);
});

test('wear: món chưa có bị từ chối; có rồi thì mặc, cởi, phát game:outfit', () => {
  const s = setup();
  const cat = loadCatalog();
  const hat = cat.items.find(i => i.slot === 'hat');
  let v = s.game.actions.wear('hat', hat.id);
  assert.deepEqual(v.worn, {});
  s.game.box.inventory.items[hat.id] = { count: 1, firstAt: 1 };
  v = s.game.actions.wear('hat', hat.id);
  assert.deepEqual(v.worn, { hat: hat.id });
  assert.deepEqual(s.ev['game:outfit'].at(-1), { worn: { hat: hat.id } });
  assert.ok(s.game.box.firstUse.outfit);
  // sai khe, khe lạ
  const glasses = cat.items.find(i => i.slot === 'glasses');
  s.game.box.inventory.items[glasses.id] = { count: 1, firstAt: 1 };
  assert.deepEqual(s.game.actions.wear('hat', glasses.id).worn, { hat: hat.id });
  assert.deepEqual(s.game.actions.wear('__proto__', glasses.id).worn, { hat: hat.id });
  v = s.game.actions.wear('hat', null);
  assert.deepEqual(v.worn, {});
});

test('bộ đồ: lưu (cắt 24 ký tự, tối đa 6), áp dụng, xóa', () => {
  const s = setup();
  const hat = loadCatalog().items.find(i => i.slot === 'hat');
  s.game.box.inventory.items[hat.id] = { count: 1, firstAt: 1 };
  s.game.actions.wear('hat', hat.id);
  let v = s.game.actions.saveOutfit('x'.repeat(40));
  assert.equal(v.outfits[0].name.length, 24);
  for (let i = 0; i < 8; i++) v = s.game.actions.saveOutfit('b' + i);
  assert.equal(v.outfits.length, 6);
  s.game.actions.wear('hat', null);
  v = s.game.actions.applyOutfit(v.outfits[0].id);
  assert.deepEqual(v.worn, { hat: hat.id });
  v = s.game.actions.deleteOutfit(v.outfits[0].id);
  assert.equal(v.outfits.length, 5);
});

test('claim nhiệm vụ cộng xu; chưa đủ tiến độ thì từ chối; không nhận hai lần', () => {
  const s = setup();
  let r = s.game.actions.claim('daily.pat1');
  assert.equal(r.ok, false);
  s.bus.emit('pet:interact', { kind: 'pat-head' });
  const before = s.game.box.stats.candy;
  r = s.game.actions.claim('daily.pat1');
  assert.equal(r.ok, true);
  assert.equal(s.game.box.stats.candy, before + 30);
  assert.equal(s.ev['game:reward'].at(-1).reason, 'quest:daily.pat1');
  assert.equal(s.game.actions.claim('daily.pat1').ok, false);
  assert.equal(s.game.actions.claim(null).ok, false);
});

test('feed: trừ xu theo giá, tăng chỉ số, giảm hiệu quả khi ăn lại', () => {
  const s = setup();
  const food = loadCatalog().foods[0];
  s.game.box.stats.candy = 1000;
  s.game.box.stats.mood = 40;
  const r = s.game.actions.feed(food.id);
  assert.equal(r.ok, true);
  assert.equal(r.factor, 1);
  assert.equal(s.game.box.stats.candy, 1000 - food.price + 20);
  assert.ok(s.game.box.stats.mood > 40);
  assert.equal(s.game.actions.feed(food.id).factor, 0.6);
  assert.equal(s.game.actions.feed('nope').ok, false);
  s.game.box.stats.candy = 0;
  assert.equal(s.game.actions.feed(food.id).reason, 'Chưa đủ xu');
});

test('view đúng hình dạng mục 8', () => {
  const s = setup();
  const v = s.game.view();
  for (const k of ['enabled', 'stats', 'level', 'nextLevelExp', 'levelExp', 'mode', 'items', 'shards', 'worn', 'outfits',
    'pity', 'pityLeft', 'totalPulls', 'history', 'quests', 'achievements', 'log', 'today', 'rates', 'cost', 'shardPrice', 'foodFactor']) {
    assert.ok(k in v, k);
  }
  assert.equal(v.level, 1); assert.equal(v.levelExp, 0); assert.equal(v.nextLevelExp, 100);
  assert.equal(v.quests.daily.length, 3);
  assert.equal(v.pityLeft, 30);
  assert.ok(Math.abs(Object.values(v.rates.effective).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.doesNotThrow(() => JSON.stringify(v));
});

test('tick mỗi phút: ngủ thì hồi năng lượng; mode đổi thì phát game:mode', () => {
  const s = setup();
  s.bus.emit('app:startup', {});
  assert.equal(s.ev['game:mode'].length, 1);
  assert.equal(s.ev['game:mode'][0].mode, 'happy');
  s.game.box.stats.energy = 10;
  s.bus.emit('pet:posture', { posture: 'sleep' });
  s.game.tick();
  assert.equal(s.game.box.stats.energy, 11);
  assert.equal(s.ev['game:mode'].at(-1).mode, 'tired');
  s.bus.emit('pet:posture', { posture: 'idle' });
  s.game.tick();
  assert.ok(s.game.box.stats.energy < 11);
  s.bus.emit('app:idle', {});
  s.game.tick();
  assert.ok(s.game.box.stats.energy > 10.5);
});

test('lên level phát game:levelup', () => {
  const s = setup();
  s.game.box.stats.exp = 95;
  s.notes.a = { id: 'a', createdAt: T0 - 5 * MIN };
  s.bus.emit('reminder:done', { noteId: 'a' });
  assert.deepEqual(s.ev['game:levelup'], [{ level: 2 }]);
});
