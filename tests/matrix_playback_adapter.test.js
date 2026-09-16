import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createChordNotes,
  createMatrixPlaybackAdapter,
  extractBassEvent,
  extractChordEvent,
  extractDrumsInstruments,
  extractMelodyEvent,
} from '../src/audio/matrixPlaybackAdapter.js';
import { createPassingChordCell } from '../src/domain/chordCells.js';
import { STEPS_PER_BAR, TOTAL_BARS } from '../src/domain/musicConstants.js';
import { MELODY_NOTE_IDS } from '../src/data/melodyScales.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

test('extractDrumsInstruments reads drums cells', () => {
  assert.deepEqual(extractDrumsInstruments(null), []);
  assert.deepEqual(extractDrumsInstruments({ instruments: ['kick', 'tom', 'hihat'] }), ['kick', 'hihat']);
  assert.deepEqual(extractDrumsInstruments({ instrument: 'snare' }), ['snare']);
});

test('matrix playback adapter returns drums events for a matrix step', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick', 'hihat'] };
  matrix.drums[1][4] = { instrument: 'snare' };
  matrix.bass[0][0] = { type: 'bass', note: 'C1', duration: '8n' };

  const adapter = createMatrixPlaybackAdapter(() => matrix);

  assert.deepEqual(adapter.getEventsForStep(0, 0), [
    { type: 'drums', trackId: 'drums', bar: 0, step: 0, instrument: 'kick' },
    { type: 'drums', trackId: 'drums', bar: 0, step: 0, instrument: 'hihat' },
    { type: 'bass', trackId: 'bass', bar: 0, step: 0, note: 'C1', duration: '8n' },
  ]);
  assert.deepEqual(adapter.getEventsForStep(1, 4), [
    { type: 'drums', trackId: 'drums', bar: 1, step: 4, instrument: 'snare' },
  ]);
  assert.deepEqual(adapter.getEventsForStep(0, 1), []);
});

test('matrix playback adapter carries drum dynamics and microtiming into events', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][3] = {
    instruments: ['snare', 'hihat'],
    timingOffsets: { hihat: 0.12, snare: 0.16 },
    velocities: { hihat: 0.32, snare: 0.72 },
  };

  const adapter = createMatrixPlaybackAdapter(matrix);
  assert.deepEqual(adapter.getEventsForStep(0, 3), [
    {
      type: 'drums',
      trackId: 'drums',
      bar: 0,
      step: 3,
      instrument: 'snare',
      timingOffset: 0.16,
      velocity: 0.72,
    },
    {
      type: 'drums',
      trackId: 'drums',
      bar: 0,
      step: 3,
      instrument: 'hihat',
      timingOffset: 0.12,
      velocity: 0.32,
    },
  ]);
});

test('extractBassEvent reads bass cells into playable bass events', () => {
  assert.equal(extractBassEvent(null, 0, 0), null);
  assert.deepEqual(extractBassEvent({ type: 'bass', note: 'A#0', duration: '8n' }, 3, 8), {
    type: 'bass',
    trackId: 'bass',
    bar: 3,
    step: 8,
    note: 'A#0',
    duration: '8n',
  });
  assert.deepEqual(extractBassEvent({ note: 'C1' }, 3, 8), {
    type: 'bass',
    trackId: 'bass',
    bar: 3,
    step: 8,
    note: 'C1',
    duration: '16n',
  });
  assert.equal(extractBassEvent({ type: 'bass', note: 'H0' }, 3, 8), null);
});

test('extractMelodyEvent reads melody cells into playable melody events', () => {
  assert.equal(extractMelodyEvent(null, 0, 0), null);
  assert.deepEqual(extractMelodyEvent({ type: 'melody', note: 'C4' }, 3, 8), {
    type: 'melody',
    trackId: 'melody',
    bar: 3,
    step: 8,
    note: 'C4',
    duration: '16n',
  });
  assert.equal(extractMelodyEvent({ type: 'melody', note: 'H4' }, 3, 8), null);
  assert.deepEqual(
    extractMelodyEvent({ type: 'melody', note: 'D4', durationSteps: 3 }, 1, 6),
    {
      type: 'melody',
      trackId: 'melody',
      bar: 1,
      step: 6,
      note: 'D4',
      duration: '16n',
      durationSteps: 3,
    },
  );
});

