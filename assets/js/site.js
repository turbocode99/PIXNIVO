/* ==========================================================================
   PIXNIVO shared site runtime
   Theme switching, navigation, toasts and file helpers used by every page.
   Exposed as window.Pixnivo.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'pixnivo_theme';

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  /* ---------------------------------------------------------------------
     Theme
     --------------------------------------------------------------------- */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function savedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function syncThemeUi() {
    const theme = currentTheme();
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme === 'dark' ? '#0b0b0d' : '#fafafa');
  }

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
    }
    syncThemeUi();
    document.dispatchEvent(new CustomEvent('pixnivo:themechange', { detail: { theme } }));
  }

  if (!root.hasAttribute('data-theme')) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', savedTheme() || (prefersDark ? 'dark' : 'light'));
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = e => { if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light', false); };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
  }

  /* ---------------------------------------------------------------------
     Range sliders: keep the filled-track CSS variable in sync,
     including when scripts assign .value programmatically.
     --------------------------------------------------------------------- */
  function updateRange(el) {
    const min = el.min === '' ? 0 : parseFloat(el.min);
    const max = el.max === '' ? 100 : parseFloat(el.max);
    const val = parseFloat(el.value);
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--fill', Math.max(0, Math.min(100, pct)) + '%');
  }

  function refreshRanges(scope) {
    (scope || document).querySelectorAll('input[type="range"]').forEach(updateRange);
  }

  const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (valueDesc && valueDesc.set && valueDesc.configurable) {
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      configurable: true,
      enumerable: valueDesc.enumerable,
      get() { return valueDesc.get.call(this); },
      set(v) {
        valueDesc.set.call(this, v);
        if (this.type === 'range') updateRange(this);
      }
    });
  }

  document.addEventListener('input', e => {
    if (e.target && e.target.type === 'range') updateRange(e.target);
  }, true);

  /* ---------------------------------------------------------------------
     Toasts (aria-live, auto-dismiss, never steal focus)
     --------------------------------------------------------------------- */
  let toastRegion = null;

  function ensureToastRegion() {
    if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
    toastRegion = document.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('aria-live', 'polite');
    toastRegion.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(toastRegion);
    return toastRegion;
  }

  function toast(message, opts) {
    const options = Object.assign({ type: 'info', duration: null }, opts || {});
    const region = ensureToastRegion();
    const el = document.createElement('div');
    const iconEl = document.createElement('span');
    const msgEl = document.createElement('div');
    const closeBtn = document.createElement('button');

    iconEl.className = 'toast-icon';
    msgEl.className = 'toast-msg';
    closeBtn.className = 'toast-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = ICONS.close;
    el.append(iconEl, msgEl, closeBtn);

    let timer = null;
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 200);
    }

    function set(text, type, duration) {
      const t = type || options.type;
      el.className = 'toast toast-' + t;
      el.setAttribute('role', t === 'error' ? 'alert' : 'status');
      iconEl.innerHTML = t === 'loading' ? '' : (ICONS[t] || ICONS.info);
      msgEl.textContent = text;
      clearTimeout(timer);
      const d = duration != null ? duration : (t === 'loading' ? 0 : t === 'error' ? 7000 : 4200);
      if (d > 0) timer = setTimeout(close, d);
    }

    closeBtn.addEventListener('click', close);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    set(message, options.type, options.duration);

    if (options.action && options.action.label) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'toast-action';
      actionBtn.textContent = options.action.label;
      actionBtn.addEventListener('click', () => {
        try { options.action.onClick(); } finally { close(); }
      });
      el.insertBefore(actionBtn, closeBtn);
    }
    region.appendChild(el);
    while (region.children.length > 4) region.firstElementChild.remove();

    return { close, update: (text, type, duration) => { if (!closed) set(text, type, duration); } };
  }

  /* ---------------------------------------------------------------------
     File helpers
     --------------------------------------------------------------------- */
  function formatBytes(bytes) {
    if (!isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function baseName(name) {
    return String(name || 'file').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'file';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('The browser could not encode this image. Try a smaller size.')), type, quality);
    });
  }

  const scriptCache = new Map();
  function loadScript(src) {
    if (scriptCache.has(src)) return scriptCache.get(src);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptCache.delete(src); reject(new Error('Could not load a required component. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    scriptCache.set(src, p);
    return p;
  }

  function looksHeic(file) {
    const name = (file && file.name || '').toLowerCase();
    const type = (file && file.type || '').toLowerCase();
    return /\.(heic|heif)$/.test(name) || type.includes('heic') || type.includes('heif');
  }

  async function convertHeic(file) {
    const note = toast('Converting iPhone photo…', { type: 'loading' });
    try {
      try {
        if (!window.HeicTo) await loadScript('https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js');
        if (window.HeicTo) return await window.HeicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
        throw new Error('HeicTo unavailable');
      } catch (e) {
        if (!window.heic2any) await loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
        const out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        return Array.isArray(out) ? out[0] : out;
      }
    } finally {
      note.close();
    }
  }

  function describeLoadError(file) {
    const name = (file && file.name) ? file.name : 'This file';
    const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : '';
    if (['HEIC', 'HEIF'].includes(ext)) return `Couldn't convert "${name}". Save it as JPG on your phone and try again.`;
    if (['TIF', 'TIFF', 'PSD', 'CR2', 'NEF', 'DNG', 'RAW', 'ARW'].includes(ext)) return `"${name}" is a ${ext} file, which browsers can't open. Please use JPG, PNG or WebP.`;
    return `Couldn't open "${name}". The file may be damaged or not an image.`;
  }

  function capCanvas(source, maxDim) {
    const w = source.width, h = source.height;
    if (!maxDim || Math.max(w, h) <= maxDim) return source;
    const scale = maxDim / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  function decodeViaImg(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (!img.naturalWidth) reject(new Error('empty'));
        else resolve(img);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  async function decodeBlob(blob) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) { /* fall through to <img> */ }
    }
    return decodeViaImg(blob);
  }

  /**
   * Decode any user image (incl. iPhone HEIC) into a drawable source.
   * Resolves to an ImageBitmap / HTMLImageElement / canvas with width & height.
   */
  async function decodeImage(file, opts) {
    const maxDim = (opts && opts.maxDim) || 0;
    if (!file || file.size === 0) throw new Error(describeLoadError(file));
    let source;
    try {
      if (looksHeic(file)) {
        source = await decodeBlob(await convertHeic(file));
      } else {
        try {
          source = await decodeBlob(file);
        } catch (e) {
          // Some phones label HEIC photos as JPG or leave the type blank
          if (file.type && !/^image\//.test(file.type)) throw e;
          source = await decodeBlob(await convertHeic(file));
        }
      }
    } catch (e) {
      throw new Error(describeLoadError(file));
    }
    if (!source || !source.width || !source.height) throw new Error(describeLoadError(file));
    return capCanvas(source, maxDim);
  }

  /**
   * Make a dropzone clickable, keyboard accessible and drag-and-drop aware.
   * onFiles receives an array of File objects.
   */
  function wireDropzone(zone, input, onFiles) {
    if (!zone || !input) return;
    if (!zone.hasAttribute('tabindex')) zone.setAttribute('tabindex', '0');
    if (!zone.hasAttribute('role')) zone.setAttribute('role', 'button');

    const open = () => input.click();
    zone.addEventListener('click', e => { if (e.target !== input) open(); });
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    let depth = 0;
    zone.addEventListener('dragenter', e => { e.preventDefault(); depth++; zone.classList.add('drag'); });
    zone.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) zone.classList.remove('drag'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      depth = 0;
      zone.classList.remove('drag');
      const files = e.dataTransfer ? [...e.dataTransfer.files] : [];
      if (files.length) onFiles(files);
    });

    input.addEventListener('change', () => {
      const files = [...(input.files || [])];
      input.value = '';
      if (files.length) onFiles(files);
    });
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
    btn.disabled = !!on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  /* Yield so the browser can paint spinners before heavy work.
     Falls back to a timer because rAF is paused in background tabs. */
  const nextFrame = () => new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => setTimeout(finish, 0));
    setTimeout(finish, 60);
  });

  /* ---------------------------------------------------------------------
     Accessible tabs: [role=tablist] > [role=tab][data-tab] controlling
     #stage-<name> panels. Supports arrow keys and ?tab= deep links.
     --------------------------------------------------------------------- */
  function initTabs(opts) {
    const o = Object.assign({ list: document.querySelector('[role="tablist"]'), panelPrefix: 'stage-', param: 'tab', onChange: null }, opts);
    if (!o.list) return null;
    const tabs = [...o.list.querySelectorAll('[role="tab"][data-tab]')];
    if (!tabs.length) return null;

    function activate(name, a) {
      const args = Object.assign({ focus: false, updateUrl: true }, a);
      const btn = tabs.find(t => t.dataset.tab === name);
      if (!btn) return;
      tabs.forEach(t => {
        const on = t === btn;
        const panel = document.getElementById(o.panelPrefix + t.dataset.tab);
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panel) { panel.classList.toggle('active', on); panel.hidden = !on; }
      });
      if (args.focus) btn.focus();
      if (args.updateUrl && window.history && history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set(o.param, name);
        url.hash = '';
        history.replaceState(null, '', url);
      }
      if (typeof o.onChange === 'function') o.onChange(name);
    }

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t.dataset.tab));
      t.addEventListener('keydown', e => {
        let next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activate(next.dataset.tab, { focus: true }); }
      });
    });

    function fromUrl() {
      const params = new URLSearchParams(window.location.search);
      const name = params.get(o.param) || window.location.hash.replace('#', '');
      if (name && tabs.some(t => t.dataset.tab === name)) activate(name, { updateUrl: false });
    }
    fromUrl();
    window.addEventListener('hashchange', fromUrl);

    return {
      activate,
      current: () => (tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]).dataset.tab
    };
  }

  /* ---------------------------------------------------------------------
     Page chrome wiring (runs once DOM is ready)
     --------------------------------------------------------------------- */
  function initChrome() {
    syncThemeUi();
    refreshRanges();

    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true));
    });

    const header = document.querySelector('.site-header');
    if (header) {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          header.classList.toggle('is-scrolled', window.scrollY > 4);
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const toggle = document.getElementById('mobileToggle');
    const nav = document.getElementById('navLinks');
    if (toggle && nav) {
      const setOpen = open => {
        nav.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      };
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        setOpen(!nav.classList.contains('open'));
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
      });
      document.addEventListener('click', e => {
        if (nav.classList.contains('open') && !nav.contains(e.target) && e.target !== toggle) setOpen(false);
      });
      nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
      window.addEventListener('resize', () => { if (window.innerWidth > 1024) setOpen(false); });
    }

    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initChrome);
  else initChrome();

  window.Pixnivo = {
    applyTheme,
    currentTheme,
    toast,
    formatBytes,
    baseName,
    downloadBlob,
    canvasToBlob,
    loadScript,
    looksHeic,
    convertHeic,
    describeLoadError,
    decodeImage,
    capCanvas,
    wireDropzone,
    initTabs,
    setLoading,
    refreshRanges,
    nextFrame,
    icons: ICONS
  };
})();
