import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrumsCell } from '../src/domain/drumsCells.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import {
  createTutorialCheckpoint,
  pruneTutorialCheckpoints,
  restoreTutorialCheckpoint,
} from '../src/tutorial/tutorialCheckpoints.js';
import { createTutorialState } from '../src/tutorial/drumsTutorialRuntime.js';

function createAppState() {
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = createDrumsCell(['kick']);

  return {
    activeTrackId: 'drums',
    clips: {
      ids: ['drums-bar-0'],
      byId: {
        'drums-bar-0': {
          id: 'drums-bar-0',
          name: 'Drum 01',
          trackId: 'drums',
          bar: 0,
        },
      },
    },
    currentBar: 1,
    currentStep: 4,
    matrix,
    melodyTimbreId: 'yangqin',
    seekBar: 1,
    seekStep: 4,
    selectedBar: 0,
    selectedClipId: 'drums-bar-0',
  };
}

test('tutorial checkpoint captures and restores app state, progress, and setups', () => {
  const appState = createAppState();
  const progress = {
    ...createTutorialState(),
    kickVariationComplete: true,
    kickVariationEditedCells: ['0:2'],
  };
  const appliedTutorialSetups = new Set(['drums-drag-kick']);
  const checkpoint = createTutorialCheckpoint({ appState, tutorialProgress: progress, appliedTutorialSetups });

  appState.matrix.drums[0][0] = createDrumsCell(['snare']);
  appState.clips.byId['drums-bar-0'].name = 'Mutated';
  progress.kickVariationEditedCells.push('0:6');
  appliedTutorialSetups.add('later-step');

  let restoredProgress = null;
  let restoredSetups = null;
  const store = {
    restoredState: null,
    setState(nextState) {
      this.restoredState = nextState;
    },
  };

  const restored = restoreTutorialCheckpoint({
    checkpoint,
    setAppliedTutorialSetups: (setups) => {
      restoredSetups = setups;
    },
    setTutorialProgress: (nextProgress) => {
      restoredProgress = nextProgress;
    },
    store,
  });

  assert.equal(restored, true);
  assert.deepEqual(store.restoredState.matrix.drums[0][0], { instruments: ['kick'] });
  assert.equal(store.restoredState.clips.byId['drums-bar-0'].name, 'Drum 01');
  assert.equal(store.restoredState.activeTrackId, 'drums');
  assert.equal(store.restoredState.selectedBar, 0);
  assert.equal(store.restoredState.selectedClipId, 'drums-bar-0');
  assert.equal(store.restoredState.currentBar, 1);
  assert.equal(store.restoredState.currentStep, 4);
  assert.equal(store.restoredState.melodyTimbreId, 'yangqin');
  assert.equal(store.restoredState.seekBar, 1);
  assert.equal(store.restoredState.seekStep, 4);
  assert.deepEqual(restoredProgress.kickVariationEditedCells, ['0:2']);
  assert.equal(restoredProgress.kickVariationComplete, true);
  assert.deepEqual([...restoredSetups], ['drums-drag-kick']);

  store.restoredState.matrix.drums[0][0] = createDrumsCell(['hihat']);
  restoredProgress.kickVariationEditedCells.push('0:10');
  restoredSetups.add('mutated-after-restore');

  const secondStore = {
    restoredState: null,
    setState(nextState) {
      this.restoredState = nextState;
    },
  };
  let secondProgress = null;
  let secondSetups = null;

  restoreTutorialCheckpoint({
    checkpoint,
    setAppliedTutorialSetups: (setups) => {
      secondSetups = setups;
    },
    setTutorialProgress: (nextProgress) => {
      secondProgress = nextProgress;
    },
    store: secondStore,
  });

  assert.deepEqual(secondStore.restoredState.matrix.drums[0][0], { instruments: ['kick'] });
  assert.deepEqual(secondProgress.kickVariationEditedCells, ['0:2']);
  assert.deepEqual([...secondSetups], ['drums-drag-kick']);
});

test('tutorial checkpoint restore is a no-op when no checkpoint exists', () => {
  let storeCalled = false;
  const restored = restoreTutorialCheckpoint({
    checkpoint: null,
    setAppliedTutorialSetups: () => {},
    setTutorialProgress: () => {},
    store: {
      setState() {
        storeCalled = true;
      },
    },
  });

  assert.equal(restored, false);
  assert.equal(storeCalled, false);
});

test('tutorial checkpoint pruning removes current and later step entries', () => {
  const checkpoints = {
    0: { step: 'open' },
    1: { step: 'generate' },
    2: { step: 'listen' },
    4: { step: 'generate-all' },
  };

  assert.deepEqual(pruneTutorialCheckpoints(checkpoints, 2), {
    0: { step: 'open' },
    1: { step: 'generate' },
  });
});

