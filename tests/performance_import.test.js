import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { createPerformanceSequence, emptySelection, performanceTemplates } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID } from '../src/data/aiPerformanceTemplates.js';
import useMusicStore from '../src/store/useMusicStore.js';
import { createUndoSnapshot, createUndoTransition, createRedoTransition, restoreUndoSnapshot } from '../src/app/undoHistory.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { collectProjectEvents, renderProjectToWav } from '../src/export/audioFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { getTimelineBars, getTotalBars } from '../src/domain/projectLength.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { setMelodyCellDuration } from '../src/app/melodyActions.js';
import { applyBasicDrumsAllBars } from '../src/app/drumsPatternActions.js';
import { isValidAppCommand } from '../src/input/commandGuards.js';
import { APP_COMMAND_TYPES as C } from '../src/input/appCommands.js';
import { mapKeyboardEventToCommand } from '../src/input/keyboardMap.js';
import { mapLaunchpadXMessageToCommand } from '../src/input/launchpadXMap.js';
import { createLaunchpadXDrumsLedFrame } from '../src/input/launchpadXDrumsSurface.js';
import { getTimelinePlayheadSeekPosition } from '../src/app/timelinePlayhead.js';
import { createTimelineSelection, getTimelineCellFromPoint, getTimelineSelectionPlaybackOptions } from '../src/app/timelineSelection.js';
import { createDrumsLiveRecordPatch, getDrumsWriteBarRange, hasDrumsHitsInRange } from '../src/app/drumsLiveRecording.js';
import { getMelodyWriteBarRange, getMelodyRecordingRestState } from '../src/app/useMelodyRecordingController.js';

const genreId = 'electronic-edm';
const profileId = AI_PERFORMANCE_PROFILE_ID;
const templates = performanceTemplates(genreId, profileId);
const selection = (tracks) => ({ ...emptySelection(), ...Object.fromEntries(Object.entries(tracks).map(([track, index]) => [track, templates[track][index].id])) });
const short = selection({ drums: 0, chord: 0 });
const long = selection({ drums: 5, melody: 2 });
const saved = [short, long, emptySelection(), emptySelection(), emptySelection()];
const build = (loops = saved, bpm = 100) => createPerformanceImport({ saved: loops, bpm, genreId, profileId });
const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);

test('saved loops import as six editable bars with names, repeated voices, exact events and independent cells', () => {
  const input = structuredClone(saved);
  const imported = build(input, 217);
  const expected = createPerformanceSequence(input, genreId, profileId);
  assert.equal(imported.totalBars, 6);
  assert.equal(imported.bpm, 217);
  assert.deepEqual(imported.trackOrder, ['drums', 'chord', 'bass', 'melody']);
  assert.deepEqual(imported.matrix, expected.matrix);
  assert.equal(imported.selectedClipId, 'drums-bar-0');
  assert.equal(imported.currentBar, 0);
  assert.equal(imported.isPlaying, false);
  assert.equal(imported.clips.ids.length, 12);
  assert.match(imported.clips.byId['melody-bar-5'].name, /Loop 2.*游离旋律/);
  assert.equal(imported.clips.byId['bass-bar-0'], undefined);
  assert.equal(imported.clips.byId['chord-bar-2'], undefined);
  assert.ok(imported.matrix.melody.flat().filter(Boolean).every(cell => cell.timbreId === 'piano'));
  const adapter = createMatrixPlaybackAdapter({ ...imported, matrix: expected.matrix }, { totalBars: 6 });
  assert.deepEqual(collectProjectEvents(imported), Array.from({ length: 96 }, (_, step) => adapter.getEventsForFlatStep(step)).flat());
  imported.matrix.drums[0][0].instruments.push('snare');
  assert.deepEqual(input, saved);
  assert.notDeepEqual(imported.matrix, build().matrix);
});

