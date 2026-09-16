# Melody Chromatic Octave Implementation Plan

## Goal

Replace scale-remapped Melody keys with a fixed C4-B4 chromatic keyboard while retaining a scrollable three-octave shared Bass piano roll that opens on C4-B4.

## Tasks

### Task 1: Lock the data and keyboard contract

- [x] Update focused Melody and keyboard-command tests to expect twelve notes and fixed keys.
- [x] Run the focused tests and confirm the old mapping fails.
- [x] Implement the octave, scale-tone helpers, preview notes, and fixed key aliases.
- [x] Re-run the focused tests.

### Task 2: Add shared scale highlighting

- [x] Add UI and CSS assertions for dynamic row count and all three highlight surfaces.
- [x] Extend `PianoRoll` with an optional highlight set and note-derived row count.
- [x] Wire Melody cards, keys, and roll to the same scale data without changing Bass defaults.
- [x] Run Melody, piano-roll, and UI tests.

### Task 3: Keep the tutorial musical examples valid

- [x] Convert tutorial key strings from the old pentatonic mapping to the fixed chromatic keys.
- [x] Update tutorial runtime and copy expectations.
- [x] Run the tutorial tests.

### Task 4: Verify the complete change

- [x] Run `npm test`, `npm run lint`, and `npm run build`.
- [x] Check both scale templates, all twelve keys, accidental-note editing, and the unchanged Bass roll in the browser.

### Task 5: Restore the clarified scrollable Melody range

- [x] Update focused tests so Melody keeps 36 semitone rows from B5 to C3.
- [x] Keep `initialTopNote: B4`, making B4-C4 the default twelve-row window.
- [x] Preserve fixed C4-B4 computer-key mapping and scale previews.
- [x] Verify wheel scrolling keeps the Melody note rail and all four beat grids synchronized.
