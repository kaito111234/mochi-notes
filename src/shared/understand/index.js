/* Mochi Notes — "hiểu note": từ một đoạn chữ tiếng Việt rút ra các việc có giờ, checklist, thực thể và gợi ý.
   Thuần JS, UMD: Node dùng require, trình duyệt dùng window.MochiUnderstand.
   Thứ tự nạp trên trình duyệt (một file duy nhất, không tách):
     shared/parse.js -> shared/recur.js -> shared/understand/entities.js -> shared/understand/index.js
   Thiếu entities thì people/places/... rỗng, priority 0, softDeadline null. Không bao giờ ném lỗi.
   Hợp đồng: docs/rooms/notes/API2.md mục 2. */
(function (root) {
  'use strict';
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const pad = n => String(n).padStart(2, '0');
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const MAX_TEXT = 20000, MAX_LINES = 1000, MAX_ITEMS = 100;

  /* ---------- nạp phụ thuộc (lười, thử lại nếu entities chưa có) ---------- */
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const tryDo = fn => { try { return fn(); } catch (e) { return null; } };
  const D = { P: null, R: null, E: null };
  function deps() {
    if (!D.P) D.P = (isNode && tryDo(() => require('../parse.js'))) || root.MochiParse || null;
    if (!D.R) D.R = (isNode && tryDo(() => require('../recur.js'))) || root.MochiRecur || null;
    if (!D.E) D.E = (isNode && tryDo(() => require('./entities.js'))) || root.MochiEntities || null;
    return D;
  }

  /* ---------- chuỗi: giữ nguyên độ dài để chỉ số khớp chuỗi gốc ---------- */
  function lower1(s) {
    let o = '';
    for (let i = 0; i < s.length; i++) { const l = s[i].toLowerCase(); o += l.length === 1 ? l : s[i]; }
    return o;
  }
  function fold1(s) {
    let o = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c.charCodeAt(0) < 128) { o += c.toLowerCase(); continue; }
      if (c === 'đ' || c === 'Đ') { o += 'd'; continue; }
      const b = c.normalize('NFD')[0];
      const l = b.toLowerCase();
      o += l.length === 1 ? l : b;
    }
    return o;
  }
  function foldLocal(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }
  function fold(s) {
    const P = deps().P;
    if (P && typeof P.fold === 'function') { const r = tryDo(() => P.fold(s)); if (typeof r === 'string') return r; }
    return foldLocal(s);
  }
  function itemKey(title) {
    const f = fold(title).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    return 'k:' + f.slice(0, 48).trim();
  }
  const nz = s => s.replace(/:(?!\d)/g, ' '); // cùng độ dài; dấu ":" cuối từ ("Mai:", "T7:") không chặn nhận dạng
  const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const sod = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const hasNonAscii = s => /[^\x00-\x7f]/.test(s);

  /* ---------- thời gian: khoảng giờ trong ngày ---------- */
  const PER_ACC = /(?<![\p{L}])(sáng|trưa|chiều|tối|đêm|khuya)(?![\p{L}])/gu;
  const PER_ASC = /(?<![a-z])(sang|trua|chieu|toi|dem|khuya)(?![a-z])/g;
  const PK = { 'sáng': 'sang', 'trưa': 'trua', 'chiều': 'chieu', 'tối': 'toi', 'đêm': 'dem', khuya: 'khuya' };
  const PERIOD_DEFAULT = { sang: [8, 0], trua: [12, 0], chieu: [15, 0], toi: [20, 0], dem: [22, 0], khuya: [23, 0] };
  const CLOCK = /(?<![a-z0-9\/.]|\d,|\d:)(\d{1,2})\s*(?:(?:h|g)(?![a-z])(\d{2}(?!\d))?|gio(?![a-z])(?:\s*(\d{2})(?!\d))?|:(\d{2})(?!\d))/g;
  const REL = /(?<![a-z0-9])(?<!thu\s*)(\d+)\s*(giay|phut|ph|p|tieng|gio|h|ngay|tuan)\s*(nua|sau|toi)(?![a-z])/;
  const SPECIAL = /(?<![a-z])nua\s*(?:tieng|gio)\s*nua|(?<![a-z0-9.,:\/])\d{1,2}\s*(?:h|g|gio)\s*\d{2}\s*nua|(?<![a-z])trong\s*\d+\s*(?:giay|phut|ph|p)|(?<![a-z])nua\s*dem(?![a-z])|(?<![a-z0-9.,:\/])\d{1,2}\.\d{2}(?![\d]|[.,]\d)|(?<![a-z0-9.,:\/\-])\d{1,2}\s*-\s*\d{1,2}(?:\s*-\s*\d{2,4})?\s+(?:luc\s+|vao\s+)?\d{1,2}\s*(?:h|g|gio|:)/;
  const SLASH = /(?<![\d\/.])\d{1,2}\s*\/\s*\d{1,2}(?![\d\/])/;
  const HOURLY = /(?<![a-z])moi\s*(?:\d+\s*)?(?:tieng|gio)(?![a-z])/;

  /* từ thường chứa chữ chỉ buổi: "tối ưu", "tối đa", "sáng tạo", "chiều dài/rộng/cao/sâu" */
  const PER_EXCL = { toi: /^\s+(?:uu|da|thieu)(?![a-z])/, sang: /^\s+(?:tao|kien|loc)(?![a-z])/, chieu: /^\s+(?:cao|dai|rong|sau)(?![a-z])/ };
  const perExcluded = (key, f, b) => !!(PER_EXCL[key] && PER_EXCL[key].test(f.slice(b, b + 12)));
  function findPeriods(lo, f, asc) {
    const res = [];
    let m;
    PER_ACC.lastIndex = 0;
    while ((m = PER_ACC.exec(lo))) { if (!perExcluded(PK[m[1]], f, m.index + m[0].length)) res.push({ key: PK[m[1]], a: m.index, b: m.index + m[0].length }); }
    if (asc) {
      PER_ASC.lastIndex = 0;
      while ((m = PER_ASC.exec(f))) {
        const a = m.index, pre = f.slice(Math.max(0, a - 12), a);
        if (perExcluded(m[1], f, a + m[0].length)) continue;
        if (m[1] === 'toi' && /(?:nhac|bao|goi|cho|giup|de|nho|nghe|bao) $/.test(pre)) continue;
        if (m[1] === 'dem' && !/\d\s*(?:h|g|gio)(?:\d{2})?\s*$/.test(pre)) continue;
        res.push({ key: m[1], a, b: a + m[0].length });
      }
    }
    return res;
  }

  /** {h, mi, per} hoặc null (không có giờ trong ngày). Không đoán sáng/chiều khi không có chữ chỉ buổi. */
  function ownTime(clause) {
    const lo = lower1(clause), f = fold1(clause), asc = !hasNonAscii(lo);
    const pers = findPeriods(lo, f, asc);
    const key = pers.length ? pers[0].key : null;
    let h = null, mi = 0, m;
    CLOCK.lastIndex = 0;
    while ((m = CLOCK.exec(f))) {
      const hh = +m[1];
      const mmS = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
      const mm = mmS != null ? +mmS : null;
      if (hh <= 23 && (mm == null || mm <= 59)) { h = hh; mi = mm == null ? (/(?<![a-z])ruoi(?![a-z])/.test(f) ? 30 : 0) : mm; break; }
    }
    if (h === null) {
      if (!key) return null;
      if (key === 'dem' && !/(?<![a-z])(?:nay|mai)(?![a-z])/.test(f)) return null; // "đêm" một mình (2 đêm, thức đêm, đêm qua) không phải giờ
      return { h: PERIOD_DEFAULT[key][0], mi: PERIOD_DEFAULT[key][1], per: key, clock: false };
    }
    if (key === 'chieu' || key === 'toi') { if (h < 12) h += 12; }
    else if (key === 'trua') { if (h <= 4) h += 12; }
    else if (key === 'dem' || key === 'khuya') { if (h === 12) h = 0; else if (h >= 6 && h < 12) h += 12; }
    return { h, mi, per: key, clock: true };
  }

  /* ---------- thời gian: ngày ---------- */
  const DOWV = { hai: 2, ba: 3, tu: 4, bon: 4, nam: 5, sau: 6, bay: 7 };
  const DOW_RE = /(?<![a-z0-9])(?:thu\s*(hai|ba|tu|bon|nam|sau|bay|[2-7])|t([2-7])|(chu nhat|cn))(?![a-z0-9:])/;
  /** {date: Date nửa đêm, kind, todayDow} hoặc null. f = fold1(clause), lo = lower1(clause). */
  function ownDate(f, lo, nowD) {
    const today = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
    const add = n => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
    let m;
    if ((m = /(?<![\d\/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d\/])/.exec(f)) || (m = /ngay\s*(\d{1,2})\s*thang\s*(\d{1,2})/.exec(f))) {
      const dd = +m[1], mo = +m[2];
      if (dd >= 1 && dd <= 31 && mo >= 1 && mo <= 12) {
        const y = m[3] ? (+m[3] < 100 ? 2000 + (+m[3]) : +m[3]) : today.getFullYear();
        let d = new Date(y, mo - 1, dd);
        if (d.getMonth() === mo - 1) {
          if (!m[3] && d < today) d = new Date(y + 1, mo - 1, dd);
          return { date: d, kind: 'abs', todayDow: false };
        }
      }
    }
    const weekNext = /(?<![a-z])tuan (?:sau|toi)(?![a-z])/.test(f);
    const toMon = ((8 - today.getDay()) % 7) || 7;
    if (/(?<![a-z])cuoi thang(?![a-z])/.test(f)) return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0), kind: 'abs', todayDow: false };
    m = DOW_RE.exec(f);
    if (m && m[1] === 'tu' && lo.slice(m.index, m.index + m[0].length).indexOf('tự') >= 0) m = null; // "thứ tự" != "thứ tư"
    if (m) {
      const dow = m[3] ? 0 : (m[1] ? (/^\d$/.test(m[1]) ? +m[1] : DOWV[m[1]]) : +m[2]) - 1;
      const dd = m[3] ? 0 : dow;
      if (weekNext) return { date: add(toMon + ((dd + 6) % 7)), kind: 'dow', todayDow: false };
      const d = (dd - today.getDay() + 7) % 7;
      return { date: add(d), kind: 'dow', todayDow: d === 0 };
    }
    if (weekNext) return { date: add(toMon), kind: 'rel', todayDow: false };
    if (/(?<![a-z])cuoi tuan(?![a-z])/.test(f)) return { date: add((6 - today.getDay() + 7) % 7), kind: 'rel', todayDow: false };
    if (/(?<![a-z])ngay (?:mot|kia)(?![a-z])/.test(f)) return { date: add(2), kind: 'rel', todayDow: false };
    if (/(?<![a-z0-9])(?:ngay\s*mai|ng\s*mai|ngmai|mai)(?![a-z0-9])/.test(f)) return { date: add(1), kind: 'rel', todayDow: false };
    if (/(?<![a-z])hom nay(?![a-z])|(?<![a-z])(?:sang|trua|chieu|toi|dem|khuya)\s+nay(?![a-z])/.test(f)) return { date: add(0), kind: 'today', todayDow: false };
    return null;
  }

  /* ---------- cụm thời gian (span) để bỏ khỏi tiêu đề ---------- */
  const DOWL = '(?:thu\\s*(?:hai|ba|tu|bon|nam|sau|bay|[2-7])|t[2-7]|cn|chu nhat)(?![a-z0-9:])' +
    '(?:\\s*(?:,|->|-|va|den|voi)\\s*(?:thu\\s*)?(?:[2-7]|hai|ba|tu|bon|nam|sau|bay|cn|t[2-7])(?![a-z0-9:]))*(?:\\s+nay(?![a-z]))?';
  const SPAN_RES = [
    /(?<![a-z0-9])\d+\s*(?:giay|phut|ph|p|tieng|gio|h|ngay|tuan)\s*(?:nua|sau)(?![a-z])/g,
    /(?<![a-z0-9])(?:ngay\s*)?\d{1,2}\s*thang\s*\d{1,2}(?![a-z0-9])/g,
    /(?:(?:vao\s+)?(?:ngay\s+))?(?<![\d\/])\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?![\d\/])/g,
    new RegExp('(?<![a-z0-9])' + DOWL, 'g'),
    /(?<![a-z])tuan (?:sau|toi|nay)(?![a-z])/g,
    /(?<![a-z])cuoi (?:tuan|thang)(?![a-z])/g,
    /(?<![a-z])ngay (?:mot|kia)(?![a-z])/g,
    /(?<![a-z0-9])(?:ngay\s*mai|ng\s*mai|ngmai|mai)(?![a-z0-9])/g,
    /(?<![a-z])hom nay(?![a-z])/g
  ];
  const CLOCK_SPAN = /(?<![a-z0-9\/.]|\d,|\d:)(?:(?:vao\s+)?(?:luc|khoang|tam)\s+)?(\d{1,2})\s*(?:(?:h|g)(?![a-z])(?:\d{2}(?!\d))?|gio(?![a-z])(?:\s*\d{2}(?!\d))?(?:\s*phut(?![a-z]))?|:\d{2}(?!\d))(?:\s*ruoi(?![a-z]))?/g;
  const RECUR_SPAN = /(?<![a-z])(?:(?:ngay|mung|mong)\s*\d{1,2}(?=\s*(?:moi|hang|hau)\s*thang)|(?:moi|hang|hau)\s*(?:\d+\s*)?(?:ngay|tuan|thang|tieng|gio|sang|trua|chieu|toi|dem|khuya)?|ngay thuong|ngay nao cung|(?:\d+\s*)?(?:ngay|tuan|thang)\s*(?:mot|1)\s*lan)(?![a-z])/g;

  function mergeSpans(sp, len) {
    const a = sp.filter(s => Array.isArray(s) && Number.isInteger(s[0]) && Number.isInteger(s[1]) && s[0] >= 0 && s[1] > s[0] && s[1] <= len)
      .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const out = [];
    for (const s of a) {
      const last = out[out.length - 1];
      if (last && s[0] <= last[1]) { if (s[1] > last[1]) last[1] = s[1]; } else out.push([s[0], s[1]]);
    }
    return out;
  }
  function ownSpans(clause, withRecur) {
    const lo = lower1(clause), f = fold1(nz(clause)), asc = !hasNonAscii(lo), out = [];
    const run = (re, ok) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(f))) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (!ok || ok(m)) out.push([m.index, m.index + m[0].length]);
      }
    };
    for (const re of SPAN_RES) run(re);
    run(CLOCK_SPAN, m => +m[1] <= 23);
    if (withRecur) run(RECUR_SPAN);
    for (const p of findPeriods(lo, f, asc)) {
      let a = p.a, b = p.b;
      if (f.slice(Math.max(0, a - 5), a) === 'buoi ') a -= 5;
      const nm = /^\s+nay(?![a-z])/.exec(f.slice(b, b + 8));
      if (nm) b += nm[0].length;
      out.push([a, b]);
    }
    return out;
  }
  function allSpans(clause, withRecur) {
    const sp = ownSpans(clause, withRecur);
    const P = deps().P;
    if (P && typeof P.whenSpans === 'function' && (!sp.length || SPECIAL.test(fold1(clause)))) { // gộp thêm cụm parse.js nhận ra (nửa đêm, 9.30, 20-10 ...)
      const r = tryDo(() => P.whenSpans(clause));
      if (Array.isArray(r)) for (const s of r) sp.push(s);
    }
    return mergeSpans(sp, clause.length);
  }

  /* ---------- tiêu đề ---------- */
  const LEAD = /^(?:(?:nho la|nhac nho|nhac(?:\s+(?:to|toi|minh|tui|em|anh|chi|ban|nhe|la))?|nho|vao luc|luc|vao|khoang|tam|buoi)\s+)+/;
  const TRAIL = /\s+(?:vao ngay|vao luc|luc|vao|khoang|tam|la|thi|va|roi|ngay|buoi|truoc|sau|trong|den|tai|o|cua)$/;
  const TRAIL_PART = /\s+(?:nhé|nhen|nhe|nghe|nhỉ|nha)$/; // "nha" (không dấu) chỉ bỏ khi câu có dấu, để không nuốt "nhà"
  const cap = s => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
  function cleanTitle(clause, spans) {
    let t = '', pos = 0;
    for (const [a, b] of spans) { t += clause.slice(pos, a) + ' '; pos = b; }
    t = (t + clause.slice(pos)).replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,;:.!?])/g, '$1');
    for (let i = 0; i < 8; i++) {
      const before = t;
      t = t.replace(/^[\s,;:.\-–—·|\/\\()]+/, '').replace(/[\s,;:.\-–—·|\/\\(]+$/, '');
      let f = fold1(t), m = LEAD.exec(f);
      if (m) { t = t.slice(m[0].length); f = fold1(t); }
      m = TRAIL.exec(f);
      if (m) t = t.slice(0, m.index);
      else {
        const lo = lower1(t);
        m = TRAIL_PART.exec(lo);
        if (m && (m[0].trim() !== 'nha' || hasNonAscii(lo))) t = t.slice(0, m.index);
      }
      if (t === before) break;
    }
    return t.trim();
  }
  function clip(t, n) { return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }

  /* ---------- ký hiệu đầu dòng / checklist ---------- */
  const MARK = /^\s*(?:(?:[-*•+·▪]\s*)?\[\s*([xX✓✔vV]?)\s*\]\s*|([☐☑☒✓✔✅□])\s*|[-*•+·▪]\s+|\d{1,3}[.)]\s+)/u;
  function markerOf(line) {
    const m = MARK.exec(line);
    if (!m) return null;
    const box = m[1] !== undefined || m[2] !== undefined;
    const done = (m[1] !== undefined && m[1] !== '') || (m[2] !== undefined && '☑☒✓✔✅'.indexOf(m[2]) >= 0);
    return { len: m[0].length, box, done };
  }

  /* ---------- tách mệnh đề ---------- */
  const WORD_SEP = /(?<=^|\s)(?:và|va|rồi|roi|rùi|xong|sau đó|sau do)(?=\s|$)/giu;
  const FILL = new Set(['luc', 'vao', 'khoang', 'la', 'thi', 'nhe', 'nha', 'ngay', 'buoi', 'nay', 'va', 'roi']);
  function hasTimeWord(part) {
    if (ownTime(part)) return true;
    const f = fold1(part), lo = lower1(part);
    if (HOURLY.test(f)) return true;
    const m = REL.exec(f);
    return !!(m && /^(?:giay|phut|ph|p|tieng|gio|h)$/.test(m[2]) && (m[3] !== 'toi' || lo.slice(m.index + m[0].length - 3, m.index + m[0].length) === 'tới' || !hasNonAscii(lo)));
  }
  function hasContent(part) {
    const sp = mergeSpans(ownSpans(part, true), part.length);
    let t = '', pos = 0;
    for (const [a, b] of sp) { t += part.slice(pos, a) + ' '; pos = b; }
    t += part.slice(pos);
    return fold1(t).split(/[^a-z0-9]+/).some(w => w && !FILL.has(w));
  }
  /** -> [{s, e}] các mệnh đề (chỉ số trong body). */
  function splitClauses(body) {
    const seps = [];
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === ';' || c === ',') {
        if (c === ',' && /\d/.test(body[i - 1] || '') && /\d/.test(body[i + 1] || '')) continue;
        seps.push([i, i + 1]);
      }
    }
    WORD_SEP.lastIndex = 0;
    let m;
    while ((m = WORD_SEP.exec(body))) seps.push([m.index, m.index + m[0].length]);
    if (!seps.length) return [{ s: 0, e: body.length, time: true, content: true }];
    seps.sort((a, b) => a[0] - b[0]);
    const parts = [];
    let pos = 0;
    for (const [a, b] of seps) { if (a >= pos) { parts.push({ s: pos, e: a }); pos = b; } }
    parts.push({ s: pos, e: body.length });
    for (const p of parts) {
      p.text = body.slice(p.s, p.e);
      p.time = hasTimeWord(p.text);
      p.content = p.time ? hasContent(p.text) : /\S/.test(p.text);
    }
    const ps = parts.filter(p => /\S/.test(p.text));
    const groups = [];
    let cur = null;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!cur) { cur = { s: p.s, e: p.e, time: p.time, content: p.content }; continue; }
      let startNew = false;
      if (p.time && cur.time && cur.content) {
        const nx = ps[i + 1];
        startNew = p.content || !!(nx && !nx.time && nx.content);
      }
      if (startNew) { groups.push(cur); cur = { s: p.s, e: p.e, time: p.time, content: p.content }; }
      else { cur.e = p.e; cur.time = cur.time || p.time; cur.content = cur.content || p.content; }
    }
    if (cur) groups.push(cur);
    return groups;
  }

  /* ---------- tiêu đề ngày chung ---------- */
  const HV = new Set(('hom nay ngay thu hai ba tu bon nam sau bay cn chu nhat mai mot kia nay tuan thang cuoi toi viec la cac cua vao lich ke hoach cho can lam danh sach plan today tomorrow ng ngmai hang ' +
    't2 t3 t4 t5 t6 t7').split(' '));
  function headerDate(body, nowD) {
    if (body.length > 40) return null;
    if (hasTimeWord(body)) return null;
    const f = fold1(nz(body)), lo = lower1(body);
    const d = ownDate(f, lo, nowD);
    if (!d) return null;
    const words = f.split(/[^a-z0-9]+/).filter(Boolean);
    return words.every(w => HV.has(w) || /^\d+$/.test(w)) ? d.date : null;
  }

  /* ---------- một mệnh đề -> Item ---------- */
  const WAKE_ACC = /(?<![\p{L}])(?:dậy|báo thức|thức dậy)(?![\p{L}])/u;
  const WAKE_ASC = /(?<![a-z])(?:bao thuc|thuc day|day (?:luc )?\d|day som)/;
  function isWake(lo, f) { return WAKE_ACC.test(lo) || (!hasNonAscii(lo) && WAKE_ASC.test(f)); }

  /** -> {due, wake} | null */
  function whenOf(clause, ctx) {
    const { now, nowD, header } = ctx;
    const lo = lower1(clause), norm = nz(clause), f = fold1(norm);
    const wake = isWake(lo, f);
    if (/(?<![a-z])mai\s*mot(?![a-z])/.test(f)) return null; // "mai mốt": hạn mềm, không có giờ
    if (SLASH.test(f)) { // a/b: để parse.js phân xử (30/2 vô lý, 3/4 là phân số...)
      const P1 = deps().P;
      const w1 = P1 && typeof P1.parseWhen === 'function' ? tryDo(() => P1.parseWhen(norm, nowD)) : null;
      return w1 && w1.timed && w1.date && Number.isFinite(w1.date.getTime()) ? { due: w1.date.getTime(), wake } : null;
    }
    if (SPECIAL.test(f)) { // các cách nói mà bộ nhận dạng của parse.js hiểu (nửa tiếng nữa, 1h30 nữa, trong 5 phút, nửa đêm, 9.30, 20-10 9h)
      const P0 = deps().P;
      const w0 = P0 && typeof P0.parseWhen === 'function' ? tryDo(() => P0.parseWhen(norm, nowD)) : null;
      if (w0 && w0.timed && w0.date && Number.isFinite(w0.date.getTime())) return { due: w0.date.getTime(), wake };
    }
    const m = REL.exec(f);
    if (m) {
      const accTui = lo.slice(m.index + m[0].length - 3, m.index + m[0].length) === 'tới';
      const okToi = m[3] !== 'toi' || accTui || (!hasNonAscii(lo) && !/^(?:h|gio)$/.test(m[2]));
      if (okToi) {
        if (!/^(?:giay|phut|ph|p|tieng|gio|h)$/.test(m[2])) { // "3 ngày nữa": không có giờ trừ khi kèm giờ ("3 ngày nữa 9h")
          const T0 = ownTime(clause);
          if (!T0) return null;
          const dd = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + (+m[1]) * (m[2] === 'tuan' ? 7 : 1), T0.h, T0.mi, 0, 0);
          return { due: dd.getTime(), wake };
        }
        const k = { giay: 1e3, phut: MIN, ph: MIN, p: MIN, tieng: HOUR, gio: HOUR, h: HOUR }[m[2]];
        return { due: now + (+m[1]) * k, wake };
      }
    }
    const T = ownTime(clause);
    if (T) {
      const Dt = ownDate(f, lo, nowD);
      const base = Dt ? Dt.date : header;
      if (base) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), T.h, T.mi, 0, 0);
        if (Dt && Dt.todayDow && d.getTime() <= now) d.setDate(d.getDate() + 7);
        return { due: d.getTime(), wake };
      }
      const today = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), T.h, T.mi, 0, 0);
      let t = today.getTime();
      if (t <= now) {
        if (wake && !T.per) { const d2 = new Date(today); d2.setDate(d2.getDate() + 1); t = d2.getTime(); }
        else if (!T.per && T.h > 0 && T.h < 12 && t + 12 * HOUR > now) t += 12 * HOUR;
        else { const d2 = new Date(today); d2.setDate(d2.getDate() + 1); t = d2.getTime(); }
      }
      return { due: t, wake };
    }
    const P = deps().P;
    if (P && typeof P.parseWhen === 'function') {
      const w = tryDo(() => P.parseWhen(norm, nowD));
      if (w && w.timed && w.date) return { due: w.date.getTime(), wake };
    }
    return null;
  }

  function makeItem(clause, ctx) {
    const { now, line } = ctx;
    const { P, R } = deps();
    let due = null, repeat = null, wake = false;
    const norm = clause.replace(/:(?!\d)/g, ' ');
    const rec = R ? tryDo(() => R.parseRecur(norm)) : null;
    if (rec && rec.repeat && (rec.repeat.freq === 'hourly' || rec.time)) {
      repeat = Object.assign({}, rec.repeat);
      if (repeat.freq === 'hourly' || (repeat.interval || 1) > 1) repeat.anchor = now;
      due = tryDo(() => R.nextOccurrence({ repeat, time: rec.time }, now));
      if (!Number.isFinite(due)) return null;
      wake = isWake(lower1(clause), fold1(clause));
    } else {
      const w = whenOf(clause, ctx);
      if (!w || !Number.isFinite(w.due)) return null;
      due = w.due; wake = w.wake;
    }
    const spans = allSpans(clause, !!repeat);
    let title = cleanTitle(clause, spans);
    if (!title) title = 'Việc lúc ' + hm(due);
    title = clip(cap(title), 80);
    let intent = { k: 'task', lead: 5 * MIN };
    if (P && typeof P.intentOf === 'function') intent = tryDo(() => P.intentOf(clause)) || intent;
    let lead = typeof intent.lead === 'number' ? intent.lead : 0;
    if (P && typeof P.leadFor === 'function') { const l = tryDo(() => P.leadFor(intent, due, true, now)); if (Number.isFinite(l)) lead = l; }
    return { key: '', line, raw: clause.trim(), title, due, timed: true, time: hm(due), repeat, intent: intent.k || 'task', lead, priority: 0, _wake: wake };
  }

  /* ---------- gợi ý ---------- */
  function whenText(due, now) {
    const diff = Math.round((sod(due) - sod(now)) / DAY), d = new Date(due);
    const day = diff === 0 ? 'hôm nay' : diff === 1 ? 'ngày mai' : WD[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
    return hm(due) + ' ' + day;
  }
  const lowFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);

  function emptyInsight() {
    return { version: 1, title: '', items: [], checklist: null, people: [], places: [], money: [], phones: [], links: [], emails: [], tags: [], priority: 0, priorityWords: [], softDeadline: null, suggestions: [] };
  }

  const QUICK = /\d|sang|trua|chieu|toi|dem|khuya|tieng|gio/;
  function build(text, nowIn) {
    const out = emptyInsight();
    if (typeof text !== 'string' || !text.trim()) return out;
    const now = Number.isFinite(nowIn) ? nowIn : Date.now();
    const nowD = new Date(now);
    const { R, E, P: PP } = deps();
    const NN = PP && typeof PP.normNum === 'function' ? PP.normNum : null;
    const src = (text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text).normalize('NFC');
    const lines = src.split(/\r?\n/).slice(0, MAX_LINES);

    // thực thể
    let ent = null;
    if (E && typeof E.extractEntities === 'function') ent = tryDo(() => E.extractEntities(src, now));
    if (ent) {
      for (const k of ['people', 'places', 'money', 'phones', 'links', 'emails', 'tags', 'priorityWords']) if (Array.isArray(ent[k])) out[k] = ent[k];
      out.priority = Number.isInteger(ent.priority) ? ent.priority : 0;
      out.softDeadline = ent.softDeadline || null;
    }
    const prioCache = new Map();
    const linePrio = (ln, i) => {
      if (prioCache.has(i)) return prioCache.get(i);
      let p = 0;
      if (E) {
        const r = typeof E.lineEntities === 'function' ? tryDo(() => E.lineEntities(ln, i, now)) : (typeof E.extractEntities === 'function' ? tryDo(() => E.extractEntities(ln, now)) : null);
        if (r && Number.isInteger(r.priority)) p = r.priority;
      }
      prioCache.set(i, p);
      return p;
    };

    const items = [], clItems = [], contentLines = [];
    let header = null, titleSet = false, hasBox = false, longLine = false;
    for (let i = 0; i < lines.length && items.length < MAX_ITEMS; i++) {
      const ln = lines[i];
      const mk = markerOf(ln);
      const body0 = mk ? ln.slice(mk.len) : ln;
      if (!body0.trim()) continue;
      const body = NN ? (tryDo(() => NN(body0)) || body0) : body0; // số bằng chữ -> chữ số (cùng độ dài) để nhận ra giờ
      if (!titleSet) { out.title = clip(body0.trim().replace(/[\s:]+$/, '') || body.trim(), 80); titleSet = true; }
      if (mk) { clItems.push({ line: i, text: body.trim(), done: mk.done }); if (mk.box) hasBox = true; }
      const hd = headerDate(body, nowD);
      if (hd) { header = hd; continue; }
      contentLines.push(i);
      if (body.trim().length > 90) longLine = true;
      if (!QUICK.test(fold1(body))) continue; // không chữ số/buổi/giờ -> chắc chắn không có giờ
      let lineDate = header;
      for (const g of splitClauses(body)) {
        if (items.length >= MAX_ITEMS) break;
        const clause = body.slice(g.s, g.e).trim();
        if (!clause) continue;
        const it = makeItem(clause, { now, nowD, header: lineDate, line: i });
        if (it) {
          it.priority = linePrio(ln, i); items.push(it);
          // ngày riêng của mệnh đề này áp cho các mệnh đề sau trong cùng dòng không có ngày riêng
          if (!it.repeat && ownDate(fold1(nz(clause)), lower1(clause), nowD)) { const dd = new Date(it.due); lineDate = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()); }
        }
      }
    }
    if (clItems.length >= 2 || hasBox) {
      out.checklist = { items: clItems, done: clItems.filter(c => c.done).length, total: clItems.length };
    }

    // khoá ổn định, trùng thêm #2
    const seen = new Map();
    for (const it of items) {
      const base = itemKey(it.title), n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      it.key = n === 1 ? base : base + '#' + n;
    }

    // gợi ý
    const sg = [], ids = new Set();
    const push = s => { if (!ids.has(s.id)) { ids.add(s.id); sg.push(s); } };
    const eligible = items.filter(it => it.repeat || it.due > now);
    for (const it of eligible) {
      const t = clip(it.title, 28);
      const rep = it.repeat && R ? ', ' + lowFirst(R.describeRepeat(it.repeat)) : '';
      const label = it.repeat ? `Nhắc “${t}” lúc ${it.time}${rep}` : `Nhắc “${t}” lúc ${whenText(it.due, now)}`;
      push({ id: 'remind:' + it.key, kind: 'remind', label, itemKey: it.key, data: { due: it.due, title: it.title, line: it.line, repeat: it.repeat } });
    }
    if (eligible.length >= 2) push({ id: 'remind-all', kind: 'remind-all', label: `Tạo nhắc cho ${eligible.length} việc`, data: { keys: eligible.map(it => it.key) } });
    for (const it of eligible) {
      if (!it._wake) continue;
      const d = new Date(it.due);
      const rep = it.repeat && R ? ', ' + lowFirst(R.describeRepeat(it.repeat)) : '';
      push({ id: 'alarm:' + it.key, kind: 'alarm', label: `Đặt báo thức ${d.getHours()}:${pad(d.getMinutes())}${rep}`, itemKey: it.key,
        data: { time: it.time, date: R ? R.dayKey(it.due) : null, repeat: it.repeat, label: it.title } });
    }
    const itemLines = [...new Set(items.map(it => it.line))];
    if (!out.checklist && contentLines.length >= 2 && contentLines.length <= 60 && !longLine && itemLines.length * 2 < contentLines.length) {
      push({ id: 'checklist', kind: 'checklist', label: 'Chuyển thành checklist', data: { lines: contentLines } });
    }
    if (itemLines.length >= 2) push({ id: 'split', kind: 'split', label: `Tách thành ${itemLines.length} note`, data: { lines: itemLines } });
    for (const p of out.phones) {
      const digits = String(p.number || '').replace(/\D/g, '');
      if (!digits) continue;
      const disp = p.display || digits;
      push({ id: 'call:' + digits, kind: 'call', label: 'Gọi ' + disp, data: { number: digits, display: disp } });
      push({ id: 'message:' + digits, kind: 'message', label: 'Nhắn ' + disp, data: { number: digits, display: disp } });
    }
    for (const l of out.links) {
      if (!l || !l.url) continue;
      const host = String(l.url).replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0];
      push({ id: 'link:' + l.url, kind: 'link', label: host ? 'Mở link ' + clip(host, 30) : 'Mở link', data: { url: l.url } });
    }
    for (const e of out.emails) {
      if (!e || !e.email) continue;
      push({ id: 'email:' + e.email, kind: 'email', label: 'Gửi email ' + clip(e.email, 30), data: { email: e.email } });
    }

    out.items = items.map(it => { const o = Object.assign({}, it); delete o._wake; return o; });
    out.suggestions = sg;
    return out;
  }

  function understand(text, now) {
    try { return build(text, now === undefined ? Date.now() : now); } catch (e) { return emptyInsight(); }
  }

  const api = { understand, itemKey, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiUnderstand = api;
})(typeof window !== 'undefined' ? window : globalThis);
