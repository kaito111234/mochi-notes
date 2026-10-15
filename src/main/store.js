'use strict';
// Lưu trữ dữ liệu Mochi Notes: mochi-data.json, ghi nguyên tử, debounce 300ms.
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = Object.freeze({
  mascotEnabled: true,
  mascotIdle: false,
  sound: true,
  glass: true,
  startup: false,
  allHidden: false
});
const COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const SAVE_DELAY = 300;

const isNum = v => typeof v === 'number' && Number.isFinite(v);

let normRepeat = null;
try { normRepeat = require('./alarms/box.js').normRepeat; } catch (_) { /* thiếu module alarms: bỏ qua lặp */ }

let RM = null;
try { RM = require('./notes/reminders.js'); } catch (_) { /* thiếu reminders.js: dùng bản đơn */ }

function normalizeReminder(r) {
  if (RM) return RM.normItem(r);
  if (!r || typeof r !== 'object' || !isNum(r.due)) return null;
  const rep = normRepeat ? normRepeat(r.repeat) : null;
  const out = {
    due: r.due,
    lead: isNum(r.lead) && r.lead > 0 ? r.lead : 0,
    intent: typeof r.intent === 'string' ? r.intent : 'task',
    auto: r.auto !== false,
    preFired: !!r.preFired,
    fired: !!r.fired,
    done: !!r.done
  };
  if (rep) out.repeat = rep;
  return out;
}

function normalizeNote(n) {
  if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !n.id) return null;
  const now = Date.now();
  const b = n.bounds && typeof n.bounds === 'object' ? n.bounds : {};
  // Nhiều nhắc: reminders là nguồn sự thật; reminder = primary (cùng tham chiếu). Migrate từ reminder đơn (id 'r1').
  let reminders = [];
  if (Array.isArray(n.reminders)) reminders = n.reminders.map(normalizeReminder).filter(Boolean);
  if (!reminders.length) {
    const one = normalizeReminder(n.reminder);
    if (one) { one.id = 'r1'; reminders = [one]; }
  }
  if (RM) {
    RM.sortList(reminders);
    reminders = reminders.slice(0, RM.MAX);
    RM.ensureIds(reminders);
  }
  const remindMuted = [];
  if (Array.isArray(n.remindMuted)) {
    for (const k of n.remindMuted) if (typeof k === 'string' && k && !remindMuted.includes(k)) remindMuted.push(k);
  }
  return {
    id: n.id,
    html: typeof n.html === 'string' ? n.html : '',
    text: typeof n.text === 'string' ? n.text : '',
    color: COLORS.includes(n.color) ? n.color : 'yellow',
    bounds: {
      x: isNum(b.x) ? b.x : 80,
      y: isNum(b.y) ? b.y : 80,
      width: isNum(b.width) && b.width > 0 ? b.width : 300,
      height: isNum(b.height) && b.height > 0 ? b.height : 320
    },
    visible: n.visible !== false,
    alwaysOnTop: !!n.alwaysOnTop,
    reminder: RM ? RM.pickPrimary(reminders) : (reminders[0] || null),
    reminders,
    remindMuted: remindMuted.slice(-50),
    createdAt: isNum(n.createdAt) ? n.createdAt : now,
    updatedAt: isNum(n.updatedAt) ? n.updatedAt : now
  };
}

