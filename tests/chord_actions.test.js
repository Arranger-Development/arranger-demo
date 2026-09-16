import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyChordTemplateToExistingClips,
  clearChordBar,
  clearChordCell,
  getChordEnrichTargetLabel,
  getPassingChordContext,
  getChordStepCell,
  getChordCell,
  getChordBeatDisplaySegments,
  getPassingChordDisplayLabel,
  hasExistingChordClipContent,
  setChordEnrichTarget,
  setChordCell,
  setChordNoteCell,
  getChordBarDisplayLabel,
  getChordSpanDisplayLabel,
  toggleChordNoteStep,
  setChordStepChord,
} from '../src/app/chordActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createChordClips(...bars) {
  const ids = bars.map((bar) => `chord-bar-${bar}`);
  return {
    ids,
    byId: Object.fromEntries(ids.map((id, index) => [
      id,
      { id, trackId: 'chord', bar: bars[index] },
    ])),
  };
}

test('setChordCell writes only the selected chord span in the selected bar', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][0] = { type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'] };
  matrix.drums[2][4] = { instruments: ['kick'] };

  const nextMatrix = setChordCell(matrix, 2, 0, 'G');

  assert.notEqual(nextMatrix, matrix);
  assert.notEqual(nextMatrix.chord, matrix.chord);
  assert.notEqual(nextMatrix.chord[2], matrix.chord[2]);
  assert.deepEqual(nextMatrix.chord[2][0], { type: 'chord', root: 'G', chordRoot: 'G', quality: 'maj', label: 'G', toneRoots: ['G', 'B', 'D'], tonePitches: ['G3', 'B3', 'D4'] });
  assert.equal(nextMatrix.chord[2][1], null);
  assert.equal(nextMatrix.chord[2][2], null);
  assert.deepEqual(nextMatrix.chord[0][0], { type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'] });
  assert.deepEqual(nextMatrix.drums[2][4], { instruments: ['kick'] });
  assert.equal(matrix.chord[2][0], null);
});

test('setChordCell updates only the beat start and preserves note enrichments', () => {
  let matrix = createInitialMatrix();
  matrix = setChordNoteCell(matrix, 2, 0, 0, 'F');
  matrix = setChordNoteCell(matrix, 2, 0, 1, 'D');
  matrix = setChordNoteCell(matrix, 2, 1, 2, 'E');

  const nextMatrix = setChordCell(matrix, 2, 0, 'Bdim');

  assert.deepEqual(nextMatrix.chord[2][0], {
    type: 'chord',
    root: 'B',
    chordRoot: 'Bdim',
    quality: 'dim',
    label: 'Bdim',
    toneRoots: ['B', 'D', 'F'],
    addedNotes: ['F'],
  });
  assert.deepEqual(nextMatrix.chord[2][1], { type: 'notes', notes: ['D'], label: 'D' });
  assert.equal(nextMatrix.chord[2][2], null);
  assert.equal(nextMatrix.chord[2][3], null);
  assert.deepEqual(nextMatrix.chord[2][6], { type: 'notes', notes: ['E'], label: 'E' });
});

test('setChordCell writes any selected beat start and preserves sibling columns', () => {
  let matrix = createInitialMatrix();
  matrix = setChordNoteCell(matrix, 1, 2, 1, 'D');
  matrix = setChordNoteCell(matrix, 1, 2, 2, 'E');
  matrix = setChordNoteCell(matrix, 1, 2, 3, 'A');
  matrix = setChordCell(matrix, 1, 2, 'F');

  assert.deepEqual(nextChordLabel(matrix, 1, 8), 'F');
  assert.deepEqual(matrix.chord[1][9], { type: 'notes', notes: ['D'], label: 'D' });
  assert.deepEqual(matrix.chord[1][10], { type: 'notes', notes: ['E'], label: 'E' });
  assert.deepEqual(matrix.chord[1][11], { type: 'notes', notes: ['A'], label: 'A' });
  assert.equal(matrix.chord[1][0], null);
});

test('getChordCell reads span start cells only', () => {
  const matrix = setChordCell(createInitialMatrix(), 3, 2, 'A#');

  assert.deepEqual(getChordCell(matrix, 3, 2), { type: 'chord', root: 'A#', chordRoot: 'A#', quality: 'maj', label: 'A#', toneRoots: ['A#', 'D', 'F'] });
  assert.equal(getChordCell(matrix, 3, 1), null);
  assert.equal(getChordCell(matrix, 8, 0), null);
});

test('chord display labels keep chord headers fixed while preserving added notes', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = setChordCell(matrix, 0, 1, 'F');
  matrix = setChordNoteCell(matrix, 0, 0, 2, 'D');
  matrix = setChordNoteCell(matrix, 0, 1, 2, 'E');

  assert.equal(getChordSpanDisplayLabel(matrix, 0, 0), 'C');
  assert.equal(getChordSpanDisplayLabel(matrix, 0, 1), 'F');
  assert.equal(getChordBarDisplayLabel(matrix, 0), 'C');
  assert.deepEqual(matrix.chord[0][2], { type: 'notes', notes: ['D'], label: 'D' });
  assert.deepEqual(matrix.chord[0][6], { type: 'notes', notes: ['E'], label: 'E' });
});

