import { createDefaultTrackState } from '../domain/trackInstances.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';
import {
  createPerformanceSequence, normalizePerformanceBpm, normalizeSelection,
  PERFORMANCE_TRACKS, performanceTemplates,
} from './performanceModel.js';

// Build everything before touching the editor. Never read drafts or retain shared cells.
export function createPerformanceImport({ saved, bpm, genreId, profileId = null }) {
  if (!Array.isArray(saved) || saved.length !== 5) throw new Error('无法读取已保存的 Loop。');
  const selections = saved.map((value) => normalizeSelection(value, genreId, profileId));
  const sequence = createPerformanceSequence(selections, genreId, profileId);
  if (!sequence.indices.length) throw new Error('请先保存一段 Loop。');
  if (sequence.totalBars > MAX_PROJECT_BARS) throw new Error('编曲最多支持 20 小节。');
  const templates = performanceTemplates(genreId, profileId);
  const matrix = structuredClone(sequence.matrix);
  const records = sequence.segments.flatMap(({ loopIndex, startStep, totalSteps }) => (
    Array.from({ length: totalSteps / 16 }, (_, offset) => PERFORMANCE_TRACKS.flatMap((trackId) => {
      const template = templates[trackId].find(({ id }) => id === selections[loopIndex][trackId]);
      if (!template) return [];
      const clip = createClipRecord(trackId, startStep / 16 + offset);
      return [{ ...clip, customName: true, name: `Loop ${loopIndex + 1} · ${template.name}` }];
    })).flat()
  ));
  const first = records.find((clip) => matrix[clip.trackId][clip.bar].some(Boolean)) ?? records[0];
  const firstMelody = matrix.melody.flat().find(Boolean);
  return {
    ...createDefaultTrackState(),
    totalBars: sequence.totalBars,
    matrix,
    clips: { ids: records.map(({ id }) => id), byId: Object.fromEntries(records.map((clip) => [clip.id, clip])) },
    bpm: normalizePerformanceBpm(bpm),
    isPlaying: false,
    currentBar: 0, currentStep: 0, seekBar: 0, seekStep: 0,
    selectedBar: first.bar, selectedClipId: first.id, activeTrackId: first.trackId,
    visibleTrackIds: [...PERFORMANCE_TRACKS],
    volumes: Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, 0])),
    mutedTracks: Object.fromEntries(PERFORMANCE_TRACKS.map((id) => [id, false])),
    melodyTimbreId: firstMelody?.timbreId ?? 'piano',
    melodyRhythmTemplateId: null,
    melodyScaleId: 'chinese',
  };
}
