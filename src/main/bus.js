'use strict';
// Bus sự kiện dùng chung giữa các module. Sự kiện tối thiểu:
//   note:created {note} · note:updated {note} · note:deleted {id}
//   reminder:pre {noteId} · reminder:due {noteId} · reminder:done {noteId,onTime} · reminder:snoozed {noteId,minutes}
//   settings:changed {settings}
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(50);
const rawEmit = bus.emit.bind(bus);
/** emit(name, payload): lỗi ở người nghe được log, không làm hỏng người phát. */
bus.emit = function emit(name, payload) {
  try { return rawEmit(name, payload); } catch (err) { console.error('[bus] lỗi khi phát', name, err); return false; }
};

module.exports = bus;
