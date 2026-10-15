'use strict';
// E2E nhóm reminder: gõ giờ -> chip/due; tới giờ -> bé lên sân khấu; Xong/Hoãn/Mở note; note ẩn; nhắc lặp;
// thông báo dự phòng khi bé tắt; hai nhắc cùng lúc xếp hàng.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { OUT } = require('./lib/app');
const H = require('./lib/reminder-helpers');
const { waitFor } = H;

const MIN = 6e4;

/** Chạy một ca: lỗi -> ảnh -LOI, luôn đóng app. */
async function run(name, hour, body, opts) {
  const app = await H.launchAt(hour, opts);
  try { return await body(app); }
  catch (e) { const f = await app.shot(name + '-LOI'); if (f) e.message += '\n  ảnh: ' + path.relative(path.join(OUT, '..', '..', '..'), f); throw e; }
  finally { await app.close(); }
}

// Giờ kỳ vọng tính TAY trong main (new Date(y,m,d,h,mi)), không dùng parse.js.
function expectedRange(app, kind, t0) {
  return app.main((c, e, a) => {
    const now = new Date(a.t0);
    const at = (dayOff, h, mi) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOff, h, mi, 0, 0).getTime();
    const rel = ms => [a.t0 + ms, a.t0 + ms + 30000];
    switch (a.kind) {
      case 'chieu3': return [at(0, 15, 0), at(0, 15, 0)];
      case 'phut2': return rel(2 * 60000);
      case 'mai9': return [at(1, 9, 0), at(1, 9, 0)];
      case 't6tuansau': {
        const toMon = ((8 - now.getDay()) % 7) || 7;   // số ngày tới thứ Hai kế tiếp (nghiêm ngặt sau hôm nay)
        return [at(toMon + 4, 10, 30), at(toMon + 4, 10, 30)];
      }
      case 'nuatieng': return rel(30 * 60000);
      case 'toi8': return [at(0, 20, 0), at(0, 20, 0)];
      case 'sang8': return [at(0, 8, 0), at(0, 8, 0)];
    }
  }, { kind, t0 });
}

const CASES = [
  ['họp 3h chiều nay', 'chieu3', '15:00'],
  ['gọi khách 2 phút nữa', 'phut2', null],
  ['mai 9h nộp báo cáo', 'mai9', '09:00'],
  ['thứ 6 tuần sau 10h30 họp', 't6tuansau', '10:30'],
  ['nửa tiếng nữa uống thuốc', 'nuatieng', null],
  ['8h tối nay', 'toi8', '20:00']
];

// ---------------------------------------------------------------- 1. gõ giờ -> chip + due (giờ địa phương ~6h sáng)
test('1. gõ câu có giờ: chip trên note và reminder.due đúng giờ tính tay', { timeout: 150000 }, async t => {
  const app = await H.launchAt(6);
  try {
    for (const [text, kind, hm] of CASES) {
      await t.test(text, async () => {
        const { id, page } = await H.newNoteViaShortcut(app);
        const t0 = Date.now();
        await H.typeInto(page, text);
        await H.sleep(900);                      // chờ lưu (debounce)
        const note = await H.getNote(app, id);
        const [lo, hi] = await expectedRange(app, kind, t0);
        assert.ok(note.reminder, `không có reminder cho "${text}" (text=${JSON.stringify(note.text)})`);
        assert.ok(note.reminder.due >= lo - 1000 && note.reminder.due <= hi + 1000,
          `due=${new Date(note.reminder.due).toString()} kỳ vọng ${new Date(lo).toString()}..${new Date(hi).toString()}`);
        const row = await page.evaluate(() => ({ hidden: document.getElementById('chipRow').hidden, text: document.getElementById('chipText').textContent }));
        assert.strictEqual(row.hidden, false, 'chip nhắc không hiện');
        if (hm) assert.ok(row.text.includes(hm), `chip "${row.text}" thiếu ${hm}`);
        else {
          const s = await app.main((c, e, due) => { const d = new Date(due); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }, note.reminder.due);
          assert.ok(row.text.includes(s), `chip "${row.text}" thiếu ${s}`);
        }
      });
    }
  } finally { await app.shot('reminder-chips'); await app.close(); }
});

