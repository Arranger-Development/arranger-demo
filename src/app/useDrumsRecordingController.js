import { getTotalBars } from '../domain/projectLength.js';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { APP_COMMAND_TYPES } from '../input/appCommands.js';
import useMusicStore from '../store/useMusicStore.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import {
  clearDrumsBar,
} from './drumsPatternActions.js';
import {
  createDrumsLiveRecordPatch,
  createDrumsLiveRecordSession,
  createDrumsRecordingState,
  DRUMS_RECORDING_PHASES,
  getDrumsRecordingContextTrackId,
  getDrumsWriteBarRange,
  hasDrumsBarHits,
  hasDrumsHitsInRange,
  IDLE_DRUMS_RECORDING_STATE,
} from './drumsLiveRecording.js';

function useDrumsRecordingController({
  activeTrackId,
  activeTrackType,
  audioEngine,
  bpm,
  dispatchAppCommand,
  withUndoCheckpoint,
}) {
  const [recordingState, setRecordingState] = useState(IDLE_DRUMS_RECORDING_STATE);
  const countInTimerRef = useRef(null);
  const generationRef = useRef(0);
  const pendingSessionRef = useRef(null);
  const recordingStateRef = useRef(recordingState);
  const sessionRef = useRef(null);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  const updateRecordingState = useCallback((nextStateOrUpdater) => {
    const nextState = typeof nextStateOrUpdater === 'function'
      ? nextStateOrUpdater(recordingStateRef.current)
      : nextStateOrUpdater;
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
    return nextState;
  }, []);

  const clearTimers = useCallback(() => {
    if (countInTimerRef.current === null) return;
    window.clearTimeout(countInTimerRef.current);
    countInTimerRef.current = null;
  }, []);

  const runSessionMutation = useCallback((action) => {
    const session = sessionRef.current;
    if (!session || typeof action !== 'function') return false;
    return session.mutations.record(action, withUndoCheckpoint);
  }, [withUndoCheckpoint]);

  const prepareRecordingBar = useCallback((session, bar) => {
    if (!session || session.preparedBars.has(bar)) return false;
    session.preparedBars.add(bar);

    const state = useMusicStore.getState();
    const scopedMatrix = { ...state.matrix, drums: state.matrix[session.trackId] };
    if (!hasDrumsBarHits(scopedMatrix, bar)) return false;

    return runSessionMutation(() => {
      const latestState = useMusicStore.getState();
      const nextMatrix = clearDrumsBar({
        ...latestState.matrix,
        drums: latestState.matrix[session.trackId],
      }, bar);
      latestState.setTrackMatrix(session.trackId, nextMatrix.drums);
    });
  }, [runSessionMutation]);

  const stopRecording = useCallback(({
    stopTransport = true,
  } = {}) => {
    const currentPhase = recordingStateRef.current.phase;
    if (
      currentPhase === DRUMS_RECORDING_PHASES.IDLE
      && !pendingSessionRef.current
      && !sessionRef.current
    ) {
      return false;
    }

    generationRef.current += 1;
    clearTimers();
    audioEngine.setPlaybackCompleteHandler?.(null);
    pendingSessionRef.current = null;
    sessionRef.current?.mutations.end();
    sessionRef.current = null;
    updateRecordingState({ ...IDLE_DRUMS_RECORDING_STATE });

    if (
      stopTransport
      && [
        DRUMS_RECORDING_PHASES.COUNT_IN,
        DRUMS_RECORDING_PHASES.RECORDING,
      ].includes(currentPhase)
    ) {
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }
    return true;
  }, [
    audioEngine,
    clearTimers,
    dispatchAppCommand,
    updateRecordingState,
  ]);

  const beginRecording = useCallback(async (pendingSession, generation) => {
    if (generationRef.current !== generation) return;

    await dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: pendingSession.startBar,
      step: 0,
    });
    if (generationRef.current !== generation) return;

    const session = {
      completedBars: [],
      currentBar: pendingSession.startBar,
      endBar: pendingSession.endBar,
      mutations: createDrumsLiveRecordSession(),
      preparedBars: new Set(),
      startBar: pendingSession.startBar,
      trackId: pendingSession.trackId,
      targetBars: [...pendingSession.targetBars],
    };
    sessionRef.current = session;
    pendingSessionRef.current = null;
    prepareRecordingBar(session, pendingSession.startBar);
    updateRecordingState(createDrumsRecordingState(
      DRUMS_RECORDING_PHASES.RECORDING,
      {
        currentBar: pendingSession.startBar,
        endBar: pendingSession.endBar,
        startBar: pendingSession.startBar,
        totalBars: pendingSession.targetBars.length,
      },
    ));

    audioEngine.setPlaybackCompleteHandler?.(() => {
      queueMicrotask(() => {
        if (generationRef.current !== generation) return;
        stopRecording();
      });
    });
    await dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
      maxPlaybackSteps: pendingSession.targetBars.length * STEPS_PER_BAR,
    });

    if (generationRef.current !== generation) {
      void dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }
  }, [
    audioEngine,
    dispatchAppCommand,
    prepareRecordingBar,
    stopRecording,
    updateRecordingState,
  ]);

  const beginCountIn = useCallback(async (pendingSession) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    clearTimers();

    if (useMusicStore.getState().isPlaying) {
      await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
    }
    await dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: pendingSession.startBar,
      step: 0,
    });
    if (generationRef.current !== generation) return;

    const beatDurationMilliseconds = 60000 / pendingSession.bpm;
    const tick = (beat) => {
      if (generationRef.current !== generation) return;
      if (beat === 0) {
        countInTimerRef.current = null;
        void beginRecording(pendingSession, generation);
        return;
      }

      updateRecordingState(createDrumsRecordingState(
        DRUMS_RECORDING_PHASES.COUNT_IN,
        {
          countInBeat: beat,
          currentBar: pendingSession.startBar,
          endBar: pendingSession.endBar,
          startBar: pendingSession.startBar,
          totalBars: pendingSession.targetBars.length,
        },
      ));
      void audioEngine.triggerDrumsStep(beat === 4 ? ['kick', 'hihat'] : 'hihat');
      countInTimerRef.current = window.setTimeout(
        () => tick(beat - 1),
        beatDurationMilliseconds,
      );
    };

    tick(4);
  }, [
    audioEngine,
    beginRecording,
    clearTimers,
    dispatchAppCommand,
    updateRecordingState,
  ]);

  const startPendingSession = useCallback(() => {
    const pendingSession = pendingSessionRef.current;
    if (!pendingSession) return false;
    void beginCountIn(pendingSession);
    return true;
  }, [beginCountIn]);

  const requestWriteToggle = useCallback(() => {
    const currentPhase = recordingStateRef.current.phase;
    if (
      currentPhase === DRUMS_RECORDING_PHASES.COUNT_IN
      || currentPhase === DRUMS_RECORDING_PHASES.RECORDING
    ) {
      stopRecording();
      return true;
    }
    if (currentPhase !== DRUMS_RECORDING_PHASES.IDLE) return false;

    const state = useMusicStore.getState();
    const clip = state.clips.byId[state.selectedClipId];
    if (activeTrackType !== 'drums' || clip?.trackId !== state.activeTrackId) return false;

    const targetBars = getDrumsWriteBarRange(clip.bar, getTotalBars(state) - 1, getTotalBars(state));
    const pendingSession = {
      bpm: Number.isFinite(state.bpm) && state.bpm > 0 ? state.bpm : bpm,
      endBar: targetBars.at(-1),
      startBar: clip.bar,
      targetBars,
      trackId: state.activeTrackId,
    };
    pendingSessionRef.current = pendingSession;

    const scopedMatrix = { ...state.matrix, drums: state.matrix[pendingSession.trackId] };
    if (hasDrumsHitsInRange(
      scopedMatrix,
      pendingSession.startBar,
      pendingSession.endBar,
    )) {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      clearTimers();
      void (async () => {
        if (state.isPlaying) {
          await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
        }
        await dispatchAppCommand({
          type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
          bar: pendingSession.startBar,
          step: 0,
        });
        if (generationRef.current !== generation) return;
        updateRecordingState(createDrumsRecordingState(
          DRUMS_RECORDING_PHASES.CONFIRM,
          {
            currentBar: pendingSession.startBar,
            endBar: pendingSession.endBar,
            startBar: pendingSession.startBar,
            totalBars: pendingSession.targetBars.length,
          },
        ));
      })();
      return true;
    }

    startPendingSession();
    return true;
  }, [
    bpm,
    clearTimers,
    dispatchAppCommand,
    startPendingSession,
    stopRecording,
    updateRecordingState,
    activeTrackType,
  ]);

  const confirmRecord = useCallback(() => {
    if (recordingStateRef.current.phase !== DRUMS_RECORDING_PHASES.CONFIRM) {
      return false;
    }
    return startPendingSession();
  }, [startPendingSession]);

  const cancelRecord = useCallback(() => {
    if (recordingStateRef.current.phase !== DRUMS_RECORDING_PHASES.CONFIRM) {
      return false;
    }
    generationRef.current += 1;
    clearTimers();
    pendingSessionRef.current = null;
    updateRecordingState({ ...IDLE_DRUMS_RECORDING_STATE });
    return true;
  }, [clearTimers, updateRecordingState]);

  const handlePadInput = useCallback((instrument, inputTimestampMs, inputSource) => {
    const session = sessionRef.current;
    const position = audioEngine.getLiveInputPosition?.(inputTimestampMs, {
      source: inputSource,
    });
    if (!position) return false;

    const state = useMusicStore.getState();
    const { bar, step } = position;
    if (!session?.targetBars.includes(bar)) return false;

    const patch = createDrumsLiveRecordPatch({
      totalBars: getTotalBars(state),
      activeTrackId: 'drums',
      bar,
      currentCell: state.matrix[session.trackId]?.[bar]?.[step] ?? null,
      hasClip: Boolean(state.getClipForTrackBar(session.trackId, bar)),
      instrument,
      isPlaying: state.isPlaying,
      phase: recordingStateRef.current.phase,
      step,
    });
    if (!patch) return false;

    return runSessionMutation(() => {
      const latestState = useMusicStore.getState();
      if (
        patch.shouldCreateClip
        && !latestState.getClipForTrackBar(session.trackId, patch.bar)
      ) {
        latestState.createClip(session.trackId, patch.bar);
      }
      if (patch.shouldWriteCell) {
        latestState.setCell(session.trackId, patch.bar, patch.step, patch.nextCell);
      }
    });
  }, [audioEngine, runSessionMutation]);

  const previewPadInput = useCallback((instrument, inputTimestampMs) => {
    handlePadInput(instrument, inputTimestampMs);
    void dispatchAppCommand({
      type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
      ...(Number.isFinite(inputTimestampMs) ? { inputTimestampMs } : {}),
      instrument,
      trackId: activeTrackType === 'drums' ? activeTrackId : 'drums',
    });
    return true;
  }, [
    activeTrackId,
    activeTrackType,
    dispatchAppCommand,
    handlePadInput,
  ]);

  const handleTransportPosition = useCallback((bar, step) => {
    const session = sessionRef.current;
    if (
      recordingStateRef.current.phase !== DRUMS_RECORDING_PHASES.RECORDING
      || !session?.targetBars.includes(bar)
      || step !== 0
    ) {
      return false;
    }

    if (bar !== session.currentBar) {
      if (!session.completedBars.includes(session.currentBar)) {
        session.completedBars.push(session.currentBar);
      }
      session.currentBar = bar;
    }
    prepareRecordingBar(session, bar);
    updateRecordingState((current) => ({
      ...current,
      completedBars: [...session.completedBars],
      currentBar: bar,
    }));
    return true;
  }, [prepareRecordingBar, updateRecordingState]);

  useEffect(() => {
    const recordingTrackId = getDrumsRecordingContextTrackId({
      pendingSession: pendingSessionRef.current,
      phase: recordingState.phase,
      session: sessionRef.current,
    });
    if (
      recordingState.phase !== DRUMS_RECORDING_PHASES.IDLE
      && (
        activeTrackType !== 'drums'
        || activeTrackId !== recordingTrackId
      )
    ) {
      stopRecording();
    }
  }, [activeTrackId, activeTrackType, recordingState.phase, stopRecording]);

  useEffect(() => () => {
    generationRef.current += 1;
    clearTimers();
    audioEngine.setPlaybackCompleteHandler?.(null);
  }, [audioEngine, clearTimers]);

  return {
    cancelRecord,
    confirmRecord,
    handlePadInput,
    handleTransportPosition,
    previewPadInput,
    recordingState,
    requestWriteToggle,
    stopRecording,
    workflowLocked: recordingState.phase !== DRUMS_RECORDING_PHASES.IDLE,
  };
}

export {
  useDrumsRecordingController,
};
