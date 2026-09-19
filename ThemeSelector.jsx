/**
 * ==============================================================================
 * PIXNIVO THEME-DRIVEN AI LOGO GENERATOR — THEME SELECTOR COMPONENT
 * Module: Phase 2 (Theme Picker UI Component)
 * ==============================================================================
 * A responsive, high-aesthetic React component for selecting curated logo themes,
 * entering subject concepts with quick-pick chips, live prompt preview inspection,
 * and generating structured AI image generation payloads.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LOGO_THEMES,
  THEME_LIST,
  buildAIPrompt,
  sanitizeConceptInput
} from './themeDictionary.js';

// Fallback universal quick chips for fast testing
const DEFAULT_QUICK_CHIPS = [
  { label: 'Mountain Peak', icon: '🏔️' },
  { label: 'Cyber Falcon', icon: '🦅' },
  { label: 'Coffee Bean', icon: '☕' },
  { label: 'Fox Head', icon: '🦊' },
  { label: 'Origami Crane', icon: '🦢' },
  { label: 'Geometric Shield', icon: '🛡️' }
];

/**
 * Helper to convert hex colors to rgba with custom opacity.
 */
function hexToRgba(hex, alpha = 0.4) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(255, 122, 26, ${alpha})`;
  }
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * ThemeSelector Component
 *
 * @param {Object} props
 * @param {Function} props.onGenerate - Callback receiving the generated AI prompt payload.
 * @param {boolean} [props.isLoading=false] - Indicates active generation state.
 * @param {string} [props.initialConcept=''] - Initial text for the concept input.
 * @param {string} [props.initialThemeId='3d-glass-bubble'] - Initial theme selection.
 * @param {boolean} [props.compact=false] - Compact mode for narrow sidebars.
 * @param {string} [props.className=''] - Optional additional CSS class.
 * @param {Object} [props.style={}] - Optional inline styles.
 */
export function ThemeSelector({
  onGenerate,
  isLoading = false,
  initialConcept = '',
  initialThemeId = '3d-glass-bubble',
  compact = false,
  className = '',
  style = {}
}) {
  const [concept, setConcept] = useState(initialConcept);
  const [selectedThemeId, setSelectedThemeId] = useState(
    LOGO_THEMES[initialThemeId] ? initialThemeId : '3d-glass-bubble'
  );
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showNegative, setShowNegative] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputError, setInputError] = useState('');

  // Active theme definition
  const currentTheme = useMemo(() => {
    return LOGO_THEMES[selectedThemeId] || LOGO_THEMES['3d-glass-bubble'];
  }, [selectedThemeId]);

  // Merge theme-specific sample concepts with global quick chips
  const dynamicChips = useMemo(() => {
    const themeSamples = (currentTheme.sampleConcepts || []).map(sample => ({
      label: sample.charAt(0).toUpperCase() + sample.slice(1),
      icon: '✨'
    }));

    // Unique by lowercase label
    const map = new Map();
    [...themeSamples, ...DEFAULT_QUICK_CHIPS].forEach(item => {
      const key = item.label.toLowerCase();
      if (!map.has(key)) map.set(key, item);
    });

    return Array.from(map.values()).slice(0, 6);
  }, [currentTheme]);

  // Real-time engineered prompt payload calculation
  const promptPayload = useMemo(() => {
    const rawConcept = concept.trim() || 'your concept';
    try {
      return buildAIPrompt(rawConcept, selectedThemeId);
    } catch (e) {
      return null;
    }
  }, [concept, selectedThemeId]);

  // Clear validation error when user types
  const handleConceptChange = useCallback((e) => {
    const val = e.target.value;
    setConcept(val);
    if (inputError && val.trim()) {
      setInputError('');
    }
  }, [inputError]);

  // Quick chip click handler
  const handleChipClick = useCallback((chipLabel) => {
    setConcept(chipLabel);
    setInputError('');
  }, []);

  // Clear input
  const handleClear = useCallback(() => {
    setConcept('');
    setInputError('');
  }, []);

  // Copy prompt to clipboard
  const handleCopyPrompt = useCallback(() => {
    if (!promptPayload) return;
    navigator.clipboard.writeText(promptPayload.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
    });
  }, [promptPayload]);

  // Trigger generation
  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    const sanitized = sanitizeConceptInput(concept);

    if (!sanitized) {
      setInputError('Please enter a concept for your logo (e.g., "mountain peak" or "fox head")');
      return;
    }

    try {
      const payload = buildAIPrompt(sanitized, selectedThemeId);
      if (typeof onGenerate === 'function') {
        onGenerate(payload);
      }
    } catch (err) {
      setInputError(err.message || 'Failed to assemble prompt payload.');
    }
  }, [concept, selectedThemeId, onGenerate]);

  return (
    <div
      className={`px-theme-selector ${compact ? 'compact' : ''} ${className}`}
      style={style}
    >
      {/* 1. Header Area */}
      <div className="px-ts-header">
        <div className="px-ts-header-badge">
          <span>⚡</span>
          <span>Theme-Driven AI Engine</span>
        </div>
        <h3 className="px-ts-header-title">Logo Designer</h3>
        <p className="px-ts-header-sub">
          Choose an engineered aesthetic and type your core subject to generate a studio-grade asset.
        </p>
      </div>

      {/* 2. Core Concept Input */}
      <div className="px-ts-concept-group">
        <div className="px-ts-label-row">
          <label htmlFor="px-ts-concept-input" className="px-ts-label">
            <span>✨</span> Core Concept / Subject
          </label>
          <span className={`px-ts-char-count ${concept.length > 140 ? 'warning' : ''}`}>
            {concept.length} / 160
          </span>
        </div>

        <div className="px-ts-input-wrapper">
          <span className="px-ts-input-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            id="px-ts-concept-input"
            type="text"
            className="px-ts-input"
            placeholder="e.g. mountain peak, fox head, espresso cup, solar crest..."
            value={concept}
            maxLength={160}
            disabled={isLoading}
            onChange={handleConceptChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSubmit(e);
              }
            }}
          />
          {concept.length > 0 && !isLoading && (
            <button
              type="button"
              className="px-ts-clear-btn"
              onClick={handleClear}
              aria-label="Clear input"
              title="Clear input"
            >
              ✕
            </button>
          )}
        </div>

        {inputError && (
          <div className="px-ts-input-error">
            <span>⚠️</span> {inputError}
          </div>
        )}
      </div>

      {/* 3. Quick-Pick Concept Chips */}
      <div className="px-ts-chips-section">
        <div className="px-ts-chips-label">Quick Ideas</div>
        <div className="px-ts-chips-wrap">
          {dynamicChips.map((chip) => {
            const isActive = concept.trim().toLowerCase() === chip.label.toLowerCase();
            return (
              <button
                key={chip.label}
                type="button"
                className={`px-ts-chip ${isActive ? 'active' : ''}`}
                disabled={isLoading}
                onClick={() => handleChipClick(chip.label)}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Visual Theme Selection Cards Grid */}
      <div className="px-ts-theme-section">
        <div className="px-ts-theme-label-row">
          <span className="px-ts-theme-label">Visual Themes</span>
          <span className="px-ts-theme-counter">{THEME_LIST.length} Styles Available</span>
        </div>

        <div className="px-ts-grid" role="radiogroup" aria-label="Logo Visual Themes">
          {THEME_LIST.map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            const accentColor = theme.accentColor || '#ff7a1a';
            const glowRgba = hexToRgba(accentColor, 0.45);
            const glowSubtleRgba = hexToRgba(accentColor, 0.15);

            return (
              <div
                key={theme.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isLoading ? -1 : 0}
                className={`px-ts-card ${isSelected ? 'active' : ''}`}
                style={{
                  '--theme-accent': accentColor,
                  '--theme-glow': glowRgba,
                  '--theme-glow-subtle': glowSubtleRgba,
                  '--card-gradient': theme.thumbnailGradient || 'transparent'
                }}
                onClick={() => !isLoading && setSelectedThemeId(theme.id)}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !isLoading) {
                    e.preventDefault();
                    setSelectedThemeId(theme.id);
                  }
                }}
              >
                <div className="px-ts-card-top">
                  <div className="px-ts-card-icon-wrap">
                    {theme.icon?.svgPath ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d={theme.icon.svgPath} />
                      </svg>
                    ) : (
                      <span>🎨</span>
                    )}
                  </div>

                  <div className="px-ts-card-badge-wrap">
                    {theme.badge && (
                      <span className="px-ts-card-badge">{theme.badge}</span>
                    )}
                    {isSelected && (
                      <span className="px-ts-card-check" title="Selected">
                        ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-ts-card-body">
                  <h4 className="px-ts-card-name">{theme.name}</h4>
                  <span className="px-ts-card-category">{theme.category}</span>
                  <p className="px-ts-card-desc">{theme.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Collapsible Prompt Preview Accordion */}
      <div className="px-ts-preview-accordion">
        <button
          type="button"
          className="px-ts-accordion-toggle"
          onClick={() => setShowPromptPreview((prev) => !prev)}
          aria-expanded={showPromptPreview}
        >
          <div className="px-ts-accordion-toggle-left">
            <span>⚙️</span>
            <span>Engineered Prompt Preview</span>
            <span className="px-ts-preview-tag">Auto-Injected</span>
          </div>
          <span className={`px-ts-accordion-chevron ${showPromptPreview ? 'open' : ''}`}>
            ▼
          </span>
        </button>

        {showPromptPreview && (
          <div className="px-ts-accordion-body">
            <div className="px-ts-prompt-box">
              <span className="px-ts-prompt-prefix">
                {currentTheme.promptInjectors.prefix}{' '}
              </span>
              <span className="px-ts-prompt-concept">
                {concept.trim() ? sanitizeConceptInput(concept) : '[your concept]'}
              </span>
              <span className="px-ts-prompt-suffix">
                {currentTheme.promptInjectors.suffix}
              </span>
            </div>

            <div className="px-ts-prompt-actions">
              <div className="px-ts-model-params">
                <span className="px-ts-param-pill">
                  Scale: {currentTheme.modelParams.guidanceScale}
                </span>
                <span className="px-ts-param-pill">
                  Steps: {currentTheme.modelParams.steps}
                </span>
                <span className="px-ts-param-pill">
                  Size: 1024×1024 (1:1)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="px-ts-copy-btn"
                  onClick={() => setShowNegative((prev) => !prev)}
                >
                  {showNegative ? 'Hide Exclusions' : 'View Exclusions'}
                </button>
                <button
                  type="button"
                  className={`px-ts-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyPrompt}
                >
                  {copied ? '✓ Copied' : '📋 Copy Prompt'}
                </button>
              </div>
            </div>

            {showNegative && promptPayload && (
              <div className="px-ts-negative-box">
                <div className="px-ts-negative-title">Negative Exclusions:</div>
                <div>{promptPayload.negative_prompt}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Action Button CTA */}
      <div className="px-ts-action-area">
        <button
          type="button"
          className={`px-ts-btn-generate ${isLoading ? 'loading' : ''}`}
          disabled={isLoading || !concept.trim()}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <>
              <div className="px-ts-spinner" />
              <span>Synthesizing Canvas Asset...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>Generate AI Logo</span>
            </>
          )}
        </button>
        <p className="px-ts-disclaimer">
          Synthesizes a 1:1 high-resolution asset with transparent canvas background via Pixnivo AI.
        </p>
      </div>
    </div>
  );
}

export default ThemeSelector;

/**
 * Universal browser global attachment if loaded via script.
 */
if (typeof window !== 'undefined') {
  window.ThemeSelector = ThemeSelector;
}