// ---------------------------------------------------------------- 1b. đã quá giờ: "3h chiều nay" lúc 20h
test('1b. "họp 3h chiều nay" khi đã quá 15h: ghi nhận cách xử lý (kỳ vọng: có phản hồi, không im lặng)', { timeout: 60000 }, async () => {
  await run('reminder-qua-gio', 20, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'họp 3h chiều nay');
    await H.sleep(900);
    const note = await H.getNote(app, id);
    const chip = await page.evaluate(() => ({ hidden: document.getElementById('chipRow').hidden, text: document.getElementById('chipText').textContent }));
    console.log('# 1b: reminder=' + JSON.stringify(note.reminder) + ' chip=' + JSON.stringify(chip));
    // Hành vi hợp lý: hoặc nhắc ngày mai 15:00, hoặc hiện chip báo "đã qua". Im lặng hoàn toàn là sai.
    assert.ok(note.reminder || !chip.hidden, 'giờ đã qua: không tạo nhắc và cũng không báo gì cho người dùng');
  });
});

// ---------------------------------------------------------------- 2. tới giờ: bé lên sân khấu, Xong / Hoãn / Mở note
async function waitDueOnStage(app, id) {
  await waitFor(async () => (await H.getNote(app, id)).reminder.fired, { timeout: 15000, msg: 'reminder.fired' });
  await waitFor(async () => { const s = await H.stageNow(app); return s && s.kind === 'due' && s.payload.noteId === id; }, { timeout: 10000, msg: 'stage hiện mục due' });
}

test('2a. tới giờ: bé hiện + bong bóng; bấm Xong -> done=true', { timeout: 90000 }, async () => {
  await run('reminder-xong', 6, async app => {
    const id = await H.makeDueNote(app, 'gọi khách 1 phút nữa', 4000);
    await waitDueOnStage(app, id);
    const pet = await app.page('pet.html');
    await H.sleep(2500);   // chờ bé chạy tới góc + bong bóng
    const vis = await app.main(c => c.pet.actor.visible());
    assert.ok(vis, 'cửa sổ bé không hiện');
    const info = await pet.evaluate(() => ({ b: document.getElementById('bubble').hidden, t: document.getElementById('bText').textContent, btn: [...document.querySelectorAll('#bBtns button')].map(x => x.textContent) }));
    console.log('# 2a: ' + JSON.stringify(info));
    assert.strictEqual(info.b, false, 'bong bóng không hiện');
    assert.ok(info.btn.some(x => /Xong/.test(x)) && info.btn.some(x => /Hoãn/.test(x)) && info.btn.some(x => /Mở/.test(x)), 'thiếu nút: ' + info.btn);
    await app.shot('reminder-due-stage');
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await H.getNote(app, id)).reminder.done === true, { timeout: 8000, msg: 'done=true' });
    await waitFor(async () => !(await H.stageNow(app)), { timeout: 8000, msg: 'bé xuống sân khấu' });
  });
});

test('2b. bấm Hoãn 10 phút -> due +10 phút, fired=false', { timeout: 90000 }, async () => {
  await run('reminder-hoan', 6, async app => {
    const id = await H.makeDueNote(app, 'gọi khách 1 phút nữa', 4000);
    await waitDueOnStage(app, id);
    const t0 = Date.now();
    await H.clickPetButton(app, 'snooze');
    await waitFor(async () => (await H.getNote(app, id)).reminder.fired === false, { timeout: 8000, msg: 'fired=false' });
    const r = (await H.getNote(app, id)).reminder;
    assert.ok(Math.abs(r.due - (t0 + 10 * MIN)) < 15000, 'due=' + (r.due - t0) / MIN + ' phút sau khi bấm');
    assert.strictEqual(r.done, false);
  });
});

test('2c. bấm Mở note -> cửa sổ note hiện (note đang cất)', { timeout: 90000 }, async () => {
  await run('reminder-mo-note', 6, async app => {
    const id = await H.makeDueNote(app, 'gọi khách 1 phút nữa', 4000, { hide: true });
    assert.strictEqual((await H.getNote(app, id)).visible, false);
    await waitDueOnStage(app, id);
    await H.clickPetButton(app, 'open');
    await waitFor(async () => (await H.getNote(app, id)).visible === true, { timeout: 8000, msg: 'visible=true' });
    const p = await app.noteWindow(id, { timeout: 8000 });
    assert.ok(p, 'không có cửa sổ note');
    await waitFor(() => app.main((c, e, i) => { const w = c.windows.notes.get(i); return !!w && !w.isDestroyed() && w.isVisible(); }, id), { timeout: 6000, msg: 'cửa sổ note isVisible()' });
  });
});

