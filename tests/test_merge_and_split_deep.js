const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');


const FIXTURES = path.resolve(__dirname, 'fixtures');
const TWO_PAGE_PDF = path.join(FIXTURES, 'two_page.pdf');
const TEN_PAGE_PDF = path.join(FIXTURES, 'ten_page.pdf');
const IMG_PDF = path.join(FIXTURES, 'pdf_with_images.pdf');

(async () => {
  console.log('================================================================');
  console.log('CRITICAL PRIORITY TEST: MERGE PDF & SPLIT PDF');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Handle client-side downloads by hooking window.Pixnivo.downloadBlob
  await page.evaluateOnNewDocument(() => {
    window.__capturedDownloads = [];
    const origDownload = window.Pixnivo ? window.Pixnivo.downloadBlob : null;
    const capture = async (blob, filename) => {
      const buffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      window.__capturedDownloads.push({
        filename,
        size: blob.size,
        type: blob.type,
        bytes
      });
      console.log(`[Captured Download] ${filename} (${blob.size} bytes)`);
    };

    // If Pixnivo is already defined or gets defined
    Object.defineProperty(window, '__interceptDownload', {
      value: capture,
      writable: true
    });
  });

  await page.goto('http://127.0.0.1:8089/pdf-tools.html', { waitUntil: 'networkidle2' });

  // Patch window.Pixnivo.downloadBlob
  await page.evaluate(() => {
    if (window.Pixnivo) {
      window.Pixnivo.downloadBlob = window.__interceptDownload;
    }
  });

  // ==========================================================================
  // 1. MERGE PDF TESTS
  // ==========================================================================
  console.log('>>> [1/2] TESTING MERGE PDF...');
  
  // Navigate to #merge
  await page.evaluate(() => window.location.hash = 'merge');
  await new Promise(r => setTimeout(r, 500));

  const isMergeActive = await page.$eval('#stage-merge', el => el.classList.contains('active'));
  console.log(`  Merge stage visible: ${isMergeActive ? 'YES' : 'NO'}`);

  // Test A: Upload 1 PDF
  console.log('  Test A: Uploading single PDF (two_page.pdf)...');
  const fileInputMerge = await page.$('#fileMerge');
  await fileInputMerge.uploadFile(TWO_PAGE_PDF);
  await new Promise(r => setTimeout(r, 1000));

  const itemsCount1 = await page.$$eval('#listMerge .file-item', items => items.length);
  const mergeBtnDisabled1 = await page.$eval('#btnMerge', btn => btn.disabled);
  console.log(`  Single file in list: ${itemsCount1 === 1 ? 'PASS' : 'FAIL'} (Found: ${itemsCount1})`);
  console.log(`  Merge button enabled for single file: ${!mergeBtnDisabled1 ? 'PASS' : 'FAIL'}`);

  // Test B: Upload second PDF (ten_page.pdf)
  console.log('  Test B: Adding second PDF (ten_page.pdf)...');
  await fileInputMerge.uploadFile(TEN_PAGE_PDF);
  await new Promise(r => setTimeout(r, 1000));

  const itemsCount2 = await page.$$eval('#listMerge .file-item', items => items.length);
  const summaryText = await page.$eval('.pdf-merge-summary', el => el.textContent);
  console.log(`  Two files in list: ${itemsCount2 === 2 ? 'PASS' : 'FAIL'}`);
  console.log(`  Summary shows: "${summaryText.trim().replace(/\s+/g, ' ')}"`);

  // Test C: Change Order of uploaded files
  console.log('  Test C: Changing order of files (swapping)...');
  const firstNameBefore = await page.$$eval('#listMerge .file-item .file-name', els => els[0].textContent);
  await page.evaluate(() => {
    document.querySelector('#listMerge .file-item:first-child .btn-down').click();
  });
  await new Promise(r => setTimeout(r, 800));
  const firstNameAfter = await page.$$eval('#listMerge .file-item .file-name', els => els[0].textContent);
  console.log(`  Order changed: ${firstNameBefore !== firstNameAfter ? 'PASS' : 'FAIL'} (Was: "${firstNameBefore.trim().slice(0, 20)}", Now: "${firstNameAfter.trim().slice(0, 20)}")`);

  // Test D: Remove a file
  console.log('  Test D: Removing a file...');
  await page.evaluate(() => {
    document.querySelector('#listMerge .file-item:first-child .btn-remove').click();
  });
  await new Promise(r => setTimeout(r, 800));
  const itemsAfterRemove = await page.$$eval('#listMerge .file-item', items => items.length);
  console.log(`  File removed: ${itemsAfterRemove === 1 ? 'PASS' : 'FAIL'}`);

  // Test E: Add 3 PDFs of different page counts and perform actual Merge
  console.log('  Test E: Adding 3 files of different page counts and merging:');
  console.log('    1. two_page.pdf (2 pages)');
  console.log('    2. ten_page.pdf (10 pages)');
  console.log('    3. pdf_with_images.pdf (1 page)');
  console.log('    Expected Total: 2 + 10 + 1 = 13 pages.');

  // Clear list by removing remaining
  await page.evaluate(() => {
    document.querySelector('#listMerge .file-item:first-child .btn-remove').click();
  });
  await new Promise(r => setTimeout(r, 500));

  await fileInputMerge.uploadFile(TWO_PAGE_PDF, TEN_PAGE_PDF, IMG_PDF);
  await new Promise(r => setTimeout(r, 2000));

  const itemsCount3 = await page.$$eval('#listMerge .file-item', items => items.length);
  console.log(`  Uploaded files count: ${itemsCount3}`);

  // Clear captured downloads
  await page.evaluate(() => window.__capturedDownloads = []);

  // Click Merge button
  console.log('  Clicking "Merge PDFs" button...');
  await page.evaluate(() => document.getElementById('btnMerge').click());

  // Wait for result to appear
  await page.waitForFunction(() => {
    const res = document.getElementById('resMerge');
    return res && !res.hidden;
  }, { timeout: 15000 });

  const resultTitle = await page.$eval('#resMerge .h', el => el.textContent);
  const resultDetail = await page.$eval('#resMerge .d', el => el.textContent);
  console.log(`  Merge Result: "${resultTitle}" - "${resultDetail}"`);

  // Inspect the generated output bytes
  const capturedDownloads = await page.evaluate(() => window.__capturedDownloads);
  if (!capturedDownloads || !capturedDownloads.length) {
    throw new Error('No merged file was captured by the download handler!');
  }

  const mergedFile = capturedDownloads[capturedDownloads.length - 1];
  console.log(`  Captured File: ${mergedFile.filename} (${mergedFile.size} bytes)`);

  const actualPageCount = await page.evaluate(async (bytes) => {
    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.load(new Uint8Array(bytes));
    return doc.getPageCount();
  }, mergedFile.bytes);
  console.log(`  Merged Output Page Count: ${actualPageCount}`);

  if (actualPageCount === 13) {
    console.log('  >>> MERGE PDF VERIFICATION: 100% PASS (EXACTLY 13 PAGES VERIFIED)\n');
  } else {
    throw new Error(`Expected 13 pages in merged output, but got ${actualPageCount}`);
  }

  // ==========================================================================
  // 2. SPLIT PDF TESTS
  // ==========================================================================
  console.log('>>> [2/2] TESTING SPLIT PDF...');

  // Navigate to #split
  await page.evaluate(() => window.location.hash = 'split');
  await new Promise(r => setTimeout(r, 500));

  const isSplitActive = await page.$eval('#stage-split', el => el.classList.contains('active'));
  console.log(`  Split stage visible: ${isSplitActive ? 'YES' : 'NO'}`);

  const fileInputSplit = await page.$('#fileSplit');

  // Test A: Split a two-page PDF (Extract all pages to ZIP)
  console.log('  Test A: Split a two-page PDF into separate files (empty range -> ZIP)...');
  await fileInputSplit.uploadFile(TWO_PAGE_PDF);
  await new Promise(r => setTimeout(r, 1000));

  const pageCountText = await page.$eval('#splitPageCount', el => el.textContent);
  console.log(`  Split file info: "${pageCountText}"`);

  // Clear captured
  await page.evaluate(() => {
    document.getElementById('splitRangeInput').value = '';
    window.__capturedDownloads = [];
  });

  await page.evaluate(() => document.getElementById('btnSplit').click());
  await page.waitForFunction(() => {
    const res = document.getElementById('resSplit');
    return res && !res.hidden;
  }, { timeout: 15000 });


  const downloadsZip = await page.evaluate(() => window.__capturedDownloads);
  const zipFile = downloadsZip[downloadsZip.length - 1];
  console.log(`  Captured ZIP: ${zipFile.filename} (${zipFile.size} bytes)`);

  // Parse ZIP in page using JSZip
  const zipEntries = await page.evaluate(async (bytes) => {
    const zip = await window.JSZip.loadAsync(new Uint8Array(bytes));
    return Object.keys(zip.files);
  }, zipFile.bytes);
  console.log(`  ZIP Entries: ${zipEntries.join(', ')}`);
  if (zipEntries.length === 2 && zipEntries.includes('page-1.pdf') && zipEntries.includes('page-2.pdf')) {
    console.log('  >>> TWO-PAGE SPLIT TO ZIP: PASS');
  } else {
    throw new Error(`Expected 2 pages in ZIP, got: ${zipEntries.join(', ')}`);
  }

  // Test B: Multi-page PDF (ten_page.pdf) - Extract custom ranges: "2-4, 7"
  console.log('  Test B: Split a multi-page PDF (ten_page.pdf) with custom range "2-4, 7"...');
  await fileInputSplit.uploadFile(TEN_PAGE_PDF);
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    document.getElementById('splitRangeInput').value = '2-4, 7';
    window.__capturedDownloads = [];
  });

  await page.evaluate(() => document.getElementById('btnSplit').click());
  await page.waitForFunction(() => {
    const res = document.getElementById('resSplit');
    return res && !res.hidden;
  }, { timeout: 15000 });


  const customDownloads = await page.evaluate(() => window.__capturedDownloads);
  const customExtract = customDownloads[customDownloads.length - 1];
  const customPageCount = await page.evaluate(async (bytes) => {
    const doc = await window.PDFLib.PDFDocument.load(new Uint8Array(bytes));
    return doc.getPageCount();
  }, customExtract.bytes);
  console.log(`  Captured Extract: ${customExtract.filename} (${customExtract.size} bytes)`);
  console.log(`  Extracted Page Count: ${customPageCount} (Expected: 4 pages)`);

  if (customPageCount === 4) {
    console.log('  >>> CUSTOM RANGE EXTRACTION: PASS');
  } else {
    throw new Error(`Expected 4 pages, got ${customPageCount}`);
  }

  // Test C: First and Last page selection: "1, 10"
  console.log('  Test C: First and last page selection "1, 10"...');
  await page.evaluate(() => {
    document.getElementById('splitRangeInput').value = '1, 10';
    window.__capturedDownloads = [];
  });

  await page.evaluate(() => document.getElementById('btnSplit').click());
  await page.waitForFunction(() => {
    const res = document.getElementById('resSplit');
    return res && !res.hidden;
  }, { timeout: 15000 });


  const edgeDownloads = await page.evaluate(() => window.__capturedDownloads);
  const edgePageCount = await page.evaluate(async (bytes) => {
    const doc = await window.PDFLib.PDFDocument.load(new Uint8Array(bytes));
    return doc.getPageCount();
  }, edgeDownloads[edgeDownloads.length - 1].bytes);
  console.log(`  Extracted First & Last Count: ${edgePageCount} (Expected: 2 pages)`);

  if (edgePageCount === 2) {
    console.log('  >>> FIRST & LAST PAGE SELECTION: PASS');
  } else {
    throw new Error(`Expected 2 pages, got ${edgePageCount}`);
  }

  // Test D: Individual page extraction: "5"
  console.log('  Test D: Single individual page extraction "5"...');
  await page.evaluate(() => {
    document.getElementById('splitRangeInput').value = '5';
    window.__capturedDownloads = [];
  });

  await page.evaluate(() => document.getElementById('btnSplit').click());
  await page.waitForFunction(() => {
    const res = document.getElementById('resSplit');
    return res && !res.hidden;
  }, { timeout: 15000 });


  const singleDownloads = await page.evaluate(() => window.__capturedDownloads);
  const singlePageCount = await page.evaluate(async (bytes) => {
    const doc = await window.PDFLib.PDFDocument.load(new Uint8Array(bytes));
    return doc.getPageCount();
  }, singleDownloads[singleDownloads.length - 1].bytes);
  console.log(`  Single Page Extract Count: ${singlePageCount} (Expected: 1 page)`);
  console.log(`  Filename: ${singleDownloads[singleDownloads.length - 1].filename}`);

  if (singlePageCount === 1) {
    console.log('  >>> SINGLE PAGE EXTRACTION: PASS');
  } else {
    throw new Error(`Expected 1 page, got ${singlePageCount}`);
  }

  // Test E: Invalid page range: "99" (Out of bounds)
  console.log('  Test E: Testing invalid page range "99"...');
  await page.evaluate(() => {
    document.getElementById('splitRangeInput').value = '99';
    window.__capturedDownloads = [];
  });

  await page.click('#btnSplit');
  await new Promise(r => setTimeout(r, 1000));

  const invalidDownloads = await page.evaluate(() => window.__capturedDownloads);
  console.log(`  Downloads triggered on invalid range: ${invalidDownloads.length} (Expected: 0)`);
  if (invalidDownloads.length === 0) {
    console.log('  >>> INVALID RANGE SAFELY REJECTED: PASS');
  } else {
    throw new Error('Invalid range triggered download unexpectedly!');
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('>>> ALL MERGE PDF AND SPLIT PDF TESTS COMPLETED SUCCESSFULLY! <<<');
  console.log('================================================================');
})();
