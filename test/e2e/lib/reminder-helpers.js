'use strict';
// Tiện ích cho test nhắc lịch (nhóm reminder).
const { launch, waitFor, sleep } = require('./app');

/** TZ (Etc/GMT±N) để giờ địa phương của app hiện ~ `hour`:xx (cho kết quả tất định theo giờ trong ngày). */
function tzForLocalHour(hour) {
  const hUtc = new Date().getUTCHours();
  const o = ((hour - hUtc + 12) % 24 + 24) % 24 - 12;      // -12..11 (UTC+o)
  if (o === 0) return 'Etc/UTC';
  return o > 0 ? 'Etc/GMT-' + o : 'Etc/GMT+' + (-o);
}

/** Mở app với giờ địa phương ~ hour. */
function launchAt(hour, opts = {}) {
  return launch(Object.assign({ waitNotes: 2 }, opts, { env: Object.assign({ TZ: tzForLocalHour(hour) }, opts.env || {}) }));
}

/** Bọc electron.Notification.prototype.show để ghi lại các lần hiện (không hiện thật). */
async function spyNotifications(app) {
  await app.main((c, electron) => {
    globalThis.__notifs = [];
    const N = electron.Notification;
    if (!N.prototype.__spied) {
      const orig = N.prototype.show;
      N.prototype.show = function () {
        try { globalThis.__notifs.push({ title: this.title, body: this.body, at: Date.now() }); } catch (_) { /* */ }
        return orig && 0;   // không hiện thật
      };
      N.prototype.__spied = true;
    }
    return true;
  });
}
const notifs = app => app.main(() => globalThis.__notifs || []);

/** Tạo note mới bằng Ctrl+Alt+N, trả {id, page}. */
async function newNoteViaShortcut(app) {
  const before = new Set((await app.notes()).map(n => n.id));
  await app.shortcut('Ctrl+Alt+N');
  const id = await waitFor(async () => (await app.notes()).map(n => n.id).find(i => !before.has(i)), { msg: 'note mới' });
  const page = await app.noteWindow(id);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#editor');
  return { id, page };
}
async function typeInto(page, text) {
  await page.click('#editor');
  await page.keyboard.type(text);
}

/** Tạo note có nội dung (qua ctx) rồi đặt due = now+ms (đặt tay, lead 0). */
async function makeDueNote(app, text, ms, extra = {}) {
  return app.main((c, e, a) => {
    const n = c.notes.createNote({ html: '<div>' + a.text + '</div>', autoReminder: false });
    c.notes.setNoteReminder(n.id, { due: Date.now() + a.ms, lead: 0 });
    if (a.hide) c.notes.hideNote(n.id);
    return n.id;
  }, { text, ms, hide: !!extra.hide });
}
const getNote = (app, id) => app.main((c, e, i) => JSON.parse(JSON.stringify(c.findNote(i))), id);
const stageNow = app => app.main(c => c.pet.stage ? c.pet.stage.current() : null);
const stageSize = app => app.main(c => c.pet.stage ? c.pet.stage.size() : -1);

/** Bấm nút trên bong bóng của bé (renderer pet.html). */
async function clickPetButton(app, id) {
  const p = await app.page('pet.html');
  const sel = '#bBtns button[data-id="' + id + '"]';
  await p.waitForSelector(sel, { timeout: 10000, state: 'attached' });
  await p.click(sel, { timeout: 8000, force: true });
}

module.exports = { tzForLocalHour, launchAt, spyNotifications, notifs, newNoteViaShortcut, typeInto, makeDueNote, getNote, stageNow, stageSize, clickPetButton, waitFor, sleep };
