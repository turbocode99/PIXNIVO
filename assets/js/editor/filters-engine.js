/**
 * PIXNIVO PHOTO STUDIO PRO — FILTERS & ADJUSTMENTS ENGINE
 * 100% Client-side non-destructive color grading, convolution filters, and distortions
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  const Filters = {
    // ------------------------------------------------------------------------
    // 1. ADJUSTMENTS (BRIGHTNESS, CONTRAST, HUE, SATURATION, EXPOSURE)
    // ------------------------------------------------------------------------
    brightnessContrast(ctx, brightness = 0, contrast = 0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const bFactor = brightness * 255;
      const cFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < d.length; i += 4) {
        // Brightness
        let r = d[i] + bFactor;
        let g = d[i + 1] + bFactor;
        let b = d[i + 2] + bFactor;

        // Contrast
        d[i] = Math.max(0, Math.min(255, cFactor * (r - 128) + 128));
        d[i + 1] = Math.max(0, Math.min(255, cFactor * (g - 128) + 128));
        d[i + 2] = Math.max(0, Math.min(255, cFactor * (b - 128) + 128));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    hueSaturation(ctx, hueDeg = 0, saturation = 0, lightness = 0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const hDelta = hueDeg / 360;

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
          h = s = 0;
        } else {
          let diff = max - min;
          s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
          switch (max) {
            case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
            case g: h = (b - r) / diff + 2; break;
            case b: h = (r - g) / diff + 4; break;
          }
          h /= 6;
        }

        // Apply shifts
        h = (h + hDelta) % 1;
        if (h < 0) h += 1;
        s = Math.max(0, Math.min(1, s + saturation));
        l = Math.max(0, Math.min(1, l + lightness));

        // Convert HSL back to RGB
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };

        if (s === 0) {
          r = g = b = l;
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }

        d[i] = Math.round(r * 255);
        d[i + 1] = Math.round(g * 255);
        d[i + 2] = Math.round(b * 255);
      }
      ctx.putImageData(imgData, 0, 0);
    },

    blackAndWhite(ctx) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // High-precision Rec.709 Luma
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = luma;
      }
      ctx.putImageData(imgData, 0, 0);
    },

    invert(ctx) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(imgData, 0, 0);
    },

    threshold(ctx, level = 128) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = gray >= level ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    },

    // ------------------------------------------------------------------------
    // 2. CONVOLUTION FILTERS (BLUR, SHARPEN, EMBOSS, OIL PAINT)
    // ------------------------------------------------------------------------
    applyKernel(ctx, kernel, divisor = 1, bias = 0) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const dd = dst.data;
      const kSize = Math.sqrt(kernel.length);
      const half = Math.floor(kSize / 2);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0;
          for (let ky = 0; ky < kSize; ky++) {
            for (let kx = 0; kx < kSize; kx++) {
              const px = Math.min(w - 1, Math.max(0, x + kx - half));
              const py = Math.min(h - 1, Math.max(0, y + ky - half));
              const idx = (py * w + px) * 4;
              const weight = kernel[ky * kSize + kx];
              r += sd[idx] * weight;
              g += sd[idx + 1] * weight;
              b += sd[idx + 2] * weight;
            }
          }
          const dIdx = (y * w + x) * 4;
          dd[dIdx] = Math.max(0, Math.min(255, (r / divisor) + bias));
          dd[dIdx + 1] = Math.max(0, Math.min(255, (g / divisor) + bias));
          dd[dIdx + 2] = Math.max(0, Math.min(255, (b / divisor) + bias));
          dd[dIdx + 3] = sd[dIdx + 3]; // Preserve alpha
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    gaussianBlur(ctx, radius = 4) {
      // Fast two-pass box blur approximation of Gaussian
      ctx.save();
      ctx.filter = `blur(${radius}px)`;
      const tmp = document.createElement('canvas');
      tmp.width = ctx.canvas.width;
      tmp.height = ctx.canvas.height;
      tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    },

    sharpen(ctx) {
      // 3x3 high-pass unsharp mask kernel
      const kernel = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
      ];
      this.applyKernel(ctx, kernel, 1, 0);
    },

    emboss(ctx) {
      const kernel = [
        -2, -1,  0,
        -1,  1,  1,
         0,  1,  2
      ];
      this.applyKernel(ctx, kernel, 1, 128);
    },

    addNoise(ctx, amount = 25) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const rand = (Math.random() - 0.5) * amount * 2;
        d[i] = Math.max(0, Math.min(255, d[i] + rand));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + rand));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + rand));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    oilPaint(ctx, radius = 3, intensityLevels = 20) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const dd = dst.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const intensityCount = new Uint16Array(intensityLevels);
          const avgR = new Uint32Array(intensityLevels);
          const avgG = new Uint32Array(intensityLevels);
          const avgB = new Uint32Array(intensityLevels);

          for (let ry = -radius; ry <= radius; ry++) {
            for (let rx = -radius; rx <= radius; rx++) {
              const py = Math.min(h - 1, Math.max(0, y + ry));
              const px = Math.min(w - 1, Math.max(0, x + rx));
              const idx = (py * w + px) * 4;
              const r = sd[idx], g = sd[idx + 1], b = sd[idx + 2];
              const curIntensity = Math.floor((((r + g + b) / 3) * intensityLevels) / 256);

              intensityCount[curIntensity]++;
              avgR[curIntensity] += r;
              avgG[curIntensity] += g;
              avgB[curIntensity] += b;
            }
          }

          let maxCount = 0;
          let maxIndex = 0;
          for (let i = 0; i < intensityLevels; i++) {
            if (intensityCount[i] > maxCount) {
              maxCount = intensityCount[i];
              maxIndex = i;
            }
          }

          const dIdx = (y * w + x) * 4;
          dd[dIdx] = avgR[maxIndex] / maxCount;
          dd[dIdx + 1] = avgG[maxIndex] / maxCount;
          dd[dIdx + 2] = avgB[maxIndex] / maxCount;
          dd[dIdx + 3] = sd[dIdx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    }
  };

  window.PixnivoStudio.Filters = Filters;

})(window);

