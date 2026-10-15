'use strict';
// Quyết định có "gõ cửa" cửa sổ đang dùng hay không. Xem docs/rooms/core/ARCH.md mục K.
// createKnock(core, { foreground?, screen?, now? }) -> { target(), allowed(), stop() }
const MIN_GAP_MS = 15 * 60000;
const MIN_W = 200, MIN_H = 150;

function clampToWork(rect, work) {
  const x1 = Math.max(rect.x, work.x), y1 = Math.max(rect.y, work.y);
  const x2 = Math.min(rect.x + rect.width, work.x + work.width);
  const y2 = Math.min(rect.y + rect.height, work.y + work.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: Math.round(x1), y: Math.round(y1), width: Math.round(x2 - x1), height: Math.round(y2 - y1) };
}

function createKnock(core, opts) {
  opts = opts || {};
  const ctx = core.ctx;
  const now = opts.now || Date.now;
  let fg = opts.foreground || null;
  let lastKnock = 0, idle = false;

  function getFg() {
    if (fg) return fg;
    try { fg = require('./foreground.js').createForeground(); } catch (e) { console.error('[knock] foreground', e && e.message); }
    return fg;
  }
  function getScreen() {
    if (opts.screen) return opts.screen;
    try { return require('electron').screen; } catch (_) { return null; }
  }

  const bus = ctx && ctx.bus;
  if (bus && bus.on) {
    bus.on('app:idle', () => { idle = true; });
    bus.on('app:resume', () => { idle = false; });
  }

  function allowed() {
    try {
      const s = (core.box && core.box.settings) || {};
      if (s.knockEnabled === false) return false;
      if (s.alwaysVisible === false) return false;
      if (ctx.settings && ctx.settings().mascotEnabled === false) return false;
      if (idle) return false;
      if (process.env.MOCHI_KNOCK_NOLIMIT !== '1' && lastKnock && now() - lastKnock < MIN_GAP_MS) return false;
      return true;
    } catch (_) { return false; }
  }

  async function target() {
    try {
      if (!allowed()) return null;
      const f = getFg();
      if (!f) return null;
      const r = await f.get();
      if (!r || !r.rect) return null;
      if (r.fullscreen || r.ownPid || r.iconic) return null;
      const rc = r.rect;
      if (![rc.x, rc.y, rc.width, rc.height].every(v => typeof v === 'number' && isFinite(v))) return null;
      if (rc.width < MIN_W || rc.height < MIN_H) return null;
      let rect = rc;
      const sc = getScreen();
      if (sc && typeof sc.getDisplayMatching === 'function') {
        const d = sc.getDisplayMatching(rc);
        if (d && d.workArea) rect = clampToWork(rc, d.workArea);
      }
      if (!rect || rect.width < MIN_W || rect.height < MIN_H) return null;
      if (!allowed()) return null; // trạng thái có thể đổi trong lúc chờ
      lastKnock = now();
      return { rect, title: r.title || '' };
    } catch (_) { return null; }
  }

  function stop() { try { if (fg && fg.stop && !opts.foreground) fg.stop(); } catch (_) {} }

  return { target, allowed, stop };
}

module.exports = { createKnock };
