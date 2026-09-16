import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHORD_GROOVE_TEMPLATES,
  CHORD_SOURCE_CELL_TYPE,
  CUSTOM_CHORD_GROOVE_ID,
  PASSING_CHORD_STEP_INDEX,
  applyChordRhythmStepEnrichment,
  applyChordRhythmStepPassingChord,
  applyChordGrooveTemplateToExistingClips,
  applyChordTemplateWorkspaceToBar,
  applyChordTemplateWorkspaceToExistingClips,
  clearChordRhythmBar,
  createChordGroovePreviewEvents,
  createChordStepHarmonyPreviewEvents,
  createChordTemplateWorkspacePreviewEvents,
  getAppliedChordProgressionTemplateId,
  getChordGrooveTemplate,
  getChordRhythmSteps,
  getChordRhythmStepLabel,
  getChordRhythmStepSourceLabel,
  getChordSelectedGrooveTemplateId,
  getSourceChordLabel,
  toggleChordRhythmStep,
} from '../src/app/chordGrooveActions.js';
import {
  getChordBeatDisplaySegments,
  setChordCell,
} from '../src/app/chordActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createClips(...records) {
  return {
    ids: records.map((clip) => clip.id),
    byId: Object.fromEntries(records.map((clip) => [clip.id, clip])),
  };
}

test('chord groove templates expose the two block picker options in order', () => {
  assert.deepEqual(CHORD_GROOVE_TEMPLATES.map((template) => template.id), [
    'block-basic',
    'block-syncopated',
  ]);
  assert.equal(getChordGrooveTemplate('block-basic').name, '柱式音型基础律动');
  assert.equal(getChordGrooveTemplate('block-syncopated').hitLabel, '3 hits / bar');
  assert.equal(getChordGrooveTemplate('arp-basic'), null);
});

test('applyChordGrooveTemplateToExistingClips writes a short block hit to existing chord clips only', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = setChordCell(matrix, 3, 0, 'Am');
  matrix = setChordCell(matrix, 4, 0, 'F');
  matrix.chord[0][6] = { type: 'notes', notes: ['D'], label: 'D' };
  matrix.drums[3][0] = { instruments: ['kick'] };
  const clips = createClips(
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'drums-bar-1', trackId: 'drums', bar: 1 },
    { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
    { id: 'chord-bar-5', trackId: 'chord', bar: 5 },
  );

  const nextMatrix = applyChordGrooveTemplateToExistingClips(matrix, clips, 'block-basic');

  assert.equal(nextMatrix.chord[0][0].label, 'C');
  assert.deepEqual(nextMatrix.chord[0][0].tonePitches, ['C3', 'E3', 'G3']);
  assert.equal(nextMatrix.chord[0][0].duration, '16n');
  assert.equal(nextMatrix.chord[0][0].grooveTemplateId, 'block-basic');
  assert.equal(nextMatrix.chord[0][0].sourceChordLabel, 'C');
  assert.equal(nextMatrix.chord[0][1], null);
  assert.equal(nextMatrix.chord[0][6], null);
  assert.equal(nextMatrix.chord[3][0].label, 'Am');
  assert.deepEqual(nextMatrix.chord[3][0].tonePitches, ['A3', 'C4', 'E3']);
  assert.equal(nextMatrix.chord[5][0].label, 'C');
  assert.equal(nextMatrix.chord[5][0].sourceChordLabel, 'C');
  assert.equal(nextMatrix.chord[4][0].label, 'F');
  assert.equal(getChordBeatDisplaySegments(nextMatrix, 0)[3].label, null);
  assert.deepEqual(nextMatrix.drums[3][0], { instruments: ['kick'] });
});

test('applyChordGrooveTemplateToExistingClips writes syncopated block hits and clears stale chord bar content', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 2, 0, 'G7');
  matrix = setChordCell(matrix, 2, 2, 'F');
  const clips = createClips({ id: 'chord-bar-2', trackId: 'chord', bar: 2 });

  const nextMatrix = applyChordGrooveTemplateToExistingClips(matrix, clips, 'block-syncopated');

  assert.deepEqual(
    nextMatrix.chord[2].map((cell, step) => (cell ? `${step}:${cell.label}:${cell.duration}` : null)).filter(Boolean),
    ['0:G7:16n', '6:G7:16n', '12:G7:16n'],
  );
  assert.deepEqual(getChordBeatDisplaySegments(nextMatrix, 2)[3], {
    startBeat: 3,
    span: 1,
    label: 'G7',
    hasValue: true,
    hasChord: true,
    mergeKey: null,
  });
});

test('removed arpeggio groove template no-ops when applied by legacy id', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 1, 0, 'Cmaj7');
  const clips = createClips({ id: 'chord-bar-1', trackId: 'chord', bar: 1 });

  const nextMatrix = applyChordGrooveTemplateToExistingClips(matrix, clips, 'arp-basic');

  assert.equal(nextMatrix, matrix);
});

