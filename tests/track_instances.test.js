import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  createDefaultTrackState,
  getTrackInstanceIdsByType,
  getTrackType,
} from '../src/domain/trackInstances.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import {
  createTrackScopedClips,
  createTrackScopedMatrix,
} from '../src/app/trackInstanceScope.js';
import useMusicStore from '../src/store/useMusicStore.js';

beforeEach(() => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);
});

test('track instance state starts with compatible core ids and a stable primary chord', () => {
  const state = createDefaultTrackState();

  assert.deepEqual(state.trackOrder, ['drums', 'chord', 'bass', 'melody']);
  assert.equal(state.primaryChordTrackId, 'chord');
  assert.deepEqual(
    Object.values(state.trackInstancesById).map(({ id, ordinal, type }) => ({
      id,
      ordinal,
      type,
    })),
    [
      { id: 'drums', ordinal: 1, type: 'drums' },
      { id: 'chord', ordinal: 1, type: 'chord' },
      { id: 'bass', ordinal: 1, type: 'bass' },
      { id: 'melody', ordinal: 1, type: 'melody' },
    ],
  );
});

test('duplicate track instances use non-reused ids and own independent state', () => {
  const store = useMusicStore.getState();

  assert.equal(store.addTrackInstance('drums'), 'drums-2');
  let state = useMusicStore.getState();
  state.setCell('drums-2', 0, 0, { instruments: ['snare'] });
  state.setTrackVolume('drums-2', -7);
  state.toggleTrackMute('drums-2');
  state.createClip('drums-2', 0);

  state = useMusicStore.getState();
  assert.equal(state.matrix.drums[0][0], null);
  assert.deepEqual(state.matrix['drums-2'][0][0], { instruments: ['snare'] });
  assert.equal(state.volumes['drums-2'], -7);
  assert.equal(state.mutedTracks['drums-2'], true);
  assert.equal(state.clips.byId['drums-2-bar-0'].trackId, 'drums-2');

  state.addTrackInstance('drums');
  state = useMusicStore.getState();
  assert.equal(state.removeTrackInstance('drums-2'), 'drums-2');
  assert.equal(useMusicStore.getState().addTrackInstance('drums'), 'drums-4');
  assert.deepEqual(
    getTrackInstanceIdsByType(useMusicStore.getState(), 'drums'),
    ['drums', 'drums-3', 'drums-4'],
  );
});

test('track instances can be renamed and reordered without changing their identity', () => {
  const store = useMusicStore.getState();
  const trackId = store.addTrackInstance('melody');

  assert.equal(useMusicStore.getState().renameTrackInstance(trackId, 'Lead Counterline'), trackId);
  assert.equal(useMusicStore.getState().moveTrackInstance(trackId, 1), true);

  const state = useMusicStore.getState();
  assert.equal(state.trackOrder[1], trackId);
  assert.equal(state.visibleTrackIds[1], trackId);
  assert.equal(state.trackInstancesById[trackId].name, 'Lead Counterline');
  assert.equal(state.trackInstancesById[trackId].type, 'melody');
});

test('the last core instance cannot be removed and deletion cleans instance state atomically', () => {
  let state = useMusicStore.getState();
  assert.equal(state.removeTrackInstance('bass'), null);

  const bass2 = state.addTrackInstance('bass');
  state = useMusicStore.getState();
  state.createClip(bass2, 2);
  state.setCell(bass2, 2, 4, { note: 'C1', duration: '16n', type: 'bass' });
  state.setTrackVolume(bass2, -12);
  state.toggleTrackMute(bass2);

  assert.equal(useMusicStore.getState().removeTrackInstance(bass2), bass2);
  state = useMusicStore.getState();
  assert.equal(state.trackInstancesById[bass2], undefined);
  assert.equal(state.matrix[bass2], undefined);
  assert.equal(state.volumes[bass2], undefined);
  assert.equal(state.mutedTracks[bass2], undefined);
  assert.equal(state.clips.byId[`${bass2}-bar-2`], undefined);
  assert.equal(state.activeTrackId, 'melody');
});

