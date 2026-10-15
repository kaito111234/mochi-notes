'use strict';
// Toast Windows có nút (Tắt / Hoãn / Xong...). Dùng kích hoạt giao thức 'mochi-notes://<kind>/<action>?id=..&r=..&m=..'.
// buildToastXml / toastUrl / parseToastUrl là hàm thuần (có test); phần còn lại cần electron và được nạp muộn.
const path = require('path');

const SCHEME = 'mochi-notes';
const KINDS = ['alarm', 'note', 'memo'];
const ACTIONS = ['stop', 'snooze', 'done', 'open'];

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const cleanMin = v => { const n = Math.round(Number(v)); return n >= 1 && n <= 1440 ? n : null; };

function toastUrl(kind, action, refId, extra) {
  const q = ['id=' + encodeURIComponent(String(refId == null ? '' : refId))];
  const e = extra && typeof extra === 'object' ? extra : {};
  if (e.r != null && e.r !== '') q.push('r=' + encodeURIComponent(String(e.r)));
  const m = cleanMin(e.m);
  if (m != null) q.push('m=' + m);
  if (Number.isFinite(Number(e.d)) && Number(e.d) > 0) q.push('d=' + Math.round(Number(e.d)));
  return SCHEME + '://' + kind + '/' + action + '?' + q.join('&');
}

