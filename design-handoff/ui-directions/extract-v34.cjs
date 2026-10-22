const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1600 }, deviceScaleFactor: 2 });
  const url = 'file://' + path.resolve('/Users/frog/Projects/Resume/prototypes/a4-spacing-eight-gaps-demo-v34.html');
  await page.goto(url);
  await page.waitForTimeout(600);

  const out = await page.evaluate(() => {
    const CORE = new Set(['paper','identity','name','contact-row','contact-item','contact-icon',
      'github-cat','section-heading','entry-head','bullets','experience','run-zh','run-en',
      'run-num','education','two-row','entry','contact','selected','highlight']);
    const EXCLUDE = new Set(['algorithm-paper','thumb-paper','guides','boundary','sort-handle',
      'over','selected','highlight','experience-float','point-selected','point-float','sort-source',
      'sort-placeholder','contact-add-menu','margin-band','margin-guide-frame','margin-map',
      'margin-fixed','section-demo','trash-can','paper-use-track','paper-use-label','fill-readout',
      'is-dragging','resume-name-button','wrap-contacts','overflow','paper-use']);
    const selHasExclude = sel => [...EXCLUDE].some(t => sel.includes(t));
    const classesOf = sel => [...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]);
    const isPaperDescendant = sel => sel.trim().startsWith('.paper');
    const isKeep = sel => {
      if (selHasExclude(sel)) return false;
      if (isPaperDescendant(sel)) return true;
      const toks = classesOf(sel);
      return toks.length > 0 && toks.every(t => CORE.has(t));
    };

    const pc = document.getElementById('paper-content');
    const svgs = [...pc.querySelectorAll('svg.contact-icon, svg.github-cat')];
    const iconReport = [];
    const K = 1.0; // 墨迹最长边够到容器边界（无留白）
    for (const svg of svgs) {
      // 关键：getBBox()/getBoundingClientRect() 都不含描边，直接把 viewBox 设成几何框
      // 会把一半描边裁到视口外（图标变浅、像被覆盖）。这里显式补上描边半宽。
      let half = 0;
      for (const c of svg.querySelectorAll('path,circle,rect,line,polyline,polygon')) {
        const sw = parseFloat(c.getAttribute('stroke-width') || '0');
        const stroke = c.getAttribute('stroke');
        if (!sw || !stroke || stroke === 'none') continue;
        let sc = 1;
        const m = (c.getAttribute('transform') || '').match(/scale\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)/);
        if (m) sc = Math.max(Math.abs(parseFloat(m[1])), Math.abs(parseFloat(m[2] ?? m[1])));
        half = Math.max(half, sw * sc / 2);
      }
      const g = svg.getBBox(); // 几何框（已含子元素 transform），不含描边
      const b = { x: g.x - half, y: g.y - half, width: g.width + half * 2, height: g.height + half * 2 };
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const T = Math.max(b.width, b.height) * K;
      const nx = (cx - T / 2).toFixed(3), ny = (cy - T / 2).toFixed(3), nT = T.toFixed(3);
      svg.setAttribute('viewBox', `${nx} ${ny} ${nT} ${nT}`);
      svg.removeAttribute('transform');
      iconReport.push({ cls: svg.getAttribute('class'), T:+nT, inkW:+b.width.toFixed(2), inkH:+b.height.toFixed(2), half });
    }
    pc.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    const inner = pc.innerHTML;

    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of Array.from(rules)) {
        const sel = r.selectorText || '';
        if (!sel) continue;
        if (isKeep(sel)) {
          if (sel.trim() === '.paper') {
            const decls = r.cssText.replace(/^[^.{]*\{|\}$/g, '').split(';')
              .map(s => s.trim()).filter(s => s.startsWith('--'));
            if (decls.length) css += '.paper{' + decls.join(';') + '}\n';
          } else {
            css += r.cssText + '\n';
          }
        }
        if (r.media && /print/.test(r.conditionText || '')) {
          for (const ir of Array.from(r.cssRules)) {
            if (isKeep(ir.selectorText || '')) css += '@media ' + r.conditionText + '{' + ir.cssText + '}\n';
          }
        }
      }
    }
    return { inner, css, iconReport };
  });

  out.css = out.css.split('\n').filter(l => l.trim()).join('\n') + '\n';
  fs.writeFileSync('v34-paper-inner-normalized.html', out.inner);
  fs.writeFileSync('v34-paper-core.css', '/* v34 纸面排版精选（变量/字体分轨/section/entry/bullets/contact），已剥离编辑器交互态 */\n' + out.css);
  console.log('=== 图标归一报告 ===');
  out.iconReport.forEach(r => console.log(r.cls, '| 容器单位 T=', r.T, '| 墨迹盒', r.inkW + 'x' + r.inkH, '| K=1.0'));
  console.log('inner length:', out.inner.length, '| core css length:', out.css.length);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
