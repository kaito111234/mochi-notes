// node seed.js <thư mục cfg> : tạo dữ liệu có note có hẹn tạo 10 phút trước + lịch sử 20 ngày cho thống kê
const fs = require('fs'), path = require('path');
const dir = path.join(process.argv[2], 'Mochi Notes'); fs.mkdirSync(dir, { recursive: true });
const now = Date.now(), pad = n => String(n).padStart(2, '0');
const day = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const due = now + 30 * 60000, dd = new Date(due);
const text = 'Gửi báo cáo tuần cho chị Lan lúc ' + dd.getHours() + 'h' + pad(dd.getMinutes());
const note = { id: 'n_demo1', html: text, text, color: 'yellow', bounds: { x: 820, y: 80, width: 280, height: 200 }, visible: true, alwaysOnTop: false,
  reminder: { due, lead: 0, intent: 'task', auto: true, preFired: false, fired: false, done: false }, createdAt: now - 10 * 60000, updatedAt: now - 10 * 60000 };
const log = [];
const counts = [2,4,1,0,3,5,2,6,3,0,1,4,2,3,5,1,2,4,3,2];
for (let i = 20; i >= 1; i--) { const c = counts[20 - i]; log.push({ day: day(now - i * 86400000), done: c, coins: c * 15 }); }
const data = { version: 2, notes: [note], settings: { mascotEnabled: true, mascotIdle: true, sound: false, glass: false, startup: false, allHidden: false },
  game: { settings: { enabled: process.env.GAME_OFF ? false : true }, stats: { energy: 72, mood: 64, affection: 12, candy: 100, exp: 380, streak: { count: 6, lastDay: day(now - 86400000) } }, log } };
fs.writeFileSync(path.join(dir, 'mochi-data.json'), JSON.stringify(data));
