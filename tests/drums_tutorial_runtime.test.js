import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrumsCell } from '../src/domain/drumsCells.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import {
  completeTutorialPrimaryAction,
  createTutorialState,
  getTutorialViewModel,
  handleTutorialClipOpen,
  handleTutorialControlAction,
  handleTutorialDrumMove,
  handleTutorialDrumToggle,
  handleTutorialPlaybackComplete,
  handleTutorialPlaybackPosition,
  isTutorialStepComplete,
} from '../src/tutorial/drumsTutorialRuntime.js';
import { DRUMS_TUTORIAL_STEPS } from '../src/tutorial/drumsTutorialSteps.js';
import {
  TUTORIAL_DIRECTORY_ITEMS,
  TUTORIAL_STEP_IDS,
} from '../src/tutorial/tutorialStepIds.js';

function getStep(stepId) {
  return DRUMS_TUTORIAL_STEPS.find((step) => step.id === stepId);
}

test('phase 1 starts by requiring the first drums clip to open', () => {
  const step = getStep(TUTORIAL_STEP_IDS.DRUMS_OPEN_FIRST_CLIP);
  const progress = createTutorialState();
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.canManualNext, false);
  assert.equal(viewModel.locked, true);
  assert.equal(viewModel.displayCopy, step.copy);
  assert.deepEqual(viewModel.targets.timelineBars, [{ bar: 0, role: 'target' }]);

  const wrongTrack = handleTutorialClipOpen({
    bar: 0,
    progress,
    step,
    trackId: 'bass',
  });
  assert.equal(wrongTrack.allowed, false);

  const opened = handleTutorialClipOpen({
    bar: 0,
    progress,
    step,
    trackId: 'drums',
  });
  assert.equal(opened.allowed, true);
  assert.equal(opened.shouldAdvance, true);
  assert.equal(opened.nextProgress.firstDrumsClipOpened, true);
  assert.equal(isTutorialStepComplete(step, opened.nextProgress), true);
});

test('phase 1 highlights current-bar generation and playback completion controls', () => {
  const generateStep = getStep(TUTORIAL_STEP_IDS.DRUMS_GENERATE_CURRENT_BAR);
  const matrix = createInitialMatrix();
  let progress = {
    ...createTutorialState(),
    firstDrumsClipOpened: true,
  };

  const generateViewModel = getTutorialViewModel({
    matrix,
    progress,
    selectedBar: 0,
    step: generateStep,
  });
  assert.equal(generateViewModel.locked, true);
  assert.deepEqual(generateViewModel.targets.controls, [
    { name: 'generate-current-drums-bar', role: 'target' },
  ]);

  const wrongControl = handleTutorialControlAction({
    control: 'generate-all-drums-bars',
    progress,
    selectedBar: 0,
    step: generateStep,
  });
  assert.equal(wrongControl.allowed, false);

  const generated = handleTutorialControlAction({
    control: 'generate-current-drums-bar',
    progress,
    selectedBar: 0,
    step: generateStep,
  });
  assert.equal(generated.allowed, true);
  assert.equal(generated.shouldAdvance, true);
  assert.equal(generated.nextProgress.currentDrumsBarGenerated, true);
  progress = generated.nextProgress;

  const playbackStep = getStep(TUTORIAL_STEP_IDS.DRUMS_LISTEN_FIRST_CLIP);
  const playbackViewModel = getTutorialViewModel({
    matrix,
    progress,
    selectedBar: 0,
    step: playbackStep,
  });
  assert.deepEqual(playbackViewModel.targets.controls, [
    { name: 'transport-play', role: 'target' },
  ]);

  const earlyComplete = handleTutorialPlaybackComplete({
    bar: 1,
    progress,
    step: playbackStep,
    trackId: 'drums',
  });
  assert.equal(earlyComplete.allowed, false);

  const completed = handleTutorialPlaybackComplete({
    bar: 0,
    progress,
    step: playbackStep,
    trackId: 'drums',
  });
  assert.equal(completed.allowed, true);
  assert.equal(completed.shouldAdvance, true);
  assert.equal(completed.nextProgress.firstClipPlaybackComplete, true);
});

