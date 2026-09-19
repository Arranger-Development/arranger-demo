// Musical state transitions happen before the audio engine reads the boundary event.
export function createSessionPlayback(audio, notify = () => {}) {
  let generation = 0;
  let current = null;
  let pending = null;
  let returnMain = null;
  let columns = [];
  let sourceSnapshot = null;
  let startStep = 0;
  let lastStep = -1;
  let cycle = 1;
  let mode = 'stopped';
  let loading = false;
  let bpm = 100;
  let audible = null;
  let livePosition = null;
  let liveColumns = [];
  const isRunning = () => !['stopped', 'paused'].includes(mode);
  function getLivePosition() {
    if (mode === 'live') {
      const absolute = audio.getAbsolutePlaybackStep?.();
      if (audible && Number.isFinite(absolute)) {
        const local = Math.max(0, Math.floor(absolute - audible.startStep));
        return { id: audible.id, cycle: Math.floor(local / audible.totalSteps) + 1, step: local % audible.totalSteps };
      }
    }
    return livePosition && { ...livePosition };
  }
  function normalizePosition(position, nextColumns) {
    const target = nextColumns.find(c => c.id === position?.id && c.snapshot);
    if (!target) return null;
    return { id: target.id, cycle: Math.max(1, Math.min(position.cycle || 1, target.repeat ?? Infinity)),
      step: Math.max(0, Math.min(position.step || 0, target.snapshot.totalBars * 16 - 1)) };
  }
  const emit = (extra = {}) => notify({ mode, loading, livePosition: getLivePosition(), requestedId: current?.id ?? null, playingId: audible?.id ?? null, pendingId: pending?.id ?? null, ...extra });
  const makeSource = () => ({ matrix: current.snapshot.matrix, totalBars: current.snapshot.totalBars, stepOffset: startStep, releaseVoices: true });
  function stop() {
    livePosition = getLivePosition();
    generation++; mode = 'stopped'; loading = false; current = pending = returnMain = audible = null;
    void audio.stop(); audio.stopAllVoices(); audio.resetPerformanceEffects?.(); emit();
  }
  function change(target, absoluteStep) {
    if (mode === 'jam' && target.snapshot.kind === 'transition' && current?.snapshot.kind !== 'transition') returnMain = current;
    if (mode === 'jam' && target.snapshot.kind !== 'transition') returnMain = null;
    current = target; startStep = absoluteStep; cycle = 1; sourceSnapshot = makeSource();
  }
  function source(absoluteStep) {
    lastStep = absoluteStep;
    if (pending && absoluteStep >= pending.at) { const next = pending; pending = null; change(next, absoluteStep); }
    const length = current.snapshot.totalBars * 16;
    if (absoluteStep >= startStep + length * cycle) {
      if (mode === 'jam') {
        if (current.snapshot.kind === 'transition') {
          if (mode === 'jam' && returnMain) { const next = returnMain; returnMain = null; change(next, absoluteStep); }
          else return finish();
        } else cycle++;
      } else if (current.repeat === null || cycle < current.repeat) cycle++;
      else {
        const next = columns[columns.findIndex((c) => c.id === current.id) + 1];
        if (next) change(next, absoluteStep); else return finish();
      }
    }
    const scheduled = { id: current.id, startStep, totalSteps: current.snapshot.totalBars * 16, cycle, snapshot: current.snapshot };
    const request = generation;
    return { ...sourceSnapshot, releaseVoices: absoluteStep === startStep,
      onAudible: () => { if (request !== generation) return; audible = scheduled; loading = false; emit({ cycle: scheduled.cycle }); } };
  }
  function finish() {
    const request = generation;
    return { done: true, onAudible: () => {
      if (request !== generation) return;
      if (mode === 'live') livePosition = null;
      mode = 'stopped'; audible = current = pending = returnMain = null; audio.resetPerformanceEffects?.(); emit();
    } };
  }
  async function start(nextMode, target, tempo, options = {}) {
    stop(); const request = ++generation;
    mode = nextMode; bpm = tempo; loading = true;
    const offset = options.position?.step ?? 0;
    cycle = options.position?.cycle ?? 1;
    lastStep = offset - 1; startStep = cycle > 1 ? -(cycle - 1) * target.snapshot.totalBars * 16 : 0;
    if (nextMode === 'live') livePosition = { id: target.id, cycle, step: offset };
    current = target; columns = options.columns ?? []; sourceSnapshot = makeSource(); emit();
    try {
      await audio.preparePerformanceEffects?.();
      if (request !== generation) return;
      const started = await audio.play({ bpm, bar: Math.floor(offset / 16), step: offset % 16, totalBars: target.snapshot.totalBars,
        matrixSource: () => current?.snapshot.matrix ?? target.snapshot.matrix,
        playbackSource: (step) => request === generation ? source(step) : { done: true },
        melodyTimbreIds: ['piano', 'yangqin', 'blues'],
        additionalTimbres: ['piano', 'yangqin', 'blues'].flatMap((timbreId) => [
          { trackId: 'chord', timbreId, playbackMode: 'natural' }, { trackId: 'melody', timbreId, playbackMode: 'natural' },
        ]),
      });
      if (request !== generation) return;
      if (!started) throw new Error('音频未能启动，请重试。');
      audio.setTempo(bpm); loading = false; emit();
    } catch (error) { if (request === generation) { stop(); emit({ error: error.message }); } }
  }
  function queue(target) {
    if (pending?.id === target.id) { pending = null; emit(); return; }
    pending = { ...target, at: (Math.floor(Math.max(-1, lastStep) / 16) + 1) * 16 }; emit();
  }
  return {
    stop, isActive: isRunning,
    getLivePosition,
    restoreLivePosition(position, nextColumns) {
      liveColumns = nextColumns;
      livePosition = normalizePosition(position, nextColumns);
      emit();
    },
    syncLiveColumns(nextColumns) {
      const previousIndex = liveColumns.findIndex(c => c.id === livePosition?.id);
      const normalized = normalizePosition(livePosition, nextColumns);
      if (livePosition && !normalized) {
        const target = nextColumns.slice(Math.max(0, previousIndex)).find(c => c.snapshot) ?? nextColumns.find(c => c.snapshot);
        livePosition = target ? { id: target.id, cycle: 1, step: 0 } : null;
      } else livePosition = normalized;
      liveColumns = nextColumns;
      emit();
    },
    pauseLive() {
      if (mode !== 'live') return;
      stop(); mode = 'paused'; emit();
    },
    rewindLive(nextColumns, tempo) {
      const running = mode === 'live';
      stop(); liveColumns = nextColumns;
      const target = nextColumns.find(c => c.snapshot);
      livePosition = target ? { id: target.id, cycle: 1, step: 0 } : null;
      if (running && target) void start('live', target, tempo, { columns: nextColumns.filter(c => c.snapshot) });
      else emit();
    },
    setTempo(value) { bpm = value; audio.setTempo(value); },
    launch(snapshot, tempo, { edit = false } = {}) {
      if (!snapshot) return;
      const target = { id: snapshot.id, snapshot };
      if (!isRunning()) { void start('jam', target, tempo); return; }
      if (!edit && current?.id === target.id && !pending) { stop(); return; }
      // Editing the same section replaces its queued snapshot rather than cancelling it.
      if (edit && pending?.id === target.id) { pending = { ...pending, ...target }; emit(); return; }
      queue(target);
    },
    live(nextColumns, tempo, id) {
      const position = normalizePosition(getLivePosition(), nextColumns);
      const index = id === undefined ? -1 : nextColumns.findIndex(c => c.id === id);
      const target = id === undefined
        ? nextColumns.find(c => c.id === position?.id && c.snapshot) ?? nextColumns.find(c => c.snapshot)
        : index < 0 ? null : nextColumns.slice(index).find(c => c.snapshot);
      if (!target) return false;
      liveColumns = nextColumns;
      void start('live', target, tempo, { columns: nextColumns.filter(c => c.snapshot),
        position: id === undefined && position?.id === target.id ? position : null });
      return true;
    },
    getProgress() {
      if (!audible || !isRunning()) return null;
      const absolute = audio.getAbsolutePlaybackStep?.();
      if (!Number.isFinite(absolute)) return null;
      const local = Math.max(0, absolute - audible.startStep);
      return { ...audible, localStep: local, fraction: (local % audible.totalSteps) / audible.totalSteps };
    },
    getBeatPhase() { return ((audio.getAbsolutePlaybackStep?.() ?? 0) % 4) / 4; },
  };
}
