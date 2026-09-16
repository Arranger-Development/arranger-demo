import { getMatrixBars, getTotalBars } from '../domain/projectLength.js';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { isMelodyNoteInScale } from '../data/melodyScales.js';
import { STEPS_PER_BAR, TOTAL_BARS } from '../domain/musicConstants.js';
import { APP_COMMAND_TYPES } from '../input/appCommands.js';
import { isMelodyInputAreaVisible } from '../input/melodyInputLayout.js';
import useMusicStore from '../store/useMusicStore.js';
import {
  clearMelodyBar,
  normalizeMelodyDurationSteps,
  replaceMelodyBarWithSequence,
  setMelodyCell,
  setMelodyCellDuration,
} from './melodyActions.js';
import { getMelodyRhythmTemplate } from './melodyRhythmTemplates.js';

const MELODY_RECORDING_PHASES = Object.freeze({
  COUNT_IN: 'count-in',
  CONFIRM: 'confirm',
  IDLE: 'idle',
  OVERVIEW: 'overview',
  RECORDING: 'recording',
  SEQUENCE_CAPTURE: 'sequence-capture',
  STEP_EDIT: 'step-edit',
});

const MELODY_RECORDING_MODES = Object.freeze({
  FREE: 'free',
  TEMPLATE: 'template',
});

const IDLE_MELODY_RECORDING_STATE = Object.freeze({
  barRecordedNotes: 0,
  completedBars: Object.freeze([]),
  countInBeat: null,
  currentBar: null,
  endBar: null,
  mode: null,
  phase: MELODY_RECORDING_PHASES.IDLE,
  recordedNotes: 0,
  selectedStep: null,
  sequenceNotes: Object.freeze([]),
  startBar: null,
  templateId: null,
  totalBars: 0,
  totalNotes: 0,
});

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function hasMelodyBarNotes(matrix, bar) {
  return matrix?.melody?.[bar]?.some((cell) => cell?.type === 'melody') ?? false;
}

function getMelodyWriteBarRange(startBar, endBar = TOTAL_BARS - 1, totalBars = TOTAL_BARS) {
  if (
    !Number.isInteger(startBar)
    || !Number.isInteger(endBar)
    || startBar < 0
    || endBar >= totalBars
    || startBar > endBar
  ) {
    return [];
  }

  return Array.from({ length: endBar - startBar + 1 }, (_, offset) => startBar + offset);
}

function hasMelodyNotesInRange(matrix, startBar, endBar = getMatrixBars(matrix) - 1) {
  return getMelodyWriteBarRange(startBar, endBar, getMatrixBars(matrix))
    .some((bar) => hasMelodyBarNotes(matrix, bar));
}

function getMelodyRecordingMode(templateId) {
  return getMelodyRhythmTemplate(templateId)
    ? MELODY_RECORDING_MODES.TEMPLATE
    : MELODY_RECORDING_MODES.FREE;
}

function createTemplateRecordingState(templateId, phase, overrides = {}) {
  const template = getMelodyRhythmTemplate(templateId);
  if (!template) return { ...IDLE_MELODY_RECORDING_STATE };
  const totalBars = Number.isInteger(overrides.totalBars) && overrides.totalBars > 0
    ? overrides.totalBars
    : 1;

  return {
    barRecordedNotes: 0,
    completedBars: [],
    countInBeat: null,
    currentBar: null,
    endBar: null,
    mode: MELODY_RECORDING_MODES.TEMPLATE,
    phase,
    recordedNotes: 0,
    selectedStep: null,
    sequenceNotes: [],
    startBar: null,
    templateId: template.id,
    totalBars,
    totalNotes: template.steps.length * totalBars,
    ...overrides,
  };
}

function getMelodyRecordingRestState({
  activeTrackId,
  activeTrackType,
  melodyRhythmTemplateId,
  selectedClip,
  totalBars = TOTAL_BARS,
} = {}) {
  const melodyActive = activeTrackType === 'melody' || activeTrackId === 'melody';
  const templateId = melodyActive && selectedClip?.trackId === activeTrackId
    ? melodyRhythmTemplateId
    : null;
  const startBar = selectedClip?.bar;
  const targetBars = getMelodyWriteBarRange(startBar, totalBars - 1, totalBars);
  return getMelodyRhythmTemplate(templateId)
    ? createTemplateRecordingState(templateId, MELODY_RECORDING_PHASES.OVERVIEW, {
      currentBar: startBar,
      endBar: targetBars.at(-1) ?? null,
      startBar,
      totalBars: targetBars.length,
    })
    : { ...IDLE_MELODY_RECORDING_STATE };
}

