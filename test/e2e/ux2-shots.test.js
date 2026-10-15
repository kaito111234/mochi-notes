'use strict';
// QA nhóm ux (lượt 2): chụp giao diện Đợt 2 để rà bằng mắt. Ảnh: test/e2e/out/ux2<TAG>-*.png
// Đặt UX2_TAG=-1366 khi chạy ở màn 1366x768 để tách tên ảnh. Test chỉ kiểm "chụp được"; đánh giá ở docs/rooms/qa/findings/ux.md.
const test = require('node:test');
const assert = require('node:assert');
const { withApp, sleep, OUT } = require('./lib/app');
const path = require('path');

const TAG = process.env.UX2_TAG || '';
const now = Date.now();
const mkNote = (id, html, o = {}) => Object.assign({
  id, html, text: html.replace(/<[^>]+>/g, ' '), color: 'yellow',
  bounds: { x: 60, y: 60, width: 300, height: 220 }, visible: true, alwaysOnTop: false,
  reminder: null, createdAt: now - 1000, updatedAt: now - 1000
}, o);
const QUIET = { mascotEnabled: false, mascotIdle: false, sound: false, glass: false, startup: false, allHidden: false };
const pshot = async (p, name) => p.screenshot({ path: path.join(OUT, 'ux2' + TAG + '-' + name + '.png') }).catch(() => {});
const loaded = async p => { await p.waitForLoadState('domcontentloaded'); await sleep(900); };
const SIZES = { mini: [220, 170], mac: [300, 220], lon: [400, 420] };
const BODY = '<div>Họp với khách 9h sáng mai</div><div>Mua gạo, trứng, sữa tươi</div><ul><li>Gọi anh Nam</li><li>In hợp đồng</li></ul><div><b>Đậm</b> <i>nghiêng</i> <mark>tô sáng</mark></div>';
const PAPERS = ['plain-charcoal', 'minimal-kraft', 'minimal-night', 'season-tet', 'cute-cream-cat', 'student-grid', 'office-memo', 'season-trungthu'];

test('ux2-1: bộ chọn Mẫu giấy từng tab nhóm', { timeout: 150000 }, async () => {
  const seed = { notes: [mkNote('n1', BODY)], settings: QUIET };
  await withApp('ux2-1', { seed, waitNotes: 1 }, async app => {
    const p = await app.noteWindow(); await loaded(p);
    await p.click('#btnMenu'); await sleep(400);
    await pshot(p, '01-menu');
    await p.click('[data-act="paper"]'); await sleep(700);
    await app.shot('ux2' + TAG + '-01-picker-full'); await pshot(p, '01-picker-mac');
    const tabs = await p.$$('.pk-tab');
    for (let i = 0; i < tabs.length; i++) {
      await tabs[i].click(); await sleep(500);
      await pshot(p, '02-picker-tab' + i);
    }
    // chọn 1 mẫu để xem áp dụng
    const cell = await p.$('.pk-grid [role="option"]'); if (cell) { await cell.click(); await sleep(600); }
    await pshot(p, '03-picker-chon');
    assert.ok(tabs.length >= 5, 'số tab nhóm ' + tabs.length);
  });
});

for (const [sz, [w, h]] of Object.entries(SIZES)) {
  test('ux2-2-' + sz + ': nhiều mẫu giấy ở cỡ ' + w + 'x' + h, { timeout: 150000 }, async () => {
    const cols = Math.max(1, Math.floor(1400 / (w + 20)));
    const list = sz === 'lon' ? PAPERS.slice(0, 6) : PAPERS;
    const notes = list.map((pid, i) => mkNote('p_' + i, BODY, {
      bounds: { x: 20 + (i % cols) * (w + 20), y: 20 + Math.floor(i / cols) * (h + 30), width: w, height: h },
      color: pid === 'plain-charcoal' ? 'charcoal' : 'yellow' }));   // mẫu Trơn theo màu note (paperCtl.js:21) nên phải đặt color
    await withApp('ux2-2-' + sz, { seed: { notes, settings: QUIET }, waitNotes: notes.length }, async app => {
      for (let i = 0; i < list.length; i++) {
        const p = await app.noteWindow('p_' + i); await loaded(p);
        await p.evaluate(([id, pid]) => window.mochi.paper.set(id, { paper: pid }), ['p_' + i, list[i]]);
      }
      await sleep(1500);
      await app.shot('ux2' + TAG + '-10-luoi-' + sz);
      for (let i = 0; i < list.length; i++) { const p = await app.noteWindow('p_' + i); await pshot(p, '11-' + sz + '-' + list[i]); }
    });
  });
}

