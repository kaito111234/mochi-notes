'use strict';
const assert = require('assert');
const L = require('../insightLogic.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const at = (h, m, dayOff = 0) => { const d = new Date(2026, 5, 10, h, m, 0, 0); d.setDate(d.getDate() + dayOff); return d.getTime(); };
const NOW = at(8, 0);
const item = (o) => Object.assign({ key: 'k:x', line: 0, raw: 'x', title: 'X', due: at(9, 0), timed: true, time: '09:00', repeat: null, intent: 'task', lead: 0, priority: 0 }, o);

// ---- escape / html
t('escapeHtml 5 ký tự', () => assert.strictEqual(L.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));
t('escapeHtml null -> rỗng', () => assert.strictEqual(L.escapeHtml(null), ''));
t('textToHtml mỗi dòng một div', () => assert.strictEqual(L.textToHtml('a\nb'), '<div>a</div><div>b</div>'));
t('textToHtml dòng trống -> <br>', () => assert.strictEqual(L.textToHtml('a\n\nb'), '<div>a</div><div><br></div><div>b</div>'));
t('textToHtml escape script', () => assert.ok(!/<script/.test(L.textToHtml('<script>alert(1)</script>'))));
t('textToHtml CRLF', () => assert.strictEqual(L.textToHtml('a\r\nb'), '<div>a</div><div>b</div>'));

// ---- số điện thoại / link / email
t('phoneDigits bỏ khoảng trắng', () => assert.strictEqual(L.phoneDigits('0901 234 567'), '0901234567'));
t('phoneDigits +84 -> 0', () => assert.strictEqual(L.phoneDigits('+84 901 234 567'), '0901234567'));
t('phoneDigits 84 trần', () => assert.strictEqual(L.phoneDigits('84901234567'), '0901234567'));
t('phoneDigits dấu chấm/gạch', () => assert.strictEqual(L.phoneDigits('0901.234-567'), '0901234567'));
t('phoneDigits quá ngắn -> rỗng', () => assert.strictEqual(L.phoneDigits('12'), ''));
t('safeUrl https giữ nguyên', () => assert.strictEqual(L.safeUrl('https://a.vn/x?y=1'), 'https://a.vn/x?y=1'));
t('safeUrl www thêm https', () => assert.strictEqual(L.safeUrl('www.a.vn'), 'https://www.a.vn'));
t('safeUrl domain/đường dẫn thêm https', () => assert.strictEqual(L.safeUrl('a.vn/abc'), 'https://a.vn/abc'));
t('safeUrl chặn javascript:/file:/data:', () => {
  for (const u of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'mailto:a@b.c', 'ftp://x.y']) assert.strictEqual(L.safeUrl(u), null, u);
});
t('safeUrl chặn khoảng trắng/ký tự lạ', () => { assert.strictEqual(L.safeUrl('http://a.vn/ x'), null); assert.strictEqual(L.safeUrl('http://a.vn/"x'), null); });
t('safeEmail hợp lệ / sai', () => { assert.strictEqual(L.safeEmail('a@b.vn'), 'a@b.vn'); assert.strictEqual(L.safeEmail('a b@c.vn'), null); assert.strictEqual(L.safeEmail('abc'), null); });
t('idTail', () => { assert.strictEqual(L.idTail('call:0901'), '0901'); assert.strictEqual(L.idTail('link:https://a.b:80/x'), 'https://a.b:80/x'); assert.strictEqual(L.idTail('split'), ''); });

// ---- lọc gợi ý
const A = item({ key: 'k:hop', title: 'Họp', due: at(9, 0) });
const B = item({ key: 'k:goi', title: 'Gọi khách', due: at(14, 0), line: 1, time: '14:00' });
const ins2 = { items: [A, B], suggestions: [
  { id: 'remind:k:hop', kind: 'remind', itemKey: 'k:hop' }, { id: 'remind:k:goi', kind: 'remind', itemKey: 'k:goi' },
  { id: 'remind-all', kind: 'remind-all' }, { id: 'split', kind: 'split' }, { id: 'call:0901234567', kind: 'call' }] };
