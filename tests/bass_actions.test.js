import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as bassActions from '../src/app/bassActions.js';
import {
  applyBassGrooveTemplateToBar,
  BASS_GROOVE_TEMPLATES,
  clearBassBar,
  createBassPreviewEvents,
  getBassCellToggleResult,
  hasExistingBassClipContent,
  isBassCellActive,
  toggleBassCell,
} from '../src/app/bassActions.js';
import { getBassGroovePreviewSteps } from '../src/app/bassGroovePreview.js';
import { BASS_NOTES } from '../src/data/bassNotes.js';
import {
  createChordCell,
} from '../src/domain/chordCells.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createClips(...records) {
  return {
    ids: records.map((clip) => clip.id),
    byId: Object.fromEntries(records.map((clip) => [clip.id, clip])),
  };
}

test('bass notes expose a low three-octave pitch rail from B2 down to C0', () => {
  assert.equal(BASS_NOTES.length, 36);
  assert.deepEqual(BASS_NOTES.map((note) => note.label).slice(0, 12), [
    'B2',
    'A#2',
    'A2',
    'G#2',
    'G2',
    'F#2',
    'F2',
    'E2',
    'D#2',
    'D2',
    'C#2',
    'C2',
  ]);
  assert.equal(BASS_NOTES.at(12).note, 'B1');
  assert.equal(BASS_NOTES.at(23).note, 'C1');
  assert.equal(BASS_NOTES.at(-1).note, 'C0');
  assert.equal(BASS_NOTES.filter((note) => note.root).length, 3);
});

test('toggleBassCell writes replaces and clears one bass note per sixteenth step', () => {
  const matrix = createInitialMatrix();

  const withC = toggleBassCell(matrix, 2, 5, 'C1');
  assert.deepEqual(withC.bass[2][5], { type: 'bass', note: 'C1', duration: '16n' });
  assert.equal(isBassCellActive(withC, 2, 5, 'C1'), true);

  const withD = toggleBassCell(withC, 2, 5, 'F#0');
  assert.deepEqual(withD.bass[2][5], { type: 'bass', note: 'F#0', duration: '16n' });
  assert.equal(isBassCellActive(withD, 2, 5, 'C1'), false);
  assert.equal(isBassCellActive(withD, 2, 5, 'F#0'), true);

  const cleared = toggleBassCell(withD, 2, 5, 'F#0');
  assert.equal(cleared.bass[2][5], null);
});

test('bass cell toggle result auditions additions and replacements but not removals', () => {
  const matrix = createInitialMatrix();

  const added = getBassCellToggleResult(matrix, 2, 5, 'C1');
  assert.equal(added.auditionNote, 'C1');
  assert.deepEqual(added.nextMatrix.bass[2][5], {
    type: 'bass',
    note: 'C1',
    duration: '16n',
  });

  const replaced = getBassCellToggleResult(added.nextMatrix, 2, 5, 'F#0');
  assert.equal(replaced.auditionNote, 'F#0');
  assert.equal(replaced.nextMatrix.bass[2][5].note, 'F#0');

  const removed = getBassCellToggleResult(replaced.nextMatrix, 2, 5, 'F#0');
  assert.equal(removed.auditionNote, null);
  assert.equal(removed.nextMatrix.bass[2][5], null);
});

test('clearBassBar clears only the selected bass bar', () => {
  const matrix = createInitialMatrix();
  matrix.bass[1][0] = { type: 'bass', note: 'C1', duration: '16n' };
  matrix.bass[1][4] = { type: 'bass', note: 'G0', duration: '16n' };
  matrix.bass[2][0] = { type: 'bass', note: 'F#0', duration: '16n' };
  matrix.drums[1][0] = { instruments: ['kick'] };

  const nextMatrix = clearBassBar(matrix, 1);

  assert.equal(nextMatrix.bass[1].every((cell) => cell === null), true);
  assert.deepEqual(nextMatrix.bass[2][0], { type: 'bass', note: 'F#0', duration: '16n' });
  assert.deepEqual(nextMatrix.drums[1][0], { instruments: ['kick'] });
});

test('bass groove templates match the three reference picker options', () => {
  assert.deepEqual(BASS_GROOVE_TEMPLATES.map((template) => template.id), [
    'bass-8th-basic',
    'bass-8th-swing',
    'bass-16th-swing',
  ]);
  assert.deepEqual(BASS_GROOVE_TEMPLATES.map((template) => template.steps), [
    [0, 4, 8, 12],
    [0, 4, 10, 14],
    [0, 3, 6, 8, 12],
  ]);
  assert.deepEqual(BASS_GROOVE_TEMPLATES.map((template) => template.duration), [
    '8n',
    '8n',
    '16n',
  ]);
});

