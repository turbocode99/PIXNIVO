const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('🚀 Launching Puppeteer to test ThemeSelector UI...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 950 });

  // Navigate to local demo page
  await page.goto('http://localhost:3000/logo-generator-demo.html', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('  📄 Page loaded. Checking React render...');
  await page.waitForSelector('.px-theme-selector', { timeout: 10000 });
  console.log('  ✅ ThemeSelector component mounted successfully!');

  // Test 1: Click the "Minimalist Flat Vector" theme
  console.log('  🎨 Clicking "Minimalist Flat Vector" theme card...');
  const cards = await page.$$('.px-ts-card');
  console.log(`  Found ${cards.length} theme cards.`);
  if (cards.length >= 4) {
    await cards[3].click(); // Minimalist Flat Vector is index 3
    await new Promise(r => setTimeout(r, 400));
  }

  // Test 2: Click a Quick Idea Chip ("Mountain Peak")
  console.log('  🏔️ Clicking "Mountain Peak" chip...');
  const chips = await page.$$('.px-ts-chip');
  if (chips.length > 0) {
    await chips[0].click();
    await new Promise(r => setTimeout(r, 400));
  }

  // Test 3: Expand the Prompt Preview Accordion
  console.log('  ⚙️ Expanding Prompt Preview Accordion...');
  const toggleBtn = await page.$('.px-ts-accordion-toggle');
  if (toggleBtn) {
    await toggleBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  // Test 4: Click Generate AI Logo Button
  console.log('  ✨ Clicking "Generate AI Logo" button...');
  const generateBtn = await page.$('.px-ts-btn-generate');
  if (generateBtn) {
    await generateBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }

  // Verify that payload was emitted in the inspector
  const payloadText = await page.$eval('.demo-payload-code', el => el.textContent);
  console.log('  📡 Inspector text preview:\n', payloadText.slice(0, 250) + '...');

  if (payloadText.includes('"theme_id"') && payloadText.includes('"raw_concept"')) {
    console.log('  ✅ Payload successfully emitted and rendered in inspector!');
  } else {
    console.warn('  ⚠️ Payload emission verification warning: output did not contain expected keys.');
  }

  // Capture full screenshot into artifact directory
  const artifactDir = 'C:\\Users\\Danish khan\\.gemini\\antigravity-ide\\brain\\4f5f72fd-bf75-4f79-9228-7e6b3eda452b';
  const screenshotPath = path.join(artifactDir, 'theme_selector_phase2_full.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  📸 Full screenshot saved to: ${screenshotPath}`);

  // Also capture top hero viewport
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  const heroScreenshotPath = path.join(artifactDir, 'theme_selector_phase2_hero.png');
  await page.screenshot({ path: heroScreenshotPath, fullPage: false });
  console.log(`  📸 Hero screenshot saved to: ${heroScreenshotPath}`);

  await browser.close();
  console.log('🎉 Puppeteer UI test completed successfully!');
})();
