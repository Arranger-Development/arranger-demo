import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { AUDIO_STATUSES } from '../src/audio/audioStatus.js';
import AudioEngine, {
  createBassSampleUrls,
  createChordSampleUrls,
  createDrumsSampleUrls,
  createMelodySampleUrls,
  formatToneTransportPosition,
} from '../src/audio/AudioEngine.js';
import createAudioEngine from '../src/audio/createAudioEngine.js';
import { STEPS_PER_BAR, TOTAL_BARS } from '../src/domain/musicConstants.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import useMusicStore from '../src/store/useMusicStore.js';
import { dispatchCommand } from '../src/input/commandDispatcher.js';

const SAMPLE_ASSET_VERSION = 'sample-refresh-20260608';

test('live preview length changes keep absolute phase and progress waits for the audible boundary', async () => {
  const tone = createFakeTone();
  let clock = 0;
  tone.Transport.PPQ = 192;
  tone.Transport.getTicksAtTime = (time) => time * 48;
  const engine = new AudioEngine({ tone, immediate: () => clock, playerFactory: createPlayerFactory(tone.calls) });
  const short = { drums: Array.from({ length: 2 }, () => Array(16).fill(null)) };
  const long = { drums: Array.from({ length: 4 }, () => Array(16).fill(null)) };
  long.drums[2][1] = { instruments: ['kick'] };
  let source = { matrix: short, totalBars: 2 };
  await engine.play({ matrixSource: () => short, totalBars: 2, bar: 0, step: 0, playbackSource: () => source });
  const callback = tone.Transport.scheduledCallback;
  for (let step = 0; step < 33; step += 1) callback(step);
  source = { matrix: long, totalBars: 4 };
  callback(33);
  assert.equal(engine.currentBar, 2);
  assert.equal(engine.currentStep, 1);
  assert.ok(tone.calls.some(([method, instrument, , time]) => method === 'player.start' && instrument === 'kick' && time === 33));
  clock = 32.9;
  assert.deepEqual(engine.getPlaybackProgress(), { position: clock % 32, totalSteps: 32 });
  clock = 33;
  assert.deepEqual(engine.getPlaybackProgress(), { position: 33, totalSteps: 64 });
  source = { matrix: short, totalBars: 2 };
  callback(34);
  clock = 33.9;
  assert.equal(engine.getPlaybackProgress().totalSteps, 64);
  clock = 34;
  assert.deepEqual(engine.getPlaybackProgress(), { position: 2, totalSteps: 32 });
  assert.equal(tone.calls.filter(([method]) => method === 'transport.start').length, 1);
  assert.equal(tone.calls.filter(([method]) => method === 'transport.scheduleRepeat').length, 1);
  assert.equal(tone.Transport.position, '0:0:0');
  await engine.stop();
  assert.equal(engine.getPlaybackProgress(), null);
  await engine.play({ matrixSource: () => short, bar: 0, step: 0 });
  assert.equal(engine.playbackSource, null);
  assert.equal(engine.playbackTotalBars, 8);
});

test('a preview changed during loading starts with the latest phrase and can still be cancelled', async () => {
  const tone = createFakeTone();
  let finishStart;
  tone.start = () => new Promise((resolve) => { finishStart = resolve; });
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  let snapshot = { matrix: { drums: [[], []] }, totalBars: 2 };
  const pending = engine.play({ matrixSource: () => snapshot.matrix, totalBars: 2, playbackSource: () => snapshot });
  await new Promise((resolve) => setImmediate(resolve));
  snapshot = { matrix: { drums: [[{ instruments: ['snare'] }], [], [], []] }, totalBars: 4 };
  finishStart();
  assert.equal(await pending, true);
  tone.Transport.scheduledCallback(0);
  assert.equal(engine.matrixAdapter.totalSteps, 64);
  assert.ok(tone.calls.some(([method, instrument]) => method === 'player.start' && instrument === 'snare'));
  await engine.stop();
  assert.equal(engine.getPlaybackPosition(), null);
});

test('playback progress samples the immediate audio clock, follows tempo ticks and wraps the configured length', async () => {
  const tone = createFakeTone();
  let clock = 0;
  let ticks = 0;
  const sampledTimes = [];
  tone.Transport.PPQ = 192;
  tone.Transport.getTicksAtTime = (time) => { sampledTimes.push(time); return ticks; };
  const engine = new AudioEngine({ tone, immediate: () => clock, playerFactory: createPlayerFactory(tone.calls) });
  assert.equal(engine.getPlaybackPosition(), null);
  await engine.play({ matrixSource: () => ({}), totalBars: 10, bar: 0, step: 0 });
  assert.equal(engine.getPlaybackPosition(), null);
  tone.Transport.scheduledCallback(0);
  for (const step of [0, 15.125, 31.999, 32, 64, 96, 128, 159.999, 160, 175.25]) {
    clock += .2;
    ticks = step * 48;
    assert.equal(engine.getPlaybackPosition(), step % 160);
    assert.equal(sampledTimes.at(-1), clock);
  }
  engine.setTempo(180);
  ticks += 72; // Follow transport ticks, not a wall-time/BPM estimate.
  assert.equal(engine.getPlaybackPosition(), 16.75);
  await engine.stop();
  assert.equal(engine.getPlaybackPosition(), null);
  await engine.play({ matrixSource: () => ({}), totalBars: 2, bar: 0, step: 0 });
  tone.Transport.scheduledCallback(clock + .1);
  assert.equal(engine.getPlaybackPosition(), null, 'scheduler lookahead must not start the ring before the first audible tick');
  clock += .1;
  ticks = 32.5 * 48;
  assert.equal(engine.getPlaybackPosition(), .5);
  await engine.pause();
  assert.equal(engine.getPlaybackPosition(), null);
});

test('performance playback reaches all ten bars, then restores the eight-bar arranger default', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const positions = [];
  const matrix = { drums: Array.from({ length: 10 }, () => Array(16).fill(null)) };
  await engine.play({ matrixSource: () => matrix, totalBars: 10, onPositionChange: (bar, step) => positions.push([bar, step]) });
  for (let index = 0; index < 161; index += 1) tone.Transport.scheduledCallback(index / 8);
  assert.deepEqual(positions[128], [8, 0]);
  assert.deepEqual(positions[159], [9, 15]);
  assert.deepEqual(positions[160], [0, 0]);
  await engine.stop();
  await engine.play({ matrixSource: () => matrix, bar: 0, step: 0 });
  assert.equal(engine.matrixAdapter.totalBars, 8);
  await engine.stop();
  await engine.play({ matrixSource: () => matrix, totalBars: 2, bar: 0, step: 0 });
  assert.equal(engine.matrixAdapter.totalSteps, 32);
});

test('cancelling audio startup prevents a delayed performance from starting the transport', async () => {
  const tone = createFakeTone();
  let finishStart;
  tone.start = () => new Promise((resolve) => { finishStart = resolve; });
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const pending = engine.play({ matrixSource: () => ({}), totalBars: 2 });
  await new Promise((resolve) => setImmediate(resolve));
  await engine.stop();
  finishStart();
  assert.equal(await pending, false);
  assert.ok(!tone.calls.some(([method]) => method === 'transport.start'));
});

test('performance melody cells use their preloaded timbre bank and stop releases it', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const notes = [];
  const releases = [];
  engine.melodyPreviewBanks.set('blues', {
    ready: true, sampler: {
      triggerAttackRelease: (...args) => notes.push(args), releaseAll: (time) => releases.push(time),
    },
  });
  const matrix = { melody: [[{ type: 'melody', note: 'D#4', duration: '16n', timbreId: 'blues' }], []] };
  await engine.play({ matrixSource: () => matrix, totalBars: 2, melodyTimbreIds: ['blues'] });
  tone.Transport.scheduledCallback(0);
  assert.deepEqual(notes, [['D#4', '16n', 0, 1]]);
  await engine.stop();
  engine.stopAllVoices(1);
  assert.equal(releases.at(-1), 1);
  assert.equal(releases.length, 2);
});
const SAMPLE_VERSION_QUERY = `?v=${SAMPLE_ASSET_VERSION}`;

function versioned(url) {
  return `${url}${SAMPLE_VERSION_QUERY}`;
}

function createFakeTone() {
  const calls = [];
  const transport = {
    bpm: { value: null },
    position: '0:0:0',
    scheduledCallback: null,
    scheduleRepeat(callback, interval) {
      calls.push(['transport.scheduleRepeat', interval]);
      this.scheduledCallback = callback;
      return 'repeat-id';
    },
    clear(id) {
      calls.push(['transport.clear', id]);
    },
    start() {
      calls.push(['transport.start']);
    },
    pause() {
      calls.push(['transport.pause']);
    },
    stop(time) {
      calls.push(['transport.stop', time]);
    },
  };

  return {
    calls,
    now: () => 12.5,
    start: async () => calls.push(['tone.start']),
    Transport: transport,
  };
}

function createLiveInputTone({
  baseLatency,
  bpm = 120,
  currentTime = 0,
  outputLatency,
  ppq = 192,
} = {}) {
  const tone = createFakeTone();
  const sampledTimes = [];
  const rawContext = {};
  if (Number.isFinite(baseLatency)) rawContext.baseLatency = baseLatency;
  if (Number.isFinite(outputLatency)) rawContext.outputLatency = outputLatency;

  tone.immediate = () => currentTime;
  tone.getContext = () => ({
    immediate: () => currentTime,
    rawContext,
  });
  tone.Transport.PPQ = ppq;
  tone.Transport.getTicksAtTime = (time) => {
    sampledTimes.push(time);
    return time * ppq * bpm / 60;
  };

  return { sampledTimes, tone };
}

function createFakeToneWithEventIds(eventIds) {
  const tone = createFakeTone();
  let eventIndex = 0;
  tone.Transport.scheduleRepeat = (callback, interval) => {
    tone.calls.push(['transport.scheduleRepeat', interval]);
    tone.Transport.scheduledCallback = callback;
    const eventId = eventIds[eventIndex] ?? eventIds.at(-1);
    eventIndex += 1;
    return eventId;
  };
  return tone;
}

function createToneWithBlockedTransport() {
  return {
    get Transport() {
      throw new Error('Transport should not be touched before audio starts');
    },
  };
}

function createPlayerFactory(calls) {
  return (url, instrument) => ({
    start: (time) => calls.push(['player.start', instrument, url, time]),
    toDestination: () => calls.push(['player.toDestination', instrument]),
  });
}

function createChordSynthFactory(calls) {
  return () => ({
    triggerAttackRelease: (notes, duration, time) => calls.push([
      'chord.triggerAttackRelease',
      notes,
      duration,
      time,
    ]),
    toDestination: () => calls.push(['chord.toDestination']),
  });
}

function createChordSamplerFactory(calls) {
  return (urls) => ({
    triggerAttackRelease: (notes, duration, time) => calls.push([
      'chordSampler.triggerAttackRelease',
      notes,
      duration,
      time,
      urls,
    ]),
    toDestination: () => calls.push(['chordSampler.toDestination']),
  });
}

function createSamplerFactory(calls) {
  return (urls) => ({
    releaseAll: (time) => calls.push(['sampler.releaseAll', time, urls]),
    triggerAttack: (note, time) => calls.push([
      'sampler.triggerAttack',
      note,
      time,
      urls,
    ]),
    triggerAttackRelease: (note, duration, time) => calls.push([
      'sampler.triggerAttackRelease',
      note,
      duration,
      time,
      urls,
    ]),
    toDestination: () => calls.push(['sampler.toDestination']),
  });
}

