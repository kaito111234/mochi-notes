module.exports = async ({ room, shot, sleep }) => {
  await room.keyboard.press('4'); await sleep(7200); shot('01-xong-note-nhan-xu');
  await room.keyboard.press('2'); await sleep(600);
  await room.click('text=Quay 10+1'); await sleep(4200); shot('02-gacha-10-1');
  const b = await room.$('text=Tiếp tục'); if (b) await b.click(); await sleep(400);
  await room.click('text=Quay 1 lượt'); await sleep(900); shot('03-gacha-dang-quay'); await sleep(2500); shot('04-gacha-1-luot');
  const c = await room.$('text=Tiếp tục'); if (c) await c.click(); await sleep(300);
  await room.keyboard.press('1'); await sleep(600);
  

  const tiles = await room.$$('#tab-wardrobe .wd-item:not(.wd-lock)');
  console.log('tiles', tiles.length);
  if (tiles[0]) await tiles[0].click();
  await sleep(500); shot('05-tu-do-mac-thu');
  const m = await room.$('#tab-wardrobe button:text-is("Mặc"):visible'); if (m) await m.click(); await sleep(300);
  { const t2 = await room.$$("#tab-wardrobe .wd-item:not(.wd-lock)"); const pick = t2[2]; if (pick) { await pick.click(); await sleep(250); const m2 = await room.$("#tab-wardrobe button:text-is(\"Mặc\"):visible"); if (m2) await m2.click(); } }
  await sleep(600); shot('06-tu-do-dang-mac');
  await room.keyboard.press('4'); await sleep(600); shot('07-nhiem-vu');
  await room.keyboard.press('3'); await sleep(400);
  const bs = await room.$$('text=Mua & cho ăn'); if (bs[0]) await bs[0].click(); await sleep(1000); shot('08-cua-hang-cho-an');
  await room.keyboard.press('5'); await sleep(700); shot('09-thong-ke');
};
