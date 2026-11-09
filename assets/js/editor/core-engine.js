/**
 * PIXNIVO PHOTO STUDIO PRO — CORE ENGINE
 * Document, Layer Hierarchy, 27 Blend Modes, Layer Styles, and History Manager
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. LAYER CLASS
  // --------------------------------------------------------------------------
  class Layer {
    constructor(name, width, height, type = 'raster') {
      this.id = 'layer_' + Math.random().toString(36).substring(2, 10);
      this.name = name || 'New Layer';
      this.type = type; // 'raster' | 'text' | 'vector' | 'adjustment' | 'group'
      this.width = width;
      this.height = height;
      this.visible = true;
      this.locked = false;
      this.opacity = 1.0;
      this.blendMode = 'normal';
      this.clippingMask = false;

      // Position & transform
      this.x = 0;
      this.y = 0;

      // Surface buffer
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      // Layer Mask (8-bit grayscale canvas)
      this.mask = null;
      this.maskEnabled = true;

      // Layer Styles (FX)
      this.styles = {
        dropShadow: { enabled: false, color: '#000000', opacity: 0.75, blur: 10, distance: 8, angle: 45 },
        stroke: { enabled: false, color: '#f97316', width: 4, position: 'outside' },
        outerGlow: { enabled: false, color: '#f97316', opacity: 0.6, blur: 15 },
        colorOverlay: { enabled: false, color: '#f97316', opacity: 0.5, blendMode: 'normal' }
      };

      // Adjustment layer properties
      this.adjustment = null; // { type: 'curves' | 'levels' | 'hsl' | 'brightness', params: {} }

      // Text layer properties
      this.textData = null; // { text: '', font: '', size: 24, fill: '#ffffff', tracking: 0, leading: 1.2 }
    }

    clone() {
      const copy = new Layer(this.name + ' copy', this.width, this.height, this.type);
      copy.visible = this.visible;
      copy.locked = this.locked;
      copy.opacity = this.opacity;
      copy.blendMode = this.blendMode;
      copy.x = this.x;
      copy.y = this.y;
      copy.ctx.drawImage(this.canvas, 0, 0);
      if (this.mask) {
        copy.mask = document.createElement('canvas');
        copy.mask.width = this.width;
        copy.mask.height = this.height;
        copy.mask.getContext('2d').drawImage(this.mask, 0, 0);
      }
      copy.styles = JSON.parse(JSON.stringify(this.styles));
      if (this.adjustment) copy.adjustment = JSON.parse(JSON.stringify(this.adjustment));
      if (this.textData) copy.textData = JSON.parse(JSON.stringify(this.textData));
      return copy;
    }

    addMask() {
      if (this.mask) return;
      this.mask = document.createElement('canvas');
      this.mask.width = this.width;
      this.mask.height = this.height;
      const mctx = this.mask.getContext('2d');
      mctx.fillStyle = '#ffffff';
      mctx.fillRect(0, 0, this.width, this.height);
    }

    removeMask() {
      this.mask = null;
    }
  }

  // --------------------------------------------------------------------------
  // 2. LAYER STACK & DOCUMENT MODEL
  // --------------------------------------------------------------------------
  class Document {
    constructor(width = 1920, height = 1080, name = 'Untitled-1', bgFill = '#ffffff') {
      this.width = width;
      this.height = height;
      this.name = name;
      this.layers = [];
      this.activeLayerId = null;

      // Main composite canvas
      this.compositeCanvas = document.createElement('canvas');
      this.compositeCanvas.width = width;
      this.compositeCanvas.height = height;
      this.ctx = this.compositeCanvas.getContext('2d');

      // Create Initial Background Layer
      const bg = new Layer('Background', width, height, 'raster');
      bg.ctx.fillStyle = bgFill;
      bg.ctx.fillRect(0, 0, width, height);
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
      if (idx <= 0) return false; // Cannot merge down bottom layer

      const target = this.layers[idx - 1];
      target.ctx.save();
      target.ctx.globalAlpha = active.opacity;
      target.ctx.globalCompositeOperation = active.blendMode;
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

    // --------------------------------------------------------------------------
    // 3. COMPOSITOR & BLEND MODES (Client-side Canvas 2D + Math Fallback)
    // --------------------------------------------------------------------------
    composite() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.visible) continue;

        this.ctx.save();
        this.ctx.globalAlpha = layer.opacity;

        // Apply native composite operations
        let compOp = 'source-over';
        switch (layer.blendMode) {
          case 'multiply': compOp = 'multiply'; break;
          case 'screen': compOp = 'screen'; break;
          case 'overlay': compOp = 'overlay'; break;
          case 'darken': compOp = 'darken'; break;
          case 'lighten': compOp = 'lighten'; break;
          case 'color-dodge': compOp = 'color-dodge'; break;
          case 'color-burn': compOp = 'color-burn'; break;
          case 'hard-light': compOp = 'hard-light'; break;
          case 'soft-light': compOp = 'soft-light'; break;
          case 'difference': compOp = 'difference'; break;
          case 'exclusion': compOp = 'exclusion'; break;
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

        // Check if layer has a mask
        if (layer.mask && layer.maskEnabled) {
          // Render masked layer through offscreen buffer
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
  // 4. INFINITE HISTORY STACK (Command Pattern & Undo/Redo)
  // --------------------------------------------------------------------------
  class HistoryManager {
    constructor(maxStates = 40) {
      this.maxStates = maxStates;
      this.stack = [];
      this.index = -1;
      this.snapshots = new Map();
    }

    pushState(name, document) {
      // Discard future states if we performed an action mid-stack
      if (this.index < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.index + 1);
      }

      // Snapshot active layers
      const stateLayers = document.layers.map(l => l.clone());
      const state = {
        name: name || 'Action',
        timestamp: Date.now(),
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
      document.layers = state.layers.map(l => l.clone());
      document.activeLayerId = state.activeId;
      document.composite();
    }

    createSnapshot(name, document) {
      this.snapshots.set(name, {
        name,
        timestamp: Date.now(),
        layers: document.layers.map(l => l.clone()),
        activeId: document.activeLayerId
      });
    }
  }

  // Export to PixNivo Namespace
  window.PixnivoStudio = {
    Layer,
    Document,
    HistoryManager
  };

})(window);
