import {
  BEATS_PER_BAR,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';

const STEPS_PER_BEAT = STEPS_PER_BAR / BEATS_PER_BAR;

function formatDisplayPosition(bar, step, totalBars = TOTAL_BARS) {
  if (
    !Number.isInteger(bar)
    || bar < 0
    || bar >= totalBars
    || !Number.isInteger(step)
    || step < 0
    || step >= STEPS_PER_BAR
  ) {
    return '';
  }

  const beat = Math.floor(step / STEPS_PER_BEAT);
  const beatStep = step % STEPS_PER_BEAT;
  return `${bar + 1}.${beat + 1}.${beatStep + 1}`;
}

export { formatDisplayPosition };
