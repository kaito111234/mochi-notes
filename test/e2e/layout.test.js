'use strict';
// QA nhóm layout (lượt 2): bố cục cửa sổ. Chuông báo thức (ring.html) và popup dặn dò (memo.html) KHÔNG được chồng
// vùng bé (cửa sổ pet.html, gồm cả bong bóng) và không chồng nhau; nằm trọn trong workArea; khi bé di chuyển thì dời theo.
// Vùng bé: ctx.pet.occupiedRect() nếu core đã công bố (docs/rooms/core.md mục 5); nếu chưa có thì dùng bounds cửa sổ pet.html
// (cửa sổ trong suốt bao cả thân bé và bong bóng). Ca "occupiedRect" riêng để lộ việc core chưa làm.
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';
const test = require('node:test');
const assert = require('node:assert');
const { launch, waitFor, sleep } = require('./lib/app');

/** Lấy hình chữ nhật các cửa sổ trong main (chỉ cửa sổ đang hiện). */
function rects(app) {
  return app.main((c, e) => {
    const wins = e.BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
    const url = w => { try { return w.webContents.getURL(); } catch (_) { return ''; } };
    const pick = part => { const w = wins.find(x => url(x).includes(part) && x.isVisible()); return w ? w.getBounds() : null; };
    let occ = null;
    try { occ = c.pet && typeof c.pet.occupiedRect === 'function' ? c.pet.occupiedRect() : null; } catch (_) { /* */ }
    const wa = e.screen.getPrimaryDisplay().workArea;
    return { pet: pick('pet.html'), ring: pick('ring.html'), memo: pick('memo.html'), occupied: occ, workArea: { x: wa.x, y: wa.y, width: wa.width, height: wa.height },
      hasOccupiedApi: !!(c.pet && typeof c.pet.occupiedRect === 'function') };
  });
}
const inter = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (r, wa) => r.x >= wa.x && r.y >= wa.y && r.x + r.width <= wa.x + wa.width && r.y + r.height <= wa.y + wa.height;
const fmt = r => r ? `${r.x},${r.y} ${r.width}x${r.height}` : 'null';

/** Đợi chuông hiện + bé hiện và đứng yên (bé chạy ra góc mất vài giây). */
async function settle(app, need) {
  await waitFor(async () => { const r = await rects(app); return need.every(k => r[k]); }, { timeout: 40000, msg: 'cửa sổ ' + need.join('+') });
  let last = '', same = 0;
  await waitFor(async () => {
    const r = await rects(app);
    const s = JSON.stringify([r.pet, r.ring, r.memo]);
    same = s === last ? same + 1 : 0; last = s;
    return same >= 6;
  }, { timeout: 25000, interval: 400, msg: 'bố cục ổn định' });
  return rects(app);
}

async function withDev(name, env, body) {
  const app = await launch({ waitNotes: 1, env });
  try { return await body(app); }
  catch (e) { const f = await app.shot(name + '-LOI'); if (f) e.message += '\n  ảnh: ' + f; throw e; }
  finally { await app.close(); }
}

test('1. core công bố ctx.pet.occupiedRect() (hợp đồng core.md mục 5)', { timeout: 60000 }, async () => {
  await withDev('l2-layout-occupied', { MOCHI_DEV_RING: '1' }, async app => {
    const r = await settle(app, ['ring', 'pet']);
    await app.shot('l2-layout-occupied');
    assert.ok(r.hasOccupiedApi, 'ctx.pet.occupiedRect chưa tồn tại: chuông/popup không có cách né bé (placement.js nhận avoid=null)');
    assert.ok(r.occupied && r.occupied.width > 0, 'occupiedRect() không trả hình chữ nhật khi bé đang hiện');
  });
});

test('2. chuông báo thức không chồng bé/bong bóng, nằm trọn workArea', { timeout: 90000 }, async () => {
  await withDev('l2-layout-ring', { MOCHI_DEV_RING: '1' }, async app => {
    const r = await settle(app, ['ring', 'pet']);
    console.log('# ring=' + fmt(r.ring) + ' pet=' + fmt(r.pet) + ' occupied=' + fmt(r.occupied) + ' workArea=' + fmt(r.workArea));
    await app.shot('l2-layout-ring');
    assert.ok(inside(r.ring, r.workArea), 'chuông tràn khỏi workArea: ' + fmt(r.ring) + ' trong ' + fmt(r.workArea));
    assert.ok(!inter(r.ring, r.pet), 'chuông ' + fmt(r.ring) + ' chồng vùng cửa sổ bé (thân + bong bóng) ' + fmt(r.pet));
    if (r.occupied) assert.ok(!inter(r.ring, r.occupied), 'chuông chồng occupiedRect ' + fmt(r.occupied));
  });
});

