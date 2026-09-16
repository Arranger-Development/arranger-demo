import {
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';

function clampFlatStep(flatStep, totalBars) {
  return Math.max(0, Math.min((totalBars * STEPS_PER_BAR) - 1, flatStep));
}

function getTimelinePlayheadSeekPosition(clientX, rect, totalBars = TOTAL_BARS) {
  const left = Number(rect?.left);
  const width = Number(rect?.width);

  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
    return null;
  }

  const ratio = (clientX - left) / width;
  const flatStep = clampFlatStep(Math.round(ratio * (totalBars * STEPS_PER_BAR)), totalBars);

  return {
    bar: Math.floor(flatStep / STEPS_PER_BAR),
    flatStep,
    step: flatStep % STEPS_PER_BAR,
  };
}

export { getTimelinePlayheadSeekPosition };
