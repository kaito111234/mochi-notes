'use strict';
// Thùng rác dễ thương. Main gọi window.bump() khi giấy rơi vào.
(function () {
  var t = null;
  window.bump = function () {
    var b = document.body;
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
    if (t) clearTimeout(t);
    t = setTimeout(function () { b.classList.remove('bump'); }, 700);
  };
})();
