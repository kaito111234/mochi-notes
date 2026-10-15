'use strict';
// QA lượt 2 — phòng notes, tính năng Đợt 2/2B: ghi nhanh, nhiều nhắc, gợi ý "hiểu note",
// thùng rác, note hết hạn, không dấu/viết tắt, chuyển tab danh sách.
// Chạy: bash test/e2e/run.sh test/e2e/notes2.test.js
const test = require('node:test');
const assert = require('node:assert');
const { launch, withApp, waitFor, sleep } = require('./lib/app');
const { tzForLocalHour, newNoteViaShortcut, typeInto } = require('./lib/reminder-helpers');

const DAY = 86400000;
const nowMs = Date.now();
const mk = (id, text, o = {}) => Object.assign({
  id, html: text.split('\n').map(l => '<div>' + l + '</div>').join(''), text, color: 'yellow',
  bounds: { x: 100 + (o.dx || 0), y: 120, width: 300, height: 220 },
  visible: true, alwaysOnTop: false, reminder: null, createdAt: nowMs - 3600000, updatedAt: nowMs - 3600000
}, o);
const SETTINGS = { mascotEnabled: false, mascotIdle: false, sound: false, glass: false, startup: false, allHidden: false };
const seedOf = (notes, extra = {}) => Object.assign({ notes, settings: Object.assign({}, SETTINGS) }, extra);
const dummy = () => mk('n_dummy', 'Ghi chú nền');
// TZ để giờ địa phương của app ~ 06:xx: các mốc 9h/14h/20h hôm nay đều ở tương lai.
const at6 = () => ({ TZ: tzForLocalHour(6) });
const getNote = (app, id) => app.main((c, e, i) => JSON.parse(JSON.stringify(c.findNote(i))), id);
const noteWins = app => app.pages('note.html').length;

/** Ghi lại sự kiện bus vào globalThis.__ev (trong main). */
async function spyBus(app, types) {
  await app.main((c, e, ts) => {
    globalThis.__ev = [];
    for (const t of ts) c.bus.on(t, p => globalThis.__ev.push({ type: t, p: JSON.parse(JSON.stringify(p || {})), at: Date.now() }));
    return true;
  }, types);
}
const events = (app, type) => app.main((c, e, t) => (globalThis.__ev || []).filter(x => !t || x.type === t), type || null);
/** Giờ địa phương (trong app) của danh sách epoch. */
const hmOf = (app, ts) => app.main((c, e, a) => a.map(t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }), ts);

// ---------------------------------------------------------------- 1
test('notes2-1: Ghi nhanh trong danh sách + quickCapture', { timeout: 180000 }, async () => {
  await withApp('notes2-1', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    const lp = await app.openList();
    await lp.waitForSelector('#qcIn');
    const TXT = 'họp 9h, 14h gọi khách, tối 8h đi tập';
    await lp.fill('#qcIn', TXT);
    await waitFor(async () => /Bé hiểu/.test(await lp.textContent('#qcPrev')), { msg: 'xem trước "Bé hiểu"' });
    const prev = await lp.textContent('#qcPrev');
    assert.ok(/Bé hiểu: 3 việc/.test(prev), 'xem trước phải là 3 việc: ' + prev);
    assert.ok(/09:00 Họp/.test(prev), prev);
    assert.ok(/14:00 Gọi khách/.test(prev), prev);
    assert.ok(/20:00 Đi tập/.test(prev), 'tối 8h = 20:00: ' + prev);
    await lp.press('#qcIn', 'Enter');
    await waitFor(async () => (await app.notes()).length === 2, { msg: 'note mới tạo' });
    const n = (await app.notes()).find(x => x.id !== 'n_dummy');
    assert.strictEqual(n.reminders.length, 3, 'phải có 3 nhắc');
    assert.deepStrictEqual(await hmOf(app, n.reminders.map(r => r.due)), ['09:00', '14:00', '20:00']);
    assert.deepStrictEqual(n.reminders.map(r => r.title), ['Họp', 'Gọi khách', 'Đi tập']);
    assert.ok(n.reminders.every(r => r.id && !r.done && !r.fired), 'nhắc mới chưa xong/chưa kêu');
    assert.strictEqual(n.reminder.id, n.reminders[0].id, 'primary = nhắc sớm nhất');
    const toast = await waitFor(async () => { const t = await lp.textContent('#toast'); return t && t.includes('Tớ ghi rồi') ? t : null; }, { msg: 'toast reply' });
    assert.ok(/^Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách/.test(toast.trim()), 'reply sai: ' + toast);
    assert.ok(!/undefined|NaN|null|\{|\}/.test(toast), toast);
    assert.ok(toast.trim().length <= 130, 'reply quá dài: ' + toast.length);
    assert.ok(await lp.isHidden('#qcPrev'), 'xem trước phải ẩn sau khi gửi');
    assert.strictEqual(await lp.inputValue('#qcIn'), '');
  });
});

