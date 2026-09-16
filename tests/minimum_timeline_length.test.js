import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import useMusicStore from '../src/store/useMusicStore.js';
import { getTimelineBars } from '../src/domain/projectLength.js';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { emptySelection, performanceTemplates } from '../src/app/performanceModel.js';
import { createTimelineTracks } from '../src/app/timelineViewModels.js';
import { TRACK_UI } from '../src/app/uiShellData.js';
import { createClipPasteDestination, resolveClipPasteTarget } from '../src/app/clipPasteDestination.js';
import { getTimelineSelectionPlaybackOptions } from '../src/app/timelineSelection.js';
import { createUndoSnapshot, restoreUndoSnapshot } from '../src/app/undoHistory.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { mapLaunchpadXMessageToCommand } from '../src/input/launchpadXMap.js';
import { isValidAppCommand } from '../src/input/commandGuards.js';
import { selectLaunchpadTrackClip } from '../src/app/launchpadClipSelection.js';
import { mapKeyboardEventToCommand } from '../src/input/keyboardMap.js';
import { createDrumsLiveRecordPatch } from '../src/app/drumsLiveRecording.js';
import { getMelodyRecordingRestState } from '../src/app/useMelodyRecordingController.js';

const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
afterEach(reset);
function loadShortProject() {
  reset();
  const templates = performanceTemplates('pop');
  const saved = Array.from({ length: 5 }, emptySelection);
  saved[0].drums = templates.drums[0].id;
  useMusicStore.setState(createPerformanceImport({ saved, bpm: 100, genreId: 'pop' }));
  return useMusicStore.getState();
}
function timeline(state) {
  return createTimelineTracks({
    ...state, barNumbers: Array.from({ length: getTimelineBars(state) }, (_, i) => i + 1), trackUi: TRACK_UI,
  });
}

test('two-bar import shows eight positions without creating clips, data or extra playback bars', () => {
  const state = loadShortProject();
  const before = createUndoSnapshot({ appState: state });
  const tracks = timeline(state);
  for (const track of tracks) {
    assert.equal(track.bars.length, 8);
    assert.ok(track.bars.slice(2).every(bar => bar.clip === null && bar.canAddClip));
  }
  assert.equal(state.clips.ids.length, 2);
  assert.ok(Object.values(state.matrix).every(bars => bars.length === 2));
  const clipboard = state.createClipClipboardSnapshot('drums-bar-0');
  const destination = createClipPasteDestination('drums', 7, getTimelineBars(state));
  assert.equal(resolveClipPasteTarget({ state, clipClipboard: clipboard, pasteDestination: destination }).targetHasContent, false);
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), before);
  const adapter = createMatrixPlaybackAdapter(state, { totalBars: state.totalBars });
  assert.deepEqual(adapter.getPositionForFlatStep(32), { bar: 0, step: 0 });
  assert.equal(getTimelineBars({ totalBars: 20 }), 20);
  assert.equal(getTimelineBars({}), 8);
});

test('creating an empty eighth clip atomically grows every track and undo restores the short project', () => {
  const state = loadShortProject();
  const extraTrack = state.addTrackInstance('melody');
  const before = createUndoSnapshot({ appState: useMusicStore.getState() });
  const updates = [];
  const unsubscribe = useMusicStore.subscribe(next => updates.push(next));
  const clip = state.createClip('bass', 7);
  unsubscribe();
  assert.equal(updates.length, 1);
  const next = useMusicStore.getState();
  assert.equal(next.totalBars, 8);
  assert.ok(Object.values(next.matrix).every(bars => bars.length === 8));
  assert.equal(next.matrix[extraTrack].length, 8);
  assert.equal(next.clips.ids.length, 3);
  const bass = timeline(next).find(track => track.id === 'bass');
  assert.equal(bass.bars[6].clip, null);
  assert.equal(bass.bars[7].clip.id, clip.id);
  assert.ok(!bass.bars[7].clip.hasContent);
  assert.equal(bass.bars[7].canAddClip, false);
  next.setCell('bass', 7, 0, { type: 'bass', note: 'C2' });
  assert.equal(timeline(useMusicStore.getState()).find(t => t.id === 'bass').bars[7].clip.hasContent, true);
  const after = createUndoSnapshot({ appState: useMusicStore.getState() });
  restoreUndoSnapshot({ snapshot: before, store: useMusicStore });
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), before);
  restoreUndoSnapshot({ snapshot: after, store: useMusicStore });
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), after);
  next.clearStep('bass', 7, 0);
  assert.ok(useMusicStore.getState().clips.byId[clip.id]);
  next.deleteClip(clip.id);
  assert.equal(useMusicStore.getState().totalBars, 8);
  assert.equal(useMusicStore.getState().clips.byId[clip.id], undefined);
});

