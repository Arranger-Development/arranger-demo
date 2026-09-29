import { PERFORMANCE_SAMPLE_BANKS } from '../data/performanceTimbres.js';
import { loopRepeat } from './loopOrder.js';

// Read musical transitions before the scheduler reads events at the boundary.
export function createSessionPlayback(audio, notify = () => {}) {
  let generation = 0, current = null, pending = null, sequence = [], sourceSnapshot = null;
  let startStep = 0, lastStep = -1, cycle = 1, mode = 'stopped', loading = false, bpm = 100, audible = null;
  const isActive = () => mode !== 'stopped';
  const emit = (extra = {}) => notify({ mode: audible?.mode ?? mode, loading, requestedId: current?.id ?? null,
    playingId: audible?.id ?? null, pendingId: pending?.id ?? null, cycle: audible?.cycle ?? cycle, ...extra });
  const targetFor = snapshot => ({ id: snapshot.id, snapshot: structuredClone(snapshot), repeat: loopRepeat(snapshot) });
  const makeSource = () => ({ matrix: current.snapshot.matrix, totalBars: current.snapshot.totalBars, stepOffset: startStep });
  function stop() {
    generation++; mode = 'stopped'; loading = false; current = pending = audible = null; sequence = [];
    void audio.stop(); audio.stopAllVoices(); audio.resetPerformanceEffects?.(); emit();
  }
  function change(target, absoluteStep) {
    current = target; startStep = absoluteStep; cycle = 1;
    if (target.nextMode) { mode = target.nextMode; if (mode === 'jam') sequence = []; }
    sourceSnapshot = makeSource();
  }
  function finish() {
    const request = generation;
    return { done: true, onAudible: () => {
      if (request !== generation) return;
      mode = 'stopped'; loading = false; audible = current = pending = null; sequence = [];
      audio.resetPerformanceEffects?.(); emit();
    } };
  }
  function source(absoluteStep) {
    if (!current) return { done: true };
    lastStep = absoluteStep;
    if (pending && absoluteStep >= pending.at) { const next = pending; pending = null; change(next, absoluteStep); }
    if (absoluteStep >= startStep + current.snapshot.totalBars * 16 * cycle) {
      if (current.repeat === null || cycle < current.repeat) cycle++;
      else {
        const next = mode === 'sequence' ? sequence[sequence.findIndex(item => item.id === current.id) + 1] : null;
        if (next) change(next, absoluteStep); else return finish();
      }
    }
    const scheduled = { id: current.id, startStep, totalSteps: current.snapshot.totalBars * 16, cycle, snapshot: current.snapshot, mode };
    const request = generation;
    return { ...sourceSnapshot, releaseVoices: absoluteStep === startStep,
      onAudible: () => { if (request !== generation) return; audible = scheduled; loading = false; emit(); } };
  }
  async function start(nextMode, targets, tempo) {
    stop(); const request = ++generation;
    mode = nextMode; bpm = tempo; loading = true; cycle = 1; lastStep = -1; startStep = 0;
    current = targets[0]; sequence = nextMode === 'sequence' ? targets : []; sourceSnapshot = makeSource(); emit();
    try {
      await audio.preparePerformanceEffects?.();
      if (request !== generation) return;
      const banks = Object.values(PERFORMANCE_SAMPLE_BANKS);
      const started = await audio.play({ bpm, bar: 0, step: 0, totalBars: current.snapshot.totalBars,
        matrixSource: () => current?.snapshot.matrix ?? targets[0].snapshot.matrix,
        playbackSource: step => request === generation ? source(step) : { done: true },
        melodyTimbreIds: ['piano', 'yangqin', 'blues'],
        additionalDrumTimbres: banks.filter(bank => bank.track === 'drums').map(bank => ({ trackId: bank.track, timbreId: bank.id })),
        additionalTimbres: ['piano', 'yangqin', 'blues'].flatMap(timbreId => [
          { trackId: 'chord', timbreId, playbackMode: 'natural' }, { trackId: 'melody', timbreId, playbackMode: 'natural' },
        ]).concat(banks.filter(bank => bank.track !== 'drums').map(bank => ({ trackId: bank.track, timbreId: bank.id, playbackMode: 'natural' }))),
      });
      if (request !== generation) return;
      if (!started) throw new Error('音频未能启动，请重试。');
      audio.setTempo(bpm); loading = false; emit();
    } catch (error) { if (request === generation) { stop(); emit({ error: error.message }); } }
  }
  return {
    stop, isActive,
    setTempo(value) { bpm = value; audio.setTempo(value); },
    launch(snapshot, tempo, { edit = false } = {}) {
      if (!snapshot) { stop(); return; }
      const target = targetFor(snapshot);
      if (!isActive()) { void start('jam', [target], tempo); return; }
      if (!edit && pending?.id === target.id) { pending = null; emit(); return; }
      if (!edit && mode === 'jam' && current?.id === target.id) { stop(); return; }
      const nextMode = edit && mode === 'sequence' ? 'sequence' : 'jam';
      if (edit && mode === 'sequence') sequence = sequence.map(item => item.id === target.id ? target : item);
      pending = { ...target, nextMode, at: pending?.id === target.id ? pending.at : (Math.floor(Math.max(-1, lastStep) / 16) + 1) * 16 };
      emit();
    },
    sequence(snapshots, tempo) {
      const targets = snapshots.filter(Boolean).map(targetFor);
      if (!targets.length) return false;
      void start('sequence', targets, tempo); return true;
    },
    getProgress() {
      if (!audible || !isActive()) return null;
      const absolute = audio.getAbsolutePlaybackStep?.();
      if (!Number.isFinite(absolute)) return null;
      const localStep = Math.max(0, absolute - audible.startStep);
      return { ...audible, localStep, fraction: (localStep % audible.totalSteps) / audible.totalSteps };
    },
    getBeatPhase() { return ((audio.getAbsolutePlaybackStep?.() ?? 0) % 4) / 4; },
  };
}