function getRecordedMelodyDurationSteps({
  bpm,
  endedAt,
  maxDurationSteps = STEPS_PER_BAR,
  startedAt,
}) {
  const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  const sixteenthMilliseconds = 60000 / normalizedBpm / 4;
  const elapsedMilliseconds = Math.max(0, endedAt - startedAt);
  return normalizeMelodyDurationSteps(
    elapsedMilliseconds / sixteenthMilliseconds,
    maxDurationSteps,
  );
}

function recordTemplateMelodyNote(matrix, bar, templateId, cursor, note) {
  const template = getMelodyRhythmTemplate(templateId);
  const step = template?.steps?.[cursor];
  if (!Number.isInteger(step)) {
    return {
      complete: Boolean(template && cursor >= template.steps.length),
      cursor,
      matrix,
      recorded: false,
      step: null,
    };
  }

  const nextMatrix = setMelodyCell(matrix, bar, step, note, 1);
  const nextCursor = nextMatrix === matrix ? cursor : cursor + 1;
  return {
    complete: nextCursor >= template.steps.length,
    cursor: nextCursor,
    matrix: nextMatrix,
    recorded: nextMatrix !== matrix,
    step,
  };
}

function appendMelodySequenceNote(sequenceNotes, note, totalNotes) {
  const currentNotes = Array.isArray(sequenceNotes) ? sequenceNotes : [];
  if (
    typeof note !== 'string'
    || !Number.isInteger(totalNotes)
    || totalNotes <= 0
    || currentNotes.length >= totalNotes
  ) {
    return { accepted: false, complete: false, sequenceNotes: currentNotes };
  }

  const nextNotes = [...currentNotes, note];
  return {
    accepted: true,
    complete: nextNotes.length === totalNotes,
    sequenceNotes: nextNotes,
  };
}

function captureMelodySequenceNote(session, note) {
  if (
    !session
    || session.completed
    || !Array.isArray(session.templateSteps)
  ) {
    return { accepted: false, complete: false, sequenceNotes: session?.sequenceNotes ?? [] };
  }

  const appendResult = appendMelodySequenceNote(
    session.sequenceNotes,
    note,
    session.templateSteps.length,
  );
  if (!appendResult.accepted) return appendResult;

  session.sequenceNotes = appendResult.sequenceNotes;
  session.completed = appendResult.complete;
  return appendResult;
}

function normalizeMelodyNoteOnInput(input) {
  if (typeof input === 'string') {
    return { inputId: `legacy:${input}`, note: input, source: 'legacy' };
  }
  return input ?? {};
}

function normalizeMelodyNoteOffInput(input) {
  if (typeof input === 'string') {
    return { inputId: `legacy:${input}`, note: input };
  }
  return input ?? {};
}

function resolveFreeMelodyRecordingPosition(session, position) {
  if (
    session?.mode !== MELODY_RECORDING_MODES.FREE
    || !Number.isInteger(position?.bar)
    || !Number.isInteger(position?.step)
    || position.step < 0
    || position.step >= STEPS_PER_BAR
    || !session.targetBars.includes(position.bar)
    || !session.preparedBars.has(position.bar)
  ) {
    return null;
  }

  return { bar: position.bar, step: position.step };
}

function registerActiveMelodyInput(activeInputMap, inputId, note) {
  if (!(activeInputMap instanceof Map) || activeInputMap.has(inputId)) {
    return { accepted: false, firstSourceForNote: false };
  }
  const firstSourceForNote = ![...activeInputMap.values()].includes(note);
  activeInputMap.set(inputId, note);
  return { accepted: true, firstSourceForNote };
}

function releaseActiveMelodyInput(activeInputMap, inputId) {
  if (!(activeInputMap instanceof Map) || !activeInputMap.has(inputId)) {
    return { accepted: false, note: null, noteStillActive: false };
  }
  const note = activeInputMap.get(inputId);
  activeInputMap.delete(inputId);
  return {
    accepted: true,
    note,
    noteStillActive: [...activeInputMap.values()].includes(note),
  };
}

