// Test hàm quyết định "nhắc to biết ý" (không cần Electron). Chạy: node tools/test-alert-policy.js
'use strict';
const AP = require('../src/main/pet/alertPolicy.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.log('FAIL', name, '\n  got ', g, '\n  want', w); }
}
const at = (h, m) => new Date(2026, 9, 15, h, m || 0, 0).getTime();
const QH = { on: true, from: '22:00', to: '07:00' };
const S = (o) => Object.assign({ bigAlert: true, quietHours: QH, alertVolume: 70, smartAlert: true }, o || {});
const D = { left: 0, top: 0, right: 1920, bottom: 1080 };
const win = { left: 100, top: 100, right: 1200, bottom: 800 };
const full = { left: 0, top: 0, right: 1920, bottom: 1080 };
const FG = (exe, title, rect) => ({ exe, title, rect: rect || win, display: D });
const dec = (o) => AP.decide(Object.assign({ now: at(14, 0), settings: S(), fg: FG('notepad', 'Ghi chu', win), processes: [], focusAssist: false, probeError: false }, o));
const big = { big: true, sound: 0.7, reason: null };
const skip = r => ({ big: false, sound: 0, reason: r });
const quiet = { big: false, sound: 0.35, reason: 'quiet' };

// --- bình thường
eq('ban ngay, khong gi -> nhac to', dec(), big);
eq('desktop trong (Program Manager, explorer, phu kin)', dec({ fg: FG('explorer', 'Program Manager', full) }), big);
eq('desktop trong (khong tieu de)', dec({ fg: FG('explorer', '', full) }), big);
eq('khong co fg -> nhac to', dec({ fg: null }), big);
eq('window lon nhung khong phu taskbar', dec({ fg: FG('chrome', 'Gmail', { left: 0, top: 0, right: 1920, bottom: 1040 }) }), big);

// --- giờ yên lặng
eq('23:00 yen lang (qua nua dem)', dec({ now: at(23, 0) }), quiet);
eq('00:30 yen lang', dec({ now: at(0, 30) }), quiet);
eq('06:59 yen lang', dec({ now: at(6, 59) }), quiet);
eq('07:00 het yen lang', dec({ now: at(7, 0) }), big);
eq('21:59 chua yen lang', dec({ now: at(21, 59) }), big);
eq('22:00 bat dau yen lang', dec({ now: at(22, 0) }), quiet);
eq('tat gio yen lang -> 23h van nhac to', dec({ now: at(23, 0), settings: S({ quietHours: { on: false, from: '22:00', to: '07:00' } }) }), big);
eq('khung trong ngay 13-15 co hieu luc', dec({ now: at(14, 0), settings: S({ quietHours: { on: true, from: '13:00', to: '15:00' } }) }), quiet);
eq('khung trong ngay 13-15 ngoai khung', dec({ now: at(16, 0), settings: S({ quietHours: { on: true, from: '13:00', to: '15:00' } }) }), big);
eq('from == to khong yen lang', dec({ now: at(23, 0), settings: S({ quietHours: { on: true, from: '08:00', to: '08:00' } }) }), big);
eq('gio sai -> dung mac dinh 22-7', dec({ now: at(23, 0), settings: S({ quietHours: { on: true, from: 'abc', to: '99:99' } }) }), quiet);
eq('khong co quietHours -> khong yen lang', dec({ now: at(23, 0), settings: S({ quietHours: undefined }) }), big);

