import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { selectLaunchpadMelodyClip } from '../src/app/launchpadMelodyClipSelection.js';
import useMusicStore from '../src/store/useMusicStore.js';

beforeEach(() => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);
  useMusicStore.getState().createClip('melody', 0);
});

function createHarness({ canSelectClip = () => true } = {}) {
  const checkpoints = [];
  const seeks = [];
  const select = (bar) => selectLaunchpadMelodyClip({
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

test('hardware selection creates a missing Melody clip without per-clip template state', () => {
  const { checkpoints, select } = createHarness();

  assert.deepEqual(select(4), { ok: true, created: true, bar: 4 });
  assert.equal(useMusicStore.getState().selectedClipId, 'melody-bar-4');
  assert.equal(useMusicStore.getState().selectedBar, 4);
  assert.equal(
    Object.hasOwn(useMusicStore.getState().clips.byId['melody-bar-4'], 'melodyRhythmTemplateId'),
    false,
  );
  assert.deepEqual(checkpoints, ['checkpoint']);

  assert.deepEqual(select(4), { ok: true, created: false, bar: 4 });
  assert.deepEqual(checkpoints, ['checkpoint']);
});

test('hardware Melody selection respects active track and tutorial guards', () => {
  const blocked = createHarness({ canSelectClip: () => false });
  assert.deepEqual(blocked.select(3), { ok: false, reason: 'blocked' });
  assert.equal(useMusicStore.getState().getClipForTrackBar('melody', 3), null);

  useMusicStore.getState().selectClip('drums-bar-0');
  const inactive = createHarness();
  assert.deepEqual(inactive.select(5), { ok: false, reason: 'inactive-melody' });
  assert.equal(useMusicStore.getState().getClipForTrackBar('melody', 5), null);
});

test('hardware Melody selection seeks to the target bar start', () => {
  const { seeks, select } = createHarness();
  useMusicStore.getState().createClip('melody', 3);
  useMusicStore.getState().selectClip('melody-bar-0');
  useMusicStore.setState({ currentBar: 0, currentStep: 7, isPlaying: true });

  assert.deepEqual(select(3), { ok: true, created: false, bar: 3 });
  assert.deepEqual(seeks, [[3, 0]]);
});

test('switching Melody clips never changes the global style', () => {
  const { select } = createHarness();
  useMusicStore.getState().setMelodyStyleTemplate('blues');
  useMusicStore.getState().createClip('melody', 3);

  assert.deepEqual(select(3), { ok: true, created: false, bar: 3 });
  assert.equal(useMusicStore.getState().melodyScaleId, 'blues');
  assert.equal(useMusicStore.getState().melodyRhythmTemplateId, 'blues');
});
