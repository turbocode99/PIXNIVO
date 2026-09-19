/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — VECTOR SVG & MULTI-RES EXPORTER
 * Module: Scalable Vector SVG Generation & Multi-Resolution Asset Export
 * ==============================================================================
 * Converts composition states into valid W3C Scalable Vector Graphics (SVG)
 * with embedded Google Fonts, vector badge frames, and scalable typography,
 * plus high-resolution PNG exports (1x, 2x, 4x) and favicon packages.
 */

import { DEFAULT_COMPOSITION_STATE } from './canvasStudioEngine.js';

/**
 * Escapes XML special characters.
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an SVG badge frame string based on the shape.
 */
function generateBadgeFrameSVG(shape, width, height, strokeWidth = 6, strokeColor = '#ff7a1a') {
  if (shape === 'none') return '';

  const cx = width / 2;
  const cy = height / 2;
  const pad = 48;

  if (shape === 'circle-ring') {
    const r = Math.min(width, height) / 2 - pad;
    return `
    <!-- Badge Frame: Circle Ring -->
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" filter="url(#glow)" />
    <circle cx="${cx}" cy="${cy}" r="${r - 16}" stroke="${strokeColor}" stroke-opacity="0.35" stroke-width="1.5" fill="none" />
    `;
  }

  if (shape === 'squircle') {
    const w = width - pad * 2;
    const h = height - pad * 2;
    return `
    <!-- Badge Frame: Squircle -->
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="80" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" filter="url(#glow)" />
    `;
  }

  if (shape === 'shield') {
    const topY = pad + 10;
    const botY = height - pad - 10;
    const midY = (topY + botY) * 0.55;
    const leftX = pad + 20;
    const rightX = width - pad - 20;
    const d = `M ${cx} ${topY} L ${rightX} ${topY + 40} Q ${rightX} ${midY} ${cx} ${botY} Q ${leftX} ${midY} ${leftX} ${topY + 40} Z`;
    return `
    <!-- Badge Frame: Shield -->
    <path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" filter="url(#glow)" />
    `;
  }

  if (shape === 'hexagon') {
    const r = Math.min(width, height) / 2 - pad;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      points.push(`${Math.round(cx + r * Math.cos(a))},${Math.round(cy + r * Math.sin(a))}`);
    }
    return `
    <!-- Badge Frame: Hexagon -->
    <polygon points="${points.join(' ')}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" filter="url(#glow)" />
    `;
  }

  return '';
}

/**
 * Builds a standalone Scalable Vector Graphics (.svg) document.
 *
 * @param {Object} compositionState - Active composition settings
 * @param {string} logoDataUrl - Transparent PNG data URL
 * @param {Object} [options={}]
 * @returns {string} Complete W3C SVG XML document string
 */
