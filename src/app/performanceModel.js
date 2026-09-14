import { getDrumTemplatesForGenre } from '../data/drumStyleTemplates.js';
import { getChordStyleChordTemplatesForGenre } from '../data/chordStylePresets.js';
import { getMelodyStyleTemplate } from '../data/melodyStyleTemplates.js';
import { BASS_GROOVE_TEMPLATES, createBassCell, createBassPreviewEvents } from './bassActions.js';
import { createDrumsBarFromTemplate } from './drumsPatternActions.js';
import { createChordStylePresetBar } from './chordStylePresetActions.js';
import { createChordCell } from '../domain/chordCells.js';

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

export function performanceTemplates(genreId) {
  return {
    drums: getDrumTemplatesForGenre(genreId),
    chord: getChordStyleChordTemplatesForGenre(genreId),
    bass: bassTemplates,
    melody: melodyTemplates,
  };
}

export function normalizeSelection(value, genreId) {
  const templates = performanceTemplates(genreId);
  return Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id,
    templates[id].some((template) => template.id === value?.[id]) ? value[id] : null,
  ]));
}

export function createPerformanceMatrix(selection, genreId) {
  const templates = performanceTemplates(genreId);
  const selected = normalizeSelection(selection, genreId);
  const matrix = Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, [emptyBar(), emptyBar()]]));
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

export function createPerformanceSequence(saved, genreId) {
  const indices = saved.flatMap((selection, index) => hasSelection(selection) ? [index] : []);
  const matrices = indices.map((index) => createPerformanceMatrix(saved[index], genreId));
  return {
    indices,
    totalBars: indices.length * PERFORMANCE_BARS,
    matrix: Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, matrices.flatMap((matrix) => matrix[id])])),
  };
}

export const performanceStorageKey = (genreId) => `arranger-performance:v1:${genreId}`;
export const normalizePerformanceBpm = (bpm) => Math.max(40, Math.min(240, Math.round(Number(bpm) || 120)));

export function readPerformanceSession(storage, genreId, initialBpm) {
  const fallback = { bpm: normalizePerformanceBpm(initialBpm), saved: Array.from({ length: 5 }, emptySelection) };
  try {
    const value = JSON.parse(storage?.getItem(performanceStorageKey(genreId)) ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.saved)) return fallback;
    return {
      bpm: normalizePerformanceBpm(value.bpm ?? initialBpm),
      saved: Array.from({ length: 5 }, (_, index) => normalizeSelection(value.saved[index], genreId)),
    };
  } catch { return fallback; }
}

export function writePerformanceSession(storage, genreId, session) {
  try {
    if (!storage) return false;
    storage.setItem(performanceStorageKey(genreId), JSON.stringify({ version: 1, ...session }));
    return true;
  } catch { return false; }
}
