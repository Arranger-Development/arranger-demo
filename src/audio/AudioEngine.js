import {
  DEFAULT_BPM,
  DRUMS_INSTRUMENT_IDS,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';
import { getTrackTypeFromInstanceId } from '../domain/trackInstances.js';
import { clampTrackVolume } from '../domain/trackVolume.js';
import {
  getMelodyTimbre,
  normalizeMelodyTimbreId,
} from '../data/melodyTimbres.js';
import { AUDIO_STATUSES } from './audioStatus.js';
import { createMatrixPlaybackAdapter } from './matrixPlaybackAdapter.js';

const DRUMS_SAMPLE_FILES = Object.freeze({
  kick: 'samples/Drums/Kick_v0.22.wav',
  snare: 'samples/Drums/Snare_v0.22.wav',
  hihat: 'samples/Drums/Hihat_v0.22.wav',
});
const SAMPLE_ASSET_VERSION = 'sample-refresh-20260608';
const CHORD_SAMPLE_DURATION = '2s';
const MAX_LIVE_INPUT_LATENCY_SECONDS = 0.25;
const LAUNCHPAD_LIVE_INPUT_BIAS_SECONDS = 0.012;

function createRootOctaveSampleFiles({ directory, prefix, roots, octaves, sampleVersion = 'v0.22' }) {
  return Object.freeze(Object.fromEntries(
    octaves.flatMap((octave) => roots.map((root) => {
      const note = `${root}${octave}`;
      return [note, `samples/${directory}/${prefix}_${note}_${sampleVersion}.wav`];
    })),
  ));
}

const NATURAL_SAMPLE_ROOTS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

const CHORD_SAMPLE_FILES = createRootOctaveSampleFiles({
  directory: 'Chords',
  prefix: 'Chord',
  roots: NATURAL_SAMPLE_ROOTS,
  octaves: [2, 3, 4],
  sampleVersion: 'v0.3',
});

const BASS_SAMPLE_FILES = Object.freeze({
  A0: 'samples/Bass/Bass_A0_v0.22.wav',
  B0: 'samples/Bass/Bass_B0_v0.22.wav',
  C1: 'samples/Bass/Bass_C1_v0.22.wav',
  D1: 'samples/Bass/Bass_D1_v0.22.wav',
  E1: 'samples/Bass/Bass_E1_v0.22.wav',
  F0: 'samples/Bass/Bass_F0_v0.22.wav',
  G0: 'samples/Bass/Bass_G0_v0.22.wav',
});

const DRUM_FALLBACK_NOTES = Object.freeze({
  kick: 'C1',
  snare: 'D1',
  hihat: 'F#1',
});

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function appendSampleAssetVersion(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${SAMPLE_ASSET_VERSION}`;
}

function createSampleUrl(normalizedBaseUrl, file) {
  return appendSampleAssetVersion(`${normalizedBaseUrl}/${file}`);
}

function createDrumsSampleUrls(baseUrl = '/') {
  const normalizedBaseUrl = baseUrl === '/' ? '' : trimTrailingSlash(baseUrl);

  return Object.fromEntries(
    DRUMS_INSTRUMENT_IDS.map((instrument) => [
      instrument,
      createSampleUrl(normalizedBaseUrl, DRUMS_SAMPLE_FILES[instrument]),
    ]),
  );
}

function createMelodySampleUrls(baseUrl = '/', timbreId = 'piano') {
  const normalizedBaseUrl = baseUrl === '/' ? '' : trimTrailingSlash(baseUrl);
  const sampleFiles = getMelodyTimbre(timbreId).sampleFiles;

  return Object.fromEntries(
    Object.entries(sampleFiles).map(([note, file]) => [
      note,
      createSampleUrl(normalizedBaseUrl, file),
    ]),
  );
}

function createBassSampleUrls(baseUrl = '/') {
  const normalizedBaseUrl = baseUrl === '/' ? '' : trimTrailingSlash(baseUrl);

  return Object.fromEntries(
    Object.entries(BASS_SAMPLE_FILES).map(([note, file]) => [
      note,
      createSampleUrl(normalizedBaseUrl, file),
    ]),
  );
}

function createChordSampleUrls(baseUrl = '/') {
  const normalizedBaseUrl = baseUrl === '/' ? '' : trimTrailingSlash(baseUrl);

  return Object.fromEntries(
    Object.entries(CHORD_SAMPLE_FILES).map(([note, file]) => [
      note,
      createSampleUrl(normalizedBaseUrl, file),
    ]),
  );
}

function getDefaultBaseUrl() {
  return import.meta.env?.BASE_URL ?? '/';
}

function formatToneTransportPosition(bar, step) {
  const beat = Math.floor(step / 4);
  const sixteenth = step % 4;

  return `${bar}:${beat}:${sixteenth}`;
}

function callToDestination(player) {
  if (typeof player?.toDestination !== 'function') return player;

  const result = player.toDestination();
  return result && typeof result === 'object' ? result : player;
}

function readVolumeSource(volumeSource) {
  if (!volumeSource) return {};
  return typeof volumeSource === 'function' ? volumeSource() : volumeSource;
}

function getVolumeForTrack(volumeSource, trackId) {
  const mix = readVolumeSource(volumeSource);
  if (mix?.mutedTracks?.[trackId] === true) return -Infinity;

  const volumes = mix?.volumes ?? mix;
  return clampTrackVolume(volumes?.[trackId]);
}

function applyVolume(node, volume) {
  if (!node) return;

  if (node.volume && typeof node.volume === 'object' && 'value' in node.volume) {
    node.volume.value = volume;
    return;
  }

  node.set?.({ volume });
}

function disposeAudioNode(node, time) {
  node?.releaseAll?.(time);
  node?.dispose?.();
}

function getMelodyVolume(trackVolume, timbreId) {
  if (trackVolume === -Infinity) return -Infinity;
  return trackVolume + getMelodyTimbre(timbreId).gainDb;
}

function getVelocityAdjustedVolume(trackVolume, velocity = 1) {
  if (trackVolume === -Infinity) return -Infinity;
  const normalizedVelocity = Math.min(1, Math.max(0.2, Number(velocity) || 1));
  return trackVolume + (20 * Math.log10(normalizedVelocity));
}

function normalizeAudibleTrackIds(trackIds) {
  if (!Array.isArray(trackIds)) return null;
  return new Set(trackIds.filter((trackId) => typeof trackId === 'string' && trackId.length > 0));
}

function normalizeMaxPlaybackSteps(maxPlaybackSteps) {
  return Number.isInteger(maxPlaybackSteps) && maxPlaybackSteps > 0
    ? maxPlaybackSteps
    : null;
}

export default class AudioEngine {
  constructor(options = {}) {
    this.tone = options.tone ?? null;
    this.loadTone = options.loadTone ?? null;
    this.toneLoadPromise = null;
    this.baseUrl = options.baseUrl ?? getDefaultBaseUrl();
    this.matrixSource = options.matrixSource ?? null;
    this.volumeSource = options.volumeSource ?? null;
    this.melodyTimbreSource = options.melodyTimbreSource ?? null;
    this.onPositionChange = options.onPositionChange ?? null;
    this.onScheduledPositionChange = options.onScheduledPositionChange ?? null;
    this.onPlaybackComplete = options.onPlaybackComplete ?? null;
    this.playerFactory = options.playerFactory ?? null;
    this.samplerFactory = options.samplerFactory ?? null;
    this.melodyInputSamplerFactory = options.melodyInputSamplerFactory ?? null;
    this.melodyOneShotSamplerFactory = options.melodyOneShotSamplerFactory ?? null;
    this.chordSamplerFactory = options.chordSamplerFactory ?? null;
    this.fallbackSynthFactory = options.fallbackSynthFactory ?? null;
    this.chordSynthFactory = options.chordSynthFactory ?? null;
    this.now = options.now ?? (() => this.tone?.now?.() ?? 0);
    this.immediate = options.immediate ?? (() => (
      this.tone?.immediate?.()
      ?? this.tone?.getContext?.()?.immediate?.()
      ?? this.tone?.getContext?.()?.currentTime
      ?? this.now()
    ));
    this.performanceNow = options.performanceNow ?? (() => (
      globalThis.performance?.now?.() ?? 0
    ));
    this.scheduleTimeout = options.scheduleTimeout ?? ((callback, delay) => (
      globalThis.setTimeout(callback, delay)
    ));
    this.cancelTimeout = options.cancelTimeout ?? ((timerId) => globalThis.clearTimeout(timerId));
    this.status = AUDIO_STATUSES.IDLE;
    this.drumPlayers = new Map();
    this.fallbackSynth = null;
    this.chordSampler = null;
    this.chordSynth = null;
    this.melodySampler = null;
    this.melodyInputSampler = null;
    this.melodyOneShotSampler = null;
    this.melodySamplerTimbreId = null;
    this.melodyInputSamplerTimbreId = null;
    this.melodyOneShotSamplerTimbreId = null;
    this.melodyPreviewBanks = new Map();
    this.melodyPreviewRequestId = 0;
    this.melodyPreviewSession = null;
    this.melodyInputRequestId = 0;
    this.bassSampler = null;
    this.instanceAudioNodes = new Map();
    this.matrixAdapter = null;
    this.playbackTotalBars = TOTAL_BARS;
    this.transportEventId = null;
    this.transportFlatStep = 0;
    this.audibleTrackIds = null;
    this.maxPlaybackSteps = null;
    this.playedSteps = 0;
    this.currentBar = 0;
    this.currentStep = 0;
    this.positionNotificationGeneration = 0;
    this.transportRunning = false;
    this.playRequestId = 0;
    this.drumsPatternPreviewRequestId = 0;
    this.drumsPatternPreviewSession = null;
    this.chordClipPreviewRequestId = 0;
    this.chordClipPreviewSession = null;
  }

  get transport() {
    return this.tone?.Transport;
  }

  getToneContext() {
    return this.tone?.getContext?.() ?? this.tone?.context ?? null;
  }

  getLiveInputLatencySeconds() {
    const context = this.getToneContext();
    const rawContext = context?.rawContext ?? context;
    const latency = Number.isFinite(rawContext?.outputLatency)
      ? rawContext.outputLatency
      : rawContext?.baseLatency;

    if (!Number.isFinite(latency) || latency <= 0) return 0;
    return Math.min(latency, MAX_LIVE_INPUT_LATENCY_SECONDS);
  }

  // Fractional steps at the actual audio clock, without scheduler lookahead or
  // input quantization. Reading this never seeks or changes the transport.
  getPlaybackPosition() {
    if (!this.transportRunning) return null;
    const transport = this.getStartedTransport();
    const time = this.immediate();
    if (typeof transport?.getTicksAtTime !== 'function'
      || !Number.isFinite(transport.PPQ) || transport.PPQ <= 0
      || !Number.isFinite(time)) return null;
    const steps = transport.getTicksAtTime(time) / (transport.PPQ / 4);
    if (!Number.isFinite(steps)) return null;
    const totalSteps = this.playbackTotalBars * STEPS_PER_BAR;
    return Math.max(0, steps) % totalSteps;
  }

  getLiveInputPosition(inputTimestampMs, options = {}) {
    const transport = this.getStartedTransport();
    if (
      !this.transportRunning
      || typeof transport?.getTicksAtTime !== 'function'
      || !Number.isFinite(transport.PPQ)
      || transport.PPQ <= 0
    ) {
      return null;
    }

    const currentAudioTime = this.immediate();
    if (!Number.isFinite(currentAudioTime)) return null;

    const currentPerformanceTime = this.performanceNow();
    const eventProcessingDelaySeconds = (
      Number.isFinite(inputTimestampMs)
      && Number.isFinite(currentPerformanceTime)
      && currentPerformanceTime >= inputTimestampMs
    )
      ? Math.min(
        (currentPerformanceTime - inputTimestampMs) / 1000,
        MAX_LIVE_INPUT_LATENCY_SECONDS,
      )
      : 0;
    const compensatedTime = Math.max(
      0,
      currentAudioTime
        - eventProcessingDelaySeconds
        - this.getLiveInputLatencySeconds()
        + (options.source === 'launchpad' ? LAUNCHPAD_LIVE_INPUT_BIAS_SECONDS : 0),
    );
    const ticks = transport.getTicksAtTime(compensatedTime);
    const ticksPerStep = transport.PPQ / 4;
    if (!Number.isFinite(ticks) || !Number.isFinite(ticksPerStep) || ticksPerStep <= 0) {
      return null;
    }

    const flatStep = Math.round(ticks / ticksPerStep);
    const totalSteps = TOTAL_BARS * STEPS_PER_BAR;
    if (flatStep < 0 || flatStep >= totalSteps) return null;

    return {
      bar: Math.floor(flatStep / STEPS_PER_BAR),
      step: flatStep % STEPS_PER_BAR,
    };
  }

  async ensureTone() {
    if (this.tone) return this.tone;
    if (!this.loadTone) return null;

    if (!this.toneLoadPromise) {
      this.toneLoadPromise = this.loadTone()
        .then((tone) => {
          this.tone = tone?.default ?? tone;
          return this.tone;
        })
        .catch((error) => {
          this.toneLoadPromise = null;
          throw error;
        });
    }

    return this.toneLoadPromise;
  }

  getSampleUrls() {
    return createDrumsSampleUrls(this.baseUrl);
  }

  getMelodySampleUrls(timbreId = this.getMelodyTimbreId()) {
    return createMelodySampleUrls(this.baseUrl, timbreId);
  }

  getBassSampleUrls() {
    return createBassSampleUrls(this.baseUrl);
  }

  getChordSampleUrls() {
    return createChordSampleUrls(this.baseUrl);
  }

  getTrackVolume(trackId) {
    return getVolumeForTrack(this.volumeSource, trackId);
  }

  getMelodyTimbreId(timbreId) {
    if (timbreId) return normalizeMelodyTimbreId(timbreId);
    const sourceValue = typeof this.melodyTimbreSource === 'function'
      ? this.melodyTimbreSource()
      : this.melodyTimbreSource;
    return normalizeMelodyTimbreId(sourceValue);
  }

  getMelodyTrackVolume(trackId, timbreId) {
    return getMelodyVolume(this.getTrackVolume(trackId), this.getMelodyTimbreId(timbreId));
  }

  refreshTrackVolume(trackId) {
    const trackType = getTrackTypeFromInstanceId(trackId);
    if (!trackType) return null;
    const volume = this.getTrackVolume(trackId);
    const nodes = this.getInstanceAudioNodes(trackId, trackType, { create: false });
    if (trackType === 'drums') {
      nodes?.drumPlayers?.forEach((player) => applyVolume(player, volume));
      applyVolume(nodes?.fallbackSynth, volume);
    }
    if (trackType === 'chord') {
      applyVolume(nodes?.chordSampler, volume);
      applyVolume(nodes?.chordSynth, volume);
    }
    if (trackType === 'bass') applyVolume(nodes?.bassSampler, volume);
    if (trackType === 'melody') {
      const timbreId = this.getMelodyTimbreId(nodes?.melodyTimbreId);
      const melodyVolume = getMelodyVolume(volume, timbreId);
      applyVolume(nodes?.melodySampler, melodyVolume);
      applyVolume(nodes?.melodyInputSampler, melodyVolume);
      applyVolume(nodes?.melodyOneShotSampler, melodyVolume);
      if (volume === -Infinity) this.stopMelodyVoices(this.now(), trackId);
    }
    return volume;
  }

  getInstanceAudioNodes(trackId, trackType = getTrackTypeFromInstanceId(trackId), options = {}) {
    const { create = true } = options;
    if (!trackType) return null;
    if (trackId === trackType) {
      return {
        bassSampler: this.bassSampler,
        chordSampler: this.chordSampler,
        chordSynth: this.chordSynth,
        drumPlayers: this.drumPlayers,
        fallbackSynth: this.fallbackSynth,
        melodyInputSampler: this.melodyInputSampler,
        melodyOneShotSampler: this.melodyOneShotSampler,
        melodySampler: this.melodySampler,
        melodyTimbreId: this.getMelodyTimbreId(),
      };
    }

    let nodes = this.instanceAudioNodes.get(trackId);
    if (!nodes && create) {
      nodes = {
        bassSampler: null,
        chordSampler: null,
        chordSynth: null,
        drumPlayers: new Map(),
        fallbackSynth: null,
        melodyInputSampler: null,
        melodyOneShotSampler: null,
        melodySampler: null,
        melodyTimbreId: null,
      };
      this.instanceAudioNodes.set(trackId, nodes);
    }
    return nodes ?? null;
  }

  ensureInstanceAudioNodes(trackId, trackType = getTrackTypeFromInstanceId(trackId)) {
    const nodes = this.getInstanceAudioNodes(trackId, trackType);
    if (!nodes || trackId === trackType) return nodes;

    if (trackType === 'drums') {
      nodes.fallbackSynth = nodes.fallbackSynth ?? this.createFallbackSynth();
      const sampleUrls = this.getSampleUrls();
      for (const instrument of DRUMS_INSTRUMENT_IDS) {
        if (nodes.drumPlayers.has(instrument)) continue;
        const player = callToDestination(this.createPlayer(sampleUrls[instrument], instrument));
        nodes.drumPlayers.set(instrument, player);
      }
    }
    if (trackType === 'chord') {
      nodes.chordSampler = nodes.chordSampler ?? this.createChordSampler();
      nodes.chordSynth = nodes.chordSynth ?? this.createChordSynth();
    }
    if (trackType === 'bass') {
      nodes.bassSampler = nodes.bassSampler ?? this.createBassSampler();
    }
    if (trackType === 'melody') {
      const timbreId = this.getMelodyTimbreId();
      if (nodes.melodyTimbreId !== timbreId) {
        const time = this.now();
        disposeAudioNode(nodes.melodySampler, time);
        disposeAudioNode(nodes.melodyInputSampler, time);
        disposeAudioNode(nodes.melodyOneShotSampler, time);
        nodes.melodySampler = this.createMelodySampler(timbreId);
        nodes.melodyInputSampler = this.createMelodyInputSampler(timbreId);
        nodes.melodyOneShotSampler = this.createMelodyOneShotSampler(timbreId);
        nodes.melodyTimbreId = timbreId;
      }
    }
    return nodes;
  }

  createPlayer(url, instrument) {
    if (this.playerFactory) return this.playerFactory(url, instrument);
    if (!this.tone?.Player) {
      throw new Error('Tone Player is unavailable');
    }

    return new this.tone.Player(url);
  }

  createFallbackSynth() {
    if (this.fallbackSynthFactory) return this.fallbackSynthFactory();
    if (!this.tone?.MembraneSynth) return null;

    return callToDestination(new this.tone.MembraneSynth());
  }

  createChordSynth() {
    if (this.chordSynthFactory) return callToDestination(this.chordSynthFactory());
    if (!this.tone?.PolySynth) return null;

    const synth = this.tone?.Synth
      ? new this.tone.PolySynth(this.tone.Synth)
      : new this.tone.PolySynth();

    return callToDestination(synth);
  }

  createMelodySampler(timbreId = this.getMelodyTimbreId()) {
    const urls = this.getMelodySampleUrls(timbreId);
    if (this.samplerFactory) return callToDestination(this.samplerFactory(urls));
    if (!this.tone?.Sampler) return null;

    return callToDestination(new this.tone.Sampler({ urls }));
  }

  createMelodyInputSampler(timbreId = this.getMelodyTimbreId()) {
    const urls = this.getMelodySampleUrls(timbreId);
    const factory = this.melodyInputSamplerFactory ?? this.samplerFactory;
    if (factory) return callToDestination(factory(urls));
    if (!this.tone?.Sampler) return null;

    return callToDestination(new this.tone.Sampler({ urls }));
  }

  createMelodyOneShotSampler(timbreId = this.getMelodyTimbreId()) {
    const urls = this.getMelodySampleUrls(timbreId);
    const factory = this.melodyOneShotSamplerFactory ?? this.samplerFactory;
    if (factory) return callToDestination(factory(urls));
    if (!this.tone?.Sampler) return null;

    return callToDestination(new this.tone.Sampler({ urls }));
  }

  createMelodyPreviewSampler(timbreId = this.getMelodyTimbreId()) {
    return this.createMelodyInputSampler(timbreId);
  }

  ensureGlobalMelodySampler(kind, timbreId = this.getMelodyTimbreId()) {
    const normalizedTimbreId = this.getMelodyTimbreId(timbreId);
    const fieldByKind = {
      input: ['melodyInputSampler', 'melodyInputSamplerTimbreId', 'createMelodyInputSampler'],
      oneShot: ['melodyOneShotSampler', 'melodyOneShotSamplerTimbreId', 'createMelodyOneShotSampler'],
      playback: ['melodySampler', 'melodySamplerTimbreId', 'createMelodySampler'],
    };
    const fields = fieldByKind[kind];
    if (!fields) return null;
    const [samplerField, timbreField, createMethod] = fields;
    if (this[samplerField] && this[timbreField] === normalizedTimbreId) {
      return this[samplerField];
    }

    disposeAudioNode(this[samplerField], this.now());
    this[samplerField] = this[createMethod](normalizedTimbreId);
    this[timbreField] = this[samplerField] ? normalizedTimbreId : null;
    return this[samplerField];
  }

  async prepareMelodyTimbre(timbreId) {
    const normalizedTimbreId = this.getMelodyTimbreId(timbreId);
    await this.startAudio();

    const cached = this.melodyPreviewBanks.get(normalizedTimbreId);
    if (cached?.ready) return true;
    if (cached?.promise) return cached.promise;

    let sampler = null;
    try {
      sampler = this.createMelodyPreviewSampler(normalizedTimbreId);
      if (!sampler) return false;
    } catch {
      return false;
    }

    const entry = {
      promise: null,
      ready: false,
      sampler,
    };
    entry.promise = Promise.resolve(this.tone?.loaded?.())
      .then(() => {
        entry.ready = true;
        entry.promise = null;
        return true;
      })
      .catch(() => {
        disposeAudioNode(entry.sampler, this.now());
        this.melodyPreviewBanks.delete(normalizedTimbreId);
        return false;
      });
    this.melodyPreviewBanks.set(normalizedTimbreId, entry);
    return entry.promise;
  }

  activateMelodyTimbre(timbreId) {
    const normalizedTimbreId = this.getMelodyTimbreId(timbreId);
    this.stopMelodyVoices(this.now());
    this.ensureGlobalMelodySampler('playback', normalizedTimbreId);
    this.ensureGlobalMelodySampler('input', normalizedTimbreId);
    this.ensureGlobalMelodySampler('oneShot', normalizedTimbreId);

    this.instanceAudioNodes.forEach((nodes) => {
      if (!nodes.melodyTimbreId) return;
      disposeAudioNode(nodes.melodySampler, this.now());
      disposeAudioNode(nodes.melodyInputSampler, this.now());
      disposeAudioNode(nodes.melodyOneShotSampler, this.now());
      nodes.melodySampler = this.createMelodySampler(normalizedTimbreId);
      nodes.melodyInputSampler = this.createMelodyInputSampler(normalizedTimbreId);
      nodes.melodyOneShotSampler = this.createMelodyOneShotSampler(normalizedTimbreId);
      nodes.melodyTimbreId = normalizedTimbreId;
    });
    return true;
  }

  createChordSampler() {
    const urls = this.getChordSampleUrls();
    if (this.chordSamplerFactory) return callToDestination(this.chordSamplerFactory(urls));
    if (!this.tone?.Sampler) return null;

    return callToDestination(new this.tone.Sampler({ urls }));
  }

  createBassSampler() {
    const urls = this.getBassSampleUrls();
    if (this.samplerFactory) return callToDestination(this.samplerFactory(urls));
    if (!this.tone?.Sampler) return null;

    return callToDestination(new this.tone.Sampler({ urls }));
  }

  async startAudio() {
    if (
      this.status === AUDIO_STATUSES.READY
      || this.status === AUDIO_STATUSES.SAMPLE_FALLBACK
    ) {
      return this.status;
    }

    this.status = AUDIO_STATUSES.STARTING;

    try {
      await this.ensureTone();
      await this.tone?.start?.();
      this.fallbackSynth = this.fallbackSynth ?? this.createFallbackSynth();
      this.chordSampler = this.chordSampler ?? this.createChordSampler();
      this.chordSynth = this.chordSynth ?? this.createChordSynth();
      this.ensureGlobalMelodySampler('playback');
      this.loadDrumsPlayers();
      this.status = AUDIO_STATUSES.READY;
    } catch {
      this.drumPlayers.clear();
      this.fallbackSynth = this.createFallbackSynth();
      this.chordSampler = this.chordSampler ?? this.createChordSampler();
      this.chordSynth = this.chordSynth ?? this.createChordSynth();
      this.ensureGlobalMelodySampler('playback');
      this.status = this.fallbackSynth
        ? AUDIO_STATUSES.SAMPLE_FALLBACK
        : AUDIO_STATUSES.ERROR;
    }

    return this.status;
  }

  async prepareMatrixPlaybackSamples() {
    try {
      this.bassSampler = this.bassSampler ?? this.createBassSampler();
      this.ensureGlobalMelodySampler('oneShot');
      if (typeof this.tone?.loaded === 'function') {
        await this.tone.loaded();
      }
      return true;
    } catch {
      return false;
    }
  }

  loadDrumsPlayers() {
    const sampleUrls = this.getSampleUrls();

    for (const instrument of DRUMS_INSTRUMENT_IDS) {
      if (this.drumPlayers.has(instrument)) continue;

      const player = callToDestination(this.createPlayer(sampleUrls[instrument], instrument));
      this.drumPlayers.set(instrument, player);
    }
  }

  triggerDrumsInstrument(
    instrument,
    time = this.now(),
    volume = this.getTrackVolume('drums'),
    trackId = 'drums',
  ) {
    if (!DRUMS_INSTRUMENT_IDS.includes(instrument)) return false;

    const nodes = trackId === 'drums'
      ? { drumPlayers: this.drumPlayers, fallbackSynth: this.fallbackSynth }
      : this.ensureInstanceAudioNodes(trackId, 'drums');
    const player = nodes?.drumPlayers?.get(instrument);
    if (player?.start) {
      try {
        applyVolume(player, volume);
        player.start(time);
        return true;
      } catch {
        // Tone.Player can exist before its buffer is ready; keep first-click preview audible.
      }
    }

    if (nodes?.fallbackSynth?.triggerAttackRelease) {
      try {
        applyVolume(nodes.fallbackSynth, volume);
        nodes.fallbackSynth.triggerAttackRelease(DRUM_FALLBACK_NOTES[instrument], '16n', time);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  async triggerDrumsStep(instruments, time, options = {}) {
    await this.startAudio();

    const trackId = options.trackId ?? 'drums';
    const triggerTime = time ?? (options.immediate ? this.immediate() : this.now());
    const instrumentList = Array.isArray(instruments) ? instruments : [instruments];
    const volume = this.getTrackVolume(trackId);
    return instrumentList
      .filter((instrument) => (
        this.triggerDrumsInstrument(instrument, triggerTime, volume, trackId)
      ));
  }

  stopDrumsPatternPreview() {
    this.drumsPatternPreviewRequestId += 1;
    const session = this.drumsPatternPreviewSession;
    if (!session) return false;

    session.timerIds.forEach((timerId) => this.cancelTimeout(timerId));
    this.drumsPatternPreviewSession = null;
    session.resolve('stopped');
    return true;
  }

  async previewDrumsPattern(events, options = {}) {
    const {
      bpm = DEFAULT_BPM,
      totalSteps = STEPS_PER_BAR,
      trackId = 'drums',
    } = options;
    const normalizedTotalSteps = Number.isInteger(totalSteps) && totalSteps > 0
      ? totalSteps
      : STEPS_PER_BAR;
    const normalizedHits = Array.isArray(events)
      ? events.flatMap((event) => {
        const instruments = Array.isArray(event?.instruments)
          ? [...new Set(event.instruments)].filter((instrument) => (
            DRUMS_INSTRUMENT_IDS.includes(instrument)
          ))
          : [];
        if (
          !Number.isInteger(event?.step)
          || event.step < 0
          || event.step >= normalizedTotalSteps
          || !instruments.length
        ) return [];
        return instruments.map((instrument) => ({
          instrument,
          step: event.step,
          timingOffset: Math.min(0.45, Math.max(
            -0.25,
            Number(event?.timingOffsets?.[instrument]) || 0,
          )),
          velocity: Math.min(1, Math.max(
            0.2,
            Number(event?.velocities?.[instrument]) || 1,
          )),
        }));
      }).sort((left, right) => (
        (left.step + left.timingOffset) - (right.step + right.timingOffset)
      ))
      : [];

    this.stopDrumsPatternPreview();
    if (!normalizedHits.length) return 'empty';

    const requestId = ++this.drumsPatternPreviewRequestId;
    await this.startAudio();
    if (requestId !== this.drumsPatternPreviewRequestId) return 'stopped';

    const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const millisecondsPerSixteenth = (60 / normalizedBpm / 4) * 1000;
    return new Promise((resolve) => {
      const session = {
        requestId,
        resolve,
        timerIds: new Set(),
      };
      this.drumsPatternPreviewSession = session;

      const finish = (result) => {
        if (this.drumsPatternPreviewSession !== session) return;
        session.timerIds.forEach((timerId) => this.cancelTimeout(timerId));
        this.drumsPatternPreviewSession = null;
        resolve(result);
      };

      normalizedHits.forEach((hit) => {
        const timerId = this.scheduleTimeout(() => {
          session.timerIds.delete(timerId);
          if (this.drumsPatternPreviewSession !== session) return;
          const volume = getVelocityAdjustedVolume(this.getTrackVolume(trackId), hit.velocity);
          this.triggerDrumsInstrument(hit.instrument, this.now(), volume, trackId);
        }, (hit.step + hit.timingOffset) * millisecondsPerSixteenth);
        session.timerIds.add(timerId);
      });

      const completionTimerId = this.scheduleTimeout(() => {
        session.timerIds.delete(completionTimerId);
        finish('completed');
      }, normalizedTotalSteps * millisecondsPerSixteenth);
      session.timerIds.add(completionTimerId);
    });
  }

  triggerChordNotes(
    notes,
    duration = '4n',
    time = this.now(),
    volume = this.getTrackVolume('chord'),
    trackId = 'chord',
  ) {
    if (!Array.isArray(notes) || !notes.length) return false;

    const nodes = trackId === 'chord'
      ? { chordSampler: this.chordSampler, chordSynth: this.chordSynth }
      : this.ensureInstanceAudioNodes(trackId, 'chord');
    if (nodes?.chordSampler?.triggerAttackRelease) {
      try {
        applyVolume(nodes.chordSampler, volume);
        nodes.chordSampler.triggerAttackRelease(notes, CHORD_SAMPLE_DURATION, time);
        return true;
      } catch {
        // Fall through to synth so a missing or not-yet-loaded chord sample stays audible.
      }
    }

    if (!nodes?.chordSynth?.triggerAttackRelease) return false;
    try {
      applyVolume(nodes.chordSynth, volume);
      nodes.chordSynth.triggerAttackRelease(notes, duration, time);
      return true;
    } catch {
      return false;
    }
  }

  async triggerChord(notes, duration = '4n', time = this.now()) {
    await this.startAudio();
    return this.triggerChordNotes(notes, duration, time);
  }

  triggerMelodySampler(
    note,
    duration = '16n',
    time = this.now(),
    volume = this.getMelodyTrackVolume('melody'),
  ) {
    void duration;
    return this.triggerMelodyOneShot(note, time, volume);
  }

  triggerMelodyOneShot(
    note,
    time = this.now(),
    volume = this.getMelodyTrackVolume('melody'),
    trackId = 'melody',
  ) {
    const nodes = trackId === 'melody'
      ? null
      : this.ensureInstanceAudioNodes(trackId, 'melody');
    if (trackId === 'melody') {
      this.ensureGlobalMelodySampler('oneShot');
    }
    const sampler = trackId === 'melody'
      ? this.melodyOneShotSampler
      : nodes?.melodyOneShotSampler;
    if (!sampler?.triggerAttack) return false;

    try {
      applyVolume(sampler, volume);
      sampler.triggerAttack(note, time);
      return true;
    } catch {
      return false;
    }
  }

  async triggerMelodyNote(note, duration = '16n', time) {
    await this.startAudio();
    void duration;
    return this.triggerMelodyOneShot(note, time ?? this.now());
  }

  triggerMelodyInputSampler(
    note,
    duration = '16n',
    time = this.now(),
    volume = this.getMelodyTrackVolume('melody'),
  ) {
    void duration;
    return this.triggerMelodyInputOneShotSampler(note, time, volume);
  }

  triggerMelodyInputOneShotSampler(
    note,
    time = this.now(),
    volume = this.getMelodyTrackVolume('melody'),
  ) {
    this.ensureGlobalMelodySampler('input');
    if (!this.melodyInputSampler?.triggerAttack) return false;

    try {
      applyVolume(this.melodyInputSampler, volume);
      this.melodyInputSampler.triggerAttack(note, time);
      return true;
    } catch {
      return false;
    }
  }

  async triggerMelodyInputNote(note, duration = '16n', time) {
    const requestId = this.melodyInputRequestId;
    await this.startAudio();
    if (requestId !== this.melodyInputRequestId) return false;
    void duration;
    return this.triggerMelodyInputSampler(note, duration, time ?? this.now());
  }

  async triggerMelodyInputOneShot(note, time, options = {}) {
    const requestId = this.melodyInputRequestId;
    await this.startAudio();
    if (requestId !== this.melodyInputRequestId) return false;
    const trackId = options.trackId ?? 'melody';
    if (trackId === 'melody') {
      return this.triggerMelodyInputOneShotSampler(note, time ?? this.now());
    }
    const nodes = this.ensureInstanceAudioNodes(trackId, 'melody');
    const sampler = nodes?.melodyInputSampler;
    if (!sampler?.triggerAttack) return false;
    try {
      applyVolume(sampler, this.getMelodyTrackVolume(trackId));
      sampler.triggerAttack(note, time ?? this.now());
      return true;
    } catch {
      return false;
    }
  }

  releaseMelodyInputNote() {
    return false;
  }

  releaseAllMelodyInputNotes(time = this.now()) {
    this.melodyInputRequestId += 1;
    this.melodyInputSampler?.releaseAll?.(time);
  }

  stopMelodyVoices(time = this.now(), trackId = null) {
    if (!trackId || trackId === 'melody') {
      this.melodySampler?.releaseAll?.(time);
      this.releaseAllMelodyInputNotes(time);
      this.melodyOneShotSampler?.releaseAll?.(time);
    }
    if (trackId && trackId !== 'melody') {
      const nodes = this.getInstanceAudioNodes(trackId, 'melody', { create: false });
      nodes?.melodySampler?.releaseAll?.(time);
      nodes?.melodyInputSampler?.releaseAll?.(time);
      nodes?.melodyOneShotSampler?.releaseAll?.(time);
      return;
    }
    this.instanceAudioNodes.forEach((nodes) => {
      nodes.melodySampler?.releaseAll?.(time);
      nodes.melodyInputSampler?.releaseAll?.(time);
      nodes.melodyOneShotSampler?.releaseAll?.(time);
    });
  }

  stopMelodyPreview(time = this.now()) {
    this.melodyPreviewRequestId += 1;
    const session = this.melodyPreviewSession;
    if (session) {
      session.timerIds.forEach((timerId) => this.cancelTimeout(timerId));
      session.sampler?.releaseAll?.(time);
      this.melodyPreviewSession = null;
    }
    return Boolean(session);
  }

  triggerBassSampler(note, duration = '16n', time = this.now(), volume = this.getTrackVolume('bass')) {
    this.bassSampler = this.bassSampler ?? this.createBassSampler();
    if (!this.bassSampler?.triggerAttackRelease) return false;

    try {
      applyVolume(this.bassSampler, volume);
      this.bassSampler.triggerAttackRelease(note, duration, time);
      return true;
    } catch {
      return false;
    }
  }

  async triggerBassNote(note, duration = '16n', time, options = {}) {
    await this.startAudio();
    const trackId = options.trackId ?? 'bass';
    if (trackId === 'bass') return this.triggerBassSampler(note, duration, time ?? this.now());
    const nodes = this.ensureInstanceAudioNodes(trackId, 'bass');
    if (!nodes?.bassSampler?.triggerAttackRelease) return false;
    try {
      const volume = this.getTrackVolume(trackId);
      applyVolume(nodes.bassSampler, volume);
      nodes.bassSampler.triggerAttackRelease(note, duration, time ?? this.now());
      return true;
    } catch {
      return false;
    }
  }

  async previewMelodySequence(notes, options = {}) {
    const {
      intervalSeconds = 0.24,
      trackId = 'melody',
      timbreId = this.getMelodyTimbreId(),
    } = options;
    const normalizedNotes = Array.isArray(notes)
      ? notes.filter((note) => typeof note === 'string' && note.length > 0)
      : [];
    if (!normalizedNotes.length) return false;

    this.stopMelodyPreview();
    const requestId = this.melodyPreviewRequestId;
    const normalizedTimbreId = this.getMelodyTimbreId(timbreId);
    const prepared = await this.prepareMelodyTimbre(normalizedTimbreId);
    if (!prepared || requestId !== this.melodyPreviewRequestId) return false;

    const sampler = this.melodyPreviewBanks.get(normalizedTimbreId)?.sampler;
    if (!sampler?.triggerAttack) return false;
    const volume = this.getMelodyTrackVolume(trackId, normalizedTimbreId);
    const session = {
      requestId,
      sampler,
      timerIds: new Set(),
    };
    this.melodyPreviewSession = session;
    normalizedNotes.forEach((note, index) => {
      const timerId = this.scheduleTimeout(() => {
        session.timerIds.delete(timerId);
        if (this.melodyPreviewSession !== session) return;
        applyVolume(sampler, volume);
        sampler.triggerAttack(note, this.now());
      }, index * intervalSeconds * 1000);
      session.timerIds.add(timerId);
    });
    return true;
  }

  async previewChordSequence(noteGroups, options = {}) {
    const {
      duration = '8n',
      intervalSeconds = 0.55,
    } = options;

    await this.startAudio();

    const startTime = this.now();
    const volume = this.getTrackVolume('chord');
    return noteGroups.map((notes, index) => this.triggerChordNotes(
      notes,
      duration,
      startTime + index * intervalSeconds,
      volume,
    ));
  }

  async previewChordPattern(events, options = {}) {
    const {
      bpm = DEFAULT_BPM,
    } = options;

    await this.startAudio();

    const secondsPerSixteenth = 60 / bpm / 4;
    const startTime = this.now();
    const volume = this.getTrackVolume('chord');
    return events.map((event) => this.triggerChordNotes(
      event.notes,
      event.duration ?? '16n',
      startTime + event.step * secondsPerSixteenth,
      volume,
    ));
  }

  releaseChordPreviewVoices(time = this.now()) {
    this.chordSampler?.releaseAll?.(time);
    this.chordSynth?.releaseAll?.(time);
    this.instanceAudioNodes.forEach((nodes) => {
      nodes.chordSampler?.releaseAll?.(time);
      nodes.chordSynth?.releaseAll?.(time);
    });
  }

  stopChordClipSequencePreview() {
    this.chordClipPreviewRequestId += 1;
    const session = this.chordClipPreviewSession;
    if (!session) return false;

    session.timerIds.forEach((timerId) => this.cancelTimeout(timerId));
    this.chordClipPreviewSession = null;
    this.releaseChordPreviewVoices();
    session.resolve('stopped');
    return true;
  }

  async previewChordClipSequence(events, options = {}) {
    const {
      bpm = DEFAULT_BPM,
      totalSteps = STEPS_PER_BAR * 4,
      trackId = 'chord',
    } = options;
    const normalizedEvents = Array.isArray(events)
      ? events.filter((event) => (
        Number.isFinite(event?.step)
        && event.step >= 0
        && event.step < totalSteps
        && Array.isArray(event.notes)
        && event.notes.length
      ))
      : [];

    this.stopChordClipSequencePreview();
    if (!normalizedEvents.length || !Number.isFinite(totalSteps) || totalSteps <= 0) {
      return 'empty';
    }

    const requestId = ++this.chordClipPreviewRequestId;
    await this.startAudio();
    if (requestId !== this.chordClipPreviewRequestId) return 'stopped';

    const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const millisecondsPerSixteenth = (60 / normalizedBpm / 4) * 1000;
    return new Promise((resolve) => {
      const session = {
        requestId,
        resolve,
        timerIds: new Set(),
      };
      this.chordClipPreviewSession = session;

      const finish = (result) => {
        if (this.chordClipPreviewSession !== session) return;
        session.timerIds.forEach((timerId) => this.cancelTimeout(timerId));
        this.chordClipPreviewSession = null;
        this.releaseChordPreviewVoices();
        resolve(result);
      };

      normalizedEvents.forEach((event) => {
        const timerId = this.scheduleTimeout(() => {
          session.timerIds.delete(timerId);
          if (this.chordClipPreviewSession !== session) return;
          this.triggerChordNotes(
            event.notes,
            event.duration ?? '16n',
            this.now(),
            getVelocityAdjustedVolume(this.getTrackVolume(trackId), event.velocity),
            trackId,
          );
        }, Math.max(0, event.step + (event.timingOffset ?? 0)) * millisecondsPerSixteenth);
        session.timerIds.add(timerId);
      });

      const completionTimerId = this.scheduleTimeout(() => {
        session.timerIds.delete(completionTimerId);
        finish('completed');
      }, totalSteps * millisecondsPerSixteenth);
      session.timerIds.add(completionTimerId);
    });
  }

  async previewBassPattern(events, options = {}) {
    const {
      bpm = DEFAULT_BPM,
      trackId = 'bass',
    } = options;

    await this.startAudio();

    const secondsPerSixteenth = 60 / bpm / 4;
    const startTime = this.now();
    const volume = this.getTrackVolume(trackId);
    if (trackId === 'bass') {
      return events.map((event) => this.triggerBassSampler(
        event.note,
        event.duration ?? '16n',
        startTime + event.step * secondsPerSixteenth,
        volume,
      ));
    }
    const nodes = this.ensureInstanceAudioNodes(trackId, 'bass');
    return events.map((event) => {
      applyVolume(nodes?.bassSampler, volume);
      nodes?.bassSampler?.triggerAttackRelease?.(
        event.note,
        event.duration ?? '16n',
        startTime + event.step * secondsPerSixteenth,
      );
      return Boolean(nodes?.bassSampler);
    });
  }

  triggerChordEvent(event, time = this.now()) {
    const trackId = event.trackId ?? 'chord';
    return this.triggerChordNotes(
      event.notes,
      event.duration,
      time,
      getVelocityAdjustedVolume(this.getTrackVolume(trackId), event.velocity),
      trackId,
    );
  }

  setMatrixSource(matrixSource) {
    this.matrixSource = matrixSource;
    this.matrixAdapter = null;
  }

  setVolumeSource(volumeSource) {
    this.volumeSource = volumeSource;
  }

  setMelodyTimbreSource(melodyTimbreSource) {
    this.melodyTimbreSource = melodyTimbreSource;
  }

  setPlaybackCompleteHandler(handler) {
    this.onPlaybackComplete = typeof handler === 'function' ? handler : null;
  }

  hasTransportEvent() {
    return this.transportEventId !== null && this.transportEventId !== undefined;
  }

  hasStartedAudio() {
    return (
      this.status === AUDIO_STATUSES.READY
      || this.status === AUDIO_STATUSES.SAMPLE_FALLBACK
    );
  }

  getStartedTransport() {
    return this.hasStartedAudio() ? this.transport : null;
  }

  clearMatrixPlaybackSchedule({ invalidatePositions = true } = {}) {
    if (invalidatePositions) this.positionNotificationGeneration += 1;
    const transport = this.getStartedTransport();
    if (!this.hasTransportEvent() || !transport?.clear) return false;

    transport.clear(this.transportEventId);
    this.transportEventId = null;
    return true;
  }

  completeBoundedPlayback(position, time, notificationGeneration) {
    const onPlaybackComplete = this.onPlaybackComplete;
    const completion = {
      bar: position.bar,
      playedSteps: this.playedSteps,
      step: position.step,
    };
    const transport = this.getStartedTransport();
    transport?.stop?.(time);
    this.stopMelodyVoices(time);
    this.clearMatrixPlaybackSchedule({ invalidatePositions: false });

    const completeAtAudibleTime = () => {
      if (notificationGeneration !== this.positionNotificationGeneration) return;
      this.transportRunning = false;
      onPlaybackComplete?.(completion);
    };
    const draw = this.tone?.getDraw?.() ?? this.tone?.Draw;
    if (typeof draw?.schedule === 'function') {
      draw.schedule(completeAtAudibleTime, time);
    } else {
      completeAtAudibleTime();
    }
  }

  getMatrixAdapter(matrixSource = this.matrixSource) {
    if (!matrixSource) return null;
    if (!this.matrixAdapter) {
      this.matrixAdapter = createMatrixPlaybackAdapter(matrixSource, { totalBars: this.playbackTotalBars });
    }

    return this.matrixAdapter;
  }

  scheduleMatrixPlayback(matrixSource = this.matrixSource) {
    const adapter = this.getMatrixAdapter(matrixSource);
    const transport = this.getStartedTransport();
    if (!adapter || !transport?.scheduleRepeat) return null;

    this.clearMatrixPlaybackSchedule();
    const notificationGeneration = ++this.positionNotificationGeneration;

    this.transportEventId = transport.scheduleRepeat((time) => {
      const position = adapter.getPositionForFlatStep(this.transportFlatStep);
      this.currentBar = position.bar;
      this.currentStep = position.step;
      this.onScheduledPositionChange?.(position.bar, position.step);

      const notifyAudiblePosition = () => {
        if (notificationGeneration !== this.positionNotificationGeneration) return;
        this.onPositionChange?.(position.bar, position.step);
      };
      const draw = this.tone?.getDraw?.() ?? this.tone?.Draw;
      if (typeof draw?.schedule === 'function') {
        draw.schedule(notifyAudiblePosition, time);
      } else {
        notifyAudiblePosition();
      }

      for (const event of adapter.getEventsForStep(position.bar, position.step)) {
        if (this.audibleTrackIds && !this.audibleTrackIds.has(event.trackId)) continue;
        if (event.type === 'drums') {
          const trackId = event.trackId ?? 'drums';
          const secondsPerSixteenth = 60 / (transport.bpm?.value ?? DEFAULT_BPM) / 4;
          this.triggerDrumsInstrument(
            event.instrument,
            time + ((event.timingOffset ?? 0) * secondsPerSixteenth),
            getVelocityAdjustedVolume(this.getTrackVolume(trackId), event.velocity),
            trackId,
          );
        }
        if (event.type === 'bass') {
          const trackId = event.trackId ?? 'bass';
          if (trackId === 'bass') {
            this.triggerBassSampler(
              event.note,
              event.duration,
              time,
              this.getTrackVolume(trackId),
            );
          } else {
            const nodes = this.ensureInstanceAudioNodes(trackId, 'bass');
            applyVolume(nodes?.bassSampler, this.getTrackVolume(trackId));
            nodes?.bassSampler?.triggerAttackRelease?.(event.note, event.duration, time);
          }
        }
        if (event.type === 'chord') {
          const secondsPerSixteenth = 60 / (transport.bpm?.value ?? DEFAULT_BPM) / 4;
          this.triggerChordEvent(
            event,
            time + ((event.timingOffset ?? 0) * secondsPerSixteenth),
          );
        }
        if (event.type === 'melody') {
          if (event.timbreId) {
            const bank = this.melodyPreviewBanks.get(event.timbreId);
            if (bank?.ready) {
              applyVolume(bank.sampler, this.getMelodyTrackVolume(event.trackId ?? 'melody', event.timbreId));
              bank.sampler.triggerAttackRelease?.(event.note, event.duration, time);
            }
            continue;
          }
          const melodyVolume = this.getMelodyTrackVolume(event.trackId ?? 'melody');
          this.triggerMelodyOneShot(
            event.note,
            time,
            melodyVolume,
            event.trackId ?? 'melody',
          );
        }
      }

      this.transportFlatStep = (this.transportFlatStep + 1) % adapter.totalSteps;
      this.playedSteps += 1;
      if (this.maxPlaybackSteps !== null && this.playedSteps >= this.maxPlaybackSteps) {
        this.completeBoundedPlayback(position, time, notificationGeneration);
      }
    }, '16n');

    return this.transportEventId;
  }

  syncTransport({ bpm = DEFAULT_BPM, bar = this.currentBar, step = this.currentStep } = {}) {
    const transport = this.getStartedTransport();
    if (transport?.bpm) {
      transport.bpm.value = bpm;
    }

    return this.seekToStep(bar, step);
  }

  setTempo(bpm = DEFAULT_BPM) {
    const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const transport = this.getStartedTransport();
    if (!transport?.bpm) return false;

    transport.bpm.value = normalizedBpm;
    return true;
  }

  seekToStep(bar, step) {
    this.currentBar = bar;
    this.currentStep = step;
    this.transportFlatStep = (bar * STEPS_PER_BAR + step) % (this.playbackTotalBars * STEPS_PER_BAR);

    const transport = this.getStartedTransport();
    if (transport) {
      transport.position = formatToneTransportPosition(bar, step);
    }
  }

  async play(options = {}) {
    this.stopDrumsPatternPreview();
    this.stopChordClipSequencePreview();
    const requestId = ++this.playRequestId;
    await this.startAudio();
    if (requestId !== this.playRequestId) return false;
    if (Object.hasOwn(options, 'volumeSource')) {
      this.setVolumeSource(options.volumeSource);
    }
    if (Object.hasOwn(options, 'melodyTimbreSource')) {
      this.setMelodyTimbreSource(options.melodyTimbreSource);
    }
    if (Object.hasOwn(options, 'onPositionChange')) {
      this.onPositionChange = typeof options.onPositionChange === 'function'
        ? options.onPositionChange
        : null;
    }
    if (Object.hasOwn(options, 'onScheduledPositionChange')) {
      this.onScheduledPositionChange = typeof options.onScheduledPositionChange === 'function'
        ? options.onScheduledPositionChange
        : null;
    }
    if (Object.hasOwn(options, 'onPlaybackComplete')) {
      this.onPlaybackComplete = typeof options.onPlaybackComplete === 'function'
        ? options.onPlaybackComplete
        : null;
    }
    await this.prepareMatrixPlaybackSamples();
    if (options.melodyTimbreIds?.length) {
      const ready = await Promise.all(options.melodyTimbreIds.map((id) => this.prepareMelodyTimbre(id)));
      if (ready.some((result) => !result)) throw new Error('旋律音色加载失败，请重试');
    }
    if (requestId !== this.playRequestId) return false;
    this.playbackTotalBars = Number.isInteger(options.totalBars) && options.totalBars > 0
      ? options.totalBars : TOTAL_BARS;
    this.matrixAdapter = null;
    this.audibleTrackIds = normalizeAudibleTrackIds(options.audibleTrackIds);
    this.maxPlaybackSteps = normalizeMaxPlaybackSteps(options.maxPlaybackSteps);
    this.playedSteps = 0;
    this.syncTransport(options);

    if (options.matrixSource || this.matrixSource) {
      this.scheduleMatrixPlayback(options.matrixSource ?? this.matrixSource);
    }

    this.getStartedTransport()?.start?.();
    this.transportRunning = true;
    return true;
  }

  async pause() {
    this.playRequestId += 1;
    this.transportRunning = false;
    this.getStartedTransport()?.pause?.();
  }

  async stop(time = this.now()) {
    this.playRequestId += 1;
    this.transportRunning = false;
    this.stopDrumsPatternPreview();
    this.stopChordClipSequencePreview();
    this.stopMelodyPreview(time);
    const transport = this.getStartedTransport();
    transport?.stop?.(time);
    this.stopMelodyVoices(time);
    if (transport) {
      transport.position = formatToneTransportPosition(this.currentBar, this.currentStep);
    }
    this.clearMatrixPlaybackSchedule();
  }

  stopAllVoices(time = this.now()) {
    this.stopMelodyVoices(time);
    this.melodyPreviewBanks.forEach((bank) => bank.sampler?.releaseAll?.(time));
    this.bassSampler?.releaseAll?.(time);
    this.chordSampler?.releaseAll?.(time);
    this.chordSynth?.releaseAll?.(time);
    this.fallbackSynth?.triggerRelease?.(time);
    this.drumPlayers.forEach((player) => player.stop?.(time));
    this.instanceAudioNodes.forEach((nodes) => {
      nodes.bassSampler?.releaseAll?.(time);
      nodes.chordSampler?.releaseAll?.(time);
      nodes.chordSynth?.releaseAll?.(time);
      nodes.drumPlayers?.forEach((player) => player.stop?.(time));
    });
  }
}

export {
  createBassSampleUrls,
  createChordSampleUrls,
  createDrumsSampleUrls,
  createMelodySampleUrls,
  formatToneTransportPosition,
};
