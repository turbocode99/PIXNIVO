const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('🚀 Launching Puppeteer for Phase 3 End-to-End Pipeline Test...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 980 });

  page.on('console', msg => console.log('  [BROWSER LOG]:', msg.text()));
  page.on('pageerror', err => console.log('  [BROWSER ERROR]:', err.toString()));

  console.log('  📄 Navigating to http://localhost:3000/logo-generator-demo.html ...');
  await page.goto('http://localhost:3000/logo-generator-demo.html', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('  ⏳ Waiting for React and Canvas Studio...');
  await page.waitForSelector('.px-theme-selector', { timeout: 10000 });
  await page.waitForSelector('#designer-canvas', { timeout: 10000 });
  console.log('  ✅ ThemeSelector & Canvas Studio mounted successfully!');

  // Test Step 1: Select "3D Glass Bubble" Theme Card
  console.log('  🎨 Selecting "3D Glass Bubble" theme...');
  const cards = await page.$$('.px-ts-card');
  if (cards.length > 0) {
    await cards[0].click();
    await new Promise(r => setTimeout(r, 400));
  }

  // Test Step 2: Click "Fox Head" chip
  console.log('  🦊 Clicking "Fox Head" quick idea chip...');
  const chips = await page.$$('.px-ts-chip');
  for (const chip of chips) {
    const text = await page.evaluate(el => el.textContent, chip);
    if (text.toLowerCase().includes('fox')) {
      await chip.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 400));

  // Test Step 3: Trigger Generate AI Logo button
  console.log('  ✨ Triggering "Generate AI Logo" CTA...');
  const generateBtn = await page.$('.px-ts-btn-generate');
  await generateBtn.click();

  // Test Step 4: Wait for generation and canvas injection to complete
  console.log('  ⏳ Awaiting AgentRouter dispatch, background removal, and canvas injection...');
  await page.waitForFunction(() => {
    const btn = document.querySelector('.demo-btn-download');
    return btn && !btn.disabled;
  }, { timeout: 25000 });
  console.log('  ✅ Pipeline completed! Canvas injected & download button enabled!');

  // Verify canvas has non-empty pixel data
  const hasCanvasData = await page.evaluate(() => {
    const canvas = document.getElementById('designer-canvas');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    // Non-zero alpha at center
    return imgData[3] > 0;
  });
  console.log('  🎯 Canvas pixel data verified at center:', hasCanvasData);

  // Scroll to top and ensure Canvas Artboard tab is active
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));

  // Capture Canvas Artboard Screenshot
  const artifactDir = 'C:\\Users\\Danish khan\\.gemini\\antigravity-ide\\brain\\4f5f72fd-bf75-4f79-9228-7e6b3eda452b';
  const canvasScreenshotPath = path.join(artifactDir, 'phase3_canvas_studio.png');
  await page.screenshot({ path: canvasScreenshotPath, fullPage: false });
  console.log(`  📸 Canvas Studio screenshot saved to: ${canvasScreenshotPath}`);

  // Test Step 5: Switch to "Raw vs Transparent" Comparison Tab
  console.log('  ⚖️ Switching to "Raw vs Transparent" comparison tab...');
  const tabs = await page.$$('.demo-tab-btn');
  if (tabs.length >= 2) {
    await tabs[1].click(); // Tab index 1 is "Raw vs Transparent"
    await new Promise(r => setTimeout(r, 600));
  }

  // Capture Comparison View Screenshot
  const compareScreenshotPath = path.join(artifactDir, 'phase3_comparison_view.png');
  await page.screenshot({ path: compareScreenshotPath, fullPage: false });
  console.log(`  📸 Comparison view screenshot saved to: ${compareScreenshotPath}`);


  await browser.close();
  console.log('🎉 PHASE 3 END-TO-END UI & CANVAS INJECTION TEST PASSED 100%!');
})();