test('bass groove picker preview expands eighth notes onto sixteenth cells', () => {
  assert.deepEqual(
    BASS_GROOVE_TEMPLATES.map((template) => getBassGroovePreviewSteps(template)),
    [
      [0, 1, 4, 5, 8, 9, 12, 13],
      [0, 1, 4, 5, 10, 11, 14, 15],
      [0, 3, 6, 8, 12],
    ],
  );
});

test('applyBassGrooveTemplateToBar writes current bass clip from same-beat chord roots only', () => {
  const matrix = createInitialMatrix();
  matrix.bass[1][0] = { type: 'bass', note: 'D1', duration: '16n' };
  matrix.bass[2][15] = { type: 'bass', note: 'B0', duration: '16n' };
  matrix.chord[2][0] = createChordCell('C');
  matrix.chord[2][4] = createChordCell('G');
  matrix.chord[2][8] = createChordCell('Am');
  matrix.chord[2][12] = createChordCell('F');

  const nextMatrix = applyBassGrooveTemplateToBar(matrix, 2, 'bass-8th-basic');

  assert.deepEqual(nextMatrix.bass[2][0], {
    type: 'bass',
    note: 'C1',
    duration: '8n',
    grooveTemplateId: 'bass-8th-basic',
  });
  assert.deepEqual(nextMatrix.bass[2][4], {
    type: 'bass',
    note: 'G0',
    duration: '8n',
    grooveTemplateId: 'bass-8th-basic',
  });
  assert.deepEqual(nextMatrix.bass[2][8], {
    type: 'bass',
    note: 'A0',
    duration: '8n',
    grooveTemplateId: 'bass-8th-basic',
  });
  assert.deepEqual(nextMatrix.bass[2][12], {
    type: 'bass',
    note: 'F0',
    duration: '8n',
    grooveTemplateId: 'bass-8th-basic',
  });
  assert.equal(nextMatrix.bass[2][15], null);
  assert.deepEqual(nextMatrix.bass[1][0], { type: 'bass', note: 'D1', duration: '16n' });
});

