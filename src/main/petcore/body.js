'use strict';
// Thân bé: vị trí = điểm chân (fx, fy) trên màn hình (DIP). Cửa sổ = chân - (charLeft + anchor.x*scale, charTop + anchor.y*scale).
// Chỉ có timer 16ms khi nhấc/rơi; đi dùng 50ms; đứng yên chỉ có kiểm sàn 1s.
const { screen } = require('electron');

const GRAVITY = 2400;          // px/s^2
const PEEK_RATIO = 0.4;        // quá mép > 40% bề ngang thân thì nấp
const NOTE_MARGIN = 10;

function createBody(core) {
  const { ctx } = core;
  const bus = ctx.bus;
  const st = {
    fx: 0, fy: 0, face: 'right',
    mode: 'stand',               // stand | walk | lift | fall | land | peek
    placed: false,
    timer: null, walkTimer: null, watchTimer: null,
    walkDone: null, grab: null, vy: 0, peekSide: null, seq: 0
  };

  const L = () => core.layout;
  const P = () => core.pack;
  const walls = () => core.window.win();

  /** Độ lệch từ góc cửa sổ tới điểm chân (đã tính lật mặt). */
  function offset() {
    const l = L(), p = P();
    const ax = st.face === 'left' ? p.size[0] - p.anchor[0] : p.anchor[0];
    return { x: l.charLeft + ax * l.scale, y: l.charTop + p.anchor[1] * l.scale };
  }

  function apply() {
    const w = walls();
    if (!w || !L()) return;
    const o = offset();
    w.setBounds({ x: Math.round(st.fx - o.x), y: Math.round(st.fy - o.y), width: L().winW, height: L().winH });
  }

  function displayAt(x, y) { return screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }); }
  function inAnyWorkArea(x, y, m) {
    return screen.getAllDisplays().some(d => {
      const a = d.workArea;
      return x >= a.x - m && x <= a.x + a.width + m && y >= a.y - m && y <= a.y + a.height + m;
    });
  }
  function clampX(fx, wa) {
    const half = L().charW / 2;
    const lo = wa.x + half, hi = wa.x + wa.width - half;
    return hi < lo ? wa.x + wa.width / 2 : Math.min(hi, Math.max(lo, fx));
  }

  /** Sàn dưới chân: đáy workArea, hoặc cạnh trên cửa sổ note cao nhất ngay dưới chân. */
  function floorAt(fx, fy) {
    const d = displayAt(fx, fy - 2), wa = d.workArea;
    const bottom = wa.y + wa.height;
    let best = { y: bottom, kind: 'screen', noteId: null, wa, displayId: d.id };
    for (const [id, w] of ctx.windows.notes) {
      if (!ctx.alive(w) || !w.isVisible() || w.isMinimized()) continue;
      const b = w.getBounds();
      if (fx < b.x + NOTE_MARGIN || fx > b.x + b.width - NOTE_MARGIN) continue;
      if (b.y < fy - 2 || b.y >= bottom - 2) continue;
      if (b.y < best.y) best = { y: b.y, kind: 'note', noteId: id, wa, displayId: d.id };
    }
    return best;
  }

  function clearTimers() {
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    if (st.walkTimer) { clearInterval(st.walkTimer); st.walkTimer = null; }
    if (st.walkDone) { const r = st.walkDone; st.walkDone = null; r(false); }
  }
  /** Dừng mọi chuyển động tự động (không động tới nhấc: gọi stopAll để dừng luôn). */
  function cancel() { clearTimers(); st.seq++; st.mode = 'stand'; st.grab = null; }

  function save() {
    const b = core.box;
    b.x = Math.round(st.fx); b.y = Math.round(st.fy);
    b.displayId = displayAt(st.fx, st.fy - 2).id;
    b.posture = core.posture();
    try { ctx.store.save(); } catch (_) { /* bỏ qua */ }
  }

  function setFace(dir) {
    if (dir !== 'left' && dir !== 'right') return;
    if (st.face === dir) return;
    st.face = dir;
    core.window.cmd({ op: 'face', dir });
    apply();
  }

  // ----- đặt chỗ ban đầu
  function placeCorner(display) {
    const d = display || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const wa = d.workArea;
    st.fx = clampX(wa.x + wa.width - L().winW / 2, wa);
    st.fy = wa.y + wa.height;
    st.mode = 'stand'; st.placed = true;
    core.window.cmd({ op: 'face', dir: st.face });
    apply();
  }
  function placeInitial() {
    const b = core.box;
    if (typeof b.x === 'number' && typeof b.y === 'number' && inAnyWorkArea(b.x, b.y, 4)) {
      const wa = displayAt(b.x, b.y - 2).workArea;
      st.fx = clampX(b.x, wa);
      st.fy = floorAt(st.fx, b.y).y;
      st.mode = 'stand'; st.placed = true;
      core.window.cmd({ op: 'face', dir: st.face });
      apply();
    } else placeCorner(screen.getPrimaryDisplay());
  }

  // ----- rơi
  function startFall() {
    cancel();
    st.mode = 'fall'; st.vy = 0;
    const my = st.seq;
    core.setPosture('idle');
    core.actor.play('fall', { loop: true });
    let last = Date.now();
    st.timer = setInterval(() => {
      if (st.seq !== my || !walls()) { clearTimers(); return; }
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      st.vy += GRAVITY * dt;
      const ny = st.fy + st.vy * dt;
      const fl = floorAt(st.fx, st.fy);
      if (ny >= fl.y) { st.fy = fl.y; apply(); land(my); }
      else { st.fy = ny; apply(); }
    }, 16);
  }
  function land(my) {
    clearTimers();
    st.mode = 'land';
    save();
    core.actor.play('land', { loop: false }).then(() => {
      if (st.seq === my && st.mode === 'land') { st.mode = 'stand'; core.toIdle(); }
    });
  }

  // ----- nhấc / thả
  function onLift() {
    if (core.stage || !walls() || !core.shown) return;
    cancel();
    st.mode = 'lift';
    const c = screen.getCursorScreenPoint(), b = walls().getBounds();
    st.grab = { x: c.x - b.x, y: c.y - b.y };
    core.setPosture('lifted');
    bus.emit('pet:interact', { kind: 'lift' });
    core.brain.touch();
    core.actor.play('lifted', { loop: true });
    const my = st.seq;
    st.timer = setInterval(() => {
      if (st.seq !== my || !walls()) { clearTimers(); return; }
      followCursor();
    }, 16);
  }
  function followCursor() {
    const c = screen.getCursorScreenPoint(), o = offset();
    st.fx = c.x - st.grab.x + o.x;
    st.fy = c.y - st.grab.y + o.y;
    apply();
  }
  function onDrop() {
    if (st.mode !== 'lift') return;
    clearTimers();
    st.mode = 'stand'; st.grab = null;
    bus.emit('pet:interact', { kind: 'drop' });
    core.brain.touch();
    const wa = displayAt(st.fx, st.fy - 2).workArea, cw = L().charW;
    const outLeft = wa.x - (st.fx - cw / 2), outRight = (st.fx + cw / 2) - (wa.x + wa.width);
    if (outLeft > PEEK_RATIO * cw) peek('left', wa);
    else if (outRight > PEEK_RATIO * cw) peek('right', wa);
    else {
      st.fx = clampX(st.fx, wa);
      startFall();
    }
  }

  // ----- nấp mép
  function peek(side, wa) {
    wa = wa || displayAt(st.fx, st.fy - 2).workArea;
    cancel();
    st.mode = 'peek'; st.peekSide = side;
    st.fx = side === 'left' ? wa.x : wa.x + wa.width;    // ló khoảng nửa người
    st.fy = Math.min(wa.y + wa.height, Math.max(wa.y + L().charH, st.fy));
    apply();
    core.setPosture('peek');
    core.actor.play('peek_' + side, { loop: true });
    save();
  }
  function leavePeek() {
    if (st.mode !== 'peek') return;
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    const inner = st.peekSide === 'left' ? wa.x + L().charW / 2 + 10 : wa.x + wa.width - L().charW / 2 - 10;
    st.fx = clampX(inner, wa);
    apply();
    startFall();
  }

  // ----- đi
  function walkSpeed(mul) {
    const p = P();
    const base = p.params && p.params.walk && typeof p.params.walk.speed === 'number' ? p.params.walk.speed : 2.2;
    return base * L().scale * (1000 / 90) * (mul || 1);   // px/s, cố ý chậm cho dễ thương
  }
  /** Đi theo trục x; trả Promise<boolean> (true = tới đích). opts: {dir, dist | toX, speedMul}. */
  function walk(opts) {
    opts = opts || {};
    if (st.mode !== 'stand' || !walls() || !core.shown) return Promise.resolve(false);
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    const lo = wa.x + L().charW / 2, hi = wa.x + wa.width - L().charW / 2;
    let target;
    if (typeof opts.toX === 'number') target = opts.toX;
    else target = st.fx + (opts.dir === 'left' ? -1 : 1) * (opts.dist || 150);
    target = Math.min(hi, Math.max(lo, target));
    if (Math.abs(target - st.fx) < 2) return Promise.resolve(true);
    const sign = target > st.fx ? 1 : -1;
    cancel();
    st.mode = 'walk';
    const my = st.seq;
    setFace(sign > 0 ? 'right' : 'left');
    core.setPosture('walk');
    core.actor.play('walk', { loop: true });
    const speed = walkSpeed(opts.speedMul);
    return new Promise(resolve => {
      st.walkDone = resolve;
      let last = Date.now();
      const finish = ok => {
        if (st.seq !== my) return;
        clearTimers();                                   // resolve(false) nếu chưa; ta resolve lại bên dưới
        st.mode = 'stand';
        save();
        resolve(ok);
        core.toIdle();
      };
      st.walkTimer = setInterval(() => {
        if (st.seq !== my || !walls()) { clearTimers(); return; }
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        st.fx += sign * speed * dt;
        const reached = sign > 0 ? st.fx >= target : st.fx <= target;
        if (reached) st.fx = target;
        const fl = floorAt(st.fx, st.fy);
        apply();
        if (fl.y > st.fy + 3) { st.walkDone = null; clearTimers(); resolve(false); startFall(); return; }
        if (reached) { st.walkDone = null; finish(true); }
      }, 50);
    });
  }
  function stopWalk() { if (st.mode === 'walk') { cancel(); core.toIdle(); } }

  // ----- về góc
  function fade(to, ms) { core.window.cmd({ op: 'fade', to, ms }); return new Promise(r => setTimeout(r, ms + 30)); }
  async function jumpTo(fx, fy) {
    cancel(); st.mode = 'land';           // giữ trạng thái "bận" trong lúc nhảy
    await fade(0, 220);
    st.fx = fx; st.fy = fy; apply();
    await fade(1, 220);
    st.mode = 'stand'; save();
  }
  /** Chân tới góc dưới gần hơn của workArea hiện tại; nếu đang ẩn thì hiện luôn ở góc phải dưới. */
  async function goToCorner() {
    if (!core.shown) {
      await core.actor.show({ corner: true });
      return;
    }
    if (st.mode === 'lift') return;
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    const fl = floorAt(st.fx, st.fy);
    const left = wa.x + L().winW / 2, right = wa.x + wa.width - L().winW / 2;
    const targetX = clampX(Math.abs(st.fx - left) <= Math.abs(st.fx - right) ? left : right, wa);
    const floorY = wa.y + wa.height;
    if (st.mode === 'peek') { leavePeek(); }
    const far = Math.abs(targetX - st.fx) > 600 || fl.kind === 'note' || Math.abs(st.fy - floorY) > 4;
    if (far) await jumpTo(targetX, floorY);
    else { cancel(); await walk({ toX: targetX, speedMul: 2.5 }); }
    core.toIdle();
  }

  // ----- kiểm sàn định kỳ 1s khi rảnh
  function watch() {
    if (!core.shown || !walls()) return;
    if (st.mode === 'stand') {
      const fl = floorAt(st.fx, st.fy);
      if (fl.y > st.fy + 3) startFall();               // note đã đi/đóng
      else if (fl.y < st.fy - 3 && fl.kind === 'screen') { st.fy = fl.y; apply(); }   // taskbar dâng lên
    }
  }
  function startWatch() { if (!st.watchTimer) { st.watchTimer = setInterval(watch, 1000); if (st.watchTimer.unref) st.watchTimer.unref(); } }
  function stopWatch() { if (st.watchTimer) { clearInterval(st.watchTimer); st.watchTimer = null; } }

  /** Màn hình đổi: đặt lại lên sàn hợp lệ. */
  function revalidate() {
    if (!st.placed || !walls() || !core.shown || st.mode === 'lift') return;
    if (st.mode === 'peek' && inAnyWorkArea(st.fx, st.fy - 2, 2)) return;
    if (!inAnyWorkArea(st.fx, st.fy - 2, 4) || st.mode === 'peek') {
      cancel();
      const wa = displayAt(st.fx, st.fy - 2).workArea;
      st.fx = clampX(st.fx, wa);
      st.fy = floorAt(st.fx, wa.y + wa.height).y;
      st.mode = 'stand';
      apply();
      core.toIdle();
      save();
    } else watch();
  }
  screen.on('display-removed', revalidate);
  screen.on('display-added', revalidate);
  screen.on('display-metrics-changed', revalidate);

  // ----- tin từ renderer
  core.window.on('lift', onLift);
  core.window.on('drop', onDrop);
  core.window.on('interact', () => { if (st.mode === 'peek') leavePeek(); });

  return {
    apply, placeInitial, placeCorner, walk, stopWalk, startFall, peek, leavePeek, goToCorner, cancel,
    startWatch, stopWatch, watch, revalidate, save, setFace, floorAt,
    mode: () => st.mode,
    busy: () => st.mode !== 'stand',
    placedYet: () => st.placed,
    unplace() { st.placed = false; },
    face: () => st.face,
    pos: () => ({ x: Math.round(st.fx), y: Math.round(st.fy), displayId: displayAt(st.fx, st.fy - 2).id }),
    /** Chỉ để nghiệm thu (MOCHI_PET_DEMO=lifted): giả lập đang bị nhấc, không bám chuột. */
    demoLift() {
      cancel();
      const wa = screen.getPrimaryDisplay().workArea;
      st.mode = 'lift';
      st.fx = wa.x + wa.width / 2; st.fy = wa.y + wa.height / 2;
      apply();
      core.setPosture('lifted');
      core.actor.play('lifted', { loop: true });
    },
    getWorkArea: () => displayAt(st.fx, st.fy - 2).workArea
  };
}

module.exports = { createBody };
