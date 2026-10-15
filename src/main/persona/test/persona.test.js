'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { _internal: P } = require('../index.js');

function setup(lines, over) {
  over = over || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-'));
  const file = path.join(dir, 'vi.json');
  fs.writeFileSync(file, JSON.stringify(lines));
  const sections = {};
  let saves = 0;
  const ctx = {
    bus: new EventEmitter(),
    store: {
      data: Object.assign({ notes: [], alarms: { list: [] } }, over.data),
      section(name, def, norm) { return sections[name] || (sections[name] = norm ? norm(over.raw || def()) : def()); },
      save() { saves++; }
    }
  };
  ctx.findNote = id => ctx.store.data.notes.find(n => n.id === id) || null;
  let t = over.t || new Date(2026, 0, 5, 9, 0).getTime(); // thứ Hai 9h
  const timers = [];
  const fake = {
    setTimeout: (fn, ms) => { const h = { fn, ms, on: true }; timers.push(h); return h; },
    clearTimeout: h => { if (h) h.on = false; }
  };
  const persona = P.createPersona(ctx, { file, now: () => t, setTimeout: fake.setTimeout, clearTimeout: fake.clearTimeout });
  const out = [];
  ctx.bus.on('persona:line', l => out.push(l));
  const flush = () => { for (const h of timers.splice(0)) if (h.on) { h.on = false; h.fn(); } };
  return { ctx, persona, out, timers, flush, box: sections.persona, saves: () => saves, advance: ms => { t += ms; }, setTime: x => { t = x; } };
}
const L = (id, event, text, extra) => Object.assign({ id, event, text }, extra);

test('normalize chịu dữ liệu thiếu/cũ và giới hạn 20', () => {
  assert.deepEqual(P.normalize(null), P.defaults());
  const n = P.normalize({ recentLines: Array.from({ length: 30 }, (_, i) => 'x' + i).concat([5]), name: 7, settings: { chatterEveryMin: -1 } });
  assert.equal(n.recentLines.length, 20); assert.equal(n.recentLines[19], 'x29');
  assert.equal(n.name, ''); assert.equal(n.settings.chatterEveryMin, 20); assert.equal(n.settings.chatter, true);
});

test('titleOf bỏ HTML và cắt 40 ký tự', () => {
  assert.equal(P.titleOf({ text: '\n  Họp nhóm\nchi tiết' }), 'Họp nhóm');
  assert.equal(P.titleOf({ text: '', html: '<div><b>Gọi</b>&nbsp;mẹ</div><div>x</div>' }), 'Gọi mẹ');
  assert.equal(P.titleOf({ text: 'a'.repeat(60) }).length, 40);
  assert.equal(P.titleOf(null), '');
});

test('pick thêm name, ghi recentLines, lưu store', () => {
  const s = setup([L('a', 'click', 'Chào {name}')]);
  s.box.name = 'Hà';
  const r = s.ctx.persona.pick('click');
  assert.equal(r.text, 'Chào Hà');
  assert.deepEqual(s.box.recentLines, ['a']);
  assert.equal(s.saves(), 1);
  assert.equal(s.ctx.persona.pick('khong-co'), null);
  assert.equal(s.ctx.persona.lines.length, 1);
});

test('file thoại lỗi thì mảng rỗng', () => {
  const s = setup([]);
  fs.writeFileSync(path.join(os.tmpdir(), 'x'), '');
  assert.deepEqual(s.persona.lines, []);
  assert.equal(s.persona.pick('click'), null);
});

