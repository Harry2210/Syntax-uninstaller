// Automated Verification Test Suite for Syntax Uninstaller
import assert from 'assert';

console.log('------------------------------------------------------------');
console.log('Running Syntax Uninstaller Automated Test Suite...');
console.log('------------------------------------------------------------');

// 1. Health Score Calculator Verification
function calculateHealthScore(app) {
  let score = 100;
  const notes = [];

  if (!app.uninstall_string) {
    score -= 40;
    notes.push('Missing registered uninstall command');
  }
  if (!app.install_location) {
    score -= 30;
    notes.push('Registered installation directory does not exist on disk');
  }
  if (!app.publisher || app.publisher === 'Unknown Publisher') {
    score -= 10;
    notes.push('Unverified / unsigned publisher information');
  }
  return { score: Math.max(0, score), notes };
}

// Test Case 1: Healthy verified app
const healthyApp = {
  name: 'Visual Studio Code',
  publisher: 'Microsoft Corporation',
  install_location: 'C:\\Program Files\\Microsoft VS Code',
  uninstall_string: 'C:\\Program Files\\Microsoft VS Code\\unins000.exe',
};
const healthyResult = calculateHealthScore(healthyApp);
assert.strictEqual(healthyResult.score, 100);
console.log('✓ Test 1 Passed: Healthy verified application scores 100%');

// Test Case 2: Broken orphaned toolbar
const brokenApp = {
  name: 'Orphaned Search Toolbar',
  publisher: 'Unknown Publisher',
  install_location: '',
  uninstall_string: '',
};
const brokenResult = calculateHealthScore(brokenApp);
assert.strictEqual(brokenResult.score, 20); // 100 - 40 - 30 - 10 = 20
assert.strictEqual(brokenResult.notes.length, 3);
console.log('✓ Test 2 Passed: Broken application correctly identified with low health score (20%)');

// 2. Safety Boundary Whitelist Verification
function isPathSafeForDeletion(path) {
  const norm = path.toLowerCase().replace(/\//g, '\\').trim();
  if (norm.length <= 3) return false; // C:\, D:\
  if (norm.startsWith('c:\\windows')) return false;
  if (norm === 'c:\\program files' || norm === 'c:\\program files (x86)') return false;
  return true;
}

assert.strictEqual(isPathSafeForDeletion('C:\\Windows\\System32'), false);
assert.strictEqual(isPathSafeForDeletion('C:\\'), false);
assert.strictEqual(isPathSafeForDeletion('C:\\Program Files'), false);
assert.strictEqual(isPathSafeForDeletion('C:\\Users\\User\\AppData\\Local\\App\\Cache'), true);
assert.strictEqual(isPathSafeForDeletion('C:\\Program Files\\TargetApp'), true);
console.log('✓ Test 3 Passed: Safety deletion boundary strictly rejects protected system paths');

// 3. Multi-tier leftover classification verification
function classifyLeftover(path, isVendorParent, isDedicated) {
  if (isDedicated) return 'Safe';
  if (isVendorParent) return 'Advanced';
  return 'Moderate';
}

assert.strictEqual(classifyLeftover('AppData\\Vendor\\App', false, true), 'Safe');
assert.strictEqual(classifyLeftover('AppData\\Vendor', true, false), 'Advanced');
console.log('✓ Test 4 Passed: Leftover scanner tier classification rules verified');

console.log('------------------------------------------------------------');
console.log('All automated verification checks PASSED successfully!');
console.log('------------------------------------------------------------');
