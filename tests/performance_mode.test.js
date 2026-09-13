import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PERFORMANCE_TRACKS, createPerformanceMatrix, createPerformanceSequence, emptySelection,
  normalizeSelection, performanceStorageKey, performanceTemplates, readPerformanceSession,
  writePerformanceSession,
} from '../src/app/performanceModel.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createPerformancePlayback } from '../src/app/performancePlayback.js';
import { createChordStylePresetBar } from '../src/app/chordStylePresetActions.js';

const select = (genre, ...tracks) => Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [
  id, tracks.includes(id) ? performanceTemplates(genre)[id][0].id : null,
]));

test('every genre offers twenty usable, deterministic two-bar templates', () => {
  for (const genre of ['pop', 'hip-hop', 'r-and-b', 'electronic-edm', 'rock']) {
    const templates = performanceTemplates(genre);
    for (const track of PERFORMANCE_TRACKS) {
      assert.equal(templates[track].length, 5);
      for (const template of templates[track]) {
        const matrix = createPerformanceMatrix({ [track]: template.id }, genre);
        assert.deepEqual(matrix, createPerformanceMatrix({ [track]: template.id }, genre));
        assert.equal(matrix[track].length, 2);
        const adapter = createMatrixPlaybackAdapter(matrix, { totalBars: 2 });
        for (const bar of [0, 1]) {
          const events = Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(bar, step)).flat();
          assert.ok(events.length, `${genre}/${track}/${template.id}/${bar} is audible`);
          assert.ok(events.every((event) => event.type === track));
          assert.ok(events.every((event) => !event.note?.includes('undefined')));
        }
      }
    }
  }
});

test('chords preserve exactly the first two bars; bass follows harmony even with chord muted', () => {
  const selected = select('pop', 'chord', 'bass');
  const matrix = createPerformanceMatrix(selected, 'pop');
  assert.deepEqual(matrix.chord, [0, 1].map((bar) => createChordStylePresetBar(selected.chord, bar)));
  assert.equal(matrix.bass[0][0].note, 'C1');
  assert.equal(matrix.bass[1][0].note, 'A0');
  const bassOnly = createPerformanceMatrix(select('pop', 'bass'), 'pop');
  assert.deepEqual(bassOnly.bass, matrix.bass);
  assert.ok(bassOnly.chord.flat().every((cell) => cell === null));
  const second = performanceTemplates('pop').chord[1];
  const changed = createPerformanceMatrix({ ...selected, chord: second.id }, 'pop');
  assert.equal(changed.bass[1][0].note, 'G0');
});

test('five saved loops form ten bars and wrap once, including bars beyond the arranger canvas', () => {
  const saved = Array.from({ length: 5 }, (_, index) => ({ ...select('pop', 'drums'),
    drums: performanceTemplates('pop').drums[index].id,
  }));
  const sequence = createPerformanceSequence(saved, 'pop');
  assert.equal(sequence.totalBars, 10);
  assert.deepEqual(sequence.indices, [0, 1, 2, 3, 4]);
  const adapter = createMatrixPlaybackAdapter(sequence.matrix, { totalBars: sequence.totalBars });
  for (let index = 0; index < 160; index += 1) {
    assert.equal(adapter.getPositionForFlatStep(index).bar, Math.floor(index / 16));
  }
  assert.deepEqual(adapter.getPositionForFlatStep(160), { bar: 0, step: 0 });
  assert.equal(adapter.getEventsForFlatStep(128)[0].bar, 8);
  const snapshot = structuredClone(sequence.matrix);
  saved[0].drums = null;
  assert.deepEqual(sequence.matrix, snapshot);
});

test('empty slots are skipped in numeric order and a completely empty set has no sequence', () => {
  const saved = [emptySelection(), select('pop', 'drums'), emptySelection(), select('pop', 'melody'), emptySelection()];
  const sequence = createPerformanceSequence(saved, 'pop');
  assert.deepEqual(sequence.indices, [1, 3]);
  assert.equal(sequence.totalBars, 4);
  assert.equal(createPerformanceSequence(Array.from({ length: 5 }, emptySelection), 'pop').totalBars, 0);
});

test('saved combinations restore by genre and corrupt or unavailable storage is safe', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const session = { bpm: 142, saved: Array.from({ length: 5 }, () => select('pop', 'drums', 'chord')) };
  assert.equal(writePerformanceSession(storage, 'pop', session), true);
  assert.deepEqual(readPerformanceSession(storage, 'pop', 120), session);
  assert.equal(readPerformanceSession(storage, 'rock', 98).bpm, 98);
  data.set(performanceStorageKey('pop'), '{bad json');
  assert.equal(readPerformanceSession(storage, 'pop', 115).bpm, 115);
  assert.equal(writePerformanceSession(null, 'pop', session), false);
  assert.equal(writePerformanceSession({ setItem() { throw new Error('quota'); } }, 'pop', session), false);
  assert.deepEqual(normalizeSelection({ drums: 'removed-id', chord: 'rock-garage-loop' }, 'pop'), emptySelection());
});

