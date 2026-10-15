'use strict';
// Hiểu lệnh tiếng Việt gõ trong note cho bé Mochi ("bé ơi, …" — xem src/note/command.js). Thuần, không phụ thuộc electron, chạy offline.
//   parse('dọn mấy note trống')            -> { kind: 'cleanEmpty' }
//   parse('nhắc tớ uống nước lúc 15h')     -> { kind: 'remind', text: 'uống nước lúc 15h' }
//   parse('dọn dẹp rồi xếp note lại')      -> { kind: 'multi', cmds: [{kind:'cleanDone'}, {kind:'arrange'}] }
//   parse('đừng xoá note này')             -> { kind: 'negated' }
//   parse('dọn gọn')                       -> { kind: 'unclear', options: [{ label, cmd }, …] }   (bé hỏi lại bằng nút)
//   parse('abc xyz')                       -> { kind: 'unknown', hints: ['dọn dẹp', …] }
// Cách làm: chuẩn hoá (bỏ dấu, sửa teencode/Telex, từ đệm) -> chấm điểm theo từ khoá đồng nghĩa có trọng số
// (+ khoảng cách sửa nhỏ cho từ >= 4 ký tự) -> chọn lệnh, hoặc hỏi lại khi không chắc.

let P = null;
try { P = require('../../shared/parse.js'); } catch (_) { /* thiếu parse.js: bỏ qua phần hiểu giờ */ }

