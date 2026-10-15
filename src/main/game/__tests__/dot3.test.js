'use strict';
// Đợt 3: checklist idempotent, điểm danh, túi đồ ăn, nhiệm vụ tuần, album, migrate, tắt game hoá.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createGame } = require('../index');
const box_ = require('../logic/box');
const quests = require('../logic/quests');
const checklist = require('../logic/checklist');
const checkinLib = require('../logic/checkin');
const economy = require('../logic/economy');
const { weekKey } = require('../logic/time');
const { loadCatalog } = require('../catalog');

const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();   // thứ Hai
const MIN = 60000, DAY = 86400000;
const catalog = loadCatalog();
const EVENTS = ['game:reward', 'game:levelup', 'game:fed', 'persona:line', 'game:mode'];

function setup(extra, stored) {
  const bus = new EventEmitter();
  const notes = {};
  const store = { section: (name, d, norm) => norm(stored || d()), save: () => {}, data: { notes: [] } };
  const clock = { t: T0 };
  const ctx = Object.assign({
    bus, store, findNote: id => notes[id] || null,
    persona: { pick: (ev, vars) => ({ text: `[${ev}] ${vars.item}`, face: 'happy', anim: 'idle' }) },
    windows: { game: {} }, alive: () => true, send: () => {}
  }, extra || {});
  const game = createGame(ctx, { now: () => clock.t, rng: () => 0.5, catalog });
  const ev = {};
  for (const n of EVENTS) { ev[n] = []; bus.on(n, p => ev[n].push(p)); }
  return { bus, ctx, game, notes, ev, clock, box: game.box };
}
const ck = (...t) => t.map(x => `<div data-ck="0">${x}</div>`).join('');
const OLD = T0 - 10 * MIN;

// ---------- logic/checklist ----------
test('checklist.lines: chỉ div[data-ck] con trực tiếp, đúng thứ tự, bỏ lồng', () => {
  const html = '<div>tiêu đề</div><div data-ck="0">A</div><ul><li><div data-ck="1">trong ul</div></li></ul><DIV DATA-CK="1">B <b>đậm</b></DIV><p data-ck="0">p</p><div data-ck="0"><div>lồng</div> C<br></div>';
  assert.deepEqual(checklist.lines(html).map(checklist.normalizeText), ['a', 'b đậm', 'lồng c']);
  assert.equal(checklist.lineText(html, 1), 'b đậm');
  assert.equal(checklist.lineText(html, 3), null);
  assert.equal(checklist.lineText('', 0), null);
  assert.equal(checklist.lineText(html, -1), null);
});
test('checklist.normalizeText: thực thể, khoảng trắng, hoa/thường, cắt 200', () => {
  assert.equal(checklist.normalizeText('  Mua&nbsp;&nbsp;SỮA &amp; <i>trứng</i> &#33; '), 'mua sữa & trứng !');
  assert.equal(checklist.normalizeText('x'.repeat(300)).length, 200);
  assert.equal(checklist.fnv1a('a'), 'e40c292c');
});
test('checklist.rewardKey: có chữ -> khoá theo hash, thiếu -> khoá cũ', () => {
  const n = { html: ck('Mua sữa') };
  assert.equal(checklist.rewardKey('n1', 0, n), 'chk:n1:t:' + checklist.fnv1a('mua sữa'));
  assert.equal(checklist.rewardKey('n1', 5, n), 'chk:n1:5');
  assert.equal(checklist.rewardKey('n1', 0, null), 'chk:n1:0');
  assert.equal(checklist.rewardKey('n1', 0, { html: '<div data-ck="0"><br></div>' }), 'chk:n1:0');
});

