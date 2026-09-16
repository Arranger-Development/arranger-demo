import { getTotalBars } from '../domain/projectLength.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { APP_COMMAND_TYPES, CHORD_OPTION_COUNT } from './appCommands.js';
import { getTrackType } from '../domain/trackInstances.js';
import {
  getKeyboardMelodyInputId,
  getMelodyInputCellByCode,
  isMelodyInputKeyboardCode,
  MELODY_INPUT_SOURCES,
} from './melodyInputLayout.js';
import { getDrumsInstrumentByKeyboardCode } from './drumsInputLayout.js';

function getEventKey(event) {
  if (event.code === 'Space') return ' ';
  return event.key;
}

function clampSeek(bar, step, totalBars) {
  const totalSteps = totalBars * STEPS_PER_BAR;
  const current = bar * STEPS_PER_BAR + step;
  const clamped = Math.max(0, Math.min(totalSteps - 1, current));

  return {
    bar: Math.floor(clamped / STEPS_PER_BAR),
    step: clamped % STEPS_PER_BAR,
  };
}

function mapArrowKeyToCommand(key, state) {
  const bar = state.seekBar ?? state.currentBar ?? 0;
  const step = state.seekStep ?? state.currentStep ?? 0;
  const delta = key === 'ArrowRight' ? 1 : -1;
  const next = clampSeek(bar, step + delta, getTotalBars(state));

  return { type: APP_COMMAND_TYPES.TRANSPORT_SEEK, ...next };
}

function mapNumberKeyToCommand(eventType, key) {
  const number = Number.parseInt(key, 10);
  if (!Number.isInteger(number) || number < 1 || number > CHORD_OPTION_COUNT) return null;
  if (eventType !== 'keydown') return null;
  return {
    type: APP_COMMAND_TYPES.CHORD_SELECT_OPTION,
    optionIndex: number - 1,
  };
}

function isEditableKeyboardTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;

  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function mapKeyboardEventToCommand(event, state = {}) {
  const key = getEventKey(event);
  const eventType = event.type ?? 'keydown';

  if (eventType === 'keyup' && isMelodyInputKeyboardCode(event.code)) {
    return {
      type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
      inputId: getKeyboardMelodyInputId(event.code),
    };
  }

  if (event.repeat || isEditableKeyboardTarget(event.target)) return null;

  if (
    eventType === 'keydown'
    && key.toLowerCase() === 'z'
    && (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
  ) {
    return { type: APP_COMMAND_TYPES.APP_UNDO };
  }

  if (
    eventType === 'keydown'
    && key.toLowerCase() === 'c'
    && (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
    && (state.selectedClipId || state.hasTimelineSelection)
  ) {
    return { type: APP_COMMAND_TYPES.CLIP_COPY_SELECTED };
  }

  if (
    eventType === 'keydown'
    && key.toLowerCase() === 'v'
    && (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
    && state.canPasteClip
  ) {
    return { type: APP_COMMAND_TYPES.CLIP_PASTE };
  }

  if (eventType === 'keydown' && key === ' ') {
    return { type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY };
  }

  if (eventType === 'keydown' && key === 'Escape') {
    return { type: APP_COMMAND_TYPES.TRANSPORT_STOP };
  }

  if (eventType === 'keydown' && key === 'Enter') {
    return { type: APP_COMMAND_TYPES.TUTORIAL_NEXT };
  }

  if (
    eventType === 'keydown'
    && (key === 'Delete' || key === 'Backspace')
    && (state.selectedClipId || state.hasTimelineSelection)
  ) {
    return { type: APP_COMMAND_TYPES.CLIP_DELETE_SELECTED };
  }

  if (eventType === 'keydown' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    return mapArrowKeyToCommand(key, state);
  }

  if (
    eventType === 'keydown'
    && getTrackType(state, state.activeTrackId) === 'melody'
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
  ) {
    const cell = getMelodyInputCellByCode(event.code, state.melodyScaleId);
    if (cell?.enabled) {
      return {
        type: APP_COMMAND_TYPES.MELODY_NOTE_ON,
        inputId: getKeyboardMelodyInputId(event.code),
        ...(Number.isFinite(event.timeStamp) ? { inputTimestampMs: event.timeStamp } : {}),
        note: cell.note,
        source: MELODY_INPUT_SOURCES.KEYBOARD,
      };
    }
  }

  if (
    eventType === 'keydown'
    && getTrackType(state, state.activeTrackId) === 'drums'
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
  ) {
    const instrument = getDrumsInstrumentByKeyboardCode(event.code);
    if (instrument) {
      return {
        type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
        ...(Number.isFinite(event.timeStamp) ? { inputTimestampMs: event.timeStamp } : {}),
        instrument,
      };
    }
  }

  if (getTrackType(state, state.activeTrackId) === 'chord' && /^[0-9]$/.test(key)) {
    return mapNumberKeyToCommand(eventType, key);
  }

  return null;
}

function shouldPreventDefaultForCommand(command) {
  return command !== null;
}

export { mapKeyboardEventToCommand, shouldPreventDefaultForCommand };
