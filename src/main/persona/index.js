'use strict';
// Phòng persona: chọn câu thoại cho bé Mochi và phản ứng với sự kiện (không thuộc hàng đợi nhắc lịch của core).
const fs = require('fs');
const path = require('path');
const dialogue = require('../../shared/dialogue.js');

const LINES_FILE = path.join(__dirname, '../../../assets/dialogue/vi.json');
const MAX_RECENT = 20;
const MIN = 6e4;
const KIND_EVENT = { click: 'click', 'pat-head': 'pat_head', 'pat-body': 'pat_body', lift: 'lift', drop: 'drop', feed: 'feed' };

const defaults = () => ({ recentLines: [], name: '', settings: { chatter: true, chatterEveryMin: 20 } });

function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  if (Array.isArray(raw.recentLines)) d.recentLines = raw.recentLines.filter(x => typeof x === 'string').slice(-MAX_RECENT);
  if (typeof raw.name === 'string') d.name = raw.name;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  if (typeof s.chatter === 'boolean') d.settings.chatter = s.chatter;
  if (Number.isFinite(s.chatterEveryMin) && s.chatterEveryMin > 0) d.settings.chatterEveryMin = s.chatterEveryMin;
  if (raw.greeted && typeof raw.greeted === 'object' && !Array.isArray(raw.greeted)) {
    d.greeted = {};
    for (const k of Object.keys(raw.greeted)) if (typeof raw.greeted[k] === 'string') d.greeted[k] = raw.greeted[k];
  }
  return d;
}

