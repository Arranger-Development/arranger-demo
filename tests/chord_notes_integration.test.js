import assert from 'node:assert/strict';
import { test } from 'node:test';
import AudioEngine from '../src/audio/AudioEngine.js';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { emptySelection, performanceTemplates } from '../src/app/performanceModel.js';
import { getChordCellNotes, toggleChordNoteCell } from '../src/domain/chordCells.js';
import { collectProjectEvents, renderProjectToWav } from '../src/export/audioFile.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { createUndoSnapshot, restoreUndoSnapshot } from '../src/app/undoHistory.js';
import useMusicStore from '../src/store/useMusicStore.js';

const genreId = 'electronic-edm', profileId = 'ai-demo-1';
const templates = performanceTemplates(genreId, profileId);
const build = () => createPerformanceImport({
  saved: Array.from({ length: 5 }, () => ({ ...emptySelection(), chord: templates.chord[1].id })),
  genreId, profileId, bpm: 100,
});
const pitches = ['B3', 'F#3', 'E3', 'C#3'];
const attackCount = project => collectProjectEvents(project).flatMap(event => event.notes ?? [event.note]).length;

test('fixed chord imports retain all 120 pitches, editor mode and metadata through edits, clear, copy, move, undo and backup', t => {
  const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
  reset(); t.after(reset);
  useMusicStore.setState(build());
  const original = createUndoSnapshot({ appState: useMusicStore.getState() });
  let state = useMusicStore.getState();
  assert.equal(state.totalBars, 20);
  assert.equal(attackCount(state), 120);
  assert.ok(state.clips.ids.every(id => state.clips.byId[id].editorMode === 'notes'));
  const clipboard = state.createTimelineClipboardSnapshot({ trackIds: ['chord'], startBar: 0, endBar: 0 });
  assert.ok(state.pasteTimelineClipboardSnapshot(clipboard, 19));
  state.moveClipToBar('chord-bar-19', 18);
  state = useMusicStore.getState();
  assert.equal(state.clips.byId['chord-bar-18'].editorMode, 'notes');
  const edited = toggleChordNoteCell(state.matrix.chord[18][0], 'E3');
  state.setCell('chord', 18, 0, edited);
  assert.deepEqual(edited.notes, ['B3', 'F#3', 'C#3']);
  assert.equal(edited.playbackMode, 'natural');
  assert.equal(edited.timbreId, 'piano');
  assert.equal(edited.duration, '16n');
  assert.deepEqual(getChordCellNotes(useMusicStore.getState().matrix.chord[0][0]), pitches);
  let empty = edited;
  for (const note of edited.notes) empty = toggleChordNoteCell(empty, note);
  assert.equal(empty, null);
  state.setCell('chord', 18, 0, empty);
  assert.equal(useMusicStore.getState().clips.byId['chord-bar-18'].editorMode, 'notes');
  const restoredCell = toggleChordNoteCell({ timbreId: 'piano', playbackMode: 'natural', duration: '16n' }, 'C4');
  state.setCell('chord', 18, 0, restoredCell);
  const after = createUndoSnapshot({ appState: useMusicStore.getState() });
  const file = JSON.parse(JSON.stringify(createProjectFile(useMusicStore.getState())));
  assert.deepEqual(file.arrangement.matrix.chord, after.appState.matrix.chord);
  assert.deepEqual(file.arrangement.clips, after.appState.clips);
  restoreUndoSnapshot({ snapshot: original, store: useMusicStore });
  assert.equal(attackCount(useMusicStore.getState()), 120);
  restoreUndoSnapshot({ snapshot: after, store: useMusicStore });
  assert.deepEqual(useMusicStore.getState().matrix.chord, after.appState.matrix.chord);
});

