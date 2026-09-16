import assert from 'node:assert/strict';
import { test } from 'node:test';
import AudioEngine from '../src/audio/AudioEngine.js';
import { createMelodyCellFromNotes, getMelodyCellNotes } from '../src/domain/melodyCells.js';
import { getMelodyCellRenderState, getMelodyCellToggleResult, setMelodyCell, setMelodyCellDuration } from '../src/app/melodyActions.js';
import { hasTrackBarContent } from '../src/app/trackContent.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { performanceTemplates, emptySelection } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID as profileId } from '../src/data/aiPerformanceTemplates.js';
import { collectProjectEvents, renderProjectToWav } from '../src/export/audioFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { createUndoSnapshot, restoreUndoSnapshot } from '../src/app/undoHistory.js';
import useMusicStore from '../src/store/useMusicStore.js';

const genreId = 'electronic-edm';
const selection = { ...emptySelection(), chord: performanceTemplates(genreId, profileId).chord[1].id };
// Legacy imported melody projects must stay playable after the library changes.
const build = () => {
  const project = createPerformanceImport({ saved: Array.from({ length: 5 }, () => ({ ...selection })), genreId, profileId, bpm: 100 });
  project.matrix.melody = project.matrix.chord.map(bar => bar.map(cell => cell
    ? createMelodyCellFromNotes(cell.notes, cell) : null));
  project.matrix.chord = project.matrix.chord.map(() => Array(16).fill(null));
  project.clips.byId = Object.fromEntries(Object.values(project.clips.byId).map(clip => {
    const id = clip.id.replace('chord', 'melody');
    return [id, { ...clip, id, trackId: 'melody' }];
  }));
  project.clips.ids = Object.keys(project.clips.byId);
  return project;
};
const firstPitches = ['B3', 'F#3', 'E3', 'C#3'];

test('polyphonic cells normalize legacy notes and edit each pitch without losing metadata', () => {
  assert.deepEqual(createMelodyCellFromNotes(['B2', 'G#2']), null);
  assert.deepEqual(createMelodyCellFromNotes(['C4', 'C4', 'bad']), { type: 'melody', note: 'C4' });
  assert.deepEqual(getMelodyCellNotes({ type: 'notes', notes: firstPitches }), []);
  const matrix = build().matrix;
  assert.deepEqual(getMelodyCellNotes(matrix.melody[0][0]), firstPitches);
  assert.equal(hasTrackBarContent(matrix, 'melody', 0), true);
  matrix.melody[0][0].velocity = .6;
  const removed = getMelodyCellToggleResult(matrix, 0, 0, 'E3');
  assert.equal(removed.auditionNote, null);
  assert.deepEqual(getMelodyCellNotes(removed.nextMatrix.melody[0][0]), ['B3', 'F#3', 'C#3']);
  assert.deepEqual(getMelodyCellNotes(matrix.melody[0][0]), firstPitches);
  const added = getMelodyCellToggleResult(removed.nextMatrix, 0, 0, 'G3');
  assert.equal(added.auditionNote, 'G3');
  const held = setMelodyCellDuration(added.nextMatrix, 0, 0, 3);
  assert.deepEqual(getMelodyCellNotes(held.melody[0][0]), ['B3', 'F#3', 'C#3', 'G3']);
  assert.equal(held.melody[0][0].velocity, .6);
  assert.equal(held.melody[0][0].timbreId, 'piano');
  assert.equal(held.melody[0][0].playbackMode, 'natural');
  for (const note of getMelodyCellNotes(held.melody[0][0])) {
    assert.deepEqual(getMelodyCellRenderState(held, 0, 2, note), { active: true, start: false, durationSteps: 3, startStep: 0 });
  }
  const rewritten = setMelodyCell(held, 0, 0, 'A4', 2);
  assert.deepEqual(getMelodyCellNotes(rewritten.melody[0][0]), ['A4'], 'recording still replaces the whole step');
  assert.equal(rewritten.melody[0][0].durationSteps, 2);
});

test('twenty-bar imports keep 120 notes through clip copy, move, undo and project backup', (t) => {
  const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
  reset(); t.after(reset);
  useMusicStore.setState(build());
  const original = createUndoSnapshot({ appState: useMusicStore.getState() });
  const state = useMusicStore.getState();
  assert.equal(collectProjectEvents(state).length, 120);
  const clipboard = state.createTimelineClipboardSnapshot({ trackIds: ['melody'], startBar: 0, endBar: 0 });
  assert.ok(state.pasteTimelineClipboardSnapshot(clipboard, 19));
  state.moveClipToBar('melody-bar-19', 18);
  let next = useMusicStore.getState();
  assert.deepEqual(getMelodyCellNotes(next.matrix.melody[18][0]), firstPitches);
  assert.notEqual(next.matrix.melody[18][0].notes, next.matrix.melody[0][0].notes);
  state.setTrackMatrix('melody', getMelodyCellToggleResult(next.matrix, 18, 0, 'B3').nextMatrix.melody);
  next = useMusicStore.getState();
  assert.deepEqual(getMelodyCellNotes(next.matrix.melody[0][0]), firstPitches);
  const edited = createUndoSnapshot({ appState: next });
  const file = JSON.parse(JSON.stringify(createProjectFile(next)));
  assert.deepEqual(file.arrangement.matrix.melody, next.matrix.melody);
  restoreUndoSnapshot({ snapshot: original, store: useMusicStore });
  assert.equal(collectProjectEvents(useMusicStore.getState()).length, 120);
  restoreUndoSnapshot({ snapshot: edited, store: useMusicStore });
  assert.deepEqual(useMusicStore.getState().matrix.melody, edited.appState.matrix.melody);
});

