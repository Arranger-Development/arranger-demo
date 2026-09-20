import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import useMusicStore from '../src/store/useMusicStore.js';
import { getProjectExtensionError, getTimelineBars } from '../src/domain/projectLength.js';
import { createUndoSnapshot, restoreUndoSnapshot, createRedoTransition, createUndoTransition, pushHistoryCheckpoint } from '../src/app/undoHistory.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { renderProjectToWav } from '../src/export/audioFile.js';

const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
afterEach(reset);

test('explicit extension atomically fills every track and preserves clips, selection and mix', () => {
  reset();
  const extra = useMusicStore.getState().addTrackInstance('melody');
  const before = useMusicStore.getState();
  const updates = [];
  const unsubscribe = useMusicStore.subscribe(state => updates.push(state));
  assert.equal(before.extendProject(9), true);
  unsubscribe();
  const after = useMusicStore.getState();
  assert.equal(updates.length, 1);
  assert.equal(after.totalBars, 9);
  assert.equal(after.matrix[extra].length, 9);
  for (const [id, bars] of Object.entries(after.matrix)) {
    assert.deepEqual(bars.slice(0, 8), before.matrix[id]);
    assert.deepEqual(bars[8], Array(16).fill(null));
  }
  for (const key of ['clips', 'selectedClipId', 'selectedBar', 'activeTrackId', 'volumes', 'mutedTracks']) assert.deepEqual(after[key], before[key]);
  assert.equal(after.extendProject(32), true);
  assert.ok(Object.values(useMusicStore.getState().matrix).every(bars => bars.length === 32));
});

test('invalid, shrinking and unchanged extensions do not mutate; 256 is the inclusive limit', () => {
  reset();
  const state = useMusicStore.getState();
  for (const value of ['', ' ', null, undefined, -1, 0, 2.5, 'abc', 7, 8, 257, Infinity]) {
    assert.equal(state.extendProject(value), false);
    assert.equal(useMusicStore.getState(), state);
  }
  assert.equal(state.extendProject(255), true);
  assert.equal(state.extendProject(256), true);
  assert.equal(state.extendProject(257), false);
  assert.equal(useMusicStore.getState().totalBars, 256);
  assert.match(getProjectExtensionError('', 8), /正整数/);
  assert.match(getProjectExtensionError(257, 8), /256/);
  assert.match(getProjectExtensionError(4, 8), /只能扩充/);
});

test('short projects extend actual length without treating the eight visible slots as content', () => {
  reset();
  const state = useMusicStore.getState();
  useMusicStore.setState({ totalBars: 4, matrix: Object.fromEntries(Object.entries(state.matrix).map(([id, bars]) => [id, bars.slice(0, 4)])) });
  assert.equal(getTimelineBars(useMusicStore.getState()), 8);
  useMusicStore.getState().extendProject(5);
  assert.equal(useMusicStore.getState().totalBars, 5);
  assert.ok(Object.values(useMusicStore.getState().matrix).every(bars => bars.length === 5));
});

test('extension undo and redo restore length and matrices; editing after undo clears redo', () => {
  reset();
  const capture = () => createUndoSnapshot({ appState: useMusicStore.getState() });
  const before = capture();
  useMusicStore.getState().extendProject(32);
  const after = capture();
  const undo = createUndoTransition({ currentSnapshot: after, undoHistory: [before] });
  restoreUndoSnapshot({ snapshot: undo.snapshot, store: useMusicStore });
  assert.equal(useMusicStore.getState().totalBars, 8);
  const redo = createRedoTransition({ ...undo, currentSnapshot: capture() });
  restoreUndoSnapshot({ snapshot: redo.snapshot, store: useMusicStore });
  assert.equal(useMusicStore.getState().totalBars, 32);
  assert.deepEqual(useMusicStore.getState().matrix, after.appState.matrix);
  restoreUndoSnapshot({ snapshot: before, store: useMusicStore });
  useMusicStore.getState().extendProject(9);
  assert.deepEqual(pushHistoryCheckpoint({ ...undo, snapshot: before }).redoHistory, []);
});

test('expanded last bar accepts clip creation and movement', () => {
  reset();
  const state = useMusicStore.getState();
  state.extendProject(32);
  const clip = state.createClip('bass', 31);
  assert.ok(clip);
  assert.equal(useMusicStore.getState().clips.byId[clip.id].bar, 31);
  const moved = state.moveClipToBar(clip.id, 30);
  assert.equal(moved.bar, 30);
  const snapshot = state.createClipClipboardSnapshot(moved.id);
  assert.ok(state.pasteClipClipboardSnapshot(snapshot, 'bass', 31));
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 31).bar, 31);
});

test('project JSON and every MIDI track retain the expanded silent tail', () => {
  reset();
  useMusicStore.getState().extendProject(256);
  const state = useMusicStore.getState();
  const saved = JSON.parse(JSON.stringify(createProjectFile(state)));
  assert.equal(saved.arrangement.totalBars, 256);
  assert.ok(Object.values(saved.arrangement.matrix).every(bars => bars.length === 256));
  const midi = createMidiFile(state);
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  let offset = 14;
  const endTicks = [];
  while (offset < midi.length) {
    const end = offset + 8 + view.getUint32(offset + 4); offset += 8;
    let tick = 0;
    const variable = () => { let n = 0, byte; do { byte = midi[offset++]; n = (n << 7) | (byte & 127); } while (byte & 128); return n; };
    while (offset < end) {
      tick += variable();
      const status = midi[offset++];
      if (status === 255) { const type = midi[offset++]; const size = variable(); offset += size; if (type === 47) endTicks.push(tick); }
      else offset += (status & 240) === 192 || (status & 240) === 208 ? 1 : 2;
    }
  }
  assert.equal(endTicks.length, state.trackOrder.length + 1);
  assert.ok(endTicks.every(tick => tick === 256 * 16 * 120));
});

test('WAV includes explicitly appended blank bars in its duration and encoded frames', async (t) => {
  reset();
  useMusicStore.getState().extendProject(32);
  const previous = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = class {
    constructor(channels, frames, rate) { this.frames = frames; this.rate = rate; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    async startRendering() { return { numberOfChannels: 2, length: this.frames, sampleRate: this.rate, getChannelData: () => new Float32Array(this.frames) }; }
  };
  t.after(() => { if (previous) globalThis.OfflineAudioContext = previous; else delete globalThis.OfflineAudioContext; });
  const state = { ...useMusicStore.getState(), bpm: 240 };
  const result = await renderProjectToWav(state, { chunkSeconds: 10 });
  assert.equal(result.durationSeconds, 32);
  assert.equal(new DataView(await result.blob.arrayBuffer()).getUint32(40, true), (32 + 3) * 44100 * 4);
});
