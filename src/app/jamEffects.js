import { PERFORMANCE_TRACKS } from './performanceModel.js';
import { createRepeatPadController } from './repeatPadController.js';

const defaults = value => Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, value]));
// Separate the user's mix from the audible automation display. Only manual mix
// changes are persisted/exported; automation never feeds back into its recorder.
export function createJamEffects(audio) {
  let state = { selectedTrack: 'drums', cutoffs: defaults(20000), volumes: defaults(0), mutedTracks: defaults(false), repeats: defaults(null) };
  const manual = Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, { volume: 0, muted: false, cutoff: 20000 }]));
  const listeners = new Set(); let onManual = () => {};
  const notify = () => listeners.forEach(fn => fn());
  const display = (track, parameter, value) => {
    const field = { volume: 'volumes', cutoff: 'cutoffs', repeat: 'repeats' }[parameter];
    state = { ...state, [field]: { ...state[field], [track]: value } };
    if (parameter === 'volume') state.mutedTracks = { ...state.mutedTracks, [track]: value <= -24 };
    notify();
  };
  const repeat = createRepeatPadController(values => {
    const track = state.selectedTrack;
    onManual(track, 'repeat', values.held ? values.division : null);
    audio.setPerformanceEffect(track, values);
    display(track, 'repeat', values.held ? values.division : null);
  });
  return {
    repeat, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    onManual(fn) { onManual = fn; }, display,
    getManual: track => ({ ...manual[track] }),
    restore(track, parameter) {
      const value = parameter === 'repeat' ? null : parameter === 'volume' && manual[track].muted ? -24 : manual[track][parameter];
      audio.setPerformanceEffect(track, parameter === 'repeat' ? { held: false } : parameter === 'volume' ? { volume: value, muted: manual[track].muted } : { cutoff: value });
      display(track, parameter, value);
    },
    select(track) {
      if (!PERFORMANCE_TRACKS.includes(track) || state.selectedTrack === track) return;
      if (!repeat.getSnapshot() && state.repeats[state.selectedTrack] !== null) {
        onManual(state.selectedTrack, 'repeat', null);
        audio.setPerformanceEffect(state.selectedTrack, { held: false });
        display(state.selectedTrack, 'repeat', null);
      }
      repeat.reset(); state = { ...state, selectedTrack: track }; notify();
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
      manual[track].volume = volume; manual[track].muted = false;
      onManual(track, 'volume', volume);
      audio.setPerformanceEffect(track, { volume, muted: false }); display(track, 'volume', volume);
    },
    cutoff(track, value) {
      if (!PERFORMANCE_TRACKS.includes(track) || !Number.isFinite(value)) return;
      const cutoff = Math.max(100, Math.min(20000, value)); manual[track].cutoff = cutoff;
      onManual(track, 'cutoff', cutoff);
      audio.setPerformanceEffect(track, { cutoff }); display(track, 'cutoff', cutoff);
    },
    reset(filters = false) {
      repeat.reset();
      if (filters) {
        for (const track of PERFORMANCE_TRACKS) { manual[track].cutoff = 20000; audio.setPerformanceEffect(track, { cutoff: 20000 }); }
        state = { ...state, cutoffs: defaults(20000) }; notify();
      }
    },
  };
}
