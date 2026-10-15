'use strict';
const assert = require('assert');
const L = require('../paperLogic.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name + ': ' + e.message); process.exit(1); } };

t('defaults', () => { const d = L.defaults(); assert.strictEqual(d.v, 1); assert.deepStrictEqual(d.noteMeta, {}); assert.strictEqual(d.settings.defaultPaper, null); });
t('normalize null throws', () => assert.throws(() => L.normalize(null)));
t('normalize array throws', () => assert.throws(() => L.normalize([])));
t('normalize string throws', () => assert.throws(() => L.normalize('x')));
t('normalize empty obj', () => assert.deepStrictEqual(L.normalize({}), L.defaults()));
t('normalize keeps valid', () => {
  const r = L.normalize({ settings: { defaultPaper: 'cute-cat', tilt: true }, noteMeta: { a1: { paper: 'x-1', font: 'itim', shape: 'tall', tilt: false, deco: true } } });
  assert.strictEqual(r.settings.defaultPaper, 'cute-cat'); assert.strictEqual(r.settings.tilt, true);
  assert.deepStrictEqual(r.noteMeta.a1, { paper: 'x-1', font: 'itim', shape: 'tall', tilt: false, deco: true });
});
t('normalize drops bad values and unknown keys', () => {
  const r = L.normalize({ noteMeta: { a: { paper: 'BAD ID', font: 5, shape: 'round', tilt: 'yes', evil: 1 }, b: { paper: 'ok' } } });
  assert.ok(!('a' in r.noteMeta)); assert.deepStrictEqual(r.noteMeta.b, { paper: 'ok' });
});
t('normalize dangerous keys', () => {
  const r = L.normalize(JSON.parse('{"noteMeta":{"__proto__":{"paper":"x"},"constructor":{"paper":"x"},"prototype":{"paper":"x"},"ok":{"paper":"y"}}}'));
  assert.deepStrictEqual(Object.keys(r.noteMeta), ['ok']); assert.strictEqual({}.paper, undefined);
});
t('normalize long id rejected', () => assert.strictEqual(L.cleanId('a'.repeat(41)), null));
t('cleanId 40 ok', () => assert.strictEqual(L.cleanId('a'.repeat(40)), 'a'.repeat(40)));
t('cleanId rejects uppercase/space/non-string', () => { assert.strictEqual(L.cleanId('Ab'), null); assert.strictEqual(L.cleanId('a b'), null); assert.strictEqual(L.cleanId(3), null); assert.strictEqual(L.cleanId(''), null); });
t('settings bad types fallback', () => assert.deepStrictEqual(L.normalizeSettings({ defaultPaper: 3, hideDeco: 'x', tilt: 1 }), L.defaultSettings()));
t('applyPatch sets and null deletes', () => {
  let m = L.applyPatch({}, { paper: 'a-b', font: 'itim' });
  assert.deepStrictEqual(m, { paper: 'a-b', font: 'itim' });
  m = L.applyPatch(m, { font: null }); assert.deepStrictEqual(m, { paper: 'a-b' });
});
t('applyPatch ignores invalid', () => assert.deepStrictEqual(L.applyPatch({ paper: 'a' }, { paper: 'A!', shape: 'zzz', tilt: 'x', foo: 1 }), { paper: 'a' }));
t('applyPatch does not mutate', () => { const o = { paper: 'a' }; L.applyPatch(o, { paper: 'b' }); assert.strictEqual(o.paper, 'a'); });
t('applyPatch proto key', () => { const m = L.applyPatch({}, JSON.parse('{"__proto__":{"x":1},"paper":"p"}')); assert.deepStrictEqual(m, { paper: 'p' }); assert.strictEqual({}.x, undefined); });
t('applyPatch non-object patch', () => assert.deepStrictEqual(L.applyPatch({ paper: 'a' }, 'x'), { paper: 'a' }));
t('applySettings', () => {
  const s = L.applySettings(L.defaultSettings(), { defaultPaper: 'p1', defaultFont: 'itim', hideDeco: true });
  assert.strictEqual(s.defaultPaper, 'p1'); assert.strictEqual(s.hideDeco, true);
  assert.strictEqual(L.applySettings(s, { defaultPaper: null }).defaultPaper, null);
  assert.strictEqual(L.applySettings(s, { defaultPaper: 'BAD' }).defaultPaper, 'p1');
  assert.deepStrictEqual(L.applySettings(s, {}), s);
});
t('hiddenPapers', () => {
  assert.deepStrictEqual(L.defaultSettings().hiddenPapers, []);
  const long = 'a'.repeat(64), tooLong = 'a'.repeat(65);
  const s = L.applySettings(L.defaultSettings(), { hiddenPapers: ['a', 'a', 'B', 3, null, '', tooLong, long, 'x-1'] });
  assert.deepStrictEqual(s.hiddenPapers, ['a', long, 'x-1']);
  assert.deepStrictEqual(L.applySettings(s, { tilt: true }).hiddenPapers, s.hiddenPapers);   // không đụng khi patch không có khoá
  assert.deepStrictEqual(L.applySettings(s, { hiddenPapers: 'x' }).hiddenPapers, s.hiddenPapers); // không phải mảng => bỏ qua
  assert.deepStrictEqual(L.applySettings(s, { hiddenPapers: [] }).hiddenPapers, []);             // thay cả mảng
  const many = Array.from({ length: 300 }, (_, i) => 'p' + i);
  assert.strictEqual(L.applySettings(s, { hiddenPapers: many }).hiddenPapers.length, 200);
  assert.deepStrictEqual(L.normalize({ settings: { hiddenPapers: ['q', 'q', 'BAD'] } }).settings.hiddenPapers, ['q']);
  assert.deepStrictEqual(L.normalizeSettings({ hiddenPapers: 'x' }).hiddenPapers, []);
});
t('defaultFor', () => {
  assert.strictEqual(L.defaultFor(L.defaultSettings()), null);
  assert.deepStrictEqual(L.defaultFor({ defaultPaper: 'p' }), { paper: 'p' });
  assert.deepStrictEqual(L.defaultFor({ defaultPaper: 'p', defaultFont: 'mali' }), { paper: 'p', font: 'mali' });
  assert.strictEqual(L.defaultFor(null), null);
});
t('cleanIndex', () => {
  assert.strictEqual(L.cleanIndex(0), 0); assert.strictEqual(L.cleanIndex(999), 999);
  assert.strictEqual(L.cleanIndex(1000), null); assert.strictEqual(L.cleanIndex(-1), null);
  assert.strictEqual(L.cleanIndex(1.5), null); assert.strictEqual(L.cleanIndex('x'), null);
});
t('clampBounds min/max', () => {
  assert.deepStrictEqual(L.clampBounds({ width: 10, height: 10 }, { x: 0, y: 0 }, null), { x: 0, y: 0, width: 220, height: 160 });
  const b = L.clampBounds({ width: 5000, height: 5000 }, { x: 0, y: 0 }, null); assert.strictEqual(b.width, 1200); assert.strictEqual(b.height, 1200);
});
t('clampBounds workArea', () => {
  const wa = { x: 0, y: 0, width: 1000, height: 700 };
  assert.deepStrictEqual(L.clampBounds({ width: 300, height: 300 }, { x: 900, y: 600 }, wa), { x: 700, y: 400, width: 300, height: 300 });
  const b = L.clampBounds({ width: 1200, height: 1200 }, { x: 50, y: 50 }, wa); assert.strictEqual(b.width, 1000); assert.strictEqual(b.height, 700); assert.strictEqual(b.x, 0);
});
t('clampBounds bad', () => { assert.strictEqual(L.clampBounds(null, {}, null), null); assert.strictEqual(L.clampBounds({ width: 'a', height: 1 }, {}, null), null); });
t('okNoteId', () => { assert.ok(L.okNoteId('abc')); assert.ok(!L.okNoteId('__proto__')); assert.ok(!L.okNoteId('')); assert.ok(!L.okNoteId(5)); });
t('randomPaper settings', () => {
  assert.strictEqual(L.defaultSettings().randomPaper, false);
  assert.strictEqual(L.applySettings(L.defaultSettings(), { randomPaper: true }).randomPaper, true);
  assert.strictEqual(L.applySettings({ randomPaper: true }, { randomPaper: 'x' }).randomPaper, true);
  assert.strictEqual(L.normalizeSettings({ randomPaper: 1 }).randomPaper, false);
});
t('pickRandomPaper tránh hidden, last, trả null khi hết', () => {
  const ids = ['a', 'b', 'c'];
  assert.strictEqual(L.pickRandomPaper(ids, ['a', 'c'], null, () => 0.99), 'b');
  assert.strictEqual(L.pickRandomPaper(ids, ['a', 'b', 'c'], null, () => 0), null);
  assert.strictEqual(L.pickRandomPaper([], [], null, () => 0), null);
  assert.strictEqual(L.pickRandomPaper(ids, [], 'a', () => 0), 'b');
  assert.strictEqual(L.pickRandomPaper(['a'], [], 'a', () => 0), 'a');
  assert.strictEqual(L.pickRandomPaper(ids, [], null, () => 0.99), 'c');
  assert.strictEqual(L.pickRandomPaper(ids, [], null, () => 1), 'c');
  assert.strictEqual(L.pickRandomPaper(ids, [], null, () => NaN), 'a');
});
t('metaForNewNote', () => {
  const ids = ['d1', 'd2'];
  assert.strictEqual(L.metaForNewNote({ defaultPaper: 'plain-yellow' }, ids, null, () => 0).paper, 'plain-yellow');   // tắt random
  assert.strictEqual(L.metaForNewNote({}, ids, null, () => 0), null);
  const on = { randomPaper: true, defaultPaper: 'plain-pink', defaultFont: 'itim' };
  assert.deepStrictEqual(L.metaForNewNote(on, ids, null, () => 0.9), { paper: 'd2', font: 'itim' });
  for (let i = 0; i < 20; i++) assert.ok(!/^plain/.test(L.metaForNewNote(on, ids, null, () => i / 20).paper));
  assert.strictEqual(L.metaForNewNote(Object.assign({ hiddenPapers: ['d1'] }, on), ids, null, () => 0).paper, 'd2');
  assert.strictEqual(L.metaForNewNote(Object.assign({ hiddenPapers: ['d1', 'd2'] }, on), ids, null, () => 0).paper, 'plain-pink'); // fallback
  assert.strictEqual(L.metaForNewNote({ randomPaper: true }, [], null, () => 0), null);
});
console.log('OK ' + n);
