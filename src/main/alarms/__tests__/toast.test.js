'use strict';
const assert = require('assert');
const T = require('../toast.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const attr = (xml, name) => { const m = new RegExp(name + '="([^"]*)"').exec(xml); return m ? m[1] : null; };
// kiểm tra XML cân bằng thẻ và thuộc tính đóng ngoặc (không cần parser ngoài)
function wellFormed(xml) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z]+="[^"<]*")*)\s*(\/?)>|([^<]+)/g;
  let m, pos = 0;
  while ((m = re.exec(xml))) {
    if (m.index !== pos) return false;
    pos = re.lastIndex;
    if (m[5] !== undefined) { if (/[<>]|&(?!(amp|lt|gt|quot|apos);)/.test(m[5])) return false; continue; }
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else if (!m[4]) stack.push(m[2]);
  }
  return pos === xml.length && stack.length === 0;
}

t('escXml', () => assert.strictEqual(T.escXml('a<b>&"c\'d'), 'a&lt;b&gt;&amp;&quot;c&apos;d'));
t('escXml bỏ ký tự điều khiển', () => assert.strictEqual(T.escXml('a\u0001b\u0000c'), 'abc'));
t('escXml null', () => assert.strictEqual(T.escXml(null), ''));
t('toastUrl cơ bản', () => assert.strictEqual(T.toastUrl('alarm', 'stop', 'a_1'), 'mochi-notes://alarm/stop?id=a_1'));
t('toastUrl có r và m', () => assert.strictEqual(T.toastUrl('note', 'snooze', 'n1', { r: 'r2', m: 10 }), 'mochi-notes://note/snooze?id=n1&r=r2&m=10'));
t('toastUrl mã hoá id lạ', () => {
  const u = T.toastUrl('alarm', 'stop', 'test:a b&c');
  assert.strictEqual(T.parseToastUrl(u).id, 'test:a b&c');
});
t('round-trip alarm', () => assert.deepStrictEqual(T.parseToastUrl(T.toastUrl('alarm', 'snooze', 'a_9', { m: 5 })), { kind: 'alarm', action: 'snooze', id: 'a_9', m: 5 }));
t('round-trip note', () => assert.deepStrictEqual(T.parseToastUrl(T.toastUrl('note', 'done', 'n_1', { r: 'r3' })), { kind: 'note', action: 'done', id: 'n_1', r: 'r3' }));
t('round-trip memo', () => assert.deepStrictEqual(T.parseToastUrl(T.toastUrl('memo', 'open', 'm_1')), { kind: 'memo', action: 'open', id: 'm_1' }));
t('parse chịu dấu / cuối do Windows thêm', () => assert.deepStrictEqual(T.parseToastUrl('mochi-notes://alarm/stop/?id=a1'), { kind: 'alarm', action: 'stop', id: 'a1' }));
t('parse không phân biệt hoa thường scheme', () => assert.strictEqual(T.parseToastUrl('MOCHI-NOTES://Alarm/Stop?id=a1').action, 'stop'));
t('parse xấu -> null', () => {
  for (const bad of [null, undefined, 42, '', 'http://alarm/stop?id=1', 'mochi-notes://', 'mochi-notes://alarm', 'mochi-notes://alarm/stop',
    'mochi-notes://alarm/stop?id=', 'mochi-notes://evil/stop?id=1', 'mochi-notes://alarm/format?id=1', 'mochi-notes://alarm/stop?id=%E0%A4%A']) {
    assert.strictEqual(T.parseToastUrl(bad), null, String(bad));
  }
});
t('parse m ngoài khoảng bị bỏ', () => {
  assert.strictEqual(T.parseToastUrl('mochi-notes://alarm/snooze?id=a&m=0').m, undefined);
  assert.strictEqual(T.parseToastUrl('mochi-notes://alarm/snooze?id=a&m=abc').m, undefined);
  assert.strictEqual(T.parseToastUrl('mochi-notes://alarm/snooze?id=a&m=99999').m, undefined);
});
t('parse lấy tham số đầu khi trùng', () => assert.strictEqual(T.parseToastUrl('mochi-notes://alarm/stop?id=a&id=b').id, 'a'));
t('xml báo thức: scenario, audio silent, nút', () => {
  const x = T.buildToastXml({ kind: 'alarm', refId: 'a_1', title: 'Báo thức 06:30', body: 'Dậy đi', extra: { m: 10 },
    buttons: [{ id: 'stop', label: 'Tắt' }, { id: 'snooze', label: 'Hoãn 10 phút', m: 10 }] });
  assert.ok(wellFormed(x), x);
  assert.strictEqual(attr(x, 'scenario'), 'alarm');
  assert.ok(x.includes('<audio silent="true"/>'));
  assert.ok(x.includes('activationType="protocol"'));
  assert.ok(x.includes('content="Tắt"') && x.includes('arguments="mochi-notes://alarm/stop?id=a_1&amp;m=10"'));
  assert.ok(x.includes('<text>Báo thức 06:30</text>'));
});
t('xml note: scenario reminder, không audio', () => {
  const x = T.buildToastXml({ kind: 'note', refId: 'n1', title: 'Họp', body: '9:00', extra: { r: 'r1' },
    buttons: [{ id: 'done', label: 'Xong' }, { id: 'snooze', label: 'Hoãn 10 phút', m: 10 }] });
  assert.ok(wellFormed(x), x);
  assert.strictEqual(attr(x, 'scenario'), 'reminder');
  assert.ok(!x.includes('<audio'));
  assert.ok(x.includes('mochi-notes://note/snooze?id=n1&amp;r=r1&amp;m=10'));
});
t('xml memo: không scenario', () => {
  const x = T.buildToastXml({ kind: 'memo', refId: 'm1', title: 'Dặn dò', buttons: [{ id: 'done', label: 'Nhớ rồi' }] });
  assert.ok(wellFormed(x));
  assert.strictEqual(attr(x, 'scenario'), null);
});
t('xml escape tiêu đề/nội dung độc hại', () => {
  const x = T.buildToastXml({ kind: 'note', refId: 'n"><x/>', title: '<script>&"\'', body: 'a</text><b>',
    buttons: [{ id: 'done', label: '"><evil/>' }] });
  assert.ok(wellFormed(x), x);
  assert.ok(!x.includes('<script>') && !x.includes('<evil') && !x.includes('<b>'));
});
t('xml: nút id lạ bị bỏ', () => {
  const x = T.buildToastXml({ kind: 'note', refId: 'n', title: 't', buttons: [{ id: 'rm -rf', label: 'x' }, { id: 'done', label: 'Xong' }] });
  assert.strictEqual((x.match(/<action /g) || []).length, 1);
});
t('xml không nút: không có <actions>', () => assert.ok(!T.buildToastXml({ kind: 'note', refId: 'n', title: 't' }).includes('<actions>')));
t('xml kind lạ -> note', () => assert.strictEqual(attr(T.buildToastXml({ kind: 'zzz', refId: 'n', title: 't' }), 'scenario'), 'reminder'));
t('xml thiếu tham số không ném lỗi', () => assert.ok(wellFormed(T.buildToastXml())));
t('xml tiếng Việt giữ nguyên', () => assert.ok(T.buildToastXml({ kind: 'note', refId: 'n', title: 'Ăn trưa nhé' }).includes('Ăn trưa nhé')));
t('xml launch là url open hợp lệ', () => {
  const x = T.buildToastXml({ kind: 'alarm', refId: 'a1', title: 't', extra: { m: 5 } });
  const launch = attr(x, 'launch').replace(/&amp;/g, '&');
  assert.deepStrictEqual(T.parseToastUrl(launch), { kind: 'alarm', action: 'open', id: 'a1', m: 5 });
});
t('findUrl', () => {
  assert.strictEqual(T.findUrl(['a.exe', '.', 'mochi-notes://alarm/stop?id=1']), 'mochi-notes://alarm/stop?id=1');
  assert.strictEqual(T.findUrl(['a.exe']), null);
  assert.strictEqual(T.findUrl(null), null);
});
console.log(n + ' ca toast xanh');
