import { getDrumTemplatesForGenre } from '../data/drumStyleTemplates.js';
import { getChordStyleChordTemplatesForGenre } from '../data/chordStylePresets.js';
import { getMelodyStyleTemplate } from '../data/melodyStyleTemplates.js';
import { BASS_GROOVE_TEMPLATES, createBassCell, createBassPreviewEvents } from './bassActions.js';
import { createDrumsBarFromTemplate } from './drumsPatternActions.js';
import { createChordStylePresetBar } from './chordStylePresetActions.js';
import { createChordCell, createChordNotesCell, getChordCellNotes } from '../domain/chordCells.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import { createMelodyCellFromNotes, getMelodyCellNotes } from '../domain/melodyCells.js';
import { AI_PERFORMANCE_PROFILE_ID, AI_PERFORMANCE_DEFAULT_BPM, AI_PERFORMANCE_TEMPLATES } from '../data/aiPerformanceTemplates.js';

export const PERFORMANCE_BARS = 2;
export const PERFORMANCE_TRACKS = ['drums', 'chord', 'bass', 'melody'];
export const PERFORMANCE_LABELS = { drums: '鼓', chord: '和弦', bass: '贝斯', melody: '旋律' };
const emptyBar = () => Array(16).fill(null);
export const emptySelection = () => Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, null]));
export const hasSelection = (selection) => PERFORMANCE_TRACKS.some((id) => Boolean(selection?.[id]));
export const sameSelection = (a, b) => PERFORMANCE_TRACKS.every((id) => a?.[id] === b?.[id]);
export const selectionSummary = (selection) => PERFORMANCE_TRACKS
  .filter((id) => selection?.[id]).map((id) => PERFORMANCE_LABELS[id]).join('＋') || '空 Loop';

const bassTemplates = [
  ...BASS_GROOVE_TEMPLATES.map((template, index) => ({
    ...template, name: ['稳步低音', '摇摆切分', '灵动十六分'][index],
  })),
  { id: 'performance-bass-space', name: '留白低音', steps: [0, 8], duration: '4n' },
  { id: 'performance-bass-drive', name: '八分推进', steps: [0, 2, 4, 6, 8, 10, 12, 14], duration: '8n' },
];

const melodyTemplates = [
  { id: 'performance-melody-rise', name: '五音轻起', styleId: 'chinese', degrees: [0, 1, 2, 3, 4, 3, 2, 1, 3, 0] },
  { id: 'performance-melody-answer', name: '山间问答', styleId: 'chinese', degrees: [3, 2, 1, 2, 0, 1, 2, 3, 1, 0] },
  { id: 'performance-melody-return', name: '落叶回旋', styleId: 'chinese', degrees: [4, 3, 2, 1, 2, 3, 1, 2, 1, 0] },
  { id: 'performance-melody-blue', name: '蓝调漫步', styleId: 'blues', degrees: [0, 2, 3, 4, 3, 1, 0, 4, 5, 4, 3, 2, 1, 0] },
  { id: 'performance-melody-night', name: '夜色呼应', styleId: 'blues', degrees: [4, 3, 2, 3, 0, 1, 0, 1, 2, 3, 4, 3, 1, 0] },
];

export function performanceTemplates(genreId, profileId = null) {
  if (profileId === AI_PERFORMANCE_PROFILE_ID) {
    return AI_PERFORMANCE_TEMPLATES;
  }
  return {
    drums: getDrumTemplatesForGenre(genreId),
    chord: getChordStyleChordTemplatesForGenre(genreId),
    bass: bassTemplates,
    melody: melodyTemplates,
  };
}

export function normalizeSelection(value, genreId, profileId = null) {
  const templates = performanceTemplates(genreId, profileId);
  return Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id,
    templates[id].some((template) => template.id === value?.[id]) ? value[id] : null,
  ]));
}

