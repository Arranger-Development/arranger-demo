import { getMelodyTimbre, normalizeMelodyTimbreId } from './melodyTimbres.js';

export const DEEP_AUTUMN_DRUMS = 'deep-autumn-drums';
export const DEEP_AUTUMN_CHORD = 'deep-autumn-chord';
export const DEEP_AUTUMN_BASS = 'deep-autumn-bass';
export const DEEP_AUTUMN_MELODY = 'deep-autumn-melody';
export const PERFORMANCE_SAMPLE_BANKS = Object.freeze({
  [DEEP_AUTUMN_DRUMS]: {
    id: DEEP_AUTUMN_DRUMS, track: 'drums', label: '深秋鼓组', gainDb: -5.5,
    sampleFiles: Object.fromEntries(['Kick', 'Snare', 'Hihat'].map((name) => [
      name.toLowerCase(), `samples/DeepAutumn/Drums/${name}.wav`,
    ])),
  },
  [DEEP_AUTUMN_CHORD]: {
    // These quiet piano samples need source compensation before the user fader.
    // The shared master output provides mix headroom and peak protection.
    id: DEEP_AUTUMN_CHORD, track: 'chord', label: '深秋和弦', gainDb: 2.5,
    // These piano files use Ableton octave labels; Tone.js roots are one higher.
    sampleFiles: Object.fromEntries([2, 3, 4].flatMap((octave) => (
      ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'].map((root) => [
        `${root}${octave + 1}`, `samples/DeepAutumn/Chord/${root.replace('#', 'Sharp')}${octave}.wav`,
      ])
    ))),
  },
  [DEEP_AUTUMN_BASS]: {
    id: DEEP_AUTUMN_BASS, track: 'bass', label: '深秋贝斯', gainDb: 0,
    // Source filenames use Ableton octaves and omit sharps. Register their
    // measured pitches in Tone.js notation; filenames and musical notes stay intact.
    sampleFiles: Object.fromEntries([
      ['E1','E0'], ['F#1','F0'], ['G#1','G0'], ['A1','A0'], ['B1','B0'],
      ['C#2','C1'], ['D#2','D1'], ['E2','E1'], ['F#2','F1'],
    ].map(([note,file]) => [note, `samples/DeepAutumn/Bass/${file}.wav`])),
  },
  [DEEP_AUTUMN_MELODY]: {
    id: DEEP_AUTUMN_MELODY, track: 'melody', label: '深秋旋律', gainDb: 0.5,
    // Match the user's original sample octaves to the visible Ableton labels:
    // UI E4 is stored as E5, and must play E4.wav unchanged. These are playback
    // bindings, not declarations that E4.wav physically has an E5 fundamental.
    sampleFiles: Object.fromEntries(['C#3','D#3','E3','F#3','G#3','A3','B3','C#4','D#4','E4','F#4','G#4','A4','B4','C#5'].map(note => [
      note.replace(/\d+$/, octave => Number(octave) + 1),
      `samples/DeepAutumn/Melody/${note.replace('#', '')}.wav`,
    ])),
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
    ...(bank ? { timbreId: bank.id, ...(bank.track !== 'drums' ? { playbackMode: event.playbackMode === 'gated' ? 'gated' : 'natural' } : {}) } : {}),
  };
}
