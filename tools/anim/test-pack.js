'use strict';
// Test loadCharacter (node thuần): node tools/anim/test-pack.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCharacter, packDirs, findPack, loadPack } = require('../../src/main/petcore/pack');

let fails = 0;
function check(name, cond, extra) { console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) fails++; }
function hasFrames(pack, a) {
  const moods = pack.anims[a]; if (!moods) return false;
  return Object.values(moods).some((ph) => Object.values(ph).some((l) => l && l.length));
}
const ACTIONS = ['idle', 'walk', 'sit', 'sleep', 'pat_head', 'pat_body', 'lifted', 'fall', 'land', 'peek_left', 'peek_right', 'hold_note', 'ring', 'happy', 'sad', 'shy', 'angry', 'eat', 'work', 'wave', 'startup', 'shutdown', 'say', 'climb', 'point', 'write'];

// (a) gói thật
try {
  const p = loadCharacter(null);
  const miss = ACTIONS.filter((a) => !hasFrames(p, a));
  check('(a) mọi action có frames', miss.length === 0, 'thiếu: ' + miss.join(','));
  check('(a) có pack.sources', p.sources && p.sources.fallback === 'placeholder', JSON.stringify(p.sources));
  console.log('     sources:', JSON.stringify(p.sources));
} catch (e) { check('(a) không ném lỗi', false, e.message); }

// (b) mochi giả thiếu action
const real = path.join(__dirname, '..', '..', 'assets', 'pet', 'placeholder');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-'));
try {
  const m = path.join(tmp, 'mochi');
  fs.mkdirSync(path.join(m, 'idle', 'normal', 'loop'), { recursive: true });
  const srcDir = path.join(real, 'idle', 'normal', 'loop');
  for (const f of fs.readdirSync(srcDir).slice(0, 2)) fs.copyFileSync(path.join(srcDir, f), path.join(m, 'idle', 'normal', 'loop', f));
  const pj = JSON.parse(fs.readFileSync(path.join(real, 'pack.json'), 'utf8'));
  pj.id = 'mochi'; pj.name = 'Fake'; pj.faces = {};
  fs.writeFileSync(path.join(m, 'pack.json'), JSON.stringify(pj));
  const ctx = { userData: tmp.replace(/\/?$/, '') + '-ud' }; // không tồn tại: bỏ qua
  const origDirs = packDirs(ctx);
  // dirs: assets/pet (chứa placeholder, mochi thật) rồi thư mục giả — mochi giả thắng vì đứng sau
  fs.mkdirSync(path.join(tmp, 'pets'), { recursive: true });
  fs.renameSync(m, path.join(tmp, 'pets', 'mochi'));
  ctx.userData = tmp;
  const p = loadCharacter(ctx);
  check('(b) primary là mochi giả', p.name === 'Fake', p.name);
  check('(b) idle không mượn', !p.sources.borrowed.includes('idle') && !p.anims.idle.normal.loop[0].fit);
  check('(b) walk mượn', p.sources.borrowed.includes('walk'));
  const f = p.anims.walk && p.anims.walk.normal.loop[0];
  check('(b) src bắt đầu file: và fit', f && f.src.startsWith('file:') && f.fit === true, JSON.stringify(f));
  const miss = ACTIONS.filter((a) => !hasFrames(p, a));
  check('(b) mọi action có frames', miss.length === 0, miss.join(','));
  const fk = Object.values(p.faces)[0];
  check('(b) faces mượn là URL file:', typeof fk === 'string' && fk.startsWith('file:'), String(fk));
  void origDirs;
} catch (e) { check('(b) không ném lỗi', false, e.stack); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// (c) không có gói nào: giả lập bằng cách ép packDirs/findPack không thấy gì
try {
  const packMod = require('../../src/main/petcore/pack');
  const origFind = packMod.findPack;
  // loadCharacter gọi findPack nội bộ; thay vì mock, ctx lỗi (getter ném) vẫn không được ném
  const bad = {}; Object.defineProperty(bad, 'userData', { get() { throw new Error('boom'); } });
  const p = loadCharacter(bad);
  check('(c) ctx hỏng không ném lỗi', p && p.size && p.anims && p.sources);
  // gói rỗng: findPack trên thư mục trống trả null
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'packempty-'));
  check('(c) findPack thư mục trống = null', findPack('mochi', [empty]) === null);
  fs.rmSync(empty, { recursive: true, force: true });
  void origFind; void loadPack;
} catch (e) { check('(c) không ném lỗi', false, e.message); }

console.log(fails ? `FAIL (${fails})` : 'OK');
process.exit(fails ? 1 : 0);
