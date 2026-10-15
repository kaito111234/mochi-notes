'use strict';
// Mã hoá WebM VP9 từ dãy PNG bằng WebCodecs (Chromium trong electron) + webm-muxer. Chạy bởi tools/record-demo.js:
//   electron tools/record-demo-enc.js <list.json>      list.json: { files:[png...], out, kbps, fps, w, h, nm }
// Mỗi khung gắn dấu thời gian cố định i/fps nên video đều đúng 30fps, thời lượng ghi chuẩn trong tệp.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const listFile = process.argv[process.argv.length - 1];
const cfg = JSON.parse(fs.readFileSync(listFile, 'utf8'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

const html = `<!doctype html><meta charset=utf-8><script>
const { ipcRenderer } = require('electron');
const fs = require('fs');
const cfg = ${JSON.stringify(cfg)};
(async () => {
  try {
    const { Muxer, ArrayBufferTarget } = require(cfg.nm + '/webm-muxer');
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: 'V_VP9', width: cfg.w, height: cfg.h, frameRate: cfg.fps }, firstTimestampBehavior: 'offset' });
    let err = null;
    const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
    const conf = { codec: 'vp09.00.40.08', width: cfg.w, height: cfg.h, bitrate: cfg.kbps * 1000, framerate: cfg.fps, latencyMode: 'quality', bitrateMode: 'variable' };
    const sup = await VideoEncoder.isConfigSupported(conf);
    if (!sup.supported) throw new Error('VP9 không được hỗ trợ');
    enc.configure(conf);
    const dur = Math.round(1e6 / cfg.fps);
    for (let i = 0; i < cfg.files.length; i++) {
      const bmp = await createImageBitmap(new Blob([fs.readFileSync(cfg.files[i])], { type: 'image/png' }));
      const vf = new VideoFrame(bmp, { timestamp: Math.round(i * 1e6 / cfg.fps), duration: dur });
      enc.encode(vf, { keyFrame: i % 90 === 0 });
      vf.close(); bmp.close();
      while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
      if (err) throw err;
    }
    await enc.flush(); if (err) throw err;
    muxer.finalize();
    fs.writeFileSync(cfg.out, Buffer.from(target.buffer));
    ipcRenderer.send('done', 'ok');
  } catch (e) { ipcRenderer.send('done', 'ERR ' + (e && e.stack || e)); }
})();
</script>`;

app.whenReady().then(() => {
  const htmlFile = path.join(path.dirname(listFile), 'enc.html');
  fs.writeFileSync(htmlFile, html);
  const win = new BrowserWindow({ show: false, width: 200, height: 200, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
  ipcMain.on('done', (_e, msg) => { console.log(msg === 'ok' ? 'ENC_OK' : msg); app.exit(msg === 'ok' ? 0 : 1); });
  win.loadFile(htmlFile);
  setTimeout(() => { console.log('ENC_TIMEOUT'); app.exit(2); }, 540000);
});
