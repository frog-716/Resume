// 校验：图标的「含描边墨迹框」是否完整落在 viewBox 内（不裁剪），以及最长边是否齐到容器
const { chromium } = require('playwright-core');
const path = require('path');
const TARGETS = [
  ['a-paper-bench.html', '方向A demo（0.68 预览）'],
  ['../../prototypes/a4-spacing-eight-gaps-demo-v34.html', 'v34 真实 PDF（100%）'],
];
(async () => {
  const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--no-sandbox'] });
  let fail = 0;
  for (const [file, label] of TARGETS) {
    const page = await browser.newPage({ viewport:{width:720,height:900}, deviceScaleFactor:1 });
    const url = 'file://' + (file.startsWith('/') ? file : path.resolve(__dirname, file));
    await page.goto(url);
    await page.waitForTimeout(600);
    const rows = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('.contact-row svg.contact-icon, .contact-row svg.github-cat')].slice(0,5);
      return svgs.map(svg => {
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        const pxPerUnit = r.width / vb.width;
        const g = svg.getBBox();
        let half = 0;
        for (const c of svg.querySelectorAll('path,circle,rect,line,polyline,polygon')) {
          const sw = parseFloat(c.getAttribute('stroke-width') || '0');
          const st = c.getAttribute('stroke');
          if (!sw || !st || st === 'none') continue;
          let sc = 1;
          const m = (c.getAttribute('transform')||'').match(/scale\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)/);
          if (m) sc = Math.max(Math.abs(parseFloat(m[1])), Math.abs(parseFloat(m[2] ?? m[1])));
          half = Math.max(half, sw * sc / 2);
        }
        const left = g.x - half, top = g.y - half, right = g.x + g.width + half, bottom = g.y + g.height + half;
        const inside = left >= vb.x - 0.02 && top >= vb.y - 0.02 && right <= vb.x + vb.width + 0.02 && bottom <= vb.y + vb.height + 0.02;
        const inkWpx = (right - left) * pxPerUnit, inkHpx = (bottom - top) * pxPerUnit;
        return {
          label: svg.getAttribute('aria-label'),
          boxPx: +r.width.toFixed(2),
          vw: +vb.width.toFixed(3),
          inkW: +inkWpx.toFixed(2), inkH: +inkHpx.toFixed(2),
          maxPct: +(Math.max(inkWpx, inkHpx) / r.width * 100).toFixed(1),
          inside,
        };
      });
    });
    console.log('\n== ' + label + ' ==');
    for (const r of rows) {
      if (!r.inside) fail++;
      console.log(`${(r.label||'').padEnd(12)} 容器 ${r.boxPx}px | 墨迹(含描边) ${r.inkW}×${r.inkH}px | 最长边 ${r.maxPct}% | viewBox ${r.vw} | ${r.inside ? 'PASS 未裁剪' : 'FAIL 被裁剪'}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(fail ? `\nFAILED: ${fail} 个图标被裁剪` : '\nALL PASS：五个图标描边完整、最长边齐边界');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
