'use strict';
// Nhắc lặp cho note: IPC notes2:setRepeat + nhân bản reminder.repeat vào box.noteMeta
// (store.js bỏ khoá lạ trong reminder khi nạp nên phải khôi phục từ đây lúc khởi động).
const { ipcMain } = require('electron');
const S = require('./scheduler.js');
const { getBox, normRepeat } = require('../alarms/box.js');

function init(ctx) {
  const box = () => getBox(ctx);

  /** Đồng bộ một note vào noteMeta. Trả true nếu có thay đổi. */
  function syncNote(n) {
    const meta = box().noteMeta;
    const rep = n && n.reminder && n.reminder.repeat ? normRepeat(n.reminder.repeat) : null;
    const cur = meta[n.id] && meta[n.id].repeat;
    if (JSON.stringify(rep || null) === JSON.stringify(cur || null)) return false;
    if (rep) meta[n.id] = Object.assign(meta[n.id] || {}, { repeat: rep });
    else if (meta[n.id]) {
      delete meta[n.id].repeat;
      if (!Object.keys(meta[n.id]).length) delete meta[n.id];
    }
    return true;
  }

  // Khôi phục lúc khởi động
  let dirty = false;
  const meta = box().noteMeta;
  for (const n of ctx.store.data.notes) {
    const m = meta[n.id];
    const list = Array.isArray(n.reminders) ? n.reminders : (n.reminder ? [n.reminder] : []);
    // chỉ khôi phục khi chưa nhắc nào có repeat (store mới đã giữ repeat trong reminders[])
    if (n.reminder && m && m.repeat && !list.some(r => r && r.repeat)) n.reminder.repeat = Object.assign({}, m.repeat);
    else if (!n.reminder && !list.length && m && m.repeat) { delete m.repeat; if (!Object.keys(m).length) delete meta[n.id]; dirty = true; }
  }
  if (dirty) ctx.store.save();

  const onChange = p => { const n = p && p.note; if (n && syncNote(n)) ctx.store.save(); };
  ctx.bus.on('note:updated', onChange);
  ctx.bus.on('note:created', onChange);
  ctx.bus.on('note:deleted', p => {
    if (p && ctx.notes.isTrashed && ctx.notes.isTrashed(p.id)) return;   // giữ meta khi vào thùng rác
    if (p && p.id && box().noteMeta[p.id]) {
      delete box().noteMeta[p.id].repeat;
      if (!Object.keys(box().noteMeta[p.id]).length) delete box().noteMeta[p.id];
      ctx.store.save();
    }
  });

  function setNoteRepeat(id, repeat, reminderId) {
    const n = ctx.findNote(id);
    if (!n) return null;
    const rep = repeat ? normRepeat(repeat) : null;
    if (repeat && !rep) return n;                      // repeat hỏng: không đổi
    if (S.setRepeat(n, rep, Date.now(), typeof reminderId === 'string' && reminderId ? reminderId : undefined)) {
      n.updatedAt = Date.now();
      syncNote(n);
      ctx.store.save();
      ctx.notes.noteChanged(n);
    }
    return n;
  }

  ctx.notes.setNoteRepeat = setNoteRepeat;
  ipcMain.handle('notes2:setRepeat', (_e, id, repeat, rid) => setNoteRepeat(String(id), repeat, typeof rid === 'string' ? rid : undefined));
}

module.exports = { init };
