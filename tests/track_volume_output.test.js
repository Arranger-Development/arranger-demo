import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrackOutputVolume } from '../src/domain/trackVolume.js';
import { createDefaultTrackState } from '../src/domain/trackInstances.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import useMusicStore from '../src/store/useMusicStore.js';
import { createUndoSnapshot, restoreUndoSnapshot } from '../src/app/undoHistory.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { collectProjectEvents, getEventVolume, renderProjectToWav } from '../src/export/audioFile.js';
import { createMidiFile } from '../src/export/midiFile.js';

function project() {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };
  matrix.chord[0][0] = { type: 'notes', notes: ['C3', 'E3'], velocity: .5 };
  matrix.bass[0][0] = { type: 'bass', note: 'C1', velocity: .5 };
  matrix.melody[0][0] = { type: 'melody', note: 'C4', timbreId: 'blues', durationSteps: 16, velocity: .5 };
  return { ...createDefaultTrackState(), matrix, totalBars: 8, bpm: 120,
    mutedTracks: {}, volumes: { drums: 0, chord: 0, bass: 0, melody: 0 } };
}
function midiNoteCounts(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const counts = [];
  for (let start = 14; start < bytes.length;) {
    const end = start + 8 + view.getUint32(start + 4);
    let pos = start + 8, count = 0;
    const vlq = () => { let n = 0, byte; do { byte = bytes[pos++]; n = (n << 7) | (byte & 127); } while (byte & 128); return n; };
    while (pos < end) {
      vlq();
      const status = bytes[pos++];
      if (status === 255) { pos++; const size = vlq(); pos += size; }
      else {
        if ((status & 0xf0) === 0x90 && bytes[pos + 1] > 0) count++;
        pos += (status & 0xf0) === 0xc0 ? 1 : 2;
      }
    }
    counts.push(count);
    start = end;
  }
  return counts;
}

test('only the slider floor maps to silence; other levels and explicit mute remain independent', () => {
  assert.equal(getTrackOutputVolume(-24), -Infinity);
  assert.equal(getTrackOutputVolume(-30), -Infinity);
  for (const value of [-23, -12, 0, 6]) assert.equal(getTrackOutputVolume(value), value);
  assert.equal(getTrackOutputVolume(undefined), 0);
  assert.equal(getTrackOutputVolume(-6, true), -Infinity);
  assert.equal(getTrackOutputVolume(-24, false), -Infinity);
});

test('audio and MIDI omit each minimum-volume track while preserving other tracks and source data', () => {
  const state = project();
  const original = structuredClone(state.matrix);
  const events = collectProjectEvents(state);
  const originalCounts = midiNoteCounts(createMidiFile(state));
  assert.ok(originalCounts.slice(1).every(count => count > 0));
  for (const [index, trackId] of state.trackOrder.entries()) {
    state.volumes[trackId] = -24;
    assert.ok(collectProjectEvents(state).every(event => event.trackId !== trackId));
    for (const event of events.filter(event => event.trackId === trackId)) assert.equal(getEventVolume(state, event), -Infinity);
    const expected = [...originalCounts];
    expected[index + 1] = 0;
    assert.deepEqual(midiNoteCounts(createMidiFile(state)), expected);
    state.volumes[trackId] = -23;
    assert.deepEqual(midiNoteCounts(createMidiFile(state)), originalCounts);
    assert.ok(collectProjectEvents(state).some(event => event.trackId === trackId));
    state.volumes[trackId] = 0;
  }
  assert.deepEqual(state.matrix, original);
});

test('an all-silent WAV schedules no sample or fallback voices and retains the project duration', async (t) => {
  let frames;
  class OfflineContext {
    constructor(channels, length) { frames = length; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBufferSource() { assert.fail('silent tracks must not schedule sample voices'); }
    createOscillator() { assert.fail('silent tracks must not schedule fallback voices'); }
    async startRendering() { return { numberOfChannels: 2, length: 10, sampleRate: 44100, getChannelData: () => new Float32Array(10) }; }
  }
  const previous = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = OfflineContext;
  t.after(() => { if (previous) globalThis.OfflineAudioContext = previous; else delete globalThis.OfflineAudioContext; });
  const state = project();
  state.volumes = Object.fromEntries(state.trackOrder.map(id => [id, -24]));
  const result = await renderProjectToWav(state);
  assert.equal(result.durationSeconds, 16);
  assert.equal(frames, 19 * 44100);
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  assert.ok(bytes.slice(44).every(byte => byte === 0));
});

test('floor levels stay finite in project backups and undo snapshots, including added tracks', (t) => {
  const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
  reset(); t.after(reset);
  const state = useMusicStore.getState();
  const added = state.addTrackInstance('melody');
  const ids = [...state.trackOrder, added];
  const before = createUndoSnapshot({ appState: useMusicStore.getState() });
  for (const id of ids) state.setTrackVolume(id, -24);
  let next = useMusicStore.getState();
  assert.ok(ids.every(id => next.volumes[id] === -24 && next.mutedTracks[id] === false));
  const after = createUndoSnapshot({ appState: next });
  const backup = JSON.parse(JSON.stringify(createProjectFile(next)));
  assert.deepEqual(backup.arrangement.volumes, next.volumes);
  assert.deepEqual(backup.arrangement.matrix, next.matrix);
  restoreUndoSnapshot({ snapshot: before, store: useMusicStore });
  assert.deepEqual(useMusicStore.getState().volumes, before.appState.volumes);
  restoreUndoSnapshot({ snapshot: after, store: useMusicStore });
  next = useMusicStore.getState();
  assert.ok(ids.every(id => getTrackOutputVolume(next.volumes[id]) === -Infinity));
  next.toggleTrackMute('drums');
  next.setTrackVolume('drums', -6);
  next = useMusicStore.getState();
  assert.equal(next.mutedTracks.drums, true);
  assert.equal(getTrackOutputVolume(next.volumes.drums, next.mutedTracks.drums), -Infinity);
});