// ---------------------------------------------------------------- 3. note đang cất vẫn nhắc đúng giờ
test('3. note ẩn (visible=false): vẫn nhắc đúng giờ (fired + bé lên sân khấu)', { timeout: 90000 }, async () => {
  await run('reminder-note-an', 6, async app => {
    const id = await H.makeDueNote(app, 'uống thuốc huyết áp', 4000, { hide: true });
    const n0 = await H.getNote(app, id);
    assert.strictEqual(n0.visible, false);
    const t0 = n0.reminder.due;
    await waitFor(async () => (await H.getNote(app, id)).reminder.fired, { timeout: 15000, msg: 'fired' });
    assert.ok(Date.now() - t0 < 6000, 'nhắc trễ quá 6 giây');
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.payload.noteId === id; }, { timeout: 8000, msg: 'stage' });
    await H.sleep(2000); await app.shot('reminder-note-an');
  });
});

// ---------------------------------------------------------------- 4. nhắc lặp mỗi sáng 8h
test('4. "mỗi sáng 8h": repeat daily; bấm Xong -> due nhảy sang 8h sáng hôm sau', { timeout: 100000 }, async () => {
  await run('reminder-lap', 14, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'uống vitamin mỗi sáng 8h');
    await H.sleep(900);
    let n = await H.getNote(app, id);
    assert.ok(n.reminder, 'không có reminder');
    assert.ok(n.reminder.repeat && n.reminder.repeat.freq === 'daily', 'repeat=' + JSON.stringify(n.reminder.repeat));
    const exp = await app.main(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8, 0, 0, 0).getTime(); });
    assert.strictEqual(n.reminder.due, exp, 'due ban đầu ' + new Date(n.reminder.due).toString());
    const chip = await page.evaluate(() => document.getElementById('chipText').textContent);
    assert.ok(/08:00/.test(chip) && /hằng ngày|mỗi|sáng/i.test(chip), 'chip=' + chip);
    // đẩy tới giờ (giữ nguyên repeat/anchor)
    await app.main((c, e, i) => { const x = c.findNote(i); x.reminder.due = Date.now() + 3000; x.reminder.fired = false; x.reminder.preFired = true; c.store.save(); }, id);
    await waitDueOnStage(app, id);
    await H.clickPetButton(app, 'done');
    await waitFor(async () => { const r = (await H.getNote(app, id)).reminder; return r && r.due === exp && r.fired === false; }, { timeout: 8000, msg: 'due nhảy sang 8h hôm sau' });
    n = await H.getNote(app, id);
    assert.strictEqual(n.reminder.done, false, 'nhắc lặp không được kẹt ở done');
    assert.strictEqual(n.reminder.repeat.freq, 'daily');
  });
});

// ---------------------------------------------------------------- 5. tính tất định: bé tắt -> thông báo dự phòng
test('5. mascotEnabled=false: vẫn có Notification dự phòng khi tới giờ', { timeout: 90000 }, async () => {
  await run('reminder-be-tat', 6, async app => {
    await H.spyNotifications(app);
    // Linux/xvfb không có dbus -> isSupported()=false; ép true để kiểm đường gọi (Windows thật luôn true).
    await app.main((c, e) => { e.Notification.isSupported = () => true; return true; });
    const supported = true;
    await app.main(c => { c.settings().mascotEnabled = false; c.notes.broadcastSettings(); return true; });
    const id = await H.makeDueNote(app, 'nộp báo cáo tuần', 3000);
    await waitFor(async () => (await H.getNote(app, id)).reminder.fired, { timeout: 15000, msg: 'fired' });
    await H.sleep(1500);
    const ns = await H.notifs(app);
    console.log('# 5: isSupported=' + supported + ' notifs=' + JSON.stringify(ns));
    if (!supported) assert.fail('Notification.isSupported()=false trên môi trường này (xvfb) — không kiểm được');
    assert.ok(ns.length >= 1, 'bé tắt mà không có thông báo dự phòng');
    assert.ok(ns.some(x => /nộp báo cáo/.test(x.title)), 'tiêu đề thông báo: ' + JSON.stringify(ns));
  });
});

