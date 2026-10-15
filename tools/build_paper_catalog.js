// Gộp assets/paper/*/paper.json thành assets/paper/catalog.js (window.MochiPaperCatalog). Chạy: node tools/build_paper_catalog.js
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'paper');
const GROUP_ORDER = ['real', 'plain', 'cute', 'student', 'minimal', 'office', 'season'];

const papers = [];
for (const name of fs.readdirSync(DIR)) {
  const f = path.join(DIR, name, 'paper.json');
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (p.id !== name) throw new Error('id khác tên thư mục: ' + f);
  papers.push(p);
}
// mẫu trơn (plain-*) không có thư mục riêng: giữ nguyên từ catalog cũ
const old = fs.readFileSync(path.join(DIR, 'catalog.js'), 'utf8');
const oldCat = JSON.parse(old.slice(old.indexOf('{'), old.lastIndexOf('}') + 1));
for (const p of oldCat.papers) if (!papers.some(x => x.id === p.id)) papers.push(p);

const gi = g => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; };
papers.sort((a, b) => gi(a.group) - gi(b.group) || (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));
const out = '/* tự sinh bởi tools/build_paper_catalog.js — đừng sửa tay */\nwindow.MochiPaperCatalog = ' +
  JSON.stringify({ version: 1, papers }, null, 2) + ';\n';
fs.writeFileSync(path.join(DIR, 'catalog.js'), out);
console.log('mẫu giấy:', papers.length, 'nhóm:', [...new Set(papers.map(p => p.group))].join(', '));
