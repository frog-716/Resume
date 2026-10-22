const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.goto('file:///Users/frog/Projects/Resume/design-handoff/ui-directions/style-explorer.html');
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/Users/frog/Projects/Resume/design-handoff/ui-directions/shots/explorer-top.png', clip: { x: 0, y: 0, width: 1440, height: 1100 } });
    console.log('saved explorer-top.png');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
