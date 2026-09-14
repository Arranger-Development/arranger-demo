import {
  useCallback,
  useRef,
  useState,
} from 'react';

import useMusicStore from '../store/useMusicStore.js';
import { APP_COMMAND_TYPES } from '../input/appCommands.js';
import {
  createRedoTransition,
  createUndoSnapshot,
  createUndoTransition,
  hasUndoSnapshotChanged,
  pushHistoryCheckpoint,
  restoreUndoSnapshot,
} from './undoHistory.js';

function useUndoHistoryController({
  activeTutorialId,
  appliedTutorialSetups,
  clearTutorialAutoAdvanceTimer,
  clearTutorialCountIn,
  currentTutorialStepIndex,
  dispatchAppCommand,
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
  timelineSelection,
  tutorialModeActive,
  tutorialPanelState,
  tutorialProgress,
  tutorialSessions,
  tutorialSidebarCollapsed,
  tutorialStepCheckpoints,
  tutorialVisible,
}) {
  const [undoHistory, setUndoHistory] = useState(() => []);
  const [redoHistory, setRedoHistory] = useState(() => []);
  const volumeUndoSnapshotRef = useRef(null);

  const createCurrentUndoSnapshot = useCallback(() => createUndoSnapshot({
    appState: useMusicStore.getState(),
    editorState: { timelineSelection },
    tutorialState: {
      activeTutorialId,
      appliedTutorialSetups,
      currentTutorialStepIndex,
      tutorialModeActive,
      tutorialPanelState,
      tutorialProgress,
      tutorialSidebarCollapsed,
      tutorialStepCheckpoints,
      tutorialSessions,
      tutorialVisible,
    },
  }), [
    activeTutorialId,
    appliedTutorialSetups,
    currentTutorialStepIndex,
    timelineSelection,
    tutorialModeActive,
    tutorialPanelState,
    tutorialProgress,
    tutorialSidebarCollapsed,
    tutorialStepCheckpoints,
    tutorialSessions,
    tutorialVisible,
  ]);

  const recordUndoSnapshot = useCallback((snapshot) => {
    setUndoHistory((history) => pushHistoryCheckpoint({ undoHistory: history, snapshot }).undoHistory);
    setRedoHistory(() => []);
  }, []);

  const withUndoCheckpoint = useCallback((action, options = {}) => {
    const beforeSnapshot = createCurrentUndoSnapshot();
    const result = action();
    const shouldRecord = options.force === true
      || hasUndoSnapshotChanged(beforeSnapshot, createCurrentUndoSnapshot());

    if (shouldRecord) recordUndoSnapshot(beforeSnapshot);
    return result;
  }, [createCurrentUndoSnapshot, recordUndoSnapshot]);

  const restoreHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;

    clearTutorialAutoAdvanceTimer();
    clearTutorialCountIn();
    void (async () => {
      await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
      restoreUndoSnapshot({
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
        store: useMusicStore,
      });
    })();
  }, [
    clearTutorialAutoAdvanceTimer,
    clearTutorialCountIn,
    dispatchAppCommand,
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
  ]);

  const handleUndo = useCallback(() => {
    const transition = createUndoTransition({
      currentSnapshot: createCurrentUndoSnapshot(),
      redoHistory,
      undoHistory,
    });
    if (!transition.snapshot) return;

    setUndoHistory(transition.undoHistory);
    setRedoHistory(transition.redoHistory);
    restoreHistorySnapshot(transition.snapshot);
  }, [createCurrentUndoSnapshot, redoHistory, restoreHistorySnapshot, undoHistory]);

  const handleRedo = useCallback(() => {
    const transition = createRedoTransition({
      currentSnapshot: createCurrentUndoSnapshot(),
      redoHistory,
      undoHistory,
    });
    if (!transition.snapshot) return;

    setUndoHistory(transition.undoHistory);
    setRedoHistory(transition.redoHistory);
    restoreHistorySnapshot(transition.snapshot);
  }, [createCurrentUndoSnapshot, redoHistory, restoreHistorySnapshot, undoHistory]);

  const handleTrackVolumeChangeStart = useCallback(() => {
    if (volumeUndoSnapshotRef.current) return;
    volumeUndoSnapshotRef.current = createCurrentUndoSnapshot();
  }, [createCurrentUndoSnapshot]);

  const handleTrackVolumeChangeEnd = useCallback(() => {
    const beforeSnapshot = volumeUndoSnapshotRef.current;
    volumeUndoSnapshotRef.current = null;
    if (!beforeSnapshot) return;
    if (hasUndoSnapshotChanged(beforeSnapshot, createCurrentUndoSnapshot())) {
      recordUndoSnapshot(beforeSnapshot);
    }
  }, [createCurrentUndoSnapshot, recordUndoSnapshot]);

  const clearUndoHistory = useCallback(() => {
    volumeUndoSnapshotRef.current = null;
    setRedoHistory([]);
    setUndoHistory([]);
  }, []);

  return {
    canRedo: redoHistory.length > 0,
    canUndo: undoHistory.length > 0,
    clearUndoHistory,
    handleRedo,
    handleTrackVolumeChangeEnd,
    handleTrackVolumeChangeStart,
    handleUndo,
    withUndoCheckpoint,
  };
}

export {
  useUndoHistoryController,
};
