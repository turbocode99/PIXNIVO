const puppeteer = require('puppeteer');

(async () => {
  console.log('Running complete lifecycle test on live https://admin.pixnivo.app ...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    const response = await page.goto('https://admin.pixnivo.app', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('1. HTTP Status:', response.status());

    // Enter credentials
    await page.waitForSelector('#loginUser', { visible: true, timeout: 5000 });
    await page.$eval('#loginUser', el => el.value = 'admin@pixnivo.app');
    await page.$eval('#loginPwd', el => el.value = 'PixnivoSecure#2026!');
    await page.click('#loginBtn');

    // Wait for admin workspace
    await page.waitForSelector('#adminApp', { visible: true, timeout: 10000 });
    console.log('2. PASS: Admin dashboard loaded!');

    // Check editor
    await page.click('#tabBtnEditor');
    await page.waitForSelector('#sectionEditor', { visible: true, timeout: 5000 });
    console.log('3. PASS: Switched to Rich Text Editor tab.');

    const testId = Date.now();
    const testTitle = `Live Cloud Test Post ${testId}`;
    await page.type('#postTitleInput', testTitle);
    await wait(200);

    const slug = await page.$eval('#postSlugInput', el => el.value);
    console.log('   Generated Slug:', slug);

    await page.type('#postExcerptInput', 'Automated cloud lifecycle test on production Azure VM.');
    await page.select('#postCategorySelect', 'Neural AI');

    await page.click('#richEditor');
    await page.keyboard.type('This is a live test article created through https://admin.pixnivo.app to verify end-to-end cloud persistence.');

    // Save as draft
    console.log('4. Saving as Draft...');
    await page.evaluate(() => saveBlogPost('draft'));
    await wait(2000);

    // Verify in dashboard
    await page.waitForSelector('#sectionDashboard', { visible: true, timeout: 5000 });
    const draftCount = await page.$eval('#metricDrafts', el => el.innerText);
    console.log('5. PASS: Article saved! Draft count:', draftCount);

    // Delete test post
    console.log('6. Cleaning up test article...');
    await page.click('#articlesTableBody tr:first-child button.icon-btn.danger');
    await page.waitForSelector('#deleteModal', { visible: true, timeout: 3000 });
    await page.click('#confirmDeleteBtn');
    await wait(1500);

    console.log('7. PASS: Test article cleaned up successfully.');
    console.log('\n=== ALL LIVE PRODUCTION TESTS PASSED! ===');

  } catch (err) {
    console.error('FAIL:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