test('pet:interact chỉ nói lift/drop, chống spam 4s; click/pat/feed do phòng khác nói', () => {
  const s = setup([L('l', 'lift', 'á nhấc'), L('d', 'drop', 'phịch'), L('h', 'pat_head', 'hihi'), L('f', 'feed', 'ngon {item}'), L('c', 'click', 'hửm')]);
  for (const kind of ['click', 'pat-head', 'pat-body', 'feed']) s.ctx.bus.emit('pet:interact', { kind, itemId: 'kẹo' });
  assert.equal(s.out.length, 0);
  s.ctx.bus.emit('pet:interact', { kind: 'lift' });
  s.ctx.bus.emit('pet:interact', { kind: 'lift' });
  assert.equal(s.out.length, 1);
  assert.equal(s.out[0].priority, 20); assert.equal(s.out[0].ttlMs, 6000);
  s.advance(4001);
  s.ctx.bus.emit('pet:interact', { kind: 'lift' });
  s.ctx.bus.emit('pet:interact', { kind: 'drop' });
  assert.deepEqual(s.out.map(o => o.text), ['á nhấc', 'á nhấc', 'phịch']);
  s.ctx.bus.emit('pet:interact', { kind: 'bậy' });
  assert.equal(s.out.length, 3);
});

test('startup + lời chào buổi tối đa 1 lần/ngày', () => {
  const s = setup([L('s', 'startup', 'dậy'), L('m', 'morning', 'chào sáng')]);
  s.ctx.bus.emit('app:startup', {});
  assert.deepEqual(s.out.map(o => o.text), ['dậy', 'chào sáng']);
  assert.equal(s.out[0].ttlMs, 15000);
  assert.equal(s.box.greeted.morning, '2026-01-05');
  s.ctx.bus.emit('app:startup', {});
  assert.deepEqual(s.out.map(o => o.text), ['dậy', 'chào sáng', 'dậy']);
});

test('app:resume không quá 1 lần/10 phút', () => {
  const s = setup([L('w', 'wake', 'dậy rồi')]);
  s.ctx.bus.emit('app:resume', {}); s.ctx.bus.emit('app:resume', {});
  assert.equal(s.out.length, 1);
  s.advance(10 * 6e4 + 1);
  s.ctx.bus.emit('app:resume', {});
  assert.equal(s.out.length, 2);
});

test('pet:idleTick: chatter, ngưỡng thời gian, sleepy theo energy', () => {
  const s = setup([L('i', 'idle', 'rảnh'), L('z', 'sleepy', 'buồn ngủ'), L('m', 'morning', 'sáng')]);
  s.ctx.bus.emit('pet:idleTick', { quietMs: 90000 });
  assert.equal(s.out.length, 0);                       // chưa đủ 20 phút
  s.advance(21 * 6e4);
  s.ctx.bus.emit('pet:idleTick', { quietMs: 1000 });
  assert.equal(s.out.length, 0);                       // chưa yên đủ lâu
  s.ctx.bus.emit('pet:idleTick', { quietMs: 90000 });
  assert.equal(s.out[0].text, 'sáng');                 // chào buổi trước
  s.advance(21 * 6e4);
  s.ctx.bus.emit('game:mode', { mode: 'tired', energy: 10 });
  s.ctx.bus.emit('pet:idleTick', { quietMs: 90000 });
  assert.equal(s.out[1].text, 'buồn ngủ'); assert.equal(s.out[1].priority, 10);
  s.advance(21 * 6e4);
  s.ctx.bus.emit('game:mode', { mode: 'normal', energy: 80 });
  s.ctx.bus.emit('pet:idleTick', { quietMs: 90000 });
  assert.equal(s.out[2].text, 'rảnh');
  s.box.settings.chatter = false; s.advance(21 * 6e4);
  s.ctx.bus.emit('pet:idleTick', { quietMs: 90000 });
  assert.equal(s.out.length, 3);
});

test('reminder:done / snoozed lấy title và intent từ note', () => {
  const note = { id: 'n1', text: 'Họp với sếp\nphòng A', reminder: { due: 1, intent: 'meet', done: false } };
  const s = setup([L('d', 'done', 'xong {title}'), L('dl', 'done_late', 'trễ {title}'),
    L('sn', 'snooze', '{title} hoãn {left}'), L('dm', 'done', 'họp xong {title}', { cond: { intent: ['meet'] } })], { data: { notes: [note] } });
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: true }); s.flush();
  assert.equal(s.out[0].text, 'họp xong Họp với sếp'); assert.equal(s.out[0].priority, 30);
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: false }); s.flush();
  assert.equal(s.out[1].text, 'trễ Họp với sếp');
  s.ctx.bus.emit('reminder:snoozed', { noteId: 'n1', minutes: 10 }); s.flush();
  assert.equal(s.out[2].text, 'Họp với sếp hoãn 10 phút');
  s.ctx.bus.emit('reminder:done', { noteId: 'không-có', onTime: true }); s.flush(); // thiếu note: không văng lỗi
});

