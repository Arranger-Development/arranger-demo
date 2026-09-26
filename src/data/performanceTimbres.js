import { getMelodyTimbre, normalizeMelodyTimbreId } from './melodyTimbres.js';

export const DEEP_AUTUMN_DRUMS = 'deep-autumn-drums';
export const DEEP_AUTUMN_CHORD = 'deep-autumn-chord';
export const PERFORMANCE_SAMPLE_BANKS = Object.freeze({
  [DEEP_AUTUMN_DRUMS]: {
    id: DEEP_AUTUMN_DRUMS, track: 'drums', label: '深秋鼓组', gainDb: -3,
    sampleFiles: Object.fromEntries(['Kick', 'Snare', 'Hihat'].map((name) => [
      name.toLowerCase(), `samples/DeepAutumn/Drums/${name}.wav`,
    ])),
  },
  [DEEP_AUTUMN_CHORD]: {
    // Dense five-note voicings need headroom when mixed with the other three tracks.
    id: DEEP_AUTUMN_CHORD, track: 'chord', label: '深秋和弦', gainDb: -6,
    sampleFiles: Object.fromEntries([2, 3, 4].flatMap((octave) => (
      ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'].map((root) => [
        `${root}${octave}`, `samples/DeepAutumn/Chord/${root.replace('#', 'Sharp')}${octave}.wav`,
      ])
    ))),
  },
});

export function getPerformanceSampleBank(track, id) {
  const bank = PERFORMANCE_SAMPLE_BANKS[id];
  return bank?.track === track ? bank : null;
}

// Pitched engine banks include the chord pack; the melody editor keeps its own menu.
export function getPitchedSampleBank(id) {
  return getPerformanceSampleBank('chord', id) ?? getMelodyTimbre(id);
}

export function normalizePitchedSampleBankId(id) {
  return getPerformanceSampleBank('chord', id)?.id ?? normalizeMelodyTimbreId(id);
}

export function withPerformanceTimbre(event, requestedTimbreId) {
  const bank = getPerformanceSampleBank(event.type, requestedTimbreId);
  return {
    ...event,
    ...(requestedTimbreId ? { requestedTimbreId } : {}),
    ...(bank ? { timbreId: bank.id, ...(bank.track === 'chord' ? { playbackMode: 'natural' } : {}) } : {}),
  };
}