function midiNoteOns(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), notes = [];
  for (let start = 14; start < bytes.length;) {
    const end = start + 8 + view.getUint32(start + 4);
    let pos = start + 8, tick = 0;
    const vlq = () => { let n = 0, b; do { b = bytes[pos++]; n = (n << 7) | (b & 127); } while (b & 128); return n; };
    while (pos < end) {
      tick += vlq(); const status = bytes[pos++];
      if (status === 255) { pos++; const size = vlq(); pos += size; }
      else { if ((status & 0xf0) === 0x90 && bytes[pos + 1] > 0) notes.push({ tick, note: bytes[pos] }); pos += (status & 0xf0) === 0xc0 ? 1 : 2; }
    }
    start = end;
  }
  return notes;
}

test('MIDI retains every simultaneous pitch, repeated attack and final phrase', () => {
  const notes = midiNoteOns(createMidiFile(build()));
  assert.equal(notes.length, 120);
  assert.deepEqual(notes.filter(({ tick }) => tick === 0).map(({ note }) => note).sort((a, b) => a - b), [49, 52, 54, 59]);
  assert.deepEqual(notes.filter(({ tick }) => tick === 8 * 120).map(({ note }) => note).sort((a, b) => a - b), [49, 52, 54, 59]);
  assert.equal(notes.filter(({ tick }) => tick >= 19 * 1920).length, 7);
});

test('WAV schedules all simultaneous piano voices with full natural tails', async (t) => {
  const starts = [], stops = [], urls = [];
  class OfflineContext {
    constructor() { this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; } }; }
    createBufferSource() { return { playbackRate: {}, connect() { return this; }, start: time => starts.push(time), stop: time => stops.push(time) }; }
    createOscillator() { assert.fail('piano samples should be used'); }
    async decodeAudioData() { return { duration: 10 }; }
    async startRendering() { return { numberOfChannels: 2, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) }; }
  }
  const previous = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = OfflineContext;
  t.after(() => { if (previous) globalThis.OfflineAudioContext = previous; else delete globalThis.OfflineAudioContext; });
  t.mock.method(globalThis, 'fetch', async url => { urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; });
  const project = build(), wav = await renderProjectToWav(project);
  const events = collectProjectEvents(project);
  assert.equal(wav.durationSeconds, 48);
  assert.equal(starts.length, 120);
  assert.equal(starts.filter(time => time === 0).length, 4);
  assert.ok(urls.every(url => /samples\/Melody\//.test(url)));
  events.forEach(({ bar, step }, index) => {
    const time = (bar * 16 + step) * .15;
    assert.ok(Math.abs(starts[index] - time) < 1e-8);
  });
  assert.deepEqual(stops, [], 'natural samples finish themselves without a scheduled note-off');
});

test('audio engine schedules polyphony on one clock and honors volume, stop and duplicate tracks', async () => {
  const hits = [], released = [];
  const Transport = { bpm: { value: 100 }, position: '0:0:0',
    scheduleRepeat(callback) { this.tick = callback; return 1; }, clear() {}, start() {}, stop() {}, pause() {} };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const mix = { volumes: { melody: 0, 'melody-2': -6 }, mutedTracks: {} };
  const engine = new AudioEngine({ tone, volumeSource: () => mix, playerFactory: () => ({ start() {}, toDestination() { return this; } }),
    melodyInputSamplerFactory: () => ({ volume: { value: 0 },
      triggerAttackRelease(note, duration, time) { hits.push({ note, duration, time, volume: this.volume.value }); },
      triggerAttack(note, time) { hits.push({ note, time, volume: this.volume.value }); },
      releaseAll(time) { released.push(time); }, toDestination() { return this; },
    }),
  });
  const project = build();
  project.matrix['melody-2'] = project.matrix.melody;
  project.trackOrder = ['melody', 'melody-2'];
  await engine.play({ matrixSource: () => project, totalBars: 20, bpm: 100 });
  const tick = Transport.tick;
  tick(0);
  assert.equal(hits.length, 8);
  assert.ok(hits.every(hit => hit.time === 0 && hit.duration === undefined));
  assert.deepEqual(hits.slice(0, 4).map(hit => hit.note), firstPitches);
  assert.deepEqual(hits.slice(4).map(hit => hit.volume), [-6, -6, -6, -6]);
  mix.volumes.melody = -24;
  engine.refreshTrackVolume('melody');
  for (let step = 1; step <= 8; step++) tick(step * .15);
  assert.deepEqual(hits.slice(-8, -4).map(hit => hit.volume), [-Infinity, -Infinity, -Infinity, -Infinity]);
  assert.deepEqual(hits.slice(-4).map(hit => hit.volume), [-6, -6, -6, -6]);
  await engine.stop();
  const count = hits.length;
  tick(2);
  assert.equal(hits.length, count);
  assert.ok(released.length > 0);
  assert.equal(createMatrixPlaybackAdapter(project, { totalBars: 20 }).getEventsForFlatStep(319).length, 0);
});
