'use strict';
// Đạo diễn sân khấu: một hàng đợi ưu tiên cho mọi lần bé "lên sân khấu" (docs/spec/02-events.md, ARCH mục 5).
// Không require('electron'): Notification được truyền qua deps để test được.
const P = require('../../shared/parse.js');
const S = require('../notes/scheduler.js');
const defaultLines = require('./lines.js');

const PRIORITY = { alarm: 100, due: 90, pre: 70, memo: 60, nag: 40, tidy: 35, reward: 30, chatter: 10, hello: 10 };
const DEFAULT_TTL = { nag: 120000, tidy: 30 * 60000, reward: 20000, chatter: 10000, hello: 20000 };
const STAGE_KINDS = new Set(['alarm', 'due', 'pre', 'memo', 'nag', 'tidy', 'hello']);
const WHEN_LABEL = { startup: 'Lúc mở máy', morning: 'Buổi sáng', noon: 'Buổi trưa', evening: 'Buổi tối', 'before-shutdown': 'Trước khi tắt máy' };
const WHY = { done: 'xong', overdue: 'quá hạn', checklist: 'làm hết việc' };
const EXT_TIMEOUT = 6000;   // chạy tới góc rồi mới diễn
const MUST_NOTIFY = 60;                                                          // >= mức này thì có thông báo dự phòng

class Cancelled extends Error {
  constructor(reason) { super('cancelled:' + reason); this.reason = reason; }
}

/**
 * create(ctx, deps)
 * deps: { Notification?, now?, timeScale?, lines? }   (timeScale chỉ để test: nhân mọi thời lượng)
 */
