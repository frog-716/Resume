const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8791';
const OUT = '/Users/frog/Projects/Resume/design-handoff/ui-directions/shots';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // 1) 首开：应用自行初始化 store
  await page.goto(BASE + '/sidepanel.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // 2) 把 store 扩成 3 个方向，让方向室卡片有内容
  const expanded = await page.evaluate(() => {
    const KEY = 'resume-sidepanel-store-v1';
    const store = JSON.parse(localStorage.getItem(KEY));
    const base = store.directions[0];
    const names = ['我的简历', '后端工程师 · 投递版', '产品岗 · 精简版'];
    store.directions = names.map((name, i) => {
      const c = JSON.parse(JSON.stringify(base));
      c.id = 'direction-seed-' + i;
      c.name = name;
      c.createdAt = new Date(Date.now() - (3 - i) * 86400000).toISOString();
      c.currentDraft.updatedAt = c.createdAt;
      return c;
    });
    store.lastOpenedDirectionId = store.directions[0].id;
    localStorage.setItem(KEY, JSON.stringify(store));
    return store.directions.length;
  });
  console.log('directions seeded:', expanded);

  // 3) 重载读取新 store
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 编辑器视图：顶栏（含居中缩放控件）
  await page.screenshot({ path: OUT + '/ext-editor.png' });
  await page.screenshot({ path: OUT + '/ext-topbar.png', clip: { x: 0, y: 0, width: 1120, height: 76 } });
  console.log('saved ext-editor.png / ext-topbar.png');

  // 缩放控件是否真正居中：读几何
  const geo = await page.evaluate(() => {
    const bar = document.querySelector('.topbar');
    const vc = document.querySelector('.view-controls');
    const b = bar.getBoundingClientRect(), v = vc.getBoundingClientRect();
    const cs = getComputedStyle(vc);
    return {
      barCenter: +(b.left + b.width / 2).toFixed(1),
      vcCenter: +(v.left + v.width / 2).toFixed(1),
      offset: +(v.left + v.width / 2 - (b.left + b.width / 2)).toFixed(1),
      topbarDisplay: getComputedStyle(bar).display,
      readout: document.getElementById('zoom-readout')?.textContent,
      sepVisible: getComputedStyle(document.querySelector('.ctl-sep')).width,
      accentResolved: cs.borderTopColor,
    };
  });
  console.log('GEO', JSON.stringify(geo));

  // 4) 方向室：入口已按方向 A 设计稿从顶栏移除，改用 ⌘F（SPEC P-03/S-07）
  await page.keyboard.press('Meta+f');
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/ext-directions.png' });
  console.log('saved ext-directions.png');
  const topActions = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('.top-actions button')].map((b) => b.id || b.textContent.trim()),
    hasDirectionsButton: !!document.getElementById('open-directions'),
  }));
  console.log('TOP ACTIONS (方向室内)', JSON.stringify(topActions));

  const btns = await page.evaluate(() => {
    const acts = document.querySelector('.direction-card .card-actions');
    if (!acts) return null;
    return [...acts.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      const s = getComputedStyle(b);
      return {
        label: b.getAttribute('aria-label'),
        w: Math.round(r.width), h: Math.round(r.height),
        radius: s.borderRadius, border: s.borderTopWidth + ' ' + s.borderTopColor,
        bg: s.backgroundColor, color: s.color, svg: !!b.querySelector('svg'),
      };
    });
  });
  console.log('CARD ACTIONS', JSON.stringify(btns, null, 2));

  // 5) 悬停态：改名(墨蓝) / 删除(红)
  if (btns) {
    const card = await page.$('.direction-card');
    const box = await card.boundingBox();
    await page.screenshot({ path: OUT + '/ext-card.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 150) } });
    await card.$eval('.card-actions button[data-rename-direction]', (el) => el.closest('button').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    await page.hover('.direction-card .card-actions button[data-rename-direction]');
    await page.waitForTimeout(300);
    const hoverRename = await page.$eval('.direction-card .card-actions button[data-rename-direction]', (b) => { const s = getComputedStyle(b); return { border: s.borderTopColor, bg: s.backgroundColor, color: s.color }; });
    console.log('HOVER rename(pencil)', JSON.stringify(hoverRename));
    await page.hover('.direction-card .card-actions button[data-delete-direction]');
    await page.waitForTimeout(300);
    const hoverDelete = await page.$eval('.direction-card .card-actions button[data-delete-direction]', (b) => { const s = getComputedStyle(b); return { border: s.borderTopColor, bg: s.backgroundColor, color: s.color }; });
    console.log('HOVER delete', JSON.stringify(hoverDelete));
    await page.screenshot({ path: OUT + '/ext-card-hover.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 150) } });
    console.log('saved ext-card.png / ext-card-hover.png');
  }

  // 6) 检查是否有残留未定义变量（背景变透明 / 配色失效）
  const unresolved = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const names = ['--ink-body', '--bench-deep', '--accent-soft', '--accent', '--line', '--surface', '--selected', '--danger', '--saved'];
    const out = {};
    for (const n of names) { probe.style.setProperty('background', `var(${n})`); out[n] = getComputedStyle(probe).backgroundColor; }
    probe.remove();
    return out;
  });
  console.log('VARS', JSON.stringify(unresolved));

  await browser.close();
  console.log('\nconsole errors:', errors.length);
  errors.slice(0, 10).forEach((e) => console.log('  -', e));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
