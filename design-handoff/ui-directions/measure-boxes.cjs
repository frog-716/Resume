const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const DIR = '/Users/frog/Projects/Resume/design-handoff/ui-directions';

const TARGETS = {
  'a-paper-bench.html': '方向A 纸面工坊（demo 预览，0.68 缩放）',
  '/Users/frog/Projects/Resume/prototypes/a4-spacing-eight-gaps-demo-v34.html': 'v34 原型（真实 PDF，100% 缩放）',
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
  });
  const out = {};
  try {
    for (const [file, label] of Object.entries(TARGETS)) {
      const page = await browser.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(file.startsWith('/') ? 'file://' + file : 'file://' + path.join(DIR, file));
      await page.waitForTimeout(400);
      const data = await page.evaluate(() => {
        if (typeof buildPaper === 'function' && !document.querySelector('.contact-row')) buildPaper();
        const rows = [...document.querySelectorAll('.contact-row')];
        const svgs = [];
        rows.forEach((r) => r.querySelectorAll('svg').forEach((s) => svgs.push(s)));
        return svgs.map((s) => {
          const vb = (s.getAttribute('viewBox') || '0 0 24 24').split(/\s+/).map(Number);
          const b = s.getBBox();                 // 用户单位墨迹盒
          const rect = s.getBoundingClientRect(); // 渲染容器盒
          // 如果用户单位里已经含 <g transform>，getBBox 返回的是自身坐标系下的值，需再套一层 CTM 修正
          const ctm = s.getScreenCTM();
          const cssScale = rect.width / vb[2];    // 容器像素 / viewBox 单位
          const inkW = +(b.width * cssScale).toFixed(2);
          const inkH = +(b.height * cssScale).toFixed(2);
          const boxW = +rect.width.toFixed(2);
          const boxH = +rect.height.toFixed(2);
          // viewBox 中心 vs 墨迹中心 → 居中偏移（用户单位）
          const offX = +((b.x + b.width / 2) - (vb[0] + vb[2] / 2)).toFixed(3);
          const offY = +((b.y + b.height / 2) - (vb[1] + vb[3] / 2)).toFixed(3);
          return {
            cls: s.getAttribute('class') || 'unnamed',
            viewBox: `${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}`,
            boxW, boxH,
            inkW, inkH,
            pctW: +((inkW / boxW) * 100).toFixed(1),
            pctH: +((inkH / boxH) * 100).toFixed(1),
            pctArea: +(((inkW * inkH) / (boxW * boxH)) * 100).toFixed(1),
            maxEdge: +Math.max(inkW, inkH).toFixed(2),
            offX, offY,
            hasStrokeW: s.getAttribute('stroke-width') || null,
          };
        });
      });
      out[file] = { label, icons: data };
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(DIR, 'icon-boxes.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
