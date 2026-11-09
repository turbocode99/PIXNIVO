const puppeteer = require('puppeteer');

const VIEWPORTS = [
  { name: 'Small Android Phone', width: 360, height: 800 },
  { name: 'Modern Smartphone', width: 390, height: 844 },
  { name: 'Large Smartphone', width: 430, height: 932 },
  { name: 'Tablet (Portrait)', width: 768, height: 1024 },
  { name: 'Large Tablet', width: 820, height: 1180 },
  { name: 'Small Laptop / Tablet Landscape', width: 1024, height: 768 },
  { name: 'Standard Laptop', width: 1366, height: 768 },
  { name: 'Desktop Monitor', width: 1440, height: 900 },
  { name: 'Large PC Monitor (1080p)', width: 1920, height: 1080 },
];

(async () => {
  console.log('================================================================');
  console.log('PIXNIVO RESPONSIVE & CROSS-DEVICE COMPREHENSIVE AUDIT');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let allPass = true;

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:8089/pdf-tools.html', { waitUntil: 'networkidle2' });

    // 1. Check horizontal overflow
    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    // 2. Count visible cards
    const visibleCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.pdf-tool-card'));
      return cards.map(c => {
        const style = window.getComputedStyle(c);
        const rect = c.getBoundingClientRect();
        return {
          tool: c.dataset.tool,
          display: style.display,
          visibility: style.visibility,
          width: rect.width,
          height: rect.height,
          isVisible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        };
      });
    });

    const visibleCount = visibleCards.filter(c => c.isVisible).length;
    const isPassing = !overflow.hasHorizontalOverflow && visibleCount === 32;

    if (!isPassing) allPass = false;

    console.log(`Viewport: [${vp.width}x${vp.height}] - ${vp.name}`);
    console.log(`  Visible Tools: ${visibleCount} / 32`);
    console.log(`  Horizontal Overflow: ${overflow.hasHorizontalOverflow ? 'YES (FAIL)' : 'NO (CLEAN)'} (Scroll: ${overflow.scrollWidth}px vs Window: ${overflow.innerWidth}px)`);
    console.log(`  Status: ${isPassing ? 'PASS' : 'FAIL'}\n`);
  }

  await browser.close();
  if (allPass) {
    console.log('>>> ALL 9 VIEWPORTS PASSED: ALL 32 TOOLS 100% VISIBLE WITH ZERO HORIZONTAL OVERFLOW!');
    process.exit(0);
  } else {
    console.error('>>> RESPONSIVE AUDIT FAILED ON ONE OR MORE VIEWPORTS.');
    process.exit(1);
  }
})();