const FOLD_RE = /[̀-ͯ]/g;
function plain(s) {
  return String(s || '').normalize('NFD').replace(FOLD_RE, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9\s:]/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Gấp dấu nhưng giữ nguyên độ dài (để lấy lại phần chữ gốc theo chỉ số). */
function foldSame(s) {
  let o = '';
  for (const c of String(s)) {
    if (c.length > 1) { o += ' '.repeat(c.length); continue; }   // emoji/ký tự 2 đơn vị: giữ nguyên độ dài
    const l = c.toLowerCase();
    o += l.length !== 1 ? c : (l === 'đ' ? 'd' : (l.normalize('NFD')[0] || l));
  }
  return o;
}

// ---------------------------------------------------------------- bảng lệnh
const LABELS = {
  help: 'Xem bé làm được gì', cancelRemind: 'Tắt nhắc', openTrash: 'Mở thùng rác', trashThis: 'Xoá note này', arrange: 'Xếp note gọn lại',
  cleanEmpty: 'Dọn note trống', cleanExpired: 'Dọn note hết hạn', cleanDone: 'Dọn note đã xong', hideAll: 'Ẩn hết note',
  showAll: 'Hiện hết note', newNote: 'Tạo note mới', remind: 'Tạo nhắc', knock: 'Đi gõ cửa nhắc việc', list: 'Mở danh sách note',
  sleep: 'Đi ngủ', wake: 'Thức dậy', focus: 'Tập trung 25 phút', focusStop: 'Dừng tập trung', daily: 'Lặp checklist hằng ngày',
  dailyOff: 'Bỏ lặp hằng ngày', summary: 'Tổng kết hôm nay', backup: 'Sao lưu note'
};
const ROOM_LABEL = { wardrobe: 'Mở tủ đồ', gacha: 'Quay gacha', shop: 'Mở cửa hàng', quests: 'Xem nhiệm vụ', stats: 'Xem thống kê' };
const TRICK_LABEL = {
  read: 'Đọc sách', eat: 'Ăn cơm nắm', tea: 'Uống trà', water: 'Tưới cây', bubbles: 'Thổi bong bóng', music: 'Nghe nhạc', butterfly: 'Bắt bướm',
  draw: 'Vẽ tranh', yawn: 'Ngáp', dance: 'Múa', sing: 'Hát', exercise: 'Tập thể dục', sweep: 'Quét nhà', spin: 'Xoay vòng', wave: 'Vẫy tay chào',
  swing: 'Đánh đu', pinfix: 'Ghim note', peek: 'Ngó note', nap: 'Ngủ trưa', stretch: 'Vươn vai', hop: 'Nhảy nhảy', look: 'Nhìn quanh'
};
/** Nhãn tiếng Việt của một lệnh đã parse (dùng cho nút hỏi lại / gợi ý). */
function label(c) {
  if (!c) return '';
  if (c.kind === 'room') return ROOM_LABEL[c.tab] || 'Mở phòng';
  if (c.kind === 'trick') return TRICK_LABEL[c.name] || 'Làm trò';
  if (c.kind === 'focus') return 'Tập trung ' + (c.min || 25) + ' phút';
  if (c.kind === 'newNote' && c.text) return 'Tạo note: ' + c.text.slice(0, 24);
  return LABELS[c.kind] || c.kind;
}

// Quy ước: rules[0] là "ý chính" (dùng để biết 2 lệnh có chung từ hay không). Mỗi rule: { alts: {cụm: điểm}, req?: bool }.
// Điểm rule = điểm cao nhất của cụm khớp; điểm lệnh = tổng điểm các rule (rule req không khớp -> 0). Điểm âm = loại trừ.
const A = (alts, req) => ({ alts, req: !!req });
const TRASH_V = { xoa: 2.7, vut: 2.7, huy: 2.4, nem: 2.6, quang: 2.6, 'loai bo': 2.7, 'go bo': 2.7, 'tieu huy': 2.7, delete: 2.7, del: 2.6, remove: 2.6, bo: 2.2, 'bo di': 2.7, 'cat di': 2.2, thao: 1.6, 'dep di': 2.2 };
const CLEAN_V = { don: 1.6, 'don dep': 1.8, xoa: 1.6, vut: 1.6, loai: 1.6, bo: 1.4, go: 1.4, clean: 1.8, 'lam sach': 1.8, 'tong ve sinh': 1.8, 've sinh': 1.8, dep: 1.4, 'thu don': 1.8 };
const FOCUS_N = { 'tap trung': 3.5, focus: 3.5, pomodoro: 3.5 };
const STOP_V = { dung: 2, huy: 2, thoi: 2, 'ket thuc': 2.5, tat: 2, nghi: 2, stop: 2.5, 'het gio': 2.5, xong: 2, bo: 2, ngung: 2 };
const DAILY_N = { 'hang ngay': 3, 'moi ngay': 3, daily: 3, lap: 2.5, 'lap lai': 3 };
const T = (name, alts) => ({ id: 'trick:' + name, cmd: { kind: 'trick', name }, rules: [A(alts, true)] });
const R = (tab, alts) => ({ id: 'room:' + tab, cmd: { kind: 'room', tab }, rules: [A(alts, true)] });

const INTENTS = [
  { id: 'help', cmd: { kind: 'help' }, rules: [A({ help: 3.5, 'huong dan': 3.5, lenh: 2.7, 'cac lenh': 3.5, 'biet lam gi': 3.5, 'lam duoc gi': 3.5, 'lam gi duoc': 3.5, 'co the lam gi': 3.5, 'cach dung': 3, 'tro giup': 3.5, menu: 2.7, '^giup$': 3.5, '^giup do$': 3.5, '^giup voi$': 3.5, '^giup di$': 3.5 }, true)] },
  { id: 'openTrash', cmd: { kind: 'openTrash' }, rules: [A({ thungrac: 2.8 }, true), A({ mo: 1.6, xem: 1.6, vao: 1.2, coi: 1.6, 'kiem tra': 1.6, hien: 1.6, open: 1.6, check: 1.6, don: 1, 'do ra': 1 }), A({ bo: -2.5, vut: -2.5, nem: -2.5, xoa: -2.5, huy: -2.5, quang: -2.5, 'cho vao': -2.5, 'xoa thungrac': 3.5, 'don thungrac': 1.5, 'vut thungrac': 1 })] },
  { id: 'trashThis', cmd: { kind: 'trashThis' }, rules: [A(TRASH_V, true), A({ nay: 1, no: 0.8, do: 0.6, kia: 0.6, 'note nay': 1.2, 'luon': 0.4 }), A({ trong: -3, rong: -3, trang: -3, thua: -3, 'het han': -3, 'qua han': -3, xong: -3, 'hoan thanh': -3, 'tat ca': -3, het: -3, moi: -3, cu: -3, 'hang ngay': -3, 'moi ngay': -3, lap: -3, 'tap trung': -3, focus: -3, rac: -3, 'da xong': -3, 'xoa thungrac': -4, 'don thungrac': -4 }), A({ thungrac: 0.8 })] },
  { id: 'arrange', cmd: { kind: 'arrange' }, rules: [A({ xep: 3, 'sap xep': 3.5, gom: 2.7, 'xep note': 3.6, 'sap note': 3, 'gon lai': 2, 'gon gang': 2.2, 'ngan nap': 2.7, sort: 2.7, 'lam gon': 2.7, 'don gon': 2.2, 'xep hang': 2.7, 'xep lai': 3 }, true)] },
  { id: 'cleanEmpty', cmd: { kind: 'cleanEmpty' }, rules: [A(CLEAN_V), A({ trong: 2.2, rong: 2.2, trang: 2.2, thua: 2, 'khong co chu': 2.4, empty: 2.2, blank: 2.2, rac: 2 }, true), A({ thungrac: -4, 'het han': -4, 'qua han': -4 })] },
  { id: 'cleanExpired', cmd: { kind: 'cleanExpired' }, rules: [A({ 'qua han': 2.4, 'het han': 2.4, expired: 2.4, 'tre han': 2.4, cu: 1.6, 'het han su dung': 2.6 }, true), A({ don: 1.4, xoa: 1.4, vut: 1.4, loai: 1.4, bo: 1.2, go: 1.2, clean: 1.4, 'lam sach': 1.4, dep: 1.2, 'don dep': 1.4 })] },
  { id: 'cleanDone', cmd: { kind: 'cleanDone' }, rules: [A({ 'don dep': 3.5, don: 3, clean: 3, cleanup: 3, 've sinh': 3, 'lam sach': 3, 'don sach': 3.2, 'tong ve sinh': 3.4, 'thu don': 3, 'dep di': 2.6, dep: 2.6, 'xoa xong': 3.2, 'vut xong': 3.2, 'bo xong': 3 }), A({ xong: 1.6, 'hoan thanh': 1.6, done: 1.6, 'da lam': 1.6, 'het viec': 1.2 }), A({ thungrac: -4, trong: -2.5, rong: -2.5, 'het han': -4, 'qua han': -4, nha: -4, 'thung rac': -4, cu: -2.5 })] },
  { id: 'hideAll', cmd: { kind: 'hideAll' }, rules: [A({ giau: 3.2, 'thu gon': 2.6, 'an het': 3.8, an: 1.2, cat: 1.8, hide: 3.2, dong: 1.2 }, true), A({ het: 2, 'tat ca': 2.2, moi: 2, all: 2, 'cac note': 1.6, 'toan bo': 2.2, note: 0.9 }), A({ 'hien': -3, 'mo': -3, 'hien het': -3 })] },
  { id: 'showAll', cmd: { kind: 'showAll' }, rules: [A({ hien: 2.6, 'hien ra': 3, 'mo ra': 2.4, mo: 1.4, show: 3.2, 'lay ra': 2.6, 'dua ra': 2.2, bat: 1, xem: 1.4 }, true), A({ het: 2, 'tat ca': 2.2, moi: 2, all: 2, 'cac note': 1.6, 'toan bo': 2.2, note: 0.9 }), A({ 'danh sach': -3, thungrac: -4 })] },
  { id: 'knock', cmd: { kind: 'knock' }, rules: [A({ nhac: 2.7, 'go cua': 3.2, 'kiem tra viec': 3.4, 'viec gi': 3.2, 'con viec': 2.7, 'co viec': 2.3, 'nhac viec': 3.4, 'viec can lam': 3.2, 'nhac nho': 2.7, 'hoi tham': 2 }, true)] },
  { id: 'list', cmd: { kind: 'list' }, rules: [A({ 'danh sach': 3.2, 'liet ke': 3.2, list: 2.8, 'kho note': 2.2, 'quan ly note': 3.2, 'ds': 2.7 }, true)] },
  R('wardrobe', { 'tu do': 3.5, 'thay do': 3.5, 'mac do': 3.3, 'quan ao': 3.2, 'thay quan ao': 3.6, 'doi do': 3.1, wardrobe: 3.2, 'trang phuc': 3.2 }),
  R('gacha', { gacha: 3.6, 'quay do': 3.6, 'quay thuong': 3.6, 'quay trung': 3.1, 'vong quay': 3.1 }),
  R('shop', { 'cua hang': 3.6, shop: 3.1, 'an gi': 3.6, 'doi bung': 3.6, 'cho an': 3.6, 'mua do an': 3.6, 'mua do': 2.7, 'do an': 2.9 }),
  R('quests', { 'nhiem vu': 3.6, quest: 3.1, quests: 3.1 }),
  R('stats', { 'thong ke': 3.6, stats: 3.1, 'chi so': 2.9 }),
  { id: 'sleep', cmd: { kind: 'sleep' }, rules: [A({ 'di ngu': 3.6, 'ngu di': 3.6, 'ngu ngon': 3.3, ngu: 2.7, 'nghi ngoi': 2.7, 'nghi di': 2.4, 'tam nghi': 2.4, sleep: 3, 'dung lai': 0.5 }, true), A({ trua: -4, 'mot chut': -4, chut: -4, gat: -4 })] },
  { id: 'wake', cmd: { kind: 'wake' }, rules: [A({ 'thuc day': 3.6, 'day di': 3.6, day: 2.7, 'tinh giac': 3.2, 'tinh day': 3.2, 'het ngu': 3.2, wake: 3.2, 'day roi': 3 }, true)] },
  { id: 'focusStop', cmd: { kind: 'focusStop' }, rules: [A(STOP_V, true), A(FOCUS_N, true)] },
  { id: 'focus', cmd: { kind: 'focus', min: 25 }, rules: [A(Object.assign({ 'lam viec': 2.7, 'hoc bai': 2.7, 'bat dau hoc': 2.7 }, FOCUS_N), true), A({ dung: -4, huy: -4, thoi: -4, 'ket thuc': -4, tat: -4, nghi: -4, stop: -4, 'het gio': -4, xong: -4, ngung: -4, don: -3, bo: -4 })] },
  { id: 'dailyOff', cmd: { kind: 'dailyOff' }, rules: [A({ bo: 2, tat: 2, thoi: 2, ngung: 2, huy: 2, xoa: 2, vut: 1.8, go: 1.8, het: 1.6, dung: 2, 'khong lap': 2.4, 'dung lap': 2.8 }, true), A(DAILY_N, true)] },
  { id: 'daily', cmd: { kind: 'daily' }, rules: [A(Object.assign({ 'lap hang ngay': 4, 'reset moi ngay': 4 }, DAILY_N), true), A({ bo: -4, tat: -4, thoi: -4, ngung: -4, huy: -4, dung: -4, xoa: -4, vut: -4, go: -4, 'khong lap': -4 })] },
  { id: 'summary', cmd: { kind: 'summary' }, rules: [A({ 'tom tat': 3.5, 'tong ket': 3.5, 'bao cao': 3.1, 'hom nay the nao': 4, 'hom nay lam duoc gi': 4, 'bao cao hom nay': 4, 'tong ket hom nay': 4, 'thong ke hom nay': 4.2, recap: 3.2, summary: 3.2, 'ket qua hom nay': 3.8 }, true), A({ 'hom nay': 1 })] },
  { id: 'backup', cmd: { kind: 'backup' }, rules: [A({ 'sao luu': 4, backup: 4, 'luu du phong': 4, 'luu lai': 2.6, 'sao chep': 2.8, export: 3, 'xuat file': 3 }, true)] },
  T('read', { 'doc sach': 3.6, 'doc truyen': 3.6, 'xem sach': 3.6, 'doc bao': 3.2, sach: 2.7, 'doc': 2.7 }),
  T('eat', { 'an com': 3.6, 'an banh': 3.6, 'an xoi': 3.6, 'an bua': 3.6, 'an onigiri': 3.6, 'an di': 3.1, 'be an': 3.2, '^an$': 3.2, 'an vat': 3.6, 'an sang': 3.6, 'an toi': 3.6, 'an trua': 3.6, 'an mochi': 3.6, 'nom nom': 3.1, 'an gi do': 3 }),
  T('tea', { 'uong tra': 3.6, 'uong nuoc': 3.3, 'uong cafe': 3.6, 'uong ca phe': 3.6, 'uong sua': 3.6, 'pha tra': 3.6, 'pha ca phe': 3.6, 'pha cafe': 3.6 }),
  T('water', { 'tuoi cay': 3.6, 'tuoi hoa': 3.6, 'tuoi nuoc': 3.3, tuoi: 2.9 }),
  T('bubbles', { 'bong bong': 3.6, 'thoi bong bong': 4.2, bubble: 3.2, bubbles: 3.2 }),
  T('music', { 'nghe nhac': 4.2, 'bat nhac': 4.2, 'mo nhac': 4.2, 'cho nhac': 3.6, music: 3.2 }),
  T('butterfly', { 'bat buom': 3.6, buom: 3.1, butterfly: 3.1 }),
  T('draw', { 've tranh': 3.6, 've hinh': 3.6, 've di': 3.6, 've cho': 3.6, 'be ve': 3.6, '^ve$': 3.4, draw: 3.2 }),
  T('yawn', { ngap: 3.6, 'buon ngu': 3.4, 'ngap ngu': 3.8 }),
  T('dance', { 'mua!': 3.4, 'nhay mua!': 4.2, mua: 1.4, 'nhay mua': 3.8, 'quay di': 3.6, 'khieu vu': 3.6, dance: 3.2, 'mua di': 3.6, 'mua mot bai': 3.6 }),
  T('sing', { hat: 3.1, 'ca hat': 3.3, 'hat di': 3.6, sing: 3.1, 'hat bai': 3.6, 'hat mot bai': 3.6, 'ngam nga': 3.1 }),
  T('exercise', { 'the duc': 3.6, 'tap the duc': 4.2, gym: 3.2, 'hit dat': 3.6, 'tap luyen': 3.3, 'chay bo': 3.2, 'tap yoga': 3.4 }),
  T('sweep', { quet: 3.6, 'quet nha': 4.2, 'don nha': 4.2, 'quet don': 4.2, 'lau nha': 3.8, 'quet rac': 3.8 }),
  T('spin', { xoay: 3.6, 'quay vong': 3.6, 'xoay vong': 4.2, 'quay tron': 3.6 }),
  T('wave', { vay: 3.6, chao: 3.3, 'xin chao': 3.6, hello: 3.2, hi: 2.9, 'vay tay': 4.2 }),
  T('swing', { 'danh du': 3.6, 'du dua': 3.6, 'choi du': 3.6, '^du$': 3.2, 'du du': 3.4 }),
  T('pinfix', { ghim: 3.6, pin: 2.7 }),
  T('peek', { ngo: 3.1, 'xem note': 3.3, 'doc note': 3.3, 'ngo xem': 3.6, '^doc$': 2.7, 'xem thu': 2.7 }),
  T('nap', { 'ngu trua': 4.2, 'chop mat': 3.6, 'ngu mot chut': 3.8, nap: 3.1, 'ngu chut': 3.8, 'ngu gat': 3.8, 'nghi trua': 3.6 }),
  T('stretch', { 'vuon vai': 4.2, 'duoi vai': 3.6, 'vuon minh': 3.6, stretch: 3.2 }),
  { id: 'trick:hop', cmd: { kind: 'trick', name: 'hop' }, rules: [A({ nhay: 3.1, nhun: 3.1, 'nhay len': 3.6, 'nhay nhay': 3.6, 'bat nhay': 3.6, 'nhun nhay': 3.6, hop: 3 }, true), A({ 'mua!': -2, mua: -1 })] },
  T('look', { nhin: 3.1, 'ngo quanh': 3.6, 'nhin quanh': 3.6, 'nhin xem': 3.6, 'xem xung quanh': 3.6, 'nhin ra': 3.2 })
];

// ---------------------------------------------------------------- chuẩn hoá từ
// teencode / gõ tắt -> từ chuẩn không dấu
const TEEN = {
  ko: 'khong', k: 'khong', hok: 'khong', hong: 'khong', khum: 'khong', kg: 'khong', kh: 'khong', kong: 'khong', khg: 'khong', hk: 'khong',
  dc: 'duoc', 'đc': 'duoc', j: 'gi', r: 'roi', rui: 'roi', ns: 'noi', mik: 'minh', mk: 'minh', mn: 'moi nguoi', tks: 'cam on', thanks: 'cam on',
  oke: 'ok', okie: 'ok', okey: 'ok', nai: 'nay', nay: 'nay', naf: 'nay', ny: 'nay', bit: 'biet', bik: 'biet', zui: 'vui', dz: 'di', z: 'vay',
  vs: 'voi', vs2: 'voi', cx: 'cung', cug: 'cung', ak: 'a', ah: 'a', uh: 'u', oy: 'roi', roy: 'roi', rùi: 'roi', rj: 'roi', xog: 'xong', xonq: 'xong',
  nhe: 'nhe', nhs: 'nhe', nka: 'nha', nhj: 'nhi', dep: 'dep', dj: 'di', djj: 'di', ngu: 'ngu', ngủ: 'ngu', 'gium': 'giup', giumf: 'giup',
  note: 'note', nốt: 'note', nt: 'note', nhat: 'nhat', 'xoá': 'xoa', 'xóa': 'xoa', del: 'del', delet: 'delete', helf: 'help', hlep: 'help', hepl: 'help'
};
// từ đệm lịch sự / dư thừa: bỏ trước khi chấm điểm (cụm khớp ở bản gốc vẫn được tính)
const FILL = new Set(('nhe nha nhen nghe nhi nhỉ voi giup gium dum ho hộ gium cai may nhung cac chu minh to toi tui em anh chi ban nay_ ma la thi hay cung duoc oi a ha ne nua luon ' +
  'roi gium vay do_ cho di_ xin vui long lam on dum giumf tuy giup_ thu hen mot_ chut_').split(' '));
FILL.delete('nay_'); FILL.delete('do_'); FILL.delete('di_'); FILL.delete('giup_'); FILL.delete('mot_'); FILL.delete('chut_'); FILL.delete('nua'); FILL.delete('luon');
for (const w of ['di', 'giup']) FILL.add(w);
const CALL = new Set(['be', 'mochi', 'em', 'cung', 'ne', 'hey', 'alo', 'oi', 'e', 'a', 'bé', 'ê']);
const COMMON = new Set(['nhan', 'nhat', 'tien', 'tiem', 'phong', 'thoi', 'ngay', 'thang', 'nhin_', 'minh', 'nhom', 'tuan', 'sang', 'chieu', 'gio', 'phut', 'hang', 'hoan', 'quan', 'nhac_']);
COMMON.delete('thoi'); COMMON.delete('nhin_'); COMMON.delete('nhac_');

const VOCAB = new Set();
for (const it of INTENTS) for (const r of it.rules) for (const k of Object.keys(r.alts)) for (const w of k.replace(/[\^$]/g, '').split(' ')) if (w.length >= 2) VOCAB.add(w);
for (const w of ['note', 'nay', 'het', 'khong', 'dung', 'thungrac', 'chua', 'chang', 'khoan', 'nhac', 'can', 'nen']) VOCAB.add(w);

function dl(a, b, max) { // Damerau–Levenshtein có cắt sớm
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if (d[i][j] < rowMin) rowMin = d[i][j];
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
const collapse = t => t.replace(/([aeod])\1/g, '$1').replace(/([aou])w/g, '$1');
/** Sửa một từ: teencode -> Telex sai -> khoảng cách sửa nhỏ. Trả {w, fz}. */
function fixWord(t) {
  if (TEEN[t]) return { w: TEEN[t], fz: false };
  if (VOCAB.has(t) || /^\d/.test(t)) return { w: t, fz: false };
  const c = collapse(t);
  if (TEEN[c]) return { w: TEEN[c], fz: true };
  if (VOCAB.has(c)) return { w: c, fz: true };
  for (let i = 1; i < c.length; i++) {
    if ('sfrxjz'.indexOf(c[i]) >= 0) { const x = c.slice(0, i) + c.slice(i + 1); if (VOCAB.has(x)) return { w: x, fz: true }; if (TEEN[x]) return { w: TEEN[x], fz: true }; }
  }
  if (t.length >= 4 && !COMMON.has(t)) {
    const max = t.length >= 7 ? 2 : 1;
    let best = null, bd = max + 1, tied = [];
    for (const v of VOCAB) {
      if (v.length < 4 || Math.abs(v.length - t.length) > max) continue;
      if (t.length === 4 && v[0] !== t[0]) continue;
      const d = dl(t, v, max);
      if (d < bd) { bd = d; best = v; tied = [v]; } else if (d === bd && d <= max) tied.push(v);
    }
    if (tied.length > 1) { const pre = tied.filter(v => v.startsWith(t)); if (pre.length === 1) return { w: pre[0], fz: true }; }   // gõ thiếu chữ cuối ("trun" -> "trung")
    else if (best && bd <= max) return { w: best, fz: true };
  }
  return { w: t, fz: false };
}

/** raw -> mảng token {w, i, fz} (đã bỏ lời gọi đầu câu, sửa lỗi gõ). */
function tokenize(raw) {
  const s = String(raw || '').normalize('NFC').toLowerCase();
  const parts = s.split(/[^\p{L}\p{N}:]+/u).filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const rawTok = parts[i];
    const f = foldSame(rawTok).replace(/[^a-z0-9:]/g, '');
    if (!f) continue;
    if (f === 'dung') {                       // "đừng" (phủ định) hay "dừng" (ngừng): phân biệt theo dấu
      const nxt = foldSame(parts[i + 1] || '');
      if (rawTok === 'đừng') { out.push({ w: 'DUNGNEG', i, fz: false }); continue; }
      if (/^(xoa|vut|huy|nem|bo|don|dep|xep|sap|ngu|an|giau|cat|quet|hat|mua|gom|nhay|ve|doc|di)$/.test(nxt)) { out.push({ w: 'DUNGNEG', i, fz: false }); continue; }   // "dừng xoá" = thôi đừng xoá
      if (rawTok === 'dung' && !/^(tap|focus|pomodoro|lai|nhac|hoc|lam|viec|nha|hang|moi|lap|daily|ngay)/.test(nxt)) { out.push({ w: 'DUNGNEG', i, fz: false }); continue; }
      out.push({ w: 'dung', i, fz: false }); continue;
    }
    if (rawTok === 'múa') { out.push({ w: 'mua!', i, fz: false }); continue; }
    const x = fixWord(f);
    for (const w of x.w.split(' ')) out.push({ w, i, fz: x.fz });
  }
  // bỏ lời gọi đầu câu ("bé ơi", "mochi ơi", "em ơi")
  let k = 0;
  while (k < out.length - 1 && CALL.has(out[k].w)) k++;
  return out.slice(k);
}
const TAIL_PART = new Set(['nhe', 'nha', 'nhen', 'nghe', 'nhi', 'oi', 'a', 'ha', 'ne', 'roi', 'ma', 'hen', 'di_']);
function trimTail(toks) {
  const t = toks.slice();
  while (t.length > 1 && TAIL_PART.has(t[t.length - 1].w)) t.pop();
  return t;
}

// ---------------------------------------------------------------- chấm điểm
function findAlt(toks, key) {
  const anchoredS = key[0] === '^', anchoredE = key[key.length - 1] === '$';
  const words = key.replace(/[\^$]/g, '').split(' ');
  const n = words.length;
  for (let i = 0; i + n <= toks.length; i++) {
    if (anchoredS && i !== 0) break;
    if (anchoredE && i + n !== toks.length) continue;
    let ok = true;
    for (let j = 0; j < n; j++) if (toks[i + j].w !== words[j]) { ok = false; break; }
    if (ok) { let fz = false; for (let j = 0; j < n; j++) if (toks[i + j].fz) fz = true; return { s: toks[i].i, e: toks[i + n - 1].i, fz }; }
  }
  return null;
}
function scoreRule(rule, variants) {
  let best = null;
  for (const toks of variants) {
    for (const key of Object.keys(rule.alts)) {
      const w = rule.alts[key];
      if (best && Math.abs(w) <= Math.abs(best.w)) continue;
      const m = findAlt(toks, key);
      if (m) best = { w: m.fz && w > 0 ? w * 0.88 : w, s: m.s, e: m.e };
    }
  }
  return best;
}
/** -> [{it, score, span}] sắp giảm dần theo điểm. */
function scoreAll(toks) {
  // "thùng rác" gộp thành một từ để 'rac' đứng riêng không gây nhầm
  const merged = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].w === 'thung' && toks[i + 1] && toks[i + 1].w === 'rac') { merged.push({ w: 'thungrac', i: toks[i].i, fz: false }); i++; } else merged.push(toks[i]);
  }
  const strip = merged.filter(t => !FILL.has(t.w));
  const variants = [merged, strip];
  const res = [];
  for (const it of INTENTS) {
    let score = 0, span = null, ok = true;
    it.rules.forEach((r, idx) => {
      const m = scoreRule(r, variants);
      if (m) { score += m.w; if (idx === 0) span = [m.s, m.e]; } else if (r.req) ok = false;
    });
    if (ok && score > 0 && span) res.push({ it, score, span });
  }
  return res.sort((a, b) => b.score - a.score);
}

