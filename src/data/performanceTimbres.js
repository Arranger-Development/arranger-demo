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
    // These source filenames omit sharps. Keep the legacy bass octave convention;
    // see docs/deep-autumn-pitch-mapping.md for measured pitches and provenance.
    sampleFiles: Object.fromEntries(['E0','F#0','G#0','A0','B0','C#1','D#1','E1','F#1'].map(note => [note, `samples/DeepAutumn/Bass/${note.replace('#', '')}.wav`])),
  },
  [DEEP_AUTUMN_MELODY]: {
    id: DEEP_AUTUMN_MELODY, track: 'melody', label: '深秋旋律', gainDb: 0,
    // Register the audible roots, not the unaltered source filenames.
    sampleFiles: Object.fromEntries(['C#3','D#3','E3','F#3','G#3','A3','B3','C#4','D#4','E4','F#4','G#4','A4','B4','C#5'].map(note => [note, `samples/DeepAutumn/Melody/${note.replace('#', '')}.wav`])),
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
