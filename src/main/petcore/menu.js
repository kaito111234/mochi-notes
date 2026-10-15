'use strict';
// Menu chuột phải trên bé (Menu gốc của Electron).
const { Menu } = require('electron');

function createMenu(core) {
  const { ctx } = core;
  const safe = fn => () => { try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(e => console.error('[petcore] menu', e && e.message)); } catch (e) { console.error('[petcore] menu', e && e.message); } };
  const rebuildTray = () => { try { if (ctx.tray && typeof ctx.tray.rebuild === 'function') ctx.tray.rebuild(); } catch (_) { /* bỏ qua */ } };
  const setPet = patch => { ctx.pet.setSettings(patch); rebuildTray(); };

  function tidyExpired() {
    const list = (ctx.notes && typeof ctx.notes.expiredCandidates === 'function' ? ctx.notes.expiredCandidates() : []) || [];
    const st = ctx.pet.stage;
    if (!list.length || !st || typeof st.request !== 'function') {
      core.actor.say('Không có note nào cần dọn cả.', { ttlMs: 5000 });
      return;
    }
    for (const c of list.slice(0, 3)) {
      st.request({ kind: 'tidy', priority: 35, payload: { noteId: c.noteId, reason: c.reason, title: c.title }, ttlMs: 30 * 60000 });
    }
  }

  function popup() {
    const s = core.box.settings;
    const t = [
      { label: 'Phòng của Mochi', click: safe(() => ctx.game && typeof ctx.game.open === 'function' && ctx.game.open()) },
      { label: 'Ghi nhanh', click: safe(() => core.capture && core.capture.open()) },
      { label: 'Note mới', click: safe(() => ctx.notes.createNote({})) },
      { label: 'Danh sách note', click: safe(() => ctx.list.open()) },
      { label: 'Báo thức…', click: safe(() => ctx.list.open('alarms')) },
      { label: 'Ẩn/hiện tất cả note', click: safe(() => ctx.notes.toggleAll()) },
      { label: 'Dọn note hết hạn…', click: safe(tidyExpired) },
      { type: 'separator' },
      { label: 'Cho bé ngủ', click: safe(() => core.brain && core.brain.sleep()) },
      { label: 'Ẩn bé 1 giờ', click: safe(() => ctx.pet.hideFor(3600000)) },
      { label: 'Bé đi lại', type: 'checkbox', checked: s.walkEnabled !== false, click: item => safe(() => setPet({ walkEnabled: item.checked }))() },
      { label: 'Cỡ bé', submenu: [0.75, 1, 1.25].map(v => ({
        label: Math.round(v * 100) + '%', type: 'radio', checked: Math.abs((s.scale || 1) - v) < 0.01, click: safe(() => setPet({ scale: v }))
      })) }
    ];
    if (core.settingsWin && typeof core.settingsWin.open === 'function') {
      t.push({ label: 'Cài đặt bé…', click: safe(() => core.settingsWin.open()) });
    }
    const w = core.window.win();
    const m = Menu.buildFromTemplate(t);
    if (w) m.popup({ window: w }); else m.popup();
  }
  return { popup };
}

module.exports = { createMenu };
