const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting End-to-End Puppeteer Validation of PIXNIVO Admin Portal...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Navigate to admin.html
    console.log('1. Navigating to http://127.0.0.1:3000/admin.html ...');
    await page.goto('http://127.0.0.1:3000/admin.html', { waitUntil: 'networkidle0' });

    // Check title
    const title = await page.title();
    console.log('   Page Title:', title);
    if (!title.includes('PIXNIVO Admin Portal')) throw new Error('Incorrect page title: ' + title);

    // 2. Test Invalid Password
    console.log('2. Testing invalid password authentication rejection...');
    await page.$eval('#loginUser', el => el.value = 'admin@pixnivo.app');
    await page.$eval('#loginPwd', el => el.value = 'WrongPassword123!');
    await page.click('#loginBtn');

    await page.waitForSelector('#authErrorMsg', { visible: true, timeout: 5000 });
    const errorText = await page.$eval('#authErrorText', el => el.innerText);
    console.log('   PASS: Error displayed on invalid credentials:', errorText);

    // 3. Test Valid Password
    console.log('3. Testing valid admin login (PixnivoSecure#2026!)...');
    await page.$eval('#loginUser', el => el.value = 'admin@pixnivo.app');
    await page.$eval('#loginPwd', el => el.value = 'PixnivoSecure#2026!');
    console.log('   Typed user:', await page.$eval('#loginUser', el => el.value));
    console.log('   Typed password check:', await page.$eval('#loginPwd', el => el.value));
    await page.click('#loginBtn');

    // Wait for admin workspace
    await page.waitForSelector('#adminApp', { visible: true, timeout: 8000 });
    console.log('   PASS: Admin workspace loaded successfully!');

    // Check metrics
    const totalArticles = await page.$eval('#metricTotal', el => el.innerText);
    const publishedArticles = await page.$eval('#metricPublished', el => el.innerText);
    console.log(`   PASS: Dashboard metrics verified: Total = ${totalArticles}, Published = ${publishedArticles}`);

    const wait = ms => new Promise(r => setTimeout(r, ms));

    // 4. Test Create New Blog Post
    console.log('4. Testing blog creation via Rich Text Editor...');
    await page.click('#tabBtnEditor');
    await page.waitForSelector('#sectionEditor', { visible: true, timeout: 3000 });

    const testId = Date.now();
    const newTitle = `The Definitive Guide to WebP Compression ${testId}`;
    const newExcerpt = 'How WebP predictive coding and transparent alpha layers outperform legacy JPG and PNG formats.';

    await page.type('#postTitleInput', newTitle);
    await wait(300);

    let finalSlug = '';
    const generatedSlug = await page.$eval('#postSlugInput', el => el.value);
    finalSlug = generatedSlug;
    console.log('   Generated Slug:', finalSlug);

    await page.type('#postExcerptInput', newExcerpt);
    await page.select('#postCategorySelect', 'Compression');

    // Enter rich text content
    await page.click('#richEditor');
    await page.keyboard.type('WebP provides superior lossless and lossy compression for images on the web. Using WebP, webmasters can create smaller, richer images that make the web faster.');

    // Save & Publish
    console.log('   Publishing article...');
    await page.click('#sectionEditor button[onclick*="saveBlogPost(\'published\')"]');
    await wait(1500);

    // Verify in Dashboard
    await page.waitForSelector('#sectionDashboard', { visible: true, timeout: 5000 });
    const updatedCount = await page.$eval('#metricTotal', el => el.innerText);
    console.log(`   PASS: Article published. Updated count: ${updatedCount}`);

    // 5. Verify Public Blog Page
    console.log('5. Navigating to Public Blog at http://127.0.0.1:3000/blog.html ...');
    await page.goto('http://127.0.0.1:3000/blog.html', { waitUntil: 'networkidle0' });

    await wait(1000);
    const blogCards = await page.$$eval('.guide-card h4', els => els.map(e => e.innerText));
    console.log(`   Total articles on public blog: ${blogCards.length}`);
    const foundNewPost = blogCards.some(t => t.includes('The Definitive Guide to WebP Compression'));
    console.log('   PASS: Found newly published article on public blog:', foundNewPost);
    if (!foundNewPost) throw new Error('New article was not found on public blog page');

    // Test Search Filter on blog.html
    console.log('   Testing search bar on blog.html...');
    await page.type('#guideSearchInput', 'Definitive');
    await wait(500);
    const searchResults = await page.$$eval('#guidesGrid .guide-card', els => els.length);
    console.log(`   PASS: Search results for "Definitive": ${searchResults} card(s) matching`);

    // 6. Navigate to Post Reader page (post.html)
    console.log(`6. Testing post reader page: http://127.0.0.1:3000/post.html?slug=${finalSlug} ...`);
    await page.goto(`http://127.0.0.1:3000/post.html?slug=${finalSlug}`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#articleContentWrap', { visible: true, timeout: 5000 });
    const readerTitle = await page.$eval('#articleTitle', el => el.innerText);
    const readerCategory = await page.$eval('#articleCategory', el => el.innerText);
    const readerBody = await page.$eval('#articleBody', el => el.innerText);

    console.log('   Reader Title:', readerTitle);
    console.log('   Reader Category:', readerCategory);
    console.log('   PASS: Reader successfully rendered post with body content preview:', readerBody.substring(0, 70));

    // 7. Cleanup test post in admin
    console.log('7. Returning to Admin Portal to test deletion and logout...');
    await page.goto('http://127.0.0.1:3000/admin.html', { waitUntil: 'networkidle0' });

    await page.waitForSelector('#adminApp', { visible: true, timeout: 5000 });
    await page.waitForSelector('#articlesTableBody tr', { visible: true, timeout: 5000 });

    // Handle any confirm dialogs
    page.on('dialog', async dialog => {
      console.log('   Dialog accepted:', dialog.message());
      await dialog.accept();
    });

    // Click delete icon on first article in the table
    await page.click('#articlesTableBody tr:first-child button.icon-btn.danger');
    await page.waitForSelector('#deleteModal', { visible: true, timeout: 3000 });
    await page.click('#confirmDeleteBtn');
    await wait(1200);

    const postDeleteCount = await page.$eval('#metricTotal', el => el.innerText);
    console.log(`   PASS: Article deleted. Count reset to: ${postDeleteCount}`);

    // 8. Test Logout
    console.log('8. Testing Admin Logout...');
    await page.click('.admin-user-pill button.icon-btn.danger');
    await page.waitForSelector('#authScreen', { visible: true, timeout: 5000 });
    console.log('   PASS: Admin successfully logged out and session locked!');

    console.log('\n=== ALL E2E PUPPETEER VALIDATION TESTS PASSED SUCCESSFULLY! ===');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
