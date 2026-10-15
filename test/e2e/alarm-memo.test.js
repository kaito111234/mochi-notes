'use strict';
// QA nhóm alarm-memo: báo thức + dặn dò qua GIAO DIỆN thật (tab Báo thức / Dặn dò) và chuông ring.html / popup memo.html.
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';   // cùng múi giờ với app (launch dùng TZ này)
const test = require('node:test');
const assert = require('node:assert');
const { launch, withApp, waitFor, sleep } = require('./lib/app');

const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Mở danh sách ở tab (alarms|memos) và bấm tab thật. */
async function openTab(app, tab) {
  const p = await app.openList();
  await p.waitForLoadState('domcontentloaded');
  await p.click(tab === 'alarms' ? '#tabAlarms' : '#tabMemos');
  await p.waitForSelector(tab === 'alarms' ? '#alarmView:not([hidden])' : '#memoView:not([hidden])');
  return p;
}
/** Ghi lại sự kiện bus alarm/memo trong main. */
function spyBus(app) {
  return app.main(c => {
    globalThis.__ev = [];
    for (const n of ['alarm:ring', 'alarm:stopped', 'alarm:snoozed', 'memo:due'])
      c.bus.on(n, d => globalThis.__ev.push({ n, d, t: Date.now() }));
    return true;
  });
}
const events = app => app.main(() => globalThis.__ev);
const alarms = app => app.main(c => JSON.parse(JSON.stringify(globalThis.__mochiRequire(c.paths.src + '/main/alarms/box.js').getBox(c).list)));
const box = app => app.main(c => JSON.parse(JSON.stringify(globalThis.__mochiRequire(c.paths.src + '/main/alarms/box.js').getBox(c))));

/** Tạo báo thức qua form: giờ/phút/nhãn rồi Lưu. */
async function createViaForm(p, h, m, label, repeat) {
  await p.click('#alAdd');
  await p.waitForSelector('#alSheet.open');
  await p.fill('#alH', pad(h)); await p.fill('#alM', pad(m));
  await p.fill('#alLabel', label);
  if (repeat) await p.click(`#alRep [data-v="${repeat}"]`);
  await p.click('#alSave');
  await p.waitForSelector('#alSheet:not(.open)', { state: 'attached' });
}

test('1a. báo thức 1 phút qua giao diện: tới giờ chuông ring.html hiện, bé nhận, Tắt -> tự tắt', { timeout: 170000 }, async () => {
  await withApp('am-1a', { waitNotes: 1 }, async app => {
    await sleep(3000);
    await spyBus(app);
    const p = await openTab(app, 'alarms');
    // tránh sát phút: nếu còn <8s thì đợi sang phút mới
    let now = new Date();
    if (now.getSeconds() > 50) { await sleep((61 - now.getSeconds()) * 1000); now = new Date(); }
    const t = new Date(now.getTime() + 60000);
    await createViaForm(p, t.getHours(), t.getMinutes(), 'Họp nhóm', 'once');
    const [a] = await alarms(app);
    assert.ok(a, 'báo thức đã được tạo');
    assert.strictEqual(a.label, 'Họp nhóm');
    assert.strictEqual(a.time, `${pad(t.getHours())}:${pad(t.getMinutes())}`);
    assert.strictEqual(new Date(a.nextAt).getMinutes(), t.getMinutes());
    assert.strictEqual(new Date(a.nextAt).getSeconds(), 0);
    assert.ok(await p.locator('.al-card').count() === 1, 'thẻ báo thức hiện trong danh sách');

    const ring = await app.page('ring.html', { timeout: 100000 });
    await ring.waitForLoadState('domcontentloaded');
    await waitFor(async () => (await ring.textContent('#label')).includes('Họp nhóm'), { msg: 'nhãn trên chuông' });
    assert.strictEqual((await ring.textContent('#time')).trim(), a.time);
    const late = Date.now() - a.nextAt;
    assert.ok(late < 5000, 'chuông trễ ' + late + 'ms');
    // bé nhận alarm
    await waitFor(async () => (await events(app)).some(e => e.n === 'alarm:ring'), { msg: 'bus alarm:ring' });
    const stage = await app.main(c => { const s = c.pet && c.pet.stage; const cur = s && s.current && s.current(); return cur ? { kind: cur.kind || (cur.item && cur.item.kind) } : null; });
    await app.shot('am-1a-chuong');
    const geo = await app.main((c, e) => e.BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.isVisible()).map(w => ({ t: w.getTitle(), b: w.getBounds() })));
    // báo thức một lần đã dời nextAt ngay khi kêu
    const [a2] = await alarms(app);
    assert.strictEqual(a2.enabled, false, 'báo thức một lần phải tự tắt khi kêu');
    await ring.click('#stop');
    await waitFor(async () => app.pages('ring.html').length === 0, { msg: 'chuông đóng', timeout: 8000 });
    const ev = await events(app);
    assert.ok(ev.some(e => e.n === 'alarm:stopped'));
    const [a3] = await alarms(app);
    assert.strictEqual(a3.enabled, false);
    assert.strictEqual(a3.nextAt, null);
    console.log('# stage hiện tại:', JSON.stringify(stage), ' cửa sổ hiện:', JSON.stringify(geo));
    // giao diện: thẻ ở trạng thái Đã tắt
    await waitFor(async () => (await p.locator('.al-card.off').count()) === 1, { msg: 'thẻ chuyển Đã tắt' });
    assert.match(await p.textContent('.al-left'), /Đã tắt/);
  });
});

