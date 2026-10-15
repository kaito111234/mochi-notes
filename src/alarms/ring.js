'use strict';
// Cửa sổ chuông: hàng đợi RingInfo (từng cái một, hiện "+N"), âm tổng hợp WebAudio hoặc file tuỳ chọn.
(function () {
  const api = window.mochi.alarms;
  const $ = id => document.getElementById(id);
  const queue = [];            // RingInfo + {startedAt, silenced}
  let current = null;          // phần tử đang hiển thị/phát
  let audio = null;            // { stop() }

  /* ------------ âm thanh ------------ */
  let ac = null;
  function actx() {
    if (ac) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; }
    return ac;
  }
  function tone(c, dest, f, t0, vol, dur, type, harm) {
    (harm || [[1, 1], [2, 0.18]]).forEach(([m, k]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * k), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  const PATTERNS = {
    chime: { period: 2.4, play(c, d, t) {
      for (let r = 0; r < 2; r++) { tone(c, d, 1318.5, t + r * 0.7, 0.3, 0.9); tone(c, d, 1046.5, t + r * 0.7 + 0.2, 0.3, 0.9); }
    } },
    bell: { period: 3.2, play(c, d, t) {
      const H = [[1, 1], [2.76, 0.5], [5.4, 0.25]];
      for (let r = 0; r < 3; r++) tone(c, d, 880, t + r * 0.55, 0.3, 1.5, 'sine', H);
    } },
    soft: { period: 3.4, play(c, d, t) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, d, f, t + i * 0.28, 0.26, 1.1, 'sine', [[1, 1], [2, 0.08]]));
    } }
  };
  // Âm lượng tăng nhẹ trong ~20 giây đầu, nhân với volume.
  function rampGain(vol) { return Math.max(0.02, Math.min(1, vol)) * Math.min(1, 0.45 + 0.55 * ((Date.now() - (current ? current.startedAt : Date.now())) / 20000)); }

  function startSynth(kind, volume) {
    const c = actx(); if (!c) return null;
    const pat = PATTERNS[kind] || PATTERNS.chime;
    const master = c.createGain(); master.connect(c.destination);
    let timer = null, dead = false;
    const beat = () => {
      if (dead) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
      master.gain.value = rampGain(volume);
      pat.play(c, master, c.currentTime + 0.03);
      timer = setTimeout(beat, pat.period * 1000);
    };
    beat();
    return { stop() { dead = true; clearTimeout(timer); try { master.disconnect(); } catch (_) { /* bỏ qua */ } } };
  }
  async function startCustom(item) {
    try {
      const d = await api.soundData(item.soundFile);
      if (!d || !d.base64) return null;
      const bin = atob(d.base64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u], { type: d.mime }));
      const el = new Audio(url); el.loop = true; el.volume = Math.max(0, Math.min(1, item.volume));
      await el.play();
      return { stop() { el.pause(); el.removeAttribute('src'); URL.revokeObjectURL(url); } };
    } catch (_) { return null; }
  }
  function stopSound() { if (audio) { audio.stop(); audio = null; } }
  async function playFor(item) {
    stopSound();
    if (item.silenced) return;
    let a = null;
    if (item.sound === 'custom' && item.soundFile) a = await startCustom(item);
    if (!a && (current !== item || item.silenced)) return;
    if (!a) a = startSynth(item.sound === 'custom' ? 'chime' : item.sound, item.volume);
    if (current !== item || item.silenced) { if (a) a.stop(); return; }
    audio = a;
  }

  /* ------------ giao diện ------------ */
  function render() {
    current = queue[0] || null;
    document.body.classList.toggle('ringing', !!current && !current.silenced);
    if (!current) { stopSound(); return; }
    $('time').textContent = current.time;
    $('label').textContent = current.label || 'Đã tới giờ';
    $('label').title = current.noteTitle ? 'Ghi chú: ' + current.noteTitle : '';
    $('kind').textContent = current.test ? 'Báo thức (chạy thử)' : 'Báo thức';
    $('stop').textContent = current.test ? 'Dừng thử' : 'Tắt';
    const sn = $('snooze');
    sn.hidden = !!current.test;
    sn.textContent = 'Hoãn ' + current.snoozeMin + ' phút';
    $('line').textContent = current.line || '';
    $('line').hidden = !current.line;
    $('status').hidden = !current.silenced;
    const more = $('more');
    more.hidden = queue.length < 2;
    more.textContent = '+' + (queue.length - 1) + ' báo thức khác';
    playFor(current);
  }
  function add(info) {
    const item = Object.assign({}, info, { startedAt: Date.now(), silenced: false });
    const k = queue.findIndex(q => q.alarmId === info.alarmId);
    if (k >= 0) {
      if (queue[k] === current) stopSound();
      queue[k] = item;
    } else queue.push(item);
    render();
  }
  function remove(id) {
    const k = queue.findIndex(q => q.alarmId === id);
    if (k < 0) return;
    queue.splice(k, 1);
    render();
  }

  $('stop').addEventListener('click', () => { if (current) api.stop(current.alarmId); });
  $('snooze').addEventListener('click', () => { if (current) api.snooze(current.alarmId, current.snoozeMin); });
  document.addEventListener('keydown', e => {
    if (!current) return;
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); api.stop(current.alarmId); }
  });

  // tự im sau ringMaxMin phút (cửa sổ vẫn còn)
  setInterval(() => {
    if (!current || current.silenced || current.test) return;
    if (Date.now() - current.startedAt >= current.ringMaxMin * 60000) {
      current.silenced = true; stopSound(); render();
    }
  }, 1000);

  api.onRing(add);
  api.onRingEnd(m => remove(m && m.alarmId));
  api.ringReady();
})();