test('chord display labels ignore removed tones and keep explicit replacements', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C4');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C5');

  assert.deepEqual(matrix.chord[0][0], {
    type: 'chord',
    root: 'C',
    chordRoot: 'C',
    quality: 'maj',
    label: 'C',
    toneRoots: ['C', 'E', 'G'],
    tonePitches: ['C3', 'E3', 'G3'],
    addedNotes: ['C4', 'C5'],
  });
  assert.equal(getChordSpanDisplayLabel(matrix, 0, 0), 'C');
  assert.equal(getChordBarDisplayLabel(matrix, 0), 'C');
});

test('rich chord replacement preserves valid removed tones and drops invalid removed tones', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C4');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C5');

  const richMatrix = setChordEnrichTarget(matrix, 0, 0, 'Cmaj7');

  assert.deepEqual(richMatrix.chord[0][0], {
    type: 'chord',
    root: 'C',
    chordRoot: 'C',
    quality: 'maj7',
    label: 'Cmaj7',
    toneRoots: ['C', 'E', 'G', 'B'],
    tonePitches: ['C3', 'E3', 'G3', 'B3'],
    addedNotes: ['C4', 'C5'],
  });

  const changedRootMatrix = setChordEnrichTarget(richMatrix, 0, 0, 'G7');

  assert.deepEqual(changedRootMatrix.chord[0][0], {
    type: 'chord',
    root: 'G',
    chordRoot: 'G',
    quality: '7',
    label: 'G7',
    toneRoots: ['G', 'B', 'D', 'F'],
    tonePitches: ['G3', 'B3', 'D4', 'F3'],
    addedNotes: ['C4', 'C5'],
  });
});

test('chord display labels use groove source chord labels and merge arpeggio spans', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][0] = { type: 'notes', notes: ['C4'], label: 'C4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[0][2] = { type: 'notes', notes: ['E4'], label: 'E4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[0][4] = { type: 'notes', notes: ['G4'], label: 'G4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[0][6] = { type: 'notes', notes: ['C5'], label: 'C5', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };

  assert.equal(getChordSpanDisplayLabel(matrix, 0, 0), 'C');
  assert.equal(getChordSpanDisplayLabel(matrix, 0, 1), 'C');
  assert.equal(getChordBarDisplayLabel(matrix, 0), 'C');
  assert.deepEqual(getChordBeatDisplaySegments(matrix, 0), [
    { startBeat: 0, span: 2, label: 'C', hasValue: true, hasChord: false, mergeKey: 'arp-basic:C' },
    { startBeat: 2, span: 1, label: null, hasValue: false, hasChord: false, mergeKey: null },
    { startBeat: 3, span: 1, label: null, hasValue: false, hasChord: false, mergeKey: null },
  ]);
});

