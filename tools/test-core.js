'use strict';
// Test luồng chính của Mochi Notes (node thuần, không Electron): node tools/test-core.js
// Phủ: expiry, scheduler, stage (nhắc to / nút Xong / Hoãn / hàng đợi), lệnh phá hoại của bé, store hỏng, logger.
// In tổng kết, exit 1 nếu có ca sai. Lỗi đã biết của code chính nằm trong KNOWN (không tính exit; STRICT=1 để tính).
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');
const { EventEmitter } = require('events');
const root = path.join(__dirname, '..');
const R = p => path.join(root, p);

// --- stub 'electron' (module nào lỡ require sẽ không nổ)
const electronStub = require('./stubs/electron.js');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  return origLoad.apply(this, arguments);
};

// --- khung test
const rawErr = console.error;
console.error = () => { /* im lặng log của code chính trong lúc test */ };
console.warn = () => {};
let expectProc = false;
const out = (...a) => console.log(...a);
let pass = 0, fail = 0, knownBug = 0;
const failures = [], bugs = [];
const ok = (cond, name, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail !== undefined ? '   => ' + detail : '')); } };
const known = (cond, name, detail) => {
  if (cond) { pass++; return; }
  if (process.env.STRICT) { fail++; failures.push('[BUG] ' + name + (detail !== undefined ? '   => ' + detail : '')); } else { knownBug++; bugs.push(name + (detail !== undefined ? '   => ' + detail : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(cond, ms = 4000, step = 4) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (cond()) return true; await sleep(step); }
  return !!cond();
}
const D = (m, d, h, mi, s) => new Date(2026, m - 1, d, h || 0, mi || 0, s || 0).getTime();
const MIN = 60000, H = 3600000;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-test-'));
let tmpN = 0;
const tmpDir = () => { const d = path.join(tmpRoot, 'd' + (++tmpN)); fs.mkdirSync(d, { recursive: true }); return d; };
const sections = [];
const section = (name, fn) => sections.push([name, fn]);

process.on('uncaughtException', e => { if (expectProc) return; fail++; failures.push('uncaughtException trong test: ' + (e && e.stack || e)); });
process.on('unhandledRejection', e => { if (expectProc) return; fail++; failures.push('unhandledRejection trong test: ' + (e && e.stack || e)); });

const E = require(R('src/main/notes/expiry.js'));
const S = require(R('src/main/notes/scheduler.js'));
const C = require(R('src/main/antics/commands.js'));
const stageLib = require(R('src/main/pet/stage.js'));
const { createStore } = require(R('src/main/store.js'));

// ====================================================================== 1) EXPIRY
section('expiry', () => {
  const NOW = D(10, 15, 12);
  const base = (o) => Object.assign({ id: 'n', visible: true, updatedAt: NOW - 3 * H, reminders: [] }, o);
  const rem = (o) => Object.assign({ due: NOW - H, fired: true, done: false }, o);
  // vừa sửa
  ok(E.expiredReason(base({ updatedAt: NOW - 5 * MIN, reminders: [rem({ done: true })] }), NOW) === null, 'expiry: sửa 5 phút trước -> chờ (null)');
  ok(E.expiredReason(base({ updatedAt: NOW - 10 * MIN + 1, reminders: [rem({ done: true })] }), NOW) === null, 'expiry: sửa 10 phút - 1ms -> null');
  ok(E.expiredReason(base({ updatedAt: NOW - 10 * MIN, reminders: [rem({ done: true })] }), NOW) === 'done', 'expiry: đúng 10 phút -> done');
  ok(E.expiredReason(base({ updatedAt: NOW - 5 * MIN, reminders: [rem({ done: true })] }), NOW, null, { fresh: true }) === 'done', 'expiry: opts.fresh bỏ qua 10 phút');
  ok(E.expiredReason(base({ updatedAt: NOW - 5 * MIN, reminders: [rem({ done: true })] }), NOW, null, { fresh: false }) === null, 'expiry: fresh=false vẫn chờ');
  ok(E.expiredReason(base({ updatedAt: NOW - 1000, reminders: [] }), NOW, { checklist: { total: 2, done: 2 } }, { fresh: true }) === 'checklist', 'expiry: fresh + checklist');
  // done
  ok(E.expiredReason(base({ reminders: [rem({ done: true })] }), NOW) === 'done', 'expiry: mọi nhắc done -> done');
  ok(E.expiredReason(base({ reminders: [rem({ done: true }), rem({ done: false, fired: false, due: NOW + H })] }), NOW) === null, 'expiry: còn nhắc chưa xong -> null');
  ok(E.expiredReason(base({ reminders: [rem({ done: true, repeat: { freq: 'daily' } })] }), NOW) === null, 'expiry: nhắc lặp done -> KHÔNG hết hạn');
  ok(E.expiredReason(base({ reminders: [rem({ done: true }), rem({ done: true, repeat: { freq: 'weekly', byDay: [1] } })] }), NOW) === null, 'expiry: có một nhắc lặp -> null');
  ok(E.expiredReason(base({ reminders: [] }), NOW) === null, 'expiry: không nhắc, không checklist -> null');
  ok(E.expiredReason(base({ reminder: rem({ done: true }), reminders: undefined }), NOW) === 'done', 'expiry: note cũ chỉ có .reminder');
  // overdue
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 25 * H })] }), NOW) === 'overdue', 'expiry: kêu rồi, chưa xong, quá 24h -> overdue');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 23 * H })] }), NOW) === null, 'expiry: quá 23h -> null');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 24 * H })] }), NOW) === null, 'expiry: đúng 24h (không lớn hơn) -> null');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 30 * H, fired: false })] }), NOW) === null, 'expiry: chưa kêu (fired=false) -> không overdue');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 30 * H, done: true })] }), NOW) === 'done', 'expiry: quá hạn nhưng done -> done (không phải overdue)');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW - 30 * H }), rem({ done: true })] }), NOW) === 'overdue', 'expiry: overdue thắng done');
  // checklist
  const ins = (d, t) => ({ checklist: { done: d, total: t } });
  ok(E.expiredReason(base(), NOW, ins(3, 3)) === 'checklist', 'expiry: checklist xong hết');
  ok(E.expiredReason(base(), NOW, ins(2, 3)) === null, 'expiry: checklist dở dang -> null');
  ok(E.expiredReason(base(), NOW, ins(0, 0)) === null, 'expiry: checklist rỗng -> null');
  ok(E.expiredReason(base({ reminders: [rem({ due: NOW + H, fired: false })] }), NOW, ins(2, 2)) === 'checklist', 'expiry: checklist xong dù nhắc chưa tới');
  // vô hiệu
  ok(E.expiredReason(base({ visible: false, reminders: [rem({ done: true })] }), NOW) === null, 'expiry: note ẩn -> null');
  ok(E.expiredReason(null, NOW) === null && E.expiredReason(undefined, NOW) === null && E.expiredReason('x', NOW) === null, 'expiry: đầu vào rác -> null, không ném');
  ok(E.expiredReason(base({ updatedAt: undefined, reminders: [rem({ done: true })] }), NOW) === 'done', 'expiry: thiếu updatedAt không ném');
  ok(E.expiredReason(base({ reminders: [null, 5, rem({ done: true })] }), NOW) === 'done', 'expiry: phần tử nhắc rác bị bỏ qua');
  ok(E.dayKey(D(1, 5, 23, 59)) === '2026-01-05', 'expiry.dayKey');
});