test('notes2-1b: ctx.notes.quickCapture — reply các dạng, ẩn hết + source pet', { timeout: 180000 }, async () => {
  await withApp('notes2-1b', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    const r3 = await app.main(c => { const r = c.notes.quickCapture('họp 9h, 14h gọi khách, tối 8h đi tập', { source: 'list' }); return { reply: r.reply, ok: r.ok, n: r.note.reminders.length, hasInsight: !!r.insight, items: r.insight && r.insight.items.length }; });
    assert.ok(r3.ok); assert.strictEqual(r3.n, 3); assert.strictEqual(r3.items, 3);
    assert.ok(r3.reply.startsWith('Tớ ghi rồi nha, 3 việc: 09:00 họp, 14:00 gọi khách'), r3.reply);
    assert.ok(r3.reply.length <= 120, 'reply > 120 ký tự: ' + r3.reply.length + ' ' + r3.reply);
    const r1 = await app.main(c => c.notes.quickCapture('15h gọi mẹ', { source: 'list' }).reply);
    assert.strictEqual(r1, 'Tớ ghi rồi nha. 15:00 tớ nhắc cậu gọi mẹ');
    const r0 = await app.main(c => c.notes.quickCapture('mua sữa và trứng', { source: 'list' }).reply);
    assert.ok(r0.length >= 5 && r0.length <= 120, 'reply không giờ: ' + r0);   // câu do persona.pick('note_created') hoặc "Tớ ghi rồi nha: …"
    assert.ok(!/undefined|NaN|\{|\}/.test(r0), r0);
    const rEmpty = await app.main(c => c.notes.quickCapture('   ', {}));
    assert.strictEqual(rEmpty.ok, false);
    // Bé ghi giúp khi đang ẩn hết: không bật cửa sổ note
    await app.main(c => { c.notes.hideAll(); return true; });
    await waitFor(() => noteWins(app) === 0, { msg: 'đóng hết' });
    assert.strictEqual(await app.main(c => c.settings().allHidden), true);
    const before = (await app.notes()).length;
    const rp = await app.main(c => { const r = c.notes.quickCapture('hop 3h chieu mai', { source: 'pet' }); return { reply: r.reply, id: r.note.id, n: r.note.reminders.length }; });
    await sleep(1500);
    assert.strictEqual(noteWins(app), 0, 'source=pet + ẩn hết: không được mở cửa sổ note');
    assert.strictEqual((await app.notes()).length, before + 1);
    assert.strictEqual(rp.n, 1);
    assert.ok(/15:00/.test(rp.reply), rp.reply);
    assert.strictEqual(await app.main(c => c.settings().allHidden), true, 'vẫn ẩn hết');
  });
});

