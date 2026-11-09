const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing Microsoft Edge compatibility...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8089/pdf-tools.html', { waitUntil: 'networkidle2' });
  
  const title = await page.title();
  const cardCount = await page.evaluate(() => document.querySelectorAll('.pdf-tool-card').length);
  const stagesCount = await page.evaluate(() => document.querySelectorAll('.pdf-workspace-view').length);

  console.log('Edge Title:', title);
  console.log('Edge Tool Cards Count:', cardCount);
  console.log('Edge Stages Count:', stagesCount);

  if (cardCount === 32 && stagesCount === 32) {
    console.log('>>> EDGE COMPATIBILITY PASS: ALL 32 TOOLS & STAGES DETECTED!');
    await browser.close();
    process.exit(0);
  } else {
    console.error('>>> EDGE COMPATIBILITY FAIL!');
    await browser.close();
    process.exit(1);
  }
})();