test('empty slots and unrelated drafts are excluded; all genres retain their performance sounds', () => {
  const imported = createPerformanceImport({ saved: [emptySelection(), short, emptySelection(), long, emptySelection()], drafts: Array(5).fill(long), bpm: 100, genreId, profileId });
  assert.equal(imported.totalBars, 6);
  assert.match(imported.clips.byId['drums-bar-0'].name, /Loop 2/);
  assert.match(imported.clips.byId['melody-bar-5'].name, /Loop 4/);
  assert.throws(() => build(Array.from({ length: 5 }, emptySelection)), /先保存/);
  for (const genre of ['pop', 'hip-hop', 'r-and-b', 'electronic-edm', 'rock']) {
    const catalog = performanceTemplates(genre);
    const loops = Array.from({ length: 5 }, (_, index) => Object.fromEntries(Object.entries(catalog).map(([track, options]) => [track, options[index].id])));
    const result = createPerformanceImport({ saved: loops, genreId: genre, bpm: 40 });
    assert.equal(result.totalBars, 10);
    assert.deepEqual(result.matrix, createPerformanceSequence(loops, genre).matrix);
    assert.deepEqual([...new Set(result.matrix.melody.flat().filter(Boolean).map(cell => cell.timbreId))].sort(), ['blues', 'yangqin']);
  }
});

test('twenty bars support edits, copy/paste, move, fill, clear and new tracks without shrinking', () => {
  reset();
  useMusicStore.setState(build(Array(5).fill(long)));
  let state = useMusicStore.getState();
  assert.equal(state.totalBars, 20);
  state.setCell('bass', 19, 15, { type: 'bass', note: 'C1', duration: '16n' });
  const clip = state.createClip('bass', 19);
  assert.ok(clip);
  assert.equal(state.createClip('bass', 20), null);
  state.moveClipToBar(clip.id, 8);
  state = useMusicStore.getState();
  assert.equal(state.matrix.bass[8][15].note, 'C1');
  assert.equal(state.matrix.bass[19][15], null);
  const clipboard = state.createTimelineClipboardSnapshot({ startBar: 8, endBar: 9, trackIds: ['bass', 'drums'] });
  assert.ok(state.pasteTimelineClipboardSnapshot(clipboard, 18));
  assert.equal(state.pasteTimelineClipboardSnapshot(clipboard, 19), null);
  const noteStep = state.matrix.melody[19].findIndex(Boolean);
  const edited = setMelodyCellDuration(state.matrix, 19, noteStep, 3);
  assert.equal(edited.melody[19][noteStep].timbreId, 'piano');
  assert.equal(edited.melody[19][noteStep].durationSteps, 3);
  assert.equal(applyBasicDrumsAllBars(state.matrix).drums.length, 20);
  state.clearTrack('drums');
  assert.equal(useMusicStore.getState().matrix.drums.length, 20);
  const addedId = state.addTrackInstance('melody');
  assert.equal(useMusicStore.getState().matrix[addedId].length, 20);
  state.clearMatrix();
  assert.equal(useMusicStore.getState().matrix[addedId].length, 20);
  assert.ok(Object.values(useMusicStore.getState().matrix).every(track => track.length === 20));
  reset();
  assert.equal(useMusicStore.getState().totalBars, 8);
});

test('import snapshots preserve prior history and fully restore length, mix, selection and notes through undo/redo', () => {
  reset();
  useMusicStore.getState().setTrackVolume('drums', -7);
  useMusicStore.getState().toggleTrackMute('chord');
  useMusicStore.getState().createClip('bass', 7);
  const before = createUndoSnapshot({ appState: useMusicStore.getState() });
  useMusicStore.setState(build());
  const six = createUndoSnapshot({ appState: useMusicStore.getState() });
  useMusicStore.setState(build(Array(5).fill(long), 240));
  const twenty = createUndoSnapshot({ appState: useMusicStore.getState() });
  const undone = createUndoTransition({ currentSnapshot: twenty, undoHistory: [before, six] });
  assert.equal(undone.undoHistory.length, 1);
  restoreUndoSnapshot({ snapshot: undone.snapshot, store: useMusicStore });
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), six);
  const redone = createRedoTransition({ currentSnapshot: six, ...undone });
  restoreUndoSnapshot({ snapshot: redone.snapshot, store: useMusicStore });
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), twenty);
  restoreUndoSnapshot({ snapshot: before, store: useMusicStore });
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), before);
  delete before.appState.totalBars;
  useMusicStore.setState({ totalBars: 20 });
  restoreUndoSnapshot({ snapshot: before, store: useMusicStore });
  assert.equal(useMusicStore.getState().totalBars, 8);
  assert.equal(getTotalBars({}), 8);
  reset();
});