test('phase 1 tracks fill-clips and all-bars generation controls', () => {
  const fillStep = getStep(TUTORIAL_STEP_IDS.DRUMS_FILL_TRACK_CLIPS);
  let progress = {
    ...createTutorialState(),
    currentDrumsBarGenerated: true,
    firstClipPlaybackComplete: true,
    firstDrumsClipOpened: true,
  };

  const fillViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: fillStep,
  });
  assert.deepEqual(fillViewModel.targets.controls, [
    { name: 'fill-empty-clips:drums', role: 'target' },
  ]);

  const filled = handleTutorialControlAction({
    control: 'fill-empty-clips:drums',
    progress,
    step: fillStep,
  });
  assert.equal(filled.allowed, true);
  assert.equal(filled.shouldAdvance, true);
  assert.equal(filled.nextProgress.drumsTrackClipsFilled, true);
  progress = filled.nextProgress;

  const allBarsStep = getStep(TUTORIAL_STEP_IDS.DRUMS_GENERATE_ALL_BARS);
  const allBarsViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: allBarsStep,
  });
  assert.deepEqual(allBarsViewModel.targets.controls, [
    { name: 'generate-all-drums-bars', role: 'target' },
  ]);

  const generatedAll = handleTutorialControlAction({
    control: 'generate-all-drums-bars',
    progress,
    step: allBarsStep,
  });
  assert.equal(generatedAll.allowed, true);
  assert.equal(generatedAll.shouldAdvance, true);
  assert.equal(generatedAll.nextProgress.allDrumsBarsGenerated, true);
});

test('kick variation highlights blue green and yellow target classes until completion', () => {
  const step = getStep(TUTORIAL_STEP_IDS.DRUMS_ADD_KICK_VARIATION);
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = createDrumsCell(['kick', 'hihat']);
  const progress = {
    ...createTutorialState(),
    allDrumsBarsGenerated: true,
    drumsTrackClipsFilled: true,
  };

  const viewModel = getTutorialViewModel({
    matrix,
    progress,
    selectedBar: 0,
    step,
  });
  assert.equal(viewModel.locked, false);
  assert.equal(viewModel.primaryLabel, '完成添加');
  assert.equal(viewModel.primaryDisabled, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'transport-play', role: 'target' },
  ]);
  assert.deepEqual(viewModel.targets.drumCells, [
    { bar: 0, instrument: 'kick', role: 'target-blue', steps: [4, 12] },
    { bar: 0, instrument: 'kick', role: 'target-green', steps: [2, 6, 10, 14] },
    { bar: 0, instrument: 'kick', role: 'target-yellow', steps: [1, 3, 5, 7, 9, 11, 13, 15] },
  ]);

  const playAction = handleTutorialControlAction({
    control: 'transport-play',
    progress,
    selectedBar: 0,
    step,
  });
  assert.equal(playAction.allowed, true);
  assert.equal(playAction.shouldAdvance, false);
  assert.equal(playAction.nextProgress, progress);

  const wrongInstrument = handleTutorialDrumToggle({
    instrument: 'snare',
    matrix,
    progress,
    selectedBar: 0,
    step,
    stepIndex: 2,
  });
  assert.equal(wrongInstrument.allowed, true);
  assert.equal(wrongInstrument.nextProgress.kickVariationEdited, false);

  const existingKickClick = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress,
    selectedBar: 0,
    step,
    stepIndex: 0,
  });
  assert.equal(existingKickClick.allowed, true);
  assert.equal(existingKickClick.nextProgress.kickVariationEdited, false);
  assert.deepEqual(existingKickClick.nextProgress.kickVariationEditedCells, []);
  assert.deepEqual(existingKickClick.nextProgress.kickVariationOriginalRemovedCells, ['0:0']);

  matrix.drums[0][0] = createDrumsCell(['hihat']);
  const existingKickAddedBack = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress: existingKickClick.nextProgress,
    selectedBar: 0,
    step,
    stepIndex: 0,
  });
  assert.equal(existingKickAddedBack.allowed, true);
  assert.equal(existingKickAddedBack.nextProgress.kickVariationEdited, false);
  assert.deepEqual(existingKickAddedBack.nextProgress.kickVariationEditedCells, []);
  assert.deepEqual(existingKickAddedBack.nextProgress.kickVariationOriginalRemovedCells, []);

  matrix.drums[0][0] = createDrumsCell(['kick', 'hihat']);
  const existingReaddedViewModel = getTutorialViewModel({
    matrix,
    progress: existingKickAddedBack.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.deepEqual(existingReaddedViewModel.targets.drumCells, [
    { bar: 0, instrument: 'kick', role: 'target-blue', steps: [4, 12] },
    { bar: 0, instrument: 'kick', role: 'target-green', steps: [2, 6, 10, 14] },
    { bar: 0, instrument: 'kick', role: 'target-yellow', steps: [1, 3, 5, 7, 9, 11, 13, 15] },
  ]);

  matrix.drums[0][0] = createDrumsCell(['kick', 'hihat']);
  const accepted = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress,
    selectedBar: 0,
    step,
    stepIndex: 2,
  });
  assert.equal(accepted.allowed, true);
  assert.equal(accepted.shouldAdvance, false);
  assert.equal(accepted.nextProgress.kickVariationEdited, true);
  assert.deepEqual(accepted.nextProgress.kickVariationEditedCells, ['0:2']);

  matrix.drums[0][2] = createDrumsCell(['kick']);
  const readyViewModel = getTutorialViewModel({
    matrix,
    progress: accepted.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.equal(readyViewModel.primaryDisabled, false);
  assert.deepEqual(readyViewModel.targets.drumCells, [
    { bar: 0, instrument: 'kick', role: 'target-blue', steps: [4, 12] },
    { bar: 0, instrument: 'kick', role: 'target-green', steps: [6, 10, 14] },
    { bar: 0, instrument: 'kick', role: 'target-yellow', steps: [1, 3, 5, 7, 9, 11, 13, 15] },
  ]);

  const removed = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress: accepted.nextProgress,
    selectedBar: 0,
    step,
    stepIndex: 2,
  });
  assert.equal(removed.allowed, true);
  assert.equal(removed.nextProgress.kickVariationEdited, false);
  assert.deepEqual(removed.nextProgress.kickVariationEditedCells, []);

  const complete = completeTutorialPrimaryAction({
    progress: accepted.nextProgress,
    step,
  });
  assert.equal(complete.allowed, true);
  assert.equal(complete.shouldAdvance, true);
  assert.equal(complete.nextProgress.kickVariationComplete, true);
});

