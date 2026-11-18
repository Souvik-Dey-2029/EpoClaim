
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 375, height: 667 },
  ];

  await page.goto('http://localhost:5173');

  // Wait for the app to be interactive
  await page.waitForLoadState('networkidle');

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    console.log(`Taking screenshot at ${vp.width}x${vp.height}`);
    await page.screenshot({ path: `screenshot-${vp.width}.png` });
  }

  await browser.close();
})();