const ids = r => L.filterSuggestions(ins2, r, NOW).map(s => s.id);
t('lọc: không có nhắc -> giữ hết', () => assert.strictEqual(ids([]).length, 5));
t('lọc: bỏ remind đã có nhắc cùng key', () => { const x = ids([{ key: 'k:hop', due: A.due }]); assert.ok(!x.includes('remind:k:hop')); assert.ok(x.includes('remind:k:goi')); assert.ok(x.includes('remind-all')); });
t('lọc: bỏ remind-all khi mọi item có nhắc', () => { const x = ids([{ key: 'k:hop' }, { key: 'k:goi' }]); assert.ok(!x.includes('remind-all')); assert.ok(x.includes('split')); });
t('lọc: nhắc tay cùng giờ (không key) cũng phủ', () => assert.ok(!ids([{ due: A.due, done: false }]).includes('remind:k:hop')));
t('lọc: nhắc tay đã xong cùng giờ không phủ', () => assert.ok(ids([{ due: A.due, done: true }]).includes('remind:k:hop')));
t('lọc: item quá giờ không tính là thiếu -> bỏ remind-all', () => {
  const past = { items: [item({ key: 'k:a', due: at(7, 0) }), item({ key: 'k:b', due: at(7, 30) })], suggestions: [{ id: 'remind-all', kind: 'remind-all' }] };
  assert.strictEqual(L.filterSuggestions(past, [], NOW).length, 0);
});
t('lọc: insight rỗng/null không ném', () => { assert.deepStrictEqual(L.filterSuggestions(null, [], NOW), []); assert.deepStrictEqual(L.filterSuggestions({}, null, NOW), []); });
t('buildView gắn noteId + reminders + lọc', () => {
  const v = L.buildView(ins2, { id: 'n1', reminders: [{ key: 'k:hop', due: A.due }] }, NOW);
  assert.strictEqual(v.noteId, 'n1'); assert.strictEqual(v.reminders.length, 1); assert.ok(!v.suggestions.some(s => s.id === 'remind:k:hop'));
});
t('buildView note 0.1 (chỉ reminder)', () => assert.strictEqual(L.buildView(ins2, { id: 'n1', reminder: { due: 1 } }, NOW).reminders.length, 1));
t('buildView không có note', () => { const v = L.buildView(ins2, null, NOW); assert.strictEqual(v.noteId, undefined); assert.deepStrictEqual(v.reminders, []); });
t('missingItems', () => assert.deepStrictEqual(L.missingItems(ins2, [{ key: 'k:hop' }], NOW).map(i => i.key), ['k:goi']));

// ---- reply
t('reply 0 nhắc', () => assert.strictEqual(L.buildReply('Mua sữa', [], NOW), 'Tớ ghi rồi nha: Mua sữa'));
t('reply 0 nhắc, tiêu đề rỗng', () => assert.strictEqual(L.buildReply('', [], NOW), 'Tớ ghi rồi nha'));
t('reply 1 nhắc hôm nay', () => assert.strictEqual(L.buildReply('Họp', [{ title: 'Họp', due: at(15, 0) }], NOW), 'Tớ ghi rồi nha. 15:00 tớ nhắc cậu họp'));
t('reply 1 nhắc ngày mai', () => assert.strictEqual(L.buildReply('Họp', [{ title: 'Họp', due: at(9, 0, 1) }], NOW), 'Tớ ghi rồi nha. 09:00 mai tớ nhắc cậu họp'));
t('reply 1 nhắc ngày xa', () => assert.strictEqual(L.buildReply('Họp', [{ title: 'Họp', due: at(9, 0, 5) }], NOW), 'Tớ ghi rồi nha. 09:00 15/06 tớ nhắc cậu họp'));
t('reply nhiều nhắc', () => assert.strictEqual(L.buildReply('x', [{ title: 'Họp', due: at(9, 0) }, { title: 'Gọi khách', due: at(14, 0) }, { title: 'Đi tập', due: at(18, 0) }], NOW), 'Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách, 18:00 đi tập'));
t('reply ≤ 120 ký tự và có …', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ title: 'Công việc số ' + (i + 1), due: at(9 + (i % 12), 0) }));
  const r = L.buildReply('x', many, NOW);
  assert.ok(r.length <= 120, r.length); assert.ok(r.endsWith('…'));
});
t('reply title note dùng khi nhắc không có title', () => assert.strictEqual(L.buildReply('Đi chợ', [{ due: at(17, 0) }], NOW), 'Tớ ghi rồi nha. 17:00 tớ nhắc cậu đi chợ'));
t('reply tiêu đề dài bị cắt ≤ 120', () => assert.ok(L.buildReply('a'.repeat(300), [], NOW).length <= 120));

