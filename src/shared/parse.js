/* Mochi Notes — hiểu thời gian & loại việc từ câu tiếng Việt.
   Dùng chung cho main (require) và renderer (<script src>, global window.MochiParse). */
(function (root) {
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const pad = n => String(n).padStart(2, '0');

  const INTENTS = [
    { k: 'meet', re: /họp|meeting|gặp|hẹn|phỏng vấn|zoom|google meet|cafe với/, label: 'Họp, hẹn', lead: 10 * MIN },
    { k: 'call', re: /gọi|call|điện thoại|nhắn tin/, label: 'Gọi điện', lead: 5 * MIN },
    { k: 'due', re: /deadline|nộp|hạn chót|bàn giao|báo cáo|hoàn thành/, label: 'Hạn chót', lead: 'due' },
    { k: 'bday', re: /sinh nhật|kỷ niệm|đám cưới|đám giỗ|ngày giỗ/, label: 'Dịp đặc biệt', lead: 'day' },
    { k: 'pay', re: /trả tiền|chuyển khoản|đóng tiền|thanh toán|trả nợ|tiền điện|tiền nhà|tiền nước|học phí/, label: 'Thanh toán', lead: HOUR },
    { k: 'pill', re: /uống thuốc|thuốc/, label: 'Uống thuốc', lead: 0 },
    { k: 'health', re: /uống nước|nghỉ mắt|vươn vai|đứng dậy|đi bộ|tập thể dục/, label: 'Sức khoẻ', lead: 0 },
    { k: 'buy', re: /mua|đi chợ|siêu thị|đặt hàng|order/, label: 'Mua sắm', lead: 30 * MIN },
    { k: 'go', re: /đón|đưa |ra sân bay|chuyến bay|lên xe|bắt xe|đi tàu/, label: 'Di chuyển', lead: 30 * MIN }
  ];
  const DEFAULT_INTENT = { k: 'task', label: 'Việc', lead: 5 * MIN };

  /* ---------- Gấp dấu: ánh xạ 1-1 vị trí để trả chỉ số theo chuỗi gốc ---------- */
  const COMB = /[\u0300-\u036f]/;
  const foldRaw = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  /** Chữ thường, bỏ dấu tiếng Việt (đ->d), gộp khoảng trắng. */
  const fold = s => foldRaw(s).replace(/\s+/g, ' ').trim();
  const isDig = c => c !== undefined && c >= '0' && c <= '9';
  /** lo: chữ thường (NFC) giữ dấu; f: đã bỏ dấu + dấu câu thành khoảng trắng; up: có viết hoa; st/en: vị trí gốc. */
  function prep(text) {
    const s = String(text == null ? '' : text);
    const lo = [], fa = [], up = [], st = [], en = [];
    let i = 0;
    while (i < s.length) {
      let j = i + 1;
      const cp = s.charCodeAt(i);
      const astral = cp >= 0xd800 && cp < 0xdc00 && j < s.length && (s.charCodeAt(j) & 0xfc00) === 0xdc00;
      if (astral) j++;
      while (j < s.length && COMB.test(s[j])) j++;
      const nfc = s.slice(i, j).normalize('NFC');
      let l, f, u = false;
      if (astral) { l = ' '; f = ' '; } else {
        l = nfc.toLowerCase()[0] || ' ';
        u = nfc[0] !== nfc[0].toLowerCase();
        f = l === 'đ' ? 'd' : (l.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0] || l);
        if (/\s/.test(f)) f = ' ';
      }
      lo.push(l); fa.push(f); up.push(u); st.push(i); en.push(j);
      i = j;
    }
    for (let k = 0; k < fa.length; k++) {
      const c = fa[k];
      if (/[,.!?;()"]/.test(c) && !((c === '.' || c === ',') && isDig(fa[k - 1]) && isDig(fa[k + 1]))) fa[k] = ' ';
    }
    return { lo: lo.join(''), f: fa.join(''), up, st, en };
  }
  /** f nhưng các từ có dấu bị thay bằng khoảng trắng (chỉ còn từ gõ không dấu). */
  function plainOnly(P) {
    const out = P.f.split('');
    let k = 0;
    while (k < out.length) {
      if (!/[\p{L}\p{N}]/u.test(P.f[k])) { k++; continue; }
      let e = k, acc = false;
      while (e < out.length && /[\p{L}\p{N}]/u.test(P.f[e])) { if (P.lo[e] !== P.f[e]) acc = true; e++; }
      if (acc) for (let x = k; x < e; x++) out[x] = ' ';
      k = e;
    }
    return out.join('');
  }
  const LN = '\\p{L}\\p{N}';
  const LB = `(?<![${LN}])`, RB = `(?![${LN}])`, NLB = `(?<![${LN}.,/:])`;
  const INTENT_PLAIN = INTENTS.map(i => {
    const src = foldRaw(i.re.source).replace(/ \|/g, '|').replace(/ $/, '');
    return new RegExp(LB + '(?:' + src + ')' + RB, 'u');
  });

  function intentOf(text) {
    const P = prep(text), plain = plainOnly(P);
    const i = INTENTS.findIndex((it, x) => it.re.test(P.lo) || INTENT_PLAIN[x].test(plain));
    return i >= 0 ? INTENTS[i] : DEFAULT_INTENT;
  }
  function leadFor(intent, due, timed, now = Date.now()) {
    if (!timed && intent.lead !== 'day' && intent.lead !== 'due') return 0;
    if (intent.lead === 'day') return due - now > 26 * HOUR ? DAY : 0;
    if (intent.lead === 'due') return due - now > 26 * HOUR ? DAY : (due - now > HOUR ? HOUR : 0);
    return due - now > intent.lead ? intent.lead : 0; /* còn ít hơn mức báo trước -> báo đúng giờ */
  }

  /* ---------- Quét các cụm thời gian (dùng chung cho parseWhen & whenSpans) ---------- */
  const DOWMAP = { hai: 2, ba: 3, tu: 4, bon: 4, nam: 5, sau: 6, bay: 7 };
  const DOWOK = { hai: ['hai'], ba: ['ba'], tu: ['tư', 'tu'], bon: ['bốn', 'bon'], nam: ['năm', 'nam'], sau: ['sáu', 'sau'], bay: ['bảy', 'bay'] };
  const PERCANON = { sang: 'sáng', trua: 'trưa', chieu: 'chiều', toi: 'tối', dem: 'đêm', khuya: 'khuya' };
  const PEREXCL = { toi: /^(uu|da|thieu)$/, sang: /^(tao|kien|loc)$/, chieu: /^(cao|dai|rong|sau)$/ };
  const UNITK = { giay: 1e3, phut: MIN, ph: MIN, p: MIN, tieng: HOUR, gio: HOUR, h: HOUR, ngay: DAY, tuan: 7 * DAY };
  const UNITOK = { giay: ['giây', 'giay'], phut: ['phút', 'phut'], ph: ['ph'], p: ['p'], tieng: ['tiếng', 'tieng'], gio: ['giờ', 'gio'], h: ['h'], ngay: ['ngày', 'ngay'], tuan: ['tuần', 'tuan'] };
  const TITLES = /(?:^|\s)(?:anh|chi|em|co|chu|bac|di|cau|mo|ong|ba|me|bo|ban|be|sep|thay|hoa|cay)\s+$/;
  const FLOWER = /(?:^|\s)(?:hoa|cay)\s+$/;
  const NOT_NAY = /(?:^|\s)(?:tuan|thang|nam|quy|nhat|cn|t[2-7]|ngay|[2-7]|hai|ba|tu|bon|sau|bay)\s+$/;
  const NUMPER_BLOCK = /(?:^|\s)(?:phong|tang|so|lop|ban|bai|muc|buoc|thang|ngay|tuan|quy|trang|cau|tap|dong|thu|nhom|toa|can|lau)\s+$/;
  const R = (src) => new RegExp(src, 'gud');

  /* Số bằng chữ ("chín giờ", "mười giờ rưỡi", "hai mươi phút nữa") -> chữ số, GIỮ NGUYÊN độ dài chuỗi
     (chữ số đặt ở đầu từ, phần còn lại thành khoảng trắng) để chỉ số vẫn khớp chuỗi gốc. */
  const NW = { khong: [0, ['không', 'khong']], mot: [1, ['một', 'mốt', 'mot']], hai: [2, ['hai']], ba: [3, ['ba']], bon: [4, ['bốn', 'bon']], tu: [4, ['tư', 'tu']],
    nam: [5, ['năm', 'nam']], lam: [5, ['lăm', 'lam']], sau: [6, ['sáu']], bay: [7, ['bảy']], tam: [8, ['tám', 'tam']], chin: [9, ['chín', 'chin']], muoi: [10, ['mười', 'mươi', 'muoi']] };
  const NUMW = '(?:(?:hai|ba|bon|nam|sau|bay|tam|chin)\\s+muoi|muoi)(?:\\s+(?:mot|tu|lam|hai|ba|bon|nam|sau|bay|tam|chin))?|khong|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin';
  function numWords(P) {
    const f = P.f, lo = P.lo;
    const val = (a, b) => {
      const words = []; const re = /[a-z]+/g; let m;
      const seg = f.slice(a, b);
      while ((m = re.exec(seg))) words.push([m[0], a + m.index]);
      let v = 0;
      for (let i = 0; i < words.length; i++) {
        const [wd, at] = words[i], e = NW[wd];
        if (!e || e[1].indexOf(lo.slice(at, at + wd.length)) < 0) return null;
        if (wd === 'muoi') { v = (i === 0 ? 10 : v * 10) ; }
        else if (i + 1 < words.length && words[i + 1][0] === 'muoi') { v = e[0]; }
        else v += e[0];
      }
      return v;
    };
    const out = f.split('');
    P.nw = [];
    const put = (a, b, v) => { P.nw.push([a, b]); const t = String(v); for (let x = a; x < b; x++) out[x] = x - a < t.length ? t[x - a] : ' '; };
    const re1 = new RegExp(`${LB}(${NUMW})\\s+(gio|(?:phut|tieng|ngay|tuan)(?=\\s*(?:ruoi\\s*)?(?:nua|sau|toi)(?![${LN}])))${RB}`, 'gu');
    let m;
    while ((m = re1.exec(f))) {
      const a = m.index, b = a + m[1].length, u = m[2], ua = b + (m[0].length - m[1].length - u.length);
      if (['giờ', 'gio', 'phút', 'phut', 'tiếng', 'tieng', 'ngày', 'ngay', 'tuần', 'tuan'].indexOf(lo.slice(ua, ua + u.length)) < 0) continue;
      const v = val(a, b);
      if (v == null || (u === 'gio' ? v > 24 : v < 1 || v > 99)) continue;
      put(a, b, v);
    }
    const f2 = out.join('');
    const re2 = new RegExp(`(?<=(?:^|\\s)gio\\s+)(${NUMW})(?=\\s*(?:phut)?(?![${LN}]))`, 'gu');
    while ((m = re2.exec(f2))) {
      const a = m.index, b = a + m[1].length;
      const gi = f2.lastIndexOf('gio', a);
      if (['giờ', 'gio'].indexOf(lo.slice(gi, gi + 3)) < 0) continue;
      const v = val(a, b);
      if (v == null || v < 10 || v > 59) continue;
      put(a, b, v);
    }
    for (let x = 0; x < out.length; x++) if (out[x] !== f[x]) { P.f = out.join(''); return; }
  }

  /** Chuỗi cùng độ dài, số bằng chữ trong ngữ cảnh giờ/khoảng thời gian đã đổi thành chữ số ("hai giờ chiều" -> "2    giờ chiều"). */
  function normNum(text) {
    const src = String(text == null ? '' : text).normalize('NFC');
    const P = prep(src);
    numWords(P);
    if (!P.nw || !P.nw.length) return src;
    let out = src;
    for (const [a, b] of P.nw) {
      const sa = P.st[a], sb = P.en[b - 1];
      const dg = P.f.slice(a, b).replace(/\s+$/, '');
      out = out.slice(0, sa) + (dg + ' '.repeat(Math.max(0, sb - sa - dg.length))).slice(0, sb - sa) + out.slice(sb);
    }
    return out;
  }

  function scan(text) {
    const P = prep(text);
    numWords(P);
    const f = P.f, lo = P.lo, up = P.up;
    let w = f;
    const toks = [];
    const blank = (a, b) => { w = w.slice(0, a) + '\u0001'.repeat(b - a) + w.slice(b); };
    const okw = (a, b, list) => list.indexOf(lo.slice(a, b)) >= 0;
    const run = (re, accept) => {
      const src = w; re.lastIndex = 0; let m;
      while ((m = re.exec(src))) {
        const a = m.index, b = a + m[0].length;
        const t = accept(m, a, b);
        if (t) { if (t.a === undefined) t.a = a; if (t.b === undefined) t.b = b; toks.push(t); blank(t.a, t.b); re.lastIndex = b; }
        else re.lastIndex = a + 1;
      }
    };

    /* khoảng thời gian: "5 phút nữa", "sau 2 tiếng", "1 giờ 30 phút nữa", "trong 5 phút", "nửa tiếng nữa", "1h30 nữa" */
    run(R(`${LB}trong\\s*(\\d{1,3})\\s*(giay|phut|ph|p)(?:\\s*(nua))?${RB}`), (m, a, b) => {
      const i = m.indices;
      if (!okw(i[2][0], i[2][1], UNITOK[m[2]])) return null;
      if (m[3] && !okw(i[3][0], i[3][1], ['nữa', 'nua'])) return null;
      return { type: 'dur', ms: +m[1] * UNITK[m[2]], timed: true };
    });
    run(R(`${LB}(nua)\\s*(tieng|gio)\\s*(nua)${RB}`), (m) => {
      const i = m.indices;
      if (!okw(i[1][0], i[1][1], ['nửa', 'nua']) || !okw(i[2][0], i[2][1], UNITOK[m[2]]) || !okw(i[3][0], i[3][1], ['nữa', 'nua'])) return null;
      return { type: 'dur', ms: HOUR / 2, timed: true };
    });
    run(R(`${NLB}(\\d{1,2})\\s*(h|gio|g)\\s*(\\d{2})\\s*(nua)${RB}`), (m) => {
      const i = m.indices;
      if (+m[3] > 59 || !okw(i[2][0], i[2][1], UNITOK[m[2]] || ['g']) || !okw(i[4][0], i[4][1], ['nữa', 'nua'])) return null;
      if (m[2] === 'g' && up[i[2][0]]) return null;
      return { type: 'dur', ms: +m[1] * HOUR + (+m[3]) * MIN, timed: true };
    });
    run(R(`${NLB}(\\d{1,3})\\s*(tieng|gio|h)\\s*(\\d{1,2})\\s*(phut|ph|p)\\s*(nua|sau)${RB}`), (m, a, b) => {
      const i = m.indices;
      if (!okw(i[2][0], i[2][1], UNITOK[m[2]]) || !okw(i[4][0], i[4][1], UNITOK[m[4]]) || !okw(i[5][0], i[5][1], ['nữa', 'nua', 'sau'])) return null;
      return { type: 'dur', ms: +m[1] * HOUR + (+m[3]) * MIN, timed: true };
    });
    run(R(`${NLB}(\\d{1,3})\\s*(giay|phut|ph|p|tieng|gio|h|ngay|tuan)\\s*(?:(ruoi)\\s*)?(nua|sau|toi)${RB}`), (m, a, b) => {
      const i = m.indices, u = m[2];
      if (!okw(i[2][0], i[2][1], UNITOK[u])) return null;
      if (/(?:^|\s)thu\s*$/.test(f.slice(0, a))) return null;
      if (m[3] && !okw(i[3][0], i[3][1], ['rưỡi', 'ruoi'])) return null;
      if (m[3] && u !== 'tieng' && u !== 'gio') return null;
      const wd = lo.slice(i[4][0], i[4][1]);
      if (m[4] === 'toi') { if (wd === 'tối') return null; if (wd === 'toi' && (u === 'gio' || u === 'h')) return null; if (wd !== 'tới' && wd !== 'toi') return null; }
      else if (wd !== 'nữa' && wd !== 'nua' && wd !== 'sau') return null;
      return { type: 'dur', ms: +m[1] * UNITK[u] + (m[3] ? HOUR / 2 : 0), timed: u !== 'ngay' && u !== 'tuan' };
    });
    run(R(`${LB}sau\\s*(\\d{1,3})\\s*(giay|phut|ph|p|tieng|ngay|tuan)${RB}`), (m, a, b) => {
      const i = m.indices;
      if (lo.slice(a, a + 3) !== 'sau' || !okw(i[2][0], i[2][1], UNITOK[m[2]])) return null;
      return { type: 'dur', ms: +m[1] * UNITK[m[2]], timed: m[2] !== 'ngay' && m[2] !== 'tuan' };
    });

    /* ngày cụ thể */
    const dateTok = (d, mo, y) => (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) ? { type: 'date', d, mo, y } : null;
    const TIMEISH = /^\s*(?:(?:luc|vao)\s+)?\d{1,2}\s*(?:h|g|gio|:\d|ruoi|\s+(?:sang|trua|chieu|toi|dem)(?![\p{L}\p{N}]))/u;
    const FRACDEN = [2, 3, 4, 5, 6, 8];
    run(R(`(?:${LB}ngay\\s*)?(?<![${LN}./:])(\\d{1,2})\\s*\\/\\s*(\\d{1,2})(?:\\s*\\/\\s*(\\d{4}|\\d{2}))?(?![\\d/])`), (m, a, b) => {
      const ng = m[0].startsWith('ngay');
      if (ng && !okw(a, a + 4, ['ngày', 'ngay'])) return null;
      const d = +m[1], mo = +m[2];
      if (!m[3] && !ng && d < mo && FRACDEN.indexOf(mo) >= 0 && !TIMEISH.test(f.slice(b))) return null; /* phân số: 3/4 cuốn, 1/2 cái bánh */
      return dateTok(d, mo, m[3] ? (m[3].length === 2 ? 2000 + (+m[3]) : +m[3]) : undefined) || { type: 'bad' };
    });
    run(R(`(?:${LB}ngay\\s*)?(?<![${LN}./:\\-])(\\d{1,2})\\s*-\\s*(\\d{1,2})(?:\\s*-\\s*(\\d{4}|\\d{2}))?(?![\\d\\-/])`), (m, a, b) => {
      const ng = m[0].startsWith('ngay');
      if (ng && !okw(a, a + 4, ['ngày', 'ngay'])) return null;
      if (!m[3] && !ng && !TIMEISH.test(f.slice(b))) return null; /* "50-60k", "2-3 lần" không phải ngày */
      return dateTok(+m[1], +m[2], m[3] ? (m[3].length === 2 ? 2000 + (+m[3]) : +m[3]) : undefined);
    });
    run(R(`${LB}ngay\\s*(\\d{1,2})\\s*thang\\s*(\\d{1,2})(?:\\s*nam\\s*(\\d{4}))?${RB}`), (m, a) => {
      const i = m.indices;
      if (!okw(a, a + 4, ['ngày', 'ngay'])) return null;
      const th = f.indexOf('thang', i[1][1]);
      if (!okw(th, th + 5, ['tháng', 'thang'])) return null;
      return dateTok(+m[1], +m[2], m[3] ? +m[3] : undefined);
    });
    run(R(`${LB}ngay\\s*(\\d{1,2})${RB}`), (m, a, b) => {
      const d = +m[1];
      if (!okw(a, a + 4, ['ngày', 'ngay']) || d < 1 || d > 31) return null;
      if (/(?:^|\s)(?:moi|hang|ca|qua|trong|vai|may|nhieu|tung|cac|nhung|\d+)\s+$/.test(f.slice(0, a)) || /\d\s*$/.test(f.slice(0, a))) return null;
      if (/^\s*(?:lan|dem|cai|buoi|bua|tieng|gio|phut|nghin|ngan|trieu|tr|k|lit|trang|ly|chuyen|ngay|tuan|thang|nua|nay|truoc|sau|do|roi|qua|cua|[\p{N}])/u.test(f.slice(b))) return null;
      return { type: 'date', d, mo: 0 };
    });
    run(R(`${LB}cuoi\\s*thang${RB}`), (m, a, b) => {
      const th = f.indexOf('thang', a);
      return okw(a, a + 4, ['cuối', 'cuoi']) && okw(th, th + 5, ['tháng', 'thang']) ? { type: 'eom' } : null;
    });
    /* thứ trong tuần */
    run(R(`${LB}(?:(chu\\s*nhat)|(cn)|thu\\s*(hai|ba|tu|bon|nam|sau|bay|[2-7])|t([2-7]))${RB}`), (m, a, b) => {
      const i = m.indices;
      if (m[1]) { const nh = f.indexOf('nhat', a); return okw(a, a + 3, ['chủ', 'chu']) && okw(nh, nh + 4, ['nhật', 'nhat']) ? { type: 'dow', dow: 0 } : null; }
      if (m[2]) return { type: 'dow', dow: 0 };
      if (m[4]) return { type: 'dow', dow: +m[4] - 1 };
      if (!okw(a, a + 3, ['thứ', 'thu'])) return null;
      const wd = m[3];
      if (/^\d$/.test(wd)) return { type: 'dow', dow: +wd - 1 };
      const w0 = i[3][0], w1 = i[3][1];
      if (!okw(w0, w1, DOWOK[wd])) return null;
      const accented = lo.slice(a, a + 3) === 'thứ' || lo.slice(w0, w1) !== f.slice(w0, w1);
      if (!accented) {
        if ((wd === 'nam' || wd === 'tu' || wd === 'ba') && up[w0]) return null;
        if (wd === 'tu' && !/^\s*(?:$|\d|sang|trua|chieu|toi|dem|khuya|luc|vao|tuan|nay|nhe)/.test(f.slice(b))) return null;
      }
      return { type: 'dow', dow: DOWMAP[wd] - 1 };
    });
    run(R(`${LB}tuan\\s*(sau|toi)${RB}`), (m, a) => {
      const i = m.indices, wd = lo.slice(i[1][0], i[1][1]);
      return okw(a, a + 4, ['tuần', 'tuan']) && (wd === 'sau' || wd === 'tới' || wd === 'toi') ? { type: 'weeknext' } : null;
    });
    run(R(`${LB}cuoi\\s*tuan${RB}`), (m, a) => {
      const tu = f.indexOf('tuan', a);
      return okw(a, a + 4, ['cuối', 'cuoi']) && okw(tu, tu + 4, ['tuần', 'tuan']) ? { type: 'weekend' } : null;
    });
    run(R(`${LB}mai\\s*mot${RB}`), (m, a, b) => /^(?:mai mốt|mai mot)$/.test(lo.slice(a, b).replace(/\s+/g, ' ')) ? { type: 'maimot' } : null);
    run(R(`${LB}nua\\s*dem${RB}`), (m, a, b) => /^(?:nửa|nua) (?:đêm|dem)$/.test(lo.slice(a, b).replace(/\s+/g, ' ')) ? { type: 'clock', h: 24, mi: 0 } : null);
    run(R(`${LB}(?:(ngay)\\s*)?(mot|kia)${RB}`), (m, a) => {
      const i = m.indices, wd = lo.slice(i[2][0], i[2][1]);
      if (m[1] && !okw(i[1][0], i[1][1], ['ngày', 'ngay'])) return null;
      if (m[2] === 'kia') return m[1] ? { type: 'mot' } : null;
      if (wd === 'mốt') return { type: 'mot' };
      return wd === 'mot' && m[1] && lo.slice(i[1][0], i[1][1]) === 'ngay' ? { type: 'mot' } : null;
    });
    run(R(`(?:${LB}(?:ngay|ng)\\s*mai|${LB}mai)${RB}`), (m, a, b) => {
      if (!okw(b - 3, b, ['mai'])) return null;
      if (b - a > 3) { const pre = lo.slice(a, b).replace(/\s*mai$/, ''); if (pre !== 'ng' && pre !== 'ngày' && pre !== 'ngay') return null; }
      else if (FLOWER.test(f.slice(0, a)) || (up[a] && TITLES.test(f.slice(0, a)))) return null;
      return { type: 'mai' };
    });
    run(R(`(?:${LB}(hom|bua)\\s*nay|${LB}nay)${RB}`), (m, a, b) => {
      const i = m.indices, wd = lo.slice(b - 3, b);
      if (m[1] && !okw(i[1][0], i[1][1], ['hôm', 'hom', 'bữa', 'bua'])) return null;
      if (!m[1] && NOT_NAY.test(f.slice(0, a))) return (wd === 'nay' || wd === 'này') ? { type: 'this' } : null;
      return wd === 'nay' ? { type: 'nay' } : null;
    });

    /* giờ */
    const hmOK = (h, mi) => h >= 0 && h <= 24 && mi >= 0 && mi <= 59;
    run(R(`${NLB}(\\d{1,2})\\s*(?:(gio|h|g)\\s*)?(kem)\\s*(\\d{1,2})(?![\\d])(?:\\s*(?:phut|ph|p)(?![${LN}]))?`), (m, a, b) => {
      const i = m.indices, h = +m[1], k = +m[4];
      const kk = lo.slice(i[3][0], i[3][1]);
      if (kk !== 'kém' && kk !== 'kem') return null;
      if (!m[2] && kk !== 'kém') return null;
      if (m[2] === 'gio' && !okw(i[2][0], i[2][1], ['giờ', 'gio'])) return null;
      if (m[2] === 'g' && up[i[2][0]]) return null;
      if (!(h >= 1 && h <= 24 && k >= 1 && k <= 59)) return null;
      return { type: 'clock', h: h - 1, mi: 60 - k };
    });
    run(R(`${NLB}(\\d{1,2})\\s*(?:(gio|h|g)\\s*)?ruoi${RB}`), (m, a, b) => {
      const i = m.indices, h = +m[1];
      const rr = lo.slice(b - 4, b);
      if (rr !== 'rưỡi' && rr !== 'ruoi') return null;
      if (m[2] === 'gio' && !okw(i[2][0], i[2][1], ['giờ', 'gio'])) return null;
      if (m[2] === 'g' && up[i[2][0]]) return null;
      if (!m[2] && h > 12) return null;
      if (!(h >= 0 && h <= 24)) return null;
      return { type: 'clock', h, mi: 30 };
    });
    run(R(`${NLB}(\\d{1,2})(?:(\\s*gio)|(\\s*h)|(g))(?!\\p{L})(?:(\\d{1,2})|\\s+(\\d{2})|\\s+(\\d)(?=\\s*(?:phut|p)(?![${LN}])))?(?![\\d])`), (m, a, b) => {
      const i = m.indices, h = +m[1];
      if (m[2] && !okw(i[2][0] + m[2].length - 3, i[2][1], ['giờ', 'gio'])) return null;
      if (m[4] && up[i[4][0]]) return null;
      const mi = +(m[5] || m[6] || m[7] || 0);
      if (!hmOK(h, mi)) return null;
      return { type: 'clock', h, mi };
    });
    run(R(`${NLB}(\\d{1,2}):(\\d{2})(?![\\d:])`), (m) => hmOK(+m[1], +m[2]) ? { type: 'clock', h: +m[1], mi: +m[2] } : null);
    /* "9.30", "9.30 sáng": giờ kiểu dấu chấm — chỉ nhận khi có ngữ cảnh giờ (buổi/ngày kề bên hoặc "lúc/vào"); không nhận "1.5kg", "2.000.000" */
    run(R(`${NLB}(\\d{1,2})\\.(\\d{2})(?![\\d]|[.,]\\d)`), (m, a, b) => {
      const h = +m[1], mi = +m[2];
      if (!hmOK(h, mi) || (h === 24 && mi > 0)) return null;
      if (/^[\p{L}%]/u.test(f.slice(b))) return null;
      const after = f.slice(b), before = f.slice(0, a);
      const ctx = /^\s*(?:sang|trua|chieu|toi|dem|khuya|mai|nay|hom nay|mot|kia|t[2-7]|cn|thu\s*(?:hai|ba|tu|bon|nam|sau|bay|[2-7])|chu\s*nhat|ngay\s*mai)(?![\p{L}\p{N}])/u.test(after)
        || /(?:^|\s)(?:luc|vao|khoang|tam)\s+$/.test(before)
        || /(?:^|\s)(?:mai|nay|hom nay|sang|trua|chieu|toi|dem|t[2-7]|cn|chu nhat|thu\s*(?:hai|ba|tu|bon|nam|sau|bay|[2-7]))\s+$/.test(before);
      if (ctx) return { type: 'clock', h, mi };
      /* trần trụi ("họp 9.30"): chỉ nhận khi không giống số đo/giá/phiên bản */
      if (/^\s*(?:kg|g|gam|lan|lit|l|ml|cm|mm|m|km|do|k|tr|d|vnd|usd|dong|nghin|ngan|trieu|ty|phan|cai|qua|trai|gb|mb|tb|kb|%|x|nam|tuoi)(?![\p{L}\p{N}])/u.test(after)) return null;
      if (/(?:^|\s)(?:gia|tien|phi|ver|version|v|chuong|muc|bai|dieu|so|ma|diem|ty le|ti le|tong|iphone|ios|android|python|node|win|windows|macos|chrome|tang|phong|lop|nhom|dong|hang|cot|trang|buoc|giai|vong|luong|can nang|chieu cao|nhiet do|\d+|[=x+*\-])\s*$/u.test(before)) return null;
      return { type: 'clock', h, mi };
    });
    run(R(`${NLB}(\\d{1,2})\\s*(sang|trua|chieu|toi)${RB}`), (m, a, b) => {
      const i = m.indices, h = +m[1], p = m[2], wd = lo.slice(i[2][0], i[2][1]);
      if (!(h >= 1 && h <= 12) || NUMPER_BLOCK.test(f.slice(0, a))) return null;
      if (wd !== PERCANON[p] && !(wd === p && (p === 'trua' || p === 'chieu'))) return null;
      return { type: 'clock', h, mi: 0, per: p, perA: i[2][0] };
    });

    /* buổi trong ngày */
    const adjTypes = { sang: ['clock', 'mai', 'nay'], toi: ['clock', 'mai', 'nay', 'dow'], dem: ['clock', 'mai', 'nay', 'dow'] };
    const adj = (a, b, types) => toks.some(t => types.indexOf(t.type) >= 0 &&
      ((t.b <= a && /^\s*$/.test(f.slice(t.b, a))) || (t.a >= b && /^\s*$/.test(f.slice(b, t.a)))));
    run(R(`${LB}(sang|trua|chieu|toi|dem|khuya)${RB}`), (m, a, b) => {
      const p = m[1], wd = lo.slice(a, b);
      let bs = -1;
      if (/(?:^|\s)buoi\s+$/.test(f.slice(0, a))) { bs = f.slice(0, a).lastIndexOf('buoi'); if (!okw(bs, bs + 4, ['buổi', 'buoi'])) bs = -1; }
      const buoi = bs >= 0;
      const nx = (f.slice(b).match(/^\s*(\S+)/) || [])[1] || '';
      if (PEREXCL[p] && PEREXCL[p].test(nx)) return null;
      if (wd !== PERCANON[p] && wd !== p) return null;
      if (wd === p && wd !== PERCANON[p] && (p === 'sang' || p === 'toi' || p === 'dem') && !buoi && !adj(a, b, adjTypes[p])) return null;
      const t = { type: 'per', per: p };
      if (buoi) t.a = bs;
      return t;
    });
    toks.sort((x, y) => x.a - y.a);
    return { toks, P };
  }

  /** Trả về {date: Date, timed: boolean} hoặc null nếu câu không có thời gian. */
  function parseWhen(raw, nowD = new Date()) {
    const toks = scan(raw).toks;
    const now = nowD.getTime();
    const has = ty => toks.find(t => t.type === ty);
    if (has('bad') || has('maimot')) return null; /* ngày vô lý -> bỏ cả câu; "mai mốt" chỉ là hạn mềm, không có giờ */
    const dur = has('dur');
    if (dur) return { date: new Date(now + dur.ms), timed: dur.timed };
    const today = new Date(nowD); today.setHours(0, 0, 0, 0);
    let base = new Date(today), dayset = false, dowExact = false, t;
    const plus = n => { base = new Date(today); base.setDate(base.getDate() + n); dayset = true; };
    const toMon = () => ((8 - today.getDay()) % 7) || 7;
    let dateOk = false;
    if ((t = has('date'))) {
      if (!t.mo) { /* "ngày 20": tháng này, đã qua thì tháng sau (tìm tháng có đủ ngày) */
        for (let k = 0; k < 13 && !dateOk; k++) {
          const b = new Date(today.getFullYear(), today.getMonth() + k, t.d);
          if (b.getDate() === t.d && b >= today) { base = b; dayset = true; dateOk = true; }
        }
        if (!dateOk) return null;
      } else {
        const y = t.y || today.getFullYear();
        let b = new Date(y, t.mo - 1, t.d);
        if (!t.y && b < today) b = new Date(y + 1, t.mo - 1, t.d);
        if (b.getMonth() === t.mo - 1 && b.getDate() === t.d) { base = b; dayset = true; dateOk = true; }
        else return null; /* 30/2: ngày không tồn tại */
      }
    }
    if (dateOk) { /* đã có ngày */ }
    else if (has('eom')) { base = new Date(today.getFullYear(), today.getMonth() + 1, 0); dayset = true; }
    else if ((t = has('dow'))) {
      if (has('weeknext')) plus(toMon() + ((t.dow + 6) % 7));
      else { const d = (t.dow - today.getDay() + 7) % 7; plus(d); dowExact = d === 0; }
    }
    else if (has('weeknext')) plus(toMon());
    else if (has('weekend')) plus((6 - today.getDay() + 7) % 7);
    else if (has('mot')) plus(2);
    else if (has('mai')) plus(1);
    const explicitToday = !!has('nay');
    const pt = toks.find(x => x.per), per = pt ? pt.per : '';
    const ck = has('clock');
    if (!ck && !per && !dayset && !explicitToday) return null;
    let h = ck ? ck.h : ({ sang: 8, trua: 12, chieu: 15, toi: 20, dem: 22, khuya: 23 }[per] ?? 9);
    const mi = ck ? ck.mi : 0;
    let extra = 0;
    if (h === 24) { h = 0; extra = 1; }
    if (per === 'chieu' || per === 'toi') { if (h < 12) h += 12; }
    else if (per === 'dem' || per === 'khuya') { if (h === 12) h = 0; else if (h >= 5 && h < 12) h += 12; }
    if (per === 'trua' && h <= 3) h += 12;
    const nightAm = (per === 'dem' || per === 'khuya') && h <= 4 && !!ck;
    const d = new Date(base); d.setHours(h, mi, 0, 0);
    if (extra) d.setDate(d.getDate() + 1);
    if (nightAm && (dayset || explicitToday)) d.setDate(d.getDate() + 1);
    if (!dayset && d.getTime() <= now) {
      if (!per && h > 0 && h < 12 && d.getTime() + 12 * HOUR > now) d.setTime(d.getTime() + 12 * HOUR);
      else if (!explicitToday) d.setDate(d.getDate() + 1);
    }
    if (dowExact && d.getTime() <= now) d.setDate(d.getDate() + 7);
    return { date: d, timed: !!(ck || per) };
  }

  /** Các cụm chỉ thời gian đã nhận ra: [[start,end], ...] theo chỉ số CHUỖI GỐC. */
  function whenSpans(text) {
    const sc = scan(text), P = sc.P, f = P.f, lo = P.lo, toks = sc.toks.filter(t => t.type !== 'bad');
    if (!toks.length) return [];
    const groups = [];
    for (const t of toks) {
      const g = groups[groups.length - 1];
      if (g) {
        const gap = f.slice(g.b, t.a);
        const both = g.last === 'clock' && t.type === 'clock';
        if (t.a >= g.b && (/^[\s,]*(?:(?:vao|luc|khoang|tam)[\s,]+)*$/.test(gap) || (both && /^\s*(?:-|~|den)\s*$/.test(gap)))) { g.b = Math.max(g.b, t.b); g.last = t.type; continue; }
        if (t.a < g.b) { g.b = Math.max(g.b, t.b); continue; }
      }
      groups.push({ a: t.a, b: t.b, last: t.type });
    }
    return groups.map(g => {
      let a = g.a;
      for (;;) {
        const m = f.slice(0, a).match(/(?:^|\s)(vao|luc|khoang|tam)\s+$/);
        if (!m) break;
        const ws = f.slice(0, a).lastIndexOf(m[1]);
        if (['vào', 'vao', 'lúc', 'luc', 'khoảng', 'khoang', 'tầm', 'tam'].indexOf(lo.slice(ws, ws + m[1].length)) < 0) break;
        a = ws;
      }
      let e = g.b;
      for (const [x, y] of (P.nw || [])) if (e > x && e < y) e = y;
      return [P.st[a], P.en[e - 1]];
    });
  }

  /** Phân tích toàn bộ note. due=null nếu không có giờ. */
  function analyze(text, now = Date.now()) {
    const w = parseWhen(text, new Date(now)), intent = intentOf(text);
    const due = w ? w.date.getTime() : null;
    return { due, timed: w ? w.timed : false, intent: intent.k, intentLabel: intent.label, lead: due ? leadFor(intent, due, w.timed, now) : 0 };
  }

  const sod = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  function whenLabel(t) {
    const diff = Math.round((sod(t) - sod(Date.now())) / DAY);
    if (diff === 0) return hm(t) + ' hôm nay';
    if (diff === 1) return hm(t) + ' ngày mai';
    const d = new Date(t); return `${hm(t)} · ${WD[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
  function dur(ms) {
    ms = Math.abs(ms);
    const s = Math.round(ms / 1e3); if (s < 60) return s + ' giây';
    const m = Math.round(ms / MIN); if (m < 60) return m + ' phút';
    const h = Math.floor(m / 60); if (h < 24) return h + ' tiếng' + (m % 60 ? ' ' + (m % 60) + ' phút' : '');
    return Math.round(ms / DAY) + ' ngày';
  }
  const leadLabel = l => l >= DAY ? 'báo trước 1 ngày' : l > 0 ? 'báo trước ' + dur(l) : 'báo đúng giờ';
  const intentLabel = k => (INTENTS.find(i => i.k === k) || DEFAULT_INTENT).label;

  const api = { MIN, HOUR, DAY, fold, normNum, whenSpans, parseWhen, analyze, intentOf, intentLabel, leadFor, whenLabel, dur, leadLabel, hm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