test('1b. Hoãn: snoozedUntil đúng, kêu lại, Tắt', { timeout: 90000 }, async () => {
  await withApp('am-1b', { waitNotes: 1 }, async app => {
    await sleep(3000);
    await spyBus(app);
    const p = await openTab(app, 'alarms');
    const t = new Date(Date.now() + 3600e3);
    await createViaForm(p, t.getHours(), t.getMinutes(), 'Uống thuốc', 'daily');
    const [a] = await alarms(app);
    // rút ngắn: nextAt = 3 giây nữa
    await app.main((c, e, id) => { const x = globalThis.__mochiRequire(c.paths.src + '/main/alarms/box.js').getBox(c).list.find(z => z.id === id); x.nextAt = Date.now() + 3000; return true; }, a.id);
    const ring = await app.page('ring.html', { timeout: 20000 });
    await waitFor(async () => (await ring.textContent('#label')).includes('Uống thuốc'));
    const label = (await ring.textContent('#snooze')).trim();
    assert.match(label, /Hoãn 10 phút/, 'nút hoãn: ' + label);
    const t0 = Date.now();
    await ring.click('#snooze');
    await waitFor(async () => app.pages('ring.html').length === 0, { msg: 'chuông đóng sau Hoãn', timeout: 8000 });
    const [b] = await alarms(app);
    assert.ok(b.snoozedUntil, 'có snoozedUntil');
    assert.ok(Math.abs(b.snoozedUntil - (t0 + a.snoozeMin * 60000)) < 5000, 'snoozedUntil = bây giờ + ' + a.snoozeMin + ' phút, lệch ' + (b.snoozedUntil - t0 - a.snoozeMin * 60000));
    assert.strictEqual(b.nextAt, b.snoozedUntil);
    assert.strictEqual(b.enabled, true);
    assert.ok((await events(app)).some(e => e.n === 'alarm:snoozed'));
    await waitFor(async () => /Hoãn đến/.test(await p.textContent('.al-left')), { msg: 'thẻ hiện "Hoãn đến"' });
    // kêu lại
    await app.main((c, e, id) => { const x = globalThis.__mochiRequire(c.paths.src + '/main/alarms/box.js').getBox(c).list.find(z => z.id === id); x.nextAt = Date.now() + 2000; x.snoozedUntil = x.nextAt; return true; }, a.id);
    const ring2 = await app.page('ring.html', { timeout: 20000 });
    await waitFor(async () => (await ring2.textContent('#label')).includes('Uống thuốc'));
    const [c2] = await alarms(app);
    assert.strictEqual(c2.snoozedUntil, undefined, 'hết hoãn thì xoá snoozedUntil');
    const nx = new Date(c2.nextAt); assert.ok(c2.nextAt > Date.now() && `${pad(nx.getHours())}:${pad(nx.getMinutes())}` === a.time, 'báo thức hằng ngày dời sang lần kế đúng giờ cũ');
    await ring2.click('#stop');
    await waitFor(async () => app.pages('ring.html').length === 0, { timeout: 8000 });
  });
});

