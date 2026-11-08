import { BASS_NOTES, BASS_NOTE_IDS } from '../data/bassNotes.js';
import { MELODY_NOTES, MELODY_NOTE_IDS } from '../data/melodyScales.js';
import { getMelodyCellNotes, createMelodyCellFromNotes } from '../domain/melodyCells.js';
import { noteDurationSteps, withoutNotePerformance } from '../domain/notePerformances.js';
import { JAM_CHORD_NOTES, jamChordNotes, setJamChordNote } from './jamChordEditing.js';

export const jamEditorNotes = track => track === 'chord' ? JAM_CHORD_NOTES : track === 'bass' ? BASS_NOTES : MELODY_NOTES;

export function jamPitchedNotes(cell, step, track, maxLength = 16 - step) {
  if (track === 'chord') return jamChordNotes(cell, step);
  const notes = track === 'bass' ? [cell?.note].filter(note => BASS_NOTE_IDS.includes(note)) : getMelodyCellNotes(cell);
  return notes.map(note => ({ note, durationSteps: Math.min(maxLength,
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

export function jamMelodyRenderState(bars, bar, step, note) {
  const absolute = bar * 16 + step;
  for (let start = absolute; start >= 0; start--) {
    const startBar = Math.floor(start / 16), startStep = start % 16;
    const hit = jamPitchedNotes(bars[startBar]?.[startStep], startStep, 'melody', Infinity).find(item => item.note === note);
    if (hit && start + hit.durationSteps > absolute) {
      return { active: true, start: start === absolute, startBar, startStep, durationSteps: hit.durationSteps };
    }
  }
  return { active: false, start: false, startStep: null, durationSteps: 0 };
}

export function setJamPitchedNote(bar, step, note, length = 1, remove = false, track = 'chord', maxLength = 16 - step) {
  if (track === 'chord') return setJamChordNote(bar, step, note, length, remove);
  const valid = track === 'bass' ? BASS_NOTE_IDS : MELODY_NOTE_IDS;
  if (!Array.isArray(bar) || !Number.isInteger(step) || step < 0 || step >= 16 || !valid.includes(note)) return bar;
  const duration = Math.max(1, Math.min(maxLength, Math.round(Number(length) || 1)));
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
    for (const hit of jamPitchedNotes(previous, step, track, maxLength)) durations[hit.note] ??= hit.durationSteps;
    if (remove) delete durations[note]; else durations[note] = duration;
    next[step] = createMelodyCellFromNotes(notes, { ...previous, duration: '16n', noteDurationSteps: durations, ...withoutNotePerformance(previous, note, duration, remove) });
  }
  return next;
}

export function resizeJamPitchedNote(bar, step, note, length, track, maxLength) {
  const next = setJamPitchedNote(bar, step, note, length, false, track, maxLength);
  if (next === bar) return next;
  const hits = bar[step]?.notePerformances?.[note];
  if (!hits?.length) return next;
  const end = hit => (hit.offsetSteps ?? 0) + hit.durationSteps;
  const tail = hits.reduce((latest, hit) => end(hit) >= end(latest) ? hit : latest);
  const targetEnd = next[step].noteDurationSteps[note];
  // Resize the final release without re-quantizing a recorded attack or losing repeats.
  next[step].notePerformances[note] = hits.map(hit => hit === tail ? {
    ...hit, durationSteps: Math.max(0.05, targetEnd - (hit.offsetSteps ?? 0)),
  } : hit);
  return next;
}
