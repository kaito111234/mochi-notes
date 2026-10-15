// Kết xuất SVG → PNG bằng Electron offscreen (Chromium). Dùng cho xem thử nhanh và cho build.
// Cách chạy:
//   xvfb-run -a ./node_modules/.bin/electron tools/rig/svg2png.js --no-sandbox --disable-gpu -- <jobs.json>
//   jobs.json: [{ "svg": "<chuỗi svg hoặc đường dẫn .svg>", "out": "x.png", "w":400, "h":400 }, ...]
// Hoặc nhanh: ... svg2png.js -- --out x.png --w 400 --h 400 a.svg b.svg c.svg  (các SVG cùng viewBox, xếp chồng theo thứ tự)
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
app.disableHardwareAcceleration();
const argv = process.argv.slice(process.argv.indexOf('--') + 1).filter(a => a !== '--no-sandbox' && a !== '--disable-gpu');

function readSvg(s) { return s.trim().startsWith('<') ? s : fs.readFileSync(s, 'utf8'); }
function inner(svg) { // lấy nội dung bên trong thẻ <svg>
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/); return m ? m[1] : svg;
}
function parseJobs() {
  if (argv[0] && argv[0].endsWith('.json')) return JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  let out = 'out.png', w = 400, h = 400, scale = 1; const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i]; else if (argv[i] === '--w') w = +argv[++i];
    else if (argv[i] === '--h') h = +argv[++i]; else if (argv[i] === '--scale') scale = +argv[++i]; else files.push(argv[i]);
  }
  const body = files.map(f => `<g data-src="${path.basename(f)}">${inner(readSvg(f))}</g>`).join('\n');
  return [{ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}">${body}</svg>`, out, w: w * scale, h: h * scale }];
}

app.whenReady().then(async () => {
  const jobs = parseJobs();
  const maxW = Math.max(...jobs.map(j => j.w || 400)), maxH = Math.max(...jobs.map(j => j.h || 400));
  const win = new BrowserWindow({ show: false, width: maxW, height: maxH, useContentSize: true, transparent: true, frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  win.webContents.setFrameRate(1);
  await win.loadURL('data:text/html,' + encodeURIComponent('<html><body style="margin:0;background:transparent;overflow:hidden"><canvas id=c></canvas></body></html>'));
  for (const j of jobs) {
    const w = j.w || 400, h = j.h || 400;
    const svg = readSvg(j.svg);
    const dataUrl = await win.webContents.executeJavaScript(`(async () => {
      const svg = ${JSON.stringify(svg)};
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const c = document.getElementById('c'); c.width = ${w}; c.height = ${h};
      const g = c.getContext('2d'); g.clearRect(0,0,${w},${h}); g.drawImage(img, 0, 0, ${w}, ${h});
      return c.toDataURL('image/png');
    })()`);
    fs.mkdirSync(path.dirname(path.resolve(j.out)), { recursive: true });
    fs.writeFileSync(j.out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log('svg2png: ' + jobs.length + ' ảnh');
  app.exit(0);
}).catch(e => { console.error(e); app.exit(1); });
