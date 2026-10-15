'use strict';
// Ngăn dữ liệu 'alarms' của phòng notes (docs/spec/01-data.md). MỌI module của phòng lấy ngăn qua getBox(ctx)
// để chỉ có MỘT hàm normalize (store.section chỉ dùng normalize của lần đăng ký đầu tiên).
const SOUNDS = ['chime', 'bell', 'soft', 'custom'];
const WHENS = ['startup', 'morning', 'noon', 'evening', 'before-shutdown'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isStr = v => typeof v === 'string';

function defaults() {
  return {
    version: 1,
    list: [],          // Alarm[]
    memos: [],         // Memo[]
    missed: [],        // [{alarmId, label, at}] báo thức đã lỡ (tối đa 50)
    sounds: [],        // [{soundFile, name}] âm thanh người dùng đã chép vào userData/alarm-sounds
    noteMeta: {},      // { [noteId]: { repeat?: Repeat|null, zoom?: number, locked?: boolean } }
    settings: {
      defaultSnoozeMin: 10,
      defaultSound: 'chime',
      ringMaxMin: 5,       // chuông tự im sau N phút (cửa sổ vẫn còn)
      missedGraceMin: 30,  // lỡ (máy ngủ/tắt) ≤ N phút thì kêu bù, quá thì ghi "đã lỡ"
      volume: 0.8
    }
  };
}

function normRepeat(r) {
  if (!r || typeof r !== 'object') return null;
  if (!['daily', 'weekdays', 'weekly', 'monthly', 'hourly'].includes(r.freq)) return null;
  const o = { freq: r.freq };
  if (isNum(r.interval) && r.interval >= 1) o.interval = Math.floor(r.interval);
  if (Array.isArray(r.byDay)) {
    const d = [...new Set(r.byDay.filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
    if (d.length) o.byDay = d;
  }
  if (Number.isInteger(r.byMonthDay) && r.byMonthDay >= 1 && r.byMonthDay <= 31) o.byMonthDay = r.byMonthDay;
  if (isNum(r.anchor)) o.anchor = r.anchor;
  return o;
}

function normAlarm(a) {
  if (!a || typeof a !== 'object' || !isStr(a.id) || !a.id) return null;
  const time = isStr(a.time) && /^\d{2}:\d{2}$/.test(a.time) ? a.time : '07:00';
  const o = {
    id: a.id,
    label: isStr(a.label) ? a.label.slice(0, 200) : '',
    time,
    repeat: normRepeat(a.repeat),
    enabled: a.enabled !== false,
    sound: SOUNDS.includes(a.sound) ? a.sound : 'chime',
    snoozeMin: isNum(a.snoozeMin) && a.snoozeMin >= 1 && a.snoozeMin <= 120 ? Math.round(a.snoozeMin) : 10,
    nextAt: isNum(a.nextAt) ? a.nextAt : null,
    createdAt: isNum(a.createdAt) ? a.createdAt : Date.now()
  };
  if (isStr(a.date) && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) o.date = a.date;
  if (isStr(a.soundFile)) o.soundFile = a.soundFile;
  if (isStr(a.noteId)) o.noteId = a.noteId;
  if (isNum(a.lastFiredAt)) o.lastFiredAt = a.lastFiredAt;
  if (isNum(a.snoozedUntil)) o.snoozedUntil = a.snoozedUntil;
  return o;
}

function normMemo(m) {
  if (!m || typeof m !== 'object' || !isStr(m.id) || !m.id || !isStr(m.text)) return null;
  const o = {
    id: m.id, text: m.text.slice(0, 500),
    when: WHENS.includes(m.when) ? m.when : 'startup',
    enabled: m.enabled !== false,
    createdAt: isNum(m.createdAt) ? m.createdAt : Date.now()
  };
  if (Array.isArray(m.days)) {
    const d = [...new Set(m.days.filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
    if (d.length && d.length < 7) o.days = d;
  }
  if (isStr(m.lastShownDay)) o.lastShownDay = m.lastShownDay;
  if (m.once) o.once = true;
  return o;
}

function normalize(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('bad alarms box');
  const d = defaults();
  const seen = new Set();
  const uniq = x => x && !seen.has(x.id) && seen.add(x.id);
  d.list = (Array.isArray(stored.list) ? stored.list : []).map(normAlarm).filter(uniq);
  d.memos = (Array.isArray(stored.memos) ? stored.memos : []).map(normMemo).filter(uniq);
  d.missed = (Array.isArray(stored.missed) ? stored.missed : [])
    .filter(x => x && isStr(x.alarmId) && isNum(x.at)).slice(-50)
    .map(x => ({ alarmId: x.alarmId, label: isStr(x.label) ? x.label : '', at: x.at }));
  d.sounds = (Array.isArray(stored.sounds) ? stored.sounds : [])
    .filter(x => x && isStr(x.soundFile)).map(x => ({ soundFile: x.soundFile, name: isStr(x.name) ? x.name : x.soundFile }));
  if (stored.noteMeta && typeof stored.noteMeta === 'object') {
    for (const [id, m] of Object.entries(stored.noteMeta)) {
      if (!m || typeof m !== 'object') continue;
      const o = {};
      const r = normRepeat(m.repeat); if (r) o.repeat = r;
      if (isNum(m.zoom) && m.zoom >= 0.5 && m.zoom <= 3) o.zoom = m.zoom;
      if (m.locked) o.locked = true;
      if (Object.keys(o).length) d.noteMeta[id] = o;
    }
  }
  const s = stored.settings && typeof stored.settings === 'object' ? stored.settings : {};
  if (isNum(s.defaultSnoozeMin) && s.defaultSnoozeMin >= 1 && s.defaultSnoozeMin <= 120) d.settings.defaultSnoozeMin = Math.round(s.defaultSnoozeMin);
  if (SOUNDS.includes(s.defaultSound)) d.settings.defaultSound = s.defaultSound;
  if (isNum(s.ringMaxMin) && s.ringMaxMin >= 1 && s.ringMaxMin <= 60) d.settings.ringMaxMin = Math.round(s.ringMaxMin);
  if (isNum(s.missedGraceMin) && s.missedGraceMin >= 0 && s.missedGraceMin <= 240) d.settings.missedGraceMin = Math.round(s.missedGraceMin);
  if (isNum(s.volume) && s.volume >= 0 && s.volume <= 1) d.settings.volume = s.volume;
  return d;
}

function getBox(ctx) { return ctx.store.section('alarms', defaults, normalize); }

module.exports = { getBox, defaults, normalize, normRepeat, normAlarm, normMemo, SOUNDS, WHENS };
