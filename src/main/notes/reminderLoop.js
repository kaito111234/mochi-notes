'use strict';
// Vòng nhắc: ngủ tới mốc kế (tối đa 60 s) rồi gọi scheduler.tick (BUG-024: không hỏi mỗi giây); đẩy sự kiện cho bé qua ctx.pet.enqueue và phát bus.
const S = require('./scheduler.js');

function init(ctx) {
  const schedState = { lastNag: Date.now(), busy: false };
  let timer = null;

  function tickOnce() {
    const now = Date.now();
    schedState.busy = typeof ctx.pet.isBusy === 'function' ? !!ctx.pet.isBusy() : false;
    const r = S.tick(ctx.store.data.notes, now, schedState);
    if (r.changed) {
      ctx.store.save();
      for (const id of r.changedIds) { const n = ctx.findNote(id); if (n) ctx.notes.noteChanged(n); }
    }
    if (r.events.length) {
      for (const ev of r.events) {
        if (ev.type === 'pre' || ev.type === 'due') ctx.bus.emit('reminder:' + ev.type, { noteId: ev.noteId, reminderId: ev.reminderId, title: ev.title });
        const st = ctx.pet.stage;
        if (st && typeof st.request === 'function') {
          const payload = { noteId: ev.noteId };
          if (ev.reminderId != null) payload.reminderId = ev.reminderId;
          if (ev.title != null) payload.title = ev.title;
          if (ev.overdueCount != null) payload.overdueCount = ev.overdueCount;
          st.request({ kind: ev.type, priority: { due: 90, pre: 70, nag: 40 }[ev.type], payload });
        } else ctx.pet.enqueue({ type: ev.type, noteId: ev.noteId, reminderId: ev.reminderId, title: ev.title, overdueCount: ev.overdueCount });
      }
    } else if (typeof ctx.pet.pump === 'function') ctx.pet.pump();
  }
  const MAX_SLEEP = 15000;   // trần an toàn: bù ngủ máy / đổi giờ / thay đổi không qua bus (trễ tối đa 15 s)
  const BUSY_POLL = 1000;    // bé đang bận: giữ nhịp 1 s để hàng đợi sân khấu chạy tiếp
  const MIN_SLEEP = 20;
  let running = false;

  /** Thời gian ngủ (ms) tới lần tick kế. */
  function sleepFor(now) {
    try { if (typeof ctx.pet.isBusy === 'function' && ctx.pet.isBusy()) return BUSY_POLL; } catch (_) { /* bỏ qua */ }
    let at = Infinity;
    try { at = S.nextWake(ctx.store.data.notes, now, schedState); } catch (_) { at = now; }
    return Math.min(MAX_SLEEP, Math.max(MIN_SLEEP, at - now));
  }
  function arm() {
    clearTimeout(timer); timer = null;
    if (!running) return;
    timer = setTimeout(loop, sleepFor(Date.now()));
    if (timer && timer.unref) timer.unref();
  }
  function loop() {
    timer = null;
    try { tickOnce(); } catch (e) { console.error('[notes] reminder loop', e); }
    arm();
  }
  /** Có thay đổi nhắc / máy dậy / đổi giờ: tính lại mốc kế (và tick ngay nếu tới giờ). */
  function wake() { if (running) { clearTimeout(timer); timer = setTimeout(loop, 0); } }
  function start() {
    if (running) return;
    running = true;
    for (const ev of ['note:created', 'note:updated', 'note:restored', 'note:deleted', 'note:trashed', 'settings:changed']) ctx.bus.on(ev, rearm);
    try { const { powerMonitor } = require('electron'); if (powerMonitor && powerMonitor.on) { powerMonitor.on('resume', wake); powerMonitor.on('unlock-screen', wake); } } catch (_) { /* không có electron */ }
    arm();
  }
  function rearm() { if (running) arm(); }
  function stop() { running = false; clearTimeout(timer); timer = null; }

  Object.assign(ctx.notes, { startReminderLoop: start, stopReminderLoop: stop, wakeReminderLoop: wake });
}

module.exports = { init };