test('createChordGroovePreviewEvents returns timed playable notes for the requested chord', () => {
  assert.deepEqual(createChordGroovePreviewEvents('block-syncopated', 'F'), [
    { step: 0, notes: ['F3', 'A3', 'C3'], duration: '16n' },
    { step: 6, notes: ['F3', 'A3', 'C3'], duration: '16n' },
    { step: 12, notes: ['F3', 'A3', 'C3'], duration: '16n' },
  ]);
  assert.deepEqual(createChordGroovePreviewEvents('arp-basic', 'C'), []);
  assert.deepEqual(createChordGroovePreviewEvents('missing', 'C'), []);
});

test('single-step harmony preview returns one sustained candidate chord without mutating data', () => {
  assert.deepEqual(createChordStepHarmonyPreviewEvents('Cmaj7'), [{
    step: 0,
    notes: ['C3', 'E3', 'G3', 'B3'],
    duration: '2n',
  }]);
  assert.deepEqual(createChordStepHarmonyPreviewEvents('E7'), [{
    step: 0,
    notes: ['E3', 'B2', 'D3', 'G#3'],
    duration: '2n',
  }]);
  assert.deepEqual(createChordStepHarmonyPreviewEvents('missing'), []);
});

test('workspace preview combines the pending four-chord progression with the basic groove', () => {
  const events = createChordTemplateWorkspacePreviewEvents({
    progressionTemplateId: 'doowop',
    grooveTemplateId: 'block-basic',
  });

  assert.deepEqual(events, [
    { step: 0, notes: ['C3', 'E3', 'G3'], duration: '16n' },
    { step: 16, notes: ['A3', 'C4', 'E3'], duration: '16n' },
    { step: 32, notes: ['F3', 'A3', 'C3'], duration: '16n' },
    { step: 48, notes: ['G3', 'B3', 'D4'], duration: '16n' },
  ]);
});

test('workspace preview repeats syncopated hits across all four clips and rejects invalid ids', () => {
  const events = createChordTemplateWorkspacePreviewEvents({
    progressionTemplateId: 'axis',
    grooveTemplateId: 'block-syncopated',
  });

  assert.equal(events.length, 12);
  assert.deepEqual(events.map((event) => event.step), [
    0, 6, 12,
    16, 22, 28,
    32, 38, 44,
    48, 54, 60,
  ]);
  assert.deepEqual(events.slice(3, 6).map((event) => event.notes), [
    ['G3', 'B3', 'D4'],
    ['G3', 'B3', 'D4'],
    ['G3', 'B3', 'D4'],
  ]);
  assert.deepEqual(createChordTemplateWorkspacePreviewEvents({
    progressionTemplateId: 'missing',
    grooveTemplateId: 'block-basic',
  }), []);
  assert.deepEqual(createChordTemplateWorkspacePreviewEvents({
    progressionTemplateId: 'axis',
    grooveTemplateId: 'missing',
  }), []);
});

test('applyChordTemplateWorkspaceToBar applies both selections using sparse clip order', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'F');
  matrix = setChordCell(matrix, 3, 0, 'G');
  matrix = setChordCell(matrix, 7, 0, 'Am');
  const clips = createClips(
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
    { id: 'chord-bar-7', trackId: 'chord', bar: 7 },
  );

  const nextMatrix = applyChordTemplateWorkspaceToBar(matrix, clips, 3, {
    progressionTemplateId: 'doowop',
    grooveTemplateId: 'block-syncopated',
  });

  assert.equal(nextMatrix.chord[0][0].label, 'F');
  assert.equal(nextMatrix.chord[7][0].label, 'Am');
  assert.deepEqual(getChordRhythmSteps(nextMatrix, 3), [0, 6, 12]);
  assert.equal(nextMatrix.chord[3][0].sourceChordLabel, 'Am');
  assert.equal(nextMatrix.chord[3][0].progressionTemplateId, 'doowop');
  assert.equal(nextMatrix.chord[3][0].selectedGrooveTemplateId, 'block-syncopated');
});

test('applyChordTemplateWorkspaceToExistingClips cycles sixteenth-note grooves across chord clips only', () => {
  const matrix = createInitialMatrix();
  matrix.drums[3][0] = { instruments: ['kick'] };
  const clips = createClips(
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'drums-bar-1', trackId: 'drums', bar: 1 },
    { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
    { id: 'chord-bar-7', trackId: 'chord', bar: 7 },
  );

  const nextMatrix = applyChordTemplateWorkspaceToExistingClips(matrix, clips, {
    progressionTemplateId: 'axis',
    grooveTemplateId: 'block-basic',
  });

  assert.deepEqual(
    [0, 3, 7].map((bar) => nextMatrix.chord[bar][0].sourceChordLabel),
    ['C', 'G', 'Dm'],
  );
  assert.deepEqual([0, 3, 7].map((bar) => getChordRhythmSteps(nextMatrix, bar)), [[0], [0], [0]]);
  assert.equal(nextMatrix.chord[1].every((cell) => cell === null), true);
  assert.deepEqual(nextMatrix.drums[3][0], { instruments: ['kick'] });
  assert.equal(getAppliedChordProgressionTemplateId(nextMatrix, clips, 3), 'axis');
});

