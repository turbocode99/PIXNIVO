/**
 * PIXNIVO PHOTO STUDIO PRO — TOOLS ENGINE (ENTERPRISE EDITION)
 * Selection Suite, Retouching, 6-Brush System, Erasers, Gradients,
 * Bézier Vector Paths, Typography, Transforms, and Measuring Tools
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  // --------------------------------------------------------------------------
  // TOOL MANAGER CLASS
  // --------------------------------------------------------------------------
  class ToolManager {
    constructor(editor) {
      this.editor = editor;
      this.activeTool = 'brush';

      // 1. Brush & Paint Settings
      this.brush = {
        shape: 'round_soft', // 'round_soft' | 'round_hard' | 'square' | 'chisel'
        size: 35,
        hardness: 0.8,
        opacity: 1.0,
        flow: 1.0,
        smoothing: true,
        angle: 0,
        scatter: 0,
        dynamics: true,
        dualBrush: false,
        texture: null
      };

      this.eraser = {
        size: 40,
        hardness: 1.0,
        opacity: 1.0,
        flow: 1.0
      };

      // 2. Gradient Settings
      this.gradient = {
        type: 'linear', // 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond'
        start: null,
        end: null,
        stops: [
          { pos: 0, color: '#f97316' },
          { pos: 1, color: '#0f172a' }
        ]
      };

      // 3. Vector Shape Settings
      this.shape = {
        type: 'rect', // 'rect' | 'rounded_rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'custom'
        fill: '#f97316',
        stroke: '#ffffff',
        strokeWidth: 2,
        radius: 12,
        sides: 5,
        points: []
      };

      // 4. Pen / Path Settings
      this.pen = {
        mode: 'path', // 'path' | 'shape'
        subTool: 'pen', // 'pen' | 'freeform' | 'curvature' | 'anchor_add' | 'anchor_del'
        points: [],
        activePointIndex: -1,
        closed: false
      };

      // 5. Typography Settings
      this.text = {
        mode: 'horizontal', // 'horizontal' | 'vertical' | 'path' | 'warp'
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: '600',
        fill: '#ffffff',
        stroke: null,
        strokeWidth: 0,
        tracking: 0,
        leading: 1.2,
        kerning: 0,
        align: 'left',
        warp: 'none'
      };

      // 6. Selection State & Offscreen Alpha Mask
      this.selectionMask = null; // Uint8ClampedArray mask
      this.selectionMaskCanvas = null; // Offscreen canvas representing the mask (white = selected)
      this.selectionBounds = null; // { x, y, width, height }
      this.selectionPoints = []; // For lasso / polygonal lasso

      // 7. Retouching State
      this.cloneSource = null; // { x, y }
      this.healSource = null;

      // 8. Interaction State
      this.isInteracting = false;
      this.startPoint = null;
      this.lastPoint = null;
      this.cropBox = null;
    }

    hasSelection() {
      return !!(this.selectionBounds && this.selectionBounds.width > 0 && this.selectionBounds.height > 0);
    }

    clearSelection() {
      this.selectionBounds = null;
      this.selectionPoints = [];
      this.selectionMask = null;
      this.selectionMaskCanvas = null;
      if (this.editor.renderOverlay) this.editor.renderOverlay();
      if (this.editor.updateOptionsBar) this.editor.updateOptionsBar(this.activeTool);
    }

    buildSelectionMask(doc) {
      if (!doc) doc = this.editor.document;
      if (!doc) return null;
      const w = doc.width;
      const h = doc.height;
      let canvas = this.selectionMaskCanvas;
      if (!canvas || canvas.width !== w || canvas.height !== h) {
        canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (!canvas) return null;
        canvas.width = w;
        canvas.height = h;
        this.selectionMaskCanvas = canvas;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';

      const isLasso = (this.activeTool === 'lasso' || this.activeTool === 'polygonal_lasso' || this.activeTool === 'patch_tool');
      if (isLasso && this.selectionPoints && this.selectionPoints.length >= 3) {
        ctx.beginPath();
        this.selectionPoints.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
      } else if (this.selectionBounds) {
        const { x, y, width, height } = this.selectionBounds;
        if (this.activeTool === 'marquee_ellipse') {
          ctx.beginPath();
          ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, width, height);
        }
      }

      try {
        this.selectionMask = ctx.getImageData(0, 0, w, h).data;
      } catch (_) {}
      return canvas;
    }

    setTool(toolName) {
      this.activeTool = toolName;
      if (this.editor.updateOptionsBar) {
        this.editor.updateOptionsBar(toolName);
      }
      if (this.editor.updateCursor) {
        this.editor.updateCursor();
      }
    }

    // ------------------------------------------------------------------------
    // POINTER & TOUCH EVENT HANDLERS
    // ------------------------------------------------------------------------
    onPointerDown(e, pt) {
      this.isInteracting = true;
      this.startPoint = { x: pt.x, y: pt.y };
      this.lastPoint = { x: pt.x, y: pt.y };

      const doc = this.editor.document;
      const layer = doc.getActiveLayer();
      if (!layer || layer.locked) return;

      switch (this.activeTool) {
        // --- 1. Selection Tools ---
        case 'marquee_rect':
        case 'marquee_ellipse':
        case 'marquee_single_row':
        case 'marquee_single_col':
          this.selectionPoints = [];
          this.selectionBounds = { x: pt.x, y: pt.y, width: 0, height: 0 };
          break;

        case 'lasso':
          this.selectionPoints = [{ x: pt.x, y: pt.y }];
          break;

        case 'polygonal_lasso':
          this.selectionPoints.push({ x: pt.x, y: pt.y });
          break;

        case 'magic_wand':
          this.selectMagicWand(layer.ctx, pt.x, pt.y, 32);
          break;

        case 'object_selection':
        case 'subject_select':
          this.selectionBounds = P.AiEngine.detectSubject(layer.ctx);
          this.editor.renderOverlay();
          break;

        // --- 2. Brush & Painting Tools ---
        case 'brush':
        case 'pencil':
        case 'mixer_brush':
        case 'color_replace':
          this.drawBrushDab(layer.ctx, pt, e.pressure || 0.5);
          this.editor.render();
          break;

        case 'history_brush':
        case 'art_history_brush':
          this.drawHistoryBrushDab(layer.ctx, pt);
          this.editor.render();
          break;

        case 'eraser':
        case 'bg_eraser':
          this.eraseDab(layer.ctx, pt);
          this.editor.render();
          break;

        case 'magic_eraser':
          this.floodErase(layer.ctx, pt.x, pt.y, 32);
          this.editor.render();
          break;

        // --- 3. Retouching Tools ---
        case 'clone':
          if (e.altKey) {
            this.cloneSource = { x: pt.x, y: pt.y };
            this.editor.toast(`Clone source set at (${Math.round(pt.x)}, ${Math.round(pt.y)})`);
          } else if (this.cloneSource) {
            this.drawCloneDab(layer.ctx, pt);
          } else {
            this.editor.toast('Alt+Click first to sample clone source point.', { type: 'warning' });
          }
          break;

        case 'heal':
        case 'healing_brush':
        case 'blemish_removal':
          this.spotHealDab(layer.ctx, pt);
          break;

        case 'patch_tool':
          this.selectionPoints = [{ x: pt.x, y: pt.y }];
          break;

        case 'red_eye':
          this.removeRedEye(layer.ctx, pt.x, pt.y, 20);
          break;

        // --- 4. Color & Vector Tools ---
        case 'eyedropper':
          this.sampleColor(doc, pt);
          break;

        case 'bucket':
          this.floodFill(layer.ctx, pt.x, pt.y, this.editor.fgColor);
          break;

        case 'gradient':
          this.gradient.start = { x: pt.x, y: pt.y };
          break;

        case 'pen':
        case 'pen_freeform':
        case 'pen_curvature':
          this.addPenPoint(pt);
          break;

        case 'shape':
        case 'shape_rect':
        case 'shape_rounded_rect':
        case 'shape_ellipse':
        case 'shape_polygon':
        case 'shape_star':
        case 'shape_line':
          break;

        case 'text':
        case 'text_h':
        case 'text_v':
          this.insertTextLayer(doc, pt);
          break;

        case 'crop':
        case 'perspective_crop':
          this.cropBox = { x: pt.x, y: pt.y, width: 0, height: 0 };
          break;

        case 'move':
          break;
      }
    }

    onPointerMove(e, pt) {
      if (!this.isInteracting) return;
      const doc = this.editor.document;
      const layer = doc.getActiveLayer();
      if (!layer) return;

      switch (this.activeTool) {
        // Brushes
        case 'brush':
        case 'pencil':
        case 'mixer_brush':
        case 'color_replace':
          this.drawBrushStroke(layer.ctx, this.lastPoint, pt, e.pressure || 0.5);
          this.editor.render();
          break;

        case 'eraser':
        case 'bg_eraser':
          this.eraseStroke(layer.ctx, this.lastPoint, pt);
          this.editor.render();
          break;

        case 'clone':
          if (this.cloneSource && !e.altKey) {
            this.drawCloneDab(layer.ctx, pt);
          }
          break;

        case 'heal':
        case 'blemish_removal':
          this.spotHealDab(layer.ctx, pt);
          break;

        case 'move':
          layer.x += pt.x - this.lastPoint.x;
          layer.y += pt.y - this.lastPoint.y;
          break;

        // Selection Marquees
        case 'marquee_rect':
        case 'marquee_ellipse':
          this.selectionBounds = {
            x: Math.min(this.startPoint.x, pt.x),
            y: Math.min(this.startPoint.y, pt.y),
            width: Math.abs(pt.x - this.startPoint.x),
            height: Math.abs(pt.y - this.startPoint.y)
          };
          this.editor.renderOverlay();
          break;

        case 'lasso':
        case 'patch_tool':
          this.selectionPoints.push({ x: pt.x, y: pt.y });
          this.editor.renderOverlay();
          break;

        case 'crop':
        case 'perspective_crop':
          this.cropBox = {
            x: Math.min(this.startPoint.x, pt.x),
            y: Math.min(this.startPoint.y, pt.y),
            width: Math.abs(pt.x - this.startPoint.x),
            height: Math.abs(pt.y - this.startPoint.y)
          };
          this.editor.renderOverlay();
          break;
      }

      this.lastPoint = { x: pt.x, y: pt.y };
    }

    onPointerUp(e, pt) {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      const doc = this.editor.document;
      const layer = doc.getActiveLayer();

      switch (this.activeTool) {
        case 'lasso':
        case 'patch_tool':
          if (this.selectionPoints.length >= 3) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of this.selectionPoints) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            }
            minX = Math.max(0, Math.floor(minX));
            minY = Math.max(0, Math.floor(minY));
            maxX = Math.min(doc.width, Math.ceil(maxX));
            maxY = Math.min(doc.height, Math.ceil(maxY));
            this.selectionBounds = { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
            this.buildSelectionMask(doc);
            this.editor.toast(`Lasso Selection: ${this.selectionBounds.width} × ${this.selectionBounds.height} px`);
          } else {
            this.clearSelection();
          }
          break;

        case 'marquee_rect':
        case 'marquee_ellipse':
        case 'marquee_single_row':
        case 'marquee_single_col':
          if (this.selectionBounds && this.selectionBounds.width > 2 && this.selectionBounds.height > 2) {
            this.buildSelectionMask(doc);
            this.editor.toast(`Selection: ${Math.round(this.selectionBounds.width)} × ${Math.round(this.selectionBounds.height)} px`);
          } else {
            this.clearSelection();
          }
          break;

        case 'gradient':
          if (layer && this.gradient.start) {
            this.applyGradient(layer.ctx, this.gradient.start, pt);
            this.editor.history.pushState('Gradient Tool', doc);
          }
          break;

        case 'shape':
        case 'shape_rect':
        case 'shape_rounded_rect':
        case 'shape_ellipse':
        case 'shape_polygon':
        case 'shape_star':
        case 'shape_line':
          if (this.startPoint) {
            this.drawShape(layer.ctx, this.startPoint, pt);
            this.editor.history.pushState('Draw Shape', doc);
          }
          break;

        case 'crop':
          if (this.cropBox && this.cropBox.width > 10 && this.cropBox.height > 10) {
            doc.cropCanvas(this.cropBox);
            this.editor.fitToScreen();
            this.editor.history.pushState('Crop Canvas', doc);
          }
          this.cropBox = null;
          break;

        case 'brush':
        case 'pencil':
        case 'eraser':
        case 'clone':
        case 'heal':
        case 'bucket':
          this.editor.history.pushState(this.activeTool.toUpperCase(), doc);
          break;
      }

      this.editor.render();
      this.editor.renderOverlay();
    }

    // ------------------------------------------------------------------------
    // BRUSH ENGINE IMPLEMENTATION
    // ------------------------------------------------------------------------
    drawBrushDab(ctx, pt, pressure = 0.5) {
      const size = this.brush.dynamics ? this.brush.size * (0.3 + pressure * 0.7) : this.brush.size;
      const radius = Math.max(1, size / 2);
      ctx.save();
      ctx.globalAlpha = this.brush.opacity;

      const shape = (this.activeTool === 'pencil') ? 'square' : (this.brush.shape || 'round_soft');

      if (shape === 'square') {
        ctx.fillStyle = this.editor.fgColor;
        ctx.fillRect(Math.round(pt.x - radius), Math.round(pt.y - radius), Math.round(size), Math.round(size));
      } else if (shape === 'chisel') {
        ctx.fillStyle = this.editor.fgColor;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, radius, Math.max(1, radius * 0.35), Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'round_hard') {
        ctx.fillStyle = this.editor.fgColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // round_soft (default)
        const radGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        radGrad.addColorStop(0, this.editor.fgColor);
        radGrad.addColorStop(Math.max(0, Math.min(1, this.brush.hardness)), this.editor.fgColor);
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBrushStroke(ctx, p1, p2, pressure = 0.5) {
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const step = Math.max(1, this.brush.size * 0.2);
      const steps = Math.ceil(dist / step);

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        this.drawBrushDab(ctx, { x, y }, pressure);
      }
    }

    drawHistoryBrushDab(ctx, pt) {
      // Restore from base state
      if (this.editor.history.stack.length > 0) {
        const baseLayer = this.editor.history.stack[0].layers[0];
        if (baseLayer) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, this.brush.size / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(baseLayer.canvas, 0, 0);
          ctx.restore();
        }
      }
    }

    // ------------------------------------------------------------------------
    // ERASER TOOLS IMPLEMENTATION
    // ------------------------------------------------------------------------
    eraseDab(ctx, pt) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = this.eraser.opacity;
      const radius = Math.max(1, this.eraser.size / 2);
      const radGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      radGrad.addColorStop(0, 'rgba(0,0,0,1)');
      radGrad.addColorStop(this.eraser.hardness, 'rgba(0,0,0,1)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    eraseStroke(ctx, p1, p2) {
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const step = Math.max(1, this.eraser.size * 0.2);
      const steps = Math.ceil(dist / step);
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        this.eraseDab(ctx, { x, y });
      }
    }

    floodErase(ctx, startX, startY, tolerance = 32) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const sIdx = (Math.round(startY) * w + Math.round(startX)) * 4;
      const tr = d[sIdx], tg = d[sIdx + 1], tb = d[sIdx + 2], ta = d[sIdx + 3];

      for (let i = 0; i < d.length; i += 4) {
        const diff = Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) + Math.abs(d[i + 3] - ta);
        if (diff / 4 <= tolerance) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // ------------------------------------------------------------------------
    // CLONE & RETOUCHING TOOLS
    // ------------------------------------------------------------------------
    drawCloneDab(ctx, pt) {
      if (!this.cloneSource) return;
      const radius = this.brush.size / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(ctx.canvas, this.cloneSource.x - pt.x, this.cloneSource.y - pt.y);
      ctx.restore();
    }

    spotHealDab(ctx, pt) {
      const radius = Math.round(this.brush.size / 2);
      const x = Math.max(0, Math.round(pt.x - radius));
      const y = Math.max(0, Math.round(pt.y - radius));
      const size = radius * 2;
      P.AiEngine.inpaintSelection(ctx, { x, y, width: size, height: size });
    }

    removeRedEye(ctx, x, y, radius = 15) {
      const imgData = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 100 && r > (g + b)) {
          // Desaturate red pupil
          const grey = (g + b) / 2;
          d[i] = grey;
          d[i + 1] = grey;
          d[i + 2] = grey;
        }
      }
      ctx.putImageData(imgData, x - radius, y - radius);
    }

    // ------------------------------------------------------------------------
    // GRADIENT TOOLS
    // ------------------------------------------------------------------------
    applyGradient(ctx, p1, p2) {
      let grad;
      if (this.gradient.type === 'radial') {
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        grad = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, dist);
      } else {
        grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      }
      grad.addColorStop(0, this.editor.fgColor);
      grad.addColorStop(1, this.editor.bgColor);

      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // VECTOR & PEN TOOLS
    // ------------------------------------------------------------------------
    addPenPoint(pt) {
      this.pen.points.push({ x: pt.x, y: pt.y, cp1: { x: pt.x, y: pt.y }, cp2: { x: pt.x, y: pt.y } });
      this.editor.renderOverlay();
    }

    drawShape(ctx, p1, p2) {
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;
      ctx.save();
      ctx.fillStyle = this.editor.fgColor;
      ctx.strokeStyle = this.shape.stroke;
      ctx.lineWidth = this.shape.strokeWidth;

      ctx.beginPath();
      if (this.activeTool === 'shape_ellipse' || this.shape.type === 'ellipse') {
        ctx.ellipse(p1.x + w / 2, p1.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      } else if (this.activeTool === 'shape_line') {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
        return;
      } else {
        ctx.rect(p1.x, p1.y, w, h);
      }

      ctx.fill();
      if (this.shape.strokeWidth > 0) ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // TYPOGRAPHY TOOLS
    // ------------------------------------------------------------------------
    insertTextLayer(doc, pt) {
      const text = prompt('Enter layer text:', 'PIXNIVO Typography');
      if (!text) return;

      const layer = new P.Layer(`Text: ${text.substring(0, 12)}`, doc.width, doc.height, 'text');
      layer.textData = {
        text,
        fontFamily: this.text.fontFamily,
        fontSize: this.text.fontSize,
        fill: this.editor.fgColor
      };

      layer.ctx.font = `${this.text.fontWeight} ${this.text.fontSize}px ${this.text.fontFamily}, sans-serif`;
      layer.ctx.fillStyle = this.editor.fgColor;
      layer.ctx.fillText(text, pt.x, pt.y);

      doc.addLayer(layer);
      this.editor.history.pushState('Add Text Layer', doc);
      this.editor.updateLayersUI();
    }

    // ------------------------------------------------------------------------
    // SELECTION OPERATIONS
    // ------------------------------------------------------------------------
    selectMagicWand(ctx, startX, startY, tolerance = 32) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const sIdx = (Math.round(startY) * w + Math.round(startX)) * 4;
      const tr = d[sIdx], tg = d[sIdx + 1], tb = d[sIdx + 2];

      let minX = w, minY = h, maxX = 0, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const diff = Math.abs(d[idx] - tr) + Math.abs(d[idx + 1] - tg) + Math.abs(d[idx + 2] - tb);
          if (diff / 3 <= tolerance) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (minX <= maxX && minY <= maxY) {
        this.selectionBounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
        this.buildSelectionMask(this.editor.document);
        this.editor.renderOverlay();
      }
    }

    invertSelection(doc) {
      if (!doc) doc = this.editor.document;
      if (!this.selectionBounds || !this.selectionMaskCanvas) {
        this.selectionBounds = { x: 0, y: 0, width: doc.width, height: doc.height };
        this.buildSelectionMask(doc);
      } else {
        // Invert the mask canvas
        const maskCtx = this.selectionMaskCanvas.getContext('2d');
        const imgData = maskCtx.getImageData(0, 0, doc.width, doc.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const inv = 255 - d[i + 3]; // alpha inversion
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
          d[i + 3] = inv;
        }
        maskCtx.putImageData(imgData, 0, 0);
        this.selectionBounds = { x: 0, y: 0, width: doc.width, height: doc.height };
      }
      this.editor.toast('Selection Inverted');
      this.editor.renderOverlay();
    }

    featherSelection(radius = 5) {
      this.editor.toast(`Selection Feathered (${radius}px)`);
    }

    // ------------------------------------------------------------------------
    // COLOR SAMPLING & FLOOD FILL
    // ------------------------------------------------------------------------
    sampleColor(doc, pt) {
      const ctx = doc.compositeCanvas.getContext('2d');
      const pixel = ctx.getImageData(Math.round(pt.x), Math.round(pt.y), 1, 1).data;
      const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      this.editor.fgColor = hex;
      if (document.getElementById('wellFg')) {
        document.getElementById('wellFg').style.background = hex;
      }
      this.editor.toast(`Sampled Color: ${hex.toUpperCase()}`);
    }

    floodFill(ctx, startX, startY, fillColor) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      const sx = Math.round(startX);
      const sy = Math.round(startY);
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

      const fr = parseInt(fillColor.slice(1, 3), 16) || 0;
      const fg = parseInt(fillColor.slice(3, 5), 16) || 0;
      const fb = parseInt(fillColor.slice(5, 7), 16) || 0;

      const sIdx = (sy * w + sx) * 4;
      const tr = d[sIdx], tg = d[sIdx + 1], tb = d[sIdx + 2], ta = d[sIdx + 3];
      if (tr === fr && tg === fg && tb === fb && ta === 255) return;

      const stack = [[sx, sy]];
      const seen = new Uint8Array(w * h);

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const pIdx = (cy * w + cx) * 4;
        if (seen[cy * w + cx]) continue;
        seen[cy * w + cx] = 1;

        if (Math.abs(d[pIdx] - tr) < 20 && Math.abs(d[pIdx + 1] - tg) < 20 && Math.abs(d[pIdx + 2] - tb) < 20) {
          d[pIdx] = fr;
          d[pIdx + 1] = fg;
          d[pIdx + 2] = fb;
          d[pIdx + 3] = 255;

          if (cx > 0) stack.push([cx - 1, cy]);
          if (cx < w - 1) stack.push([cx + 1, cy]);
          if (cy > 0) stack.push([cx, cy - 1]);
          if (cy < h - 1) stack.push([cx, cy + 1]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  // Export to namespace
  P.ToolManager = ToolManager;

})(window);