// ====================================================================== 2) SCHEDULER
function mkNote(id, text, rems) {
  const n = { id, text, html: text, visible: true, color: 'yellow', reminders: rems || [], remindMuted: [], updatedAt: 0 };
  S.ensureReminders(n);
  return n;
}
const mkRem = (due, o) => Object.assign({ due, lead: 0, intent: 'task', auto: false, preFired: false, fired: false, done: false }, o);
const evTypes = r => r.events.map(e => e.type).join(',');

section('scheduler', () => {
  // tick cơ bản
  let now = D(10, 15, 10);
  let n = mkNote('a', 'Họp', [mkRem(now + 5 * MIN)]);
  ok(evTypes(S.tick([n], now, null)) === '', 'sched: chưa tới giờ -> không sự kiện');
  ok(evTypes(S.tick([n], now + 5 * MIN - 1, null)) === '', 'sched: sớm 1ms -> không');
  let r = S.tick([n], now + 5 * MIN, null);
  ok(evTypes(r) === 'due' && r.changed && n.reminder.fired, 'sched: đúng giờ -> 1 due, fired');
  ok(evTypes(S.tick([n], now + 5 * MIN + 1000, null)) === '', 'sched: due chỉ bắn 1 lần');
  ok(evTypes(S.tick([n], now + 3 * H, null)) === '', 'sched: không bắn lại sau nhiều giờ');
  // pre
  n = mkNote('b', 'Họp', [mkRem(now + 20 * MIN, { lead: 10 * MIN })]);
  ok(evTypes(S.tick([n], now + 9 * MIN, null)) === '', 'sched: trước lead -> không');
  ok(evTypes(S.tick([n], now + 10 * MIN, null)) === 'pre', 'sched: tới lead -> pre');
  ok(evTypes(S.tick([n], now + 15 * MIN, null)) === '', 'sched: pre chỉ 1 lần');
  ok(evTypes(S.tick([n], now + 20 * MIN, null)) === 'due', 'sched: rồi due');
  // máy ngủ: nhảy qua cả pre lẫn due -> pre không bắn sau due, due 1 lần
  n = mkNote('c', 'Họp', [mkRem(now + 20 * MIN, { lead: 10 * MIN })]);
  ok(evTypes(S.tick([n], now + 2 * H, null)) === 'due', 'sched: ngủ qua cả pre -> chỉ due');
  // nhiều nhắc cùng chín: đúng thứ tự giờ
  n = mkNote('d', 'Hai việc', [mkRem(now + 2 * MIN, { key: 'k2' }), mkRem(now + 1 * MIN, { key: 'k1' })]);
  r = S.tick([n], now + 3 * MIN, null);
  ok(r.events.length === 2 && r.events[0].reminderId !== r.events[1].reminderId, 'sched: 2 nhắc cùng chín -> 2 due');
  // done không bắn
  n = mkNote('e', 'x', [mkRem(now - MIN)]);
  S.markDone(n);
  ok(evTypes(S.tick([n], now, null)) === '', 'sched: reminder done không bắn');
  // snooze
  n = mkNote('f', 'Uống thuốc', [mkRem(now)]);
  ok(evTypes(S.tick([n], now, null)) === 'due', 'sched: snooze - due đầu');
  ok(S.snooze(n, 10, now + MIN), 'sched: snooze trả true');
  ok(n.reminder.due === now + 11 * MIN && !n.reminder.fired && !n.reminder.done, 'sched: snooze đặt due = bây giờ + 10p, fired=false');
  ok(evTypes(S.tick([n], now + 11 * MIN - 1000, null)) === '', 'sched: chưa hết snooze -> im');
  ok(evTypes(S.tick([n], now + 11 * MIN, null)) === 'due', 'sched: hết snooze -> due lại, không có pre thừa');
  ok(S.snooze(n, NaN, now + 12 * MIN) && n.reminder.due === now + 22 * MIN, 'sched: snooze phút rác -> mặc định 10');
  ok(S.snooze(mkNote('g', 'y', []), 10, now) === false, 'sched: snooze note không nhắc -> false');
  // nag (nhắc dai)
  n = mkNote('h', 'Nộp báo cáo', [mkRem(now)]);
  S.tick([n], now, { lastNag: 0, busy: false });
  const st = { lastNag: 0, busy: false };
  ok(evTypes(S.tick([n], now + 9 * MIN, st)) === '', 'sched: quá hạn 9p chưa nag');
  ok(evTypes(S.tick([n], now + 11 * MIN, { lastNag: 0, busy: true })) === '', 'sched: busy -> không nag');
  ok(evTypes(S.tick([n], now + 11 * MIN, st)) === 'nag' && st.lastNag === now + 11 * MIN, 'sched: quá hạn >10p -> nag');
  ok(evTypes(S.tick([n], now + 12 * MIN, st)) === '', 'sched: nag không dồn dập (15p)');
  ok(evTypes(S.tick([n], now + 27 * MIN, st)) === 'nag', 'sched: nag lại sau 15p');
  S.markDone(n);
  ok(evTypes(S.tick([n], now + 60 * MIN, { lastNag: 0, busy: false })) === '', 'sched: xong rồi thì hết nag');
  // lặp ngày qua nửa đêm
  now = D(10, 15, 10);
  n = mkNote('i', 'hằng ngày 23:30 uống thuốc', []);
  S.applyText(n, now);
  ok(n.reminder && n.reminder.repeat && n.reminder.repeat.freq === 'daily' && n.reminder.due === D(10, 15, 23, 30), 'sched: "hằng ngày 23:30" -> due 23:30 hôm nay, lặp ngày', JSON.stringify(n.reminder));
  ok(evTypes(S.tick([n], D(10, 15, 23, 29, 59), null)) === '', 'sched: 23:29:59 chưa bắn');
  ok(evTypes(S.tick([n], D(10, 15, 23, 30), null)) === 'due', 'sched: 23:30 bắn');
  S.rollRepeat(n, D(10, 15, 23, 31), n.reminder.id);
  ok(n.reminder.due === D(10, 16, 23, 30) && !n.reminder.fired && !n.reminder.done, 'sched: rollRepeat -> 23:30 ngày mai', new Date(n.reminder.due).toString());
  ok(evTypes(S.tick([n], D(10, 16, 0, 5), null)) === '', 'sched: qua nửa đêm không bắn sớm');
  ok(evTypes(S.tick([n], D(10, 16, 23, 30), null)) === 'due', 'sched: ngày hôm sau bắn đúng 23:30');
  // lặp: kêu rồi nhưng không bấm Xong -> qua ngày vẫn bắn mốc mới đúng 1 lần
  n = mkNote('j', 'hằng ngày 23:30 uống thuốc', []);
  S.applyText(n, now);
  S.tick([n], D(10, 15, 23, 31), null);
  r = S.tick([n], D(10, 16, 23, 30), null);
  ok(evTypes(r) === 'due' && n.reminder.due === D(10, 16, 23, 30), 'sched: lặp chưa bấm xong -> hôm sau vẫn bắn mốc mới', evTypes(r));
  // máy tắt nhiều ngày: chỉ 1 due cho mốc mới nhất
  n = mkNote('k', 'hằng ngày 23:30 uống thuốc', []);
  S.applyText(n, now);
  r = S.tick([n], D(10, 18, 8), null);
  ok(evTypes(r) === 'due' && n.reminder.due === D(10, 17, 23, 30), 'sched: tắt máy 3 ngày -> 1 due, mốc 17/10 23:30', evTypes(r) + ' ' + new Date(n.reminder.due).toString());
  ok(evTypes(S.tick([n], D(10, 18, 8, 0, 5), null)) === '', 'sched: không bắn bù lần nữa');
  // lặp tuần T2+T6
  n = mkNote('l', 'thứ 2 và thứ 6 hàng tuần 9h họp', []);
  S.applyText(n, now);
  const wd = new Date(n.reminder.due);
  ok(n.reminder.repeat && n.reminder.repeat.freq === 'weekly' && wd.getDay() === 5 && wd.getHours() === 9, 'sched: tuần T2/T6 từ thứ Năm -> thứ Sáu 9h', wd.toString());
  ok(evTypes(S.tick([n], D(10, 16, 0, 0), null)) === '', 'sched: 00:00 thứ Sáu chưa bắn');
  ok(evTypes(S.tick([n], D(10, 16, 9), null)) === 'due', 'sched: thứ Sáu 9h bắn');
  S.rollRepeat(n, D(10, 16, 9, 1), n.reminder.id);
  const nx = new Date(n.reminder.due);
  ok(nx.getDay() === 1 && nx.getHours() === 9 && nx.getDate() === 19, 'sched: sau thứ Sáu -> thứ Hai 19/10 9h', nx.toString());
  ok(evTypes(S.tick([n], D(10, 18, 23, 59, 59), null)) === '' && evTypes(S.tick([n], D(10, 19, 9), null)) === 'due', 'sched: cuối tuần im, thứ Hai bắn');
  // đổi giờ
  n = mkNote('m', 'Họp', [mkRem(D(10, 15, 11))]);
  S.tick([n], D(10, 15, 11), null);
  S.setReminder(n, { due: D(10, 15, 14) }, D(10, 15, 11, 5));
  ok(!n.reminder.fired && n.reminder.due === D(10, 15, 14), 'sched: đổi giờ -> fired reset, due mới');
  ok(evTypes(S.tick([n], D(10, 15, 13, 59), null)) === '' && evTypes(S.tick([n], D(10, 15, 14), null)) === 'due', 'sched: đổi giờ -> bắn đúng giờ mới');
  n = mkNote('o', 'hằng ngày 23:30 uống thuốc', []);
  S.applyText(n, now);
  S.setReminder(n, { due: D(10, 15, 22) }, now);
  S.tick([n], D(10, 15, 22), null);
  S.rollRepeat(n, D(10, 15, 22, 1), n.reminder.id);
  ok(n.reminder.due === D(10, 16, 22), 'sched: đổi giờ nhắc lặp -> hôm sau theo giờ mới', new Date(n.reminder.due).toString());
  // sửa chữ
  n = mkNote('p', 'họp 11h', []);
  S.applyText(n, now);
  const d11 = n.reminder && n.reminder.due;
  n.text = 'họp 15h';
  S.applyText(n, now);
  ok(d11 === D(10, 15, 11) && n.reminders.length === 1 && n.reminder.due === D(10, 15, 15), 'sched: sửa chữ 11h -> 15h: vẫn 1 nhắc, due 15h', JSON.stringify(n.reminders.map(x => x.due)));
  // quá hạn khi mở lại app: kêu 1 lần
  n = mkNote('q', 'x', [mkRem(now - 2 * H)]);
  r = S.tick([n], now, null);
  ok(evTypes(r) === 'due', 'sched: due đã qua (mở app lại) -> bắn 1 lần');
  // dữ liệu rác không ném
  let threw = false;
  try { S.tick([{ id: 'z', text: '', reminders: [null, { due: 'x' }, { due: NaN }] }, { id: 'y' }], now, { lastNag: 0, busy: false }); } catch (_) { threw = true; }
  ok(!threw, 'sched: dữ liệu reminder rác không làm tick ném');
});

