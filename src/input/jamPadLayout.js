// Physical coordinates shared by input decoding and LED output (Launchpad X).
const quadrants = [
  ['drums', 8, 1], ['chord', 8, 5],
  ['bass', 6, 1], ['melody', 6, 5],
];
export const JAM_TEMPLATE_PADS = Object.freeze(quadrants.flatMap(([trackId, topRow, leftColumn]) =>
  Array.from({ length: 8 }, (_, index) => Object.freeze({
    note: (topRow - Math.floor(index / 4)) * 10 + leftColumn + index % 4,
    trackId, index,
  }))));
export const JAM_PARAMETER_PADS = Object.freeze([
  ['reverb', 41], ['cutoff', 31], ['volume', 21],
].flatMap(([type, firstNote]) => Array.from({ length: 8 }, (_, index) =>
  Object.freeze({ note: firstNote + index, type, index }))));
export const JAM_MOMENTARY_PADS = Object.freeze([
  ...[4, 8, 16].map((division, index) => Object.freeze({ note: 11 + index, type: 'repeat', division })),
  ...[4, 8, 16, 32].map((value, index) => Object.freeze({ note: 14 + index, type: 'chopper', value })),
  Object.freeze({ note: 18, type: 'brake', value: 1 }),
]);
export const JAM_PAD_LAYOUT = Object.freeze([...JAM_TEMPLATE_PADS, ...JAM_PARAMETER_PADS, ...JAM_MOMENTARY_PADS]);
const byNote = new Map(JAM_PAD_LAYOUT.map(pad => [pad.note, pad]));
export function getJamPadBinding(note) { return byNote.get(note) ?? null; }
