'use strict';
// Điểm vào module main của phòng notes (main.js tự nạp file này sau các module note 0.1).
// Nạp lần lượt các phần mở rộng; mỗi phần xuất init(ctx). Lỗi ở một phần không làm hỏng phần khác.
const { ipcMain } = require('electron');
const { getBox } = require('./box.js');

const PARTS = [
  './alarmService.js',          // báo thức: CRUD, hẹn giờ, chuông, hoãn, bù khi máy ngủ dậy
  './memoService.js',           // dặn dò: startup / sáng / trưa / tối / trước khi tắt máy
  '../notes/noteRepeat.js',     // nhắc lặp cho note (reminder.repeat)
  '../notes/noteView.js',       // cỡ chữ, khoá chỉ đọc của từng note
  '../notes/dataTransfer.js'    // nhập/xuất, khôi phục từ bản sao lưu
];

function init(ctx) {
  getBox(ctx); // đăng ký ngăn 'alarms' một lần, đúng normalize
  ctx.alarms = ctx.alarms || {};
  for (const p of PARTS) {
    let mod;
    try { mod = require(p); } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(p.replace(/^\.+\//, ''))) continue;
      console.error('[notes] không nạp được', p, e); continue;
    }
    try { mod.init(ctx); } catch (e) { console.error('[notes] lỗi init', p, e); }
  }
  // Gợi ý cho giao diện khi chạy thử (vd MOCHI_DEV_TAB=alarms để mở sẵn tab báo thức).
  ipcMain.handle('alarm:devHint', () => ({ tab: process.env.MOCHI_DEV_TAB || '' }));
}

module.exports = { init };