// ---------- checklist idempotent qua bus ----------
const tick = (s, i, done = true) => s.bus.emit('note:checkItem', { noteId: 'a', index: i, done });
test('checklist: bỏ tick rồi tick lại không thưởng thêm', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('Mua sữa', 'Gọi mẹ') };
  tick(s, 0); assert.equal(s.box.counters.checkItems, 1);
  tick(s, 0, false);
  tick(s, 0); assert.equal(s.box.counters.checkItems, 1);
  assert.ok(s.box.rewarded['chk:a:t:' + checklist.fnv1a('mua sữa')]);
});
test('checklist: chèn dòng phía trên làm lệch index không thưởng lại dòng cũ', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('Mua sữa', 'Gọi mẹ') };
  tick(s, 0); tick(s, 1);
  assert.equal(s.box.counters.checkItems, 2);
  const candy = s.box.stats.candy;
  s.notes.a.html = ck('Dòng mới', 'Mua sữa', 'Gọi mẹ');   // "Mua sữa" giờ ở index 1, "Gọi mẹ" ở 2
  tick(s, 1); tick(s, 2);
  assert.equal(s.box.counters.checkItems, 2);
  assert.equal(s.box.stats.candy, candy);
  tick(s, 0);   // dòng mới thật sự lần đầu -> được thưởng
  assert.equal(s.box.counters.checkItems, 3);
});
test('checklist: kéo đổi thứ tự không thưởng thêm', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('Một', 'Hai', 'Ba') };
  tick(s, 0); tick(s, 1); tick(s, 2);
  assert.equal(s.box.counters.checkItems, 3);
  s.notes.a.html = ck('Ba', 'Một', 'Hai');
  tick(s, 0); tick(s, 1); tick(s, 2);
  s.notes.a.html = ck('Hai', 'Ba', 'Một');
  tick(s, 0); tick(s, 1); tick(s, 2);
  assert.equal(s.box.counters.checkItems, 3);
});
test('checklist: thiếu note / thiếu html / index vượt -> khoá cũ, vẫn idempotent', () => {
  const s = setup();
  tick(s, 0); tick(s, 0);
  assert.equal(s.box.counters.checkItems, 1);
  assert.ok(s.box.rewarded['chk:a:0']);
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('x') };
  tick(s, 4); tick(s, 4);
  assert.equal(s.box.counters.checkItems, 2);
  assert.ok(s.box.rewarded['chk:a:4']);
});

// ---------- xu ----------
test('game:reward không phát khi candy = 0; count = candy khi > 0', () => {
  const s = setup();
  s.box.firstUse.checklist = 1;
  s.box.today.day = '2026-01-05'; s.box.today.noteCoins = 300;   // chạm trần ngày
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('x') };
  tick(s, 0);
  assert.equal(s.box.stats.exp, 2);
  assert.equal(s.ev['game:reward'].length, 0);
  s.bus.emit('pet:interact', { kind: 'pat-head' });   // first:pat = 20 xu
  assert.equal(s.ev['game:reward'].length, 1);
  assert.equal(s.ev['game:reward'][0].count, s.ev['game:reward'][0].candy);
});
test('không còn chữ "kẹo" trong game và catalog', () => {
  const fs = require('fs'), path = require('path');
  const files = [path.join(__dirname, '../index.js'), path.join(__dirname, '../catalog.js'), path.join(__dirname, '../window.js'), catalog && require.resolve('../../../../assets/game/catalog.json')];
  for (const d of ['../logic']) for (const f of fs.readdirSync(path.join(__dirname, d))) files.push(path.join(__dirname, d, f));
  for (const f of files) assert.ok(!/kẹo/i.test(fs.readFileSync(f, 'utf8')), f);
});

// ---------- điểm danh ----------
test('điểm danh: mỗi ngày một lần', () => {
  const s = setup();
  const r = s.game.actions.checkin();
  assert.equal(r.ok, true); assert.equal(r.reward.candy, 20);
  assert.equal(s.box.stats.candy, 120);
  assert.equal(s.ev['game:reward'].at(-1).count, 20);
  const r2 = s.game.actions.checkin();
  assert.deepEqual([r2.ok, r2.reason], [false, 'done']);
  assert.equal(s.box.stats.candy, 120);
  assert.equal(r.view.checkin.todayDone, true);
  assert.equal(r.view.checkin.cycleDay, 1);
  assert.equal(r.view.checkin.rewards.length, 7);
});
test('điểm danh: bỏ ngày không reset vòng', () => {
  const s = setup();
  s.game.actions.checkin();
  s.clock.t += 3 * DAY;
  const r = s.game.actions.checkin();
  assert.equal(r.reward.candy, 25);
  assert.equal(s.box.checkin.cycleDay, 2);
  assert.equal(s.box.checkin.total, 2);
});
test('điểm danh: qua nửa đêm được điểm danh lại', () => {
  const s = setup();
  s.clock.t = new Date(2026, 0, 5, 23, 59).getTime();
  assert.equal(s.game.actions.checkin().ok, true);
  s.clock.t += 2 * MIN;
  assert.equal(s.game.actions.checkin().ok, true);
  assert.equal(s.box.checkin.total, 2);
});
test('điểm danh: đủ vòng 7 rồi quay lại, đồ ăn thưởng vào túi', () => {
  const s = setup();
  const got = [];
  for (let i = 0; i < 7; i++) { got.push(s.game.actions.checkin().reward.candy); s.clock.t += DAY; }
  assert.deepEqual(got, [20, 25, 30, 35, 40, 50, 100]);
  assert.equal(s.box.checkin.cycleDay, 0);
  assert.deepEqual(s.box.inventory.food, { food_mochi: 1, food_boba: 1, food_strawberry_cake: 1 });
  assert.equal(s.game.actions.checkin().reward.candy, 20);
  assert.equal(s.box.checkin.total, 8);
  assert.equal(s.game.view().bag.food_mochi, 1);
});
test('điểm danh: không tính vào trần 300 xu/ngày của note', () => {
  const s = setup();
  s.box.today.day = '2026-01-05'; s.box.today.noteCoins = 300;
  s.game.actions.checkin();
  assert.equal(s.box.stats.candy, 120);
  assert.equal(s.box.today.noteCoins, 300);
});

