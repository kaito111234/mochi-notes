'use strict';
// Ghi nhanh qua bé: bong bóng nhập trong cửa sổ bé -> tạo note (ARCH Đợt 2 mục W).
const MAX_DRAFT = 2000;
const FALLBACK = {
  captureSaved: 'Tớ ghi vào note rồi nha.',
  captureSavedTime: 'Tớ ghi rồi nha. {time} tớ nhắc cậu {title}.',
  captureBusy: 'Đợi tớ nhắc xong việc này đã nha.',
  captureFail: 'Ơ, tớ ghi không được. Cậu thử lại giúp tớ nha.'
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function textToHtml(t) { return escapeHtml(t).replace(/\r?\n/g, '<br>'); }
function fillVars(tpl, v) {
  return String(tpl).replace(/\{(\w+)\}/g, (_m, k) => (v && v[k] != null ? String(v[k]) : '')).replace(/\s{2,}/g, ' ').trim();
}
const pad = n => String(n).padStart(2, '0');

function createCapture(core) {
  const { ctx, box } = core;
  let open_ = false;
  let saveTimer = null;
  let lateUntil = 0;                 // sau suspend/close: còn nhận captureDraft cuối từ renderer ~1.5s

  function lineText(r) { return r && typeof r === 'object' ? r.text : (typeof r === 'string' ? r : null); }
  function pickLine(key, vars, persona) {
    try {
      if (persona && ctx.persona && typeof ctx.persona.pick === 'function') {
        const t = lineText(ctx.persona.pick(persona, vars));
        if (t) return t;
      }
    } catch (_) { /* dùng câu mặc định */ }
    try {
      const L = require('../pet/lines.js');
      if (typeof L.pick === 'function') { const t = lineText(L.pick(key, vars)); if (t) return t; }
    } catch (_) { /* dùng câu dự phòng */ }
    return fillVars(FALLBACK[key], vars);
  }
  function say(text) { try { core.actor.say(text, { ttlMs: 5000 }); } catch (_) { /* bỏ qua */ } }
  function setBusy(on) { try { if (core.brain && typeof core.brain.setBusy === 'function') core.brain.setBusy(on); } catch (_) { /* bỏ qua */ } }

  function setDraft(text) {
    const t = String(text == null ? '' : text).slice(0, MAX_DRAFT);
    if (box.draft === t) return;
    box.draft = t;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { ctx.store.save(); } catch (_) { /* bỏ qua */ } }, 800);
  }

  function stageBusy() {
    try {
      const st = ctx.pet.stage;
      if (!st || typeof st.current !== 'function') return false;
      const c = st.current();
      return !!(c && (c.priority || 0) >= 60);
    } catch (_) { return false; }
  }

  function close() {
    if (!open_) return;
    open_ = false;
    lateUntil = Date.now() + 1500;
    core.window.cmd({ op: 'captureClose' });
    core.window.setFocusable(false);
    setBusy(false);
    if (core.shown && !core.stage) { try { core.toIdle(); } catch (_) { /* bỏ qua */ } }
  }
  function suspend() { close(); }
  function isOpen() { return open_; }

  async function open() {
    if (open_) { core.window.focus(); return; }
    if (stageBusy()) { say(pickLine('captureBusy', {})); return; }
    if (!core.shown) {
      try { await core.actor.show({ corner: true }); } catch (_) { /* bỏ qua */ }
      if (!core.shown) return;
    }
    if (stageBusy()) { say(pickLine('captureBusy', {})); return; }
    open_ = true;
    setBusy(true);
    try { core.actor.play('write', { loop: true }); } catch (_) { /* bỏ qua */ }
    core.window.setFocusable(true);
    core.window.cmd({ op: 'capture', draft: box.draft || '', prompt: 'Cậu muốn tớ ghi gì?' });
    core.window.focus();
  }

  function findTime(note) {
    let due = null;
    const rs = Array.isArray(note.reminders) ? note.reminders : [];
    for (const r of rs) {
      const d = r && r.due; if (typeof d === 'number' && isFinite(d) && (due == null || d < due)) due = d;
    }
    if (due == null && note.reminder && typeof note.reminder.due === 'number') due = note.reminder.due;
    if (due == null) return null;
    const d = new Date(due), now = new Date();
    let s = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 86400000);
    if (diff === 1) s += ' mai';
    else if (diff !== 0) s += ' ngày ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
    return s;
  }
  function makeTitle(text) {
    const first = String(text).split(/\r?\n/).map(x => x.trim()).find(Boolean) || '';
    return first.length > 40 ? first.slice(0, 39).trimEnd() + '…' : first;
  }

  async function submit(text, source) {
    text = String(text == null ? '' : text).trim().slice(0, MAX_DRAFT);
    if (!text) { close(); return null; }
    let res;
    try {
      const N = ctx.notes || {};
      if (typeof N.quickCapture === 'function') res = await N.quickCapture(text, { source: source === 'drop' ? 'drop' : 'pet' });
      else res = N.createNote({ html: textToHtml(text) });
    } catch (e) {
      console.error('[petcore] ghi nhanh lỗi', e && e.message);
      close();
      say(pickLine('captureFail', {}));
      return null;
    }
    const note = res && res.note ? res.note : res;
    clearTimeout(saveTimer);
    box.draft = ''; lateUntil = 0;
    try { ctx.store.save(); } catch (_) { /* bỏ qua */ }
    if (open_) { open_ = false; core.window.cmd({ op: 'captureClose' }); core.window.setFocusable(false); setBusy(false); }
    const time = note && typeof note === 'object' ? findTime(note) : null;
    const title = makeTitle(text);
    say(time ? pickLine('captureSavedTime', { title, time }) : pickLine('captureSaved', {}));
    if (core.shown && !core.stage) {
      try { core.actor.play('happy', {}).then(() => { if (!open_ && !core.stage) core.toIdle(); }); } catch (_) { /* bỏ qua */ }
    }
    return note || null;
  }

  function onDraft(text) { if (open_ || Date.now() < lateUntil) setDraft(text); }
  return { open, close, suspend, isOpen, submit, setDraft, onDraft };
}

module.exports = { createCapture };
