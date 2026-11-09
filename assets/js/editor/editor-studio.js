/**
 * PIXNIVO PHOTO STUDIO PRO — MASTER APPLICATION ORCHESTRATOR
 * Wires Canvas Viewport, Tool Palette, Options Bar, Layers, History, and Dialogs
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  const $ = id => document.getElementById(id);

  class EditorApp {
    constructor() {
      this.document = null;
      this.history = new P.HistoryManager(50);
      this.toolManager = new P.ToolManager(this);

      // Canvas Viewport State
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.isPanning = false;
      this.panStart = { x: 0, y: 0 };

      // Palette Colors
      this.fgColor = '#000000';
      this.bgColor = '#ffffff';

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
      // 1. Initialize Document (Default 1920x1080)
      this.newDocument(1920, 1080, 'Untitled-1', '#ffffff');

      // 2. Wire Menus & UI Panels
      this.initMenuBar();
      this.initToolPalette();
      this.initOptionsBar();
      this.initLayersPanel();
      this.initHistoryPanel();
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
    }

    newDocument(width, height, name = 'Untitled-1', bgFill = '#ffffff') {
      this.document = new P.Document(width, height, name, bgFill);
      this.mainCanvas.width = width;
      this.mainCanvas.height = height;
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
      this.artboard.style.width = width + 'px';
      this.artboard.style.height = height + 'px';

      this.history = new P.HistoryManager(50);
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

        this.history = new P.HistoryManager(50);
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
    // RENDER PIPELINE
    // ------------------------------------------------------------------------
    render() {
      if (!this.document) return;
      const composite = this.document.composite();
      this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
      this.mainCtx.drawImage(composite, 0, 0);
      this.drawRulers();
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
      this.artboard.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      this.updateStatusBar();
      this.drawRulers();
    }

    // ------------------------------------------------------------------------
    // VIEWPORT EVENTS & INTERACTION
    // ------------------------------------------------------------------------
    initViewportEvents() {
      const container = this.canvasContainer;

      // Mouse Wheel Zoom
      container.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(0.05, Math.min(32.0, this.zoom * zoomFactor));

        // Zoom toward mouse position
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.panX = mx - (mx - this.panX) * (newZoom / this.zoom);
        this.panY = my - (my - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this.applyViewportTransform();
      }, { passive: false });

      // Pointer Coordinate Projection (Client Screen -> Artboard Coordinates)
      const toArtboardCoords = e => {
        const rect = this.artboard.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom;
        const y = (e.clientY - rect.top) / this.zoom;
        return { x, y };
      };

      // Pointer Down
      container.addEventListener('pointerdown', e => {
        // Spacebar or Middle Mouse -> Pan Viewport
        if (e.spaceKey || e.button === 1 || this.toolManager.activeTool === 'hand') {
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
          container.classList.add('panning');
          return;
        }

        if (e.button === 0) {
          const pt = toArtboardCoords(e);
          this.toolManager.onPointerDown(e, pt);
        }
      });

      // Pointer Move
      window.addEventListener('pointermove', e => {
        if (this.isPanning) {
          this.panX = e.clientX - this.panStart.x;
          this.panY = e.clientY - this.panStart.y;
          this.applyViewportTransform();
          return;
        }

        const pt = toArtboardCoords(e);
        this.toolManager.onPointerMove(e, pt);
        this.updateCursorCoords(pt);
      });

      // Pointer Up
      window.addEventListener('pointerup', e => {
        if (this.isPanning) {
          this.isPanning = false;
          container.classList.remove('panning');
          return;
        }
        const pt = toArtboardCoords(e);
        this.toolManager.onPointerUp(e, pt);
      });
    }

    // ------------------------------------------------------------------------
    // PIXEL RULERS (Canvas 2D Rendering)
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

      // Top Ruler Ticks
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

      // Left Ruler Ticks
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
    // UI PANELS & LAYERS STACK MANAGEMENT
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

      // Render top-to-bottom (highest layer index first)
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

        // Render mini thumbnail
        const thumbCanvas = item.querySelector('.layer-thumb canvas');
        thumbCanvas.getContext('2d').drawImage(layer.canvas, 0, 0, 32, 32);

        // Click to select
        item.addEventListener('click', () => {
          this.document.activeLayerId = layer.id;
          this.updateLayersUI();
        });

        // Visibility Toggle
        item.querySelector('.layer-vis-btn').addEventListener('click', e => {
          e.stopPropagation();
          layer.visible = !layer.visible;
          this.render();
          this.updateLayersUI();
        });

        listEl.appendChild(item);
      }

      // Sync Blend Mode & Opacity controls with active layer
      const active = this.document.getActiveLayer();
      if (active) {
        if ($('layerBlendSelect')) $('layerBlendSelect').value = active.blendMode;
        if ($('layerOpacityInput')) $('layerOpacityInput').value = Math.round(active.opacity * 100);
      }
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

      // Color Wells Click -> System Color Picker
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
      $('brushSizeInput')?.addEventListener('input', e => {
        this.toolManager.brush.size = parseInt(e.target.value, 10) || 35;
      });
      $('brushHardnessInput')?.addEventListener('input', e => {
        this.toolManager.brush.hardness = (parseInt(e.target.value, 10) || 80) / 100;
      });
      $('brushOpacityInput')?.addEventListener('input', e => {
        this.toolManager.brush.opacity = (parseInt(e.target.value, 10) || 100) / 100;
      });
    }

    updateOptionsBar(toolName) {
      // Toggle tool-specific option groups
      const title = $('activeToolTitle');
      if (title) title.textContent = toolName.toUpperCase().replace('_', ' ');
    }

    updateCursor() {
      const area = this.canvasContainer;
      area.style.cursor = this.toolManager.activeTool === 'move' ? 'move' : 
                          this.toolManager.activeTool === 'eyedropper' ? 'crosshair' : 'default';
    }

    // ------------------------------------------------------------------------
    // MENU BAR & DIALOGS
    // ------------------------------------------------------------------------
    initMenuBar() {
      // Menu bar click dropdowns
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

      // File -> New
      $('menuFileNew')?.addEventListener('click', () => $('modalNewDoc').hidden = false);

      // File -> Open
      $('menuFileOpen')?.addEventListener('click', () => {
        const fileIn = document.createElement('input');
        fileIn.type = 'file';
        fileIn.accept = 'image/*,.psd';
        fileIn.onchange = () => {
          if (fileIn.files && fileIn.files[0]) this.openImageFile(fileIn.files[0]);
        };
        fileIn.click();
      });

      // File -> Export
      $('menuFileExport')?.addEventListener('click', () => $('modalExport').hidden = false);
      $('btnQuickExport')?.addEventListener('click', () => $('modalExport').hidden = false);

      // Edit -> Undo / Redo
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

      // Filter Gallery Actions
      $('menuFilterBlur')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.Filters.gaussianBlur(active.ctx, 6);
          this.history.pushState('Gaussian Blur', this.document);
          this.render();
          this.updateLayersUI();
        }
      });

      $('menuFilterSharpen')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.Filters.sharpen(active.ctx);
          this.history.pushState('Sharpen', this.document);
          this.render();
          this.updateLayersUI();
        }
      });

      $('menuFilterOilPaint')?.addEventListener('click', () => {
        const active = this.document.getActiveLayer();
        if (active) {
          P.Filters.oilPaint(active.ctx, 3, 20);
          this.history.pushState('Oil Paint Filter', this.document);
          this.render();
          this.updateLayersUI();
        }
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
          await P.AiEngine.removeBackground(active);
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
      // Close buttons
      document.querySelectorAll('.studio-modal-close, [data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('.studio-modal-backdrop').hidden = true;
        });
      });

      // New Document Presets
      document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
          const w = parseInt(card.dataset.w, 10);
          const h = parseInt(card.dataset.h, 10);
          const name = card.querySelector('.preset-name').textContent;
          this.newDocument(w, h, name);
          $('modalNewDoc').hidden = true;
        });
      });

      // Export Dialog Execution
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
    }

    initShortcuts() {
      window.addEventListener('keydown', e => {
        // Ctrl+Z / Cmd+Z -> Undo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          $('menuEditUndo')?.click();
        }
        // Ctrl+Shift+Z / Ctrl+Y -> Redo
        if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          $('menuEditRedo')?.click();
        }
        // Tool hotkeys
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