test('kick variation keeps non-recommended added kicks out of tutorial completion', () => {
  const step = getStep(TUTORIAL_STEP_IDS.DRUMS_ADD_KICK_VARIATION);
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = createDrumsCell(['kick', 'hihat']);
  const progress = {
    ...createTutorialState(),
    allDrumsBarsGenerated: true,
    drumsTrackClipsFilled: true,
  };

  const added = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress,
    selectedBar: 0,
    step,
    stepIndex: 8,
  });
  assert.equal(added.allowed, true);
  assert.equal(added.nextProgress.kickVariationEdited, false);
  assert.deepEqual(added.nextProgress.kickVariationEditedCells, []);

  matrix.drums[0][8] = createDrumsCell(['kick', 'snare', 'hihat']);
  const viewModel = getTutorialViewModel({
    matrix,
    progress: added.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.deepEqual(viewModel.targets.drumCells, [
    { bar: 0, instrument: 'kick', role: 'target-blue', steps: [4, 12] },
    { bar: 0, instrument: 'kick', role: 'target-green', steps: [2, 6, 10, 14] },
    { bar: 0, instrument: 'kick', role: 'target-yellow', steps: [1, 3, 5, 7, 9, 11, 13, 15] },
  ]);
  assert.equal(viewModel.primaryDisabled, true);
});

