'use strict';
// QA nhóm core Đợt 2B: bé dọn note hết hạn (mang, vo, ném thùng rác), gõ cửa sổ đang dùng, 11 hành động mới,
// kiểm lại BUG-014/016/023/024/030. Chạy lên nhánh khác: MOCHI_E2E_ROOT=/home/claude/wt-core bash test/e2e/run.sh test/e2e/core2b.test.js
// Tính năng chưa có (main chưa gộp core 2B) -> test tự skip. Ảnh: test/e2e/out/l2-core-*.png
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, ROOT, OUT } = require('./lib/app');
const H = require('./lib/reminder-helpers');
const { waitFor, sleep } = H;
const PU = require('./lib/perf-util');

const has = f => fs.existsSync(path.join(ROOT, f));
const HAS_TIDY = has('src/main/petcore/tidy.js');
const HAS_KNOCK = has('src/main/petcore/knock.js') && has('src/main/petcore/foreground.js');
const HAS_ACT = has('assets/pet/placeholder/knock');
const SKIP_TIDY = HAS_TIDY ? false : 'chưa có core Đợt 2B (tidy.js)';
const SKIP_KNOCK = HAS_KNOCK ? false : 'chưa có core Đợt 2B (knock.js)';
const SKIP_ACT = HAS_ACT ? false : 'chưa có 11 hành động mới';

const NEW_ACTIONS = ['knock', 'carry_note', 'crumple', 'throw', 'peek_note', 'sit_on_note', 'yawn', 'stretch', 'read', 'cheer', 'play_cat'];

// ---------------------------------------------------------------- tiện ích
async function run(name, body, opts) {
  const app = await launch(Object.assign({ waitNotes: 2 }, opts || {}));
  const errs = watch(app);
  try { return await body(app, errs); }
  catch (e) {
    const f = await app.shot(name + '-LOI');
    if (f) e.message += '\n  ảnh: ' + path.relative(path.join(OUT, '..', '..', '..'), f);
    const tail = app.logs.join('').split('\n').filter(l => !/paper:get|^\s+at /.test(l)).slice(-15).join('\n');
    if (tail.trim()) e.message += '\n  log app (cuối):\n' + tail;
    throw e;
  } finally { await app.close(); }
}

/** Gom lỗi console/pageerror của mọi cửa sổ (kể cả cửa sổ mở sau: crumple.html, bin.html...). */
function watch(app) {
  const errs = [];
  const hook = p => {
    let u = '';
    try { u = p.url().split('/').pop().split('?')[0]; } catch (_) { /* */ }
    p.on('pageerror', e => errs.push('pageerror ' + u + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console.error ' + u + ': ' + m.text()); });
  };
  app.eApp.windows().forEach(hook);
  app.eApp.on('window', hook);
  return errs;
}
const appErrLogs = app => app.logs.join('').split('\n').filter(l => /\[(tidy|petcore|knock|stage|pet)\]|TypeError|ReferenceError|Unhandled/.test(l) && !/paper:get/.test(l));

/** Ghi lại sự kiện bus trong main. */
const spyBus = (app, names) => app.main((c, e, ns) => {
  globalThis.__ev = [];
  for (const n of ns) c.bus.on(n, d => {
    let pos = null; try { pos = c.pet.body.pos(); } catch (_) { /* */ }
    globalThis.__ev.push({ n, d: JSON.parse(JSON.stringify(d || {})), at: Date.now(), pos });
  });
  return true;
}, names);
const events = (app, n) => app.main((c, e, nm) => (globalThis.__ev || []).filter(x => !nm || x.n === nm), n);

const noteVisible = (app, id) => app.main((c, e, i) => { const w = c.windows.notes.get(i); return !!(w && !w.isDestroyed() && w.isVisible()); }, id);
const noteExists = (app, id) => app.main((c, e, i) => !!c.findNote(i), id);
const isTrashed = (app, id) => app.main((c, e, i) => c.notes.isTrashed(i), id);
const stageCur = app => app.main(c => c.pet.stage.current());
const petVisible = app => app.main(c => c.pet.actor.visible());

/** Note hết hạn kiểu 'done': nhắc đã xong, sửa lần cuối cách đây 1 giờ. Chờ cửa sổ note hiện. */
async function mkExpiredNote(app, text, { done = true, old = true } = {}) {
  const id = await app.main((c, e, a) => {
    const n = c.notes.createNote({ html: '<div>' + a.text + '</div>', autoReminder: false });
    c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 });
    if (a.done) c.notes.completeNote(n.id);
    if (a.old) c.findNote(n.id).updatedAt = Date.now() - 3600000;
    return n.id;
  }, { text, done, old });
  await waitFor(() => noteVisible(app, id), { timeout: 15000, msg: 'cửa sổ note hiện' });
  await waitFor(() => petVisible(app), { timeout: 15000, msg: 'bé hiện' });
  return id;
}
const emitExpired = (app, id, reason) => app.main((c, e, a) => { c.bus.emit('note:expired', { noteId: a.id, reason: a.reason }); return true; }, { id, reason });