test('workspace apply helpers no-op for invalid templates or non-clip bars', () => {
  const matrix = createInitialMatrix();
  const clips = createClips({ id: 'chord-bar-0', trackId: 'chord', bar: 0 });

  assert.equal(applyChordTemplateWorkspaceToBar(matrix, clips, 1, {
    progressionTemplateId: 'doowop',
    grooveTemplateId: 'block-basic',
  }), matrix);
  assert.equal(applyChordTemplateWorkspaceToExistingClips(matrix, clips, {
    progressionTemplateId: 'missing',
    grooveTemplateId: 'block-basic',
  }), matrix);
});

test('toggleChordRhythmStep creates custom playable hits and retains a silent source when emptied', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 2, 0, 'F');

  matrix = toggleChordRhythmStep(matrix, 2, 6);
  assert.deepEqual(getChordRhythmSteps(matrix, 2), [0, 6]);
  assert.equal(matrix.chord[2][6].grooveTemplateId, CUSTOM_CHORD_GROOVE_ID);
  assert.equal(matrix.chord[2][6].duration, '16n');
  assert.equal(matrix.chord[2][6].sourceChordLabel, 'F');

  matrix = toggleChordRhythmStep(matrix, 2, 0);
  matrix = toggleChordRhythmStep(matrix, 2, 6);

  assert.deepEqual(getChordRhythmSteps(matrix, 2), []);
  assert.equal(matrix.chord[2][0].type, CHORD_SOURCE_CELL_TYPE);
  assert.equal(matrix.chord[2][0].sourceChordLabel, 'F');
  assert.equal(getChordSelectedGrooveTemplateId(matrix, 2), CUSTOM_CHORD_GROOVE_ID);
});

test('clearChordRhythmBar removes playable rhythm while preserving the source chord', () => {
  const clips = createClips({ id: 'chord-bar-4', trackId: 'chord', bar: 4 });
  let matrix = applyChordTemplateWorkspaceToBar(createInitialMatrix(), clips, 4, {
    progressionTemplateId: 'andalusian',
    grooveTemplateId: 'block-syncopated',
  });
  const sourceChordLabel = getSourceChordLabel(matrix, 4);

  matrix = clearChordRhythmBar(matrix, 4);

  assert.deepEqual(getChordRhythmSteps(matrix, 4), []);
  assert.equal(matrix.chord[4].filter(Boolean).length, 1);
  assert.equal(matrix.chord[4][0].type, CHORD_SOURCE_CELL_TYPE);
  assert.equal(matrix.chord[4][0].sourceChordLabel, sourceChordLabel);
  assert.equal(
    matrix.chord[4][0].selectedGrooveTemplateId,
    CUSTOM_CHORD_GROOVE_ID,
  );
  assert.equal(getAppliedChordProgressionTemplateId(matrix, clips, 4), 'andalusian');

  matrix = toggleChordRhythmStep(matrix, 4, 6);
  assert.deepEqual(getChordRhythmSteps(matrix, 4), [6]);
  assert.equal(getChordRhythmStepSourceLabel(matrix, 4, 6), sourceChordLabel);
});

test('single-step chord enrichment keeps the bar source and sibling rhythm hits intact', () => {
  const clips = createClips({ id: 'chord-bar-0', trackId: 'chord', bar: 0 });
  let matrix = applyChordTemplateWorkspaceToBar(createInitialMatrix(), clips, 0, {
    progressionTemplateId: 'doowop',
    grooveTemplateId: 'block-syncopated',
  });

  matrix = applyChordRhythmStepEnrichment(matrix, 0, 6, 'Cmaj7');

  assert.equal(getChordRhythmStepLabel(matrix, 0, 0), 'C');
  assert.equal(getChordRhythmStepLabel(matrix, 0, 6), 'Cmaj7');
  assert.equal(getChordRhythmStepSourceLabel(matrix, 0, 6), 'C');
  assert.equal(matrix.chord[0][6].sourceChordLabel, 'C');
  assert.equal(matrix.chord[0][6].duration, '16n');
  assert.equal(matrix.chord[0][6].grooveTemplateId, 'block-syncopated');
  assert.equal(matrix.chord[0][12].label, 'C');
  assert.equal(getSourceChordLabel(matrix, 0), 'C');
  assert.equal(getAppliedChordProgressionTemplateId(matrix, clips, 0), 'doowop');
});