test('3. popup dặn dò không chồng bé/bong bóng/chuông, nằm trọn workArea', { timeout: 90000 }, async () => {
  await withDev('l2-layout-memo', { MOCHI_DEV_MEMO: '1' }, async app => {
    const r = await settle(app, ['memo', 'pet']);
    console.log('# memo=' + fmt(r.memo) + ' pet=' + fmt(r.pet) + ' occupied=' + fmt(r.occupied));
    await app.shot('l2-layout-memo');
    assert.ok(inside(r.memo, r.workArea), 'popup tràn khỏi workArea: ' + fmt(r.memo));
    assert.ok(!inter(r.memo, r.pet), 'popup dặn dò ' + fmt(r.memo) + ' chồng cửa sổ bé (thân + bong bóng) ' + fmt(r.pet));
    if (r.occupied) assert.ok(!inter(r.memo, r.occupied), 'popup chồng occupiedRect');
  });
});

test('4. chuông + popup dặn dò cùng lúc: ba cửa sổ không chồng nhau', { timeout: 120000 }, async () => {
  await withDev('l2-layout-all', { MOCHI_DEV_RING: '1', MOCHI_DEV_MEMO: '1' }, async app => {
    const r = await settle(app, ['ring', 'memo', 'pet']);
    console.log('# ring=' + fmt(r.ring) + ' memo=' + fmt(r.memo) + ' pet=' + fmt(r.pet));
    await app.shot('l2-layout-all');
    assert.ok(inside(r.ring, r.workArea) && inside(r.memo, r.workArea), 'có cửa sổ tràn workArea');
    assert.ok(!inter(r.memo, r.ring), 'popup dặn dò ' + fmt(r.memo) + ' chồng chuông ' + fmt(r.ring));
    assert.ok(!inter(r.ring, r.pet), 'chuông chồng bé');
    assert.ok(!inter(r.memo, r.pet), 'popup chồng bé');
  });
});

test('5. bé di chuyển (pet:moved): chuông dời theo nếu bị đè', { timeout: 120000 }, async () => {
  await withDev('l2-layout-move', { MOCHI_DEV_RING: '1' }, async app => {
    const r0 = await settle(app, ['ring', 'pet']);
    await app.shot('l2-layout-move-truoc');
    // Đưa cửa sổ bé đè lên chỗ chuông đang đứng rồi phát pet:moved (đúng cách core báo khi bé chạy).
    const target = r0.ring;
    await app.main((c, e, t) => {
      const w = e.BrowserWindow.getAllWindows().find(x => !x.isDestroyed() && x.webContents.getURL().includes('pet.html'));
      const b = w.getBounds();
      w.setBounds({ x: t.x + Math.round((t.width - b.width) / 2), y: t.y + Math.round((t.height - b.height) / 2), width: b.width, height: b.height });
      const rect = c.pet && typeof c.pet.occupiedRect === 'function' ? c.pet.occupiedRect() : w.getBounds();
      c.bus.emit('pet:moved', { rect });
      return true;
    }, target);
    await sleep(1200);
    const r1 = await rects(app);
    await app.shot('l2-layout-move-sau');
    console.log('# trước: ring=' + fmt(r0.ring) + ' pet=' + fmt(r0.pet) + ' | sau: ring=' + fmt(r1.ring) + ' pet=' + fmt(r1.pet) + ' occupied=' + fmt(r1.occupied));
    const avoid = r1.occupied || r1.pet;
    assert.ok(!inter(r1.ring, avoid), 'sau pet:moved chuông ' + fmt(r1.ring) + ' vẫn chồng vùng bé ' + fmt(avoid));
    assert.ok(inside(r1.ring, r1.workArea), 'chuông ra khỏi workArea sau khi dời');
  });
});
