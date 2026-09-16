import assert from 'node:assert/strict';
import { test } from 'node:test';
import useMusicStore from '../src/store/useMusicStore.js';
import { createTutorialDirectoryCheckpoint } from '../src/tutorial/tutorialDirectoryCheckpoints.js';
import { TUTORIAL_STEP_IDS } from '../src/tutorial/tutorialStepIds.js';

function getClipBars(checkpoint, trackId) {
  return checkpoint.appState.clips.ids
    .map((id) => checkpoint.appState.clips.byId[id])
    .filter((clip) => clip?.trackId === trackId)
    .map((clip) => clip.bar)
    .sort((left, right) => left - right);
}

function trackHasContent(checkpoint, trackId) {
  return checkpoint.appState.matrix[trackId].some((bar) => bar.some(Boolean));
}

test('directory checkpoint for drums starts from a clean new project', () => {
  const checkpoint = createTutorialDirectoryCheckpoint({
    initialState: useMusicStore.getInitialState(),
    stepId: TUTORIAL_STEP_IDS.DRUMS_OPEN_FIRST_CLIP,
  });

  assert.deepEqual(getClipBars(checkpoint, 'drums'), [0]);
  assert.deepEqual(getClipBars(checkpoint, 'chord'), []);
  assert.equal(trackHasContent(checkpoint, 'drums'), false);
  assert.equal(checkpoint.appState.activeTrackId, 'drums');
  assert.equal(checkpoint.appState.selectedClipId, null);
  assert.equal(checkpoint.tutorialProgress.drumsTrackClipsFilled, false);
});

test('directory checkpoint for chord prepares drums while leaving chord unfilled', () => {
  const checkpoint = createTutorialDirectoryCheckpoint({
    initialState: useMusicStore.getInitialState(),
    stepId: TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS,
  });

  assert.deepEqual(getClipBars(checkpoint, 'drums'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'chord'), []);
  assert.equal(trackHasContent(checkpoint, 'drums'), true);
  assert.equal(trackHasContent(checkpoint, 'chord'), false);
  assert.equal(checkpoint.appState.activeTrackId, 'chord');
  assert.equal(checkpoint.appState.selectedClipId, null);
  assert.equal(checkpoint.tutorialProgress.drumsTrackClipsFilled, true);
  assert.equal(checkpoint.tutorialProgress.allDrumsBarsGenerated, true);
  assert.equal(checkpoint.tutorialProgress.chordTrackClipsFilled, false);
});

test('directory checkpoint for bass prepares drums and chord while leaving bass unfilled', () => {
  const checkpoint = createTutorialDirectoryCheckpoint({
    initialState: useMusicStore.getInitialState(),
    stepId: TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS,
  });

  assert.deepEqual(getClipBars(checkpoint, 'drums'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'chord'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'bass'), []);
  assert.equal(trackHasContent(checkpoint, 'chord'), true);
  assert.equal(trackHasContent(checkpoint, 'bass'), false);
  assert.equal(checkpoint.appState.activeTrackId, 'bass');
  assert.equal(checkpoint.appState.selectedClipId, null);
  assert.equal(checkpoint.tutorialProgress.chordTrackClipsFilled, true);
  assert.equal(checkpoint.tutorialProgress.chordTemplateSelected, true);
  assert.equal(checkpoint.tutorialProgress.bassTrackClipsFilled, false);
});

test('directory checkpoint for melody prepares bass while leaving melody unfilled', () => {
  const checkpoint = createTutorialDirectoryCheckpoint({
    initialState: useMusicStore.getInitialState(),
    stepId: TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS,
  });

  assert.deepEqual(getClipBars(checkpoint, 'drums'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'chord'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'bass'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClipBars(checkpoint, 'melody'), []);
  assert.equal(trackHasContent(checkpoint, 'bass'), true);
  assert.equal(trackHasContent(checkpoint, 'melody'), false);
  assert.equal(checkpoint.appState.activeTrackId, 'melody');
  assert.equal(checkpoint.appState.selectedClipId, null);
  assert.equal(checkpoint.tutorialProgress.bassTrackClipsFilled, true);
  assert.equal(checkpoint.tutorialProgress.bassGrooveSelected, true);
  assert.equal(checkpoint.tutorialProgress.melodyTrackClipsFilled, false);
});
