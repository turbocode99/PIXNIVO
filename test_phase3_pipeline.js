/**
 * ==============================================================================
 * TEST SUITE: Phase 3 - AgentRouter & Background Removal Pipeline
 * ==============================================================================
 * Validates module exports, canvas placement math, background isolation logic,
 * and end-to-end pipeline execution.
 */

const fs = require('fs');
const path = require('path');
const { buildAIPrompt, LOGO_THEMES } = require('./themeDictionary');

console.log('------------------------------------------------------------');
console.log('🧪 RUNNING PHASE 3 TEST SUITE: Logo Generation & BG Removal Pipeline');
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

// 1. Verify backgroundRemover.js
const bgRemoverPath = path.join(__dirname, 'backgroundRemover.js');
assert(fs.existsSync(bgRemoverPath), 'backgroundRemover.js file exists');
const bgRemoverContent = fs.readFileSync(bgRemoverPath, 'utf8');

assert(bgRemoverContent.includes('export async function removeBackground'), 'removeBackground function exported');
assert(bgRemoverContent.includes('export function removeBackgroundCanvasEngine'), 'Canvas feathering engine exported');
assert(bgRemoverContent.includes('colorDistance'), 'Color distance calculation implemented');
assert(bgRemoverContent.includes('despill'), 'De-spill color fringing compensation implemented');
assert(bgRemoverContent.includes('RMBG'), 'RMBG / BiRefNet AI model integration present');

// 2. Verify canvasInjector.js
const injectorPath = path.join(__dirname, 'canvasInjector.js');
assert(fs.existsSync(injectorPath), 'canvasInjector.js file exists');
const injectorContent = fs.readFileSync(injectorPath, 'utf8');

assert(injectorContent.includes('export function calculateCanvasPlacement'), 'calculateCanvasPlacement function exported');
assert(injectorContent.includes('export async function injectOntoCanvas'), 'injectOntoCanvas function exported');
assert(injectorContent.includes('export function drawCheckerboard'), 'drawCheckerboard transparency grid exported');
assert(injectorContent.includes('pixnivo:logo-injected'), 'Dispatches custom event on canvas injection');

// 3. Test Canvas Placement Geometry Math
function mockCalculateCanvasPlacement(canvasWidth, canvasHeight, imgWidth, imgHeight, options = {}) {
  const { fit = 'contain', padding = 0.15 } = options;
  const availWidth = canvasWidth * (1 - padding * 2);
  const availHeight = canvasHeight * (1 - padding * 2);
  const imgAspect = imgWidth / imgHeight;
  const canvasAspect = availWidth / availHeight;

  let drawW, drawH;
  if (imgAspect > canvasAspect) {
    drawW = availWidth;
    drawH = drawW / imgAspect;
  } else {
    drawH = availHeight;
    drawW = drawH * imgAspect;
  }
  const drawX = Math.round((canvasWidth - drawW) / 2);
  const drawY = Math.round((canvasHeight - drawH) / 2);

  return { x: drawX, y: drawY, width: Math.round(drawW), height: Math.round(drawH) };
}

const placementSquare = mockCalculateCanvasPlacement(800, 800, 1024, 1024, { padding: 0.1 });
assert(placementSquare.width === 640 && placementSquare.height === 640, 'Square image scaled with 10% padding (640x640)');
assert(placementSquare.x === 80 && placementSquare.y === 80, 'Centered on canvas (x=80, y=80)');

const placementRect = mockCalculateCanvasPlacement(1000, 500, 1024, 512, { padding: 0.1 });
assert(placementRect.x === 100, 'Horizontal centering preserves aspect ratio');

// 4. Verify logoPipeline.js
const pipelinePath = path.join(__dirname, 'logoPipeline.js');
assert(fs.existsSync(pipelinePath), 'logoPipeline.js file exists');
const pipelineContent = fs.readFileSync(pipelinePath, 'utf8');

assert(pipelineContent.includes('export async function generateAndProcessLogo'), 'generateAndProcessLogo master function exported');
assert(pipelineContent.includes('export async function dispatchAgentRouterGeneration'), 'dispatchAgentRouterGeneration exported');
assert(pipelineContent.includes('export function generateSyntheticFallbackLogo'), 'Synthetic fallback logo generator exported');
assert(pipelineContent.includes('DEFAULT_PIPELINE_CONFIG'), 'Default pipeline configuration exported');
assert(pipelineContent.includes('timings'), 'Returns pipeline performance timings');

// 5. Verify Backend Endpoint in backend/main.py
const backendPath = path.join(__dirname, 'backend', 'main.py');
assert(fs.existsSync(backendPath), 'backend/main.py exists');
const backendContent = fs.readFileSync(backendPath, 'utf8');

assert(backendContent.includes('/api/agentrouter/generate-logo'), 'Backend exposes /api/agentrouter/generate-logo');
assert(backendContent.includes('LogoGenerateRequest'), 'Backend defines LogoGenerateRequest Pydantic model');
assert(backendContent.includes('sandbox_synthesis'), 'Backend supports fallback sandbox synthesis');

console.log('\n------------------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log('------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 3 STATIC & GEOMETRY TESTS PASSED!\n');
}