test('kick drag step prepares source and target cells and completes by primary action', () => {
  const step = getStep(TUTORIAL_STEP_IDS.DRUMS_DRAG_KICK);
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = createDrumsCell(['kick', 'hihat']);
  const progress = {
    ...createTutorialState(),
    kickVariationComplete: true,
    kickVariationEdited: true,
  };

  const viewModel = getTutorialViewModel({
    matrix,
    progress,
    selectedBar: 0,
    step,
  });
  assert.equal(viewModel.locked, false);
  assert.equal(viewModel.primaryLabel, '完成拖拽');
  assert.equal(viewModel.primaryDisabled, true);
  assert.deepEqual(viewModel.targets.controls, []);
  assert.deepEqual(viewModel.targets.drumCells, [
    { bar: 0, instrument: 'kick', role: 'source', steps: [0] },
    { bar: 0, instrument: 'kick', role: 'target', steps: [2] },
  ]);

  const clicked = handleTutorialDrumToggle({
    instrument: 'kick',
    matrix,
    progress,
    selectedBar: 0,
    step,
    stepIndex: 2,
  });
  assert.equal(clicked.allowed, true);
  assert.equal(clicked.shouldAdvance, false);

  const moved = handleTutorialDrumMove({
    fromStep: 0,
    instrument: 'kick',
    matrix,
    progress,
    selectedBar: 0,
    step,
    toStep: 2,
  });
  assert.equal(moved.allowed, true);
  assert.equal(moved.shouldAdvance, false);
  assert.equal(moved.nextProgress.kickDragMoved, true);
  assert.deepEqual(moved.nextMatrixPatch, [
    { bar: 0, cell: { instruments: ['hihat'] }, step: 0 },
    { bar: 0, cell: { instruments: ['kick'] }, step: 2 },
  ]);

  const movedViewModel = getTutorialViewModel({
    matrix,
    progress: moved.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.deepEqual(movedViewModel.targets.controls, [
    { name: 'transport-play', role: 'target' },
  ]);

  const complete = completeTutorialPrimaryAction({
    progress: moved.nextProgress,
    step,
  });
  assert.equal(complete.allowed, true);
  assert.equal(complete.shouldAdvance, true);
  assert.equal(complete.nextProgress.kickDragComplete, true);
});

test('free create step keeps editor open and advances only from continue exploration', () => {
  const step = getStep(TUTORIAL_STEP_IDS.DRUMS_FREE_CREATE);
  const progress = {
    ...createTutorialState(),
    kickDragComplete: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, false);
  assert.equal(viewModel.primaryLabel, '继续探索');
  assert.equal(viewModel.primaryDisabled, false);
  assert.deepEqual(viewModel.targets, {
    controls: [],
    drumCells: [],
    playhead: null,
    timelineBars: [],
  });

  const continued = completeTutorialPrimaryAction({
    progress,
    step,
  });
  assert.equal(continued.allowed, true);
  assert.equal(continued.shouldAdvance, true);
  assert.equal(continued.nextProgress.kickDragComplete, true);
});

test('target 4 starts by filling chord clips from the chord track control', () => {
  const step = getStep(TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS);
  const progress = {
    ...createTutorialState(),
    kickDragComplete: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'fill-empty-clips:chord', role: 'target' },
  ]);

  const wrongTrack = handleTutorialControlAction({
    control: 'fill-empty-clips:drums',
    progress,
    step,
  });
  assert.equal(wrongTrack.allowed, false);

  const filled = handleTutorialControlAction({
    control: 'fill-empty-clips:chord',
    progress,
    step,
  });
  assert.equal(filled.allowed, true);
  assert.equal(filled.shouldAdvance, true);
  assert.equal(filled.nextProgress.chordTrackClipsFilled, true);
});

test('target 4 template workspace completes only after applying Doo-wop and a groove', () => {
  const step = getStep(TUTORIAL_STEP_IDS.CHORD_SELECT_PROGRESSION_TEMPLATE);
  const progress = {
    ...createTutorialState(),
    chordTrackClipsFilled: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'chord-template-workspace-button', role: 'target' },
    { name: 'chord-template-card:doowop', role: 'target' },
    { name: 'chord-groove-card:block-basic', role: 'target' },
    { name: 'chord-groove-card:block-syncopated', role: 'target' },
    { name: 'chord-template-apply', role: 'target' },
  ]);

  const legacyScope = handleTutorialControlAction({
    control: 'chord-template-apply-global',
    progress,
    step,
  });
  assert.equal(legacyScope.allowed, false);

  const selected = handleTutorialControlAction({
    control: 'chord-template-apply',
    progress,
    step,
  });
  assert.equal(selected.allowed, true);
  assert.equal(selected.shouldAdvance, true);
  assert.equal(selected.nextProgress.chordTemplateSelected, true);
});

