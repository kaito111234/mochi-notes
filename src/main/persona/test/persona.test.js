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
  const persona = P.createPersona(ctx, { file, now: () => t });
  const out = [];
  ctx.bus.on('persona:line', l => out.push(l));
  return { ctx, persona, out, box: sections.persona, saves: () => saves, advance: ms => { t += ms; }, setTime: x => { t = x; } };
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

test('pet:interact map kind, chống spam 4s', () => {
  const s = setup([L('h', 'pat_head', 'hihi'), L('f', 'feed', 'ngon {item}')]);
  s.ctx.bus.emit('pet:interact', { kind: 'pat-head' });
  s.ctx.bus.emit('pet:interact', { kind: 'pat-head' });
  assert.equal(s.out.length, 1);
  assert.equal(s.out[0].priority, 20); assert.equal(s.out[0].ttlMs, 6000);
  s.advance(4001);
  s.ctx.bus.emit('pet:interact', { kind: 'pat-head' });
  s.ctx.bus.emit('pet:interact', { kind: 'feed', itemId: 'kẹo' });
  assert.equal(s.out.length, 3); assert.equal(s.out[2].text, 'ngon kẹo');
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
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: true });
  assert.equal(s.out[0].text, 'họp xong Họp với sếp'); assert.equal(s.out[0].priority, 30);
  s.ctx.bus.emit('reminder:done', { noteId: 'n1', onTime: false });
  assert.equal(s.out[1].text, 'trễ Họp với sếp');
  s.ctx.bus.emit('reminder:snoozed', { noteId: 'n1', minutes: 10 });
  assert.equal(s.out[2].text, 'Họp với sếp hoãn 10 phút');
  s.ctx.bus.emit('reminder:done', { noteId: 'không-có', onTime: true }); // thiếu note: không văng lỗi
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

test('feed ưu tiên itemName', () => {
  const s = setup([L('f', 'feed', 'ngon {item}')]);
  s.ctx.bus.emit('pet:interact', { kind: 'feed', itemId: 'candy', itemName: 'Kẹo' });
  assert.equal(s.out[0].text, 'ngon Kẹo');
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
});
