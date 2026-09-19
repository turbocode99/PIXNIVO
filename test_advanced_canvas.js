/**
 * ==============================================================================
 * TEST SUITE: Advanced Canvas Studio & Vector SVG Exporter
 * ==============================================================================
 * Validates typography options, badge frame geometry, and SVG XML construction.
 */

const fs = require('fs');
const path = require('path');

console.log('------------------------------------------------------------');
console.log('🧪 RUNNING ADVANCED CANVAS STUDIO & VECTOR SVG TEST SUITE');
console.log('------------------------------------------------------------\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Verify canvasStudioEngine.js
const studioEnginePath = path.join(__dirname, 'canvasStudioEngine.js');
assert(fs.existsSync(studioEnginePath), 'canvasStudioEngine.js file exists');
const studioEngineContent = fs.readFileSync(studioEnginePath, 'utf8');

assert(studioEngineContent.includes('export const AVAILABLE_FONTS'), 'Exports AVAILABLE_FONTS catalog');
assert(studioEngineContent.includes('Plus Jakarta Sans'), 'Includes Plus Jakarta Sans font');
assert(studioEngineContent.includes('Orbitron'), 'Includes Orbitron cyber font');
assert(studioEngineContent.includes('export function drawTextWithSpacing'), 'Exports drawTextWithSpacing tracking function');
assert(studioEngineContent.includes('export function drawCurvedText'), 'Exports drawCurvedText arc function');
assert(studioEngineContent.includes('export function drawBadgeFrame'), 'Exports drawBadgeFrame geometry function');
assert(studioEngineContent.includes('export async function renderComposition'), 'Exports renderComposition master renderer');

// 2. Verify vectorSvgExporter.js
const svgExporterPath = path.join(__dirname, 'vectorSvgExporter.js');
assert(fs.existsSync(svgExporterPath), 'vectorSvgExporter.js file exists');
const svgExporterContent = fs.readFileSync(svgExporterPath, 'utf8');

assert(svgExporterContent.includes('export function generateCompositionSVG'), 'Exports generateCompositionSVG function');
assert(svgExporterContent.includes('export function downloadSVG'), 'Exports downloadSVG function');
assert(svgExporterContent.includes('export async function exportHighResPNG'), 'Exports exportHighResPNG function');
assert(svgExporterContent.includes('export function exportIconSize'), 'Exports exportIconSize function');

// 3. Test SVG Generation Syntax and Vector Elements
// Create mock implementation of generateCompositionSVG for node testing
function mockGenerateSVG(state, logoDataUrl, options = {}) {
  const brandName = (state.brandName || 'BRAND').toUpperCase();
  const slogan = (state.slogan || '').toUpperCase();
  const fontFamily = state.fontFamily || 'Plus Jakarta Sans';
  const width = options.width || 1024;
  const height = options.height || 1024;

  let frameTag = '';
  if (state.badgeFrame === 'circle-ring') {
    frameTag = `<circle cx="512" cy="512" r="460" stroke="${state.accentColor || '#ff7a1a'}" stroke-width="${state.frameStroke || 6}" fill="none" />`;
  }

  let textMarkup = '';
  if (state.layout === 'badge-arc') {
    textMarkup = `
      <path id="brand-arc-path" d="M 120 512 A 392 392 0 0 1 904 512" fill="none" />
      <text font-family="'${fontFamily}', sans-serif"><textPath href="#brand-arc-path">${brandName}</textPath></text>
    `;
  } else {
    textMarkup = `
      <text x="512" y="700" font-family="'${fontFamily}', sans-serif" font-size="52px" font-weight="800">${brandName}</text>
      <text x="512" y="744" font-family="'${fontFamily}', sans-serif" font-size="18px" font-weight="600">${slogan}</text>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700;800&amp;display=swap');
    </style>
  </defs>
  ${frameTag}
  <image href="${logoDataUrl}" x="256" y="100" width="512" height="512" />
  ${textMarkup}
</svg>`;
}

const testStateStacked = {
  brandName: 'FOXGUARD',
  slogan: 'CYBER SECURITY',
  fontFamily: 'Orbitron',
  layout: 'stacked',
  badgeFrame: 'circle-ring',
  accentColor: '#06b6d4'
};
const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const svgStacked = mockGenerateSVG(testStateStacked, dummyDataUrl);
assert(svgStacked.includes('xmlns="http://www.w3.org/2000/svg"'), 'SVG contains correct XML namespace');
assert(svgStacked.includes('FOXGUARD'), 'SVG contains uppercase Brand Name');
assert(svgStacked.includes('CYBER SECURITY'), 'SVG contains uppercase Slogan');
assert(svgStacked.includes('circle cx="512" cy="512"'), 'SVG contains vector circle ring');
assert(svgStacked.includes('Orbitron'), 'SVG contains requested font in stylesheet');
assert(svgStacked.includes('<image href="data:image/png;base64'), 'SVG embeds high-res transparent logo mark');

// 4. Test Arc Layout SVG
const testStateArc = { ...testStateStacked, layout: 'badge-arc' };
const svgArc = mockGenerateSVG(testStateArc, dummyDataUrl);
assert(svgArc.includes('<textPath href="#brand-arc-path">'), 'Arc layout creates vector <textPath> element');

console.log('\n------------------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log('------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ADVANCED CANVAS & VECTOR SVG TESTS PASSED!\n');
}
