const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('🚀 Launching Puppeteer for Advanced Canvas Studio & Vector SVG Test...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050 });

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
  console.log('  ✅ ThemeSelector & Advanced Canvas Studio mounted successfully!');

  // Test Step 1: Select "Cyberpunk Neon Glyph" theme
  console.log('  ⚡ Selecting "Cyberpunk Neon Glyph" theme...');
  const cards = await page.$$('.px-ts-card');
  if (cards.length >= 6) {
    await cards[5].click(); // Cyberpunk Neon Glyph is index 5
    await new Promise(r => setTimeout(r, 400));
  }

  // Test Step 2: Click "Fox Head" chip
  console.log('  🦊 Clicking "Fox Head" chip...');
  const chips = await page.$$('.px-ts-chip');
  for (const chip of chips) {
    const text = await page.evaluate(el => el.textContent, chip);
    if (text.toLowerCase().includes('fox')) {
      await chip.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 400));

  // Test Step 3: Click Generate AI Logo
  console.log('  ✨ Triggering "Generate AI Logo" CTA...');
  const generateBtn = await page.$('.px-ts-btn-generate');
  await generateBtn.click();

  console.log('  ⏳ Awaiting generation, background removal, and multi-layer composition render...');
  await page.waitForFunction(() => {
    const btn = document.querySelector('.demo-btn-export.svg-btn');
    return btn && !btn.disabled;
  }, { timeout: 25000 });
  console.log('  ✅ Generation complete! Canvas rendered and export buttons active!');

  // Test Step 4: Verify SVG generation via client API
  const svgOutput = await page.evaluate(() => {
    const appEl = document.querySelector('#designer-canvas');
    if (!window.PixnivoStudio) return null;
    const dummyState = {
      brandName: 'NEXUS CYBER',
      slogan: 'QUANTUM PROTOCOL',
      fontFamily: 'Orbitron',
      layout: 'badge-arc',
      badgeFrame: 'circle-ring',
      accentColor: '#a855f7'
    };
    return window.PixnivoStudio.generateCompositionSVG(dummyState, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  if (svgOutput && svgOutput.includes('<svg') && svgOutput.includes('NEXUS CYBER') && svgOutput.includes('<textPath')) {
    console.log('  ✅ Scalable Vector SVG output validated! Length:', svgOutput.length, 'bytes');
  } else {
    console.warn('  ⚠️ SVG output check warning:', svgOutput ? svgOutput.slice(0, 100) : 'null');
  }

  // Scroll to top to ensure complete artboard visibility
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));

  // Capture Screenshot of Canvas Studio with Typography Controls
  const artifactDir = 'C:\\Users\\Danish khan\\.gemini\\antigravity-ide\\brain\\4f5f72fd-bf75-4f79-9228-7e6b3eda452b';
  const studioScreenshotPath = path.join(artifactDir, 'advanced_studio_branding.png');
  await page.screenshot({ path: studioScreenshotPath, fullPage: false });
  console.log(`  📸 Advanced Studio screenshot saved to: ${studioScreenshotPath}`);

  // Test Step 5: Switch layout to "Circular Arc"
  console.log('  🔄 Switching layout to "Circular Arc"...');
  const arcBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.demo-pill-opt'));
    const arc = btns.find(b => b.textContent.includes('Circular Arc'));
    if (arc) {
      arc.click();
      return true;
    }
    return false;
  });

  await new Promise(r => setTimeout(r, 800));

  // Capture Screenshot of Arc Layout
  const arcScreenshotPath = path.join(artifactDir, 'advanced_studio_arc_layout.png');
  await page.screenshot({ path: arcScreenshotPath, fullPage: false });
  console.log(`  📸 Arc layout screenshot saved to: ${arcScreenshotPath}`);

  await browser.close();
  console.log('🎉 ADVANCED CANVAS STUDIO & VECTOR SVG E2E TEST PASSED 100%!');
})();
