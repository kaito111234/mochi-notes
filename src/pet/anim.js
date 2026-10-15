/* Mochi Notes — engine hình động của bé (renderer).
 * Script thường (IIFE) gắn window.MochiAnim = { Animator, resolve }.
 * Không eval, không inline; hẹn giờ setTimeout theo ms từng khung (không rAF liên tục).
 * resolve() là hàm thuần, test được bằng Node (module.exports = { resolve }). */
(function () {
  'use strict';

  var MOOD_ORDER = ['normal', 'happy', 'tired', 'sad'];

  // Một "ô" (action+mood) có ít nhất một khung ở bất kỳ phase nào?
  function hasFrames(m) {
    if (!m) return false;
    var k = ['single', 'start', 'loop', 'end'];
    for (var i = 0; i < k.length; i++) if (m[k[i]] && m[k[i]].length) return true;
    return false;
  }

  // Chọn mood trong một action: mood yêu cầu → normal → mood bất kỳ có khung.
  function pickMood(byMood, mood) {
    if (!byMood) return null;
    if (mood && hasFrames(byMood[mood])) return mood;
    if (hasFrames(byMood.normal)) return 'normal';
    var ks = Object.keys(byMood);
    for (var i = 0; i < ks.length; i++) if (hasFrames(byMood[ks[i]])) return ks[i];
    return null;
  }

  /** Fallback theo docs/spec/03-animation.md. */
  function resolve(pack, action, mood) {
    var anims = (pack && pack.anims) || {};
    var useAction = action;
    var m = pickMood(anims[action], mood);
    if (m === null && action !== 'idle') { useAction = 'idle'; m = pickMood(anims.idle, mood); }
    if (m === null) {
      // Không có khung nào cả (kể cả idle).
      return { action: 'idle', mood: mood || 'normal', start: null, loop: null, end: null, single: null, fallback: true };
    }
    var e = anims[useAction][m];
    var start = e.start && e.start.length ? e.start : null;
    var end = e.end && e.end.length ? e.end : null;
    var single = e.single && e.single.length ? e.single : null;
    var loop = e.loop && e.loop.length ? e.loop : null;
    // single mà không có loop → coi như loop chạy 1 lượt.
    if (!loop && single) loop = single;
    return {
      action: useAction, mood: m, start: start, loop: loop, end: end, single: single,
      fallback: useAction !== action || m !== mood
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { resolve: resolve };
  if (typeof window === 'undefined') return; // chạy trong Node: chỉ cần resolve

  var MAX_PARALLEL = 8;
  var MIN_MS = 16;

  function encodeSrc(s) { return String(s).split('/').map(encodeURIComponent).join('/'); }

  function Animator(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onEnd = opts.onEnd || null;
    this.onMissing = opts.onMissing || null;
    this.pack = null;
    this.baseUrl = '';
    this.cache = new Map();      // src -> ImageBitmap | HTMLImageElement | null (lỗi)
    this.faces = {};             // tên -> ảnh
    this.scale = 1;
    this.flipped = false;
    this.token = null;
    this._opts = null;           // tuỳ chọn của lượt play đang chạy
    this._run = null;            // trạng thái chạy
    this._timer = 0;
    this._missingSeen = {};
    this._layout = null;         // mô tả lần vẽ gần nhất (cho alphaAt)
    this._probe = null;
    this._destroyed = false;
    this.current = { action: null, mood: null, phase: null, frame: -1 };
  }

  // ---------- nạp ảnh ----------
  Animator.prototype._loadOne = function (url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (b) { return createImageBitmap(b); }).catch(function () {
      // fetch bị CSP/giao thức chặn → thử thẻ Image
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { res(im); }); };
        im.onerror = function () { rej(new Error('lỗi ảnh')); };
        im.src = url;
      });
    });
  };

  Animator.prototype.load = function (pack, baseUrl) {
    var self = this;
    this.stopTimer();
    this._run = null; this._opts = null;
    this.pack = pack || {};
    this.baseUrl = baseUrl || '';
    if (this.baseUrl && this.baseUrl.slice(-1) !== '/') this.baseUrl += '/';
    this.faces = {};
    this._missingSeen = {};
    this.setScale(this.pack.scale || 1, true);

    var srcs = [], seen = {};
    var anims = this.pack.anims || {};
    Object.keys(anims).forEach(function (a) {
      Object.keys(anims[a] || {}).forEach(function (m) {
        ['single', 'start', 'loop', 'end'].forEach(function (p) {
          ((anims[a][m] || {})[p] || []).forEach(function (f) {
            if (f && f.src && !seen[f.src]) { seen[f.src] = 1; srcs.push(f.src); }
          });
        });
      });
    });
    var faceMap = this.pack.faces || {};
    var faceNames = Object.keys(faceMap);
    faceNames.forEach(function (n) { if (!seen[faceMap[n]]) { seen[faceMap[n]] = 1; srcs.push(faceMap[n]); } });

    var missing = [];
    var idx = 0;
    function worker() {
      if (idx >= srcs.length) return Promise.resolve();
      var src = srcs[idx++];
      if (self.cache.has(src) && self.cache.get(src)) return worker();
      return self._loadOne(self.baseUrl + encodeSrc(src)).then(function (img) {
        self.cache.set(src, img);
      }, function () {
        self.cache.set(src, null); missing.push(src);
      }).then(worker);
    }
    var workers = [];
    for (var i = 0; i < Math.min(MAX_PARALLEL, srcs.length); i++) workers.push(worker());
    return Promise.all(workers).then(function () {
      faceNames.forEach(function (n) { var im = self.cache.get(faceMap[n]); if (im) self.faces[n] = im; });
      if (missing.length && self.onMissing) { try { self.onMissing('Thiếu ' + missing.length + ' ảnh: ' + missing.slice(0, 5).join(', ')); } catch (e) {} }
      self._drawIdleFallbackIfEmpty();
      return { ok: missing.length === 0, missing: missing };
    });
  };

  // ---------- canvas ----------
  Animator.prototype.setScale = function (scale, noRedraw) {
    this.scale = scale > 0 ? scale : 1;
    var size = (this.pack && this.pack.size) || [400, 400];
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(size[0] * this.scale * dpr));
    this.canvas.height = Math.max(1, Math.round(size[1] * this.scale * dpr));
    this.canvas.style.width = (size[0] * this.scale) + 'px';
    this.canvas.style.height = (size[1] * this.scale) + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    if (!noRedraw) this._redraw();
  };

  Animator.prototype._redraw = function () {
    if (this._lastDraw) this._lastDraw();
  };

  // Vẽ một ảnh vào hình chữ nhật (px canvas); ghi layout cho alphaAt.
  Animator.prototype._paint = function (img, dx, dy, dw, dh) {
    var c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    if (this.flipped) { c.translate(W, 0); c.scale(-1, 1); }
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, dx, dy, dw, dh);
    c.setTransform(1, 0, 0, 1, 0, 0);
    this._layout = { kind: 'img', img: img, dx: dx, dy: dy, dw: dw, dh: dh };
  };

  Animator.prototype._drawFrame = function (img) {
    var self = this;
    this._lastDraw = function () { self._paint(img, 0, 0, self.canvas.width, self.canvas.height); };
    this._lastDraw();
  };

  Animator.prototype._pickFace = function (mood) {
    var f = this.faces;
    if (mood && f[mood]) return f[mood];
    if (f.normal) return f.normal;
    var ks = Object.keys(f);
    return ks.length ? f[ks[0]] : null;
  };

  // Không có khung: vẽ face căn đáy giữa, hoặc hình tròn giữ chỗ.
  Animator.prototype._drawPlaceholder = function (mood) {
    var self = this;
    this._lastDraw = function () {
      var W = self.canvas.width, H = self.canvas.height, c = self.ctx;
      var face = self._pickFace(mood);
      if (face) {
        var dpr = window.devicePixelRatio || 1;
        var k = Math.min(W / face.width, H / face.height, self.scale * dpr);
        var dw = face.width * k, dh = face.height * k;
        self._paint(face, (W - dw) / 2, H - dh, dw, dh);
        return;
      }
      var r = Math.min(W, H) * 0.3, cx = W / 2, cy = H - r - Math.min(W, H) * 0.05;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#bfe3ff';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#243447';
      [-0.35, 0.35].forEach(function (s) {
        c.beginPath(); c.arc(cx + r * s, cy - r * 0.1, r * 0.09, 0, Math.PI * 2); c.fill();
      });
      self._layout = { kind: 'circle', cx: cx, cy: cy, r: r };
    };
    this._lastDraw();
  };

  Animator.prototype._drawIdleFallbackIfEmpty = function () {
    if (this._run || this._layout) return;
    var r = resolve(this.pack, 'idle', 'normal');
    var fr = (r.start || r.loop || r.end || [])[0];
    var img = fr && this.cache.get(fr.src);
    if (img) this._drawFrame(img); else this._drawPlaceholder('normal');
  };

  // ---------- lịch khung ----------
  Animator.prototype.stopTimer = function () {
    if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
  };

  Animator.prototype._warnMissing = function (action) {
    if (this._missingSeen[action]) return;
    this._missingSeen[action] = 1;
    if (this.onMissing) { try { this.onMissing('Thiếu hình cho action "' + action + '"'); } catch (e) {} }
  };

  Animator.prototype.play = function (action, o) {
    if (this._destroyed) return;
    o = o || {};
    var mood = o.mood || 'normal';
    var loop = !!o.loop;
    var run = this._run;
    // Ngoại lệ: cùng action+mood đang lặp loop → không khởi động lại, chỉ cập nhật cb.
    if (run && loop && run.looping && run.reqAction === action && run.reqMood === mood && run.phase === 'loop') {
      run.token = o.token; run.cb = o.onEnd || null;
      return;
    }
    this.stopTimer();
    var r = resolve(this.pack, action, mood);
    if (r.action !== action || (!r.start && !r.loop && !r.end)) this._warnMissing(action);
    var seq = [];
    if (r.start) seq.push({ phase: 'start', frames: r.start });
    if (r.loop) seq.push({ phase: 'loop', frames: r.loop });
    if (r.end) seq.push({ phase: 'end', frames: r.end });
    // Mất ảnh (nạp lỗi) → bỏ khung không có bitmap
    var self = this;
    seq = seq.map(function (s) {
      return { phase: s.phase, frames: s.frames.filter(function (f) { return self.cache.get(f.src); }) };
    }).filter(function (s) { return s.frames.length; });

    run = this._run = {
      id: (this._runId = (this._runId || 0) + 1),
      reqAction: action, reqMood: mood, action: r.action, mood: r.mood,
      seq: seq, si: 0, fi: 0, phase: null,
      looping: loop, token: o.token, cb: o.onEnd || null
    };
    this.current = { action: r.action, mood: r.mood, phase: null, frame: -1 };

    if (!seq.length) { // không có khung nào → face/hình giữ chỗ
      this._drawPlaceholder(mood);
      this.current.phase = 'loop';
      if (!loop) this._timer = setTimeout(function () { self._finish(run); }, 400);
      return;
    }
    this._enter(run);
  };

  // Vào phase run.si, vẽ khung đầu và hẹn khung kế.
  Animator.prototype._enter = function (run) {
    var s = run.seq[run.si];
    run.phase = s.phase; run.fi = 0;
    this._show(run);
  };

  Animator.prototype._show = function (run) {
    if (this._run !== run || this._destroyed) return;
    var self = this;
    var s = run.seq[run.si], f = s.frames[run.fi];
    this._drawFrame(this.cache.get(f.src));
    this.current = { action: run.action, mood: run.mood, phase: run.phase, frame: run.fi };
    var n = s.frames.length;
    // Loop 1 khung đang lặp mãi: đứng yên, không cần hẹn giờ.
    if (run.phase === 'loop' && run.looping && n === 1) return;
    this._timer = setTimeout(function () { self._advance(run); }, Math.max(MIN_MS, f.ms || 100));
  };

  Animator.prototype._advance = function (run) {
    this._timer = 0;
    if (this._run !== run) return;
    var s = run.seq[run.si];
    run.fi++;
    if (run.fi < s.frames.length) return this._show(run);
    if (run.phase === 'loop' && run.looping) { run.fi = 0; return this._show(run); }
    // hết phase → phase kế hoặc kết thúc
    run.si++;
    if (run.si < run.seq.length) return this._enter(run);
    this._finish(run);
  };

  Animator.prototype._finish = function (run) {
    if (this._run !== run) return;
    this._timer = 0;
    this._run = null;
    // Giữ khung cuối trên canvas; current.phase = null báo đã dừng.
    this.current = { action: run.action, mood: run.mood, phase: null, frame: this.current.frame };
    var cb = run.cb, token = run.token, action = run.action;
    try { if (this.onEnd) this.onEnd(token, action); } catch (e) { console.error(e); }
    try { if (cb) cb(token, action); } catch (e) { console.error(e); }
  };

  Animator.prototype.stop = function () {
    var run = this._run;
    if (!run) return;
    run.looping = false;
    if (run.phase === 'loop') {
      this.stopTimer();
      var ei = -1;
      for (var i = run.si + 1; i < run.seq.length; i++) if (run.seq[i].phase === 'end') ei = i;
      if (ei >= 0) { run.si = ei; this._enter(run); } else this._finish(run);
    } else if (!run.seq.length) {
      this.stopTimer(); this._finish(run);
    }
    // đang ở start/end: để chạy tiếp tự nhiên (looping=false → loop 1 lượt rồi end)
  };

  // ---------- tiện ích ----------
  Animator.prototype.flip = function (b) {
    b = !!b;
    if (b === this.flipped) return;
    this.flipped = b;
    this._redraw();
  };

  // Alpha (0..255) tại (x,y) px CSS trong canvas, đã tính lật. Dùng canvas 1x1.
  Animator.prototype.alphaAt = function (x, y) {
    var L = this._layout;
    if (!L) return 0;
    var W = this.canvas.width, H = this.canvas.height;
    var cssW = parseFloat(this.canvas.style.width) || W, cssH = parseFloat(this.canvas.style.height) || H;
    var px = x * W / cssW, py = y * H / cssH;
    if (px < 0 || py < 0 || px >= W || py >= H) return 0;
    if (this.flipped) px = W - 1 - px;
    if (L.kind === 'circle') {
      var dx = px - L.cx, dy = py - L.cy;
      return dx * dx + dy * dy <= L.r * L.r ? 255 : 0;
    }
    if (px < L.dx || py < L.dy || px >= L.dx + L.dw || py >= L.dy + L.dh) return 0;
    var iw = L.img.width, ih = L.img.height;
    var sx = Math.min(iw - 1, Math.floor((px - L.dx) / L.dw * iw));
    var sy = Math.min(ih - 1, Math.floor((py - L.dy) / L.dh * ih));
    try {
      if (!this._probe) {
        var pc = document.createElement('canvas'); pc.width = 1; pc.height = 1;
        this._probe = pc.getContext('2d', { willReadFrequently: true });
      }
      var p = this._probe;
      p.clearRect(0, 0, 1, 1);
      p.drawImage(L.img, sx, sy, 1, 1, 0, 0, 1, 1);
      return p.getImageData(0, 0, 1, 1).data[3];
    } catch (e) { return 255; } // canvas bị "tainted": coi như đặc trong hình chữ nhật
  };

  Animator.prototype.destroy = function () {
    this._destroyed = true;
    this.stopTimer();
    this._run = null; this._lastDraw = null; this._layout = null;
    this.cache.forEach(function (im) { try { if (im && im.close) im.close(); } catch (e) {} });
    this.cache.clear(); this.faces = {};
    this.onEnd = null; this.onMissing = null;
  };

  window.MochiAnim = { Animator: Animator, resolve: resolve };
})();