const RUN = 2.6, ASK = 1.6;
const DESTRUCTIVE = new Set(['trashThis', 'cleanDone', 'cleanEmpty', 'cleanExpired', 'dailyOff', 'hideAll']);
const hasNeg = toks => {
  if (toks.some(t => t.w === 'DUNGNEG')) return true;
  const ws = toks.map(t => t.w);
  if (ws.some((w, i) => i < ws.length - 1 && w === 'khong' && ['can', 'nen', 'duoc', 'muon', 'phai', 'cho'].indexOf(ws[i + 1]) >= 0)) return true;
  if (ws.some(w => w === 'khoi' || w === 'chua' || w === 'chang' || w === 'dau' || w === 'khoan')) return true;
  // "không" ở giữa câu ("không dọn nữa") là phủ định; ở cuối câu là từ hỏi ("dọn dẹp không?")
  const k = ws.indexOf('khong');
  return k >= 0 && k < ws.length - 1 && ws.slice(k + 1).some(w => w !== 'nua' && w !== 'a' && w !== 'nhe' && w !== 'nha');
};

function focusMinutes(toks) {
  const ws = toks.map(t => t.w);
  for (let i = 0; i < ws.length; i++) {
    let m = /^(\d{1,3})(p|phut|min|h|tieng|gio)?$/.exec(ws[i]);
    if (m) {
      const u = m[2] || ws[i + 1];
      const n = +m[1] * (/^(h|tieng|gio)$/.test(u) ? 60 : 1);
      return Math.max(5, Math.min(120, n));
    }
    if ((ws[i] === 'nua') && /^(tieng|gio)$/.test(ws[i + 1] || '')) return 30;
    if (/^(mot|1)$/.test(ws[i]) && /^(tieng|gio)$/.test(ws[i + 1] || '')) return 60;
  }
  return 25;
}

