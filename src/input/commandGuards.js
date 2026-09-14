import { getTimelineBars, getTotalBars } from '../domain/projectLength.js';
import {
  CORE_TRACK_IDS,
  DRUMS_INSTRUMENT_IDS,
  STEPS_PER_BAR,
} from '../domain/musicConstants.js';
import { isChordName, isChordSpan } from '../domain/chordCells.js';
import { getTrackTypeFromInstanceId } from '../domain/trackInstances.js';
import { APP_COMMAND_TYPES, CHORD_OPTION_COUNT, MELODY_NOTE_IDS } from './appCommands.js';
import { MELODY_INPUT_SOURCES } from './melodyInputLayout.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function hasValidSeekPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'step']) &&
    isIntegerInRange(command.bar, 0, totalBars - 1) &&
    isIntegerInRange(command.step, 0, STEPS_PER_BAR - 1)
  );
}

function hasValidTogglePlayPayload(command, totalBars) {
  if (!hasOnlyKeys(command, ['type', 'audibleTrackIds', 'maxPlaybackSteps'])) return false;
  if (
    'audibleTrackIds' in command
    && (
      !Array.isArray(command.audibleTrackIds)
      || new Set(command.audibleTrackIds).size !== command.audibleTrackIds.length
      || !command.audibleTrackIds.every((trackId) => (
        getTrackTypeFromInstanceId(trackId) !== null
      ))
    )
  ) {
    return false;
  }
  if (
    'maxPlaybackSteps' in command
    && !isIntegerInRange(command.maxPlaybackSteps, 1, totalBars * STEPS_PER_BAR)
  ) {
    return false;
  }
  return true;
}

function hasValidTrackMutePayload(command) {
  return (
    hasOnlyKeys(command, ['type', 'trackId'])
    && CORE_TRACK_IDS.includes(getTrackTypeFromInstanceId(command.trackId))
  );
}

function hasValidDrumsPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'step', 'instrument', 'preview', 'trackId']) &&
    isIntegerInRange(command.bar, 0, totalBars - 1) &&
    isIntegerInRange(command.step, 0, STEPS_PER_BAR - 1) &&
    DRUMS_INSTRUMENT_IDS.includes(command.instrument) &&
    typeof command.preview === 'boolean'
    && (!('trackId' in command) || getTrackTypeFromInstanceId(command.trackId) === 'drums')
  );
}

function hasValidDrumsPreviewPayload(command) {
  return (
    hasOnlyKeys(command, [
      'type',
      'inputSource',
      'inputTimestampMs',
      'instrument',
      'trackId',
    ])
    && DRUMS_INSTRUMENT_IDS.includes(command.instrument)
    && (!('inputSource' in command) || command.inputSource === 'launchpad')
    && (
      !('inputTimestampMs' in command)
      || (Number.isFinite(command.inputTimestampMs) && command.inputTimestampMs >= 0)
    )
    && (!('trackId' in command) || getTrackTypeFromInstanceId(command.trackId) === 'drums')
  );
}

function hasValidDrumsClipPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
  );
}

function hasValidChordClipPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
  );
}

function hasValidChordRhythmPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'step'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
    && isIntegerInRange(command.step, 0, STEPS_PER_BAR - 1)
  );
}

function hasValidChordHarmonyOptionPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'step', 'mode', 'optionIndex'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
    && isIntegerInRange(command.step, 0, STEPS_PER_BAR - 1)
    && ['enrich', 'passing'].includes(command.mode)
    && isIntegerInRange(command.optionIndex, 0, CHORD_OPTION_COUNT - 1)
  );
}

function hasValidChordOptionPayload(command) {
  return (
    hasOnlyKeys(command, ['type', 'optionIndex']) &&
    isIntegerInRange(command.optionIndex, 0, CHORD_OPTION_COUNT - 1)
  );
}

function hasValidChordSetCellPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'span', 'root']) &&
    isIntegerInRange(command.bar, 0, totalBars - 1) &&
    isChordSpan(command.span) &&
    isChordName(command.root)
  );
}

function hasValidChordClearCellPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'span']) &&
    isIntegerInRange(command.bar, 0, totalBars - 1) &&
    isChordSpan(command.span)
  );
}

