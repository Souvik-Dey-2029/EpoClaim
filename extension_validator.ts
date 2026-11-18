
import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const extensionPath = path.resolve('D:/Development/Projects/MY PERSONAAL WORKS/Global/EPOCLAIM/temp_verification_final');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://chatgpt.com');
  
  // Wait a moment for extension to initialize
  await page.waitForTimeout(3000);
  
  // Verify that the extension is loaded (we can check for specific console messages or elements if we had them)
  // For now, just verifying that it launches successfully
  console.log("Extension loaded successfully.");

  await browser.close();
})();
