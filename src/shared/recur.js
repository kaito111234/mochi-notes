/* Mochi Notes — lặp lại (báo thức / nhắc note): hiểu câu tiếng Việt và tính lần kế tiếp.
   Thuần JS, không phụ thuộc gì. Dùng chung cho main (require) và renderer (<script src>, global window.MochiRecur).
   Mọi thời gian là GIỜ ĐỊA PHƯƠNG: sang ngày bằng new Date(y, m, d, ...), không cộng 86400000.
   Hợp đồng: docs/rooms/notes/API.md.
   Repeat = { freq: 'daily'|'weekdays'|'weekly'|'monthly'|'hourly', interval?, byDay?: number[] (0=CN), byMonthDay?, anchor? } */
(function (root) {
  const HOUR = 36e5;
  const pad = n => String(n).padStart(2, '0');
  const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const FREQS = ['daily', 'weekdays', 'weekly', 'monthly', 'hourly'];

  /* ---------- tiện ích thời gian ---------- */
  function dayKey(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseHHMM(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    return h > 23 || mi > 59 ? null : { h, mi };
  }
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const t = new Date(y, mo, d);
    return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d ? { y, m: mo, d } : null;
  }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  /** Số thứ tự ngày lịch (không bị DST làm lệch). */
  function dayNum(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5); }

  function cleanRepeat(r) {
    if (!r || typeof r !== 'object' || !FREQS.includes(r.freq)) return null;
    const iv = Number.isFinite(r.interval) && r.interval >= 1 ? Math.floor(r.interval) : 1;
    const byDay = Array.isArray(r.byDay) ? [...new Set(r.byDay.filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : [];
    const bmd = Number.isInteger(r.byMonthDay) && r.byMonthDay >= 1 && r.byMonthDay <= 31 ? r.byMonthDay : null;
    const anchor = Number.isFinite(r.anchor) ? r.anchor : null;
    return { freq: r.freq, interval: iv, byDay, byMonthDay: bmd, anchor };
  }

  /* ---------- nextOccurrence ---------- */
  /** rule = { repeat: Repeat|null, time:'HH:MM', date?:'YYYY-MM-DD' } -> epoch ms > afterMs, hoặc null. */
  function nextOccurrence(rule, afterMs) {
    if (!rule || typeof rule !== 'object' || !Number.isFinite(afterMs)) return null;
    const tm = parseHHMM(rule.time);
    const rep = rule.repeat == null ? null : cleanRepeat(rule.repeat);
    if (rule.repeat != null && !rep) return null;
    const a = new Date(afterMs);

    // Mỗi N tiếng: bước tuyệt đối theo mili giây từ anchor.
    if (rep && rep.freq === 'hourly') {
      const step = rep.interval * HOUR;
      let anchor = rep.anchor;
      if (anchor == null) anchor = tm ? new Date(a.getFullYear(), a.getMonth(), a.getDate(), tm.h, tm.mi).getTime() : afterMs;
      const k = Math.max(0, Math.floor((afterMs - anchor) / step) + 1);
      return anchor + k * step;
    }
    if (!tm) return null;

    // Một lần.
    if (!rep) {
      const dt = rule.date ? parseDate(rule.date) : null;
      if (rule.date && !dt) return null;
      if (dt) {
        const t = new Date(dt.y, dt.m, dt.d, tm.h, tm.mi, 0, 0).getTime();
        return t > afterMs ? t : null;
      }
      const y = a.getFullYear(), m = a.getMonth(), d = a.getDate();
      const t = new Date(y, m, d, tm.h, tm.mi, 0, 0).getTime();
      return t > afterMs ? t : new Date(y, m, d + 1, tm.h, tm.mi, 0, 0).getTime();
    }

    // Lặp theo ngày lịch. Bắt đầu quét từ ngày của afterMs (hoặc rule.date nếu muộn hơn).
    let sy = a.getFullYear(), sm = a.getMonth(), sd = a.getDate();
    const dt = rule.date ? parseDate(rule.date) : null;
    if (dt && dayNum(dt.y, dt.m, dt.d) > dayNum(sy, sm, sd)) { sy = dt.y; sm = dt.m; sd = dt.d; }
    const ad = rep.anchor != null ? new Date(rep.anchor) : new Date(sy, sm, sd);
    const ay = ad.getFullYear(), am = ad.getMonth(), aday = ad.getDate();
    const anchorN = dayNum(ay, am, aday);
    const anchorMon = anchorN - ((ad.getDay() + 6) % 7);
    const iv = rep.interval;
    const byDay = rep.byDay.length ? rep.byDay : [ad.getDay()];
    const bmd = rep.byMonthDay || aday;

    for (let i = 0; i < 4000; i++) {
      const c = new Date(sy, sm, sd + i);
      const cy = c.getFullYear(), cm = c.getMonth(), cd = c.getDate(), dow = c.getDay();
      const n = dayNum(cy, cm, cd);
      if (iv > 1 && rep.freq !== 'weekdays' && n < anchorN) continue;
      let ok = false;
      switch (rep.freq) {
        case 'daily': ok = iv === 1 || (n - anchorN) % iv === 0; break;
        case 'weekdays': ok = dow >= 1 && dow <= 5; break;
        case 'weekly': {
          if (!byDay.includes(dow)) break;
          const mon = n - ((dow + 6) % 7);
          ok = iv === 1 || ((mon - anchorMon) / 7) % iv === 0;
          break;
        }
        case 'monthly': {
          if (cd !== Math.min(bmd, daysInMonth(cy, cm))) break;
          ok = iv === 1 || ((cy * 12 + cm) - (ay * 12 + am)) % iv === 0;
          break;
        }
      }
      if (!ok) continue;
      const t = new Date(cy, cm, cd, tm.h, tm.mi, 0, 0).getTime();
      if (t > afterMs) return t;
    }
    return null;
  }

  /** Lần kế tiếp của một báo thức. enabled=false -> null. Thiếu anchor mà interval>1 thì lấy createdAt. */
  function alarmNextAt(alarm, now) {
    if (!alarm || alarm.enabled === false) return null;
    let repeat = alarm.repeat || null;
    if (repeat && repeat.anchor == null) {
      // thiếu byMonthDay/byDay thì ngày gốc lấy từ date || createdAt (không trôi theo afterMs: 31/1 -> 28/2 -> 28/3...)
      const missing = (repeat.freq === 'monthly' && !Number.isInteger(repeat.byMonthDay)) ||
        (repeat.freq === 'weekly' && !(Array.isArray(repeat.byDay) && repeat.byDay.length));
      let anchor = null;
      if (missing) {
        const dt = alarm.date ? parseDate(alarm.date) : null;
        if (dt) anchor = new Date(dt.y, dt.m, dt.d, 12).getTime();
      }
      if (anchor == null && Number.isFinite(alarm.createdAt) && (missing || repeat.interval > 1 || repeat.freq === 'hourly')) anchor = alarm.createdAt;
      if (anchor != null) repeat = Object.assign({}, repeat, { anchor });
    }
    return nextOccurrence({ repeat, time: alarm.time, date: alarm.date }, now);
  }

  /** 'wait' (chưa tới) | 'ring' (trễ <= graceMs, vẫn đổ chuông) | 'missed' (lỡ). */
  function catchUp(nextAt, now, graceMs) {
    if (!Number.isFinite(nextAt) || nextAt > now) return 'wait';
    return now - nextAt <= (Number.isFinite(graceMs) ? graceMs : 0) ? 'ring' : 'missed';
  }

  /* ---------- mô tả ---------- */
  const dayLabel = d => (d === 0 ? 'CN' : String(d + 1));
  function describeRepeat(repeat) {
    const r = cleanRepeat(repeat);
    if (!r) return 'Một lần';
    const iv = r.interval;
    switch (r.freq) {
      case 'daily': return iv > 1 ? 'Mỗi ' + iv + ' ngày' : 'Hằng ngày';
      case 'weekdays': return 'Ngày thường (T2–T6)';
      case 'hourly': return iv > 1 ? 'Mỗi ' + iv + ' tiếng' : 'Mỗi tiếng';
      case 'monthly': {
        const base = r.byMonthDay ? 'Ngày ' + r.byMonthDay : '';
        if (iv > 1) return (base ? base + ', mỗi ' : 'Mỗi ') + iv + ' tháng';
        return base ? base + ' hằng tháng' : 'Hằng tháng';
      }
      case 'weekly': {
        const days = r.byDay.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)); // T2 đứng đầu, CN cuối
        let s;
        if (!days.length) s = iv > 1 ? '' : 'Hằng tuần';
        else if (days.length === 1) s = days[0] === 0 ? 'Chủ nhật' : 'Thứ ' + (days[0] + 1);
        else s = 'Thứ ' + days.map(dayLabel).join(', ');
        if (iv > 1) return 'Mỗi ' + iv + ' tuần' + (s ? ', ' + s.charAt(0).toLowerCase() + s.slice(1) : '');
        if (days.length === 1) return s + ' hằng tuần';
        return s;
      }
    }
    return 'Một lần';
  }

  /* ---------- parseRecur: hiểu tiếng Việt ---------- */
  function strip(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[.;!?()"“”']/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const WORDNUM = { hai: 2, ba: 3, tu: 4, bon: 4, nam: 5, sau: 6, bay: 7 };
  const DAYWORD = '(?:hai|ba|tu|bon|nam|sau|bay|[2-7])';
  const DAY_START = new RegExp('(?:\\bthu\\s*(' + DAYWORD + ')|\\bt([2-7])|\\b(chu nhat)|\\b(cn))(?![a-z0-9:])', 'g');
  const DAY_CONT = new RegExp(
    '\\s*(,|va|voi|->|-|den)?\\s*(?:thu\\s*(' + DAYWORD + ')|t([2-7])|(chu nhat|cn)|(hai|ba|tu|bon|nam|sau|bay)|([2-7]))' +
    '(?![a-z0-9:])(?!\\s*(?:h|g|gio|phut|tieng|tuan|ngay|thang)(?![a-z]))', 'y');

  /** Lấy các thứ trong tuần: { days:Set<0..6> } hoặc null. 0=CN. */
  function parseDays(s) {
    DAY_START.lastIndex = 0;
    const m = DAY_START.exec(s);
    if (!m) return null;
    const val = mm => {
      if (mm[1]) return /^\d$/.test(mm[1]) ? +mm[1] - 1 : WORDNUM[mm[1]] - 1;
      if (mm[2]) return +mm[2] - 1;
      return 0; // chủ nhật / cn
    };
    const days = new Set();
    let prev = val(m);
    days.add(prev % 7);
    DAY_CONT.lastIndex = m.index + m[0].length;
    for (;;) {
      const c = DAY_CONT.exec(s);
      if (!c) break;
      const sep = c[1];
      let v;
      if (c[2]) v = /^\d$/.test(c[2]) ? +c[2] - 1 : WORDNUM[c[2]] - 1;
      else if (c[3]) v = +c[3] - 1;
      else if (c[4]) v = 0;
      else if (c[5]) { if (!sep) break; v = WORDNUM[c[5]] - 1; }
      else v = +c[6] - 1;
      if (sep === '-' || sep === '->' || sep === 'den') {
        // khoảng: từ prev đến v (T2..T7, CN = 7 ở cuối tuần)
        let a = prev === 0 ? 7 : prev, b = v === 0 ? 7 : v;
        if (b < a) b += 7;
        for (let x = a; x <= b; x++) days.add(x % 7);
      } else days.add(v % 7);
      prev = v;
    }
    return { days };
  }

  const PERIOD_ACC = /(sáng|trưa|chiều|tối|đêm|khuya)/;
  const PERIOD_ASCII = /\b(sang|trua|chieu|toi|dem|khuya)\b/;
  const PERIOD_KEY = { 'sáng': 'sang', 'trưa': 'trua', 'chiều': 'chieu', 'tối': 'toi', 'đêm': 'dem', khuya: 'khuya' };
  function findPeriod(lower, s) {
    let m = PERIOD_ACC.exec(lower);
    if (m) return PERIOD_KEY[m[1]];
    // Không dấu: loại "nhắc tôi", "tuần tới"... trước khi tìm.
    if (!/[^\x00-\x7f]/.test(lower)) {
      const t = s.replace(/\b(nhac|bao|goi|cho|giup|de|nho) toi\b/g, ' ').replace(/\b(tuan|thang|nam|lan|hom|buoi) toi\b/g, ' ');
      m = PERIOD_ASCII.exec(t);
      if (m) return m[1];
    }
    return null;
  }
  const PERIOD_DEFAULT = { sang: [8, 0], trua: [12, 0], chieu: [15, 0], toi: [20, 0], dem: [22, 0], khuya: [23, 0] };
  const TIME_RE = /(?<![\d:])(\d{1,2})\s*(?:h(?![a-z])(\d{2})?|gio(?![a-z])(?:\s*(\d{2})(?!\d))?|:(\d{2}))/;

  function parseTimeOfDay(lower, s) {
    const period = findPeriod(lower, s);
    const m = TIME_RE.exec(s);
    if (m) {
      let h = +m[1];
      let mi = m[2] != null ? +m[2] : m[3] != null ? +m[3] : m[4] != null ? +m[4] : (/\bruoi\b/.test(s) ? 30 : 0);
      if (h <= 23 && mi <= 59) {
        if (period === 'chieu' || period === 'toi') { if (h < 12) h += 12; }
        else if (period === 'trua') { if (h <= 4) h += 12; }
        else if (period === 'dem' || period === 'khuya') { if (h === 12) h = 0; else if (h >= 6 && h < 12) h += 12; }
        return pad(h) + ':' + pad(mi);
      }
    }
    if (period) { const d = PERIOD_DEFAULT[period]; return pad(d[0]) + ':' + pad(d[1]); }
    return null;
  }

  const NUMW = { hai: 2, ba: 3, bon: 4, nam: 5 };
  const numOf = w => (/^\d+$/.test(w) ? +w : NUMW[w] || 1);

  /** Hiểu câu lặp tiếng Việt -> { repeat, time:'HH:MM'|null } | null (không có ý lặp). */
  function parseRecur(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const lower = text.toLowerCase();
    const s = strip(text);
    const marker = /\b(moi|hang|hau)\b/.test(s);

    // Mỗi N tiếng (phút thì bỏ qua -> null).
    if (/\bmoi\s*(?:\d+\s*)?(?:phut|p)\b/.test(s)) return null;
    let m = /\bmoi\s*(\d+)?\s*(?:tieng|gio)\b(?!\s*(?:sang|trua|chieu|toi|dem|khuya))/.exec(s);
    if (m) { const n = m[1] ? +m[1] : 1; return n >= 1 ? { repeat: n > 1 ? { freq: 'hourly', interval: n } : { freq: 'hourly' }, time: null } : null; }

    const time = parseTimeOfDay(lower, s);
    const mk = (repeat) => ({ repeat, time });

    // Chu kỳ "mỗi N ngày/tuần/tháng" hoặc "N ngày/tuần/tháng một lần".
    let iv = 1, unit = null;
    m = /\bmoi\s*(\d+|hai|ba|bon|nam)\s*(ngay|tuan|thang)\b/.exec(s) || /\b(\d+|hai|ba|bon)\s*(ngay|tuan|thang)\s*(?:mot|1)\s*lan\b/.exec(s);
    if (m) { iv = numOf(m[1]); unit = m[2]; }
    const withIv = o => (iv > 1 ? Object.assign(o, { interval: iv }) : o);

    // Hằng tháng: "ngày 5 hằng tháng", "mùng 5 mỗi tháng", "cuối tháng hằng tháng".
    const monthMarker = /\b(?:moi|hang|hau)\s*(?:\d+\s*|hai\s*)?thang\b|\bthang\s*mot\s*lan\b/.test(s) || unit === 'thang';
    if (monthMarker) {
      const d = /\b(?:ngay|mung|mong)\s*(\d{1,2})\b/.exec(s);
      let bmd = d ? +d[1] : /\bcuoi thang\b/.test(s) ? 31 : null;
      if (bmd >= 1 && bmd <= 31) return mk(withIv({ freq: 'monthly', byMonthDay: bmd }));
      return null;
    }

    const dd = parseDays(s);
    const futureWord = /\btuan (sau|toi|nay|truoc)\b/.test(s);

    // Ngày thường.
    if (/\bngay thuong\b|\bngay lam viec\b|\b(?:cac )?ngay trong tuan\b/.test(s)) return mk({ freq: 'weekdays' });

    if (dd) {
      const days = [...dd.days].sort((x, y) => x - y);
      const explicit = marker || unit === 'tuan' || days.length >= 2;
      if (explicit && !(futureWord && !marker && unit !== 'tuan')) {
        if (days.length === 7) return mk({ freq: 'daily' });
        if (days.join() === '1,2,3,4,5') return mk({ freq: 'weekdays' });
        return mk(withIv({ freq: 'weekly', byDay: days }));
      }
      return null;
    }

    if (unit === 'ngay' && iv > 1) return mk({ freq: 'daily', interval: iv });
    if (unit === 'tuan' && iv > 1) return mk({ freq: 'weekly', interval: iv });
    if (marker && /\bcuoi tuan\b/.test(s)) return mk({ freq: 'weekly', byDay: [0, 6] });
    if (/\b(?:moi|hang|hau)\s*tuan\b|\btuan mot lan\b/.test(s)) return mk({ freq: 'weekly' });
    if (/\b(?:moi|hang|hau)\s*(?:ngay|sang|trua|chieu|toi|dem|khuya)\b|\bngay nao cung\b|\bmoi\s*(?:1\s*)?ngay\b/.test(s)) return mk({ freq: 'daily' });
    return null;
  }

  const api = { parseRecur, nextOccurrence, alarmNextAt, catchUp, describeRepeat, dayKey, WEEKDAY_SHORT, parseHHMM, daysInMonth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiRecur = api;
})(typeof window !== 'undefined' ? window : globalThis);
