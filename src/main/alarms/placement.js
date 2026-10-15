'use strict';
// Né bé: chọn vị trí cửa sổ chuông/popup sao cho không đè vùng bé (và các vùng khác). Thuần, không phụ thuộc Electron.
// placeAvoiding(workArea, size, avoid, margin=12) -> {x, y}
//  - workArea {x,y,width,height}; size {width,height}
//  - avoid: rect | null | mảng rect (vùng bé, cửa sổ khác). Rect có thể là null/không hợp lệ -> bỏ qua.
// Thứ tự thử: góc dưới phải; trên vùng bé; trái vùng bé; góc dưới trái; góc trên phải; rồi quanh các vùng còn lại.
// Không có chỗ nào trống hoàn toàn -> chọn chỗ chồng lấn ít nhất (ưu tiên thứ tự trên).

const num = v => typeof v === 'number' && isFinite(v);
const okRect = r => !!r && num(r.x) && num(r.y) && num(r.width) && num(r.height) && r.width > 0 && r.height > 0;

function intersects(a, b) {
  if (!okRect(a) || !okRect(b)) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function overlapArea(a, b) {
  if (!intersects(a, b)) return 0;
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w * h;
}
function normAvoid(avoid) {
  const list = Array.isArray(avoid) ? avoid : [avoid];
  return list.filter(okRect);
}
function clamp(v, lo, hi) { return hi < lo ? lo : Math.min(hi, Math.max(lo, v)); }

function placeAvoiding(workArea, size, avoid, margin) {
  const m = num(margin) ? margin : 12;
  const wa = okRect(workArea) ? workArea : { x: 0, y: 0, width: 1280, height: 720 };
  const w = num(size && size.width) ? size.width : 360;
  const h = num(size && size.height) ? size.height : 240;
  const avoids = normAvoid(avoid);

  const minX = wa.x + m, maxX = wa.x + wa.width - w - m;
  const minY = wa.y + m, maxY = wa.y + wa.height - h - m;
  const fit = (x, y) => ({ x: Math.round(clamp(x, minX, maxX)), y: Math.round(clamp(y, minY, maxY)) });

  const br = fit(maxX, maxY);
  const cands = [br];
  const first = avoids[0];
  const addAround = r => {
    cands.push(fit(br.x, r.y - h - m));                 // trên vùng
    cands.push(fit(r.x - w - m, br.y));                 // trái vùng
    cands.push(fit(r.x - w - m, r.y + r.height - h));   // trái vùng, thẳng hàng đáy vùng
    cands.push(fit(r.x + r.width + m, br.y));           // phải vùng
  };
  if (first) addAround(first);
  cands.push(fit(minX, maxY));   // góc dưới trái
  cands.push(fit(maxX, minY));   // góc trên phải
  cands.push(fit(minX, minY));   // góc trên trái
  for (let i = 1; i < avoids.length; i++) addAround(avoids[i]);

  let best = null, bestScore = Infinity;
  for (const c of cands) {
    const box = { x: c.x, y: c.y, width: w, height: h };
    let score = 0;
    for (const r of avoids) score += overlapArea(box, r);
    if (score === 0) return c;
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best || br;
}

/** Cửa sổ ở bounds có giao với vùng bé/vùng khác không (dùng khi bé di chuyển). */
function needsMove(bounds, avoid) {
  return normAvoid(avoid).some(r => intersects(bounds, r));
}

module.exports = { placeAvoiding, needsMove, intersects, overlapArea };
