'use strict';
// Đạo diễn sân khấu: một hàng đợi ưu tiên cho mọi lần bé "lên sân khấu" (docs/spec/02-events.md, ARCH mục 5).
// Không require('electron'): Notification được truyền qua deps để test được.
const P = require('../../shared/parse.js');
const S = require('../notes/scheduler.js');
const defaultLines = require('./lines.js');
const AP = require('./alertPolicy.js');

const PRIORITY = { alarm: 100, due: 90, pre: 70, memo: 60, nag: 40, reward: 30, chatter: 10, hello: 10 };
const DEFAULT_TTL = { nag: 120000, reward: 20000, chatter: 10000, hello: 20000 };
const STAGE_KINDS = new Set(['alarm', 'due', 'pre', 'memo', 'nag', 'hello']);   // chạy tới góc rồi mới diễn
const AP_WAIT = 4000;                                                            // chờ tối đa khi dò họp/toàn màn hình (probe tự timeout 3s)
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
  const bigSeen = new Map();   // "nhắc to": khoá noteId:due -> { at, n } (n = số lần đã nhắc to; giữ khi phiên bị chen ngang rồi quay lại)
  const BIG_MAX = 5;           // tối đa 5 lần nhắc to (mức giận 1..5), sau đó chỉ nhắc ở góc
  const probe = deps.probe || (() => AP.probeSystem());   // dò họp/toàn màn hình (một lần mỗi lần sắp nhắc to, cache 30s); deps.probe để test
  const busyNotified = new Set();                         // khoá đã gửi thông báo Windows nhỏ vì đang bận
  let busyUntil = 0;                                       // vừa bỏ nhắc to vì bận: tạm im tiếng ding ở góc

  const log = (...a) => { try { console.error('[stage]', ...a); } catch (_) { /* bỏ qua */ } };
  const settings = () => { try { return ctx.settings() || {}; } catch (_) { return {}; } };
  const petSettings = () => { try { return (ctx.pet.settings && ctx.pet.settings()) || {}; } catch (_) { return {}; } };
  const actorOf = () => (ctx.pet && ctx.pet.actor) || null;

  // ---------------------------------------------------------------- phiên diễn
  class Session {
    constructor(item) {
      this.item = item; this.dead = false; this.reason = null; this.finished = false;
      this.acting = false; this.listening = false; this.events = []; this.waiters = new Set(); this.timers = new Set();
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
    if (k !== 'pre' && k !== 'due' && k !== 'nag') return true;
    const t = now();
    if (k === 'nag') return S.overdueNotes(ctx.store.data.notes, t).length > 0;
    const n = item.payload.noteId ? ctx.findNote(item.payload.noteId) : null;
    if (!n || !n.reminder || n.reminder.done) return false;
    if (k === 'due') return n.reminder.due <= t + 1500;
    return true;
  }
  const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  function varsFor(item, note) {
    const t = now();
    const v = { title: '', time: '', left: '', label: '', count: '' };
    const p = item.payload || {};
    if (note && note.reminder) {
      v.title = clip(S.noteTitle(note.text), 50);
      v.time = P.hm(note.reminder.due);
      v.left = P.dur(note.reminder.due - t);
    }
    if (item.kind === 'alarm') { v.label = p.label || 'Báo thức'; v.title = clip(note ? S.noteTitle(note.text) : v.label, 50); v.time = P.hm(t); }
    if (item.kind === 'memo') { v.title = clip(p.text, 60); v.time = p.when ? P.hm(p.when) : P.hm(t); }
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

  function sheetFor(kind, note, big) {
    const r = note.reminder;
    return {
      title: S.noteTitle(note.text), big,
      meta: r ? [P.whenLabel(r.due), P.intentLabel(r.intent)].join(' · ') : '',
      color: note.color, kind
    };
  }

  // ---------------------------------------------------------------- thông báo dự phòng
  function fallbackNotify(item, silent) {
    const p = item.payload || {};
    const t = now();
    let title = 'Mochi Notes', body = '', noteId = p.noteId || null;
    if (item.kind === 'pre' || item.kind === 'due') {
      const n = noteId ? ctx.findNote(noteId) : null;
      if (!n || !n.reminder) return;
      const r = n.reminder, label = P.intentLabel(r.intent);
      title = S.noteTitle(n.text) || title;
      body = item.kind === 'pre' ? `${label} · còn ${P.dur(r.due - t)} nữa (${P.hm(r.due)})` : `${label} · đã tới giờ (${P.hm(r.due)})`;
    } else if (item.kind === 'memo') {
      title = 'Mochi nhắc cậu'; body = String(p.text || 'Có một lời dặn đã tới giờ'); noteId = null;
    } else if (item.kind === 'alarm') {
      title = p.label || 'Báo thức'; body = 'Tới giờ báo thức rồi (' + P.hm(t) + ')';
    } else return;
    if (!Notification || (Notification.isSupported && !Notification.isSupported())) return;
    const nt = new Notification({ title, body, silent: !!silent || !settings().sound });
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

  // ---------------------------------------------------------------- diễn
  async function ready(sess, actor) {
    if (typeof actor.isReady === 'function' && actor.isReady()) return true;
    if (typeof actor.whenReady !== 'function') return false;
    let p;
    try { p = Promise.resolve(actor.whenReady()).then(() => true, () => false); } catch (_) { return false; }
    return !!(await sess.wait(T(5000), { promise: p, timeoutValue: false, errorValue: false }));
  }

  /**
   * "Nhắc to" giữa màn hình (due/alarm): bé nhảy ra phóng to đập bẹp bẹp ~5.5s rồi thu về; luồng cũ chạy tiếp sau đó.
   * Tắt bằng cài đặt pet.bigAlert=false. Lỗi/thiếu API/quá hạn -> bỏ qua êm. Cancel phiên -> đóng cửa sổ ngay.
   * "Biết ý": giờ yên lặng / đang họp / trình chiếu / toàn màn hình -> không đập, trả 'skipped' (alertPolicy.js).
   */
  const bigOn = () => !!(ctx.pet && typeof ctx.pet.bigAlert === 'function') && petSettings().bigAlert !== false;
  const bigStateOf = (item, n) => (n && n.reminder ? bigSeen.get(((item.payload || {}).noteId) + ':' + n.reminder.due) || null : null);
  const stillValid = item => { try { return validItem(item); } catch (_) { return true; } };

  /**
   * level: bỏ trống = lần đầu của phiên (due: chỉ khi chưa nhắc to việc này; alarm: luôn mức 1); 2..5 = nhắc lại với mức giận tăng dần.
   * Trong lúc bé đập, nếu note đã xong/xoá/dời giờ thì đóng ngay. Trả về lý do kết thúc ('click' = cậu bấm vào bé tắt tạm) hoặc undefined.
   */
  // Quyết định có nhắc to không. Chỉ dò hệ thống khi cài đặt smartAlert bật rõ ràng (mặc định bật); lỗi/timeout -> coi như không bận.
  async function bigDecision(sess) {
    const ps = petSettings();
    let pr = null;
    if (ps.smartAlert === true) {
      pr = await sess.wait(T(AP_WAIT), { promise: Promise.resolve().then(probe).catch(() => null), timeoutValue: null, errorValue: null });
    }
    const ok = !!pr && !pr.error;
    return AP.decide({ now: now(), settings: ps, fg: ok ? pr.fg : null, processes: ok ? pr.processes : [], focusAssist: ok && pr.focusAssist === true, probeError: !ok });
  }
  function skipBig(item, n, dec) {
    const p = item.payload || {};
    log('bigAlert skipped:', dec.reason);
    if (dec.reason === 'meeting' || dec.reason === 'fullscreen') {
      busyUntil = now() + T(90000);
      const key = item.kind + ':' + (p.noteId || p.label || '') + ':' + (n && n.reminder ? n.reminder.due : Math.floor(now() / 60000));
      if (!busyNotified.has(key)) {
        if (busyNotified.size > 200) busyNotified.clear();
        busyNotified.add(key);
        try { fallbackNotify(item, true); } catch (e) { log('notify lỗi', e && e.message); }
      }
    }
    return 'skipped';
  }
  // Tiếng ding ở góc: theo âm lượng + giờ yên lặng; im hẳn nếu vừa bỏ nhắc to vì đang bận.
  function ding(actor) {
    if (now() < busyUntil) return;
    const lv = AP.soundLevel(now(), petSettings());
    if (lv > 0) call(actor, 'sound', 'ding:' + lv);
  }

  async function bigAlertFor(sess, item, level) {
    const k = item.kind;
    if (k !== 'due' && k !== 'alarm') return;
    const api = ctx.pet && ctx.pet.bigAlert;
    if (typeof api !== 'function' || petSettings().bigAlert === false) return;
    const p = item.payload || {};
    const n = p.noteId ? ctx.findNote(p.noteId) : null;
    let info, lv = 1, dec = null;
    if (k === 'due') {
      if (!n || !n.reminder) return;
      const key = p.noteId + ':' + n.reminder.due, t = now();
      let st = bigSeen.get(key);
      lv = level == null ? 1 : Math.min(BIG_MAX, Math.max(1, level));
      if (level == null && st) return;                   // đã nhắc to việc này rồi (phiên quay lại sau khi bị chen ngang)
      if (st && st.n >= lv) return;                      // mức này đã đập rồi
      dec = await bigDecision(sess);
      if (!dec.big) return skipBig(item, n, dec);
      if (!st) {
        for (const [kk, e] of bigSeen) if (t - e.at > 86400000) bigSeen.delete(kk);
        st = { at: t, n: 0 }; bigSeen.set(key, st);
      }
      st.n = lv;
      const v = varsFor(item, n);
      const l = lines.pick('big_' + lv, v);
      const lateMs = t - n.reminder.due;
      info = {
        kicker: lv === 1 ? 'Tới giờ rồi!' : (lv >= 5 ? 'Chờ lâu lắm rồi!' : 'Tới giờ lâu rồi đó!'),
        title: v.title, time: v.time, level: lv, say: l && l.text ? l.text : undefined,
        late: lv >= 2 && lateMs > 0 ? 'đã trễ ' + P.dur(lateMs) : ''
      };
    } else {
      dec = await bigDecision(sess);
      if (!dec.big) return skipBig(item, n, dec);
      info = { kicker: 'Báo thức!', title: p.label || (n ? clip(S.noteTitle(n.text), 50) : '') || 'Báo thức', time: P.hm(now()), level: 1 };
    }
    busyUntil = 0;
    info.volume = dec.sound;
    let h = null;
    try { h = api(Object.assign({ ms: T(5500 + 250 * (lv - 1)) }, info)); } catch (e) { log('bigAlert lỗi', e && e.message); return; }
    if (!h || !h.done) return;
    // đang đập mà note xong/xoá/dời giờ (ở cửa sổ note hay chỗ khác) -> dừng ngay
    const iv = setInterval(() => { if (!stillValid(item)) { try { h.abort('invalid'); } catch (_) { /* bỏ qua */ } } }, T(400));
    sess.timers.add(iv);
    let res;
    try {
      res = await sess.wait(T(14000), { promise: h.done, timeoutValue: undefined, errorValue: undefined });
    } finally {
      clearInterval(iv); sess.timers.delete(iv);
      try { if (typeof h.abort === 'function') h.abort('stage'); } catch (_) { /* bỏ qua */ }   // no-op nếu đã xong; huỷ phiên -> dọn ngay
    }
    return res && res.reason;
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
    call(actor, 'setStage', true);
    if (STAGE_KINDS.has(kind)) {
      await bigAlertFor(sess, item);
      sess.check();
      await sess.wait(T(6000), { promise: Promise.resolve(call(actor, 'goToCorner')), timeoutValue: undefined, errorValue: undefined });
    }
    sess.check();
    const A = (n, ...a) => call(actor, n, ...a);
    const pulse = () => { A('shake', true); sess.after(T(700), () => A('shake', false)); };
    const open = id => { if (id && ctx.findNote(id)) { try { ctx.notes.showNote(id); } catch (e) { log(e && e.message); } } };

    switch (kind) {
      case 'pre': {
        const n = ctx.findNote(p.noteId);
        if (!n || !n.reminder) return;
        const v = varsFor(item, n);
        const left = n.reminder.due - now();
        A('holdNote', sheetFor('pre', n, left > 0 ? 'Còn ' + P.dur(left) : 'Sắp tới giờ rồi'));
        A('play', 'hold_note', { loop: true });
        ding(actor);
        A('say', lineFor('pre', v).text, { ttlMs: 20000, buttons: [{ id: 'ok', label: 'Biết rồi' }, { id: 'open', label: 'Mở note', primary: true }] });
        sess.listen();
        const ev = await sess.next(T(21000));
        if (ev.type === 'noteClick' || btnId(ev) === 'open') { emitAction(sess, 'open'); open(p.noteId); } else if (ev.type === 'button') emitAction(sess, btnId(ev));
        return;
      }
      case 'due': {
        const n = ctx.findNote(p.noteId);
        if (!n || !n.reminder) return;
        const v = varsFor(item, n);
        const buttons = [
          { id: 'done', label: 'Xong rồi', primary: true },
          { id: 'snooze', label: 'Hoãn 10 phút' },
          { id: 'open', label: 'Mở note' }
        ];
        A('holdNote', sheetFor('due', n, 'Tới giờ rồi!'));
        A('play', 'hold_note', { loop: true });
        ding(actor); pulse();
        A('say', lineFor('due', v).text, { buttons });
        sess.listen();
        let again = 0;
        const since = now();
        const st0 = bigStateOf(item, n);
        let bigN = st0 ? st0.n : 0;          // số lần đã nhắc to (= mức giận hiện tại)
        // note xong/xoá/dời giờ ở chỗ khác: nhận biết sớm (không đợi hết 60s) để buông note và dừng nhắc to
        sess.every(T(1500), () => { if (sess.listening && !stillValid(item)) sess.deliver('invalid', {}); });
        for (;;) {
          const bigMore = bigOn() && bigN < BIG_MAX;        // còn lượt nhắc to: cứ 60s đập lại, giận hơn
          const ev = await sess.next(T(bigMore || again < 3 ? 60000 : 30000));
          if (ev.type === 'invalid') return;
          // note đã dời giờ / xong / bị xoá ở chỗ khác: buông tờ note cũ ra, không cầm mãi
          if ((ev.type === 'timeout' || ev.type === 'nudge') && !validItem(item)) return;
          // nhắc 3 lần mà vẫn chưa ai bấm: cầm thêm chút rồi buông (nhắc quá hạn "nag" sẽ quay lại sau), để bé còn làm việc khác
          if (ev.type === 'timeout' && again >= 3 && !bigMore) { if (now() - since > T(10 * 60000)) return; continue; }
          if (ev.type === 'nudge') {                       // người dùng ra lệnh cho bé lúc đang cầm note: giơ lại nút
            A('say', String(ev.data && ev.data.text || lineFor('due_again', v).text), { buttons });
            pulse();
            continue;
          }
          if (ev.type === 'timeout') {
            again++;
            const vv = varsFor(item, ctx.findNote(p.noteId) || n);
            if (bigMore) {
              // chưa phản hồi: bé nhảy ra đập kính LẠI, mặt giận hơn (mức = số lần + 1). Chế độ tập trung vẫn nhắc.
              const lv = bigN + 1;
              const br = await bigAlertFor(sess, item, lv);
              if (br !== 'skipped') bigN = lv;                  // bỏ qua vì bận/yên lặng: không tính lần đập, hết bận thì đập tiếp mức này
              sess.check();
              if (!stillValid(item)) return;
              // bé vẫn đang cầm note ở góc (chỉ mờ đi lúc đập): giơ lại nút kèm câu gắt dễ thương
              const l = lv >= 3 ? lines.pick('due_angry', vv) : null;
              A('say', l && l.text ? l.text : lineFor('due_again', vv).text, { buttons });
              pulse();
              sess.listen();
              continue;
            }
            A('say', lineFor('due_again', vv).text, { buttons });
            pulse(); ding(actor);
            continue;
          }
          const id = ev.type === 'noteClick' ? 'open' : btnId(ev);
          if (id === 'done') {
            const r = n.reminder;
            const late = !!(r && r.fired && now() - r.due > S.NAG_AFTER);
            sess.acting = true;
            try { ctx.notes.completeNote(p.noteId); } catch (e) { log(e && e.message); }
            sess.acting = false;
            emitAction(sess, 'done');
            sess.listening = false;
            A('holdNote', null); A('shake', false);
            const grumpy = bigN >= 2 ? lines.pick('done_angry', v) : null;      // đã bị bé giận từ 2 lần trở lên
            A('say', grumpy && grumpy.text ? grumpy.text : lineFor(late ? 'done_late' : 'done', v).text, { ttlMs: grumpy ? 2400 : 1600 });
            A('play', 'happy', { loop: true });
            await sess.sleep(T(grumpy ? 2400 : 1600));
            return;
          }
          if (id === 'snooze') {
            sess.acting = true;
            try { ctx.notes.snoozeNote(p.noteId, 10); } catch (e) { log(e && e.message); }
            sess.acting = false;
            emitAction(sess, 'snooze');
            sess.listening = false;
            A('holdNote', null); A('shake', false);
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
        A('holdNote', sheetFor('due', first, 'Quá hạn ' + P.dur(now() - first.reminder.due)));
        A('play', 'hold_note', { loop: true });
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
      case 'hello': {
        A('play', 'happy', { loop: true });
        A('say', lineFor('startup', {}).text, { ttlMs: 5000 });
        sess.listen();
        await sess.next(T(5500));
        return;
      }
      case 'memo': {
        const v = varsFor(item, null);
        A('holdNote', { title: clip(p.text, 80), big: 'Dặn dò', meta: p.when ? P.whenLabel(p.when) : '', color: 'yellow', kind: 'memo' });
        A('play', 'hold_note', { loop: true });
        ding(actor);
        A('say', lineFor('memo', v).text, { ttlMs: 30000, buttons: [{ id: 'ok', label: 'Ừ, nhớ rồi', primary: true }] });
        sess.listen();
        const ev = await sess.next(T(31000));
        if (ev.type === 'button') emitAction(sess, btnId(ev));
        return;
      }
      case 'alarm': {
        const n = p.noteId ? ctx.findNote(p.noteId) : null;
        const v = varsFor(item, n);
        const snoozeMin = Number(p.snoozeMin) > 0 ? Number(p.snoozeMin) : 10;
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
    cur = null;
    if (dirty) { const a = actorOf(); if (a) lightClean(a); }
    if (!sess.finished && sess.reason === 'preempt') queue.push(item);   // quay lại hàng đợi (ttl xét ở takeNext)
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
  /** Bé đang cầm note nhắc (pre/due) mà người dùng ra lệnh: nhắc lại kèm nút. Trả true nếu đã chuyển lời. */
  function nudge(text) {
    if (!cur || cur.dead || !cur.listening) return false;
    if (cur.item.kind !== 'due' && cur.item.kind !== 'pre') return false;
    cur.deliver('nudge', { text });
    return true;
  }
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

  return { request, cancel, cancelWhere, current, size, busy, has, kick, nudge, PRIORITY };
}

module.exports = { create, PRIORITY, Cancelled };
