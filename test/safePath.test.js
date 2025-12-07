const assert = require('assert');
const { describe, it } = require('node:test');
const path = require('path');
const { safePath, ROOT } = require('../server');

// Helper to normalize Windows/posix path separator expectations
function joinRoot(target) {
  return path.resolve(ROOT, target);
}

describe('safePath', () => {
  it('resolves root to index.html within project root', () => {
    const result = safePath('/');
    assert.strictEqual(result, joinRoot('index.html'));
  });

  it('allows simple nested files under root', () => {
    const result = safePath('/assets/app.js');
    assert.strictEqual(result, joinRoot('assets/app.js'));
  });

  it('rejects directory traversal attempts', () => {
    assert.strictEqual(safePath('/../secret.txt'), null);
    assert.strictEqual(safePath('/assets/../../secret.txt'), null);
  });

  it('rejects paths with invalid percent-encoding', () => {
    assert.strictEqual(safePath('/%E0%A4%A'), null);
  });
});
