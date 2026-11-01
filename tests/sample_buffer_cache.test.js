import assert from 'node:assert/strict';
import { test } from 'node:test';
import SampleBufferCache from '../src/audio/SampleBufferCache.js';
import AudioEngine from '../src/audio/AudioEngine.js';

function createTone(load) {
  class Sampler {
    constructor({ urls }) { this.buffers = new Map(Object.entries(urls)); }
    add(note, buffer) { this.buffers.set(note, buffer); }
    toDestination() { return this; }
    dispose() { this.disposed = true; this.buffers.clear(); }
  }
  class Player {
    constructor(buffer) { this.buffer = { value: buffer, set(value) { this.value = value; } }; }
    toDestination() { return this; }
  }
  return { Sampler, Player, ToneAudioBuffer: { load }, start: async () => {} };
}

test('simultaneous samplers and players download and decode each URL once, with independent voices', async () => {
  const cache = new SampleBufferCache();
  const urls = [];
  let finish;
  const buffer = { duration: 2 };
  const tone = createTone((url) => { urls.push(url); return new Promise((resolve) => { finish = resolve; }); });
  const a = cache.createSampler(tone, { C4: '/piano.wav?v=1' });
  const b = cache.createSampler(tone, { C4: '/piano.wav?v=1' });
  const player = cache.createPlayer(tone, '/piano.wav?v=1');
  await Promise.resolve();
  assert.deepEqual(urls, ['/piano.wav?v=1']);
  assert.notEqual(a, b);
  finish(buffer);
  await cache.waitFor(tone, [a, b, player]);
  assert.equal(a.buffers.get('C4'), buffer);
  assert.equal(b.buffers.get('C4'), buffer);
  assert.equal(player.buffer.value, buffer);
  a.dispose();
  assert.equal(b.buffers.get('C4'), buffer);
  const warm = cache.createSampler(tone, { C4: '/piano.wav?v=1' });
  assert.equal(warm.buffers.get('C4'), buffer, 'warm samplers must be playable immediately');
  assert.equal(urls.length, 1);
});

test('an unrelated pending or failed sample does not block a ready bank', async () => {
  const cache = new SampleBufferCache();
  let fail;
  const tone = createTone((url) => url === '/slow.wav'
    ? new Promise((_, reject) => { fail = reject; }) : Promise.resolve({ duration: 1 }));
  tone.loaded = () => { throw new Error('must not wait on the global queue'); };
  const slow = cache.createSampler(tone, { C4: '/slow.wav' });
  const fast = cache.createSampler(tone, { C4: '/fast.wav' });
  await cache.waitFor(tone, [fast]);
  assert.equal(fast.buffers.get('C4').duration, 1);
  fail(new Error('offline'));
  await assert.rejects(cache.waitFor(tone, [slow]), /offline/);
});

test('failed samples can retry and disposed samplers are not populated after loading', async () => {
  const cache = new SampleBufferCache();
  let attempts = 0;
  let finish;
  const tone = createTone(async () => {
    if (++attempts === 1) throw new Error('offline');
    return new Promise((resolve) => { finish = resolve; });
  });
  const first = cache.createSampler(tone, { C4: '/retry.wav' });
  await assert.rejects(cache.waitFor(tone, [first]), /offline/);
  const retry = cache.createSampler(tone, { C4: '/retry.wav' });
  retry.dispose();
  await Promise.resolve();
  finish({ duration: 1 });
  await cache.waitFor(tone, [retry]);
  assert.equal(attempts, 2);
  assert.equal(retry.buffers.size, 0);
});

test('concurrent audio startup resumes the context once and shares initial samples', async () => {
  let starts = 0;
  const urls = [];
  const tone = createTone(async (url) => { urls.push(url); return { duration: 1 }; });
  tone.start = async () => { starts++; };
  const engine = new AudioEngine({ tone });
  await Promise.all([engine.startAudio(), engine.startAudio(), engine.startAudio()]);
  await engine.prepareMelodyTimbre('piano', 'melody');
  engine.activateMelodyTimbre('piano');
  await engine.prepareMatrixPlaybackSamples();
  assert.equal(starts, 1);
  assert.equal(urls.length, 52);
  assert.equal(new Set(urls).size, urls.length);
});

test('playback prepares base, drum and pitched banks in parallel', async () => {
  const engine = new AudioEngine();
  engine.startAudio = async () => 'ready';
  const pending = new Map();
  for (const method of ['prepareMatrixPlaybackSamples', 'prepareDrumTimbre', 'prepareMelodyTimbre']) {
    engine[method] = () => new Promise((resolve) => pending.set(method, resolve));
  }
  const playing = engine.play({
    additionalDrumTimbres: [{ trackId: 'drums', timbreId: 'deep-autumn-drums' }],
    additionalTimbres: [{ trackId: 'melody', timbreId: 'blues' }],
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.size, 3);
  await engine.stop();
  pending.forEach((resolve) => resolve(true));
  assert.equal(await playing, false, 'stop must still cancel a pending playback');
});