test('2. tạo nhanh bằng câu tiếng Việt: giờ/lặp/ngày đúng', { timeout: 90000 }, async () => {
  await withApp('am-2', { waitNotes: 1 }, async app => {
    const p = await openTab(app, 'alarms');
    const cases = [
      ['6h30 sáng mai dậy tập', { h: '06', m: '30', rep: 'once', date: dk(new Date(Date.now() + 86400e3)), label: /dậy tập/ }],
      ['7h mỗi ngày thường họp', { h: '07', m: '00', rep: 'weekdays', label: /họp/ }],
      ['8h tối hằng ngày uống thuốc', { h: '20', m: '00', rep: 'daily', label: /uống thuốc/ }],
      ['6h30 sáng thứ 2, thứ 4 chạy bộ', { h: '06', m: '30', rep: 'weekly', dows: ['T2', 'T4'], label: /chạy bộ/ }]
    ];
    for (const [text, exp] of cases) {
      await p.fill('#alQuickIn', text);
      await p.press('#alQuickIn', 'Enter');
      await p.waitForSelector('#alSheet.open');
      const got = { h: await p.inputValue('#alH'), m: await p.inputValue('#alM'), label: await p.inputValue('#alLabel'),
        rep: await p.getAttribute('#alRep [aria-checked="true"]', 'data-v'), date: await p.inputValue('#alDate') };
      assert.strictEqual(got.h, exp.h, text + ' -> giờ ' + JSON.stringify(got));
      assert.strictEqual(got.m, exp.m, text + ' -> phút');
      assert.strictEqual(got.rep, exp.rep, text + ' -> lặp ' + JSON.stringify(got));
      if (exp.date) assert.strictEqual(got.date, exp.date, text + ' -> ngày');
      assert.match(got.label, exp.label, text + ' -> nhãn "' + got.label + '"');
      if (exp.dows) {
        const on = await p.$$eval('#alDows .dow[aria-pressed="true"]', bs => bs.map(b => b.textContent));
        assert.deepStrictEqual(on.sort(), exp.dows.sort(), text + ' -> thứ');
      }
      await p.click('#alSave');
      await p.waitForSelector('#alSheet:not(.open)', { state: 'attached' });
    }
    const list = await alarms(app);
    assert.strictEqual(list.length, cases.length);
    const wd = list.find(a => a.time === '07:00');
    assert.deepStrictEqual(wd.repeat.freq, 'weekdays');
    const nx = new Date(wd.nextAt); assert.ok(nx.getDay() >= 1 && nx.getDay() <= 5 && nx.getHours() === 7, 'nextAt rơi vào ngày thường 07:00');
    const sixThirty = list.find(a => a.label.includes('dậy tập'));
    assert.strictEqual(dk(new Date(sixThirty.nextAt)), dk(new Date(Date.now() + 86400e3)));
    await app.shot('am-2-tao-nhanh');
  });
});

test('3. dặn dò startup: tạo qua giao diện, đóng, mở lại -> popup; mở lần nữa trong ngày không lặp', { timeout: 150000 }, async () => {
  const app = await launch({ waitNotes: 1 });
  let app2, app3;
  try {
    const p = await openTab(app, 'memos');
    await p.fill('#mmText', 'Nhớ uống nước nha');
    await p.selectOption('#mmWhen', 'startup');
    await p.click('#mmAdd button[type=submit]');
    await waitFor(async () => (await p.locator('.mm-row').count()) === 1, { msg: 'dòng dặn dò' });
    await app.flush();
    await app.close();

    app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    const memo = await app2.page('memo.html', { timeout: 40000 });
    await waitFor(async () => (await memo.textContent('#items')).includes('Nhớ uống nước nha'), { msg: 'nội dung popup' });
    await app2.shot('am-3-memo-popup');
    const m1 = (await app2.main(c => JSON.parse(JSON.stringify(c.memos.list().memos))))[0];
    assert.strictEqual(m1.lastShownDay, dk(new Date()), 'lastShownDay đặt ngay khi hiện');
    await memo.click('#btnOk');
    await waitFor(async () => app2.pages('memo.html').length === 0, { msg: 'popup đóng', timeout: 8000 });
    await app2.close();

    app3 = await launch({ configHome: app.configHome, waitNotes: 1 });
    await sleep(14000);   // startup check chạy sau ~8s
    const n = app3.pages('memo.html').length;
    console.log('# lần mở thứ 3 trong cùng ngày: popup memo =', n, '(kỳ vọng 0: lastShownDay chặn lặp)');
    assert.strictEqual(n, 0, 'không được hiện lặp trong cùng ngày');
    // hôm qua -> hiện lại
    await app3.main(c => { c.memos.list().memos[0].lastShownDay = '2000-01-01'; c.store.flushSync(); return true; });
    await app3.close();
    const app4 = await launch({ configHome: app.configHome, waitNotes: 1 });
    try { await app4.page('memo.html', { timeout: 40000 }); } finally { await app4.close(); }
  } catch (e) {
    for (const a of [app3, app2, app]) if (a) { const f = await a.shot('am-3-LOI'); if (f) { e.message += '\n  ảnh: ' + f; break; } }
    throw e;
  } finally { for (const a of [app, app2, app3]) if (a) await a.close(); }
});

