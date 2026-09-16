import { getMatrixBars, getTimelineBars } from '../domain/projectLength.js';
import { APP_COMMAND_TYPES } from './appCommands.js';
import {
  getAdjacentLaunchpadXChordClipBar,
  getLaunchpadXChordClipBar,
  getLaunchpadXChordStep,
} from './launchpadXChordSurface.js';
import {
  getAdjacentLaunchpadXDrumsClipBar,
  getLaunchpadXDrumPreviewInstrument,
  getLaunchpadXDrumsClipBar,
  getLaunchpadXDrumStep,
  getLaunchpadXTrackIdForMuteCc,
  LAUNCHPAD_X_CAPTURE_MIDI_CC,
  LAUNCHPAD_X_NEXT_CLIP_CC,
  LAUNCHPAD_X_PREVIOUS_CLIP_CC,
  LAUNCHPAD_X_STOP_CLIP_CC,
  LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK,
} from './launchpadXDrumsSurface.js';
import {
  getAdjacentLaunchpadXMelodyClipBar,
  getLaunchpadXMelodyClipBar,
  getLaunchpadXMelodyNote,
  getLaunchpadXMelodyStep,
  isLaunchpadXMelodyNoteAreaVisible,
} from './launchpadXMelodySurface.js';
import { parseLaunchpadXMessage } from './launchpadXProtocol.js';
import {
  getLaunchpadMelodyInputId,
  MELODY_INPUT_SOURCES,
} from './melodyInputLayout.js';

function isValidSelectedBar(selectedBar, totalBars) {
  return Number.isInteger(selectedBar) && selectedBar >= 0 && selectedBar < totalBars;
}

function createHarmonyOptionPayload(type, harmonyState, selectedOption) {
  return {
    type,
    bar: harmonyState.bar,
    step: harmonyState.step,
    mode: selectedOption.mode,
    optionIndex: selectedOption.optionIndex,
  };
}

function mapTransportMessage(message, harmonyState = null) {
  if (message.kind !== 'control-change' || !message.pressed) return null;

  if (message.number === LAUNCHPAD_X_CAPTURE_MIDI_CC) {
    if (harmonyState?.selectedOption) {
      return createHarmonyOptionPayload(
        APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION,
        harmonyState,
        harmonyState.selectedOption,
      );
    }
    return { type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY };
  }

  if (message.number === LAUNCHPAD_X_STOP_CLIP_CC) {
    return { type: APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND };
  }

  return null;
}

function mapTrackMuteMessage(message) {
  if (message.kind !== 'control-change' || !message.pressed) return null;
  const trackId = getLaunchpadXTrackIdForMuteCc(message.number);
  return trackId
    ? { type: APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE, trackId }
    : null;
}

function getClipPageDirection(message) {
  if (message.kind !== 'control-change' || !message.pressed) return null;
  if (message.number === LAUNCHPAD_X_PREVIOUS_CLIP_CC) return 'previous';
  if (message.number === LAUNCHPAD_X_NEXT_CLIP_CC) return 'next';
  return null;
}

function createSelectClipCommand(type, bar) {
  if (bar === null) return null;
  return { type, bar };
}

function createHarmonyOptionCommand({
  harmonyState,
  mode,
  note,
  noteStart,
}) {
  const optionIndex = note - noteStart;
  const options = mode === 'passing'
    ? harmonyState.passingOptions
    : harmonyState.enrichOptions;
  if (optionIndex < 0 || optionIndex >= options.length) return null;

  const selectedOption = { mode, optionIndex };
  const isSelected = (
    harmonyState.selectedOption?.mode === mode
    && harmonyState.selectedOption?.optionIndex === optionIndex
  );

  return createHarmonyOptionPayload(
    isSelected
      ? APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION
      : APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION,
    harmonyState,
    selectedOption,
  );
}

function mapChordMessage(message, {
  chordClipBars,
  chordHarmonyState,
  matrix,
  selectedBar,
  totalBars,
}) {
  const pageDirection = getClipPageDirection(message);
  if (pageDirection) {
    return createSelectClipCommand(
      APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
      getAdjacentLaunchpadXChordClipBar({
        chordClipBars,
        direction: pageDirection,
        selectedBar,
      }),
    );
  }

  if (message.kind !== 'note') return null;

  const clipBar = getLaunchpadXChordClipBar(message.number, selectedBar, totalBars);
  if (clipBar !== null) {
    return createSelectClipCommand(APP_COMMAND_TYPES.CHORD_SELECT_CLIP, clipBar);
  }

  const harmonyState = chordHarmonyState?.bar === selectedBar
    ? chordHarmonyState
    : null;
  if (harmonyState) {
    const enrichCommand = createHarmonyOptionCommand({
      harmonyState,
      mode: 'enrich',
      note: message.number,
      noteStart: 61,
    });
    if (enrichCommand) return enrichCommand;

    if (harmonyState.canApplyPassing) {
      const passingCommand = createHarmonyOptionCommand({
        harmonyState,
        mode: 'passing',
        note: message.number,
        noteStart: 51,
      });
      if (passingCommand) return passingCommand;
    }

    const targetStep = getLaunchpadXChordStep(message.number);
    if (targetStep === null) return null;
    if (targetStep === harmonyState.step) {
      return { type: APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY };
    }
    if (matrix?.chord?.[selectedBar]?.[targetStep]?.type !== 'chord') return null;
    return {
      type: APP_COMMAND_TYPES.CHORD_OPEN_HARMONY,
      bar: selectedBar,
      step: targetStep,
    };
  }

  const step = getLaunchpadXChordStep(message.number);
  if (step === null) return null;

  return {
    type: APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM,
    bar: selectedBar,
    step,
  };
}

