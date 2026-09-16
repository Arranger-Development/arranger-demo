import { createPianoRollNotes } from './pianoRollNotes.js';
import { MELODY_STYLE_TEMPLATES } from './melodyStyleTemplates.js';

const MELODY_PITCH_CLASSES = Object.freeze([
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]);
const MELODY_KEY_NOTES = Object.freeze(MELODY_PITCH_CLASSES.map((pitchClass) => `${pitchClass}4`));

const MELODY_SCALES = MELODY_STYLE_TEMPLATES;

const MELODY_SCALE_IDS = Object.freeze(Object.keys(MELODY_SCALES));

const MELODY_NOTES = createPianoRollNotes({ lowestOctave: 3 });
const MELODY_NOTE_IDS = Object.freeze(MELODY_NOTES.map(({ note }) => note));

function getMelodyScale(scaleId) {
  return MELODY_SCALES[scaleId] ?? MELODY_SCALES.chinese;
}

function isMelodyScalePitchClass(scaleId, pitchClass) {
  return getMelodyScale(scaleId).highlightedPitchClasses.includes(pitchClass);
}

function getMelodyScalePreviewNotes(scaleId) {
  return MELODY_KEY_NOTES.filter((note, index) => (
    isMelodyScalePitchClass(scaleId, MELODY_PITCH_CLASSES[index])
  ));
}

function getMelodyScaleNoteIds(scaleId) {
  return MELODY_NOTES
    .filter(({ rootName }) => isMelodyScalePitchClass(scaleId, rootName))
    .map(({ note }) => note);
}

function isMelodyNoteInScale(scaleId, note) {
  const pitchClass = /^([A-G]#?)\d$/.exec(note)?.[1];
  return Boolean(pitchClass && isMelodyScalePitchClass(scaleId, pitchClass));
}

function formatMelodyNoteParts(note) {
  const [, name, octave] = /^([A-G]#?)(\d)$/.exec(note) ?? [];
  return {
    name: name ?? note,
    octave: octave ?? '',
  };
}

export {
  formatMelodyNoteParts,
  getMelodyScale,
  getMelodyScaleNoteIds,
  getMelodyScalePreviewNotes,
  isMelodyNoteInScale,
  isMelodyScalePitchClass,
  MELODY_NOTES,
  MELODY_NOTE_IDS,
  MELODY_PITCH_CLASSES,
  MELODY_SCALES,
  MELODY_SCALE_IDS,
};