// ---------------------------------------------------------------- lệnh có tham số (đọc từ chuỗi gốc)
const CALL_RE = /^\s*(?:@\s*)?(?:(?:hey|alo|ê|này)\s+)?(?:bé\s*mochi|mochi|bé|em|cưng|be|e)\s*(?:ơi|ới|ời|oi|ởi|à|ạ)\s*[,:;!.\-–]*\s*|^\s*@\s*(?:mochi|bé|be)\s*[,:;!.\-–]*\s*/i;
function stripCall(raw) { return String(raw || '').replace(CALL_RE, ''); }
function newNoteOf(orig) {
  const fo = foldSame(orig.normalize('NFC'));
  let m = /^\s*(?:(?:tao|viet|ghi|them|lap|new)\s+(?:cho\s+(?:to|minh|tui|em)\s+)?(?:(?:1|mot)\s+)?(?:cai\s+)?(?:note|ghi chu|to giay|giay|memo)(?![a-z0-9])(?:\s+moi)?|(?:note|ghi chu)\s+moi)[\s:,\-–]*/.exec(fo);
  if (m) return { kind: 'newNote', text: orig.normalize('NFC').slice(m[0].length).trim() };
  m = /^\s*(?:ghi|viet|note|luu)\s+(?:lai|giup|nhanh)?[\s:,\-–]+(.+)$/.exec(fo);
  if (m && /^\s*(?:ghi|viet) lai/.test(fo)) return { kind: 'newNote', text: orig.normalize('NFC').slice(fo.length - m[1].length).trim() };
  return null;
}
/** "đừng nhắc tớ lúc 3h", "không cần nhắc 5h" -> negated; "huỷ/bỏ/xoá nhắc 5h" -> cancelRemind (bé chỉ hướng dẫn, không tự xoá gì). */
function remindGuard(orig) {
  const toks = tokenize(orig), k = toks.findIndex(t => t.w === 'nhac');
  if (k < 0) return null;
  const before = toks.slice(0, k), prev = before[before.length - 1];
  if (prev && /^(huy|bo|xoa|tat|ngung|dung)$/.test(prev.w)) return { kind: 'cancelRemind' };
  if (before.length && hasNeg(before.concat(toks[k]))) return { kind: 'negated' };
  return null;
}
function remindOf(orig, now) {
  if (!P || !P.parseWhen) return null;
  const nfc = orig.normalize('NFC'), fo = foldSame(nfc);
  const trig = /(?<![a-z0-9])(?:nhac(?:\s+nho)?|bao thuc|dat bao thuc|hen gio|dat hen|dat gio|bao)(?:\s+(?:cho\s+)?(?:to|minh|tui|em|anh|chi|toi|ban|nhe|nha|giup))*(?![a-z0-9])/.exec(fo);
  if (!trig) return null;
  if (/^bao\s+cao(?![a-z0-9])/.test(fo.slice(trig.index))) return null;
  if (/(?:^|\s)bao\s+(?:cao|thuc|nhe|nha)/.test(trig[0]) && trig[0].trim() === 'bao' && /^\s*cao/.test(fo.slice(trig.index + trig[0].length))) return null;
  let rest = (nfc.slice(0, trig.index) + ' ' + nfc.slice(trig.index + trig[0].length)).replace(/^[\s:,\-–]+|[\s:,\-–]+$/g, '').replace(/\s{2,}/g, ' ');
  rest = rest.replace(/^(?:là|về|rằng)\s+/i, '');
  let w = null;
  try { w = P.parseWhen(rest, new Date(now || Date.now())); } catch (_) { w = null; }
  if (!w) return null;
  return { kind: 'remind', text: rest };
}