function createVolumeAwareSamplerFactory(calls) {
  return (urls) => {
    const sampler = {
      volume: { value: 0 },
      triggerAttack(note, time) {
        calls.push([
          'sampler.triggerAttack',
          note,
          time,
          sampler.volume.value,
          urls,
        ]);
      },
      triggerAttackRelease(note, duration, time) {
        calls.push([
          'sampler.triggerAttackRelease',
          note,
          duration,
          time,
          sampler.volume.value,
          urls,
        ]);
      },
      toDestination() {
        calls.push(['sampler.toDestination']);
        return sampler;
      },
    };

    return sampler;
  };
}

function createVolumeAwarePlayerFactory(calls) {
  return (url, instrument) => {
    const player = {
      volume: { value: 0 },
      start(time) {
        calls.push(['player.start', instrument, url, time, player.volume.value]);
      },
      toDestination() {
        calls.push(['player.toDestination', instrument]);
        return player;
      },
    };

    return player;
  };
}

function createVolumeAwareChordSynthFactory(calls) {
  return () => {
    const synth = {
      volume: { value: 0 },
      triggerAttackRelease(notes, duration, time) {
        calls.push(['chord.triggerAttackRelease', notes, duration, time, synth.volume.value]);
      },
      releaseAll(time) {
        calls.push(['chord.releaseAll', time]);
      },
      toDestination() {
        calls.push(['chord.toDestination']);
        return synth;
      },
    };

    return synth;
  };
}

function createVolumeAwareChordSamplerFactory(calls) {
  return (urls) => {
    const sampler = {
      volume: { value: 0 },
      triggerAttackRelease(notes, duration, time) {
        calls.push([
          'chordSampler.triggerAttackRelease',
          notes,
          duration,
          time,
          sampler.volume.value,
          urls,
        ]);
      },
      releaseAll(time) {
        calls.push(['chordSampler.releaseAll', time]);
      },
      toDestination() {
        calls.push(['chordSampler.toDestination']);
        return sampler;
      },
    };

    return sampler;
  };
}

function createManualTimers() {
  let nextTimerId = 1;
  const timers = new Map();
  const cancelled = [];

  return {
    cancelTimeout(timerId) {
      cancelled.push(timerId);
      timers.delete(timerId);
    },
    cancelled,
    getDelays() {
      return [...timers.values()].map((timer) => timer.delay).sort((a, b) => a - b);
    },
    runThrough(maxDelay) {
      const dueTimers = [...timers.entries()]
        .filter(([, timer]) => timer.delay <= maxDelay)
        .sort(([, left], [, right]) => left.delay - right.delay);
      dueTimers.forEach(([timerId, timer]) => {
        if (!timers.has(timerId)) return;
        timers.delete(timerId);
        timer.callback();
      });
    },
    scheduleTimeout(callback, delay) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    size() {
      return timers.size;
    },
  };
}

test('audio statuses expose the phase 4 lifecycle states', () => {
  assert.deepEqual(AUDIO_STATUSES, {
    IDLE: 'idle',
    STARTING: 'starting',
    READY: 'ready',
    SAMPLE_FALLBACK: 'sample-fallback',
    ERROR: 'error',
  });
});

test('createDrumsSampleUrls maps drums instruments to v0.22 samples', () => {
  assert.deepEqual(createDrumsSampleUrls('/arranger/'), {
    kick: versioned('/arranger/samples/Drums/Kick_v0.22.wav'),
    snare: versioned('/arranger/samples/Drums/Snare_v0.22.wav'),
    hihat: versioned('/arranger/samples/Drums/Hihat_v0.22.wav'),
  });
});

test('createMelodySampleUrls maps melody anchor samples for sampler playback', () => {
  const urls = createMelodySampleUrls('/arranger/');
  const yangqinUrls = createMelodySampleUrls('/arranger/', 'yangqin');
  const bluesUrls = createMelodySampleUrls('/arranger/', 'blues');

  assert.equal(urls.C2, versioned('/arranger/samples/Melody/Melody_C2_v0.22.wav'));
  assert.equal(urls.C3, versioned('/arranger/samples/Melody/Melody_C3_v0.22.wav'));
  assert.equal(urls.C4, versioned('/arranger/samples/Melody/Melody_C4_v0.22.wav'));
  assert.equal(urls.A2, versioned('/arranger/samples/Melody/Melody_A2_v0.22.wav'));
  assert.equal(urls.A3, versioned('/arranger/samples/Melody/Melody_A3_v0.22.wav'));
  assert.equal(urls.A4, versioned('/arranger/samples/Melody/Melody_A4_v0.22.wav'));
  assert.equal(urls.G4, versioned('/arranger/samples/Melody/Melody_G4_v0.22.wav'));
  assert.equal(urls.C5, undefined);
  assert.equal(urls['C#4'], undefined);
  assert.ok(Object.values(urls).every((url) => url.includes('/samples/Melody/')));
  assert.ok(Object.values(urls).every((url) => !url.includes('/lead-old/')));
  assert.equal(
    yangqinUrls.C3,
    versioned('/arranger/samples/Melody/Yangqin/Yangqin_C2.wav'),
  );
  assert.equal(
    yangqinUrls.C5,
    versioned('/arranger/samples/Melody/Yangqin/Yangqin_C4.wav'),
  );
  assert.equal(
    bluesUrls['D#3'],
    versioned('/arranger/samples/Melody/Blues/Blues_DSharp2.wav'),
  );
  assert.equal(
    bluesUrls['D#5'],
    versioned('/arranger/samples/Melody/Blues/Blues_DSharp4.wav'),
  );
  assert.equal(bluesUrls.F3, undefined);
  assert.equal(yangqinUrls.C2, undefined);
});

test('createBassSampleUrls maps v0.22 bass anchor samples for sampler playback', () => {
  const urls = createBassSampleUrls('/arranger/');

  assert.equal(urls.F0, versioned('/arranger/samples/Bass/Bass_F0_v0.22.wav'));
  assert.equal(urls.G0, versioned('/arranger/samples/Bass/Bass_G0_v0.22.wav'));
  assert.equal(urls.C1, versioned('/arranger/samples/Bass/Bass_C1_v0.22.wav'));
  assert.equal(urls.C4, undefined);
  assert.equal(urls['F#3'], undefined);
});

test('createChordSampleUrls maps v0.3 chord note anchor samples', () => {
  const urls = createChordSampleUrls('/arranger/');

  assert.equal(urls.C4, versioned('/arranger/samples/Chords/Chord_C4_v0.3.wav'));
  assert.equal(urls.E4, versioned('/arranger/samples/Chords/Chord_E4_v0.3.wav'));
  assert.equal(urls.G4, versioned('/arranger/samples/Chords/Chord_G4_v0.3.wav'));
  assert.equal(urls['F#4'], undefined);
});

test('sample URLs are cache-busted and never point at old backup folders', () => {
  const urls = [
    ...Object.values(createDrumsSampleUrls('/arranger/')),
    ...Object.values(createMelodySampleUrls('/arranger/')),
    ...Object.values(createBassSampleUrls('/arranger/')),
    ...Object.values(createChordSampleUrls('/arranger/')),
  ];

  assert.ok(urls.every((url) => url.endsWith(SAMPLE_VERSION_QUERY)));
  assert.ok(urls.every((url) => !/\/(808|bass|chords|lead)-old\//.test(url)));
});

test('formatToneTransportPosition converts matrix bar and step to Tone position', () => {
  assert.equal(formatToneTransportPosition(0, 0), '0:0:0');
  assert.equal(formatToneTransportPosition(2, 9), '2:2:1');
  assert.equal(formatToneTransportPosition(7, STEPS_PER_BAR - 1), '7:3:3');
});

test('AudioEngine starts audio and triggers drums samples', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    baseUrl: '/',
    playerFactory: createPlayerFactory(tone.calls),
  });

  assert.equal(engine.status, AUDIO_STATUSES.IDLE);
  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  await engine.triggerDrumsStep(['kick', 'snare']);

  assert.equal(engine.status, AUDIO_STATUSES.READY);
  assert.deepEqual(tone.calls, [
    ['tone.start'],
    ['player.toDestination', 'kick'],
    ['player.toDestination', 'snare'],
    ['player.toDestination', 'hihat'],
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 12.5],
    ['player.start', 'snare', versioned('/samples/Drums/Snare_v0.22.wav'), 12.5],
  ]);
});

test('AudioEngine triggers performance drums without Tone lookAhead', async () => {
  const tone = createFakeTone();
  tone.immediate = () => 7.25;
  const engine = new AudioEngine({
    tone,
    baseUrl: '/',
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.triggerDrumsStep('kick', undefined, { immediate: true });

  assert.deepEqual(
    tone.calls.find(([name]) => name === 'player.start'),
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 7.25],
  );
});

test('AudioEngine live drum positions compensate event and output latency at every BPM', async () => {
  for (const bpm of [60, 88, 120, 180]) {
    const targetFlatStep = 21;
    const secondsPerStep = 60 / bpm / 4;
    const processingDelay = 0.02;
    const outputLatency = 0.03;
    const currentTime = (targetFlatStep + 0.42) * secondsPerStep
      + processingDelay
      + outputLatency;
    const { sampledTimes, tone } = createLiveInputTone({
      baseLatency: 0.12,
      bpm,
      currentTime,
      outputLatency,
    });
    const engine = new AudioEngine({
      performanceNow: () => 1000,
      playerFactory: createPlayerFactory(tone.calls),
      tone,
    });

    await engine.play({ bpm });

    assert.deepEqual(engine.getLiveInputPosition(980), { bar: 1, step: 5 });
    assert.ok(Math.abs(
      sampledTimes.at(-1) - ((targetFlatStep + 0.42) * secondsPerStep),
    ) < 1e-9);
  }
});

test('AudioEngine live drum positions use base latency fallback and nearest-step rounding', async () => {
  const secondsPerStep = 60 / 120 / 4;
  const { sampledTimes, tone } = createLiveInputTone({
    baseLatency: 0.04,
    bpm: 120,
    currentTime: 17.51 * secondsPerStep + 0.04,
  });
  const engine = new AudioEngine({
    performanceNow: () => 500,
    playerFactory: createPlayerFactory(tone.calls),
    tone,
  });

  await engine.play({ bpm: 120 });

  assert.deepEqual(engine.getLiveInputPosition(500), { bar: 1, step: 2 });
  assert.ok(Math.abs(sampledTimes.at(-1) - 17.51 * secondsPerStep) < 1e-9);
});

test('AudioEngine nudges Launchpad recording later without changing other live inputs', async () => {
  const secondsPerStep = 60 / 120 / 4;
  const { sampledTimes, tone } = createLiveInputTone({
    bpm: 120,
    currentTime: 10.45 * secondsPerStep,
  });
  const engine = new AudioEngine({
    performanceNow: () => 1000,
    playerFactory: createPlayerFactory(tone.calls),
    tone,
  });

  await engine.play({ bpm: 120 });

  assert.deepEqual(engine.getLiveInputPosition(), { bar: 0, step: 10 });
  assert.deepEqual(
    engine.getLiveInputPosition(undefined, { source: 'launchpad' }),
    { bar: 0, step: 11 },
  );
  assert.ok(Math.abs(sampledTimes.at(-1) - sampledTimes.at(-2) - 0.012) < 1e-9);
});

test('AudioEngine clamps implausible live input latency and supports missing latency data', async () => {
  const capped = createLiveInputTone({
    bpm: 120,
    currentTime: 1,
    outputLatency: 2,
  });
  const cappedEngine = new AudioEngine({
    playerFactory: createPlayerFactory(capped.tone.calls),
    tone: capped.tone,
  });
  await cappedEngine.play({ bpm: 120 });
  cappedEngine.getLiveInputPosition();
  assert.equal(capped.sampledTimes.at(-1), 0.75);

  const missing = createLiveInputTone({
    bpm: 120,
    currentTime: 1,
  });
  const missingEngine = new AudioEngine({
    playerFactory: createPlayerFactory(missing.tone.calls),
    tone: missing.tone,
  });
  await missingEngine.play({ bpm: 120 });
  missingEngine.getLiveInputPosition();
  assert.equal(missing.sampledTimes.at(-1), 1);
});

test('AudioEngine live drum positions reject stopped and out-of-range transport time', async () => {
  const { tone } = createLiveInputTone({
    bpm: 120,
    currentTime: TOTAL_BARS * STEPS_PER_BAR * (60 / 120 / 4),
  });
  const engine = new AudioEngine({
    playerFactory: createPlayerFactory(tone.calls),
    tone,
  });

  assert.equal(engine.getLiveInputPosition(), null);
  await engine.play({ bpm: 120 });
  assert.equal(engine.getLiveInputPosition(), null);
  await engine.pause();
  assert.equal(engine.getLiveInputPosition(), null);
});

test('AudioEngine starts audio and triggers chord sampler notes', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createChordSamplerFactory(tone.calls),
    chordSynthFactory: createChordSynthFactory(tone.calls),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  assert.equal(await engine.triggerChord(['C4', 'E4', 'G4'], '4n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('chordSampler.')), [
    ['chordSampler.toDestination'],
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 12.5, createChordSampleUrls()],
  ]);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('chord.')), [
    ['chord.toDestination'],
  ]);
});

