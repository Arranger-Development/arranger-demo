# Melody Chromatic Octave Idea

## Background

The Melody editor remapped its computer keys when the selected scale changed. This made the same key produce different notes and hid the relationship between a scale and the complete chromatic octave.

## User Goal

Open on the C4-B4 chromatic octave, keep the roll vertically scrollable like Bass, and use scale templates as visual and listening guides.

## Core Scenario

The user opens Melody, sees all twelve C4-B4 semitones, selects a major or pentatonic template, and can immediately distinguish the scale tones without losing access to other notes or octaves.

## Must Have

- Reuse the shared Bass `PianoRoll`.
- Keep a three-octave B5-C3 editing range and default the visible window to B4-C4.
- Preserve synchronized vertical scrolling across the note rail and all beat grids.
- Map `1 2 3 4 5 6 7 8 9 0 - +` to C4-B4.
- Highlight the selected scale in the template card, keyboard strip, and piano roll.
- Keep every semitone playable and editable.

## Not Yet

- A dedicated octave-switching control outside the shared roll.
- Transposing templates away from C.
- Migrating persisted compositions; the app does not persist the matrix.

## Success Criteria

Melody shows exactly twelve rows at once, defaults to B4-C4, scrolls through B5-C3, keeps all beat grids synchronized, and switching templates changes only scale highlighting and preview playback.
