'use strict';
// Test nạp lười theo hành động của engine hình động (node thuần, giả createImageBitmap): node tools/test-anim-lazy.js
//  khởi động chỉ nạp idle/walk; hành động chưa nạp -> nạp rồi mới phát; hết hạn -> giải phóng; idle/walk/faces không bị giải phóng.
const path = require('path');
const { LazyActions } = require(path.join(__dirname, '..', 'src/pet/anim.js'));
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('SAI: ' + m); } };

const fr = (a, n) => Array.from({ length: n }, (_, i) => ({ src: a + '/' + i + '.png', ms: 50 }));
const anims = {
  idle: { normal: { loop: fr('idle', 3) } },
  walk: { normal: { loop: fr('walk', 3) } },
  walk_side: { normal: { loop: fr('walk_side', 2) } },
  ring: { normal: { loop: fr('ring', 4) } },
  lifted: { normal: { loop: fr('lifted', 2), start: [{ src: 'idle/0.png', ms: 50 }] } }, // dùng chung 1 khung với idle
  sleep: { normal: { loop: fr('sleep', 2) } }
};
const faces = ['faces/normal.png'];

let t = 0, loads = [], closed = [];
const cache = new Map();
const mk = () => new LazyActions({
  cache, core: { idle: 1, walk: 1 }, skip: { walk_side: 1 }, ttl: 180000,
  now: () => t,
  loadList: srcs => { loads.push(srcs.slice()); return new Promise(r => setImmediate(() => { srcs.forEach(s => { if (!cache.get(s)) cache.set(s, { src: s }); }); r([]); })); },
  close: im => closed.push(im.src)
});

(async () => {
  const L = mk();
  L.setPack(anims, faces.concat(['walk_side/0.png', 'walk_side/1.png']));
  // khởi động: chỉ idle + walk
  const core = L.coreSrcs();
  ok(core.length === 6 && core.every(s => /^(idle|walk)\//.test(s)), 'lõi chỉ idle/walk: ' + core);
  await L.o.loadList(core);
  ok(loads.length === 1, 'khởi động nạp 1 lượt');
  ok(!L.managed('idle') && !L.managed('walk') && !L.managed('walk_side'), 'idle/walk/walk_side không do bộ này quản');
  ok(L.managed('ring') && L.managed('lifted'), 'ring/lifted quản');
  ok(L.isLoaded('idle') && L.isLoaded('walk'), 'idle/walk đã nạp');
  ok(!L.isLoaded('ring'), 'ring chưa nạp lúc khởi động');
  ok(![...cache.keys()].some(k => /^ring|^sleep|^lifted/.test(k)), 'cache không có khung hành động hiếm');

  // phát hành động chưa nạp: chưa nạp -> ensure -> đã nạp (play chờ ensure)
  const p = L.ensure('ring');
  ok(!L.isLoaded('ring'), 'trong lúc chờ vẫn chưa nạp');
  const p2 = L.ensure('ring');
  ok(p === p2, 'ensure đồng thời dùng chung 1 lượt nạp');
  await p;
  ok(L.isLoaded('ring'), 'ring nạp xong');
  ok(loads.length === 2, 'chỉ 1 lượt nạp thêm cho ring');
  await L.ensure('ring');
  ok(loads.length === 2, 'đã nạp thì không nạp lại');

  // lifted: khung chung với idle phải còn nguyên khi giải phóng
  await L.ensure('lifted'); await L.ensure('sleep');
  // hết hạn
  t = 100000; L.touch('lifted');           // lifted còn mới
  t = 200000;                              // ring/sleep quá 180s; lifted mới 100s
  let freed = L.sweep(a => false, {});
  ok(freed.includes('ring') && freed.includes('sleep') && !freed.includes('lifted'), 'hết hạn: ' + freed);
  ok(!cache.has('ring/0.png') && !cache.has('sleep/1.png'), 'ring/sleep đã bỏ khỏi cache');
  ok(closed.includes('ring/0.png'), 'đã close() bitmap');
  ok(cache.has('lifted/0.png'), 'lifted chưa hết hạn');
  ok(cache.has('idle/0.png') && cache.has('walk/0.png'), 'idle/walk còn');
  t = 400000;
  freed = L.sweep(a => a === 'lifted', {});
  ok(freed.length === 0, 'đang chạy thì không giải phóng');
  freed = L.sweep(a => false, { 'lifted/0.png': 1 });
  ok(freed.includes('lifted') && cache.has('lifted/0.png') && !cache.has('lifted/1.png'), 'khung đang hiện được giữ');
  ok(cache.has('idle/0.png'), 'khung dùng chung với idle không bị đóng');
  ok(!closed.includes('idle/0.png'), 'không close khung idle');
  // sweep nhiều lần: không bao giờ chạm idle/walk
  t = 9e8; L.sweep(() => false, {});
  ok(['idle/0.png', 'idle/2.png', 'walk/0.png', 'walk/2.png'].every(s => cache.has(s)), 'idle/walk không bao giờ bị giải phóng');
  // nạp lại sau khi giải phóng
  ok(!L.isLoaded('ring'), 'ring cần nạp lại');
  await L.ensure('ring');
  ok(L.isLoaded('ring') && cache.has('ring/3.png'), 'nạp lại được');
  // nạp lỗi không treo vô hạn
  const L2 = new LazyActions({ cache: new Map(), core: { idle: 1 }, skip: {}, ttl: 1, now: () => 0, loadList: s => Promise.resolve(s.slice()), close() {} });
  L2.setPack({ idle: anims.idle, ring: anims.ring }, []);
  await L2.ensure('ring');
  ok(L2.isLoaded('ring'), 'lỗi nạp vẫn coi là đã thử (không lặp vô hạn)');
  console.log(bad ? 'test-anim-lazy: ' + bad + ' SAI' : 'test-anim-lazy: sạch');
  process.exit(bad ? 1 : 0);
})();
