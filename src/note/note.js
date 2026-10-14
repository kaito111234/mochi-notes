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
  const MAXW = 1000;
  function fileToDataUrl(file) {
    return new Promise(resolve => {
      const fr = new FileReader();
      fr.onerror = () => resolve(null);
      fr.onload = () => {
        const url = String(fr.result);
        if (file.type === 'image/gif') return resolve(url);
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          if (img.naturalWidth <= MAXW && file.size < 400 * 1024) return resolve(url);
          try {
            const k = Math.min(1, MAXW / img.naturalWidth);
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85));
          } catch (_) { resolve(url); }
        };
        img.src = url;
      };
      fr.readAsDataURL(file);
    });
  }
  async function insertImages(files) {
    for (const f of files) {
      const url = await fileToDataUrl(f);
      if (url && /^data:image\//i.test(url)) { ed.focus(); document.execCommand('insertImage', false, url); }
    }
    afterEdit();
  }

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
    $('remErr').hidden = true;
    refreshRemMeta();
    openPop(remPanel, $('btnRem'));
    $('remDue').focus();
  }
  function toggleRem() { if (!remPanel.hidden) closePops(); else openRem(); }
  async function saveRem() {
    const due = new Date($('remDue').value).getTime();
    const err = $('remErr');
    if (!isFinite(due)) { err.textContent = 'Hãy chọn ngày và giờ.'; err.hidden = false; return; }
    if (due <= Date.now()) { err.textContent = 'Hãy chọn một thời điểm trong tương lai.'; err.hidden = false; return; }
    const r = await M.setReminder(id, { due, lead: +$('remLead').value || 0 });
    if (r) applyNote(r, { noHtml: true });
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
  function cmd(name) { focusEd(); document.execCommand(name, false, null); afterEdit(); }
  function hilite(key) {
    focusEd();
    const c = key === 'none' ? 'transparent' : HL[key];
    if (key !== 'none') { hlKey = key; try { localStorage.setItem('mochi.hl', key); } catch (_) {} paintHl(); }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, c);
    document.execCommand('styleWithCSS', false, false);
    afterEdit();
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
  ed.addEventListener('input', e => {
    if (e.inputType === 'insertFromDrop') { ed.innerHTML = sanitizeHtml(ed.innerHTML); }
    afterEdit();
  });
  ed.addEventListener('paste', e => {
    e.preventDefault();
    const cd = e.clipboardData; if (!cd) return;
    const files = Array.from(cd.files || []).filter(f => /^image\//.test(f.type));
    const html = cd.getData('text/html'), plain = cd.getData('text/plain');
    if (files.length && !(plain.trim() && !/<img/i.test(html))) { insertImages(files); return; }
    const clean = html ? sanitizeHtml(html) : '';
    if (clean.replace(/<[^>]*>/g, '').trim() || /<img/i.test(clean)) document.execCommand('insertHTML', false, clean);
    else if (plain) document.execCommand('insertText', false, plain);
    afterEdit();
  });
  ed.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
  ed.addEventListener('drop', e => {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); insertImages(files); }
    else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) e.preventDefault();
  });

  /* ================= Nút & phím tắt ================= */
  $('btnNew').addEventListener('click', newNote);
  $('btnClose').addEventListener('click', closeNote);
  $('btnMenu').addEventListener('click', toggleMenu);
  function newNote() { M.createNote({ nearId: id, color: note ? note.color : 'yellow' }); }
  async function closeNote() { await flush(); M.closeWindow(); }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (anyOpen()) {
        e.preventDefault(); closePops();
        if (lastTrigger && lastTrigger.id === 'btnMenu') lastTrigger.focus(); else ed.focus();
      }
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(), inEd = document.activeElement === ed;
    const run = fn => { e.preventDefault(); fn(); };
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
  })();
})();