// ---------- túi đồ ăn ----------
test('túi: mua thiếu xu / tham số rác / đầy 99', () => {
  const s = setup();
  s.box.stats.candy = 10;
  assert.equal(s.game.actions.buy('food_mochi', 1).reason, 'coins');
  assert.equal(s.box.stats.candy, 10);
  for (const bad of [[null, 1], ['nope', 1], ['food_mochi', 0], ['food_mochi', 11], ['food_mochi', 1.5], ['food_mochi', '2']]) {
    assert.equal(s.game.actions.buy(...bad).reason, 'bad');
  }
  s.box.stats.candy = 5000;
  s.box.inventory.food.food_mochi = 98;
  assert.equal(s.game.actions.buy('food_mochi', 2).reason, 'full');
  assert.equal(s.box.stats.candy, 5000);
  assert.equal(s.game.actions.buy('food_mochi', 1).ok, true);
  assert.equal(s.box.inventory.food.food_mochi, 99);
  assert.equal(s.game.actions.buy('food_mochi', 1).reason, 'full');
  const r = s.game.actions.buy('food_boba', 3);
  assert.equal(r.ok, true);
  assert.equal(s.box.stats.candy, 5000 - 15 - 90);
  assert.equal(r.view.bag.food_boba, 3);
});
test('túi: cho ăn túi rỗng báo empty; có đồ thì giảm 1, phát game:fed', () => {
  const s = setup();
  const e = s.game.actions.feedBag('food_mochi');
  assert.deepEqual([e.ok, e.reason], [false, 'empty']);
  assert.equal(s.ev['game:fed'].length, 0);
  assert.equal(s.game.actions.feedBag('nope').reason, 'bad');
  s.game.actions.buy('food_mochi', 2);
  const candy = s.box.stats.candy;
  const r = s.game.actions.feedBag('food_mochi');
  assert.equal(r.ok, true); assert.equal(r.factor, 1);
  assert.ok(r.line);
  assert.equal(s.box.inventory.food.food_mochi, 1);
  assert.equal(s.ev['game:fed'].length, 1);
  assert.equal(s.ev['game:fed'][0].foodId, 'food_mochi');
  assert.equal(s.box.stats.candy >= candy, true);   // không trừ xu (có thể + thưởng lần đầu)
  assert.equal(s.box.counters.feeds, 1);
  s.game.actions.feedBag('food_mochi');
  assert.equal('food_mochi' in s.box.inventory.food, false);
  assert.equal(s.game.actions.feedBag('food_mochi').reason, 'empty');
});
test('túi: buyFeed cũ vẫn mua & ăn ngay, không vào túi', () => {
  const s = setup();
  assert.equal(s.game.actions.feed('food_mochi').ok, true);
  assert.deepEqual(s.box.inventory.food, {});
});

