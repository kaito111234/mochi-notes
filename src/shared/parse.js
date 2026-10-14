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

  function intentOf(text) {
    const s = String(text || '').toLowerCase();
    return INTENTS.find(i => i.re.test(s)) || DEFAULT_INTENT;
  }
  function leadFor(intent, due, timed, now = Date.now()) {
    if (!timed && intent.lead !== 'day' && intent.lead !== 'due') return 0;
    if (intent.lead === 'day') return due - now > 26 * HOUR ? DAY : 0;
    if (intent.lead === 'due') return due - now > 26 * HOUR ? DAY : HOUR;
    return intent.lead;
  }

  const DOWN = { hai: 2, ba: 3, 'tư': 4, 'bốn': 4, 'năm': 5, 'sáu': 6, 'bảy': 7 };
  /** Trả về {date: Date, timed: boolean} hoặc null nếu câu không có thời gian. */
  function parseWhen(raw, nowD = new Date()) {
    const s = ' ' + String(raw || '').toLowerCase().replace(/[,.!?;()"]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const now = nowD.getTime();
    let m = s.match(/(\d+)\s*(giây|phút|ph|p|tiếng|giờ|h|ngày|tuần)\s*(nữa|sau|tới)/u);
    if (m) {
      const k = { 'giây': 1e3, 'phút': MIN, ph: MIN, p: MIN, 'tiếng': HOUR, 'giờ': HOUR, h: HOUR, 'ngày': DAY, 'tuần': 7 * DAY }[m[2]];
      return { date: new Date(now + (+m[1]) * k), timed: !/ngày|tuần/.test(m[2]) };
    }
    const today = new Date(nowD); today.setHours(0, 0, 0, 0);
    let base = new Date(today), dayset = false, dowExact = false;
    const plus = n => { base = new Date(today); base.setDate(base.getDate() + n); dayset = true; };
    const toMon = () => ((8 - today.getDay()) % 7) || 7;
    if ((m = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/)) || (m = s.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})/))) {
      const y = m[3] ? (+m[3] < 100 ? 2000 + (+m[3]) : +m[3]) : today.getFullYear();
      base = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && base < today) base.setFullYear(y + 1); dayset = true;
    } else if (/cuối tháng/.test(s)) { base = new Date(today.getFullYear(), today.getMonth() + 1, 0); dayset = true; }
    else if ((m = s.match(/chủ nhật|\scn\s|thứ\s*(hai|ba|tư|bốn|năm|sáu|bảy|[2-7])/u))) {
      const dow = m[0].trim().startsWith('ch') || m[0].trim() === 'cn' ? 0 : ((DOWN[m[1]] || +m[1]) - 1);
      if (/tuần sau|tuần tới/.test(s)) plus(toMon() + ((dow + 6) % 7));
      else { const d = (dow - today.getDay() + 7) % 7; plus(d); dowExact = d === 0; }
    }
    else if (/tuần sau|tuần tới/.test(s)) plus(toMon());
    else if (/cuối tuần/.test(s)) plus((6 - today.getDay() + 7) % 7);
    else if (/ngày mốt|ngày kia/.test(s)) plus(2);
    else if (/ mai /.test(s)) plus(1);
    const explicitToday = /hôm nay| nay /.test(s);
    const per = (s.match(/sáng|trưa|chiều|tối|đêm|khuya/) || [])[0] || '';
    const tm = s.match(/(\d{1,2})\s*(?:giờ|h|g|:)(?!\p{L})\s*(\d{1,2})?/u);
    if (!tm && !per && !dayset && !explicitToday) return null;
    let h = tm ? +tm[1] : ({ 'sáng': 8, 'trưa': 12, 'chiều': 15, 'tối': 20, 'đêm': 22, 'khuya': 23 }[per] ?? 9);
    const mi = tm && tm[2] ? +tm[2] : (/rưỡi/.test(s) ? 30 : 0);
    if (h > 23 || mi > 59) return null;
    if (/chiều|tối|đêm|khuya/.test(per) && h < 12) h += 12;
    if (per === 'trưa' && h <= 3) h += 12;
    const d = new Date(base); d.setHours(h, mi, 0, 0);
    if (!dayset && d.getTime() <= now) {
      if (!per && h < 12 && d.getTime() + 12 * HOUR > now) d.setTime(d.getTime() + 12 * HOUR);
      else if (!explicitToday) d.setDate(d.getDate() + 1);
    }
    if (dowExact && d.getTime() <= now) d.setDate(d.getDate() + 7);
    return { date: d, timed: !!(tm || per) };
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

  const api = { MIN, HOUR, DAY, parseWhen, analyze, intentOf, intentLabel, leadFor, whenLabel, dur, leadLabel, hm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