test('passing chord shortcut labels stay separate from beat header labels', () => {
  let matrix = createInitialMatrix();
  matrix = setChordStepChord(matrix, 2, 14, 'E7');

  assert.deepEqual(matrix.chord[2][14], {
    type: 'chord',
    root: 'E',
    chordRoot: 'E',
    quality: '7',
    label: 'E7',
    toneRoots: ['E', 'B', 'D', 'G#'],
    tonePitches: ['E3', 'B2', 'D3', 'G#3'],
    duration: '16n',
    grooveTemplateId: 'passing-shortcut',
    sourceChordLabel: 'E7',
  });
  assert.equal(getChordSpanDisplayLabel(matrix, 2, 3), null);
  assert.equal(getPassingChordDisplayLabel(matrix, 2, 14), 'E7');
  assert.deepEqual(getChordBeatDisplaySegments(matrix, 2)[3], {
    startBeat: 3,
    span: 1,
    label: null,
    hasValue: false,
    hasChord: false,
    mergeKey: null,
  });

  matrix = setChordCell(matrix, 2, 3, 'G');
  assert.equal(getChordSpanDisplayLabel(matrix, 2, 3), 'G');
  assert.equal(getPassingChordDisplayLabel(matrix, 2, 14), 'E7');
});

test('chord enrich target labels cover manual and groove sourced chords', () => {
  let matrix = createInitialMatrix();

  assert.equal(getChordEnrichTargetLabel(matrix, 0, 0), null);

  matrix = setChordCell(matrix, 0, 0, 'C');
  assert.equal(getChordEnrichTargetLabel(matrix, 0, 0), 'C');

  matrix.chord[0][12] = {
    type: 'chord',
    root: 'G',
    chordRoot: 'G',
    quality: 'maj',
    label: 'G',
    toneRoots: ['G', 'B', 'D'],
    duration: '16n',
    grooveTemplateId: 'block-syncopated',
    sourceChordLabel: 'G',
  };
  assert.equal(getChordEnrichTargetLabel(matrix, 0, 3), 'G');

  matrix.chord[0][4] = {
    type: 'notes',
    notes: ['A4'],
    label: 'A4',
    grooveTemplateId: 'arp-basic',
    sourceChordLabel: 'Am',
  };
  assert.equal(getChordEnrichTargetLabel(matrix, 0, 1), 'Am');
});

test('passing chord context follows enriched current and next chord clips', () => {
  let matrix = createInitialMatrix();
  const clips = createChordClips(0, 1);

  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = setChordEnrichTarget(matrix, 0, 0, 'Cmaj7');
  matrix = setChordCell(matrix, 1, 0, 'Am');
  matrix = setChordEnrichTarget(matrix, 1, 0, 'Am7');

  assert.deepEqual(getPassingChordContext(matrix, clips, 0), {
    currentChord: 'Cmaj7',
    targetChord: 'Am7',
  });
});

test('passing chord context uses the chord beside the passing shortcut as source', () => {
  let matrix = createInitialMatrix();
  const clips = createChordClips(0, 1);

  matrix = setChordCell(matrix, 0, 0, 'C');
  matrix = setChordCell(matrix, 0, 3, 'C');
  matrix = setChordEnrichTarget(matrix, 0, 3, 'Csus4');
  matrix = setChordCell(matrix, 1, 0, 'Am');

  assert.deepEqual(getPassingChordContext(matrix, clips, 0), {
    currentChord: 'Csus4',
    targetChord: 'Am',
  });
});

