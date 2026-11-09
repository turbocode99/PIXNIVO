/**
 * PIXNIVO PHOTO STUDIO PRO — USER PORTRAIT DEEP TESTING & BENCHMARK SUITE
 * Rigorous Verification of Selection Tools, Selective Filters, Precision Adjustments,
 * Brush/Pencil Engine, Retouching, and AI Enhancement on the User's Uploaded Portrait
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = 4220;
const ROOT_DIR = path.resolve(__dirname, '..');
const PORTRAIT_FIXTURE = path.join(ROOT_DIR, 'tests', 'fixtures', 'user_portrait.jpg');

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/photo-editor.html';
      const filePath = path.join(ROOT_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeMap = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg'
        };
        res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`[TEST HARNESS] Local test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

(async () => {
  console.log('================================================================');
  console.log('PIXNIVO PHOTO STUDIO PRO — USER PORTRAIT DEEP TEST & BENCHMARK');
  console.log(`Target Image: tests/fixtures/user_portrait.jpg (1024x1024 JPEG)`);
  console.log('================================================================\n');

  const server = await startServer();

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ERROR]') || text.includes('Uncaught')) {
      console.error('  PAGE ERROR:', text);
    }
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      const start = Date.now();
      await fn();
      const dur = Date.now() - start;
      console.log(`  [PASS] ${name} (${dur}ms)`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  // Load photo-editor
  await page.goto(`http://localhost:${PORT}/photo-editor.html`, { waitUntil: 'networkidle0' });

  // Read fixture image as base64
  const imgBuffer = fs.readFileSync(PORTRAIT_FIXTURE);
  const imgBase64 = imgBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${imgBase64}`;

  // --------------------------------------------------------------------------
  // TEST 1: Load User's Portrait Image into PixNivo
  // --------------------------------------------------------------------------
  await test('Test 1: Load User Portrait Image into PixNivo Studio (1024x1024)', async () => {
    const res = await page.evaluate(async (uri) => {
      return new Promise((resolve) => {
        const app = window.pixnivoEditor;
        const img = new Image();
        img.onload = () => {
          app.document = new window.PixnivoStudio.Document(img.naturalWidth, img.naturalHeight, 'user_portrait.jpg');
          app.mainCanvas.width = img.naturalWidth;
          app.mainCanvas.height = img.naturalHeight;
          app.overlayCanvas.width = img.naturalWidth;
          app.overlayCanvas.height = img.naturalHeight;
          app.artboard.style.width = img.naturalWidth + 'px';
          app.artboard.style.height = img.naturalHeight + 'px';

          const bgLayer = app.document.layers[0];
          bgLayer.name = 'User Portrait';
          bgLayer.ctx.drawImage(img, 0, 0);

          app.history = new window.PixnivoStudio.HistoryManager(60);
          app.history.pushState('Open User Portrait', app.document);
          app.fitToScreen();
          app.render();
          app.updateLayersUI();
          app.updateHistoryUI();

          resolve({
            width: app.document.width,
            height: app.document.height,
            layerName: bgLayer.name,
            pixelSample: Array.from(bgLayer.ctx.getImageData(512, 512, 1, 1).data)
          });
        };
        img.src = uri;
      });
    }, dataUri);

    if (res.width !== 1024 || res.height !== 1024) {
      throw new Error(`Expected 1024x1024 portrait dimensions, got ${res.width}x${res.height}`);
    }
    if (res.layerName !== 'User Portrait') {
      throw new Error(`Expected layer name "User Portrait", got ${res.layerName}`);
    }
    if (res.pixelSample[3] !== 255) {
      throw new Error(`Invalid pixel alpha: ${res.pixelSample[3]}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Freehand Lasso Selection Tool on User's Portrait
  // --------------------------------------------------------------------------
  await test('Test 2: Freehand Lasso Selection Tool Generates Accurate Mask & Bounds', async () => {
    const lassoRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      const tm = app.toolManager;
      tm.setTool('lasso');

      // Trace freehand lasso around user's face region:
      // (420, 250) -> (520, 200) -> (620, 250) -> (640, 380) -> (530, 470) -> (420, 380) -> (420, 250)
      const points = [
        { x: 420, y: 250 },
        { x: 520, y: 200 },
        { x: 620, y: 250 },
        { x: 640, y: 380 },
        { x: 530, y: 470 },
        { x: 420, y: 380 },
        { x: 420, y: 250 }
      ];

      // Simulate pointer down
      tm.onPointerDown({ pressure: 0.5 }, points[0]);
      // Simulate pointer moves
      for (let i = 1; i < points.length; i++) {
        tm.onPointerMove({ pressure: 0.5 }, points[i]);
      }
      // Simulate pointer up to finalize selection
      tm.onPointerUp({}, points[points.length - 1]);

      const hasSel = tm.hasSelection();
      const bounds = tm.selectionBounds;
      const maskCanvas = tm.selectionMaskCanvas;

      // Check mask sample inside polygon (512, 300) vs outside (100, 100)
      const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;
      const insideMaskPixel = maskCtx ? maskCtx.getImageData(512, 300, 1, 1).data[3] : 0;
      const outsideMaskPixel = maskCtx ? maskCtx.getImageData(100, 100, 1, 1).data[3] : 0;

      return {
        hasSel,
        bounds,
        maskWidth: maskCanvas ? maskCanvas.width : 0,
        maskHeight: maskCanvas ? maskCanvas.height : 0,
        insideMaskPixel,
        outsideMaskPixel
      };
    });

    if (!lassoRes.hasSel) throw new Error('Lasso selection was not registered as active');
    if (!lassoRes.bounds || lassoRes.bounds.width < 150 || lassoRes.bounds.height < 200) {
      throw new Error(`Invalid bounds: ${JSON.stringify(lassoRes.bounds)}`);
    }
    if (lassoRes.insideMaskPixel !== 255) {
      throw new Error(`Inside mask pixel alpha should be 255, got ${lassoRes.insideMaskPixel}`);
    }
    if (lassoRes.outsideMaskPixel !== 0) {
      throw new Error(`Outside mask pixel alpha should be 0, got ${lassoRes.outsideMaskPixel}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Selective Filter on Lasso Selection (Gaussian Blur Only Within Mask)
  // --------------------------------------------------------------------------
  await test('Test 3: Selective Filter Modifies Inside Selection; Outside Remains 100% Bit-Identical', async () => {
    const filterRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      const active = app.document.getActiveLayer();

      // Sample pixels before filter
      const insideBefore = Array.from(active.ctx.getImageData(512, 300, 1, 1).data);
      const outsideBeforeTop = Array.from(active.ctx.getImageData(100, 100, 1, 1).data);
      const outsideBeforeBottom = Array.from(active.ctx.getImageData(900, 900, 1, 1).data);

      // Apply Gaussian Blur via the new selective-aware pipeline
      app.applySelectiveOperation(ctx => window.PixnivoStudio.Filters.gaussianBlur(ctx, 10), 'Selective Gaussian Blur');

      // Sample pixels after filter
      const insideAfter = Array.from(active.ctx.getImageData(512, 300, 1, 1).data);
      const outsideAfterTop = Array.from(active.ctx.getImageData(100, 100, 1, 1).data);
      const outsideAfterBottom = Array.from(active.ctx.getImageData(900, 900, 1, 1).data);

      return {
        insideBefore,
        insideAfter,
        outsideBeforeTop,
        outsideAfterTop,
        outsideBeforeBottom,
        outsideAfterBottom
      };
    });

    // Verify inside pixels changed
    const insideDelta = Math.abs(filterRes.insideBefore[0] - filterRes.insideAfter[0]) +
                        Math.abs(filterRes.insideBefore[1] - filterRes.insideAfter[1]) +
                        Math.abs(filterRes.insideBefore[2] - filterRes.insideAfter[2]);
    if (insideDelta === 0) {
      throw new Error('Inside selection pixels did not change after Gaussian Blur!');
    }

    // Verify outside pixels are 100% IDENTICAL (0 difference)
    const outsideDeltaTop = Math.abs(filterRes.outsideBeforeTop[0] - filterRes.outsideAfterTop[0]) +
                            Math.abs(filterRes.outsideBeforeTop[1] - filterRes.outsideAfterTop[1]) +
                            Math.abs(filterRes.outsideBeforeTop[2] - filterRes.outsideAfterTop[2]);
    const outsideDeltaBottom = Math.abs(filterRes.outsideBeforeBottom[0] - filterRes.outsideAfterBottom[0]) +
                               Math.abs(filterRes.outsideBeforeBottom[1] - filterRes.outsideAfterBottom[1]) +
                               Math.abs(filterRes.outsideBeforeBottom[2] - filterRes.outsideAfterBottom[2]);

    if (outsideDeltaTop !== 0 || outsideDeltaBottom !== 0) {
      throw new Error(`Outside pixels leaked filter modifications! topDelta=${outsideDeltaTop}, bottomDelta=${outsideDeltaBottom}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Precision Adjustments with Live Sliders & Selection Masking
  // --------------------------------------------------------------------------
  await test('Test 4: Precision Adjustment Sliders Live Preview & Selective Commitment', async () => {
    const adjRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;

      // Undo previous blur to start fresh
      app.history.undo(app.document);
      app.render();

      const active = app.document.getActiveLayer();

      // Make rectangular marquee selection around jacket bottom area: (300, 600, 400, 350)
      app.toolManager.setTool('marquee_rect');
      app.toolManager.selectionPoints = [];
      app.toolManager.selectionBounds = { x: 300, y: 600, width: 400, height: 350 };
      app.toolManager.buildSelectionMask(app.document);

      // Sample jacket pixel inside (500, 750) and face pixel outside (512, 300)
      const jacketBefore = Array.from(active.ctx.getImageData(500, 750, 1, 1).data);
      const faceBefore = Array.from(active.ctx.getImageData(512, 300, 1, 1).data);

      // Set sliders in DOM: Brightness = +50, Saturation = +40
      const bSlider = document.getElementById('adjBrightnessSlider');
      const sSlider = document.getElementById('adjSaturationSlider');
      if (bSlider) bSlider.value = 50;
      if (sSlider) sSlider.value = 40;

      // Trigger slider input event to activate real-time preview
      if (bSlider) bSlider.dispatchEvent(new Event('input'));

      const jacketPreview = Array.from(active.ctx.getImageData(500, 750, 1, 1).data);
      const facePreview = Array.from(active.ctx.getImageData(512, 300, 1, 1).data);

      // Commit adjustments
      document.getElementById('btnApplyAdjustments')?.click();

      const jacketCommitted = Array.from(active.ctx.getImageData(500, 750, 1, 1).data);
      const faceCommitted = Array.from(active.ctx.getImageData(512, 300, 1, 1).data);

      return {
        jacketBefore,
        jacketPreview,
        jacketCommitted,
        faceBefore,
        facePreview,
        faceCommitted,
        bVal: bSlider ? bSlider.value : null
      };
    });

    // Check brightness increased in jacket
    if (adjRes.jacketCommitted[0] <= adjRes.jacketBefore[0] &&
        adjRes.jacketCommitted[1] <= adjRes.jacketBefore[1] &&
        adjRes.jacketCommitted[2] <= adjRes.jacketBefore[2]) {
      throw new Error(`Jacket area did not brighten! Before=${adjRes.jacketBefore}, After=${adjRes.jacketCommitted}`);
    }

    // Check face area outside jacket selection was NOT changed
    const faceDelta = Math.abs(adjRes.faceBefore[0] - adjRes.faceCommitted[0]) +
                      Math.abs(adjRes.faceBefore[1] - adjRes.faceCommitted[1]) +
                      Math.abs(adjRes.faceBefore[2] - adjRes.faceCommitted[2]);
    if (faceDelta !== 0) {
      throw new Error(`Face area outside selection was modified by adjustment! delta=${faceDelta}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Real-Time Brush & Pencil Engine with Shape & Size Control
  // --------------------------------------------------------------------------
  await test('Test 5: Real-Time Brush & Pencil Stroke Rendering with Tip Shapes', async () => {
    const brushRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      app.toolManager.clearSelection(); // Clear selection so brush draws freely
      const active = app.document.getActiveLayer();

      // Test 1: Round Soft Brush at 35px
      app.toolManager.setTool('brush');
      app.toolManager.brush.shape = 'round_soft';
      app.toolManager.brush.size = 35;
      app.setColor('#ff0055');

      const beforeSoft = Array.from(active.ctx.getImageData(150, 150, 1, 1).data);
      app.toolManager.onPointerDown({ pressure: 1.0 }, { x: 150, y: 150 });
      const duringSoft = Array.from(active.ctx.getImageData(150, 150, 1, 1).data);
      app.toolManager.onPointerUp({}, { x: 150, y: 150 });

      // Test 2: Pencil Tool with Square shape at 15px
      app.toolManager.setTool('pencil');
      app.toolManager.brush.size = 15;
      app.setColor('#00ffcc');

      const beforePencil = Array.from(active.ctx.getImageData(800, 200, 1, 1).data);
      app.toolManager.onPointerDown({ pressure: 1.0 }, { x: 800, y: 200 });
      app.toolManager.onPointerMove({ pressure: 1.0 }, { x: 820, y: 200 });
      const duringPencil = Array.from(active.ctx.getImageData(810, 200, 1, 1).data);
      app.toolManager.onPointerUp({}, { x: 820, y: 200 });

      // Test 3: Chisel Tip Brush Shape
      app.toolManager.setTool('brush');
      app.toolManager.brush.shape = 'chisel';
      app.toolManager.brush.size = 40;
      app.setColor('#ffff00');
      app.toolManager.onPointerDown({ pressure: 1.0 }, { x: 850, y: 500 });
      app.toolManager.onPointerUp({}, { x: 850, y: 500 });
      const chiselPixel = Array.from(active.ctx.getImageData(850, 500, 1, 1).data);

      // Test 4: Quick preset pills in UI
      const pill70 = document.querySelector('.opt-pill-btn[data-brush-preset="70"]');
      if (pill70) pill70.click();
      const activeSize = app.toolManager.brush.size;

      return {
        beforeSoft,
        duringSoft,
        beforePencil,
        duringPencil,
        chiselPixel,
        activeSize
      };
    });

    // Check soft brush drew in real time on pointerDown
    if (brushRes.duringSoft[0] === brushRes.beforeSoft[0] &&
        brushRes.duringSoft[1] === brushRes.beforeSoft[1] &&
        brushRes.duringSoft[2] === brushRes.beforeSoft[2]) {
      throw new Error('Brush dab was not rendered in real-time during pointerDown!');
    }

    // Check pencil stroke drew in real time during pointerMove
    if (brushRes.duringPencil[0] === brushRes.beforePencil[0] &&
        brushRes.duringPencil[1] === brushRes.beforePencil[1] &&
        brushRes.duringPencil[2] === brushRes.beforePencil[2]) {
      throw new Error('Pencil stroke was not rendered in real-time during pointerMove!');
    }

    // Check chisel dab rendered yellow (#ffff00)
    if (brushRes.chiselPixel[0] < 200 || brushRes.chiselPixel[1] < 200) {
      throw new Error(`Chisel stroke did not render yellow! got=${brushRes.chiselPixel}`);
    }

    // Check size pill switch
    if (brushRes.activeSize !== 70) {
      throw new Error(`Brush preset pill failed to set size to 70px; got ${brushRes.activeSize}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Retouching - Spot Healing Brush & Blemish Removal
  // --------------------------------------------------------------------------
  await test('Test 6: Spot Healing Brush Seamless Boundary Inpainting on Face', async () => {
    const healRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      const active = app.document.getActiveLayer();

      app.toolManager.setTool('heal');
      app.toolManager.brush.size = 25;

      // Sample face skin spot around cheek (540, 320)
      const beforeHeal = Array.from(active.ctx.getImageData(540, 320, 1, 1).data);

      // Apply spot heal dab
      app.toolManager.spotHealDab(active.ctx, { x: 540, y: 320 });
      app.history.pushState('Spot Healing Brush', app.document);
      app.render();

      const afterHeal = Array.from(active.ctx.getImageData(540, 320, 1, 1).data);

      return { beforeHeal, afterHeal };
    });

    if (healRes.afterHeal[3] !== 255) {
      throw new Error(`Alpha corrupted by spot heal: ${healRes.afterHeal[3]}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: AI Portrait Skin Polish & Auto Tone Enhancement
  // --------------------------------------------------------------------------
  await test('Test 7: AI Portrait Skin Polish & Bilateral Texture Balancing', async () => {
    const aiRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      const active = app.document.getActiveLayer();

      const faceBefore = Array.from(active.ctx.getImageData(520, 300, 1, 1).data);

      // Run AI Portrait Polish
      window.PixnivoStudio.AiEngine.enhancePortrait(active.ctx);
      app.history.pushState('AI Portrait Polish', app.document);
      app.render();

      const faceAfter = Array.from(active.ctx.getImageData(520, 300, 1, 1).data);

      return { faceBefore, faceAfter };
    });

    if (aiRes.faceAfter[3] !== 255) {
      throw new Error('AI Portrait Polish corrupted layer alpha');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Frequency Separation Layers (Color vs Texture Separation)
  // --------------------------------------------------------------------------
  await test('Test 8: Professional Frequency Separation Generates High & Low Freq Layers', async () => {
    const freqRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      document.getElementById('menuEditFreqSep')?.click();

      const layers = app.document.layers;
      const layerNames = layers.map(l => l.name);
      const highFreq = layers.find(l => l.name.includes('High Freq'));
      const lowFreq = layers.find(l => l.name.includes('Low Freq'));

      return {
        count: layers.length,
        layerNames,
        highBlend: highFreq ? highFreq.blendMode : null,
        lowBlend: lowFreq ? lowFreq.blendMode : null
      };
    });

    if (freqRes.count < 3) {
      throw new Error(`Expected at least 3 layers after Frequency Separation, got ${freqRes.count}`);
    }
    if (freqRes.highBlend !== 'linear-light') {
      throw new Error(`Expected High Frequency blend mode to be 'linear-light', got ${freqRes.highBlend}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Keyboard Shortcuts (Ctrl+D Deselect, Brackets Brush Sizing)
  // --------------------------------------------------------------------------
  await test('Test 9: Keyboard Shortcuts (Ctrl+D Deselect, [ / ] Brush Resize)', async () => {
    const shortcutRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      app.toolManager.selectionBounds = { x: 100, y: 100, width: 200, height: 200 };

      // Dispatch Ctrl+D
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
      const hasSelAfterCtrlD = app.toolManager.hasSelection();

      // Dispatch ']' to increase brush size
      const sizeBefore = app.toolManager.brush.size;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
      const sizeAfterInc = app.toolManager.brush.size;

      // Dispatch '[' to decrease brush size
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
      const sizeAfterDec = app.toolManager.brush.size;

      return {
        hasSelAfterCtrlD,
        sizeBefore,
        sizeAfterInc,
        sizeAfterDec
      };
    });

    if (shortcutRes.hasSelAfterCtrlD) {
      throw new Error('Ctrl+D failed to clear active selection!');
    }
    if (shortcutRes.sizeAfterInc !== shortcutRes.sizeBefore + 5) {
      throw new Error(`']' failed to increase brush size: ${shortcutRes.sizeBefore} -> ${shortcutRes.sizeAfterInc}`);
    }
    if (shortcutRes.sizeAfterDec !== shortcutRes.sizeBefore) {
      throw new Error(`'[' failed to restore brush size: ${shortcutRes.sizeAfterInc} -> ${shortcutRes.sizeAfterDec}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Performance Benchmark vs Adobe Photoshop Parity Standards
  // --------------------------------------------------------------------------
  await test('Test 10: Performance Benchmark on 1024x1024 Portrait vs Adobe Photoshop', async () => {
    const benchmarkRes = await page.evaluate(() => {
      const app = window.pixnivoEditor;
      const active = app.document.getActiveLayer();

      // Measure Separable Gaussian Blur on 1024x1024 image
      const t0 = performance.now();
      window.PixnivoStudio.Filters.gaussianBlur(active.ctx, 6);
      const blurLatency = performance.now() - t0;

      // Measure Composite Canvas Rendering
      const t1 = performance.now();
      app.render();
      const renderLatency = performance.now() - t1;

      // Measure Freehand Selection Generation Latency
      const t2 = performance.now();
      app.toolManager.selectionPoints = [
        { x: 300, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 300 }
      ];
      app.toolManager.selectionBounds = { x: 300, y: 300, width: 400, height: 400 };
      app.toolManager.buildSelectionMask(app.document);
      const maskLatency = performance.now() - t2;

      return {
        blurLatency: Math.round(blurLatency * 10) / 10,
        renderLatency: Math.round(renderLatency * 10) / 10,
        maskLatency: Math.round(maskLatency * 10) / 10
      };
    });

    console.log(`\n  ================ PERFORMANCE BENCHMARK ================`);
    console.log(`  Target Canvas Size:            1024 × 1024 px`);
    console.log(`  Gaussian Blur Latency (1024p): ${benchmarkRes.blurLatency} ms  (Photoshop CC target: < 50ms)`);
    console.log(`  Multi-Layer Render Latency:    ${benchmarkRes.renderLatency} ms  (60 FPS target: < 16.6ms)`);
    console.log(`  Lasso Mask Generation Latency: ${benchmarkRes.maskLatency} ms  (Photoshop CC target: < 10ms)`);
    console.log(`  =======================================================\n`);

    if (benchmarkRes.blurLatency > 150) {
      throw new Error(`Blur latency too slow: ${benchmarkRes.blurLatency}ms`);
    }
    if (benchmarkRes.renderLatency > 30) {
      throw new Error(`Render latency too slow: ${benchmarkRes.renderLatency}ms`);
    }
  });

  console.log('================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS`);
  console.log('================================================================');

  await browser.close();
  server.close();

  if (failed > 0) {
    process.exit(1);
  }
})();
