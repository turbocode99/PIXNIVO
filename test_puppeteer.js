const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('https://pixnivo.app/barcode-tools.html', {waitUntil: 'networkidle0'});
  
  await page.type('#bcData', '1234567890\n9876543210');
  console.log('Typed data...');
  
  await page.click('#btnGenerate');
  console.log('Clicked generate...');
  
  await page.waitForTimeout(2000);
  console.log('Waiting...');
  
  await browser.close();
})();
