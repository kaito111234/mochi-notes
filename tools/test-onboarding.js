'use strict';
// Test logic hướng dẫn lần đầu (node thuần, electron giả): node tools/test-onboarding.js
const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');
const root = path.join(__dirname, '..');

const wins = [];
const ipc = new Map();
class FakeWin extends EventEmitter {
  constructor(o) {
    super(); this.o = o; this.destroyed = false; wins.push(this);
    this.webContents = Object.assign(new EventEmitter(), { isDestroyed: () => this.destroyed, setWindowOpenHandler() {} });
    this.webContents.once = (ev, f) => EventEmitter.prototype.once.call(this.webContents, ev, f);
  }
  isDestroyed() { return this.destroyed; }
  setAlwaysOnTop() {} show() {} focus() {}
  loadFile(f) { this.file = f; return Promise.resolve(); }
  destroy() { this.destroyed = true; this.emit('closed'); }
}
const electron = {
  BrowserWindow: FakeWin,
  ipcMain: { on: (c, f) => ipc.set(c, f), handle: () => {} },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) }
};
const orig = Module._load;
Module._load = function (r) { return r === 'electron' ? electron : orig.apply(this, arguments); };

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('FAIL: ' + n); } };

function makeCtx(opts) {
  const bus = new EventEmitter();
  const said = [];
  const saves = { n: 0 };
  const ctx = {
    bus, quitting: false, paths: { src: path.join(root, 'src') },
    store: { isFirstRun: !!opts.firstRun, data: { notes: opts.notes || [], settings: Object.assign({}, opts.settings) }, save() { saves.n++; } },
    settings() { return this.store.data.settings; },
    pet: { actor: { say: t => said.push(t) }, body: { pos: () => ({ x: 800, y: 900 }), size: () => ({ w: 120, h: 120 }) } },
    alive: w => !!w && !w.isDestroyed(),
    webPrefs: () => ({ preload: 'x', contextIsolation: true, sandbox: true }),
    hardenWebContents() {}
  };
  require(path.join(root, 'src/main/onboarding/index.js')).init(ctx);
  return { ctx, said, saves, bus };
}
const fire = (ctx, ch, how) => ipc.get(ch)({ sender: wins[wins.length - 1].webContents }, how);

(async () => {
  // 1) người mới: mở
  let n0 = wins.length;
  let t = makeCtx({ firstRun: true, notes: [{ id: 'seed' }], settings: {} });
  ok(t.ctx.onboarding.check({ delay: 0 }) === true, 'người mới: check trả true');
  ok(wins.length === n0 + 1 && t.ctx.onboarding.isOpen(), 'người mới: cửa sổ mở');
  const w = wins[wins.length - 1];
  ok(w.o.frame === false && w.o.transparent === true && w.o.webPreferences.contextIsolation === true, 'cửa sổ không viền + contextIsolation');
  ok(/onboarding[\\/]preload\.js$/.test(w.o.webPreferences.preload), 'dùng preload riêng');
  ok(/onboarding\.html$/.test(w.file || ''), 'nạp onboarding.html');
  ok(!t.ctx.settings().onboarded, 'chưa đặt onboarded khi đang xem');
  // bấm Bắt đầu
  fire(t.ctx, 'onboarding:finish', 'start');
  ok(t.ctx.settings().onboarded === true && t.saves.n >= 1, 'Bắt đầu -> onboarded=true và lưu');
  ok(!t.ctx.onboarding.isOpen(), 'Bắt đầu -> đóng cửa sổ');
  ok(t.said.length === 1, 'bé nói câu chào');
  ok(t.ctx.onboarding.check({ delay: 0 }) === false, 'đã onboarded -> không mở lại');

  // 2) người cũ có note: không mở, đặt onboarded
  n0 = wins.length;
  t = makeCtx({ firstRun: false, notes: [{ id: 'a' }], settings: {} });
  ok(t.ctx.onboarding.check({ delay: 0 }) === false && wins.length === n0, 'người cũ: không mở');
  ok(t.ctx.settings().onboarded === true && t.saves.n >= 1, 'người cũ: đặt onboarded=true');

  // 3) đã onboarded: không mở
  n0 = wins.length;
  t = makeCtx({ firstRun: true, notes: [], settings: { onboarded: true } });
  ok(t.ctx.onboarding.check({ delay: 0 }) === false && wins.length === n0, 'đã onboarded: không mở');

  // 4) mở lại thủ công khi đã onboarded; bỏ qua cũng đặt cờ; đóng cửa sổ giữa chừng cũng đặt cờ
  t = makeCtx({ firstRun: false, notes: [{ id: 'a' }], settings: { onboarded: true } });
  n0 = wins.length;
  ok(t.ctx.onboarding.open() === true && wins.length === n0 + 1, 'open() thủ công');
  ok(t.ctx.onboarding.open() === true && wins.length === n0 + 1, 'open() lần 2 không nhân đôi cửa sổ');
  fire(t.ctx, 'onboarding:finish', 'skip');
  ok(!t.ctx.onboarding.isOpen(), 'Bỏ qua đóng cửa sổ');
  t = makeCtx({ firstRun: true, notes: [], settings: {} });
  t.ctx.onboarding.open();
  wins[wins.length - 1].destroy();
  ok(t.ctx.settings().onboarded === true, 'người dùng tắt cửa sổ -> không hiện lại');

  // 5) sự kiện app:startup có hẹn giờ mở
  n0 = wins.length;
  t = makeCtx({ firstRun: true, notes: [], settings: {} });
  t.bus.emit('app:startup', {});
  ok(wins.length === n0, 'app:startup chưa mở ngay (chờ bé lên sân khấu)');
  t.ctx.onboarding.check({ delay: 5 });
  await new Promise(r => setTimeout(r, 40));
  ok(wins.length === n0 + 1, 'mở sau khoảng chờ');

  // 6) vị trí nằm trong màn hình
  const o = wins[wins.length - 1].o;
  ok(o.x >= 0 && o.y >= 0 && o.x + o.width <= 1920 && o.y + o.height <= 1080, 'vị trí trong màn hình');

  console.log('onboarding: ' + pass + ' đạt, ' + fail + ' sai');
  process.exit(fail ? 1 : 0);
})();
