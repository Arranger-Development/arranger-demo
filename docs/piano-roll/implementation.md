# Shared piano roll implementation

1. Generate Bass `B2-C0` and Melody `B5-C3` data with `createPianoRollNotes`.
2. Render both editors through `PianoRoll`, retaining their headers, pickers, tutorial locks, and business callbacks.
3. Initialize scroll from `initialTopNote`, move octave controls by twelve logical rows, and clamp partial moves to the first or last complete viewport.
4. Preserve logical row position through resize and synchronize the ruler plus four beat viewports without recursive scroll handling.
5. Auto-reveal newly played Melody QWERTY notes by snapping to their octave page, without changing scale mappings or matrix data.
6. Remove the Melody thirteen-row override and stop Bass/Melody from using legacy row-hover selectors, then verify data, commands, playback, layout, accessibility, and build output.
