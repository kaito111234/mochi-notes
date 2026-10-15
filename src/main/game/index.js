'use strict';
// Phòng game: gắn logic thuần (logic/*) vào bus, IPC 'game:*', bộ đếm phút và cửa sổ.
// createGame(ctx, opts) không cần electron (test chạy bằng node thường); init(ctx) mới nạp electron.
// Quy tắc sắt: KHÔNG BAO GIỜ ném lỗi ra bus, không chặn sự kiện, không gọi notes/alarms.

const box_ = require('./logic/box');
const economy = require('./logic/economy');
const stats = require('./logic/stats');
const gacha = require('./logic/gacha');
const quests = require('./logic/quests');
const checkin = require('./logic/checkin');
const { dayKey } = require('./logic/time');
const catalogLib = require('./catalog');

const ORDER = ['common', 'rare', 'epic', 'legend'];
const MAX_OUTFITS = 6;
const NAME_MAX = 24;
const LINE_MAX = 80;
const DEMO_COINS = 2000;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const MAX_FOOD = 99;
const CAPTURE_SOURCES = new Set(['pet', 'drop']);
const STARTER = ['clip_x', 'neck_tie_blue'];

function createGame(ctx, opts) {
  opts = opts || {};
  const now = opts.now || (() => Date.now());
  const rng = opts.rng || Math.random;
  const bus = ctx.bus;
  const catalog = opts.catalog || catalogLib.loadCatalog();
  const box = ctx.store.section('game', box_.defaults, box_.normalize);
  const slotIds = new Set(catalog.slots.map(s => s.id));
  // Quà chào mừng (một lần): kẹp tóc chữ X + cà vạt xanh — đúng bộ gốc của bé, để tủ đồ không trống.
  if (!box.firstUse.welcome) {
    box.firstUse.welcome = now();
    for (const id of STARTER) {
      if (catalog.items.some(i => i.id === id) && !box.inventory.items[id]) box.inventory.items[id] = { count: 1, firstAt: now() };
    }
  }

  let asleep = false;
  let lastModeKey = '';
  let lastLevel = economy.level(box.stats.exp);

  // ---- tiện ích an toàn ----
  const logErr = (where, e) => { try { console.error('[game] ' + where + ':', e && e.message ? e.message : e); } catch (_) { /* bỏ qua */ } };
  // phát bus mà không bao giờ ném (kể cả khi người nghe khác ném)
  function emit(name, payload) { try { bus.emit(name, payload); } catch (e) { logErr('emit ' + name, e); } }
  const enabled = () => box.settings.enabled !== false;
  function save() { try { if (ctx.store.save) ctx.store.save(); } catch (e) { logErr('save', e); } }
  const itemOf = id => catalog.items.find(i => i.id === id) || null;
  const owned = id => !!(box.inventory.items[id] && box.inventory.items[id].count > 0);

  // ---- Album theo bộ ----
  const setList = () => (Array.isArray(catalog.sets) ? catalog.sets : []);
  function albumView() {
    return setList().map(st => {
      const ids = catalog.items.filter(i => i.set === st.id).map(i => i.id);
      const have = ids.filter(owned).length;
      return {
        setId: st.id, name: st.name, items: ids, owned: have, total: ids.length,
        complete: ids.length > 0 && have === ids.length, claimed: !!box.album.claimed[st.id], reward: st.reward
      };
    });
  }

  // ---- View (mục 8) ----
  function view() {
    const t = now();
    economy.rollDay(box, t);
    const lv = economy.level(box.stats.exp);
    const ql = quests.listView(box, t, catalog);
    const items = {};
    for (const id of Object.keys(box.inventory.items)) items[id] = { count: box.inventory.items[id].count };
    const foodFactor = {};
    for (const f of catalog.foods) foodFactor[f.id] = stats.foodFactor(box, f.id, t);
    const bag = {};
    for (const id of Object.keys(box.inventory.food || {})) if (box.inventory.food[id] > 0) bag[id] = box.inventory.food[id];
    const today = box.log.find(l => l.day === box.today.day) || { done: 0, coins: 0 };
    return {
      enabled: enabled(),
      stats: {
        energy: box.stats.energy, mood: box.stats.mood, affection: box.stats.affection,
        candy: box.stats.candy, exp: box.stats.exp,
        streak: { count: box.stats.streak.count, lastDay: box.stats.streak.lastDay }
      },
      level: lv,
      levelExp: Math.pow((lv - 1) * 10, 2),   // exp mốc của level hiện tại
      nextLevelExp: economy.nextLevelExp(lv),
      mode: enabled() ? stats.mode(box.stats) : 'normal',
      items, shards: box.inventory.shards,
      worn: { ...box.inventory.worn },
      outfits: box.inventory.outfits.map(o => ({ id: o.id, name: o.name, worn: { ...o.worn } })),
      pity: box.gacha.pity, pityLeft: gacha.pityLeft(box), totalPulls: box.gacha.total,
      history: box.gacha.history.map(h => ({ ...h })),
      quests: { daily: ql.daily, weekly: ql.weekly },
      achievements: ql.achievements,
      log: box.log.slice(-60).map(l => ({ ...l })),
      today: { done: today.done, coins: today.coins },
      rates: { base: { ...gacha.RATES }, effective: gacha.effectiveRates() },
      cost: { ...gacha.COST }, shardPrice: { ...gacha.SHARD_PRICE },
      foodFactor,
      checkin: checkin.view(box, t),
      bag,
      album: albumView()
    };
  }

  function notifyChanged() {
    try {
      const w = ctx.windows && ctx.windows.game;
      if (w && ctx.send && (!ctx.alive || ctx.alive(w))) ctx.send(w, 'game:changed', view());
    } catch (e) { logErr('changed', e); }
  }

  // ---- phát mode / outfit ----
  function publishMode(force) {
    const lv = economy.level(box.stats.exp);
    const p = enabled()
      ? { mode: stats.mode(box.stats), energy: box.stats.energy, mood: box.stats.mood, level: lv }
      : { mode: 'normal', energy: 100, mood: 70, level: lv };
    const key = (enabled() ? '1:' : '0:') + p.mode + ':' + lv;
    if (!force && key === lastModeKey) return;
    lastModeKey = key;
    emit('game:mode', p);
  }
  function publishOutfit() {
    emit('game:outfit', { worn: enabled() ? { ...box.inventory.worn } : {} });
  }

  // ---- gộp thưởng của một sự kiện: tối đa 1 game:reward ----
  // list: các Reward (có thể null). Cộng thêm thành tích mới mở, lưu, phát bus, báo cửa sổ.
  function settle(list) {
    const t = now();
    const rs = (list || []).filter(Boolean);
    try {
      for (const a of quests.checkAchievements(box, t, catalog)) {
        const g = economy.grant(box, { candy: a.reward, reason: 'ach:' + a.id }, t);
        if (g) rs.push(g);
      }
    } catch (e) { logErr('achievements', e); }
    const sum = { candy: 0, exp: 0, affection: 0, reason: rs.length ? rs[0].reason : '' };
    for (const r of rs) { sum.candy += r.candy || 0; sum.exp += r.exp || 0; sum.affection += r.affection || 0; }
    save();
    const lv = economy.level(box.stats.exp);
    if (sum.candy > 0) emit('game:reward', { ...sum, count: sum.candy });
    if (lv > lastLevel) emit('game:levelup', { level: lv });
    lastLevel = lv;
    publishMode(false);
    notifyChanged();
    return sum;
  }

  // ---- người nghe bus ----
  const safe = (name, fn) => payload => {
    try { fn(isObj(payload) ? payload : {}); } catch (e) { logErr('bus ' + name, e); }
  };
  const validId = v => typeof v === 'string' && v.length > 0 && v.length < 200;
  // Ghi nhanh qua bé: đếm một lần cho mỗi note (note:created + pet:captured có thể cùng báo một lần)
  const captured = [];
  function countCapture(p) {
    const id = (isObj(p.note) && p.note.id) || p.noteId || p.id;
    if (typeof id === 'string' && id) {
      if (captured.includes(id)) return;
      captured.push(id);
      if (captured.length > 50) captured.shift();
    }
    const t = now();
    box.flags.captureSeen = true;
    box.counters.captures++;
    quests.progress(box, 'capture', 1, t);
  }
  const handlers = {
    'reminder:done': p => {
      if (!enabled() || !validId(p.noteId)) return;
      const t = now();
      const note = ctx.findNote ? ctx.findNote(p.noteId) : null;
      const r = economy.onDone(box, { noteId: p.noteId, reminderId: p.reminderId, onTime: p.onTime, note, now: t });
      if (r) {
        quests.progress(box, 'done', 1, t);
        if (p.onTime !== false) quests.progress(box, 'ontime', 1, t);
      }
      settle([r]);
    },
    'note:checkItem': p => {
      if (!enabled() || !validId(p.noteId) || !Number.isInteger(p.index) || p.index < 0 || p.done !== true) return;
      const t = now();
      const note = ctx.findNote ? ctx.findNote(p.noteId) : null;
      const r = economy.onCheckItem(box, { noteId: p.noteId, index: p.index, done: true, note, now: t });
      if (r) quests.progress(box, 'check', 1, t);
      settle([r, economy.firstUse(box, 'checklist', t)]);
    },
    'note:created': p => {
      if (!enabled()) return;
      const t = now();
      const src = typeof p.source === 'string' ? p.source : (isObj(p.note) && typeof p.note.source === 'string' ? p.note.source : '');
      if (CAPTURE_SOURCES.has(src)) countCapture(p);
      settle([economy.firstUse(box, 'note', t)]);
    },
    'pet:capture': p => { if (enabled()) { countCapture(p); settle([]); } },
    'pet:captured': p => { if (enabled()) { countCapture(p); settle([]); } },
    'note:trashed': () => {
      if (!enabled()) return;
      box.counters.trashed++;
      box.counters.tidy++;
      quests.progress(box, 'tidy', 1, now());
      settle([]);
    },
    'alarm:stopped': () => {
      if (!enabled()) return;
      const t = now();
      settle([economy.onAlarmStopped(box, { now: t }), economy.firstUse(box, 'alarm', t)]);
    },
    'pet:interact': p => {
      if (!enabled() || typeof p.kind !== 'string') return;
      const t = now();
      const changed = stats.onInteract(box, p.kind, t);
      const rs = [];
      if (p.kind === 'pat-head' && changed) {
        quests.progress(box, 'pat', 1, t);
        rs.push(economy.firstUse(box, 'pat', t));
      }
      settle(rs);
    },
    'pet:posture': p => { asleep = p.posture === 'sleep'; },
    'app:idle': () => { asleep = true; },
    'app:resume': () => { asleep = false; },
    'app:startup': () => {
      try { economy.pruneRewarded(box, now()); } catch (e) { logErr('prune', e); }
      publishMode(true);
      publishOutfit();
    }
  };
  for (const name of Object.keys(handlers)) bus.on(name, safe(name, handlers[name]));

  // ---- bộ đếm mỗi phút ----
  function tick() {
    try {
      const t = now();
      economy.rollDay(box, t);
      quests.roll(box, t);
      stats.tick(box, { minutes: 1, asleep, now: t });
      save();
      publishMode(false);
      notifyChanged();
    } catch (e) { logErr('tick', e); }
  }

  // ---- hành động (IPC) ----
  const NO = reason => ({ ok: false, reason });

  // Chọn câu: ctx.persona.pick nếu có, không thì câu mặc định; phát persona:line
  function speak(event, item, fallback, face) {
    let r = null;
    try { r = ctx.persona && ctx.persona.pick ? ctx.persona.pick(event, { item }) : null; } catch (_) { r = null; }
    const line = r && typeof r.text === 'string' && r.text
      ? { text: r.text, face: r.face, anim: r.anim }
      : { text: cut(fallback, LINE_MAX), face };
    emit('persona:line', { text: line.text, face: line.face, anim: line.anim, priority: 30, ttlMs: 6000 });
    return line;
  }

  // Cho ăn thật sự (xu/túi đã trừ): chỉ số, thưởng lần đầu, nhiệm vụ, game:fed, câu thoại
  function eat(food) {
    const t = now();
    const r = stats.feed(box, food, t);
    const reward = economy.firstUse(box, 'feed', t);
    quests.progress(box, 'feed', 1, t);
    emit('game:fed', { foodId: food.id, name: food.name });
    const line = speak('feed', food.name, `Ngon quá, cảm ơn cậu đã cho tớ ${food.name}!`, 'happy');
    settle([reward]);
    return { ok: true, factor: r.factor, line: line.text, view: view() };
  }

  const actions = {
    state: () => view(),
    catalog: () => catalog,
    setEnabled(on) {
      box.settings.enabled = !!on;
      save();
      publishMode(true);
      publishOutfit();
      if (on) lastLevel = economy.level(box.stats.exp);
      notifyChanged();
      return view();
    },
    wear(slot, itemId) {
      if (!enabled() || typeof slot !== 'string' || !slotIds.has(slot)) return view();
      const t = now();
      if (itemId === null || itemId === undefined) {
        if (!(slot in box.inventory.worn)) return view();
        delete box.inventory.worn[slot];
        publishOutfit(); settle([]);
        return view();
      }
      const it = typeof itemId === 'string' ? itemOf(itemId) : null;
      if (!it || it.slot !== slot || !owned(itemId)) return view();
      box.inventory.worn[slot] = itemId;
      box.counters.outfits++;
      publishOutfit();
      settle([economy.firstUse(box, 'outfit', t)]);
      return view();
    },
    saveOutfit(name) {
      if (!enabled()) return view();
      const list = box.inventory.outfits;
      if (list.length >= MAX_OUTFITS) return view();
      let n = 1;
      while (list.some(o => o.id === 'o' + n)) n++;
      const nm = typeof name === 'string' ? name.trim().slice(0, NAME_MAX) : '';
      list.push({ id: 'o' + n, name: nm || 'Bộ ' + n, worn: { ...box.inventory.worn } });
      settle([]);
      return view();
    },
    applyOutfit(id) {
      if (!enabled() || typeof id !== 'string') return view();
      const o = box.inventory.outfits.find(x => x.id === id);
      if (!o) return view();
      const worn = {};
      for (const slot of Object.keys(o.worn)) {   // chỉ mặc món còn sở hữu và đúng khe
        const it = itemOf(o.worn[slot]);
        if (slotIds.has(slot) && it && it.slot === slot && owned(it.id)) worn[slot] = it.id;
      }
      box.inventory.worn = worn;
      box.counters.outfits++;
      publishOutfit();
      settle([Object.keys(worn).length ? economy.firstUse(box, 'outfit', now()) : null]);
      return view();
    },
    deleteOutfit(id) {
      if (!enabled() || typeof id !== 'string') return view();
      const list = box.inventory.outfits;
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) { list.splice(i, 1); settle([]); }
      return view();
    },
    pull(count) {
      const fail = reason => ({ ok: false, reason, results: [], view: view() });
      if (count !== 1 && count !== 10) return fail('Số lượt không hợp lệ');
      if (!enabled()) return fail('Game hóa đang tắt');
      if (!catalog.items.length) return fail('Chưa có quà để quay');
      const t = now();
      if (!economy.spend(box, count === 10 ? gacha.COST.ten : gacha.COST.one)) return fail('Chưa đủ xu');
      const results = gacha.pull(box, catalog, count, rng, t);
      const rs = [economy.firstUse(box, 'gacha', t)];
      stats.bump(box, { mood: 1 });
      // câu thoại: món MỚI hiếm nhất; toàn trùng -> gacha_dup
      let best = null;
      for (const r of results) {
        if (!r.dup && (!best || ORDER.indexOf(r.rarity) > ORDER.indexOf(best.rarity))) best = r;
      }
      let line;
      if (best) {
        const nm = (itemOf(best.itemId) || {}).name || 'món mới';
        line = speak('gacha_win', nm, `Oa, cậu quay được ${nm} rồi nè!`, 'excited');
      } else if (results.length) {
        const nm = (itemOf(results[0].itemId) || {}).name || 'món này';
        line = speak('gacha_dup', nm, `Lại trùng ${nm} rồi, tớ giữ mảnh cho cậu nha.`, 'happy');
      }
      settle(rs);
      return { ok: true, results, line: line ? line.text : undefined, view: view() };
    },
    exchange(itemId) {
      if (!enabled()) return { ok: false, reason: 'Game hóa đang tắt', view: view() };
      if (typeof itemId !== 'string') return { ok: false, reason: 'Không có món này', view: view() };
      const r = gacha.exchange(box, catalog, itemId, now());
      if (r.ok) settle([]);
      return { ...r, view: view() };
    },
    feed(foodId) {
      const fail = reason => ({ ok: false, reason, factor: 1, view: view() });
      if (!enabled()) return fail('Game hóa đang tắt');
      const food = typeof foodId === 'string' ? catalog.foods.find(f => f.id === foodId) : null;
      if (!food) return fail('Không có món này');
      if (!economy.spend(box, food.price)) return fail('Chưa đủ xu');
      return eat(food);
    },
    // checkin/buy/feedBag/claimSet: lý do lỗi là MÃ ('off'|'bad'|'coins'|'empty'|'full'|'done'|'incomplete'), UI tự dịch.
    checkin() {
      const fail = reason => ({ ok: false, reason, reward: { candy: 0 }, view: view() });
      if (!enabled()) return fail('off');
      const t = now();
      const c = checkin.claim(box, t);
      if (!c.ok) return fail(c.reason);
      settle([economy.grant(box, { candy: c.reward.candy, reason: 'checkin' }, t)]);
      return { ok: true, reward: c.reward, view: view() };
    },
    buy(foodId, n) {
      const fail = reason => ({ ok: false, reason, view: view() });
      if (!enabled()) return fail('off');
      const food = typeof foodId === 'string' ? catalog.foods.find(f => f.id === foodId) : null;
      if (!food || !Number.isInteger(n) || n < 1 || n > 10) return fail('bad');
      const cur = box.inventory.food[food.id] || 0;
      if (cur + n > MAX_FOOD) return fail('full');
      if (!economy.spend(box, food.price * n)) return fail('coins');
      box.inventory.food[food.id] = cur + n;
      settle([]);
      return { ok: true, view: view() };
    },
    feedBag(foodId) {
      const fail = reason => ({ ok: false, reason, factor: 1, view: view() });
      if (!enabled()) return fail('off');
      const food = typeof foodId === 'string' ? catalog.foods.find(f => f.id === foodId) : null;
      if (!food) return fail('bad');
      const cur = box.inventory.food[food.id] || 0;
      if (cur <= 0) return fail('empty');
      if (cur === 1) delete box.inventory.food[food.id]; else box.inventory.food[food.id] = cur - 1;
      return eat(food);
    },
    claimSet(setId) {
      const fail = reason => ({ ok: false, reason, reward: { candy: 0 }, view: view() });
      if (!enabled()) return fail('off');
      const st = typeof setId === 'string' ? setList().find(x => x.id === setId) : null;
      if (!st) return fail('bad');
      if (box.album.claimed[st.id]) return fail('done');
      const row = albumView().find(x => x.setId === st.id);
      if (!row || !row.complete) return fail('incomplete');
      const t = now();
      box.album.claimed[st.id] = t;
      settle([economy.grant(box, { candy: st.reward, reason: 'set:' + st.id }, t)]);
      return { ok: true, reward: { candy: st.reward }, view: view() };
    },
    claim(questId) {
      if (!enabled()) return { ok: false, reason: 'Game hóa đang tắt', view: view() };
      if (typeof questId !== 'string') return { ok: false, reason: 'Không có nhiệm vụ này', view: view() };
      const t = now();
      const c = quests.claim(box, questId, t);
      if (!c.ok) return { ...c, view: view() };
      const g = economy.grant(box, { candy: c.reward.candy, exp: c.reward.exp, reason: 'quest:' + questId }, t);
      settle([g]);
      return { ok: true, reward: c.reward, view: view() };
    },
    close() {
      try { const w = ctx.windows && ctx.windows.game; if (w && (!ctx.alive || ctx.alive(w))) w.close(); } catch (_) { /* bỏ qua */ }
      return true;
    }
  };

  // Tên kênh IPC -> hàm. Bọc lỗi: không bao giờ ném về renderer.
  const channels = {
    'game:state': actions.state, 'game:catalog': actions.catalog, 'game:setEnabled': actions.setEnabled,
    'game:wear': actions.wear, 'game:saveOutfit': actions.saveOutfit, 'game:applyOutfit': actions.applyOutfit,
    'game:deleteOutfit': actions.deleteOutfit, 'game:pull': actions.pull, 'game:exchange': actions.exchange,
    'game:feed': actions.feed, 'game:claim': actions.claim, 'game:close': actions.close,
    'game:checkin': actions.checkin, 'game:buy': actions.buy, 'game:feedBag': actions.feedBag, 'game:claimSet': actions.claimSet
  };
  const ipc = {};
  for (const ch of Object.keys(channels)) {
    ipc[ch] = (...args) => {
      try { return channels[ch](...args); } catch (e) {
        logErr(ch, e);
        const NEW = ['game:checkin', 'game:buy', 'game:feedBag', 'game:claimSet'];
        if (NEW.includes(ch)) return { ok: false, reason: 'bad', view: view() };
        return ch === 'game:pull' || ch === 'game:feed' || ch === 'game:exchange' || ch === 'game:claim'
          ? { ok: false, reason: 'Có lỗi nhỏ, bạn thử lại nhé', results: [], view: view() } : view();
      }
    };
  }

  // Chế độ gỡ lỗi chụp ảnh nghiệm thu
  function demo() {
    if (box.stats.candy < DEMO_COINS) {
      box.stats.candy += DEMO_COINS;   // cộng thẳng, không ghi vào log thống kê
      save();
    }
  }

  // Khởi động bộ đếm (init gọi; test thì không gọi)
  let timer = null;
  function start() {
    quests.roll(box, now());
    if (!timer) {
      timer = setInterval(tick, 60000);
      if (timer.unref) timer.unref();
    }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Khởi tạo: dọn khóa cũ, đổi ngày, chọn nhiệm vụ
  economy.pruneRewarded(box, now());
  economy.rollDay(box, now());
  quests.roll(box, now());

  return { box, view, actions, ipc, channels: Object.keys(channels), tick, start, stop, demo, publishMode, publishOutfit, enabled };
}

