#!/usr/bin/env node
'use strict';
// Sinh assets/paper/catalog.js từ assets/paper/*/paper.json (xem docs/rooms/paper/DESIGN.md mục 2.3, 2.4).
// Dùng: node src/note/tools/build-catalog.js [--strict]
const fs = require('fs');
const path = require('path');

const STRICT = process.argv.includes('--strict');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const PAPER_DIR = path.join(ROOT, 'assets', 'paper');
const OUT = path.join(PAPER_DIR, 'catalog.js');

const GROUPS = [
  { id: 'plain', name: 'Trơn' }, { id: 'cute', name: 'Dễ thương' }, { id: 'student', name: 'Học sinh' },
  { id: 'minimal', name: 'Tối giản' }, { id: 'office', name: 'Văn phòng' }, { id: 'season', name: 'Mùa & lễ' }
];
const GROUP_IDS = GROUPS.map(g => g.id);
const NOTE_COLORS = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];
const FONTS = ['itim', 'pangolin', 'mali', 'nunito', 'baloo2', 'bevietnam', 'system'];
const TEXTURES = ['none', 'speckle', 'grain', 'kraft', 'linen'];
const LINE_KINDS = ['none', 'ruled', 'grid', 'oly', 'dots', 'margin-ruled'];
const HEADER_STYLES = ['plain', 'underline', 'stamp', 'ribbon'];
const ALIGNS = ['left', 'center', 'right'];
const EDGES = [null, 'torn-top', 'torn-bottom'];
const CORNERS = [null, 'fold'];
const DECO_KINDS = ['img', 'washi'];
const WASHI_PATTERNS = ['plain', 'stripe', 'dots', 'grid'];
const POS = ['tl', 'tr', 'bl', 'br', 'top', 'bottom', 'left', 'right'];

const errors = [];
const warnings = [];
const err = (id, m) => errors.push(`[${id}] ${m}`);
const warn = (id, m) => warnings.push(`[${id}] ${m}`);

