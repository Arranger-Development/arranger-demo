import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { APP_COMMAND_TYPES } from './appCommands.js';
import { createLaunchpadXChordGestureController } from './launchpadXChordGesture.js';
import { createLaunchpadXChordLedFrame } from './launchpadXChordSurface.js';
import { createLaunchpadXDrumsLedFrame } from './launchpadXDrumsSurface.js';
import {
  createLaunchpadXMelodyLedFrame,
} from './launchpadXMelodySurface.js';
import { mapLaunchpadXMessageToCommand } from './launchpadXMap.js';
import {
  findLaunchpadXMidiInput,
  findLaunchpadXMidiOutput,
} from './launchpadXPorts.js';
import { formatMidiMessage, parseLaunchpadXMessage } from './launchpadXProtocol.js';
import { getLaunchpadMelodyInputId } from './melodyInputLayout.js';

const MIDI_CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DENIED: 'denied',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  IDLE: 'idle',
  UNSUPPORTED: 'unsupported',
});

function supportsWebMidi() {
  return typeof navigator !== 'undefined'
    && typeof navigator.requestMIDIAccess === 'function';
}

function createInitialConnectionState() {
  return {
    deviceName: null,
    errorMessage: null,
    lastMessage: '',
    ledAvailable: false,
    ledErrorMessage: null,
    status: supportsWebMidi()
      ? MIDI_CONNECTION_STATUS.IDLE
      : MIDI_CONNECTION_STATUS.UNSUPPORTED,
  };
}

function getErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message) return error.message;
  return '无法访问 MIDI 设备';
}

function getMelodyInputContextKey({
  melodyActive,
  melodyRecordingState,
  melodyScaleId,
  selectedBar,
}) {
  const keepNotesAcrossPlaybackBars = (
    melodyRecordingState?.mode === 'free'
    && melodyRecordingState?.phase === 'recording'
  );
  return [
    melodyActive ? 'active' : 'inactive',
    melodyRecordingState?.phase ?? 'idle',
    melodyScaleId,
    keepNotesAcrossPlaybackBars ? 'free-recording' : selectedBar,
  ].join(':');
}

function detachInput(input) {
  if (!input) return;
  input.onmidimessage = null;
}

