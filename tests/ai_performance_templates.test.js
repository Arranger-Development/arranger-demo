import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AI_PERFORMANCE_PROFILE_ID as profile } from '../src/data/aiPerformanceTemplates.js';
import {
  createPerformanceMatrix, createPerformanceSequence, emptySelection, performanceTemplates,
  readPerformanceSession, writePerformanceSession, performanceStorageKey,
} from '../src/app/performanceModel.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createChordStylePresetBar } from '../src/app/chordStylePresetActions.js';

const genre = 'electronic-edm';
const templates = performanceTemplates(genre, profile);
const choose = (track, index) => ({ ...emptySelection(), [track]: templates[track][index].id });
const render = (selection) => createPerformanceMatrix(selection, genre, profile);

// Independent one-based score fixtures: Notion drums/bass, Excel melody (2026-09-14).
// Excel B–Q = positions 1–16; omit B2/G#2 only, keeping all remaining green cells.
const drumScore = [
  ['悸动节奏', ['1,13', '', '1,2,3,5,7,11,15']],
  ['摇摆行进', ['1,2,5,13', '9', '1,2,3,5,7,11,15']],
  ['街头舞步', ['1,4,7,13', '9', '1,2,3,4,5,7,9,10,11,13,14,15']],
  ['放慢脚步', ['1,7', '9', '1,2,3,5,7,9,10,11,13,15']],
  ['凝神屏气', ['', '', '1,3,4,5,7,8,9,11,12,13,15,16']],
  ['全力以赴', ['1,4,8,9,15', '5,13', '1,2,3,4,5,7,8,9,10,11,13,14,15,16'],
    ['1,3,4,8,11', '5,13', '1,2,3,4,5,7,8,9,10,11,12,13,14,15']],
];
const pitchedScore = {
  bass: [
    ['小心翼翼', '1:C#1 9:C#1 11:D#1 14:E1'],
    ['飞扬贝斯', '1:G#0 4:G#0 7:G#0 9:B0 11:C#1 13:G#1'],
    ['凝视深渊', '1:C#1 9:C#1 13:E1'],
    ['庆典时刻', '1:C#1 2:B0 5:C#1 7:C#1 9:C#1 10:G#1 11:C#1 13:C#1 15:B0'],
  ],
  melody: [
    ['婉约涟漪1', '1:B3 1:F#3 1:E3 1:C#3 9:B3 9:F#3 9:E3 9:C#3 14:E3',
      '1:D#3 1:C#3 9:C#4 13:B3', '1:G#3 1:C#3 9:E3 13:B3',
      '1:G#3 1:C#3 11:B3 11:G#3 11:E3 11:C#3 13:D#3'],
    ['婉约涟漪2', '1:E3 1:C#3 9:F#3 13:B3', '1:D#3 9:F#3 13:B3',
      '1:E3 1:C#3 9:E3 13:D#3', '1:E3 11:C#4 12:G#3 13:E3 15:F#3'],
    ['婉约涟漪3', '1:E3 1:C#3', '1:D#3 13:B3',
      '1:E3 1:C#3 9:E3 13:D#3', '1:E3 13:F#3 15:E3'],
    ['怦然心动', '1:B3 1:F#3 1:E3 1:C#3 3:B3 3:E3 3:C#3 9:B3 9:F#3 9:E3 9:C#3 13:E3',
      '1:D#3 1:C#3 9:C#4 13:B3',
      '1:C#4 1:F#3 1:E3 1:C#3 3:B3 3:F#3 3:E3 3:C#3 9:B3 9:F#3 9:E3 9:C#3 13:C#4 13:E3',
      '1:G#3 1:F#3 1:E3 1:C#3 11:C#4 11:B3 11:G#3 11:D#3 14:B3 14:G#3 14:D#3'],
  ],};

