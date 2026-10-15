'use strict';
// Đọc action (.js ưu tiên hơn .json), giải kế thừa / tween / $ref → danh sách khung phẳng.
const fs = require('fs');
const path = require('path');

const PHASES = ['single', 'start', 'loop', 'end'];
const BONE_DEF = { r: 0, x: 0, y: 0, sx: 1, sy: 1 };
const GLOBAL_DEF = { r: 0, x: 0, y: 0, sx: 1, sy: 1 };
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

function mergeBones(a, b) {
  const o = clone(a) || {};
  for (const [k, v] of Object.entries(b || {})) o[k] = Object.assign(o[k] || {}, v);
  return o;
}
// Gộp khung cur lên khung prev (inherit)
function mergeFrame(prev, cur) {
  const o = clone(prev) || {};
  for (const [k, v] of Object.entries(cur)) {
    if (k === 'inherit' || k === 'tween' || k === 'tweenMs') continue;
    if (k === 'bones') o.bones = mergeBones(o.bones, v);
    else if (k === 'global' || k === 'swap' || k === 'z' || k === 'opacity') o[k] = Object.assign(o[k] || {}, clone(v));
    else o[k] = clone(v);
  }
  return o;
}
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function lerpMap(A, B, def, t, extra) {
  const o = {};
  for (const k of new Set([...Object.keys(A || {}), ...Object.keys(B || {})])) {
    const a = (A || {})[k], b = (B || {})[k];
    if (extra && extra.includes(k)) { o[k] = b != null ? b : a; continue; }
    const d = def[k] == null ? 0 : def[k];
    o[k] = lerp(a == null ? d : a, b == null ? d : b, t);
  }
  return o;
}
function tweenFrame(prev, cur, t, ms) {
  const late = t >= 0.5, src = late ? cur : prev;
  const e = ease(t);
  const o = clone(src);
  o.ms = ms;
  const bones = {};
  for (const k of new Set([...Object.keys(prev.bones || {}), ...Object.keys(cur.bones || {})])) bones[k] = lerpMap((prev.bones || {})[k], (cur.bones || {})[k], BONE_DEF, e);
  o.bones = bones;
  const g = lerpMap(prev.global, cur.global, GLOBAL_DEF, e, ['px', 'py']);
  o.global = g;
  return o;
}

function resolvePhase(list, where) {
  const out = [];
  let prev = null;
  list.forEach((f, i) => {
    let fr = (f.inherit && prev) ? mergeFrame(prev, f) : mergeFrame({ face: 'normal', ms: 100 }, f);
    if (f.inherit && prev === null) fr = mergeFrame({ face: 'normal', ms: 100 }, f);
    const n = f.tween | 0;
    if (n > 0 && prev) {
      const tms = f.tweenMs != null ? f.tweenMs : fr.ms;
      for (let k = 1; k <= n; k++) out.push(tweenFrame(prev, fr, k / (n + 1), tms));
    }
    fr.ms = Math.max(1, Math.round(fr.ms));
    out.push(fr);
    prev = fr;
  });
  return out;
}

function loadActionFile(file) {
  let def;
  if (file.endsWith('.js')) {
    delete require.cache[require.resolve(file)];
    def = require(file);
    if (typeof def === 'function') def = def();
  } else def = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const name = def.action || path.basename(file).replace(/\.(js|json)$/, '');
  const raw = def.moods || {};
  const done = {}, busy = new Set();
  function resolveMood(m) {
    if (done[m]) return done[m];
    if (busy.has(m)) throw new Error(`${name}: $ref vòng tròn ở mood ${m}`);
    const d = raw[m];
    if (!d) throw new Error(`${name}: không có mood ${m}`);
    busy.add(m);
    let phases = {};
    if (d.$ref) {
      const base = resolveMood(d.$ref);
      for (const p of Object.keys(base)) phases[p] = base[p].map(clone);
      for (const [p, ov] of Object.entries(d.override || {})) {
        if (!phases[p]) throw new Error(`${name}/${m}: override phase không có: ${p}`);
        if (ov.length !== phases[p].length) throw new Error(`${name}/${m}/${p}: override dài ${ov.length} ≠ ${phases[p].length} khung`);
        phases[p] = phases[p].map((fr, i) => mergeFrame(fr, ov[i] || {}));
      }
    } else {
      for (const p of PHASES) if (d[p] && d[p].length) phases[p] = resolvePhase(d[p], `${name}/${m}/${p}`);
    }
    busy.delete(m);
    return (done[m] = phases);
  }
  const moods = {};
  for (const m of Object.keys(raw)) moods[m] = resolveMood(m);
  return { action: name, moods };
}

function loadActions(dir, only) {
  const names = new Map();
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(/^(.+)\.(js|json)$/);
    if (!m) continue;
    if (names.has(m[1]) && names.get(m[1]).endsWith('.js')) continue; // .js ưu tiên
    if (m[2] === 'js' || !names.has(m[1])) names.set(m[1], path.join(dir, f));
  }
  const list = [];
  for (const [n, f] of names) {
    if (only && !only.includes(n)) continue;
    const a = loadActionFile(path.resolve(f));
    a.file = n;
    list.push(a);
  }
  return list;
}

module.exports = { loadActions, loadActionFile, PHASES };
