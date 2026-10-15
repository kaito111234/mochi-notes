/* Giả lập window.mochi.game (API.md mục 8) bằng bộ nhớ — chỉ để xem thử trong trình duyệt. Không đóng gói. */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src) || location.href;
  var CATALOG_URL = new URL('../../../assets/game/catalog.json', BASE).href;
  var RATES = { common: 0.70, rare: 0.24, epic: 0.05, legend: 0.01 };
  var EFFECTIVE = { common: 0.6917, rare: 0.2372, epic: 0.0593, legend: 0.0119 };
  var COST = { one: 50, ten: 500 }, PITY = 30;
  var SHARD_DUP = { common: 1, rare: 3, epic: 10, legend: 30 };
  var SHARD_PRICE = { common: 5, rare: 15, epic: 50, legend: 150 };
  var FACTORS = [1, .6, .35, .2, .1];

  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rnd = seeded(20261015);
  var ymd = function (d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

  var S = {
    enabled: true,
    stats: { energy: 74, mood: 78, affection: 12, candy: 2000, exp: 235, streak: { count: 5, lastDay: '' } },
    items: {}, shards: 14, worn: {}, outfits: [{ id: 'o1', name: 'Bộ đi học', worn: {} }],
    foodLog: [], pity: 11, total: 23, history: [],
    quests: {
      daily: [
        { id: 'daily.done3', name: 'Xong 3 note', progress: 3, goal: 3, claimed: false, reward: { candy: 30, exp: 20 } },
        { id: 'daily.tidy1', name: 'Dọn 1 note hết hạn', progress: 0, goal: 1, claimed: false, reward: { candy: 30, exp: 20 } },
        { id: 'daily.pat1', name: 'Xoa đầu bé', progress: 1, goal: 1, claimed: true, reward: { candy: 30, exp: 20 } }
      ],
      weekly: [{ id: 'weekly.done15', name: 'Xong 15 note trong tuần', progress: 9, goal: 15, claimed: false, reward: { candy: 150, exp: 80 } }]
    },
    ach: [
      ['first_done', 'Việc đầu tiên', 'Xong note đầu tiên', 20, 1], ['done10', 'Chăm chỉ', 'Xong 10 note', 40, 1],
      ['done100', 'Siêu chăm', 'Xong 100 note', 200, 0], ['streak3', 'Ba ngày liền', 'Chuỗi 3 ngày', 30, 1],
      ['streak7', 'Một tuần', 'Chuỗi 7 ngày', 70, 0], ['streak30', 'Một tháng', 'Chuỗi 30 ngày', 300, 0],
      ['pull10', 'Thử vận may', '10 lượt gacha', 50, 1], ['legend1', 'Ánh vàng', 'Có món Huyền thoại', 100, 0],
      ['feed10', 'Bé no bụng', 'Cho ăn 10 lần', 40, 0], ['pat50', 'Xoa mãi', 'Xoa đầu 50 lần', 60, 0],
      ['wear5', 'Mặc đủ bộ', 'Mặc đủ 5 khe', 80, 0], ['collect20', 'Nhà sưu tầm', 'Gom 20 món', 120, 0],
      ['outfit1', 'Có gu', 'Lưu một bộ đồ', 30, 1], ['alarm10', 'Dậy đúng giờ', 'Tắt 10 báo thức', 40, 0]
    ].map(function (a, i) { return { id: a[0], name: a[1], desc: a[2], icon: a[0], reward: a[3], unlocked: !!a[4], at: a[4] ? Date.now() - (i + 1) * 86400000 : 0 }; }),
    log: []
  };
  S.stats.streak.lastDay = ymd(new Date());
  for (var d = 29; d >= 0; d--) { var dt = new Date(Date.now() - d * 86400000); var n = rnd() < 0.2 ? 0 : Math.floor(rnd() * 8); S.log.push({ day: ymd(dt), done: n, coins: n * 12 + Math.floor(rnd() * 9) }); }

  var catalog = null, listeners = [], tabListeners = [];
  var ready = fetch(CATALOG_URL).then(function (r) { return r.json(); }).then(function (c) {
    catalog = c;
    var pick = ['hat_cat_beanie', 'hat_cap', 'hat_witch', 'clip_x'];
    c.items.forEach(function (it, i) { if (i % 3 === 0 || pick.indexOf(it.id) >= 0) S.items[it.id] = { count: 1 + (i % 7 === 0 ? 1 : 0) }; });
    c.items.filter(function (i) { return i.rarity === 'legend'; }).slice(0, 1).forEach(function (i) { S.items[i.id] = { count: 1 }; });
    var firstOf = function (slot) { var x = c.items.find(function (i) { return i.slot === slot && S.items[i.id]; }); return x && x.id; };
    ['hat', 'hairclip', 'body'].forEach(function (s) { var id = firstOf(s); if (id) S.worn[s] = id; });
    S.outfits[0].worn = Object.assign({}, S.worn);
    return c;
  });

  function level(exp) { return Math.floor(Math.sqrt(exp) / 10) + 1; }
  function mode() { var s = S.stats; return s.energy < 20 ? 'tired' : s.mood < 30 ? 'sad' : (s.mood >= 70 && s.energy >= 40) ? 'happy' : 'normal'; }
  function foodFactor(id) { var cut = Date.now() - 6 * 3600e3; var n = S.foodLog.filter(function (f) { return f.foodId === id && f.at > cut; }).length; return FACTORS[Math.min(n, 4)]; }
  function view() {
    var lv = level(S.stats.exp), ff = {};
    (catalog ? catalog.foods : []).forEach(function (f) { ff[f.id] = foodFactor(f.id); });
    var today = S.log[S.log.length - 1];
    return JSON.parse(JSON.stringify({
      enabled: S.enabled, stats: S.stats, level: lv, nextLevelExp: lv * lv * 100, levelExp: (lv - 1) * (lv - 1) * 100,
      mode: S.enabled ? mode() : 'normal', items: S.items, shards: S.shards, worn: S.worn, outfits: S.outfits,
      pity: S.pity, pityLeft: PITY - S.pity, totalPulls: S.total, history: S.history,
      quests: S.quests, achievements: S.ach, log: S.log.slice(-60), today: { done: today.done, coins: today.coins },
      rates: { base: RATES, effective: EFFECTIVE }, cost: COST, shardPrice: SHARD_PRICE, foodFactor: ff
    }));
  }
  function emit() { var v = view(); listeners.forEach(function (cb) { try { cb(v); } catch (e) {} }); return v; }
  function earn(c, x) { S.stats.candy += c; S.stats.exp += x || 0; }
  function fail(reason, extra) { return Object.assign({ ok: false, reason: reason, view: view() }, extra || {}); }
  var wait = function (v) { return ready.then(function () { return new Promise(function (r) { setTimeout(function () { r(v()); }, 40); }); }); };
  var itemById = function (id) { return catalog.items.find(function (i) { return i.id === id; }); };

  function rollRarity() {
    if (S.pity >= PITY - 1) return Math.random() < 5 / 6 ? 'epic' : 'legend';
    var r = Math.random(), acc = 0, ids = ['common', 'rare', 'epic', 'legend'];
    for (var i = 0; i < 4; i++) { acc += RATES[ids[i]]; if (r < acc) return ids[i]; }
    return 'common';
  }
  function pullOne() {
    var r = rollRarity();
    S.pity = (r === 'epic' || r === 'legend') ? 0 : S.pity + 1; S.total++;
    var pool = catalog.items.filter(function (i) { return i.rarity === r; });
    var it = pool[Math.floor(Math.random() * pool.length)];
    var dup = !!S.items[it.id], shards = 0;
    if (dup) { shards = SHARD_DUP[r]; S.shards += shards; S.items[it.id].count++; } else S.items[it.id] = { count: 1 };
    S.history.unshift({ itemId: it.id, rarity: r, dup: dup, at: Date.now() }); S.history.length = Math.min(S.history.length, 50);
    return { itemId: it.id, rarity: r, dup: dup, shards: shards };
  }

  var api = {
    state: function () { return wait(view); },
    catalog: function () { return ready; },
    setEnabled: function (on) { return wait(function () { S.enabled = !!on; return emit(); }); },
    wear: function (slot, id) { return wait(function () {
      if (id && !S.items[id]) return view();
      if (id) S.worn[slot] = id; else delete S.worn[slot]; return emit(); }); },
    saveOutfit: function (name) { return wait(function () {
      if (S.outfits.length < 6) S.outfits.push({ id: 'o' + Date.now(), name: name || ('Bộ ' + (S.outfits.length + 1)), worn: Object.assign({}, S.worn) });
      return emit(); }); },
    applyOutfit: function (id) { return wait(function () { var o = S.outfits.find(function (x) { return x.id === id; }); if (o) S.worn = Object.assign({}, o.worn); return emit(); }); },
    deleteOutfit: function (id) { return wait(function () { S.outfits = S.outfits.filter(function (x) { return x.id !== id; }); return emit(); }); },
    pull: function (count) { return wait(function () {
      if (!S.enabled) return fail('Game hóa đang tắt', { results: [] });
      var cost = count === 10 ? COST.ten : COST.one;
      if (S.stats.candy < cost) return fail('Chưa đủ xu', { results: [] });
      S.stats.candy -= cost; S.stats.mood = Math.min(100, S.stats.mood + 1);
      var n = count === 10 ? 11 : 1, res = [];
      for (var i = 0; i < n; i++) res.push(pullOne());
      var best = res.some(function (x) { return x.rarity === 'epic' || x.rarity === 'legend'; });
      return { ok: true, results: res, line: best ? 'Wow… đẹp quá, tớ thích cái này.' : 'Ừm, cũng xinh nè.', view: emit() }; }); },
    exchange: function (id) { return wait(function () {
      var it = itemById(id); if (!it) return fail('Không có món này');
      if (S.items[id]) return fail('Cậu đã có món này rồi');
      var p = SHARD_PRICE[it.rarity]; if (S.shards < p) return fail('Chưa đủ mảnh');
      S.shards -= p; S.items[id] = { count: 1 }; return { ok: true, view: emit() }; }); },
    buyFeed: function (id) { return wait(function () {
      var f = catalog.foods.find(function (x) { return x.id === id; }); if (!f) return fail('Không có món này');
      if (!S.enabled) return fail('Game hóa đang tắt');
      if (S.stats.candy < f.price) return fail('Chưa đủ xu');
      var k = foodFactor(id); S.stats.candy -= f.price;
      S.stats.mood = Math.min(100, S.stats.mood + Math.round(f.mood * k)); S.stats.energy = Math.min(100, S.stats.energy + Math.round(f.energy * k));
      S.foodLog.push({ foodId: id, at: Date.now() });
      return { ok: true, factor: k, line: k < 1 ? 'Ừm… no rồi, hơi ngán.' : 'Ngon quá, cảm ơn cậu nha.', view: emit() }; }); },
    claim: function (qid) { return wait(function () {
      var q = S.quests.daily.concat(S.quests.weekly).find(function (x) { return x.id === qid; });
      if (!q || q.claimed || q.progress < q.goal) return fail('Chưa nhận được');
      q.claimed = true; earn(q.reward.candy, q.reward.exp); return { ok: true, reward: q.reward, view: emit() }; }); },
    close: function () { console.log('[mock] close'); return Promise.resolve(); },
    onChanged: function (cb) { listeners.push(cb); },
    onTab: function (cb) { tabListeners.push(cb); }
  };
  window.mochi = window.mochi || {};
  window.mochi.game = api;
  window.__mockTab = function (id) { tabListeners.forEach(function (cb) { cb(id); }); };
})();
