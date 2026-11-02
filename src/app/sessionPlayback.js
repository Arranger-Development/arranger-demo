import { PERFORMANCE_SAMPLE_BANKS } from '../data/performanceTimbres.js';
import { loopRepeat } from './loopOrder.js';
import { createJamTrackPlayback } from './jamTrackPlayback.js';

// Read musical transitions before the scheduler reads events at the boundary.
export function createSessionPlayback(audio, notify = () => {}, automation) {
  let generation = 0, current = null, pending = null, sequence = [], sourceSnapshot = null;
  let startStep = 0, lastStep = -1, cycle = 1, mode = 'stopped', loading = false, bpm = 100, audible = null;
  let recordingStopAt = null, previousRepeat = null;
  let requestVersion = 0, queuedRequest = null, lastAudibleStep = -1;
  let jam = null, finishing = false;
  const isActive = () => mode !== 'stopped';
  const emit = (extra = {}) => notify({ mode: audible?.mode ?? mode, loading, requestedId: current?.id ?? null,
    playingId: audible?.id ?? null, pendingId: pending?.id ?? null, cycle: audible?.cycle ?? cycle,
    requestVersion,
    playingPhraseIds: { ...audible?.snapshot.phraseIds },
    queuedPhraseIds: queuedRequest ? { ...queuedRequest.snapshot.phraseIds } : null,
    ...(jam?.state()),
    ...extra });
  const targetFor = snapshot => ({ id: snapshot.id, snapshot: structuredClone(snapshot), repeat: loopRepeat(snapshot), revision: ++requestVersion });
  const makeSource = () => ({ matrix: current.snapshot.matrix, totalBars: current.snapshot.totalBars, phraseBars: current.snapshot.phraseBars, stepOffset: startStep });
  function stop() {
    generation++; automation?.stop(); recordingStopAt = null; mode = 'stopped'; loading = finishing = false; current = pending = audible = queuedRequest = null; jam = null; sequence = []; lastAudibleStep = -1;
    void audio.stop(); audio.stopAllVoices(); audio.resetPerformanceEffects?.(); emit();
  }
  function change(target, absoluteStep) {
    // Sequence entries were created up front; an edited earlier entry may have a
    // newer revision. Assign the next audible transition its own monotonic revision.
    if (target.revision < current.revision) target = { ...target, revision: ++requestVersion };
    recordingStopAt = null; current = target;
    if (!target.preservePhase) startStep = absoluteStep;
    cycle = Math.floor((absoluteStep - startStep) / (target.snapshot.totalBars * 16)) + 1;
    if (target.nextMode) { mode = target.nextMode; if (mode === 'jam') sequence = []; }
    sourceSnapshot = makeSource();
  }
  function finish() {
    finishing = true;
    const request = generation;
    return { done: true, onAudible: () => {
      if (request !== generation) return;
      mode = 'stopped'; loading = finishing = false; audible = current = pending = queuedRequest = null; jam = null; sequence = [];
      automation?.stop(); audio.resetPerformanceEffects?.(); emit();
    } };
  }
  function source(absoluteStep, time) {
    if (!current) return { done: true };
    lastStep = absoluteStep;
    if (jam) {
      const runtime = jam, scheduled = runtime.read(absoluteStep), request = generation;
      if (scheduled.done) return finish();
      return { ...scheduled, onAudible() {
        if (request !== generation || jam !== runtime || !scheduled.confirm()) return;
        const progress = runtime.progress(absoluteStep);
        audible = { id: current.id, snapshot: progress.snapshot, revision: requestVersion, startStep: 0,
          totalSteps: progress.snapshot.totalBars * 16, cycle: 1, mode };
        queuedRequest = null; loading = false;
        emit({ bar: Math.floor(absoluteStep / 16) % progress.snapshot.totalBars, step: absoluteStep % 16,
          trackPositions: progress.trackPositions });
      } };
    }
    if (recordingStopAt !== null && absoluteStep >= recordingStopAt) return finish();
    if (pending && absoluteStep >= pending.at) { const next = pending; pending = null; change(next, absoluteStep); }
    if (absoluteStep >= startStep + current.snapshot.totalBars * 16 * cycle) {
      if (current.repeat === null || cycle < current.repeat) cycle++;
      else {
        const next = mode === 'sequence' ? sequence[sequence.findIndex(item => item.id === current.id) + 1] : null;
        if (next) change(next, absoluteStep); else return finish();
      }
    }
    const scheduled = { id: current.id, revision: current.revision, startStep, totalSteps: current.snapshot.totalBars * 16, cycle, snapshot: current.snapshot, mode };
    automation?.schedule({ ...scheduled, absoluteStep, time, bpm });
    const request = generation;
    return { ...sourceSnapshot, releaseVoices: absoluteStep === startStep,
      onAudible: () => { if (request !== generation || absoluteStep < lastAudibleStep || scheduled.revision < (audible?.revision ?? -1)) return;
        lastAudibleStep = absoluteStep; audible = scheduled;
        if (queuedRequest?.revision === scheduled.revision) queuedRequest = null;
        automation?.audible(scheduled, absoluteStep); loading = false;
        const localStep = absoluteStep - scheduled.startStep;
        emit({ bar: Math.floor(localStep / 16) % scheduled.snapshot.totalBars, step: localStep % 16 }); } };
  }
  async function start(nextMode, targets, tempo, record = false, editorOverlay = false) {
    stop(); const request = ++generation;
    mode = nextMode; bpm = tempo; loading = true; cycle = 1; lastStep = -1; startStep = 0;
    current = targets[0]; queuedRequest = current;
    if (nextMode === 'jam' && current.id === 'jam-current-combination') {
      jam = createJamTrackPlayback(() => ++requestVersion);
      if (editorOverlay) jam.audition(current.snapshot, 0, { restart: true });
      else jam.replace(current.snapshot, 0);
    }
    automation?.start();
    if (record) {
      previousRepeat = current.repeat; current.repeat = null;
      automation?.arm(current.snapshot, 0);
      recordingStopAt = current.snapshot.kind === 'transition' ? current.snapshot.totalBars * 32 : null;
    }
    sequence = nextMode === 'sequence' ? targets : []; sourceSnapshot = makeSource(); emit();
    try {
      await audio.preparePerformanceEffects?.();
      if (request !== generation) return;
      const banks = Object.values(PERFORMANCE_SAMPLE_BANKS);
      const started = await audio.play({ bpm, bar: 0, step: 0, totalBars: current.snapshot.totalBars,
        matrixSource: () => current?.snapshot.matrix ?? targets[0].snapshot.matrix,
        playbackSource: (step, time) => request === generation ? source(step, time) : { done: true },
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
    stop, isActive, isReady: () => isActive() && !loading,
    getDesiredPhraseIds: () => jam?.desiredIds() ?? { drums: null, chord: null, bass: null, melody: null },
    getQueuedPhraseIds: () => jam?.state().queuedPhraseIds ?? null,
    hasJamPlayback: () => Boolean(jam?.hasWork()),
    updatePhrase(snapshot,trackId,id,options) {
      if (!jam || !isActive() || finishing || !snapshot) return;
      jam.updatePhrase(snapshot,trackId,id,lastStep+1,options);emit();
    },
    toggleTrack(snapshot, trackId, tempo, { restart = false } = {}) {
      if (automation?.isRecording() || !snapshot) return;
      if (!isActive() || !jam || finishing) { void start('jam', [targetFor(snapshot)], tempo); return; }
      jam.toggle(snapshot, trackId, (Math.floor(lastStep / 16) + 1) * 16, lastStep + 1, restart);
      if (!jam.hasWork() && lastStep < 0) stop(); else emit();
    },
    removeTrack(trackId, id) {
      if (!jam) return;
      jam.remove(trackId, id, lastStep + 1);
      if (!jam.hasWork() && lastStep < 0) stop(); else emit();
    },
    audition(snapshot, tempo, { restart = false } = {}) {
      if (!isActive() || !jam || finishing) { void start('jam', [targetFor(snapshot)], tempo, false, true); return; }
      jam.audition(snapshot, lastStep + 1, { restart }); emit();
    },
    resumeJam() { if (jam) { jam.audition(null, lastStep + 1); emit(); } },
    record(snapshot, tempo) {
      if (!snapshot || loading || automation?.isRecording()) return false;
      if (!isActive() || current?.id !== snapshot.id || audible?.id !== current.id) { void start('jam', [targetFor(snapshot)], tempo, true); return true; }
      const length = current.snapshot.totalBars * 16;
      const absolute = Math.max(audio.getAbsolutePlaybackStep?.() ?? 0, lastStep);
      const at = startStep + (Math.floor((absolute - startStep) / length) + 1) * length;
      pending = queuedRequest = null; sequence = []; mode = 'jam'; previousRepeat = current.repeat; current.repeat = null;
      automation.resume(); automation.arm(current.snapshot, at);
      recordingStopAt = current.snapshot.kind === 'transition' ? at + length * 2 : null;
      emit(); return true;
    },
    cancelRecording() { automation?.cancelTake(); if (current) current.repeat = previousRepeat; recordingStopAt = null; },
    setTempo(value) { bpm = value; audio.setTempo(value); },
    launch(snapshot, tempo, { edit = false, quantize = 'bar', preservePhase = false } = {}) {
      if (automation?.isRecording()) return;
      if (!snapshot) { stop(); return; }
      const target = targetFor(snapshot);
      if (!isActive() || finishing) { void start('jam', [target], tempo); return; }
      if (jam && snapshot.id === 'jam-current-combination') {
        const quantum = quantize === 'step' ? 1 : 16;
        jam.replace(target.snapshot, (Math.floor(lastStep / quantum) + 1) * quantum, preservePhase);
        emit(); return;
      }
      if (!edit && pending?.id === target.id) { pending = queuedRequest = null; emit(); return; }
      if (!edit && mode === 'jam' && current?.id === target.id) { stop(); return; }
      automation?.resume();
      const nextMode = edit && mode === 'sequence' ? 'sequence' : 'jam';
      if (edit && mode === 'sequence') sequence = sequence.map(item => item.id === target.id ? target : item);
      const quantum = quantize === 'step' ? 1 : 16;
      const nextBoundary = (Math.floor(Math.max(-1, lastStep) / quantum) + 1) * quantum;
      // A step edit (including deselection) must not inherit a queued bar switch's delay.
      const at = pending?.id === target.id ? edit && quantize === 'step' ? Math.min(pending.at,nextBoundary) : pending.at : nextBoundary;
      pending = { ...target, nextMode, preservePhase, at };
      queuedRequest = pending;
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
      return { ...audible, localStep, fraction: (localStep % audible.totalSteps) / audible.totalSteps,
        ...(jam?.progress(absolute)) };
    },
    getBeatPhase() { return ((audio.getAbsolutePlaybackStep?.() ?? 0) % 4) / 4; },
  };
}
