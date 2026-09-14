import { getClipBankStart, getMatrixBars, getTimelineBars, MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { TOTAL_BARS } from '../domain/musicConstants.js';
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
const LAUNCHPAD_X_CHORD_CLIP_NOTE_START = 11;

const LAUNCHPAD_X_CHORD_STEP_ROWS = Object.freeze([
  Object.freeze({ noteStart: 81, stepOffset: 0 }),
  Object.freeze({ noteStart: 71, stepOffset: 8 }),
]);

const LAUNCHPAD_X_CHORD_LED_COLORS = Object.freeze({
  step: Object.freeze({
    inactive: 11,
    active: 9,
    enriched: 13,
    passing: 8,
  }),
  harmony: Object.freeze({
    target: 13,
    enrich: 11,
    enrichCurrent: 9,
    passing: 8,
    passingCurrent: 9,
    selected: 13,
    capture: 13,
  }),
});

function normalizeChordClipBars(chordClipBars) {
  if (!Array.isArray(chordClipBars)) return [];

  return [...new Set(chordClipBars.filter((bar) => (
    Number.isInteger(bar) && bar >= 0 && bar < MAX_PROJECT_BARS
  )))].sort((left, right) => left - right);
}

function getLaunchpadXChordStep(note) {
  if (!Number.isInteger(note)) return null;

  for (const row of LAUNCHPAD_X_CHORD_STEP_ROWS) {
    const column = note - row.noteStart;
    if (column >= 0 && column < 8) return row.stepOffset + column;
  }

  return null;
}

function getLaunchpadXChordClipBar(note, selectedBar = 0, totalBars = TOTAL_BARS) {
  if (!Number.isInteger(note)) return null;
  const bar = note - LAUNCHPAD_X_CHORD_CLIP_NOTE_START;
  const absoluteBar = getClipBankStart(selectedBar) + bar;
  return bar >= 0 && bar < 8 && absoluteBar < totalBars ? absoluteBar : null;
}

function getAdjacentLaunchpadXChordClipBar({
  chordClipBars,
  direction,
  selectedBar,
} = {}) {
  const bars = normalizeChordClipBars(chordClipBars);
  if (bars.length < 2) return null;

  const currentIndex = bars.indexOf(selectedBar);
  if (currentIndex === -1) return null;

  const offset = direction === 'previous' ? -1 : 1;
  return bars[(currentIndex + offset + bars.length) % bars.length];
}

function getChordStepLedState(cell) {
  if (cell?.type !== 'chord') return 'inactive';
  if (cell.grooveTemplateId === 'passing-shortcut') return 'passing';
  if (cell.sourceChordLabel && cell.label !== cell.sourceChordLabel) return 'enriched';
  return 'active';
}

function getHarmonyOptionLedValue(note, harmonyState) {
  const enrichIndex = note - 61;
  if (enrichIndex >= 0 && enrichIndex < harmonyState.enrichOptions.length) {
    if (
      harmonyState.selectedOption?.mode === 'enrich'
      && harmonyState.selectedOption.optionIndex === enrichIndex
    ) {
      return LAUNCHPAD_X_CHORD_LED_COLORS.harmony.selected;
    }
    return harmonyState.enrichOptions[enrichIndex]?.name === harmonyState.currentLabel
      ? LAUNCHPAD_X_CHORD_LED_COLORS.harmony.enrichCurrent
      : LAUNCHPAD_X_CHORD_LED_COLORS.harmony.enrich;
  }

  const passingIndex = note - 51;
  if (
    harmonyState.canApplyPassing
    && passingIndex >= 0
    && passingIndex < harmonyState.passingOptions.length
  ) {
    if (
      harmonyState.selectedOption?.mode === 'passing'
      && harmonyState.selectedOption.optionIndex === passingIndex
    ) {
      return LAUNCHPAD_X_CHORD_LED_COLORS.harmony.selected;
    }
    return harmonyState.passingOptions[passingIndex]?.name === harmonyState.currentLabel
      ? LAUNCHPAD_X_CHORD_LED_COLORS.harmony.passingCurrent
      : LAUNCHPAD_X_CHORD_LED_COLORS.harmony.passing;
  }

  return null;
}

function getGridLedValue(note, {
  chordActive,
  chordClipBars,
  chordHarmonyState,
  matrix,
  selectedBar,
}) {
  if (!chordActive) return 0;

  const clipBar = getLaunchpadXChordClipBar(note, selectedBar, getTimelineBars({ totalBars: getMatrixBars(matrix) }));
  if (clipBar !== null) {
    if (!chordClipBars.includes(clipBar)) return 0;
    return clipBar === selectedBar
      ? LAUNCHPAD_X_LED_COLORS.clip.active
      : LAUNCHPAD_X_LED_COLORS.clip.inactive;
  }

  const harmonyState = chordHarmonyState?.bar === selectedBar
    ? chordHarmonyState
    : null;
  if (harmonyState) {
    const optionValue = getHarmonyOptionLedValue(note, harmonyState);
    if (optionValue !== null) return optionValue;

    const targetStep = getLaunchpadXChordStep(note);
    if (targetStep === harmonyState.step) {
      return LAUNCHPAD_X_CHORD_LED_COLORS.harmony.target;
    }
  }

  const chordStep = getLaunchpadXChordStep(note);
  if (chordStep === null) return 0;

  const cell = matrix?.chord?.[selectedBar]?.[chordStep];
  return LAUNCHPAD_X_CHORD_LED_COLORS.step[getChordStepLedState(cell)];
}

function createLaunchpadXChordLedFrame({
  chordActive = false,
  chordClipBars = [],
  chordHarmonyState = null,
  isPlaying = false,
  matrix = null,
  mutedTracks = null,
  selectedBar = 0,
} = {}) {
  const normalizedClipBars = normalizeChordClipBars(chordClipBars);
  const surface = {
    chordActive,
    chordClipBars: normalizedClipBars,
    chordHarmonyState,
    matrix,
    selectedBar,
  };
  const messages = [];

  for (let row = 8; row >= 1; row -= 1) {
    for (let column = 1; column <= 8; column += 1) {
      const note = (row * 10) + column;
      messages.push([LAUNCHPAD_X_NOTE_STATUS, note, getGridLedValue(note, surface)]);
    }
  }

  const canPageClips = chordActive && normalizedClipBars.length > 1;
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
    chordActive
      && chordHarmonyState?.bar === selectedBar
      && chordHarmonyState.selectedOption
      ? LAUNCHPAD_X_CHORD_LED_COLORS.harmony.capture
      : isPlaying
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
  createLaunchpadXChordLedFrame,
  getAdjacentLaunchpadXChordClipBar,
  getLaunchpadXChordClipBar,
  getLaunchpadXChordStep,
  LAUNCHPAD_X_CHORD_LED_COLORS,
  LAUNCHPAD_X_CHORD_STEP_ROWS,
  normalizeChordClipBars,
};