// ---------- nhiệm vụ tuần ----------
test('nhiệm vụ tuần: 3 mục, 2 cố định + 1 xoay vòng tất định theo tuần', () => {
  const ids = w => { const b = box_.defaults(); quests.roll(b, w); return b.quests.weekly.map(x => x.id); };
  const a = ids(T0), b = ids(T0 + 3 * DAY);
  assert.equal(a.length, 3);
  assert.deepEqual(a.slice(0, 2), ['weekly.done15', 'weekly.tidy3']);
  assert.deepEqual(a, b);
  assert.deepEqual(ids(T0), a);
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(ids(T0 + i * 7 * DAY)[2]);
  assert.ok(seen.size >= 3);
  assert.ok(!seen.has('weekly.capture3'));
});
test('nhiệm vụ tuần: capture3 chỉ vào vòng khi captureSeen', () => {
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const b = box_.defaults(); b.flags.captureSeen = true;
    quests.roll(b, T0 + i * 7 * DAY); seen.add(b.quests.weekly[2].id);
  }
  assert.ok(seen.has('weekly.capture3'));
  assert.equal(seen.size, 5);
});
test('nhiệm vụ tuần: tidy3 đếm note:trashed, nhận 150 xu + 80 exp', () => {
  const s = setup();
  for (let i = 0; i < 3; i++) s.bus.emit('note:trashed', { id: 'n' + i });
  const w = s.game.view().quests.weekly.find(x => x.id === 'weekly.tidy3');
  assert.equal(w.progress, 3);
  assert.equal(s.box.counters.tidy, 3);
  const c0 = s.box.stats.candy, e0 = s.box.stats.exp;
  const r = s.game.actions.claim('weekly.tidy3');
  assert.equal(r.ok, true);
  assert.ok(s.box.stats.candy - c0 >= 150);
  assert.ok(s.box.stats.exp - e0 >= 80);
  assert.equal(s.game.actions.claim('weekly.tidy3').ok, false);
});
test('nhiệm vụ tuần: view có 3 mục đủ trường', () => {
  const s = setup();
  const wk = s.game.view().quests.weekly;
  assert.equal(wk.length, 3);
  for (const q of wk) assert.deepEqual(Object.keys(q).sort(), ['claimed', 'goal', 'id', 'name', 'progress', 'reward']);
});
test('ghi nhanh qua bé: note:created source pet/drop, pet:captured; không đếm đôi cùng note', () => {
  const s = setup();
  s.bus.emit('note:created', { note: { id: 'n0' } });
  assert.equal(s.box.flags.captureSeen, false);
  s.bus.emit('note:created', { note: { id: 'n1' }, source: 'pet' });
  assert.equal(s.box.flags.captureSeen, true);
  assert.equal(s.box.counters.captures, 1);
  s.bus.emit('pet:captured', { noteId: 'n1' });
  assert.equal(s.box.counters.captures, 1);
  s.bus.emit('note:created', { note: { id: 'n2', source: 'drop' } });
  s.bus.emit('pet:capture', {});
  assert.equal(s.box.counters.captures, 3);
  s.bus.emit('note:created', { note: { id: 'n3' }, source: 'quick' });
  assert.equal(s.box.counters.captures, 3);
});
test('nhiệm vụ tuần: tiến độ capture/check/feed/pat/ontime', () => {
  const b = box_.defaults(); b.flags.captureSeen = true;
  const kinds = { 'weekly.capture3': 'capture', 'weekly.check10': 'check', 'weekly.feed5': 'feed', 'weekly.pat10': 'pat', 'weekly.ontime8': 'ontime' };
  for (let i = 0; i < 200; i++) {
    const t = T0 + i * 7 * DAY;
    const bb = box_.defaults(); bb.flags.captureSeen = true;
    quests.roll(bb, t);
    const id = bb.quests.weekly[2].id;
    const kind = kinds[id];
    if (!kind) continue;
    const hit = quests.progress(bb, kind, 1000, t);
    assert.ok(hit.some(h => h.id === id), id);
    delete kinds[id];
    if (!Object.keys(kinds).length) break;
  }
  assert.deepEqual(Object.keys(kinds), []);
  void b;
});

// ---------- album ----------
test('album: view đủ bộ, claim khi đủ / chưa đủ / 2 lần', () => {
  const s = setup();
  const row = () => s.game.view().album.find(x => x.setId === 'camping');
  assert.equal(s.game.view().album.length, 9);
  assert.equal(row().total, 3);
  assert.equal(row().complete, false);
  assert.equal(s.game.actions.claimSet('camping').reason, 'incomplete');
  assert.equal(s.game.actions.claimSet('zzz').reason, 'bad');
  for (const it of catalog.items.filter(i => i.set === 'camping')) s.box.inventory.items[it.id] = { count: 1, firstAt: 1 };
  assert.equal(row().owned, 3); assert.equal(row().complete, true); assert.equal(row().claimed, false);
  const c0 = s.box.stats.candy;
  const r = s.game.actions.claimSet('camping');
  assert.equal(r.ok, true);
  assert.equal(r.reward.candy, 100);
  assert.ok(s.box.stats.candy - c0 >= 100);
  assert.ok(s.box.achievements.set_first);
  assert.equal(row().claimed, true);
  const c1 = s.box.stats.candy;
  const r2 = s.game.actions.claimSet('camping');
  assert.deepEqual([r2.ok, r2.reason], [false, 'done']);
  assert.equal(s.box.stats.candy, c1);
});
test('catalog.sets: 9 bộ, tên tiếng Việt, thưởng 100-500, mọi set của món đều có bộ', () => {
  assert.equal(catalog.sets.length, 9);
  for (const st of catalog.sets) { assert.ok(st.name && st.reward >= 100 && st.reward <= 500); }
  const ids = new Set(catalog.sets.map(x => x.id));
  for (const it of catalog.items) assert.ok(ids.has(it.set), it.id);
});