test('alarm:stopped / alarm:snoozed lấy label', () => {
  const s = setup([L('as', 'alarm_stop', 'tắt {label}'), L('az', 'alarm_snooze', '{label} thêm {left}')],
    { data: { notes: [], alarms: { list: [{ id: 'a1', label: 'Dậy' }] } } });
  s.ctx.bus.emit('alarm:stopped', { alarmId: 'a1' });
  s.ctx.bus.emit('alarm:snoozed', { alarmId: 'a1', minutes: 5 });
  assert.deepEqual(s.out.map(o => o.text), ['tắt Dậy', 'Dậy thêm 5 phút']);
  s.ctx.bus.emit('alarm:stopped', { alarmId: 'lạ' }); // không có label: câu bị bỏ
  assert.equal(s.out.length, 2);
});

test('alarm: label từ payload ưu tiên, rồi ctx.alarms.get', () => {
  const s = setup([L('as', 'alarm_stop', 'tắt {label}')], { data: { notes: [], alarms: { list: [{ id: 'a1', label: 'Cũ' }] } } });
  s.ctx.alarms = { get: id => (id === 'a2' ? { label: 'Từ get' } : null) };
  s.ctx.bus.emit('alarm:stopped', { alarmId: 'a1', label: 'Payload' });
  s.ctx.bus.emit('alarm:stopped', { alarmId: 'a2' });
  s.ctx.bus.emit('alarm:stopped', { alarmId: 'a1' });
  assert.deepEqual(s.out.map(o => o.text), ['tắt Payload', 'tắt Từ get', 'tắt Cũ']);
});

test('note_created: note trống không nói; updated có giờ mới thì nói; cùng giờ thì im', () => {
  const at = new Date(2026, 0, 5, 14, 5).getTime();
  const s = setup([L('c', 'note_created', '{title} lúc {time}')]);
  s.ctx.bus.emit('note:created', { note: { id: 'x', text: '' } });
  assert.equal(s.out.length, 0);
  s.ctx.bus.emit('note:updated', { note: { id: 'x', text: 'Nộp bài' } });
  assert.equal(s.out.length, 0);
  const n = { id: 'x', text: 'Nộp bài', reminder: { due: at, intent: 'due' } };
  s.ctx.bus.emit('note:updated', { note: n });
  assert.deepEqual(s.out.map(o => o.text), ['Nộp bài lúc 14:05']);
  assert.equal(s.out[0].priority, 20); assert.equal(s.out[0].ttlMs, 6000);
  s.advance(20000);
  s.ctx.bus.emit('note:updated', { note: n });
  assert.equal(s.out.length, 1);
  // đổi giờ: nói lại, nhưng không trong 15s
  const n2 = { id: 'x', text: 'Nộp bài', reminder: { due: at + 3600000 } };
  s.ctx.bus.emit('note:updated', { note: n2 });
  assert.equal(s.out.length, 2);
  s.ctx.bus.emit('note:updated', { note: { id: 'x', text: 'Nộp bài', reminder: { due: at + 7200000 } } });
  assert.equal(s.out.length, 2);
  // giờ quá khứ / đã done / đã xoá
  s.ctx.bus.emit('note:created', { note: { id: 'y', text: 'a', reminder: { due: 1000 } } });
  s.ctx.bus.emit('note:created', { note: { id: 'z', text: 'b', done: true, reminder: { due: at } } });
  assert.equal(s.out.length, 2);
  s.ctx.bus.emit('note:deleted', { id: 'x' });
  s.advance(20000);
  s.ctx.bus.emit('note:updated', { note: n2 });
  assert.equal(s.out.length, 3);
});