// ---------------------------------------------------------------- 6. hai nhắc cùng lúc -> xếp hàng
test('6. hai nhắc cùng lúc: xếp hàng, bấm Xong lần lượt, không mất cái nào', { timeout: 120000 }, async () => {
  await run('reminder-hai-nhac', 6, async app => {
    const a = await H.makeDueNote(app, 'họp nhóm A', 4000);
    const b = await H.makeDueNote(app, 'gọi khách B', 4000);
    await waitFor(async () => (await H.getNote(app, a)).reminder.fired && (await H.getNote(app, b)).reminder.fired, { timeout: 15000, msg: 'cả hai fired' });
    await H.sleep(2500);
    const s1 = await H.stageNow(app);
    assert.ok(s1 && s1.kind === 'due', 'không có mục due đang diễn');
    const qsize = await H.stageSize(app);
    assert.strictEqual(qsize, 1, 'hàng đợi còn ' + qsize + ' (kỳ vọng 1 mục đang chờ)');
    await app.shot('reminder-hai-nhac');
    const first = s1.payload.noteId, second = first === a ? b : a;
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await H.getNote(app, first)).reminder.done, { timeout: 8000, msg: 'xong cái 1' });
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.payload.noteId === second; }, { timeout: 10000, msg: 'cái 2 lên sân khấu' });
    await H.sleep(1500);
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await H.getNote(app, second)).reminder.done, { timeout: 8000, msg: 'xong cái 2' });
  });
});

// ---------------------------------------------------------------- 7. (lượt 2) một note có 2 giờ -> 2 nhắc độc lập
const remsOf = async (app, id) => (await H.getNote(app, id)).reminders || [];
test('7. note "họp 1 phút nữa / gọi khách 3 phút nữa": đủ 2 nhắc, bấm Xong từng cái độc lập', { timeout: 150000 }, async () => {
  await run('l2-reminder-2gio', 6, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'họp 1 phút nữa');
    await page.keyboard.press('Enter');
    await page.keyboard.type('gọi khách 3 phút nữa');
    await H.sleep(1200);
    let rs = await remsOf(app, id);
    console.log('# 7: reminders=' + JSON.stringify(rs.map(r => ({ id: r.id, title: r.title, in: Math.round((r.due - Date.now()) / 1000) + 's' }))));
    assert.strictEqual(rs.length, 2, 'cần 2 nhắc cho 2 giờ trong note, có ' + rs.length);
    assert.notStrictEqual(rs[0].id, rs[1].id, 'id nhắc trùng');
    const n0 = await H.getNote(app, id);
    assert.strictEqual(n0.reminder.id, rs[0].id, 'note.reminder phải là nhắc gần nhất (primary)');
    // rút ngắn: nhắc 1 sau 3s, nhắc 2 sau 12s (vẫn tách rời nhau)
    const [ra, rb] = rs.map(r => r.id);
    await app.main((c, e, a) => {
      const x = c.findNote(a.id); const now = Date.now();
      x.reminders.find(r => r.id === a.ra).due = now + 3000; x.reminders.find(r => r.id === a.rb).due = now + 12000;
      for (const r of x.reminders) { r.preFired = true; r.fired = false; r.done = false; }
      c.store.save(); return true;
    }, { id, ra, rb });
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.kind === 'due' && s.payload.noteId === id && s.payload.reminderId === ra; }, { timeout: 15000, msg: 'nhắc 1 lên sân khấu' });
    await H.sleep(2500);
    await app.shot('l2-reminder-2gio-nhac1');
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await remsOf(app, id)).find(r => r.id === ra).done === true, { timeout: 8000, msg: 'nhắc 1 done' });
    rs = await remsOf(app, id);
    assert.strictEqual(rs.find(r => r.id === rb).done, false, 'Xong nhắc 1 không được đánh dấu xong nhắc 2');
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.payload && s.payload.noteId === id && s.payload.reminderId === rb; }, { timeout: 20000, msg: 'nhắc 2 lên sân khấu' });
    await H.sleep(2500);
    await app.shot('l2-reminder-2gio-nhac2');
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await remsOf(app, id)).every(r => r.done), { timeout: 8000, msg: 'cả hai done' });
    // lưu xuống đĩa đủ 2 nhắc
    await app.flush();
    const saved = app.readData().notes.find(n => n.id === id);
    assert.strictEqual(saved.reminders.length, 2, 'file dữ liệu thiếu reminders[]');
  });
});

