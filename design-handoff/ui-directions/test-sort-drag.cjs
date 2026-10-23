// 复现/验证：要点左侧排序手柄的拖动排序
// 用例：把某个要点从第 1 位拖到第 3 位，检查数据顺序是否真的变了
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('CONSOLE: ' + m.text()); });

  // 播种必须在应用脚本之前：addInitScript 保证 loadStore 读到的就是这份数据
  await page.addInitScript(() => {
    const t = (html) => ({ html });
    const content = {
      identity: { name: t('林舟'), contacts: { phone: t('010-0000-0000'), email: t('lin.zhou@example.com'), wechat: t('linzhou-demo') }, links: { github: null, personalWebsite: null } },
      sections: [
        { type: 'skills', title: t('专业技能'), bullets: [
          { id: 'skill-1', html: '要点一 熟悉前端页面开发' },
          { id: 'skill-2', html: '要点二 数据结构整理业务' },
          { id: 'skill-3', html: '要点三 可读性与键盘操作' },
          { id: 'skill-4', html: '要点四 窄屏适配与演示' },
          { id: 'skill-5', html: '要点五 组件拆分与复用' },
        ] },
        { type: 'work', title: t('工作经历'), entries: [] },
        { type: 'projects', title: t('项目经历'), entries: [] },
        { type: 'education', title: t('教育背景'), columns: [t(''), t(''), t('')], bullets: [] },
      ],
    };
    const store = {
      schemaVersion: 1,
      lastOpenedDirectionId: 'dir-test',
      lastImport: null,
      directions: [{ id: 'dir-test', name: '测试方向', createdAt: '2026-10-22T00:00:00.000Z', currentDraft: { content, layout: { marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } }, updatedAt: '2026-10-22T00:00:00.000Z' } }],
    };
    localStorage.setItem('resume-sidepanel-store-v1', JSON.stringify(store));
  });
  await page.goto('http://127.0.0.1:8791/sidepanel.html');
  await page.waitForTimeout(1000);

  // 1) 找到第一个 bullet-list 的前三个要点文本
  const before = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.bullet-list .bullet')].slice(0, 3);
    return items.map((li) => li.textContent.trim().slice(0, 12));
  });
  console.log('拖动前前三条:', JSON.stringify(before));

  // 2) 悬停第一个要点 → 手柄应出现
  const first = await page.$('.bullet-list .bullet');
  const box = await first.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);

  const handleInfo = await page.evaluate(() => {
    const h = document.getElementById('sort-handle');
    if (!h || h.hidden) return { visible: false };
    const r = h.getBoundingClientRect();
    return { visible: true, x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  console.log('手柄状态:', JSON.stringify(handleInfo));
  if (!handleInfo.visible) { console.log('FAIL: 手柄未显示'); await browser.close(); process.exit(1); }

  // 3) 第三个要点的位置（拖放目标：取该行 75% 高度处，即"落到这一行”的明确意图；
  //    行正中是“插到前/插到后”的判定边界，不能作为目标点）
  const third = await page.evaluate(() => {
    const li = document.querySelectorAll('.bullet-list .bullet')[2];
    const r = li.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.top + r.height * 0.75 };
  });
  console.log('目标(第3条)位置:', JSON.stringify(third));

  // 4) 在手柄上按下，连续移动到第 3 条（多步移动 = 真实拖动）
  await page.mouse.move(handleInfo.cx, handleInfo.cy);
  await page.waitForTimeout(80);
  await page.mouse.down();
  // 分多步移动：先离开手柄、再逐段靠近目标
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    await page.mouse.move(
      handleInfo.cx + (third.x - handleInfo.cx) * t,
      handleInfo.cy + (third.y - handleInfo.cy) * t,
    );
    await page.waitForTimeout(30);
  }
  // 拖动过程中记录手柄是否还可见（hidden=true 即触发 pointercancel 的元凶）
  const midDrag = await page.evaluate(() => {
    const h = document.getElementById('sort-handle');
    return { hidden: h.hidden, opacity: getComputedStyle(h).opacity, pointerEvents: getComputedStyle(h).pointerEvents };
  });
  console.log('拖动过程中手柄:', JSON.stringify(midDrag));

  await page.mouse.up();
  await page.waitForTimeout(500);

  // 5) 结果
  const after = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.bullet-list .bullet')].slice(0, 3);
    return items.map((li) => li.textContent.trim().slice(0, 12));
  });
  console.log('拖动后前三条:', JSON.stringify(after));

  const changed = JSON.stringify(before) !== JSON.stringify(after);
  const movedToThird = after[2] === before[0];
  console.log(changed ? '顺序已变化' : '顺序未变化');
  console.log(movedToThird ? '第1条已移到第3位 ✓' : '第1条未到达第3位 ✗');

  // 6) 数据是否真的落盘（不是只换了 DOM）
  const stored = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('resume-sidepanel-store-v1'));
    return s.directions[0].currentDraft.content.sections[0].bullets.map((b) => b.html.slice(0, 6));
  });
  const dataOk = stored[2] === before[0].slice(0, 6);
  console.log('落盘顺序:', JSON.stringify(stored), dataOk ? '✓' : '✗');

  // 7) 反向拖回去：把当前第 3 条拖回第 1 位
  const src = await page.evaluate(() => {
    const li = document.querySelectorAll('.bullet-list .bullet')[2];
    const r = li.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  await page.mouse.move(src.cx, src.cy);
  await page.waitForTimeout(250);
  const handle2 = await page.evaluate(() => {
    const h = document.getElementById('sort-handle');
    const r = h.getBoundingClientRect();
    return { visible: !h.hidden, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  const dst = await page.evaluate(() => {
    const li = document.querySelectorAll('.bullet-list .bullet')[0];
    const r = li.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.top + r.height * 0.25 };
  });
  await page.mouse.move(handle2.cx, handle2.cy);
  await page.waitForTimeout(80);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    await page.mouse.move(handle2.cx + (dst.x - handle2.cx) * t, handle2.cy + (dst.y - handle2.cy) * t);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const roundTrip = await page.evaluate(() => [...document.querySelectorAll('.bullet-list .bullet')].map((li) => li.textContent.trim().slice(0, 6)));
  const backOk = roundTrip[0] === before[0].slice(0, 6) && roundTrip[2] === before[2].slice(0, 6);
  console.log('反向拖回前三条:', JSON.stringify(roundTrip), backOk ? '✓ 回到原位' : '✗');

  console.log('ERRORS:', errs.length ? errs : 'none');
  await browser.close();
  const pass = changed && movedToThird && dataOk && backOk && !errs.length;
  console.log(pass ? '\nALL PASS' : '\nCHECK FAILED');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