test('note_created: khởi tạo mốc từ store nên note cũ không nói lại', () => {
  const at = new Date(2026, 0, 5, 14, 5).getTime();
  const old = { id: 'o', text: 'Cũ', reminder: { due: at } };
  const s = setup([L('c', 'note_created', '{title} {time}')], { data: { notes: [old], alarms: { list: [] } } });
  s.ctx.bus.emit('note:updated', { note: old });
  assert.equal(s.out.length, 0);
});

test('reward, levelup', () => {
  const s = setup([L('r', 'reward', '{count} kẹo'), L('lv', 'levelup', 'cấp {level}')]);
  s.ctx.bus.emit('game:reward', { candy: 3 });
  s.ctx.bus.emit('game:levelup', { level: 4 });
  assert.deepEqual(s.out.map(o => o.text), ['3 kẹo', 'cấp 4']);
  assert.equal(s.ctx.persona.state().level, 4);
});

test('state: mode, overdue, weekday, hour', () => {
  const past = new Date(2026, 0, 5, 8, 0).getTime(), future = past + 864e5;
  const s = setup([], { data: { notes: [
    { id: '1', text: 'a', reminder: { due: past, done: false } },
    { id: '2', text: 'b', reminder: { due: past, done: true } },
    { id: '3', text: 'c', reminder: { due: future, done: false } },
    { id: '4', text: 'd', reminder: null }] } });
  s.ctx.bus.emit('game:mode', { mode: 'sad' });
  assert.deepEqual(s.ctx.persona.state(), { mode: 'sad', hour: 9, weekday: 1, overdue: 1 });
  s.ctx.bus.emit('game:mode', { mode: 'happy', level: 7 });
  assert.equal(s.ctx.persona.state().level, 7);
});

// ---- Đợt mới: chống trùng, nhiều nhắc, outfit, expired ----

test('done/snooze hoãn 400ms; pet:stageAction cùng noteId huỷ', () => {
  const note = { id: 'n1', text: 'Họp', reminder: { due: 1 } };
  const s = setup([L('d', 'done', 'xong {title}'), L('sn', 'snooze', '{title} hoãn {left}')], { data: { notes: [note] } });
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: true });
  assert.equal(s.out.length, 0);
  assert.equal(s.timers[0].ms, 400);
  s.flush();
  assert.deepEqual(s.out.map(o => o.text), ['xong Họp']);
  // core nói thay: huỷ
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: true });
  s.ctx.bus.emit('pet:stageAction', { noteId: 'n1', button: 'done', kind: 'due' });
  s.flush();
  assert.equal(s.out.length, 1);
  // noteId khác không huỷ
  s.ctx.bus.emit('reminder:snoozed', { noteId: 'n1', minutes: 5 });
  s.ctx.bus.emit('pet:stageAction', { noteId: 'khác', button: 'snooze', kind: 'due' });
  s.flush();
  assert.deepEqual(s.out.map(o => o.text), ['xong Họp', 'Họp hoãn 5 phút']);
});

test('reward im khi vừa có câu priority >= 30 hoặc đang hoãn done; levelup luôn nói', () => {
  const note = { id: 'n1', text: 'Họp', reminder: { due: 1 } };
  const s = setup([L('d', 'done', 'xong'), L('r', 'reward', '{count} kẹo'), L('lv', 'levelup', 'cấp {level}')], { data: { notes: [note] } });
  s.ctx.bus.emit('game:reward', { candy: 1 });
  assert.equal(s.out.length, 1);                                  // không có câu nào trước đó
  s.advance(6000);
  s.ctx.bus.emit('persona:line', { text: 'của game', priority: 30 });
  s.advance(4000);
  s.ctx.bus.emit('game:reward', { candy: 2 });
  assert.equal(s.out.length, 2);                                  // chỉ có câu của game + reward đầu (out gồm cả line giả)
  const before = s.out.length;
  s.advance(1500);                                                // > 5s kể từ câu giả
  s.ctx.bus.emit('game:reward', { candy: 3 });
  assert.equal(s.out.length, before + 1);
  // đang hoãn done
  s.advance(10000);
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: true });
  const b2 = s.out.length;
  s.ctx.bus.emit('game:reward', { candy: 4 });
  assert.equal(s.out.length, b2);
  s.flush();                                                      // câu done phát ra (priority 30)
  assert.equal(s.out[s.out.length - 1].text, 'xong');
  s.advance(1000);
  s.ctx.bus.emit('game:reward', { candy: 5 });
  assert.equal(s.out[s.out.length - 1].text, 'xong');             // vẫn trong 5s sau câu done
  s.ctx.bus.emit('game:levelup', { level: 9 });
  assert.equal(s.out[s.out.length - 1].text, 'cấp 9');
});