// ====================================================================== 3) STAGE
function mkHarness(o = {}) {
  const ts = o.ts || 0.004;
  const bus = new EventEmitter();
  const emitted = [];
  bus.on('pet:stageAction', e => emitted.push(e));
  const notes = [];
  const handlers = {};
  const calls = [];
  const h = { completed: [], snoozed: [], shown: [], pressedDone: 0, bigs: [], bigTitles: [], bigAborts: [], alarmStops: [], alarmSnoozes: [], says: [], notes, emitted, calls };
  const rec = name => (...a) => { calls.push([name, ...a]); };
  const actor = {
    on(type, cb) { handlers[type] = cb; },
    isReady: () => true, visible: () => true, whenReady: () => Promise.resolve(),
    say(text, opts) { h.says.push(text); calls.push(['say', text, opts]); },
    play: rec('play'), sound: rec('sound'), shake: rec('shake'), holdNote: rec('holdNote'), setStage: rec('setStage'), hush: rec('hush'), hide: rec('hide'),
    goToCorner() { calls.push(['goToCorner']); return Promise.resolve(); }
  };
  const findNote = id => notes.find(n => n.id === id) || null;
  const ctx = {
    bus,
    settings: () => ({ mascotEnabled: o.mascot !== false, sound: false }),
    findNote,
    store: { data: { notes } },
    notes: {
      completeNote(id) { h.completed.push(id); const n = findNote(id); if (n) S.markDone(n); return n; },
      snoozeNote(id, m) { h.snoozed.push([id, m]); const n = findNote(id); if (n) S.snooze(n, m, Date.now()); return n; },
      showNote(id) { h.shown.push(id); }
    },
    pet: { actor: o.noActor ? null : actor, settings: () => ({ bigAlert: o.big !== false }) },
    alarms: { stop: id => h.alarmStops.push(id), snooze: (id, m) => h.alarmSnoozes.push([id, m]) }
  };
  if (o.big !== false) {
    ctx.pet.bigAlert = info => {
      h.bigs.push(info.level); h.bigTitles.push(info.title);
      let resolve; const done = new Promise(r => { resolve = r; });
      const t = setTimeout(() => resolve({ reason: 'end' }), info.ms);
      return { done, abort(reason) { h.bigAborts.push(reason); clearTimeout(t); resolve({ reason }); } };
    };
  }
  electronStub.Notification.created.length = 0;
  const stage = stageLib.create(ctx, { Notification: electronStub.Notification, timeScale: ts });
  h.stage = stage; h.ctx = ctx; h.ts = ts;
  h.addNote = (id, title, dueOff, extra) => {
    const n = mkNote(id, title, [mkRem(Date.now() + (dueOff == null ? -1000 : dueOff), Object.assign({ fired: true }, extra))]);
    notes.push(n); return n;
  };
  h.press = (type, data) => { if (type === 'button' && data && data.id === 'done') h.pressedDone++; handlers[type] && handlers[type](data); };
  h.requestDue = id => stage.request({ kind: 'due', payload: { noteId: id } });
  h.idle = () => stage.current() === null && stage.size() === 0;
  h.sayCount = () => h.says.length;
  h.finish = async () => { stage.cancelWhere(() => true); await waitFor(h.idle, 2000); };
  // bất biến nghiêm trọng: completeNote chỉ được gọi sau một sự kiện button 'done'
  h.invariant = name => ok(h.completed.length <= h.pressedDone, 'stage[' + name + ']: completeNote KHÔNG được gọi nếu không có button done', 'completed=' + h.completed.length + ' pressedDone=' + h.pressedDone);
  return h;
}

