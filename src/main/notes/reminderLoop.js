'use strict';
// Timer 1 giây gọi scheduler.tick; đẩy sự kiện cho bé qua ctx.pet.enqueue và phát bus.
const S = require('./scheduler.js');

function init(ctx) {
  const schedState = { lastNag: Date.now(), busy: false };
  let timer = null;

  function tickOnce() {
    const now = Date.now();
    schedState.busy = ctx.pet.isBusy();
    const r = S.tick(ctx.store.data.notes, now, schedState);
    if (r.changed) {
      ctx.store.save();
      for (const id of r.changedIds) { const n = ctx.findNote(id); if (n) ctx.notes.noteChanged(n); }
    }
    if (r.events.length) {
      for (const ev of r.events) {
        if (ev.type === 'pre' || ev.type === 'due') ctx.bus.emit('reminder:' + ev.type, { noteId: ev.noteId });
        ctx.pet.enqueue({ type: ev.type, noteId: ev.noteId });
      }
    } else ctx.pet.pump();
  }
  function start() { if (!timer) timer = setInterval(tickOnce, 1000); }
  function stop() { clearInterval(timer); timer = null; }

  Object.assign(ctx.notes, { startReminderLoop: start, stopReminderLoop: stop });
}

module.exports = { init };
