import { getTrackTypeFromInstanceId } from './trackInstances.js';

export function usesNaturalSampleTail(event) {
  const trackType = event.trackType ?? getTrackTypeFromInstanceId(event.trackId) ?? event.type ?? 'melody';
  // Melody's natural mode plays the complete sample. Authored note length still
  // belongs to the score/MIDI and must not turn that mode into a gated voice.
  return event.playbackMode === 'natural' && (trackType === 'melody' || !event.gateDuration);
}

// Optional expression on existing note/notes pitches, not a second pitch format.
export function expandNotePerformances(events, cell) {
  if (!cell?.notePerformances) return events;
  return events.flatMap(event => (event.notes ?? [event.note]).flatMap(note => {
    const performances = cell.notePerformances[note];
    const base = event.notes ? { ...event, notes: [note] } : event;
    if (!Array.isArray(performances) || !performances.length) return [base];
    return performances.filter(p => Number.isFinite(p.durationSteps) && p.durationSteps > 0).map(p => ({
      ...base, durationSteps: p.durationSteps, gateDuration: true,
      timingOffset: Number.isFinite(p.offsetSteps) ? p.offsetSteps : 0,
      velocity: Number.isFinite(p.velocity) ? p.velocity : event.velocity ?? 1,
    }));
  }));
}

export function withoutNotePerformance(cell, note, length, remove = true) {
  const notePerformances = { ...cell?.notePerformances };
  delete notePerformances[note];
  if (!remove) notePerformances[note] = [{ offsetSteps: 0, durationSteps: length, velocity: cell?.velocity ?? 1 }];
  if (!cell?.notePerformances && remove) return {};
  return { notePerformances };
}

export const noteDurationSteps = cell => Number.isFinite(cell?.durationSteps) && cell.durationSteps > 0
  ? cell.durationSteps : ({ '1n': 16, '2n': 8, '4n': 4, '8n': 2, '16n': 1 }[cell?.duration] ?? 1);

export const eventDuration = (event, bpm) => Number.isFinite(event.durationSteps) && event.durationSteps > 0
  ? event.durationSteps * 60 / bpm / 4 : event.duration ?? '16n';