function fakeAudio() {
  const calls = [];
  let resolveStart;
  return {
    calls,
    options: null,
    position: 0,
    getPlaybackPosition() { return this.position; },
    play(options) {
      this.options = options;
      calls.push('play');
      return new Promise((resolve) => { resolveStart = resolve; });
    },
    finish() { resolveStart?.(true); },
    stop() { calls.push('stop'); },
    stopAllVoices() { calls.push('silence'); },
    setTempo(value) { calls.push(['bpm', value]); },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('progress waits for audio, tracks two-bar boundaries and clears immediately on stop', async () => {
  const audio = fakeAudio();
  const playback = createPerformancePlayback(audio);
  const sequence = createPerformanceSequence([select('pop', 'drums'), emptySelection(), select('pop', 'chord')], 'pop');
  playback.sequence(sequence, 120);
  audio.position = 15.5;
  assert.equal(playback.getProgress(), null);
  assert.equal(playback.isActive(), true);
  audio.finish();
  await flush();
  assert.deepEqual(playback.getProgress(), { segment: 0, fraction: 15.5 / 32 });
  audio.position = 32;
  assert.equal(sequence.indices[playback.getProgress().segment], 2);
  assert.equal(playback.getProgress().fraction, 0);
  playback.setTempo(180);
  audio.position = 48.25;
  assert.deepEqual(playback.getProgress(), { segment: 1, fraction: 16.25 / 32 });
  audio.position = 0;
  assert.deepEqual(playback.getProgress(), { segment: 0, fraction: 0 });
  playback.stop();
  assert.equal(playback.getProgress(), null);
  assert.equal(playback.isActive(), false);
  playback.preview(sequence.matrix, 120);
  assert.equal(playback.getProgress(), null);
  audio.finish();
  await flush();
  audio.position = 31.9;
  assert.deepEqual(playback.getProgress(), { segment: 0, fraction: 31.9 / 32 });
});

test('successive transport clicks cancel loading and restart at the first saved segment', async () => {
  const audio = fakeAudio();
  const pending = [];
  audio.play = function (options) {
    this.options = options;
    return new Promise((resolve) => pending.push(resolve));
  };
  const playback = createPerformancePlayback(audio);
  const sequence = createPerformanceSequence([emptySelection(), select('pop', 'drums')], 'pop');
  const click = () => playback.isActive() ? playback.stop() : playback.sequence(sequence, 120);
  click(); click(); click();
  assert.equal(playback.isActive(), true);
  assert.equal(audio.options.bar, 0);
  assert.equal(audio.options.step, 0);
  pending[0](true);
  await flush();
  assert.equal(playback.getProgress(), null);
  pending[1](true);
  await flush();
  assert.deepEqual(playback.getProgress(), { segment: 0, fraction: 0 });
  click();
  assert.equal(playback.isActive(), false);
  assert.equal(playback.getProgress(), null);
});

test('rapid preview changes update the matrix without restarting the clock, including during loading', async () => {
  const audio = fakeAudio();
  const updates = [];
  const playback = createPerformancePlayback(audio, (state) => updates.push(state));
  const one = createPerformanceMatrix(select('pop', 'drums'), 'pop');
  const two = createPerformanceMatrix(select('pop', 'drums', 'chord'), 'pop');
  playback.preview(one, 120);
  playback.preview(two, 130);
  assert.equal(audio.calls.filter((call) => call === 'play').length, 1);
  assert.equal(audio.options.matrixSource(), two);
  assert.equal(audio.options.totalBars, 2);
  audio.finish();
  await flush();
  assert.equal(updates.at(-1).loading, false);
  assert.deepEqual(audio.calls.at(-1), ['bpm', 130]);
});

test('stop while loading ignores late completion and late position callbacks', async () => {
  const audio = fakeAudio();
  const updates = [];
  const playback = createPerformancePlayback(audio, (state) => updates.push(state));
  playback.preview(createPerformanceMatrix(select('pop', 'melody'), 'pop'), 120);
  const observer = audio.options.onPositionChange;
  playback.stop();
  const updateCount = updates.length;
  audio.finish();
  await flush();
  observer(1, 3);
  assert.equal(updates.length, updateCount);
  assert.equal(updates.at(-1).mode, 'stopped');
  assert.ok(audio.calls.includes('silence'));
});

test('switching from sequence to editing stops the sequence and invalidates its notifications', () => {
  const audio = fakeAudio();
  const updates = [];
  const playback = createPerformancePlayback(audio, (state) => updates.push(state));
  playback.sequence(createPerformanceSequence([select('pop', 'drums'), select('pop', 'chord')], 'pop'), 120);
  assert.equal(audio.options.totalBars, 4);
  const oldObserver = audio.options.onPositionChange;
  playback.preview(createPerformanceMatrix(select('pop', 'bass'), 'pop'), 120);
  oldObserver(3, 15);
  assert.equal(updates.at(-1).mode, 'preview');
  assert.equal(updates.at(-1).bar, 0);
  assert.equal(audio.calls.filter((call) => call === 'stop').length, 1);
});