test('remindersOf: ưu tiên reminders, rồi reminder', () => {
  assert.deepEqual(P.remindersOf({ reminders: [{ id: 'a' }], reminder: { id: 'b' } }), [{ id: 'a' }]);
  assert.deepEqual(P.remindersOf({ reminder: { id: 'b' } }), [{ id: 'b' }]);
  assert.deepEqual(P.remindersOf({ reminders: [], reminder: { id: 'b' } }), []);
  assert.deepEqual(P.remindersOf({ reminder: null }), []);
  assert.deepEqual(P.remindersOf(null), []);
});

test('overdue đếm theo reminders: ít nhất một nhắc chưa done quá hạn, note chưa done', () => {
  const past = new Date(2026, 0, 5, 8, 0).getTime(), future = past + 864e5;
  const s = setup([], { data: { notes: [
    { id: '1', text: 'a', reminders: [{ id: 'r', due: past, done: true }, { id: 'r2', due: past, done: false }], reminder: null },
    { id: '2', text: 'b', reminders: [{ id: 'r', due: past, done: true }, { id: 'r2', due: future }] },
    { id: '3', text: 'c', done: true, reminders: [{ id: 'r', due: past }] },
    { id: '4', text: 'd', reminders: [{ id: 'r', due: past }, { id: 'r2', due: past }] },
    { id: '5', text: 'e', reminder: { due: past } }] } });
  assert.equal(s.ctx.persona.state().overdue, 3);
});

test('note_created nhiều nhắc: nói nhắc mới sớm nhất, title/intent của nhắc, source pet im', () => {
  const base = new Date(2026, 0, 5, 14, 0).getTime();
  const s = setup([L('c', 'note_created', '{title} lúc {time}'), L('ci', 'note_created', 'thuốc {title} {time}', { cond: { intent: ['pill'] } })]);
  const n = { id: 'x', text: 'Ghi chú', reminders: [
    { id: 'a', due: base + 3600000, intent: 'pill', title: 'Uống thuốc' },
    { id: 'b', due: base + 1800000 },
    { id: 'c', due: base + 60000, done: true }] };
  s.ctx.bus.emit('note:created', { note: n });
  assert.deepEqual(s.out.map(o => o.text), ['Ghi chú lúc 14:30']);       // b sớm nhất, không intent => câu chung
  s.advance(16000);
  // thêm nhắc mới intent pill sớm hơn
  const n2 = Object.assign({}, n, { reminders: n.reminders.concat([{ id: 'd', due: base + 900000, intent: 'pill', title: 'Thuốc huyết áp' }]) });
  s.ctx.bus.emit('note:updated', { note: n2 });
  assert.equal(s.out[1].text, 'thuốc Thuốc huyết áp 14:15');
  // cùng tập khoá: im
  s.advance(16000);
  s.ctx.bus.emit('note:updated', { note: n2 });
  assert.equal(s.out.length, 2);
  // source pet: im nhưng vẫn ghi nhận khoá
  s.advance(16000);
  const n3 = Object.assign({}, n2, { reminders: n2.reminders.concat([{ id: 'e', due: base + 7200000 }]) });
  s.ctx.bus.emit('note:updated', { note: n3, source: 'pet' });
  assert.equal(s.out.length, 2);
  s.ctx.bus.emit('note:updated', { note: n3 });
  assert.equal(s.out.length, 2);
  // chỉ đổi due của một nhắc => khoá mới => nói
  s.advance(16000);
  const n4 = Object.assign({}, n3, { reminders: n3.reminders.map(r => (r.id === 'e' ? Object.assign({}, r, { due: base + 9000000 }) : r)) });
  s.ctx.bus.emit('note:updated', { note: n4 });
  assert.equal(s.out.length, 3);
});

