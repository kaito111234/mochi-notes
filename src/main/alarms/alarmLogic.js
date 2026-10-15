'use strict';
// Logic THUẦN của báo thức (không electron, không IO) để test bằng node.
// recur được tiêm vào (mặc định src/shared/recur.js) để test có thể dùng bản giả.

const MISSED_MAX = 50;

function getRecur() { return require('../../shared/recur.js'); }

/**
 * Quyết định cho một báo thức tại thời điểm now.
 * -> { action: 'none'|'ring'|'missed', fire: boolean, nextAt: number|null, enabled: boolean, clearSnooze: boolean }
 * Quy tắc: kêu/lỡ xong thì lặp -> nextAt = lần kế > now; một lần -> enabled=false, nextAt=null.
 * Một nextAt chỉ cho ra 'ring'/'missed' MỘT lần vì kết quả luôn dời nextAt đi.
 */
function decide(alarm, now, settings, recur) {
  const R = recur || getRecur();
  const keep = { action: 'none', nextAt: alarm.nextAt == null ? null : alarm.nextAt, enabled: alarm.enabled !== false, clearSnooze: false };
  if (!keep.enabled) return Object.assign(keep, { nextAt: null });
  if (alarm.nextAt == null) {
    // thiếu nextAt (vd mới nạp) -> tính lại, không kêu
    return Object.assign(keep, { nextAt: R.alarmNextAt(alarm, now) });
  }
  const graceMs = Math.max(0, (settings && settings.missedGraceMin != null ? settings.missedGraceMin : 30)) * 60000;
  const c = R.catchUp(alarm.nextAt, now, graceMs);
  if (c === 'wait') return keep;
  let nextAt = null, enabled = false;
  if (alarm.repeat) {
    nextAt = R.alarmNextAt(Object.assign({}, alarm, { enabled: true }), now);
    enabled = nextAt != null;
  }
  return { action: c === 'ring' ? 'ring' : 'missed', nextAt, enabled, clearSnooze: true };
}

/** Thêm một bản ghi lỡ, giữ tối đa MISSED_MAX (cái mới nhất). */
function pushMissed(missed, rec) {
  missed.push({ alarmId: rec.alarmId, label: rec.label || '', at: rec.at });
  while (missed.length > MISSED_MAX) missed.shift();
  return missed;
}

/** Tính nextAt khi tạo/sửa/bật. Tắt -> null. */
function computeNext(alarm, now, recur) {
  const R = recur || getRecur();
  if (alarm.enabled === false) return null;
  return R.alarmNextAt(alarm, now);
}

/** Hoãn: trả bản vá cho alarm. */
function snoozePatch(now, minutes) {
  const at = now + Math.round(minutes) * 60000;
  return { snoozedUntil: at, nextAt: at, enabled: true };
}

/** Tên file an toàn cho âm tuỳ chọn. */
function safeSoundName(name) {
  const m = /^(.*?)(\.[A-Za-z0-9]{1,5})?$/.exec(String(name || 'sound'));
  const base = (m[1] || 'sound').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(0, 40) || 'sound';
  return base + (m[2] || '').toLowerCase();
}

const MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

module.exports = { decide, pushMissed, computeNext, snoozePatch, safeSoundName, MIME, MISSED_MAX };
