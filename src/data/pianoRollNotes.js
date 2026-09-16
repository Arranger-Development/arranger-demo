const PIANO_ROLL_NOTES_PER_OCTAVE = 12;
const PIANO_ROLL_OCTAVE_COUNT = 3;
const PIANO_ROLL_VISIBLE_ROWS = 12;

const PIANO_ROLL_PITCH_CLASSES_DESC = Object.freeze([
  'B',
  'A#',
  'A',
  'G#',
  'G',
  'F#',
  'F',
  'E',
  'D#',
  'D',
  'C#',
  'C',
]);

function createPianoRollNotes({
  lowestOctave,
  octaveCount = PIANO_ROLL_OCTAVE_COUNT,
}) {
  if (!Number.isInteger(lowestOctave)) {
    throw new TypeError('lowestOctave must be an integer');
  }
  if (!Number.isInteger(octaveCount) || octaveCount < 1) {
    throw new RangeError('octaveCount must be a positive integer');
  }

  const highestOctave = lowestOctave + octaveCount - 1;
  const notes = [];

  for (let octave = highestOctave; octave >= lowestOctave; octave -= 1) {
    PIANO_ROLL_PITCH_CLASSES_DESC.forEach((rootName) => {
      const note = `${rootName}${octave}`;
      notes.push(Object.freeze({
        label: note,
        note,
        rootName,
        octave,
        sharp: rootName.includes('#'),
        root: rootName === 'C',
      }));
    });
  }

  return Object.freeze(notes);
}

export {
  createPianoRollNotes,
  PIANO_ROLL_NOTES_PER_OCTAVE,
  PIANO_ROLL_OCTAVE_COUNT,
  PIANO_ROLL_PITCH_CLASSES_DESC,
  PIANO_ROLL_VISIBLE_ROWS,
};