test('ux2-3: checklist dài + dải gợi ý hiểu note', { timeout: 120000 }, async () => {
  let html = '';
  for (let i = 1; i <= 14; i++) html += '<div data-ck="' + (i % 3 === 0 ? 1 : 0) + '">Việc số ' + i + ': mua đồ cho tiệc cuối tuần</div>';
  const notes = [
    mkNote('ck', html, { bounds: { x: 40, y: 40, width: 300, height: 380 } }),
    mkNote('is1', '<div>Họp với khách 15h chiều mai, gọi 0912 345 678</div>', { bounds: { x: 380, y: 40, width: 300, height: 260 }, color: 'green' }),
    mkNote('is2', '<div>Mua sữa</div><div>Mua trứng</div><div>Mua gạo</div><div>Mua rau</div>', { bounds: { x: 720, y: 40, width: 300, height: 260 }, color: 'blue' }),
    mkNote('is3', '<div>Dậy 6h sáng mai, 9h họp, 14h nộp báo cáo</div>', { bounds: { x: 1060, y: 40, width: 300, height: 260 }, color: 'pink' })
  ];
  await withApp('ux2-3', { seed: { notes, settings: QUIET }, waitNotes: 4 }, async app => {
    await sleep(1500);
    for (const id of ['is1', 'is2', 'is3']) { const p = await app.noteWindow(id); await loaded(p); await p.click('#editor'); await p.keyboard.press('End'); await p.keyboard.type(' '); await sleep(1500); }
    await app.shot('ux2' + TAG + '-20-checklist-insight');
    for (const id of ['ck', 'is1', 'is2', 'is3']) { const p = await app.noteWindow(id); await pshot(p, '21-' + id); }
    const p = await app.noteWindow('ck');
    await p.evaluate(() => { const e = document.querySelector('.body') || document.getElementById('editor'); e.scrollTop = 99999; document.getElementById('editor').scrollTop = 99999; });
    await sleep(300); await pshot(p, '22-ck-cuon-cuoi');
  });
});

test('ux2-4: danh sách — Ghi nhanh, chip +N, thùng rác', { timeout: 120000 }, async () => {
  const rem = (d, id) => ({ id, due: now + d * 3600000, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false });
  const notes = [
    mkNote('a', '<div>Họp tuần với nhóm thiết kế</div>', { color: 'green', reminders: [rem(3, 'r1'), rem(26, 'r2'), rem(50, 'r3')], reminder: rem(3, 'r1'), bounds: { x: 20, y: 20, width: 300, height: 220 } }),
    mkNote('b', '<div>Đi chợ mua rau</div>', { color: 'pink', bounds: { x: 340, y: 20, width: 300, height: 220 } }),
    mkNote('c', '<div>Note sẽ vào thùng rác</div>', { color: 'blue', bounds: { x: 660, y: 20, width: 300, height: 220 } })
  ];
  await withApp('ux2-4', { seed: { notes, settings: QUIET }, waitNotes: 3 }, async app => {
    const l = await app.openList(); await loaded(l);
    await pshot(l, '30-list');
    await l.fill('#qcIn', 'họp 9h sáng mai, 14h gọi khách'); await sleep(700); await pshot(l, '31-ghi-nhanh-xem-truoc');
    await l.fill('#qcIn', 'mua sữa'); await sleep(500); await pshot(l, '32-ghi-nhanh-khong-gio');
    await l.press('#qcIn', 'Enter'); await sleep(900); await pshot(l, '33-sau-ghi-nhanh');
    await app.main(c => c.notes.deleteNote('c'));
    await sleep(900);
    await l.click('[data-f="trash"]').catch(() => {}); await sleep(700); await pshot(l, '34-thung-rac');
    await app.shot('ux2' + TAG + '-30-list-full');
  });
});

test('ux2-5: Phòng của Mochi 5 tab (sáng + tối)', { timeout: 150000 }, async () => {
  await withApp('ux2-5', { seed: { notes: [mkNote('a', '<div>x</div>')], settings: Object.assign({}, QUIET) }, waitNotes: 1 }, async app => {
    await app.main(c => { c.game.open(); return true; });
    const r = await app.page('room.html'); await loaded(r);
    const ids = await r.$$eval('#tablist button', bs => bs.map(b => b.id || b.dataset.tab || b.textContent));
    const btns = await r.$$('#tablist button');
    for (let i = 0; i < btns.length; i++) { await btns[i].click(); await sleep(900); await pshot(r, '40-phong-sang-' + i); }
    await app.shot('ux2' + TAG + '-40-phong-full');
    await r.emulateMedia({ colorScheme: 'dark' }); await sleep(500);
    for (let i = 0; i < btns.length; i++) { await btns[i].click(); await sleep(700); await pshot(r, '41-phong-toi-' + i); }
    console.log('tab phòng', JSON.stringify(ids));
    assert.ok(btns.length >= 5);
  });
});

