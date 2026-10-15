'use strict';
// Đạo diễn sân khấu (src/main/pet/stage.js) — hợp đồng docs/spec/02-events.md.
const test = require('node:test');
const assert = require('node:assert');
const Stage = require('../../src/main/pet/stage.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(5); }
  return !!fn();
}

function makeEnv(over = {}) {
  const handlers = {};
  const log = { say: [], hold: [], play: [], hide: 0, stage: [] };
  const actor = {
    isReady: () => true,
    visible: () => true,
    on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    goToCorner: () => Promise.resolve(),
    say(text, o) { log.say.push({ text, o }); },
    holdNote(s) { log.hold.push(s); },
    play(a) { log.play.push(a); },
    setStage(v) { log.stage.push(v); },
    hide() { log.hide++; },
    shake() {}, hush() {}, sound() {}
  };
  const emitted = [];
  const notes = [];
  const alarmCalls = [];
  const ctx = {
    bus: { emit: (n, d) => emitted.push([n, d]) },
    settings: () => ({ mascotEnabled: true, sound: true }),
    pet: { actor, settings: () => ({}) },
    store: { data: { notes } },
    findNote: id => notes.find(n => n.id === id) || null,
    notes: { showNote() {}, completeNote() {}, snoozeNote() {} },
    alarms: { stop: id => alarmCalls.push(['stop', id]), snooze: (id, m) => alarmCalls.push(['snooze', id, m]) },
    persona: null
  };
  Object.assign(ctx, over.ctx || {});
  const notif = [];
  class FakeNotification {
    constructor(o) { this.o = o; this.h = {}; notif.push(this); }
    static isSupported() { return true; }
    on(e, f) { this.h[e] = f; }
    show() { this.shown = true; }
  }
  const stage = Stage.create(ctx, Object.assign({ Notification: FakeNotification, timeScale: 0.05 }, over.deps || {}));
  const fire = (type, data) => (handlers[type] || []).forEach(f => f(data));
  return { stage, ctx, actor, log, emitted, notes, alarmCalls, notif, fire };
}
const texts = e => e.log.say.map(s => s.text);

test('ưu tiên 100>90>70>60>40>30>10 khi cùng chờ', async () => {
  const e = makeEnv({ deps: { timeScale: 0.002 } });
  for (const p of [30, 10, 100, 40, 60, 70, 90]) e.stage.request({ kind: 'x', priority: p, payload: { text: 'p' + p } });
  assert.ok(await until(() => e.log.say.length >= 7 && !e.stage.busy(), 3000), 'không diễn hết: ' + texts(e));
  assert.deepStrictEqual(texts(e), ['p100', 'p90', 'p70', 'p60', 'p40', 'p30', 'p10']);
});

test('PRIORITY mặc định theo loại', () => {
  const P = Stage.PRIORITY;
  assert.ok(P.alarm > P.due && P.due > P.pre && P.pre > P.memo && P.memo > P.nag && P.nag > P.reward && P.reward > P.chatter);
  assert.deepStrictEqual([P.alarm, P.due, P.pre, P.memo, P.nag, P.reward, P.chatter], [100, 90, 70, 60, 40, 30, 10]);
});

test('cùng mức: vào trước diễn trước (FIFO)', async () => {
  const e = makeEnv({ deps: { timeScale: 0.002 } });
  for (const n of ['a', 'b', 'c']) e.stage.request({ kind: 'x', priority: 40, payload: { text: n } });
  await until(() => e.log.say.length >= 3, 3000);
  assert.deepStrictEqual(texts(e), ['a', 'b', 'c']);
});

