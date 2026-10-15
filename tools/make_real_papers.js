const fs = require('fs'), path = require('path');
const DIR = process.argv[2];
const base = (o) => Object.assign({
  group: 'real', dark: false,
  bg: { color: '#fffdf5', head: 'same', gradient: null, texture: 'none' },
  lines: { kind: 'none', color: 'rgba(0,0,0,0)', step: 26, margin: null },
  header: null, ink: '#2a2f45', font: 'itim', edge: null, corner: null, deco: [], checklist: false
}, o);
const P = [
  { id: 'real-index', name: 'Thẻ ghi chú', order: 10, noteColor: 'yellow', kind: 'index', pin: { type: 'pushpin', color: 'red' },
    bg: { color: '#fffdf4', head: 'same', gradient: null, texture: 'grain' }, lines: { kind: 'ruled', color: 'rgba(70,110,190,.30)', step: 26, margin: null } },
  { id: 'real-notebook', name: 'Giấy sổ lò xo', order: 20, noteColor: 'blue', kind: 'notebook', pin: { type: 'washi', color: 'pink', pattern: 'dots' },
    bg: { color: '#fdfdfb', head: 'same', gradient: null, texture: 'none' }, lines: { kind: 'margin-ruled', color: 'rgba(70,120,200,.32)', step: 26, margin: '#f08a9a' }, font: 'pangolin' },
  { id: 'real-kraft', name: 'Thẻ kraft có dây', order: 30, noteColor: 'gray', kind: 'kraft', pin: { type: 'nail', color: 'silver' },
    bg: { color: '#c9a47c', head: 'same', gradient: null, texture: 'kraft' }, ink: '#3b2a1a', font: 'mali' },
  { id: 'real-polaroid', name: 'Ảnh polaroid', order: 40, noteColor: 'purple', kind: 'polaroid', pin: { type: 'washi', color: 'mint', pattern: 'stripe' },
    bg: { color: '#ffffff', head: 'same', gradient: ['#ffe3ec', '#e3ecff'], texture: 'none' }, ink: '#3a3340' },
  { id: 'real-receipt', name: 'Hoá đơn', order: 50, noteColor: 'gray', kind: 'receipt', pin: { type: 'bulldog', color: 'silver' },
    bg: { color: '#fbfbf7', head: 'same', gradient: null, texture: 'grain' }, ink: '#30302c', font: 'system' },
  { id: 'real-envelope', name: 'Phong bì thư', order: 60, noteColor: 'yellow', kind: 'envelope', pin: { type: 'waxseal', color: 'red' },
    bg: { color: '#f6e7cf', head: 'same', gradient: null, texture: 'linen' }, ink: '#5a3b2a', font: 'mali' },
  { id: 'real-memo', name: 'Tập memo', order: 70, noteColor: 'yellow', kind: 'memo', pin: { type: 'magnet', color: 'red', shape: 'strawberry' },
    bg: { color: '#fff7e3', head: 'same', gradient: null, texture: 'none' }, lines: { kind: 'ruled', color: 'rgba(200,120,80,.22)', step: 26, margin: null },
    header: { text: 'MEMO', font: 'bevietnam', color: '#d0573f', size: 16, align: 'left', style: 'stamp' }, ink: '#3d2b22' },
  { id: 'real-ticket', name: 'Vé xem phim', order: 80, noteColor: 'pink', kind: 'ticket', pin: { type: 'paperclip', color: 'silver' },
    bg: { color: '#ffe0cc', head: 'same', gradient: ['#ffe5d2', '#ffd3df'], texture: 'none' },
    header: { text: 'ADMIT ONE', font: 'bevietnam', color: '#d9534f', size: 14, align: 'left', style: 'ribbon' }, ink: '#4a2630', font: 'baloo2' },
  { id: 'real-dotgrid', name: 'Thẻ chấm bi', order: 90, noteColor: 'gray', kind: 'card', pin: { type: 'masking', color: 'beige' },
    bg: { color: '#fbfaf5', head: 'same', gradient: null, texture: 'grain' }, lines: { kind: 'dots', color: 'rgba(60,60,80,.32)', step: 22, margin: null }, font: 'nunito' },
  { id: 'real-torn', name: 'Mẩu giấy xé', order: 100, noteColor: 'yellow', kind: 'torn', pin: { type: 'thumbtack', color: 'blue' },
    bg: { color: '#fffef7', head: 'same', gradient: null, texture: 'grain' }, lines: { kind: 'ruled', color: 'rgba(90,120,170,.22)', step: 26, margin: null }, font: 'pangolin' },
  { id: 'real-cloud', name: 'Mây bồng bềnh', order: 110, noteColor: 'blue', kind: 'cloud', pin: { type: 'starpin', color: 'yellow' },
    bg: { color: '#eaf4ff', head: 'same', gradient: ['#f2f8ff', '#dcecff'], texture: 'none' }, ink: '#31507a', font: 'baloo2' },
  { id: 'real-tracing', name: 'Giấy can trong', order: 120, noteColor: 'gray', kind: 'tracing', pin: { type: 'cleartape', color: 'clear' },
    bg: { color: '#f4f6f8', head: 'same', gradient: null, texture: 'none' }, lines: { kind: 'grid', color: 'rgba(60,90,120,.16)', step: 22, margin: null }, ink: '#26323c', font: 'nunito' },
  { id: 'real-graph', name: 'Giấy kẻ ô', order: 130, noteColor: 'green', kind: 'card', pin: { type: 'twopins', color: 'green' },
    bg: { color: '#f7fbf6', head: 'same', gradient: null, texture: 'none' }, lines: { kind: 'grid', color: 'rgba(60,140,100,.22)', step: 20, margin: null }, ink: '#203a2c', font: 'nunito' },
  { id: 'real-letter', name: 'Thư tay air mail', order: 140, noteColor: 'blue', kind: 'letter', pin: { type: 'heartclip', color: 'pink' },
    bg: { color: '#fffaf0', head: 'same', gradient: null, texture: 'linen' }, lines: { kind: 'ruled', color: 'rgba(120,100,80,.2)', step: 26, margin: null }, ink: '#2f3550', font: 'mali' },
  { id: 'real-chalk', name: 'Bảng phấn mini', order: 150, noteColor: 'charcoal', kind: 'chalk', dark: true, pin: { type: 'magnet', color: 'yellow', shape: 'round' },
    bg: { color: '#2f4a3c', head: 'same', gradient: ['#35523f', '#283f33'], texture: 'grain' }, ink: '#f3f1e6', font: 'pangolin' },
  { id: 'real-sticky', name: 'Giấy nhớ cổ điển', order: 160, noteColor: 'yellow', kind: 'sticky', pin: { type: 'none', color: 'red' },
    bg: { color: '#fff3a3', head: 'same', gradient: ['#fff6b8', '#ffec8a'], texture: 'none' }, ink: '#2b2a1f', font: 'itim' }
];
for (const p of P) {
  const d = path.join(DIR, p.id); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'paper.json'), JSON.stringify(base(p), null, 2) + '\n');
}
console.log(P.length);
