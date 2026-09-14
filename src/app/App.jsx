import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import audioEngine from '../audio/audioEngineSingleton.js';
import { getAudioExportTrackIds, renderProjectToWav } from '../export/audioFile.js';
import { createExportFilename, downloadBlob } from '../export/download.js';
import { createMidiFileBlob } from '../export/midiFile.js';
import { createProjectFileBlob } from '../export/projectFile.js';
import { APP_COMMAND_TYPES } from '../input/appCommands.js';
import useKeyboardCommands from '../input/useKeyboardCommands.js';
import PerformanceMode from './components/PerformanceMode.jsx';
import useLaunchpadXCommands from '../input/useLaunchpadXCommands.js';
import useMusicStore from '../store/useMusicStore.js';
import {
  DRUMS_DRAG_SOURCE_STEP,
  DRUMS_DRAG_TARGET_STEP,
  DRUMS_TUTORIAL_FIRST_BAR,
  TUTORIAL_CONTROL_TARGETS,
} from '../tutorial/drumsTutorialConstants.js';
import {
  completeTutorialPrimaryAction,
  createTutorialState,
  handleTutorialClipOpen,
  handleTutorialControlAction,
  handleTutorialDrumMove,
  handleTutorialDrumToggle,
  handleTutorialPlaybackComplete,
  handleTutorialPlaybackPosition,
} from '../tutorial/drumsTutorialRuntime.js';
import { DRUMS_TUTORIAL_STEPS } from '../tutorial/drumsTutorialSteps.js';
import {
  createTutorialCheckpoint,
  pruneTutorialCheckpoints,
  restoreTutorialCheckpoint,
} from '../tutorial/tutorialCheckpoints.js';
import { createTutorialDirectoryCheckpoint } from '../tutorial/tutorialDirectoryCheckpoints.js';
import {
  TUTORIAL_STEP_IDS,
} from '../tutorial/tutorialStepIds.js';
import {
  CHILL_TUTORIAL_STAGES,
  CHILL_TUTORIAL_STEPS,
  createChillTutorialSession,
} from '../tutorial/chillTutorialSteps.js';
import {
  createChillTutorialAppState,
  isChillTutorialScoreComplete,
} from '../tutorial/chillTutorialScore.js';
import { applyChillTutorialRecipeSequence } from '../tutorial/chillTutorialRecipeSequence.js';
import {
  TUTORIAL_IDS,
} from '../tutorial/tutorialCatalog.js';
import {
  CHILL_TUTORIAL_RUN_STATES,
  advanceChillTutorialStep,
  beginChillTutorialPreview,
  cancelChillTutorialPreview,
  completeChillTutorialPreview,
} from '../tutorial/chillTutorialRuntime.js';
import { createUiAudioDispatcher } from './audioUiBridge.js';
import {
  applyBassGrooveTemplateToExistingClips,
  clearBassBar,
  createBassPreviewEvents,
  getBassCellToggleResult,
} from './bassActions.js';
import {
  applyChordTemplateWorkspaceToExistingClips,
  applyChordRhythmStepEnrichment,
  applyChordRhythmStepPassingChord,
  clearChordRhythmBar,
  createChordStepHarmonyPreviewEvents,
  createChordTemplateWorkspacePreviewEvents,
  toggleChordRhythmStep,
} from './chordGrooveActions.js';
import {
  applyChordStylePresetToExistingClips,
  applyChordStyleSelectionToExistingClips,
  createChordStylePresetPreviewEvents,
  createChordStyleSelectionPreviewEvents,
} from './chordStylePresetActions.js';
import {
  clearMelodyBar,
  getMelodyCellToggleResult,
} from './melodyActions.js';
import {
  getMelodyRhythmTemplate,
} from './melodyRhythmTemplates.js';
import { BottomEditor } from './components/BottomEditor.jsx';
import { ExportDialog } from './components/ExportDialog.jsx';
import { Timeline } from './components/Timeline.jsx';
import { TopBar } from './components/TopBar.jsx';
import { TracksColumn } from './components/TracksColumn.jsx';
import { TutorialOverlay } from './components/TutorialOverlay.jsx';
import { ChillTutorialOverlay } from './components/ChillTutorialOverlay.jsx';
import { ChillTutorialStageRail } from './components/ChillTutorialStageRail.jsx';
import { TutorialLibraryPanel } from './components/TutorialLibraryPanel.jsx';
import { toggleInstrumentInCell } from './drumSequencerData.js';
import { createDrumsCell, getDrumsCellInstruments } from '../domain/drumsCells.js';
import { createDrumsStepMovePatch } from '../domain/drumsStepMove.js';
import { normalizeBpm } from '../domain/bpm.js';
import {
  canRemoveTrackInstance,
  getTrackInstanceIdsByType,
  getTrackType,
} from '../domain/trackInstances.js';
import { createLaunchpadChordHarmonyState } from './launchpadChordHarmonyState.js';
import { selectLaunchpadChordClip } from './launchpadChordClipSelection.js';
import { selectLaunchpadDrumsClip } from './launchpadDrumsClipSelection.js';
import { selectLaunchpadMelodyClip } from './launchpadMelodyClipSelection.js';
import {
  applyBasicDrumsAllBars,
  applyBasicDrumsBar,
  applyDrumsTemplateToBar,
  applyDrumsTemplateToBars,
  clearDrumsBar,
  createDrumTemplatePreviewEvents,
  getDrumsClipBarIndexes,
} from './drumsPatternActions.js';
import {
  canPageTrackClipBars,
  getAdjacentTrackClipBar,
  getSortedTrackClipBars,
} from './trackBarPaging.js';
import { createTimelineTracks } from './timelineViewModels.js';
import {
  getTimelineSelectionClipIds,
  getTimelineSelectionPlaybackOptions,
} from './timelineSelection.js';
import { syncEditorToPlaybackBar } from './playbackEditorSync.js';
import { syncTrackScrollContainers } from './syncTrackScroll.js';
import {
  createTrackScopedClips,
  createTrackScopedMatrix,
} from './trackInstanceScope.js';
import { createTutorialSkipAppState } from './tutorialSkipState.js';
import { syncEditorToTutorialSuggestedBar } from './tutorialEditorSync.js';
import { useEditorResize } from './useEditorResize.js';
import { useClipClipboardActions } from './useClipClipboardActions.js';
import { useTutorialController } from './useTutorialController.js';
import { useUndoHistoryController } from './useUndoHistoryController.js';
import { useDrumsRecordingController } from './useDrumsRecordingController.js';
import { useMelodyRecordingController } from './useMelodyRecordingController.js';
import {
  BAR_NUMBERS,
  getTrackUiByIds,
  TRACK_UI,
} from './uiShellData.js';

const TUTORIAL_AUTO_ADVANCE_MS = 450;
const CHILL_STEP_AUTO_ADVANCE_MS = 300;
const CHILL_COMPLETE_AUTO_ADVANCE_MS = 800;
const CLEAR_TRACK_LABELS = Object.freeze({
  bass: 'Bass',
  chord: 'Chord',
  drums: 'Drums',
  melody: 'Melody',
});

let tutorialAutoAdvanceTimerId = null;

// JSX component references are not marked as reads by this repository's lint parser.
void ChillTutorialOverlay;
void TutorialLibraryPanel;

function clearTutorialAutoAdvanceTimer() {
  if (tutorialAutoAdvanceTimerId === null) return;

  window.clearTimeout(tutorialAutoAdvanceTimerId);
  tutorialAutoAdvanceTimerId = null;
}

function scheduleTutorialAutoAdvance(callback, delay = TUTORIAL_AUTO_ADVANCE_MS) {
  clearTutorialAutoAdvanceTimer();
  tutorialAutoAdvanceTimerId = window.setTimeout(() => {
    tutorialAutoAdvanceTimerId = null;
    callback();
  }, delay);
}

function createTrackActionScope(state, trackId = state.activeTrackId) {
  const trackType = getTrackType(state, trackId);
  return {
    clips: createTrackScopedClips({
      activeTrackId: trackId,
      activeTrackType: trackType,
      clips: state.clips,
      primaryChordTrackId: state.primaryChordTrackId,
      trackInstancesById: state.trackInstancesById,
    }),
    matrix: createTrackScopedMatrix({
      activeTrackId: trackId,
      activeTrackType: trackType,
      matrix: state.matrix,
      primaryChordTrackId: state.primaryChordTrackId,
    }),
    trackId,
    trackType,
  };
}