test('AI drum scores reproduce every hit, including distinct bars and intentional silence', () => {
  assert.equal(templates.drums.length, drumScore.length);
  drumScore.forEach(([name, ...bars], index) => {
    assert.equal(templates.drums[index].name, name);
    assert.equal(templates.drums[index].barCount, bars.length);
    const matrix = render(choose('drums', index));
    const adapter = createMatrixPlaybackAdapter(matrix, { totalBars: matrix.drums.length });
    matrix.drums.forEach((_, bar) => {
      const events = Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(bar, step)).flat();
      assert.deepEqual(['kick', 'snare', 'hihat'].map((instrument) => events
        .filter((event) => event.instrument === instrument).map((event) => event.step + 1).join(',')), bars[bar % bars.length], name);
      assert.ok(events.every((event) => (event.velocity ?? 1) === 1 && (event.timingOffset ?? 0) === 0));
    });
  });
});

test('AI bass and melody scores preserve pitch, octave, rests, repetitions and sixteenth durations', () => {
  for (const track of ['bass', 'melody']) {
    assert.equal(templates[track].length, 4);
    pitchedScore[track].forEach(([name, ...bars], index) => {
      assert.equal(templates[track][index].name, name);
      assert.equal(templates[track][index].barCount, bars.length);
      const matrix = render(choose(track, index));
      assert.deepEqual(render(choose(track, index)), matrix);
      const adapter = createMatrixPlaybackAdapter(matrix, { totalBars: matrix[track].length });
      matrix[track].forEach((_, bar) => {
        const events = Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(bar, step)).flat();
        assert.equal(events.map((event) => `${event.step + 1}:${event.note}`).join(' '), bars[bar % bars.length], name);
        assert.ok(events.every((event) => event.duration === '16n'));
        if (track === 'melody') assert.ok(events.every((event) => event.timbreId === 'piano' && event.playbackMode === 'natural'));
      });
    });
  }
});

test('four-bar phrases repeat complete short parts without changing existing harmony or fixed bass pitch', () => {
  const selection = { drums: templates.drums[5].id, chord: templates.chord[2].id,
    bass: templates.bass[3].id, melody: templates.melody[2].id };
  const matrix = render(selection);
  assert.deepEqual(matrix.drums[0], matrix.drums[2]);
  assert.deepEqual(matrix.drums[1], matrix.drums[3]);
  assert.notDeepEqual(matrix.drums[0], matrix.drums[1]);
  for (let bar = 0; bar < 4; bar += 1) {
    assert.deepEqual(matrix.bass[bar], matrix.bass[0]);
    assert.deepEqual(matrix.chord[bar], createChordStylePresetBar(selection.chord, bar % 2));
  }
  assert.deepEqual(render({ ...selection, chord: null }).bass, matrix.bass);
  assert.deepEqual(render({ ...selection, chord: templates.chord[4].id }).bass, matrix.bass);
  assert.ok(render({ ...selection, chord: null }).chord.flat().every((cell) => cell === null));
});

test('mixed phrase lengths use exact segment boundaries and twenty bars wrap only after Loop 5', () => {
  const short = choose('drums', 0);
  const long = choose('melody', 3);
  const mixed = createPerformanceSequence([short, emptySelection(), long, short, long], genre, profile);
  assert.equal(mixed.totalBars, 12);
  assert.deepEqual(mixed.segments, [
    { loopIndex: 0, startStep: 0, totalSteps: 32 }, { loopIndex: 2, startStep: 32, totalSteps: 64 },
    { loopIndex: 3, startStep: 96, totalSteps: 32 }, { loopIndex: 4, startStep: 128, totalSteps: 64 },
  ]);
  const sequence = createPerformanceSequence(Array.from({ length: 5 }, () => ({ ...long })), genre, profile);
  assert.equal(sequence.totalBars, 20);
  const adapter = createMatrixPlaybackAdapter(sequence.matrix, { totalBars: 20 });
  for (let step = 0; step < 320; step += 1) {
    assert.equal(adapter.getPositionForFlatStep(step).bar, Math.floor(step / 16));
  }
  assert.deepEqual(adapter.getPositionForFlatStep(320), { bar: 0, step: 0 });
  const before = structuredClone(mixed);
  long.melody = null;
  assert.deepEqual(mixed, before);
});