test('removing the primary chord promotes the earliest-created remaining chord', () => {
  const store = useMusicStore.getState();
  const chord2 = store.addTrackInstance('chord');
  const chord3 = useMusicStore.getState().addTrackInstance('chord');
  useMusicStore.getState().moveTrackInstance(chord3, 0);

  assert.equal(useMusicStore.getState().removeTrackInstance('chord'), 'chord');
  const state = useMusicStore.getState();
  assert.equal(state.primaryChordTrackId, chord2);
  assert.equal(getTrackType(state, state.primaryChordTrackId), 'chord');
});

test('single clip copy can paste across instances of the same track type', () => {
  const store = useMusicStore.getState();
  const melody2 = store.addTrackInstance('melody');
  let state = useMusicStore.getState();
  const sourceClip = state.createClip('melody', 1);
  state.setCell('melody', 1, 3, {
    duration: '16n',
    note: 'C4',
    type: 'melody',
  });

  state = useMusicStore.getState();
  const snapshot = state.createClipClipboardSnapshot(sourceClip.id);
  const pastedClip = state.pasteClipClipboardSnapshot(snapshot, melody2, 4);

  state = useMusicStore.getState();
  assert.equal(pastedClip.trackId, melody2);
  assert.equal(pastedClip.bar, 4);
  assert.deepEqual(state.matrix[melody2][4][3], {
    duration: '16n',
    note: 'C4',
    type: 'melody',
  });
  assert.equal(state.matrix.melody[4][3], null);
});

test('bass scope reads harmony from the primary chord while editing its own instance', () => {
  const store = useMusicStore.getState();
  const bass2 = store.addTrackInstance('bass');
  let state = useMusicStore.getState();
  state.createClip('chord', 0);
  state.setCell('chord', 0, 0, {
    duration: '4n',
    label: 'Am',
    root: 'A',
    type: 'chord',
  });
  state.createClip(bass2, 0);

  state = useMusicStore.getState();
  const scopedMatrix = createTrackScopedMatrix({
    activeTrackId: bass2,
    activeTrackType: 'bass',
    matrix: state.matrix,
    primaryChordTrackId: state.primaryChordTrackId,
  });
  const scopedClips = createTrackScopedClips({
    activeTrackId: bass2,
    activeTrackType: 'bass',
    clips: state.clips,
    primaryChordTrackId: state.primaryChordTrackId,
    trackInstancesById: state.trackInstancesById,
  });

  assert.equal(scopedMatrix.bass, state.matrix[bass2]);
  assert.equal(scopedMatrix.chord, state.matrix.chord);
  assert.equal(scopedClips.byId['chord-bar-0'].trackId, 'chord');
  assert.equal(scopedClips.byId[`${bass2}-bar-0`].trackId, 'bass');
});

test('matrix playback emits independent events for every playable track instance', () => {
  const store = useMusicStore.getState();
  const drums2 = store.addTrackInstance('drums');
  const melody2 = useMusicStore.getState().addTrackInstance('melody');
  let state = useMusicStore.getState();
  state.setCell('drums', 0, 0, { instruments: ['kick'] });
  state.setCell(drums2, 0, 0, { instruments: ['snare'] });
  state.setCell('melody', 0, 0, {
    duration: '16n',
    note: 'C4',
    type: 'melody',
  });
  state.setCell(melody2, 0, 0, {
    duration: '16n',
    note: 'E4',
    type: 'melody',
  });
  state = useMusicStore.getState();

  const adapter = createMatrixPlaybackAdapter(() => ({
    matrix: useMusicStore.getState().matrix,
    trackInstancesById: useMusicStore.getState().trackInstancesById,
    trackOrder: useMusicStore.getState().trackOrder,
  }));
  const events = adapter.getEventsForStep(0, 0);

  assert.deepEqual(
    events.map(({ trackId, trackType }) => [trackId, trackType]),
    [
      ['drums', 'drums'],
      [drums2, 'drums'],
      ['melody', 'melody'],
      [melody2, 'melody'],
    ],
  );
});
