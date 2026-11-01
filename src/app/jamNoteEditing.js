import { BASS_NOTES, BASS_NOTE_IDS } from '../data/bassNotes.js';
import { MELODY_NOTES, MELODY_NOTE_IDS } from '../data/melodyScales.js';
import { getMelodyCellNotes, createMelodyCellFromNotes } from '../domain/melodyCells.js';
import { noteDurationSteps, withoutNotePerformance } from '../domain/notePerformances.js';
import { JAM_CHORD_NOTES, jamChordNotes, setJamChordNote } from './jamChordEditing.js';

export const jamEditorNotes = track => track === 'chord' ? JAM_CHORD_NOTES : track === 'bass' ? BASS_NOTES : MELODY_NOTES;

export function jamPitchedNotes(cell, step, track) {
  if (track === 'chord') return jamChordNotes(cell, step);
  const notes = track === 'bass' ? [cell?.note].filter(note => BASS_NOTE_IDS.includes(note)) : getMelodyCellNotes(cell);
  return notes.map(note => ({ note, durationSteps: Math.min(16 - step,
    cell?.notePerformances?.[note]?.reduce((length, p) => Math.max(length, p.offsetSteps + p.durationSteps), 0)
    || cell?.noteDurationSteps?.[note] || noteDurationSteps(cell)) }));
}

export function jamPitchedRenderState(bar, step, note, track) {
  for (let startStep = step; startStep >= 0; startStep--) {
    const hit = jamPitchedNotes(bar?.[startStep], startStep, track).find(hit => hit.note === note);
    if (hit && startStep + hit.durationSteps > step) return { active: true, start: step === startStep, startStep, durationSteps: hit.durationSteps };
  }
  return { active: false, start: false, startStep: null, durationSteps: 0 };
}

export function setJamPitchedNote(bar, step, note, length = 1, remove = false, track = 'chord') {
  if (track === 'chord') return setJamChordNote(bar, step, note, length, remove);
  const valid = track === 'bass' ? BASS_NOTE_IDS : MELODY_NOTE_IDS;
  if (!Array.isArray(bar) || !Number.isInteger(step) || step < 0 || step >= 16 || !valid.includes(note)) return bar;
  const duration = Math.max(1, Math.min(16 - step, Math.round(Number(length) || 1)));
  const next = [...bar], previous = bar[step];
  if (track === 'bass') {
    next[step] = remove ? null : { ...previous, type: 'bass', note, durationSteps: duration,
      noteDurationSteps: { [note]: duration }, notePerformances: { [note]: [{ offsetSteps: 0, durationSteps: duration, velocity: previous?.velocity ?? 1 }] }, timingOffset: 0 };
    if (next[step]) delete next[step].notes;
  } else {
    const notes = getMelodyCellNotes(previous).filter(p => p !== note);
    if (!remove) notes.push(note);
    const durations = { ...previous?.noteDurationSteps };
    // Retain the lengths of untouched legacy pitches before assigning the edited one.
    for (const hit of jamPitchedNotes(previous, step, track)) durations[hit.note] ??= hit.durationSteps;
    if (remove) delete durations[note]; else durations[note] = duration;
    next[step] = createMelodyCellFromNotes(notes, { ...previous, duration: '16n', noteDurationSteps: durations, ...withoutNotePerformance(previous, note, duration, remove) });
  }
  return next;
}
