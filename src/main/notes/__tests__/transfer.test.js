'use strict';
const assert = require('assert');
const T = require('../transferLogic.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
let seq = 0;
const newId = () => 'new' + (++seq);
const note = (o) => Object.assign({ id: 'a', html: '<div>xin chào</div>', color: 'yellow' }, o);

t('sanitize bỏ script kèm nội dung', () => {
  assert.strictEqual(T.sanitizeHtml('<div>a</div><script>alert(1)</script><div>b</div>'), '<div>a</div><div>b</div>');
});
t('sanitize bỏ on* và javascript:', () => {
  const o = T.sanitizeHtml('<div onclick="x()" style="color:red"><a href="javascript:alert(1)">link</a></div>');
  assert.strictEqual(o, '<div>link</div>');
});
t('sanitize bỏ iframe/object/embed', () => {
  const o = T.sanitizeHtml('<iframe src="x"></iframe><object data="y">o</object><embed src="z"><b>ok</b>');
  assert.strictEqual(o, '<b>ok</b>');
});
t('sanitize chỉ giữ img data:image', () => {
  assert.strictEqual(T.sanitizeHtml('<img src="data:image/png;base64,AAAA" onerror="x">'), '<img src="data:image/png;base64,AAAA">');
  assert.strictEqual(T.sanitizeHtml('<img src="http://x/y.png">'), '');
  assert.strictEqual(T.sanitizeHtml('<img src="javascript:alert(1)">'), '');
  assert.strictEqual(T.sanitizeHtml('<img src="data:image/svg+xml;base64,AAAA">'), '');
});
t('sanitize escape < lẻ và giữ nền highlight', () => {
  assert.strictEqual(T.sanitizeHtml('<div>1 < 2</div>'), '<div>1 &lt; 2</div>');
  assert.strictEqual(T.sanitizeHtml('<span style="background-color: #ff0; color:red">x</span>'), '<span style="background-color: #ff0">x</span>');
  assert.strictEqual(T.sanitizeHtml('<span style="background:url(javascript:1)">x</span>'), '<span>x</span>');
});
t('sanitize script không đóng và chú thích', () => {
  assert.strictEqual(T.sanitizeHtml('<b>a</b><!-- <script> -->c<script>evil'), '<b>a</b>c');
});
t('htmlToMarkdown định dạng + danh sách', () => {
  const md = T.htmlToMarkdown('<div><b>Đậm</b> và <i>nghiêng</i> <s>gạch</s> <u>dưới</u></div><ul><li>một</li><li>hai</li></ul><ol><li>x</li><li>y</li></ol>');
  assert.strictEqual(md, '**Đậm** và *nghiêng* ~~gạch~~ <u>dưới</u>\n- một\n- hai\n1. x\n2. y');
});
t('htmlToMarkdown br/div, ảnh, entity', () => {
  assert.strictEqual(T.htmlToMarkdown('<div>a<br>b</div><div>c &amp; d</div><div><img src="data:image/png;base64,AA"></div>'), 'a\nb\nc & d\n[ảnh]');
});
t('markdownToHtml dòng, danh sách, đậm', () => {
  assert.strictEqual(T.markdownToHtml('Chào **bạn**\n- một\n- hai\n\nhết'), '<div>Chào <b>bạn</b></div><ul><li>một</li><li>hai</li></ul><div><br></div><div>hết</div>');
});
t('markdownToHtml escape HTML trong md', () => {
  const h = T.markdownToHtml('<script>alert(1)</script> & **x**');
  assert.ok(!/<script/i.test(h));
  assert.ok(h.includes('&amp;') && h.includes('<b>x</b>'));
});
t('markdownToHtml tiêu đề và danh sách số', () => {
  assert.strictEqual(T.markdownToHtml('## Tiêu đề\n1. a\n2. b'), '<div><b>Tiêu đề</b></div><ol><li>a</li><li>b</li></ol>');
});
t('md vòng tròn giữ nội dung chữ', () => {
  const html = '<div><b>Việc</b></div><ul><li>mua sữa</li><li>gọi mẹ</li></ul>';
  const back = T.markdownToHtml(T.htmlToMarkdown(html));
  assert.strictEqual(back, html);
});
t('sanitizeNote chuẩn hoá mặc định', () => {
  const s = T.sanitizeNote({ id: 'x', html: '<div onclick=1>hi</div>', color: 'lạ', bounds: { x: 'a' } });
  assert.strictEqual(s.html, '<div>hi</div>');
  assert.strictEqual(s.text, 'hi');
  assert.strictEqual(s.color, 'yellow');
  assert.deepStrictEqual(s.bounds, { x: 80, y: 80, width: 300, height: 320 });
  assert.strictEqual(s.visible, true);
  assert.strictEqual(s.reminder, null);
});
t('sanitizeNote từ chối thiếu id/không phải object', () => {
  assert.strictEqual(T.sanitizeNote(null), null);
  assert.strictEqual(T.sanitizeNote({ html: 'x' }), null);
  assert.strictEqual(T.sanitizeNote({ id: '' }), null);
  assert.strictEqual(T.sanitizeNote('x'), null);
});
t('sanitizeNote hạn nhắc đã qua -> fired khi nhập', () => {
  const r = T.sanitizeNote({ id: 'x', reminder: { due: 1000 } }, { now: 5000 }).reminder;
  assert.strictEqual(r.fired, true);
  const r2 = T.sanitizeNote({ id: 'x', reminder: { due: 9000 } }, { now: 5000 }).reminder;
  assert.strictEqual(r2.fired, false);
});
t('mergeImported: id mới thì thêm', () => {
  const m = T.mergeImported([], [note()], newId);
  assert.strictEqual(m.added.length, 1);
  assert.strictEqual(m.added[0].id, 'a');
});
t('mergeImported: trùng id, giống nội dung -> bỏ qua', () => {
  const cur = [T.sanitizeNote(note())];
  const m = T.mergeImported(cur, [note({ updatedAt: 5 })], newId);
  assert.strictEqual(m.added.length, 0);
  assert.strictEqual(m.skipped, 1);
});
t('mergeImported: trùng id, khác nội dung -> bản sao id mới', () => {
  const cur = [T.sanitizeNote(note())];
  const m = T.mergeImported(cur, [note({ html: '<div>khác</div>' })], newId);
  assert.strictEqual(m.added.length, 1);
  assert.notStrictEqual(m.added[0].id, 'a');
  assert.strictEqual(m.added[0].html, '<div>khác</div>');
});
t('mergeImported: trùng ngay trong file nhập và mục hỏng', () => {
  const m = T.mergeImported([], [note(), note(), { x: 1 }], newId);
  assert.strictEqual(m.added.length, 1);
  assert.strictEqual(m.skipped, 1);
  assert.strictEqual(m.invalid, 1);
});
t('parseImportJson: export, mochi-data, mảng, lỗi', () => {
  const ex = T.parseImportJson(JSON.stringify({ app: 'mochi-notes', notes: [note()], alarms: { list: [{ id: 'al' }], memos: [{ id: 'm' }] } }));
  assert.strictEqual(ex.notes.length, 1); assert.strictEqual(ex.alarms.length, 1); assert.strictEqual(ex.memos.length, 1);
  const md = T.parseImportJson('﻿' + JSON.stringify({ version: 2, notes: [note()], settings: {}, alarms: { version: 1, list: [], memos: [] } }));
  assert.strictEqual(md.notes.length, 1);
  assert.strictEqual(T.parseImportJson('[{"id":"q"}]').notes.length, 1);
  assert.throws(() => T.parseImportJson('{"foo":1}'));
  assert.throws(() => T.parseImportJson('khong phai json'));
});
t('mergeAlarmBox: thêm cái chưa có, tắt báo thức một lần đã qua', () => {
  const B = require('../../alarms/box.js');
  const box = { list: [B.normAlarm({ id: 'old', time: '07:00', repeat: { freq: 'daily' } })], memos: [] };
  const inc = { alarms: [
    { id: 'old', time: '09:00' },
    { id: 'past', time: '08:00', date: '2020-01-01', enabled: true, nextAt: 123 },
    { id: 'daily', time: '08:00', repeat: { freq: 'daily' }, snoozedUntil: 5 }
  ], memos: [{ id: 'm1', text: 'uống thuốc', when: 'morning' }, { id: 'bad' }] };
  const res = T.mergeAlarmBox(box, inc, { normAlarm: B.normAlarm, normMemo: B.normMemo, computeNext: (a, now) => (a.date ? null : now + 1000) }, Date.now());
  assert.strictEqual(res.alarms.length, 2);
  assert.strictEqual(box.list.find(a => a.id === 'old').time, '07:00');
  assert.strictEqual(box.list.find(a => a.id === 'past').enabled, false);
  const d = box.list.find(a => a.id === 'daily');
  assert.ok(d.nextAt > 0 && d.snoozedUntil === undefined);
  assert.strictEqual(box.memos.length, 1);
});
t('xuất txt có dấu ngăn và hạn nhắc', () => {
  const a = T.sanitizeNote(note({ id: '1', html: '<div>Họp</div><div>2h</div>', reminder: { due: new Date(2026, 9, 15, 14, 30).getTime() } }));
  const b = T.sanitizeNote(note({ id: '2', html: '<div>Mua sữa</div>' }));
  const out = T.notesToText([a, b], 'txt');
  assert.ok(out.includes('\n\n-----\n\n'));
  assert.ok(out.includes('[Nhắc lúc 15/10/2026 14:30]'));
  assert.ok(out.includes('Mua sữa'));
});
t('xuất md có tiêu đề ## và định dạng', () => {
  const a = T.sanitizeNote(note({ id: '1', html: '<div><b>Việc</b></div><ul><li>x</li></ul>' }));
  const out = T.notesToText([a], 'md');
  assert.ok(out.startsWith('## Việc\n\n**Việc**\n- x'));
});
t('buildExportJson đúng khung', () => {
  const j = T.buildExportJson([1], { list: [2], memos: [3], missed: [9] }, 0);
  assert.deepStrictEqual([j.app, j.kind, j.version], ['mochi-notes', 'export', 2]);
  assert.deepStrictEqual(j.alarms, { list: [2], memos: [3] });
  assert.strictEqual(j.exportedAt, '1970-01-01T00:00:00.000Z');
});
t('isBackupName chống path traversal', () => {
  assert.ok(T.isBackupName('mochi-data-2026-10-15.json'));
  assert.ok(T.isBackupName('mochi-data-before-restore-2026-10-15-101530.json'));
  assert.ok(!T.isBackupName('../mochi-data-2026-10-15.json'));
  assert.ok(!T.isBackupName('mochi-data-..\\x.json'));
  assert.ok(!T.isBackupName('mochi-data-a/b.json'));
  assert.ok(!T.isBackupName('mochi-data.json'));
  assert.ok(!T.isBackupName(null));
});
t('tên bản trước-khôi-phục không khớp luật xoay vòng của store', () => {
  const rot = /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/;
  assert.ok(!rot.test('mochi-data-before-restore-' + T.stampStr(new Date()) + '.json'));
});
t('summarizeBackup: exists/same', () => {
  const cur = [T.sanitizeNote(note({ id: 'a' })), T.sanitizeNote(note({ id: 'b', html: '<div>cũ</div>' }))];
  const s = T.summarizeBackup([note({ id: 'a' }), note({ id: 'b', html: '<div>mới</div>' }), note({ id: 'c' })], cur);
  assert.deepStrictEqual(s.map(x => [x.id, x.exists, x.same]), [['a', true, true], ['b', true, false], ['c', false, false]]);
  assert.strictEqual(s[0].title, 'xin chào');
});
t('planRestore: thêm lại, ghi đè, lọc theo ids', () => {
  const cur = [T.sanitizeNote(note({ id: 'b', html: '<div>sau</div>' }))];
  const bk = [note({ id: 'b', html: '<div>trước</div>', color: 'pink' }), note({ id: 'c' })];
  const all = T.planRestore(bk, cur, null);
  assert.strictEqual(all.add.length, 1); assert.strictEqual(all.add[0].id, 'c');
  assert.strictEqual(all.overwrite[0].patch.html, '<div>trước</div>');
  assert.strictEqual(all.overwrite[0].patch.color, 'pink');
  const some = T.planRestore(bk, cur, ['c']);
  assert.strictEqual(some.add.length, 1); assert.strictEqual(some.overwrite.length, 0);
});

console.log('\n' + n + ' ca đạt');
