// Physical coordinates shared by input decoding and LED output (Launchpad X).
const phraseRows = [
  ['drums', 8], ['chord', 7], ['bass', 6], ['melody', 5],
];
export const JAM_TEMPLATE_PADS = Object.freeze(phraseRows.flatMap(([trackId, row]) =>
  Array.from({ length: 8 }, (_, index) => Object.freeze({
    note: row * 10 + index + 1,
    trackId, index,
  }))));
export const JAM_COLUMN_PADS = Object.freeze(Array.from({ length: 8 }, (_, index) =>
  Object.freeze({ note: 41 + index, type: 'launchColumn', index })));
export const JAM_MOMENTARY_PADS = Object.freeze([
  ...[4, 8, 16].map((division, index) => Object.freeze({ note: 11 + index, type: 'repeat', division })),
  ...[4, 8, 16, 32].map((value, index) => Object.freeze({ note: 14 + index, type: 'chopper', value })),
  Object.freeze({ note: 18, type: 'brake', value: 1 }),
]);
export const JAM_PAD_LAYOUT = Object.freeze([...JAM_TEMPLATE_PADS, ...JAM_COLUMN_PADS, ...JAM_MOMENTARY_PADS]);
const byNote = new Map(JAM_PAD_LAYOUT.map(pad => [pad.note, pad]));
export function getJamPadBinding(note) { return byNote.get(note) ?? null; }
