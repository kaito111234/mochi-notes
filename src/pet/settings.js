'use strict';
(function () {
  const api = window.mochi && window.mochi.pet;
  const BOOLS = ['alwaysVisible', 'walkEnabled', 'climbEnabled', 'followCursor', 'tidyEnabled', 'autoTidy', 'knockEnabled'];
  const DEFAULT_OFF = { autoTidy: true };
  const segBtns = Array.from(document.querySelectorAll('#scale button'));

  function render(s) {
    if (!s) return;
    for (const k of BOOLS) document.getElementById(k).checked = DEFAULT_OFF[k] ? s[k] === true : s[k] !== false;
    const tidyOn = s.tidyEnabled !== false;
    document.getElementById('autoTidy').disabled = !tidyOn;
    document.getElementById('rowAutoTidy').classList.toggle('dim', !tidyOn);
    const sc = typeof s.scale === 'number' ? s.scale : 1;
    let best = null, bd = 9;
    for (const b of segBtns) { const d = Math.abs(parseFloat(b.dataset.v) - sc); if (d < bd) { bd = d; best = b; } }
    for (const b of segBtns) b.classList.toggle('on', b === best);
  }

  async function save(patch) {
    if (!api) return;
    try { render(await api.setSettings(patch)); } catch (e) { /* giữ nguyên giao diện */ }
  }

  for (const k of BOOLS) {
    document.getElementById(k).addEventListener('change', e => save({ [k]: e.target.checked }));
  }
  for (const b of segBtns) b.addEventListener('click', () => save({ scale: parseFloat(b.dataset.v) }));

  if (api) api.getSettings().then(render).catch(() => {});
})();
