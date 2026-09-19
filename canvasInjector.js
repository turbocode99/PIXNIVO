/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — CANVAS INJECTOR
 * Module: Phase 3 (Canvas Asset Placement & Rendering Engine)
 * ==============================================================================
 * Seamlessly places transparent PNG logo assets onto HTML5 Canvas or Fabric.js
 * artboards with high-DPI awareness, aspect ratio retention, and layout modes.
 */

import { loadImage } from './backgroundRemover.js';

/**
 * Calculates optimal scale and centered coordinates to draw an asset onto a canvas.
 *
 * @param {number} canvasWidth - Width of destination canvas.
 * @param {number} canvasHeight - Height of destination canvas.
 * @param {number} imgWidth - Natural width of source image.
 * @param {number} imgHeight - Natural height of source image.
 * @param {Object} [options={}]
 * @param {string} [options.fit='contain'] - 'contain' | 'cover' | 'original' | 'custom'
 * @param {number} [options.padding=0.15] - Margin as a percentage of canvas dimensions (0 to 0.4)
 * @param {number} [options.x] - Custom x coordinate (if fit === 'custom')
 * @param {number} [options.y] - Custom y coordinate (if fit === 'custom')
 * @param {number} [options.width] - Custom width (if fit === 'custom')
 * @param {number} [options.height] - Custom height (if fit === 'custom')
 * @returns {Object} { x, y, width, height, scale }
 */
export function calculateCanvasPlacement(canvasWidth, canvasHeight, imgWidth, imgHeight, options = {}) {
  const {
    fit = 'contain',
    padding = 0.15,
    x,
    y,
    width,
    height
  } = options;

  if (fit === 'custom' && x !== undefined && y !== undefined && width && height) {
    return { x, y, width, height, scale: width / imgWidth };
  }

  const availWidth = canvasWidth * (1 - padding * 2);
  const availHeight = canvasHeight * (1 - padding * 2);
  const imgAspect = imgWidth / imgHeight;
  const canvasAspect = availWidth / availHeight;

  let drawW, drawH;

  if (fit === 'original') {
    drawW = Math.min(imgWidth, availWidth);
    drawH = drawW / imgAspect;
  } else if (fit === 'cover') {
    if (imgAspect > canvasAspect) {
      drawH = canvasHeight;
      drawW = drawH * imgAspect;
    } else {
      drawW = canvasWidth;
      drawH = drawW / imgAspect;
    }
  } else {
    // 'contain' (default for logo placement)
    if (imgAspect > canvasAspect) {
      drawW = availWidth;
      drawH = drawW / imgAspect;
    } else {
      drawH = availHeight;
      drawW = drawH * imgAspect;
    }
  }

  const drawX = Math.round((canvasWidth - drawW) / 2);
  const drawY = Math.round((canvasHeight - drawH) / 2);

  return {
    x: drawX,
    y: drawY,
    width: Math.round(drawW),
    height: Math.round(drawH),
    scale: drawW / imgWidth
  };
}

/**
 * Draws a subtle checkered transparency grid onto a 2D canvas context.
 */
export function drawCheckerboard(ctx, width, height, size = 16, color1 = '#120e20', color2 = '#1a152c') {
  ctx.save();
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? color1 : color2;
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.restore();
}

/**
 * Injects a transparent PNG image onto an HTML5 Canvas element.
 *
 * @param {HTMLCanvasElement} canvas - The target canvas element.
 * @param {string|Blob|HTMLImageElement|HTMLCanvasElement} imageSource - The transparent PNG asset.
 * @param {Object} [options={}]
 * @param {string} [options.fit='contain'] - Placement fit ('contain' | 'cover' | 'original' | 'custom')
 * @param {number} [options.padding=0.15] - Margin padding percentage
 * @param {boolean} [options.clearCanvas=true] - Clear prior artwork
 * @param {boolean} [options.showCheckerboard=false] - Render transparency grid under logo
 * @param {boolean} [options.shadow=false] - Add soft subtle ambient drop shadow
 * @param {Object} [options.shadowConfig] - { color: 'rgba(0,0,0,0.3)', blur: 24, offsetY: 8 }
 * @returns {Promise<Object>} Placement details and updated canvas reference
 */
