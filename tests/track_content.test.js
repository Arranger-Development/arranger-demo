import test from 'node:test';
import assert from 'node:assert/strict';
import { createChordCell } from '../src/domain/chordCells.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import {
  hasClipContent,
  hasExistingTrackClipContent,
  hasTrackBarContent,
} from '../src/app/trackContent.js';

function createClips(...items) {
  return {
    ids: items.map((item) => item.id),
    byId: Object.fromEntries(items.map((item) => [item.id, item])),
  };
}

test('track content detection ignores empty clips and silent chord source metadata', () => {
  const matrix = createInitialMatrix();
  const chordClip = { id: 'chord-bar-0', trackId: 'chord', bar: 0 };

  assert.equal(hasClipContent(matrix, chordClip), false);

  matrix.chord[0][0] = {
    type: 'chord-source',
    label: 'C',
    sourceChordLabel: 'C',
  };

  assert.equal(hasClipContent(matrix, chordClip), false);
  assert.equal(hasTrackBarContent(matrix, 'chord', 0), false);
});

test('track content detection recognizes playable cells for every arranger track', () => {
  const matrix = createInitialMatrix();

  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.chord[1][0] = createChordCell('C');
  matrix.bass[2][4] = { type: 'bass', note: 'G0' };
  matrix.melody[3][8] = { type: 'melody', note: 'E4' };

  assert.equal(hasTrackBarContent(matrix, 'drums', 0), true);
  assert.equal(hasTrackBarContent(matrix, 'chord', 1), true);
  assert.equal(hasTrackBarContent(matrix, 'bass', 2), true);
  assert.equal(hasTrackBarContent(matrix, 'melody', 3), true);
});

test('existing-track content detection only considers bars with clips', () => {
  const matrix = createInitialMatrix();
  const clips = createClips(
    { id: 'drums-bar-0', trackId: 'drums', bar: 0 },
    { id: 'chord-bar-1', trackId: 'chord', bar: 1 },
    { id: 'bass-bar-2', trackId: 'bass', bar: 2 },
  );

  matrix.drums[4][0] = { instruments: ['kick'] };
  assert.equal(hasExistingTrackClipContent(matrix, clips, 'drums'), false);

  matrix.drums[0][4] = { instruments: ['hihat'] };
  assert.equal(hasExistingTrackClipContent(matrix, clips, 'drums'), true);
});
