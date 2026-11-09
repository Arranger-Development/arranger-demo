import { CHORD_GRID_OCTAVES, isChordGridPitch } from '../domain/chordCells.js';

const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchNumber = note => Number(note.at(-1)) * 12 + pitches.indexOf(note.slice(0, -1));
const noteName = pitch => `${pitches[pitch % 12]}${Math.floor(pitch / 12)}`;
const lowest = 12 * Math.min(...CHORD_GRID_OCTAVES), highest = 12 * (Math.max(...CHORD_GRID_OCTAVES) + 1) - 1;
const inRange = pitch => pitch >= lowest && pitch <= highest;

function voiceMap(notes, level) {
  if (!notes || notes.length < 2 || !notes.every(isChordGridPitch)) return null;
  const sorted = notes.map(pitchNumber).sort((a, b) => a - b);
  const low = sorted[0], high = sorted.at(-1);
  // Generated chords have one voice per pitch class. Leave other shapes intact.
  if (new Set(sorted.map(pitch => pitch % 12)).size !== sorted.length) return null;
  const compact = (pitch, anchor, octave) => octave * 12 + anchor % 12 + ((pitch - anchor) % 12 + 12) % 12;
  const doubles = [[low, low - 12], [high, high + 12]].filter(([, pitch]) => inRange(pitch));
  if (level === 100 && !doubles.length) doubles.push([low, low + 12]);
  return new Map(sorted.map(pitch => {
    let target = pitch;
    if (level === 0) target = compact(pitch, low, 2);
    if (level === 20) target = compact(pitch, sorted[1], 3);
    if (level === 40) target = compact(pitch, low, 4);
    if (level === 80) target = doubles.find(([from]) => from === pitch)?.[1] ?? pitch;
    const layers = level === 100 ? doubles.filter(([from]) => from === pitch).map(([, extra]) => extra) : [];
    return [noteName(pitch), [target, ...layers].map(noteName)];
  }));
}

function revoice(cell, mapping) {
  if (!cell?.notes?.length) return cell;
  const voices = cell.notes.flatMap(note => (mapping.get(note) ?? [note]).map(pitch => [pitch, note]));
  voices.sort(([a], [b]) => pitchNumber(a) - pitchNumber(b));
  const notes = voices.map(([pitch]) => pitch);
  const remap = data => Object.fromEntries(voices.filter(([, original]) => Object.hasOwn(data, original))
    .map(([pitch, original]) => [pitch, data[original]]));
  return { ...cell, notes, label: notes.join('/'),
    ...(cell.notePerformances && { notePerformances: remap(cell.notePerformances) }),
    ...(cell.noteDurationSteps && { noteDurationSteps: remap(cell.noteDurationSteps) }),
  };
}

export function humChordVoicingBars(phrase, bars, level) {
  if (level === 60) return bars;
  const editedHalves = new Set((phrase.humEditedSteps ?? []).map(step => Math.floor(step / 8)));
  if (phrase.humSoundingRanges) {
    return bars.map((bar, index) => bar.map((cell, step) => {
      const mapping = !editedHalves.has(index * 2 + (step >> 3)) && voiceMap(cell?.notes, level);
      return mapping ? revoice(cell, mapping) : cell;
    }));
  }
  return bars.map((bar, index) => {
    // Read the source chord even when the rhythm knob spreads its notes across steps.
    const mappings = [0, 8].map((start, half) => editedHalves.has(index * 2 + half) ? null
      : voiceMap(phrase.bars[index].slice(start, start + 8).find(cell => cell?.notes?.length)?.notes, level));
    return bar.map((cell, step) => mappings[step >> 3] ? revoice(cell, mappings[step >> 3]) : cell);
  });
}