test('mức cao ngắt mức thấp; mức thấp còn hạn quay lại hàng đợi', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } }); // chatter diễn 500ms
  e.stage.request({ kind: 'x', priority: 10, ttlMs: 60000, payload: { text: 'low' } });
  await until(() => texts(e).includes('low'));
  e.stage.request({ kind: 'x', priority: 100, payload: { text: 'high' } });
  assert.ok(await until(() => e.stage.current() && e.stage.current().priority === 100), 'mức 100 không lên ngay');
  assert.ok(await until(() => texts(e).filter(t => t === 'low').length === 2, 4000), 'low không quay lại: ' + texts(e));
  assert.deepStrictEqual(texts(e).slice(0, 2), ['low', 'high']);
});

test('mức thấp hết ttl thì không quay lại', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } });
  e.stage.request({ kind: 'x', priority: 10, ttlMs: 20, payload: { text: 'low' } });
  await until(() => texts(e).includes('low'));
  await sleep(40);
  e.stage.request({ kind: 'x', priority: 100, payload: { text: 'high' } });
  await until(() => texts(e).includes('high'));
  await until(() => !e.stage.busy(), 4000);
  await sleep(100);
  assert.deepStrictEqual(texts(e), ['low', 'high']);
});

test('mức thấp hết ttl ngay trong hàng đợi thì bị bỏ', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } });
  e.stage.request({ kind: 'x', priority: 50, payload: { text: 'blocker' } });
  e.stage.request({ kind: 'x', priority: 10, ttlMs: 20, payload: { text: 'stale' } });
  await until(() => !e.stage.busy(), 4000);
  assert.deepStrictEqual(texts(e), ['blocker']);
});

test('mức >= 60 không bao giờ bị bỏ dù ttlMs rất nhỏ (nhắc lịch)', async () => {
  const e = makeEnv({ deps: { timeScale: 0.05 } });
  e.stage.request({ kind: 'x', priority: 70, ttlMs: 1, payload: { text: 'pre' } });
  await until(() => texts(e).includes('pre'));
  await sleep(10);
  e.stage.request({ kind: 'x', priority: 90, payload: { text: 'due' } });
  await until(() => !e.stage.busy(), 4000);
  assert.deepStrictEqual(texts(e).filter(t => t === 'pre').length, 2, 'pre phải diễn lại sau khi bị ngắt: ' + texts(e));
});

test('memo (60) bị alarm ngắt thì quay lại sau khi alarm tắt', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } });
  e.stage.request({ kind: 'memo', payload: { memoId: 'm1', text: 'uống nước' } });
  assert.ok(await until(() => e.log.hold.some(h => h && h.kind === 'memo')));
  const aid = e.stage.request({ kind: 'alarm', payload: { alarmId: 'a1', label: 'Dậy' } });
  assert.ok(await until(() => e.stage.current() && e.stage.current().kind === 'alarm'));
  assert.ok(e.stage.cancel(aid));
  assert.ok(await until(() => e.log.hold.filter(h => h && h.kind === 'memo').length === 2, 4000), 'memo không quay lại');
});

test('alarm không tự đóng; dừng khi bấm nút, gọi alarms.stop và phát pet:stageAction', async () => {
  const e = makeEnv({ deps: { timeScale: 0.01 } });
  e.stage.request({ kind: 'alarm', payload: { alarmId: 'a1', label: 'Dậy' } });
  await until(() => e.stage.current());
  await sleep(300);
  assert.strictEqual(e.stage.current().kind, 'alarm', 'alarm tự đóng');
  e.fire('button', { id: 'stop' });
  assert.ok(await until(() => !e.stage.busy(), 3000));
  assert.deepStrictEqual(e.alarmCalls, [['stop', 'a1']]);
  const ev = e.emitted.find(x => x[0] === 'pet:stageAction');
  assert.ok(ev && ev[1].button === 'stop' && ev[1].alarmId === 'a1' && ev[1].kind === 'alarm');
});

test('alarm: nút hoãn gọi alarms.snooze(id, snoozeMin)', async () => {
  const e = makeEnv({ deps: { timeScale: 0.01 } });
  e.stage.request({ kind: 'alarm', payload: { alarmId: 'a2', snoozeMin: 7 } });
  await until(() => e.stage.current());
  await sleep(50);
  e.fire('button', { id: 'snooze' });
  await until(() => !e.stage.busy(), 3000);
  assert.deepStrictEqual(e.alarmCalls, [['snooze', 'a2', 7]]);
});

