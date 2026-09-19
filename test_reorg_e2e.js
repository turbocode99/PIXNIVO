const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing Menu Reorganization & Feature Integration...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Verify index.html
    console.log('\n--- 1. Testing index.html (Image Tools) ---');
    await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle0' });

    // Check navbar has AI OCR
    const navOcr = await page.$('nav.nav-links a[href="/ai-ocr"]');
    if (!navOcr) throw new Error('index.html: AI OCR link missing in main navbar');
    const navOcrText = await page.evaluate(el => el.innerText.trim(), navOcr);
    console.log('PASS: Main navbar contains AI OCR:', navOcrText);

    // Check navbar does NOT have AI Upscaler
    const navUpscaler = await page.$('nav.nav-links a[href="/image-upscaler"]');
    if (navUpscaler) throw new Error('index.html: AI Upscaler still present in main navbar');
    console.log('PASS: Main navbar no longer has AI Upscaler as top-level link.');

    // Check tabs in Image Tools
    const tabBtns = await page.$$eval('.tab-nav .tab-btn', els => els.map(e => e.innerText.trim()));
    console.log('Image Tools Tabs:', tabBtns);
    if (!tabBtns.some(t => t.includes('AI Upscaler'))) throw new Error('AI Upscaler tab missing from Image Tools');
    if (!tabBtns.some(t => t.includes('Compressor'))) throw new Error('Compressor tab missing from Image Tools');
    if (!tabBtns.some(t => t.includes('Image Editor'))) throw new Error('Image Editor tab missing from Image Tools');
    if (!tabBtns.some(t => t.includes('AI BG Remover'))) throw new Error('AI BG Remover tab missing from Image Tools');
    console.log('PASS: Image Tools tabs verified (Compressor, Image Editor, AI BG Remover, AI Upscaler).');

    // Click AI Upscaler tab
    await page.click('.tab-nav button[data-tab="upscale"]');
    await wait(300);
    const upscaleActive = await page.$eval('#stage-upscale', el => el.classList.contains('active'));
    console.log('PASS: Clicking AI Upscaler tab activates stage-upscale:', upscaleActive);
    if (!upscaleActive) throw new Error('stage-upscale did not become active');

    // Test deep-link
    await page.goto('http://127.0.0.1:3000/index.html?tab=upscale', { waitUntil: 'networkidle0' });
    await wait(300);
    const deepLinkActive = await page.$eval('#stage-upscale', el => el.classList.contains('active'));
    console.log('PASS: Deep link ?tab=upscale auto-activates stage-upscale:', deepLinkActive);

    // 2. Verify pdf-tools.html
    console.log('\n--- 2. Testing pdf-tools.html ---');
    await page.goto('http://127.0.0.1:3000/pdf-tools.html', { waitUntil: 'networkidle0' });

    // Check navbar has AI OCR
    const pdfNavOcr = await page.$('nav.nav-links a[href="/ai-ocr"]');
    if (!pdfNavOcr) throw new Error('pdf-tools.html: AI OCR link missing in main navbar');
    console.log('PASS: pdf-tools.html navbar contains AI OCR.');

    // Check tabs in PDF Tools
    const pdfTabs = await page.$$eval('.tab-nav .tab-btn', els => els.map(e => e.innerText.trim()));
    console.log('PDF Tools Tabs:', pdfTabs);
    if (pdfTabs.some(t => t.includes('OCR'))) throw new Error('pdf-tools.html: OCR is still in PDF Tools tabs!');
    console.log('PASS: AI OCR successfully removed from PDF Tools tabs.');

    // Check callout to AI OCR
    const callout = await page.$('a[href="/ai-ocr"].btn-primary');
    if (!callout) throw new Error('Callout link to AI OCR missing in pdf-tools.html');
    console.log('PASS: Callout box linking to AI OCR present in pdf-tools.html.');

    // 3. Verify ai-ocr.html
    console.log('\n--- 3. Testing ai-ocr.html ---');
    await page.goto('http://127.0.0.1:3000/ai-ocr.html', { waitUntil: 'networkidle0' });
    const pageTitle = await page.title();
    console.log('ai-ocr.html Title:', pageTitle);
    if (!pageTitle.includes('AI OCR')) throw new Error('ai-ocr.html has incorrect title');

    // Check active nav
    const activeNavText = await page.$eval('nav.nav-links a.active', el => el.innerText.trim());
    console.log('ai-ocr.html Active Nav:', activeNavText);
    if (!activeNavText.includes('AI OCR')) throw new Error('AI OCR is not active nav in ai-ocr.html');

    const dropO = await page.$('#dropO');
    const ocrEngine = await page.$('#ocrEngine');
    const ocrLang = await page.$('#ocrLang');
    const ocrEnhance = await page.$('#ocrEnhance');
    if (!dropO || !ocrEngine || !ocrLang || !ocrEnhance) throw new Error('OCR elements missing on ai-ocr.html');
    console.log('PASS: ai-ocr.html DOM components loaded successfully.');

    // 4. Verify Subpages
    console.log('\n--- 4. Checking other pages ---');
    const subpages = ['/blog.html', '/about.html', '/barcode-tools.html'];
    for (const sp of subpages) {
      await page.goto('http://127.0.0.1:3000' + sp, { waitUntil: 'networkidle0' });
      const spOcr = await page.$('nav.nav-links a[href="/ai-ocr"]');
      if (!spOcr) throw new Error(`AI OCR link missing on ${sp}`);
      const spUpscaler = await page.$('nav.nav-links a[href="/image-upscaler"]');
      if (spUpscaler) throw new Error(`AI Upscaler still in navbar on ${sp}`);
      console.log(`PASS: ${sp} correctly updated.`);
    }

    console.log('\n=== ALL REORGANIZATION TESTS PASSED SUCCESSFULLY! ===');

  } catch (err) {
    console.error('FAIL:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