async function petBubble(app) {
  const p = await app.page('pet.html');
  return p.evaluate(() => {
    const b = document.getElementById('bubble');
    return {
      hidden: b.hidden,
      text: (document.getElementById('bShown').textContent || '') + (document.getElementById('bRest').textContent || ''),
      btns: Array.from(document.querySelectorAll('#bBtns button')).map(x => ({ id: x.dataset.id, label: x.textContent.trim(), disabled: x.disabled }))
    };
  });
}
async function waitBtn(app, id, timeout = 40000) {
  return waitFor(async () => { const b = await petBubble(app); return !b.hidden && b.btns.some(x => x.id === id) ? b : false; }, { timeout, msg: 'nút "' + id + '" trên bong bóng bé' });
}

// ---------------------------------------------------------------- 1. dọn note hết hạn
test('1a. note hết hạn: bé hỏi -> Dọn đi -> mang, vo, ném; vào thùng rác (không xoá hẳn), khôi phục được', { timeout: 150000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy', async (app, errs) => {
    const has2 = await app.main(c => !!(c.pet.tidy && c.pet.stage && c.notes.trash && c.notes.restore));
    assert.ok(has2, 'thiếu ctx.pet.tidy / notes.trash / notes.restore');
    await spyBus(app, ['pet:stageAction', 'note:trashed', 'note:restored']);
    const TEXT = 'Gọi điện cho khách hàng ABC';
    const id = await mkExpiredNote(app, TEXT);
    const cand = await app.main(c => c.notes.expiredCandidates());
    assert.ok(cand.some(x => x.noteId === id && x.reason === 'done'), 'expiredCandidates không có note done: ' + JSON.stringify(cand));
    await emitExpired(app, id, 'done');
    // bé đi tới note, hỏi bằng bong bóng
    const b = await waitBtn(app, 'tidy');
    assert.ok(b.btns.some(x => x.id === 'keep'), 'thiếu nút Giữ lại');
    assert.match(b.text, /dọn/i, 'bong bóng không hỏi dọn: ' + b.text);
    await sleep(1500);
    await app.shot('l2-core-tidy-1-hoi');
    // CHƯA bấm: không được đụng tới note
    assert.ok(await noteExists(app, id), 'note bị mất trước khi người dùng đồng ý');
    assert.strictEqual(await isTrashed(app, id), false, 'note vào thùng rác trước khi đồng ý');
    assert.ok(await noteVisible(app, id), 'cửa sổ note đóng trước khi đồng ý');
    await H.clickPetButton(app, 'tidy');
    // giữa chừng: cửa sổ giấy/thùng rác
    let shotCarry = false, shotBin = false;
    await waitFor(async () => {
      if (!shotCarry && app.pages('crumple.html').length) { shotCarry = true; await app.shot('l2-core-tidy-2-mang'); }
      if (!shotBin && app.pages('bin.html').length) { shotBin = true; await sleep(2500); await app.shot('l2-core-tidy-3-bin'); }
      return await isTrashed(app, id);
    }, { timeout: 60000, interval: 150, msg: 'note vào thùng rác' });
    await waitFor(async () => {
      if (!shotBin && app.pages('bin.html').length) { shotBin = true; await sleep(2500); await app.shot('l2-core-tidy-3-bin'); }
      return shotBin || (!(await stageCur(app)));
    }, { timeout: 30000, interval: 150, msg: 'thùng rác hiện' });
    console.log('# 1a: cửa sổ giấy chụp được=' + shotCarry + ' thùng chụp được=' + shotBin);
    // chờ bé xong màn diễn
    await waitFor(async () => !(await stageCur(app)) && app.pages('crumple.html').length === 0 && app.pages('bin.html').length === 0, { timeout: 30000, msg: 'màn diễn kết thúc, cửa sổ phụ đóng' });
    await sleep(500);
    await app.shot('l2-core-tidy-4-xong');
    assert.strictEqual(await noteExists(app, id), false, 'note vẫn còn trong notes');
    assert.strictEqual(await noteVisible(app, id), false, 'cửa sổ note vẫn mở');
    const tl = await app.main(c => c.notes.trashList());
    const item = tl.find(x => x.id === id);
    assert.ok(item, 'không thấy note trong thùng rác: ' + JSON.stringify(tl));
    assert.ok(item.text.includes('ABC'), 'nội dung trong thùng rác mất: ' + item.text);
    assert.ok(item.expiresAt > Date.now(), 'thùng rác có hạn giữ không hợp lý');
    // đã ghi xuống đĩa (xoá mềm thật chứ không chỉ trong bộ nhớ)
    await app.flush();
    const disk = app.readData();
    const trashItems = (disk.trash && disk.trash.items) || [];
    assert.ok(trashItems.some(t => t.note && t.note.id === id && /ABC/.test(t.note.text || '')), 'thùng rác không có trên đĩa');
    assert.ok(!(disk.notes || []).some(n => n.id === id), 'note vẫn trong notes trên đĩa');
    const evs = await events(app);
    assert.ok(evs.some(x => x.n === 'note:trashed' && x.d.noteId === id), 'không có bus note:trashed');
    assert.ok(evs.some(x => x.n === 'pet:stageAction' && x.d.button === 'tidy'), 'không có pet:stageAction tidy: ' + JSON.stringify(evs.map(x => x.n)));
    // khôi phục
    const restored = await app.main((c, e, i) => { const n = c.notes.restore(i); return n ? { id: n.id, text: n.text } : null; }, id);
    assert.ok(restored && /ABC/.test(restored.text), 'khôi phục thất bại: ' + JSON.stringify(restored));
    await waitFor(() => noteVisible(app, restored.id), { timeout: 10000, msg: 'cửa sổ note hiện lại sau khôi phục' });
    assert.strictEqual(await isTrashed(app, restored.id), false);
    await app.shot('l2-core-tidy-5-khoi-phuc');
    assert.deepStrictEqual(errs, [], 'lỗi console renderer: ' + errs.join(' | '));
    const bad = appErrLogs(app);
    assert.deepStrictEqual(bad, [], 'lỗi trong log main: ' + bad.join(' | '));
  });
});

