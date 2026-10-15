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
const STIR_LINES = ['Ưm... 5 phút nữa...', 'Hmm... đừng đánh thức tớ~', 'Zzz... cho tớ ngủ thêm xíu...'];
const SLEEPY_LINE = 'Buồn ngủ quá~';
const MORNING_LINE = 'Chào buổi sáng!';
const sleepMs = ms => new Promise(r => setTimeout(r, ms));

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
  // giường: inBed = đã/đang nằm giường (renderer cần bed('out') khi dậy); sleepTok huỷ chuỗi ngáp -> lên giường khi bị đánh thức giữa chừng
  let inBed = false, sleepTok = 0, zzzTimer = null, lastStir = 0, morningDay = '';

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

  function stopZzz() { if (zzzTimer) { clearTimeout(zzzTimer); zzzTimer = null; } }
  /** Một timer duy nhất thả chữ Z định kì (6-10s) lúc ngủ. */
  function startZzz() {
    stopZzz();
    const loop = () => {
      zzzTimer = setTimeout(() => {
        zzzTimer = null;
        if (!sleeping || !core.shown || core.stage) return;
        try { actor().fx('zzz'); } catch (_) { /* bỏ qua */ }
        loop();
      }, rnd(6000, 10000));
      if (zzzTimer.unref) zzzTimer.unref();
    };
    loop();
  }
  function onFloor() {
    try { const p = body().pos(), wa = body().getWorkArea(); return !!p && Math.abs(p.y - (wa.y + wa.height)) < 4; } catch (_) { return false; }
  }
  const hasBed = () => typeof actor().bed === 'function';
  /** Sáng 6-9h, lần thức đầu tiên trong ngày: vươn vai chào. */
  function morning() {
    const d = new Date(), day = d.toDateString();
    if (d.getHours() < 6 || d.getHours() >= 9 || morningDay === day) return Promise.resolve();
    morningDay = day;
    say(MORNING_LINE);
    return Promise.resolve(actor().move('stretch')).catch(() => {}).then(() => { if (!sleeping && !core.stage && !core.antic && core.shown && !body().busy()) core.toIdle(); });
  }
  /** Rời giường: tung chăn, ngồi dậy. Đợi tối đa ~1.5s để không làm chậm việc cần ưu tiên. */
  function leaveBed() {
    inBed = false;
    let p = null;
    try { p = actor().bed('out'); } catch (_) { /* bỏ qua */ }
    return Promise.race([Promise.resolve(p).catch(() => {}), sleepMs(1500)]).then(() => {
      if (sleeping || core.stage || core.antic || !core.shown) return;
      if (!body().busy()) core.toIdle();
      return morning();
    });
  }
  /** Trả Promise khi phải rời giường (truthy), còn lại trả boolean như cũ. */
  function wake() {
    const wasSleep = sleeping;
    const was = sleeping || core.posture() === 'sit';
    const bedded = inBed;
    sleeping = false;
    sleepTok++;
    clearSit();
    stopZzz();
    if (bedded) return leaveBed();
    if (was && !body().busy() && core.shown) {
      core.toIdle();
      if (wasSleep && !core.antic && !core.stage) morning();
    }
    return was;
  }
  /** Mọi tương tác của người dùng: ghi nhận thời điểm, đánh thức. */
  function touch() { lastTouch = Date.now(); seq++; }

  function say(text) { actor().say(text, { ttlMs: 4000 }); }

  function sleep() {
    if (sleeping || core.stage || !core.shown || body().busy()) return;
    clearSit();
    sleeping = true;
    core.setPosture('sleep');
    startZzz();
    if (hasBed() && onFloor()) { bedSleep(++sleepTok); return; }   // trên sàn: ngáp -> giường -> ngủ
    actor().play('sleep', { loop: true });                         // trên nóc note: ngủ ngồi như cũ
  }
  async function bedSleep(tok) {
    const alive = () => sleepTok === tok && sleeping && core.shown && !core.stage;
    try {
      say(SLEEPY_LINE);
      await Promise.race([Promise.resolve(actor().move('yawn')).catch(() => {}), sleepMs(2500)]);
      if (!alive()) return;
      inBed = true;
      await Promise.race([Promise.resolve(actor().bed('in')).catch(() => {}), sleepMs(5000)]);
      if (!alive()) return;
      actor().play('sleep', { loop: true });
    } catch (_) {
      if (alive()) actor().play('sleep', { loop: true });
    }
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
    if (!core.shown || core.stage || core.antic || body().busy()) return;
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

  function onInteract(data) {
    const kind = data && data.kind;
    if (kind !== 'click' && kind !== 'pat-head' && kind !== 'pat-body') return;
    if (kind === 'click' && data.n >= 3) { touch(); return; }          // chọc liên tục: phòng antics phản ứng
    touch();
    bus.emit('pet:interact', { kind });
    if (core.stage || core.antic) return;                     // đang diễn / đang làm trò: chỉ phát sự kiện
    if (body().busy()) return;                                // đang nhấc/rơi/nấp/đi
    const wasSleeping = sleeping;
    const wasSitting = core.posture() === 'sit';
    // đang nằm giường: chọc nhẹ lần đầu thì cựa mình rồi ngủ tiếp, chọc lần nữa (trong 20s) mới dậy
    if (wasSleeping && inBed && Date.now() - lastStir > 20000) {
      lastStir = Date.now();
      say(pickOf(STIR_LINES));
      try { actor().bed('stir'); } catch (_) { /* bỏ qua */ }
      return;
    }
    const woke = wake();
    const my = seq;
    const back = () => { if (seq === my && !core.stage && !body().busy() && !sleeping) core.toIdle(); };
    if (woke && typeof woke.then === 'function') woke.then(() => { if (seq === my && !core.stage && !sleeping) respond(); });
    else respond();
    void wasSitting;
    function respond() {
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
    }
  }

  function onStage(on) {
    if (on) {
      body().stopWalk();
      sleeping = false;
      inBed = false;               // renderer tự thoát giường khi sân khấu phát hoạt ảnh khác: không chờ
      sleepTok++;
      stopZzz();
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
  function stop() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } clearSit(); stopZzz(); sleepTok++; inBed = false; sleeping = false; }

  core.window.on('interact', onInteract);
  bus.on('app:idle', () => { if (!core.stage) sleep(); });
  bus.on('app:resume', () => { touch(); wake(); });

  return { start, stop, tick, touch, wake, sleep, sit, onStage, isSleeping: () => sleeping, onHidden() { sleeping = false; inBed = false; sleepTok++; stopZzz(); clearSit(); } };
}

module.exports = { createBrain };
