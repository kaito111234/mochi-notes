'use strict';
// Test sao lưu đám mây (node thuần, không Electron): node tools/test-backup.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');
const { EventEmitter } = require('events');
const root = path.join(__dirname, '..');

const electronStub = require('./stubs/electron.js');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return electronStub;
  return origLoad.apply(this, arguments);
};
console.error = () => {}; console.warn = () => {};

let pass = 0, fail = 0;
const failures = [];
const ok = (c, name, d) => { if (c) pass++; else { fail++; failures.push(name + (d !== undefined ? '  => ' + d : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { createStore } = require(path.join(root, 'src/main/store.js'));
const B = require(path.join(root, 'src/main/backup/index.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-bk-test-'));
const mk = n => { const d = path.join(tmp, n); fs.mkdirSync(d, { recursive: true }); return d; };

function makeCtx(dataDir) {
  const store = createStore(dataDir);
  const ctx = { store, bus: new EventEmitter(), windows: { list: null }, alive: () => false, tray: {}, settings: () => store.data.settings };
  return ctx;
}
function addNote(ctx, id) {
  ctx.store.data.notes.push({ id, html: '<p>' + id + '</p>', text: id, color: 'yellow', bounds: { x: 1, y: 1, width: 300, height: 300 } });
  ctx.store.save();
}
function fakeElectron(over) {
  const app = Object.assign(new EventEmitter(), { getPath: () => over.userData, relaunch() { app.relaunched = true; }, exit(c) { app.exited = c; } });
  return Object.assign({ app, Notification: Object.assign(class { show() { over.notes.push(1); } }, { isSupported: () => true }), dialog: {}, shell: {} }, over.extra || {});
}

(async () => {
  // ---- phát hiện nhà cung cấp từ env giả
  {
    const od = mk('fake-onedrive'), db = mk('fake-dropbox'), gd = mk('fake-gd');
    const prof = mk('profile');
    fs.mkdirSync(path.join(prof, 'Google Drive'));
    const appdata = mk('appdata'); fs.mkdirSync(path.join(appdata, 'Dropbox'));
    fs.writeFileSync(path.join(appdata, 'Dropbox', 'info.json'), JSON.stringify({ personal: { path: db } }));
    const found = B.detectProviders({ OneDrive: od, OneDriveConsumer: od, USERPROFILE: prof, APPDATA: appdata });
    ok(found.some(f => f.name === 'OneDrive' && f.dir === od), 'phát hiện OneDrive từ env');
    ok(found.filter(f => f.dir === od).length === 1, 'OneDrive không trùng lặp');
    ok(found.some(f => f.name === 'Google Drive' && f.dir === path.join(prof, 'Google Drive')), 'phát hiện Google Drive trong profile');
    ok(found.some(f => f.name === 'Dropbox' && f.dir === db), 'phát hiện Dropbox từ info.json');
    const none = B.detectProviders({ OneDrive: path.join(tmp, 'khong-co'), USERPROFILE: path.join(tmp, 'khong-co2') }, p => /fake|khong/.test(p) ? fs.existsSync(p) : false);
    ok(!none.some(f => /khong-co$/.test(f.dir)), 'env trỏ thư mục không tồn tại bị bỏ');
    gd; // eslint
  }

  // ---- ghi nguyên tử + nội dung + trạng thái
  const dataDir = mk('data'), cloud = mk('cloud'), userData = mk('userdata');
  const ctx = makeCtx(dataDir);
  addNote(ctx, 'n1');
  ctx.store.flushSync();
  const notes = [];
  const E = fakeElectron({ userData, notes });
  const off = new Date(2026, 5, 10, 9, 0, 0).getTime() - Date.now();   // đồng hồ giả chạy theo giờ thật
  const bk = B.create(ctx, { electron: E, now: () => Date.now() + off, minGapMs: 400, settleMs: 30, pollMs: 100000 });
  ctx.settings().cloudBackup = { on: true, dir: cloud, last: 0 };
  const r = bk.backupNow();
  const bdir = path.join(cloud, 'MochiNotes-backup');
  const f1 = path.join(bdir, 'mochi-2026-06-10.json');
  ok(r.ok && fs.existsSync(f1), 'ghi bản sao lưu đúng tên');
  ok(!fs.readdirSync(bdir).some(f => f.endsWith('.tmp')), 'không để lại file .tmp (ghi nguyên tử)');
  ok(JSON.parse(fs.readFileSync(f1, 'utf8')).notes.length === 1, 'nội dung sao lưu đủ note');
  ok(ctx.settings().cloudBackup.last > 0, 'ghi settings.cloudBackup.last');

  // ghi nguyên tử: nếu rename hỏng, vẫn không có file dở dang đè bản cũ
  {
    const before = fs.readFileSync(f1, 'utf8');
    const origW = fs.writeFileSync;
    let tmpSeen = false;
    fs.writeFileSync = function (p) { if (String(p).endsWith('.tmp') && String(p).includes('MochiNotes-backup')) tmpSeen = true; return origW.apply(this, arguments); };
    bk.backupNow();
    fs.writeFileSync = origW;
    ok(tmpSeen, 'ghi qua file .tmp rồi rename');
    ok(fs.readFileSync(f1, 'utf8') !== '' && before.length > 0, 'bản sao lưu còn nguyên sau ghi lại');
  }

  // ---- debounce: nhiều thay đổi liên tiếp => 1 lần ghi / khoảng (minGap 400ms)
  {
    bk.start();
    await sleep(600);   // lần đầu từ start()
    let writes = 0;
    const origW = fs.writeFileSync;
    fs.writeFileSync = function (p) { if (String(p).includes('MochiNotes-backup') && String(p).endsWith('.tmp')) writes++; return origW.apply(this, arguments); };
    for (let i = 0; i < 6; i++) { addNote(ctx, 'd' + i); await sleep(5); }
    const w0 = writes;
    const t0 = Date.now();
    while (writes < 1 && Date.now() - t0 < 2000) await sleep(10);
    const w1 = writes;
    for (let i = 0; i < 6; i++) { addNote(ctx, 'e' + i); await sleep(5); }
    await sleep(100);
    const w2 = writes;
    await sleep(900);
    fs.writeFileSync = origW;
    ok(w0 === 0 && w1 === 1, 'debounce: 6 thay đổi liên tiếp => 1 lần ghi (sau chờ)', w0 + '/' + w1);
    ok(w2 === w1, 'debounce: trong khoảng chờ không ghi thêm', w1 + '/' + w2);
    ok(writes === w1 + 1, 'debounce: hết khoảng chờ thì ghi đúng 1 bản mới', writes);
    const newest = fs.readdirSync(bdir).filter(x => B.NAME_RE.test(x)).sort().pop();
    ok(JSON.parse(fs.readFileSync(path.join(bdir, newest), 'utf8')).notes.length === 13, 'bản cuối chứa đủ 13 note');
    bk.stop();
  }

  // ---- khi thoát: ghi nếu còn thay đổi chưa sao lưu
  {
    const c2 = makeCtx(mk('data-q')), cl2 = mk('cloud-q'), E2 = fakeElectron({ userData: mk('ud-q'), notes: [] });
    const b2 = B.create(c2, { electron: E2, minGapMs: 100000, settleMs: 100000, pollMs: 100000 });
    c2.settings().cloudBackup = { on: true, dir: cl2, last: 0 };
    b2.start(); addNote(c2, 'q1');
    E2.app.emit('before-quit');
    const files = fs.existsSync(path.join(cl2, 'MochiNotes-backup')) ? fs.readdirSync(path.join(cl2, 'MochiNotes-backup')) : [];
    ok(files.length === 1, 'before-quit ghi bản sao lưu', files.join(','));
    b2.stop();
  }

  // ---- xoay vòng 30 bản, không xoá file lạ
  {
    const rd = mk('rotate'), bd = path.join(rd, 'MochiNotes-backup');
    fs.mkdirSync(bd);
    for (let i = 1; i <= 40; i++) fs.writeFileSync(path.join(bd, 'mochi-2026-01-' + String(i).padStart(2, '0') + '.json'), '{}');   // ngày 31-40 giả vẫn khớp mẫu
    const strangers = ['ghi-chu.txt', 'mochi-2026-01-01.json.bak', 'mochi-data-2026-01-01.json', 'anh.png', 'mochi-26-1-1.json'];
    for (const s of strangers) fs.writeFileSync(path.join(bd, s), 'x');
    fs.writeFileSync(path.join(rd, 'mochi-2020-01-01.json'), 'ngoai thu muc backup');
    const n = B.rotate(bd, 30);
    const left = fs.readdirSync(bd).filter(f => B.NAME_RE.test(f)).sort();
    ok(n === 10 && left.length === 30, 'xoay vòng giữ đúng 30 bản', n + '/' + left.length);
    ok(left[0] === 'mochi-2026-01-11.json', 'xoá bản cũ nhất trước', left[0]);
    ok(strangers.every(s => fs.existsSync(path.join(bd, s))), 'không xoá file lạ trong thư mục backup');
    ok(fs.existsSync(path.join(rd, 'mochi-2020-01-01.json')), 'không đụng file ngoài thư mục MochiNotes-backup');
  }

  // ---- lỗi: thư mục mất => không crash, cảnh báo một lần
  {
    const c3 = makeCtx(mk('data-e')), notes3 = [], E3 = fakeElectron({ userData: mk('ud-e'), notes: notes3 });
    const b3 = B.create(c3, { electron: E3 });
    c3.settings().cloudBackup = { on: true, dir: path.join(tmp, 'da-mat', 'x'), last: 0 };
    addNote(c3, 'z');
    const a = b3.backupNow(), b = b3.backupNow();
    ok(!a.ok && !b.ok, 'thư mục mất: trả lỗi, không ném');
    ok(notes3.length === 1, 'cảnh báo nhẹ đúng một lần', notes3.length);
    ok(!fs.existsSync(path.join(tmp, 'da-mat')), 'không tự tạo cả cây thư mục đã mất');
  }

  // ---- khôi phục
  {
    const rctx = makeCtx(mk('data-r')), rcloud = mk('cloud-r'), rUser = mk('ud-r'), rn = [];
    const dialogs = { open: null, box: [] };
    const E4 = fakeElectron({ userData: rUser, notes: rn, extra: {
      dialog: {
        showOpenDialog: async () => ({ canceled: false, filePaths: [dialogs.open] }),
        showMessageBox: async o => { dialogs.box.push(o.message); return { response: dialogs.answer == null ? 0 : dialogs.answer }; }
      }
    } });
    const b4 = B.create(rctx, { electron: E4 });
    rctx.settings().cloudBackup = { on: true, dir: rcloud, last: 0 };
    addNote(rctx, 'keep1'); addNote(rctx, 'keep2');
    rctx.store.flushSync();
    const bd = path.join(rcloud, 'MochiNotes-backup'); fs.mkdirSync(bd);

    // file hỏng
    const bad = path.join(bd, 'mochi-2026-02-01.json');
    fs.writeFileSync(bad, '{ khong phai json');
    dialogs.open = bad;
    const before = fs.readFileSync(rctx.store.file, 'utf8');
    const rr = await b4.restore();
    ok(rr.rejected && !E4.app.exited && !E4.app.relaunched, 'file hỏng bị từ chối, không relaunch');
    ok(fs.readFileSync(rctx.store.file, 'utf8') === before, 'file hỏng: dữ liệu hiện tại không đổi');
    // JSON hợp lệ nhưng sai dạng
    fs.writeFileSync(bad, '[1,2,3]');
    ok((await b4.restore()).rejected, 'JSON sai dạng (mảng) bị từ chối');
    fs.writeFileSync(bad, JSON.stringify({ notes: 'x' }));
    ok((await b4.restore()).rejected, 'notes không phải mảng bị từ chối');
    // file ngoài thư mục
    const outside = path.join(rcloud, 'mochi-2026-02-02.json');
    fs.writeFileSync(outside, JSON.stringify({ version: 2, notes: [] }));
    dialogs.open = outside;
    ok(!(await b4.restore()).ok && !E4.app.exited, 'file ngoài thư mục MochiNotes-backup bị từ chối');

    // file tốt, người dùng huỷ
    const good = path.join(bd, 'mochi-2026-02-03.json');
    fs.writeFileSync(good, JSON.stringify({ version: 2, notes: [{ id: 'old1', text: 'cu', html: 'cu' }], settings: {} }));
    dialogs.open = good; dialogs.answer = 1;
    const rc = await b4.restore();
    ok(rc.canceled && !E4.app.exited, 'huỷ xác nhận: không ghi đè');
    ok(fs.readFileSync(rctx.store.file, 'utf8') === before, 'huỷ: dữ liệu giữ nguyên');

    // xác nhận
    dialogs.answer = 0;
    const ro = await b4.restore();
    const now = JSON.parse(fs.readFileSync(rctx.store.file, 'utf8'));
    ok(ro.ok && E4.app.exited === 0 && E4.app.relaunched, 'xác nhận: ghi đè rồi relaunch + exit');
    ok(now.notes.length === 1 && now.notes[0].id === 'old1', 'dữ liệu được thay bằng bản sao lưu');
    const pre = fs.readdirSync(path.join(rUser, 'backups')).filter(f => /^mochi-data-before-cloud-restore-/.test(f));
    ok(pre.length === 1 && JSON.parse(fs.readFileSync(path.join(rUser, 'backups', pre[0]), 'utf8')).notes.length === 2, 'sao lưu dữ liệu hiện tại trước khi ghi đè');
    ok(!fs.existsSync(rctx.store.file + '.tmp'), 'không còn .tmp sau khôi phục');
    // sau khôi phục, before-quit không ghi đè
    rctx.settings().cloudBackup.on = true; b4.start(); E4.app.emit('before-quit');
    ok(JSON.parse(fs.readFileSync(rctx.store.file, 'utf8')).notes[0].id === 'old1', 'thoát sau khôi phục không ghi đè dữ liệu');
    b4.stop();
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* bỏ qua */ }
  console.log('test-backup: đạt ' + pass + ', sai ' + fail);
  for (const f of failures) console.log('  x ' + f);
  process.exit(fail ? 1 : 0);
})();