section('stage', async () => {
  // --- A) không ai bấm: nhắc to mức 1..5 rồi dừng; tuyệt đối không completeNote
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('A', 'Alpha');
    h.requestDue('A');
    ok(await waitFor(() => h.bigs.length >= 1, 1500) && h.bigs[0] === 1, 'stage: due -> nhắc to mức 1 ngay', JSON.stringify(h.bigs));
    ok(await waitFor(() => h.sayCount() >= 1, 1500), 'stage: bé nói câu nhắc kèm nút');
    const t1 = Date.now();
    ok(await waitFor(() => h.bigs.length >= 2, 3000) && h.bigs[1] === 2, 'stage: 60s (scale) không phản hồi -> mức 2', JSON.stringify(h.bigs));
    const gap = Date.now() - t1, exp = 60000 * h.ts;
    ok(gap >= exp * 0.4 && gap <= exp * 2.5, 'stage: khoảng cách giữa các lần nhắc to ~60s (scale)', gap + 'ms vs ' + exp);
    ok(await waitFor(() => h.bigs.length >= 5, 4000), 'stage: leo tới mức 5', JSON.stringify(h.bigs));
    await sleep(60000 * h.ts * 2.2);
    ok(JSON.stringify(h.bigs) === '[1,2,3,4,5]', 'stage: sau mức 5 DỪNG nhắc to (không có mức 6, không lặp 1)', JSON.stringify(h.bigs));
    ok(h.completed.length === 0 && h.snoozed.length === 0, 'stage: không ai bấm -> không completeNote/snoozeNote', JSON.stringify([h.completed, h.snoozed]));
    ok(h.emitted.length === 0, 'stage: không ai bấm -> không có pet:stageAction');
    ok(h.stage.current() && h.stage.current().kind === 'due', 'stage: sau mức 5 vẫn cầm note ở góc (chỉ nhắc ở góc)');
    ok(await waitFor(h.idle, 6000), 'stage: tự buông sau ~10 phút (scale) khi không ai bấm');
    ok(h.completed.length === 0 && h.snoozed.length === 0, 'stage: tự buông vẫn không hoàn thành note');
    h.invariant('không bấm');
  }
  // --- B) nhắc to tắt: nhắc lại ở góc, vẫn không completeNote
  {
    const h = mkHarness({ ts: 0.004, big: false });
    h.addNote('B', 'Beta');
    h.requestDue('B');
    await waitFor(() => h.sayCount() >= 3, 4000);
    ok(h.sayCount() >= 3 && h.bigs.length === 0, 'stage: tắt bigAlert -> chỉ nhắc ở góc (>=3 câu), không nhắc to', h.sayCount() + '/' + h.bigs.length);
    ok(h.completed.length === 0, 'stage: tắt bigAlert, không bấm -> không completeNote');
    await h.finish(); h.invariant('big tắt');
  }
  // --- C) bấm Xong: completeNote đúng 1 lần, chỉ sau khi bấm
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('C', 'Gamma');
    h.requestDue('C');
    await waitFor(() => h.sayCount() >= 1, 1500);
    await sleep(80);
    ok(h.completed.length === 0, 'stage: trước khi bấm -> completeNote chưa gọi');
    h.press('button', { id: 'done' });
    ok(await waitFor(() => h.completed.length >= 1, 500), 'stage: bấm done -> completeNote được gọi');
    h.press('button', { id: 'done' });
    h.press('button', { id: 'done' });
    await waitFor(h.idle, 3000);
    ok(h.completed.length === 1 && h.completed[0] === 'C', 'stage: bấm done (kể cả bấm dồn) -> completeNote đúng 1 lần, đúng id', JSON.stringify(h.completed));
    ok(h.emitted.filter(e => e.button === 'done').length === 1 && h.snoozed.length === 0, 'stage: phát đúng 1 pet:stageAction done');
    ok(h.ctx.findNote('C').reminder.done, 'stage: note thật sự done sau khi bấm');
    h.invariant('done');
  }
  // --- D) Hoãn
  {
    const h = mkHarness({ ts: 0.004 });
    const n = h.addNote('D', 'Delta');
    h.requestDue('D');
    await waitFor(() => h.sayCount() >= 1, 1500);
    h.press('button', { id: 'snooze' });
    await waitFor(h.idle, 3000);
    ok(h.snoozed.length === 1 && h.snoozed[0][0] === 'D' && h.snoozed[0][1] === 10 && h.completed.length === 0, 'stage: snooze -> snoozeNote(D,10) 1 lần, không completeNote', JSON.stringify([h.snoozed, h.completed]));
    ok(n.reminder.due > Date.now() + 9 * MIN && !n.reminder.done, 'stage: sau hoãn note dời ~10 phút, chưa done');
    h.invariant('snooze');
  }
  // --- E) các sự kiện khác không bao giờ hoàn thành note
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('E', 'Epsilon');
    h.requestDue('E');
    await waitFor(() => h.sayCount() >= 1, 1500);
    h.press('sayEnd', {}); h.press('button', { id: 'zzz' }); h.press('button', {}); h.press('button', null); h.press('noop', {});
    await sleep(60);
    ok(h.stage.current() && h.completed.length === 0, 'stage: sayEnd/nút lạ -> vẫn giữ nút chờ, không completeNote');
    h.press('button', { id: 'open' });
    await waitFor(h.idle, 3000);
    ok(JSON.stringify(h.shown) === '["E"]' && h.completed.length === 0 && h.snoozed.length === 0, 'stage: open -> showNote, không completeNote', JSON.stringify(h.shown));
    h.addNote('E2', 'Epsilon2');
    h.requestDue('E2');
    await waitFor(() => h.sayCount() >= 2, 1500);
    h.press('noteClick', {});
    await waitFor(h.idle, 3000);
    ok(h.shown.includes('E2') && h.completed.length === 0, 'stage: noteClick -> mở note, không completeNote');
    h.invariant('sự kiện khác');
  }
  // --- F) note đổi giữa chừng -> dừng
  for (const [label, mutate] of [
    ['bị xoá', (h, n) => { h.notes.splice(h.notes.indexOf(n), 1); }],
    ['dời giờ sang tương lai', (h, n) => { S.setReminder(n, { due: Date.now() + 3 * H }, Date.now()); }],
    ['đã done ở nơi khác', (h, n) => { S.markDone(n); }],
    ['bị snooze ở nơi khác', (h, n) => { S.snooze(n, 30, Date.now()); }]
  ]) {
    const h = mkHarness({ ts: 0.02 });
    const n = h.addNote('F', 'Phi');
    h.requestDue('F');
    await waitFor(() => h.bigs.length >= 1, 1500);
    mutate(h, n);
    const t0 = Date.now();
    const stopped = await waitFor(h.idle, 3000);
    ok(stopped, 'stage: note ' + label + ' giữa chừng -> phiên dừng', 'sau ' + (Date.now() - t0) + 'ms');
    ok(h.completed.length === 0 && h.bigs.length === 1, 'stage: note ' + label + ' -> không completeNote, không nhắc to thêm', JSON.stringify([h.completed, h.bigs]));
    ok(h.bigAborts.includes('invalid') || h.bigs.length === 1, 'stage: note ' + label + ' -> đóng nhắc to đang đập', JSON.stringify(h.bigAborts));
    h.invariant('đổi giữa chừng ' + label);
  }
  // note đổi giữa chừng khi đang cầm ở góc (sau nhắc to)
  {
    const h = mkHarness({ ts: 0.004, big: false });
    const n = h.addNote('G', 'Gi');
    h.requestDue('G');
    await waitFor(() => h.sayCount() >= 1, 1500);
    h.notes.splice(h.notes.indexOf(n), 1);
    ok(await waitFor(h.idle, 2000), 'stage: note bị xoá lúc bé đang cầm -> buông trong ~1.5s (scale)');
    ok(h.completed.length === 0, 'stage: note bị xoá -> không completeNote');
  }
  // --- G) hai due liền nhau xếp hàng
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('A1', 'Alpha'); h.addNote('B1', 'Beta');
    h.requestDue('A1'); h.requestDue('B1');
    await waitFor(() => h.sayCount() >= 1, 1500);
    ok(h.stage.current().payload.noteId === 'A1' && h.stage.size() === 1, 'stage: 2 due liền -> A diễn, B xếp hàng', JSON.stringify(h.stage.current()) + ' size=' + h.stage.size());
    ok(!h.says.some(s => /Beta/.test(s)), 'stage: B chưa nói khi A đang diễn');
    h.press('button', { id: 'done' });
    ok(await waitFor(() => h.says.some(s => /Beta/.test(s)), 3000), 'stage: sau A tới lượt B');
    ok(JSON.stringify(h.completed) === '["A1"]', 'stage: chỉ A hoàn thành (B chưa bấm)', JSON.stringify(h.completed));
    h.press('button', { id: 'snooze' });
    await waitFor(h.idle, 3000);
    ok(JSON.stringify(h.snoozed) === '[["B1",10]]' && JSON.stringify(h.completed) === '["A1"]', 'stage: B hoãn riêng, A không bị động', JSON.stringify([h.snoozed, h.completed]));
    h.invariant('hàng đợi');
  }
  // --- H) alarm chen ngang, due quay lại, không nhắc to lại mức 1
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('H', 'Eta');
    h.requestDue('H');
    await waitFor(() => h.sayCount() >= 1, 1500);
    h.stage.request({ kind: 'alarm', payload: { alarmId: 7, label: 'Dậy' } });
    ok(await waitFor(() => h.stage.current() && h.stage.current().kind === 'alarm', 1500), 'stage: alarm (100) chen ngang due (90)');
    await sleep(30);
    ok(h.completed.length === 0, 'stage: due bị chen ngang không completeNote');
    h.press('button', { id: 'stop' });
    ok(await waitFor(() => h.alarmStops.length === 1, 1500) && h.alarmStops[0] === 7, 'stage: alarm stop -> ctx.alarms.stop(7)');
    ok(await waitFor(() => h.stage.current() && h.stage.current().kind === 'due', 3000), 'stage: due quay lại sau alarm');
    await sleep(40);
    ok(h.bigTitles.filter(t => /Eta/.test(t)).length === 1, 'stage: due quay lại không đập lại mức 1', JSON.stringify(h.bigTitles));
    ok(h.completed.length === 0, 'stage: sau alarm vẫn chưa completeNote (chưa ai bấm done)');
    await h.finish(); h.invariant('alarm chen');
  }
  // alarm snooze
  {
    const h = mkHarness({ ts: 0.004 });
    h.stage.request({ kind: 'alarm', payload: { alarmId: 9, label: 'X', snoozeMin: 5 } });
    await waitFor(() => h.sayCount() >= 1, 1500);
    h.press('button', { id: 'snooze' });
    await waitFor(h.idle, 3000);
    ok(JSON.stringify(h.alarmSnoozes) === '[[9,5]]' && h.alarmStops.length === 0, 'stage: alarm snooze -> ctx.alarms.snooze(9,5)', JSON.stringify(h.alarmSnoozes));
    ok(h.stage.request({ kind: 'alarm', payload: { alarmId: 9 } }) === h.stage.request({ kind: 'alarm', payload: { alarmId: 9 } }), 'stage: cùng alarmId không nhân đôi');
    await h.finish();
  }
  // --- I) validItem (qua hành vi): mục không hợp lệ bị bỏ, không diễn
  {
    const h = mkHarness({ ts: 0.004 });
    const fut = h.addNote('V1', 'Tương lai', 3 * H, { fired: false });
    const dn = h.addNote('V2', 'Đã xong', -1000); S.markDone(dn);
    h.requestDue('KHONGCO');
    h.requestDue('V1'); h.requestDue('V2');
    h.stage.request({ kind: 'nag' });
    h.stage.request({ kind: 'pre', payload: { noteId: 'KHONGCO' } });
    await sleep(120);
    ok(h.calls.length === 0 && h.sayCount() === 0, 'stage.validItem: due note không có/chưa tới/đã done + nag không có quá hạn + pre note không có -> bị bỏ, bé không diễn', JSON.stringify(h.calls.slice(0, 3)));
    ok(electronStub.Notification.created.length === 0, 'stage.validItem: mục bị bỏ không bắn thông báo dự phòng');
    h.addNote('V3', 'Sát giờ', 1000, { fired: false });
    h.requestDue('V3');
    ok(await waitFor(() => h.sayCount() >= 1, 1500), 'stage.validItem: due trong 1.5s tới là hợp lệ');
    await h.finish();
    h.addNote('V4', 'Pre', 5 * MIN, { fired: false, lead: 10 * MIN });
    h.stage.request({ kind: 'pre', payload: { noteId: 'V4' } });
    ok(await waitFor(() => h.sayCount() >= 1, 1500), 'stage.validItem: pre note hợp lệ được diễn');
    await h.finish();
    h.addNote('V5', 'Trễ', -30 * MIN); // fired, quá hạn 30 phút
    h.stage.request({ kind: 'nag' });
    ok(await waitFor(() => h.sayCount() >= 1, 1500), 'stage.validItem: nag có note quá hạn được diễn');
    h.press('button', { id: 'later' });
    await h.finish();
    ok(h.completed.length === 0, 'stage: nag không bao giờ completeNote');
    h.invariant('validItem');
  }
  // --- J) không có bé / tắt bé -> thông báo dự phòng, không completeNote
  for (const [label, o] of [['không có actor', { noActor: true }], ['tắt mascot', { mascot: false }]]) {
    const h = mkHarness(o);
    h.addNote('J', 'Jay');
    h.requestDue('J');
    await waitFor(h.idle, 1500);
    await sleep(20);
    const nt = electronStub.Notification.created;
    ok(nt.length === 1 && nt[0].shown && /Jay/.test(nt[0].opts.title), 'stage: ' + label + ' -> đúng 1 thông báo dự phòng có tiêu đề note', nt.length + ' ' + (nt[0] && JSON.stringify(nt[0].opts)));
    ok(h.completed.length === 0, 'stage: ' + label + ' -> không completeNote');
    nt[0] && nt[0].emit('click');
    ok(h.shown.includes('J'), 'stage: bấm thông báo dự phòng -> mở note');
  }
  // --- K) huỷ / nudge
  {
    const h = mkHarness({ ts: 0.004 });
    h.addNote('K', 'Kappa');
    h.requestDue('K');
    await waitFor(() => h.sayCount() >= 1, 1500);
    await sleep(10);
    const before = h.sayCount();
    ok(h.stage.nudge('nhắc lại nè') === true, 'stage: nudge khi đang cầm due -> true');
    ok(await waitFor(() => h.sayCount() > before, 500), 'stage: nudge -> bé nói lại kèm nút');
    ok(h.completed.length === 0, 'stage: nudge không completeNote');
    ok(h.stage.cancelWhere(it => it.payload && it.payload.noteId === 'K') >= 1, 'stage: cancelWhere huỷ phiên đang diễn');
    ok(await waitFor(h.idle, 1500) && h.completed.length === 0, 'stage: huỷ phiên -> dừng, không completeNote');
    ok(h.stage.nudge('x') === false, 'stage: hết phiên -> nudge false');
    h.invariant('huỷ/nudge');
  }
  // --- L) mochi chủ đích thay đổi: persona ném lỗi không làm hỏng luồng
  {
    const h = mkHarness({ ts: 0.004 });
    h.ctx.persona = { pick() { throw new Error('persona hỏng'); } };
    h.addNote('L', 'Lambda');
    h.requestDue('L');
    ok(await waitFor(() => h.sayCount() >= 1, 1500), 'stage: persona.pick ném lỗi -> dùng câu mặc định, vẫn diễn');
    h.press('button', { id: 'done' });
    await waitFor(h.idle, 3000);
    ok(h.completed.length === 1, 'stage: persona lỗi vẫn hoàn thành đúng 1 lần khi bấm done');
    h.invariant('persona lỗi');
  }
});