function useMelodyRecordingController({
  activeTrackId,
  activeTrackType,
  audioEngine,
  bpm,
  dispatchAppCommand,
  melodyRhythmTemplateId,
  melodyScaleId,
  selectedClip,
  withUndoCheckpoint,
}) {
  const [recordingState, setRecordingState] = useState(IDLE_MELODY_RECORDING_STATE);
  const [activeInputNotes, setActiveInputNotes] = useState(() => new Set());
  const activeFreeNoteRef = useRef(null);
  const activeInputMapRef = useRef(new Map());
  const countInTimerRef = useRef(null);
  const generationRef = useRef(0);
  const pendingSessionRef = useRef(null);
  const recordingStateRef = useRef(recordingState);
  const sessionRef = useRef(null);
  const contextKeyRef = useRef(`${activeTrackId}:${selectedClip?.id ?? ''}`);
  const scaleIdRef = useRef(melodyScaleId);

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
    if (countInTimerRef.current !== null) {
      window.clearTimeout(countInTimerRef.current);
      countInTimerRef.current = null;
    }
  }, []);

  const writeMelodyMatrix = useCallback((nextMatrix, trackId = null) => {
    const targetTrackId = trackId ?? sessionRef.current?.trackId ?? activeTrackId;
    useMusicStore.getState().setTrackMatrix(targetTrackId, nextMatrix.melody);
  }, [activeTrackId]);

  const syncActiveInputNotes = useCallback(() => {
    setActiveInputNotes(new Set(activeInputMapRef.current.values()));
  }, []);

  const clearActiveNotes = useCallback(() => {
    activeInputMapRef.current.clear();
    setActiveInputNotes(new Set());
  }, []);

  const stopActiveNotes = useCallback(() => {
    clearActiveNotes();
    if (typeof audioEngine.stopMelodyVoices === 'function') {
      audioEngine.stopMelodyVoices();
      return;
    }
    audioEngine.releaseAllMelodyInputNotes?.();
  }, [audioEngine, clearActiveNotes]);

  const finalizeActiveNote = useCallback(({
    endedAt = nowMilliseconds(),
    maxDurationSteps,
  } = {}) => {
    const activeNote = activeFreeNoteRef.current;
    const session = sessionRef.current;
    if (!activeNote || session?.mode !== MELODY_RECORDING_MODES.FREE) return false;

    const durationSteps = getRecordedMelodyDurationSteps({
      bpm: session.bpm,
      endedAt,
      maxDurationSteps: maxDurationSteps
        ?? STEPS_PER_BAR - activeNote.startStep,
      startedAt: activeNote.startedAt,
    });
    const state = useMusicStore.getState();
    const nextMatrix = setMelodyCellDuration(
      { ...state.matrix, melody: state.matrix[session.trackId] },
      activeNote.bar,
      activeNote.startStep,
      durationSteps,
    );
    writeMelodyMatrix(nextMatrix, session.trackId);
    activeFreeNoteRef.current = null;
    return true;
  }, [writeMelodyMatrix]);

  const getCurrentRestState = useCallback(() => {
    const state = useMusicStore.getState();
    return getMelodyRecordingRestState({
      totalBars: getTotalBars(state),
      activeTrackId: state.activeTrackId,
      activeTrackType,
      melodyRhythmTemplateId,
      selectedClip: state.clips.byId[state.selectedClipId],
    });
  }, [activeTrackType, melodyRhythmTemplateId]);

  const pauseTransport = useCallback(async () => {
    if (!useMusicStore.getState().isPlaying) return;
    await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY });
  }, [dispatchAppCommand]);

  const stopTransportPlayback = useCallback(async () => {
    await dispatchAppCommand({ type: APP_COMMAND_TYPES.TRANSPORT_STOP });
  }, [dispatchAppCommand]);

  const stopRecording = useCallback(({
    stopTransport = true,
  } = {}) => {
    const currentPhase = recordingStateRef.current.phase;
    const session = sessionRef.current;
    if (
      currentPhase === MELODY_RECORDING_PHASES.IDLE
      && !session
      && !pendingSessionRef.current
    ) {
      return false;
    }

    generationRef.current += 1;
    clearTimers();
    if (session?.mode === MELODY_RECORDING_MODES.FREE) finalizeActiveNote();
    audioEngine.setPlaybackCompleteHandler?.(null);
    if (
      stopTransport
      && [
        MELODY_RECORDING_PHASES.COUNT_IN,
        MELODY_RECORDING_PHASES.RECORDING,
      ].includes(currentPhase)
    ) {
      void stopTransportPlayback();
    }
    activeFreeNoteRef.current = null;
    pendingSessionRef.current = null;
    sessionRef.current = null;
    clearActiveNotes();
    if (session?.mode === MELODY_RECORDING_MODES.TEMPLATE) {
      const state = useMusicStore.getState();
      const startClip = state.getClipForTrackBar(session.trackId, session.startBar);
      if (startClip && state.selectedClipId !== startClip.id) state.selectClip(startClip.id);
    }
    updateRecordingState(session?.mode === MELODY_RECORDING_MODES.TEMPLATE
      ? createTemplateRecordingState(
        session.templateId,
        MELODY_RECORDING_PHASES.OVERVIEW,
        {
          currentBar: session.startBar,
          endBar: session.endBar,
          startBar: session.startBar,
          totalBars: session.targetBars.length,
        },
      )
      : getCurrentRestState());
    return true;
  }, [
    audioEngine,
    clearActiveNotes,
    clearTimers,
    finalizeActiveNote,
    getCurrentRestState,
    stopTransportPlayback,
    updateRecordingState,
  ]);

  const initializeWriteSession = useCallback((pendingSession) => {
    withUndoCheckpoint(() => {
      const state = useMusicStore.getState();
      state.ensureMelodyClipsInRange(
        pendingSession.startBar,
        pendingSession.endBar,
        pendingSession.trackId,
      );
    }, { force: true });
  }, [withUndoCheckpoint]);

  const prepareFreeRecordingBar = useCallback((session, bar) => {
    if (!session || session.preparedBars.has(bar)) return false;
    const state = useMusicStore.getState();
    const nextMatrix = clearMelodyBar(
      { ...state.matrix, melody: state.matrix[session.trackId] },
      bar,
    );
    state.setTrackMatrix(session.trackId, nextMatrix.melody);
    session.preparedBars.add(bar);
    return true;
  }, []);

  const beginTemplateSequenceCapture = useCallback((pendingSession) => {
    const template = getMelodyRhythmTemplate(pendingSession.templateId);
    if (!template) return;

    generationRef.current += 1;
    clearTimers();
    clearActiveNotes();
    initializeWriteSession(pendingSession);
    sessionRef.current = {
      bpm: pendingSession.bpm,
      completed: false,
      completedBars: [],
      currentBar: pendingSession.startBar,
      endBar: pendingSession.endBar,
      mode: MELODY_RECORDING_MODES.TEMPLATE,
      sequenceNotes: [],
      startBar: pendingSession.startBar,
      targetBars: [...pendingSession.targetBars],
      templateId: template.id,
      templateSteps: [...template.steps],
      trackId: pendingSession.trackId,
    };
    updateRecordingState(createTemplateRecordingState(
      template.id,
      MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      {
        currentBar: pendingSession.startBar,
        endBar: pendingSession.endBar,
        startBar: pendingSession.startBar,
        totalBars: pendingSession.targetBars.length,
      },
    ));
    void dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: pendingSession.startBar,
      step: 0,
    });
  }, [
    clearActiveNotes,
    clearTimers,
    dispatchAppCommand,
    initializeWriteSession,
    updateRecordingState,
  ]);

  const beginFreeRecording = useCallback(async (pendingSession, generation) => {
    if (generationRef.current !== generation) return;
    initializeWriteSession(pendingSession);
    await dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: pendingSession.startBar,
      step: 0,
    });
    if (generationRef.current !== generation) return;

    const session = {
      bpm: pendingSession.bpm,
      completedBars: [],
      currentBar: pendingSession.startBar,
      endBar: pendingSession.endBar,
      mode: MELODY_RECORDING_MODES.FREE,
      preparedBars: new Set(),
      startBar: pendingSession.startBar,
      startedAt: nowMilliseconds(),
      targetBars: [...pendingSession.targetBars],
      trackId: pendingSession.trackId,
    };
    sessionRef.current = session;
    prepareFreeRecordingBar(session, pendingSession.startBar);
    updateRecordingState({
      ...IDLE_MELODY_RECORDING_STATE,
      currentBar: pendingSession.startBar,
      endBar: pendingSession.endBar,
      mode: MELODY_RECORDING_MODES.FREE,
      phase: MELODY_RECORDING_PHASES.RECORDING,
      startBar: pendingSession.startBar,
      totalBars: pendingSession.targetBars.length,
    });
    const onPlaybackComplete = () => {
      queueMicrotask(() => {
        if (generationRef.current !== generation) return;
        stopRecording();
      });
    };
    audioEngine.setPlaybackCompleteHandler?.(onPlaybackComplete);
    await dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
      audibleTrackIds: [pendingSession.trackId],
      maxPlaybackSteps: pendingSession.targetBars.length * STEPS_PER_BAR,
    });
    if (generationRef.current !== generation) void stopTransportPlayback();
  }, [
    audioEngine,
    dispatchAppCommand,
    initializeWriteSession,
    prepareFreeRecordingBar,
    stopRecording,
    stopTransportPlayback,
    updateRecordingState,
  ]);

  const beginCountIn = useCallback(async (pendingSession) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    await pauseTransport();
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
        void beginFreeRecording(pendingSession, generation);
        return;
      }

      updateRecordingState({
        ...IDLE_MELODY_RECORDING_STATE,
        countInBeat: beat,
        currentBar: pendingSession.startBar,
        endBar: pendingSession.endBar,
        mode: MELODY_RECORDING_MODES.FREE,
        phase: MELODY_RECORDING_PHASES.COUNT_IN,
        startBar: pendingSession.startBar,
        totalBars: pendingSession.targetBars.length,
      });
      void audioEngine.triggerDrumsStep(beat === 4 ? ['kick', 'hihat'] : 'hihat');
      countInTimerRef.current = window.setTimeout(() => tick(beat - 1), beatDurationMilliseconds);
    };

    tick(4);
  }, [audioEngine, beginFreeRecording, dispatchAppCommand, pauseTransport, updateRecordingState]);

  const startPendingSession = useCallback(() => {
    const pendingSession = pendingSessionRef.current;
    if (!pendingSession) return;
    pendingSessionRef.current = null;
    if (pendingSession.mode === MELODY_RECORDING_MODES.TEMPLATE) {
      beginTemplateSequenceCapture(pendingSession);
      return;
    }
    void beginCountIn(pendingSession);
  }, [beginCountIn, beginTemplateSequenceCapture]);

  const setTemplateOverview = useCallback((templateIdOverride = null) => {
    const state = useMusicStore.getState();
    const clip = state.clips.byId[state.selectedClipId];
    const session = sessionRef.current;
    const currentRecordingState = recordingStateRef.current;
    const template = getMelodyRhythmTemplate(
      templateIdOverride
      ?? session?.templateId
      ?? currentRecordingState.templateId
      ?? (activeTrackType === 'melody' && clip?.trackId === state.activeTrackId
        ? state.melodyRhythmTemplateId
        : null),
    );
    if (!template) return false;
    const startBar = session?.startBar ?? currentRecordingState.startBar ?? clip?.bar;
    const targetBars = getMelodyWriteBarRange(
      startBar,
      session?.endBar ?? currentRecordingState.endBar ?? getTotalBars(state) - 1,
      getTotalBars(state),
    );

    generationRef.current += 1;
    clearTimers();
    pendingSessionRef.current = null;
    sessionRef.current = null;
    clearActiveNotes();
    const targetTrackId = session?.trackId
      ?? pendingSessionRef.current?.trackId
      ?? state.activeTrackId;
    const overviewClip = state.getClipForTrackBar(targetTrackId, startBar);
    if (overviewClip && state.selectedClipId !== overviewClip.id) state.selectClip(overviewClip.id);
    updateRecordingState(createTemplateRecordingState(
      template.id,
      MELODY_RECORDING_PHASES.OVERVIEW,
      {
        currentBar: startBar,
        endBar: targetBars.at(-1) ?? null,
        startBar,
        totalBars: targetBars.length,
      },
    ));
    void dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: startBar,
      step: 0,
    });
    return true;
  }, [
    activeTrackType,
    clearActiveNotes,
    clearTimers,
    dispatchAppCommand,
    updateRecordingState,
  ]);

  const requestWriteToggle = useCallback(() => {
    const currentPhase = recordingStateRef.current.phase;
    if (currentPhase === MELODY_RECORDING_PHASES.CONFIRM) {
      startPendingSession();
      return;
    }
    if (currentPhase === MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE) {
      setTemplateOverview(sessionRef.current?.templateId);
      return;
    }
    if (
      currentPhase === MELODY_RECORDING_PHASES.COUNT_IN
      || currentPhase === MELODY_RECORDING_PHASES.RECORDING
    ) {
      stopRecording();
      return;
    }

    const state = useMusicStore.getState();
    const clip = state.clips.byId[state.selectedClipId];
    if (activeTrackType !== 'melody' || clip?.trackId !== state.activeTrackId) return;
    const templateId = state.melodyRhythmTemplateId ?? null;
    const targetBars = getMelodyWriteBarRange(clip.bar, getTotalBars(state) - 1, getTotalBars(state));
    const pendingSession = {
      bpm: Number.isFinite(state.bpm) && state.bpm > 0 ? state.bpm : bpm,
      endBar: targetBars.at(-1),
      mode: getMelodyRecordingMode(templateId),
      startBar: clip.bar,
      targetBars,
      templateId,
      trackId: state.activeTrackId,
    };
    clearActiveNotes();

    if (
      pendingSession.mode === MELODY_RECORDING_MODES.TEMPLATE
      && [
        MELODY_RECORDING_PHASES.OVERVIEW,
        MELODY_RECORDING_PHASES.STEP_EDIT,
      ].includes(currentPhase)
    ) {
      pendingSessionRef.current = pendingSession;
      const scopedMatrix = { ...state.matrix, melody: state.matrix[pendingSession.trackId] };
      if (hasMelodyNotesInRange(
        scopedMatrix,
        pendingSession.startBar,
        pendingSession.endBar,
      )) {
        updateRecordingState(createTemplateRecordingState(
          templateId,
          MELODY_RECORDING_PHASES.CONFIRM,
          {
            currentBar: pendingSession.startBar,
            endBar: pendingSession.endBar,
            startBar: pendingSession.startBar,
            totalBars: pendingSession.targetBars.length,
          },
        ));
        return;
      }
      startPendingSession();
      return;
    }

    if (currentPhase !== MELODY_RECORDING_PHASES.IDLE) return;
    pendingSessionRef.current = pendingSession;
    const scopedMatrix = { ...state.matrix, melody: state.matrix[pendingSession.trackId] };
    if (hasMelodyNotesInRange(
      scopedMatrix,
      pendingSession.startBar,
      pendingSession.endBar,
    )) {
      updateRecordingState({
        ...IDLE_MELODY_RECORDING_STATE,
        currentBar: pendingSession.startBar,
        endBar: pendingSession.endBar,
        mode: pendingSession.mode,
        phase: MELODY_RECORDING_PHASES.CONFIRM,
        startBar: pendingSession.startBar,
        totalBars: pendingSession.targetBars.length,
      });
      return;
    }
    startPendingSession();
  }, [
    bpm,
    clearActiveNotes,
    setTemplateOverview,
    startPendingSession,
    stopRecording,
    updateRecordingState,
    activeTrackType,
  ]);

  const confirmRecord = useCallback(() => {
    if (recordingStateRef.current.phase !== MELODY_RECORDING_PHASES.CONFIRM) return;
    startPendingSession();
  }, [startPendingSession]);

  const cancelRecord = useCallback(() => {
    if (recordingStateRef.current.phase !== MELODY_RECORDING_PHASES.CONFIRM) return;
    pendingSessionRef.current = null;
    if (recordingStateRef.current.mode === MELODY_RECORDING_MODES.TEMPLATE) {
      setTemplateOverview(recordingStateRef.current.templateId);
      return;
    }
    updateRecordingState({ ...IDLE_MELODY_RECORDING_STATE });
  }, [setTemplateOverview, updateRecordingState]);

  const selectTemplateStep = useCallback((bar, step) => {
    const state = useMusicStore.getState();
    const clip = state.clips.byId[state.selectedClipId];
    const template = getMelodyRhythmTemplate(state.melodyRhythmTemplateId);
    const currentPhase = recordingStateRef.current.phase;
    if (
      activeTrackType !== 'melody'
      || clip?.trackId !== state.activeTrackId
      || clip.bar !== bar
      || !template?.steps.includes(step)
      || [
        MELODY_RECORDING_PHASES.CONFIRM,
        MELODY_RECORDING_PHASES.COUNT_IN,
        MELODY_RECORDING_PHASES.RECORDING,
        MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      ].includes(currentPhase)
    ) {
      return false;
    }

    clearActiveNotes();
    if (
      currentPhase === MELODY_RECORDING_PHASES.STEP_EDIT
      && recordingStateRef.current.selectedStep === step
    ) {
      updateRecordingState(createTemplateRecordingState(
        template.id,
        MELODY_RECORDING_PHASES.OVERVIEW,
      ));
      return true;
    }

    updateRecordingState(createTemplateRecordingState(
      template.id,
      MELODY_RECORDING_PHASES.STEP_EDIT,
      { selectedStep: step },
    ));
    return true;
  }, [activeTrackType, clearActiveNotes, updateRecordingState]);

  const commitTemplateSequence = useCallback((session, sequenceNotes) => {
    const state = useMusicStore.getState();
    const completedBar = session.currentBar;
    const nextMatrix = replaceMelodyBarWithSequence(
      { ...state.matrix, melody: state.matrix[session.trackId] },
      completedBar,
      session.templateSteps,
      sequenceNotes,
    );
    state.setTrackMatrix(session.trackId, nextMatrix.melody);
    session.completedBars.push(completedBar);
    clearActiveNotes();

    if (completedBar >= session.endBar) {
      setTemplateOverview(session.templateId);
      return;
    }

    const nextBar = completedBar + 1;
    session.completed = false;
    session.currentBar = nextBar;
    session.sequenceNotes = [];
    const nextClip = state.getClipForTrackBar(session.trackId, nextBar);
    if (nextClip) state.selectClip(nextClip.id);
    const recordedNotes = session.completedBars.length * session.templateSteps.length;
    updateRecordingState(createTemplateRecordingState(
      session.templateId,
      MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      {
        completedBars: [...session.completedBars],
        currentBar: nextBar,
        endBar: session.endBar,
        recordedNotes,
        startBar: session.startBar,
        totalBars: session.targetBars.length,
      },
    ));
    void dispatchAppCommand({
      type: APP_COMMAND_TYPES.TRANSPORT_SEEK,
      bar: nextBar,
      step: 0,
    });
  }, [clearActiveNotes, dispatchAppCommand, setTemplateOverview, updateRecordingState]);

  const handleNoteOn = useCallback((input) => {
    const {
      inputId,
      inputTimestampMs,
      note,
      source,
    } = normalizeMelodyNoteOnInput(input);
    if (typeof inputId !== 'string' || !inputId || typeof note !== 'string') {
      return { recorded: false };
    }

    const current = recordingStateRef.current;
    const state = useMusicStore.getState();
    const clip = state.clips.byId[state.selectedClipId];
    const hasTemplate = Boolean(getMelodyRhythmTemplate(
      current.templateId
      ?? (activeTrackType === 'melody' && clip?.trackId === state.activeTrackId
        ? state.melodyRhythmTemplateId
        : null),
    ));
    if (
      activeTrackType !== 'melody'
      || clip?.trackId !== state.activeTrackId
      || !isMelodyInputAreaVisible({ hasTemplate, phase: current.phase })
      || !isMelodyNoteInScale(melodyScaleId, note)
    ) {
      return { recorded: false };
    }

    const activeInputMap = activeInputMapRef.current;
    const registration = registerActiveMelodyInput(activeInputMap, inputId, note);
    if (!registration.accepted) return { recorded: false };
    syncActiveInputNotes();
    if (!registration.firstSourceForNote) return { recorded: false };

    void audioEngine.triggerMelodyInputOneShot(note, undefined, {
      trackId: state.activeTrackId,
    });

    if (current.phase === MELODY_RECORDING_PHASES.STEP_EDIT) {
      const template = getMelodyRhythmTemplate(state.melodyRhythmTemplateId);
      if (
        clip?.trackId !== state.activeTrackId
        || !Number.isInteger(current.selectedStep)
        || !template?.steps.includes(current.selectedStep)
      ) {
        return { recorded: false };
      }

      withUndoCheckpoint(() => {
        const latestState = useMusicStore.getState();
        const nextMatrix = setMelodyCell(
          { ...latestState.matrix, melody: latestState.matrix[clip.trackId] },
          clip.bar,
          current.selectedStep,
          note,
          1,
        );
        latestState.setTrackMatrix(clip.trackId, nextMatrix.melody);
      });
      clearActiveNotes();
      updateRecordingState(createTemplateRecordingState(
        template.id,
        MELODY_RECORDING_PHASES.OVERVIEW,
      ));
      return { recorded: true, step: current.selectedStep };
    }

    if (
      current.phase === MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE
      && sessionRef.current?.mode === MELODY_RECORDING_MODES.TEMPLATE
    ) {
      const session = sessionRef.current;
      const appendResult = captureMelodySequenceNote(session, note);
      if (!appendResult.accepted) return { recorded: false };
      const { sequenceNotes } = appendResult;
      const barRecordedNotes = sequenceNotes.length;
      const recordedNotes = session.completedBars.length * session.templateSteps.length
        + barRecordedNotes;
      updateRecordingState((state) => ({
        ...state,
        barRecordedNotes,
        recordedNotes,
        sequenceNotes: [...sequenceNotes],
      }));
      if (appendResult.complete) {
        commitTemplateSequence(session, sequenceNotes);
      }
      return {
        recorded: true,
        step: session.templateSteps[barRecordedNotes - 1],
      };
    }

    const session = sessionRef.current;
    if (
      current.phase !== MELODY_RECORDING_PHASES.RECORDING
      || session?.mode !== MELODY_RECORDING_MODES.FREE
    ) {
      return { recorded: false };
    }

    const position = resolveFreeMelodyRecordingPosition(
      session,
      audioEngine.getLiveInputPosition?.(inputTimestampMs, { source }),
    );
    if (!position) return { recorded: false };
    const { bar, step } = position;
    if (activeFreeNoteRef.current) {
      const previousNote = activeFreeNoteRef.current;
      const availableDuration = previousNote.bar === bar
        ? step - previousNote.startStep
        : STEPS_PER_BAR - previousNote.startStep;
      finalizeActiveNote({
        maxDurationSteps: Math.max(1, availableDuration),
      });
    }
    const currentState = useMusicStore.getState();
    const nextMatrix = setMelodyCell(
      { ...currentState.matrix, melody: currentState.matrix[session.trackId] },
      bar,
      step,
      note,
      1,
    );
    writeMelodyMatrix(nextMatrix, session.trackId);
    activeFreeNoteRef.current = {
      bar,
      note,
      startedAt: nowMilliseconds(),
      startStep: step,
    };
    updateRecordingState((stateValue) => ({
      ...stateValue,
      recordedNotes: stateValue.recordedNotes + 1,
    }));
    return { recorded: true, step };
  }, [
    activeTrackType,
    audioEngine,
    clearActiveNotes,
    commitTemplateSequence,
    finalizeActiveNote,
    melodyScaleId,
    syncActiveInputNotes,
    updateRecordingState,
    withUndoCheckpoint,
    writeMelodyMatrix,
  ]);

  const handleNoteOff = useCallback((input) => {
    const { inputId, note: fallbackNote } = normalizeMelodyNoteOffInput(input);
    if (typeof inputId !== 'string' || !inputId) return { recorded: false };
    const release = releaseActiveMelodyInput(activeInputMapRef.current, inputId);
    const note = release.note ?? fallbackNote;
    if (!release.accepted || !note) return { recorded: false };
    syncActiveInputNotes();
    if (release.noteStillActive) return { recorded: false };
    const activeNote = activeFreeNoteRef.current;
    if (!activeNote || activeNote.note !== note) return { recorded: false };
    finalizeActiveNote();
    return { recorded: true, step: activeNote.startStep };
  }, [finalizeActiveNote, syncActiveInputNotes]);

  const handleTransportPosition = useCallback((bar, step) => {
    const session = sessionRef.current;
    if (
      recordingStateRef.current.phase !== MELODY_RECORDING_PHASES.RECORDING
      || session?.mode !== MELODY_RECORDING_MODES.FREE
      || step !== 0
      || !session.targetBars.includes(bar)
    ) {
      return false;
    }

    if (bar !== session.currentBar) {
      if (activeFreeNoteRef.current) {
        finalizeActiveNote({
          maxDurationSteps: STEPS_PER_BAR - activeFreeNoteRef.current.startStep,
        });
      }
      if (!session.completedBars.includes(session.currentBar)) {
        session.completedBars.push(session.currentBar);
      }
      session.currentBar = bar;
    }

    prepareFreeRecordingBar(session, bar);
    const state = useMusicStore.getState();
    const clip = state.getClipForTrackBar(session.trackId, bar);
    if (clip && state.selectedClipId !== clip.id) state.selectClip(clip.id);
    updateRecordingState((current) => ({
      ...current,
      completedBars: [...session.completedBars],
      currentBar: bar,
    }));
    return true;
  }, [finalizeActiveNote, prepareFreeRecordingBar, updateRecordingState]);

  useEffect(() => {
    const contextKey = `${activeTrackId}:${selectedClip?.id ?? ''}`;
    if (contextKeyRef.current === contextKey) return;
    contextKeyRef.current = contextKey;
    const session = sessionRef.current;
    if (
      session
      && activeTrackType === 'melody'
      && selectedClip?.trackId === activeTrackId
      && session.trackId === activeTrackId
      && session.targetBars.includes(selectedClip.bar)
      && [
        MELODY_RECORDING_PHASES.RECORDING,
        MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
      ].includes(recordingStateRef.current.phase)
    ) {
      return;
    }
    stopRecording();
  }, [activeTrackId, activeTrackType, selectedClip, stopRecording]);

  useEffect(() => {
    if (scaleIdRef.current === melodyScaleId) return;
    scaleIdRef.current = melodyScaleId;
    clearActiveNotes();
  }, [clearActiveNotes, melodyScaleId]);

  useEffect(() => {
    const handleWindowBlur = () => clearActiveNotes();
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [clearActiveNotes]);

  useEffect(() => () => {
    generationRef.current += 1;
    clearTimers();
    audioEngine.setPlaybackCompleteHandler?.(null);
    stopActiveNotes();
  }, [audioEngine, clearTimers, stopActiveNotes]);

  return {
    activeInputNotes,
    cancelRecord,
    confirmRecord,
    handleNoteOff,
    handleNoteOn,
    handleTransportPosition,
    recordingState,
    clearActiveNotes,
    requestWriteToggle,
    selectTemplateStep,
    stopRecording,
    workflowLocked: recordingState.phase !== MELODY_RECORDING_PHASES.IDLE,
  };
}

export {
  appendMelodySequenceNote,
  captureMelodySequenceNote,
  createTemplateRecordingState,
  getMelodyRecordingMode,
  getMelodyRecordingRestState,
  getRecordedMelodyDurationSteps,
  getMelodyWriteBarRange,
  hasMelodyBarNotes,
  hasMelodyNotesInRange,
  IDLE_MELODY_RECORDING_STATE,
  MELODY_RECORDING_MODES,
  MELODY_RECORDING_PHASES,
  recordTemplateMelodyNote,
  registerActiveMelodyInput,
  releaseActiveMelodyInput,
  resolveFreeMelodyRecordingPosition,
  useMelodyRecordingController,
};
