/* Mochi Notes — logic cửa sổ note */
(() => {
  'use strict';
  const M = window.mochi, P = window.MochiParse;
  const id = new URLSearchParams(location.search).get('id');
  const $ = s => document.getElementById(s);
  const body = document.body;
  const ed = $('editor'), menu = $('menu'), remPanel = $('remPanel'), hlPanel = $('hlPanel');
  const pops = [menu, remPanel, hlPanel];
  if (!id) { M.closeWindow(); return; }

  let note = null;
  let shownHtml = null;      // html mới nhất đã hiển thị/đã lưu
  let saveTimer = 0;
  let hintTimer = 0;
  let lastTrigger = null;
  let locked = false, zoom = 1, meta = { repeat: null, zoom: 1, locked: false };
  const N2 = M.notes2 || {};
  const RECUR = () => window.MochiRecur || null;

  /* ================= Sanitizer ================= */
  const ALLOW = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN', 'MARK', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'TITLE', 'LINK', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'OPTION']);
  const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%\/]+\)|hsla?\([\d\s.,%\/a-z]+\)|[a-z]+)$/i;

  function bgOf(el) {
    const v = el.style && el.style.backgroundColor;
    return v && COLOR_RE.test(v.trim()) ? v.trim() : '';
  }
  function cleanInto(src, dst, doc) {
    for (const n of Array.from(src.childNodes)) {
      if (n.nodeType === 3) { dst.appendChild(doc.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (DROP.has(tag)) continue;
      if (tag === 'IMG') {
        const s = n.getAttribute('src') || '';
        if (/^data:image\//i.test(s)) { const im = doc.createElement('img'); im.setAttribute('src', s); dst.appendChild(im); }
        continue;
      }
      if (!ALLOW.has(tag)) { cleanInto(n, dst, doc); continue; }
      if (tag === 'SPAN') {
        const bg = bgOf(n);
        if (!bg) { cleanInto(n, dst, doc); continue; }
        const el = doc.createElement('span'); el.setAttribute('style', 'background-color: ' + bg);
        cleanInto(n, el, doc); dst.appendChild(el); continue;
      }
      const el = doc.createElement(tag.toLowerCase());
      if (tag === 'MARK') { const bg = bgOf(n); if (bg) el.setAttribute('style', 'background-color: ' + bg); }
      cleanInto(n, el, doc);
      dst.appendChild(el);
    }
  }
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const out = doc.createElement('div');
    cleanInto(doc.body, out, doc);
    return out.innerHTML;
  }

  /* ================= Ảnh ================= */
  const MAXDIM = 1600;           // cạnh dài tối đa sau khi thu nhỏ
  const MAXURL = 6 * 1024 * 1024; // data URL tối đa (ký tự)
  function fileToDataUrl(file) {
    return new Promise(resolve => {
      const fr = new FileReader();
      fr.onerror = () => resolve(null);
      fr.onload = () => {
        const url = String(fr.result);
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          const big = Math.max(w, h) > MAXDIM;
          const keep = !big && file.type !== 'image/svg+xml' && (file.type === 'image/gif' ? file.size < 1.5 * 1024 * 1024 : file.size < 400 * 1024);
          if (keep) return resolve(/^data:image\//i.test(url) ? url : null);
          try {
            const k = Math.min(1, MAXDIM / Math.max(w, h));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
            const g = c.getContext('2d');
            let out = null;
            if (file.type === 'image/png') { g.drawImage(img, 0, 0, c.width, c.height); out = c.toDataURL('image/png'); }
            if (!out || out.length > 1.4e6) {
              g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
              out = c.toDataURL('image/jpeg', 0.85);
            }
            resolve(out);
          } catch (_) { resolve(null); }
        };
        img.src = url;
      };
      fr.readAsDataURL(file);
    });
  }
  async function insertImages(files) {
    if (locked) return;
    histCommit();
    let bad = 0;
    for (const f of files) {
      const url = await fileToDataUrl(f);
      if (url && url.length <= MAXURL && /^data:image\//i.test(url)) { ed.focus(); document.execCommand('insertImage', false, url); }
      else bad++;
    }
    if (bad) toast(bad === 1 ? 'Không chèn được 1 ảnh' : 'Không chèn được ' + bad + ' ảnh');
    afterEdit(); histCommit();
  }

  /* ================= Nhãn thoáng qua ================= */
  let toastTimer = 0;
  function toast(text, ms) {
    const t = $('toast'); if (!text) return;
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 1200);
  }

  /* ================= Hoàn tác / làm lại (ngăn xếp riêng) ================= */
  const hist = { stack: [], idx: -1, timer: 0, busy: false };
  const HMAX = 200;
  function selOffsets() {
    const s = getSelection();
    if (!s || !s.rangeCount || !ed.contains(s.anchorNode)) return null;
    const r = s.getRangeAt(0), pre = document.createRange();
    pre.selectNodeContents(ed);
    pre.setEnd(r.startContainer, r.startOffset); const a = pre.toString().length;
    pre.setEnd(r.endContainer, r.endOffset); const b = pre.toString().length;
    return [a, b];
  }
  function posAt(off) {
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let acc = 0, n;
    while ((n = w.nextNode())) {
      const len = n.nodeValue.length;
      if (off <= acc + len) return [n, off - acc];
      acc += len;
    }
    return [ed, ed.childNodes.length];
  }
  function histInit() { clearTimeout(hist.timer); hist.timer = 0; hist.stack = [{ html: ed.innerHTML, sel: null }]; hist.idx = 0; }
  function histCommit() {
    clearTimeout(hist.timer); hist.timer = 0;
    if (hist.busy) return;
    if (hist.idx < 0) return histInit();
    const h = ed.innerHTML, top = hist.stack[hist.idx];
    if (top && top.html === h) { const so = selOffsets(); if (so) top.sel = so; return; }
    hist.stack.length = hist.idx + 1;
    hist.stack.push({ html: h, sel: selOffsets() });
    if (hist.stack.length > HMAX + 1) hist.stack.shift();
    hist.idx = hist.stack.length - 1;
  }
  function histTyping() { clearTimeout(hist.timer); hist.timer = setTimeout(histCommit, 500); }
  function histRestore(st) {
    hist.busy = true;
    ed.innerHTML = st.html;
    ed.focus();
    if (st.sel) {
      try {
        const [n1, o1] = posAt(st.sel[0]), [n2, o2] = posAt(st.sel[1]);
        const r = document.createRange(); r.setStart(n1, o1); r.setEnd(n2, o2);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      } catch (_) {}
    } else {
      const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    hist.busy = false;
    afterEdit();
    if (!findBar.hidden) runFind(true);
  }
  function undo() {
    if (locked) return;
    if (hist.timer) histCommit();
    if (hist.idx > 0) { hist.idx--; histRestore(hist.stack[hist.idx]); }
  }
  function redo() {
    if (locked) return;
    if (hist.timer) histCommit();
    if (hist.idx < hist.stack.length - 1) { hist.idx++; histRestore(hist.stack[hist.idx]); }
  }

  /* ================= Tìm trong note ================= */
  const findBar = $('findBar'), findInput = $('findInput');
  const find = { ranges: [], cur: -1 };
  const hasHL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  let findTimer = 0;
  function foldStr(str) {
    let out = ''; const map = [];
    for (let i = 0; i < str.length; i++) {
      const f = str[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
      for (const c of f) { out += c; map.push(i); }
    }
    return { s: out, map };
  }
  function paintFind(scroll) {
    if (hasHL) {
      CSS.highlights.delete('mochi-find'); CSS.highlights.delete('mochi-find-cur');
      if (find.ranges.length) {
        CSS.highlights.set('mochi-find', new Highlight(...find.ranges));
        if (find.cur >= 0) CSS.highlights.set('mochi-find-cur', new Highlight(find.ranges[find.cur]));
      }
    }
    const n = find.ranges.length, q = findInput.value;
    findBar.classList.toggle('none', !!q && !n);
    $('findCount').textContent = !q ? '' : (n ? (find.cur + 1) + '/' + n : '0/0');
    if (scroll && find.cur >= 0) {
      const rr = find.ranges[find.cur].getBoundingClientRect(), er = ed.getBoundingClientRect();
      if (rr.top < er.top + 4 || rr.bottom > er.bottom - 4) ed.scrollTop += rr.top - er.top - er.height / 2 + rr.height / 2;
    }
  }
  function runFind(keep) {
    const prev = find.cur;
    find.ranges = []; find.cur = -1;
    const q = foldStr(findInput.value).s;
    if (q.trim()) {
      const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const f = foldStr(n.nodeValue);
        let pos = 0, i;
        while ((i = f.s.indexOf(q, pos)) !== -1) {
          const r = document.createRange();
          r.setStart(n, f.map[i]); r.setEnd(n, f.map[i + q.length - 1] + 1);
          find.ranges.push(r); pos = i + q.length;
        }
      }
      if (find.ranges.length) find.cur = keep && prev >= 0 ? Math.min(prev, find.ranges.length - 1) : 0;
    }
    paintFind(!keep);
  }
  function stepFind(d) {
    if (!find.ranges.length) return;
    find.cur = (find.cur + d + find.ranges.length) % find.ranges.length;
    paintFind(true);
  }
  function openFind() {
    closePops();
    findBar.hidden = false;
    const s = getSelection();
    if (s && s.rangeCount && ed.contains(s.anchorNode) && !s.isCollapsed) {
      const t = s.toString();
      if (t.length <= 60 && !/\n/.test(t)) findInput.value = t;
    }
    findInput.focus(); findInput.select();
    runFind(false);
  }
  function closeFind() {
    findBar.hidden = true;
    find.ranges = []; find.cur = -1;
    if (hasHL) { CSS.highlights.delete('mochi-find'); CSS.highlights.delete('mochi-find-cur'); }
    if (!locked) ed.focus();
  }
  findInput.addEventListener('input', () => runFind(false));
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  $('findNext').addEventListener('click', () => stepFind(1));
  $('findPrev').addEventListener('click', () => stepFind(-1));
  $('findClose').addEventListener('click', closeFind);
  $('findBar').addEventListener('mousedown', e => { if (e.target.closest('.fb')) e.preventDefault(); });

  /* ================= Cỡ chữ ================= */
  let zoomSaveTimer = 0;
  function applyZoom(z) {
    zoom = Math.min(3, Math.max(0.5, Number(z) || 1));
    ed.style.setProperty('--zoom', String(zoom));
  }
  function stepZoom(delta) {
    const z = delta === 0 ? 1 : Math.min(3, Math.max(0.5, Math.round((zoom + delta) * 10) / 10));
    applyZoom(z);
    toast(Math.round(z * 100) + '%', 900);
    clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(() => { if (N2.setView) N2.setView(id, { zoom: z }).catch(() => {}); }, 300);
  }
  document.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 0.1 : -0.1);
  }, { passive: false });

  /* ================= Khoá chỉ đọc ================= */
  function applyLocked(v) {
    locked = !!v;
    ed.setAttribute('contenteditable', locked ? 'false' : 'true');
    if (locked && document.activeElement === ed) { flush(); ed.blur(); }
    body.classList.toggle('locked', locked);
    $('lockInd').hidden = !locked;
    const b = $('btnLock');
    b.setAttribute('aria-pressed', String(locked));
    b.title = b.ariaLabel = locked ? 'Mở khoá note (Ctrl+Shift+K)' : 'Khoá note (Ctrl+Shift+K)';
    menu.querySelector('[data-act="lock"]').setAttribute('aria-checked', String(locked));
    menu.querySelector('[data-act="lock"] span').textContent = locked ? 'Mở khoá note' : 'Khoá note';
  }
  function setLocked(v) {
    applyLocked(v);
    if (N2.setView) N2.setView(id, { locked: !!v }).catch(() => {});
    toast(v ? 'Đã khoá note' : 'Đã mở khoá', 1000);
  }
  $('btnLock').addEventListener('click', () => setLocked(!locked));

  /* ================= Lưu ================= */
  function isEmptyEditor() { return !ed.querySelector('img, li') && ed.innerText.trim() === ''; }
  function toggleEmpty() { ed.classList.toggle('empty', isEmptyEditor()); }
  function currentHtml() { return isEmptyEditor() ? '' : ed.innerHTML; }
  function schedule() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 500); }
  async function flush() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!note) return;
    const html = currentHtml();
    if (html === shownHtml) return;
    shownHtml = html;
    const text = html ? ed.innerText : '';
    try {
      const r = await M.updateNote(id, { html, text });
      if (r) applyNote(r, { noHtml: true });
    } catch (_) { /* giữ nguyên, lần lưu sau thử lại */ shownHtml = null; }
  }
  function afterEdit() { toggleEmpty(); schedule(); updateFmtState(); }

  /* ================= Hiển thị note ================= */
  function titleOf(t) {
    const l = String(t || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
    return l.slice(0, 80) || 'Note';
  }
  function applyNote(n, opts) {
    opts = opts || {};
    const prev = note;
    note = n;
    body.dataset.color = n.color || 'yellow';
    $('pin').hidden = !n.alwaysOnTop;
    menu.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-checked', String(b.dataset.color === n.color)));
    menu.querySelector('[data-act="top"]').setAttribute('aria-checked', String(!!n.alwaysOnTop));
    if (!opts.noHtml && document.activeElement !== ed && n.html !== shownHtml) {
      shownHtml = n.html || '';
      ed.innerHTML = sanitizeHtml(shownHtml);
      toggleEmpty();
      if (hist.idx < 0) histInit(); else histCommit();
      if (!findBar.hidden) runFind(true);
    }
    document.title = titleOf(n.text);
    const r = n.reminder, pr = prev && prev.reminder;
    if (r && r.auto && !r.done && document.activeElement === ed && (!pr || pr.due !== r.due)) showHint();
    renderChip();
    if (!remPanel.hidden) refreshRemMeta();
  }
  function showHint() {
    const h = $('hint'); h.hidden = false;
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { h.hidden = true; }, 3000);
  }

  /* ================= Chip nhắc ================= */
  const WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  function curRepeat() { return note && note.reminder ? (note.reminder.repeat || meta.repeat || null) : null; }
  function describeRep(r) {
    const R = RECUR();
    try { if (R && R.describeRepeat) return R.describeRepeat(r); } catch (_) {}
    const iv = r.interval > 1 ? r.interval : 1;
    if (r.freq === 'daily') return iv > 1 ? 'Mỗi ' + iv + ' ngày' : 'Hằng ngày';
    if (r.freq === 'weekdays') return 'Ngày thường (T2–T6)';
    if (r.freq === 'weekly') return r.byDay && r.byDay.length ? r.byDay.map(d => WD[d]).join(', ') : 'Hằng tuần';
    if (r.freq === 'monthly') return r.byMonthDay ? 'Ngày ' + r.byMonthDay + ' hằng tháng' : 'Hằng tháng';
    if (r.freq === 'hourly') return 'Mỗi ' + (iv > 1 ? iv + ' ' : '') + 'tiếng';
    return '';
  }
  function renderChip() {
    const r = note && note.reminder, row = $('chipRow'), chip = $('chip');
    row.hidden = !r;
    if (!r) { $('hint').hidden = true; return; }
    const now = Date.now();
    let cls = '', txt;
    if (r.done) { cls = 'done'; txt = 'Đã xong'; }
    else if (now >= r.due) { cls = 'over'; txt = P.whenLabel(r.due) + ' · quá hạn ' + P.dur(now - r.due); }
    else {
      txt = P.whenLabel(r.due) + ' · ' + P.leadLabel(r.lead);
      if (r.due - now <= Math.max(r.lead || 0, 15 * P.MIN)) cls = 'soon';
    }
    const rep = !r.done && curRepeat();
    if (rep) { const d = describeRep(rep); if (d) txt += ' · ' + d; }
    chip.className = 'chip ' + cls;
    chip.querySelector('.i-clock').hidden = !!r.done;
    chip.querySelector('.i-check').hidden = !r.done;
    $('chipText').textContent = txt;
    chip.title = chip.ariaLabel = 'Nhắc lịch: ' + txt;
  }
  setInterval(renderChip, 15000);

  /* ================= Popover ================= */
  function anyOpen() { return pops.some(p => !p.hidden); }
  function closePops(except) {
    pops.forEach(p => { if (p !== except && !p.hidden) p.hidden = true; });
    $('btnMenu').setAttribute('aria-expanded', String(!menu.hidden));
    $('btnHl').setAttribute('aria-expanded', String(!hlPanel.hidden));
    body.classList.toggle('pop', anyOpen());
  }
  function openPop(el, trigger) {
    closePops(el); el.hidden = false; lastTrigger = trigger || null;
    body.classList.add('pop');
    $('btnMenu').setAttribute('aria-expanded', String(!menu.hidden));
    $('btnHl').setAttribute('aria-expanded', String(!hlPanel.hidden));
  }
  document.addEventListener('mousedown', e => {
    if (!anyOpen()) return;
    if (e.target.closest('.pop, [data-pop-toggle]')) return;
    closePops();
  }, true);
  window.addEventListener('blur', () => { closePops(remPanel); });

  function openMenu(confirm) {
    $('menuMain').hidden = !!confirm; $('menuConfirm').hidden = !confirm;
    openPop(menu, $('btnMenu'));
    const f = confirm ? $('delNo') : (menu.querySelector('.sw[aria-checked="true"]') || menu.querySelector('.mi'));
    if (f) f.focus();
  }
  function toggleMenu() { if (!menu.hidden) { closePops(); $('btnMenu').focus(); } else openMenu(false); }

  menu.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !note) return;
    if (b.dataset.color) {
      body.dataset.color = b.dataset.color;
      menu.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      const r = await M.updateNote(id, { color: b.dataset.color }); if (r) applyNote(r, { noHtml: true });
      return;
    }
    switch (b.dataset.act) {
      case 'top': { const r = await M.setAlwaysOnTop(id, !note.alwaysOnTop); if (r) applyNote(r, { noHtml: true }); break; }
      case 'remind': closePops(); openRem(); break;
      case 'find': closePops(); openFind(); break;
      case 'lock': closePops(); setLocked(!locked); break;
      case 'exptxt': case 'expmd': {
        closePops();
        const fmt = b.dataset.act === 'expmd' ? 'md' : 'txt';
        if (!N2.exportNote) break;
        await flush();
        try {
          const r = await N2.exportNote(id, fmt);
          if (r && r.ok) toast('Đã xuất .' + fmt, 1800);
          else if (r && r.ok === false && !r.canceled && !r.cancelled) toast('Không xuất được', 1800);
        } catch (_) { toast('Không xuất được', 1800); }
        break;
      }
      case 'list': closePops(); M.openList(); break;
      case 'hideall': closePops(); M.hideAll(); break;
      case 'delete': openMenu(true); break;
      case 'del-no': closePops(); $('btnMenu').focus(); break;
      case 'del-yes': closePops(); M.deleteNote(id); break;
    }
  });
  menu.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(menu.querySelectorAll('.mi')).filter(x => x.offsetParent);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });

  /* ================= Panel nhắc lịch ================= */
  const pad = n => String(n).padStart(2, '0');
  function toLocalInput(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function refreshRemMeta() {
    const r = note && note.reminder;
    $('remAuto').hidden = !(r && r.auto);
    $('remOff').hidden = !r;
    $('remDone').hidden = !(r && !r.done);
  }
  function openRem() {
    if (!note) return;
    const r = note.reminder, sel = $('remLead');
    let due, lead;
    if (r) { due = r.due; lead = r.lead || 0; }
    else { due = Math.ceil((Date.now() + P.HOUR) / (5 * P.MIN)) * 5 * P.MIN; lead = 5 * P.MIN; }
    $('remDue').value = toLocalInput(due);
    Array.from(sel.querySelectorAll('option[data-extra]')).forEach(o => o.remove());
    if (!Array.from(sel.options).some(o => +o.value === lead)) {
      const o = document.createElement('option'); o.value = String(lead); o.dataset.extra = '1';
      o.textContent = P.dur(lead); sel.appendChild(o);
    }
    sel.value = String(lead);
    syncRepeatUi(due);
    $('remErr').hidden = true;
    refreshRemMeta();
    openPop(remPanel, $('btnRem'));
    $('remDue').focus();
  }
  function repKey(r) {
    if (!r) return 'none';
    if ((r.interval || 1) === 1) {
      if (r.freq === 'daily') return 'daily';
      if (r.freq === 'weekdays') return 'weekdays';
      if (r.freq === 'weekly' && (!r.byDay || r.byDay.length <= 1)) return 'weekly';
      if (r.freq === 'monthly') return 'monthly';
    }
    return 'custom';
  }
  function buildRepeat(key, ms) {
    const d = new Date(ms);
    if (key === 'daily') return { freq: 'daily' };
    if (key === 'weekdays') return { freq: 'weekdays' };
    if (key === 'weekly') return { freq: 'weekly', byDay: [d.getDay()] };
    if (key === 'monthly') return { freq: 'monthly', byMonthDay: d.getDate() };
    return null;
  }
  function syncRepeatUi(due, keepValue) {
    const sel = $('remRepeat');
    const ms = isFinite(due) ? due : Date.now(), d = new Date(ms);
    $('optWeekly').textContent = 'Hằng tuần (' + WD[d.getDay()] + ')';
    $('optMonthly').textContent = 'Hằng tháng (ngày ' + d.getDate() + ')';
    const cur = curRepeat(), key = repKey(cur);
    Array.from(sel.querySelectorAll('option[data-extra]')).forEach(o => o.remove());
    if (key === 'custom') {
      const o = document.createElement('option'); o.value = 'custom'; o.dataset.extra = '1';
      o.textContent = describeRep(cur) || 'Giữ nguyên'; sel.appendChild(o);
    }
    if (!keepValue) sel.value = key;
  }
  $('remDue').addEventListener('input', () => syncRepeatUi(new Date($('remDue').value).getTime(), true));
  function toggleRem() { if (!remPanel.hidden) closePops(); else openRem(); }
  async function saveRem() {
    const due = new Date($('remDue').value).getTime();
    const err = $('remErr');
    if (!isFinite(due)) { err.textContent = 'Hãy chọn ngày và giờ.'; err.hidden = false; return; }
    if (due <= Date.now()) { err.textContent = 'Hãy chọn một thời điểm trong tương lai.'; err.hidden = false; return; }
    const sel = $('remRepeat').value, cur = curRepeat();
    let r = await M.setReminder(id, { due, lead: +$('remLead').value || 0 });
    if (r) applyNote(r, { noHtml: true });
    if (N2.setRepeat && sel !== 'custom') {
      const want = sel === repKey(cur) ? cur : buildRepeat(sel, due);
      if (want || cur) {
        try { const r2 = await N2.setRepeat(id, want); if (r2 && r2.id) applyNote(r2, { noHtml: true }); } catch (_) {}
        try { if (N2.getMeta) { meta = await N2.getMeta(id); renderChip(); } } catch (_) {}
      }
    }
    closePops();
  }
  $('remSave').addEventListener('click', saveRem);
  $('remOff').addEventListener('click', async () => { const r = await M.setReminder(id, null); if (r) applyNote(r, { noHtml: true }); closePops(); });
  $('remDone').addEventListener('click', async () => { const r = await M.markDone(id); if (r) applyNote(r, { noHtml: true }); closePops(); });
  remPanel.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); saveRem(); } });
  $('chip').addEventListener('click', toggleRem);
  $('btnRem').addEventListener('click', toggleRem);

  /* ================= Định dạng ================= */
  const HL = { yellow: '#ffe066', green: '#9ee493', pink: '#ffa8d0', blue: '#8fcbff', purple: '#cfa8ff' };
  let hlKey = 'yellow';
  try { const k = localStorage.getItem('mochi.hl'); if (HL[k]) hlKey = k; } catch (_) {}
  function paintHl() {
    $('hlBar').style.background = HL[hlKey];
    hlPanel.querySelectorAll('.hsw').forEach(b => b.classList.toggle('last', b.dataset.hl === hlKey));
  }
  paintHl();

  function focusEd() { if (document.activeElement !== ed) ed.focus(); }
  function cmd(name) { if (locked) return; focusEd(); histCommit(); document.execCommand(name, false, null); afterEdit(); histCommit(); }
  function hilite(key) {
    if (locked) return;
    focusEd(); histCommit();
    const c = key === 'none' ? 'transparent' : HL[key];
    if (key !== 'none') { hlKey = key; try { localStorage.setItem('mochi.hl', key); } catch (_) {} paintHl(); }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, c);
    document.execCommand('styleWithCSS', false, false);
    afterEdit(); histCommit();
  }
  function updateFmtState() {
    const sel = getSelection();
    const inside = sel && sel.anchorNode && ed.contains(sel.anchorNode);
    document.querySelectorAll('.fb[data-cmd]').forEach(b => {
      let on = false;
      if (inside) { try { on = document.queryCommandState(b.dataset.cmd); } catch (_) {} }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    let hon = false;
    if (inside) {
      try { const v = document.queryCommandValue('backColor'); hon = !!v && !/rgba\(0, 0, 0, 0\)|transparent|^$/.test(v); } catch (_) {}
    }
    $('btnHl').classList.toggle('on', hon); $('btnHl').setAttribute('aria-pressed', String(hon));
  }
  document.addEventListener('selectionchange', () => { if (document.activeElement === ed) updateFmtState(); });

  $('fmt').parentNode.addEventListener('mousedown', e => { if (e.target.closest('.fb, .hsw, .btn')) e.preventDefault(); });
  $('fmt').addEventListener('click', e => {
    const b = e.target.closest('.fb'); if (!b || !b.dataset.cmd) return;
    cmd(b.dataset.cmd);
  });
  $('btnHl').addEventListener('click', () => { if (!hlPanel.hidden) closePops(); else openPop(hlPanel, $('btnHl')); });
  hlPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-hl]'); if (!b) return;
    hilite(b.dataset.hl); closePops();
  });

  /* ================= Editor events ================= */
  ed.addEventListener('focus', () => { body.classList.add('editing'); updateFmtState(); });
  ed.addEventListener('blur', () => { body.classList.remove('editing'); flush(); });
  ed.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); }
    else if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); }
  });
  ed.addEventListener('input', e => {
    if (hist.busy) return;
    if (e.inputType === 'insertFromDrop') { histCommit(); ed.innerHTML = sanitizeHtml(ed.innerHTML); }
    afterEdit();
    if (/^(insertFromDrop|deleteByCut|deleteByDrag|insertFromYank|format)/.test(e.inputType || '')) histCommit(); else histTyping();
    if (!findBar.hidden) { clearTimeout(findTimer); findTimer = setTimeout(() => runFind(true), 200); }
  });
  ed.addEventListener('paste', e => {
    e.preventDefault();
    if (locked) return;
    const cd = e.clipboardData; if (!cd) return;
    const files = Array.from(cd.files || []).filter(f => /^image\//.test(f.type));
    const html = cd.getData('text/html'), plain = cd.getData('text/plain');
    if (files.length && !(plain.trim() && !/<img/i.test(html))) { insertImages(files); return; }
    histCommit();
    const clean = html ? sanitizeHtml(html) : '';
    if (clean.replace(/<[^>]*>/g, '').trim() || /<img/i.test(clean)) document.execCommand('insertHTML', false, clean);
    else if (plain) document.execCommand('insertText', false, plain);
    afterEdit(); histCommit();
  });
  const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
  // Không bao giờ để trình duyệt điều hướng sang file được thả vào cửa sổ.
  document.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = locked ? 'none' : 'copy'; } });
  document.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });
  function placeCaretAt(x, y) {
    let r = null;
    try { r = document.caretRangeFromPoint(x, y); } catch (_) {}
    const s = getSelection();
    if (!r || !ed.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); }
    ed.focus();
    s.removeAllRanges(); s.addRange(r);
  }
  ed.addEventListener('drop', e => {
    const all = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!all.length) return;                 // kéo chữ/ảnh trong chính note: để trình duyệt xử lý
    e.preventDefault();
    if (locked) return;
    const imgs = all.filter(f => /^image\//.test(f.type));
    if (!imgs.length) { toast('Chỉ thả được ảnh'); return; }
    placeCaretAt(e.clientX, e.clientY);
    insertImages(imgs);
  });

  /* ================= Nút & phím tắt ================= */
  $('btnNew').addEventListener('click', newNote);
  $('btnClose').addEventListener('click', closeNote);
  $('btnMenu').addEventListener('click', toggleMenu);
  function newNote() { M.createNote({ nearId: id, color: note ? note.color : 'yellow' }); }
  async function closeNote() { await flush(); M.closeWindow(); }

  document.addEventListener('keydown', e => {
    if (e.key === 'F3' && !findBar.hidden) { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Escape') {
      if (!findBar.hidden && !anyOpen()) { e.preventDefault(); closeFind(); return; }
      if (anyOpen()) {
        e.preventDefault(); closePops();
        if (lastTrigger && lastTrigger.id === 'btnMenu') lastTrigger.focus(); else ed.focus();
      }
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(), inEd = document.activeElement === ed;
    const run = fn => { e.preventDefault(); fn(); };
    if (k === 'f' && !e.shiftKey) return run(openFind);
    if (e.key === '=' || e.key === '+') return run(() => stepZoom(0.1));
    if (e.key === '-' || e.key === '_') return run(() => stepZoom(-0.1));
    if (e.key === '0' && !e.shiftKey) return run(() => stepZoom(0));
    if (inEd && !e.isComposing) {
      if (k === 'z') return run(e.shiftKey ? redo : undo);
      if (k === 'y' && !e.shiftKey) return run(redo);
    }
    if (e.shiftKey && k === 'k') return run(() => setLocked(!locked));
    if (!e.shiftKey) {
      if (k === 'n') return run(newNote);
      if (k === 'd') return run(() => openMenu(true));
      if (k === 'w') return run(closeNote);
      if (!inEd) return;
      if (k === 'b') return run(() => cmd('bold'));
      if (k === 'i') return run(() => cmd('italic'));
      if (k === 'u') return run(() => cmd('underline'));
      if (k === 't') return run(() => cmd('strikeThrough'));
    } else {
      if (k === 'r') return run(toggleRem);
      if (!inEd) return;
      if (k === 'l') return run(() => cmd('insertUnorderedList'));
      if (k === 'h') return run(() => hilite(hlKey));
    }
  });

  window.addEventListener('focus', () => { body.classList.add('win-focus'); renderChip(); });
  window.addEventListener('blur', () => body.classList.remove('win-focus'));
  if (document.hasFocus()) body.classList.add('win-focus');
  window.addEventListener('beforeunload', () => { if (saveTimer) flush(); });

  /* ================= Khởi động & đồng bộ ================= */
  function applySettings(s) { body.classList.toggle('glass', !!(s && s.glass) && M.platform === 'win32'); }
  M.onSettingsChanged(applySettings);
  M.onNoteUpdated(n => { if (n && n.id === id) applyNote(n); });

  (async () => {
    let n = null, s = null;
    try { [n, s] = await Promise.all([M.getNote(id), M.getSettings()]); } catch (_) {}
    if (!n) { M.closeWindow(); return; }
    applySettings(s);
    applyNote(n);
    toggleEmpty();
    if (hist.idx < 0) histInit();
    if (N2.getMeta) { try { const m = await N2.getMeta(id); if (m) { meta = m; applyZoom(m.zoom); applyLocked(m.locked); renderChip(); } } catch (_) {} }
  })();
  if (N2.onMeta) N2.onMeta(m => {
    if (!m || m.id !== id) return;
    meta = m; applyZoom(m.zoom); applyLocked(m.locked); renderChip();
  });
})();