test('restoring generate step checkpoint clears current bar generation side effects', () => {
  const checkpointAppState = createAppState();
  checkpointAppState.matrix.drums[0][0] = null;
  checkpointAppState.matrix.drums[0][4] = null;
  const checkpointProgress = {
    ...createTutorialState(),
    firstDrumsClipOpened: true,
  };
  const checkpoint = createTutorialCheckpoint({
    appState: checkpointAppState,
    tutorialProgress: checkpointProgress,
    appliedTutorialSetups: new Set(),
  });

  const generatedAppState = createAppState();
  generatedAppState.matrix.drums[0][0] = createDrumsCell(['kick']);
  generatedAppState.matrix.drums[0][4] = createDrumsCell(['snare']);
  const generatedProgress = {
    ...checkpointProgress,
    currentDrumsBarGenerated: true,
  };

  let restoredProgress = generatedProgress;
  restoreTutorialCheckpoint({
    checkpoint,
    setAppliedTutorialSetups: () => {},
    setTutorialProgress: (nextProgress) => {
      restoredProgress = nextProgress;
    },
    store: {
      setState(nextState) {
        Object.assign(generatedAppState, nextState);
      },
    },
  });

  assert.equal(generatedAppState.matrix.drums[0][0], null);
  assert.equal(generatedAppState.matrix.drums[0][4], null);
  assert.equal(restoredProgress.currentDrumsBarGenerated, false);
  assert.equal(restoredProgress.firstDrumsClipOpened, true);
});

test('restoring add-kick step checkpoint clears kick variation side effects', () => {
  const checkpointAppState = createAppState();
  checkpointAppState.matrix.drums[0][2] = null;
  const checkpointProgress = {
    ...createTutorialState(),
    allDrumsBarsGenerated: true,
  };
  const checkpoint = createTutorialCheckpoint({
    appState: checkpointAppState,
    tutorialProgress: checkpointProgress,
    appliedTutorialSetups: new Set(),
  });

  const editedAppState = createAppState();
  editedAppState.matrix.drums[0][2] = createDrumsCell(['kick']);
  const editedProgress = {
    ...checkpointProgress,
    kickVariationComplete: true,
    kickVariationEdited: true,
    kickVariationEditedCells: ['0:2'],
  };

  let restoredProgress = editedProgress;
  restoreTutorialCheckpoint({
    checkpoint,
    setAppliedTutorialSetups: () => {},
    setTutorialProgress: (nextProgress) => {
      restoredProgress = nextProgress;
    },
    store: {
      setState(nextState) {
        Object.assign(editedAppState, nextState);
      },
    },
  });

  assert.equal(editedAppState.matrix.drums[0][2], null);
  assert.equal(restoredProgress.kickVariationEdited, false);
  assert.deepEqual(restoredProgress.kickVariationEditedCells, []);
  assert.equal(restoredProgress.kickVariationComplete, false);
  assert.equal(restoredProgress.allDrumsBarsGenerated, true);
});

test('restoring drag step checkpoint clears drag completion before setup reruns', () => {
  const checkpointAppState = createAppState();
  checkpointAppState.matrix.drums[0][0] = createDrumsCell(['kick']);
  checkpointAppState.matrix.drums[0][2] = null;
  const checkpointProgress = {
    ...createTutorialState(),
    kickVariationComplete: true,
  };
  const checkpointSetups = new Set();
  const checkpoint = createTutorialCheckpoint({
    appState: checkpointAppState,
    tutorialProgress: checkpointProgress,
    appliedTutorialSetups: checkpointSetups,
  });

  const movedAppState = createAppState();
  movedAppState.matrix.drums[0][0] = null;
  movedAppState.matrix.drums[0][2] = createDrumsCell(['kick']);
  const movedProgress = {
    ...checkpointProgress,
    kickDragMoved: true,
    kickDragComplete: true,
  };
  let restoredProgress = movedProgress;
  let restoredSetups = new Set(['drums-drag-kick']);

  restoreTutorialCheckpoint({
    checkpoint,
    setAppliedTutorialSetups: (setups) => {
      restoredSetups = setups;
    },
    setTutorialProgress: (nextProgress) => {
      restoredProgress = nextProgress;
    },
    store: {
      setState(nextState) {
        Object.assign(movedAppState, nextState);
      },
    },
  });

  assert.deepEqual(movedAppState.matrix.drums[0][0], { instruments: ['kick'] });
  assert.equal(movedAppState.matrix.drums[0][2], null);
  assert.equal(restoredProgress.kickDragMoved, false);
  assert.equal(restoredProgress.kickDragComplete, false);
  assert.equal(restoredProgress.kickVariationComplete, true);
  assert.deepEqual([...restoredSetups], []);
});
