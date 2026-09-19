/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — ADVANCED CANVAS STUDIO ENGINE
 * Module: Multi-Layer Composition, Typography, Emblem Badges & Arc Text
 * ==============================================================================
 * Renders complete corporate branding compositions on canvas:
 * 1. Geometric Badge Frame layer (Circle, Shield, Squircle, Hexagon)
 * 2. Transparent Logo Mark layer (with layout scaling & ambient shadow)
 * 3. Primary Brand Name Typography layer (with custom tracking & fonts)
 * 4. Tagline / Slogan layer (with secondary styling)
 * 5. Circular Arc Text rendering engine
 */

import { loadImage } from './backgroundRemover.js';
import { drawCheckerboard } from './canvasInjector.js';

/**
 * Curated typography catalog for studio branding.
 */
export const AVAILABLE_FONTS = [
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Modern Clean)', category: 'sans-serif', defaultWeight: 800 },
  { id: 'Inter', label: 'Inter (Tech Minimalist)', category: 'sans-serif', defaultWeight: 700 },
  { id: 'Playfair Display', label: 'Playfair Display (Luxury Serif)', category: 'serif', defaultWeight: 700 },
  { id: 'Orbitron', label: 'Orbitron (Cyber Tech)', category: 'sans-serif', defaultWeight: 800 },
  { id: 'JetBrains Mono', label: 'JetBrains Mono (Code / Monospace)', category: 'monospace', defaultWeight: 700 }
];

/**
 * Default branding composition state.
 */
export const DEFAULT_COMPOSITION_STATE = {
  brandName: 'PIXNIVO',
  slogan: 'VISUAL INTELLIGENCE',
  fontFamily: 'Plus Jakarta Sans',
  brandFontSize: 52,
  sloganFontSize: 18,
  letterSpacing: 8,
  textColor: '#ffffff',
  sloganColor: '#94a3b8',
  accentColor: '#ff7a1a',
  layout: 'stacked', // 'stacked' | 'horizontal' | 'badge-arc'
  badgeFrame: 'circle-ring', // 'none' | 'circle-ring' | 'squircle' | 'shield' | 'hexagon'
  frameStroke: 6,
  shadow: true
};

/**
 * Helper to draw text with custom letter spacing (tracking) on HTML5 Canvas.
 */
export function drawTextWithSpacing(ctx, text, x, y, spacing = 0) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = text.split('');
  let totalWidth = 0;
  const charWidths = chars.map(c => {
    const w = ctx.measureText(c).width;
    totalWidth += w;
    return w;
  });
  totalWidth += (chars.length - 1) * spacing;

  let startX = x;
  if (ctx.textAlign === 'center') {
    startX = x - totalWidth / 2;
  } else if (ctx.textAlign === 'right') {
    startX = x - totalWidth;
  }

  // Draw character by character with tracking
  ctx.save();
  ctx.textAlign = 'left';
  let curX = startX;
  chars.forEach((c, i) => {
    ctx.fillText(c, curX, y);
    curX += charWidths[i] + spacing;
  });
  ctx.restore();
}

/**
 * Renders text curved along an arc path.
 */
export function drawCurvedText(ctx, text, centerX, centerY, radius, startAngle, endAngle, spacing = 4) {
  if (!text) return;

  const chars = text.split('');
  const totalAngle = endAngle - startAngle;
  const angleStep = totalAngle / Math.max(1, chars.length - 1);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  chars.forEach((char, i) => {
    const angle = startAngle + i * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2); // Rotate tangent to arc
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}

/**
 * Draws geometric badge frame container.
 */
export function drawBadgeFrame(ctx, shape, width, height, strokeWidth = 6, strokeColor = '#ff7a1a') {
  if (shape === 'none') return;

  const cx = width / 2;
  const cy = height / 2;
  const pad = 48;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.shadowColor = strokeColor + '66';
  ctx.shadowBlur = 18;

  if (shape === 'circle-ring') {
    const r = Math.min(width, height) / 2 - pad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle decorative concentric inner thin ring
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = strokeColor + '55';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 16, 0, Math.PI * 2);
    ctx.stroke();

  } else if (shape === 'squircle') {
    const w = width - pad * 2;
    const h = height - pad * 2;
    const x = pad;
    const y = pad;
    const radius = 80;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, [radius]);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();

  } else if (shape === 'shield') {
    const topY = pad + 10;
    const botY = height - pad - 10;
    const midY = (topY + botY) * 0.55;
    const leftX = pad + 20;
    const rightX = width - pad - 20;

    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(rightX, topY + 40);
    ctx.quadraticCurveTo(rightX, midY, cx, botY);
    ctx.quadraticCurveTo(leftX, midY, leftX, topY + 40);
    ctx.closePath();
    ctx.stroke();

  } else if (shape === 'hexagon') {
    const r = Math.min(width, height) / 2 - pad;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      const hx = cx + r * Math.cos(a);
      const hy = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Master Composition Renderer.
 * Renders the full brand composition (Badge Frame + Logo Mark + Brand Name + Slogan)
 * onto a target canvas at crisp native dimensions.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement|string} logoSource
 * @param {Object} compositionState
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Render metadata
 */
