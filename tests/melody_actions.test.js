import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getMelodyScaleNoteIds,
  getMelodyScalePreviewNotes,
  isMelodyNoteInScale,
  isMelodyScalePitchClass,
  MELODY_NOTES,
  MELODY_NOTE_IDS,
  MELODY_PITCH_CLASSES,
  MELODY_SCALES,
} from '../src/data/melodyScales.js';
import {
  getMelodyInputCellByCode,
  getMelodyInputCellByLaunchpadNote,
  getMelodyInputGrid,
  isMelodyInputAreaVisible,
  MELODY_INPUT_ROWS,
} from '../src/input/melodyInputLayout.js';
import {
  clearMelodyBar,
  createMelodyCell,
  getMelodyCellToggleResult,
  getMelodyCellRenderState,
  isMelodyCellActive,
  isValidMelodyNote,
  setMelodyCell,
  setMelodyCellDuration,
  toggleMelodyCell,
} from '../src/app/melodyActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

test('melody input layout maps three QWERTY and Launchpad rows to dynamic scale octaves', () => {
  assert.deepEqual(MELODY_PITCH_CLASSES, [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  ]);
  assert.deepEqual(MELODY_INPUT_ROWS.map(({ octave }) => octave), [5, 4, 3]);
  assert.deepEqual(MELODY_INPUT_ROWS.map(({ launchpadNoteStart }) => launchpadNoteStart), [51, 41, 31]);
  assert.deepEqual(getMelodyInputGrid('chinese').map((row) => row.map(({ note }) => note)), [
    ['C5', 'D5', 'E5', 'G5', 'A5', null, null, null],
    ['C4', 'D4', 'E4', 'G4', 'A4', null, null, null],
    ['C3', 'D3', 'E3', 'G3', 'A3', null, null, null],
  ]);
  assert.deepEqual(getMelodyInputGrid('blues').map((row) => row.map(({ note }) => note)), [
    ['C5', 'D5', 'D#5', 'E5', 'G5', 'A5', null, null],
    ['C4', 'D4', 'D#4', 'E4', 'G4', 'A4', null, null],
    ['C3', 'D3', 'D#3', 'E3', 'G3', 'A3', null, null],
  ]);
  assert.equal(getMelodyInputCellByCode('KeyQ', 'chinese').note, 'C5');
  assert.equal(getMelodyInputCellByCode('Comma', 'chinese').note, null);
  assert.equal(getMelodyInputCellByLaunchpadNote(46, 'blues').note, 'A4');
  assert.equal(getMelodyInputCellByLaunchpadNote(47, 'blues').note, null);
  assert.equal(getMelodyInputCellByCode('Digit1', 'chinese'), null);
});

test('melody input visibility follows template workflow phases', () => {
  assert.equal(isMelodyInputAreaVisible({ hasTemplate: false, phase: 'idle' }), true);
  ['idle', 'overview', 'confirm', 'step-edit', 'sequence-capture', 'count-in', 'recording'].forEach((phase) => {
    assert.equal(isMelodyInputAreaVisible({ hasTemplate: true, phase }), true);
  });
  assert.equal(isMelodyInputAreaVisible({ hasTemplate: true, phase: 'unknown' }), false);
});

test('melody scale templates derive highlights and previews from the chromatic octave', () => {
  assert.deepEqual(MELODY_SCALES.chinese.highlightedPitchClasses, ['C', 'D', 'E', 'G', 'A']);
  assert.deepEqual(MELODY_SCALES.blues.highlightedPitchClasses, ['C', 'D', 'D#', 'E', 'G', 'A']);
  assert.deepEqual(getMelodyScalePreviewNotes('chinese'), ['C4', 'D4', 'E4', 'G4', 'A4']);
  assert.deepEqual(getMelodyScalePreviewNotes('blues'), ['C4', 'D4', 'D#4', 'E4', 'G4', 'A4']);
  assert.deepEqual(getMelodyScalePreviewNotes('major'), getMelodyScalePreviewNotes('chinese'));
  assert.deepEqual(getMelodyScalePreviewNotes('pentatonic'), getMelodyScalePreviewNotes('chinese'));
  assert.deepEqual(getMelodyScalePreviewNotes('missing'), getMelodyScalePreviewNotes('chinese'));
  assert.equal(isMelodyScalePitchClass('blues', 'D#'), true);
  assert.equal(isMelodyScalePitchClass('chinese', 'F'), false);
  assert.equal(isMelodyScalePitchClass('chinese', 'F#'), false);
  assert.equal(getMelodyScaleNoteIds('blues').length, 18);
  assert.equal(getMelodyScaleNoteIds('chinese').length, 15);
  assert.equal(getMelodyScaleNoteIds('chinese').includes('C3'), true);
  assert.equal(getMelodyScaleNoteIds('blues').includes('D#5'), true);
  assert.equal(isMelodyNoteInScale('chinese', 'G5'), true);
  assert.equal(isMelodyNoteInScale('chinese', 'F5'), false);
});

