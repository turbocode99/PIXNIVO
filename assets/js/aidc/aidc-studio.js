/**
 * Pixnivo AIDC Studio Runtime
 * Enterprise Automatic Identification & Data Capture Suite.
 */
(function () {
  'use strict';

  const P = window.Pixnivo || {
    toast: (msg, opts) => console.log('[Toast]', msg, opts),
    downloadBlob: (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    },
    copyText: async (text) => {
      await navigator.clipboard.writeText(text);
    },
    loadScript: (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    })
  };

  const BWIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bwip-js/3.4.0/bwip-js-min.js';
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

  // Symbology Catalog
  const SYMBOLOGIES = {
    // 1D Retail
    'upca': { name: 'UPC-A (US Retail)', cat: '1d', bwip: 'upca', hint: '11 digits (check digit added) or 12 digits.', sample: '012345678905' },
    'upce': { name: 'UPC-E (Compact Retail)', cat: '1d', bwip: 'upce', hint: 'Zero-suppressed 6-8 digit retail code.', sample: '0123456' },
    'ean13': { name: 'EAN-13 (Global Retail)', cat: '1d', bwip: 'ean13', hint: '12 digits (check digit added) or 13 digits.', sample: '4006381333931' },
    'ean8': { name: 'EAN-8 (Small Package POS)', cat: '1d', bwip: 'ean8', hint: '7 digits (check digit added) or 8 digits.', sample: '96385074' },
    // 1D Logistics & General
    'code128': { name: 'Code 128 (Universal)', cat: '1d', bwip: 'code128', hint: 'High-density alphanumeric ASCII code.', sample: 'PIXNIVO-PRO-2026' },
    'code39': { name: 'Code 39 (Industrial)', cat: '1d', bwip: 'code39', hint: 'Uppercase A-Z, 0-9 and - . $ / + %', sample: 'PART-9941' },
    'code93': { name: 'Code 93 (High Density)', cat: '1d', bwip: 'code93', hint: 'Compact full ASCII industrial code.', sample: 'PIX-93-001' },
    'codabar': { name: 'Codabar (Libraries & Blood Banks)', cat: '1d', bwip: 'rationalizedCodabar', hint: 'Digits and start/stop chars A, B, C, or D.', sample: 'A12345678B' },
    'itf14': { name: 'ITF-14 (Outer Shipping Cartons)', cat: '1d', bwip: 'itf14', hint: '13 or 14 digits with bearer bars.', sample: '1540014128876' },
    'itf': { name: 'ITF (Interleaved 2 of 5)', cat: '1d', bwip: 'interleaved2of5', hint: 'Even number of digits for warehousing.', sample: '0123456789' },
    'gs1-128': { name: 'GS1-128 (Supply Chain)', cat: '1d', bwip: 'gs1-128', hint: 'GS1 Application Identifiers in brackets.', sample: '(01)09501101530008(17)261231(10)LOT42' },
    'databaromni': { name: 'GS1 DataBar Omnidirectional', cat: '1d', bwip: 'databaromni', hint: 'Retail produce & healthcare 14 digits.', sample: '(01)00012345678905' },
    // Stacked
    'pdf417': { name: 'PDF417 (Manifests & ID Cards)', cat: 'stacked', bwip: 'pdf417', hint: 'Stacked 2D code for boarding passes & transport.', sample: 'PIXNIVO-MANIFEST-48213-BOX-2' },
    'micropdf417': { name: 'MicroPDF417 (Miniature Stacked)', cat: 'stacked', bwip: 'micropdf417', hint: 'High-density miniature stacked code.', sample: 'MPDF-SN-0091' },
    // Matrix 2D
    'qrcode': { name: 'QR Code (ISO/IEC 18004)', cat: '2d', bwip: 'qrcode', hint: 'Universal mobile 2D code for links & contact info.', sample: 'https://pixnivo.app' },
    'microqrcode': { name: 'Micro QR Code', cat: '2d', bwip: 'microqrcode', hint: 'Compact QR code for small electronic components.', sample: 'SN-001' },
    'datamatrix': { name: 'Data Matrix (ECC 200)', cat: '2d', bwip: 'datamatrix', hint: '2D matrix for direct part marking & small items.', sample: 'LOT-2026-X99' },
    'gs1datamatrix': { name: 'GS1 DataMatrix (Healthcare / UDI)', cat: '2d', bwip: 'gs1datamatrix', hint: 'FDA UDI and EU MDR compliant medical serialization.', sample: '(01)09501101530008(21)SN1002(17)261231' },
    'azteccode': { name: 'Aztec Code (Transport & Rail)', cat: '2d', bwip: 'azteccode', hint: 'High-density 2D code with central bullseye.', sample: 'TICKET-2026-9812' },
    'maxicode': { name: 'MaxiCode (UPS Parcel Sorting)', cat: '2d', bwip: 'maxicode', hint: 'Hexagonal grid code for high-speed conveyor sorting.', sample: '[)>*01*96123456789*068*840*1Z001985*UPSN*123X567*001/001*' },
    'hanxin': { name: 'Han Xin Code (Chinese National)', cat: '2d', bwip: 'hanxin', hint: 'Optimized for Chinese characters and logistics.', sample: 'PIXNIVO-HX-8899' }
  };

  const STORAGE_KEY = 'pixnivo_aidc_history';

  // Core Application State
  const state = {
    activeTab: 'studio',
    symbology: 'code128',
    payload: 'PIXNIVO-PRO-2026',
    scale: 4,
    heightMm: 15,
    showText: true,
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    margin: 10,
    eccLevel: 'M',
    title: '',
    sku: '',
    history: [],
    templates: [],
    prefixSettings: {
      companyName: 'Pixnivo Enterprise Partner',
      gs1Prefix: '0950110',
      nextRef: 101,
      isActive: true
    }
  };

  // Helper DOM accessor
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Modulo-10 Check Digit Calculation
  function calculateMod10(digitsStr) {
    const digits = digitsStr.replace(/\D/g, '').split('').map(Number);
    if (!digits.length) return '0';
    let total = 0;
    let weight = 3;
    for (let i = digits.length - 1; i >= 0; i--) {
      total += digits[i] * weight;
      weight = weight === 3 ? 1 : 3;
    }
    const rem = total % 10;
    return String((10 - rem) % 10);
  }

  // Client Validation Engine
  function validateClient(sym, payload) {
    const raw = (payload || '').trim();
    if (!raw) {
      return { status: 'invalid', message: 'Payload cannot be empty' };
    }

    // GTIN Check
    if (['ean13', 'gtin13'].includes(sym)) {
      const clean = raw.replace(/\D/g, '');
      if (clean.length === 12) {
        const c = calculateMod10(clean);
        return { status: 'warning', message: `Missing check digit. Calculated: ${c}`, fix: clean + c };
      }
      if (clean.length === 13) {
        const expected = calculateMod10(clean.slice(0, 12));
        if (clean[12] !== expected) {
          return { status: 'invalid', message: `Checksum mismatch. Expected '${expected}'`, fix: clean.slice(0, 12) + expected };
        }
        return { status: 'valid', message: 'Valid EAN-13 (GTIN-13)' };
      }
      return { status: 'invalid', message: `EAN-13 requires 12 or 13 digits (found ${clean.length})` };
    }

    if (['upca', 'gtin12'].includes(sym)) {
      const clean = raw.replace(/\D/g, '');
      if (clean.length === 11) {
        const c = calculateMod10(clean);
        return { status: 'warning', message: `Missing check digit. Calculated: ${c}`, fix: clean + c };
      }
      if (clean.length === 12) {
        const expected = calculateMod10(clean.slice(0, 11));
        if (clean[11] !== expected) {
          return { status: 'invalid', message: `Checksum mismatch. Expected '${expected}'`, fix: clean.slice(0, 11) + expected };
        }
        return { status: 'valid', message: 'Valid UPC-A (GTIN-12)' };
      }
      return { status: 'invalid', message: `UPC-A requires 11 or 12 digits (found ${clean.length})` };
    }

    if (['ean8', 'gtin8'].includes(sym)) {
      const clean = raw.replace(/\D/g, '');
      if (clean.length === 7) {
        const c = calculateMod10(clean);
        return { status: 'warning', message: `Missing check digit. Calculated: ${c}`, fix: clean + c };
      }
      if (clean.length === 8) {
        const expected = calculateMod10(clean.slice(0, 7));
        if (clean[7] !== expected) {
          return { status: 'invalid', message: `Checksum mismatch. Expected '${expected}'`, fix: clean.slice(0, 7) + expected };
        }
        return { status: 'valid', message: 'Valid EAN-8 (GTIN-8)' };
      }
      return { status: 'invalid', message: `EAN-8 requires 7 or 8 digits (found ${clean.length})` };
    }

    if (sym === 'code39') {
      if (!/^[0-9A-Z\-\.\ \$\/\+\%]+$/i.test(raw)) {
        return { status: 'invalid', message: 'Code 39 only allows uppercase A-Z, 0-9, and - . $ / + % [space]' };
      }
      return { status: 'valid', message: 'Valid Code 39 format' };
    }

    if (sym === 'itf' || sym === 'itf14') {
      const clean = raw.replace(/\D/g, '');
      if (clean.length % 2 !== 0) {
        return { status: 'warning', message: 'ITF requires an even number of digits', fix: '0' + clean };
      }
      return { status: 'valid', message: 'Valid Interleaved 2 of 5' };
    }

    if (sym.startsWith('gs1')) {
      if (!/\([0-9]{2,4}\)/.test(raw)) {
        return { status: 'warning', message: 'GS1 standard usually contains bracketed AIs, e.g. (01)...(10)...' };
      }
      return { status: 'valid', message: 'GS1 format detected' };
    }

    return { status: 'valid', message: 'Valid payload' };
  }

  // Ensure BWIP-JS is loaded
  async function ensureBwip() {
    if (window.bwipjs) return;
    await P.loadScript(BWIP_URL);
  }

  // Render Barcode to Canvas
  let renderTimer = null;
  async function renderBarcode() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      try {
        await ensureBwip();
        const canvas = $('aidcCanvas');
        if (!canvas) return;

        const symDef = SYMBOLOGIES[state.symbology] || SYMBOLOGIES['code128'];
        const is2D = ['2d', 'stacked'].includes(symDef.cat);

        // Validation status
        const v = validateClient(state.symbology, state.payload);
        updateValidationBadge(v);

        // Prepare BWIP options
        const opts = {
          bcid: symDef.bwip,
          text: state.payload,
          scale: state.scale,
          includetext: state.showText && !is2D,
          textxalign: 'center',
          textsize: 10,
          backgroundcolor: state.bgColor.replace('#', ''),
          barcolor: state.fgColor.replace('#', ''),
          paddingwidth: state.margin,
          paddingheight: state.margin
        };

        if (!is2D) {
          opts.height = state.heightMm;
        }

        // Render via BWIP-JS
        window.bwipjs.toCanvas(canvas, opts);

        // Generate SVG Vector Code for Copy
        updateSvgVectorCache(canvas);

        // Hide error message
        const alertEl = $('renderAlert');
        if (alertEl) alertEl.hidden = true;
      } catch (err) {
        console.warn('[AIDC Render Error]', err);
        const alertEl = $('renderAlert');
        if (alertEl) {
          alertEl.hidden = false;
          $('renderAlertText').textContent = `Render Warning: ${err.message || 'Invalid characters for this symbology'}`;
        }
      }
    }, 40);
  }

  function updateValidationBadge(v) {
    const badge = $('validationBadge');
    const fixBtn = $('btnAutoFix');
    if (!badge) return;

    badge.className = `aidc-val-pill pill-${v.status}`;
    if (v.status === 'valid') {
      badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>${v.message}</span>`;
      if (fixBtn) fixBtn.hidden = true;
    } else if (v.status === 'warning') {
      badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> <span>${v.message}</span>`;
      if (fixBtn && v.fix) {
        fixBtn.hidden = false;
        fixBtn.onclick = () => {
          $('aidcPayload').value = v.fix;
          state.payload = v.fix;
          renderBarcode();
        };
      }
    } else {
      badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> <span>${v.message}</span>`;
      if (fixBtn && v.fix) {
        fixBtn.hidden = false;
        fixBtn.onclick = () => {
          $('aidcPayload').value = v.fix;
          state.payload = v.fix;
          renderBarcode();
        };
      } else if (fixBtn) {
        fixBtn.hidden = true;
      }
    }
  }

  let cachedSvg = '';
  function updateSvgVectorCache(canvas) {
    try {
      // Basic SVG wrapper
      const w = canvas.width;
      const h = canvas.height;
      const dataUrl = canvas.toDataURL('image/png');
      cachedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image href="${dataUrl}" width="${w}" height="${h}"/>
</svg>`;
    } catch (e) {
      cachedSvg = '';
    }
  }

  // Navigation Router
  function switchTab(tabId) {
    state.activeTab = tabId;
    $$('.aidc-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    $$('.aidc-subview').forEach(view => {
      view.classList.toggle('active', view.id === `view_${tabId}`);
    });

    window.location.hash = tabId;

    if (tabId === 'studio') {
      renderBarcode();
    } else if (tabId === 'history') {
      loadHistoryView();
    } else if (tabId === 'templates') {
      loadTemplatesView();
    } else if (tabId === 'dashboard') {
      loadDashboardView();
    } else if (tabId === 'api') {
      updateApiPlayground();
    } else if (tabId === 'settings') {
      loadSettingsView();
    }
  }

  // Load Dashboard Data
  async function loadDashboardView() {
    try {
      const resp = await fetch('/api/v1/aidc/analytics');
      if (resp.ok) {
        const data = await resp.json();
        $('dashTotalGen').textContent = (data.total_generations || 0).toLocaleString();
        $('dashTotalAssets').textContent = (data.total_assets || 0).toLocaleString();
        $('dashStorage').textContent = `${data.storage_usage_kb || 0} KB`;
      }
    } catch (e) {
      console.warn('Analytics fetch error', e);
    }
  }

  // Load Templates Catalog
  async function loadTemplatesView() {
    const grid = $('templatesGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="aidc-loading-spinner">Loading templates…</div>';

    try {
      const resp = await fetch('/api/v1/aidc/templates');
      const templates = resp.ok ? await resp.json() : [];
      state.templates = templates;

      grid.innerHTML = templates.map(t => `
        <div class="aidc-template-card">
          <div class="aidc-template-head">
            <span class="badge badge-brand">${t.category}</span>
            <span class="aidc-template-sym">${t.symbology.toUpperCase()}</span>
          </div>
          <h4>${t.name}</h4>
          <p>${t.description}</p>
          <div class="aidc-template-preview-code"><code>${t.payload_pattern || '—'}</code></div>
          <button class="btn btn-primary btn-sm btn-block" onclick="PixnivoAIDC.applyTemplate('${t.id}')">
            Use Template
          </button>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = '<p class="hint">Failed to load online templates. Please try again.</p>';
    }
  }

  // Apply Template into Studio
  function applyTemplate(id) {
    const t = (state.templates || []).find(x => x.id === id);
    if (!t) return;
    state.symbology = t.symbology;
    state.payload = t.payload_pattern || '123456';
    if ($('aidcSymbology')) $('aidcSymbology').value = state.symbology;
    if ($('aidcPayload')) $('aidcPayload').value = state.payload;
    switchTab('studio');
    P.toast(`Applied "${t.name}" template`, { type: 'success' });
  }

  // Identifiers Generator View
  function initIdentifiersTab() {
    const btnGen = $('btnGenIdentifiers');
    if (!btnGen) return;

    btnGen.onclick = async () => {
      const type = $('idGenType').value;
      const count = parseInt($('idGenCount').value, 10) || 1;
      const prefix = $('idGenPrefix').value.trim();

      const btn = $('btnGenIdentifiers');
      btn.disabled = true;
      btn.textContent = 'Generating…';

      try {
        const resp = await fetch('/api/v1/aidc/identifiers/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: type,
            quantity: count,
            country_or_company_prefix: prefix || undefined
          })
        });

        if (!resp.ok) throw new Error('Failed to generate identifiers');
        const data = await resp.json();

        // Populate results table
        const tbody = $('idResultsBody');
        tbody.innerHTML = data.identifiers.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><code>${item.payload}</code></td>
            <td><span class="badge">${item.type.toUpperCase()}</span></td>
            <td>${item.check_digit ? `<code>${item.check_digit}</code>` : '—'}</td>
            <td>
              <div class="btn-row">
                <button class="btn btn-sm btn-ghost" onclick="PixnivoAIDC.copyToClipboard('${item.payload}')">Copy</button>
                <button class="btn btn-sm btn-primary" onclick="PixnivoAIDC.loadIntoStudio('${item.type}', '${item.payload}')">To Studio</button>
              </div>
            </td>
          </tr>
        `).join('');

        $('idResultsCard').hidden = false;
        P.toast(`Generated ${data.count} identifier(s)`, { type: 'success' });
      } catch (err) {
        P.toast(err.message, { type: 'error' });
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Identifiers';
      }
    };
  }

  function loadIntoStudio(sym, payload) {
    let targetSym = sym;
    if (sym === 'gtin13') targetSym = 'ean13';
    if (sym === 'gtin12') targetSym = 'upca';
    if (sym === 'gtin8') targetSym = 'ean8';
    if (sym === 'gtin14') targetSym = 'itf14';
    if (sym.startsWith('uuid') || sym === 'guid') targetSym = 'qrcode';
    if (sym === 'gs1_digital_link') targetSym = 'qrcode';

    state.symbology = targetSym;
    state.payload = payload;

    if ($('aidcSymbology')) $('aidcSymbology').value = targetSym;
    if ($('aidcPayload')) $('aidcPayload').value = payload;

    switchTab('studio');
    P.toast(`Loaded into Barcode Studio`, { type: 'info' });
  }

  // Batch Generator View
  function initBatchTab() {
    const fileInput = $('batchFileInput');
    const dropZone = $('batchDropZone');
    const btnProcess = $('btnProcessBatch');

    if (!fileInput || !dropZone) return;

    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleBatchFileSelected(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = () => {
      if (fileInput.files.length) handleBatchFileSelected(fileInput.files[0]);
    };

    let selectedBatchFile = null;
    function handleBatchFileSelected(file) {
      selectedBatchFile = file;
      $('batchFileName').textContent = file.name;
      $('batchFileSize').textContent = `(${Math.round(file.size / 1024)} KB)`;
      $('batchFileDetails').hidden = false;
      btnProcess.disabled = false;
    }

    btnProcess.onclick = async () => {
      if (!selectedBatchFile) return;

      btnProcess.disabled = true;
      $('batchProgress').hidden = false;
      $('batchStatusText').textContent = 'Uploading and processing batch…';

      const formData = new FormData();
      formData.append('file', selectedBatchFile);
      formData.append('default_symbology', $('batchDefaultSym').value);

      try {
        const resp = await fetch('/api/v1/aidc/batch/process', {
          method: 'POST',
          body: formData
        });

        if (!resp.ok) throw new Error('Batch processing failed on server');
        const data = await resp.json();

        // Render preview table
        const tbody = $('batchTableBody');
        tbody.innerHTML = (data.items || []).map(r => `
          <tr>
            <td>${r.row}</td>
            <td>${r.title || '—'}</td>
            <td><code>${r.sku || '—'}</code></td>
            <td><code>${r.payload}</code></td>
            <td><span class="badge ${r.status === 'valid' ? 'badge-success' : (r.status === 'warning' ? 'badge-warning' : 'badge-danger')}">${r.status.toUpperCase()}</span></td>
          </tr>
        `).join('');

        $('batchResultsCard').hidden = false;
        $('batchSummaryCounts').textContent = `Total: ${data.total_records} | Valid: ${data.valid_count} | Warnings: ${data.warning_count} | Invalid: ${data.invalid_count}`;

        // Set up ZIP download button
        if (data.zip_base64) {
          const btnZip = $('btnDownloadBatchZip');
          btnZip.hidden = false;
          btnZip.onclick = () => {
            const byteCharacters = atob(data.zip_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/zip' });
            P.downloadBlob(blob, `aidc_batch_${Date.now()}.zip`);
          };
        }

        P.toast(`Batch complete! Processed ${data.total_records} rows`, { type: 'success' });
      } catch (err) {
        P.toast(err.message, { type: 'error' });
      } finally {
        btnProcess.disabled = false;
        $('batchProgress').hidden = true;
      }
    };
  }

  // History & Library View
  async function loadHistoryView() {
    const listEl = $('historyList');
    if (!listEl) return;

    try {
      const resp = await fetch('/api/v1/aidc/history');
      const items = resp.ok ? await resp.json() : [];
      state.history = items;

      if (!items.length) {
        listEl.innerHTML = '<p class="hint">No saved barcodes in library yet. Generate an asset in Studio and click "Save to Library".</p>';
        return;
      }

      listEl.innerHTML = items.map(it => `
        <div class="aidc-history-item" id="item_${it.id}">
          <div class="aidc-history-info">
            <div class="aidc-history-head">
              <span class="badge badge-brand">${it.symbology.toUpperCase()}</span>
              <strong>${it.title || 'Untitled Asset'}</strong>
              ${it.sku ? `<span class="hint">SKU: ${it.sku}</span>` : ''}
            </div>
            <div class="aidc-history-payload"><code>${it.raw_payload}</code></div>
            <div class="hint">${it.created_at || 'Just now'}</div>
          </div>
          <div class="aidc-history-actions">
            <button class="btn btn-sm btn-ghost" onclick="PixnivoAIDC.toggleFavorite('${it.id}')">
              ${it.is_favorite ? '★ Favorited' : '☆ Favorite'}
            </button>
            <button class="btn btn-sm btn-primary" onclick="PixnivoAIDC.loadIntoStudio('${it.symbology}', '${it.raw_payload}')">
              Open in Studio
            </button>
            <button class="btn btn-sm btn-danger" onclick="PixnivoAIDC.deleteHistoryItem('${it.id}')">
              Delete
            </button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      listEl.innerHTML = '<p class="hint">Could not connect to history storage.</p>';
    }
  }

  async function toggleFavorite(id) {
    try {
      await fetch(`/api/v1/aidc/history/${id}/favorite`, { method: 'POST' });
      loadHistoryView();
    } catch (e) {}
  }

  async function deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to delete this asset from your library?')) return;
    try {
      await fetch(`/api/v1/aidc/history/${id}`, { method: 'DELETE' });
      const el = $(`item_${id}`);
      if (el) el.remove();
      P.toast('Asset removed from library', { type: 'info' });
    } catch (e) {}
  }

  async function saveCurrentToLibrary() {
    const payload = {
      symbology: state.symbology,
      raw_payload: state.payload,
      title: state.title || `${state.symbology.toUpperCase()} Asset`,
      sku: state.sku,
      visual_config: {
        scale: state.scale,
        height_mm: state.heightMm,
        show_text: state.showText
      }
    };

    try {
      const resp = await fetch('/api/v1/aidc/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        P.toast('Saved to Workspace Library', { type: 'success' });
      }
    } catch (e) {
      P.toast('Failed to save to cloud library', { type: 'error' });
    }
  }

  // API Playground Code Generation
  function updateApiPlayground() {
    const lang = $('apiLanguage') ? $('apiLanguage').value : 'js';
    const codeEl = $('apiCodeOutput');
    if (!codeEl) return;

    const sym = state.symbology;
    const payload = state.payload;
    const baseUrl = 'https://pixnivo.app';

    let code = '';
    if (lang === 'js') {
      code = `// JavaScript Fetch
const response = await fetch('${baseUrl}/api/v1/aidc/render', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Pixnivo-Api-Key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    symbology: '${sym}',
    payload: '${payload}',
    format: 'svg'
  })
});
const data = await response.json();
console.log('SVG Vector:', data.data);`;
    } else if (lang === 'ts') {
      code = `// TypeScript with Axios
import axios from 'axios';

interface RenderResponse {
  status: string;
  symbology: string;
  data: string;
}

const { data } = await axios.post<RenderResponse>(
  '${baseUrl}/api/v1/aidc/render',
  { symbology: '${sym}', payload: '${payload}', format: 'svg' },
  { headers: { 'X-Pixnivo-Api-Key': 'YOUR_API_KEY' } }
);
console.log(data.data);`;
    } else if (lang === 'python') {
      code = `# Python Requests
import requests

url = "${baseUrl}/api/v1/aidc/render"
headers = {
    "Content-Type": "application/json",
    "X-Pixnivo-Api-Key": "YOUR_API_KEY"
}
payload = {
    "symbology": "${sym}",
    "payload": "${payload}",
    "format": "svg"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json()["data"])`;
    } else if (lang === 'php') {
      code = `<?php
// PHP cURL
$ch = curl_init("${baseUrl}/api/v1/aidc/render");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Pixnivo-Api-Key: YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'symbology' => '${sym}',
    'payload' => '${payload}',
    'format' => 'svg'
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;
    } else if (lang === 'csharp') {
      code = `// C# HttpClient
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

var client = new HttpClient();
client.DefaultRequestHeaders.Add("X-Pixnivo-Api-Key", "YOUR_API_KEY");

var json = "{\\"symbology\\":\\"${sym}\\",\\"payload\\":\\"${payload}\\",\\"format\\":\\"svg\\"}";
var content = new StringContent(json, Encoding.UTF8, "application/json");

var response = await client.PostAsync("${baseUrl}/api/v1/aidc/render", content);
var result = await response.Content.ReadAsStringAsync();
Console.WriteLine(result);`;
    } else if (lang === 'java') {
      code = `// Java 11+ HttpClient
import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/v1/aidc/render"))
    .header("Content-Type", "application/json")
    .header("X-Pixnivo-Api-Key", "YOUR_API_KEY")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\\"symbology\\":\\"${sym}\\",\\"payload\\":\\"${payload}\\",\\"format\\":\\"svg\\"}"
    ))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`;
    }

    codeEl.textContent = code;
  }

  // Load Settings View
  async function loadSettingsView() {
    try {
      const resp = await fetch('/api/v1/aidc/settings/prefix');
      if (resp.ok) {
        const s = await resp.json();
        $('cfgCompanyName').value = s.company_name || '';
        $('cfgCompanyPrefix').value = s.gs1_company_prefix || '';
        $('cfgNextRef').value = s.next_item_reference || 1;
        $('cfgPrefixActive').checked = s.is_active;
      }
    } catch (e) {}

    $('btnSavePrefixSettings').onclick = async () => {
      const body = {
        company_name: $('cfgCompanyName').value.trim(),
        gs1_company_prefix: $('cfgCompanyPrefix').value.trim(),
        next_item_reference: parseInt($('cfgNextRef').value, 10) || 1,
        is_active: $('cfgPrefixActive').checked
      };

      try {
        const resp = await fetch('/api/v1/aidc/settings/prefix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (resp.ok) {
          P.toast('GS1 Prefix configuration saved!', { type: 'success' });
        }
      } catch (e) {
        P.toast('Failed to save settings', { type: 'error' });
      }
    };
  }

  // Single Asset Export Actions
  function setupExportActions() {
    // Download PNG
    $('btnExportPng').onclick = () => {
      const canvas = $('aidcCanvas');
      if (!canvas) return;
      canvas.toBlob(blob => {
        P.downloadBlob(blob, `${state.symbology}_${state.payload.slice(0, 15)}.png`);
      });
    };

    // Download SVG
    $('btnExportSvg').onclick = () => {
      if (!cachedSvg) return;
      const blob = new Blob([cachedSvg], { type: 'image/svg+xml;charset=utf-8' });
      P.downloadBlob(blob, `${state.symbology}_${state.payload.slice(0, 15)}.svg`);
    };

    // Copy SVG
    $('btnCopySvg').onclick = async () => {
      if (!cachedSvg) return;
      await P.copyText(cachedSvg);
      P.toast('SVG vector copied to clipboard', { type: 'success' });
    };

    // Copy PNG Base64
    $('btnCopyBase64').onclick = async () => {
      const canvas = $('aidcCanvas');
      if (!canvas) return;
      await P.copyText(canvas.toDataURL('image/png'));
      P.toast('Base64 image data URI copied', { type: 'success' });
    };

    // Multi-format Server Exports
    const exportServerFormat = async (fmt) => {
      const canvas = $('aidcCanvas');
      const b64 = canvas ? canvas.toDataURL('image/png') : '';
      const payload = {
        format: fmt,
        images: [{
          text: state.payload,
          symbology: state.symbology,
          title: state.title || 'Barcode Asset',
          sku: state.sku,
          base64_data: b64
        }]
      };

      const toastObj = P.toast(`Generating ${fmt.toUpperCase()} document…`, { type: 'loading' });
      try {
        const resp = await fetch('/api/v1/aidc/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error('Document export failed');
        const blob = await resp.blob();
        P.downloadBlob(blob, `pixnivo_aidc_${Date.now()}.${fmt === 'zip' ? 'zip' : (fmt === 'docx' ? 'docx' : (fmt === 'xlsx' ? 'xlsx' : 'pdf'))}`);
      } catch (err) {
        P.toast(err.message, { type: 'error' });
      } finally {
        toastObj.close();
      }
    };

    if ($('btnExportPdf')) $('btnExportPdf').onclick = () => exportServerFormat('pdf');
    if ($('btnExportDocx')) $('btnExportDocx').onclick = () => exportServerFormat('docx');
    if ($('btnExportXlsx')) $('btnExportXlsx').onclick = () => exportServerFormat('xlsx');
    if ($('btnSaveLibrary')) $('btnSaveLibrary').onclick = saveCurrentToLibrary;
  }

  // Populate Symbology Select Options
  function populateSymbologySelect() {
    const sel = $('aidcSymbology');
    if (!sel) return;

    let html = `
      <optgroup label="Product Identifiers (Retail POS)">
        <option value="ean13">EAN-13 (Global Retail)</option>
        <option value="upca">UPC-A (North American Retail)</option>
        <option value="ean8">EAN-8 (Small Packages)</option>
        <option value="upce">UPC-E (Zero-Suppressed)</option>
      </optgroup>
      <optgroup label="Linear (1D Logistics & Tracking)">
        <option value="code128" selected>Code 128 (Universal)</option>
        <option value="gs1-128">GS1-128 (Pallet Shipping)</option>
        <option value="code39">Code 39 (Industrial & Military)</option>
        <option value="code93">Code 93 (High Density)</option>
        <option value="itf14">ITF-14 (Outer Cartons)</option>
        <option value="itf">ITF (Interleaved 2 of 5)</option>
        <option value="codabar">Codabar (Libraries & Lab)</option>
        <option value="databaromni">GS1 DataBar Omnidirectional</option>
      </optgroup>
      <optgroup label="Matrix (2D High Density)">
        <option value="qrcode">QR Code (Mobile & URL)</option>
        <option value="datamatrix">Data Matrix (ECC 200)</option>
        <option value="gs1datamatrix">GS1 DataMatrix (Healthcare UDI)</option>
        <option value="microqrcode">Micro QR Code</option>
        <option value="azteccode">Aztec Code (Ticketing)</option>
        <option value="maxicode">MaxiCode (Parcel Logistics)</option>
        <option value="hanxin">Han Xin Code</option>
      </optgroup>
      <optgroup label="Stacked Barcodes">
        <option value="pdf417">PDF417 (Manifests & Badges)</option>
        <option value="micropdf417">MicroPDF417</option>
      </optgroup>
    `;
    sel.innerHTML = html;
  }

  // Bind UI Controls
  function bindStudioControls() {
    const symSel = $('aidcSymbology');
    const payloadIn = $('aidcPayload');
    const scaleIn = $('aidcScale');
    const heightIn = $('aidcHeight');
    const textCheck = $('aidcShowText');
    const fgColor = $('aidcFgColor');
    const bgColor = $('aidcBgColor');

    if (symSel) {
      symSel.onchange = () => {
        state.symbology = symSel.value;
        const symDef = SYMBOLOGIES[state.symbology];
        if (symDef) {
          $('symHint').textContent = symDef.hint;
          // Hide height for 2D codes
          const is2D = ['2d', 'stacked'].includes(symDef.cat);
          $('heightField').hidden = is2D;
        }
        renderBarcode();
      };
    }

    if (payloadIn) {
      payloadIn.oninput = () => {
        state.payload = payloadIn.value;
        renderBarcode();
      };
    }

    if (scaleIn) {
      scaleIn.oninput = () => {
        state.scale = parseInt(scaleIn.value, 10);
        $('scaleVal').textContent = `${state.scale}×`;
        renderBarcode();
      };
    }

    if (heightIn) {
      heightIn.oninput = () => {
        state.heightMm = parseInt(heightIn.value, 10);
        $('heightVal').textContent = `${state.heightMm} mm`;
        renderBarcode();
      };
    }

    if (textCheck) {
      textCheck.onchange = () => {
        state.showText = textCheck.checked;
        renderBarcode();
      };
    }

    if (fgColor) {
      fgColor.oninput = () => {
        state.fgColor = fgColor.value;
        renderBarcode();
      };
    }

    if (bgColor) {
      bgColor.oninput = () => {
        state.bgColor = bgColor.value;
        renderBarcode();
      };
    }

    // Insert Sample Button
    const sampleBtn = $('btnInsertSample');
    if (sampleBtn) {
      sampleBtn.onclick = () => {
        const def = SYMBOLOGIES[state.symbology];
        if (def && def.sample) {
          state.payload = def.sample;
          payloadIn.value = def.sample;
          renderBarcode();
        }
      };
    }

    // Tabs switching
    $$('.aidc-tab-btn').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    // Theme changes
    document.addEventListener('pixnivo:themechange', () => {
      renderBarcode();
    });
  }

  // App Initialization
  function init() {
    populateSymbologySelect();
    bindStudioControls();
    setupExportActions();
    initIdentifiersTab();
    initBatchTab();

    // Check hash route
    const hash = window.location.hash.replace('#', '') || 'studio';
    switchTab(hash);
  }

  // Expose global interface
  window.PixnivoAIDC = {
    init,
    switchTab,
    applyTemplate,
    loadIntoStudio,
    toggleFavorite,
    deleteHistoryItem,
    copyToClipboard: (txt) => {
      P.copyText(txt);
      P.toast('Copied to clipboard', { type: 'success' });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

