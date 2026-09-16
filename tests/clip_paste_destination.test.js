import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createClipPasteDestination,
  createRulerPasteDestination,
  resolveClipPasteTarget,
} from '../src/app/clipPasteDestination.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createState(matrix, clips = []) {
  return {
    matrix,
    getClipForTrackBar: (trackId, bar) => (
      clips.find((clip) => clip.trackId === trackId && clip.bar === bar) ?? null
    ),
  };
}

test('clip paste destinations require an explicit valid timeline location', () => {
  assert.deepEqual(createClipPasteDestination('drums', 3), {
    bar: 3,
    trackId: 'drums',
  });
  assert.equal(createClipPasteDestination('', 3), null);
  assert.equal(createClipPasteDestination('drums', -1), null);
  assert.equal(createClipPasteDestination('drums', 8), null);
});

test('ruler destinations reuse a single clip track and preserve range track offsets', () => {
  assert.deepEqual(createRulerPasteDestination({ trackId: 'melody' }, 5), {
    bar: 5,
    trackId: 'melody',
  });
  assert.deepEqual(createRulerPasteDestination({ kind: 'timeline-range' }, 2), {
    bar: 2,
    trackId: null,
  });
  assert.equal(createRulerPasteDestination(null, 2), null);
});

test('single clip paste resolves only after selecting a same-track target', () => {
  const matrix = createInitialMatrix();
  const targetClip = { id: 'bass-bar-4', trackId: 'bass', bar: 4 };
  const state = createState(matrix, [targetClip]);
  const clipClipboard = {
    trackId: 'bass',
    sourceBar: 1,
    barData: matrix.bass[1],
  };

  assert.equal(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination: null,
    state,
  }), null);
  assert.equal(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination: createClipPasteDestination('melody', 4),
    state,
  }), null);
  assert.deepEqual(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination: createClipPasteDestination('bass', 4),
    state,
  }), {
    targetBar: 4,
    targetClip,
    targetHasContent: false,
    targetTrackId: 'bass',
  });
});

test('range paste uses the explicit start bar and counts only contentful targets', () => {
  const matrix = createInitialMatrix();
  matrix.drums[4][0] = { instruments: ['kick'] };
  const state = createState(matrix);
  const clipClipboard = {
    kind: 'timeline-range',
    sourceStartBar: 0,
    sourceEndBar: 1,
    trackIds: ['drums', 'chord'],
    items: [
      { trackId: 'drums', barOffset: 0 },
      { trackId: 'chord', barOffset: 1 },
    ],
  };

  assert.deepEqual(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination: createClipPasteDestination('melody', 4),
    state,
  }), {
    kind: 'timeline-range',
    targetBar: 4,
    targetContentCount: 1,
  });
  assert.equal(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination: createClipPasteDestination('drums', 7),
    state,
  }), null);
});
