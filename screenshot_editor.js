const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('https://admin.pixnivo.app', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#loginUser', { visible: true });
    await page.$eval('#loginUser', el => el.value = 'admin@pixnivo.app');
    await page.$eval('#loginPwd', el => el.value = 'PixnivoSecure#2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#adminApp', { visible: true });

    // Wait for table to load
    await page.waitForSelector('#articlesTableBody tr', { visible: true });
    // Open editor for the first article
    await page.click('#articlesTableBody tr:first-child button.icon-btn:first-child');
    await page.waitForSelector('#sectionEditor', { visible: true });
    await wait(800);

    await page.screenshot({ path: 'live_admin_editor.png' });
    console.log('Saved live_admin_editor.png');
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
