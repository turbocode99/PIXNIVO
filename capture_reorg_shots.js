const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Screenshot Image Tools with AI Upscaler tab
  await page.goto('http://127.0.0.1:3000/index.html?tab=upscale', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshot_image_tools_upscaler.png' });
  console.log('Saved screenshot_image_tools_upscaler.png');

  // 2. Screenshot PDF Tools without OCR
  await page.goto('http://127.0.0.1:3000/pdf-tools.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshot_pdf_tools_reorg.png' });
  console.log('Saved screenshot_pdf_tools_reorg.png');

  // 3. Screenshot Standalone AI OCR page
  await page.goto('http://127.0.0.1:3000/ai-ocr.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshot_ai_ocr_studio.png' });
  console.log('Saved screenshot_ai_ocr_studio.png');

  await browser.close();
})();
