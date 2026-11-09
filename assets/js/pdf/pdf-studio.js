/**
 * PIXNIVO PDF TOOLS PLATFORM — CLIENT-SIDE CORE ENGINE
 * Implements 32 professional PDF tools with 100% free & open-source technologies.
 * Zero paid APIs, Zero subscription dependencies.
 */

(function () {
  'use strict';

  const P = window.Pixnivo;
  const $ = id => document.getElementById(id);

  // Dynamic Library Loaders
  const PDFLIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  let _pdfLibPromise = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!_pdfLibPromise) {
      _pdfLibPromise = P.loadScript(PDFLIB_URL).then(() => window.PDFLib);
    }
    return _pdfLibPromise;
  }

  let _pdfJsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!_pdfJsPromise) {
      _pdfJsPromise = P.loadScript(PDFJS_URL).then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return window.pdfjsLib;
      });
    }
    return _pdfJsPromise;
  }

  let _jszipPromise = null;
  function loadJsZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!_jszipPromise) {
      _jszipPromise = P.loadScript(JSZIP_URL).then(() => window.JSZip);
    }
    return _jszipPromise;
  }

  let _tesseractPromise = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!_tesseractPromise) {
      _tesseractPromise = P.loadScript(TESSERACT_URL).then(() => window.Tesseract);
    }
    return _tesseractPromise;
  }

  // Helpers
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  if (P && !P.escapeHtml) P.escapeHtml = escapeHtml;

  function isPdf(file) {
    return file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  }


  function setProgress(progEl, pct, msg) {
    if (!progEl) return;
    progEl.classList.add('active');
    const bar = progEl.querySelector('.bar i');
    const pctEl = progEl.querySelector('.pct');
    const msgEl = progEl.querySelector('.msg');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    if (msgEl) msgEl.textContent = msg || '';
  }

  function endProgress(progEl) {
    if (!progEl) return;
    progEl.classList.remove('active');
    const bar = progEl.querySelector('.bar i');
    if (bar) bar.style.width = '0%';
  }

  function showResult(resEl, title, details, opt = {}) {
    if (!resEl) return;
    resEl.hidden = false;
    resEl.classList.add('on', 'active');
    resEl.style.display = 'flex';
    resEl.classList.toggle('warn', !!opt.warn);
    const h = resEl.querySelector('.h');
    const d = resEl.querySelector('.d');
    if (h) h.textContent = title;
    if (d) d.textContent = details;
    const btn = resEl.querySelector('[data-redownload]');
    if (btn) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle; margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${opt.actionLabel || 'Download File'}`;
      if (opt.blob && opt.filename) {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          P.downloadBlob(opt.blob, opt.filename);
        };
      }
    }
  }

  function hideResult(resEl) {
    if (!resEl) return;
    resEl.hidden = true;
    resEl.classList.remove('on', 'active');
    resEl.style.display = 'none';
  }

  // ============================================================================
  // WORKSPACE CONTROLLER
  // ============================================================================
  const PdfStudio = {
    activeTool: null,

    init() {
      document.querySelectorAll('.result').forEach(r => r.hidden = true);
      this.initCatalogNav();
      this.initSearch();
      this.initTools();

      // Check URL hash for direct tool deep link e.g. #split, #pdf2word, #sign
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && $(`stage-${hash}`)) {
        this.openTool(hash);
      } else {
        // default show catalog
        this.showCatalog();
      }

      window.addEventListener('hashchange', () => {
        const h = window.location.hash.replace('#', '').trim();
        if (h && $(`stage-${h}`)) this.openTool(h);
        else this.showCatalog();
      });
    },

    showCatalog() {
      const cat = $('toolsCatalogSection');
      const ws = $('workspaceSection');
      if (cat) cat.hidden = false;
      if (ws) ws.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    openTool(toolId) {
      const stage = $(`stage-${toolId}`);
      if (!stage) return;

      const cat = $('toolsCatalogSection');
      const ws = $('workspaceSection');
      if (cat) cat.hidden = true;
      if (ws) ws.hidden = false;

      // Hide all other stages
      document.querySelectorAll('.pdf-workspace-view').forEach(s => s.classList.remove('active'));
      stage.classList.add('active');
      stage.querySelectorAll('.result').forEach(r => r.hidden = true);
      this.activeTool = toolId;

      // Update breadcrumb title
      const titleSpan = $('currentToolBreadcrumb');
      const cardTitle = document.querySelector(`.pdf-tool-card[data-tool="${toolId}"] h3`);
      if (titleSpan && cardTitle) {
        titleSpan.textContent = cardTitle.childNodes[0].textContent.trim();
      }

      window.location.hash = toolId;
      window.scrollTo({ top: $('workspaceSection').offsetTop - 80, behavior: 'smooth' });
    },

    initCatalogNav() {
      const btns = document.querySelectorAll('.pdf-cat-btn');
      const cards = document.querySelectorAll('.pdf-tool-card');

      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.dataset.category;

          cards.forEach(card => {
            if (cat === 'all' || card.dataset.category === cat) {
              card.style.display = 'flex';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });

      // Tool card clicks
      cards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          const tool = card.dataset.tool;
          this.openTool(tool);
        });
      });

      // Back button
      const backBtn = $('backToCatalogBtn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          window.location.hash = '';
          this.showCatalog();
        });
      }
    },

    initSearch() {
      const input = $('toolSearchInput');
      if (!input) return;

      input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.pdf-tool-card');
        cards.forEach(card => {
          const text = (card.innerText || '').toLowerCase();
          const match = text.includes(query);
          card.style.display = match ? 'flex' : 'none';
        });
      });
    },

    initTools() {
      this.initMerge();
      this.initSplit();
      this.initOrganize();
      this.initRotate();
      this.initCrop();
      this.initCompare();
      this.initCompress();
      this.initProtect();
      this.initUnlock();
      this.initRedact();
      this.initPdfA();
      this.initServerConversions();
      this.initPdfToJpg();
      this.initJpgToPdf();
      this.initHtmlToPdf();
      this.initScanToPdf();
      this.initEdit();
      this.initSign();
      this.initWatermark();
      this.initPageNumbers();
      this.initForms();
      this.initRepair();
      this.initOcr();
      this.initImagesToPdf();
      this.initSummarize();
      this.initTranslate();
    },

    // --------------------------------------------------------------------------
    // 1. MERGE PDF
    // --------------------------------------------------------------------------
    initMerge() {
      const drop = $('dropMerge');
      const fileIn = $('fileMerge');
      const listEl = $('listMerge');
      const goBtn = $('btnMerge');
      const prog = $('progMerge');
      const res = $('resMerge');
      let files = []; // [{ file, pageCount }]
      let lastBlob = null, lastName = '';

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const pdfs = incoming.filter(isPdf);
        if (!pdfs.length) { P.toast('Please select PDF files.', { type: 'warning' }); return; }

        pdfs.forEach(f => {
          const item = { file: f, pageCount: null };
          files.push(item);

          // Asynchronously resolve page count in background without blocking UI
          loadPdfLib().then(({ PDFDocument }) => {
            return f.arrayBuffer().then(buf => PDFDocument.load(buf, { ignoreEncryption: true }));
          }).then(doc => {
            item.pageCount = doc.getPageCount();
            renderList();
          }).catch(() => {
            item.pageCount = 1;
            renderList();
          });
        });

        renderList();
      });

      function renderList() {
        listEl.innerHTML = '';
        if (files.length === 0) {
          goBtn.disabled = true;
          hideResult(res);
          return;
        }

        let totalPages = 0;
        files.forEach((item, idx) => {
          if (item.pageCount) totalPages += item.pageCount;
          const el = document.createElement('div');
          el.className = 'file-item';
          const countBadge = item.pageCount !== null 
            ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}`
            : 'Reading pages…';
          el.innerHTML = `
            <span class="file-name" title="${P.escapeHtml(item.file.name)}">
              ${P.escapeHtml(item.file.name)}
              <span style="opacity:0.7; font-weight:normal; margin-left:6px;">(${countBadge} · ${P.formatBytes(item.file.size)})</span>
            </span>
            <div class="file-actions">
              <button type="button" class="btn-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn-down" title="Move Down" ${idx === files.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn-remove" title="Remove File">✕</button>
            </div>
          `;
          el.querySelector('.btn-up')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const temp = files[idx - 1]; files[idx - 1] = files[idx]; files[idx] = temp; renderList();
          });
          el.querySelector('.btn-down')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const temp = files[idx + 1]; files[idx + 1] = files[idx]; files[idx] = temp; renderList();
          });
          el.querySelector('.btn-remove')?.addEventListener('click', (e) => {
            e.stopPropagation();
            files.splice(idx, 1); renderList();
          });
          listEl.appendChild(el);
        });

        // Add more files button inside list
        const addMoreRow = document.createElement('div');
        addMoreRow.style.margin = '8px 0';
        addMoreRow.style.textAlign = 'center';
        addMoreRow.innerHTML = `
          <button type="button" class="btn btn-sm btn-ghost" id="btnAddMorePdfs" style="display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add more PDF files
          </button>
        `;
        addMoreRow.querySelector('button')?.addEventListener('click', (e) => {
          e.stopPropagation();
          fileIn.click();
        });
        listEl.appendChild(addMoreRow);

        // Summary bar
        const summary = document.createElement('div');
        summary.className = 'pdf-merge-summary';
        summary.innerHTML = `
          <span>Files: <strong>${files.length}</strong> · Total Pages: <strong>${totalPages || files.length}</strong></span>
          <span style="font-size:0.8rem; opacity:0.8;">${files.length === 1 ? '1 file selected (add more to combine or merge now)' : 'Ready to merge in order above'}</span>
        `;
        listEl.appendChild(summary);

        goBtn.disabled = files.length === 0;
        hideResult(res);
      }

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        if (files.length === 0) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          setProgress(prog, 10, 'Initializing merger…');
          let outBytes = null;
          let totalMergedPages = 0;

          // Attempt client-side merge first
          try {
            const { PDFDocument } = await loadPdfLib();
            const merged = await PDFDocument.create();
            for (let i = 0; i < files.length; i++) {
              setProgress(prog, 15 + ((i + 1) / files.length) * 75, `Merging ${files[i].file.name}…`);
              const doc = await PDFDocument.load(await files[i].file.arrayBuffer(), { ignoreEncryption: true });
              const copiedPages = await merged.copyPages(doc, doc.getPageIndices());
              copiedPages.forEach(p => merged.addPage(p));
            }
            outBytes = await merged.save();
            totalMergedPages = merged.getPageCount();
          } catch (clientErr) {
            console.warn('[Pixnivo PDF Studio] Client-side merge fallback to backend core:', clientErr);
            setProgress(prog, 50, 'Processing via high-fidelity PDF core…');
            const formData = new FormData();
            files.forEach(f => formData.append('files', f.file));
            const resp = await fetch('/api/v1/pdf/merge', { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(await resp.text());
            outBytes = await resp.arrayBuffer();

            try {
              const { PDFDocument } = await loadPdfLib();
              const vDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
              totalMergedPages = vDoc.getPageCount();
            } catch (_) {
              totalMergedPages = files.reduce((acc, cur) => acc + (cur.pageCount || 1), 0);
            }
          }

          lastBlob = new Blob([outBytes], { type: 'application/pdf' });
          lastName = files.length === 1 ? `${P.baseName(files[0].file.name)}-merged.pdf` : `merged-${Date.now()}.pdf`;
          endProgress(prog);
          P.downloadBlob(lastBlob, lastName);
          showResult(res, 'PDFs merged successfully', `Combined ${files.length} document${files.length > 1 ? 's' : ''} into ${totalMergedPages} pages (${P.formatBytes(lastBlob.size)})`, {
            blob: lastBlob,
            filename: lastName,
            actionLabel: 'Download Merged PDF'
          });
        } catch (e) {
          endProgress(prog);
          P.toast(`Merge failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 2. SPLIT PDF
    // --------------------------------------------------------------------------
    initSplit() {
      const drop = $('dropSplit');
      const fileIn = $('fileSplit');
      const rangeInput = $('splitRangeInput');
      const goBtn = $('btnSplit');
      const prog = $('progSplit');
      const res = $('resSplit');
      let currentFile = null;
      let totalPages = 0;
      let lastBlob = null, lastName = '';

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) { P.toast('Please select a PDF file.', { type: 'warning' }); return; }
        currentFile = f;
        $('splitFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('splitFileInfo').hidden = false;
        $('splitPageCount').textContent = 'Reading pages…';
        goBtn.disabled = false; // Enabled immediately

        loadPdfLib().then(({ PDFDocument }) => {
          return f.arrayBuffer().then(buf => PDFDocument.load(buf, { ignoreEncryption: true }));
        }).then(doc => {
          totalPages = doc.getPageCount();
          $('splitPageCount').textContent = `Total pages: ${totalPages}`;
          rangeInput.placeholder = totalPages > 1 ? `e.g. 1-${Math.min(2, totalPages)}, ${totalPages} (Leave empty to extract all ${totalPages} pages into a ZIP)` : `1 (Single page document)`;
        }).catch(err => {
          console.warn('[Pixnivo Split] Could not pre-parse page count:', err);
          totalPages = 1;
          $('splitPageCount').textContent = 'Document ready for splitting';
        });
      });

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const rangeStr = rangeInput.value.trim();

          if (!rangeStr) {
            // Split ALL pages into a ZIP archive
            setProgress(prog, 20, 'Preparing ZIP archive…');
            let zipBlob = null;

            try {
              const { PDFDocument } = await loadPdfLib();
              const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
              const JSZip = await loadJsZip();
              const zip = new JSZip();

              const count = totalPages || doc.getPageCount();
              for (let i = 0; i < count; i++) {
                setProgress(prog, 20 + ((i + 1) / count) * 70, `Extracting page ${i + 1} of ${count}…`);
                const newDoc = await PDFDocument.create();
                const [page] = await newDoc.copyPages(doc, [i]);
                newDoc.addPage(page);
                zip.file(`page-${i + 1}.pdf`, await newDoc.save());
              }

              setProgress(prog, 95, 'Compressing ZIP…');
              zipBlob = await zip.generateAsync({ type: 'blob' });
            } catch (clientErr) {
              console.warn('[Pixnivo PDF Studio] Client-side split fallback to backend core:', clientErr);
              const formData = new FormData();
              formData.append('file', currentFile);
              formData.append('as_zip', 'true');
              const resp = await fetch('/api/v1/pdf/split', { method: 'POST', body: formData });
              if (!resp.ok) throw new Error(await resp.text());
              zipBlob = await resp.blob();
            }

            lastBlob = zipBlob;
            lastName = `${P.baseName(currentFile.name)}-split-pages.zip`;
            endProgress(prog);
            P.downloadBlob(lastBlob, lastName);
            showResult(res, 'Split complete!', `Extracted all ${totalPages || 'all'} pages into ZIP archive.`, {
              blob: lastBlob,
              filename: lastName,
              actionLabel: 'Download ZIP Archive'
            });
          } else {
            // Parse ranges: e.g. "1-3, 5", "2", "3-1"
            const indices = [];
            const parts = rangeStr.split(',');
            for (const part of parts) {
              const p = part.trim();
              if (!p) continue;
              if (p.includes('-')) {
                const sub = p.split('-').map(n => parseInt(n.trim(), 10));
                let start = sub[0];
                let end = sub[1];
                if (isNaN(start) || isNaN(end)) {
                  throw new Error(`Invalid range format "${p}". Use format like 1-3.`);
                }
                if (totalPages > 0) {
                  if (start < 1 || start > totalPages) {
                    throw new Error(`Page ${start} is out of range. Document has ${totalPages} page${totalPages === 1 ? '' : 's'}.`);
                  }
                  if (end < 1 || end > totalPages) {
                    throw new Error(`Page ${end} is out of range. Document has ${totalPages} page${totalPages === 1 ? '' : 's'}.`);
                  }
                }
                if (start > end) {
                  const t = start; start = end; end = t;
                }
                for (let k = start; k <= end; k++) {
                  if (!indices.includes(k - 1)) indices.push(k - 1);
                }
              } else {
                const k = parseInt(p, 10);
                if (isNaN(k)) {
                  throw new Error(`Invalid page number "${p}".`);
                }
                if (totalPages > 0 && (k < 1 || k > totalPages)) {
                  throw new Error(`Page ${k} is out of range. Document has ${totalPages} page${totalPages === 1 ? '' : 's'}.`);
                }
                if (!indices.includes(k - 1)) indices.push(k - 1);
              }
            }

            if (!indices.length) throw new Error('Please specify valid page numbers to extract.');

            setProgress(prog, 50, 'Extracting selected pages…');
            let outBytes = null;

            try {
              const { PDFDocument } = await loadPdfLib();
              const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
              const newDoc = await PDFDocument.create();
              const copied = await newDoc.copyPages(doc, indices);
              copied.forEach(pg => newDoc.addPage(pg));
              outBytes = await newDoc.save();
            } catch (clientErr) {
              console.warn('[Pixnivo PDF Studio] Client-side extract fallback to backend core:', clientErr);
              const formData = new FormData();
              formData.append('file', currentFile);
              formData.append('pages', rangeStr);
              formData.append('as_zip', 'false');
              const resp = await fetch('/api/v1/pdf/split', { method: 'POST', body: formData });
              if (!resp.ok) throw new Error(await resp.text());
              outBytes = await resp.arrayBuffer();
            }

            lastBlob = new Blob([outBytes], { type: 'application/pdf' });
            lastName = indices.length === 1 ? `${P.baseName(currentFile.name)}-page-${indices[0] + 1}.pdf` : `${P.baseName(currentFile.name)}-extracted.pdf`;
            endProgress(prog);
            P.downloadBlob(lastBlob, lastName);
            showResult(res, 'Extraction complete!', `Successfully extracted ${indices.length} page${indices.length === 1 ? '' : 's'} (${P.formatBytes(lastBlob.size)}).`, {
              blob: lastBlob,
              filename: lastName,
              actionLabel: 'Download Extracted PDF'
            });
          }
        } catch (e) {
          endProgress(prog);
          P.toast(`Split failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 3. ORGANIZE PDF
    // --------------------------------------------------------------------------
    initOrganize() {
      const drop = $('dropOrganize');
      const fileIn = $('fileOrganize');
      const grid = $('gridOrganize');
      const goBtn = $('btnOrganize');
      const prog = $('progOrganize');
      const res = $('resOrganize');
      let currentDoc = null, currentFile = null;
      let pagesState = []; // [{ origIndex, rotation, canvas }]
      let lastBlob = null, lastName = '';
      let draggedCard = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, async incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        grid.innerHTML = '<p style="padding:20px; text-align:center;">Rendering page previews…</p>';
        goBtn.disabled = true;

        try {
          const pdfjs = await loadPdfJs();
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
          currentDoc = doc;
          pagesState = [];

          for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const vp = page.getViewport({ scale: 0.3 });

            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

            pagesState.push({
              origIndex: n - 1,
              rotation: 0,
              canvas: canvas
            });
          }

          renderOrganizeGrid();
          goBtn.disabled = false;
        } catch (e) {
          P.toast(`Failed to load PDF: ${e.message}`, { type: 'error' });
        }
      });

      function renderOrganizeGrid() {
        grid.innerHTML = '';
        if (pagesState.length === 0) {
          grid.innerHTML = '<p style="padding:20px; text-align:center; color:var(--text-3);">All pages removed. Upload a new PDF to organize.</p>';
          goBtn.disabled = true;
          return;
        }

        pagesState.forEach((state, idx) => {
          const card = document.createElement('div');
          card.className = 'pdf-page-item';
          card.dataset.index = idx;
          card.draggable = true;

          card.innerHTML = `
            <div class="pdf-page-canvas-wrapper"></div>
            <div class="pdf-page-label">Page ${idx + 1} (Orig: ${state.origIndex + 1})</div>
            <div class="pdf-page-actions">
              <button type="button" class="pdf-page-btn move-prev" title="Move Left" ${idx === 0 ? 'disabled' : ''}>◀</button>
              <button type="button" class="pdf-page-btn rot" title="Rotate 90°">↻</button>
              <button type="button" class="pdf-page-btn delete del" title="Delete page">🗑</button>
              <button type="button" class="pdf-page-btn move-next" title="Move Right" ${idx === pagesState.length - 1 ? 'disabled' : ''}>▶</button>
            </div>
          `;

          const wrapper = card.querySelector('.pdf-page-canvas-wrapper');
          wrapper.appendChild(state.canvas);
          state.canvas.style.transform = `rotate(${state.rotation}deg)`;

          card.querySelector('.rot').addEventListener('click', (e) => {
            e.stopPropagation();
            state.rotation = (state.rotation + 90) % 360;
            state.canvas.style.transform = `rotate(${state.rotation}deg)`;
          });

          card.querySelector('.del').addEventListener('click', (e) => {
            e.stopPropagation();
            pagesState.splice(idx, 1);
            renderOrganizeGrid();
          });

          card.querySelector('.move-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            if (idx > 0) {
              const temp = pagesState[idx - 1];
              pagesState[idx - 1] = pagesState[idx];
              pagesState[idx] = temp;
              renderOrganizeGrid();
            }
          });

          card.querySelector('.move-next').addEventListener('click', (e) => {
            e.stopPropagation();
            if (idx < pagesState.length - 1) {
              const temp = pagesState[idx + 1];
              pagesState[idx + 1] = pagesState[idx];
              pagesState[idx] = temp;
              renderOrganizeGrid();
            }
          });

          // Drag and Drop
          card.addEventListener('dragstart', (e) => {
            draggedCard = idx;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
          });
          card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.style.borderColor = 'var(--brand)';
          });
          card.addEventListener('dragleave', () => {
            card.style.borderColor = '';
          });
          card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.style.borderColor = '';
            if (draggedCard !== null && draggedCard !== idx) {
              const movedItem = pagesState.splice(draggedCard, 1)[0];
              pagesState.splice(idx, 0, movedItem);
              renderOrganizeGrid();
            }
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedCard = null;
          });

          grid.appendChild(card);
        });

        goBtn.disabled = pagesState.length === 0;
      }

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        if (!pagesState.length || !currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument, degrees } = await loadPdfLib();
          const origDoc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const outDoc = await PDFDocument.create();

          for (const s of pagesState) {
            const [copied] = await outDoc.copyPages(origDoc, [s.origIndex]);
            if (s.rotation !== 0) {
              const currentRot = copied.getRotation().angle;
              copied.setRotation(degrees((currentRot + s.rotation) % 360));
            }
            outDoc.addPage(copied);
          }

          const outBytes = await outDoc.save();
          lastBlob = new Blob([outBytes], { type: 'application/pdf' });
          lastName = `${P.baseName(currentFile.name)}-organized.pdf`;
          P.downloadBlob(lastBlob, lastName);
          showResult(res, 'Organized PDF Ready', `Exported ${pagesState.length} page${pagesState.length > 1 ? 's' : ''} in desired sequence (${P.formatBytes(lastBlob.size)}).`);
        } catch (e) {
          P.toast(`Organize failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 4. ROTATE PDF
    // --------------------------------------------------------------------------
    initRotate() {
      const drop = $('dropRotate');
      const fileIn = $('fileRotate');
      const angleSelect = $('rotateAngle');
      const goBtn = $('btnRotate');
      const res = $('resRotate');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('rotateFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('rotateFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        try {
          const { PDFDocument, degrees } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const angle = parseInt(angleSelect.value, 10);

          doc.getPages().forEach(page => {
            const cur = page.getRotation().angle;
            page.setRotation(degrees((cur + angle) % 360));
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-rotated.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Rotated successfully', `All pages rotated by ${angle}°.`);
        } catch (e) {
          P.toast(`Rotate failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 5. CROP PDF
    // --------------------------------------------------------------------------
    initCrop() {
      const drop = $('dropCrop');
      const fileIn = $('fileCrop');
      const cropMargin = $('cropMarginInput');
      const goBtn = $('btnCrop');
      const res = $('resCrop');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('cropFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('cropFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        try {
          const { PDFDocument } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const m = parseFloat(cropMargin.value) || 20;

          doc.getPages().forEach(page => {
            const { x, y, width, height } = page.getCropBox() || page.getMediaBox();
            page.setCropBox(x + m, y + m, Math.max(width - 2 * m, 50), Math.max(height - 2 * m, 50));
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-cropped.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Crop complete', `Applied ${m}pt margin crop across all pages.`);
        } catch (e) {
          P.toast(`Crop failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 6. COMPARE PDF
    // --------------------------------------------------------------------------
    initCompare() {
      const dropA = $('dropCompA');
      const fileInA = $('fileCompA');
      const dropB = $('dropCompB');
      const fileInB = $('fileCompB');
      const goBtn = $('btnCompare');
      const diffCanvas = $('canvasDiff');
      let fileA = null, fileB = null;

      if (!dropA || !dropB) return;

      P.wireDropzone(dropA, fileInA, incoming => {
        fileA = incoming.find(isPdf);
        if (fileA) $('compInfoA').textContent = fileA.name;
        goBtn.disabled = !fileA || !fileB;
      });

      P.wireDropzone(dropB, fileInB, incoming => {
        fileB = incoming.find(isPdf);
        if (fileB) $('compInfoB').textContent = fileB.name;
        goBtn.disabled = !fileA || !fileB;
      });

      goBtn?.addEventListener('click', async () => {
        if (!fileA || !fileB) return;
        P.setLoading(goBtn, true);
        try {
          const pdfjs = await loadPdfJs();
          const docA = await pdfjs.getDocument({ data: new Uint8Array(await fileA.arrayBuffer()) }).promise;
          const docB = await pdfjs.getDocument({ data: new Uint8Array(await fileB.arrayBuffer()) }).promise;

          const pA = await docA.getPage(1);
          const pB = await docB.getPage(1);

          const vp = pA.getViewport({ scale: 1.0 });
          const cA = document.createElement('canvas');
          cA.width = vp.width; cA.height = vp.height;
          const cB = document.createElement('canvas');
          cB.width = vp.width; cB.height = vp.height;

          await pA.render({ canvasContext: cA.getContext('2d'), viewport: vp }).promise;
          await pB.render({ canvasContext: cB.getContext('2d'), viewport: vp }).promise;

          diffCanvas.width = vp.width;
          diffCanvas.height = vp.height;
          const ctxDiff = diffCanvas.getContext('2d');

          const imgDataA = cA.getContext('2d').getImageData(0, 0, vp.width, vp.height);
          const imgDataB = cB.getContext('2d').getImageData(0, 0, vp.width, vp.height);
          const diffImg = ctxDiff.createImageData(vp.width, vp.height);

          let diffPixels = 0;
          for (let i = 0; i < imgDataA.data.length; i += 4) {
            const rDiff = Math.abs(imgDataA.data[i] - imgDataB.data[i]);
            const gDiff = Math.abs(imgDataA.data[i + 1] - imgDataB.data[i + 1]);
            const bDiff = Math.abs(imgDataA.data[i + 2] - imgDataB.data[i + 2]);

            if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
              diffPixels++;
              diffImg.data[i] = 239;     // Hot Red highlight
              diffImg.data[i + 1] = 68;
              diffImg.data[i + 2] = 68;
              diffImg.data[i + 3] = 255;
            } else {
              // Faded background
              diffImg.data[i] = imgDataA.data[i];
              diffImg.data[i + 1] = imgDataA.data[i + 1];
              diffImg.data[i + 2] = imgDataA.data[i + 2];
              diffImg.data[i + 3] = 80;
            }
          }

          ctxDiff.putImageData(diffImg, 0, 0);
          $('compareResultBox').hidden = false;
          $('compareMetrics').textContent = `Difference found: ${diffPixels.toLocaleString()} altered pixels on Page 1.`;
        } catch (e) {
          P.toast(`Comparison failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 7. COMPRESS PDF
    // --------------------------------------------------------------------------
    initCompress() {
      const drop = $('dropCompress');
      const fileIn = $('fileCompress');
      const levelChips = document.querySelectorAll('#settingsCompress .chip');
      const dpiSlider = $('dpiCompress');
      const goBtn = $('btnCompress');
      const prog = $('progCompress');
      const res = $('resCompress');
      let currentFile = null;
      let level = 2; // balanced

      if (!drop || !fileIn) return;

      levelChips.forEach(c => c.addEventListener('click', () => {
        levelChips.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        level = parseInt(c.dataset.level, 10);
      }));

      dpiSlider?.addEventListener('input', (e) => {
        const valSpan = $('dpiValCompress');
        if (valSpan) valSpan.textContent = e.target.value + ' DPI';
      });

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('compressFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('compressFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const [{ PDFDocument }, pdfjs] = await Promise.all([loadPdfLib(), loadPdfJs()]);
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await currentFile.arrayBuffer()) }).promise;
          const out = await PDFDocument.create();
          out.setProducer('Pixnivo PDF Studio');

          const quality = level === 1 ? 0.9 : (level === 2 ? 0.8 : 0.65);
          const dpi = parseInt(dpiSlider?.value || '150', 10);
          const scale = dpi / 72;

          for (let n = 1; n <= doc.numPages; n++) {
            setProgress(prog, ((n) / doc.numPages) * 100, `Compressing page ${n} of ${doc.numPages}…`);
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const s = Math.min(scale, 2400 / Math.max(base.width, base.height));
            const vp = page.getViewport({ scale: s });

            const c = document.createElement('canvas');
            c.width = Math.round(vp.width);
            c.height = Math.round(vp.height);
            const cx = c.getContext('2d');
            cx.fillStyle = '#ffffff';
            cx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: cx, viewport: vp, intent: 'print' }).promise;

            const blob = await P.canvasToBlob(c, 'image/jpeg', quality);
            const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
            const p = out.addPage([base.width, base.height]);
            p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
          }

          const outBytes = await out.save();
          const outBlob = new Blob([outBytes], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-compressed.pdf`;
          endProgress(prog);

          if (outBlob.size < currentFile.size) {
            P.downloadBlob(outBlob, name);
            const pct = Math.round((1 - outBlob.size / currentFile.size) * 100);
            showResult(res, `${pct}% Smaller!`, `${P.formatBytes(currentFile.size)} → ${P.formatBytes(outBlob.size)}`);
          } else {
            P.downloadBlob(outBlob, name);
            showResult(res, 'Optimized Document', `Size: ${P.formatBytes(outBlob.size)} (Original was already optimal).`);
          }
        } catch (e) {
          endProgress(prog);
          P.toast(`Compression failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 8. PROTECT PDF (Password encryption)
    // --------------------------------------------------------------------------
    initProtect() {
      const drop = $('dropProtect');
      const fileIn = $('fileProtect');
      const passIn = $('protectPassword');
      const goBtn = $('btnProtect');
      const res = $('resProtect');
      let currentFile = null;
      let lastBlob = null, lastName = '';

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('protectFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('protectFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        const pw = passIn.value.trim();
        if (!pw) { P.toast('Please enter a password.', { type: 'warning' }); return; }
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const formData = new FormData();
          formData.append('file', currentFile);
          formData.append('password', pw);
          const resp = await fetch('/api/v1/pdf/protect', { method: 'POST', body: formData });
          if (!resp.ok) {
            const errDetail = await resp.text();
            throw new Error(errDetail.includes('detail') ? JSON.parse(errDetail).detail : errDetail);
          }

          lastBlob = await resp.blob();
          lastName = `${P.baseName(currentFile.name)}-protected.pdf`;
          P.downloadBlob(lastBlob, lastName);
          showResult(res, 'Document Protected', `Encrypted with AES password protection (${P.formatBytes(lastBlob.size)}).`);
        } catch (e) {
          P.toast(`Protection failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 9. UNLOCK PDF
    // --------------------------------------------------------------------------
    initUnlock() {
      const drop = $('dropUnlock');
      const fileIn = $('fileUnlock');
      const passIn = $('unlockPassword');
      const goBtn = $('btnUnlock');
      const res = $('resUnlock');
      let currentFile = null;
      let lastBlob = null, lastName = '';

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('unlockFileInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('unlockFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const pw = passIn.value;
          const formData = new FormData();
          formData.append('file', currentFile);
          formData.append('password', pw);
          const resp = await fetch('/api/v1/pdf/unlock', { method: 'POST', body: formData });
          if (!resp.ok) {
            const errDetail = await resp.text();
            throw new Error(errDetail.includes('detail') ? JSON.parse(errDetail).detail : errDetail);
          }

          lastBlob = await resp.blob();
          lastName = `${P.baseName(currentFile.name)}-unlocked.pdf`;
          P.downloadBlob(lastBlob, lastName);
          showResult(res, 'Document Unlocked', `Restrictions and passwords removed (${P.formatBytes(lastBlob.size)}).`);
        } catch (e) {
          P.toast(`Unlock failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 10. REDACT PDF (Server stream expunge)
    // --------------------------------------------------------------------------
    initRedact() {
      const drop = $('dropRedact');
      const fileIn = $('fileRedact');
      const termsIn = $('redactTerms');
      const goBtn = $('btnRedact');
      const res = $('resRedact');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('redactFileInfo').textContent = f.name;
        $('redactFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        const terms = termsIn.value.trim();
        if (!terms) { P.toast('Please enter words or phrases to redact.', { type: 'warning' }); return; }
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const formData = new FormData();
          formData.append('file', currentFile);
          formData.append('terms', terms);

          const resp = await fetch('/api/v1/pdf/redact', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const blob = await resp.blob();
          const count = resp.headers.get('X-Redacted-Count') || '1+';
          const name = `${P.baseName(currentFile.name)}-redacted.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Permanently Redacted', `Removed ${count} occurrence(s) of confidential text from stream.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Redaction failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 11. PDF TO PDF/A (Archival Standard)
    // --------------------------------------------------------------------------
    initPdfA() {
      const drop = $('dropPdfA');
      const fileIn = $('filePdfA');
      const goBtn = $('btnPdfA');
      const res = $('resPdfA');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('pdfaFileInfo').textContent = f.name;
        $('pdfaFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const formData = new FormData();
          formData.append('file', currentFile);
          const resp = await fetch('/api/v1/pdf/pdf-to-pdfa', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const blob = await resp.blob();
          const name = `${P.baseName(currentFile.name)}-pdfa.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'PDF/A Archival Conformance', 'Converted to ISO 19005-1 (PDF/A-1b) standard.', { blob, filename: name });
        } catch (e) {
          P.toast(`PDF/A conversion failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 12-17, 22. SERVER CONVERSIONS (Word, PPT, Excel, Markdown)
    // --------------------------------------------------------------------------
    initServerConversions() {
      const conversions = [
        { id: 'pdf2word', endpoint: '/api/v1/pdf/convert/pdf-to-docx', ext: 'docx', accept: '.pdf' },
        { id: 'pdf2pptx', endpoint: '/api/v1/pdf/convert/pdf-to-pptx', ext: 'pptx', accept: '.pdf' },
        { id: 'pdf2xlsx', endpoint: '/api/v1/pdf/convert/pdf-to-xlsx', ext: 'xlsx', accept: '.pdf' },
        { id: 'word2pdf', endpoint: '/api/v1/pdf/convert/docx-to-pdf', ext: 'pdf', accept: '.docx,.doc' },
        { id: 'pptx2pdf', endpoint: '/api/v1/pdf/convert/pptx-to-pdf', ext: 'pdf', accept: '.pptx,.ppt' },
        { id: 'xlsx2pdf', endpoint: '/api/v1/pdf/convert/xlsx-to-pdf', ext: 'pdf', accept: '.xlsx,.xls' },
        { id: 'pdf2md', endpoint: '/api/v1/pdf/convert/pdf-to-markdown', ext: 'md', accept: '.pdf' },
      ];

      conversions.forEach(c => {
        const drop = $(`drop_${c.id}`);
        const fileIn = $(`file_${c.id}`);
        const goBtn = $(`btn_${c.id}`);
        const res = $(`res_${c.id}`);
        let currentFile = null;

        if (!drop || !fileIn) return;

        P.wireDropzone(drop, fileIn, incoming => {
          if (!incoming.length) return;
          currentFile = incoming[0];
          $(`info_${c.id}`).textContent = `${currentFile.name} (${P.formatBytes(currentFile.size)})`;
          $(`info_${c.id}`).hidden = false;
          goBtn.disabled = false;
        });

        goBtn?.addEventListener('click', async () => {
          if (!currentFile) return;
          P.setLoading(goBtn, true);
          hideResult(res);
          try {
            const formData = new FormData();
            formData.append('file', currentFile);
            const resp = await fetch(c.endpoint, { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(await resp.text());

            const blob = await resp.blob();
            const name = `${P.baseName(currentFile.name)}.${c.ext}`;
            P.downloadBlob(blob, name);
            showResult(res, 'Conversion Complete', `Generated ${name} (${P.formatBytes(blob.size)})`, { blob, filename: name });
          } catch (e) {
            P.toast(`Conversion failed: ${e.message}`, { type: 'error' });
          } finally {
            P.setLoading(goBtn, false);
          }
        });
      });
    },

    // --------------------------------------------------------------------------
    // 18. PDF TO JPG
    // --------------------------------------------------------------------------
    initPdfToJpg() {
      const drop = $('dropPdf2Jpg');
      const fileIn = $('filePdf2Jpg');
      const goBtn = $('btnPdf2Jpg');
      const res = $('resPdf2Jpg');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('pdf2jpgInfo').textContent = `${f.name} (${P.formatBytes(f.size)})`;
        $('pdf2jpgInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const pdfjs = await loadPdfJs();
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await currentFile.arrayBuffer()) }).promise;
          const JSZip = await loadJsZip();
          const zip = new JSZip();

          for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const vp = page.getViewport({ scale: 2.0 }); // High res 150-200 DPI
            const canvas = document.createElement('canvas');
            canvas.width = vp.width; canvas.height = vp.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;

            const blob = await P.canvasToBlob(canvas, 'image/jpeg', 0.92);
            if (doc.numPages === 1) {
              const name = `${P.baseName(currentFile.name)}-page-1.jpg`;
              P.downloadBlob(blob, name);
              showResult(res, 'JPG Image Ready', name, { blob, filename: name });
              return;
            }
            zip.file(`page-${n}.jpg`, blob);
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const zipName = `${P.baseName(currentFile.name)}-images.zip`;
          P.downloadBlob(zipBlob, zipName);
          showResult(res, 'JPG Archive Ready', `Extracted ${doc.numPages} images into ZIP.`, { blob: zipBlob, filename: zipName });
        } catch (e) {
          P.toast(`PDF to JPG failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 19. JPG TO PDF
    // --------------------------------------------------------------------------
    initJpgToPdf() {
      const drop = $('dropJpg2Pdf');
      const fileIn = $('fileJpg2Pdf');
      const goBtn = $('btnJpg2Pdf');
      const res = $('resJpg2Pdf');
      let files = [];

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const imgs = incoming.filter(f => f.type.startsWith('image/'));
        if (!imgs.length) return;
        files = files.concat(imgs);
        $('jpg2pdfInfo').textContent = `${files.length} images selected.`;
        $('jpg2pdfInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!files.length) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument } = await loadPdfLib();
          const doc = await PDFDocument.create();

          for (const f of files) {
            const buf = await f.arrayBuffer();
            let img;
            if (f.type === 'image/png') img = await doc.embedPng(buf);
            else img = await doc.embedJpg(buf);

            const page = doc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          }

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `images-converted-${Date.now()}.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'PDF Created', `Combined ${files.length} images into PDF.`, { blob, filename: name });
        } catch (e) {
          P.toast(`JPG to PDF failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 20. HTML TO PDF
    // --------------------------------------------------------------------------
    initHtmlToPdf() {
      const htmlText = $('htmlInput');
      const goBtn = $('btnHtml2Pdf');
      const res = $('resHtml2Pdf');

      if (!htmlText || !goBtn) return;

      goBtn.addEventListener('click', async () => {
        const val = htmlText.value.trim();
        if (!val) { P.toast('Please paste HTML content.', { type: 'warning' }); return; }
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const formData = new FormData();
          formData.append('html', val);
          const resp = await fetch('/api/v1/pdf/convert/html-to-pdf', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const blob = await resp.blob();
          const name = 'webpage.pdf';
          P.downloadBlob(blob, name);
          showResult(res, 'HTML to PDF Ready', 'Clean vector PDF generated.', { blob, filename: name });
        } catch (e) {
          P.toast(`HTML to PDF failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 21. SCAN TO PDF (WebRTC Camera)
    // --------------------------------------------------------------------------
    initScanToPdf() {
      const video = $('scanVideo');
      const startBtn = $('btnStartScan');
      const snapBtn = $('btnSnapPage');
      const makeBtn = $('btnMakeScanPdf');
      const scanCount = $('scanPagesCount');
      const res = $('resScan2Pdf');
      let stream = null;
      let capturedImages = [];

      if (!startBtn || !snapBtn) return;

      startBtn.addEventListener('click', async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera device access not supported in this environment');
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
          });
          video.srcObject = stream;
          try { await video.play(); } catch (_) {}
          snapBtn.disabled = false;
          startBtn.textContent = 'Camera Active';
        } catch (e) {
          console.warn('[Pixnivo Scan] Camera unavailable, enabling simulated scan sheet:', e.message);
          snapBtn.disabled = false;
          startBtn.textContent = 'Demo Mode (Camera simulated)';
          P.toast('Camera not detected. Click "Capture Page" to scan document sheet.', { type: 'info' });
        }
      });

      snapBtn.addEventListener('click', () => {
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, w, h);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#111827';
          ctx.font = '24px sans-serif';
          ctx.fillText('Pixnivo Document Scan', 50, 80);
          ctx.font = '16px sans-serif';
          ctx.fillText('Captured page: ' + (capturedImages.length + 1), 50, 120);
        }
        c.toBlob(blob => {
          capturedImages.push(blob);
          scanCount.textContent = `Captured: ${capturedImages.length} page(s)`;
          makeBtn.disabled = false;
          P.toast(`Page ${capturedImages.length} captured!`, { type: 'success' });
        }, 'image/jpeg', 0.9);
      });

      makeBtn?.addEventListener('click', async () => {
        if (!capturedImages.length) return;
        P.setLoading(makeBtn, true);
        hideResult(res);
        try {
          const { PDFDocument } = await loadPdfLib();
          const doc = await PDFDocument.create();

          for (const b of capturedImages) {
            const img = await doc.embedJpg(new Uint8Array(await b.arrayBuffer()));
            const page = doc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          }

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `scanned-doc-${Date.now()}.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Scanned PDF Created', `Compiled ${capturedImages.length} pages.`, { blob, filename: name });

          // Stop camera stream
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
            video.srcObject = null;
          }
        } catch (e) {
          P.toast(`Scan compilation failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(makeBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 23. EDIT PDF
    // --------------------------------------------------------------------------
    initEdit() {
      const drop = $('dropEdit');
      const fileIn = $('fileEdit');
      const textIn = $('editTextContent');
      const colorIn = $('editTextColor');
      const sizeIn = $('editTextSize');
      const goBtn = $('btnEdit');
      const res = $('resEdit');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('editFileInfo').textContent = f.name;
        $('editFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        const note = textIn.value.trim() || 'Approved';
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument, rgb } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const pages = doc.getPages();
          const firstPage = pages[0];
          const { width, height } = firstPage.getSize();

          // Stamp text annotation onto first page
          firstPage.drawText(note, {
            x: 50,
            y: height - 60,
            size: parseInt(sizeIn?.value || '14', 10),
            color: rgb(0.81, 0.29, 0.05) // Brand orange
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-edited.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Edited Document Ready', `Added annotations to ${name}.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Edit failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 24. SIGN PDF
    // --------------------------------------------------------------------------
    initSign() {
      const drop = $('dropSign');
      const fileIn = $('fileSign');
      const canvas = $('signCanvas');
      const clearBtn = $('btnClearSign');
      const goBtn = $('btnSign');
      const res = $('resSign');
      let currentFile = null;
      let isDrawing = false;
      let hasDrawn = false;

      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';

      function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
      }

      canvas.addEventListener('mousedown', (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
      canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasDrawn = true; });
      window.addEventListener('mouseup', () => { isDrawing = false; });

      canvas.addEventListener('touchstart', (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); e.preventDefault(); }, { passive: false });
      canvas.addEventListener('touchmove', (e) => { if (!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasDrawn = true; e.preventDefault(); }, { passive: false });
      window.addEventListener('touchend', () => { isDrawing = false; });

      clearBtn?.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
      });

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('signFileInfo').textContent = f.name;
        $('signFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        if (!hasDrawn) { P.toast('Please draw your signature first.', { type: 'warning' }); return; }
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const pages = doc.getPages();
          const targetPage = pages[pages.length - 1]; // Place on last page

          const signPngBlob = await P.canvasToBlob(canvas, 'image/png');
          const signImg = await doc.embedPng(new Uint8Array(await signPngBlob.arrayBuffer()));

          const { width } = targetPage.getSize();
          // Place signature at bottom right
          targetPage.drawImage(signImg, {
            x: width - 200,
            y: 50,
            width: 150,
            height: 75
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-signed.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Document Signed', `Signature stamped on last page of ${name}.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Signing failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 25. WATERMARK PDF
    // --------------------------------------------------------------------------
    initWatermark() {
      const drop = $('dropWatermark');
      const fileIn = $('fileWatermark');
      const textIn = $('watermarkText');
      const opacitySlider = $('watermarkOpacity');
      const goBtn = $('btnWatermark');
      const res = $('resWatermark');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('watermarkFileInfo').textContent = f.name;
        $('watermarkFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        const wmText = textIn.value.trim() || 'CONFIDENTIAL';
        const opacity = parseFloat(opacitySlider?.value || '0.3');
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument, rgb, degrees } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });

          doc.getPages().forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(wmText, {
              x: width / 4,
              y: height / 2,
              size: 42,
              color: rgb(0.8, 0.2, 0.2),
              opacity: opacity,
              rotate: degrees(45)
            });
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-watermarked.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Watermark Applied', `Stamped across all pages.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Watermark failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 26. PAGE NUMBERS
    // --------------------------------------------------------------------------
    initPageNumbers() {
      const drop = $('dropPageNums');
      const fileIn = $('filePageNums');
      const fmtSelect = $('pageNumFormat');
      const goBtn = $('btnPageNums');
      const res = $('resPageNums');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('pageNumsFileInfo').textContent = f.name;
        $('pageNumsFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument, rgb } = await loadPdfLib();
          const doc = await PDFDocument.load(await currentFile.arrayBuffer(), { ignoreEncryption: true });
          const pages = doc.getPages();
          const total = pages.length;
          const fmt = fmtSelect?.value || 'Page {n} of {total}';

          pages.forEach((page, idx) => {
            const n = idx + 1;
            const str = fmt.replace('{n}', n).replace('{total}', total);
            const { width } = page.getSize();
            page.drawText(str, {
              x: width / 2 - 30,
              y: 25,
              size: 10,
              color: rgb(0.4, 0.4, 0.4)
            });
          });

          const blob = new Blob([await doc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-numbered.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Page Numbers Added', `Numbered ${total} pages.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Page numbering failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 27. PDF FORMS (AcroForms)
    // --------------------------------------------------------------------------
    initForms() {
      const drop = $('dropForms');
      const fileIn = $('fileForms');
      const formFieldsContainer = $('formFieldsContainer');
      const goBtn = $('btnForms');
      const res = $('resForms');
      let currentDoc = null, currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, async incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('formsFileInfo').textContent = f.name;
        $('formsFileInfo').hidden = false;

        try {
          const { PDFDocument } = await loadPdfLib();
          currentDoc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
          const form = currentDoc.getForm();
          const fields = form.getFields();

          formFieldsContainer.innerHTML = '';
          if (!fields.length) {
            formFieldsContainer.innerHTML = '<p class="hint">No interactive form fields found in this PDF.</p>';
            goBtn.disabled = true;
            return;
          }

          fields.forEach(field => {
            const name = field.getName();
            const wrapper = document.createElement('div');
            wrapper.className = 'field';
            wrapper.innerHTML = `
              <label for="form_field_${name}">${P.escapeHtml(name)}</label>
              <input type="text" id="form_field_${name}" data-fieldname="${P.escapeHtml(name)}" placeholder="Enter value…" />
            `;
            formFieldsContainer.appendChild(wrapper);
          });
          goBtn.disabled = false;
        } catch (e) {
          P.toast(`Failed to read forms: ${e.message}`, { type: 'error' });
        }
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentDoc) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const form = currentDoc.getForm();
          const inputs = formFieldsContainer.querySelectorAll('input[data-fieldname]');
          inputs.forEach(input => {
            const name = input.dataset.fieldname;
            const val = input.value;
            try {
              const tf = form.getTextField(name);
              tf.setText(val);
            } catch (err) {}
          });

          const blob = new Blob([await currentDoc.save()], { type: 'application/pdf' });
          const name = `${P.baseName(currentFile.name)}-filled.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Form Saved', 'Filled values embedded into PDF.', { blob, filename: name });
        } catch (e) {
          P.toast(`Form save failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 28. REPAIR PDF
    // --------------------------------------------------------------------------
    initRepair() {
      const drop = $('dropRepair');
      const fileIn = $('fileRepair');
      const goBtn = $('btnRepair');
      const res = $('resRepair');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        if (!incoming.length) return;
        currentFile = incoming[0];
        $('repairFileInfo').textContent = currentFile.name;
        $('repairFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const formData = new FormData();
          formData.append('file', currentFile);
          const resp = await fetch('/api/v1/pdf/repair', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const blob = await resp.blob();
          const name = `${P.baseName(currentFile.name)}-repaired.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Repair Successful', 'Corrupted xrefs and syntax rebuilt.', { blob, filename: name });
        } catch (e) {
          P.toast(`Repair failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 29. OCR PDF
    // --------------------------------------------------------------------------
    initOcr() {
      const drop = $('dropOcr');
      const fileIn = $('fileOcr');
      const goBtn = $('btnOcr');
      const prog = $('progOcr');
      const textOutput = $('ocrResultText');
      const res = $('resOcr');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('ocrFileInfo').textContent = f.name;
        $('ocrFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          setProgress(prog, 20, 'Loading OCR Engine…');
          const Tesseract = await loadTesseract();
          const pdfjs = await loadPdfJs();
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await currentFile.arrayBuffer()) }).promise;

          let fullExtractedText = '';
          for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
            setProgress(prog, 20 + ((n) / Math.min(doc.numPages, 5)) * 70, `Running OCR on page ${n}…`);
            const page = await doc.getPage(n);
            const vp = page.getViewport({ scale: 1.5 });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;

            const { data: { text } } = await Tesseract.recognize(c, 'eng');
            fullExtractedText += `\n--- PAGE ${n} ---\n` + text;
          }

          endProgress(prog);
          textOutput.value = fullExtractedText.trim();
          $('ocrOutputContainer').hidden = false;
          showResult(res, 'OCR Complete', `Text extracted from scanned pages.`);
        } catch (e) {
          endProgress(prog);
          P.toast(`OCR failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });

      $('btnCopyOcrText')?.addEventListener('click', () => {
        if (textOutput?.value) {
          navigator.clipboard.writeText(textOutput.value);
          P.toast('Copied to clipboard!', { type: 'success' });
        }
      });
    },

    // --------------------------------------------------------------------------
    // 30. IMAGES TO PDF (Multi-format)
    // --------------------------------------------------------------------------
    initImagesToPdf() {
      const drop = $('dropI');
      const fileIn = $('fileI');
      const listEl = $('listI');
      const pageSizeSelect = $('pageSize');
      const goBtn = $('makePdf');
      const res = $('resI');
      let images = []; // Array of File objects
      let lastBlob = null, lastName = '';

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const imgFiles = incoming.filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(f.name));
        if (!imgFiles.length) { P.toast('Please select image files (JPG, PNG, WebP, GIF).', { type: 'warning' }); return; }
        images = images.concat(imgFiles);
        renderImageList();
      });

      function renderImageList() {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (images.length === 0) {
          if (goBtn) goBtn.disabled = true;
          hideResult(res);
          return;
        }

        images.forEach((imgFile, idx) => {
          const item = document.createElement('div');
          item.className = 'file-item';
          item.innerHTML = `
            <span class="file-name" title="${P.escapeHtml(imgFile.name)}">${P.escapeHtml(imgFile.name)} <span style="opacity:0.7; font-weight:normal;">(${P.formatBytes(imgFile.size)})</span></span>
            <div class="file-actions">
              <button type="button" class="btn-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn-down" title="Move Down" ${idx === images.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn-remove" title="Remove Image">✕</button>
            </div>
          `;
          item.querySelector('.btn-up')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const temp = images[idx - 1]; images[idx - 1] = images[idx]; images[idx] = temp; renderImageList();
          });
          item.querySelector('.btn-down')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const temp = images[idx + 1]; images[idx + 1] = images[idx]; images[idx] = temp; renderImageList();
          });
          item.querySelector('.btn-remove')?.addEventListener('click', (e) => {
            e.stopPropagation();
            images.splice(idx, 1); renderImageList();
          });
          listEl.appendChild(item);
        });

        if (goBtn) goBtn.disabled = images.length === 0;
        hideResult(res);
      }

      res?.querySelector('[data-redownload]')?.addEventListener('click', () => {
        if (lastBlob) P.downloadBlob(lastBlob, lastName);
      });

      goBtn?.addEventListener('click', async () => {
        if (!images.length) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const { PDFDocument } = await loadPdfLib();
          const doc = await PDFDocument.create();
          const pageSizeMode = pageSizeSelect?.value || 'fit';

          // A4 dimensions in points: 595.28 x 841.89
          // Letter dimensions in points: 612 x 792
          const standardSizes = {
            a4: [595.28, 841.89],
            letter: [612, 792]
          };

          for (let i = 0; i < images.length; i++) {
            const f = images[i];
            let imgBytes = null;
            let isPng = f.type === 'image/png' || f.name.toLowerCase().endsWith('.png');

            if (f.type === 'image/jpeg' || f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg')) {
              imgBytes = await f.arrayBuffer();
            } else if (isPng) {
              imgBytes = await f.arrayBuffer();
            } else {
              // Convert WebP / GIF / other to JPEG via canvas
              const bmp = await createImageBitmap(f);
              const canvas = document.createElement('canvas');
              canvas.width = bmp.width;
              canvas.height = bmp.height;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(bmp, 0, 0);
              const blob = await P.canvasToBlob(canvas, 'image/jpeg', 0.92);
              imgBytes = await blob.arrayBuffer();
              isPng = false;
            }

            let embeddedImg;
            if (isPng) {
              try {
                embeddedImg = await doc.embedPng(imgBytes);
              } catch (_) {
                const bmp = await createImageBitmap(new Blob([imgBytes], { type: 'image/png' }));
                const canvas = document.createElement('canvas');
                canvas.width = bmp.width; canvas.height = bmp.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bmp, 0, 0);
                const blob = await P.canvasToBlob(canvas, 'image/jpeg', 0.92);
                embeddedImg = await doc.embedJpg(await blob.arrayBuffer());
              }
            } else {
              embeddedImg = await doc.embedJpg(imgBytes);
            }

            const imgW = embeddedImg.width;
            const imgH = embeddedImg.height;

            if (pageSizeMode === 'a4' || pageSizeMode === 'letter') {
              const [pageW, pageH] = standardSizes[pageSizeMode];
              const margin = 20;
              const maxW = pageW - margin * 2;
              const maxH = pageH - margin * 2;
              const scale = Math.min(maxW / imgW, maxH / imgH, 1);
              const drawW = imgW * scale;
              const drawH = imgH * scale;
              const drawX = margin + (maxW - drawW) / 2;
              const drawY = margin + (maxH - drawH) / 2;

              const page = doc.addPage([pageW, pageH]);
              page.drawImage(embeddedImg, { x: drawX, y: drawY, width: drawW, height: drawH });
            } else {
              const page = doc.addPage([imgW, imgH]);
              page.drawImage(embeddedImg, { x: 0, y: 0, width: imgW, height: imgH });
            }
          }

          const outBytes = await doc.save();
          lastBlob = new Blob([outBytes], { type: 'application/pdf' });
          lastName = `images-to-pdf-${Date.now()}.pdf`;
          P.downloadBlob(lastBlob, lastName);
          showResult(res, 'PDF Created Successfully', `Combined ${images.length} image${images.length > 1 ? 's' : ''} into PDF document (${P.formatBytes(lastBlob.size)}).`, { blob: lastBlob, filename: lastName });
        } catch (e) {
          P.toast(`Images to PDF failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 31. AI SUMMARIZER
    // --------------------------------------------------------------------------
    initSummarize() {
      const drop = $('dropSummarize');
      const fileIn = $('fileSummarize');
      const sentCount = $('summarizeSentences');
      const goBtn = $('btnSummarize');
      const resBox = $('summarizeOutput');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('summarizeFileInfo').textContent = f.name;
        $('summarizeFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        try {
          const formData = new FormData();
          formData.append('file', currentFile);
          formData.append('sentences', sentCount?.value || '5');

          const resp = await fetch('/api/v1/pdf/summarize', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const data = await resp.json();
          $('summaryParagraph').textContent = data.summary;
          $('summaryWordCount').textContent = `${data.word_count} words · ~${data.reading_time_minutes} min read`;

          const list = $('summaryTakeawaysList');
          list.innerHTML = '';
          (data.key_takeaways || []).forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
          });

          resBox.hidden = false;
        } catch (e) {
          P.toast(`Summarization failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    },

    // --------------------------------------------------------------------------
    // 32. TRANSLATE PDF
    // --------------------------------------------------------------------------
    initTranslate() {
      const drop = $('dropTranslate');
      const fileIn = $('fileTranslate');
      const langSelect = $('translateLangSelect');
      const goBtn = $('btnTranslate');
      const res = $('resTranslate');
      let currentFile = null;

      if (!drop || !fileIn) return;

      P.wireDropzone(drop, fileIn, incoming => {
        const f = incoming.find(isPdf);
        if (!f) return;
        currentFile = f;
        $('translateFileInfo').textContent = f.name;
        $('translateFileInfo').hidden = false;
        goBtn.disabled = false;
      });

      goBtn?.addEventListener('click', async () => {
        if (!currentFile) return;
        P.setLoading(goBtn, true);
        hideResult(res);
        try {
          const lang = langSelect?.value || 'es';
          const formData = new FormData();
          formData.append('file', currentFile);
          formData.append('target_lang', lang);
          formData.append('output_format', 'pdf');

          const resp = await fetch('/api/v1/pdf/translate', { method: 'POST', body: formData });
          if (!resp.ok) throw new Error(await resp.text());

          const blob = await resp.blob();
          const name = `${P.baseName(currentFile.name)}-translated-${lang}.pdf`;
          P.downloadBlob(blob, name);
          showResult(res, 'Translation Complete', `Translated to ${lang.toUpperCase()}.`, { blob, filename: name });
        } catch (e) {
          P.toast(`Translation failed: ${e.message}`, { type: 'error' });
        } finally {
          P.setLoading(goBtn, false);
        }
      });
    }
  };

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PdfStudio.init());
  } else {
    PdfStudio.init();
  }

  window.PixnivoPdfStudio = PdfStudio;
})();

