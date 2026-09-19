/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — THEME DICTIONARY & PROMPT BUILDER
 * Module: Phase 1 (Theme Configuration & Prompt Builder)
 * ==============================================================================
 * Defines curated logo aesthetics, prompt injectors, style exclusions (negative prompts),
 * and an industrial-grade `buildAIPrompt` pipeline optimized for modern AI image models.
 */

/**
 * Universal Negative Prompt baseline applied to all logo generation requests.
 * Eliminates standard generative flaws: typography hallucinations, artifacts,
 * signatures, watermarks, raster degradation, and off-center layouts.
 */
export const BASELINE_LOGO_NEGATIVE_PROMPT = [
  'text',
  'words',
  'letters',
  'typography',
  'font',
  'slogan',
  'motto',
  'watermark',
  'signature',
  'photorealistic human face',
  'deformed',
  'blurry',
  'raster noise',
  'jpeg artifacts',
  'low resolution',
  'cropped edges',
  'out of frame',
  'complex photographic background',
  'unwanted shadows',
  'grainy'
].join(', ');

/**
 * Curated dictionary of visual logo themes with specialized prompt injectors.
 */
export const LOGO_THEMES = {
  '3d-glass-bubble': {
    id: '3d-glass-bubble',
    name: '3D Glass Bubble',
    badge: 'Trending',
    category: '3D & Glassmorphism',
    description: 'Luminous frosted glass icon with refraction, specular highlights, and internal glow.',
    accentColor: '#06b6d4',
    icon: {
      type: 'svg',
      svgPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(147,51,234,0.3) 100%)',
    sampleConcepts: ['fox head', 'origami bird', 'mountain peak', 'infinity loop'],
    promptInjectors: {
      prefix: 'Professional 3D logo icon of',
      suffix: ', translucent frosted glass material, soft refraction, internal glow, soft edge thickness, subtle chromatic dispersion, pristine specular highlights, studio lighting, centered, no text, clean seamless solid background, 8k render, octane render style'
    },
    negativePrompt: 'flat vector, rough matte finish, sketch, messy reflections, high grain, dirty glass, fingerprints, text, letters, complex scene, photorealistic scenery',
    modelParams: {
      guidanceScale: 7.5,
      steps: 30,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  },

  'architectural-brutalist': {
    id: 'architectural-brutalist',
    name: 'Architectural / Brutalist',
    badge: 'Modern',
    category: 'Vector & Geometry',
    description: 'High-contrast geometric blueprint with sharp intersecting angles and structural balance.',
    accentColor: '#f97316',
    icon: {
      type: 'svg',
      svgPath: 'M3 3h18v18H3zm4 4v10h10V7zm2 2h6v6H9z'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(15,23,42,0.6) 100%)',
    sampleConcepts: ['bridge arch', 'abstract pillar', 'falcon crest', 'monolith'],
    promptInjectors: {
      prefix: 'Minimalist architectural logo of',
      suffix: ', geometric blueprint style, sharp intersecting angles, high contrast, flat vector, brutalist line-art, grid-aligned, isometric precision, bold structural silhouette, scalable SVG look, stark monochrome with subtle warm accent, centered, pure white background'
    },
    negativePrompt: '3D glossy render, organic curves, soft round bubbles, hand-drawn sketch, shadows, realistic photo, gradients, colorful noise, text, typography, letters, handwriting',
    modelParams: {
      guidanceScale: 8.0,
      steps: 28,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  },

  '3d-claymorphism': {
    id: '3d-claymorphism',
    name: '3D Claymorphism / Matte',
    badge: 'Popular',
    category: '3D & Tactile',
    description: 'Soft-touch rubberized clay icon with smooth bevels and warm pastel studio illumination.',
    accentColor: '#ec4899',
    icon: {
      type: 'svg',
      svgPath: 'M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 20.3a1 1 0 0 0 1.35 1.35l2.69-.62A8.95 8.95 0 0 0 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(249,115,22,0.3) 100%)',
    sampleConcepts: ['coffee cup', 'rocket ship', 'smiling cloud', 'shield emblem'],
    promptInjectors: {
      prefix: 'Modern 3D logo icon of',
      suffix: ', soft-touch rubber material, matte finish, soft clay render, subtle bevel, soft shadow, pastel studio lighting, minimal extrusion, tactile smooth surface, centered composition, clean seamless solid background, blender 3d style'
    },
    negativePrompt: 'glass, reflection, glossy mirror finish, metallic chrome, sharp dangerous spikes, photographic realism, text, letters, watermark, rough noisy texture, clutter',
    modelParams: {
      guidanceScale: 7.0,
      steps: 30,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  },

  'minimalist-flat-vector': {
    id: 'minimalist-flat-vector',
    name: 'Minimalist Flat Vector',
    badge: 'Timeless',
    category: 'Minimalist & Monoline',
    description: 'Negative-space icon with clean monoline curves, simple geometry, and crisp contours.',
    accentColor: '#10b981',
    icon: {
      type: 'svg',
      svgPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(6,182,212,0.25) 100%)',
    sampleConcepts: ['mountain peak', 'wolf silhouette', 'leaf crest', 'digital anchor'],
    promptInjectors: {
      prefix: 'Iconic flat vector logo of',
      suffix: ', negative space style, simple geometry, limited harmonious color palette, clean monoline, crisp edges, simple closed shape, golden ratio proportions, modern app icon aesthetic, white background, scalable vector look'
    },
    negativePrompt: '3D, realistic, photo, glossy, metallic, complex gradients, dropshadow, bevel, noisy background, text, font, typography, watermark, sketch, pencil lines',
    modelParams: {
      guidanceScale: 8.5,
      steps: 28,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  },

  'geometric-origami': {
    id: 'geometric-origami',
    name: 'Geometric Origami Gradient',
    badge: 'Vibrant',
    category: 'Vector & Geometry',
    description: 'Faceted polygonal planes with smooth jewel-tone gradient folds and razor-sharp crease lines.',
    accentColor: '#8b5cf6',
    icon: {
      type: 'svg',
      svgPath: 'M12 2L4 12l8 10 8-10L12 2zm0 3.8l5.2 6.2H6.8L12 5.8z'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(236,72,153,0.3) 100%)',
    sampleConcepts: ['hummingbird', 'diamond crest', 'phoenix', 'lotus flower'],
    promptInjectors: {
      prefix: 'Modern geometric origami logo mark of',
      suffix: ', clean faceted polygon planes, sharp creased folds, vibrant jewel-tone color gradient, precision angled vector aesthetic, paper craft inspired minimalism, crisp edges, pure clean background, vector emblem'
    },
    negativePrompt: 'curved organic blobs, photographic realism, photoreal face, messy strokes, shadows, text, letters, watermark, blurry lines, noisy paper texture',
    modelParams: {
      guidanceScale: 7.5,
      steps: 30,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  },

  'cyberpunk-neon-glyph': {
    id: 'cyberpunk-neon-glyph',
    name: 'Cyberpunk Neon Glyph',
    badge: 'Futuristic',
    category: 'Modern & Dark',
    description: 'Electroluminescent wireframe emblem with vibrant neon edge glow on dark contrast.',
    accentColor: '#a855f7',
    icon: {
      type: 'svg',
      svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
    },
    thumbnailGradient: 'linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(6,182,212,0.35) 100%)',
    sampleConcepts: ['cyber skull', 'circuit lion', 'quantum core', 'delta wing'],
    promptInjectors: {
      prefix: 'Futuristic glowing logo emblem of',
      suffix: ', radiant neon wireframe, electric cyber lines, sleek dark tech aesthetic, luminous edge glow, high-tech glyph, centered on solid deep dark backdrop, vector precision, razor sharp contours'
    },
    negativePrompt: 'vintage retro, watercolor, pastel, muddy colors, realistic human photo, grunge, noisy raster, text, typography, letters, watermark',
    modelParams: {
      guidanceScale: 8.0,
      steps: 32,
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    }
  }
};

/**
 * Array view of all available logo themes for easy mapping in React UI components.
 */
export const THEME_LIST = Object.values(LOGO_THEMES);

/**
 * Sanitizes user input to prevent prompt injections, control sequences,
 * and unbalanced punctuation while preserving artistic intent.
 *
 * @param {string} input - Raw user concept input.
 * @returns {string} Cleaned, safe concept string.
 */
export function sanitizeConceptInput(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    // Strip common prompt injection control markers and bracketed instructions
    .replace(/(?:system\s*:|\[\/?inst\]|<\/?inst>|<\|im_start\|>|<\|im_end\|>|ignore\s+previous\s+instructions|system\s+prompt\s*:)/gi, '')
    // Remove control characters and non-printable characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Collapse multiple spaces or commas
    .replace(/\s+/g, ' ')
    .replace(/,{2,}/g, ',')
    .trim()
    // Enforce reasonable length constraint for logo concepts
    .slice(0, 160);
}

/**
 * Builds an optimized, comprehensive AI prompt payload for a selected theme.
 *
 * @param {string} userInput - The user's core concept (e.g. "mountain peak", "fox head").
 * @param {string} themeId - The identifier of the theme in `LOGO_THEMES`.
 * @param {Object} [overrides={}] - Optional overrides for model parameters or prompt adjustments.
 * @returns {Object} Structured payload optimized for image generation APIs.
 */
export function buildAIPrompt(userInput, themeId = '3d-glass-bubble', overrides = {}) {
  const sanitizedConcept = sanitizeConceptInput(userInput);

  if (!sanitizedConcept) {
    throw new Error('Please provide a concept for your logo (e.g., "mountain peak" or "fox head").');
  }

  const theme = LOGO_THEMES[themeId] || LOGO_THEMES['3d-glass-bubble'];

  const { prefix, suffix } = theme.promptInjectors;

  // Cleanly concatenate: prefix + sanitized concept + suffix
  const rawPrompt = `${prefix} ${sanitizedConcept}${suffix}`
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Combine baseline exclusions with theme-specific exclusions
  const negativePrompt = [
    BASELINE_LOGO_NEGATIVE_PROMPT,
    theme.negativePrompt || ''
  ]
    .filter(Boolean)
    .join(', ');

  const modelParams = {
    ...theme.modelParams,
    ...(overrides.modelParams || {})
  };

  return {
    prompt: rawPrompt,
    negative_prompt: negativePrompt,
    theme_id: theme.id,
    theme_name: theme.name,
    raw_concept: sanitizedConcept,
    aspect_ratio: modelParams.aspectRatio || '1:1',
    width: modelParams.width || 1024,
    height: modelParams.height || 1024,
    guidance_scale: modelParams.guidanceScale || 7.5,
    steps: modelParams.steps || 30,
    seed: overrides.seed !== undefined ? overrides.seed : null,
    metadata: {
      generatedBy: 'PIXNIVO Theme-Driven AI Logo Generator',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Universal export fallback for CommonJS / Node environments.
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LOGO_THEMES,
    THEME_LIST,
    BASELINE_LOGO_NEGATIVE_PROMPT,
    sanitizeConceptInput,
    buildAIPrompt
  };
}

/**
 * Universal browser global attachment.
 */
if (typeof window !== 'undefined') {
  window.PixnivoThemes = {
    LOGO_THEMES,
    THEME_LIST,
    BASELINE_LOGO_NEGATIVE_PROMPT,
    sanitizeConceptInput,
    buildAIPrompt
  };
}

