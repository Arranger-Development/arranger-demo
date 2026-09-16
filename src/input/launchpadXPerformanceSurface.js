import { PERFORMANCE_TRACKS, hasSelection, sameSelection } from '../app/performanceModel.js';

const TRACK_COLORS = { drums: [19, 18, 17], chord: [11, 10, 9], bass: [43, 42, 41], melody: [51, 50, 49] };
const LOOP_COLORS = [TRACK_COLORS.bass, TRACK_COLORS.drums, [15, 14, 13], TRACK_COLORS.chord, TRACK_COLORS.melody];

export function createLaunchpadXPerformanceLedFrame(surface = {}, now = 0) {
  const { templates = {}, drafts = [], saved = [], selectedLoop = 0,
    status = {}, progress = null, sequenceIndices = [], beatPhase = 0,
    saveFeedback = false, storageError = false } = surface;
  const draft = drafts[selectedLoop] ?? {};
  const playingLoop = status.mode !== 'stopped' && !status.loading && progress
    ? (status.mode === 'preview' ? selectedLoop : sequenceIndices[progress.segment]) : null;
  const lights = new Map();
  PERFORMANCE_TRACKS.forEach((track, row) => {
    templates[track]?.slice(0, 6).forEach((template, index) => {
      lights.set((8 - row) * 10 + index + 1, TRACK_COLORS[track][draft[track] === template.id ? 2 : 0]);
    });
  });
  for (let index = 0; index < 5; index += 1) {
    const intensity = playingLoop === index ? (beatPhase < .5 ? 2 : 1)
      : selectedLoop === index ? 2 : hasSelection(saved[index]) ? 1 : 0;
    lights.set(11 + index, LOOP_COLORS[index][intensity]);
  }
  lights.set(17, storageError ? 5 : saveFeedback ? 17 : sameSelection(draft, saved[selectedLoop]) ? 11 : 9);
  lights.set(18, status.loading ? (Math.floor(now / 300) % 2 ? 7 : 5)
    : status.mode && status.mode !== 'stopped' ? 5 : 17);
  if (playingLoop !== null) {
    const count = Math.min(8, Math.floor(progress.fraction * 8) + 1);
    for (let index = 0; index < count; index += 1) lights.set(21 + index, LOOP_COLORS[playingLoop][2]);
  }
  const frame = [];
  for (let row = 8; row >= 1; row -= 1) {
    for (let column = 1; column <= 8; column += 1) {
      const note = row * 10 + column;
      frame.push([0x90, note, lights.get(note) ?? 0]);
    }
  }
  // Clear every peripheral key when entering performance mode.
  for (const cc of [91, 92, 93, 94, 95, 96, 97, 98, 89, 79, 69, 59, 49, 39, 29, 19]) frame.push([0xb0, cc, 0]);
  return frame;
}

export function createLedFrameSender() {
  let cache = new Map();
  return {
    reset() { cache = new Map(); },
    send(output, frame) {
      for (const message of frame) {
        const key = `${message[0]}:${message[1]}`;
        if (cache.get(key) === message[2]) continue;
        output.send(message);
        cache.set(key, message[2]);
      }
    },
  };
}
