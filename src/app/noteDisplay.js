// Ableton labels MIDI 60 as C3. Stored pitches and Tone.js still use C4.
// Use only at presentation boundaries; never feed this label to playback or saving.
export function formatNoteLabel(note) {
  if (typeof note !== 'string') return '';
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  return match ? `${match[1]}${Number(match[2]) - 1}` : note;
}
