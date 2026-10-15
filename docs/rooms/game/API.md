# Phòng game — hợp đồng nội bộ (Đợt 2)

Tài liệu này do trưởng phòng game chốt. Mọi nhân viên viết code đúng các tên hàm/kênh/khoá dưới đây.
"Xu" = `stats.candy` (tên khoá theo `docs/spec/01-data.md`). Giờ/ngày luôn theo **giờ địa phương**.

## 1. Cây file
```
src/main/game/
  index.js            init(ctx): đăng ký ngăn, nghe bus, IPC 'game:*', bộ đếm phút, ctx.game
  window.js           cửa sổ "Phòng của Mochi" (BrowserWindow) — open(tab?)
  catalog.js          nạp + kiểm assets/game/catalog.json (thuần, có thể require trong test)
  logic/box.js        defaults() + normalize(stored) cho ngăn 'game' (migrate)
  logic/time.js       dayKey(ms), weekKey(ms), isYesterday(prevDay, day)
  logic/economy.js    tính xu/exp, chống cày, chuỗi ngày, level, lần đầu dùng
  logic/stats.js      tâm trạng/năng lượng, mode, đồ ăn giảm hiệu quả
  logic/gacha.js      tỉ lệ, bảo hiểm, trùng → mảnh, đổi mảnh
  logic/quests.js     nhiệm vụ ngày/tuần, thành tích
  __tests__/*.test.js node:test + node:assert (chạy: node --test src/main/game/__tests__/)
src/game/
  room.html room.css room.js         khung cửa sổ + thanh tab + thanh xu + toast
  preview.js                         vẽ bé mặc thử (dùng chung tủ đồ, gacha)
  tabs/wardrobe.js|.css  tabs/gacha.js|.css  tabs/shop.js|.css  tabs/quests.js|.css  tabs/stats.js|.css
  test/mock-api.js  test/preview.html   (giả lập window.mochi.game để xem trong trình duyệt; không đóng gói)
assets/game/
  catalog.json        đồ mặc + đồ ăn
  icons/<id>.svg      icon phẳng 64×64 viewBox="0 0 64 64"
```
Logic thuần (`logic/*`, `catalog.js`) **không require electron**, không đọc đồng hồ thật: mọi hàm nhận `now` (epoch ms) và `rng` (hàm trả [0,1)) khi cần.

## 2. Ngăn `game` (store.section('game', defaults, normalize))
```js
{
  version: 1,
  settings: { enabled: true },            // tắt → không thưởng, không đổi chỉ số, phát game:mode 'normal'
  stats: { energy: 80, mood: 70, affection: 0, candy: 100, exp: 0, streak: { count: 0, lastDay: '' } },
  inventory: {
    items: { /* itemId: { count: 1, firstAt: ms } */ },
    shards: 0,
    worn: { /* slot: itemId */ },
    outfits: [ /* { id: 'o1', name: 'Bộ 1', worn: {slot:itemId} } tối đa 6 */ ],
    foodLog: [ /* { foodId, at } tối đa 20 gần nhất */ ]
  },
  gacha: { pity: 0, total: 0, history: [ /* { itemId, rarity, dup, at } tối đa 50 */ ] },
  quests: {
    day: '',  daily:  [ /* { id, progress, goal, claimed } */ ],
    week: '', weekly: [ /* như trên */ ]
  },
  achievements: { /* achId: atMs */ },
  counters: { done: 0, onTime: 0, longTerm: 0, checkItems: 0, pats: 0, feeds: 0, pulls: 0, trashed: 0, alarms: 0, outfits: 0 },
  firstUse: { /* feature: atMs */ },
  rewarded: { /* key: atMs — chống thưởng lặp; xoá khoá cũ > 60 ngày */ },
  today: { day: '', noteCoins: 0, alarmBonus: 0, pats: 0 },
  log: [ /* { day: 'YYYY-MM-DD', done: n, coins: n } tối đa 120 ngày */ ]
}
```
`normalize` phải chịu dữ liệu thiếu/sai kiểu (điền mặc định, kẹp số), ném lỗi chỉ khi không phải object.

