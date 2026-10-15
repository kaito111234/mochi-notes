'use strict';
// Ra lệnh cho bé Mochi ngay trong note: gõ một dòng "bé ơi, dọn dẹp" / "Mochi ơi xoá note này" / "@mochi hát"...
// Dừng gõ ~1,5 giây (hoặc Enter xuống dòng) thì dòng lệnh được cắt khỏi note và gửi cho bé (main: src/main/antics/commands.js).
(function () {
  var N = window.MochiNote, M = window.mochi;
  if (!N || !N.editor || !M || !M.antics || !M.antics.command) return;
  var ed = N.editor;
  // dễ tính: chấp nhận dấu đầu dòng/checklist ("- [ ] bé ơi…"), gõ sai dấu ("bé ói", "be oi", "bê ơi"), các cách gọi:
  //   "bé ơi" / "mochi ơi" / "bé mochi ơi" (có thể thêm "ê", "hey"...), "@bé" / "@mochi" (không cần "ơi"), "mochi," / "mochi:".
  //   Không bắt "em ơi", "bé,", "bé:" vì hay là câu thường ("Bé: tiêm phòng 9h"). Chỉ bắt khi lời gọi nằm ĐẦU dòng.
  var OI = '[oóòỏõọôốồổỗộơớờởỡợ]\\s*[iíìỉĩị]';
  var BE = 'b[eéèẻẽẹêếềểễệ]';
  var NAME = '(?:' + BE + '\\s*mochi|mochi|' + BE + ')';
  var CMD = new RegExp('^\\s*(?:[-*•+]\\s*)?(?:\\[\\s*[xX✓]?\\s*\\]\\s*)?(?:(?:ê|này|nè|hey|alo)\\s+)?(?:@\\s*(?:mochi|' + BE + ')|' + NAME + '\\s*' + OI + '|mochi\\s*[,:;])(?![a-zà-ỹ])[\\s,:;!.\\-–]*(.*)$', 'i');
  window.MochiCmdRe = CMD;   // để tools/test-nlu.js kiểm tra
  var timer = 0;

  // các "dòng" của editor: phần tử khối, hoặc đoạn chữ trần (kèm <br> sau nó)
  function lines() {
    var out = [];
    Array.prototype.forEach.call(ed.childNodes, function (n) {
      if (n.nodeType === 3) { if (n.textContent.trim()) out.push({ nodes: [n], text: n.textContent }); }
      else if (n.nodeType === 1 && n.tagName !== 'BR') out.push({ nodes: [n], text: n.innerText || n.textContent || '' });
    });
    return out;
  }
  function caretIn(nodes) {
    var s = window.getSelection();
    if (!s || !s.rangeCount) return false;
    var c = s.getRangeAt(0).startContainer;
    return nodes.some(function (n) { return n === c || n.contains(c); });
  }
  function scan(force) {
    if (N.isLocked && N.isLocked()) return;
    var found = null;
    lines().some(function (l) {
      var m = CMD.exec(l.text.replace(/ /g, ' ').trim());
      if (!m || !m[1].trim()) return false;
      if (!force && caretIn(l.nodes) && document.activeElement === ed) return false;   // còn đang gõ dòng này (trừ khi đã ngừng gõ)
      found = { l: l, cmd: m[1].trim() };
      return true;
    });
    if (!found) return;
    var nodes = found.l.nodes;
    nodes.forEach(function (n) {
      var nx = n.nextSibling;
      if (n.nodeType === 3 && nx && nx.nodeType === 1 && nx.tagName === 'BR') nx.remove();
      n.remove();
    });
    try { N.afterEdit(); N.histCommit(); } catch (_) { /* bỏ qua */ }
    try { N.toast('🐾 Đã nhờ bé: ' + found.cmd, 2200); } catch (_) { /* bỏ qua */ }
    try { M.antics.command(N.id, found.cmd); } catch (_) { /* bỏ qua */ }
  }
  ed.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { scan(true); }, 1500); });
  ed.addEventListener('keyup', function (e) { if (e.key === 'Enter') { clearTimeout(timer); setTimeout(function () { scan(false); }, 50); } });
  ed.addEventListener('blur', function () { clearTimeout(timer); scan(true); });
})();
