#!/usr/bin/env node
'use strict';
// Dựng clip demo MƯỢT (30 khung/giây đều) cho README và trang web từ khung thu bằng tools/record-demo-rec.js.
//
// Cách làm (không chụp màn hình, không chụp vòng lặp):
//   1) tools/record-demo-rec.js chạy trong app dev (qua cổng inspector), dùng webContents.beginFrameSubscription trên TỪNG cửa sổ
//      (bé, note, thùng rác, màn nhắc to): nhận MỌI khung Chromium vẽ kèm thời điểm thật, cộng nhật ký bounds cửa sổ ~250 lần/giây.
//      Kết quả: <thư-mục-khung>/ gồm *.bgra (khung thô) và meta.json (thời điểm, bounds, hiển thị, độ mờ).
//   2) Tệp này ghép OFFLINE lên nền desktop giả theo lưới thời gian cố định 30fps: mỗi khung ra lấy, với từng cửa sổ, khung gần nhất <= t,
//      vị trí cửa sổ nội suy tuyến tính giữa hai lần ghi bounds (app dời cửa sổ bé ~20 lần/giây khi đi bộ) -> tịnh tiến đều.
//      Đoạn chờ dài thì CẮT (--seg), không tua nhanh. Hai đầu mờ nhẹ về nền (--dip) để nối vòng lặp, không trộn hai cảnh.
//   3) Mã hoá: WebP động 30fps (sharp) cho README; WebM VP9 30fps (WebCodecs trong electron + webm-muxer) và poster .webp cho trang web.
//
// Phụ thuộc nằm NGOÀI dự án (không thêm vào package.json): cài một lần vào thư mục tạm
//   mkdir %TEMP%\mochi-enc && cd %TEMP%\mochi-enc && npm init -y && npm i sharp webm-muxer
// rồi trỏ DEMO_NODE_MODULES tới <thư-mục-tạm>/node_modules.
//
// Dùng:
//   node tools/record-demo.js build <thư-mục-khung> <tên> --seg 1200-7800 [--seg 9000-10500 ...] [--dip 5]
//        [--images docs/images] [--videos docs/site/videos] [--webp-size 720x405] [--quality 80] [--webm-kbps 1100] [--poster-ms 3000]
//   node tools/record-demo.js merge <ra-thư-mục> <thư-mục-khung-1> <thư-mục-khung-2> ...   (nối nhiều lần thu thành một dòng thời gian, cảnh 'đời sống')
//   node tools/record-demo.js fps <tệp.webp|webm>  (đo số khung, thời lượng, độ lệch delay)
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NM = process.env.DEMO_NODE_MODULES;
if (!NM) { console.error('Thiếu DEMO_NODE_MODULES (thư mục node_modules có sharp, webm-muxer)'); process.exit(2); }
const sharp = require(path.join(NM, 'sharp'));
const FPS = 30, STAGE_W = 960, STAGE_H = 540;
const Z = { note: 1, bin: 2, other: 3, pet: 4, toolbar: 5, alert: 6 };
const zOf = k => (String(k).startsWith('other') ? 3 : (Z[k] || 3));

function parseArgs(a) {
  const pos = [], o = { seg: [], dip: 5, images: path.join(ROOT, 'docs/images'), videos: path.join(ROOT, 'docs/site/videos'), webp: '720x405', quality: 80, kbps: 1100, poster: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--seg') { const m = /^(\d+)-(\d+)$/.exec(a[++i]); o.seg.push([+m[1], +m[2]]); }
    else if (a[i] === '--dip') o.dip = +a[++i];
    else if (a[i] === '--images') o.images = path.resolve(a[++i]);
    else if (a[i] === '--videos') o.videos = path.resolve(a[++i]);
    else if (a[i] === '--webp-size') o.webp = a[++i];
    else if (a[i] === '--quality') o.quality = +a[++i];
    else if (a[i] === '--webm-kbps') o.kbps = +a[++i];
    else if (a[i] === '--poster-ms') o.poster = +a[++i];
    else pos.push(a[i]);
  }
  return { pos, o };
}

// ------------------------------------------------------------------ trạng thái cửa sổ tại thời điểm t
function lastLE(arr, t, key) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m][key] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
function stateAt(S, t) {
  const i = lastLE(S, t, 't'); if (i < 0) return null;
  const a = S[i], b = S[i + 1];
  if (!a.v) return a;
  // nội suy khi hai lần ghi liền nhau (< 110ms) cùng cỡ, cùng hiển thị: bé đi/nhảy/rơi, cửa sổ nhắc mờ dần
  if (b && b.v && b.t - a.t <= 110 && b.t > a.t && a.w === b.w && a.h === b.h) {
    const u = (t - a.t) / (b.t - a.t);
    return { ...a, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, op: a.op + (b.op - a.op) * u };
  }
  return a;
}

