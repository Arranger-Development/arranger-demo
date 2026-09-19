// Musical state transitions happen before the audio engine reads the boundary event.
export function createSessionPlayback(audio, notify = () => {}) {
  let generation = 0;
  let current = null;
  let pending = null;
  let returnMain = null;
  let sourceSnapshot = null;
  let startStep = 0;
  let lastStep = -1;
  let cycle = 1;
  let mode = 'stopped';
  let loading = false;
  let bpm = 100;
  let audible = null;
  const isRunning = () => !['stopped', 'paused'].includes(mode);
  const emit = (extra = {}) => notify({ mode, loading, requestedId: current?.id ?? null, playingId: audible?.id ?? null, pendingId: pending?.id ?? null, ...extra });
  const makeSource = () => ({ matrix: current.snapshot.matrix, totalBars: current.snapshot.totalBars, stepOffset: startStep, releaseVoices: true });
  function stop() {
    generation++; mode = 'stopped'; loading = false; current = pending = returnMain = audible = null;
    void audio.stop(); audio.stopAllVoices(); emit();
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
      mode = 'stopped'; audible = current = pending = returnMain = null; emit();
    } };
  }
  async function start(nextMode, target, tempo) {
    stop(); const request = ++generation;
    mode = nextMode; bpm = tempo; loading = true;
    const offset = 0;
    cycle = 1;
    lastStep = offset - 1; startStep = cycle > 1 ? -(cycle - 1) * target.snapshot.totalBars * 16 : 0;
    current = target; sourceSnapshot = makeSource(); emit();
    try {
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
