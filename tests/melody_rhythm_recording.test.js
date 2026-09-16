import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getMelodyRhythmTemplate,
  MELODY_RHYTHM_TEMPLATES,
  normalizeMelodyRhythmTemplateId,
} from '../src/app/melodyRhythmTemplates.js';
import {
  appendMelodySequenceNote,
  captureMelodySequenceNote,
  createTemplateRecordingState,
  getMelodyRecordingMode,
  getMelodyRecordingRestState,
  getRecordedMelodyDurationSteps,
  hasMelodyBarNotes,
  hasMelodyNotesInRange,
  getMelodyWriteBarRange,
  MELODY_RECORDING_MODES,
  MELODY_RECORDING_PHASES,
  recordTemplateMelodyNote,
  registerActiveMelodyInput,
  releaseActiveMelodyInput,
  resolveFreeMelodyRecordingPosition,
} from '../src/app/useMelodyRecordingController.js';
import { replaceMelodyBarWithSequence } from '../src/app/melodyActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

test('melody rhythm templates expose only Chinese and Blues one-based patterns', () => {
  assert.deepEqual(
    MELODY_RHYTHM_TEMPLATES.map(({ name, steps }) => ({
      name,
      steps: steps.map((step) => step + 1),
    })),
    [
      { name: '中国风', steps: [3, 5, 9, 13, 15] },
      { name: '布鲁斯', steps: [3, 5, 7, 11, 12, 13, 15] },
    ],
  );
  assert.deepEqual(
    createTemplateRecordingState('chinese', MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE, {
      currentBar: 5,
      endBar: 7,
      startBar: 5,
      totalBars: 3,
    }),
    {
      barRecordedNotes: 0,
      completedBars: [],
      countInBeat: null,
      currentBar: 5,
      endBar: 7,
      mode: MELODY_RECORDING_MODES.TEMPLATE,
      phase: MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      recordedNotes: 0,
      selectedStep: null,
      sequenceNotes: [],
      startBar: 5,
      templateId: 'chinese',
      totalBars: 3,
      totalNotes: 15,
    },
  );
  assert.equal(getMelodyRhythmTemplate('syncopation'), null);
  assert.equal(normalizeMelodyRhythmTemplateId('dotted'), null);
});

test('template recording fills highlighted steps in order and completes at the last slot', () => {
  let matrix = createInitialMatrix();
  let cursor = 0;
  const recorded = [];

  for (const note of ['C4', 'D4', 'E4', 'G4', 'A4']) {
    const result = recordTemplateMelodyNote(
      matrix,
      0,
      'chinese',
      cursor,
      note,
    );
    matrix = result.matrix;
    cursor = result.cursor;
    recorded.push({ complete: result.complete, step: result.step });
  }

  assert.deepEqual(recorded, [
    { complete: false, step: 2 },
    { complete: false, step: 4 },
    { complete: false, step: 8 },
    { complete: false, step: 12 },
    { complete: true, step: 14 },
  ]);
  assert.deepEqual(matrix.melody[0].map((cell, step) => cell ? [step, cell.note] : null).filter(Boolean), [
    [2, 'C4'],
    [4, 'D4'],
    [8, 'E4'],
    [12, 'G4'],
    [14, 'A4'],
  ]);
  assert.equal(recordTemplateMelodyNote(matrix, 0, 'chinese', cursor, 'G4').recorded, false);
});

test('free recording helpers quantize duration and choose mode from clip template state', () => {
  assert.equal(getMelodyRecordingMode(null), MELODY_RECORDING_MODES.FREE);
  assert.equal(getMelodyRecordingMode('blues'), MELODY_RECORDING_MODES.TEMPLATE);
  assert.equal(getMelodyRecordingMode('four-sixteen'), MELODY_RECORDING_MODES.FREE);
  assert.equal(getRecordedMelodyDurationSteps({
    bpm: 120,
    endedAt: 375,
    startedAt: 0,
  }), 3);
  assert.equal(getRecordedMelodyDurationSteps({
    bpm: 120,
    endedAt: 10,
    maxDurationSteps: 1,
    startedAt: 0,
  }), 1);

  const matrix = createInitialMatrix();
  assert.equal(hasMelodyBarNotes(matrix, 0), false);
  matrix.melody[0][4] = { type: 'melody', note: 'C4' };
  assert.equal(hasMelodyBarNotes(matrix, 0), true);
  assert.deepEqual(getMelodyWriteBarRange(5), [5, 6, 7]);
  assert.deepEqual(getMelodyWriteBarRange(-1), []);
  assert.equal(hasMelodyNotesInRange(matrix, 0, 7), true);
  assert.equal(hasMelodyNotesInRange(matrix, 1, 7), false);
});

test('free recording resolves note-on from live audio time across a scheduled bar boundary', () => {
  const session = {
    currentBar: 4,
    mode: MELODY_RECORDING_MODES.FREE,
    preparedBars: new Set([3, 4]),
    targetBars: [3, 4, 5],
  };

  assert.deepEqual(
    resolveFreeMelodyRecordingPosition(session, { bar: 3, step: 15 }),
    { bar: 3, step: 15 },
  );
  assert.deepEqual(
    resolveFreeMelodyRecordingPosition(session, { bar: 4, step: 0 }),
    { bar: 4, step: 0 },
  );
  assert.equal(resolveFreeMelodyRecordingPosition(session, { bar: 5, step: 0 }), null);
  assert.equal(resolveFreeMelodyRecordingPosition(session, { bar: 6, step: 0 }), null);
});