// ---- checklist
t('checklist: dòng thường -> "- [ ]"', () => assert.strictEqual(L.checklistText('sữa\ntrứng').text, '- [ ] sữa\n- [ ] trứng'));
t('checklist: bỏ bullet cũ', () => assert.strictEqual(L.checklistText('- sữa\n* trứng\n1. bánh\n• rau').text, '- [ ] sữa\n- [ ] trứng\n- [ ] bánh\n- [ ] rau'));
t('checklist: giữ ô tích đã có', () => assert.strictEqual(L.checklistText('[x] a\n[ ] b').text, '- [x] a\n- [ ] b'));
t('checklist: tiêu đề kết thúc ":" được giữ', () => assert.strictEqual(L.checklistText('Đi chợ:\nsữa\ntrứng').text, 'Đi chợ:\n- [ ] sữa\n- [ ] trứng'));
t('checklist: tiêu đề + toàn bullet được giữ', () => assert.strictEqual(L.checklistText('Mua đồ\n- sữa\n- trứng').text, 'Mua đồ\n- [ ] sữa\n- [ ] trứng'));
t('checklist: đã là checklist -> changed=false', () => assert.strictEqual(L.checklistText('- [ ] a\n- [x] b').changed, false));
t('checklist: giữ dòng trống, đếm đúng', () => { const r = L.checklistText('a\n\nb'); assert.strictEqual(r.text, '- [ ] a\n\n- [ ] b'); assert.strictEqual(r.count, 2); });
t('checklistHtml escape + div', () => assert.strictEqual(L.checklistHtml('a<b\nc').html, '<div>- [ ] a&lt;b</div><div>- [ ] c</div>'));
t('stripMarker', () => { assert.strictEqual(L.stripMarker('☐ gọi mẹ'), 'gọi mẹ'); assert.strictEqual(L.stripMarker('- [x] xong'), 'xong'); assert.strictEqual(L.stripMarker('2) việc'), 'việc'); });

// ---- split
t('split: tách item thứ 2 và 3, bỏ khỏi note gốc', () => {
  const text = '9h họp\n14h gọi khách\n18h đi tập\nghi chú';
  const ins = { items: [A, B, item({ key: 'k:tap', title: 'Đi tập', line: 2 })] };
  const p = L.splitPlan(text, ins);
  assert.strictEqual(p.keepText, '9h họp\nghi chú');
  assert.deepStrictEqual(p.parts.map(x => x.text), ['14h gọi khách', '18h đi tập']);
});
t('split: bỏ ký hiệu đầu dòng ở note mới', () => assert.strictEqual(L.splitPlan('- 9h họp\n- 14h gọi', { items: [A, B] }).parts[0].text, '14h gọi'));
t('split: 1 item -> null', () => assert.strictEqual(L.splitPlan('9h họp', { items: [A] }), null));
t('split: nhiều item cùng một dòng -> null', () => assert.strictEqual(L.splitPlan('9h họp 14h gọi', { items: [A, item({ key: 'k:2', line: 0 })] }), null));
t('split: sắp theo dòng dù items lộn xộn', () => {
  const p = L.splitPlan('a\nb\nc', { items: [item({ key: 'k:c', line: 2, title: 'C' }), item({ key: 'k:a', line: 0 }), item({ key: 'k:b', line: 1, title: 'B' })] });
  assert.strictEqual(p.keepText, 'a'); assert.deepStrictEqual(p.parts.map(x => x.text), ['b', 'c']);
});

// ---- tham số lệnh
t('alarmParams một lần: date là ngày tới', () => { const p = L.alarmParams(item({ title: 'Dậy', time: '06:00', due: at(6, 0, 1) }), 'n1', NOW); assert.strictEqual(p.time, '06:00'); assert.strictEqual(p.date, '2026-06-11'); assert.strictEqual(p.noteId, 'n1'); assert.strictEqual(p.label, 'Dậy'); });
t('alarmParams có repeat thì không date', () => { const p = L.alarmParams(item({ time: '06:00', repeat: { freq: 'daily' } }), 'n1', NOW); assert.ok(p.repeat && !p.date); });
t('alarmParams thiếu giờ -> null', () => assert.strictEqual(L.alarmParams(item({ time: null, due: null }), 'n1', NOW), null));
t('reminderParams', () => { const r = L.reminderParams(item({ key: 'k:a', title: 'A', lead: 5 })); assert.strictEqual(r.auto, true); assert.strictEqual(r.key, 'k:a'); assert.strictEqual(r.lead, 5); assert.strictEqual(L.reminderParams(item({ due: null })), null); });

console.log('\n' + n + ' ca đạt');
