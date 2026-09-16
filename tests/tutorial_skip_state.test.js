import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTutorialSkipAppState } from '../src/app/tutorialSkipState.js';
import useMusicStore from '../src/store/useMusicStore.js';

test('tutorial skip enters an empty arrangement without the seeded drums clip', () => {
  const initialState = useMusicStore.getInitialState();
  const skippedState = createTutorialSkipAppState(initialState);

  assert.deepEqual(initialState.clips.ids, ['drums-bar-0']);
  assert.deepEqual(skippedState.clips, { ids: [], byId: {} });
  assert.equal(skippedState.selectedClipId, null);
  assert.equal(skippedState.activeTrackId, 'drums');
  assert.equal(skippedState.selectedBar, 0);
  assert.equal(
    Object.values(skippedState.matrix).every((track) => (
      track.every((bar) => bar.every((cell) => cell === null))
    )),
    true,
  );
});

test('tutorial skip state rejects missing initial state', () => {
  assert.equal(createTutorialSkipAppState(), null);
});
