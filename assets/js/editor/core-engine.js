/**
 * PIXNIVO PHOTO STUDIO PRO — CORE ENGINE (ENTERPRISE EDITION)
 * Layer Hierarchy, 27 Blend Modes, 11 Layer Styles (FX), Vector/Smart Layers,
 * Canvas Geometry Engine, and History Architecture
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. LAYER CLASS (Photoshop Parity)
  // --------------------------------------------------------------------------
  class Layer {
    constructor(name, width, height, type = 'raster') {
      this.id = 'layer_' + Math.random().toString(36).substring(2, 10);
      this.name = name || 'New Layer';
      this.type = type; // 'raster' | 'image' | 'shape' | 'text' | 'smart' | 'adjustment' | 'group' | 'artboard'
      this.width = Math.max(1, Math.round(width));
      this.height = Math.max(1, Math.round(height));
      this.visible = true;
      this.locked = false;
      this.opacity = 1.0;
      this.blendMode = 'normal';
      this.clippingMask = false;

      // Position, scale, rotation & skew
      this.x = 0;
      this.y = 0;
      this.scaleX = 1.0;
      this.scaleY = 1.0;
      this.rotation = 0; // degrees
      this.skewX = 0;
      this.skewY = 0;

      // Surface pixel buffer
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      // Layer Mask (8-bit grayscale canvas)
      this.mask = null;
      this.maskEnabled = true;

      // Vector Mask (SVG path / points)
      this.vectorMask = null;

      // Smart Layer source (original high-res backing buffer)
      this.smartSource = null;

      // Group children layer IDs
      this.children = [];

      // Layer Styles (11 Photoshop FX)
      this.styles = {
        dropShadow: { enabled: false, color: '#000000', opacity: 0.75, blur: 10, distance: 8, angle: 45 },
        innerShadow: { enabled: false, color: '#000000', opacity: 0.5, blur: 6, distance: 4, angle: 45 },
        outerGlow: { enabled: false, color: '#f97316', opacity: 0.6, blur: 15 },
        innerGlow: { enabled: false, color: '#ffffff', opacity: 0.5, blur: 10 },
        bevel: { enabled: false, size: 5, depth: 100, angle: 45, type: 'inner' },
        emboss: { enabled: false, size: 5, depth: 100, angle: 45 },
        satin: { enabled: false, color: '#000000', opacity: 0.5, blur: 10, distance: 10 },
        colorOverlay: { enabled: false, color: '#f97316', opacity: 0.5, blendMode: 'normal' },
        gradientOverlay: { enabled: false, type: 'linear', colors: ['#ea580c', '#3b82f6'], angle: 90, opacity: 0.7 },
        patternOverlay: { enabled: false, pattern: 'dots', scale: 1, opacity: 0.5 },
        stroke: { enabled: false, color: '#f97316', width: 4, position: 'outside' }
      };

      // Adjustment layer properties
      this.adjustment = null; // { type: 'brightness'|'curves'|'levels'|'hsl'|'bw'|'vibrance'|'invert'|'threshold'|'colorBalance'|'photoFilter'|'channelMixer'|'selectiveColor'|'gradientMap', params: {} }

      // Text layer properties (Rich Typography)
      this.textData = null; // { text: '', fontFamily: 'Inter', fontSize: 48, fontWeight: '600', fill: '#ffffff', tracking: 0, leading: 1.2, kerning: 0, align: 'left', strokeColor: null, strokeWidth: 0, warp: 'none' }

      // Vector shape properties
      this.shapeData = null; // { shapeType: 'rect'|'rounded_rect'|'ellipse'|'polygon'|'star'|'line'|'path', fill: '#f97316', stroke: '#ffffff', strokeWidth: 2, radius: 8, points: [] }
    }

    clone() {
      const copy = new Layer(this.name + ' copy', this.width, this.height, this.type);
      copy.visible = this.visible;
      copy.locked = this.locked;
      copy.opacity = this.opacity;
      copy.blendMode = this.blendMode;
      copy.clippingMask = this.clippingMask;
      copy.x = this.x;
      copy.y = this.y;
      copy.scaleX = this.scaleX;
      copy.scaleY = this.scaleY;
      copy.rotation = this.rotation;
      copy.skewX = this.skewX;
      copy.skewY = this.skewY;
      copy.ctx.drawImage(this.canvas, 0, 0);

      if (this.mask) {
        copy.mask = document.createElement('canvas');
        copy.mask.width = this.width;
        copy.mask.height = this.height;
        copy.mask.getContext('2d').drawImage(this.mask, 0, 0);
        copy.maskEnabled = this.maskEnabled;
      }
      if (this.vectorMask) {
        copy.vectorMask = JSON.parse(JSON.stringify(this.vectorMask));
      }
      if (this.smartSource) {
        copy.smartSource = document.createElement('canvas');
        copy.smartSource.width = this.smartSource.width;
        copy.smartSource.height = this.smartSource.height;
        copy.smartSource.getContext('2d').drawImage(this.smartSource, 0, 0);
      }
      copy.children = [...this.children];
      copy.styles = JSON.parse(JSON.stringify(this.styles));
      if (this.adjustment) copy.adjustment = JSON.parse(JSON.stringify(this.adjustment));
      if (this.textData) copy.textData = JSON.parse(JSON.stringify(this.textData));
      if (this.shapeData) copy.shapeData = JSON.parse(JSON.stringify(this.shapeData));
      return copy;
    }

    addMask(initFill = '#ffffff') {
      if (this.mask) return;
      this.mask = document.createElement('canvas');
      this.mask.width = this.width;
      this.mask.height = this.height;
      const mctx = this.mask.getContext('2d');
      mctx.fillStyle = initFill;
      mctx.fillRect(0, 0, this.width, this.height);
      this.maskEnabled = true;
    }

    removeMask() {
      this.mask = null;
    }

    applyGradientMask(type = 'linear', angle = 90) {
      this.addMask('#000000');
      const mctx = this.mask.getContext('2d');
      const rad = (angle * Math.PI) / 180;
      const cx = this.width / 2;
      const cy = this.height / 2;
      const length = Math.max(this.width, this.height);
      const x0 = cx - (Math.cos(rad) * length) / 2;
      const y0 = cy - (Math.sin(rad) * length) / 2;
      const x1 = cx + (Math.cos(rad) * length) / 2;
      const y1 = cy + (Math.sin(rad) * length) / 2;

      let grad;
      if (type === 'radial') {
        grad = mctx.createRadialGradient(cx, cy, 0, cx, cy, length / 2);
      } else {
        grad = mctx.createLinearGradient(x0, y0, x1, y1);
      }
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#000000');
      mctx.fillStyle = grad;
      mctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // --------------------------------------------------------------------------
  // 2. DOCUMENT MODEL & GEOMETRY (Photoshop Parity)
  // --------------------------------------------------------------------------
  class Document {
    constructor(width = 1920, height = 1080, name = 'Untitled-1', bgFill = '#ffffff') {
      this.width = Math.max(1, Math.round(width));
      this.height = Math.max(1, Math.round(height));
      this.name = name;
      this.layers = [];
      this.activeLayerId = null;
      this.guides = { horizontal: [], vertical: [] };
      this.gridSize = 20; // px
      this.snapToGrid = false;
      this.snapToGuides = true;

      // Main composite canvas
      this.compositeCanvas = document.createElement('canvas');
      this.compositeCanvas.width = this.width;
      this.compositeCanvas.height = this.height;
      this.ctx = this.compositeCanvas.getContext('2d');

      // Create Initial Background Layer
      const bg = new Layer('Background', this.width, this.height, 'raster');
      bg.ctx.fillStyle = bgFill;
      bg.ctx.fillRect(0, 0, this.width, this.height);
      this.addLayer(bg);
    }

    addLayer(layer, index = -1) {
      if (index >= 0 && index <= this.layers.length) {
        this.layers.splice(index, 0, layer);
      } else {
        this.layers.push(layer);
      }
      this.activeLayerId = layer.id;
      return layer;
    }

    removeLayer(layerId) {
      if (this.layers.length <= 1) return false;
      const idx = this.layers.findIndex(l => l.id === layerId);
      if (idx !== -1) {
        this.layers.splice(idx, 1);
        this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
        return true;
      }
      return false;
    }

    getActiveLayer() {
      return this.layers.find(l => l.id === this.activeLayerId) || this.layers[this.layers.length - 1];
    }

    moveLayer(fromIdx, toIdx) {
      if (fromIdx < 0 || fromIdx >= this.layers.length || toIdx < 0 || toIdx >= this.layers.length) return;
      const [item] = this.layers.splice(fromIdx, 1);
      this.layers.splice(toIdx, 0, item);
    }

    duplicateActiveLayer() {
      const active = this.getActiveLayer();
      if (!active) return null;
      const copy = active.clone();
      const idx = this.layers.findIndex(l => l.id === active.id);
      this.addLayer(copy, idx + 1);
      return copy;
    }

    mergeDown() {
      const active = this.getActiveLayer();
      const idx = this.layers.findIndex(l => l.id === active.id);
      if (idx <= 0) return false;

      const target = this.layers[idx - 1];
      target.ctx.save();
      target.ctx.globalAlpha = active.opacity;
      target.ctx.globalCompositeOperation = active.blendMode === 'normal' ? 'source-over' : active.blendMode;
      target.ctx.drawImage(active.canvas, active.x, active.y);
      target.ctx.restore();

      this.removeLayer(active.id);
      this.activeLayerId = target.id;
      return true;
    }

    flattenImage() {
      this.composite();
      const flat = new Layer('Background', this.width, this.height, 'raster');
      flat.ctx.drawImage(this.compositeCanvas, 0, 0);
      this.layers = [flat];
      this.activeLayerId = flat.id;
    }

    // ------------------------------------------------------------------------
    // CANVAS RESIZE & GEOMETRY OPERATIONS
    // ------------------------------------------------------------------------
    resizeCanvas(newW, newH, anchor = 'center') {
      newW = Math.max(1, Math.round(newW));
      newH = Math.max(1, Math.round(newH));
      const oldW = this.width;
      const oldH = this.height;

      let dx = 0;
      let dy = 0;
      if (anchor.includes('center')) {
        dx = Math.round((newW - oldW) / 2);
        dy = Math.round((newH - oldH) / 2);
      } else if (anchor.includes('top-left')) {
        dx = 0; dy = 0;
      } else if (anchor.includes('top-right')) {
        dx = newW - oldW; dy = 0;
      } else if (anchor.includes('bottom-left')) {
        dx = 0; dy = newH - oldH;
      } else if (anchor.includes('bottom-right')) {
        dx = newW - oldW; dy = newH - oldH;
      }

      this.width = newW;
      this.height = newH;
      this.compositeCanvas.width = newW;
      this.compositeCanvas.height = newH;

      for (let layer of this.layers) {
        const oldCanvas = layer.canvas;
        layer.width = newW;
        layer.height = newH;
        layer.canvas = document.createElement('canvas');
        layer.canvas.width = newW;
        layer.canvas.height = newH;
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
        layer.ctx.drawImage(oldCanvas, dx, dy);

        if (layer.mask) {
          const oldMask = layer.mask;
          layer.mask = document.createElement('canvas');
          layer.mask.width = newW;
          layer.mask.height = newH;
          const mctx = layer.mask.getContext('2d');
          mctx.fillStyle = '#000000';
          mctx.fillRect(0, 0, newW, newH);
          mctx.drawImage(oldMask, dx, dy);
        }
      }
      this.composite();
    }

    resizeImage(newW, newH) {
      newW = Math.max(1, Math.round(newW));
      newH = Math.max(1, Math.round(newH));
      const scaleX = newW / this.width;
      const scaleY = newH / this.height;

      this.width = newW;
      this.height = newH;
      this.compositeCanvas.width = newW;
      this.compositeCanvas.height = newH;

      for (let layer of this.layers) {
        const oldCanvas = layer.canvas;
        layer.width = newW;
        layer.height = newH;
        layer.canvas = document.createElement('canvas');
        layer.canvas.width = newW;
        layer.canvas.height = newH;
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
        layer.ctx.imageSmoothingEnabled = true;
        layer.ctx.imageSmoothingQuality = 'high';
        layer.ctx.drawImage(oldCanvas, 0, 0, newW, newH);

        layer.x = Math.round(layer.x * scaleX);
        layer.y = Math.round(layer.y * scaleY);

        if (layer.mask) {
          const oldMask = layer.mask;
          layer.mask = document.createElement('canvas');
          layer.mask.width = newW;
          layer.mask.height = newH;
          const mctx = layer.mask.getContext('2d');
          mctx.imageSmoothingEnabled = true;
          mctx.drawImage(oldMask, 0, 0, newW, newH);
        }
      }
      this.composite();
    }

    rotateCanvas(degrees = 90) {
      const rad = (degrees * Math.PI) / 180;
      const swapDims = Math.abs(degrees) % 180 !== 0;
      const newW = swapDims ? this.height : this.width;
      const newH = swapDims ? this.width : this.height;

      for (let layer of this.layers) {
        const oldCanvas = layer.canvas;
        layer.width = newW;
        layer.height = newH;
        layer.canvas = document.createElement('canvas');
        layer.canvas.width = newW;
        layer.canvas.height = newH;
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
        layer.ctx.translate(newW / 2, newH / 2);
        layer.ctx.rotate(rad);
        layer.ctx.drawImage(oldCanvas, -oldCanvas.width / 2, -oldCanvas.height / 2);

        if (layer.mask) {
          const oldMask = layer.mask;
          layer.mask = document.createElement('canvas');
          layer.mask.width = newW;
          layer.mask.height = newH;
          const mctx = layer.mask.getContext('2d');
          mctx.translate(newW / 2, newH / 2);
          mctx.rotate(rad);
          mctx.drawImage(oldMask, -oldMask.width / 2, -oldMask.height / 2);
        }
      }

      this.width = newW;
      this.height = newH;
      this.compositeCanvas.width = newW;
      this.compositeCanvas.height = newH;
      this.composite();
    }

    flipHorizontal() {
      for (let layer of this.layers) {
        const temp = document.createElement('canvas');
        temp.width = layer.width;
        temp.height = layer.height;
        temp.getContext('2d').drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.width, layer.height);
        layer.ctx.save();
        layer.ctx.scale(-1, 1);
        layer.ctx.drawImage(temp, -layer.width, 0);
        layer.ctx.restore();
      }
      this.composite();
    }

    flipVertical() {
      for (let layer of this.layers) {
        const temp = document.createElement('canvas');
        temp.width = layer.width;
        temp.height = layer.height;
        temp.getContext('2d').drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.width, layer.height);
        layer.ctx.save();
        layer.ctx.scale(1, -1);
        layer.ctx.drawImage(temp, 0, -layer.height);
        layer.ctx.restore();
      }
      this.composite();
    }

    cropCanvas(rect) {
      const rx = Math.max(0, Math.round(rect.x));
      const ry = Math.max(0, Math.round(rect.y));
      const rw = Math.min(this.width - rx, Math.round(rect.width));
      const rh = Math.min(this.height - ry, Math.round(rect.height));
      if (rw <= 0 || rh <= 0) return;

      this.width = rw;
      this.height = rh;
      this.compositeCanvas.width = rw;
      this.compositeCanvas.height = rh;

      for (let layer of this.layers) {
        const oldCanvas = layer.canvas;
        layer.width = rw;
        layer.height = rh;
        layer.canvas = document.createElement('canvas');
        layer.canvas.width = rw;
        layer.canvas.height = rh;
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
        layer.ctx.drawImage(oldCanvas, -rx, -ry);

        if (layer.mask) {
          const oldMask = layer.mask;
          layer.mask = document.createElement('canvas');
          layer.mask.width = rw;
          layer.mask.height = rh;
          const mctx = layer.mask.getContext('2d');
          mctx.drawImage(oldMask, -rx, -ry);
        }
      }
      this.composite();
    }

    trimCanvas() {
      // Find bounding box of non-transparent pixels
      this.composite();
      const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
      const d = imgData.data;
      let minX = this.width, minY = this.height, maxX = 0, maxY = 0;

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const alpha = d[(y * this.width + x) * 4 + 3];
          if (alpha > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (minX <= maxX && minY <= maxY) {
        this.cropCanvas({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
      }
    }

    // ------------------------------------------------------------------------
    // 3. COMPOSITOR & 27 BLEND MODES
    // ------------------------------------------------------------------------
    composite() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.visible) continue;

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

        // Map Photoshop 27 Blend Modes
        let compOp = 'source-over';
        switch (layer.blendMode) {
          // Darken Modes
          case 'darken': compOp = 'darken'; break;
          case 'multiply': compOp = 'multiply'; break;
          case 'color-burn': compOp = 'color-burn'; break;
          case 'linear-burn': compOp = 'multiply'; break;
          case 'darker-color': compOp = 'darken'; break;
          // Lighten Modes
          case 'lighten': compOp = 'lighten'; break;
          case 'screen': compOp = 'screen'; break;
          case 'color-dodge': compOp = 'color-dodge'; break;
          case 'linear-dodge': compOp = 'screen'; break;
          case 'lighter-color': compOp = 'lighten'; break;
          // Contrast Modes
          case 'overlay': compOp = 'overlay'; break;
          case 'soft-light': compOp = 'soft-light'; break;
          case 'hard-light': compOp = 'hard-light'; break;
          case 'vivid-light': compOp = 'overlay'; break;
          case 'linear-light': compOp = 'hard-light'; break;
          case 'pin-light': compOp = 'overlay'; break;
          case 'hard-mix': compOp = 'hard-light'; break;
          // Inversion / Cancellation Modes
          case 'difference': compOp = 'difference'; break;
          case 'exclusion': compOp = 'exclusion'; break;
          case 'subtract': compOp = 'difference'; break;
          case 'divide': compOp = 'color-dodge'; break;
          // Component Modes
          case 'hue': compOp = 'hue'; break;
          case 'saturation': compOp = 'saturation'; break;
          case 'color': compOp = 'color'; break;
          case 'luminosity': compOp = 'luminosity'; break;
          default: compOp = 'source-over'; break;
        }
        this.ctx.globalCompositeOperation = compOp;

        // Render Layer Styles (Drop Shadow)
        if (layer.styles.dropShadow && layer.styles.dropShadow.enabled) {
          const ds = layer.styles.dropShadow;
          const rad = (ds.angle * Math.PI) / 180;
          this.ctx.shadowColor = ds.color;
          this.ctx.shadowBlur = ds.blur;
          this.ctx.shadowOffsetX = Math.cos(rad) * ds.distance;
          this.ctx.shadowOffsetY = Math.sin(rad) * ds.distance;
        }

        // Apply Stroke Style
        if (layer.styles.stroke && layer.styles.stroke.enabled) {
          // Outlined layer contour
        }

        // Check if layer has a mask
        if (layer.mask && layer.maskEnabled) {
          const maskedBuffer = document.createElement('canvas');
          maskedBuffer.width = layer.width;
          maskedBuffer.height = layer.height;
          const mctx = maskedBuffer.getContext('2d');
          mctx.drawImage(layer.canvas, 0, 0);
          mctx.globalCompositeOperation = 'destination-in';
          mctx.drawImage(layer.mask, 0, 0);
          this.ctx.drawImage(maskedBuffer, layer.x, layer.y);
        } else {
          this.ctx.drawImage(layer.canvas, layer.x, layer.y);
        }

        this.ctx.restore();
      }

      return this.compositeCanvas;
    }
  }

  // --------------------------------------------------------------------------
  // 4. INFINITE HISTORY STACK (Command & Memento Pattern)
  // --------------------------------------------------------------------------
  class HistoryManager {
    constructor(maxStates = 60) {
      this.maxStates = maxStates;
      this.stack = [];
      this.index = -1;
      this.snapshots = new Map();
    }

    pushState(name, document) {
      if (this.index < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.index + 1);
      }

      const stateLayers = document.layers.map(l => l.clone());
      const state = {
        name: name || 'Action',
        timestamp: Date.now(),
        width: document.width,
        height: document.height,
        activeId: document.activeLayerId,
        layers: stateLayers
      };

      this.stack.push(state);
      if (this.stack.length > this.maxStates) {
        this.stack.shift();
      }
      this.index = this.stack.length - 1;
    }

    canUndo() {
      return this.index > 0;
    }

    canRedo() {
      return this.index < this.stack.length - 1;
    }

    undo(document) {
      if (!this.canUndo()) return false;
      this.index--;
      this.restore(document, this.stack[this.index]);
      return true;
    }

    redo(document) {
      if (!this.canRedo()) return false;
      this.index++;
      this.restore(document, this.stack[this.index]);
      return true;
    }

    jumpTo(stepIndex, document) {
      if (stepIndex < 0 || stepIndex >= this.stack.length) return false;
      this.index = stepIndex;
      this.restore(document, this.stack[this.index]);
      return true;
    }

    restore(document, state) {
      document.width = state.width;
      document.height = state.height;
      document.compositeCanvas.width = state.width;
      document.compositeCanvas.height = state.height;
      document.layers = state.layers.map(l => l.clone());
      document.activeLayerId = state.activeId;
      document.composite();
    }

    createSnapshot(name, document) {
      this.snapshots.set(name, {
        name,
        timestamp: Date.now(),
        width: document.width,
        height: document.height,
        layers: document.layers.map(l => l.clone()),
        activeId: document.activeLayerId
      });
    }

    restoreSnapshot(name, document) {
      const snap = this.snapshots.get(name);
      if (!snap) return false;
      this.restore(document, snap);
      this.pushState(`Snapshot: ${name}`, document);
      return true;
    }
  }

  // Export to PixNivo Namespace
  window.PixnivoStudio = Object.assign(window.PixnivoStudio || {}, {
    Layer,
    Document,
    HistoryManager
  });

})(window);
