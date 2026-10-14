'use strict';
// Cửa sổ bé Mochi: vị trí, click-through, hàng đợi sự kiện, busy/dismiss, thông báo Windows dự phòng.
const { BrowserWindow, screen, Notification } = require('electron');
const P = require('../../shared/parse.js');
const S = require('../notes/scheduler.js');

const MASCOT_W = 440, MASCOT_H = 520;

function init(ctx) {
  const { alive } = ctx;
  const settings = () => ctx.settings();
  let mascotReady = false;
  let mascotBusy = false;
  let leaveTimer = null;
  const queue = [];                // {type, noteId?}
  const fallbackRefs = new Set();
  const win_ = () => ctx.windows.mascot;

  function ensureMascot() {
    if (alive(win_())) return win_();
    mascotReady = false;
    const win = new BrowserWindow({
      width: MASCOT_W, height: MASCOT_H, show: false,
      transparent: true, frame: false, resizable: false, skipTaskbar: true,
      focusable: false, hasShadow: false, backgroundColor: '#00000000',
      title: 'Mochi', webPreferences: ctx.webPrefs()
    });
    ctx.windows.mascot = win;
    ctx.hardenWebContents(win);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on('closed', () => {
      if (ctx.windows.mascot === win) { ctx.windows.mascot = null; mascotReady = false; mascotBusy = false; }
    });
    win.loadFile(ctx.paths.mascotHtml);
    return win;
  }
  function placeMascot() {
    const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    win_().setBounds({
      x: a.x + a.width - MASCOT_W - 8,
      y: a.y + a.height - MASCOT_H,
      width: MASCOT_W, height: MASCOT_H
    });
  }
  function showMascot() {
    clearTimeout(leaveTimer);
    placeMascot();
    win_().setAlwaysOnTop(true, 'screen-saver');
    if (!win_().isVisible()) win_().showInactive();
  }
  function mascotNote(n) {
    const r = n.reminder;
    return {
      id: n.id, title: S.noteTitle(n.text), text: n.text || '', color: n.color,
      due: r ? r.due : null, lead: r ? r.lead : 0,
      intentLabel: r ? P.intentLabel(r.intent) : ''
    };
  }
  function sendMascot(ev) {
    ev.settings = Object.assign({}, settings());
    ctx.send(win_(), 'mascot:event', ev);
  }
  function validItem(item, n, now) {
    if (item.type === 'hello') return true;
    if (!n || !n.reminder || n.reminder.done) return false;
    if (item.type === 'due') return n.reminder.due <= now + 1500;
    if (item.type === 'nag') return S.overdueNotes(ctx.store.data.notes, now).length > 0;
    return true; // pre
  }
  function fallbackNotify(item, n, now) {
    if (!Notification.isSupported()) return;
    const r = n.reminder;
    const label = P.intentLabel(r.intent);
    let body;
    if (item.type === 'pre') body = `${label} · còn ${P.dur(r.due - now)} nữa (${P.hm(r.due)})`;
    else if (item.type === 'due') body = `${label} · đã tới giờ (${P.hm(r.due)})`;
    else body = `Quá hạn ${P.dur(now - r.due)} · ${S.overdueNotes(ctx.store.data.notes, now).length} việc chưa xong`;
    const nt = new Notification({ title: S.noteTitle(n.text) || 'Mochi Notes', body, silent: !settings().sound });
    fallbackRefs.add(nt);
    const drop = () => fallbackRefs.delete(nt);
    nt.on('click', () => { drop(); ctx.notes.showNote(n.id); });
    nt.on('close', drop);
    nt.on('failed', drop);
    nt.show();
  }
  function pump() {
    if (mascotBusy) return;
    while (queue.length) {
      const item = queue[0];
      const now = Date.now();
      const n = item.noteId ? ctx.findNote(item.noteId) : null;
      if (!validItem(item, n, now)) { queue.shift(); continue; }
      if (!settings().mascotEnabled && item.type !== 'hello') {
        queue.shift();
        try { fallbackNotify(item, n, now); } catch (_) { /* bỏ qua */ }
        continue;
      }
      ensureMascot();
      if (!mascotReady) return; // chờ 'mascot:ready'
      queue.shift();
      mascotBusy = true;
      showMascot();
      const ev = { type: item.type };
      if (n) ev.note = mascotNote(n);
      if (item.type === 'nag') ev.overdueCount = S.overdueNotes(ctx.store.data.notes, now).length;
      sendMascot(ev);
      return;
    }
  }
  /** Đồng bộ trạng thái "ngồi góc" với settings khi bé đang rảnh. */
  function syncIdle() {
    if (mascotBusy || queue.length) return;
    const s = settings();
    if (s.mascotIdle && s.mascotEnabled) {
      ensureMascot();
      if (mascotReady) { showMascot(); sendMascot({ type: 'idle' }); }
    } else if (alive(win_()) && win_().isVisible()) {
      sendMascot({ type: 'leave' });
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        const s2 = settings();
        if (!mascotBusy && !queue.length && !(s2.mascotIdle && s2.mascotEnabled) && alive(win_())) win_().hide();
      }, 1200);
    }
  }
  function enqueueHello() {
    if (queue.some(q => q.type === 'hello')) return;
    queue.push({ type: 'hello' });
    pump();
  }
  /** event: {type:'pre'|'due'|'nag'|'hello', noteId?} */
  function enqueue(event) {
    queue.push({ type: event.type, noteId: event.noteId });
    pump();
  }
  function dropNote(id) {
    for (let k = queue.length - 1; k >= 0; k--) if (queue[k].noteId === id) queue.splice(k, 1);
  }
  ctx.bus.on('note:deleted', ({ id }) => dropNote(id));

  // ---- phần cho ipcPet
  function onReady(sender) {
    if (!alive(win_()) || sender !== win_().webContents) return;
    mascotReady = true;
    pump();
    if (!mascotBusy) syncIdle();
  }
  function setIgnore(sender, v) {
    if (alive(win_()) && sender === win_().webContents) win_().setIgnoreMouseEvents(!!v, { forward: true });
  }
  function dismiss() {
    mascotBusy = false;
    if (queue.length) pump();
    else {
      const s = settings();
      if (s.mascotIdle && s.mascotEnabled) { showMascot(); sendMascot({ type: 'idle' }); }
      else if (alive(win_())) win_().hide();
    }
  }
  function poke() { if (!mascotBusy && !queue.length) enqueueHello(); }

  Object.assign(ctx.pet, {
    enqueue, enqueueHello, pump, syncIdle, ensureMascot, dropNote,
    isBusy: () => mascotBusy || queue.length > 0,
    _onReady: onReady, _setIgnore: setIgnore, _dismiss: dismiss, _poke: poke
  });
}

module.exports = { init };
