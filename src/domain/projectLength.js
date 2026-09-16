import { STEPS_PER_BAR, TOTAL_BARS } from './musicConstants.js';

export const MAX_PROJECT_BARS = 20;

export function getTotalBars(state) {
  const bars = state?.totalBars;
  return Number.isInteger(bars) && bars >= 2 && bars <= MAX_PROJECT_BARS ? bars : TOTAL_BARS;
}

// Empty timeline positions are editing space, not part of the playback cycle.
export function getTimelineBars(state) {
  return Math.max(TOTAL_BARS, getTotalBars(state));
}

// Return a patch so growth and the clip operation can be applied atomically.
export function createProjectLengthPatch(state, requiredBars) {
  if (!Number.isInteger(requiredBars) || requiredBars > MAX_PROJECT_BARS
    || requiredBars <= getTotalBars(state)) return {};

  return {
    totalBars: requiredBars,
    matrix: Object.fromEntries(Object.entries(state.matrix).map(([trackId, bars]) => [
      trackId,
      [...bars, ...Array.from({ length: Math.max(0, requiredBars - bars.length) },
        () => Array(STEPS_PER_BAR).fill(null))],
    ])),
  };
}

// Matrix-only editing helpers also work with legacy eight-bar projects.
export function getMatrixBars(matrix) {
  const track = Object.values(matrix ?? {}).find(Array.isArray);
  return track?.length || TOTAL_BARS;
}

export function getClipBankStart(selectedBar = 0) {
  return Math.floor(Math.max(0, selectedBar) / 8) * 8;
}
