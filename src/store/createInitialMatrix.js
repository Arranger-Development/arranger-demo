import { STEPS_PER_BAR, TOTAL_BARS, TRACK_IDS } from '../domain/musicConstants.js';

function createEmptyBar() {
  return Array.from({ length: STEPS_PER_BAR }, () => null);
}

function createEmptyTrackMatrix(totalBars = TOTAL_BARS) {
  return Array.from({ length: totalBars }, () => createEmptyBar());
}

export default function createInitialMatrix(totalBars = TOTAL_BARS) {
  return Object.fromEntries(TRACK_IDS.map((trackId) => [trackId, createEmptyTrackMatrix(totalBars)]));
}

export { createEmptyTrackMatrix };
