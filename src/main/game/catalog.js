'use strict';
// Nạp + kiểm danh mục game (thuần, không electron).
const fs = require('fs');
const path = require('path');

const RARITIES = ['common', 'rare', 'epic', 'legend'];
const ID_RE = /^[a-z0-9_]+$/;
const DEFAULT_PATH = path.join(__dirname, '../../../assets/game/catalog.json');
const cache = new Map();

function warn(msg) { console.warn('[game/catalog] ' + msg); }
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Trả bản sạch; bỏ món/đồ ăn sai và cảnh báo.
function validate(catalog) {
  if (!isObj(catalog)) throw new Error('Catalog không hợp lệ');
  const slots = (Array.isArray(catalog.slots) ? catalog.slots : []).filter((s) => {
    const ok = isObj(s) && typeof s.id === 'string' && ID_RE.test(s.id);
    if (!ok) warn('khe sai bị bỏ');
    return ok;
  });
  const slotIds = new Set(slots.map((s) => s.id));
  const rarities = Array.isArray(catalog.rarities) && catalog.rarities.length
    ? catalog.rarities.filter((r) => isObj(r) && RARITIES.includes(r.id))
    : RARITIES.map((id) => ({ id, name: id }));
  const seen = new Set();
  const items = [];
  for (const it of Array.isArray(catalog.items) ? catalog.items : []) {
    let why = null;
    if (!isObj(it) || typeof it.id !== 'string' || !ID_RE.test(it.id)) why = 'id sai';
    else if (seen.has(it.id)) why = 'id trùng';
    else if (!slotIds.has(it.slot)) why = 'khe không thuộc slots';
    else if (!RARITIES.includes(it.rarity)) why = 'độ hiếm lạ';
    if (why) { warn(`bỏ món ${it && it.id}: ${why}`); continue; }
    seen.add(it.id);
    items.push(it);
  }
  const foodSeen = new Set();
  const foods = [];
  for (const f of Array.isArray(catalog.foods) ? catalog.foods : []) {
    if (!isObj(f) || typeof f.id !== 'string' || !ID_RE.test(f.id) || foodSeen.has(f.id)) {
      warn(`bỏ đồ ăn ${f && f.id}`); continue;
    }
    foodSeen.add(f.id);
    foods.push(f);
  }
  const setSeen = new Set();
  const sets = [];
  for (const st of Array.isArray(catalog.sets) ? catalog.sets : []) {
    if (!isObj(st) || typeof st.id !== 'string' || !ID_RE.test(st.id) || setSeen.has(st.id) || typeof st.name !== 'string') {
      warn(`bỏ bộ ${st && st.id}`); continue;
    }
    setSeen.add(st.id);
    sets.push({ id: st.id, name: st.name, reward: Number.isFinite(st.reward) && st.reward > 0 ? Math.floor(st.reward) : 100 });
  }
  return Object.assign({}, catalog, { slots, rarities, items, foods, sets });
}

function loadCatalog(filePath) {
  const p = filePath || DEFAULT_PATH;
  if (cache.has(p)) return cache.get(p);
  const clean = validate(JSON.parse(fs.readFileSync(p, 'utf8')));
  cache.set(p, clean);
  return clean;
}

function byRarity(catalog) {
  const out = { common: [], rare: [], epic: [], legend: [] };
  for (const it of catalog.items || []) if (out[it.rarity]) out[it.rarity].push(it);
  return out;
}
const itemById = (catalog, id) => (catalog.items || []).find((i) => i.id === id) || null;
const foodById = (catalog, id) => (catalog.foods || []).find((f) => f.id === id) || null;

module.exports = { validate, loadCatalog, byRarity, itemById, foodById, DEFAULT_PATH };
