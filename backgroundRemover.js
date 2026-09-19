/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — BACKGROUND REMOVAL PIPELINE
 * Module: Phase 3 (Background Removal & Transparency Engine)
 * ==============================================================================
 * Isolates foreground logo marks from solid, gradient, or studio cyclorama backdrops
 * to yield pristine, anti-aliased transparent PNG assets ready for canvas insertion.
 *
 * Engines:
 * 1. AI Segmentation: RMBG-2.0 / BiRefNet / RMBG-1.4 via @xenova/transformers
 * 2. Precision Color-Distance & Edge-Feathering: Zero-dependency canvas engine
 *    with corner sampling, de-spill, and anti-aliased alpha thresholding.
 */

/**
 * Loads an image from a URL, data URL, Blob, or Image element.
 * @param {string|Blob|HTMLImageElement|HTMLCanvasElement} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      return reject(new Error('Invalid image source provided to loadImage'));
    }

    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      if (source.complete && source.naturalWidth > 0) return resolve(source);
      source.onload = () => resolve(source);
      source.onerror = (err) => reject(new Error('Failed to load HTMLImageElement: ' + err));
      return;
    }

    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Failed to load canvas data: ' + err));
      img.src = source.toDataURL('image/png');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image from source: ' + (err.message || 'Network error')));

    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else if (typeof source === 'string') {
      img.src = source;
    } else {
      reject(new Error('Unsupported image source type'));
    }
  });
}

/**
 * Converts a Canvas to a Blob with Promise support.
 * @param {HTMLCanvasElement} canvas
 * @param {string} [type='image/png']
 * @param {number} [quality=1.0]
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, type = 'image/png', quality = 1.0) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      }, type, quality);
    } else {
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const bin = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type }));
      } catch (err) {
        reject(err);
      }
    }
  });
}

/**
 * Calculates Euclidean color distance between two RGB triplets.
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Weighted RGB distance (approximating human visual sensitivity)
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * Feathered Color-Distance Background Removal Engine.
 * Analyzes boundary corners, computes background baseline color,
 * and generates a feathered transparent alpha channel with de-spill.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {Object} [options={}]
 * @param {number} [options.threshold=38] - Distance threshold for background removal
 * @param {number} [options.feather=24] - Soft transition band width
 * @param {boolean} [options.despill=true] - Suppress background color halo on edge pixels
 * @returns {HTMLCanvasElement} Transparent canvas
 */
