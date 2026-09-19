
    /* Theme Toggle */
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('pixnivo_theme', next); } catch(e) {}
      });
    }

    /* Mobile Menu Toggle */
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
      });
    }

    function fmt(bytes){
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
      return (bytes/1024/1024).toFixed(2) + ' MB';
    }

    function setupDropzone(dropEl, inputEl, onFile){
      dropEl.addEventListener('click', () => inputEl.click());
      inputEl.addEventListener('change', e => { if (e.target.files.length) onFile(e.target.files[0]); });
      ['dragover','dragenter'].forEach(evt => dropEl.addEventListener(evt, e => { e.preventDefault(); dropEl.classList.add('drag'); }));
      ['dragleave','drop'].forEach(evt => dropEl.addEventListener(evt, e => { e.preventDefault(); dropEl.classList.remove('drag'); }));
      dropEl.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]); });
    }

    const MAX_SOURCE_DIM = 5000;
    function capSize(source){
      const w = source.width, h = source.height;
      const longest = Math.max(w, h);
      if (longest <= MAX_SOURCE_DIM) return source;
      const scale = MAX_SOURCE_DIM / longest;
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
      return c;
    }

    let toastEl = null;
    function showToast(msg){
      if (!toastEl){
        toastEl = document.createElement('div');
        toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
          'background:rgba(21,19,29,0.95);color:#f5f3ef;border:1px solid rgba(255,255,255,0.12);padding:12px 24px;' +
          'border-radius:9999px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.6);backdrop-filter:blur(16px);';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.style.display = 'block';
    }
    function hideToast(){ if (toastEl) toastEl.style.display = 'none'; }

    function loadScriptOnce(src){
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.body.appendChild(s);
      });
    }

    function looksHeic(file){
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      return name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif');
    }

    async function convertHeic(file){
      showToast('Converting iPhone photo…');
      try{
        if (!window.HeicTo){
          await loadScriptOnce('https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js');
        }
        if (window.HeicTo){
          return await window.HeicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
        }
        throw new Error('HeicTo unavailable');
      } catch(e){
        if (!window.heic2any){
          await loadScriptOnce('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
        }
        const out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        return Array.isArray(out) ? out[0] : out;
      } finally {
        hideToast();
      }
    }

    function uploadFailed(file){
      const name = (file && file.name) ? file.name : 'This file';
      const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : '';
      let extra;
      if (['HEIC','HEIF'].includes(ext)){
        extra = 'This iPhone photo could not be converted. Please save it as JPG and upload again.';
      } else if (['TIF','TIFF','PSD','SVG','CR2','NEF','DNG','RAW','ARW'].includes(ext)){
        extra = 'This file format is not supported by web browsers. Please use a JPG or PNG image.';
      } else {
        extra = 'The file may be damaged or too large. Please try a JPG or PNG version.';
      }
      alert('Could not open "' + name + '".\n\n' + extra);
    }

    function readImage(file, cb){
      if (!file) return;
      if (file.size === 0){ uploadFailed(file); return; }

      const decode = blob => {
        if (window.createImageBitmap){
          return createImageBitmap(blob)
            .then(bmp => cb(capSize(bmp)))
            .catch(() => legacyRead(blob, file, cb));
        }
        legacyRead(blob, file, cb);
      };

      if (looksHeic(file)){
        convertHeic(file).then(decode).catch(() => uploadFailed(file));
        return;
      }

      if (window.createImageBitmap){
        createImageBitmap(file)
          .then(bmp => cb(capSize(bmp)))
          .catch(() => {
            convertHeic(file).then(decode).catch(() => legacyRead(file, file, cb));
          });
        return;
      }
      legacyRead(file, file, cb);
    }

    function legacyRead(blob, originalFile, cb){
      const reader = new FileReader();
      reader.onerror = () => uploadFailed(originalFile);
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          if (!img.width || !img.height){ uploadFailed(originalFile); return; }
          cb(capSize(img));
        };
        img.onerror = () => uploadFailed(originalFile);
        img.src = e.target.result;
      };
      reader.readAsDataURL(blob);
    }

    /* Tab Switcher */
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.studio-card').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('stage-' + btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    function makeScaledCanvas(image, maxDim){
      const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(image.width * scale));
      c.height = Math.max(1, Math.round(image.height * scale));
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      return c;
    }

    