// ---------------------------------------------------------------- phân tích một mệnh đề
// câu hỏi / giả định / nghi vấn: đầu câu (tại sao, nếu, ai bảo…) hoặc đuôi câu (không, hả, nhỉ, thì sao, làm gì…); qMark = có dấu "?" ngay sau mệnh đề
function questionish(rawToks, qMark) {
  const ws = rawToks.map(t => t.w).filter(w => w !== 'DUNGNEG'), n = ws.length;
  if (!n) return false;
  const at = (i, ...p) => p.every((x, j) => ws[i + j] === x);
  if (at(0, 'tai', 'sao') || at(0, 'vi', 'sao') || at(0, 'sao', 'lai') || at(0, 'gia', 'su') || at(0, 'ai', 'bao') || at(0, 'ai', 'cho') || ws[0] === 'neu') return true;
  if (qMark) return true;
  const last = ws[n - 1];
  if (n > 1 && ['khong', 'ha', 'nhi', 'chu', 'sao'].indexOf(last) >= 0) return true;
  if (n > 2 && (at(n - 2, 'thi', 'sao') || at(n - 2, 'la', 'sao') || at(n - 2, 'lam', 'gi') || at(n - 2, 'duoc', 'khong'))) return true;
  return false;
}
// "hủy/huỷ xoá note này" = thôi, không xoá
function cancelsDestroy(ws) {
  const i = ws.indexOf('huy');
  return i >= 0 && /^(xoa|vut|don|dep|nem|bo)$/.test(ws[i + 1] || '');
}
function classify(clause, now, qMark) {
  const rawToks = tokenize(clause);
  const toks = trimTail(rawToks);
  if (!toks.length) return { kind: 'unknown' };
  if (toks.some(t => t.w === 'giup') && toks.every(t => FILL.has(t.w) || t.w === 'do')) return { kind: 'help' };
  const neg = hasNeg(toks);
  const scored = scoreAll(toks);
  if (!scored.length) return neg ? { kind: 'negated' } : { kind: 'unknown', _scored: scored };
  if (neg) return { kind: 'negated' };
  // câu hỏi "có xoá note này không", "nên dọn dẹp không": việc phá huỷ thì hỏi lại bằng nút, không tự chạy
  const ws = toks.map(t => t.w);
  const dest = scored.find(x => x.score >= ASK && DESTRUCTIVE.has(x.it.cmd.kind));
  if (dest) {
    if (cancelsDestroy(ws)) return { kind: 'negated' };
    if (questionish(rawToks, qMark)) { const c0 = build(dest.it, toks); return { kind: 'unclear', options: [{ label: label(c0), cmd: c0 }] }; }
  }
  const asking = ws[ws.length - 1] === 'khong' && ws.some(w => w === 'co' || w === 'nen' || w === 'can');
  if (asking && scored.length && DESTRUCTIVE.has(scored[0].it.cmd.kind) && scored[0].score >= ASK) {
    const c0 = build(scored[0].it, toks);
    return { kind: 'unclear', options: [{ label: label(c0), cmd: c0 }] };
  }
  // chọn tham lam: lệnh điểm cao nhất, rồi các lệnh chắc chắn khác không chung từ chính
  const chosen = [];
  const used = [];
  const overlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];
  for (const s of scored) {
    if (s.score < RUN) break;
    if (used.some(u => overlap(u, s.span))) continue;
    if (chosen.some(c => c.it.cmd.kind === s.it.cmd.kind && c.it.id === s.it.id)) continue;
    chosen.push(s); used.push(s.span);
  }
  if (chosen.length >= 2) {
    chosen.sort((a, b) => a.span[0] - b.span[0]);
    return { kind: 'multi', cmds: chosen.map(c => build(c.it, toks)) };
  }
  const top = scored[0], second = scored[1];
  if (top.score >= RUN && !(second && second.score >= RUN - 0.4 && top.score - second.score < 0.45)) return build(top.it, toks);
  if (top.score >= ASK) {
    const opts = scored.filter(s => s.score >= ASK && top.score - s.score < 1.2).slice(0, 3).map(s => build(s.it, toks));
    const uniq = []; for (const o of opts) if (!uniq.some(u => label(u) === label(o))) uniq.push(o);
    return { kind: 'unclear', options: uniq.map(c => ({ label: label(c), cmd: c })) };
  }
  return { kind: 'unknown', _scored: scored };
}
function build(it, toks) {
  const c = Object.assign({}, it.cmd);
  if (c.kind === 'focus') c.min = focusMinutes(toks);
  return c;
}