test('4. báo thức: tắt/bật, sửa, xoá qua giao diện; lưu sau khi mở lại', { timeout: 120000 }, async () => {
  const app = await launch({ waitNotes: 1 });
  let app2;
  try {
    await sleep(2000);
    const p = await openTab(app, 'alarms');
    await createViaForm(p, 5, 15, 'Báo A', 'daily');
    await createViaForm(p, 9, 45, 'Báo B', 'weekdays');
    await waitFor(async () => (await p.locator('.al-card').count()) === 2);
    // tắt A
    const cardA = p.locator('.al-card', { hasText: 'Báo A' });
    await cardA.locator('[data-act=toggle]').click();
    await waitFor(async () => (await alarms(app)).find(a => a.label === 'Báo A').enabled === false, { msg: 'A tắt' });
    let A = (await alarms(app)).find(a => a.label === 'Báo A');
    assert.strictEqual(A.nextAt, null, 'tắt -> nextAt null');
    // bật lại
    await cardA.locator('[data-act=toggle]').click();
    await waitFor(async () => (await alarms(app)).find(a => a.label === 'Báo A').enabled === true, { msg: 'A bật' });
    A = (await alarms(app)).find(a => a.label === 'Báo A');
    assert.ok(A.nextAt > Date.now(), 'bật lại có nextAt tương lai');
    // sửa B: đổi giờ + nhãn
    await p.locator('.al-card', { hasText: 'Báo B' }).locator('[data-act=edit]').click();
    await p.waitForSelector('#alSheet.open');
    await p.fill('#alH', '10'); await p.fill('#alM', '20'); await p.fill('#alLabel', 'Báo B2');
    await p.click('#alSave');
    await waitFor(async () => (await alarms(app)).some(a => a.label === 'Báo B2'), { msg: 'B sửa' });
    const B = (await alarms(app)).find(a => a.label === 'Báo B2');
    assert.strictEqual(B.time, '10:20');
    assert.strictEqual(new Date(B.nextAt).getHours(), 10);
    assert.strictEqual(B.repeat.freq, 'weekdays');
    // tắt B rồi đóng/mở lại
    await p.locator('.al-card', { hasText: 'Báo B2' }).locator('[data-act=toggle]').click();
    await waitFor(async () => (await alarms(app)).find(a => a.label === 'Báo B2').enabled === false);
    await app.flush(); await app.close();
    app2 = await launch({ configHome: app.configHome, waitNotes: 1 });
    const l2 = await alarms(app2);
    assert.strictEqual(l2.length, 2, 'còn 2 báo thức sau khi mở lại');
    assert.strictEqual(l2.find(a => a.label === 'Báo A').enabled, true);
    assert.strictEqual(l2.find(a => a.label === 'Báo B2').enabled, false);
    assert.strictEqual(l2.find(a => a.label === 'Báo B2').time, '10:20');
    const p2 = await openTab(app2, 'alarms');
    await waitFor(async () => (await p2.locator('.al-card').count()) === 2);
    // xoá A (bấm 2 lần)
    await p2.locator('.al-card', { hasText: 'Báo A' }).locator('[data-act=edit]').click();
    await p2.waitForSelector('#alSheet.open');
    await p2.click('#alDel'); await p2.click('#alDel');
    await waitFor(async () => (await alarms(app2)).length === 1, { msg: 'xoá A' });
    await waitFor(async () => (await p2.locator('.al-card').count()) === 1);
    await app2.flush(); await app2.close();
    const d = app.readData();
    assert.strictEqual(d.alarms.list.length, 1);
    assert.strictEqual(d.alarms.list[0].label, 'Báo B2');
  } catch (e) { const f = await (app2 || app).shot('am-4-LOI'); if (f) e.message += '\n  ảnh: ' + f; throw e; }
  finally { for (const a of [app, app2]) if (a) await a.close(); }
});

