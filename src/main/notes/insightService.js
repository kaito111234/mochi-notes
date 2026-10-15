'use strict';
// "Hiểu note": ctx.notes.insight / applySuggestion / quickCapture + IPC notes2:insight|applySuggestion|quickCapture.
// Được nạp từ cuối init của ipcNotes.js. Phần thuần ở insightLogic.js. Hợp đồng: docs/rooms/notes/API2.md mục 4-5.
const { ipcMain } = require('electron');
const S = require('./scheduler.js');
const L = require('./insightLogic.js');

const MAX_TEXT = 20000;

function understandText(text, now) {
  try { return require('../../shared/understand/index.js').understand(String(text || ''), now); }
  catch (e) { if (!(e && e.code === 'MODULE_NOT_FOUND')) console.error('[notes] understand', e && e.message); return null; }
}

function init(ctx) {
  const N = ctx.notes;
  const ens = n => { if (typeof S.ensureReminders === 'function') S.ensureReminders(n); return n; };
  const remindersOf = n => (n && Array.isArray(n.reminders)) ? n.reminders : (n && n.reminder ? [n.reminder] : []);
  const fail = message => ({ ok: false, message });
  const commit = (n, now) => { n.updatedAt = now; ctx.store.save(); N.noteChanged(n); };

  // ---------- insight
  function insight(noteIdOrText) {
    try {
      if (typeof noteIdOrText !== 'string') return null;
      const now = Date.now();
      const note = noteIdOrText.length <= 100 ? ctx.findNote(noteIdOrText) : null;
      const text = note ? note.text : noteIdOrText.slice(0, MAX_TEXT);
      const ins = understandText(text, now);
      if (!ins) return null;
      if (note) ens(note);
      return L.buildView(ins, note, now);
    } catch (e) { console.error('[notes] insight', e); return null; }
  }

  // ---------- applySuggestion
  function applyRemind(note, ins, items, now) {
    let count = 0, last = null;
    for (const it of items) {
      const p = L.reminderParams(it);
      if (!p || it.due <= now) continue;
      const cur = remindersOf(note).find(r => r.key && r.key === it.key);
      S.upsertReminder(note, cur ? cur.id : null, p, now);
      count++; last = it;
    }
    if (!count) return fail('Việc này đã qua giờ rồi nên tớ chưa đặt nhắc được');
    commit(note, now);
    const msg = count === 1
      ? 'Đã đặt nhắc "' + last.title + '" lúc ' + L.whenText(last.due, now)
      : 'Đã đặt nhắc cho ' + count + ' việc';
    return { ok: true, message: msg, note };
  }

  function needTextOnly(note) {
    return /<img\b/i.test(note.html || '') ? fail('Note có ảnh nên tớ chưa biến đổi được, cậu tự sửa giúp tớ nha') : null;
  }

  function applyAlarm(note, ins, sug, now) {
    if (!ctx.alarms || typeof ctx.alarms.create !== 'function') return fail('Chức năng báo thức chưa sẵn sàng');
    const it = L.itemByKey(ins, sug.itemKey || L.idTail(sug.id));
    const p = L.alarmParams(it, note.id, now);
    if (!p) return fail('Tớ không thấy giờ để đặt báo thức');
    try {
      const old = typeof ctx.alarms.list === 'function' ? ctx.alarms.list() : [];
      const dup = old.find(a => a && a.noteId === note.id && a.time === p.time && a.label === p.label && a.enabled !== false);
      if (dup) return { ok: true, message: 'Báo thức ' + p.time + ' đã có rồi nha', alarm: dup };
    } catch (_) { /* bỏ qua */ }
    const alarm = ctx.alarms.create(p);
    if (!alarm) return fail('Không đặt được báo thức');
    return { ok: true, message: 'Đã đặt báo thức ' + p.time, alarm };
  }

  function applyChecklist(note, now) {
    const bad = needTextOnly(note); if (bad) return bad;
    const r = L.checklistHtml(note.text);
    if (!r.count) return fail('Note chưa có dòng nào để thành checklist');
    if (!r.changed) return { ok: true, message: 'Note đã là checklist rồi nha', note };
    const n = N.updateNote(note.id, { html: r.html });
    return { ok: true, message: 'Đã chuyển thành checklist (' + r.count + ' mục)', note: n || note };
  }

  function applySplit(note, ins, now) {
    const bad = needTextOnly(note); if (bad) return bad;
    const plan = L.splitPlan(note.text, ins);
    if (!plan) return fail('Không có gì để tách');
    const created = [];
    let nearId = note.id;
    for (const part of plan.parts) {
      const c = N.createNote({ html: L.textToHtml(part.text), color: note.color, nearId });
      if (c) { created.push(c); nearId = c.id; }
    }
    const kept = N.updateNote(note.id, { html: L.textToHtml(plan.keepText) });
    return { ok: true, message: 'Đã tách thành ' + (created.length + 1) + ' note', note: kept || note, notes: [kept || note].concat(created) };
  }

  function applySuggestion(noteId, suggestionId) {
    try {
      if (typeof noteId !== 'string' || typeof suggestionId !== 'string' || suggestionId.length > 3000) return fail('Yêu cầu không hợp lệ');
      const note = ctx.findNote(noteId);
      if (!note) return fail('Không thấy note này nữa');
      ens(note);
      const now = Date.now();
      const ins = understandText(note.text, now);
      if (!ins) return fail('Tớ chưa đọc hiểu được note này');
      const sug = (ins.suggestions || []).find(s => s && s.id === suggestionId);
      if (!sug) return fail('Gợi ý này không còn nữa');
      const { clipboard, shell } = require('electron');
      switch (sug.kind) {
        case 'remind': {
          const it = L.itemByKey(ins, sug.itemKey || L.idTail(sug.id));
          return it ? applyRemind(note, ins, [it], now) : fail('Không thấy việc này trong note');
        }
        case 'remind-all': {
          const r = applyRemind(note, ins, ins.items || [], now);
          return r;
        }
        case 'alarm': return applyAlarm(note, ins, sug, now);
        case 'checklist': return applyChecklist(note, now);
        case 'split': return applySplit(note, ins, now);
        case 'call': case 'message': {
          const digits = L.phoneDigits(L.idTail(sug.id) || (sug.data && (sug.data.number || sug.data)));
          if (!digits) return fail('Số điện thoại không hợp lệ');
          clipboard.writeText(digits);
          return { ok: true, message: 'Đã chép số ' + digits + ' vào bộ nhớ tạm, cậu dán vào ' + (sug.kind === 'call' ? 'điện thoại để gọi' : 'tin nhắn') + ' nha', copied: digits };
        }
        case 'link': {
          const url = L.safeUrl(L.idTail(sug.id) || (sug.data && (sug.data.url || sug.data)));
          if (!url) return fail('Link này không an toàn để mở');
          shell.openExternal(url).catch(() => {});
          return { ok: true, message: 'Đang mở link' };
        }
        case 'email': {
          const addr = L.safeEmail(L.idTail(sug.id) || (sug.data && (sug.data.email || sug.data)));
          if (!addr) return fail('Địa chỉ email không hợp lệ');
          shell.openExternal('mailto:' + addr).catch(() => {});
          return { ok: true, message: 'Đang mở thư gửi ' + addr };
        }
        default: return fail('Tớ chưa biết làm gợi ý này');
      }
    } catch (e) { console.error('[notes] applySuggestion', e); return fail('Có lỗi khi làm gợi ý này'); }
  }

  // ---------- quickCapture
  function pickLine(vars, fallback) {
    try {
      if (ctx.persona && typeof ctx.persona.pick === 'function') {
        const r = ctx.persona.pick('note_created', vars);
        const t = typeof r === 'string' ? r : (r && typeof r.text === 'string' ? r.text : '');
        if (t && t.trim()) return t.trim();
      }
    } catch (_) { /* dùng câu mặc định */ }
    return fallback;
  }

  function quickCapture(text, opts) {
    try {
      const raw = typeof text === 'string' ? text.slice(0, MAX_TEXT) : '';
      if (!raw.trim()) return { ok: false, message: 'Cậu chưa nói gì để tớ ghi cả' };
      const source = opts && typeof opts.source === 'string' ? opts.source : '';
      const html = L.textToHtml(raw);
      let note;
      if (source === 'pet' && ctx.settings().allHidden) {
        // đang ẩn tất cả: ghi im lặng, không mở cửa sổ
        note = N.makeNote({ html });
        ens(note);
        ctx.store.data.notes.push(note);
        ctx.store.save();
        N.notifyList();
        ctx.bus.emit('note:created', { note });
      } else {
        note = N.createNote({ html });
        ens(note);
      }
      const now = Date.now();
      const upcoming = remindersOf(note).filter(r => !r.done && r.due > now).sort((a, b) => a.due - b.due)
        .map(r => ({ title: r.title, due: r.due }));
      const title = S.noteTitle(note.text) || 'ghi chú';
      const def = L.buildReply(title, upcoming, now);
      const reply = pickLine({ title, time: upcoming[0] ? L.hm(upcoming[0].due) : '', count: upcoming.length }, def);
      const ins = understandText(note.text, now);
      return { ok: true, note, insight: ins ? L.buildView(ins, note, now) : null, reply };
    } catch (e) { console.error('[notes] quickCapture', e); return { ok: false, message: 'Không ghi được note' }; }
  }

  Object.assign(N, { insight, applySuggestion, quickCapture });

  const h = (ch, fn) => ipcMain.handle(ch, (_e, ...a) => { try { return fn(...a); } catch (e) { console.error('[notes] ' + ch, e); return fail('Có lỗi xảy ra'); } });
  h('notes2:insight', v => insight(v));
  h('notes2:applySuggestion', (id, sid) => applySuggestion(id, sid));
  h('notes2:quickCapture', (text, o) => quickCapture(text, o && typeof o === 'object' ? { source: o.source } : {}));
}

module.exports = { init, understandText };