const DEFAULT_HINTS = ['dọn dẹp', 'xếp note lại', 'xoá note này'];
function hintsOf(scored) {
  const out = [];
  for (const s of (scored || []).slice(0, 3)) { const l = label(s.it.cmd); if (l && out.indexOf(l) < 0) out.push(l.toLowerCase()); }
  for (const d of DEFAULT_HINTS) if (out.length < 3 && out.indexOf(d) < 0) out.push(d);
  return out.slice(0, 3);
}

// tách câu gộp: dấu câu / "rồi", "và", "xong rồi", "sau đó"
const SEP_RE = /(?:[,;.!?\n]+|(?<![\p{L}\p{N}])(?:rồi|rùi|roi|và|va|sau đó|sau do|tiếp theo|tiep theo|xong rồi|xong roi|then)(?![\p{L}\p{N}]))/giu;
function parse(raw, now) {
  const orig0 = String(raw || '').trim();
  if (!orig0) return { kind: 'unknown', hints: DEFAULT_HINTS.slice() };
  const orig = stripCall(orig0).trim() || orig0;
  // 1) lệnh có nội dung đi kèm: tạo note / nhắc
  const nn = newNoteOf(orig);
  if (nn) return nn;
  const rg = remindGuard(orig);
  if (rg) return rg;
  const rm = remindOf(orig, now);
  if (rm) return rm;
  // 2) mệnh đề đơn / nhiều mệnh đề
  const parts = [], qs = [];
  {
    const re = new RegExp(SEP_RE.source, SEP_RE.flags);
    const add = (txt, sep) => { const t = txt.trim(); if (tokenize(t).length) { parts.push(t); qs.push(sep.indexOf('?') >= 0); } };
    let last = 0, m;
    while ((m = re.exec(orig))) { add(orig.slice(last, m.index), m[0]); last = m.index + m[0].length; if (!m[0]) re.lastIndex++; }
    add(orig.slice(last), '');
  }
  const clauses = parts.length ? parts : [orig];
  const results = clauses.map((c, i) => classify(c, now, !!qs[i]));
  const cmds = [];
  let unclear = null, negated = false, firstScored = null;
  const push = c => { const last = cmds[cmds.length - 1]; if (!last || label(last) !== label(c)) cmds.push(c); };
  for (const r of results) {
    if (r.kind === 'multi') r.cmds.forEach(push);
    else if (r.kind === 'unclear') { if (!unclear) unclear = r; }
    else if (r.kind === 'negated') negated = true;
    else if (r.kind === 'unknown') { if (!firstScored && r._scored) firstScored = r._scored; }
    else push(r);
  }
  if (cmds.length === 1 && !unclear) return cmds[0];
  if (cmds.length >= 2) return { kind: 'multi', cmds };
  if (unclear) return { kind: 'unclear', options: unclear.options };
  if (negated) return { kind: 'negated' };
  return { kind: 'unknown', hints: hintsOf(firstScored || scoreAll(trimTail(tokenize(orig)))) };
}

const HELP = 'Gõ trong note “bé ơi, …” rồi dừng tay là tớ làm nè (nói tự nhiên cũng hiểu, gõ không dấu cũng được):\n' +
  '• Dọn: “dọn dẹp”, “dọn note trống”, “dọn note hết hạn”, “xoá note này”\n' +
  '• Xếp: “xếp note lại”, “ẩn hết note”, “hiện hết note”, “mở thùng rác”, “danh sách”\n' +
  '• Việc: “tạo note mua sữa”, “nhắc tớ uống nước lúc 15h”, “gõ cửa nhắc việc”\n' +
  '• Tập trung: “tập trung 25 phút”, “dừng tập trung”, “lặp hằng ngày”, “tổng kết hôm nay”, “sao lưu”\n' +
  '• Chơi: múa, hát, tập thể dục, đi ngủ, thức dậy, mở tủ đồ, quay gacha, đọc sách, uống trà, quét nhà, nghe nhạc…\n' +
  '• Nói 2 việc một lúc cũng được: “dọn dẹp rồi xếp note lại”.\n' +
  'Không mở note cũng được: bấm Ctrl+Alt+B để gõ lệnh cho tớ.';

module.exports = { parse, plain, label, HELP, stripCall, INTENTS };