// ---------------------------------------------------------------- 2
test('notes2-2: nhiều nhắc — chip +N, chi tiết, Xong/Hoãn, gõ thêm không reset, giới hạn 20', { timeout: 240000 }, async () => {
  await withApp('notes2-2', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    const id = await app.main(c => c.notes.createNote({ html: '<div>họp 9h</div><div>14h gọi khách</div><div>tối 8h đi tập</div><div>21h30 đọc sách</div>' }).id);
    await waitFor(() => noteWins(app) === 2, { msg: 'cửa sổ note' });
    let n = await getNote(app, id);
    assert.strictEqual(n.reminders.length, 4, 'phải có 4 nhắc: ' + JSON.stringify(n.reminders.map(r => r.title)));
    const ids0 = n.reminders.map(r => r.id);
    assert.strictEqual(new Set(ids0).size, 4, 'id nhắc phải duy nhất');

    const lp = await app.openList();
    const card = '.card[data-id="' + id + '"]';
    await lp.waitForSelector(card);
    const more = await lp.textContent(card + ' .foot-remind .more');
    assert.strictEqual(more.trim(), '+3', 'chip +N');
    await lp.hover(card);
    await lp.click(card + ' [data-act="expand"]');
    await lp.waitForSelector(card + ' .rem-row');
    assert.strictEqual(await lp.locator(card + ' .rem-row').count(), 4);
    const rows = await lp.$$eval(card + ' .rem-row', els => els.map(e => e.textContent));
    assert.ok(/09:00/.test(rows[0]) && /Họp/.test(rows[0]), rows[0]);
    assert.ok(/14:00/.test(rows[1]) && /Gọi khách/.test(rows[1]), rows[1]);
    assert.ok(/20:00/.test(rows[2]) && /Đi tập/.test(rows[2]), rows[2]);
    assert.ok(/21:30/.test(rows[3]) && /Đọc sách/.test(rows[3]), rows[3]);

    // Xong mục đầu
    await lp.click(card + ' .rem-row:nth-child(1) [data-act="rdone"]');
    await waitFor(async () => (await getNote(app, id)).reminders.find(r => r.id === ids0[0]).done === true, { msg: 'mục 1 xong' });
    n = await getNote(app, id);
    assert.deepStrictEqual(n.reminders.filter(r => r.done).map(r => r.id), [ids0[0]], 'chỉ mục 1 xong');
    await waitFor(async () => (await lp.textContent(card + ' .foot-remind .more')).trim() === '+2', { msg: 'chip còn +2' });
    // Hoãn mục 3 (đi tập 20:00)
    const dueBefore = n.reminders.find(r => r.id === ids0[2]).due;
    await lp.click(card + ' .rem-row:nth-child(3) [data-act="rsnooze"]');
    await waitFor(async () => (await getNote(app, id)).reminders.find(r => r.id === ids0[2]).due !== dueBefore, { msg: 'mục 3 hoãn' });
    n = await getNote(app, id);
    const sn = n.reminders.find(r => r.id === ids0[2]);
    assert.ok(sn.due > Date.now() + 8 * 60000 && sn.due < Date.now() + 12 * 60000, 'hoãn 10 phút từ bây giờ: ' + (sn.due - Date.now()) / 60000);
    assert.ok(!n.reminders.find(r => r.id === ids0[1]).done, 'mục 2 không bị ảnh hưởng');
    assert.strictEqual(n.reminders.find(r => r.id === ids0[1]).due, (await getNote(app, id)).reminders.find(r => r.id === ids0[1]).due);

    // Gõ thêm chữ vào note thật: id/trạng thái nhắc không đổi
    const snap = JSON.parse(JSON.stringify(n.reminders.map(r => ({ id: r.id, done: r.done, fired: r.fired, preFired: r.preFired, due: r.due, title: r.title }))));
    const np = await app.noteWindow(id);
    await np.waitForSelector('#editor');
    await np.click('#editor');
    await np.keyboard.press('Control+End');
    await np.keyboard.press('Enter');
    await np.keyboard.type('nhớ mang laptop');
    await waitFor(async () => /nhớ mang laptop/.test((await getNote(app, id)).text), { msg: 'chữ mới được lưu' });
    await sleep(800);
    n = await getNote(app, id);
    const now2 = n.reminders.map(r => ({ id: r.id, done: r.done, fired: r.fired, preFired: r.preFired, due: r.due, title: r.title }));
    const by = a => a.slice().sort((x, y) => x.id < y.id ? -1 : 1);
    assert.deepStrictEqual(by(now2), by(snap), 'gõ thêm chữ làm đổi id/trạng thái nhắc');
    // gõ ngay trong dòng có giờ (đổi tiêu đề): vẫn không mất trạng thái done của mục khác
    await np.keyboard.press('Control+Home');
    await np.keyboard.type('!');
    await sleep(1500);
    n = await getNote(app, id);
    assert.ok(n.reminders.find(r => r.id === ids0[0]) && n.reminders.find(r => r.id === ids0[0]).done, 'mục đã xong bị reset sau khi sửa dòng đầu: ' + JSON.stringify(n.reminders.map(r => [r.title, r.done])));

    // Giới hạn 20
    const cnt = await app.main((c, e, nid) => {
      const base = Date.now() + 3 * 86400000;
      for (let i = 0; i < 25; i++) c.notes.setReminderItem(nid, null, { due: base + i * 3600000, title: 'Việc tay ' + i });
      return c.findNote(nid).reminders.length;
    }, id);
    assert.ok(cnt <= 20, 'tối đa 20 nhắc, thực tế ' + cnt);
    const n20 = await getNote(app, id);
    assert.ok(n20.reminders.length <= 20);
    assert.ok(n20.reminders.every((r, i, a) => i === 0 || a[i - 1].due <= r.due), 'phải sắp theo due tăng dần');
    // note 25 dòng có giờ -> nhắc auto cũng ≤ 20
    const lines = []; for (let i = 0; i < 25; i++) lines.push((7 + (i % 12)) + 'h việc số ' + i);
    const c2 = await app.main((c, e, t) => c.notes.createNote({ html: t.map(l => '<div>' + l + '</div>').join('') }).reminders.length, lines);
    assert.ok(c2 <= 20, 'auto > 20 nhắc: ' + c2);
    // file ghi ra có cả reminders + reminder
    await app.flush();
    const fn = app.readData().notes.find(x => x.id === id);
    assert.ok(Array.isArray(fn.reminders) && fn.reminder && fn.reminder.id, 'file phải có reminders và reminder');
    assert.ok(fn.reminders.some(r => r.id === fn.reminder.id));
  });
});