test('single-step enrichment restores the root chord and rejects unrelated targets', () => {
  let matrix = createInitialMatrix();
  matrix = toggleChordRhythmStep(matrix, 1, 5);
  matrix = applyChordRhythmStepEnrichment(matrix, 1, 5, 'Cmaj7');

  const restored = applyChordRhythmStepEnrichment(matrix, 1, 5, 'C');
  assert.equal(restored.chord[1][5].label, 'C');
  assert.equal(restored.chord[1][5].sourceChordLabel, 'C');
  assert.equal(applyChordRhythmStepEnrichment(restored, 1, 5, 'Fmaj7'), restored);
  assert.equal(applyChordRhythmStepEnrichment(restored, 1, 4, 'Cmaj7'), restored);
});

test('passing chords replace only step fifteen and preserve a silent root source when needed', () => {
  const clips = createClips(
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
  );
  let matrix = createInitialMatrix();
  matrix = toggleChordRhythmStep(matrix, 0, PASSING_CHORD_STEP_INDEX);
  matrix = setChordCell(matrix, 3, 0, 'Am');

  const nextMatrix = applyChordRhythmStepPassingChord(
    matrix,
    clips,
    0,
    PASSING_CHORD_STEP_INDEX,
    'E7',
  );

  assert.equal(nextMatrix.chord[0][PASSING_CHORD_STEP_INDEX].label, 'E7');
  assert.equal(nextMatrix.chord[0][PASSING_CHORD_STEP_INDEX].grooveTemplateId, 'passing-shortcut');
  assert.equal(nextMatrix.chord[0][0].type, CHORD_SOURCE_CELL_TYPE);
  assert.equal(nextMatrix.chord[0][0].sourceChordLabel, 'C');
  assert.equal(getSourceChordLabel(nextMatrix, 0), 'C');
  assert.equal(nextMatrix.chord[3][0].label, 'Am');
  const restored = applyChordRhythmStepEnrichment(
    nextMatrix,
    0,
    PASSING_CHORD_STEP_INDEX,
    'C',
  );
  assert.equal(restored.chord[0][PASSING_CHORD_STEP_INDEX].label, 'C');
  assert.notEqual(restored.chord[0][PASSING_CHORD_STEP_INDEX].grooveTemplateId, 'passing-shortcut');
  assert.equal(applyChordRhythmStepPassingChord(nextMatrix, clips, 0, 13, 'E7'), nextMatrix);
  assert.equal(applyChordRhythmStepPassingChord(nextMatrix, clips, 0, PASSING_CHORD_STEP_INDEX, 'D7'), nextMatrix);
});

test('passing chords use the Doo-Wop target fallback when no next chord clip exists', () => {
  const clips = createClips({ id: 'chord-bar-0', trackId: 'chord', bar: 0 });
  let matrix = createInitialMatrix();
  matrix = toggleChordRhythmStep(matrix, 0, PASSING_CHORD_STEP_INDEX);

  const nextMatrix = applyChordRhythmStepPassingChord(
    matrix,
    clips,
    0,
    PASSING_CHORD_STEP_INDEX,
    'E7',
  );

  assert.equal(nextMatrix.chord[0][PASSING_CHORD_STEP_INDEX].label, 'E7');
});

test('manual rhythm toggles preserve untouched enriched and passing chord steps', () => {
  const clips = createClips(
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'chord-bar-1', trackId: 'chord', bar: 1 },
  );
  let matrix = createInitialMatrix();
  matrix = toggleChordRhythmStep(matrix, 0, 0);
  matrix = toggleChordRhythmStep(matrix, 0, 6);
  matrix = toggleChordRhythmStep(matrix, 0, PASSING_CHORD_STEP_INDEX);
  matrix = setChordCell(matrix, 1, 0, 'Am');
  matrix = applyChordRhythmStepEnrichment(matrix, 0, 6, 'Cmaj7');
  matrix = applyChordRhythmStepPassingChord(matrix, clips, 0, PASSING_CHORD_STEP_INDEX, 'E7');

  matrix = toggleChordRhythmStep(matrix, 0, 10);
  assert.equal(matrix.chord[0][6].label, 'Cmaj7');
  assert.equal(matrix.chord[0][6].sourceChordLabel, 'C');
  assert.equal(matrix.chord[0][PASSING_CHORD_STEP_INDEX].label, 'E7');
  assert.equal(matrix.chord[0][PASSING_CHORD_STEP_INDEX].grooveTemplateId, 'passing-shortcut');

  matrix = toggleChordRhythmStep(matrix, 0, 10);
  assert.equal(matrix.chord[0][6].label, 'Cmaj7');
  assert.equal(matrix.chord[0][PASSING_CHORD_STEP_INDEX].label, 'E7');
});