test('passing chord context uses groove source labels and preserves fallback targets', () => {
  const matrix = createInitialMatrix();
  const clips = createChordClips(0, 2);

  matrix.chord[0][0] = {
    type: 'notes',
    notes: ['C4'],
    label: 'C4',
    grooveTemplateId: 'arp-basic',
    sourceChordLabel: 'Cmaj7',
  };
  matrix.chord[2][0] = {
    type: 'chord',
    root: 'A',
    chordRoot: 'Am',
    quality: 'm7',
    label: 'Am7',
    toneRoots: ['A', 'C', 'E', 'G'],
    sourceChordLabel: 'Am7',
  };

  assert.deepEqual(getPassingChordContext(matrix, clips, 0), {
    currentChord: 'Cmaj7',
    targetChord: 'Am7',
  });

  matrix.chord[2][0] = null;
  assert.deepEqual(getPassingChordContext(matrix, clips, 0), {
    currentChord: 'Cmaj7',
    targetChord: 'Am',
  });

  assert.deepEqual(getPassingChordContext(matrix, createChordClips(0), 0), {
    currentChord: 'Cmaj7',
    targetChord: 'Am',
  });
});

test('setChordEnrichTarget replaces block groove chords while preserving hit shape', () => {
  let matrix = createInitialMatrix();
  matrix.chord[2][12] = {
    type: 'chord',
    root: 'G',
    chordRoot: 'G',
    quality: 'maj',
    label: 'G',
    toneRoots: ['G', 'B', 'D'],
    duration: '16n',
    grooveTemplateId: 'block-syncopated',
    sourceChordLabel: 'G',
  };
  matrix = setChordStepChord(matrix, 2, 14, 'E7');

  const nextMatrix = setChordEnrichTarget(matrix, 2, 3, 'G7');

  assert.deepEqual(nextMatrix.chord[2][12], {
    type: 'chord',
    root: 'G',
    chordRoot: 'G',
    quality: '7',
    label: 'G7',
    toneRoots: ['G', 'B', 'D', 'F'],
    tonePitches: ['G3', 'B3', 'D4', 'F3'],
    duration: '16n',
    grooveTemplateId: 'block-syncopated',
    sourceChordLabel: 'G7',
  });
  assert.equal(nextMatrix.chord[2][13], null);
  assert.deepEqual(nextMatrix.chord[2][14], matrix.chord[2][14]);
  assert.equal(nextMatrix.chord[2][15], null);
});

test('setChordEnrichTarget replaces arpeggio source labels while preserving hit steps', () => {
  const matrix = createInitialMatrix();
  matrix.chord[1][0] = { type: 'notes', notes: ['C4'], label: 'C4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[1][2] = { type: 'notes', notes: ['E4'], label: 'E4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[1][4] = { type: 'notes', notes: ['G4'], label: 'G4', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };
  matrix.chord[1][6] = { type: 'notes', notes: ['C5'], label: 'C5', grooveTemplateId: 'arp-basic', sourceChordLabel: 'C' };

  const nextMatrix = setChordEnrichTarget(matrix, 1, 1, 'Fmaj7');

  assert.deepEqual(nextMatrix.chord[1][0], matrix.chord[1][0]);
  assert.deepEqual(nextMatrix.chord[1][2], matrix.chord[1][2]);
  assert.deepEqual(nextMatrix.chord[1][4], {
    type: 'notes',
    notes: ['C4'],
    label: 'C4',
    grooveTemplateId: 'arp-basic',
    sourceChordLabel: 'Fmaj7',
  });
  assert.deepEqual(nextMatrix.chord[1][6], {
    type: 'notes',
    notes: ['E3'],
    label: 'E3',
    grooveTemplateId: 'arp-basic',
    sourceChordLabel: 'Fmaj7',
  });
});

function nextChordLabel(matrix, barIndex, step) {
  return matrix.chord[barIndex][step]?.label ?? null;
}

test('clearChordCell clears only one chord span', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 1, 0, 'C');
  matrix = setChordCell(matrix, 1, 2, 'F');
  matrix.bass[1][8] = { note: 'C2' };

  const nextMatrix = clearChordCell(matrix, 1, 0);

  assert.equal(nextMatrix.chord[1][0], null);
  assert.equal(nextMatrix.chord[1][1], null);
  assert.deepEqual(nextMatrix.chord[1][8], { type: 'chord', root: 'F', chordRoot: 'F', quality: 'maj', label: 'F', toneRoots: ['F', 'A', 'C'], tonePitches: ['F3', 'A3', 'C3'] });
  assert.deepEqual(nextMatrix.bass[1][8], { note: 'C2' });
});