export async function injectOntoCanvas(canvas, imageSource, options = {}) {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Target canvas element is required and must be an HTMLCanvasElement');
  }

  const {
    fit = 'contain',
    padding = 0.15,
    clearCanvas = true,
    showCheckerboard = false,
    shadow = false,
    shadowConfig = { color: 'rgba(0, 0, 0, 0.35)', blur: 20, offsetX: 0, offsetY: 8 }
  } = options;

  const img = await loadImage(imageSource);
  const ctx = canvas.getContext('2d');

  if (clearCanvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (showCheckerboard) {
    drawCheckerboard(ctx, canvas.width, canvas.height);
  }

  const placement = calculateCanvasPlacement(
    canvas.width,
    canvas.height,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    { fit, padding, ...options }
  );

  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadowConfig.color || 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = shadowConfig.blur || 20;
    ctx.shadowOffsetX = shadowConfig.offsetX || 0;
    ctx.shadowOffsetY = shadowConfig.offsetY || 8;
  }

  // Draw image onto canvas
  ctx.drawImage(img, placement.x, placement.y, placement.width, placement.height);
  ctx.restore();

  const eventPayload = {
    canvas,
    image: img,
    placement,
    timestamp: Date.now()
  };

  // Dispatch custom event for application listeners (e.g. history undo/redo, layers stack)
  if (typeof window !== 'undefined') {
    const customEvent = new CustomEvent('pixnivo:logo-injected', {
      detail: eventPayload,
      bubbles: true
    });
    canvas.dispatchEvent(customEvent);
    window.dispatchEvent(customEvent);
  }

  return {
    success: true,
    canvas,
    placement,
    dimensions: {
      width: canvas.width,
      height: canvas.height,
      assetWidth: placement.width,
      assetHeight: placement.height
    }
  };
}

/**
 * Optional Fabric.js Canvas Bridge.
 * If the logo designer uses Fabric.js (`fabric.Canvas`), this helper
 * creates a fabric.Image object, scales it, and adds it to the active canvas.
 *
 * @param {Object} fabricCanvas - fabric.Canvas instance
 * @param {string|Blob|HTMLCanvasElement} imageSource
 * @param {Object} [options={}]
 * @returns {Promise<Object>} The added Fabric.js Image object
 */
export async function injectOntoFabricCanvas(fabricCanvas, imageSource, options = {}) {
  if (!fabricCanvas || typeof fabricCanvas.add !== 'function') {
    throw new Error('Invalid Fabric.js canvas instance provided');
  }

  const img = await loadImage(imageSource);
  const dataUrl = img.src;

  return new Promise((resolve, reject) => {
    if (typeof fabric === 'undefined' && typeof window.fabric === 'undefined') {
      return reject(new Error('Fabric.js is not loaded in current scope'));
    }

    const fabricLib = typeof fabric !== 'undefined' ? fabric : window.fabric;

    fabricLib.Image.fromURL(dataUrl, (fabImg) => {
      if (!fabImg) return reject(new Error('Failed to create Fabric image'));

      const canvasWidth = fabricCanvas.getWidth();
      const canvasHeight = fabricCanvas.getHeight();

      const maxDim = Math.min(canvasWidth, canvasHeight) * 0.7;
      fabImg.scaleToWidth(maxDim);

      fabImg.set({
        left: (canvasWidth - fabImg.getScaledWidth()) / 2,
        top: (canvasHeight - fabImg.getScaledHeight()) / 2,
        cornerColor: '#ff7a1a',
        cornerStyle: 'circle',
        transparentCorners: false
      });

      fabricCanvas.add(fabImg);
      fabricCanvas.setActiveObject(fabImg);
      fabricCanvas.renderAll();

      resolve(fabImg);
    }, { crossOrigin: 'anonymous' });
  });
}

// Browser global attachment
if (typeof window !== 'undefined') {
  window.PixnivoCanvasInjector = {
    calculateCanvasPlacement,
    drawCheckerboard,
    injectOntoCanvas,
    injectOntoFabricCanvas
  };
}
