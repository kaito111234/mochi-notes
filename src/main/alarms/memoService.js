'use strict';
// Dặn dò (Memo): CRUD, hẹn giờ theo khung giờ, popup, chặn tắt máy một lần.
// Logic thời điểm nằm ở memoLogic.js (thuần, có test).
//
// GIỚI HẠN "trước khi tắt máy": app.on('before-quit') chỉ bắt được khi người dùng thoát app (khay/menu).
// Khi Windows tắt/đăng xuất, hệ điều hành KHÔNG cho app chặn lại: 'session-end' (cửa sổ) / powerMonitor
// 'shutdown' (nếu nền tảng có) chỉ đủ thời gian hiện một Notification, không giữ được máy.
const { app, BrowserWindow, Notification, screen, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const { getBox, normMemo } = require('./box.js');
const L = require('./memoLogic.js');
const { placeAvoiding, needsMove, petRectFor, petVisible } = require('./placement.js');

const POPUP_W = 360, POPUP_H = 320, QUIT_AUTO_MS = 60000;

function init(ctx) {
  const box = () => getBox(ctx);
  const bus = ctx.bus;
  let popup = null, popupReady = false, pending = null; // pending = payload đang hiện
  let idle = false, quitFlag = false, quitTimer = null, quitAllowed = false;
  const refs = new Set();

  const snapshot = () => ({ memos: box().memos, settings: box().settings });
  function save() { ctx.store.save(); }
  function broadcast() {
    const s = snapshot();
    for (const w of BrowserWindow.getAllWindows()) ctx.send(w, 'memo:changed', s);
  }
  const newId = () => 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---- hiện nhắc ----
  function notify(items) {
    if (ctx.alarms && typeof ctx.alarms.toast === 'function' && items.length) {
      const nt = ctx.alarms.toast({
        kind: 'memo', refId: items[0].memoId, title: L.titleFor(items), body: items.map(i => i.text).join('\n').slice(0, 250),
        buttons: [{ id: 'done', label: 'Nhớ rồi' }]
      });
      if (nt) return;
    }
    if (!Notification.isSupported()) return;
    try {
      const nt = new Notification({ title: L.titleFor(items), body: items.map(i => i.text).join('\n').slice(0, 250) });
      refs.add(nt); const drop = () => refs.delete(nt);
      nt.on('close', drop); nt.on('click', drop); nt.on('failed', drop);
      nt.show();
    } catch (_) { /* bỏ qua */ }
  }

  const petRect = () => petRectFor(ctx, screen.getPrimaryDisplay().workArea);
  const ringRect = () => {
    try { return ctx.alarms && typeof ctx.alarms.ringBounds === 'function' ? ctx.alarms.ringBounds() : null; } catch (_) { return null; }
  };
  const avoidList = () => [petRect(), ringRect()].filter(Boolean);
  function position(win) {
    const wa = screen.getPrimaryDisplay().workArea;
    const p = placeAvoiding(wa, { width: POPUP_W, height: POPUP_H }, avoidList(), 16);
    win.setBounds({ x: p.x, y: p.y, width: POPUP_W, height: POPUP_H });
  }
  function reposition(force) {
    if (!ctx.alive(popup) || !popup.isVisible()) return;
    if (force || needsMove(popup.getBounds(), avoidList())) position(popup);
  }
  let moveTimer = null;
  const onLayout = () => {
    if (moveTimer) return;
    moveTimer = setTimeout(() => { moveTimer = null; try { reposition(false); } catch (_) { /* bỏ qua */ } }, 300);
    if (moveTimer.unref) moveTimer.unref();
  };
  bus.on('pet:moved', onLayout);
  bus.on('alarms:layout', onLayout);
  bus.on('alarm:stopped', onLayout);
  bus.on('alarm:snoozed', onLayout);

  function showPopup(payload) {
    if (pending && !pending.quitting && !payload.quitting && ctx.alive(popup)) { // gộp vào popup đang mở
      const seen = new Set(pending.items.map(i => i.memoId));
      payload = { ...payload, items: pending.items.concat(payload.items.filter(i => !seen.has(i.memoId))) };
      payload.title = L.titleFor(payload.items);
    }
    try {
      const ln = ctx.persona && typeof ctx.persona.pick === 'function'
        ? ctx.persona.pick('memo', { title: payload.items.map(i => i.text).join('; ').slice(0, 80) }) : null;
      if (!petVisible(ctx) && ln && typeof ln.text === 'string' && ln.text.trim()) payload = { ...payload, line: ln.text.trim().slice(0, 140) };
    } catch (_) { /* câu thoại không ảnh hưởng dặn dò */ }
    pending = payload;
    if (ctx.alive(popup)) {
      position(popup);
      if (popupReady) ctx.send(popup, 'memo:show', pending);
      if (!popup.isVisible()) popup.showInactive();
      return;
    }
    popupReady = false;
    const win = new BrowserWindow({
      width: POPUP_W, height: POPUP_H, show: false, frame: false, resizable: false,
      skipTaskbar: true, focusable: true, alwaysOnTop: true, title: 'Dặn dò',
      backgroundColor: '#fff7d1', webPreferences: ctx.webPrefs()
    });
    popup = win;
    ctx.hardenWebContents(win);
    win.setAlwaysOnTop(true, 'screen-saver');
    position(win);
    win.on('session-end', () => { // Windows đang tắt máy: chỉ kịp báo, không chặn được
      const its = (pending && pending.items) || [];
      if (its.length) notify(its);
    });
    win.on('closed', () => {
      const wasQuit = popup === win && pending && pending.quitting;
      if (popup === win) { popup = null; popupReady = false; pending = null; }
      clearQuitTimer();
      if (wasQuit && !quitAllowed) quitFlag = false;   // "Ở lại"/đóng popup: lần thoát sau vẫn dặn
    });
    win.loadFile(path.join(ctx.paths.src, 'alarms/memo.html'));
    win.once('ready-to-show', () => { if (ctx.alive(win)) win.showInactive(); });
  }
  ipcMain.on('memo:popupReady', e => {
    if (!popup || e.sender !== popup.webContents) return;
    popupReady = true;
    if (pending) ctx.send(popup, 'memo:show', pending);
  });

  function emitPet(it) {
    bus.emit('memo:due', { memoId: it.memoId, text: it.text, when: it.when });
    try {
      const st = ctx.pet && ctx.pet.stage;
      if (st && st.request) st.request({ kind: 'memo', priority: 60, payload: { memoId: it.memoId, text: it.text, when: it.when } });
      else if (ctx.pet && ctx.pet.enqueue) ctx.pet.enqueue({ type: 'memo', memoId: it.memoId, text: it.text });
    } catch (_) { /* bé chưa sẵn sàng thì thôi */ }
  }

  /** Hiện một nhóm memo. opts: {quitting, mark:true (mặc định)}. */
  function present(memos, opts) {
    const o = opts || {};
    if (!memos.length) return;
    const items = memos.map(m => ({ memoId: m.id, text: m.text, when: m.when }));
    if (o.mark !== false) {
      const now = new Date(); let ch = false;
      for (const m of memos) if (markShown(m, now)) ch = true;
      if (ch) { save(); broadcast(); }
    }
    items.forEach(emitPet);
    showPopup({ items, quitting: !!o.quitting, title: L.titleFor(items, o.quitting) });
    if (ctx.settings().mascotEnabled === false) notify(items);
  }
  function markShown(m, now) { return L.markShown(m, now); }

  function check(kind) {
    present(L.dueMemos(box().memos, new Date(), kind, { idle }));
  }

  // ---- IPC ----
  ipcMain.handle('memo:list', () => snapshot());
  ipcMain.handle('memo:create', (_e, m) => {
    m = m && typeof m === 'object' ? m : {};
    const o = normMemo({ ...m, id: newId(), text: String(m.text || '').trim() || 'Dặn dò mới', createdAt: Date.now() });
    delete o.lastShownDay;
    box().memos.push(o); save(); broadcast(); return o;
  });
  ipcMain.handle('memo:update', (_e, id, patch) => {
    const i = box().memos.findIndex(x => x.id === id);
    if (i < 0) return null;
    const cur = box().memos[i];
    const merged = { ...cur, ...(patch && typeof patch === 'object' ? patch : {}), id: cur.id, createdAt: cur.createdAt };
    if (patch && 'days' in patch && !Array.isArray(patch.days)) delete merged.days;
    if (patch && 'once' in patch && !patch.once) delete merged.once;
    const o = normMemo(merged);
    if (!o) return cur;
    box().memos[i] = o; save(); broadcast(); return o;
  });
  ipcMain.handle('memo:delete', (_e, id) => {
    const a = box().memos, i = a.findIndex(x => x.id === id);
    if (i < 0) return false;
    a.splice(i, 1); save(); broadcast(); return true;
  });
  ipcMain.handle('memo:test', (_e, id) => {
    const m = box().memos.find(x => x.id === id);
    if (!m) return false;
    present([m], { mark: false }); return true;
  });
  ipcMain.handle('memo:ack', (_e, ids) => {
    const set = new Set(Array.isArray(ids) ? ids : []);
    const now = new Date(); let ch = false;
    for (const m of box().memos) if (set.has(m.id) && L.markShown(m, now)) ch = true;
    if (ch) { save(); broadcast(); }
    if (ctx.alive(popup)) popup.close();
    return true;
  });
  ipcMain.handle('memo:quitNow', () => { doQuit(); return true; });

  // ---- trước khi tắt máy ----
  function clearQuitTimer() { if (quitTimer) { clearTimeout(quitTimer); quitTimer = null; } }
  function doQuit() {
    clearQuitTimer(); quitAllowed = true;
    const now = new Date();
    let due = [];
    try { due = L.dueMemos(box().memos, now, 'before-shutdown'); } catch (_) { /* bỏ qua */ }
    for (const m of due) L.markShown(m, now);   // chỉ memo thực sự đến hạn
    save();
    app.quit();
  }
  app.on('before-quit', e => {
    if (quitAllowed || quitFlag) return;
    let due = [];
    try { due = L.dueMemos(box().memos, new Date(), 'before-shutdown'); } catch (_) { return; }
    if (!due.length || (ctx.alive(popup) && pending && pending.quitting)) return;
    quitFlag = true;                // chỉ chặn đúng một lần
    e.preventDefault();
    ctx.quitting = false;
    present(due, { quitting: true });
    clearQuitTimer();
    quitTimer = setTimeout(doQuit, QUIT_AUTO_MS);
  });
  try {
    powerMonitor.on('shutdown', () => {
      const due = L.dueMemos(box().memos, new Date(), 'before-shutdown');
      if (due.length) notify(due.map(m => ({ memoId: m.id, text: m.text, when: m.when })));
    });
  } catch (_) { /* không có trên nền tảng này */ }

  // ---- hẹn giờ ----
  bus.on('app:startup', () => setTimeout(() => check('startup'), 8000));
  bus.on('app:idle', () => { idle = true; });
  bus.on('app:resume', () => { idle = false; check('tick'); });
  const timer = setInterval(() => check('tick'), 60000);
  if (timer.unref) timer.unref();

  // ---- chạy thử ----
  if (process.env.MOCHI_DEV_MEMO) {
    if (!box().memos.length) {
      box().memos.push(
        normMemo({ id: newId(), text: 'Nhớ uống nước và mở cửa sổ cho thoáng nha', when: 'startup' }),
        normMemo({ id: newId(), text: 'Tắt bếp trước khi đi ngủ', when: 'evening' }));
      save();
    }
    setTimeout(() => {
      const ms = box().memos.filter(m => m.enabled !== false).slice(0, 3);
      present(ms, { mark: false });
    }, 3000);
  }

  ctx.memos = {
    list: () => snapshot(),
    showNow: ids => present(box().memos.filter(m => (ids || []).includes(m.id)), { mark: false }),
    check
  };
}

module.exports = { init };