test('target 4 chord listen step enables next after the first four bars', () => {
  const step = getStep(TUTORIAL_STEP_IDS.CHORD_LISTEN_LOOP);
  let progress = {
    ...createTutorialState(),
    chordTemplateSelected: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.equal(viewModel.showCompleteButton, true);
  assert.equal(viewModel.primaryLabel, '下一步');
  assert.equal(viewModel.primaryDisabled, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'transport-play', role: 'target' },
    { name: 'chord-template-workspace-button', role: 'allowed' },
    { name: 'chord-template-card:axis', role: 'allowed' },
    { name: 'chord-template-card:doowop', role: 'allowed' },
    { name: 'chord-template-card:andalusian', role: 'allowed' },
    { name: 'chord-template-card:canon', role: 'allowed' },
    { name: 'chord-template-card:blues', role: 'allowed' },
    { name: 'chord-template-card:jazz251', role: 'allowed' },
    { name: 'chord-groove-card:block-basic', role: 'allowed' },
    { name: 'chord-groove-card:block-syncopated', role: 'allowed' },
    { name: 'chord-template-apply', role: 'allowed' },
  ]);

  const blockedNext = completeTutorialPrimaryAction({
    progress,
    step,
  });
  assert.equal(blockedNext.allowed, false);

  const play = handleTutorialControlAction({
    control: 'transport-play',
    progress,
    step,
  });
  assert.equal(play.allowed, true);
  assert.equal(play.shouldAdvance, false);
  assert.equal(play.nextProgress.chordLoopPlaybackStarted, true);
  progress = play.nextProgress;

  for (const bar of [0, 1, 2]) {
    const visited = handleTutorialPlaybackPosition({
      bar,
      progress,
      step,
      stepIndex: 0,
      trackId: 'chord',
    });
    assert.equal(visited.allowed, true);
    assert.equal(visited.shouldAdvance, false);
    assert.equal(visited.nextProgress.chordLoopPlaybackComplete, false);
    progress = visited.nextProgress;
  }

  const completed = handleTutorialPlaybackPosition({
    bar: 3,
    progress,
    step,
    stepIndex: 0,
    trackId: 'chord',
  });
  assert.equal(completed.allowed, true);
  assert.equal(completed.shouldAdvance, false);
  assert.equal(completed.nextProgress.chordLoopPlaybackComplete, true);
  assert.deepEqual(completed.nextProgress.chordLoopVisitedBars, [0, 1, 2, 3]);

  const readyViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress: completed.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.equal(readyViewModel.primaryDisabled, false);

  const next = completeTutorialPrimaryAction({
    progress: completed.nextProgress,
    step,
  });
  assert.equal(next.allowed, true);
  assert.equal(next.shouldAdvance, true);
});

test('target 4 chord listen step counts bar visits without play-start or bar-start timing', () => {
  const step = getStep(TUTORIAL_STEP_IDS.CHORD_LISTEN_LOOP);
  let progress = {
    ...createTutorialState(),
    chordTemplateSelected: true,
  };

  for (const [bar, stepIndex] of [[0, 5], [1, 9], [2, 12]]) {
    const visited = handleTutorialPlaybackPosition({
      bar,
      progress,
      step,
      stepIndex,
      trackId: 'chord',
    });
    assert.equal(visited.allowed, true);
    assert.equal(visited.shouldAdvance, false);
    assert.equal(visited.nextProgress.chordLoopPlaybackComplete, false);
    progress = visited.nextProgress;
  }

  const repeated = handleTutorialPlaybackPosition({
    bar: 2,
    progress,
    step,
    stepIndex: 15,
    trackId: 'chord',
  });
  assert.equal(repeated.allowed, true);
  assert.equal(repeated.nextProgress, progress);

  const completed = handleTutorialPlaybackPosition({
    bar: 3,
    progress,
    step,
    stepIndex: 3,
    trackId: 'chord',
  });
  assert.equal(completed.allowed, true);
  assert.equal(completed.shouldAdvance, false);
  assert.equal(completed.nextProgress.chordLoopPlaybackComplete, true);
  assert.deepEqual(completed.nextProgress.chordLoopVisitedBars, [0, 1, 2, 3]);
});

test('target 5 starts by filling bass clips from the bass track control', () => {
  const step = getStep(TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS);
  const progress = {
    ...createTutorialState(),
    chordPassingAdded: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'fill-empty-clips:bass', role: 'target' },
  ]);

  const wrongTrack = handleTutorialControlAction({
    control: 'fill-empty-clips:chord',
    progress,
    step,
  });
  assert.equal(wrongTrack.allowed, false);

  const filled = handleTutorialControlAction({
    control: 'fill-empty-clips:bass',
    progress,
    step,
  });
  assert.equal(filled.allowed, true);
  assert.equal(filled.shouldAdvance, true);
  assert.equal(filled.nextProgress.bassTrackClipsFilled, true);
});