function mapDrumsMessage(message, { drumsClipBars, selectedBar, totalBars }) {
  const pageDirection = getClipPageDirection(message);
  if (pageDirection) {
    return createSelectClipCommand(
      APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
      getAdjacentLaunchpadXDrumsClipBar({
        direction: pageDirection,
        drumsClipBars,
        selectedBar,
      }),
    );
  }

  if (message.kind !== 'note') return null;

  const clipBar = getLaunchpadXDrumsClipBar(message.number, selectedBar, totalBars);
  if (clipBar !== null) {
    return createSelectClipCommand(APP_COMMAND_TYPES.DRUMS_SELECT_CLIP, clipBar);
  }

  const previewInstrument = getLaunchpadXDrumPreviewInstrument(message.number);
  if (previewInstrument) {
    return {
      type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
      instrument: previewInstrument,
    };
  }

  const drumStep = getLaunchpadXDrumStep(message.number);
  if (!drumStep) return null;

  return {
    type: APP_COMMAND_TYPES.DRUMS_TOGGLE,
    bar: selectedBar,
    step: drumStep.step,
    instrument: drumStep.instrument,
    preview: true,
  };
}

function mapMelodyMessage(message, {
  activeMelodyNotes,
  melodyClipBars,
  melodyRecordingState,
  melodyScaleId,
  melodyTemplateSteps,
  selectedBar,
  totalBars,
}) {
  const pageDirection = getClipPageDirection(message);
  if (pageDirection) {
    return createSelectClipCommand(
      APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
      getAdjacentLaunchpadXMelodyClipBar({
        direction: pageDirection,
        melodyClipBars,
        selectedBar,
      }),
    );
  }

  if (message.kind !== 'note') return null;

  const clipBar = getLaunchpadXMelodyClipBar(message.number, selectedBar, totalBars);
  if (clipBar !== null) {
    return message.pressed
      ? createSelectClipCommand(APP_COMMAND_TYPES.MELODY_SELECT_CLIP, clipBar)
      : null;
  }

  const step = getLaunchpadXMelodyStep(message.number);
  if (step !== null) {
    return message.pressed && melodyTemplateSteps.includes(step)
      ? {
        type: APP_COMMAND_TYPES.MELODY_SELECT_STEP,
        bar: selectedBar,
        step,
      }
      : null;
  }

  const activeNote = activeMelodyNotes instanceof Map
    ? activeMelodyNotes.get(message.number)
    : activeMelodyNotes?.[message.number];
  if (!message.pressed && activeNote) {
    return {
      type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
      inputId: getLaunchpadMelodyInputId(message.number),
      note: activeNote,
    };
  }

  if (!message.pressed) return null;

  if (!isLaunchpadXMelodyNoteAreaVisible(
    melodyRecordingState?.phase,
    melodyTemplateSteps.length > 0,
  )) return null;

  const note = getLaunchpadXMelodyNote(message.number, melodyScaleId);
  if (!note) return null;
  return {
    type: APP_COMMAND_TYPES.MELODY_NOTE_ON,
    inputId: getLaunchpadMelodyInputId(message.number),
    note,
    source: MELODY_INPUT_SOURCES.LAUNCHPAD,
  };
}

function mapLaunchpadXMessageToCommand(data, {
  activeMelodyNotes = null,
  chordActive = false,
  chordClipBars = [],
  chordHarmonyState = null,
  drumsActive = false,
  drumsClipBars = [],
  melodyActive = false,
  melodyClipBars = [],
  melodyRecordingState = null,
  melodyScaleId = 'chinese',
  melodyTemplateSteps = [],
  matrix = null,
  selectedBar = 0,
} = {}) {
  const totalBars = getTimelineBars({ totalBars: getMatrixBars(matrix) });
  const message = parseLaunchpadXMessage(data);
  if (message?.channel !== 1) return null;

  const activeHarmonyState = (
    chordActive
    && isValidSelectedBar(selectedBar, totalBars)
    && chordHarmonyState?.bar === selectedBar
  ) ? chordHarmonyState : null;
  const trackMuteCommand = mapTrackMuteMessage(message);
  if (trackMuteCommand) return trackMuteCommand;
  const transportCommand = mapTransportMessage(message, activeHarmonyState);
  if (transportCommand) return transportCommand;

  if (!isValidSelectedBar(selectedBar, totalBars)) return null;
  if (melodyActive) {
    return mapMelodyMessage(message, {
      activeMelodyNotes,
      melodyClipBars,
      melodyRecordingState,
      melodyScaleId,
      melodyTemplateSteps,
      selectedBar,
      totalBars,
    });
  }
  if (!message.pressed) return null;
  if (chordActive) {
    return mapChordMessage(message, {
      chordClipBars,
      chordHarmonyState,
      matrix,
      selectedBar,
      totalBars,
    });
  }
  if (drumsActive) return mapDrumsMessage(message, { drumsClipBars, selectedBar, totalBars });
  return null;
}

export {
  LAUNCHPAD_X_CAPTURE_MIDI_CC,
  LAUNCHPAD_X_NEXT_CLIP_CC,
  LAUNCHPAD_X_PREVIOUS_CLIP_CC,
  LAUNCHPAD_X_STOP_CLIP_CC,
  LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK,
  mapLaunchpadXMessageToCommand,
};
