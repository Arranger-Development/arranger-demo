import { getMatrixBars } from '../domain/projectLength.js';
import {
  areSameDrumsInstruments,
  getDrumsCellInstruments,
  mergeDrumsCellInstrument,
} from '../domain/drumsCells.js';
import {
  DRUMS_INSTRUMENT_IDS,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';

const DRUMS_RECORDING_PHASES = Object.freeze({
  CONFIRM: 'confirm',
  COUNT_IN: 'count-in',
  IDLE: 'idle',
  RECORDING: 'recording',
});

const IDLE_DRUMS_RECORDING_STATE = Object.freeze({
  completedBars: [],
  countInBeat: null,
  currentBar: null,
  endBar: null,
  phase: DRUMS_RECORDING_PHASES.IDLE,
  startBar: null,
  totalBars: 0,
});

function createDrumsRecordingState(phase, overrides = {}) {
  return {
    ...IDLE_DRUMS_RECORDING_STATE,
    ...overrides,
    completedBars: [...(overrides.completedBars ?? [])],
    phase,
  };
}

function getDrumsRecordingContextTrackId({
  pendingSession,
  phase,
  session,
} = {}) {
  if (
    phase === DRUMS_RECORDING_PHASES.CONFIRM
    || phase === DRUMS_RECORDING_PHASES.COUNT_IN
  ) {
    return pendingSession?.trackId ?? null;
  }
  if (phase === DRUMS_RECORDING_PHASES.RECORDING) {
    return session?.trackId ?? null;
  }
  return null;
}

function getDrumsWriteBarRange(startBar, endBar = TOTAL_BARS - 1, totalBars = TOTAL_BARS) {
  if (
    !Number.isInteger(startBar)
    || !Number.isInteger(endBar)
    || startBar < 0
    || endBar >= totalBars
    || startBar > endBar
  ) {
    return [];
  }

  return Array.from(
    { length: endBar - startBar + 1 },
    (_, index) => startBar + index,
  );
}

function hasDrumsBarHits(matrix, bar) {
  if (!Number.isInteger(bar) || bar < 0 || bar >= getMatrixBars(matrix)) return false;
  return (matrix?.drums?.[bar] ?? []).some(
    (cell) => getDrumsCellInstruments(cell).length > 0,
  );
}

function hasDrumsHitsInRange(matrix, startBar, endBar) {
  return getDrumsWriteBarRange(startBar, endBar ?? getMatrixBars(matrix) - 1, getMatrixBars(matrix)).some(
    (bar) => hasDrumsBarHits(matrix, bar),
  );
}

function createDrumsLiveRecordPatch({
  activeTrackId,
  bar,
  currentCell,
  hasClip,
  instrument,
  isPlaying,
  phase,
  step,
  totalBars = TOTAL_BARS,
} = {}) {
  if (
    phase !== DRUMS_RECORDING_PHASES.RECORDING
    || !isPlaying
    || activeTrackId !== 'drums'
    || !Number.isInteger(bar)
    || bar < 0
    || bar >= totalBars
    || !Number.isInteger(step)
    || step < 0
    || step >= STEPS_PER_BAR
    || !DRUMS_INSTRUMENT_IDS.includes(instrument)
  ) {
    return null;
  }

  const currentInstruments = getDrumsCellInstruments(currentCell);
  const nextCell = mergeDrumsCellInstrument(currentCell, instrument);
  const shouldCreateClip = !hasClip;
  const shouldWriteCell = !areSameDrumsInstruments(
    currentInstruments,
    getDrumsCellInstruments(nextCell),
  );
  if (!shouldCreateClip && !shouldWriteCell) return null;

  return {
    bar,
    instrument,
    nextCell,
    shouldCreateClip,
    shouldWriteCell,
    step,
  };
}

function createDrumsLiveRecordSession() {
  let active = false;

  return {
    end() {
      active = false;
    },
    isActive() {
      return active;
    },
    record(action, withUndoCheckpoint) {
      if (typeof action !== 'function' || typeof withUndoCheckpoint !== 'function') {
        return false;
      }

      if (active) {
        action();
      } else {
        withUndoCheckpoint(action, { force: true });
        active = true;
      }
      return true;
    },
  };
}

export {
  createDrumsRecordingState,
  createDrumsLiveRecordPatch,
  createDrumsLiveRecordSession,
  DRUMS_RECORDING_PHASES,
  getDrumsRecordingContextTrackId,
  getDrumsWriteBarRange,
  hasDrumsBarHits,
  hasDrumsHitsInRange,
  IDLE_DRUMS_RECORDING_STATE,
};