function seedAlarm(nextAtOffsetMs, extra) {
  const now = Date.now();
  const d = new Date(now + nextAtOffsetMs);
  return Object.assign({ id: 'a_seed' + Math.random().toString(36).slice(2, 6), label: 'Seed', time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    date: dk(d), repeat: null, enabled: true, sound: 'chime', snoozeMin: 10, nextAt: d.getTime(), createdAt: now - 86400e3 }, extra || {});
}
function seedData(list) { return { version: 1, alarms: { version: 1, list } }; }

test('5a. đóng app lúc tới giờ, mở lại trễ <=30 phút -> kêu bù', { timeout: 60000 }, async () => {
  const a = seedAlarm(-10 * 60000, { label: 'Trễ 10 phút' });
  await withApp('am-5a', { seed: seedData([a]) }, async app => {
    const ring = await app.page('ring.html', { timeout: 20000 });
    await waitFor(async () => (await ring.textContent('#label')).includes('Trễ 10 phút'));
    const b = (await box(app));
    assert.strictEqual(b.missed.length, 0, 'không ghi lỡ');
    assert.strictEqual(b.list[0].enabled, false, 'một lần tự tắt');
    await app.shot('am-5a-bu');
  });
});

test('5b. mở lại trễ >30 phút -> mục "Đã lỡ", không kêu', { timeout: 60000 }, async () => {
  const a = seedAlarm(-45 * 60000, { label: 'Trễ 45 phút' });
  const b2 = seedAlarm(-3 * 3600e3, { label: 'Hằng ngày lỡ', repeat: { freq: 'daily' }, date: undefined });
  delete b2.date;
  await withApp('am-5b', { seed: seedData([a, b2]) }, async app => {
    await waitFor(async () => (await box(app)).missed.length === 2, { msg: '2 mục lỡ', timeout: 15000 });
    await sleep(1500);
    assert.strictEqual(app.pages('ring.html').length, 0, 'không có chuông cho báo thức lỡ');
    const b = await box(app);
    assert.ok(b.missed.some(m => m.label === 'Trễ 45 phút'));
    const daily = b.list.find(x => x.label === 'Hằng ngày lỡ');
    assert.strictEqual(daily.enabled, true); assert.ok(daily.nextAt > Date.now(), 'hằng ngày dời sang lần kế');
    const p = await openTab(app, 'alarms');
    await p.waitForSelector('#alMissed:not([hidden])');
    const txt = await p.textContent('#alMissedList');
    assert.match(txt, /Trễ 45 phút/);
    await app.shot('am-5b-da-lo');
    await p.click('#alMissedClear');
    await waitFor(async () => (await box(app)).missed.length === 0, { msg: 'xoá mục lỡ' });
  });
});

// ---------------------------------------------------------------- lượt 2: BUG-014 tờ "Dặn dò" bé cầm không được hiện NaN/undefined
test('6. (BUG-014) bé cầm tờ Dặn dò: tờ và bong bóng không có "NaN"/"undefined"', { timeout: 90000 }, async () => {
  await withApp('l2-alarm-tomemo', { waitNotes: 1 }, async app => {
    await sleep(2000);
    for (const when of ['startup', 'evening']) {
      await app.main((c, e, w) => { c.pet.stage.request({ kind: 'memo', priority: 60, payload: { memoId: 'm_' + w, text: 'Nhớ uống nước nha', when: w } }); return true; }, when);
      const pet = await app.page('pet.html');
      await waitFor(async () => !(await pet.evaluate(() => document.getElementById('note').hidden)), { timeout: 20000, msg: 'tờ dặn dò hiện (' + when + ')' });
      await sleep(1500);
      const t = await pet.evaluate(() => ({ big: document.getElementById('nBig').textContent, title: document.getElementById('nTitle').textContent, meta: document.getElementById('nMeta').textContent, bubble: document.getElementById('bText').textContent }));
      console.log('# BUG-014 when=' + when + ': ' + JSON.stringify(t));
      await app.shot('l2-alarm-tomemo-' + when);
      const all = [t.big, t.title, t.meta, t.bubble].join(' | ');
      assert.ok(!/NaN|undefined|null/.test(all), 'tờ dặn dò (when=' + when + ') hiện chữ lỗi: ' + all);
      await app.main(c => { const cur = c.pet.stage.current(); if (cur) c.pet.stage.cancel(cur.id); return true; });
      await sleep(1500);
    }
  });
});
