/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — COMPLETE LOGO PIPELINE
 * Module: Phase 3 (AgentRouter & Background Removal Pipeline)
 * ==============================================================================
 * Orchestrates the end-to-end flow:
 * 1. UI Payload ingestion (prompt, negative prompt, aspect ratio, theme config)
 * 2. AgentRouter API dispatch for studio image generation
 * 3. Background removal post-processing (RMBG / Feathered chroma isolation)
 * 4. Transparent PNG delivery & canvas injection
 */

import { removeBackground } from './backgroundRemover.js';
import { injectOntoCanvas } from './canvasInjector.js';
import { LOGO_THEMES, buildAIPrompt } from './themeDictionary.js';

/**
 * Default configuration for AgentRouter API.
 */
export const DEFAULT_PIPELINE_CONFIG = {
  // AgentRouter API Base Endpoint
  endpoint: 'https://api.agentrouter.ai/v1/images/generations',
  // Preferred generation model
  model: 'agentrouter/sdxl-turbo',
  // Timeout in milliseconds
  timeoutMs: 45000,
  // Automatically strip backgrounds from generated logos
  removeBackground: true,
  // Background removal engine ('auto' | 'rmbg' | 'canvas')
  bgRemovalEngine: 'auto',
  // Canvas placement settings
  canvasOptions: {
    fit: 'contain',
    padding: 0.12,
    clearCanvas: true,
    showCheckerboard: false,
    shadow: true
  }
};

/**
 * Generates an aesthetic high-resolution fallback logo canvas when
 * no AgentRouter API key is configured or offline/sandbox mode is requested.
 *
 * @param {Object} payload - Prompt payload from ThemeSelector / buildAIPrompt
 * @returns {string} High-res Data URL (1024x1024)
 */
export function generateSyntheticFallbackLogo(payload) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const themeId = payload.theme_id || '3d-glass-bubble';
  const theme = LOGO_THEMES[themeId] || LOGO_THEMES['3d-glass-bubble'];
  const concept = (payload.raw_concept || 'Logo').toUpperCase();
  const accentColor = theme.accentColor || '#ff7a1a';

  // Render solid background (to be cleanly isolated by background remover)
  ctx.fillStyle = themeId === 'cyberpunk-neon-glyph' ? '#08060f' : '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2, size / 2);

  // Outer ambient glow ring
  const glowGrad = ctx.createRadialGradient(0, 0, 100, 0, 0, 380);
  glowGrad.addColorStop(0, accentColor + '66');
  glowGrad.addColorStop(0.7, accentColor + '18');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 380, 0, Math.PI * 2);
  ctx.fill();

  // Emblem geometry based on theme
  if (themeId === '3d-glass-bubble') {
    // Glass bubble sphere with specular highlights
    const sphereGrad = ctx.createRadialGradient(-70, -80, 20, 0, 0, 240);
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.3, accentColor + 'dd');
    sphereGrad.addColorStop(0.85, '#3b82f6');
    sphereGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 240, 0, Math.PI * 2);
    ctx.fill();

    // Specular refraction curve
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(-50, -50, 160, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();

  } else if (themeId === 'architectural-brutalist') {
    // Brutalist isometric polyhedron
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -220);
    ctx.lineTo(200, -90);
    ctx.lineTo(0, 40);
    ctx.lineTo(-200, -90);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-200, -90);
    ctx.lineTo(0, 40);
    ctx.lineTo(0, 220);
    ctx.lineTo(-200, 90);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(200, -90);
    ctx.lineTo(0, 40);
    ctx.lineTo(0, 220);
    ctx.lineTo(200, 90);
    ctx.closePath();
    ctx.fill();

  } else if (themeId === 'minimalist-flat-vector') {
    // Negative space minimalist geometry
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 230, 0, Math.PI * 2);
    ctx.fill();

    // Clean negative space cutout
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -140);
    ctx.lineTo(130, 90);
    ctx.lineTo(-130, 90);
    ctx.closePath();
    ctx.fill();

  } else if (themeId === 'cyberpunk-neon-glyph') {
    // Cyberpunk neon wireframe
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 18;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.moveTo(0, -200);
    ctx.lineTo(170, 0);
    ctx.lineTo(90, 0);
    ctx.lineTo(140, 190);
    ctx.lineTo(-60, 20);
    ctx.lineTo(20, 20);
    ctx.closePath();
    ctx.stroke();

  } else {
    // 3D Claymorphism / Geometric
    const clayGrad = ctx.createLinearGradient(-180, -180, 180, 180);
    clayGrad.addColorStop(0, '#f472b6');
    clayGrad.addColorStop(1, accentColor);
    ctx.fillStyle = clayGrad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-190, -190, 380, 380, [80]) : ctx.rect(-190, -190, 380, 380);
    ctx.fill();
  }

  // Centered concept emblem text
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = themeId === 'minimalist-flat-vector' ? accentColor : '#ffffff';
  ctx.font = '800 48px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '4px';

  // Clean, truncated concept monogram
  const cleanWords = concept.split(' ').slice(0, 2).join(' ');
  ctx.fillText(cleanWords, 0, 10);

  ctx.restore();
  return canvas.toDataURL('image/png');
}

