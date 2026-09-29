import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import AudioEngine, { createMelodySampleUrls } from '../src/audio/AudioEngine.js';
import { DEEP_AUTUMN_DRUMS as drums, DEEP_AUTUMN_CHORD as chord, PERFORMANCE_SAMPLE_BANKS as banks } from '../src/data/performanceTimbres.js';
import { createSection, createSession, snapshotSection, createArrangementImport, readSession, sessionKey } from '../src/app/performanceSession.js';
import { collectProjectEvents, renderProjectToWav, getEventVolume } from '../src/export/audioFile.js';
import { createProjectFile } from '../src/export/projectFile.js';

const profile = 'ai-demo-1';
function project() {
  const session = createSession('chill', profile); session.sections = [createSection()];
  const section = session.sections[0];
  section.selection.drums = 'deep-autumn-drums-chinese-groove';
  section.selection.chord = 'deep-autumn-chord-nostalgic-piano';
  section.timbres = { ...section.timbres, drums, chord };
  session.columns = [{ id: 'column', name: '深秋', repeat: 1, snapshot: snapshotSection(section, 'chill', profile) }];
  return { session, state: createArrangementImport(session, session.columns) };
}

function setup() {
  const players = [], samplers = [], calls = [];
  const Transport = { bpm: { value: 100 }, position: '0:0:0', scheduleRepeat(fn) { this.tick = fn; return 1; },
    clear() {}, start() { calls.push('start'); }, stop() {}, pause() {} };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const engine = new AudioEngine({ tone, baseUrl: '/arranger-demo/',
    playerFactory: (url) => {
      const node = { url, volume: { value: 0 }, hits: [], stops: [], start(time) { this.hits.push(time); },
        stop(time) { this.stops.push(time); }, dispose() { this.disposed = true; }, toDestination() { return this; } };
      players.push(node); return node;
    },
    melodyInputSamplerFactory: (urls) => {
      const node = { urls, hits: [], releases: [], volume: { value: 0 },
        triggerAttack(note, time) { this.hits.push({ note, time }); }, releaseAll(time) { this.releases.push(time); },
        dispose() {}, toDestination() { return this; } };
      samplers.push(node); return node;
    },
  });
  return { engine, tone, players, samplers, calls };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('24 local WAVs match source hashes and sharp filenames map to standard notes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/samples/DeepAutumn/manifest.json', import.meta.url)));
  assert.equal(manifest.length, 24);
  assert.equal(Object.keys(banks[drums].sampleFiles).length, 3);
  assert.equal(Object.keys(banks[chord].sampleFiles).length, 21);
  assert.deepEqual(new Set(manifest.map(x => x.file)), new Set(Object.values(banks).flatMap(x => Object.values(x.sampleFiles))));
  for (const entry of manifest) {
    const bytes = await readFile(new URL(`../public/${entry.file}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  const urls = createMelodySampleUrls('/arranger-demo/', chord);
  assert.match(urls['C#2'], /\/Chord\/CSharp2.wav\?/);
  assert.match(urls['G#4'], /\/Chord\/GSharp4.wav\?/);
  assert.ok(Object.values(urls).every(url => !url.includes('#')));
  assert.match(createMelodySampleUrls('/', 'piano').C2, /samples\/Melody\/Melody_C2_v0.22.wav/);
});

test('chosen banks survive session, independent Live copy, single-track replacement and creation project export', () => {
  const { session, state } = project();
  const copy = structuredClone(session.columns[0]);
  const raw = JSON.stringify(session);
  const restored = readSession({ getItem: key => key === sessionKey('chill', profile) ? raw : null }, 'chill', profile);
  assert.deepEqual(restored.sections, session.sections);
  const events = collectProjectEvents(state);
  assert.ok(events.filter(e => e.type === 'drums').every(e => e.timbreId === drums));
  assert.ok(events.filter(e => e.type === 'chord').every(e => e.timbreId === chord && e.playbackMode === 'natural'));
  assert.deepEqual(createProjectFile(state).arrangement.matrix, state.matrix);
  session.sections[0].timbres.chord = 'warm-electric-piano';
  assert.deepEqual(session.columns[0], copy);
  assert.equal(createSection().timbres.drums, 'soft-electronic-kit');
});

test('real-time banks play original pitches and natural tails through selected channels; stop releases drums', async () => {
  const { engine, tone, players } = setup();
  const { state } = project();
  let routed = 0; engine.performanceEffects = { route() { routed++; } };
  await engine.play({ matrixSource: () => state.matrix, totalBars: state.totalBars });
  tone.Transport.tick(0);
  const kick = engine.drumTrackBanks.get('drums').get(drums).players.get('kick');
  const harmony = engine.getMelodyBank(chord, 'chord', 'natural').sampler;
  assert.deepEqual(kick.hits, [0]);
  assert.equal(kick.volume.value, -3);
  assert.equal(harmony.volume.value, -6);
  assert.equal(getEventVolume(state, { type: 'drums', trackId: 'drums', timbreId: drums }), kick.volume.value);
  assert.equal(getEventVolume(state, { type: 'chord', trackId: 'chord', timbreId: chord }), harmony.volume.value);
  assert.ok(players.filter(p => !p.url.includes('DeepAutumn')).every(p => p.hits.length === 0));
  assert.deepEqual(harmony.hits.map(x => x.note).sort(), ['B2', 'C#3', 'E3', 'G#2']);
  assert.equal(harmony.releases.length, 0);
  assert.ok(routed > 0);
  await engine.pause(); assert.ok(kick.stops.length > 0 && harmony.releases.length > 0);
  await engine.stop(); assert.ok(kick.stops.length > 1);
  engine.disposeTrack('drums'); assert.equal(engine.drumTrackBanks.has('drums'), false); assert.ok(kick.disposed);
});

test('drum bank failure cleans up and retries; deletion or stop during loading never starts obsolete playback', async () => {
  const { engine, tone, players, calls } = setup();
  await engine.startAudio();
  tone.loaded = async () => { throw new Error('load failed'); };
  assert.equal(await engine.prepareDrumTimbre(drums), false);
  assert.ok(players.filter(p => p.url.includes('DeepAutumn')).every(p => p.disposed));
  let finish; tone.loaded = () => new Promise(resolve => { finish = resolve; });
  const pendingBank = engine.prepareDrumTimbre(drums); await flush();
  engine.disposeTrack('drums'); finish(); assert.equal(await pendingBank, false);
  const { state } = project();
  const pendingPlay = engine.play({ matrixSource: () => state.matrix }); await flush();
  await engine.stop(); tone.loaded = async () => {}; finish();
  assert.equal(await pendingPlay, false); assert.deepEqual(calls, []);
  assert.equal(await engine.play({ matrixSource: () => state.matrix }), true);
  assert.deepEqual(calls, ['start']);
});

test('WAV render requests the same local banks and leaves drum and harmony sample tails ungated', async (t) => {
  const urls = [], voices = [];
  class Context {
    constructor(channels, frames, rate) { this.frames = frames; this.rate = rate; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; } }; }
    createBufferSource() { const voice = { playbackRate: { value: 1 }, connect() { return this; }, start() {}, stop() { this.stopped = true; } }; voices.push(voice); return voice; }
    async decodeAudioData() { return { duration: 1.5 }; }
    async startRendering() { return { numberOfChannels: 2, length: this.frames, sampleRate: this.rate, getChannelData: () => new Float32Array(this.frames) }; }
  }
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = Context;
  t.after(() => { if (original) globalThis.OfflineAudioContext = original; else delete globalThis.OfflineAudioContext; });
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; });
  const { state } = project();
  await renderProjectToWav(state, { chunkSeconds: 1 });
  assert.ok(urls.length > 3 && urls.every(url => url.includes('/samples/DeepAutumn/')));
  assert.ok(urls.some(url => url.includes('/Drums/Kick.wav')) && urls.some(url => url.includes('/Chord/CSharp3.wav')));
  assert.ok(voices.length > 0 && voices.every(voice => !voice.stopped));
  urls.length = 0;
  await renderProjectToWav({ totalBars: 1, bpm: 100, trackOrder: ['chord'], matrix: {
    chord: [[{ type: 'notes', notes: ['C3'], timbreId: chord, playbackMode: 'natural' }]],
  } });
  assert.deepEqual(urls, ['/samples/DeepAutumn/Chord/CSharp3.wav'], 'equidistant source selection matches Tone.Sampler, not the lower B2');
});