// --- họp / chia sẻ
eq('Zoom Meeting', dec({ processes: [{ name: 'Zoom', title: 'Zoom Meeting' }] }), skip('meeting'));
eq('Zoom Workplace (khong hop) -> nhac to', dec({ processes: [{ name: 'Zoom', title: 'Zoom Workplace' }] }), big);
eq('Zoom dang share (fg la PowerPoint thuong)', dec({ processes: [{ name: 'Zoom', title: 'Zoom Meeting' }, { name: 'POWERPNT', title: 'bao cao.pptx - PowerPoint' }], fg: FG('POWERPNT', 'bao cao.pptx - PowerPoint', win) }), skip('meeting'));
eq('Teams hop (Meeting)', dec({ processes: [{ name: 'ms-teams', title: 'Meeting with Lan | Microsoft Teams' }] }), skip('meeting'));
eq('Teams cuoc hop (VN)', dec({ processes: [{ name: 'ms-teams', title: 'Cuộc họp nhóm | Microsoft Teams' }] }), skip('meeting'));
eq('Teams chi chat -> nhac to', dec({ processes: [{ name: 'ms-teams', title: 'Chat | Microsoft Teams' }] }), big);
eq('Teams classic Teams.exe Meeting', dec({ processes: [{ name: 'Teams', title: 'Sprint Meeting | Microsoft Teams' }] }), skip('meeting'));
eq('Google Meet tab Chrome', dec({ processes: [{ name: 'chrome', title: 'Meet - abc-defg-hij - Google Chrome' }] }), skip('meeting'));
eq('Meet tab Edge meet.google.com', dec({ processes: [{ name: 'msedge', title: 'meet.google.com is sharing your screen' }] }), skip('meeting'));
eq('Chrome tab Facebook -> nhac to', dec({ processes: [{ name: 'chrome', title: '(2) Facebook - Google Chrome' }] }), big);
eq('Skype cuoc goi', dec({ processes: [{ name: 'Skype', title: 'Call with Minh' }] }), skip('meeting'));
eq('Webex meeting', dec({ processes: [{ name: 'webexmta', title: 'Weekly Meeting - Webex' }] }), skip('meeting'));
eq('Webex sanh cho -> nhac to', dec({ processes: [{ name: 'webex', title: 'Cisco Webex Meetings' }] }), big);
eq('Discord screen share', dec({ processes: [{ name: 'Discord', title: 'Screen Share - #general - Discord' }] }), skip('meeting'));
eq('Discord binh thuong -> nhac to', dec({ processes: [{ name: 'Discord', title: '#general - Discord' }] }), big);
eq('cua so bat ky "dang chia se man hinh"', dec({ processes: [{ name: 'foo', title: 'Đang chia sẻ màn hình của bạn' }] }), skip('meeting'));

// --- trình chiếu / toàn màn hình
eq('PowerPoint Slide Show', dec({ fg: FG('POWERPNT', 'PowerPoint Slide Show - bao cao.pptx', full) }), skip('fullscreen'));
eq('PowerPoint Slide Show dang cua so', dec({ fg: FG('POWERPNT', 'PowerPoint Slide Show - bao cao.pptx', win) }), skip('fullscreen'));
eq('PowerPoint soan thao -> nhac to', dec({ fg: FG('POWERPNT', 'bao cao.pptx - PowerPoint', win) }), big);
eq('game toan man hinh', dec({ fg: FG('eldenring', 'ELDEN RING', full) }), skip('fullscreen'));
eq('video fullscreen lech 1px', dec({ fg: FG('vlc', 'phim.mkv - VLC', { left: -1, top: -1, right: 1921, bottom: 1081 }) }), skip('fullscreen'));
eq('toan man hinh o man hinh phu', dec({ fg: { exe: 'game', title: 'G', rect: { left: 1920, top: 0, right: 3840, bottom: 1080 }, display: { left: 1920, top: 0, right: 3840, bottom: 1080 } } }), skip('fullscreen'));
eq('chinh app Mochi khong tinh', dec({ fg: FG('Mochi Notes', 'Be Mochi', full) }), big);
eq('rect thieu so -> khong tinh fullscreen', dec({ fg: { exe: 'x', title: 'y', rect: { left: 0 }, display: D } }), big);

// --- Focus assist
eq('Focus assist bat', dec({ focusAssist: true }), quiet);
eq('Focus assist + dang hop -> im tieng', dec({ focusAssist: true, processes: [{ name: 'Zoom', title: 'Zoom Meeting' }] }), skip('meeting'));