test('ux2-6: bé mới ở các trạng thái (đứng, giơ note, chuông, ngủ)', { timeout: 150000 }, async () => {
  const seed = { notes: [mkNote('n1', '<div>Gọi điện cho khách hàng</div>', { bounds: { x: 60, y: 60, width: 300, height: 220 } })],
    settings: Object.assign({}, QUIET, { mascotEnabled: true, mascotIdle: true }) };
  await withApp('ux2-6', { seed, waitNotes: 1 }, async app => {
    await sleep(5000);
    await app.shot('ux2' + TAG + '-50-be-dung');
    const wins = () => app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ u: w.webContents.getURL().split('/').pop().slice(0, 24), b: w.getBounds(), v: w.isVisible() })));
    console.log('cửa sổ', JSON.stringify(await wins()));
    await app.main(c => { const a = c.pet.actor; a.holdNote({ title: 'Gọi điện cho khách hàng', big: 'Tới giờ rồi!', meta: '09:30 hôm nay · Gọi điện', color: 'yellow', kind: 'due' }); a.play('hold_note', { loop: true }); a.say('Cậu ơi, tới giờ gọi điện rồi nha.', { buttons: [{ id: 'done', label: 'Xong rồi', primary: true }, { id: 'snooze', label: 'Hoãn 10 phút' }, { id: 'open', label: 'Mở note' }] }); return true; });
    await sleep(2500); await app.shot('ux2' + TAG + '-51-be-giat-note'); await sleep(1200); await app.shot('ux2' + TAG + '-51b-be-giat-note');
    console.log('cửa sổ', JSON.stringify(await wins()));
    await app.main(c => { const a = c.pet.actor; a.holdNote(null); a.hush(); a.play('ring', { loop: true }); a.shake(true); a.say('Báo thức nè! Dậy thôi cậu ơi.', { buttons: [{ id: 'stop', label: 'Tắt', primary: true }, { id: 'snooze', label: 'Hoãn 10 phút' }] }); return true; });
    await sleep(2500); await app.shot('ux2' + TAG + '-52-be-chuong');
    await app.main(c => { const a = c.pet.actor; a.shake(false); a.hush(); a.play('sleep', { loop: true }); return true; });
    await sleep(2500); await app.shot('ux2' + TAG + '-53-be-ngu');
    await app.main(c => { const a = c.pet.actor; a.play('happy', { loop: true }); a.say('Tớ vui quá!', { ttlMs: 8000 }); return true; });
    await sleep(2000); await app.shot('ux2' + TAG + '-54-be-vui');
  });
});

test('ux2-7: bé nhắc note thật (due = now+3s) và chuông MOCHI_DEV_RING', { timeout: 120000 }, async () => {
  const seed = { notes: [mkNote('n1', '<div>Gọi điện cho khách hàng</div>', { reminder: { due: Date.now() + 60000, lead: 0, intent: 'call', auto: true, preFired: false, fired: false, done: false } })],
    settings: Object.assign({}, QUIET, { mascotEnabled: true }) };
  await withApp('ux2-7', { seed, waitNotes: 1 }, async app => {
    await app.main(c => { const n = c.store.data.notes[0]; n.reminder.due = Date.now() + 3000; if (n.reminders && n.reminders[0]) n.reminders[0].due = n.reminder.due; return true; });
    for (let i = 0; i < 6; i++) { await sleep(1500); await app.shot('ux2' + TAG + '-60-nhac-' + i); }
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ u: w.webContents.getURL().split('/').pop().slice(0, 24), b: w.getBounds(), v: w.isVisible() })));
    console.log('cửa sổ', JSON.stringify(wins));
  });
  await withApp('ux2-7b', { env: { MOCHI_DEV_RING: '1' }, waitNotes: 2 }, async app => {
    await sleep(3500);
    for (let i = 0; i < 3; i++) { await sleep(1500); await app.shot('ux2' + TAG + '-61-chuong-' + i); }
    const wins = await app.main((c, e) => e.BrowserWindow.getAllWindows().map(w => ({ u: w.webContents.getURL().split('/').pop().slice(0, 24), b: w.getBounds(), v: w.isVisible() })));
    console.log('cửa sổ', JSON.stringify(wins));
  });
});

test('ux2-8: Cài đặt các nhóm', { timeout: 120000 }, async () => {
  await withApp('ux2-8', { seed: { notes: [mkNote('a', '<div>x</div>')], settings: QUIET }, waitNotes: 1 }, async app => {
    const l = await app.openList(); await loaded(l);
    await l.click('#btnSettings'); await sleep(700);
    const h = await l.evaluate(() => { const s = document.querySelector('#panel .panel-body'); return s ? s.scrollHeight : 0; });
    for (let i = 0, y = 0; y < h + 400 && i < 8; i++, y += 380) {
      await l.evaluate(v => { const s = document.querySelector('#panel .panel-body'); if (s) { s.style.scrollBehavior = 'auto'; s.scrollTop = v; } }, y);
      await sleep(300); await pshot(l, '70-caidat-' + i);
    }
    console.log('cao cài đặt', h);
  });
});