test('late-bar seek, selection, keyboard, recording and banked hardware cover bars 9–20', () => {
  const state = build(Array(5).fill(long));
  assert.equal(isValidAppCommand({ type: C.TRANSPORT_SEEK, bar: 19, step: 15 }, state), true);
  assert.equal(isValidAppCommand({ type: C.TRANSPORT_SEEK, bar: 20, step: 0 }, state), false);
  assert.equal(isValidAppCommand({ type: C.TRANSPORT_TOGGLE_PLAY, maxPlaybackSteps: 320 }, state), true);
  assert.equal(mapKeyboardEventToCommand({ key: 'ArrowRight' }, { ...state, seekBar: 7, seekStep: 15 }).bar, 8);
  assert.deepEqual(getTimelinePlayheadSeekPosition(1599, { left: 0, width: 1600 }, 20), { bar: 19, step: 15, flatStep: 319 });
  const ids = state.trackOrder;
  assert.equal(getTimelineCellFromPoint({ clientX: 1500, clientY: 20, rect: { left: 0, top: 0, width: 1600, height: 400 }, trackIds: ids, totalBars: 20 }).bar, 18);
  const range = createTimelineSelection({ trackId: 'drums', bar: 8 }, { trackId: 'melody', bar: 19 }, ids, 20);
  assert.equal(getTimelineSelectionPlaybackOptions(range, 20).maxPlaybackSteps, 192);
  assert.equal(getDrumsWriteBarRange(8, 19, 20).length, 12);
  assert.equal(getMelodyWriteBarRange(19, 19, 20).length, 1);
  assert.ok(hasDrumsHitsInRange(state.matrix, 18, 19));
  assert.ok(createDrumsLiveRecordPatch({ activeTrackId: 'drums', bar: 19, step: 15, instrument: 'kick', isPlaying: true, phase: 'recording', totalBars: 20 }));
  assert.equal(getMelodyRecordingRestState({ activeTrackId: 'melody', melodyRhythmTemplateId: 'chinese', selectedClip: { trackId: 'melody', bar: 17 }, totalBars: 20 }).totalBars, 3);
  const context = { matrix: state.matrix, drumsActive: true, drumsClipBars: Array.from({ length: 20 }, (_, i) => i), selectedBar: 17 };
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 11, 127], context).bar, 16);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 14, 127], context).bar, 19);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 15, 127], context), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 94, 127], { ...context, selectedBar: 7 }).bar, 8);
  const leds = createLaunchpadXDrumsLedFrame(context);
  assert.notEqual(leds.find(([, note]) => note === 12)[2], 0);
  assert.equal(leds.find(([, note]) => note === 15)[2], 0);
});

function midiTrackEndTicks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ticks = [];
  for (let start = 14; start < bytes.length;) {
    const end = start + 8 + view.getUint32(start + 4);
    let pos = start + 8, tick = 0;
    const vlq = () => { let n = 0, byte; do { byte = bytes[pos++]; n = (n << 7) | (byte & 127); } while (byte & 128); return n; };
    while (pos < end) {
      tick += vlq();
      const status = bytes[pos++];
      if (status === 255) { pos++; const size = vlq(); pos += size; }
      else pos += (status & 0xf0) === 0xc0 ? 1 : 2;
    }
    ticks.push(tick); start = end;
  }
  return ticks;
}

