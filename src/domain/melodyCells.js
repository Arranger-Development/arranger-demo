import { MELODY_NOTE_IDS } from '../data/melodyScales.js';

const validNotes = new Set(MELODY_NOTE_IDS);

function normalizeNotes(notes) {
  return [...new Set((Array.isArray(notes) ? notes : []).filter((note) => validNotes.has(note)))];
}

// Keep the existing single-note format; only simultaneous pitches need an array.
export function getMelodyCellNotes(cell) {
  if (cell?.type !== 'melody') return [];
  return normalizeNotes(Array.isArray(cell.notes) ? cell.notes : [cell.note]);
}

export function createMelodyCellFromNotes(notes, metadata = {}) {
  const pitches = normalizeNotes(notes);
  if (!pitches.length) return null;
  const cell = { ...metadata, type: 'melody' };
  delete cell.note;
  delete cell.notes;
  return pitches.length === 1
    ? { ...cell, note: pitches[0] }
    : { ...cell, notes: pitches };
}