test('notes2-2b: xoá nhắc tự động không tự tạo lại (remindMuted), xoá item', { timeout: 150000 }, async () => {
  await withApp('notes2-2b', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    const id = await app.main(c => c.notes.createNote({ html: '<div>họp 9h</div><div>14h gọi khách</div>' }).id);
    let n = await getNote(app, id);
    assert.strictEqual(n.reminders.length, 2);
    const rid = n.reminders[0].id;
    await app.main((c, e, a) => { c.notes.removeReminderItem(a.id, a.rid); return true; }, { id, rid });
    n = await getNote(app, id);
    assert.strictEqual(n.reminders.length, 1);
    assert.ok(n.remindMuted.length >= 1, 'remindMuted phải ghi key đã xoá');
    // sửa text -> mục đã xoá không quay lại
    await app.main((c, e, a) => { c.notes.updateNote(a.id, { html: '<div>họp 9h</div><div>14h gọi khách</div><div>ghi thêm</div>' }); return true; }, { id });
    n = await getNote(app, id);
    assert.strictEqual(n.reminders.length, 1, 'nhắc đã xoá tự quay lại sau khi sửa chữ: ' + JSON.stringify(n.reminders.map(r => r.title)));
  });
});

// ---------------------------------------------------------------- 3
test('notes2-3: dải gợi ý trong cửa sổ note (remind, phone, checklist) + applySuggestion', { timeout: 240000 }, async () => {
  await withApp('notes2-3', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    // (a) remind: tạo note không tự đặt nhắc để dải gợi ý hiện "Tạo"
    const idR = await app.main(c => c.notes.createNote({ html: '<div>họp 9h</div><div>14h gọi khách</div>', autoReminder: false }).id);
    const pr = await app.noteWindow(idR);
    await pr.waitForSelector('#editor');
    await waitFor(async () => (await getNote(app, idR)).reminders.length === 0, { msg: 'chưa có nhắc' }).catch(() => {});
    const vw = await pr.evaluate(i => window.mochi.alarms.insight(i), idR);
    assert.ok(vw && vw.items.length === 2, 'insight 2 mục');
    assert.ok(vw.suggestions.some(s => s.id === 'remind-all'), 'phải có remind-all: ' + JSON.stringify(vw.suggestions.map(s => s.id)));
    await pr.waitForSelector('#insightRow:not([hidden])', { timeout: 20000 });
    const txt = await pr.textContent('#insightRow .ins-tx');
    assert.ok(/2 việc có giờ/.test(txt), 'dải gợi ý: ' + txt);
    await app.shot('notes2-3-strip');
    await pr.click('#insightRow .ins-go');
    await waitFor(async () => (await getNote(app, idR)).reminders.length === 2, { msg: '2 nhắc sau khi áp dụng' });
    const nR = await getNote(app, idR);
    assert.deepStrictEqual(await hmOf(app, nR.reminders.map(r => r.due)), ['09:00', '14:00']);
    await waitFor(async () => pr.isHidden('#insightRow'), { msg: 'dải gợi ý ẩn sau khi áp dụng' });
    // sau khi áp dụng, insight không còn đề xuất remind trùng
    const vw2 = await pr.evaluate(i => window.mochi.alarms.insight(i), idR);
    assert.ok(!vw2.suggestions.some(s => /^remind/.test(s.id)), 'còn đề xuất remind trùng: ' + JSON.stringify(vw2.suggestions.map(s => s.id)));

    // (b) checklist
    const idC = await app.main(c => c.notes.createNote({ html: '<div>mua sữa</div><div>mua trứng</div><div>mua bánh mì</div>' }).id);
    const pc = await app.noteWindow(idC);
    await pc.waitForSelector('#editor');
    await pc.waitForSelector('#insightRow:not([hidden])', { timeout: 20000 });
    const tc = await pc.textContent('#insightRow .ins-tx');
    assert.ok(/checklist/i.test(tc), 'gợi ý checklist: ' + tc);
    await pc.click('#insightRow .ins-go');
    await waitFor(async () => /^\s*-\s*\[ \]\s*mua sữa/m.test((await getNote(app, idC)).text), { msg: 'text thành "- [ ] …"' });
    const nC = await getNote(app, idC);
    assert.strictEqual(nC.text.split('\n').filter(l => /^\s*-\s*\[ \]/.test(l)).length, 3, nC.text);

    // (c) số điện thoại
    const idP = await app.main(c => c.notes.createNote({ html: '<div>gọi anh Nam 0901 234 567</div>' }).id);
    const pp = await app.noteWindow(idP);
    await pp.waitForSelector('#editor');
    const vp = await pp.evaluate(i => window.mochi.alarms.insight(i), idP);
    assert.ok(vp.phones.length === 1 && vp.phones[0].number === '0901234567', JSON.stringify(vp.phones));
    assert.ok(vp.suggestions.some(s => s.id === 'call:0901234567') && vp.suggestions.some(s => s.id === 'message:0901234567'));
    await pp.waitForSelector('#insightRow:not([hidden])', { timeout: 20000 });
    assert.ok(/0901 234 567/.test(await pp.textContent('#insightRow .ins-tx')));
    const rc = await pp.evaluate(i => window.mochi.alarms.applySuggestion(i, 'call:0901234567'), idP);
    assert.ok(rc.ok && rc.copied === '0901234567', JSON.stringify(rc));
    assert.strictEqual(await app.main((c, e) => e.clipboard.readText()), '0901234567');
  });
});

