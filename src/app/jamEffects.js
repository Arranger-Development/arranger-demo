import { PERFORMANCE_TRACKS } from './performanceModel.js';
import { createRepeatPadController } from './repeatPadController.js';
import { EFFECT_DEFAULTS, EFFECT_FIELDS, MOMENTARY_EFFECTS, effectValues } from './jamEffectParameters.js';

const defaults = value => Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, value]));
export function createJamEffects(audio) {
  let state = { selectedTrack: 'drums', selectedTracks: ['drums'], effectPage: 'mix', mutedTracks: defaults(false),
    ...Object.fromEntries(Object.entries(EFFECT_DEFAULTS).map(([p,v]) => [EFFECT_FIELDS[p], defaults(v)])) };
  const manual = Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, { ...EFFECT_DEFAULTS, muted: false }]));
  const owners = new Map(), listeners = new Set(); let onManual = () => {};
  const notify = () => listeners.forEach(fn => fn());
  const display = (track, parameter, value) => {
    const field = EFFECT_FIELDS[parameter];
    state = { ...state, [field]: { ...state[field], [track]: value } };
    if (parameter === 'volume') state.mutedTracks = { ...state.mutedTracks, [track]: value <= -24 };
    notify();
  };
  function apply(track, parameter, value, bpm) {
    onManual(track, parameter, value);
    audio.setPerformanceEffect(track, effectValues(parameter, value, bpm));
    display(track, parameter, value);
  }
  const repeat = createRepeatPadController(values => {
    for (const track of state.selectedTracks) apply(track, 'repeat', values.held ? values.division : null, values.bpm);
  });
  const held = parameter => parameter === 'repeat' ? repeat.getSnapshot() !== null : owners.has(parameter);
  function resetHold(parameter, silent = false) {
    if (parameter === 'repeat') { repeat.reset(silent); return; }
    const owner = owners.get(parameter); owners.delete(parameter);
    if (owner && !silent) for (const track of owner.tracks) apply(track, parameter, EFFECT_DEFAULTS[parameter]);
  }
  function resetHolds(silent = false) { for (const p of MOMENTARY_EFFECTS) resetHold(p, silent); }
  function selectTargets(targets, track) {
    if (state.selectedTrack === track && targets.join() === state.selectedTracks.join()) return;
    resetHolds();
    for (const previous of state.selectedTracks) for (const p of MOMENTARY_EFFECTS) {
      if (state[EFFECT_FIELDS[p]][previous] !== EFFECT_DEFAULTS[p]) apply(previous, p, EFFECT_DEFAULTS[p]);
    }
    state = { ...state, selectedTrack: track, selectedTracks: targets }; notify();
  }
  return {
    repeat, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    onManual(fn) { onManual = fn; }, display,
    getManual: track => ({ ...manual[track] }),
    isHeld: (track, parameter) => held(parameter) && (parameter === 'repeat' ? state.selectedTracks : owners.get(parameter).tracks).includes(track),
    resetHolds,
    press(parameter, token, value, bpm) {
      if (!state.selectedTracks.length || !['pitch','chopper','brake'].includes(parameter)) return;
      if (!Number.isFinite(value) || (parameter === 'pitch' && Math.abs(value) > 12)
        || (parameter === 'chopper' && ![4,8,16,32].includes(value)) || (parameter === 'brake' && value !== 1)) return;
      owners.set(parameter, { token, tracks: [...state.selectedTracks] });
      for (const track of state.selectedTracks) apply(track, parameter, value, bpm);
    },
    release(parameter, token) { if (owners.get(parameter)?.token === token) resetHold(parameter); },
    resetHold,
    setPage(page) {
      if (!['mix','expression','arp'].includes(page) || page === state.effectPage) return;
      if (state.effectPage === 'expression') resetHold('pitch');
      state = { ...state, effectPage: page }; notify();
    },
    restore(track, parameter) {
      const value = MOMENTARY_EFFECTS.includes(parameter) ? EFFECT_DEFAULTS[parameter]
        : parameter === 'volume' && manual[track].muted ? -24 : manual[track][parameter];
      audio.setPerformanceEffect(track, effectValues(parameter, value)); display(track, parameter, value);
    },
    select(track, additive = false) {
      if (!PERFORMANCE_TRACKS.includes(track)) return;
      const targets = additive ? [...new Set([...state.selectedTracks, track])] : [track];
      selectTargets(targets, track);
    },
    toggleTrack(track) {
      if (!PERFORMANCE_TRACKS.includes(track)) return;
      const targets = state.selectedTracks.includes(track)
        ? state.selectedTracks.filter(t => t !== track) : [...state.selectedTracks, track];
      // Keep the last display anchor when empty, without retaining an effect target.
      selectTargets(targets, targets.at(-1) ?? state.selectedTrack);
    },
    syncMix(volumes, mutedTracks) {
      for (const track of PERFORMANCE_TRACKS) {
        if (manual[track].volume === volumes[track] && manual[track].muted === mutedTracks[track]) continue;
        manual[track].volume = volumes[track]; manual[track].muted = mutedTracks[track];
        audio.setPerformanceEffect(track, { volume: volumes[track], muted: mutedTracks[track] });
        display(track, 'volume', mutedTracks[track] ? -24 : volumes[track]);
      }
    },
    volume(track, value) {
      if (!PERFORMANCE_TRACKS.includes(track) || !Number.isFinite(value)) return;
      const volume = Math.max(-24, Math.min(6, value));
      manual[track].volume = volume; manual[track].muted = false; apply(track, 'volume', volume);
    },
    cutoff(track, value) {
      if (!PERFORMANCE_TRACKS.includes(track) || !Number.isFinite(value)) return;
      const cutoff = Math.max(100, Math.min(20000, value)); manual[track].cutoff = cutoff; apply(track, 'cutoff', cutoff);
    },
    reverb(value) {
      if (!Number.isFinite(value)) return;
      for (const track of state.selectedTracks) { manual[track].reverb = Math.max(0, Math.min(1, value)); apply(track, 'reverb', manual[track].reverb); }
    },
    reset(filters = false) {
      resetHolds();
      if (filters) for (const track of PERFORMANCE_TRACKS) for (const p of ['cutoff','reverb']) {
        manual[track][p] = EFFECT_DEFAULTS[p]; audio.setPerformanceEffect(track, effectValues(p, EFFECT_DEFAULTS[p])); display(track, p, EFFECT_DEFAULTS[p]);
      }
    },
  };
}
