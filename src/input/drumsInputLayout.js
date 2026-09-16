const DRUM_INPUT_CELLS = Object.freeze([
  Object.freeze({
    instrument: 'kick',
    keyCode: 'KeyA',
    keyLabel: 'A',
    label: 'Kick',
  }),
  Object.freeze({
    instrument: 'snare',
    keyCode: 'KeyS',
    keyLabel: 'S',
    label: 'Snare',
  }),
  Object.freeze({
    instrument: 'hihat',
    keyCode: 'KeyD',
    keyLabel: 'D',
    label: 'Hi-Hat',
  }),
]);

const DRUM_INSTRUMENT_BY_KEYBOARD_CODE = Object.freeze(
  Object.fromEntries(
    DRUM_INPUT_CELLS.map(({ instrument, keyCode }) => [keyCode, instrument]),
  ),
);

function getDrumsInstrumentByKeyboardCode(code) {
  return DRUM_INSTRUMENT_BY_KEYBOARD_CODE[code] ?? null;
}

export {
  DRUM_INPUT_CELLS,
  getDrumsInstrumentByKeyboardCode,
};