// ---------- migrate Đợt 2 ----------
test('migrate dữ liệu Đợt 2: không mất gì, trường mới có mặc định', () => {
  const old = {
    version: 1, settings: { enabled: true },
    stats: { energy: 55, mood: 66, affection: 7, candy: 321, exp: 450, streak: { count: 4, lastDay: '2026-01-04' } },
    inventory: { items: { clip_x: { count: 2, firstAt: 5 } }, shards: 9, worn: { hairclip: 'clip_x' }, outfits: [{ id: 'o1', name: 'Bộ 1', worn: { hairclip: 'clip_x' } }], foodLog: [{ foodId: 'food_mochi', at: 3 }] },
    gacha: { pity: 3, total: 12, history: [] },
    quests: { day: '2026-01-05', daily: [{ id: 'daily.done3', progress: 2, goal: 3, claimed: false }], week: weekKey(T0), weekly: [{ id: 'weekly.done15', progress: 7, goal: 15, claimed: false }] },
    achievements: { first_done: 11 }, counters: { done: 20, onTime: 5, feeds: 4 },
    firstUse: { note: 1 }, rewarded: { 'chk:a:0': 99 }, today: { day: '2026-01-05', noteCoins: 10, alarmBonus: 0, pats: 0 }, log: []
  };
  const n = box_.normalize(JSON.parse(JSON.stringify(old)));
  assert.equal(n.stats.candy, 321); assert.equal(n.stats.streak.count, 4);
  assert.equal(n.inventory.items.clip_x.count, 2); assert.equal(n.inventory.shards, 9);
  assert.equal(n.inventory.foodLog.length, 1); assert.equal(n.outfits, undefined);
  assert.equal(n.counters.done, 20); assert.equal(n.counters.feeds, 4); assert.equal(n.counters.tidy, 0); assert.equal(n.counters.captures, 0);
  assert.deepEqual(n.inventory.food, {});
  assert.deepEqual(n.checkin, { cycleDay: 0, lastDay: '', total: 0 });
  assert.deepEqual(n.album, { claimed: {} });
  assert.deepEqual(n.flags, { captureSeen: false });
  assert.equal(n.rewarded['chk:a:0'], 99);
  assert.equal(box_.normalize(n).checkin.total, 0);   // idempotent
  // qua createGame: nhiệm vụ tuần giữ tiến độ done15, được bù lên 3 mục
  const s = setup(null, JSON.parse(JSON.stringify(old)));
  const wk = s.game.view().quests.weekly;
  assert.equal(wk.length, 3);
  assert.equal(wk[0].id, 'weekly.done15'); assert.equal(wk[0].progress, 7);
  assert.equal(s.box.stats.candy, 321);
  // normalize chịu rác ở trường mới
  const junk = box_.normalize({ checkin: { cycleDay: 99, lastDay: 5, total: -3 }, album: 'x', flags: [], inventory: { food: { a: 500, b: -1, c: 'x', d: 3 } } });
  assert.deepEqual(junk.checkin, { cycleDay: 6, lastDay: '', total: 0 });
  assert.deepEqual(junk.inventory.food, { a: 99, d: 3 });
  assert.deepEqual(junk.album, { claimed: {} });
});