test('clearChordBar clears the selected chord bar without touching other tracks', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 4, 0, 'C');
  matrix = setChordCell(matrix, 4, 1, 'D');
  matrix = setChordCell(matrix, 5, 0, 'E');
  matrix.melody[4][0] = { note: 'C4' };

  const nextMatrix = clearChordBar(matrix, 4);

  assert.equal(nextMatrix.chord[4].every((cell) => cell === null), true);
  assert.deepEqual(nextMatrix.chord[5][0], { type: 'chord', root: 'E', chordRoot: 'E', quality: 'maj', label: 'E', toneRoots: ['E', 'G#', 'B'] });
  assert.deepEqual(nextMatrix.melody[4][0], { note: 'C4' });
});

test('setChordNoteCell stores multi-note cells inside one step and preserves other steps', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 1, 0, 'C');
  matrix = setChordNoteCell(matrix, 1, 2, 3, 'A#');

  const movedNoteMatrix = setChordNoteCell(matrix, 1, 2, 1, 'F');

  assert.deepEqual(getChordStepCell(matrix, 1, 2, 3), { type: 'notes', notes: ['A#'], label: 'A#' });
  assert.deepEqual(movedNoteMatrix.chord[1][0], { type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'], tonePitches: ['C3', 'E3', 'G3'] });
  assert.equal(movedNoteMatrix.chord[1][1], null);
  assert.equal(movedNoteMatrix.chord[1][10], null);
  assert.deepEqual(getChordStepCell(movedNoteMatrix, 1, 2, 3), { type: 'notes', notes: ['A#'], label: 'A#' });
  assert.deepEqual(getChordStepCell(movedNoteMatrix, 1, 2, 1), { type: 'notes', notes: ['F'], label: 'F' });
});

test('toggleChordNoteStep toggles notes without clearing sibling columns', () => {
  let matrix = createInitialMatrix();
  matrix = toggleChordNoteStep(matrix, 2, 3, 2, 'D#');
  assert.deepEqual(getChordStepCell(matrix, 2, 3, 2), { type: 'notes', notes: ['D#'], label: 'D#' });

  matrix = toggleChordNoteStep(matrix, 2, 3, 1, 'G');
  assert.deepEqual(getChordStepCell(matrix, 2, 3, 2), { type: 'notes', notes: ['D#'], label: 'D#' });
  assert.deepEqual(getChordStepCell(matrix, 2, 3, 1), { type: 'notes', notes: ['G'], label: 'G' });

  matrix = toggleChordNoteStep(matrix, 2, 3, 1, 'A');
  assert.deepEqual(getChordStepCell(matrix, 2, 3, 1), { type: 'notes', notes: ['G', 'A'], label: 'G/A' });

  matrix = toggleChordNoteStep(matrix, 2, 3, 1, 'G');
  assert.deepEqual(getChordStepCell(matrix, 2, 3, 1), { type: 'notes', notes: ['A'], label: 'A' });
});

test('setChordStepChord writes a passing chord to one exact step only', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 2, 3, 'G');
  matrix = setChordNoteCell(matrix, 2, 3, 1, 'D');

  const nextMatrix = setChordStepChord(matrix, 2, 14, 'bA');

  assert.notEqual(nextMatrix, matrix);
  assert.notEqual(nextMatrix.chord[2], matrix.chord[2]);
  assert.deepEqual(nextMatrix.chord[2][14], {
    type: 'chord',
    root: 'G#',
    chordRoot: 'bA',
    quality: 'maj',
    label: 'bA',
    toneRoots: ['G#', 'C', 'D#'],
    tonePitches: ['G#3', 'C4', 'D#3'],
    duration: '16n',
    grooveTemplateId: 'passing-shortcut',
    sourceChordLabel: 'bA',
  });
  assert.deepEqual(nextMatrix.chord[2][12], matrix.chord[2][12]);
  assert.deepEqual(nextMatrix.chord[2][13], matrix.chord[2][13]);
  assert.deepEqual(nextMatrix.chord[2][15], matrix.chord[2][15]);
  assert.equal(matrix.chord[2][14], null);
});