test('AudioEngine falls back to chord synth when chord sampler is unavailable', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    chordSynthFactory: createChordSynthFactory(tone.calls),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  assert.equal(await engine.triggerChord(['C4', 'E4', 'G4'], '4n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('chord.')), [
    ['chord.toDestination'],
    ['chord.triggerAttackRelease', ['C4', 'E4', 'G4'], '4n', 12.5],
  ]);
});

test('AudioEngine starts audio and triggers complete Melody one-shots using UI note pitch', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  assert.equal(await engine.triggerMelodyNote('G5', '16n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttack'), [
    [
      'sampler.triggerAttack',
      'G5',
      12.5,
      createMelodySampleUrls(),
    ],
  ]);
});

test('AudioEngine plays every Matrix Melody duration as overlapping one-shots', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.melody[0][0] = { type: 'melody', note: 'C4' };
  matrix.melody[0][1] = { type: 'melody', note: 'C4', durationSteps: 1 };
  matrix.melody[0][2] = { type: 'melody', note: 'C4', durationSteps: 2 };
  const gatedSampler = {
    releaseAll: (time) => tone.calls.push(['gated.releaseAll', time]),
    toDestination: () => gatedSampler,
    triggerAttackRelease: (note, duration, time) => (
      tone.calls.push(['gated.triggerAttackRelease', note, duration, time])
    ),
  };
  const oneShotSampler = {
    releaseAll: (time) => tone.calls.push(['oneShot.releaseAll', time]),
    toDestination: () => oneShotSampler,
    triggerAttack: (note, time) => tone.calls.push(['oneShot.triggerAttack', note, time]),
  };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    melodyOneShotSamplerFactory: () => oneShotSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: () => gatedSampler,
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);
  tone.Transport.scheduledCallback(24.125);
  tone.Transport.scheduledCallback(24.25);

  assert.deepEqual(tone.calls.filter(([name]) => name.includes('.trigger')), [
    ['oneShot.triggerAttack', 'C4', 24],
    ['oneShot.triggerAttack', 'C4', 24.125],
    ['oneShot.triggerAttack', 'C4', 24.25],
  ]);

  await engine.pause();
  assert.equal(tone.calls.some(([name]) => name.endsWith('.releaseAll')), false);

  await engine.stop();
  assert.deepEqual(tone.calls.filter(([name]) => name.endsWith('.releaseAll')), [
    ['gated.releaseAll', 12.5],
    ['oneShot.releaseAll', 12.5],
  ]);
});

test('AudioEngine leaves Melody input one-shots alone on Note Off and releases them on Stop', async () => {
  const tone = createFakeTone();
  const matrixSampler = {
    releaseAll: (time) => tone.calls.push(['matrix.releaseAll', time]),
    toDestination: () => matrixSampler,
    triggerAttackRelease: (note) => tone.calls.push(['matrix.triggerAttackRelease', note]),
  };
  const inputSampler = {
    releaseAll: (time) => tone.calls.push(['input.releaseAll', time]),
    toDestination: () => inputSampler,
    triggerAttack: (note, time) => tone.calls.push(['input.triggerAttack', note, time]),
  };
  const oneShotSampler = {
    releaseAll: (time) => tone.calls.push(['oneShot.releaseAll', time]),
    toDestination: () => oneShotSampler,
    triggerAttack: (note, time) => tone.calls.push(['oneShot.triggerAttack', note, time]),
  };
  const engine = new AudioEngine({
    tone,
    melodyOneShotSamplerFactory: () => oneShotSampler,
    playerFactory: createPlayerFactory(tone.calls),
    melodyInputSamplerFactory: () => inputSampler,
    samplerFactory: () => matrixSampler,
  });

  await engine.startAudio();
  await engine.triggerMelodyInputNote('C4');
  engine.releaseMelodyInputNote('C4');
  engine.triggerMelodySampler('G4');

  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('input.')), [
    ['input.triggerAttack', 'C4', 12.5],
  ]);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('oneShot.')), [
    ['oneShot.triggerAttack', 'G4', 12.5],
  ]);

  await engine.stop();
  assert.deepEqual(tone.calls.filter(([name]) => name.endsWith('.releaseAll')), [
    ['matrix.releaseAll', 12.5],
    ['input.releaseAll', 12.5],
    ['oneShot.releaseAll', 12.5],
  ]);
});

test('AudioEngine lets free-playing input samples play as one-shots', async () => {
  const tone = createFakeTone();
  const inputSampler = {
    releaseAll: (time) => tone.calls.push(['input.releaseAll', time]),
    toDestination: () => inputSampler,
    triggerAttack: (note, time) => tone.calls.push(['input.triggerAttack', note, time]),
    triggerAttackRelease: () => {},
  };
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => inputSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.triggerMelodyInputOneShot('E4'), true);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('input.')), [
    ['input.triggerAttack', 'E4', 12.5],
  ]);

  engine.releaseAllMelodyInputNotes();
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('input.')), [
    ['input.triggerAttack', 'E4', 12.5],
    ['input.releaseAll', 12.5],
  ]);
});

test('AudioEngine cancels pending free-playing attacks when input voices are cleared', async () => {
  const tone = createFakeTone();
  const inputSampler = {
    toDestination: () => inputSampler,
    triggerAttack: (note, time) => tone.calls.push(['input.triggerAttack', note, time]),
  };
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => inputSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });
  let finishAudioStart;
  engine.startAudio = () => new Promise((resolve) => {
    finishAudioStart = resolve;
  });

  const pendingAttack = engine.triggerMelodyInputOneShot('G4');
  engine.releaseAllMelodyInputNotes();
  finishAudioStart(AUDIO_STATUSES.READY);

  assert.equal(await pendingAttack, false);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('input.')), []);
});

test('AudioEngine previews Melody sequences as timed input one-shots', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const inputSampler = {
    toDestination: () => inputSampler,
    triggerAttack: (note, time) => tone.calls.push(['input.triggerAttack', note, time]),
  };
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => inputSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });

  assert.equal(await engine.previewMelodySequence(
    ['C4', 'E4', 'G4'],
    { duration: '32n', intervalSeconds: 0.2 },
  ), true);
  assert.deepEqual(timers.getDelays(), [0, 200, 400]);
  timers.runThrough(400);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('input.')), [
    ['input.triggerAttack', 'C4', 12.5],
    ['input.triggerAttack', 'E4', 12.5],
    ['input.triggerAttack', 'G4', 12.5],
  ]);
});

test('AudioEngine cancels stale Melody previews before their scheduled notes fire', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const inputSampler = {
    releaseAll: (time) => tone.calls.push(['input.releaseAll', time]),
    toDestination: () => inputSampler,
    triggerAttack: (note, time) => tone.calls.push(['input.triggerAttack', note, time]),
  };
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => inputSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });

  assert.equal(await engine.previewMelodySequence(['C4', 'E4']), true);
  assert.equal(engine.stopMelodyPreview(), true);
  timers.runThrough(1000);
  assert.deepEqual(tone.calls.filter(([name]) => name === 'input.triggerAttack'), []);
  assert.deepEqual(tone.calls.filter(([name]) => name === 'input.releaseAll'), [
    ['input.releaseAll', 12.5],
  ]);
});

test('AudioEngine applies Melody volume and stops every Melody voice when muted', async () => {
  const tone = createFakeTone();
  const mix = {
    mutedTracks: { melody: false },
    volumes: { melody: -7 },
  };
  const matrixSampler = {
    volume: { value: 0 },
    releaseAll: (time) => tone.calls.push(['matrix.releaseAll', time]),
    toDestination: () => matrixSampler,
    triggerAttackRelease: () => {},
  };
  const inputSampler = {
    volume: { value: 0 },
    releaseAll: (time) => tone.calls.push(['input.releaseAll', time]),
    toDestination: () => inputSampler,
    triggerAttack: () => {},
  };
  const oneShotSampler = {
    volume: { value: 0 },
    releaseAll: (time) => tone.calls.push(['oneShot.releaseAll', time]),
    toDestination: () => oneShotSampler,
    triggerAttack: () => {},
  };
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => inputSampler,
    melodyOneShotSamplerFactory: () => oneShotSampler,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: () => matrixSampler,
    volumeSource: () => mix,
  });

  await engine.triggerMelodyInputNote('C4');
  engine.triggerMelodyOneShot('E4');
  assert.equal(engine.refreshTrackVolume('melody'), -7);
  assert.equal(matrixSampler.volume.value, -7);
  assert.equal(inputSampler.volume.value, -7);
  assert.equal(oneShotSampler.volume.value, -7);

  mix.mutedTracks.melody = true;
  assert.equal(engine.refreshTrackVolume('melody'), -Infinity);
  assert.equal(matrixSampler.volume.value, -Infinity);
  assert.equal(inputSampler.volume.value, -Infinity);
  assert.equal(oneShotSampler.volume.value, -Infinity);
  assert.deepEqual(tone.calls.filter(([name]) => name.endsWith('.releaseAll')), [
    ['matrix.releaseAll', 12.5],
    ['input.releaseAll', 12.5],
    ['oneShot.releaseAll', 12.5],
  ]);
});

test('AudioEngine starts audio and triggers bass sampler notes', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.triggerBassNote('A#1', '8n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttackRelease').at(-1), [
    'sampler.triggerAttackRelease',
    'A#1',
    '8n',
    12.5,
    createBassSampleUrls(),
  ]);
});

