import { getDialDrumPreset } from '../data/dialDrumPresets.js';
import { getDialPitchedPreset } from '../data/dialPitchedPresets.js';
import { jamTrackParameters } from './jamPerformanceState.js';

export const hasJamNotes = draft => Boolean(draft?.bars?.some(bar => bar.some(Boolean)));

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
    : getDialPitchedPreset(draft.trackId, params.strength, params.groove);
  return preset ? { ...draft, params, sourcePresetId: preset.id, bars: structuredClone(preset.bars) } : draft;
}
