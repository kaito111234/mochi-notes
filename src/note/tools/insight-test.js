(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var shape = q.get('shape') || 'sug';
  var color = q.get('color'); if (color) document.body.dataset.color = color;
  var text = q.get('text') || 'họp 9h, 14h gọi khách';
  var cbs = {};
  if (!window.MochiNote) {
    var ed = document.getElementById('editor'); ed.textContent = text;
    window.__fire = function (e, v) { (cbs[e] || []).forEach(function (f) { f(v); }); };
    window.MochiNote = {
      id: 'n1', editor: ed, note: function () { return { text: ed.textContent }; },
      isLocked: function () { return q.get('locked') === '1'; },
      on: function (e, f) { (cbs[e] = cbs[e] || []).push(f); },
      toast: function (t) { window.__toast = t; }
    };
    window.__applied = [];
    window.mochi = shape === 'none' ? {} : { alarms: {
      insight: function () {
        if (shape === 'phone') return Promise.resolve({ suggestions: [{ id: 'c', kind: 'call', label: 'Gọi 0901 234 567' }] });
        if (shape === 'actions') return Promise.resolve({ insight: { items: [{ due: 1 }, { due: 2 }], actions: [{ id: 'a', type: 'reminder', title: 'Tạo nhắc 9h' }, { id: 'b', type: 'reminder', title: 'Tạo nhắc 14h' }] } });
        return Promise.resolve({ items: [{ due: 1 }, { due: 2 }], suggestions: [{ id: 'a', kind: 'remind', label: 'Tạo nhắc 9h' }, { id: 'b', kind: 'remind', label: 'Tạo nhắc 14h' }] });
      },
      applySuggestion: function (n, s) { window.__applied.push(s); return Promise.resolve(true); }
    } };
    return;
  }
  window.__fire('ready'); window.__fire('note');
})();
