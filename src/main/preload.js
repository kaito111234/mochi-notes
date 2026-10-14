// Cầu nối DUY NHẤT giữa renderer và main. Không sửa tên kênh: main.js đăng ký đúng các kênh này.
const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
const on = (c, cb) => { const f = (_e, d) => cb(d); ipcRenderer.on(c, f); return () => ipcRenderer.removeListener(c, f); };

const api = {
  platform: process.platform,

  // ---- note ----
  getNote: id => inv('note:get', id),                 // -> Note | null
  listNotes: () => inv('note:list'),                  // -> Note[]
  createNote: (opts) => inv('note:create', opts || {}),// opts: {color?, html?, nearId?} -> Note (mở cửa sổ mới)
  updateNote: (id, patch) => inv('note:update', id, patch), // patch: {html?, text?, color?} -> Note (main tự tính lại reminder)
  deleteNote: id => inv('note:delete', id),           // xoá hẳn + đóng cửa sổ
  showNote: id => inv('note:show', id),               // visible=true, mở/focus cửa sổ
  hideNote: id => inv('note:hide', id),               // visible=false, đóng cửa sổ (vẫn nhắc)
  setAlwaysOnTop: (id, v) => inv('note:top', id, v),  // -> Note
  setReminder: (id, r) => inv('note:reminder', id, r),// r: {due:number, lead:number} | null -> Note (auto=false)
  markDone: id => inv('note:done', id),               // reminder.done = true -> Note
  snooze: (id, minutes) => inv('note:snooze', id, minutes || 10), // -> Note
  hideAll: () => inv('notes:hideAll'),
  showAll: () => inv('notes:showAll'),
  openList: () => inv('list:open'),

  // ---- cài đặt ----
  getSettings: () => inv('settings:get'),
  setSettings: patch => inv('settings:set', patch),   // -> Settings

  // ---- sự kiện từ main ----
  onNoteUpdated: cb => on('note:updated', cb),        // cb(Note) — gửi tới cửa sổ của chính note đó
  onNotesChanged: cb => on('notes:changed', cb),      // cb(Note[]) — gửi tới cửa sổ danh sách
  onSettingsChanged: cb => on('settings:changed', cb),// cb(Settings) — gửi tới mọi cửa sổ

  // ---- cửa sổ hiện tại ----
  closeWindow: () => inv('win:close'),                // note: = hideNote; list: đóng

  // ---- bé Mochi ----
  onMascotEvent: cb => on('mascot:event', cb),        // cb(MascotEvent)
  mascotAction: (action, noteId) => inv('mascot:action', action, noteId), // 'done'|'snooze'|'open'|'dismiss'|'poke'
  setIgnoreMouse: v => ipcRenderer.send('mascot:ignore', !!v),
  mascotReady: () => ipcRenderer.send('mascot:ready'),
  summonMascot: () => inv('mascot:summon')
};

// Mỗi phòng CHỈ sửa trong khối của mình (giữa 2 dòng đánh dấu). Kênh IPC đặt tiền tố theo phòng.
// ===== BẮT ĐẦU PHÒNG notes (kênh 'alarm:*', 'memo:*', 'notes2:*') =====
api.alarms = {};
// ===== HẾT PHÒNG notes =====
// ===== BẮT ĐẦU PHÒNG core (kênh 'pet:*') =====
api.pet = {};
// ===== HẾT PHÒNG core =====
// ===== BẮT ĐẦU PHÒNG game (kênh 'game:*') =====
api.game = {};
// ===== HẾT PHÒNG game =====
// ===== BẮT ĐẦU PHÒNG persona (kênh 'persona:*') =====
api.persona = {};
// ===== HẾT PHÒNG persona =====

contextBridge.exposeInMainWorld('mochi', api);