test('extractMelodyEvent plays every semitone in the scrollable melody roll', () => {
  MELODY_NOTE_IDS.forEach((note) => {
    assert.deepEqual(extractMelodyEvent({ type: 'melody', note }, 0, 0), {
      type: 'melody',
      trackId: 'melody',
      bar: 0,
      step: 0,
      note,
      duration: '16n',
    });
  });

  assert.equal(extractMelodyEvent({ type: 'melody', note: 'B2' }, 0, 0), null);
  assert.equal(extractMelodyEvent({ type: 'melody', note: 'C6' }, 0, 0), null);
});

test('createChordNotes maps major chord roots to playable triads', () => {
  assert.deepEqual(createChordNotes('C'), ['C3', 'E3', 'G3']);
  assert.deepEqual(createChordNotes('F#'), ['F#4', 'A#4', 'C#4']);
  assert.deepEqual(createChordNotes('A#'), ['A#4', 'D4', 'F4']);
  assert.deepEqual(createChordNotes('Cmaj7'), ['C3', 'E3', 'G3', 'B3']);
  assert.deepEqual(createChordNotes('Am9'), ['A3', 'B3', 'C3', 'E3', 'G3']);
  assert.deepEqual(createChordNotes('E7'), ['E3', 'B2', 'D3', 'G#3']);
  assert.deepEqual(createChordNotes('Bø'), ['B2', 'D3', 'F3', 'A3']);
  assert.deepEqual(createChordNotes('Am/G'), ['G2', 'A3', 'C3', 'E3']);
  assert.deepEqual(createChordNotes('D7'), ['D4', 'C4', 'A3', 'F#3']);
  assert.deepEqual(createChordNotes('F#ø'), ['F#3', 'A3', 'C4', 'E4']);
  assert.deepEqual(createChordNotes('bA'), ['G#3', 'C4', 'D#3']);
  assert.deepEqual(createChordNotes('Bm7(no5)'), ['B2', 'D3', 'A3']);
  assert.deepEqual(createChordNotes('H'), []);
});

