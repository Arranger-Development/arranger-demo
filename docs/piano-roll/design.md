# Shared piano roll design

`PianoRoll` owns the note ruler, sixteen steps grouped into four beats, octave controls, synchronized scrolling, row indication, ARIA state, and optional note preview. Track editors provide note data and matrix callbacks only.

The fixed layout uses 36 total rows and 12 visible rows. Row height is derived from the viewport after subtracting two content paddings, eleven visible gaps, and the viewport border. Bass starts with `D1` at the top; Melody starts with `B4` at the top.

Pointer and focus events write one shared vertical CSS coordinate. Five `pointer-events: none` indicators use `translate3d`, enter without a transition, and fade out in 50ms. No row query or per-cell hover class is required.
