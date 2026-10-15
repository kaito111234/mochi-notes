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

function normalizeReminder(r) {
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
    reminder: normalizeReminder(n.reminder),
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

  function load() {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT') firstRun = true;
      return;
    }
    try {
      const j = JSON.parse(text.replace(/^﻿/, ''));
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('bad root');
      if (j.notes !== undefined && !Array.isArray(j.notes)) throw new Error('bad notes');
      const seen = new Set();
      for (const n of (j.notes || [])) {
        const nn = normalizeNote(n);
        if (nn && !seen.has(nn.id)) { seen.add(nn.id); data.notes.push(nn); }
      }
      for (const k of Object.keys(j)) if (!['notes', 'settings', 'version'].includes(k)) raw[k] = j[k];
      const s = j.settings && typeof j.settings === 'object' ? j.settings : {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (typeof s[k] === 'boolean') data.settings[k] = s[k];
      }
    } catch (_) {
      // File hỏng: giữ lại bản .bak rồi dùng mặc định.
      data.notes = [];
      data.settings = Object.assign({}, DEFAULT_SETTINGS);
      try { fs.renameSync(file, file + '.bak'); } catch (_e) {
        try { fs.copyFileSync(file, file + '.bak'); } catch (_e2) { /* bỏ qua */ }
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
      if (!fs.existsSync(target) && fs.existsSync(file)) fs.copyFileSync(file, target);
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
      try { value = normalize ? normalize(raw[name]) : raw[name]; } catch (_) { value = defaults(); }
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
    save,
    flushSync,
    section
  };
}

module.exports = { createStore, DEFAULT_SETTINGS, COLORS };