test('new AI sessions default to 100 BPM and never reinterpret or overwrite old genre loops', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const oldSession = { bpm: 91, saved: Array.from({ length: 5 }, () => ({ ...emptySelection(), drums: performanceTemplates(genre).drums[0].id })) };
  writePerformanceSession(storage, genre, oldSession);
  const oldValue = data.get(performanceStorageKey(genre));
  const fresh = readPerformanceSession(storage, genre, 88, profile);
  assert.equal(fresh.bpm, 100);
  assert.deepEqual(fresh.saved, Array.from({ length: 5 }, emptySelection));
  const session = { bpm: 136, saved: [choose('melody', 2), ...Array.from({ length: 4 }, emptySelection)] };
  writePerformanceSession(storage, genre, session, profile);
  assert.deepEqual(readPerformanceSession(storage, genre, 88, profile), session);
  assert.deepEqual(readPerformanceSession(storage, genre, 88), oldSession);
  assert.equal(data.get(performanceStorageKey(genre)), oldValue);
  assert.deepEqual(templates.chord, performanceTemplates(genre).chord);
  for (const track of ['drums', 'chord', 'bass', 'melody']) assert.equal(performanceTemplates(genre)[track].length, 5);
});


test('Excel melody keeps 92 notes across four complete bars per template without transposition', () => {
  const counts = templates.melody.map((template, index) => {
    assert.equal(template.barCount, 4);
    const matrix = render(choose('melody', index));
    const events = Array.from({ length: 64 }, (_, step) => createMatrixPlaybackAdapter(matrix, { totalBars: 4 }).getEventsForFlatStep(step)).flat();
    assert.ok(events.every(({ note }) => !['B2', 'G#2'].includes(note)));
    for (const chord of [null, templates.chord[0].id, templates.chord[4].id]) {
      assert.deepEqual(render({ ...choose('melody', index), chord }).melody, matrix.melody);
    }
    return events.length;
  });
  assert.deepEqual(counts, [24, 16, 11, 41]);
  assert.equal(counts.reduce((sum, value) => sum + value, 0), 92);
});

test('the replacement AI library starts empty once, preserves its old BPM and never changes old storage', () => {
  const legacyKey = `arranger-performance:v1:${profile}`;
  const old = JSON.stringify({ version: 1, bpm: 147, saved: Array(5).fill({ ...emptySelection(), melody: 'ai-demo-1-melody-focus' }) });
  const data = new Map([[legacyKey, old]]);
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(performanceStorageKey(genre, profile), `arranger-performance:v2:${profile}`);
  assert.deepEqual(readPerformanceSession(storage, genre, 82, profile), { bpm: 147, saved: Array.from({ length: 5 }, emptySelection) });
  assert.equal(data.size, 1, 'reading must not overwrite or migrate old Loops');
  const fresh = { bpm: 124, saved: [choose('melody', 0), ...Array.from({ length: 4 }, emptySelection)] };
  assert.equal(writePerformanceSession(storage, genre, fresh, profile), true);
  assert.deepEqual(readPerformanceSession(storage, genre, 82, profile), fresh);
  assert.equal(data.get(legacyKey), old);
  for (const invalid of ['broken', JSON.stringify({ version: 1, bpm: null }), JSON.stringify({ version: 1, bpm: 'bad' })]) {
    const badStorage = { getItem: key => key === legacyKey ? invalid : null };
    assert.deepEqual(readPerformanceSession(badStorage, genre, 82, profile), { bpm: 100, saved: Array.from({ length: 5 }, emptySelection) });
  }
});
