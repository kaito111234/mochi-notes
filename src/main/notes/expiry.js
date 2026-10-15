'use strict';
// Note hết hạn (thuần): quyết định note đang dán nào nên hỏi người dùng dọn. Không bao giờ tự xoá.
const H = 3600000;
const OVERDUE_MS = 24 * H;
const RECENT_EDIT_MS = 10 * 60000;

const remindersOf = n => (n && Array.isArray(n.reminders)) ? n.reminders : (n && n.reminder ? [n.reminder] : []);

/** Ngày địa phương YYYY-MM-DD. */
function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** insight: kết quả understand() (có .checklist {done,total}) hoặc null. -> 'done'|'overdue'|'checklist'|null */
function expiredReason(note, now, insight, opts) {
  if (!note || typeof note !== 'object' || !note.visible) return null;
  // vừa sửa thì chờ 10 phút (tự dọn không giật note đang dùng); người dùng ra lệnh dọn (opts.fresh) thì bỏ qua
  if (!(opts && opts.fresh) && typeof note.updatedAt === 'number' && now - note.updatedAt < RECENT_EDIT_MS) return null;
  const rs = remindersOf(note).filter(r => r && typeof r === 'object');
  if (rs.some(r => r.fired && !r.done && typeof r.due === 'number' && now - r.due > OVERDUE_MS)) return 'overdue';
  if (rs.length && rs.every(r => r.done) && !rs.some(r => r.repeat)) return 'done';
  const c = insight && insight.checklist;
  if (c && c.total >= 1 && c.done === c.total) return 'checklist';
  return null;
}

module.exports = { OVERDUE_MS, RECENT_EDIT_MS, dayKey, expiredReason, remindersOf };