test('AudioEngine starts audio and triggers transposed bass sampler notes from anchors', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createVolumeAwareSamplerFactory(tone.calls),
    volumeSource: () => ({ bass: -8 }),
  });

  assert.equal(await engine.triggerBassNote('F#3', '16n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttackRelease').at(-1), [
    'sampler.triggerAttackRelease',
    'F#3',
    '16n',
    12.5,
    -8,
    createBassSampleUrls(),
  ]);
});

test('AudioEngine schedules Melody one-shot preview after audio startup completes', async () => {
  let now = 7;
  const tone = createFakeTone();
  tone.now = () => now;
  tone.start = async () => {
    tone.calls.push(['tone.start']);
    now = 8;
  };
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.triggerMelodyNote('C4', '16n'), true);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttack'), [
    [
      'sampler.triggerAttack',
      'C4',
      8,
      createMelodySampleUrls(),
    ],
  ]);
});

test('AudioEngine respects explicit Melody one-shot preview times', async () => {
  let now = 7;
  const tone = createFakeTone();
  tone.now = () => now;
  tone.start = async () => {
    tone.calls.push(['tone.start']);
    now = 8;
  };
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.triggerMelodyNote('C4', '16n', 12), true);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttack'), [
    [
      'sampler.triggerAttack',
      'C4',
      12,
      createMelodySampleUrls(),
    ],
  ]);
});

test('AudioEngine uses synth fallback when drum samples cannot load', async () => {
  const tone = createFakeTone();
  const fallbackCalls = [];
  const engine = new AudioEngine({
    tone,
    playerFactory: () => {
      throw new Error('sample failed');
    },
    fallbackSynthFactory: () => ({
      triggerAttackRelease: (note, duration, time) => fallbackCalls.push([note, duration, time]),
    }),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.SAMPLE_FALLBACK);
  await engine.triggerDrumsStep('kick');

  assert.deepEqual(fallbackCalls, [['C1', '16n', 12.5]]);
});

test('AudioEngine falls back if a loaded sample player cannot start yet', async () => {
  const tone = createFakeTone();
  const fallbackCalls = [];
  const engine = new AudioEngine({
    tone,
    playerFactory: (url, instrument) => ({
      start: () => {
        throw new Error(`${instrument} sample not ready: ${url}`);
      },
      toDestination: () => tone.calls.push(['player.toDestination', instrument]),
    }),
    fallbackSynthFactory: () => ({
      triggerAttackRelease: (note, duration, time) => fallbackCalls.push([note, duration, time]),
    }),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  await engine.triggerDrumsStep('hihat');

  assert.deepEqual(fallbackCalls, [['F#1', '16n', 12.5]]);
});

test('AudioEngine contains fallback synth trigger errors during stacked drums preview', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    playerFactory: () => {
      throw new Error('sample failed');
    },
    fallbackSynthFactory: () => ({
      triggerAttackRelease: () => {
        throw new Error('same start time');
      },
    }),
  });

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.SAMPLE_FALLBACK);
  assert.deepEqual(await engine.triggerDrumsStep(['kick', 'snare']), []);
});

test('AudioEngine syncs transport play pause stop and seek', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({ bpm: 96 });
  await engine.pause();
  await engine.seekToStep(3, 12);
  await engine.stop();

  assert.equal(tone.Transport.bpm.value, 96);
  assert.equal(tone.Transport.position, '3:3:0');
  assert.equal(engine.currentBar, 3);
  assert.equal(engine.currentStep, 12);
  assert.equal(engine.transportFlatStep, 60);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('transport.')), [
    ['transport.scheduleRepeat', '16n'],
    ['transport.start'],
    ['transport.pause'],
    ['transport.stop', 12.5],
    ['transport.clear', 'repeat-id'],
  ]);
});

test('AudioEngine waits for matrix samples before starting first playback', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const chordSampleCalls = [];
  const chordFallbackCalls = [];
  let resolveSamples;
  let markSamplesLoading;
  let samplesReady = false;
  matrix.chord[0][0] = { root: 'C', quality: 'maj', label: 'C' };
  const samplesLoading = new Promise((resolve) => {
    markSamplesLoading = resolve;
  });
  tone.loaded = () => {
    tone.calls.push(['tone.loaded']);
    markSamplesLoading();
    return new Promise((resolve) => {
      resolveSamples = resolve;
    });
  };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: () => ({
      triggerAttackRelease: (notes) => {
        if (!samplesReady) throw new Error('chord sample is not ready');
        chordSampleCalls.push(notes);
      },
    }),
    chordSynthFactory: () => ({
      triggerAttackRelease: (notes) => chordFallbackCalls.push(notes),
    }),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  const playPromise = engine.play({ bpm: 88 });
  await samplesLoading;

  assert.equal(tone.calls.some(([name]) => name === 'tone.loaded'), true);
  assert.equal(tone.calls.some(([name]) => name === 'transport.start'), false);

  samplesReady = true;
  resolveSamples();
  assert.equal(await playPromise, true);
  assert.equal(tone.calls.some(([name]) => name === 'transport.start'), true);
  tone.Transport.scheduledCallback(24);
  assert.deepEqual(chordSampleCalls, [['C4', 'E4', 'G4']]);
  assert.deepEqual(chordFallbackCalls, []);
});

test('AudioEngine does not start stale playback after stopping during sample loading', async () => {
  const tone = createFakeTone();
  let resolveSamples;
  let markSamplesLoading;
  const samplesLoading = new Promise((resolve) => {
    markSamplesLoading = resolve;
  });
  tone.loaded = () => {
    markSamplesLoading();
    return new Promise((resolve) => {
      resolveSamples = resolve;
    });
  };
  const engine = new AudioEngine({
    tone,
    matrixSource: createInitialMatrix(),
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  const playPromise = engine.play({ bpm: 88 });
  await samplesLoading;
  await engine.stop();
  resolveSamples();

  assert.equal(await playPromise, false);
  assert.equal(tone.calls.some(([name]) => name === 'transport.start'), false);
});

test('AudioEngine changes live tempo without seeking or restarting transport', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({
    tone,
    matrixSource: createInitialMatrix(),
    playerFactory: createPlayerFactory(tone.calls),
  });

  assert.equal(engine.setTempo(104), false);
  await engine.play({ bpm: 88, bar: 2, step: 4 });
  const positionBeforeTempoChange = tone.Transport.position;
  const callsBeforeTempoChange = [...tone.calls];

  assert.equal(engine.setTempo(104), true);
  assert.equal(tone.Transport.bpm.value, 104);
  assert.equal(tone.Transport.position, positionBeforeTempoChange);
  assert.equal(engine.currentBar, 2);
  assert.equal(engine.currentStep, 4);
  assert.deepEqual(tone.calls, callsBeforeTempoChange);
});

test('AudioEngine play position callback follows scheduled transport ticks', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const positions = [];
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({
    bpm: 120,
    onPositionChange: (bar, step) => positions.push([bar, step]),
  });
  tone.Transport.scheduledCallback(24);
  tone.Transport.scheduledCallback(24.125);
  tone.Transport.scheduledCallback(24.25);

  assert.deepEqual(positions, [
    [0, 0],
    [0, 1],
    [0, 2],
  ]);
  assert.equal(engine.currentBar, 0);
  assert.equal(engine.currentStep, 2);
  assert.equal(engine.transportFlatStep, 3);
});

test('AudioEngine prepares recording positions early and draws the playhead at audible time', async () => {
  const tone = createFakeTone();
  const drawEvents = [];
  tone.getDraw = () => ({
    schedule(callback, time) {
      drawEvents.push({ callback, time });
    },
  });
  const scheduledPositions = [];
  const audiblePositions = [];
  const engine = new AudioEngine({
    tone,
    matrixSource: createInitialMatrix(),
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({
    bpm: 120,
    onPositionChange: (bar, step) => audiblePositions.push([bar, step]),
    onScheduledPositionChange: (bar, step) => scheduledPositions.push([bar, step]),
  });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(scheduledPositions, [[0, 0]]);
  assert.deepEqual(audiblePositions, []);
  assert.equal(drawEvents[0].time, 24);

  drawEvents[0].callback();
  assert.deepEqual(audiblePositions, [[0, 0]]);

  tone.Transport.scheduledCallback(24.125);
  await engine.stop();
  drawEvents[1].callback();
  assert.deepEqual(audiblePositions, [[0, 0]]);
});

test('AudioEngine keeps live recording active until bounded playback is audibly complete', async () => {
  const tone = createFakeTone();
  const drawEvents = [];
  tone.getDraw = () => ({
    schedule(callback, time) {
      drawEvents.push({ callback, time });
    },
  });
  const completions = [];
  const engine = new AudioEngine({
    tone,
    matrixSource: createInitialMatrix(),
    onPlaybackComplete: (completion) => completions.push(completion),
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({ bpm: 120, maxPlaybackSteps: 1 });
  tone.Transport.scheduledCallback(24);

  assert.equal(engine.transportRunning, true);
  assert.deepEqual(completions, []);
  assert.equal(drawEvents.length, 2);

  drawEvents.forEach(({ callback }) => callback());
  assert.equal(engine.transportRunning, false);
  assert.deepEqual(completions, [{ bar: 0, playedSteps: 1, step: 0 }]);
});

test('AudioEngine avoids touching Tone transport before audio starts', async () => {
  const engine = new AudioEngine({ tone: createToneWithBlockedTransport() });

  engine.seekToStep(2, 8);
  await engine.pause();
  await engine.stop();

  assert.equal(engine.currentBar, 2);
  assert.equal(engine.currentStep, 8);
  assert.equal(engine.transportFlatStep, 40);
});

test('AudioEngine matrix playback triggers drums bass chord and melody events', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.bass[0][0] = { type: 'bass', note: 'C1', duration: '8n' };
  matrix.chord[0][0] = { root: 'C', quality: 'maj', label: 'C' };
  matrix.melody[0][0] = { type: 'melody', note: 'G4', durationSteps: 4 };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createChordSamplerFactory(tone.calls),
    chordSynthFactory: createChordSynthFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => (
    name === 'player.start'
    || name === 'chordSampler.triggerAttackRelease'
    || name === 'sampler.triggerAttack'
    || name === 'sampler.triggerAttackRelease'
  )), [
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 24],
    [
      'sampler.triggerAttackRelease',
      'C1',
      '8n',
      24,
      createBassSampleUrls(),
    ],
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 24, createChordSampleUrls()],
    ['sampler.triggerAttack', 'G4', 24, createMelodySampleUrls()],
  ]);
});

test('AudioEngine matrix playback applies drum microtiming and velocity', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = {
    instruments: ['hihat'],
    timingOffsets: { hihat: 0.24 },
    velocities: { hihat: 0.5 },
  };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    volumeSource: () => ({ drums: -8 }),
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'player.start'), [
    [
      'player.start',
      'hihat',
      versioned('/samples/Drums/Hihat_v0.22.wav'),
      24.03,
      -14.020599913279625,
    ],
  ]);
});

test('AudioEngine matrix playback applies chord preset microtiming and velocity', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.chord[0][0] = {
    type: 'notes',
    notes: ['C3', 'E3', 'G3'],
    label: 'C3/E3/G3',
    timingOffset: 0.08,
    velocity: 0.5,
  };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    volumeSource: () => ({ chord: -8 }),
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'chordSampler.triggerAttackRelease'), [
    [
      'chordSampler.triggerAttackRelease',
      ['C3', 'E3', 'G3'],
      '2s',
      24.01,
      -14.020599913279625,
      createChordSampleUrls(),
    ],
  ]);
});