/**
 * Dispatches an AI image generation request to the AgentRouter endpoint.
 *
 * @param {Object} payload - Assembled prompt payload
 * @param {Object} [config={}] - Pipeline API config
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<string>} URL or Data URL of the generated image
 */
export async function dispatchAgentRouterGeneration(payload, config = {}, onProgress) {
  const mergedConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  const apiKey = mergedConfig.apiKey || (typeof window !== 'undefined' && window.AGENTROUTER_API_KEY) || '';

  // If no API key is set or sandbox/demo mode is active, use synthetic high-fidelity generator
  if (!apiKey || mergedConfig.sandbox || mergedConfig.demoMode) {
    if (onProgress) onProgress({ stage: 'synthesizing_preview', progress: 0.35 });
    // Simulate generation delay
    await new Promise(r => setTimeout(r, 900));
    return generateSyntheticFallbackLogo(payload);
  }

  if (onProgress) onProgress({ stage: 'dispatching_agentrouter', progress: 0.25 });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeoutMs);

  const requestBody = {
    model: mergedConfig.model,
    prompt: payload.prompt,
    negative_prompt: payload.negative_prompt,
    aspect_ratio: payload.aspect_ratio || '1:1',
    width: payload.width || 1024,
    height: payload.height || 1024,
    guidance_scale: payload.guidance_scale || 7.5,
    steps: payload.steps || 30,
    n: 1,
    response_format: 'b64_json'
  };

  try {
    const response = await fetch(mergedConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Client': 'Pixnivo-Logo-Designer/1.0'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AgentRouter API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();

    if (onProgress) onProgress({ stage: 'receiving_asset', progress: 0.5 });

    // Handle standard AgentRouter / OpenAI response formats
    if (data.data && data.data[0]) {
      const item = data.data[0];
      if (item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
      }
      if (item.url) {
        return item.url;
      }
    }

    if (data.image) {
      return data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
    }

    throw new Error('AgentRouter response did not contain expected image data.');
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[AgentRouter Dispatch Error]', err);

    // If API call fails, provide graceful fallback so workflow is never blocked
    if (mergedConfig.allowFallback !== false) {
      console.warn('[PIXNIVO] Falling back to high-res synthesized canvas asset...');
      return generateSyntheticFallbackLogo(payload);
    }
    throw err;
  }
}

/**
 * Master Pipeline: Generates, Isolates Transparency, and Injects onto Canvas.
 *
 * @param {Object} options
 * @param {Object} options.payload - Prompt payload from ThemeSelector
 * @param {HTMLCanvasElement} [options.targetCanvas] - Canvas element to inject onto
 * @param {Object} [options.apiConfig] - AgentRouter credentials and settings
 * @param {boolean} [options.removeBackground=true] - Run background removal step
 * @param {string} [options.bgRemovalEngine='auto'] - 'auto' | 'rmbg' | 'canvas'
 * @param {Function} [options.onProgress] - Progress listener ({ stage, progress })
 * @returns {Promise<Object>} Execution result with asset URLs and telemetry
 */