test('notes2-3b: applySuggestion qua main — alarm, split, link, email, không hợp lệ', { timeout: 200000 }, async () => {
  await withApp('notes2-3b', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    // alarm
    const idA = await app.main(c => c.notes.createNote({ html: '<div>dậy 6h30 mai</div>', autoReminder: false }).id);
    const vA = await app.main((c, e, i) => c.notes.insight(i), idA);
    const sa = vA.suggestions.find(s => s.kind === 'alarm');
    assert.ok(sa, 'phải có gợi ý báo thức: ' + JSON.stringify(vA.suggestions));
    const rA = await app.main((c, e, a) => { const r = c.notes.applySuggestion(a.id, a.sid); return { ok: r.ok, message: r.message, alarm: r.alarm && { time: r.alarm.time, noteId: r.alarm.noteId } }; }, { id: idA, sid: sa.id });
    assert.ok(rA.ok && rA.alarm && rA.alarm.time === '06:30', JSON.stringify(rA));
    const rA2 = await app.main((c, e, a) => c.notes.applySuggestion(a.id, a.sid).ok, { id: idA, sid: sa.id });
    assert.ok(rA2, 'bấm lần 2 không được lỗi');
    const alN = await app.main(c => c.alarms.list().filter(a => a.time === '06:30').length);
    assert.strictEqual(alN, 1, 'báo thức bị tạo trùng khi bấm 2 lần: ' + alN);
    // split
    const idS = await app.main(c => c.notes.createNote({ html: '<div>9h họp nhóm</div><div>14h gọi khách</div><div>20h đi tập</div>', autoReminder: false }).id);
    const vS = await app.main((c, e, i) => c.notes.insight(i), idS);
    assert.ok(vS.suggestions.some(s => s.id === 'split'), JSON.stringify(vS.suggestions.map(s => s.id)));
    const before = (await app.notes()).length;
    const rS = await app.main((c, e, i) => { const r = c.notes.applySuggestion(i, 'split'); return { ok: r.ok, m: r.message, n: r.notes && r.notes.length }; }, idS);
    assert.ok(rS.ok && rS.n === 3, JSON.stringify(rS));
    const all = await app.notes();
    assert.strictEqual(all.length, before + 2);
    const texts = all.map(n => n.text);
    for (const k of ['họp nhóm', 'gọi khách', 'đi tập']) assert.strictEqual(texts.filter(t => t.includes(k)).length, 1, 'mỗi mục đúng 1 note: ' + k);
    // link & email: chỉ kiểm không lỗi và từ chối scheme nguy hiểm
    const idL = await app.main(c => c.notes.createNote({ html: '<div>xem https://example.com/a và mail a@b.vn</div>', autoReminder: false }).id);
    const vL = await app.main((c, e, i) => c.notes.insight(i), idL);
    assert.ok(vL.suggestions.some(s => s.kind === 'link') && vL.suggestions.some(s => s.kind === 'email'), JSON.stringify(vL.suggestions.map(s => s.id)));
    const bad = await app.main((c, e, i) => c.notes.applySuggestion(i, 'link:javascript:alert(1)'), idL);
    assert.strictEqual(bad.ok, false, 'không được mở link lạ');
    const gone = await app.main((c, e, i) => c.notes.applySuggestion(i, 'remind:k:khong-co'), idL);
    assert.strictEqual(gone.ok, false);
    assert.strictEqual((await app.main((c, e, i) => c.notes.applySuggestion('khong-co-id', 'split'), idL)).ok, false);
  });
});