test('7c. hai nhắc cùng note chín sát nhau (nhắc 2 tới khi nhắc 1 còn trên sân khấu): Xong nhắc 1 không làm mất nhắc 2', { timeout: 120000 }, async () => {
  // Tái hiện tất định cho ca 7: mascotWindow.dropNote huỷ mọi mục sân khấu của note (bỏ qua reminderId) khi reminder:done.
  await run('l3-reminder-2gio-sat', 6, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'họp 1 phút nữa');
    await page.keyboard.press('Enter');
    await page.keyboard.type('gọi khách 3 phút nữa');
    await H.sleep(1200);
    const rs = await remsOf(app, id);
    assert.strictEqual(rs.length, 2, 'cần 2 nhắc');
    const [ra, rb] = rs.map(r => r.id);
    await app.main((c, e, a) => {
      const x = c.findNote(a.id); const now = Date.now();
      x.reminders.find(r => r.id === a.ra).due = now + 2000; x.reminders.find(r => r.id === a.rb).due = now + 4000;
      for (const r of x.reminders) { r.preFired = true; r.fired = false; r.done = false; }
      c.store.save(); c.notes.wakeReminderLoop(); return true;
    }, { id, ra, rb });
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.kind === 'due' && s.payload.reminderId === ra; }, { timeout: 20000, msg: 'nhắc 1 lên sân khấu' });
    await waitFor(async () => (await remsOf(app, id)).find(r => r.id === rb).fired === true, { timeout: 20000, msg: 'nhắc 2 đã fired (xếp hàng)' });
    await H.sleep(1000);
    await H.clickPetButton(app, 'done');
    await waitFor(async () => (await remsOf(app, id)).find(r => r.id === ra).done === true, { timeout: 8000, msg: 'nhắc 1 done' });
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.payload && s.payload.reminderId === rb; }, { timeout: 20000, msg: 'nhắc 2 lên sân khấu (bị mất khỏi hàng đợi?)' });
  });
});

test('7b. note bị cất (visible=false) có 2 giờ: cả hai nhắc vẫn kêu đúng hạn', { timeout: 120000 }, async () => {
  await run('l2-reminder-2gio-an', 6, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'họp 1 phút nữa');
    await page.keyboard.press('Enter');
    await page.keyboard.type('gọi khách 3 phút nữa');
    await H.sleep(1200);
    const rs = await remsOf(app, id);
    assert.strictEqual(rs.length, 2, 'cần 2 nhắc, có ' + rs.length);
    await app.main((c, e, a) => {
      c.notes.hideNote(a.id);
      const x = c.findNote(a.id); const now = Date.now();
      x.reminders[0].due = now + 3000; x.reminders[1].due = now + 5000;
      for (const r of x.reminders) { r.preFired = true; r.fired = false; r.done = false; }
      c.store.save(); return true;
    }, { id });
    assert.strictEqual((await H.getNote(app, id)).visible, false);
    await waitFor(async () => (await remsOf(app, id)).every(r => r.fired), { timeout: 20000, msg: 'cả hai nhắc fired khi note ẩn' });
    await waitFor(async () => { const s = await H.stageNow(app); return s && s.payload && s.payload.noteId === id; }, { timeout: 10000, msg: 'bé nhắc dù note ẩn' });
    await H.sleep(2000); await app.shot('l2-reminder-2gio-an');
    assert.strictEqual((await H.getNote(app, id)).visible, false, 'nhắc không được tự bật note lên');
  });
});

// ---------------------------------------------------------------- 8. BUG-025: chip không được nói "báo trước 5 phút" khi hạn chỉ còn 2 phút
test('8. "gọi khách 2 phút nữa": chip không ghi "báo trước" dài hơn thời gian còn lại', { timeout: 60000 }, async () => {
  await run('l2-reminder-chip-lead', 6, async app => {
    const { id, page } = await H.newNoteViaShortcut(app);
    await H.typeInto(page, 'gọi khách 2 phút nữa');
    await H.sleep(900);
    const note = await H.getNote(app, id);
    const chip = await page.evaluate(() => document.getElementById('chipText').textContent);
    console.log('# 8: lead=' + (note.reminder && note.reminder.lead) + ' chip=' + chip);
    assert.ok(note.reminder, 'không có nhắc');
    assert.ok(note.reminder.lead <= note.reminder.due - Date.now() + 1000, 'lead ' + note.reminder.lead / 60000 + ' phút > thời gian còn lại; chip="' + chip + '"');
    const m = /báo trước (\d+) phút/.exec(chip);
    if (m) assert.ok(+m[1] * 60000 <= note.reminder.due - Date.now() + 1000, 'chip "' + chip + '" hứa báo trước quá thời gian còn lại');
  });
});