export default function App({ genreId = 'pop' }) {
  const [performanceActive, setPerformanceActive] = useState(false);
  const [performanceVisited, setPerformanceVisited] = useState(false);
  const bpm = useMusicStore((state) => state.bpm);
  const rootKey = useMusicStore((state) => state.rootKey);
  const scale = useMusicStore((state) => state.scale);
  const currentBar = useMusicStore((state) => state.currentBar);
  const currentStep = useMusicStore((state) => state.currentStep);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const matrix = useMusicStore((state) => state.matrix);
  const activeTrackId = useMusicStore((state) => state.activeTrackId);
  const melodyRhythmTemplateId = useMusicStore((state) => state.melodyRhythmTemplateId);
  const melodyScaleId = useMusicStore((state) => state.melodyScaleId);
  const melodyTimbreId = useMusicStore((state) => state.melodyTimbreId);
  const selectedBar = useMusicStore((state) => state.selectedBar);
  const selectedClipId = useMusicStore((state) => state.selectedClipId);
  const clips = useMusicStore((state) => state.clips);
  const mutedTracks = useMusicStore((state) => state.mutedTracks);
  const volumes = useMusicStore((state) => state.volumes);
  const trackInstancesById = useMusicStore((state) => state.trackInstancesById);
  const trackOrder = useMusicStore((state) => state.trackOrder);
  const primaryChordTrackId = useMusicStore((state) => state.primaryChordTrackId);
  const activeTrackType = getTrackType({ trackInstancesById }, activeTrackId);
  const melodyEditorIsOpen = activeTrackType === 'melody' && Boolean(selectedClipId);
  const chordActive = activeTrackType === 'chord'
    && Boolean(selectedClipId)
    && clips.byId[selectedClipId]?.trackId === activeTrackId;
  const chordClipBars = useMemo(
    () => getSortedTrackClipBars(clips, activeTrackType === 'chord' ? activeTrackId : 'chord'),
    [activeTrackId, activeTrackType, clips],
  );
  const [launchpadChordHarmonyTarget, setLaunchpadChordHarmonyTarget] = useState(null);
  const chordHarmonyState = useMemo(() => {
    if (!chordActive || !launchpadChordHarmonyTarget) return null;
    const scope = createTrackActionScope({
      activeTrackId,
      clips,
      matrix,
      primaryChordTrackId,
      trackInstancesById,
    }, activeTrackId);
    return createLaunchpadChordHarmonyState({
      ...launchpadChordHarmonyTarget,
      clips: scope.clips,
      matrix: scope.matrix,
    });
  }, [
    activeTrackId,
    chordActive,
    clips,
    launchpadChordHarmonyTarget,
    matrix,
    primaryChordTrackId,
    trackInstancesById,
  ]);
  const drumsActive = activeTrackType === 'drums';
  const drumsClipBars = useMemo(
    () => getSortedTrackClipBars(clips, drumsActive ? activeTrackId : 'drums'),
    [activeTrackId, clips, drumsActive],
  );
  const melodyActive = activeTrackType === 'melody'
    && Boolean(selectedClipId)
    && clips.byId[selectedClipId]?.trackId === activeTrackId;
  const melodyClipBars = useMemo(
    () => getSortedTrackClipBars(clips, melodyActive ? activeTrackId : 'melody'),
    [activeTrackId, clips, melodyActive],
  );
  const [isNewSongConfirmOpen, setIsNewSongConfirmOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportState, setExportState] = useState({ error: '', isExporting: false });
  const [pendingClearAction, setPendingClearAction] = useState(null);
  const [timelineSelection, setTimelineSelection] = useState(null);
  const [
    timelineSelectionPlaybackActive,
    setTimelineSelectionPlaybackActive,
  ] = useState(false);
  const tracksScrollRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const {
    currentEditorResizeValue,
    editorHeightPx,
    editorResizeMaxHeight,
    editorResizeMinHeight,
    handleEditorResizeKeyDown,
    handleEditorResizePointerDown,
    isEditorResizing,
  } = useEditorResize({ activeTrackId, selectedClipId });
  const dispatchAppCommand = useMemo(
    () => createUiAudioDispatcher({ store: useMusicStore, audio: audioEngine }),
    [],
  );

  useEffect(() => {
    if (!launchpadChordHarmonyTarget || chordHarmonyState) return undefined;

    const timeoutId = window.setTimeout(() => setLaunchpadChordHarmonyTarget(null), 0);
    return () => window.clearTimeout(timeoutId);
  }, [chordHarmonyState, launchpadChordHarmonyTarget]);
  const {
    activeTutorialId,
    activeTutorialLocked,
    activeTutorialTarget,
    activeTutorialTargets,
    appliedTutorialSetups,
    chillTutorialActive,
    chillTutorialSession,
    chillTutorialStep,
    clearTutorialCountIn,
    currentTutorialStep,
    currentTutorialStepIndex,
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
    startTutorialCountInPlayback,
    tutorialActive,
    tutorialCountInValue,
    tutorialDirectoryItems,
    tutorialModeActive,
    tutorialPanelState,
    tutorialProgress,
    tutorialSidebarCollapsed,
    tutorialStepCheckpoints,
    tutorialSessions,
    tutorialViewModel,
    tutorialVisible,
    updateTutorialSession,
  } = useTutorialController({
    audioEngine,
    bpm,
    clips,
    dispatchAppCommand,
    matrix,
    selectedBar,
  });
  const {
    canRedo,
    canUndo,
    clearUndoHistory,
    handleRedo,
    handleTrackVolumeChangeEnd,
    handleTrackVolumeChangeStart,
    handleUndo,
    withUndoCheckpoint,
  } = useUndoHistoryController({
    activeTutorialId,
    appliedTutorialSetups,
    clearTutorialAutoAdvanceTimer,
    clearTutorialCountIn,
    currentTutorialStepIndex,
    dispatchAppCommand,
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
    tutorialModeActive,
    tutorialPanelState,
    tutorialProgress,
    tutorialSessions,
    tutorialSidebarCollapsed,
    tutorialStepCheckpoints,
    tutorialVisible,
  });
  const tutorialMusicSnapshotsRef = useRef({});
  const chillStepCheckpointsRef = useRef({});
  const chillPreviewGenerationRef = useRef(0);
  const chillPreviewLifecycleRef = useRef(CHILL_TUTORIAL_RUN_STATES.IDLE);

  const cancelChillPreviewPlayback = useCallback(() => {
    if (chillPreviewLifecycleRef.current === CHILL_TUTORIAL_RUN_STATES.IDLE) return;

    chillPreviewGenerationRef.current += 1;
    chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
    clearTutorialAutoAdvanceTimer();
    audioEngine.setPlaybackCompleteHandler?.(null);
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => (
      cancelChillTutorialPreview(session)
    ));
  }, [updateTutorialSession]);

  const captureTutorialMusicSnapshot = useCallback((tutorialId) => {
    if (!tutorialId) return;
    tutorialMusicSnapshotsRef.current[tutorialId] = createTutorialCheckpoint({
      appState: useMusicStore.getState(),
    });
  }, []);

  const restoreTutorialMusicSnapshot = useCallback((tutorialId) => {
    const checkpoint = tutorialMusicSnapshotsRef.current[tutorialId];
    if (!checkpoint?.appState) return false;
    useMusicStore.setState(checkpoint.appState);
    return true;
  }, []);
  const resetTutorialTransportToStart = useCallback(async () => {
    clearTutorialCountIn();
    await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_SEEK, bar: 0, step: 0 });
  }, [clearTutorialCountIn, dispatchAppCommand]);

  const stopTutorialPreviewPlayback = useCallback(() => {
    clearTutorialCountIn();
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
  }, [clearTutorialCountIn, dispatchAppCommand]);

  const {
    canCopyClip,
    canPasteClip,
    cancelClipPaste,
    clearClipClipboardState,
    clearClipPasteDestination,
    confirmClipPaste,
    handleCopySelectedClip,
    handlePasteClipRequest,
    pendingClipPaste,
    selectClipPasteDestination,
    selectRulerPasteDestination,
    selectedClip,
  } = useClipClipboardActions({
    clips,
    onTimelineSelectionChange: setTimelineSelection,
    selectedClipId,
    timelineSelection,
    withUndoCheckpoint,
  });
  const melodyTemplateSteps = useMemo(() => (
    getMelodyRhythmTemplate(melodyRhythmTemplateId)?.steps ?? []
  ), [melodyRhythmTemplateId]);
  const melodyRecording = useMelodyRecordingController({
    activeTrackId,
    activeTrackType,
    audioEngine,
    bpm,
    dispatchAppCommand,
    melodyRhythmTemplateId,
    melodyScaleId,
    selectedClip,
    withUndoCheckpoint,
  });
  const drumsRecording = useDrumsRecordingController({
    activeTrackId,
    activeTrackType,
    audioEngine,
    bpm,
    dispatchAppCommand,
    withUndoCheckpoint,
  });
  const handleDrumsRecordingTransportPosition = drumsRecording.handleTransportPosition;
  const stopDrumsRecording = drumsRecording.stopRecording;
  const handleMelodyRecordingTransportPosition = melodyRecording.handleTransportPosition;
  const stopMelodyRecording = melodyRecording.stopRecording;
  const bpmLockedByTutorial = tutorialPanelState === 'running';
  const bpmLockedByRecording = drumsRecording.workflowLocked || melodyRecording.workflowLocked;
  const bpmLocked = bpmLockedByTutorial || bpmLockedByRecording;
  const bpmLockReason = bpmLockedByTutorial
    ? '教程正在使用固定速度，暂停或退出教程后可以调整。'
    : bpmLockedByRecording
      ? '录音或倒数期间暂时锁定速度。'
      : '';
  const handleBpmChange = useCallback((nextValue) => {
    if (bpmLocked) return;

    const state = useMusicStore.getState();
    const nextBpm = normalizeBpm(nextValue, state.bpm);
    if (nextBpm === state.bpm) return;

    withUndoCheckpoint(() => {
      state.setBpm(nextBpm);
    });
    audioEngine.setTempo?.(nextBpm);
  }, [bpmLocked, withUndoCheckpoint]);
  const clearTimelineSelectionPlayback = useCallback(() => {
    if (!timelineSelectionPlaybackActive) return;

    setTimelineSelectionPlaybackActive(false);
    audioEngine.setPlaybackCompleteHandler?.(null);
  }, [timelineSelectionPlaybackActive]);
  const handleTimelineSelectionPlaybackComplete = useCallback(() => {
    setTimelineSelectionPlaybackActive(false);
    audioEngine.setPlaybackCompleteHandler?.(null);
    queueMicrotask(() => {
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    });
  }, [dispatchAppCommand]);
  const handleTimelineSelectionChange = useCallback((selection) => {
    clearClipPasteDestination();
    setTimelineSelection(selection);
    if (!selection) return;

    stopDrumsRecording();
    stopMelodyRecording();
    const state = useMusicStore.getState();
    state.setActiveTrackId(selection.trackIds[0]);
    state.setSelectedBar(selection.startBar);
    state.setSelectedClipId(null);
  }, [clearClipPasteDestination, stopDrumsRecording, stopMelodyRecording]);
  const handleUndoWithMelodyStop = useCallback(() => {
    cancelChillPreviewPlayback();
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording();
    handleUndo();
  }, [
    cancelChillPreviewPlayback,
    clearTimelineSelectionPlayback,
    clearClipPasteDestination,
    handleUndo,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);
  const handleRedoWithMelodyStop = useCallback(() => {
    cancelChillPreviewPlayback();
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording();
    handleRedo();
  }, [
    cancelChillPreviewPlayback,
    clearTimelineSelectionPlayback,
    clearClipPasteDestination,
    handleRedo,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);
  const handlePasteClipRequestWithMelodyStop = useCallback(() => {
    stopDrumsRecording();
    stopMelodyRecording();
    handlePasteClipRequest();
  }, [handlePasteClipRequest, stopDrumsRecording, stopMelodyRecording]);

  useEffect(() => {
    audioEngine.setMelodyTimbreSource?.(() => useMusicStore.getState().melodyTimbreId);
    return () => audioEngine.setMelodyTimbreSource?.(null);
  }, []);

  useEffect(() => {
    if (!melodyEditorIsOpen) return undefined;
    let cancelled = false;
    void audioEngine.prepareMelodyTimbre?.(melodyTimbreId).then((ready) => {
      if (!cancelled && ready) audioEngine.activateMelodyTimbre?.(melodyTimbreId);
    });
    return () => {
      cancelled = true;
    };
  }, [melodyEditorIsOpen, melodyTimbreId]);

  useEffect(() => () => {
    chillPreviewGenerationRef.current += 1;
    chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
    audioEngine.setPlaybackCompleteHandler?.(null);
    clearTimelineSelectionPlayback();
    clearTutorialAutoAdvanceTimer();
    clearTutorialCountIn();
  }, [clearTimelineSelectionPlayback, clearTutorialCountIn]);

  useEffect(() => {
    audioEngine.setVolumeSource?.(() => {
      const state = useMusicStore.getState();
      return {
        mutedTracks: state.mutedTracks,
        volumes: state.volumes,
      };
    });

    return () => {
      audioEngine.setVolumeSource?.(null);
    };
  }, []);

  useEffect(() => (
    syncTrackScrollContainers(tracksScrollRef.current, timelineScrollRef.current)
  ), []);

  useEffect(() => {
    syncEditorToPlaybackBar(useMusicStore.getState(), currentBar);
  }, [activeTrackId, currentBar, isPlaying, selectedBar]);

  const handleBackToStart = useCallback(() => {
    cancelChillPreviewPlayback();
    clearTimelineSelectionPlayback();
    clearTutorialCountIn();
    stopDrumsRecording();
    stopMelodyRecording();
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_SEEK, bar: 0, step: 0 });
  }, [
    cancelChillPreviewPlayback,
    clearTimelineSelectionPlayback,
    clearTutorialCountIn,
    dispatchAppCommand,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleStop = useCallback(() => {
    cancelChillPreviewPlayback();
    clearTimelineSelectionPlayback();
    clearTutorialCountIn();
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording({ stopTransport: false });
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
  }, [
    cancelChillPreviewPlayback,
    clearTimelineSelectionPlayback,
    clearTutorialCountIn,
    dispatchAppCommand,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleStopAndRewind = useCallback(() => {
    cancelChillPreviewPlayback();
    clearTimelineSelectionPlayback();
    clearTutorialCountIn();
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording({ stopTransport: false });
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND });
  }, [
    cancelChillPreviewPlayback,
    clearTimelineSelectionPlayback,
    clearTutorialCountIn,
    dispatchAppCommand,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleNewSong = useCallback(() => {
    cancelChillPreviewPlayback();
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording();
    withUndoCheckpoint(() => {
      const initialAppState = useMusicStore.getInitialState();
      const initialTutorialProgress = createTutorialState();

      clearTutorialAutoAdvanceTimer();
      stopTutorialPreviewPlayback();
      clearClipClipboardState();
      clearTimelineSelectionPlayback();
      setTimelineSelection(null);
      useMusicStore.setState(initialAppState, true);
      setCurrentTutorialStepIndex(0);
      setTutorialProgress(initialTutorialProgress);
      setAppliedTutorialSetups(() => new Set());
      setTutorialStepCheckpoints(() => ({
        0: createTutorialCheckpoint({
          appState: initialAppState,
          appliedTutorialSetups: new Set(),
          tutorialProgress: initialTutorialProgress,
        }),
      }));
      setTutorialModeActive(false);
      setTutorialSidebarCollapsed(true);
      setTutorialVisible(false);
      setActiveTutorialId(null);
      setTutorialPanelState('closed');
      setTutorialSessions({
        [TUTORIAL_IDS.CHILL_RAINY_STREET]: createChillTutorialSession(),
        [TUTORIAL_IDS.LEGACY_BASICS]: {
          completed: false,
          hasStarted: false,
        },
      });
      tutorialMusicSnapshotsRef.current = {};
      chillStepCheckpointsRef.current = {};
    }, { force: true });
  }, [
    cancelChillPreviewPlayback,
    clearClipClipboardState,
    clearTimelineSelectionPlayback,
    setAppliedTutorialSetups,
    setActiveTutorialId,
    setCurrentTutorialStepIndex,
    setTutorialModeActive,
    setTutorialPanelState,
    setTutorialProgress,
    setTutorialSidebarCollapsed,
    setTutorialStepCheckpoints,
    setTutorialSessions,
    setTutorialVisible,
    stopDrumsRecording,
    stopMelodyRecording,
    stopTutorialPreviewPlayback,
    withUndoCheckpoint,
  ]);

  const requestNewSong = useCallback(() => {
    setIsNewSongConfirmOpen(true);
  }, []);

  const openExportDialog = useCallback(() => {
    setExportState({ error: '', isExporting: false });
    setIsExportDialogOpen(true);
  }, []);

  const closeExportDialog = useCallback(() => {
    if (exportState.isExporting) return;
    setIsExportDialogOpen(false);
  }, [exportState.isExporting]);

  const handleExportAudio = useCallback(async () => {
    setExportState({ error: '', isExporting: true });
    try {
      const { blob } = await renderProjectToWav(useMusicStore.getState());
      downloadBlob(blob, createExportFilename('wav'));
      setExportState({ error: '', isExporting: false });
    } catch (error) {
      setExportState({
        error: error instanceof Error ? error.message : '音频导出失败，请再试一次。',
        isExporting: false,
      });
    }
  }, []);

  const handleExportStems = useCallback(async () => {
    setExportState({ error: '', isExporting: true });
    try {
      const state = useMusicStore.getState();
      const trackIds = getAudioExportTrackIds(state);
      if (trackIds.length === 0) {
        throw new Error('工程里还没有可导出的音符。请先添加节奏或音符。');
      }

      for (const trackId of trackIds) {
        const { blob } = await renderProjectToWav(state, { trackIds: [trackId] });
        downloadBlob(
          blob,
          createExportFilename('wav', `project-arranger-${trackId}`),
        );
      }
      setExportState({ error: '', isExporting: false });
    } catch (error) {
      setExportState({
        error: error instanceof Error ? error.message : '音频分轨导出失败，请再试一次。',
        isExporting: false,
      });
    }
  }, []);

  const handleExportMidi = useCallback(() => {
    try {
      downloadBlob(createMidiFileBlob(useMusicStore.getState()), createExportFilename('mid'));
      setExportState({ error: '', isExporting: false });
    } catch (error) {
      setExportState({
        error: error instanceof Error ? error.message : 'MIDI 导出失败，请再试一次。',
        isExporting: false,
      });
    }
  }, []);

  const handleExportProject = useCallback(() => {
    try {
      downloadBlob(createProjectFileBlob(useMusicStore.getState()), createExportFilename('json'));
      setExportState({ error: '', isExporting: false });
    } catch (error) {
      setExportState({
        error: error instanceof Error ? error.message : '工程备份导出失败，请再试一次。',
        isExporting: false,
      });
    }
  }, []);

  const cancelNewSong = useCallback(() => {
    setIsNewSongConfirmOpen(false);
  }, []);

  const requestClearAction = useCallback((trackId, scope, bar = null) => {
    const state = useMusicStore.getState();
    const trackType = getTrackType(state, trackId);
    if (!CLEAR_TRACK_LABELS[trackType]) return;
    if (scope !== 'bar' && scope !== 'track') return;
    if (scope === 'bar' && !Number.isInteger(bar)) return;

    setPendingClearAction({
      bar,
      scope,
      trackId,
      trackName: state.trackInstancesById?.[trackId]?.name ?? CLEAR_TRACK_LABELS[trackType],
      trackType,
    });
  }, []);

  const cancelClearAction = useCallback(() => {
    setPendingClearAction(null);
  }, []);

  useEffect(() => {
    if (!pendingClearAction) return undefined;

    const handleClearConfirmKeyDown = (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      cancelClearAction();
    };

    window.addEventListener('keydown', handleClearConfirmKeyDown, true);
    return () => window.removeEventListener('keydown', handleClearConfirmKeyDown, true);
  }, [cancelClearAction, pendingClearAction]);

  const confirmNewSong = useCallback(() => {
    setIsNewSongConfirmOpen(false);
    handleNewSong();
  }, [handleNewSong]);

  const visibleTrackUi = useMemo(
    () => getTrackUiByIds(trackOrder, trackInstancesById),
    [trackInstancesById, trackOrder],
  );
  const availableAddTrackOptions = TRACK_UI;
  const activeTrackName = trackInstancesById[activeTrackId]?.name ?? activeTrackType;
  const editorMatrix = useMemo(() => createTrackScopedMatrix({
    activeTrackId,
    activeTrackType,
    matrix,
    primaryChordTrackId,
  }), [activeTrackId, activeTrackType, matrix, primaryChordTrackId]);
  const editorClips = useMemo(() => createTrackScopedClips({
    activeTrackId,
    activeTrackType,
    clips,
    primaryChordTrackId,
    trackInstancesById,
  }), [
    activeTrackId,
    activeTrackType,
    clips,
    primaryChordTrackId,
    trackInstancesById,
  ]);
  const launchpadMutedTracks = useMemo(() => ({
    ...mutedTracks,
    ...(activeTrackType ? { [activeTrackType]: mutedTracks[activeTrackId] === true } : {}),
  }), [activeTrackId, activeTrackType, mutedTracks]);
  const tracks = useMemo(() => createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    matrix,
    selectedBar,
    trackUi: visibleTrackUi,
    volumes,
  }), [clips, matrix, selectedBar, visibleTrackUi, volumes]);
  const canPageBars = useMemo(() => (
    canPageTrackClipBars(clips, activeTrackId)
    && getAdjacentTrackClipBar(clips, activeTrackId, selectedBar, 'next') !== null
  ), [activeTrackId, clips, selectedBar]);

  const seekTransportToBarStart = useCallback((bar) => {
    if (!Number.isInteger(bar)) return;
    stopDrumsRecording();
    stopMelodyRecording();
    void dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar,
      step: 0,
    });
  }, [dispatchAppCommand, stopDrumsRecording, stopMelodyRecording]);

  const handleTrackSelect = useCallback((trackId, barIndex) => {
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    setTimelineSelection(null);
    stopDrumsRecording();
    stopMelodyRecording();
    const state = useMusicStore.getState();
    const hasExplicitBar = Number.isInteger(barIndex);
    const targetBar = hasExplicitBar ? barIndex : state.selectedBar;
    const clip = state.getClipForTrackBar(trackId, targetBar);
    if (clip) {
      state.selectClip(clip.id);
      if (hasExplicitBar) selectClipPasteDestination(trackId, targetBar);
      if (hasExplicitBar) seekTransportToBarStart(targetBar);
      return;
    }

    const { setActiveTrackId, setSelectedBar, setSelectedClipId } = state;
    setActiveTrackId(trackId);
    setSelectedBar(targetBar);
    setSelectedClipId(null);
    if (hasExplicitBar) selectClipPasteDestination(trackId, targetBar);
    if (hasExplicitBar) seekTransportToBarStart(targetBar);
  }, [
    clearClipPasteDestination,
    clearTimelineSelectionPlayback,
    selectClipPasteDestination,
    seekTransportToBarStart,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleAddClip = useCallback((trackId, barIndex) => {
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    setTimelineSelection(null);
    stopDrumsRecording();
    stopMelodyRecording();
    const state = useMusicStore.getState();
    let clip;
    if (state.getClipForTrackBar(trackId, barIndex)) {
      clip = state.createClip(trackId, barIndex);
    } else {
      clip = withUndoCheckpoint(() => state.createClip(trackId, barIndex));
    }

    if (clip) {
      selectClipPasteDestination(clip.trackId, clip.bar);
      seekTransportToBarStart(clip.bar);
    }
  }, [
    clearClipPasteDestination,
    clearTimelineSelectionPlayback,
    selectClipPasteDestination,
    seekTransportToBarStart,
    stopDrumsRecording,
    stopMelodyRecording,
    withUndoCheckpoint,
  ]);

  const applyTutorialStepSetup = useCallback((step, knownAppliedSetups = appliedTutorialSetups) => {
    const setupType = step?.setup?.type;
    if (!setupType || knownAppliedSetups?.has?.(step.id)) return;

    const state = useMusicStore.getState();

    if (setupType === 'prepare-kick-drag') {
      const targetBar = state.selectedBar ?? DRUMS_TUTORIAL_FIRST_BAR;
      const sourceCell = state.matrix.drums[targetBar]?.[DRUMS_DRAG_SOURCE_STEP] ?? null;
      const targetCell = state.matrix.drums[targetBar]?.[DRUMS_DRAG_TARGET_STEP] ?? null;
      state.setCell('drums', targetBar, DRUMS_DRAG_SOURCE_STEP, createDrumsCell([
        ...getDrumsCellInstruments(sourceCell),
        'kick',
      ]));
      state.setCell('drums', targetBar, DRUMS_DRAG_TARGET_STEP, createDrumsCell(
        getDrumsCellInstruments(targetCell).filter((instrument) => instrument !== 'kick'),
      ));
    }

    setAppliedTutorialSetups((setups) => {
      if (setups.has(step.id)) return setups;
      return new Set(setups).add(step.id);
    });
  }, [appliedTutorialSetups, setAppliedTutorialSetups]);

  const enterTutorialStepIndex = useCallback((
    requestedStepIndex,
    checkpointProgress = tutorialProgress,
  ) => {
    const nextStepIndex = Math.max(
      0,
      Math.min(requestedStepIndex, DRUMS_TUTORIAL_STEPS.length - 1),
    );
    const nextStep = DRUMS_TUTORIAL_STEPS[nextStepIndex];
    const nextStepCheckpoint = createTutorialCheckpoint({
      appState: useMusicStore.getState(),
      appliedTutorialSetups,
      tutorialProgress: checkpointProgress,
    });

    setTutorialStepCheckpoints((checkpoints) => ({
      ...checkpoints,
      [nextStepIndex]: nextStepCheckpoint,
    }));
    applyTutorialStepSetup(nextStep);
    setCurrentTutorialStepIndex(nextStepIndex);
  }, [
    appliedTutorialSetups,
    applyTutorialStepSetup,
    setCurrentTutorialStepIndex,
    setTutorialStepCheckpoints,
    tutorialProgress,
  ]);

  const advanceTutorialToNextStep = useCallback((
    checkpointProgress = tutorialProgress,
    options = {},
  ) => {
    void (async () => {
      await resetTutorialTransportToStart();
      enterTutorialStepIndex(currentTutorialStepIndex + 1, checkpointProgress);
      if (options.startPlaybackAfterAdvance) {
        startTutorialCountInPlayback();
      }
    })();
  }, [
    currentTutorialStepIndex,
    enterTutorialStepIndex,
    resetTutorialTransportToStart,
    startTutorialCountInPlayback,
    tutorialProgress,
  ]);

  const ensureTutorialStepCheckpoint = useCallback((targetStepIndex) => {
    const existingCheckpoint = tutorialStepCheckpoints[targetStepIndex];
    if (existingCheckpoint) return existingCheckpoint;

    const targetStep = DRUMS_TUTORIAL_STEPS[targetStepIndex];
    const targetCheckpoint = createTutorialDirectoryCheckpoint({
      initialState: useMusicStore.getInitialState(),
      stepId: targetStep?.id,
    });
    if (!targetCheckpoint) return null;

    setTutorialStepCheckpoints((checkpoints) => ({
      ...checkpoints,
      [targetStepIndex]: targetCheckpoint,
    }));

    return targetCheckpoint;
  }, [setTutorialStepCheckpoints, tutorialStepCheckpoints]);

  const applyTutorialActionProgress = useCallback((tutorialAction) => {
    setTutorialProgress(tutorialAction.nextProgress);
    if (tutorialAction.shouldCompleteTutorial) {
      clearTutorialAutoAdvanceTimer();
      clearTutorialCountIn();
      stopTutorialPreviewPlayback();
      resetTutorialTransportToStart();
      setTutorialModeActive(false);
      setTutorialSidebarCollapsed(true);
      return;
    }
    if (tutorialAction.shouldEnd) {
      clearTutorialAutoAdvanceTimer();
      clearTutorialCountIn();
      setTutorialVisible(false);
      return;
    }
    if (tutorialAction.shouldAdvance) {
      scheduleTutorialAutoAdvance(() => advanceTutorialToNextStep(
        tutorialAction.nextProgress,
        { startPlaybackAfterAdvance: tutorialAction.shouldStartPlaybackAfterAdvance },
      ));
    }
  }, [
    advanceTutorialToNextStep,
    clearTutorialCountIn,
    resetTutorialTransportToStart,
    setTutorialModeActive,
    setTutorialProgress,
    setTutorialSidebarCollapsed,
    setTutorialVisible,
    stopTutorialPreviewPlayback,
  ]);

  const handleFillEmptyTrackClips = useCallback((trackId) => {
    stopDrumsRecording();
    stopMelodyRecording();
    let tutorialAction = null;
    if (tutorialActive) {
      tutorialAction = handleTutorialControlAction({
        control: `${TUTORIAL_CONTROL_TARGETS.FILL_EMPTY_CLIPS_PREFIX}:${trackId}`,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
    }

    const state = useMusicStore.getState();
    const hasEmptyClipSlot = BAR_NUMBERS.some((_, barIndex) => (
      !state.getClipForTrackBar(trackId, barIndex)
    ));
    if (!hasEmptyClipSlot && !tutorialAction) {
      state.createEmptyClipsForTrack(trackId);
      return;
    }

    withUndoCheckpoint(() => {
      state.createEmptyClipsForTrack(trackId);
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    stopDrumsRecording,
    tutorialActive,
    tutorialProgress,
    stopMelodyRecording,
    withUndoCheckpoint,
  ]);

  const stopForTrackStructureChange = useCallback(() => {
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    setTimelineSelection(null);
    stopDrumsRecording({ stopTransport: false });
    stopMelodyRecording({ stopTransport: false });
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
  }, [
    clearClipPasteDestination,
    clearTimelineSelectionPlayback,
    dispatchAppCommand,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleAddTrack = useCallback((trackType) => {
    stopForTrackStructureChange();
    withUndoCheckpoint(() => {
      useMusicStore.getState().addTrackInstance(trackType);
    });
  }, [stopForTrackStructureChange, withUndoCheckpoint]);

  const handleRenameTrack = useCallback((trackId, name) => {
    withUndoCheckpoint(() => {
      useMusicStore.getState().renameTrackInstance(trackId, name);
    });
  }, [withUndoCheckpoint]);

  const handleMoveTrack = useCallback((trackId, targetIndex) => {
    stopForTrackStructureChange();
    withUndoCheckpoint(() => {
      useMusicStore.getState().moveTrackInstance(trackId, targetIndex);
    });
  }, [stopForTrackStructureChange, withUndoCheckpoint]);

  const handleRemoveTrack = useCallback((trackId) => {
    stopForTrackStructureChange();
    withUndoCheckpoint(() => {
      useMusicStore.getState().removeTrackInstance(trackId);
    });
  }, [stopForTrackStructureChange, withUndoCheckpoint]);

  const canRemoveTrack = useCallback((trackId) => (
    canRemoveTrackInstance(useMusicStore.getState(), trackId)
  ), []);

  const handleTrackVolumeChange = useCallback((trackId, volume) => {
    useMusicStore.getState().setTrackVolume(trackId, volume);
  }, []);

  const handleMoveClip = useCallback((clipId, targetBar) => {
    clearTimelineSelectionPlayback();
    setTimelineSelection(null);
    stopDrumsRecording();
    stopMelodyRecording();
    const state = useMusicStore.getState();
    const sourceClip = state.clips.byId[clipId];
    if (!sourceClip || sourceClip.bar === targetBar) {
      state.moveClipToBar(clipId, targetBar);
      return;
    }

    withUndoCheckpoint(() => {
      state.moveClipToBar(clipId, targetBar);
    });
  }, [
    clearTimelineSelectionPlayback,
    stopDrumsRecording,
    stopMelodyRecording,
    withUndoCheckpoint,
  ]);

  const handleOpenClip = useCallback((clipId) => {
    clearTimelineSelectionPlayback();
    clearClipPasteDestination();
    setTimelineSelection(null);
    stopDrumsRecording();
    stopMelodyRecording();
    const clip = useMusicStore.getState().selectClip(clipId);
    if (clip) {
      selectClipPasteDestination(clip.trackId, clip.bar);
      seekTransportToBarStart(clip.bar);
    }
  }, [
    clearClipPasteDestination,
    clearTimelineSelectionPlayback,
    selectClipPasteDestination,
    seekTransportToBarStart,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handleCloseEditor = useCallback(() => {
    clearTimelineSelectionPlayback();
    stopDrumsRecording();
    melodyRecording.stopRecording();
    useMusicStore.getState().setSelectedClipId(null);
  }, [clearTimelineSelectionPlayback, melodyRecording, stopDrumsRecording]);

  const handleRenameClip = useCallback((name) => {
    if (!selectedClipId) return;
    const state = useMusicStore.getState();
    const clip = state.clips.byId[selectedClipId];
    if (!clip || clip.name === name) return;

    withUndoCheckpoint(() => {
      state.renameClip(selectedClipId, name);
    });
  }, [selectedClipId, withUndoCheckpoint]);

  const writeDrumsBars = useCallback((nextMatrix, barIndexes, trackId) => {
    const state = useMusicStore.getState();
    for (const barIndex of barIndexes) {
      nextMatrix.drums[barIndex].forEach((cell, step) => {
        state.setCell(trackId, barIndex, step, cell);
      });
    }
  }, []);

  const handleGenerateCurrentDrumsBar = useCallback((templateId) => {
    let tutorialAction = null;
    if (tutorialActive) {
      tutorialAction = handleTutorialControlAction({
        control: TUTORIAL_CONTROL_TARGETS.GENERATE_CURRENT_DRUMS_BAR,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
    }

    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      const scope = createTrackActionScope(state);
      if (scope.trackType !== 'drums') return;
      const nextMatrix = tutorialAction
        ? applyBasicDrumsBar(scope.matrix, selectedBar)
        : applyDrumsTemplateToBar(scope.matrix, selectedBar, templateId);
      if (nextMatrix === scope.matrix) return;
      writeDrumsBars(nextMatrix, [selectedBar], scope.trackId);
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
    writeDrumsBars,
  ]);

  const handleGenerateAllDrumsBars = useCallback((templateId) => {
    let tutorialAction = null;
    if (tutorialActive) {
      tutorialAction = handleTutorialControlAction({
        control: TUTORIAL_CONTROL_TARGETS.GENERATE_ALL_DRUMS_BARS,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
    }

    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      const scope = createTrackActionScope(state);
      if (scope.trackType !== 'drums') return;
      const drumsClipBars = getDrumsClipBarIndexes(scope.clips);
      const nextMatrix = tutorialAction
        ? applyBasicDrumsAllBars(scope.matrix, drumsClipBars)
        : applyDrumsTemplateToBars(scope.matrix, drumsClipBars, templateId);
      if (nextMatrix === scope.matrix) return;
      writeDrumsBars(
        nextMatrix,
        tutorialAction
          ? BAR_NUMBERS.map((_, barIndex) => barIndex)
          : drumsClipBars,
        scope.trackId,
      );
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
    writeDrumsBars,
  ]);

  const handleDrumTemplatePreview = useCallback(async (templateId) => {
    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'drums') return 'empty';

    const events = createDrumTemplatePreviewEvents(templateId);
    if (!events.length) return 'empty';

    if (state.isPlaying) {
      await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY });
    }

    return audioEngine.previewDrumsPattern(events, {
      bpm: state.bpm,
      trackId: scope.trackId,
    });
  }, [dispatchAppCommand]);

  const handleDrumTemplatePreviewStop = useCallback(
    () => audioEngine.stopDrumsPatternPreview(),
    [],
  );

  const handleClearCurrentDrumsBar = useCallback(() => {
    requestClearAction(activeTrackId, 'bar', selectedBar);
  }, [activeTrackId, requestClearAction, selectedBar]);

  const handleClearDrums = useCallback(() => {
    requestClearAction(activeTrackId, 'track');
  }, [activeTrackId, requestClearAction]);

  const handlePageTrackBar = useCallback((direction) => {
    stopDrumsRecording();
    stopMelodyRecording();
    const state = useMusicStore.getState();
    const nextBar = getAdjacentTrackClipBar(
      state.clips,
      state.activeTrackId,
      state.selectedBar,
      direction,
    );
    if (nextBar === null) return;

    const clip = state.getClipForTrackBar(state.activeTrackId, nextBar);
    if (clip) {
      state.selectClip(clip.id);
      seekTransportToBarStart(clip.bar);
    }
  }, [seekTransportToBarStart, stopDrumsRecording, stopMelodyRecording]);

  const handlePreviousBar = useCallback(() => {
    handlePageTrackBar('previous');
  }, [handlePageTrackBar]);

  const handleNextBar = useCallback(() => {
    handlePageTrackBar('next');
  }, [handlePageTrackBar]);

  const handleTransportSeek = useCallback((bar, step) => {
    clearTimelineSelectionPlayback();
    setTimelineSelection(null);
    stopDrumsRecording();
    stopMelodyRecording();
    selectRulerPasteDestination(bar);
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_SEEK, bar, step });
  }, [
    clearTimelineSelectionPlayback,
    dispatchAppCommand,
    selectRulerPasteDestination,
    stopDrumsRecording,
    stopMelodyRecording,
  ]);

  const handlePlayToggle = useCallback(() => {
    stopDrumsRecording({ stopTransport: false });
    if (chillPreviewLifecycleRef.current !== CHILL_TUTORIAL_RUN_STATES.IDLE) {
      handleStop();
      return;
    }
    if (tutorialActive) {
      const tutorialAction = handleTutorialControlAction({
        control: TUTORIAL_CONTROL_TARGETS.TRANSPORT_PLAY,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
      if (tutorialAction.nextProgress !== tutorialProgress) {
        applyTutorialActionProgress(tutorialAction);
      }
    }

    const selectionPlayback = getTimelineSelectionPlaybackOptions(timelineSelection);
    if (selectionPlayback) {
      if (isPlaying) {
        handleStop();
        return;
      }

      clearTimelineSelectionPlayback();
      stopMelodyRecording({ stopTransport: false });
      setTimelineSelectionPlaybackActive(true);
      audioEngine.setPlaybackCompleteHandler?.(handleTimelineSelectionPlaybackComplete);
      void (async () => {
        await dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: selectionPlayback.bar,
          step: selectionPlayback.step,
        });
        await dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
          audibleTrackIds: selectionPlayback.audibleTrackIds,
          maxPlaybackSteps: selectionPlayback.maxPlaybackSteps,
        });
      })();
      return;
    }

    clearTimelineSelectionPlayback();
    stopMelodyRecording({ stopTransport: false });
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY });
  }, [
    applyTutorialActionProgress,
    clearTimelineSelectionPlayback,
    currentTutorialStep,
    dispatchAppCommand,
    handleStop,
    handleTimelineSelectionPlaybackComplete,
    isPlaying,
    selectedBar,
    stopDrumsRecording,
    stopMelodyRecording,
    timelineSelection,
    tutorialActive,
    tutorialProgress,
  ]);

  useEffect(() => {
    audioEngine.onScheduledPositionChange = (bar, step) => {
      handleDrumsRecordingTransportPosition(bar, step);
      handleMelodyRecordingTransportPosition(bar, step);
    };

    audioEngine.onPositionChange = (bar, step) => {
      useMusicStore.getState().setTransportPosition(bar, step);

      if (
        tutorialActive
        && currentTutorialStep?.id === TUTORIAL_STEP_IDS.DRUMS_LISTEN_FIRST_CLIP
        && bar > DRUMS_TUTORIAL_FIRST_BAR
        && step === 0
      ) {
        const tutorialAction = handleTutorialPlaybackComplete({
          bar: DRUMS_TUTORIAL_FIRST_BAR,
          progress: tutorialProgress,
          step: currentTutorialStep,
          trackId: 'drums',
        });
        if (tutorialAction.allowed) applyTutorialActionProgress(tutorialAction);
      }

      if (
        tutorialActive
        && currentTutorialStep?.completion?.type === 'playback-loop-complete'
      ) {
        setTutorialProgress((progress) => {
          const tutorialAction = handleTutorialPlaybackPosition({
            bar,
            progress,
            step: currentTutorialStep,
            stepIndex: step,
            trackId: currentTutorialStep.completion.trackId,
          });

          if (!tutorialAction.allowed) return progress;
          return tutorialAction.nextProgress;
        });
      }
    };

    return () => {
      audioEngine.onPositionChange = null;
      audioEngine.onScheduledPositionChange = null;
    };
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    handleDrumsRecordingTransportPosition,
    handleMelodyRecordingTransportPosition,
    setTutorialProgress,
    tutorialActive,
    tutorialProgress,
  ]);

  useEffect(() => {
    if (!tutorialActive) return;

    const suggestedBar = tutorialViewModel.suggestedSelectedBar;
    syncEditorToTutorialSuggestedBar(useMusicStore.getState(), suggestedBar, { isPlaying });
  }, [isPlaying, selectedBar, tutorialActive, tutorialViewModel.suggestedSelectedBar]);

  useEffect(() => {
    const playback = currentTutorialStep?.playback;
    if (performanceActive || !playback?.autoStart || !playback.bars?.length) return undefined;

    const firstBar = playback.bars[0];
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_SEEK, bar: firstBar, step: 0 });
    if (!useMusicStore.getState().isPlaying) {
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY });
    }

    const beats = playback.bars.length * 4;
    const stopDelayMs = Math.max(1200, Math.round((60 / bpm) * beats * 1000));
    const playbackTimer = window.setTimeout(() => {
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }, stopDelayMs);

    return () => {
      window.clearTimeout(playbackTimer);
    };
  }, [bpm, currentTutorialStep, dispatchAppCommand, performanceActive]);

  const handleDrumsWriteToggle = useCallback(() => {
    clearTimelineSelectionPlayback();
    setTimelineSelection(null);
    stopMelodyRecording();
    return drumsRecording.requestWriteToggle();
  }, [
    clearTimelineSelectionPlayback,
    drumsRecording,
    stopMelodyRecording,
  ]);

  const handleDrumsStepToggle = useCallback((
    instrument,
    step,
    bar = useMusicStore.getState().selectedBar,
  ) => {
    const state = useMusicStore.getState();
    if (state.selectedBar !== bar) return;
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'drums') return;

    const tutorialAction = tutorialActive ? handleTutorialDrumToggle({
      instrument,
      matrix: scope.matrix,
      progress: tutorialProgress,
      selectedBar: bar,
      step: currentTutorialStep,
      stepIndex: step,
    }) : { allowed: true, nextProgress: tutorialProgress, shouldAdvance: false };

    if (!tutorialAction.allowed) return;

    withUndoCheckpoint(() => {
      const currentCell = scope.matrix.drums[bar]?.[step] ?? null;
      const preview = !getDrumsCellInstruments(currentCell).includes(instrument);
      const nextCell = toggleInstrumentInCell(currentCell, instrument);
      state.setCell(scope.trackId, bar, step, nextCell);
      void dispatchAppCommand({
        type: APP_COMMAND_TYPES.DRUMS_TOGGLE,
        bar,
        step,
        instrument,
        preview,
        trackId: scope.trackId,
      });

      applyTutorialActionProgress(tutorialAction);
    }, { force: tutorialActive });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    dispatchAppCommand,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
  ]);

  const handleDrumsStepMove = useCallback((instrument, fromStep, toStep) => {
    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'drums') return;
    const tutorialAction = tutorialActive
      ? handleTutorialDrumMove({
        fromStep,
        instrument,
        matrix: scope.matrix,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
        toStep,
      })
      : null;
    const moveAction = tutorialAction ?? createDrumsStepMovePatch({
      bar: selectedBar,
      fromStep,
      instrument,
      matrix: scope.matrix,
      toStep,
    });

    if (!moveAction.allowed) return;

    withUndoCheckpoint(() => {
      moveAction.nextMatrixPatch.forEach((patch) => {
        state.setCell(scope.trackId, patch.bar, patch.step, patch.cell);
      });
      void dispatchAppCommand({
        type: APP_COMMAND_TYPES.DRUMS_TOGGLE,
        bar: selectedBar,
        step: toStep,
        instrument,
        preview: true,
        trackId: scope.trackId,
      });

      if (tutorialAction) {
        applyTutorialActionProgress(tutorialAction);
      }
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    dispatchAppCommand,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
  ]);

  const handleChordTemplateWorkspacePreview = useCallback(async ({
    progressionTemplateId,
    grooveTemplateId,
    styleChordTemplateId,
    styleGrooveTemplateId,
    stylePresetId,
  } = {}) => {
    const events = styleChordTemplateId && styleGrooveTemplateId
      ? createChordStyleSelectionPreviewEvents(styleChordTemplateId, styleGrooveTemplateId)
      : stylePresetId
        ? createChordStylePresetPreviewEvents(stylePresetId)
        : createChordTemplateWorkspacePreviewEvents({
        progressionTemplateId,
        grooveTemplateId,
      });
    if (!events.length) return 'empty';

    if (useMusicStore.getState().isPlaying) {
      await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }

    return audioEngine.previewChordClipSequence(events, {
      bpm,
      totalSteps: 64,
      trackId: useMusicStore.getState().activeTrackId,
    });
  }, [bpm, dispatchAppCommand]);

  const handleChordTemplateWorkspacePreviewStop = useCallback(() => (
    audioEngine.stopChordClipSequencePreview()
  ), []);

  const handleChordStepHarmonyPreview = useCallback(async ({
    chordName,
    preserveTransport = false,
  } = {}) => {
    const events = createChordStepHarmonyPreviewEvents(chordName);
    if (!events.length) return 'empty';

    if (!preserveTransport && useMusicStore.getState().isPlaying) {
      await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }

    return audioEngine.previewChordClipSequence(events, {
      bpm,
      totalSteps: 8,
      trackId: useMusicStore.getState().activeTrackId,
    });
  }, [bpm, dispatchAppCommand]);

  const handleChordRhythmStepToggle = useCallback((
    stepIndex,
    bar = useMusicStore.getState().selectedBar,
  ) => {
    setLaunchpadChordHarmonyTarget(null);
    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      if (state.selectedBar !== bar) return;
      const scope = createTrackActionScope(state);
      if (scope.trackType !== 'chord') return;
      const nextMatrix = toggleChordRhythmStep(scope.matrix, bar, stepIndex);
      if (nextMatrix === scope.matrix) return;
      state.setTrackMatrix(scope.trackId, nextMatrix.chord);
    });
  }, [withUndoCheckpoint]);

  const handleChordStepHarmonyApply = useCallback(({
    bar,
    chordName,
    mode,
    stepIndex,
  } = {}) => {
    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'chord') return false;
    const targetBar = bar ?? state.selectedBar;
    if (targetBar !== state.selectedBar) return false;
    const nextMatrix = mode === 'passing'
      ? applyChordRhythmStepPassingChord(
        scope.matrix,
        scope.clips,
        targetBar,
        stepIndex,
        chordName,
      )
      : applyChordRhythmStepEnrichment(scope.matrix, targetBar, stepIndex, chordName);
    if (nextMatrix === scope.matrix) return false;

    withUndoCheckpoint(() => {
      state.setTrackMatrix(scope.trackId, nextMatrix.chord);
    });
    setLaunchpadChordHarmonyTarget(null);
    return true;
  }, [withUndoCheckpoint]);

  const handleChordTemplateWorkspaceApply = useCallback(({
    progressionTemplateId,
    grooveTemplateId,
    styleChordTemplateId,
    styleGrooveTemplateId,
    stylePresetId,
  }) => {
    let tutorialAction = null;
    if (tutorialActive && currentTutorialStep?.id === TUTORIAL_STEP_IDS.CHORD_SELECT_PROGRESSION_TEMPLATE) {
      tutorialAction = handleTutorialControlAction({
        control: TUTORIAL_CONTROL_TARGETS.CHORD_TEMPLATE_APPLY,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
    }

    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'chord') return;
    const nextMatrix = styleChordTemplateId && styleGrooveTemplateId
      ? applyChordStyleSelectionToExistingClips(
        scope.matrix,
        scope.clips,
        styleChordTemplateId,
        styleGrooveTemplateId,
      )
      : stylePresetId
        ? applyChordStylePresetToExistingClips(scope.matrix, scope.clips, stylePresetId)
        : applyChordTemplateWorkspaceToExistingClips(
        scope.matrix,
        scope.clips,
        { progressionTemplateId, grooveTemplateId },
      );
    if (nextMatrix === scope.matrix) return;

    withUndoCheckpoint(() => {
      state.setTrackMatrix(scope.trackId, nextMatrix.chord);
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
  ]);

  const handleClearChordBar = useCallback(() => {
    requestClearAction(activeTrackId, 'bar', selectedBar);
  }, [activeTrackId, requestClearAction, selectedBar]);

  const handleClearChord = useCallback(() => {
    requestClearAction(activeTrackId, 'track');
  }, [activeTrackId, requestClearAction]);

  const handleBassStepToggle = useCallback((step, note) => {
    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      const scope = createTrackActionScope(state);
      if (scope.trackType !== 'bass') return;
      const { auditionNote, nextMatrix } = getBassCellToggleResult(
        scope.matrix,
        selectedBar,
        step,
        note,
      );
      state.setCell(scope.trackId, selectedBar, step, nextMatrix.bass[selectedBar][step]);
      if (auditionNote) {
        void audioEngine.triggerBassNote(
          auditionNote,
          '16n',
          undefined,
          { trackId: scope.trackId },
        );
      }
    });
  }, [selectedBar, withUndoCheckpoint]);

  const handleBassPreview = useCallback((note) => {
    void audioEngine.triggerBassNote(
      note,
      '16n',
      undefined,
      { trackId: useMusicStore.getState().activeTrackId },
    );
  }, []);

  const handleBassGrooveTemplatePreview = useCallback((templateId) => {
    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'bass') return;
    const events = createBassPreviewEvents(scope.matrix, selectedBar, templateId);
    if (!events.length) return;

    void audioEngine.previewBassPattern(events, {
      trackId: scope.trackId,
    });
  }, [selectedBar]);

  const handleBassGrooveTemplateApply = useCallback((templateId) => {
    let tutorialAction = null;
    if (tutorialActive && currentTutorialStep?.id === TUTORIAL_STEP_IDS.BASS_SELECT_GROOVE_TEMPLATE) {
      tutorialAction = handleTutorialControlAction({
        control: `bass-groove-card:${templateId}`,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
      });
      if (!tutorialAction.allowed) return;
    }

    const state = useMusicStore.getState();
    const scope = createTrackActionScope(state);
    if (scope.trackType !== 'bass') return;
    const nextMatrix = applyBassGrooveTemplateToExistingClips(
      scope.matrix,
      scope.clips,
      templateId,
    );
    if (nextMatrix === scope.matrix) return;

    withUndoCheckpoint(() => {
      state.setTrackMatrix(scope.trackId, nextMatrix.bass);
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
  ]);

  const handleClearBassBar = useCallback(() => {
    requestClearAction(activeTrackId, 'bar', selectedBar);
  }, [activeTrackId, requestClearAction, selectedBar]);

  const handleClearBass = useCallback(() => {
    requestClearAction(activeTrackId, 'track');
  }, [activeTrackId, requestClearAction]);

  const handleMelodyStepToggle = useCallback((step, note) => {
    melodyRecording.stopRecording();
    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      const scope = createTrackActionScope(state);
      if (scope.trackType !== 'melody') return;
      const { auditionNote, nextMatrix } = getMelodyCellToggleResult(
        scope.matrix,
        selectedBar,
        step,
        note,
      );
      state.setCell(scope.trackId, selectedBar, step, nextMatrix.melody[selectedBar][step]);
      if (auditionNote) {
        void audioEngine.triggerMelodyInputOneShot(auditionNote, undefined, {
          trackId: scope.trackId,
        });
      }
    });
  }, [melodyRecording, selectedBar, withUndoCheckpoint]);

  const handleMelodyPreview = useCallback((noteOrNotes, options = {}) => {
    const trackId = useMusicStore.getState().activeTrackId;
    if (Array.isArray(noteOrNotes)) {
      return audioEngine.previewMelodySequence(noteOrNotes, {
        trackId,
        timbreId: options.timbreId,
      });
    }

    return audioEngine.triggerMelodyInputOneShot(noteOrNotes, undefined, { trackId });
  }, []);

  const handleMelodyPreviewStop = useCallback(() => {
    audioEngine.stopMelodyPreview?.();
  }, []);

  const handleMelodyTimbrePrepare = useCallback((timbreId) => (
    audioEngine.prepareMelodyTimbre?.(timbreId) ?? Promise.resolve(false)
  ), []);

  const handleMelodyStyleTemplateApply = useCallback((templateId, timbreId) => {
    let tutorialAction = null;
    if (tutorialActive && currentTutorialStep?.id === TUTORIAL_STEP_IDS.MELODY_SELECT_SCALE) {
      tutorialAction = handleTutorialControlAction({
        control: TUTORIAL_CONTROL_TARGETS.MELODY_STYLE_APPLY_GLOBAL,
        progress: tutorialProgress,
        selectedBar,
        step: currentTutorialStep,
        templateId,
      });
      if (!tutorialAction.allowed) return;
    }

    melodyRecording.stopRecording();
    melodyRecording.clearActiveNotes();
    return withUndoCheckpoint(() => {
      const applied = useMusicStore.getState().setMelodyStyleTemplate(templateId, timbreId);
      if (!applied) return;
      audioEngine.activateMelodyTimbre?.(timbreId);
      if (tutorialAction) applyTutorialActionProgress(tutorialAction);
      return true;
    }, { force: Boolean(tutorialAction) });
  }, [
    applyTutorialActionProgress,
    currentTutorialStep,
    selectedBar,
    tutorialActive,
    tutorialProgress,
    melodyRecording,
    withUndoCheckpoint,
  ]);

  const handleClearMelodyBar = useCallback(() => {
    requestClearAction(activeTrackId, 'bar', selectedBar);
  }, [activeTrackId, requestClearAction, selectedBar]);

  const handleClearMelody = useCallback(() => {
    requestClearAction(activeTrackId, 'track');
  }, [activeTrackId, requestClearAction]);

  const confirmClearAction = useCallback(() => {
    const action = pendingClearAction;
    if (!action) return;

    setPendingClearAction(null);
    if (action.trackType === 'melody') melodyRecording.stopRecording();

    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      const scope = createTrackActionScope(state, action.trackId);
      if (scope.trackType !== action.trackType) return;

      if (action.scope === 'track') {
        if (action.trackType === 'melody') {
          state.clearTrack(action.trackId);
          return;
        }

        state.clearTrack(action.trackId);
        return;
      }

      if (action.trackType === 'drums') {
        const nextMatrix = clearDrumsBar(scope.matrix, action.bar);
        writeDrumsBars(nextMatrix, [action.bar], action.trackId);
        return;
      }

      if (action.trackType === 'chord') {
        const nextMatrix = clearChordRhythmBar(scope.matrix, action.bar);
        if (nextMatrix !== scope.matrix) state.setTrackMatrix(action.trackId, nextMatrix.chord);
        return;
      }

      if (action.trackType === 'bass') {
        const nextMatrix = clearBassBar(scope.matrix, action.bar);
        nextMatrix.bass[action.bar].forEach((cell, step) => {
          state.setCell(action.trackId, action.bar, step, cell);
        });
        return;
      }

      const nextMatrix = clearMelodyBar(scope.matrix, action.bar);
      state.setTrackMatrix(action.trackId, nextMatrix.melody);
    });
  }, [
    melodyRecording,
    pendingClearAction,
    withUndoCheckpoint,
    writeDrumsBars,
  ]);

  const handleTutorialNext = useCallback(() => {
    if (!tutorialViewModel.canManualNext) return;
    withUndoCheckpoint(() => {
      clearTutorialAutoAdvanceTimer();
      clearTutorialCountIn();
      advanceTutorialToNextStep(tutorialProgress);
    }, { force: true });
  }, [
    advanceTutorialToNextStep,
    clearTutorialCountIn,
    tutorialProgress,
    tutorialViewModel.canManualNext,
    withUndoCheckpoint,
  ]);

  const handleTutorialOpenClip = useCallback((clip) => {
    if (!tutorialActive) return true;

    const tutorialAction = handleTutorialClipOpen({
      bar: clip?.bar,
      progress: tutorialProgress,
      step: currentTutorialStep,
      trackId: clip?.trackId,
    });
    if (!tutorialAction.allowed) return false;

    withUndoCheckpoint(() => {
      setTutorialProgress(tutorialAction.nextProgress);

      if (tutorialAction.shouldAdvance) {
        if (clip?.id) useMusicStore.getState().selectClip(clip.id);
        advanceTutorialToNextStep(tutorialAction.nextProgress);
      }
    }, { force: true });

    return true;
  }, [
    advanceTutorialToNextStep,
    currentTutorialStep,
    setTutorialProgress,
    tutorialActive,
    tutorialProgress,
    withUndoCheckpoint,
  ]);

  const handleLaunchpadDrumsClipSelect = useCallback((bar) => {
    const result = selectLaunchpadDrumsClip({
      bar,
      canSelectClip: handleTutorialOpenClip,
      dispatchSeek: (targetBar, targetStep) => {
        void dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: targetBar,
          step: targetStep,
        });
      },
      store: useMusicStore,
      withUndoCheckpoint,
    });

    return result.ok;
  }, [dispatchAppCommand, handleTutorialOpenClip, withUndoCheckpoint]);

  const handleLaunchpadChordClipSelect = useCallback((bar) => {
    setLaunchpadChordHarmonyTarget(null);
    const result = selectLaunchpadChordClip({
      bar,
      canSelectClip: handleTutorialOpenClip,
      dispatchSeek: (targetBar, targetStep) => {
        void dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: targetBar,
          step: targetStep,
        });
      },
      store: useMusicStore,
      withUndoCheckpoint,
    });

    return result.ok;
  }, [dispatchAppCommand, handleTutorialOpenClip, withUndoCheckpoint]);

  const handleLaunchpadMelodyClipSelect = useCallback((bar) => {
    melodyRecording.stopRecording();
    const result = selectLaunchpadMelodyClip({
      bar,
      canSelectClip: handleTutorialOpenClip,
      dispatchSeek: (targetBar, targetStep) => {
        void dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: targetBar,
          step: targetStep,
        });
      },
      store: useMusicStore,
      withUndoCheckpoint,
    });

    return result.ok;
  }, [
    dispatchAppCommand,
    handleTutorialOpenClip,
    melodyRecording,
    withUndoCheckpoint,
  ]);

  const handleLaunchpadChordHarmonyOpen = useCallback((bar, step) => {
    const state = useMusicStore.getState();
    const activeClip = state.clips.byId[state.selectedClipId];
    const trackType = getTrackType(state, state.activeTrackId);
    if (
      trackType !== 'chord'
      || activeClip?.trackId !== state.activeTrackId
      || state.selectedBar !== bar
      || state.matrix[state.activeTrackId]?.[bar]?.[step]?.type !== 'chord'
    ) {
      return false;
    }

    setLaunchpadChordHarmonyTarget({ bar, step });
    return true;
  }, []);

  const handleLaunchpadChordHarmonyClose = useCallback(() => {
    setLaunchpadChordHarmonyTarget(null);
    return true;
  }, []);

  const handleLaunchpadChordHarmonyOption = useCallback((command) => {
    const selectedOption = chordHarmonyState?.selectedOption;
    if (
      chordHarmonyState?.bar !== command.bar
      || chordHarmonyState.step !== command.step
      || selectedOption?.mode !== command.mode
      || selectedOption.optionIndex !== command.optionIndex
    ) {
      return false;
    }

    const state = useMusicStore.getState();
    const harmonyState = createLaunchpadChordHarmonyState({
      bar: command.bar,
      clips: state.clips,
      matrix: state.matrix,
      step: command.step,
    });
    if (!harmonyState || state.selectedBar !== command.bar) return false;

    const options = command.mode === 'passing'
      ? harmonyState.passingOptions
      : harmonyState.enrichOptions;
    const option = options[command.optionIndex];
    if (!option) return false;

    const applied = handleChordStepHarmonyApply({
      bar: command.bar,
      chordName: option.name,
      mode: command.mode,
      stepIndex: command.step,
    });
    if (!applied) setLaunchpadChordHarmonyTarget(null);
    return true;
  }, [chordHarmonyState, handleChordStepHarmonyApply]);

  const handleLaunchpadChordHarmonySelect = useCallback((command) => {
    if (
      chordHarmonyState?.bar !== command.bar
      || chordHarmonyState.step !== command.step
    ) {
      return false;
    }

    const options = command.mode === 'passing'
      ? chordHarmonyState.passingOptions
      : chordHarmonyState.enrichOptions;
    if (!options[command.optionIndex]) return false;

    setLaunchpadChordHarmonyTarget({
      bar: command.bar,
      selectedOption: {
        mode: command.mode,
        optionIndex: command.optionIndex,
      },
      step: command.step,
    });
    return true;
  }, [chordHarmonyState]);

  const handleLaunchpadChordHarmonyPreview = useCallback((command) => {
    const selectedOption = chordHarmonyState?.selectedOption;
    if (
      chordHarmonyState?.bar !== command.bar
      || chordHarmonyState.step !== command.step
      || selectedOption?.mode !== command.mode
      || selectedOption.optionIndex !== command.optionIndex
    ) {
      return false;
    }

    void handleChordStepHarmonyPreview({
      chordName: selectedOption.name,
      mode: selectedOption.mode,
      preserveTransport: true,
    });
    return true;
  }, [chordHarmonyState, handleChordStepHarmonyPreview]);

  const dispatchInputCommand = useCallback((command) => {
    if (command?.type === APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE) {
      const state = useMusicStore.getState();
      const instanceIds = getTrackInstanceIdsByType(state, command.trackId);
      if (!instanceIds.length) return false;
      const activeIndex = instanceIds.indexOf(state.activeTrackId);
      const targetTrackId = activeIndex >= 0
        ? instanceIds[(activeIndex + 1) % instanceIds.length]
        : instanceIds[0];
      const targetClip = state.getClipForTrackBar(targetTrackId, state.selectedBar);
      state.setActiveTrackId(targetTrackId);
      state.setSelectedClipId(targetClip?.id ?? null);
      void dispatchAppCommand({
        ...command,
        trackId: targetTrackId,
      });
      return true;
    }

    if (command?.type === APP_COMMAND_TYPES.APP_UNDO) {
      handleUndoWithMelodyStop();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.APP_REDO) {
      handleRedoWithMelodyStop();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY) {
      handlePlayToggle();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.TRANSPORT_STOP) {
      handleStop();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND) {
      stopMelodyRecording({ stopTransport: false });
      handleStopAndRewind();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.TRANSPORT_SEEK) {
      stopDrumsRecording();
      stopMelodyRecording();
      void dispatchAppCommand(command);
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.DRUMS_PREVIEW) {
      drumsRecording.handlePadInput(
        command.instrument,
        command.inputTimestampMs,
        command.inputSource,
      );
      const state = useMusicStore.getState();
      const trackId = getTrackType(state, state.activeTrackId) === 'drums'
        ? state.activeTrackId
        : 'drums';
      void dispatchAppCommand({ ...command, trackId });
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.DRUMS_SELECT_CLIP) {
      if (drumsRecording.workflowLocked) return false;
      return handleLaunchpadDrumsClipSelect(command.bar);
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_SELECT_CLIP) {
      return handleLaunchpadChordClipSelect(command.bar);
    }

    if (command?.type === APP_COMMAND_TYPES.MELODY_SELECT_CLIP) {
      return handleLaunchpadMelodyClipSelect(command.bar);
    }

    if (command?.type === APP_COMMAND_TYPES.MELODY_SELECT_STEP) {
      return melodyRecording.selectTemplateStep(command.bar, command.step);
    }

    if (command?.type === APP_COMMAND_TYPES.MELODY_NOTE_ON) {
      return melodyRecording.handleNoteOn(command);
    }

    if (command?.type === APP_COMMAND_TYPES.MELODY_NOTE_OFF) {
      return melodyRecording.handleNoteOff(command);
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_OPEN_HARMONY) {
      return handleLaunchpadChordHarmonyOpen(command.bar, command.step);
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY) {
      return handleLaunchpadChordHarmonyClose();
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION) {
      return handleLaunchpadChordHarmonyOption(command);
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION) {
      return handleLaunchpadChordHarmonySelect(command);
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION) {
      return handleLaunchpadChordHarmonyPreview(command);
    }

    if (command?.type === APP_COMMAND_TYPES.DRUMS_TOGGLE) {
      if (drumsRecording.workflowLocked) return;
      const state = useMusicStore.getState();
      const activeClip = state.clips.byId[state.selectedClipId];
      if (
        getTrackType(state, state.activeTrackId) !== 'drums'
        || activeClip?.trackId !== state.activeTrackId
        || command.bar !== state.selectedBar
      ) {
        return;
      }
      handleDrumsStepToggle(command.instrument, command.step, command.bar);
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM) {
      const state = useMusicStore.getState();
      const activeClip = state.clips.byId[state.selectedClipId];
      if (
        getTrackType(state, state.activeTrackId) !== 'chord'
        || activeClip?.trackId !== state.activeTrackId
        || command.bar !== state.selectedBar
      ) {
        return;
      }
      handleChordRhythmStepToggle(command.step, command.bar);
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.CLIP_COPY_SELECTED) {
      if (drumsRecording.workflowLocked) return;
      handleCopySelectedClip();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.CLIP_PASTE) {
      handlePasteClipRequestWithMelodyStop();
      return;
    }

    if (command?.type === APP_COMMAND_TYPES.CLIP_DELETE_SELECTED) {
      stopDrumsRecording();
      stopMelodyRecording();
      const selectionClipIds = getTimelineSelectionClipIds(
        useMusicStore.getState().clips,
        timelineSelection,
      );
      if (timelineSelection) {
        if (selectionClipIds.length) {
          withUndoCheckpoint(() => {
            useMusicStore.getState().deleteClipsByIds(selectionClipIds);
          });
        }
        setTimelineSelection(null);
        return;
      }

      withUndoCheckpoint(() => {
        useMusicStore.getState().deleteSelectedClip();
      });
      return;
    }

    void dispatchAppCommand(command);
  }, [
    dispatchAppCommand,
    drumsRecording,
    handleCopySelectedClip,
    handleChordRhythmStepToggle,
    handleDrumsStepToggle,
    handleLaunchpadChordClipSelect,
    handleLaunchpadChordHarmonyClose,
    handleLaunchpadChordHarmonyOpen,
    handleLaunchpadChordHarmonyOption,
    handleLaunchpadChordHarmonyPreview,
    handleLaunchpadChordHarmonySelect,
    handleLaunchpadDrumsClipSelect,
    handleLaunchpadMelodyClipSelect,
    handlePasteClipRequestWithMelodyStop,
    handlePlayToggle,
    handleRedoWithMelodyStop,
    handleStop,
    handleStopAndRewind,
    handleUndoWithMelodyStop,
    melodyRecording,
    stopDrumsRecording,
    stopMelodyRecording,
    timelineSelection,
    withUndoCheckpoint,
  ]);

  useKeyboardCommands({
    canPasteClip,
    dispatch: dispatchInputCommand,
    enabled: !pendingClearAction && !performanceActive
      && drumsRecording.recordingState.phase !== 'confirm',
    hasTimelineSelection: Boolean(timelineSelection),
  });
  const {
    connect: connectLaunchpad,
    ...launchpadInput
  } = useLaunchpadXCommands({
    enabled: !performanceActive,
    activeInputNotes: melodyRecording.activeInputNotes,
    chordActive,
    chordClipBars,
    chordHarmonyState,
    currentBar,
    currentStep,
    dispatch: dispatchInputCommand,
    drumsActive,
    drumsClipBars,
    isPlaying,
    matrix: editorMatrix,
    melodyActive,
    melodyClipBars,
    melodyRecordingState: melodyRecording.recordingState,
    melodyScaleId,
    melodyTemplateSteps,
    mutedTracks: launchpadMutedTracks,
    selectedBar,
  });
  const handleLaunchpadConnect = useCallback(() => {
    void audioEngine.startAudio();
    void connectLaunchpad();
  }, [connectLaunchpad]);

  const handleTutorialBack = useCallback(() => {
    clearTutorialAutoAdvanceTimer();
    clearTutorialCountIn();
    stopTutorialPreviewPlayback();
    const targetStepIndex = Math.max(currentTutorialStepIndex - 1, 0);
    const targetCheckpoint = ensureTutorialStepCheckpoint(targetStepIndex);
    if (!targetCheckpoint) return;

    restoreTutorialCheckpoint({
      checkpoint: targetCheckpoint,
      setAppliedTutorialSetups,
      setTutorialProgress,
      store: useMusicStore,
    });
    applyTutorialStepSetup(
      DRUMS_TUTORIAL_STEPS[targetStepIndex],
      targetCheckpoint?.appliedTutorialSetups,
    );
    setTutorialStepCheckpoints((checkpoints) => pruneTutorialCheckpoints(
      checkpoints,
      targetStepIndex + 1,
    ));
    setCurrentTutorialStepIndex(targetStepIndex);
  }, [
    applyTutorialStepSetup,
    clearTutorialCountIn,
    currentTutorialStepIndex,
    ensureTutorialStepCheckpoint,
    setAppliedTutorialSetups,
    setCurrentTutorialStepIndex,
    setTutorialProgress,
    setTutorialStepCheckpoints,
    stopTutorialPreviewPlayback,
  ]);

  const handleTutorialJumpToSection = useCallback((targetStepIndex) => {
    clearTutorialAutoAdvanceTimer();
    clearTutorialCountIn();
    stopTutorialPreviewPlayback();
    const targetCheckpoint = ensureTutorialStepCheckpoint(targetStepIndex);
    if (!targetCheckpoint) return;

    restoreTutorialCheckpoint({
      checkpoint: targetCheckpoint,
      setAppliedTutorialSetups,
      setTutorialProgress,
      store: useMusicStore,
    });
    applyTutorialStepSetup(
      DRUMS_TUTORIAL_STEPS[targetStepIndex],
      targetCheckpoint?.appliedTutorialSetups,
    );
    setCurrentTutorialStepIndex(targetStepIndex);
    setTutorialModeActive(true);
    setTutorialSidebarCollapsed(false);
    setTutorialVisible(true);
  }, [
    applyTutorialStepSetup,
    clearTutorialCountIn,
    ensureTutorialStepCheckpoint,
    setAppliedTutorialSetups,
    setCurrentTutorialStepIndex,
    setTutorialModeActive,
    setTutorialProgress,
    setTutorialSidebarCollapsed,
    setTutorialVisible,
    stopTutorialPreviewPlayback,
  ]);

  const resetLegacyTutorialSession = useCallback(() => {
    const initialAppState = useMusicStore.getInitialState();
    const initialTutorialProgress = createTutorialState();
    useMusicStore.setState(initialAppState, true);
    setCurrentTutorialStepIndex(0);
    setTutorialProgress(initialTutorialProgress);
    setAppliedTutorialSetups(() => new Set());
    setTutorialStepCheckpoints(() => ({
      0: createTutorialCheckpoint({
        appState: initialAppState,
        appliedTutorialSetups: new Set(),
        tutorialProgress: initialTutorialProgress,
      }),
    }));
  }, [
    setAppliedTutorialSetups,
    setCurrentTutorialStepIndex,
    setTutorialProgress,
    setTutorialStepCheckpoints,
  ]);

  const resetChillTutorialSession = useCallback(() => {
    const initialAppState = useMusicStore.getInitialState();
    useMusicStore.setState({
      ...initialAppState,
      ...createChillTutorialAppState(initialAppState),
    }, true);
    chillStepCheckpointsRef.current = {};
    chillPreviewGenerationRef.current += 1;
    chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
    setTutorialSessions((sessions) => ({
      ...sessions,
      [TUTORIAL_IDS.CHILL_RAINY_STREET]: {
        ...createChillTutorialSession(),
        hasStarted: true,
      },
    }));
  }, [setTutorialSessions]);

  const handleTutorialSelect = useCallback((tutorialId, { restart = false } = {}) => {
    clearTutorialAutoAdvanceTimer();
    clearTutorialCountIn();
    handleStop();
    if (activeTutorialId && tutorialPanelState === 'running') {
      captureTutorialMusicSnapshot(activeTutorialId);
    }
    clearUndoHistory();

    if (restart) {
      delete tutorialMusicSnapshotsRef.current[tutorialId];
    }

    if (tutorialId === TUTORIAL_IDS.CHILL_RAINY_STREET) {
      const hasSavedSession = !restart
        && tutorialSessions[tutorialId]?.hasStarted
        && restoreTutorialMusicSnapshot(tutorialId);
      if (!hasSavedSession) resetChillTutorialSession();
      updateTutorialSession(tutorialId, (session) => ({
        ...session,
        hasStarted: true,
        paused: false,
      }));
      setTutorialVisible(false);
      setTutorialModeActive(false);
      setTutorialSidebarCollapsed(true);
    } else {
      const hasSavedSession = !restart
        && tutorialSessions[tutorialId]?.hasStarted
        && restoreTutorialMusicSnapshot(tutorialId);
      if (!hasSavedSession) resetLegacyTutorialSession();
      updateTutorialSession(tutorialId, (session) => ({
        ...session,
        hasStarted: true,
      }));
      setTutorialVisible(true);
      setTutorialModeActive(true);
      setTutorialSidebarCollapsed(false);
    }

    setActiveTutorialId(tutorialId);
    setTutorialPanelState('running');
  }, [
    activeTutorialId,
    captureTutorialMusicSnapshot,
    clearTutorialCountIn,
    clearUndoHistory,
    handleStop,
    resetChillTutorialSession,
    resetLegacyTutorialSession,
    restoreTutorialMusicSnapshot,
    setActiveTutorialId,
    setTutorialModeActive,
    setTutorialPanelState,
    setTutorialSidebarCollapsed,
    setTutorialVisible,
    tutorialPanelState,
    tutorialSessions,
    updateTutorialSession,
  ]);

  const handleTutorialRestart = useCallback((tutorialId) => {
    handleTutorialSelect(tutorialId, { restart: true });
  }, [handleTutorialSelect]);

  const handleTutorialLibraryClose = useCallback(() => {
    setTutorialPanelState('closed');
  }, [setTutorialPanelState]);

  const handleChillTutorialExit = useCallback(() => {
    handleStop();
    captureTutorialMusicSnapshot(TUTORIAL_IDS.CHILL_RAINY_STREET);
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => ({
      ...session,
      paused: false,
    }));
    setTutorialPanelState('library');
  }, [
    captureTutorialMusicSnapshot,
    handleStop,
    setTutorialPanelState,
    updateTutorialSession,
  ]);

  const handleChillTutorialPause = useCallback(() => {
    handleStop();
    captureTutorialMusicSnapshot(TUTORIAL_IDS.CHILL_RAINY_STREET);
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => ({
      ...session,
      paused: true,
    }));
    setTutorialPanelState('closed');
  }, [
    captureTutorialMusicSnapshot,
    handleStop,
    setTutorialPanelState,
    updateTutorialSession,
  ]);

  const handleChillTutorialBack = useCallback(() => {
    if (chillTutorialSession.stepIndex <= 0) return;
    handleStop();
    const targetStepIndex = chillTutorialSession.stepIndex - 1;
    const checkpoint = chillStepCheckpointsRef.current[targetStepIndex];
    if (checkpoint?.appState) useMusicStore.setState(checkpoint.appState);
    const completedSteps = CHILL_TUTORIAL_STEPS.slice(0, targetStepIndex);
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => ({
      ...session,
      appliedRecipeIds: completedSteps.flatMap((step) => step.recipeIds),
      completed: false,
      completedStepIds: completedSteps.map((step) => step.id),
      runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
      stepIndex: targetStepIndex,
    }));
  }, [
    chillTutorialSession.stepIndex,
    handleStop,
    updateTutorialSession,
  ]);

  const completeChillTutorial = useCallback(() => {
    clearTutorialAutoAdvanceTimer();
    chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
    audioEngine.setPlaybackCompleteHandler?.(null);
    void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    captureTutorialMusicSnapshot(TUTORIAL_IDS.CHILL_RAINY_STREET);
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => ({
      ...session,
      completed: true,
      paused: false,
      runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
    }));
    setTutorialPanelState('library');
  }, [
    captureTutorialMusicSnapshot,
    dispatchAppCommand,
    setTutorialPanelState,
    updateTutorialSession,
  ]);

  const startChillTutorialPreview = useCallback((step, stepIndex) => {
    if (!step?.preview) return;

    clearTutorialAutoAdvanceTimer();
    const generation = chillPreviewGenerationRef.current + 1;
    chillPreviewGenerationRef.current = generation;
    chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.PREVIEWING;
    updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => (
      beginChillTutorialPreview(session, {
        recipeIds: step.recipeIds,
        stepId: step.id,
      })
    ));

    audioEngine.setPlaybackCompleteHandler?.(() => {
      if (
        chillPreviewGenerationRef.current !== generation
        || chillPreviewLifecycleRef.current !== CHILL_TUTORIAL_RUN_STATES.PREVIEWING
      ) {
        return;
      }

      audioEngine.setPlaybackCompleteHandler?.(null);
      chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.COMPLETED;
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
      updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => (
        completeChillTutorialPreview(session)
      ));

      scheduleTutorialAutoAdvance(() => {
        if (
          chillPreviewGenerationRef.current !== generation
          || chillPreviewLifecycleRef.current !== CHILL_TUTORIAL_RUN_STATES.COMPLETED
        ) {
          return;
        }

        if (step.explicit) {
          completeChillTutorial();
          return;
        }

        chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
        updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => (
          session.stepIndex === stepIndex
            ? advanceChillTutorialStep(session, CHILL_TUTORIAL_STEPS.length)
            : cancelChillTutorialPreview(session)
        ));
      }, step.explicit ? CHILL_COMPLETE_AUTO_ADVANCE_MS : CHILL_STEP_AUTO_ADVANCE_MS);
    });

    void (async () => {
      try {
        await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
        if (chillPreviewGenerationRef.current !== generation) return;
        await dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: step.preview.bar,
          step: 0,
        });
        if (chillPreviewGenerationRef.current !== generation) return;
        await dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
          maxPlaybackSteps: step.preview.maxPlaybackSteps,
        });
      } catch {
        if (chillPreviewGenerationRef.current !== generation) return;
        chillPreviewLifecycleRef.current = CHILL_TUTORIAL_RUN_STATES.IDLE;
        audioEngine.setPlaybackCompleteHandler?.(null);
        updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => (
          cancelChillTutorialPreview(session)
        ));
      }
    })();
  }, [
    completeChillTutorial,
    dispatchAppCommand,
    updateTutorialSession,
  ]);

  const handleChillTutorialPrimary = useCallback(() => {
    const step = chillTutorialStep;
    if (
      !step
      || chillTutorialSession.runState !== CHILL_TUTORIAL_RUN_STATES.IDLE
    ) {
      return;
    }

    if (step.explicit) {
      if (!isChillTutorialScoreComplete(useMusicStore.getState().matrix)) return;
      startChillTutorialPreview(step, chillTutorialSession.stepIndex);
      return;
    }

    const currentStepIndex = chillTutorialSession.stepIndex;
    const stepAlreadyApplied = chillTutorialSession.completedStepIds?.includes(step.id) ?? false;
    if (!stepAlreadyApplied) {
      const recipePatch = applyChillTutorialRecipeSequence(
        useMusicStore.getState(),
        step.recipeIds,
        {
          focusBar: step.focusBar,
          focusTrackId: step.focusTrackId,
        },
      );
      if (!recipePatch) return;
      chillStepCheckpointsRef.current[currentStepIndex] = createTutorialCheckpoint({
        appState: useMusicStore.getState(),
      });
      withUndoCheckpoint(() => {
        useMusicStore.setState(recipePatch);
      });
    }
    startChillTutorialPreview(step, currentStepIndex);
  }, [
    chillTutorialSession.completedStepIds,
    chillTutorialSession.runState,
    chillTutorialSession.stepIndex,
    chillTutorialStep,
    startChillTutorialPreview,
    withUndoCheckpoint,
  ]);

  useEffect(() => {
    if (!chillTutorialActive || !chillTutorialStep?.focusTrackId) return undefined;
    const state = useMusicStore.getState();
    const clip = state.getClipForTrackBar(
      chillTutorialStep.focusTrackId,
      chillTutorialStep.focusBar,
    );
    if (clip && state.selectedClipId !== clip.id) state.selectClip(clip.id);

    const frameId = window.requestAnimationFrame(() => {
      document.querySelector(chillTutorialStep.anchorSelectors[0])?.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    chillTutorialActive,
    chillTutorialStep,
  ]);

  const handleTutorialSkip = useCallback(() => {
    withUndoCheckpoint(() => {
      const initialAppState = useMusicStore.getInitialState();
      const skippedAppState = createTutorialSkipAppState(initialAppState);

      clearTutorialAutoAdvanceTimer();
      clearTutorialCountIn();
      stopTutorialPreviewPlayback();
      useMusicStore.setState(skippedAppState, true);
      setCurrentTutorialStepIndex(0);
      setTutorialProgress(createTutorialState());
      setAppliedTutorialSetups(() => new Set());
      setTutorialStepCheckpoints(() => ({
        0: createTutorialCheckpoint({
          appState: initialAppState,
          appliedTutorialSetups: new Set(),
          tutorialProgress: createTutorialState(),
        }),
      }));
      setTutorialModeActive(false);
      setTutorialSidebarCollapsed(true);
      setTutorialVisible(true);
      updateTutorialSession(TUTORIAL_IDS.LEGACY_BASICS, (session) => ({
        ...session,
        completed: true,
        hasStarted: true,
      }));
      setTutorialPanelState('library');
    }, { force: true });
  }, [
    clearTutorialCountIn,
    setAppliedTutorialSetups,
    setCurrentTutorialStepIndex,
    setTutorialModeActive,
    setTutorialPanelState,
    setTutorialProgress,
    setTutorialSidebarCollapsed,
    setTutorialStepCheckpoints,
    setTutorialVisible,
    stopTutorialPreviewPlayback,
    updateTutorialSession,
    withUndoCheckpoint,
  ]);

  const handleTutorialSidebarToggle = useCallback(() => {
    if (
      activeTutorialId === TUTORIAL_IDS.CHILL_RAINY_STREET
      && chillTutorialSession.paused
    ) {
      updateTutorialSession(TUTORIAL_IDS.CHILL_RAINY_STREET, (session) => ({
        ...session,
        paused: false,
      }));
      setTutorialPanelState('running');
      return;
    }

    if (tutorialPanelState === 'library') {
      setTutorialPanelState('closed');
      return;
    }

    if (tutorialPanelState === 'running') {
      handleStop();
      captureTutorialMusicSnapshot(activeTutorialId);
      setTutorialVisible(false);
      setTutorialModeActive(false);
      setTutorialSidebarCollapsed(true);
      setTutorialPanelState('library');
      return;
    }

    setTutorialPanelState('library');
  }, [
    activeTutorialId,
    captureTutorialMusicSnapshot,
    chillTutorialSession.paused,
    setTutorialModeActive,
    setTutorialPanelState,
    setTutorialSidebarCollapsed,
    setTutorialVisible,
    handleStop,
    tutorialPanelState,
    updateTutorialSession,
  ]);

  const handleTutorialCompleteTask = useCallback(() => {
    const tutorialAction = completeTutorialPrimaryAction({
      progress: tutorialProgress,
      step: currentTutorialStep,
    });
    if (!tutorialAction.allowed) return;
    withUndoCheckpoint(() => {
      applyTutorialActionProgress(tutorialAction);
    }, { force: true });
  }, [applyTutorialActionProgress, currentTutorialStep, tutorialProgress, withUndoCheckpoint]);

  const tutorialSidebarOpen = tutorialPanelState === 'library'
    || (
      activeTutorialId === TUTORIAL_IDS.LEGACY_BASICS
      && tutorialPanelState === 'running'
      && tutorialVisible
      && !tutorialSidebarCollapsed
    );
  const tutorialToggleLabel = chillTutorialSession.paused
    ? '继续教程'
    : tutorialPanelState === 'library'
      ? '关闭教程列表'
      : tutorialPanelState === 'running'
        ? '返回教程列表'
        : '教程';
  const appClassName = [
    'app',
    tutorialSidebarOpen ? 'tutorial-sidebar-open' : 'tutorial-sidebar-collapsed',
    chillTutorialActive ? 'chill-tutorial-running' : '',
    isEditorResizing ? 'editor-resizing' : '',
  ].filter(Boolean).join(' ');
  const workspaceClassName = [
    'workspace',
    tutorialSidebarOpen ? 'tutorial-sidebar-open' : 'tutorial-sidebar-collapsed',
    chillTutorialActive ? 'chill-tutorial-running' : '',
  ].filter(Boolean).join(' ');
  const appStyle = editorHeightPx === null ? undefined : {
    '--app-editor-height': `${editorHeightPx}px`,
  };
  function enterPerformance() {
    handleStop();
    audioEngine.stopAllVoices();
    clearTutorialAutoAdvanceTimer();
    if (chillTutorialActive) handleChillTutorialPause();
    setTutorialPanelState('closed');
    setPerformanceVisited(true);
    setPerformanceActive(true);
  }

  return (
    <>
    <div
      className={`${appClassName}${performanceActive ? ' performance-arranger-hidden' : ''}`}
      inert={performanceActive ? true : undefined}
      data-screen-label="Main"
      aria-label="Project Arranger workspace"
      style={appStyle}
    >
      <div className="app-main">
        {createElement(TopBar, {
          activeTutorialTarget,
          bpm,
          bpmLocked,
          bpmLockReason,
          canCopyClip,
          canPasteClip,
          canRedo,
          canUndo,
          currentBar,
          currentStep,
          isPlaying,
          hardwareInput: {
            ...launchpadInput,
            captureLabel: 'CAPTURE = PLAY',
            onConnect: handleLaunchpadConnect,
          },
          onBackToStart: handleBackToStart,
          onBpmChange: handleBpmChange,
          onCopyClip: handleCopySelectedClip,
          onExport: openExportDialog,
          onPerformanceEnter: enterPerformance,
          onNewSong: requestNewSong,
          onPasteClip: handlePasteClipRequestWithMelodyStop,
          onPlayToggle: handlePlayToggle,
          onStop: handleStop,
          onTutorialToggle: handleTutorialSidebarToggle,
          onRedo: handleRedoWithMelodyStop,
          onUndo: handleUndoWithMelodyStop,
          rootKey,
          scale,
          showTutorialToggle: true,
          tutorialCollapsed: tutorialSidebarCollapsed,
          tutorialToggleActive: tutorialPanelState !== 'closed' || chillTutorialSession.paused,
          tutorialToggleLabel,
          tutorialTargets: activeTutorialTargets,
        })}
        {isExportDialogOpen ? createElement(ExportDialog, {
          error: exportState.error,
          isExporting: exportState.isExporting,
          onClose: closeExportDialog,
          onExportAudio: handleExportAudio,
          onExportStems: handleExportStems,
          onExportMidi: handleExportMidi,
          onExportProject: handleExportProject,
        }) : null}
        {chillTutorialActive ? createElement(ChillTutorialStageRail, {
          activeStageIndex: chillTutorialStep.stageIndex,
          stages: CHILL_TUTORIAL_STAGES,
        }) : null}
        {isNewSongConfirmOpen ? (
          <div className="new-song-confirm-overlay" role="presentation">
            <section
              className="new-song-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-song-confirm-title"
              aria-describedby="new-song-confirm-copy"
            >
              <span className="new-song-confirm-kicker">NEW MOVEMENT</span>
              <h2 className="new-song-confirm-title" id="new-song-confirm-title">
                创建新的乐章？
              </h2>
              <p className="new-song-confirm-copy" id="new-song-confirm-copy">
                是否放弃当前进度创建新的乐章？当前编曲、教程进度和未保存的编辑都会被重置。
              </p>
              <div className="new-song-confirm-actions">
                <button className="new-song-confirm-cancel" type="button" onClick={cancelNewSong}>
                  取消
                </button>
                <button className="new-song-confirm-apply" type="button" onClick={confirmNewSong}>
                  创建新乐章
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {pendingClearAction ? (
          <div className="new-song-confirm-overlay clear-confirm-overlay" role="presentation">
            <section
              className="new-song-confirm-dialog clear-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-confirm-title"
              aria-describedby="clear-confirm-copy"
            >
              <div className="clear-confirm-heading">
                <span className="new-song-confirm-kicker">CLEAR CONTENT</span>
                <button
                  className="clear-confirm-close"
                  type="button"
                  aria-label="关闭清空确认框"
                  onClick={cancelClearAction}
                >
                  ×
                </button>
              </div>
              <h2 className="new-song-confirm-title" id="clear-confirm-title">
                {pendingClearAction.scope === 'bar'
                  ? `确认清空 ${pendingClearAction.trackName} 第 ${pendingClearAction.bar + 1} 小节？`
                  : `确认清空整条 ${pendingClearAction.trackName} 轨？`}
              </h2>
              <p className="new-song-confirm-copy" id="clear-confirm-copy">
                {pendingClearAction.scope === 'bar'
                  ? '该小节中的全部内容都会被移除。确认后可使用撤销恢复。'
                  : '该轨道所有小节中的内容都会被移除。确认后可使用撤销恢复。'}
              </p>
              <div className="new-song-confirm-actions">
                <button
                  className="new-song-confirm-cancel"
                  type="button"
                  autoFocus
                  onClick={cancelClearAction}
                >
                  取消
                </button>
                <button
                  className="new-song-confirm-apply"
                  type="button"
                  onClick={confirmClearAction}
                >
                  确认清空
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {pendingClipPaste ? (
          <div className="clip-paste-confirm-overlay" role="presentation">
            <section
              className="clip-paste-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clip-paste-confirm-title"
              aria-describedby="clip-paste-confirm-copy"
            >
              <span className="clip-paste-confirm-kicker">CLIP PASTE</span>
              <h2 className="clip-paste-confirm-title" id="clip-paste-confirm-title">
                {pendingClipPaste.kind === 'timeline-range'
                  ? '确认覆盖所选范围？'
                  : '确认覆盖这个 clip？'}
              </h2>
              <p className="clip-paste-confirm-copy" id="clip-paste-confirm-copy">
                {pendingClipPaste.kind === 'timeline-range' ? (
                  <>
                    从目标小节
                    {' '}
                    {pendingClipPaste.targetBar + 1}
                    {' '}
                    开始的范围内已有
                    {' '}
                    {pendingClipPaste.targetContentCount}
                    {' '}
                    个包含内容的小节，继续粘贴会替换它们的内容。
                  </>
                ) : (
                  <>
                    目标小节 {pendingClipPaste.targetBar + 1} 已有
                    {' '}
                    {pendingClipPaste.targetClip?.name ?? 'clip'}
                    ，继续粘贴会替换它的内容。
                  </>
                )}
              </p>
              <div className="clip-paste-confirm-actions">
                <button className="clip-paste-confirm-cancel" type="button" onClick={cancelClipPaste}>
                  取消
                </button>
                <button className="clip-paste-confirm-apply" type="button" onClick={confirmClipPaste}>
                  覆盖粘贴
                </button>
              </div>
            </section>
          </div>
        ) : null}
        <main className={workspaceClassName}>
          {createElement(TracksColumn, {
            activeTrackId,
            addTrackOptions: availableAddTrackOptions,
            canRemoveTrack,
            onAddTrack: handleAddTrack,
            onFillEmptyTrackClips: handleFillEmptyTrackClips,
            onMoveTrack: handleMoveTrack,
            onRemoveTrack: handleRemoveTrack,
            onRenameTrack: handleRenameTrack,
            onTrackSelect: handleTrackSelect,
            onVolumeChange: handleTrackVolumeChange,
            onVolumeChangeEnd: handleTrackVolumeChangeEnd,
            onVolumeChangeStart: handleTrackVolumeChangeStart,
            ref: tracksScrollRef,
            tutorialLocked: activeTutorialLocked,
            tutorialTargets: activeTutorialTargets,
            tracks,
          })}
          {createElement(Timeline, {
            activeTutorialTarget,
            activeTrackId,
            currentBar,
            currentStep,
            onAddClip: handleAddClip,
            onMoveClip: handleMoveClip,
            onOpenClip: handleOpenClip,
            onTransportSeek: handleTransportSeek,
            onTutorialOpenClip: handleTutorialOpenClip,
            onTrackSelect: handleTrackSelect,
            onTimelineSelectionChange: handleTimelineSelectionChange,
            ref: timelineScrollRef,
            selectedClipId,
            timelineSelection,
            tutorialLocked: activeTutorialLocked,
            tutorialTargets: activeTutorialTargets,
            tracks,
          })}
          {tutorialPanelState === 'library' ? (
            <TutorialLibraryPanel
              onClose={handleTutorialLibraryClose}
              onRestart={handleTutorialRestart}
              onSelect={handleTutorialSelect}
              sessions={tutorialSessions}
            />
          ) : null}
          {activeTutorialId === TUTORIAL_IDS.LEGACY_BASICS
            && tutorialPanelState === 'running'
            && tutorialVisible ? createElement(TutorialOverlay, {
            canGoBack: currentTutorialStepIndex > 0,
            canManualNext: tutorialViewModel.canManualNext,
            collapsed: tutorialSidebarCollapsed,
            countInValue: tutorialCountInValue,
            directoryItems: tutorialDirectoryItems,
            displayCopy: tutorialViewModel.displayCopy,
            onBack: handleTutorialBack,
            onCompleteTask: handleTutorialCompleteTask,
            onDirectorySelect: handleTutorialJumpToSection,
            onPrimaryAction: handleTutorialNext,
            onSkip: handleTutorialSkip,
            primaryDisabled: tutorialViewModel.primaryDisabled,
            primaryLabel: tutorialViewModel.primaryLabel,
            showCompleteButton: tutorialViewModel.showCompleteButton,
            step: currentTutorialStep,
          }) : null}
        </main>
        <div
          className="editor-resizer"
          role="separator"
          aria-label="调整上下屏幕大小"
          aria-orientation="horizontal"
          aria-valuemin={editorResizeMinHeight}
          aria-valuemax={editorResizeMaxHeight}
          aria-valuenow={currentEditorResizeValue}
          tabIndex={0}
          onPointerDown={handleEditorResizePointerDown}
          onKeyDown={handleEditorResizeKeyDown}
        >
          <span className="editor-resizer-grip" aria-hidden="true" />
        </div>
        {createElement(BottomEditor, {
          activeTrackId,
          activeTrackName,
          activeTrackType,
          activeTutorialTarget,
          tutorialLocked: activeTutorialLocked,
          tutorialTargets: activeTutorialTargets,
          isPlaying,
          matrix: editorMatrix,
          clips: editorClips,
          drumsRecordingState: drumsRecording.recordingState,
          genreId,
          melodyScaleId,
          melodyTimbreId,
          melodyActiveInputNotes: melodyRecording.activeInputNotes,
          melodyRecordingState: melodyRecording.recordingState,
          melodyRhythmTemplateId,
          selectedClipName: selectedClip?.name ?? '',
          onChordRhythmStepToggle: handleChordRhythmStepToggle,
          launchpadHarmonyTarget: launchpadChordHarmonyTarget,
          launchpadHarmonySelection: chordHarmonyState?.selectedOption ?? null,
          onLaunchpadHarmonyClose: handleLaunchpadChordHarmonyClose,
          onChordStepHarmonyApply: handleChordStepHarmonyApply,
          onChordStepHarmonyPreview: handleChordStepHarmonyPreview,
          onChordStepHarmonyPreviewStop: handleChordTemplateWorkspacePreviewStop,
          onChordTemplateWorkspacePreview: handleChordTemplateWorkspacePreview,
          onChordTemplateWorkspacePreviewStop: handleChordTemplateWorkspacePreviewStop,
          onChordTemplateWorkspaceApply: handleChordTemplateWorkspaceApply,
          onBassPreview: handleBassPreview,
          onBassStepToggle: handleBassStepToggle,
          onBassGrooveTemplatePreview: handleBassGrooveTemplatePreview,
          onBassGrooveTemplateApply: handleBassGrooveTemplateApply,
          onCloseEditor: handleCloseEditor,
          onClearBass: handleClearBass,
          onClearBassBar: handleClearBassBar,
          onClearMelody: handleClearMelody,
          onClearMelodyBar: handleClearMelodyBar,
          onMelodyPreview: handleMelodyPreview,
          onMelodyPreviewStop: handleMelodyPreviewStop,
          onMelodyNoteOff: melodyRecording.handleNoteOff,
          onMelodyNoteOn: melodyRecording.handleNoteOn,
          onMelodyRecordCancel: melodyRecording.cancelRecord,
          onMelodyRecordConfirm: melodyRecording.confirmRecord,
          onMelodyWriteToggle: melodyRecording.requestWriteToggle,
          onMelodyStyleTemplateApply: handleMelodyStyleTemplateApply,
          onMelodyTimbrePrepare: handleMelodyTimbrePrepare,
          onMelodyStepToggle: handleMelodyStepToggle,
          onRenameClip: handleRenameClip,
          onClearCurrentDrumsBar: handleClearCurrentDrumsBar,
          onClearChord: handleClearChord,
          onClearChordBar: handleClearChordBar,
          onClearDrums: handleClearDrums,
          canPageBars,
          onGenerateAllDrumsBars: handleGenerateAllDrumsBars,
          onGenerateCurrentDrumsBar: handleGenerateCurrentDrumsBar,
          onDrumTemplatePreview: handleDrumTemplatePreview,
          onDrumTemplatePreviewStop: handleDrumTemplatePreviewStop,
          onNextBar: handleNextBar,
          onPreviousBar: handlePreviousBar,
          onDrumsPadInput: drumsRecording.previewPadInput,
          onDrumsStepMove: handleDrumsStepMove,
          onDrumsStepToggle: handleDrumsStepToggle,
          onDrumsRecordCancel: drumsRecording.cancelRecord,
          onDrumsRecordConfirm: drumsRecording.confirmRecord,
          onDrumsWriteToggle: handleDrumsWriteToggle,
          selectedBar,
          selectedClipId,
        })}
        {chillTutorialActive ? (
          <ChillTutorialOverlay
            alreadyApplied={chillTutorialSession.completedStepIds?.includes(chillTutorialStep.id)}
            onBack={handleChillTutorialBack}
            onExit={handleChillTutorialExit}
            onPause={handleChillTutorialPause}
            onPrimary={handleChillTutorialPrimary}
            runState={chillTutorialSession.runState}
            step={chillTutorialStep}
            stepCount={CHILL_TUTORIAL_STEPS.length}
            stepIndex={chillTutorialSession.stepIndex}
          />
        ) : null}
      </div>
    </div>
    {performanceVisited ? createElement(PerformanceMode, {
      key: genreId,
      active: performanceActive,
      genreId,
      initialBpm: bpm,
      onBack: () => {
        setPerformanceActive(false);
        window.requestAnimationFrame(() => document.querySelector('.performance-entry')?.focus());
      },
    }) : null}
    </>
  );
}