// ---------------------------------------------------------------- 4
test('notes2-4: thùng rác — xoá mềm, khôi phục, xoá hẳn, dọn >30 ngày, không nhắc', { timeout: 240000 }, async () => {
  const old = mk('n_old', 'Note cũ trong thùng 40 ngày');
  const mid = mk('n_mid', 'Note trong thùng 29 ngày');
  const seed = seedOf([mk('n_a', 'Note A bình thường'), mk('n_b', 'Note B để xoá', { dx: 400 })], {
    trash: { items: [{ note: old, trashedAt: nowMs - 40 * DAY }, { note: mid, trashedAt: nowMs - 29 * DAY }] }
  });
  await withApp('notes2-4', { seed, waitNotes: 2 }, async app => {
    // dọn quá 30 ngày lúc mở app
    await waitFor(async () => !(await app.main(c => c.notes.trashList())).some(t => t.id === 'n_old'), { msg: 'note 40 ngày bị dọn' });
    const tl0 = await app.main(c => c.notes.trashList());
    assert.deepStrictEqual(tl0.map(t => t.id), ['n_mid'], 'note 29 ngày phải còn');
    assert.ok(tl0[0].expiresAt > Date.now() && tl0[0].expiresAt < Date.now() + 2 * DAY);
    await app.flush();
    assert.ok(!app.readData().trash.items.some(i => i.note.id === 'n_old'), 'file vẫn còn note quá hạn');

    await spyBus(app, ['note:trashed', 'note:restored', 'note:deleted', 'note:created', 'reminder:due', 'reminder:pre']);
    const lp = await app.openList();
    await lp.waitForSelector('.card[data-id="n_b"]');
    // xoá qua UI
    await lp.hover('.card[data-id="n_b"]');
    await lp.click('.card[data-id="n_b"] [data-act="ask"]');
    assert.ok(/thùng rác/i.test(await lp.textContent('.card[data-id="n_b"] .confirm-q')), 'chữ xác nhận phải nhắc thùng rác');
    await lp.click('.card[data-id="n_b"] [data-act="delete"]');
    await waitFor(async () => !(await app.notes()).some(n => n.id === 'n_b'), { msg: 'n_b rời danh sách' });
    await waitFor(async () => (await events(app, 'note:trashed')).length === 1, { msg: 'note:trashed' });
    assert.strictEqual((await events(app, 'note:trashed'))[0].p.noteId, 'n_b');
    await waitFor(() => noteWins(app) === 1, { msg: 'cửa sổ n_b đóng' });
    const tl1 = await app.main(c => c.notes.trashList());
    assert.deepStrictEqual(tl1.map(t => t.id).sort(), ['n_b', 'n_mid']);
    // tab thùng rác
    await lp.click('.chip[data-f="trash"]');
    await waitFor(async () => (await lp.locator('.trash-card').count()) === 2, { msg: '2 note trong thùng' });
    await app.shot('notes2-4-trash');
    // khôi phục n_b
    await lp.click('.trash-card[data-id="n_b"] [data-act="trestore"]');
    await waitFor(async () => (await app.notes()).some(n => n.id === 'n_b'), { msg: 'n_b về lại' });
    const nb = await getNote(app, 'n_b');
    assert.strictEqual(nb.text, 'Note B để xoá', 'nội dung phải nguyên vẹn');
    assert.strictEqual((await events(app, 'note:restored')).length, 1);
    await waitFor(() => noteWins(app) === 2, { msg: 'n_b mở lại' });
    // xoá hẳn: cần 2 bước
    await waitFor(async () => (await lp.locator('.trash-card').count()) === 1, { msg: 'còn 1 trong thùng' });
    await lp.click('.trash-card[data-id="n_mid"] [data-act="tpurge"]');
    assert.ok((await app.main(c => c.notes.trashList())).some(t => t.id === 'n_mid'), 'bấm 1 lần chưa được xoá hẳn');
    await lp.click('.trash-card[data-id="n_mid"] [data-act="tpurge"]');
    await waitFor(async () => (await app.main(c => c.notes.trashList())).length === 0, { msg: 'xoá hẳn' });
    await waitFor(async () => /Thùng rác trống/.test(await lp.textContent('#empty')), { msg: 'thùng rỗng hiển thị' });
  });
});

test('notes2-4b: note trong thùng rác KHÔNG nhắc; xoá note có nhắc rồi không kêu', { timeout: 200000 }, async () => {
  const soon = Date.now() + 6000;
  const tn = mk('n_tr', 'Họp trong thùng', { reminder: { due: soon, lead: 0, intent: 'meet', auto: false, preFired: false, fired: false, done: false } });
  const seed = seedOf([dummy(), mk('n_del', 'Gọi khách sắp xoá', { reminder: { due: soon + 2000, lead: 0, intent: 'call', auto: false, preFired: false, fired: false, done: false }, dx: 300 })],
    { trash: { items: [{ note: tn, trashedAt: Date.now() - DAY }] } });
  await withApp('notes2-4b', { seed, waitNotes: 2 }, async app => {
    await spyBus(app, ['reminder:due', 'reminder:pre']);
    await app.main((c, electron) => { globalThis.__notifs = []; const N = electron.Notification; const o = N.prototype.show; N.prototype.show = function () { globalThis.__notifs.push(this.title); return 0; }; return !!o; });
    assert.ok(await app.main(c => c.notes.deleteNote('n_del')), 'deleteNote trả true');
    assert.ok(await app.main(c => c.notes.isTrashed('n_del')));
    await sleep(14000);
    const ev = await events(app);
    assert.deepStrictEqual(ev.filter(e => ['n_tr', 'n_del'].includes(e.p.noteId)), [], 'note trong thùng rác bị nhắc: ' + JSON.stringify(ev));
    assert.deepStrictEqual(await app.main(() => globalThis.__notifs), [], 'thông báo Windows cho note trong thùng rác');
    // khôi phục note có nhắc đã quá giờ: không được "kêu" như mới đặt trong khi nằm thùng (chỉ kiểm không mất nhắc)
    const r = await app.main(c => { const n = c.notes.restore('n_del'); return n && { due: n.reminder && n.reminder.due, ids: n.reminders.length }; });
    assert.ok(r && r.ids === 1, 'khôi phục phải giữ nhắc: ' + JSON.stringify(r));
  });
});