test('AudioEngine filters matrix playback tracks and stops after the requested step count', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const completions = [];
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.bass[0][0] = { type: 'bass', note: 'C1' };
  matrix.chord[0][0] = { root: 'C', quality: 'maj', label: 'C' };
  matrix.melody[0][0] = { type: 'melody', note: 'G4' };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    onPlaybackComplete: (result) => completions.push(result),
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createChordSamplerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  await engine.play({
    audibleTrackIds: ['melody'],
    bpm: 120,
    maxPlaybackSteps: 2,
  });
  tone.Transport.scheduledCallback(24);
  tone.Transport.scheduledCallback(24.125);

  assert.deepEqual(tone.calls.filter(([name]) => (
    name === 'player.start'
    || name === 'chordSampler.triggerAttackRelease'
    || name === 'sampler.triggerAttack'
    || name === 'sampler.triggerAttackRelease'
  )), [
    ['sampler.triggerAttack', 'G4', 24, createMelodySampleUrls()],
  ]);
  assert.deepEqual(completions, [{ bar: 0, playedSteps: 2, step: 1 }]);
  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('transport.')), [
    ['transport.scheduleRepeat', '16n'],
    ['transport.start'],
    ['transport.stop', 24.125],
    ['transport.clear', 'repeat-id'],
  ]);
});

test('AudioEngine restores all matrix tracks on the next ordinary play', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.melody[0][0] = { type: 'melody', note: 'G4' };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  await engine.play({ audibleTrackIds: ['melody'], maxPlaybackSteps: 1 });
  tone.Transport.scheduledCallback(24);
  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(25);

  assert.equal(tone.calls.some(([name]) => name === 'player.start'), true);
  assert.equal(tone.calls.filter(([name]) => name === 'sampler.triggerAttack').length, 2);
});

test('AudioEngine bounded playback stops at bar eight without looping to the start', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const positions = [];
  const completions = [];
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    onPlaybackComplete: (result) => completions.push(result),
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({
    bar: 6,
    maxPlaybackSteps: 2 * STEPS_PER_BAR,
    onPositionChange: (bar, step) => positions.push([bar, step]),
    step: 0,
  });
  for (let index = 0; index < 2 * STEPS_PER_BAR; index += 1) {
    tone.Transport.scheduledCallback(24 + index * 0.125);
  }

  assert.deepEqual(positions[0], [6, 0]);
  assert.deepEqual(positions.at(-1), [7, 15]);
  assert.equal(positions.some(([bar]) => bar === 0), false);
  assert.deepEqual(completions, [{ bar: 7, playedSteps: 32, step: 15 }]);
});

test('AudioEngine clears existing matrix playback even when Tone returns event id zero', async () => {
  const tone = createFakeToneWithEventIds([0, 1]);
  const matrix = createInitialMatrix();
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    playerFactory: createPlayerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  await engine.play({ bpm: 120 });

  assert.deepEqual(tone.calls.filter(([name]) => name.startsWith('transport.')), [
    ['transport.scheduleRepeat', '16n'],
    ['transport.start'],
    ['transport.clear', 0],
    ['transport.scheduleRepeat', '16n'],
    ['transport.start'],
  ]);
});

test('AudioEngine applies current track volumes to matrix playback events', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  const volumes = { drums: -18, bass: -12, chord: -9, melody: -4 };
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.bass[0][0] = { type: 'bass', note: 'G0', duration: '8n' };
  matrix.chord[0][0] = { root: 'C', quality: 'maj', label: 'C' };
  matrix.melody[0][0] = { type: 'melody', note: 'A4' };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    volumeSource: () => volumes,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
    samplerFactory: createVolumeAwareSamplerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => (
    name === 'player.start'
    || name === 'chordSampler.triggerAttackRelease'
    || name === 'sampler.triggerAttack'
    || name === 'sampler.triggerAttackRelease'
  )), [
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 24, -18],
    [
      'sampler.triggerAttackRelease',
      'G0',
      '8n',
      24,
      -12,
      createBassSampleUrls(),
    ],
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 24, -9, createChordSampleUrls()],
    [
      'sampler.triggerAttack',
      'A4',
      24,
      -4,
      createMelodySampleUrls(),
    ],
  ]);
});

test('AudioEngine uses the selected Melody timbre bank and its configured gain', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.melody[0][0] = { type: 'melody', note: 'D#4' };
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    melodyTimbreSource: () => 'blues',
    volumeSource: () => ({ melody: -4 }),
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
    samplerFactory: createVolumeAwareSamplerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'sampler.triggerAttack'), [[
    'sampler.triggerAttack',
    'D#4',
    24,
    -7,
    createMelodySampleUrls('/', 'blues'),
  ]]);
});

test('AudioEngine prepares each Melody timbre once and reuses its preview bank', async () => {
  const tone = createFakeTone();
  tone.loaded = async () => tone.calls.push(['tone.loaded']);
  let previewFactoryCalls = 0;
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: (urls) => {
      previewFactoryCalls += 1;
      tone.calls.push(['preview.urls', urls]);
      return {
        toDestination() { return this; },
      };
    },
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.prepareMelodyTimbre('yangqin'), true);
  assert.equal(await engine.prepareMelodyTimbre('yangqin'), true);
  assert.equal(previewFactoryCalls, 1);
  assert.equal(tone.calls.filter(([name]) => name === 'tone.loaded').length, 1);
  assert.equal(
    tone.calls.find(([name]) => name === 'preview.urls')[1].C3,
    createMelodySampleUrls('/', 'yangqin').C3,
  );
});

test('AudioEngine clears a failed Melody timbre load so the same bank can be retried', async () => {
  const tone = createFakeTone();
  let loadAttempts = 0;
  tone.loaded = async () => {
    loadAttempts += 1;
    if (loadAttempts === 1) throw new Error('sample load failed');
  };
  let previewFactoryCalls = 0;
  const engine = new AudioEngine({
    tone,
    melodyInputSamplerFactory: () => {
      previewFactoryCalls += 1;
      return {
        dispose: () => tone.calls.push(['preview.dispose']),
        releaseAll: () => tone.calls.push(['preview.releaseAll']),
        toDestination() { return this; },
      };
    },
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  assert.equal(await engine.prepareMelodyTimbre('yangqin'), false);
  assert.equal(await engine.prepareMelodyTimbre('yangqin'), true);
  assert.equal(previewFactoryCalls, 2);
  assert.equal(loadAttempts, 2);
  assert.equal(tone.calls.some(([name]) => name === 'preview.dispose'), true);
});

test('AudioEngine changes prepared Melody timbres during playback without stopping Transport', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix.melody[0][0] = { type: 'melody', note: 'C4' };
  matrix.melody[0][1] = { type: 'melody', note: 'D4' };
  let timbreId = 'piano';
  const engine = new AudioEngine({
    tone,
    matrixSource: matrix,
    melodyTimbreSource: () => timbreId,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createSamplerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);
  timbreId = 'blues';
  assert.equal(await engine.prepareMelodyTimbre(timbreId), true);
  assert.equal(engine.activateMelodyTimbre(timbreId), true);
  tone.Transport.scheduledCallback(24.125);

  const melodyCalls = tone.calls.filter(([name]) => name === 'sampler.triggerAttack');
  assert.equal(melodyCalls[0][3].C4, createMelodySampleUrls('/', 'piano').C4);
  assert.equal(melodyCalls[1][3].C4, createMelodySampleUrls('/', 'blues').C4);
  assert.equal(tone.calls.some(([name]) => name === 'transport.stop'), false);
});

test('AudioEngine keeps duplicate track instance volume and mute channels independent', async () => {
  const tone = createFakeTone();
  const matrix = createInitialMatrix();
  matrix['drums-2'] = createInitialMatrix().drums;
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix['drums-2'][0][0] = { instruments: ['kick'] };
  const mix = {
    mutedTracks: { drums: false, 'drums-2': true },
    volumes: { drums: -12, 'drums-2': -4 },
  };
  const matrixSource = {
    matrix,
    trackInstancesById: {
      drums: { id: 'drums', type: 'drums' },
      'drums-2': { id: 'drums-2', type: 'drums' },
    },
    trackOrder: ['drums', 'drums-2'],
  };
  const engine = new AudioEngine({
    tone,
    matrixSource,
    volumeSource: () => mix,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
  });

  await engine.play({ bpm: 120 });
  tone.Transport.scheduledCallback(24);

  assert.deepEqual(tone.calls.filter(([name]) => name === 'player.start'), [
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 24, -12],
    ['player.start', 'kick', versioned('/samples/Drums/Kick_v0.22.wav'), 24, -Infinity],
  ]);
  assert.equal(engine.refreshTrackVolume('drums'), -12);
  assert.equal(engine.refreshTrackVolume('drums-2'), -Infinity);
});

test('AudioEngine applies live track volume source to drums previews', async () => {
  const tone = createFakeTone();
  const volumes = { drums: -12 };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => volumes,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
  });

  await engine.triggerDrumsStep('snare');
  volumes.drums = -6;
  await engine.triggerDrumsStep('snare');

  assert.deepEqual(tone.calls.filter(([name]) => name === 'player.start'), [
    ['player.start', 'snare', versioned('/samples/Drums/Snare_v0.22.wav'), 12.5, -12],
    ['player.start', 'snare', versioned('/samples/Drums/Snare_v0.22.wav'), 12.5, -6],
  ]);
});

test('AudioEngine applies independent mute state without losing the stored track volume', async () => {
  const tone = createFakeTone();
  const mix = {
    mutedTracks: { drums: true },
    volumes: { drums: -12 },
  };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => mix,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
  });

  await engine.triggerDrumsStep('snare');
  mix.mutedTracks.drums = false;
  await engine.triggerDrumsStep('snare');

  assert.deepEqual(tone.calls.filter(([name]) => name === 'player.start'), [
    ['player.start', 'snare', versioned('/samples/Drums/Snare_v0.22.wav'), 12.5, -Infinity],
    ['player.start', 'snare', versioned('/samples/Drums/Snare_v0.22.wav'), 12.5, -12],
  ]);
});

test('AudioEngine refreshTrackVolume mutes current nodes immediately and restores dB volume', async () => {
  const tone = createFakeTone();
  const mix = {
    mutedTracks: { drums: false },
    volumes: { drums: -12 },
  };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => mix,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
  });

  await engine.triggerDrumsStep('kick');
  mix.mutedTracks.drums = true;
  assert.equal(engine.refreshTrackVolume('drums'), -Infinity);
  assert.equal(engine.drumPlayers.get('kick').volume.value, -Infinity);

  mix.mutedTracks.drums = false;
  assert.equal(engine.refreshTrackVolume('drums'), -12);
  assert.equal(engine.drumPlayers.get('kick').volume.value, -12);
});

test('scheduled Chord previews read mute state when each event fires', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const mix = {
    mutedTracks: { chord: false },
    volumes: { chord: -7 },
  };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => mix,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const previewPromise = engine.previewChordClipSequence([
    { step: 0, notes: ['C4', 'E4', 'G4'], duration: '16n' },
    { step: 4, notes: ['F4', 'A4', 'C5'], duration: '16n' },
  ], { bpm: 120, totalSteps: 8 });
  await Promise.resolve();

  timers.runThrough(0);
  mix.mutedTracks.chord = true;
  timers.runThrough(500);
  timers.runThrough(1000);
  await previewPromise;

  assert.deepEqual(
    tone.calls
      .filter(([name]) => name === 'chordSampler.triggerAttackRelease')
      .map((call) => call[4]),
    [-7, -Infinity],
  );
});

