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
// Hợp đồng chi tiết: docs/rooms/notes/API.md
const send = (c, ...a) => ipcRenderer.send(c, ...a);
api.alarms = {
  list: () => inv('alarm:list'),                         // -> {alarms, missed, settings, sounds}
  create: a => inv('alarm:create', a || {}),             // Alarm một phần -> Alarm
  update: (id, patch) => inv('alarm:update', id, patch || {}), // -> Alarm | null
  remove: id => inv('alarm:delete', id),                 // -> boolean
  toggle: (id, on) => inv('alarm:toggle', id, !!on),     // -> Alarm | null
  test: id => inv('alarm:test', id),                     // kêu thử ngay -> boolean
  stop: id => inv('alarm:stop', id),                     // tắt chuông đang kêu
  snooze: (id, minutes) => inv('alarm:snooze', id, minutes), // hoãn
  pickSound: () => inv('alarm:pickSound'),               // -> {soundFile, name} | null
  soundData: soundFile => inv('alarm:soundData', soundFile), // -> {mime, base64} | null
  clearMissed: () => inv('alarm:clearMissed'),
  setSettings: patch => inv('alarm:settings', patch || {}),  // -> settings
  devHint: () => inv('alarm:devHint'),                   // -> {tab?:string} (chỉ dùng khi chạy thử)
  insight: v => inv('notes2:insight', v),                // noteId | text -> InsightView | null (API2.md mục 4)
  applySuggestion: (noteId, suggestionId) => inv('notes2:applySuggestion', noteId, suggestionId), // -> {ok, message, note?, notes?, alarm?, copied?}
  quickCapture: text => inv('notes2:quickCapture', text), // -> {ok, note, insight, reply} | {ok:false, message}
  onChanged: cb => on('alarm:changed', cb),              // cb({alarms, missed, settings, sounds})
  onRing: cb => on('alarm:ring', cb),                    // (cửa sổ chuông) cb(RingInfo)
  onRingEnd: cb => on('alarm:ringEnd', cb),              // (cửa sổ chuông) cb({alarmId})
  ringReady: () => send('alarm:ringReady')
};
api.memos = {
  list: () => inv('memo:list'),                          // -> {memos, settings}
  create: m => inv('memo:create', m || {}),              // -> Memo
  update: (id, patch) => inv('memo:update', id, patch || {}), // -> Memo | null
  remove: id => inv('memo:delete', id),                  // -> boolean
  test: id => inv('memo:test', id),                      // hiện thử ngay
  ack: ids => inv('memo:ack', ids || []),                // người dùng bấm "Nhớ rồi"
  quitNow: () => inv('memo:quitNow'),                    // từ popup "trước khi tắt máy": thoát hẳn
  onChanged: cb => on('memo:changed', cb),               // cb({memos, settings})
  onShow: cb => on('memo:show', cb),                     // (popup) cb({items:[{memoId,text,when}], quitting:boolean})
  popupReady: () => send('memo:popupReady')
};
api.notes2 = {
  getMeta: id => inv('notes2:getMeta', id),              // -> {repeat, zoom, locked}
  setView: (id, patch) => inv('notes2:setView', id, patch || {}), // {zoom?, locked?} -> meta
  setRepeat: (id, repeat, reminderId) => inv('notes2:setRepeat', id, repeat, reminderId), // Repeat | null (reminderId tuỳ chọn) -> Note
  setReminderItem: (id, reminderId, r) => inv('notes2:setReminderItem', id, reminderId || null, r), // r:{due,lead?,repeat?,title?,key?,auto?}; reminderId null = thêm -> Note | null
  removeReminderItem: (id, reminderId) => inv('notes2:removeReminderItem', id, reminderId), // -> Note | null
  doneItem: (id, reminderId) => inv('notes2:doneItem', id, reminderId), // báo xong một nhắc -> Note | null
  snoozeItem: (id, reminderId, minutes) => inv('notes2:snoozeItem', id, reminderId, minutes), // hoãn một nhắc -> Note | null
  onListTab: cb => on('list:tab', cb),                   // cb(tab) — điều hành gửi tới cửa sổ danh sách
  onMeta: cb => on('notes2:meta', cb),                   // (cửa sổ note) cb({id, repeat, zoom, locked})
  exportAll: format => inv('notes2:export', format),     // 'json'|'txt'|'md' -> {ok, path?, count?}
  exportNote: (id, format) => inv('notes2:exportNote', id, format), // 'txt'|'md' -> {ok, path?}
  importFile: () => inv('notes2:import'),                // -> {ok, count, errors?}
  listBackups: () => inv('notes2:backups'),              // -> [{file, day, size, noteCount}]
  readBackup: file => inv('notes2:readBackup', file),    // -> {notes:[{id,title,updatedAt,exists,same}]} | null
  restoreBackup: (file, ids) => inv('notes2:restore', file, ids || null), // -> {ok, restored}
  trashList: () => inv('notes2:trashList'),              // -> [{id,title,text,color,trashedAt,expiresAt}] mới nhất trước
  trashRestore: id => inv('notes2:trashRestore', id),    // -> Note | null
  trashPurge: id => inv('notes2:trashPurge', id),        // xoá hẳn một note -> boolean
  trashEmpty: () => inv('notes2:trashEmpty'),            // dọn sạch thùng -> số note đã xoá
  onTrashChanged: cb => on('notes2:trashChanged', cb),   // cb(trashList)
  expired: () => inv('notes2:expired')                   // -> [{noteId, reason:'done'|'overdue'|'checklist', title}]
};
// ===== HẾT PHÒNG notes =====
// ===== BẮT ĐẦU PHÒNG core (kênh 'pet:*') =====
api.pet = {
  onCmd: cb => on('pet:cmd', cb),                                  // cb(cmd) — xem docs/rooms/core/ARCH.md
  send: (type, data) => ipcRenderer.send('pet:msg', String(type), data === undefined ? {} : data),
  ignore: v => ipcRenderer.send('pet:ignore', !!v)                 // true = click xuyên qua
};
// ===== HẾT PHÒNG core =====
// ===== BẮT ĐẦU PHÒNG game (kênh 'game:*') =====
api.game = {
  state: () => inv('game:state'),                 // -> View
  catalog: () => inv('game:catalog'),
  setEnabled: on => inv('game:setEnabled', !!on),
  wear: (slot, itemId) => inv('game:wear', slot, itemId),   // itemId null = cởi
  saveOutfit: name => inv('game:saveOutfit', name),
  applyOutfit: id => inv('game:applyOutfit', id),
  deleteOutfit: id => inv('game:deleteOutfit', id),
  pull: count => inv('game:pull', count),         // 1 | 10
  exchange: itemId => inv('game:exchange', itemId),
  buyFeed: foodId => inv('game:feed', foodId),    // mua + cho ăn ngay
  claim: questId => inv('game:claim', questId),
  close: () => inv('game:close'),
  onChanged: cb => on('game:changed', cb),        // cb(View)
  onTab: cb => on('game:tab', cb)                 // cb('wardrobe'|'gacha'|'shop'|'quests'|'stats')
};
// ===== HẾT PHÒNG game =====
// ===== BẮT ĐẦU PHÒNG paper (kênh 'paper:*') =====
api.paper = {
  get: id => inv('paper:get', id),                        // -> {meta, settings}
  set: (id, patch) => inv('paper:set', id, patch),        // patch NotePaper (null = xoá khoá) -> meta
  settings: patch => inv('paper:settings', patch || {}),  // -> settings
  resize: (id, size) => inv('paper:resize', id, size),    // {width,height} -> boolean
  checkItem: (id, index, done) => inv('paper:checkItem', id, index, !!done),
  onMeta: cb => on('paper:meta', cb),                     // cb({id, meta})
  onSettings: cb => on('paper:settings', cb)              // cb(settings)
};
// ===== HẾT PHÒNG paper =====
// ===== BẮT ĐẦU PHÒNG persona (kênh 'persona:*') =====
api.persona = {};
// ===== HẾT PHÒNG persona =====

contextBridge.exposeInMainWorld('mochi', api);