export async function renderComposition(canvas, logoSource, compositionState = {}, options = {}) {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Target canvas element is required');
  }

  const state = { ...DEFAULT_COMPOSITION_STATE, ...compositionState };
  const {
    background = 'transparent', // 'transparent' | 'checkers' | 'dark' | 'white' | 'gradient'
    clearCanvas = true
  } = options;

  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');

  if (clearCanvas) {
    ctx.clearRect(0, 0, width, height);
  }

  // 1. Background layer
  if (background === 'checkers') {
    drawCheckerboard(ctx, width, height);
  } else if (background === 'dark') {
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, width, height);
  } else if (background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else if (background === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#311042');
    grad.addColorStop(1, '#0a0814');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Badge Frame layer
  if (state.badgeFrame && state.badgeFrame !== 'none') {
    drawBadgeFrame(ctx, state.badgeFrame, width, height, state.frameStroke || 6, state.accentColor || '#ff7a1a');
  }

  // 3. Load Logo Mark
  let logoImg = null;
  if (logoSource) {
    logoImg = await loadImage(logoSource);
  }

  // 4. Layout Execution
  if (state.layout === 'horizontal') {
    // Horizontal Layout: Mark Left, Typography Right
    const markSize = Math.round(width * 0.38);
    const markX = Math.round(width * 0.08);
    const markY = Math.round((height - markSize) / 2);

    if (logoImg) {
      ctx.save();
      if (state.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
      }
      ctx.drawImage(logoImg, markX, markY, markSize, markSize);
      ctx.restore();
    }

    const textX = markX + markSize + 36;
    const textCenterY = height / 2;

    // Brand Name
    ctx.save();
    ctx.font = `800 ${state.brandFontSize}px "${state.fontFamily}", system-ui, sans-serif`;
    ctx.fillStyle = state.textColor || '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    drawTextWithSpacing(ctx, state.brandName.toUpperCase(), textX, textCenterY + 4, state.letterSpacing || 6);

    // Slogan
    if (state.slogan) {
      ctx.font = `600 ${state.sloganFontSize}px "${state.fontFamily}", system-ui, sans-serif`;
      ctx.fillStyle = state.sloganColor || '#94a3b8';
      ctx.textBaseline = 'top';
      drawTextWithSpacing(ctx, state.slogan.toUpperCase(), textX, textCenterY + 16, (state.letterSpacing || 6) * 0.6);
    }
    ctx.restore();

  } else if (state.layout === 'badge-arc') {
    // Badge Arc Layout: Mark Centered, Brand Name Curved on Top Arc, Slogan on Bottom
    const markSize = Math.round(width * 0.46);
    const markX = Math.round((width - markSize) / 2);
    const markY = Math.round((height - markSize) / 2);

    if (logoImg) {
      ctx.save();
      if (state.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
      }
      ctx.drawImage(logoImg, markX, markY, markSize, markSize);
      ctx.restore();
    }

    // Top Curved Arc Brand Name
    const arcRadius = width / 2 - 80;
    ctx.save();
    ctx.font = `800 ${Math.round(state.brandFontSize * 0.85)}px "${state.fontFamily}", system-ui, sans-serif`;
    ctx.fillStyle = state.textColor || '#ffffff';
    drawCurvedText(ctx, state.brandName.toUpperCase(), width / 2, height / 2, arcRadius, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.restore();

    // Bottom Slogan
    if (state.slogan) {
      ctx.save();
      ctx.font = `600 ${state.sloganFontSize}px "${state.fontFamily}", system-ui, sans-serif`;
      ctx.fillStyle = state.sloganColor || '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawTextWithSpacing(ctx, state.slogan.toUpperCase(), width / 2, height - 90, (state.letterSpacing || 6) * 0.8);
      ctx.restore();
    }

  } else {
    // Default 'stacked' Layout: Mark Top, Brand Name Below, Slogan Bottom
    const markSize = Math.round(width * 0.52);
    const markX = Math.round((width - markSize) / 2);
    const markY = Math.round(height * 0.1);

    if (logoImg) {
      ctx.save();
      if (state.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
      }
      ctx.drawImage(logoImg, markX, markY, markSize, markSize);
      ctx.restore();
    }

    const textStartY = markY + markSize + 56;

    // Brand Name
    ctx.save();
    ctx.font = `800 ${state.brandFontSize}px "${state.fontFamily}", system-ui, sans-serif`;
    ctx.fillStyle = state.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextWithSpacing(ctx, state.brandName.toUpperCase(), width / 2, textStartY, state.letterSpacing || 6);

    // Slogan
    if (state.slogan) {
      ctx.font = `600 ${state.sloganFontSize}px "${state.fontFamily}", system-ui, sans-serif`;
      ctx.fillStyle = state.sloganColor || '#94a3b8';
      ctx.textBaseline = 'middle';
      drawTextWithSpacing(ctx, state.slogan.toUpperCase(), width / 2, textStartY + 44, (state.letterSpacing || 6) * 0.8);
    }
    ctx.restore();
  }

  return {
    success: true,
    compositionState: state,
    width,
    height
  };
}

// Browser global attachment
if (typeof window !== 'undefined') {
  window.PixnivoCanvasStudio = {
    AVAILABLE_FONTS,
    DEFAULT_COMPOSITION_STATE,
    drawTextWithSpacing,
    drawCurvedText,
    drawBadgeFrame,
    renderComposition
  };
}