## 3. Luật kinh tế (logic/economy.js)
Hằng số xuất ở `RULES`:
| Việc | Xu | Exp | Ghi chú |
|---|---|---|---|
| Xong note (`reminder:done`) | +10 | +10 | note phải tồn tại ≥ 2 phút (`now - note.createdAt ≥ 120000`); khoá `done:<noteId>:<reminderId>:<due>` thưởng 1 lần (payload có `reminderId` hợp lệ: chuỗi 1–40 ký tự; due lấy từ `note.reminders[id]`, fallback `note.reminder`); thiếu/rác `reminderId` → khoá cũ `done:<noteId>:<due>` |
| …đúng hạn (`onTime !== false`) | +5 | +5 | |
| …việc dài hạn (note tạo ≥ 24 giờ trước) | +20 | +20 | |
| Mỗi mục checklist (`note:checkItem` done=true) | +2 | +2 | khoá `chk:<noteId>:<index>`; note ≥ 2 phút |
| Tắt báo thức (`alarm:stopped`) | +3 | +2 | tối đa 3 lần/ngày |
| Lần đầu dùng tính năng | +20 | +10 | `note` (note:created), `alarm`, `checklist`, `gacha`, `feed`, `outfit`, `pat` |
| Chuỗi ngày đạt 3 / 7 / 30 | +30 / +70 / +300 | | |
| Nhiệm vụ ngày / tuần | +30 / +150 | +20 / +80 | nhận bằng nút |
| Thành tích | theo định nghĩa | | |
Trần chống cày: xu từ note + checklist ≤ **300/ngày** (`today.noteCoins`). Quá trần vẫn đếm việc xong (thống kê, nhiệm vụ) nhưng 0 xu.
Chuỗi ngày: một ngày "có làm" khi có ≥ 1 note xong được tính. `lastDay` = hôm qua → `count+1`; = hôm nay → giữ; khác → `count = 1`. Không trừ gì khi đứt chuỗi.
Level: `level(exp) = Math.floor(Math.sqrt(exp) / 10) + 1`.

API (thuần, sửa trực tiếp `box`, trả kết quả để index.js phát bus):
```js
economy.onDone(box, { noteId, onTime, note, now })      // -> Reward | null
economy.onCheckItem(box, { noteId, index, done, note, now }) // -> Reward | null
economy.onAlarmStopped(box, { now })                    // -> Reward | null
economy.firstUse(box, feature, now)                     // -> Reward | null
economy.grant(box, { candy, exp, affection, reason }, now) // cộng thẳng (nhiệm vụ, thành tích) -> Reward
economy.spend(box, amount)                              // -> boolean (đủ xu thì trừ)
economy.level(exp)
// Reward = { candy, exp, affection, reason, levelUp: number|null, streak: number|null }
//   reason: 'done' | 'checklist' | 'alarm' | 'first:<feature>' | 'streak:<n>' | 'quest:<id>' | 'ach:<id>'
```
Mọi hàm tự gọi `rollDay(box, now)` (đổi ngày → reset `today`, thêm dòng `log`).

## 4. Chỉ số & mode (logic/stats.js)
```js
stats.tick(box, { minutes, asleep, now })   // năng lượng: thức −0,15/phút (đáy 5); ngủ/máy rảnh +1/phút (trần 100)
                                            // tâm trạng trôi dần về 50 với tốc độ 2/giờ (không xuống dưới 20)
stats.bump(box, { mood, energy, affection }) // kẹp 0..100
stats.onInteract(box, kind, now)             // pat-head +4 (tối đa 15 lần/ngày có tác dụng), pat-body +2, click +1, -> bool có đổi
stats.feed(box, food, now)                   // -> { ok, mood, energy, factor } ; giảm hiệu quả: số lần ăn CÙNG món trong 6 giờ gần nhất n → factor [1, .6, .35, .2, .1][min(n,4)]
stats.mode(s)                                // energy<20 → 'tired'; mood<30 → 'sad'; mood≥70 && energy≥40 → 'happy'; còn lại 'normal'
```
Xong note: mood +3, affection +1. Gacha: mood +1. Không bao giờ ốm/chết/bỏ đi.

## 5. Gacha (logic/gacha.js)
```js
RATES = { common: 0.70, rare: 0.24, epic: 0.05, legend: 0.01 }   // Thường / Hiếm / Siêu hiếm / Huyền thoại
PITY = 30          // lượt thứ 30 liên tiếp chưa ra Siêu hiếm trở lên → chắc chắn ≥ Siêu hiếm (epic:legend = 5:1)
COST = { one: 50, ten: 500 }   // 10+1 = 11 lượt
SHARD_FOR_DUP = { common: 1, rare: 3, epic: 10, legend: 30 }
SHARD_PRICE   = { common: 5, rare: 15, epic: 50, legend: 150 }
gacha.rollRarity(rng, pity)               // -> rarity (pity = số lượt liên tiếp chưa ra ≥ epic TRƯỚC lượt này)
gacha.pull(box, catalog, count, rng, now) // trừ xu đã làm ở index (economy.spend); -> [{ itemId, rarity, dup, shards }]
gacha.exchange(box, catalog, itemId)      // đổi mảnh lấy món -> { ok, reason? }
gacha.effectiveRates()                    // tỉ lệ thực tế khi tính cả bảo hiểm (giải tích), để hiện trên máy
```
Món chọn đều trong cùng độ hiếm. Trùng → +mảnh theo bảng, `count` vẫn tăng.