// ---------------------------------------------------------------- 5
test('notes2-5: note hết hạn — đã xong / quá hạn >24h / checklist; không mất dữ liệu', { timeout: 300000 }, async () => {
  const old = nowMs - 3600000;
  const R = (o) => Object.assign({ id: 'r1', due: nowMs - 2 * 3600000, lead: 0, intent: 'default', auto: false, preFired: true, fired: true, done: false }, o);
  const notes = [
    mk('n_done', 'Họp xong rồi', { reminder: R({ done: true }), reminders: [R({ done: true })], updatedAt: old }),
    mk('n_late', 'Nộp báo cáo quá hạn', { reminder: R({ due: nowMs - 30 * 3600000 }), reminders: [R({ due: nowMs - 30 * 3600000 })], updatedAt: old, dx: 50 }),
    mk('n_chk', '- [x] mua sữa\n- [x] mua trứng', { updatedAt: old, dx: 100 }),
    mk('n_fresh', 'Mới sửa', { reminder: R({ done: true }), reminders: [R({ done: true })], updatedAt: nowMs, dx: 150 }),
    mk('n_hid', 'Đã cất xong', { visible: false, reminder: R({ done: true }), reminders: [R({ done: true })], updatedAt: old, dx: 200 }),
    mk('n_rep', 'Lặp hằng ngày', { reminder: R({ done: true, repeat: { freq: 'daily', interval: 1 } }), reminders: [R({ done: true, repeat: { freq: 'daily', interval: 1 } })], updatedAt: old, dx: 250 }),
    mk('n_ok', 'Còn nhắc tương lai', { reminder: R({ due: nowMs + DAY, fired: false, preFired: false }), reminders: [R({ due: nowMs + DAY, fired: false, preFired: false })], updatedAt: old, dx: 300 })
  ];
  await withApp('notes2-5', { seed: seedOf(notes), waitNotes: 5 }, async app => {
    await spyBus(app, ['note:expired']);
    const cand = await app.main(c => c.notes.expiredCandidates());
    const by = Object.fromEntries(cand.map(x => [x.noteId, x.reason]));
    assert.strictEqual(by.n_done, 'done');
    assert.strictEqual(by.n_late, 'overdue');
    assert.strictEqual(by.n_chk, 'checklist');
    assert.ok(!('n_fresh' in by), 'note mới sửa < 10 phút không được hỏi dọn');
    assert.ok(!('n_hid' in by), 'note đã cất không hỏi dọn');
    assert.ok(!('n_rep' in by), 'nhắc lặp không bao giờ hết hạn');
    assert.ok(!('n_ok' in by), 'còn nhắc tương lai');
    // sự kiện sau ~60s, đúng 1 lần/note/ngày
    await waitFor(async () => (await events(app, 'note:expired')).length >= 3, { timeout: 120000, msg: 'note:expired (60s sau khởi động)' });
    const ev = await events(app, 'note:expired');
    const evBy = {}; for (const e of ev) evBy[e.p.noteId] = (evBy[e.p.noteId] || 0) + 1;
    assert.deepStrictEqual(Object.keys(evBy).sort(), ['n_chk', 'n_done', 'n_late']);
    assert.ok(Object.values(evBy).every(v => v === 1), 'mỗi note 1 lần/ngày: ' + JSON.stringify(evBy));
    assert.strictEqual(ev.find(e => e.p.noteId === 'n_done').p.reason, 'done');
    // không mất dữ liệu: tất cả note + chữ còn nguyên
    const after = await app.notes();
    assert.strictEqual(after.length, notes.length, 'note hết hạn không được tự xoá');
    for (const n of notes) assert.strictEqual(after.find(x => x.id === n.id).text, n.text, 'mất nội dung ' + n.id);
    assert.strictEqual((await app.main(c => c.notes.trashList())).length, 0, 'không tự vào thùng');
    // IPC cho renderer
    const lp = await app.openList();
    const viaIpc = await lp.evaluate(() => window.mochi.notes2.expired());
    assert.ok(viaIpc.length >= 3 && viaIpc.every(x => x.noteId && x.reason));
  });
});

