/**
 * ==============================================================================
 * TEST SUITE: Phase 2 - ThemeSelector React Component & Styling
 * ==============================================================================
 * Validates component exports, CSS structure, and end-to-end prompt payload
 * emission for all curated themes.
 */

const fs = require('fs');
const path = require('path');
const { LOGO_THEMES, THEME_LIST, buildAIPrompt, sanitizeConceptInput } = require('./themeDictionary');

console.log('------------------------------------------------------------');
console.log('🧪 RUNNING PHASE 2 TEST SUITE: ThemeSelector Component');
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

// 1. Verify ThemeSelector.jsx exists and has valid React imports and exports
const jsxPath = path.join(__dirname, 'ThemeSelector.jsx');
assert(fs.existsSync(jsxPath), 'ThemeSelector.jsx file exists');
const jsxContent = fs.readFileSync(jsxPath, 'utf8');

assert(jsxContent.includes('export function ThemeSelector'), 'ThemeSelector named export exists');
assert(jsxContent.includes('export default ThemeSelector'), 'ThemeSelector default export exists');
assert(jsxContent.includes('buildAIPrompt'), 'Uses buildAIPrompt from themeDictionary');
assert(jsxContent.includes('onGenerate'), 'Implements onGenerate prop callback');
assert(jsxContent.includes('isLoading'), 'Supports isLoading state with spinner');
assert(jsxContent.includes('Quick Ideas'), 'Contains quick concept chips section');
assert(jsxContent.includes('Engineered Prompt Preview'), 'Contains prompt preview accordion');

// 2. Verify ThemeSelector.css exists and contains key classes
const cssPath = path.join(__dirname, 'ThemeSelector.css');
assert(fs.existsSync(cssPath), 'ThemeSelector.css file exists');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('.px-theme-selector'), 'Contains root .px-theme-selector class');
assert(cssContent.includes('.px-ts-card.active'), 'Contains .px-ts-card.active class with theme glow');
assert(cssContent.includes('--theme-accent'), 'Uses dynamic CSS variable for theme accent color');
assert(cssContent.includes('.px-ts-btn-generate'), 'Contains .px-ts-btn-generate CTA button class');
assert(cssContent.includes('@media (max-width: 640px)'), 'Includes mobile responsive breakpoints');

// 3. Test payload emission for each theme
THEME_LIST.forEach(theme => {
  const concept = 'mountain peak';
  const payload = buildAIPrompt(concept, theme.id);
  assert(payload.theme_id === theme.id, `Theme ID correctly assigned for ${theme.name}`);
  assert(payload.prompt.includes(concept), `Prompt contains concept for ${theme.name}`);
  assert(payload.negative_prompt.length > 50, `Negative exclusions populated for ${theme.name}`);
  assert(payload.width === 1024 && payload.height === 1024, `Dimensions 1024x1024 for ${theme.name}`);
  assert(payload.aspect_ratio === '1:1', `Aspect ratio 1:1 for ${theme.name}`);
});

// 4. Test quick chips concept matching
const testChips = ['Mountain Peak', 'Cyber Falcon', 'Coffee Bean', 'Fox Head'];
testChips.forEach(chip => {
  const sanitized = sanitizeConceptInput(chip);
  const payload = buildAIPrompt(sanitized, '3d-glass-bubble');
  assert(payload.prompt.toLowerCase().includes(sanitized.toLowerCase()), `Payload correctly handles quick chip "${chip}"`);
});

// 5. Verify error throwing on blank concept
let errorCaught = false;
try {
  buildAIPrompt('', '3d-glass-bubble');
} catch (e) {
  errorCaught = true;
}
assert(errorCaught, 'buildAIPrompt rejects empty concept string as expected');

console.log('\n------------------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log('------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 2 AUTOMATED CHECKS PASSED PERFECTLY!\n');
}
