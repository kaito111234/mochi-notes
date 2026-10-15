/* Mochi Notes — trích thực thể từ văn bản tiếng Việt (người, nơi, tiền, SĐT, link, email, thẻ, ưu tiên, hạn mềm).
   Thuần JS, không phụ thuộc. Node: require; renderer: window.MochiEntities.
   Hiểu cả có dấu và không dấu. Mọi số liệu giờ/ngày tính theo giờ địa phương. */
(function (root) {
  const MASK = '\u0001';

  /** Chữ thường, bỏ dấu, đ->d. GIỮ NGUYÊN ĐỘ DÀI chuỗi (để dùng chỉ số chung với chuỗi gốc đã NFC). */
  const FOLD_CACHE = new Map();
  function foldChars(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], cc = c.charCodeAt(0);
      if (cc < 128) { out += (cc >= 65 && cc <= 90) ? String.fromCharCode(cc + 32) : c; continue; }
      const hit = FOLD_CACHE.get(c);
      if (hit !== undefined) { out += hit; continue; }
      const before = out.length;
      if (c === 'đ') { out += 'd'; continue; }
      if (c === 'Đ') { out += 'd'; continue; }
      let r = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (r.length !== 1) r = c;
      const lo = r.toLowerCase();
      out += lo.length === 1 ? lo : r;
      FOLD_CACHE.set(c, out.slice(before));
    }
    return out;
  }
  function fold(s) { return foldChars(String(s == null ? '' : s).normalize('NFC')).replace(/\s+/g, ' ').trim(); }

  const mask = (w, a, b) => w.slice(0, a) + MASK.repeat(b - a) + w.slice(b);
  const maskAll = (w, hits) => { for (const h of hits) w = mask(w, h.start, h.end); return w; };
  const isCap = w => !!w && w[0] !== w[0].toLowerCase() && w[0] === w[0].toUpperCase();
  const TRAIL = /[.,;:!?)\]}'"…]+$/;

  /* ---------- link / email ---------- */
  function findLinks(work) {
    const hits = [];
    let m;
    const re1 = /(?:https?:\/\/|(?<![\p{L}\p{N}_.\/-])www\.)[^\s<>"'\u0001]+/giu;
    while ((m = re1.exec(work))) {
      let raw = m[0].replace(TRAIL, '');
      if (/^https?:\/\//i.test(raw) ? raw.length <= 8 : !/^www\.[^\s.]+\.[^\s.]+/i.test(raw)) continue;
      hits.push({ start: m.index, end: m.index + raw.length, raw, url: /^https?:/i.test(raw) ? raw : 'https://' + raw });
    }
    return hits;
  }
  function findEmails(work) {
    const hits = [];
    const re = /(?<![\p{L}\p{N}_.%+-])[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/gu;
    let m;
    while ((m = re.exec(work))) hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0], email: m[0] });
    return hits;
  }
  function findDomains(work) {
    const hits = [];
    const re = /(?<![\p{L}\p{N}_@.\/-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com\.vn|com|vn|net|org|io|me)(?![\p{L}\p{N}_-])(?:[\/?#][^\s<>"'\u0001]*)?/giu;
    let m;
    while ((m = re.exec(work))) {
      const raw = m[0].replace(TRAIL, '');
      hits.push({ start: m.index, end: m.index + raw.length, raw, url: 'https://' + raw });
    }
    return hits;
  }

  /* ---------- SĐT ---------- */
  function findPhones(work) {
    const hits = [];
    const re = /(?<![\p{L}\p{N}.,+])(\+84|0)((?:[ .-]?\d){9,10})(?!\d)/gu;
    let m;
    while ((m = re.exec(work))) {
      const d9 = m[2].replace(/\D/g, '');
      if (d9.length === 10 ? d9[0] !== '2' : (m[1] === '0' ? !/[2-9]/.test(d9[0]) : d9[0] === '0')) continue;
      const n = '0' + d9;
      hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0], number: n, display: n.slice(0, 4) + ' ' + n.slice(4, 7) + ' ' + n.slice(7) });
    }
    return hits;
  }

  /* ---------- tiền ---------- */
  const GROUPED = /^\d{1,3}([.,]\d{3})+$/;
  function findMoney(work, f) {
    const hits = [];
    let m;
    const re1 = /(?<![\p{L}\p{N}.,])(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(vnd|dong|d)(?![\p{L}\p{N}])/gu;
    while ((m = re1.exec(f))) {
      const amount = parseInt(m[1].replace(/\D/g, ''), 10);
      if (m[2] === 'd') {
        const oc = work.slice(m.index + m[0].length - 1, m.index + m[0].length);
        if (oc !== 'đ' && oc !== 'Đ' && amount < 1000) continue;
      }
      hits.push({ start: m.index, end: m.index + m[0].length, raw: work.slice(m.index, m.index + m[0].length), amount });
    }
    const MULT = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, cu: 1e6, ty: 1e9 };
    const re2 = /(?<![\p{L}\p{N}.,])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|cu|ty)(?![\p{L}])(\d{1,3}(?!\d))?/gu;
    while ((m = re2.exec(f))) {
      const mult = MULT[m[2]];
      const grouped = GROUPED.test(m[1]);
      const n = grouped ? parseFloat(m[1].replace(/[.,]/g, '')) : parseFloat(m[1].replace(',', '.'));
      let amount = n * mult;
      if (m[3] && !grouped && !/[.,]/.test(m[1])) amount += (parseInt(m[3], 10) * mult) / Math.pow(10, m[3].length);
      amount = Math.round(amount);
      if (!(amount > 0)) continue;
      if (hits.some(h => m.index < h.end && m.index + m[0].length > h.start)) continue;
      hits.push({ start: m.index, end: m.index + m[0].length, raw: work.slice(m.index, m.index + m[0].length), amount });
    }
    return hits.sort((a, b) => a.start - b.start);
  }

  /* ---------- thẻ ---------- */
  function findTags(work) {
    const hits = [];
    const re = /(?<![\p{L}\p{N}_&\/#])#(\p{L}[\p{L}\p{M}\p{N}_]*)/gu;
    let m;
    while ((m = re.exec(work))) {
      const t = m[1];
      if (/^[0-9a-f]+$/i.test(t) && [3, 4, 6, 8].includes(t.length)) continue;
      hits.push({ start: m.index, end: m.index + m[0].length, tag: t.toLowerCase() });
    }
    return hits;
  }

  /* ---------- người ---------- */
  const NAME_STOP = new Set(['hom', 'ngay', 'sang', 'trua', 'chieu', 'toi', 'mai', 'thu', 'tuan', 'thang', 'luc', 'vao', 'o', 'tai', 'va', 'voi', 'nhe', 'nha', 'goi', 'hop', 'di', 'hen', 'mua', 'nop', 'gap', 've', 'cho', 'de', 'sau', 'truoc', 'khi', 'nua', 'ay', 'oi']);
  const NAME_BLOCK = new Set(['ba dinh', 'ba vi', 'ba ria', 'ba lan', 'ba na', 'anh quoc', 'anh em', 'chi em', 'co don', 'ban be', 'em be', 'em yeu', 'chu nhat', 'ba thang', 'ba mu']);
  const NAME_BAD_FIRST = new Set(['ay', 'be', 'oi', 'nua', 'em', 'don']);
  function findPeople(work) {
    const hits = [];
    const PRE = 'anh|chị|chi|em|cô|co|chú|chu|bác|bac|ông|ong|bà|ba|bạn|ban|thầy|thay|sếp|sep|mẹ|me|bố|bo|má|ma';
    const re = new RegExp('(?<![\\p{L}\\p{N}_@.])(?:(' + PRE + ')\\s+|(a|c)(?:\\.\\s*|\\s+))((?:\\p{L}[\\p{L}\'’-]*)(?:\\s+\\p{L}[\\p{L}\'’-]*){0,3})', 'giu');
    let m;
    while ((m = re.exec(work))) {
      const pre = m[1] || m[2];
      const tailStart = m.index + m[0].length - m[3].length;
      const words = [];
      const wre = /\p{L}[\p{L}'’-]*/gu;
      let w;
      while ((w = wre.exec(m[3])) && words.length < 3) {
        const fw = fold(w[0]);
        if (!isCap(w[0])) break;
        if (words.length && NAME_STOP.has(fw)) break;
        if (!words.length && NAME_BAD_FIRST.has(fw)) break;
        words.push({ text: w[0], start: tailStart + w.index, end: tailStart + w.index + w[0].length });
      }
      if (!words.length) { re.lastIndex = m.index + pre.length; continue; }
      if (NAME_BLOCK.has(fold(pre) + ' ' + fold(words[0].text))) { re.lastIndex = m.index + pre.length; continue; }
      const end = words[words.length - 1].end;
      hits.push({ start: m.index, end, name: work.slice(words[0].start, end), raw: work.slice(m.index, end) });
      re.lastIndex = end;
    }
    const overlaps = (a, b) => hits.some(h => a < h.end && b > h.start);
    const re2 = /(?<![\p{L}\p{N}_])(sếp|mẹ|bố|má)(?![\p{L}\p{N}_])/giu;
    while ((m = re2.exec(work))) {
      if (overlaps(m.index, m.index + m[0].length)) continue;
      hits.push({ start: m.index, end: m.index + m[0].length, name: m[0], raw: m[0] });
    }
    const re3 = /(?<![\p{L}\p{N}_.@])@(\p{L}[\p{L}\p{N}_.-]*)/gu;
    while ((m = re3.exec(work))) {
      const nm = m[1].replace(/[.-]+$/, '');
      hits.push({ start: m.index, end: m.index + 1 + nm.length, name: nm, raw: '@' + nm });
    }
    return hits.sort((a, b) => a.start - b.start);
  }

  /* ---------- nơi chốn ---------- */
  const PL_TIME = new Set(['luc', 'vao', 'sang', 'trua', 'chieu', 'toi', 'mai', 'nay', 'hom', 'ngay', 'tuan', 'thang', 'cuoi', 'nhe', 'nha', 'nhen']);
  const PL_VERB = new Set(['gap', 'hop', 'hen', 'di', 'don', 'dua', 'mua', 'goi', 'an', 'uong', 'lam', 'hoc', 'den', 'nop', 'nhan', 'lay', 'tra', 'kham', 'tap', 'choi', 'xem', 'nau', 'nho', 'nhac', 'bao', 'gui', 'mang', 'muon', 'tham', 'va', 'voi', 'de', 'cung', 'roi', 'thi', 'ma', 'nen', 'khi', 'sau', 'truoc', 'xong', 'thoi', 'cho']);
  const PL_BAD_FIRST = new Set(['lai', 'dau', 'do', 'day', 'ay', 'nua', 'yen', 'sao']);
  const PL_BAD_TAI = new Set(['nghe', 'nan', 'bien', 'hoa', 'nhe', 'phai', 'trai', 'to', 'vach', 'xe', 'tho']);
  const DOWW = '(?:[2-7]|hai|ba|tu|bon|nam|sau|bay)';
  function findPlaces(work) {
    const hits = [];
    const f = foldChars(work);
    const re = /(?<![a-z0-9])(o|tai)(?![a-z0-9])/g;
    let m;
    while ((m = re.exec(f))) {
      const oc = work.slice(m.index, m.index + m[1].length).toLowerCase();
      if (m[1] === 'o' && oc !== 'ở' && oc !== 'o') continue;
      if (m[1] === 'tai' && oc !== 'tại' && oc !== 'tai') continue;
      const after = m.index + m[1].length;
      const toks = [];
      const tre = /\S+/g;
      tre.lastIndex = after;
      let t, cnt = 0, lastEnd = -1, firstStart = -1;
      const all = [];
      while ((t = tre.exec(work)) && all.length < 9) all.push({ s: t[0], i: t.index });
      for (let k = 0; k < all.length && cnt < 6; k++) {
        const tok = all[k].s;
        if (tok.includes(MASK) || tok[0] === '(') break;
        const core = tok.replace(/[,.;:!?)\]]+$/, '');
        const ends = core.length !== tok.length;
        if (!core) break;
        const ft = foldChars(core);
        const low = !isCap(core) && !/^\d/.test(core);
        if (k === 0) {
          if (PL_BAD_FIRST.has(ft)) break;
          if (m[1] === 'tai' && PL_BAD_TAI.has(ft) && oc === 'tai') break;
        }
        if (/^\d{1,2}(?:h|g|gio|:)\d{0,2}$/.test(ft) || /\d[\/-]\d/.test(ft)) break;
        const nxt = all[k + 1] ? foldChars(all[k + 1].s.replace(/[,.;:!?)\]]+$/, '')) : '';
        if (/^\d{1,2}$/.test(ft) && /^(h|g|gio|phut|p|ph)$/.test(nxt)) break;
        const prev = k > 0 ? foldChars(all[k - 1].s) : '';
        if (low && ft === 'hop' && prev === 'phong') { /* "phòng họp" là nơi */ }
        else if (low && k > 0 && (PL_TIME.has(ft) || PL_VERB.has(ft))) break;
        else if (low && k === 0 && ((PL_TIME.has(ft) && ft !== 'nha' && ft !== 'nhe') || (PL_VERB.has(ft) && ft !== 'cho'))) break;
        if (low && ft === 'thu' && k >= 0 && new RegExp('^' + DOWW + '$').test(nxt) && ft === 'thu' && core.toLowerCase() === 'thứ') break;
        if (firstStart < 0) firstStart = all[k].i;
        lastEnd = all[k].i + core.length;
        cnt++;
        if (ends) break;
      }
      if (cnt && lastEnd > 0) {
        hits.push({ start: m.index, end: lastEnd, name: work.slice(firstStart, lastEnd), raw: work.slice(m.index, lastEnd) });
        re.lastIndex = lastEnd;
      }
    }
    return hits;
  }

  /* ---------- ưu tiên ---------- */
  const BAD_GAP_AFTER = /^\s+(anh|chi|em|co|chu|bac|ong|ba|ban|thay|sep|me|bo|ma|khach|nhau|lai|moi|doi|cac|ae|@)(?![a-z0-9])/;
  const BAD_GAP_BEFORE = /(?:^|[^a-z0-9])(hen|de|se|muon|den|cung|khi|di)\s+$/;
  const BAD_KHAN_BEFORE = /(?:^|[^a-z0-9])(mua|cai|chiec|cuon|giat|dem|tam|lau)\s+$/;
  const BAD_KHAN_AFTER = /^\s+(tam|giay|trai|an|ban|lau|choang|quang|san|tay|rang|bong)(?![a-z0-9])/;
  function findPriority(work) {
    let f = foldChars(work);
    const words = [];
    let level = 0;
    const rules = [
      [3, /(?<![a-z0-9])rat gap(?![a-z0-9])/g, 'gap'],
      [3, /(?<![a-z0-9])khan cap(?![a-z0-9])/g],
      [3, /(?<![a-z0-9])(?:asap|urgent)(?![a-z0-9])/g],
      [3, /(?<![a-z0-9])cap bach(?![a-z0-9])/g],
      [3, /(?<![a-z0-9])ngay lap tuc(?![a-z0-9])/g],
      [3, /(?<![a-z0-9])khan(?![a-z0-9])/g, 'khan'],
      [2, /(?<![a-z0-9])uu tien(?![a-z0-9])/g],
      [2, /(?<![a-z0-9])gap(?![a-z0-9])/g, 'gap'],
      [1, /(?<![a-z0-9])quan trong(?![a-z0-9])/g]
    ];
    for (const [lv, re, kind] of rules) {
      let m;
      const found = [];
      while ((m = re.exec(f))) {
        const s = m.index, e = s + m[0].length;
        if (kind === 'gap') {
          const o = work.slice(e - 3, e).toLowerCase();
          if (o !== 'gấp' && o !== 'gap') continue;
          if (o === 'gap') {
            if (BAD_GAP_AFTER.test(f.slice(e)) || BAD_GAP_BEFORE.test(f.slice(0, s))) continue;
          }
        } else if (kind === 'khan') {
          const o = work.slice(s, e).toLowerCase();
          if (o !== 'khan' && o !== 'khẩn') continue;
          if (BAD_KHAN_BEFORE.test(f.slice(0, s)) || BAD_KHAN_AFTER.test(f.slice(e))) continue;
        }
        found.push([s, e]);
      }
      for (const [s, e] of found) {
        words.push(work.slice(s, e));
        f = mask(f, s, e);
        if (lv > level) level = lv;
      }
    }
    const tm = /(!+)\s*$/.exec(work);
    if (tm && tm.index > 0 && work.slice(0, tm.index).replace(/[\s\u0001]/g, '') && work[tm.index - 1] !== '?') {
      const lv = Math.min(3, tm[1].length);
      words.push(tm[1]);
      if (lv > level) level = lv;
    }
    return { priority: level, priorityWords: words };
  }

  /* ---------- hạn mềm ---------- */
  const DAYNUM = { hai: 2, ba: 3, tu: 4, bon: 4, nam: 5, sau: 6, bay: 7 };
  const eod = (y, m, d) => new Date(y, m, d, 23, 59, 59, 0).getTime();
  function findSoft(line, work, nowMs) {
    const f = foldChars(work);
    const now = new Date(nowMs);
    const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
    const dow = (now.getDay() + 6) % 7; // T2 = 0
    const res = (label, due, m) => ({ label, due, raw: line.slice(m.index, m.index + m[0].length) });
    let m;
    // trước <thứ N | tN | cn>
    if ((m = /(?<![a-z0-9])truoc\s+(?:thu\s*(\d|hai|ba|tu|bon|nam|sau|bay)|t\s*(\d)|(cn|chu\s*nhat))(?![a-z0-9])/.exec(f))) {
      let n = m[3] ? 8 : (m[1] ? (DAYNUM[m[1]] || parseInt(m[1], 10)) : parseInt(m[2], 10));
      if (n >= 2 && n <= 8) {
        const off = n - 2; // lệch so với thứ 2 của tuần này
        let due = eod(y, mo, d - dow + off - 1);
        if (due < nowMs) due = eod(y, mo, d - dow + off - 1 + 7);
        return res(n === 8 ? 'Trước Chủ nhật' : 'Trước thứ ' + n, due, m);
      }
    }
    // trước d/m[/y], trước ngày d
    if ((m = /(?<![a-z0-9])truoc\s+(?:ngay\s+)?(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?(?![\d\/-])/.exec(f))) {
      const dd = +m[1], mm = +m[2];
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
        let yy = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : y;
        const mk = yr => eod(yr, mm - 1, dd - 1);
        let due = mk(yy);
        const chk = new Date(yy, mm - 1, dd);
        if (chk.getMonth() === mm - 1) {
          if (!m[3] && due < nowMs) due = mk(yy + 1);
          return res('Trước ' + dd + '/' + mm, due, m);
        }
      }
    }
    if ((m = /(?<![a-z0-9])truoc\s+ngay\s+(\d{1,2})(?![\d\/:h-])(?!\s*(?:thang|\/))/.exec(f))) {
      const dd = +m[1];
      if (dd >= 1 && dd <= 31) {
        let due = eod(y, mo, dd - 1);
        if (due < nowMs) due = eod(y, mo + 1, dd - 1);
        return res('Trước ngày ' + dd, due, m);
      }
    }
    if ((m = /(?<![a-z0-9])(trong\s+hom\s+nay|trong\s+ngay|het\s+hom\s+nay|cuoi\s+ngay)(?![a-z0-9])/.exec(f))) {
      const k = m[1].replace(/\s+/g, ' ');
      const label = k === 'trong hom nay' ? 'Trong hôm nay' : k === 'trong ngay' ? 'Trong ngày' : k === 'het hom nay' ? 'Hết hôm nay' : 'Cuối ngày';
      return res(label, eod(y, mo, d), m);
    }
    if ((m = /(?<![a-z0-9])cuoi\s+thang(?![a-z0-9])/.exec(f))) return res('Cuối tháng', eod(y, mo + 1, 0), m);
    if ((m = /(?<![a-z0-9])cuoi\s+tuan(?![a-z0-9])/.exec(f))) return res('Cuối tuần', eod(y, mo, d + 6 - dow), m);
    if ((m = /(?<![a-z0-9])tuan\s+(?:sau|toi)(?![a-z0-9])/.exec(f))) {
      const before = f.slice(0, m.index);
      if (!/(?:thu\s*(?:[2-7]|hai|ba|tu|bon|nam|sau|bay)|(?:^|[^a-z0-9])t[2-7]|(?:^|[^a-z0-9])cn|chu\s*nhat|dau|giua|cuoi)\s*$/.test(before)) {
        return res('Tuần sau', eod(y, mo, d + 6 - dow + 7), m);
      }
    }
    if ((m = /(?<![a-z0-9])trong\s+tuan(?:\s+nay)?(?![a-z0-9])(?!\s+(?:sau|toi))/.exec(f))) {
      return res('Trong tuần', eod(y, mo, d + 6 - dow), m);
    }
    // "mai mốt": không rõ ngày, chỉ là hạn mềm vài ngày tới (không bao giờ thành giờ cụ thể)
    if ((m = /(?<![a-z0-9])mai\s+mot(?![a-z0-9])/.exec(f))) return res('Mai mốt', eod(y, mo, d + 3), m);
    return null;
  }

  /* ---------- tổng hợp ---------- */
  function toMs(now) {
    if (now instanceof Date) return now.getTime();
    if (typeof now === 'number' && isFinite(now)) return now;
    return Date.now();
  }
  function emptyResult() {
    return { people: [], places: [], money: [], phones: [], links: [], emails: [], tags: [], priority: 0, priorityWords: [], softDeadline: null };
  }

  function lineEntities(line, lineIndex, now) {
    const ln = lineIndex | 0;
    const nowMs = toMs(now);
    const src = String(line == null ? '' : line).normalize('NFC');
    const out = emptyResult();
    let work = src;

    const http = findLinks(work);
    work = maskAll(work, http);
    const mails = findEmails(work);
    work = maskAll(work, mails);
    const doms = findDomains(work);
    work = maskAll(work, doms);
    for (const h of [...http, ...doms].sort((a, b) => a.start - b.start)) out.links.push({ url: h.url, raw: h.raw, line: ln });
    for (const h of mails) out.emails.push({ email: h.email, line: ln });

    const phones = findPhones(work);
    work = maskAll(work, phones);
    for (const h of phones) out.phones.push({ number: h.number, display: h.display, raw: h.raw, line: ln });

    const money = findMoney(work, foldChars(work));
    work = maskAll(work, money);
    for (const h of money) out.money.push({ amount: h.amount, raw: h.raw, line: ln });

    const tags = findTags(work);
    work = maskAll(work, tags);
    for (const h of tags) out.tags.push({ tag: h.tag, line: ln });

    for (const h of findPeople(work)) out.people.push({ name: h.name, raw: h.raw, line: ln });
    for (const h of findPlaces(work)) out.places.push({ name: h.name, raw: h.raw, line: ln });

    const pr = findPriority(work);
    out.priority = pr.priority;
    out.priorityWords = pr.priorityWords;
    out.softDeadline = findSoft(src, work, nowMs);
    return out;
  }

  function extractEntities(text, now) {
    const nowMs = toMs(now);
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    const out = emptyResult();
    const seen = { people: new Set(), places: new Set(), phones: new Set(), links: new Set(), emails: new Set(), tags: new Set() };
    const add = (kind, key, item) => { if (seen[kind].has(key)) return; seen[kind].add(key); out[kind].push(item); };
    lines.forEach((ln, i) => {
      const e = lineEntities(ln, i, nowMs);
      e.people.forEach(p => add('people', fold(p.name), p));
      e.places.forEach(p => add('places', fold(p.name), p));
      e.phones.forEach(p => add('phones', p.number, p));
      e.links.forEach(p => add('links', p.url.toLowerCase(), p));
      e.emails.forEach(p => add('emails', p.email.toLowerCase(), p));
      e.tags.forEach(p => add('tags', p.tag, p));
      out.money.push(...e.money);
      if (e.priority > out.priority) out.priority = e.priority;
      e.priorityWords.forEach(w => { if (!out.priorityWords.includes(w)) out.priorityWords.push(w); });
      if (e.softDeadline && (!out.softDeadline || e.softDeadline.due < out.softDeadline.due)) out.softDeadline = e.softDeadline;
    });
    return out;
  }

  const api = { extractEntities, lineEntities, fold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiEntities = api;
})(typeof window !== 'undefined' ? window : globalThis);