test('applyBassGrooveTemplateToExistingClips writes all existing bass clips from each bar chord roots', () => {
  const { applyBassGrooveTemplateToExistingClips } = bassActions;
  const matrix = createInitialMatrix();
  const clips = createClips(
    { id: 'bass-bar-0', trackId: 'bass', bar: 0 },
    { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
    { id: 'drums-bar-1', trackId: 'drums', bar: 1 },
    { id: 'bass-bar-2', trackId: 'bass', bar: 2 },
    { id: 'chord-bar-2', trackId: 'chord', bar: 2 },
  );
  matrix.bass[0][15] = { type: 'bass', note: 'B0', duration: '16n' };
  matrix.bass[2][7] = { type: 'bass', note: 'D1', duration: '16n' };
  matrix.bass[4][0] = { type: 'bass', note: 'F#0', duration: '16n' };
  matrix.drums[1][0] = { instruments: ['kick'] };
  matrix.melody[2][2] = { type: 'melody', note: 'G4' };
  matrix.chord[0][0] = createChordCell('C');
  matrix.chord[0][4] = createChordCell('G');
  matrix.chord[0][8] = createChordCell('Am');
  matrix.chord[0][12] = createChordCell('F');
  matrix.chord[2][0] = createChordCell('D');
  matrix.chord[2][8] = createChordCell('A#');

  assert.equal(typeof applyBassGrooveTemplateToExistingClips, 'function');
  const nextMatrix = applyBassGrooveTemplateToExistingClips(matrix, clips, 'bass-8th-basic');

  assert.deepEqual(
    [0, 4, 8, 12].map((step) => nextMatrix.bass[0][step]?.note),
    ['C1', 'G0', 'A0', 'F0'],
  );
  assert.deepEqual(
    [0, 4, 8, 12].map((step) => nextMatrix.bass[2][step]?.note),
    ['D1', 'D1', 'A#0', 'D1'],
  );
  assert.equal(nextMatrix.bass[0][15], null);
  assert.equal(nextMatrix.bass[2][7], null);
  assert.deepEqual(nextMatrix.bass[4][0], { type: 'bass', note: 'F#0', duration: '16n' });
  assert.deepEqual(nextMatrix.drums[1][0], { instruments: ['kick'] });
  assert.deepEqual(nextMatrix.melody[2][2], { type: 'melody', note: 'G4' });
});

test('applyBassGrooveTemplateToExistingClips keeps bass bars empty without a matching chord clip', () => {
  const { applyBassGrooveTemplateToExistingClips } = bassActions;
  const matrix = createInitialMatrix();
  const clips = createClips(
    { id: 'bass-bar-0', trackId: 'bass', bar: 0 },
    { id: 'bass-bar-2', trackId: 'bass', bar: 2 },
    { id: 'chord-bar-2', trackId: 'chord', bar: 2 },
  );
  matrix.bass[0][0] = { type: 'bass', note: 'B0', duration: '16n' };
  matrix.chord[2][0] = createChordCell('D');

  const nextMatrix = applyBassGrooveTemplateToExistingClips(matrix, clips, 'bass-8th-basic');

  assert.equal(nextMatrix.bass[0].every((cell) => cell === null), true);
  assert.deepEqual(
    [0, 4, 8, 12].map((step) => nextMatrix.bass[2][step]?.note),
    ['D1', 'D1', 'D1', 'D1'],
  );
});

test('applyBassGrooveTemplateToExistingClips is a no-op without bass clips or a valid template', () => {
  const { applyBassGrooveTemplateToExistingClips } = bassActions;
  const matrix = createInitialMatrix();
  const noBassClips = createClips(
    { id: 'drums-bar-0', trackId: 'drums', bar: 0 },
    { id: 'chord-bar-1', trackId: 'chord', bar: 1 },
  );

  assert.equal(applyBassGrooveTemplateToExistingClips(matrix, noBassClips, 'bass-8th-basic'), matrix);
  assert.equal(applyBassGrooveTemplateToExistingClips(matrix, noBassClips, 'missing'), matrix);
});

test('hasExistingBassClipContent only reports notes inside existing Bass clips', () => {
  const matrix = createInitialMatrix();
  const clips = createClips(
    { id: 'bass-bar-0', trackId: 'bass', bar: 0 },
    { id: 'chord-bar-1', trackId: 'chord', bar: 1 },
  );

  matrix.bass[2][0] = { type: 'bass', note: 'D1', duration: '16n' };
  matrix.chord[1][0] = createChordCell('C');
  assert.equal(hasExistingBassClipContent(matrix, clips), false);

  matrix.bass[0][4] = { type: 'bass', note: 'G0', duration: '16n' };
  assert.equal(hasExistingBassClipContent(matrix, clips), true);

  matrix.bass[0][4] = { note: 'A0' };
  assert.equal(hasExistingBassClipContent(matrix, clips), true);
});

test('bass groove templates fall back to the first bar chord and then C1', () => {
  const matrix = createInitialMatrix();
  matrix.chord[3][0] = createChordCell('D');
  matrix.chord[3][8] = createChordCell('A#');

  const withChords = applyBassGrooveTemplateToBar(matrix, 3, 'bass-16th-swing');
  assert.equal(withChords.bass[3][0].note, 'D1');
  assert.equal(withChords.bass[3][3].note, 'D1');
  assert.equal(withChords.bass[3][6].note, 'D1');
  assert.equal(withChords.bass[3][8].note, 'A#0');
  assert.equal(withChords.bass[3][12].note, 'D1');

  const withoutChords = applyBassGrooveTemplateToBar(createInitialMatrix(), 4, 'bass-8th-swing');
  assert.deepEqual(withoutChords.bass[4].filter(Boolean).map((cell) => cell.note), [
    'C1',
    'C1',
    'C1',
    'C1',
  ]);
});

test('createBassPreviewEvents returns timed playable root-note events', () => {
  const matrix = createInitialMatrix();
  matrix.chord[2][0] = createChordCell('C');
  matrix.chord[2][4] = createChordCell('F#');
  matrix.chord[2][8] = createChordCell('G');
  matrix.chord[2][12] = createChordCell('Am');

  assert.deepEqual(createBassPreviewEvents(matrix, 2, 'bass-8th-swing'), [
    { step: 0, note: 'C1', duration: '8n' },
    { step: 4, note: 'F#0', duration: '8n' },
    { step: 10, note: 'G0', duration: '8n' },
    { step: 14, note: 'A0', duration: '8n' },
  ]);
});
