const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing Menu Reorganization on Live Production (https://pixnivo.app)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Verify live homepage
    console.log('1. Navigating to https://pixnivo.app ...');
    const resHome = await page.goto('https://pixnivo.app', { waitUntil: 'networkidle2' });
    console.log('   HTTP Status:', resHome.status());

    // Check navbar contains AI OCR
    const navOcr = await page.$('nav.nav-links a[href="/ai-ocr"]');
    if (!navOcr) throw new Error('Live navbar missing AI OCR');
    console.log('   PASS: Live navbar has AI OCR link.');

    // Check Image Tools tabs
    const tabBtns = await page.$$eval('.tab-nav .tab-btn', els => els.map(e => e.innerText.trim()));
    console.log('   Live Image Tools tabs:', tabBtns);
    if (!tabBtns.some(t => t.includes('AI Upscaler'))) throw new Error('Live tabs missing AI Upscaler');

    // Click AI Upscaler tab
    await page.click('.tab-nav button[data-tab="upscale"]');
    await wait(300);
    const upscaleActive = await page.$eval('#stage-upscale', el => el.classList.contains('active'));
    console.log('   PASS: Live clicking AI Upscaler activates stage-upscale:', upscaleActive);

    // 2. Verify live PDF Tools
    console.log('2. Navigating to https://pixnivo.app/pdf-tools ...');
    const resPdf = await page.goto('https://pixnivo.app/pdf-tools', { waitUntil: 'networkidle2' });
    console.log('   HTTP Status:', resPdf.status());
    const pdfTabs = await page.$$eval('.tab-nav .tab-btn', els => els.map(e => e.innerText.trim()));
    console.log('   Live PDF Tools tabs:', pdfTabs);
    if (pdfTabs.some(t => t.includes('OCR'))) throw new Error('Live PDF Tools still has OCR tab!');
    console.log('   PASS: AI OCR successfully removed from live PDF Tools tabs.');

    // 3. Verify live AI OCR Studio
    console.log('3. Navigating to https://pixnivo.app/ai-ocr ...');
    const resOcr = await page.goto('https://pixnivo.app/ai-ocr', { waitUntil: 'networkidle2' });
    console.log('   HTTP Status:', resOcr.status());
    const ocrTitle = await page.title();
    console.log('   Live AI OCR Page Title:', ocrTitle);
    const dropzone = await page.$('#dropO');
    if (!dropzone) throw new Error('Dropzone missing on live AI OCR page');
    console.log('   PASS: Live AI OCR Studio loaded and active!');

    console.log('\n=== ALL LIVE PRODUCTION TESTS PASSED! ===');

  } catch (err) {
    console.error('FAIL on live test:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
