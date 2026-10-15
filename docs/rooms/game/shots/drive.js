// Chạy trong xvfb: mở app với cổng CDP, điều khiển cửa sổ Phòng của Mochi, chụp màn hình gốc.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process');
const steps = require(process.argv[2]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = spawn('./node_modules/.bin/electron', ['.', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9333'],
    { cwd: '/home/claude/mochi-notes', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; app.stdout.on('data', d => log += d); app.stderr.on('data', d => log += d);
  await sleep(5000);
  const br = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = () => br.contexts().flatMap(c => c.pages());
  let room = null;
  for (let i = 0; i < 20 && !room; i++) { room = pages().find(p => p.url().includes('game/room.html')); if (!room) await sleep(500); }
  const shot = n => execSync('import -window root ' + (process.env.SHOT_DIR || '/tmp/claude-0/shots') + '/' + n + '.png');
  try { await steps({ room, pages, shot, sleep }); } catch (e) { console.error('STEP ERR', e); }
  require('fs').writeFileSync((process.env.SHOT_DIR || '/tmp/claude-0/shots') + '/app.log', log);
  app.kill(); process.exit(0);
})();