// ------------------------------------------------------------------ ghép khung
async function compose(dir, name, o) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const rect = meta.rect;
  const bgFile = path.join(path.dirname(dir), 'bg.png');
  const bgRaw = await sharp(bgFile).resize(STAGE_W, STAGE_H).removeAlpha().raw().toBuffer();
  const byId = new Map(), samp = new Map();
  for (const f of meta.frames) { if (!byId.has(f.id)) byId.set(f.id, []); byId.get(f.id).push(f); }
  for (const s of meta.samples) { if (!samp.has(s.id)) samp.set(s.id, []); samp.get(s.id).push(s); }
  for (const arr of byId.values()) arr.sort((p, q) => p.t - q.t);
  // Khung do rAF (~30Hz) giao về lệch +-15ms; trải đều thời điểm trong từng đoạn liên tục để không lặp/bỏ khung khi lấy mẫu ở 30fps.
  // Chỉ áp cho đoạn có nhịp dày (trung bình < 45ms/khung); sprite của bé (75-170ms/khung) giữ nguyên thời điểm thật.
  for (const arr of byId.values()) {
    let i = 0;
    while (i < arr.length) {
      let j = i; while (j + 1 < arr.length && arr[j + 1].t - arr[j].t < 80) j++;
      const n = j - i + 1;
      if (n >= 8 && (arr[j].t - arr[i].t) / (n - 1) < 45) { const t0 = arr[i].t, t1 = arr[j].t; for (let k = i; k <= j; k++) arr[k].t = t0 + (t1 - t0) * (k - i) / (n - 1); }
      i = j + 1;
    }
  }
  for (const arr of samp.values()) arr.sort((p, q) => p.t - q.t);

  const cache = new Map();                       // tệp bgra -> RGBA nhân alpha sẵn (sharp: premultiplied)
  const loadBmp = f => {
    let v = cache.get(f.f);
    if (!v) {
      const src = fs.readFileSync(path.join(dir, f.f)), out = Buffer.allocUnsafe(src.length);
      for (let i = 0; i < src.length; i += 4) { out[i] = src[i + 2]; out[i + 1] = src[i + 1]; out[i + 2] = src[i]; out[i + 3] = src[i + 3]; }
      v = out; cache.set(f.f, v); if (cache.size > 80) cache.delete(cache.keys().next().value);
    }
    return v;
  };

  // lưới thời gian cố định
  const times = [];
  for (const [a, b] of o.seg) for (let t = a; t < b - 1e-6; t += 1000 / FPS) times.push(t);
  const N = times.length, outDir = path.join(dir, 'out_' + name);
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const names = [];
  for (let n = 0; n < N; n++) {
    const t = times[n], layers = [];
    for (const [id, S] of samp) {
      const st = stateAt(S, t); if (!st || !st.v || st.k === 'skip') continue;
      const fr = byId.get(id); if (!fr) continue;
      const fi = lastLE(fr, t, 't'); if (fi < 0) continue;
      const f = fr[fi];
      const left = Math.round(st.x - rect.x), top = Math.round(st.y - rect.y);
      if (left >= STAGE_W || top >= STAGE_H || left + f.w <= 0 || top + f.h <= 0) continue;
      let buf = loadBmp(f);
      if (st.op < 0.999) { const c = Buffer.from(buf); for (let i = 0; i < c.length; i++) c[i] = Math.round(c[i] * st.op); buf = c; }
      layers.push({ z: zOf(st.k), id, input: buf, raw: { width: f.w, height: f.h, channels: 4 }, left, top, premultiplied: true, blend: 'over' });
    }
    layers.sort((p, q) => p.z - q.z || p.id - q.id);
    let raw = await sharp(bgRaw, { raw: { width: STAGE_W, height: STAGE_H, channels: 3 } })
      .composite(layers.map(({ input, raw, left, top, premultiplied, blend }) => ({ input, raw, left, top, premultiplied, blend }))).removeAlpha().raw().toBuffer();
    // mờ về nền ở hai đầu (nối vòng lặp)
    const d = o.dip, pos = Math.min(n, N - 1 - n);
    if (d > 0 && pos < d) {
      const k = (d - pos) / (d + 1);               // trọng số của nền
      const outb = Buffer.allocUnsafe(raw.length);
      for (let i = 0; i < raw.length; i++) outb[i] = Math.round(raw[i] * (1 - k) + bgRaw[i] * k);
      raw = outb;
    }
    const file = path.join(outDir, String(n).padStart(4, '0') + '.png');
    await sharp(raw, { raw: { width: STAGE_W, height: STAGE_H, channels: 3 } }).png({ compressionLevel: 2 }).toFile(file);
    names.push(file);
  }
  return { outDir, names, N };
}

