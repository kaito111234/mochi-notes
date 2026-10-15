'use strict';
// Phòng antics — bé Mochi chơi với note trên desktop:
//  · note hết hạn: bé tới tận nơi, tháo note xuống, vo tròn, mang ra thùng rác desktop rồi ném vào (xoá mềm, nhặt lại được 30 ngày);
//  · việc quá hạn / sắp tới giờ: bé nhảy lên nóc note dậm chân hoặc đứng dưới gõ "cộc cộc", note rung lên;
//  · lúc rảnh: nhảy lên note ngồi đọc, nhảy múa, vươn vai, xoay vòng, đi quét bụi...;
//  · menu chuột phải trên bé (phòng đồ, gacha, cửa hàng, trò chơi), bấm đúp mở tủ đồ, thưởng xu bay lên khi xong việc.
// Mỗi lúc chỉ một trò; nhường ngay cho sân khấu nhắc lịch (ctx.pet.core.stage()).
const { BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const S = require('../notes/scheduler.js');
const { createBin } = require('./bin.js');
const { create: createToolbar } = require('./toolbar.js');
const CMD = require('./commands.js');

const MIN = 60000;
const LINES = {
  cleanAsk: [
    'Note “%s” %r rồi nè. Tớ dọn vào thùng rác nha?',
    'Ơ, “%s” %r rồi. Để tớ vo lại vứt đi cho gọn nhé?'
  ],
  cleanDone: ['Dọn xong rồi! Cần thì bấm vào thùng rác nhặt lại nha.', 'Gọn gàng ghê chưa~ Thùng rác giữ note 30 ngày đó.', 'Vèo! Trúng thùng luôn.'],
  kept: ['Ok, tớ để yên note đó.', 'Vâng, giữ lại nha.'],
  knockOver: ['Cộc cộc! “%s” quá hạn %d rồi đó!', 'Cậu ơi, “%s” trễ %d rồi nè!', 'Này này, “%s” chưa xong kìa (trễ %d).'],
  knockSoon: ['Cộc cộc! Còn %d nữa là tới “%s” đó.', 'Nhắc nhẹ: “%s” sắp tới giờ rồi (còn %d).'],
  knockHidden: ['Cộc cộc! Cậu có việc “%s” chưa làm nè.', 'Tớ gõ cửa nè: “%s” đang chờ cậu đó.'],
  read: ['Hmm… “%s”', 'Để tớ đọc xem: “%s”', 'Note này ghi “%s” nè.'],
  dance: ['La la la~', 'Nhảy chút cho vui nào!', 'Tèn ten~'],
  stretch: ['Vươn vai cái nào~', 'Uầy, mỏi lưng ghê.'],
  spin: ['Xoay xoay~', 'Một vòng nè!'],
  sweep: ['Quét bụi màn hình nè!', 'Để tớ dọn dẹp chút.'],
  done: ['Giỏi quá! Xong việc rồi.', 'Yay! Thêm một việc xong!', 'Cậu làm tốt lắm đó!'],
  snooze: ['Ok, 10 phút nữa tớ nhắc lại nha.', 'Được rồi, tớ chờ thêm chút.'],
  binCall: ['Thùng rác ơi, ra đây nào!', 'Bé thùng ơi~ lên làm việc nè!', 'Rác đâu, thùng đâu!'],
  roundAsk: ['Có %n note đã xong rồi nè. Tớ dọn hết vào thùng nha?', 'Tới giờ dọn dẹp! %n note xong rồi, tớ cất đi nhé?'],
  roundDone: ['Dọn xong %n note rồi! Màn hình gọn ghê~', 'Xong! %n note đã vào thùng, cần thì nhặt lại nha.'],
  roundLater: ['Ok, lát nữa tớ hỏi lại nha.', 'Vâng, để sau cũng được~'],
  nap: ['Cho tớ chợp mắt xíu…', 'Note này êm ghê, ngủ xíu nha…'],
  swing: ['Đu đưa nè~ Wheee!', 'Đánh đu trên note vui ghê!'],
  pinfix: ['Ghim lỏng rồi, để tớ ghim lại cho chắc!', 'Cộc! Chặt rồi nhé.'],
  exercise: ['Tập thể dục nào! Một, hai, ba~', 'Vận động chút cho khoẻ nha!'],
  wave: ['Hế lô cậu~', 'Cậu ơi! Tớ ở đây nè!', 'Vẫy vẫy~'],
  peek: ['Note này viết gì ta?', 'Để tớ ngó xem…'],
  sing: ['Lá la lá~ 🎵', 'Hát cho cậu nghe nè~'],
  newNote: ['Note mới nè! Cậu định ghi gì đây?', 'Ồ, có note mới! Tớ canh giúp cho~'],
  typing: ['Cố lên! Viết tiếp đi nè~', 'Cậu viết chăm ghê!', 'Tớ ngồi đây xem cậu viết nha.'],
  welcome: ['Cậu về rồi! Nhớ cậu ghê~', 'A, cậu quay lại rồi! Làm tiếp nào!'],
  lunch: 'Gần trưa rồi, nhớ ăn cơm đúng giờ nha!',
  late: 'Khuya rồi đó… làm nốt rồi đi ngủ sớm nha 😴',
  water: ['Uống ngụm nước đi cậu ơi 💧', 'Nghỉ mắt 20 giây nào, nhìn ra xa xa~'],
  readBook: ['Đọc sách chút nha~', 'Quyển này cuốn ghê.', 'Suỵt, tớ đang đọc truyện.'],
  readNice: ['Đoạn này hay ghê!', 'Ôi, đọc tới đoạn cảm động rồi~'],
  eat: ['Cơm nắm nè, thơm ghê~', 'Tới giờ ăn rồi, nhồm nhoàm~', 'Ăn cho có sức làm việc nha!'],
  eatDone: ['Ngon quá~', 'No bụng rồi, cảm ơn cậu nha!'],
  tea: ['Pha ly trà cho ấm bụng nè~', 'Trà nóng thơm quá.', 'Nghỉ chút uống trà nha cậu.'],
  teaDone: ['Hà~ ấm bụng', 'Ngon ghê, cậu uống cùng tớ không?'],
  waterPlant: ['Tưới cây cho mau lớn nè~', 'Cây ơi uống nước nào!', 'Chăm cây chút xíu nha.'],
  waterDone: ['Cây nở hoa rồi, xinh quá!', 'Tèn ten, hoa nở rồi nè~'],
  bubbles: ['Thổi bong bóng nè~', 'Phù~ nhiều bong bóng ghê!', 'Bong bóng bay bay~'],
  music: ['Nghe nhạc chút cho thư giãn~', 'Bài này nghe đã ghê!', 'Lắc lư theo nhạc nào~'],
  butterfly: ['Bướm ơi đợi tớ!', 'Ôi, con bướm xinh quá!', 'Đừng bay xa nha bướm ơi~'],
  draw: ['Tớ vẽ bạn nè!', 'Vẽ tranh tặng cậu nha~', 'Nguệch ngoạc một chút thôi.'],
  yawn: ['Hoáaa~ buồn ngủ quá.', 'Ngáp một cái… ngủ gật mất.', 'Ưm… mắt tớ díp lại rồi.'],
  bedtime: 'Khuya rồi, tớ đi ngủ đây. Bạn cũng nghỉ sớm nha!',
  binEmpty: 'Thùng rác đang trống trơn nè.',
  binHas: 'Trong thùng có %n note. Bấm vào để nhặt lại nha.'
};
const REASON = { done: 'đã xong', overdue: 'quá hạn lâu rồi', checklist: 'đã tick hết', cmd: 'cậu bảo vứt', empty: 'trống trơn' };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function dur(ms) {
  ms = Math.max(0, ms);
  const m = Math.round(ms / MIN);
  if (m < 1) return 'vài giây';
  if (m < 60) return m + ' phút';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' tiếng' + (m % 60 ? ' ' + (m % 60) + ' phút' : '');
  return Math.round(h / 24) + ' ngày';
}

function defaults() {
  return { autoClean: true, nagTap: true, playful: true, kept: {}, bin: { x: null, y: null, always: false }, cleanEvery: 45 };
}
function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  for (const k of ['autoClean', 'nagTap', 'playful']) if (typeof raw[k] === 'boolean') d[k] = raw[k];
  if (raw.kept && typeof raw.kept === 'object') {
    for (const id of Object.keys(raw.kept)) if (typeof id === 'string' && id.length < 100 && !['__proto__', 'constructor', 'prototype'].includes(id)) d.kept[id] = true;
  }
  const b = raw.bin && typeof raw.bin === 'object' ? raw.bin : {};
  if (typeof b.x === 'number' && isFinite(b.x)) d.bin.x = Math.round(b.x);
  if (typeof b.y === 'number' && isFinite(b.y)) d.bin.y = Math.round(b.y);
  if (typeof b.always === 'boolean') d.bin.always = b.always;      // khoá 'visible' cũ bỏ qua: giờ mặc định ẩn
  if ([0, 20, 45, 90, 180].includes(raw.cleanEvery)) d.cleanEvery = raw.cleanEvery;
  return d;
}

class Abort extends Error {}