## 6. Nhiệm vụ & thành tích (logic/quests.js)
Ngày (3, cố định): `daily.done3` "Xong 3 note" (goal 3, đếm reminder:done), `daily.tidy1` "Dọn 1 note hết hạn" (goal 1, đếm `note:trashed`), `daily.pat1` "Xoa đầu Mochi" (goal 1, `pet:interact` pat-head).
Tuần (1): `weekly.done15` "Xong 15 note trong tuần" (goal 15). Tuần bắt đầu thứ Hai.
```js
quests.roll(box, now)                 // đổi ngày/tuần → tạo lại danh sách
quests.progress(box, kind, n, now)    // kind: 'done'|'tidy'|'pat' -> danh sách nhiệm vụ vừa đạt
quests.claim(box, questId, now)       // -> { ok, reward:{candy,exp} } (chỉ khi progress ≥ goal và chưa nhận)
quests.checkAchievements(box, now)    // -> [achId mới mở]; mỗi cái có thưởng xu
ACHIEVEMENTS = [{ id, name, desc, icon, reward, test(box) }]   // ≥ 10 cái: xong note đầu tiên, 10/100 note, chuỗi 3/7/30, 10 lượt gacha, có món Huyền thoại, cho ăn 10 lần, xoa đầu 50 lần, mặc đủ 5 khe, gom 20 món…
```

## 7. Danh mục `assets/game/catalog.json`
```jsonc
{
  "version": 1,
  "slots": [ { "id": "hat", "name": "Mũ" }, { "id": "hairclip", "name": "Kẹp tóc" }, { "id": "glasses", "name": "Kính" },
             { "id": "neck", "name": "Cổ" }, { "id": "body", "name": "Áo" }, { "id": "outer", "name": "Áo khoác" },
             { "id": "hand", "name": "Cầm tay" }, { "id": "back", "name": "Sau lưng" } ],
  "rarities": [ { "id": "common", "name": "Thường" }, { "id": "rare", "name": "Hiếm" }, { "id": "epic", "name": "Siêu hiếm" }, { "id": "legend", "name": "Huyền thoại" } ],
  "items": [ { "id": "hat_cat_beanie", "slot": "hat", "rarity": "common", "name": "Mũ len tai mèo", "icon": "icons/hat_cat_beanie.svg", "set": "winter", "desc": "…" } ],
  "foods": [ { "id": "food_mochi", "name": "Bánh mochi", "icon": "icons/food_mochi.svg", "price": 15, "mood": 8, "energy": 6 } ]
}
```
≥ 40 món (mỗi khe ≥ 4; ước lượng: Thường ~45%, Hiếm ~30%, Siêu hiếm ~17%, Huyền thoại ~8% số món), ≥ 8 đồ ăn. `id` chỉ `[a-z0-9_]`, tiền tố theo khe. Đường dẫn icon tương đối với `assets/game/`.

## 8. IPC (kênh `game:*`) và preload `api.game`
```js
api.game = {
  state: () => inv('game:state'),                 // -> View (dưới)
  catalog: () => inv('game:catalog'),             // -> catalog.json đã kiểm
  setEnabled: on => inv('game:setEnabled', !!on), // -> View
  wear: (slot, itemId) => inv('game:wear', slot, itemId),   // itemId null = cởi -> View
  saveOutfit: name => inv('game:saveOutfit', name),         // -> View
  applyOutfit: id => inv('game:applyOutfit', id),           // -> View
  deleteOutfit: id => inv('game:deleteOutfit', id),         // -> View
  pull: count => inv('game:pull', count),         // 1 | 10 -> { ok, reason?, results:[{itemId,rarity,dup,shards}], line?, view }
  exchange: itemId => inv('game:exchange', itemId), // -> { ok, reason?, view }
  buyFeed: foodId => inv('game:feed', foodId),      // mua + cho ăn ngay -> { ok, reason?, factor, line?, view }
  claim: questId => inv('game:claim', questId),     // -> { ok, reward?, view }
  close: () => inv('game:close'),
  onChanged: cb => on('game:changed', cb),          // cb(View) — mỗi khi state đổi
  onTab: cb => on('game:tab', cb)                   // cb('wardrobe'|'gacha'|'shop'|'quests'|'stats')
};
// View = {
//   enabled, stats:{energy,mood,affection,candy,exp,streak}, level, nextLevelExp, levelExp,
//   mode, items:{id:{count}}, shards, worn:{slot:id}, outfits:[...],
//   pity, pityLeft, totalPulls, history:[...],
//   quests:{daily:[{id,name,progress,goal,claimed,reward}], weekly:[...]},
//   achievements:[{id,name,desc,icon,unlocked,at,reward}],
//   log:[{day,done,coins}] (tối đa 60 ngày), today:{done,coins},
//   rates:{base:RATES, effective:effectiveRates()}, cost:COST, shardPrice:SHARD_PRICE,
//   foodFactor:{foodId: factor hiện tại}
// }
```
`reason` lỗi bằng tiếng Việt ngắn ("Chưa đủ xu", "Game hóa đang tắt", "Chưa đủ mảnh"…).