test('AudioEngine previews chord sequences with one audio start and timed chord triggers', async () => {
  const tone = createFakeTone();
  const volumes = { chord: -7 };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => volumes,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
  });

  await engine.previewChordSequence([
    ['C4', 'E4', 'G4'],
    ['F4', 'A4', 'C5'],
  ]);

  assert.equal(tone.calls.filter(([name]) => name === 'tone.start').length, 1);
  assert.deepEqual(tone.calls.filter(([name]) => name === 'chordSampler.triggerAttackRelease'), [
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 12.5, -7, createChordSampleUrls()],
    ['chordSampler.triggerAttackRelease', ['F4', 'A4', 'C5'], '2s', 13.05, -7, createChordSampleUrls()],
  ]);
});

test('AudioEngine previews chord groove patterns with sixteenth-step timing', async () => {
  const tone = createFakeTone();
  const volumes = { chord: -5 };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => volumes,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
  });

  await engine.previewChordPattern([
    { step: 0, notes: ['C4', 'E4', 'G4'], duration: '16n' },
    { step: 6, notes: ['C4', 'E4', 'G4'], duration: '16n' },
    { step: 12, notes: ['C4', 'E4', 'G4'], duration: '16n' },
  ], { bpm: 120 });

  assert.equal(tone.calls.filter(([name]) => name === 'tone.start').length, 1);
  assert.deepEqual(tone.calls.filter(([name]) => name === 'chordSampler.triggerAttackRelease'), [
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 12.5, -5, createChordSampleUrls()],
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 13.25, -5, createChordSampleUrls()],
    ['chordSampler.triggerAttackRelease', ['C4', 'E4', 'G4'], '2s', 14, -5, createChordSampleUrls()],
  ]);
});

test('AudioEngine previews a cancelable four-clip chord sequence through the 64-step boundary', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const engine = new AudioEngine({
    tone,
    volumeSource: () => ({ chord: -4 }),
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const previewPromise = engine.previewChordClipSequence([
    { step: 0, notes: ['C3', 'E3', 'G3'], duration: '16n' },
    { step: 16, notes: ['A3', 'C4', 'E3'], duration: '16n' },
    { step: 32, notes: ['F3', 'A3', 'C3'], duration: '16n' },
    { step: 48, notes: ['G3', 'B3', 'D3'], duration: '16n' },
  ], { bpm: 120, totalSteps: 64 });
  await Promise.resolve();

  assert.deepEqual(timers.getDelays(), [0, 2000, 4000, 6000, 8000]);
  timers.runThrough(6000);
  assert.deepEqual(
    tone.calls
      .filter(([name]) => name === 'chordSampler.triggerAttackRelease')
      .map((call) => [call[1], call[3], call[4]]),
    [
      [['C3', 'E3', 'G3'], 12.5, -4],
      [['A3', 'C4', 'E3'], 12.5, -4],
      [['F3', 'A3', 'C3'], 12.5, -4],
      [['G3', 'B3', 'D3'], 12.5, -4],
    ],
  );

  timers.runThrough(8000);
  assert.equal(await previewPromise, 'completed');
  assert.equal(timers.size(), 0);
  assert.deepEqual(tone.calls.filter(([name]) => name.endsWith('releaseAll')), [
    ['chordSampler.releaseAll', 12.5],
    ['chord.releaseAll', 12.5],
  ]);
});

test('AudioEngine chord preset previews apply swing timing and hit velocity', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const engine = new AudioEngine({
    tone,
    volumeSource: () => ({ chord: -4 }),
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const previewPromise = engine.previewChordClipSequence([{
    step: 1,
    notes: ['C3', 'E3', 'G3'],
    duration: '16n',
    timingOffset: 0.1,
    velocity: 0.5,
  }], { bpm: 120, totalSteps: 16 });
  await Promise.resolve();

  assert.deepEqual(timers.getDelays(), [137.5, 2000]);
  timers.runThrough(137.5);
  assert.deepEqual(
    tone.calls.filter(([name]) => name === 'chordSampler.triggerAttackRelease'),
    [[
      'chordSampler.triggerAttackRelease',
      ['C3', 'E3', 'G3'],
      '2s',
      12.5,
      -10.020599913279625,
      createChordSampleUrls(),
    ]],
  );
  timers.runThrough(2000);
  assert.equal(await previewPromise, 'completed');
});

test('AudioEngine stops and supersedes chord clip previews without leaving scheduled hits', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    chordSynthFactory: createVolumeAwareChordSynthFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const firstPreview = engine.previewChordClipSequence([
    { step: 0, notes: ['C3', 'E3', 'G3'] },
    { step: 16, notes: ['F3', 'A3', 'C3'] },
  ], { bpm: 120, totalSteps: 64 });
  await Promise.resolve();
  timers.runThrough(0);

  const secondPreview = engine.previewChordClipSequence([
    { step: 0, notes: ['G3', 'B3', 'D3'] },
  ], { bpm: 120, totalSteps: 64 });
  assert.equal(await firstPreview, 'stopped');
  await Promise.resolve();
  assert.equal(engine.stopChordClipSequencePreview(), true);
  assert.equal(await secondPreview, 'stopped');
  assert.equal(timers.size(), 0);
  assert.ok(timers.cancelled.length >= 3);
  assert.equal(await engine.previewChordClipSequence([], { totalSteps: 64 }), 'empty');
  assert.equal(engine.stopChordClipSequencePreview(), false);
});

test('AudioEngine previews one drum-template bar with stacked hits and live mix state', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const mix = {
    mutedTracks: { drums: false },
    volumes: { drums: -8 },
  };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => mix,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const previewPromise = engine.previewDrumsPattern([
    {
      step: 0,
      instruments: ['kick', 'hihat'],
      timingOffsets: { hihat: 0.24, kick: 0 },
      velocities: { hihat: 0.5, kick: 1 },
    },
    { step: 4, instruments: ['snare'] },
  ], { bpm: 120, totalSteps: 16 });
  await Promise.resolve();

  assert.deepEqual(timers.getDelays(), [0, 30, 500, 2000]);
  timers.runThrough(0);
  timers.runThrough(30);
  mix.mutedTracks.drums = true;
  timers.runThrough(500);
  timers.runThrough(2000);

  assert.equal(await previewPromise, 'completed');
  assert.deepEqual(
    tone.calls
      .filter(([name]) => name === 'player.start')
      .map((call) => [call[1], call[4]]),
    [
      ['kick', -8],
      ['hihat', -14.020599913279625],
      ['snare', -Infinity],
    ],
  );
  assert.equal(timers.size(), 0);
});

test('AudioEngine stops and supersedes drum-template previews without stale hits', async () => {
  const tone = createFakeTone();
  const timers = createManualTimers();
  const engine = new AudioEngine({
    tone,
    playerFactory: createPlayerFactory(tone.calls),
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  await engine.startAudio();

  const firstPreview = engine.previewDrumsPattern([
    { step: 0, instruments: ['kick'] },
    { step: 12, instruments: ['snare'] },
  ], { bpm: 120 });
  await Promise.resolve();
  timers.runThrough(0);

  const secondPreview = engine.previewDrumsPattern([
    { step: 0, instruments: ['hihat'] },
  ], { bpm: 120 });
  assert.equal(await firstPreview, 'stopped');
  await Promise.resolve();
  assert.equal(engine.stopDrumsPatternPreview(), true);
  assert.equal(await secondPreview, 'stopped');
  assert.equal(timers.size(), 0);
  assert.ok(timers.cancelled.length >= 3);
  assert.equal(await engine.previewDrumsPattern([]), 'empty');
  assert.equal(engine.stopDrumsPatternPreview(), false);
});

test('AudioEngine previews bass groove patterns with sixteenth-step timing', async () => {
  const tone = createFakeTone();
  const volumes = { bass: -10 };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => volumes,
    playerFactory: createPlayerFactory(tone.calls),
    samplerFactory: createVolumeAwareSamplerFactory(tone.calls),
  });

  await engine.previewBassPattern([
    { step: 0, note: 'C1', duration: '8n' },
    { step: 4, note: 'G0', duration: '8n' },
    { step: 10, note: 'A#0', duration: '16n' },
  ], { bpm: 120 });

  assert.equal(tone.calls.filter(([name]) => name === 'tone.start').length, 1);
  const samplerCalls = tone.calls.filter(([name]) => name === 'sampler.triggerAttackRelease');
  assert.deepEqual(samplerCalls.map((call) => call.slice(0, 5)), [
    ['sampler.triggerAttackRelease', 'C1', '8n', 12.5, -10],
    ['sampler.triggerAttackRelease', 'G0', '8n', 13, -10],
    ['sampler.triggerAttackRelease', 'A#0', '16n', 13.75, -10],
  ]);
  assert.equal(samplerCalls[0].at(-1).C1, versioned('/samples/Bass/Bass_C1_v0.22.wav'));
  assert.equal(samplerCalls[1].at(-1).G0, versioned('/samples/Bass/Bass_G0_v0.22.wav'));
  assert.equal(samplerCalls[2].at(-1).A0, versioned('/samples/Bass/Bass_A0_v0.22.wav'));
});

test('createAudioEngine defers the default Tone dependency until audio starts', async () => {
  const tone = createFakeTone();
  const loadToneCalls = [];
  const engine = createAudioEngine({
    loadTone: async () => {
      loadToneCalls.push('loadTone');
      return tone;
    },
    playerFactory: createPlayerFactory(tone.calls),
  });

  assert.equal(engine.status, AUDIO_STATUSES.IDLE);
  assert.equal(engine.tone, null);
  assert.deepEqual(loadToneCalls, []);

  assert.equal(await engine.startAudio(), AUDIO_STATUSES.READY);
  assert.equal(engine.tone, tone);
  assert.deepEqual(loadToneCalls, ['loadTone']);
});

test('createAudioEngine does not statically import Tone on module load', async () => {
  const source = await readFile(new URL('../src/audio/createAudioEngine.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /import\s+\*\s+as\s+Tone\s+from ['"]tone['"]/);
});

test('imported twenty-bar arranger playback loads per-note banks, preserves edited durations and wraps exactly once', async () => {
  const tone = createFakeTone();
  const notes = [];
  const positions = [];
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const loaded = [];
  engine.prepareMelodyTimbre = async (id) => {
    loaded.push(id);
    engine.melodyPreviewBanks.set(id, { ready: true, sampler: { triggerAttackRelease: (...args) => notes.push([id, ...args]), releaseAll() {} } });
    return true;
  };
  const matrix = createInitialMatrix(20);
  matrix.melody[0][0] = { type: 'melody', note: 'C4', timbreId: 'yangqin', duration: '16n' };
  matrix.melody[19][15] = { type: 'melody', note: 'D#4', timbreId: 'blues', durationSteps: 3, velocity: .6 };
  await engine.play({ matrixSource: () => matrix, totalBars: 20, bpm: 100, bar: 0, step: 0, onPositionChange: (bar, step) => positions.push([bar, step]) });
  assert.deepEqual(loaded, ['yangqin', 'blues']);
  for (let step = 0; step <= 320; step += 1) tone.Transport.scheduledCallback(step * .15);
  assert.deepEqual(positions[319], [19, 15]);
  assert.deepEqual(positions[320], [0, 0]);
  assert.equal(tone.calls.filter(([method]) => method === 'transport.start').length, 1);
  assert.equal(notes.filter(([id]) => id === 'blues').length, 1);
  assert.deepEqual(notes.find(([id]) => id === 'blues'), ['blues', 'D#4', .45, 47.85, .6]);
  await engine.stop();
});

