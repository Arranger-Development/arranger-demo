import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { selectLaunchpadChordClip } from '../src/app/launchpadChordClipSelection.js';
import useMusicStore from '../src/store/useMusicStore.js';

beforeEach(() => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);
  useMusicStore.getState().createClip('chord', 0);
});

function createHarness({ canSelectClip = () => true } = {}) {
  const checkpoints = [];
  const seeks = [];
  const select = (bar) => selectLaunchpadChordClip({
    bar,
    canSelectClip,
    dispatchSeek: (targetBar, targetStep) => seeks.push([targetBar, targetStep]),
    store: useMusicStore,
    withUndoCheckpoint: (callback) => {
      checkpoints.push('checkpoint');
      callback();
    },
  });

  return { checkpoints, seeks, select };
}

test('direct hardware selection creates a missing Chord clip once with undo', () => {
  const { checkpoints, select } = createHarness();

  assert.deepEqual(select(4), { ok: true, created: true, bar: 4 });
  assert.equal(useMusicStore.getState().selectedClipId, 'chord-bar-4');
  assert.equal(useMusicStore.getState().selectedBar, 4);
  assert.deepEqual(useMusicStore.getState().matrix.chord[4], Array(16).fill(null));
  assert.deepEqual(checkpoints, ['checkpoint']);

  assert.deepEqual(select(4), { ok: true, created: false, bar: 4 });
  assert.deepEqual(checkpoints, ['checkpoint']);
  assert.equal(useMusicStore.getState().clips.ids.filter((id) => id === 'chord-bar-4').length, 1);
});

test('hardware selection respects Chord context and tutorial clip guards', () => {
  const blocked = createHarness({ canSelectClip: () => false });
  assert.deepEqual(blocked.select(3), { ok: false, reason: 'blocked' });
  assert.equal(useMusicStore.getState().getClipForTrackBar('chord', 3), null);
  assert.equal(useMusicStore.getState().selectedClipId, 'chord-bar-0');

  useMusicStore.getState().createClip('melody', 2);
  const inactive = createHarness();
  assert.deepEqual(inactive.select(5), { ok: false, reason: 'inactive-chord' });
  assert.equal(useMusicStore.getState().getClipForTrackBar('chord', 5), null);
});

test('hardware Chord selection seeks to the target bar start while playing or stopped', () => {
  const { seeks, select } = createHarness();
  useMusicStore.getState().createClip('chord', 3);
  useMusicStore.getState().selectClip('chord-bar-0');

  useMusicStore.setState({ currentBar: 0, currentStep: 7, isPlaying: false });
  select(3);
  assert.deepEqual(seeks, [[3, 0]]);

  useMusicStore.setState({ currentBar: 3, currentStep: 5, isPlaying: true });
  select(3);
  assert.deepEqual(seeks, [[3, 0], [3, 0]]);

  useMusicStore.setState({ currentBar: 3, currentStep: 0, isPlaying: true });
  select(3);
  assert.deepEqual(seeks, [[3, 0], [3, 0]]);
});
