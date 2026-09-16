import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { createPianoRollNotes } from './pianoRollNotes.js';

const BASS_NOTES = createPianoRollNotes({ lowestOctave: 0 });

const BASS_NOTE_IDS = Object.freeze(BASS_NOTES.map((note) => note.note));

const BASS_COLUMNS = STEPS_PER_BAR;

export { BASS_NOTES, BASS_NOTE_IDS, BASS_COLUMNS };
