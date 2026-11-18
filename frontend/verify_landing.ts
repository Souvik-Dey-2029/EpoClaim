
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  
  // Wait for the aurora and animations to settle
  await page.waitForTimeout(2000);

  const viewports = [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    console.log(`Taking screenshot of landing at ${vp.width}x${vp.height}`);
    await page.screenshot({ path: `landing-screenshot-${vp.width}.png` });
  }

  await browser.close();
})();
