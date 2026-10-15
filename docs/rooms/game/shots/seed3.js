// node seed3.js <thư mục cfg> : dữ liệu mẫu Đợt 3 (điểm danh đang ở ô 3, túi đồ ăn, đủ bộ đồ ngủ để nhận thưởng album)
const fs = require('fs'), path = require('path');
require('./seed.js'); // tạo file cơ bản trước (dùng cùng argv)
const file = path.join(process.argv[2], 'Mochi Notes', 'mochi-data.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const cat = require('../../../../assets/game/catalog.json');
const pad = n => String(n).padStart(2, '0');
const day = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const items = {};
const own = it => { items[it.id] = { count: 1, at: Date.now() - 86400000 }; };
cat.items.filter(i => i.set === 'pajama' || i.set === 'camping').forEach(own);
cat.items.filter((i, k) => k % 3 === 0).forEach(own);
data.game.stats.candy = 860;
data.game.inventory = { items, worn: {}, outfits: [], shards: 7, food: { food_mochi: 2, food_boba: 1, food_grilled_fish: 3 } };
data.game.checkin = { cycleDay: 2, lastDay: day(Date.now() - 2 * 86400000), total: 9 };
fs.writeFileSync(file, JSON.stringify(data));