test('target 5 bass groove step accepts any bass groove card', () => {
  const step = getStep(TUTORIAL_STEP_IDS.BASS_SELECT_GROOVE_TEMPLATE);
  const progress = {
    ...createTutorialState(),
    bassTrackClipsFilled: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'bass-groove-button', role: 'target' },
    { name: 'bass-groove-card:bass-8th-basic', role: 'target' },
    { name: 'bass-groove-card:bass-8th-swing', role: 'target' },
    { name: 'bass-groove-card:bass-16th-swing', role: 'target' },
  ]);

  const wrongTemplate = handleTutorialControlAction({
    control: 'chord-groove-card:block-basic',
    progress,
    step,
  });
  assert.equal(wrongTemplate.allowed, false);

  const selected = handleTutorialControlAction({
    control: 'bass-groove-card:bass-8th-swing',
    progress,
    step,
  });
  assert.equal(selected.allowed, true);
  assert.equal(selected.shouldAdvance, true);
  assert.equal(selected.nextProgress.bassGrooveSelected, true);
});

test('target 5 bass listen step enables continue after the first four bars', () => {
  const step = getStep(TUTORIAL_STEP_IDS.BASS_LISTEN_LOOP);
  let progress = {
    ...createTutorialState(),
    bassGrooveSelected: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.equal(viewModel.showCompleteButton, true);
  assert.equal(viewModel.primaryLabel, '继续探索');
  assert.equal(viewModel.primaryDisabled, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'transport-play', role: 'target' },
    { name: 'bass-groove-button', role: 'allowed' },
    { name: 'bass-groove-card:bass-8th-basic', role: 'allowed' },
    { name: 'bass-groove-card:bass-8th-swing', role: 'allowed' },
    { name: 'bass-groove-card:bass-16th-swing', role: 'allowed' },
  ]);

  const blockedNext = completeTutorialPrimaryAction({
    progress,
    step,
  });
  assert.equal(blockedNext.allowed, false);

  const play = handleTutorialControlAction({
    control: 'transport-play',
    progress,
    step,
  });
  assert.equal(play.allowed, true);
  assert.equal(play.shouldAdvance, false);
  assert.equal(play.nextProgress.bassLoopPlaybackStarted, true);
  progress = play.nextProgress;

  for (const [bar, stepIndex] of [[0, 4], [1, 8], [2, 12]]) {
    const visited = handleTutorialPlaybackPosition({
      bar,
      progress,
      step,
      stepIndex,
      trackId: 'bass',
    });
    assert.equal(visited.allowed, true);
    assert.equal(visited.shouldAdvance, false);
    assert.equal(visited.nextProgress.bassLoopPlaybackComplete, false);
    progress = visited.nextProgress;
  }

  const repeated = handleTutorialPlaybackPosition({
    bar: 2,
    progress,
    step,
    stepIndex: 15,
    trackId: 'bass',
  });
  assert.equal(repeated.allowed, true);
  assert.equal(repeated.nextProgress, progress);

  const completed = handleTutorialPlaybackPosition({
    bar: 3,
    progress,
    step,
    stepIndex: 2,
    trackId: 'bass',
  });
  assert.equal(completed.allowed, true);
  assert.equal(completed.shouldAdvance, false);
  assert.equal(completed.nextProgress.bassLoopPlaybackComplete, true);
  assert.deepEqual(completed.nextProgress.bassLoopVisitedBars, [0, 1, 2, 3]);

  const wrongTrack = handleTutorialPlaybackPosition({
    bar: 0,
    progress,
    step,
    stepIndex: 0,
    trackId: 'chord',
  });
  assert.equal(wrongTrack.allowed, false);

  const readyViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress: completed.nextProgress,
    selectedBar: 0,
    step,
  });
  assert.equal(readyViewModel.primaryDisabled, false);

  const finishTarget5 = completeTutorialPrimaryAction({
    progress: completed.nextProgress,
    step,
  });
  assert.equal(finishTarget5.allowed, true);
  assert.equal(finishTarget5.shouldAdvance, true);
  assert.equal(finishTarget5.shouldEnd, undefined);
});