function hasValidMelodyPayload(command) {
  if (command.type === APP_COMMAND_TYPES.MELODY_NOTE_ON) {
    return (
      hasOnlyKeys(command, ['type', 'note', 'inputId', 'inputTimestampMs', 'source'])
      && MELODY_NOTE_IDS.includes(command.note)
      && typeof command.inputId === 'string'
      && command.inputId.length > 0
      && Object.values(MELODY_INPUT_SOURCES).includes(command.source)
      && (
        !('inputTimestampMs' in command)
        || (Number.isFinite(command.inputTimestampMs) && command.inputTimestampMs >= 0)
      )
    );
  }

  return (
    hasOnlyKeys(command, ['type', 'inputId', 'note'])
    && typeof command.inputId === 'string'
    && command.inputId.length > 0
    && (!('note' in command) || MELODY_NOTE_IDS.includes(command.note))
  );
}

function hasValidMelodyClipPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
  );
}

function hasValidMelodyStepPayload(command, totalBars) {
  return (
    hasOnlyKeys(command, ['type', 'bar', 'step'])
    && isIntegerInRange(command.bar, 0, totalBars - 1)
    && isIntegerInRange(command.step, 0, STEPS_PER_BAR - 1)
  );
}

function isValidAppCommand(command, state) {
  const totalBars = getTotalBars(state);
  if (!isPlainObject(command) || typeof command.type !== 'string') return false;

  switch (command.type) {
    case APP_COMMAND_TYPES.APP_REDO:
    case APP_COMMAND_TYPES.APP_UNDO:
    case APP_COMMAND_TYPES.TRANSPORT_STOP:
    case APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND:
    case APP_COMMAND_TYPES.CLIP_COPY_SELECTED:
    case APP_COMMAND_TYPES.CLIP_DELETE_SELECTED:
    case APP_COMMAND_TYPES.CLIP_PASTE:
    case APP_COMMAND_TYPES.TUTORIAL_NEXT:
    case APP_COMMAND_TYPES.TUTORIAL_COMPLETE_TASK:
    case APP_COMMAND_TYPES.CHORD_CONFIRM:
    case APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY:
      return hasOnlyKeys(command, ['type']);

    case APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY:
      return hasValidTogglePlayPayload(command, totalBars);

    case APP_COMMAND_TYPES.TRANSPORT_SEEK:
      return hasValidSeekPayload(command, totalBars);

    case APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE:
      return hasValidTrackMutePayload(command);

    case APP_COMMAND_TYPES.DRUMS_TOGGLE:
      return hasValidDrumsPayload(command, totalBars);

    case APP_COMMAND_TYPES.DRUMS_PREVIEW:
      return hasValidDrumsPreviewPayload(command);

    case APP_COMMAND_TYPES.DRUMS_SELECT_CLIP:
      return hasValidDrumsClipPayload(command, getTimelineBars(state));

    case APP_COMMAND_TYPES.CHORD_SELECT_CLIP:
      return hasValidChordClipPayload(command, getTimelineBars(state));

    case APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM:
    case APP_COMMAND_TYPES.CHORD_OPEN_HARMONY:
      return hasValidChordRhythmPayload(command, totalBars);

    case APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION:
    case APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION:
    case APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION:
      return hasValidChordHarmonyOptionPayload(command, totalBars);

    case APP_COMMAND_TYPES.CHORD_SELECT_OPTION:
      return hasValidChordOptionPayload(command);

    case APP_COMMAND_TYPES.CHORD_SET_CELL:
      return hasValidChordSetCellPayload(command, totalBars);

    case APP_COMMAND_TYPES.CHORD_CLEAR_CELL:
      return hasValidChordClearCellPayload(command, totalBars);

    case APP_COMMAND_TYPES.MELODY_NOTE_ON:
    case APP_COMMAND_TYPES.MELODY_NOTE_OFF:
      return hasValidMelodyPayload(command);

    case APP_COMMAND_TYPES.MELODY_SELECT_CLIP:
      return hasValidMelodyClipPayload(command, getTimelineBars(state));

    case APP_COMMAND_TYPES.MELODY_SELECT_STEP:
      return hasValidMelodyStepPayload(command, totalBars);

    default:
      return false;
  }
}

export { isValidAppCommand };
