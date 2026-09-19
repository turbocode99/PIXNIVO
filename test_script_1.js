
    (function() {
      try {
        const saved = localStorage.getItem('pixnivo_theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  