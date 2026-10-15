'use strict';
// Mặt tiền sân khấu của bé: giữ chữ ký API 0.1 (enqueue, enqueueHello, pump, syncIdle, ensureMascot, dropNote, isBusy)
// nhưng mọi thứ đi qua ctx.pet.stage (stage.js). Cửa sổ bé thật do petcore (ctx.pet.actor) sở hữu.
const { Notification } = require('electron');
const stageMod = require('./stage.js');

const NOTE_KINDS = new Set(['pre', 'due', 'nag']);
const KINDS = new Set(['pre', 'due', 'nag', 'hello', 'alarm', 'memo']);

function init(ctx) {
  const stage = stageMod.create(ctx, { Notification });
  const actor = () => ctx.pet.actor || null;
  const sameNote = (it, id) => NOTE_KINDS.has(it.kind) && it.payload && it.payload.noteId === id;

  /** event: {type:'pre'|'due'|'nag'|'hello'|'alarm'|'memo', noteId?, ...} */
  function enqueue(event) {
    if (!event || !KINDS.has(event.type)) return null;
    if (event.type === 'hello') return enqueueHello();
    const payload = Object.assign({}, event);
    delete payload.type;
    return stage.request({ kind: event.type, payload });
  }
  function enqueueHello() {
    if (stage.has(it => it.kind === 'hello')) return null;
    return stage.request({ kind: 'hello', payload: {} });
  }
  function dropNote(id) { stage.cancelWhere(it => sameNote(it, id)); }

  Object.assign(ctx.pet, {
    stage: {
      request: stage.request, cancel: stage.cancel, current: stage.current, size: stage.size, nudge: stage.nudge
    },
    enqueue, enqueueHello,
    pump: () => stage.kick(),
    syncIdle: () => { const a = actor(); if (a && typeof a.applyVisibility === 'function') a.applyVisibility(); },
    ensureMascot: () => { const a = actor(); return a && typeof a.ensure === 'function' ? a.ensure() : null; },
    dropNote,
    isBusy: () => !!stage.current() || stage.busy(40)
  });

  // ---- bus
  const { bus } = ctx;
  bus.on('note:deleted', ({ id } = {}) => dropNote(id));
  const noteResolved = ({ noteId } = {}) => dropNote(noteId);
  bus.on('reminder:done', noteResolved);
  bus.on('reminder:snoozed', noteResolved);
  bus.on('memo:due', ev => {
    if (!ev) return;
    stage.request({ kind: 'memo', payload: { memoId: ev.memoId, text: String(ev.text || ''), when: ev.when } });
  });
  bus.on('alarm:ring', ev => {
    if (!ev) return;
    stage.request({ kind: 'alarm', payload: { alarmId: ev.alarmId, label: ev.label, noteId: ev.noteId } });
  });
  const alarmEnded = ev => {
    if (!ev) return;
    stage.cancelWhere(it => it.kind === 'alarm' && it.payload.alarmId === ev.alarmId);
  };
  bus.on('alarm:stopped', alarmEnded);
  bus.on('alarm:snoozed', alarmEnded);
  bus.on('persona:line', ev => {
    if (!ev || typeof ev.text !== 'string' || !ev.text.trim()) return;
    const pr = Number.isFinite(ev.priority) ? Math.min(ev.priority, 59) : 10;
    stage.request({
      kind: pr >= 30 ? 'reward' : 'chatter', priority: pr,
      payload: { text: ev.text, face: ev.face, anim: ev.anim }, ttlMs: ev.ttlMs
    });
  });
}

module.exports = { init };