export function removeBackgroundCanvasEngine(img, options = {}) {
  const {
    threshold = 38,
    feather = 24,
    despill = true
  } = options;

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.drawImage(img, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample corner patches (5x5 pixels) to estimate background color
  const samplePoints = [
    { x: 2, y: 2 },
    { x: width - 3, y: 2 },
    { x: 2, y: height - 3 },
    { x: width - 3, y: height - 3 }
  ];

  let bgR = 0, bgG = 0, bgB = 0, sampleCount = 0;
  samplePoints.forEach(({ x, y }) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.max(0, Math.min(width - 1, x + dx));
        const py = Math.max(0, Math.min(height - 1, y + dy));
        const idx = (py * width + px) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        sampleCount++;
      }
    }
  });

  bgR = Math.round(bgR / sampleCount);
  bgG = Math.round(bgG / sampleCount);
  bgB = Math.round(bgB / sampleCount);

  const innerThreshold = threshold;
  const outerThreshold = threshold + feather;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const dist = colorDistance(r, g, b, bgR, bgG, bgB);

    if (dist <= innerThreshold) {
      // Definite background
      data[i + 3] = 0;
    } else if (dist < outerThreshold) {
      // Soft feathered transition edge
      const factor = (dist - innerThreshold) / feather;
      // Smooth Hermite interpolation (smoothstep)
      const smoothAlpha = factor * factor * (3 - 2 * factor);
      data[i + 3] = Math.round(a * smoothAlpha);

      // De-spill: reduce background color tint on semi-transparent edges
      if (despill) {
        data[i] = Math.round(r + (r - bgR) * (1 - smoothAlpha) * 0.4);
        data[i + 1] = Math.round(g + (g - bgG) * (1 - smoothAlpha) * 0.4);
        data[i + 2] = Math.round(b + (b - bgB) * (1 - smoothAlpha) * 0.4);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * AI RMBG Model Engine (Browser ONNX via @xenova/transformers).
 * Checks for window.rmbgPipe or loads on demand.
 */
let rmbgInstance = null;

async function runAIBgRemoval(img, onProgress) {
  if (typeof window === 'undefined') {
    throw new Error('AI RMBG requires a browser environment');
  }

  // Check if Pixnivo's global RMBG pipeline is already initialized
  if (window.rmbgPipe) {
    rmbgInstance = window.rmbgPipe;
  }

  if (!rmbgInstance) {
    if (onProgress) onProgress({ stage: 'loading_model', progress: 0.2 });
    const tf = window.transformers || await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    tf.env.allowLocalModels = false;

    const models = [
      { id: 'briaai/RMBG-1.4', device: 'wasm', dtype: 'q8' },
      { id: 'onnx-community/BiRefNet_lite-ONNX', device: 'wasm', dtype: 'q8' }
    ];

    let lastError = null;
    for (const m of models) {
      try {
        rmbgInstance = await tf.pipeline('image-segmentation', m.id, {
          device: m.device,
          dtype: m.dtype
        });
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!rmbgInstance) {
      throw lastError || new Error('Failed to load RMBG AI model');
    }
  }

  if (onProgress) onProgress({ stage: 'inferring_mask', progress: 0.6 });

  // Prepare square canvas to prevent distortion
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const maxDim = Math.max(width, height);
  const sqCanvas = document.createElement('canvas');
  sqCanvas.width = maxDim;
  sqCanvas.height = maxDim;
  const sqCtx = sqCanvas.getContext('2d');
  sqCtx.fillStyle = '#000000';
  sqCtx.fillRect(0, 0, maxDim, maxDim);

  const offsetX = Math.round((maxDim - width) / 2);
  const offsetY = Math.round((maxDim - height) / 2);
  sqCtx.drawImage(img, offsetX, offsetY, width, height);

  const tf = window.transformers || (await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'));
  const raw = await tf.RawImage.fromCanvas(sqCanvas);
  const result = await rmbgInstance(raw);
  const mask = await result[0].mask.resize(maxDim, maxDim);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const octx = outCanvas.getContext('2d');
  octx.drawImage(img, 0, 0);

  const imgData = octx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const m = mask.data;
  const channels = Math.round(m.length / (maxDim * maxDim));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sqX = offsetX + x;
      const sqY = offsetY + y;
      const pOrig = (y * width + x) * 4;
      const pMask = (sqY * maxDim + sqX) * channels;
      d[pOrig + 3] = m[pMask];
    }
  }

  octx.putImageData(imgData, 0, 0);
  return outCanvas;
}

/**
 * Universal Background Removal Pipeline.
 * Attempts AI RMBG first; seamlessly falls back to high-precision
 * color-distance edge-feathering engine on failure or offline conditions.
 *
 * @param {string|Blob|HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {Object} [options={}]
 * @param {string} [options.engine='auto'] - 'auto' | 'rmbg' | 'canvas'
 * @param {number} [options.threshold=38]
 * @param {number} [options.feather=24]
 * @param {Function} [options.onProgress]
 * @returns {Promise<Object>} Output object containing canvas, dataUrl, blob, and telemetry
 */
export async function removeBackground(imageSource, options = {}) {
  const startTime = Date.now();
  const {
    engine = 'auto',
    threshold = 38,
    feather = 24,
    onProgress = null
  } = options;

  const img = await loadImage(imageSource);
  let finalCanvas = null;
  let usedEngine = 'canvas';

  if (engine === 'rmbg' || engine === 'auto') {
    try {
      finalCanvas = await runAIBgRemoval(img, onProgress);
      usedEngine = 'rmbg';
    } catch (aiError) {
      if (engine === 'rmbg') {
        throw new Error(`RMBG model execution failed: ${aiError.message}`);
      }
      console.warn('[PIXNIVO BG-REMOVAL] AI model unavailable, engaging precision canvas feathering:', aiError.message);
    }
  }

  // Fallback to high-precision canvas engine
  if (!finalCanvas) {
    if (onProgress) onProgress({ stage: 'canvas_feathering', progress: 0.8 });
    finalCanvas = removeBackgroundCanvasEngine(img, { threshold, feather });
    usedEngine = 'canvas_feather';
  }

  if (onProgress) onProgress({ stage: 'encoding_output', progress: 0.95 });

  const dataUrl = finalCanvas.toDataURL('image/png');
  const blob = await canvasToBlob(finalCanvas, 'image/png');
  const durationMs = Date.now() - startTime;

  return {
    success: true,
    canvas: finalCanvas,
    dataUrl,
    blob,
    width: finalCanvas.width,
    height: finalCanvas.height,
    engineUsed: usedEngine,
    durationMs
  };
}

// Browser global attachment
if (typeof window !== 'undefined') {
  window.PixnivoBackgroundRemover = {
    loadImage,
    canvasToBlob,
    removeBackgroundCanvasEngine,
    removeBackground
  };
}