function init(ctx) {
  const game = createGame(ctx);
  const winMod = () => require('./window.js');
  ctx.game = {
    open: tab => { try { winMod().open(ctx, typeof tab === 'string' ? tab : ''); } catch (e) { console.error('[game] mở cửa sổ:', e); } },
    view: () => game.view(),
    enabled: () => game.enabled(),
    setEnabled: on => game.actions.setEnabled(!!on)
  };
  try {
    const { ipcMain } = require('electron');
    for (const ch of game.channels) ipcMain.handle(ch, (_e, ...args) => game.ipc[ch](...args));
  } catch (e) { console.error('[game] không đăng ký được IPC:', e.message); }

  if (process.env.MOCHI_GAME_DEMO) game.demo();
  game.start();
  ctx.bus.on('app:startup', () => {
    try {
      const tab = process.env.MOCHI_GAME_OPEN;
      if (tab) { const t = setTimeout(() => ctx.game.open(tab), 1500); if (t.unref) t.unref(); }
      // Nghiệm thu: MOCHI_GAME_DEMO_DONE=<giây> → bấm "Xong" note có hẹn đầu tiên qua API công bố của notes.
      const sec = Number(process.env.MOCHI_GAME_DEMO_DONE);
      if (sec > 0) {
        const t = setTimeout(() => {
          try {
            const n = (ctx.store.data.notes || []).find(x => x && x.reminder && !x.reminder.done);
            if (n && ctx.notes && typeof ctx.notes.completeNote === 'function') ctx.notes.completeNote(n.id);
          } catch (e) { console.error('[game] demo done:', e); }
        }, sec * 1000);
        if (t.unref) t.unref();
      }
    } catch (e) { console.error('[game]', e); }
  });
  return game;
}

module.exports = { init, createGame };