test('project and MIDI exports retain all twenty bars, including the last bar and its final rests', () => {
  const state = build(Array(5).fill(long));
  const project = createProjectFile(state);
  assert.equal(project.arrangement.totalBars, 20);
  assert.equal(project.arrangement.matrix.melody.length, 20);
  assert.ok(collectProjectEvents(state).some(event => event.bar === 19));
  assert.deepEqual(midiTrackEndTicks(createMidiFile(state)), Array(5).fill(20 * 1920));
  assert.equal(createProjectFile({ ...state, totalBars: undefined }).arrangement.totalBars, 8);
});

test('WAV rendering preserves gated duration for previously imported melody without a playback mode', async (t) => {
  const starts = [], stops = [], ramps = [], files = [], contexts = [];
  class OfflineContext {
    constructor(channels, frames, rate) { contexts.push({ channels, frames, rate }); this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime: (v, time) => ramps.push(time) }, connect() { return this; } }; }
    createBufferSource() { return { playbackRate: {}, connect() { return this; }, start: time => starts.push(time), stop: time => stops.push(time) }; }
    async decodeAudioData() { return { duration: 10 }; }
    async startRendering() { return { numberOfChannels: 2, length: 2, sampleRate: 44100, getChannelData: () => new Float32Array(2) }; }
  }
  t.mock.method(globalThis, 'fetch', async url => { files.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; });
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = OfflineContext;
  t.after(() => { if (original) globalThis.OfflineAudioContext = original; else delete globalThis.OfflineAudioContext; });
  const previousImport = build(Array(5).fill(long));
  previousImport.matrix.melody.flat().filter(Boolean).forEach(cell => { delete cell.playbackMode; });
  const result = await renderProjectToWav(previousImport);
  assert.equal(result.durationSeconds, 48);
  assert.equal(contexts[0].frames, 51 * 44100);
  assert.ok(starts.some(time => time >= 19 * 2.4));
  assert.ok(files.some(file => /Melody\/Melody_/.test(file)));
  assert.ok(!files.some(file => /Yangqin|Blues/.test(file)));
  assert.ok(ramps.length > 0);
  assert.ok(stops.some(time => Math.abs(time - .55) < 1e-8)); // First note: step 2 (0.3s) + 0.15s duration + 0.1s release.
  for (const [loops, bars] of [[[short], 2], [[long], 4], [[short, long], 6]]) {
    const state = build([...loops, ...Array.from({ length: 5 - loops.length }, emptySelection)]);
    const wav = await renderProjectToWav(state);
    assert.equal(wav.durationSeconds, bars * 4 * 60 / 100);
    // The existing three-second sound tail remains; unused timeline cells add no silence.
    assert.equal(contexts.at(-1).frames, Math.ceil((wav.durationSeconds + 3) * 44100));
  }
});

test('choosing a new editor melody timbre updates imported notes without changing durations or saved templates', () => {
  reset();
  useMusicStore.setState(build());
  const original = structuredClone(useMusicStore.getState().matrix.melody);
  useMusicStore.getState().setMelodyStyleTemplate('blues', 'blues');
  const changed = useMusicStore.getState();
  assert.ok(changed.matrix.melody.flat().filter(Boolean).every(cell => cell.timbreId === 'blues'));
  assert.deepEqual(changed.matrix.melody.map(bar => bar.map(cell => cell ? { ...cell, timbreId: 'piano' } : cell)), original);
  assert.deepEqual(build().matrix.melody, original);
  reset();
});


test('two, four and six-bar imports retain exact project and MIDI lengths despite eight display positions', () => {
  const drumsOnly = { ...short, chord: null };
  for (const [loops, bars] of [[[drumsOnly], 2], [[long], 4], [[drumsOnly, long], 6]]) {
    const state = build([...loops, ...Array.from({ length: 5 - loops.length }, emptySelection)]);
    assert.equal(getTimelineBars(state), 8);
    assert.equal(createProjectFile(state).arrangement.totalBars, bars);
    assert.ok(Object.values(createProjectFile(state).arrangement.matrix).every(track => track.length === bars));
    assert.deepEqual(midiTrackEndTicks(createMidiFile(state)), Array(5).fill(bars * 1920));
    assert.ok(collectProjectEvents(state).every(event => event.bar < bars));
  }
});