test('reminder:done/snoozed có reminderId lấy title/intent của nhắc đó', () => {
  const note = { id: 'n1', text: 'Chung', reminders: [{ id: 'a', due: 1, title: 'Uống thuốc', intent: 'pill' }, { id: 'b', due: 2 }] };
  const s = setup([L('d', 'done', 'xong {title}'), L('dp', 'done', 'thuốc {title}', { cond: { intent: ['pill'] } }),
    L('sn', 'snooze', '{title} hoãn {left}')], { data: { notes: [note] } });
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', reminderId: 'a', onTime: true }); s.flush();
  s.ctx.bus.emit('reminder:snoozed', { noteId: 'n1', reminderId: 'b', minutes: 5 }); s.flush();
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', reminderId: 'b', onTime: true }); s.flush();
  assert.deepEqual(s.out.map(o => o.text), ['thuốc Uống thuốc', 'Chung hoãn 5 phút', 'xong Chung']);
});

test('game:outfit: bỏ qua lần đầu, chỉ nói khi thêm/đổi, chống lặp 10s, item từ ctx.game', () => {
  const s = setup([L('o', 'outfit', 'đẹp quá {item}'), L('o2', 'outfit', 'đẹp quá')]);
  s.ctx.game = { itemName: id => ({ hat: 'Mũ', bow: 'Nơ' }[id]) };
  s.ctx.bus.emit('game:outfit', { worn: { head: 'hat' } });
  assert.equal(s.out.length, 0);
  s.ctx.bus.emit('game:outfit', { worn: { head: 'hat' } });       // y hệt
  assert.equal(s.out.length, 0);
  s.advance(1000);
  s.ctx.bus.emit('game:outfit', { worn: { head: 'hat', neck: 'bow' } });
  assert.equal(s.out.length, 1); assert.equal(s.out[0].priority, 20); assert.equal(s.out[0].ttlMs, 6000);
  s.ctx.bus.emit('game:outfit', { worn: { head: 'hat' } });       // chỉ tháo: im
  assert.equal(s.out.length, 1);
  s.ctx.bus.emit('game:outfit', { worn: { head: 'bow' } });       // đổi nhưng < 10s
  assert.equal(s.out.length, 1);
  s.advance(10001);
  s.ctx.bus.emit('game:outfit', { worn: { neck: 'bow', head: 'hat' } });
  assert.equal(s.out.length, 2);
  s.ctx.game = {};                                                // không có itemName: câu cần {item} bị loại, còn câu thường
  s.advance(10001);
  s.ctx.bus.emit('game:outfit', { worn: { head: 'hat', neck: 'bow', body: 'x' } });
  assert.equal(s.out[2].text, 'đẹp quá');
});

test('note:expired: pet tossesNotes thì im; không thì nói expired_<reason>, gộp 30s', () => {
  const note = { id: 'n1', text: 'Mua sữa' };
  const lines = [L('ed', 'expired_done', 'bỏ {title}'), L('eo', 'expired_overdue', 'quá hạn {title}'), L('ec', 'expired_checklist', 'xong hết')];
  const s = setup(lines, { data: { notes: [note] } });
  s.ctx.pet = { tossesNotes: true };
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'done' });
  assert.equal(s.out.length, 0);
  s.ctx.pet = { tossesNotes: false };
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'done' });
  assert.equal(s.out[0].text, 'bỏ Mua sữa'); assert.equal(s.out[0].priority, 15); assert.equal(s.out[0].ttlMs, 6000);
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'overdue' });
  assert.equal(s.out.length, 1);
  s.advance(30001);
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'overdue' });
  s.advance(30001);
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'checklist' });
  s.ctx.bus.emit('note:expired', { noteId: 'n1', reason: 'lạ' });
  assert.deepEqual(s.out.map(o => o.text), ['bỏ Mua sữa', 'quá hạn Mua sữa', 'xong hết']);
});
