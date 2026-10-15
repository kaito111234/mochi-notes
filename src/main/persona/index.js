'use strict';
// Phòng persona: chọn câu thoại cho bé Mochi và phản ứng với sự kiện (không thuộc hàng đợi nhắc lịch của core).
const fs = require('fs');
const path = require('path');
const dialogue = require('../../shared/dialogue.js');

const LINES_FILE = path.join(__dirname, '../../../assets/dialogue/vi.json');
const MAX_RECENT = 20;
const MIN = 6e4;
// click/pat/feed do petcore/game tự nói; persona chỉ nói khi nhấc lên/thả xuống (tránh nói 2 lần).
const KIND_EVENT = { lift: 'lift', drop: 'drop' };
const DONE_DELAY_MS = 400;     // hoãn câu done/snooze để chờ core (pet:stageAction) tự nói
const REWARD_QUIET_MS = 5000;  // sau một câu priority >= 30 thì không nói reward
const EXPIRED_REASONS = ['done', 'overdue', 'checklist'];

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

/** Danh sách nhắc của note: `reminders` nếu là mảng, không thì [reminder] nếu có. */
function remindersOf(note) {
  if (!note) return [];
  if (Array.isArray(note.reminders)) return note.reminders.filter(r => r && typeof r === 'object');
  return note.reminder && typeof note.reminder === 'object' ? [note.reminder] : [];
}

function dueOf(r) {
  if (!r) return null;
  const t = Number.isFinite(r.due) ? r.due : r.at;
  return Number.isFinite(t) ? t : null;
}

const keyOf = r => r.id + ':' + dueOf(r);

/** Chuỗi JSON khoá đã sắp xếp (so sánh bộ đồ đang mặc). */
const stableJson = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k]]));