export async function generateAndProcessLogo(options = {}) {
  const startTime = Date.now();
  const {
    payload,
    targetCanvas = null,
    apiConfig = {},
    removeBackground: shouldRemoveBg = true,
    bgRemovalEngine = 'auto',
    canvasOptions = {},
    onProgress = null
  } = options;

  if (!payload || !payload.prompt) {
    throw new Error('Valid logo prompt payload is required to execute pipeline.');
  }

  const timings = {
    start: startTime,
    generationMs: 0,
    bgRemovalMs: 0,
    canvasInjectionMs: 0,
    totalMs: 0
  };

  // Step 1: Dispatch to AgentRouter
  if (onProgress) onProgress({ stage: 'generating', progress: 0.15, message: 'Synthesizing theme-engineered logo...' });
  const genStart = Date.now();
  const rawImageUrl = await dispatchAgentRouterGeneration(payload, apiConfig, onProgress);
  timings.generationMs = Date.now() - genStart;

  let transparentDataUrl = rawImageUrl;
  let transparentBlob = null;
  let bgEngineUsed = 'none';

  // Step 2: Background Removal Post-Processing
  if (shouldRemoveBg) {
    if (onProgress) onProgress({ stage: 'isolating_background', progress: 0.6, message: 'Isolating transparent canvas asset...' });
    const bgStart = Date.now();
    try {
      const bgResult = await removeBackground(rawImageUrl, {
        engine: bgRemovalEngine,
        onProgress: (p) => {
          if (onProgress) onProgress({ stage: p.stage, progress: 0.6 + p.progress * 0.3 });
        }
      });
      transparentDataUrl = bgResult.dataUrl;
      transparentBlob = bgResult.blob;
      bgEngineUsed = bgResult.engineUsed;
      timings.bgRemovalMs = Date.now() - bgStart;
    } catch (bgErr) {
      console.warn('[PIXNIVO] Background removal encountered issue, using raw asset:', bgErr);
    }
  }

  // Step 3: Inject onto Canvas if target canvas is provided
  let canvasInjectionResult = null;
  if (targetCanvas && typeof HTMLCanvasElement !== 'undefined' && targetCanvas instanceof HTMLCanvasElement) {
    if (onProgress) onProgress({ stage: 'injecting_canvas', progress: 0.95, message: 'Placing logo onto artboard canvas...' });
    const injectStart = Date.now();
    canvasInjectionResult = await injectOntoCanvas(targetCanvas, transparentDataUrl, {
      ...DEFAULT_PIPELINE_CONFIG.canvasOptions,
      ...canvasOptions
    });
    timings.canvasInjectionMs = Date.now() - injectStart;
  }

  timings.totalMs = Date.now() - startTime;
  if (onProgress) onProgress({ stage: 'complete', progress: 1.0, message: 'Logo successfully placed on canvas!' });

  return {
    success: true,
    themeId: payload.theme_id,
    themeName: payload.theme_name,
    concept: payload.raw_concept,
    prompt: payload.prompt,
    negativePrompt: payload.negative_prompt,
    rawImageUrl,
    transparentDataUrl,
    transparentBlob,
    timings,
    engine: {
      generation: apiConfig.apiKey ? 'agentrouter' : 'synthetic_preview',
      backgroundRemoval: bgEngineUsed
    },
    canvasInjected: Boolean(canvasInjectionResult),
    canvasDetails: canvasInjectionResult
  };
}

// Browser global attachment
if (typeof window !== 'undefined') {
  window.PixnivoLogoPipeline = {
    DEFAULT_PIPELINE_CONFIG,
    generateSyntheticFallbackLogo,
    dispatchAgentRouterGeneration,
    generateAndProcessLogo
  };
}