// ---------------------------------------------------------------- 6
test('notes2-6: không dấu/viết tắt gõ trong note thật -> chip đúng', { timeout: 300000 }, async () => {
  await withApp('notes2-6', { seed: seedOf([dummy()]), env: at6(), waitNotes: 1 }, async app => {
    const cases = [
      { text: 'hop 3h chieu mai', hm: '15:00', chip: /15:00 ngày mai/, day: 1 },
      { text: 'ng mai 9g30 goi a Nam', hm: '09:30', chip: /09:30 ngày mai/, day: 1, title: /goi a nam/i },
      { text: 't2 8h nop bao cao', hm: '08:00', chip: /08:00.*T2/, weekday: 1 }
    ];
    for (const cs of cases) {
      const { id, page } = await newNoteViaShortcut(app);
      await typeInto(page, cs.text);
      await waitFor(async () => { const n = await getNote(app, id); return n.reminders && n.reminders.length === 1; }, { msg: 'nhắc cho "' + cs.text + '"' });
      const n = await getNote(app, id);
      const r = n.reminders[0];
      const info = await app.main((c, e, due) => { const d = new Date(due); const t = new Date(); t.setHours(0, 0, 0, 0); const s = new Date(due); s.setHours(0, 0, 0, 0); return { hm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), days: Math.round((s - t) / 86400000), wd: d.getDay() }; }, r.due);
      assert.strictEqual(info.hm, cs.hm, '"' + cs.text + '" giờ sai: ' + info.hm);
      if (cs.day != null) assert.strictEqual(info.days, cs.day, '"' + cs.text + '" ngày sai');
      if (cs.weekday != null) { assert.strictEqual(info.wd, cs.weekday, '"' + cs.text + '" phải là thứ 2'); assert.ok(info.days >= 1 && info.days <= 7); }
      await page.waitForSelector('#chipRow:not([hidden])', { timeout: 8000 });
      const chip = await page.textContent('#chipText');
      assert.ok(cs.chip.test(chip), '"' + cs.text + '" chip: ' + chip);
      if (cs.title) assert.ok(cs.title.test(r.title || n.text), 'tiêu đề nhắc: ' + r.title);
      await app.shot('notes2-6-' + cs.hm.replace(':', ''));
    }
    // ghi nhanh không dấu trong danh sách
    const lp = await app.openList();
    await lp.fill('#qcIn', 'hop 9h sang mai, 2h chieu goi khach');
    await waitFor(async () => /Bé hiểu/.test(await lp.textContent('#qcPrev')), { timeout: 40000, msg: 'xem trước không dấu' });
    const prev = await lp.textContent('#qcPrev');
    assert.ok(/Bé hiểu: 2 việc/.test(prev) && /09:00/.test(prev) && /14:00/.test(prev), prev);
  });
});

// ---------------------------------------------------------------- 7
test('notes2-7: chuyển tab danh sách bằng list:tab / onListTab / ctx.list.open(tab)', { timeout: 150000 }, async () => {
  await withApp('notes2-7', { seed: seedOf([dummy()]), waitNotes: 1 }, async app => {
    const lp = await app.openList();
    await lp.waitForSelector('#tabNote');
    const sel = t => lp.getAttribute('#tab' + t, 'aria-selected');
    const hid = id => lp.isHidden('#' + id);
    assert.strictEqual(await sel('Note'), 'true');
    // đăng ký onListTab thật và gửi list:tab từ main
    await lp.evaluate(() => { window.__tabs = []; window.mochi.notes2.onListTab(t => window.__tabs.push(t)); });
    await app.main(c => { c.send(c.windows.list, 'list:tab', 'alarms'); return true; });
    await waitFor(async () => (await sel('Alarms')) === 'true', { msg: 'sang tab Báo thức' });
    assert.ok(await hid('listView') && !(await hid('alarmView')));
    assert.deepStrictEqual(await lp.evaluate(() => window.__tabs), ['alarms']);
    await app.main(c => { c.send(c.windows.list, 'list:tab', 'memos'); return true; });
    await waitFor(async () => (await sel('Memos')) === 'true', { msg: 'sang tab Dặn dò' });
    assert.ok(!(await hid('memoView')) && await hid('alarmView'));
    await app.main(c => { c.send(c.windows.list, 'list:tab', 'note'); return true; });
    await waitFor(async () => (await sel('Note')) === 'true', { msg: 'về tab Note' });
    // tab lạ -> về Note, không lỗi
    await app.main(c => { c.send(c.windows.list, 'list:tab', 'khong-co'); return true; });
    await sleep(500);
    assert.strictEqual(await sel('Note'), 'true');
    // ctx.list.open(tab) khi cửa sổ đã mở
    await app.main(c => { c.list.open('memos'); return true; });
    await waitFor(async () => (await sel('Memos')) === 'true', { msg: 'ctx.list.open(memos)' });
    // menu khay
    const labels = await app.trayLabels();
    const al = labels.find(l => /Báo thức/.test(l));
    if (al) { assert.ok(await app.trayClick(al)); await waitFor(async () => (await sel('Alarms')) === 'true', { msg: 'tray Báo thức' }); }
    // đóng danh sách rồi mở thẳng tab
    await lp.click('#btnClose');
    await waitFor(() => app.pages('list.html').length === 0, { msg: 'đóng danh sách' });
    const lp2 = await app.openList('alarms');
    await waitFor(async () => (await lp2.getAttribute('#tabAlarms', 'aria-selected')) === 'true', { msg: 'mở thẳng tab Báo thức' });
  });
});