// --- lỗi dò / cài đặt
eq('loi do -> coi la khong ban, nhac to', dec({ probeError: true, fg: null, processes: [] }), big);
eq('loi do: bo qua du lieu', dec({ probeError: true, processes: [{ name: 'Zoom', title: 'Zoom Meeting' }] }), big);
eq('loi do + gio yen lang -> van yen lang', dec({ probeError: true, now: at(23, 30) }), quiet);
eq('smartAlert tat -> hop van nhac to', dec({ settings: S({ smartAlert: false }), processes: [{ name: 'Zoom', title: 'Zoom Meeting' }] }), big);
eq('smartAlert tat nhung yen lang van tinh', dec({ settings: S({ smartAlert: false }), now: at(23, 0), processes: [{ name: 'Zoom', title: 'Zoom Meeting' }] }), quiet);
eq('bigAlert tat -> big false', dec({ settings: S({ bigAlert: false }) }).big, false);
eq('bigAlert tat -> reason off', dec({ settings: S({ bigAlert: false }) }).reason, 'off');
eq('input rong -> khong nem loi', AP.decide(), big);
eq('processes khong phai mang', dec({ processes: 'x' }), big);

// --- âm lượng
eq('volume 0 tat tieng nhung van nhac to', dec({ settings: S({ alertVolume: 0 }) }), { big: true, sound: 0, reason: null });
eq('volume 100', dec({ settings: S({ alertVolume: 100 }) }), { big: true, sound: 1, reason: null });
eq('volume 30', dec({ settings: S({ alertVolume: 30 }) }), { big: true, sound: 0.3, reason: null });
eq('volume 100 gio yen lang = 0.5', dec({ settings: S({ alertVolume: 100 }), now: at(2, 0) }).sound, 0.5);
eq('volume ngoai khoang bi kep', dec({ settings: S({ alertVolume: 500 }) }).sound, 1);
eq('volume am bi kep', dec({ settings: S({ alertVolume: -5 }) }).sound, 0);
eq('volume khong phai so -> 70', dec({ settings: S({ alertVolume: 'x' }) }).sound, 0.7);
eq('soundLevel ban ngay', AP.soundLevel(at(12, 0), S()), 0.7);
eq('soundLevel ban dem', AP.soundLevel(at(23, 0), S()), 0.35);

// --- parse kết quả PowerShell
const parsed = AP.parseProbe('﻿{"fg":{"title":"x","exe":"a","rect":{"left":0,"top":0,"right":1,"bottom":1},"display":{"left":0,"top":0,"right":1,"bottom":1}},"processes":{"name":"Zoom","title":"Zoom Meeting"},"dnd":true}');
eq('parseProbe 1 tien trinh (khong la mang)', parsed.processes, [{ name: 'Zoom', title: 'Zoom Meeting' }]);
eq('parseProbe dnd', parsed.focusAssist, true);

// --- probeSystem: lỗi / timeout / cache (execFile giả)
(async () => {
  const state = { killed: false };
  const mk = cb => (cmd, args, o, done) => { cb(done); return { kill() { state.killed = true; } }; };
  let r = await AP.probeSystem({ force: true, platform: 'linux' });
  eq('probe khong phai win32 -> error', !!r.error, true);
  r = await AP.probeSystem({ force: true, platform: 'win32', execFile: mk(d => d(new Error('boom'))) });
  eq('probe execFile loi -> error', !!r.error, true);
  r = await AP.probeSystem({ force: true, platform: 'win32', execFile: mk(d => d(null, 'khong phai json')) });
  eq('probe stdout rac -> error', !!r.error, true);
  const t0 = Date.now();
  r = await AP.probeSystem({ force: true, platform: 'win32', timeoutMs: 80, execFile: mk(() => { /* treo */ }) });
  eq('probe treo -> timeout dung han', r.error === 'timeout' && Date.now() - t0 < 600, true);
  eq('probe treo -> kill tien trinh', state.killed, true);
  let calls = 0;
  const ok = mk(d => { calls++; d(null, '{"fg":null,"processes":[],"dnd":false}'); });
  r = await AP.probeSystem({ force: true, platform: 'win32', execFile: ok });
  r = await AP.probeSystem({ platform: 'win32', execFile: ok });
  eq('probe cache 30s (chi goi 1 lan)', calls, 1);
  eq('probe ket qua hop le', r, { fg: null, processes: [], focusAssist: false });
  r = await AP.probeSystem({ force: true, platform: 'win32', execFile: ok });
  eq('force bo qua cache', calls, 2);

  console.log(`\n${pass} đạt, ${fail} lỗi (tổng ${pass + fail})`);
  process.exit(fail ? 1 : 0);
})();
