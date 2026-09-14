// Owns a single transport session. Draft changes replace its source, not its clock.
export function createPerformancePlayback(audio, notify = () => {}, {
  melodyTimbreIds = ['yangqin', 'blues'], melodyPlaybackMode,
} = {}) {
  let generation = 0;
  let mode = 'stopped';
  let matrix = null;
  let snapshot = null;
  let segments = [];
  let tempo = 120;
  let loading = false;

  function stop() {
    generation += 1;
    const wasActive = mode !== 'stopped' || loading;
    mode = 'stopped';
    loading = false;
    if (wasActive) {
      void audio.stop();
      audio.stopAllVoices();
    }
    notify({ mode, loading, bar: 0, step: 0, error: '' });
  }

  async function start(nextMode, nextMatrix, totalBars, bpm) {
    stop();
    const request = ++generation;
    matrix = nextMatrix;
    snapshot = { matrix, totalBars };
    tempo = bpm;
    mode = nextMode;
    loading = true;
    notify({ mode, loading, bar: 0, step: 0, error: '' });
    try {
      const started = await audio.play({
        bpm: tempo, bar: 0, step: 0, totalBars,
        matrixSource: () => matrix,
        playbackSource: () => snapshot,
        // Prepare every required bank so pad switches never load on a beat.
        melodyTimbreIds,
        melodyPlaybackMode,
        onPositionChange: (bar, step) => {
          if (request === generation) notify({ mode, loading: false, bar, step, error: '' });
        },
      });
      if (request !== generation) return;
      if (!started) throw new Error('声音未能启动，请重试');
      loading = false;
      audio.setTempo(tempo);
      notify({ mode, loading, bar: 0, step: 0, error: '' });
    } catch (error) {
      if (request !== generation) return;
      stop();
      notify({ mode: 'stopped', loading: false, bar: 0, step: 0, error: error.message || '声音加载失败，请重试' });
    }
  }

  return {
    stop,
    isActive() { return mode !== 'stopped'; },
    getProgress() {
      if (mode === 'stopped' || loading) return null;
      const clock = audio.getPlaybackProgress?.();
      const position = clock?.position ?? audio.getPlaybackPosition();
      if (!Number.isFinite(position)) return null;
      if (mode === 'preview') {
        const totalSteps = clock?.totalSteps ?? snapshot.totalBars * 16;
        return { segment: 0, fraction: (position % totalSteps) / totalSteps };
      }
      const segment = segments.findIndex(({ startStep, totalSteps }) => (
        position >= startStep && position < startStep + totalSteps
      ));
      if (segment < 0) return null;
      return { segment, fraction: (position - segments[segment].startStep) / segments[segment].totalSteps };
    },
    setTempo(bpm) { tempo = bpm; if (mode !== 'stopped') audio.setTempo(bpm); },
    preview(nextMatrix, bpm) {
      if (mode === 'preview') {
        matrix = nextMatrix;
        snapshot = { matrix, totalBars: matrix.drums.length };
        tempo = bpm;
        audio.setTempo(bpm);
        return;
      }
      void start('preview', nextMatrix, nextMatrix.drums.length, bpm);
    },
    sequence(sequence, bpm) {
      segments = sequence.segments;
      void start('sequence', sequence.matrix, sequence.totalBars, bpm);
    },
  };
}
