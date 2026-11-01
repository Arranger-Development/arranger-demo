import { getDialDrumPreset } from '../data/dialDrumPresets.js';
import { getJamPitchedPreset } from './jamPitchedPresets.js';
import { jamTrackParameters } from './jamPerformanceState.js';
import { hasJamPhraseNotes } from './jamPhraseContent.js';

export const hasJamNotes = hasJamPhraseNotes;

export function blankJamDraft(trackId, timbreId, targetSlot) {
  return { trackId, timbreId, targetSlot, name: '', sourcePresetId: 'blank',
    params: jamTrackParameters(undefined, trackId), bars: [Array(16).fill(null)], dirty: false };
}

export function applyJamTrackParameter(draft, parameter, value) {
  if (!draft || !['strength', 'groove'].includes(parameter)) return draft;
  const before = jamTrackParameters(draft.params, draft.trackId);
  const params = jamTrackParameters({ ...before, [parameter]: value }, draft.trackId);
  if (before[parameter] === params[parameter]) return draft;
  const preset = draft.trackId === 'drums' ? getDialDrumPreset(params.strength, params.groove)
    : getJamPitchedPreset(draft.trackId, params.strength, params.groove);
  return preset ? { ...draft, params, sourcePresetId: preset.id, bars: structuredClone(preset.bars) } : draft;
}
