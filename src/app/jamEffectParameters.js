export const EFFECT_DEFAULTS = { volume: 0, cutoff: 20000, repeat: null, pitch: 0, reverb: 0, chopper: null, brake: 0 };
export const EFFECT_FIELDS = { volume: 'volumes', cutoff: 'cutoffs', repeat: 'repeats', pitch: 'pitches', reverb: 'reverbs', chopper: 'choppers', brake: 'brakes' };
export const MOMENTARY_EFFECTS = ['repeat', 'pitch', 'chopper', 'brake'];
export function effectValues(parameter, value, bpm = 100) {
  if (parameter === 'repeat') return value === null ? { held: false } : { held: true, division: value, bpm };
  if (parameter === 'volume') return { volume: value, muted: value <= -24 };
  return { [parameter]: value, ...(parameter === 'chopper' ? { bpm } : {}) };
}
