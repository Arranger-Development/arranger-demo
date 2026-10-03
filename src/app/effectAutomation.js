import { PERFORMANCE_TRACKS as TRACKS } from './performanceModel.js';

export const EFFECT_PARAMETERS = ['volume', 'cutoff', 'repeat'];
const validValue = (parameter, value) => parameter === 'repeat'
  ? value === null || [4, 8, 16].includes(value)
  : Number.isFinite(value) && value >= (parameter === 'volume' ? -24 : 100) && value <= (parameter === 'volume' ? 6 : 20000);

// Optional v4 section field. A bad lane cannot discard otherwise valid music.
export function normalizeEffectAutomation(value) {
  if (value?.version !== 1 || !Number.isInteger(value.cycleSteps) || value.cycleSteps < 16 || value.cycleSteps > 4096) return undefined;
  const tracks = {};
  for (const track of TRACKS) {
    const lanes = {};
    for (const parameter of EFFECT_PARAMETERS) {
      const lane = value.tracks?.[track]?.[parameter];
      if (!lane || !validValue(parameter, lane.initial) || !Array.isArray(lane.points)) continue;
      const points = lane.points.filter(p => p && Number.isFinite(p.step) && p.step >= 0 && p.step <= value.cycleSteps && validValue(parameter, p.value))
        .map(p => ({ step: p.step, value: p.value })).sort((a, b) => a.step - b.step);
      lanes[parameter] = { initial: lane.initial, points: simplifyEffectPoints(points) };
    }
    if (Object.keys(lanes).length) tracks[track] = lanes;
  }
  return Object.keys(tracks).length ? { version: 1, cycleSteps: value.cycleSteps, tracks } : undefined;
}

// Remove identical consecutive values, retaining the last point of each run.
// Sub-step timing and changes of direction are never quantized away.
export function simplifyEffectPoints(points) {
  const result = [];
  for (const point of points) {
    if (result.at(-1)?.step === point.step) result.pop();
    if (result.length > 1 && result.at(-1).value === point.value && result.at(-2).value === point.value) result.pop();
    result.push({ ...point });
  }
  return result;
}

export function effectLaneEvents(automation, track, parameter) {
  const lane = automation?.tracks?.[track]?.[parameter];
  if (!lane) return [];
  const points = [{ step: 0, value: lane.initial }, ...lane.points];
  if (parameter === 'repeat') points.push({ step: automation.cycleSteps, value: null });
  return points;
}

export function mergeEffectTake(before, take) {
  if (!Object.keys(take.lanes).length) return before;
  const tracks = structuredClone(before?.tracks ?? {});
  for (const [key, lane] of Object.entries(take.lanes)) {
    const [track, parameter] = key.split(':');
    tracks[track] ??= {};
    tracks[track][parameter] = { initial: lane.initial, points: simplifyEffectPoints(lane.points) };
    // Each repeater take releases at its own end, including after length edits.
    if (parameter === 'repeat') tracks[track][parameter].points.push({ step: take.length, value: null });
  }
  // Keep out-of-range old points when music is shortened, for later expansion.
  return { version: 1, cycleSteps: Math.max(before?.cycleSteps ?? 0, take.length), tracks };
}
