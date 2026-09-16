import { getClipBankStart, getMatrixBars, getTimelineBars, MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { getDrumsCellInstruments } from '../domain/drumsCells.js';
import { TOTAL_BARS } from '../domain/musicConstants.js';

const LAUNCHPAD_X_NOTE_STATUS = 0x90;
const LAUNCHPAD_X_CC_STATUS = 0xb0;
const LAUNCHPAD_X_PREVIOUS_CLIP_CC = 93;
const LAUNCHPAD_X_NEXT_CLIP_CC = 94;
const LAUNCHPAD_X_CAPTURE_MIDI_CC = 98;
const LAUNCHPAD_X_STOP_CLIP_CC = 49;
const LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK = Object.freeze({
  drums: 89,
  chord: 79,
  bass: 69,
  melody: 59,
});
const LAUNCHPAD_X_DRUM_CLIP_NOTE_START = 11;

const LAUNCHPAD_X_DRUM_STEP_ROWS = Object.freeze([
  Object.freeze({ instrument: 'kick', noteStart: 81, stepOffset: 0 }),
  Object.freeze({ instrument: 'snare', noteStart: 71, stepOffset: 0 }),
  Object.freeze({ instrument: 'hihat', noteStart: 61, stepOffset: 0 }),
  Object.freeze({ instrument: 'kick', noteStart: 51, stepOffset: 8 }),
  Object.freeze({ instrument: 'snare', noteStart: 41, stepOffset: 8 }),
  Object.freeze({ instrument: 'hihat', noteStart: 31, stepOffset: 8 }),
]);

const LAUNCHPAD_X_DRUM_PREVIEW_NOTES = Object.freeze({
  21: 'kick',
  22: 'snare',
  23: 'hihat',
});

const LAUNCHPAD_X_LED_COLORS = Object.freeze({
  kick: Object.freeze({ inactive: 43, active: 41 }),
  snare: Object.freeze({ inactive: 7, active: 5 }),
  hihat: Object.freeze({ inactive: 11, active: 9 }),
  clip: Object.freeze({ inactive: 23, active: 21 }),
  transport: Object.freeze({ stopped: 23, playing: 21, stop: 7 }),
});

const LAUNCHPAD_X_TRACK_MUTE_LED_COLORS = Object.freeze({
  drums: Object.freeze({ unmuted: 17, muted: 19 }),
  chord: Object.freeze({ unmuted: 9, muted: 11 }),
  bass: Object.freeze({ unmuted: 41, muted: 43 }),
  melody: Object.freeze({ unmuted: 49, muted: 51 }),
});

function getLaunchpadXTrackIdForMuteCc(cc) {
  return Object.entries(LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK)
    .find(([, trackCc]) => trackCc === cc)?.[0] ?? null;
}

function createLaunchpadXTrackMuteLedMessages(mutedTracks = {}) {
  return Object.entries(LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK).map(([trackId, cc]) => ([
    LAUNCHPAD_X_CC_STATUS,
    cc,
    LAUNCHPAD_X_TRACK_MUTE_LED_COLORS[trackId][
      mutedTracks?.[trackId] ? 'muted' : 'unmuted'
    ],
  ]));
}

function normalizeDrumsClipBars(drumsClipBars) {
  if (!Array.isArray(drumsClipBars)) return [];

  return [...new Set(drumsClipBars.filter((bar) => (
    Number.isInteger(bar) && bar >= 0 && bar < MAX_PROJECT_BARS
  )))].sort((left, right) => left - right);
}

function getLaunchpadXDrumStep(note) {
  if (!Number.isInteger(note)) return null;

  for (const row of LAUNCHPAD_X_DRUM_STEP_ROWS) {
    const column = note - row.noteStart;
    if (column >= 0 && column < 8) {
      return {
        instrument: row.instrument,
        step: row.stepOffset + column,
      };
    }
  }

  return null;
}

function getLaunchpadXDrumPreviewInstrument(note) {
  return LAUNCHPAD_X_DRUM_PREVIEW_NOTES[note] ?? null;
}

function getLaunchpadXDrumsClipBar(note, selectedBar = 0, totalBars = TOTAL_BARS) {
  if (!Number.isInteger(note)) return null;
  const bar = note - LAUNCHPAD_X_DRUM_CLIP_NOTE_START;
  const absoluteBar = getClipBankStart(selectedBar) + bar;
  return bar >= 0 && bar < 8 && absoluteBar < totalBars ? absoluteBar : null;
}

function getAdjacentLaunchpadXDrumsClipBar({
  direction,
  drumsClipBars,
  selectedBar,
} = {}) {
  const bars = normalizeDrumsClipBars(drumsClipBars);
  if (bars.length < 2) return null;

  const currentIndex = bars.indexOf(selectedBar);
  if (currentIndex === -1) return null;

  const offset = direction === 'previous' ? -1 : 1;
  return bars[(currentIndex + offset + bars.length) % bars.length];
}

function getGridLedValue(note, {
  drumsActive,
  drumsClipBars,
  matrix,
  selectedBar,
}) {
  if (!drumsActive) return 0;

  const previewInstrument = getLaunchpadXDrumPreviewInstrument(note);
  if (previewInstrument) return LAUNCHPAD_X_LED_COLORS[previewInstrument].active;

  const clipBar = getLaunchpadXDrumsClipBar(note, selectedBar, getTimelineBars({ totalBars: getMatrixBars(matrix) }));
  if (clipBar !== null) {
    if (!drumsClipBars.includes(clipBar)) return 0;
    return clipBar === selectedBar
      ? LAUNCHPAD_X_LED_COLORS.clip.active
      : LAUNCHPAD_X_LED_COLORS.clip.inactive;
  }

  const drumStep = getLaunchpadXDrumStep(note);
  if (!drumStep) return 0;

  const instruments = getDrumsCellInstruments(matrix?.drums?.[selectedBar]?.[drumStep.step]);
  const state = instruments.includes(drumStep.instrument) ? 'active' : 'inactive';
  return LAUNCHPAD_X_LED_COLORS[drumStep.instrument][state];
}

function createLaunchpadXDrumsLedFrame({
  drumsActive = false,
  drumsClipBars = [],
  isPlaying = false,
  matrix = null,
  mutedTracks = null,
  selectedBar = 0,
} = {}) {
  const normalizedClipBars = normalizeDrumsClipBars(drumsClipBars);
  const surface = {
    drumsActive,
    drumsClipBars: normalizedClipBars,
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

  const canPageClips = drumsActive && normalizedClipBars.length > 1;
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
  createLaunchpadXDrumsLedFrame,
  createLaunchpadXTrackMuteLedMessages,
  getAdjacentLaunchpadXDrumsClipBar,
  getLaunchpadXDrumPreviewInstrument,
  getLaunchpadXDrumsClipBar,
  getLaunchpadXDrumStep,
  getLaunchpadXTrackIdForMuteCc,
  LAUNCHPAD_X_CAPTURE_MIDI_CC,
  LAUNCHPAD_X_DRUM_PREVIEW_NOTES,
  LAUNCHPAD_X_DRUM_STEP_ROWS,
  LAUNCHPAD_X_LED_COLORS,
  LAUNCHPAD_X_NEXT_CLIP_CC,
  LAUNCHPAD_X_PREVIOUS_CLIP_CC,
  LAUNCHPAD_X_STOP_CLIP_CC,
  LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK,
  LAUNCHPAD_X_TRACK_MUTE_LED_COLORS,
  normalizeDrumsClipBars,
};
