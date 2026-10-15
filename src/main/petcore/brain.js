'use strict';
// Não của bé: tick 15s, xúc xắc hành vi rảnh (đi/ngồi/ngủ), phản ứng click/xoa, ngủ khi máy rảnh.
// Math.random được phép ở đây vì đây KHÔNG phải nhắc lịch (nhắc lịch phải tất định, nằm ở phòng khác).
const TICK_MS = 15000;
const SLEEP_AFTER_MS = 10 * 60 * 1000;

const CLICK_LINES = [
  'Hửm? Tớ đây nè.', 'Cậu gọi tớ hả?', 'Tớ đang để mắt tới lịch của cậu đó.',
  'Nhớ uống nước nha cậu.', 'Hì, cậu đừng chọc tớ hoài.', 'Có việc gì cần tớ nhắc không?'
];
const PAT_LINES = ['Hì hì, thích quá.', 'Cậu xoa nhẹ thôi nha.', 'Tớ vui lắm đó.', 'Ưm, dễ chịu ghê.'];
const WAKE_LINE = 'Ưm... tớ dậy rồi.';

function rnd(a, b) { return a + Math.random() * (b - a); }
function pickOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function createBrain(core) {
  const { ctx } = core;
  const bus = ctx.bus;
  let lastTouch = Date.now();
  let sleeping = false;
  let sitTimer = null;
  let tickTimer = null;
  let lastPatSay = 0;
  let seq = 0;
  let busyExt = false;          // đang ghi nhanh/menu: không tự làm gì
  let demo2Done = false;

  const body = () => core.body;
  const actor = () => core.actor;

  function personaLine(event, fallback) {
    try {
      if (ctx.persona && typeof ctx.persona.pick === 'function') {
        const r = ctx.persona.pick(event, {});
        if (r && typeof r === 'object' && typeof r.text === 'string' && r.text) return r.text.slice(0, 200);
      }
    } catch (_) { /* dùng câu mặc định */ }
    return fallback;
  }

  function clearSit() { if (sitTimer) { clearTimeout(sitTimer); sitTimer = null; } }

  function wake() {
    const was = sleeping || core.posture() === 'sit';
    sleeping = false;
    clearSit();
    if (was && !body().busy() && core.shown) core.toIdle();
    return was;
  }
  /** Mọi tương tác của người dùng: ghi nhận thời điểm, đánh thức. */
  function touch() { lastTouch = Date.now(); seq++; }

  function sleep() {
    if (sleeping || core.stage || !core.shown || body().busy()) return;
    clearSit();
    sleeping = true;
    core.setPosture('sleep');
    actor().play('sleep', { loop: true });
  }
  function sit() {
    if (core.stage || body().busy()) return;
    core.setPosture('sit');
    actor().play('sit', { loop: true });
    clearSit();
    sitTimer = setTimeout(() => {
      sitTimer = null;
      if (core.posture() === 'sit' && !core.stage && !body().busy()) core.toIdle();
    }, rnd(30000, 90000));
  }
  function wander() {
    const wa = body().getWorkArea(), p = body().pos();
    const room = { left: p.x - wa.x, right: wa.x + wa.width - p.x };
    const dir = Math.random() < room.left / Math.max(1, room.left + room.right) ? 'left' : 'right';
    // đang đứng trên note: 60% đi quanh trong note, 40% bước ra mép rồi nhảy xuống
    const stay = !!body().onNote() && Math.random() < 0.6;
    body().walk({ dir, dist: rnd(80, 320), avoidCursor: true, stayOnFloor: stay, allowClimb: core.box.settings.climbEnabled !== false });
  }
  function waveNow() {
    actor().play('wave', { mood: core.mode() }).then(() => { if (!body().busy() && !sleeping && core.posture() === 'idle') core.toIdle(); });
  }
  function pickWeighted(list) {
    let sum = 0;
    for (const [, w] of list) sum += w;
    let r = Math.random() * sum;
    for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
    return list[list.length - 1][0];
  }
  function act(kind) {
    if (kind === 'wander') wander();
    else if (kind === 'climb') body().climbWall({});
    else if (kind === 'hop') body().hopToNote({});
    else if (kind === 'follow') body().followCursor({});
    else if (kind === 'sit') sit();
    else waveNow();
  }

  function tick() {
    if (!core.shown || core.stage || busyExt || body().busy()) return;
    const quietMs = Date.now() - lastTouch;
    bus.emit('pet:idleTick', { quietMs });
    if (sleeping) return;
    if (quietMs > SLEEP_AFTER_MS) { sleep(); return; }
    if (core.posture() === 'sit') { if (Math.random() < 0.3) wake(); return; }
    const pAct = Math.min(0.75, 0.2 + quietMs / 900000);      // yên càng lâu càng hay tự làm việc
    if (Math.random() > pAct) return;
    const opts = [];
    if (core.box.settings.walkEnabled !== false) {            // tắt đi lại: không đi/leo/nhảy/theo trỏ
      opts.push(['wander', 30]);
      if (body().canClimb()) opts.push(['climb', 10]);
      if (body().canHop()) opts.push(['hop', 12]);
      if (body().canFollow()) opts.push(['follow', 14]);
    }
    opts.push(['sit', 22], ['wave', 12]);
    act(pickWeighted(opts));
  }

  function say(text) { actor().say(text, { ttlMs: 4000 }); }

  function onInteract(data) {
    const kind = data && data.kind;
    if (kind !== 'click' && kind !== 'pat-head' && kind !== 'pat-body') return;
    touch();
    bus.emit('pet:interact', { kind });
    if (core.stage) return;                                   // đang diễn: chỉ phát sự kiện
    if (body().busy()) return;                                // đang nhấc/rơi/nấp/đi
    const wasSleeping = sleeping;
    const wasSitting = core.posture() === 'sit';
    wake();
    const my = seq;
    const back = () => { if (seq === my && !core.stage && !body().busy() && !sleeping) core.toIdle(); };
    if (kind === 'click') {
      say(wasSleeping ? WAKE_LINE : personaLine('click', pickOf(CLICK_LINES)));
      actor().play(Math.random() < 0.5 ? 'say' : 'happy', { mood: core.mode() }).then(back);
    } else {
      const anim = kind === 'pat-head' ? 'pat_head' : 'pat_body';
      const now = Date.now();
      if (wasSleeping) say(WAKE_LINE);
      else if (now - lastPatSay > 8000 && Math.random() < 0.3) {
        lastPatSay = now;
        say(personaLine(anim, pickOf(PAT_LINES)));
      }
      actor().play(anim, { mood: 'happy' }).then(back);
    }
    void wasSitting;
  }

  function onStage(on) {
    if (on) {
      body().stopWalk();
      sleeping = false;
      clearSit();
      seq++;
      core.setPosture('idle');
    } else {
      touch();
      if (core.shown && !body().busy()) core.toIdle();
    }
  }

  /** Phòng khác (ghi nhanh, menu) báo đang bận: dừng tự đi, đánh thức nếu ngủ, không xúc xắc. */
  function setBusy(on) {
    on = !!on;
    if (busyExt === on) return;
    busyExt = on;
    if (on) {
      seq++;
      body().stopWalk();
      if (sleeping || core.posture() === 'sit') wake();
    } else touch();
  }

  // Gỡ lỗi: MOCHI_PET_DEMO2 = climb | note | follow (chạy một lần sau khi bé hiện ~2.5s).
  function runDemo2() {
    const what = process.env.MOCHI_PET_DEMO2;
    if (!what || demo2Done) return;
    demo2Done = true;
    setTimeout(async () => {
      try {
        if (!core.shown) return;
        if (what === 'climb') await body().climbWall({ maxDist: Infinity });
        else if (what === 'follow') await body().followCursor({ force: true });
        else if (what === 'note') {
          if (!ctx.windows.notes.size && ctx.notes && typeof ctx.notes.createNote === 'function') {
            try { ctx.notes.createNote({}); } catch (_) { /* bỏ qua */ }
            await new Promise(r => setTimeout(r, 1200));
          }
          for (const [, w] of ctx.windows.notes) {      // dời note lên cao một chút để có chỗ nhảy
            if (!ctx.alive(w)) continue;
            const b = w.getBounds(), wa = body().getWorkArea();
            w.setBounds({ x: Math.min(b.x, wa.x + wa.width - b.width - 20), y: wa.y + wa.height - 260, width: b.width, height: b.height });
          }
          await new Promise(r => setTimeout(r, 400));
          const p = body().pos(), wa = body().getWorkArea();
          let ok = await body().hopToNote({ force: true });
          console.log('[demo2] hop', ok, p, wa.width);
        }
      } catch (e) { console.error('[petcore] demo2', e); }
    }, 2500);
  }

  function start() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, TICK_MS);
    if (tickTimer.unref) tickTimer.unref();
    runDemo2();
  }
  function stop() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } clearSit(); sleeping = false; }

  core.window.on('interact', onInteract);
  bus.on('app:idle', () => { if (!core.stage) sleep(); });
  bus.on('app:resume', () => { touch(); wake(); });

  return { start, stop, tick, touch, wake, sleep, sit, setBusy, onStage, isSleeping: () => sleeping, onHidden() { sleeping = false; clearSit(); } };
}

module.exports = { createBrain };
