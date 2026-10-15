/* Mochi Notes — hiểu thời gian & loại việc từ câu tiếng Việt.
   Dùng chung cho main (require) và renderer (<script src>, global window.MochiParse). */
(function (root) {
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const pad = n => String(n).padStart(2, '0');

  const INTENTS = [
    { k: 'meet', re: /họp|meeting|gặp|hẹn|phỏng vấn|zoom|google meet|cafe với|cà phê với|đi chơi|ăn tối với|ăn trưa với/, label: 'Họp, hẹn', lead: 10 * MIN },
    { k: 'call', re: /gọi|call|điện thoại|nhắn tin|zalo cho/, label: 'Gọi điện', lead: 5 * MIN },
    { k: 'due', re: /deadline|nộp|hạn chót|bàn giao|giao hàng|giao máy|giao bài|báo cáo|hoàn thành|dead line/, label: 'Hạn chót', lead: 'due' },
    { k: 'bday', re: /sinh nhật|sinh nhat|kỷ niệm|đám cưới|đám giỗ|ngày giỗ|đám hỏi|tiệc/, label: 'Dịp đặc biệt', lead: 'day' },
    { k: 'pay', re: /trả tiền|chuyển khoản|đóng tiền|thanh toán|trả nợ|tiền điện|tiền nhà|tiền nước|học phí/, label: 'Thanh toán', lead: HOUR },
    { k: 'pill', re: /uống thuốc|thuốc|tiêm|khám bệnh|đi khám|tái khám|nha sĩ|nhỏ mắt/, label: 'Uống thuốc', lead: 0 },
    { k: 'health', re: /uống nước|nghỉ mắt|vươn vai|đứng dậy|đi bộ|tập thể dục/, label: 'Sức khoẻ', lead: 0 },
    { k: 'buy', re: /mua|đi chợ|siêu thị|đặt hàng|order|lấy hàng|nhận hàng/, label: 'Mua sắm', lead: 30 * MIN },
    { k: 'go', re: /đón|rước|đưa |ra sân bay|chuyến bay|lên xe|bắt xe|đi tàu|chở /, label: 'Di chuyển', lead: 30 * MIN }
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
    if (intent.lead === 'due') return due - now > 26 * HOUR ? DAY : HOUR;
    return intent.lead;
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

  function scan(text) {
    const P = prep(text), f = P.f, lo = P.lo, up = P.up;
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

    /* khoảng thời gian: "5 phút nữa", "sau 2 tiếng", "1 giờ 30 phút nữa" */
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
    run(R(`(?:${LB}ngay\\s*)?(?<![${LN}./:])(\\d{1,2})\\s*\\/\\s*(\\d{1,2})(?:\\s*\\/\\s*(\\d{4}|\\d{2}))?(?![\\d/])`), (m, a) => {
      if (m[0].startsWith('ngay') && !okw(a, a + 4, ['ngày', 'ngay'])) return null;
      return dateTok(+m[1], +m[2], m[3] ? (m[3].length === 2 ? 2000 + (+m[3]) : +m[3]) : undefined);
    });
    run(R(`(?<![${LN}./:\\-])(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s*-\\s*(\\d{4}|\\d{2})(?![\\d\\-])`), (m) => dateTok(+m[1], +m[2], m[3].length === 2 ? 2000 + (+m[3]) : +m[3]));
    run(R(`${LB}ngay\\s*(\\d{1,2})\\s*thang\\s*(\\d{1,2})(?:\\s*nam\\s*(\\d{4}))?${RB}`), (m, a) => {
      const i = m.indices;
      if (!okw(a, a + 4, ['ngày', 'ngay'])) return null;
      const th = f.indexOf('thang', i[1][1]);
      if (!okw(th, th + 5, ['tháng', 'thang'])) return null;
      return dateTok(+m[1], +m[2], m[3] ? +m[3] : undefined);
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

  /* ---------- Chuẩn hoá cách nói giờ giấc về dạng parser hiểu ----------
     "nửa tiếng nữa"->"30 phút nữa", "lát nữa 5 phút"->"5 phút nữa", "tí nữa"->"10 phút nữa", "8h kém 15"->"7:45",
     "7 rưỡi"->"7h30", "ngày 20"->"20/10", "hai tiếng nữa"->"2 tiếng nữa"... Giữ nguyên mọi chữ còn lại. */
  const NUMW = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
  const foldSame = s => { let o = ''; for (const c of s) { if (c.length > 1) { o += ' '.repeat(c.length); continue; } const l = c.toLowerCase(); o += l.length !== 1 ? c : (l === 'đ' ? 'd' : (l.normalize('NFD')[0] || l)); } return o; };
  function normalizeTime(text, nowIn) {
    let s = String(text == null ? '' : text).normalize('NFC');
    if (!s || s.length > 4000) return s;
    const nowD = new Date(Number.isFinite(nowIn) ? nowIn : Date.now());
    const rules = [];
    const W = '(?<![a-z0-9])', E = '(?![a-z0-9])';
    const UNIT = '(phut|ph|p|tieng|gio|h|giay)';
    const unitName = u => (u === 'phut' || u === 'ph' || u === 'p') ? 'phút' : (u === 'giay' ? 'giây' : 'tiếng');
    // "sau/trong (vòng) hai tiếng", "hai phút nữa" -> số
    rules.push([new RegExp(String.raw`${W}(?:(sau|trong(?:\s+vong)?)\s+)?(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s+${UNIT}(?:\s+(nua|sau|toi))?${E}`, 'g'), (m, f) => {
      const hasLead = !!m[1], hasTail = !!m[4];
      if (!hasLead && !hasTail) return null;
      if (m[2] === 'sau' && !hasLead && !hasTail) return null;
      if (hasTail && m[4] === 'toi' && /^(?:gio|h)$/.test(m[3])) return null;
      return NUMW[m[2]] + ' ' + unitName(m[3]) + ' nữa';
    }]);
    rules.push([new RegExp(String.raw`${W}(?:(?:sau|trong(?:\s+vong)?)\s+)?nua\s+(tieng|gio)(?:\s+(?:nua|sau|toi))?${E}`, 'g'), () => '30 phút nữa']);
    rules.push([new RegExp(String.raw`${W}(?:trong(?:\s+vong)?)\s+(\d{1,3})\s*${UNIT}(?:\s+nua)?${E}`, 'g'), m => m[1] + ' ' + unitName(m[2]) + ' nữa']);
    rules.push([new RegExp(String.raw`${W}(\d{1,2})\s*(?:tieng|gio|h)\s*(\d{1,2})\s*(nua|sau)${E}`, 'g'), m => (+m[2] <= 59 ? m[1] + ' tiếng ' + m[2] + ' phút nữa' : null)]);
    // "lát nữa 5 phút" / "tí nữa 5p" -> "5 phút nữa"
    rules.push([new RegExp(String.raw`${W}(?:chut xiu|chut|lat|ti|xiu|chot)\s+nua\s+(\d{1,3})\s*(phut|ph|p|tieng|giay)${E}`, 'g'), m => m[1] + ' ' + unitName(m[2]) + ' nữa']);
    // "lát nữa 5h chiều": bỏ cụm "lát nữa", để giờ tự hiểu; còn lại "tí nữa" = 10 phút
    rules.push([new RegExp(String.raw`${W}(?:chut xiu|chut|lat|ti|xiu|chot)\s+nua(?=\s+(?:\d{1,2}\s*(?:h|g|gio|:)|sang|trua|chieu|toi|dem|khuya|mai|hom nay))${E}`, 'g'), () => '']);
    // "tí nữa" = 10 phút chỉ khi đứng đầu mệnh đề hoặc sau nhắc/báo/gọi và có việc đi kèm ("ăn thêm chút nữa" thì không)
    rules.push([new RegExp(String.raw`(?<=(?:^|[,;.]\s*|(?:nhac|bao|goi)(?:\s+(?:toi|minh|em|to|tui|nha|nhe))*\s+))(?:chut xiu|chut|lat|ti|xiu|chot)\s+nua(?=\s+[a-z0-9])${E}`, 'g'), () => '10 phút nữa']);
    rules.push([new RegExp(String.raw`${W}(?:sau|trong)\s+(\d{1,2})\s*(?:tieng|gio)\s*ruoi(?:\s+nua)?${E}`, 'g'), m => m[1] + ' tiếng rưỡi nữa']);
    // 8h kém 15 / 8 giờ kém 15 phút
    rules.push([new RegExp(String.raw`${W}(\d{1,2})\s*(h|g|gio)?\s*kem\s*(\d{1,2})(?:\s*(?:phut|p|ph))?(?![a-z0-9])`, 'g'), (m, f, a, o) => {
      const h = +m[1], k = +m[3];
      if (!(h >= 1 && h <= 24 && k >= 1 && k <= 59)) return null;
      if (!m[2] && o.slice(m.index, m.index + m[0].length).indexOf('kém') < 0) return null;
      return (h === 1 ? 12 : h - 1) + ':' + String(60 - k).padStart(2, '0');
    }]);
    // 7 rưỡi -> 7h30 (không đụng "1 tiếng rưỡi", "2 giờ rưỡi nữa")
    rules.push([new RegExp(String.raw`${W}(\d{1,2})\s*(?:h|g|gio)?\s*ruoi(?!\s*(?:nua|sau|toi))${E}`, 'g'), (m, f, a, o) => {
      const h = +m[1]; if (h < 0 || h > 24) return null;
      const before = f.slice(0, m.index);
      if (/(?:tieng|ty|trieu|nghin|ngan|k|cai|hop|chai|kg|lit|phan|thang|tuan)\s*$/.test(before) && !/(?:h|g|gio)/.test(m[0].replace(/ruoi.*/, '').replace(/\d/g, ''))) return null;
      return h + 'h30';
    }]);
    // ngày 20 / mùng 5 -> 20/10
    rules.push([new RegExp(String.raw`${W}(?:ngay|mung|mong)\s*(\d{1,2})(?!\s*(?:\/|-|thang|dem|moi|hang|hau|(?:lan|bua|tiet|buoi|cai|lit|vien|mui|trang|ly|coc|chai|nguoi|cuon|chiec|tran|kg|ky|lop)(?![a-z])))${E}`, 'g'), (m, f) => {
      const d = +m[1]; if (d < 1 || d > 31) return null;
      if (/(?:moi|hang|hau)\s*$/.test(f.slice(0, m.index))) return null;
      if (/\d\s*$/.test(f.slice(0, m.index))) return null;
      if (/^\s*(?:moi|hang|hau)\s*thang/.test(f.slice(m.index + m[0].length))) return null;
      let y = nowD.getFullYear(), mo = nowD.getMonth();
      // đúng hôm nay mà giờ ghi trong câu đã qua -> tháng sau
      let past = d < nowD.getDate();
      if (d === nowD.getDate()) {
        const ck = /(?<![a-z0-9])(\d{1,2})\s*(?:h|g|gio|:)(\d{2})?(?:\s*(chieu|toi))?/.exec(f);
        if (ck) { let hh = +ck[1]; if (ck[3] && hh < 12) hh += 12; past = hh * 60 + (+ck[2] || 0) <= nowD.getHours() * 60 + nowD.getMinutes(); }
      }
      if (past) { mo++; if (mo > 11) { mo = 0; y++; } }
      const dt = new Date(y, mo, d);
      if (dt.getDate() !== d) return null;
      return 'ngày ' + d + '/' + (mo + 1);
    }]);
    for (const [re, fn] of rules) {
      const f = foldSame(s);
      if (f.length !== s.length) return s;
      let out = '', pos = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(f))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        const r = fn(m, f, 0, s);
        if (r == null) continue;
        out += s.slice(pos, m.index) + r; pos = m.index + m[0].length;
      }
      if (pos) s = out + s.slice(pos);
    }
    return s.replace(/ {2,}/g, ' ');
  }

  /** Trả về {date: Date, timed: boolean} hoặc null nếu câu không có thời gian. */
  function parseWhen(raw, nowD = new Date()) {
    const toks = scan(normalizeTime(raw, nowD.getTime())).toks;
    const now = nowD.getTime();
    const has = ty => toks.find(t => t.type === ty);
    const dur = has('dur');
    if (dur) return { date: new Date(now + dur.ms), timed: dur.timed };
    const today = new Date(nowD); today.setHours(0, 0, 0, 0);
    let base = new Date(today), dayset = false, dowExact = false, t;
    const plus = n => { base = new Date(today); base.setDate(base.getDate() + n); dayset = true; };
    const toMon = () => ((8 - today.getDay()) % 7) || 7;
    let dateOk = false;
    if ((t = has('date'))) {
      const y = t.y || today.getFullYear();
      let b = new Date(y, t.mo - 1, t.d);
      if (!t.y && b < today) b = new Date(y + 1, t.mo - 1, t.d);
      if (b.getMonth() === t.mo - 1 && b.getDate() === t.d) { base = b; dayset = true; dateOk = true; }
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
    // "2h giao máy" không nói buổi: 1h–5h gần như luôn là chiều (ít ai hẹn việc lúc 2 giờ sáng); muốn sáng thì ghi "5h sáng"
    if (!per && ck && h >= 1 && h <= 5) h += 12;
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
    const { toks, P } = scan(text), f = P.f, lo = P.lo;
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
      return [P.st[a], P.en[g.b - 1]];
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

  const api = { normalizeTime, MIN, HOUR, DAY, fold, whenSpans, parseWhen, analyze, intentOf, intentLabel, leadFor, whenLabel, dur, leadLabel, hm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