export function createPerformanceMatrix(selection, genreId, profileId = null) {
  const templates = performanceTemplates(genreId, profileId);
  const selected = normalizeSelection(selection, genreId, profileId);
  const totalBars = Math.max(PERFORMANCE_BARS, ...PERFORMANCE_TRACKS.map((track) => (
    templates[track].find(({ id }) => id === selected[track])?.barCount ?? 0
  )));
  const matrix = Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, Array.from({ length: totalBars }, emptyBar)]));
  if (profileId === AI_PERFORMANCE_PROFILE_ID) {
    for (let bar = 0; bar < totalBars; bar += 1) {
      for (const track of PERFORMANCE_TRACKS) {
        const template = templates[track].find(({ id }) => id === selected[track]);
        if (!template) continue;
        const phraseBar = template.bars[bar % template.barCount];
        if (track === 'drums') {
          matrix.drums[bar] = matrix.drums[bar].map((_, step) => {
            const instruments = Object.keys(phraseBar).filter((instrument) => phraseBar[instrument].includes(step));
            return instruments.length ? createDrumsCell(instruments) : null;
          });
        } else {
          phraseBar.forEach(([step, note]) => {
            matrix[track][bar][step] = track === 'bass' ? createBassCell(note, '16n')
              : track === 'chord' ? createChordNotesCell([...getChordCellNotes(matrix.chord[bar][step]), note], {
                duration: '16n', timbreId: 'piano', playbackMode: 'natural',
              })
              : createMelodyCellFromNotes([...getMelodyCellNotes(matrix.melody[bar][step]), note], {
                duration: '16n', timbreId: 'piano', playbackMode: 'natural',
              });
          });
        }
      }
    }
    return matrix;
  }
  const chord = templates.chord.find(({ id }) => id === selected.chord) ?? templates.chord[0];
  const bass = templates.bass.find(({ id }) => id === selected.bass);
  const melody = templates.melody.find(({ id }) => id === selected.melody);
  for (let bar = 0; bar < PERFORMANCE_BARS; bar += 1) {
    if (selected.drums) matrix.drums[bar] = createDrumsBarFromTemplate(selected.drums);
    if (selected.chord) matrix.chord[bar] = createChordStylePresetBar(selected.chord, bar);
    if (bass) {
      // Bass follows the harmony even when the chord voice is switched off.
      const harmony = { chord: [emptyBar(), emptyBar()] };
      harmony.chord[bar][0] = createChordCell(chord.chords[bar]);
      const rootNote = createBassPreviewEvents(harmony, bar, BASS_GROOVE_TEMPLATES[0].id)[0].note;
      bass.steps.forEach((step) => { matrix.bass[bar][step] = createBassCell(rootNote, bass.duration); });
    }
    if (melody) {
      const style = getMelodyStyleTemplate(melody.styleId);
      style.rhythmSteps.forEach((step, index) => {
        const degree = melody.degrees[bar * style.rhythmSteps.length + index];
        matrix.melody[bar][step] = {
          type: 'melody', note: `${style.highlightedPitchClasses[degree]}4`,
          duration: '16n', timbreId: style.recommendedTimbreId,
        };
      });
    }
  }
  return matrix;
}

export function createPerformanceSequence(saved, genreId, profileId = null) {
  const normalized = saved.map((selection) => normalizeSelection(selection, genreId, profileId));
  const indices = normalized.flatMap((selection, index) => hasSelection(selection) ? [index] : []);
  const matrices = indices.map((index) => createPerformanceMatrix(normalized[index], genreId, profileId));
  let totalBars = 0;
  const segments = matrices.map((matrix, index) => {
    const segment = { loopIndex: indices[index], startStep: totalBars * 16, totalSteps: matrix.drums.length * 16 };
    totalBars += matrix.drums.length;
    return segment;
  });
  return {
    indices,
    segments,
    totalBars,
    matrix: Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, matrices.flatMap((matrix) => matrix[id])])),
  };
}

export const performanceStorageKey = (genreId, profileId = null) => (
  profileId === AI_PERFORMANCE_PROFILE_ID
    ? `arranger-performance:v3:${profileId}`
    : `arranger-performance:v1:${genreId}`
);
export const normalizePerformanceBpm = (bpm) => Math.max(40, Math.min(240, Math.round(Number(bpm) || 120)));

export function readPerformanceSession(storage, genreId, initialBpm, profileId = null) {
  const defaultBpm = profileId === AI_PERFORMANCE_PROFILE_ID ? AI_PERFORMANCE_DEFAULT_BPM : initialBpm;
  const fallback = { bpm: normalizePerformanceBpm(defaultBpm), saved: Array.from({ length: 5 }, emptySelection) };
  try {
    const stored = storage?.getItem(performanceStorageKey(genreId, profileId));
    if (profileId === AI_PERFORMANCE_PROFILE_ID) {
      // Retire only the old AI libraries; never remap their track selections.
      for (const version of [1, 2]) {
        const legacyKey = `arranger-performance:v${version}:${profileId}`;
        if (storage?.getItem(legacyKey) != null) storage?.removeItem?.(legacyKey);
      }
    }
    const value = JSON.parse(stored ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.saved)) return fallback;
    return {
      bpm: normalizePerformanceBpm(value.bpm ?? defaultBpm),
      saved: Array.from({ length: 5 }, (_, index) => normalizeSelection(value.saved[index], genreId, profileId)),
    };
  } catch { return fallback; }
}

export function writePerformanceSession(storage, genreId, session, profileId = null) {
  try {
    if (!storage) return false;
    storage.setItem(performanceStorageKey(genreId, profileId), JSON.stringify({ version: 1, ...session }));
    return true;
  } catch { return false; }
}