function useLaunchpadXCommands({
  activeInputNotes = null,
  chordActive = false,
  chordClipBars = [],
  chordHarmonyState = null,
  currentBar = 0,
  currentStep = 0,
  dispatch,
  drumsActive = false,
  drumsClipBars = [],
  enabled = true,
  isPlaying = false,
  matrix = null,
  melodyActive = false,
  melodyClipBars = [],
  melodyRecordingState = null,
  melodyScaleId = 'chinese',
  melodyTemplateSteps = [],
  mutedTracks = null,
  selectedBar = 0,
} = {}) {
  const accessRef = useRef(null);
  const melodyNoteByPadRef = useRef(new Map());
  const contextRef = useRef({
    activeMelodyNotes: melodyNoteByPadRef.current,
    chordActive,
    chordClipBars,
    chordHarmonyState,
    currentBar,
    currentStep,
    drumsActive,
    drumsClipBars,
    matrix,
    melodyActive,
    melodyClipBars,
    melodyRecordingState,
    melodyScaleId,
    melodyTemplateSteps,
    mutedTracks,
    selectedBar,
  });
  const dispatchRef = useRef(dispatch);
  const chordGestureRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  const outputRef = useRef(null);
  const surfaceRef = useRef({
    activeInputNotes,
    chordActive,
    chordClipBars,
    chordHarmonyState,
    currentBar,
    currentStep,
    drumsActive,
    drumsClipBars,
    isPlaying,
    matrix,
    melodyActive,
    melodyClipBars,
    melodyRecordingState,
    melodyScaleId,
    melodyTemplateSteps,
    mutedTracks,
    pressedMelodyPads: new Set(),
    selectedBar,
  });
  const [connection, setConnection] = useState(createInitialConnectionState);

  if (!chordGestureRef.current) {
    chordGestureRef.current = createLaunchpadXChordGestureController({
      dispatch: (command) => dispatchRef.current?.(command),
      getContext: () => contextRef.current,
    });
  }

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    const pressedMelodyPads = melodyActive
      ? surfaceRef.current.pressedMelodyPads
      : new Set();
    contextRef.current = {
      activeMelodyNotes: melodyNoteByPadRef.current,
      chordActive,
      chordClipBars,
      chordHarmonyState,
      drumsActive,
      drumsClipBars,
      matrix,
      melodyActive,
      melodyClipBars,
      melodyRecordingState,
      melodyScaleId,
      melodyTemplateSteps,
      mutedTracks,
      selectedBar,
    };
    surfaceRef.current = {
      activeInputNotes,
      chordActive,
      chordClipBars,
      chordHarmonyState,
      currentBar,
      currentStep,
      drumsActive,
      drumsClipBars,
      isPlaying,
      matrix,
      melodyActive,
      melodyClipBars,
      melodyRecordingState,
      melodyScaleId,
      melodyTemplateSteps,
      mutedTracks,
      pressedMelodyPads,
      selectedBar,
    };
  }, [
    activeInputNotes,
    chordActive,
    chordClipBars,
    chordHarmonyState,
    currentBar,
    currentStep,
    drumsActive,
    drumsClipBars,
    isPlaying,
    matrix,
    melodyActive,
    melodyClipBars,
    melodyRecordingState,
    melodyScaleId,
    melodyTemplateSteps,
    mutedTracks,
    selectedBar,
  ]);

  useEffect(() => {
    if (!chordActive || chordHarmonyState) chordGestureRef.current.cancel();
  }, [chordActive, chordHarmonyState]);

  const sendLedFrame = useCallback((output = outputRef.current) => {
    if (!output || outputRef.current !== output) return false;

    try {
      const frame = surfaceRef.current.chordActive
        ? createLaunchpadXChordLedFrame(surfaceRef.current)
        : surfaceRef.current.melodyActive
          ? createLaunchpadXMelodyLedFrame(surfaceRef.current)
          : createLaunchpadXDrumsLedFrame(surfaceRef.current);
      frame.forEach((message) => output.send(message));
      return true;
    } catch (error) {
      if (mountedRef.current && outputRef.current === output) {
        setConnection((current) => ({
          ...current,
          ledAvailable: false,
          ledErrorMessage: getErrorMessage(error),
        }));
      }
      return false;
    }
  }, []);

  const releaseMelodyPads = useCallback(({ redraw = true } = {}) => {
    const activeNotes = [...melodyNoteByPadRef.current.entries()];
    melodyNoteByPadRef.current.clear();
    surfaceRef.current = {
      ...surfaceRef.current,
      pressedMelodyPads: new Set(),
    };
    activeNotes.forEach(([pad, note]) => {
      dispatchRef.current?.({
        type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
        inputId: getLaunchpadMelodyInputId(pad),
        note,
      });
    });
    if (redraw) sendLedFrame();
  }, [sendLedFrame]);

  const handleMidiMessage = useCallback((event) => {
    const lastMessage = formatMidiMessage(event.data);
    if (lastMessage) {
      setConnection((current) => ({ ...current, lastMessage }));
    }

    if (chordGestureRef.current.handle(event.data)) return;

    const message = parseLaunchpadXMessage(event.data);
    const mappedCommand = mapLaunchpadXMessageToCommand(event.data, contextRef.current);
    const midiTimestampMs = event.timeStamp;
    const command = mappedCommand?.type === APP_COMMAND_TYPES.DRUMS_PREVIEW
      ? { ...mappedCommand, inputSource: 'launchpad' }
      : mappedCommand?.type === APP_COMMAND_TYPES.MELODY_NOTE_ON
        && Number.isFinite(midiTimestampMs)
        ? { ...mappedCommand, inputTimestampMs: midiTimestampMs }
        : mappedCommand;
    let melodyPadChanged = false;
    if (
      contextRef.current.melodyActive
      && message?.channel === 1
      && message.kind === 'note'
    ) {
      const pressedMelodyPads = new Set(surfaceRef.current.pressedMelodyPads);
      if (command?.type === APP_COMMAND_TYPES.MELODY_NOTE_ON) {
        melodyNoteByPadRef.current.set(message.number, command.note);
        pressedMelodyPads.add(message.number);
        melodyPadChanged = true;
      } else if (command?.type === APP_COMMAND_TYPES.MELODY_NOTE_OFF) {
        melodyNoteByPadRef.current.delete(message.number);
        pressedMelodyPads.delete(message.number);
        melodyPadChanged = true;
      }
      if (melodyPadChanged) {
        surfaceRef.current = { ...surfaceRef.current, pressedMelodyPads };
      }
    }
    if (command && typeof dispatchRef.current === 'function') {
      const previousSelectedBar = contextRef.current.selectedBar;
      const isClipSelectCommand = (
        command?.type === APP_COMMAND_TYPES.DRUMS_SELECT_CLIP
        || command?.type === APP_COMMAND_TYPES.CHORD_SELECT_CLIP
        || command?.type === APP_COMMAND_TYPES.MELODY_SELECT_CLIP
      );
      const isHarmonySelectCommand = (
        command?.type === APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION
      );
      const previousHarmonyState = contextRef.current.chordHarmonyState;
      if (isClipSelectCommand) {
        contextRef.current = {
          ...contextRef.current,
          selectedBar: command.bar,
        };
      }
      if (isHarmonySelectCommand && previousHarmonyState) {
        contextRef.current = {
          ...contextRef.current,
          chordHarmonyState: {
            ...previousHarmonyState,
            selectedOption: {
              mode: command.mode,
              optionIndex: command.optionIndex,
            },
          },
        };
      }

      const dispatchResult = dispatchRef.current(command);
      if (
        isClipSelectCommand
        && dispatchResult === false
      ) {
        contextRef.current = {
          ...contextRef.current,
          selectedBar: previousSelectedBar,
        };
      }
      if (isHarmonySelectCommand && dispatchResult === false) {
        contextRef.current = {
          ...contextRef.current,
          chordHarmonyState: previousHarmonyState,
        };
      }
    }
    if (melodyPadChanged) sendLedFrame();
  }, [sendLedFrame]);

  const melodyInputContextKey = getMelodyInputContextKey({
    melodyActive,
    melodyRecordingState,
    melodyScaleId,
    selectedBar,
  });
  const melodyInputContextKeyRef = useRef(melodyInputContextKey);

  useEffect(() => {
    if (melodyInputContextKeyRef.current === melodyInputContextKey) return;
    melodyInputContextKeyRef.current = melodyInputContextKey;
    if (melodyNoteByPadRef.current.size > 0) releaseMelodyPads();
  }, [melodyInputContextKey, releaseMelodyPads]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleWindowBlur = () => releaseMelodyPads();
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [releaseMelodyPads]);

  const markOutputReady = useCallback((output) => {
    if (!mountedRef.current || outputRef.current !== output) return;

    setConnection((current) => ({
      ...current,
      ledAvailable: true,
      ledErrorMessage: null,
    }));
    sendLedFrame(output);
  }, [sendLedFrame]);

  const openLaunchpadOutput = useCallback((output) => {
    if (!output) return;

    if (typeof output.open !== 'function' || output.connection === 'open') {
      markOutputReady(output);
      return;
    }

    void Promise.resolve(output.open())
      .then(() => markOutputReady(output))
      .catch((error) => {
        if (!mountedRef.current || outputRef.current !== output) return;
        setConnection((current) => ({
          ...current,
          ledAvailable: false,
          ledErrorMessage: getErrorMessage(error),
        }));
      });
  }, [markOutputReady]);

  const bindLaunchpadPorts = useCallback((access) => {
    const input = findLaunchpadXMidiInput(access.inputs.values());
    const output = findLaunchpadXMidiOutput(access.outputs.values());
    const previousInput = inputRef.current;

    if (previousInput && previousInput !== input) {
      detachInput(previousInput);
    }

    inputRef.current = input;
    outputRef.current = output;

    if (!input) {
      releaseMelodyPads({ redraw: false });
      if (!mountedRef.current) return;
      setConnection((current) => ({
        ...current,
        deviceName: null,
        errorMessage: null,
        ledAvailable: false,
        ledErrorMessage: null,
        status: MIDI_CONNECTION_STATUS.DISCONNECTED,
      }));
      return;
    }

    input.onmidimessage = handleMidiMessage;
    if (typeof input.open === 'function' && input.connection !== 'open') {
      void Promise.resolve(input.open()).catch((error) => {
        if (!mountedRef.current || inputRef.current !== input) return;
        setConnection((current) => ({
          ...current,
          errorMessage: getErrorMessage(error),
          status: MIDI_CONNECTION_STATUS.ERROR,
        }));
      });
    }

    if (!mountedRef.current) return;
    setConnection((current) => ({
      ...current,
      deviceName: input.name || 'Launchpad X',
      errorMessage: null,
      ledAvailable: false,
      ledErrorMessage: null,
      status: MIDI_CONNECTION_STATUS.CONNECTED,
    }));
    openLaunchpadOutput(output);
  }, [handleMidiMessage, openLaunchpadOutput, releaseMelodyPads]);

  const connect = useCallback(async () => {
    if (!enabled) return;

    if (!supportsWebMidi()) {
      setConnection((current) => ({
        ...current,
        status: MIDI_CONNECTION_STATUS.UNSUPPORTED,
      }));
      return;
    }

    setConnection((current) => ({
      ...current,
      errorMessage: null,
      ledErrorMessage: null,
      status: MIDI_CONNECTION_STATUS.CONNECTING,
    }));

    try {
      const access = await navigator.requestMIDIAccess.call(navigator, { sysex: false });
      if (!mountedRef.current) return;

      if (accessRef.current) {
        accessRef.current.onstatechange = null;
      }
      accessRef.current = access;

      const handleStateChange = () => bindLaunchpadPorts(access);
      access.onstatechange = handleStateChange;
      bindLaunchpadPorts(access);
    } catch (error) {
      if (!mountedRef.current) return;
      setConnection((current) => ({
        ...current,
        errorMessage: getErrorMessage(error),
        ledAvailable: false,
        status: error?.name === 'NotAllowedError'
          ? MIDI_CONNECTION_STATUS.DENIED
          : MIDI_CONNECTION_STATUS.ERROR,
      }));
    }
  }, [bindLaunchpadPorts, enabled]);

  useEffect(() => {
    if (!connection.ledAvailable) return;
    sendLedFrame();
  }, [
    connection.ledAvailable,
    activeInputNotes,
    chordActive,
    chordClipBars,
    chordHarmonyState,
    currentBar,
    currentStep,
    drumsActive,
    drumsClipBars,
    isPlaying,
    matrix,
    melodyActive,
    melodyClipBars,
    melodyRecordingState,
    melodyScaleId,
    melodyTemplateSteps,
    mutedTracks,
    selectedBar,
    sendLedFrame,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (accessRef.current) accessRef.current.onstatechange = null;
      detachInput(inputRef.current);
      chordGestureRef.current?.cancel();
      releaseMelodyPads({ redraw: false });
      inputRef.current = null;
      outputRef.current = null;
    };
  }, [releaseMelodyPads]);

  return {
    ...connection,
    connect,
  };
}

export {
  getMelodyInputContextKey,
  MIDI_CONNECTION_STATUS,
  useLaunchpadXCommands,
};
export default useLaunchpadXCommands;
