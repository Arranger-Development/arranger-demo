import assert from 'node:assert/strict';
import { test } from 'node:test';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import { createDrumsStepMovePatch } from '../src/domain/drumsStepMove.js';

test('createDrumsStepMovePatch moves one drums instrument and preserves stacked notes', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = {
    instruments: ['kick', 'hihat'],
    timingOffsets: { hihat: 0.12, kick: 0 },
    velocities: { hihat: 0.4, kick: 0.96 },
  };
  matrix.drums[0][2] = {
    instruments: ['snare'],
    timingOffsets: { snare: 0.16 },
    velocities: { snare: 0.72 },
  };

  const move = createDrumsStepMovePatch({
    bar: 0,
    fromStep: 0,
    instrument: 'kick',
    matrix,
    toStep: 2,
  });

  assert.equal(move.allowed, true);
  assert.deepEqual(move.nextMatrixPatch, [
    {
      bar: 0,
      cell: {
        instruments: ['hihat'],
        timingOffsets: { hihat: 0.12 },
        velocities: { hihat: 0.4 },
      },
      step: 0,
    },
    {
      bar: 0,
      cell: {
        instruments: ['kick', 'snare'],
        timingOffsets: { kick: 0, snare: 0.16 },
        velocities: { kick: 0.96, snare: 0.72 },
      },
      step: 2,
    },
  ]);
  assert.deepEqual(matrix.drums[0][0].velocities, { hihat: 0.4, kick: 0.96 });
  assert.deepEqual(matrix.drums[0][2].velocities, { snare: 0.72 });
});

test('createDrumsStepMovePatch rejects inactive, duplicate, and same-step moves', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.drums[0][2] = { instruments: ['kick'] };

  assert.equal(createDrumsStepMovePatch({
    bar: 0,
    fromStep: 1,
    instrument: 'kick',
    matrix,
    toStep: 3,
  }).allowed, false);

  assert.equal(createDrumsStepMovePatch({
    bar: 0,
    fromStep: 0,
    instrument: 'kick',
    matrix,
    toStep: 2,
  }).allowed, false);

  assert.equal(createDrumsStepMovePatch({
    bar: 0,
    fromStep: 0,
    instrument: 'kick',
    matrix,
    toStep: 0,
  }).allowed, false);
});