test('melody piano roll exposes three chromatic octaves with C4-B4 as its default window', () => {
  assert.equal(MELODY_NOTES.length, 36);
  assert.deepEqual(MELODY_NOTES.slice(12, 24).map(({ note }) => note), [
    'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4',
    'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
  ]);
  assert.equal(MELODY_NOTES.at(0).note, 'B5');
  assert.equal(MELODY_NOTES.at(-1).note, 'C3');
  assert.deepEqual(MELODY_NOTE_IDS, MELODY_NOTES.map(({ note }) => note));
  assert.equal(MELODY_NOTES.filter(({ root }) => root).length, 3);
  assert.equal(MELODY_NOTES.filter(({ sharp }) => sharp).length, 15);
});

test('every melody piano-roll semitone can be written and out-of-range notes are rejected', () => {
  MELODY_NOTE_IDS.forEach((note) => {
    assert.equal(isValidMelodyNote(note), true);
    assert.deepEqual(createMelodyCell(note), { type: 'melody', note });
    const matrix = toggleMelodyCell(createInitialMatrix(), 0, 0, note);
    assert.deepEqual(matrix.melody[0][0], { type: 'melody', note });
  });

  assert.equal(isValidMelodyNote('B2'), false);
  assert.equal(isValidMelodyNote('C6'), false);
  assert.equal(createMelodyCell('B2'), null);
  assert.equal(createMelodyCell('C6'), null);
});

test('toggleMelodyCell adds and removes independent notes in a sixteenth step', () => {
  const matrix = createInitialMatrix();

  const withC = toggleMelodyCell(matrix, 2, 5, 'C4');
  assert.deepEqual(withC.melody[2][5], { type: 'melody', note: 'C4' });
  assert.equal(isMelodyCellActive(withC, 2, 5, 'C4'), true);

  const withD = toggleMelodyCell(withC, 2, 5, 'D4');
  assert.deepEqual(withD.melody[2][5], { type: 'melody', notes: ['C4', 'D4'] });
  assert.equal(isMelodyCellActive(withD, 2, 5, 'C4'), true);
  assert.equal(isMelodyCellActive(withD, 2, 5, 'D4'), true);

  const cleared = toggleMelodyCell(withD, 2, 5, 'D4');
  assert.deepEqual(cleared.melody[2][5], { type: 'melody', note: 'C4' });
  assert.equal(toggleMelodyCell(cleared, 2, 5, 'C4').melody[2][5], null);
});

test('melody cell toggle result auditions added pitches but not removed pitches', () => {
  const matrix = createInitialMatrix();

  const added = getMelodyCellToggleResult(matrix, 2, 5, 'C4');
  assert.equal(added.auditionNote, 'C4');
  assert.deepEqual(added.nextMatrix.melody[2][5], { type: 'melody', note: 'C4' });

  const replaced = getMelodyCellToggleResult(added.nextMatrix, 2, 5, 'D4');
  assert.equal(replaced.auditionNote, 'D4');
  assert.deepEqual(replaced.nextMatrix.melody[2][5].notes, ['C4', 'D4']);

  const removed = getMelodyCellToggleResult(replaced.nextMatrix, 2, 5, 'D4');
  assert.equal(removed.auditionNote, null);
  assert.deepEqual(removed.nextMatrix.melody[2][5], { type: 'melody', note: 'C4' });
});

test('melody actions leave the matrix unchanged for invalid positions', () => {
  const matrix = createInitialMatrix();

  assert.equal(toggleMelodyCell(matrix, 0, -1, 'C4'), matrix);
  assert.equal(toggleMelodyCell(matrix, 0, 16, 'C4'), matrix);
  assert.equal(toggleMelodyCell(matrix, 0, 1.5, 'C4'), matrix);
  assert.equal(toggleMelodyCell(matrix, 99, 0, 'C4'), matrix);
  assert.equal(clearMelodyBar(matrix, 99), matrix);
});

test('clearMelodyBar clears only the selected melody bar', () => {
  const matrix = createInitialMatrix();
  matrix.melody[1][0] = { type: 'melody', note: 'C4' };
  matrix.melody[1][4] = { type: 'melody', note: 'D4' };
  matrix.melody[2][0] = { type: 'melody', note: 'E4' };
  matrix.drums[1][0] = { instruments: ['kick'] };

  const nextMatrix = clearMelodyBar(matrix, 1);

  assert.equal(nextMatrix.melody[1].every((cell) => cell === null), true);
  assert.deepEqual(nextMatrix.melody[2][0], { type: 'melody', note: 'E4' });
  assert.deepEqual(nextMatrix.drums[1][0], { instruments: ['kick'] });
});

test('melody cells store quantized durations and expose continuation render state', () => {
  const matrix = createInitialMatrix();
  const withNote = setMelodyCell(matrix, 0, 4, 'C4', 5);

  assert.deepEqual(withNote.melody[0][4], {
    type: 'melody',
    note: 'C4',
    durationSteps: 5,
  });
  assert.deepEqual(getMelodyCellRenderState(withNote, 0, 4, 'C4'), {
    active: true,
    durationSteps: 5,
    start: true,
    startStep: 4,
  });
  assert.deepEqual(getMelodyCellRenderState(withNote, 0, 8, 'C4'), {
    active: true,
    durationSteps: 5,
    start: false,
    startStep: 4,
  });
  assert.equal(getMelodyCellRenderState(withNote, 0, 9, 'C4').active, false);

  const clamped = setMelodyCellDuration(withNote, 0, 4, 99);
  assert.equal(clamped.melody[0][4].durationSteps, 12);
  assert.deepEqual(createMelodyCell('D4', 1), { type: 'melody', note: 'D4' });
});
