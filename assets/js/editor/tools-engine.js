/**
 * PIXNIVO PHOTO STUDIO PRO — TOOLS ENGINE
 * Implements Selection, Brush Dynamics, Retouching, Vectors, Text, Gradients, and Crop
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  // --------------------------------------------------------------------------
  // 1. TOOL SETTINGS & STATE
  // --------------------------------------------------------------------------
  class ToolManager {
    constructor(editor) {
      this.editor = editor;
      this.activeTool = 'brush'; // 'move' | 'marquee_rect' | 'marquee_ellipse' | 'lasso' | 'wand' | 'brush' | 'pencil' | 'eraser' | 'clone' | 'heal' | 'pen' | 'shape' | 'text' | 'crop' | 'bucket' | 'gradient' | 'eyedropper'

      // Tool Settings
      this.brush = {
        size: 35,
        hardness: 0.8,
        opacity: 1.0,
        flow: 1.0,
        smoothing: true
      };

      this.eraser = {
        size: 40,
        hardness: 1.0,
        opacity: 1.0
      };

      this.shape = {
        type: 'rect', // 'rect' | 'rounded_rect' | 'ellipse' | 'polygon' | 'star' | 'line'
        fill: '#f97316',
        stroke: '#ffffff',
        strokeWidth: 2,
        radius: 12,
        sides: 5
      };

      this.text = {
        fontFamily: 'Inter',
        fontSize: 48,
        fill: '#ffffff',
        bold: false,
        italic: false,
        align: 'left'
      };

      this.cloneSource = null; // { x, y }
      this.selectionMask = null; // Uint8Array or Canvas of marching ants
      this.selectionBounds = null; // { x, y, w, h }
      this.isInteracting = false;
      this.lastPoint = null;
    }

    setTool(toolName) {
      this.activeTool = toolName;
      this.editor.updateOptionsBar(toolName);
      this.editor.updateCursor();
    }

    // ------------------------------------------------------------------------
    // POINTER & TOUCH EVENT HANDLERS
    // ------------------------------------------------------------------------
    onPointerDown(e, pt) {
      this.isInteracting = true;
      this.lastPoint = pt;
      const doc = this.editor.document;
      const layer = doc.getActiveLayer();
      if (!layer || layer.locked) return;

      switch (this.activeTool) {
        case 'brush':
        case 'pencil':
          this.drawBrushDab(layer.ctx, pt, e.pressure || 0.5);
          break;
        case 'eraser':
          this.eraseDab(layer.ctx, pt);
          break;
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
        case 'eyedropper':
          this.sampleColor(doc, pt);
          break;
        case 'bucket':
          this.floodFill(layer.ctx, pt.x, pt.y, this.editor.fgColor);
          break;
        case 'text':
          this.promptTextPlacement(doc, pt);
          break;
        case 'heal':
          this.spotHealDab(layer.ctx, pt);
          break;
        case 'marquee_rect':
        case 'marquee_ellipse':
        case 'lasso':
          this.startSelection(pt);
          break;
        case 'shape':
          this.startShapeDraw(pt);
          break;
        case 'crop':
          this.startCropDrag(pt);
          break;
      }

      this.editor.render();
    }

    onPointerMove(e, pt) {
      if (!this.isInteracting) return;
      const doc = this.editor.document;
      const layer = doc.getActiveLayer();
      if (!layer || layer.locked) return;

      switch (this.activeTool) {
        case 'brush':
        case 'pencil':
          this.drawBrushStroke(layer.ctx, this.lastPoint, pt, e.pressure || 0.5);
          break;
        case 'eraser':
          this.eraseStroke(layer.ctx, this.lastPoint, pt);
          break;
        case 'clone':
          if (this.cloneSource && !e.altKey) {
            this.drawCloneStroke(layer.ctx, this.lastPoint, pt);
          }
          break;
        case 'move':
          layer.x += (pt.x - this.lastPoint.x);
          layer.y += (pt.y - this.lastPoint.y);
          break;
        case 'marquee_rect':
        case 'marquee_ellipse':
        case 'shape':
          this.previewDragBox(this.lastPoint, pt);
          return; // Do not update lastPoint for drag-boxes
      }

      this.lastPoint = pt;
      this.editor.render();
    }

    onPointerUp(e, pt) {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      const doc = this.editor.document;
      const layer = doc.getActiveLayer();

      if (layer && !layer.locked) {
        if (this.activeTool === 'shape' && this.lastPoint) {
          this.commitShape(layer.ctx, this.lastPoint, pt);
        } else if (this.activeTool === 'marquee_rect' || this.activeTool === 'marquee_ellipse') {
          this.commitSelection(this.lastPoint, pt);
        }
      }

      this.editor.history.pushState(this.getToolActionName(), doc);
      this.editor.render();
      this.editor.updateLayersUI();
    }

    // ------------------------------------------------------------------------
    // BRUSH ENGINE & PARAMETRIC DABS
    // ------------------------------------------------------------------------
    drawBrushDab(ctx, pt, pressure) {
      const radius = Math.max(1, (this.brush.size / 2) * (0.4 + pressure * 0.6));
      ctx.save();
      ctx.globalAlpha = this.brush.opacity * this.brush.flow;

      if (this.brush.hardness >= 0.95 || this.activeTool === 'pencil') {
        ctx.fillStyle = this.editor.fgColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(pt.x, pt.y, radius * this.brush.hardness, pt.x, pt.y, radius);
        grad.addColorStop(0, this.editor.fgColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBrushStroke(ctx, p1, p2, pressure) {
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const step = Math.max(1, this.brush.size * 0.15);
      const steps = Math.ceil(dist / step);

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        this.drawBrushDab(ctx, { x, y }, pressure);
      }
    }

    // ------------------------------------------------------------------------
    // ERASER TOOLS
    // ------------------------------------------------------------------------
    eraseDab(ctx, pt) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = this.eraser.opacity;
      const radius = this.eraser.size / 2;
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

    // ------------------------------------------------------------------------
    // CLONE STAMP & RETOUCHING
    // ------------------------------------------------------------------------
    drawCloneDab(ctx, pt) {
      if (!this.cloneSource) return;
      const radius = this.brush.size / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        this.editor.document.compositeCanvas,
        this.cloneSource.x - radius, this.cloneSource.y - radius, radius * 2, radius * 2,
        pt.x - radius, pt.y - radius, radius * 2, radius * 2
      );
      ctx.restore();
    }

    drawCloneStroke(ctx, p1, p2) {
      this.drawCloneDab(ctx, p2);
      // Advance clone offset synchronously
      this.cloneSource.x += (p2.x - p1.x);
      this.cloneSource.y += (p2.y - p1.y);
    }

    // Spot Healing (Gaussian Neighbor Smoothing & Contrast Harmonization)
    spotHealDab(ctx, pt) {
      const r = Math.round(this.brush.size / 2);
      const x0 = Math.max(0, Math.round(pt.x - r));
      const y0 = Math.max(0, Math.round(pt.y - r));
      const w = Math.min(ctx.canvas.width - x0, r * 2);
      const h = Math.min(ctx.canvas.height - y0, r * 2);
      if (w <= 0 || h <= 0) return;

      const imgData = ctx.getImageData(x0, y0, w, h);
      const d = imgData.data;

      // Blur outer ring inward to heal blemishes
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const distFromCenter = Math.hypot(x - r, y - r);
          if (distFromCenter < r * 0.8) {
            const idx = (y * w + x) * 4;
            // Average 4-connected neighbors
            for (let c = 0; c < 3; c++) {
              d[idx + c] = Math.round(
                (d[((y - 1) * w + x) * 4 + c] +
                 d[((y + 1) * w + x) * 4 + c] +
                 d[(y * w + (x - 1)) * 4 + c] +
                 d[(y * w + (x + 1)) * 4 + c]) / 4
              );
            }
          }
        }
      }
      ctx.putImageData(imgData, x0, y0);
    }

    // ------------------------------------------------------------------------
    // VECTOR & SHAPE GENERATION
    // ------------------------------------------------------------------------
    startShapeDraw(pt) {
      // preview shape will be drawn on overlay canvas
    }

    previewDragBox(p1, p2) {
      const overlayCtx = this.editor.overlayCtx;
      overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
      overlayCtx.save();
      overlayCtx.strokeStyle = '#f97316';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.setLineDash([4, 4]);

      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);

      if (this.activeTool === 'marquee_ellipse' || (this.activeTool === 'shape' && this.shape.type === 'ellipse')) {
        overlayCtx.beginPath();
        overlayCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        overlayCtx.stroke();
      } else {
        overlayCtx.strokeRect(x, y, w, h);
      }
      overlayCtx.restore();
    }

    commitShape(ctx, p1, p2) {
      this.editor.overlayCtx.clearRect(0, 0, this.editor.overlayCanvas.width, this.editor.overlayCanvas.height);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      if (w < 2 || h < 2) return;

      ctx.save();
      ctx.fillStyle = this.shape.fill;
      ctx.strokeStyle = this.shape.stroke;
      ctx.lineWidth = this.shape.strokeWidth;

      if (this.shape.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (this.shape.strokeWidth > 0) ctx.stroke();
      } else if (this.shape.type === 'rounded_rect') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, this.shape.radius);
        ctx.fill();
        if (this.shape.strokeWidth > 0) ctx.stroke();
      } else {
        ctx.fillRect(x, y, w, h);
        if (this.shape.strokeWidth > 0) ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // SELECTION ENGINE (MARCHING ANTS)
    // ------------------------------------------------------------------------
    startSelection(pt) {
      this.selectionBounds = { x: pt.x, y: pt.y, w: 0, h: 0 };
    }

    commitSelection(p1, p2) {
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      if (w > 2 && h > 2) {
        this.selectionBounds = { x, y, w, h, type: this.activeTool };
        this.renderMarchingAnts();
      } else {
        this.clearSelection();
      }
    }

    clearSelection() {
      this.selectionBounds = null;
      this.editor.overlayCtx.clearRect(0, 0, this.editor.overlayCanvas.width, this.editor.overlayCanvas.height);
    }

    renderMarchingAnts() {
      if (!this.selectionBounds) return;
      const ctx = this.editor.overlayCtx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.save();
      const sb = this.selectionBounds;

      // Draw two passes (white base + black dashed on top for universal visibility)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      if (sb.type === 'marquee_ellipse') {
        ctx.beginPath();
        ctx.ellipse(sb.x + sb.w / 2, sb.y + sb.h / 2, sb.w / 2, sb.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
      }

      ctx.strokeStyle = '#000000';
      ctx.setLineDash([4, 4]);
      if (sb.type === 'marquee_ellipse') {
        ctx.beginPath();
        ctx.ellipse(sb.x + sb.w / 2, sb.y + sb.h / 2, sb.w / 2, sb.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // COLOR SAMPLING & BUCKET FILL
    // ------------------------------------------------------------------------
    sampleColor(doc, pt) {
      const ctx = doc.compositeCanvas.getContext('2d');
      const pixel = ctx.getImageData(Math.round(pt.x), Math.round(pt.y), 1, 1).data;
      const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      this.editor.setColor(hex);
      this.editor.toast(`Color Sampled: ${hex.toUpperCase()}`);
    }

    floodFill(ctx, startX, startY, fillHex) {
      const x = Math.round(startX);
      const y = Math.round(startY);
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      if (x < 0 || x >= w || y < 0 || y >= h) return;

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const targetIdx = (y * w + x) * 4;
      const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2], ta = data[targetIdx + 3];

      // Parse fill hex to RGBA
      const fr = parseInt(fillHex.slice(1, 3), 16);
      const fg = parseInt(fillHex.slice(3, 5), 16);
      const fb = parseInt(fillHex.slice(5, 7), 16);
      if (tr === fr && tg === fg && tb === fb && ta === 255) return;

      const queue = [[x, y]];
      const visited = new Uint8Array(w * h);

      while (queue.length) {
        const [cx, cy] = queue.pop();
        const pos = cy * w + cx;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const idx = pos * 4;
        const dr = Math.abs(data[idx] - tr);
        const dg = Math.abs(data[idx + 1] - tg);
        const db = Math.abs(data[idx + 2] - tb);

        if (dr + dg + db < 30) {
          data[idx] = fr;
          data[idx + 1] = fg;
          data[idx + 2] = fb;
          data[idx + 3] = 255;

          if (cx > 0) queue.push([cx - 1, cy]);
          if (cx < w - 1) queue.push([cx + 1, cy]);
          if (cy > 0) queue.push([cx, cy - 1]);
          if (cy < h - 1) queue.push([cx, cy + 1]);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // ------------------------------------------------------------------------
    // TEXT PLACEMENT
    // ------------------------------------------------------------------------
    promptTextPlacement(doc, pt) {
      const text = prompt('Enter layer text:', 'PixNivo Creative Studio');
      if (!text) return;

      const textLayer = new P.Layer('Text Layer: ' + text.slice(0, 10), doc.width, doc.height, 'text');
      textLayer.ctx.font = `${this.text.bold ? 'bold ' : ''}${this.text.fontSize}px ${this.text.fontFamily}`;
      textLayer.ctx.fillStyle = this.editor.fgColor;
      textLayer.ctx.fillText(text, pt.x, pt.y);
      doc.addLayer(textLayer);
    }

    getToolActionName() {
      const names = {
        brush: 'Brush Stroke',
        pencil: 'Pencil Stroke',
        eraser: 'Eraser',
        move: 'Move Layer',
        clone: 'Clone Stamp',
        heal: 'Spot Healing',
        shape: 'Draw Shape',
        bucket: 'Paint Bucket',
        text: 'Add Text'
      };
      return names[this.activeTool] || 'Edit';
    }
  }

  // Attach to PixNivoStudio
  window.PixnivoStudio.ToolManager = ToolManager;

})(window);