function createStore(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* bỏ qua */ }
  const file = path.join(dir, 'mochi-data.json');
  const tmp = file + '.tmp';
  const data = { notes: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
  let firstRun = false;
  let timer = null;
  let dirty = false;
  // Các "ngăn" dữ liệu của từng phòng (alarms, memos, pet, game, ...). Xem docs/spec/01-data.md.
  const raw = {};          // ngăn đọc từ file nhưng chưa ai đăng ký — giữ nguyên để không mất dữ liệu
  const sections = {};     // name -> { value }

  const pad = n => String(n).padStart(2, '0');
  const stamp = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];
  const KEEP_CORRUPT = 5;
  let recoveredFrom = null;   // đường dẫn bản sao lưu đã dùng để khôi phục (main/khay báo người dùng)
  let corruptCopy = null;     // đường dẫn nơi cất bản hỏng

  // Đọc + kiểm hợp lệ một chuỗi JSON; ném lỗi nếu hỏng. Trả { notes, raw, settings } — chưa đụng vào data.
  function parseText(text) {
    const j = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('bad root');
    if (j.notes !== undefined && !Array.isArray(j.notes)) throw new Error('bad notes');
    const notes = [], rawOut = {}, seen = new Set();
    for (const n of (j.notes || [])) {
      const nn = normalizeNote(n);
      if (nn && !seen.has(nn.id)) { seen.add(nn.id); notes.push(nn); }
    }
    for (const k of Object.keys(j)) if (!['notes', 'settings', 'version'].includes(k) && !UNSAFE_KEYS.includes(k)) rawOut[k] = j[k];
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    const s = j.settings && typeof j.settings === 'object' && !Array.isArray(j.settings) ? j.settings : {};
    for (const k of Object.keys(s)) {
      if (UNSAFE_KEYS.includes(k)) continue;
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)) { if (typeof s[k] === 'boolean') settings[k] = s[k]; }
      else settings[k] = s[k];   // khoá lạ (của phòng khác / bản mới hơn): giữ nguyên khi ghi lại
    }
    return { notes, raw: rawOut, settings };
  }
  function applyParsed(r) {
    data.notes = r.notes;
    data.settings = r.settings;
    for (const k of Object.keys(r.raw)) raw[k] = r.raw[k];
  }
  function pruneByPattern(re, keep) {
    try {
      const mt = f => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch (_) { return 0; } };
      const list = fs.readdirSync(dir).filter(f => re.test(f)).sort().sort((a, b) => mt(a) - mt(b));   // cũ nhất trước
      while (list.length > keep) { try { fs.unlinkSync(path.join(dir, list.shift())); } catch (_) { break; } }
    } catch (_) { /* bỏ qua */ }
  }
  function uniqueName(base, ext) {
    let name = base + ext, i = 1;
    while (fs.existsSync(path.join(dir, name))) name = base + '-' + (++i) + ext;
    return path.join(dir, name);
  }
  // Cất bản hỏng: mochi-data.corrupt-YYYYMMDD-HHMMSS.json (giữ tối đa 5).
  function keepCorrupt() {
    const target = uniqueName('mochi-data.corrupt-' + stamp(new Date()), '.json');
    try { fs.renameSync(file, target); } catch (_e) {
      try { fs.copyFileSync(file, target); } catch (_e2) { return null; }
    }
    pruneByPattern(/^mochi-data\.corrupt-\d{8}-\d{6}(-\d+)?\.json$/, KEEP_CORRUPT);
    return target;
  }
  // Tìm bản sao lưu hợp lệ mới nhất trong backups/.
  function findBackup() {
    const bdir = path.join(dir, 'backups');
    let names = [];
    try { names = fs.readdirSync(bdir).filter(f => /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse(); } catch (_) { return null; }
    for (const f of names) {
      const full = path.join(bdir, f);
      try {
        const text = fs.readFileSync(full, 'utf8');
        return { file: full, text, parsed: parseText(text) };
      } catch (_) { /* thử bản kế */ }
    }
    return null;
  }

  function load() {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT') firstRun = true;
      return;
    }
    try {
      applyParsed(parseText(text));
    } catch (_) {
      // File hỏng: cất bản hỏng (có dấu thời gian), rồi thử bản sao lưu hợp lệ mới nhất.
      data.notes = [];
      data.settings = Object.assign({}, DEFAULT_SETTINGS);
      for (const k of Object.keys(raw)) delete raw[k];
      corruptCopy = keepCorrupt();
      const b = findBackup();
      if (b) {
        applyParsed(b.parsed);
        recoveredFrom = b.file;
        // Đặt lại file chính bằng bản đã khôi phục để không có bản hỏng nào lọt vào backups/ hôm nay.
        try { fs.writeFileSync(file, b.text, 'utf8'); } catch (_) { /* bỏ qua */ }
      }
    }
  }

  function writeNow() {
    const out = { version: 2, notes: data.notes, settings: data.settings };
    for (const k of Object.keys(raw)) out[k] = raw[k];
    for (const k of Object.keys(sections)) out[k] = sections[k].value;
    const json = JSON.stringify(out, null, 2);
    dailyBackup();
    try {
      fs.writeFileSync(tmp, json, 'utf8');
      try {
        fs.renameSync(tmp, file);
      } catch (_) {
        // Windows đôi khi chặn rename (antivirus) — ghi thẳng như phương án cuối.
        fs.writeFileSync(file, json, 'utf8');
        try { fs.unlinkSync(tmp); } catch (_e) { /* bỏ qua */ }
      }
      dirty = false;
    } catch (_) { /* ổ đĩa lỗi: giữ dirty để lần sau thử lại */ }
  }

  // Sao lưu mỗi ngày một bản (giữ 7 bản gần nhất) trong thư mục backups/.
  let lastBackupDay = '';
  function dailyBackup() {
    const d0 = new Date(), day = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    if (day === lastBackupDay) return;
    lastBackupDay = day;
    try {
      const bdir = path.join(dir, 'backups');
      fs.mkdirSync(bdir, { recursive: true });
      const target = path.join(bdir, 'mochi-data-' + day + '.json');
      if (!fs.existsSync(target) && fs.existsSync(file)) {
        let ok = true;
        try { JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (_) { ok = false; }   // không sao lưu file hỏng
        if (ok) fs.copyFileSync(file, target);
      }
      const old = fs.readdirSync(bdir).filter(f => /^mochi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (old.length > 7) { try { fs.unlinkSync(path.join(bdir, old.shift())); } catch (_) { break; } }
    } catch (_) { /* bỏ qua */ }
  }

  /**
   * Đăng ký một ngăn dữ liệu. Trả về đối tượng sống (sửa trực tiếp rồi gọi save()).
   * @param {string} name  tên ngăn, vd 'alarms', 'pet', 'game'
   * @param {() => any} defaults  hàm trả giá trị mặc định
   * @param {(stored:any) => any} [normalize]  chuẩn hoá/migrate dữ liệu đọc từ file; ném lỗi => dùng mặc định
   */
  function section(name, defaults, normalize) {
    if (['notes', 'settings', 'version'].includes(name)) throw new Error('reserved section ' + name);
    if (sections[name]) return sections[name].value;
    let value;
    if (raw[name] !== undefined) {
      try { value = normalize ? normalize(raw[name]) : raw[name]; } catch (_) {
        // Ngăn sai kiểu/hỏng: cất nguyên bản vào file riêng trước khi dùng mặc định (không mất dữ liệu).
        try {
          const target = uniqueName('mochi-data.section-' + String(name).replace(/[^\w-]/g, '_') + '-' + stamp(new Date()), '.json');
          fs.writeFileSync(target, JSON.stringify(raw[name], null, 2), 'utf8');
          pruneByPattern(/^mochi-data\.section-.*\.json$/, KEEP_CORRUPT * 2);
        } catch (_e) { /* bỏ qua */ }
        value = defaults();
      }
      delete raw[name];
    } else value = defaults();
    sections[name] = { value };
    return value;
  }

  function save() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => { timer = null; if (dirty) writeNow(); }, SAVE_DELAY);
  }

  function flushSync() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (dirty) writeNow();
  }

  load();
  return {
    file,
    data,
    get notes() { return data.notes; },
    get settings() { return data.settings; },
    get isFirstRun() { return firstRun; },
    get recoveredFrom() { return recoveredFrom; },
    get corruptCopy() { return corruptCopy; },
    save,
    flushSync,
    section
  };
}

module.exports = { createStore, DEFAULT_SETTINGS, COLORS };