test('import/stop during melody bank loading cancels both arranger startup and note audition', async () => {
  const tone = createFakeTone();
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const notes = [];
  let finish;
  engine.prepareMelodyTimbre = () => new Promise(resolve => { finish = () => {
    engine.melodyPreviewBanks.set('blues', { ready: true, sampler: { triggerAttackRelease: (...args) => notes.push(args) } });
    resolve(true);
  }; });
  const matrix = { melody: [[{ type: 'melody', note: 'D#4', timbreId: 'blues' }], []] };
  const playing = engine.play({ matrixSource: () => matrix, totalBars: 2 });
  await new Promise(resolve => setImmediate(resolve));
  await engine.stop();
  finish();
  assert.equal(await playing, false);
  assert.ok(!tone.calls.some(([method]) => method === 'transport.start'));
  const audition = engine.triggerMelodyInputOneShot('D#4', undefined, { timbreId: 'blues', durationSteps: 2, bpm: 100 });
  await new Promise(resolve => setImmediate(resolve));
  await engine.stop();
  finish();
  assert.equal(await audition, false);
  assert.deepEqual(notes, []);
});

function createImportedMelodyTestEngine(options = {}) {
  const tone = createFakeTone();
  const mix = {
    mutedTracks: { melody: false, 'melody-2': true },
    volumes: { melody: -6, 'melody-2': -18 },
  };
  const engine = new AudioEngine({
    tone,
    volumeSource: () => mix,
    playerFactory: createPlayerFactory(tone.calls),
    melodyInputSamplerFactory: () => ({
      volume: { value: 0 },
      attacks: [],
      activeNotes: new Set(),
      releases: [],
      disposed: false,
      triggerAttackRelease(note, duration, time) {
        this.attacks.push({ note, duration, time });
        this.activeNotes.add(note);
      },
      triggerAttack(note, time) { this.triggerAttackRelease(note, undefined, time); },
      releaseAll(time) {
        this.releases.push(time);
        this.activeNotes.clear();
      },
      dispose() { this.disposed = true; },
      toDestination() { return this; },
    }),
    ...options,
  });
  return { engine, mix, tone };
}

test('imported same-timbre melody tracks keep independent gain, mute and sustained voices', async () => {
  const { engine, mix, tone } = createImportedMelodyTestEngine();
  const matrix = createInitialMatrix(2);
  matrix['melody-2'] = createInitialMatrix(2).melody;
  matrix.melody[0][0] = { type: 'melody', note: 'C4', timbreId: 'piano', durationSteps: 16 };
  matrix.melody[0][1] = { type: 'melody', note: 'D4', timbreId: 'blues', durationSteps: 8 };
  matrix['melody-2'][0][0] = { type: 'melody', note: 'E4', timbreId: 'piano', durationSteps: 16 };
  engine.setMatrixSource(() => ({ matrix, trackOrder: ['melody', 'melody-2'] }));
  await engine.play({ bpm: 120, totalBars: 2, bar: 0, step: 0 });
  tone.Transport.scheduledCallback(0);
  tone.Transport.scheduledCallback(.125);

  const piano = engine.getMelodyBank('piano', 'melody').sampler;
  const blues = engine.getMelodyBank('blues', 'melody').sampler;
  const second = engine.getMelodyBank('piano', 'melody-2').sampler;
  assert.notEqual(piano, second);
  assert.equal(piano.volume.value, -6, 'muted duplicate must not silence the original');
  assert.equal(blues.volume.value, -9);
  assert.equal(second.volume.value, -Infinity);
  assert.deepEqual(piano.attacks, [{ note: 'C4', duration: 2, time: 0 }]);

  mix.mutedTracks['melody-2'] = false;
  engine.refreshTrackVolume('melody-2');
  assert.equal(second.volume.value, -18);
  mix.volumes.melody = -11;
  engine.refreshTrackVolume('melody');
  assert.equal(piano.volume.value, -11);
  assert.equal(blues.volume.value, -14);
  assert.equal(second.volume.value, -18);

  mix.mutedTracks.melody = true;
  const legacyReleases = [];
  engine.instanceAudioNodes.set('melody-2', {
    melodyOneShotSampler: { releaseAll: (time) => legacyReleases.push(time) },
  });
  engine.refreshTrackVolume('melody');
  assert.equal(piano.volume.value, -Infinity);
  assert.equal(blues.volume.value, -Infinity);
  assert.equal(piano.activeNotes.size, 0);
  assert.equal(blues.activeNotes.size, 0);
  assert.deepEqual([...second.activeNotes], ['E4']);
  assert.deepEqual(second.releases, []);
  assert.deepEqual(legacyReleases, [], 'muting core Melody must leave duplicate one-shot voices alone too');
  await engine.triggerMelodyInputOneShot('F4', 1, { trackId: 'melody-2', timbreId: 'piano' });
  assert.equal(second.attacks.at(-1).note, 'F4');
  assert.equal(piano.attacks.length, 1);
  await engine.stop();
});

test('pause and stop release imported melody banks on every track without discarding prepared samples', async () => {
  const { engine, mix } = createImportedMelodyTestEngine();
  mix.mutedTracks['melody-2'] = false;
  for (const trackId of ['melody', 'melody-2']) {
    await engine.triggerMelodyInputOneShot('C4', 0, { trackId, timbreId: 'piano', durationSteps: 16 });
  }
  const samplers = ['melody', 'melody-2'].map((id) => engine.getMelodyBank('piano', id).sampler);
  await engine.pause();
  for (const sampler of samplers) {
    assert.equal(sampler.activeNotes.size, 0);
    assert.equal(sampler.disposed, false);
    assert.equal(sampler.releases.length, 1);
  }
  for (const trackId of ['melody', 'melody-2']) {
    await engine.triggerMelodyInputOneShot('D4', 1, { trackId, timbreId: 'piano' });
  }
  await engine.stop(2);
  engine.stopAllVoices(3);
  for (const sampler of samplers) {
    assert.equal(sampler.activeNotes.size, 0);
    assert.deepEqual(sampler.releases, [12.5, 2, 3]);
    assert.equal(sampler.disposed, false);
  }
});

test('deleting a melody track disposes only its voices and allows an undo to recreate its banks', async () => {
  const { engine } = createImportedMelodyTestEngine();
  await engine.prepareMelodyTimbre('piano', 'melody');
  await engine.prepareMelodyTimbre('piano', 'melody-2');
  await engine.prepareMelodyTimbre('blues', 'melody-2');
  const core = engine.getMelodyBank('piano').sampler;
  const removed = ['piano', 'blues'].map((id) => engine.getMelodyBank(id, 'melody-2').sampler);
  assert.equal(engine.disposeTrack('melody-2', 1), true);
  assert.equal(core.disposed, false);
  for (const sampler of removed) {
    assert.equal(sampler.disposed, true);
    assert.deepEqual(sampler.releases, [1]);
  }
  assert.equal(engine.getMelodyBank('piano', 'melody-2'), undefined);
  assert.equal(await engine.prepareMelodyTimbre('piano', 'melody-2'), true);
  const restored = engine.getMelodyBank('piano', 'melody-2').sampler;
  assert.notEqual(restored, removed[0]);
  const drums = engine.drumPlayers;
  const firstDrum = drums.values().next().value;
  engine.disposeTrack('melody', 2);
  assert.equal(core.disposed, true);
  assert.equal(restored.disposed, false);
  assert.equal(drums.values().next().value, firstDrum, 'removing core Melody must retain other core instruments');
  assert.equal(await engine.prepareMelodyTimbre('piano'), true);
  assert.notEqual(engine.getMelodyBank('piano').sampler, core);
});

test('deleting a melody track while its samples load cancels pending audition and never restores disposed banks', async () => {
  const { engine, tone } = createImportedMelodyTestEngine();
  let finish;
  tone.loaded = () => new Promise((resolve) => { finish = resolve; });
  const audition = engine.triggerMelodyInputOneShot('C4', 0, { trackId: 'melody-2', timbreId: 'piano' });
  await new Promise((resolve) => setImmediate(resolve));
  const removed = engine.getMelodyBank('piano', 'melody-2').sampler;
  engine.disposeTrack('melody-2', 1);
  finish();
  assert.equal(await audition, false);
  assert.equal(removed.disposed, true);
  assert.deepEqual(removed.attacks, []);
  assert.equal(engine.getMelodyBank('piano', 'melody-2'), undefined);
  tone.loaded = async () => {};
  assert.equal(await engine.prepareMelodyTimbre('piano', 'melody-2'), true);
  assert.notEqual(engine.getMelodyBank('piano', 'melody-2').sampler, removed);
});

test('preparing an editor timbre change readies all imported melody channels without sharing their players', async () => {
  const { engine } = createImportedMelodyTestEngine();
  await engine.prepareMelodyTimbre('piano', 'melody');
  await engine.prepareMelodyTimbre('piano', 'melody-2');
  assert.equal(await engine.prepareMelodyTimbre('blues'), true);
  const core = engine.getMelodyBank('blues');
  const second = engine.getMelodyBank('blues', 'melody-2');
  assert.equal(core.ready, true);
  assert.equal(second.ready, true);
  assert.notEqual(core.sampler, second.sampler);
});

test('deleting a melody track during audio startup cancels audition before any bank is created', async () => {
  const { engine } = createImportedMelodyTestEngine();
  let finishStart;
  engine.startAudio = () => new Promise((resolve) => { finishStart = resolve; });
  const audition = engine.triggerMelodyInputOneShot('C4', 0, { trackId: 'melody-2', timbreId: 'piano' });
  engine.disposeTrack('melody-2', 1);
  finishStart();
  assert.equal(await audition, false);
  assert.equal(engine.getMelodyBank('piano', 'melody-2'), undefined);
});

for (const trackId of ['drums', 'chord', 'bass', 'melody']) {
  test(`deleting then restoring core ${trackId} keeps playback audible without restarting the audio engine`, async () => {
    const tone = createFakeTone();
    const attacks = [];
    const nodes = [];
    function makeNode(kind) {
      const node = {
        kind,
        disposed: false,
        stoppedAt: [],
        start() { assert.equal(this.disposed, false); attacks.push(kind); },
        triggerAttack() { this.start(); },
        triggerAttackRelease() { this.start(); },
        stop(time) { this.stoppedAt.push(time); },
        releaseAll(time) { this.stop(time); },
        dispose() { this.disposed = true; },
        toDestination() { return this; },
      };
      nodes.push(node);
      return node;
    }
    const engine = new AudioEngine({
      tone,
      playerFactory: () => makeNode('drums'),
      chordSamplerFactory: () => makeNode('chord'),
      samplerFactory: (urls) => makeNode(Object.values(urls)[0].includes('/Bass/') ? 'bass' : 'melody'),
    });
    const matrix = createInitialMatrix(2);
    const cells = {
      drums: { instruments: ['kick'] },
      chord: { root: 'C', quality: 'maj', label: 'C' },
      bass: { type: 'bass', note: 'C1', duration: '16n' },
      melody: { type: 'melody', note: 'C4' },
    };
    matrix[trackId][0][0] = cells[trackId];
    matrix[`${trackId}-2`] = createInitialMatrix(2)[trackId];
    const savedTrack = matrix[trackId];
    let trackOrder = [trackId, `${trackId}-2`];
    const options = { matrixSource: () => ({ matrix, trackOrder }), totalBars: 2, bar: 0, step: 0 };
    await engine.play(options);
    tone.Transport.scheduledCallback(0);
    assert.deepEqual(attacks, [trackId]);
    await engine.stop(1);

    delete matrix[trackId];
    trackOrder = [`${trackId}-2`];
    const activeNodes = nodes.filter((node) => node.kind === trackId);
    engine.disposeTrack(trackId, 2);
    assert.equal(engine.status, AUDIO_STATUSES.READY);
    for (const node of activeNodes) assert.ok(node.stoppedAt.includes(2));
    if (['drums', 'chord'].includes(trackId)) {
      assert.ok(activeNodes.every((node) => !node.disposed), 'core startup instruments remain cached for undo');
    }
    await engine.play(options);
    tone.Transport.scheduledCallback(3);
    assert.deepEqual(attacks, [trackId], 'removed core track must stay silent');
    await engine.stop(4);

    matrix[trackId] = savedTrack;
    trackOrder = [trackId, `${trackId}-2`];
    await engine.play(options);
    tone.Transport.scheduledCallback(5);
    assert.deepEqual(attacks, [trackId, trackId], 'restored core track must play again');
    assert.equal(tone.calls.filter(([name]) => name === 'tone.start').length, 1);
    await engine.stop(6);
  });
}