test('target 6 starts by filling melody clips from the melody track control', () => {
  const step = getStep(TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS);
  assert.ok(step);
  const progress = {
    ...createTutorialState(),
    bassLoopPlaybackComplete: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'fill-empty-clips:melody', role: 'target' },
  ]);

  const wrongTrack = handleTutorialControlAction({
    control: 'fill-empty-clips:bass',
    progress,
    step,
  });
  assert.equal(wrongTrack.allowed, false);

  const filled = handleTutorialControlAction({
    control: 'fill-empty-clips:melody',
    progress,
    step,
  });
  assert.equal(filled.allowed, true);
  assert.equal(filled.shouldAdvance, true);
  assert.equal(filled.nextProgress.melodyTrackClipsFilled, true);
});

test('target 6 melody style step advances only after applying Chinese globally', () => {
  const step = getStep(TUTORIAL_STEP_IDS.MELODY_SELECT_SCALE);
  assert.ok(step);
  const progress = {
    ...createTutorialState(),
    melodyTrackClipsFilled: true,
  };
  const viewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step,
  });

  assert.equal(viewModel.locked, true);
  assert.deepEqual(viewModel.targets.controls, [
    { name: 'melody-style-button', role: 'target' },
    { name: 'melody-style-card:chinese', role: 'target' },
    { name: 'melody-style-apply-global', role: 'target' },
  ]);

  const cardSelection = handleTutorialControlAction({
    control: 'melody-style-card:chinese',
    progress,
    step,
  });
  assert.equal(cardSelection.allowed, false);

  const wrongStyle = handleTutorialControlAction({
    control: 'melody-style-apply-global',
    progress,
    step,
    templateId: 'blues',
  });
  assert.equal(wrongStyle.allowed, false);

  const selected = handleTutorialControlAction({
    control: 'melody-style-apply-global',
    progress,
    step,
    templateId: 'chinese',
  });
  assert.equal(selected.allowed, true);
  assert.equal(selected.shouldAdvance, true);
  assert.equal(selected.nextProgress.melodyScaleSelected, true);
});