test('setChordStepChord ignores invalid steps and chord names', () => {
  const matrix = createInitialMatrix();

  assert.equal(setChordStepChord(matrix, 2, -1, 'C'), matrix);
  assert.equal(setChordStepChord(matrix, 2, 16, 'C'), matrix);
  assert.equal(setChordStepChord(matrix, 2, 14, 'Hmaj7'), matrix);
});

test('applyChordTemplateToExistingClips overwrites existing chord clips with fresh template chords', () => {
  let matrix = createInitialMatrix();
  matrix = setChordCell(matrix, 0, 0, 'Cmaj7');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C4');
  matrix = toggleChordNoteStep(matrix, 0, 0, 0, 'C5');
  matrix = setChordNoteCell(matrix, 0, 1, 2, 'E');
  matrix = setChordCell(matrix, 4, 0, 'F');
  matrix.bass[2][0] = { note: 'C2' };
  const clips = {
    ids: ['chord-bar-0', 'drums-bar-1', 'chord-bar-3', 'chord-bar-5'],
    byId: {
      'chord-bar-0': { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
      'drums-bar-1': { id: 'drums-bar-1', trackId: 'drums', bar: 1 },
      'chord-bar-3': { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
      'chord-bar-5': { id: 'chord-bar-5', trackId: 'chord', bar: 5 },
    },
  };

  const nextMatrix = applyChordTemplateToExistingClips(matrix, clips, 'doowop');

  assert.deepEqual(nextMatrix.chord[0][0], {
    type: 'chord',
    root: 'C',
    chordRoot: 'C',
    quality: 'maj',
    label: 'C',
    toneRoots: ['C', 'E', 'G'],
    tonePitches: ['C3', 'E3', 'G3'],
  });
  assert.equal(nextMatrix.chord[0][1], null);
  assert.deepEqual(nextMatrix.chord[3][0].label, 'Am');
  assert.equal(nextMatrix.chord[3][1], null);
  assert.deepEqual(nextMatrix.chord[5][0].label, 'F');
  assert.equal(nextMatrix.chord[5][1], null);
  assert.deepEqual(nextMatrix.chord[0][6], { type: 'notes', notes: ['E'], label: 'E' });
  assert.deepEqual(nextMatrix.chord[4][0].label, 'F');
  assert.deepEqual(nextMatrix.bass[2][0], { note: 'C2' });
});

test('hasExistingChordClipContent only reports content in existing chord clips', () => {
  const matrix = createInitialMatrix();
  const clips = {
    ids: ['chord-bar-0', 'drums-bar-1', 'chord-bar-3'],
    byId: {
      'chord-bar-0': { id: 'chord-bar-0', trackId: 'chord', bar: 0 },
      'drums-bar-1': { id: 'drums-bar-1', trackId: 'drums', bar: 1 },
      'chord-bar-3': { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
    },
  };

  assert.equal(hasExistingChordClipContent(matrix, clips), false);

  matrix.chord[2][0] = { type: 'chord', label: 'F' };
  matrix.drums[1][0] = { instruments: ['kick'] };
  assert.equal(hasExistingChordClipContent(matrix, clips), false);

  matrix.chord[0][0] = {
    type: 'chord-source',
    label: 'C',
    sourceChordLabel: 'C',
  };
  assert.equal(hasExistingChordClipContent(matrix, clips), false);

  matrix.chord[0][6] = { type: 'notes', notes: ['E4'], label: 'E4' };
  assert.equal(hasExistingChordClipContent(matrix, clips), true);
  matrix.chord[0][6] = null;

  matrix.chord[3][14] = { type: 'chord', label: 'C/B', grooveTemplateId: 'passing-shortcut' };
  assert.equal(hasExistingChordClipContent(matrix, clips), true);
});