// ---------- tắt game hoá + không chạm note/nhắc ----------
function recorder(log, path) {
  return new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive || k === 'then' ? undefined : recorder(log, path + '.' + String(k))),
    apply: () => { log.push('call ' + path); return undefined; },
    construct: () => { log.push('new ' + path); return {}; },
    set: (t, k) => { log.push('set ' + path + '.' + String(k)); return true; },
    deleteProperty: (t, k) => { log.push('delete ' + path + '.' + String(k)); return true; },
    defineProperty: (t, k) => { log.push('define ' + path + '.' + String(k)); return true; }
  });
}
function fireAll(s) {
  s.notes.a = { id: 'a', createdAt: OLD, html: ck('x', 'y'), reminder: { due: 1 } };
  const b = s.bus;
  b.emit('reminder:done', { noteId: 'a', onTime: true, reminderId: 'r1' });
  b.emit('note:checkItem', { noteId: 'a', index: 0, done: true });
  b.emit('note:checkItem', { noteId: 'a', index: 1, done: true });
  b.emit('note:created', { note: { id: 'a' }, source: 'pet' });
  b.emit('note:created', { note: { id: 'b' } });
  b.emit('note:trashed', { id: 'a' });
  b.emit('alarm:stopped', {});
  b.emit('pet:interact', { kind: 'pat-head' });
  b.emit('pet:capture', {}); b.emit('pet:captured', { noteId: 'z' });
  b.emit('pet:posture', { posture: 'sleep' }); b.emit('app:idle', {}); b.emit('app:resume', {});
  const a = s.game.actions;
  a.checkin(); a.buy('food_mochi', 1); a.feedBag('food_mochi'); a.claimSet('camping'); a.feed('food_mochi');
  a.claim('weekly.tidy3'); a.claim('daily.done3'); a.pull(1); a.pull(10); a.exchange('clip_star');
  a.wear('hairclip', 'clip_x'); a.saveOutfit('x'); a.applyOutfit('o1'); a.deleteOutfit('o1');
  s.game.tick();
}
test('tắt game hoá: không phát gì, không đổi xu/chỉ số, mọi action mới trả off', () => {
  const s = setup();
  s.game.actions.setEnabled(false);
  for (const n of EVENTS) s.ev[n].length = 0;
  const snap = () => JSON.stringify({ st: s.box.stats, inv: s.box.inventory, c: s.box.counters, ck: s.box.checkin, al: s.box.album, fl: s.box.flags, ach: s.box.achievements, g: s.box.gacha, r: s.box.rewarded, q: s.box.quests });
  const before = snap();
  fireAll(s);
  const chs = s.game.channels.filter(c => c !== 'game:setEnabled');   // setEnabled(on) là công tắc, kiểm riêng
  for (const ch of chs) s.game.ipc[ch]('food_mochi', 1);
  for (const ch of chs) s.game.ipc[ch]();
  s.game.ipc['game:setEnabled'](false);
  for (const n of ['game:reward', 'game:levelup', 'game:fed', 'persona:line']) assert.equal(s.ev[n].length, 0, n);
  assert.equal(snap(), before);
  const a = s.game.actions;
  for (const r of [a.checkin(), a.buy('food_mochi', 1), a.feedBag('food_mochi'), a.claimSet('camping')]) {
    assert.deepEqual([r.ok, r.reason], [false, 'off']);
  }
  assert.equal(s.game.view().enabled, false);
});
test('game không gọi/ghi vào note/nhắc (cả bật lẫn tắt)', () => {
  for (const on of [true, false]) {
    const log = [];
    const s = setup({ notes: recorder(log, 'notes'), alarms: recorder(log, 'alarms') });
    s.ctx.store.data.notes = recorder(log, 'store.notes');
    s.ctx.store.data.alarms = recorder(log, 'store.alarms');
    if (!on) s.game.actions.setEnabled(false);
    fireAll(s);
    s.game.start(); s.game.stop();
    assert.deepEqual(log, [], 'on=' + on);
  }
});
test('lỗi trong handler game không chặn người nghe khác của reminder:done', () => {
  const s = setup();
  s.notes.a = { id: 'a', createdAt: OLD, reminder: { due: 1 } };
  const got = [];
  s.bus.on('reminder:done', p => got.push(p.noteId));
  const orig = economy.onDone;
  const origErr = console.error;
  console.error = () => {};
  try {
    economy.onDone = () => { throw new Error('ép lỗi'); };
    assert.doesNotThrow(() => s.bus.emit('reminder:done', { noteId: 'a', onTime: true }));
    economy.onDone = orig;
    const s2 = setup({ findNote: () => { throw new Error('ép lỗi 2'); } });
    const got2 = [];
    s2.bus.on('reminder:done', p => got2.push(p.noteId));
    assert.doesNotThrow(() => s2.bus.emit('reminder:done', { noteId: 'a' }));
    assert.deepEqual(got2, ['a']);
  } finally { economy.onDone = orig; console.error = origErr; }
  assert.deepEqual(got, ['a']);
});