## 9. Bus
Nghe: `reminder:done`, `note:checkItem`, `note:created`, `note:trashed`, `alarm:stopped`, `pet:interact`, `pet:posture`, `app:idle`, `app:resume`, `app:startup`.
Phát: `game:reward {candy,exp,affection,reason}` (persona tự nói câu `reward`), `game:levelup {level}`, `game:mode {mode,energy,mood,level}` (khi đổi và lúc khởi động), `game:outfit {worn}`, `game:fed {foodId,name}` (mỗi lần cho ăn thành công, sau khi cập nhật chỉ số; không phát khi tắt game/thất bại).
`reminder:done` payload: `{noteId, onTime, reminderId, title}`.
Gacha/cho ăn: index.js gọi `ctx.persona.pick('gacha_win'|'gacha_dup'|'feed', {item})` (nếu có) rồi phát `persona:line {text, face, anim, priority: 30, ttlMs: 6000}`; không có câu → câu mặc định của phòng.
**Không bao giờ** gọi gì của notes/alarms, không chặn sự kiện; mọi người nghe bọc try/catch.

## 10. Cửa sổ
`ctx.game.open(tab?)` — một cửa sổ 760×560, không viền (frame:false), có titlebar kéo được, nút đóng. Phím tắt đề xuất Ctrl+Alt+G (điều hành đăng ký). `ctx.game` gồm `open`, `view`, `enabled`, `setEnabled(on)` (bật/tắt game cho cửa sổ cài đặt chung, trả View). Chạy thử: biến môi trường `MOCHI_GAME_OPEN=<tab>` mở sẵn cửa sổ sau khởi động 1,5 giây.

## 11. Renderer (`src/game/`) — quy ước giữa khung và các tab
Thứ tự nạp script trong `room.html` (script thường, không module): `preview.js`, `room.js`, `tabs/wardrobe.js`, `tabs/gacha.js`, `tabs/shop.js`, `tabs/quests.js`, `tabs/stats.js`. CSS: `room.css` rồi `tabs/*.css`.
```js
window.MochiRoom.registerTab(id, {          // gọi lúc nạp script; khung mount sau DOMContentLoaded
  label: 'Tủ đồ', icon: '<svg …>',          // icon nét 24×24 (stroke currentColor)
  mount(el, room) {},                       // el = <section class="tab-panel" id="tab-<id>">
  update(view, room) {},                    // gọi mỗi lần View đổi (kể cả khi tab đang ẩn)
  show(room) {}                             // tuỳ chọn: khi tab được chọn
});
room = {
  api: window.mochi.game, view, catalog,
  setView(view),                            // gọi sau mọi API trả về view → cập nhật mọi tab + thanh trên
  toast(text, kind),                        // kind: 'ok'|'warn'|'coin'
  iconUrl(pathInCatalog) -> '../../assets/game/' + path,
  item(id), food(id), rarityName(r), slotName(s),
  goto(tabId),
  preview: window.MochiPreview
};
MochiPreview.render(container, worn, catalog, { size: 220, mode: 'normal' })   // vẽ bé + đồ theo khe, trả element
```
Id tab: `wardrobe`, `gacha`, `shop`, `quests`, `stats`. CSS mỗi tab chỉ dùng lớp có tiền tố riêng (`.wd-`, `.gc-`, `.sh-`, `.qs-`, `.st-`); token màu/thành phần chung (`--r-common`, `--r-rare`, `--r-epic`, `--r-legend`, `.btn`, `.btn-primary`, `.card`, `.chip`, `.coin`) do `room.css` định nghĩa.
Xem thử không cần Electron: `python3 -m http.server <cổng>` ở gốc repo, mở `http://localhost:<cổng>/src/game/test/preview.html` (nạp `test/mock-api.js` giả lập `window.mochi.game` + catalog qua fetch).

## Đợt 3 (xem `API-dot3.md`)
Thêm `api.game.checkin/buy/feedBag/claimSet`, View `checkin/bag/album`, `quests.weekly` 3 mục, `game:reward` chỉ phát khi `candy > 0` (kèm `count`), tab `album`, `catalog.sets`. Ngăn `game` thêm `checkin`, `inventory.food`, `album.claimed`, `flags.captureSeen`, `counters.tidy/captures` (migrate trong `logic/box.js`).
