import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORD_EDITOR_RESIZE_MIN_HEIGHT,
  CHORD_TEMPLATE_WORKSPACE_RESIZE_MIN_HEIGHT,
  EDITOR_RESIZE_MIN_HEIGHT,
  clampEditorHeight,
  getEditorResizeBounds,
} from '../src/app/useEditorResize.js';

test('editor resize bounds preserve the compact default for ordinary editors', () => {
  assert.deepEqual(getEditorResizeBounds({
    requestedMinHeight: EDITOR_RESIZE_MIN_HEIGHT,
    topbarHeight: 70,
    viewportHeight: 900,
    workspaceMinHeight: 180,
  }), {
    minHeight: 180,
    maxHeight: 650,
  });
});

test('editor resize bounds reserve usable heights for chord editor modes', () => {
  assert.equal(getEditorResizeBounds({
    requestedMinHeight: CHORD_EDITOR_RESIZE_MIN_HEIGHT,
    topbarHeight: 70,
    viewportHeight: 900,
    workspaceMinHeight: 180,
  }).minHeight, 360);

  assert.equal(getEditorResizeBounds({
    requestedMinHeight: CHORD_TEMPLATE_WORKSPACE_RESIZE_MIN_HEIGHT,
    topbarHeight: 70,
    viewportHeight: 900,
    workspaceMinHeight: 180,
  }).minHeight, 420);
});

test('editor resize bounds collapse safely when the viewport cannot fit the requested minimum', () => {
  const bounds = getEditorResizeBounds({
    requestedMinHeight: CHORD_TEMPLATE_WORKSPACE_RESIZE_MIN_HEIGHT,
    topbarHeight: 70,
    viewportHeight: 520,
    workspaceMinHeight: 180,
  });

  assert.deepEqual(bounds, {
    minHeight: 270,
    maxHeight: 270,
  });
  assert.equal(clampEditorHeight(100, bounds), 270);
  assert.equal(clampEditorHeight(800, bounds), 270);
});
