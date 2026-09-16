import { TOTAL_BARS } from '../domain/musicConstants.js';
import {
  createClipId,
  createClipRecord,
} from '../domain/clipHelpers.js';
import { applyBassGrooveTemplateToExistingClips } from '../app/bassActions.js';
import { applyChordTemplateWorkspaceToExistingClips } from '../app/chordGrooveActions.js';
import { applyBasicDrumsAllBars } from '../app/drumsPatternActions.js';
import { createTutorialState } from './drumsTutorialRuntime.js';
import { DRUMS_TUTORIAL_STEPS } from './drumsTutorialSteps.js';
import { createTutorialCheckpoint } from './tutorialCheckpoints.js';
import { TUTORIAL_STEP_IDS } from './tutorialStepIds.js';

const CHORD_TEMPLATE_ID = 'doowop';
const CHORD_GROOVE_TEMPLATE_ID = 'block-basic';
const BASS_GROOVE_TEMPLATE_ID = 'bass-8th-basic';

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneValue);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
  );
}

function addTrackClips(clips, trackId) {
  const nextClips = cloneValue(clips);

  for (let bar = 0; bar < TOTAL_BARS; bar += 1) {
    const clipId = createClipId(trackId, bar);
    if (nextClips.byId[clipId]) continue;

    const clip = createClipRecord(trackId, bar);
    nextClips.ids.push(clip.id);
    nextClips.byId[clip.id] = clip;
  }

  return nextClips;
}

function getStepIndex(stepId) {
  return DRUMS_TUTORIAL_STEPS.findIndex((step) => step.id === stepId);
}

function shouldPrepareAtLeast(stepIndex, stepId) {
  const threshold = getStepIndex(stepId);
  return threshold >= 0 && stepIndex >= threshold;
}

function getTargetTrackId(stepIndex) {
  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS)) return 'melody';
  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS)) return 'bass';
  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS)) return 'chord';
  return 'drums';
}

function createProgressForStepIndex(stepIndex) {
  const progress = createTutorialState();

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS)) {
    progress.firstDrumsClipOpened = true;
    progress.currentDrumsBarGenerated = true;
    progress.firstClipPlaybackComplete = true;
    progress.drumsTrackClipsFilled = true;
    progress.allDrumsBarsGenerated = true;
    progress.kickVariationEdited = true;
    progress.kickVariationComplete = true;
    progress.kickDragMoved = true;
    progress.kickDragComplete = true;
  }

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS)) {
    progress.chordTrackClipsFilled = true;
    progress.chordTemplateSelected = true;
    progress.chordLoopPlaybackComplete = true;
  }

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS)) {
    progress.bassTrackClipsFilled = true;
    progress.bassGrooveSelected = true;
    progress.bassLoopPlaybackComplete = true;
  }

  return progress;
}

function createDirectoryAppState(initialState, stepIndex) {
  let clips = cloneValue(initialState.clips);
  let matrix = cloneValue(initialState.matrix);

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS)) {
    clips = addTrackClips(clips, 'drums');
    matrix = applyBasicDrumsAllBars(matrix);
  }

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS)) {
    clips = addTrackClips(clips, 'chord');
    matrix = applyChordTemplateWorkspaceToExistingClips(
      matrix,
      clips,
      {
        progressionTemplateId: CHORD_TEMPLATE_ID,
        grooveTemplateId: CHORD_GROOVE_TEMPLATE_ID,
      },
    );
  }

  if (shouldPrepareAtLeast(stepIndex, TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS)) {
    clips = addTrackClips(clips, 'bass');
    matrix = applyBassGrooveTemplateToExistingClips(matrix, clips, BASS_GROOVE_TEMPLATE_ID);
  }

  return {
    ...initialState,
    activeTrackId: getTargetTrackId(stepIndex),
    clips,
    currentBar: 0,
    currentStep: 0,
    matrix,
    seekBar: 0,
    seekStep: 0,
    selectedBar: 0,
    selectedClipId: null,
  };
}

function createTutorialDirectoryCheckpoint({
  initialState,
  stepId,
} = {}) {
  const stepIndex = getStepIndex(stepId);
  if (!initialState || stepIndex < 0) return null;

  return createTutorialCheckpoint({
    appState: createDirectoryAppState(initialState, stepIndex),
    appliedTutorialSetups: new Set(),
    tutorialProgress: createProgressForStepIndex(stepIndex),
  });
}

export {
  createTutorialDirectoryCheckpoint,
};
