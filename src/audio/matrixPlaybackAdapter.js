import {
  CHORD_SPAN,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';
import { BASS_NOTE_IDS } from '../data/bassNotes.js';
import {
  getDrumsCellInstruments,
  getDrumsCellTimingOffset,
  getDrumsCellVelocity,
} from '../domain/drumsCells.js';
import {
  createChordTonePitches,
  getChordCellNotes,
  getChordDefinition,
  getChordRemovedTonePitches,
  getChordNoteOctave,
  getChordNotePitch,
  getChordToneRoots,
} from '../domain/chordCells.js';
import { isValidMelodyNote } from '../app/melodyActions.js';
import { getTrackTypeFromInstanceId } from '../domain/trackInstances.js';

const PLAYBACK_TRACK_TYPE_ORDER = Object.freeze(['drums', 'bass', 'chord', 'melody']);

function normalizeMatrixSource(matrixSource) {
  return typeof matrixSource === 'function' ? matrixSource : () => matrixSource;
}

function extractDrumsInstruments(cell) {
  return getDrumsCellInstruments(cell);
}

function createDrumsEvent(bar, step, instrument, cell) {
  const event = {
    type: 'drums',
    trackId: 'drums',
    bar,
    step,
    instrument,
  };
  const timingOffset = getDrumsCellTimingOffset(cell, instrument);
  const velocity = getDrumsCellVelocity(cell, instrument);
  if (timingOffset !== 0) event.timingOffset = timingOffset;
  if (velocity !== 1) event.velocity = velocity;
  return event;
}

function createNotesFromToneRoots(root, toneRoots, tonePitches = null) {
  return createChordTonePitches(root, toneRoots, tonePitches);
}

function createChordNotes(root) {
  const definition = getChordDefinition(root);
  if (!definition) return [];

  return createNotesFromToneRoots(definition.root, definition.toneRoots, definition.tonePitches);
}

function createSingleNotes(noteRoots) {
  if (!noteRoots.length) return [];

  const hasExplicitOctave = noteRoots.some((noteRoot) => getChordNoteOctave(noteRoot) !== null);
  if (!hasExplicitOctave) return createNotesFromToneRoots(noteRoots[0], noteRoots);

  return noteRoots.map((noteRoot) => getChordNotePitch(noteRoot)).filter(Boolean);
}

function withChordFeel(event, cell) {
  if (Number.isFinite(cell?.timingOffset) && cell.timingOffset !== 0) {
    event.timingOffset = cell.timingOffset;
  }
  if (Number.isFinite(cell?.velocity) && cell.velocity !== 1) {
    event.velocity = cell.velocity;
  }
  return event;
}

function createChordNotesWithAddedNotes(root, toneRoots, addedNotes, removedTonePitches = [], tonePitches = null) {
  const legacyAddedNotes = addedNotes.filter((note) => getChordNoteOctave(note) === null);
  const exactAddedNotes = addedNotes
    .filter((note) => getChordNoteOctave(note) !== null)
    .map((note) => getChordNotePitch(note))
    .filter(Boolean);
  const removedPitches = new Set(removedTonePitches);

  return [
    ...createNotesFromToneRoots(root, toneRoots, tonePitches).filter((note) => !removedPitches.has(note)),
    ...createNotesFromToneRoots(root, legacyAddedNotes),
    ...exactAddedNotes,
  ];
}

function isChordTriggerStep(step) {
  return Number.isInteger(step) && step % CHORD_SPAN === 0;
}

function isGrooveChordHit(cell) {
  return cell?.type === 'chord' && cell.grooveTemplateId && cell.duration === '16n';
}

function extractChordEvent(cell, bar, step) {
  if (!cell) return null;

  if (cell.type === 'note' || cell.type === 'notes') {
    const noteRoots = getChordCellNotes(cell);
    const notes = createSingleNotes(noteRoots);
    if (!notes.length) return null;

    return withChordFeel({
      type: 'chord',
      trackId: 'chord',
      bar,
      step,
      root: null,
      quality: 'notes',
      label: cell.label ?? noteRoots.join('/'),
      notes,
      duration: '16n',
    }, cell);
  }

  const isChordLike = cell.type === 'chord' || (!cell.type && (cell.root || cell.label));
  if (!isChordLike) return null;

  const addedNotes = getChordCellNotes(cell);
  if (isGrooveChordHit(cell)) {
    const toneRoots = cell.toneRoots ?? getChordToneRoots(cell.label ?? cell.root);
    const notes = createChordNotesWithAddedNotes(
      cell.root,
      toneRoots,
      addedNotes,
      getChordRemovedTonePitches(cell),
      cell.tonePitches,
    );
    if (!notes.length) return null;

    return withChordFeel({
      type: 'chord',
      trackId: 'chord',
      bar,
      step,
      root: cell.root,
      quality: cell.quality ?? 'maj',
      label: cell.label ?? cell.root,
      notes,
      duration: cell.duration,
    }, cell);
  }

  if (!isChordTriggerStep(step)) {
    const notes = createSingleNotes(addedNotes);
    if (!notes.length) return null;

    return withChordFeel({
      type: 'chord',
      trackId: 'chord',
      bar,
      step,
      root: null,
      quality: 'notes',
      label: addedNotes.join('/'),
      notes,
      duration: '16n',
    }, cell);
  }

  const toneRoots = cell.toneRoots ?? getChordToneRoots(cell.label ?? cell.root);
  const notes = createChordNotesWithAddedNotes(
    cell.root,
    toneRoots,
    addedNotes,
    getChordRemovedTonePitches(cell),
    cell.tonePitches,
  );
  if (!notes.length) return null;

  return withChordFeel({
    type: 'chord',
    trackId: 'chord',
    bar,
    step,
    root: cell.root,
    quality: cell.quality ?? 'maj',
    label: cell.label ?? cell.root,
    notes,
    duration: '4n',
  }, cell);
}

function extractMelodyEvent(cell, bar, step) {
  if (cell?.type !== 'melody' || !isValidMelodyNote(cell.note)) return null;

  const event = {
    type: 'melody',
    trackId: 'melody',
    bar,
    step,
    note: cell.note,
    duration: cell.duration ?? '16n',
  };
  if (Number.isInteger(cell.durationSteps)) event.durationSteps = cell.durationSteps;
  if (cell.timbreId) event.timbreId = cell.timbreId;
  return event;
}

function extractBassEvent(cell, bar, step) {
  if (!cell || !BASS_NOTE_IDS.includes(cell.note)) return null;

  return {
    type: 'bass',
    trackId: 'bass',
    bar,
    step,
    note: cell.note,
    duration: cell.duration ?? '16n',
  };
}

function createMatrixPlaybackAdapter(matrixSource, options = {}) {
  const readMatrix = normalizeMatrixSource(matrixSource);
  const totalBars = options.totalBars ?? TOTAL_BARS;
  const stepsPerBar = options.stepsPerBar ?? STEPS_PER_BAR;
  const totalSteps = totalBars * stepsPerBar;

  function getPositionForFlatStep(flatStep) {
    const normalizedStep = ((flatStep % totalSteps) + totalSteps) % totalSteps;

    return {
      bar: Math.floor(normalizedStep / stepsPerBar),
      step: normalizedStep % stepsPerBar,
    };
  }

  function getEventsForStep(bar, step) {
    const source = readMatrix();
    const matrix = source?.matrix ?? source;
    const instanceAware = Boolean(source?.matrix);
    const trackInstancesById = source?.trackInstancesById ?? null;
    const trackOrder = source?.trackOrder ?? PLAYBACK_TRACK_TYPE_ORDER;

    return PLAYBACK_TRACK_TYPE_ORDER.flatMap((trackType) => (
      trackOrder
        .filter((trackId) => (
          trackInstancesById?.[trackId]?.type
          ?? getTrackTypeFromInstanceId(trackId)
        ) === trackType)
        .flatMap((trackId) => {
          const cell = matrix?.[trackId]?.[bar]?.[step] ?? null;
          let events = [];
          if (trackType === 'drums') {
            events = extractDrumsInstruments(cell).map((instrument) => (
              createDrumsEvent(bar, step, instrument, cell)
            ));
          } else if (trackType === 'bass') {
            const event = extractBassEvent(cell, bar, step);
            if (event) events = [event];
          } else if (trackType === 'chord') {
            const event = extractChordEvent(cell, bar, step);
            if (event) events = [event];
          } else if (trackType === 'melody') {
            const event = extractMelodyEvent(cell, bar, step);
            if (event) events = [event];
          }

          return events.map((event) => (instanceAware ? {
            ...event,
            trackId,
            trackType,
          } : event));
        })
    ));
  }

  return {
    getEventsForFlatStep: (flatStep) => {
      const { bar, step } = getPositionForFlatStep(flatStep);

      return getEventsForStep(bar, step);
    },
    getEventsForStep,
    getPositionForFlatStep,
    stepsPerBar,
    totalBars,
    totalSteps,
  };
}

export {
  createChordNotes,
  createMatrixPlaybackAdapter,
  extractBassEvent,
  extractChordEvent,
  extractDrumsInstruments,
  extractMelodyEvent,
};