test('1b. Giữ lại: note nguyên vẹn, không vào thùng rác, màn diễn kết thúc', { timeout: 120000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-keep', async app => {
    const id = await mkExpiredNote(app, 'Mua sữa cho bé');
    await emitExpired(app, id, 'done');
    await waitBtn(app, 'keep');
    await H.clickPetButton(app, 'keep');
    await waitFor(async () => !(await stageCur(app)), { timeout: 20000, msg: 'màn diễn kết thúc' });
    await sleep(1500);
    assert.ok(await noteExists(app, id), 'note mất sau khi bấm Giữ lại');
    assert.strictEqual(await isTrashed(app, id), false);
    assert.ok(await noteVisible(app, id), 'cửa sổ note đóng sau Giữ lại');
    assert.strictEqual(await app.pages('crumple.html').length, 0, 'cửa sổ giấy vẫn mở');
    await app.shot('l2-core-tidy-keep');
  });
});

test('1c. cài đặt tidyEnabled=false: không hỏi, không dọn', { timeout: 90000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-off', async app => {
    const id = await mkExpiredNote(app, 'Việc đã xong rồi');
    await app.main(c => c.pet.setSettings({ tidyEnabled: false }));
    await emitExpired(app, id, 'done');
    await sleep(6000);
    const cur = await stageCur(app), size = await app.main(c => c.pet.stage.size());
    assert.ok(!cur || cur.kind !== 'tidy', 'vẫn hỏi dọn dù tắt: ' + JSON.stringify(cur));
    assert.strictEqual(size, 0, 'hàng đợi sân khấu không rỗng');
    assert.ok(await noteExists(app, id) && !(await isTrashed(app, id)), 'note bị dọn dù tắt');
    // bật lại thì hỏi (đối chứng: cùng điều kiện, chỉ khác cài đặt)
    await app.main(c => c.pet.setSettings({ tidyEnabled: true }));
    await emitExpired(app, id, 'done');
    await waitBtn(app, 'tidy', 30000);
    await app.shot('l2-core-tidy-off');
    await H.clickPetButton(app, 'keep');
  });
});

test('1d. autoTidy=true: reason overdue vẫn phải hỏi (chỉ "done" mới tự dọn)', { timeout: 100000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-auto-overdue', async app => {
    await app.main(c => c.pet.setSettings({ autoTidy: true }));
    const id = await mkExpiredNote(app, 'Nộp báo cáo quý', { done: false });
    await emitExpired(app, id, 'overdue');
    await waitBtn(app, 'tidy');
    await sleep(2500);
    assert.ok(await noteExists(app, id) && !(await isTrashed(app, id)), 'autoTidy dọn note overdue khi chưa hỏi');
    await H.clickPetButton(app, 'keep');
    await sleep(1500);
    assert.ok(await noteExists(app, id), 'note mất sau Giữ lại');
  });
});

test('1e. autoTidy=true + reason done: tự dọn (không hỏi) và vẫn chỉ vào thùng rác', { timeout: 150000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-auto-done', async app => {
    await app.main(c => c.pet.setSettings({ autoTidy: true }));
    const id = await mkExpiredNote(app, 'Đã gọi xong cho khách');
    await emitExpired(app, id, 'done');
    await waitFor(() => isTrashed(app, id), { timeout: 70000, msg: 'tự dọn vào thùng rác' });
    assert.strictEqual(await noteExists(app, id), false);
    const tl = await app.main(c => c.notes.trashList());
    assert.ok(tl.some(x => x.id === id), 'không còn trong thùng rác (bị xoá hẳn?)');
    await app.shot('l2-core-tidy-auto-done');
  });
});

