import { getClipBankStart, getMatrixBars, getTimelineBars, MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { STEPS_PER_BAR, TOTAL_BARS } from '../domain/musicConstants.js';
import {
  getMelodyInputCellByLaunchpadNote,
  isMelodyInputAreaVisible,
  MELODY_INPUT_ROWS,
} from './melodyInputLayout.js';
import {
  createLaunchpadXTrackMuteLedMessages,
  LAUNCHPAD_X_CAPTURE_MIDI_CC,
  LAUNCHPAD_X_LED_COLORS,
  LAUNCHPAD_X_NEXT_CLIP_CC,
  LAUNCHPAD_X_PREVIOUS_CLIP_CC,
  LAUNCHPAD_X_STOP_CLIP_CC,
} from './launchpadXDrumsSurface.js';

const LAUNCHPAD_X_NOTE_STATUS = 0x90;
const LAUNCHPAD_X_CC_STATUS = 0xb0;
const LAUNCHPAD_X_MELODY_CLIP_NOTE_START = 11;

const LAUNCHPAD_X_MELODY_ROWS = Object.freeze(
  [...MELODY_INPUT_ROWS]
    .reverse()
    .map(({ launchpadNoteStart, octave }) => Object.freeze({
      noteStart: launchpadNoteStart,
      octave,
    })),
);

const LAUNCHPAD_X_MELODY_LED_COLORS = Object.freeze({
  note: Object.freeze({ inactive: 43, pressed: 41 }),
  step: Object.freeze({
    empty: 55,
    filled: 49,
    playhead: 21,
    target: 3,
    template: 51,
  }),
});

function normalizeMelodyClipBars(melodyClipBars) {
  if (!Array.isArray(melodyClipBars)) return [];

  return [...new Set(melodyClipBars.filter((bar) => (
    Number.isInteger(bar) && bar >= 0 && bar < MAX_PROJECT_BARS
  )))].sort((left, right) => left - right);
}

function normalizeMelodyTemplateSteps(melodyTemplateSteps) {
  if (!Array.isArray(melodyTemplateSteps)) return [];
  return [...new Set(melodyTemplateSteps.filter((step) => (
    Number.isInteger(step) && step >= 0 && step < STEPS_PER_BAR
  )))].sort((left, right) => left - right);
}

function getLaunchpadXMelodyClipBar(note, selectedBar = 0, totalBars = TOTAL_BARS) {
  if (!Number.isInteger(note)) return null;
  const bar = note - LAUNCHPAD_X_MELODY_CLIP_NOTE_START;
  const absoluteBar = getClipBankStart(selectedBar) + bar;
  return bar >= 0 && bar < 8 && absoluteBar < totalBars ? absoluteBar : null;
}

function getLaunchpadXMelodyStep(note) {
  if (!Number.isInteger(note)) return null;
  if (note >= 81 && note <= 88) return note - 81;
  if (note >= 71 && note <= 78) return note - 71 + 8;
  return null;
}

function getAdjacentLaunchpadXMelodyClipBar({
  direction,
  melodyClipBars,
  selectedBar,
} = {}) {
  const bars = normalizeMelodyClipBars(melodyClipBars);
  if (bars.length < 2) return null;

  const currentIndex = bars.indexOf(selectedBar);
  if (currentIndex === -1) return null;

  const offset = direction === 'previous' ? -1 : 1;
  return bars[(currentIndex + offset + bars.length) % bars.length];
}

function getLaunchpadXMelodyNote(note, melodyScaleId = 'chinese') {
  return getMelodyInputCellByLaunchpadNote(note, melodyScaleId)?.note ?? null;
}

function isLaunchpadXMelodyNoteAreaVisible(phase, hasTemplate = true) {
  return isMelodyInputAreaVisible({ hasTemplate, phase });
}

function hasPressedPad(pressedMelodyPads, note) {
  if (pressedMelodyPads instanceof Set) return pressedMelodyPads.has(note);
  return Array.isArray(pressedMelodyPads) && pressedMelodyPads.includes(note);
}

function hasActiveMelodyNote(activeInputNotes, note) {
  if (activeInputNotes instanceof Set) return activeInputNotes.has(note);
  return Array.isArray(activeInputNotes) && activeInputNotes.includes(note);
}

function hasMelodyCell(matrix, bar, step) {
  return matrix?.melody?.[bar]?.[step]?.type === 'melody';
}

function getStepLedValue(step, surface) {
  const {
    currentBar,
    currentStep,
    isPlaying,
    matrix,
    melodyRecordingState,
    melodyTemplateSteps,
    selectedBar,
  } = surface;
  const phase = melodyRecordingState?.phase ?? 'idle';
  const templateIndex = melodyTemplateSteps.indexOf(step);
  const isTemplateStep = templateIndex >= 0;
  const hasWrittenNote = hasMelodyCell(matrix, selectedBar, step);
  const selectedStep = melodyRecordingState?.selectedStep;
  const barRecordedNotes = melodyRecordingState?.barRecordedNotes ?? 0;
  const nextCaptureStep = phase === 'sequence-capture'
    ? melodyTemplateSteps[barRecordedNotes]
    : null;

  if (
    (phase === 'step-edit' && selectedStep === step)
    || nextCaptureStep === step
  ) {
    return LAUNCHPAD_X_MELODY_LED_COLORS.step.target;
  }
  if (
    isPlaying
    && currentBar === selectedBar
    && currentStep === step
  ) {
    return LAUNCHPAD_X_MELODY_LED_COLORS.step.playhead;
  }
  const isCapturedStep = (
    phase === 'sequence-capture'
    && isTemplateStep
    && templateIndex < barRecordedNotes
  );
  if (isCapturedStep || hasWrittenNote) {
    return LAUNCHPAD_X_MELODY_LED_COLORS.step.filled;
  }
  if (isTemplateStep) return LAUNCHPAD_X_MELODY_LED_COLORS.step.template;
  return LAUNCHPAD_X_MELODY_LED_COLORS.step.empty;
}

function getGridLedValue(note, surface) {
  if (!surface.melodyActive) return 0;

  const clipBar = getLaunchpadXMelodyClipBar(note, surface.selectedBar, getTimelineBars({ totalBars: getMatrixBars(surface.matrix) }));
  if (clipBar !== null) {
    if (!surface.melodyClipBars.includes(clipBar)) return 0;
    return clipBar === surface.selectedBar
      ? LAUNCHPAD_X_LED_COLORS.clip.active
      : LAUNCHPAD_X_LED_COLORS.clip.inactive;
  }

  const step = getLaunchpadXMelodyStep(note);
  if (step !== null) return getStepLedValue(step, surface);

  const phase = surface.melodyRecordingState?.phase ?? 'idle';
  if (!isLaunchpadXMelodyNoteAreaVisible(
    phase,
    surface.melodyTemplateSteps.length > 0,
  )) return 0;
  const melodyNote = getLaunchpadXMelodyNote(note, surface.melodyScaleId);
  if (!melodyNote) return 0;
  return (
    hasPressedPad(surface.pressedMelodyPads, note)
    || hasActiveMelodyNote(surface.activeInputNotes, melodyNote)
  )
    ? LAUNCHPAD_X_MELODY_LED_COLORS.note.pressed
    : LAUNCHPAD_X_MELODY_LED_COLORS.note.inactive;
}

function createLaunchpadXMelodyLedFrame({
  activeInputNotes = null,
  currentBar = 0,
  currentStep = 0,
  isPlaying = false,
  matrix = null,
  melodyActive = false,
  melodyClipBars = [],
  melodyRecordingState = null,
  melodyScaleId = 'chinese',
  melodyTemplateSteps = [],
  mutedTracks = null,
  pressedMelodyPads = null,
  selectedBar = 0,
} = {}) {
  const normalizedClipBars = normalizeMelodyClipBars(melodyClipBars);
  const surface = {
    activeInputNotes,
    currentBar,
    currentStep,
    isPlaying,
    matrix,
    melodyActive,
    melodyClipBars: normalizedClipBars,
    melodyRecordingState,
    melodyScaleId,
    melodyTemplateSteps: normalizeMelodyTemplateSteps(melodyTemplateSteps),
    pressedMelodyPads,
    selectedBar,
  };
  const messages = [];

  for (let row = 8; row >= 1; row -= 1) {
    for (let column = 1; column <= 8; column += 1) {
      const note = (row * 10) + column;
      messages.push([LAUNCHPAD_X_NOTE_STATUS, note, getGridLedValue(note, surface)]);
    }
  }

  const canPageClips = melodyActive && normalizedClipBars.length > 1;
  messages.push([
    LAUNCHPAD_X_CC_STATUS,
    LAUNCHPAD_X_PREVIOUS_CLIP_CC,
    canPageClips ? LAUNCHPAD_X_LED_COLORS.clip.inactive : 0,
  ]);
  messages.push([
    LAUNCHPAD_X_CC_STATUS,
    LAUNCHPAD_X_NEXT_CLIP_CC,
    canPageClips ? LAUNCHPAD_X_LED_COLORS.clip.inactive : 0,
  ]);
  messages.push([
    LAUNCHPAD_X_CC_STATUS,
    LAUNCHPAD_X_CAPTURE_MIDI_CC,
    isPlaying
      ? LAUNCHPAD_X_LED_COLORS.transport.playing
      : LAUNCHPAD_X_LED_COLORS.transport.stopped,
  ]);
  messages.push([
    LAUNCHPAD_X_CC_STATUS,
    LAUNCHPAD_X_STOP_CLIP_CC,
    LAUNCHPAD_X_LED_COLORS.transport.stop,
  ]);
  messages.push(...createLaunchpadXTrackMuteLedMessages(mutedTracks));

  return messages;
}

export {
  createLaunchpadXMelodyLedFrame,
  getAdjacentLaunchpadXMelodyClipBar,
  getLaunchpadXMelodyClipBar,
  getLaunchpadXMelodyNote,
  getLaunchpadXMelodyStep,
  isLaunchpadXMelodyNoteAreaVisible,
  LAUNCHPAD_X_MELODY_LED_COLORS,
  LAUNCHPAD_X_MELODY_ROWS,
  normalizeMelodyClipBars,
  normalizeMelodyTemplateSteps,
};