function create(ctx, deps = {}) {
  const now = deps.now || Date.now;
  const Notification = deps.Notification || null;
  const ts = deps.timeScale || 1;
  const T = ms => Math.max(1, Math.round(ms * ts));
  const lines = deps.lines || defaultLines;
  const bus = ctx.bus;

  let seq = 0, idn = 0;
  const queue = [];
  let cur = null;          // Session đang diễn
  let running = false;
  let dirty = false;       // đã chạm vào actor, cần dọn khi hết việc
  const memoSeen = new Map();
  const fallbackRefs = new Set();
  const hooked = new WeakSet();

  const log = (...a) => { try { console.error('[stage]', ...a); } catch (_) { /* bỏ qua */ } };
  const settings = () => { try { return ctx.settings() || {}; } catch (_) { return {}; } };
  const petSettings = () => { try { return (ctx.pet.settings && ctx.pet.settings()) || {}; } catch (_) { return {}; } };
  const actorOf = () => (ctx.pet && ctx.pet.actor) || null;

  // ---------------------------------------------------------------- phiên diễn
  class Session {
    constructor(item) {
      this.item = item; this.dead = false; this.reason = null; this.finished = false;
      this.acting = false; this.pointing = null; this.listening = false; this.events = []; this.waiters = new Set(); this.timers = new Set();
    }
    cancel(reason) {
      if (this.dead) return;
      this.dead = true; this.reason = reason;
      this.clearTimers();
      for (const w of Array.from(this.waiters)) w.fail(new Cancelled(reason));
    }
    check() { if (this.dead) throw new Cancelled(this.reason); }
    clearTimers() { for (const t of this.timers) { clearTimeout(t); clearInterval(t); } this.timers.clear(); }
    after(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms); this.timers.add(t); }
    every(ms, fn) { const t = setInterval(() => { if (!this.dead) fn(); }, ms); this.timers.add(t); }
    listen() { this.listening = true; this.events.length = 0; }
    deliver(type, data) {
      if (this.dead || !this.listening) return;
      const ev = { type, data };
      for (const w of this.waiters) if (w.wantEvent) { w.finish(ev); return; }
      this.events.push(ev);
    }
    /** Chờ: hết ms -> {type:'timeout'}; opts.event: nhận sự kiện từ renderer; opts.promise: kết thúc khi promise xong. */
    wait(ms, opts = {}) {
      return new Promise((resolve, reject) => {
        if (this.dead) return reject(new Cancelled(this.reason));
        const w = { done: false, wantEvent: !!opts.event, timer: null };
        const end = () => { w.done = true; clearTimeout(w.timer); this.waiters.delete(w); };
        w.finish = v => { if (w.done) return; end(); resolve(v); };
        w.fail = e => { if (w.done) return; end(); reject(e); };
        if (ms != null) w.timer = setTimeout(() => w.finish('timeoutValue' in opts ? opts.timeoutValue : { type: 'timeout' }), ms);
        if (opts.promise) Promise.resolve(opts.promise).then(v => w.finish(v), () => w.finish(opts.errorValue));
        if (w.done) return;
        if (opts.event && this.events.length) { w.finish(this.events.shift()); return; }
        this.waiters.add(w);
      });
    }
    sleep(ms) { return this.wait(ms); }
    next(ms) { return this.wait(ms, { event: true }); }
  }

  // ---------------------------------------------------------------- tiện ích
  function validItem(item) {
    const k = item.kind;
    if (k === 'tidy') return !item.payload._asked && !!item.payload.noteId && !!ctx.findNote(item.payload.noteId) && noteVisible(item.payload.noteId);
    if (k !== 'pre' && k !== 'due' && k !== 'nag') return true;
    const t = now();
    if (k === 'nag') return S.overdueNotes(ctx.store.data.notes, t).length > 0;
    const n = item.payload.noteId ? ctx.findNote(item.payload.noteId) : null;
    const rm = remOf(n, item.payload);
    if (!n || !rm || rm.done) return false;
    if (k === 'due') return rm.due <= t + 1500;
    return true;
  }
  const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /** Nhắc cụ thể của note: theo reminderId nếu có, không thì nhắc chính. */
  function remOf(note, p) {
    if (!note) return null;
    if (p && p.reminderId && Array.isArray(note.reminders)) {
      const r = note.reminders.find(x => x && x.id === p.reminderId);
      if (r) return r;
    }
    return note.reminder || null;
  }
  function intentFor(note, rm) {
    if (rm && typeof rm.intent === 'string' && rm.intent) return rm.intent;
    try { const i = note && P.intentOf && P.intentOf(note.text || ''); return (i && i.k) || ''; } catch (_) { return ''; }
  }
  /** Số phút hoãn mặc định (cài đặt báo thức); mặc định 10. */
  function snoozeMinutes() {
    const ok = n => Number.isFinite(Number(n)) && Number(n) >= 1 && Number(n) <= 1440;
    try {
      const al = ctx.alarms;
      if (al && typeof al.settings === 'function') { const s = al.settings(); if (s && ok(s.defaultSnoozeMin)) return Math.round(Number(s.defaultSnoozeMin)); }
      else if (al && al.settings && ok(al.settings.defaultSnoozeMin)) return Math.round(Number(al.settings.defaultSnoozeMin));
    } catch (_) { /* thử đường khác */ }
    try {
      const s = ctx.store.data.alarms.settings;
      if (s && ok(s.defaultSnoozeMin)) return Math.round(Number(s.defaultSnoozeMin));
    } catch (_) { /* mặc định */ }
    return 10;
  }
  const whenText = w => {
    if (typeof w === 'string' && WHEN_LABEL[w]) return WHEN_LABEL[w];
    const n = Number(w);
    if (typeof w !== 'string' && Number.isFinite(n) && n > 1e9) { try { return P.whenLabel(n); } catch (_) { return ''; } }
    return '';
  };

  function varsFor(item, note) {
    const t = now();
    const v = { title: '', time: '', left: '', label: '', count: '', intent: '' };
    const p = item.payload || {};
    const rm = remOf(note, p);
    if (note && rm) {
      v.title = clip(p.title || rm.title || S.noteTitle(note.text), 50);
      v.time = P.hm(rm.due);
      v.left = P.dur(rm.due - t);
    }
    if (note) v.intent = intentFor(note, rm);
    if (item.kind === 'alarm') { v.label = p.label || 'Báo thức'; v.title = clip(note ? S.noteTitle(note.text) : v.label, 50); v.time = P.hm(t); }
    if (item.kind === 'memo') { v.title = clip(p.text, 60); v.time = P.hm(t); }
    if (item.kind === 'nag') v.count = String(S.overdueNotes(ctx.store.data.notes, t).length);
    return v;
  }

  /** Chọn câu: persona nếu có, không thì lines.js. Trả {text, face?, anim?}. */
  function lineFor(event, vars, extra) {
    const pr = ctx.persona;
    if (pr && typeof pr.pick === 'function') {
      try {
        const r = pr.pick(event, vars);
        if (r && typeof r.text === 'string' && r.text.trim()) {
          let text = r.text.trim();
          if ((event === 'pre' || event === 'due') && vars.title && !text.includes(vars.title)) {
            const withTitle = vars.title + ': ' + text;
            if (withTitle.length <= 120) text = withTitle;
          }
          return { text, face: r.face, anim: r.anim };
        }
      } catch (e) { log('persona.pick lỗi', e && e.message); }
    }
    const l = lines.pick(event, vars);
    return l || { text: (extra && extra.text) || '' };
  }

  function sheetFor(kind, note, big, p) {
    const r = remOf(note, p);
    return {
      title: clip((p && p.title) || (r && r.title) || S.noteTitle(note.text), 80), big,
      meta: r ? [P.whenLabel(r.due), P.intentLabel(r.intent)].join(' · ') : '',
      color: note.color, kind
    };
  }

  // ---------------------------------------------------------------- thông báo dự phòng
  /** Toast có nút của phòng notes (ctx.alarms.toast). Trả true nếu đã hiện. */
  function noteToast(item, n, title, body) {
    try {
      const al = ctx.alarms;
      if (!al || typeof al.toast !== 'function') return false;
      const p = item.payload || {};
      const m = snoozeMinutes();
      const buttons = item.kind === 'due'
        ? [{ id: 'done', label: 'Xong rồi' }, { id: 'snooze', label: 'Hoãn ' + m + ' phút', m }]
        : [{ id: 'open', label: 'Mở note' }];
      const extra = { m };
      if (p.reminderId) extra.r = p.reminderId;
      return !!al.toast({ kind: 'note', refId: n.id, title, body, buttons, extra });
    } catch (e) { log('alarms.toast lỗi', e && e.message); return false; }
  }

  function fallbackNotify(item) {
    const p = item.payload || {};
    const t = now();
    let title = 'Mochi Notes', body = '', noteId = p.noteId || null;
    if (item.kind === 'pre' || item.kind === 'due') {
      const n = noteId ? ctx.findNote(noteId) : null;
      const r = remOf(n, p);
      if (!n || !r) return;
      const label = P.intentLabel(r.intent);
      title = clip(p.title || r.title || S.noteTitle(n.text) || title, 80);
      body = item.kind === 'pre' ? `${label} · còn ${P.dur(r.due - t)} nữa (${P.hm(r.due)})` : `${label} · đã tới giờ (${P.hm(r.due)})`;
      if (noteToast(item, n, title, body)) return;
    } else if (item.kind === 'memo') {
      title = 'Mochi nhắc cậu'; body = String(p.text || 'Có một lời dặn đã tới giờ'); noteId = null;
    } else if (item.kind === 'alarm') {
      title = p.label || 'Báo thức'; body = 'Tới giờ báo thức rồi (' + P.hm(t) + ')';
    } else return;
    if (!Notification || (Notification.isSupported && !Notification.isSupported())) return;
    const nt = new Notification({ title, body, silent: !settings().sound });
    fallbackRefs.add(nt);
    const drop = () => fallbackRefs.delete(nt);
    nt.on('click', () => { drop(); if (noteId && ctx.findNote(noteId)) ctx.notes.showNote(noteId); });
    nt.on('close', drop);
    nt.on('failed', drop);
    nt.show();
  }

  // ---------------------------------------------------------------- gọi actor
  function call(actor, name, ...args) {
    try {
      const f = actor && actor[name];
      return typeof f === 'function' ? f.apply(actor, args) : undefined;
    } catch (e) { log('actor.' + name + ' lỗi', e && e.message); return undefined; }
  }
  function hook(actor) {
    if (hooked.has(actor)) return;
    hooked.add(actor);
    for (const type of ['button', 'sayEnd', 'noteClick']) {
      call(actor, 'on', type, data => { if (cur && actorOf() === actor) cur.deliver(type, data); });
    }
  }
  function lightClean(actor) {
    call(actor, 'hush'); call(actor, 'holdNote', null); call(actor, 'shake', false);
  }
  function fullClean(actor) {
    lightClean(actor);
    call(actor, 'play', 'idle', { loop: true });
    call(actor, 'setStage', false);
    if (!petSettings().alwaysVisible) call(actor, 'hide');
  }

  function emitAction(sess, button, extra) {
    const p = sess.item.payload || {};
    try {
      bus.emit('pet:stageAction', Object.assign({
        stageId: sess.item.id, kind: sess.item.kind, button,
        alarmId: p.alarmId, noteId: p.noteId, memoId: p.memoId
      }, extra));
    } catch (_) { /* bỏ qua */ }
  }
  const btnId = ev => (ev && ev.data && ev.data.id) || null;

  // ---------------------------------------------------------------- chỉ vào note
  const POINT_FLASH_MS = 8000, POINT_RENEW_MS = 6000;
  function noteVisible(noteId) {
    try {
      const reg = ctx.windows && ctx.windows.notes;
      const w = reg && typeof reg.get === 'function' ? reg.get(noteId) : null;
      if (!w) return false;
      if (typeof w.isDestroyed === 'function' && w.isDestroyed()) return false;
      if (typeof w.isVisible === 'function' && !w.isVisible()) return false;
      if (typeof w.isMinimized === 'function' && w.isMinimized()) return false;
      return true;
    } catch (_) { return false; }
  }
  function flash(noteId, ms) {
    try { if (ctx.pet && typeof ctx.pet.flashNote === 'function') ctx.pet.flashNote(noteId, ms); } catch (e) { log('flashNote lỗi', e && e.message); }
  }
  function renewPoint(sess) { if (sess.pointing && !sess.dead) flash(sess.pointing, POINT_FLASH_MS); }
  function stopPoint(sess) {
    const id = sess.pointing;
    if (!id) return;
    sess.pointing = null;
    flash(id, 0);
    try { bus.emit('pet:pointNote', { noteId: id, on: false }); } catch (_) { /* bỏ qua */ }
  }
  /** Đi tới cạnh note + chỉ tay. Đặt sess.pointing nếu thành công; mọi lỗi/treo (6s) thì không đặt, để rơi về đường cũ. */
  async function tryPoint(sess, actor, noteId) {
    if (!actor || typeof actor.goToNote !== 'function') return false;
    let res = null;
    try {
      const p = Promise.resolve(actor.goToNote(noteId)).then(r => r, () => null);
      res = await sess.wait(T(6000), { promise: p, timeoutValue: null, errorValue: null });
    } catch (e) { if (e instanceof Cancelled) throw e; res = null; }
    if (process.env.MOCHI_PET_LOG) log('tryPoint', JSON.stringify(res), noteVisible(noteId));
    if (!res || !res.ok || !noteVisible(noteId)) return false;
    sess.pointing = noteId;
    call(actor, 'play', 'point', { loop: true });
    flash(noteId, POINT_FLASH_MS);
    sess.every(T(POINT_RENEW_MS), () => renewPoint(sess));
    try { bus.emit('pet:pointNote', { noteId, on: true }); } catch (_) { /* bỏ qua */ }
    return true;
  }

  // ---------------------------------------------------------------- gõ cửa
  /** Chờ promise của phòng khác tối đa 6s; lỗi/treo -> fallback. */
  async function guarded(sess, fn, fallback, ms) {
    let p;
    try { p = Promise.resolve(fn()).then(r => r, () => fallback); } catch (_) { return fallback; }
    try { return await sess.wait(T(ms || EXT_TIMEOUT), { promise: p, timeoutValue: fallback, errorValue: fallback }); } catch (e) { if (e instanceof Cancelled) throw e; return fallback; }
  }
  /** Gõ cửa app đang dùng. Trả true nếu đã tới + gõ xong (khi đó bỏ goToCorner). Mọi lỗi -> false, đi đường cũ. */
  async function tryKnock(sess, actor) {
    const kn = ctx.pet && ctx.pet.knock;
    if (!kn || typeof kn.target !== 'function' || typeof actor.goToRect !== 'function') return false;
    try { if (typeof kn.allowed === 'function' && !kn.allowed()) return false; } catch (_) { return false; }
    const tg = await guarded(sess, () => kn.target(), null);
    const r = tg && tg.rect;
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return false;
    const res = await guarded(sess, () => actor.goToRect(r, { prefer: 'right' }), null);
    if (!res || !res.ok) return false;
    call(actor, 'play', 'knock', { loop: true });
    call(actor, 'sound', 'knock');
    sess.after(T(650), () => call(actor, 'sound', 'knock'));
    try { bus.emit('pet:knock', { target: 'foreground' }); } catch (_) { /* bỏ qua */ }
    await sess.sleep(T(1400));
    return true;
  }

  // ---------------------------------------------------------------- diễn
  async function ready(sess, actor) {
    if (typeof actor.isReady === 'function' && actor.isReady()) return true;
    if (typeof actor.whenReady !== 'function') return false;
    let p;
    try { p = Promise.resolve(actor.whenReady()).then(() => true, () => false); } catch (_) { return false; }
    return !!(await sess.wait(T(5000), { promise: p, timeoutValue: false, errorValue: false }));
  }

  async function perform(sess) {
    const item = sess.item, kind = item.kind, p = item.payload || {};
    const actor = actorOf();
    const must = item.priority >= MUST_NOTIFY;
    const off = settings().mascotEnabled === false;
    if (off || !actor) { if (must) fallbackNotify(item); return; }
    // chatter/reward: chỉ nói khi bé đang sẵn sàng và đang hiện, không bật bé ra chỉ để nói linh tinh
    if (item.priority < 40 && kind !== 'hello') {
      const vis = typeof actor.visible === 'function' ? actor.visible() : true;
      const rdy = typeof actor.isReady === 'function' ? actor.isReady() : true;
      if (!vis || !rdy) return;
    }
    if (!(await ready(sess, actor))) { if (must) fallbackNotify(item); return; }
    hook(actor);
    dirty = true;
    if (must) {   // ghi nhanh đang mở: tạm gác (nháp được giữ) để nhường chỗ cho nhắc lịch
      try { const cap = ctx.pet && ctx.pet.capture; if (cap && typeof cap.isOpen === 'function' && cap.isOpen() && typeof cap.suspend === 'function') cap.suspend(); } catch (e) { log('capture.suspend lỗi', e && e.message); }
    }
    call(actor, 'setStage', true);
    let knocked = false;
    if (kind === 'pre' || kind === 'nag') knocked = await tryKnock(sess, actor);
    if (STAGE_KINDS.has(kind) && !knocked) {
      let target = null;
      if (kind === 'pre' || kind === 'due' || kind === 'tidy') target = p.noteId || null;
      else if (kind === 'nag') { const od = S.overdueNotes(ctx.store.data.notes, now()); target = od.length ? od[0].id : null; }
      if (target && noteVisible(target)) await tryPoint(sess, actor, target);
      if (!sess.pointing) {
        await sess.wait(T(6000), { promise: Promise.resolve(call(actor, 'goToCorner')), timeoutValue: undefined, errorValue: undefined });
      }
    }
    sess.check();
    const A = (n, ...a) => call(actor, n, ...a);
    const pulse = () => { A('shake', true); sess.after(T(700), () => A('shake', false)); };
    // chỉ vào note (nếu đang chỉ) hoặc giơ tờ note như Đợt 1
    const hold = (sheet, anim) => {
      if (sess.pointing) { A('play', 'point', { loop: true }); return; }
      A('holdNote', sheet); A('play', anim || 'hold_note', { loop: true });
    };
    const open = id => { if (id && ctx.findNote(id)) { try { ctx.notes.showNote(id); } catch (e) { log(e && e.message); } } };

    switch (kind) {
      case 'pre': {
        const n = ctx.findNote(p.noteId);
        const rm = remOf(n, p);
        if (!n || !rm) return;
        const v = varsFor(item, n);
        const left = rm.due - now();
        hold(sheetFor('pre', n, left > 0 ? 'Còn ' + P.dur(left) : 'Sắp tới giờ rồi', p));
        A('sound', 'ding');
        A('say', lineFor('pre', v).text, { ttlMs: 20000, buttons: [{ id: 'ok', label: 'Biết rồi' }, { id: 'open', label: 'Mở note', primary: true }] });
        sess.listen();
        const ev = await sess.next(T(21000));
        if (ev.type === 'noteClick' || btnId(ev) === 'open') { emitAction(sess, 'open'); open(p.noteId); } else if (ev.type === 'button') emitAction(sess, btnId(ev));
        return;
      }
      case 'due': {
        const n = ctx.findNote(p.noteId);
        if (!n || !remOf(n, p)) return;
        const v = varsFor(item, n);
        const sm = snoozeMinutes();
        const buttons = [
          { id: 'done', label: 'Xong rồi', primary: true },
          { id: 'snooze', label: 'Hoãn ' + sm + ' phút' },
          { id: 'open', label: 'Mở note' }
        ];
        hold(sheetFor('due', n, 'Tới giờ rồi!', p));
        A('sound', 'ding'); pulse();
        A('say', lineFor('due', v).text, { buttons });
        sess.listen();
        let again = 0;
        for (;;) {
          const ev = await sess.next(again < 3 ? T(60000) : null);
          if (ev.type === 'timeout') {
            again++;
            A('say', lineFor('due_again', varsFor(item, ctx.findNote(p.noteId) || n)).text, { buttons });
            pulse(); A('sound', 'ding');
            renewPoint(sess);
            continue;
          }
          const id = ev.type === 'noteClick' ? 'open' : btnId(ev);
          if (id === 'done') {
            const r = remOf(ctx.findNote(p.noteId) || n, p);
            const late = !!(r && r.fired && now() - r.due > S.NAG_AFTER);
            sess.acting = true;
            try { if (p.reminderId) ctx.notes.completeNote(p.noteId, p.reminderId); else ctx.notes.completeNote(p.noteId); } catch (e) { log(e && e.message); }
            sess.acting = false;
            emitAction(sess, 'done');
            stopPoint(sess);
            sess.listening = false;
            A('holdNote', null); A('shake', false);
            A('say', lineFor(late ? 'done_late' : 'done', v).text, { ttlMs: 1600 });
            A('play', 'happy', { loop: true });
            await sess.sleep(T(1600));
            return;
          }
          if (id === 'snooze') {
            sess.acting = true;
            try { if (p.reminderId) ctx.notes.snoozeNote(p.noteId, sm, p.reminderId); else ctx.notes.snoozeNote(p.noteId, sm); } catch (e) { log(e && e.message); }
            sess.acting = false;
            emitAction(sess, 'snooze');
            stopPoint(sess);
            sess.listening = false;
            A('holdNote', null); A('shake', false);
            v.left = sm + ' phút';
            A('say', lineFor('snooze', v).text, { ttlMs: 1400 });
            A('play', 'sleep', { loop: true });
            await sess.sleep(T(1400));
            return;
          }
          if (id === 'open') { emitAction(sess, 'open'); open(p.noteId); return; }
          // sayEnd hoặc nút lạ: giữ nút chờ
        }
      }
      case 'nag': {
        const od = S.overdueNotes(ctx.store.data.notes, now());
        if (!od.length) return;
        const first = od[0];
        const v = varsFor(item, first); v.count = String(od.length);
        hold(sheetFor('due', first, 'Quá hạn ' + P.dur(now() - first.reminder.due), null));
        A('say', lineFor('nag', v).text, { ttlMs: 15000, buttons: [{ id: 'see', label: 'Để tớ xem', primary: true }, { id: 'later', label: 'Để sau' }] });
        sess.listen();
        const ev = await sess.next(T(16000));
        if (ev.type === 'noteClick' || btnId(ev) === 'see') {
          emitAction(sess, 'see');
          const cand = S.overdueNotes(ctx.store.data.notes, now())[0] || first;
          open(cand.id);
        } else if (ev.type === 'button') emitAction(sess, btnId(ev));
        return;
      }
      case 'tidy': {
        const n = ctx.findNote(p.noteId);
        if (!n || !noteVisible(p.noteId)) return;
        const title = clip(p.title || S.noteTitle(n.text), 40);
        const v = { title, why: WHY[p.reason] || WHY.done, intent: intentFor(n, null), time: '', left: '', label: '', count: '' };
        let go = !!p.auto;
        if (!go) {
          A('play', sess.pointing ? 'point' : 'say', { loop: true });
          A('say', lineFor('tidyAsk', v).text, { ttlMs: 60000, buttons: [{ id: 'tidy', label: 'Dọn đi', primary: true }, { id: 'keep', label: 'Giữ lại' }] });
          sess.listen();
          const ev = await sess.next(T(61000));
          const id = ev.type === 'noteClick' ? 'keep' : btnId(ev);
          if (id === 'tidy') { emitAction(sess, 'tidy'); go = true; } else if (ev.type === 'button') { emitAction(sess, id || 'keep'); }
          if (!go) {
            if (ev.type === 'button') {
              stopPoint(sess); sess.listening = false;
              A('say', lineFor('tidyKeep', v).text, { ttlMs: 1500 });
              await sess.sleep(T(1500));
            }
            return;
          }
        }
        sess.listening = false;
        p._asked = true;   // không hỏi lại dù bị ngắt giữa chừng
        stopPoint(sess);
        const tidy = ctx.pet && ctx.pet.tidy;
        let ok = null;   // true đã dọn, false lỗi, null không rõ (treo)
        if (tidy && typeof tidy.carryAway === 'function') {
          sess.acting = true;
          ok = await guarded(sess, () => tidy.carryAway(p.noteId), null, 40000);
          sess.acting = false;
          if (ok === false) ok = false; else if (ok !== true) ok = null;
        } else ok = false;
        sess.check();
        if (ok === null) return;
        A('say', lineFor(ok ? 'tidyDone' : 'tidyFail', v).text, { ttlMs: 3500 });
        A('play', ok ? 'happy' : 'say', { loop: true });
        emitAction(sess, ok ? 'tidied' : 'tidyFail');
        await sess.sleep(T(3500));
        return;
      }
      case 'hello': {
        A('play', 'happy', { loop: true });
        A('say', lineFor('startup', {}).text, { ttlMs: 5000 });
        sess.listen();
        await sess.next(T(5500));
        return;
      }
      case 'memo': {
        const v = varsFor(item, null);
        A('holdNote', { title: clip(p.text, 80), big: 'Dặn dò', meta: whenText(p.when), color: 'yellow', kind: 'memo' });
        A('play', 'hold_note', { loop: true });
        A('sound', 'ding');
        A('say', lineFor('memo', v).text, { ttlMs: 30000, buttons: [{ id: 'ok', label: 'Ừ, nhớ rồi', primary: true }] });
        sess.listen();
        const ev = await sess.next(T(31000));
        if (ev.type === 'button') emitAction(sess, btnId(ev));
        return;
      }
      case 'alarm': {
        const n = p.noteId ? ctx.findNote(p.noteId) : null;
        const v = varsFor(item, n);
        const snoozeMin = Number(p.snoozeMin) > 0 ? Number(p.snoozeMin) : snoozeMinutes();
        A('holdNote', { title: p.label || (n ? S.noteTitle(n.text) : '') || 'Báo thức', big: p.label || 'Báo thức', meta: P.hm(now()) + ' · Báo thức', color: n ? n.color : 'yellow', kind: 'alarm' });
        A('play', 'ring', { loop: true });
        A('shake', true);
        A('sound', 'alarm');
        sess.every(T(8000), () => A('sound', 'alarm'));
        const buttons = p.buttons || [{ id: 'stop', label: 'Tắt', primary: true }, { id: 'snooze', label: 'Hoãn ' + snoozeMin + ' phút' }];
        A('say', lineFor('alarm', v).text, { buttons });
        sess.listen();
        for (;;) {   // không tự đóng: chỉ dừng khi bấm hoặc alarm:stopped (cancel)
          const ev = await sess.next(null);
          const id = btnId(ev);
          if (ev.type !== 'button' || !id) continue;
          sess.acting = true;
          try {
            if (typeof p.onAction === 'function') { try { p.onAction(id); } catch (e) { log('onAction lỗi', e && e.message); } }
            emitAction(sess, id);
            const al = ctx.alarms;
            if (al && p.alarmId != null) {
              if (id === 'snooze' && typeof al.snooze === 'function') al.snooze(p.alarmId, snoozeMin);
              else if (id !== 'snooze' && typeof al.stop === 'function') al.stop(p.alarmId);
            }
          } catch (e) { log(e && e.message); }
          sess.acting = false;
          sess.listening = false;
          sess.clearTimers();
          A('shake', false); A('holdNote', null);
          const snz = id === 'snooze';
          v.left = snz ? snoozeMin + ' phút' : '';
          A('say', lineFor(snz ? 'alarm_snooze' : 'alarm_stop', v).text, { ttlMs: 1600 });
          A('play', snz ? 'sleep' : 'happy', { loop: true });
          await sess.sleep(T(1600));
          return;
        }
      }
      default: {   // chatter / reward / loại lạ có text
        const isReward = kind === 'reward';
        const text = p.text || (lines.pick(isReward ? 'reward' : 'chatter', {}) || {}).text;
        if (!text) return;
        A('play', p.anim || (isReward ? 'happy' : 'say'), { loop: true });
        A('say', text, { ttlMs: 5000, face: p.face });
        await sess.sleep(T(5000));
      }
    }
  }

  // ---------------------------------------------------------------- vòng chạy
  function takeNext() {
    for (;;) {
      if (!queue.length) return null;
      const t = now();
      let best = -1;
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        if (q.ttlMs != null && q.priority < 60 && t - q.at > q.ttlMs) { queue.splice(i, 1); i--; continue; }
        if (best < 0 || q.priority > queue[best].priority || (q.priority === queue[best].priority && q.seq < queue[best].seq)) best = i;
      }
      if (best < 0) return null;
      const item = queue[best];
      queue.splice(best, 1);
      let ok = true;
      try { ok = validItem(item); } catch (e) { log('validItem lỗi', e && e.message); }
      if (ok) return item;
    }
  }
  async function runItem(item) {
    const sess = new Session(item);
    cur = sess;
    try {
      await perform(sess);
      sess.finished = true;
    } catch (e) {
      if (!(e instanceof Cancelled)) log('perform lỗi', item.kind, e && e.stack || e);
    }
    sess.cancel('done');
    stopPoint(sess);
    cur = null;
    if (dirty) { const a = actorOf(); if (a) lightClean(a); }
    if (!sess.finished && sess.reason === 'preempt' && item.kind !== 'tidy') queue.push(item);   // quay lại hàng đợi (ttl xét ở takeNext)
  }
  async function loop() {
    for (;;) {
      const item = takeNext();
      if (!item) {
        if (dirty) { dirty = false; const a = actorOf(); if (a) fullClean(a); }
        running = false;
        return;
      }
      try { await runItem(item); } catch (e) { log('runItem lỗi', e && e.message); }
    }
  }
  function kick() {
    if (running) return;
    running = true;
    Promise.resolve().then(loop).catch(e => { running = false; log('loop lỗi', e && e.message); });
  }

  // ---------------------------------------------------------------- API
  function request(req) {
    req = req || {};
    const kind = String(req.kind || 'chatter');
    const payload = req.payload && typeof req.payload === 'object' ? req.payload : {};
    const priority = Number.isFinite(req.priority) ? req.priority : (PRIORITY[kind] != null ? PRIORITY[kind] : 10);
    if (kind === 'alarm' && payload.alarmId != null) {
      const same = it => it.kind === 'alarm' && it.payload.alarmId === payload.alarmId;
      const q = queue.find(same);
      if (q) return q.id;
      if (cur && same(cur.item)) return cur.item.id;
    }
    if (kind === 'memo' && payload.memoId != null) {
      const seen = memoSeen.get(payload.memoId), t = now();
      if (seen && t - seen.at < 60000) return seen.id;
    }
    let ttl = Number.isFinite(req.ttlMs) ? req.ttlMs : DEFAULT_TTL[kind];
    if (priority >= 60) ttl = undefined;
    const item = { id: 'st_' + (++idn), kind, priority, payload, ttlMs: ttl, at: now(), seq: ++seq };
    if (kind === 'memo' && payload.memoId != null) memoSeen.set(payload.memoId, { at: item.at, id: item.id });
    queue.push(item);
    if (cur && !cur.dead && priority > cur.item.priority) cur.cancel('preempt');
    kick();
    return item.id;
  }
  /** Huỷ mọi mục (đang chờ hoặc đang diễn) thoả pred(item). Mục đang diễn do chính phiên đang xử lý nút thì bỏ qua. */
  function cancelWhere(pred) {
    let n = 0;
    for (let i = queue.length - 1; i >= 0; i--) if (pred(queue[i])) { queue.splice(i, 1); n++; }
    if (cur && !cur.dead && !cur.acting && pred(cur.item)) { cur.cancel('cancel'); n++; }
    return n;
  }
  function cancel(id) { return cancelWhere(it => it.id === id) > 0; }
  function current() {
    return cur && !cur.dead ? { id: cur.item.id, kind: cur.item.kind, priority: cur.item.priority, payload: cur.item.payload } : null;
  }
  const size = () => queue.length;
  /** Có việc >= minPriority đang diễn hoặc chờ? */
  function busy(minPriority = 0) {
    if (cur && !cur.dead && cur.item.priority >= minPriority) return true;
    return queue.some(q => q.priority >= minPriority);
  }
  const has = pred => !!(queue.some(pred) || (cur && !cur.dead && pred(cur.item)));

  return { request, cancel, cancelWhere, current, size, busy, has, kick, PRIORITY };
}

module.exports = { create, PRIORITY, Cancelled };