export function generateCompositionSVG(compositionState, logoDataUrl, options = {}) {
  const state = { ...DEFAULT_COMPOSITION_STATE, ...compositionState };
  const width = options.width || 1024;
  const height = options.height || 1024;
  const transparentBackground = options.transparentBackground !== false;

  const brandName = escapeXml(state.brandName.toUpperCase());
  const slogan = escapeXml(state.slogan.toUpperCase());
  const fontFamily = state.fontFamily || 'Plus Jakarta Sans';
  const encodedFont = encodeURIComponent(fontFamily);

  const frameSvg = generateBadgeFrameSVG(
    state.badgeFrame,
    width,
    height,
    state.frameStroke || 6,
    state.accentColor || '#ff7a1a'
  );

  let layoutContent = '';

  if (state.layout === 'horizontal') {
    // Horizontal: Mark Left, Typography Right
    const markSize = Math.round(width * 0.38);
    const markX = Math.round(width * 0.08);
    const markY = Math.round((height - markSize) / 2);
    const textX = markX + markSize + 36;
    const textCenterY = height / 2;

    layoutContent = `
    <!-- Logo Mark -->
    <image href="${logoDataUrl}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" filter="url(#drop-shadow)" />

    <!-- Typography: Brand Name -->
    <text x="${textX}" y="${textCenterY}" font-family="'${fontFamily}', sans-serif" font-size="${state.brandFontSize}px" font-weight="800" fill="${state.textColor}" letter-spacing="${state.letterSpacing}px" text-anchor="start" dominant-baseline="alphabetic">
      ${brandName}
    </text>

    <!-- Typography: Slogan -->
    ${slogan ? `
    <text x="${textX}" y="${textCenterY + 36}" font-family="'${fontFamily}', sans-serif" font-size="${state.sloganFontSize}px" font-weight="600" fill="${state.sloganColor}" letter-spacing="${Math.round(state.letterSpacing * 0.6)}px" text-anchor="start" dominant-baseline="hanging">
      ${slogan}
    </text>` : ''}
    `;

  } else if (state.layout === 'badge-arc') {
    // Badge Arc: Mark Centered, Brand on Top Arc Path, Slogan Bottom
    const markSize = Math.round(width * 0.46);
    const markX = Math.round((width - markSize) / 2);
    const markY = Math.round((height - markSize) / 2);
    const arcRadius = width / 2 - 80;

    // SVG arc path from left to right along the top half
    const arcD = `M ${Math.round(width / 2 - arcRadius)} ${Math.round(height / 2)} A ${arcRadius} ${arcRadius} 0 0 1 ${Math.round(width / 2 + arcRadius)} ${Math.round(height / 2)}`;

    layoutContent = `
    <!-- Logo Mark -->
    <image href="${logoDataUrl}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" filter="url(#drop-shadow)" />

    <!-- Arc Path Definition -->
    <path id="brand-arc-path" d="${arcD}" fill="none" />

    <!-- Curved Brand Name -->
    <text font-family="'${fontFamily}', sans-serif" font-size="${Math.round(state.brandFontSize * 0.85)}px" font-weight="800" fill="${state.textColor}" letter-spacing="${state.letterSpacing}px">
      <textPath href="#brand-arc-path" startOffset="50%" text-anchor="middle">
        ${brandName}
      </textPath>
    </text>

    <!-- Typography: Slogan -->
    ${slogan ? `
    <text x="${width / 2}" y="${height - 90}" font-family="'${fontFamily}', sans-serif" font-size="${state.sloganFontSize}px" font-weight="600" fill="${state.sloganColor}" letter-spacing="${Math.round(state.letterSpacing * 0.8)}px" text-anchor="middle" dominant-baseline="middle">
      ${slogan}
    </text>` : ''}
    `;

  } else {
    // Default 'stacked': Mark Top, Brand Name Below, Slogan Bottom
    const markSize = Math.round(width * 0.52);
    const markX = Math.round((width - markSize) / 2);
    const markY = Math.round(height * 0.1);
    const textStartY = markY + markSize + 56;

    layoutContent = `
    <!-- Logo Mark -->
    <image href="${logoDataUrl}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" filter="url(#drop-shadow)" />

    <!-- Typography: Brand Name -->
    <text x="${width / 2}" y="${textStartY}" font-family="'${fontFamily}', sans-serif" font-size="${state.brandFontSize}px" font-weight="800" fill="${state.textColor}" letter-spacing="${state.letterSpacing}px" text-anchor="middle" dominant-baseline="middle">
      ${brandName}
    </text>

    <!-- Typography: Slogan -->
    ${slogan ? `
    <text x="${width / 2}" y="${textStartY + 44}" font-family="'${fontFamily}', sans-serif" font-size="${state.sloganFontSize}px" font-weight="600" fill="${state.sloganColor}" letter-spacing="${Math.round(state.letterSpacing * 0.8)}px" text-anchor="middle" dominant-baseline="middle">
      ${slogan}
    </text>` : ''}
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Google Font Import -->
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=${encodedFont}:wght@400;600;700;800&amp;display=swap');
    </style>

    <!-- Ambient Shadow Filter -->
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.4" />
    </filter>

    <!-- Frame Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  ${!transparentBackground ? `<rect width="${width}" height="${height}" fill="#0a0814" />` : ''}

  ${frameSvg}

  ${layoutContent}
</svg>`;
}

/**
 * Initiates a client-side download for an SVG text string.
 */
export function downloadSVG(svgString, filename = 'pixnivo-logo.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports high-resolution PNGs at 1x, 2x, or 4x magnification.
 */
export async function exportHighResPNG(canvas, scaleMultiplier = 2, filename = 'pixnivo-logo-hd.png') {
  if (!canvas) return;

  const targetW = canvas.width * scaleMultiplier;
  const targetH = canvas.height * scaleMultiplier;

  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(canvas, 0, 0, targetW, targetH);

  offscreen.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png', 1.0);
}

/**
 * Exports a multi-format icon bundle (16, 32, 64, 192, 512).
 */
export function exportIconSize(canvas, size = 192, filename = 'icon-192.png') {
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, size, size);

  offscreen.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

// Browser global attachment
if (typeof window !== 'undefined') {
  window.PixnivoSvgExporter = {
    generateCompositionSVG,
    downloadSVG,
    exportHighResPNG,
    exportIconSize
  };
}