// ---- màu ----
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,\/a-z]+\)$/i;
function isColor(s) { return typeof s === 'string' && (HEX.test(s.trim()) || FUNC.test(s.trim())); }
function parseHex(s) {
  let h = s.trim().slice(1);
  if (h.length <= 4) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function parseRgb(s) {
  s = s.trim();
  if (HEX.test(s)) return parseHex(s);
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function lum(rgb) {
  const f = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function contrast(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---- kiểm một mẫu ----
function validate(p, dirName) {
  const id = dirName;
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(p)) { err(id, 'paper.json không phải object'); return; }
  if (p.id !== dirName) err(id, `id "${p.id}" khác tên thư mục "${dirName}"`);
  if (!/^[a-z0-9-]+$/.test(dirName)) err(id, 'id chỉ gồm [a-z0-9-]');
  if (typeof p.name !== 'string' || !p.name.trim()) err(id, 'thiếu name');
  if (!GROUP_IDS.includes(p.group)) err(id, `group không hợp lệ: ${p.group}`);
  else if (p.group === 'plain') err(id, 'group "plain" dành cho mẫu tự sinh');
  if (!Number.isFinite(p.order)) err(id, 'order phải là số');
  if (!NOTE_COLORS.includes(p.noteColor)) err(id, `noteColor không hợp lệ: ${p.noteColor}`);
  if (typeof p.dark !== 'boolean') err(id, 'dark phải là boolean');
  const bg = p.bg;
  if (!isObj(bg)) err(id, 'thiếu bg');
  else {
    if (!isColor(bg.color)) err(id, `bg.color không phải màu CSS: ${bg.color}`);
    if (bg.head !== 'same' && !isColor(bg.head)) err(id, `bg.head không hợp lệ: ${bg.head}`);
    if (bg.gradient != null && !(Array.isArray(bg.gradient) && bg.gradient.length >= 2 && bg.gradient.every(isColor))) err(id, 'bg.gradient phải null hoặc mảng >=2 màu');
    if (!TEXTURES.includes(bg.texture)) err(id, `bg.texture không hợp lệ: ${bg.texture}`);
  }
  const ln = p.lines;
  if (!isObj(ln)) err(id, 'thiếu lines');
  else {
    if (!LINE_KINDS.includes(ln.kind)) err(id, `lines.kind không hợp lệ: ${ln.kind}`);
    if (ln.kind !== 'none' && !isColor(ln.color)) err(id, `lines.color không hợp lệ: ${ln.color}`);
    if (!Number.isFinite(ln.step) || ln.step < 16 || ln.step > 40) err(id, 'lines.step phải 16..40');
    else if (ln.kind !== 'none' && (ln.step < 24 || ln.step > 28)) warn(id, `lines.step=${ln.step} ngoài khoảng khuyến nghị 24-28`);
    if (ln.margin != null && !isColor(ln.margin)) err(id, `lines.margin không hợp lệ: ${ln.margin}`);
    if (ln.kind === 'margin-ruled' && !ln.margin) err(id, 'margin-ruled cần lines.margin');
  }
  const h = p.header;
  if (h != null) {
    if (!isObj(h)) err(id, 'header phải null hoặc object');
    else {
      if (typeof h.text !== 'string' || !h.text) err(id, 'header.text trống');
      if (!FONTS.includes(h.font)) err(id, `header.font không hợp lệ: ${h.font}`);
      if (!isColor(h.color)) err(id, `header.color không hợp lệ: ${h.color}`);
      if (!Number.isFinite(h.size) || h.size < 10 || h.size > 40) err(id, 'header.size phải 10..40');
      if (!ALIGNS.includes(h.align)) err(id, `header.align không hợp lệ: ${h.align}`);
      if (!HEADER_STYLES.includes(h.style)) err(id, `header.style không hợp lệ: ${h.style}`);
    }
  }
  if (!isColor(p.ink)) err(id, `ink không phải màu CSS: ${p.ink}`);
  if (!FONTS.includes(p.font)) err(id, `font không hợp lệ: ${p.font}`);
  if (!EDGES.includes(p.edge === undefined ? null : p.edge)) err(id, `edge không hợp lệ: ${p.edge}`);
  if (!CORNERS.includes(p.corner === undefined ? null : p.corner)) err(id, `corner không hợp lệ: ${p.corner}`);
  if (!Array.isArray(p.deco)) err(id, 'deco phải là mảng');
  else p.deco.forEach((d, i) => {
    const t = `deco[${i}]`;
    if (!isObj(d)) return err(id, `${t} không phải object`);
    if (!DECO_KINDS.includes(d.kind)) err(id, `${t}.kind không hợp lệ: ${d.kind}`);
    if (!POS.includes(d.pos)) err(id, `${t}.pos không hợp lệ: ${d.pos}`);
    if (!Number.isFinite(d.w) || d.w <= 0) err(id, `${t}.w phải là số dương`);
    else if (d.kind === 'img' && d.pos !== 'bottom' && (d.w > 64 || (d.src || '').includes('/animals/') && d.w < 40)) warn(id, `${t}.w=${d.w} ngoài khuyến nghị (thú 40-64px, đồ ≤64px)`);
    for (const k of ['dx', 'dy', 'rot']) if (d[k] != null && !Number.isFinite(d[k])) err(id, `${t}.${k} phải là số`);
    if (d.kind === 'img') {
      if (typeof d.src !== 'string' || !d.src) err(id, `${t}.src trống`);
      else if (d.src.startsWith('/') || d.src.includes('..')) err(id, `${t}.src phải tương đối trong assets/paper/`);
      else if (!fs.existsSync(path.join(PAPER_DIR, d.src))) {
        const m = `${t}.src chưa có file: ${d.src}`;
        if (STRICT) err(id, m); else warn(id, m + ' (họa sĩ đang vẽ)');
      }
    } else if (d.kind === 'washi') {
      if (!isColor(d.color)) err(id, `${t}.color không hợp lệ: ${d.color}`);
      if (d.pattern != null && !WASHI_PATTERNS.includes(d.pattern)) err(id, `${t}.pattern không hợp lệ: ${d.pattern}`);
    }
  });
  if (typeof p.checklist !== 'boolean') err(id, 'checklist phải là boolean');
  // tương phản (WCAG): chữ thân >= 4.5; icon thanh công cụ (màu chữ) và tiêu đề lớn >= 3. --strict => lỗi, không thì cảnh báo.
  const cw = (m) => (STRICT ? err(id, m) : warn(id, m));
  const MIN_TEXT = 4.5, MIN_ICON = 3;
  if (isColor(p.ink) && bg && isColor(bg.color)) {
    const ink = parseRgb(p.ink);
    const grad = Array.isArray(bg.gradient) ? bg.gradient.filter(isColor) : [];
    const bodies = [bg.color].concat(grad);
    if (grad.length >= 2) { // màu giữa (nền thật của thanh định dạng kính giấy)
      const a = parseRgb(grad[0]), z = parseRgb(grad[grad.length - 1]);
      if (a && z) bodies.push('rgb(' + a.map((v, i) => Math.round((v + z[i]) / 2)).join(',') + ')');
    }
    const headBg = bg.head && bg.head !== 'same' && isColor(bg.head) ? bg.head : bg.color;
    for (const c of bodies) {
      const r = parseRgb(c);
      if (!r || !ink) continue;
      const cr = contrast(ink, r);
      if (cr < MIN_TEXT) cw(`tương phản chữ thân ink ${p.ink} / nền thân ${c} = ${cr.toFixed(2)} < ${MIN_TEXT}`);
      if (cr < MIN_ICON) cw(`icon thanh định dạng ${p.ink} / nền thanh ${c} = ${cr.toFixed(2)} < ${MIN_ICON}`);
    }
    const hr = parseRgb(headBg);
    if (hr && ink) {
      const cr = contrast(ink, hr);
      if (cr < MIN_ICON) cw(`icon thanh trên (ink ${p.ink}) / nền đầu giấy ${headBg} = ${cr.toFixed(2)} < ${MIN_ICON}`);
      else if (cr < MIN_TEXT) warn(id, `icon thanh trên / nền đầu giấy = ${cr.toFixed(2)} (>=3 đạt, <4.5 nên cải thiện)`);
    }
    if (h && isColor(h.color)) {
      const hc = parseRgb(h.color);
      for (const c of [headBg, bg.color]) {
        const r = parseRgb(c), cr = r && hc ? contrast(hc, r) : 99;
        if (cr < MIN_ICON) cw(`tương phản tiêu đề ${h.color} / nền ${c} = ${cr.toFixed(2)} < ${MIN_ICON}`);
      }
    }
  }
}

// ---- 7 mẫu trơn (màu từ src/note/note.css) ----
const PLAIN = [
  ['yellow', 'Vàng', '#FFF7D1', '#FFF2AB'], ['green', 'Xanh lá', '#E4F9E0', '#CBF1C4'],
  ['pink', 'Hồng', '#FFE4F1', '#FFCCE5'], ['purple', 'Tím', '#F2E6FF', '#E7CFFF'],
  ['blue', 'Xanh dương', '#E2F1FF', '#CDE9FF'], ['gray', 'Xám', '#F3F2F1', '#E0E0E0'],
  ['charcoal', 'Than', '#4A4A4A', '#3A3A3A']
];
function plainDefs() {
  return PLAIN.map(([c, name, color, head], i) => ({
    id: 'plain-' + c, name, group: 'plain', order: (i + 1) * 10, noteColor: c, dark: c === 'charcoal',
    bg: { color, head, gradient: null, texture: 'none' },
    lines: { kind: 'none', color: 'rgba(0,0,0,0)', step: 24, margin: null },
    header: null, ink: c === 'charcoal' ? '#f2f2f2' : '#1f1f1f', font: 'system',
    edge: null, corner: null, deco: [], checklist: false
  }));
}

// ---- chạy ----
function main() {
  const papers = [];
  const dirs = fs.readdirSync(PAPER_DIR, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'deco').map(d => d.name).sort();
  for (const d of dirs) {
    const f = path.join(PAPER_DIR, d, 'paper.json');
    if (!fs.existsSync(f)) { warn(d, 'thư mục không có paper.json, bỏ qua'); continue; }
    let p;
    try { p = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(d, 'JSON hỏng: ' + e.message); continue; }
    validate(p, d);
    if (/^plain-/.test(d)) err(d, 'tiền tố plain- dành cho mẫu tự sinh');
    papers.push(p);
  }
  const all = plainDefs().concat(papers);
  const gi = id => GROUP_IDS.indexOf(id);
  all.sort((a, b) => (gi(a.group) - gi(b.group)) || ((a.order || 0) - (b.order || 0)) || (a.id < b.id ? -1 : 1));
  warnings.forEach(w => console.warn('CẢNH BÁO ' + w));
  if (errors.length) {
    errors.forEach(e => console.error('LỖI ' + e));
    console.error(`${errors.length} lỗi — không ghi catalog.`);
    process.exit(1);
  }
  const body = JSON.stringify({ version: 1, papers: all }, null, 2);
  const out = '/* tự sinh bởi src/note/tools/build-catalog.js — đừng sửa tay */\nwindow.MochiPaperCatalog = ' + body + ';\n';
  fs.writeFileSync(OUT, out);
  const counts = {};
  all.forEach(p => counts[p.group] = (counts[p.group] || 0) + 1);
  console.log(`Đã ghi ${path.relative(ROOT, OUT)}: ${all.length} mẫu`, JSON.stringify(counts), `${warnings.length} cảnh báo`);
}
main();