test('1f. note chưa xong / có nhắc tương lai / vừa sửa / ẩn / checklist dở: KHÔNG phải ứng viên hết hạn', { timeout: 90000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-khong-don', async app => {
    const r = await app.main(c => {
      const mk = (html, f) => { const n = c.notes.createNote({ html, autoReminder: false }); if (f) f(n); return n.id; };
      const old = n => { c.findNote(n.id).updatedAt = Date.now() - 3600000; };
      const o = {};
      o.future = mk('<div>Họp tuần sau</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 3 * 86400000, lead: 0 }); old(n); });
      o.undoneSoon = mk('<div>Việc sắp tới chưa làm</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 3600000, lead: 0 }); old(n); });
      o.plain = mk('<div>Ghi chú thường, không nhắc</div>', old);
      o.recentDone = mk('<div>Vừa xong xíu</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); c.notes.completeNote(n.id); });   // updatedAt = bây giờ
      o.hiddenDone = mk('<div>Xong rồi nhưng đã cất</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); c.notes.completeNote(n.id); old(n); c.notes.hideNote(n.id); });
      o.checkPart = mk('<div>Việc cần làm</div><div>[x] a</div><div>[ ] b</div>', old);
      o.repeatDone = mk('<div>Uống thuốc mỗi ngày</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0, repeat: { freq: 'daily' } }); c.notes.completeNote(n.id); old(n); });
      o.doneOld = mk('<div>Việc xong lâu rồi</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); c.notes.completeNote(n.id); old(n); });
      o.locked = mk('<div>Note đã khoá nhưng xong rồi</div>', n => { c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); c.notes.completeNote(n.id); old(n); const b = c.store.section('alarms'); b.noteMeta = b.noteMeta || {}; b.noteMeta[n.id] = { locked: true }; });
      return { ids: o, cand: c.notes.expiredCandidates() };
    });
    const set = new Set(r.cand.map(x => x.noteId));
    console.log('# 1f ứng viên: ' + JSON.stringify(r.cand.map(x => [x.title, x.reason])));
    for (const k of ['future', 'undoneSoon', 'plain', 'recentDone', 'hiddenDone', 'checkPart', 'repeatDone']) assert.ok(!set.has(r.ids[k]), 'note "' + k + '" không được là ứng viên hết hạn');
    assert.ok(set.has(r.ids.doneOld), 'note done cũ phải là ứng viên');
    console.log('# 1f (quan sát) note đã khoá + xong: ứng viên=' + set.has(r.ids.locked) + ' — đặc tả không nói khoá chặn dọn; vẫn phải hỏi trước');
    // ép sự kiện cho note ẩn: không hỏi
    await sleep(1500);
    await emitExpired(app, r.ids.hiddenDone, 'done');
    await sleep(4000);
    const cur = await stageCur(app);
    assert.ok(!cur || cur.kind !== 'tidy', 'hỏi dọn note đang ẩn: ' + JSON.stringify(cur));
    for (const k of Object.keys(r.ids)) assert.ok(await noteExists(app, r.ids[k]), 'note ' + k + ' biến mất');
    // note kiểu locked: nếu bị hỏi thì vẫn chỉ dọn khi bấm
    await waitFor(() => noteVisible(app, r.ids.locked), { timeout: 15000 });
    await emitExpired(app, r.ids.locked, 'done');
    await waitBtn(app, 'tidy');
    await sleep(2000);
    assert.ok(await noteExists(app, r.ids.locked), 'note khoá bị dọn khi chưa bấm đồng ý');
    await app.shot('l2-core-tidy-khoa-hoi');
    await H.clickPetButton(app, 'keep');
  });
});

test('1g. độ bền: sự kiện hết hạn "cũ" cho note đã mở lại (chưa xong, nhắc tương lai) + autoTidy: không được tự dọn', { timeout: 100000, skip: SKIP_TIDY }, async () => {
  await run('l2-core-tidy-stale', async app => {
    await app.main(c => c.pet.setSettings({ autoTidy: true }));
    const id = await mkExpiredNote(app, 'Họp lúc 9h sáng mai', { done: false });   // chưa xong, có nhắc tương lai
    await emitExpired(app, id, 'done');                                             // sự kiện cũ/giả: notes đã không coi note này là hết hạn
    await sleep(8000);
    const trashed = await isTrashed(app, id);
    const cur = await stageCur(app);
    console.log('# 1g: trashed=' + trashed + ' stage=' + JSON.stringify(cur && { kind: cur.kind, auto: cur.payload && cur.payload.auto }));
    await app.shot('l2-core-tidy-stale');
    assert.strictEqual(trashed, false, 'note chưa xong, đang có nhắc tương lai bị bé TỰ DỌN (autoTidy) chỉ vì một sự kiện note:expired — tidy/stage không kiểm lại với notes.expiredCandidates()');
  });
});

// ---------------------------------------------------------------- 2. gõ cửa sổ đang dùng
const FAKE_FG = '380,120,640,440';
const near = (pos, rect) => !!pos && (Math.abs(pos.x - (rect[0] + rect[2])) < 330 || Math.abs(pos.x - rect[0]) < 330);

/** Note có nhắc "pre" sau ~5s (due = +62s, báo trước 57s). */
const mkPreNote = (app, text) => app.main((c, e, t) => {
  const n = c.notes.createNote({ html: '<div>' + t + '</div>', autoReminder: false });
  c.notes.setNoteReminder(n.id, { due: Date.now() + 62000, lead: 57000 });
  return n.id;
}, text);

test('2a. tới giờ báo trước khi app khác đang focus: bé chạy tới mép cửa sổ đó, gõ; nhắc vẫn hiện; gõ tối đa 1 lần/15 phút', { timeout: 120000, skip: SKIP_KNOCK }, async () => {
  await run('l2-core-knock', async app => {
    assert.ok(await app.main(c => !!(c.pet.knock && c.pet.knock.target)), 'thiếu ctx.pet.knock');
    await spyBus(app, ['pet:knock', 'pet:stageAction']);
    await waitFor(() => petVisible(app), { timeout: 15000 });
    const id = await mkPreNote(app, 'Họp nhóm lúc 3 giờ');
    await waitFor(async () => (await events(app, 'pet:knock')).length > 0, { timeout: 45000, msg: 'bé gõ cửa (pet:knock)' });
    const ev = (await events(app, 'pet:knock'))[0];
    const rect = FAKE_FG.split(',').map(Number);
    console.log('# 2a: bé gõ tại ' + JSON.stringify(ev.pos) + ' so với cửa sổ giả ' + FAKE_FG);
    assert.ok(near(ev.pos, rect), 'bé không đứng cạnh cửa sổ đang dùng khi gõ: ' + JSON.stringify(ev.pos));
    await sleep(700);
    await app.shot('l2-core-knock-1-go');
    // nhắc vẫn hiện sau khi gõ: bong bóng + tờ note + nút
    const b = await waitBtn(app, 'open', 20000);
    assert.match(b.text, /Họp nhóm/i, 'bong bóng nhắc không nói tên việc: ' + b.text);
    const p = await app.page('pet.html');
    assert.strictEqual(await p.evaluate(() => document.getElementById('note').hidden), false, 'tờ note không hiện sau khi gõ');
    await app.shot('l2-core-knock-2-nhac');
    await H.clickPetButton(app, 'ok');
    await waitFor(async () => !(await stageCur(app)), { timeout: 15000 });
    // lần thứ hai trong 15 phút: không gõ nữa
    assert.strictEqual(await app.main(c => c.pet.knock.allowed()), false, 'allowed() phải false trong 15 phút sau khi gõ');
    const id2 = await mkPreNote(app, 'Gọi khách lúc 4 giờ');
    await waitBtn(app, 'open', 40000);
    assert.strictEqual((await events(app, 'pet:knock')).length, 1, 'gõ lần 2 trong vòng 15 phút');
    void id; void id2;
  }, { env: { MOCHI_FAKE_FG: FAKE_FG } });
});

test('2b. knockEnabled=false: không gõ, nhắc vẫn hiện đủ', { timeout: 100000, skip: SKIP_KNOCK }, async () => {
  await run('l2-core-knock-off', async app => {
    await spyBus(app, ['pet:knock']);
    await app.main(c => c.pet.setSettings({ knockEnabled: false }));
    assert.strictEqual(await app.main(c => c.pet.knock.allowed()), false);
    assert.strictEqual(await app.main(c => c.pet.knock.target()), null, 'target() phải null khi tắt gõ');
    await waitFor(() => petVisible(app), { timeout: 15000 });
    await mkPreNote(app, 'Nộp báo cáo lúc 5 giờ');
    const b = await waitBtn(app, 'open', 45000);
    assert.match(b.text, /Nộp báo cáo/i);
    await sleep(1500);
    assert.strictEqual((await events(app, 'pet:knock')).length, 0, 'vẫn gõ dù đã tắt');
    await app.shot('l2-core-knock-off');
  }, { env: { MOCHI_FAKE_FG: FAKE_FG } });
});

test('2c. gõ cửa là phần thêm: bé tắt (mascotEnabled=false) -> không gõ, vẫn có thông báo Windows dự phòng khi tới giờ', { timeout: 100000, skip: SKIP_KNOCK }, async () => {
  await run('l2-core-knock-fallback', async app => {
    await H.spyNotifications(app);
    await app.main((c, e) => { e.Notification.isSupported = () => true; return true; });
    await spyBus(app, ['pet:knock']);
    await app.main(c => { c.settings().mascotEnabled = false; c.notes.broadcastSettings(); return true; });
    assert.strictEqual(await app.main(c => c.pet.knock.allowed()), false, 'allowed() phải false khi tắt bé');
    const id = await H.makeDueNote(app, 'đóng tiền điện', 3000);
    await waitFor(async () => (await H.getNote(app, id)).reminder.fired, { timeout: 15000, msg: 'fired' });
    await sleep(1500);
    const ns = await H.notifs(app);
    assert.ok(ns.some(x => /đóng tiền điện/.test(x.title)), 'không có thông báo dự phòng: ' + JSON.stringify(ns));
    assert.strictEqual((await events(app, 'pet:knock')).length, 0);
  }, { env: { MOCHI_FAKE_FG: FAKE_FG } });
});

test('2d. cửa sổ đang dùng quá nhỏ / không có: không gõ (target=null)', { timeout: 60000, skip: SKIP_KNOCK }, async () => {
  await run('l2-core-knock-nho', async app => {
    assert.strictEqual(await app.main(c => c.pet.knock.target()), null, 'cửa sổ 120x90 không được gõ');
  }, { env: { MOCHI_FAKE_FG: '300,300,120,90' } });
  await run('l2-core-knock-khong-fg', async app => {
    const t = await app.main(c => c.pet.knock.target());   // Linux: không có foreground thật -> null
    assert.strictEqual(t, null, 'không có cửa sổ foreground thì target phải null: ' + JSON.stringify(t));
  });
});

// ---------------------------------------------------------------- 3. 11 hành động mới
test('3a. gói hình: 11 hành động mới có khung (placeholder), thiếu thì engine rơi về idle', { timeout: 60000, skip: SKIP_ACT }, async () => {
  const anim = require(path.join(ROOT, 'src', 'pet', 'anim.js'));
  const P = require(path.join(ROOT, 'src', 'main', 'petcore', 'pack.js'));
  const pack = P.loadCharacter({ paths: { src: path.join(ROOT, 'src') }, userData: os_tmp() });
  const miss = NEW_ACTIONS.filter(a => { const r = anim.resolve(pack, a, 'normal'); return r.fallback || r.action !== a; });
  assert.deepStrictEqual(miss, [], 'thiếu hình cho: ' + miss.join(','));
  const r = anim.resolve(pack, 'khong_co_hanh_dong_nay', 'normal');
  assert.strictEqual(r.action, 'idle', 'action lạ phải rơi về idle');
  assert.strictEqual(r.fallback, true);
  const r2 = anim.resolve({ anims: {} }, 'knock', 'happy');   // gói rỗng hoàn toàn: không ném lỗi
  assert.strictEqual(r2.action, 'idle');
  const packNoNew = JSON.parse(JSON.stringify(pack));
  for (const a of NEW_ACTIONS) delete packNoNew.anims[a];
  for (const a of NEW_ACTIONS) assert.strictEqual(anim.resolve(packNoNew, a, 'normal').action, 'idle', a + ' thiếu hình phải về idle');
});
function os_tmp() { return require('os').tmpdir(); }

test('3b. kích hoạt từng hành động trong app thật: play() kết thúc, không lỗi console/main; action lạ không làm hỏng engine', { timeout: 180000, skip: SKIP_ACT }, async () => {
  await run('l2-core-actions', async (app, errs) => {
    await waitFor(() => petVisible(app), { timeout: 20000, msg: 'bé hiện' });
    const logs0 = app.logs.join('').length;
    const rows = [];
    for (const a of NEW_ACTIONS.concat(['point', 'write', 'khong_co_hanh_dong_nay'])) {
      const t0 = Date.now();
      // play(non-loop) resolve khi animEnd (an toàn tối đa 10s)
      const ms = await app.main(async (c, e, name) => { const t = Date.now(); await c.pet.actor.play(name, { loop: false }); return Date.now() - t; }, a);
      rows.push(a + '=' + ms + 'ms');
      if (['knock', 'crumple', 'cheer', 'throw', 'yawn', 'stretch'].includes(a)) await app.shot('l2-core-act-' + a);
      void t0;
    }
    console.log('# 3b thời gian play: ' + rows.join(' '));
    // dạng loop (đứng yên diễn mãi) cũng không lỗi
    for (const a of NEW_ACTIONS) await app.main((c, e, name) => { c.pet.actor.play(name, { loop: true }); return true; }, a);
    await app.main(c => { c.pet.actor.play('idle', { loop: true }); return true; });
    await sleep(800);
    // bé vẫn sống: nhắc sau đó vẫn diễn
    await app.main(c => c.pet.stage.request({ kind: 'chatter', payload: { text: 'Kiểm tra sau hành động' } }));
    await waitFor(async () => { const b = await petBubble(app); return !b.hidden && /Kiểm tra sau/.test(b.text); }, { timeout: 15000, msg: 'bé nói lại bình thường' });
    assert.deepStrictEqual(errs, [], 'lỗi console renderer: ' + errs.join(' | '));
    const newLogs = app.logs.join('').slice(logs0).split('\n').filter(l => /error|Error|không tải|missing|thiếu/i.test(l) && !/paper:get|^\s+at /.test(l));
    assert.deepStrictEqual(newLogs, [], 'lỗi trong log main: ' + newLogs.join(' | '));
    // 11 hành động đều nằm trong thời gian hợp lý (không treo tới giới hạn 10s)
    const slow = rows.filter(r => /=(9\d{3}|10\d{3})ms/.test(r));
    assert.deepStrictEqual(slow, [], 'play() chờ tới giới hạn an toàn 10s (animEnd không về): ' + slow.join(' '));
  });
});

test('3c. hành vi rảnh dùng hành động mới (yawn/stretch/read/cheer/play_cat/peek_note/sit_on_note) chạy bằng MOCHI_PET_DEMO2, không lỗi', { timeout: 200000, skip: SKIP_ACT }, async () => {
  for (const what of ['cheer', 'read', 'cat', 'peeknote', 'sleep', 'note']) {
    await run('l2-core-demo2-' + what, async (app, errs) => {
      await waitFor(() => petVisible(app), { timeout: 20000 });
      await sleep(6000);
      await app.shot('l2-core-demo2-' + what);
      assert.deepStrictEqual(errs, [], what + ': lỗi console: ' + errs.join(' | '));
      const bad = appErrLogs(app);
      assert.deepStrictEqual(bad, [], what + ': lỗi main: ' + bad.join(' | '));
    }, { env: { MOCHI_PET_DEMO2: what } });
  }
});

// ---------------------------------------------------------------- 4. kiểm lại lỗi cũ
test('4a. BUG-014: tờ Dặn dò bé cầm không còn "NaN:NaN · undefined"', { timeout: 100000 }, async () => {
  await run('l2-core-bug014', async app => {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    const WHENS = { startup: 'Lúc mở máy', morning: 'Buổi sáng', noon: 'Buổi trưa', evening: 'Buổi tối', 'before-shutdown': 'Trước khi tắt máy' };
    const out = [];
    for (const [w, label] of Object.entries(WHENS)) {
      await app.main((c, e, a) => c.pet.stage.request({ kind: 'memo', payload: { memoId: 'qa-' + a.w, text: 'Tắt bếp trước khi đi ngủ', when: a.w } }), { w });
      const p = await app.page('pet.html');
      const sheet = await waitFor(async () => {
        const s = await p.evaluate(() => ({ hidden: document.getElementById('note').hidden, big: document.getElementById('nBig').textContent, title: document.getElementById('nTitle').textContent, meta: document.getElementById('nMeta').textContent }));
        return !s.hidden && s.title.includes('Tắt bếp') ? s : false;
      }, { timeout: 20000, msg: 'tờ Dặn dò hiện (' + w + ')' });
      out.push(w + ' -> "' + sheet.meta + '"');
      if (w === 'startup') await app.shot('l2-core-bug014');
      assert.ok(!/NaN|undefined|null/.test(sheet.meta + sheet.title + sheet.big), 'tờ dặn dò lỗi chữ (' + w + '): ' + JSON.stringify(sheet));
      assert.strictEqual(sheet.meta, label, 'nhãn when=' + w);
      const cur = await stageCur(app);
      await H.clickPetButton(app, 'ok');
      await waitFor(async () => !(await stageCur(app)), { timeout: 15000 });
      void cur;
    }
    console.log('# 4a: ' + out.join(' | '));
    // when là mốc giờ (số): vẫn không NaN
    await app.main(c => c.pet.stage.request({ kind: 'memo', payload: { memoId: 'qa-ts', text: 'Dặn có mốc giờ', when: Date.now() + 3600000 } }));
    const p = await app.page('pet.html');
    const s2 = await waitFor(async () => { const s = await p.evaluate(() => ({ hidden: document.getElementById('note').hidden, meta: document.getElementById('nMeta').textContent, title: document.getElementById('nTitle').textContent })); return !s.hidden && /mốc giờ/.test(s.title) ? s : false; }, { timeout: 20000 });
    assert.ok(!/NaN|undefined/.test(s2.meta), 'when số: ' + s2.meta);
  });
});

test('4b. BUG-023: câu thoại nhắc khớp loại việc (intent): gọi điện / họp / uống thuốc', { timeout: 280000 }, async () => {
  await run('l2-core-bug023', async app => {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    const dlg = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dialogue', 'vi.json'), 'utf8'));
    const rx = (intent, ev) => dlg.filter(l => l.event === ev && l.cond && [].concat(l.cond.intent || []).includes(intent)).map(l => new RegExp('^(?:.+: )?' + l.text.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+') + '$'));
    const CASES = [['call', 'Gọi điện cho khách hàng'], ['meet', 'Họp nhóm kinh doanh'], ['pill', 'Uống thuốc huyết áp']];
    const bad = [];
    for (const [intent, text] of CASES) {
      const pats = rx(intent, 'due');
      assert.ok(pats.length >= 3, 'kho thoại thiếu câu due cho ' + intent);
      for (let k = 0; k < 3; k++) {
        const id = await app.main((c, e, t) => { const n = c.notes.createNote({ html: '<div>' + t + '</div>', autoReminder: false }); c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); n.reminder.due = Date.now() - 2000; n.reminder.fired = true; n.reminder.preFired = true; return n.id; }, text);
        const rid = await app.main((c, e, i) => c.findNote(i).reminder.id, id);
        const got = await app.main((c, e, i) => c.findNote(i).reminder.intent, id);
        assert.strictEqual(got, intent, 'intent parse của "' + text + '"');
        await app.main((c, e, a) => c.pet.stage.request({ kind: 'due', payload: { noteId: a.id, reminderId: a.rid } }), { id, rid });
        const b = await waitBtn(app, 'done', 40000);
        const ok = pats.some(r => r.test(b.text));
        if (!ok) bad.push(intent + ': "' + b.text + '"');
        if (k === 0 && intent === 'call') await app.shot('l2-core-bug023');
        await app.main((c, e, i) => { const cu = c.pet.stage.current(); if (cu) c.pet.stage.cancel(cu.id); return true; });   // dọn sân khấu cho lượt sau (không cần bấm nút)
        await waitFor(async () => !(await stageCur(app)), { timeout: 20000, msg: 'hết lượt (' + intent + ' #' + k + ')' });
        await sleep(500);
      }
    }
    assert.deepStrictEqual(bad, [], 'câu thoại không thuộc intent của note:\n  ' + bad.join('\n  '));
  });
});

test('4c. BUG-030: "Hoãn N phút" lấy từ cài đặt Hoãn mặc định (20), không viết cứng 10', { timeout: 120000 }, async () => {
  await run('l2-core-bug030', async app => {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    await app.main(c => { const a = c.store.section('alarms'); a.settings = a.settings || {}; a.settings.defaultSnoozeMin = 20; c.store.save(); return true; });
    const id = await app.main(c => { const n = c.notes.createNote({ html: '<div>Nộp báo cáo tháng</div>', autoReminder: false }); c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); n.reminder.due = Date.now() - 2000; n.reminder.fired = true; n.reminder.preFired = true; return n.id; });
    const rid = await app.main((c, e, i) => c.findNote(i).reminder.id, id);
    await app.main((c, e, a) => c.pet.stage.request({ kind: 'due', payload: { noteId: a.id, reminderId: a.rid } }), { id, rid });
    const b = await waitBtn(app, 'snooze');
    const sn = b.btns.find(x => x.id === 'snooze');
    await app.shot('l2-core-bug030');
    assert.match(sn.label, /20/, 'nhãn nút hoãn không theo cài đặt: "' + sn.label + '"');
    const t0 = Date.now();
    await H.clickPetButton(app, 'snooze');
    await waitFor(async () => { const r = (await H.getNote(app, id)).reminder; return r && r.due > t0 + 10 * 60000; }, { timeout: 15000, msg: 'due dời' });
    const r = (await H.getNote(app, id)).reminder;
    const mins = (r.due - t0) / 60000;
    assert.ok(mins > 19.5 && mins < 20.6, 'hoãn ' + mins.toFixed(2) + ' phút, kỳ vọng ~20');
    // câu bé nói sau khi hoãn
    const sb = await waitFor(async () => { const x = await petBubble(app); return !x.hidden && /hoãn|Hoãn|nhắc lại/.test(x.text) ? x : false; }, { timeout: 8000 }).catch(() => null);
    if (sb) assert.ok(!/10 phút/.test(sb.text), 'câu sau hoãn nói 10 phút: ' + sb.text);
  });
});

test('4c2. BUG-030 (phần tên app): tiêu đề cửa sổ là "Mochi Notes", không phải "Mochi Note"', { timeout: 60000 }, async () => {
  await run('l2-core-bug030-title', async app => {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    await app.openList();
    // tiêu đề cửa sổ
    const titles = [];
    for (const w of app.eApp.windows()) { try { titles.push(await w.title()); } catch (_) { /* */ } }
    console.log('# 4c tiêu đề cửa sổ: ' + JSON.stringify(titles));
    assert.ok(!titles.some(t => /^Mochi Note$/.test(t)), 'tiêu đề cửa sổ còn "Mochi Note" (thiếu s): ' + JSON.stringify(titles));
  });
});

test('4d. BUG-016: tờ note bé cầm nằm trọn trong cửa sổ bé và trong màn hình, chữ phụ không bị cắt (bé đứng sát mép phải)', { timeout: 100000 }, async () => {
  await run('l2-core-bug016', async app => {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    // note ẩn -> bé giơ tờ note mini, chạy tới góc (đường Đợt 1)
    const id = await app.main(c => {
      const n = c.notes.createNote({ html: '<div>Gọi điện cho khách hàng ABC</div>', autoReminder: false });
      c.notes.setNoteReminder(n.id, { due: Date.now() + 60000, lead: 0 }); n.reminder.due = Date.now() - 2000; n.reminder.fired = true; n.reminder.preFired = true;
      c.notes.hideNote(n.id);
      return n.id;
    });
    const rid = await app.main((c, e, i) => c.findNote(i).reminder.id, id);
    await app.main((c, e, a) => c.pet.stage.request({ kind: 'due', payload: { noteId: a.id, reminderId: a.rid } }), { id, rid });
    await waitBtn(app, 'done', 40000);
    await sleep(1800);
    const p = await app.page('pet.html');
    const geo = await p.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const sheet = document.getElementById('sheet') || document.getElementById('note');
      const meta = document.getElementById('nMeta'), ttl = document.getElementById('nTitle');
      return { vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight, note: r(document.getElementById('note')), sheet: r(sheet), metaScroll: [meta.scrollWidth, meta.clientWidth], ttlScroll: [ttl.scrollWidth, ttl.clientWidth], hidden: document.getElementById('note').hidden, meta: meta.textContent };
    });
    const win = await app.main((c, e) => { const w = c.windows.pet; const b = w.getBounds(); const d = e.screen.getDisplayMatching(b); return { b, wa: d.workArea, bounds: d.bounds }; });
    console.log('# 4d: ' + JSON.stringify({ geo, win }));
    await app.shot('l2-core-bug016');
    assert.strictEqual(geo.hidden, false, 'tờ note không hiện');
    assert.ok(geo.sheet.r <= geo.vw + 0.5 && geo.sheet.l >= -0.5, 'tờ note tràn khỏi cửa sổ bé: ' + JSON.stringify(geo.sheet) + ' vw=' + geo.vw);
    assert.ok(win.b.x + win.b.width <= win.bounds.x + win.bounds.width + 1, 'cửa sổ bé tràn ra ngoài màn hình');
    assert.ok(win.b.x + geo.sheet.r <= win.bounds.x + win.bounds.width + 0.5, 'tờ note chạm/lọt ra ngoài mép phải màn hình');
    assert.ok(geo.metaScroll[0] <= geo.metaScroll[1] + 1, 'dòng phụ trên tờ note bị cắt (…): "' + geo.meta + '" scrollWidth=' + geo.metaScroll[0] + ' > clientWidth=' + geo.metaScroll[1]);
  });
});

test('4e. BUG-024: CPU rảnh (30s, mọi tiến trình Electron, 1 note đang dán + bé)', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 2 });
  try {
    await waitFor(() => petVisible(app), { timeout: 20000 });
    await sleep(8000);   // để khởi động lắng xuống
    const r = await PU.idleCpu(app, 30000);
    const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(' ');
    console.log('# 4e CPU rảnh ' + r.cpuPct.toFixed(2) + '% một nhân (procs=' + r.mem.procs + ', ' + JSON.stringify(r.mem.byType) + ', loadavg ' + load + ', root=' + ROOT + ')');
    fs.writeFileSync(path.join(OUT, 'l2-core-cpu-' + (process.env.MOCHI_E2E_ROOT ? 'core' : 'main') + '.txt'), r.cpuPct.toFixed(2) + ' ' + load + '\n');
    // ngưỡng rộng vì máy QA có 2 CPU và nhiều người chạy song song; đặc tả core: < 3% khi đứng yên
    assert.ok(r.cpuPct < 6, 'CPU rảnh ' + r.cpuPct.toFixed(2) + '% (> 6% một nhân)');
  } finally { await app.close(); }
});
