import assert from 'node:assert/strict';
import { test } from 'node:test';
import AudioEngine from '../src/audio/AudioEngine.js';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { emptySelection, performanceTemplates } from '../src/app/performanceModel.js';
import { collectProjectEvents } from '../src/export/audioFile.js';
import { createMidiFile } from '../src/export/midiFile.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const natural = { type: 'melody', note: 'C4', timbreId: 'piano', duration: '16n', playbackMode: 'natural' };

function setup() {
  const calls = [], samplers = [];
  const mix = { volumes: { melody: 0 }, mutedTracks: {} };
  const Transport = { bpm: { value: 100 }, position: '0:0:0',
    scheduleRepeat(callback) { this.tick = callback; return 1; },
    clear() {}, start() { calls.push('start'); }, stop() {}, pause() {},
  };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const engine = new AudioEngine({ tone, volumeSource: () => mix,
    playerFactory: () => ({ start() {}, toDestination() { return this; } }),
    melodyInputSamplerFactory: () => {
      const sampler = { volume: { value: 0 }, hits: [], releases: [],
        triggerAttack(note, time, velocity) { this.hits.push({ kind: 'natural', note, time, velocity, volume: this.volume.value }); },
        triggerAttackRelease(note, duration, time, velocity) { this.hits.push({ kind: 'gated', note, duration, time, velocity }); },
        releaseAll(time) { this.releases.push(time); },
        toDestination() { return this; },
      };
      samplers.push(sampler);
      return sampler;
    },
  });
  return { engine, tone, calls, mix, samplers };
}

test('natural tails overlap repeated notes and loop boundaries independently of gated voices', async () => {
  const { engine, tone, mix } = setup();
  const bar = Array(16).fill(null);
  bar[0] = { ...natural, velocity: .7 };
  bar[1] = { ...natural, playbackMode: undefined };
  bar[2] = { ...natural };
  const matrix = { melody: [bar, Array(16).fill(null)] };
  await engine.play({ matrixSource: () => matrix, bpm: 100, totalBars: 2 });
  const naturalBank = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  const gatedBank = engine.getMelodyBank('piano').sampler;
  assert.notEqual(naturalBank, gatedBank);
  for (let step = 0; step <= 32; step++) tone.Transport.tick(step * .15);
  assert.deepEqual(naturalBank.hits.map(hit => hit.time), [0, .3, 4.8]);
  assert.equal(naturalBank.hits[0].velocity, .7);
  assert.deepEqual(gatedBank.hits.map(hit => [hit.kind, hit.duration, hit.time]), [['gated', '16n', .15]]);
  assert.deepEqual(naturalBank.releases, [], 'loop boundaries and short-note releases do not cut natural tails');
  mix.volumes.melody = -24;
  engine.refreshTrackVolume('melody');
  assert.equal(naturalBank.volume.value, -Infinity);
  assert.equal(gatedBank.volume.value, -Infinity);
  mix.volumes.melody = -6;
  engine.refreshTrackVolume('melody');
  assert.equal(naturalBank.volume.value, -6);
  await engine.stop();
  assert.ok(naturalBank.releases.length > 0 && gatedBank.releases.length > 0);
  const hits = naturalBank.hits.length;
  tone.Transport.tick(6);
  assert.equal(naturalBank.hits.length, hits);
});

test('natural note audition can be cancelled while loading and uses the latest gain on retry', async () => {
  const { engine, tone, mix, samplers } = setup();
  await engine.startAudio();
  let finish;
  const loading = new Promise(resolve => { finish = resolve; });
  tone.loaded = () => loading;
  const options = { timbreId: 'piano', playbackMode: 'natural', velocity: .6 };
  const pending = engine.triggerMelodyInputOneShot('C4', 0, options);
  await flush();
  await engine.stop();
  mix.volumes.melody = -24;
  finish();
  assert.equal(await pending, false);
  assert.ok(samplers.every(sampler => sampler.hits.length === 0));
  assert.equal(await engine.triggerMelodyInputOneShot('C4', 1, options), true);
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  assert.deepEqual(sampler.hits, [{ kind: 'natural', note: 'C4', time: 1, velocity: .6, volume: -Infinity }]);
  engine.disposeTrack('melody');
  assert.equal(engine.getMelodyBank('piano', 'melody', 'natural'), undefined);
  assert.ok(sampler.releases.length > 0);
});

test('rapid playback restart during natural bank loading starts only the latest session', async () => {
  const { engine, tone, calls } = setup();
  await engine.startAudio();
  let finish;
  const loading = new Promise(resolve => { finish = resolve; });
  tone.loaded = () => loading;
  const matrix = { melody: [[natural]] };
  const first = engine.play({ matrixSource: () => matrix, totalBars: 4 });
  await flush();
  await engine.stop();
  const second = engine.play({ matrixSource: () => matrix, totalBars: 4 });
  await flush();
  finish();
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(calls.filter(call => call === 'start').length, 1);
  tone.Transport.tick(0);
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  assert.equal(sampler.hits.length, 1);
  await engine.stop();
  assert.ok(sampler.releases.length > 0);
});

test('adding a melody after a drum-only preview uses the preloaded natural piano bank', async () => {
  const { engine, tone } = setup();
  let snapshot = { totalBars: 2, matrix: { melody: [Array(16).fill(null), Array(16).fill(null)] } };
  await engine.play({ matrixSource: () => snapshot.matrix, playbackSource: () => snapshot,
    totalBars: 2, melodyTimbreIds: ['piano'], melodyPlaybackMode: 'natural' });
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  snapshot = { totalBars: 4, matrix: { melody: [[natural], [], [], []] } };
  tone.Transport.tick(0);
  assert.equal(sampler.hits.length, 1);
  await engine.stop();
});

test('all 92 AI melody attacks retain identical MIDI bytes with natural tails', () => {
  const genreId = 'electronic-edm', profileId = 'ai-demo-1';
  const templates = performanceTemplates(genreId, profileId);
  const saved = [...templates.melody.map(({ id }) => ({ ...emptySelection(), melody: id })), emptySelection()];
  const project = createPerformanceImport({ saved, genreId, profileId, bpm: 100 });
  const events = collectProjectEvents(project);
  assert.equal(events.length, 92);
  assert.ok(events.every(event => event.playbackMode === 'natural' && event.duration === '16n'));
  const previous = structuredClone(project);
  previous.matrix.melody.flat().filter(Boolean).forEach(cell => { delete cell.playbackMode; });
  assert.deepEqual(createMidiFile(project), createMidiFile(previous));
});