test('extractChordEvent reads chord cells into playable chord events', () => {
  assert.equal(extractChordEvent(null, 0, 0), null);
  assert.equal(
    extractChordEvent({
      type: 'chord-source',
      sourceChordLabel: 'C',
      progressionTemplateId: 'doo-wop',
      selectedGrooveTemplateId: 'block-basic',
    }, 0, 0),
    null,
  );
  assert.deepEqual(extractChordEvent({ type: 'note', note: 'C', label: 'C' }, 2, 6), {
    type: 'chord',
    trackId: 'chord',
    bar: 2,
    step: 6,
    root: null,
    quality: 'notes',
    label: 'C',
    notes: ['C4'],
    duration: '16n',
  });
  assert.deepEqual(extractChordEvent({ type: 'note', note: 'C5', label: 'C5' }, 2, 6), {
    type: 'chord',
    trackId: 'chord',
    bar: 2,
    step: 6,
    root: null,
    quality: 'notes',
    label: 'C5',
    notes: ['C5'],
    duration: '16n',
  });
  assert.deepEqual(extractChordEvent({ type: 'notes', notes: ['D', 'F'], label: 'D/F' }, 2, 6), {
    type: 'chord',
    trackId: 'chord',
    bar: 2,
    step: 6,
    root: null,
    quality: 'notes',
    label: 'D/F',
    notes: ['D4', 'F4'],
    duration: '16n',
  });
  assert.deepEqual(extractChordEvent({ type: 'notes', notes: ['D3', 'F5'], label: 'D3/F5' }, 2, 6), {
    type: 'chord',
    trackId: 'chord',
    bar: 2,
    step: 6,
    root: null,
    quality: 'notes',
    label: 'D3/F5',
    notes: ['D3', 'F5'],
    duration: '16n',
  });
  assert.deepEqual(
    extractChordEvent({ type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj7', label: 'Cmaj7', toneRoots: ['C', 'E', 'G', 'B'], tonePitches: ['C3', 'E3', 'G3', 'B3'], addedNotes: ['D'] }, 2, 4),
    {
      type: 'chord',
      trackId: 'chord',
      bar: 2,
      step: 4,
      root: 'C',
      quality: 'maj7',
      label: 'Cmaj7',
      notes: ['C3', 'E3', 'G3', 'B3', 'D4'],
      duration: '4n',
    },
  );
  assert.deepEqual(
    extractChordEvent({ type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj7', label: 'Cmaj7', toneRoots: ['C', 'E', 'G', 'B'], tonePitches: ['C3', 'E3', 'G3', 'B3'], addedNotes: ['D3', 'F5'] }, 2, 4),
    {
      type: 'chord',
      trackId: 'chord',
      bar: 2,
      step: 4,
      root: 'C',
      quality: 'maj7',
      label: 'Cmaj7',
      notes: ['C3', 'E3', 'G3', 'B3', 'D3', 'F5'],
      duration: '4n',
    },
  );
  assert.deepEqual(
    extractChordEvent({ type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj7', label: 'Cmaj7', toneRoots: ['C', 'E', 'G', 'B'], addedNotes: ['D'] }, 2, 4)?.notes,
    ['C4', 'E4', 'G4', 'B4', 'D4'],
  );
  assert.deepEqual(
    extractChordEvent({ type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'], removedTonePitches: ['C4'], addedNotes: ['C5'] }, 2, 4),
    {
      type: 'chord',
      trackId: 'chord',
      bar: 2,
      step: 4,
      root: 'C',
      quality: 'maj',
      label: 'C',
      notes: ['E4', 'G4', 'C5'],
      duration: '4n',
    },
  );
  assert.deepEqual(
    extractChordEvent({ type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'], tonePitches: ['C3', 'E3', 'G3'], removedTonePitches: ['C3'], addedNotes: ['C5', 'D'] }, 2, 4)?.notes,
    ['E3', 'G3', 'D4', 'C5'],
  );
  assert.deepEqual(
    extractChordEvent({
      type: 'notes',
      notes: ['C3'],
      label: 'C3',
      timingOffset: 0.28,
      velocity: 0.56,
    }, 1, 7),
    {
      type: 'chord',
      trackId: 'chord',
      bar: 1,
      step: 7,
      root: null,
      quality: 'notes',
      label: 'C3',
      notes: ['C3'],
      duration: '16n',
      timingOffset: 0.28,
      velocity: 0.56,
    },
  );
});

test('matrix playback adapter treats Beat 1 column 2 as sustain and plays multi-notes separately', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][4] = { instruments: ['hihat'] };
  matrix.chord[0][4] = { type: 'chord', root: 'G', chordRoot: 'G', quality: '7', label: 'G7', toneRoots: ['G', 'B', 'D', 'F'] };
  matrix.chord[0][5] = { type: 'chord', root: 'C', chordRoot: 'C', quality: 'maj', label: 'C', toneRoots: ['C', 'E', 'G'] };
  matrix.chord[0][6] = { type: 'notes', notes: ['D', 'F'], label: 'D/F' };

  const adapter = createMatrixPlaybackAdapter(() => matrix);

  assert.deepEqual(adapter.getEventsForStep(0, 4), [
    { type: 'drums', trackId: 'drums', bar: 0, step: 4, instrument: 'hihat' },
    {
      type: 'chord',
      trackId: 'chord',
      bar: 0,
      step: 4,
      root: 'G',
      quality: '7',
      label: 'G7',
      notes: ['G4', 'B4', 'D4', 'F4'],
      duration: '4n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(0, 5), []);
  assert.deepEqual(adapter.getEventsForStep(0, 6), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 0,
      step: 6,
      root: null,
      quality: 'notes',
      label: 'D/F',
      notes: ['D4', 'F4'],
      duration: '16n',
    },
  ]);
});

test('matrix playback adapter plays groove-authored short chord hits on any sixteenth step', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][6] = {
    type: 'chord',
    root: 'G',
    chordRoot: 'G',
    quality: '7',
    label: 'G7',
    toneRoots: ['G', 'B', 'D', 'F'],
    duration: '16n',
    grooveTemplateId: 'block-syncopated',
    sourceChordLabel: 'G7',
  };

  const adapter = createMatrixPlaybackAdapter(() => matrix);

  assert.deepEqual(adapter.getEventsForStep(0, 6), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 0,
      step: 6,
      root: 'G',
      quality: '7',
      label: 'G7',
      notes: ['G4', 'B4', 'D4', 'F4'],
      duration: '16n',
    },
  ]);
});

test('matrix playback adapter plays passing shortcut chord table tones at step fifteen', () => {
  const matrix = createInitialMatrix();
  matrix.chord[0][14] = createPassingChordCell('E7');
  matrix.chord[1][14] = createPassingChordCell('Bø');
  matrix.chord[2][14] = createPassingChordCell('Am/G');
  matrix.chord[3][14] = createPassingChordCell('D7');
  matrix.chord[4][14] = createPassingChordCell('F#ø');
  matrix.chord[5][14] = createPassingChordCell('bA');
  matrix.chord[6][14] = createPassingChordCell('Bm7(no5)');

  const adapter = createMatrixPlaybackAdapter(() => matrix);

  assert.deepEqual(adapter.getEventsForStep(0, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 0,
      step: 14,
      root: 'E',
      quality: '7',
      label: 'E7',
      notes: ['E3', 'B2', 'D3', 'G#3'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(1, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 1,
      step: 14,
      root: 'B',
      quality: 'half-dim7',
      label: 'Bø',
      notes: ['B2', 'D3', 'F3', 'A3'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(2, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 2,
      step: 14,
      root: 'G',
      quality: 'slash',
      label: 'Am/G',
      notes: ['G2', 'A3', 'C3', 'E3'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(3, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 3,
      step: 14,
      root: 'D',
      quality: '7',
      label: 'D7',
      notes: ['D4', 'C4', 'A3', 'F#3'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(4, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 4,
      step: 14,
      root: 'F#',
      quality: 'half-dim7',
      label: 'F#ø',
      notes: ['F#3', 'A3', 'C4', 'E4'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(5, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 5,
      step: 14,
      root: 'G#',
      quality: 'maj',
      label: 'bA',
      notes: ['G#3', 'C4', 'D#3'],
      duration: '16n',
    },
  ]);
  assert.deepEqual(adapter.getEventsForStep(6, 14), [
    {
      type: 'chord',
      trackId: 'chord',
      bar: 6,
      step: 14,
      root: 'B',
      quality: 'm7-no5',
      label: 'Bm7(no5)',
      notes: ['B2', 'D3', 'A3'],
      duration: '16n',
    },
  ]);
});

test('matrix playback adapter includes melody melody events for transport playback', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.bass[0][0] = { type: 'bass', note: 'G0', duration: '8n' };
  matrix.melody[0][0] = { type: 'melody', note: 'E4' };

  const adapter = createMatrixPlaybackAdapter(() => matrix);

  assert.deepEqual(adapter.getEventsForStep(0, 0), [
    { type: 'drums', trackId: 'drums', bar: 0, step: 0, instrument: 'kick' },
    {
      type: 'bass',
      trackId: 'bass',
      bar: 0,
      step: 0,
      note: 'G0',
      duration: '8n',
    },
    {
      type: 'melody',
      trackId: 'melody',
      bar: 0,
      step: 0,
      note: 'E4',
      duration: '16n',
    },
  ]);
});

test('matrix playback adapter wraps flat transport steps across eight bars', () => {
  const matrix = createInitialMatrix();
  matrix.drums[7][15] = { instruments: ['kick'] };

  const adapter = createMatrixPlaybackAdapter(matrix);
  const lastFlatStep = TOTAL_BARS * STEPS_PER_BAR - 1;

  assert.deepEqual(adapter.getPositionForFlatStep(lastFlatStep), { bar: 7, step: 15 });
  assert.deepEqual(adapter.getPositionForFlatStep(lastFlatStep + 1), { bar: 0, step: 0 });
  assert.deepEqual(adapter.getEventsForFlatStep(lastFlatStep), [
    { type: 'drums', trackId: 'drums', bar: 7, step: 15, instrument: 'kick' },
  ]);
});
