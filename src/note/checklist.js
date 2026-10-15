/* Mochi Notes — window.MochiChecklist: dòng checklist trong editor (DESIGN.md mục 5) */
(function () {
  'use strict';
  if (window.MochiChecklist) return;

  const BLOCK = /^(DIV|P|UL|OL|LI|H[1-6]|BLOCKQUOTE|PRE|TABLE)$/;
  const BLANK = s => !String(s).replace(/[\s\u00a0]/g, '');
  let N = null, ed = null, body = null, forced = false;
  let pendingEnter = null;

  const isCk = n => !!n && n.nodeType === 1 && n.tagName === 'DIV' && n.parentNode === ed && n.hasAttribute('data-ck');
  const ckLines = () => Array.from(ed.children).filter(isCk);
  const locked = () => { try { return !!N.isLocked(); } catch (_) { return false; } };
  function blankNode(n) {
    if (n.nodeType === 3) return BLANK(n.nodeValue);
    if (n.nodeType !== 1) return true;
    if (n.tagName === 'BR') return true;
    return BLANK(n.textContent) && !n.querySelector('img');
  }

  /* ---------- đếm ---------- */
  function count() {
    const l = ckLines();
    return { done: l.filter(d => d.getAttribute('data-ck') === '1').length, total: l.length };
  }
  function updateCount() {
    const el = document.getElementById('ckCount'); if (!el) return;
    const c = count();
    el.hidden = c.total === 0;
    el.textContent = c.done + '/' + c.total;
    el.classList.toggle('ck-count', true);
    el.classList.toggle('all', c.total > 0 && c.done === c.total);
  }
  function isChecklistMode() { return forced || ckLines().length > 0; }

  /* ---------- chọn vùng / dòng ---------- */
  function lineOf(node) {
    let n = node;
    if (n === ed) return null;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n || null;
  }
  function caretLine() {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed || !ed.contains(s.anchorNode)) return null;
    return lineOf(s.anchorNode);
  }
  function textBeforeCaret(line) {
    const s = getSelection(), r = document.createRange();
    r.setStart(line, 0); r.setEnd(s.anchorNode, s.anchorOffset);
    return r;
  }
  function setCaret(node, off) {
    const r = document.createRange(); r.setStart(node, off); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function keepSel(fn) {
    const s = getSelection();
    let a = null;
    if (s.rangeCount && ed.contains(s.anchorNode) && s.anchorNode.nodeType === 3) a = [s.anchorNode, s.anchorOffset];
    const res = fn();
    if (a && a[0].isConnected) { try { setCaret(a[0], a[1]); } catch (_) {} }
    return res;
  }
  function fillBr(d) { if (!d.firstChild || (BLANK(d.textContent) && !d.querySelector('br,img'))) { while (d.firstChild) d.removeChild(d.firstChild); d.appendChild(document.createElement('br')); } }

  /* bọc đoạn nội dung trần (text/inline) quanh `n` thành một div; trả div */
  function wrapRun(n) {
    if (n.nodeType === 1 && n.tagName === 'DIV') return n;
    if (n.nodeType === 1 && BLOCK.test(n.tagName)) return null;
    const isBr = x => x.nodeType === 1 && x.tagName === 'BR';
    const isBlk = x => x.nodeType === 1 && BLOCK.test(x.tagName);
    let first = n, last = n;
    while (first.previousSibling && !isBr(first.previousSibling) && !isBlk(first.previousSibling)) first = first.previousSibling;
    while (last.nextSibling && !isBr(last.nextSibling) && !isBlk(last.nextSibling)) last = last.nextSibling;
    const term = last.nextSibling && isBr(last.nextSibling) ? last.nextSibling : null;
    const d = document.createElement('div');
    ed.insertBefore(d, first);
    let c = first;
    for (;;) { const nx = c.nextSibling, stop = c === last; d.appendChild(c); if (stop) break; c = nx; }
    if (term) ed.removeChild(term);
    return d;
  }

  /* chuẩn hoá mọi nút con trực tiếp thành khối div (ul/li → div, br → dòng) */
  function normalize() {
    keepSel(() => {
      const nodes = Array.from(ed.childNodes);
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const d = document.createElement('div');
        ed.insertBefore(d, run[0]);
        run.forEach(x => d.appendChild(x));
        run = [];
      };
      for (const n of nodes) {
        if (n.nodeType === 3 && BLANK(n.nodeValue) && !run.length) { ed.removeChild(n); continue; }
        if (n.nodeType === 1 && n.tagName === 'BR') {
          if (run.length) { flush(); ed.removeChild(n); }
          else { const d = document.createElement('div'); d.appendChild(document.createElement('br')); ed.replaceChild(d, n); }
          continue;
        }
        if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
          flush();
          for (const li of Array.from(n.children)) {
            const d = document.createElement('div');
            const ck = li.getAttribute && li.getAttribute('data-ck');
            if (ck === '0' || ck === '1') d.setAttribute('data-ck', ck);
            while (li.firstChild) d.appendChild(li.firstChild);
            fillBr(d);
            ed.insertBefore(d, n);
          }
          ed.removeChild(n);
          continue;
        }
        if (n.nodeType === 1 && n.tagName === 'DIV') { flush(); continue; }
        if (n.nodeType === 1 && BLOCK.test(n.tagName)) {
          flush();
          const d = document.createElement('div');
          while (n.firstChild) d.appendChild(n.firstChild);
          fillBr(d);
          ed.replaceChild(d, n);
          continue;
        }
        run.push(n);
      }
      flush();
    });
  }

  /* ---------- bật/tắt cả note ---------- */
  const PREFIX = /^[ \t\u00a0]*(?:(?:[-*•+][ \u00a0]+)?\[([ xX]?)\][ \u00a0]*|[-*•+][ \u00a0]+|\d+[.)][ \u00a0]+)/;
  function stripPrefix(d) {
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    const t = w.nextNode(); if (!t) return null;
    const m = PREFIX.exec(t.nodeValue);
    if (!m) return null;
    t.nodeValue = t.nodeValue.slice(m[0].length);
    return m[1] && m[1].toLowerCase() === 'x' ? '1' : '0';
  }
  function allChecklist() {
    let any = false;
    for (const n of Array.from(ed.childNodes)) {
      if (blankNode(n)) continue;
      if (!isCk(n)) return false;
      any = true;
    }
    return any;
  }
  function toggleAll() {
    if (locked()) return;
    N.histCommit();
    if (allChecklist()) {
      ckLines().forEach(d => d.removeAttribute('data-ck'));
      forced = false;
    } else {
      normalize();
      Array.from(ed.children).forEach(d => {
        if (d.tagName !== 'DIV' || blankNode(d)) return;
        if (d.hasAttribute('data-ck')) return;
        const st = stripPrefix(d);
        d.setAttribute('data-ck', st === '1' ? '1' : '0');
        if (BLANK(d.textContent) && !d.querySelector('br,img')) fillBr(d);
      });
    }
    N.afterEdit(); N.histCommit(); updateCount(); updateMenuLabel();
  }
  function setMode(on) {
    forced = !!on;
    if (!on) {
      const l = ckLines();
      if (l.length === 1 && ed.children.length === 1 && blankNode(l[0]) && !ed.querySelector('img')) { N.histCommit(); ed.innerHTML = ''; N.afterEdit(); N.histCommit(); }
      updateCount();
      return;
    }
    if (locked()) return;
    const empty = !ed.querySelector('img') && BLANK(ed.textContent);
    if (empty) {
      ed.innerHTML = '<div data-ck="0"><br></div>';
      N.afterEdit();
      try { if (document.activeElement === ed) setCaret(ed.firstChild, 0); } catch (_) {}
    }
    updateCount();
  }

  /* ---------- tick ---------- */
  function toggleLine(d) {
    if (locked() || !isCk(d)) return;
    const idx = ckLines().indexOf(d);
    const done = d.getAttribute('data-ck') !== '1';
    N.histCommit();
    d.setAttribute('data-ck', done ? '1' : '0');
    N.afterEdit(); N.histCommit(); updateCount();
    try { const S = window.MochiPaperStore; if (S && typeof S.checkItem === 'function') S.checkItem(N.id, idx, done); } catch (_) {}
  }
  function boxInfo(d) {
    const cs = getComputedStyle(d, '::before');
    const top = parseFloat(cs.top) || 0, h = parseFloat(cs.height) || 16;
    return { top, h, padL: parseFloat(getComputedStyle(d).paddingLeft) || 26 };
  }
  function ckAtPoint(x, y) {
    for (const d of ckLines()) {
      const r = d.getBoundingClientRect();
      if (y < r.top || y >= r.bottom) continue;
      const b = boxInfo(d);
      if (x >= r.left - 6 && x <= r.left + b.padL - 2 && y <= r.top + b.top * 2 + b.h) return d;
      return null;
    }
    return null;
  }
  function onMouseDown(e) {
    if (e.button !== 0 || locked()) return;
    const d = ckAtPoint(e.clientX, e.clientY);
    if (!d) return;
    e.preventDefault();
    toggleLine(d);
  }

  /* ---------- gõ tự chuyển / Enter / Backspace ---------- */
  function onInput(e) {
    if (e.isComposing || locked()) return;
    const it = e.inputType;
    if (it === 'insertParagraph') {
      const pe = pendingEnter; pendingEnter = null;
      if (!pe) return;
      const line = caretLine();
      if (!line || line.nodeType !== 1) return;
      if (pe.atStart) {
        const prev = line.previousElementSibling;
        if (prev && prev.hasAttribute('data-ck')) prev.setAttribute('data-ck', '0');
        if (line.hasAttribute('data-ck')) line.setAttribute('data-ck', pe.state);
      } else if (line.hasAttribute('data-ck')) line.setAttribute('data-ck', '0');
      N.afterEdit(); updateCount();
      return;
    }
    if (it !== 'insertText' || (e.data !== ' ' && e.data !== '\u00a0')) return;
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed || !ed.contains(s.anchorNode)) return;
    let line = lineOf(s.anchorNode);
    if (!line || isCk(line)) return;
    const quick = s.anchorNode.nodeType === 3 ? s.anchorNode.nodeValue.slice(0, s.anchorOffset).replace(/\u00a0/g, ' ') : '';
    if (line.nodeType !== 1 || line.tagName !== 'DIV') {
      if (!/^(?:- )?\[[ xX]?\] $|^- $/.test(quick)) return;
      if (quick === '- ' && !isChecklistMode()) return;
      const a = [s.anchorNode, s.anchorOffset];
      line = wrapRun(line);
      if (!line) return;
      setCaret(a[0], a[1]);
    }
    const r = textBeforeCaret(line);
    const pre = r.toString().replace(/\u00a0/g, ' ');
    let m = /^(?:- )?\[([ xX]?)\] $/.exec(pre), done = false;
    if (m) done = m[1] === 'x' || m[1] === 'X';
    else if (pre === '- ' && isChecklistMode()) done = false;
    else return;
    N.histCommit();
    r.deleteContents();
    line.setAttribute('data-ck', done ? '1' : '0');
    if (BLANK(line.textContent) && !line.querySelector('br,img')) { fillBr(line); setCaret(line, 0); }
    else setCaret(r.startContainer, r.startOffset);
    N.afterEdit(); N.histCommit(); updateCount();
  }
  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229 || locked()) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const line = caretLine();
      if (!isCk(line)) { pendingEnter = null; return; }
      if (blankNode(line)) {
        e.preventDefault();
        N.histCommit();
        line.removeAttribute('data-ck');
        fillBr(line);
        N.afterEdit(); N.histCommit(); updateCount(); return;
      }
      pendingEnter = { state: line.getAttribute('data-ck'), atStart: textBeforeCaret(line).toString() === '' };
    } else if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      const line = caretLine();
      if (!isCk(line)) return;
      if (textBeforeCaret(line).toString() !== '') return;
      e.preventDefault();
      N.histCommit();
      line.removeAttribute('data-ck');
      N.afterEdit(); N.histCommit(); updateCount();
    }
  }

  /* ---------- text hook ---------- */
  function txt(n) {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1) return '';
    if (n.tagName === 'BR') return '\n';
    let s = '';
    for (const c of n.childNodes) {
      const isBlk = c.nodeType === 1 && BLOCK.test(c.tagName);
      if (isBlk && s && !s.endsWith('\n')) s += '\n';
      s += txt(c);
      if (isBlk && !s.endsWith('\n')) s += '\n';
    }
    return s;
  }
  const clean = s => s.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
  function textHook() {
    if (!ed.querySelector('[data-ck]')) return null;
    const out = []; let run = '';
    const flush = () => { if (run !== '') { out.push(clean(run)); run = ''; } };
    for (const n of Array.from(ed.childNodes)) {
      if (n.nodeType === 1 && n.tagName === 'BR') { if (run === '') out.push(''); else flush(); continue; }
      if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
        flush();
        for (const li of Array.from(n.children)) {
          const ck = li.getAttribute('data-ck');
          out.push((ck === '1' ? '- [x] ' : ck === '0' ? '- [ ] ' : '- ') + clean(txt(li)));
        }
        continue;
      }
      if (n.nodeType === 1 && BLOCK.test(n.tagName)) {
        flush();
        const ck = n.getAttribute('data-ck');
        out.push((ck === '1' ? '- [x] ' : ck === '0' ? '- [ ] ' : '') + clean(txt(n)));
        continue;
      }
      run += txt(n);
    }
    flush();
    return out.join('\n');
  }

  /* ---------- nhãn nút menu ---------- */
  function updateMenuLabel() {
    const sp = document.querySelector('#menu [data-act="checklist"] span');
    if (sp) sp.textContent = allChecklist() ? 'Bỏ checklist' : 'Chuyển thành checklist';
  }

  /* ---------- kéo đổi thứ tự ---------- */
  let handle = null, drop = null, hoverLine = null, drag = null;
  function makeHandle() {
    const NS = 'http://www.w3.org/2000/svg';
    handle = document.createElement('div');
    handle.className = 'ck-handle'; handle.hidden = true;
    handle.title = 'Kéo để đổi chỗ'; handle.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 8 12');
    [[2, 2], [6, 2], [2, 6], [6, 6], [2, 10], [6, 10]].forEach(p => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '1.15');
      svg.appendChild(c);
    });
    handle.appendChild(svg);
    drop = document.createElement('div'); drop.className = 'ck-drop'; drop.hidden = true;
    body.appendChild(handle); body.appendChild(drop);
    handle.addEventListener('pointerdown', onHandleDown);
    handle.addEventListener('pointermove', onHandleMove);
    handle.addEventListener('pointerup', onHandleUp);
    handle.addEventListener('pointercancel', () => endDrag(true));
    handle.addEventListener('lostpointercapture', () => { if (drag) endDrag(true); });
  }
  function hideHandle() { hoverLine = null; if (handle) handle.hidden = true; }
  function placeHandle(d) {
    if (!handle || locked() || !d || !d.isConnected) { hideHandle(); return; }
    hoverLine = d;
    const br = body.getBoundingClientRect(), r = d.getBoundingClientRect(), b = boxInfo(d);
    handle.style.left = Math.max(0, r.left - br.left - 13) + 'px';
    handle.style.top = Math.round(r.top - br.top + b.top + (b.h - 18) / 2) + 'px';
    handle.hidden = false;
  }
  function onHover(e) {
    if (drag || !handle) return;
    if (e.target === handle || handle.contains(e.target)) return;
    if (locked()) { hideHandle(); return; }
    const y = e.clientY;
    for (const d of ckLines()) {
      const r = d.getBoundingClientRect();
      if (y >= r.top && y < r.bottom) { if (d !== hoverLine || handle.hidden) placeHandle(d); return; }
    }
    hideHandle();
  }
  function dropTarget(y) {
    const kids = Array.from(ed.children).filter(k => k !== drag.line);
    let ref = null;
    for (const k of kids) { const r = k.getBoundingClientRect(); if (y < r.top + r.height / 2) { ref = k; break; } }
    return { ref, kids };
  }
  function onHandleDown(e) {
    if (e.button !== 0 || locked() || !hoverLine) return;
    e.preventDefault();
    const line = hoverLine;
    N.histCommit();
    if (Array.from(ed.childNodes).some(n => n.nodeType !== 1 || !(n.tagName === 'DIV'))) normalize();
    drag = { line, id: e.pointerId, moved: false, ref: undefined };
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('ck-dragging');
    line.classList.add('ck-lifted');
  }
  function onHandleMove(e) {
    if (!drag) return;
    drag.moved = true;
    const er = ed.getBoundingClientRect();
    if (e.clientY < er.top + 18) ed.scrollTop -= 10; else if (e.clientY > er.bottom - 18) ed.scrollTop += 10;
    const t = dropTarget(e.clientY);
    drag.ref = t.ref;
    const br = body.getBoundingClientRect();
    let y;
    if (t.ref) y = t.ref.getBoundingClientRect().top;
    else { const last = t.kids[t.kids.length - 1]; y = last ? last.getBoundingClientRect().bottom : er.top; }
    drop.style.top = Math.round(y - br.top) + 'px';
    drop.hidden = false;
    placeHandle(drag.line);
  }
  function onHandleUp() { endDrag(false); }
  function endDrag(cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    document.body.classList.remove('ck-dragging');
    d.line.classList.remove('ck-lifted');
    if (!d.line.getAttribute('class')) d.line.removeAttribute('class');
    drop.hidden = true;
    try { handle.releasePointerCapture(d.id); } catch (_) {}
    if (cancel || !d.moved || d.ref === undefined || locked()) { hideHandle(); return; }
    if (d.ref === d.line.nextElementSibling || d.ref === d.line) { hideHandle(); return; }
    N.histCommit();
    ed.insertBefore(d.line, d.ref);
    N.afterEdit(); N.histCommit(); updateCount();
    placeHandle(d.line);
  }

  /* ---------- khởi tạo ---------- */
  function boot() {
    N = window.MochiNote;
    if (!N || !N.editor) return false;
    ed = N.editor; body = N.body || ed.parentNode;
    if (!document.getElementById('menu')) { /* vẫn chạy được, chỉ thiếu nút menu */ }

    ed.addEventListener('mousedown', onMouseDown, true);
    ed.addEventListener('input', onInput);
    ed.addEventListener('keydown', onKeyDown);
    ed.addEventListener('scroll', hideHandle, { passive: true });
    makeHandle();
    body.addEventListener('mousemove', onHover);
    body.addEventListener('mouseleave', () => { if (!drag) hideHandle(); });

    const menu = document.getElementById('menu');
    if (menu) {
      menu.addEventListener('click', e => {
        if (!e.target.closest('[data-act="checklist"]')) return;
        toggleAll();
        try { N.closePops(); } catch (_) {}
      });
      new MutationObserver(() => { if (!menu.hidden) updateMenuLabel(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
      const bm = document.getElementById('btnMenu');
      if (bm) bm.addEventListener('click', updateMenuLabel, true);
    }

    new MutationObserver(() => {
      updateCount();
      if (hoverLine) placeHandle(hoverLine);
    }).observe(ed, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ck'] });

    try { if (Array.isArray(N.textHooks)) N.textHooks.push(textHook); } catch (_) {}
    ['note', 'ready'].forEach(ev => { try { N.on(ev, () => { updateCount(); updateMenuLabel(); }); } catch (_) {} });
    try { N.on('locked', l => { if (l) hideHandle(); }); } catch (_) {}
    updateCount(); updateMenuLabel();
    return true;
  }

  window.MochiChecklist = {
    count() { return ed ? count() : { done: 0, total: 0 }; },
    toggleAll() { if (ed) toggleAll(); },
    isChecklistMode() { return ed ? isChecklistMode() : false; },
    setMode(b) { if (ed) setMode(b); }
  };
  if (!boot()) document.addEventListener('DOMContentLoaded', boot);
})();