// ====================================================================== 4) LỆNH PHÁ HOẠI CỦA BÉ
section('commands', () => {
  const NOW = D(10, 15, 10);
  const kind = t => { const c = C.parse(t, NOW); return c.kind; };
  // đối chứng: câu khẳng định thì chạy
  for (const [t, k] of [['xoá note này', 'trashThis'], ['dọn dẹp', 'cleanDone'], ['xóa note này đi', 'trashThis'], ['dọn dẹp đi', 'cleanDone']]) ok(kind(t) === k, 'cmd: "' + t + '" -> ' + k, kind(t));
  // phủ định -> không chạy
  for (const t of ['đừng xoá note này', 'không dọn dẹp', 'chưa xoá', 'dừng xoá', 'khoan xoá', 'đừng dọn note nha', 'không cần xoá', 'đừng xóa note này nhé', 'không được xoá note này', 'ko xoa note nay', 'kh xoá', 'mình không muốn dọn dẹp', 'thôi đừng dọn', 'thôi không xoá nữa', 'đừng có dọn dẹp', 'khỏi dọn dẹp', 'tớ chưa muốn xoá note này'])
    ok(kind(t) === 'negated', 'cmd: phủ định "' + t + '" -> negated, không chạy', kind(t));
  // câu hỏi -> hỏi lại, không chạy
  for (const t of ['có xoá note này không', 'nên xoá note này không', 'có nên dọn dẹp không', 'có phải xoá note này không', 'tớ có nên xóa note này không?'])
    ok(kind(t) === 'unclear', 'cmd: câu hỏi "' + t + '" -> unclear (hỏi lại)', kind(t));
  // lệnh gộp có phủ định: không được chạy vế bị phủ định
  const mixed = C.parse('đừng xoá note này rồi hát', NOW);
  ok(!(mixed.kind === 'trashThis') && !(mixed.kind === 'multi' && mixed.cmds.some(c => c.kind === 'trashThis')), 'cmd: "đừng xoá note này rồi hát" không được xoá', JSON.stringify(mixed));
  // câu hỏi kiểu khác (đuôi/đầu câu hỏi, giả định) -> hỏi lại, không chạy
  for (const t of ['dọn dẹp được không', 'xoá note này không nhỉ', 'xoá note này à?', 'dọn dẹp hả', 'dọn dẹp làm gì', 'nếu xoá note này thì sao', 'xoá note này là sao', 'tại sao dọn dẹp'])
    ok(kind(t) === 'unclear', 'cmd: câu hỏi "' + t + '" -> unclear (hỏi lại), không chạy', JSON.stringify(C.parse(t, NOW)));
});

