'use strict';
// Thân bé: vị trí = điểm chân (fx, fy) trên màn hình (DIP). Cửa sổ = chân - (charLeft + anchor.x*scale, charTop + anchor.y*scale).
// Chỉ có timer 16ms khi nhấc/rơi; đi dùng 50ms; đứng yên chỉ có kiểm sàn 1s.
const { screen } = require('electron');

const GRAVITY = 2400;          // px/s^2
const PEEK_RATIO = 0.4;        // quá mép > 40% bề ngang thân thì nấp
const NOTE_MARGIN = 10;
const NOTE_W = 220;            // bề rộng tờ note bé cầm (chừa lề khi về góc)
const NOTE_PAD = 8;
const MOVED_MS = 250;          // pet:moved tối đa 4 lần/s
const SAVE_DEBOUNCE_MS = 2000;
const CURSOR_PAD = 8;

function createBody(core) {
  const { ctx } = core;
  const bus = ctx.bus;
  const st = {
    fx: 0, fy: 0, face: 'right',
    mode: 'stand',               // stand | walk | lift | fall | land | peek
    placed: false,
    timer: null, walkTimer: null, watchTimer: null,
    walkDone: null, grab: null, vy: 0, peekSide: null, seq: 0,
    climbSide: null, restTimer: null, onNote: null,
    lastMoved: 0, movedTimer: null, saveTimer: null
  };
  const S = () => core.box.settings || {};

  const L = () => core.layout;
  const P = () => core.pack;
  const walls = () => core.window.win();

  /** Độ lệch từ góc cửa sổ tới điểm chân (đã tính lật mặt). */
  function offsetFor(face) {
    const l = L(), p = P();
    const ax = face === 'left' ? p.size[0] - p.anchor[0] : p.anchor[0];
    return { x: l.charLeft + ax * l.scale, y: l.charTop + p.anchor[1] * l.scale };
  }
  function offset() { return offsetFor(st.face); }

  function apply() {
    const w = walls();
    if (!w || !L()) return;
    const o = offset();
    w.setBounds({ x: Math.round(st.fx - o.x), y: Math.round(st.fy - o.y), width: L().winW, height: L().winH });
    noteMoved();
  }

  // ----- vùng bé chiếm + sự kiện pet:moved
  function rectAt(fx, fy) {
    const o = offset(), l = L();
    return { x: Math.round(fx - o.x + l.charLeft), y: Math.round(fy - o.y + l.charTop), width: l.charW, height: l.charH };
  }
  /** Phần thân bé đang hiện (toàn cửa sổ khi đang có bong bóng/tờ note của sân khấu hay ô ghi nhanh); null khi ẩn. */
  function occupiedRect() {
    if (!core.shown || !st.placed || !walls() || !L()) return null;
    let capOpen = false;
    try { capOpen = !!(core.capture && core.capture.isOpen && core.capture.isOpen()); } catch (_) { /* bỏ qua */ }
    if (core.stage || capOpen) {
      const o = offset();
      return { x: Math.round(st.fx - o.x), y: Math.round(st.fy - o.y), width: L().winW, height: L().winH };
    }
    return rectAt(st.fx, st.fy);
  }
  function emitMoved() {
    st.lastMoved = Date.now();
    const r = occupiedRect();
    if (r) { try { bus.emit('pet:moved', { rect: r }); } catch (_) { /* bỏ qua */ } }
  }
  function noteMoved() {
    const dt = Date.now() - st.lastMoved;
    if (dt >= MOVED_MS) { if (st.movedTimer) { clearTimeout(st.movedTimer); st.movedTimer = null; } emitMoved(); }
    else if (!st.movedTimer) {
      st.movedTimer = setTimeout(() => { st.movedTimer = null; emitMoved(); }, MOVED_MS - dt);
      if (st.movedTimer.unref) st.movedTimer.unref();
    }
  }
  /** Con trỏ có nằm trong thân bé (tại vị trí chân fx,fy) không. */
  function cursorHits(fx, fy, pad) {
    if (!L()) return false;
    const c = screen.getCursorScreenPoint(), r = rectAt(fx, fy);
    pad = pad == null ? CURSOR_PAD : pad;
    return c.x >= r.x - pad && c.x <= r.x + r.width + pad && c.y >= r.y - pad && c.y <= r.y + r.height + pad;
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
    let best = { y: bottom, kind: 'screen', noteId: null, wa, displayId: d.id, b: null };
    for (const [id, w] of ctx.windows.notes) {
      if (!ctx.alive(w) || !w.isVisible() || w.isMinimized()) continue;
      const b = w.getBounds();
      if (fx < b.x + NOTE_MARGIN || fx > b.x + b.width - NOTE_MARGIN) continue;
      if (b.y < fy - 2 || b.y >= bottom - 2) continue;
      if (b.y < best.y) best = { y: b.y, kind: 'note', noteId: id, wa, displayId: d.id, b };
    }
    return best;
  }

  function clearTimers() {
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    if (st.walkTimer) { clearInterval(st.walkTimer); st.walkTimer = null; }
    if (st.restTimer) { clearTimeout(st.restTimer); st.restTimer = null; }
    if (st.walkDone) { const r = st.walkDone; st.walkDone = null; r(false); }
  }
  /** Dừng mọi chuyển động tự động (không động tới nhấc: gọi stopAll để dừng luôn). */
  function cancel() {
    clearTimers(); st.seq++; st.mode = 'stand'; st.grab = null;
    if (st.climbSide) { st.climbSide = null; core.window.cmd({ op: 'climb', side: null }); }
  }

  function save() {
    const b = core.box;
    b.x = Math.round(st.fx); b.y = Math.round(st.fy);
    b.displayId = displayAt(st.fx, st.fy - 2).id;
    b.posture = core.posture();
    try { ctx.store.save(); } catch (_) { /* bỏ qua */ }
  }
  /** Lưu vị trí hãm 2s sau lần dừng gần nhất (không ghi đĩa liên tục khi đang đi). */
  function savePos() {
    if (st.saveTimer) clearTimeout(st.saveTimer);
    st.saveTimer = setTimeout(() => { st.saveTimer = null; if (st.placed) save(); }, SAVE_DEBOUNCE_MS);
    if (st.saveTimer.unref) st.saveTimer.unref();
  }
  /** Ghi nhớ bé đang đứng trên note nào (để đi theo note khi nó dời). */
  function setSupport() {
    const fl = floorAt(st.fx, st.fy);
    st.onNote = fl.kind === 'note' && Math.abs(fl.y - st.fy) < 4 ? fl.noteId : null;
  }

  // ----- giới hạn x để cửa sổ + tờ note + bong bóng nằm trọn trong workArea
  function fxRange(wa, face, withNote) {
    const l = L(), p = P(), o = offsetFor(face);
    let lo = wa.x + o.x, hi = wa.x + wa.width - (l.winW - o.x);
    if (withNote) {
      const hx = l.charLeft + (face === 'left' ? p.size[0] - p.hand[0] : p.hand[0]) * l.scale;
      if (face === 'left') lo = Math.max(lo, wa.x - (hx - NOTE_W - NOTE_PAD) + o.x);
      else hi = Math.min(hi, wa.x + wa.width - (hx + NOTE_W + NOTE_PAD) + o.x);
    }
    if (hi < lo) { const m = (lo + hi) / 2; return { lo: m, hi: m }; }
    return { lo, hi };
  }
  function outerEdge(d, side) {
    const b = d.bounds;
    return !screen.getAllDisplays().some(o => {
      if (o.id === d.id) return false;
      const ob = o.bounds;
      if (!(ob.y < b.y + b.height && ob.y + ob.height > b.y)) return false;
      return side === 'right' ? ob.x >= b.x + b.width - 2 : ob.x + ob.width <= b.x + 2;
    });
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
    st.face = 'left';                                   // góc phải: quay mặt vào trong để tờ note không tràn
    const r = fxRange(wa, st.face, true);
    st.fx = Math.min(r.hi, Math.max(r.lo, wa.x + wa.width));
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
      st.mode = 'stand'; st.placed = true; setSupport();
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
    setSupport();
    savePos();
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
    savePos();
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
  function noteRange(noteId) {
    const w = ctx.windows.notes.get(noteId);
    if (!w || !ctx.alive(w)) return null;
    const b = w.getBounds();
    const lo = b.x + NOTE_MARGIN + 2, hi = b.x + b.width - NOTE_MARGIN - 2;
    return hi >= lo ? { lo, hi } : null;
  }
  /** Bé đứng sát tường ngoài cùng nào của màn hình (và đang ở sàn màn hình)? 'left' | 'right' | null. */
  function wallSideAt(fx, fy) {
    const d = displayAt(fx, fy - 2), wa = d.workArea, half = L().charW / 2;
    if (Math.abs(fy - (wa.y + wa.height)) > 4) return null;
    if (fx <= wa.x + half + 2 && outerEdge(d, 'left')) return 'left';
    if (fx >= wa.x + wa.width - half - 2 && outerEdge(d, 'right')) return 'right';
    return null;
  }
  function autoOk() {
    return S().walkEnabled !== false && !core.stage && core.shown && !!walls() && st.mode === 'stand';
  }
  function climbOk() { return autoOk() && S().climbEnabled !== false; }

  /**
   * Đi theo trục x; trả Promise<boolean> (true = tới đích). opts: {dir, dist | toX, speedMul,
   * avoidCursor (dừng nếu thân bé sắp che con trỏ), stayOnFloor (đang đứng trên note thì không bước khỏi mép),
   * maxMs (hết giờ thì dừng, tính là tới), allowClimb/climbChance (chạm tường ngoài thì có thể leo)}.
   */
  function walk(opts) {
    opts = opts || {};
    if (st.mode !== 'stand' || !walls() || !core.shown) return Promise.resolve(false);
    if (opts.avoidCursor && cursorHits(st.fx, st.fy)) return Promise.resolve(false);
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    let lo = wa.x + L().charW / 2, hi = wa.x + wa.width - L().charW / 2;
    if (opts.stayOnFloor) {
      const fl0 = floorAt(st.fx, st.fy);
      const r = fl0.kind === 'note' ? noteRange(fl0.noteId) : null;
      if (r) { lo = Math.max(lo, r.lo); hi = Math.min(hi, r.hi); }
    }
    const pick = dirSign => {
      const t = typeof opts.toX === 'number' ? opts.toX : st.fx + dirSign * (opts.dist || 150);
      return Math.min(hi, Math.max(lo, t));
    };
    let target = pick(opts.dir === 'left' ? -1 : 1);
    if (Math.abs(target - st.fx) < 2 && opts.stayOnFloor && opts.dir && typeof opts.toX !== 'number') target = pick(opts.dir === 'left' ? 1 : -1);
    if (Math.abs(target - st.fx) < 2) return Promise.resolve(true);
    const sign = target > st.fx ? 1 : -1;
    cancel();
    st.mode = 'walk';
    const my = st.seq;
    setFace(sign > 0 ? 'right' : 'left');
    core.setPosture('walk');
    core.actor.play('walk', { loop: true });
    const speed = walkSpeed(opts.speedMul);
    const deadline = opts.maxMs ? Date.now() + opts.maxMs : 0;
    return new Promise(resolve => {
      st.walkDone = resolve;
      let last = Date.now();
      const finish = ok => {
        if (st.seq !== my) return;
        clearTimers();                                   // walkDone đã gán null trước khi gọi
        st.mode = 'stand';
        resolve(ok);
        const side = ok && opts.allowClimb ? wallSideAt(st.fx, st.fy) : null;
        if (side && climbOk() && Math.random() < (opts.climbChance == null ? 0.35 : opts.climbChance)) { startClimb(side); return; }
        setSupport();
        savePos();
        core.toIdle();
      };
      st.walkTimer = setInterval(() => {
        if (st.seq !== my || !walls()) { clearTimers(); return; }
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        let nx = st.fx + sign * speed * dt;
        const reached = sign > 0 ? nx >= target : nx <= target;
        if (reached) nx = target;
        if (opts.avoidCursor && cursorHits(nx, st.fy)) { st.walkDone = null; finish(false); return; }
        st.fx = nx;
        const fl = floorAt(st.fx, st.fy);
        apply();
        if (fl.y > st.fy + 3) { st.walkDone = null; clearTimers(); resolve(false); startFall(); return; }
        if (reached || (deadline && now >= deadline)) { st.walkDone = null; finish(true); }
      }, 50);
    });
  }
  /** Dừng mọi chuyển động tự động (đi/leo/nhảy). Đang lơ lửng trên tường thì rơi xuống. */
  function stopWalk() {
    if (st.mode === 'walk') { cancel(); core.toIdle(); }
    else if (st.mode === 'climb' || st.mode === 'hop') {
      cancel();
      if (floorAt(st.fx, st.fy).y > st.fy + 3) startFall(); else core.toIdle();
    }
  }

  // ----- leo tường
  function startClimb(side, o) {
    o = o || {};
    if (!walls() || !core.shown || (side !== 'left' && side !== 'right')) return false;
    const d = displayAt(st.fx, st.fy - 2), wa = d.workArea;
    if (!outerEdge(d, side)) return false;
    const half = L().charW / 2, floorY = wa.y + wa.height;
    const minFy = wa.y + L().charH + 12;
    const rise = Math.min(o.height || (110 + Math.random() * 170), st.fy - minFy);
    if (rise < 40) return false;
    cancel();
    const my = st.seq;
    st.mode = 'climb'; st.climbSide = side;
    st.fx = side === 'left' ? wa.x + half : wa.x + wa.width - half;
    st.fy = Math.min(st.fy, floorY);
    setFace(side);                                    // hình gốc bám tường phải; trái thì lật
    apply();
    core.setPosture('walk');
    core.window.cmd({ op: 'climb', side });
    core.actor.play('climb', { loop: true });
    const speed = walkSpeed(2.5);
    const topY = st.fy - rise;
    let dir = -1, last = Date.now();                  // -1 đi lên, +1 tụt xuống
    const stop = () => { clearTimers(); };
    const rest = () => {
      stop();
      st.restTimer = setTimeout(() => {
        st.restTimer = null;
        if (st.seq !== my) return;
        if (Math.random() < 0.3) { cancel(); core.setPosture('idle'); startFall(); return; }   // buông tay rơi
        dir = 1; last = Date.now(); loop();
      }, 3000 + Math.random() * 5000);
      if (st.restTimer.unref) st.restTimer.unref();
    };
    const loop = () => {
      st.walkTimer = setInterval(() => {
        if (st.seq !== my || !walls()) { clearTimers(); return; }
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        const ny = st.fy + dir * speed * dt;
        if (cursorHits(st.fx, ny)) { cancel(); startFall(); return; }
        st.fy = ny;
        if (dir < 0 && st.fy <= topY) { st.fy = topY; apply(); rest(); return; }
        if (dir > 0) {
          const fy2 = floorAt(st.fx, st.fy - 4).y;
          if (st.fy >= fy2) {
            st.fy = fy2; apply();
            const sd = st.climbSide;
            cancel();
            setFace(sd === 'left' ? 'right' : 'left');
            setSupport(); savePos(); core.toIdle();
            return;
          }
        }
        apply();
      }, 50);
    };
    loop();
    return true;
  }
  /** Tường ngoài gần nhất (trong maxDist) hoặc null. */
  function nearestWall(maxDist) {
    const d = displayAt(st.fx, st.fy - 2), wa = d.workArea, half = L().charW / 2;
    let best = null;
    for (const side of ['left', 'right']) {
      if (!outerEdge(d, side)) continue;
      const x = side === 'left' ? wa.x + half : wa.x + wa.width - half;
      const dist = Math.abs(x - st.fx);
      if (dist <= (maxDist == null ? 600 : maxDist) && (!best || dist < best.dist)) best = { side, x, dist };
    }
    return best;
  }
  function canClimb(opts) {
    if (!climbOk() || cursorHits(st.fx, st.fy)) return false;
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    if (Math.abs(st.fy - (wa.y + wa.height)) > 4) return false;     // chỉ leo từ sàn màn hình
    return !!nearestWall(opts && opts.maxDist);
  }
  /** Đi tới tường ngoài gần nhất rồi leo (Promise<boolean>). */
  function climbWall(opts) {
    opts = opts || {};
    if (!canClimb(opts)) return Promise.resolve(false);
    const w = nearestWall(opts.maxDist);
    if (w.dist < 2) return Promise.resolve(startClimb(w.side, opts));
    return walk({ toX: w.x, speedMul: 2.5, avoidCursor: true, allowClimb: true, climbChance: 1 });
  }

  // ----- nhảy lên note gần
  function hopPlan(force) {
    if (!autoOk() || cursorHits(st.fx, st.fy)) return null;
    const d = displayAt(st.fx, st.fy - 2), wa = d.workArea, ch = L().charH;
    const maxDx = force ? 2000 : 320;
    let best = null;
    for (const [id, w] of ctx.windows.notes) {
      if (!ctx.alive(w) || !w.isVisible() || w.isMinimized()) continue;
      const b = w.getBounds();
      if (id === st.onNote) continue;
      if (b.y >= st.fy - 24 || st.fy - b.y > 360) continue;           // phải cao hơn chân và không quá cao
      if (b.y < wa.y + ch + 6) continue;                               // trên note phải đủ chỗ cho thân
      if (b.width < 2 * NOTE_MARGIN + 40) continue;
      const cx = b.x + b.width / 2;
      if (cx < wa.x || cx > wa.x + wa.width) continue;                 // cùng màn hình
      const rlo = b.x + NOTE_MARGIN + 2, rhi = b.x + b.width - NOTE_MARGIN - 2;
      const dx = st.fx < rlo ? rlo - st.fx : st.fx > rhi ? st.fx - rhi : 0;
      if (dx > maxDx) continue;
      if (!best || dx < best.dx) best = { id, dx, rlo, rhi, ty: b.y };
    }
    if (!best) return null;
    const inset = Math.min(30, (best.rhi - best.rlo) / 2);
    best.tx = Math.min(best.rhi - inset, Math.max(best.rlo + inset, st.fx));
    if (cursorHits(best.tx, best.ty)) return null;
    return best;
  }
  function canHop() { return !!hopPlan(false); }
  function hopToNote(opts) {
    const t = hopPlan(opts && opts.force);
    if (!t) return Promise.resolve(false);
    cancel();
    st.mode = 'hop';
    const my = st.seq, x0 = st.fx, y0 = st.fy;
    setFace(t.tx >= x0 ? 'right' : 'left');
    core.setPosture('walk');
    core.actor.play('walk', { loop: true });
    const dur = 0.6 + Math.hypot(t.tx - x0, t.ty - y0) / 1400;
    const arc = 50 + Math.max(0, y0 - t.ty) * 0.35;
    let falling = false;
    const t0 = Date.now();
    return new Promise(resolve => {
      st.walkDone = resolve;
      st.walkTimer = setInterval(() => {
        if (st.seq !== my || !walls()) { clearTimers(); return; }
        const u = Math.min(1, (Date.now() - t0) / 1000 / dur);
        st.fx = x0 + (t.tx - x0) * u;
        st.fy = y0 + (t.ty - y0) * u - arc * 4 * u * (1 - u);
        if (!falling && (t.ty - y0) - 4 * arc * (1 - 2 * u) > 0) { falling = true; core.actor.play('fall', { loop: true }); }
        apply();
        if (u >= 1) { st.walkDone = null; clearTimers(); st.fx = t.tx; st.fy = t.ty; apply(); resolve(true); land(my); }
      }, 16);
    });
  }

  // ----- đi theo con trỏ một đoạn
  function followPlan(force) {
    if (!force && (S().followCursor === false || !autoOk())) return null;
    if (force && !autoOk()) return null;
    const c = screen.getCursorScreenPoint();
    const here = displayAt(st.fx, st.fy - 2), there = screen.getDisplayNearestPoint(c);
    if (here.id !== there.id) return null;
    const dx = c.x - st.fx, dy = c.y - st.fy;
    if (!force && (Math.abs(dx) > 400 || Math.abs(dy) > 450)) return null;
    if (cursorHits(st.fx, st.fy)) return null;
    const stopDist = L().charW / 2 + 40;
    const dist = Math.abs(dx) - stopDist;
    if (dist < 30) return null;
    const mul = Math.min(4, Math.max(1.2, dist / 5.5 / walkSpeed(1)));
    return { toX: c.x - Math.sign(dx) * stopDist, mul };
  }
  function canFollow() { return !!followPlan(false); }
  function followCursorWalk(opts) {
    const p = followPlan(!!(opts && opts.force));
    if (!p) return Promise.resolve(false);
    return walk({ toX: p.toX, speedMul: p.mul, maxMs: 6000, avoidCursor: true, stayOnFloor: true });
  }

  // ----- về góc
  function fade(to, ms) { core.window.cmd({ op: 'fade', to, ms }); return new Promise(r => setTimeout(r, ms + 30)); }
  async function jumpTo(fx, fy, face) {
    cancel(); st.mode = 'land';           // giữ trạng thái "bận" trong lúc nhảy
    await fade(0, 220);
    st.fx = fx; st.fy = fy;
    if (face) setFace(face);
    apply();
    await fade(1, 220);
    st.mode = 'stand'; setSupport(); savePos();
  }
  /** Chân tới góc dưới gần hơn của workArea hiện tại (chừa lề cho tờ note + bong bóng); nếu đang ẩn thì hiện luôn ở góc phải dưới. */
  async function goToCorner() {
    if (!core.shown) {
      await core.actor.show({ corner: true });
      return;
    }
    if (st.mode === 'lift') return;
    const wa = displayAt(st.fx, st.fy - 2).workArea;
    const fl = floorAt(st.fx, st.fy);
    const toRight = st.fx >= wa.x + wa.width / 2;
    const face = toRight ? 'left' : 'right';          // quay mặt vào trong: tờ note nằm phía trong màn hình
    const r = fxRange(wa, face, true);
    const targetX = Math.min(r.hi, Math.max(r.lo, toRight ? wa.x + wa.width : wa.x));
    const floorY = wa.y + wa.height;
    if (st.mode === 'peek') { leavePeek(); }
    const far = Math.abs(targetX - st.fx) > 600 || fl.kind === 'note' || Math.abs(st.fy - floorY) > 4 || st.mode !== 'stand';
    if (far) await jumpTo(targetX, floorY, face);
    else {
      cancel();
      await walk({ toX: targetX, speedMul: 2.5 });
      if (Math.abs(st.fx - targetX) > 4) await jumpTo(targetX, floorY, face);
      else setFace(face);
    }
    core.toIdle();
  }

  /** Tới đứng cạnh cửa sổ note (ưu tiên bên phải, quay mặt về note). Promise<{ok, side}>. */
  async function goToNote(noteId) {
    const w = ctx.windows.notes.get(noteId);
    if (!w || !ctx.alive(w) || !w.isVisible() || w.isMinimized()) return { ok: false, side: null };
    if (!core.shown) { try { await core.actor.show({ corner: true }); } catch (_) { /* bỏ qua */ } }
    if (!walls() || !core.shown || !L() || st.mode === 'lift') return { ok: false, side: null };
    if (!w || !ctx.alive(w) || !w.isVisible() || w.isMinimized()) return { ok: false, side: null };
    const b = w.getBounds();
    const d = screen.getDisplayMatching(b), wa = d.workArea, half = L().charW / 2, gap = 8;
    const rightX = b.x + b.width + gap + half, leftX = b.x - gap - half;
    let side = null, tx, ty;
    if (rightX + half <= wa.x + wa.width) side = 'right';
    else if (leftX - half >= wa.x) side = 'left';
    if (side) {
      tx = side === 'right' ? rightX : leftX;
      ty = floorAt(tx, b.y + b.height).y;
      // sàn cạnh note nằm quá thấp so với note (note lơ lửng trên cao): lên đứng trên mép trên note cho gần
      if (ty - (b.y + b.height) > L().charH * 1.2 && b.y >= wa.y + L().charH) side = null;
    }
    if (!side) {                                           // note rộng hết màn hình: đứng trên mép trên của nó
      tx = clampX(b.x + b.width / 2, wa);
      ty = b.y >= wa.y + L().charH ? b.y : wa.y + wa.height;
    }
    const face = side === 'right' ? 'left' : side === 'left' ? 'right' : st.face;
    if (st.mode === 'peek') leavePeek();
    const here = displayAt(st.fx, st.fy - 2);
    if (st.mode === 'stand' && here.id === d.id && Math.abs(st.fy - ty) < 4 && Math.abs(tx - st.fx) <= 900) {
      await walk({ toX: tx, speedMul: 2.5 });
      if (Math.abs(st.fx - tx) > 6 || Math.abs(st.fy - ty) > 6) await jumpTo(tx, ty, face);
      else setFace(face);
    } else await jumpTo(tx, ty, face);
    core.toIdle();
    return { ok: true, side };
  }

  // ----- kiểm sàn định kỳ 1s khi rảnh
  function watch() {
    if (!core.shown || !walls()) return;
    if (st.mode === 'stand') {
      const fl = floorAt(st.fx, st.fy);
      if (st.onNote && fl.noteId !== st.onNote) {      // note dưới chân vừa dời: dâng theo nếu nó lên cao, còn lại rơi
        const nw = ctx.windows.notes.get(st.onNote);
        if (nw && ctx.alive(nw) && nw.isVisible() && !nw.isMinimized()) {
          const b = nw.getBounds(), wa = displayAt(st.fx, st.fy - 2).workArea;
          if (st.fx >= b.x + NOTE_MARGIN && st.fx <= b.x + b.width - NOTE_MARGIN && b.y < st.fy - 3 && b.y >= wa.y + L().charH) {
            st.fy = b.y; apply(); return;
          }
        }
        st.onNote = null;
      }
      if (fl.y > st.fy + 3) startFall();               // note đã đi/đóng
      else if (fl.y < st.fy - 3 && fl.kind === 'screen') { st.fy = fl.y; apply(); }   // taskbar dâng lên
    }
  }
  function startWatch() { if (!st.watchTimer) { st.watchTimer = setInterval(watch, 1000); if (st.watchTimer.unref) st.watchTimer.unref(); } }
  function stopWatch() { if (st.watchTimer) { clearInterval(st.watchTimer); st.watchTimer = null; } }

  /** Màn hình đổi: đặt lại lên sàn hợp lệ. */
  function revalidate() {
    if (!st.placed || !walls() || !core.shown || st.mode === 'lift') return;
    if (st.mode === 'climb' || st.mode === 'hop') {            // màn hình đổi: bỏ leo/nhảy, rơi xuống sàn mới
      cancel();
      const wa = displayAt(st.fx, st.fy - 2).workArea;
      st.fx = clampX(st.fx, wa);
      startFall();
      return;
    }
    if (st.mode === 'peek' && inAnyWorkArea(st.fx, st.fy - 2, 2)) return;
    if (!inAnyWorkArea(st.fx, st.fy - 2, 4) || st.mode === 'peek') {
      cancel();
      const wa = displayAt(st.fx, st.fy - 2).workArea;
      st.fx = clampX(st.fx, wa);
      st.fy = floorAt(st.fx, wa.y + wa.height).y;
      st.mode = 'stand';
      apply();
      core.toIdle();
      savePos();
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
    goToNote, occupiedRect, canClimb, climbWall, canHop, hopToNote, canFollow, followCursor: followCursorWalk,
    onNote: () => st.onNote, cursorOnPet: () => cursorHits(st.fx, st.fy),
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
