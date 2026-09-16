import { getMelodyScale } from '../data/melodyScales.js';

const MELODY_INPUT_SOURCES = Object.freeze({
  KEYBOARD: 'keyboard',
  LAUNCHPAD: 'launchpad',
  VIRTUAL: 'virtual',
});

const MELODY_INPUT_ROWS = Object.freeze([
  Object.freeze({
    id: 'high',
    octave: 5,
    launchpadNoteStart: 51,
    keyboardCodes: Object.freeze(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI']),
    keyboardLabels: Object.freeze(['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I']),
  }),
  Object.freeze({
    id: 'middle',
    octave: 4,
    launchpadNoteStart: 41,
    keyboardCodes: Object.freeze(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK']),
    keyboardLabels: Object.freeze(['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K']),
  }),
  Object.freeze({
    id: 'low',
    octave: 3,
    launchpadNoteStart: 31,
    keyboardCodes: Object.freeze(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma']),
    keyboardLabels: Object.freeze(['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',']),
  }),
]);

const MELODY_INPUT_VISIBLE_PHASES = new Set([
  'confirm',
  'count-in',
  'idle',
  'overview',
  'recording',
  'sequence-capture',
  'step-edit',
]);

const MELODY_INPUT_POSITION_BY_CODE = new Map();
const MELODY_INPUT_POSITION_BY_LAUNCHPAD_NOTE = new Map();

MELODY_INPUT_ROWS.forEach((row, rowIndex) => {
  row.keyboardCodes.forEach((code, column) => {
    const position = Object.freeze({ column, row, rowIndex });
    MELODY_INPUT_POSITION_BY_CODE.set(code, position);
    MELODY_INPUT_POSITION_BY_LAUNCHPAD_NOTE.set(row.launchpadNoteStart + column, position);
  });
});

function getMelodyInputNote(scaleId, rowIndex, column) {
  const row = MELODY_INPUT_ROWS[rowIndex];
  const pitchClass = getMelodyScale(scaleId).highlightedPitchClasses[column];
  if (!row || !pitchClass) return null;
  return `${pitchClass}${row.octave}`;
}

function createMelodyInputCell(position, scaleId) {
  if (!position) return null;
  const { column, row, rowIndex } = position;
  const note = getMelodyInputNote(scaleId, rowIndex, column);
  return {
    code: row.keyboardCodes[column],
    column,
    enabled: Boolean(note),
    keyLabel: row.keyboardLabels[column],
    launchpadNote: row.launchpadNoteStart + column,
    note,
    octave: row.octave,
    rowId: row.id,
    rowIndex,
  };
}

function getMelodyInputGrid(scaleId) {
  return MELODY_INPUT_ROWS.map((row, rowIndex) => (
    row.keyboardCodes.map((_code, column) => (
      createMelodyInputCell({ column, row, rowIndex }, scaleId)
    ))
  ));
}

function getMelodyInputCellByCode(code, scaleId) {
  return createMelodyInputCell(MELODY_INPUT_POSITION_BY_CODE.get(code), scaleId);
}

function getMelodyInputCellByLaunchpadNote(midiNote, scaleId) {
  return createMelodyInputCell(
    MELODY_INPUT_POSITION_BY_LAUNCHPAD_NOTE.get(midiNote),
    scaleId,
  );
}

function isMelodyInputKeyboardCode(code) {
  return MELODY_INPUT_POSITION_BY_CODE.has(code);
}

function isMelodyInputAreaVisible({ hasTemplate = false, phase = 'idle' } = {}) {
  if (!hasTemplate) return true;
  return MELODY_INPUT_VISIBLE_PHASES.has(phase);
}

function getKeyboardMelodyInputId(code) {
  return `keyboard:${code}`;
}

function getVirtualMelodyInputId(rowIndex, column, pointerId) {
  return `virtual:${rowIndex}:${column}:${pointerId}`;
}

function getLaunchpadMelodyInputId(midiNote) {
  return `launchpad:${midiNote}`;
}

export {
  getKeyboardMelodyInputId,
  getLaunchpadMelodyInputId,
  getMelodyInputCellByCode,
  getMelodyInputCellByLaunchpadNote,
  getMelodyInputGrid,
  getMelodyInputNote,
  getVirtualMelodyInputId,
  isMelodyInputAreaVisible,
  isMelodyInputKeyboardCode,
  MELODY_INPUT_ROWS,
  MELODY_INPUT_SOURCES,
};