// ====================================================================== 5) STORE
section('store', () => {
  const noteJson = id => ({ id, html: '<p>' + id + '</p>', text: id, color: 'yellow', bounds: { x: 1, y: 2, width: 300, height: 300 }, visible: true, alwaysOnTop: false, createdAt: 1, updatedAt: 1, reminders: [] });
  const wr = (dir, name, txt) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), txt, 'utf8'); };
  const files = dir => fs.readdirSync(dir);

  // khứ hồi
  let dir = tmpDir();
  let st = createStore(dir);
  ok(st.isFirstRun && st.notes.length === 0, 'store: thư mục trống -> firstRun');
  st.data.notes.push(noteJson('n1'));
  const sec = st.section('pet', () => ({ xp: 0 }));
  sec.xp = 42;
  st.save(); st.flushSync();
  ok(!files(dir).includes('mochi-data.json.tmp'), 'store: ghi nguyên tử không để lại .tmp');
  let st2 = createStore(dir);
  ok(st2.notes.length === 1 && st2.notes[0].id === 'n1' && st2.section('pet', () => ({ xp: 0 })).xp === 42, 'store: ghi rồi đọc lại đủ note + ngăn');
  // ngăn lạ giữ nguyên khi ghi lại
  wr(dir, 'mochi-data.json', JSON.stringify({ version: 2, notes: [noteJson('n1')], settings: {}, tuongLai: { a: 1 } }));
  st = createStore(dir); st.save(); st.flushSync();
  ok(JSON.parse(fs.readFileSync(path.join(dir, 'mochi-data.json'), 'utf8')).tuongLai.a === 1, 'store: ngăn chưa đăng ký không bị mất khi ghi lại');

  // file hỏng, không có sao lưu
  for (const [label, txt] of [['JSON cụt', '{"notes":[{"id":"x"'], ['rỗng 0 byte', ''], ['rác nhị phân', '\u0000\u0001\u0002 not json'], ['gốc là mảng', '[1,2,3]'], ['notes sai kiểu', '{"notes":"oops"}']]) {
    dir = tmpDir();
    wr(dir, 'mochi-data.json', txt);
    let s, threw = false;
    try { s = createStore(dir); } catch (_) { threw = true; }
    ok(!threw, 'store: file hỏng (' + label + ') không làm createStore ném');
    if (threw) continue;
    ok(s.notes.length === 0 && !!s.corruptCopy && files(dir).some(f => /^mochi-data\.corrupt-/.test(f)), 'store: hỏng (' + label + ') -> cất bản hỏng, bắt đầu rỗng', String(s.corruptCopy));
    ok(s.corruptCopy && fs.readFileSync(s.corruptCopy, 'utf8') === txt, 'store: bản hỏng (' + label + ') được giữ nguyên văn');
    ok(s.recoveredFrom === null, 'store: không có sao lưu -> recoveredFrom null (main sẽ báo người dùng)');
    s.data.notes.push(noteJson('moi')); s.save(); s.flushSync();
    ok(createStore(dir).notes.length === 1, 'store: sau hỏng vẫn ghi/đọc bình thường');
  }
  // hỏng + có sao lưu -> khôi phục
  dir = tmpDir();
  wr(dir, 'backups/mochi-data-2026-10-13.json', '{broken');
  wr(dir, 'backups/mochi-data-2026-10-14.json', JSON.stringify({ version: 2, notes: [noteJson('b1'), noteJson('b2')], settings: { sound: false } }));
  wr(dir, 'mochi-data.json', '{"notes":[');
  st = createStore(dir);
  ok(st.notes.length === 2 && st.recoveredFrom && /2026-10-14/.test(st.recoveredFrom) && st.settings.sound === false, 'store: hỏng + có sao lưu -> khôi phục bản hợp lệ mới nhất (bỏ qua bản sao lưu hỏng)', String(st.recoveredFrom));
  let reread; try { reread = JSON.parse(fs.readFileSync(path.join(dir, 'mochi-data.json'), 'utf8')); } catch (_) { reread = null; }
  ok(reread && reread.notes.length === 2, 'store: file chính được đặt lại bằng bản khôi phục');
  ok(files(dir).some(f => /^mochi-data\.corrupt-/.test(f)), 'store: bản hỏng vẫn được cất khi khôi phục');
  // giới hạn số bản hỏng
  dir = tmpDir();
  for (let i = 0; i < 8; i++) { wr(dir, 'mochi-data.json', '{bad' + i); createStore(dir); }
  ok(files(dir).filter(f => /^mochi-data\.corrupt-/.test(f)).length <= 5, 'store: giữ tối đa 5 bản hỏng', String(files(dir).filter(f => /^mochi-data\.corrupt-/.test(f)).length));
  // ngăn sai kiểu: cất nguyên bản, dùng mặc định
  dir = tmpDir();
  wr(dir, 'mochi-data.json', JSON.stringify({ version: 2, notes: [], settings: {}, game: 'rac' }));
  st = createStore(dir);
  const g = st.section('game', () => ({ coins: 0 }), v => { if (typeof v !== 'object') throw new Error('sai kiểu'); return v; });
  ok(g.coins === 0 && files(dir).some(f => /^mochi-data\.section-game-/.test(f)), 'store: ngăn sai kiểu -> mặc định + cất nguyên bản vào file riêng');
  // note rác bị lọc, trùng id bị loại, BOM
  dir = tmpDir();
  wr(dir, 'mochi-data.json', '﻿' + JSON.stringify({ notes: [noteJson('d'), noteJson('d'), null, 5, { id: '' }, { x: 1 }, { id: 'e', reminders: [{ due: 'x' }, null, { due: 5 }] }], settings: { __proto__: 1, sound: 'yes' } }));
  st = createStore(dir);
  ok(st.notes.length === 2 && st.notes.map(n => n.id).join() === 'd,e' && st.notes[1].reminders.length === 1, 'store: BOM + note rác/trùng id được lọc, reminder rác bị bỏ', st.notes.map(n => n.id).join());
  ok(st.settings.sound === true, 'store: setting sai kiểu -> giữ mặc định');
  ok(!('corruptCopy' in {}) || !st.corruptCopy, 'store: file chỉ có dữ liệu rác lẻ không bị coi là hỏng cả file');
  // sao lưu hằng ngày: không sao lưu file hỏng
  dir = tmpDir();
  st = createStore(dir); st.data.notes.push(noteJson('s')); st.save(); st.flushSync();
  st = createStore(dir);   // phiên mới (khởi động lại app) -> lần ghi đầu trong ngày sao lưu file hiện có
  st.data.notes.push(noteJson('s2')); st.save(); st.flushSync();
  ok(files(path.join(dir, 'backups')).some(f => /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)), 'store: có sao lưu hằng ngày trong backups/');
});

