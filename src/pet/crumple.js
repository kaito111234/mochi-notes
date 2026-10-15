'use strict';
// Tờ giấy bị bé mang/vo/ném. Main gọi qua executeJavaScript: setPaper(url), carry(), crumple(), fly().
(function () {
  var img = document.getElementById('img');
  var b = document.body;
  window.setPaper = function (url) {
    if (typeof url === 'string' && url.indexOf('data:image/') === 0) img.src = url; else img.removeAttribute('src');
    b.className = '';
  };
  window.carry = function () { b.className = 'carry'; };
  window.crumple = function () { b.className = 'ball'; };
  window.fly = function () { b.className = 'ball fly'; };
})();