function parseToastUrl(url) {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  const mt = /^mochi-notes:\/\/([a-z]+)\/+([a-z]+)\/*(?:\?([^#]*))?(?:#.*)?$/i.exec(s);
  if (!mt) return null;
  const kind = mt[1].toLowerCase(), action = mt[2].toLowerCase();
  if (!KINDS.includes(kind) || !ACTIONS.includes(action)) return null;
  const params = {};
  for (const part of (mt[3] || '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    let k, v;
    try {
      k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
      v = i < 0 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    } catch (_) { return null; }
    if (!(k in params)) params[k] = v;
  }
  if (!params.id) return null;
  const out = { kind, action, id: params.id };
  if (params.r) out.r = params.r;
  const m = cleanMin(params.m);
  if (m != null) out.m = m;
  if (Number(params.d) > 0) out.d = Math.round(Number(params.d));
  return out;
}

/** Lời nhắc mà nút toast (Xong/Hoãn) trỏ tới còn hiệu lực không: note còn (chưa xoá/thùng rác), nhắc p.r còn, chưa xong, giờ (p.d nếu có) chưa bị đổi. */
function noteToastValid(findNote, p) {
  const n = typeof findNote === 'function' ? findNote(p.id) : null;
  if (!n) return false;
  const list = Array.isArray(n.reminders) ? n.reminders : (n.reminder ? [n.reminder] : []);
  const r = p.r ? list.find(x => x && x.id === p.r) : n.reminder;
  if (!r || r.done) return false;
  if (p.d && Math.abs(Number(r.due) - p.d) > 1000) return false;
  return true;
}

/** buttons: [{id, label, m?}]. id là action ('stop','snooze','done','open'). */
function buildToastXml(o) {
  o = o || {};
  const kind = KINDS.includes(o.kind) ? o.kind : 'note';
  const extra = o.extra && typeof o.extra === 'object' ? o.extra : {};
  const scenario = kind === 'alarm' ? ' scenario="alarm"' : kind === 'note' ? ' scenario="reminder"' : '';
  const launch = toastUrl(kind, 'open', o.refId, extra);
  const texts = ['<text>' + escXml(o.title) + '</text>'];
  if (o.body) texts.push('<text>' + escXml(o.body) + '</text>');
  const btns = (Array.isArray(o.buttons) ? o.buttons : []).filter(b => b && ACTIONS.includes(b.id)).slice(0, 5).map(b => {
    const ex = Object.assign({}, extra);
    if (b.m != null) ex.m = b.m;
    return '<action content="' + escXml(b.label || b.id) + '" arguments="' + escXml(toastUrl(kind, b.id, o.refId, ex)) + '" activationType="protocol"/>';
  });
  return '<toast launch="' + escXml(launch) + '" activationType="protocol"' + scenario + '>' +
    '<visual><binding template="ToastGeneric">' + texts.join('') + '</binding></visual>' +
    (kind === 'alarm' ? '<audio silent="true"/>' : '') +
    (btns.length ? '<actions>' + btns.join('') + '</actions>' : '') +
    '</toast>';
}

function findUrl(argv) {
  if (!Array.isArray(argv)) return null;
  return argv.find(a => typeof a === 'string' && a.toLowerCase().startsWith(SCHEME + '://')) || null;
}

function init(ctx) {
  let electron;
  try { electron = require('electron'); } catch (_) { return; }
  const { app, Notification } = electron;
  if (!app) return;
  ctx.alarms = ctx.alarms || {};
  const refs = new Map();   // 'kind:refId' -> Set<Notification> (giữ tham chiếu, tránh GC)
  const keyOf = (kind, id) => kind + ':' + id;

  function track(kind, id, nt) {
    const k = keyOf(kind, id);
    if (!refs.has(k)) refs.set(k, new Set());
    refs.get(k).add(nt);
    const drop = () => { const s = refs.get(k); if (s) { s.delete(nt); if (!s.size) refs.delete(k); } };
    nt.on('close', drop); nt.on('failed', drop);
    return drop;
  }
  /** Đóng mọi toast của (kind, refId). */
  function closeFor(kind, refId) {
    const s = refs.get(keyOf(kind, refId));
    if (!s) return;
    for (const nt of [...s]) { try { nt.close(); } catch (_) { /* bỏ qua */ } }
    refs.delete(keyOf(kind, refId));
  }

  function show(o) {
    try {
      o = o || {};
      if (!Notification || !Notification.isSupported()) return null;
      const kind = KINDS.includes(o.kind) ? o.kind : 'note';
      let nt;
      if (process.platform === 'win32') {
        nt = new Notification({ toastXml: buildToastXml(o) });
      } else {
        nt = new Notification({ title: String(o.title || 'Mochi Notes'), body: String(o.body || '') });
        nt.on('click', () => handleUrl(toastUrl(kind, 'open', o.refId, o.extra)));
      }
      const drop = track(kind, o.refId, nt);
      nt.on('click', drop);
      nt.show();
      return nt;
    } catch (e) { console.error('[toast]', e); return null; }
  }

  function handleUrl(url) {
    const p = parseToastUrl(url);
    if (!p) return false;
    try {
      if (p.kind === 'alarm') {
        const al = ctx.alarms;
        if (al.isRinging && !al.isRinging(p.id)) { closeFor('alarm', p.id); return true; }   // chuông đã tắt/hoãn: bỏ qua nút cũ
        if (p.action === 'stop' && al.stop) al.stop(p.id);
        else if (p.action === 'snooze' && al.snooze) al.snooze(p.id, p.m);
        closeFor('alarm', p.id);
      } else if (p.kind === 'note') {
        const n = ctx.notes;
        if (!n) return false;
        if ((p.action === 'done' || p.action === 'snooze') && !noteToastValid(ctx.findNote, p)) {   // toast cũ: bỏ qua, không đụng note
          closeFor('note', p.id);
          try { show({ kind: 'memo', refId: 'stale', title: 'Mochi Notes', body: 'Lời nhắc này đã cũ' }); } catch (_) { /* bỏ qua */ }
          return true;
        }
        if (p.action === 'done' && n.completeNote) n.completeNote(p.id, p.r);
        else if (p.action === 'snooze' && n.snoozeNote) n.snoozeNote(p.id, p.m || 10, p.r);
        else if (p.action === 'open' && n.showNote) n.showNote(p.id);
        closeFor('note', p.id);
      } else if (p.kind === 'memo') {
        if (p.action === 'open' && ctx.memos && ctx.memos.showNow) ctx.memos.showNow([p.id]);
        closeFor('memo', p.id);
      }
      return true;
    } catch (e) { console.error('[toast] handleUrl', e); return false; }
  }

  Object.assign(ctx.alarms, { toast: show, handleToastUrl: handleUrl, closeToast: closeFor });

  // Khi note được xong/hoãn từ nơi khác thì đóng toast của note đó.
  try {
    if (ctx.bus) {
      ctx.bus.on('reminder:done', e => e && closeFor('note', e.noteId));
      ctx.bus.on('reminder:snoozed', e => e && closeFor('note', e.noteId));
    }
  } catch (_) { /* bỏ qua */ }

  if (process.platform === 'win32') {
    try {
      if (!app.isPackaged && process.argv[1]) app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
      else app.setAsDefaultProtocolClient(SCHEME);
    } catch (e) { console.error('[toast] đăng ký giao thức', e); }
    app.on('second-instance', (_e, argv) => { const u = findUrl(argv); if (u) handleUrl(u); });
    const u0 = findUrl(process.argv);
    if (u0) setTimeout(() => handleUrl(u0), 4000);   // sau khi báo thức/note đã nạp
  }
}

module.exports = { init, buildToastXml, toastUrl, parseToastUrl, noteToastValid, escXml, findUrl, SCHEME };
