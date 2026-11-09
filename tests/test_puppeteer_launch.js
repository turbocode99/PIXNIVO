const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8089/pdf-tools.html', { waitUntil: 'networkidle2' });
    const title = await page.title();
    console.log('Page Title:', title);
    const cardCount = await page.$$eval('.pdf-tool-card', cards => cards.length);
    console.log('PDF Tool Cards Count:', cardCount);
    await browser.close();
    console.log('Puppeteer test finished successfully!');
  } catch (err) {
    console.error('Puppeteer error:', err);
    process.exit(1);
  }
})();

