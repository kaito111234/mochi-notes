'use strict';
// Báo thức: CRUD qua IPC 'alarm:*', bộ hẹn giờ tất định, cửa sổ chuông.
// Quyết định thiết kế:
//  - Nhắc giờ là TẤT ĐỊNH: không phụ thuộc bé/game/random. Cửa sổ chuông LUÔN mở; bé chỉ là phần thêm.
//  - settings.sound (âm báo chung của app) KHÔNG chặn chuông báo thức: báo thức là việc người dùng chủ động đặt.
//  - Một nextAt chỉ kêu một lần: sau khi xử lý, nextAt luôn bị dời (lặp) hoặc xoá (một lần) trước khi kêu.
const fs = require('fs');
const path = require('path');
const { app, ipcMain, BrowserWindow, Notification, dialog, screen, powerMonitor } = require('electron');
const { getBox, normalize, normAlarm } = require('./box.js');
const L = require('./alarmLogic.js');
const { placeAvoiding, needsMove, petRectFor, petVisible } = require('./placement.js');

const RING_W = 360, RING_H = 262;
const SOUND_EXT = ['mp3', 'wav', 'ogg', 'm4a'];
const MAX_SOUND_BYTES = 25 * 1024 * 1024;

const pad = n => String(n).padStart(2, '0');
const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const newId = () => 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function init(ctx) {
  const R = require('../../shared/recur.js');
  const box = getBox(ctx);
  ctx.alarms = ctx.alarms || {};
  const soundDir = () => path.join(app.getPath('userData'), 'alarm-sounds');

  // ---------- trạng thái chuông ----------
  const ringing = new Map();      // alarmId -> RingInfo
  let ringWin = null, ringReady = false;
  const pendingSend = [];         // RingInfo chờ cửa sổ sẵn sàng
  const notifRefs = new Set();

  const find = id => box.list.find(a => a.id === id) || null;
  const persist = () => { try { ctx.store.save(); } catch (e) { console.error('[alarm] save', e); } };
  const snapshot = () => ({
    alarms: box.list, missed: box.missed, settings: box.settings, sounds: box.sounds
  });
  function broadcast() {
    const snap = JSON.parse(JSON.stringify(snapshot()));
    for (const w of BrowserWindow.getAllWindows()) ctx.send(w, 'alarm:changed', snap);
  }
  function commit() { persist(); broadcast(); }

  function notify(title, body, onClick) {
    try {
      if (!Notification.isSupported()) return;
      const n = new Notification({ title, body });
      notifRefs.add(n);
      const drop = () => notifRefs.delete(n);
      n.on('click', () => { drop(); if (onClick) onClick(); });
      n.on('close', drop); n.on('failed', drop);
      n.show();
    } catch (e) { console.error('[alarm] notification', e); }
  }

  // ---------- cửa sổ chuông ----------
  const petRect = () => petRectFor(ctx, screen.getPrimaryDisplay().workArea);
  function placeRing(win) {
    const a = screen.getPrimaryDisplay().workArea;
    const p = placeAvoiding(a, { width: RING_W, height: RING_H }, petRect(), 16);
    win.setBounds({ x: p.x, y: p.y, width: RING_W, height: RING_H });
    ctx.bus.emit('alarms:layout', { ring: ringBounds() });
  }
  function ringBounds() {
    if (!ctx.alive(ringWin) || !ringWin.isVisible()) return null;
    const b = ringWin.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  // bé di chuyển: dời cửa sổ chuông nếu bị đè (throttle 300ms)
  let moveTimer = null;
  ctx.bus.on('pet:moved', () => {
    if (moveTimer || !ringWin) return;
    moveTimer = setTimeout(() => {
      moveTimer = null;
      try {
        if (!ctx.alive(ringWin) || !ringWin.isVisible()) return;
        const r = petRect();
        if (r && needsMove(ringWin.getBounds(), r)) placeRing(ringWin);
      } catch (_) { /* bỏ qua */ }
    }, 300);
    if (moveTimer.unref) moveTimer.unref();
  });

  function ensureRingWin() {
    if (ctx.alive(ringWin)) return ringWin;
    try {
      ringReady = false;
      const win = new BrowserWindow({
        width: RING_W, height: RING_H, show: false, frame: false, resizable: false, maximizable: false,
        minimizable: false, fullscreenable: false, skipTaskbar: false, alwaysOnTop: true,
        title: 'Báo thức', backgroundColor: '#f5f8fd', webPreferences: ctx.webPrefs()
      });
      ringWin = win;
      ctx.hardenWebContents(win);
      win.setAlwaysOnTop(true, 'screen-saver');
      try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) { /* bỏ qua */ }
      win.on('closed', () => {
        // chỉ khi cửa sổ vừa đóng chính là ringWin hiện tại (cửa sổ cũ đóng muộn không được tắt chuông mới)
        if (ringWin !== win) return;
        ringWin = null; ringReady = false;
        // đóng bằng tay (Alt+F4) = tắt mọi chuông đang kêu
        for (const id of [...ringing.keys()]) endRing(id, 'stopped', null, true);
      });
      win.loadFile(path.join(ctx.paths.src, 'alarms/ring.html'));
      return win;
    } catch (e) {
      console.error('[alarm] không tạo được cửa sổ chuông', e);
      ringWin = null;
      return null;
    }
  }
  function showRingWin() {
    const w = ensureRingWin();
    if (!w) return false;
    placeRing(w);
    w.setAlwaysOnTop(true, 'screen-saver');
    if (!w.isVisible()) w.showInactive();   // không giành focus khi đang gõ
    return true;
  }
  function flushRing() {
    if (!ringReady || !ctx.alive(ringWin)) return;
    while (pendingSend.length) ctx.send(ringWin, 'alarm:ring', pendingSend.shift());
  }
  ipcMain.on('alarm:ringReady', e => {
    if (ctx.alive(ringWin) && e.sender === ringWin.webContents) { ringReady = true; flushRing(); }
  });

  function noteTitle(id) {
    const n = id && ctx.findNote ? ctx.findNote(id) : null;
    if (!n || !n.text) return '';
    return String(n.text).split('\n').find(l => l.trim()) ? String(n.text).split('\n').find(l => l.trim()).trim().slice(0, 80) : '';
  }

  /** Kêu ngay. alarm: bản ghi thật hoặc giả (thử). */
  function ring(alarm, { test = false, at = Date.now() } = {}) {
    const rid = test ? 'test:' + String(alarm.id).replace(/^test:/, '') : alarm.id;   // id riêng: không đè chuông thật
    const info = {
      alarmId: rid, label: alarm.label || '', time: alarm.time || hm(at),
      sound: alarm.sound || box.settings.defaultSound, snoozeMin: alarm.snoozeMin || box.settings.defaultSnoozeMin,
      volume: box.settings.volume, ringMaxMin: box.settings.ringMaxMin, test: !!test
    };
    if (alarm.soundFile) info.soundFile = alarm.soundFile;
    if (alarm.noteId) { info.noteId = alarm.noteId; const t = noteTitle(alarm.noteId); if (t) info.noteTitle = t; }
    try {
      const ln = ctx.persona && typeof ctx.persona.pick === 'function' ? ctx.persona.pick('alarm', { label: info.label, time: info.time }) : null;
      if (!petVisible(ctx) && ln && typeof ln.text === 'string' && ln.text.trim()) info.line = ln.text.trim().slice(0, 140);
    } catch (_) { /* câu thoại không ảnh hưởng chuông */ }
    ringing.set(rid, info);

    if (!test) {   // kêu thử: không phát bus / không gọi sân khấu bé
      ctx.bus.emit('alarm:ring', { alarmId: alarm.id, label: info.label, noteId: info.noteId });
      try {
        if (ctx.pet && ctx.pet.stage && ctx.pet.stage.request) {
          ctx.pet.stage.request({ kind: 'alarm', priority: 100, payload: { alarmId: alarm.id, label: info.label, noteId: info.noteId } });
        } else if (ctx.pet && ctx.pet.enqueue) {
          ctx.pet.enqueue({ type: 'alarm', alarmId: alarm.id, label: info.label });
        }
      } catch (_) { /* bé không ảnh hưởng chuông */ }
    }

    const ok = showRingWin();
    pendingSend.push(info);
    flushRing();
    let mascotOff = false;
    try { mascotOff = ctx.settings().mascotEnabled === false; } catch (_) { /* bỏ qua */ }
    if (!ok || mascotOff) {
      if (typeof ctx.alarms.toast === 'function' && ctx.alarms.toast({
        kind: 'alarm', refId: rid, title: 'Báo thức ' + info.time, body: info.label || 'Đã tới giờ',
        extra: { m: info.snoozeMin },
        buttons: [{ id: 'stop', label: 'Tắt' }, { id: 'snooze', label: 'Hoãn ' + info.snoozeMin + ' phút', m: info.snoozeMin }]
      })) { /* đã có toast nút */ } else notify('Báo thức ' + info.time, info.label || 'Đã tới giờ', () => { if (ringing.size) showRingWin(); });
    }
    return true;
  }

  /** Kết thúc một chuông. kind: 'stopped' | 'snoozed'. */
  function endRing(id, kind, minutes, fromClose) {
    if (!ringing.has(id)) return false;
    try { if (ctx.alarms.closeToast) ctx.alarms.closeToast('alarm', id); } catch (_) { /* bỏ qua */ }
    const wasTest = !!ringing.get(id).test;
    ringing.delete(id);
    const k = pendingSend.findIndex(i => i.alarmId === id); if (k >= 0) pendingSend.splice(k, 1);
    if (!wasTest) {
      if (kind === 'snoozed') ctx.bus.emit('alarm:snoozed', { alarmId: id, minutes });
      else ctx.bus.emit('alarm:stopped', { alarmId: id });
    }
    if (!fromClose) {
      ctx.send(ringWin, 'alarm:ringEnd', { alarmId: id });
      if (!ringing.size && ctx.alive(ringWin)) { const w = ringWin; ringWin = null; ringReady = false; w.destroy(); }
    }
    return true;
  }

  // ---------- tick tất định ----------
  function tick() {
    const now = Date.now();
    let changed = false;
    for (const a of box.list) {
      let d;
      try { d = L.decide(a, now, box.settings, R); } catch (e) { console.error('[alarm] decide', e); continue; }
      if (d.nextAt !== a.nextAt || d.enabled !== a.enabled || d.clearSnooze) {
        const due = a.nextAt;
        a.nextAt = d.nextAt; a.enabled = d.enabled;
        if (d.clearSnooze) delete a.snoozedUntil;
        changed = true;
        // lưu TRƯỚC khi kêu: nextAt đã dời nên không thể kêu đôi
        if (d.action === 'ring') {
          a.lastFiredAt = now;
          persist();
          ring(a, { at: now });
        } else if (d.action === 'missed') {
          L.pushMissed(box.missed, { alarmId: a.id, label: a.label, at: due });
          notify('Mochi Notes', `Báo thức ${a.label ? '"' + a.label + '" ' : ''}đã lỡ lúc ${hm(due)}`);
        }
      }
    }
    if (changed) commit();
  }

  // ---------- thao tác ----------
  /** Điền sẵn byMonthDay/byDay/anchor từ ngày đang chọn (hoặc hôm nay) để lặp không trôi. */
  function fillRepeat(a, now) {
    if (!a.repeat) return;
    const r = a.repeat;
    const dm = a.date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.date) : null;
    const base = dm ? new Date(+dm[1], +dm[2] - 1, +dm[3], 12) : new Date(now);
    if (r.freq === 'monthly' && !r.byMonthDay) r.byMonthDay = base.getDate();
    if (r.freq === 'weekly' && !(r.byDay && r.byDay.length)) r.byDay = [base.getDay()];
    if (r.anchor == null) r.anchor = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12).getTime();
  }
  const repKey = r => { if (!r) return ''; const o = Object.assign({}, r); delete o.anchor; return JSON.stringify(o); };
  function fixNext(a, now) { a.nextAt = L.computeNext(a, now, R); if (a.nextAt == null && !a.repeat && a.enabled) a.enabled = false; }
  function create(input) {
    const s = box.settings, now = Date.now(), i = input && typeof input === 'object' ? input : {};
    const a = normAlarm(Object.assign({
      sound: s.defaultSound, snoozeMin: s.defaultSnoozeMin
    }, i, { id: newId(), createdAt: now, nextAt: null, snoozedUntil: undefined, lastFiredAt: undefined }));
    fillRepeat(a, now);
    fixNext(a, now);
    box.list.push(a);
    commit();
    return a;
  }
  function update(id, patch) {
    const cur = find(id); if (!cur) return null;
    const p = patch && typeof patch === 'object' ? patch : {};
    const merged = Object.assign({}, cur, p, { id: cur.id, createdAt: cur.createdAt, nextAt: null });
    if (merged.repeat) merged.repeat = Object.assign({}, merged.repeat);
    delete merged.snoozedUntil;
    const a = normAlarm(merged);
    if (!a) return null;
    const now = Date.now();
    const sameWhen = a.time === cur.time && (a.date || '') === (cur.date || '') && repKey(a.repeat) === repKey(cur.repeat);
    if (sameWhen && cur.repeat) a.repeat = cur.repeat;     // giữ anchor cũ khi lặp không đổi
    else fillRepeat(a, now);
    if (sameWhen && a.enabled && cur.enabled && cur.snoozedUntil != null) {
      // đổi nhãn/âm khi đang hoãn: giữ hoãn và nextAt (một lần không tự tắt)
      a.snoozedUntil = cur.snoozedUntil; a.nextAt = cur.nextAt;
    } else fixNext(a, now);
    Object.assign(cur, a);
    for (const k of Object.keys(cur)) if (!(k in a)) delete cur[k];
    commit();
    return cur;
  }
  function remove(id) {
    const k = box.list.findIndex(a => a.id === id);
    if (k < 0) return false;
    box.list.splice(k, 1);
    endRing(id, 'stopped');
    commit();
    return true;
  }
  function toggle(id, on) { return update(id, { enabled: !!on }); }
  function stop(id) { return endRing(id, 'stopped'); }
  function snooze(id, minutes) {
    const a = find(id);
    const info = ringing.get(id);
    const m = Math.min(120, Math.max(1, Math.round(Number(minutes) || (a && a.snoozeMin) || box.settings.defaultSnoozeMin)));
    if (a && !(info && info.test)) { Object.assign(a, L.snoozePatch(Date.now(), m)); commit(); }
    return endRing(id, 'snoozed', m);
  }
  function testRing(id) {
    const a = find(id); if (!a) return false;
    return ring(a, { test: true });
  }
  function setSettings(patch) {
    const merged = Object.assign({}, box.settings, patch && typeof patch === 'object' ? patch : {});
    Object.assign(box.settings, normalize({ settings: merged }).settings);
    commit();
    return box.settings;
  }

  async function pickSound() {
    const parent = ctx.windows && ctx.alive(ctx.windows.list) ? ctx.windows.list : undefined;
    const r = await dialog.showOpenDialog(parent, {
      title: 'Chọn âm thanh báo thức', properties: ['openFile'],
      filters: [{ name: 'Âm thanh', extensions: SOUND_EXT }]
    });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
    const src = r.filePaths[0];
    const ext = path.extname(src).slice(1).toLowerCase();
    if (!SOUND_EXT.includes(ext)) return null;
    if (fs.statSync(src).size > MAX_SOUND_BYTES) return null;
    fs.mkdirSync(soundDir(), { recursive: true });
    let name = L.safeSoundName(path.basename(src));
    if (fs.existsSync(path.join(soundDir(), name))) {
      const e = path.extname(name); name = name.slice(0, name.length - e.length) + '-' + Date.now().toString(36) + e;
    }
    fs.copyFileSync(src, path.join(soundDir(), name));
    const rec = { soundFile: name, name: path.basename(src) };
    box.sounds.push(rec);
    commit();
    return rec;
  }
  function soundData(soundFile) {
    if (typeof soundFile !== 'string' || !soundFile) return null;
    if (soundFile !== path.basename(soundFile) || soundFile.includes('\0')) return null;   // chặn path traversal
    const dir = path.resolve(soundDir());
    const full = path.resolve(dir, soundFile);
    if (path.dirname(full) !== dir) return null;
    const mime = L.MIME[path.extname(full).toLowerCase()];
    if (!mime) return null;
    try { return { mime, base64: fs.readFileSync(full).toString('base64') }; } catch (_) { return null; }
  }

  // ---------- IPC ----------
  const h = (ch, fn) => ipcMain.handle(ch, (_e, ...a) => fn(...a));
  h('alarm:list', () => JSON.parse(JSON.stringify(snapshot())));
  h('alarm:create', create);
  h('alarm:update', update);
  h('alarm:delete', remove);
  h('alarm:toggle', toggle);
  h('alarm:test', testRing);
  h('alarm:stop', stop);
  h('alarm:snooze', snooze);
  h('alarm:pickSound', pickSound);
  h('alarm:soundData', soundData);
  h('alarm:clearMissed', () => { box.missed.length = 0; commit(); return true; });
  h('alarm:settings', setSettings);

  Object.assign(ctx.alarms, {
    list: () => box.list.slice(), create, update, remove, stop, snooze,
    isRinging: id => ringing.has(id), ringBounds,
    ring: id => testRing(id)        // kêu thử (không đổi lịch) cho module khác
  });

  // ---------- khởi động ----------
  // Tính lại nextAt cho báo thức bật mà thiếu nextAt (dữ liệu cũ), rồi bù/ghi lỡ ngay.
  const t0 = Date.now();
  let dirty = false;
  for (const a of box.list) {
    if (a.enabled && a.nextAt == null) { fixNext(a, t0); dirty = true; }
  }
  if (dirty) persist();

  const dev = parseInt(process.env.MOCHI_DEV_ALARM, 10);
  if (dev > 0 && !find('a_dev')) {
    // giờ phút hiện tại + N phút, làm tròn lên phút
    const d = new Date(Math.ceil((t0 + dev * 60000) / 60000) * 60000);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const a = normAlarm({ id: 'a_dev', label: 'Báo thức thử', time: hm(d.getTime()), date, repeat: null, enabled: true, sound: 'chime', snoozeMin: 1 });
    a.nextAt = d.getTime();
    box.list.push(a);
    persist();
  }

  // Tick bù đầu tiên chạy SAU 'app:startup' để module phòng khác đã init và nghe được alarm:ring.
  let firstTick = false;
  const runFirst = () => { if (firstTick) return; firstTick = true; tick(); };
  if (ctx.bus && typeof ctx.bus.once === 'function') {
    ctx.bus.once('app:startup', () => setTimeout(runFirst, 0));
    const fb = setTimeout(runFirst, 5000); if (fb.unref) fb.unref();   // dự phòng nếu không có sự kiện
  } else setTimeout(runFirst, 0);
  const timer = setInterval(() => { if (firstTick) tick(); }, 1000);
  if (timer.unref) timer.unref();
  ctx.bus.on('app:resume', () => { if (firstTick) tick(); });
  try { powerMonitor.on('resume', () => { if (firstTick) tick(); }); } catch (_) { /* môi trường thử */ }

  if (process.env.MOCHI_DEV_RING === '1') {
    setTimeout(() => {
      const now = Date.now();
      ring({ id: 'a_devring', label: 'Báo thức thử', time: hm(now), sound: box.settings.defaultSound, snoozeMin: box.settings.defaultSnoozeMin }, { test: true, at: now });
    }, 3000);
  }
}

module.exports = { init };
