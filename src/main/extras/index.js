'use strict';
// Phòng extras — những tiện ích bé Mochi làm cùng cậu:
//  1) Mochi Focus (Pomodoro): "bé ơi, tập trung 25 phút" -> bé ngồi canh, không quậy; hết giờ thưởng xu, nhắc nghỉ 5 phút.
//  2) Checklist hằng ngày: "bé ơi, lặp hằng ngày" trong note checklist -> mỗi sáng tự bỏ tick, bé đếm chuỗi ngày 🔥.
//  3) Ô ra lệnh: Ctrl+Alt+B mở ô nhỏ cạnh bé, gõ lệnh như trong note.
//  4) Tổng kết cuối ngày (18h): xong mấy việc, còn gì; nút dời việc còn lại sang 9h sáng mai.
//  5) Sao lưu note ra thư mục cậu chọn (OneDrive/Google Drive...) mỗi ngày + khi tắt app; giữ 14 bản.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, globalShortcut, dialog, screen } = require('electron');

const MIN = 60000;
const pick = a => a[Math.floor(Math.random() * a.length)];
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function defaults() {
  return { daily: {}, focus: { day: '', count: 0, total: 0 }, days: {}, summaryDay: '', backup: { dir: null, last: 0, keep: 14 } };
}
function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const okId = id => typeof id === 'string' && id.length < 100 && !['__proto__', 'constructor', 'prototype'].includes(id);
  if (raw.daily && typeof raw.daily === 'object') for (const id of Object.keys(raw.daily)) {
    const v = raw.daily[id]; if (!okId(id) || !v || typeof v !== 'object') continue;
    d.daily[id] = { streak: Math.max(0, v.streak | 0), best: Math.max(0, v.best | 0), doneDay: typeof v.doneDay === 'string' ? v.doneDay : '', resetDay: typeof v.resetDay === 'string' ? v.resetDay : '' };
  }
  if (raw.focus && typeof raw.focus === 'object') d.focus = { day: String(raw.focus.day || ''), count: Math.max(0, raw.focus.count | 0), total: Math.max(0, raw.focus.total | 0) };
  if (raw.days && typeof raw.days === 'object') for (const k of Object.keys(raw.days).sort().slice(-14)) {
    const v = raw.days[k]; if (/^\d{4}-\d\d-\d\d$/.test(k) && v && typeof v === 'object') d.days[k] = { done: Math.max(0, v.done | 0), created: Math.max(0, v.created | 0), focus: Math.max(0, v.focus | 0) };
  }
  if (typeof raw.summaryDay === 'string') d.summaryDay = raw.summaryDay;
  const b = raw.backup || {};
  if (typeof b.dir === 'string' && b.dir) d.backup.dir = b.dir;
  if (typeof b.last === 'number') d.backup.last = b.last;
  if ([7, 14, 30].includes(b.keep)) d.backup.keep = b.keep;
  return d;
}

