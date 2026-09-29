import { getMelodyTimbre, normalizeMelodyTimbreId } from './melodyTimbres.js';

export const DEEP_AUTUMN_DRUMS = 'deep-autumn-drums';
export const DEEP_AUTUMN_CHORD = 'deep-autumn-chord';
export const DEEP_AUTUMN_BASS = 'deep-autumn-bass';
export const DEEP_AUTUMN_MELODY = 'deep-autumn-melody';
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
  [DEEP_AUTUMN_BASS]: {
    id: DEEP_AUTUMN_BASS, track: 'bass', label: '深秋贝斯', gainDb: 0,
    sampleFiles: Object.fromEntries(['E0','F0','G0','A0','B0','C1','D1','E1','F1'].map(note => [note, `samples/DeepAutumn/Bass/${note}.wav`])),
  },
  [DEEP_AUTUMN_MELODY]: {
    id: DEEP_AUTUMN_MELODY, track: 'melody', label: '深秋旋律', gainDb: 0,
    sampleFiles: Object.fromEntries(['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'].map(note => [note, `samples/DeepAutumn/Melody/${note}.wav`])),
  },
});

export function getPerformanceSampleBank(track, id) {
  const bank = PERFORMANCE_SAMPLE_BANKS[id];
  return bank?.track === track ? bank : null;
}

// Pitched engine banks include the chord pack; the melody editor keeps its own menu.
export function getPitchedSampleBank(id) {
  return (PERFORMANCE_SAMPLE_BANKS[id]?.track !== 'drums' ? PERFORMANCE_SAMPLE_BANKS[id] : null) ?? getMelodyTimbre(id);
}

export function normalizePitchedSampleBankId(id) {
  return (PERFORMANCE_SAMPLE_BANKS[id]?.track !== 'drums' ? PERFORMANCE_SAMPLE_BANKS[id]?.id : null) ?? normalizeMelodyTimbreId(id);
}

export function withPerformanceTimbre(event, requestedTimbreId) {
  const bank = getPerformanceSampleBank(event.type, requestedTimbreId);
  return {
    ...event,
    ...(requestedTimbreId ? { requestedTimbreId } : {}),
    ...(bank ? { timbreId: bank.id, ...(bank.track !== 'drums' ? { playbackMode: 'natural' } : {}) } : {}),
  };
}
