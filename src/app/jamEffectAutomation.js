import { MOMENTARY_EFFECTS, EFFECT_DEFAULTS, effectValues } from './jamEffectParameters.js';
import { PERFORMANCE_TRACKS as TRACKS } from './performanceModel.js';
import { EFFECT_PARAMETERS, effectLaneEvents, mergeEffectTake, normalizeEffectAutomation } from './effectAutomation.js';

const keyOf = (track, parameter) => `${track}:${parameter}`;
// The audio scheduler supplies short, timestamped windows. Keeping its lookahead
// lets a live touch cancel already queued automation, including at a loop seam.
export function createJamEffectAutomation(audio, effects, onComplete = () => {}) {
  let state = { phase: 'idle', id: null }, take = null, windows = [], epoch = 0;
  let audible = null, active = false, suppressed = false, suspended = false, boundary = null;
  const overrides = new Map(), revisions = new Map(), replacements = new Map(), listeners = new Set();
  const now = () => audio.immediate?.() ?? 0;
  const notify = (next) => { state = next; listeners.forEach(fn => fn()); };
  const baseline = (track, parameter) => {
    const values = effects.getManual(track);
    return MOMENTARY_EFFECTS.includes(parameter) ? EFFECT_DEFAULTS[parameter] : parameter === 'volume' && values.muted ? -24 : values[parameter];
  };
  const dataFor = w => take?.id === w.snapshot.id && w.absoluteStep >= take.end
    ? mergeEffectTake(take.before, take) : replacements.has(w.snapshot.id) ? replacements.get(w.snapshot.id) : w.snapshot.effectAutomation;
  function cancel(track, parameter, time = now()) {
    const key = keyOf(track, parameter);
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    audio.cancelPerformanceEffect?.(track, parameter, time);
  }
  function put(track, parameter, value, time, bpm) {
    const key = keyOf(track, parameter), revision = revisions.get(key) ?? 0, request = epoch;
    const values = effectValues(parameter, value, bpm);
    audio.schedulePerformanceEffect?.(track, values, time);
    audio.schedulePerformanceNotification?.(time, () => {
      if (request === epoch && revision === (revisions.get(key) ?? 0) && active) effects.display(track, parameter, value);
    });
  }
  function scheduleLane(w, track, parameter, from = -Infinity) {
    if (suspended && parameter !== 'volume') return;
    const key = keyOf(track, parameter), override = overrides.get(key);
    if (override && override.id === w.snapshot.id && override.startStep === w.startStep && w.cycleStart < override.until) return;
    if (MOMENTARY_EFFECTS.includes(parameter) && audible?.id === w.snapshot.id && audible?.startStep === w.startStep && effects.isHeld(track, parameter)) return;
    const data = dataFor(w), local = w.absoluteStep - w.cycleStart;
    let events = effectLaneEvents(data, track, parameter);
    if (!events.length) events = [{ step: 0, value: baseline(track, parameter) }];
    for (const event of events) {
      if (event.step < local || event.step >= local + 1 || event.step >= w.length) continue;
      const time = w.time + (event.step - local) * w.duration;
      if (time >= from) put(track, parameter, event.value, time, w.bpm);
    }
    // Even malformed legacy records cannot leave a repeater held across a seam.
  }
  function reschedule(track, parameter) {
    const time = now(); cancel(track, parameter, time);
    for (const w of windows) if (w.time + w.duration >= time) scheduleLane(w, track, parameter, time);
  }
  function manual(track, parameter, value) {
    if (suppressed || !active) return;
    const absolute = audio.getAbsolutePlaybackStep?.();
    if (!Number.isFinite(absolute) || !audible) return;
    const length = audible.totalSteps;
    const cycleStart = audible.startStep + Math.floor(Math.max(0, absolute - audible.startStep) / length) * length;
    overrides.set(keyOf(track, parameter), { until: cycleStart + length, id: audible.id, startStep: audible.startStep });
    if (take && absolute >= take.start && absolute < take.end) {
      const key = keyOf(track, parameter);
      take.lanes[key] ??= { initial: take.initial[key], points: [] };
      take.lanes[key].points.push({ step: absolute - take.start, value });
    }
    reschedule(track, parameter);
  }
  effects.onManual(manual);
  function cancelTake() {
    if (!take) return;
    take = null; notify({ phase: 'idle', id: null });
    for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) reschedule(track, parameter);
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    isRecording: () => Boolean(take),
    start() { active = true; suspended = false; boundary = null; },
    resume() { suspended = false; },
    arm(snapshot, start) {
      const before = normalizeEffectAutomation(replacements.has(snapshot.id) ? replacements.get(snapshot.id) : snapshot.effectAutomation), length = snapshot.totalBars * 16;
      take = { id: snapshot.id, before, start, end: start + length, length, lanes: {}, initial: {} };
      for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) {
        take.initial[keyOf(track, parameter)] = before?.tracks?.[track]?.[parameter]?.initial ?? baseline(track, parameter);
      }
      notify({ phase: 'armed', id: snapshot.id });
    },
    cancelTake,
    schedule({ snapshot, startStep, cycle, absoluteStep, time, bpm }) {
      if (!Number.isFinite(time)) return;
      const length = snapshot.totalBars * 16;
      const w = { snapshot, startStep, absoluteStep, time, bpm, duration: 60 / bpm / 4, length, cycleStart: startStep + (cycle - 1) * length };
      const nextBoundary = `${snapshot.id}:${startStep}`;
      if (boundary !== nextBoundary) {
        boundary = nextBoundary;
        replacements.delete(snapshot.id);
        // Boundary cancellation is timed, so the old loop remains audible until
        // the requested beat rather than stopping at scheduler lookahead time.
        for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) audio.cancelPerformanceEffect?.(track, parameter, time);
        for (const track of TRACKS) for (const p of MOMENTARY_EFFECTS) put(track, p, EFFECT_DEFAULTS[p], time, bpm);
        overrides.clear();
      }
      windows = windows.filter(item => item.time + item.duration >= now()); windows.push(w);
      for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) scheduleLane(w, track, parameter);
    },
    audible(position, absoluteStep) {
      const switched = audible && (audible.id !== position.id || audible.startStep !== position.startStep);
      audible = position;
      if (switched) { suppressed = true; effects.resetHolds(true); suppressed = false; }
      if (!take) return;
      if (absoluteStep >= take.end) {
        const completed = take, value = mergeEffectTake(completed.before, completed);
        replacements.set(completed.id, value); take = null;
        notify({ phase: 'idle', id: null });
        if (Object.keys(completed.lanes).length) onComplete(completed.id, value);
      } else if (absoluteStep >= take.start && state.phase !== 'recording') notify({ phase: 'recording', id: take.id });
    },
    clear(id) {
      suppressed = true; effects.resetHolds(); suppressed = false;
      replacements.set(id, undefined);
      for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) { reschedule(track, parameter); effects.restore(track, parameter); }
    },
    releaseRepeats() {
      suppressed = true; effects.resetHolds(); suppressed = false;
      for (const track of TRACKS) for (const p of MOMENTARY_EFFECTS) {
        manual(track, p, EFFECT_DEFAULTS[p]); cancel(track, p);
        audio.setPerformanceEffect(track, effectValues(p, EFFECT_DEFAULTS[p])); effects.display(track, p, EFFECT_DEFAULTS[p]);
      }
    },
    suspend() {
      cancelTake(); suspended = true;
      suppressed = true; effects.reset(true); suppressed = false;
      for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS.filter(p => p !== 'volume')) {
        cancel(track, parameter);
        audio.setPerformanceEffect(track, effectValues(parameter, EFFECT_DEFAULTS[parameter]));
        effects.display(track, parameter, EFFECT_DEFAULTS[parameter]);
      }
    },
    stop() {
      epoch++; active = false; take = null; audible = null; windows = []; overrides.clear(); replacements.clear(); boundary = null;
      suppressed = true; effects.resetHolds(); suppressed = false;
      for (const track of TRACKS) for (const parameter of EFFECT_PARAMETERS) { cancel(track, parameter); effects.restore(track, parameter); }
      notify({ phase: 'idle', id: null });
    },
  };
}
