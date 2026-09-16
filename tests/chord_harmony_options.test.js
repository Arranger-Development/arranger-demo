import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchpadChordHarmonyState } from '../src/app/launchpadChordHarmonyState.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createChordClips(...bars) {
  return {
    ids: bars.map((bar) => `chord-bar-${bar}`),
    byId: Object.fromEntries(bars.map((bar) => [
      `chord-bar-${bar}`,
      { id: `chord-bar-${bar}`, trackId: 'chord', bar },
    ])),
  };
}

function createRhythmCell(label) {
  return {
    type: 'chord',
    label,
    sourceChordLabel: label,
    grooveTemplateId: 'custom-rhythm',
  };
}

test('Launchpad Harmony state exposes source restore, variants, and contextual passing options', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][14] = createRhythmCell('C');
  matrix.chord[1][0] = createRhythmCell('Am');

  assert.deepEqual(createLaunchpadChordHarmonyState({
    bar: 0,
    clips: createChordClips(0, 1),
    matrix,
    step: 14,
  }), {
    bar: 0,
    canApplyPassing: true,
    currentLabel: 'C',
    enrichOptions: [
      { name: 'C', restore: true },
      { name: 'Cmaj7' },
      { name: 'Csus2' },
      { name: 'Csus4' },
      { name: 'Cadd9' },
    ],
    passingOptions: [{ name: 'E7' }, { name: 'Bø' }],
    selectedOption: { mode: 'enrich', name: 'C', optionIndex: 0 },
    sourceChordLabel: 'C',
    step: 14,
    targetChordLabel: 'Am',
  });
});

test('Launchpad Harmony state preserves a valid pending candidate without applying it', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][14] = createRhythmCell('C');
  matrix.chord[1][0] = createRhythmCell('Am');

  const state = createLaunchpadChordHarmonyState({
    bar: 0,
    clips: createChordClips(0, 1),
    matrix,
    selectedOption: { mode: 'passing', optionIndex: 1 },
    step: 14,
  });

  assert.deepEqual(state.selectedOption, {
    mode: 'passing',
    name: 'Bø',
    optionIndex: 1,
  });
  assert.equal(matrix.chord[0][14].label, 'C');
});

test('Launchpad Harmony state falls back from an invalid candidate to the applied chord', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][3] = {
    ...createRhythmCell('Cmaj7'),
    sourceChordLabel: 'C',
  };

  const state = createLaunchpadChordHarmonyState({
    bar: 0,
    clips: createChordClips(0),
    matrix,
    selectedOption: { mode: 'passing', optionIndex: 7 },
    step: 3,
  });

  assert.deepEqual(state.selectedOption, {
    mode: 'enrich',
    name: 'Cmaj7',
    optionIndex: 1,
  });
});

test('Launchpad Harmony state keeps passing choices hidden off step fifteen', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][3] = createRhythmCell('Am');

  const state = createLaunchpadChordHarmonyState({
    bar: 0,
    clips: createChordClips(0),
    matrix,
    step: 3,
  });

  assert.equal(state.canApplyPassing, false);
  assert.deepEqual(state.enrichOptions.map((option) => option.name), [
    'Am', 'Am7', 'Am9', 'Amadd9',
  ]);
  assert.deepEqual(state.passingOptions, []);
});

test('Launchpad Harmony state rejects empty or invalid targets', () => {
  const matrix = createInitialMatrix();
  const clips = createChordClips(0);

  assert.equal(createLaunchpadChordHarmonyState({ bar: 0, clips, matrix, step: 0 }), null);
  assert.equal(createLaunchpadChordHarmonyState({ bar: 8, clips, matrix, step: 0 }), null);
});
