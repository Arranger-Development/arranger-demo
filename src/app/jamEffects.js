import { PERFORMANCE_TRACKS } from './performanceModel.js';
import { createRepeatPadController } from './repeatPadController.js';

// One shared owner across screen and hardware; stale releases cannot end a newer press.
export function createJamEffects(audio) {
  let state = { selectedTrack: 'drums', cutoffs: Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, 20000])) };
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => fn());
  const repeat = createRepeatPadController(values => audio.setPerformanceEffect(state.selectedTrack, values));
  return {
    repeat, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    select(track) {
      if (!PERFORMANCE_TRACKS.includes(track) || state.selectedTrack === track) return;
      repeat.reset(); state = { ...state, selectedTrack: track }; notify();
    },
    cutoff(track, value) {
      if (!PERFORMANCE_TRACKS.includes(track) || !Number.isFinite(value)) return;
      const cutoff = Math.max(100, Math.min(20000, value));
      audio.setPerformanceEffect(track, { cutoff });
      state = { ...state, cutoffs: { ...state.cutoffs, [track]: cutoff } }; notify();
    },
    reset(filters = false) {
      repeat.reset();
      if (filters) {
        for (const track of PERFORMANCE_TRACKS) audio.setPerformanceEffect(track, { cutoff: 20000 });
        state = { ...state, cutoffs: Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, 20000])) }; notify();
      }
    },
  };
}
