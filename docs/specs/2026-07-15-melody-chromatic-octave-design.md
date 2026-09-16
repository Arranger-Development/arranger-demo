# Melody Chromatic Octave Design

## User Experience

The Melody editor initially displays the C4-B4 octave with B4 at the top and C4 at the bottom, matching the shared Bass piano-roll direction. The roll can scroll upward to B5 and downward to C3. The keyboard strip displays twelve fixed C4-B4 keys in ascending pitch order. Major highlights C, D, E, F, G, A, and B; pentatonic highlights C, D, E, G, and A. Non-scale tones remain interactive.

## Data and State

Melody note IDs contain the three-octave B5-C3 roll. Computer-key mapping remains fixed to C4-B4 and independent of `melodyScaleId`; `=` aliases the displayed `+` key. Scale definitions store highlighted pitch classes, from which UI highlight sets across all octaves and C4-B4 preview sequences are derived. Selecting a scale continues to update only `melodyScaleId`.

## Components or Modules

- Melody scale data owns the three-octave roll, fixed C4-B4 key map, scale tones, and preview-note derivation.
- `MelodyEditor` renders the twelve-key strip and passes active scale notes to the shared `PianoRoll`.
- `PianoRoll` accepts an optional highlight set and derives its CSS row count from `notes.length`; Bass and Melody both keep 36-note inputs, twelve visible rows, and synchronized pitch scrolling.

## Edge Cases

- Invalid keys and notes return no command or cell.
- `+` and `=` address the same B4 key.
- Played and recorded states remain visually stronger than scale guidance.
- Tutorial locking and disabled cells preserve their current behavior.
- Melody starts at `initialTopNote: B4`; Bass starts at `initialTopNote: D1`.
- Native non-passive wheel handling keeps note-rail and beat-grid pitch scrolling synchronized without React passive-listener errors.

## Non-Goals

No new Melody-only roll, separate octave selector, transposition, or matrix migration is introduced.

## Test Strategy

Cover scale data, the B4-C4 default window, B5-C3 validation and playback, synchronized shared-roll scrolling, highlight wiring, tutorial key conversion, full regression checks, and a browser smoke test.
