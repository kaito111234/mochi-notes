/* Mochi Notes — bộ chọn thoại (spec 04). Thuần JS, dùng chung main + test (require) và renderer (global MochiDialogue). */
(function (root) {
  // 31 event theo spec 04.
  const EVENTS = ['click', 'pat_head', 'pat_body', 'lift', 'drop', 'idle', 'sleepy', 'wake', 'startup', 'shutdown',
    'morning', 'noon', 'evening', 'late_night', 'pre', 'due', 'done', 'done_late', 'snooze', 'nag', 'alarm',
    'alarm_stop', 'alarm_snooze', 'memo', 'reward', 'levelup', 'feed', 'hungry', 'gacha_win', 'gacha_dup', 'note_created'];
  const REMIND_EVENTS = ['pre', 'due', 'nag', 'alarm', 'memo', 'snooze', 'alarm_snooze'];
  const NEED_TITLE = ['pre', 'due', 'nag', 'snooze', 'memo'];
  const NEED_LABEL = ['alarm', 'alarm_snooze'];
  const RANGE_KEYS = ['hour', 'energy', 'mood', 'level', 'overdue'];
  const LIST_KEYS = ['mode', 'intent', 'weekday'];
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

  /** Câu có khớp state không (khoá state không có thì bỏ qua). */
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
      if (!has(cond[k]) || !has(state[k])) continue;
      if (!Array.isArray(cond[k]) || !cond[k].includes(state[k])) return false;
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
    // Ưu tiên câu cụ thể theo intent.
    if (has(state.intent)) {
      const spec = cands.filter(l => l.cond && Array.isArray(l.cond.intent) && l.cond.intent.includes(state.intent));
      if (spec.length) cands = spec;
    }
    // Chống lặp: bỏ 5 id gần nhất; cạn thì cho lặp nhưng tránh câu cuối.
    const last5 = new Set(recent.slice(-5));
    let pool = cands.filter(l => !last5.has(l.id));
    if (!pool.length) {
      const lastId = recent[recent.length - 1];
      pool = cands.filter(l => l.id !== lastId);
      if (!pool.length) pool = cands;
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