test('cancel: mục đang chờ, mục đang diễn, id lạ', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } });
  const a = e.stage.request({ kind: 'alarm', payload: { alarmId: 'x' } });
  const q = e.stage.request({ kind: 'x', priority: 50, payload: { text: 'queued' } });
  assert.ok(e.stage.cancel(q), 'huỷ mục chờ');
  assert.strictEqual(e.stage.cancel('st_không_có'), false);
  await until(() => e.stage.current() && e.stage.current().id === a);
  assert.ok(e.stage.cancel(a), 'huỷ mục đang diễn');
  assert.ok(await until(() => !e.stage.busy(), 2000));
  assert.ok(!texts(e).includes('queued'));
  assert.strictEqual(e.stage.current(), null);
  assert.strictEqual(e.stage.cancel(a), false, 'huỷ lần 2');
});

test('chống trùng alarm theo alarmId (đang chờ và đang diễn)', async () => {
  const e = makeEnv({ deps: { timeScale: 0.1 } });
  const i1 = e.stage.request({ kind: 'alarm', payload: { alarmId: 'A' } });
  const i2 = e.stage.request({ kind: 'alarm', payload: { alarmId: 'A' } });
  assert.strictEqual(i1, i2, 'trong hàng đợi');
  assert.strictEqual(e.stage.size(), 1);
  await until(() => e.stage.current());
  const i3 = e.stage.request({ kind: 'alarm', payload: { alarmId: 'A' } });
  assert.strictEqual(i3, i1, 'đang diễn');
  const i4 = e.stage.request({ kind: 'alarm', payload: { alarmId: 'B' } });
  assert.notStrictEqual(i4, i1, 'id khác không được gộp');
  e.stage.cancelWhere(() => true);
});

test('chống trùng memo theo memoId trong 60s; id khác / không id thì không gộp', () => {
  const e = makeEnv();
  const a = e.stage.request({ kind: 'memo', payload: { memoId: 'm', text: 'a' } });
  const b = e.stage.request({ kind: 'memo', payload: { memoId: 'm', text: 'a' } });
  assert.strictEqual(a, b);
  const c = e.stage.request({ kind: 'memo', payload: { memoId: 'm2', text: 'b' } });
  assert.notStrictEqual(a, c);
  const d1 = e.stage.request({ kind: 'memo', payload: { text: 'no id' } });
  const d2 = e.stage.request({ kind: 'memo', payload: { text: 'no id' } });
  assert.notStrictEqual(d1, d2);
  e.stage.cancelWhere(() => true);
});

test('memo cùng id, đã diễn xong rồi gọi lại trong 60s vẫn bị gộp (không nhắc hai lần)', async () => {
  const e = makeEnv({ deps: { timeScale: 0.002 } });
  const a = e.stage.request({ kind: 'memo', payload: { memoId: 'm', text: 'a' } });
  await until(() => e.log.hold.length > 0);
  e.fire('button', { id: 'ok' });
  await until(() => !e.stage.busy(), 2000);
  const b = e.stage.request({ kind: 'memo', payload: { memoId: 'm', text: 'a' } });
  assert.strictEqual(a, b);
});

test('mascot tắt: alarm/memo vẫn có thông báo Windows dự phòng', async () => {
  const e = makeEnv({ ctx: { settings: () => ({ mascotEnabled: false, sound: true }) } });
  e.stage.request({ kind: 'alarm', payload: { alarmId: 'a', label: 'Dậy đi' } });
  e.stage.request({ kind: 'memo', payload: { memoId: 'm', text: 'Uống thuốc' } });
  await until(() => e.notif.length >= 2 && !e.stage.busy());
  assert.strictEqual(e.notif.length, 2);
  assert.ok(e.notif.every(n => n.shown));
  assert.strictEqual(e.notif[0].o.title, 'Dậy đi');
  assert.match(e.notif[1].o.body, /Uống thuốc/);
  assert.strictEqual(e.log.say.length, 0);
});