// ====================================================================== 6) LOGGER
section('logger', () => {
  const L = require(R('src/main/logger.js'));
  const logDir = path.join(tmpDir(), 'logs');
  L._setDir(logDir);
  const fakeApp = Object.assign(new EventEmitter(), { getVersion: () => '9.9.9-test', getPath: () => tmpRoot });
  process.on('exit', () => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* bỏ qua */ } });   // đăng ký SAU logger.init? (init bên dưới) — logger flush trước rồi mới dọn
  const savedErr = console.error;
  L.init(fakeApp);
  process.on('exit', () => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* bỏ qua */ } });
  ok(L.dir() === logDir, 'logger: dir() trả thư mục log đã đặt');
  // dữ liệu cũ để kiểm xoay vòng 7 ngày (tạo TRƯỚC lần flush đầu)
  fs.mkdirSync(logDir, { recursive: true });
  const dayStr = off => { const d = new Date(); d.setDate(d.getDate() - off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  for (const off of [30, 8, 7, 6, 1]) fs.writeFileSync(path.join(logDir, 'mochi-' + dayStr(off) + '.log'), 'cũ ' + off + '\n');
  fs.writeFileSync(path.join(logDir, 'mochi-' + dayStr(9) + '.1.log'), 'cũ 9.1\n');
  fs.writeFileSync(path.join(logDir, 'ghi-chu.txt'), 'không phải log');
  // sự kiện
  const wc = Object.assign(new EventEmitter(), { id: 5 });
  fakeApp.emit('web-contents-created', {}, wc);
  wc.emit('console-message', {}, 3, 'Lỗi renderer cũ', 12, 'file:///x/src/note/note.js');          // Electron <= 34, mức error
  wc.emit('console-message', {}, 1, 'chỉ là info', 1, 'a.js');                                         // bị bỏ
  wc.emit('console-message', { level: 'error', message: 'Lỗi renderer mới', lineNumber: 7, sourceId: 'b.js' });   // Electron >= 35
  wc.emit('console-message', { level: 'warning', message: 'cảnh báo bỏ', lineNumber: 7, sourceId: 'b.js' });
  fakeApp.emit('render-process-gone', {}, { id: 5 }, { reason: 'crashed', exitCode: 133 });
  fakeApp.emit('child-process-gone', {}, { type: 'GPU', reason: 'launch-failed', exitCode: 1 });
  expectProc = true;
  process.emit('uncaughtException', new Error('BOOM_UNCAUGHT'), 'uncaughtException');
  process.emit('unhandledRejection', new Error('BOOM_REJECT'), null);
  expectProc = false;
  console.error('[x] lỗi từ console.error', new Error('BOOM_CONSOLE'));
  console.warn('canh bao main');
  L.write('INFO', 'tag', 'dòng\nnhiều dòng');
  L.flush();
  const files = fs.readdirSync(logDir);
  const today = path.join(logDir, 'mochi-' + dayStr(0) + '.log');
  ok(fs.existsSync(today), 'logger: tạo file mochi-YYYY-MM-DD.log', files.join());
  const txt = fs.existsSync(today) ? fs.readFileSync(today, 'utf8') : '';
  const has = (re, name) => ok(re.test(txt), 'logger: ghi ' + name);
  has(/9\.9\.9-test/, 'phiên bản app');
  has(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \[ERROR\]/m, 'thời gian + mức');
  has(/Lỗi renderer cũ \(note\.js:12\)/, 'console-message error (kiểu cũ), rút gọn nguồn');
  has(/Lỗi renderer mới \(b\.js:7\)/, 'console-message error (kiểu mới)');
  ok(!/chỉ là info|cảnh báo bỏ/.test(txt), 'logger: không ghi console-message mức info/warning của renderer');
  has(/render-process-gone.*crashed.*133/, 'render-process-gone');
  has(/child-process-gone.*GPU.*launch-failed/, 'child-process-gone');
  has(/\[FATAL\].*BOOM_UNCAUGHT/s, 'uncaughtException');
  has(/BOOM_REJECT/, 'unhandledRejection');
  has(/\[ERROR\] \[main\].*BOOM_CONSOLE/s, 'console.error của main');
  has(/\[WARN\] \[main\] canh bao main/, 'console.warn của main');
  has(/dòng\n {4}nhiều dòng/, 'dòng nhiều hàng được thụt vào');
  // xoay vòng theo ngày
  const left = fs.readdirSync(logDir);
  ok(!left.includes('mochi-' + dayStr(30) + '.log') && !left.includes('mochi-' + dayStr(8) + '.log') && !left.includes('mochi-' + dayStr(9) + '.1.log'), 'logger: xoá log quá 7 ngày (kể cả .1.log)', left.join());
  ok(left.includes('mochi-' + dayStr(6) + '.log') && left.includes('mochi-' + dayStr(1) + '.log') && left.includes('ghi-chu.txt'), 'logger: giữ log trong 7 ngày + file lạ', left.join());
  // giới hạn 2MB
  const line = 'x'.repeat(1000);
  for (let i = 0; i < 3500; i++) L.write('ERROR', 'spam', line + i);
  L.flush();
  const sizes = fs.readdirSync(logDir).filter(f => /^mochi-\d{4}/.test(f)).map(f => [f, fs.statSync(path.join(logDir, f)).size]);
  ok(sizes.every(([, s]) => s <= L.MAX_BYTES), 'logger: mọi file <= 2MB', JSON.stringify(sizes.filter(([, s]) => s > L.MAX_BYTES)));
  ok(fs.existsSync(path.join(logDir, 'mochi-' + dayStr(0) + '.1.log')), 'logger: file đầy được xoay sang .1.log');
  // một dòng khổng lồ bị cắt, không ném
  let threw = false;
  try { L.write('ERROR', 'big', 'y'.repeat(5 * 1024 * 1024)); L.flush(); L.write('ERROR', 'obj', undefined); L.error('t', { a: { b: { c: { d: 1 } } } }); L.error('t', null); L.flush(); } catch (_) { threw = true; }
  ok(!threw, 'logger: thông điệp khổng lồ / đối tượng lạ không làm ném');
  ok(fs.readdirSync(logDir).filter(f => /^mochi-\d{4}/.test(f)).every(f => fs.statSync(path.join(logDir, f)).size <= L.MAX_BYTES), 'logger: sau dòng khổng lồ vẫn <= 2MB');
  // thư mục không ghi được: không ném
  L._setDir(path.join(tmpRoot, 'NUL:\\khong*hop?le'));
  threw = false;
  try { L.write('ERROR', 't', 'abc'); L.flush(); } catch (_) { threw = true; }
  ok(!threw, 'logger: ổ đĩa/đường dẫn lỗi -> không ném');
  L._setDir(logDir);
  console.error = savedErr;
});

