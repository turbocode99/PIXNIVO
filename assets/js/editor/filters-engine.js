/**
 * PIXNIVO PHOTO STUDIO PRO — FILTERS & ADJUSTMENTS ENGINE (ENTERPRISE EDITION)
 * 100% Client-Side Non-Destructive Adjustments, Convolution Kernels, & Distortion Gallery
 */

(function (window) {
  'use strict';

  const P = window.PixnivoStudio;
  if (!P) return;

  const Filters = {
    // ------------------------------------------------------------------------
    // 1. COMPLETE ADJUSTMENT SUITE
    // ------------------------------------------------------------------------

    brightnessContrast(ctx, brightness = 0, contrast = 0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const bFactor = brightness * 255;
      const cFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] + bFactor;
        let g = d[i + 1] + bFactor;
        let b = d[i + 2] + bFactor;

        d[i] = Math.max(0, Math.min(255, cFactor * (r - 128) + 128));
        d[i + 1] = Math.max(0, Math.min(255, cFactor * (g - 128) + 128));
        d[i + 2] = Math.max(0, Math.min(255, cFactor * (b - 128) + 128));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    levels(ctx, inLow = 0, inHigh = 255, gamma = 1.0, outLow = 0, outHigh = 255) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const inRange = Math.max(1, inHigh - inLow);
      const outRange = outHigh - outLow;
      const invGamma = 1.0 / Math.max(0.1, gamma);

      // Precalculate 256-entry LUT for optimal performance
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        let normalized = Math.max(0, Math.min(1, (i - inLow) / inRange));
        let adjusted = Math.pow(normalized, invGamma);
        lut[i] = Math.round(outLow + adjusted * outRange);
      }

      for (let i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      ctx.putImageData(imgData, 0, 0);
    },

    curves(ctx, points = [[0, 0], [128, 128], [255, 255]]) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      // Interpolate spline / piecewise linear curve LUT
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        // Linear piecewise interpolation across sorted control points
        let val = i;
        for (let p = 0; p < points.length - 1; p++) {
          const [x0, y0] = points[p];
          const [x1, y1] = points[p + 1];
          if (i >= x0 && i <= x1) {
            const t = (i - x0) / Math.max(1, x1 - x0);
            val = y0 + t * (y1 - y0);
            break;
          }
        }
        lut[i] = Math.max(0, Math.min(255, Math.round(val)));
      }

      for (let i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      ctx.putImageData(imgData, 0, 0);
    },

    exposure(ctx, exposureVal = 0, offset = 0, gamma = 1.0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const mult = Math.pow(2, exposureVal);
      const invGamma = 1.0 / Math.max(0.1, gamma);

      for (let i = 0; i < d.length; i += 4) {
        let r = Math.pow(Math.max(0, (d[i] / 255) * mult + offset), invGamma) * 255;
        let g = Math.pow(Math.max(0, (d[i + 1] / 255) * mult + offset), invGamma) * 255;
        let b = Math.pow(Math.max(0, (d[i + 2] / 255) * mult + offset), invGamma) * 255;
        d[i] = Math.min(255, Math.round(r));
        d[i + 1] = Math.min(255, Math.round(g));
        d[i + 2] = Math.min(255, Math.round(b));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    vibrance(ctx, vibrance = 0.3, saturation = 0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        let max = Math.max(r, g, b);
        let avg = (r + g + b) / 3;
        let amt = ((Math.abs(max - avg) * 2 / 255) * -vibrance);
        
        if (vibrance !== 0) {
          r += (max - r) * amt;
          g += (max - g) * amt;
          b += (max - b) * amt;
        }

        if (saturation !== 0) {
          r = avg + (r - avg) * (1 + saturation);
          g = avg + (g - avg) * (1 + saturation);
          b = avg + (b - avg) * (1 + saturation);
        }

        d[i] = Math.max(0, Math.min(255, Math.round(r)));
        d[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
        d[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
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

        h = (h + hDelta) % 1;
        if (h < 0) h += 1;
        s = Math.max(0, Math.min(1, s + saturation));
        l = Math.max(0, Math.min(1, l + lightness));

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

    colorBalance(ctx, cyanRed = 10, magentaGreen = 0, yellowBlue = -10) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.max(0, Math.min(255, d[i] + cyanRed));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + magentaGreen));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + yellowBlue));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    blackAndWhite(ctx) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = luma;
      }
      ctx.putImageData(imgData, 0, 0);
    },

    photoFilter(ctx, filterColor = '#f59e0b', density = 0.25) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      const fr = parseInt(filterColor.slice(1, 3), 16) || 245;
      const fg = parseInt(filterColor.slice(3, 5), 16) || 158;
      const fb = parseInt(filterColor.slice(5, 7), 16) || 11;

      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] * (1 - density) + fr * density);
        d[i + 1] = Math.round(d[i + 1] * (1 - density) + fg * density);
        d[i + 2] = Math.round(d[i + 2] * (1 - density) + fb * density);
      }
      ctx.putImageData(imgData, 0, 0);
    },

    channelMixer(ctx, matrix = { r: [1, 0, 0], g: [0, 1, 0], b: [0, 0, 1] }) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = Math.max(0, Math.min(255, Math.round(r * matrix.r[0] + g * matrix.r[1] + b * matrix.r[2])));
        d[i + 1] = Math.max(0, Math.min(255, Math.round(r * matrix.g[0] + g * matrix.g[1] + b * matrix.g[2])));
        d[i + 2] = Math.max(0, Math.min(255, Math.round(r * matrix.b[0] + g * matrix.b[1] + b * matrix.b[2])));
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
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const val = luma >= level ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    },

    selectiveColor(ctx, target = 'reds', c = 0, m = 0, y = 0, k = 0) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let weight = 0;
        if (target === 'reds' && r > g && r > b) weight = (r - Math.max(g, b)) / 255;
        if (target === 'blues' && b > r && b > g) weight = (b - Math.max(r, g)) / 255;
        if (target === 'greens' && g > r && g > b) weight = (g - Math.max(r, b)) / 255;

        if (weight > 0) {
          d[i] = Math.max(0, Math.min(255, d[i] * (1 - (c + k) * weight)));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * (1 - (m + k) * weight)));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 - (y + k) * weight)));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    },

    gradientMap(ctx, stops = [{ pos: 0, color: '#1e293b' }, { pos: 1, color: '#f97316' }]) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      // Pre-render gradient to 256-pixel strip
      const gradCanvas = document.createElement('canvas');
      gradCanvas.width = 256;
      gradCanvas.height = 1;
      const gctx = gradCanvas.getContext('2d');
      const grad = gctx.createLinearGradient(0, 0, 256, 0);
      stops.forEach(s => grad.addColorStop(s.pos, s.color));
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 256, 1);
      const gradData = gctx.getImageData(0, 0, 256, 1).data;

      for (let i = 0; i < d.length; i += 4) {
        const luma = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
        const gIdx = luma * 4;
        d[i] = gradData[gIdx];
        d[i + 1] = gradData[gIdx + 1];
        d[i + 2] = gradData[gIdx + 2];
      }
      ctx.putImageData(imgData, 0, 0);
    },

    // ------------------------------------------------------------------------
    // 2. CONVOLUTION KERNEL ENGINE
    // ------------------------------------------------------------------------
    applyKernel(ctx, kernel, divisor = 1, bias = 0) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const dd = dst.data;
      const kSize = Math.sqrt(kernel.length);
      const halfK = Math.floor(kSize / 2);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0;
          for (let ky = 0; ky < kSize; ky++) {
            for (let kx = 0; kx < kSize; kx++) {
              const py = Math.min(h - 1, Math.max(0, y + ky - halfK));
              const px = Math.min(w - 1, Math.max(0, x + kx - halfK));
              const idx = (py * w + px) * 4;
              const weight = kernel[ky * kSize + kx];
              r += sd[idx] * weight;
              g += sd[idx + 1] * weight;
              b += sd[idx + 2] * weight;
            }
          }
          const dIdx = (y * w + x) * 4;
          dd[dIdx] = Math.max(0, Math.min(255, r / divisor + bias));
          dd[dIdx + 1] = Math.max(0, Math.min(255, g / divisor + bias));
          dd[dIdx + 2] = Math.max(0, Math.min(255, b / divisor + bias));
          dd[dIdx + 3] = sd[dIdx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    // ------------------------------------------------------------------------
    // 3. BLUR SUITE
    // ------------------------------------------------------------------------
    gaussianBlur(ctx, radius = 4) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const temp = ctx.createImageData(w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const td = temp.data;
      const dd = dst.data;

      // Separable 1D Gaussian kernel [1, 4, 6, 4, 1] normalized by 16 (Bitwise accelerated)
      // Pass 1: Horizontal Blur (sd -> td)
      for (let y = 0; y < h; y++) {
        const yOffset = y * w;
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - 2);
          const x1 = Math.max(0, x - 1);
          const x2 = x;
          const x3 = Math.min(w - 1, x + 1);
          const x4 = Math.min(w - 1, x + 2);

          const i0 = (yOffset + x0) * 4;
          const i1 = (yOffset + x1) * 4;
          const i2 = (yOffset + x2) * 4;
          const i3 = (yOffset + x3) * 4;
          const i4 = (yOffset + x4) * 4;

          const outIdx = (yOffset + x) * 4;
          td[outIdx] = (sd[i0] + (sd[i1] << 2) + sd[i2] * 6 + (sd[i3] << 2) + sd[i4]) >> 4;
          td[outIdx + 1] = (sd[i0 + 1] + (sd[i1 + 1] << 2) + sd[i2 + 1] * 6 + (sd[i3 + 1] << 2) + sd[i4 + 1]) >> 4;
          td[outIdx + 2] = (sd[i0 + 2] + (sd[i1 + 2] << 2) + sd[i2 + 2] * 6 + (sd[i3 + 2] << 2) + sd[i4 + 2]) >> 4;
          td[outIdx + 3] = sd[outIdx + 3];
        }
      }

      // Pass 2: Vertical Blur (td -> dd)
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - 2) * w;
        const y1 = Math.max(0, y - 1) * w;
        const y2 = y * w;
        const y3 = Math.min(h - 1, y + 1) * w;
        const y4 = Math.min(h - 1, y + 2) * w;

        for (let x = 0; x < w; x++) {
          const i0 = (y0 + x) * 4;
          const i1 = (y1 + x) * 4;
          const i2 = (y2 + x) * 4;
          const i3 = (y3 + x) * 4;
          const i4 = (y4 + x) * 4;

          const outIdx = (y2 + x) * 4;
          dd[outIdx] = (td[i0] + (td[i1] << 2) + td[i2] * 6 + (td[i3] << 2) + td[i4]) >> 4;
          dd[outIdx + 1] = (td[i0 + 1] + (td[i1 + 1] << 2) + td[i2 + 1] * 6 + (td[i3 + 1] << 2) + td[i4 + 1]) >> 4;
          dd[outIdx + 2] = (td[i0 + 2] + (td[i1 + 2] << 2) + td[i2 + 2] * 6 + (td[i3 + 2] << 2) + td[i4 + 2]) >> 4;
          dd[outIdx + 3] = td[outIdx + 3];
        }
      }

      ctx.putImageData(dst, 0, 0);
    },

    motionBlur(ctx, angle = 0, distance = 10) {
      const rad = (angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(rad) * distance);
      const dy = Math.round(Math.sin(rad) * distance);
      const steps = Math.max(2, Math.round(distance));
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (let s = 0; s < steps; s++) {
            const t = s / (steps - 1) - 0.5;
            const sx = Math.min(w - 1, Math.max(0, Math.round(x + t * dx)));
            const sy = Math.min(h - 1, Math.max(0, Math.round(y + t * dy)));
            const idx = (sy * w + sx) * 4;
            sumR += src.data[idx];
            sumG += src.data[idx + 1];
            sumB += src.data[idx + 2];
            sumA += src.data[idx + 3];
          }
          const dIdx = (y * w + x) * 4;
          dst.data[dIdx] = Math.round(sumR / steps);
          dst.data[dIdx + 1] = Math.round(sumG / steps);
          dst.data[dIdx + 2] = Math.round(sumB / steps);
          dst.data[dIdx + 3] = Math.round(sumA / steps);
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    radialBlur(ctx, amount = 10) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const samples = 10;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sumR = 0, sumG = 0, sumB = 0;
          for (let s = 0; s < samples; s++) {
            const scale = 1 - (s / samples) * (amount / 100);
            const sx = Math.min(w - 1, Math.max(0, Math.round(cx + (x - cx) * scale)));
            const sy = Math.min(h - 1, Math.max(0, Math.round(cy + (y - cy) * scale)));
            const idx = (sy * w + sx) * 4;
            sumR += src.data[idx];
            sumG += src.data[idx + 1];
            sumB += src.data[idx + 2];
          }
          const dIdx = (y * w + x) * 4;
          dst.data[dIdx] = Math.round(sumR / samples);
          dst.data[dIdx + 1] = Math.round(sumG / samples);
          dst.data[dIdx + 2] = Math.round(sumB / samples);
          dst.data[dIdx + 3] = src.data[dIdx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    lensBlur(ctx, radius = 5) {
      this.gaussianBlur(ctx, radius);
    },

    surfaceBlur(ctx, radius = 4, threshold = 20) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const dd = dst.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r0 = sd[idx], g0 = sd[idx + 1], b0 = sd[idx + 2];
          let sumR = 0, sumG = 0, sumB = 0, count = 0;

          for (let ry = -radius; ry <= radius; ry++) {
            for (let rx = -radius; rx <= radius; rx++) {
              const py = Math.min(h - 1, Math.max(0, y + ry));
              const px = Math.min(w - 1, Math.max(0, x + rx));
              const nIdx = (py * w + px) * 4;
              const diff = Math.abs(sd[nIdx] - r0) + Math.abs(sd[nIdx + 1] - g0) + Math.abs(sd[nIdx + 2] - b0);
              if (diff / 3 <= threshold) {
                sumR += sd[nIdx];
                sumG += sd[nIdx + 1];
                sumB += sd[nIdx + 2];
                count++;
              }
            }
          }
          dd[idx] = count ? Math.round(sumR / count) : r0;
          dd[idx + 1] = count ? Math.round(sumG / count) : g0;
          dd[idx + 2] = count ? Math.round(sumB / count) : b0;
          dd[idx + 3] = sd[idx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    // ------------------------------------------------------------------------
    // 4. SHARPEN & NOISE SUITE
    // ------------------------------------------------------------------------
    sharpen(ctx) {
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];
      this.applyKernel(ctx, kernel, 1);
    },

    smartSharpen(ctx, amount = 1.5) {
      const kernel = [
        -1, -1, -1,
        -1, 8 + amount, -1,
        -1, -1, -1
      ];
      this.applyKernel(ctx, kernel, amount);
    },

    unsharpMask(ctx, amount = 1.0) {
      this.smartSharpen(ctx, amount);
    },

    addNoise(ctx, amount = 25) {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * amount * 2;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);
    },

    reduceNoise(ctx) {
      // 3x3 Median Denoise
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);
      const sd = src.data;
      const dd = dst.data;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const valsR = [];
          const valsG = [];
          const valsB = [];
          for (let ry = -1; ry <= 1; ry++) {
            for (let rx = -1; rx <= 1; rx++) {
              const idx = ((y + ry) * w + (x + rx)) * 4;
              valsR.push(sd[idx]);
              valsG.push(sd[idx + 1]);
              valsB.push(sd[idx + 2]);
            }
          }
          valsR.sort((a, b) => a - b);
          valsG.sort((a, b) => a - b);
          valsB.sort((a, b) => a - b);
          const dIdx = (y * w + x) * 4;
          dd[dIdx] = valsR[4];
          dd[dIdx + 1] = valsG[4];
          dd[dIdx + 2] = valsB[4];
          dd[dIdx + 3] = sd[dIdx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    // ------------------------------------------------------------------------
    // 5. STYLIZE & DISTORTION SUITE
    // ------------------------------------------------------------------------
    emboss(ctx) {
      const kernel = [
        -2, -1, 0,
        -1, 1, 1,
        0, 1, 2
      ];
      this.applyKernel(ctx, kernel, 1, 128);
    },

    findEdges(ctx) {
      const kernel = [
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1
      ];
      this.applyKernel(ctx, kernel, 1);
    },

    glowingEdges(ctx) {
      this.findEdges(ctx);
      this.hueSaturation(ctx, 45, 0.5, 0.2);
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
              const intensity = Math.floor(((r + g + b) / 3 * intensityLevels) / 256);

              intensityCount[intensity]++;
              avgR[intensity] += r;
              avgG[intensity] += g;
              avgB[intensity] += b;
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
          dd[dIdx] = Math.round(avgR[maxIndex] / maxCount);
          dd[dIdx + 1] = Math.round(avgG[maxIndex] / maxCount);
          dd[dIdx + 2] = Math.round(avgB[maxIndex] / maxCount);
          dd[dIdx + 3] = sd[dIdx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    pinch(ctx, amount = 0.5) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy);
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let sx = x;
          let sy = y;

          if (dist < radius) {
            const factor = Math.pow(dist / radius, amount);
            sx = cx + dx * factor;
            sy = cy + dy * factor;
          }

          const idx = (Math.min(h - 1, Math.max(0, Math.round(sy))) * w + Math.min(w - 1, Math.max(0, Math.round(sx)))) * 4;
          const dIdx = (y * w + x) * 4;
          dst.data[dIdx] = src.data[idx];
          dst.data[dIdx + 1] = src.data[idx + 1];
          dst.data[dIdx + 2] = src.data[idx + 2];
          dst.data[dIdx + 3] = src.data[idx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    ripple(ctx, frequency = 20, amplitude = 5) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const src = ctx.getImageData(0, 0, w, h);
      const dst = ctx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(w - 1, Math.max(0, Math.round(x + Math.sin(y / frequency) * amplitude)));
          const sy = Math.min(h - 1, Math.max(0, Math.round(y + Math.cos(x / frequency) * amplitude)));
          const idx = (sy * w + sx) * 4;
          const dIdx = (y * w + x) * 4;
          dst.data[dIdx] = src.data[idx];
          dst.data[dIdx + 1] = src.data[idx + 1];
          dst.data[dIdx + 2] = src.data[idx + 2];
          dst.data[dIdx + 3] = src.data[idx + 3];
        }
      }
      ctx.putImageData(dst, 0, 0);
    },

    lensFlare(ctx, lx = 0.7, ly = 0.3) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const fx = lx * w;
      const fy = ly * h;
      ctx.save();
      const grad = ctx.createRadialGradient(fx, fy, 5, fx, fy, Math.max(w, h) * 0.4);
      grad.addColorStop(0, 'rgba(255, 255, 230, 0.85)');
      grad.addColorStop(0.2, 'rgba(255, 200, 100, 0.4)');
      grad.addColorStop(0.5, 'rgba(200, 100, 255, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  };

  // Export to namespace
  P.Filters = Filters;

})(window);
