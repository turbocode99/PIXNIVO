/* ==========================================================================
   PIXNIVO Image Upscaler
   Multi-step resampling + banded unsharp mask, with a before/after slider.
   Shared by the Image Studio (/?tab=upscale) and the /image-upscaler page.
   Requires /assets/js/site.js (window.Pixnivo).
   ========================================================================== */
(function () {
  'use strict';

  const P = window.Pixnivo;
  const $ = id => document.getElementById(id);
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
  const handlers = window.PixnivoToolHandlers = window.PixnivoToolHandlers || {};
  if (!$('dropU')) return;

  const ctxFilterSupported = (() => {
    const c = document.createElement('canvas').getContext('2d');
    if (!c || typeof c.filter !== 'string') return false;
    c.filter = 'blur(2px)';
    return c.filter === 'blur(2px)';
  })();

  async function openImage(file) {
    if (file.type && !file.type.startsWith('image/') && !P.looksHeic(file)) {
      P.toast(`"${file.name}" isn't an image. Choose a JPG, PNG, WebP or HEIC file.`, { type: 'error' });
      return null;
    }
    try {
      return await P.decodeImage(file, { maxDim: 5000 });
    } catch (err) {
      P.toast(err.message, { type: 'error' });
      return null;
    }
  }

  function setPressed(group, activeEl, activeClass) {
    group.forEach(el => {
      const on = el === activeEl;
      el.classList.toggle(activeClass || 'active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  async function exportCanvas(canvas, mime, quality, baseName, suffix) {
    let source = canvas;
    if (mime === 'image/jpeg') {
      source = document.createElement('canvas');
      source.width = canvas.width;
      source.height = canvas.height;
      const sx = source.getContext('2d');
      sx.fillStyle = '#ffffff';
      sx.fillRect(0, 0, source.width, source.height);
      sx.drawImage(canvas, 0, 0);
    }
    const blob = await P.canvasToBlob(source, mime, mime === 'image/png' ? undefined : quality);
    const ext = EXT[blob.type] || 'png';
    P.downloadBlob(blob, `${baseName}-${suffix}.${ext}`);
    if (blob.type !== mime) P.toast(`Your browser can't save ${EXT[mime].toUpperCase()} files, so a ${ext.toUpperCase()} was downloaded instead.`, { type: 'warning' });
    else P.toast(`Downloaded ${baseName}-${suffix}.${ext} (${P.formatBytes(blob.size)})`, { type: 'success' });
    return blob;
  }

  const MAX_PIXELS = 40000000;
  const PREVIEW_MAX = 4096;
  const cvBefore = $('cvBeforeU'), cvAfter = $('cvAfterU');
  const busyEl = $('busyU');

  let source = null, baseUp = null, outCanvas = null, scale = 2, name = 'image', renderTimer = null, job = 0;

  P.wireDropzone($('dropU'), $('fileU'), files => load(files[0]));
  $('replaceU').addEventListener('click', () => $('fileU').click());
  handlers.upscale = load;

  function busy(on, txt) {
    busyEl.classList.toggle('active', !!on);
    if (txt) $('busyTxtU').textContent = txt;
  }

  async function load(f) {
    const im = await openImage(f);
    if (!im) return;
    source = im;
    name = P.baseName(f.name);
    $('nameU').textContent = f.name;
    $('metaU').textContent = im.width + ' × ' + im.height + ' · ' + P.formatBytes(f.size);
    $('dropU').hidden = true;
    $('workU').classList.add('active');
    setSlider(50);
    rebuild();
  }

  function upscaleStepwise(img, tw, th) {
    let cur = img;
    let cw = img.width;
    while (cw < tw) {
      const nw = Math.min(tw, Math.round(cw * 1.5));
      const nh = Math.round(nw * (th / tw));
      const next = document.createElement('canvas');
      next.width = nw; next.height = nh;
      const cx = next.getContext('2d');
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(cur, 0, 0, nw, nh);
      cur = next; cw = nw;
    }
    if (cur.width !== tw || cur.height !== th || cur === img) {
      const fin = document.createElement('canvas');
      fin.width = tw; fin.height = th;
      const cx = fin.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(cur, 0, 0, tw, th);
      cur = fin;
    }
    return cur;
  }

  /* Unsharp mask processed in horizontal bands so any output size works */
  function unsharpMask(canvas, amount) {
    if (amount <= 0) return;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const k = amount / 100 * 1.6;
    const BAND = Math.max(64, Math.floor(4000000 / w));
    for (let y0 = 0; y0 < h; y0 += BAND) {
      const y1 = Math.min(h, y0 + BAND);
      const top = Math.max(0, y0 - 1), bottom = Math.min(h, y1 + 1);
      const bh = bottom - top;
      const id = ctx.getImageData(0, top, w, bh);
      const d = id.data;
      const tmp = new Float32Array(w * bh * 3);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < w; x++) {
          const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
          const t = (y * w + x) * 3, row = y * w;
          for (let c = 0; c < 3; c++) tmp[t + c] = (d[((row + xl) << 2) + c] + d[((row + x) << 2) + c] + d[((row + xr) << 2) + c]) / 3;
        }
      }
      const outRows = new Uint8ClampedArray(w * (y1 - y0) * 4);
      for (let y = y0; y < y1; y++) {
        const ly = y - top;
        const yu = ly > 0 ? ly - 1 : 0, yd = ly < bh - 1 ? ly + 1 : bh - 1;
        for (let x = 0; x < w; x++) {
          const p = (ly * w + x) << 2, o = ((y - y0) * w + x) << 2;
          for (let c = 0; c < 3; c++) {
            const blurV = (tmp[(yu * w + x) * 3 + c] + tmp[(ly * w + x) * 3 + c] + tmp[(yd * w + x) * 3 + c]) / 3;
            outRows[o + c] = d[p + c] + (d[p + c] - blurV) * k;
          }
          outRows[o + 3] = d[p + 3];
        }
      }
      ctx.putImageData(new ImageData(outRows, w, y1 - y0), 0, y0);
    }
  }

  function adjustLoop(canvas, bF, cF, sF) {
    if (bF === 1 && cF === 1 && sF === 1) return;
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp255((d[i] * bF - 128) * cF + 128);
      let g = clamp255((d[i + 1] * bF - 128) * cF + 128);
      let b = clamp255((d[i + 2] * bF - 128) * cF + 128);
      if (sF !== 1) {
        const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        r = grey + (r - grey) * sF; g = grey + (g - grey) * sF; b = grey + (b - grey) * sF;
      }
      d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b);
    }
    ctx.putImageData(id, 0, 0);
  }

  function drawPreview(target, src, smoothing) {
    const s = Math.min(1, PREVIEW_MAX / Math.max(baseUp.width, baseUp.height));
    target.width = Math.round(baseUp.width * s);
    target.height = Math.round(baseUp.height * s);
    const cx = target.getContext('2d');
    cx.imageSmoothingEnabled = smoothing !== false;
    cx.imageSmoothingQuality = smoothing === 'low' ? 'low' : 'high';
    cx.drawImage(src, 0, 0, target.width, target.height);
  }

  async function rebuild() {
    if (!source) return;
    const my = ++job;
    busy(true, scale > 1 ? `Upscaling ${scale}×…` : 'Processing…');
    await P.nextFrame();
    let tw = Math.round(source.width * scale), th = Math.round(source.height * scale);
    const capped = tw * th > MAX_PIXELS;
    if (capped) {
      const f = Math.sqrt(MAX_PIXELS / (tw * th));
      tw = Math.round(tw * f); th = Math.round(th * f);
    }
    $('capHintU').hidden = !capped;
    baseUp = upscaleStepwise(source, tw, th);
    if (my !== job) return;
    $('dimFromU').textContent = source.width + ' × ' + source.height;
    $('dimToU').textContent = baseUp.width + ' × ' + baseUp.height;
    drawPreview(cvBefore, source, 'low');
    await applyAdjustments(my);
    if (my === job) busy(false);
  }

  async function applyAdjustments(my) {
    if (!baseUp) return;
    const bF = parseInt($('brightnessU').value, 10) / 100;
    const cF = parseInt($('contrastU').value, 10) / 100;
    const sF = parseInt($('saturationU').value, 10) / 100;
    const out = document.createElement('canvas');
    out.width = baseUp.width; out.height = baseUp.height;
    const ox = out.getContext('2d');
    if (ctxFilterSupported && (bF !== 1 || cF !== 1 || sF !== 1)) {
      ox.filter = `brightness(${bF}) contrast(${cF}) saturate(${sF})`;
      ox.drawImage(baseUp, 0, 0);
      ox.filter = 'none';
    } else {
      ox.drawImage(baseUp, 0, 0);
      adjustLoop(out, bF, cF, sF);
    }
    await P.nextFrame();
    if (my !== undefined && my !== job) return;
    unsharpMask(out, parseInt($('sharpenU').value, 10));
    outCanvas = out;
    drawPreview(cvAfter, out, true);
  }

  function queueAdjust() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      const my = ++job;
      busy(true, 'Rendering…');
      await P.nextFrame();
      await applyAdjustments(my);
      if (my === job) busy(false);
    }, 220);
  }

  const scaleChips = [...document.querySelectorAll('#stage-upscale [data-scale]')];
  scaleChips.forEach(chip => chip.addEventListener('click', () => {
    setPressed(scaleChips, chip, 'on');
    scale = parseInt(chip.dataset.scale, 10);
    rebuild();
  }));

  [['sharpenU', 'shValU', ''], ['brightnessU', 'brValU', '%'], ['contrastU', 'coValU', '%'], ['saturationU', 'saValU', '%']].forEach(([id, lab, suffix]) => {
    $(id).addEventListener('input', () => { $(lab).textContent = $(id).value + suffix; queueAdjust(); });
  });

  $('formatU').addEventListener('change', e => { $('qWrapU').hidden = e.target.value === 'image/png'; });
  $('qualityU').addEventListener('input', e => { $('qValU').textContent = e.target.value + '%'; });

  $('resetU').addEventListener('click', () => {
    $('sharpenU').value = 55; $('shValU').textContent = '55';
    $('brightnessU').value = 100; $('brValU').textContent = '100%';
    $('contrastU').value = 100; $('coValU').textContent = '100%';
    $('saturationU').value = 100; $('saValU').textContent = '100%';
    queueAdjust();
  });

  $('downloadU').addEventListener('click', async () => {
    if (!outCanvas) return;
    const btn = $('downloadU');
    P.setLoading(btn, true);
    await P.nextFrame();
    try {
      await exportCanvas(outCanvas, $('formatU').value, parseInt($('qualityU').value, 10) / 100, name, `upscaled-${scale}x`);
    } catch (err) {
      P.toast('Could not create the file — try a smaller scale.', { type: 'error' });
    } finally {
      P.setLoading(btn, false);
    }
  });

  /* ---- Before / after comparison ---- */
  const wrap = $('compareU'), after = $('afterWrapU'), handle = $('handleU');
  let pos = 50, dragging = false;

  function setSlider(pct) {
    pos = Math.max(0, Math.min(100, pct));
    after.style.clipPath = `inset(0 0 0 ${pos}%)`;
    handle.style.left = pos + '%';
    handle.setAttribute('aria-valuenow', String(Math.round(pos)));
  }

  function fromPointer(e) {
    const r = wrap.getBoundingClientRect();
    setSlider(((e.clientX - r.left) / r.width) * 100);
  }

  wrap.addEventListener('pointerdown', e => {
    dragging = true;
    wrap.setPointerCapture(e.pointerId);
    fromPointer(e);
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => { if (dragging) fromPointer(e); });
  ['pointerup', 'pointercancel'].forEach(ev => wrap.addEventListener(ev, () => { dragging = false; }));
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setSlider(pos - step); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setSlider(pos + step); e.preventDefault(); }
    else if (e.key === 'Home') { setSlider(0); e.preventDefault(); }
    else if (e.key === 'End') { setSlider(100); e.preventDefault(); }
  });
  setSlider(50);
})();
