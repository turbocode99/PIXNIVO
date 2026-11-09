/**
 * PIXNIVO PHOTO STUDIO PRO — MASTER APPLICATION ORCHESTRATOR (ENTERPRISE EDITION)
 * Wires Viewport Engine, 19-Tool Suite, Options Bar, Multi-Workspace System,
 * Adjustments, Layer FX, History Stack, and Modal Dialogs
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  const $ = id => document.getElementById(id);

  class EditorApp {
    constructor() {
      this.document = null;
      this.history = new P.HistoryManager(60);
      this.toolManager = new P.ToolManager(this);

      // Canvas Viewport State
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.isPanning = false;
      this.panStart = { x: 0, y: 0 };
      this.currentWorkspace = 'design';

      // Palette Colors
      this.fgColor = '#000000';
      this.bgColor = '#ffffff';
      this.cursorPoint = null;

      // DOM Elements
      this.canvasContainer = $('canvasViewport');
      this.artboard = $('canvasArtboard');
      this.mainCanvas = $('mainCanvas');
      this.overlayCanvas = $('overlayCanvas');
      this.mainCtx = this.mainCanvas ? this.mainCanvas.getContext('2d') : null;
      this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

      this.init();
    }

    init() {
      // 1. Initialize Default Document (1920x1080)
      this.newDocument(1920, 1080, 'Untitled-1', '#ffffff');

      // 2. Wire Menus & UI Panels
      this.initMenuBar();
      this.initToolPalette();
      this.initOptionsBar();
      this.initLayersPanel();
      this.initHistoryPanel();
      this.initAdjustmentsPanel();
      this.initPanelTabs();
      this.initModals();
      this.initShortcuts();

      // 3. Wire Canvas Viewport Events (Mouse, Touch, Wheel, Rulers)
      this.initViewportEvents();

      // 4. Initial Render
      this.fitToScreen();
      this.render();
      this.updateLayersUI();
      this.updateHistoryUI();

      // Expose globally
      window.PixnivoStudio.app = this;
      window.pixnivoEditor = this;
    }

    newDocument(width, height, name = 'Untitled-1', bgFill = '#ffffff') {
      this.document = new P.Document(width, height, name, bgFill);
      if (this.mainCanvas && this.overlayCanvas && this.artboard) {
        this.mainCanvas.width = width;
        this.mainCanvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        this.artboard.style.width = width + 'px';
        this.artboard.style.height = height + 'px';
      }

      this.history = new P.HistoryManager(60);
      this.history.pushState('New Document', this.document);

      this.fitToScreen();
      this.render();
      this.updateLayersUI();
      this.updateHistoryUI();
      this.updateStatusBar();
    }

    openImageFile(file) {
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        this.document = new P.Document(img.naturalWidth, img.naturalHeight, file.name);
        this.mainCanvas.width = img.naturalWidth;
        this.mainCanvas.height = img.naturalHeight;
        this.overlayCanvas.width = img.naturalWidth;
        this.overlayCanvas.height = img.naturalHeight;
        this.artboard.style.width = img.naturalWidth + 'px';
        this.artboard.style.height = img.naturalHeight + 'px';

        const bgLayer = this.document.layers[0];
        bgLayer.name = file.name;
        bgLayer.ctx.drawImage(img, 0, 0);

        this.history = new P.HistoryManager(60);
        this.history.pushState('Open Image', this.document);

        this.fitToScreen();
        this.render();
        this.updateLayersUI();
        this.updateHistoryUI();
        this.updateStatusBar();
        this.toast(`Opened: ${file.name} (${img.naturalWidth} × ${img.naturalHeight})`);
      };
      img.src = url;
    }

    // ------------------------------------------------------------------------
    // WORKSPACES SYSTEM (Photography, Retouching, Design, Social, E-Commerce)
    // ------------------------------------------------------------------------
    setWorkspace(workspaceName) {
      this.currentWorkspace = workspaceName;
      if ($('workspaceSelect')) $('workspaceSelect').value = workspaceName;
      switch (workspaceName) {
        case 'photography':
          this.switchPanel('panelAdjustments');
          this.toolManager.setTool('crop');
          break;
        case 'retouching':
          this.switchPanel('panelAi');
          this.toolManager.setTool('heal');
          break;
        case 'design':
          this.switchPanel('panelLayers');
          this.toolManager.setTool('shape');
          break;
        case 'social':
          this.switchPanel('panelLayers');
          this.toolManager.setTool('crop');
          break;
        case 'ecommerce':
          this.switchPanel('panelAi');
          this.toolManager.setTool('marquee_rect');
          break;
      }
      this.toast(`Workspace: ${workspaceName.toUpperCase()}`);
    }

    switchPanel(panelId) {
      document.querySelectorAll('.panel-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.panel === panelId);
      });
      document.querySelectorAll('.panel-body').forEach(b => {
        b.hidden = (b.id !== panelId);
      });
    }

    // ------------------------------------------------------------------------
    // RENDER PIPELINE & OVERLAY
    // ------------------------------------------------------------------------
    render() {
      if (!this.document || !this.mainCtx) return;
      const composite = this.document.composite();
      this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
      this.mainCtx.drawImage(composite, 0, 0);
      this.drawRulers();
    }

    renderOverlay() {
      if (!this.overlayCtx || !this.overlayCanvas) return;
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      // 1. Draw Selection Bounds (Marching Ants)
      if (this.toolManager.selectionBounds) {
        const { x, y, width, height } = this.toolManager.selectionBounds;
        this.overlayCtx.save();
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.strokeStyle = '#f97316';
        this.overlayCtx.lineWidth = 1.5;
        this.overlayCtx.strokeRect(x, y, width, height);
        this.overlayCtx.restore();
      }

      // 2. Draw Lasso Selection Contour
      if (this.toolManager.selectionPoints && this.toolManager.selectionPoints.length > 1) {
        this.overlayCtx.save();
        this.overlayCtx.setLineDash([4, 4]);
        this.overlayCtx.strokeStyle = '#38bdf8';
        this.overlayCtx.lineWidth = 1.5;
        this.overlayCtx.beginPath();
        this.toolManager.selectionPoints.forEach((p, idx) => {
          if (idx === 0) this.overlayCtx.moveTo(p.x, p.y);
          else this.overlayCtx.lineTo(p.x, p.y);
        });
        this.overlayCtx.stroke();
        this.overlayCtx.restore();
      }

      // 3. Draw Crop Box with Rule of Thirds
      if (this.toolManager.cropBox) {
        const { x, y, width, height } = this.toolManager.cropBox;
        this.overlayCtx.save();
        this.overlayCtx.fillStyle = 'rgba(0,0,0,0.5)';
        this.overlayCtx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.clearRect(x, y, width, height);
        this.overlayCtx.strokeStyle = '#ffffff';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.strokeRect(x, y, width, height);

        // Grid lines
        this.overlayCtx.strokeStyle = 'rgba(255,255,255,0.4)';
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(x + width / 3, y);
        this.overlayCtx.lineTo(x + width / 3, y + height);
        this.overlayCtx.moveTo(x + (width * 2) / 3, y);
        this.overlayCtx.lineTo(x + (width * 2) / 3, y + height);
        this.overlayCtx.moveTo(x, y + height / 3);
        this.overlayCtx.lineTo(x + width, y + height / 3);
        this.overlayCtx.moveTo(x, y + (height * 2) / 3);
        this.overlayCtx.lineTo(x + width, y + (height * 2) / 3);
        this.overlayCtx.stroke();
        this.overlayCtx.restore();
      }

      // 4. Draw Photoshop-Grade Live Brush Tip Reticle / Ring Cursor
      if (this.cursorPoint && ['brush', 'pencil', 'eraser', 'bg_eraser', 'clone', 'heal', 'blemish_removal'].includes(this.toolManager.activeTool)) {
        const pt = this.cursorPoint;
        const size = (this.toolManager.activeTool === 'eraser' || this.toolManager.activeTool === 'bg_eraser') 
                     ? this.toolManager.eraser.size 
                     : this.toolManager.brush.size;
        const radius = Math.max(1, size / 2);
        const shape = (this.toolManager.activeTool === 'pencil') ? 'square' : (this.toolManager.brush.shape || 'round_soft');

        this.overlayCtx.save();
        this.overlayCtx.lineWidth = 1.5;
        this.overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.75)';

        if (shape === 'square') {
          this.overlayCtx.strokeRect(Math.round(pt.x - radius), Math.round(pt.y - radius), Math.round(size), Math.round(size));
          this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          this.overlayCtx.lineWidth = 1;
          this.overlayCtx.strokeRect(Math.round(pt.x - radius) + 0.5, Math.round(pt.y - radius) + 0.5, Math.round(size) - 1, Math.round(size) - 1);
        } else if (shape === 'chisel') {
          this.overlayCtx.beginPath();
          this.overlayCtx.ellipse(pt.x, pt.y, radius, Math.max(1, radius * 0.35), Math.PI / 4, 0, Math.PI * 2);
          this.overlayCtx.stroke();
          this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          this.overlayCtx.lineWidth = 1;
          this.overlayCtx.stroke();
        } else {
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          this.overlayCtx.stroke();
          this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          this.overlayCtx.lineWidth = 1;
          this.overlayCtx.stroke();
        }

        // Center crosshair dot for exact target pixel
        this.overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.overlayCtx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
        this.overlayCtx.fillStyle = '#000000';
        this.overlayCtx.fillRect(pt.x - 0.5, pt.y - 0.5, 1, 1);

        this.overlayCtx.restore();
      }
    }

    // ------------------------------------------------------------------------
    // SELECTIVE FILTER & ADJUSTMENT PROCESSOR
    // ------------------------------------------------------------------------
    applySelectiveOperation(processFn, actionName) {
      const active = this.document.getActiveLayer();
      if (!active) return;
      const w = this.document.width;
      const h = this.document.height;

      if (this.toolManager.hasSelection() && this.toolManager.selectionMaskCanvas) {
        const tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : new OffscreenCanvas(w, h);
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(active.canvas, 0, 0);

        processFn(tempCtx);

        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(this.toolManager.selectionMaskCanvas, 0, 0);

        active.ctx.save();
        active.ctx.globalCompositeOperation = 'destination-out';
        active.ctx.drawImage(this.toolManager.selectionMaskCanvas, 0, 0);
        active.ctx.globalCompositeOperation = 'source-over';
        active.ctx.drawImage(tempCanvas, 0, 0);
        active.ctx.restore();
      } else {
        processFn(active.ctx);
      }

      this.history.pushState(actionName, this.document);
      this.render();
      this.updateLayersUI();
      this.toast(`${actionName} applied!`);
    }

    fitToScreen() {
      if (!this.canvasContainer || !this.document) return;
      const containerW = this.canvasContainer.clientWidth - 40;
      const containerH = this.canvasContainer.clientHeight - 40;
      const scaleX = containerW / this.document.width;
      const scaleY = containerH / this.document.height;
      this.zoom = Math.min(scaleX, scaleY, 1.0);
      this.panX = (containerW - this.document.width * this.zoom) / 2 + 20;
      this.panY = (containerH - this.document.height * this.zoom) / 2 + 20;
      this.applyViewportTransform();
    }

    applyViewportTransform() {
      if (this.artboard) {
        this.artboard.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      }
      this.updateStatusBar();
      this.drawRulers();
    }

    // ------------------------------------------------------------------------
    // VIEWPORT EVENTS & INTERACTION
    // ------------------------------------------------------------------------
    initViewportEvents() {
      const container = this.canvasContainer;
      if (!container) return;

      container.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(0.05, Math.min(32.0, this.zoom * zoomFactor));

        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.panX = mx - (mx - this.panX) * (newZoom / this.zoom);
        this.panY = my - (my - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this.applyViewportTransform();
      }, { passive: false });

      const toArtboardCoords = e => {
        const target = this.mainCanvas || this.artboard;
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: 0, y: 0 };
        const x = (e.clientX - rect.left) * (this.document.width / rect.width);
        const y = (e.clientY - rect.top) * (this.document.height / rect.height);
        return { x, y };
      };

      container.addEventListener('pointerdown', e => {
        if (e.spaceKey || e.button === 1 || this.toolManager.activeTool === 'hand') {
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
          container.classList.add('panning');
          return;
        }

        if (e.button === 0) {
          const pt = toArtboardCoords(e);
          this.cursorPoint = pt;
          this.renderOverlay();
          this.toolManager.onPointerDown(e, pt);
        }
      });

      window.addEventListener('pointermove', e => {
        if (this.isPanning) {
          this.panX = e.clientX - this.panStart.x;
          this.panY = e.clientY - this.panStart.y;
          this.applyViewportTransform();
          return;
        }

        const pt = toArtboardCoords(e);
        this.cursorPoint = pt;
        this.renderOverlay();
        this.toolManager.onPointerMove(e, pt);
        this.updateCursorCoords(pt);
      });

      window.addEventListener('pointerup', e => {
        if (this.isPanning) {
          this.isPanning = false;
          container.classList.remove('panning');
          return;
        }
        const pt = toArtboardCoords(e);
        this.cursorPoint = pt;
        this.renderOverlay();
        this.toolManager.onPointerUp(e, pt);
      });

      container.addEventListener('pointerleave', () => {
        this.cursorPoint = null;
        this.renderOverlay();
      });

      // Drag & Drop File Loading
      ['dragenter', 'dragover'].forEach(evt => {
        container.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          container.classList.add('drag-over');
        });
      });

      ['dragleave', 'dragend'].forEach(evt => {
        container.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          container.classList.remove('drag-over');
        });
      });

      container.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.openImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // ------------------------------------------------------------------------
    // RULERS
    // ------------------------------------------------------------------------
    drawRulers() {
      const topCanvas = $('rulerTopCanvas');
      const leftCanvas = $('rulerLeftCanvas');
      if (!topCanvas || !leftCanvas || !this.document) return;

      const topCtx = topCanvas.getContext('2d');
      const leftCtx = leftCanvas.getContext('2d');

      topCanvas.width = topCanvas.parentElement.clientWidth;
      topCanvas.height = 20;
      leftCanvas.width = 20;
      leftCanvas.height = leftCanvas.parentElement.clientHeight;

      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      topCtx.fillStyle = isDark ? '#1e293b' : '#f8fafc';
      topCtx.fillRect(0, 0, topCanvas.width, topCanvas.height);
      leftCtx.fillStyle = isDark ? '#1e293b' : '#f8fafc';
      leftCtx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

      topCtx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      topCtx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
      leftCtx.fillStyle = topCtx.fillStyle;
      leftCtx.strokeStyle = topCtx.strokeStyle;
      topCtx.font = '9px JetBrains Mono, monospace';
      leftCtx.font = '9px JetBrains Mono, monospace';

      const step = this.zoom > 2 ? 50 : (this.zoom > 0.5 ? 100 : 200);
      for (let x = 0; x <= this.document.width; x += step) {
        const screenX = this.panX + x * this.zoom;
        if (screenX >= 0 && screenX <= topCanvas.width) {
          topCtx.beginPath();
          topCtx.moveTo(screenX, 12);
          topCtx.lineTo(screenX, 20);
          topCtx.stroke();
          topCtx.fillText(x, screenX + 3, 10);
        }
      }

      for (let y = 0; y <= this.document.height; y += step) {
        const screenY = this.panY + y * this.zoom;
        if (screenY >= 0 && screenY <= leftCanvas.height) {
          leftCtx.beginPath();
          leftCtx.moveTo(12, screenY);
          leftCtx.lineTo(20, screenY);
          leftCtx.stroke();
          leftCtx.save();
          leftCtx.translate(10, screenY + 3);
          leftCtx.rotate(-Math.PI / 2);
          leftCtx.fillText(y, 0, 0);
          leftCtx.restore();
        }
      }
    }

    // ------------------------------------------------------------------------
    // LAYERS PANEL
    // ------------------------------------------------------------------------
    initLayersPanel() {
      $('btnAddLayer')?.addEventListener('click', () => {
        const layer = new P.Layer('Layer ' + (this.document.layers.length + 1), this.document.width, this.document.height);
        this.document.addLayer(layer);
        this.history.pushState('New Layer', this.document);
        this.render();
        this.updateLayersUI();
      });

      $('btnDuplicateLayer')?.addEventListener('click', () => {
        this.document.duplicateActiveLayer();
        this.history.pushState('Duplicate Layer', this.document);
        this.render();
        this.updateLayersUI();
      });

      $('btnDeleteLayer')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active && this.document.removeLayer(active.id)) {
          this.history.pushState('Delete Layer', this.document);
          this.render();
          this.updateLayersUI();
        }
      });

      $('btnMergeDown')?.addEventListener('click', () => {
        if (this.document.mergeDown()) {
          this.history.pushState('Merge Down', this.document);
          this.render();
          this.updateLayersUI();
        }
      });

      $('btnAddMask')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          active.addMask();
          this.history.pushState('Add Layer Mask', this.document);
          this.render();
          this.updateLayersUI();
        }
      });

      $('layerBlendSelect')?.addEventListener('change', e => {
        const active = this.document.getActiveLayer();
        if (active) {
          active.blendMode = e.target.value;
          this.history.pushState('Change Blend Mode', this.document);
          this.render();
        }
      });

      $('layerOpacityInput')?.addEventListener('input', e => {
        const active = this.document.getActiveLayer();
        if (active) {
          const val = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 100));
          active.opacity = val / 100;
          this.render();
        }
      });
    }

    updateLayersUI() {
      const listEl = $('layersList');
      if (!listEl || !this.document) return;
      listEl.innerHTML = '';

      for (let i = this.document.layers.length - 1; i >= 0; i--) {
        const layer = this.document.layers[i];
        const isActive = layer.id === this.document.activeLayerId;

        const item = document.createElement('div');
        item.className = 'layer-item' + (isActive ? ' active' : '');
        item.innerHTML = `
          <button class="layer-vis-btn ${layer.visible ? '' : 'hidden-layer'}" title="Toggle Visibility">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <div class="layer-thumb">
            <canvas width="32" height="32"></canvas>
          </div>
          <span class="layer-name" title="${layer.name}">${layer.name}</span>
          ${layer.mask ? '<span class="layer-fx-badge">Mask</span>' : ''}
        `;

        const thumbCanvas = item.querySelector('.layer-thumb canvas');
        if (thumbCanvas) {
          thumbCanvas.getContext('2d').drawImage(layer.canvas, 0, 0, 32, 32);
        }

        item.addEventListener('click', () => {
          this.document.activeLayerId = layer.id;
          this.updateLayersUI();
        });

        item.querySelector('.layer-vis-btn').addEventListener('click', e => {
          e.stopPropagation();
          layer.visible = !layer.visible;
          this.render();
          this.updateLayersUI();
        });

        listEl.appendChild(item);
      }

      const active = this.document.getActiveLayer();
      if (active) {
        if ($('layerBlendSelect')) $('layerBlendSelect').value = active.blendMode;
        if ($('layerOpacityInput')) $('layerOpacityInput').value = Math.round(active.opacity * 100);
      }
    }

    // ------------------------------------------------------------------------
    // ADJUSTMENTS PANEL
    // ------------------------------------------------------------------------
    initAdjustmentsPanel() {
      // 1. Quick Action Buttons (Selective-aware!)
      $('adjBrightnessBtn')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.brightnessContrast(ctx, 0.15, 0.15), 'Auto Brightness/Contrast');
      });

      $('adjHueBtn')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.hueSaturation(ctx, 20, 0.25, 0), 'Auto Hue/Saturation');
      });

      $('adjBWBtn')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.blackAndWhite(ctx), 'Black & White');
      });

      $('adjInvertBtn')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.invert(ctx), 'Invert Colors');
      });

      // 2. Interactive Precision Adjustment Sliders
      const sliders = {
        brightness: $('adjBrightnessSlider'),
        contrast: $('adjContrastSlider'),
        exposure: $('adjExposureSlider'),
        hue: $('adjHueSlider'),
        saturation: $('adjSaturationSlider'),
        vibrance: $('adjVibranceSlider')
      };

      const valLabels = {
        brightness: $('adjBrightnessVal'),
        contrast: $('adjContrastVal'),
        exposure: $('adjExposureVal'),
        hue: $('adjHueVal'),
        saturation: $('adjSaturationVal'),
        vibrance: $('adjVibranceVal')
      };

      const updateLabels = () => {
        if (valLabels.brightness && sliders.brightness) valLabels.brightness.textContent = sliders.brightness.value;
        if (valLabels.contrast && sliders.contrast) valLabels.contrast.textContent = sliders.contrast.value;
        if (valLabels.exposure && sliders.exposure) valLabels.exposure.textContent = sliders.exposure.value;
        if (valLabels.hue && sliders.hue) valLabels.hue.textContent = `${sliders.hue.value}°`;
        if (valLabels.saturation && sliders.saturation) valLabels.saturation.textContent = sliders.saturation.value;
        if (valLabels.vibrance && sliders.vibrance) valLabels.vibrance.textContent = sliders.vibrance.value;
      };

      const renderAdjustmentPreview = () => {
        const active = this.document.getActiveLayer();
        if (!active) return;
        if (!this.layerSnapshotForAdj) {
          this.layerSnapshotForAdj = active.clone();
        }

        const b = parseInt(sliders.brightness ? sliders.brightness.value : 0, 10) / 100;
        const c = parseInt(sliders.contrast ? sliders.contrast.value : 0, 10) / 100;
        const e = parseInt(sliders.exposure ? sliders.exposure.value : 0, 10) / 100;
        const h = parseInt(sliders.hue ? sliders.hue.value : 0, 10);
        const s = parseInt(sliders.saturation ? sliders.saturation.value : 0, 10) / 100;
        const v = parseInt(sliders.vibrance ? sliders.vibrance.value : 0, 10) / 100;

        const w = this.document.width;
        const h_dim = this.document.height;

        active.ctx.clearRect(0, 0, w, h_dim);
        active.ctx.drawImage(this.layerSnapshotForAdj.canvas, 0, 0);

        if (b === 0 && c === 0 && e === 0 && h === 0 && s === 0 && v === 0) {
          this.render();
          return;
        }

        if (this.toolManager.hasSelection() && this.toolManager.selectionMaskCanvas) {
          const tempCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : new OffscreenCanvas(w, h_dim);
          tempCanvas.width = w;
          tempCanvas.height = h_dim;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(this.layerSnapshotForAdj.canvas, 0, 0);

          if (b !== 0 || c !== 0) P.Filters.brightnessContrast(tempCtx, b, c);
          if (e !== 0) P.Filters.exposure(tempCtx, e);
          if (h !== 0 || s !== 0) P.Filters.hueSaturation(tempCtx, h, s, 0);
          if (v !== 0) P.Filters.vibrance(tempCtx, v);

          tempCtx.globalCompositeOperation = 'destination-in';
          tempCtx.drawImage(this.toolManager.selectionMaskCanvas, 0, 0);

          active.ctx.save();
          active.ctx.globalCompositeOperation = 'destination-out';
          active.ctx.drawImage(this.toolManager.selectionMaskCanvas, 0, 0);
          active.ctx.globalCompositeOperation = 'source-over';
          active.ctx.drawImage(tempCanvas, 0, 0);
          active.ctx.restore();
        } else {
          if (b !== 0 || c !== 0) P.Filters.brightnessContrast(active.ctx, b, c);
          if (e !== 0) P.Filters.exposure(active.ctx, e);
          if (h !== 0 || s !== 0) P.Filters.hueSaturation(active.ctx, h, s, 0);
          if (v !== 0) P.Filters.vibrance(active.ctx, v);
        }

        this.render();
      };

      Object.values(sliders).forEach(slider => {
        if (!slider) return;
        slider.addEventListener('input', () => {
          updateLabels();
          renderAdjustmentPreview();
        });
      });

      $('btnApplyAdjustments')?.addEventListener('click', () => {
        if (this.layerSnapshotForAdj) {
          this.history.pushState('Precision Adjustments', this.document);
          this.layerSnapshotForAdj = null;
          Object.values(sliders).forEach(s => { if (s) s.value = 0; });
          updateLabels();
          this.toast('Adjustments Applied!');
        }
      });

      $('btnResetAdjustments')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active && this.layerSnapshotForAdj) {
          active.ctx.clearRect(0, 0, this.document.width, this.document.height);
          active.ctx.drawImage(this.layerSnapshotForAdj.canvas, 0, 0);
          this.layerSnapshotForAdj = null;
          this.render();
        }
        Object.values(sliders).forEach(s => { if (s) s.value = 0; });
        updateLabels();
        this.toast('Adjustments Reset');
      });
    }

    // ------------------------------------------------------------------------
    // HISTORY STACK UI
    // ------------------------------------------------------------------------
    initHistoryPanel() {
      $('btnHistorySnapshot')?.addEventListener('click', () => {
        const name = prompt('Snapshot name:', 'Snapshot ' + (this.history.snapshots.size + 1));
        if (name) {
          this.history.createSnapshot(name, this.document);
          this.toast(`Snapshot "${name}" saved!`);
        }
      });
    }

    updateHistoryUI() {
      const listEl = $('historyList');
      if (!listEl) return;
      listEl.innerHTML = '';

      this.history.stack.forEach((state, idx) => {
        const item = document.createElement('div');
        const isCurrent = idx === this.history.index;
        const isUndone = idx > this.history.index;
        item.className = 'history-item' + (isCurrent ? ' active' : '') + (isUndone ? ' undone' : '');
        item.textContent = state.name;
        item.addEventListener('click', () => {
          this.history.jumpTo(idx, this.document);
          this.render();
          this.updateLayersUI();
          this.updateHistoryUI();
        });
        listEl.appendChild(item);
      });
    }

    // ------------------------------------------------------------------------
    // TOOL PALETTE & OPTIONS BAR
    // ------------------------------------------------------------------------
    initToolPalette() {
      const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
      toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          toolButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.toolManager.setTool(btn.dataset.tool);
        });
      });

      $('wellFg')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this.fgColor;
        input.addEventListener('input', e => this.setColor(e.target.value));
        input.click();
      });

      $('btnSwapColors')?.addEventListener('click', () => {
        const tmp = this.fgColor;
        this.fgColor = this.bgColor;
        this.bgColor = tmp;
        this.updateColorWells();
      });
    }

    setColor(hex) {
      this.fgColor = hex;
      this.updateColorWells();
    }

    updateColorWells() {
      if ($('wellFg')) $('wellFg').style.backgroundColor = this.fgColor;
      if ($('wellBg')) $('wellBg').style.backgroundColor = this.bgColor;
    }

    initOptionsBar() {
      // 1. Brush Tip Shape
      $('brushShapeSelect')?.addEventListener('change', e => {
        this.toolManager.brush.shape = e.target.value;
        this.toast(`Brush Shape: ${e.target.value.replace(/_/g, ' ')}`);
      });

      // 2. Brush Size (Slider & Number Input Synced)
      const sizeSlider = $('brushSizeSlider');
      const sizeInput = $('brushSizeInput');
      const updateSize = val => {
        const s = Math.max(1, Math.min(500, parseInt(val, 10) || 35));
        this.toolManager.brush.size = s;
        if (sizeSlider && sizeSlider.value != s) sizeSlider.value = Math.min(250, s);
        if (sizeInput && sizeInput.value != s) sizeInput.value = s;
        document.querySelectorAll('.opt-pill-btn[data-brush-preset]').forEach(pill => {
          pill.classList.toggle('active', pill.dataset.brushPreset == s);
        });
      };

      sizeSlider?.addEventListener('input', e => updateSize(e.target.value));
      sizeInput?.addEventListener('input', e => updateSize(e.target.value));

      // 3. Quick Size Preset Pills
      document.querySelectorAll('.opt-pill-btn[data-brush-preset]').forEach(pill => {
        pill.addEventListener('click', () => {
          updateSize(pill.dataset.brushPreset);
        });
      });

      // 4. Brush Hardness (Slider & Input Synced)
      const hardnessSlider = $('brushHardnessSlider');
      const hardnessInput = $('brushHardnessInput');
      const updateHardness = val => {
        const h = Math.max(0, Math.min(100, parseInt(val, 10) || 80));
        this.toolManager.brush.hardness = h / 100;
        if (hardnessSlider && hardnessSlider.value != h) hardnessSlider.value = h;
        if (hardnessInput && hardnessInput.value != h) hardnessInput.value = h;
      };
      hardnessSlider?.addEventListener('input', e => updateHardness(e.target.value));
      hardnessInput?.addEventListener('input', e => updateHardness(e.target.value));

      // 5. Brush Opacity (Slider & Input Synced)
      const opacitySlider = $('brushOpacitySlider');
      const opacityInput = $('brushOpacityInput');
      const updateOpacity = val => {
        const op = Math.max(1, Math.min(100, parseInt(val, 10) || 100));
        this.toolManager.brush.opacity = op / 100;
        if (opacitySlider && opacitySlider.value != op) opacitySlider.value = op;
        if (opacityInput && opacityInput.value != op) opacityInput.value = op;
      };
      opacitySlider?.addEventListener('input', e => updateOpacity(e.target.value));
      opacityInput?.addEventListener('input', e => updateOpacity(e.target.value));

      // 6. Selection Actions
      $('btnDeselect')?.addEventListener('click', () => {
        this.toolManager.clearSelection();
        this.toast('Selection Cleared');
      });

      $('btnInvertSel')?.addEventListener('click', () => {
        this.toolManager.invertSelection(this.document);
      });
    }

    updateOptionsBar(toolName) {
      const title = $('activeToolTitle');
      if (title) title.textContent = toolName.toUpperCase().replace(/_/g, ' ');

      // Sync active tool values to options bar inputs
      if ($('brushSizeInput')) $('brushSizeInput').value = this.toolManager.brush.size;
      if ($('brushSizeSlider')) $('brushSizeSlider').value = Math.min(250, this.toolManager.brush.size);
      if ($('brushHardnessInput')) $('brushHardnessInput').value = Math.round(this.toolManager.brush.hardness * 100);
      if ($('brushHardnessSlider')) $('brushHardnessSlider').value = Math.round(this.toolManager.brush.hardness * 100);
      if ($('brushOpacityInput')) $('brushOpacityInput').value = Math.round(this.toolManager.brush.opacity * 100);
      if ($('brushOpacitySlider')) $('brushOpacitySlider').value = Math.round(this.toolManager.brush.opacity * 100);
      if ($('brushShapeSelect')) $('brushShapeSelect').value = this.toolManager.brush.shape || 'round_soft';
    }

    updateCursor() {
      const area = this.canvasContainer;
      if (!area) return;
      const tool = this.toolManager.activeTool;
      if (['brush', 'pencil', 'eraser', 'bg_eraser', 'clone', 'heal', 'blemish_removal'].includes(tool)) {
        area.style.cursor = 'crosshair';
      } else if (tool === 'move') {
        area.style.cursor = 'move';
      } else if (tool === 'eyedropper' || tool.startsWith('marquee_') || tool === 'lasso' || tool === 'polygonal_lasso') {
        area.style.cursor = 'crosshair';
      } else {
        area.style.cursor = 'default';
      }
    }

    // ------------------------------------------------------------------------
    // MENU BAR & DIALOGS
    // ------------------------------------------------------------------------
    initMenuBar() {
      const menuItems = document.querySelectorAll('.studio-menu-item');
      menuItems.forEach(item => {
        item.querySelector('.studio-menu-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          const isActive = item.classList.contains('active');
          menuItems.forEach(m => m.classList.remove('active'));
          if (!isActive) item.classList.add('active');
        });
      });

      window.addEventListener('click', () => {
        menuItems.forEach(m => m.classList.remove('active'));
      });

      $('workspaceSelect')?.addEventListener('change', e => {
        this.setWorkspace(e.target.value);
      });

      $('menuFileNew')?.addEventListener('click', () => $('modalNewDoc').hidden = false);

      $('menuFileOpen')?.addEventListener('click', () => {
        const fileIn = document.createElement('input');
        fileIn.type = 'file';
        fileIn.accept = 'image/*,.psd';
        fileIn.onchange = () => {
          if (fileIn.files && fileIn.files[0]) this.openImageFile(fileIn.files[0]);
        };
        fileIn.click();
      });

      $('menuFileExport')?.addEventListener('click', () => $('modalExport').hidden = false);
      $('btnQuickExport')?.addEventListener('click', () => $('modalExport').hidden = false);

      $('menuEditUndo')?.addEventListener('click', () => {
        if (this.history.undo(this.document)) {
          this.render();
          this.updateLayersUI();
          this.updateHistoryUI();
        }
      });
      $('menuEditRedo')?.addEventListener('click', () => {
        if (this.history.redo(this.document)) {
          this.render();
          this.updateLayersUI();
          this.updateHistoryUI();
        }
      });

      $('menuEditTransform')?.addEventListener('click', () => {
        this.toolManager.setTool('move');
        this.toast('Free Transform active (Drag to move/transform)');
      });

      $('menuEditFreqSep')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (!active) return;
        const low = active.clone();
        low.name = `${active.name} - Low Freq (Color)`;
        P.Filters.gaussianBlur(low.ctx, 4);

        const high = active.clone();
        high.name = `${active.name} - High Freq (Texture)`;
        high.blendMode = 'linear-light';
        P.Filters.smartSharpen(high.ctx, 2.0);

        this.document.addLayer(low);
        this.document.addLayer(high);
        this.history.pushState('Frequency Separation', this.document);
        this.render();
        this.updateLayersUI();
        this.toast('Frequency Separation Layers Generated!');
      });

      // Image Menu Geometry & Rotations
      $('menuImgRotate90CW')?.addEventListener('click', () => {
        this.document.rotateCanvas(90);
        this.history.pushState('Rotate 90° CW', this.document);
        this.fitToScreen(); this.render(); this.updateLayersUI();
      });
      $('menuImgRotate90CCW')?.addEventListener('click', () => {
        this.document.rotateCanvas(-90);
        this.history.pushState('Rotate 90° CCW', this.document);
        this.fitToScreen(); this.render(); this.updateLayersUI();
      });
      $('menuImgRotate180')?.addEventListener('click', () => {
        this.document.rotateCanvas(180);
        this.history.pushState('Rotate 180°', this.document);
        this.fitToScreen(); this.render(); this.updateLayersUI();
      });
      $('menuImgFlipH')?.addEventListener('click', () => {
        this.document.flipHorizontal();
        this.history.pushState('Flip Horizontal', this.document);
        this.render(); this.updateLayersUI();
      });
      $('menuImgFlipV')?.addEventListener('click', () => {
        this.document.flipVertical();
        this.history.pushState('Flip Vertical', this.document);
        this.render(); this.updateLayersUI();
      });
      $('menuImgTrim')?.addEventListener('click', () => {
        this.document.trimCanvas();
        this.history.pushState('Trim Canvas', this.document);
        this.fitToScreen(); this.render(); this.updateLayersUI();
      });

      // Layer Menu Extras
      $('menuLayerStyles')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (!active) return;
        if ($('fxDropShadowEnabled')) $('fxDropShadowEnabled').checked = active.styles.dropShadow.enabled;
        if ($('fxShadowBlur')) $('fxShadowBlur').value = active.styles.dropShadow.blur;
        if ($('fxShadowDist')) $('fxShadowDist').value = active.styles.dropShadow.distance;
        if ($('fxOuterGlowEnabled')) $('fxOuterGlowEnabled').checked = active.styles.outerGlow.enabled;
        if ($('fxStrokeEnabled')) $('fxStrokeEnabled').checked = active.styles.stroke.enabled;
        $('modalLayerStyles').hidden = false;
      });

      $('menuLayerGradMask')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          active.applyGradientMask('linear', 90);
          this.history.pushState('Gradient Mask', this.document);
          this.render(); this.updateLayersUI();
          this.toast('Linear Gradient Mask Applied');
        }
      });

      // View Menu Actions
      $('menuViewZoomIn')?.addEventListener('click', () => {
        this.zoom = Math.min(32.0, this.zoom * 1.25);
        this.applyViewportTransform();
      });
      $('menuViewZoomOut')?.addEventListener('click', () => {
        this.zoom = Math.max(0.05, this.zoom / 1.25);
        this.applyViewportTransform();
      });
      $('menuViewFit')?.addEventListener('click', () => this.fitToScreen());
      $('menuView100')?.addEventListener('click', () => {
        this.zoom = 1.0;
        this.applyViewportTransform();
      });

      // Filters Panel Buttons (Selective Masking Aware)
      const filterActions = {
        btnFilterGaussian: ctx => P.Filters.gaussianBlur(ctx, 6),
        btnFilterMotion: ctx => P.Filters.motionBlur(ctx, 45, 12),
        btnFilterRadial: ctx => P.Filters.radialBlur(ctx, 15),
        btnFilterSharpen: ctx => P.Filters.smartSharpen(ctx, 1.5),
        btnFilterNoise: ctx => P.Filters.addNoise(ctx, 25),
        btnFilterDenoise: ctx => P.Filters.reduceNoise(ctx),
        btnFilterOilPaint: ctx => P.Filters.oilPaint(ctx, 3, 20),
        btnFilterEmboss: ctx => P.Filters.emboss(ctx),
        btnFilterEdges: ctx => P.Filters.findEdges(ctx),
        btnFilterRipple: ctx => P.Filters.ripple(ctx, 15, 6),
        btnFilterPinch: ctx => P.Filters.pinch(ctx, 0.5),
        btnFilterFlare: ctx => P.Filters.lensFlare(ctx, 0.6, 0.4)
      };

      Object.entries(filterActions).forEach(([btnId, fn]) => {
        $(btnId)?.addEventListener('click', () => {
          this.applySelectiveOperation(fn, btnId.replace('btnFilter', 'Filter: '));
        });
      });

      // Filter Gallery Actions (Selective Masking Aware)
      $('menuFilterBlur')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.gaussianBlur(ctx, 6), 'Gaussian Blur');
      });

      $('menuFilterSharpen')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.sharpen(ctx), 'Sharpen');
      });

      $('menuFilterOilPaint')?.addEventListener('click', () => {
        this.applySelectiveOperation(ctx => P.Filters.oilPaint(ctx, 3, 20), 'Oil Paint Filter');
      });

      // AI Lab Actions
      $('btnAiAutoEnhance')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.AiEngine.autoEnhance(active.ctx);
          this.history.pushState('AI Auto Enhance', this.document);
          this.render();
          this.updateLayersUI();
          this.toast('AI Auto Tone & Contrast Applied!');
        }
      });

      $('btnAiPortraitPolish')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.AiEngine.enhancePortrait(active.ctx);
          this.history.pushState('AI Portrait Polish', this.document);
          this.render();
          this.updateLayersUI();
          this.toast('AI Portrait Skin Polish Applied!');
        }
      });

      $('btnAiInpaint')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active && this.toolManager.selectionBounds) {
          P.AiEngine.inpaintSelection(active.ctx, this.toolManager.selectionBounds);
          this.toolManager.clearSelection();
          this.history.pushState('AI Inpainting Removal', this.document);
          this.render();
          this.updateLayersUI();
          this.toast('AI Object Removed & Inpainted!');
        } else {
          this.toast('First create a selection around the object with Marquee or Lasso.', { type: 'warning' });
        }
      });

      $('btnAiCutout')?.addEventListener('click', async () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.AiEngine.removeBackground(active.ctx, active);
          this.history.pushState('AI Subject Cutout', this.document);
          this.render();
          this.updateLayersUI();
          this.toast('AI Subject Cutout Mask Created!');
        }
      });
    }

    initPanelTabs() {
      const tabs = document.querySelectorAll('.panel-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('.panel-body').forEach(b => b.hidden = true);
          const target = $(tab.dataset.panel);
          if (target) target.hidden = false;
        });
      });
    }

    initModals() {
      document.querySelectorAll('.studio-modal-close, [data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.studio-modal-backdrop').hidden = true;
        });
      });

      document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
          const w = parseInt(card.dataset.w, 10);
          const h = parseInt(card.dataset.h, 10);
          const name = card.querySelector('.preset-name').textContent;
          this.newDocument(w, h, name);
          $('modalNewDoc').hidden = true;
        });
      });

      $('btnConfirmExport')?.addEventListener('click', () => {
        const fmt = $('exportFormatSelect').value;
        const quality = parseFloat($('exportQualitySelect').value);
        const name = `${this.document.name.replace(/\.[^/.]+$/, '')}-edited.${fmt}`;

        const mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
        this.document.compositeCanvas.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();
          URL.revokeObjectURL(a.href);
          $('modalExport').hidden = true;
          this.toast(`Exported: ${name}`);
        }, mime, quality);
      });

      // Canvas Size Dialog
      $('menuImgCanvasSize')?.addEventListener('click', () => {
        if ($('inputCanvasWidth')) $('inputCanvasWidth').value = this.document.width;
        if ($('inputCanvasHeight')) $('inputCanvasHeight').value = this.document.height;
        $('modalCanvasSize').hidden = false;
      });

      $('btnConfirmCanvasSize')?.addEventListener('click', () => {
        const w = parseInt($('inputCanvasWidth')?.value, 10) || this.document.width;
        const h = parseInt($('inputCanvasHeight')?.value, 10) || this.document.height;
        const anchor = $('selectCanvasAnchor') ? $('selectCanvasAnchor').value : 'center';
        this.document.resizeCanvas(w, h, anchor);
        this.history.pushState('Canvas Size', this.document);
        this.fitToScreen();
        this.render();
        this.updateLayersUI();
        $('modalCanvasSize').hidden = true;
        this.toast(`Canvas resized to ${w} × ${h} px`);
      });

      // Image Size Dialog
      $('menuImgImageSize')?.addEventListener('click', () => {
        if ($('inputImageWidth')) $('inputImageWidth').value = this.document.width;
        if ($('inputImageHeight')) $('inputImageHeight').value = this.document.height;
        $('modalImageSize').hidden = false;
      });

      $('btnConfirmImageSize')?.addEventListener('click', () => {
        const w = parseInt($('inputImageWidth')?.value, 10) || this.document.width;
        const h = parseInt($('inputImageHeight')?.value, 10) || this.document.height;
        this.document.resizeImage(w, h);
        this.history.pushState('Image Size', this.document);
        this.fitToScreen();
        this.render();
        this.updateLayersUI();
        $('modalImageSize').hidden = true;
        this.toast(`Image resized to ${w} × ${h} px`);
      });

      // Layer Styles Dialog Confirm
      $('btnConfirmLayerStyles')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          active.styles.dropShadow.enabled = $('fxDropShadowEnabled')?.checked || false;
          active.styles.dropShadow.blur = parseInt($('fxShadowBlur')?.value, 10) || 10;
          active.styles.dropShadow.distance = parseInt($('fxShadowDist')?.value, 10) || 8;
          active.styles.outerGlow.enabled = $('fxOuterGlowEnabled')?.checked || false;
          active.styles.outerGlow.color = $('fxGlowColor')?.value || '#f97316';
          active.styles.stroke.enabled = $('fxStrokeEnabled')?.checked || false;
          active.styles.stroke.width = parseInt($('fxStrokeWidth')?.value, 10) || 4;
          active.styles.stroke.color = $('fxStrokeColor')?.value || '#ea580c';
          this.history.pushState('Layer Styles FX', this.document);
          this.render();
          this.updateLayersUI();
          $('modalLayerStyles').hidden = true;
          this.toast('Layer Styles Applied!');
        }
      });
    }

    initShortcuts() {
      window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          $('menuEditUndo')?.click();
        }
        if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          $('menuEditRedo')?.click();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.toolManager.clearSelection();
          this.toast('Selection Deselected (Ctrl+D)');
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
          e.preventDefault();
          this.toolManager.invertSelection(this.document);
        }
        if (e.key === '[' && document.activeElement.tagName !== 'INPUT') {
          const newSize = Math.max(1, this.toolManager.brush.size - 5);
          this.toolManager.brush.size = newSize;
          if ($('brushSizeInput')) $('brushSizeInput').value = newSize;
          if ($('brushSizeSlider')) $('brushSizeSlider').value = Math.min(250, newSize);
        }
        if (e.key === ']' && document.activeElement.tagName !== 'INPUT') {
          const newSize = Math.min(500, this.toolManager.brush.size + 5);
          this.toolManager.brush.size = newSize;
          if ($('brushSizeInput')) $('brushSizeInput').value = newSize;
          if ($('brushSizeSlider')) $('brushSizeSlider').value = Math.min(250, newSize);
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement.tagName !== 'INPUT') {
          switch (e.key.toLowerCase()) {
            case 'v': this.toolManager.setTool('move'); break;
            case 'm': this.toolManager.setTool('marquee_rect'); break;
            case 'l': this.toolManager.setTool('lasso'); break;
            case 'b': this.toolManager.setTool('brush'); break;
            case 'e': this.toolManager.setTool('eraser'); break;
            case 's': this.toolManager.setTool('clone'); break;
            case 'j': this.toolManager.setTool('heal'); break;
            case 'g': this.toolManager.setTool('bucket'); break;
            case 'i': this.toolManager.setTool('eyedropper'); break;
            case 't': this.toolManager.setTool('text'); break;
            case 'u': this.toolManager.setTool('shape'); break;
          }
        }
      });
    }

    updateStatusBar() {
      if ($('statusDims')) $('statusDims').textContent = `${this.document.width} × ${this.document.height} px`;
      if ($('statusZoom')) $('statusZoom').textContent = `${Math.round(this.zoom * 100)}%`;
      if ($('statusLayers')) $('statusLayers').textContent = `${this.document.layers.length} Layers`;
    }

    updateCursorCoords(pt) {
      if ($('statusCoords')) {
        $('statusCoords').textContent = `X: ${Math.round(pt.x)}  Y: ${Math.round(pt.y)}`;
      }
    }

    toast(msg, opt = {}) {
      if (window.Pixnivo && window.Pixnivo.toast) {
        window.Pixnivo.toast(msg, opt);
      } else {
        console.log('[PixNivo Studio]', msg);
      }
    }
  }

  // Launch Studio on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.pixnivoEditor = new EditorApp();
  });

})(window);