function init(ctx) {
  const bus = ctx.bus;
  const box = ctx.store.section('antics', defaults, normalize);
  const save = () => { try { ctx.store.save(); } catch (_) { /* bỏ qua */ } };
  const P = () => ctx.pet || {};
  const A = () => P().actor;
  const B = () => P().body;
  const C = () => P().core;
  const ready = () => !!(A() && B() && C() && typeof B().leap === 'function');

  const bin = createBin(ctx, box, save);

  // ------------------------------------------------------------------ chạy trò
  let running = null;               // tên trò đang diễn
  let lastAct = 0;
  const say = (text, opts) => A().say(text, Object.assign({ ttlMs: 5000 }, opts || {}));
  // đạo cụ: gọi an toàn (renderer cũ chưa có thì bỏ qua); mỗi trò dùng đạo cụ bọc bằng withProps để luôn dọn
  const prop = (kind, o) => { try { if (A() && typeof A().prop === 'function') A().prop(kind, o); } catch (_) { /* bỏ qua */ } };
  const clearProps = () => prop(null);
  const withProps = fn => async () => { try { await fn(); } finally { clearProps(); } };

  function canAct() {
    if (!ready() || running) return false;
    const c = C();
    if (!c.shown() || c.stage()) return false;
    if (B().busy()) return false;
    return true;
  }
  let preempt = false;              // lệnh của cậu tới: dừng trò chơi đang diễn
  function guard() {
    const c = C();
    if (preempt || !c.shown() || c.stage() || B().mode() === 'lift') throw new Abort();
  }
  async function step(p) { guard(); const r = await p; guard(); return r; }
  async function wait(ms) { guard(); await sleep(ms); guard(); }

  /** Chạy một trò: một lúc một trò, tự dọn dẹp khi xong/bị ngắt. */
  async function perform(name, fn, opts) {
    opts = opts || {};
    if (!ready() || running) return false;
    if (C().brain.isSleeping()) {
      if (!opts.wake) return false;
      const w = C().brain.wake();                                 // đang nằm giường: đợi tung chăn xong (tối đa 1.5s)
      await Promise.race([Promise.resolve(w), sleep(1500)]);
      if (w && typeof w.then === 'function') await sleep(100); else await sleep(400);
    }
    if (!canAct()) return false;
    running = name; lastAct = Date.now();
    C().setAntic(true);
    C().brain.touch();
    let ok = false;
    try { await fn(); ok = true; }
    catch (e) { if (!(e instanceof Abort)) console.error('[antics] ' + name, e); }
    finally {
      running = null;
      preempt = false;
      try { if (B().mode() === 'hang') B().startFall(); } catch (_) { /* bỏ qua */ }
      C().setAntic(false);
      try { A().ball(false); } catch (_) { /* bỏ qua */ }
      clearProps();
      if (!C().stage()) {
        try { A().holdNote(null); } catch (_) { /* bỏ qua */ }
        if (C().shown() && !B().busy() && !C().brain.isSleeping()) C().toIdle();   // đã lên giường ngủ (trò bedtime) thì giữ nguyên
      }
      lastAct = Date.now();
    }
    return ok;
  }

  // ------------------------------------------------------------------ hình học
  const noteWin = id => { const w = ctx.windows.notes.get(id); return ctx.alive(w) && w.isVisible() && !w.isMinimized() ? w : null; };
  function displayWA(x, y) { return screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea; }
  const floorY = wa => wa.y + wa.height;
  function onScreenFloor() { const p = B().pos(); return Math.abs(p.y - floorY(displayWA(p.x, p.y - 2))) < 4; }

  /** Đi tới hoành độ x trên sàn màn hình (xa quá thì "nhảy cóc" mờ đi rồi hiện lại). */
  async function goFloorX(x, speedMul) {
    const p = B().pos(), wa = displayWA(x, p.y - 2);
    if (!onScreenFloor()) { await step(B().leap(x, floorY(wa), { height: 50 })); return; }
    const sameDisplay = displayWA(p.x, p.y - 2).x === wa.x;
    // xa quá 600px thì nhảy cóc (đi bộ 1000px mất ~17s, người dùng tưởng bé đứng im)
    if (!sameDisplay || Math.abs(x - p.x) > 600) { await step(B().jumpTo(x, floorY(wa))); return; }
    const ok = await step(B().walk({ toX: x, speedMul: speedMul || 2.6 }));
    if (!ok && Math.abs(B().pos().x - x) > 30) throw new Abort();
  }
  function faceTo(x) { const p = B().pos(); if (Math.abs(x - p.x) > 3) B().setFace(x > p.x ? 'right' : 'left'); }

  const paperOf = w => (ctx.notes.paperBounds ? ctx.notes.paperBounds(w) : w.getBounds());
  /** Lắc cửa sổ note (bị gõ/dậm). */
  async function wiggle(id, times, amp) {
    const w = noteWin(id); if (!w) return;
    const b = w.getBounds();
    for (let i = 0; i < (times || 6); i++) {
      if (!ctx.alive(w)) return;
      const dx = (i % 2 ? -1 : 1) * (amp || 6) * (1 - i / ((times || 6) + 2));
      try { w.setPosition(Math.round(b.x + dx), Math.round(b.y + (i % 2 ? 0 : 2))); } catch (_) { return; }
      await sleep(45);
    }
    if (ctx.alive(w)) try { w.setPosition(b.x, b.y); } catch (_) { /* bỏ qua */ }
  }

  /** Đợi bé chạm đất sau startFall/hopDown. */
  async function landed(maxMs) {
    const t0 = Date.now();
    while (B().busy() && Date.now() - t0 < (maxMs || 4000)) await sleep(60);
  }
  /** Đang treo (cú 'jump') thì thả rơi xuống sàn. */
  async function finishApproach(where) {
    if (where === 'top') await step(B().hopDown());
    else if (where === 'jump') { B().startFall(); await landed(); }
  }
  /** Bé tới chỗ note: đứng dưới (note thấp), nhảy lên nóc (note cao, trên có chỗ) hoặc bật lên gõ đáy (note sát mép trên).
   *  -> 'top' | 'below' | 'jump' */
  async function approachNote(id, prefer) {
    const w = noteWin(id); if (!w) throw new Abort();
    const b = paperOf(w), sz = B().size();
    const wa = displayWA(b.x + b.width / 2, b.y + b.height / 2);
    const fl = floorY(wa);
    const cx = b.x + b.width / 2;
    const roomAbove = b.y - wa.y >= sz.h * 0.9;
    const low = b.y + b.height >= fl - sz.h * 0.75;             // đáy note ngang tầm tay bé đứng dưới sàn
    if (low && (prefer !== 'top' || !roomAbove)) {
      // đứng cạnh mép note dưới sàn
      const p = B().pos();
      const side = p.x < cx ? -1 : 1;
      await goFloorX(side < 0 ? b.x - sz.w * 0.18 : b.x + b.width + sz.w * 0.18);
      faceTo(cx);
      return 'below';
    }
    if (!roomAbove || prefer === 'jump') {
      // chạy tới ngay dưới note rồi bật lên, đầu chạm đáy note, treo đó gõ
      const p = B().pos();
      const ux = Math.max(b.x + sz.w * 0.3, Math.min(b.x + b.width - sz.w * 0.3, p.x));
      await goFloorX(ux);
      A().fx('exclaim');
      await step(A().move('squash'));
      const w2 = noteWin(id); if (!w2) throw new Abort();
      const b2 = paperOf(w2);
      await step(B().leap(B().pos().x, b2.y + b2.height + sz.h * 0.92, { hang: true, height: 24 }));
      return 'jump';
    }
    // lên nóc: nếu đang đứng trên note khác cao hơn thì xuống trước cho cú nhảy đẹp
    const p = B().pos();
    const landX = Math.max(b.x + sz.w * 0.3, Math.min(b.x + b.width - sz.w * 0.3, p.x < cx ? b.x + b.width * 0.35 : b.x + b.width * 0.65));
    if (onScreenFloor()) {
      const runX = landX + (p.x < landX ? -1 : 1) * Math.min(220, Math.abs(p.x - landX));
      if (Math.abs(runX - p.x) > 40) await goFloorX(runX);
    }
    faceTo(landX);
    await step(A().move('squash'));
    const w2 = noteWin(id); if (!w2) throw new Abort();
    const b2 = paperOf(w2);
    await step(B().leap(Math.max(b2.x + 20, Math.min(b2.x + b2.width - 20, landX)), b2.y));
    return 'top';
  }

  /** Thông tin tờ note cầm trên tay (giống sân khấu). */
  function sheetOf(n, big) {
    const r = n.reminder;
    return { title: clip(S.noteTitle(n.text), 80), big: big || '', meta: r && r.due ? new Date(r.due).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '', color: n.color || 'yellow', kind: 'memo' };
  }

  /** Hỏi có/không bằng bong bóng; hết giờ thì trả def. */
  function ask(text, buttons, ms, def) {
    return new Promise(resolve => {
      let done = false;
      const off = A().on('button', d => {
        const id = d && d.id;
        if (!buttons.some(b => b.id === id)) return;
        finish(id);
      });
      const t = setTimeout(() => finish(def), ms);
      function finish(v) { if (done) return; done = true; clearTimeout(t); try { off(); } catch (_) { /* bỏ qua */ } resolve(v); }
      say(text, { buttons, ttlMs: ms + 500 });
    });
  }

  // ------------------------------------------------------------------ 1) dọn note hết hạn
  const cleanQueue = [];
  function queueClean(noteId, reason) {
    if (!box.autoClean || box.kept[noteId] || (ctx.extras && ctx.extras.isDaily && ctx.extras.isDaily(noteId))) return;
    if (cleanQueue.some(q => q.noteId === noteId)) return;
    cleanQueue.push({ noteId, reason: reason || 'done', at: Date.now() });
  }
  async function cleanNote(noteId, reason, opts) {
    opts = opts || {};
    const n = ctx.findNote(noteId);
    if (!n || !noteWin(noteId)) return false;
    return perform('clean', async () => {
      const title = clip(S.noteTitle(n.text), 40) || 'không tên';
      const where = await approachNote(noteId, 'jump');        // tháo note thì không đứng trên nóc nó được
      A().fx('exclaim');
      await step(A().move(where === 'top' ? 'stomp' : 'tap', 2));
      wiggle(noteId, 4, 4);
      if (!opts.noAsk) {
        const ans = await ask(pick(LINES.cleanAsk).replace('%s', title).replace('%r', REASON[reason] || 'xong'),
          [{ id: 'antics:clean', label: 'Dọn đi', primary: true }, { id: 'antics:keep', label: 'Giữ lại' }], 15000, 'antics:clean');
        guard();
        if (ans === 'antics:keep') {
          box.kept[noteId] = true; save();
          say(pick(LINES.kept), { ttlMs: 3000 });
          await step(A().move('nod'));
          await finishApproach(where);
          return;
        }
        A().hush();
      }
      // tháo note: cửa sổ note trượt về tay bé rồi mờ đi, bé cầm tờ note
      const w = noteWin(noteId); if (!w) throw new Abort();
      const orig = w.getBounds();
      if (where === 'top') await step(A().move('bow'));
      else if (where === 'below') await step(A().move('hop', 1));
      else await step(A().move('wiggle', 1));
      A().sound('whoosh');
      await pullDown(w, noteId);
      // bỏ vào thùng thật ngay (xoá mềm), giữ vị trí cũ để khi nhặt lại note về đúng chỗ
      if (!ctx.notes.trash(noteId)) {
        if (ctx.alive(w)) { try { w.setBounds(orig); w.setOpacity(1); } catch (_) { /* bỏ qua */ } }
        throw new Abort();
      }
      bin.fixBounds(noteId, orig);
      A().holdNote(sheetOf(n, 'Hết hạn'));
      await step(A().play('hold_note', { loop: true }));
      await wait(500);
      // vo tròn
      A().sound('crumple');
      await step(A().move('wiggle', 2));
      await step(A().crumple(n.color));
      A().play('idle', { loop: true });
      await finishApproach(where);
      await throwToBin(n.color, !!opts.inRound);
      A().fx('sparkle');
      A().play('happy');
      if (!opts.inRound) say(pick(LINES.cleanDone), { ttlMs: 4500 });
      await wait(opts.inRound ? 500 : 1200);
    }, { wake: !!opts.wake });
  }
  /** Cửa sổ note trượt về phía tay bé, thu nhỏ, mờ dần. */
  async function pullDown(w, noteId) {
    if (!ctx.alive(w)) return;
    const b = w.getBounds(), p = B().pos(), h = B().handOffset();
    const tx = p.x + h.x, ty = p.y + h.y;
    const W = 120, H = 110, steps = 14;
    for (let i = 1; i <= steps; i++) {
      if (!ctx.alive(w)) return;
      const t = i / steps, e = t * t * (3 - 2 * t);
      const cw = b.width + (W - b.width) * e, ch = b.height + (H - b.height) * e;
      const cx = b.x + b.width / 2 + (tx - (b.x + b.width / 2)) * e, cy = b.y + b.height / 2 + (ty - H / 2 - (b.y + b.height / 2)) * e;
      try {
        w.setBounds({ x: Math.round(cx - cw / 2), y: Math.round(cy - ch / 2), width: Math.round(cw), height: Math.round(ch) });
        w.setOpacity(Math.max(0, 1 - Math.max(0, t - 0.45) / 0.55));
      } catch (_) { return; }
      await sleep(28);
    }
    void noteId;
  }
  /** Gọi thùng rác ra ngay khi nhận lệnh dọn (người dùng thấy bé bắt tay vào việc liền), đặt phía rộng của màn hình. */
  function callBinNow() {
    if (bin.isOut() || !ready()) return;
    try {
      const p0 = B().pos(), wa = displayWA(p0.x, p0.y - 2);
      const side = p0.x - wa.x < wa.x + wa.width - p0.x ? 1 : -1;
      say(pick(LINES.binCall), { ttlMs: 1800 });
      bin.summon(p0.x + side * 180, p0.y);
      A().sound('boing');
    } catch (_) { /* bỏ qua */ }
  }
  /** Mang bóng giấy tới thùng rác desktop rồi ném vào. */
  async function throwToBin(color, inRound) {
    if (!onScreenFloor()) await step(B().hopDown());
    const p0 = B().pos();
    if (!bin.isOut()) {
      // gọi thùng trồi lên phía rộng hơn của màn hình, cách bé một quãng
      const wa = displayWA(p0.x, p0.y - 2);
      const side = p0.x - wa.x < wa.x + wa.width - p0.x ? 1 : -1;
      faceTo(p0.x + side * 100);
      A().fx('exclaim');
      say(pick(LINES.binCall), { ttlMs: 1800 });
      bin.summon(p0.x + side * 180, p0.y);
      A().sound('boing');
      await wait(700);
    } else bin.summon(p0.x, p0.y);
    const mouth = bin.mouth();
    if (!mouth) return;
    const sz = B().size();
    const p = B().pos();
    const side = p.x >= mouth.x ? 1 : -1;
    const standX = mouth.x + side * (sz.w * 0.48 + 6);
    await goFloorX(standX, 2.4);
    faceTo(mouth.x);
    bin.open(true);
    await step(A().move('throw'));
    A().sound('whoosh');
    // điểm rơi tính theo toạ độ cửa sổ bé
    const pw = ctx.windows.pet && ctx.alive(ctx.windows.pet) ? ctx.windows.pet.getBounds() : null;
    const lx = pw ? mouth.x - pw.x : null, ly = pw ? mouth.y - pw.y : null;
    const inside = pw && lx > 8 && lx < pw.width - 8 && ly > 8 && ly < pw.height - 8;
    if (inside) await step(A().toss(lx, ly, 620));
    else { const t = A().toss(undefined, undefined, 380); bin.catchBall(color, side > 0 ? 'right' : 'left', 480); await step(t); await sleep(300); }
    bin.open(false);
    A().sound('thunk');
    bin.landed();
    bin.dismiss(inRound ? 6000 : 2200);
  }

  // ------------------------------------------------------------------ 1b) dọn định kì note đã xong
  let nextRound = Date.now() + 8 * MIN, rounding = false;
  const isDaily = id => !!(ctx.extras && ctx.extras.isDaily && ctx.extras.isDaily(id));     // checklist hằng ngày: không dọn
  const quiet = () => !!(ctx.extras && ctx.extras.quiet && ctx.extras.quiet());               // đang Mochi Focus: không quậy
  function doneCandidates(fresh) {                 // fresh: người dùng ra lệnh -> không chờ 10 phút sau lần sửa cuối
    let list = [];
    try { list = ctx.notes.expiredCandidates(Date.now(), fresh ? { fresh: true } : null) || []; } catch (_) { /* bỏ qua */ }
    return list.filter(c => (c.reason === 'done' || c.reason === 'checklist') && !box.kept[c.noteId] && !isDaily(c.noteId) && noteWin(c.noteId));
  }
  async function cleanRound(opts) {
    opts = opts || {};
    if (rounding) return false;
    const list = opts.list || doneCandidates();
    if (!list.length) { if (opts.wake && ready()) say(opts.emptyMsg || 'Chưa có note nào xong để dọn cả~', { ttlMs: 3000 }); return false; }
    let ans = opts.noAsk ? 'antics:roundYes' : null;
    const asked = opts.noAsk ? true : await perform('round', async () => {
      A().fx('exclaim');
      await step(A().move('look'));
      ans = await ask(pick(LINES.roundAsk).replace('%n', list.length),
        [{ id: 'antics:roundYes', label: 'Dọn hết', primary: true }, { id: 'antics:roundNo', label: 'Để sau' }], 15000, 'antics:roundYes');
      guard();
      if (ans === 'antics:roundNo') { say(pick(LINES.roundLater), { ttlMs: 2500 }); await step(A().move('nod')); }
      else A().hush();
    }, { wake: !!opts.wake });
    if (!asked || ans !== 'antics:roundYes') return false;
    if (opts.binFirst) callBinNow();
    rounding = true;
    let n = 0;
    try {
      for (const c of list) {
        if (!noteWin(c.noteId) || !ctx.findNote(c.noteId)) continue;
        if (await cleanNote(c.noteId, c.reason, { noAsk: true, inRound: true, wake: true })) n++;
        else break;                                  // bị ngắt (nhấc bé lên, sân khấu nhắc lịch...)
        await sleep(400);
      }
    } finally { rounding = false; bin.dismiss(1800); }
    if (n && ready()) {
      perform('roundDone', async () => {
        A().fx('confetti'); A().sound('tada');
        say(pick(LINES.roundDone).replace('%n', n), { ttlMs: 4000 });
        await step(A().move('dance', 3)); A().play('happy'); await wait(800);
      });
    }
    return true;
  }

  // ------------------------------------------------------------------ 2) gõ nhắc việc
  const tapSeen = new Map();          // noteId -> lần gõ gần nhất
  function urgentNotes(now) {
    const out = [];
    for (const n of ctx.store.data.notes) {
      const rs = Array.isArray(n.reminders) ? n.reminders : (n.reminder ? [n.reminder] : []);
      for (const r of rs) {
        if (!r || r.done || typeof r.due !== 'number') continue;
        const left = r.due - now;
        if (left <= 0 && r.fired) out.push({ n, r, over: -left, score: 1000 + Math.min(999, -left / MIN) });
        else if (left > 0 && left <= 10 * MIN) out.push({ n, r, over: -left, score: 500 - left / MIN });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  async function knock(target, opts) {
    opts = opts || {};
    const { n, r } = target;
    const title = clip(r.title || S.noteTitle(n.text), 40) || 'việc của cậu';
    const now = Date.now(), left = r.due - now;
    const msg = left <= 0
      ? pick(LINES.knockOver).replace('%s', title).replace('%d', dur(-left))
      : pick(LINES.knockSoon).replace('%s', title).replace('%d', dur(left));
    tapSeen.set(n.id, now);
    return perform('knock', async () => {
      let where = null;
      if (noteWin(n.id)) {
        where = await approachNote(n.id, Math.random() < 0.6 ? 'top' : 'below');
        A().sound('knock');
        wiggle(n.id, 8, 7);
        A().fx('bonk', where === 'top' ? { at: 'hand' } : {});
        await step(A().move(where === 'top' ? 'stomp' : where === 'jump' ? 'wiggle' : 'tap', where === 'top' ? 3 : 4));
        A().sound('knock');
        wiggle(n.id, 6, 5);
        if (where === 'jump') await finishApproach(where);
      } else {
        // note đang cất: bé ghé sát màn hình gõ "kính"
        const wa = displayWA(B().pos().x, B().pos().y - 2);
        if (!onScreenFloor()) await step(B().hopDown());
        await goFloorX(wa.x + wa.width * (0.35 + Math.random() * 0.3));
        A().sound('knock');
        A().fx('bonk');
        await step(A().move('glass'));
      }
      A().fx(left <= 0 ? 'anger' : 'exclaim');
      const ans = await ask(noteWin(n.id) ? msg : pick(LINES.knockHidden).replace('%s', title),
        [{ id: 'antics:done', label: 'Xong rồi', primary: true }, { id: 'antics:snooze', label: 'Hoãn 10 phút' }, { id: 'antics:open', label: 'Xem note' }], 14000, null);
      if (ans === 'antics:done') {
        try { ctx.notes.completeNote(n.id, r.id); } catch (e) { console.error('[antics] done', e); }
        await step(A().move('hop', 2));
      } else if (ans === 'antics:snooze') {
        try { ctx.notes.snoozeNote(n.id, 10, r.id); } catch (e) { console.error('[antics] snooze', e); }
        say(pick(LINES.snooze), { ttlMs: 3000 });
        await step(A().move('nod'));
      } else if (ans === 'antics:open') {
        try { ctx.notes.showNote(n.id); } catch (_) { /* bỏ qua */ }
      } else { A().hush(); }
      await wait(600);
      if (where === 'top') { await wait(1500 + Math.random() * 2500); await finishApproach(where); }   // ngồi chơi trên nóc chút rồi nhảy xuống
    }, { wake: !!opts.wake });
  }

  // ------------------------------------------------------------------ 3) trò lúc rảnh
  const visibleNotes = () => ctx.store.data.notes.filter(n => noteWin(n.id));
  const TRICKS = {
    async dance() { say(pick(LINES.dance), { ttlMs: 3000 }); A().fx('notes'); await step(A().move('dance', 6)); A().fx('notes'); await step(A().move('spin')); A().play('happy'); await wait(900); },
    async stretch() { say(pick(LINES.stretch), { ttlMs: 2500 }); await step(A().move('stretch')); A().fx('sparkle'); await wait(500); },
    async spin() { say(pick(LINES.spin), { ttlMs: 2000 }); A().sound('boing'); await step(A().move('spin', 2)); A().fx('sparkle'); await wait(400); },
    async look() { A().fx('question'); await step(A().move('look')); await wait(300); },
    async hop() { A().sound('boing'); await step(A().move('hop', 3)); A().fx('hearts'); await wait(300); },
    sweep: withProps(async () => {
      const wa = displayWA(B().pos().x, B().pos().y - 2);
      if (!onScreenFloor()) await step(B().hopDown());
      say(pick(LINES.sweep), { ttlMs: 2500 });
      prop('broom');
      const xs = [wa.x + wa.width * (0.2 + Math.random() * 0.2), wa.x + wa.width * (0.6 + Math.random() * 0.2)];
      if (Math.random() < 0.5) xs.reverse();
      for (const x of xs) {
        const t = setInterval(() => { try { A().fx('dust', { at: 'hand' }); } catch (_) { /* bỏ qua */ } }, 700);
        try { await goFloorX(x, 1.6); } finally { clearInterval(t); }
        await step(A().move('sweep', 2));
      }
      A().fx('sparkle'); clearProps(); A().play('happy'); await wait(800);
    }),
    async visit() {
      const list = visibleNotes(); if (!list.length) return TRICKS.dance();
      const n = pick(list);
      const where = await approachNote(n.id, 'top');
      if (where === 'top') wiggle(n.id, 3, 3);
      A().fx('hearts');
      say(pick(LINES.read).replace('%s', clip(S.noteTitle(n.text), 46) || '…'), { ttlMs: 4500 });
      await step(A().move('nod', 2));
      await wait(3000 + Math.random() * 6000);
      if (Math.random() < 0.4) { A().fx('zzz'); await wait(2000); }
      await finishApproach(where);
    }
  };
  /** Làm tờ giấy trong note đung đưa quanh ghim (src/note/fasten.js). */
  function swingNote(id, power) {
    const w = noteWin(id); if (!w) return;
    w.webContents.executeJavaScript('window.MochiFasten && window.MochiFasten.wiggle(' + (power || 20) + ')', true).catch(() => {});
  }
  Object.assign(TRICKS, {
    async nap() {
      const list = visibleNotes(); if (!list.length) return TRICKS.stretch();
      const n = pick(list);
      const where = await approachNote(n.id, 'top');
      if (where !== 'top') { await finishApproach(where); return TRICKS.stretch(); }
      say(pick(LINES.nap), { ttlMs: 2500 });
      await step(A().move('stretch'));
      A().play('sleep', { loop: true });
      for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) { A().fx('zzz'); await wait(1800); }
      A().play('idle', { loop: true });
      A().fx('sparkle');
      await step(A().move('stretch'));
      await finishApproach(where);
    },
    async swing() {
      const list = visibleNotes(); if (!list.length) return TRICKS.hop();
      const n = pick(list);
      const where = await approachNote(n.id, 'jump');
      say(pick(LINES.swing), { ttlMs: 3000 });
      for (let i = 0; i < 4; i++) { swingNote(n.id, i % 2 ? -26 : 26); A().fx(i % 2 ? 'notes' : 'hearts'); await step(A().move('wiggle', 1)); }
      await finishApproach(where);
      A().sound('boing'); await step(A().move('hop', 1));
    },
    async pinfix() {
      const list = visibleNotes(); if (!list.length) return TRICKS.look();
      const n = pick(list);
      const where = await approachNote(n.id, 'top');
      A().fx('question');
      await step(A().move('look'));
      say(pick(LINES.pinfix), { ttlMs: 2800 });
      for (let i = 0; i < 3; i++) { A().sound('knock'); A().fx('bonk', { at: 'hand' }); swingNote(n.id, 14); await step(A().move(where === 'top' ? 'stomp' : 'tap', 1)); }
      A().fx('sparkle');
      await wait(700);
      await finishApproach(where);
    },
    async peek() {
      const list = visibleNotes(); if (!list.length) return TRICKS.look();
      const n = pick(list);
      const where = await approachNote(n.id, Math.random() < 0.5 ? 'below' : 'top');
      say(pick(LINES.peek), { ttlMs: 2200 });
      await step(A().move('look'));
      await wait(900);
      A().fx(Math.random() < 0.5 ? 'hearts' : 'exclaim');
      say(pick(LINES.read).replace('%s', clip(S.noteTitle(n.text), 46) || '…'), { ttlMs: 3500 });
      await step(A().move('nod', 2));
      await wait(1500);
      await finishApproach(where);
    },
    async wave() {
      const c = screen.getCursorScreenPoint();
      faceTo(c.x);
      say(pick(LINES.wave), { ttlMs: 2500 });
      A().fx('hearts');
      await step(A().move('hop', 2));
      await step(A().move('nod', 2));
      A().play('happy'); await wait(600);
    },
    async exercise() {
      if (!onScreenFloor()) await step(B().hopDown());
      say(pick(LINES.exercise), { ttlMs: 3000 });
      await step(A().move('stretch'));
      await step(A().move('squash'));
      A().sound('boing'); await step(A().move('hop', 3));
      await step(A().move('bow'));
      await step(A().move('spin'));
      A().fx('sparkle'); A().play('happy'); await wait(700);
    },
    async sing() {
      say(pick(LINES.sing), { ttlMs: 4000 });
      for (let i = 0; i < 4; i++) { A().fx('notes'); await step(A().move(i % 2 ? 'nod' : 'dance', 2)); }
      A().fx('hearts'); A().play('happy'); await wait(600);
    }
  });
  // hoạt động đời thường (có đạo cụ): mỗi trò 5-15s, luôn dọn đạo cụ kể cả khi bị ngắt
  const midFx = () => { try { A().fx(Math.random() < 0.5 ? 'hearts' : 'sparkle'); } catch (_) { /* bỏ qua */ } };
  Object.assign(TRICKS, {
    read: withProps(async () => {
      say(pick(LINES.readBook), { ttlMs: 3000 });
      prop('book');
      for (let i = 0; i < 3; i++) {
        await step(A().move('read'));
        prop('book', { flip: true });
        await wait(500 + Math.random() * 500);
      }
      if (Math.random() < 0.5) { A().fx('hearts'); say(pick(LINES.readNice), { ttlMs: 3000 }); await wait(1500); }
      prop('book', { flip: true }); await wait(800);
    }),
    eat: withProps(async () => {
      say(pick(LINES.eat), { ttlMs: 3000 });
      prop('onigiri', { bite: 0 });
      await wait(700);
      for (let i = 1; i <= 3; i++) {
        await step(A().move('munch'));
        prop('onigiri', { bite: i });
        A().fx('crumbs');
        await wait(300);
      }
      clearProps();
      say(pick(LINES.eatDone), { ttlMs: 3000 });
      A().fx('hearts'); A().play('happy'); await wait(1000);
    }),
    tea: withProps(async () => {
      say(pick(LINES.tea), { ttlMs: 3000 });
      prop('tea');
      A().fx('steam');
      await wait(800);
      for (let i = 0; i < 2; i++) { await step(A().move('sip')); A().fx('steam'); await wait(400); }
      say(pick(LINES.teaDone), { ttlMs: 3000 });
      A().fx('hearts'); await wait(1200);
    }),
    water: withProps(async () => {
      say(pick(LINES.waterPlant), { ttlMs: 3000 });
      prop('plant', { grow: true });
      await wait(1500);
      prop('watering_can', { pour: true });
      for (let i = 0; i < 3; i++) { A().fx('water', { at: 'hand' }); await wait(800); }
      prop('watering_can', { on: false });
      prop('plant', { bloom: true });
      await wait(900);
      A().fx('sparkle'); say(pick(LINES.waterDone), { ttlMs: 3000 });
      await step(A().move('hop', 1));
      await wait(1500);
    }),
    bubbles: withProps(async () => {
      say(pick(LINES.bubbles), { ttlMs: 3000 });
      prop('bubble_wand');
      for (let i = 0; i < 3; i++) { A().fx('bubbles', { at: 'hand' }); await step(A().move('tiptoe')); await wait(400); }
      A().fx('sparkle'); await wait(800);
    }),
    music: withProps(async () => {
      say(pick(LINES.music), { ttlMs: 3000 });
      prop('headphones');
      await wait(500);
      for (let i = 0; i < 5; i++) { A().fx('notes'); await step(A().move(i === 2 ? 'dance' : 'bob', i === 2 ? 2 : 4)); }
      A().fx('hearts'); await wait(900);
    }),
    butterfly: withProps(async () => {
      say(pick(LINES.butterfly), { ttlMs: 3000 });
      A().fx('butterfly');
      const p = B().pos();
      let dir = Math.random() < 0.5 ? -1 : 1;
      faceTo(p.x + dir * 100);
      await wait(900);
      for (let i = 0; i < 2; i++) {
        await step(A().move(i ? 'hop' : 'tiptoe', 2));
        if (onScreenFloor()) {
          const wa = displayWA(B().pos().x, B().pos().y - 2), x = B().pos().x + dir * 110;
          if (x > wa.x + 60 && x < wa.x + wa.width - 60) await goFloorX(x, 1.3);
        }
        dir = -dir; faceTo(B().pos().x + dir * 100);
        await wait(500);
      }
      A().fx('sparkle'); await wait(600);
    }),
    draw: withProps(async () => {
      say(pick(LINES.draw), { ttlMs: 3000 });
      prop('pencil');
      await step(A().move('read'));
      await step(A().move('wiggle', 2));
      midFx();
      await step(A().move('read'));
      A().fx('sparkle'); await wait(1200);
    }),
    async yawn() {
      say(pick(LINES.yawn), { ttlMs: 3000 });
      await step(A().move('yawn'));
      A().fx('zzz'); await wait(1200);
    },
    // ban đêm: xuống sàn, chúc ngủ ngon rồi lên giường (brain.sleep lo phần giường)
    async bedtime() {
      if (!onScreenFloor()) await step(B().hopDown());
      say(LINES.bedtime, { ttlMs: 5500 });
      A().fx('stars');
      await wait(3500);
      C().brain.sleep();
    }
  });
  async function trick(name, opts) {
    const fn = TRICKS[name] || TRICKS.dance;
    return perform('trick:' + name, fn, opts);
  }

  // ------------------------------------------------------------------ 4) ăn mừng / thưởng
  let lastCoinFx = 0;
  bus.on('game:reward', p => {
    if (!ready() || !C().shown() || !p || !(p.candy > 0)) return;
    const now = Date.now();
    if (now - lastCoinFx < 800) return;
    lastCoinFx = now;
    A().fx('coin', { n: p.candy });
    A().sound('coin');
    if (p.levelUp) { A().fx('confetti'); A().sound('tada'); }
  });
  bus.on('reminder:done', () => {
    if (!ready() || !C().shown() || C().stage()) return;
    A().fx('confetti');
    if (!running && !B().busy()) {
      perform('cheer', async () => { A().sound('tada'); await step(A().move('hop', 2)); say(pick(LINES.done), { ttlMs: 3000 }); A().play('happy'); await wait(1000); });
    }
  });
  bus.on('note:updated', d => { const id = d && d.note && d.note.id; if (id && box.kept[id]) { delete box.kept[id]; save(); } });
  bus.on('note:expired', d => {
    if (!d || !d.noteId) return;
    if (box.cleanEvery && (d.reason === 'done' || d.reason === 'checklist')) return;   // để lượt dọn định kì gom lại
    queueClean(d.noteId, d.reason);
  });

  // ------------------------------------------------------------------ 5) phản ứng theo việc cậu làm
  /** Việc do cậu gây ra: cắt ngang lúc bé đi dạo/ngó mép, hoặc chờ bé rảnh (tối đa ~8 giây) rồi diễn. */
  function soon(name, fn, tries) {
    tries = tries == null ? 8 : tries;
    if (!ready() || running || C().stage()) { if (tries > 0 && !C().stage()) setTimeout(() => soon(name, fn, tries - 1), 1000); return; }
    if (B().busy() && ['walk', 'peek'].includes(B().mode())) B().cancel();
    if (B().busy()) { if (tries > 0) setTimeout(() => soon(name, fn, tries - 1), 1000); return; }
    perform(name, fn, { wake: true });
  }
  let lastNewNote = 0, lastTyping = 0;
  const typing = new Map();                     // noteId -> [thời điểm sửa gần đây]
  bus.on('note:created', d => {
    const id = d && d.note && d.note.id, now = Date.now();
    if (!id || !box.playful || now - lastNewNote < 3 * MIN || rounding || quiet()) return;
    lastNewNote = now;
    setTimeout(() => {
      if (!noteWin(id)) return;
      soon('newNote', async () => {
        if (!noteWin(id)) return;
        const where = await approachNote(id, 'top');
        A().fx('exclaim'); A().sound('boing');
        await step(A().move('hop', 2));
        say(pick(LINES.newNote), { ttlMs: 3500 });
        A().fx('hearts');
        await wait(2500);
        await finishApproach(where);
      });
    }, 1200);
  });
  bus.on('note:updated', d => {
    const id = d && d.note && d.note.id, now = Date.now();
    if (!id || !box.playful || quiet()) return;
    const arr = (typing.get(id) || []).filter(t => now - t < 60000); arr.push(now); typing.set(id, arr);
    if (arr.length < 6 || now - lastTyping < 15 * MIN || running || !noteWin(id)) return;
    lastTyping = now;
    soon('typing', async () => {
      if (!noteWin(id)) return;
      const where = await approachNote(id, 'top');
      say(pick(LINES.typing), { ttlMs: 3500 });
      A().fx('hearts');
      await step(A().move('nod', 2));
      await wait(5000 + Math.random() * 4000);
      await finishApproach(where);
    });
  });
  let lastWelcome = 0;
  bus.on('app:resume', () => {
    const now = Date.now();
    if (!box.playful || now - lastWelcome < 20 * MIN) return;
    lastWelcome = now;
    setTimeout(() => soon('welcome', async () => { say(pick(LINES.welcome), { ttlMs: 3500 }); A().fx('hearts'); await step(A().move('hop', 2)); A().play('happy'); await wait(800); }), 1500);
  });
  // nhắc nhỏ theo giờ: trưa, khuya, uống nước (mỗi loại tối đa một lần / khung giờ)
  const talked = {};
  let nextWater = Date.now() + 50 * MIN;
  function maybeTimeTalk(now) {
    const d = new Date(now), hm = d.getHours() * 60 + d.getMinutes(), day = d.toDateString();
    let text = null, mv = 'nod', fx = 'exclaim';
    if (hm >= 11 * 60 + 30 && hm < 12 * 60 + 30 && talked.lunch !== day) { talked.lunch = day; text = LINES.lunch; mv = 'hop'; fx = 'hearts'; }
    else if ((hm >= 22 * 60 + 30 || hm < 3 * 60) && talked.late !== day) { talked.late = day; text = LINES.late; mv = 'stretch'; fx = 'zzz'; }
    else if (now >= nextWater) { nextWater = now + (50 + Math.random() * 30) * MIN; text = pick(LINES.water); fx = 'sparkle'; }
    if (!text) return false;
    perform('talk', async () => { A().fx(fx); say(text, { ttlMs: 4500 }); await step(A().move(mv, mv === 'hop' ? 2 : 1)); await wait(1200); });
    return true;
  }

  /** Hoạt động hợp giờ: sáng trà/tưới cây, trưa ăn, chiều đọc/vẽ/nhạc, tối ngáp. */
  function hourPool(h) {
    if (h >= 6 && h < 11) return ['tea', 'tea', 'water', 'water', 'bubbles', 'butterfly'];
    if (h >= 11 && h < 14) return ['eat', 'eat', 'tea', 'bubbles'];
    if (h >= 14 && h < 18) return ['read', 'read', 'draw', 'draw', 'music', 'butterfly'];
    if (h >= 18 && h < 22) return ['yawn', 'read', 'music', 'tea'];
    return ['yawn', 'yawn', 'read'];
  }
  // ban đêm (22h-6h) khi rảnh: tự đi ngủ có giường, chừng 1 lần / 90 phút
  let nextBed = Date.now() + 5 * MIN;
  function maybeBedtime(now) {
    const h = new Date(now).getHours();
    if ((h < 22 && h >= 6) || now < nextBed || Math.random() > 0.06) return false;
    nextBed = now + 90 * MIN;
    trick('bedtime');
    return true;
  }

  // ------------------------------------------------------------------ vòng hẹn giờ
  let nextPlay = Date.now() + 3 * MIN, nextKnock = Date.now() + 2 * MIN;
  function tick() {
    try {
      if (!ready() || !canAct() || C().brain.isSleeping()) return;
      const now = Date.now();
      if (now - lastAct < 20000 || rounding || quiet()) return;
      if (box.cleanEvery && now >= nextRound) {
        nextRound = now + box.cleanEvery * MIN;
        if (doneCandidates().length) { cleanRound(); return; }
      }
      if (box.playful && maybeTimeTalk(now)) return;
      if (box.playful && maybeBedtime(now)) return;
      // dọn note hết hạn trước
      while (cleanQueue.length) {
        const q = cleanQueue.shift();
        if (box.kept[q.noteId] || !ctx.findNote(q.noteId) || !noteWin(q.noteId)) continue;
        cleanNote(q.noteId, q.reason);
        return;
      }
      if (box.nagTap && now >= nextKnock) {
        const t = urgentNotes(now).find(x => now - (tapSeen.get(x.n.id) || 0) > 12 * MIN);
        nextKnock = now + (8 + Math.random() * 7) * MIN;
        if (t) { knock(t); return; }
      }
      if (box.playful && now >= nextPlay) {
        nextPlay = now + (1.5 + Math.random() * 3.5) * MIN;
        const pool = ['visit', 'visit', 'nap', 'swing', 'pinfix', 'peek', 'peek', 'wave', 'exercise', 'sing', 'dance', 'stretch', 'spin', 'look', 'hop', 'sweep'];
        trick(pick(Math.random() < 0.4 ? hourPool(new Date().getHours()) : pool));   // ~40% là hoạt động theo giờ, tổng tần suất giữ nguyên
      }
    } catch (e) { console.error('[antics] tick', e); }
  }
  bus.once('app:startup', () => {
    const t = setInterval(tick, 5000); if (t.unref) t.unref();
    bin.apply();
  });

  // ------------------------------------------------------------------ menu chuột phải trên bé, bấm đúp
  function gameView() { try { return ctx.game && ctx.game.view ? ctx.game.view() : null; } catch (_) { return null; } }
  function openRoom(tab) { if (ctx.game && typeof ctx.game.open === 'function') ctx.game.open(tab || undefined); }
  function newNoteWithPaper() {
    const n = ctx.notes.createNote({});
    const w = n && ctx.windows.notes.get(n.id);
    if (!ctx.alive(w)) return;
    const go = () => setTimeout(() => {
      if (ctx.alive(w)) w.webContents.executeJavaScript('window.MochiPicker && window.MochiPicker.open()', true).catch(() => {});
    }, 350);
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', go); else go();
  }
  async function cleanNow() {
    let list = [];
    try { list = ctx.notes.expiredCandidates() || []; } catch (_) { /* bỏ qua */ }
    list = list.filter(c => noteWin(c.noteId));
    if (!list.length) { say('Không có note nào hết hạn cả, gọn gàng lắm rồi!', { ttlMs: 3500 }); A().fx('sparkle'); return; }
    for (const c of list) { delete box.kept[c.noteId]; }
    const first = list.shift();
    for (const c of list) queueClean(c.noteId, c.reason);
    await cleanNote(first.noteId, first.reason, { noAsk: true, wake: true });
  }
  function knockNow() {
    const t = urgentNotes(Date.now())[0];
    if (t) return knock(t, { wake: true });
    const vis = visibleNotes();
    if (!vis.length) { say('Hôm nay chưa có việc nào cần nhắc nè.', { ttlMs: 3000 }); return; }
    return perform('knock-demo', async () => {
      const n = pick(vis);
      const where = await approachNote(n.id, 'top');
      A().sound('knock'); wiggle(n.id, 8, 7); A().fx('bonk', where === 'top' ? { at: 'hand' } : {});
      await step(A().move(where === 'top' ? 'stomp' : 'tap', 3));
      say('Cộc cộc! Chưa có việc gấp, tớ gõ thử thôi hihi.', { ttlMs: 3500 });
      await wait(2500);
      await finishApproach(where);
    }, { wake: true });
  }
  function showMenu() {
    if (!ready()) return;
    const v = gameView();
    const head = v && v.stats ? '🪙 ' + (v.stats.candy || 0) + ' xu · Cấp ' + (v.stats.level || v.level || 1) : 'Bé Mochi';
    const chk = (label, key, after, k) => ({ key: k, label, type: 'checkbox', checked: !!box[key], click: i => { box[key] = i.checked; save(); if (after) after(); } });
    const tpl = [
      { key: 'head', label: head, enabled: false },
      { type: 'separator' },
      { key: 'note.new', label: 'Note mới', click: () => ctx.notes.createNote({}) },
      { key: 'note.paper', label: 'Note mới + chọn mẫu giấy…', click: newNoteWithPaper },
      { key: 'note.list', label: 'Danh sách note', click: () => ctx.list.open() },
      { type: 'separator' },
      { key: 'room.wardrobe', label: 'Tủ đồ — mặc đồ cho bé…', click: () => openRoom('wardrobe') },
      { key: 'room.gacha', label: 'Máy gacha — quay đồ…', click: () => openRoom('gacha') },
      { key: 'room.shop', label: 'Cửa hàng — cho bé ăn…', click: () => openRoom('shop') },
      { key: 'room.quests', label: 'Nhiệm vụ nhận xu…', click: () => openRoom('quests') },
      { key: 'room.stats', label: 'Thống kê', click: () => openRoom('stats') },
      { type: 'separator' },
      { key: 'tricks', label: 'Bé làm trò', submenu: [
        { key: 'trick.dance', label: 'Nhảy múa', click: () => trick('dance', { wake: true }) },
        { key: 'trick.visit', label: 'Nhảy lên note đọc', click: () => trick('visit', { wake: true }) },
        { key: 'trick.knock', label: 'Đi gõ nhắc việc', click: () => knockNow() },
        { key: 'trick.cleanNow', label: 'Dọn note hết hạn ngay', click: () => cleanNow() },
        { key: 'trick.cleanAll', label: 'Dọn hết note đã xong', click: () => cleanRound({ wake: true }) },
        { key: 'trick.nap', label: 'Ngủ trưa trên note', click: () => trick('nap', { wake: true }) },
        { key: 'trick.swing', label: 'Đánh đu dưới note', click: () => trick('swing', { wake: true }) },
        { key: 'trick.pinfix', label: 'Ghim lại note', click: () => trick('pinfix', { wake: true }) },
        { key: 'trick.peek', label: 'Ngó note', click: () => trick('peek', { wake: true }) },
        { key: 'trick.exercise', label: 'Tập thể dục', click: () => trick('exercise', { wake: true }) },
        { key: 'trick.sing', label: 'Hát', click: () => trick('sing', { wake: true }) },
        { key: 'trick.wave', label: 'Vẫy chào', click: () => trick('wave', { wake: true }) },
        { key: 'trick.sweep', label: 'Quét bụi màn hình', click: () => trick('sweep', { wake: true }) },
        { key: 'trick.stretch', label: 'Vươn vai', click: () => trick('stretch', { wake: true }) },
        { key: 'trick.spin', label: 'Xoay vòng', click: () => trick('spin', { wake: true }) },
        { key: 'trick.hop', label: 'Nhảy tưng tưng', click: () => trick('hop', { wake: true }) },
        { key: 'trick.read', label: 'Đọc sách', click: () => trick('read', { wake: true }) },
        { key: 'trick.eat', label: 'Ăn cơm nắm', click: () => trick('eat', { wake: true }) },
        { key: 'trick.tea', label: 'Uống trà', click: () => trick('tea', { wake: true }) },
        { key: 'trick.water', label: 'Tưới cây', click: () => trick('water', { wake: true }) },
        { key: 'trick.bubbles', label: 'Thổi bong bóng', click: () => trick('bubbles', { wake: true }) },
        { key: 'trick.music', label: 'Nghe nhạc', click: () => trick('music', { wake: true }) },
        { key: 'trick.butterfly', label: 'Bắt bướm', click: () => trick('butterfly', { wake: true }) },
        { key: 'trick.draw', label: 'Vẽ tranh', click: () => trick('draw', { wake: true }) },
        { key: 'trick.yawn', label: 'Ngáp', click: () => trick('yawn', { wake: true }) },
        { key: 'trick.sleep', label: 'Đi ngủ', click: () => C().brain.sleep() }
      ] },
      { key: 'bin', label: 'Thùng rác…', click: () => ctx.list.open('trash') },
      ...(ctx.extras && ctx.extras.menu ? ctx.extras.menu() : []),
      { type: 'separator' },
      chk('Bé tự dọn note hết hạn', 'autoClean', null, 'set.autoClean'),
      chk('Bé gõ nhắc việc quá hạn', 'nagTap', null, 'set.nagTap'),
      chk('Bé tự chơi đùa lúc rảnh', 'playful', null, 'set.playful'),
      { key: 'set.bin', label: 'Luôn hiện thùng rác (tắt = chỉ hiện khi bé dọn)', type: 'checkbox', checked: !!box.bin.always, click: i => { box.bin.always = i.checked; save(); bin.apply(); } },
      { key: 'set.clean', label: 'Bé dọn định kì note đã xong', submenu: [[0, 'Tắt'], [20, 'Mỗi 20 phút'], [45, 'Mỗi 45 phút'], [90, 'Mỗi 1 tiếng rưỡi'], [180, 'Mỗi 3 tiếng']].map(([v, l]) => (
        { label: l, type: 'radio', checked: box.cleanEvery === v, click: () => { box.cleanEvery = v; save(); nextRound = Date.now() + (v || 9999) * MIN; } })) },
      { key: 'hide', label: 'Ẩn bé', click: () => { try { ctx.pet.setSettings({ alwaysVisible: false }); ctx.tray.rebuild(); } catch (_) { /* bỏ qua */ } } }
    ];
    const native = () => { const w = ctx.windows.pet; Menu.buildFromTemplate(tpl).popup(ctx.alive(w) ? { window: w } : {}); };
    let shown = false;
    toolbarNative = native;
    try { if (!toolbar) toolbar = createToolbar(ctx, { body: () => B(), fallback: () => toolbarNative() }); shown = toolbar.open(tpl, head); } catch (e) { console.error('[antics] thanh công cụ lỗi', e && e.message); }
    if (!shown) native();
  }
  let toolbar = null, toolbarNative = () => {};
  // ------------------------------------------------------------------ tương tác chuột
  const LINES2 = {
    poke: ['Ơ, đừng chọc tớ hoài mà!', 'Hứ! Nhột đó nha.', 'Cậu chọc tớ làm gì vậy?'],
    angry: ['Giận rồi đó! Hứ!', 'Không chơi với cậu nữa đâu…', 'Tớ dỗi rồi nhé!'],
    dizzy: ['Chóng mặt quá… 🌀', 'Ui, trời đất quay cuồng…', 'Đừng lắc tớ nữa mà~'],
    thrown: ['Áaaa~!', 'Úi da!', 'Wheee~!'],
    hover: ['Hửm? Cậu cần gì nè?', 'Tớ thấy cậu rồi nha~', 'Hi hi.'],
    chase: ['Bắt được con trỏ rồi!', 'Hehe, chạy đâu cho thoát!'],
    outfit: ['Bộ này thì sao?', 'Đổi đồ nè~', 'Xinh không?']
  };
  let pokeAt = 0, hoverAt = 0, wheelIdx = 0;
  function onPoke(n) {
    if (!ready() || C().stage()) return;
    if (Date.now() - pokeAt < 900) return;
    pokeAt = Date.now();
    const mad = n >= 6;
    if (running) { A().fx(mad ? 'anger' : 'pout'); return; }
    perform('poke', async () => {
      A().fx(mad ? 'anger' : 'pout');
      say(pick(mad ? LINES2.angry : LINES2.poke), { ttlMs: 2500 });
      await step(A().move(mad ? 'stomp' : 'wiggle', mad ? 3 : 2));
      if (mad && onScreenFloor()) {
        // dỗi: quay lưng bỏ đi một đoạn
        const p = B().pos(), wa = displayWA(p.x, p.y - 2);
        const away = p.x - wa.x > wa.x + wa.width - p.x ? -1 : 1;
        await goFloorX(p.x + away * 260, 1.3);
        A().fx('pout');
      }
    }, { wake: true });
  }
  function onWheel(dirn) {
    if (!ready() || running || C().stage()) return;
    const v = gameView();
    const outs = (v && v.outfits) || [];
    perform('wheel', async () => {
      A().sound('boing');
      if (outs.length && ctx.game.applyOutfit) {
        wheelIdx = (wheelIdx + (dirn > 0 ? 1 : outs.length - 1)) % outs.length;
        await step(A().move('spin'));
        try { ctx.game.applyOutfit(outs[wheelIdx].id); } catch (e) { console.error('[antics] outfit', e); }
        A().fx('sparkle');
        say(pick(LINES2.outfit) + ' (' + outs[wheelIdx].name + ')', { ttlMs: 2200 });
      } else {
        await step(A().move('spin'));
        A().fx('sparkle');
        say('Lưu vài bộ đồ trong tủ, rồi lăn chuột trên tớ để đổi nhanh nha!', { ttlMs: 3500 });
      }
      await wait(400);
    }, { wake: true });
  }
  function onHover(on) {
    if (!on || !ready() || running || C().stage() || B().busy()) return;
    const now = Date.now();
    if (now - hoverAt < 25000 || Math.random() > 0.35) return;
    hoverAt = now;
    const c = screen.getCursorScreenPoint();
    faceTo(c.x);
    A().fx(Math.random() < 0.5 ? 'blush' : 'question');
    A().move('look');
    if (Math.random() < 0.5) say(pick(LINES2.hover), { ttlMs: 2000 });
  }
  bus.on('pet:interact', d => {
    const k = d && d.kind;
    if (!ready()) return;
    if (k === 'thrown') A().say(pick(LINES2.thrown), { ttlMs: 1500 });
    else if (k === 'dizzy') {
      setTimeout(() => perform('dizzy', async () => {
        A().fx('dizzy');
        say(pick(LINES2.dizzy), { ttlMs: 3000 });
        await step(A().move('wiggle', 5));
        A().fx('dizzy');
        await step(A().move('shiver', 10));
      }, { wake: true }), 650);
    }
  });
  // đuổi con trỏ: chuột đứng yên gần sàn, gần bé -> bé chạy tới "vồ"
  let cursorStill = { x: -1, y: -1, since: 0 };
  function chaseTick() {
    if (!box.playful || quiet() || !ready() || !canAct() || C().brain.isSleeping() || !onScreenFloor()) return;
    const c = screen.getCursorScreenPoint(), p = B().pos();
    if (Math.abs(c.x - cursorStill.x) > 6 || Math.abs(c.y - cursorStill.y) > 6) { cursorStill = { x: c.x, y: c.y, since: Date.now() }; return; }
    const wa = displayWA(p.x, p.y - 2);
    const nearFloor = c.y > floorY(wa) - 140 && c.y <= floorY(wa) + 2 && c.x >= wa.x && c.x <= wa.x + wa.width;
    const dist = Math.abs(c.x - p.x);
    if (!nearFloor || dist < 60 || dist > 700 || Date.now() - cursorStill.since < 2500 || Math.random() > 0.25) return;
    cursorStill.since = Date.now() + 60000;            // một lần mỗi lần dừng chuột
    perform('chase', async () => {
      A().fx('exclaim');
      await goFloorX(c.x - Math.sign(c.x - p.x) * 30, 2.6);
      const c2 = screen.getCursorScreenPoint();
      if (Math.abs(c2.x - c.x) < 20 && Math.abs(c2.y - c.y) < 20) {
        faceTo(c2.x);
        A().sound('boing');
        await step(A().move('hop', 1));
        A().fx('sparkle');
        say(pick(LINES2.chase), { ttlMs: 2200 });
      } else { A().fx('question'); }
      await wait(500);
    });
  }
  const chaseT = setInterval(chaseTick, 700); if (chaseT.unref) chaseT.unref();

  function hookPet() {
    if (!ready()) return false;
    A().on('menu', () => showMenu());
    A().on('interact', d => {
      if (!d) return;
      if (d.kind === 'dblclick') { openRoom('wardrobe'); A().fx('hearts'); }
      else if (d.kind === 'click' && d.n >= 3) onPoke(d.n);
      else if (d.kind === 'wheel') onWheel(d.dir);
    });
    A().on('hover', d => onHover(d && d.on));
    return true;
  }
  if (!hookPet()) bus.once('app:startup', hookPet);

  // ------------------------------------------------------------------ 6) ra lệnh bằng note ("bé ơi, …")
  /** Chờ bé rảnh (cắt ngang lúc đi dạo) rồi chạy start(); start tự gọi perform. */
  const SOFT = /^(trick:|newNote$|typing$|talk$|welcome$|chase$|poke$|wheel$|cheer$|roundDone$|dizzy$|knock-demo$)/;
  function whenFree(start, tries, stageLeft) {
    tries = tries == null ? 50 : tries;               // chờ tối đa ~40 giây (vd đang dọn note)
    stageLeft = stageLeft == null ? 15 * 60000 : stageLeft;
    // đang cầm note nhắc việc: đợi người dùng bấm Xong/Hoãn (tối đa 15 phút, không tính vào lượt chờ) rồi làm tiếp
    if (ready() && C().stage()) {
      if (stageLeft > 0) setTimeout(() => whenFree(start, tries, stageLeft - 1000), 1000);
      return;
    }
    if (stageLeft < 15 * 60000 && !running && ready()) {
      const go = start; start = () => { say('Xong việc kia rồi, giờ tớ làm việc bạn dặn nè!', { ttlMs: 2200 }); setTimeout(go, 1200); };
      stageLeft = 15 * 60000;
    }
    const again = () => { if (tries > 0) setTimeout(() => whenFree(start, tries - 1, stageLeft), 800); };
    if (running && SOFT.test(running)) preempt = true;
    if (!ready() || running || C().stage() || rounding) return again();
    if (C().brain.isSleeping()) C().brain.wake();
    if (B().busy() && ['walk', 'peek'].includes(B().mode())) B().cancel();
    if (B().busy()) return again();
    start();
  }
  function arrangeNotes() {
    const vis = visibleNotes(); if (!vis.length) return Promise.resolve(0);
    const wa = screen.getPrimaryDisplay().workArea, gap = 14;
    let x = wa.x + wa.width - gap, y = wa.y + gap, colW = 0;
    const moves = [];
    for (const n of vis) {
      const w = noteWin(n.id); if (!w) continue;
      const b = w.getBounds();
      if (y + b.height > wa.y + wa.height - 200 && y > wa.y + gap) { x -= colW + gap; y = wa.y + gap; colW = 0; }
      moves.push({ w, from: b, to: { x: x - b.width, y } });
      y += b.height + gap; colW = Math.max(colW, b.width);
    }
    // trượt mượt tới chỗ mới
    return new Promise(res => {
      let i = 0;
      const t = setInterval(() => {
        i++;
        const k = i / 16, e = k * k * (3 - 2 * k);
        for (const m of moves) if (ctx.alive(m.w)) try { m.w.setPosition(Math.round(m.from.x + (m.to.x - m.from.x) * e), Math.round(m.from.y + (m.to.y - m.from.y) * e)); } catch (_) { /* bỏ qua */ }
        if (i >= 16) { clearInterval(t); res(moves.length); }
      }, 25);
    });
  }
  const ACK = ['Dạ!', 'Ok luôn!', 'Có tớ đây!', 'Để tớ!'];
  /** Chạy lần lượt nhiều lệnh (câu gộp "dọn dẹp rồi xếp note lại"): xong việc này mới sang việc sau. */
  function chainCommands(noteId, cmds, text) {
    let i = 0;
    const next = () => {
      if (i >= cmds.length) return;
      const cur = cmds[i++];
      try { execCmd(noteId, cur, text); } catch (err) { console.error('[antics] chain', err); }
      let waited = 0;
      const poll = () => {
        waited += 700;
        if (waited > 90000) return;
        if (running || rounding || (ready() && C().stage())) return setTimeout(poll, 700);
        next();
      };
      setTimeout(poll, 1200);
    };
    next();
  }
  /** Không chắc ý: bé hỏi lại bằng bong bóng có nút, bấm nút nào chạy lệnh đó. */
  async function askWhich(noteId, options, text) {
    if (!ready()) return;
    const opts = (options || []).slice(0, 3);
    if (!opts.length) return;
    const buttons = opts.map((o, k) => ({ id: 'antics:opt' + k, label: clip(o.label, 22), primary: k === 0 }));
    buttons.push({ id: 'antics:optNo', label: 'Thôi' });
    A().fx('question');
    const q = opts.length === 1 ? 'Ý cậu là “' + opts[0].label + '” phải không?' : 'Tớ chưa chắc ý cậu là gì, chọn giúp tớ nha:';
    const ans = await ask(q, buttons, 15000, null);
    const k = ans ? buttons.findIndex(b => b.id === ans) : -1;
    if (k >= 0 && k < opts.length) execCmd(noteId, opts[k].cmd, text);
    else if (ans === 'antics:optNo' && ready()) say('Ok, tớ không làm nha!', { ttlMs: 2000 });
  }
  function runCommand(noteId, text) { return execCmd(noteId, CMD.parse(text), text); }
  function execCmd(noteId, c, text) {
    // bé đang cầm note nhắc việc: không chen lời (mất nút), mà nhờ sân khấu giơ lại nút để người dùng bấm cho xong
    const onStage = () => ready() && C().stage();
    if (onStage() && ['unknown', 'negated'].indexOf(c.kind) < 0) {
      try { ctx.pet.stage.nudge('Đợi tớ chút nha! Việc này xong chưa? Bấm “Xong rồi” hoặc “Hoãn” là tớ đi làm liền~'); } catch (_) { /* bỏ qua */ }
    }
    const ack = msg => { if (ready() && !onStage()) { A().fx('exclaim'); say(msg || pick(ACK), { ttlMs: 2200 }); } };
    switch (c.kind) {
      case 'help':
        return whenFree(() => perform('help', async () => {
          A().fx('question');
          await ask(CMD.HELP, [{ id: 'antics:helpOk', label: 'Hiểu rồi', primary: true }], 25000, null);
          A().hush();
        }, { wake: true }));
      case 'trashThis':
        if (!noteId) { if (ready()) say('Lệnh này gõ ngay trong note cần vứt nha (“bé ơi, xoá note này”).', { ttlMs: 4000 }); return; }
        ack('Dạ, tớ tháo note này vứt đi nha!');
        return whenFree(() => { callBinNow(); return cleanNote(noteId, 'cmd', { noAsk: true, wake: true }).then(ok => { if (!ok) bin.dismiss(1800); }); });
      case 'cleanEmpty': {
        const list = ctx.store.data.notes.filter(n => n.id !== noteId && noteWin(n.id) && !/\S/.test(n.text || '')).map(n => ({ noteId: n.id, reason: 'empty' }));
        ack();
        return whenFree(() => cleanRound({ list, noAsk: true, wake: true, binFirst: true, emptyMsg: 'Không có note trống nào cả, gọn lắm rồi!' }));
      }
      case 'cleanDone': {
        // "dọn dẹp" chung: note đã xong + note trống đang mở (trừ note đang gõ lệnh)
        ack();
        return whenFree(() => {
          const list = doneCandidates(true).filter(c => c.noteId !== noteId);
          for (const n of ctx.store.data.notes) {
            if (n.id !== noteId && noteWin(n.id) && !/\S/.test(n.text || '') && !isDaily(n.id) && !list.some(c => c.noteId === n.id)) list.push({ noteId: n.id, reason: 'empty' });
          }
          return cleanRound({ list, noAsk: true, wake: true, binFirst: true, emptyMsg: 'Không có note nào xong hay trống để dọn cả, gọn lắm rồi!' });
        });
      }
      case 'cleanExpired': ack(); return whenFree(() => cleanNow());
      case 'arrange':
        ack('Xếp note gọn gàng nè!');
        return whenFree(() => perform('arrange', async () => {
          A().fx('sparkle'); await step(A().move('spin'));
          const n = await arrangeNotes();
          A().sound('tada'); say(n ? 'Xong! ' + n + ' note xếp hàng ngay ngắn rồi.' : 'Chưa có note nào để xếp~', { ttlMs: 3000 });
          await step(A().move('hop', 2));
        }, { wake: true }));
      case 'hideAll': ack('Cất hết note nha!'); try { ctx.notes.hideAll(); } catch (_) { /* bỏ qua */ } return;
      case 'showAll': ack('Note ra hết nè!'); try { ctx.notes.showAll(); } catch (_) { /* bỏ qua */ } return;
      case 'newNote': {
        ack('Note mới đây!');
        const n = ctx.notes.createNote({ html: c.text ? '<div>' + c.text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])) + '</div>' : '', nearId: noteId });
        return n;
      }
      case 'remind': {
        ack('Ghi nhớ rồi, tới giờ tớ nhắc!');
        // note mới chứa câu có giờ giấc: bộ hiểu nội dung tự lên lịch như note thường
        ctx.notes.createNote({ html: '<div>' + c.text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])) + '</div>', nearId: noteId });
        return;
      }
      case 'knock': return knockNow();
      case 'openTrash': ack(); ctx.list.open('trash'); return;
      case 'list': ack(); ctx.list.open(); return;
      case 'room': ack(); openRoom(c.tab); return;
      case 'sleep': ack('Chúc cậu làm việc vui, tớ ngủ xíu…'); setTimeout(() => { try { C().brain.sleep(); } catch (_) { /* bỏ qua */ } }, 1500); return;
      case 'wake': try { C().brain.wake(); } catch (_) { /* bỏ qua */ } return whenFree(() => trick('hop', { wake: true }));
      case 'trick': return whenFree(() => trick(c.name, { wake: true }));
      case 'focus': case 'focusStop': case 'daily': case 'dailyOff': case 'summary': case 'backup':
        if (ctx.extras && ctx.extras.command) return ctx.extras.command(c, noteId);
        return;
      case 'multi': return chainCommands(noteId, c.cmds, text);
      case 'unclear': return whenFree(() => askWhich(noteId, c.options, text));
      case 'cancelRemind': if (ready()) say('Muốn bỏ nhắc thì xoá phần giờ trong note đó (hoặc xoá cả note) là tớ thôi nhắc nha.', { ttlMs: 5000 }); return;
      case 'negated': if (ready()) say('Ok, tớ không làm đâu nha 😊', { ttlMs: 2500 }); return;
      default: {
        const hints = (c.hints && c.hints.length ? c.hints : ['dọn dẹp', 'xếp note lại']).slice(0, 3).map(h => '“' + h + '”').join(', ');
        if (ready()) { A().fx('question'); say('Tớ chưa hiểu “' + clip(text, 40) + '” 😅 Thử: ' + hints + '… Gõ “giúp” để xem hết nha.', { ttlMs: 6000 }); }
      }
    }
  }
  ipcMain.on('antics:command', (e, noteId, text) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w || ctx.windows.notes.get(noteId) !== w || typeof text !== 'string' || !text.trim()) return;   // chỉ nhận từ đúng cửa sổ note đó
    try { runCommand(noteId, text.trim()); } catch (err) { console.error('[antics] command', err); }
  });

  // ------------------------------------------------------------------ IPC từ note/thùng
  ipcMain.on('antics:openRoom', (_e, tab) => openRoom(typeof tab === 'string' ? tab : ''));
  ipcMain.on('antics:openPicker', e => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (ctx.alive(w)) w.webContents.executeJavaScript('window.MochiPicker && window.MochiPicker.open()', true).catch(() => {});
  });
  bin.onClick(() => {
    ctx.list.open('trash');
    if (ready() && C().shown() && !running && !C().stage()) {
      const n = bin.count();
      say(n ? LINES.binHas.replace('%n', n) : LINES.binEmpty, { ttlMs: 3500 });
    }
  });

  ctx.antics = { api: { say, ask, whenFree, step, wait, ready, faceTo, onScreenFloor }, runCommand, arrangeNotes, cleanNote, cleanNow, cleanRound, knock, knockNow, trick, perform, showMenu, running: () => running, box, bin };
  void path;
}

module.exports = { init, defaults, normalize };
