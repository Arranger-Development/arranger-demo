import { MELODY_NOTE_IDS } from '../data/melodyScales.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { createMelodyCellFromNotes, getMelodyCellNotes } from '../domain/melodyCells.js';

function isValidMelodyNote(note) {
  return MELODY_NOTE_IDS.includes(note);
}

function normalizeMelodyDurationSteps(durationSteps, maxDurationSteps = STEPS_PER_BAR) {
  if (!Number.isFinite(durationSteps)) return 1;
  return Math.max(1, Math.min(maxDurationSteps, Math.round(durationSteps)));
}

function createMelodyCell(note, durationSteps = 1) {
  if (!isValidMelodyNote(note)) return null;
  const normalizedDuration = normalizeMelodyDurationSteps(durationSteps);
  return normalizedDuration === 1
    ? { type: 'melody', note }
    : { type: 'melody', note, durationSteps: normalizedDuration };
}

function cloneMelodyMatrix(matrix) {
  return {
    ...matrix,
    melody: matrix.melody.map((bar) => [...bar]),
  };
}

function isMelodyCellActive(matrix, bar, step, note) {
  return getMelodyCellNotes(matrix?.melody?.[bar]?.[step]).includes(note);
}

function getMelodyCellDurationSteps(cell, startStep = 0) {
  if (cell?.type !== 'melody') return 0;
  return normalizeMelodyDurationSteps(
    cell.durationSteps ?? ({ '1n': 16, '2n': 8, '4n': 4, '8n': 2 }[cell.duration] ?? 1),
    STEPS_PER_BAR - startStep,
  );
}

function getMelodyCellRenderState(matrix, bar, step, note) {
  const melodyBar = matrix?.melody?.[bar];
  if (!Array.isArray(melodyBar) || !Number.isInteger(step)) {
    return { active: false, durationSteps: 0, start: false, startStep: null };
  }

  for (let startStep = step; startStep >= 0; startStep -= 1) {
    const cell = melodyBar[startStep];
    if (!getMelodyCellNotes(cell).includes(note)) continue;
    const durationSteps = getMelodyCellDurationSteps(cell, startStep);
    if (startStep + durationSteps <= step) continue;
    return {
      active: true,
      durationSteps,
      start: startStep === step,
      startStep,
    };
  }

  return { active: false, durationSteps: 0, start: false, startStep: null };
}

function setMelodyCell(matrix, bar, step, note, durationSteps = 1) {
  if (!matrix?.melody?.[bar] || !Number.isInteger(step) || step < 0 || step >= STEPS_PER_BAR) {
    return matrix;
  }

  const cell = createMelodyCell(note, normalizeMelodyDurationSteps(
    durationSteps,
    STEPS_PER_BAR - step,
  ));
  if (!cell) return matrix;

  const nextMatrix = cloneMelodyMatrix(matrix);
  const previous = matrix.melody[bar][step];
  const timbreId = previous?.timbreId ?? matrix.melody[bar].find((note) => note?.timbreId)?.timbreId;
  nextMatrix.melody[bar][step] = {
    ...cell,
    ...(timbreId ? { timbreId } : {}),
    ...(Number.isFinite(previous?.velocity) ? { velocity: previous.velocity } : {}),
  };
  return nextMatrix;
}

function setMelodyCellDuration(matrix, bar, step, durationSteps) {
  const cell = matrix?.melody?.[bar]?.[step];
  const notes = getMelodyCellNotes(cell);
  if (!notes.length || !Number.isInteger(step) || step < 0 || step >= STEPS_PER_BAR) return matrix;
  const nextMatrix = cloneMelodyMatrix(matrix);
  nextMatrix.melody[bar][step] = createMelodyCellFromNotes(notes, {
    ...cell,
    durationSteps: normalizeMelodyDurationSteps(durationSteps, STEPS_PER_BAR - step),
  });
  return nextMatrix;
}

function toggleMelodyCell(matrix, bar, step, note) {
  if (!matrix?.melody?.[bar] || !Number.isInteger(step) || step < 0 || step >= STEPS_PER_BAR
    || !isValidMelodyNote(note)) {
    return matrix;
  }

  const previous = matrix.melody[bar][step];
  const notes = getMelodyCellNotes(previous);
  const nextNotes = notes.includes(note) ? notes.filter((pitch) => pitch !== note) : [...notes, note];
  const timbreId = previous?.timbreId ?? matrix.melody[bar].find((cell) => cell?.timbreId)?.timbreId;
  const nextMatrix = cloneMelodyMatrix(matrix);
  nextMatrix.melody[bar][step] = createMelodyCellFromNotes(nextNotes, {
    ...previous,
    ...(timbreId ? { timbreId } : {}),
  });
  return nextMatrix;
}

function getMelodyCellToggleResult(matrix, bar, step, note) {
  const removingExistingNote = isMelodyCellActive(matrix, bar, step, note);
  const nextMatrix = toggleMelodyCell(matrix, bar, step, note);
  const nextCell = nextMatrix?.melody?.[bar]?.[step];

  return {
    auditionNote: !removingExistingNote && getMelodyCellNotes(nextCell).includes(note)
      ? note
      : null,
    nextMatrix,
  };
}

function clearMelodyBar(matrix, bar) {
  if (!matrix?.melody?.[bar]) return matrix;

  const nextMatrix = cloneMelodyMatrix(matrix);
  nextMatrix.melody[bar] = nextMatrix.melody[bar].map(() => null);
  return nextMatrix;
}

function replaceMelodyBarWithSequence(matrix, bar, steps, notes) {
  if (!matrix?.melody?.[bar] || !Array.isArray(steps) || !Array.isArray(notes)) {
    return matrix;
  }
  if (steps.length === 0 || steps.length !== notes.length) return matrix;
  if (steps.some((step) => (
    !Number.isInteger(step) || step < 0 || step >= STEPS_PER_BAR
  ))) return matrix;
  if (notes.some((note) => !isValidMelodyNote(note))) return matrix;

  let nextMatrix = clearMelodyBar(matrix, bar);
  steps.forEach((step, index) => {
    nextMatrix = setMelodyCell(nextMatrix, bar, step, notes[index], 1);
  });
  return nextMatrix;
}

export {
  clearMelodyBar,
  createMelodyCell,
  getMelodyCellToggleResult,
  getMelodyCellDurationSteps,
  getMelodyCellRenderState,
  isMelodyCellActive,
  isValidMelodyNote,
  normalizeMelodyDurationSteps,
  replaceMelodyBarWithSequence,
  setMelodyCell,
  setMelodyCellDuration,
  toggleMelodyCell,
};
