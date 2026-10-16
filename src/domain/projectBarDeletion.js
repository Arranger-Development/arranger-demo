import { createClipId, formatClipName } from './clipHelpers.js';
import { getTotalBars } from './projectLength.js';
import { STEPS_PER_BAR } from './musicConstants.js';

export function isValidBarDeletion(state, start, end) {
  return Number.isInteger(start) && Number.isInteger(end)
    && start >= 0 && start <= end && end < getTotalBars(state);
}

// Build the complete ripple edit before publishing it to the store.
export function createProjectBarDeletionPatch(state, start, end) {
  if (!isValidBarDeletion(state, start, end)) return null;
  const previousBars = getTotalBars(state), count = end - start + 1;
  const totalBars = Math.max(1, previousBars - count);
  const mapBar = bar => Math.min(totalBars - 1, bar < start ? bar : bar > end ? bar - count : start);
  const position = (bar, step) => ({
    bar: mapBar(bar),
    step: (bar >= start && bar <= end) || bar - count >= totalBars ? 0 : step,
  });
  const matrix = Object.fromEntries(Object.entries(state.matrix).map(([track, bars]) => {
    const remaining = [...bars.slice(0, start), ...bars.slice(end + 1, previousBars)];
    return [track, remaining.length ? remaining : [Array(STEPS_PER_BAR).fill(null)]];
  }));
  const ids = [], byId = {};
  let selectedClipId = null;
  for (const id of state.clips.ids) {
    const clip = state.clips.byId[id];
    if (!clip || (clip.bar >= start && clip.bar <= end)) continue;
    const bar = mapBar(clip.bar);
    const moved = { ...clip, bar, id: createClipId(clip.trackId, bar),
      name: clip.customName ? clip.name : formatClipName(clip.trackId, bar) };
    ids.push(moved.id); byId[moved.id] = moved;
    if (id === state.selectedClipId) selectedClipId = moved.id;
  }
  const current = position(state.currentBar, state.currentStep);
  const seek = position(state.seekBar, state.seekStep);
  const patch = { totalBars, matrix, clips: { ids, byId }, selectedClipId,
    selectedBar: mapBar(state.selectedBar), currentBar: current.bar, currentStep: current.step,
    seekBar: seek.bar, seekStep: seek.step };
  // Deleting the sole already-empty bar is a no-op, not a new undo checkpoint.
  if (previousBars === 1 && !state.clips.ids.length
    && Object.values(state.matrix).every(bars => bars[0]?.every(cell => cell === null))
    && state.currentStep === 0 && state.seekStep === 0) return null;
  return patch;
}