function init(ctx) {
  const bus = ctx.bus;
  const box = ctx.store.section('extras', defaults, normalize);
  const save = () => { try { ctx.store.save(); } catch (_) { /* bỏ qua */ } };
  const P = () => ctx.pet || {};
  const A = () => P().actor;
  const C = () => P().core;
  const api = () => (ctx.antics && ctx.antics.api) || null;
  const ready = () => !!(api() && api().ready());
  const say = (t, o) => { if (ready()) api().say(t, o); };
  const today = () => { const k = dayKey(); if (!box.days[k]) { box.days[k] = { done: 0, created: 0, focus: 0 }; const ks = Object.keys(box.days).sort(); while (ks.length > 14) delete box.days[ks.shift()]; } return box.days[k]; };
  /** Diễn một màn qua phòng antics (chờ bé rảnh, cắt ngang trò đang chơi). */
  function act(name, fn) {
    if (!ctx.antics || !api()) return;
    api().whenFree(() => ctx.antics.perform(name, fn, { wake: true }));
  }

  // ================================================================== 1) Mochi Focus
  let focus = null;        // { mode: 'focus'|'break', until, min, timer }
  const left = () => focus ? Math.max(0, focus.until - Date.now()) : 0;
  const fmtLeft = () => { const s = Math.round(left() / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function clearFocus() { if (focus && focus.timer) clearTimeout(focus.timer); if (focus && focus.tick) clearInterval(focus.tick); focus = null; }
  function startFocus(min) {
    clearFocus();
    min = Math.max(5, Math.min(120, min | 0 || 25));
    focus = { mode: 'focus', min, until: Date.now() + min * MIN };
    focus.timer = setTimeout(endFocus, min * MIN);
    // nửa chừng: bé chỉ lấp lánh cổ vũ, không nói
    focus.tick = setInterval(() => { if (ready() && focus && focus.mode === 'focus' && !ctx.antics.running()) { try { A().fx(pick(['sparkle', 'hearts', 'notes'])); } catch (_) { /* bỏ qua */ } } }, 5 * MIN);
    act('focusStart', async () => {
      const a = api();
      A().fx('exclaim'); A().sound('boing');
      a.say('Bắt đầu tập trung ' + min + ' phút nha! Tớ ngồi canh, không làm phiền đâu 🤫', { ttlMs: 4000 });
      await a.step(A().move('nod', 2));
      await a.wait(1500);
      try { if (C().brain.sit) C().brain.sit(); } catch (_) { /* bỏ qua */ }
    });
  }
  function endFocus() {
    if (!focus) return;
    const min = focus.min;
    clearFocus();
    const t = today(); t.focus++;
    if (box.focus.day !== dayKey()) { box.focus.day = dayKey(); box.focus.count = 0; }
    box.focus.count++; box.focus.total++;
    save();
    const reward = Math.min(30, 5 + Math.round(min / 5) * 2);
    try { if (ctx.game && ctx.game.bonus) ctx.game.bonus(reward, Math.round(min / 2), 'focus'); } catch (_) { /* bỏ qua */ }
    act('focusEnd', async () => {
      const a = api();
      A().fx('confetti'); A().sound('tada');
      const ans = await a.ask('Hết ' + min + ' phút rồi! Giỏi quá 🎉 (+' + reward + ' xu, phiên thứ ' + box.focus.count + ' hôm nay). Nghỉ 5 phút nha?',
        [{ id: 'x:break', label: 'Nghỉ 5 phút', primary: true }, { id: 'x:again', label: 'Làm tiếp ' + min + ' phút' }, { id: 'x:stop', label: 'Thôi' }], 30000, 'x:break');
      A().hush();
      if (ans === 'x:again') { setTimeout(() => startFocus(min), 300); return; }
      if (ans === 'x:break') {
        focus = { mode: 'break', min, until: Date.now() + 5 * MIN };
        focus.timer = setTimeout(endBreak, 5 * MIN);
        a.say('Đứng dậy vươn vai, uống ngụm nước nè~', { ttlMs: 3500 });
        await a.step(A().move('stretch'));
      }
    });
  }
  function endBreak() {
    const min = focus ? focus.min : 25;
    clearFocus();
    act('breakEnd', async () => {
      const a = api();
      A().fx('exclaim'); A().sound('boing');
      const ans = await a.ask('Hết giờ nghỉ rồi! Quay lại tập trung tiếp nhé?',
        [{ id: 'x:go', label: 'Tập trung ' + min + ' phút', primary: true }, { id: 'x:later', label: 'Để sau' }], 30000, null);
      A().hush();
      if (ans === 'x:go') setTimeout(() => startFocus(min), 300);
    });
  }
  function stopFocus() {
    if (!focus) { say('Mình đâu có đang tập trung đâu nè~', { ttlMs: 2500 }); return; }
    clearFocus();
    act('focusStop', async () => { api().say('Ok, dừng tập trung nha. Lúc nào cần cứ gọi tớ!', { ttlMs: 3000 }); await api().step(A().move('nod')); });
  }

  // ================================================================== 2) checklist hằng ngày
  const ckCount = html => {
    const all = (String(html || '').match(/data-ck="[01]"/g) || []);
    return { total: all.length, done: all.filter(s => s.indexOf('"1"') > 0).length };
  };
  const isDaily = id => !!box.daily[id];
  function setDaily(id, on) {
    const n = ctx.findNote(id);
    if (!n) return;
    if (!on) {
      delete box.daily[id]; save();
      act('dailyOff', async () => { api().say('Ok, note này hết lặp hằng ngày rồi.', { ttlMs: 3000 }); await api().step(A().move('nod')); });
      return;
    }
    const c = ckCount(n.html);
    if (!c.total) {
      act('dailyNo', async () => { A().fx('question'); api().say('Note này chưa có ô tick nè. Bấm ⋯ → “Chuyển thành checklist” rồi gọi tớ lại nha!', { ttlMs: 5000 }); await api().wait(800); });
      return;
    }
    box.daily[id] = box.daily[id] || { streak: 0, best: 0, doneDay: '', resetDay: dayKey() };
    save();
    act('dailyOn', async () => {
      A().fx('sparkle');
      api().say('Xong! Sáng mai tớ tự bỏ tick cho cậu làm lại. Tick hết mỗi ngày để giữ chuỗi 🔥 nha!', { ttlMs: 4500 });
      await api().step(A().move('hop', 2));
    });
  }
  // qua ngày: bỏ tick, chuỗi đứt nếu hôm qua không xong
  function dailyRollover() {
    const k = dayKey(), y = dayKey(Date.now() - 86400000);
    let changed = false, kept = [];
    for (const id of Object.keys(box.daily)) {
      const d = box.daily[id], n = ctx.findNote(id);
      if (!n) { delete box.daily[id]; changed = true; continue; }
      if (d.resetDay === k) continue;
      if (d.doneDay !== y && d.doneDay !== k) d.streak = 0;
      d.resetDay = k; changed = true;
      const html = String(n.html || '');
      if (/data-ck="1"/.test(html)) {
        try { ctx.notes.updateNote(id, { html: html.replace(/data-ck="1"/g, 'data-ck="0"') }); } catch (e) { console.error('[extras] reset checklist', e); }
      }
      if (d.streak > 0) kept.push(d.streak);
    }
    if (changed) save();
    if (kept.length) act('dailyNew', async () => {
      A().fx('sparkle');
      api().say('Ngày mới! Checklist hằng ngày đã làm mới rồi. Chuỗi đang giữ: 🔥 ' + Math.max(...kept) + ' ngày, cố lên!', { ttlMs: 4500 });
      await api().step(A().move('stretch'));
    });
  }
  bus.on('note:updated', d => {
    const n = d && d.note; if (!n || !box.daily[n.id]) return;
    const c = ckCount(n.html), D = box.daily[n.id], k = dayKey();
    if (c.total && c.done === c.total && D.doneDay !== k) {
      D.doneDay = k; D.streak++; D.best = Math.max(D.best, D.streak); save();
      const reward = Math.min(20, 3 + D.streak);
      try { if (ctx.game && ctx.game.bonus) ctx.game.bonus(reward, 5, 'daily'); } catch (_) { /* bỏ qua */ }
      act('dailyDone', async () => {
        A().fx('confetti'); A().sound('tada');
        api().say('Tick hết rồi! Chuỗi 🔥 ' + D.streak + ' ngày' + (D.streak >= D.best && D.streak > 1 ? ' — kỷ lục mới!' : '') + ' (+' + reward + ' xu)', { ttlMs: 4500 });
        await api().step(A().move('dance', 3));
      });
    }
  });

  // ================================================================== 3) ô ra lệnh (Ctrl+Alt+B)
  let box2 = null;
  function cmdWin() {
    if (ctx.alive(box2)) return box2;
    box2 = new BrowserWindow({
      width: 360, height: 64, show: false, frame: false, transparent: true, resizable: false, skipTaskbar: true,
      alwaysOnTop: true, hasShadow: false, backgroundColor: '#00000000', title: 'Ra lệnh cho bé Mochi', webPreferences: ctx.webPrefs()
    });
    ctx.hardenWebContents(box2);
    box2.setAlwaysOnTop(true, 'pop-up-menu');
    box2.on('blur', () => { if (ctx.alive(box2)) box2.hide(); });
    box2.loadFile(path.join(ctx.paths.src, 'cmdbox/cmdbox.html')).catch(e => console.error('[extras] cmdbox', e && e.message));
    return box2;
  }
  function openCmd() {
    const w = cmdWin();
    let x, y;
    const pw = ctx.windows.pet;
    if (ctx.alive(pw) && pw.isVisible() && ctx.pet.body) {
      const p = ctx.pet.body.pos(), sz = ctx.pet.body.size();
      x = Math.round(p.x - 180); y = Math.round(p.y - sz.h - 80);
    } else { const c = screen.getCursorScreenPoint(); x = c.x - 180; y = c.y - 90; }
    const wa = screen.getDisplayNearestPoint({ x: x + 180, y: y + 32 }).workArea;
    x = Math.max(wa.x + 4, Math.min(wa.x + wa.width - 364, x)); y = Math.max(wa.y + 4, Math.min(wa.y + wa.height - 68, y));
    w.setBounds({ x, y, width: 360, height: 64 });
    const go = () => { w.show(); w.focus(); w.webContents.send('extras:cmdShow', {}); };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', go); else go();
    if (ready() && !ctx.antics.running()) { try { A().fx('question'); } catch (_) { /* bỏ qua */ } }
  }
  ipcMain.on('extras:cmd', (e, text) => {
    if (!ctx.alive(box2) || e.sender !== box2.webContents) return;
    box2.hide();
    if (typeof text === 'string' && text.trim() && ctx.antics) ctx.antics.runCommand(null, text.trim().slice(0, 300));
  });
  ipcMain.on('extras:cmdClose', e => { if (ctx.alive(box2) && e.sender === box2.webContents) box2.hide(); });

  // ================================================================== 4) tổng kết cuối ngày
  bus.on('reminder:done', () => { today().done++; save(); });
  bus.on('note:created', () => { today().created++; save(); });
  function pendingToday() {
    const now = Date.now(), end = new Date(); end.setHours(23, 59, 59, 999);
    const out = [];
    for (const n of ctx.store.data.notes) {
      const rs = Array.isArray(n.reminders) ? n.reminders : (n.reminder ? [n.reminder] : []);
      for (const r of rs) if (r && !r.done && typeof r.due === 'number' && r.due <= end.getTime() && (r.fired || r.due > now - 86400000 * 7)) out.push({ n, r });
    }
    return out;
  }
  function summary(manual) {
    const t = today(), pend = pendingToday();
    const head = 'Tổng kết hôm nay: ' + (t.done ? 'xong ' + t.done + ' việc 🎉' : 'chưa đánh dấu xong việc nào') +
      (t.focus ? ', ' + t.focus + ' phiên tập trung' : '') + (t.created ? ', viết ' + t.created + ' note mới' : '') + '.';
    const tail = pend.length
      ? '\nCòn ' + pend.length + ' việc: ' + pend.slice(0, 3).map(x => '“' + clip(x.r.title || (x.n.text || '').split('\n')[0], 26) + '”').join(', ') + (pend.length > 3 ? '…' : '')
      : '\nKhông còn việc gì tồn đọng, tuyệt vời!';
    const streaks = Object.values(box.daily).filter(d => d.streak > 0).map(d => d.streak);
    const fire = streaks.length ? '\nChuỗi checklist: 🔥 ' + Math.max(...streaks) + ' ngày.' : '';
    act('summary', async () => {
      const a = api();
      A().fx(pend.length ? 'question' : 'confetti');
      const btns = pend.length ? [{ id: 'x:tomorrow', label: 'Dời sang 9h mai', primary: true }, { id: 'x:ok', label: 'Ok' }] : [{ id: 'x:ok', label: 'Yay!', primary: true }];
      const ans = await a.ask(head + tail + fire, btns, 30000, null);
      A().hush();
      if (ans === 'x:tomorrow') {
        const tm = new Date(); tm.setDate(tm.getDate() + 1); tm.setHours(9, 0, 0, 0);
        let moved = 0;
        for (const { n, r } of pend) {
          try { ctx.notes.snoozeNote(n.id, Math.max(1, Math.round((tm.getTime() - Date.now()) / MIN)), r.id); moved++; } catch (e) { console.error('[extras] dời việc', e); }
        }
        a.say('Đã dời ' + moved + ' việc sang 9h sáng mai. Nghỉ ngơi đi nha!', { ttlMs: 3500 });
        await a.step(A().move('nod', 2));
      } else if (!pend.length || manual) { await a.step(A().move('hop', 2)); }
    });
  }

  // ================================================================== 5) sao lưu ra thư mục
  function suggestDir() {
    const od = process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial;
    return od ? path.join(od, 'MochiNotes') : path.join(app.getPath('documents'), 'MochiNotes');
  }
  async function chooseDir() {
    const r = await dialog.showOpenDialog({ title: 'Chọn thư mục sao lưu note (nên chọn trong OneDrive / Google Drive)', defaultPath: box.backup.dir || suggestDir(), properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return false;
    box.backup.dir = r.filePaths[0]; save();
    return true;
  }
  function backupNow(quiet) {
    const dir = box.backup.dir;
    if (!dir) return { ok: false, reason: 'nodir' };
    try {
      fs.mkdirSync(dir, { recursive: true });
      ctx.store.flushSync();
      const T = require('../notes/transferLogic.js');
      const { getBox } = require('../alarms/box.js');
      const now = Date.now(), k = dayKey(now), notes = ctx.store.data.notes;
      fs.writeFileSync(path.join(dir, 'mochi-notes-' + k + '.json'), JSON.stringify(T.buildExportJson(notes, getBox(ctx), now), null, 2), 'utf8');
      fs.writeFileSync(path.join(dir, 'mochi-notes-' + k + '.md'), T.notesToText(notes, 'md'), 'utf8');
      // giữ N ngày gần nhất
      const files = fs.readdirSync(dir).filter(f => /^mochi-notes-\d{4}-\d\d-\d\d\.(json|md)$/.test(f)).sort();
      const days = [...new Set(files.map(f => f.slice(12, 22)))];
      for (const d of days.slice(0, Math.max(0, days.length - box.backup.keep))) for (const f of files) if (f.indexOf(d) === 12) { try { fs.unlinkSync(path.join(dir, f)); } catch (_) { /* bỏ qua */ } }
      box.backup.last = now; save();
      if (!quiet) act('backup', async () => { A().fx('sparkle'); api().say('Đã sao lưu ' + notes.length + ' note vào “' + clip(dir, 40) + '” rồi nè 💾', { ttlMs: 4000 }); await api().step(A().move('nod')); });
      return { ok: true, count: notes.length };
    } catch (e) {
      console.error('[extras] backup', e);
      if (!quiet) say('Ui, sao lưu không được: ' + clip(e && e.message, 60), { ttlMs: 5000 });
      return { ok: false, reason: String(e && e.message || e) };
    }
  }
  async function backupCmd() {
    if (!box.backup.dir) {
      say('Cậu chọn thư mục sao lưu giúp tớ nha (nên chọn trong OneDrive hoặc Google Drive)…', { ttlMs: 4000 });
      if (!(await chooseDir())) return;
    }
    backupNow(false);
  }
  app.on('before-quit', () => { if (box.backup.dir && Date.now() - box.backup.last > 30 * MIN) backupNow(true); });

  // ================================================================== nhịp phút
  function tick() {
    try {
      dailyRollover();
      const d = new Date(), k = dayKey();
      if (d.getHours() >= 18 && d.getHours() < 23 && box.summaryDay !== k && !focus && ready() && !ctx.antics.running()) {
        box.summaryDay = k; save(); summary(false);
      }
      if (box.backup.dir && Date.now() - box.backup.last > 20 * 60 * MIN) backupNow(true);
    } catch (e) { console.error('[extras] tick', e); }
  }
  bus.once('app:startup', () => {
    setTimeout(tick, 15000);
    const t = setInterval(tick, MIN); if (t.unref) t.unref();
    try { globalShortcut.register('Ctrl+Alt+B', openCmd); } catch (_) { /* bỏ qua */ }
  });

  // ================================================================== lệnh + menu
  function command(c, noteId) {
    switch (c.kind) {
      case 'focus': return startFocus(c.min);
      case 'focusStop': return stopFocus();
      case 'daily': if (!noteId) return say('Gõ “bé ơi, lặp hằng ngày” ngay trong note checklist đó nha.', { ttlMs: 4000 }); return setDaily(noteId, true);
      case 'dailyOff': if (!noteId) return; return setDaily(noteId, false);
      case 'summary': return summary(true);
      case 'backup': return backupCmd();
    }
  }
  function menu() {
    const inFocus = focus && focus.mode === 'focus';
    return [
      { type: 'separator' },
      inFocus ? { key: 'focus.stop', label: '⏳ Đang tập trung — còn ' + fmtLeft() + ' (dừng)', click: stopFocus }
        : { key: 'focus', label: 'Mochi Focus', submenu: [15, 25, 45, 60].map(m => ({ key: 'focus.' + m, label: 'Tập trung ' + m + ' phút', click: () => startFocus(m) })) },
      { key: 'cmd', label: 'Ra lệnh cho bé…  (Ctrl+Alt+B)', click: openCmd },
      { key: 'summary', label: 'Tổng kết hôm nay', click: () => summary(true) },
      { key: 'backup', label: 'Sao lưu note', submenu: [
        { label: box.backup.dir ? 'Thư mục: ' + clip(box.backup.dir, 50) : 'Chưa chọn thư mục', enabled: false },
        { label: box.backup.last ? 'Lần cuối: ' + new Date(box.backup.last).toLocaleString('vi-VN') : 'Chưa sao lưu lần nào', enabled: false },
        { label: 'Sao lưu ngay', click: () => backupCmd() },
        { label: 'Chọn thư mục sao lưu…', click: async () => { if (await chooseDir()) backupNow(false); } },
        { label: 'Mở thư mục sao lưu', enabled: !!box.backup.dir, click: () => { try { require('electron').shell.openPath(box.backup.dir); } catch (_) { /* bỏ qua */ } } }
      ] }
    ];
  }

  ctx.extras = { isDaily, quiet: () => !!(focus && focus.mode === 'focus'), command, menu, openCmd, startFocus, stopFocus, summary, backupNow, box, dailyRollover, _test: { endFocus, endBreak } };
}

module.exports = { init, defaults, normalize };
