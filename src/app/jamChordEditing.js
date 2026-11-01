import { extractChordEvent } from '../audio/matrixPlaybackAdapter.js';
import { createPianoRollNotes } from '../data/pianoRollNotes.js';
import { CHORD_GRID_OCTAVES, isChordGridPitch } from '../domain/chordCells.js';
import { withoutNotePerformance } from '../domain/notePerformances.js';

export const JAM_CHORD_NOTES = createPianoRollNotes({ lowestOctave: Math.min(...CHORD_GRID_OCTAVES), octaveCount: CHORD_GRID_OCTAVES.length });

const durationSteps = duration => ({ '1n': 16, '2n': 8, '4n': 4, '8n': 2, '16n': 1 }[duration] ?? 1);

// Resolve exactly the pitches the playback adapter uses, including legacy chord tones.
export function jamChordNotes(cell, step) {
  const event = extractChordEvent(cell, 0, step);
  return [...new Set(event?.notes ?? [])].map(note => ({ note,
    durationSteps: Math.min(16 - step, cell?.notePerformances?.[note]?.reduce((length, p) => Math.max(length, p.offsetSteps + p.durationSteps), 0)
      || cell?.noteDurationSteps?.[note] || event.durationSteps || durationSteps(event.duration)),
  }));
}

export function jamChordRenderState(bar, step, note) {
  for (let startStep = step; startStep >= 0; startStep--) {
    const hit = jamChordNotes(bar?.[startStep], startStep).find(hit => hit.note === note);
    if (!hit) continue;
    if (startStep + hit.durationSteps <= step) continue;
    return { active: true, start: step === startStep, startStep, durationSteps: hit.durationSteps };
  }
  return { active: false, start: false, startStep: null, durationSteps: 0 };
}

// Only the changed start cell is converted. Other cells (and other notes' lengths) survive.
export function setJamChordNote(bar, step, note, length = 1, remove = false) {
  if (!Array.isArray(bar) || !Number.isInteger(step) || step < 0 || step >= 16 || !isChordGridPitch(note)) return bar;
  const hits = jamChordNotes(bar[step], step).filter(hit => hit.note !== note);
  if (!remove) hits.push({ note, durationSteps: Math.max(1, Math.min(16 - step, Math.round(Number(length) || 1))) });
  const next = [...bar];
  next[step] = hits.length ? { ...bar[step], type: 'notes', notes: hits.map(hit => hit.note),
    label: hits.map(hit => hit.note).join('/'), duration: '16n', durationSteps: 1,
    noteDurationSteps: Object.fromEntries(hits.map(hit => [hit.note, hit.note !== note ? bar[step]?.noteDurationSteps?.[hit.note] ?? hit.durationSteps : hit.durationSteps])),
    ...withoutNotePerformance(bar[step], note, hits.find(hit => hit.note === note)?.durationSteps, remove),
  } : null;
  return next;
}
