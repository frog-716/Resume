// 验证缩放控件：2% 颗粒度、读数只显示数字、点击可编辑、输入应用/取消
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

  await page.addInitScript(() => {
    const t = (html) => ({ html });
    const content = {
      identity: { name: t('林舟'), contacts: { phone: t('010-0000-0000'), email: t('lin.zhou@example.com'), wechat: t('linzhou-demo') }, links: { github: null, personalWebsite: null } },
      sections: [
        { type: 'skills', title: t('专业技能'), bullets: [{ id: 's1', html: '要点一' }, { id: 's2', html: '要点二' }] },
        { type: 'work', title: t('工作经历'), entries: [] },
        { type: 'projects', title: t('项目经历'), entries: [] },
        { type: 'education', title: t('教育背景'), columns: [t(''), t(''), t('')], bullets: [] },
      ],
    };
    localStorage.setItem('resume-sidepanel-store-v1', JSON.stringify({
      schemaVersion: 1, lastOpenedDirectionId: 'd1', lastImport: null,
      directions: [{ id: 'd1', name: '测试方向', createdAt: '2026-10-22T00:00:00.000Z', currentDraft: { content, layout: { marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } }, updatedAt: '2026-10-22T00:00:00.000Z' } }],
    }));
  });
  await page.goto('http://127.0.0.1:8791/sidepanel.html');
  await page.waitForTimeout(1000);

  const readout = () => page.evaluate(() => {
    const r = document.getElementById('zoom-readout');
    const i = document.getElementById('zoom-input');
    return { text: r.textContent.trim(), visible: !r.hidden, inputHidden: i.hidden, inputValue: i.value, scale: getComputedStyle(document.documentElement).getPropertyValue('--paper-scale').trim() };
  });
  const paperWidth = () => page.evaluate(() => document.getElementById('paper-space').style.width);

  const s0 = await readout();
  console.log('初始读数:', JSON.stringify(s0));

  // ① 读数只显示数字（无 %）
  const noPercent = !s0.text.includes('%');
  console.log(noPercent ? 'PASS 读数无 % 号' : 'FAIL 读数仍带 %');

  // ② 放大一档 = +2 个百分点
  const before = parseFloat(s0.text);
  await page.click('#zoom-in');
  await page.waitForTimeout(120);
  const s1 = await readout();
  const step2 = Math.abs(parseFloat(s1.text) - before - 2) < 0.51;
  console.log(`放大一档: ${s0.text} → ${s1.text}`, step2 ? 'PASS 步进 2%' : 'FAIL 步进不是 2%');

  // ③ 缩小一档也是 2%
  await page.click('#zoom-out');
  await page.waitForTimeout(120);
  const s2 = await readout();
  const back = Math.abs(parseFloat(s2.text) - before) < 0.51;
  console.log(`缩小一档: ${s1.text} → ${s2.text}`, back ? 'PASS 回到原值' : 'FAIL');

  // ④ 点击读数 → 出现输入框，按钮隐藏
  await page.click('#zoom-readout');
  await page.waitForTimeout(120);
  const s3 = await readout();
  const editMode = s3.visible === false && s3.inputHidden === false;
  console.log('点击读数后:', JSON.stringify(s3), editMode ? 'PASS 进入编辑态' : 'FAIL');

  // ⑤ 输入 90 回车 → 应用
  await page.fill('#zoom-input', '90');
  await page.press('#zoom-input', 'Enter');
  await page.waitForTimeout(150);
  const s4 = await readout();
  const applied = Math.abs(parseFloat(s4.text) - 90) < 1.5;
  console.log('输入 90 回车后读数:', s4.text, applied ? 'PASS 已应用' : 'FAIL');

  // ⑥ 输入越界值 999 → 夹到上限 250
  await page.click('#zoom-readout');
  await page.waitForTimeout(100);
  await page.fill('#zoom-input', '999');
  await page.press('#zoom-input', 'Enter');
  await page.waitForTimeout(150);
  const s5 = await readout();
  console.log('输入 999 后读数:', s5.text, Math.abs(parseFloat(s5.text) - 250) < 1 ? 'PASS 夹到 250' : 'FAIL');

  // ⑦ 输入带 % 号和空格也能解析
  await page.click('#zoom-readout');
  await page.waitForTimeout(100);
  await page.fill('#zoom-input', ' 60% ');
  await page.press('#zoom-input', 'Enter');
  await page.waitForTimeout(150);
  const s6 = await readout();
  console.log('输入 " 60% " 后读数:', s6.text, Math.abs(parseFloat(s6.text) - 60) < 1.5 ? 'PASS 兼容 % 与空格' : 'FAIL');

  // ⑧ Esc 取消：读数不变
  const beforeEsc = (await readout()).text;
  await page.click('#zoom-readout');
  await page.waitForTimeout(100);
  await page.fill('#zoom-input', '13');
  await page.press('#zoom-input', 'Escape');
  await page.waitForTimeout(150);
  const s7 = await readout();
  const escOk = s7.text === beforeEsc && s7.inputHidden === true && s7.visible === true;
  console.log(`Esc 取消: ${beforeEsc} → ${s7.text}`, escOk ? 'PASS 未应用且退回按钮' : 'FAIL');

  // ⑨ 输入垃圾值（abc）→ 保持原值不崩
  await page.click('#zoom-readout');
  await page.waitForTimeout(100);
  await page.fill('#zoom-input', 'abc');
  await page.press('#zoom-input', 'Enter');
  await page.waitForTimeout(150);
  const s8 = await readout();
  console.log('输入 abc 后读数:', s8.text, s8.text === beforeEsc ? 'PASS 忽略无效输入' : 'FAIL');

  // ⑩ 纸面实际宽度跟着变（不是只改数字）
  const w1 = await paperWidth();
  await page.click('#zoom-readout');
  await page.waitForTimeout(100);
  await page.fill('#zoom-input', '100');
  await page.press('#zoom-input', 'Enter');
  await page.waitForTimeout(150);
  const w2 = await paperWidth();
  const s9 = await readout();
  const paperFollows = w1 !== w2 && parseFloat(s9.text) > parseFloat(s8.text);
  console.log(`纸面宽 ${w1} → ${w2}（读数 ${s8.text} → ${s9.text}）`, paperFollows ? 'PASS 纸面跟随' : 'FAIL');

  // ⑪ 方向室里顶栏读数保持（不跳变）
  await page.keyboard.press('Meta+f');
  await page.waitForTimeout(250);
  const s10 = await readout();
  await page.keyboard.press('Meta+f');
  await page.waitForTimeout(250);
  const s11 = await readout();
  const stable = s10.text === s9.text && s11.text === s9.text;
  console.log(`方向室期间读数 ${s9.text} → ${s10.text} → ${s11.text}`, stable ? 'PASS 不跳变' : 'FAIL');

  const checks = [noPercent, step2, back, editMode, applied, escOk, paperFollows, stable];
  const names = ['无%号', '步进2%', '缩回原值', '进入编辑态', '输入应用', 'Esc取消', '纸面跟随', '方向室不跳变'];
  let fail = 0;
  checks.forEach((ok, i) => { if (!ok) { console.log('FAILED:', names[i]); fail++; } });
  console.log('ERRORS:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
