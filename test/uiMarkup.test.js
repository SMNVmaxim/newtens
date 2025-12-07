const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function getTagById(id) {
  const pattern = new RegExp(`<([^>\\s]+)[^>]*id="${id}"[^>]*>`, 'i');
  const match = html.match(pattern);
  return match ? match[0] : null;
}

describe('UI markup', () => {
  it('includes desktop HUD stats with initial labels', () => {
    assert.match(html, /id="hud"/i);
    assert.match(html, /id="mask">Mask: Tiger \(speed\)<\/span>/i);
    assert.match(html, /id="ammo">Ammo: 6<\/span>/i);
    assert.match(html, /id="state">Status: Ready<\/span>/i);
    assert.match(html, /id="wave">Wave: 1<\/span>/i);
  });

  it('provides keyboard guidance for desktop play', () => {
    assert.match(html, /WASD to move/);
    assert.match(html, /Shift to dash/);
    assert.match(html, /LMB shoot/);
    assert.match(html, /R to restart/);
  });

  it('exposes accessible canvas and controls', () => {
    const canvasTag = getTagById('game');
    assert.ok(canvasTag, 'Canvas element should exist');
    assert.match(canvasTag, /aria-label="Top-down action prototype"/i);
    assert.match(canvasTag, /role="img"/i);

    const sliderTag = getTagById('music-volume');
    assert.ok(sliderTag, 'Music volume slider should exist');
    assert.match(sliderTag, /aria-label="Music volume"/i);
    assert.match(sliderTag, /value="35"/);
  });

  it('includes start overlays with desktop-friendly copy and buttons', () => {
    assert.match(html, /id="start-overlay"/i);
    assert.match(html, /Press Enter or click Start to begin/);
    assert.match(html, /id="start-run-btn"[^>]*type="button"[^>]*>Start run<\/button>/i);
    assert.match(html, /id="start-btn"[^>]*type="button"[^>]*>Start run<\/button>/i);
  });

  it('keeps touch controls hidden by default for desktop view', () => {
    const touchContainer = getTagById('touch-controls');
    assert.ok(touchContainer, 'Touch controls container should exist');
    assert.match(touchContainer, /aria-hidden="true"/i);
  });
});
