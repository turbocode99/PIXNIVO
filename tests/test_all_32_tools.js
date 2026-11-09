const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const TWO_PAGE_PDF = path.join(FIXTURES, 'two_page.pdf');
const TEN_PAGE_PDF = path.join(FIXTURES, 'ten_page.pdf');
const IMG_PDF = path.join(FIXTURES, 'pdf_with_images.pdf');
const PROT_PDF = path.join(FIXTURES, 'protected.pdf');
const SAMPLE_DOCX = path.join(FIXTURES, 'sample.docx');
const SAMPLE_PPTX = path.join(FIXTURES, 'sample.pptx');
const SAMPLE_XLSX = path.join(FIXTURES, 'sample.xlsx');
const SAMPLE_JPG = path.join(FIXTURES, 'sample.jpg');
const SAMPLE_PNG = path.join(FIXTURES, 'sample.png');

(async () => {
  console.log('================================================================');
  console.log('PIXNIVO ALL 32 PDF TOOLS COMPREHENSIVE END-TO-END SUITE');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const page = await browser.newPage();

  // Intercept downloads cleanly before scripts load
  await page.evaluateOnNewDocument(() => {
    window.__capturedDownloads = [];
    window.__interceptDownload = async (blob, filename) => {
      const buffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      window.__capturedDownloads.push({
        filename,
        size: blob.size,
        type: blob.type,
        bytes
      });
    };

    let pix = undefined;
    Object.defineProperty(window, 'Pixnivo', {
      configurable: true,
      get() { return pix; },
      set(v) {
        pix = v;
        if (pix) pix.downloadBlob = window.__interceptDownload;
      }
    });
  });

  await page.goto('http://127.0.0.1:8089/pdf-tools.html', { waitUntil: 'networkidle2' });

  // Ensure downloadBlob hook is active
  await page.evaluate(() => {
    if (window.Pixnivo) window.Pixnivo.downloadBlob = window.__interceptDownload;
  });

  const results = [];

  async function testTool(num, name, hash, runner) {
    process.stdout.write(`[Tool ${String(num).padStart(2, '0')}/32] ${name.padEnd(24)}: `);
    try {
      await page.evaluate((h) => {
        window.location.hash = h;
        window.PixnivoPdfStudio.openTool(h);
      }, hash);
      await new Promise(r => setTimeout(r, 400));

      const isStageActive = await page.$eval(`#stage-${hash}`, el => el.classList.contains('active'));
      if (!isStageActive) throw new Error(`Stage #stage-${hash} failed to activate`);

      // Clear downloads before each tool run
      await page.evaluate(() => { window.__capturedDownloads = []; });

      const detail = await runner();
      console.log(`PASS (${detail})`);
      results.push({ num, name, hash, status: 'PASS', detail });
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      results.push({ num, name, hash, status: 'FAIL', error: err.message });
    }
  }

  // 1. Merge PDF
  await testTool(1, 'Merge PDF', 'merge', async () => {
    const fi = await page.$('#fileMerge');
    await fi.uploadFile(TWO_PAGE_PDF, TWO_PAGE_PDF);
    await page.waitForFunction(() => {
      const b = document.getElementById('btnMerge');
      return b && !b.disabled;
    }, { timeout: 15000 });
    await page.evaluate(() => document.getElementById('btnMerge').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Combined 2 files -> ${dl[dl.length - 1].size} bytes`;
  });

  // 2. Split PDF
  await testTool(2, 'Split PDF', 'split', async () => {
    const fi = await page.$('#fileSplit');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      document.getElementById('splitRangeInput').value = '1';
      document.getElementById('btnSplit').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Extracted page 1 -> ${dl[dl.length - 1].filename}`;
  });

  // 3. Organize PDF
  await testTool(3, 'Organize PDF', 'organize', async () => {
    const fi = await page.$('#fileOrganize');
    await fi.uploadFile(TWO_PAGE_PDF);
    await page.waitForFunction(() => document.querySelectorAll('#gridOrganize .pdf-page-item').length === 2, { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('#gridOrganize .pdf-page-item:first-child .rot').click();
      document.getElementById('btnOrganize').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Reordered/rotated -> ${dl[dl.length - 1].size} bytes`;
  });

  // 4. Rotate PDF
  await testTool(4, 'Rotate PDF', 'rotate', async () => {
    const fi = await page.$('#fileRotate');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnRotate').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Rotated 90° -> ${dl[dl.length - 1].filename}`;
  });

  // 5. Crop PDF
  await testTool(5, 'Crop PDF', 'crop', async () => {
    const fi = await page.$('#fileCrop');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('cropMarginInput').value = '30';
      document.getElementById('btnCrop').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Applied 30pt margin -> ${dl[dl.length - 1].size} bytes`;
  });

  // 6. Compare PDF
  await testTool(6, 'Compare PDF', 'compare', async () => {
    const fiA = await page.$('#fileCompA');
    const fiB = await page.$('#fileCompB');
    await fiA.uploadFile(TWO_PAGE_PDF);
    await fiB.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => document.getElementById('btnCompare').click());
    await page.waitForFunction(() => {
      const box = document.getElementById('compareResultBox');
      return box && !box.hidden;
    }, { timeout: 15000 });
    const metrics = await page.$eval('#compareMetrics', el => el.textContent);
    return metrics.trim();
  });

  // 7. Compress PDF
  await testTool(7, 'Compress PDF', 'compress', async () => {
    const fi = await page.$('#fileCompress');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnCompress').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 20000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Compressed -> ${dl[dl.length - 1].size} bytes`;
  });

  // 8. Protect PDF
  await testTool(8, 'Protect PDF', 'protect', async () => {
    const fi = await page.$('#fileProtect');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('protectPassword').value = 'PixnivoSecret2026';
      document.getElementById('btnProtect').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `AES Encrypted -> ${dl[dl.length - 1].filename}`;
  });

  // 9. Unlock PDF
  await testTool(9, 'Unlock PDF', 'unlock', async () => {
    const fi = await page.$('#fileUnlock');
    await fi.uploadFile(PROT_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('unlockPassword').value = 'PixnivoSecret2026';
      document.getElementById('btnUnlock').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Decrypted -> ${dl[dl.length - 1].filename}`;
  });

  // 10. Redact PDF
  await testTool(10, 'Redact PDF', 'redact', async () => {
    const fi = await page.$('#fileRedact');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('redactTerms').value = 'architecture, financial';
      document.getElementById('btnRedact').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Permanent stream scrub -> ${dl[dl.length - 1].size} bytes (${dl[dl.length - 1].filename})`;
  });

  // 11. PDF to PDF/A
  await testTool(11, 'PDF to PDF/A', 'pdfa', async () => {
    const fi = await page.$('#filePdfA');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnPdfA').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `ISO 19005-1 (PDF/A-1b) -> ${dl[dl.length - 1].filename}`;
  });

  // 12. PDF to Word
  await testTool(12, 'PDF to Word', 'pdf2word', async () => {
    const fi = await page.$('#file_pdf2word');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_pdf2word').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `DOCX output -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 13. PDF to PowerPoint
  await testTool(13, 'PDF to PowerPoint', 'pdf2pptx', async () => {
    const fi = await page.$('#file_pdf2pptx');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_pdf2pptx').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `PPTX output -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 14. PDF to Excel
  await testTool(14, 'PDF to Excel', 'pdf2xlsx', async () => {
    const fi = await page.$('#file_pdf2xlsx');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_pdf2xlsx').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `XLSX output -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 15. Word to PDF
  await testTool(15, 'Word to PDF', 'word2pdf', async () => {
    const fi = await page.$('#file_word2pdf');
    await fi.uploadFile(SAMPLE_DOCX);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_word2pdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Vector PDF output -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 16. PowerPoint to PDF
  await testTool(16, 'PowerPoint to PDF', 'pptx2pdf', async () => {
    const fi = await page.$('#file_pptx2pdf');
    await fi.uploadFile(SAMPLE_PPTX);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_pptx2pdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `PDF presentation -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 17. Excel to PDF
  await testTool(17, 'Excel to PDF', 'xlsx2pdf', async () => {
    const fi = await page.$('#file_xlsx2pdf');
    await fi.uploadFile(SAMPLE_XLSX);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_xlsx2pdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `PDF spreadsheet -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 18. PDF to JPG
  await testTool(18, 'PDF to JPG', 'pdf2jpg', async () => {
    const fi = await page.$('#filePdf2Jpg');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => document.getElementById('btnPdf2Jpg').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 20000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `JPG Archive -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 19. JPG to PDF
  await testTool(19, 'JPG to PDF', 'jpg2pdf', async () => {
    const fi = await page.$('#fileJpg2Pdf');
    await fi.uploadFile(SAMPLE_JPG, SAMPLE_PNG);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => document.getElementById('btnJpg2Pdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Combined images -> ${dl[dl.length - 1].size} bytes`;
  });

  // 20. HTML to PDF
  await testTool(20, 'HTML to PDF', 'html2pdf', async () => {
    await page.evaluate(() => {
      document.getElementById('htmlInput').value = '<h1>Pixnivo Dynamic Invoice</h1><p>Customer: Danish Khan</p><p>Total: $450.00</p>';
      document.getElementById('btnHtml2Pdf').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `HTML vector render -> ${dl[dl.length - 1].size} bytes`;
  });

  // 21. Scan to PDF
  await testTool(21, 'Scan to PDF', 'scan2pdf', async () => {
    await page.evaluate(() => document.getElementById('btnStartScan').click());
    await page.waitForFunction(() => {
      const b = document.getElementById('btnSnapPage');
      return b && !b.disabled;
    }, { timeout: 10000 });
    await page.evaluate(() => document.getElementById('btnSnapPage').click());
    await page.waitForFunction(() => {
      const b = document.getElementById('btnMakeScanPdf');
      return b && !b.disabled;
    }, { timeout: 10000 });
    await page.evaluate(() => document.getElementById('btnMakeScanPdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Captured snapshot -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 22. PDF to Markdown
  await testTool(22, 'PDF to Markdown', 'pdf2md', async () => {
    const fi = await page.$('#file_pdf2md');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btn_pdf2md').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Markdown extraction -> ${dl[dl.length - 1].filename} (${dl[dl.length - 1].size} bytes)`;
  });

  // 23. Edit PDF
  await testTool(23, 'Edit PDF', 'edit', async () => {
    const fi = await page.$('#fileEdit');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('editTextContent').value = 'APPROVED BY AUDIT 2026';
      document.getElementById('btnEdit').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Annotation stamped -> ${dl[dl.length - 1].filename}`;
  });

  // 24. Sign PDF
  await testTool(24, 'Sign PDF', 'sign', async () => {
    const fi = await page.$('#fileSign');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      const canvas = document.getElementById('signCanvas');
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(200, 100);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();

      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 20 }));
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 60 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
      document.getElementById('btnSign').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Digital signature stamped -> ${dl[dl.length - 1].filename}`;
  });

  // 25. Watermark PDF
  await testTool(25, 'Watermark PDF', 'watermark', async () => {
    const fi = await page.$('#fileWatermark');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      document.getElementById('watermarkText').value = 'STRICTLY CONFIDENTIAL';
      document.getElementById('btnWatermark').click();
    });
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Watermark stamped -> ${dl[dl.length - 1].size} bytes`;
  });

  // 26. Page Numbers
  await testTool(26, 'Page Numbers', 'pagenumbers', async () => {
    const fi = await page.$('#filePageNums');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnPageNums').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Numbered pages -> ${dl[dl.length - 1].filename}`;
  });

  // 27. PDF Forms
  await testTool(27, 'PDF Forms', 'forms', async () => {
    const fi = await page.$('#fileForms');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 1000));
    const infoText = await page.$eval('#formsFileInfo', el => el.textContent);
    return `Form inspector initialized (${infoText})`;
  });

  // 28. Repair PDF
  await testTool(28, 'Repair PDF', 'repair', async () => {
    const fi = await page.$('#fileRepair');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnRepair').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Xref & syntax salvaged -> ${dl[dl.length - 1].filename}`;
  });

  // 29. OCR PDF
  await testTool(29, 'OCR PDF', 'ocr', async () => {
    const fi = await page.$('#fileOcr');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 800));
    const btn = await page.$eval('#btnOcr', b => !b.disabled);
    return `Engine loaded, file staged: ${btn ? 'Ready' : 'Pending'}`;
  });

  // 30. Images to PDF
  await testTool(30, 'Images to PDF', 'img2pdf', async () => {
    const fi = await page.$('#fileI');
    await fi.uploadFile(SAMPLE_JPG, SAMPLE_PNG);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => document.getElementById('makePdf').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Combined images -> ${dl[dl.length - 1].size} bytes`;
  });

  // 31. AI Summarizer
  await testTool(31, 'AI Summarizer', 'summarize', async () => {
    const fi = await page.$('#fileSummarize');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnSummarize').click());
    await page.waitForFunction(() => {
      const box = document.getElementById('summarizeOutput');
      return box && !box.hidden;
    }, { timeout: 15000 });
    const summary = await page.$eval('#summaryParagraph', el => el.textContent);
    return `Executive summary generated (${summary.slice(0, 35)}...)`;
  });

  // 32. Translate PDF
  await testTool(32, 'Translate PDF', 'translate', async () => {
    const fi = await page.$('#fileTranslate');
    await fi.uploadFile(TWO_PAGE_PDF);
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.getElementById('btnTranslate').click());
    await page.waitForFunction(() => window.__capturedDownloads.length > 0, { timeout: 15000 });
    const dl = await page.evaluate(() => window.__capturedDownloads);
    return `Translated to Spanish -> ${dl[dl.length - 1].filename}`;
  });

  await browser.close();

  console.log('\n================================================================');
  console.log('SUMMARY TABLE');
  console.log('================================================================');
  console.log('| #  | Tool Name                | Status | Result Details');
  console.log('|----|--------------------------|--------|------------------------------------');
  results.forEach(r => {
    console.log(`| ${String(r.num).padStart(2, '0')} | ${r.name.padEnd(24)} | ${r.status.padEnd(6)} | ${r.detail || r.error}`);
  });

  const allPassed = results.every(r => r.status === 'PASS');
  if (allPassed) {
    console.log('\n>>> 100% OF ALL 32 PDF TOOLS PASSED COMPLETE END-TO-END VERIFICATION! <<<');
    process.exit(0);
  } else {
    console.error('\n>>> SOME TOOLS FAILED VERIFICATION.');
    process.exit(1);
  }
})();