test('không có actor: nhắc lịch (alarm) vẫn có thông báo dự phòng', async () => {
  const e = makeEnv();
  e.ctx.pet.actor = null;
  e.stage.request({ kind: 'alarm', payload: { alarmId: 'a' } });
  await until(() => e.notif.length === 1);
  assert.strictEqual(e.notif.length, 1);
});

test('bé không sẵn sàng (whenReady treo): có thông báo dự phòng sau khi hết chờ', async () => {
  const e = makeEnv({ deps: { timeScale: 0.01 } });
  e.actor.isReady = () => false;
  e.actor.whenReady = () => new Promise(() => {});
  e.stage.request({ kind: 'alarm', payload: { alarmId: 'a' } });
  assert.ok(await until(() => e.notif.length === 1, 2000));
});

test('chatter/reward không bật thông báo dự phòng khi bé tắt', async () => {
  const e = makeEnv({ ctx: { settings: () => ({ mascotEnabled: false }) } });
  e.stage.request({ kind: 'chatter', payload: { text: 'hi' } });
  e.stage.request({ kind: 'reward', payload: { text: 'hi' } });
  await sleep(50);
  assert.strictEqual(e.notif.length, 0);
});

test('nhắc lịch pre/due: có thông báo dự phòng; note bị xoá thì bỏ qua êm', async () => {
  const e = makeEnv({ ctx: { settings: () => ({ mascotEnabled: false }) } });
  const now = Date.now();
  e.notes.push({ id: 'n1', text: 'Họp nhóm', color: 'yellow', reminder: { due: now + 1000, lead: 0, intent: 'meet', fired: false, done: false } });
  e.stage.request({ kind: 'due', payload: { noteId: 'n1' } });
  await until(() => e.notif.length === 1);
  assert.strictEqual(e.notif.length, 1);
  assert.strictEqual(e.notif[0].o.title, 'Họp nhóm');
  e.stage.request({ kind: 'due', payload: { noteId: 'khong-co' } });
  await sleep(50);
  assert.strictEqual(e.notif.length, 1);
});

test('due: note đã Xong thì không diễn; Xong bấm -> completeNote', async () => {
  const e = makeEnv({ deps: { timeScale: 0.01 } });
  const now = Date.now();
  e.notes.push({ id: 'n1', text: 'Nộp báo cáo', color: 'blue', reminder: { due: now - 10, lead: 0, intent: 'due', fired: true, done: true } });
  e.stage.request({ kind: 'due', payload: { noteId: 'n1' } });
  await sleep(60);
  assert.strictEqual(e.log.say.length, 0);
  e.notes[0].reminder.done = false;
  let completed = null;
  e.ctx.notes.completeNote = id => { completed = id; };
  e.stage.request({ kind: 'due', payload: { noteId: 'n1' } });
  await until(() => e.log.say.length > 0);
  e.fire('button', { id: 'done' });
  await until(() => !e.stage.busy(), 3000);
  assert.strictEqual(completed, 'n1');
});

test('lỗi trong actor không làm kẹt hàng đợi', async () => {
  const e = makeEnv({ deps: { timeScale: 0.002 } });
  e.actor.say = () => { throw new Error('boom'); };
  e.stage.request({ kind: 'x', priority: 40, payload: { text: 'a' } });
  e.stage.request({ kind: 'x', priority: 30, payload: { text: 'b' } });
  assert.ok(await until(() => !e.stage.busy(), 3000));
});

test('request không tham số / loại lạ không ném lỗi', () => {
  const e = makeEnv();
  assert.doesNotThrow(() => { e.stage.request(); e.stage.request({}); e.stage.request({ kind: 'lạ' }); });
  e.stage.cancelWhere(() => true);
});