test('target 6 melody examples advance by primary buttons and then end tutorial', () => {
  const intro1Step = getStep(TUTORIAL_STEP_IDS.MELODY_EXAMPLE_INTRO_1);
  const play1Step = getStep(TUTORIAL_STEP_IDS.MELODY_PLAY_EXAMPLE_1);
  const intro2Step = getStep(TUTORIAL_STEP_IDS.MELODY_EXAMPLE_INTRO_2);
  const play2Step = getStep(TUTORIAL_STEP_IDS.MELODY_PLAY_EXAMPLE_2);
  const play3Step = getStep(TUTORIAL_STEP_IDS.MELODY_PLAY_EXAMPLE_3);
  const freeStep = getStep(TUTORIAL_STEP_IDS.MELODY_FREE_CREATE);
  assert.ok(intro1Step);
  assert.ok(play1Step);
  assert.ok(intro2Step);
  assert.ok(play2Step);
  assert.ok(play3Step);
  assert.ok(freeStep);

  let progress = {
    ...createTutorialState(),
    melodyScaleSelected: true,
  };

  const intro1ViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: intro1Step,
  });
  assert.equal(intro1ViewModel.locked, false);
  assert.equal(intro1ViewModel.showCompleteButton, true);
  assert.equal(intro1ViewModel.primaryLabel, '开始弹奏');
  assert.deepEqual(intro1ViewModel.targets.controls, [
    { name: 'melody-example-keys:AAFFGGF', role: 'target' },
  ]);

  const startExample = completeTutorialPrimaryAction({ progress, step: intro1Step });
  assert.equal(startExample.allowed, true);
  assert.equal(startExample.shouldAdvance, true);
  assert.equal(startExample.shouldStartPlaybackAfterAdvance, true);
  assert.equal(startExample.nextProgress.melodyExampleStarted, true);
  assert.equal(startExample.nextProgress.melodyExampleStep, 1);
  progress = startExample.nextProgress;

  const play1ViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: play1Step,
  });
  assert.equal(play1ViewModel.primaryLabel, '继续探索');
  assert.deepEqual(play1ViewModel.targets.controls, [
    { name: 'melody-example-keys:AAFFGGF', role: 'target' },
  ]);
  const nextToIntro2 = completeTutorialPrimaryAction({ progress, step: play1Step });
  assert.equal(nextToIntro2.allowed, true);
  assert.equal(nextToIntro2.shouldAdvance, true);
  assert.equal(nextToIntro2.shouldStartPlaybackAfterAdvance, undefined);
  assert.equal(nextToIntro2.nextProgress.melodyExampleStep, 2);
  progress = nextToIntro2.nextProgress;

  const intro2ViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: intro2Step,
  });
  assert.equal(intro2ViewModel.primaryLabel, '开始弹奏');
  assert.deepEqual(intro2ViewModel.targets.controls, [
    { name: 'melody-example-keys:GASDDSAGDSAG', role: 'target' },
  ]);
  const startSecondExample = completeTutorialPrimaryAction({ progress, step: intro2Step });
  assert.equal(startSecondExample.allowed, true);
  assert.equal(startSecondExample.shouldAdvance, true);
  assert.equal(startSecondExample.shouldStartPlaybackAfterAdvance, true);
  progress = startSecondExample.nextProgress;

  const play2ViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: play2Step,
  });
  assert.deepEqual(play2ViewModel.targets.controls, [
    { name: 'melody-example-keys:GASDDSAGDSAG', role: 'target' },
  ]);
  const nextToThird = completeTutorialPrimaryAction({ progress, step: play2Step });
  assert.equal(nextToThird.allowed, true);
  assert.equal(nextToThird.shouldAdvance, true);
  assert.equal(nextToThird.shouldStartPlaybackAfterAdvance, true);
  assert.equal(nextToThird.nextProgress.melodyExampleStep, 3);
  progress = nextToThird.nextProgress;

  const play3ViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: play3Step,
  });
  assert.deepEqual(play3ViewModel.targets.controls, [
    { name: 'melody-example-keys:FGDFGSFGAGAGASA', role: 'target' },
  ]);
  const nextToFree = completeTutorialPrimaryAction({ progress, step: play3Step });
  assert.equal(nextToFree.allowed, true);
  assert.equal(nextToFree.shouldAdvance, true);
  assert.equal(nextToFree.shouldStartPlaybackAfterAdvance, undefined);
  assert.equal(nextToFree.nextProgress.melodyFreeCreateReady, true);
  progress = nextToFree.nextProgress;

  const freeViewModel = getTutorialViewModel({
    matrix: createInitialMatrix(),
    progress,
    selectedBar: 0,
    step: freeStep,
  });
  assert.equal(freeViewModel.showCompleteButton, true);
  assert.equal(freeViewModel.primaryLabel, '开始创作');
  const finishTutorial = completeTutorialPrimaryAction({ progress, step: freeStep });
  assert.equal(finishTutorial.allowed, true);
  assert.equal(finishTutorial.shouldAdvance, false);
  assert.equal(finishTutorial.shouldEnd, undefined);
  assert.equal(finishTutorial.shouldCompleteTutorial, true);
});

test('only melody example start actions request tutorial count-in playback', () => {
  const progress = {
    ...createTutorialState(),
    kickVariationEdited: true,
    kickDragMoved: true,
    chordLoopPlaybackComplete: true,
    chordEnriched: true,
    chordPassingAdded: true,
    bassLoopPlaybackComplete: true,
    melodyFreeCreateReady: true,
  };
  const countInStepIds = new Set([
    TUTORIAL_STEP_IDS.MELODY_EXAMPLE_INTRO_1,
    TUTORIAL_STEP_IDS.MELODY_EXAMPLE_INTRO_2,
    TUTORIAL_STEP_IDS.MELODY_PLAY_EXAMPLE_2,
  ]);

  for (const step of DRUMS_TUTORIAL_STEPS) {
    const action = completeTutorialPrimaryAction({ progress, step });
    if (countInStepIds.has(step.id)) {
      assert.equal(action.shouldStartPlaybackAfterAdvance, true, `${step.id} should request count-in playback`);
    } else {
      assert.equal(action.shouldStartPlaybackAfterAdvance, undefined, `${step.id} should not request count-in playback`);
    }
  }
});

test('tutorial directory points to each track teaching start', () => {
  assert.deepEqual(TUTORIAL_DIRECTORY_ITEMS, [
    { id: 'drums', label: 'Drums', stepId: TUTORIAL_STEP_IDS.DRUMS_OPEN_FIRST_CLIP },
    { id: 'chord', label: 'Chord', stepId: TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS },
    { id: 'bass', label: 'Bass', stepId: TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS },
    { id: 'melody', label: 'Melody', stepId: TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS },
  ]);
});
