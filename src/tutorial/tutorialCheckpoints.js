import { getTotalBars } from '../domain/projectLength.js';
import { normalizeMelodyProjectState } from '../data/melodyStyleTemplates.js';

const CHECKPOINT_APP_STATE_KEYS = Object.freeze([
  'activeTrackId',
  'bpm',
  'totalBars',
  'clips',
  'currentBar',
  'currentStep',
  'matrix',
  'melodyRhythmTemplateId',
  'melodyScaleId',
  'melodyTimbreId',
  'mutedTracks',
  'nextTrackCreatedIndex',
  'nextTrackOrdinalByType',
  'primaryChordTrackId',
  'rootKey',
  'scale',
  'seekBar',
  'seekStep',
  'selectedBar',
  'selectedClipId',
  'trackInstancesById',
  'trackOrder',
  'visibleTrackIds',
  'volumes',
]);

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Set) return new Set([...value].map(cloneValue));
  if (Array.isArray(value)) return value.map(cloneValue);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
  );
}

function pickCheckpointAppState(appState = {}) {
  return Object.fromEntries(
    CHECKPOINT_APP_STATE_KEYS.map((key) => [key, cloneValue(appState[key])]),
  );
}

function createTutorialCheckpoint({
  appState,
  appliedTutorialSetups = new Set(),
  tutorialProgress,
} = {}) {
  return {
    appState: pickCheckpointAppState(appState),
    appliedTutorialSetups: cloneValue(appliedTutorialSetups),
    tutorialProgress: cloneValue(tutorialProgress),
  };
}

function restoreTutorialCheckpoint({
  checkpoint,
  setAppliedTutorialSetups,
  setTutorialProgress,
  store,
} = {}) {
  if (!checkpoint) return false;

  store?.setState?.(normalizeMelodyProjectState({ ...cloneValue(checkpoint.appState), totalBars: getTotalBars(checkpoint.appState) }));
  setTutorialProgress?.(cloneValue(checkpoint.tutorialProgress));
  setAppliedTutorialSetups?.(cloneValue(checkpoint.appliedTutorialSetups));
  return true;
}

function pruneTutorialCheckpoints(checkpoints = {}, fromIndex = 0) {
  return Object.fromEntries(
    Object.entries(checkpoints).filter(([index]) => Number(index) < fromIndex),
  );
}

export {
  createTutorialCheckpoint,
  pruneTutorialCheckpoints,
  restoreTutorialCheckpoint,
};