// ------------------------------------------------------------------ delay đều: 1000/30 ms, làm tròn có bù để trung bình đúng 33.333
function delays(n) { const d = []; let acc = 0; for (let i = 0; i < n; i++) { const target = Math.round((i + 1) * 1000 / FPS), cur = target - acc; d.push(cur); acc = target; } return d; }

async function encodeWebp(names, outFile, size, quality) {
  const [w, h] = size.split('x').map(Number);
  const bufs = [];
  for (const f of names) bufs.push(await sharp(f).resize(w, h, { kernel: 'lanczos3' }).png({ compressionLevel: 1 }).toBuffer());
  const buf = await sharp(bufs, { join: { animated: true } }).webp({ quality, effort: 5, loop: 0, delay: delays(names.length), smartSubsample: true }).toBuffer();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  return buf.length;
}

async function encodeWebm(outDir, names, outFile, kbps) {
  const electron = require(path.join(ROOT, 'node_modules', 'electron'));
  const list = path.join(outDir, 'list.json');
  fs.writeFileSync(list, JSON.stringify({ files: names, out: outFile, kbps, fps: FPS, w: STAGE_W, h: STAGE_H, nm: NM }));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = cp.spawnSync(electron, [path.join(__dirname, 'record-demo-enc.js'), list], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000, env });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (!fs.existsSync(outFile) || !/ENC_OK/.test(out)) throw new Error('mã hoá webm lỗi: ' + out.slice(-600));
  return fs.statSync(outFile).size;
}

async function build(dir, name, o) {
  if (!o.seg.length) throw new Error('cần ít nhất một --seg a-b (ms)');
  const t0 = Date.now();
  const { outDir, names, N } = await compose(dir, name, o);
  console.log(`ghép ${N} khung (${(N / FPS).toFixed(2)}s @ ${FPS}fps) trong ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const wp = path.join(o.images, `demo-${name}.webp`);
  const sw = await encodeWebp(names, wp, o.webp, o.quality);
  console.log(`webp README: ${wp} ${(sw / 1024).toFixed(0)} KB`);
  const sv = await encodeWebm(outDir, names, path.join(o.videos, `demo-${name}.webm`), o.kbps);
  console.log(`webm trang web: ${(sv / 1024).toFixed(0)} KB`);
  const pi = o.poster != null ? Math.min(N - 1, Math.round(o.poster / 1000 * FPS)) : Math.round(N * 0.45);
  const pp = path.join(o.videos, `demo-${name}.webp`);
  await sharp(names[pi]).resize(960, 540).webp({ quality: 78 }).toFile(pp);
  console.log(`poster: ${pp} ${(fs.statSync(pp).size / 1024).toFixed(0)} KB (khung ${pi})`);
}

// Nối nhiều lần thu: dời thời gian cộng dồn (cách nhau 1s), đổi tên tệp khung, đánh dấu mọi cửa sổ biến mất ở cuối mỗi đoạn.
function merge(out, dirs) {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const all = { rect: null, frames: [], samples: [], marks: {}, offsets: [] };
  let off = 0;
  dirs.forEach((d, k) => {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8'));
    all.rect = m.rect; all.offsets.push(off);
    for (const f of m.frames) { const nf = 'r' + k + '_' + f.f; fs.copyFileSync(path.join(d, f.f), path.join(out, nf)); all.frames.push({ ...f, f: nf, t: f.t + off }); }
    for (const s of m.samples) all.samples.push({ ...s, t: s.t + off });
    for (const id of new Set(m.samples.map(s => s.id))) all.samples.push({ t: off + m.dur + 500, id, k: 'skip', x: 0, y: 0, w: 0, h: 0, v: 0, op: 0 });
    off += m.dur + 1000;
  });
  all.dur = off;
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(all));
  console.log('nối', dirs.length, 'đoạn, offset ms:', all.offsets.map(Math.round).join(', '), 'tổng', Math.round(off));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2), { pos, o } = parseArgs(rest);
  if (cmd === 'build') return build(path.resolve(pos[0]), pos[1], o);
  if (cmd === 'merge') return merge(path.resolve(pos[0]), pos.slice(1).map(p => path.resolve(p)));
  if (cmd === 'fps') {
    const f = path.resolve(pos[0]), buf = fs.readFileSync(f);
    if (/\.webp$/i.test(f)) {
      const m = await sharp(buf, { animated: true }).metadata();
      const d = m.delay || [], tot = d.reduce((a, b) => a + b, 0);
      console.log(`${path.basename(f)}: ${m.width}x${m.pageHeight || m.height}, ${m.pages} khung, ${tot} ms, ${(m.pages / (tot / 1000)).toFixed(2)} fps, delay min/max ${Math.min(...d)}/${Math.max(...d)} ms`);
    }
    return;
  }
  console.error('Dùng: build | bg | fps — xem đầu tệp'); process.exit(2);
}
main().catch(e => { console.error(e); process.exit(1); });
