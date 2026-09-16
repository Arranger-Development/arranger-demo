const BPM_MIN = 40;
const BPM_MAX = 240;
const BPM_STEP = 1;
const BPM_PRESETS = Object.freeze([76, 88, 96]);
const RECOMMENDED_BPM = 88;

function normalizeBpm(value, fallback = RECOMMENDED_BPM) {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber)
    ? Math.round(fallbackNumber)
    : RECOMMENDED_BPM;
  const number = Number(value);
  const normalized = Number.isFinite(number)
    ? Math.round(number)
    : normalizedFallback;

  return Math.min(BPM_MAX, Math.max(BPM_MIN, normalized));
}

export {
  BPM_MAX,
  BPM_MIN,
  BPM_PRESETS,
  BPM_STEP,
  RECOMMENDED_BPM,
  normalizeBpm,
};
