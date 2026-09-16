import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASS_NOTES } from '../src/data/bassNotes.js';
import { MELODY_NOTES } from '../src/data/melodyScales.js';
import {
  createPianoRollNotes,
  PIANO_ROLL_NOTES_PER_OCTAVE,
  PIANO_ROLL_OCTAVE_COUNT,
  PIANO_ROLL_PITCH_CLASSES_DESC,
  PIANO_ROLL_VISIBLE_ROWS,
} from '../src/data/pianoRollNotes.js';
import {
  getOctavePitchScrollStep,
  getPitchPageStartRow,
  getPitchRowStride,
  getPitchScrollTopForRow,
  hasPitchScrollRows,
  isPitchRowFullyVisible,
} from '../src/app/usePitchScrollSync.js';

const DEFAULT_VIEWPORT = Object.freeze({
  clientHeight: 218,
  scrollHeight: 636,
});

test('piano-roll note generator returns a frozen descending chromatic range', () => {
  const notes = createPianoRollNotes({ lowestOctave: 1 });

  assert.equal(PIANO_ROLL_NOTES_PER_OCTAVE, 12);
  assert.equal(PIANO_ROLL_OCTAVE_COUNT, 3);
  assert.equal(PIANO_ROLL_VISIBLE_ROWS, 12);
  assert.deepEqual(PIANO_ROLL_PITCH_CLASSES_DESC, [
    'B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C',
  ]);
  assert.equal(notes.length, 36);
  assert.equal(Object.isFrozen(notes), true);
  assert.equal(notes.every(Object.isFrozen), true);
  assert.deepEqual(notes.at(0), {
    label: 'B3',
    note: 'B3',
    rootName: 'B',
    octave: 3,
    sharp: false,
    root: false,
  });
  assert.deepEqual(notes.at(-1), {
    label: 'C1',
    note: 'C1',
    rootName: 'C',
    octave: 1,
    sharp: false,
    root: true,
  });
  assert.equal(notes.filter(({ root }) => root).length, 3);
  assert.equal(notes.filter(({ sharp }) => sharp).length, 15);
  assert.throws(() => createPianoRollNotes({ lowestOctave: 1.5 }), TypeError);
  assert.throws(() => createPianoRollNotes({ lowestOctave: 1, octaveCount: 0 }), RangeError);
});

test('bass and melody keep scrollable three-octave ranges with their own default windows', () => {
  assert.equal(BASS_NOTES.length, 36);
  assert.equal(BASS_NOTES.at(0).note, 'B2');
  assert.equal(BASS_NOTES.at(-1).note, 'C0');
  assert.deepEqual(BASS_NOTES.slice(21, 33).map(({ note }) => note), [
    'D1', 'C#1', 'C1', 'B0', 'A#0', 'A0',
    'G#0', 'G0', 'F#0', 'F0', 'E0', 'D#0',
  ]);

  assert.equal(MELODY_NOTES.length, 36);
  assert.equal(MELODY_NOTES.at(0).note, 'B5');
  assert.equal(MELODY_NOTES.at(-1).note, 'C3');
  assert.deepEqual(MELODY_NOTES.slice(12, 24).map(({ note }) => note), [
    'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4',
    'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
  ]);
});

test('piano-roll scroll math moves by twelve logical rows and clamps at either edge', () => {
  const rowStride = getPitchRowStride(DEFAULT_VIEWPORT);

  assert.equal(rowStride, 418 / 24);
  assert.equal(getOctavePitchScrollStep(DEFAULT_VIEWPORT), rowStride * 12);
  assert.equal(getPitchScrollTopForRow(DEFAULT_VIEWPORT, 21), rowStride * 21);
  assert.equal(getPitchScrollTopForRow(DEFAULT_VIEWPORT, 33), 418);
  assert.equal(getPitchScrollTopForRow(DEFAULT_VIEWPORT, -1), 0);
  assert.equal(getPitchPageStartRow(4), 0);
  assert.equal(getPitchPageStartRow(12), 12);
  assert.equal(getPitchPageStartRow(35), 24);

  const bassDefaultTop = getPitchScrollTopForRow(DEFAULT_VIEWPORT, 21);
  assert.equal(isPitchRowFullyVisible(DEFAULT_VIEWPORT, bassDefaultTop, 21), true);
  assert.equal(isPitchRowFullyVisible(DEFAULT_VIEWPORT, bassDefaultTop, 32), true);
  assert.equal(isPitchRowFullyVisible(DEFAULT_VIEWPORT, bassDefaultTop, 20), false);
  assert.equal(isPitchRowFullyVisible(DEFAULT_VIEWPORT, bassDefaultTop, 33), false);
});

test('pitch wheel handling only captures ranges taller than the visible octave', () => {
  assert.equal(hasPitchScrollRows(BASS_NOTES.length), true);
  assert.equal(hasPitchScrollRows(MELODY_NOTES.length), true);
  assert.equal(hasPitchScrollRows(PIANO_ROLL_VISIBLE_ROWS), false);
  assert.equal(hasPitchScrollRows(PIANO_ROLL_VISIBLE_ROWS - 1), false);
});