// ====================================================================== toast (nút Xong/Hoãn trên toast cũ)
section('toast', () => {
  const T = require(R('src/main/alarms/toast.js'));
  const DUE = D(10, 15, 12);
  const mk = () => {
    const bus = new EventEmitter();
    const notes = [mkNote('t1', 'Toast', [mkRem(DUE, { id: 'r1', fired: true })])];
    const calls = { done: [], snooze: [] };
    const ctx = {
      bus, alarms: {}, findNote: id => notes.find(n => n.id === id) || null,
      notes: {
        completeNote(id, r) { calls.done.push([id, r]); },
        snoozeNote(id, m, r) { calls.snooze.push([id, m, r]); },
        showNote() {}
      }
    };
    T.init(ctx);
    return { ctx, notes, calls };
  };
  const url = (act, o) => T.toastUrl('note', act, 't1', Object.assign({ r: 'r1', d: DUE, m: 10 }, o));
  ok(T.parseToastUrl(url('done')).d === DUE, 'toast: url mang giờ nhắc (d)');
  { const h = mk(); h.ctx.alarms.handleToastUrl(url('done')); ok(h.calls.done.length === 1 && h.calls.done[0][1] === 'r1', 'toast: hợp lệ -> completeNote đúng 1 lần'); }
  { const h = mk(); h.ctx.alarms.handleToastUrl(url('snooze')); ok(h.calls.snooze.length === 1, 'toast: hợp lệ -> snoozeNote 1 lần'); }
  { const h = mk(); h.notes[0].reminders[0].done = true; h.ctx.alarms.handleToastUrl(url('done')); ok(!h.calls.done.length, 'toast cũ: nhắc đã done -> không completeNote'); }
  { const h = mk(); h.notes[0].reminders[0].done = true; h.ctx.alarms.handleToastUrl(url('snooze')); ok(!h.calls.snooze.length, 'toast cũ: nhắc đã done -> không snoozeNote'); }
  { const h = mk(); h.notes[0].reminders[0].due = DUE + 10 * MIN; h.ctx.alarms.handleToastUrl(url('done')); ok(!h.calls.done.length, 'toast cũ: đã hoãn/đổi giờ -> không completeNote'); }
  { const h = mk(); h.notes[0].reminders[0].due = DUE + 10 * MIN; h.ctx.alarms.handleToastUrl(url('snooze')); ok(!h.calls.snooze.length, 'toast cũ: đổi giờ -> không snoozeNote'); }
  { const h = mk(); h.notes.length = 0; h.ctx.alarms.handleToastUrl(url('done')); ok(!h.calls.done.length, 'toast cũ: note đã xoá/vào thùng rác -> không completeNote'); }
  { const h = mk(); h.notes[0].reminders = []; h.notes[0].reminder = null; h.ctx.alarms.handleToastUrl(url('done')); ok(!h.calls.done.length, 'toast cũ: nhắc đã bị gỡ -> không completeNote'); }
  { const h = mk(); h.ctx.alarms.handleToastUrl(url('done', { r: 'rX' })); ok(!h.calls.done.length, 'toast cũ: sai id nhắc -> không completeNote'); }
});

// ====================================================================== chạy
(async () => {
  const t0 = Date.now();
  for (const [name, fn] of sections) {
    const before = [pass, fail];
    try { await fn(); } catch (e) { fail++; failures.push('[' + name + '] ngoại lệ trong test: ' + (e && e.stack || e)); }
    out('  ' + name.padEnd(10) + ' đạt ' + (pass - before[0]) + ', sai ' + (fail - before[1]));
  }
  out('');
  if (bugs.length) {
    out('LỖI CỦA CODE CHÍNH (đã biết, không tính vào exit; STRICT=1 để tính): ' + bugs.length);
    for (const b of bugs) out('  ! ' + b);
    out('');
  }
  if (failures.length) { out('SAI:'); for (const f of failures) out('  x ' + f); }
  out('Tổng: ' + (pass + fail + knownBug) + ' ca, đạt ' + pass + ', sai ' + fail + ', lỗi code chính đã biết ' + knownBug + ' (' + (Date.now() - t0) + 'ms)');
  console.error = rawErr;
  process.exit(fail ? 1 : 0);
})();
