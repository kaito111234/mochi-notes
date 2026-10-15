/* Mochi Notes — bộ chọn thoại (spec 04). Thuần JS, dùng chung main + test (require) và renderer (global MochiDialogue). */
(function (root) {
  // 31 event theo spec 04 + 6 event Đợt 2B/3 (due_again, knock, outfit, expired_*).
  const EVENTS = ['click', 'pat_head', 'pat_body', 'lift', 'drop', 'idle', 'sleepy', 'wake', 'startup', 'shutdown',
    'morning', 'noon', 'evening', 'late_night', 'pre', 'due', 'done', 'done_late', 'snooze', 'nag', 'alarm',
    'alarm_stop', 'alarm_snooze', 'memo', 'reward', 'levelup', 'feed', 'hungry', 'gacha_win', 'gacha_dup', 'note_created',
    'due_again', 'knock', 'outfit', 'expired_done', 'expired_overdue', 'expired_checklist',
    // Đợt 3: ghi nhanh, điểm danh, nhiệm vụ, hỏi trước khi dọn note, lễ/mùa.
    'capture', 'capture_many', 'checkin', 'quest_done', 'expire_ask', 'expire_keep', 'holiday'];
  const REMIND_EVENTS = ['pre', 'due', 'nag', 'alarm', 'memo', 'snooze', 'alarm_snooze', 'due_again', 'knock'];
  const NEED_TITLE = ['pre', 'due', 'nag', 'snooze', 'memo', 'due_again', 'knock'];
  const NEED_LABEL = ['alarm', 'alarm_snooze'];
  const RANGE_KEYS = ['hour', 'energy', 'mood', 'level', 'overdue'];
  const LIST_KEYS = ['mode', 'intent', 'weekday'];
  // Khoá NGHIÊM: câu có khoá này mà state không có giá trị thì loại (xem matches).
  const DATE_KEYS = ['date', 'lunar'];            // ["MM-DD","MM-DD"]
  const ID_KEYS = ['item', 'rarity'];             // danh sách id
  const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const VAR_RE = /\{([a-z]+)\}/g;

  const has = v => v !== undefined && v !== null;
  const blank = v => v === undefined || v === null || v === '';

  /** Thay {x} bằng vars[x]; biến thiếu giữ nguyên. */
  function fill(text, vars) {
    vars = vars || {};
    return String(text).replace(VAR_RE, (m, k) => (blank(vars[k]) ? m : String(vars[k])));
  }

  function varsOf(text) {
    const out = [];
    String(text).replace(VAR_RE, (m, k) => { out.push(k); return m; });
    return out;
  }

  /** Câu có khớp state không (khoá state không có thì bỏ qua, riêng intent thì nghiêm). */
  function matches(line, state) {
    const cond = line && line.cond;
    state = state || {};
    if (!cond || typeof cond !== 'object') return true;
    for (const k of RANGE_KEYS) {
      if (!has(cond[k]) || !has(state[k])) continue;
      const r = cond[k];
      if (!Array.isArray(r) || r.length !== 2) return false;
      if (!(state[k] >= r[0] && state[k] <= r[1])) return false;
    }
    for (const k of LIST_KEYS) {
      if (!has(cond[k])) continue;
      // Intent nghiêm: câu theo intent chỉ dành cho note có intent đó; state không có intent (note thường)
      // thì loại, tránh câu kiểu "nhắc uống thuốc" cho một note bình thường.
      if (k === 'intent' && !has(state[k])) return false;
      if (!has(state[k])) continue;
      if (!Array.isArray(cond[k]) || !cond[k].includes(state[k])) return false;
    }
    // Các khoá date/lunar/item/rarity đều NGHIÊM như intent: câu "Tết", "món bánh", "hiếm" mà thiếu dữ liệu
    // (không phải dịp, không có món) thì không được rơi xuống nói chung chung ở ngày thường.
    for (const k of DATE_KEYS) {
      if (!has(cond[k])) continue;
      const r = cond[k], v = state[k];
      if (!Array.isArray(r) || r.length !== 2 || !has(v)) return false;
      // So chuỗi "MM-DD"; từ > đến nghĩa là vòng qua cuối năm. Âm lịch: tháng nhuận coi như tháng thường.
      const ok = r[0] <= r[1] ? (v >= r[0] && v <= r[1]) : (v >= r[0] || v <= r[1]);
      if (!ok) return false;
    }
    for (const k of ID_KEYS) {
      if (!has(cond[k])) continue;
      if (!has(state[k]) || !Array.isArray(cond[k]) || !cond[k].includes(state[k])) return false;
    }
    return true;
  }

  function weightOf(l) {
    const w = has(l.weight) ? Number(l.weight) : 1;
    return Number.isFinite(w) ? w : 0;
  }

  function pick(lines, event, vars, state, recent, rng) {
    if (!Array.isArray(lines)) return null;
    vars = vars || {}; state = state || {}; recent = Array.isArray(recent) ? recent : [];
    rng = typeof rng === 'function' ? rng : Math.random;
    let cands = lines.filter(l => l && l.event === event && weightOf(l) > 0 && matches(l, state)
      && varsOf(l.text).every(k => !blank(vars[k])));
    if (!cands.length) return null;
    // Ưu tiên tuyệt đối theo nhóm: cond.item > cond.rarity/cond.intent > câu khác.
    // (matches đã loại câu không khớp nên câu có cond.item/rarity/intent ở đây đều khớp state.)
    const tiers = [
      cands.filter(l => l.cond && has(l.cond.item)),
      cands.filter(l => l.cond && !has(l.cond.item) && (has(l.cond.rarity) || has(l.cond.intent))),
      cands.filter(l => !(l.cond && (has(l.cond.item) || has(l.cond.rarity) || has(l.cond.intent))))
    ];
    // Chống lặp: bỏ 5 id gần nhất; nhóm ưu tiên hết câu do chống lặp thì rơi xuống nhóm kế.
    const last5 = new Set(recent.slice(-5));
    let pool = null;
    for (const t of tiers) {
      const p = t.filter(l => !last5.has(l.id));
      if (p.length) { pool = p; break; }
    }
    if (!pool) {
      // Cạn hết: cho lặp nhưng tránh câu cuối; vẫn theo thứ tự nhóm ưu tiên.
      const lastId = recent[recent.length - 1];
      for (const t of tiers) {
        const p = t.filter(l => l.id !== lastId);
        if (p.length) { pool = p; break; }
      }
      if (!pool) pool = tiers.find(t => t.length) || cands;
    }
    const total = pool.reduce((s, l) => s + weightOf(l), 0);
    let r = rng() * total, chosen = pool[pool.length - 1];
    for (const l of pool) { r -= weightOf(l); if (r < 0) { chosen = l; break; } }
    return { id: chosen.id, text: fill(chosen.text, vars), face: chosen.face, anim: chosen.anim, effects: chosen.effects };
  }

  /** Kiểm tra kho thoại, trả mảng lỗi (string). */
  function validate(lines) {
    const errs = [];
    if (!Array.isArray(lines)) return ['kho thoại không phải mảng'];
    const seen = new Set();
    lines.forEach((l, i) => {
      const w = (l && l.id) || '#' + i;
      const e = m => errs.push(w + ': ' + m);
      if (!l || typeof l !== 'object') return e('không phải object');
      if (!l.id || typeof l.id !== 'string') e('thiếu id');
      else if (seen.has(l.id)) e('id trùng');
      else seen.add(l.id);
      if (!l.event) e('thiếu event');
      else if (!EVENTS.includes(l.event)) e('event lạ: ' + l.event);
      if (typeof l.text !== 'string' || !l.text) return e('thiếu text');
      if (has(l.face) && typeof l.face !== 'string') e('face sai kiểu');
      if (has(l.anim) && typeof l.anim !== 'string') e('anim sai kiểu');
      if (has(l.weight) && !Number.isFinite(l.weight)) e('weight sai kiểu');
      if (has(l.cond)) {
        if (typeof l.cond !== 'object' || Array.isArray(l.cond)) e('cond sai kiểu');
        else for (const k of Object.keys(l.cond)) {
          const v = l.cond[k];
          if (RANGE_KEYS.includes(k)) {
            if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || v[0] > v[1]) e('khoảng sai ở cond.' + k);
          } else if (LIST_KEYS.includes(k)) {
            if (!Array.isArray(v) || !v.length) e('danh sách sai ở cond.' + k);
          } else if (DATE_KEYS.includes(k)) {
            if (!Array.isArray(v) || v.length !== 2 || !v.every(x => typeof x === 'string' && MD_RE.test(x))) e('ngày sai ở cond.' + k + ' (cần ["MM-DD","MM-DD"])');
          } else if (ID_KEYS.includes(k)) {
            if (!Array.isArray(v) || !v.length || !v.every(x => typeof x === 'string' && x)) e('danh sách sai ở cond.' + k);
          } else e('cond khoá lạ: ' + k);
        }
      }
      const vs = varsOf(l.text);
      if (NEED_TITLE.includes(l.event) && !vs.includes('title')) e('nhắc lịch thiếu {title}');
      if (NEED_LABEL.includes(l.event) && !vs.includes('label')) e('báo thức thiếu {label}');
      const len = l.text.replace(VAR_RE, 'xxxxxxxxxxxx').length;
      const max = REMIND_EVENTS.includes(l.event) ? 120 : 80;
      if (len > max) e('quá dài (' + len + ' > ' + max + ')');
    });
    return errs;
  }

  const api = { pick, fill, matches, validate, EVENTS, REMIND_EVENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MochiDialogue = api;
})(typeof window !== 'undefined' ? window : globalThis);