test('duplicate-track melody template previews preserve core playback and follow current mixer settings', async () => {
  const timers = createManualTimers();
  const { engine, mix, tone } = createImportedMelodyTestEngine({
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  mix.mutedTracks['melody-2'] = false;
  const matrix = createInitialMatrix(2);
  matrix.melody[0][0] = { type: 'melody', note: 'C4', timbreId: 'piano', durationSteps: 16 };
  await engine.play({ matrixSource: () => ({ matrix, trackOrder: ['melody'] }), totalBars: 2, bar: 0, step: 0 });
  tone.Transport.scheduledCallback(0);
  const core = engine.getMelodyBank('piano').sampler;
  assert.equal(await engine.previewMelodySequence(['E4', 'F4', 'G4', 'A4', 'B4'], {
    trackId: 'melody-2', timbreId: 'piano', intervalSeconds: .2,
  }), true);
  const second = engine.getMelodyBank('piano', 'melody-2').sampler;
  timers.runThrough(0);
  assert.notEqual(core, second);
  assert.equal(core.volume.value, -6);
  assert.equal(second.volume.value, -18);
  assert.deepEqual([...core.activeNotes], ['C4']);

  mix.volumes['melody-2'] = -24;
  engine.refreshTrackVolume('melody-2');
  timers.runThrough(200);
  assert.equal(second.volume.value, -Infinity, 'later preview notes must stay silent at the minimum slider value');
  mix.mutedTracks['melody-2'] = true;
  engine.refreshTrackVolume('melody-2');
  timers.runThrough(400);
  assert.equal(second.volume.value, -Infinity, 'later preview notes must not override mute');
  assert.equal(core.volume.value, -6);
  assert.deepEqual(core.releases, []);

  const preview = engine.melodyPreviewSession;
  engine.disposeTrack('melody', 1);
  assert.equal(engine.melodyPreviewSession, preview, 'deleting another track must preserve this preview');
  timers.runThrough(601);
  assert.equal(second.attacks.at(-1).note, 'A4');
  engine.disposeTrack('melody-2', 2);
  assert.equal(engine.melodyPreviewSession, null);
  timers.runThrough(1000);
  assert.equal(second.attacks.length, 4, 'deleting the preview track must cancel its remaining notes');
  assert.equal(second.disposed, true);
  await engine.stop();
});


test('arranger grows from two to eight bars on the same clock and retains instance metadata', async (t) => {
  const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
  reset();
  t.after(reset);
  useMusicStore.setState({ totalBars: 2, matrix: createInitialMatrix(2) });
  const trackId = useMusicStore.getState().addTrackInstance('drums');
  const tone = createFakeTone();
  const engine = new AudioEngine({ tone, playerFactory: createPlayerFactory(tone.calls) });
  const hits = [];
  engine.triggerDrumsInstrument = (instrument, time, volume, id) => hits.push({ instrument, time, id });
  await dispatchCommand({ type: 'transport.togglePlay' }, { store: useMusicStore, audio: engine });
  const tick = tone.Transport.scheduledCallback;
  const firstSnapshot = engine.playbackSource();
  for (let i = 0; i < 35; i++) tick(i);
  assert.equal(engine.currentBar, 0);
  assert.equal(engine.currentStep, 2);
  assert.equal(engine.playbackSource(), firstSnapshot, 'playhead updates do not rebuild snapshots');
  useMusicStore.getState().createClip(trackId, 7);
  useMusicStore.getState().setCell(trackId, 7, 15, { instruments: ['snare'] });
  for (let i = 35; i <= 128; i++) tick(i);
  assert.equal(engine.playbackTotalBars, 8);
  assert.deepEqual(hits, [{ instrument: 'snare', time: 127, id: trackId }]);
  assert.equal(engine.currentBar, 0);
  assert.equal(engine.currentStep, 0);
  assert.equal(tone.calls.filter(([method]) => method === 'transport.start').length, 1);
  assert.equal(tone.calls.filter(([method]) => method === 'transport.scheduleRepeat').length, 1);
  await engine.stop();
});


test('minimum slider level silences all four track types immediately without changing independent mute state', async () => {
  for (const type of ['drums', 'chord', 'bass', 'melody']) {
    const tone = createFakeTone();
    const duplicate = `${type}-2`;
    const mix = { volumes: { [type]: 0, [duplicate]: -6 }, mutedTracks: {} };
    const attacks = [];
    const factory = () => ({
      volume: { value: 0 },
      start() { attacks.push(this.volume.value); },
      triggerAttack() { this.start(); },
      triggerAttackRelease() { this.start(); },
      releaseAll() {},
      stop() {},
      toDestination() { return this; },
    });
    const engine = new AudioEngine({
      tone, volumeSource: () => mix,
      playerFactory: factory, chordSamplerFactory: factory,
      chordSynthFactory: factory, samplerFactory: factory,
    });
    const matrix = createInitialMatrix(2);
    matrix[duplicate] = createInitialMatrix(2)[type];
    const cells = {
      drums: { instruments: ['kick'] }, chord: { type: 'notes', notes: ['C4', 'E4', 'G4'] },
      bass: { type: 'bass', note: 'C1' }, melody: { type: 'melody', note: 'C4' },
    };
    for (const id of [type, duplicate]) {
      matrix[id][0][0] = cells[type];
      matrix[id][0][1] = cells[type];
    }
    await engine.play({ matrixSource: () => ({ matrix, trackOrder: [type, duplicate] }), totalBars: 2 });
    tone.Transport.scheduledCallback(0);
    assert.deepEqual(attacks, [0, -6]);
    mix.volumes[type] = -24;
    assert.equal(engine.refreshTrackVolume(type), -Infinity);
    const nodeKeys = {
      drums: ['fallbackSynth'], chord: ['chordSampler', 'chordSynth'],
      bass: ['bassSampler'], melody: ['melodySampler', 'melodyInputSampler', 'melodyOneShotSampler'],
    };
    const nodes = engine.getInstanceAudioNodes(type, type, { create: false });
    const activeNodes = nodeKeys[type].map(key => nodes[key]).filter(Boolean);
    if (type === 'drums') activeNodes.push(...nodes.drumPlayers.values());
    assert.ok(activeNodes.length > 0);
    assert.ok(activeNodes.every(node => node.volume.value === -Infinity), type);
    tone.Transport.scheduledCallback(.125);
    assert.deepEqual(attacks.slice(-2), [-Infinity, -6], type);
    mix.volumes[type] = -23;
    assert.equal(engine.refreshTrackVolume(type), -23);
    assert.ok(activeNodes.every(node => node.volume.value === -23));
    mix.mutedTracks[type] = true;
    mix.volumes[type] = 0;
    assert.equal(engine.refreshTrackVolume(type), -Infinity);
    mix.mutedTracks[type] = false;
    assert.equal(engine.refreshTrackVolume(type), 0);
    assert.equal(engine.getTrackVolume(duplicate), -6);
    assert.equal(mix.volumes[duplicate], -6);
    await engine.stop();
  }
});

test('audio startup and melody sample loading use the latest slider value before auditioning', async () => {
  const tone = createFakeTone();
  let finishStart;
  const startGate = new Promise(resolve => { finishStart = resolve; });
  tone.start = () => startGate;
  const volumes = { drums: 0, chord: 0, bass: 0, melody: 0 };
  const engine = new AudioEngine({
    tone, volumeSource: () => volumes,
    playerFactory: createVolumeAwarePlayerFactory(tone.calls),
    chordSamplerFactory: createVolumeAwareChordSamplerFactory(tone.calls),
    samplerFactory: createVolumeAwareSamplerFactory(tone.calls),
  });
  const pending = Promise.all([
    engine.triggerDrumsStep('kick'), engine.previewChordSequence([['C4']]),
    engine.triggerBassNote('C1'), engine.triggerMelodyInputNote('C4'),
  ]);
  await new Promise(resolve => setImmediate(resolve));
  for (const type of Object.keys(volumes)) volumes[type] = -24;
  finishStart();
  await pending;
  const calls = tone.calls.filter(([name]) => ['player.start', 'chordSampler.triggerAttackRelease', 'sampler.triggerAttackRelease', 'sampler.triggerAttack'].includes(name));
  assert.equal(calls.length, 4);
  for (const call of calls) assert.equal(call[call[0] === 'sampler.triggerAttack' ? 3 : 4], -Infinity);

  for (const timbreId of ['piano', 'blues', 'yangqin']) {
    const melodyTone = createFakeTone();
    const timers = createManualTimers();
    const mix = { melody: 0 };
    const melody = new AudioEngine({
      tone: melodyTone, volumeSource: () => mix,
      playerFactory: createPlayerFactory(melodyTone.calls),
      samplerFactory: createVolumeAwareSamplerFactory(melodyTone.calls),
      scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
    });
    let finishSamples;
    melodyTone.loaded = () => new Promise(resolve => { finishSamples = resolve; });
    const audition = melody.previewMelodySequence(['C4', 'D4', 'E4', 'F4'], { timbreId, intervalSeconds: .2 });
    await new Promise(resolve => setImmediate(resolve));
    mix.melody = -24;
    melody.refreshTrackVolume('melody');
    finishSamples();
    await audition;
    timers.runThrough(0);
    const sampler = melody.melodyPreviewBanks.get(timbreId).sampler;
    assert.equal(sampler.volume.value, -Infinity);
    mix.melody = -6;
    melody.refreshTrackVolume('melody');
    timers.runThrough(200);
    assert.ok(Number.isFinite(sampler.volume.value), 'raising the slider restores the current timbre');
    mix.melody = -24;
    melody.refreshTrackVolume('melody');
    assert.equal(sampler.volume.value, -Infinity, 'a sounding preview silences immediately');
    timers.runThrough(400);
    assert.equal(sampler.volume.value, -Infinity, 'later preview notes read the latest slider value');
    await melody.stop();
    timers.runThrough(1000);
    assert.equal(melodyTone.calls.filter(([name]) => name === 'sampler.triggerAttack').length, 3);
  }
  await engine.stop();
});
