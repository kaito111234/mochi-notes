'use strict';
// Phần thuần của thùng rác note (xoá mềm). Ngăn 'trash' = { items: [{ note, trashedAt }] }.
const DAY = 86400000;
const TTL = 30 * DAY;
const MAX_ITEMS = 500;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

function normalizeItem(it) {
  if (!it || typeof it !== 'object') return null;
  const n = it.note;
  if (!n || typeof n !== 'object' || Array.isArray(n) || typeof n.id !== 'string' || !n.id) return null;
  return { note: n, trashedAt: isNum(it.trashedAt) && it.trashedAt > 0 ? it.trashedAt : Date.now() };
}

/** stored -> { items } ; không ném lỗi với dữ liệu lạ, bỏ phần tử hỏng/trùng id, giữ tối đa 500 mới nhất. */
function normalize(stored) {
  const out = { items: [] };
  const list = stored && typeof stored === 'object' && Array.isArray(stored.items) ? stored.items : [];
  const seen = new Set();
  for (const it of list) {
    const x = normalizeItem(it);
    if (!x || seen.has(x.note.id)) continue;
    seen.add(x.note.id); out.items.push(x);
  }
  if (out.items.length > MAX_ITEMS) {
    out.items.sort((a, b) => a.trashedAt - b.trashedAt);
    out.items = out.items.slice(out.items.length - MAX_ITEMS);
  }
  return out;
}

const expiresAt = item => item.trashedAt + TTL;
const isExpired = (item, now) => now >= expiresAt(item);
/** Các phần tử còn hạn (không đổi mảng gốc). */
const keepLive = (items, now) => items.filter(it => !isExpired(it, now));

/** Id dùng khi khôi phục: giữ id cũ nếu chưa bị chiếm, ngược lại cấp id mới (gen() lặp tới khi không trùng). */
function restoreId(id, taken, gen) {
  if (!taken.has(id)) return id;
  let nid = gen();
  for (let i = 0; taken.has(nid) && i < 50; i++) nid = gen() + i;
  return nid;
}

/** Danh sách hiển thị, mới vào thùng trước. */
function listView(items, noteTitle) {
  const title = typeof noteTitle === 'function' ? noteTitle : t => String(t || '').trim().split(/\r?\n/)[0] || '';
  return items.slice().sort((a, b) => b.trashedAt - a.trashedAt).map(it => ({
    id: it.note.id,
    title: title(it.note.text),
    text: String(it.note.text || '').slice(0, 200),
    color: typeof it.note.color === 'string' ? it.note.color : 'yellow',
    trashedAt: it.trashedAt,
    expiresAt: expiresAt(it)
  }));
}

module.exports = { DAY, TTL, MAX_ITEMS, normalize, normalizeItem, expiresAt, isExpired, keepLive, restoreId, listView };
