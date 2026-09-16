import { getTotalBars } from '../domain/projectLength.js';
import { normalizeMelodyProjectState } from '../data/melodyStyleTemplates.js';

const UNDO_HISTORY_LIMIT = 50;

const UNDO_APP_STATE_KEYS = Object.freeze([
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

const UNDO_TUTORIAL_STATE_KEYS = Object.freeze([
  'activeTutorialId',
  'appliedTutorialSetups',
  'currentTutorialStepIndex',
  'tutorialModeActive',
  'tutorialPanelState',
  'tutorialProgress',
  'tutorialSidebarCollapsed',
  'tutorialStepCheckpoints',
  'tutorialSessions',
  'tutorialVisible',
]);

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Set) return new Set([...value].map(cloneValue));
  if (Array.isArray(value)) return value.map(cloneValue);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
  );
}

function pickStateKeys(source = {}, keys = []) {
  return Object.fromEntries(
    keys.map((key) => [key, cloneValue(source[key])]),
  );
}

function normalizeValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: [...value].map(normalizeValue),
    };
  }
  if (Array.isArray(value)) return value.map(normalizeValue);

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeValue(value[key])]),
  );
}

function createUndoSnapshot({
  appState,
  tutorialState,
  editorState = {},
} = {}) {
  return {
    appState: pickStateKeys(appState, UNDO_APP_STATE_KEYS),
    editorState: cloneValue(editorState),
    tutorialState: pickStateKeys(tutorialState, UNDO_TUTORIAL_STATE_KEYS),
  };
}

function hasUndoSnapshotChanged(before, after) {
  return JSON.stringify(normalizeValue(before)) !== JSON.stringify(normalizeValue(after));
}

function pushUndoSnapshot(history = [], snapshot, limit = UNDO_HISTORY_LIMIT) {
  if (!snapshot) return history;
  const lastSnapshot = history.at(-1);
  if (lastSnapshot && !hasUndoSnapshotChanged(lastSnapshot, snapshot)) return history;

  return [...history, cloneValue(snapshot)].slice(-limit);
}

function pushHistoryCheckpoint({
  undoHistory = [],
  snapshot,
  limit = UNDO_HISTORY_LIMIT,
} = {}) {
  return {
    undoHistory: pushUndoSnapshot(undoHistory, snapshot, limit),
    redoHistory: [],
  };
}

function createUndoTransition({
  currentSnapshot,
  redoHistory = [],
  undoHistory = [],
  limit = UNDO_HISTORY_LIMIT,
} = {}) {
  const snapshot = undoHistory.at(-1);
  if (!snapshot) {
    return {
      redoHistory,
      snapshot: null,
      undoHistory,
    };
  }

  return {
    redoHistory: pushUndoSnapshot(redoHistory, currentSnapshot, limit),
    snapshot: cloneValue(snapshot),
    undoHistory: undoHistory.slice(0, -1).map(cloneValue),
  };
}

function createRedoTransition({
  currentSnapshot,
  redoHistory = [],
  undoHistory = [],
  limit = UNDO_HISTORY_LIMIT,
} = {}) {
  const snapshot = redoHistory.at(-1);
  if (!snapshot) {
    return {
      redoHistory,
      snapshot: null,
      undoHistory,
    };
  }

  return {
    redoHistory: redoHistory.slice(0, -1).map(cloneValue),
    snapshot: cloneValue(snapshot),
    undoHistory: pushUndoSnapshot(undoHistory, currentSnapshot, limit),
  };
}

function restoreUndoSnapshot({
  setTimelineSelection,
  setActiveTutorialId,
  setAppliedTutorialSetups,
  setCurrentTutorialStepIndex,
  setTutorialModeActive,
  setTutorialPanelState,
  setTutorialProgress,
  setTutorialSessions,
  setTutorialSidebarCollapsed,
  setTutorialStepCheckpoints,
  setTutorialVisible,
  snapshot,
  store,
} = {}) {
  if (!snapshot) return false;

  store?.setState?.(normalizeMelodyProjectState({ ...cloneValue(snapshot.appState), totalBars: getTotalBars(snapshot.appState) }));
  setTimelineSelection?.(cloneValue(snapshot.editorState?.timelineSelection ?? null));
  setActiveTutorialId?.(cloneValue(snapshot.tutorialState.activeTutorialId));
  setCurrentTutorialStepIndex?.(cloneValue(snapshot.tutorialState.currentTutorialStepIndex));
  setTutorialProgress?.(cloneValue(snapshot.tutorialState.tutorialProgress));
  setTutorialPanelState?.(cloneValue(snapshot.tutorialState.tutorialPanelState));
  setTutorialVisible?.(cloneValue(snapshot.tutorialState.tutorialVisible));
  setTutorialModeActive?.(cloneValue(snapshot.tutorialState.tutorialModeActive));
  setTutorialSidebarCollapsed?.(cloneValue(snapshot.tutorialState.tutorialSidebarCollapsed));
  setAppliedTutorialSetups?.(cloneValue(snapshot.tutorialState.appliedTutorialSetups));
  setTutorialStepCheckpoints?.(cloneValue(snapshot.tutorialState.tutorialStepCheckpoints));
  setTutorialSessions?.(cloneValue(snapshot.tutorialState.tutorialSessions));
  return true;
}

export {
  UNDO_HISTORY_LIMIT,
  createRedoTransition,
  createUndoSnapshot,
  createUndoTransition,
  hasUndoSnapshotChanged,
  pushHistoryCheckpoint,
  pushUndoSnapshot,
  restoreUndoSnapshot,
};
