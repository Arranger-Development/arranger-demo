import { DRUMS_INSTRUMENT_IDS } from './musicConstants.js';

const DRUMS_INSTRUMENT_SET = new Set(DRUMS_INSTRUMENT_IDS);
const DEFAULT_DRUM_HIT_VELOCITY = 1;
const DEFAULT_DRUM_TIMING_OFFSET = 0;
const MIN_DRUM_HIT_VELOCITY = 0.2;
const MAX_DRUM_TIMING_OFFSET = 0.45;
const MIN_DRUM_TIMING_OFFSET = -0.25;

function getDrumsCellInstruments(cell) {
  if (!cell) return [];

  // Keep supporting the legacy single-instrument cell shape while new code writes arrays.
  const instruments = Array.isArray(cell.instruments)
    ? cell.instruments
    : [cell.instrument].filter(Boolean);

  return instruments.filter((instrument) => DRUMS_INSTRUMENT_SET.has(instrument));
}

function normalizeDrumHitVelocity(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_DRUM_HIT_VELOCITY;
  return Math.min(1, Math.max(MIN_DRUM_HIT_VELOCITY, numericValue));
}

function normalizeDrumTimingOffset(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_DRUM_TIMING_OFFSET;
  return Math.min(MAX_DRUM_TIMING_OFFSET, Math.max(MIN_DRUM_TIMING_OFFSET, numericValue));
}

function getDrumsCellVelocity(cell, instrument) {
  if (!DRUMS_INSTRUMENT_SET.has(instrument)) return DEFAULT_DRUM_HIT_VELOCITY;
  return normalizeDrumHitVelocity(cell?.velocities?.[instrument]);
}

function getDrumsCellTimingOffset(cell, instrument) {
  if (!DRUMS_INSTRUMENT_SET.has(instrument)) return DEFAULT_DRUM_TIMING_OFFSET;
  return normalizeDrumTimingOffset(cell?.timingOffsets?.[instrument]);
}

function createDrumsCell(instruments, options = {}) {
  const selected = new Set(instruments.filter((instrument) => DRUMS_INSTRUMENT_SET.has(instrument)));
  const ordered = DRUMS_INSTRUMENT_IDS.filter((instrument) => selected.has(instrument));
  if (!ordered.length) return null;

  const velocities = Object.fromEntries(ordered.flatMap((instrument) => (
    Object.hasOwn(options.velocities ?? {}, instrument)
      ? [[instrument, normalizeDrumHitVelocity(options.velocities[instrument])]]
      : []
  )));
  const timingOffsets = Object.fromEntries(ordered.flatMap((instrument) => (
    Object.hasOwn(options.timingOffsets ?? {}, instrument)
      ? [[instrument, normalizeDrumTimingOffset(options.timingOffsets[instrument])]]
      : []
  )));

  const cell = { instruments: ordered };
  if (Object.keys(velocities).length) cell.velocities = velocities;
  if (Object.keys(timingOffsets).length) cell.timingOffsets = timingOffsets;
  return cell;
}

function getDrumsCellFeelOptions(cell) {
  return {
    timingOffsets: cell?.timingOffsets,
    velocities: cell?.velocities,
  };
}

function mergeDrumsCellInstrument(cell, instrument) {
  return createDrumsCell(
    [...getDrumsCellInstruments(cell), instrument],
    getDrumsCellFeelOptions(cell),
  );
}

function toggleDrumsCellInstrument(cell, instrument) {
  if (!DRUMS_INSTRUMENT_SET.has(instrument)) {
    return createDrumsCell(getDrumsCellInstruments(cell), getDrumsCellFeelOptions(cell));
  }

  const instruments = new Set(getDrumsCellInstruments(cell));
  if (instruments.has(instrument)) {
    instruments.delete(instrument);
  } else {
    instruments.add(instrument);
  }

  return createDrumsCell([...instruments], getDrumsCellFeelOptions(cell));
}

function areSameDrumsInstruments(left, right) {
  return left.length === right.length
    && left.every((instrument, index) => instrument === right[index]);
}

export {
  DEFAULT_DRUM_HIT_VELOCITY,
  DEFAULT_DRUM_TIMING_OFFSET,
  areSameDrumsInstruments,
  createDrumsCell,
  getDrumsCellInstruments,
  getDrumsCellTimingOffset,
  getDrumsCellVelocity,
  mergeDrumsCellInstrument,
  normalizeDrumHitVelocity,
  normalizeDrumTimingOffset,
  toggleDrumsCellInstrument,
};