test('fixed chord WAV uses piano samples for all voices and tails, while MIDI retains sixteen-step note durations', async t => {
  const starts = [], stops = [], files = [], frames = [];
  class Context {
    constructor(channels, length) { frames.push(length); this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() { return this; } }; }
    createBufferSource() { return { playbackRate: {}, connect() { return this; }, start: time => starts.push(time), stop: time => stops.push(time) }; }
    async decodeAudioData() { return { duration: 2 }; }
    async startRendering() { return { numberOfChannels: 2, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) }; }
  }
  const old = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = Context;
  t.after(() => { if (old) globalThis.OfflineAudioContext = old; else delete globalThis.OfflineAudioContext; });
  t.mock.method(globalThis, 'fetch', async url => { files.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; });
  const project = build();
  await renderProjectToWav(project);
  assert.equal(starts.length, 120);
  assert.equal(starts.filter(time => time === 0).length, 4);
  assert.ok(starts.some(time => time >= 19 * 2.4));
  assert.deepEqual(stops, []);
  assert.deepEqual(frames, [51 * 44100]);
  assert.ok(files.every(file => /samples\/Melody\//.test(file)));
  const gated = structuredClone(project);
  gated.matrix.chord.flat().filter(Boolean).forEach(cell => { delete cell.playbackMode; });
  assert.deepEqual(createMidiFile(project), createMidiFile(gated));
});

test('chord natural voices stay separate from melody and ordinary chords, mute and stop on their own channel', async () => {
  const calls = [], mix = { volumes: { chord: -6, melody: 0 }, mutedTracks: {} };
  const Transport = { bpm: { value: 100 }, position: '0:0:0', scheduleRepeat(fn) { this.tick = fn; return 1; }, clear() {}, start() {}, stop() {} };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const engine = new AudioEngine({ tone, volumeSource: () => mix,
    playerFactory: () => ({ start() {}, toDestination() { return this; } }),
    melodyInputSamplerFactory: () => ({ volume: { value: 0 }, hits: [], releases: [],
      triggerAttack(note, time) { this.hits.push({ note, time, volume: this.volume.value }); },
      releaseAll(time) { this.releases.push(time); }, toDestination() { return this; },
    }),
    chordSamplerFactory: () => ({ volume: { value: 0 }, triggerAttackRelease: (...args) => calls.push(args), releaseAll() {}, toDestination() { return this; } }),
  });
  const project = build();
  project.matrix.melody[0][0] = { type: 'melody', note: 'G4', duration: '16n', timbreId: 'piano', playbackMode: 'natural' };
  await engine.play({ matrixSource: () => project, totalBars: 20, bpm: 100 });
  Transport.tick(0);
  const chord = engine.getMelodyBank('piano', 'chord', 'natural').sampler;
  const melody = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  assert.deepEqual(chord.hits.map(hit => hit.note), pitches);
  assert.ok(chord.hits.every(hit => hit.volume === -6));
  assert.equal(melody.hits.length, 1);
  engine.triggerChordEvent({ notes: ['C3', 'E3', 'G3'], duration: '16n' }, .1);
  assert.equal(calls.length, 1);
  assert.equal(chord.releases.length, 0);
  mix.volumes.chord = -24;
  engine.refreshTrackVolume('chord');
  assert.equal(chord.volume.value, -Infinity);
  assert.ok(chord.releases.length);
  assert.equal(melody.releases.length, 0);
  mix.volumes.chord = -3;
  engine.refreshTrackVolume('chord');
  for (let step = 1; step <= 8; step++) Transport.tick(step * .15);
  assert.ok(chord.hits.slice(-4).every(hit => hit.volume === -3));
  const count = chord.hits.length;
  await engine.stop();
  Transport.tick(9);
  assert.equal(chord.hits.length, count);
  assert.ok(melody.releases.length);
  let finish;
  tone.loaded = () => new Promise(resolve => { finish = resolve; });
  const pending = engine.triggerMelodyInputOneShot('C4', 0, { trackId: 'chord-2', timbreId: 'piano', playbackMode: 'natural' });
  await new Promise(resolve => setImmediate(resolve));
  await engine.stop(); finish();
  assert.equal(await pending, false);
  assert.equal(engine.getMelodyBank('piano', 'chord-2', 'natural').sampler.hits.length, 0);
});