test('move and paste grow only on success, retaining content and leaving intervening slots empty', () => {
  for (const operation of ['move', 'paste']) {
    const state = loadShortProject();
    const expected = structuredClone(state.matrix.drums[0]);
    const before = createUndoSnapshot({ appState: state });
    const snapshot = state.createClipClipboardSnapshot('drums-bar-0');
    assert.equal(state.pasteClipClipboardSnapshot({ ...snapshot, barData: [] }, 'drums', 7), null);
    assert.equal(state.moveClipToBar('missing', 7), null);
    assert.equal(state.moveClipToBar('drums-bar-0', 8), null);
    assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), before);
    const result = operation === 'move'
      ? state.moveClipToBar('drums-bar-0', 7)
      : state.pasteClipClipboardSnapshot(snapshot, 'drums', 7);
    assert.ok(result);
    const next = useMusicStore.getState();
    assert.equal(next.totalBars, 8);
    assert.ok(Object.values(next.matrix).every(bars => bars.length === 8));
    assert.deepEqual(next.matrix.drums[7], expected);
    assert.equal(next.clips.byId['drums-bar-6'], undefined);
    assert.equal(Boolean(next.clips.byId['drums-bar-0']), operation === 'paste');
  }
});

test('range copying accepts display-only tail positions but does not materialize trailing empty slots', () => {
  const state = loadShortProject();
  const range = state.createTimelineClipboardSnapshot({ startBar: 0, endBar: 3, trackIds: ['drums'] });
  assert.equal(range.items.length, 2);
  const before = createUndoSnapshot({ appState: state });
  assert.equal(state.pasteTimelineClipboardSnapshot({ ...range, items: [...range.items, { ...range.items[0], barOffset: 9 }] }, 4), null);
  assert.deepEqual(createUndoSnapshot({ appState: useMusicStore.getState() }), before);
  assert.ok(state.pasteTimelineClipboardSnapshot(range, 4));
  assert.equal(useMusicStore.getState().totalBars, 6);
  assert.equal(getTimelineBars(useMusicStore.getState()), 8);
  assert.ok(useMusicStore.getState().clips.byId['drums-bar-5']);
  assert.equal(useMusicStore.getState().clips.byId['drums-bar-7'], undefined);
});

test('selection preview intersects the actual arrangement and a tail-only selection has nothing to play', () => {
  assert.deepEqual(getTimelineSelectionPlaybackOptions({ startBar: 1, endBar: 7, trackIds: ['drums'] }, 2), {
    audibleTrackIds: ['drums'], bar: 1, step: 0, maxPlaybackSteps: 16,
  });
  assert.equal(getTimelineSelectionPlaybackOptions({ startBar: 2, endBar: 7, trackIds: ['drums'] }, 2), null);
});

test('the eighth hardware pad creates a real clip; editing, recording and keyboard seeking then use eight bars', () => {
  const state = loadShortProject();
  const command = mapLaunchpadXMessageToCommand([0x90, 18, 127], {
    matrix: state.matrix, drumsActive: true, drumsClipBars: [0, 1], selectedBar: 0,
  });
  assert.equal(command.bar, 7);
  assert.equal(isValidAppCommand(command, state), true);
  assert.equal(isValidAppCommand({ type: 'transport.seek', bar: 7, step: 0 }, state), false);
  let undoCount = 0;
  const selected = selectLaunchpadTrackClip({
    bar: 7, trackId: 'drums', store: useMusicStore,
    withUndoCheckpoint: fn => { undoCount++; fn(); },
  });
  assert.equal(selected.created, true);
  assert.equal(undoCount, 1);
  const next = useMusicStore.getState();
  const patch = createDrumsLiveRecordPatch({
    activeTrackId: 'drums', bar: 7, step: 15, instrument: 'snare', isPlaying: true,
    phase: 'recording', hasClip: true, totalBars: next.totalBars,
  });
  next.setCell('drums', patch.bar, patch.step, patch.nextCell);
  assert.deepEqual(useMusicStore.getState().matrix.drums[7][15].instruments, ['snare']);
  assert.deepEqual(mapKeyboardEventToCommand({ key: 'ArrowRight' }, { ...next, seekBar: 7, seekStep: 14 }), {
    type: 'transport.seek', bar: 7, step: 15,
  });
  assert.equal(getMelodyRecordingRestState({
    activeTrackId: 'melody', melodyRhythmTemplateId: 'chinese',
    selectedClip: next.createClip('melody', 7), totalBars: 8,
  }).totalBars, 1);
});