test('template workflow exposes overview, step-edit, and capture state', () => {
  const templateClip = {
    id: 'melody-bar-0',
    trackId: 'melody',
    bar: 0,
  };
  assert.equal(getMelodyRecordingRestState({
    activeTrackId: 'melody',
    activeTrackType: 'melody',
    melodyRhythmTemplateId: 'chinese',
    selectedClip: templateClip,
  }).phase, MELODY_RECORDING_PHASES.OVERVIEW);
  assert.equal(getMelodyRecordingRestState({
    activeTrackId: 'drums',
    activeTrackType: 'drums',
    melodyRhythmTemplateId: 'chinese',
    selectedClip: templateClip,
  }).phase, MELODY_RECORDING_PHASES.IDLE);
  assert.deepEqual(
    createTemplateRecordingState('chinese', MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE),
    {
      barRecordedNotes: 0,
      completedBars: [],
      countInBeat: null,
      currentBar: null,
      endBar: null,
      mode: MELODY_RECORDING_MODES.TEMPLATE,
      phase: MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      recordedNotes: 0,
      selectedStep: null,
      sequenceNotes: [],
      startBar: null,
      templateId: 'chinese',
      totalBars: 1,
      totalNotes: 5,
    },
  );
  assert.equal(MELODY_RECORDING_PHASES.AUDITION, undefined);
  assert.equal(MELODY_RECORDING_PHASES.PREVIEW, undefined);
});

test('sequence capture keeps the matrix unchanged until one atomic bar replacement', () => {
  const matrix = createInitialMatrix();
  matrix.melody[0][3] = { type: 'melody', note: 'A4', durationSteps: 4 };
  const originalBar = matrix.melody[0];

  const incomplete = replaceMelodyBarWithSequence(
    matrix,
    0,
    [0, 6, 12],
    ['C4', 'D4'],
  );
  assert.equal(incomplete, matrix);
  assert.equal(incomplete.melody[0], originalBar);

  const complete = replaceMelodyBarWithSequence(
    matrix,
    0,
    [0, 6, 12],
    ['C4', 'D4', 'E4'],
  );
  assert.notEqual(complete, matrix);
  assert.deepEqual(
    complete.melody[0]
      .map((cell, step) => cell ? [step, cell] : null)
      .filter(Boolean),
    [
      [0, { type: 'melody', note: 'C4' }],
      [6, { type: 'melody', note: 'D4' }],
      [12, { type: 'melody', note: 'E4' }],
    ],
  );
  assert.deepEqual(matrix.melody[0][3], {
    type: 'melody',
    note: 'A4',
    durationSteps: 4,
  });
});

test('sequence capture accepts overlapping new presses and keeps duplicates', () => {
  const first = appendMelodySequenceNote([], 'C4', 3);
  assert.deepEqual(first, {
    accepted: true,
    complete: false,
    sequenceNotes: ['C4'],
  });
  const duplicate = appendMelodySequenceNote(first.sequenceNotes, 'C4', 3);
  assert.deepEqual(duplicate.sequenceNotes, ['C4', 'C4']);
  assert.equal(appendMelodySequenceNote(duplicate.sequenceNotes, 'G4', 3).complete, true);
});

test('sequence capture session records four rapid events synchronously and commits once', () => {
  const session = {
    completed: false,
    sequenceNotes: [],
    templateSteps: [0, 4, 8, 12],
  };

  const results = ['C4', 'E4', 'G4', 'C5']
    .map((note) => captureMelodySequenceNote(session, note));

  assert.deepEqual(results.map(({ accepted, complete }) => ({ accepted, complete })), [
    { accepted: true, complete: false },
    { accepted: true, complete: false },
    { accepted: true, complete: false },
    { accepted: true, complete: true },
  ]);
  assert.deepEqual(session.sequenceNotes, ['C4', 'E4', 'G4', 'C5']);
  assert.equal(session.completed, true);
  assert.deepEqual(captureMelodySequenceNote(session, 'D5'), {
    accepted: false,
    complete: false,
    sequenceNotes: ['C4', 'E4', 'G4', 'C5'],
  });
});

test('active melody inputs reference-count the same note across sources', () => {
  const activeInputs = new Map();
  assert.deepEqual(registerActiveMelodyInput(activeInputs, 'keyboard:KeyA', 'C4'), {
    accepted: true,
    firstSourceForNote: true,
  });
  assert.deepEqual(registerActiveMelodyInput(activeInputs, 'launchpad:41', 'C4'), {
    accepted: true,
    firstSourceForNote: false,
  });
  assert.deepEqual(registerActiveMelodyInput(activeInputs, 'keyboard:KeyA', 'C4'), {
    accepted: false,
    firstSourceForNote: false,
  });
  assert.deepEqual(releaseActiveMelodyInput(activeInputs, 'keyboard:KeyA'), {
    accepted: true,
    note: 'C4',
    noteStillActive: true,
  });
  assert.deepEqual(releaseActiveMelodyInput(activeInputs, 'launchpad:41'), {
    accepted: true,
    note: 'C4',
    noteStillActive: false,
  });
  assert.deepEqual(releaseActiveMelodyInput(activeInputs, 'launchpad:41'), {
    accepted: false,
    note: null,
    noteStillActive: false,
  });
});