const pad = n => String(n).padStart(2, '0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/** Buổi phù hợp với giờ, hoặc null. */
function bucketOf(hour) {
  if (hour >= 5 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 13) return 'noon';
  if (hour >= 17 && hour <= 21) return 'evening';
  if (hour >= 23 || hour <= 4) return 'late_night';
  return null;
}

/** Tiêu đề note: dòng đầu có chữ, bỏ HTML, tối đa 40 ký tự. */
function titleOf(note) {
  if (!note) return '';
  let s = typeof note.text === 'string' ? note.text : '';
  if (!s.trim() && typeof note.html === 'string') {
    s = note.html.replace(/<\s*(br|\/div|\/p|\/li)[^>]*>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }
  const line = s.split(/\r?\n/).map(x => x.trim()).find(Boolean) || '';
  return line.length > 40 ? line.slice(0, 39).trimEnd() + '…' : line;
}

function reminderAt(n) {
  const r = n && n.reminder;
  if (!r) return null;
  const t = Number.isFinite(r.due) ? r.due : r.at;
  return Number.isFinite(t) ? t : null;
}

function createPersona(ctx, opts) {
  opts = opts || {};
  const now = opts.now || (() => Date.now());
  const bus = ctx.bus;
  const box = ctx.store.section('persona', defaults, normalize);
  const st = { mode: 'normal', level: undefined, energy: undefined, mood: undefined };
  let lines = [];
  const lastInteract = {};
  let lastWake = -Infinity;
  let lastChatter = now();

  function reload() {
    try {
      lines = JSON.parse(fs.readFileSync(opts.file || LINES_FILE, 'utf8').replace(/^﻿/, ''));
      if (!Array.isArray(lines)) throw new Error('không phải mảng');
    } catch (e) { console.error('[persona] không nạp được thoại:', e.message); lines = []; }
    persona.lines = lines;
    return lines;
  }

  function overdue() {
    try {
      const t = now();
      return ctx.store.data.notes.filter(n => { const a = reminderAt(n); return a !== null && a < t && !n.done && !n.reminder.done; }).length;
    } catch (_) { return 0; }
  }

  function state(vars) {
    const d = new Date(now());
    const s = { mode: st.mode, hour: d.getHours(), weekday: d.getDay() /* 0=CN, như Repeat.byDay */, overdue: overdue() };
    if (st.level !== undefined) s.level = st.level;
    if (st.energy !== undefined) s.energy = st.energy;
    if (st.mood !== undefined) s.mood = st.mood;
    if (vars && vars.intent) s.intent = vars.intent;
    return s;
  }

  function pick(event, vars) {
    vars = Object.assign({}, vars);
    if (!vars.name && box.name) vars.name = box.name;
    const r = dialogue.pick(lines, event, vars, state(vars), box.recentLines);
    if (!r) return null;
    box.recentLines.push(r.id);
    if (box.recentLines.length > MAX_RECENT) box.recentLines.splice(0, box.recentLines.length - MAX_RECENT);
    try { if (ctx.store.save) ctx.store.save(); } catch (_) { /* bỏ qua */ }
    return r;
  }

  const persona = { pick, lines, reload, state: () => state() };

  /** Chọn câu rồi phát persona:line. Trả true nếu có nói. */
  function say(event, vars, priority, ttlMs) {
    const r = pick(event, vars);
    if (!r) return false;
    bus.emit('persona:line', { text: r.text, face: r.face, anim: r.anim, priority, ttlMs });
    return true;
  }

  function greet(bucket) {
    if (!bucket) return false;
    const day = dayKey(new Date(now()));
    if (box.greeted && box.greeted[bucket] === day) return false;
    if (!say(bucket, {}, 15, 12000)) return false;
    box.greeted = Object.assign({}, box.greeted, { [bucket]: day });
    return true;
  }

  const safe = fn => payload => { try { fn(payload || {}); } catch (e) { console.error('[persona]', e); } };
  const noteOf = id => { try { return ctx.findNote ? ctx.findNote(id) : ctx.store.data.notes.find(n => n.id === id); } catch (_) { return null; } };
  const noteVars = n => { const v = { title: titleOf(n) }; if (n && n.reminder && n.reminder.intent) v.intent = n.reminder.intent; return v; };

  bus.on('game:mode', safe(p => {
    if (typeof p.mode === 'string') st.mode = p.mode;
    if (Number.isFinite(p.energy)) st.energy = p.energy;
    if (Number.isFinite(p.mood)) st.mood = p.mood;
  }));
  bus.on('game:levelup', safe(p => {
    if (Number.isFinite(p.level)) st.level = p.level;
    say('levelup', { level: p.level }, 30, 8000);
  }));
  // thưởng từ Mochi Focus / checklist hằng ngày: bé đã tự nói trong màn của mình (phòng extras), không chen câu khác
  bus.on('game:reward', safe(p => { if (p.reason === 'focus' || p.reason === 'daily') return; say('reward', { count: p.candy }, 30, 6000); }));

  bus.on('pet:interact', safe(p => {
    const event = KIND_EVENT[p.kind];
    if (!event) return;
    const t = now();
    if (lastInteract[p.kind] !== undefined && t - lastInteract[p.kind] < 4000) return;
    lastInteract[p.kind] = t;
    const item = p.itemName || p.itemId;
    say(event, item ? { item } : {}, 20, 6000);
  }));

  bus.on('app:startup', safe(() => {
    say('startup', {}, 15, 15000);
    greet(bucketOf(new Date(now()).getHours()));
  }));
  bus.on('app:resume', safe(() => {
    const t = now();
    if (t - lastWake < 10 * MIN) return;
    if (say('wake', {}, 15, 8000)) lastWake = t;
  }));
  bus.on('pet:idleTick', safe(p => {
    if (!box.settings.chatter || !(p.quietMs >= 60000)) return;
    const t = now();
    if (t - lastChatter < box.settings.chatterEveryMin * MIN) return;
    lastChatter = t;
    if (greet(bucketOf(new Date(t).getHours()))) return;
    say(st.energy !== undefined && st.energy < 25 ? 'sleepy' : 'idle', {}, 10, 8000);
  }));

  bus.on('reminder:done', safe(p => {
    say(p.onTime === false ? 'done_late' : 'done', noteVars(noteOf(p.noteId)), 30, 8000);
  }));
  bus.on('reminder:snoozed', safe(p => {
    say('snooze', Object.assign(noteVars(noteOf(p.noteId)), { left: p.minutes + ' phút' }), 30, 8000);
  }));
  const alarmLabel = (p, id) => {
    if (typeof p.label === 'string' && p.label) return p.label;
    try {
      let a = ctx.alarms && typeof ctx.alarms.get === 'function' ? ctx.alarms.get(id) : null;
      if (!a) { const l = ctx.store.data.alarms && ctx.store.data.alarms.list; a = Array.isArray(l) ? l.find(x => x.id === id) : null; }
      return a && a.label ? a.label : '';
    } catch (_) { return ''; }
  };
  bus.on('alarm:stopped', safe(p => { say('alarm_stop', { label: alarmLabel(p, p.alarmId) }, 30, 8000); }));
  bus.on('alarm:snoozed', safe(p => {
    say('alarm_snooze', { label: alarmLabel(p, p.alarmId), left: p.minutes + ' phút' }, 30, 8000);
  }));

  // Mốc reminder đã thấy theo note; chỉ nói khi có giờ mới trong tương lai.
  const seenAt = new Map();
  const lastNoteSay = new Map();
  try { for (const n of ctx.store.data.notes) if (n && n.id !== undefined) seenAt.set(n.id, reminderAt(n)); } catch (_) { /* bỏ qua */ }
  const onNote = safe(p => {
    const n = p.note;
    if (!n || n.id === undefined) return;
    const at = reminderAt(n);
    const prev = seenAt.has(n.id) ? seenAt.get(n.id) : null;
    seenAt.set(n.id, at);
    const t = now();
    if (at === null || at <= t || n.done || at === prev) return;
    if (lastNoteSay.has(n.id) && t - lastNoteSay.get(n.id) < 15000) return;
    const v = noteVars(n);
    const d = new Date(at);
    v.time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (say('note_created', v, 20, 6000)) lastNoteSay.set(n.id, t);
  });
  bus.on('note:created', onNote);
  bus.on('note:updated', onNote);
  bus.on('note:deleted', safe(p => { seenAt.delete(p.id); lastNoteSay.delete(p.id); }));

  reload();
  ctx.persona = persona;
  return persona;
}

function init(ctx) { return createPersona(ctx); }

module.exports = { init, _internal: { createPersona, normalize, titleOf, bucketOf, defaults } };