function createPersona(ctx, opts) {
  opts = opts || {};
  const now = opts.now || (() => Date.now());
  const setT = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimeout || (h => clearTimeout(h));
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
      return ctx.store.data.notes.filter(n => !n.done && remindersOf(n).some(r => { const a = dueOf(r); return !r.done && a !== null && a < t; })).length;
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
  /** Biến title/intent cho note; có reminderId thì ưu tiên reminder đó. */
  const noteVars = (n, reminderId) => {
    const rs = remindersOf(n);
    const r = (reminderId !== undefined && rs.find(x => x.id === reminderId)) || n && n.reminder || rs[0] || null;
    const v = { title: (r && r.title) || titleOf(n) };
    if (r && r.intent) v.intent = r.intent;
    return v;
  };

  // Thời điểm câu priority >= 30 gần nhất (của mình, game hay core) để không khen chồng lên.
  let lastBig = -Infinity;
  bus.on('persona:line', safe(l => { if (Number.isFinite(l.priority) && l.priority >= 30) lastBig = now(); }));
  // Câu done/snooze đang hoãn: { noteId, timer }
  const pendingDone = [];
  function deferSay(noteId, fn) {
    const e = { noteId };
    e.timer = setT(() => {
      const i = pendingDone.indexOf(e);
      if (i >= 0) pendingDone.splice(i, 1);
      try { fn(); } catch (err) { console.error('[persona]', err); }
    }, DONE_DELAY_MS);
    pendingDone.push(e);
  }
  bus.on('pet:stageAction', safe(p => {
    if (p.noteId === undefined) return;
    for (let i = pendingDone.length - 1; i >= 0; i--) {
      if (pendingDone[i].noteId === p.noteId) { clearT(pendingDone[i].timer); pendingDone.splice(i, 1); }
    }
  }));

  bus.on('game:mode', safe(p => {
    if (Number.isFinite(p.level)) st.level = p.level;
    if (typeof p.mode === 'string') st.mode = p.mode;
    if (Number.isFinite(p.energy)) st.energy = p.energy;
    if (Number.isFinite(p.mood)) st.mood = p.mood;
  }));
  bus.on('game:levelup', safe(p => {
    if (Number.isFinite(p.level)) st.level = p.level;
    say('levelup', { level: p.level }, 30, 8000);
  }));
  bus.on('game:reward', safe(p => {
    if (pendingDone.length || now() - lastBig < REWARD_QUIET_MS) return;
    say('reward', { count: p.candy }, 30, 6000);
  }));

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
    const v = noteVars(noteOf(p.noteId), p.reminderId);
    deferSay(p.noteId, () => say(p.onTime === false ? 'done_late' : 'done', v, 30, 8000));
  }));
  bus.on('reminder:snoozed', safe(p => {
    const v = Object.assign(noteVars(noteOf(p.noteId), p.reminderId), { left: p.minutes + ' phút' });
    deferSay(p.noteId, () => say('snooze', v, 30, 8000));
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

  // Khoá `id:due` của các nhắc đã thấy theo note; chỉ nói khi có nhắc tương lai với khoá mới.
  const seenKeys = new Map();
  const lastNoteSay = new Map();
  try { for (const n of ctx.store.data.notes) if (n && n.id !== undefined) seenKeys.set(n.id, new Set(remindersOf(n).map(keyOf))); } catch (_) { /* bỏ qua */ }
  const onNote = safe(p => {
    const n = p.note;
    if (!n || n.id === undefined) return;
    const prev = seenKeys.get(n.id) || new Set();
    const rs = remindersOf(n);
    const fresh = rs.filter(r => !prev.has(keyOf(r)));
    seenKeys.set(n.id, new Set(rs.map(keyOf)));
    const t = now();
    if (n.done || p.source === 'pet') return;
    const cands = fresh.filter(r => !r.done && dueOf(r) !== null && dueOf(r) > t).sort((x, y) => dueOf(x) - dueOf(y));
    if (!cands.length) return;
    if (lastNoteSay.has(n.id) && t - lastNoteSay.get(n.id) < 15000) return;
    const r = cands[0];
    const v = { title: r.title || titleOf(n) };
    if (r.intent) v.intent = r.intent;
    const d = new Date(dueOf(r));
    v.time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (say('note_created', v, 20, 6000)) lastNoteSay.set(n.id, t);
  });
  bus.on('note:created', onNote);
  bus.on('note:updated', onNote);
  bus.on('note:deleted', safe(p => { seenKeys.delete(p.id); lastNoteSay.delete(p.id); }));

  // Đổi đồ: bỏ qua lần đầu (game phát lúc khởi động); chỉ nói khi có món thêm/đổi, không nói khi chỉ tháo.
  let lastWorn = null;
  let lastOutfitSay = -Infinity;
  bus.on('game:outfit', safe(p => {
    const worn = p.worn && typeof p.worn === 'object' ? p.worn : {};
    const prev = lastWorn;
    lastWorn = worn;
    if (prev === null || stableJson(prev) === stableJson(worn)) return;
    const slot = Object.keys(worn).sort().find(k => worn[k] && worn[k] !== prev[k]);
    if (slot === undefined) return;
    const t = now();
    if (t - lastOutfitSay < 10000) return;
    const v = {};
    try { const nm = ctx.game && ctx.game.itemName && ctx.game.itemName(worn[slot]); if (nm) v.item = nm; } catch (_) { /* bỏ qua */ }
    if (say('outfit', v, 20, 6000)) lastOutfitSay = t;
  }));

  // Note hết hạn: nếu core có diễn cảnh ném thùng rác (tossesNotes) thì core tự hỏi pick, persona im.
  let lastExpiredSay = -Infinity;
  bus.on('note:expired', safe(p => {
    if (ctx.pet && ctx.pet.tossesNotes === true) return;
    if (!EXPIRED_REASONS.includes(p.reason)) return;
    const t = now();
    if (t - lastExpiredSay < 30000) return;
    const title = titleOf(noteOf(p.noteId));
    if (say('expired_' + p.reason, title ? { title } : {}, 15, 6000)) lastExpiredSay = t;
  }));

  reload();
  ctx.persona = persona;
  return persona;
}

function init(ctx) { return createPersona(ctx); }

module.exports = { init, _internal: { createPersona, normalize, titleOf, bucketOf, defaults, remindersOf } };
