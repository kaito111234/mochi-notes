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
    body().walk({ dir, dist: rnd(80, 320) });
  }

  function tick() {
    if (!core.shown || core.stage || body().busy()) return;
    const quietMs = Date.now() - lastTouch;
    bus.emit('pet:idleTick', { quietMs });
    if (sleeping) return;
    if (quietMs > SLEEP_AFTER_MS) { sleep(); return; }
    if (core.posture() === 'sit') { if (Math.random() < 0.3) wake(); return; }
    const pAct = Math.min(0.75, 0.2 + quietMs / 900000);      // yên càng lâu càng hay tự làm việc
    if (Math.random() > pAct) return;
    const r = Math.random();
    if (core.box.settings.walkEnabled && r < 0.5) wander();
    else if (r < 0.8) sit();
    else actor().play('wave', { mood: core.mode() }).then(() => { if (!body().busy() && !sleeping && core.posture() === 'idle') core.toIdle(); });
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

  function start() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, TICK_MS);
    if (tickTimer.unref) tickTimer.unref();
  }
  function stop() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } clearSit(); sleeping = false; }

  core.window.on('interact', onInteract);
  bus.on('app:idle', () => { if (!core.stage) sleep(); });
  bus.on('app:resume', () => { touch(); wake(); });

  return { start, stop, tick, touch, wake, sleep, sit, onStage, isSleeping: () => sleeping, onHidden() { sleeping = false; clearSit(); } };
}

module.exports = { createBrain };
